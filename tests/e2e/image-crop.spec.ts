import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { deflateSync } from "node:zlib";
import type { BoardDocument, ImageShape } from "../../packages/document/src/index.ts";
import { closeOverlay, openBoardMenu, openObjects } from "./ui.ts";

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, checksum]);
}

function twoColorPng(): Buffer {
  const width = 100;
  const height = 50;
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1);
    rows[row] = 0;
    for (let x = 0; x < width; x++) {
      const offset = row + 1 + x * 4;
      rows[offset] = x < width / 2 ? 255 : 0;
      rows[offset + 1] = 0;
      rows[offset + 2] = x < width / 2 ? 0 : 255;
      rows[offset + 3] = 255;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(rows)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

const sourcePng = twoColorPng();

async function addImage(page: Page) {
  await page.goto("/");
  await page
    .getByRole("toolbar", { name: "Drawing tools" })
    .getByRole("button", { name: "Insert image", exact: true })
    .click();
  await page.getByLabel("Image files").setInputFiles({
    name: "crop-test.png",
    mimeType: "image/png",
    buffer: sourcePng,
  });
  await expect(page.getByRole("button", { name: "Crop image", exact: true })).toBeVisible();
}

async function exportBoard(page: Page): Promise<BoardDocument> {
  await openBoardMenu(page);
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export board", exact: true }).click();
  const stream = await (await pending).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as BoardDocument;
}

async function exportSvg(page: Page): Promise<string> {
  await openBoardMenu(page);
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export SVG", exact: true }).click();
  const stream = await (await pending).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

async function exportPng(page: Page): Promise<Buffer> {
  await openBoardMenu(page);
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PNG", exact: true }).click();
  const stream = await (await pending).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function cropDialog(page: Page) {
  await page.getByRole("button", { name: "Crop image", exact: true }).click();
  return page.getByRole("dialog", { name: "Crop image", exact: true });
}

test("crops with keyboard handles, persists and undoes, resets, and exports the selected source pixels", async ({
  page,
}) => {
  await addImage(page);

  // Normal double-click on the selected image opens the crop editor.
  const canvas = page.locator("canvas");
  const bounds = (await canvas.boundingBox())!;
  await canvas.dblclick({ position: { x: bounds.width / 2, y: bounds.height / 2 } });
  const dialog = page.getByRole("dialog", { name: "Crop image", exact: true });
  await expect(dialog).toBeVisible();
  const leftEdge = page.getByRole("slider", { name: "Crop left edge", exact: true });
  await leftEdge.focus();
  for (let i = 0; i < 50; i++) await leftEdge.press("ArrowRight");
  await expect(leftEdge).toHaveAttribute("aria-valuenow", "0.5");
  await leftEdge.press("Enter");
  await expect(dialog).toBeHidden();

  let saved = await exportBoard(page);
  let cropped = saved.shapes[0] as ImageShape;
  expect(cropped.crop).toEqual({ x: 0.5, y: 0, width: 0.5, height: 1 });
  expect(cropped.src).toMatch(/^data:image\/png;base64,iVBORw0KGgo/u);

  // Undo and redo treat crop as one native history step; it survives reload.
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  saved = await exportBoard(page);
  expect((saved.shapes[0] as ImageShape).crop).toBeUndefined();
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  saved = await exportBoard(page);
  await page.reload();
  expect(await exportBoard(page)).toEqual(saved);

  const svg = await exportSvg(page);
  expect(svg).toContain('viewBox="0.5 0 0.5 1"');
  expect(svg).toContain(`href="${cropped.src}"`);

  // Sample the exported PNG at the visible image center: it must be the blue source half.
  const viewBox = svg
    .match(/viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)"/)
    ?.slice(1)
    .map(Number);
  expect(viewBox).toHaveLength(4);
  const image = saved.shapes[0] as ImageShape;
  const sample = {
    x: (image.x + image.width / 2 - viewBox![0]!) * 2,
    y: (image.y + image.height / 2 - viewBox![1]!) * 2,
  };
  const png = await exportPng(page);
  const color = await page.evaluate(
    async ({ base64, x, y }) => {
      const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(bitmap, 0, 0);
      return [...context.getImageData(Math.round(x), Math.round(y), 1, 1).data];
    },
    { base64: png.toString("base64"), ...sample },
  );
  expect(color).toEqual([0, 0, 255, 255]);

  // Reset in the overlay changes the draft; Apply restores the full source geometry.
  await openObjects(page);
  await page.getByRole("button", { name: "Image 1 · crop-test.png", exact: true }).click();
  await closeOverlay(page);
  await cropDialog(page);
  await page.getByRole("button", { name: "Reset crop", exact: true }).click();
  await page.getByRole("button", { name: "Apply crop", exact: true }).click();
  saved = await exportBoard(page);
  expect((saved.shapes[0] as ImageShape).crop).toBeUndefined();
  expect(saved.shapes[0]).toMatchObject({ x: cropped.x - cropped.width, width: cropped.width * 2 });
});

test("Enter on Cancel and Escape discard crop drafts without committing", async ({ page }) => {
  await addImage(page);
  const dialog = await cropDialog(page);
  const edge = page.getByRole("slider", { name: "Crop left edge", exact: true });
  await edge.focus();
  for (let i = 0; i < 20; i++) await edge.press("ArrowRight");
  await page.getByRole("button", { name: "Cancel", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  let saved = await exportBoard(page);
  expect((saved.shapes[0] as ImageShape).crop).toBeUndefined();

  await cropDialog(page);
  await edge.focus();
  for (let i = 0; i < 20; i++) await edge.press("ArrowRight");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  saved = await exportBoard(page);
  expect((saved.shapes[0] as ImageShape).crop).toBeUndefined();
});
