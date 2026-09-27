#!/bin/bash
# Finance Suite build: assembles index.html from _build chunks + real-data.json.
# Usage: bash build.sh   (run from the _build directory)
set -e
cd "$(dirname "$0")"

# 1. syntax-check every JS chunk first
for f in 00-core.js 01-overview.js 02-research.js 03-analysis.js 04-planning.js 05-lab.js 06-deepdive.js 07-lw.js 08-ux.js 09-quant.js 10-discovery.js 11-terminal.js 12-research.js 99-boot.js; do
  [ -f "$f" ] || continue
  node --check "$f" || { echo "SYNTAX FAIL: $f"; exit 1; }
done
echo "syntax OK"

# 2. assemble
{
  printf '%b' '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>Finance Suite</title>\n<meta name="description" content="Finance Suite — a free, private, all-in-one stock research toolkit: market scanner with seasonality and analyst data, gamma exposure (GEX) analytics, options lab, wheel tracker, portfolio lab, and more. No account, no backend.">\n<meta name="theme-color" content="#0d1117">\n<meta property="og:title" content="Finance Suite">\n<meta property="og:description" content="Free all-in-one stock research toolkit: scanner, seasonality, gamma exposure, options lab. No account, no backend — your data stays in your browser.">\n<meta property="og:type" content="website">\n<link rel="manifest" href="manifest.json">\n<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📈</text></svg>">\n<style>\n'
  cat 00-style.css
  printf '\n</style>\n</head>\n<body>\n'
  # body skeleton (incl. logo bytes) + LOGO_URI pass through from the shipped file
  python3 - <<'PY'
import re
html = open('../index.html').read()
start = html.index('<div id="app">')
end = html.index('<script>', start)
print(html[start:end].rstrip())
PY
  printf '\n<script>\nwindow.REALDATA = '
  # real-data.json: prefer the repo-local copy, fall back to the original absolute path
  RD="../build-data/real-data.json"
  [ -f "$RD" ] || RD="/home/hatch/workspace/build-data/real-data.json"
  python3 -c "import json,sys; sys.stdout.write(json.dumps(json.load(open('$RD')), separators=(',',':')))"
  printf ';\n'
  python3 - <<'PY'
import re
html = open('../index.html').read()
m = re.search(r'window\.LOGO_URI = ".*?";', html)
print(m.group(0) if m else 'window.LOGO_URI="";')
PY
  printf '</script>\n'
  if [ -f data/discovery.js ]; then
    printf '<script>\n'
    cat data/discovery.js
    printf '\n</script>\n'
  fi
  printf '<script>\n'
  for f in 00-core.js 01-overview.js 02-research.js 03-analysis.js 04-planning.js 05-lab.js 06-deepdive.js 07-lw.js 08-ux.js 09-quant.js 10-discovery.js 11-terminal.js 12-research.js 99-boot.js; do
    [ -f "$f" ] || continue
    printf '/* ===== chunk: %s ===== */\n' "$f"
    cat "$f"
    printf '\n'
  done
  printf '</script>\n</body>\n</html>\n'
} > ../index.html.new
mv ../index.html.new ../index.html
echo "built: $(wc -c < ../index.html) bytes -> ../index.html"
