# Contributing to Marinara Engine

This is the canonical contributor guide for Marinara Engine. Use it with `README.md` for the product overview, `CHANGELOG.md` for release notes, and `CLAUDE.md` only as a thin companion for maintainers using AI agent. All participants are expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Tech Stack

| Layer    | Technology                                                     |
| -------- | -------------------------------------------------------------- |
| Frontend | React 19, Tailwind CSS v4, Framer Motion, Zustand, React Query |
| Backend  | Fastify 5, file-native JSON storage                            |
| PWA      | vite-plugin-pwa, Web App Manifest                              |
| Shared   | TypeScript 5, Zod                                              |
| Build    | Vite 7, pnpm workspaces                                        |

## Development Setup

Prerequisites:

- Node.js 24 LTS+
- Git
- pnpm via the repo-pinned `packageManager` if you are not using the launchers

Typical local setup:

```bash
git clone https://github.com/Pasta-Devs/Marinara-Engine.git
cd Marinara-Engine
git checkout staging
pnpm install
pnpm build
pnpm dev
```

> Active development happens on `staging`, not `main`. See [Branches](#branches) below before opening a PR.

Useful entry points:

- `pnpm dev` starts the server and client with hot reload.
- `pnpm dev:server` builds the shared package, then starts only the API server. If shared source changes while it is running, rerun `pnpm build:shared` and restart the server; the server watcher intentionally ignores shared build output.
- `pnpm dev:client` starts only the Vite frontend.
- `start.bat`, `start.sh`, and `start-termux.sh` run the launcher flow, including git-based auto-update and optional browser auto-open.

Copy `.env.example` to `.env` when you need to change ports, HTTPS settings, or launcher behavior such as `AUTO_OPEN_BROWSER=false`.

## Branches

Marinara Engine uses two long-lived branches:

| Branch    | Role                                                                                                      |
| --------- | --------------------------------------------------------------------------------------------------------- |
| `staging` | Active development and testing. This is the only target for feature, bug-fix, and documentation PRs.      |
| `main`    | Stable release branch. Only `SpicyMarinara` may promote tested work from `staging` or publish a hotfix.    |

Guidelines:

- **Base your feature branch on `staging`**, not `main`. Run `git checkout staging && git pull` before branching.
- **Open PRs against `staging`**. The GitHub web UI defaults to `main` (the repo's default branch); change the base to `staging` when filing the PR.
- Every PR must pass the required GitHub checks and complete its CodeRabbit review before merge. These gates cannot be bypassed by developers.
- PRs authored by active Pasta-Devs organization members or owners do not require a separate human approval. Organization members with repository merge permission may merge a ready PR into `staging` after the automated gates pass.
- Outside and first-time contributors may submit only to `staging` and need an approving review from repository owner `SpicyMarinara` in addition to the automated gates. Approval from another Pasta-Devs member does not satisfy this gate.
- Only `SpicyMarinara` may update or merge into `main`. Normal releases are promoted from the same repository's tested `staging` branch; direct mainline work is reserved for an owner-owned `hotfix/*` branch in this repository.
- Update checks and installation guides continue to track `main`, since end users install from released versions.

## Repo Layout

- `packages/client/` — React frontend, PWA shell, and UI components
- `packages/server/` — Fastify API, file-native storage, importers, and AI agents
- `packages/shared/` — Shared types, schemas, constants, and `APP_VERSION`
- `android/` — Android WebView wrapper for the Termux-served local app
- `win/` — Windows installer sources and helper scripts
- `docs/` — Docs and repo media assets
- `start.bat`, `start.sh`, `start-termux.sh` — platform launchers

Official downloadable agent and capability-package sources live in the separate [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) repository. Fixes to agents such as Illustrator, Music DJ, and Lorebook Keeper—including their definitions, default prompts, package-owned runtime code, metadata, artwork/assets, manifests, artifacts, and catalog validation—must use that repository's issues and target its `staging` branch.

Marinara Engine owns the host integration: package loading, capability APIs and shared contracts, Engine UI/settings, storage, provider/model routing, orchestration, and compatibility handling. A fix can therefore mention or affect a downloadable agent while still belonging in Engine when it changes only how the host loads, configures, or executes the package. Determine the owning repository before opening an issue, branch, or PR, and split cross-repository changes when both package content and host integration need updates.

The Engine update channel also selects the official Agent channel. Stable Engine builds use Marinara-Agents `main`; a git installation on Engine `staging` automatically reads the matching catalog and artifacts from Marinara-Agents `staging`. This lets Agent changes be tested end to end before the owner promotes both repositories to `main`.

## Prompt Leaf Content Is Verbatim (Decision + Threat Model)

**Invariant:** what the model receives inside a prompt section equals what the user typed. Prompt *leaf* content — character card fields, persona, lorebook entries, memories, scene text, example dialogue — is passed to the model **verbatim**. Do not HTML-escape `<`, `>`, or `&` in this content. Users legitimately organize cards and lorebooks with angle-bracket / HTML-style tags (`<thinking>`, `<scenario>`, `<div>`), and those must reach the model as written.

**Why this is safe.** Marinara is a local, single-user tool. The person who authors or imports a card is the same person any "injection" in that card would target — so the worst realistic outcome of an unescaped tag is the model role-playing something odd, which the user sees in their own chat and fixes by editing their own card. That is a rare, self-inflicted, self-correcting annoyance, not a security boundary. An LLM also does not parse the prompt as an XML document, so a stray `<` cannot "break out" of a section the way it would in a real parser — escaping it only corrupts text. Escaping traded that non-threat for a constant, real harm (mangled cards, broken roleplay HTML, wasted tokens).

**Structure is separate from content.** The framework's own section wrappers (`<description>…</description>`, `<last_message>…`, etc.) are emitted by `wrapContent` *around* leaf content, from fixed section names. Verbatim content therefore cannot alter structural tags; it only changes what sits inside them.

**What stays escaped (do not "harmonize" these back into the leaf path).** The agent value/attribute escapers — `escapeXml` / `escapeXmlAttribute` in `agent-executor.ts` and the local escaper in `knowledge-router.ts` — escape dynamic values into XML *attributes* and into strict, machine-parsed agent output (world-state documents, entry catalogs). Those are genuinely parsed downstream, where a stray `"` or `<` breaks an attribute or element, so they must stay escaped. Note that `agent-executor.ts` also escapes some of the same card fields into element *content* of that parsed document — a different consumer with different rules. It is **not** a reason to re-escape the main prompt path.

**If you are about to re-add escaping here: don't.** It has been tried repeatedly (see the flip-flop history in `CHANGELOG.md` and the header comment in `packages/server/src/services/prompt/prompt-escaping.ts`), it corrupts legitimate cards, and it protects against nothing in this deployment model. If a future multi-tenant or shared-marketplace deployment ever changes the threat model, the correct response is a validation/consent step at the import boundary — not silent per-token escaping of everyone's content at prompt-assembly time. Check with a maintainer before changing this.

## Validation

Baseline validation:

```bash
pnpm check
```

This runs the Impeccable project-context guard, localization checks, Prettier verification, workspace lint/type checks, and the production build.

Run the individual formatting and lint checks while iterating:

```bash
pnpm format:check
pnpm lint
```

Use `pnpm format` to apply Prettier to the maintained TypeScript and TSX source scope.

Useful follow-up checks:

```bash
pnpm version:check
pnpm regression
pnpm regression:prompt
pnpm regression:ui
```

Regression guards:

- `pnpm regression` (or `pnpm regression:node`) builds the shared package once, discovers the complete Node regression set from the filesystem, and runs it serially.
- `pnpm regression:prompt` runs fast deterministic checks for prompt assembly, lorebook keyword matching, macros, summaries, and mode-specific generation gates.
- `pnpm regression:ui` runs the Playwright browser suite; `pnpm smoke:ui` remains a compatibility alias for the same full UI lane.
  Each run clears `.tmp/playwright-data` and starts separate desktop and mobile app servers so their mutable fixtures cannot overlap. Stop any process already using the configured Playwright ports before running it; existing fixture state is disposable and the suite does not reuse a running development server.
- `pnpm test` checks the Windows installer layout, then runs the Node regression lane. It does not run the UI lane; invoke `pnpm regression:ui` explicitly for browser validation.

These checks are intentionally small and do not replace manual verification. When you change behavior, include the manual verification you performed and add or update a regression guard for the bug class when practical.

## Logging

All server-side logging goes through a shared [Pino](https://getpino.io/) logger instance exported from `packages/server/src/lib/logger.ts`. The `LOG_LEVEL` environment variable controls the minimum severity that gets printed (default: `warn`). See `docs/CONFIGURATION.md` for user-facing level descriptions.

### Level guidelines

| Level            | When to use                                         | Examples                                                                                         |
| ---------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `logger.error()` | Unrecoverable failures that need investigation.     | Storage errors, fatal agent failures, image generation crashes, command exceptions.              |
| `logger.warn()`  | Something went wrong but the request can continue.  | Non-critical agent failures, empty model responses, missing connections, non-fatal catch blocks. |
| `logger.info()`  | Operational milestones — "this happened".           | Seed results, game session lifecycle, commands executed, abort requests, device connections.     |
| `logger.debug()` | Verbose detail only useful when actively debugging. | Full prompts/responses, token usage, timing traces, state patches, pipeline internals.           |

### Code practices

- **Never use `console.log/warn/error` in server code.** Always import and use the shared logger:

  ```ts
  import { logger } from "../lib/logger.js"; // adjust relative path
  ```

- **Pick the right level.** If you aren't sure, ask: "Would an operator running in production want to see this?" If yes → `info`. If only a developer debugging → `debug`.

- **Use Pino format specifiers** for multi-argument calls. Pino does not auto-format extra positional arguments the way `console.log` does:

  ```ts
  // ✗ Wrong — second argument silently ignored by Pino
  logger.info("Resolved agents:", agents.length);

  // ✓ Correct — use %d / %s / %j format specifiers
  logger.info("Resolved %d agents", agents.length);

  // ✓ Also correct — template literals produce a single string
  logger.info(`Resolved ${agents.length} agents`);
  ```

- **Log errors with the error object first** (Pino convention for structured output):

  ```ts
  // ✗ Avoid
  logger.error("Import failed:", err);

  // ✓ Prefer — Pino serialises the error with stack trace
  logger.error(err, "Import failed");
  ```

- **Client-side code (`packages/client/`) should keep using `console.*`** — the browser has no Pino. Production builds automatically strip `console.log` via the Vite esbuild `pure` option; only `console.warn` and `console.error` survive.

- **Route handlers** that already have access to `app.log` or `req.log` may use those instead of the shared logger — they are child loggers of the same Pino instance and inherit the same level.

## Before You Open a Pull Request

1. **Open an issue first.** Before writing code, open an issue or check [the tracker](https://github.com/Pasta-Devs/Marinara-Engine/issues) so we can agree on direction, scope, and whether someone else is already on it.

2. **Test it yourself.** A green `pnpm check` is the minimum. Also build the app and container, click through your change, and try the obvious edge cases (light/dark mode, mobile, empty states, error paths). If you touched UI, include before/after screenshots. Upload or attach temporary PR proof screenshots to GitHub or a gist; do not commit them under `docs/pr-evidence/`. Keep committed images for intentional docs/reference assets such as README screenshots. CodeRabbit won't catch "the button is invisible in light mode" — only you can.

3. **Don't trust AI-checked boxes.** If an AI agent ticked the test-plan checkboxes, treat them as your to-do list, not proof of testing. Verify each item in a real browser before submitting; untick anything you haven't personally confirmed.

4. **Smaller and working beats big and broken.** We'd rather review a tight PR that works on the first try than a large one that needs multiple rounds of fixes.

## AI Agent Workflow

AI coding agents should use `.github/agents/chai-workflow.md` as an additive workflow overlay. It adapts the Chai Agent Workflow Pack for Marinara's branch, issue, PR, validation, and risky-work expectations.

The overlay is not a substitute for this guide. When instructions conflict, follow this file, `AGENTS.md`, package-specific instructions, and maintainer requests first. The overlay is mainly a proof and coordination layer: reproduce before fixing when practical, verify the user-facing claim before saying done, keep PR/issue text exact, leave PR checkboxes unchecked for humans, and call out risky-work proof gaps honestly.

## Pull Request Expectations

- Target the `staging` branch. The GitHub UI defaults to `main`; change the base before submitting. See [Branches](#branches).
- Wait for every required check and the CodeRabbit review to complete. Outside and first-time contributors must also obtain an approving review from `SpicyMarinara`.
- Link the issue or feature request your PR addresses. If there isn't one yet, open one first (see [Before You Open a Pull Request](#before-you-open-a-pull-request)).
- Keep PRs focused. Separate unrelated refactors from user-facing fixes or documentation work.
- Explain the why clearly in the PR description. Reviewers should understand the user problem, regression, or tradeoff being addressed, not just the implementation summary.
- Update documentation in the same PR when behavior changes affect installation, updates, release flow, launchers, or platform-specific behavior.
- Include screenshots or short recordings for UI changes.
- Call out manual validation clearly, especially for launcher, installer, or Android wrapper changes.
- Add a concise user-focused entry under the appropriate `CHANGELOG.md` `[Unreleased]` heading for every bug fix, behavior change, or new feature. Purely mechanical changes with no product or contributor-workflow impact may omit one.
- Avoid version drift. If your PR intentionally bumps a release, update every version-bearing file in one pass.

## Documentation Rules

- `README.md` is the user-facing overview and quickstart, not the full release log.
- `CHANGELOG.md` is the durable release-notes source and should be reusable for GitHub Releases.
- `android/README.md` is scoped to the Android wrapper around the Termux-served app.
- `CONTRIBUTING.md` is the canonical contributor and maintainer workflow document.
- `docs/CONFIGURATION.md` is the environment variable and `.env` reference.
- `docs/TROUBLESHOOTING.md` collects common user-facing issues and fixes.
- `docs/FAQ.md` is the user-facing FAQ for common questions like LAN access.
- If a change makes any existing doc misleading, fix that doc in the same PR.

### Translated documentation

- Translations of `docs/` live on the [`docs-i18n`](https://github.com/Pasta-Devs/Marinara-Engine/tree/docs-i18n) branch as one folder per language (`es/`, …), mirroring the English folder and file names 1:1, each with a generated `manifest.json`. The app downloads the selected language pack into its data folder on demand (Settings → General → Documentation Language); guides without a translation fall back to English with an `EN` badge, so features are never blocked on translations.
- When a PR adds, renames, deletes, or meaningfully edits a file under `docs/`, update every language folder on `docs-i18n` to match — or, if you cannot translate, open a follow-up issue titled `[docs-i18n] <affected paths>` so translators can catch up. Renames and deletions MUST be mirrored on `docs-i18n`: a translation left at an old path is silently ignored by the app.
- This applies to AI-assisted PRs too. If an AI assistant writes or updates a feature, instruct it that the English docs change lands in the same PR and the translated packs (or the `[docs-i18n]` follow-up issue) must cover every language currently on `docs-i18n`.
- Translate prose, headings, table text, and link text only. Code blocks, inline code, file paths, URLs, and link targets (including `#fragments`) stay byte-identical to English, and every file keeps its leading `# ` heading. Per-language conventions, in both cases with in-app UI labels kept in English bold plus a one-time native-language gloss:
  - Spanish: neutral international Spanish ("tú", no regionalisms).
  - German: natural standard High German (lowercase "du", en dashes `–`, Duden-style compound hyphenation for English loanwords such as "Lorebook-Eintrag"; mode names Conversation/Roleplay/Game Mode stay English).
  - French: natural standard French (tutoiement; no anglicisms or colloquialisms like "l'appli"/"checker"; plain ASCII spaces before `:` `;` `!` `?` and straight quotes/apostrophes — never `«»` or non-breaking spaces, which break the substring search and copy-paste; en dashes `–` for parentheticals, accents kept on capitals such as `É`; mode names Conversation/Roleplay/Game Mode stay English).
  - Brazilian Portuguese (`pt-br`): natural Brazilian Portuguese, never European forms ("você" with its imperative — "Clique", "Abra"; arquivo/salvar/tela/usuário — never ficheiro/guardar/ecrã/utilizador; current Acordo Ortográfico spelling; straight quotes and en dashes; mode names Conversation/Roleplay/Game Mode stay English).
  - Polish: natural Polish ("ty" with 2nd-person imperatives — "Kliknij", "Otwórz"; avoid reader-gendering past-tense forms; product names stay UNDECLINED with a carrier noun where the case demands — "w aplikacji Marinara Engine", never "w Marinarze" — while assimilated loanwords decline normally; straight ASCII quotes only, never „…", and no non-breaking spaces; mode names Conversation/Roleplay/Game Mode stay English).
  - Russian: natural Russian (lowercase "вы" with its imperative — "Нажмите", "Откройте" — matching mainstream Russian software convention and keeping phrasing gender-neutral via plural agreement, never capitalized "Вы" mid-sentence, never "ты"; product names stay in LATIN SCRIPT and undeclined with a carrier noun where the case demands — "в приложении Marinara Engine", never "в Маринаре" — while Cyrillic-assimilated loanwords such as "промпт", "токен", "пресет", and "лорбук" decline normally; en dashes `–` wherever Russian wants тире, never em dashes; straight ASCII quotes only, never «ёлочки», and no non-breaking spaces; "е" instead of "ё" except in "всё/всём/всё-таки"; mode names Conversation/Roleplay/Game Mode stay English).
  - Japanese: natural Japanese (polite です・ます prose with noun-phrase 体言止め headings and no "あなた" floods — Japanese drops subjects; product names stay in LATIN SCRIPT, never katakanized — "Marinara Engineでは", never "マリナーラ"; katakana loanwords use the modern trailing-ー spelling — "サーバー"/"ユーザー"/"フォルダー", never "サーバ"/"ユーザ"/"フォルダ" — with community-standard terms such as "ロアブック"; ALL Latin letters and digits stay half-width ASCII (full-width "７８６０" never matches a search for `7860`); no ideographic space U+3000, no non-breaking spaces, no space between Japanese and Latin/bold/code spans, text NFC-normalized; 「」 for Japanese quoting while quoted English UI strings stay byte-exact to the app; mode names Conversation/Roleplay/Game Mode stay English).
  - Korean: natural Korean (the 합니다체 register standard in Korean software with ~하세요 imperatives and noun-phrase headings; never "당신"; product names stay in LATIN SCRIPT — never transcribed — with phonetically correct particle attachment, "Marinara Engine은", "HUD와"; ONE transcription and ONE spacing per term — "메시지" never "메세지", "콘텐츠" never "컨텐츠", "캐릭터 카드" always spaced that way — because either split fragments the substring search; UI-label glosses match the app's shipped Korean UI strings in `ko.json` where they exist; ALL Latin letters and digits half-width ASCII; no ideographic space U+3000, no non-breaking spaces, straight ASCII quotes only (never 낫표 「」), text NFC-normalized — macOS-decomposed Hangul jamo would silently break search; mode names Conversation/Roleplay/Game Mode stay English).
  - Simplified Chinese (`zh-hans`): natural Simplified Chinese ("你" address, never "您"; SIMPLIFIED CHARACTERS ONLY — a stray traditional form like "個" or "說" silently breaks search for readers typing simplified; the Chinese SillyTavern community's established terms — "世界书" for lorebook, "角色卡", "提示词" for prompt, "立绘" for sprites, "智能体" for agent; product names stay in LATIN SCRIPT; full-width CJK punctuation ，。（） in prose but ALL Latin letters and digits half-width ASCII — full-width "７８６０" never matches a search for `7860`; glosses in half-width parens tight after a bold/Latin label and full-width （） inside pure Chinese prose; curly “” for Chinese-prose quoting while quoted English UI strings stay byte-exact; no ideographic space U+3000, no NBSP, text NFC-normalized; mode names Conversation/Roleplay/Game Mode stay English).
  - Hindi: natural modern technical Hindi (the Google/Microsoft Hindi register — Devanagari loanwords like "फ़ाइल"/"सर्वर"/"प्रॉम्प्ट", never शुद्ध purisms like "संगणक"; "आप" address with "करें"-style imperatives, never "तू"/"तुम"; ONE transliteration per term with a fixed nukta policy — nukta kept on ज़/फ़ only, so "फ़ाइल" but "खास", because "फ़ाइल" and "फाइल" are different byte strings that split the substring search; international digits 0-9 only — Devanagari "०७८६०" never matches a search for `7860`; the danda "।" ends Hindi sentences (verbatim English strings keep their own punctuation); product names stay in LATIN SCRIPT with postpositions as separate words — "Marinara Engine में"; straight ASCII quotes; text NFC-normalized with no ZWJ/ZWNJ; mode names Conversation/Roleplay/Game Mode stay English).
- After editing a pack, run `node scripts/docs-i18n/build-manifest.mjs <pack-dir>` to refresh hashes, then `node scripts/docs-i18n/validate-pack.mjs <pack-dir>` from the Engine repo root, before committing to `docs-i18n`.

## Localization

UI translations live in one JSON file per locale and fall back to the canonical English catalog. See
[`docs/development/localization.md`](docs/development/localization.md) for the translation boundary, file format,
semantic-key conventions, downloadable Agent handoff, and validation command.

Keep prompts, authored content, identifiers, protocol values, and persisted machine values out of UI localization.
Run `pnpm localization:check` whenever a locale file or localization key changes.

## Versioning and Releases

Current policy:

- Canonical version source: root `package.json`
- Release tag format: `vX.Y.Z`
- Changelog authority: `CHANGELOG.md`
- Every other version-bearing file is derived and must be synchronized before tagging or publishing

Current version touchpoints:

| File                                        | Role                                                   |
| ------------------------------------------- | ------------------------------------------------------ |
| `package.json`                              | Canonical application version                          |
| `packages/client/package.json`              | Derived workspace version                              |
| `packages/server/package.json`              | Derived workspace version                              |
| `packages/shared/package.json`              | Derived workspace version                              |
| `packages/shared/src/constants/defaults.ts` | Shared `APP_VERSION` used by the app and update checks |
| `win/installer/installer.nsi`               | Windows installer output version                       |
| `win/installer/install.bat`                 | Windows installer banner text                          |
| `android/app/build.gradle`                  | Android `versionName` and `versionCode`                |

Android policy:

- `versionName` must match the app version.
- `versionCode` must increase monotonically for every shipped APK.
- Stable and tagged release APKs require the repository maintainers' configured `ANDROID_SIGNING_*` keystore credentials. These are CI build inputs, never information requested from APK downloaders. The manual pre-alpha workflow may publish a debug-signed APK only as a draft, test-only artifact.

Release-related behavior already in the repo:

- Docker publishing is triggered by `v*` tags.
- Tagged releases are published from `CHANGELOG.md` by the GitHub release workflow, with a named versioned source ZIP and a temporary Android APK notice prepended so release-page downloaders know the APK still requires Termux. Android releases attach both the versioned APK and the stable `marinara-engine-android.apk` alias used by the one-click latest-download link.
- The server update check reads the newest GitHub `v*` tag and uses matching release metadata when it exists.
- Git-based installs can apply updates automatically; Docker installs are prompted with the pull command instead.
- Pull request CI runs `pnpm check`, `pnpm version:check`, and the tracked-installer guard.
- Built installer binaries belong on GitHub Releases and should not be committed back into the repository.

Standard release flow:

1. Bump the canonical version in root `package.json`.
2. Run `pnpm version:sync -- --android-version-code <next-code>` to sync all derived version fields.
3. Run `pnpm credits:check`; if it reports stale contributor credits, run `pnpm credits:sync` and include the Credits modal update in the release PR.
4. Update `CHANGELOG.md`; when publishing a stable release, update README's current-stable-release link to the matching tag.
5. Merge the release-ready `staging` change to `main`.
6. Create and push the tag `vX.Y.Z` from the `main` commit that contains that exact version bump.
7. Let the release workflows publish or update the GitHub Release, named source ZIP, Windows installer, Android WebView shell APK, and GHCR container images (`X.Y.Z`, `X.Y`, `X`, `latest`, plus `X.Y.Z-lite` / `lite`) from the matching changelog entry.

Release helpers now in the repo:

- `pnpm version:sync -- --android-version-code <next-code>` updates the derived version files from the root `package.json` version. README's current-stable-release link changes only when that release is published.
- `pnpm version:check` fails when those derived files drift out of sync.
- `pnpm credits:check` compares the in-app Credits modal with the GitHub contributors list, and `pnpm credits:sync` refreshes it.
- `pnpm guard:installer-artifacts` fails when tracked installer binaries appear under `win/installer/*.exe`.
- `pnpm release:notes -- <version>` renders the matching `CHANGELOG.md` entry for release publication and prepends the temporary Android APK / Termux notice.

## Immediate Way Forward

- Add launcher and installer smoke tests so startup parity is exercised automatically, not just by manual verification.
- Consider a release wrapper script that bumps the root version, prompts for `versionCode`, runs `pnpm version:sync`, and opens the changelog entry for editing.
