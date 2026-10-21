import { frameContents } from "@hydraw/document";
import type { Rectangle } from "@hydraw/document";
import type { Editor } from "@hydraw/editor";

export function FrameProperties({
  frame,
  editor,
  onFit,
  onExport,
}: {
  frame: Rectangle;
  editor: Editor;
  onFit: () => void;
  onExport: () => void;
}) {
  const name = frame.label?.text ?? "Untitled frame";
  const document = editor.getSnapshot().document;
  const contents = new Set(frameContents(document, frame.id));
  const lockedContents = [...document.shapes, ...document.connectors].some(
    (item) => contents.has(item.id) && item.locked,
  );
  return (
    <div className="frame-properties">
      <label>
        Frame name
        <input
          key={`${frame.id}:${name}`}
          aria-label="Frame name"
          defaultValue={name}
          maxLength={120}
          onBlur={(event) => editor.renameFrame(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              event.currentTarget.value = name;
              event.currentTarget.blur();
            }
          }}
        />
      </label>
      <p>
        Drag the border or title to move enclosed objects. Resize the boundary without scaling them.
      </p>
      <div className="organization-actions">
        <button className="file-button" onClick={onFit}>
          Fit frame
        </button>
        <button className="file-button" onClick={onExport}>
          Export frame SVG
        </button>
      </div>
      {lockedContents && <p>Unlock enclosed objects before moving this frame.</p>}
      <p>Deleting this frame keeps its contents.</p>
    </div>
  );
}
