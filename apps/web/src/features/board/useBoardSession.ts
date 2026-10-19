import { useEffect, useState } from "react";
import { createDocument } from "@hydraw/document";
import { Editor } from "@hydraw/editor";
import { openLocalBoard } from "./storage.ts";
import type { LocalBoard } from "./storage.ts";
export type BoardSession = { editor: Editor; storage: LocalBoard | null; error: string | null };

export function useBoardSession() {
  const [session, setSession] = useState<BoardSession | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    let local: LocalBoard | null = null;
    void openLocalBoard(controller.signal)
      .then((storage) => {
        if (disposed) {
          storage.close();
          return;
        }
        local = storage;
        setSession({ editor: new Editor(storage.document), storage, error: null });
      })
      .catch((error: unknown) => {
        if (!disposed)
          setSession({
            editor: new Editor(createDocument()),
            storage: null,
            error: error instanceof Error ? error.message : "Local storage is unavailable.",
          });
      });
    return () => {
      disposed = true;
      controller.abort();
      local?.close();
    };
  }, []);
  return session;
}
