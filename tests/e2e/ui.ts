import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

export async function openBoardMenu(page: Page) {
  if (!(await page.getByRole("dialog", { name: "Board menu", exact: true }).isVisible()))
    await page.getByRole("button", { name: "Board menu", exact: true }).click();
}
export async function openObjects(page: Page) {
  if (await page.getByRole("dialog", { name: "Objects on board", exact: true }).isVisible()) return;
  await openBoardMenu(page);
  await page.getByRole("button", { name: "Objects", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Objects on board", exact: true })).toBeVisible();
}
export async function closeOverlay(page: Page) {
  const close = page
    .locator('[data-workspace-overlay-root] [role="dialog"] button')
    .and(page.getByRole("button", { name: /^Close / }))
    .first();
  if (await close.isVisible()) await close.click();
  else if (await page.locator('[data-workspace-overlay-root] [role="dialog"]').count()) {
    await page.getByRole("button", { name: "Board menu", exact: true }).click();
  }
}
export async function addRectangle(page: Page) {
  await closeOverlay(page);
  await page.locator("canvas").focus();
  await page.keyboard.press("r");
  await page.keyboard.press("Enter");
}
export async function addText(page: Page) {
  await closeOverlay(page);
  await page.getByRole("button", { name: "Text (T)", exact: true }).click();
  await page.keyboard.press("Enter");
}
export async function openGeometry(page: Page) {
  if (await page.getByRole("dialog", { name: "Precise geometry", exact: true }).isVisible()) return;
  await closeOverlay(page);
  await page.getByRole("button", { name: "More properties", exact: true }).click();
}
export async function openStyle(page: Page) {
  await closeOverlay(page);
  await expect(
    page.getByRole("region", { name: "Selection properties", exact: true }),
  ).toBeVisible();
}
