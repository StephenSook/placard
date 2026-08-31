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

type Graph = {
  /** Names referenced from module level, which runs on import. */
  roots: Set<string>;
  /** Declared node to the nodes its body references. */
  edges: Map<string, Set<string>>;
};

/** A member whose key cannot be read statically. Nothing can reference it. */
const UNRESOLVED = "<computed>";

const fnLike = (x: ts.Node | undefined): boolean =>
  !!x && (ts.isArrowFunction(x) || ts.isFunctionExpression(x));

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

/** The member key as written, or UNRESOLVED when it cannot be read statically. */
function memberKey(name: ts.PropertyName | undefined): string {
  if (!name) return UNRESOLVED;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return UNRESOLVED;
}

const qualify = (container: string | null, key: string) => (container ? `${container}.${key}` : key);

/**
 * The node a declaration introduces, or null when the node introduces no scope.
 *
 * An ANONYMOUS INLINE function returns null on purpose so its citations inherit
 * the enclosing scope: a callback passed to map is reached when its caller is,
 * and treating it as unknown would fail the build on live code.
 */
function declaredNode(n: ts.Node, container: string | null): string | null {
  if (ts.isClassDeclaration(n) && n.name) return n.name.text;
  if (ts.isMethodDeclaration(n) || ts.isGetAccessorDeclaration(n) || ts.isSetAccessorDeclaration(n)) {
    return qualify(container, memberKey(n.name));
  }
  if (ts.isClassStaticBlockDeclaration(n)) return qualify(container, "<static>");
  if (ts.isPropertyDeclaration(n) && (fnLike(n.initializer) || n.initializer)) {
    return qualify(container, memberKey(n.name));
  }
  if (ts.isPropertyAssignment(n) && fnLike(n.initializer)) return qualify(container, memberKey(n.name));
  if (ts.isShorthandPropertyAssignment(n)) return null;
  if (ts.isFunctionDeclaration(n) && n.name) return qualify(container, n.name.text);
  if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && fnLike(n.initializer)) {
    return qualify(container, n.name.text);
  }
  // `bag.dead = function () { ... }` names the function after the property it
  // is assigned to, so it cannot fall out to module scope.
  if (fnLike(n)) {
    const p = n.parent;
    if (p && ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        p.right === n && ts.isPropertyAccessExpression(p.left) &&
        ts.isIdentifier(p.left.expression)) {
      return `${p.left.expression.text}.${p.left.name.text}`;
    }
  }
  return null;
}

/** The container a node opens for its members, if any. */
function openedContainer(n: ts.Node, current: string | null): string | null {
  if (ts.isClassDeclaration(n) && n.name) return n.name.text;
  if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer &&
      (ts.isObjectLiteralExpression(n.initializer) || ts.isClassExpression(n.initializer))) {
    return n.name.text;
  }
  if (ts.isExportAssignment(n) && !n.isExportEquals) return "<default>";
  return current;
}

/** Is this identifier the NAME a declaration introduces, rather than a use? */
function isDeclarationName(n: ts.Identifier, p: ts.Node | undefined): boolean {
  if (!p) return false;
  const named =
    ts.isVariableDeclaration(p) || ts.isFunctionDeclaration(p) || ts.isClassDeclaration(p) ||
    ts.isMethodDeclaration(p) || ts.isPropertyAssignment(p) || ts.isPropertyDeclaration(p) ||
    ts.isParameter(p) || ts.isBindingElement(p) || ts.isEnumDeclaration(p) ||
    ts.isInterfaceDeclaration(p) || ts.isTypeAliasDeclaration(p) || ts.isGetAccessorDeclaration(p) ||
    ts.isSetAccessorDeclaration(p) || ts.isFunctionExpression(p) || ts.isClassExpression(p) ||
    ts.isEnumMember(p) || ts.isTypeParameterDeclaration(p) || ts.isModuleDeclaration(p);
  return named && (p as { name?: ts.Node }).name === n;
}

function buildGraph(universe: Source[]): Graph {
  const roots = new Set<string>();
  const edges = new Map<string, Set<string>>();
  const record = (from: string | undefined, to: string) => {
    if (from === undefined) { roots.add(to); return; }
    let set = edges.get(from);
    if (!set) edges.set(from, (set = new Set()));
    set.add(to);
  };
  for (const src of universe) {
    const sf = parse(src);
    const alias = aliasMap(sf);
    const walk = (n: ts.Node, enclosing: readonly string[], container: string | null): void => {
      const name = declaredNode(n, container);
      const next = name ? [...enclosing, name] : enclosing;
      const nextContainer = openedContainer(n, container);
      const here = enclosing[enclosing.length - 1];

      // Static initialisers and static blocks RUN when the module is imported,
      // whether or not the class is ever referenced.
      if (((ts.isPropertyDeclaration(n) && ts.canHaveModifiers(n) &&
            ts.getModifiers(n)?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword)) ||
           ts.isClassStaticBlockDeclaration(n)) && name) {
        roots.add(name);
        // The class binding is evaluated too, so do not require a reference to it.
        if (container) roots.add(container);
      }
      // `export default { ... }` can be imported under any local name, so its
      // members are rooted rather than resolved.
      if (ts.isExportAssignment(n) && !n.isExportEquals) {
        const e = n.expression;
        if (ts.isObjectLiteralExpression(e)) {
          for (const m of e.properties) roots.add(qualify("<default>", memberKey(m.name)));
        } else if (ts.isIdentifier(e)) roots.add(e.text);
        else if ((ts.isFunctionExpression(e) || ts.isClassExpression(e)) && e.name) roots.add(e.name.text);
      }
      if (ts.canHaveModifiers(n) && ts.getModifiers(n)?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) {
        const dn = declaredNode(n, null);
        if (dn) roots.add(dn);
      }

      // `bag.used()` reaches the OBJECT and that ONE member, never its siblings.
      // The TARGET of an assignment is a write, not a use: `bag.dead = fn` must
      // not root bag.dead, or the function it installs is live by definition.
      const isAssignTarget = !!n.parent && ts.isBinaryExpression(n.parent) &&
        n.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken && n.parent.left === n;
      if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression) && !isAssignTarget) {
        const obj = alias.get(n.expression.text) ?? n.expression.text;
        record(here, obj);
        record(here, `${obj}.${n.name.text}`);
      }

      if (ts.isIdentifier(n)) {
        const p = n.parent as ts.Node | undefined;
        const isSpecifier = !!p &&
          (ts.isImportSpecifier(p) || ts.isExportSpecifier(p) ||
            ts.isImportClause(p) || ts.isNamespaceImport(p) || ts.isNamespaceExport(p));
        const isMemberName = !!p && (ts.isPropertyAccessExpression(p) || ts.isQualifiedName(p)) &&
          (p as { name?: ts.Node }).name === n;
        if (!isDeclarationName(n, p) && !isSpecifier && !isMemberName) {
          record(here, alias.get(n.text) ?? n.text);
        }
      }
      ts.forEachChild(n, (c) => walk(c, next, nextContainer));
    };
    walk(sf, [], null);
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
    const walk = (n: ts.Node, enclosing: readonly string[], container: string | null): void => {
      const name = declaredNode(n, container);
      const next = name ? [...enclosing, name] : enclosing;
      const nextContainer = openedContainer(n, container);
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) &&
          n.expression.text === "cite" && n.arguments.length > 0) {
        const arg = n.arguments[0]!;
        if (ts.isStringLiteral(arg) && next.every((nm) => live.has(nm))) out.add(arg.text);
      }
      ts.forEachChild(n, (c) => walk(c, next, nextContainer));
    };
    walk(parse(src), [], null);
  }
  return out;
}
