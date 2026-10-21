import { isFrame } from "@hydraw/document";
import type { BoardDocument, Point } from "@hydraw/document";
import { selectionBounds } from "./selection-bounds.ts";

export type SnapGuide = Readonly<{
  axis: "x" | "y";
  position: number;
  start: number;
  end: number;
  kind: "align" | "spacing";
  gap?: number;
  segments?: readonly Readonly<{ start: number; end: number; cross: number }>[];
}>;

type Candidate = Readonly<{ correction: number; guide: SnapGuide }>;
type AxisBounds = Readonly<{ start: number; end: number }>;

const SCREEN_TOLERANCE = 6;

/** Snap a whole selection translation to nearby shape edges and repeated edge gaps. */
export function snapTranslation(
  document: BoardDocument,
  ids: readonly string[],
  requested: Point,
  zoom: number,
): Readonly<{ delta: Point; guides: readonly SnapGuide[] }> {
  if (!Number.isFinite(requested.x) || !Number.isFinite(requested.y))
    return { delta: requested, guides: [] };
  if (!Number.isFinite(zoom) || zoom <= 0) return { delta: requested, guides: [] };
  const selected = new Set(ids);
  const bounds = selectionBounds(document.shapes, document.connectors, ids);
  if (!bounds) return { delta: requested, guides: [] };
  const selectedBounds = bounds;

  const peers = document.shapes.filter((shape) => !selected.has(shape.id) && !isFrame(shape));
  const tolerance = SCREEN_TOLERANCE / zoom;
  const choose = (candidates: Candidate[]): Candidate | null => {
    candidates.sort(
      (a, b) =>
        Math.abs(a.correction) - Math.abs(b.correction) ||
        (a.guide.kind === b.guide.kind ? 0 : a.guide.kind === "align" ? -1 : 1) ||
        a.guide.position - b.guide.position,
    );
    return candidates[0] && Math.abs(candidates[0].correction) <= tolerance ? candidates[0] : null;
  };

  function axisCandidates(axis: "x" | "y"): Candidate[] {
    const horizontal = axis === "x";
    const moving: AxisBounds = horizontal
      ? {
          start: selectedBounds.x + requested.x,
          end: selectedBounds.x + selectedBounds.width + requested.x,
        }
      : {
          start: selectedBounds.y + requested.y,
          end: selectedBounds.y + selectedBounds.height + requested.y,
        };
    const otherStart = horizontal ? selectedBounds.y + requested.y : selectedBounds.x + requested.x;
    const otherEnd = horizontal
      ? selectedBounds.y + selectedBounds.height + requested.y
      : selectedBounds.x + selectedBounds.width + requested.x;
    const entries = peers.map((shape) => {
      const start = horizontal ? shape.x : shape.y;
      const extent = horizontal ? shape.width : shape.height;
      const orthStart = horizontal ? shape.y : shape.x;
      const orthEnd = orthStart + (horizontal ? shape.height : shape.width);
      return { start, end: start + extent, orthStart, orthEnd };
    });
    const candidates: Candidate[] = [];
    for (const peer of entries) {
      for (const target of [peer.start, (peer.start + peer.end) / 2, peer.end]) {
        for (const edge of [moving.start, (moving.start + moving.end) / 2, moving.end]) {
          candidates.push({
            correction: target - edge,
            guide: {
              axis,
              position: target,
              start: Math.min(otherStart, peer.orthStart),
              end: Math.max(otherEnd, peer.orthEnd),
              kind: "align",
            },
          });
        }
      }
    }

    // Repeated gaps use only neighboring entries in a sorted sweep, keeping the
    // candidate count linear after sorting even on the largest permitted board.
    const sorted = entries
      .filter((peer) => peer.orthEnd >= otherStart && peer.orthStart <= otherEnd)
      .sort((a, b) => a.start - b.start || a.end - b.end);
    for (let index = 0; index + 1 < sorted.length; index++) {
      const left = sorted[index]!;
      const right = sorted[index + 1]!;
      const gap = right.start - left.end;
      if (gap < 0) continue;
      const movingWidth = moving.end - moving.start;
      const cross = (otherStart + otherEnd) / 2;
      const placements = [
        {
          position: right.end + gap,
          repeatedGap: gap,
          segments: [
            { start: left.end, end: right.start, cross },
            { start: right.end, end: right.end + gap, cross },
          ],
        },
        {
          position: left.start - gap - movingWidth,
          repeatedGap: gap,
          segments: [
            { start: left.start - gap, end: left.start, cross },
            { start: left.end, end: right.start, cross },
          ],
        },
      ];
      if (gap >= movingWidth) {
        const equalGap = (gap - movingWidth) / 2;
        placements.push({
          position: left.end + equalGap,
          repeatedGap: equalGap,
          segments: [
            { start: left.end, end: left.end + equalGap, cross },
            { start: left.end + equalGap + movingWidth, end: right.start, cross },
          ],
        });
      }
      for (const placement of placements) {
        const { position } = placement;
        const correction = position - moving.start;
        candidates.push({
          correction,
          guide: {
            axis,
            position: placement.segments[0]!.start,
            start: Math.min(otherStart, otherEnd, left.orthStart, right.orthStart),
            end: Math.max(otherStart, otherEnd, left.orthEnd, right.orthEnd),
            kind: "spacing",
            gap: placement.repeatedGap,
            segments: placement.segments,
          },
        });
      }
    }
    return candidates;
  }

  const x = choose(axisCandidates("x"));
  const y = choose(axisCandidates("y"));
  return {
    delta: {
      x: requested.x + (x?.correction ?? 0),
      y: requested.y + (y?.correction ?? 0),
    },
    guides: [x?.guide, y?.guide].filter((guide): guide is SnapGuide => Boolean(guide)),
  };
}
