import { beforeEach, expect, it, vi } from "vite-plus/test";
import { createDocument } from "@hydraw/document";
import { createTextMeasurer } from "@hydraw/editor/canvas";
import { openLocalBoard } from "./storage.ts";
import type { LocalBoard } from "./storage.ts";
import { openBoardSession } from "./session.ts";

vi.mock("./storage.ts", () => ({ openLocalBoard: vi.fn() }));
vi.mock("@hydraw/editor/canvas", () => ({ createTextMeasurer: vi.fn() }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(createTextMeasurer).mockReturnValue((text) => text.length * 10);
});

function storage(): LocalBoard {
  return {
    document: createDocument(),
    recovery: null,
    recoveryWarning: null,
    save: vi.fn(),
    replace: vi.fn(),
    close: vi.fn(),
  };
}

it("keeps acquired storage with a successfully initialized editor", async () => {
  const local = storage();
  vi.mocked(openLocalBoard).mockResolvedValue(local);
  const session = await openBoardSession(new AbortController().signal);
  expect(session.storage).toBe(local);
  expect(session.error).toBeNull();
  expect(local.close).not.toHaveBeenCalled();
});

it("opens stored text without rewriting geometry or measuring fonts", async () => {
  const local = storage();
  local.document = {
    ...createDocument(),
    shapes: [
      {
        id: "text",
        type: "text",
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        text: "Existing text",
        fontSize: 24,
        fontWeight: 400,
        textAlign: "left",
        color: "#243e33",
      },
    ],
  };
  vi.mocked(openLocalBoard).mockResolvedValue(local);
  vi.mocked(createTextMeasurer).mockReturnValue(() => {
    throw new Error("Font measurement failed");
  });
  const session = await openBoardSession(new AbortController().signal);
  expect(local.close).not.toHaveBeenCalled();
  expect(session.storage).toBe(local);
  expect(session.error).toBeNull();
  expect(session.editor.getSnapshot().document).toEqual(local.document);
});

it("closes a late storage result after cancellation without creating a fallback session", async () => {
  const controller = new AbortController();
  const local = storage();
  vi.mocked(openLocalBoard).mockImplementation(async () => {
    controller.abort();
    return local;
  });
  await expect(openBoardSession(controller.signal)).rejects.toThrow();
  expect(local.close).toHaveBeenCalledOnce();
});

it("reports renderer initialization failures before acquiring a writer", async () => {
  vi.mocked(createTextMeasurer).mockImplementation(() => {
    throw new Error("Canvas unavailable");
  });
  await expect(openBoardSession(new AbortController().signal)).rejects.toThrow(
    "Canvas unavailable",
  );
  expect(openLocalBoard).not.toHaveBeenCalled();
});
