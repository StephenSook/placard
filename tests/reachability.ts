/**
 * WHICH cite() CALLS ARE ACTUALLY REACHED.
 *
 * The clause-accounting gate proves every clause in the corpus is either cited
 * by a code path or declared reference-only. It greps source text, and DEAD
 * CODE IS STILL TEXT, so a clause could be quoted, verified verbatim, counted
 * in the receipt the README prints, and delivered to nobody.
 *
 * Two rounds patched that by splitting source on exported declarations and
 * dropping the uncalled ones. Round ten found the split still counted:
 *
 *   - default exports,
 *   - class methods,
 *   - object-literal methods,
 *   - private (non-exported) module helpers,
 *
 * because none of them starts with `export function` or `export const x = (`,
 * so each sat inside a retained neighbour's chunk. It also treated a bare
 * re-export (`export { foo } from "./x"`) as a caller, since the name occurs
 * a second time in the text.
 *
 * Text splitting cannot see any of that. This parses instead: a cite() call
 * counts only when EVERY named function, method or class enclosing it is
 * referenced somewhere outside its own declaration and outside an import or
 * export specifier. Nesting matters, because a reachable outer function can
 * still contain an unreachable inner one.
 */
import ts from "typescript";

export type Source = { path: string; text: string };

const parse = (s: Source) =>
  ts.createSourceFile(s.path, s.text, ts.ScriptTarget.Latest, /* setParentNodes */ true);

/** The name a node declares, when the node is something callable or a class. */
function declaredName(n: ts.Node): string | null {
  const fnLike = (x: ts.Node | undefined) =>
    !!x && (ts.isArrowFunction(x) || ts.isFunctionExpression(x));
  if (ts.isFunctionDeclaration(n) && n.name) return n.name.text;
  if (ts.isClassDeclaration(n) && n.name) return n.name.text;
  if (ts.isMethodDeclaration(n) && ts.isIdentifier(n.name)) return n.name.text;
  if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && fnLike(n.initializer)) return n.name.text;
  if (ts.isPropertyAssignment(n) && ts.isIdentifier(n.name) && fnLike(n.initializer)) return n.name.text;
  if (ts.isPropertyDeclaration(n) && ts.isIdentifier(n.name) && fnLike(n.initializer)) return n.name.text;
  return null;
}

/**
 * How often each identifier is USED, which is not how often it appears.
 * A declaration's own name is not a use, and neither is naming it in an import
 * or export list: `export { foo } from "./x"` re-exports foo without reaching it.
 */
function referenceCounts(universe: Source[]): Map<string, number> {
  const refs = new Map<string, number>();
  for (const src of universe) {
    const walk = (n: ts.Node): void => {
      if (ts.isIdentifier(n)) {
        const p = n.parent as ts.Node | undefined;
        const isOwnName = !!p && declaredName(p) === n.text && (p as { name?: ts.Node }).name === n;
        const isSpecifier =
          !!p &&
          (ts.isImportSpecifier(p) || ts.isExportSpecifier(p) ||
            ts.isImportClause(p) || ts.isNamespaceImport(p) || ts.isNamespaceExport(p));
        if (!isOwnName && !isSpecifier) refs.set(n.text, (refs.get(n.text) ?? 0) + 1);
      }
      ts.forEachChild(n, walk);
    };
    walk(parse(src));
  }
  return refs;
}

/**
 * Clause ids cited from code something reaches.
 *
 * `scanned` are the files whose citations count. `universe` is every file that
 * could contain a caller, which must be wider than `scanned` or a helper called
 * only from the UI would look dead.
 */
export function reachableCitedIds(scanned: Source[], universe: Source[]): Set<string> {
  const refs = referenceCounts(universe);
  const out = new Set<string>();
  for (const src of scanned) {
    const walk = (n: ts.Node, enclosing: readonly string[]): void => {
      const name = declaredName(n);
      const next = name ? [...enclosing, name] : enclosing;
      if (
        ts.isCallExpression(n) &&
        ts.isIdentifier(n.expression) &&
        n.expression.text === "cite" &&
        n.arguments.length > 0
      ) {
        const arg = n.arguments[0]!;
        // Every enclosing name must be reached, not merely the innermost one.
        if (ts.isStringLiteral(arg) && next.every((nm) => (refs.get(nm) ?? 0) > 0)) {
          out.add(arg.text);
        }
      }
      ts.forEachChild(n, (c) => walk(c, next));
    };
    walk(parse(src), []);
  }
  return out;
}
