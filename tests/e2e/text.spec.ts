import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  addText,
  closeOverlay,
  openBoardMenu,
  openGeometry,
  openObjects,
  openStyle,
} from "./ui.ts";

async function createText(page: Page, text = "Architecture\nAPI → database") {
  await addText(page);
  const input = page.getByRole("textbox", { name: "Edit canvas text" });
  await expect(input).toBeFocused();
  await input.fill(text);
  await input.press("Control+Enter");
  await expect(input).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("Saved in this browser");
}

async function exported(page: Page) {
  await openBoardMenu(page);
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export board", exact: true }).click();
  const stream = await (await pending).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
    version: number;
    shapes: {
      type: string;
      text: string;
      x: number;
      y: number;
      width: number;
      height: number;
      fontSize: number;
      fontWeight: number;
      textAlign: string;
      color: string;
    }[];
  };
}

test("creates multiline Unicode text, cancels an inline edit, and undoes one completed edit", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await createText(page, "Architecture\nこんにちは 👩‍💻");
  await openObjects(page);
  await expect(page.getByRole("button", { name: /^Text 1/ })).toBeVisible();
  const before = await exported(page);
  expect(before.version).toBe(3);
  expect(before.shapes[0]).toMatchObject({
    text: "Architecture\nこんにちは 👩‍💻",
    type: "text",
  });
  await openObjects(page);
  await page.getByRole("button", { name: /^Text 1/ }).click();
  await closeOverlay(page);
  await page.locator("canvas").focus();
  await page.keyboard.press("Enter");
  const input = page.getByRole("textbox", { name: "Edit canvas text" });
  await expect(input).toBeFocused();
  await input.fill("Cancelled edit");
  await input.press("Escape");
  expect(await exported(page)).toEqual(before);
  await closeOverlay(page);
  await page.locator("canvas").focus();
  await page.keyboard.press("Enter");
  await input.fill("Committed edit\nSecond line");
  await input.press("Control+Enter");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await exported(page)).toEqual(before);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect((await exported(page)).shapes[0]?.text).toBe("Committed edit\nSecond line");
  expect(errors).toEqual([]);
});

test("styles text, reflows width, moves at zoom, and preserves semantics through reload and import", async ({
  page,
}) => {
  await page.goto("/");
  await createText(page, "A shared visual workspace for every idea");
  await openObjects(page);
  await page.getByRole("button", { name: /^Text 1/ }).click();
  const heightBefore = (await exported(page)).shapes[0]!.height;
  await openStyle(page);
  await page.getByRole("spinbutton", { name: "Font size", exact: true }).fill("32");
  await page.getByRole("spinbutton", { name: "Font size", exact: true }).press("Enter");
  await page.getByRole("button", { name: "Bold", exact: true }).click();
  await page.getByRole("button", { name: "Align center", exact: true }).click();
  await page.getByRole("button", { name: "Blue text", exact: true }).click();
  await openGeometry(page);
  await page.getByRole("spinbutton", { name: "Text width", exact: true }).fill("160");
  await page.getByRole("spinbutton", { name: "Text width", exact: true }).press("Enter");
  let document = await exported(page);
  expect(document.shapes[0]).toMatchObject({
    width: 160,
    fontSize: 32,
    fontWeight: 700,
    textAlign: "center",
    color: "#3568db",
  });
  expect(document.shapes[0]!.height).toBeGreaterThan(heightBefore);
  await openStyle(page);
  const current = document.shapes[0]!;
  await page.locator("canvas").click({ position: { x: current.x + 10, y: current.y + 10 } });
  await expect(page.getByRole("dialog", { name: "Text style" })).toHaveCount(0);
  await openGeometry(page);
  await expect(page.getByRole("spinbutton", { name: "Text width", exact: true })).toHaveValue(
    "160",
  );
  await openStyle(page);
  await page.getByRole("spinbutton", { name: "Font size", exact: true }).fill("0");
  await page.getByRole("spinbutton", { name: "Font size", exact: true }).press("Enter");
  await expect(page.getByRole("alert")).toContainText("Use 12 to 96");
  await page.getByRole("spinbutton", { name: "Font size", exact: true }).press("Escape");
  await expect(page.getByRole("spinbutton", { name: "Font size", exact: true })).toHaveValue("32");
  expect((await exported(page)).shapes[0]!.fontSize).toBe(32);
  const beforeResize = await exported(page);
  const shape = beforeResize.shapes[0]!;
  const canvas = (await page.locator("canvas").boundingBox())!;
  await page.mouse.move(canvas.x + shape.x + shape.width, canvas.y + shape.y + shape.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    canvas.x + shape.x + shape.width + 80,
    canvas.y + shape.y + shape.height / 2,
    { steps: 5 },
  );
  await page.mouse.up();
  expect((await exported(page)).shapes[0]!.width).toBe(240);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await exported(page)).toEqual(beforeResize);
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page.locator("canvas").focus();
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("ArrowDown");
  document = await exported(page);
  expect(document.shapes[0]).toMatchObject({ x: shape.x + 10, y: shape.y + 1 });
  await expect(page.getByRole("status")).toContainText("Saved in this browser");
  await page.reload();
  expect(await exported(page)).toEqual(document);
  await openBoardMenu(page);
  await page.getByRole("button", { name: "Import board", exact: true }).click();
  await page.getByLabel("Hydraw board file").setInputFiles({
    name: "text.hydraw.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        ...document,
        shapes: document.shapes.map((shape) => ({ ...shape, height: 1 })),
      }),
    ),
  });
  await expect(page.getByRole("dialog")).toContainText("1 text object");
  await page.getByRole("button", { name: "Open imported board" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await exported(page)).toEqual(document);
});

test("blank creation is discarded; blur saves and clearing existing text can be undone", async ({
  page,
}) => {
  await page.goto("/");
  await addText(page);
  const input = page.getByRole("textbox", { name: "Edit canvas text" });
  await input.press("Escape");
  await openObjects(page);
  await expect(page.getByRole("button", { name: /^Text 1/ })).toHaveCount(0);
  await addText(page);
  await input.fill("Blur saves this draft");
  await page.getByRole("button", { name: "Select (V)", exact: true }).click();
  await expect(input).toHaveCount(0);
  await openObjects(page);
  await expect(page.getByRole("button", { name: /^Text 1/ })).toBeVisible();
  await page.getByRole("button", { name: /^Text 1/ }).click();
  await openStyle(page);
  await page.getByRole("button", { name: "Edit text", exact: true }).click();
  await input.fill("");
  await input.press("Control+Enter");
  await openObjects(page);
  await expect(page.getByRole("button", { name: /^Text 1/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await openObjects(page);
  await expect(page.getByRole("button", { name: /^Text 1/ })).toBeVisible();
});
