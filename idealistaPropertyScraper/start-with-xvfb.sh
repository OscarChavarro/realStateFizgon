#!/bin/sh
set -eu

# Configure display/session defaults for the virtual X11 environment.
DISPLAY_NUM="${DISPLAY_NUM:-99}"
XVFB_SCREEN="${XVFB_SCREEN:-1920x1080x24}"
XAUTHORITY_FILE="${XAUTHORITY_FILE:-/tmp/xvfb/Xauthority}"

export DISPLAY=":${DISPLAY_NUM}"
export XAUTHORITY="${XAUTHORITY_FILE}"

# Prepare runtime folders and Xauthority file used by Xvfb clients.
mkdir -p /app/output/logs
mkdir -p "$(dirname "${XAUTHORITY_FILE}")"
touch "${XAUTHORITY_FILE}"
chmod 600 "${XAUTHORITY_FILE}"

# Generate an X11 cookie when xauth is available.
if command -v xauth >/dev/null 2>&1; then
  COOKIE="$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')"
  xauth -f "${XAUTHORITY_FILE}" add "${DISPLAY}" . "${COOKIE}"
else
  echo "xauth is not available. Xauthority cookie was not generated."
fi

# Start virtual framebuffer server for the desktop session.
Xvfb "${DISPLAY}" -screen 0 "${XVFB_SCREEN}" -auth "${XAUTHORITY_FILE}" > /app/output/logs/xvfb.log 2>&1 &
XVFB_PID=$!

sleep 1
if ! kill -0 "${XVFB_PID}" 2>/dev/null; then
  echo "Xvfb failed to start. Check /app/output/logs/xvfb.log"
  exit 1
fi

# Start a D-Bus session bus manually (there is no systemd in this container).
if command -v dbus-launch >/dev/null 2>&1; then
  # dbus-launch exports DBUS_SESSION_BUS_ADDRESS and DBUS_SESSION_BUS_PID.
  eval "$(dbus-launch --sh-syntax)"
else
  echo "dbus-launch is not available. Continuing without a D-Bus session bus."
fi

# Start Motif window manager when installed.
MWM_PID=""
if command -v mwm >/dev/null 2>&1; then
  mwm > /app/output/logs/mwm.log 2>&1 &
  MWM_PID=$!
else
  echo "mwm binary is not available. Continuing without window manager."
fi

# Cleanup all background services when the container stops.
cleanup() {
  if [ -n "${NODE_PID:-}" ] && kill -0 "${NODE_PID}" 2>/dev/null; then
    kill "${NODE_PID}" 2>/dev/null || true
  fi
  if [ -n "${MWM_PID}" ] && kill -0 "${MWM_PID}" 2>/dev/null; then
    kill "${MWM_PID}" 2>/dev/null || true
  fi
  if [ -n "${DBUS_SESSION_BUS_PID:-}" ] && kill -0 "${DBUS_SESSION_BUS_PID}" 2>/dev/null; then
    kill "${DBUS_SESSION_BUS_PID}" 2>/dev/null || true
  fi
  if kill -0 "${XVFB_PID}" 2>/dev/null; then
    kill "${XVFB_PID}" 2>/dev/null || true
  fi
}

trap cleanup INT TERM EXIT

# Start the NestJS service as the main process for this session.
node -r /app/scripts/runtime/register-src-dist.cjs dist/main.js &
NODE_PID=$!
wait "${NODE_PID}"
