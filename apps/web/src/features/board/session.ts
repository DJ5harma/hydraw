import { createDocument } from "@hydraw/document";
import { Editor } from "@hydraw/editor";
import { createTextMeasurer } from "@hydraw/editor/canvas";
import { openLocalBoard } from "./storage.ts";
import type { LocalBoard } from "./storage.ts";

export type BoardSession = { editor: Editor; storage: LocalBoard | null; error: string | null };

/** Acquire resources before publishing a session; every unsuccessful open releases storage. */
export async function openBoardSession(signal: AbortSignal): Promise<BoardSession> {
  signal.throwIfAborted();
  const measure = createTextMeasurer();
  let storage: LocalBoard | null = null;
  try {
    storage = await openLocalBoard(signal);
    signal.throwIfAborted();
    return { editor: new Editor(storage.document, undefined, measure), storage, error: null };
  } catch (error) {
    storage?.close();
    signal.throwIfAborted();
    return {
      editor: new Editor(createDocument(), undefined, measure),
      storage: null,
      error: error instanceof Error ? error.message : "Local storage is unavailable.",
    };
  }
}
