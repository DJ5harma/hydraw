import type { Point } from "@hydraw/document";
import type { Editor } from "../editor.ts";
import type { ResizeHandle } from "../geometry.ts";

const resizeCursors: Record<ResizeHandle, string> = {
  nw: "nwse-resize",
  n: "ns-resize",
  ne: "nesw-resize",
  e: "ew-resize",
  se: "nwse-resize",
  s: "ns-resize",
  sw: "nesw-resize",
  w: "ew-resize",
};

export function bindCanvasInput(
  canvas: HTMLCanvasElement,
  editor: Editor,
  schedule: () => void,
  onError?: (cause: unknown) => void,
) {
  let activePointer: number | null = null;
  let spacePressed = false;
  let lastPoint: Point | null = null;
  let recognitionTimer: ReturnType<typeof setTimeout> | null = null;
  let recognitionAnchor: Point | null = null;
  const events = new AbortController();
  const options = { signal: events.signal };
  function clearRecognition(): void {
    if (recognitionTimer !== null) clearTimeout(recognitionTimer);
    recognitionTimer = null;
    recognitionAnchor = null;
  }
  function scheduleRecognition(anchor: Point): void {
    clearRecognition();
    if (editor.getSnapshot().tool !== "draw") return;
    recognitionAnchor = anchor;
    recognitionTimer = setTimeout(() => {
      recognitionTimer = null;
      try {
        editor.recognizeDrawing();
        schedule();
      } catch (error) {
        cancel();
        if (onError) onError(error);
        else throw error;
      }
    }, 500);
  }
  function point(event: MouseEvent): Point {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  function cancel(): void {
    const pointer = activePointer;
    activePointer = null;
    clearRecognition();
    editor.cancelGesture();
    if (pointer !== null && canvas.hasPointerCapture(pointer))
      canvas.releasePointerCapture(pointer);
  }
  canvas.addEventListener(
    "pointerdown",
    (event) => {
      if (activePointer !== null || (event.button !== 0 && event.button !== 1)) return;
      event.preventDefault();
      canvas.focus({ preventScroll: true });
      activePointer = event.pointerId;
      lastPoint = point(event);
      try {
        canvas.setPointerCapture(event.pointerId);
        editor.begin(point(event), spacePressed || event.button === 1, event.shiftKey);
        if (editor.getSnapshot().tool === "draw" && editor.getSnapshot().interacting)
          scheduleRecognition(lastPoint);
      } catch (error) {
        cancel();
        if (onError) onError(error);
        else throw error;
      }
    },
    options,
  );
  canvas.addEventListener(
    "pointermove",
    (event) => {
      lastPoint = point(event);
      if (activePointer === event.pointerId) {
        try {
          editor.move(lastPoint, !event.altKey);
          if (
            editor.getSnapshot().tool === "draw" &&
            recognitionAnchor &&
            Math.hypot(lastPoint.x - recognitionAnchor.x, lastPoint.y - recognitionAnchor.y) > 3
          )
            scheduleRecognition(lastPoint);
        } catch (error) {
          cancel();
          if (onError) onError(error);
          else throw error;
        }
      }
      schedule();
    },
    options,
  );
  canvas.addEventListener(
    "pointerup",
    (event) => {
      if (activePointer !== event.pointerId) return;
      try {
        editor.move(point(event), !event.altKey);
        editor.finish();
      } catch (error) {
        if (onError) onError(error);
        else throw error;
      } finally {
        cancel();
      }
    },
    options,
  );
  canvas.addEventListener(
    "dblclick",
    (event) => {
      if (editor.getSnapshot().tool === "select") editor.editTextAt(point(event));
    },
    options,
  );
  canvas.addEventListener(
    "pointercancel",
    (event) => {
      if (activePointer === event.pointerId) cancel();
    },
    options,
  );
  canvas.addEventListener(
    "lostpointercapture",
    (event) => {
      if (activePointer === event.pointerId) cancel();
    },
    options,
  );
  canvas.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Alt" && activePointer !== null && lastPoint) editor.move(lastPoint, false);
      if (event.code === "Space") {
        event.preventDefault();
        spacePressed = true;
        schedule();
      }
      if (event.key === "Escape") {
        if (editor.getSnapshot().interacting) event.stopPropagation();
        cancel();
      }
    },
    options,
  );
  canvas.addEventListener(
    "keyup",
    (event) => {
      if (event.key === "Alt" && activePointer !== null && lastPoint) editor.move(lastPoint, true);
      if (event.code === "Space") {
        spacePressed = false;
        schedule();
      }
    },
    options,
  );
  canvas.addEventListener(
    "blur",
    () => {
      spacePressed = false;
      cancel();
      schedule();
    },
    options,
  );
  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const unit =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? canvas.clientHeight
            : 1;
      if (event.ctrlKey || event.metaKey) {
        const rect = canvas.getBoundingClientRect();
        editor.zoomAt(
          { x: event.clientX - rect.left, y: event.clientY - rect.top },
          Math.exp(-Math.max(-100, Math.min(100, event.deltaY * unit)) * 0.01),
        );
      } else editor.pan(-event.deltaX * unit, -event.deltaY * unit);
    },
    { ...options, passive: false },
  );

  window.addEventListener(
    "blur",
    () => {
      spacePressed = false;
      cancel();
      schedule();
    },
    options,
  );
  canvas.addEventListener(
    "pointerleave",
    () => {
      if (activePointer === null) {
        lastPoint = null;
        schedule();
      }
    },
    options,
  );
  return {
    cursor(): string {
      const snapshot = editor.getSnapshot();
      if (snapshot.tool === "hand" || spacePressed)
        return snapshot.interacting ? "grabbing" : "grab";
      if (
        snapshot.tool === "rectangle" ||
        snapshot.tool === "draw" ||
        snapshot.tool === "connector"
      )
        return "crosshair";
      if (snapshot.tool === "text") return "text";
      if (snapshot.activeEndpoint || (lastPoint && editor.getConnectorEndpointAt(lastPoint)))
        return "crosshair";
      if (lastPoint && editor.getConnectionHandleAt(lastPoint)) return "crosshair";
      const handle =
        snapshot.activeHandle ?? (lastPoint ? editor.getResizeHandleAt(lastPoint) : null);
      return handle ? resizeCursors[handle] : snapshot.interacting ? "grabbing" : "default";
    },
    dispose(): void {
      events.abort();
      cancel();
    },
  };
}
