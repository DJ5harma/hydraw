import type { Editor } from "./editor.ts";
import { bindCanvasInput } from "./browser/input.ts";
import { createSceneRenderer } from "./browser/render.ts";

/** Owns browser resources only. Input, drawing, and semantic editing have separate lifecycles. */
export function attachCanvas(canvas: HTMLCanvasElement, editor: Editor): () => void {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not start the drawing canvas.");
  const renderScene = createSceneRenderer(context);
  let width = 0;
  let height = 0;
  let frame = 0;
  const events = new AbortController();
  function schedule(): void {
    if (!frame) frame = requestAnimationFrame(render);
  }
  const input = bindCanvasInput(canvas, editor, schedule);
  function render(): void {
    frame = 0;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    renderScene(editor.getSnapshot(), { width, height, dpr });
    canvas.style.cursor = input.cursor();
  }
  const observer = new ResizeObserver(([entry]) => {
    if (!entry) return;
    width = entry.contentRect.width;
    height = entry.contentRect.height;
    schedule();
  });
  observer.observe(canvas);
  const unsubscribe = editor.subscribe(schedule);
  window.addEventListener("resize", schedule, { signal: events.signal });
  schedule();
  return () => {
    events.abort();
    observer.disconnect();
    unsubscribe();
    input.dispose();
    if (frame) cancelAnimationFrame(frame);
  };
}

export { createTextMeasurer } from "./browser/text.ts";
