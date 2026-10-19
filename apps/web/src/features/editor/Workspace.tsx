import { useRef } from "react";
import { downloadBoard } from "../board/files.ts";
import { BoardHeader } from "../board/BoardHeader.tsx";
import type { BoardSession } from "../board/useBoardSession.ts";
import { useBoardPersistence } from "../board/useBoardPersistence.ts";
import { BoardInspector } from "./BoardInspector.tsx";
import { CanvasControls } from "./CanvasControls.tsx";
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
  const { saveState, saveError } = useBoardPersistence(editor, storage, session.error);
  return (
    <main className="workspace" onKeyDown={keyboard}>
      <BoardHeader
        name={snapshot.document.name}
        saveState={saveState}
        onRename={(name) => editor.rename(name)}
        onExport={() => downloadBoard(editor.getSnapshot().document)}
      />
      {saveError && (
        <div className="storage-warning" role="alert">
          {saveError} Export your work before closing. Existing stored data has been left untouched
          when loading fails.
        </div>
      )}
      <div className="workspace-body">
        <section className="stage" aria-label="Drawing workspace">
          <CanvasSurface editor={editor} canvasRef={canvasRef} />
          <EditorToolbar editor={editor} selectTool={selectTool} />
          {snapshot.document.shapes.length === 0 && !snapshot.interacting && (
            <EmptyCanvas onStart={() => selectTool("rectangle")} />
          )}
          <CanvasControls editor={editor} center={center} />
        </section>
        <BoardInspector editor={editor} center={center} />
      </div>
    </main>
  );
}
