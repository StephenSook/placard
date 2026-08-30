/**
 * Generate the film's clause ticker from the COMMITTED corpus.
 *
 * The strip that crosses the top of every built scene carries verbatim
 * regulation text, byte-identical to data/clauses.json, for the same reason the
 * product quotes rather than paraphrases: a film that summarises the rule while
 * claiming the tool quotes it has made a claim the repo contradicts. Generated,
 * never typed, so the two cannot drift.
 */
import { readFileSync, writeFileSync } from "node:fs";

const IDS = [
  "e2-X", "e3-O", "e3-corrosive-hard-block", "e4-asterisk",
  "c-cyanide-acid", "c-42-vs-8", "g2-X", "g3i-group-L", "17321-a-forbidden",
];

const { clauses } = JSON.parse(readFileSync("data/clauses.json", "utf8"));
const items = IDS.map((id) => {
  const c = clauses[id];
  if (!c) throw new Error(`ticker clause ${id} is not in data/clauses.json`);
  const text = c.text.replace(/\s+/g, " ").trim();
  return { id, cite: c.section, text: text.length > 190 ? `${text.slice(0, 187)}...` : text };
});
writeFileSync(
  "video/film/src/data/ticker.json",
  JSON.stringify({ source: "data/clauses.json, verbatim", count: items.length, items }, null, 2) + "\n",
);
process.stdout.write(`ticker: ${items.length} clauses\n`);
