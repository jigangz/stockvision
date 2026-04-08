#!/bin/bash
# Ralph Stop Hook - Same-session verification
# Runs between iterations to verify work and decide whether to continue

set -euo pipefail

STATE_FILE=".claude/ralph-loop.local.md"

# Only run if Ralph loop is active
if [ ! -f "$STATE_FILE" ]; then
  exit 0
fi

# Run verification
VERIFY_OUTPUT=$(npm run typecheck && cd python && pytest ../tests/python/ -v && cd .. 2>&1) || true
VERIFY_EXIT=$?

# Check for completion promise in transcript
TRANSCRIPT=$(cat /dev/stdin 2>/dev/null || echo "")
if echo "$TRANSCRIPT" | grep -q "<promise>COMPLETE</promise>"; then
  echo '{"decision": "stop", "reason": "Completion promise detected"}'
  rm -f "$STATE_FILE"
  exit 0
fi

# Read iteration count
ITERATION=$(grep "^iteration:" "$STATE_FILE" | cut -d: -f2 | tr -d ' ')
MAX_ITER=$(grep "^max_iterations:" "$STATE_FILE" | cut -d: -f2 | tr -d ' ')

ITERATION=$((ITERATION + 1))

if [ "$ITERATION" -ge "$MAX_ITER" ]; then
  echo '{"decision": "stop", "reason": "Max iterations reached"}'
  rm -f "$STATE_FILE"
  exit 0
fi

# Update iteration count
sed -i "s/^iteration: .*/iteration: $ITERATION/" "$STATE_FILE"

# Continue with verification results
if [ $VERIFY_EXIT -eq 0 ]; then
  echo "{\"decision\": \"continue\", \"reason\": \"Verification passed, iteration $ITERATION/$MAX_ITER\"}"
else
  echo "{\"decision\": \"continue\", \"reason\": \"Verification failed, iteration $ITERATION/$MAX_ITER. Fix issues.\"}"
fi
