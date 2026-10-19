import type { Alignment, DistributionAxis } from "@hydraw/document";
import { Icon } from "../../components/icons.tsx";

const alignments = [
  { id: "left", label: "Align left", icon: "align-left" },
  { id: "horizontal-center", label: "Align horizontal centers", icon: "align-center-x" },
  { id: "right", label: "Align right", icon: "align-right" },
  { id: "top", label: "Align top", icon: "align-top" },
  { id: "vertical-center", label: "Align vertical centers", icon: "align-center-y" },
  { id: "bottom", label: "Align bottom", icon: "align-bottom" },
] as const;

export function ArrangementControls({
  shapeCount,
  onAlign,
  onDistribute,
}: {
  shapeCount: number;
  onAlign: (alignment: Alignment) => void;
  onDistribute: (axis: DistributionAxis) => void;
}) {
  return (
    <section className="inspector-section arrangement-controls">
      <h3>ARRANGE SHAPES</h3>
      <div className="alignment-grid" role="group" aria-label="Align selected shapes">
        {alignments.map((alignment) => (
          <button
            key={alignment.id}
            className="arrange-button"
            aria-label={alignment.label}
            title={shapeCount < 2 ? "Select at least two shapes to align" : alignment.label}
            disabled={shapeCount < 2}
            onClick={() => onAlign(alignment.id)}
          >
            <Icon name={alignment.icon} />
          </button>
        ))}
      </div>
      <h4>Distribute centers</h4>
      <div
        className="distribution-grid"
        role="group"
        aria-label="Distribute selected shape centers"
      >
        {(["horizontal", "vertical"] as const).map((axis) => (
          <button
            key={axis}
            className="arrange-button"
            aria-label={`Distribute centers ${axis}ly`}
            title={
              shapeCount < 3
                ? "Select at least three shapes to distribute"
                : `Distribute centers ${axis}ly`
            }
            disabled={shapeCount < 3}
            onClick={() => onDistribute(axis)}
          >
            <Icon name={axis === "horizontal" ? "distribute-x" : "distribute-y"} />
            <span>{axis === "horizontal" ? "Horizontal" : "Vertical"}</span>
          </button>
        ))}
      </div>
      <p className="inspector-note">
        {shapeCount < 2
          ? "Select at least two rectangles or text objects to align, or three to distribute."
          : "Align to selected shape bounds. Distribute with equal center spacing; outer shapes stay fixed. Attached arrows follow."}
      </p>
    </section>
  );
}
