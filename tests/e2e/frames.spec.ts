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
test("insert, name, move, navigate and export a frame of editable preset nodes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Insert", exact: true }).click();
  await page.getByRole("button", { name: /Request flow/ }).click();
  await expect(page.getByRole("heading", { name: "5 objects", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "More actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "Frame selection", exact: true }).click();
  const name = page.getByRole("textbox", { name: "Frame name", exact: true });
  await name.fill("Public API");
  await name.press("Enter");
  const framed = await exported(page);
  expect(framed.version).toBe(10);
  expect(
    framed.shapes.filter((shape) => shape.type === "rectangle" && shape.kind === "frame"),
  ).toHaveLength(1);
  await closeOverlay(page);
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  const frame = framed.shapes.find(
    (shape) => shape.type === "rectangle" && shape.kind === "frame",
  )!;
  const canvas = (await page.locator("canvas").boundingBox())!;
  await page.keyboard.down("Alt");
  await page.mouse.move(canvas.x + frame.x + 40, canvas.y + frame.y - 20);
  await page.mouse.down();
  await page.mouse.move(canvas.x + frame.x + 80, canvas.y + frame.y, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up("Alt");
  const moved = await exported(page);
  expect(moved.shapes.map((shape) => [shape.x, shape.y])).toEqual(
    framed.shapes.map((shape) => [shape.x + 40, shape.y + 20]),
  );
  await closeOverlay(page);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await exported(page)).toEqual(framed);
  await openObjects(page);
  await page.getByRole("button", { name: "Go to frame Public API", exact: true }).click();
  await expect(name).toHaveValue("Public API");
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export frame SVG", exact: true }).click();
  const stream = await (await pending).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const svg = Buffer.concat(chunks).toString("utf8");
  expect(svg).toContain("Public API");
  expect(svg).toContain("Database");
  await page.screenshot({ path: "test-results/frames-desktop.png" });
  await expect(page.getByRole("status")).toContainText("Saved in this browser");
  await page.reload();
  expect(await exported(page)).toEqual(framed);
  await closeOverlay(page);
  await page.setViewportSize({ width: 320, height: 740 });
  await expect(page.getByRole("button", { name: "Diamond (D)", exact: true })).toBeInViewport();
  await page.getByRole("button", { name: "Insert", exact: true }).click();
  await expect(page.getByRole("button", { name: /Async worker/ })).toBeInViewport();
  await page.screenshot({ path: "test-results/frames-insert-mobile.png" });
  await closeOverlay(page);
  await page.locator("canvas").focus();
  await page.keyboard.press("f");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("textbox", { name: "Frame name", exact: true })).toHaveValue(
    "Frame 2",
  );
  expect(
    (await exported(page)).shapes.filter(
      (shape) => shape.type === "rectangle" && shape.kind === "frame",
    ),
  ).toHaveLength(2);
  expect(errors).toEqual([]);
});
