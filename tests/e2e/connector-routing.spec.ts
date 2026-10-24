import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { BoardDocument } from "../../packages/document/src/index.ts";
import { closeOverlay, openBoardMenu, openObjects } from "./ui.ts";

async function exported(page: Page): Promise<BoardDocument> {
  const pending = page.waitForEvent("download");
  await openBoardMenu(page);
  await page.getByRole("button", { name: "Export board", exact: true }).click();
  const stream = await (await pending).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as BoardDocument;
}

test("routes an attached connector, edits its bend once, cancels, persists and exports the full path", async ({
  page,
}) => {
  const fixture = {
    format: "hydraw",
    version: 1,
    theme: "clean",
    name: "Elbow flow",
    shapes: [
      { id: "a", type: "rectangle", x: 500, y: 180, width: 160, height: 100, fill: "#e7eefb" },
      { id: "b", type: "rectangle", x: 1000, y: 440, width: 160, height: 100, fill: "#e6f2ea" },
    ],
    connectors: [
      {
        id: "edge",
        type: "connector",
        start: { type: "binding", shapeId: "a" },
        end: { type: "binding", shapeId: "b" },
        color: "#202124",
        arrowhead: "arrow",
      },
    ],
  };
  await page.goto("/");
  await openBoardMenu(page);
  await page.getByRole("button", { name: "Import board", exact: true }).click();
  await page.getByLabel("Hydraw board file").setInputFiles({
    name: "elbow.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await page.getByRole("button", { name: "Open imported board", exact: true }).click();
  await openObjects(page);
  await page.getByRole("button", { name: "Connector 1", exact: true }).click();
  await closeOverlay(page);
  await page.getByRole("button", { name: "Elbow", exact: true }).click();
  await expect(page.getByRole("button", { name: "Horizontal ends", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.mouse.move(830, 360);
  await page.mouse.down();
  await page.mouse.move(900, 360, { steps: 12 });
  await page.mouse.up();
  const bendPosition = page.getByRole("spinbutton", { name: "Bend position", exact: true });
  await expect(bendPosition).toHaveValue("900");
  await bendPosition.fill("920");
  await bendPosition.press("Enter");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(bendPosition).toHaveValue("900");
  const manual = await exported(page);
  expect(manual.connectors[0]!.route).toEqual({ type: "elbow", axis: "x", position: 900 });
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await exported(page)).connectors[0]!.route).toEqual({ type: "elbow", axis: "x" });
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.mouse.move(900, 360);
  await page.mouse.down();
  await page.mouse.move(950, 360, { steps: 8 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect(await exported(page)).toEqual(manual);
  await page.screenshot({ path: "test-results/elbow-connector-desktop.png" });
  await page.reload();
  expect(await exported(page)).toEqual(manual);
  await openObjects(page);
  await page.getByRole("button", { name: "Connector 1", exact: true }).click();
  await closeOverlay(page);
  await page.getByRole("button", { name: "Reset bend", exact: true }).click();
  await page.getByRole("button", { name: "Vertical ends", exact: true }).click();
  expect((await exported(page)).connectors[0]!.route).toEqual({ type: "elbow", axis: "y" });
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  const svgPending = page.waitForEvent("download");
  await openBoardMenu(page);
  await page.getByRole("button", { name: "Export SVG", exact: true }).click();
  const svgStream = await (await svgPending).createReadStream();
  const svgChunks: Buffer[] = [];
  for await (const chunk of svgStream!) svgChunks.push(Buffer.from(chunk));
  const svg = Buffer.concat(svgChunks).toString();
  expect(svg).toContain("M 660 230 L 900 230 L 900 490 L 1000 490");
  const pngPending = page.waitForEvent("download");
  await openBoardMenu(page);
  await page.getByRole("button", { name: "Export PNG", exact: true }).click();
  const pngStream = await (await pngPending).createReadStream();
  const pngChunks: Buffer[] = [];
  for await (const chunk of pngStream!) pngChunks.push(Buffer.from(chunk));
  const png = Buffer.concat(pngChunks);
  expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const viewBox = /viewBox="([^"]+)"/.exec(svg)![1]!.split(" ").map(Number);
  const pixelCheck = await page.evaluate(
    async ({ bytes, viewBox }) => {
      const image = await createImageBitmap(
        new Blob([new Uint8Array(bytes)], { type: "image/png" }),
      );
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const pixel = (x: number, y: number) =>
        Array.from(
          context.getImageData(
            Math.round(((x - viewBox[0]!) * image.width) / viewBox[2]!),
            Math.round(((y - viewBox[1]!) * image.height) / viewBox[3]!),
            1,
            1,
          ).data,
        );
      const result = { onRoute: pixel(900, 360), offRoute: pixel(830, 360) };
      image.close();
      return result;
    },
    { bytes: Array.from(png), viewBox },
  );
  expect(pixelCheck.onRoute[0]).toBeLessThan(100);
  expect(pixelCheck.onRoute[3]).toBe(255);
  expect(pixelCheck.offRoute[3]).toBe(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "Elbow", exact: true })).toBeInViewport();
  await page.screenshot({ path: "test-results/elbow-connector-mobile.png" });
  await page.getByRole("button", { name: "Straight", exact: true }).click();
  expect((await exported(page)).connectors[0]!.route).toBeUndefined();
});
