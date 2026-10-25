import { describe, expect, it } from "vite-plus/test";
import { createDocument } from "./model.ts";
import type { BoardDocument, Rectangle } from "./model.ts";
import { applyTransaction, planTransaction } from "./transactions.ts";
import { decodeDocument } from "./validation.ts";
import { createFrameAroundSelection, frameContents, frameSelectionContents } from "./frames.ts";

const rect = (id: string, x: number, y: number, width = 20, height = 20): Rectangle => ({
  id,
  type: "rectangle",
  x,
  y,
  width,
  height,
  fill: "#ffffff",
});

describe("frames", () => {
  it("decodes the frame kind", () => {
    const frame = { ...rect("f", 0, 0), kind: "frame" };
    expect(decodeDocument({ ...createDocument(), shapes: [frame] }).shapes[0]).toMatchObject({
      kind: "frame",
    });
  });

  it("creates a padded frame transaction and inverts it cleanly", () => {
    const document: BoardDocument = { ...createDocument(), shapes: [rect("a", 40, 50)] };
    const created = createFrameAroundSelection(document, ["a"], () => "frame");
    expect(created.id).toBe("frame");
    expect(created.transaction).not.toBeNull();
    const next = applyTransaction(document, created.transaction!);
    const frame = next.shapes.find((shape) => shape.id === "frame")!;
    expect(frame).toMatchObject({
      kind: "frame",
      x: 8,
      y: 18,
      width: 84,
      height: 84,
      fill: "transparent",
      label: { text: "Frame 1" },
    });
    expect(frameContents(next, "frame")).toEqual(["a"]);
    expect(frameSelectionContents(next, ["frame"])).toEqual(["frame", "a"]);
    expect(
      applyTransaction(next, planTransaction(document, created.transaction!).inverse).shapes,
    ).toEqual(document.shapes);
  });

  it("does not include partially contained shapes", () => {
    const frame: Rectangle = { ...rect("f", 0, 0, 100, 100), kind: "frame" };
    const document: BoardDocument = {
      ...createDocument(),
      shapes: [frame, rect("inside", 10, 10), rect("outside", 90, 90)],
    };
    expect(frameContents(document, "f")).toEqual(["inside"]);
  });
});
