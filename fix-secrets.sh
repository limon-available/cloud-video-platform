#!/bin/bash
set -e

echo "Removing backend/.env from git tracking..."
git rm --cached backend/.env

echo "Committing removal of secrets..."
git commit -m "chore: remove secrets from git tracking"

echo "Rewriting history to purge backend/.env from all commits..."
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch backend/.env" \
  --prune-empty --tag-name-filter cat -- --all

echo "Done. Now force push to GitHub:"
echo "git push origin main --force"