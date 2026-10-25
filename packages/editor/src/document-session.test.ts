import { describe, expect, it } from "vite-plus/test";
import {
  createDocument,
  nameTransaction,
  shapeTransaction,
  deleteObjectsTransaction,
  connectorTransaction,
  groupObjectsTransaction,
} from "@hydraw/document";
import { DocumentSession } from "./document-session.ts";
import type { DocumentCommit } from "./document-session.ts";
import { Editor } from "./editor.ts";

describe("committed document session", () => {
  it("publishes nested local commits to observers in revision order", () => {
    const session = new DocumentSession(createDocument());
    session.subscribe(({ document }) => {
      if (document.name === "First") session.execute(nameTransaction("First", "Second"));
    });
    const observed: number[] = [];
    session.subscribe(({ revision }) => observed.push(revision));
    session.execute(nameTransaction("Untitled board", "First"));
    expect(observed).toEqual([1, 2]);
  });
  it("publishes only successful commits with explicit history and replacement origins", () => {
    const session = new DocumentSession(createDocument());
    const events: DocumentCommit[] = [];
    session.subscribe((event) => events.push(event));
    session.execute(null);
    session.execute(nameTransaction("Untitled board", "First"));
    expect(() => session.execute(nameTransaction("Stale", "Lost"))).toThrow("changed");
    session.restore("undo");
    session.restore("redo");
    session.replace(createDocument());
    expect(events.map(({ origin, revision }) => [origin, revision])).toEqual([
      ["local", 1],
      ["undo", 2],
      ["redo", 3],
      ["replacement", 4],
    ]);
    expect(session.getSnapshot()).toMatchObject({ canUndo: false, canRedo: false });
  });

  it("keeps pointer previews and camera changes out of committed events", () => {
    const editor = new Editor(createDocument());
    const events: DocumentCommit[] = [];
    editor.documentSession.subscribe((event) => events.push(event));
    editor.pan(10, 20);
    editor.setTool("rectangle");
    editor.begin({ x: 20, y: 20 });
    editor.move({ x: 100, y: 100 });
    expect(events).toEqual([]);
    editor.finish();
    expect(events).toHaveLength(1);
    expect(editor.getSnapshot().document).toBe(events[0]!.document);
  });
});

const a = {
  id: "a",
  type: "rectangle" as const,
  x: 0,
  y: 0,
  width: 100,
  height: 80,
  fill: "#e7eefb" as const,
};
const b = { ...a, id: "b", x: 200 };
const board = () => ({ ...createDocument(), shapes: [a, b] });

describe("two sessions through a local ordered relay", () => {
  it("rejects operations for a different board even when its records match", () => {
    const left = new DocumentSession(board(), "left");
    const right = new DocumentSession(board(), "right");
    const operation = left.prepare(nameTransaction("Untitled board", "Left only")!);
    expect(() => right.apply(operation)).toThrow("another board");
    expect(right.getSnapshot().revision).toBe(0);
  });
  it("rejects dependent out-of-order delivery, then accepts canonical catch-up", () => {
    const left = new DocumentSession(board());
    const right = new DocumentSession(board());
    const events: DocumentCommit[] = [];
    left.subscribe((event) => events.push(event));
    left.execute(nameTransaction("Untitled board", "First"));
    left.execute(nameTransaction("First", "Second"));
    expect(() => right.apply(events[1]!.operation!)).toThrow("changed");
    expect(right.getSnapshot().revision).toBe(0);
    right.apply(events[0]!.operation!);
    right.apply(events[1]!.operation!);
    expect(right.apply(events[0]!.operation!)).toBe(false);
    expect(right.getSnapshot().document).toEqual(left.getSnapshot().document);
  });
  it("combines independent proposals, deduplicates delivery, and undoes only local work", () => {
    const left = new DocumentSession(board());
    const right = new DocumentSession(board());
    const moveA = left.prepare(shapeTransaction("Move A", 0, a, { ...a, x: 50 })!);
    const moveB = right.prepare(shapeTransaction("Move B", 1, b, { ...b, y: 50 })!);
    left.apply(moveA, "local");
    right.apply(moveA);
    right.apply(moveB, "local");
    left.apply(moveB);
    expect(left.apply(moveB)).toBe(false);
    expect(left.getSnapshot().document).toEqual(right.getSnapshot().document);
    const undoEvents: DocumentCommit[] = [];
    left.subscribe((event) => undoEvents.push(event));
    left.restore("undo");
    right.apply(undoEvents[0]!.operation!);
    expect(left.getSnapshot().document.shapes).toEqual([a, { ...b, y: 50 }]);
    expect(right.getSnapshot().document).toEqual(left.getSnapshot().document);
    left.restore("redo");
    expect(left.getSnapshot().document.shapes[0]?.x).toBe(50);
  });

  it("rejects conflicting proposals and preserves the rejected proposal for review", () => {
    const left = new DocumentSession(board());
    const right = new DocumentSession(board());
    const first = left.prepare(shapeTransaction("Move A", 0, a, { ...a, x: 50 })!);
    const stale = right.prepare(shapeTransaction("Move A", 0, a, { ...a, x: 100 })!);
    left.apply(first, "local");
    right.apply(first);
    expect(() => right.apply(stale, "local")).toThrow("changed");
    expect(stale.edit.changes[0]).toMatchObject({ after: { x: 100 } });
    expect(right.getSnapshot().revision).toBe(1);
    expect(right.getSnapshot().document).toEqual(left.getSnapshot().document);
  });

  it("blocks ABA stale edits even when a record returns to its previous value", () => {
    const session = new DocumentSession(board());
    const stale = session.prepare(shapeTransaction("Old proposal", 0, a, { ...a, y: 99 })!);
    session.execute(shapeTransaction("Move", 0, a, { ...a, x: 50 }));
    session.restore("undo");
    expect(session.getSnapshot().document.shapes[0]).toEqual(a);
    expect(() => session.apply(stale)).toThrow("changed");
  });

  it("invalidates conflicting personal history without undoing remote work", () => {
    const left = new DocumentSession(board());
    const right = new DocumentSession(board());
    const local = left.prepare(shapeTransaction("Move A", 0, a, { ...a, x: 50 })!);
    left.apply(local, "local");
    right.apply(local);
    const remote = right.prepare(
      shapeTransaction("Move A again", 0, { ...a, x: 50 }, { ...a, x: 80 })!,
    );
    right.apply(remote, "local");
    left.apply(remote);
    expect(left.getSnapshot()).toMatchObject({ canUndo: false });
    expect(left.getSnapshot().historyWarning).toContain("another session");
    left.restore("undo");
    expect(left.getSnapshot().document.shapes[0]?.x).toBe(80);
  });

  it("keeps unrelated object insertion from invalidating personal creation undo", () => {
    const left = new DocumentSession(createDocument());
    const right = new DocumentSession(createDocument());
    const first = left.prepare(shapeTransaction("Add A", 0, null, a)!);
    left.apply(first, "local");
    right.apply(first);
    const second = right.prepare(shapeTransaction("Add B", 1, null, b)!);
    right.apply(second, "local");
    left.apply(second);
    left.restore("undo");
    expect(left.getSnapshot().document.shapes).toEqual([b]);
  });

  it("rejects node deletion prepared before a concurrent bound connector was accepted", () => {
    const left = new DocumentSession(board());
    const right = new DocumentSession(board());
    const deletion = left.prepare(deleteObjectsTransaction(board(), [a.id])!);
    const connector = {
      id: "edge",
      type: "connector" as const,
      start: { type: "binding" as const, shapeId: a.id },
      end: { type: "binding" as const, shapeId: b.id },
      color: "#243e33" as const,
      arrowhead: "arrow" as const,
    };
    const creation = right.prepare(connectorTransaction("Connect", 0, null, connector)!);
    left.apply(creation);
    right.apply(creation, "local");
    expect(() => left.apply(deletion, "local")).toThrow("changed");
    const fresh = left.prepare(deleteObjectsTransaction(left.getSnapshot().document, [a.id])!);
    left.apply(fresh, "local");
    right.apply(fresh);
    expect(left.getSnapshot().document.connectors).toEqual([]);
    expect(left.getSnapshot().document).toEqual(right.getSnapshot().document);
  });

  it("rejects a pending connector when its target was deleted first", () => {
    const session = new DocumentSession(board());
    const connector = {
      id: "edge",
      type: "connector" as const,
      start: { type: "binding" as const, shapeId: a.id },
      end: { type: "point" as const, x: 500, y: 200 },
      color: "#243e33" as const,
      arrowhead: "arrow" as const,
    };
    const pending = session.prepare(connectorTransaction("Connect", 0, null, connector)!);
    session.execute(deleteObjectsTransaction(session.getSnapshot().document, [a.id]));
    expect(() => session.apply(pending)).toThrow("changed");
    expect(session.getSnapshot().document.connectors).toEqual([]);
  });

  it("checks group membership dependencies and rejects pre-replacement operations", () => {
    const session = new DocumentSession(board());
    const pending = session.prepare(groupObjectsTransaction(board(), [a.id, b.id], "g")!);
    session.replace(board());
    expect(() => session.apply(pending)).toThrow("changed");
    const fresh = session.prepare(groupObjectsTransaction(board(), [a.id, b.id], "g")!);
    session.apply(fresh, "local");
    const doc = session.getSnapshot().document;
    const moved = session.prepare(
      shapeTransaction("Move grouped A", 0, doc.shapes[0]!, { ...doc.shapes[0]!, x: 40 })!,
    );
    session.execute(shapeTransaction("Leave group", 1, doc.shapes[1]!, { ...b, groupId: "other" }));
    expect(() => session.apply(moved)).toThrow("changed");
  });

  it("rejects operation ID reuse without advancing state", () => {
    const session = new DocumentSession(board());
    const operation = session.prepare(nameTransaction("Untitled board", "First")!);
    session.apply(operation);
    expect(() =>
      session.apply({ ...operation, edit: { ...operation.edit, label: "Tampered" } }),
    ).toThrow("reused");
    expect(session.getSnapshot().revision).toBe(1);
  });
});
