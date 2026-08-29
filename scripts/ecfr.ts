/**
 * Minimal, auditable eCFR XML table reader.
 *
 * Deliberately hand-written rather than pulled from a dependency: the whole
 * premise of this project is that a stranger can read the source and confirm
 * the corpus was derived honestly. An opaque parser would undercut that.
 *
 * The eCFR serves CFR tables as plain <TABLE>/<TR>/<TD> with inline <E>, <I>,
 * <sup>, <sub> and <br/> markup and HTML entities. Nothing else is needed.
 */

/** Collapse one table cell to its text, preserving reading order. */
export function cellText(raw: string): string {
  return decodeEntities(
    raw
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, "")
  )
    // The CFR uses em and en dashes as range and gap markers. Normalize to a
    // hyphen so downstream string comparison and our own AI-tone rules agree.
    .replace(/[—–]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  mdash: "—", ndash: "–", deg: "°", times: "×",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
  micro: "µ", plusmn: "±", le: "≤", ge: "≥",
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => NAMED[n.toLowerCase()] ?? m);
}

/** Every <TABLE> in document order, as raw XML slices. */
export function tables(xml: string): string[] {
  return xml.match(/<TABLE[\s\S]*?<\/TABLE>/g) ?? [];
}

/** Rows of a table (or of a whole document) as arrays of cell text. */
export function rows(xml: string, opts: { includeTh?: boolean } = {}): string[][] {
  const cellRe = opts.includeTh ? /<T[DH][^>]*>([\s\S]*?)<\/T[DH]>/g : /<TD[^>]*>([\s\S]*?)<\/TD>/g;
  const out: string[][] = [];
  for (const [, tr] of xml.matchAll(/<TR>([\s\S]*?)<\/TR>/g)) {
    const cells: string[] = [];
    for (const [, c] of tr.matchAll(new RegExp(cellRe.source, "g"))) cells.push(cellText(c));
    out.push(cells);
  }
  return out;
}

/** Strip all markup from a section, for verbatim clause extraction. */
export function plainText(xml: string): string {
  return decodeEntities(xml.replace(/<[^>]+>/g, " "))
    .replace(/[—–]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}
