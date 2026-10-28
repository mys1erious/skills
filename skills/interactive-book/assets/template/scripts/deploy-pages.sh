#!/bin/sh
# Builds the book and force-pushes dist/ as the only commit on the gh-pages branch of a GitHub repo; GitHub Pages
# serves that branch. Never touches any other branch. Uses the gh CLI login for this one push.
# usage: PAGES_REPO=https://github.com/<owner>/<repo>.git sh scripts/deploy-pages.sh
set -e
: "${PAGES_REPO:?set PAGES_REPO=https://github.com/<owner>/<repo>.git}"
cd "$(dirname "$0")/.."
npm run build
OUT="$(mktemp -d)"
cp -R dist/. "$OUT"
touch "$OUT/.nojekyll" # serve every file as-is, without Jekyll processing
[ -f README.pages.md ] && cp README.pages.md "$OUT/README.md" # the repo's front page on GitHub, if you wrote one
[ -f shots/spread-02.png ] && cp shots/spread-02.png "$OUT/screenshot.png" # from npm run shoot, for the README
cd "$OUT"
git init -q -b gh-pages
git add -A
git commit -q -m "Deploy the book"
git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push -q -f "$PAGES_REPO" gh-pages
cd - >/dev/null
rm -rf "$OUT"
echo "Pushed to gh-pages. If Pages is not on yet: gh api -X POST repos/<owner>/<repo>/pages -f 'source[branch]=gh-pages' -f 'source[path]=/'"
