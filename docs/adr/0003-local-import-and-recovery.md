# 0003: Reviewed local import and atomic recovery

Status: accepted, 20 October 2026.

## Review and validation

Import reads an explicitly selected file, checks the 200,000,000-byte limit, parses JSON and applies the existing document decoder. The parser also checks UTF-8 bytes so callers cannot bypass the limit using multibyte characters. Only current version-1 documents enter the editor. The dialog shows the board name and object counts; it does not render a canvas thumbnail.

Choosing a file does not modify the open board. A native modal keeps background editing inactive during review. Cancel leaves storage and editor state unchanged; outdated file reads are ignored. Import is unavailable without writable local storage because retaining the current board is part of the replacement contract.

## Persistence ownership

BoardPersistence coordinates one queue for autosaves and replacements independently of React. The React hook subscribes to its snapshot; presentation components invoke explicit actions. The IndexedDB adapter owns transactions and the existing single-writer browser lock.

Replacement takes a short-lived editor mutation lease and waits behind earlier autosaves. One readwrite transaction writes the current document to the recovery slot and the imported document to the primary slot. A synchronous put failure explicitly aborts the transaction so an earlier put cannot commit alone. The editor publishes the replacement only after successful storage completion, then clears local history, selection, previews and camera state. Failed writes leave the editor and both stored records intact.

The lease exposes replacement and idempotent release. A released lease cannot mutate the document or release a newer lease. The editor does not expose unrestricted document replacement.

## Retention and limits

There is one recovery slot, not a board library or historical backup archive. Every successful import or restore replaces it with the current board. Restore uses the same operation, so it can be reversed by restoring again. Normal autosaves only update the primary slot.

An invalid recovery slot is decoded separately from a valid primary board. The app opens the primary board, preserves unreadable recovery data during autosave and warns before explicit replacement overwrites it. Invalid primary data still enters the existing unsaved fallback without overwriting storage. Recovery from arbitrary primary corruption remains separate work.

Browser data may be evicted or cleared, and the retained copy shares the same storage failure domain. Export remains the portable backup. Undo history belongs to the editing session and is never imported or persisted.
