import type { DocumentTransaction } from "./transactions.ts";

export function operationObjectIds(operation: DocumentTransaction): readonly string[] {
  return Object.freeze([
    ...new Set(
      operation.changes.flatMap((change) =>
        change.type === "shape" || change.type === "connector"
          ? [change.before?.id ?? change.after!.id]
          : [],
      ),
    ),
  ]);
}

/** Keys isolate independent records, while guarding membership, bindings and scene order. */
export function operationDependencies(operation: DocumentTransaction): readonly string[] {
  const keys = new Set(
    operationWriteKeys(operation).filter(
      (key) =>
        key.startsWith("shape:") ||
        key.startsWith("connector:") ||
        key === "name" ||
        key === "theme",
    ),
  );
  for (const change of operation.changes) {
    if (change.type !== "shape" && change.type !== "connector") continue;
    if (!change.before && change.beforeId) keys.add(`${change.type}:${change.beforeId}`);
    if (change.type === "shape" && change.before && !change.after)
      keys.add(`links:${change.before.id}`);
    for (const groupId of [change.before?.groupId, change.after?.groupId])
      if (groupId) keys.add(`group:${groupId}`);
    if (change.before && change.after && change.before.zIndex !== change.after.zIndex)
      keys.add("order");
    if (change.type === "connector")
      for (const endpoint of [change.after?.start, change.after?.end])
        if (endpoint?.type === "binding") keys.add(`shape:${endpoint.shapeId}`);
  }
  return Object.freeze([...keys]);
}

export function operationWriteKeys(operation: DocumentTransaction): readonly string[] {
  const keys = new Set<string>();
  for (const change of operation.changes) {
    if (change.type === "name" || change.type === "theme") {
      keys.add(change.type);
      continue;
    }
    keys.add(`${change.type}:${change.before?.id ?? change.after!.id}`);
    if (!change.before || !change.after || change.before.groupId !== change.after.groupId)
      for (const groupId of [change.before?.groupId, change.after?.groupId])
        if (groupId) keys.add(`group:${groupId}`);
    if (!change.before || !change.after || change.before.zIndex !== change.after.zIndex)
      keys.add("order");
    if (change.type === "connector")
      for (const endpoint of [
        change.before?.start,
        change.before?.end,
        change.after?.start,
        change.after?.end,
      ])
        if (endpoint?.type === "binding") keys.add(`links:${endpoint.shapeId}`);
  }
  return Object.freeze([...keys]);
}
