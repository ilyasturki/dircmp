---
name: release
description: Generate changelog and bump version. Use when the user invokes /release.
disable-model-invocation: true
argument-hint: <patch|minor|major>
allowed-tools: Bash Read Write Edit Grep Glob AskUserQuestion
---

# Release

Generate a changelog entry and run `npm version` to bump the version.

## Context

Current version: !`node -p "require('./package.json').version"`

Commits since last tag:

!`git log --oneline $(git describe --tags --abbrev=0)..HEAD`

Current CHANGELOG.md:

!`cat CHANGELOG.md 2>/dev/null || echo "(empty)"`

## Refresh Nix hash and run CI gate

Update `flake.nix` outputHash so the `nix-build` job doesn't fail on a stale hash, then run CI locally. Chained in one block so `act` cannot snapshot the working tree mid-refresh (when flake.nix briefly holds the `AAAA` placeholder). The `version` hook re-runs the hash script later; it's idempotent. If CI fails, stop and report the error.

!`./scripts/update-nix-hash.sh && act push -W .github/workflows/ci.yml 2>&1 | tail -20`

## Instructions

1. **Determine bump level**: If `$ARGUMENTS` is one of `patch`, `minor`, `major`, use it. Otherwise, deduce the level from the commits since the last tag and confirm with the user using AskUserQuestion.

2. **Compute new version**: Based on the current version and `$ARGUMENTS`, determine the new version number.

3. **Write changelog entry**: Update CHANGELOG.md with a new section for the new version. Follow the Keep a Changelog format with these categories (only include categories that apply):
    - **Added** — new features
    - **Changed** — changes to existing functionality
    - **Fixed** — bug fixes
    - **Performance** — speed or resource improvements
    - **Removed** — removed features

    Guidelines:
    - Write concise, user-facing descriptions — not raw commit messages
    - Drop conventional commit prefixes and scopes
    - Skip commits that aren't user-facing (style, chore, refactor, build) unless they have significant impact on behavior
    - Combine related commits into a single entry when appropriate
    - Place the new section at the top, below the `# Changelog` heading

4. **Update README**: Review the changelog entry you just wrote and check whether README.md needs updates (e.g. new features, keybindings, config options, CLI flags). If so, update the relevant sections. If the release is only bug fixes or performance improvements, skip this step.

5. **Bump version**: Run `npm version $ARGUMENTS --force`. This triggers the version hook which updates the Nix flake hash and stages flake.nix and CHANGELOG.md automatically.
