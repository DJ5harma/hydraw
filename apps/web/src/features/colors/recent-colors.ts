import { isHexColor } from "@hydraw/document";
import type { HexColor } from "@hydraw/document";

const KEY = "hydraw-recent-colors-v1";
const LIMIT = 8;
let colors: readonly HexColor[] = [];
let initialized = false;
const listeners = new Set<() => void>();

function read(): readonly HexColor[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw || raw.length > 1000) return [];
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value)
      ? [
          ...new Set(value.filter(isHexColor).map((color) => color.toLowerCase() as HexColor)),
        ].slice(0, LIMIT)
      : [];
  } catch {
    return [];
  }
}
export function getRecentColors(): readonly HexColor[] {
  if (!initialized) {
    colors = read();
    initialized = true;
  }
  return colors;
}
function storageChanged(event: StorageEvent) {
  if (event.key !== KEY && event.key !== null) return;
  colors = read();
  listeners.forEach((listener) => listener());
}
export function subscribeRecentColors(listener: () => void): () => void {
  if (!listeners.size) window.addEventListener("storage", storageChanged);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) window.removeEventListener("storage", storageChanged);
  };
}
export function rememberColor(color: HexColor): void {
  colors = [color, ...getRecentColors().filter((item) => item !== color)].slice(0, LIMIT);
  try {
    localStorage.setItem(KEY, JSON.stringify(colors));
  } catch {
    /* Session recents still work when storage is unavailable. */
  }
  listeners.forEach((listener) => listener());
}
