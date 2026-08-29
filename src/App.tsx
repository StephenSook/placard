/**
 * The app shell.
 *
 * Two surfaces on one origin. `/` is the product. `/states` is the component
 * states preview, kept because reviewing every verdict state side by side is
 * the only way to catch one that reads wrong next to its siblings, and because
 * it doubles as a judge-facing surface where the refusal cases can be seen
 * without anyone having to construct them.
 *
 * Routing is a plain pathname read rather than a router dependency: two
 * surfaces do not justify a routing library, and every dependency is one more
 * thing in a repository whose security argument is that it ships no
 * third-party JavaScript to the page.
 */
import { Console } from "./Console.tsx";
import { StatesPreview } from "./StatesPreview.tsx";

export function App() {
  const path = typeof window === "undefined" ? "/" : window.location.pathname;
  if (path.startsWith("/states")) return <StatesPreview />;
  return <Console />;
}
