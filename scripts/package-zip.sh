#!/usr/bin/env bash
# Packages the candidate repo as a ZIP (folder approval-inbox/, no node_modules,
# no Git metadata). Runs the check on the content first.
#
# Usage: scripts/package-zip.sh [--remote <url> | --from-ref <ref>] [--out <file.zip>]
#   --remote    clone the exported repo (default: the private org repo)
#   --from-ref  use starter/ as committed on this ref of this repo (e.g. main), without exporting
#   --out       output file (default: dist/approval-inbox.zip)
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/.." && pwd)"
source "$here/lib.sh"

remote="$DEFAULT_REMOTE"
ref=""
out="$repo/dist/approval-inbox.zip"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --remote) remote="$(need_value "$@")"; shift 2 ;;
    --from-ref) ref="$(need_value "$@")"; shift 2 ;;
    --out) out="$(need_value "$@")"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
command -v zip >/dev/null || { echo "zip is not installed" >&2; exit 2; }

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
target="$work/approval-inbox"

if [[ -n "$ref" ]]; then
  extract_starter "$repo" "$ref" "$target"
else
  git clone -q "$remote" "$target"
  rm -rf "$target/.git"
fi

node "$here/check-starter.mjs" "$target"

mkdir -p "$(dirname "$out")"
out="$(cd "$(dirname "$out")" && pwd)/$(basename "$out")"
rm -f "$out"
(cd "$work" && zip -qr "$out" approval-inbox -x '*/node_modules/*' '*/.next/*' '*.DS_Store')
echo "Wrote $out"
