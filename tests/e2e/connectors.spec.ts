import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { BoardDocument } from "../../packages/document/src/index.ts";

async function exportBoard(page: Page): Promise<BoardDocument> {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export board", exact: true }).click();
  const stream = await (await pending).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as BoardDocument;
}
async function field(page: Page, name: string, value: number) {
  const input = page.getByRole("spinbutton", { name, exact: true });
  await input.fill(String(value));
  await input.press("Enter");
}
async function nodes(page: Page) {
  await page.goto("/");
  for (const x of [100, 550]) {
    await page.getByRole("button", { name: "Add rectangle", exact: true }).click();
    await field(page, "Rectangle x", x);
    await field(page, "Rectangle y", 200);
  }
  await expect(page.getByRole("status")).toContainText("Saved in this browser");
}
async function drag(page: Page, start: { x: number; y: number }, end: { x: number; y: number }) {
  const box = (await page.locator("canvas").boundingBox())!;
  await page.mouse.move(box.x + start.x, box.y + start.y);
  await page.mouse.down();
  await page.mouse.move(box.x + end.x, box.y + end.y, { steps: 6 });
  await page.mouse.up();
}
async function connect(page: Page) {
  await page.getByRole("button", { name: "Connector (C)", exact: true }).click();
  await drag(page, { x: 190, y: 260 }, { x: 640, y: 260 });
  await expect(page.getByRole("button", { name: "Connector 1", exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Saved in this browser");
}

test("draws a bound arrow, follows moved/resized nodes, and undoes cascade deletion across reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await nodes(page);
  await connect(page);
  const original = await exportBoard(page);
  const connector = original.connectors[0]!;
  expect(connector).toMatchObject({
    start: { type: "binding", shapeId: original.shapes[0]!.id },
    end: { type: "binding", shapeId: original.shapes[1]!.id },
  });
  await drag(page, { x: 190, y: 260 }, { x: 230, y: 260 });
  await expect(page.getByRole("spinbutton", { name: "Rectangle x", exact: true })).toHaveValue(
    "140",
  );
  await field(page, "Rectangle width", 240);
  const changed = await exportBoard(page);
  expect(changed.connectors).toEqual(original.connectors);
  expect(changed.shapes[0]).toMatchObject({ x: 140, width: 240 });
  await page.getByRole("button", { name: "Delete rectangle", exact: true }).click();
  await expect(page.getByRole("button", { name: "Connector 1", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await exportBoard(page)).toEqual(changed);
  await expect(page.getByRole("status")).toContainText("Saved in this browser");
  await page.reload();
  expect(await exportBoard(page)).toEqual(changed);
  await page.locator("canvas").click({ position: { x: 460, y: 260 } });
  await expect(page.getByRole("heading", { name: "Connector", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Delete connector", exact: true }).click();
  expect((await exportBoard(page)).shapes).toEqual(changed.shapes);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await exportBoard(page)).toEqual(changed);
  expect(errors).toEqual([]);
});

test("reconnects an endpoint, reverses, styles and detaches without surprising bound-body movement", async ({
  page,
}) => {
  await nodes(page);
  await connect(page);
  const original = await exportBoard(page);
  await drag(page, { x: 550, y: 260 }, { x: 850, y: 420 });
  let document = await exportBoard(page);
  expect(document.connectors[0]?.end).toEqual({ type: "point", x: 850, y: 420 });
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await exportBoard(page)).toEqual(original);
  await page.getByRole("button", { name: "Connector 1", exact: true }).click();
  await page.getByRole("button", { name: "Rose connector", exact: true }).click();
  await page.getByRole("checkbox", { name: "Arrowhead", exact: true }).uncheck();
  await page.getByRole("button", { name: "Reverse direction", exact: true }).click();
  document = await exportBoard(page);
  expect(document.connectors[0]).toMatchObject({
    color: "#8d315a",
    arrowhead: "none",
    start: original.connectors[0]!.end,
    end: original.connectors[0]!.start,
  });
  await page.locator("canvas").focus();
  await page.keyboard.press("Shift+ArrowRight");
  expect(await exportBoard(page)).toEqual(document);
  await page.getByRole("button", { name: "Detach endpoints", exact: true }).click();
  await expect(page.getByRole("button", { name: "Detach endpoints", exact: true })).toBeDisabled();
  await page.locator("canvas").focus();
  await page.keyboard.press("Shift+ArrowRight");
  document = await exportBoard(page);
  expect(document.connectors[0]).toMatchObject({
    start: { type: "point", x: 560, y: 260 },
    end: { type: "point", x: 290, y: 260 },
  });
});

test("keeps text bindings through reflow, import and recovery, and restores edges when cleared text is undone", async ({
  page,
}) => {
  await nodes(page);
  await page.getByRole("button", { name: "Text (T)", exact: true }).click();
  await page.locator("canvas").click({ position: { x: 750, y: 450 } });
  const input = page.getByRole("textbox", { name: "Edit canvas text" });
  await input.fill("API contract\nShared document state");
  await input.press("Control+Enter");
  await connect(page);
  await drag(page, { x: 550, y: 260 }, { x: 790, y: 465 });
  const withText = await exportBoard(page);
  expect(withText.connectors[0]?.end).toEqual({ type: "binding", shapeId: withText.shapes[2]!.id });
  await page.getByRole("button", { name: /^Text 3/ }).click();
  await field(page, "Text width", 150);
  await field(page, "Font size", 32);
  const before = await exportBoard(page);
  expect(before.connectors).toEqual(withText.connectors);
  await page.getByRole("button", { name: "Edit text", exact: true }).click();
  await input.fill("");
  await input.press("Control+Enter");
  await expect(page.getByRole("button", { name: "Connector 1", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await exportBoard(page)).toEqual(before);
  await page.getByRole("button", { name: "Import board", exact: true }).click();
  await page.getByLabel("Hydraw board file").setInputFiles({
    name: "graph.hydraw.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ ...before, name: "Imported graph" })),
  });
  await expect(page.getByRole("dialog")).toContainText("1 connector");
  await page.getByRole("button", { name: "Open imported board", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await exportBoard(page)).toEqual({ ...before, name: "Imported graph" });
  await page.reload();
  await page.getByRole("button", { name: "Restore previous board", exact: true }).click();
  await page.getByRole("button", { name: "Restore board", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await exportBoard(page)).toEqual(before);
});

test("cancels drawing and endpoint changes, supports keyboard arrows, and rejects broken imported graphs", async ({
  page,
}) => {
  await nodes(page);
  await connect(page);
  const before = await exportBoard(page);
  const box = (await page.locator("canvas").boundingBox())!;
  await page.mouse.move(box.x + 550, box.y + 260);
  await page.mouse.down();
  await page.mouse.move(box.x + 850, box.y + 420);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect(await exportBoard(page)).toEqual(before);
  await page.locator("canvas").focus();
  await page.keyboard.press("c");
  await page.mouse.move(box.x + 190, box.y + 260);
  await page.mouse.down();
  await page.mouse.move(box.x + 640, box.y + 260);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect(await exportBoard(page)).toEqual(before);
  await page.locator("canvas").focus();
  await page.keyboard.press("c");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Connector 2", exact: true })).toBeVisible();
  await page.keyboard.press("Delete");
  expect(await exportBoard(page)).toEqual(before);
  for (const invalid of [
    { ...before, version: 1 },
    {
      ...before,
      connectors: [{ ...before.connectors[0], end: { type: "binding", shapeId: "missing" } }],
    },
  ]) {
    await page.getByRole("button", { name: "Import board", exact: true }).click();
    await page.getByLabel("Hydraw board file").setInputFiles({
      name: "broken.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(invalid)),
    });
    await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Open imported board", exact: true }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(await exportBoard(page)).toEqual(before);
  }
});
