#!/usr/bin/env bash
# Checks a directory that is about to be shipped to candidates.
# Fails on terms that reveal how submissions are judged and on host names
# containing "firestart". The contact address and the company name are allowed.
#
# Usage: scripts/check-starter.sh <dir> [--message "<commit message>"]
set -euo pipefail

dir="${1:?usage: check-starter.sh <dir> [--message <text>]}"
shift
message=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --message) message="$2"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

CONTACT='s.ferraz-leite@firestart.com'
TERMS='(pitfalls?|traps?|gotchas?|evaluations?|assessments?|interviews?|rubrics?|scoring)'
HOSTS='[[:alnum:]_.@-]*firestart[[:alnum:]-]*\.[[:alpha:]]{2,}'

failed=0
report() {
  echo "✗ $1" >&2
  failed=1
}

# Terms in file contents (whole words, any case).
if hits=$(grep -rIniE --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next "(^|[^[:alnum:]_])${TERMS}([^[:alnum:]_]|$)" "$dir"); then
  report "forbidden term in file contents:"
  echo "$hits" >&2
fi

# Host names in file contents, ignoring the contact address.
if hits=$(grep -rIniE --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next "$HOSTS" "$dir" \
  | sed "s/${CONTACT//./\\.}//g" | grep -iE "$HOSTS"); then
  report "host name containing firestart:"
  echo "$hits" >&2
fi

# Terms and hosts in file and directory names.
if hits=$(cd "$dir" && find . -path ./node_modules -prune -o -path '*/node_modules' -prune -o -path ./.git -prune -o -print \
  | grep -iE "(^|[^[:alnum:]])${TERMS}([^[:alnum:]]|$)|firestart"); then
  report "forbidden term in file names:"
  echo "$hits" >&2
fi

if [[ -n "$message" ]] && echo "$message" | grep -qiE "(^|[^[:alnum:]_])${TERMS}([^[:alnum:]_]|$)|$HOSTS"; then
  report "forbidden term or host in commit message: $message"
fi

if [[ $failed -ne 0 ]]; then
  echo "Check failed for $dir" >&2
  exit 1
fi
echo "Check passed for $dir"
