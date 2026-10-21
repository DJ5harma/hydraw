import { useEffect } from "react";
import type { RefObject } from "react";
import type { Editor } from "@hydraw/editor";
import { attachCanvas } from "@hydraw/editor/canvas";

export function CanvasSurface({
  editor,
  canvasRef,
}: {
  editor: Editor;
  canvasRef: RefObject<HTMLCanvasElement | null>;
}) {
  useEffect(() => {
    if (canvasRef.current) return attachCanvas(canvasRef.current, editor);
  }, [editor, canvasRef]);
  return (
    <canvas ref={canvasRef} className="drawing-canvas" tabIndex={0} aria-label="Drawing canvas" />
  );
}
