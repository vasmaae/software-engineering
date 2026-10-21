#!/bin/sh
set -eu
base=${COMMIT_BASE:-}
head=${COMMIT_HEAD:-HEAD}
if [ -n "$base" ] && ! echo "$base" | grep -Eq '^0+$'; then
  npx --no -- commitlint --from "$base" --to "$head"
else
  root=$(git rev-list --max-parents=0 "$head")
  git show -s --format=%B "$root" | npx --no -- commitlint
  npx --no -- commitlint --from "$root" --to "$head"
fi
