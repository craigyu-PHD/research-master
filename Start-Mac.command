#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "${SCRIPT_DIR}" || exit 1

for PROFILE in "${HOME}/.zprofile" "${HOME}/.bash_profile" "${HOME}/.bashrc" "${HOME}/.profile"; do
  if [ -r "${PROFILE}" ]; then
    # Double-clicked .command files often do not inherit the interactive shell PATH.
    # shellcheck disable=SC1090
    . "${PROFILE}" >/dev/null 2>&1
  fi
done

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

NODE_BIN="$(command -v node || true)"
if [ -z "${NODE_BIN}" ]; then
  for CANDIDATE in /opt/homebrew/bin/node /usr/local/bin/node /usr/bin/node; do
    if [ -x "${CANDIDATE}" ]; then
      NODE_BIN="${CANDIDATE}"
      break
    fi
  done
fi

if [ -z "${NODE_BIN}" ]; then
  echo "Node.js was not found. Please install Node.js LTS first: https://nodejs.org/"
  echo "Current PATH: ${PATH}"
  read -r -p "Press Enter to exit..."
  exit 1
fi

PORT="${PORT:-4173}"
URL="http://localhost:${PORT}/"
LOG_FILE="/tmp/research-master-local.log"
SERVER_PID=""

server_ready() {
  curl -fsS --max-time 2 "${URL}" >/dev/null 2>&1
}

if ! server_ready; then
  echo "Starting Research Master local server at ${URL}"
  nohup "${NODE_BIN}" server.mjs >"${LOG_FILE}" 2>&1 &
  SERVER_PID=$!
  for _ in 1 2 3 4 5 6 7 8; do
    if server_ready; then
      break
    fi
    sleep 0.5
  done
else
  echo "Research Master local server is already running at ${URL}"
fi

if server_ready; then
  open "${URL}" >/dev/null 2>&1
  echo "Opened ${URL}"
  echo "Node: ${NODE_BIN}"
  echo "Server log: ${LOG_FILE}"
  if [ -n "${SERVER_PID}" ]; then
    echo "The local server is running. Closing this Terminal window will stop the local app."
    wait "${SERVER_PID}"
  fi
else
  echo "Startup failed. Please check the error log: ${LOG_FILE}"
  echo "---- Recent error ----"
  tail -n 30 "${LOG_FILE}" 2>/dev/null
  read -r -p "Press Enter to exit..."
  exit 1
fi
