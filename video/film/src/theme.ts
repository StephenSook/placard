/**
 * The film's palette, lifted from the product's own CSS custom properties
 * (src/ui/tokens.css) rather than picked by eye, so the cut and the app read as
 * one system. Every saturated colour here is a 49 CFR 172 subpart F placard
 * colour, which is also true in the product.
 */
export const T = {
  paper: "#f4e9e1",
  paperDeep: "#ebdfd5",
  paperEdge: "#ded0c4",
  card: "#fffdfb",
  ink: "#14110e",
  inkSoft: "#5d554d",
  inkFaint: "#6d6156",

  deck: "#1b1916",
  deckRaised: "#262320",
  deckRule: "#3a352f",
  deckInk: "#ece5dd",
  deckInkSoft: "#9c9188",

  // Placard colours, 49 CFR 172 subpart F.
  flammable: "#d8232a",
  nonflam: "#00843d",
  oxidizer: "#ffd100",
  corrosive: "#101010",

  refusedText: "#e55d62",
  clearedText: "#00a04a",
} as const;

export const FONT_DISPLAY = "Archivo";
export const FONT_BODY = "Public Sans";
export const FONT_MONO = "IBM Plex Mono";

/** Title-safe inset, about 10 percent, per the motion-graphics guidance. */
export const SAFE = 108;
