# ADR 0014: browser-local reusable selections

Status: implemented, 24 October 2026.

The personal library stores named, editable selection fragments independently of
the current board. My library opens from Board menu or Insert; Save to library
opens it for the current selection from properties or the context menu. Search,
rename, explicit delete confirmation and empty/error states belong to the panel.
The interface states that items are saved in this browser.

Storage lives in the library feature module using a separate `hydraw-library`
IndexedDB database at schema version 1. Board storage/session lifecycles are not
changed. Every mutation reads the current collection and applies quotas within one
readwrite transaction, resolving only on commit; concurrent tabs cannot overwrite
an in-memory list or race past limits. Connections are closed after operations and
on version changes; blocked opens close any late-arriving connection.

Library items carry an ID, name, immutable portable clipboard fragment and creation/
update timestamps. Fragments use the existing versioned clipboard/document decoder.
The library permits 50 items, 50 MB total encoded record data and the existing
28 MB per-fragment envelope. Unreadable entries remain stored and produce a warning;
ordinary operations never reset the collection. IndexedDB failures remain visible
and do not alter the open board. Validated documents are cached by immutable item
identity to avoid reparsing embedded images during panel updates.

Insertion reuses editor paste rules: fresh IDs, remapped internal bindings and group
membership, safe detachment of external references, viewport placement and one undo
step. Native crop and ink data travel with fragments. Saving, renaming or deleting
library items does not add board history entries or change the current board.

Browser verification covers save/insert/undo, original graph identity preservation,
reload, search/rename/delete, unavailable storage, quotas and preservation of
unreadable records in production and development. A development-only check exercises
concurrent saves from two tabs through the actual storage module; the production
project skips that source-module test while retaining UI quota checks. Desktop and
320 px panels are visually inspected. Browser storage is the current scope; cloud
library sync and a standalone library backup format are separate future features.
