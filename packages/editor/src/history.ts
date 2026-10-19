import { applyTransaction, invertTransaction } from "@hydraw/document";
import type { BoardDocument, DocumentTransaction } from "@hydraw/document";

/** Stores only changed records. View state and pointer previews never enter history. */
export class TransactionHistory {
  private past: DocumentTransaction[] = [];
  private future: DocumentTransaction[] = [];

  get canUndo(): boolean {
    return this.past.length > 0;
  }
  get canRedo(): boolean {
    return this.future.length > 0;
  }

  clear(): void {
    this.past = [];
    this.future = [];
  }

  execute(document: BoardDocument, transaction: DocumentTransaction): BoardDocument {
    const next = applyTransaction(document, transaction);
    this.past.push(transaction);
    if (this.past.length > 100) this.past.shift();
    this.future = [];
    return next;
  }

  undo(document: BoardDocument): BoardDocument | null {
    const transaction = this.past.at(-1);
    if (!transaction) return null;
    const next = applyTransaction(document, invertTransaction(transaction));
    this.past.pop();
    this.future.push(transaction);
    return next;
  }

  redo(document: BoardDocument): BoardDocument | null {
    const transaction = this.future.at(-1);
    if (!transaction) return null;
    const next = applyTransaction(document, transaction);
    this.future.pop();
    this.past.push(transaction);
    return next;
  }
}
