import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { isFrame } from "@hydraw/document";
import { FrameProperties } from "./FrameProperties.tsx";
import type { Alignment, DistributionAxis } from "@hydraw/document";
import { selectionBounds } from "@hydraw/editor";
import type { Editor } from "@hydraw/editor";
import { Icon } from "../../components/icons.tsx";
import { ArrangementControls } from "./ArrangementControls.tsx";
import { ConnectorInspector } from "./ConnectorInspector.tsx";
import { GeometryFields } from "./GeometryFields.tsx";
import { RectangleStyleControls } from "./RectangleStyleControls.tsx";
import { TextStyleControls } from "./TextStyleControls.tsx";
import { useEditorSnapshot } from "./useEditorSnapshot.ts";
import type { WorkspaceOverlay } from "./useWorkspaceOverlay.ts";
import "./selection-actions.css";
import "./property-controls.css";

export function SelectionActions({
  editor,
  onDuplicate,
  onAlign,
  onDistribute,
  overlay,
  onOverlay,
  onFitFrame,
  onExportFrame,
}: {
  editor: Editor;
  onFitFrame: () => void;
  onExportFrame: () => void;
  onDuplicate: () => void;
  onAlign: (alignment: Alignment) => void;
  onDistribute: (axis: DistributionAxis) => void;
  overlay: WorkspaceOverlay;
  onOverlay: (name: WorkspaceOverlay) => void;
}) {
  const snapshot = useEditorSnapshot(editor);
  const panelRef = useRef<HTMLDivElement>(null);
  const [right, setRight] = useState(false);
  const [commandError, setCommandError] = useState<string | null>(null);
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const bounds = selectionBounds(
      snapshot.document.shapes,
      snapshot.document.connectors,
      snapshot.selectedIds,
    );
    if (!panel || !bounds || window.innerWidth <= 660) {
      setRight(false);
      return;
    }
    const camera = editor.getSnapshot().camera;
    const overlaps = [bounds, ...snapshot.document.shapes].some((item) => {
      const x = item.x * camera.zoom + camera.x;
      const y = item.y * camera.zoom + camera.y;
      return (
        x < 272 &&
        x + item.width * camera.zoom > 0 &&
        y < 88 + panel.offsetHeight &&
        y + item.height * camera.zoom > 88
      );
    });
    setRight(overlaps);
  }, [
    editor,
    overlay,
    snapshot.selectedIds,
    snapshot.document,
    snapshot.interacting,
    snapshot.zoom,
    snapshot.tool,
    snapshot.textEditing,
  ]);
  const ids = snapshot.selectedIds;
  const selectedShape = snapshot.document.shapes.find((shape) => shape.id === snapshot.selectedId);
  const selectedConnector = snapshot.document.connectors.find(
    (item) => item.id === snapshot.selectedId,
  );
  useEffect(() => setCommandError(null), [ids.join("\u0000")]);
  if (
    !ids.length ||
    snapshot.interacting ||
    snapshot.textEditing ||
    snapshot.tool !== "select" ||
    ["board", "objects", "help", "insert"].includes(overlay ?? "")
  )
    return null;

  const multi = ids.length > 1;
  const selectedSet = new Set(ids);
  const shapeCount = snapshot.document.shapes.filter((shape) => selectedSet.has(shape.id)).length;
  const selectedObjects = [
    ...snapshot.document.shapes.filter((shape) => selectedSet.has(shape.id)),
    ...snapshot.document.connectors.filter((connector) => selectedSet.has(connector.id)),
  ];
  const anyFrames = selectedObjects.some((item) => item.type !== "connector" && isFrame(item));
  const selectedFrame = selectedShape && isFrame(selectedShape) ? selectedShape : undefined;
  const anyLocked = selectedObjects.some((item) => item.locked);
  const anyGrouped = selectedObjects.some((item) => item.groupId !== undefined);
  const groupIds = new Set(selectedObjects.flatMap((item) => (item.groupId ? [item.groupId] : [])));
  const oneGroup =
    groupIds.size === 1 && selectedObjects.every((item) => item.groupId === [...groupIds][0]);
  const title = multi
    ? `${ids.length} objects`
    : anyLocked
      ? "Locked selection"
      : selectedFrame
        ? "Frame"
        : selectedConnector
          ? "Connector style"
          : selectedShape?.type === "text"
            ? "Text style"
            : `${selectedShape?.type === "rectangle" && selectedShape.kind ? selectedShape.kind[0]!.toUpperCase() + selectedShape.kind.slice(1) : "Rectangle"} style`;
  const geometryOpen =
    overlay === "geometry" && selectedShape !== undefined && !multi && !anyLocked;

  function runCommand(action: () => void) {
    try {
      action();
      setCommandError(null);
    } catch (cause) {
      setCommandError(
        cause instanceof Error ? cause.message : "The selection could not be changed.",
      );
    }
  }

  const orderActions = [
    { label: "Front", direction: "front" },
    { label: "Forward", direction: "forward" },
    { label: "Backward", direction: "backward" },
    { label: "Back", direction: "back" },
  ] as const;

  return (
    <div
      ref={panelRef}
      className={`selection-properties-root${right ? " is-right" : ""}`}
      data-workspace-overlay-root
    >
      <section className="selection-properties" role="region" aria-label="Selection properties">
        <header className="selection-properties-heading">
          <h2>{title}</h2>
          {oneGroup && <span className="selection-group-badge">Group</span>}
        </header>
        <div className="selection-properties-content">
          {commandError && (
            <p className="selection-command-error" role="alert">
              {commandError}
            </p>
          )}
          {anyLocked ? (
            <p className="locked-selection-message">
              Locked objects can be selected on the canvas. Unlock to edit.
            </p>
          ) : selectedFrame ? (
            <FrameProperties
              frame={selectedFrame}
              editor={editor}
              onFit={onFitFrame}
              onExport={onExportFrame}
            />
          ) : multi && (anyGrouped || anyFrames) ? (
            <p className="locked-selection-message">
              Select individual ungrouped objects to arrange them.
            </p>
          ) : multi ? (
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
            <TextStyleControls key={selectedShape.id} shape={selectedShape} editor={editor} />
          ) : selectedShape?.type === "rectangle" ? (
            <RectangleStyleControls shape={selectedShape} editor={editor} />
          ) : null}
          <section className="selection-organize" aria-label="Organize selection">
            <h3>Organize</h3>
            <div className="organization-actions">
              {!anyFrames && !anyLocked && (
                <button onClick={() => runCommand(() => editor.frameSelection())}>
                  Frame selection
                </button>
              )}
              {multi && !oneGroup && !anyLocked && !anyFrames && (
                <button onClick={() => runCommand(() => editor.groupSelection())}>Group</button>
              )}
              {anyGrouped && !anyLocked && (
                <button onClick={() => runCommand(() => editor.ungroupSelection())}>Ungroup</button>
              )}
              <button onClick={() => runCommand(() => editor.setSelectionLocked(!anyLocked))}>
                {anyLocked ? "Unlock selection" : "Lock selection"}
              </button>
            </div>
            {!anyLocked && (
              <>
                <h4>Order</h4>
                <div
                  className="selection-order-actions"
                  role="group"
                  aria-label="Change selection order"
                >
                  {orderActions.map(({ label, direction }) => (
                    <button
                      key={direction}
                      onClick={() => runCommand(() => editor.orderSelection(direction))}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
        {!anyLocked && (
          <nav className="selection-shelf" aria-label="Selection actions">
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
                  : selectedFrame
                    ? "Frame"
                    : selectedConnector
                      ? "Delete connector"
                      : `Delete ${selectedShape?.type === "text" ? "text" : (selectedShape?.kind ?? "rectangle")}`
              }
              onClick={() => editor.removeSelection()}
            >
              <Icon name="trash" />
              <span>Delete</span>
            </button>
            {!multi && selectedShape && (
              <button
                className="selection-action geometry-trigger"
                data-overlay-trigger="geometry"
                aria-label="More properties"
                aria-expanded={geometryOpen}
                onClick={() => onOverlay(geometryOpen ? null : "geometry")}
              >
                <Icon name="settings" />
                <span>Geometry</span>
              </button>
            )}
          </nav>
        )}
      </section>
      {geometryOpen && selectedShape && (
        <section className="selection-popover" role="dialog" aria-label="Precise geometry">
          <header>
            <h2>Precise geometry</h2>
            <button
              className="selection-close"
              aria-label="Close precise geometry"
              onClick={() => onOverlay(null)}
            >
              ×
            </button>
          </header>
          <GeometryFields shape={selectedShape} editor={editor} />
        </section>
      )}
    </div>
  );
}
