import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

const narrowQuery = "(max-width: 900px)";

/** Layout state stays local; closing a panel never changes the document or selection. */
export function useInspectorPanel(textEditing: boolean) {
  const [narrow, setNarrow] = useState(() => window.matchMedia(narrowQuery).matches);
  const [open, setOpen] = useState(() => !window.matchMedia(narrowQuery).matches);
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  useEffect(() => {
    const media = window.matchMedia(narrowQuery);
    const resize = () => {
      setNarrow(media.matches);
      setOpen(!media.matches);
    };
    media.addEventListener("change", resize);
    return () => media.removeEventListener("change", resize);
  }, []);
  useEffect(() => {
    if (open && narrow) panelRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    if (!open && restoreFocus.current) {
      toggleRef.current?.focus();
      restoreFocus.current = false;
    }
  }, [open, narrow]);
  useEffect(() => {
    if (textEditing && narrow && open) {
      restoreFocus.current = false;
      setOpen(false);
    }
  }, [textEditing, narrow, open]);
  function close() {
    restoreFocus.current = true;
    setOpen(false);
  }
  function keyboard(event: KeyboardEvent) {
    if (event.key === "Escape" && !event.defaultPrevented && narrow) {
      event.preventDefault();
      close();
    }
    if (event.key === "Tab" && narrow) {
      const targets = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]',
        ) ?? [],
      ).filter((element) => element.getClientRects().length > 0);
      const first = targets[0];
      const last = targets.at(-1);
      if (event.shiftKey && event.target === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && event.target === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    if (event.defaultPrevented) event.stopPropagation();
  }
  return {
    open,
    narrow,
    panelRef,
    toggleRef,
    close,
    keyboard,
    toggle: () => {
      if (open) close();
      else setOpen(true);
    },
  };
}
