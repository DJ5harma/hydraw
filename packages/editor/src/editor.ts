import {
  decodeDocument,
  hitTest,
  MAX_COORDINATE,
  MAX_SHAPES,
  nameTransaction,
  rectangleBetween,
  shapeTransaction,
} from "@hydraw/document";
import type { BoardDocument, DocumentTransaction, Fill, Point, Rectangle } from "@hydraw/document";
import { clamp, hitResizeHandle, screenToWorld } from "./geometry.ts";
import type { ResizeHandle } from "./geometry.ts";
import { previewGesture } from "./gestures.ts";
import type { Gesture } from "./gestures.ts";
import { TransactionHistory } from "./history.ts";
import type { EditorChromeSnapshot, EditorSnapshot, Tool } from "./types.ts";

function chromeSnapshot(snapshot: EditorSnapshot): EditorChromeSnapshot {
  const { document, selectedId, tool, fill, interacting, canUndo, canRedo } = snapshot;
  return {
    document,
    selectedId,
    tool,
    fill,
    interacting,
    canUndo,
    canRedo,
    zoom: snapshot.camera.zoom,
  };
}

/** Coordinates tools and transactions. Geometry, history and browser adapters remain independent. */
export class Editor {
  private snapshot: EditorSnapshot;
  private chrome: EditorChromeSnapshot;
  private listeners = new Set<() => void>();
  private readonly history = new TransactionHistory();
  private gesture: Gesture | null = null;
  private documentLocked = false;
  private readonly makeId: () => string;

  constructor(document: BoardDocument, makeId: () => string = () => crypto.randomUUID()) {
    this.makeId = makeId;
    this.snapshot = {
      document: decodeDocument(document),
      revision: 0,
      selectedId: null,
      tool: "select",
      fill: "#e7eefb",
      camera: { x: 0, y: 0, zoom: 1 },
      preview: null,
      interacting: false,
      activeHandle: null,
      canUndo: false,
      canRedo: false,
    };
    this.chrome = chromeSnapshot(this.snapshot);
  }

  getSnapshot = (): EditorSnapshot => this.snapshot;
  getChromeSnapshot = (): EditorChromeSnapshot => this.chrome;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private publish(patch: Partial<EditorSnapshot>): void {
    this.snapshot = {
      ...this.snapshot,
      ...patch,
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
    };
    const next = chromeSnapshot(this.snapshot);
    if (
      (Object.keys(next) as (keyof EditorChromeSnapshot)[]).some(
        (key) => next[key] !== this.chrome[key],
      )
    )
      this.chrome = next;
    this.listeners.forEach((listener) => listener());
  }

  private assertWritable(): void {
    if (this.documentLocked) throw new Error("A board replacement is in progress.");
  }

  /** Excludes edits while an external replacement is being durably committed. */
  lockDocument(): () => void {
    this.assertWritable();
    this.cancelGesture();
    this.documentLocked = true;
    return () => {
      this.documentLocked = false;
    };
  }

  replaceDocument(next: BoardDocument): void {
    const document = decodeDocument(next);
    this.cancelGesture();
    this.history.clear();
    this.publish({
      document,
      revision: this.snapshot.revision + 1,
      selectedId: null,
      tool: "select",
      camera: { x: 0, y: 0, zoom: 1 },
      preview: null,
      interacting: false,
      activeHandle: null,
    });
  }

  private commit(transaction: DocumentTransaction | null): void {
    if (!transaction) return;
    this.assertWritable();
    const document = this.history.execute(this.snapshot.document, transaction);
    this.publish({ document, revision: this.snapshot.revision + 1 });
  }

  private commitShape(label: string, before: Rectangle | null, after: Rectangle | null): void {
    const index = before
      ? this.snapshot.document.shapes.findIndex((shape) => shape.id === before.id)
      : this.snapshot.document.shapes.length;
    this.commit(shapeTransaction(label, index, before, after));
  }

  setTool(tool: Tool): void {
    this.cancelGesture();
    this.publish({ tool });
  }

  select(id: string | null): void {
    this.cancelGesture();
    this.publish({
      selectedId: this.snapshot.document.shapes.some((shape) => shape.id === id) ? id : null,
      tool: "select",
    });
  }

  setFill(fill: Fill): void {
    this.cancelGesture();
    const shape = this.selectedShape();
    if (shape) this.commitShape("Change fill", shape, { ...shape, fill });
    this.publish({ fill });
  }

  rename(name: string): void {
    this.cancelGesture();
    this.commit(
      nameTransaction(this.snapshot.document.name, name.trim().slice(0, 120) || "Untitled board"),
    );
  }

  private selectedShape(): Rectangle | undefined {
    return this.snapshot.document.shapes.find((shape) => shape.id === this.snapshot.selectedId);
  }

  setGeometry(geometry: Partial<Pick<Rectangle, "x" | "y" | "width" | "height">>): void {
    this.cancelGesture();
    const shape = this.selectedShape();
    if (shape) this.commitShape("Change geometry", shape, { ...shape, ...geometry });
  }

  addRectangle(screen: Point): void {
    this.cancelGesture();
    const { document, camera, fill } = this.snapshot;
    if (document.shapes.length >= MAX_SHAPES) return;
    const point = screenToWorld(screen, camera);
    const shape: Rectangle = {
      id: this.makeId(),
      type: "rectangle",
      x: clamp(point.x - 90, -MAX_COORDINATE, MAX_COORDINATE),
      y: clamp(point.y - 60, -MAX_COORDINATE, MAX_COORDINATE),
      width: 180,
      height: 120,
      fill,
    };
    this.commitShape("Create rectangle", null, shape);
    this.publish({ selectedId: shape.id, tool: "select" });
  }

  nudgeSelection(dx: number, dy: number): void {
    const shape = this.selectedShape();
    if (shape)
      this.setGeometry({
        x: clamp(shape.x + dx, -MAX_COORDINATE, MAX_COORDINATE),
        y: clamp(shape.y + dy, -MAX_COORDINATE, MAX_COORDINATE),
      });
  }

  getResizeHandleAt(screen: Point): ResizeHandle | null {
    const shape = this.selectedShape();
    return shape && this.snapshot.tool === "select"
      ? hitResizeHandle(shape, screen, this.snapshot.camera)
      : null;
  }

  begin(screen: Point, pan = false): void {
    if (this.documentLocked) return;
    this.cancelGesture();
    const { camera, document, tool, fill } = this.snapshot;
    const raw = screenToWorld(screen, camera);
    const point = {
      x: clamp(raw.x, -MAX_COORDINATE, MAX_COORDINATE),
      y: clamp(raw.y, -MAX_COORDINATE, MAX_COORDINATE),
    };
    if (pan || tool === "hand") {
      this.gesture = { kind: "pan", start: screen, camera };
      this.publish({ interacting: true });
    } else if (tool === "rectangle") {
      if (document.shapes.length >= MAX_SHAPES) return;
      const id = this.makeId();
      this.gesture = { kind: "draw", start: point, id };
      this.publish({
        interacting: true,
        selectedId: null,
        preview: rectangleBetween(id, point, point, fill),
      });
    } else {
      const handle = this.getResizeHandleAt(screen);
      const selected = this.selectedShape();
      if (handle && selected) {
        this.gesture = { kind: "resize", start: raw, shape: selected, handle };
        this.publish({ interacting: true, activeHandle: handle });
        return;
      }
      const shape = hitTest(document.shapes, point);
      this.gesture = shape ? { kind: "move", start: point, shape } : null;
      this.publish({ selectedId: shape?.id ?? null, interacting: !!shape });
    }
  }

  move(screen: Point): void {
    if (this.gesture)
      this.publish(previewGesture(this.gesture, screen, this.snapshot.camera, this.snapshot.fill));
  }

  finish(): void {
    const gesture = this.gesture;
    const { preview, camera } = this.snapshot;
    this.gesture = null;
    if (
      gesture?.kind === "draw" &&
      preview &&
      preview.width >= 1 &&
      preview.height >= 1 &&
      preview.width * camera.zoom >= 3 &&
      preview.height * camera.zoom >= 3
    ) {
      this.commitShape("Create rectangle", null, preview);
      this.publish({ selectedId: preview.id, tool: "select" });
    } else if ((gesture?.kind === "move" || gesture?.kind === "resize") && preview) {
      this.commitShape(
        gesture.kind === "resize" ? "Resize rectangle" : "Move rectangle",
        gesture.shape,
        preview,
      );
    }
    this.publish({ preview: null, interacting: false, activeHandle: null });
  }

  cancelGesture(): void {
    if (!this.gesture) return;
    const camera = this.gesture.kind === "pan" ? this.gesture.camera : this.snapshot.camera;
    this.gesture = null;
    this.publish({ preview: null, interacting: false, activeHandle: null, camera });
  }

  pan(dx: number, dy: number): void {
    if (this.gesture) return;
    const camera = this.snapshot.camera;
    this.publish({ camera: { ...camera, x: camera.x + dx, y: camera.y + dy } });
  }

  zoomAt(screen: Point, factor: number): void {
    if (this.gesture || !Number.isFinite(factor) || factor <= 0) return;
    const world = screenToWorld(screen, this.snapshot.camera);
    const zoom = clamp(this.snapshot.camera.zoom * factor, 0.1, 4);
    this.publish({ camera: { x: screen.x - world.x * zoom, y: screen.y - world.y * zoom, zoom } });
  }

  resetCamera(): void {
    this.cancelGesture();
    this.publish({ camera: { x: 0, y: 0, zoom: 1 } });
  }

  removeSelection(): void {
    this.cancelGesture();
    const shape = this.selectedShape();
    if (!shape) return;
    this.commitShape("Delete rectangle", shape, null);
    this.publish({ selectedId: null });
  }

  undo(): void {
    this.restore("undo");
  }
  redo(): void {
    this.restore("redo");
  }

  private restore(direction: "undo" | "redo"): void {
    this.assertWritable();
    this.cancelGesture();
    const document = this.history[direction](this.snapshot.document);
    if (!document) return;
    const selectedId = document.shapes.some((shape) => shape.id === this.snapshot.selectedId)
      ? this.snapshot.selectedId
      : null;
    this.publish({ document, selectedId, revision: this.snapshot.revision + 1 });
  }
}
