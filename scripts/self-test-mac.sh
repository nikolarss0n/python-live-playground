#!/usr/bin/env bash
# Runs the built app's --self-test frontmost (through `open`) and fails unless it prints SELF-TEST: PASS.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$ROOT/build/mac/Python Live Playground.app"
OUT="$(mktemp -t playground-self-test)"
open -n -W --stdout "$OUT" --stderr "$OUT" "$APP" --args --self-test
cat "$OUT"
grep -q "SELF-TEST: PASS" "$OUT"
