import { MAX_COORDINATE, MAX_SIZE, rectangleBetween } from "@hydraw/document";
import type { Fill, Point, Shape } from "@hydraw/document";
import { clamp, handlePoint, resizeRectangle, screenToWorld } from "./geometry.ts";
import type { ResizeHandle } from "./geometry.ts";
import type { Camera, EditorSnapshot } from "./types.ts";

import type { SelectionGesture } from "./selection.ts";
import type { ConnectorGesture } from "./connector-interactions.ts";
import { previewConnectorGesture } from "./connector-interactions.ts";

export type Gesture =
  | SelectionGesture
  | ConnectorGesture
  | { kind: "draw"; start: Point; id: string }
  | { kind: "move"; start: Point; shape: Shape }
  | { kind: "resize"; start: Point; shape: Shape; handle: ResizeHandle }
  | { kind: "pan"; start: Point; camera: Camera };

export function previewGesture(
  gesture: Exclude<Gesture, SelectionGesture>,
  screen: Point,
  camera: Camera,
  fill: Fill,
  shapes: readonly Shape[],
): Partial<EditorSnapshot> {
  if (
    gesture.kind === "connect" ||
    gesture.kind === "reconnect" ||
    gesture.kind === "move-connector"
  )
    return previewConnectorGesture(gesture, screen, camera, shapes);
  if (gesture.kind === "pan")
    return {
      camera: {
        ...gesture.camera,
        x: gesture.camera.x + screen.x - gesture.start.x,
        y: gesture.camera.y + screen.y - gesture.start.y,
      },
    };
  const raw = screenToWorld(screen, camera);
  if (gesture.kind === "resize") {
    const start = handlePoint(gesture.shape, gesture.handle);
    return {
      preview: resizeRectangle(gesture.shape, gesture.handle, {
        x: start.x + raw.x - gesture.start.x,
        y: start.y + raw.y - gesture.start.y,
      }),
    };
  }
  const point = {
    x: clamp(raw.x, -MAX_COORDINATE, MAX_COORDINATE),
    y: clamp(raw.y, -MAX_COORDINATE, MAX_COORDINATE),
  };
  if (gesture.kind === "draw") {
    const end = {
      x: clamp(point.x, gesture.start.x - MAX_SIZE, gesture.start.x + MAX_SIZE),
      y: clamp(point.y, gesture.start.y - MAX_SIZE, gesture.start.y + MAX_SIZE),
    };
    return { preview: rectangleBetween(gesture.id, gesture.start, end, fill) };
  }
  return {
    preview: {
      ...gesture.shape,
      x: clamp(gesture.shape.x + point.x - gesture.start.x, -MAX_COORDINATE, MAX_COORDINATE),
      y: clamp(gesture.shape.y + point.y - gesture.start.y, -MAX_COORDINATE, MAX_COORDINATE),
    },
  };
}
