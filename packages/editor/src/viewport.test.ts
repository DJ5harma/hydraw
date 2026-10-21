import { describe, expect, it } from "vite-plus/test";
import { createDocument, MAX_COORDINATE } from "@hydraw/document";
import { Editor } from "./editor.ts";
import { fittedCamera } from "./viewport.ts";

describe("fit navigation", () => {
  it("centers negative world bounds inside an offset safe viewport", () => {
    const camera = fittedCamera(
      { x: -600, y: -200, width: 1200, height: 400 },
      { x: 24, y: 100, width: 600, height: 400 },
    );
    expect(camera).toEqual({ x: 324, y: 300, zoom: 0.5 });
    expect(
      fittedCamera({ x: 0, y: 0, width: 0, height: 0 }, { x: 0, y: 0, width: 200, height: 100 }),
    ).toEqual({ x: 100, y: 50, zoom: 1 });
    expect(
      fittedCamera({ x: 0, y: 0, width: 1, height: 1 }, { x: 0, y: 0, width: 0, height: 100 }),
    ).toBeNull();
  });
  it("fits selection independently, including free connector endpoints, without a transaction", () => {
    let id = 0;
    const editor = new Editor(createDocument(), () => `object-${++id}`);
    editor.addRectangle({ x: 100, y: 100 });
    editor.setGeometry({ x: MAX_COORDINATE, y: MAX_COORDINATE });
    editor.addConnector({ x: -500, y: -100 });
    const before = editor.getSnapshot();
    const viewport = { x: 20, y: 100, width: 600, height: 400 };
    editor.fitView(viewport, true);
    expect(editor.getSnapshot().camera).toEqual({ x: 820, y: 400, zoom: 1 });
    editor.fitView(viewport);
    const { camera } = editor.getSnapshot();
    expect(-580 * camera.zoom + camera.x).toBeGreaterThanOrEqual(viewport.x - 0.001);
    expect((MAX_COORDINATE + 180) * camera.zoom + camera.x).toBeLessThanOrEqual(620.001);
    expect(editor.getSnapshot()).toMatchObject({
      revision: before.revision,
      document: before.document,
      selectedIds: before.selectedIds,
    });
    editor.undo();
    expect(editor.getSnapshot().document.connectors).toHaveLength(0);
  });
});
