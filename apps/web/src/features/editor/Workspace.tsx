import type { Alignment, DistributionAxis } from "@hydraw/document";
import { boardTheme } from "@hydraw/document";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { BoardTransferDialog } from "../board/BoardTransferDialog.tsx";
import type { TransferMode } from "../board/BoardTransferDialog.tsx";
import { copyVisual } from "../board/visual-export.ts";
import type { VisualBackground } from "../board/visual-export.ts";
import { downloadVisual } from "../board/visual-export.ts";
import { downloadBoard } from "../board/files.ts";
import { BoardMenu } from "../board/BoardMenu.tsx";
import type { BoardSession } from "../board/session.ts";
import { useBoardPersistence } from "../board/useBoardPersistence.ts";
import { CanvasContextMenu } from "./CanvasContextMenu.tsx";
import { contextMenuActions } from "./context-menu-actions.ts";
import { useCanvasContextMenu } from "./useCanvasContextMenu.ts";
import { InsertPanel } from "./InsertPanel.tsx";
import { SelectionActions } from "./SelectionActions.tsx";
import { ObjectNavigator } from "./ObjectNavigator.tsx";
import { CanvasControls } from "./CanvasControls.tsx";
import { InlineTextEditor } from "./InlineTextEditor.tsx";
import { CanvasSurface } from "./CanvasSurface.tsx";
import { EditorToolbar } from "./EditorToolbar.tsx";
import { DrawingProperties } from "./DrawingProperties.tsx";
import { EmptyCanvas } from "./EmptyCanvas.tsx";
import { createEditorControls } from "./controls.ts";
import { useWorkspaceOverlay } from "./useWorkspaceOverlay.ts";
import { useBoardImages } from "./useBoardImages.ts";
import { useClipboard } from "./useClipboard.ts";
import { useEditorSnapshot } from "./useEditorSnapshot.ts";

export function Workspace({ session }: { session: BoardSession }) {
  const { editor, storage } = session;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const snapshot = useEditorSnapshot(editor);
  const overlay = useWorkspaceOverlay(canvasRef);
  const context = useCanvasContextMenu(editor, canvasRef, () => overlay.open("context"));
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
  const insertImages = useBoardImages({ editor, canvasRef, center, onError: setActionError });
  useClipboard({
    editor,
    center: () =>
      overlay.active === "context" && context.anchor ? context.anchor.screen : center(),
    onError: setActionError,
    onHandled: () => {
      if (overlay.active === "context") overlay.close();
    },
  });
  const { saveState, saveError, recovery, recoveryWarning, persistence } = useBoardPersistence(
    editor,
    storage,
    session.error,
  );
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!copyNotice) return;
    const timer = window.setTimeout(() => setCopyNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [copyNotice]);
  async function copyImage(selectionOnly = true, background: VisualBackground = "board") {
    try {
      editor.finishTextEditing();
      const current = editor.getSnapshot();
      if (!current.document.shapes.length && !current.document.connectors.length) return;
      if (selectionOnly && !current.selectedIds.length) return;
      await copyVisual(
        current.document,
        selectionOnly ? current.selectedIds : undefined,
        background,
      );
      setActionError(null);
      setCopyNotice("Image copied to clipboard");
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Could not copy this image.");
    }
  }
  const [exporting, setExporting] = useState(false);
  async function exportImage(format: "svg" | "png", selectionOnly: boolean) {
    setExporting(true);
    try {
      editor.finishTextEditing();
      const current = editor.getSnapshot();
      await downloadVisual(
        current.document,
        format,
        selectionOnly ? current.selectedIds : undefined,
      );
      setActionError(null);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "The image could not be exported.");
    } finally {
      setExporting(false);
    }
  }
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
      editor.getSnapshot().selectedIds.length > 0,
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
        <CanvasSurface editor={editor} canvasRef={canvasRef} onError={setActionError} />
        <input
          ref={imageInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          aria-label="Image files"
          hidden
          onChange={(event) => {
            insertImages(Array.from(event.currentTarget.files ?? []));
            event.currentTarget.value = "";
          }}
        />
        <InlineTextEditor editor={editor} canvasRef={canvasRef} />
        <BoardMenu
          name={snapshot.document.name}
          theme={boardTheme(snapshot.document)}
          onThemeChange={(theme) => editor.setBoardTheme(theme)}
          saveState={saveState}
          open={overlay.active === "board"}
          onToggle={() => overlay.open(overlay.active === "board" ? null : "board")}
          onClose={() => overlay.close()}
          onObjects={() => overlay.open("objects")}
          onRename={(name) => editor.rename(name)}
          onExport={() => downloadBoard(editor.getSnapshot().document)}
          onVisualExport={(format, selectionOnly) => {
            void exportImage(format, selectionOnly);
          }}
          onCopyImage={(selectionOnly, background) => {
            void copyImage(selectionOnly, background);
          }}
          selectionCount={snapshot.selectedIds.length}
          hasContent={snapshot.document.shapes.length + snapshot.document.connectors.length > 0}
          exporting={exporting}
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
          insertOpen={overlay.active === "insert"}
          onInsert={() => overlay.open(overlay.active === "insert" ? null : "insert")}
          selectTool={(tool) => {
            overlay.close(false);
            selectTool(tool);
          }}
        />
        <DrawingProperties editor={editor} hidden={overlay.active !== null} />
        {snapshot.document.shapes.length === 0 &&
          snapshot.document.connectors.length === 0 &&
          !snapshot.interacting &&
          !snapshot.textEditing &&
          snapshot.tool !== "draw" &&
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
        {overlay.active === "insert" && (
          <InsertPanel
            editor={editor}
            center={center}
            onInserted={fit}
            onImage={() => {
              imageInputRef.current?.click();
              overlay.close(false);
            }}
            onClose={() => overlay.close()}
          />
        )}
        <SelectionActions
          editor={editor}
          onCopyImage={() => {
            void copyImage();
          }}
          onMore={context.showSelection}
          onFitFrame={fit}
          onExportFrame={() => {
            void exportImage("svg", true);
          }}
          onDuplicate={duplicate}
          onAlign={align}
          onDistribute={distribute}
          overlay={overlay.active}
          onOverlay={overlay.open}
        />
        {overlay.active === "context" && context.anchor && (
          <CanvasContextMenu
            key={`${context.anchor.client.x}:${context.anchor.client.y}:${selectionKey}`}
            position={context.anchor.client}
            groups={contextMenuActions({
              editor,
              point: context.anchor.screen,
              fit,
              exportImage: (format) => exportImage(format, true),
              copyImage: () => copyImage(),
            })}
            onClose={() => overlay.close()}
            onError={setActionError}
          />
        )}
        {overlay.active === "objects" && (
          <ObjectNavigator
            editor={editor}
            onClose={() => overlay.close()}
            onFrame={(id) => {
              editor.select(id);
              fit();
              overlay.close();
            }}
          />
        )}
        <div className="workspace-notices">
          {copyNotice && (
            <div className="copy-notice" role="status">
              {copyNotice}
            </div>
          )}
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
