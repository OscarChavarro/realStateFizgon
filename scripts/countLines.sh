#!/usr/bin/env bash
set -euo pipefail

./scripts/clean.sh

cloc `find . -type f | grep -v .git | grep -v package-lock | grep -v .jpg | grep -v .webp | grep -v .png | grep -v whatsapp-auth`
