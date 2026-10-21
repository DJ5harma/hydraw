import type { Bounds } from "@hydraw/document";
import type { Camera } from "./types.ts";
import { clamp } from "./geometry.ts";

// Includes an overview of documents spanning the portable coordinate limits.
export const MIN_ZOOM = 0.00001;
export const MAX_ZOOM = 4;

/** Fit semantic bounds into an unobstructed screen rectangle without magnifying small objects. */
export function fittedCamera(bounds: Bounds, viewport: Bounds): Camera | null {
  if (
    !Object.values(viewport).every(Number.isFinite) ||
    viewport.width <= 0 ||
    viewport.height <= 0
  )
    return null;
  const zoom = clamp(
    Math.min(
      viewport.width / Math.max(bounds.width, 1),
      viewport.height / Math.max(bounds.height, 1),
      1,
    ),
    MIN_ZOOM,
    MAX_ZOOM,
  );
  return {
    x: viewport.x + viewport.width / 2 - (bounds.x + bounds.width / 2) * zoom,
    y: viewport.y + viewport.height / 2 - (bounds.y + bounds.height / 2) * zoom,
    zoom,
  };
}
