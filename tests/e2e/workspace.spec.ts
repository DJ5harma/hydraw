import { expect, test } from "@playwright/test";

test("desktop header stays compact and closing the inspector preserves the board", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const header = page.locator("header.topbar");
  const headerBox = await header.boundingBox();
  expect(headerBox?.height).toBeLessThanOrEqual(60);

  const inspector = page.locator("#board-inspector");
  await expect(inspector).toBeVisible();
  await page.getByRole("button", { name: "Add rectangle", exact: true }).click();
  await expect(page.getByRole("button", { name: "Rectangle 1", exact: true })).toBeVisible();

  const canvas = page.locator("canvas");
  const openWidth = (await canvas.boundingBox())!.width;
  const toggle = page.getByRole("button", { name: "Toggle inspector", exact: true });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(inspector).toBeHidden();
  const closedWidth = (await canvas.boundingBox())!.width;
  expect(closedWidth).toBeGreaterThan(openWidth);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: "Rectangle 1", exact: true })).toBeVisible();
});

test("board name editing cancels with Escape and commits with Enter", async ({ page }) => {
  await page.goto("/");
  const name = page.getByRole("textbox", { name: "Board name", exact: true });

  await name.fill("Discard this name");
  await name.press("Escape");
  await expect(name).toHaveValue("Untitled board");

  await name.fill("Planning board");
  await name.press("Enter");
  await expect(name).toHaveValue("Planning board");
});

test("keyboard shortcuts reference closes by button, Escape, and outside click without changing selection", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add rectangle", exact: true }).click();
  const rectangle = page.getByRole("button", { name: "Rectangle 1", exact: true });
  await rectangle.click();
  const shortcuts = page.getByRole("dialog", { name: "Keyboard shortcuts reference" });
  const trigger = page.getByRole("button", { name: "Keyboard shortcuts", exact: true });

  await trigger.click();
  await expect(shortcuts).toBeVisible();
  await shortcuts.getByRole("button", { name: "Close keyboard shortcuts" }).click();
  await expect(shortcuts).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(rectangle).toHaveAttribute("aria-pressed", "true");

  await trigger.click();
  await expect(shortcuts).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(shortcuts).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(rectangle).toHaveAttribute("aria-pressed", "true");

  await trigger.click();
  await expect(shortcuts).toBeVisible();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(shortcuts).toHaveCount(0);
  await expect(rectangle).toHaveAttribute("aria-pressed", "true");
});

test("mobile inspector opens as a focused dialog, edits the board, and returns focus on close", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const toggle = page.getByRole("button", { name: "Toggle inspector", exact: true });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("dialog", { name: "Inspector" })).toHaveCount(0);

  await toggle.click();
  const dialog = page.getByRole("dialog", { name: "Inspector" });
  await expect(dialog).toBeVisible();
  const closeInspector = dialog.getByRole("button", { name: "Close inspector" });
  await expect(closeInspector).toBeVisible();
  await expect(closeInspector).toBeFocused();
  await dialog.getByRole("button", { name: "Add rectangle", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Rectangle 1", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Rectangle 1", exact: true }).click();
  await dialog.getByRole("button", { name: "Rose fill" }).click();

  await closeInspector.click();
  await expect(dialog).toHaveCount(0);
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");

  await toggle.click();
  const reopened = page.getByRole("dialog", { name: "Inspector" });
  await expect(reopened.getByRole("button", { name: "Rose fill" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});

test("mobile drawer contains keyboard focus and releases it on Escape", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Toggle inspector", exact: true });
  await toggle.click();
  const dialog = page.getByRole("dialog", { name: "Inspector", exact: true });
  const close = dialog.getByRole("button", { name: "Close inspector", exact: true });
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "Add connector", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await expect(page.locator(".stage")).toHaveAttribute("inert", "");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(toggle).toBeFocused();
  await expect(page.locator(".stage")).not.toHaveAttribute("inert", "");
});

test("mobile text creation and editing close the drawer and focus the canvas input", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Toggle inspector", exact: true });
  await toggle.click();
  await page.getByRole("button", { name: "Add text", exact: true }).click();
  const input = page.getByRole("textbox", { name: "Edit canvas text", exact: true });
  await expect(page.getByRole("dialog", { name: "Inspector", exact: true })).toHaveCount(0);
  await expect(input).toBeFocused();
  const inputBounds = (await input.boundingBox())!;
  expect(inputBounds.x).toBeGreaterThanOrEqual(0);
  expect(inputBounds.x + inputBounds.width).toBeLessThanOrEqual(390);
  await input.fill("Gateway");
  await input.press("Control+Enter");
  await expect(input).toHaveCount(0);
  await toggle.click();
  await expect(page.getByRole("button", { name: "Text 1 · Gateway", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit text", exact: true }).click();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("Gateway");
  await input.fill("Discard");
  await input.press("Escape");
  await toggle.click();
  await expect(page.getByRole("button", { name: "Text 1 · Gateway", exact: true })).toBeVisible();
});
