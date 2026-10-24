import { MAX_DOCUMENT_BYTES } from "../../packages/document/src/index.ts";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { addRectangle, openBoardMenu, openObjects } from "./ui.ts";

const imported = {
  format: "hydraw",
  version: 1,
  theme: "clean",
  name: "Imported architecture",
  connectors: [],
  shapes: [
    { id: "imported-a", type: "rectangle", x: 80, y: 90, width: 160, height: 100, fill: "#f7e4ed" },
    {
      id: "imported-b",
      type: "rectangle",
      x: 300,
      y: 90,
      width: 120,
      height: 100,
      fill: "#e6f2ea",
    },
  ],
};

async function seed(page: Page) {
  await page.goto("/");
  await openBoardMenu(page);
  await page.getByRole("textbox", { name: "Board name" }).fill("Original board");
  await page.getByRole("textbox", { name: "Board name" }).press("Enter");
  await addRectangle(page);
  await expect(page.getByRole("status")).toContainText("Saved in this browser");
}

async function stored(page: Page) {
  return page.evaluate(
    () =>
      new Promise<unknown>((resolve, reject) => {
        const request = indexedDB.open("hydraw-board-v1", 1);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction("boards", "readonly");
          const primary = transaction.objectStore("boards").get("primary");
          const recovery = transaction.objectStore("boards").get("recovery");
          transaction.oncomplete = () => {
            database.close();
            resolve({ primary: primary.result as unknown, recovery: recovery.result as unknown });
          };
          transaction.onerror = () => {
            database.close();
            reject(transaction.error);
          };
        };
        request.onerror = () => reject(request.error);
      }),
  );
}

async function choose(page: Page, json: string = JSON.stringify(imported)) {
  await openBoardMenu(page);
  await page.getByRole("button", { name: "Import board", exact: true }).click();
  await page.getByLabel("Hydraw board file").setInputFiles({
    name: "board.hydraw.json",
    mimeType: "application/json",
    buffer: Buffer.from(json),
  });
}

async function openImported(page: Page) {
  await choose(page);
  await expect(page.getByRole("dialog")).toContainText("Imported architecture");
  await page.getByRole("button", { name: "Open imported board" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test("previews an import, persists it, and swaps recovery boards across reloads", async ({
  page,
}) => {
  await seed(page);
  const original = (await stored(page)) as { primary: unknown };
  await choose(page);
  await expect(page.getByRole("dialog")).toContainText("Imported architecture");
  await expect(page.getByRole("dialog")).toContainText("2 rectangles");
  await page.getByRole("button", { name: "Open imported board" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await openBoardMenu(page);
  await expect(page.getByRole("textbox", { name: "Board name" })).toHaveValue(imported.name);
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  expect(await stored(page)).toEqual({
    primary: { ...imported, version: 1, theme: "clean", connectors: [] },
    recovery: original.primary,
  });
  await page.reload();
  await openBoardMenu(page);
  await page.getByRole("button", { name: "Restore previous board", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Original board");
  await page.getByRole("button", { name: "Restore board", exact: true }).click();
  await openBoardMenu(page);
  await expect(page.getByRole("textbox", { name: "Board name" })).toHaveValue("Original board");
  expect(await stored(page)).toEqual({
    primary: original.primary,
    recovery: { ...imported, version: 1, theme: "clean", connectors: [] },
  });
  await page.reload();
  await openBoardMenu(page);
  await page.getByRole("button", { name: "Restore previous board", exact: true }).click();
  await page.getByRole("button", { name: "Restore board", exact: true }).click();
  await openBoardMenu(page);
  await expect(page.getByRole("textbox", { name: "Board name" })).toHaveValue(imported.name);
  expect(await stored(page)).toEqual({
    primary: { ...imported, version: 1, theme: "clean", connectors: [] },
    recovery: original.primary,
  });
});

test("invalid, unsupported and oversized imports leave the saved board untouched", async ({
  page,
}) => {
  await seed(page);
  const original = await stored(page);
  const cases: [string, string][] = [
    ["{broken", "not valid JSON"],
    [JSON.stringify({ ...imported, version: 99 }), "unsupported Hydraw format"],
    [
      JSON.stringify({ ...imported, shapes: [imported.shapes[0], imported.shapes[0]] }),
      "duplicate",
    ],
    [JSON.stringify({ ...imported, shapes: [{ ...imported.shapes[0], width: -1 }] }), "invalid"],
    ["oversized", "too large"],
  ];
  for (const [json, message] of cases) {
    if (json === "oversized") {
      await page.evaluate((size) => {
        Object.defineProperty(File.prototype, "size", { get: () => size });
      }, MAX_DOCUMENT_BYTES + 1);
    }
    await choose(page, json);
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText(message);
    await expect(page.getByRole("button", { name: "Open imported board" })).toBeDisabled();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(await stored(page)).toEqual(original);
  }
  await page.reload();
  await openBoardMenu(page);
  await expect(page.getByRole("textbox", { name: "Board name" })).toHaveValue("Original board");
});

for (const failure of ["abort", "throw"] as const) {
  test(`a ${failure} during the second storage write preserves primary and recovery`, async ({
    page,
  }) => {
    await seed(page);
    await openImported(page);
    const before = await stored(page);
    await page.evaluate((mode) => {
      const put = Object.getOwnPropertyDescriptor(IDBObjectStore.prototype, "put")!
        .value as IDBObjectStore["put"];
      IDBObjectStore.prototype.put = function (value: unknown, key?: IDBValidKey) {
        if (key === "primary" && (value as { name?: string }).name === "Failed import") {
          if (mode === "throw")
            throw new DOMException("Simulated write failure", "QuotaExceededError");
          const request = put.call(this, value, key);
          this.transaction.abort();
          return request;
        }
        return put.call(this, value, key);
      };
    }, failure);
    await choose(page, JSON.stringify({ ...imported, name: "Failed import" }));
    await page.getByRole("button", { name: "Open imported board" }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
      "has not been replaced",
    );
    expect(await stored(page)).toEqual(before);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await openBoardMenu(page);
    await expect(page.getByRole("textbox", { name: "Board name" })).toHaveValue(imported.name);
    await page.reload();
    expect(await stored(page)).toEqual(before);
  });
}

test("cancelling a reviewed import does not replace the board or create a recovery copy", async ({
  page,
}) => {
  await seed(page);
  const before = await stored(page);
  await choose(page);
  await expect(page.getByRole("button", { name: "Open imported board" })).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await stored(page)).toEqual(before);
  await openBoardMenu(page);
  await expect(
    page.getByRole("button", { name: "Restore previous board", exact: true }),
  ).toBeDisabled();
  await openObjects(page);
  await expect(page.getByRole("button", { name: "Rectangle 1", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("an export can be imported again without changing its semantic content", async ({ page }) => {
  await seed(page);
  const original = (await stored(page)) as { primary: unknown };
  const download = page.waitForEvent("download");
  await openBoardMenu(page);
  await page.getByRole("button", { name: "Export board", exact: true }).click();
  const stream = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  await choose(page, Buffer.concat(chunks).toString("utf8"));
  await page.getByRole("button", { name: "Open imported board" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await stored(page)).toEqual({ primary: original.primary, recovery: original.primary });
});

test("an unreadable recovery copy does not strand or overwrite a valid current board", async ({
  page,
}) => {
  await seed(page);
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("hydraw-board-v1", 1);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction("boards", "readwrite");
          transaction.objectStore("boards").put(
            {
              format: "hydraw",
              version: 99,
              futureRecovery: "preserve until explicit replacement",
            },
            "recovery",
          );
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
        request.onerror = () => reject(request.error);
      }),
  );
  await page.reload();
  await openBoardMenu(page);
  await expect(page.getByRole("textbox", { name: "Board name" })).toHaveValue("Original board");
  await expect(page.getByRole("alert")).toContainText("recovery copy could not be read");
  await addRectangle(page);
  await expect(page.getByRole("status")).toContainText("Saved in this browser");
  const before = await stored(page);
  expect(before).toMatchObject({
    recovery: { version: 99, futureRecovery: "preserve until explicit replacement" },
  });
  await choose(page);
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "replace that unreadable recovery copy",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await stored(page)).toEqual(before);
  await openImported(page);
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(await stored(page)).toMatchObject({
    primary: { ...imported, version: 1, theme: "clean", connectors: [] },
    recovery: { name: "Original board" },
  });
});
