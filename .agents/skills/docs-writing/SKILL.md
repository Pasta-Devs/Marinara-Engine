---
name: docs-writing
description: Use when writing, editing or reviewing the user guides in docs/ (the category folders, FAQ.md, INSTALLATION.md, UPGRADING.md, CONFIGURATION.md, TROUBLESHOOTING.md).
---

# Writing Marinara Engine user guides

The guides in `docs/` are the manual for people who use Marinara Engine: hobbyists who chat and roleplay with AI characters. Many are not technical, many read on a phone, and many read in their second language. Write for a reader who is in the middle of doing something and wants to get back to it. A reader should find the task they came for, do it step by step, and know it worked.

These rules are additive. `AGENTS.md`, `CONTRIBUTING.md` and the maintainer's latest request win when they conflict.

## Structure

- Open each guide with one or two sentences: what the feature is for and when you would use it. No "In this guide, we will…".
- Put the common task first, then options, then edge cases and troubleshooting. Move deep reference material (every field of a form) into a table or a clearly marked reference section at the end.
- Use task headings that name what the reader wants: "Add a connection", "Import a character". Avoid vague headings like "Overview", "Understanding X", "Deep dive".
- When a task needs something first (a connection, a character, a setting turned on), start it with one "Before you start" line that names it and links to the guide that sets it up.
- Write procedures as numbered steps. One action per step. Start each step with the verb. Say where: **Settings → Connections → Add account**. After a step whose result is not obvious, say what the reader sees.
- Keep paragraphs short (1–4 sentences). Prefer a short table over a long list of "X does Y" bullets when items share the same shape.
- Say each fact once. When two guides explain the same thing, keep it in the guide that owns the feature and link from the other one.
- Explain a term on first use in that guide, in plain words ("context window", "tokens", "system prompt", "API key", "embeddings"). One short clause is enough.
- After an important task, add one or two "If it did not work" lines right under the steps: the most common failure and its fix, taken from the code or `TROUBLESHOOTING.md`.
- End with "Troubleshooting" (symptom → fix) only when there are more known problems. No closing summary that repeats the page.

## Wording

- Second person, active voice, present tense. "Click **Save**.", not "The Save button should be clicked."
- Short sentences, common words. No idioms, wordplay or cultural references.
- UI labels exactly as the app shows them, in bold. The source of truth is `packages/client/src/localization/locales/en.json` plus the components that use those keys. Never invent or paraphrase a label.
- Keep the friendly Marinara voice where it exists, but never at the cost of clarity. A warm opening sentence or a short "why you would want this" is good; jokes inside steps are not.
- Cut repetition and padding, not information. Move every-field tables and rare options to a reference section at the end; do not delete them.
- Use the terms in the [word list](#word-list) below, one term for each thing.

## Markdown style

The same files render on GitHub, in the in-app docs viewer and on marinaraengine.net.

- One `#` title per guide, matching the guide's name. Then `##` and `###`. Never skip a level. Never use bold text as a fake heading.
- Write each paragraph on one line. Do not hard-wrap: the website keeps line breaks.
- One blank line between blocks. Never two.
- Numbered lists (`1.`) for ordered steps, bullets (`-`) for unordered items. Nest at most one level. Extra detail for a step goes in an indented sentence, not a new list.
- UI labels in **bold**. Menu paths with an arrow: **Settings → Connections**. Keys as <kbd>Ctrl</kbd>+<kbd>K</kbd> or `Ctrl+K`, the same way throughout a guide.
- `Inline code` only for things the reader types or sees literally: file names, paths, commands, environment variables, macros like `{{user}}`, values like `true`. Not for UI labels, not for emphasis.
- Code blocks with a language tag (`bash`, `json`, `text`), only for things to copy or exact output. One block per platform, each with a short label above it.
- Tables for items with the same shape, 2–4 columns, short cells. No lists or long paragraphs inside cells.
- Callouts as a blockquote with a bold label: `> **Note:**`, `> **Tip:**`, `> **Warning:**` (data loss, cost or security only). One or two sentences, a few per guide at most.
- Link text says where the link goes: "see [Peek Prompt](../chats/peek-prompt.md)", never "click here". Relative links between guides; full URLs only for external sites.
- No HTML except `<kbd>` and existing `<details>`/`<summary>` blocks. No emoji in headings or as bullets. No horizontal rules between sections.

## Ban list

Remove these patterns wherever you touch a guide:

- Filler openers and closers: "In this guide", "Let's dive in", "Whether you're a beginner or…", "Happy chatting!", "That's it!", "In summary".
- Hype and empty words: seamless, robust, powerful, comprehensive, leverage, utilize, empower, unlock, elevate, streamline, cutting-edge, delve, a wide range of, a variety of, effortlessly, intuitive.
- Hedging and padding: "It's worth noting that", "It's important to note", "Please note", "Note that", essentially, basically, simply, just, easily, of course, actually, really, very.
- Words that blame or talk down: simply, just, obviously, easy.
- Rhetorical questions as headings or openers.
- Rule-of-three lists that exist only for rhythm, and em-dash chains. Use a period.
- Bold on random phrases. Bold is for UI labels and the one word that must not be missed.
- "Allows you to" / "enables you to" → "lets you", or name the action.
- Text that describes what the docs will do instead of doing it.
- Any word the sentence does not need.

## Accuracy

A fluent sentence that is wrong is worse than a clumsy correct one. Check every claim you write or keep against the code on `staging`:

| Claim | Source of truth |
| --- | --- |
| UI labels, menus, tabs, buttons | `en.json` and `packages/client/src` |
| Defaults, limits, allowed values | `packages/shared` schemas/constants, `packages/server/src` |
| Environment variables, `.env` | server config code, `.env.example`; `docs/CONFIGURATION.md` is the reference |
| Install, update, launcher | the scripts and `README.md`; do not change steps you cannot verify |
| Providers and models | the provider code; never add models or prices from memory |

When code and guide disagree, the code wins; record it in the PR ("Guide said default 20, code default is 10 in `packages/shared/...`"). When you cannot verify a claim, leave it unchanged and list it under "Could not verify". Never guess.

## Website and app constraints

- **Screenshot headings.** marinaraengine.net places screenshots under specific headings, matched by exact heading text. Keep those heading texts. If a rename clearly helps, list it (old → new) in the PR under "Renamed headings with screenshots". Ask the maintainer or check the website config for the current list before renaming any heading.
- **App deep links.** The app opens some guides at a search term (for example `agents/avatars.md` with "Get a 3D model"). Before removing a phrase or file, search `packages/client/src` for `initialDoc` and `initialSearchTerm`.
- **Renames.** Rename a guide only when it clearly helps, with `git mv`, in a commit that does not also rewrite the file. Never add, remove or rename a category (top-level folder).
- **`docs/agents/built-in-agents.md`** is parsed into separate agent pages. Keep `## <group>` sections and one `### <Agent name>` per agent with the existing fields. Change the text inside, not the shape.
- **Links.** Keep links relative (`../chats/peek-prompt.md#section`). Anchors are GitHub-style slugs of the heading text; check every link and anchor you touch still resolves.
- **No images** or image placeholders. The website adds screenshots itself.

## Translations

`docs-i18n` holds the language packs that mirror `docs/` file by file. Every PR that adds, renames, deletes or meaningfully edits a guide must update those packs or open a follow-up issue titled `[docs-i18n] <affected paths>` that lists the changed files and every rename (renames must be mirrored there or the translation is lost). See `CONTRIBUTING.md § Translated documentation`.

## Word list

Use one term for each thing, matching the app's UI labels.

_To be filled from the Phase 1 audit._
