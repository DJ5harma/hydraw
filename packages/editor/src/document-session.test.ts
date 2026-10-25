import { describe, expect, it } from "vite-plus/test";
import { createDocument, nameTransaction } from "@hydraw/document";
import { DocumentSession } from "./document-session.ts";
import type { DocumentCommit } from "./document-session.ts";
import { Editor } from "./editor.ts";

describe("committed document session", () => {
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
