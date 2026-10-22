import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, RefObject } from "react";

export type WorkspaceOverlay =
  | "context"
  | "insert"
  | "board"
  | "objects"
  | "geometry"
  | "help"
  | null;

/** One transient surface owns dismissal and focus; document/session state stays elsewhere. */
export function useWorkspaceOverlay(canvasRef: RefObject<HTMLCanvasElement | null>) {
  const [active, setActive] = useState<WorkspaceOverlay>(null);
  const origin = useRef<HTMLElement | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);
  const restoreFocus = useRef(false);

  const close = useCallback((restore = true) => {
    restoreFocus.current = restore;
    setActive(null);
  }, []);
  const dismissSelection = useCallback(
    () => setActive((current) => (current === "geometry" ? null : current)),
    [],
  );
  function open(next: WorkspaceOverlay) {
    if (!next) {
      close();
      return;
    }
    restoreFocus.current = false;
    origin.current =
      next === "context"
        ? canvasRef.current
        : (document.querySelector<HTMLElement>(`[data-overlay-trigger="${next}"]`) ??
          document.querySelector<HTMLElement>('[data-overlay-trigger="board"]'));
    setActive(next);
  }

  useLayoutEffect(() => {
    if (!active) {
      rootRef.current = null;
      if (restoreFocus.current) {
        restoreFocus.current = false;
        const target = origin.current;
        if (target?.isConnected && target.getClientRects().length) target.focus();
        else canvasRef.current?.focus();
      }
      return;
    }
    const dialog = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-workspace-overlay-root] [role="dialog"], [data-workspace-overlay-root][role="menu"]',
      ),
    ).find((el) => el.getClientRects().length);
    rootRef.current = dialog?.closest<HTMLElement>("[data-workspace-overlay-root]") ?? null;
    dialog?.querySelector<HTMLElement>("input:not(:disabled)")?.focus();
    if (!dialog?.contains(document.activeElement))
      dialog?.querySelector<HTMLElement>("button:not(:disabled), select:not(:disabled)")?.focus();
  }, [active, canvasRef]);

  useEffect(() => {
    function outside(event: PointerEvent) {
      const root = active
        ? rootRef.current
        : document.querySelector<HTMLElement>(".selection-properties-root");
      if (!root || !(event.target instanceof Node) || root.contains(event.target)) return;
      const focused = document.activeElement;
      // React may unmount before the browser transfers focus. Flush native drafts first.
      if (
        focused instanceof HTMLElement &&
        root.contains(focused) &&
        focused.matches("input, textarea, select")
      )
        focused.blur();
      // Automatic properties stay open and never add an extra click before editing.
      if (!active) return;
      // Dismissing a surface cannot also start a drawing/move gesture.
      if (event.target === canvasRef.current) {
        event.preventDefault();
        event.stopPropagation();
      }
      close(false);
    }
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, [active, canvasRef, close]);

  function keyboard(event: KeyboardEvent) {
    if (event.defaultPrevented || event.nativeEvent.isComposing) return true;
    if (!active) return false;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return true;
    }
    // Preserve native editing commands inside property and board controls.
    return event.target instanceof Node && Boolean(rootRef.current?.contains(event.target));
  }
  return { active, open, close, dismissSelection, keyboard };
}
