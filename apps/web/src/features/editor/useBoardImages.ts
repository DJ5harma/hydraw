import { useCallback, useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { Editor } from "@hydraw/editor";
import type { Point } from "@hydraw/document";
import { readBoardImage } from "../board/image-files.ts";

/** File I/O belongs to the web adapter; the editor accepts validated image records. */
export function useBoardImages({
  editor,
  canvasRef,
  center,
  onError,
}: {
  editor: Editor;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  center: () => Point;
  onError: (message: string | null) => void;
}) {
  const current = useRef({ center, onError });
  current.current = { center, onError };
  const generation = useRef(0);
  const queue = useRef(Promise.resolve());
  const insertImages = useCallback(
    (files: readonly File[], screen?: Point) => {
      const raster = files.filter((file) => file.type.startsWith("image/"));
      if (!raster.length) return;
      // Preserve the requested world point while asynchronous decoding is in flight.
      const camera = editor.getSnapshot().camera;
      const point = screen ?? current.current.center();
      const world = {
        x: (point.x - camera.x) / camera.zoom,
        y: (point.y - camera.y) / camera.zoom,
      };
      const epoch = editor.documentSession.epoch;
      const owner = generation.current;
      queue.current = queue.current.then(async () => {
        if (generation.current !== owner) return;
        try {
          if (raster.length > 10) throw new Error("Insert up to 10 images at a time.");
          const images = [];
          for (const file of raster) images.push(await readBoardImage(file));
          if (generation.current !== owner) return;
          // An import/restore replaces the board; never insert pending files into that new board.
          if (editor.documentSession.epoch !== epoch)
            throw new Error("The board changed while opening images. Please insert them again.");
          editor.addImages(images, world);
          current.current.onError(null);
          canvasRef.current?.focus();
        } catch (cause) {
          if (generation.current === owner)
            current.current.onError(
              cause instanceof Error ? cause.message : "The image could not be inserted.",
            );
        }
      });
    },
    [editor, canvasRef],
  );
  useEffect(() => {
    generation.current++;
    const canvas = canvasRef.current;
    if (!canvas) return;
    function dragover(event: DragEvent) {
      if (event.dataTransfer?.types.includes("Files")) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }
    }
    function drop(event: DragEvent) {
      if (!event.dataTransfer?.files.length) return;
      event.preventDefault();
      const rect = canvas!.getBoundingClientRect();
      insertImages(Array.from(event.dataTransfer.files), {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    }
    function paste(event: ClipboardEvent) {
      if (document.activeElement !== canvas || !event.clipboardData) return;
      const files = Array.from(event.clipboardData.files);
      if (!files.some((file) => file.type.startsWith("image/"))) return;
      event.preventDefault();
      insertImages(files);
    }
    canvas.addEventListener("dragover", dragover);
    canvas.addEventListener("drop", drop);
    canvas.addEventListener("paste", paste);
    return () => {
      generation.current++;
      canvas.removeEventListener("dragover", dragover);
      canvas.removeEventListener("drop", drop);
      canvas.removeEventListener("paste", paste);
    };
  }, [canvasRef, insertImages]);
  return insertImages;
}
