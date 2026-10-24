import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { BoardDocument } from "../../packages/document/src/index.ts";
import { openBoardMenu, closeOverlay, openObjects } from "./ui.ts";

async function exported(page: Page): Promise<BoardDocument> {
  const pending = page.waitForEvent("download");
  await openBoardMenu(page);
  await page.getByRole("button", { name: "Export board", exact: true }).click();
  const stream = await (await pending).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as BoardDocument;
}

test("crossing an ink edge mirrors its contents, reverses on crossing back, and survives history and reload", async ({
  page,
}) => {
  await page.goto("/");
  await openBoardMenu(page);
  await page.getByRole("button", { name: "Import board", exact: true }).click();
  const fixture = {
    format: "hydraw",
    version: 1,
    theme: "clean",
    name: "Mirror ink",
    connectors: [],
    shapes: [
      {
        id: "ink",
        type: "ink",
        x: 600,
        y: 200,
        width: 200,
        height: 120,
        color: "#202124",
        strokeWidth: 3,
        points: [
          { x: 0, y: 0 },
          { x: 0.5, y: 0.2 },
          { x: 1, y: 1 },
        ],
      },
    ],
  };
  await page.getByLabel("Hydraw board file").setInputFiles({
    name: "mirror.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await page.getByRole("button", { name: "Open imported board", exact: true }).click();
  await openObjects(page);
  await page.getByRole("button", { name: "Drawing 1", exact: true }).click();
  await closeOverlay(page);
  await page.mouse.move(600, 260);
  await page.mouse.down();
  await page.mouse.move(900, 260, { steps: 12 });
  await page.mouse.move(600, 260, { steps: 12 });
  await page.mouse.move(900, 260, { steps: 12 });
  await page.mouse.up();
  const flipped = await exported(page);
  expect(flipped.shapes[0]).toMatchObject({
    x: 800,
    y: 200,
    width: 100,
    height: 120,
    points: [
      { x: 1, y: 0 },
      { x: 0.5, y: 0.2 },
      { x: 0, y: 1 },
    ],
  });
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await exported(page)).shapes).toEqual(fixture.shapes);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect(await exported(page)).toEqual(flipped);
  await page.reload();
  expect(await exported(page)).toEqual(flipped);
  await page.screenshot({ path: "test-results/resize-reflected-ink.png" });
});
