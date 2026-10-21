import type { Editor } from "@hydraw/editor";
import { useMemo, useState } from "react";
import { Icon } from "../../components/icons.tsx";
import { useEditorSnapshot } from "./useEditorSnapshot.ts";
import "./selection-actions.css";

const RESULT_LIMIT = 100;

export function ObjectNavigator({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const snapshot = useEditorSnapshot(editor);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const selected = new Set(snapshot.selectedIds);
  const entries = useMemo(() => {
    const shapes = snapshot.document.shapes.map((shape, index) => ({
      id: shape.id,
      label:
        shape.type === "text"
          ? `Text ${index + 1} · ${shape.text.slice(0, 32)}`
          : `${shape.kind ? shape.kind[0]!.toUpperCase() + shape.kind.slice(1) : "Rectangle"} ${index + 1}${shape.label ? ` · ${shape.label.text.slice(0, 32)}` : ""}`,
      kind: shape.type === "text" ? "T" : "▭",
    }));
    const connectors = snapshot.document.connectors.map((connector, index) => ({
      id: connector.id,
      label: `Connector ${index + 1}${connector.label ? ` · ${connector.label.text.slice(0, 32)}` : ""}`,
      kind: "↗",
    }));
    return [...shapes, ...connectors];
  }, [snapshot.document]);
  const filtered = entries.filter((entry) =>
    entry.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / RESULT_LIMIT));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(currentPage * RESULT_LIMIT, (currentPage + 1) * RESULT_LIMIT);

  return (
    <div className="selection-actions-root object-navigator-root" data-workspace-overlay-root>
      <section
        className="selection-popover object-navigator"
        role="dialog"
        aria-label="Objects on board"
      >
        <header>
          <h2>Objects</h2>
          <button className="selection-close" aria-label="Close objects" onClick={onClose}>
            ×
          </button>
        </header>
        <label className="object-search-label">
          Search objects
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder="Search objects"
          />
        </label>
        <div className="object-navigator-results">
          {entries.length === 0 ? (
            <p>No objects yet</p>
          ) : visible.length === 0 ? (
            <p>No matching objects</p>
          ) : (
            <ul>
              {visible.map((entry) => (
                <li key={entry.id}>
                  <button
                    className={selected.has(entry.id) ? "selected-object" : ""}
                    aria-pressed={selected.has(entry.id)}
                    onClick={(event) => editor.select(entry.id, event.shiftKey)}
                  >
                    <span className="object-navigator-kind" aria-hidden="true">
                      {entry.kind === "↗" ? <Icon name="connector" /> : entry.kind}
                    </span>
                    <span>{entry.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {filtered.length > RESULT_LIMIT && (
          <div className="object-pages">
            <button
              className="file-button"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              Previous
            </button>
            <span>
              {currentPage + 1} / {pageCount} · {filtered.length} objects
            </span>
            <button
              className="file-button"
              disabled={currentPage + 1 === pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              Next
            </button>
          </div>
        )}
        {entries.length > 0 && (
          <button className="file-button object-select-all" onClick={() => editor.selectAll()}>
            Select all objects
          </button>
        )}
      </section>
    </div>
  );
}
