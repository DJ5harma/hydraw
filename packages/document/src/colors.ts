/** Persist only opaque six-digit hex colors; CSS expressions and alpha stay out of records. */
export type HexColor = `#${string}`;
export function isHexColor(value: unknown): value is HexColor {
  return typeof value === "string" && /^#[0-9a-f]{6}$/iu.test(value);
}

/** Friendly UI input accepts optional # and short hex, then produces the native representation. */
export function parseHexColor(input: string): HexColor | null {
  let hex = input.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/iu.test(hex)) hex = Array.from(hex, (digit) => digit + digit).join("");
  return /^[0-9a-f]{6}$/iu.test(hex) ? `#${hex.toLowerCase()}` : null;
}
