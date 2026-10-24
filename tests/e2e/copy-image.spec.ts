import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { addRectangle, openBoardMenu } from "./ui.ts";

async function clipboardImage(page: Page) {
  return page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    const item = items.find((value) => value.types.includes("image/png"));
    if (!item) throw new Error("Expected a PNG clipboard item.");
    const bitmap = await createImageBitmap(await item.getType("image/png"));
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    const result = {
      width: bitmap.width,
      height: bitmap.height,
      pixel: Array.from(ctx.getImageData(0, 0, 1, 1).data),
    };
    bitmap.close();
    return result;
  });
}

test("copies a crisp selected PNG with board and transparent backgrounds", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await addRectangle(page);
  await page.getByRole("button", { name: "Copy as image", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Image copied to clipboard" }),
  ).toBeVisible();
  const opaque = await clipboardImage(page);
  expect(opaque.width).toBeGreaterThan(360);
  expect(opaque.height).toBeGreaterThan(240);
  expect(opaque.pixel).toEqual([255, 255, 255, 255]);
  await openBoardMenu(page);
  await page.getByRole("combobox", { name: "Copy image background" }).selectOption("transparent");
  await page.getByRole("button", { name: "Copy as image", exact: true }).click();
  await expect.poll(async () => (await clipboardImage(page)).pixel[3]).toBe(0);
  expect((await clipboardImage(page)).width).toBe(opaque.width);
});

test("copies a frame's enclosed contents and preserves the chosen board style", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await addRectangle(page);
  await page.locator("canvas").focus();
  await page.keyboard.press("Control+a");
  await page.getByRole("button", { name: "More actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "Frame selection", exact: true }).click();
  await page.getByRole("button", { name: "Copy as image", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Image copied to clipboard" }),
  ).toBeVisible();
  expect((await clipboardImage(page)).width).toBeGreaterThan(360);
  await openBoardMenu(page);
  await page.getByRole("combobox", { name: "Board style" }).selectOption("blueprint");
  await page.getByRole("button", { name: "Copy as image", exact: true }).click();
  await expect.poll(async () => (await clipboardImage(page)).pixel).toEqual([23, 63, 99, 255]);
});

test("clipboard denial is visible and leaves the board and history intact", async ({ page }) => {
  await page.goto("/");
  await addRectangle(page);
  await page.evaluate(() =>
    Object.defineProperty(navigator.clipboard, "write", {
      configurable: true,
      value: () => Promise.reject(new DOMException("Denied", "NotAllowedError")),
    }),
  );
  await page.getByRole("button", { name: "Copy as image", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Could not copy the image");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Create your first diagram" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
});
