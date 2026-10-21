import { describe, expect, it } from "vite-plus/test";
import { createDocument } from "./model.ts";
import type { BoardDocument, Connector, Shape } from "./model.ts";
import { applyTransaction, invertTransaction } from "./transactions.ts";
import {
  expandGroups,
  groupObjectsTransaction,
  reorderObjectsTransaction,
  sceneObjects,
  setObjectsLockedTransaction,
  ungroupObjectsTransaction,
} from "./organization.ts";

const shape = (id: string, metadata: Pick<Shape, "groupId" | "locked" | "zIndex"> = {}): Shape => ({
  id,
  type: "rectangle",
  x: 0,
  y: 0,
  width: 80,
  height: 60,
  fill: "#e7eefb",
  ...metadata,
});

const connector = (
  id: string,
  metadata: Pick<Connector, "groupId" | "locked" | "zIndex"> = {},
): Connector => ({
  id,
  type: "connector",
  start: { type: "point", x: 0, y: 0 },
  end: { type: "point", x: 100, y: 100 },
  color: "#243e33",
  arrowhead: "none",
  ...metadata,
});

const board = (
  shapes: readonly Shape[] = [shape("a"), shape("b"), shape("c")],
  connectors: readonly Connector[] = [connector("x"), connector("y")],
): BoardDocument => ({ ...createDocument(), shapes, connectors });

const ids = (document: BoardDocument) => sceneObjects(document).map((object) => object.id);

describe("object organization", () => {
  it("orders by z-index and keeps connector-then-shape ties stable", () => {
    expect(ids(board())).toEqual(["x", "y", "a", "b", "c"]);
    expect(
      ids(
        board(
          [shape("a", { zIndex: 2 }), shape("b", { zIndex: 0 })],
          [connector("x", { zIndex: 0 }), connector("y", { zIndex: 2 })],
        ),
      ),
    ).toEqual(["x", "b", "y", "a"]);
  });

  it("expands selected flat groups once in document collection order", () => {
    const document = board(
      [shape("a", { groupId: "g" }), shape("b"), shape("c", { groupId: "g" })],
      [connector("x", { groupId: "g" }), connector("y")],
    );
    expect(expandGroups(document, ["x", "c", "x", "missing"])).toEqual(["a", "c", "x"]);
    expect(expandGroups(document, ["missing"])).toEqual([]);
  });

  it("groups and ungroups whole selections with reversible transactions", () => {
    const document = board(
      [shape("a"), shape("b"), shape("c", { groupId: "old" })],
      [connector("x", { groupId: "old" })],
    );
    const grouping = groupObjectsTransaction(document, ["a", "b"], "new")!;
    const grouped = applyTransaction(document, grouping);
    expect(grouped.shapes.map((item) => item.groupId)).toEqual(["new", "new", "old"]);
    expect(grouped.connectors[0]?.groupId).toBe("old");
    expect(applyTransaction(grouped, invertTransaction(grouping))).toEqual(document);
    const ungrouping = ungroupObjectsTransaction(document, ["c"])!;
    const ungrouped = applyTransaction(document, ungrouping);
    expect(ungrouped.shapes[2]?.groupId).toBeUndefined();
    expect(ungrouped.connectors[0]?.groupId).toBeUndefined();
    expect(groupObjectsTransaction(document, ["a"], "single")).toBeNull();
  });

  it("moves selected objects as a stable block and normalizes reversible ranks", () => {
    const document = board();
    const forward = reorderObjectsTransaction(document, ["a", "b"], "forward")!;
    const raised = applyTransaction(document, forward);
    expect(ids(raised)).toEqual(["x", "y", "c", "a", "b"]);
    expect(sceneObjects(raised).map((object) => object.zIndex)).toEqual([0, 1, 2, 3, 4]);
    expect(applyTransaction(raised, invertTransaction(forward))).toEqual(document);
    const backward = reorderObjectsTransaction(document, ["a", "b"], "backward")!;
    expect(ids(applyTransaction(document, backward))).toEqual(["x", "a", "b", "y", "c"]);
    expect(reorderObjectsTransaction(document, ["x"], "back")).toBeNull();
    expect(reorderObjectsTransaction(document, ["c"], "front")).toBeNull();
  });

  it("moves groups together and refuses reorder when any selected member is locked", () => {
    const document = board(
      [shape("a", { groupId: "g" }), shape("b"), shape("c")],
      [connector("x", { groupId: "g" }), connector("y")],
    );
    const moved = applyTransaction(document, reorderObjectsTransaction(document, ["a"], "front")!);
    expect(ids(moved)).toEqual(["y", "b", "c", "x", "a"]);
    const lockedGroup = applyTransaction(
      document,
      setObjectsLockedTransaction(document, ["a"], true)!,
    );
    expect(lockedGroup.shapes[0]?.locked).toBe(true);
    expect(lockedGroup.connectors[0]?.locked).toBe(true);
    expect(reorderObjectsTransaction(lockedGroup, ["x"], "front")).toBeNull();
    const unlocked = applyTransaction(
      lockedGroup,
      setObjectsLockedTransaction(lockedGroup, ["x"], false)!,
    );
    expect(unlocked.shapes[0]?.locked).toBeUndefined();
    expect(unlocked.connectors[0]?.locked).toBeUndefined();
  });
});
