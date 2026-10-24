# ADR 0012: portable images, ink and coordinated board styles

Status: implemented, 23 October 2026.

The board now supports image annotation, freehand explanations, hold-to-shape
recognition, connected creation and coordinated styles without a backend.

## Document and ownership

The current version-1 format requires an explicit board theme and supports embedded
image shapes and normalized freehand ink. New boards start with the Clean theme.
A theme change is a document transaction; standalone text is refitted with the
chosen font in that same transaction. Theme rendering derives colors from the
original semantic objects so switching back restores their authored styles.
Canvas, inline text and SVG use the same chosen font metrics. Image pixels do not
change with the board style.

Image records contain portable PNG data, a name and ordinary object bounds and
metadata. Browser file decoding accepts PNG/JPEG/WebP, normalizes orientation and
transparency through a raster canvas, and embeds the result. No remote URLs or SVG
markup enter image records. Sources are capped at 12 MB/40 megapixels, normalized
to at most 4096 pixels per side, with 4 million encoded characters per picture and
24 million per board. Native import permits 200 MB to accommodate text, labels and
assets; supported record limits are independent of performance targets.

File reading, drop/paste events, decoding and resource cleanup belong to the web
and canvas adapters. Pure image insertion creates an atomic domain transaction.
The requested world point survives camera movement during decoding; document
epoch and workspace lifecycle checks reject stale asynchronous insertions.
Decoded image resources live with each canvas, and are released on disposal or
when no current record uses them. SVG embeds image data; PNG derives from SVG.

Ink records contain normalized local points (0–1), bounds, ink color and width.
Movement and resizing reuse ordinary shape geometry; hit testing measures distance
to the polyline rather than treating its interior as solid. One-point dots and
horizontal/vertical paths are supported. Sampling is capped at 4096 points per
path and 100,000 per board, enforced at import and transaction boundaries.

## Interaction contracts

P selects Draw. Ink color/width defaults stay local to the editor; selected ink
styling is undoable and respects locks. Each stroke creates one transaction. Escape,
blur and lost pointer capture cancel an unfinished stroke and clear the hold timer.
Holding the pointer within three screen pixels for 500 ms attempts rectangle or
ellipse recognition. Recognition requires closure and geometric coverage; open
paths remain ink. Moving more than three pixels after recognition resumes the
original stroke. Recognition is a preview decision before creation, not an
identity-changing document transaction.

Selected ordinary shapes expose connection handles. Dragging one to an existing
object binds an arrow; dropping on empty space creates a matching node and arrow
atomically, then opens its label. Escape cancels. The ordinary C connector tool
continues to create free endpoints. Undoing a later label edit and undoing creation
are separate, predictable steps.

## Verification

Unit tests exercise bounds, normalized points, recognition, style preservation,
locked edits, semantic round trips, asset/sample limits, transaction atomicity,
clipboard, fonts and exports. Browser journeys exercise image file/paste/drop,
stale asynchronous insertion, persistence, drawing, recognition, cancellation,
pan/zoom, connected creation and theme history. Desktop and 320 px layouts are
visually inspected. Desktop Chromium is the verified browser target; pressure,
multitouch drawing and broader browser coverage remain separate work.
