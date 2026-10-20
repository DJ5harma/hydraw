import { useRef } from "react";
import type { RefObject } from "react";
import { Icon, Mark } from "../../components/icons.tsx";
import type { SaveState } from "./persistence.ts";
import "./board-header.css";

export function BoardHeader({
  name,
  saveState,
  onRename,
  onExport,
  onImport,
  onRestore,
  canRestore,
  inspectorOpen,
  onToggleInspector,
  inspectorToggleRef,
}: {
  name: string;
  saveState: SaveState;
  onRename: (name: string) => void;
  onExport: () => void;
  onImport: () => void;
  onRestore: () => void;
  canRestore: boolean;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
  inspectorToggleRef?: RefObject<HTMLButtonElement | null>;
}) {
  const cancelledEdit = useRef(false);
  const status =
    saveState === "saving"
      ? "Saving locally…"
      : saveState === "error"
        ? "Not saved"
        : saveState === "saved"
          ? "Saved in this browser"
          : "Local board · this browser";

  return (
    <header className="topbar">
      <span className="hydraw-mark" role="img" aria-label="Hydraw">
        <Mark />
      </span>
      <div className="board-identity">
        <input
          key={name}
          className="board-title"
          aria-label="Board name"
          defaultValue={name}
          maxLength={120}
          onBlur={(event) => {
            const nextName = event.currentTarget.value.trim();
            if (!cancelledEdit.current && nextName !== name) onRename(nextName);
            cancelledEdit.current = false;
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              cancelledEdit.current = true;
              event.currentTarget.value = name;
              event.currentTarget.blur();
            }
          }}
        />
        <span className={`save-status ${saveState === "error" ? "has-error" : ""}`} role="status">
          <span className="status-dot" />
          {status}
        </span>
      </div>
      <div className="board-file-actions">
        <button
          className="file-button recovery-button"
          aria-label="Restore previous board"
          title={canRestore ? "Restore previous board" : "No previous board yet"}
          disabled={!canRestore}
          onClick={onRestore}
        >
          <Icon name="recover" />
        </button>
        <button
          className="file-button import-button"
          aria-label="Import board"
          title="Import board"
          onClick={onImport}
        >
          <Icon name="upload" />
          <span>Import</span>
        </button>
        <button
          className="export-button"
          aria-label="Export board"
          title="Export board"
          onClick={onExport}
        >
          <Icon name="download" />
          <span>Export</span>
        </button>
        <button
          className={`file-button inspector-toggle${inspectorOpen ? " is-open" : ""}`}
          ref={inspectorToggleRef}
          aria-label="Toggle inspector"
          aria-expanded={inspectorOpen}
          aria-controls="board-inspector"
          title={inspectorOpen ? "Hide inspector" : "Show inspector"}
          onClick={onToggleInspector}
        >
          <Icon name="layers" />
        </button>
      </div>
    </header>
  );
}
