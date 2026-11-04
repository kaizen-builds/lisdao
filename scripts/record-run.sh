#!/usr/bin/env bash
# Record the agent's browser during a DRY RUN against the demo charity page.
# Nothing moves on-chain: DRY_RUN=1 means no feed posts, no heartbeat, no report_payout.
#
#   scripts/record-run.sh                       # uses http://localhost:3000/demo-charity, scripted planner
#   WEB_URL=http://localhost:3100 scripts/record-run.sh
#   HEADLESS=0 scripts/record-run.sh            # show the real window too (needs a display)
#
# Output: a .webm video of the agent's browser tab in $RECORD_DIR (default /workspace/recordings)
# and one PNG per highlighted step in $SHOT_DIR. The video only shows the charity origin
# (all other requests are blocked) plus LisDao's own overlay; no keys or env values are rendered.
# The LLM is used only if LLM_PROVIDER/keys are set in your shell; leave them unset for a free scripted run.
set -euo pipefail
cd "$(dirname "$0")/.."
WEB_URL="${WEB_URL:-http://localhost:3000}"
export RECORD=1 DRY_RUN=1
export RECORD_DIR="${RECORD_DIR:-/workspace/recordings}"
export SHOT_DIR="${SHOT_DIR:-$RECORD_DIR/steps-$(date +%Y%m%d-%H%M%S)}"
export CHARITY_URL="${CHARITY_URL:-$WEB_URL/demo-charity}"
export DRY_GOAL="${DRY_GOAL:-Donate 0.1 NEAR to the water project}"
mkdir -p "$RECORD_DIR" "$SHOT_DIR"
python3 agent/browser_agent.py --dry-run | tee "$SHOT_DIR/run.log"
echo "Step screenshots: $SHOT_DIR"
