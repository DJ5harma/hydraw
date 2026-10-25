import { decodeClipboardFragment, MAX_CLIPBOARD_BYTES } from "@hydraw/editor";
import type { BoardDocument } from "@hydraw/document";

export const MAX_LIBRARY_ITEMS = 50;
export const MAX_LIBRARY_BYTES = 50_000_000;
export const MAX_LIBRARY_NAME_LENGTH = 120;
const DATABASE = "hydraw-library-v1";
const STORE = "items";

export type LibraryItem = Readonly<{
  id: string;
  name: string;
  fragment: string;
  createdAt: number;
  updatedAt: number;
}>;
export type LibraryContents = Readonly<{ items: readonly LibraryItem[]; warning: string | null }>;
const validatedDocuments = new WeakMap<object, BoardDocument>();

function normalizeName(name: string): string {
  const value = name.trim();
  if (!value) throw new Error("Give this library item a name.");
  if (value.length > MAX_LIBRARY_NAME_LENGTH)
    throw new Error(`Library names must be at most ${MAX_LIBRARY_NAME_LENGTH} characters.`);
  return value;
}

function fragmentDocument(fragment: string): BoardDocument {
  if (new TextEncoder().encode(fragment).byteLength > MAX_CLIPBOARD_BYTES)
    throw new Error("This selection is too large to save to your library.");
  const document = decodeClipboardFragment(fragment);
  if (!document) throw new Error("This selection could not be validated for the library.");
  return document;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodeItem(value: unknown): LibraryItem {
  if (
    !record(value) ||
    typeof value.id !== "string" ||
    !value.id ||
    value.id.length > 120 ||
    typeof value.name !== "string" ||
    typeof value.fragment !== "string" ||
    typeof value.createdAt !== "number" ||
    !Number.isFinite(value.createdAt) ||
    typeof value.updatedAt !== "number" ||
    !Number.isFinite(value.updatedAt)
  )
    throw new Error("A saved library item has invalid fields.");
  const name = normalizeName(value.name);
  const document = fragmentDocument(value.fragment);
  const item = Object.freeze({
    id: value.id,
    name,
    fragment: value.fragment,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  });
  validatedDocuments.set(item, document);
  return item;
}

function recordBytes(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
  } catch {
    return MAX_LIBRARY_BYTES;
  }
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined")
    return Promise.reject(new Error("Library storage is unavailable in this browser."));
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    let blocked = false;
    try {
      request = indexedDB.open(DATABASE, 1);
    } catch {
      reject(new Error("Could not open your local library."));
      return;
    }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE))
        request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => {
      const database = request.result;
      if (blocked) {
        database.close();
        return;
      }
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => reject(new Error("Could not open your local library."));
    request.onblocked = () => {
      blocked = true;
      reject(new Error("Close another Hydraw tab to update your local library."));
    };
  });
}

async function withDatabase<T>(action: (database: IDBDatabase) => Promise<T>): Promise<T> {
  const database = await openDatabase();
  try {
    return await action(database);
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error("Your local library could not be updated.");
  } finally {
    database.close();
  }
}

function readAll(database: IDBDatabase, mode: IDBTransactionMode): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    let transaction: IDBTransaction;
    try {
      transaction = database.transaction(STORE, mode);
      const request = transaction.objectStore(STORE).getAll();
      let result: unknown[] = [];
      request.onsuccess = () => {
        result = request.result as unknown[];
      };
      request.onerror = () => reject(new Error("Could not read your local library."));
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(new Error("Could not read your local library."));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Library read was interrupted."));
    } catch {
      reject(new Error("Could not read your local library."));
    }
  });
}

export async function loadLibrary(): Promise<LibraryContents> {
  return withDatabase(async (database) => {
    const rawItems = await readAll(database, "readonly");
    const items: LibraryItem[] = [];
    let invalidCount = 0;
    for (const raw of rawItems) {
      try {
        items.push(decodeItem(raw));
      } catch {
        invalidCount++;
      }
    }
    items.sort(
      (left, right) => right.updatedAt - left.updatedAt || left.name.localeCompare(right.name),
    );
    return Object.freeze({
      items: Object.freeze(items),
      warning: invalidCount
        ? `${invalidCount} saved ${invalidCount === 1 ? "item could" : "items could"} not be read.`
        : null,
    });
  });
}

function applyMutation<T>(
  database: IDBDatabase,
  mutate: (raw: unknown[], store: IDBObjectStore) => T,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let transaction: IDBTransaction;
    let result: T;
    let failure: Error | null = null;
    try {
      transaction = database.transaction(STORE, "readwrite");
      const store = transaction.objectStore(STORE);
      const request = store.getAll();
      request.onerror = () => {
        failure = new Error("Could not check your saved library items.");
        transaction.abort();
      };
      request.onsuccess = () => {
        try {
          result = mutate(request.result as unknown[], store);
        } catch (error) {
          failure = error instanceof Error ? error : new Error("Library update failed.");
          transaction.abort();
        }
      };
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(failure ?? new Error("Library update failed."));
      transaction.onabort = () =>
        reject(failure ?? transaction.error ?? new Error("Library update was interrupted."));
    } catch {
      reject(new Error("Could not update your local library."));
    }
  });
}

function validateQuota(
  raw: readonly unknown[],
  replacingId: string | null,
  next: LibraryItem,
): void {
  const existing = raw.filter((item) => !(record(item) && item.id === replacingId));
  if (replacingId === null && existing.length >= MAX_LIBRARY_ITEMS)
    throw new Error(`Your library holds up to ${MAX_LIBRARY_ITEMS} items.`);
  const bytes =
    existing.reduce<number>((total, item) => total + recordBytes(item), 0) + recordBytes(next);
  if (bytes > MAX_LIBRARY_BYTES)
    throw new Error("Your library is full. Delete an item before saving this selection.");
}

export async function saveLibraryItem(name: string, fragment: string): Promise<LibraryItem> {
  const normalizedName = normalizeName(name);
  fragmentDocument(fragment);
  const now = Date.now();
  const item: LibraryItem = Object.freeze({
    id: crypto.randomUUID(),
    name: normalizedName,
    fragment,
    createdAt: now,
    updatedAt: now,
  });
  return withDatabase((database) =>
    applyMutation(database, (raw, store) => {
      validateQuota(raw, null, item);
      store.add(item);
      return item;
    }),
  );
}

export async function renameLibraryItem(id: string, name: string): Promise<LibraryItem> {
  const normalizedName = normalizeName(name);
  return withDatabase((database) =>
    applyMutation(database, (raw, store) => {
      const index = raw.findIndex((value) => record(value) && value.id === id);
      if (index < 0) throw new Error("This library item is no longer available.");
      const current = decodeItem(raw[index]);
      const item: LibraryItem = Object.freeze({
        ...current,
        name: normalizedName,
        updatedAt: Date.now(),
      });
      validateQuota(raw, id, item);
      store.put(item);
      return item;
    }),
  );
}

export async function deleteLibraryItem(id: string): Promise<void> {
  await withDatabase((database) =>
    applyMutation(database, (raw, store) => {
      if (!raw.some((value) => record(value) && value.id === id))
        throw new Error("This library item is no longer available.");
      store.delete(id);
    }),
  );
}

export function libraryItemDocument(item: LibraryItem): BoardDocument {
  const cached = validatedDocuments.get(item);
  if (cached) return cached;
  return validatedDocuments.get(decodeItem(item))!;
}
