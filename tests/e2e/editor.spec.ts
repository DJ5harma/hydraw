import { expect, test } from "@playwright/test";
import {
  addRectangle,
  closeOverlay,
  openBoardMenu,
  openGeometry,
  openObjects,
  openStyle,
} from "./ui.ts";

test("draw, move, undo, recover after reload and export a semantic board", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const health = await page.request.get("/api/v1/health");
  expect(await health.json()).toEqual({ status: "ok", service: "hydraw" });
  const surface = page.locator("canvas");
  await expect(surface).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Local board");
  const bounds = (await surface.boundingBox())!;
  await page.getByRole("button", { name: "Rectangle (R)", exact: true }).click();
  await page.mouse.move(bounds.x + 180, bounds.y + 180);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 380, bounds.y + 300, { steps: 8 });
  await page.mouse.up();
  await openObjects(page);
  await expect(page.getByRole("button", { name: "Rectangle 1", exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Saved in this browser");
  await closeOverlay(page);
  await page.mouse.move(bounds.x + 250, bounds.y + 230);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 300, bounds.y + 270, { steps: 6 });
  await page.mouse.up();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await openObjects(page);
  await page.getByRole("button", { name: "Rectangle 1", exact: true }).click();
  await openStyle(page);
  await page.getByRole("button", { name: "Rose fill" }).click();
  await expect(page.getByRole("status")).toContainText("Saved in this browser");
  await page.reload();
  await openObjects(page);
  await expect(page.getByRole("button", { name: "Rectangle 1", exact: true })).toBeVisible();
  const download = page.waitForEvent("download");
  await openBoardMenu(page);
  await page.getByRole("button", { name: "Export board", exact: true }).click();
  const file = await download;
  const stream = await file.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const document = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
    format: string;
    shapes: { x: number; y: number; fill: string }[];
  };
  expect(document.format).toBe("hydraw");
  expect(document.shapes).toMatchObject([{ x: 230, y: 220, fill: "#f7e4ed" }]);
  expect(errors).toEqual([]);
});

test("supports keyboard creation/movement/delete and cancels unfinished drawing", async ({
  page,
}) => {
  await page.goto("/");
  const canvas = page.locator("canvas");
  await canvas.focus();
  await page.keyboard.press("Enter");
  await openObjects(page);
  await expect(page.getByRole("button", { name: "Rectangle 1", exact: true })).toBeVisible();
  await closeOverlay(page);
  await canvas.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Delete");
  await openObjects(page);
  await expect(page.getByRole("button", { name: "Rectangle 1", exact: true })).toHaveCount(0);
  await closeOverlay(page);
  await canvas.focus();
  await page.keyboard.press("Control+z");
  await openObjects(page);
  await expect(page.getByRole("button", { name: "Rectangle 1", exact: true })).toBeVisible();
  await closeOverlay(page);
  await canvas.focus();
  await page.keyboard.press("r");
  const bounds = (await canvas.boundingBox())!;
  await page.mouse.move(bounds.x + 100, bounds.y + 150);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 200, bounds.y + 250);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await openObjects(page);
  await expect(page.getByRole("button", { name: "Rectangle 2", exact: true })).toHaveCount(0);
  await page.reload();
  await openObjects(page);
  await expect(page.getByRole("button", { name: "Rectangle 1", exact: true })).toBeVisible();
});

test("a second tab cannot overwrite the local board", async ({ page, context }) => {
  await page.goto("/");
  await addRectangle(page);
  await expect(page.getByRole("status")).toContainText("Saved in this browser");
  const other = await context.newPage();
  await other.goto("/");
  await expect(other.getByRole("alert")).toContainText("already open in another tab");
  await other.close();
  await page.reload();
  await openObjects(page);
  await expect(page.getByRole("button", { name: "Rectangle 1", exact: true })).toBeVisible();
});

test("storage write failures stay visibly unsaved and retain export", async ({ page }) => {
  await page.addInitScript(() => {
    IDBObjectStore.prototype.put = function () {
      throw new DOMException("Local storage is full.", "QuotaExceededError");
    };
  });
  await page.goto("/");
  await addRectangle(page);
  await expect(page.getByRole("status")).toHaveText("Could not save locally");
  await expect(page.getByRole("alert")).toContainText("Local storage is full");
  const download = page.waitForEvent("download");
  await openBoardMenu(page);
  await page.getByRole("button", { name: "Export board", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("Untitled-board.hydraw.json");
});

test("a future stored document is preserved instead of overwritten", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("hydraw-local", 1);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction("boards", "readwrite");
        transaction
          .objectStore("boards")
          .put({ format: "hydraw", version: 99, importantFutureData: "keep me" }, "primary");
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => {
          database.close();
          reject(transaction.error);
        };
      };
      request.onerror = () => reject(request.error);
    });
  });
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("unsupported Hydraw format");
  await addRectangle(page);
  await expect(page.getByRole("status")).toHaveText("Could not save locally");
  const stored = await page.evaluate(
    async () =>
      new Promise<unknown>((resolve, reject) => {
        const request = indexedDB.open("hydraw-local", 1);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction("boards", "readonly");
          const read = transaction.objectStore("boards").get("primary");
          transaction.oncomplete = () => {
            database.close();
            resolve(read.result as unknown);
          };
          transaction.onerror = () => reject(transaction.error);
        };
        request.onerror = () => reject(request.error);
      }),
  );
  expect(stored).toMatchObject({ version: 99, importantFutureData: "keep me" });
});

test("resizes with a handle as one undoable action and recovers resized geometry", async ({
  page,
}) => {
  await page.goto("/");
  await addRectangle(page);
  await openGeometry(page);
  const width = page.getByRole("spinbutton", { name: "Rectangle width" });
  const height = page.getByRole("spinbutton", { name: "Rectangle height" });
  const x = Number(await page.getByRole("spinbutton", { name: "Rectangle x" }).inputValue());
  const y = Number(await page.getByRole("spinbutton", { name: "Rectangle y" }).inputValue());
  const bounds = (await page.locator("canvas").boundingBox())!;
  await closeOverlay(page);
  await page.mouse.move(bounds.x + x + 180, bounds.y + y + 120);
  await expect(page.locator("canvas")).toHaveCSS("cursor", "nwse-resize");
  await page.mouse.down();
  await page.mouse.move(bounds.x + x + 260, bounds.y + y + 170, { steps: 12 });
  await page.mouse.up();
  await openGeometry(page);
  await expect(width).toHaveValue("260");
  await expect(height).toHaveValue("170");
  await closeOverlay(page);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await openGeometry(page);
  await expect(width).toHaveValue("180");
  await expect(height).toHaveValue("120");
  await closeOverlay(page);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await openGeometry(page);
  await expect(width).toHaveValue("260");
  await expect(page.getByRole("status")).toContainText("Saved in this browser");
  await page.reload();
  await openObjects(page);
  await page.getByRole("button", { name: "Rectangle 1", exact: true }).click();
  await openGeometry(page);
  await expect(width).toHaveValue("260");
  // Cancelling a resize also releases capture and preserves the last committed state.
  await closeOverlay(page);
  await page.mouse.move(bounds.x + x + 260, bounds.y + y + 170);
  await page.mouse.down();
  await page.mouse.move(bounds.x + x + 300, bounds.y + y + 220);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await openObjects(page);
  await page.getByRole("button", { name: "Rectangle 1", exact: true }).click();
  await openGeometry(page);
  await expect(width).toHaveValue("260");
});

test("edits geometry through accessible fields and keeps invalid values out of the document", async ({
  page,
}) => {
  await page.goto("/");
  await addRectangle(page);
  await openGeometry(page);
  const width = page.getByRole("spinbutton", { name: "Rectangle width" });
  await width.fill("0");
  await width.press("Tab");
  await expect(width).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("alert")).toContainText("Use 1 to");
  await width.focus();
  await width.press("Escape");
  await expect(width).toHaveValue("180");
  await width.fill("240");
  await width.press("Enter");
  await expect(width).toHaveValue("240");
  await closeOverlay(page);
  await page.locator("canvas").focus();
  await page.keyboard.press("Control+z");
  await openGeometry(page);
  await expect(width).toHaveValue("180");
  await closeOverlay(page);
  await page.keyboard.press("Control+Shift+z");
  await openGeometry(page);
  await expect(width).toHaveValue("240");
});

test("ignores cancellation from a pointer that does not own the drag", async ({ page }) => {
  await page.goto("/");
  await addRectangle(page);
  await openGeometry(page);
  const x = page.getByRole("spinbutton", { name: "Rectangle x" });
  const originalX = Number(await x.inputValue());
  const originalY = Number(
    await page.getByRole("spinbutton", { name: "Rectangle y" }).inputValue(),
  );
  const canvas = page.locator("canvas");
  const bounds = (await canvas.boundingBox())!;
  await closeOverlay(page);
  await page.mouse.move(bounds.x + originalX + 90, bounds.y + originalY + 60);
  await page.mouse.down();
  await page.mouse.move(bounds.x + originalX + 120, bounds.y + originalY + 60);
  await canvas.dispatchEvent("pointercancel", { pointerId: 99 });
  await page.mouse.move(bounds.x + originalX + 140, bounds.y + originalY + 60);
  await page.mouse.up();
  await openGeometry(page);
  await expect(x).toHaveValue(String(originalX + 50));
});

test("reports an unavailable canvas instead of leaving startup pending", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => null;
  });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("could not measure text");
  await expect(page.getByRole("button", { name: "Reload canvas" })).toBeVisible();
  await expect(page.getByText("Opening your canvas…")).toHaveCount(0);
  expect(errors).toEqual([]);
});
