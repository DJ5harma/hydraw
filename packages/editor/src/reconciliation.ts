import { expandGroups } from "@hydraw/document";
import type { Connector, Endpoint } from "@hydraw/document";
import type { DocumentCommit } from "./document-session.ts";
import type { Gesture } from "./gestures.ts";
import { IDLE_GESTURE } from "./gestures.ts";
import type { EditorSnapshot } from "./types.ts";

function boundIds(connector: Connector): string[] {
  return [connector.start, connector.end].flatMap((endpoint) =>
    endpoint.type === "binding" ? [endpoint.shapeId] : [],
  );
}

function gestureIds(gesture: Gesture | null): readonly string[] {
  if (!gesture) return [];
  switch (gesture.kind) {
    case "resize":
      return [gesture.shape.id];
    case "move-selection":
      return gesture.ids;
    case "bend-connector":
    case "reconnect":
      return [gesture.connector.id, ...boundIds(gesture.connector)];
    case "create-connected":
      return [gesture.source.id];
    case "connect":
      return endpointIds(gesture.start);
    case "erase":
      return gesture.erasedIds;
    default:
      return [];
  }
}

function endpointIds(endpoint: Endpoint): string[] {
  return endpoint.type === "binding" ? [endpoint.shapeId] : [];
}

/** Pure reconciliation policy; remote changes never reset the camera or commit a draft. */
export function reconcileExternalChange(
  snapshot: EditorSnapshot,
  gesture: Gesture | null,
  event: DocumentCommit,
) {
  const affected = new Set([
    ...event.changedIds,
    ...expandGroups(snapshot.document, event.changedIds),
    ...expandGroups(event.document, event.changedIds),
  ]);
  const cancelGesture = gestureIds(gesture).some((id) => affected.has(id));
  const editing = snapshot.textEditing;
  const textId = editing?.ownerId ?? editing?.before?.id;
  const textOwner = textId
    ? snapshot.document.connectors.find((connector) => connector.id === textId)
    : undefined;
  const textDependencies = textId ? [textId, ...(textOwner ? boundIds(textOwner) : [])] : [];
  const textConflict = Boolean(
    editing &&
    (textDependencies.some((id) => affected.has(id)) ||
      event.operation?.edit.changes.some((change) => change.type === "theme")),
  );
  const patch: Partial<EditorSnapshot> = {};
  if (cancelGesture)
    Object.assign(patch, IDLE_GESTURE, {
      interactionNotice:
        "The current gesture was cancelled because another session changed its objects.",
    });
  if (textConflict)
    Object.assign(patch, {
      textEditing: null,
      recoveredTextDrafts: Object.freeze([...snapshot.recoveredTextDrafts, editing!.draft.text]),
      interactionNotice: "Another session changed the text target. Your draft is available below.",
    });
  return { cancelGesture, patch };
}
