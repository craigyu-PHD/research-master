#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "${SCRIPT_DIR}" || exit 1

for PROFILE in "${HOME}/.zprofile" "${HOME}/.bash_profile" "${HOME}/.bashrc" "${HOME}/.profile"; do
  if [ -r "${PROFILE}" ]; then
    # Terminal 雙擊 .command 時常拿不到互動 shell 的 PATH；安靜載入常見設定檔。
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
  echo "找不到 Node.js。請先安裝 Node.js LTS：https://nodejs.org/"
  echo "目前 PATH：${PATH}"
  read -r -p "按 Enter 結束..."
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
  echo "正在啟動文獻管理代理人本機版：${URL}"
  nohup "${NODE_BIN}" server.mjs >"${LOG_FILE}" 2>&1 &
  SERVER_PID=$!
  for _ in 1 2 3 4 5 6 7 8; do
    if server_ready; then
      break
    fi
    sleep 0.5
  done
else
  echo "文獻管理代理人本機版已在執行：${URL}"
fi

if server_ready; then
  open "${URL}" >/dev/null 2>&1
  echo "已開啟 ${URL}"
  echo "Node：${NODE_BIN}"
  echo "伺服器紀錄：${LOG_FILE}"
  if [ -n "${SERVER_PID}" ]; then
    echo "本機伺服器正在執行。關閉這個 Terminal 視窗會停止本機版。"
    wait "${SERVER_PID}"
  fi
else
  echo "啟動失敗，請查看錯誤紀錄：${LOG_FILE}"
  echo "---- 最近錯誤 ----"
  tail -n 30 "${LOG_FILE}" 2>/dev/null
  read -r -p "按 Enter 結束..."
  exit 1
fi
