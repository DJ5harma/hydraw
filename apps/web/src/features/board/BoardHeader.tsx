import { Icon, Mark } from "../../components/icons.tsx";
import type { SaveState } from "./useBoardPersistence.ts";
export function BoardHeader({
  name,
  saveState,
  onRename,
  onExport,
  onImport,
  onRestore,
  canRestore,
}: {
  name: string;
  saveState: SaveState;
  onRename: (name: string) => void;
  onExport: () => void;
  onImport: () => void;
  onRestore: () => void;
  canRestore: boolean;
}) {
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
      <a className="brand" href="/" aria-label="Hydraw home">
        <Mark />
        <span>
          hydraw<span className="brand-dot">.</span>
        </span>
      </a>
      <span className="header-divider" />
      <div className="board-identity">
        <input
          key={name}
          className="board-title"
          aria-label="Board name"
          defaultValue={name}
          maxLength={120}
          onBlur={(event) => onRename(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
        <span className={`save-status ${saveState === "error" ? "has-error" : ""}`} role="status">
          <span className="status-dot" />
          {status}
        </span>
      </div>
      <span className="milestone-tag">THE FIRST MARK</span>
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
        <button className="file-button" aria-label="Import board" onClick={onImport}>
          <Icon name="upload" />
          <span>Import</span>
        </button>
        <button className="export-button" aria-label="Export board" onClick={onExport}>
          <Icon name="download" />
          <span>Export board</span>
        </button>
      </div>
    </header>
  );
}
