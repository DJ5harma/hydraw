import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { BoardDocument } from "../../packages/document/src/index.ts";
import { openBoardMenu, closeOverlay, openObjects } from "./ui.ts";

async function exported(page: Page): Promise<BoardDocument> {
  const pending = page.waitForEvent("download");
  await openBoardMenu(page);
  await page.getByRole("button", { name: "Export board", exact: true }).click();
  const stream = await (await pending).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as BoardDocument;
}

test("crossing an ink edge mirrors its contents, reverses on crossing back, and survives history and reload", async ({
  page,
}) => {
  await page.goto("/");
  await openBoardMenu(page);
  await page.getByRole("button", { name: "Import board", exact: true }).click();
  const fixture = {
    format: "hydraw",
    version: 1,
    theme: "clean",
    name: "Mirror ink",
    connectors: [],
    shapes: [
      {
        id: "ink",
        type: "ink",
        x: 600,
        y: 200,
        width: 200,
        height: 120,
        color: "#202124",
        strokeWidth: 3,
        points: [
          { x: 0, y: 0 },
          { x: 0.5, y: 0.2 },
          { x: 1, y: 1 },
        ],
      },
    ],
  };
  await page.getByLabel("Hydraw board file").setInputFiles({
    name: "mirror.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await page.getByRole("button", { name: "Open imported board", exact: true }).click();
  await openObjects(page);
  await page.getByRole("button", { name: "Drawing 1", exact: true }).click();
  await closeOverlay(page);
  await page.mouse.move(600, 260);
  await page.mouse.down();
  await page.mouse.move(900, 260, { steps: 12 });
  await page.mouse.move(600, 260, { steps: 12 });
  await page.mouse.move(900, 260, { steps: 12 });
  await page.mouse.up();
  const flipped = await exported(page);
  expect(flipped.shapes[0]).toMatchObject({
    x: 800,
    y: 200,
    width: 100,
    height: 120,
    points: [
      { x: 1, y: 0 },
      { x: 0.5, y: 0.2 },
      { x: 0, y: 1 },
    ],
  });
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await exported(page)).shapes).toEqual(fixture.shapes);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect(await exported(page)).toEqual(flipped);
  await page.reload();
  expect(await exported(page)).toEqual(flipped);
  await page.screenshot({ path: "test-results/resize-reflected-ink.png" });
});

test("mirrors image pixels across an edge and keeps cropping, export and reload in the same orientation", async ({
  page,
}) => {
  await page.goto("/");
  const src = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 100;
    canvas.height = 100;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "red";
    context.fillRect(0, 0, 50, 100);
    context.fillStyle = "blue";
    context.fillRect(50, 0, 50, 100);
    return canvas.toDataURL("image/png");
  });
  const fixture = {
    format: "hydraw",
    version: 1,
    theme: "clean",
    name: "Mirror image",
    connectors: [],
    shapes: [
      {
        id: "image",
        type: "image",
        x: 600,
        y: 200,
        width: 200,
        height: 120,
        name: "Two colors",
        src,
      },
    ],
  };
  await openBoardMenu(page);
  await page.getByRole("button", { name: "Import board", exact: true }).click();
  await page.getByLabel("Hydraw board file").setInputFiles({
    name: "image.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await page.getByRole("button", { name: "Open imported board", exact: true }).click();
  await openObjects(page);
  await page.getByRole("button", { name: "Image 1 · Two colors", exact: true }).click();
  await closeOverlay(page);
  await page.mouse.move(600, 260);
  await page.mouse.down();
  await page.mouse.move(1000, 260, { steps: 15 });
  await page.mouse.up();
  const flipped = await exported(page);
  expect(flipped.shapes[0]).toMatchObject({ x: 800, y: 200, width: 200, height: 120, flipX: true });
  await expect
    .poll(() =>
      page
        .locator("canvas")
        .evaluate((canvas: HTMLCanvasElement) =>
          Array.from(
            canvas
              .getContext("2d")!
              .getImageData(850 * devicePixelRatio, 260 * devicePixelRatio, 1, 1).data,
          ),
        ),
    )
    .toEqual([0, 0, 255, 255]);
  await page.getByRole("button", { name: "Crop image", exact: true }).click();
  const right = page.getByRole("slider", { name: "Crop right edge", exact: true });
  await right.focus();
  for (let i = 0; i < 20; i++) await right.press("ArrowLeft");
  await page.getByRole("button", { name: "Apply crop", exact: true }).click();
  const cropped = await exported(page);
  expect(cropped.shapes[0]).toMatchObject({ x: 800, width: 180, flipX: true });
  const record = cropped.shapes[0]!;
  expect(record.type === "image" && record.crop?.x).toBeCloseTo(0.1);
  await page.getByRole("button", { name: "Reset crop", exact: true }).click();
  expect(await exported(page)).toEqual(flipped);
  await page.reload();
  expect(await exported(page)).toEqual(flipped);
  const pending = page.waitForEvent("download");
  await openBoardMenu(page);
  await page.getByRole("button", { name: "Export PNG", exact: true }).click();
  const stream = await (await pending).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const pixels = await page.evaluate(
    async (bytes) => {
      const image = await createImageBitmap(
        new Blob([new Uint8Array(bytes)], { type: "image/png" }),
      );
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const result = [
        Array.from(context.getImageData(148, 168, 1, 1).data),
        Array.from(context.getImageData(348, 168, 1, 1).data),
      ];
      image.close();
      return result;
    },
    Array.from(Buffer.concat(chunks)),
  );
  expect(pixels).toEqual([
    [0, 0, 255, 255],
    [255, 0, 0, 255],
  ]);
});
