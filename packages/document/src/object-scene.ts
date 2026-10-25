import type { BoardDocument, Shape, Connector, ObjectMetadata } from "./model.ts";
export type SceneObject = Shape | Connector;

export function selectedObjects(
  document: BoardDocument,
  ids: readonly string[],
): readonly SceneObject[] {
  const selected = new Set(ids);
  return [...document.shapes, ...document.connectors].filter((object) => selected.has(object.id));
}

/** A locked member protects its entire flat group, regardless of selection/input method. */
export function lockedObjectIds(document: BoardDocument): ReadonlySet<string> {
  const locked = [...document.shapes, ...document.connectors]
    .filter((object) => object.locked)
    .map((object) => object.id);
  return new Set(locked.length ? expandGroups(document, locked) : []);
}

export function commonGroupId(objects: readonly ObjectMetadata[]): string | undefined {
  const groupId = objects[0]?.groupId;
  return groupId && objects.every((object) => object.groupId === groupId) ? groupId : undefined;
}

/** Return drawable objects from back to front, using the original scene order for stable ties. */
export function sceneObjects(document: BoardDocument): readonly SceneObject[] {
  const baseline = [...document.connectors, ...document.shapes];
  return Object.freeze(
    baseline
      .map((object, index) => ({ object, index, z: object.zIndex ?? 0 }))
      .sort((left, right) => left.z - right.z || left.index - right.index)
      .map(({ object }) => object),
  );
}

/** Expand selected IDs to every member of their flat groups in document collection order. */
export function expandGroups(document: BoardDocument, ids: readonly string[]): readonly string[] {
  const selected = new Set(ids);
  const objects = [...document.shapes, ...document.connectors];
  const groupIds = new Set(
    objects
      .filter((object) => selected.has(object.id) && object.groupId !== undefined)
      .map((object) => object.groupId!),
  );
  return Object.freeze(
    objects
      .filter(
        (object) => selected.has(object.id) || (object.groupId && groupIds.has(object.groupId)),
      )
      .map((object) => object.id),
  );
}

/** Copies form a new editable group, never joining the source or target groups. */
export function clonedMetadata(
  source: BoardDocument,
  target: BoardDocument,
  ids: readonly string[],
  makeId: () => string,
  reservedIds: readonly string[],
): ReadonlyMap<string, ObjectMetadata> {
  const selected = new Set(ids);
  const all = [...target.shapes, ...target.connectors, ...source.shapes, ...source.connectors];
  const used = new Set([
    ...all.flatMap((item) => (item.groupId ? [item.id, item.groupId] : [item.id])),
    ...reservedIds,
  ]);
  const groups = new Map<string, string>();
  const objects = sceneObjects(source).filter((item) => selected.has(item.id));
  for (const object of objects)
    if (object.groupId && !groups.has(object.groupId)) {
      const id = makeId();
      if (!id || id.length > 100 || used.has(id))
        throw new Error("Could not create a unique group identity.");
      used.add(id);
      groups.set(object.groupId, id);
    }
  let top = 0;
  for (const object of [...target.connectors, ...target.shapes])
    top = Math.max(top, object.zIndex ?? 0);
  return new Map(
    objects.map((object, index) => [
      object.id,
      {
        groupId: object.groupId ? groups.get(object.groupId) : undefined,
        locked: false,
        zIndex: Math.min(1_000_000_000, top + index + 1),
      },
    ]),
  );
}
