#!/usr/bin/env bash
# Exports starter/ (as committed on main) as a single commit "Initial commit"
# and pushes it to the candidate repo. Runs the check first.
#
# Usage: scripts/export-starter.sh [--remote <url>] [--ref <ref>] [--force] [--source <dir>]
#   --remote  target repository (default: the private org repo)
#   --ref     export starter/ from this ref (default: main)
#   --force   replace everything in a target that is not empty: one branch, one commit, no tags
#   --source  export this directory instead (for tests)
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/.." && pwd)"
source "$here/lib.sh"

remote="$DEFAULT_REMOTE"
ref="$DEFAULT_REF"
force=0
source_dir=""
MESSAGE="Initial commit"
AUTHOR="Approval Inbox"
AUTHOR_EMAIL="approval-inbox@example.com"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --remote) remote="$(need_value "$@")"; shift 2 ;;
    --ref) ref="$(need_value "$@")"; shift 2 ;;
    --source) source_dir="$(need_value "$@")"; shift 2 ;;
    --force) force=1; shift ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

if [[ -n "$source_dir" ]]; then
  cp -R "$source_dir/." "$work/"
else
  extract_starter "$repo" "$ref" "$work"
fi

node "$here/check-starter.mjs" "$work" --message "$MESSAGE"

existing="$(git ls-remote "$remote")" || { echo "✗ Cannot read $remote" >&2; exit 1; }
if [[ -n "$existing" && $force -ne 1 ]]; then
  echo "✗ $remote is not empty. Use --force to replace everything in it with a single new commit." >&2
  exit 1
fi

cd "$work"
git init -q -b main
git add -A -f
GIT_AUTHOR_NAME="$AUTHOR" GIT_AUTHOR_EMAIL="$AUTHOR_EMAIL" \
GIT_COMMITTER_NAME="$AUTHOR" GIT_COMMITTER_EMAIL="$AUTHOR_EMAIL" \
  git -c commit.gpgsign=false commit -q -m "$MESSAGE"
if [[ $force -eq 1 ]]; then
  # --mirror also deletes branches and tags in the target that we don't have.
  git push -q --force --mirror "$remote"
else
  git push -q "$remote" main
fi
echo "Exported $(git rev-parse --short HEAD) from $ref to $remote"
