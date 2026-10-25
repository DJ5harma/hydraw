import { MAX_CONNECTORS, MAX_COORDINATE, MAX_SHAPES } from "./model.ts";
import type { BoardDocument, Connector, Point, Shape } from "./model.ts";
import { applyTransaction } from "./transactions.ts";
import type { DocumentChange, DocumentTransaction } from "./transactions.ts";
import { sceneObjects } from "./object-scene.ts";

const MAX_Z_INDEX = 1_000_000_000;

export type PresetId = "request-flow" | "async-worker" | "service-boundary";
export type PresetDescriptor = Readonly<{ id: PresetId; name: string; description: string }>;
export const PRESETS: readonly PresetDescriptor[] = Object.freeze([
  Object.freeze({
    id: "request-flow",
    name: "Request flow",
    description: "Client → API → Database",
  }),
  Object.freeze({ id: "async-worker", name: "Async worker", description: "API → Queue → Worker" }),
  Object.freeze({
    id: "service-boundary",
    name: "Service boundary",
    description: "Gateway → Service → Database",
  }),
]);

type Template = Readonly<{
  labels: readonly [string, string, string];
  kinds: readonly [
    "rectangle" | "ellipse" | "diamond",
    "rectangle" | "ellipse" | "diamond",
    "rectangle" | "ellipse" | "diamond",
  ];
}>;
const templates: Record<PresetId, Template> = {
  "request-flow": {
    labels: ["Client", "API", "Database"],
    kinds: ["ellipse", "rectangle", "rectangle"],
  },
  "async-worker": {
    labels: ["API", "Queue", "Worker"],
    kinds: ["rectangle", "diamond", "rectangle"],
  },
  "service-boundary": {
    labels: ["Gateway", "Service", "Database"],
    kinds: ["diamond", "rectangle", "ellipse"],
  },
};

/** Create an editable three-node graph centered at the requested world point. */
export function insertPreset(
  document: BoardDocument,
  id: PresetId,
  point: Point,
  makeId: () => string,
): Readonly<{ transaction: DocumentTransaction | null; ids: readonly string[] }> {
  const template = templates[id];
  if (!template) throw new Error("Unknown document preset.");
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y))
    throw new Error("Invalid preset position.");
  if (document.shapes.length + 3 > MAX_SHAPES || document.connectors.length + 2 > MAX_CONNECTORS)
    throw new Error("There is not enough room to insert this preset.");
  const used = new Set([...document.shapes, ...document.connectors].map((item) => item.id));
  for (const item of [...document.shapes, ...document.connectors])
    if (item.groupId) used.add(item.groupId);
  const takeId = () => {
    const value = makeId();
    if (!value || value.length > 100 || used.has(value))
      throw new Error("Could not create unique object identities.");
    used.add(value);
    return value;
  };
  const groupId = takeId();
  const nodeIds = template.labels.map(() => takeId());
  const edgeIds = [takeId(), takeId()];
  const x0 = point.x - 280;
  const allObjects = [...document.shapes, ...document.connectors];
  const top = allObjects.reduce((rank, object) => Math.max(rank, object.zIndex ?? 0), 0);
  const rebase = top + 5 > MAX_Z_INDEX;
  const ranks = new Map<string, number>();
  if (rebase) sceneObjects(document).forEach((object, index) => ranks.set(object.id, index));
  const baseRank = rebase ? allObjects.length : top;
  const shapes: Shape[] = template.labels.map((label, index) => ({
    id: nodeIds[index]!,
    type: "rectangle",
    kind: template.kinds[index],
    x: x0 + index * 280 - 100,
    y: point.y - 60,
    width: 200,
    height: 120,
    fill: ["#e7eefb", "#e6f2ea", "#fff0d5"][index] as "#e7eefb" | "#e6f2ea" | "#fff0d5",
    label: { text: label, fontSize: 16, fontWeight: 700, color: "#243e33" },
    groupId,
    zIndex: baseRank + 3 + index,
  }));
  const connectors: Connector[] = edgeIds.map((edgeId, index) => ({
    id: edgeId,
    type: "connector",
    start: { type: "binding", shapeId: nodeIds[index]! },
    end: { type: "binding", shapeId: nodeIds[index + 1]! },
    color: "#202124",
    arrowhead: "arrow",
    groupId,
    zIndex: baseRank + 1 + index,
  }));
  // Reject placements outside document bounds before creating a transaction.
  if (
    shapes.some((shape) => Math.abs(shape.x) > MAX_COORDINATE || Math.abs(shape.y) > MAX_COORDINATE)
  )
    throw new Error("This preset would be outside the supported board area.");
  const changes: DocumentChange[] = [
    ...(rebase
      ? document.shapes.flatMap((shape) => {
          const zIndex = ranks.get(shape.id)!;
          return shape.zIndex === zIndex
            ? []
            : [{ type: "shape" as const, before: shape, after: { ...shape, zIndex } }];
        })
      : []),
    ...(rebase
      ? document.connectors.flatMap((connector) => {
          const zIndex = ranks.get(connector.id)!;
          return connector.zIndex === zIndex
            ? []
            : [
                {
                  type: "connector" as const,
                  before: connector,
                  after: { ...connector, zIndex },
                },
              ];
        })
      : []),
    ...shapes.map((shape) => ({
      type: "shape" as const,
      before: null,
      after: shape,
    })),
    ...connectors.map((connector) => ({
      type: "connector" as const,
      before: null,
      after: connector,
    })),
  ];
  const transaction = Object.freeze({
    label: `Insert ${PRESETS.find((preset) => preset.id === id)!.name}`,
    changes: Object.freeze(changes),
  });
  // Applying validates all records and connector bindings as a single atomic graph operation.
  applyTransaction(document, transaction);
  return { transaction, ids: Object.freeze([...nodeIds, ...edgeIds]) };
}
