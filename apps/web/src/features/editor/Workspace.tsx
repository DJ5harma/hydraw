import { useRef, useState } from "react";
import { BoardTransferDialog } from "../board/BoardTransferDialog.tsx";
import type { TransferMode } from "../board/BoardTransferDialog.tsx";
import { downloadBoard } from "../board/files.ts";
import { BoardHeader } from "../board/BoardHeader.tsx";
import type { BoardSession } from "../board/useBoardSession.ts";
import { useBoardPersistence } from "../board/useBoardPersistence.ts";
import { BoardInspector } from "./BoardInspector.tsx";
import { CanvasControls } from "./CanvasControls.tsx";
import { InlineTextEditor } from "./InlineTextEditor.tsx";
import { CanvasSurface } from "./CanvasSurface.tsx";
import { EditorToolbar } from "./EditorToolbar.tsx";
import { EmptyCanvas } from "./EmptyCanvas.tsx";
import { createEditorControls } from "./controls.ts";
import { useEditorSnapshot } from "./useEditorSnapshot.ts";

export function Workspace({ session }: { session: BoardSession }) {
  const { editor, storage } = session;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const snapshot = useEditorSnapshot(editor);
  const { center, selectTool, keyboard } = createEditorControls(editor, canvasRef);
  const { saveState, saveError, recovery, recoveryWarning, persistence } = useBoardPersistence(
    editor,
    storage,
    session.error,
  );
  const [transfer, setTransfer] = useState<TransferMode | null>(null);
  return (
    <main className="workspace" onKeyDown={keyboard}>
      <BoardHeader
        name={snapshot.document.name}
        saveState={saveState}
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
      {saveError && (
        <div className="storage-warning" role="alert">
          {saveError} Export your work before closing. Existing stored data has been left untouched
          when loading fails.
        </div>
      )}
      {recoveryWarning && (
        <div className="storage-warning" role="alert">
          {recoveryWarning}
        </div>
      )}
      <div className="workspace-body">
        <section className="stage" aria-label="Drawing workspace">
          <CanvasSurface editor={editor} canvasRef={canvasRef} />
          <InlineTextEditor editor={editor} canvasRef={canvasRef} />
          <EditorToolbar editor={editor} selectTool={selectTool} />
          {snapshot.document.shapes.length === 0 &&
            !snapshot.interacting &&
            !snapshot.textEditing &&
            snapshot.tool !== "text" && <EmptyCanvas onStart={() => selectTool("rectangle")} />}
          <CanvasControls editor={editor} center={center} />
        </section>
        <BoardInspector editor={editor} center={center} />
      </div>
      {transfer && (
        <BoardTransferDialog
          mode={transfer}
          persistence={persistence}
          onClose={() => setTransfer(null)}
        />
      )}
    </main>
  );
}
