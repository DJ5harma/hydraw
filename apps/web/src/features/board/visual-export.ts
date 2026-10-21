import type { BoardDocument } from "@hydraw/document";
import { createTextMeasurer } from "@hydraw/editor/canvas";
import { exportSvg } from "@hydraw/editor";

const PNG_SCALE = 2;
const MAX_PNG_SIDE = 16_384;
const MAX_PNG_PIXELS = 100_000_000;

function fileBase(name: string): string {
  return name.replace(/[^a-z0-9_-]/gi, "-").slice(0, 80) || "board";
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

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
  const svg = exportSvg(document, { ids, measureText: createTextMeasurer() });
  if (format === "svg") {
    download(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
      `${fileBase(document.name)}.svg`,
    );
    return;
  }
  const blob = await pngBlob(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  download(blob, `${fileBase(document.name)}.png`);
}
