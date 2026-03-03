#!/usr/bin/env bash
set -euo pipefail

print_build_msg() {
  local project_name="$1"
  local prefix="= Building ${project_name} "
  local line="${prefix}==============================================================================="
  echo "${line:0:80}"
}

./scripts/clean.sh

print_build_msg "modules/captchaSolvers"
cd modules/captchaSolvers
npm install
npm ci
npm run build
cd ../..

print_build_msg "modules/proxy"
cd modules/proxy
npm install
npm ci
npm run build
cd ../..

print_build_msg "idealistaPropertyScraper"
cd idealistaPropertyScraper
npm install
npm ci
npm run build
cd ..

print_build_msg "propertyBackend"
cd propertyBackend
npm install
npm ci
npm run build
cd ..

print_build_msg "propertyFrontend"
cd propertyFrontend
npm install
npm ci
npm run build
cd ..

print_build_msg "pendingImageDownloader"
cd pendingImageDownloader
npm install
npm ci
npm run build
cd ..

print_build_msg "notificationMessageSender"
cd notificationMessageSender
npm install
npm ci
npm run build
cd ..
