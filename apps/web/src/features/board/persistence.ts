import { decodeDocument } from "@hydraw/document";
import type { BoardDocument } from "@hydraw/document";
import type { Editor } from "@hydraw/editor";
import type { LocalBoard } from "./storage.ts";

export type SaveState = "idle" | "saving" | "saved" | "error";
type PersistenceSnapshot = Readonly<{
  saveState: SaveState;
  saveError: string | null;
  recovery: BoardDocument | null;
  replacing: boolean;
}>;

/** One queue for autosave and board replacement; acknowledgements follow storage commits. */
export class BoardPersistence {
  private snapshot: PersistenceSnapshot;
  private listeners = new Set<() => void>();
  private tail = Promise.resolve();
  private applyingReplacement = false;
  private observedRevision: number;

  private readonly editor: Editor;
  private readonly storage: LocalBoard | null;

  constructor(editor: Editor, storage: LocalBoard | null, initialError: string | null) {
    this.editor = editor;
    this.storage = storage;
    this.observedRevision = editor.getSnapshot().revision;
    this.snapshot = {
      saveState: storage ? "idle" : "error",
      saveError: initialError,
      recovery: storage?.recovery ?? null,
      replacing: false,
    };
  }

  getSnapshot = (): PersistenceSnapshot => this.snapshot;
  getDocument = (): BoardDocument => this.editor.getSnapshot().document;
  get canReplace(): boolean {
    return this.storage !== null;
  }
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private publish(patch: Partial<PersistenceSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  private enqueue(job: () => Promise<void>): Promise<void> {
    const result = this.tail.then(job);
    this.tail = result.catch(() => {});
    return result;
  }

  connect(): () => void {
    return this.editor.subscribe(() => {
      const current = this.editor.getSnapshot();
      if (current.revision === this.observedRevision) return;
      this.observedRevision = current.revision;
      if (this.applyingReplacement || !this.storage) return;
      this.publish({ saveState: "saving" });
      void this.enqueue(async () => {
        await this.storage!.save(current.document);
        if (this.editor.getSnapshot().revision === current.revision)
          this.publish({ saveState: "saved", saveError: null });
      }).catch((error: unknown) => this.publish({ saveState: "error", saveError: message(error) }));
    });
  }

  async replace(next: BoardDocument): Promise<void> {
    const document = decodeDocument(next);
    if (!this.storage)
      throw new Error(
        "Import needs local storage so a recovery copy can be saved. Export your current work and enable local storage first.",
      );
    if (this.snapshot.replacing) throw new Error("A board replacement is already in progress.");
    const unlock = this.editor.lockDocument();
    const previous = this.getDocument();
    this.publish({ replacing: true });
    try {
      await this.enqueue(async () => {
        await this.storage!.replace(previous, document);
        this.applyingReplacement = true;
        try {
          this.editor.replaceDocument(document);
        } finally {
          this.applyingReplacement = false;
        }
        this.publish({ recovery: previous, saveState: "saved", saveError: null });
      });
    } finally {
      unlock();
      this.publish({ replacing: false });
    }
  }

  async restore(): Promise<void> {
    const recovery = this.snapshot.recovery;
    if (!recovery) throw new Error("No previous board is available.");
    await this.replace(recovery);
  }
}

export function message(error: unknown): string {
  return error instanceof Error ? error.message : "Local save failed.";
}
