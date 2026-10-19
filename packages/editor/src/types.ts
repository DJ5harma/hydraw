import type { BoardDocument, Fill, Rectangle } from "@hydraw/document";
import type { ResizeHandle } from "./geometry.ts";

export type Tool = "select" | "rectangle" | "hand";
export type Camera = Readonly<{ x: number; y: number; zoom: number }>;
export type EditorSnapshot = Readonly<{
  document: BoardDocument;
  revision: number;
  selectedId: string | null;
  tool: Tool;
  fill: Fill;
  camera: Camera;
  preview: Rectangle | null;
  interacting: boolean;
  activeHandle: ResizeHandle | null;
  canUndo: boolean;
  canRedo: boolean;
}>;
export type EditorChromeSnapshot = Omit<
  EditorSnapshot,
  "preview" | "camera" | "revision" | "activeHandle"
> &
  Readonly<{ zoom: number }>;
