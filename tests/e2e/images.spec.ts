import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { deflateSync } from "node:zlib";
import type { BoardDocument } from "../../packages/document/src/index.ts";
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

const pngBuffer = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  pngChunk("IHDR", Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0])),
  pngChunk("IDAT", deflateSync(Buffer.from([0, 255, 0, 0, 255]))),
  pngChunk("IEND", Buffer.alloc(0)),
]);
const pngBase64 = pngBuffer.toString("base64");

async function exportBoard(page: Page): Promise<BoardDocument> {
  await openBoardMenu(page);
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export board", exact: true }).click();
  const stream = await (await pending).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as BoardDocument;
}

async function waitForImage(page: Page, name: string, index: number) {
  await openObjects(page);
  await expect(
    page.getByRole("button", { name: `Image ${index} · ${name}`, exact: true }),
  ).toBeVisible();
  await closeOverlay(page);
}

async function dispatchFileEvent(page: Page, kind: "paste" | "drop", name: string) {
  await page.locator("canvas").evaluate(
    (canvas, args) => {
      const bytes = Uint8Array.from(atob(args.base64), (character) => character.charCodeAt(0));
      const file = new File([bytes], args.name, { type: "image/png" });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      if (args.kind === "paste") {
        canvas.focus();
        const event = new ClipboardEvent("paste", { bubbles: true, clipboardData: transfer });
        Object.defineProperty(event, "clipboardData", { value: transfer });
        canvas.dispatchEvent(event);
      } else {
        const rect = canvas.getBoundingClientRect();
        const dragover = new DragEvent("dragover", { bubbles: true, dataTransfer: transfer });
        canvas.dispatchEvent(dragover);
        const drop = new DragEvent("drop", {
          bubbles: true,
          dataTransfer: transfer,
          clientX: rect.left + rect.width * 0.65,
          clientY: rect.top + rect.height * 0.55,
        });
        canvas.dispatchEvent(drop);
      }
    },
    { kind, name, base64: pngBase64 },
  );
}

test("imports PNG files, paste and drop as embedded board images that survive reload", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("toolbar", { name: "Drawing tools" })
    .getByRole("button", { name: "Insert image", exact: true })
    .click();
  await page.getByLabel("Image files").setInputFiles({
    name: "upload.png",
    mimeType: "image/png",
    buffer: pngBuffer,
  });
  await waitForImage(page, "upload.png", 1);

  await dispatchFileEvent(page, "paste", "pasted.png");
  await waitForImage(page, "pasted.png", 2);
  await dispatchFileEvent(page, "drop", "dropped.png");
  await waitForImage(page, "dropped.png", 3);

  const saved = await exportBoard(page);
  expect(saved.shapes).toHaveLength(3);
  expect(saved.shapes.map((shape) => (shape.type === "image" ? shape.name : ""))).toEqual([
    "upload.png",
    "pasted.png",
    "dropped.png",
  ]);
  for (const shape of saved.shapes) {
    expect(shape).toMatchObject({
      type: "image",
      src: expect.stringMatching(/^data:image\/png;base64,iVBORw0KGgo/u),
    });
  }

  await page.reload();
  expect(await exportBoard(page)).toEqual(saved);
});

test("copies embedded PNG data into SVG and renders a downloadable PNG", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("toolbar", { name: "Drawing tools" })
    .getByRole("button", { name: "Insert image", exact: true })
    .click();
  await page.getByLabel("Image files").setInputFiles({
    name: "export.png",
    mimeType: "image/png",
    buffer: pngBuffer,
  });
  await waitForImage(page, "export.png", 1);

  await openBoardMenu(page);
  const svgPending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export SVG", exact: true }).click();
  const svgStream = await (await svgPending).createReadStream();
  const svgChunks: Buffer[] = [];
  for await (const chunk of svgStream!) svgChunks.push(Buffer.from(chunk));
  const svg = Buffer.concat(svgChunks).toString("utf8");
  expect(svg).toContain("<image ");
  expect(svg).toMatch(/href="data:image\/png;base64,iVBORw0KGgo/u);

  await openBoardMenu(page);
  const pngPending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PNG", exact: true }).click();
  const pngStream = await (await pngPending).createReadStream();
  const pngChunks: Buffer[] = [];
  for await (const chunk of pngStream!) pngChunks.push(Buffer.from(chunk));
  expect(Buffer.concat(pngChunks).subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );
});

test("does not insert an image into a board that was replaced while decoding", async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.createImageBitmap.bind(window);
    const gate: { started: boolean; release: (() => void) | null } = {
      started: false,
      release: null,
    };
    Object.assign(window, { __imageDecodeGate: gate });
    window.createImageBitmap = ((...args: Parameters<typeof createImageBitmap>) => {
      gate.started = true;
      return new Promise((resolve, reject) => {
        gate.release = () => void original(...args).then(resolve, reject);
      });
    }) as typeof window.createImageBitmap;
  });
  await page.goto("/");
  await page
    .getByRole("toolbar", { name: "Drawing tools" })
    .getByRole("button", { name: "Insert image", exact: true })
    .click();
  await page.getByLabel("Image files").setInputFiles({
    name: "pending.png",
    mimeType: "image/png",
    buffer: pngBuffer,
  });
  await page.waitForFunction(
    () =>
      (window as Window & { __imageDecodeGate?: { started: boolean } }).__imageDecodeGate?.started,
  );

  const replacement = {
    format: "hydraw",
    version: 1,
    theme: "clean",
    name: "Replacement board",
    shapes: [
      {
        id: "replacement",
        type: "rectangle",
        x: 10,
        y: 20,
        width: 100,
        height: 80,
        fill: "#e7eefb",
      },
    ],
    connectors: [],
  };
  await openBoardMenu(page);
  await page.getByRole("button", { name: "Import board", exact: true }).click();
  await page.getByLabel("Hydraw board file").setInputFiles({
    name: "replacement.hydraw.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(replacement)),
  });
  await page.getByRole("button", { name: "Open imported board", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.evaluate(() => {
    const gate = (
      window as Window & {
        __imageDecodeGate?: { release: (() => void) | null };
      }
    ).__imageDecodeGate;
    gate?.release?.();
  });
  await expect(page.getByRole("alert")).toContainText("board changed while opening images");
  const saved = await exportBoard(page);
  expect(saved.name).toBe("Replacement board");
  expect(saved.shapes).toHaveLength(1);
  expect(saved.shapes[0]?.id).toBe("replacement");
});
