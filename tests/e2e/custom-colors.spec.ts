import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { BoardDocument } from "../../packages/document/src/index.ts";
import { addRectangle, addText, closeOverlay, openBoardMenu, openObjects } from "./ui.ts";

async function exported(page: Page): Promise<BoardDocument> {
  const pending = page.waitForEvent("download");
  await openBoardMenu(page);
  await page.getByRole("button", { name: "Export board", exact: true }).click();
  const stream = await (await pending).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as BoardDocument;
}
async function custom(page: Page, suffix: string, hex: string) {
  await page.getByRole("button", { name: `Custom ${suffix} color`, exact: true }).click();
  await page.getByRole("textbox", { name: `HEX ${suffix} color`, exact: true }).fill(hex);
  await page.getByRole("button", { name: `Apply ${suffix} color`, exact: true }).click();
}

test("custom colors validate drafts, cancel, undo once, persist and share recent colors", async ({
  page,
}) => {
  await page.goto("/");
  await addRectangle(page);
  await page.getByRole("button", { name: "Custom fill color", exact: true }).click();
  const hex = page.getByRole("textbox", { name: "HEX fill color", exact: true });
  await expect(hex).toBeFocused();
  await hex.fill("not-a-hex");
  await expect(page.getByRole("button", { name: "Apply fill color", exact: true })).toBeDisabled();
  await expect(page.getByRole("alert")).toHaveText("Enter a HEX color, like #5b8def.");
  await hex.fill("ABC");
  await expect(page.getByLabel("Choose fill color", { exact: true })).toHaveValue("#aabbcc");
  await hex.press("Escape");
  await expect(page.getByRole("button", { name: "Custom fill color", exact: true })).toBeFocused();
  await expect(page.getByRole("button", { name: "Blue fill", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Custom fill color", exact: true }).click();
  await page.getByLabel("Choose fill color", { exact: true }).fill("#12abef");
  await page.getByRole("button", { name: "Apply fill color", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("button", { name: "Blue fill", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await custom(page, "stroke", "#df2345");
  const document = await exported(page);
  expect(document.shapes[0]).toMatchObject({ fill: "#12abef", appearance: { stroke: "#df2345" } });
  await openBoardMenu(page);
  await page.getByRole("combobox", { name: "Board style" }).selectOption("blueprint");
  await closeOverlay(page);
  await page.reload();
  await openObjects(page);
  await page.getByRole("button", { name: "Rectangle 1", exact: true }).click();
  await closeOverlay(page);
  await page.getByRole("button", { name: "Custom fill color", exact: true }).click();
  await expect(hex).toHaveValue("#12abef");
  await expect(
    page.getByRole("button", { name: "Use #df2345 for fill", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await hex.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/custom-color-mobile.png" });
  await page.getByRole("button", { name: "Use #df2345 for fill", exact: true }).click();
  expect((await exported(page)).shapes[0]).toMatchObject({ fill: "#df2345" });
  await closeOverlay(page);
  await page.getByRole("button", { name: "Transparent fill", exact: true }).click();
  expect((await exported(page)).shapes[0]).toMatchObject({ fill: "transparent" });
});

test("custom text, connector and drawing colors render in themed exports", async ({ page }) => {
  await page.goto("/");
  await addText(page);
  const draft = page.getByRole("textbox", { name: "Edit canvas text", exact: true });
  await draft.fill("Custom note");
  await draft.press("Control+Enter");
  await custom(page, "text", "ABC");
  await page.getByRole("button", { name: "Connector (C)", exact: true }).click();
  await page.locator("canvas").focus();
  await page.keyboard.press("Enter");
  await custom(page, "connector", "112233");
  await page.getByRole("button", { name: "Draw (P)", exact: true }).click();
  await custom(page, "drawing", "#abcdef");
  await page.mouse.move(600, 650);
  await page.mouse.down();
  await page.mouse.move(850, 670, { steps: 8 });
  await page.mouse.up();
  const document = await exported(page);
  expect(document.shapes.find((shape) => shape.type === "text")).toMatchObject({
    color: "#aabbcc",
  });
  expect(document.shapes.find((shape) => shape.type === "ink")).toMatchObject({ color: "#abcdef" });
  expect(document.connectors[0]).toMatchObject({ color: "#112233" });
  await openBoardMenu(page);
  await page.getByRole("combobox", { name: "Board style" }).selectOption("blueprint");
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export SVG", exact: true }).click();
  const stream = await (await pending).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const svg = Buffer.concat(chunks).toString();
  for (const hex of ["#aabbcc", "#abcdef", "#112233"]) expect(svg).toContain(hex);
});

test("custom colors still apply when recent-color storage is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException("Denied", "SecurityError");
    };
    Storage.prototype.setItem = () => {
      throw new DOMException("Denied", "SecurityError");
    };
  });
  await page.goto("/");
  await addRectangle(page);
  await custom(page, "fill", "#123abc");
  await page.getByRole("button", { name: "Custom stroke color", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Use #123abc for stroke", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  expect((await exported(page)).shapes[0]).toMatchObject({ fill: "#123abc" });
});
