import { expect, test } from "@playwright/test";
import { openBoardMenu } from "./ui.ts";

const board = {
  format: "hydraw",
  version: 10,
  theme: "clean",
  name: "Flow board",
  shapes: [
    {
      id: "gateway",
      type: "rectangle",
      x: 80,
      y: 120,
      width: 180,
      height: 110,
      fill: "#e7eefb",
      label: { text: "Gateway", fontSize: 18, fontWeight: 700, color: "#243e33" },
    },
    {
      id: "service",
      type: "rectangle",
      x: 420,
      y: 120,
      width: 180,
      height: 110,
      fill: "#e6f2ea",
      label: { text: "Service", fontSize: 18, fontWeight: 700, color: "#243e33" },
    },
  ],
  connectors: [
    {
      id: "request",
      type: "connector",
      start: { type: "binding", shapeId: "gateway" },
      end: { type: "binding", shapeId: "service" },
      color: "#3568db",
      arrowhead: "arrow",
      label: { text: "HTTPS", fontSize: 16, fontWeight: 700, color: "#3568db" },
    },
  ],
};

async function importBoard(page: import("@playwright/test").Page) {
  await page.goto("/");
  await openBoardMenu(page);
  await page.getByRole("button", { name: "Import board", exact: true }).click();
  await page.getByLabel("Hydraw board file").setInputFiles({
    name: "flow.hydraw.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(board)),
  });
  await page.getByRole("button", { name: "Open imported board", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open imported board", exact: true })).toBeHidden();
  await expect(page.getByRole("button", { name: "Board menu", exact: true })).toContainText(
    "Flow board",
  );
  await page.locator("canvas").focus();
  await page.keyboard.press("Control+a");
  await expect(page.getByRole("button", { name: "Save to library", exact: true })).toBeVisible();
}

async function exportBoard(page: import("@playwright/test").Page) {
  await openBoardMenu(page);
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export board", exact: true }).click();
  const stream = await (await pending).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as typeof board;
}

test("saves a connected selection, inserts fresh editable IDs, undoes, and manages the library", async ({
  page,
}) => {
  await importBoard(page);
  await page.getByRole("button", { name: "Save to library", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "My library", exact: true });
  await expect(dialog).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Give this library item a name.");
  await page.getByLabel("Save current selection").fill("API path");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog.getByText("API path", { exact: true })).toBeVisible();
  await expect(dialog.getByText("2 objects · 1 connector")).toBeVisible();
  await dialog.getByRole("button", { name: "Insert", exact: true }).click();
  await expect(dialog).toHaveCount(0);

  const inserted = await exportBoard(page);
  expect(inserted.shapes).toHaveLength(4);
  expect(inserted.connectors).toHaveLength(2);
  const freshShapes = inserted.shapes.filter(
    (shape) => !board.shapes.some((before) => before.id === shape.id),
  );
  expect(freshShapes).toHaveLength(2);
  const freshConnector = inserted.connectors.find((connector) => connector.id !== "request");
  expect(freshConnector?.start).toEqual({ type: "binding", shapeId: freshShapes[0]?.id });
  expect(freshConnector?.end).toEqual({ type: "binding", shapeId: freshShapes[1]?.id });
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await exportBoard(page)).toMatchObject({
    shapes: board.shapes,
    connectors: board.connectors,
  });
  await page.reload();
  expect(await exportBoard(page)).toMatchObject({
    shapes: board.shapes,
    connectors: board.connectors,
  });

  await page.getByRole("button", { name: "My library", exact: true }).click();
  const library = page.getByRole("dialog", { name: "My library", exact: true });
  await expect(library.getByText("API path", { exact: true })).toBeVisible();
  await library.getByRole("searchbox", { name: "Search library" }).fill("api");
  await expect(library.getByText("API path", { exact: true })).toBeVisible();
  await library.getByRole("searchbox", { name: "Search library" }).fill("");
  await library.getByRole("button", { name: "Rename", exact: true }).click();
  await library.getByRole("textbox", { name: "Rename API path" }).fill("Gateway flow");
  await library.getByRole("button", { name: "Save name", exact: true }).click();
  await expect(library.getByText("Gateway flow", { exact: true })).toBeVisible();
  await library.getByRole("button", { name: "Delete", exact: true }).click();
  await library.getByRole("button", { name: "Confirm delete", exact: true }).click();
  await expect(library.getByText("No saved items yet.", { exact: false })).toBeVisible();
});

test("shows quota errors and preserves unreadable library records", async ({ page }) => {
  await importBoard(page);
  const fragment = JSON.stringify({
    format: "hydraw/selection",
    version: 1,
    document: {
      format: "hydraw",
      version: 10,
      theme: "clean",
      name: "Reusable",
      shapes: [board.shapes[0]],
      connectors: [],
    },
  });
  await page.evaluate(
    async ({ fragment }) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("hydraw-library", 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore("items", { keyPath: "id" });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction("items", "readwrite");
        const store = transaction.objectStore("items");
        for (let index = 0; index < 49; index++) {
          store.put({
            id: `seed-${index}`,
            name: `Seed ${index}`,
            fragment,
            createdAt: index,
            updatedAt: index,
          });
        }
        store.put({ id: "damaged-record", unreadable: true });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      database.close();
    },
    { fragment },
  );

  await page.getByRole("button", { name: "Save to library", exact: true }).click();
  const library = page.getByRole("dialog", { name: "My library", exact: true });
  await expect(library.getByRole("status")).toContainText("saved item could not be read");
  await expect(library.getByText("49 / 50", { exact: true })).toBeVisible();
  await page.getByLabel("Save current selection").fill("Overflow");
  await library.getByRole("button", { name: "Save", exact: true }).click();
  await expect(library.getByRole("alert")).toContainText("holds up to 50 items");
  const intact = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("hydraw-library", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("items", { keyPath: "id" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const value = await new Promise<unknown>((resolve, reject) => {
      const transaction = database.transaction("items", "readonly");
      const request = transaction.objectStore("items").get("damaged-record");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return Boolean(value);
  });
  expect(intact).toBe(true);
});

test("cross-tab quota checks serialize concurrent library saves", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "production", "Source-module race test runs in development.");
  await page.goto("/");
  const secondTab = await page.context().newPage();
  await secondTab.goto("/");
  const fragment = JSON.stringify({
    format: "hydraw/selection",
    version: 1,
    document: {
      format: "hydraw",
      version: 10,
      theme: "clean",
      name: "Reusable",
      shapes: [board.shapes[0]],
      connectors: [],
    },
  });
  const saveConcurrently = async (tab: typeof page, prefix: string) =>
    tab.evaluate(
      async ({ fragment, prefix }) => {
        const moduleUrl = new URL("/src/features/library/library-store.ts", location.origin).href;
        const library = (await import(
          moduleUrl
        )) as typeof import("../../apps/web/src/features/library/library-store.ts");
        return Promise.allSettled(
          Array.from({ length: 25 }, (_, index) =>
            library.saveLibraryItem(`${prefix} ${index}`, fragment),
          ),
        );
      },
      { fragment, prefix },
    );
  const [left, right] = await Promise.all([
    saveConcurrently(page, "Left"),
    saveConcurrently(secondTab, "Right"),
  ]);
  expect([...left, ...right].every((result) => result.status === "fulfilled")).toBe(true);
  const results = await saveConcurrently(page, "Overflow");
  expect(results.every((result) => result.status === "rejected")).toBe(true);
  await secondTab.close();
});

test("reports unavailable library storage without changing the board", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      value: {
        open: () => {
          throw new Error("denied");
        },
      },
    });
  });
  await page.getByRole("button", { name: "My library", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Could not open your local library");
  await expect(page.locator("canvas")).toBeVisible();
});
