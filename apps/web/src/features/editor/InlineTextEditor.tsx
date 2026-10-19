import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { TEXT_FONT_FAMILY, TEXT_LINE_HEIGHT, TEXT_PADDING } from "@hydraw/editor";
import type { Editor } from "@hydraw/editor";
import type { RefObject } from "react";

/** A native input supplies selection, clipboard and IME; the engine owns the semantic draft. */
export function InlineTextEditor({
  editor,
  canvasRef,
}: {
  editor: Editor;
  canvasRef: RefObject<HTMLCanvasElement | null>;
}) {
  const snapshot = useSyncExternalStore(editor.subscribe, editor.getSnapshot);
  const editing = snapshot.textEditing;
  if (!editing) return null;
  return <TextDraft key={editing.draft.id} editor={editor} canvasRef={canvasRef} />;
}

function TextDraft({
  editor,
  canvasRef,
}: {
  editor: Editor;
  canvasRef: RefObject<HTMLCanvasElement | null>;
}) {
  const { camera, textEditing } = useSyncExternalStore(editor.subscribe, editor.getSnapshot);
  const input = useRef<HTMLTextAreaElement>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    input.current?.focus({ preventScroll: true });
    input.current?.select();
  }, []);
  if (!textEditing) return null;
  const { draft } = textEditing;
  function finish(cancel = false) {
    if (cancel) editor.cancelTextEditing();
    else editor.finishTextEditing();
    canvasRef.current?.focus({ preventScroll: true });
  }
  return (
    <>
      <textarea
        ref={input}
        className="inline-text-editor"
        aria-label="Edit canvas text"
        aria-describedby="text-editing-help"
        spellCheck={false}
        value={draft.text}
        style={{
          left: draft.x * camera.zoom + camera.x,
          top: draft.y * camera.zoom + camera.y,
          width: draft.width,
          height: draft.height,
          transform: `scale(${camera.zoom})`,
          fontFamily: TEXT_FONT_FAMILY,
          fontSize: draft.fontSize,
          fontWeight: draft.fontWeight,
          lineHeight: TEXT_LINE_HEIGHT,
          padding: TEXT_PADDING,
          color: draft.color,
          textAlign: draft.textAlign,
        }}
        onChange={(event) => {
          try {
            editor.updateTextDraft(event.target.value);
            setError(null);
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "This text cannot be saved.");
          }
        }}
        onBlur={() => editor.finishTextEditing()}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Escape") {
            event.preventDefault();
            finish(true);
          }
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            finish();
          }
        }}
      />
      <div id="text-editing-help" className="text-editing-help">
        {error && <span role="alert">{error}</span>}
        Draft · Enter for a new line · Ctrl/⌘ Enter to save · Esc to cancel
      </div>
    </>
  );
}
