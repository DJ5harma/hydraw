import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import type { BoardDocument } from "@hydraw/document";
import { Icon } from "../../components/icons.tsx";
import { downloadBoard, readBoardFile } from "./files.ts";
import type { BoardPersistence } from "./persistence.ts";

export type TransferMode = "import" | "restore";

/** Review first. The persistence controller owns the only state-changing operation. */
export function BoardTransferDialog({
  mode,
  persistence,
  onClose,
}: {
  mode: TransferMode;
  persistence: BoardPersistence;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const request = useRef(0);
  const titleId = useId();
  const descriptionId = useId();
  const { recovery, replacing, recoveryWarning } = useSyncExternalStore(
    persistence.subscribe,
    persistence.getSnapshot,
  );
  const [preview, setPreview] = useState<BoardDocument | null>(
    mode === "restore" ? recovery : null,
  );
  const [fileName, setFileName] = useState("");
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => {
      request.current++;
      element.close();
    };
  }, []);

  async function choose(file: File | undefined) {
    if (!file) return;
    const current = ++request.current;
    setFileName(file.name);
    setPreview(null);
    setError(null);
    setReading(true);
    try {
      const document = await readBoardFile(file);
      if (current === request.current) setPreview(document);
    } catch (cause) {
      if (current === request.current)
        setError(cause instanceof Error ? cause.message : "This file could not be read.");
    } finally {
      if (current === request.current) setReading(false);
    }
  }

  async function confirm() {
    if (!preview || replacing || reading) return;
    setError(null);
    try {
      if (mode === "restore") await persistence.restore();
      else await persistence.replace(preview);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The board could not be opened.");
    }
  }

  const textCount = preview?.shapes.filter((shape) => shape.type === "text").length ?? 0;
  const rectangleCount = (preview?.shapes.length ?? 0) - textCount;
  return (
    <dialog
      ref={dialog}
      className="board-transfer-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-busy={replacing || reading}
      onKeyDown={(event) => event.stopPropagation()}
      onCancel={(event) => {
        event.preventDefault();
        if (!replacing) onClose();
      }}
    >
      <div className="transfer-heading">
        <span className="transfer-icon">
          <Icon name={mode === "import" ? "upload" : "recover"} />
        </span>
        <h2 id={titleId}>{mode === "import" ? "Import a board" : "Restore the previous board"}</h2>
      </div>
      <p id={descriptionId}>
        Your current board will be kept as the previous board. Only one previous board is retained.
        Undo history starts fresh when you open a different board.
      </p>
      {mode === "import" && (
        <label className="board-file-picker">
          <span>Choose a Hydraw JSON file</span>
          <input
            type="file"
            accept=".hydraw.json,.json,application/json"
            aria-label="Hydraw board file"
            disabled={replacing}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              void choose(file);
            }}
          />
          <small>{fileName || "Versions 0–2 · up to 2 MB"}</small>
        </label>
      )}
      {reading && <p className="transfer-reading">Reading and validating your board…</p>}
      {preview && (
        <div className="board-import-preview" aria-label="Board preview">
          <Icon name="rectangle" />
          <div>
            <strong>{preview.name || "Untitled board"}</strong>
            <span>
              {rectangleCount} {rectangleCount === 1 ? "rectangle" : "rectangles"} · {textCount}{" "}
              {textCount === 1 ? "text object" : "text objects"} · {preview.connectors.length}{" "}
              {preview.connectors.length === 1 ? "connector" : "connectors"}
            </span>
          </div>
        </div>
      )}
      {recoveryWarning && (
        <p className="transfer-error" role="alert">
          {recoveryWarning}
        </p>
      )}
      {!persistence.canReplace && (
        <p className="transfer-error" role="alert">
          Import needs local storage so a recovery copy can be saved. Export your current work and
          enable local storage first.
        </p>
      )}
      {error && (
        <p className="transfer-error" role="alert">
          {error} Your current board has not been replaced.
        </p>
      )}
      <button
        className="transfer-export"
        disabled={replacing}
        onClick={() => downloadBoard(persistence.getDocument())}
      >
        <Icon name="download" />
        Export current board
      </button>
      <div className="transfer-actions">
        <button className="file-button" disabled={replacing} onClick={onClose}>
          Cancel
        </button>
        <button
          className="export-button"
          disabled={!preview || reading || replacing || !persistence.canReplace}
          onClick={() => {
            void confirm();
          }}
        >
          {replacing
            ? "Saving recovery copy…"
            : mode === "import"
              ? "Open imported board"
              : "Restore board"}
        </button>
      </div>
    </dialog>
  );
}
