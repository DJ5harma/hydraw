import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { BoardDocument } from "../../packages/document/src/index.ts";
import { closeOverlay, openBoardMenu } from "./ui.ts";
async function exported(page: Page): Promise<BoardDocument> {
  const pending = page.waitForEvent("download");
  await openBoardMenu(page);
  await page.getByRole("button", { name: "Export board", exact: true }).click();
  const stream = await (await pending).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as BoardDocument;
}
test("context actions preserve selection, support locks, clipboard, keyboard and touch", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    let text = "";
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          text = value;
        },
        readText: async () => text,
      },
    });
  });
  await page.goto("/");
  await openBoardMenu(page);
  await page.getByRole("button", { name: "Import board", exact: true }).click();
  const rectangle = { type: "rectangle", width: 100, height: 80, fill: "#e7eefb" };
  await page.getByLabel("Hydraw board file").setInputFiles({
    name: "context.hydraw.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        format: "hydraw",
        version: 6,
        name: "Context actions",
        connectors: [],
        shapes: [
          { ...rectangle, id: "a", x: 300, y: 200 },
          { ...rectangle, id: "b", x: 500, y: 280 },
        ],
      }),
    ),
  });
  await page.getByRole("button", { name: "Open imported board", exact: true }).click();
  const canvas = page.locator("canvas");
  const menu = page.getByRole("menu", { name: "Canvas actions", exact: true });
  const action = (name: string) => page.getByRole("menuitem", { name, exact: true });
  await canvas.click({ button: "right", position: { x: 350, y: 240 } });
  await expect(action("Copy")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(action("Cut")).toBeFocused();
  await page.keyboard.press("End");
  await expect(action("Delete")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(canvas).toBeFocused();
  await canvas.click({ position: { x: 550, y: 320 }, modifiers: ["Shift"] });
  await canvas.click({ button: "right", position: { x: 550, y: 320 } });
  await action("Group").click();
  await expect(page.getByRole("heading", { name: "2 objects", exact: true })).toBeVisible();
  await canvas.click({ button: "right", position: { x: 350, y: 240 } });
  await action("Lock").click();
  await canvas.click({ button: "right", position: { x: 350, y: 240 } });
  await expect(menu.getByRole("menuitem")).toHaveCount(2);
  await action("Unlock").click();
  await canvas.click({ button: "right", position: { x: 350, y: 240 } });
  await action("Copy").click();
  await canvas.focus();
  await page.keyboard.press("Shift+F10");
  const copied = await page.evaluate(() => {
    const clipboardData = new DataTransfer();
    document.dispatchEvent(
      new ClipboardEvent("copy", { clipboardData, bubbles: true, cancelable: true }),
    );
    return clipboardData.getData("text/plain");
  });
  expect(copied).toContain("hydraw/selection");
  await expect(menu).toHaveCount(0);
  await canvas.click({ button: "right", position: { x: 1380, y: 840 } });
  await expect(action("Group")).toHaveCount(0);
  const box = (await menu.boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(1440);
  expect(box.y + box.height).toBeLessThanOrEqual(900);
  await action("Paste").click();
  await expect(page.getByRole("heading", { name: "2 objects", exact: true })).toBeVisible();
  const pasted = await exported(page);
  expect(pasted.shapes).toHaveLength(4);
  expect(pasted.shapes[2]!.groupId).not.toBe(pasted.shapes[0]!.groupId);
  await closeOverlay(page);
  await canvas.focus();
  await page.keyboard.press("Shift+F10");
  await action("Frame selection").click();
  await canvas.focus();
  await page.keyboard.press("Shift+F10");
  await expect(action("Rename frame")).toBeVisible();
  await expect(action("Delete frame (keep contents)")).toBeVisible();
  await action("Rename frame").click();
  const draft = page.getByRole("textbox", { name: "Edit canvas text", exact: true });
  await expect(draft).toBeFocused();
  await draft.fill("Copied flow");
  await draft.press("Control+Enter");
  await canvas.focus();
  await page.keyboard.press("Shift+F10");
  await expect(action("Export frame PNG")).toBeVisible();
  await page.screenshot({ path: "test-results/context-frame.png" });
  await page.keyboard.press("Escape");
  const name = page.getByRole("textbox", { name: "Frame name", exact: true });
  await expect(name).toHaveValue("Copied flow");
  await name.click({ button: "right" });
  await expect(menu).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  const beforeTouch = await exported(page);
  await closeOverlay(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 200, y: 400 }],
  });
  await expect(menu).toBeVisible();
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(action("Draw frame")).toBeVisible();
  const touchBox = (await menu.boundingBox())!;
  expect(touchBox.x + touchBox.width).toBeLessThanOrEqual(390);
  expect(touchBox.y + touchBox.height).toBeLessThanOrEqual(844);
  await page.screenshot({ path: "test-results/context-touch.png" });
  await page.keyboard.press("Escape");
  expect(await exported(page)).toEqual(beforeTouch);
  expect(errors).toEqual([]);
});
