import { describe, expect, it } from "vite-plus/test";
import {
  createDocument,
  resolveConnector,
  serializeDocument,
  parseDocument,
} from "@hydraw/document";
import type { Connector, ImageShape } from "@hydraw/document";
import { Editor } from "./editor.ts";
import { exportSvg } from "./svg-export.ts";

const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";
const measureText = (text: string, style: { fontSize: number }) => text.length * style.fontSize;

function storedImage(id: string, x = 50, y = 40): ImageShape {
  return { id, type: "image", src: png, name: `${id}.png`, x, y, width: 100, height: 60 };
}

describe("image editor behavior", () => {
  it("inserts a batch in one history step and restores embedded data through save and redo", () => {
    let id = 0;
    const editor = new Editor(createDocument(), () => `image-${++id}`);
    editor.addImages(
      [
        { src: png, name: "one.png", width: 32, height: 24 },
        { src: png, name: "two.png", width: 64, height: 48 },
      ],
      { x: 300, y: 200 },
    );
    const inserted = editor.getSnapshot().document;
    expect(inserted.shapes.map((shape) => shape.id)).toEqual(["image-1", "image-2"]);
    expect(editor.getSnapshot().selectedIds).toEqual(["image-1", "image-2"]);
    expect(parseDocument(serializeDocument(inserted))).toEqual(inserted);
    editor.undo();
    expect(editor.getSnapshot().document).toEqual(createDocument());
    editor.redo();
    expect(editor.getSnapshot().document).toEqual(inserted);
  });

  it("keeps bound connectors attached when an image is resized", () => {
    const image = storedImage("picture");
    const connector: Connector = {
      id: "edge",
      type: "connector",
      start: { type: "binding", shapeId: image.id },
      end: { type: "point", x: 260, y: 70 },
      color: "#243e33",
      arrowhead: "arrow",
    };
    const editor = new Editor({ ...createDocument(), shapes: [image], connectors: [connector] });
    const before = resolveConnector(connector, editor.getSnapshot().document.shapes);
    editor.select(image.id);
    editor.setGeometry({ width: 200 });
    const after = resolveConnector(connector, editor.getSnapshot().document.shapes);
    expect(before.start).toEqual({ x: 150, y: 70 });
    expect(after.start).toEqual({ x: 250, y: 70 });
    expect(editor.getSnapshot().document.connectors).toEqual([connector]);
  });

  it("copies and pastes embedded PNGs and includes their data in SVG export", () => {
    const image = storedImage("source", 20, 30);
    const editor = new Editor({ ...createDocument(), shapes: [image] }, () => "copy-1");
    editor.select(image.id);
    const fragment = editor.copySelection();
    expect(fragment).toContain(png);
    editor.pasteSelection(fragment!, { x: 300, y: 200 });
    const document = editor.getSnapshot().document;
    expect(document.shapes).toHaveLength(2);
    expect(document.shapes[1]).toMatchObject({ type: "image", src: png, name: "source.png" });
    const svg = exportSvg(document, { measureText });
    expect(svg).toContain("<image ");
    expect(svg).toContain(`href="${png}"`);
  });
});
