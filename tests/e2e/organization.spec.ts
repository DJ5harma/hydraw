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
async function drag(page: Page, from: [number, number], to: [number, number]) {
  await closeOverlay(page);
  const box = (await page.locator("canvas").boundingBox())!;
  await page.mouse.move(box.x + from[0], box.y + from[1]);
  await page.mouse.down();
  await page.mouse.move(box.x + to[0], box.y + to[1], { steps: 6 });
  await page.mouse.up();
}

test("smart placement, group lock and ordering remain usable in the floating workspace", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await openBoardMenu(page);
  await page.getByRole("button", { name: "Import board", exact: true }).click();
  const rectangle = { type: "rectangle", width: 100, height: 80, fill: "#e7eefb" };
  await page.getByLabel("Hydraw board file").setInputFiles({
    name: "organize.hydraw.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        format: "hydraw",
        version: 4,
        name: "Organization",
        shapes: [
          { ...rectangle, id: "a", x: 300, y: 200 },
          { ...rectangle, id: "b", x: 500, y: 280 },
          { ...rectangle, id: "c", x: 700, y: 200 },
        ],
        connectors: [],
      }),
    ),
  });
  await page.getByRole("button", { name: "Open imported board", exact: true }).click();
  await drag(page, [550, 320], [550, 243]);
  expect((await exported(page)).shapes[1]!.y).toBe(200);
  await closeOverlay(page);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.keyboard.down("Alt");
  await drag(page, [550, 320], [550, 243]);
  await page.keyboard.up("Alt");
  expect((await exported(page)).shapes[1]!.y).toBe(203);
  await closeOverlay(page);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.locator("canvas").click({ position: { x: 350, y: 240 } });
  await page.locator("canvas").click({ position: { x: 550, y: 320 }, modifiers: ["Shift"] });
  await page.getByRole("button", { name: "More actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "Group", exact: true }).click();
  await page.locator("canvas").click({ position: { x: 900, y: 600 } });
  await page.locator("canvas").click({ position: { x: 350, y: 240 } });
  await expect(page.getByRole("heading", { name: "2 objects", exact: true })).toBeVisible();
  await page.keyboard.down("Alt");
  await drag(page, [350, 240], [370, 250]);
  await page.keyboard.up("Alt");
  await page.getByRole("button", { name: "More actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "Bring to front", exact: true }).click();
  await page.getByRole("button", { name: "More actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "Lock", exact: true }).click();
  const locked = await exported(page);
  expect(locked.version).toBe(9);
  expect(locked.shapes.slice(0, 2)).toMatchObject([
    { x: 320, y: 210, locked: true },
    { x: 520, y: 290, locked: true },
  ]);
  expect(locked.shapes[0]!.groupId).toBe(locked.shapes[1]!.groupId);
  expect(locked.shapes[0]!.zIndex).toBeGreaterThan(locked.shapes[2]!.zIndex!);
  await drag(page, [370, 250], [390, 270]);
  expect(await exported(page)).toEqual(locked);
  await page.reload();
  await page.locator("canvas").click({ position: { x: 370, y: 250 } });
  await page.getByRole("button", { name: "Unlock selection", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Objects on board" })).toHaveCount(0);
  const unlocked = await exported(page);
  expect(unlocked.shapes.slice(0, 2).every((shape) => !shape.locked)).toBe(true);
  await closeOverlay(page);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await exported(page)).toEqual(locked);
  await closeOverlay(page);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "More actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "Ungroup", exact: true }).click();
  await page.getByRole("button", { name: "More actions", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "Group", exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/organization-mobile.png" });
  await expect(page.getByRole("status")).toContainText("Saved in this browser");
  const saved = await exported(page);
  await page.reload();
  expect(await exported(page)).toEqual(saved);
  expect(errors).toEqual([]);
});
