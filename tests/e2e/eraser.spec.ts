import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { BoardDocument } from "../../packages/document/src/index.ts";
import { closeOverlay, openBoardMenu } from "./ui.ts";

async function point(page: Page, local: { x: number; y: number }) {
  const bounds = (await page.locator("canvas").boundingBox())!;
  return { x: bounds.x + local.x, y: bounds.y + local.y };
}

async function stroke(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const start = await point(page, from);
  const end = await point(page, to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
}

async function exportBoard(page: Page): Promise<BoardDocument> {
  await closeOverlay(page);
  await openBoardMenu(page);
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export board", exact: true }).click();
  const stream = await (await pending).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as BoardDocument;
}

test("E erases every crossed stroke in one undo step and Escape cancels the sweep", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("canvas").focus();
  await page.keyboard.press("p");
  await stroke(page, { x: 200, y: 280 }, { x: 450, y: 280 });
  await stroke(page, { x: 650, y: 280 }, { x: 900, y: 280 });
  const before = await exportBoard(page);
  expect(before.shapes).toHaveLength(2);

  await closeOverlay(page);
  await page.locator("canvas").focus();
  await page.keyboard.press("e");
  await stroke(page, { x: 100, y: 280 }, { x: 1000, y: 280 });
  expect((await exportBoard(page)).shapes).toHaveLength(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await exportBoard(page)).shapes).toEqual(before.shapes);

  await closeOverlay(page);
  await page.locator("canvas").focus();
  const start = await point(page, { x: 100, y: 280 });
  const end = await point(page, { x: 1000, y: 280 });
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect(await exportBoard(page)).toEqual(before);
});
