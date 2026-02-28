#!/usr/bin/env bash
set -euo pipefail

./scripts/clean.sh

cd modules/captchaSolvers
npm install --verbose
npm run build
cd ../..

cd modules/proxy
npm install --verbose
npm run build
cd ../..

cd idealistaPropertyScraper
npm install --verbose
npm run build
cd ..

cd notificationMessageSender
npm install --verbose
npm run build
cd ..
