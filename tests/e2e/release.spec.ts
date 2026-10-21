import { expect, test } from "@playwright/test";
import { closeOverlay, openBoardMenu, openGeometry } from "./ui.ts";
import type { BoardDocument } from "../../packages/document/src/index.ts";

async function download(page: import("@playwright/test").Page, name: string): Promise<Buffer> {
  await openBoardMenu(page);
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name, exact: true }).click();
  const stream = await (await pending).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

test("named shapes and connectors survive clipboard history and export as SVG and PNG", async ({
  page,
}, info) => {
  await page.goto("/");
  for (const [tool, label, x] of [
    ["Ellipse (O)", "API gateway", 320],
    ["Diamond (D)", "Queue <ready>", 700],
  ] as const) {
    await page.getByRole("button", { name: tool, exact: true }).click();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    const input = page.getByRole("textbox", { name: "Edit canvas text" });
    await expect(input).toBeFocused();
    await input.fill(label);
    await input.press("Control+Enter");
    await openGeometry(page);
    const kind = tool.startsWith("Ellipse") ? "Ellipse" : "Diamond";
    for (const [field, value] of [
      ["x", x],
      ["y", 200],
    ] as const) {
      const number = page.getByRole("spinbutton", { name: `${kind} ${field}`, exact: true });
      await number.fill(String(value));
      await number.press("Enter");
    }
    if (kind === "Diamond") {
      for (const [field, value] of [
        ["width", 240],
        ["height", 160],
      ] as const) {
        const number = page.getByRole("spinbutton", { name: `Diamond ${field}`, exact: true });
        await number.fill(String(value));
        await number.press("Enter");
      }
    }
    await closeOverlay(page);
  }
  await page.getByRole("button", { name: "Connector (C)", exact: true }).click();
  await page.mouse.move(410, 260);
  await page.mouse.down();
  await page.mouse.move(790, 260, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.press("Enter");
  const label = page.getByRole("textbox", { name: "Edit canvas text" });
  await label.fill("HTTPS");
  await label.press("Control+Enter");
  await page.locator("canvas").focus();
  await page.keyboard.press("Control+a");
  const fragment = await page.evaluate(() => {
    const data = new DataTransfer();
    const event = new ClipboardEvent("copy", {
      clipboardData: data,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);
    if (!event.defaultPrevented) throw new Error("Copy was not handled");
    return data.getData("text/plain");
  });
  expect(JSON.parse(fragment).format).toBe("hydraw/selection");
  await page.evaluate(() => {
    const event = new ClipboardEvent("cut", {
      clipboardData: new DataTransfer(),
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);
    if (!event.defaultPrevented) throw new Error("Cut was not handled");
  });
  await expect(page.getByRole("heading", { name: "Create your first diagram" })).toBeVisible();
  await page.evaluate((text) => {
    const data = new DataTransfer();
    data.setData("text/plain", text);
    const event = new ClipboardEvent("paste", {
      clipboardData: data,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);
    if (!event.defaultPrevented) throw new Error("Paste was not handled");
  }, fragment);
  await expect(page.getByRole("heading", { name: "3 objects", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Create your first diagram" })).toBeVisible();
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  const exportedBoard = JSON.parse(
    (await download(page, "Export board")).toString(),
  ) as BoardDocument;
  expect(exportedBoard.version).toBe(4);
  expect(exportedBoard.shapes).toHaveLength(2);
  expect(exportedBoard.shapes[0]).toMatchObject({
    kind: "ellipse",
    label: { text: "API gateway" },
  });
  expect(exportedBoard.shapes[1]).toMatchObject({
    kind: "diamond",
    label: { text: "Queue <ready>" },
  });
  expect(exportedBoard.connectors[0]).toMatchObject({
    start: { type: "binding", shapeId: exportedBoard.shapes[0]!.id },
    end: { type: "binding", shapeId: exportedBoard.shapes[1]!.id },
    label: { text: "HTTPS" },
  });
  const svg = (await download(page, "Export SVG")).toString();
  expect(svg).toContain("<ellipse");
  expect(svg).toContain("<polygon");
  expect(svg).toContain("Queue");
  expect(svg).toContain("&lt;ready");
  expect(svg).toContain("&gt;");
  expect(svg).toContain("HTTPS");
  const png = await download(page, "Export PNG");
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(png.readUInt32BE(16)).toBeGreaterThan(0);
  await page.screenshot({ path: info.outputPath("named-diagram.png") });
  await openBoardMenu(page);
  await page.getByRole("textbox", { name: "Board name" }).focus();
  expect(
    await page.evaluate(() => {
      const event = new ClipboardEvent("copy", {
        clipboardData: new DataTransfer(),
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(event);
      return event.defaultPrevented;
    }),
  ).toBe(false);
  await closeOverlay(page);
  await page.setViewportSize({ width: 320, height: 740 });
  for (const name of ["Rectangle (R)", "Ellipse (O)", "Diamond (D)"]) {
    const button = page.getByRole("button", { name, exact: true });
    await expect(button).toBeVisible();
    const box = (await button.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
  }
});
