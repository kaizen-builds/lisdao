#!/usr/bin/env bash
# Optional: pre-download the English OCR model that tesseract.js (agent/ocr.js) uses.
# tesseract.js caches it as ./eng.traineddata in the agent directory; without this
# script it is downloaded automatically on the first OCR call.
set -euo pipefail
cd "$(dirname "$0")"
[ -s eng.traineddata ] && { echo "eng.traineddata already present"; exit 0; }
curl -fsSL https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz | gunzip > eng.traineddata
echo "saved $(pwd)/eng.traineddata"
