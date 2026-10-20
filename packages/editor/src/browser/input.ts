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

export function bindCanvasInput(canvas: HTMLCanvasElement, editor: Editor, schedule: () => void) {
  let activePointer: number | null = null;
  let spacePressed = false;
  let lastPoint: Point | null = null;
  const events = new AbortController();
  const options = { signal: events.signal };
  function point(event: MouseEvent): Point {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  function cancel(): void {
    const pointer = activePointer;
    activePointer = null;
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
      try {
        canvas.setPointerCapture(event.pointerId);
        editor.begin(point(event), spacePressed || event.button === 1, event.shiftKey);
      } catch (error) {
        cancel();
        throw error;
      }
    },
    options,
  );
  canvas.addEventListener(
    "pointermove",
    (event) => {
      lastPoint = point(event);
      if (activePointer === event.pointerId) editor.move(lastPoint);
      schedule();
    },
    options,
  );
  canvas.addEventListener(
    "pointerup",
    (event) => {
      if (activePointer !== event.pointerId) return;
      try {
        editor.move(point(event));
        editor.finish();
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
      if (snapshot.tool === "rectangle" || snapshot.tool === "connector") return "crosshair";
      if (snapshot.tool === "text") return "text";
      if (snapshot.activeEndpoint || (lastPoint && editor.getConnectorEndpointAt(lastPoint)))
        return "crosshair";
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
