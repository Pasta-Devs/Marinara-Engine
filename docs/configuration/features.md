# Feature Switches

Some server behaviours are optional. You turn them on in **Settings > Advanced > Features**. Every switch starts off, so a server where nobody opens this section behaves exactly as before.

A change applies straight away. You do not need to restart the server or reload the page.

## Overview

| Switch                                      | Setting key                 | Default | Environment variable                 |
| ------------------------------------------- | --------------------------- | ------- | ------------------------------------ |
| **Cache-friendly prompt layout**            | `cacheFriendlyPromptLayout` | Off     |                                      |
| **Stable lorebook picks**                   | `stableLorebookGroupPicks`  | Off     | `LOREBOOK_STABLE_GROUP_WINNERS`      |
| **Retry failed provider calls**             | `providerRetry`             | Off     | `PROVIDER_RETRY_TRANSIENT_ERRORS`    |
| **Background call cap**                     | `backgroundCallCap`         | Off     | `MARINARA_BACKGROUND_CALLS_PER_HOUR` |
| **Keep generating when the tab is closed**  | `generationJobTracking`     | Off     |                                      |
| **Minimize the console to the system tray** | `consoleTray`               | Off     | `MARINARA_CONSOLE_TRAY`              |

Searching settings for `features` takes you to the section.

## Where the settings are stored

All switches are saved together in the `features` app setting, a JSON object of booleans and numbers. Only values that differ from the default are stored. A missing key, an empty object or an unreadable value all mean the default: every switch off, with the default numbers.

The server keeps a copy in memory, so checking a switch costs nothing on busy paths such as provider calls and lorebook scans. Saving from Settings, or any other write to the `features` row, refreshes that copy at once.

The API is `GET` and `PUT /api/app-settings/features`. `PUT` replaces the whole object and rejects unknown keys and out-of-range numbers.

## Switches

### Cache-friendly prompt layout

Setting key: `cacheFriendlyPromptLayout`.

Applies to Claude (Subscription) and ChatGPT connections only. Other connections are never affected.

On:

- **Full lore.** Every enabled lorebook entry in the chat's scope is sent as one fixed `<lore>` block at the very start of the prompt, instead of the entries a keyword scan picks each turn. Keywords, decision statements, probability, timing, depth and the token budget do not select entries in this mode. Entries whose text holds macros, decision blocks included, change from turn to turn, so they are sent in a separate `<lore_dynamic>` block after it, near your message. The `<lore>` block is never trimmed to fit the context.
- **Per-turn blocks move.** Blocks that change every turn (recalled memories, the chat summary when no preset places it, cross-chat awareness, recent social activity) are sent next to your message instead of in the system prompt.
- On ChatGPT, only the `<lore>` block is sent as instructions, and requests for the same chat share a cache session (a `session-id` header and a `prompt_cache_key` derived from the chat id), so they reach the same cache.
- On Claude (Subscription), the fixed part goes before the Agent SDK's cache boundary and a cache marker is kept on the last finished reply, so the next turn reads the whole history from the cache.

A chat can keep the keyword lore scan with the chat metadata value `fullLorebookContext: false`.

Off: the keyword lore scan runs as before and the prompt is sent in the order it was assembled, byte for byte as without this switch.

### Stable lorebook picks

Setting key: `stableLorebookGroupPicks`. Environment variable: `LOREBOOK_STABLE_GROUP_WINNERS`.

On: a lorebook inclusion group keeps the same winner in a chat while its matching candidates stay the same. Other chats and other candidate sets can still pick differently.

Off: the winner is re-rolled on every generation.

### Retry failed provider calls

Setting key: `providerRetry`. Environment variable: `PROVIDER_RETRY_TRANSIENT_ERRORS`.

On: a refused or unreachable connection, or a gateway 502 or 503, is retried up to twice with a short jittered wait, and only before any text reached you. A 504 or a dropped connection is never retried. Not used when the connection has a fallback: the fallback is tried at once instead.

Off: only rate limits are retried, as before.

### Background call cap

Setting keys: `backgroundCallCap` and `backgroundCallsPerHour` (**Calls per hour**, 1 to 100000, default 600). Environment variable: `MARINARA_BACKGROUND_CALLS_PER_HOUR`.

On: automatic model calls that run without you are limited per rolling hour. They are the turns the server-side scheduler starts for autonomous messages, and any provider call made in background mode (automatic work that yields to your own requests). Once the hour is spent, they are refused locally, without sending a request, until the oldest call ages out. The server logs one warning when the cap is reached and one line when calls resume. Replies you ask for never count and are never refused.

Off: no cap.

### Keep generating when the tab is closed

Setting key: `generationJobTracking`.

On: gallery images, selfies and scene videos, scene backgrounds, character art drafts, sprite sheets and animated expressions keep running after the tab closes. Their status, a short log and the result are saved. When you come back, Marinara tells you which jobs finished while you were away. **Open generation jobs**, under the switch or in the Ctrl+K command palette, lists recent jobs with their status, a preview of the result and a **Stop** button for running ones. A server restart marks jobs that were still running as interrupted; they are not started again. Finished job records are kept for 7 days (at most 300).

Off: the gallery image, selfie and scene video generations stop when the tab closes, as before, and nothing is saved.

For developers: docs/development/generation-jobs.md.

### Minimize the console to the system tray

Setting key: `consoleTray`. Environment variable: `MARINARA_CONSOLE_TRAY`. Windows only.

On: while the server runs in a console window, a Marinara icon sits in the Windows system tray, and minimizing the console hides it from the taskbar. The icon's menu has **Open Marinara** (your browser at the server's address), **Show console** or **Hide console**, and **Quit Marinara**, which stops the server the same way Ctrl+C does. Double-clicking the icon shows or hides the console. In Windows Terminal the icon appears but the console is never hidden, because hiding could take other tabs with it. Turning the switch off restores a hidden console at once.

The icon is run by a small hidden Windows PowerShell 5.1 script, so PowerShell must be allowed to run it. If it cannot start, the server keeps running and logs one warning.

Off: no tray icon, and the console is left alone.

On Linux, macOS, Android and Docker the switch has no effect and is shown as unavailable.

## Precedence

1. **Environment variable.** When the switch's variable is set, it wins over the saved switch, both on and off, and Settings shows the switch locked with the variable's name. A blank variable counts as unset.
2. **Saved switch.** The value saved in Settings > Advanced > Features.
3. **Default.** Off, with the default numbers.

| Variable                             | Controls                                | Values                                                                        |
| ------------------------------------ | --------------------------------------- | ----------------------------------------------------------------------------- |
| `LOREBOOK_STABLE_GROUP_WINNERS`      | Stable lorebook picks                   | `true`, `1`, `yes` or `on` turn it on. Any other value turns it off.          |
| `PROVIDER_RETRY_TRANSIENT_ERRORS`    | Retry failed provider calls             | `true`, `1`, `yes` or `on` turn it on. Any other value turns it off.          |
| `MARINARA_BACKGROUND_CALLS_PER_HOUR` | Background call cap and Calls per hour  | A positive number sets the cap. `0`, `off`, `false` or `disabled` removes it. |
| `MARINARA_CONSOLE_TRAY`              | Minimize the console to the system tray | `true`, `1`, `yes` or `on` turn it on. Any other value turns it off.          |

Environment variables are read on every check, so a `.env` change applies without a restart.

## For developers

The registry is `packages/shared/src/schemas/feature-settings.schema.ts`: the switch names, their defaults and the number settings. Add a switch there, with its label and help text under `settings.features.<key>` in the English locale, and it appears in Settings. On the server, check it with `isFeatureEnabled("<key>")` from `packages/server/src/services/features/feature-settings.ts`. In the client, use `useFeatureEnabled("<key>")` from `packages/client/src/hooks/use-feature-settings.ts`.
