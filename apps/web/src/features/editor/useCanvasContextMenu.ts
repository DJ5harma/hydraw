import { selectionBounds } from "@hydraw/editor";
import type { Editor } from "@hydraw/editor";
import type { Point } from "@hydraw/document";
import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

/** Canvas-only gestures; native context menus remain available in text fields and other UI. */
export function useCanvasContextMenu(
  editor: Editor,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  open: () => void,
) {
  const [anchor, setAnchor] = useState<{ client: Point; screen: Point } | null>(null);
  const showSelection = useRef<(client: Point) => void>(() => {});
  const currentOpen = useRef(open);
  currentOpen.current = open;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let touch: { id: number; x: number; y: number } | null = null;
    let suppressUntil = 0;
    const pointers = new Set<number>();
    const screenPoint = (client: Point) => {
      const box = canvas.getBoundingClientRect();
      return { x: client.x - box.left, y: client.y - box.top };
    };
    function show(client: Point, target = true) {
      const screen = screenPoint(client);
      if (target) editor.selectContextTarget(screen);
      else {
        editor.finishTextEditing();
        editor.cancelGesture();
        editor.setTool("select");
      }
      setAnchor({ client, screen });
      currentOpen.current();
    }
    showSelection.current = (client) => show(client, false);
    function keyboardAnchor() {
      const snapshot = editor.getSnapshot();
      const bounds = selectionBounds(
        snapshot.document.shapes,
        snapshot.document.connectors,
        snapshot.selectedIds,
      );
      const rect = canvas!.getBoundingClientRect();
      const x = bounds
        ? (bounds.x + bounds.width / 2) * snapshot.camera.zoom + snapshot.camera.x
        : rect.width / 2;
      const y = bounds
        ? (bounds.y + bounds.height / 2) * snapshot.camera.zoom + snapshot.camera.y
        : rect.height / 2;
      show(
        {
          x: rect.left + Math.max(8, Math.min(rect.width - 8, x)),
          y: rect.top + Math.max(8, Math.min(rect.height - 8, y)),
        },
        false,
      );
    }
    const cancelTimer = () => {
      clearTimeout(timer);
      timer = undefined;
      touch = null;
    };
    const contextMenu = (event: MouseEvent) => {
      event.preventDefault();
      if (performance.now() < suppressUntil) return;
      if (event.clientX === 0 && event.clientY === 0) keyboardAnchor();
      else show({ x: event.clientX, y: event.clientY });
    };
    const keyDown = (event: KeyboardEvent) => {
      if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
      event.preventDefault();
      event.stopPropagation();
      keyboardAnchor();
    };
    const pointerDown = (event: PointerEvent) => {
      pointers.add(event.pointerId);
      cancelTimer();
      if (
        pointers.size !== 1 ||
        event.pointerType !== "touch" ||
        editor.getSnapshot().tool !== "select"
      )
        return;
      touch = { id: event.pointerId, x: event.clientX, y: event.clientY };
      timer = setTimeout(() => {
        if (!touch) return;
        suppressUntil = performance.now() + 1000;
        editor.cancelGesture();
        show({ x: touch.x, y: touch.y });
        cancelTimer();
      }, 550);
    };
    const pointerMove = (event: PointerEvent) => {
      if (
        touch &&
        event.pointerId === touch.id &&
        Math.hypot(event.clientX - touch.x, event.clientY - touch.y) > 8
      )
        cancelTimer();
    };
    const pointerEnd = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      cancelTimer();
    };
    const blur = () => {
      cancelTimer();
      pointers.clear();
    };
    const suppressClick = (event: MouseEvent) => {
      if (event.target === canvas && performance.now() < suppressUntil) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    canvas.addEventListener("contextmenu", contextMenu);
    canvas.addEventListener("keydown", keyDown, true);
    canvas.addEventListener("pointerdown", pointerDown, true);
    canvas.addEventListener("pointermove", pointerMove, true);
    window.addEventListener("pointerup", pointerEnd, true);
    window.addEventListener("pointercancel", pointerEnd, true);
    window.addEventListener("blur", blur);
    canvas.addEventListener("click", suppressClick, true);
    return () => {
      cancelTimer();
      canvas.removeEventListener("contextmenu", contextMenu);
      canvas.removeEventListener("keydown", keyDown, true);
      canvas.removeEventListener("pointerdown", pointerDown, true);
      canvas.removeEventListener("pointermove", pointerMove, true);
      window.removeEventListener("pointerup", pointerEnd, true);
      window.removeEventListener("pointercancel", pointerEnd, true);
      window.removeEventListener("blur", blur);
      canvas.removeEventListener("click", suppressClick, true);
    };
  }, [editor, canvasRef]);
  return { anchor, showSelection: (client: Point) => showSelection.current(client) };
}
