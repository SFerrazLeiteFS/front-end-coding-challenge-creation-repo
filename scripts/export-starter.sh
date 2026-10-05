#!/usr/bin/env bash
# Exports starter/ (as committed in HEAD) as a single commit "Initial commit"
# and pushes it to the candidate repo. Runs check-starter.sh first.
#
# Usage: scripts/export-starter.sh [--remote <url>] [--force] [--source <dir>]
#   --remote  target repository (default: the private org repo)
#   --force   overwrite a target that already has commits (history stays one commit)
#   --source  export this directory instead of starter/ from HEAD (for tests)
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/.." && pwd)"
remote="git@github.com:firestartorg/front-end-coding-challenge.git"
force=0
source=""
MESSAGE="Initial commit"
AUTHOR_NAME="FireStart"
AUTHOR_EMAIL="s.ferraz-leite@firestart.com"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --remote) remote="$2"; shift 2 ;;
    --force) force=1; shift ;;
    --source) source="$2"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

if [[ -n "$source" ]]; then
  cp -R "$source/." "$work/"
else
  git -C "$repo" archive HEAD starter | tar -x -C "$work" --strip-components=1
fi

bash "$here/check-starter.sh" "$work" --message "$MESSAGE"

if [[ -n "$(git ls-remote --heads "$remote")" && $force -ne 1 ]]; then
  echo "✗ $remote already has commits. Use --force to replace them with a single new commit." >&2
  exit 1
fi

cd "$work"
git init -q -b main
git add -A
GIT_AUTHOR_NAME="$AUTHOR_NAME" GIT_AUTHOR_EMAIL="$AUTHOR_EMAIL" \
GIT_COMMITTER_NAME="$AUTHOR_NAME" GIT_COMMITTER_EMAIL="$AUTHOR_EMAIL" \
  git -c commit.gpgsign=false commit -q -m "$MESSAGE"
if [[ $force -eq 1 ]]; then
  git push -q --force "$remote" main
else
  git push -q "$remote" main
fi
echo "Exported $(git rev-parse --short HEAD) to $remote"
