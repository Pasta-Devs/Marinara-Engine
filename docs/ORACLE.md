# Oracle Agent — Web Search + Character Memory

Oracle lets a user trigger a live web search from inside a chat message,
injects the findings into the character's context so the character can reply
with fresh information, then distils the **character's takeaway** (preferences,
choices, opinions voiced) and stores that as a minimalist lorebook entry for
future chats.

It is not a factual encyclopedia feature. It is a roleplay-memory feature that
uses web search as raw material.

## At a glance

- **Trigger**: user writes `<search>topic</search>` anywhere in their message.
- **Provider**: Tavily (free tier, 1000 searches/month, no credit card).
- **Model used**: the chat's current LLM (no extra connection required).
- **Cost per search**: 1 Tavily call + 2 LLM calls (summariser + takeaway extractor). Total latency ~3-8s, non-blocking for the user response.
- **Persistence**: one short memory sentence per search **only when the character committed to something**. Nothing stored otherwise.

## Quick setup

1. Create a free Tavily key at [tavily.com](https://tavily.com).
2. In Marinara, open the **Connections** panel → expand the **Oracle (Web Search)** card.
3. Paste the key, toggle **On**, click **Test connection** to verify.
4. Open the **Agents** panel → enable the **Oracle** agent.
5. In a chat, send a message containing `<search>your topic</search>`. The tag is stripped before the character sees it.

Conversation-mode chats work out of the box — Oracle bypasses the chat's
`enableAgents` gate because it's user-triggered (see design notes below).

## End-to-end flow

```
┌────────────────────────────────────────────────────────────────────────┐
│   USER: "…<search>topic</search>…"                                     │
└───────────────────────────────┬────────────────────────────────────────┘
                                ▼
          ┌───────────────────────────────────────────┐
          │  extractSearchQueries()                    │
          │  - parses <search> tags                    │
          │  - strips tags from userMessage            │
          │  - synthesises a hook if message is empty  │
          └────────────────────┬──────────────────────┘
                               ▼
          ┌───────────────────────────────────────────┐
          │  Oracle resolution                         │
          │  1. resolvedAgents.find("oracle")          │
          │  2. FALLBACK: agentsStore.getByType(...)   │
          │     — bypass when chat.enableAgents=false  │
          └────────────────────┬──────────────────────┘
                               │ (agent ready + OracleConfig loaded)
                               ▼
          ┌───────────────────────────────────────────┐
          │  Tavily search                             │
          │  - search_depth: "advanced"                │
          │  - AbortSignal timeout (8s default)        │
          └────────────────────┬──────────────────────┘
                               │ (answer + up to maxResults passages)
                               ▼
          ┌───────────────────────────────────────────┐
          │  Summariser (executeAgent with STERILE ctx)│
          │  - recentMessages=[], persona=null,        │
          │    characters=[], mainResponse=null        │
          │  - strict anti-hallucination system prompt │
          │  - <source_material>, <search_query>,      │
          │    <source_urls>, <summary_token_cap>      │
          └────────────────────┬──────────────────────┘
                               │ (factual summary + Sources footer)
                               ▼
          ┌───────────────────────────────────────────┐
          │  Inject <web_search>…</web_search>         │
          │  onto the last user message in the prompt  │
          └────────────────────┬──────────────────────┘
                               ▼
          ╔═══════════════════════════════════════════╗
          ║          MAIN CHARACTER GENERATION         ║
          ║   (streams to user, uses <web_search>)    ║
          ╚════════════════════╤══════════════════════╝
                               │ (combinedResponse saved)
                               ▼
          ┌───────────────────────────────────────────┐
          │  Takeaway extractor                        │
          │  Inputs: findings (no footer), response,   │
          │          query, character name             │
          │  Output: one sentence OR "NO_MEMORY"       │
          └────────────────────┬──────────────────────┘
                               │
               ┌───────────────┴───────────────┐
               │                                │
           NO_MEMORY                    sentence produced
               │                                │
               ▼                                ▼
            (skip)           ┌──────────────────────────────────┐
                             │ Lorebook target resolution        │
                             │ 1. LK-configured target            │
                             │ 2. existing character-scoped book  │
                             │ 3. new character-scoped book       │
                             │ 4. fallback chat-scoped (create)   │
                             └───────────────┬──────────────────┘
                                             ▼
                             ┌──────────────────────────────────┐
                             │ persistLorebookKeeperUpdates()   │
                             │ content = takeaway sentence       │
                             │ keys    = proper-nouns + query    │
                             │ tag     = "web-research"          │
                             └──────────────────────────────────┘
```

## File map

| Path | Role |
| --- | --- |
| `packages/shared/src/types/oracle.ts` | `OracleConfig` Zod schema, shared constants (`ORACLE_SETTINGS_KEY`, `ORACLE_LOREBOOK_TAG`, providers list) |
| `packages/shared/src/constants/agent-prompts.ts` | Default system prompt for the summariser |
| `packages/shared/src/types/agent.ts` | `BUILT_IN_AGENTS` entry + `web_search` tool definition |
| `packages/server/src/services/agents/oracle.ts` | `executeOracle()` + `extractCharacterTakeaway()` + summary splitting + key extraction |
| `packages/server/src/services/agents/web-search/tavily-provider.ts` | Tavily HTTP wrapper |
| `packages/server/src/services/agents/web-search/web-search-provider.ts` | Provider interface (pluggable) |
| `packages/server/src/services/agents/web-search/web-search-provider-factory.ts` | Provider factory with exhaustiveness check |
| `packages/server/src/services/agents/web-search/config.ts` | Load/save `OracleConfig` with AES-256-GCM-encrypted key |
| `packages/server/src/routes/oracle.routes.ts` | `GET/PUT /api/oracle/config`, `POST /api/oracle/test` |
| `packages/server/src/services/conversation/character-commands.ts` | `extractSearchQueries()` helper |
| `packages/server/src/routes/generate.routes.ts` | Oracle integration (trigger extraction, bypass resolution, parallel execution, injection, post-gen persistence) |
| `packages/server/src/services/agents/agent-executor.ts` | Rendering of `<source_material>`, `<search_query>`, `<source_urls>`, `<summary_token_cap>` blocks |
| `packages/server/src/routes/generate/lorebook-keeper-utils.ts` | Extended `persistLorebookKeeperUpdates()` with optional `source` override |
| `packages/client/src/hooks/use-oracle.ts` | React Query hooks for config/test |
| `packages/client/src/components/panels/settings/OracleConfigCard.tsx` | Settings UI, mounted in `ConnectionsPanel.tsx` |

## Design decisions

### Why Oracle is a built-in agent, not a Custom Agent

Marinara already exposes two extension surfaces: **Custom Agents**
(user-defined entries in `agent_configs` with a free-form prompt template,
configurable phase, and optional tools) and **Custom Tools** (webhook /
static / script execution via `custom-tools.routes.ts`). On paper, Oracle
could be modeled as a Custom Agent calling a Custom Tool over a Tavily
webhook.

In practice, Oracle relies on hooks the current Custom Agent system
doesn't expose:

1. **Message preprocessing** — extracting `<search>` tags from the user
   message *before* it is saved or sent to the main LLM. Custom Agents
   only see the message after it lands.
2. **User-triggered bypass of `enableAgents`** — Oracle must run in
   conversation mode where `enableAgents` is hidden and defaults to
   `false`. Custom Agents are bound by that flag.
3. **Encrypted global config with masking** — Oracle stores a provider
   API key in `app_settings` with the same AES helper used for
   connection keys, and the UI shows a mask. Custom Tool webhooks store
   credentials too, but without the encryption + masking pattern.
4. **Post-generation lorebook persistence with takeaway extraction** —
   the second LLM call distils the *character's commitment*, not the
   raw findings. There's no generic post-gen hook agents can register.
5. **Sterile execution context** — Oracle's summariser deliberately drops
   `recentMessages`, `persona`, `characters`. Custom Agents inherit the
   chat context wholesale.

Abstracting those hooks into the Custom Agent surface is a worthwhile
refactor for the future (a second built-in agent that shares 2+ of these
hooks would justify it), but doing it inside this PR would multiply the
diff and the review surface. Oracle ships as a built-in for the MVP.

### Why pre_generation phase

The flow is search → inject → character replies. The character must see the
findings **before** producing output, so Oracle cannot run post-gen or parallel.
`pre_generation` is the correct phase and matches the existing
`knowledge-retrieval` agent's pattern.

### Why explicit `<search>` trigger instead of auto-detection

An auto-detect classifier (small LLM scanning each user message for
"information gaps") would:
- Cost an extra LLM call on every turn
- Trigger false positives on fantasy/fiction topics
- Burn user trust when it fires unexpectedly

Explicit `<search>` is deterministic, free, and user-controlled. Auto-detection
is deferred to a future phase behind an opt-in toggle.

### Why `<search>` tags instead of a `/web_search` slash command

Marinara already has a slash-command system (`packages/client/src/lib/slash-commands.ts`)
with `/roll`, `/sys`, `/narrator`, `/scene`, etc. A `/web_search query --save`
command would be a coherent fit and would offer:

- Discoverability via `/help` and autocomplete.
- Clean per-call flag overrides (`--no-save`, `--max=5`).
- Loud failure on typos (`/web_serch` errors immediately).

The reason we picked the inline tag is that Oracle is not a one-shot
utility ("give me info"); it is a **turn augmenter** ("let the
character reply to *this* message *with* this info in hand"). With a
slash command the natural flow becomes:

    User:  /web_search films this week
    System: [results displayed]
    User:  Which one do you want to see?
    Char:  ???  ← where do the findings live in the character's context?

Either you re-inject the findings retroactively into the next user
message (which is what `<search>` already does, in two steps instead of
one), or you generate a filler reply, or you ask the user to copy-paste.
None is as clean as fusing the search into the message that *prompts*
the character to use it:

    User:  Which one do you want to see? <search>films this week</search>
           ↓ server strip + inline injection + main LLM call
    Char:  The new Dune looks solid, want to try the 8pm showing?

Both surfaces can coexist: a `/web_search` command calling the same
`executeOracle()` backend would be a small follow-up for users who only
want the lookup utility outside an in-character message.

### Why Tavily as the default provider

Tavily is designed for LLM agents: it returns pre-cleaned text extracts plus a
synthesized `answer` field, dramatically reducing token bloat compared to raw
HTML scraping. Its free tier (1000/month, no credit card) is generous for
roleplay usage. The code is abstracted behind `WebSearchProvider` so Serper,
Brave, or a local SearXNG can be added without touching the caller.

### Why the summariser uses a STERILE context

The summariser call inherits the chat's LLM — usually a roleplay-tuned model
like Gemma. When we passed the full chat context (recent messages, persona,
characters), the model kept continuing the roleplay instead of extracting
facts. First run produced: *"ok ok je vais aller voir ça direct ! 🏃‍♀️💨 je veux
trop savoir qui est la plus stylée lol"* — roleplay, not a summary.

Fix: the summariser receives a context with `recentMessages=[]`,
`persona=null`, `characters=[]`, `mainResponse=null`, `chatSummary=null`. Only
the source material and the strict anti-hallucination prompt. Result: neutral
factual prose.

### Why the summary is split into body + Sources footer

The same summary serves two lifecycles:

- **In-turn injection** (ephemeral) — keeps the `Sources:` footer so you can
  trace provenance while debugging the current response.
- **Lorebook persistence** (long-term) — strips the footer. URLs in a memory
  entry pollute the character's context when the entry re-activates later.

### Why the takeaway extractor instead of persisting raw facts

A memory is not an encyclopedia clip. If the user searches for "quintuplets"
and Mari replies *"I really like Nino, tsundere energy"*, the useful memory is
*"Mari picked Nino as her favorite."* — not the full list of sisters with
Wikipedia URLs.

The takeaway extractor runs **after** the character generates its reply. It
reads: the character's response, the factual findings, the original query. It
outputs one short sentence in third-person past tense describing what the
character personally committed to — or `NO_MEMORY` when the character only
acknowledged the information without voicing a preference. Only genuine
commitments end up in the lorebook.

This is the core design intent: maximise roleplay continuity, not
factual recall.

### Why the lorebook is character-scoped (not chat-scoped)

Memories should persist across conversations with the same character. A
chat-scoped lorebook loses everything when the user opens a fresh chat. So:

- Single-character chat → create/reuse a character-scoped lorebook named
  `Oracle knowledge (<character name>)` with `sourceAgentId: "oracle"`.
- Multi-character or zero-character chats → fall back to chat-scoped
  auto-creation (conservative, avoids cross-contamination).

Future Oracle runs with the same character reuse that one lorebook, so entries
accumulate instead of spawning a new book per turn.

### Why Oracle entries are persisted as `constant: true`

Lorebook entries normally activate by matching keywords against the recent
chat. That model breaks for conversational recall: when the user asks
*"which film were we going to see again?"* a week after the search, the
message contains none of the original entity names (`Wicked`, `Avatar 3`)
and the entry never fires — the character forgets.

Oracle entries are written with `constant: true`, which makes them
always-on: whenever the character's lorebook is in scope, every takeaway
the character has accumulated is injected, no keyword matching required.
This is safe because the entries are already character-scoped — they only
ever appear in chats with that specific character, never bleeding into
other roleplays.

The trade-off is context size: each takeaway is a single short sentence
(~30-40 tokens), so 30 entries adds roughly 1k tokens of permanent context.
Acceptable on modern model windows; if it becomes a problem in practice,
the user can prune entries from the lorebook panel, and a future iteration
could cap the count to the N most recent automatically.

### Why Oracle bypasses the chat's `enableAgents` gate

In conversation mode, Marinara's settings drawer hides the "Enable Agents"
toggle entirely. That toggle is per-chat and defaults to `false`, meaning no
agent — including Oracle — runs in conversation chats. The toggle is hidden
because traditional agents (world-state, character-tracker, VN expressions) are
irrelevant in conversation mode.

Oracle is different: it's user-triggered via an explicit tag that can only
come from the user's own message. Letting it run without an enable toggle
preserves the "no silent magic" principle — the user literally has to type
`<search>` to get a search.

Implementation: `generate.routes.ts` falls back to
`agentsStore.getByType("oracle")` when `resolvedAgents` doesn't contain it,
and reuses the same connection-resolution priority chain the normal pipeline
uses.

### Why two LLM calls per search (summariser + takeaway)

Folding both steps into a single structured-output call would complicate
streaming and coupling. Two focused calls with clean system prompts are more
robust to small quantized models like Gemma-4-26b. Total latency is ~3-8s and
the takeaway extractor runs **after** the user-visible response, so the user
never waits on it.

### Why the summariser produces lorebook keys, not a server-side regex

Lorebook entries activate by matching keywords against the chat. The shape of
those keywords decides whether the entry helps or pollutes:

- A key too generic (`The`, `She`, `Five`) fires on almost every future
  message and drowns the character's context in stale web findings.
- A key too long or too specific (the raw search query, or a fully qualified
  proper noun like `Ichika Nakano`) almost never matches a natural chat
  message and the entry effectively never activates.

A previous iteration extracted keys with a regex over capitalised words. It
produced both failure modes — sentence-start artefacts (`The`, `While`,
`Five`, broken fragments like `Man Band` from hyphenated compounds) on the
generic side, the verbatim search query on the over-specific side. The regex
was also English-biased, which clashes with Marinara's multilingual posture.

The summariser now emits a `Keys:` line right before its `Sources:` footer,
constrained by the prompt to produce **canonical short forms** — given names
alone when unambiguous in the work (`Ichika`, not `Ichika Nakano`), short
canonical titles for works/places/organisations (`The Quintessential
Quintuplets`, not `The Quintessential Quintuplets manga series`), and 3 to 6
entities total:

    [factual paragraphs]

    Keys: Ichika, Nino, Miku, Yotsuba, Itsuki, The Quintessential Quintuplets

    Sources:
    - https://…

The server parses that line into the persisted key list, then strips the
`Keys:` line out before the summary is injected into the character's prompt —
so the character sees the facts and the sources, never the internal metadata.
The model picks the keys with full semantic context (it knows what's a name
and what's just a sentence-start capital), which is robust across languages
without any server-side stop list.

If the model omits or mangles the `Keys:` block (small quantized models
sometimes do), the server falls back to the raw search query as the sole key.
That key rarely matches naturally, but at least the entry exists and the
user can edit its keys from the lorebook panel — degraded, not broken.

## Configuration reference

| Field | Default | Range | Purpose |
| --- | --- | --- | --- |
| `enabled` | `false` | bool | Master toggle for the Oracle feature |
| `provider` | `tavily` | enum | Web search provider (only `tavily` in MVP) |
| `apiKey` | `""` | string | Provider API key, encrypted at rest (AES-256-GCM) |
| `maxResults` | `3` | 1–10 | How many search results Tavily returns per query |
| `summaryTokenCap` | `400` | 100–2000 | Upper bound on the summariser's output length |
| `timeoutMs` | `8000` | 2000–30000 | Fetch timeout; on expiry, generation proceeds with an empty injection |
| `autoPersist` | `true` | bool | Run the takeaway extractor and persist commitments to the lorebook |

Configuration is stored as JSON under the `oracle` key of the `appSettings`
table. The API key is encrypted at rest by the same project-wide helper used
for TTS and connection keys.

## Trigger syntax

| Message text | Behaviour |
| --- | --- |
| `Hi! <search>tallest building in Tokyo</search> What do you think?` | Tag is stripped; user message becomes `"Hi! What do you think?"`; Tavily runs; findings appended as `<web_search>…</web_search>` onto that user message |
| `<search>tallest building in Tokyo</search>` (tag alone) | Stripped user content is empty → no user bubble saved to chat history. The LLM prompt gets a synthetic ephemeral user message carrying the query as `<user_intent query="…">` plus the `<web_search>` block, so the character still has an anchor. Nothing about this synthetic message leaks back into the DB |
| `Multiple <search>A</search> queries <search>B</search> in one message` | Only the first query runs in MVP (both are detected; additional queries are logged but skipped to bound latency and token cost) |
| No `<search>` tag | Oracle does nothing |

## Failure modes & what happens

| Scenario | Behaviour |
| --- | --- |
| Oracle agent not created in `Agents` panel | Search silently skipped, no log noise |
| `enabled=false` or no API key | Log: *"Agent enabled but config missing — skipping"*, generation proceeds normally |
| Tavily returns 0 results | Empty injection, character replies without web context |
| Tavily timeout | Log warning, empty injection, generation proceeds |
| Summariser returns `"No relevant information found."` | Injection empty, persistence skipped |
| Summariser returns empty text | Persistence skipped (not informative) |
| Character made no durable commitment | Takeaway returns `NO_MEMORY`, persistence skipped |
| Lorebook creation fails | Log: *"Persist FAILED — targetLorebookId returned null"*, generation unaffected |

## SSE events seen by the client

During the search, the server emits:

- `agent_start` with `agentType: "oracle"` — UI can show a "searching the web..." indicator.
- `agent_result` with `agentType: "oracle"`, `resultType: "context_injection"`, `data: { text: <summary with Sources footer> }` — UI can render sources attribution alongside the response.

The current client renders these via the generic `use-generate.ts` handler.

## Extending with a new provider

1. Add the provider identifier to `ORACLE_PROVIDERS` in `packages/shared/src/types/oracle.ts`.
2. Create `packages/server/src/services/agents/web-search/<name>-provider.ts` implementing `WebSearchProvider`.
3. Add a branch in `getWebSearchProvider()` (the exhaustiveness check will fail to compile until you do).
4. Add the provider to the dropdown in `OracleConfigCard.tsx`.

No changes needed to the call site in `generate.routes.ts`.

## Known limitations

- **Single query per turn** — the MVP processes only the first `<search>` tag per user message. Multi-query support would multiply Tavily calls and is deferred.
- **Context stripping in the summariser is a hard override** — if you ever want Oracle to know the roleplay context (e.g. to filter web results by relevance to the character's personality), you'll need to reintroduce a curated subset. Right now it's all-or-nothing neutral.
- **Multi-character chats fall back to chat-scope** — no heuristic picks one character when several are involved. A user-selectable "primary character for Oracle memories" setting would solve this.
- **No deduplication across turns** — if the user re-runs the same `<search>`, Oracle re-fetches Tavily and re-runs the summariser. A 24h cache keyed by `(chatId, query)` would cut cost; not implemented because roleplay is low-volume.
- **The takeaway extractor uses the same LLM as the main response** — on a quantized 26B model it's fine; on a tiny 3B model the takeaway quality degrades. Users can override Oracle's connection to a more capable model via the Agents panel.

## Future work

Candidate improvements, roughly ordered by user value:

1. **Auto-detection mode** behind a toggle — small-model classifier that decides when a search is warranted, plus a "confirm before searching" UI prompt.
2. **SearXNG adapter** — zero-cost self-hosted provider for users who don't want commercial API dependencies.
3. **DuckDuckGo Instant Answer adapter** — free, no key; limited to encyclopedic queries but useful as a fallback.
4. **Multi-query support** — fan out concurrently, merge summaries, produce a single takeaway.
5. **Vector memory integration** — push takeaways into `memory-recall.ts` for semantic recall instead of keyword matching.
6. **Search-history panel** — UI listing of past Oracle runs per character, with the ability to pin / edit / delete individual takeaways.
