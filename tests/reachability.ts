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
 * THE CALL GRAPH, AND WHY A REFERENCE COUNT WAS NOT ONE.
 *
 * Counting how often a name appears outside its own declaration is not
 * reachability, and round eleven showed both directions of the error:
 *
 *   function dead()   { return helper(); }
 *   function helper() { return cite("e2-X"); }
 *
 * counted `helper` as used, so a citation inside a chain nothing calls read as
 * reachable. A self-recursive dead function did the same, referencing itself.
 * And in the other direction, `import { original as alias }` then `alias()`
 * left `original` with no references at all, so a LIVE citation read as dead
 * and would have failed the build for the wrong reason.
 *
 * So this builds edges instead. A reference recorded inside a named
 * declaration is an edge from that declaration to the name; a reference
 * recorded outside every named declaration is a ROOT, because module-level code
 * runs when the module is imported. Reachable is the closure of the roots.
 *
 * WHAT THIS STILL DOES NOT DO, stated rather than implied: it matches on
 * identifier TEXT, not resolved symbols, so two modules that both declare a
 * private helper of the same name share a node, which can only ever make the
 * analysis more permissive. A symbol-resolved graph from the TypeScript
 * TypeChecker would remove that. The gate is a backstop for a clause quoted and
 * never applied, and it fails the build when a clause is unaccounted, so a
 * false DEAD would be loud and a false LIVE is the residual risk.
 */
type Graph = {
  /** Names referenced from module level, which runs on import. */
  roots: Set<string>;
  /** Declared name to the names its body references. */
  edges: Map<string, Set<string>>;
};

/** `import { original as alias }` means a use of alias is a use of original. */
function aliasMap(sf: ts.SourceFile): Map<string, string> {
  const m = new Map<string, string>();
  const walk = (n: ts.Node): void => {
    if (ts.isImportSpecifier(n) && n.propertyName) m.set(n.name.text, n.propertyName.text);
    ts.forEachChild(n, walk);
  };
  walk(sf);
  return m;
}

function buildGraph(universe: Source[]): Graph {
  const roots = new Set<string>();
  const edges = new Map<string, Set<string>>();
  const edge = (from: string, to: string) => {
    let set = edges.get(from);
    if (!set) edges.set(from, (set = new Set()));
    set.add(to);
  };
  for (const src of universe) {
    const sf = parse(src);
    const alias = aliasMap(sf);
    const walk = (n: ts.Node, stack: readonly string[]): void => {
      const name = declaredName(n);
      const next = name ? [...stack, name] : stack;
      if (ts.isIdentifier(n)) {
        const p = n.parent as ts.Node | undefined;
        const isOwnName = !!p && declaredName(p) === n.text && (p as { name?: ts.Node }).name === n;
        const isSpecifier =
          !!p &&
          (ts.isImportSpecifier(p) || ts.isExportSpecifier(p) ||
            ts.isImportClause(p) || ts.isNamespaceImport(p) || ts.isNamespaceExport(p));
        if (!isOwnName && !isSpecifier) {
          for (const t of new Set([n.text, alias.get(n.text) ?? n.text])) {
            const inside = stack[stack.length - 1];
            if (inside === undefined) roots.add(t);
            else edge(inside, t);
          }
        }
      }
      ts.forEachChild(n, (c) => walk(c, next));
    };
    walk(sf, []);
  }
  return { roots, edges };
}

/** Everything the module-level code can eventually reach. */
function closure(g: Graph): Set<string> {
  const seen = new Set<string>();
  const stack = [...g.roots];
  while (stack.length > 0) {
    const name = stack.pop()!;
    if (seen.has(name)) continue;
    seen.add(name);
    for (const next of g.edges.get(name) ?? []) if (!seen.has(next)) stack.push(next);
  }
  return seen;
}

/**
 * Clause ids cited from code something reaches.
 *
 * `scanned` are the files whose citations count. `universe` is every file that
 * could contain a caller, which must be wider than `scanned` or a helper called
 * only from the UI would look dead.
 */
export function reachableCitedIds(scanned: Source[], universe: Source[]): Set<string> {
  const live = closure(buildGraph(universe));
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
        if (ts.isStringLiteral(arg) && next.every((nm) => live.has(nm))) out.add(arg.text);
      }
      ts.forEachChild(n, (c) => walk(c, next));
    };
    walk(parse(src), []);
  }
  return out;
}
