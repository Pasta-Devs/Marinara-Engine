# Feature Switches

Some server behaviours are optional. You turn them on in **Settings > Advanced > Features**. Every switch starts off, so a server where nobody opens this section behaves exactly as before.

A change applies straight away. You do not need to restart the server or reload the page.

## Overview

| Switch                          | Setting key                | Default | Environment variable              |
| ------------------------------- | -------------------------- | ------- | --------------------------------- |
| **Stable lorebook picks**       | `stableLorebookGroupPicks` | Off     | `LOREBOOK_STABLE_GROUP_WINNERS`   |
| **Retry failed provider calls** | `providerRetry`            | Off     | `PROVIDER_RETRY_TRANSIENT_ERRORS` |

Searching settings for `features` takes you to the section.

## Where the settings are stored

All switches are saved together in the `features` app setting, a JSON object of booleans. Only values that differ from the default are stored. A missing key, an empty object or an unreadable value all mean the default: every switch off.

The server keeps a copy in memory, so checking a switch costs nothing on busy paths such as provider calls and lorebook scans. Saving from Settings, or any other write to the `features` row, refreshes that copy at once.

The API is `GET` and `PUT /api/app-settings/features`. `PUT` replaces the whole object and rejects unknown keys and values that are not booleans.

## Switches

### Stable lorebook picks

Setting key: `stableLorebookGroupPicks`. Environment variable: `LOREBOOK_STABLE_GROUP_WINNERS`.

On: a lorebook inclusion group keeps the same winner in a chat while its matching candidates stay the same. Other chats and other candidate sets can still pick differently.

Off: the winner is re-rolled on every generation.

### Retry failed provider calls

Setting key: `providerRetry`. Environment variable: `PROVIDER_RETRY_TRANSIENT_ERRORS`.

On: a refused or unreachable connection, or a gateway 502 or 503, is retried up to twice with a short jittered wait, and only before any text reached you. A 504 or a dropped connection is never retried. Not used when the connection has a fallback: the fallback is tried at once instead.

Off: only rate limits are retried, as before.

## Precedence

1. **Environment variable.** When the switch's variable is set, it wins over the saved switch, both on and off, and Settings shows the switch locked with the variable's name. A blank variable counts as unset.
2. **Saved switch.** The value saved in Settings > Advanced > Features.
3. **Default.** Off.

| Variable                          | Controls                    | Values                                                               |
| --------------------------------- | --------------------------- | -------------------------------------------------------------------- |
| `LOREBOOK_STABLE_GROUP_WINNERS`   | Stable lorebook picks       | `true`, `1`, `yes` or `on` turn it on. Any other value turns it off. |
| `PROVIDER_RETRY_TRANSIENT_ERRORS` | Retry failed provider calls | `true`, `1`, `yes` or `on` turn it on. Any other value turns it off. |

Environment variables are read on every check, so a `.env` change applies without a restart.

## For developers

The registry is `packages/shared/src/schemas/feature-settings.schema.ts`: the switch names and their defaults. Add a switch there (in `FEATURE_SWITCH_NAMES`, `FEATURE_SWITCH_DEFAULTS` and `featureSettingsSchema`), give it a label and help text under `settings.features.<key>` in the English locale, and list it in `SERVER_SWITCHES` in `packages/client/src/components/panels/settings/FeatureSwitchesSettings.tsx` so it appears in Settings. On the server, check it with `isFeatureEnabled("<key>")` from `packages/server/src/services/features/feature-settings.ts`. In the client, use `useFeatureEnabled("<key>")` from `packages/client/src/hooks/use-feature-settings.ts`.
