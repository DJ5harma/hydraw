import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { BoardDocument } from "../../packages/document/src/index.ts";
import { addRectangle, closeOverlay, openBoardMenu, openGeometry } from "./ui.ts";

async function field(page: Page, name: string, value: number) {
  const input = page.getByRole("spinbutton", { name, exact: true });
  await input.fill(String(value));
  await input.press("Enter");
}

async function makeNodes(page: Page) {
  await page.goto("/");
  for (const x of [100, 550]) {
    await addRectangle(page);
    await openGeometry(page);
    await field(page, "Rectangle x", x);
    await field(page, "Rectangle y", 200);
  }
}

async function drag(page: Page, start: { x: number; y: number }, end: { x: number; y: number }) {
  const box = (await page.locator("canvas").boundingBox())!;
  await page.mouse.move(box.x + start.x, box.y + start.y);
  await page.mouse.down();
  await page.mouse.move(box.x + end.x, box.y + end.y, { steps: 6 });
  await page.mouse.up();
}

async function clickCanvas(page: Page, point: { x: number; y: number }) {
  const box = (await page.locator("canvas").boundingBox())!;
  await page.mouse.click(box.x + point.x, box.y + point.y);
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

test("shows connection handles, creates and labels a connected node, and undoes it atomically", async ({
  page,
}) => {
  await makeNodes(page);
  await closeOverlay(page);
  await clickCanvas(page, { x: 190, y: 260 });
  await page.mouse.move(
    (await page.locator("canvas").boundingBox())!.x + 280,
    (await page.locator("canvas").boundingBox())!.y + 260,
  );
  await expect(page.locator("canvas")).toHaveCSS("cursor", "crosshair");

  const original = await exportBoard(page);
  await closeOverlay(page);
  await drag(page, { x: 280, y: 260 }, { x: 400, y: 260 });
  const label = page.getByRole("textbox", { name: "Edit canvas text", exact: true });
  await expect(label).toBeVisible();
  await label.fill("New service");
  await label.press("Control+Enter");
  const created = await exportBoard(page);
  expect(created.shapes).toHaveLength(3);
  expect(created.connectors).toHaveLength(1);
  const added = created.shapes[2]!;
  expect(added).toMatchObject({
    label: { text: "New service" },
    x: 310,
    y: 200,
    width: 180,
    height: 120,
  });
  expect(created.connectors[0]).toMatchObject({
    start: { type: "binding", shapeId: original.shapes[0]!.id },
    end: { type: "binding", shapeId: added.id },
  });

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  const withoutLabel = await exportBoard(page);
  expect(withoutLabel.shapes).toHaveLength(3);
  expect(withoutLabel.shapes[2]).not.toHaveProperty("label");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  const undone = await exportBoard(page);
  expect(undone.shapes).toEqual(original.shapes);
  expect(undone.connectors).toEqual(original.connectors);
});

test("connects an existing node, cancels empty creation, and keeps C as a free-point connector tool", async ({
  page,
}) => {
  await makeNodes(page);
  await closeOverlay(page);
  await clickCanvas(page, { x: 190, y: 260 });
  const before = await exportBoard(page);
  await closeOverlay(page);
  await drag(page, { x: 280, y: 260 }, { x: 640, y: 260 });
  const connected = await exportBoard(page);
  expect(connected.shapes).toEqual(before.shapes);
  expect(connected.connectors).toHaveLength(1);
  expect(connected.connectors[0]).toMatchObject({
    start: { type: "binding", shapeId: before.shapes[0]!.id },
    end: { type: "binding", shapeId: before.shapes[1]!.id },
  });

  await closeOverlay(page);
  await clickCanvas(page, { x: 190, y: 260 });
  const box = (await page.locator("canvas").boundingBox())!;
  await page.mouse.move(box.x + 280, box.y + 260);
  await page.mouse.down();
  await page.mouse.move(box.x + 400, box.y + 450, { steps: 4 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect(await exportBoard(page)).toEqual(connected);

  await closeOverlay(page);
  await page.locator("canvas").focus();
  await page.keyboard.press("c");
  await drag(page, { x: 850, y: 500 }, { x: 1050, y: 500 });
  const freePoint = await exportBoard(page);
  expect(freePoint.shapes).toEqual(connected.shapes);
  expect(freePoint.connectors).toHaveLength(2);
  expect(freePoint.connectors[1]).toMatchObject({
    start: { type: "point", x: 850, y: 500 },
    end: { type: "point", x: 1050, y: 500 },
  });
});
