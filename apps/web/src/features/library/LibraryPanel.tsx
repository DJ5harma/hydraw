import type { Point } from "@hydraw/document";
import type { Editor } from "@hydraw/editor";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useEditorSnapshot } from "../editor/useEditorSnapshot.ts";
import {
  deleteLibraryItem,
  libraryItemDocument,
  loadLibrary,
  renameLibraryItem,
  saveLibraryItem,
} from "./library-store.ts";
import type { LibraryItem } from "./library-store.ts";
import "./library-panel.css";

export type LibraryPanelMode = "browse" | "save";

export function LibraryPanel({
  editor,
  center,
  mode = "browse",
  onClose,
  onInserted,
}: {
  editor: Editor;
  center: () => Point;
  mode?: LibraryPanelMode;
  onClose: () => void;
  onInserted?: () => void;
}) {
  const snapshot = useEditorSnapshot(editor);
  const [items, setItems] = useState<readonly LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pendingItem, setPendingItem] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const result = await loadLibrary();
      setItems(result.items);
      setWarning(result.warning);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load your local library.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const visibleItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query ? items.filter((item) => item.name.toLocaleLowerCase().includes(query)) : items;
  }, [items, search]);

  async function saveSelection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !snapshot.selectedIds.length) return;
    setSaving(true);
    setError(null);
    try {
      const fragment = editor.copySelection();
      if (!fragment) throw new Error("Select at least one object to save.");
      await saveLibraryItem(name, fragment);
      setName("");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this selection.");
    } finally {
      setSaving(false);
    }
  }

  function insert(item: LibraryItem) {
    setError(null);
    try {
      // Validate again immediately before passing a persisted fragment to the editor.
      libraryItemDocument(item);
      editor.pasteSelection(item.fragment, center());
      onInserted?.();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not insert this library item.");
    }
  }

  async function saveRename(id: string) {
    if (pendingItem) return;
    setPendingItem(id);
    try {
      setError(null);
      await renameLibraryItem(id, renameValue);
      setRenaming(null);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not rename this library item.");
    } finally {
      setPendingItem(null);
    }
  }

  async function confirmDelete(id: string) {
    if (pendingItem) return;
    setPendingItem(id);
    try {
      setError(null);
      await deleteLibraryItem(id);
      setDeleting(null);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete this library item.");
    } finally {
      setPendingItem(null);
    }
  }

  return (
    <div className="library-panel-root" data-workspace-overlay-root>
      <section className="library-panel" role="dialog" aria-label="My library" aria-modal="false">
        <header className="library-panel-heading">
          <div>
            <h2>My library</h2>
            <p>Save editable selections and reuse them on any board.</p>
            <p className="library-storage-note">Saved in this browser.</p>
          </div>
          <button
            className="library-panel-close"
            type="button"
            aria-label="Close library"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        {error && (
          <p className="library-message is-error" role="alert">
            {error}
          </p>
        )}
        {warning && (
          <p className="library-message" role="status">
            {warning}
          </p>
        )}

        <form className="library-save-form" onSubmit={(event) => void saveSelection(event)}>
          <label htmlFor="library-item-name">Save current selection</label>
          <div className="library-save-row">
            <input
              id="library-item-name"
              autoFocus={mode === "save"}
              value={name}
              maxLength={120}
              placeholder={
                snapshot.selectedIds.length ? "Name this item" : "Select objects on the board first"
              }
              disabled={!snapshot.selectedIds.length || saving}
              onChange={(event) => setName(event.target.value)}
            />
            <button
              className="library-primary"
              type="submit"
              disabled={!snapshot.selectedIds.length || saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
          <small>
            {snapshot.selectedIds.length
              ? "Objects, groups and internal connectors stay editable."
              : "Select one or more objects, then save them here."}
          </small>
        </form>

        <div className="library-list-heading">
          <h3>Saved items</h3>
          <span>{items.length} / 50</span>
        </div>
        <label className="library-search-label">
          <span className="library-search-icon" aria-hidden="true">
            ⌕
          </span>
          <input
            aria-label="Search library"
            type="search"
            value={search}
            placeholder="Search saved items"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <div className="library-list" aria-live="polite">
          {loading ? (
            <p className="library-empty">Loading your library…</p>
          ) : visibleItems.length ? (
            visibleItems.map((item) => {
              const document = libraryItemDocument(item);
              const shapeCount = document.shapes.length;
              const connectorCount = document.connectors.length;
              const details = [
                `${shapeCount} ${shapeCount === 1 ? "object" : "objects"}`,
                ...(connectorCount
                  ? [`${connectorCount} ${connectorCount === 1 ? "connector" : "connectors"}`]
                  : []),
              ].join(" · ");
              return (
                <article className="library-item" key={item.id}>
                  <div className="library-item-copy">
                    {renaming === item.id ? (
                      <form
                        className="library-rename-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void saveRename(item.id);
                        }}
                      >
                        <input
                          aria-label={`Rename ${item.name}`}
                          autoFocus
                          maxLength={120}
                          disabled={pendingItem === item.id}
                          value={renameValue}
                          onChange={(event) => setRenameValue(event.target.value)}
                        />
                        <button
                          type="submit"
                          aria-label="Save name"
                          disabled={pendingItem === item.id}
                        >
                          Save
                        </button>
                      </form>
                    ) : (
                      <strong>{item.name}</strong>
                    )}
                    <small>{details}</small>
                  </div>
                  <div className="library-item-actions">
                    {deleting === item.id ? (
                      <>
                        <button
                          type="button"
                          className="library-danger"
                          disabled={pendingItem === item.id}
                          onClick={() => void confirmDelete(item.id)}
                        >
                          Confirm delete
                        </button>
                        <button
                          type="button"
                          disabled={pendingItem === item.id}
                          onClick={() => setDeleting(null)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : renaming === item.id ? (
                      <button
                        type="button"
                        disabled={pendingItem === item.id}
                        onClick={() => setRenaming(null)}
                      >
                        Cancel
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="library-primary"
                          disabled={pendingItem === item.id}
                          onClick={() => insert(item)}
                        >
                          Insert
                        </button>
                        <button
                          type="button"
                          disabled={pendingItem === item.id}
                          onClick={() => {
                            setRenameValue(item.name);
                            setRenaming(item.id);
                          }}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          className="library-danger"
                          disabled={pendingItem === item.id}
                          onClick={() => setDeleting(item.id)}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })
          ) : (
            <p className="library-empty">
              {items.length
                ? "No saved items match your search."
                : "Your library is empty. Select objects on the board and save a selection to start."}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
