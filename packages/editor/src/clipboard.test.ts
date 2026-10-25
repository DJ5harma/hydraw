import { describe, expect, it } from "vite-plus/test";
import {
  applyTransaction,
  createDocument,
  decodeDocument,
  planTransaction,
} from "@hydraw/document";
import type { BoardDocument, Connector, Rectangle, TextShape } from "@hydraw/document";
import {
  MAX_CLIPBOARD_BYTES,
  createClipboardFragment,
  decodeClipboardFragment,
  pastedSelection,
} from "./clipboard.ts";

const rectangle = (id: string, x: number, y: number): Rectangle => ({
  id,
  type: "rectangle",
  x,
  y,
  width: 100,
  height: 80,
  fill: "#e7eefb",
});
const text: TextShape = {
  id: "text",
  type: "text",
  x: 400,
  y: 120,
  width: 150,
  height: 42,
  text: "Text node",
  fontSize: 24,
  fontWeight: 400,
  textAlign: "left",
  color: "#243e33",
};
const edge: Connector = {
  id: "internal",
  type: "connector",
  start: { type: "binding", shapeId: "a" },
  end: { type: "binding", shapeId: "text" },
  color: "#243e33",
  arrowhead: "arrow",
};
const boundaryEdge: Connector = {
  ...edge,
  id: "boundary",
  end: { type: "binding", shapeId: "outside" },
};
const source = (): BoardDocument =>
  decodeDocument({
    ...createDocument(),
    shapes: [rectangle("a", 100, 100), text, rectangle("outside", 800, 100)],
    connectors: [edge, boundaryEdge],
  });
const ids = () => {
  let next = 0;
  return () => `paste-${++next}`;
};

describe("Hydraw selection clipboard", () => {
  it("copies selected shapes with their internal bound edges and detaches external bindings", () => {
    const fragment = createClipboardFragment(source(), ["a", "text", "boundary"]);
    expect(fragment).not.toBeNull();
    const decoded = decodeClipboardFragment(fragment!);
    expect(decoded?.shapes.map((shape) => shape.id)).toEqual(["a", "text"]);
    expect(decoded?.connectors.map((connector) => connector.id)).toEqual(["internal", "boundary"]);
    expect(decoded?.connectors[0]).toMatchObject({
      start: { type: "binding", shapeId: "a" },
      end: { type: "binding", shapeId: "text" },
    });
    expect(decoded?.connectors[1]?.start).toEqual({ type: "binding", shapeId: "a" });
    expect(decoded?.connectors[1]?.end.type).toBe("point");
  });

  it("copies a selected connector without copying its external nodes", () => {
    const decoded = decodeClipboardFragment(createClipboardFragment(source(), ["boundary"])!);
    expect(decoded?.shapes).toEqual([]);
    expect(decoded?.connectors).toHaveLength(1);
    expect(decoded?.connectors[0]?.start.type).toBe("point");
    expect(decoded?.connectors[0]?.end.type).toBe("point");
  });

  it("ignores ordinary text and board JSON and bounds clipboard parsing", () => {
    expect(createClipboardFragment(source(), [])).toBeNull();
    expect(decodeClipboardFragment("plain text")).toBeNull();
    expect(decodeClipboardFragment(JSON.stringify(source()))).toBeNull();
    expect(decodeClipboardFragment("x".repeat(MAX_CLIPBOARD_BYTES + 1))).toBeNull();
    expect(pastedSelection(source(), "plain text", ids(), { x: 0, y: 0 })).toEqual({
      transaction: null,
      ids: [],
    });
  });

  it("rejects recognized envelopes with unsupported versions or invalid documents", () => {
    expect(() =>
      decodeClipboardFragment(JSON.stringify({ format: "hydraw/selection", version: 9 })),
    ).toThrow("unsupported version");
    expect(() =>
      decodeClipboardFragment(
        JSON.stringify({ format: "hydraw/selection", version: 1, document: { invalid: true } }),
      ),
    ).toThrow("unsupported Hydraw format");
  });

  it("pastes around the requested center with fresh IDs and a reversible transaction", () => {
    const document = decodeDocument({ ...createDocument(), shapes: [rectangle("host", 0, 0)] });
    const serialized = createClipboardFragment(source(), ["a", "text"])!;
    const pasted = pastedSelection(document, serialized, ids(), { x: 500, y: 400 });
    expect(pasted.ids).toEqual(["paste-1", "paste-2", "paste-3"]);
    const next = applyTransaction(document, pasted.transaction!);
    expect(next.shapes.slice(1)).toMatchObject([
      { id: "paste-1", x: 275, y: 360 },
      { id: "paste-2", x: 575, y: 380, text: "Text node" },
    ]);
    expect(next.connectors[0]).toMatchObject({
      id: "paste-3",
      start: { type: "binding", shapeId: "paste-1" },
      end: { type: "binding", shapeId: "paste-2" },
    });
    expect(applyTransaction(next, planTransaction(document, pasted.transaction!).inverse)).toEqual(
      document,
    );
  });

  it("clamps paste movement to portable coordinates and rejects colliding IDs", () => {
    const sourceDoc = decodeDocument({
      ...createDocument(),
      shapes: [rectangle("edge", 999_950, 999_900)],
    });
    const fragment = createClipboardFragment(sourceDoc, ["edge"])!;
    const document = decodeDocument({ ...createDocument(), shapes: [rectangle("host", 0, 0)] });
    const pasted = pastedSelection(document, fragment, ids(), { x: 2_000_000, y: 2_000_000 });
    const next = applyTransaction(document, pasted.transaction!);
    expect(next.shapes[1]).toMatchObject({ x: 1_000_000, y: 1_000_000 });
    expect(() => pastedSelection(document, fragment, () => "host", { x: 100, y: 100 })).toThrow(
      "unique",
    );
  });

  it("pastes more than half the board shape limit into an empty board", () => {
    const shapes = Array.from({ length: 2_501 }, (_, index) =>
      rectangle(`source-${index}`, (index % 100) * 110, Math.floor(index / 100) * 90),
    );
    const fragment = createClipboardFragment(
      decodeDocument({ ...createDocument(), shapes }),
      shapes.map((shape) => shape.id),
    )!;
    const pasted = pastedSelection(createDocument(), fragment, ids(), { x: 0, y: 0 });

    expect(pasted.ids).toHaveLength(2_501);
    expect(applyTransaction(createDocument(), pasted.transaction!).shapes).toHaveLength(2_501);
  });
});
