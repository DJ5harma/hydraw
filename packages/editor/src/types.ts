import type { BoardDocument, Fill, Shape, TextShape, Connector } from "@hydraw/document";
import type { ConnectorEnd } from "./connector-interactions.ts";
import type { ResizeHandle } from "./geometry.ts";

export type Tool = "select" | "rectangle" | "text" | "connector" | "hand";
export type Camera = Readonly<{ x: number; y: number; zoom: number }>;
export type EditorSnapshot = Readonly<{
  document: BoardDocument;
  revision: number;
  selectedId: string | null;
  tool: Tool;
  fill: Fill;
  camera: Camera;
  preview: Shape | null;
  connectorPreview: Connector | null;
  bindingTargetId: string | null;
  activeEndpoint: ConnectorEnd | null;
  textEditing: Readonly<{ before: TextShape | null; draft: TextShape }> | null;
  interacting: boolean;
  activeHandle: ResizeHandle | null;
  canUndo: boolean;
  canRedo: boolean;
}>;
export type EditorChromeSnapshot = Omit<
  EditorSnapshot,
  | "preview"
  | "camera"
  | "revision"
  | "activeHandle"
  | "connectorPreview"
  | "bindingTargetId"
  | "activeEndpoint"
> &
  Readonly<{ zoom: number }>;
