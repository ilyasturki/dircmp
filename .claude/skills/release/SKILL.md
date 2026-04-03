---
name: release
description: Generate changelog and bump version. Use when the user invokes /release.
disable-model-invocation: true
argument-hint: <patch|minor|major>
allowed-tools: Bash Read Write Edit Grep Glob
---

# Release

Generate a changelog entry and run `npm version` to bump the version.

## Context

Current version: !`node -p "require('./package.json').version"`

Commits since last tag:

!`git log --oneline $(git describe --tags --abbrev=0)..HEAD`

Current CHANGELOG.md:

!`cat CHANGELOG.md 2>/dev/null || echo "(empty)"`

## Instructions

1. **Validate argument**: `$ARGUMENTS` must be one of `patch`, `minor`, `major`. If missing or invalid, ask the user.

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

4. **Review**: Show the CHANGELOG.md diff and wait for user confirmation before proceeding.

5. **Commit**: Stage and commit CHANGELOG.md with message `docs: update changelog for $NEW_VERSION`.

6. **Bump version**: Run `npm version $ARGUMENTS`. This triggers the version hook which updates the Nix flake hash and stages flake.nix automatically.
