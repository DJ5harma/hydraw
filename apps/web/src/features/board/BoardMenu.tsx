import { useRef } from "react";
import { Icon, Mark } from "../../components/icons.tsx";
import type { SaveState } from "./persistence.ts";
import "./board-menu.css";

export function BoardMenu({
  name,
  saveState,
  onRename,
  onExport,
  onImport,
  onRestore,
  canRestore,
  open,
  onToggle,
  onClose,
  onObjects,
}: {
  name: string;
  saveState: SaveState;
  onRename: (name: string) => void;
  onExport: () => void;
  onImport: () => void;
  onRestore: () => void;
  canRestore: boolean;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onObjects: () => void;
}) {
  const cancelledEdit = useRef(false);
  const status =
    saveState === "saving"
      ? "Saving locally…"
      : saveState === "error"
        ? "Could not save locally"
        : saveState === "saved"
          ? "Saved in this browser"
          : "Local board · this browser";
  const runAndClose = (action: () => void) => {
    onClose();
    action();
  };

  return (
    <div className="board-menu-root" data-workspace-overlay-root>
      <button
        className="board-menu-trigger"
        type="button"
        aria-label="Board menu"
        title={`Board menu · ${name}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        data-overlay-trigger="board"
        onClick={onToggle}
      >
        <Icon name="menu" />
        <span className="board-menu-trigger-name">{name}</span>
        <span className={`board-menu-trigger-status${saveState === "error" ? " has-error" : ""}`}>
          <span className="board-menu-status-dot" />
          <span className="board-menu-sr-only">
            {saveState === "saving"
              ? "Saving locally"
              : saveState === "error"
                ? "Save failed"
                : "Stored locally"}
          </span>
        </span>
      </button>
      <span className="board-menu-live-status" role="status">
        <span className={`board-menu-status-dot${saveState === "error" ? " is-error" : ""}`} />
        {status}
      </span>
      {open && (
        <div className="board-menu-popover" role="dialog" aria-label="Board menu">
          <div className="board-menu-heading">
            <span className="board-menu-mark">
              <Mark />
            </span>
            <div className="board-menu-identity">
              <input
                key={name}
                className="board-menu-title"
                aria-label="Board name"
                defaultValue={name}
                maxLength={120}
                onBlur={(event) => {
                  const nextName = event.currentTarget.value.trim();
                  if (!cancelledEdit.current && nextName && nextName !== name) onRename(nextName);
                  cancelledEdit.current = false;
                }}
                onKeyDown={(event) => {
                  if (event.nativeEvent.isComposing) return;
                  if (event.key === "Enter") {
                    event.preventDefault();
                    event.currentTarget.blur();
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    cancelledEdit.current = true;
                    event.currentTarget.value = name;
                    event.currentTarget.blur();
                  }
                }}
              />
              <span
                className={`board-menu-save-status${saveState === "error" ? " has-error" : ""}`}
              >
                <span className="board-menu-status-dot" />
                {status}
              </span>
            </div>
          </div>
          <div className="board-menu-actions">
            <button
              type="button"
              className="board-menu-action"
              onClick={() => runAndClose(onImport)}
            >
              <Icon name="upload" />
              <span>Import board</span>
            </button>
            <button
              type="button"
              className="board-menu-action"
              onClick={() => runAndClose(onExport)}
            >
              <Icon name="download" />
              <span>Export board</span>
            </button>
            <button
              type="button"
              className="board-menu-action"
              disabled={!canRestore}
              onClick={() => runAndClose(onRestore)}
            >
              <Icon name="recover" />
              <span>Restore previous board</span>
            </button>
            <div className="board-menu-divider" />
            <button type="button" className="board-menu-action" onClick={onObjects}>
              <Icon name="layers" />
              <span>Objects</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
