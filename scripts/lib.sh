# Shared settings for the export scripts. Sourced, not run.

# The private repository candidates' copies are made from.
DEFAULT_REMOTE="git@github.com:firestartorg/front-end-coding-challenge.git"
# What gets shipped by default: starter/ as committed on this branch.
DEFAULT_REF="main"

# Value of a flag, or exit with a clear message if it's missing.
need_value() {
  if [[ $# -lt 2 || "$2" == --* ]]; then
    echo "$1 needs a value" >&2
    exit 2
  fi
  printf '%s' "$2"
}

# Extracts starter/ of a ref into a directory (no Git metadata).
extract_starter() {
  local repo="$1" ref="$2" target="$3"
  git -C "$repo" rev-parse --verify --quiet "$ref^{commit}" >/dev/null || { echo "Unknown ref: $ref" >&2; exit 2; }
  mkdir -p "$target"
  git -C "$repo" archive "$ref" starter | tar -x -C "$target" --strip-components=1
}
