import { useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import type { ImageCrop, ImageShape } from "@hydraw/document";
import { FULL_IMAGE_CROP, sourceImageBounds } from "@hydraw/document";
import type { Camera } from "@hydraw/editor";
import "./image-crop-overlay.css";

type Edge = "left" | "right" | "top" | "bottom" | "move";
const normalized = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

export function ImageCropOverlay({
  image,
  camera,
  onApply,
  onCancel,
}: {
  image: ImageShape;
  camera: Camera;
  onApply: (crop: ImageCrop | null) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<ImageCrop>(image.crop ?? FULL_IMAGE_CROP);
  const [error, setError] = useState("");
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ edge: Edge; crop: ImageCrop; x: number; y: number } | null>(null);
  const source = sourceImageBounds(image);
  const left = source.x * camera.zoom + camera.x;
  const top = source.y * camera.zoom + camera.y;
  const width = source.width * camera.zoom;
  const height = source.height * camera.zoom;
  const minCropWidth = Math.min(1, 1 / source.width);
  const minCropHeight = Math.min(1, 1 / source.height);

  function apply(crop: ImageCrop | null) {
    setError("");
    try {
      onApply(crop);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The image crop could not be applied.");
    }
  }

  function beginDrag(edge: Edge, event: PointerEvent<SVGCircleElement | SVGRectElement>) {
    event.preventDefault();
    event.stopPropagation();
    const box = svgRef.current?.getBoundingClientRect();
    if (!box) return;
    (event.currentTarget as SVGElement).setPointerCapture(event.pointerId);
    dragRef.current = {
      edge,
      crop: draft,
      x: Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)),
      y: Math.max(0, Math.min(1, (event.clientY - box.top) / box.height)),
    };
  }

  function moveDrag(event: PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    const box = svgRef.current?.getBoundingClientRect();
    if (!drag || !box) return;
    const x = Math.max(0, Math.min(1, (event.clientX - box.left) / box.width));
    const y = Math.max(0, Math.min(1, (event.clientY - box.top) / box.height));
    const minX = minCropWidth;
    const minY = minCropHeight;
    let { x: cx, y: cy, width: cw, height: ch } = drag.crop;
    if (drag.edge === "left") {
      const right = cx + cw;
      cx = Math.min(right - minX, x);
      cw = right - cx;
    } else if (drag.edge === "right") cw = Math.max(minX, x - cx);
    else if (drag.edge === "top") {
      const bottom = cy + ch;
      cy = Math.min(bottom - minY, y);
      ch = bottom - cy;
    } else if (drag.edge === "bottom") ch = Math.max(minY, y - cy);
    else {
      cx = Math.max(0, Math.min(1 - cw, drag.crop.x + x - drag.x));
      cy = Math.max(0, Math.min(1 - ch, drag.crop.y + y - drag.y));
    }
    setDraft({
      x: normalized(cx),
      y: normalized(cy),
      width: normalized(cw),
      height: normalized(ch),
    });
  }

  function handleKey(event: KeyboardEvent<SVGRectElement>) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const step = event.shiftKey
      ? Math.min(0.05, minCropWidth * 5, minCropHeight * 5)
      : Math.min(minCropWidth, minCropHeight);
    const delta = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
    const vertical = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
    const edge = event.currentTarget.dataset.edge as Edge;
    const next = { ...draft };
    if (edge === "left") {
      const right = next.x + next.width;
      next.x = Math.max(0, Math.min(right - minCropWidth, next.x + delta));
      next.width = right - next.x;
    } else if (edge === "right")
      next.width = Math.max(minCropWidth, Math.min(1 - next.x, next.width + delta));
    else if (edge === "top") {
      const bottom = next.y + next.height;
      next.y = Math.max(0, Math.min(bottom - minCropHeight, next.y + vertical));
      next.height = bottom - next.y;
    } else if (edge === "bottom")
      next.height = Math.max(minCropHeight, Math.min(1 - next.y, next.height + vertical));
    setDraft({
      x: normalized(next.x),
      y: normalized(next.y),
      width: normalized(next.width),
      height: normalized(next.height),
    });
  }

  const handles: readonly [Edge, number, number][] = [
    ["left", draft.x, draft.y + draft.height / 2],
    ["right", draft.x + draft.width, draft.y + draft.height / 2],
    ["top", draft.x + draft.width / 2, draft.y],
    ["bottom", draft.x + draft.width / 2, draft.y + draft.height],
  ];

  function handleDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    event.stopPropagation();
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    } else if (event.key === "Enter" && !(event.target instanceof HTMLButtonElement)) {
      event.preventDefault();
      apply(draft);
    }
  }

  return (
    <div className="image-crop-overlay-root" data-workspace-overlay-root>
      <section
        className="image-crop-overlay"
        role="dialog"
        aria-label="Crop image"
        onKeyDown={handleDialogKeyDown}
      >
        <div className="image-crop-source" style={{ left, top, width, height }}>
          <img src={image.src} alt="" draggable={false} />
          <svg
            ref={svgRef}
            viewBox="0 0 1 1"
            preserveAspectRatio="none"
            onPointerMove={moveDrag}
            onPointerUp={() => {
              dragRef.current = null;
            }}
            onPointerCancel={() => {
              dragRef.current = null;
            }}
            onLostPointerCapture={() => {
              dragRef.current = null;
            }}
            aria-label="Image crop area"
          >
            <path
              className="image-crop-dim"
              fillRule="evenodd"
              d={`M0 0H1V1H0Z M${draft.x} ${draft.y}H${draft.x + draft.width}V${draft.y + draft.height}H${draft.x}Z`}
            />
            <rect
              className="image-crop-frame"
              x={draft.x}
              y={draft.y}
              width={draft.width}
              height={draft.height}
              onPointerDown={(event) => beginDrag("move", event)}
            />
            {handles.map(([edge, x, y]) => (
              <rect
                key={edge}
                className="image-crop-handle"
                x={x - 6 / Math.max(1, width)}
                y={y - 6 / Math.max(1, height)}
                width={12 / Math.max(1, width)}
                height={12 / Math.max(1, height)}
                rx={2 / Math.max(1, width)}
                tabIndex={0}
                role="slider"
                aria-label={`Crop ${edge} edge`}
                aria-valuenow={
                  edge === "left"
                    ? draft.x
                    : edge === "right"
                      ? draft.x + draft.width
                      : edge === "top"
                        ? draft.y
                        : draft.y + draft.height
                }
                data-edge={edge}
                onPointerDown={(event) => beginDrag(edge, event)}
                onKeyDown={handleKey}
              />
            ))}
          </svg>
        </div>
        <div className="image-crop-toolbar">
          {error && <p role="alert">{error}</p>}
          <button
            type="button"
            onClick={() => {
              setDraft(FULL_IMAGE_CROP);
              setError("");
            }}
          >
            Reset crop
          </button>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" onClick={() => apply(draft)}>
            Apply crop
          </button>
        </div>
      </section>
    </div>
  );
}
