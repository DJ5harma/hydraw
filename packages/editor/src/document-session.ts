import { decodeDocument } from "@hydraw/document";
import type { BoardDocument, DocumentTransaction } from "@hydraw/document";
import { TransactionHistory } from "./history.ts";

export type CommitOrigin = "local" | "undo" | "redo" | "replacement";
export type DocumentCommit = Readonly<{
  origin: CommitOrigin;
  document: BoardDocument;
  revision: number;
}>;

/** Owns committed document state. Tools, cameras and browser resources live elsewhere. */
export class DocumentSession {
  private document: BoardDocument;
  private revision = 0;
  private readonly history = new TransactionHistory();
  private listeners = new Set<(event: DocumentCommit) => void>();

  constructor(document: BoardDocument) {
    this.document = decodeDocument(document);
  }

  getSnapshot = () =>
    Object.freeze({
      document: this.document,
      revision: this.revision,
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
    });

  subscribe = (listener: (event: DocumentCommit) => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  execute(transaction: DocumentTransaction | null): void {
    if (!transaction || transaction.changes.length === 0) return;
    this.commit(this.history.execute(this.document, transaction), "local");
  }

  restore(direction: "undo" | "redo"): void {
    const document = this.history[direction](this.document);
    if (document) this.commit(document, direction);
  }

  replace(document: BoardDocument): void {
    const next = decodeDocument(document);
    this.history.clear();
    this.commit(next, "replacement");
  }

  private commit(document: BoardDocument, origin: CommitOrigin): void {
    this.document = document;
    const event = Object.freeze({ document, origin, revision: ++this.revision });
    this.listeners.forEach((listener) => listener(event));
  }
}
