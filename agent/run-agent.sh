#!/usr/bin/env bash
# Supervisor: keeps the LisDao agent running, restarts it if it exits or crashes.
# Config lives in ~/.lisdao/agent.env (AGENT_FEED_TOKEN, LLM_BASE_URL, LLM_MODEL, LLM_API_KEY, WEB_URL, ...).
cd "$(dirname "$0")"
LOG=${AGENT_LOG:-/tmp/agent.log}
PY=${AGENT_PYTHON:-/workspace/pwenv/bin/python}
while true; do
  set -a; [ -f "$HOME/.lisdao/agent.env" ] && . "$HOME/.lisdao/agent.env"; set +a
  export WEB_URL=${WEB_URL:-https://lisdao.vercel.app} PYTHONUNBUFFERED=1
  echo "$(date '+%F %T') supervisor: starting agent" >> "$LOG"
  "$PY" browser_agent.py >> "$LOG" 2>&1
  echo "$(date '+%F %T') supervisor: agent exited ($?), restarting in 2s" >> "$LOG"
  sleep 2
done
