import { useEffect } from "react";
import type { RefObject } from "react";
import type { Editor } from "@hydraw/editor";
import { attachCanvas } from "@hydraw/editor/canvas";

export function CanvasSurface({
  editor,
  canvasRef,
  onError,
  onImageCrop,
}: {
  editor: Editor;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  onError: (message: string) => void;
  onImageCrop?: (id: string) => void;
}) {
  useEffect(() => {
    if (canvasRef.current)
      return attachCanvas(canvasRef.current, editor, (cause) =>
        onError(cause instanceof Error ? cause.message : "This drawing could not be saved."),
      );
  }, [editor, canvasRef, onError]);
  return (
    <canvas
      onDoubleClick={() => {
        const snapshot = editor.getSnapshot();
        const image = snapshot.document.shapes.find((shape) => shape.id === snapshot.selectedId);
        if (image?.type === "image") onImageCrop?.(image.id);
      }}
      ref={canvasRef}
      className="drawing-canvas"
      tabIndex={0}
      aria-label="Drawing canvas"
    />
  );
}
