import {
  detachConnectorBindings,
  insertImages,
  makeInkShape,
  recognizeInk,
  simplifyInkPoints,
  MAX_INK_POINTS,
  isTextColor,
  isFill,
  imageCropTransaction,
  boardTheme,
  boardThemeTransaction,
  themePalette,
  createFrameAroundSelection,
  frameSelectionContents,
  isFrame,
  insertPreset,
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
  MAX_SIZE,
  nameTransaction,
  shapeTransaction,
} from "@hydraw/document";
import type {
  PresetId,
  ImageInput,
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
  BoardTheme,
  OrderDirection,
  Shape,
  TextColor,
  ImageCrop,
  TextShape,
} from "@hydraw/document";
import { labelTextShape } from "./labels.ts";
import {
  hitSceneObject,
  hitConnectorEnd,
  hitConnectorBend,
  connectionHandleAt,
} from "./connector-interactions.ts";
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
import { DocumentSession } from "./document-session.ts";
import type { DocumentCommit, SessionOperation } from "./document-session.ts";
import { reconcileExternalChange } from "./reconciliation.ts";
import type { EditorChromeSnapshot, EditorSnapshot, Tool } from "./types.ts";
import { erasedObjects, ERASER_RADIUS_SCREEN } from "./eraser.ts";

function chromeSnapshot(snapshot: EditorSnapshot): EditorChromeSnapshot {
  const {
    document,
    selectedId,
    selectedIds,
    tool,
    fill,
    shapeKind,
    inkColor,
    inkWidth,
    interacting,
    textEditing,
    canUndo,
    canRedo,
    historyWarning,
    interactionNotice,
    recoveredTextDrafts,
  } = snapshot;
  return {
    document,
    selectedId,
    selectedIds,
    tool,
    fill,
    shapeKind,
    inkColor,
    inkWidth,
    interacting,
    textEditing,
    canUndo,
    canRedo,
    historyWarning,
    interactionNotice,
    recoveredTextDrafts,
    zoom: snapshot.camera.zoom,
  };
}

/** Coordinates tools and transactions. Geometry, history and browser adapters remain independent. */
export class Editor {
  private snapshot: EditorSnapshot;
  private chrome: EditorChromeSnapshot;
  private listeners = new Set<() => void>();
  readonly documentSession: DocumentSession;
  private readonly disconnectSession: () => void;
  private gesture: Gesture | null = null;
  private documentEpoch = 0;
  getDocumentEpoch = (): number => this.documentEpoch;
  private readonly measureText: TextMeasurer | undefined;
  private readonly makeId: () => string;

  constructor(
    document: BoardDocument,
    makeId: () => string = () => crypto.randomUUID(),
    measureText?: TextMeasurer,
    boardId = "local",
  ) {
    this.makeId = makeId;
    this.measureText = measureText;
    this.documentSession = new DocumentSession(document, boardId);
    this.snapshot = {
      document: this.documentSession.getSnapshot().document,
      revision: 0,
      selectedIds: Object.freeze([]),
      selectedId: null,
      tool: "select",
      fill: "#e7eefb",
      shapeKind: "rectangle",
      inkColor: "#202124",
      inkWidth: 3,
      erasedIds: Object.freeze([]),
      eraserCursor: null,
      camera: { x: 0, y: 0, zoom: 1 },
      connectorPreview: null,
      bindingTargetId: null,
      activeEndpoint: null,
      activeConnectorBend: null,
      preview: null,
      selectionPreview: null,
      marquee: null,
      textEditing: null,
      guides: [],
      interacting: false,
      activeHandle: null,
      canUndo: false,
      canRedo: false,
      historyWarning: null,
      interactionNotice: null,
      recoveredTextDrafts: Object.freeze([]),
    };
    this.chrome = chromeSnapshot(this.snapshot);
    this.disconnectSession = this.documentSession.subscribe((event) =>
      this.onDocumentCommit(event),
    );
  }

  dispose(): void {
    this.disconnectSession();
    this.listeners.clear();
  }

  applyExternal(operation: SessionOperation): boolean {
    this.documentSession.assertWritable();
    return this.documentSession.apply(operation);
  }

  dismissInteractionNotice(): void {
    this.publish({ interactionNotice: null, recoveredTextDrafts: Object.freeze([]) });
  }

  private onDocumentCommit(event: DocumentCommit): void {
    if (event.origin === "replacement") {
      const recoveredTextDrafts = this.snapshot.textEditing?.draft.text
        ? Object.freeze([
            ...this.snapshot.recoveredTextDrafts,
            this.snapshot.textEditing.draft.text,
          ])
        : this.snapshot.recoveredTextDrafts;
      this.documentEpoch++;
      this.gesture = null;
      this.lastGestureScreen = null;
      this.publish({
        ...IDLE_GESTURE,
        document: event.document,
        revision: event.revision,
        selectedIds: [],
        tool: "select",
        camera: { x: 0, y: 0, zoom: 1 },
        textEditing: null,
        interactionNotice: recoveredTextDrafts.length
          ? "Your uncommitted text drafts are available below."
          : null,
        recoveredTextDrafts,
      });
      return;
    }
    const reconciliation =
      event.origin === "remote"
        ? reconcileExternalChange(this.snapshot, this.gesture, event)
        : null;
    if (reconciliation?.cancelGesture) {
      this.gesture = null;
      this.lastGestureScreen = null;
    }
    this.publish({ ...reconciliation?.patch, document: event.document, revision: event.revision });
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
      selectedIds = [
        ...new Set([
          ...selectedIds,
          ...expandGroups(patch.document ?? this.snapshot.document, selectedIds),
        ]),
      ];
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
    const session = this.documentSession.getSnapshot();
    this.snapshot = {
      ...this.snapshot,
      ...patch,
      selectedIds,
      selectedId: selectedIds.length === 1 ? selectedIds[0]! : null,
      canUndo: session.canUndo,
      canRedo: session.canRedo,
      historyWarning: session.historyWarning,
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

  frameSelection(): void {
    this.finishTextEditing();
    this.cancelGesture();
    const result = createFrameAroundSelection(
      this.snapshot.document,
      this.snapshot.selectedIds,
      this.makeId,
    );
    this.commit(result.transaction);
    if (result.id) this.publish({ selectedIds: [result.id], tool: "select" });
  }

  addFrame(screen: Point): void {
    this.finishTextEditing();
    this.cancelGesture();
    if (this.snapshot.document.shapes.length >= MAX_SHAPES)
      throw new Error("This board has no room for another frame.");
    const point = screenToWorld(screen, this.snapshot.camera);
    const frame = this.frameDraft({
      id: this.makeId(),
      type: "rectangle",
      kind: "frame",
      x: clamp(point.x - 320, -MAX_COORDINATE, MAX_COORDINATE),
      y: clamp(point.y - 200, -MAX_COORDINATE, MAX_COORDINATE),
      width: 640,
      height: 400,
      fill: "transparent",
    });
    this.commitShape("Create frame", null, frame);
    this.publish({ selectedIds: [frame.id], tool: "select" });
  }

  private frameDraft(shape: Rectangle): Rectangle {
    return {
      ...shape,
      kind: "frame",
      fill: "transparent",
      zIndex: this.creationRank(false),
      appearance: {
        stroke: "#3568db",
        strokeWidth: 1.5,
        strokeStyle: "solid",
        opacity: 100,
        cornerRadius: 4,
      },
      label: {
        text: `Frame ${this.snapshot.document.shapes.filter(isFrame).length + 1}`,
        fontSize: 20,
        fontWeight: 700,
        color: "#202124",
      },
    };
  }

  renameFrame(name: string): void {
    if (this.selectionLocked()) return;
    this.finishTextEditing();
    this.cancelGesture();
    const shape = this.selectedShape();
    if (shape && isFrame(shape))
      this.commitShape("Rename frame", shape, {
        ...shape,
        label: {
          text: name.trim().slice(0, 120) || "Untitled frame",
          fontSize: 20,
          fontWeight: 700,
          color: shape.label?.color ?? "#202124",
        },
      });
  }

  insertPreset(id: PresetId, screen: Point): void {
    this.finishTextEditing();
    this.cancelGesture();
    const result = insertPreset(
      this.snapshot.document,
      id,
      screenToWorld(screen, this.snapshot.camera),
      this.makeId,
    );
    this.commit(result.transaction);
    if (result.transaction) this.publish({ selectedIds: result.ids, tool: "select" });
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
      objects.some((item) => item.type !== "connector" && isFrame(item)) ||
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

  /** Excludes edits while an external replacement is being durably committed. */
  lockDocument(): Readonly<{ replace: (document: BoardDocument) => void; release: () => void }> {
    this.documentSession.assertWritable();
    this.finishTextEditing();
    this.cancelGesture();
    return this.documentSession.lockReplacement();
  }

  private commit(transaction: DocumentTransaction | null): void {
    if (!transaction) return;
    this.documentSession.assertWritable();
    this.documentSession.execute(transaction);
  }

  private commitShape(label: string, before: Shape | null, after: Shape | null): void {
    if (before && !after) {
      this.commit(deleteShapeTransaction(this.snapshot.document, before.id));
      return;
    }
    this.commit(shapeTransaction(label, before, after));
  }

  private selectedConnector(): Connector | undefined {
    return this.snapshot.document.connectors.find(
      (connector) => connector.id === this.snapshot.selectedId,
    );
  }

  private commitConnector(label: string, before: Connector | null, after: Connector | null): void {
    this.commit(connectorTransaction(label, before, after));
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

  setConnectorStyle(style: Partial<Pick<Connector, "color" | "arrowhead" | "route">>): void {
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
    this.commitConnector(
      "Detach connector",
      connector,
      detachConnectorBindings(connector, this.snapshot.document.shapes),
    );
  }

  getConnectorEndpointAt(screen: Point): ConnectorEnd | null {
    const connector = this.selectionLocked() ? undefined : this.selectedConnector();
    return connector && this.snapshot.tool === "select"
      ? hitConnectorEnd(connector, this.snapshot.document.shapes, screen, this.snapshot.camera)
      : null;
  }

  getConnectorBendAt(screen: Point): "x" | "y" | null {
    const connector = this.selectionLocked() ? undefined : this.selectedConnector();
    return connector && this.snapshot.tool === "select"
      ? hitConnectorBend(connector, this.snapshot.document.shapes, screen, this.snapshot.camera)
      : null;
  }

  setShapeKind(shapeKind: ShapeKind): void {
    if (!["rectangle", "ellipse", "diamond", "frame"].includes(shapeKind))
      throw new Error("Unknown shape kind.");
    this.finishTextEditing();
    this.cancelGesture();
    this.publish({ shapeKind, tool: "rectangle" });
  }

  setTool(tool: Tool): void {
    this.finishTextEditing();
    this.cancelGesture();
    this.publish({ tool, eraserCursor: null });
  }

  /** Context actions target the hit object without collapsing an existing selection. */
  selectContextTarget(screen: Point): void {
    this.finishTextEditing();
    this.cancelGesture();
    const object = hitSceneObject(
      this.snapshot.document,
      screenToWorld(screen, this.snapshot.camera),
      7 / this.snapshot.camera.zoom,
      true,
    );
    if (object && this.snapshot.selectedIds.includes(object.id)) this.publish({ tool: "select" });
    else this.select(object?.id ?? null);
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
    this.documentSession.assertWritable();
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
    this.documentSession.assertWritable();
    this.finishTextEditing();
    this.cancelGesture();
    const result = duplicateObjects(
      this.snapshot.document,
      frameSelectionContents(this.snapshot.document, this.snapshot.selectedIds),
      this.makeId,
    );
    this.commit(result.transaction);
    if (result.transaction) this.publish({ selectedIds: result.ids, tool: "select" });
  }

  alignSelection(alignment: Alignment): void {
    if (
      this.selectionLocked() ||
      [...this.snapshot.document.shapes, ...this.snapshot.document.connectors].some(
        (item) =>
          this.snapshot.selectedIds.includes(item.id) &&
          (item.groupId || (item.type !== "connector" && isFrame(item))),
      )
    )
      return;
    this.documentSession.assertWritable();
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
        (item) =>
          this.snapshot.selectedIds.includes(item.id) &&
          (item.groupId || (item.type !== "connector" && isFrame(item))),
      )
    )
      return;
    this.documentSession.assertWritable();
    this.finishTextEditing();
    this.cancelGesture();
    this.commit(
      distributeShapesTransaction(this.snapshot.document, this.snapshot.selectedIds, axis),
    );
  }

  setFill(fill: Fill): void {
    if (!isFill(fill)) throw new Error("Choose a valid fill color.");
    fill = fill.toLowerCase() as Fill;
    if (this.selectionLocked()) return;
    this.finishTextEditing();
    this.cancelGesture();
    const shape = this.selectedShape();
    if (shape?.type === "rectangle") this.commitShape("Change fill", shape, { ...shape, fill });
    this.publish({ fill });
  }

  setInkStyle(style: Partial<Readonly<{ color: TextColor; strokeWidth: number }>>): void {
    if (style.color !== undefined && !isTextColor(style.color))
      throw new Error("Choose a supported drawing color.");
    const strokeWidth = style.strokeWidth;
    if (
      strokeWidth !== undefined &&
      (!Number.isFinite(strokeWidth) || strokeWidth < 0.5 || strokeWidth > 12)
    )
      throw new Error("Ink width must be between 0.5 and 12.");
    if (this.snapshot.tool === "select" && this.selectionLocked()) return;
    this.finishTextEditing();
    this.cancelGesture();
    const shape = this.selectedShape();
    const selectedInk = this.snapshot.tool === "select" && shape?.type === "ink" ? shape : null;
    const color =
      (style.color?.toLowerCase() as TextColor | undefined) ??
      selectedInk?.color ??
      this.snapshot.inkColor;
    const inkWidth = strokeWidth ?? selectedInk?.strokeWidth ?? this.snapshot.inkWidth;
    if (selectedInk)
      this.commitShape("Style ink", selectedInk, { ...selectedInk, color, strokeWidth: inkWidth });
    this.publish({ inkColor: color, inkWidth });
  }

  setImageCrop(id: string, crop: ImageCrop | null): void {
    if (this.selectionLocked([id])) return;
    this.finishTextEditing();
    this.cancelGesture();
    this.commit(imageCropTransaction(this.snapshot.document, id, crop));
  }

  setEraserCursor(point: Point | null): void {
    if (this.snapshot.tool !== "eraser") return;
    if (this.snapshot.eraserCursor?.x === point?.x && this.snapshot.eraserCursor?.y === point?.y)
      return;
    this.publish({ eraserCursor: point });
  }

  setBoardTheme(theme: BoardTheme): void {
    this.finishTextEditing();
    this.cancelGesture();
    const changes = [
      ...(boardThemeTransaction(boardTheme(this.snapshot.document), theme)?.changes ?? []),
    ];
    const fontFamily = themePalette(theme).fontFamily;
    this.snapshot.document.shapes.forEach((shape) => {
      if (!this.measureText) return;
      if (shape.type !== "text") return;
      const next = decodeText({
        ...shape,
        height: layoutText(shape, this.measureText, fontFamily).height,
      });
      const change = shapeTransaction("Change board style", shape, next);
      if (change) changes.push(...change.changes);
    });
    this.commit(changes.length ? { label: "Change board style", changes } : null);
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

  addImages(images: readonly ImageInput[], world: Point): void {
    this.documentSession.assertWritable();
    this.finishTextEditing();
    this.cancelGesture();
    const result = insertImages(this.snapshot.document, images, world, this.makeId);
    this.commit(result.transaction);
    if (result.transaction) this.publish({ selectedIds: result.ids, tool: "select" });
  }

  addRectangle(screen: Point): void {
    if (this.snapshot.shapeKind === "frame") {
      this.addFrame(screen);
      return;
    }
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

  private fitText(
    shape: TextShape,
    fontFamily = themePalette(boardTheme(this.snapshot.document)).fontFamily,
  ): TextShape {
    const valid = decodeText(shape);
    if (!this.measureText) throw new Error("Text editing requires a text measurement adapter.");
    return decodeText({ ...valid, height: layoutText(valid, this.measureText, fontFamily).height });
  }

  addText(screen: Point, placement: "start" | "center" = "start"): void {
    this.documentSession.assertWritable();
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
      true,
    );
    if (object) this.editText(object.id);
  }

  editText(id = this.snapshot.selectedId): void {
    if (id && this.selectionLocked([id])) return;
    this.documentSession.assertWritable();
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
    if (!owner || (owner.type !== "rectangle" && owner.type !== "connector")) return;
    if (!this.measureText) throw new Error("Label editing requires text measurement.");
    const draft = labelTextShape(
      {
        ...owner,
        label: owner.label ?? { text: "", fontSize: 20, fontWeight: 400, color: "#243e33" },
      },
      this.snapshot.document.shapes,
      this.measureText,
      themePalette(boardTheme(this.snapshot.document)).fontFamily,
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
      if (!owner || (owner.type !== "rectangle" && owner.type !== "connector")) return;
      draft = labelTextShape(
        { ...owner, label: decodeLabel(content) },
        this.snapshot.document.shapes,
        this.measureText,
        themePalette(boardTheme(this.snapshot.document)).fontFamily,
      )!;
    } else draft = this.fitText(content);
    this.publish({ textEditing: { ...editing, draft } });
  }

  finishTextEditing(): void {
    const editing = this.snapshot.textEditing;
    if (!editing) return;
    this.documentSession.assertWritable();
    const { before, draft } = editing;
    if (editing.ownerId) {
      const owner =
        this.snapshot.document.shapes.find((item) => item.id === editing.ownerId) ??
        this.snapshot.document.connectors.find((item) => item.id === editing.ownerId);
      if (owner && (owner.type === "rectangle" || owner.type === "connector")) {
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
    const ids = frameSelectionContents(this.snapshot.document, this.snapshot.selectedIds);
    if (this.selectionLocked(ids)) return;
    const updates = translateObjects(this.snapshot.document, ids, {
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

  getConnectionHandleAt(screen: Point): boolean {
    const shape = this.selectionLocked() ? undefined : this.selectedShape();
    return Boolean(
      shape &&
      this.snapshot.tool === "select" &&
      connectionHandleAt(shape, screen, this.snapshot.camera),
    );
  }

  begin(screen: Point, pan = false, additive = false): void {
    if (this.documentSession.isReplacing) return;
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
    this.lastGestureScreen = screen;
    this.publish(this.rankCreationPreview(start.patch));
    if (this.gesture?.kind === "erase") this.move(screen);
  }

  private lastGestureScreen: Point | null = null;

  /** Promote a stationary, closed freehand preview to a rectangle or ellipse. */
  recognizeDrawing(): boolean {
    const gesture = this.gesture;
    if (gesture?.kind !== "ink" || gesture.recognized || !this.lastGestureScreen) return false;
    const ink = makeInkShape(
      gesture.id,
      gesture.points,
      this.snapshot.inkColor,
      this.snapshot.inkWidth,
    );
    const recognized = ink && recognizeInk(ink);
    if (!recognized) return false;
    this.gesture = { ...gesture, recognized: true, recognitionAnchor: this.lastGestureScreen };
    this.publish({ preview: { ...recognized, zIndex: this.creationRank(true) } });
    return true;
  }

  private rankCreationPreview(patch: Partial<EditorSnapshot>): Partial<EditorSnapshot> {
    if (this.gesture?.kind === "ink" && patch.preview?.type === "ink")
      return { ...patch, preview: { ...patch.preview, zIndex: this.creationRank(true) } };
    if (this.gesture?.kind === "draw" && patch.preview?.type === "rectangle")
      return {
        ...patch,
        preview:
          patch.preview.kind === "frame"
            ? this.frameDraft(patch.preview)
            : { ...patch.preview, zIndex: this.creationRank(true) },
      };
    if (
      (this.gesture?.kind === "connect" || this.gesture?.kind === "create-connected") &&
      patch.connectorPreview
    )
      return {
        ...patch,
        connectorPreview: { ...patch.connectorPreview, zIndex: this.creationRank(false) },
      };
    return patch;
  }

  move(screen: Point, snapping = true): void {
    if (!this.gesture) return;
    this.lastGestureScreen = screen;
    if (this.gesture.kind === "erase") {
      const gesture = this.gesture;
      const next = screenToWorld(screen, this.snapshot.camera);
      const hits = erasedObjects(
        this.snapshot.document,
        gesture.last,
        next,
        ERASER_RADIUS_SCREEN / this.snapshot.camera.zoom,
      );
      const erasedIds = [...new Set([...gesture.erasedIds, ...hits])];
      this.gesture = { kind: "erase", last: next, erasedIds };
      this.publish({ erasedIds, eraserCursor: screen, interacting: true });
      return;
    }
    if (this.gesture.kind === "ink") {
      let gesture = this.gesture;
      if (
        gesture.recognized &&
        gesture.recognitionAnchor &&
        Math.hypot(screen.x - gesture.recognitionAnchor.x, screen.y - gesture.recognitionAnchor.y) >
          3
      )
        gesture = { ...gesture, recognized: false, recognitionAnchor: null };
      const world = screenToWorld(screen, this.snapshot.camera);
      const point = {
        x: clamp(
          world.x,
          Math.max(-MAX_COORDINATE, gesture.bounds.maxX - MAX_SIZE),
          Math.min(MAX_COORDINATE, gesture.bounds.minX + MAX_SIZE),
        ),
        y: clamp(
          world.y,
          Math.max(-MAX_COORDINATE, gesture.bounds.maxY - MAX_SIZE),
          Math.min(MAX_COORDINATE, gesture.bounds.minY + MAX_SIZE),
        ),
      };
      const previous = gesture.points.at(-1)!;
      if (
        Math.hypot(point.x - previous.x, point.y - previous.y) >
        0.5 / this.snapshot.camera.zoom
      ) {
        let points = [...gesture.points, point];
        if (points.length > MAX_INK_POINTS) points = [...simplifyInkPoints(points)];
        gesture = {
          ...gesture,
          points,
          bounds: {
            minX: Math.min(gesture.bounds.minX, point.x),
            minY: Math.min(gesture.bounds.minY, point.y),
            maxX: Math.max(gesture.bounds.maxX, point.x),
            maxY: Math.max(gesture.bounds.maxY, point.y),
          },
        };
      }
      this.gesture = gesture;
      const ink = makeInkShape(
        gesture.id,
        gesture.points,
        this.snapshot.inkColor,
        this.snapshot.inkWidth,
      );
      if (ink)
        this.publish({
          preview: gesture.recognized
            ? this.snapshot.preview
            : { ...ink, zIndex: this.creationRank(true) },
        });
      return;
    }
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
      } else if (gesture?.kind === "bend-connector" && connectorPreview) {
        this.commitConnector("Move connector bend", gesture.connector, connectorPreview);
      } else if (
        (gesture?.kind === "connect" ||
          gesture?.kind === "reconnect" ||
          gesture?.kind === "create-connected") &&
        connectorPreview
      ) {
        const selfBound =
          connectorPreview.start.type === "binding" &&
          connectorPreview.end.type === "binding" &&
          connectorPreview.start.shapeId === connectorPreview.end.shapeId;
        const ends = resolveConnector(connectorPreview, this.snapshot.document.shapes);
        if (
          !selfBound &&
          ((gesture.kind !== "connect" && gesture.kind !== "create-connected") ||
            Math.hypot(ends.end.x - ends.start.x, ends.end.y - ends.start.y) * camera.zoom >= 6)
        ) {
          if (gesture.kind === "create-connected" && connectorPreview.end.type === "point") {
            const point = connectorPreview.end;
            const width = Math.min(MAX_SIZE, gesture.source.width);
            const height = Math.min(MAX_SIZE, gesture.source.height);
            const shape: Rectangle = {
              id: gesture.shapeId,
              type: "rectangle",
              x: clamp(point.x - width / 2, -MAX_COORDINATE, MAX_COORDINATE),
              y: clamp(point.y - height / 2, -MAX_COORDINATE, MAX_COORDINATE),
              width,
              height,
              fill: gesture.source.fill,
              ...(gesture.source.kind && gesture.source.kind !== "rectangle"
                ? { kind: gesture.source.kind }
                : {}),
              ...(gesture.source.appearance ? { appearance: gesture.source.appearance } : {}),
              zIndex: this.creationRank(true),
            };
            const connector: Connector = {
              ...connectorPreview,
              start: gesture.start,
              end: { type: "binding", shapeId: shape.id },
              zIndex: this.creationRank(false),
            };
            const shapeChange = shapeTransaction("Create connected shape", null, shape);
            const connectorChange = connectorTransaction("Create connected shape", null, connector);
            this.commit(
              shapeChange && connectorChange
                ? {
                    label: "Create connected shape",
                    changes: [...shapeChange.changes, ...connectorChange.changes],
                  }
                : null,
            );
            this.publish({ selectedIds: [shape.id], tool: "select" });
            this.editText(shape.id);
          } else {
            this.commitConnector(
              gesture.kind === "connect" || gesture.kind === "create-connected"
                ? "Create connector"
                : "Reconnect endpoint",
              gesture.kind === "connect" || gesture.kind === "create-connected"
                ? null
                : gesture.connector,
              gesture.kind === "connect" || gesture.kind === "create-connected"
                ? { ...connectorPreview, zIndex: this.creationRank(false) }
                : connectorPreview,
            );
            this.publish({ selectedIds: [connectorPreview.id], tool: "select" });
          }
        }
      } else if (gesture?.kind === "erase") {
        const transaction = deleteObjectsTransaction(this.snapshot.document, gesture.erasedIds);
        if (transaction) this.commit({ ...transaction, label: "Erase objects" });
      } else if (
        gesture?.kind === "ink" &&
        preview &&
        (preview.type === "ink" || preview.type === "rectangle")
      ) {
        this.commitShape(
          preview.type === "ink" ? "Draw ink" : "Recognize drawing",
          null,
          preview.type === "ink" ? { ...preview, zIndex: this.creationRank(true) } : preview,
        );
      } else if (
        gesture?.kind === "draw" &&
        preview &&
        preview.width >= 1 &&
        preview.height >= 1 &&
        preview.width * camera.zoom >= 3 &&
        preview.height * camera.zoom >= 3
      ) {
        this.commitShape(
          preview.type === "rectangle" && isFrame(preview) ? "Create frame" : "Create rectangle",
          null,
          preview.type === "rectangle" && isFrame(preview)
            ? preview
            : { ...preview, zIndex: this.creationRank(true) },
        );
        this.publish({ selectedIds: [preview.id], tool: "select" });
      } else if (gesture?.kind === "resize" && preview) {
        this.commitShape("Resize object", gesture.shape, preview);
      }
    } finally {
      this.lastGestureScreen = null;
      this.publish({
        ...IDLE_GESTURE,
        eraserCursor: this.snapshot.tool === "eraser" ? this.snapshot.eraserCursor : null,
      });
    }
  }

  cancelGesture(): void {
    if (!this.gesture) return;
    const selectedIds =
      this.gesture.kind === "marquee" ? this.gesture.before : this.snapshot.selectedIds;
    const camera = this.gesture.kind === "pan" ? this.gesture.camera : this.snapshot.camera;
    this.gesture = null;
    this.lastGestureScreen = null;
    this.publish({
      ...IDLE_GESTURE,
      eraserCursor: this.snapshot.tool === "eraser" ? this.snapshot.eraserCursor : null,
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

  removeSelection(includeFrameContents = false): void {
    const ids = includeFrameContents
      ? frameSelectionContents(this.snapshot.document, this.snapshot.selectedIds)
      : this.snapshot.selectedIds;
    if (this.selectionLocked(ids)) return;
    this.finishTextEditing();
    this.cancelGesture();
    this.commit(deleteObjectsTransaction(this.snapshot.document, ids));
    this.publish({ selectedIds: [] });
  }

  undo(): void {
    this.restore("undo");
  }
  redo(): void {
    this.restore("redo");
  }

  private restore(direction: "undo" | "redo"): void {
    this.documentSession.assertWritable();
    this.cancelTextEditing();
    this.cancelGesture();
    this.documentSession.restore(direction);
  }
}
