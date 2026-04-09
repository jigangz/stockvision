#!/bin/bash
# Release a new version of StockVision
# Usage: bash scripts/release.sh 0.2.0
#
# This script:
# 1. Updates version in tauri.conf.json and package.json
# 2. Commits the version bump
# 3. Creates and pushes a git tag
# 4. GitHub Actions does the rest (build + release + updater artifacts)

set -e

VERSION="${1:?Usage: bash scripts/release.sh <version> (e.g. 0.2.0)}"

echo "Releasing StockVision v${VERSION}..."

# Update version in tauri.conf.json
sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"${VERSION}\"/" src-tauri/tauri.conf.json

# Update version in package.json
sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"${VERSION}\"/" package.json

# Update version in Cargo.toml
sed -i "s/^version = \"[^\"]*\"/version = \"${VERSION}\"/" src-tauri/Cargo.toml

# Commit and tag
git add src-tauri/tauri.conf.json package.json src-tauri/Cargo.toml
git commit -m "release: v${VERSION}"
git tag "v${VERSION}"
git push origin main "v${VERSION}"

echo ""
echo "✅ Tag v${VERSION} pushed!"
echo "GitHub Actions will build and publish the release."
echo "Check: https://github.com/jigangz/stockvision/actions"
