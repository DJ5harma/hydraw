import { expect, test } from "@playwright/test";
import { openBoardMenu } from "./ui.ts";

test("fresh storage ignores development boards, recovery copies and library items", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Board menu", exact: true })).toBeVisible();
  // These names are intentionally the retired namespaces, never app storage selectors.
  await page.evaluate(async () => {
    const previous = {
      format: "hydraw",
      version: 10,
      theme: "clean",
      name: "Development board",
      shapes: [
        { id: "old", type: "rectangle", x: 20, y: 20, width: 80, height: 60, fill: "#ffffff" },
      ],
      connectors: [],
    };
    async function seed(databaseName: string, storeName: string, values: [string, unknown][]) {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(databaseName, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(storeName);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction(storeName, "readwrite");
          for (const [key, value] of values) transaction.objectStore(storeName).put(value, key);
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onabort = () => {
            database.close();
            reject(transaction.error);
          };
        };
      });
    }
    await seed("hydraw-local", "boards", [
      ["primary", previous],
      ["recovery", previous],
    ]);
    await seed("hydraw-library", "items", [["old", { name: "Development library item" }]]);
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Create your first diagram" })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await openBoardMenu(page);
  await expect(page.getByRole("textbox", { name: "Board name" })).toHaveValue("Untitled board");
  await expect(page.getByRole("button", { name: "Restore previous board" })).toBeDisabled();
  await page.getByRole("button", { name: "My library", exact: true }).click();
  await expect(page.getByText("No saved items yet.", { exact: false })).toBeVisible();
  const previousName = await page.evaluate(
    async () =>
      new Promise<string>((resolve, reject) => {
        const request = indexedDB.open("hydraw-local", 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction("boards", "readonly");
          const record = transaction.objectStore("boards").get("primary");
          transaction.oncomplete = () => {
            database.close();
            resolve(record.result.name as string);
          };
          transaction.onabort = () => {
            database.close();
            reject(transaction.error);
          };
        };
      }),
  );
  expect(previousName).toBe("Development board");
});
