#!/usr/bin/env bash
set -euo pipefail

./scripts/clean.sh

wc -l `find . -type f | grep -v .git | grep -v package-lock | grep -v .jpg | grep -v .webp` | sort -n
