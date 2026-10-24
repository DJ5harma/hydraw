import type { VisualBackground } from "./visual-export.ts";
import { useRef, useState } from "react";
import { Icon, Mark } from "../../components/icons.tsx";
import type { SaveState } from "./persistence.ts";
import type { BoardTheme } from "@hydraw/document";
import "./board-menu.css";

export function BoardMenu({
  name,
  saveState,
  onRename,
  onExport,
  onVisualExport,
  selectionCount,
  onCopyImage,
  hasContent,
  exporting,
  onImport,
  onRestore,
  canRestore,
  open,
  onToggle,
  onClose,
  onObjects,
  onLibrary,
  theme,
  onThemeChange,
}: {
  name: string;
  saveState: SaveState;
  onRename: (name: string) => void;
  onExport: () => void;
  onVisualExport: (format: "svg" | "png", selectionOnly: boolean) => void;
  selectionCount: number;
  onCopyImage: (selectionOnly: boolean, background: VisualBackground) => void;
  hasContent: boolean;
  exporting: boolean;
  onImport: () => void;
  onRestore: () => void;
  canRestore: boolean;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onObjects: () => void;
  onLibrary: () => void;
  theme: BoardTheme;
  onThemeChange: (theme: BoardTheme) => void;
}) {
  const cancelledEdit = useRef(false);
  const [selectionOnly, setSelectionOnly] = useState(false);
  const [imageBackground, setImageBackground] = useState<VisualBackground>("board");
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
            <label className="board-export-area">
              Board style
              <select
                aria-label="Board style"
                value={theme}
                onChange={(event) => onThemeChange(event.target.value as BoardTheme)}
              >
                <option value="clean">Clean</option>
                <option value="notebook">Notebook</option>
                <option value="blueprint">Blueprint</option>
              </select>
            </label>
            <div className="board-menu-divider" />
            <label className="board-export-area">
              Export image
              <select
                aria-label="Export area"
                value={selectionOnly && selectionCount ? "selection" : "board"}
                onChange={(event) => setSelectionOnly(event.target.value === "selection")}
              >
                <option value="board">Whole board</option>
                <option value="selection" disabled={!selectionCount}>
                  Selection ({selectionCount})
                </option>
              </select>
            </label>
            <label className="board-export-area">
              Copy background
              <select
                aria-label="Copy image background"
                value={imageBackground}
                onChange={(event) => setImageBackground(event.target.value as VisualBackground)}
              >
                <option value="board">Board style</option>
                <option value="transparent">Transparent</option>
              </select>
            </label>
            <button
              type="button"
              className="file-button"
              disabled={!hasContent || exporting}
              onClick={() =>
                runAndClose(() => onCopyImage(selectionOnly && selectionCount > 0, imageBackground))
              }
            >
              Copy as image
            </button>
            <div className="board-export-formats">
              {(["svg", "png"] as const).map((format) => (
                <button
                  key={format}
                  className="file-button"
                  disabled={!hasContent || exporting}
                  onClick={() =>
                    runAndClose(() => onVisualExport(format, selectionOnly && selectionCount > 0))
                  }
                >
                  Export {format.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="board-menu-divider" />
            <button type="button" className="board-menu-action" onClick={onLibrary}>
              <Icon name="layers" />
              <span>My library</span>
            </button>
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
