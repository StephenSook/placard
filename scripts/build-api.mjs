/**
 * Bundle the two Vercel functions into self-contained ESM.
 *
 * This exists because of one specific Vercel behaviour that is invisible until
 * it 500s in production: with `"type": "module"` in package.json, @vercel/node
 * TRANSPILES a TypeScript function and does not bundle it, so every import
 * reaching outside `api/` is left as a bare specifier and the runtime dies with
 * ERR_MODULE_NOT_FOUND on a `.ts` path that will never exist in the lambda.
 *
 * Both handlers therefore live in `api/_handlers/`, which Vercel ignores for
 * routing because of the underscore, and esbuild produces the routable
 * `api/*.js` beside them with the corpus and the solver inlined. That is the
 * same thing Netlify's own bundler does for the .mts adapters, so the two hosts
 * end up serving the same computation from the same source.
 *
 * The generated files are NOT committed. They are build output, and a committed
 * build artifact drifts from its source the first time someone forgets.
 */
import { build } from "esbuild";
import { readdir } from "node:fs/promises";

const dir = "api/_handlers";
const entryPoints = (await readdir(dir))
  .filter((f) => f.endsWith(".ts"))
  .map((f) => `${dir}/${f}`);

if (entryPoints.length === 0) {
  console.error("build-api: no handlers found in api/_handlers. Nothing was bundled.");
  process.exit(1);
}

await build({
  entryPoints,
  outdir: "api",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  loader: { ".json": "json" },
  logLevel: "warning",
});

console.log(`build-api: bundled ${entryPoints.length} functions -> api/*.js`);
