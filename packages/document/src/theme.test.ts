import { describe, expect, it } from "vite-plus/test";
import {
  boardThemeTransaction,
  applyTransaction,
  invertTransaction,
  createDocument,
} from "./index.ts";
import { decodeDocument } from "./validation.ts";

describe("board themes", () => {
  it("migrates older boards to clean and round trips explicit themes", () => {
    const legacy = decodeDocument({
      format: "hydraw",
      version: 6,
      name: "Old",
      shapes: [],
      connectors: [],
    });
    expect(legacy.version).toBe(9);
    expect(legacy.theme).toBe("clean");
    expect(decodeDocument({ ...createDocument(), theme: "notebook" }).theme).toBe("notebook");
  });

  it("changes the board theme through an undoable transaction", () => {
    const doc = createDocument();
    const change = boardThemeTransaction("clean", "blueprint");
    expect(change).not.toBeNull();
    const themed = applyTransaction(doc, change!);
    expect(themed.theme).toBe("blueprint");
    expect(applyTransaction(themed, invertTransaction(change!))).toEqual(doc);
  });
});
