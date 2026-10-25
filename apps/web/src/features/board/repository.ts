import type { BoardDocument } from "@hydraw/document";

export const DEFAULT_BOARD_ID = "local";

/** An acquired writer and its initial contents; successful writes are durable. */
export type BoardLease = {
  id: string;
  document: BoardDocument;
  recovery: BoardDocument | null;
  recoveryWarning: string | null;
  save: (document: BoardDocument) => Promise<void>;
  replace: (previous: BoardDocument, next: BoardDocument) => Promise<void>;
  close: () => void;
};

/** Storage contract independent of React, editor history and browser primitives. */
export interface BoardRepository {
  open: (id: string, signal: AbortSignal) => Promise<BoardLease>;
}
