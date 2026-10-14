#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "Usage: $0 <path to dircmp> [expected version]" >&2
  exit 1
fi

bin="$(realpath "$1")"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

version="$("$bin" --version)"
if [[ $# -eq 2 && "$version" != "$2" ]]; then
  echo "dircmp --version printed '$version', expected '$2'" >&2
  exit 1
fi

mkdir "$tmp/a" "$tmp/b"
echo same > "$tmp/a/f"
echo same > "$tmp/b/f"
"$bin" check "$tmp/a" "$tmp/b" || { echo "dircmp check failed on identical directories" >&2; exit 1; }
"$bin" diff --format json "$tmp/a" "$tmp/b" > /dev/null

echo changed > "$tmp/b/f"
status=0
"$bin" check "$tmp/a" "$tmp/b" || status=$?
if [[ $status -ne 1 ]]; then
  echo "dircmp check exited $status on differing directories, expected 1" >&2
  exit 1
fi
