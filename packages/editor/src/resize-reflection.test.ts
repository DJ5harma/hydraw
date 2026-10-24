import { expect, it } from "vite-plus/test";
import { createDocument, parseDocument, serializeDocument } from "@hydraw/document";
import type { InkShape } from "@hydraw/document";
import { Editor } from "./editor.ts";
import { resizeShape, resizedHandle } from "./geometry.ts";
import { hitSceneObject } from "./connector-interactions.ts";
import { exportSvg } from "./svg-export.ts";

const ink: InkShape = {
  id: "ink",
  type: "ink",
  x: 400,
  y: 200,
  width: 200,
  height: 100,
  points: [
    { x: 0, y: 0 },
    { x: 0.5, y: 0.2 },
    { x: 1, y: 1 },
  ],
  color: "#202124",
  strokeWidth: 3,
};
it("reflects horizontal, vertical and double crossings around the fixed edge", () => {
  expect(resizeShape(ink, "w", { x: 700, y: 250 })).toMatchObject({
    x: 600,
    width: 100,
    points: [
      { x: 1, y: 0 },
      { x: 0.5, y: 0.2 },
      { x: 0, y: 1 },
    ],
  });
  expect(resizeShape(ink, "s", { x: 500, y: 150 })).toMatchObject({
    y: 150,
    height: 50,
    points: [
      { x: 0, y: 1 },
      { x: 0.5, y: 0.8 },
      { x: 1, y: 0 },
    ],
  });
  expect(resizeShape(ink, "nw", { x: 700, y: 400 })).toMatchObject({
    x: 600,
    y: 300,
    width: 100,
    height: 100,
    points: [
      { x: 1, y: 1 },
      { x: 0.5, y: 0.8 },
      { x: 0, y: 0 },
    ],
  });
  expect(resizedHandle(ink, "nw", { x: 700, y: 400 })).toBe("se");
  expect(ink.points[0]).toEqual({ x: 0, y: 0 });
});
it("previews from the original stroke at zoom, flips back continuously and commits one undo step", () => {
  const editor = new Editor({ ...createDocument(), shapes: [ink] });
  editor.select("ink");
  editor.zoomAt({ x: 0, y: 0 }, 2);
  const before = editor.getSnapshot().document;
  editor.begin({ x: 800, y: 500 });
  editor.move({ x: 1400, y: 500 });
  expect(editor.getSnapshot().document).toBe(before);
  expect(editor.getSnapshot().preview).toMatchObject({
    x: 600,
    width: 100,
    points: [
      { x: 1, y: 0 },
      { x: 0.5, y: 0.2 },
      { x: 0, y: 1 },
    ],
  });
  expect(editor.getSnapshot().activeHandle).toBe("e");
  editor.move({ x: 800, y: 500 });
  expect(editor.getSnapshot().preview).toEqual(ink);
  editor.move({ x: 1400, y: 500 });
  editor.finish();
  const after = editor.getSnapshot().document;
  expect(parseDocument(serializeDocument(after))).toEqual(after);
  expect(hitSceneObject(after, { x: 600, y: 300 }, 4)?.id).toBe("ink");
  expect(exportSvg(after, { measureText: () => 8 })).toContain("M 700 200 L 650 220 L 600 300");
  editor.undo();
  expect(editor.getSnapshot().document).toEqual(before);
  editor.redo();
  expect(editor.getSnapshot().document).toEqual(after);
  editor.begin({ x: 1400, y: 500 });
  editor.move({ x: 1000, y: 500 });
  editor.cancelGesture();
  expect(editor.getSnapshot().document).toEqual(after);
});
