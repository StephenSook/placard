/**
 * A DOT hazard placard.
 *
 * Drawn as the real thing: a square on point, with the class number at the
 * bottom and the symbol area above, in the colours 49 CFR 172 Subpart F
 * specifies. Hand-authored SVG rather than generated art, because the colours
 * and the geometry are regulated and an approximation would be a false claim
 * in a project whose whole premise is that it does not guess.
 *
 * Class 8 and Class 6.1 are split-field placards in the regulation: corrosive
 * is white over black, poison is a white field. Both are drawn that way rather
 * than flattened to one fill, because that split IS the identification.
 */

export type PlacardSpec = {
  /** Fill of the upper field. */
  top: string;
  /** Fill of the lower field, when the placard is split. */
  bottom?: string;
  /** Colour of the border rule, which sits on the upper field. */
  ink: string;
  /**
   * Colour of the class number. On a SPLIT placard the number sits in the
   * LOWER field, so it must contrast with that field and not with the upper
   * one. Class 8 is white over black and its number is white; getting this
   * wrong paints black on black and the placard loses its identification.
   */
  numberInk?: string;
  /** What the colour means, spoken. Never let colour carry meaning alone. */
  label: string;
};

/**
 * The placard for a hazard class. Keyed on the division string as 172.101
 * column 3 writes it, so "1.1D" and "5.1" both resolve.
 */
export function placardFor(hazardClass: string): PlacardSpec {
  const c = hazardClass.trim();
  if (/^1\./.test(c)) return { top: "var(--hz-explosive)", ink: "#101010", label: "Explosive" };
  switch (c.split(/[^0-9.]/)[0]) {
    case "2.1": return { top: "var(--hz-flammable)", ink: "#ffffff", label: "Flammable gas" };
    case "2.2": return { top: "var(--hz-nonflam)", ink: "#ffffff", label: "Non-flammable gas" };
    case "2.3": return { top: "var(--hz-toxic)", ink: "#101010", label: "Poisonous gas" };
    case "3": return { top: "var(--hz-flammable)", ink: "#ffffff", label: "Flammable liquid" };
    case "4.1": return { top: "#ffffff", bottom: "var(--hz-flammable)", ink: "#101010", numberInk: "#ffffff", label: "Flammable solid" };
    case "4.2": return { top: "#ffffff", bottom: "var(--hz-flammable)", ink: "#101010", numberInk: "#ffffff", label: "Spontaneously combustible" };
    case "4.3": return { top: "var(--hz-wet)", ink: "#ffffff", label: "Dangerous when wet" };
    case "5.1": return { top: "var(--hz-oxidizer)", ink: "#101010", label: "Oxidizer" };
    case "5.2": return { top: "var(--hz-oxidizer)", ink: "#101010", label: "Organic peroxide" };
    case "6.1": return { top: "var(--hz-toxic)", ink: "#101010", label: "Poison" };
    case "7": return { top: "var(--hz-radioactive)", bottom: "#ffffff", ink: "#101010", numberInk: "#101010", label: "Radioactive" };
    case "8": return { top: "#ffffff", bottom: "var(--hz-corrosive)", ink: "#101010", numberInk: "#ffffff", label: "Corrosive" };
    case "9": return { top: "#ffffff", ink: "#101010", label: "Miscellaneous" };
    default:
      // Forbidden materials have no class and therefore no placard, because
      // they may not be offered for transportation at all.
      return { top: "var(--paper-deep)", ink: "var(--ink-faint)", label: "No placard" };
  }
}

export function Placard({
  hazardClass,
  size = 96,
  muted = false,
}: {
  hazardClass: string;
  size?: number;
  /** Dim the placard when it is context rather than the subject. */
  muted?: boolean;
}) {
  const spec = placardFor(hazardClass);
  const isForbidden = hazardClass.trim() === "Forbidden";
  const shown = isForbidden ? "" : hazardClass.trim();
  const id = `pl-${hazardClass.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={
        isForbidden
          ? "Forbidden material. No placard: it may not be offered for transportation."
          : `Class ${shown} placard, ${spec.label}`
      }
      style={{ opacity: muted ? 0.5 : 1, display: "block", flexShrink: 0 }}
    >
      <defs>
        <clipPath id={id}>
          {/* The square on point. 172.519 specifies the diamond. */}
          <path d="M50 3 L97 50 L50 97 L3 50 Z" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${id})`}>
        <rect x="0" y="0" width="100" height={spec.bottom ? 50 : 100} fill={spec.top} />
        {spec.bottom && <rect x="0" y="50" width="100" height="50" fill={spec.bottom} />}
      </g>

      {/* The inner rule the real placard carries, 5mm inside the edge. */}
      <path
        d="M50 3 L97 50 L50 97 L3 50 Z"
        fill="none"
        stroke={spec.ink}
        strokeWidth="2.5"
        opacity="0.85"
      />
      <path
        d="M50 11 L89 50 L50 89 L11 50 Z"
        fill="none"
        stroke={spec.ink}
        strokeWidth="1.6"
        opacity="0.5"
      />

      {isForbidden ? (
        // A bar across an empty field: this material has no placard because it
        // has no lawful transport configuration.
        <path d="M26 74 L74 26" stroke={spec.ink} strokeWidth="4" strokeLinecap="round" opacity="0.7" />
      ) : (
        <text
          x="50"
          y="79"
          textAnchor="middle"
          fill={spec.numberInk ?? spec.ink}
          fontFamily="var(--font-display)"
          fontWeight="700"
          fontSize={shown.length > 3 ? 17 : 21}
          letterSpacing="-0.5"
        >
          {shown}
        </text>
      )}
    </svg>
  );
}
