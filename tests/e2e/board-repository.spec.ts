import { expect, test } from "@playwright/test";

test("board repositories isolate writers, assets and recovery, then reopen portable documents", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "production",
    "Repository API is exercised through the development source module.",
  );
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const moduleUrl = new URL("/src/features/board/storage.ts", location.origin).href;
    const { localBoards } = (await import(
      moduleUrl
    )) as typeof import("../../apps/web/src/features/board/storage.ts");
    const signal = new AbortController().signal;
    const [left, right] = await Promise.all([
      localBoards.open("left", signal),
      localBoards.open("right", signal),
    ]);
    const source =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";
    const image = {
      id: "image",
      type: "image" as const,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      src: source,
      name: "Picture",
      flipX: true,
      crop: { x: 0.1, y: 0.2, width: 0.5, height: 0.6 },
    };
    const leftBoard = {
      ...left.document,
      name: "Left",
      shapes: [image, { ...image, id: "copy", x: 200 }],
    };
    const rightBoard = { ...right.document, name: "Right", shapes: [image] };
    try {
      await Promise.all([left.save(leftBoard), right.save(rightBoard)]);
      let blocked = false;
      try {
        const unexpected = await localBoards.open("left", signal);
        unexpected.close();
      } catch {
        blocked = true;
      }
      const inspect = () =>
        new Promise<{ manifest: unknown; keys: IDBValidKey[] }>((resolve, reject) => {
          const request = indexedDB.open("hydraw-board-v2", 1);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const database = request.result;
            const tx = database.transaction(["boards", "assets"], "readonly");
            const manifest = tx.objectStore("boards").get(["left", "primary"]);
            const keys = tx.objectStore("assets").getAllKeys();
            tx.oncomplete = () => {
              database.close();
              resolve({ manifest: manifest.result, keys: keys.result });
            };
            tx.onabort = () => {
              database.close();
              reject(tx.error);
            };
          };
        });
      const initial = await inspect();
      const empty = { ...left.document, name: "Empty" };
      await left.replace(leftBoard, empty);
      const retained = await inspect();
      await left.replace(empty, empty);
      const collected = await inspect();
      return { blocked, initial, retained, collected, leftBoard, rightBoard };
    } finally {
      left.close();
      right.close();
    }
  });
  expect(result.blocked).toBe(true);
  expect(JSON.stringify(result.initial.manifest)).not.toContain("base64");
  expect(result.initial.keys).toHaveLength(2); // one deduplicated image per board
  expect(result.retained.keys).toHaveLength(2); // recovery retains its own pixels
  expect(result.collected.keys).toHaveLength(1); // only the right board still uses pixels
  const reopened = await page.evaluate(async () => {
    const moduleUrl = new URL("/src/features/board/storage.ts", location.origin).href;
    const { localBoards } = (await import(
      moduleUrl
    )) as typeof import("../../apps/web/src/features/board/storage.ts");
    const signal = new AbortController().signal;
    const [left, right] = await Promise.all([
      localBoards.open("left", signal),
      localBoards.open("right", signal),
    ]);
    try {
      return { left: left.document, right: right.document, recovery: left.recovery };
    } finally {
      left.close();
      right.close();
    }
  });
  expect(reopened.left.name).toBe("Empty");
  expect(reopened.recovery?.name).toBe("Empty");
  expect(reopened.right).toEqual(result.rightBoard);
});

test("failed asset writes roll back pixels, document and recovery together", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "production",
    "Repository API is exercised through the development source module.",
  );
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const moduleUrl = new URL("/src/features/board/storage.ts", location.origin).href;
    const { localBoards } = (await import(
      moduleUrl
    )) as typeof import("../../apps/web/src/features/board/storage.ts");
    const signal = new AbortController().signal;
    const board = await localBoards.open("failure", signal);
    const original = { ...board.document, name: "Original" };
    await board.save(original);
    const put = Object.getOwnPropertyDescriptor(IDBObjectStore.prototype, "put")!
      .value as IDBObjectStore["put"];
    let rejected = false;
    try {
      IDBObjectStore.prototype.put = function (value: unknown, key?: IDBValidKey) {
        if (this.name === "assets")
          throw new DOMException("Simulated full storage", "QuotaExceededError");
        return put.call(this, value, key);
      };
      await board.replace(original, {
        ...original,
        name: "Lost",
        shapes: [
          {
            id: "image",
            type: "image",
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            name: "Picture",
            src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
          },
        ],
      });
    } catch {
      rejected = true;
    } finally {
      IDBObjectStore.prototype.put = put;
      board.close();
    }
    const reopened = await localBoards.open("failure", signal);
    try {
      return { rejected, document: reopened.document, recovery: reopened.recovery };
    } finally {
      reopened.close();
    }
  });
  expect(result).toMatchObject({
    rejected: true,
    document: { name: "Original", shapes: [] },
    recovery: null,
  });
});
