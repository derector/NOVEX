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

CACHE="$HOME/.cache/motion-director"
mkdir -p "$CACHE"
if [ ! -f "$CACHE/package.json" ] || ! node -e "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'))" "$CACHE/package.json" >/dev/null 2>&1; then
  printf '{"name":"motion-director-cache","private":true}\n' > "$CACHE/package.json"
fi
timeout 300s npm install --prefix "$CACHE" --no-audit --no-fund playwright gsap ffmpeg-static ffprobe-static
ln -sf "$(node -p "require('$CACHE/node_modules/ffmpeg-static')")" "$CACHE/node_modules/.bin/ffmpeg"
ln -sf "$(node -p "require('$CACHE/node_modules/ffprobe-static').path")" "$CACHE/node_modules/.bin/ffprobe"
export PATH="$CACHE/node_modules/.bin:$PATH"

if ! command -v pip3 >/dev/null 2>&1; then
  sudo timeout 180s apt-get update -o Acquire::Retries=2 -o Acquire::http::Timeout=30
  sudo timeout 300s apt-get install -y python3-pip
fi
if ! python3 -c 'import numpy, cv2' >/dev/null 2>&1; then
  timeout 300s python3 -m pip install numpy opencv-python-headless
fi

timeout 300s "$CACHE/node_modules/.bin/playwright" install chromium

node scripts/extract-motion-engine.mjs
python3 -c "import numpy, cv2; print(\"Python OK: numpy \" + numpy.__version__ + \", OpenCV \" + cv2.__version__)"
DOCTOR_OUTPUT="$(node "$CACHE/tool/mo.cjs" doctor --selftest 2>&1)" || DOCTOR_STATUS=$?
printf "%s\n" "$DOCTOR_OUTPUT"
if [ "${DOCTOR_STATUS:-0}" -ne 0 ] || ! grep -q "САМОТЕСТ: пройден" <<< "$DOCTOR_OUTPUT" || grep -q "НЕТ" <<< "$DOCTOR_OUTPUT"; then
  echo "ОШИБКА: самотест не прошёл или doctor сообщил НЕТ."
  exit 1
fi
