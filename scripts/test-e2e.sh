#!/usr/bin/env bash

set -euo pipefail

if [[ -n "${CI:-}" ]]; then
  exec playwright test "$@"
fi

proxy_name="quicksilver-portless-proxy"
app_name="quicksilver-e2e"
branch_name="$(git branch --show-current)"
branch_name="$(printf '%s' "$branch_name" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9-' '-')"
process_name="${app_name}-${branch_name:-detached}"

if ! bgproc status -n "$proxy_name" >/dev/null 2>&1; then
  bgproc start -n "$proxy_name" -w 30 -- \
    ./node_modules/.bin/portless proxy start --no-tls --port 1355 --foreground
fi

cleanup() {
  bgproc stop -n "$process_name" >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM

bgproc start -n "$process_name" -w 30 -- \
  ./node_modules/.bin/portless run --name "$app_name" npm run dev

base_url="$(./node_modules/.bin/portless get "$app_name")/quicksilver/"
PLAYWRIGHT_BASE_URL="$base_url" playwright test "$@"
