import { expect, test } from "@playwright/test";
import {
  addRectangle,
  addText,
  closeOverlay,
  openBoardMenu,
  openGeometry,
  openObjects,
  openStyle,
} from "./ui.ts";

test("canvas fills the window with no header or sidebar and properties appear on request", async ({
  page,
}) => {
  await page.goto("/");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  expect(await canvas.boundingBox()).toMatchObject({ x: 0, y: 0, width: 1440, height: 900 });
  await expect(page.locator(".topbar, .inspector, .inspector-shell")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Selection actions" })).toHaveCount(0);
  await expect(page.getByRole("spinbutton")).toHaveCount(0);
  await addRectangle(page);
  await expect(page.getByRole("navigation", { name: "Selection actions" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Rectangle fill color" })).toBeVisible();
  await openGeometry(page);
  await expect(page.getByRole("spinbutton", { name: "Rectangle width" })).toHaveValue("180");
  const width = page.getByRole("spinbutton", { name: "Rectangle width" });
  await width.fill("0");
  await width.press("Escape");
  await expect(width).toHaveValue("180");
  await expect(page.getByRole("dialog", { name: "Precise geometry" })).toBeVisible();
  await page.getByRole("button", { name: "Close precise geometry" }).focus();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "More properties" })).toBeFocused();
  expect(await canvas.boundingBox()).toMatchObject({ x: 0, y: 0, width: 1440, height: 900 });
});

test("board menu rename, panel replacement, and import dismissal preserve focus", async ({
  page,
}) => {
  await page.goto("/");
  await openBoardMenu(page);
  const name = page.getByRole("textbox", { name: "Board name" });
  await name.fill("Discard this");
  await name.press("Escape");
  await openBoardMenu(page);
  await expect(name).toHaveValue("Untitled board");
  await name.fill("Planning board");
  await name.press("Enter");
  await expect(name).toHaveValue("Planning board");
  await page.getByRole("button", { name: "Objects", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Board menu", exact: true })).toHaveCount(0);
  await expect(page.getByRole("searchbox")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Board menu", exact: true })).toBeFocused();
  await openBoardMenu(page);
  await page.getByRole("button", { name: "Import board", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Import a board", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Board menu", exact: true })).toBeFocused();
});

test("help closes by button, Escape and outside pointer without an accidental canvas edit", async ({
  page,
}) => {
  await page.goto("/");
  await addRectangle(page);
  const trigger = page.getByRole("button", { name: "Keyboard shortcuts", exact: true });
  const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts", exact: true });
  await trigger.click();
  await expect(dialog).toBeVisible();
  await page.getByRole("button", { name: "Close keyboard shortcuts" }).click();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.locator("canvas").click({ position: { x: 100, y: 150 } });
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Selection actions" })).toBeVisible();
});

for (const width of [320, 390, 736]) {
  test(`controls and requested properties remain reachable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 740 });
    await page.goto("/");
    await addRectangle(page);
    await openStyle(page);
    await page.getByRole("button", { name: "Rose fill" }).click();
    await closeOverlay(page);
    await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Fit selection", exact: true })).toBeVisible();
    await openGeometry(page);
    const geometry = page.getByRole("dialog", { name: "Precise geometry" });
    await expect(geometry).toBeVisible();
    const bounds = (await geometry.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(740);
    const dimensions = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width);
  });
}

test("mobile centered text editing owns input and cancels without reopening a panel", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await addText(page);
  const input = page.getByRole("textbox", { name: "Edit canvas text" });
  await expect(input).toBeFocused();
  const bounds = (await input.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  await input.fill("Gateway");
  await input.press("Control+Enter");
  await openStyle(page);
  await page.getByRole("button", { name: "Edit text", exact: true }).click();
  await expect(input).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await input.fill("Discard");
  await input.press("Escape");
  await openObjects(page);
  await expect(page.getByRole("button", { name: "Text 1 · Gateway", exact: true })).toBeVisible();
});

test("object navigation pages large boards and finds offscreen content without growing the shell", async ({
  page,
}) => {
  await page.goto("/");
  await openBoardMenu(page);
  await page.getByRole("button", { name: "Import board", exact: true }).click();
  await page.getByLabel("Hydraw board file").setInputFiles({
    name: "large.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        format: "hydraw",
        version: 2,
        name: "Large board",
        shapes: Array.from({ length: 205 }, (_, i) => ({
          id: `r${i}`,
          type: "rectangle",
          x: i * 200,
          y: 200,
          width: 100,
          height: 80,
          fill: "#e7eefb",
        })),
        connectors: [],
      }),
    ),
  });
  await page.getByRole("button", { name: "Open imported board", exact: true }).click();
  await openObjects(page);
  const navigator = page.getByRole("dialog", { name: "Objects on board" });
  await expect(navigator.locator("li")).toHaveCount(100);
  await navigator.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("button", { name: "Rectangle 101", exact: true })).toBeVisible();
  await page.getByRole("searchbox").fill("Rectangle 205");
  await page.getByRole("button", { name: "Rectangle 205", exact: true }).click();
  await closeOverlay(page);
  await page.getByRole("button", { name: "Fit selection", exact: true }).click();
  await openGeometry(page);
  await expect(page.getByRole("spinbutton", { name: "Rectangle x", exact: true })).toHaveValue(
    "40800",
  );
  await closeOverlay(page);
  await page.locator("canvas").focus();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Fit board", exact: true }).click();
  await expect(page.getByRole("button", { name: "Reset view", exact: true })).not.toHaveText(
    "100%",
  );
});

test("outside dismissal commits valid native drafts before unmounting their controls", async ({
  page,
}) => {
  await page.goto("/");
  await openBoardMenu(page);
  await page.getByRole("textbox", { name: "Board name" }).fill("Renamed outside");
  await page.locator("canvas").click({ position: { x: 400, y: 180 } });
  await openBoardMenu(page);
  await expect(page.getByRole("textbox", { name: "Board name" })).toHaveValue("Renamed outside");
  await addRectangle(page);
  await openGeometry(page);
  await page.getByRole("spinbutton", { name: "Rectangle width" }).fill("270");
  await page.locator("canvas").click({ position: { x: 400, y: 180 } });
  await openGeometry(page);
  await expect(page.getByRole("spinbutton", { name: "Rectangle width" })).toHaveValue("270");
  await closeOverlay(page);
  await expect(page.getByRole("status")).toHaveText("Saved in this browser");
  await page.reload();
  await openObjects(page);
  await page.getByRole("button", { name: "Rectangle 1", exact: true }).click();
  await openGeometry(page);
  await expect(page.getByRole("spinbutton", { name: "Rectangle width" })).toHaveValue("270");
});

test("board actions remain reachable in a short landscape window", async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 280 });
  await page.goto("/");
  await openBoardMenu(page);
  const menu = page.getByRole("dialog", { name: "Board menu", exact: true });
  const bounds = (await menu.boundingBox())!;
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(280);
  await page.getByRole("button", { name: "Objects", exact: true }).click();
  await expect(page.getByRole("searchbox")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Board menu", exact: true })).toBeFocused();
});

test("selection exposes styling directly, keeps shortcut hints, and saves rectangle appearance", async ({
  page,
}) => {
  await page.goto("/");
  await addRectangle(page);
  const properties = page.getByRole("region", { name: "Selection properties", exact: true });
  await expect(properties).toBeVisible();
  await expect(properties.getByRole("button", { name: "Save to library", exact: true })).toHaveText(
    "Save to library",
  );
  await expect(properties.getByRole("button", { name: "Copy as image", exact: true })).toHaveText(
    "Copy as image",
  );
  await expect(page.locator("canvas")).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Rectangle (R)", exact: true }).locator("kbd"),
  ).toHaveText("R");
  await page.getByRole("button", { name: "Rose fill", exact: true }).click();
  await page.getByRole("button", { name: "Blue stroke", exact: true }).click();
  await page.getByRole("button", { name: "Thick stroke", exact: true }).click();
  await page.getByRole("button", { name: "dashed stroke", exact: true }).click();
  await page.getByRole("button", { name: "Square", exact: true }).click();
  await page.getByRole("slider", { name: "Shape opacity", exact: true }).focus();
  await page.keyboard.press("Home");
  for (let i = 0; i < 6; i++) await page.keyboard.press("PageUp");
  await page.locator("canvas").click({ position: { x: 400, y: 180 } });
  await expect(page.getByRole("status")).toHaveText("Saved in this browser");
  await page.reload();
  await openObjects(page);
  await page.getByRole("button", { name: "Rectangle 1", exact: true }).click();
  await closeOverlay(page);
  await expect(page.getByRole("button", { name: "Rose fill", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "dashed stroke", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("slider", { name: "Shape opacity", exact: true })).toHaveValue("60");
  await page.setViewportSize({ width: 390, height: 740 });
  await expect(properties).toBeVisible();
  const bounds = (await properties.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(740);
});

test("an opacity drag commits once and undo restores the original appearance", async ({ page }) => {
  await page.goto("/");
  await addRectangle(page);
  const slider = page.getByRole("slider", { name: "Shape opacity", exact: true });
  const bounds = (await slider.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width - 8, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.4, bounds.y + bounds.height / 2, { steps: 12 });
  await page.mouse.up();
  expect(Number(await slider.inputValue())).toBeLessThan(60);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(slider).toHaveValue("100");
  await expect(
    page.getByRole("region", { name: "Selection properties", exact: true }),
  ).toBeVisible();
});

test("image insertion is direct and the floating library restores focus at desktop and mobile widths", async ({
  page,
}) => {
  await page.goto("/");
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const image = page
      .getByRole("toolbar", { name: "Drawing tools" })
      .getByRole("button", { name: "Insert image", exact: true });
    await expect(image).toBeInViewport();
    const chooser = page.waitForEvent("filechooser");
    await image.click();
    await chooser;
    const library = page.getByRole("button", { name: "My library", exact: true });
    const bounds = (await library.boundingBox())!;
    expect(bounds.x).toBeGreaterThan(width / 2);
    expect(bounds.y).toBeLessThan(20);
    await library.click();
    await expect(page.getByRole("dialog", { name: "My library", exact: true })).toBeVisible();
    await expect(page.getByLabel("Save current selection")).toHaveCount(0);
    await expect(page.getByRole("searchbox", { name: "Search library" })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(library).toBeFocused();
  }
});
