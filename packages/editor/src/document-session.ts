import {
  applyOperation,
  decodeDocument,
  operationDependencies,
  operationFromTransaction,
  operationObjectIds,
  operationWriteKeys,
} from "@hydraw/document";
import type { BoardDocument, DocumentOperation, DocumentTransaction } from "@hydraw/document";

export type CommitOrigin = "local" | "remote" | "undo" | "redo" | "replacement";
export type SessionOperation = Readonly<{
  id: string;
  epoch: number;
  expected: Readonly<Record<string, number>>;
  edit: DocumentOperation;
}>;
export type DocumentCommit = Readonly<{
  origin: CommitOrigin;
  document: BoardDocument;
  revision: number;
  operation: SessionOperation | null;
  changedIds: readonly string[];
}>;
type HistoryEntry = Readonly<{ inverse: DocumentOperation; dependencies: readonly string[] }>;

/** Owns committed document state. Tools, cameras and browser resources live elsewhere. */
export class DocumentSession {
  private document: BoardDocument;
  private revision = 0;
  private epoch = 0;
  private sequence = 0;
  private readonly actor = crypto.randomUUID();
  private readonly versions = new Map<string, number>();
  private readonly recent = new Map<string, SessionOperation>();
  private past: HistoryEntry[] = [];
  private future: HistoryEntry[] = [];
  private historyWarning: string | null = null;
  private listeners = new Set<(event: DocumentCommit) => void>();

  constructor(document: BoardDocument) {
    this.document = decodeDocument(document);
  }

  getSnapshot = () =>
    Object.freeze({
      document: this.document,
      revision: this.revision,
      canUndo: this.past.length > 0,
      canRedo: this.future.length > 0,
      historyWarning: this.historyWarning,
    });

  subscribe = (listener: (event: DocumentCommit) => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Prepare without mutating; a local relay can order competing proposals. */
  prepare(transaction: DocumentTransaction): SessionOperation {
    return this.envelope(operationFromTransaction(this.document, transaction));
  }

  execute(transaction: DocumentTransaction | null): void {
    if (!transaction || transaction.changes.length === 0) return;
    this.apply(this.prepare(transaction), "local");
  }

  /** Deliver accepted operations in canonical order. This is not a network transport. */
  apply(operation: SessionOperation, origin: "local" | "remote" = "remote"): boolean {
    return this.accept(operation, origin);
  }

  restore(direction: "undo" | "redo"): void {
    const entry = (direction === "undo" ? this.past : this.future).at(-1);
    if (entry) this.accept(this.envelope(entry.inverse), direction);
  }

  replace(document: BoardDocument): void {
    const next = decodeDocument(document);
    const changedIds = [
      ...this.document.shapes,
      ...this.document.connectors,
      ...next.shapes,
      ...next.connectors,
    ].map((object) => object.id);
    this.past = [];
    this.future = [];
    this.historyWarning = null;
    this.versions.clear();
    this.recent.clear();
    this.epoch++;
    this.commit(next, "replacement", null, [...new Set(changedIds)]);
  }

  private envelope(edit: DocumentOperation): SessionOperation {
    return Object.freeze({
      id: `${this.actor}:${++this.sequence}`,
      epoch: this.epoch,
      expected: Object.freeze(
        Object.fromEntries(
          operationDependencies(edit).map((key) => [key, this.versions.get(key) ?? 0]),
        ),
      ),
      edit,
    });
  }

  private accept(operation: SessionOperation, origin: CommitOrigin): boolean {
    const previous = this.recent.get(operation.id);
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(operation))
        throw new Error("An operation ID cannot be reused for different edits.");
      return false;
    }
    if (!operation.id || operation.epoch !== this.epoch)
      throw new Error("The document changed before this operation.");
    for (const key of operationDependencies(operation.edit)) {
      if (operation.expected[key] !== (this.versions.get(key) ?? 0))
        throw new Error("The document changed before this operation.");
    }
    if (operation.edit.changes.length === 0) return false;
    const { document, edit, inverse } = applyOperation(this.document, operation.edit);
    const accepted = Object.freeze({
      ...operation,
      expected: Object.freeze({ ...operation.expected }),
      edit,
    });
    const entry = Object.freeze({ inverse, dependencies: operationDependencies(inverse) });
    const writes = new Set(operationWriteKeys(edit));
    if (origin === "remote") {
      const retain = (item: HistoryEntry) => !item.dependencies.some((key) => writes.has(key));
      const past = this.past.filter(retain);
      const future = this.future.filter(retain);
      if (past.length !== this.past.length || future.length !== this.future.length)
        this.historyWarning =
          "Some actions can no longer be undone or redone because another session changed their objects.";
      this.past = past;
      this.future = future;
    } else if (origin === "local") {
      this.past.push(entry);
      this.past = this.past.slice(-100);
      this.future = [];
    } else if (origin === "undo") {
      this.past.pop();
      this.future.push(entry);
    } else if (origin === "redo") {
      this.future.pop();
      this.past.push(entry);
    }
    for (const key of writes) this.versions.set(key, (this.versions.get(key) ?? 0) + 1);
    this.recent.set(accepted.id, accepted);
    // After eviction an old delivery safely fails its record-version preconditions.
    if (this.recent.size > 100) this.recent.delete(this.recent.keys().next().value!);
    this.commit(document, origin, accepted, operationObjectIds(edit));
    return true;
  }

  private commit(
    document: BoardDocument,
    origin: CommitOrigin,
    operation: SessionOperation | null,
    changedIds: readonly string[],
  ): void {
    this.document = document;
    const event = Object.freeze({
      document,
      origin,
      operation,
      changedIds: Object.freeze(changedIds),
      revision: ++this.revision,
    });
    this.listeners.forEach((listener) => listener(event));
  }
}
