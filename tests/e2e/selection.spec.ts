import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { BoardDocument } from "../../packages/document/src/index.ts";
import { closeOverlay, openBoardMenu, openObjects } from "./ui.ts";

const rectangle = { type: "rectangle", y: 200, width: 140, height: 100, fill: "#e7eefb" };
const connector = { type: "connector", color: "#243e33", arrowhead: "arrow" };
const fixture = {
  format: "hydraw",
  version: 2,
  name: "Selection playground",
  shapes: [
    { ...rectangle, id: "a", x: 100 },
    { ...rectangle, id: "b", x: 400 },
    {
      id: "text",
      type: "text",
      text: "A shared document",
      x: 780,
      y: 200,
      width: 240,
      height: 42,
      fontSize: 24,
      fontWeight: 400,
      textAlign: "left",
      color: "#243e33",
    },
  ],
  connectors: [
    {
      ...connector,
      id: "internal",
      start: { type: "binding", shapeId: "a" },
      end: { type: "binding", shapeId: "b" },
    },
    {
      ...connector,
      id: "external",
      start: { type: "binding", shapeId: "b" },
      end: { type: "binding", shapeId: "text" },
    },
    {
      ...connector,
      id: "free",
      start: { type: "point", x: 140, y: 440 },
      end: { type: "point", x: 440, y: 440 },
    },
  ],
};
async function open(page: Page) {
  await page.goto("/");
  await openBoardMenu(page);
  await page.getByRole("button", { name: "Import board", exact: true }).click();
  await page.getByLabel("Hydraw board file").setInputFiles({
    name: "selection.hydraw.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await page.getByRole("button", { name: "Open imported board", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function exported(page: Page): Promise<BoardDocument> {
  const pending = page.waitForEvent("download");
  await openBoardMenu(page);
  await page.getByRole("button", { name: "Export board", exact: true }).click();
  const stream = await (await pending).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as BoardDocument;
}
async function drag(page: Page, from: [number, number], to: [number, number]) {
  const box = (await page.locator("canvas").boundingBox())!;
  await page.mouse.move(box.x + from[0], box.y + from[1]);
  await page.mouse.down();
  await page.mouse.move(box.x + to[0], box.y + to[1], { steps: 6 });
  await page.mouse.up();
}
const object = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

test("Shift-click selects nodes on canvas and in the list, and group movement is one undoable action", async ({
  page,
}) => {
  await open(page);
  const original = await exported(page);
  await page.locator("canvas").click({ position: { x: 170, y: 250 } });
  await page.locator("canvas").click({ position: { x: 470, y: 250 }, modifiers: ["Shift"] });
  await openObjects(page);
  await expect(object(page, "Rectangle 1")).toHaveAttribute("aria-pressed", "true");
  await expect(object(page, "Rectangle 2")).toHaveAttribute("aria-pressed", "true");
  await closeOverlay(page);
  await page.locator("canvas").click({ position: { x: 470, y: 250 }, modifiers: ["Shift"] });
  await openObjects(page);
  await expect(object(page, "Rectangle 2")).toHaveAttribute("aria-pressed", "false");
  await object(page, "Rectangle 2").click({ modifiers: ["Shift"] });
  await closeOverlay(page);
  await expect(page.getByRole("heading", { name: "2 objects", exact: true })).toBeVisible();
  await drag(page, [170, 250], [210, 280]);
  const moved = await exported(page);
  expect(moved.shapes.slice(0, 2)).toMatchObject([
    { x: 140, y: 230 },
    { x: 440, y: 230 },
  ]);
  expect(moved.connectors).toEqual(original.connectors);
  await object(page, "Undo").click();
  expect(await exported(page)).toEqual(original);
  await object(page, "Redo").click();
  expect(await exported(page)).toEqual(moved);
  await page.locator("canvas").focus();
  await page.keyboard.press("Shift+ArrowRight");
  expect((await exported(page)).shapes.slice(0, 2)).toMatchObject([{ x: 150 }, { x: 450 }]);
});

test("reverse and additive marquees include enclosed arrows and Escape restores the previous selection", async ({
  page,
}) => {
  await open(page);
  await openObjects(page);
  await object(page, "Connector 3").click();
  await closeOverlay(page);
  const box = (await page.locator("canvas").boundingBox())!;
  await page.mouse.move(box.x + 560, box.y + 330);
  await page.mouse.down();
  await page.mouse.move(box.x + 80, box.y + 180, { steps: 6 });
  await expect(page.getByRole("navigation", { name: "Selection actions" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await openObjects(page);
  await expect(object(page, "Connector 3")).toHaveAttribute("aria-pressed", "true");
  await expect(object(page, "Rectangle 1")).toHaveAttribute("aria-pressed", "false");
  await closeOverlay(page);
  await page.keyboard.down("Shift");
  await drag(page, [80, 180], [560, 330]);
  await page.keyboard.up("Shift");
  await expect(page.getByRole("heading", { name: "4 objects", exact: true })).toBeVisible();
  await openObjects(page);
  await expect(object(page, "Connector 1")).toHaveAttribute("aria-pressed", "true");
  await expect(object(page, "Connector 2")).toHaveAttribute("aria-pressed", "false");
  const before = await exported(page);
  await closeOverlay(page);
  await page.mouse.move(box.x + 170, box.y + 250);
  await page.mouse.down();
  await page.mouse.move(box.x + 230, box.y + 290);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect(await exported(page)).toEqual(before);
  await expect(page.getByRole("heading", { name: "4 objects", exact: true })).toBeVisible();
  await page.locator("canvas").click({ position: { x: 700, y: 500 } });
  await closeOverlay(page);
  await drag(page, [560, 330], [80, 180]);
  await expect(page.getByRole("heading", { name: "3 objects", exact: true })).toBeVisible();
  await object(page, "Delete selection").click();
  const after = await exported(page);
  expect(after.shapes).toHaveLength(1);
  expect(after.connectors.map((edge) => edge.id)).toEqual(["free"]);
  await object(page, "Undo").click();
  expect(await exported(page)).toEqual(before);
});

test("duplicates a connected graph with new identities in one step and preserves copies after reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await open(page);
  const original = await exported(page);
  await openObjects(page);
  await object(page, "Rectangle 1").click();
  await object(page, "Rectangle 2").click({ modifiers: ["Shift"] });
  await closeOverlay(page);
  await object(page, "Duplicate selection").click();
  await expect(page.getByRole("heading", { name: "3 objects", exact: true })).toBeVisible();
  const copied = await exported(page);
  expect(copied.shapes).toHaveLength(5);
  expect(copied.connectors).toHaveLength(4);
  expect(copied.shapes.slice(3)).toMatchObject([
    { x: 124, y: 224 },
    { x: 424, y: 224 },
  ]);
  expect(copied.connectors[3]).toMatchObject({
    start: { type: "binding", shapeId: copied.shapes[3]!.id },
    end: { type: "binding", shapeId: copied.shapes[4]!.id },
  });
  expect(new Set([...copied.shapes, ...copied.connectors].map((item) => item.id)).size).toBe(9);
  await page.locator("canvas").focus();
  await page.keyboard.press("Control+d");
  const twice = await exported(page);
  expect(twice.shapes).toHaveLength(7);
  expect(twice.connectors).toHaveLength(5);
  expect(twice.connectors[4]).toMatchObject({
    start: { shapeId: twice.shapes[5]!.id },
    end: { shapeId: twice.shapes[6]!.id },
  });
  await object(page, "Undo").click();
  expect(await exported(page)).toEqual(copied);
  await object(page, "Undo").click();
  expect(await exported(page)).toEqual(original);
  await object(page, "Redo").click();
  expect(await exported(page)).toEqual(copied);
  await expect(page.getByRole("status")).toContainText("Saved in this browser");
  await page.reload();
  expect(await exported(page)).toEqual(copied);
  expect(copied).not.toHaveProperty("selectedIds");
  expect(errors).toEqual([]);
});

test("copies external edges independently and scopes Select All to the canvas instead of text inputs", async ({
  page,
}) => {
  await open(page);
  await openObjects(page);
  await object(page, "Rectangle 2").click();
  await object(page, "Connector 2").click({ modifiers: ["Shift"] });
  await closeOverlay(page);
  await page.locator("canvas").focus();
  await page.keyboard.press("Control+d");
  const copied = await exported(page);
  expect(copied.shapes).toHaveLength(4);
  expect(copied.connectors).toHaveLength(4);
  expect(copied.connectors[3]?.start).toEqual({ type: "binding", shapeId: copied.shapes[3]!.id });
  expect(copied.connectors[3]?.end.type).toBe("point");
  await openBoardMenu(page);
  const name = page.getByRole("textbox", { name: "Board name", exact: true });
  await name.focus();
  await name.press("Control+a");
  await expect(object(page, "Delete selection")).toHaveCount(0);
  await closeOverlay(page);
  await page.locator("canvas").focus();
  await page.keyboard.press("Control+a");
  await expect(page.getByRole("heading", { name: "8 objects", exact: true })).toBeVisible();
  await page.keyboard.press("Delete");
  const empty = await exported(page);
  expect(empty.shapes).toHaveLength(0);
  expect(empty.connectors).toHaveLength(0);
  await object(page, "Undo").click();
  expect(await exported(page)).toEqual(copied);
  await openObjects(page);
  await page.getByRole("button", { name: /^Text 3/ }).click();
  await closeOverlay(page);
  await object(page, "Text style").click();
  await object(page, "Edit text").click();
  const text = page.getByRole("textbox", { name: "Edit canvas text", exact: true });
  await text.press("Control+a");
  await text.press("Escape");
  await expect(object(page, "Text style")).toBeVisible();
  expect(await exported(page)).toEqual(copied);
});
