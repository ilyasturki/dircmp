#!/bin/bash
set -e
apt-get update && apt-get install -y curl git build-essential
NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
brew install ilyasturki/dircmp/dircmp

dircmp --help
dircmp --version

mkdir -p /tmp/dircmp-a /tmp/dircmp-b
echo "hello" > /tmp/dircmp-a/file.txt
echo "hello" > /tmp/dircmp-b/file.txt

dircmp check /tmp/dircmp-a /tmp/dircmp-b

echo "world" > /tmp/dircmp-b/file.txt
dircmp check /tmp/dircmp-a /tmp/dircmp-b && exit 1 || true

dircmp diff --format json /tmp/dircmp-a /tmp/dircmp-b
dircmp diff --stat /tmp/dircmp-a /tmp/dircmp-b

dircmp completions bash | grep -q 'dircmp'
dircmp completions zsh | grep -q 'dircmp'
dircmp completions fish | grep -q 'dircmp'

echo "All smoke tests passed!"
