import { Icon } from "../../components/icons.tsx";
import { PRESETS } from "@hydraw/document";
import type { Point } from "@hydraw/document";
import type { Editor } from "@hydraw/editor";
import { useState } from "react";
import { useEditorSnapshot } from "./useEditorSnapshot.ts";
import "./insert-panel.css";

export function InsertPanel({
  editor,
  center,
  onClose,
  onInserted,
  onImage,
  onLibrary,
}: {
  editor: Editor;
  center: () => Point;
  onClose: () => void;
  onInserted: () => void;
  onImage: () => void;
  onLibrary?: () => void;
}) {
  const snapshot = useEditorSnapshot(editor);
  const [error, setError] = useState<string | null>(null);

  function run(action: () => void) {
    setError(null);
    try {
      action();
      onInserted();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not insert this item.");
    }
  }

  return (
    <div className="insert-panel-root" data-workspace-overlay-root>
      <section className="insert-panel" role="dialog" aria-label="Insert" aria-modal="false">
        <header className="insert-panel-heading">
          <div>
            <h2>Insert</h2>
            <p>Add images, frames or a ready-made architecture flow.</p>
          </div>
          <button
            className="insert-panel-close"
            type="button"
            aria-label="Close insert panel"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </header>

        {error && (
          <p className="insert-panel-error" role="alert">
            {error}
          </p>
        )}

        <button type="button" className="file-button" aria-label="Insert image" onClick={onImage}>
          <span className="insert-action-icon">
            <Icon name="image" />
          </span>
          <span>
            <strong>Image</strong>
            <small>Upload, paste or drop an image</small>
          </span>
          <Icon name="plus" />
        </button>
        {onLibrary && (
          <button type="button" className="file-button" onClick={onLibrary}>
            <span className="insert-action-icon">
              <Icon name="library" />
            </span>
            <span>
              <strong>My library</strong>
              <small>Your saved shapes and diagrams</small>
            </span>
            <Icon name="arrow" />
          </button>
        )}
        <div className="insert-panel-frames" aria-label="Frames">
          {snapshot.selectedIds.length > 0 && (
            <button type="button" onClick={() => run(() => editor.frameSelection())}>
              <span className="insert-panel-frame-icon" aria-hidden="true">
                ▱
              </span>
              <span>
                <strong>Frame selection</strong>
                <small>Wrap selected objects</small>
              </span>
            </button>
          )}
          <button type="button" onClick={() => run(() => editor.addFrame(center()))}>
            <span className="insert-panel-frame-icon" aria-hidden="true">
              ＋
            </span>
            <span>
              <strong>Empty frame</strong>
              <small>Add at center · F to draw</small>
            </span>
          </button>
        </div>

        <section className="insert-panel-presets" aria-labelledby="insert-panel-presets-title">
          <h3 id="insert-panel-presets-title">Architecture presets</h3>
          <p className="insert-panel-subtitle">Editable, grouped nodes and connectors.</p>
          <div className="insert-panel-preset-list">
            {PRESETS.map((preset, index) => (
              <button
                key={preset.id}
                type="button"
                className="insert-panel-preset"
                onClick={() => run(() => editor.insertPreset(preset.id, center()))}
              >
                <PresetPreview variant={index} />
                <span className="insert-panel-preset-copy">
                  <strong>{preset.name}</strong>
                  <small>{preset.description}</small>
                </span>
                <span className="insert-panel-arrow" aria-hidden="true">
                  ↗
                </span>
              </button>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}

function PresetPreview({ variant }: { variant: number }) {
  const nodes =
    variant === 1
      ? ["rect", "diamond", "rect"]
      : variant === 2
        ? ["diamond", "rect", "ellipse"]
        : ["ellipse", "rect", "rect"];
  return (
    <svg className="insert-panel-preview" viewBox="0 0 92 42" aria-hidden="true">
      <path d="M25 21h10m22 0h10" />
      <path d="m32 18 3 3-3 3m22-6 3 3-3 3" />
      {nodes.map((shape, index) => {
        const x = 3 + index * 32;
        return shape === "diamond" ? (
          <path
            key={index}
            className={`node node-${index}`}
            d={`m${x + 10} 12 10 9-10 9-10-9 10-9Z`}
          />
        ) : shape === "ellipse" ? (
          <ellipse key={index} className={`node node-${index}`} cx={x + 10} cy="21" rx="9" ry="7" />
        ) : (
          <rect
            key={index}
            className={`node node-${index}`}
            x={x + 1}
            y="13"
            width="18"
            height="16"
            rx="4"
          />
        );
      })}
    </svg>
  );
}
