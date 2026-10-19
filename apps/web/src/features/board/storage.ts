import { createDocument, decodeDocument } from "@hydraw/document";
import type { BoardDocument } from "@hydraw/document";

export type LocalBoard = {
  document: BoardDocument;
  recovery: BoardDocument | null;
  recoveryWarning: string | null;
  replace: (previous: BoardDocument, next: BoardDocument) => Promise<void>;
  save: (document: BoardDocument) => Promise<void>;
  close: () => void;
};

/** One local board for milestone 1. Resolve writes only after the IDB transaction commits. */
async function acquireWriter(signal: AbortSignal): Promise<() => void> {
  if (!navigator.locks)
    throw new Error("This browser cannot safely coordinate local editing across tabs.");
  return new Promise((resolve, reject) => {
    // Queue briefly: React StrictMode may be releasing an earlier mount's lock.
    // A pending request can abort; an acquired lock stays held until explicit release.
    const acquisition = new AbortController();
    const timeout = window.setTimeout(() => acquisition.abort(), 350);
    void navigator.locks
      .request(
        "hydraw-local-writer",
        { signal: AbortSignal.any([signal, acquisition.signal]) },
        async () => {
          clearTimeout(timeout);
          if (signal.aborted) {
            reject(new Error("Opening cancelled."));
            return;
          }
          await new Promise<void>((release) => {
            const unlock = () => {
              signal.removeEventListener("abort", unlock);
              release();
            };
            signal.addEventListener("abort", unlock, { once: true });
            resolve(unlock);
          });
        },
      )
      .catch((error: unknown) => {
        clearTimeout(timeout);
        if (signal.aborted) reject(new Error("Opening cancelled."));
        else if (acquisition.signal.aborted)
          reject(
            new Error(
              "This local board is already open in another tab. Close that tab and reload to save here.",
            ),
          );
        else reject(error);
      });
  });
}

export async function openLocalBoard(signal: AbortSignal): Promise<LocalBoard> {
  const unlock = await acquireWriter(signal);
  let database: IDBDatabase;
  try {
    database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("hydraw-local", 1);
      let expired = false;
      const timeout = window.setTimeout(() => {
        expired = true;
        reject(new Error("Local storage is blocked. Close older Hydraw tabs and reload."));
      }, 4_000);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("boards");
      };
      request.onerror = () => {
        clearTimeout(timeout);
        reject(request.error);
      };
      request.onsuccess = () => {
        clearTimeout(timeout);
        if (expired || signal.aborted) {
          request.result.close();
          reject(new Error("Opening cancelled."));
          return;
        }
        resolve(request.result);
      };
    });
  } catch (error) {
    unlock();
    throw error;
  }
  const close = () => {
    database.close();
    unlock();
  };
  database.onversionchange = close;
  try {
    const stored = await new Promise<{ primary: unknown; recovery: unknown }>((resolve, reject) => {
      const transaction = database.transaction("boards", "readonly");
      const store = transaction.objectStore("boards");
      const primary = store.get("primary");
      const recovery = store.get("recovery");
      transaction.oncomplete = () =>
        resolve({ primary: primary.result as unknown, recovery: recovery.result as unknown });
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Local read was interrupted."));
    });
    const document =
      stored.primary === undefined ? createDocument() : decodeDocument(stored.primary);
    let recovery: BoardDocument | null = null;
    let recoveryWarning: string | null = null;
    if (stored.recovery !== undefined) {
      try {
        recovery = decodeDocument(stored.recovery);
      } catch {
        recoveryWarning =
          "The previous recovery copy could not be read. Your current board is available. Opening another board will replace that unreadable recovery copy.";
      }
    }
    function write(records: readonly (readonly [string, BoardDocument])[]): Promise<void> {
      return new Promise((resolve, reject) => {
        const transaction = database.transaction("boards", "readwrite");
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () =>
          reject(transaction.error ?? new Error("Local save was interrupted."));
        try {
          const store = transaction.objectStore("boards");
          for (const [key, value] of records) store.put(value, key);
        } catch (error) {
          // A synchronous second put failure must also roll back the first put.
          transaction.abort();
          reject(error);
        }
      });
    }
    return {
      document,
      recovery,
      recoveryWarning,
      save: (next) => write([["primary", decodeDocument(next)]]),
      replace: (previous, next) =>
        write([
          ["recovery", decodeDocument(previous)],
          ["primary", decodeDocument(next)],
        ]),
      close,
    };
  } catch (error) {
    close();
    throw error;
  }
}
