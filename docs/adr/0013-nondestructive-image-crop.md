# ADR 0013: non-destructive image cropping

Status: implemented, 24 October 2026.

Native v10 adds an optional image crop rectangle, normalized against the original
embedded PNG. Earlier formats migrate without a crop. The original pixels and
identity remain unchanged; displayed bounds describe only the visible crop.
Source bounds are recovered from those bounds and crop proportions, so subsequent
movement and resizing apply coherently to both cropping and reset.

Pure document helpers validate source-relative rectangles, calculate visible and
full-source bounds, and create reversible crop transactions. Invalid or out-of-range
source geometry fails atomically. The editor enforces locked-object/group guards;
React owns only the temporary crop draft and handle interactions.

Double-click and visible properties/context actions open a crop overlay with the
full original source, outside dimming, fixed-screen-size handles and Apply/Cancel/
Reset controls. Arrow keys adjust focused edges; Shift increases the step. Enter
applies from a handle, Escape cancels, and native button Enter behavior is retained.
Minimum crop extent is one world unit independent of zoom. Reset changes the draft;
Apply commits once. Closing the overlay never changes the document.

Canvas uses the source rectangle in drawImage; SVG uses a nested viewBox with the
same proportions. Native/SVG exports retain the original embedded pixels; exported
PNG and clipboard images rasterize only the visible region. Ordinary clipboard and
library fragments preserve crop metadata and remap identity on insertion.

Unit checks cover validation, migrations, undo, bounds and binding changes, source
preservation, repeated crops and move/resize/reset. Browser checks cover entry,
keyboard/drag controls, cancellation, reset, undo/redo, reload and exported pixel
content. Desktop and 320 px overlays are visually inspected.
