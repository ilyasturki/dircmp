#!/usr/bin/env bash
set -euo pipefail

FLAKE="$(cd "$(dirname "$0")/.." && pwd)/flake.nix"
FAKE_HASH="sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="

# Replace the current hash with a known-wrong one to force a mismatch
sed -i "s|outputHash = \"sha256-.*\"|outputHash = \"$FAKE_HASH\"|" "$FLAKE"

# Build and capture the correct hash from the error
HASH=$(nix build .#default 2>&1 | grep -oP 'got:\s+\K\S+') || true

if [[ -z "$HASH" ]]; then
    echo "Error: failed to capture hash from nix build output" >&2
    git checkout -- "$FLAKE"
    exit 1
fi

# Write the correct hash back
sed -i "s|outputHash = \"$FAKE_HASH\"|outputHash = \"$HASH\"|" "$FLAKE"

echo "Updated outputHash to: $HASH"
