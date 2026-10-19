import {
  decodeDocument,
  decodeText,
  MAX_TEXT_LENGTH,
  hitTest,
  MAX_COORDINATE,
  MAX_SHAPES,
  nameTransaction,
  rectangleBetween,
  shapeTransaction,
} from "@hydraw/document";
import type {
  BoardDocument,
  DocumentTransaction,
  Bounds,
  Fill,
  Point,
  Rectangle,
  Shape,
  TextShape,
} from "@hydraw/document";
import { clamp, hitResizeHandle, screenToWorld } from "./geometry.ts";
import type { ResizeHandle } from "./geometry.ts";
import { previewGesture } from "./gestures.ts";
import type { Gesture } from "./gestures.ts";
import { layoutText } from "./text-layout.ts";
import type { TextMeasurer } from "./text-layout.ts";
import { TransactionHistory } from "./history.ts";
import type { EditorChromeSnapshot, EditorSnapshot, Tool } from "./types.ts";

function chromeSnapshot(snapshot: EditorSnapshot): EditorChromeSnapshot {
  const { document, selectedId, tool, fill, interacting, textEditing, canUndo, canRedo } = snapshot;
  return {
    document,
    selectedId,
    tool,
    fill,
    interacting,
    textEditing,
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
  private readonly measureText: TextMeasurer | undefined;
  private readonly makeId: () => string;

  constructor(
    document: BoardDocument,
    makeId: () => string = () => crypto.randomUUID(),
    measureText?: TextMeasurer,
  ) {
    this.makeId = makeId;
    this.measureText = measureText;
    this.snapshot = {
      document: this.prepareDocument(document),
      revision: 0,
      selectedId: null,
      tool: "select",
      fill: "#e7eefb",
      camera: { x: 0, y: 0, zoom: 1 },
      preview: null,
      textEditing: null,
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
  lockDocument(): Readonly<{ replace: (document: BoardDocument) => void; release: () => void }> {
    this.assertWritable();
    this.finishTextEditing();
    this.cancelGesture();
    this.documentLocked = true;
    let active = true;
    return {
      replace: (document) => {
        if (!active) throw new Error("This replacement lock has been released.");
        this.replaceDocument(document);
      },
      release: () => {
        if (!active) return;
        active = false;
        this.documentLocked = false;
      },
    };
  }

  /** Canonicalize imported text bounds using this editor's injected font metrics before saving. */
  prepareDocument(value: unknown): BoardDocument {
    const document = decodeDocument(value);
    return Object.freeze({
      ...document,
      shapes: Object.freeze(
        document.shapes.map((shape) => (shape.type === "text" ? this.fitText(shape) : shape)),
      ),
    });
  }

  private replaceDocument(next: BoardDocument): void {
    const document = this.prepareDocument(next);
    this.cancelGesture();
    this.history.clear();
    this.publish({
      document,
      revision: this.snapshot.revision + 1,
      selectedId: null,
      tool: "select",
      camera: { x: 0, y: 0, zoom: 1 },
      preview: null,
      textEditing: null,
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

  private commitShape(label: string, before: Shape | null, after: Shape | null): void {
    const index = before
      ? this.snapshot.document.shapes.findIndex((shape) => shape.id === before.id)
      : this.snapshot.document.shapes.length;
    this.commit(shapeTransaction(label, index, before, after));
  }

  setTool(tool: Tool): void {
    this.finishTextEditing();
    this.cancelGesture();
    this.publish({ tool });
  }

  select(id: string | null): void {
    this.finishTextEditing();
    this.cancelGesture();
    this.publish({
      selectedId: this.snapshot.document.shapes.some((shape) => shape.id === id) ? id : null,
      tool: "select",
    });
  }

  setFill(fill: Fill): void {
    this.finishTextEditing();
    this.cancelGesture();
    const shape = this.selectedShape();
    if (shape?.type === "rectangle") this.commitShape("Change fill", shape, { ...shape, fill });
    this.publish({ fill });
  }

  rename(name: string): void {
    this.finishTextEditing();
    this.cancelGesture();
    this.commit(
      nameTransaction(this.snapshot.document.name, name.trim().slice(0, 120) || "Untitled board"),
    );
  }

  private selectedShape(): Shape | undefined {
    return this.snapshot.document.shapes.find((shape) => shape.id === this.snapshot.selectedId);
  }

  setGeometry(geometry: Partial<Bounds>): void {
    this.finishTextEditing();
    this.cancelGesture();
    const shape = this.selectedShape();
    if (shape) {
      const next = { ...shape, ...geometry };
      this.commitShape("Change geometry", shape, next.type === "text" ? this.fitText(next) : next);
    }
  }

  addRectangle(screen: Point): void {
    this.finishTextEditing();
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

  private fitText(shape: TextShape): TextShape {
    const valid = decodeText(shape);
    if (!this.measureText) throw new Error("Text editing requires a text measurement adapter.");
    return decodeText({ ...valid, height: layoutText(valid, this.measureText).height });
  }

  addText(screen: Point): void {
    this.assertWritable();
    this.finishTextEditing();
    this.cancelGesture();
    if (this.snapshot.document.shapes.length >= MAX_SHAPES) return;
    const point = screenToWorld(screen, this.snapshot.camera);
    const draft = this.fitText({
      id: this.makeId(),
      type: "text",
      text: "",
      x: clamp(point.x, -MAX_COORDINATE, MAX_COORDINATE),
      y: clamp(point.y, -MAX_COORDINATE, MAX_COORDINATE),
      width: 280,
      height: 42,
      fontSize: 24,
      fontWeight: 400,
      textAlign: "left",
      color: "#243e33",
    });
    this.publish({ selectedId: null, tool: "select", textEditing: { before: null, draft } });
  }

  editTextAt(screen: Point): void {
    const shape = hitTest(
      this.snapshot.document.shapes,
      screenToWorld(screen, this.snapshot.camera),
    );
    if (shape?.type === "text") this.editText(shape.id);
  }

  editText(id = this.snapshot.selectedId): void {
    this.assertWritable();
    this.finishTextEditing();
    this.cancelGesture();
    const shape = this.snapshot.document.shapes.find((shape) => shape.id === id);
    if (shape?.type === "text")
      this.publish({
        selectedId: id,
        tool: "select",
        textEditing: { before: shape, draft: shape },
      });
  }

  updateTextDraft(text: string): void {
    const editing = this.snapshot.textEditing;
    if (!editing) return;
    const normalized = text.replace(/\r\n?/gu, "\n").replace(/\t/gu, "    ");
    if (normalized.length > MAX_TEXT_LENGTH)
      throw new Error(`Text must be at most ${MAX_TEXT_LENGTH} characters.`);
    const draft = this.fitText({ ...editing.draft, text: normalized });
    this.publish({ textEditing: { ...editing, draft } });
  }

  finishTextEditing(): void {
    const editing = this.snapshot.textEditing;
    if (!editing) return;
    this.assertWritable();
    const { before, draft } = editing;
    const after = draft.text.trim() ? draft : null;
    this.commitShape(before ? "Edit text" : "Create text", before, after);
    this.publish({ textEditing: null, selectedId: after?.id ?? null });
  }

  cancelTextEditing(): void {
    const editing = this.snapshot.textEditing;
    if (editing) this.publish({ textEditing: null, selectedId: editing.before?.id ?? null });
  }

  setTextStyle(
    style: Partial<Pick<TextShape, "fontSize" | "fontWeight" | "textAlign" | "color">>,
  ): void {
    this.finishTextEditing();
    this.cancelGesture();
    const shape = this.selectedShape();
    if (shape?.type === "text")
      this.commitShape("Style text", shape, this.fitText({ ...shape, ...style }));
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
    this.finishTextEditing();
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
    } else if (tool === "text") {
      const shape = hitTest(document.shapes, point);
      if (shape?.type === "text") this.editText(shape.id);
      else this.addText(screen);
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
    if (this.gesture) {
      const patch = previewGesture(this.gesture, screen, this.snapshot.camera, this.snapshot.fill);
      this.publish(
        this.gesture.kind === "resize" && patch.preview?.type === "text"
          ? { ...patch, preview: this.fitText(patch.preview) }
          : patch,
      );
    }
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
        gesture.kind === "resize" ? "Resize object" : "Move object",
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
    this.finishTextEditing();
    this.cancelGesture();
    const shape = this.selectedShape();
    if (!shape) return;
    this.commitShape("Delete object", shape, null);
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
    this.cancelTextEditing();
    this.cancelGesture();
    const document = this.history[direction](this.snapshot.document);
    if (!document) return;
    const selectedId = document.shapes.some((shape) => shape.id === this.snapshot.selectedId)
      ? this.snapshot.selectedId
      : null;
    this.publish({ document, selectedId, revision: this.snapshot.revision + 1 });
  }
}
