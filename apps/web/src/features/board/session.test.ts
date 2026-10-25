import { beforeEach, expect, it, vi } from "vite-plus/test";
import { createDocument } from "@hydraw/document";
import { createTextMeasurer } from "@hydraw/editor/canvas";
import { localBoards } from "./storage.ts";
import type { BoardLease } from "./repository.ts";
import { openBoardSession } from "./session.ts";

vi.mock("./storage.ts", () => ({ localBoards: { open: vi.fn() } }));
vi.mock("@hydraw/editor/canvas", () => ({ createTextMeasurer: vi.fn() }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(createTextMeasurer).mockReturnValue((text) => text.length * 10);
});

function storage(): BoardLease {
  return {
    id: "local",
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
  vi.mocked(localBoards.open).mockResolvedValue(local);
  const session = await openBoardSession(new AbortController().signal);
  expect(session.storage).toBe(local);
  expect(session.error).toBeNull();
  expect(session.id).toBe("local");
  expect(local.close).not.toHaveBeenCalled();
});

it("opens the requested board identity through the repository", async () => {
  const local = { ...storage(), id: "another-board" };
  vi.mocked(localBoards.open).mockResolvedValue(local);
  const signal = new AbortController().signal;
  const session = await openBoardSession(signal, "another-board");
  expect(localBoards.open).toHaveBeenCalledWith("another-board", signal);
  expect(session.id).toBe("another-board");
  expect(session.editor.documentSession.boardId).toBe("another-board");
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
  vi.mocked(localBoards.open).mockResolvedValue(local);
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
  vi.mocked(localBoards.open).mockImplementation(async () => {
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
  expect(localBoards.open).not.toHaveBeenCalled();
});
