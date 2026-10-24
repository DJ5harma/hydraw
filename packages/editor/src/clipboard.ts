import {
  MAX_CONNECTORS,
  expandGroups,
  frameSelectionContents,
  clonedMetadata,
  MAX_SHAPES,
  applyTransaction,
  detachConnectorBindings,
  createDocument,
  connectorTransaction,
  decodeDocument,
  shapeTransaction,
  translateObjects,
} from "@hydraw/document";
import type {
  BoardDocument,
  DocumentChange,
  DocumentTransaction,
  Endpoint,
  Point,
} from "@hydraw/document";
import { selectionBounds } from "./selection.ts";

const CLIPBOARD_FORMAT = "hydraw/selection";
const CLIPBOARD_VERSION = 1;
export const MAX_CLIPBOARD_BYTES = 28_000_000;

function utf8ByteLengthUpTo(text: string, limit: number): number {
  let bytes = 0;
  for (let index = 0; index < text.length; index++) {
    const code = text.codePointAt(index)!;
    if (code > 0xffff) index++;
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
    if (bytes > limit) return bytes;
  }
  return bytes;
}

function allIds(document: BoardDocument): readonly string[] {
  return [
    ...document.shapes.map((shape) => shape.id),
    ...document.connectors.map((connector) => connector.id),
  ];
}

/** Serialize selected objects as a validated, portable Hydraw fragment. */
export function createClipboardFragment(
  document: BoardDocument,
  selectedIds: readonly string[],
): string | null {
  const selected = new Set(frameSelectionContents(document, expandGroups(document, selectedIds)));
  const shapes = document.shapes.filter((shape) => selected.has(shape.id));
  const nodes = new Set(shapes.map((shape) => shape.id));
  const connectors = document.connectors.filter(
    (connector) =>
      selected.has(connector.id) ||
      (connector.start.type === "binding" &&
        connector.end.type === "binding" &&
        nodes.has(connector.start.shapeId) &&
        nodes.has(connector.end.shapeId)),
  );
  if (!shapes.length && !connectors.length) return null;

  const detached = connectors.map((connector) =>
    detachConnectorBindings(connector, document.shapes, nodes),
  );
  const fragment = decodeDocument({
    ...createDocument(),
    name: "Clipboard selection",
    shapes,
    connectors: detached,
  });
  const serialized = JSON.stringify({
    format: CLIPBOARD_FORMAT,
    version: CLIPBOARD_VERSION,
    document: fragment,
  });
  if (utf8ByteLengthUpTo(serialized, MAX_CLIPBOARD_BYTES) > MAX_CLIPBOARD_BYTES)
    throw new Error("This selection is too large to copy.");
  return serialized;
}

/** Decode only Hydraw selection envelopes. Ordinary text and arbitrary JSON are ignored. */
export function decodeClipboardFragment(text: string): BoardDocument | null {
  if (utf8ByteLengthUpTo(text, MAX_CLIPBOARD_BYTES) > MAX_CLIPBOARD_BYTES) return null;
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const envelope = value as Record<string, unknown>;
  if (envelope.format !== CLIPBOARD_FORMAT) return null;
  if (envelope.version !== CLIPBOARD_VERSION)
    throw new Error("This clipboard selection uses an unsupported version.");
  const document = decodeDocument(envelope.document);
  if (!document.shapes.length && !document.connectors.length)
    throw new Error("This clipboard selection is empty.");
  return document;
}

/** Build a fresh-ID paste transaction centered on the requested world point. */
export function pastedSelection(
  document: BoardDocument,
  serialized: string,
  makeId: () => string,
  point: Point,
): Readonly<{ transaction: DocumentTransaction | null; ids: readonly string[] }> {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y))
    throw new Error("Invalid paste location.");
  const fragment = decodeClipboardFragment(serialized);
  if (!fragment) return { transaction: null, ids: [] };
  if (
    document.shapes.length + fragment.shapes.length > MAX_SHAPES ||
    document.connectors.length + fragment.connectors.length > MAX_CONNECTORS
  )
    throw new Error("There is not enough room to paste this selection.");

  const ids = allIds(fragment);
  const bounds = selectionBounds(fragment.shapes, fragment.connectors, ids);
  if (!bounds) return { transaction: null, ids: [] };
  const offset = {
    x: point.x - (bounds.x + bounds.width / 2),
    y: point.y - (bounds.y + bounds.height / 2),
  };
  const occupied = new Set([
    ...allIds(document),
    ...ids,
    ...[
      ...document.shapes,
      ...document.connectors,
      ...fragment.shapes,
      ...fragment.connectors,
    ].flatMap((item) => (item.groupId ? [item.groupId] : [])),
  ]);
  const uniqueId = () => {
    const id = makeId();
    if (!id || id.length > 100 || occupied.has(id))
      throw new Error("Could not create unique object identities.");
    occupied.add(id);
    return id;
  };
  const translated = translateObjects(fragment, ids, offset);
  const identity = new Map(ids.map((id) => [id, uniqueId()]));
  const metadata = clonedMetadata(fragment, document, ids, uniqueId, [...identity.values()]);
  const changes: DocumentChange[] = [];
  translated.shapes.forEach((shape, position) => {
    changes.push(
      ...shapeTransaction("Paste selection", document.shapes.length + position, null, {
        ...shape,
        ...metadata.get(shape.id),
        id: identity.get(shape.id)!,
      })!.changes,
    );
  });
  function remap(endpoint: Endpoint): Endpoint {
    if (endpoint.type === "point") return endpoint;
    const shapeId = identity.get(endpoint.shapeId);
    if (!shapeId) throw new Error("This clipboard selection has an invalid binding.");
    return { type: "binding" as const, shapeId };
  }
  translated.connectors.forEach((connector, position) => {
    changes.push(
      ...connectorTransaction("Paste selection", document.connectors.length + position, null, {
        ...connector,
        ...metadata.get(connector.id),
        id: identity.get(connector.id)!,
        start: remap(connector.start),
        end: remap(connector.end),
      })!.changes,
    );
  });
  if (!changes.length) return { transaction: null, ids: [] };
  const transaction = Object.freeze({
    label: "Paste selection",
    changes: Object.freeze(changes),
  });
  // Validate the adjusted indices and connector graph before handing work to the editor.
  applyTransaction(document, transaction);
  return { transaction, ids: Object.freeze([...identity.values()]) };
}
