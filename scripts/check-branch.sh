#!/bin/sh
set -eu
branch=${1-$(git symbolic-ref --quiet --short HEAD)}
if git check-ref-format --branch "$branch" >/dev/null 2>&1 &&
  { [ "$branch" = main ] || printf '%s\n' "$branch" | LC_ALL=C grep -Eq '^(feature|bugfix|docs|chore)/SGT-[1-9][0-9]*-[a-z0-9]+(-[a-z0-9]+)*$'; }; then
  exit 0
fi
printf 'Invalid branch: %s\nExpected main or (feature|bugfix|docs|chore)/SGT-<id>-<lowercase-kebab-description>\n' "$branch" >&2
exit 1
