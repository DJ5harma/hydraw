import { Icon } from "../../components/icons.tsx";
export function EmptyCanvas({ onStart }: { onStart: () => void }) {
  return (
    <div className="empty-canvas">
      <div className="empty-symbol">
        <span />
        <span />
        <i />
      </div>
      <span className="eyebrow">ROOM TO THINK</span>
      <h1>
        Every idea starts
        <br />
        with a little space.
      </h1>
      <p>Make your first mark. The rest can follow.</p>
      <button className="start-button" onClick={onStart}>
        Draw a rectangle <Icon name="arrow" />
      </button>
      <span className="empty-shortcut">
        or focus the canvas and press <kbd>Enter</kbd>
      </span>
    </div>
  );
}
