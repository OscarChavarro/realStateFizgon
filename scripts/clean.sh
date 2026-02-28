#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "Cleaning node_modules and dist directories..."
find . -type d \( -name node_modules -o -name dist \) -prune -exec rm -rf {} +

echo "Cleaning backup files (#* and *~)..."
find . -type f \( -name '#*' -o -name '*~' \) -delete

echo "Cleaning logs..."
rm -rf idealistaPropertyScraper/output/logs/chrome_std*

echo "Clean completed."
