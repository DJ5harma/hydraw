import { useEffect, useRef } from "react";
import { decodeClipboardFragment } from "@hydraw/editor";
import type { Editor } from "@hydraw/editor";
import type { Point } from "@hydraw/document";

type ClipboardOptions = {
  editor: Editor;
  center: () => Point;
  onError: (message: string) => void;
};

function clipboardFocusIsInWorkspace(): boolean {
  const target = document.activeElement;
  if (!(target instanceof HTMLElement) || !target.closest(".workspace")) return false;
  if (
    target.closest(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="dialog"]',
    )
  )
    return false;
  return (
    target instanceof HTMLCanvasElement ||
    target.matches("button, [role='button']") ||
    Boolean(target.closest("[role='toolbar'], [role='navigation']"))
  );
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : "The clipboard selection could not be handled.";
}

/** Keep native clipboard behavior in text fields and dialogs; Hydraw handles canvas controls only. */
export function useClipboard({ editor, center, onError }: ClipboardOptions): void {
  const current = useRef({ center, onError });
  current.current = { center, onError };

  useEffect(() => {
    function copy(event: ClipboardEvent) {
      if (!clipboardFocusIsInWorkspace() || !event.clipboardData) return;
      try {
        const text = editor.copySelection();
        if (!text) return;
        event.clipboardData.setData("text/plain", text);
        event.preventDefault();
      } catch (cause) {
        current.current.onError(message(cause));
      }
    }

    function cut(event: ClipboardEvent) {
      if (!clipboardFocusIsInWorkspace() || !event.clipboardData) return;
      try {
        const text = editor.copySelection();
        if (!text) return;
        event.clipboardData.setData("text/plain", text);
        event.preventDefault();
        editor.removeSelection();
      } catch (cause) {
        current.current.onError(message(cause));
      }
    }

    function paste(event: ClipboardEvent) {
      if (!clipboardFocusIsInWorkspace() || !event.clipboardData) return;
      const text = event.clipboardData.getData("text/plain");
      if (!text) return;
      try {
        if (!decodeClipboardFragment(text)) return;
        event.preventDefault();
        editor.pasteSelection(text, current.current.center());
      } catch (cause) {
        event.preventDefault();
        current.current.onError(message(cause));
      }
    }

    document.addEventListener("copy", copy);
    document.addEventListener("cut", cut);
    document.addEventListener("paste", paste);
    return () => {
      document.removeEventListener("copy", copy);
      document.removeEventListener("cut", cut);
      document.removeEventListener("paste", paste);
    };
  }, [editor]);
}
