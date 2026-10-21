import { expandGroups, clonedMetadata } from "./object-scene.ts";
import { MAX_CONNECTORS, MAX_COORDINATE, MAX_ENDPOINT_COORDINATE, MAX_SHAPES } from "./model.ts";
import type { BoardDocument, Connector, Endpoint, Point, Shape } from "./model.ts";
import { createConnectorResolver } from "./connectors.ts";
import { connectorTransaction, shapeTransaction } from "./transactions.ts";
import type { DocumentChange, DocumentTransaction } from "./transactions.ts";

export type ObjectUpdates = Readonly<{
  shapes: readonly Shape[];
  connectors: readonly Connector[];
}>;

/** A common constrained delta preserves relative positions at document boundaries. */
export function translateObjects(
  document: BoardDocument,
  ids: readonly string[],
  requested: Point,
): ObjectUpdates {
  if (!Number.isFinite(requested.x) || !Number.isFinite(requested.y))
    throw new Error("Invalid selection movement.");
  const selected = new Set(ids);
  const shapes = document.shapes.filter((shape) => selected.has(shape.id));
  const connectors = document.connectors.filter((connector) => selected.has(connector.id));
  let minX = -Infinity,
    maxX = Infinity,
    minY = -Infinity,
    maxY = Infinity;
  function constrain(point: Point, limit: number) {
    minX = Math.max(minX, -limit - point.x);
    maxX = Math.min(maxX, limit - point.x);
    minY = Math.max(minY, -limit - point.y);
    maxY = Math.min(maxY, limit - point.y);
  }
  for (const shape of shapes) constrain(shape, MAX_COORDINATE);
  for (const connector of connectors)
    for (const endpoint of [connector.start, connector.end])
      if (endpoint.type === "point") constrain(endpoint, MAX_ENDPOINT_COORDINATE);
  const dx = Math.max(minX, Math.min(maxX, requested.x));
  const dy = Math.max(minY, Math.min(maxY, requested.y));
  const moveEndpoint = (endpoint: Endpoint): Endpoint =>
    endpoint.type === "point"
      ? { type: "point", x: endpoint.x + dx, y: endpoint.y + dy }
      : endpoint;
  return {
    shapes: shapes.map((shape) => ({ ...shape, x: shape.x + dx, y: shape.y + dy })),
    connectors: connectors.map((connector) => ({
      ...connector,
      start: moveEndpoint(connector.start),
      end: moveEndpoint(connector.end),
    })),
  };
}

export function updateObjectsTransaction(
  document: BoardDocument,
  label: string,
  updates: ObjectUpdates,
): DocumentTransaction | null {
  const changes: DocumentChange[] = [];
  const shapePositions = new Map(document.shapes.map((shape, index) => [shape.id, index]));
  const connectorPositions = new Map(
    document.connectors.map((connector, index) => [connector.id, index]),
  );
  for (const shape of updates.shapes) {
    const index = shapePositions.get(shape.id);
    if (index === undefined) throw new Error("Cannot update a missing shape.");
    const change = shapeTransaction(label, index, document.shapes[index]!, shape);
    if (change) changes.push(...change.changes);
  }
  for (const connector of updates.connectors) {
    const index = connectorPositions.get(connector.id);
    if (index === undefined) throw new Error("Cannot update a missing connector.");
    const change = connectorTransaction(label, index, document.connectors[index]!, connector);
    if (change) changes.push(...change.changes);
  }
  return changes.length ? Object.freeze({ label, changes: Object.freeze(changes) }) : null;
}

export function deleteObjectsTransaction(
  document: BoardDocument,
  ids: readonly string[],
): DocumentTransaction | null {
  const selected = new Set(ids);
  const changes: DocumentChange[] = [];
  for (let index = document.connectors.length - 1; index >= 0; index--) {
    const before = document.connectors[index]!;
    if (
      selected.has(before.id) ||
      [before.start, before.end].some(
        (endpoint) => endpoint.type === "binding" && selected.has(endpoint.shapeId),
      )
    )
      changes.push(Object.freeze({ type: "connector", index, before, after: null }));
  }
  for (let index = document.shapes.length - 1; index >= 0; index--) {
    const before = document.shapes[index]!;
    if (selected.has(before.id))
      changes.push(Object.freeze({ type: "shape", index, before, after: null }));
  }
  return changes.length
    ? Object.freeze({ label: "Delete selection", changes: Object.freeze(changes) })
    : null;
}

export function deleteShapeTransaction(
  document: BoardDocument,
  id: string,
): DocumentTransaction | null {
  return document.shapes.some((shape) => shape.id === id)
    ? deleteObjectsTransaction(document, [id])
    : null;
}

/** Clone selected nodes and their internal edges. External bindings become independent points. */
export function duplicateObjects(
  document: BoardDocument,
  ids: readonly string[],
  makeId: () => string,
  offset: Point = { x: 24, y: 24 },
): Readonly<{ transaction: DocumentTransaction | null; ids: readonly string[] }> {
  const selected = new Set(expandGroups(document, ids));
  const nodes = new Set(
    document.shapes.filter((shape) => selected.has(shape.id)).map((shape) => shape.id),
  );
  const edges = document.connectors.filter(
    (connector) =>
      selected.has(connector.id) ||
      (connector.start.type === "binding" &&
        connector.end.type === "binding" &&
        nodes.has(connector.start.shapeId) &&
        nodes.has(connector.end.shapeId)),
  );
  if (
    document.shapes.length + nodes.size > MAX_SHAPES ||
    document.connectors.length + edges.length > MAX_CONNECTORS
  )
    throw new Error("There is not enough room to duplicate this selection. Select fewer objects.");
  const resolveConnector = createConnectorResolver(document.shapes);
  const detached = edges.map((connector) => {
    const resolved = resolveConnector(connector);
    function endpoint(key: "start" | "end"): Endpoint {
      const endpoint = connector[key];
      return endpoint.type === "binding" && !nodes.has(endpoint.shapeId)
        ? { type: "point", ...resolved[key] }
        : endpoint;
    }
    return { ...connector, start: endpoint("start"), end: endpoint("end") };
  });
  const updates = translateObjects(
    { ...document, connectors: detached },
    [...nodes, ...edges.map((edge) => edge.id)],
    offset,
  );
  const identities = new Map<string, string>();
  const used = new Set([
    ...document.shapes.map((shape) => shape.id),
    ...document.connectors.map((connector) => connector.id),
    ...[...document.shapes, ...document.connectors].flatMap((item) =>
      item.groupId ? [item.groupId] : [],
    ),
  ]);
  for (const object of [...updates.shapes, ...updates.connectors]) {
    const id = makeId();
    if (!id || id.length > 100 || used.has(id))
      throw new Error("Could not create unique object identities.");
    used.add(id);
    identities.set(object.id, id);
  }
  const metadata = clonedMetadata(document, document, [...identities.keys()], makeId, [
    ...identities.values(),
  ]);
  const changes: DocumentChange[] = [];
  updates.shapes.forEach((shape, position) =>
    changes.push(
      ...shapeTransaction("Duplicate selection", document.shapes.length + position, null, {
        ...shape,
        ...metadata.get(shape.id),
        id: identities.get(shape.id)!,
      })!.changes,
    ),
  );
  function remap(endpoint: Endpoint): Endpoint {
    return endpoint.type === "binding"
      ? { type: "binding", shapeId: identities.get(endpoint.shapeId)! }
      : endpoint;
  }
  updates.connectors.forEach((connector, position) =>
    changes.push(
      ...connectorTransaction("Duplicate selection", document.connectors.length + position, null, {
        ...connector,
        ...metadata.get(connector.id),
        id: identities.get(connector.id)!,
        start: remap(connector.start),
        end: remap(connector.end),
      })!.changes,
    ),
  );
  return {
    transaction: changes.length
      ? Object.freeze({ label: "Duplicate selection", changes: Object.freeze(changes) })
      : null,
    ids: Object.freeze([...identities.values()]),
  };
}
