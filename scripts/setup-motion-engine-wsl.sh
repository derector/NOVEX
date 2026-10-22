#!/usr/bin/env bash
set -euo pipefail

# Run from the NOVEX repository root inside Ubuntu/WSL.
if ! command -v node >/dev/null 2>&1; then
  echo "ОШИБКА: сначала установи Node.js 22 или LTS."
  exit 1
fi
NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "ОШИБКА: нужен Node.js 22 или новее; сейчас $(node --version)."
  exit 1
fi

sudo apt-get update
sudo apt-get install -y ffmpeg python3-pip
python3 -m pip install --break-system-packages numpy opencv-python-headless

CACHE="$HOME/.cache/motion-director"
mkdir -p "$CACHE"
if [ ! -f "$CACHE/package.json" ]; then
  printf '{"name":"motion-director-cache","private":true}\n' > "$CACHE/package.json"
fi
npm install --prefix "$CACHE" --no-audit --no-fund playwright gsap
"$CACHE/node_modules/.bin/playwright" install --with-deps chromium

node scripts/extract-motion-engine.mjs
node "$CACHE/tool/mo.cjs" doctor --selftest
