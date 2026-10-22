import { useEffect } from "react";
import type { RefObject } from "react";
import type { Editor } from "@hydraw/editor";
import { attachCanvas } from "@hydraw/editor/canvas";

export function CanvasSurface({
  editor,
  canvasRef,
  onError,
}: {
  editor: Editor;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  onError: (message: string) => void;
}) {
  useEffect(() => {
    if (canvasRef.current)
      return attachCanvas(canvasRef.current, editor, (cause) =>
        onError(cause instanceof Error ? cause.message : "This drawing could not be saved."),
      );
  }, [editor, canvasRef, onError]);
  return (
    <canvas ref={canvasRef} className="drawing-canvas" tabIndex={0} aria-label="Drawing canvas" />
  );
}
