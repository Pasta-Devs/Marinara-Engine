# CLAUDE.md

This file is a thin maintainer note for contributors using Claude. Canonical workflow, validation, and release guidance lives in `CONTRIBUTING.md`.

## Preferred Workflow

- Start with `pnpm install`.
- Run `pnpm check` as the baseline validation command.
- Run `pnpm db:push` when server or database changes need schema verification.
- Run `pnpm version:check` when you touch release metadata, version-bearing files, or README release references.

## Repo-Specific Cautions

- Keep edits non-destructive. Do not revert unrelated work in the tree.
- Prefer focused patches that keep code, docs, and release metadata aligned in the same change.
- When preparing a PR, make the why explicit in the description so reviewers can see the user problem or rationale, not just the file changes.
- Check `README.md`, `android/README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `docs/CONFIGURATION.md`, `docs/TROUBLESHOOTING.md`, and `docs/FAQ.md` together when install, update, or release behavior changes.

## Version Truth

- Canonical version: root `package.json`
- Release tag format: `vX.Y.Z`
- Release-notes source: `CHANGELOG.md`
- Derived version files that must stay in sync:
  - `packages/client/package.json`
  - `packages/server/package.json`
  - `packages/shared/package.json`
  - `packages/shared/src/constants/defaults.ts`
  - `installer/installer.nsi`
  - `installer/install.bat`
  - `android/app/build.gradle`

Android-specific rule:

- `versionName` matches the app version.
- `versionCode` increments for every shipped APK.

## Safe Multi-File Updates

- When changing version numbers, bump root `package.json` first, then run `pnpm version:sync -- --android-version-code <next-code>`.
- Run `pnpm version:check` before tagging or publishing.
- Keep `CONTRIBUTING.md` authoritative. Add Claude-specific notes here only when they are operationally useful and not already covered there.

## Frontend Changes

- **Read `packages/client/.instructions.md` before editing any client code.** It is the authoritative reference for architecture, patterns, conventions, and common-mistake avoidance.
- Validate with `pnpm check` (TypeScript + ESLint). There is no automated test suite.
