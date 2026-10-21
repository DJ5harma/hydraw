import { Icon } from "../../components/icons.tsx";
import "./canvas-controls.css";

export function EmptyCanvas({ onStart }: { onStart: () => void }) {
  return (
    <div className="empty-canvas">
      <h1>Create your first diagram</h1>
      <p>Draw a shape to get started. You can move and style it anytime.</p>
      <button className="start-button" onClick={onStart}>
        Draw a rectangle <Icon name="arrow" />
      </button>
    </div>
  );
}
