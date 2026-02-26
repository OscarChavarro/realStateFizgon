#!/bin/sh
set -eu

DISPLAY_NUM="${DISPLAY_NUM:-99}"
XVFB_SCREEN="${XVFB_SCREEN:-1920x1080x24}"
XAUTHORITY_FILE="${XAUTHORITY_FILE:-/tmp/xvfb/Xauthority}"

export DISPLAY=":${DISPLAY_NUM}"
export XAUTHORITY="${XAUTHORITY_FILE}"

mkdir -p /app/output/logs
mkdir -p "$(dirname "${XAUTHORITY_FILE}")"
touch "${XAUTHORITY_FILE}"
chmod 600 "${XAUTHORITY_FILE}"

if command -v xauth >/dev/null 2>&1; then
  COOKIE="$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')"
  xauth -f "${XAUTHORITY_FILE}" add "${DISPLAY}" . "${COOKIE}"
else
  echo "xauth is not available. Xauthority cookie was not generated."
fi

Xvfb "${DISPLAY}" -screen 0 "${XVFB_SCREEN}" -auth "${XAUTHORITY_FILE}" > /app/output/logs/xvfb.log 2>&1 &
XVFB_PID=$!

sleep 1
if ! kill -0 "${XVFB_PID}" 2>/dev/null; then
  echo "Xvfb failed to start. Check /app/output/logs/xvfb.log"
  exit 1
fi

MWM_PID=""
if command -v mwm >/dev/null 2>&1; then
  mwm > /app/output/logs/mwm.log 2>&1 &
  MWM_PID=$!
else
  echo "mwm binary is not available. Continuing without window manager."
fi

cleanup() {
  if [ -n "${NODE_PID:-}" ] && kill -0 "${NODE_PID}" 2>/dev/null; then
    kill "${NODE_PID}" 2>/dev/null || true
  fi
  if [ -n "${MWM_PID}" ] && kill -0 "${MWM_PID}" 2>/dev/null; then
    kill "${MWM_PID}" 2>/dev/null || true
  fi
  if kill -0 "${XVFB_PID}" 2>/dev/null; then
    kill "${XVFB_PID}" 2>/dev/null || true
  fi
}

trap cleanup INT TERM EXIT

node dist/main.js &
NODE_PID=$!
wait "${NODE_PID}"
