#!/usr/bin/env bash
# Packages the candidate repo as a ZIP (folder approval-inbox/, no node_modules,
# no Git metadata). Runs check-starter.sh on the content first.
#
# Usage: scripts/package-zip.sh [--remote <url> | --from-head] [--out <file.zip>]
#   --remote     clone the exported repo (default: the private org repo)
#   --from-head  use starter/ as committed in HEAD of this repo, without exporting
#   --out        output file (default: dist/approval-inbox.zip)
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/.." && pwd)"
remote="git@github.com:firestartorg/front-end-coding-challenge.git"
from_head=0
out="$repo/dist/approval-inbox.zip"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --remote) remote="$2"; shift 2 ;;
    --from-head) from_head=1; shift ;;
    --out) out="$2"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
target="$work/approval-inbox"

if [[ $from_head -eq 1 ]]; then
  mkdir -p "$target"
  git -C "$repo" archive HEAD starter | tar -x -C "$target" --strip-components=1
else
  git clone -q --depth 1 "$remote" "$target"
  rm -rf "$target/.git"
fi

bash "$here/check-starter.sh" "$target"

mkdir -p "$(dirname "$out")"
rm -f "$out"
out="$(cd "$(dirname "$out")" && pwd)/$(basename "$out")"
(cd "$work" && zip -qr "$out" approval-inbox -x '*/node_modules/*' '*/.next/*' '*.DS_Store')
echo "Wrote $out"
