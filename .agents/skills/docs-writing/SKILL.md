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
- Use task headings that name what the reader wants: "Add an account", "Import a character". Avoid vague headings like "Overview", "Understanding X", "Deep dive".
- When a task needs something first (an account, a character, a setting turned on), start it with one "Before you start" line that names it and links to the guide that sets it up.
- Write procedures as numbered steps. One action per step. Start each step with the verb. Say where: **Connections → Add account**. After a step whose result is not obvious, say what the reader sees.
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
- UI labels in **bold**. Menu paths with an arrow: **Settings → General**. Keys as <kbd>Ctrl</kbd>+<kbd>K</kbd> or `Ctrl+K`, the same way throughout a guide.
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

Use one term for each thing, matching the app's UI labels (`en.json`). Explain the term in plain words the first time a guide uses it. Left column: the term to use. Middle: words to replace.

| Use | Instead of | Plain meaning |
| --- | --- | --- |
| **Connections** | providers page, API settings | The panel where you add AI services and pick which model does each job. |
| account | connection, provider, API, endpoint | One saved key or sign-in for one service (UI: **Add account**, **Edit account**). |
| service | provider, vendor, backend | The company or server an account talks to, such as OpenAI or Ollama. "Provider" only where the UI says it (**Which provider?**). |
| model | AI, engine, LLM | One AI model that writes replies or does a job. |
| job | role, default | What a model is used for, such as **Main** (writes chat replies) or **Images**. |
| API key | key, token, secret | The secret code a service gives you so Marinara can use your account. |
| **Built-in model** | Local Model, local model, sidecar, Gemma | The small model Marinara downloads and runs on your own computer, with no API key. |
| **Built-in decision model** | decision sidecar | The optional second built-in model for yes-or-no checks. |
| decision model | helper model, yes/no model | A small model that answers yes-or-no questions for features such as lorebooks. |
| **OpenAI-compatible** | Custom (OAI-Compatible), custom endpoint | A server or proxy that accepts the OpenAI request format. |
| chat | conversation (as a noun for any chat), thread | One saved chat in any mode. |
| Conversation / Roleplay / Game Mode | convo, RP, GM (except as the tab labels **CONVO**, **RP**, **GM**) | The three chat modes. Mode names stay in English. |
| **Chat Settings** | chat settings drawer, settings panel | The panel of options for the chat you have open. |
| character | bot, card (alone) | An AI character. Say "character card" for the file that defines one. |
| persona | user persona, your identity | The character card that stands for you in a chat. |
| lorebook | world info, lore book | A set of world facts the AI reads when their keywords come up. |
| entry | lore entry, WI entry | One fact inside a lorebook. |
| preset (**Prompt Preset**) | prompt template, prompt source | A saved prompt structure and generation values. |
| agent | add-on, plugin | A helper that runs alongside replies, such as a tracker or illustrator. |
| **Agent Organizer** | Agents Manager, agent catalog | Where you install and update optional agents. |
| **Commands** | Roleplay Commands, hidden actions | Actions a character can take on its own (illustrations, whispers, selfies). |
| swipe | alternate reply, version | One of several answers kept on the same message. |
| **Branch from here** / branch | fork | A copy of a chat up to one message, which you continue separately. |
| **Professor Mari** (then Mari) | Prof. Mari, the assistant | The built-in assistant on the Home screen. |
| prompt | context (as a synonym) | All the text Marinara sends to the model for one reply. |
| context window | context size, context length | How much text a model can read at once, counted in tokens. |
| tokens | — | Small pieces of text that models count; about three-quarters of a word in English. |
| system prompt | system message | Instructions sent to the model before the chat, which the reader does not see in the chat. |
| **Download Backup** | backup ZIP, export all | A `.zip` file of all your data and uploaded files. |
| **Export Profile** / **Import Profile** | profile file, restore | Save or load your account data as a file. |
| data folder | DATA_DIR (except in configuration steps) | The folder on the server computer where Marinara keeps your data. |
| login | Basic Auth, remote password | The username and password that protect Marinara when other devices reach it. |
| admin secret (`ADMIN_SECRET`) | admin password | A second password for risky actions, such as updates, from another device. |
| **Apply Update** | update button | Updates a git install from the browser, if the server allows it. |
| Termux | Linux terminal | The Android app that runs a small Linux system where Marinara runs on a phone. |
| PWA | web app, Home Screen app | A website saved to the Home Screen that opens like an app. |
