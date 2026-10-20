import { describe, expect, it, vi } from "vite-plus/test";
import { createDocument, decodeDocument } from "@hydraw/document";
import { Editor } from "@hydraw/editor";
import { BoardPersistence } from "./persistence.ts";
import type { LocalBoard } from "./storage.ts";

const imported = () => decodeDocument({ ...createDocument(), name: "Imported" });
function setup() {
  const editor = new Editor(createDocument(), () => "a");
  let primary = editor.getSnapshot().document;
  let recovery = null as LocalBoard["recovery"];
  const writes: string[] = [];
  const storage: LocalBoard = {
    document: primary,
    recovery: null,
    recoveryWarning: null,
    close() {},
    async save(document) {
      writes.push(`save:${document.name}`);
      primary = document;
    },
    async replace(previous, next) {
      writes.push(`replace:${next.name}`);
      recovery = previous;
      primary = next;
    },
  };
  const persistence = new BoardPersistence(editor, storage, null);
  const disconnect = persistence.connect();
  return {
    editor,
    persistence,
    storage,
    writes,
    disconnect,
    stored: () => ({ primary, recovery }),
  };
}

describe("board persistence coordination", () => {
  it("saves edits made while disconnected when observation resumes", async () => {
    const { editor, persistence, writes, disconnect, stored } = setup();
    disconnect();
    editor.rename("Changed while disconnected");
    expect(writes).toEqual([]);
    const stop = persistence.connect();
    await vi.waitFor(() => expect(persistence.getSnapshot().saveState).toBe("saved"));
    expect(stored().primary.name).toBe("Changed while disconnected");
    expect(writes).toEqual(["save:Changed while disconnected"]);
    stop();
  });

  it("does not report an obsolete failure while the latest revision is still saving", async () => {
    const { editor, persistence, storage } = setup();
    let failOld!: (error: Error) => void;
    let finishLatest!: () => void;
    const old = new Promise<void>((_, reject) => {
      failOld = reject;
    });
    const latest = new Promise<void>((resolve) => {
      finishLatest = resolve;
    });
    const started: string[] = [];
    storage.save = async (document) => {
      started.push(document.name);
      await (document.name === "Old" ? old : latest);
    };
    editor.rename("Old");
    await vi.waitFor(() => expect(started).toEqual(["Old"]));
    editor.rename("Latest");
    failOld(new Error("Obsolete failure"));
    await vi.waitFor(() => expect(started).toEqual(["Old", "Latest"]));
    expect(persistence.getSnapshot()).toMatchObject({ saveState: "saving", saveError: null });
    finishLatest();
    await vi.waitFor(() => expect(persistence.getSnapshot().saveState).toBe("saved"));
  });
  it("drains autosaves before replacement, resets history, and swaps the recovery board", async () => {
    const { editor, persistence, writes, stored } = setup();
    editor.rename("Original");
    editor.addRectangle({ x: 100, y: 100 });
    await persistence.replace(imported());
    expect(writes).toEqual(["save:Original", "save:Original", "replace:Imported"]);
    expect(stored().primary.name).toBe("Imported");
    expect(stored().recovery?.shapes).toHaveLength(1);
    expect(editor.getSnapshot().canUndo).toBe(false);
    expect(editor.getSnapshot().canRedo).toBe(false);
    expect(persistence.getSnapshot().saveState).toBe("saved");
    await persistence.restore();
    expect(editor.getSnapshot().document.name).toBe("Original");
    expect(stored().recovery?.name).toBe("Imported");
    await persistence.restore();
    expect(stored().primary.name).toBe("Imported");
  });

  it("excludes concurrent edits during replacement and unlocks after failure", async () => {
    const { editor, persistence, storage, stored } = setup();
    editor.rename("Original");
    storage.replace = async () => {
      throw new Error("Quota exceeded");
    };
    const replacement = persistence.replace(imported());
    expect(() => editor.rename("Concurrent edit")).toThrow("replacement");
    expect(() => editor.undo()).toThrow("replacement");
    await expect(replacement).rejects.toThrow("Quota exceeded");
    expect(editor.getSnapshot().document.name).toBe("Original");
    expect(editor.getSnapshot().canUndo).toBe(true);
    expect(stored().primary.name).toBe("Original");
    expect(stored().recovery).toBeNull();
    expect(persistence.getSnapshot().replacing).toBe(false);
    editor.rename("Still editable");
    expect(editor.getSnapshot().document.name).toBe("Still editable");
  });

  it("rejects invalid imports and storage-free replacement without changing the current board", async () => {
    const { editor, persistence, writes } = setup();
    await expect(persistence.replace({ ...imported(), version: 99 } as never)).rejects.toThrow(
      "unsupported",
    );
    expect(writes).toEqual([]);
    const memory = new BoardPersistence(editor, null, "Unavailable");
    await expect(memory.replace(imported())).rejects.toThrow("recovery copy");
    await expect(memory.restore()).rejects.toThrow("No previous");
    expect(editor.getSnapshot().document.name).toBe("Untitled board");
  });
});
