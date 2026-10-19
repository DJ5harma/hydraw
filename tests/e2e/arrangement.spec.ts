import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { BoardDocument } from "../../packages/document/src/index.ts";
const rectangle = { type: "rectangle", fill: "#e7eefb" };
const connector = { type: "connector", color: "#243e33", arrowhead: "arrow" };
const fixture = {
  format: "hydraw",
  version: 2,
  name: "Arrange ideas",
  shapes: [
    { ...rectangle, id: "a", x: 100, y: 80, width: 100, height: 80 },
    { ...rectangle, id: "b", x: 400, y: 280, width: 200, height: 100 },
    {
      id: "text",
      type: "text",
      text: "Text node",
      x: 260,
      y: 180,
      width: 120,
      height: 42,
      fontSize: 24,
      fontWeight: 700,
      textAlign: "center",
      color: "#243e33",
    },
    { ...rectangle, id: "outside", x: 900, y: 600, width: 100, height: 80 },
  ],
  connectors: [
    {
      ...connector,
      id: "bound",
      start: { type: "binding", shapeId: "a" },
      end: { type: "binding", shapeId: "b" },
    },
    {
      ...connector,
      id: "free",
      start: { type: "point", x: 30, y: 500 },
      end: { type: "point", x: 180, y: 500 },
    },
  ],
};
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
async function open(page: Page, board: unknown = fixture) {
  await page.goto("/");
  await button(page, "Import board").click();
  await page.getByLabel("Hydraw board file").setInputFiles({
    name: "arrangement.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(board)),
  });
  await button(page, "Open imported board").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function exported(page: Page): Promise<BoardDocument> {
  const pending = page.waitForEvent("download");
  await button(page, "Export board").click();
  const stream = await (await pending).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as BoardDocument;
}
async function selectLayout(page: Page) {
  await button(page, "Rectangle 1").click();
  await button(page, "Rectangle 2").click({ modifiers: ["Shift"] });
  await page.getByRole("button", { name: /^Text 3/ }).click({ modifiers: ["Shift"] });
  await button(page, "Connector 1").click({ modifiers: ["Shift"] });
  await button(page, "Connector 2").click({ modifiers: ["Shift"] });
}

test("all alignment controls move selected shapes in one undo step while retaining text and arrows", async ({
  page,
}) => {
  await open(page);
  await selectLayout(page);
  const before = await exported(page);
  const cases = [
    { label: "Align left", axis: "x", target: 100, anchor: 0 },
    { label: "Align horizontal centers", axis: "x", target: 350, anchor: 0.5 },
    { label: "Align right", axis: "x", target: 600, anchor: 1 },
    { label: "Align top", axis: "y", target: 80, anchor: 0 },
    { label: "Align vertical centers", axis: "y", target: 230, anchor: 0.5 },
    { label: "Align bottom", axis: "y", target: 380, anchor: 1 },
  ] as const;
  for (const { label, axis, target, anchor } of cases) {
    await button(page, label).click();
    const after = await exported(page);
    for (const shape of after.shapes.slice(0, 3))
      expect(shape[axis] + shape[axis === "x" ? "width" : "height"] * anchor).toBeCloseTo(target);
    expect(after.shapes[3]).toEqual(before.shapes[3]);
    expect(after.connectors).toEqual(before.connectors);
    expect(after.shapes[2]).toMatchObject({
      type: "text",
      text: "Text node",
      width: before.shapes[2]!.width,
      height: before.shapes[2]!.height,
      fontSize: 24,
      fontWeight: 700,
    });
    await expect(page.getByRole("heading", { name: "5 objects", exact: true })).toBeVisible();
    await button(page, "Undo").click();
    expect(await exported(page)).toEqual(before);
  }
});

test("distribution keeps outer centers fixed, preserves redo on repeated layouts and saves the result", async ({
  page,
}) => {
  await open(page);
  await selectLayout(page);
  const before = await exported(page);
  await button(page, "Distribute centers horizontally").click();
  const horizontal = await exported(page);
  expect(horizontal.shapes[0]).toEqual(before.shapes[0]);
  expect(horizontal.shapes[1]).toEqual(before.shapes[1]);
  expect(horizontal.shapes[2]?.x).toBe(265);
  await button(page, "Distribute centers horizontally").click();
  await button(page, "Undo").click();
  expect(await exported(page)).toEqual(before);
  await button(page, "Redo").click();
  expect(await exported(page)).toEqual(horizontal);
  await button(page, "Distribute centers vertically").click();
  const vertical = await exported(page);
  expect(vertical.shapes[0]).toEqual(horizontal.shapes[0]);
  expect(vertical.shapes[1]).toEqual(horizontal.shapes[1]);
  expect(vertical.shapes[2]!.y + vertical.shapes[2]!.height / 2).toBeCloseTo(225);
  await expect(page.getByRole("status")).toContainText("Saved in this browser");
  await page.reload();
  expect(await exported(page)).toEqual(vertical);
});

test("eligibility counts shapes rather than selected arrows", async ({ page }) => {
  await open(page);
  await button(page, "Connector 1").click();
  await button(page, "Connector 2").click({ modifiers: ["Shift"] });
  await expect(button(page, "Align left")).toBeDisabled();
  await expect(button(page, "Distribute centers horizontally")).toBeDisabled();
  await button(page, "Rectangle 1").click({ modifiers: ["Shift"] });
  await expect(button(page, "Align left")).toBeDisabled();
  await button(page, "Rectangle 2").click({ modifiers: ["Shift"] });
  await expect(button(page, "Align left")).toBeEnabled();
  await expect(button(page, "Distribute centers vertically")).toBeDisabled();
  await page.getByRole("button", { name: /^Text 3/ }).click({ modifiers: ["Shift"] });
  await expect(button(page, "Distribute centers vertically")).toBeEnabled();
});

test("an impossible alignment reports an error without partial movement or history", async ({
  page,
}) => {
  await open(page, {
    ...fixture,
    shapes: [
      { ...rectangle, id: "a", x: 1_000_000, y: 0, width: 100_000, height: 100 },
      { ...rectangle, id: "b", x: 900_000, y: 200, width: 100, height: 100 },
    ],
    connectors: [],
  });
  await button(page, "Select all objects").click();
  const before = await exported(page);
  await button(page, "Align right").click();
  await expect(page.getByRole("alert")).toContainText("coordinate limit");
  expect(await exported(page)).toEqual(before);
  await expect(button(page, "Undo")).toBeDisabled();
  await expect(button(page, "Rectangle 1")).toHaveAttribute("aria-pressed", "true");
  await button(page, "Dismiss selection error").click();
  await button(page, "Align left").click();
  expect((await exported(page)).shapes.map((shape) => shape.x)).toEqual([900_000, 900_000]);
  await button(page, "Undo").click();
  expect(await exported(page)).toEqual(before);
});
