import { describe, expect, it } from "vite-plus/test";
import {
  boardThemeTransaction,
  applyTransaction,
  planTransaction,
  createDocument,
} from "./index.ts";
import { decodeDocument } from "./validation.ts";

describe("board themes", () => {
  it("round-trips explicit themes", () => {
    expect(decodeDocument(createDocument()).theme).toBe("clean");
    expect(decodeDocument({ ...createDocument(), theme: "notebook" }).theme).toBe("notebook");
  });

  it("changes the board theme through an undoable transaction", () => {
    const doc = createDocument();
    const change = boardThemeTransaction("clean", "blueprint");
    expect(change).not.toBeNull();
    const themed = applyTransaction(doc, change!);
    expect(themed.theme).toBe("blueprint");
    expect(applyTransaction(themed, planTransaction(doc, change!).inverse)).toEqual(doc);
  });
});
