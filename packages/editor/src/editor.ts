import {
  decodeDocument,
  expandGroups,
  groupObjectsTransaction,
  ungroupObjectsTransaction,
  setObjectsLockedTransaction,
  reorderObjectsTransaction,
  decodeLabel,
  rectangleAppearance,
  alignShapesTransaction,
  distributeShapesTransaction,
  deleteObjectsTransaction,
  duplicateObjects,
  translateObjects,
  updateObjectsTransaction,
  connectorTransaction,
  deleteShapeTransaction,
  MAX_CONNECTORS,
  MAX_ENDPOINT_COORDINATE,
  resolveConnector,
  decodeText,
  MAX_TEXT_LENGTH,
  MAX_COORDINATE,
  MAX_SHAPES,
  nameTransaction,
  shapeTransaction,
} from "@hydraw/document";
import type {
  Alignment,
  DistributionAxis,
  Connector,
  BoardDocument,
  DocumentTransaction,
  Bounds,
  Fill,
  Point,
  Rectangle,
  RectangleAppearance,
  ShapeKind,
  OrderDirection,
  Shape,
  TextShape,
} from "@hydraw/document";
import { labelTextShape } from "./labels.ts";
import { hitSceneObject, hitConnectorEnd } from "./connector-interactions.ts";
import type { ConnectorEnd } from "./connector-interactions.ts";
import { clamp, hitResizeHandle, screenToWorld } from "./geometry.ts";
import type { ResizeHandle } from "./geometry.ts";
import { createClipboardFragment, pastedSelection } from "./clipboard.ts";
import { IDLE_GESTURE, previewGesture, startGesture } from "./gestures.ts";
import type { Gesture } from "./gestures.ts";
import { objectIds, selectionBounds } from "./selection.ts";
import { fittedCamera, MIN_ZOOM, MAX_ZOOM } from "./viewport.ts";
import { layoutText } from "./text-layout.ts";
import type { TextMeasurer } from "./text-layout.ts";
import { TransactionHistory } from "./history.ts";
import type { EditorChromeSnapshot, EditorSnapshot, Tool } from "./types.ts";

function chromeSnapshot(snapshot: EditorSnapshot): EditorChromeSnapshot {
  const {
    document,
    selectedId,
    selectedIds,
    tool,
    fill,
    shapeKind,
    interacting,
    textEditing,
    canUndo,
    canRedo,
  } = snapshot;
  return {
    document,
    selectedId,
    selectedIds,
    tool,
    fill,
    shapeKind,
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
      selectedIds: Object.freeze([]),
      selectedId: null,
      tool: "select",
      fill: "#e7eefb",
      shapeKind: "rectangle",
      camera: { x: 0, y: 0, zoom: 1 },
      connectorPreview: null,
      bindingTargetId: null,
      activeEndpoint: null,
      preview: null,
      selectionPreview: null,
      marquee: null,
      textEditing: null,
      guides: [],
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

  private publish(patch: Partial<Omit<EditorSnapshot, "selectedId">>): void {
    let selectedIds = patch.selectedIds ?? this.snapshot.selectedIds;
    if (patch.selectedIds || patch.document)
      selectedIds = expandGroups(patch.document ?? this.snapshot.document, selectedIds);
    if (patch.document) {
      const valid = new Set(objectIds(patch.document));
      selectedIds = selectedIds.filter((id) => valid.has(id));
    }
    if (
      selectedIds.length === this.snapshot.selectedIds.length &&
      selectedIds.every((id, index) => id === this.snapshot.selectedIds[index])
    )
      selectedIds = this.snapshot.selectedIds;
    else selectedIds = Object.freeze([...selectedIds]);
    this.snapshot = {
      ...this.snapshot,
      ...patch,
      selectedIds,
      selectedId: selectedIds.length === 1 ? selectedIds[0]! : null,
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

  private selectionLocked(ids = this.snapshot.selectedIds): boolean {
    const selected = new Set(expandGroups(this.snapshot.document, ids));
    return [...this.snapshot.document.shapes, ...this.snapshot.document.connectors].some(
      (item) => selected.has(item.id) && item.locked,
    );
  }

  private creationRank(front: boolean): number {
    let rank = 0;
    for (const object of [...this.snapshot.document.shapes, ...this.snapshot.document.connectors])
      rank = front ? Math.max(rank, object.zIndex ?? 0) : Math.min(rank, object.zIndex ?? 0);
    return Math.max(-1_000_000_000, Math.min(1_000_000_000, rank + (front ? 1 : -1)));
  }

  groupSelection(): void {
    this.finishTextEditing();
    this.cancelGesture();
    const { document, selectedIds } = this.snapshot;
    const objects = [...document.shapes, ...document.connectors].filter((item) =>
      selectedIds.includes(item.id),
    );
    if (
      objects.length < 2 ||
      this.selectionLocked() ||
      objects.every((item) => item.groupId && item.groupId === objects[0]!.groupId)
    )
      return;
    const groupId = this.makeId();
    if (
      objects.some((item) => item.id === groupId) ||
      [...document.shapes, ...document.connectors].some(
        (item) => item.groupId === groupId || item.id === groupId,
      )
    )
      throw new Error("Could not create a unique group identity.");
    this.commit(groupObjectsTransaction(document, selectedIds, groupId));
  }
  ungroupSelection(): void {
    this.finishTextEditing();
    this.cancelGesture();
    this.commit(ungroupObjectsTransaction(this.snapshot.document, this.snapshot.selectedIds));
  }
  setSelectionLocked(locked: boolean): void {
    this.finishTextEditing();
    this.cancelGesture();
    this.commit(
      setObjectsLockedTransaction(this.snapshot.document, this.snapshot.selectedIds, locked),
    );
  }
  orderSelection(direction: OrderDirection): void {
    this.finishTextEditing();
    this.cancelGesture();
    this.commit(
      reorderObjectsTransaction(this.snapshot.document, this.snapshot.selectedIds, direction),
    );
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
      selectedIds: [],
      tool: "select",
      camera: { x: 0, y: 0, zoom: 1 },
      connectorPreview: null,
      bindingTargetId: null,
      activeEndpoint: null,
      preview: null,
      selectionPreview: null,
      marquee: null,
      textEditing: null,
      guides: [],
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
    if (before && !after) {
      this.commit(deleteShapeTransaction(this.snapshot.document, before.id));
      return;
    }
    const index = before
      ? this.snapshot.document.shapes.findIndex((shape) => shape.id === before.id)
      : this.snapshot.document.shapes.length;
    this.commit(shapeTransaction(label, index, before, after));
  }

  private selectedConnector(): Connector | undefined {
    return this.snapshot.document.connectors.find(
      (connector) => connector.id === this.snapshot.selectedId,
    );
  }

  private commitConnector(label: string, before: Connector | null, after: Connector | null): void {
    const index = before
      ? this.snapshot.document.connectors.findIndex((connector) => connector.id === before.id)
      : this.snapshot.document.connectors.length;
    this.commit(connectorTransaction(label, index, before, after));
  }

  addConnector(screen: Point): void {
    this.finishTextEditing();
    this.cancelGesture();
    if (this.snapshot.document.connectors.length >= MAX_CONNECTORS) return;
    const point = screenToWorld(screen, this.snapshot.camera);
    const x = clamp(point.x, -MAX_ENDPOINT_COORDINATE + 80, MAX_ENDPOINT_COORDINATE - 80);
    const y = clamp(point.y, -MAX_ENDPOINT_COORDINATE, MAX_ENDPOINT_COORDINATE);
    const connector: Connector = {
      id: this.makeId(),
      type: "connector",
      zIndex: this.creationRank(false),
      start: { type: "point", x: x - 80, y },
      end: { type: "point", x: x + 80, y },
      color: "#243e33",
      arrowhead: "arrow",
    };
    this.commitConnector("Create connector", null, connector);
    this.publish({ selectedIds: [connector.id], tool: "select" });
  }

  setConnectorStyle(style: Partial<Pick<Connector, "color" | "arrowhead">>): void {
    if (this.selectionLocked()) return;
    this.cancelGesture();
    const connector = this.selectedConnector();
    if (connector) this.commitConnector("Style connector", connector, { ...connector, ...style });
  }

  reverseConnector(): void {
    if (this.selectionLocked()) return;
    this.cancelGesture();
    const connector = this.selectedConnector();
    if (connector)
      this.commitConnector("Reverse connector", connector, {
        ...connector,
        start: connector.end,
        end: connector.start,
      });
  }

  detachConnector(): void {
    if (this.selectionLocked()) return;
    this.cancelGesture();
    const connector = this.selectedConnector();
    if (!connector) return;
    const ends = resolveConnector(connector, this.snapshot.document.shapes);
    this.commitConnector("Detach connector", connector, {
      ...connector,
      start: { type: "point", ...ends.start },
      end: { type: "point", ...ends.end },
    });
  }

  getConnectorEndpointAt(screen: Point): ConnectorEnd | null {
    const connector = this.selectionLocked() ? undefined : this.selectedConnector();
    return connector && this.snapshot.tool === "select"
      ? hitConnectorEnd(connector, this.snapshot.document.shapes, screen, this.snapshot.camera)
      : null;
  }

  setShapeKind(shapeKind: ShapeKind): void {
    if (!["rectangle", "ellipse", "diamond"].includes(shapeKind))
      throw new Error("Unknown shape kind.");
    this.finishTextEditing();
    this.cancelGesture();
    this.publish({ shapeKind, tool: "rectangle" });
  }

  setTool(tool: Tool): void {
    this.finishTextEditing();
    this.cancelGesture();
    this.publish({ tool });
  }

  select(id: string | null, additive = false): void {
    this.finishTextEditing();
    this.cancelGesture();
    const valid = id !== null && objectIds(this.snapshot.document).includes(id);
    const current = this.snapshot.selectedIds;
    const group = valid ? expandGroups(this.snapshot.document, [id!]) : [];
    const toggled = current.includes(id!)
      ? current.filter((item) => !group.includes(item))
      : [...new Set([...current, ...group])];
    this.publish({
      selectedIds: !valid ? (additive ? current : []) : additive ? toggled : group,
      tool: "select",
    });
  }

  selectMany(ids: readonly string[]): void {
    this.finishTextEditing();
    this.cancelGesture();
    const valid = new Set(objectIds(this.snapshot.document));
    this.publish({ selectedIds: [...new Set(ids)].filter((id) => valid.has(id)), tool: "select" });
  }

  selectAll(): void {
    this.finishTextEditing();
    this.cancelGesture();
    const objects = [...this.snapshot.document.shapes, ...this.snapshot.document.connectors];
    const lockedGroups = new Set(
      objects.filter((item) => item.locked && item.groupId).map((item) => item.groupId),
    );
    this.publish({
      selectedIds: objects
        .filter((item) => !item.locked && (!item.groupId || !lockedGroups.has(item.groupId)))
        .map((item) => item.id),
      tool: "select",
    });
  }

  copySelection(): string | null {
    return createClipboardFragment(this.snapshot.document, this.snapshot.selectedIds);
  }

  pasteSelection(serialized: string, screen: Point): void {
    this.assertWritable();
    this.finishTextEditing();
    this.cancelGesture();
    const result = pastedSelection(
      this.snapshot.document,
      serialized,
      this.makeId,
      screenToWorld(screen, this.snapshot.camera),
    );
    if (!result.transaction) return;
    const transaction = {
      ...result.transaction,
      changes: result.transaction.changes.map((change) =>
        change.type === "shape" && change.after?.type === "text"
          ? { ...change, after: this.fitText(change.after) }
          : change,
      ),
    };
    this.commit(transaction);
    this.publish({ selectedIds: result.ids, tool: "select" });
  }

  duplicateSelection(): void {
    if (this.selectionLocked()) return;
    this.assertWritable();
    this.finishTextEditing();
    this.cancelGesture();
    const result = duplicateObjects(this.snapshot.document, this.snapshot.selectedIds, this.makeId);
    this.commit(result.transaction);
    if (result.transaction) this.publish({ selectedIds: result.ids, tool: "select" });
  }

  alignSelection(alignment: Alignment): void {
    if (
      this.selectionLocked() ||
      [...this.snapshot.document.shapes, ...this.snapshot.document.connectors].some(
        (item) => this.snapshot.selectedIds.includes(item.id) && item.groupId,
      )
    )
      return;
    this.assertWritable();
    this.finishTextEditing();
    this.cancelGesture();
    this.commit(
      alignShapesTransaction(this.snapshot.document, this.snapshot.selectedIds, alignment),
    );
  }

  distributeSelection(axis: DistributionAxis): void {
    if (
      this.selectionLocked() ||
      [...this.snapshot.document.shapes, ...this.snapshot.document.connectors].some(
        (item) => this.snapshot.selectedIds.includes(item.id) && item.groupId,
      )
    )
      return;
    this.assertWritable();
    this.finishTextEditing();
    this.cancelGesture();
    this.commit(
      distributeShapesTransaction(this.snapshot.document, this.snapshot.selectedIds, axis),
    );
  }

  setFill(fill: Fill): void {
    if (this.selectionLocked()) return;
    this.finishTextEditing();
    this.cancelGesture();
    const shape = this.selectedShape();
    if (shape?.type === "rectangle") this.commitShape("Change fill", shape, { ...shape, fill });
    this.publish({ fill });
  }

  setRectangleStyle(style: Partial<RectangleAppearance>): void {
    if (this.selectionLocked()) return;
    this.finishTextEditing();
    this.cancelGesture();
    const shape = this.selectedShape();
    if (shape?.type === "rectangle")
      this.commitShape("Style rectangle", shape, {
        ...shape,
        appearance: { ...rectangleAppearance(shape), ...style },
      });
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
    if (this.selectionLocked()) return;
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
      zIndex: this.creationRank(true),
      x: clamp(point.x - 90, -MAX_COORDINATE, MAX_COORDINATE),
      y: clamp(point.y - 60, -MAX_COORDINATE, MAX_COORDINATE),
      width: 180,
      height: 120,
      fill,
      ...(this.snapshot.shapeKind === "rectangle" ? {} : { kind: this.snapshot.shapeKind }),
    };
    this.commitShape("Create rectangle", null, shape);
    this.publish({ selectedIds: [shape.id], tool: "select" });
  }

  private fitText(shape: TextShape): TextShape {
    const valid = decodeText(shape);
    if (!this.measureText) throw new Error("Text editing requires a text measurement adapter.");
    return decodeText({ ...valid, height: layoutText(valid, this.measureText).height });
  }

  addText(screen: Point, placement: "start" | "center" = "start"): void {
    this.assertWritable();
    this.finishTextEditing();
    this.cancelGesture();
    if (this.snapshot.document.shapes.length >= MAX_SHAPES) return;
    const point = screenToWorld(screen, this.snapshot.camera);
    const draft = this.fitText({
      id: this.makeId(),
      type: "text",
      zIndex: this.creationRank(true),
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
    const positioned =
      placement === "center"
        ? decodeText({
            ...draft,
            x: clamp(point.x - draft.width / 2, -MAX_COORDINATE, MAX_COORDINATE),
            y: clamp(point.y - draft.height / 2, -MAX_COORDINATE, MAX_COORDINATE),
          })
        : draft;
    this.publish({
      selectedIds: [],
      tool: "select",
      textEditing: { before: null, draft: positioned },
    });
  }

  editTextAt(screen: Point): void {
    const object = hitSceneObject(
      this.snapshot.document,
      screenToWorld(screen, this.snapshot.camera),
      7 / this.snapshot.camera.zoom,
    );
    if (object) this.editText(object.id);
  }

  editText(id = this.snapshot.selectedId): void {
    if (id && this.selectionLocked([id])) return;
    this.assertWritable();
    this.finishTextEditing();
    this.cancelGesture();
    const shape = this.snapshot.document.shapes.find((shape) => shape.id === id);
    if (shape?.type === "text") {
      this.publish({
        selectedIds: [shape.id],
        tool: "select",
        textEditing: { before: shape, draft: shape },
      });
      return;
    }
    const owner = shape ?? this.snapshot.document.connectors.find((item) => item.id === id);
    if (!owner) return;
    if (!this.measureText) throw new Error("Label editing requires text measurement.");
    const draft = labelTextShape(
      {
        ...owner,
        label: owner.label ?? { text: "", fontSize: 20, fontWeight: 400, color: "#243e33" },
      },
      this.snapshot.document.shapes,
      this.measureText,
    )!;
    this.publish({
      selectedIds: [owner.id],
      tool: "select",
      textEditing: { before: owner.label ? draft : null, draft, ownerId: owner.id },
    });
  }

  updateTextDraft(text: string): void {
    const editing = this.snapshot.textEditing;
    if (!editing) return;
    const normalized = text.replace(/\r\n?/gu, "\n").replace(/\t/gu, "    ");
    if (normalized.length > MAX_TEXT_LENGTH)
      throw new Error(`Text must be at most ${MAX_TEXT_LENGTH} characters.`);
    const content = { ...editing.draft, text: normalized };
    if (editing.ownerId) decodeLabel(content);
    let draft: TextShape;
    if (editing.ownerId && this.measureText) {
      const owner =
        this.snapshot.document.shapes.find((item) => item.id === editing.ownerId) ??
        this.snapshot.document.connectors.find((item) => item.id === editing.ownerId);
      if (!owner || owner.type === "text") return;
      draft = labelTextShape(
        { ...owner, label: decodeLabel(content) },
        this.snapshot.document.shapes,
        this.measureText,
      )!;
    } else draft = this.fitText(content);
    this.publish({ textEditing: { ...editing, draft } });
  }

  finishTextEditing(): void {
    const editing = this.snapshot.textEditing;
    if (!editing) return;
    this.assertWritable();
    const { before, draft } = editing;
    if (editing.ownerId) {
      const owner =
        this.snapshot.document.shapes.find((item) => item.id === editing.ownerId) ??
        this.snapshot.document.connectors.find((item) => item.id === editing.ownerId);
      if (owner && owner.type !== "text") {
        const { label: _oldLabel, ...rest } = owner;
        const label = draft.text.trim() ? decodeLabel(draft) : undefined;
        const next = label ? { ...rest, label } : rest;
        if (owner.type === "connector")
          this.commitConnector("Edit connector label", owner, next as Connector);
        else this.commitShape("Edit shape label", owner, next as Rectangle);
      }
      this.publish({ textEditing: null, selectedIds: owner ? [owner.id] : [] });
      return;
    }
    const after = draft.text.trim() ? draft : null;
    this.commitShape(before ? "Edit text" : "Create text", before, after);
    this.publish({ textEditing: null, selectedIds: after ? [after.id] : [] });
  }

  cancelTextEditing(): void {
    const editing = this.snapshot.textEditing;
    if (editing)
      this.publish({
        textEditing: null,
        selectedIds: editing.ownerId
          ? [editing.ownerId]
          : editing.before
            ? [editing.before.id]
            : [],
      });
  }

  setTextStyle(
    style: Partial<Pick<TextShape, "fontSize" | "fontWeight" | "textAlign" | "color">>,
  ): void {
    if (this.selectionLocked()) return;
    this.finishTextEditing();
    this.cancelGesture();
    const shape = this.selectedShape();
    if (shape?.type === "text")
      this.commitShape("Style text", shape, this.fitText({ ...shape, ...style }));
  }

  nudgeSelection(dx: number, dy: number): void {
    if (this.selectionLocked()) return;
    this.finishTextEditing();
    this.cancelGesture();
    const connector = this.selectedConnector();
    if (connector && (connector.start.type === "binding" || connector.end.type === "binding"))
      return;
    const updates = translateObjects(this.snapshot.document, this.snapshot.selectedIds, {
      x: dx,
      y: dy,
    });
    this.commit(updateObjectsTransaction(this.snapshot.document, "Move selection", updates));
  }

  getResizeHandleAt(screen: Point): ResizeHandle | null {
    const shape = this.selectionLocked() ? undefined : this.selectedShape();
    return shape && this.snapshot.tool === "select"
      ? hitResizeHandle(shape, screen, this.snapshot.camera)
      : null;
  }

  begin(screen: Point, pan = false, additive = false): void {
    if (this.documentLocked) return;
    this.finishTextEditing();
    this.cancelGesture();
    if (!pan && this.snapshot.tool === "text") {
      const object = hitSceneObject(
        this.snapshot.document,
        screenToWorld(screen, this.snapshot.camera),
        7 / this.snapshot.camera.zoom,
      );
      if (object) this.editText(object.id);
      else this.addText(screen);
      return;
    }
    const start = startGesture(this.snapshot, screen, this.makeId, pan, additive);
    if (!start) return;
    this.gesture = start.gesture;
    this.publish(this.rankCreationPreview(start.patch));
  }

  private rankCreationPreview(patch: Partial<EditorSnapshot>): Partial<EditorSnapshot> {
    if (this.gesture?.kind === "draw" && patch.preview)
      return { ...patch, preview: { ...patch.preview, zIndex: this.creationRank(true) } };
    if (this.gesture?.kind === "connect" && patch.connectorPreview)
      return {
        ...patch,
        connectorPreview: { ...patch.connectorPreview, zIndex: this.creationRank(false) },
      };
    return patch;
  }

  move(screen: Point, snapping = true): void {
    if (!this.gesture) return;
    const patch = this.rankCreationPreview(
      previewGesture(
        this.gesture,
        screen,
        this.snapshot.camera,
        this.snapshot.fill,
        this.snapshot.document,
        snapping,
      ),
    );
    this.publish(
      this.gesture.kind === "resize" && patch.preview?.type === "text"
        ? { ...patch, preview: this.fitText(patch.preview) }
        : patch,
    );
  }

  finish(): void {
    const gesture = this.gesture;
    const { preview, camera, connectorPreview, selectionPreview } = this.snapshot;
    this.gesture = null;
    try {
      if (gesture?.kind === "move-selection" && selectionPreview) {
        this.commit(
          updateObjectsTransaction(this.snapshot.document, "Move selection", selectionPreview),
        );
      } else if (
        (gesture?.kind === "connect" || gesture?.kind === "reconnect") &&
        connectorPreview
      ) {
        const selfBound =
          connectorPreview.start.type === "binding" &&
          connectorPreview.end.type === "binding" &&
          connectorPreview.start.shapeId === connectorPreview.end.shapeId;
        const ends = resolveConnector(connectorPreview, this.snapshot.document.shapes);
        if (
          !selfBound &&
          (gesture.kind !== "connect" ||
            Math.hypot(ends.end.x - ends.start.x, ends.end.y - ends.start.y) * camera.zoom >= 6)
        ) {
          this.commitConnector(
            gesture.kind === "connect" ? "Create connector" : "Reconnect endpoint",
            gesture.kind === "connect" ? null : gesture.connector,
            gesture.kind === "connect"
              ? { ...connectorPreview, zIndex: this.creationRank(false) }
              : connectorPreview,
          );
          this.publish({ selectedIds: [connectorPreview.id], tool: "select" });
        }
      } else if (
        gesture?.kind === "draw" &&
        preview &&
        preview.width >= 1 &&
        preview.height >= 1 &&
        preview.width * camera.zoom >= 3 &&
        preview.height * camera.zoom >= 3
      ) {
        this.commitShape("Create rectangle", null, { ...preview, zIndex: this.creationRank(true) });
        this.publish({ selectedIds: [preview.id], tool: "select" });
      } else if (gesture?.kind === "resize" && preview) {
        this.commitShape("Resize object", gesture.shape, preview);
      }
    } finally {
      this.publish(IDLE_GESTURE);
    }
  }

  cancelGesture(): void {
    if (!this.gesture) return;
    const selectedIds =
      this.gesture.kind === "marquee" ? this.gesture.before : this.snapshot.selectedIds;
    const camera = this.gesture.kind === "pan" ? this.gesture.camera : this.snapshot.camera;
    this.gesture = null;
    this.publish({
      ...IDLE_GESTURE,
      camera,
      selectedIds,
    });
  }

  pan(dx: number, dy: number): void {
    if (this.gesture) return;
    const camera = this.snapshot.camera;
    this.publish({ camera: { ...camera, x: camera.x + dx, y: camera.y + dy } });
  }

  zoomAt(screen: Point, factor: number): void {
    if (this.gesture || !Number.isFinite(factor) || factor <= 0) return;
    const world = screenToWorld(screen, this.snapshot.camera);
    const zoom = clamp(this.snapshot.camera.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    this.publish({ camera: { x: screen.x - world.x * zoom, y: screen.y - world.y * zoom, zoom } });
  }

  /** Camera-only navigation; viewport excludes the adapter's floating controls. */
  fitView(viewport: Bounds, selectionOnly = false): void {
    this.finishTextEditing();
    this.cancelGesture();
    const { document, selectedIds } = this.snapshot;
    const bounds = selectionBounds(
      document.shapes,
      document.connectors,
      selectionOnly ? selectedIds : objectIds(document),
    );
    if (!bounds) {
      if (!selectionOnly) this.resetCamera();
      return;
    }
    const camera = fittedCamera(bounds, viewport);
    if (camera) this.publish({ camera });
  }

  resetCamera(): void {
    this.cancelGesture();
    this.publish({ camera: { x: 0, y: 0, zoom: 1 } });
  }

  removeSelection(): void {
    if (this.selectionLocked()) return;
    this.finishTextEditing();
    this.cancelGesture();
    this.commit(deleteObjectsTransaction(this.snapshot.document, this.snapshot.selectedIds));
    this.publish({ selectedIds: [] });
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
    this.publish({ document, revision: this.snapshot.revision + 1 });
  }
}
