import { MAX_DOCUMENT_BYTES, parseDocument, serializeDocument } from "@hydraw/document";
import type { BoardDocument } from "@hydraw/document";

export function downloadBoard(document: BoardDocument): void {
  const url = URL.createObjectURL(
    new Blob([serializeDocument(document)], { type: "application/json" }),
  );
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = `${document.name.replace(/[^a-z0-9_-]/gi, "-").slice(0, 80) || "board"}.hydraw.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export async function readBoardFile(file: File): Promise<BoardDocument> {
  if (file.size > MAX_DOCUMENT_BYTES)
    throw new Error(
      `This board file is too large. The limit is ${MAX_DOCUMENT_BYTES / 1_000_000} MB.`,
    );
  return parseDocument(await file.text());
}
