import type {
  BoardDocument,
  Fill,
  ShapeKind,
  Shape,
  TextShape,
  Connector,
  Bounds,
  ObjectUpdates,
} from "@hydraw/document";
import type { SnapGuide } from "./snapping.ts";
import type { ConnectorEnd } from "./connector-interactions.ts";
import type { ResizeHandle } from "./geometry.ts";

export type Tool = "select" | "rectangle" | "text" | "connector" | "hand";
export type Camera = Readonly<{ x: number; y: number; zoom: number }>;
export type EditorSnapshot = Readonly<{
  document: BoardDocument;
  revision: number;
  selectedIds: readonly string[];
  /** Exactly one selected identity; single-object tools use this derived value. */
  selectedId: string | null;
  tool: Tool;
  fill: Fill;
  shapeKind: ShapeKind;
  camera: Camera;
  preview: Shape | null;
  selectionPreview: ObjectUpdates | null;
  marquee: Bounds | null;
  connectorPreview: Connector | null;
  bindingTargetId: string | null;
  activeEndpoint: ConnectorEnd | null;
  textEditing: Readonly<{ before: TextShape | null; draft: TextShape; ownerId?: string }> | null;
  guides: readonly SnapGuide[];
  interacting: boolean;
  activeHandle: ResizeHandle | null;
  canUndo: boolean;
  canRedo: boolean;
}>;
export type EditorChromeSnapshot = Omit<
  EditorSnapshot,
  | "guides"
  | "preview"
  | "selectionPreview"
  | "marquee"
  | "camera"
  | "revision"
  | "activeHandle"
  | "connectorPreview"
  | "bindingTargetId"
  | "activeEndpoint"
> &
  Readonly<{ zoom: number }>;
