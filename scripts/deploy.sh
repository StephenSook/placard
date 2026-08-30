#!/bin/zsh
# Deploy to the judged origin, with every gate on a BARE exit path.
#
# This script exists because of a specific false green. The command was
#   npm run build >/dev/null 2>&1 && npx vercel deploy --prod --yes >/tmp/vd.txt 2>&1; grep Aliased /tmp/vd.txt
# `tsc -b` failed, `&&` short-circuited the deploy, and the trailing `;` ran
# grep anyway against a /tmp file left over from the PREVIOUS deploy. It printed
# a real "Aliased:" line for a deploy that never happened, and the live site
# silently kept serving the old bundle while everything looked green.
#
# So: no pipe on any exit path, no reused scratch file, and the deployed origin
# is verified afterwards rather than the command's own output being trusted.
set -e
cd "$(dirname "$0")/.."

echo "==> typecheck, tests, build"
npx tsc --noEmit
npx vitest run --silent
npm run build

echo "==> verify:data"
npm run verify:data

OUT="$(mktemp)"
echo "==> deploy"
npx vercel deploy --prod --yes | tee "$OUT"

URL="https://segregation-console.vercel.app"
echo "==> verify the DEPLOYED origin, not the deploy command"
for p in / /judge /states /api/measure /api/forbidden-audit; do
  CODE="$(curl -s -o /dev/null -w '%{http_code}' "$URL$p")"
  [ "$CODE" = "200" ] || { echo "FAIL $p -> $CODE"; exit 1; }
  printf '  %-22s %s\n' "$p" "$CODE"
done

# A missing asset must still answer a real 404, not the app shell under 200.
CODE="$(curl -s -o /dev/null -w '%{http_code}' "$URL/assets/definitely-not-here.js")"
[ "$CODE" = "404" ] || { echo "FAIL: missing asset answered $CODE, expected 404"; exit 1; }
printf '  %-22s %s\n' "/assets/<missing>" "$CODE"

# The served bundle must be the one just built, not a cached predecessor.
LOCAL="$(basename "$(ls dist/assets/index-*.js | head -1)")"
curl -s "$URL/" > "$OUT.html"
grep -q "$LOCAL" "$OUT.html" || { echo "FAIL: origin serves a different bundle than dist/ ($LOCAL)"; exit 1; }
echo "  bundle                 $LOCAL served"

rm -f "$OUT" "$OUT.html"
echo "==> deployed and verified"
