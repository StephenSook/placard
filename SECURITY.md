# Security policy

## Reporting

Report a vulnerability privately through GitHub Security Advisories:
https://github.com/StephenSook/hazmat-segregation-console/security/advisories/new

Please do not open a public issue for a security problem.

## What is in scope, and what the threat model actually is

This is a static single-origin site with no server, no accounts, no database and
no third-party JavaScript. The interesting surface is therefore not the usual
web one. It is the **agent tool surface**, and one property in particular:

> No shipping paper can be exported for a load that does not pass 49 CFR 177.848.

The most valuable report against this project is a way to export a shipping
paper for a failing load. The gate has three layers and only one of them is a
security boundary:

1. **Visible.** `commit_manifest` is unregistered while the load does not pass.
   This is UX. It is **not** a boundary: the WebMCP tool map is keyed by tool
   name, and a same-origin script could register over it. We say so in the
   README rather than claiming otherwise.
2. **Load-bearing.** The commit handler re-derives the verdict from a SHA-256 of
   the exact bytes it is about to export, so a stale load, a mutated load and a
   same-named shadow tool are all uncommittable regardless of registration
   order. Breaking THIS is the finding.
3. **Structural.** `script-src 'self'` with zero third-party JavaScript removes
   the precondition of the published registration-race attack.

Also in scope:

- A hash collision or canonical-encoding ambiguity that lets two distinct loads
  produce one approval token. The encoding length-prefixes every component
  specifically to avoid this.
- A quoted clause that is not a verbatim substring of the committed corpus.
  `npm run verify:data` is supposed to make this impossible; a way past it is a
  real finding.
- A regulatory conclusion that is wrong in the permissive direction, meaning the
  app clears a load the regulation forbids. Please file that as a bug with the
  clause, and it will be treated with the same seriousness as a memory-safety
  issue would be in other software.

## Out of scope

- Missing headers on preview deploys. Only the production origin is claimed.
- Anything requiring an attacker to already control script execution on the
  origin, since that assumption defeats the whole page by construction.
- The regulation being inconvenient. Take that up with PHMSA.

## Not legal advice

This project is not the official Code of Federal Regulations and is not legal
advice. The person who signs the shipper certification retains responsibility
under 49 CFR 172.204.
