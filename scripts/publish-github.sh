#!/bin/bash
# Publishes a read-only copy of this repository to GitHub.
#
# The app itself deploys from DeepSpace source (`npx deepspace deploy`).
# GitHub is only a place for people to read the code, so this script never
# adds a GitHub remote to the working checkout.
#
# The copy's commits carry the GitHub no-reply address instead of a personal
# email. The rewrite gives the same result every time, so running this again
# after new commits is an ordinary push.
#
# Needs the GitHub CLI, signed in (`gh auth login`).

set -euo pipefail

REPO="esanchezharris/second-ears"
EMAIL="$(gh api user --jq '"\(.id)+\(.login)@users.noreply.github.com"')"
COPY="$(mktemp -d)"

git clone --quiet --branch main "$(git rev-parse --show-toplevel)" "$COPY"
cd "$COPY"
FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch \
  --env-filter "export GIT_AUTHOR_EMAIL='$EMAIL' GIT_COMMITTER_EMAIL='$EMAIL'" main

# Stop if a personal address survived the rewrite.
if git log --format='%ae %ce' | grep -v "users.noreply.github.com" | grep -q .; then
  echo "A commit still carries a personal email. Nothing was pushed." >&2
  exit 1
fi

git push "https://github.com/$REPO.git" main
