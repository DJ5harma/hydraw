import { expect, test } from "@playwright/test";
import { openBoardMenu } from "./ui.ts";

test("board styles render, undo, redo, persist and export", async ({ page }) => {
  await page.goto("/");
  await openBoardMenu(page);
  const style = page.getByRole("combobox", { name: "Board style" });
  await style.selectOption("notebook");
  await expect(style).toHaveValue("notebook");
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await openBoardMenu(page);
  await expect(style).toHaveValue("clean");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await openBoardMenu(page);
  await expect(style).toHaveValue("notebook");
  await style.selectOption("blueprint");
  await expect(style).toHaveValue("blueprint");
  await expect(page.getByText("Saved in this browser").first()).toBeVisible({ timeout: 5_000 });
  await page.reload();
  await openBoardMenu(page);
  await expect(page.getByRole("combobox", { name: "Board style" })).toHaveValue("blueprint");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export board", exact: true }).click();
  const file = await download;
  const path = await file.path();
  expect(path).toBeTruthy();
  const exported = JSON.parse(
    await import("node:fs/promises").then(({ readFile }) => readFile(path!, "utf8")),
  );
  expect(exported.theme).toBe("blueprint");
  expect(exported.version).toBe(8);
});
