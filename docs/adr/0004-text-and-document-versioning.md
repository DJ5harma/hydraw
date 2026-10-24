# 0004: Standalone text and versioned document evolution

Status: accepted, 20 October 2026. Extends ADRs 0002 and 0003.

## Version boundary

The current version-1 format includes standalone text. Shapes are a discriminated union, sharing immutable bounds and identity. Text records contain plain content, font size, weight, alignment and ink color. Validation bounds text to 2,000 UTF-16 code units, 12–96 px fonts, supported styles and finite geometry. Clipboard tabs normalize to four spaces; line endings normalize to LF before validation. Control characters other than LF are rejected.

The decoder accepts only the complete [current format](../FORMAT.md). Unknown versions and shape types fail rather than being stripped or silently rewritten. Exporting uses the same validated model as importing.

Shape transactions retain full semantic before/after records for either type. Preconditions include content and style, so undo cannot silently overwrite a later text edit. An existing identity cannot change shape type.

## Layout and geometry

Text uses one system font family, Arial with a sans-serif fallback. Pure layout code wraps words, splits long tokens at grapheme boundaries and preserves explicit blank lines. Font measurement is injected into the engine through a browser adapter; core modules never create a canvas or depend on React. The renderer uses the same wrapping code with Canvas font metrics.

Width is editable, while height is derived from line count, font size, line height and padding. Text exposes horizontal resize handles rather than arbitrary vertical stretching. The Editor prepares text documents using its font metrics at open and replacement boundaries. Persistence stores this prepared document before publishing replacement, avoiding imported height values that disagree with hit-testing and the visible content. Height is allowed a larger bound than rectangle size to accommodate the maximum supported line count.

System font availability can change layout between machines. This slice does not promise pixel-identical typography, custom fonts, advanced language-specific line breaking or rich text. A native textarea performs editing layout; its whitespace and script wrapping may differ slightly from Canvas wrapping.

## Draft and input lifecycle

The engine owns a separate text draft containing the original record and the candidate. Typing updates this draft and its derived height, without creating document revisions, autosaves or history entries. Completion creates one normal shape transaction; cancelling keeps the original document and history. Empty or whitespace-only creation is discarded. Completing an empty existing text object deletes it, with undo available.

A focused textarea over the canvas supplies text selection, clipboard and native composition. Input events stop editor shortcuts; composition key events do not trigger save/cancel. Enter inserts a newline, Ctrl/Command Enter commits and Escape cancels. Blur commits before tool, inspector or file actions. Document commands also finish a pending draft; undo/redo cancel any outstanding draft. Acquiring a replacement lease completes the draft before capturing the previous board for recovery.

The React overlay subscribes to the full snapshot for camera positioning. Other controls use the existing reduced snapshot. Canvas rendering hides the committed text while its draft input is active. Long content editing does not automatically scroll the camera yet. Rich spans, rectangle labels, font families and text-bound connectors remain separate increments.
