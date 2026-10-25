import { themePalette } from "@hydraw/document";
import type { BoardDocument } from "@hydraw/document";
import { createTextMeasurer } from "@hydraw/editor/canvas";
import { exportSvg } from "@hydraw/editor";
import { boardFileName, downloadBlob } from "./files.ts";

const PNG_SCALE = 2;
const MAX_PNG_SIDE = 16_384;
const MAX_PNG_PIXELS = 100_000_000;

async function pngBlob(svgBlob: Blob): Promise<Blob> {
  const url = URL.createObjectURL(svgBlob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const width = Math.ceil(image.naturalWidth * PNG_SCALE);
    const height = Math.ceil(image.naturalHeight * PNG_SCALE);
    if (
      width < 1 ||
      height < 1 ||
      width > MAX_PNG_SIDE ||
      height > MAX_PNG_SIDE ||
      width * height > MAX_PNG_PIXELS
    )
      throw new Error("This board is too large to export as a PNG. Export it as SVG instead.");
    const canvas = window.document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not create a PNG export canvas.");
    context.setTransform(PNG_SCALE, 0, 0, PNG_SCALE, 0, 0);
    context.drawImage(image, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result);
        else reject(new Error("Your browser could not create the PNG export."));
      }, "image/png");
    });
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Download a selected scene without changing board storage or editor state. */
export async function downloadVisual(
  document: BoardDocument,
  format: "svg" | "png",
  ids?: readonly string[],
): Promise<void> {
  const svg = svgBlob(document, ids);
  downloadBlob(format === "svg" ? svg : await pngBlob(svg), boardFileName(document.name, format));
}

export type VisualBackground = "board" | "transparent";

function svgBlob(document: BoardDocument, ids?: readonly string[], background?: string): Blob {
  const svg = exportSvg(document, {
    ids,
    measureText: createTextMeasurer(),
    background,
  });
  return new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
}

/** Start the clipboard write during the user gesture; browsers can await image encoding. */
export async function copyVisual(
  document: BoardDocument,
  ids?: readonly string[],
  background: VisualBackground = "board",
): Promise<void> {
  if (
    !navigator.clipboard?.write ||
    typeof ClipboardItem === "undefined" ||
    (typeof ClipboardItem.supports === "function" && !ClipboardItem.supports("image/png"))
  )
    throw new Error("This browser cannot copy images to the clipboard. Use Export PNG instead.");
  const color =
    background === "transparent" ? "transparent" : themePalette(document.theme).background;
  const item = new ClipboardItem({ "image/png": pngBlob(svgBlob(document, ids, color)) });
  try {
    await navigator.clipboard.write([item]);
  } catch {
    throw new Error("Could not copy the image. Allow clipboard access, or use Export PNG.");
  }
}
