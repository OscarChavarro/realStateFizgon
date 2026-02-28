#!/usr/bin/env bash
set -euo pipefail

SECRETS_FILE="${SECRETS_FILE:-/app/secrets.json}"
DISPLAY_ID="${X11VNC_DISPLAY:-:99}"
AUTH_FILE="${X11VNC_AUTH_FILE:-/tmp/xvfb/Xauthority}"
PASSWORD_FILE="${X11VNC_PASSWORD_FILE:-/app/output/.vnc/passwd}"
PORT="${X11VNC_PORT:-5900}"

if [ ! -f "$SECRETS_FILE" ]; then
  echo "ERROR: secrets file not found at $SECRETS_FILE" >&2
  exit 1
fi

X11VNC_PASSWORD="${X11VNC_PASSWORD:-}"
if [ -z "$X11VNC_PASSWORD" ]; then
  X11VNC_PASSWORD="$(node -e "const fs=require('fs');try{const s=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));const p=s?.x11vnc?.password;process.stdout.write(typeof p==='string'?p:'');}catch{process.stdout.write('');}" "$SECRETS_FILE")"
fi

if [ -z "$X11VNC_PASSWORD" ]; then
  echo "ERROR: x11vnc password is empty. Set x11vnc.password in /app/secrets.json or X11VNC_PASSWORD env var." >&2
  exit 1
fi

mkdir -p "$(dirname "$PASSWORD_FILE")"
x11vnc -storepasswd "$X11VNC_PASSWORD" "$PASSWORD_FILE" >/dev/null

exec x11vnc \
  -display "$DISPLAY_ID" \
  -auth "$AUTH_FILE" \
  -forever -loop -noxdamage -repeat \
  -rfbauth "$PASSWORD_FILE" \
  -rfbport "$PORT" -shared -cursor arrow -noshm
