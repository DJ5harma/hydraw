import { expect, it } from "vite-plus/test";
import {
  createDocument,
  decodeDocument,
  resolveConnector,
  serializeDocument,
  parseDocument,
} from "@hydraw/document";
import type { Connector, Rectangle } from "@hydraw/document";
import { Editor } from "./editor.ts";
import { hitSceneObject } from "./connector-interactions.ts";
import { labelClipBounds } from "./labels.ts";
import { erasedObjects } from "./eraser.ts";
import { selectionBounds, selectionScene, enclosedObjects } from "./selection.ts";
import { exportSvg } from "./svg-export.ts";
import { createClipboardFragment, pastedSelection } from "./clipboard.ts";
import { applyTransaction } from "@hydraw/document";

const a: Rectangle = {
  id: "a",
  type: "rectangle",
  x: 100,
  y: 100,
  width: 100,
  height: 80,
  fill: "#ffffff",
};
const b: Rectangle = { ...a, id: "b", x: 400, y: 300 };
const edge: Connector = {
  id: "edge",
  type: "connector",
  start: { type: "binding", shapeId: "a" },
  end: { type: "binding", shapeId: "b" },
  color: "#202124",
  arrowhead: "arrow",
  route: { type: "elbow", axis: "x" },
};
const scene = () => decodeDocument({ ...createDocument(), shapes: [a, b], connectors: [edge] });

it("previews bend dragging at zoom without saving, commits once and cancels without losing redo", () => {
  const editor = new Editor(scene());
  editor.select("edge");
  editor.zoomAt({ x: 0, y: 0 }, 2);
  const before = editor.getSnapshot().document;
  expect(editor.getConnectorBendAt({ x: 600, y: 480 })).toBe("x");
  editor.begin({ x: 600, y: 480 });
  editor.move({ x: 660, y: 520 });
  expect(editor.getSnapshot().document).toBe(before);
  expect(editor.getSnapshot().connectorPreview?.route?.position).toBe(330);
  expect(selectionScene(editor.getSnapshot()).connectors[0]!.route?.position).toBe(330);
  editor.finish();
  const after = editor.getSnapshot().document;
  expect(after.connectors[0]!.route?.position).toBe(330);
  editor.undo();
  expect(editor.getSnapshot().document).toEqual(before);
  editor.begin({ x: 600, y: 480 });
  editor.move({ x: 720, y: 480 });
  editor.cancelGesture();
  expect(editor.getSnapshot().document).toEqual(before);
  expect(editor.getSnapshot().canRedo).toBe(true);
  editor.redo();
  expect(editor.getSnapshot().document).toEqual(after);
});

it("ignores no-op bend clicks and locked selections and can reset or change routing atomically", () => {
  const editor = new Editor(scene());
  editor.select("edge");
  editor.begin({ x: 300, y: 240 });
  editor.finish();
  expect(editor.getSnapshot().canUndo).toBe(false);
  editor.setConnectorStyle({ route: { type: "elbow", axis: "y", position: 220 } });
  editor.setSelectionLocked(true);
  expect(editor.getConnectorBendAt({ x: 300, y: 220 })).toBeNull();
  editor.setConnectorStyle({ route: undefined });
  expect(editor.getSnapshot().document.connectors[0]!.route).toBeDefined();
  editor.setSelectionLocked(false);
  editor.setConnectorStyle({ route: undefined });
  expect(editor.getSnapshot().document.connectors[0]!.route).toBeUndefined();
  editor.undo();
  expect(editor.getSnapshot().document.connectors[0]!.route).toEqual({
    type: "elbow",
    axis: "y",
    position: 220,
  });
});

it("hits and erases the routed path instead of its diagonal chord", () => {
  const document = scene();
  expect(hitSceneObject(document, { x: 250, y: 140 }, 4)?.id).toBe("edge");
  expect(hitSceneObject(document, { x: 250, y: 190 }, 4)).toBeUndefined();
  expect(erasedObjects(document, { x: 245, y: 130 }, { x: 255, y: 150 }, 2)).toEqual(["edge"]);
  expect(erasedObjects(document, { x: 245, y: 185 }, { x: 255, y: 195 }, 2)).toEqual([]);
});

it("includes edited bends in bounds, marquee selection and caption positions", () => {
  const document = {
    ...scene(),
    connectors: [
      {
        ...edge,
        route: { type: "elbow" as const, axis: "x" as const, position: 700 },
        label: {
          text: "Request",
          fontSize: 16,
          fontWeight: 400 as const,
          color: "#202124" as const,
        },
      },
    ],
  };
  expect(selectionBounds(document.shapes, document.connectors, ["edge"])).toEqual({
    x: 200,
    y: 140,
    width: 500,
    height: 200,
  });
  expect(enclosedObjects(document, { x: 0, y: 0, width: 600, height: 600 })).not.toContain("edge");
  const bounds = labelClipBounds(document.connectors[0]!, document.shapes);
  expect(bounds.x + bounds.width / 2).toBe(650);
  expect(bounds.y + bounds.height / 2).toBe(140);
});

it("exports every segment and the terminal arrow direction, without clipping an outside bend", () => {
  const document = {
    ...scene(),
    connectors: [{ ...edge, route: { type: "elbow" as const, axis: "x" as const, position: 700 } }],
  };
  const svg = exportSvg(document, { ids: ["edge"], measureText: () => 8, padding: 0 });
  expect(svg).toContain('d="M 200 140 L 700 140 L 700 340 L 500 340"');
  expect(svg).toContain('viewBox="188 128 524 224"');
  expect(svg).toContain("L 500 340 L 509.526");
  expect(parseDocument(serializeDocument(document))).toEqual(document);
});

it("detaches, reverses and pastes routed connectors while preserving their path and labels", () => {
  const document = scene();
  const editor = new Editor(document);
  editor.select("edge");
  const points = resolveConnector(edge, document.shapes).points;
  editor.reverseConnector();
  expect(
    resolveConnector(editor.getSnapshot().document.connectors[0]!, document.shapes).points,
  ).toEqual([...points].reverse());
  editor.undo();
  editor.detachConnector();
  expect(resolveConnector(editor.getSnapshot().document.connectors[0]!, []).points).toEqual(points);
  let id = 0;
  const fragment = createClipboardFragment(document, ["edge"])!;
  const pasted = pastedSelection(createDocument(), fragment, () => `new-${++id}`, {
    x: 500,
    y: 500,
  });
  const copy = applyTransaction(createDocument(), pasted.transaction!);
  expect(copy.connectors[0]!.start.type).toBe("point");
  expect(copy.connectors[0]!.route).toBeDefined();
  expect(selectionBounds([], copy.connectors, pasted.ids)).toEqual({
    x: 400,
    y: 400,
    width: 200,
    height: 200,
  });
});
