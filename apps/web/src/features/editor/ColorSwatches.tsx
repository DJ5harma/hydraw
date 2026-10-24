import { FILLS, TEXT_COLORS } from "@hydraw/document";
import { Icon } from "../../components/icons.tsx";

// Names live with their palettes rather than being repeated by each inspector.
const fillNames: Record<(typeof FILLS)[number], string> = {
  "#e7eefb": "Blue",
  "#e6f2ea": "Sage",
  "#fff0d5": "Sand",
  "#f7e4ed": "Rose",
  "#ffffff": "White",
  transparent: "Transparent",
};
const inkNames: Record<(typeof TEXT_COLORS)[number], string> = {
  "#243e33": "Forest",
  "#3568db": "Blue",
  "#8d315a": "Rose",
  "#805d20": "Ochre",
  "#202124": "Ink",
};
export const fillPalette = FILLS.map((color) => ({ color, name: fillNames[color] }));
export const inkPalette = TEXT_COLORS.map((color) => ({ color, name: inkNames[color] }));

export function ColorSwatches<Color extends string>({
  palette,
  value,
  onChange,
  label,
  suffix,
  ink = false,
}: {
  palette: readonly { color: Color; name: string }[];
  value: Color;
  onChange: (value: Color) => void;
  label: string;
  suffix: string;
  ink?: boolean;
}) {
  return (
    <div className="swatches" role="group" aria-label={label}>
      {palette.map(({ color, name }) => (
        <button
          key={color}
          className={`swatch ${value === color ? "is-selected" : ""}`}
          style={{ backgroundColor: color, color: ink ? "white" : undefined }}
          data-transparent={color === "transparent" ? true : undefined}
          title={`${name} ${suffix}`}
          aria-label={`${name} ${suffix}`}
          aria-pressed={value === color}
          onClick={() => onChange(color)}
        >
          {value === color && <Icon name="check" />}
        </button>
      ))}
    </div>
  );
}
