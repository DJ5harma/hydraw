import type { Alignment, DistributionAxis } from "@hydraw/document";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { BoardTransferDialog } from "../board/BoardTransferDialog.tsx";
import type { TransferMode } from "../board/BoardTransferDialog.tsx";
import { downloadBoard } from "../board/files.ts";
import { BoardMenu } from "../board/BoardMenu.tsx";
import type { BoardSession } from "../board/session.ts";
import { useBoardPersistence } from "../board/useBoardPersistence.ts";
import { SelectionActions } from "./SelectionActions.tsx";
import { ObjectNavigator } from "./ObjectNavigator.tsx";
import { CanvasControls } from "./CanvasControls.tsx";
import { InlineTextEditor } from "./InlineTextEditor.tsx";
import { CanvasSurface } from "./CanvasSurface.tsx";
import { EditorToolbar } from "./EditorToolbar.tsx";
import { EmptyCanvas } from "./EmptyCanvas.tsx";
import { createEditorControls } from "./controls.ts";
import { useWorkspaceOverlay } from "./useWorkspaceOverlay.ts";
import { useEditorSnapshot } from "./useEditorSnapshot.ts";

export function Workspace({ session }: { session: BoardSession }) {
  const { editor, storage } = session;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const snapshot = useEditorSnapshot(editor);
  const overlay = useWorkspaceOverlay(canvasRef);
  const selectionKey = snapshot.selectedIds.join(",");
  const { close, dismissSelection } = overlay;
  const editing = snapshot.textEditing !== null;
  useEffect(() => {
    dismissSelection();
  }, [selectionKey, dismissSelection]);
  useEffect(() => {
    if (snapshot.interacting || editing) close(false);
  }, [snapshot.interacting, editing, close]);
  const [actionError, setActionError] = useState<string | null>(null);
  function runSelectionAction(action: () => void) {
    try {
      action();
      setActionError(null);
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "This selection could not be changed.",
      );
    }
  }
  const duplicate = () => runSelectionAction(() => editor.duplicateSelection());
  const align = (alignment: Alignment) =>
    runSelectionAction(() => editor.alignSelection(alignment));
  const distribute = (axis: DistributionAxis) =>
    runSelectionAction(() => editor.distributeSelection(axis));
  const { center, selectTool, keyboard } = createEditorControls(editor, canvasRef, duplicate);
  const { saveState, saveError, recovery, recoveryWarning, persistence } = useBoardPersistence(
    editor,
    storage,
    session.error,
  );
  const [transfer, setTransfer] = useState<TransferMode | null>(null);
  const previousTransfer = useRef(transfer);
  useLayoutEffect(() => {
    if (previousTransfer.current && !transfer)
      document.querySelector<HTMLButtonElement>('[data-overlay-trigger="board"]')?.focus();
    previousTransfer.current = transfer;
  }, [transfer]);
  function fit() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const narrow = canvas.clientWidth <= 660;
    editor.fitView(
      {
        x: 24,
        y: narrow ? 144 : 90,
        width: Math.max(1, canvas.clientWidth - 48),
        height: Math.max(1, canvas.clientHeight - (narrow ? 300 : 190)),
      },
      snapshot.selectedIds.length > 0,
    );
  }
  return (
    <main
      className="workspace"
      onKeyDown={(event) => {
        if (!overlay.keyboard(event)) keyboard(event);
      }}
    >
      <section className="stage" aria-label="Drawing workspace">
        <CanvasSurface editor={editor} canvasRef={canvasRef} />
        <InlineTextEditor editor={editor} canvasRef={canvasRef} />
        <BoardMenu
          name={snapshot.document.name}
          saveState={saveState}
          open={overlay.active === "board"}
          onToggle={() => overlay.open(overlay.active === "board" ? null : "board")}
          onClose={() => overlay.close()}
          onObjects={() => overlay.open("objects")}
          onRename={(name) => editor.rename(name)}
          onExport={() => downloadBoard(editor.getSnapshot().document)}
          onImport={() => {
            editor.cancelGesture();
            setTransfer("import");
          }}
          onRestore={() => {
            editor.cancelGesture();
            setTransfer("restore");
          }}
          canRestore={recovery !== null}
        />
        <EditorToolbar
          editor={editor}
          selectTool={(tool) => {
            overlay.close(false);
            selectTool(tool);
          }}
        />
        {snapshot.document.shapes.length === 0 &&
          snapshot.document.connectors.length === 0 &&
          !snapshot.interacting &&
          !snapshot.textEditing &&
          snapshot.tool !== "text" &&
          snapshot.tool !== "connector" && <EmptyCanvas onStart={() => selectTool("rectangle")} />}
        <CanvasControls
          editor={editor}
          center={center}
          overlay={overlay.active}
          onOverlay={overlay.open}
          onFit={fit}
          fitLabel={snapshot.selectedIds.length ? "Fit selection" : "Fit board"}
        />
        <SelectionActions
          editor={editor}
          onDuplicate={duplicate}
          onAlign={align}
          onDistribute={distribute}
          overlay={overlay.active}
          onOverlay={overlay.open}
        />
        {overlay.active === "objects" && (
          <ObjectNavigator editor={editor} onClose={() => overlay.close()} />
        )}
        <div className="workspace-notices">
          {actionError && (
            <div className="storage-warning selection-warning" role="alert">
              {actionError}
              <button onClick={() => setActionError(null)} aria-label="Dismiss selection error">
                Dismiss
              </button>
            </div>
          )}
          {saveError && (
            <div className="storage-warning" role="alert">
              {saveError} Export your work before closing. Existing stored data has been left
              untouched when loading fails.
            </div>
          )}
          {recoveryWarning && (
            <div className="storage-warning" role="alert">
              {recoveryWarning}
            </div>
          )}
        </div>
      </section>
      {transfer && (
        <BoardTransferDialog
          mode={transfer}
          persistence={persistence}
          onClose={() => {
            setTransfer(null);
          }}
        />
      )}
    </main>
  );
}
