import type { BoardDocument, Connector, Shape } from "./model.ts";
import { updateObjectsTransaction } from "./selection-operations.ts";
import type { DocumentTransaction } from "./transactions.ts";

export type SceneObject = Shape | Connector;
export type OrderDirection = "front" | "back" | "forward" | "backward";

import { sceneObjects, expandGroups } from "./object-scene.ts";
export { sceneObjects, expandGroups } from "./object-scene.ts";

function expandedObjects(document: BoardDocument, ids: readonly string[]): readonly SceneObject[] {
  const selected = new Set(expandGroups(document, ids));
  return [...document.connectors, ...document.shapes].filter((object) => selected.has(object.id));
}

function locked(objects: readonly SceneObject[]): boolean {
  return objects.some((object) => object.locked === true);
}

function selectedMetadataTransaction(
  document: BoardDocument,
  ids: readonly string[],
  label: string,
  change: (object: SceneObject) => SceneObject,
): DocumentTransaction | null {
  const selected = new Set(expandGroups(document, ids));
  if (!selected.size) return null;
  return updateObjectsTransaction(document, label, {
    shapes: document.shapes
      .filter((shape) => selected.has(shape.id))
      .map((shape) => change(shape) as Shape),
    connectors: document.connectors
      .filter((connector) => selected.has(connector.id))
      .map((connector) => change(connector) as Connector),
  });
}

export function groupObjectsTransaction(
  document: BoardDocument,
  ids: readonly string[],
  groupId: string,
): DocumentTransaction | null {
  if (!groupId || groupId.length > 100) throw new Error("Invalid group identity.");
  const objects = expandedObjects(document, ids);
  if (objects.length < 2 || locked(objects)) return null;
  return selectedMetadataTransaction(
    document,
    objects.map((object) => object.id),
    "Group objects",
    (object) => ({
      ...object,
      groupId,
    }),
  );
}

export function ungroupObjectsTransaction(
  document: BoardDocument,
  ids: readonly string[],
): DocumentTransaction | null {
  const objects = expandedObjects(document, ids).filter((object) => object.groupId !== undefined);
  if (!objects.length || locked(objects)) return null;
  const selected = new Set(objects.map((object) => object.id));
  return updateObjectsTransaction(document, "Ungroup objects", {
    shapes: document.shapes
      .filter((shape) => selected.has(shape.id))
      .map(({ groupId: _groupId, ...shape }) => shape),
    connectors: document.connectors
      .filter((connector) => selected.has(connector.id))
      .map(({ groupId: _groupId, ...connector }) => connector),
  });
}

export function setObjectsLockedTransaction(
  document: BoardDocument,
  ids: readonly string[],
  value: boolean,
): DocumentTransaction | null {
  const objects = expandedObjects(document, ids);
  if (!objects.length || objects.every((object) => object.locked === value)) return null;
  return selectedMetadataTransaction(
    document,
    objects.map((object) => object.id),
    value ? "Lock objects" : "Unlock objects",
    (object) => {
      if (value) return { ...object, locked: true };
      const { locked: _locked, ...unlocked } = object;
      return unlocked;
    },
  );
}

function sameOrder(left: readonly SceneObject[], right: readonly SceneObject[]): boolean {
  return (
    left.length === right.length && left.every((object, index) => object.id === right[index]?.id)
  );
}

export function reorderObjectsTransaction(
  document: BoardDocument,
  ids: readonly string[],
  direction: OrderDirection,
): DocumentTransaction | null {
  const selectedIds = new Set(expandGroups(document, ids));
  const current = sceneObjects(document);
  const selected = current.filter((object) => selectedIds.has(object.id));
  if (!selected.length || locked(selected)) return null;
  const unselected = current.filter((object) => !selectedIds.has(object.id));
  let next: SceneObject[];
  if (direction === "front") {
    next = [...unselected, ...selected];
  } else if (direction === "back") {
    next = [...selected, ...unselected];
  } else {
    next = [...current];
    if (direction === "forward") {
      for (let i = next.length - 2; i >= 0; i--)
        if (selectedIds.has(next[i]!.id) && !selectedIds.has(next[i + 1]!.id))
          [next[i], next[i + 1]] = [next[i + 1]!, next[i]!];
    } else {
      for (let i = 1; i < next.length; i++)
        if (selectedIds.has(next[i]!.id) && !selectedIds.has(next[i - 1]!.id))
          [next[i], next[i - 1]] = [next[i - 1]!, next[i]!];
    }
  }
  if (sameOrder(current, next)) return null;
  const ranks = new Map(next.map((object, index) => [object.id, index]));
  return updateObjectsTransaction(
    document,
    {
      front: "Bring to front",
      back: "Send to back",
      forward: "Bring forward",
      backward: "Send backward",
    }[direction],
    {
      shapes: document.shapes.map((shape) => ({ ...shape, zIndex: ranks.get(shape.id)! })),
      connectors: document.connectors.map((connector) => ({
        ...connector,
        zIndex: ranks.get(connector.id)!,
      })),
    },
  );
}
