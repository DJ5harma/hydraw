import type { Alignment, DistributionAxis } from "@hydraw/document";
import type { Editor } from "@hydraw/editor";
import { Icon } from "../../components/icons.tsx";
import { ArrangementControls } from "./ArrangementControls.tsx";
import { ColorSwatches, fillPalette } from "./ColorSwatches.tsx";
import { ConnectorInspector } from "./ConnectorInspector.tsx";
import { GeometryFields } from "./GeometryFields.tsx";
import { TextStyleControls } from "./TextStyleControls.tsx";
import { useEditorSnapshot } from "./useEditorSnapshot.ts";
import "./selection-actions.css";

import type { ReactNode } from "react";
import type { WorkspaceOverlay as SelectionOverlay } from "./useWorkspaceOverlay.ts";
import "./property-controls.css";

export function SelectionActions({
  editor,
  onDuplicate,
  onAlign,
  onDistribute,
  overlay,
  onOverlay,
}: {
  editor: Editor;
  onDuplicate: () => void;
  onAlign: (alignment: Alignment) => void;
  onDistribute: (axis: DistributionAxis) => void;
  overlay: SelectionOverlay;
  onOverlay: (name: SelectionOverlay) => void;
}) {
  const snapshot = useEditorSnapshot(editor);
  const ids = snapshot.selectedIds;
  const selectedShape = snapshot.document.shapes.find((shape) => shape.id === snapshot.selectedId);
  const selectedConnector = snapshot.document.connectors.find(
    (item) => item.id === snapshot.selectedId,
  );
  if (
    !ids.length ||
    snapshot.interacting ||
    snapshot.textEditing ||
    snapshot.tool !== "select" ||
    ["board", "objects", "help"].includes(overlay ?? "")
  )
    return null;

  const multi = ids.length > 1;
  const selectedSet = new Set(ids);
  const shapeCount = snapshot.document.shapes.filter((shape) => selectedSet.has(shape.id)).length;
  const panelTitle =
    overlay === "geometry"
      ? "Precise geometry"
      : multi
        ? "Arrange selection"
        : selectedConnector
          ? "Connector style"
          : selectedShape?.type === "text"
            ? "Text style"
            : "Rectangle style";
  const isOpen = multi ? overlay === "arrange" : overlay === "style" || overlay === "geometry";
  const trigger = (name: SelectionOverlay, label: string, children: ReactNode) => (
    <button
      className="selection-action"
      data-overlay-trigger={name ?? undefined}
      aria-label={label}
      aria-expanded={overlay === name}
      onClick={() => onOverlay(overlay === name ? null : name)}
    >
      {children}
    </button>
  );

  return (
    <div className="selection-actions-root" data-workspace-overlay-root>
      {isOpen && (
        <section className="selection-popover" role="dialog" aria-label={panelTitle}>
          <header>
            <h2>{panelTitle}</h2>
            <button
              className="selection-close"
              aria-label="Close selection properties"
              onClick={() => onOverlay(null)}
            >
              ×
            </button>
          </header>
          {multi ? (
            <ArrangementControls
              shapeCount={shapeCount}
              onAlign={onAlign}
              onDistribute={onDistribute}
            />
          ) : selectedConnector ? (
            <ConnectorInspector
              connector={selectedConnector}
              document={snapshot.document}
              editor={editor}
            />
          ) : selectedShape?.type === "text" ? (
            overlay === "geometry" ? (
              <GeometryFields shape={selectedShape} editor={editor} />
            ) : (
              <TextStyleControls key={selectedShape.id} shape={selectedShape} editor={editor} />
            )
          ) : selectedShape ? (
            overlay === "geometry" ? (
              <GeometryFields shape={selectedShape} editor={editor} />
            ) : (
              <div className="selection-property-content">
                <h3>Fill</h3>
                <ColorSwatches
                  palette={fillPalette}
                  value={selectedShape.fill}
                  onChange={(fill) => editor.setFill(fill)}
                  label="Rectangle fill color"
                  suffix="fill"
                />
              </div>
            )
          ) : null}
        </section>
      )}
      <nav className="selection-shelf" aria-label="Selection actions">
        {multi && (
          <span className="selection-count" role="heading" aria-level={2}>
            {ids.length} objects
          </span>
        )}
        {!multi &&
          trigger(
            "style",
            selectedConnector
              ? "Connector style"
              : selectedShape?.type === "text"
                ? "Text style"
                : "Fill",
            <>
              {selectedShape?.type === "text" ? "Text style" : selectedConnector ? "Style" : "Fill"}
            </>,
          )}
        <button
          className="selection-action"
          aria-label="Duplicate selection"
          title="Duplicate selection"
          onClick={onDuplicate}
        >
          <Icon name="duplicate" />
          <span>Duplicate</span>
        </button>
        <button
          className="selection-action is-danger"
          aria-label={
            multi
              ? "Delete selection"
              : selectedConnector
                ? "Delete connector"
                : `Delete ${selectedShape?.type === "text" ? "text" : "rectangle"}`
          }
          onClick={() => editor.removeSelection()}
        >
          <Icon name="trash" />
          <span>Delete</span>
        </button>
        {!multi &&
          selectedShape &&
          trigger("geometry", "More properties", <Icon name="settings" />)}
        {multi && trigger("arrange", "Arrange selection", <>Arrange</>)}
      </nav>
    </div>
  );
}
