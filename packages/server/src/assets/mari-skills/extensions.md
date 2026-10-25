---
name: Personal Extensions
description: Read before drafting, editing or reviewing a personal extension — its manifest and contributions, the capabilities it may declare, and the code hash the user reviews.
---

# Personal Extensions

Purpose: build or repair a personal extension — code Marinara runs in a sandboxed browser worker or server sandbox. Every draft stays disabled until the user alone approves its exact code hash in Settings → Addons → Personal Extensions.

Actions: reads `personal_extension.list|get|search`; writes `create|update`. No approve, enable, disable, delete, rollback or export action exists — an unknown sub-action returns `Unknown personal extension action "<name>".` and the valid ones: `list`, `get`, `search`, `create`, `update`.

## Write contract

- **Only extensions you drafted can be edited.** `update` refuses a record whose `source` is not `professor_mari` with `personal_extension.update edits only extensions Professor Mari drafted; "<id>" is an External Extension. Nothing was changed. …`: do not retry it. External rows live under Settings → Addons → **External** Extensions; point the user there.
- Creates apply unless `apply: false`; **updates need `apply: true`**: without `apply` they are refused, and `apply: false` is a preview that renders nothing to the user. Always send `apply: true`.
- An update merges the fields you send (`textOrFallback`); it does not need the whole payload. Never send an elision marker back as code: after an elided `get`, request the real field first (`field: "js"`) and edit that. `description: null` is a Zod failure, not a clear.
- `readBack` gives `status` (`"verified"`/`"mismatch"`/`"unavailable"`) and `checkedRows` — it proves the write, not the hash. On `mismatch` it carries the intended and persisted values.
- Silently dropped: `data.id`, `data.enabled`, `data.source`, `data.approvedHash`, `data.reason`. Take the id from the envelope: 64 characters of `[A-Za-z0-9_-]` (no dot). `app_data` does not pattern-check it, so a dotted id is stored and listed but 404s when the user approves — an unapprovable draft.
- Changing `runtime` must carry the new runtime's code: `server` nulls `css`/`js`, `client` nulls `serverJs`.
- Every write carries a one-sentence `reason`; without one the card falls back to `Professor Mari created a Personal Extension draft` or `Professor Mari updated a Personal Extension draft`.

## Workflow

1. Pick the runtime: browser (`"client"`, `css` or `js`) or server (`"server"`, non-empty `serverJs`, no capabilities). A server extension needs a working OS sandbox: approval returns 503 on Windows, Android and default Docker, so check before planning one.
2. Design the UI first: kind, id, label, panel elements. A button activates code; only a panel holds controls.
3. Create the whole payload in one call, id in the envelope. `name` is not unique-checked; a duplicate quietly makes a second draft.
   When the output limit is small (your workspace rules say so, or a reply was cut at it) and a browser extension has both `css` and `js`: create with one, then send the other in an update (it merges), one per reply. `serverJs` cannot be split.
4. `get` it: `contentHash`, `approvedHash: null`, `enabled: "false"`, `source: "professor_mari"`, `revisions: []`; request an elided `js`/`css` before describing code.
5. Quote the hash and capabilities; the draft runs only after "Review and run", then "Run Exact Code". Later edits: `apply: true`, `get`, and state whether the hash moved.

## The manifest

Browser payload: `name` 1–200; `version` ≤64 or a number; `description` ≤2 000; `runtime` `"client"` (default) or `"server"`; `capabilities`; `css` ≤262 144 UTF-8 bytes; `js`. Server drafts need `serverJs` and no capabilities; browser drafts need `css` or `js`.

`registerContribution` kinds: `button`, `menu-item`, `panel`, `command`. Fields: `id` 1–64 of `[A-Za-z0-9._-]`, unique; `label` 1–80; `description` ≤240; `icon` kebab-case ≤64; `surface`; `position`; `elements`; `targetContributionId`.

- `surface`/`position` are button-only. A top-bar button omits both; a `position` there throws `top-bar contributions do not accept a position`. Side-panel surfaces: `chats`, `bots`, `characters`, `personas`, `lorebooks`, `presets`, `connections`, `agents`, `settings`; `position` may be omitted and defaults to `header` (`before-content`, `after-content` are the others).
- Panel elements: `heading`, `text`, `pre`, `button`, `input`, `select`, `toggle`, `slider`, `color`, `spacer`. A `command` activates a same-revision non-command contribution named by `targetContributionId` (not its own `id`), with no callbacks; if that target is not registered, the command never appears and the worker only logs a warning.
- Over a hard limit, the worker throws (`too many extension contributions`, `contribution text exceeds its limit`) and the UI never appears; the 8 000-character text cap silently clamps instead. Limits: 24 contributions, 60 panel elements, 32 000 characters of panel text with 8 000 per text or input, 100 select options.

## Capabilities and what is impossible

Legal names: `read_active_characters`, `read_active_persona`, `full_page_access`; only the two read ones are usable. Without one `marinara.context` still exposes `chatId`, `characterId` (single-Character chats only) and `characterIds`, plus private storage, `log`, timers, `onCleanup` and the host-rendered UI. `read_active_characters` adds `characters[]` for the active chat's cards, allowlisted fields only, at 32 000 characters per field, 256 000 total, 100 tags; `read_active_persona` adds `persona` and `personaId`. An undeclared capability yields `characters: []`, `persona: null`, `personaId: null` — empty values, not an error.

**Never declare `full_page_access`.** `create` and `update` refuse it and write nothing; an existing draft that still carries it must be updated with `capabilities` that leave it out. An extension that needs it is not a personal extension.

**The surface is host-rendered descriptors plus declared reads.** Approval and enable belong to the user's review screen; the host draws every element with `textContent`, and panel clicks arrive as `{contributionId, elementId, values}` strings through `onEvent` (`onActivate` covers `button`, `menu-item`, `panel`). An extension that needs the DOM, the network or direct app data is not a personal extension.

## The hash the user reviews

`contentHash` is `sha256:` over `["client", css, js, "", capabilities]` or `["server", "", "", serverJs]`, the array appended only when the normalized list is non-empty. It covers `runtime`, `css`, `js`, `serverJs` and normalized `capabilities` — not `name`, `description`, `version`.

- A rename, re-description or version bump leaves the hash: the approval stands.
- A code edit, `runtime` switch or capability change moves it: `enabled: "false"`, `approvedHash: null`, old executable into `revisions` (max 10). Removing the last capability counts; reordering or repeating one does not.
- Capabilities normalize to canonical order, unknown names dropped: `["READ_ACTIVE_CHARACTERS"]` requests nothing and hashes differently than you meant.
- Reads print within a 24 000-character budget, so large `js`/`css` arrives as `[elided N chars — read this field with app_data { field: "js" }]`; request it. `contentHash` is never elided.
- Review surface: Settings → Addons → Personal Extensions; button "Review and run"; dialog "Run Personal Browser Code?", "Run Trusted Server Code?" or "Run Code With Full Page Access?"; confirm "Run Exact Code"; heading "Requested access".

## Errors and fixes

| Message                                                                                                                                                                                     | Fix                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `No personal extension has the id "<id>". …`                                                                                                                                                | No such row — `list`, then `create`.                                        |
| `A personal_extensions row with id "…" already exists; a create cannot overwrite it. Use an update instead.`                                                                                | The id is taken; pick another, or `update` that row.                        |
| `personal_extension.update needs a code or metadata patch`                                                                                                                                  | Send at least one code or metadata field; a misspelled one counts as empty. |
| `Personal Extensions cannot request "full_page_access"; only External Extensions can. Nothing was changed. …`                                                                               | Resend `capabilities` without it.                                           |
| `Professor Mari can save Personal Extension drafts but cannot approve or enable them.`                                                                                                      | A raw DB write touched `enabled`/`approvedHash`.                            |
| `Server personal extensions require server JavaScript` / `Server personal extensions cannot request browser context capabilities` / `Browser personal extensions require CSS or JavaScript` | Fix the runtime payload and resend it whole.                                |
| `Extension content changed before approval. Review the current code and try again.`                                                                                                         | Quote the new `contentHash`; the user reviews again.                        |

## Worked example

One call per line, ids pinned: create, prove the hash, keep it with a description edit, then invalidate it.

```
{"action":"personal_extension.create","id":"mari-weather-glow","data":{"name":"Weather Glow","version":"1.0.0","description":"Pins a small host-rendered weather panel that remembers whether the user applied it.","runtime":"client","capabilities":["read_active_characters"],"css":"[data-ext-root]{font-size:15px;}","js":"const panel=marinara.ui.registerContribution({id:\"weather-glow-panel\",kind:\"panel\",label:\"Weather glow\",icon:\"sparkles\",elements:[{kind:\"heading\",text:\"Glow\"},{kind:\"button\",id:\"apply\",label:\"Apply\"}],onEvent:async({elementId})=>{if(elementId!==\"apply\")return;await marinara.storage.patch({applied:true});}});marinara.onCleanup(()=>panel.remove());"},"apply":true,"reason":"Adds the weather panel the user asked for as a disabled draft they can review."}
{"action":"personal_extension.get","id":"mari-weather-glow"}
{"action":"personal_extension.update","id":"mari-weather-glow","patch":{"description":"Pins a small host-rendered weather panel. Editing this line does not invalidate the approval."},"apply":true,"reason":"Clarifies what the draft does."}
{"action":"personal_extension.get","id":"mari-weather-glow"}
{"action":"personal_extension.update","id":"mari-weather-glow","patch":{"css":"[data-ext-root]{font-size:16px;}"},"apply":true,"reason":"Makes the panel text easier to read."}
{"action":"personal_extension.get","id":"mari-weather-glow"}
```

The create reads back `contentHash: "sha256:677e787ceec71951f8e9fd14182ad7b3bc877b55cf0485b84948073de6242533"`, `approvedHash: null`, `enabled: "false"`, `source: "professor_mari"`, `capabilities: ["read_active_characters"]`, `revisions: []`. The description edit leaves the hash; the `css` edit moves it, clears approval and pushes the old executable into `revisions` — quote the new hash and say the user must review again.

## Where the detail lives

`docs_read` takes one heading per call: `docs/extending/personal-extensions.md` — `Review and enable`, `Add a Marinara-rendered panel`; `docs/extending/writing-personal-extensions.md` — `Browser API reference`, `Context capabilities`, `Validation limits`. The security invariants are in a developer page `docs_read` does not open.
