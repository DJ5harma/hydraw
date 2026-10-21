import { expect, it } from "vite-plus/test";
import { decodeDocument, parseDocument, serializeDocument } from "@hydraw/document";
import { Editor } from "./editor.ts";

it("migrates plain v2 rectangles and round-trips undoable appearance without losing bindings", () => {
  const legacy = {
    format: "hydraw",
    version: 2,
    name: "Earlier",
    shapes: [{ id: "r", type: "rectangle", x: 0, y: 0, width: 100, height: 80, fill: "#ffffff" }],
    connectors: [
      {
        id: "c",
        type: "connector",
        start: { type: "binding", shapeId: "r" },
        end: { type: "point", x: 200, y: 20 },
        color: "#243e33",
        arrowhead: "arrow",
      },
    ],
  };
  const migrated = decodeDocument(legacy);
  expect(migrated.version).toBe(4);
  expect(migrated.shapes).toEqual(legacy.shapes);
  const editor = new Editor(migrated);
  editor.select("r");
  editor.setRectangleStyle({
    stroke: "#3568db",
    strokeWidth: 3,
    strokeStyle: "dashed",
    opacity: 60,
    cornerRadius: 0,
  });
  const styled = editor.getSnapshot().document;
  expect(styled.shapes[0]).toMatchObject({
    appearance: {
      stroke: "#3568db",
      strokeWidth: 3,
      strokeStyle: "dashed",
      opacity: 60,
      cornerRadius: 0,
    },
  });
  expect(parseDocument(serializeDocument(styled))).toEqual(styled);
  expect(styled.connectors).toEqual(migrated.connectors);
  editor.undo();
  expect(editor.getSnapshot().document).toEqual(migrated);
  editor.redo();
  expect(editor.getSnapshot().document).toEqual(styled);
  expect(() => editor.setRectangleStyle({ opacity: 101 })).toThrow("styling");
  expect(editor.getSnapshot().document).toEqual(styled);
  editor.setFill("transparent");
  expect(parseDocument(serializeDocument(editor.getSnapshot().document)).shapes[0]).toMatchObject({
    fill: "transparent",
  });
});
