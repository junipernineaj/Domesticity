#!/usr/bin/env bash
# Installs or updates Domesticity web on the server. Safe to run again.
#
#   sudo ./install.sh /path/to/domesticity/web
#
# Copies the app to /opt/domesticity/web, runs the tests there, installs the systemd
# unit, and restarts the service. It does not touch Cloudflare, cloudflared, or any
# other service on the host.
set -euo pipefail

SRC="${1:?usage: sudo ./install.sh /path/to/domesticity/web}"
APP_DIR=/opt/domesticity
PORT=8095

if [[ $EUID -ne 0 ]]; then
  echo "Run with sudo." >&2
  exit 1
fi
if [[ ! -f "$SRC/server.js" || ! -f "$SRC/deploy/domesticity-web.service" ]]; then
  echo "$SRC does not look like the web/ folder (server.js or deploy/ missing)." >&2
  exit 1
fi

if ! command -v node >/dev/null; then
  echo "Node.js is not installed. Install Node 22 or later first." >&2
  exit 1
fi
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
if (( NODE_MAJOR < 22 )); then
  echo "Node $NODE_MAJOR found; Node 22 or later is required." >&2
  exit 1
fi

# Refuse to take over a port something else is already using.
if ss -ltn "sport = :$PORT" | grep -q LISTEN && ! systemctl is-active --quiet domesticity-web; then
  echo "Port $PORT is already in use by another service. Change PORT in the unit and cloudflared config." >&2
  exit 1
fi

if ! id -u domesticity >/dev/null 2>&1; then
  useradd --system --home-dir "$APP_DIR" --shell /usr/sbin/nologin domesticity
fi

install -d -o root -g root -m 0755 "$APP_DIR"
if ! command -v rsync >/dev/null; then
  apt-get install -y rsync
fi
rsync -a --delete --exclude node_modules "$SRC"/ "$APP_DIR/web/"
chown -R root:root "$APP_DIR/web"
chmod -R a+rX "$APP_DIR/web"

echo "Running tests on the installed copy..."
(cd "$APP_DIR/web" && node --test test/*.test.js >/tmp/domesticity-test.log 2>&1) || {
  echo "Tests failed; not deploying. See /tmp/domesticity-test.log" >&2
  exit 1
}
rm -f /tmp/domesticity-test.log

install -m 0644 "$APP_DIR/web/deploy/domesticity-web.service" /etc/systemd/system/domesticity-web.service
systemctl daemon-reload
systemctl enable domesticity-web >/dev/null
systemctl restart domesticity-web

sleep 1
if curl -fsS "http://127.0.0.1:$PORT/" >/dev/null; then
  echo "Domesticity web is up on 127.0.0.1:$PORT."
else
  echo "Service started but http://127.0.0.1:$PORT/ did not respond. Check: journalctl -u domesticity-web -n 50" >&2
  exit 1
fi
