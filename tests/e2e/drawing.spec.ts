import { expect, test } from "@playwright/test";
import type { BoardDocument } from "../../packages/document/src/index.ts";
import { closeOverlay, openBoardMenu } from "./ui.ts";

async function canvasPoint(page: import("@playwright/test").Page, point: { x: number; y: number }) {
  const box = (await page.locator("canvas").boundingBox())!;
  return { x: box.x + point.x, y: box.y + point.y };
}

async function drawPath(
  page: import("@playwright/test").Page,
  points: readonly { x: number; y: number }[],
) {
  const first = await canvasPoint(page, points[0]!);
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  for (const point of points.slice(1)) {
    const next = await canvasPoint(page, point);
    await page.mouse.move(next.x, next.y, { steps: 1 });
  }
}

async function exportBoard(page: import("@playwright/test").Page): Promise<BoardDocument> {
  await closeOverlay(page);
  await openBoardMenu(page);
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export board", exact: true }).click();
  const stream = await (await pending).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as BoardDocument;
}

function rectanglePath(x = 500, y = 300, width = 120, height = 90) {
  return [
    { x, y },
    { x: x + width / 3, y },
    { x: x + (width * 2) / 3, y },
    { x: x + width, y },
    { x: x + width, y: y + height / 3 },
    { x: x + width, y: y + (height * 2) / 3 },
    { x: x + width, y: y + height },
    { x: x + (width * 2) / 3, y: y + height },
    { x: x + width / 3, y: y + height },
    { x, y: y + height },
    { x, y: y + (height * 2) / 3 },
    { x, y: y + height / 3 },
    { x, y },
  ];
}

test("draw style and freehand strokes persist, undo and export", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Draw (P)", exact: true }).click();
  await page.getByRole("button", { name: "Blue drawing", exact: true }).click();
  const width = page.getByRole("spinbutton", { name: "Drawing width", exact: true });
  await width.fill("5");
  await width.press("Enter");
  await drawPath(page, [
    { x: 250, y: 250 },
    { x: 280, y: 265 },
    { x: 310, y: 240 },
    { x: 340, y: 280 },
  ]);
  await page.mouse.up();

  const drawn = await exportBoard(page);
  expect(drawn.version).toBe(9);
  expect(drawn.shapes).toHaveLength(1);
  expect(drawn.shapes[0]).toMatchObject({ type: "ink", color: "#3568db", strokeWidth: 5 });
  const ink = drawn.shapes[0]!;
  if (ink.type !== "ink") throw new Error("Expected a freehand shape.");
  expect(ink.points.length).toBeGreaterThan(2);
  expect(
    ink.points.every((point) => point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1),
  ).toBe(true);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await exportBoard(page)).shapes).toHaveLength(0);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await openBoardMenu(page);
  await expect(
    page
      .getByRole("dialog", { name: "Board menu" })
      .getByText("Saved in this browser", { exact: true }),
  ).toBeVisible({ timeout: 5_000 });
  await page.reload();
  expect((await exportBoard(page)).shapes[0]).toMatchObject({
    type: "ink",
    color: "#3568db",
    strokeWidth: 5,
  });
});

test("a stationary closed rectangle or ellipse is recognized after the hold", async ({ page }) => {
  await page.goto("/");
  await page.locator("canvas").focus();
  await page.keyboard.press("p");
  await drawPath(page, rectanglePath());
  await page.waitForTimeout(650);
  await page.mouse.up();
  expect((await exportBoard(page)).shapes[0]).toMatchObject({
    type: "rectangle",
    x: 500,
    y: 300,
    width: 120,
    height: 90,
  });

  await closeOverlay(page);
  const ellipse = Array.from({ length: 33 }, (_, i) => {
    const angle = (i / 32) * Math.PI * 2;
    return { x: 800 + Math.cos(angle) * 70, y: 400 + Math.sin(angle) * 45 };
  });
  await drawPath(page, ellipse);
  await page.waitForTimeout(650);
  await page.mouse.up();
  expect((await exportBoard(page)).shapes[1]).toMatchObject({
    type: "rectangle",
    kind: "ellipse",
    x: 730,
    y: 355,
    width: 140,
    height: 90,
  });
});

test("movement after recognition resumes ink, while Escape cancels without history", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("canvas").focus();
  await page.keyboard.press("p");
  await drawPath(page, rectanglePath(300, 250));
  await page.waitForTimeout(650);
  const moved = await canvasPoint(page, { x: 330, y: 250 });
  await page.mouse.move(moved.x, moved.y);
  await page.mouse.up();
  expect((await exportBoard(page)).shapes[0]?.type).toBe("ink");

  await closeOverlay(page);
  const before = await exportBoard(page);
  await closeOverlay(page);
  await drawPath(page, [
    { x: 200, y: 200 },
    { x: 240, y: 230 },
    { x: 280, y: 200 },
  ]);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect(await exportBoard(page)).toEqual(before);
});

test("drawing after zoom and pan keeps valid world geometry", async ({ page }) => {
  await page.goto("/");
  await page.locator("canvas").focus();
  await page.keyboard.press("h");
  const start = await canvasPoint(page, { x: 400, y: 400 });
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 80, start.y + 45);
  await page.mouse.up();
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -300);
  await page.keyboard.up("Control");
  await page.keyboard.press("p");
  await drawPath(page, [
    { x: 500, y: 350 },
    { x: 540, y: 370 },
    { x: 580, y: 340 },
  ]);
  await page.mouse.up();
  const exported = await exportBoard(page);
  expect(exported.shapes[0]).toMatchObject({ type: "ink" });
  const ink = exported.shapes[0]!;
  if (ink.type !== "ink") throw new Error("Expected a freehand shape.");
  expect(ink.x).toBeGreaterThan(0);
  expect(
    ink.points.every((point) => point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1),
  ).toBe(true);
});
