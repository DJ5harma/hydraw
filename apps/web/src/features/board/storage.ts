import {
  createDocument,
  documentAssetIds,
  hydrateDocumentAssets,
  packDocumentAssets,
} from "@hydraw/document";
import type { BoardDocument } from "@hydraw/document";
import type { BoardLease, BoardRepository } from "./repository.ts";

const DATABASE = "hydraw-board-v2";

async function acquireWriter(id: string, signal: AbortSignal): Promise<() => void> {
  if (!navigator.locks)
    throw new Error("This browser cannot safely coordinate local editing across tabs.");
  return new Promise((resolve, reject) => {
    const acquisition = new AbortController();
    const timeout = window.setTimeout(() => acquisition.abort(), 350);
    void navigator.locks
      .request(
        `${DATABASE}-writer:${id}`,
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

async function open(id: string, signal: AbortSignal): Promise<BoardLease> {
  signal.throwIfAborted();
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new Error("Invalid board identity.");
  const unlock = await acquireWriter(id, signal);
  let database: IDBDatabase;
  try {
    database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 1);
      let expired = false;
      const timeout = window.setTimeout(() => {
        expired = true;
        reject(new Error("Local storage is blocked. Close older Hydraw tabs and reload."));
      }, 4_000);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("boards");
        request.result.createObjectStore("assets");
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
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    database.close();
    unlock();
  };
  database.onversionchange = close;
  const range = IDBKeyRange.bound([id, ""], [id, "\uffff"]);
  try {
    const stored = await new Promise<{
      primary: unknown;
      recovery: unknown;
      assets: Map<string, string>;
    }>((resolve, reject) => {
      const transaction = database.transaction(["boards", "assets"], "readonly");
      const primary = transaction.objectStore("boards").get([id, "primary"]);
      const recovery = transaction.objectStore("boards").get([id, "recovery"]);
      const assets = transaction.objectStore("assets").getAll(range);
      const keys = transaction.objectStore("assets").getAllKeys(range);
      transaction.oncomplete = () =>
        resolve({
          primary: primary.result as unknown,
          recovery: recovery.result as unknown,
          assets: new Map(
            keys.result.map((key, index) => [
              (key as string[])[1]!,
              assets.result[index] as string,
            ]),
          ),
        });
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Local read was interrupted."));
    });
    signal.throwIfAborted();
    const document =
      stored.primary === undefined
        ? createDocument()
        : hydrateDocumentAssets(stored.primary, stored.assets);
    let recovery: BoardDocument | null = null;
    let recoveryWarning: string | null = null;
    let retainedRecovery = stored.recovery;
    if (stored.recovery !== undefined) {
      try {
        recovery = hydrateDocumentAssets(stored.recovery, stored.assets);
      } catch {
        recoveryWarning =
          "The previous recovery copy could not be read. Your current board is available. Opening another board will replace that unreadable recovery copy.";
      }
    }
    const hashes = new Map<string, string>();
    const fingerprint = async (source: string): Promise<string> => {
      const cached = hashes.get(source);
      if (cached) return cached;
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
      const hash = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      hashes.set(source, hash);
      return hash;
    };
    let tail = Promise.resolve();
    async function write(records: readonly (readonly [string, BoardDocument])[]): Promise<void> {
      if (closed) throw new Error("This board storage lease is closed.");
      const prepared = await Promise.all(
        records.map(async ([key, board]) => {
          const sources = [
            ...new Set(
              board.shapes.flatMap((shape) => (shape.type === "image" ? [shape.src] : [])),
            ),
          ];
          const ids = new Map(
            await Promise.all(
              sources.map(async (source) => [source, await fingerprint(source)] as const),
            ),
          );
          return { key, packed: packDocumentAssets(board, (source) => ids.get(source)!) };
        }),
      );
      if (closed) throw new Error("This board storage lease is closed.");
      const nextRecovery =
        prepared.find((entry) => entry.key === "recovery")?.packed.document ?? retainedRecovery;
      const retainedIds = new Set(
        prepared.flatMap((entry) => documentAssetIds(entry.packed.document)),
      );
      let canCollect = true;
      if (nextRecovery !== undefined) {
        try {
          documentAssetIds(nextRecovery).forEach((assetId) => retainedIds.add(assetId));
        } catch {
          canCollect = false;
        }
      }
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(["boards", "assets"], "readwrite");
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () =>
          reject(transaction.error ?? new Error("Local save was interrupted."));
        try {
          const assets = transaction.objectStore("assets");
          for (const { key, packed } of prepared) {
            for (const [assetId, source] of packed.assets) assets.put(source, [id, assetId]);
            transaction.objectStore("boards").put(packed.document, [id, key]);
          }
          if (canCollect) {
            assets.getAllKeys(range).onsuccess = (event) => {
              const keys = (event.target as IDBRequest<IDBValidKey[]>).result;
              for (const key of keys)
                if (!retainedIds.has((key as string[])[1]!)) assets.delete(key);
            };
          }
        } catch (error) {
          transaction.abort();
          reject(error);
        }
      });
      retainedRecovery = nextRecovery;
      // Keep only current/recovery pixels in the fingerprint cache.
      for (const [source, hash] of hashes) if (!retainedIds.has(hash)) hashes.delete(source);
    }
    function enqueue(records: readonly (readonly [string, BoardDocument])[]) {
      const result = tail.then(() => write(records));
      tail = result.catch(() => {});
      return result;
    }
    return {
      id,
      document,
      recovery,
      recoveryWarning,
      close,
      save: (next) => enqueue([["primary", next]]),
      replace: (previous, next) =>
        enqueue([
          ["recovery", previous],
          ["primary", next],
        ]),
    };
  } catch (error) {
    close();
    throw error;
  }
}

export const localBoards: BoardRepository = { open };
