# Roleplay Mode — Getting Started

Roleplay Mode is one of Marinara Engine's chat modes, alongside Conversation, Visual Novel, and Game. It sits between **Conversation** (lightweight DMs, no scene chrome) and **Game** Mode (structured RPG with party, combat, world-gen). Roleplay gives you immersive scene presentation — character sprites with expressions, backgrounds, weather effects, a heads-up display tracking time and location and inventory — without the full RPG mechanics layer.

This guide is a getting-started reference. It covers what Roleplay Mode does, how to set up a roleplay, what you see in the UI, how scenes work, how sprite expressions are picked, how connected chats integrate, and what models and parameters tend to fit well.

**What this guide does not cover:** combat encounter mechanics, scene fork semantics in detail, the specifics of authoring a character card with expression sprites, or low-level prompt-override authoring. Ask in the Marinara Discord (or open a GitHub issue) for help with those.

## When to pick Roleplay Mode

Use Roleplay Mode when:

- You want **immersive scene presentation** — sprites, backgrounds, weather, time-of-day display.
- You want **persistent world state** — the engine tracks date, time, location, weather, present characters, inventory, and quests across turns.
- You want **character expression sprites** that change with the emotional tone of each turn.
- You want a **scene system** — branchable, forkable RPG scenes with their own context.
- You're not ready for the structured RPG mechanics of Game Mode (party-driven combat, world-gen JSON, dice/encounter system) but want more than DM-style chat.

Pick **Conversation** instead if you just want chat without scene chrome. Pick **Game Mode** if you want full RPG structure with party, combat, and a world-gen-driven story arc.

## Setting up a roleplay

Roleplay uses a five-step setup wizard. The connection is required; the roleplay name is optional and can be left blank if you want Marinara to use the default:

1. **Name & Connection** — optionally name the roleplay and choose the required AI connection.
2. **Pick a Preset** — saved prompt-stack template. Default works for most cases.
3. **Persona & Characters** — choose the character you play and who joins the scene.
4. **Attach Lorebooks** — optional world facts and lore-specific context.
5. **Enable Agents** — optional trackers, prose polish, knowledge retrieval, and other helpers. Agents can be added or removed later.

Roleplay benefits from an **image-generation connection** more than Conversation does because of the sprite and background system, but it isn't required — the mode degrades gracefully to text-only when image gen isn't available (the sprite slots stay empty, backgrounds render as solid color, the HUD still works). See [Image generation](#image-generation) below.

## What the UI shows

Roleplay's interface is significantly richer than Conversation's. Visible elements:

- **Background image** — a crossfading scene background behind the message column. Selected per turn by the **Background agent** from your asset library.
- **Sprite slots** — character sprites rendered in default positions or free-placement mode. There is no fixed three-sprite cap; every sprite-enabled character in the chat can appear.
- **Roleplay HUD** — heads-up display widgets along the top or side showing current world state.
- **Weather overlay** — particle effects (rain, snow, fog, etc.) when the world-state agent infers weather from narrative.
- **Agents menu** — the sparkle / agent activity menu for agent thoughts, retries, troubleshooting tabs, and optional hidden story guidance.
- **Echo chamber panel** — simulated chat reactions from a fictional audience, like a Twitch-style chat (optional, agent-driven).
- **Durable info panels** — toolbar buttons opening Summary, Active Context (active lorebook entries), and Author's Notes panels.

If you're coming from Conversation Mode, the visible difference is the entire scene chrome: backgrounds, sprites, the HUD strip, and the weather layer.

### The Roleplay HUD

The HUD displays compact widgets, one per enabled tracker agent. The widgets the engine knows about by default include:

- **Date / Time** — when the scene takes place (e.g. `Day 3, 14:30`)
- **Location** — where the scene takes place
- **Weather** — current weather, including temperature
- **Present characters** — who's in the scene right now
- **Inventory** — items the persona is carrying
- **Quests** — active and completed quests
- **Player stats** — persona-level stats (HP, mana, custom)
- **Custom trackers** — user-definable widgets from a custom-tracker agent

Each widget has a popover panel for inline editing. You can manually re-run a single tracker if a value drifts wrong. Per-chat agent config can override the global defaults — for example, you can disable inventory tracking in a specific roleplay if you don't want it.

The widgets are **populated by the World-State agent** (a default for Roleplay), which reads each turn's narrative and extracts structured fields. The agent isn't a separate prompt to the user — it runs automatically alongside the main response.

## Impersonating your persona

Use `/impersonate [direction]` when you want Marinara to draft the next message as **your persona**. This is useful when you know what your character is trying to do, but want the model to help phrase it in the current scene voice.

Open the chat settings drawer's **Impersonate** section to configure the workflow:

- **Prompt Template** — global instructions for how impersonation should write. Empty means the chat-specific prompt or built-in default is used.
- **Preset** — optionally use a specific prompt preset for impersonation instead of the chat's preset.
- **Connection** — optionally route impersonation to a different model/provider.
- **Quick replies** — to get a one-click impersonate button beside Send, enable **Settings -> Advanced -> Message Tools -> Quick replies** and include the Impersonate action.
- **Use CYOA as direction** — clicking a CYOA choice can feed it to impersonation as guidance instead of sending it as a normal user message.
- **Agent pipeline** — skip agents during impersonation when you want a fast draft that does not update trackers, lorebook routers, or world state.

You can also set a per-chat prompt with `/impersonate_prompt "your prompt"` and reset it with `/impersonate_prompt reset`.

## The Agents menu

The Agents menu is the small activity menu in the Roleplay HUD. By default it shows **Activity**: agent thought bubbles, custom agent outputs, failed-agent retry actions, tracker re-run actions, and Echo Chamber controls when those features are active.

Some troubleshooting tools are opt-in so they don't clutter the normal roleplay view:

- **Injections tab** — appears while **Settings -> Advanced -> Debug mode** is on.
- **Secret Plot editing** — lives on the Narrative Director card in **Chat Settings -> Agents**, not in the HUD menu.

The **Injections tab** shows cached prompt injections saved on the latest assistant message. These are snippets that writer-style agents added before the reply was generated, such as Prose Guardian, Narrative Director, knowledge retrieval, knowledge router, or custom prompt-section agents. You can inspect, edit, save, or re-run eligible cached injections.

Narrative Director is one-shot for visible scene direction: arm the **Push Story** button above the chat input, and the Director generates guidance for the next reply only. When the Director is active, the Injections tab shows a note reminding you of this. Secret Plot has its own run interval on the Narrative Director card in Chat Settings.

The important part: edits in the Injections tab don't change the already-visible message by themselves, nor do they carry over to the next assistant message. They're used when you regenerate that same assistant message. Re-running a cached injection also targets that same assistant message, using the transcript slice and tracker snapshot from the original generation rather than the newest chat turn. This keeps regeneration reproducible: you're changing the guidance that fed that reply, not asking the current chat state to invent a new unrelated direction.

Knowledge Retrieval and Knowledge Router cached injections can be viewed but not re-run from this tab because they depend on their own retrieval/routing paths. Custom agents with **Add as Prompt Section** enabled appear below the cached injections so you can inspect and edit their latest saved prompt-section output too.

<a id="secret-plot-driver"></a>

## Narrative Director Secret Plot

Secret Plot is an optional hidden-story mode inside Narrative Director. It maintains private plot memory for one roleplay chat: a long-term **arc memory** plus short-term **scene directions** that can be injected before replies. This is different from visible summaries or lorebook entries. It's meant to steer pacing, reveals, and long-term tension without printing the plan directly in the chat.

Enable it under **Chat Settings -> Agents -> Narrative Director -> Secret Plot**. Set the **Run Interval** to control how many assistant messages pass between hidden-arc updates, then expand the **Secret plot** panel. Behind **Reveal spoilers**, you can edit:

- **Arc description** — the hidden long-term plot structure.
- **Protagonist arc** — where the user's character is being steered.
- **Character arc** — where the main character's arc is being steered.
- **Completed** — marks the hidden arc done.

Use **Regenerate** when you want the model to replace the hidden arc; it asks for confirmation before overwriting. Saving edits writes directly to the agent memory used during generation. Removing Narrative Director from the chat deletes that chat's hidden plot memory for the agent. A plain memory reset preserves it.

## Sprite expressions

Each character can have a **sprite library** with expressions for different emotions. The default expression set includes:

`neutral`, `happy`, `sad`, `angry`, `surprised`, `scared`, `embarrassed`, `love`, `thinking`, `laughing`, `worried`, `disgusted`, `smirk`, `crying`, `determined`, `hurt`

Which expression appears for each turn is decided by a **two-tier system**:

1. **Expression agent** (a Roleplay default) — reads the message and emits structured output naming the right expression for each visible character.
2. **Keyword fallback** — if the agent fails or returns nothing, a regex pattern matcher scans the message text for emotional keywords (e.g. `angry|furious` triggers the `angry` sprite). This means sprite changes still work even on weaker models that can't reliably run the expression agent.

If you swipe to an alternate response, the sprite expressions saved from that swipe are restored — expressions are persisted per-message.

**Sprites are not required.** Without an image-generation connection or an uploaded sprite library, the sprite slots simply render empty. The expression agent still runs (cheap), but its output has no visual effect.

## Scenes

A **scene** in Roleplay is a forked chat with `sceneStatus = "active"` in metadata. Scenes let you branch off from a main roleplay to explore a side path, a flashback, a separate location, or anything else, while keeping the main thread intact.

Key behaviors:

- **Scenes are self-contained.** They do NOT auto-pull context from a connected Conversation, even if the parent roleplay does. This keeps scenes focused on their own narrative.
- **Scenes can be created** mid-roleplay via the scene-creation API/UI. Fork modes include forking from the current message, branching from a prior message, or continuing as a new scene.
- **Scenes are concluded or abandoned** explicitly when you're done — the engine tracks their status. After conclusion, the parent roleplay continues from where you left it before the scene was forked.

The scene system enables narrative branching without losing the canonical thread.

## Connected chats

Roleplay sits on the **manual-bridge side** of the connected-chats asymmetry. If you connect a Roleplay chat to a Conversation, the Conversation auto-pulls recent Roleplay context so the DM character knows what is happening in the story. The Roleplay prompt does not automatically pull ordinary DM messages.

- **Pending `<influence>` tags** from the connected Conversation are pulled into Roleplay once and consumed as one-shot steers.
- **Durable `<note>` tags** from the connected Conversation are pulled into Roleplay on every turn until you clear them.

In the other direction, the Roleplay character can break the fourth wall back to the connected Conversation by wrapping text in `<ooc>...</ooc>` tags — the engine extracts these and posts them to the linked DM.

The full mechanics — including why the asymmetry exists and how to use influence vs. note tags — are in the FAQ:

- [Why doesn't my roleplay character remember the messages from our connected conversation?](FAQ.md#why-doesnt-my-roleplay-character-remember-the-messages-from-our-connected-conversation)

(Note: scene chats — forked from a roleplay — do NOT pull connected-conversation context, regardless of the parent roleplay's connection. Scenes stay self-contained.)

## Recommended models

Roleplay sits between Conversation (forgiving) and Game Mode (demanding) in model needs. The main demands come from:

- **The chat connection** — needs to write coherent character prose with persistent voice across long scenes.
- **The agent connections** — World-State, Expression, and the Background agent each run small structured-output calls per turn. They tolerate weaker models than Game Mode's world-gen does, but very weak models (free-tier auto-routing, sub-7B open-weight) can produce gibberish state extractions or expression decisions.

**For the chat connection:**

- Mid-tier and above is comfortable: Claude Haiku / Sonnet, GPT-4 mini / GPT-4 class, Gemini Flash / Pro, GLM5, Llama 3 70B, etc.
- Top-tier (Opus, GPT-5, Gemini Pro) helps in very long roleplays where context recall starts mattering.
- Free-tier or auto-routing OpenRouter models typically work for simple chat but the agents, especially World-State, may glitch. If state widgets keep going wrong, pin a capable model or upgrade the connection.

**For the agent connections:**

- Most agents can run on a smaller / cheaper model than the chat connection without quality loss. Many users set agents to Haiku or Flash even when chat is on Opus or Sonnet, to save cost.
- If you set a single connection for everything, default to the chat-quality model.

**Specific notes:**

- **Long roleplays** (hundreds of turns with significant world state) benefit from a larger context window. Continuity slips are a sign your context is getting compressed.
- **GLM5** trends toward player-positive narration regardless of tone (the same gotcha called out in [Game Mode](GAME_MODE.md#tone)). Worth knowing if your roleplay is meant to be grim.

## Lorebooks in Roleplay

Lorebooks attached to a Roleplay chat behave the same way as in Conversation — both **constant** entries (always injected) and **keyword-triggered** entries (injected when their keywords appear in recent messages) fire normally on each turn.

In addition, Roleplay has an **Active Context** panel accessible from the toolbar. It is Marinara's equivalent of SillyTavern's World Info and shows which lorebook entries are currently active, matched, and injected. Useful when a character keeps referencing a fact you didn't expect.

The lorebook editor itself has its own UI for authoring entries (keywords, position, recursion settings, folder organization). Those settings are beyond this guide's scope; the in-app editor's help covers them.

## Image generation

Roleplay uses image generation for three things:

- **Character sprites** — expression sprites per character. Either pre-uploaded as a sprite library or generated on demand.
- **Backgrounds** — selected per scene/turn by the Background agent from your asset library or generated.
- **Illustrations** — optional. The **Illustrator agent** (off by default) fires on key narrative moments (new location, dramatic action, character intro, big reveal) to generate a one-off scene image inline with the message.

**If no image-generation connection is configured:**

- Sprites slots stay empty (no error, just nothing rendered)
- Backgrounds render as solid color
- Illustrations don't fire
- The HUD still works fully — text-only roleplay with all the world-state tracking
- The Expression agent still runs (it's cheap, text-only), but its output has no visual effect

This is different from Game Mode, where the visual chrome is more deeply integrated — Roleplay degrades to a fully usable text-only mode without image gen.

For comparison across modes:

- **Conversation** uses image gen for selfies (per-character photos)
- **Roleplay** uses it for sprites + backgrounds + optional illustrations
- **Game Mode** uses it for backgrounds + NPC portraits + scene effects, via a sidecar pipeline

## Scene videos

Roleplay and Visual Novel galleries can animate existing Gallery illustrations through a separate **Video Generation** connection. Open **Chat Settings -> Agents -> Scene Videos** and choose a video connection, then use Gallery **Video** for the latest illustration or **Animate** on a specific illustration tile.

Generated scene videos appear in the Gallery, can be previewed fullscreen with the prompt, copied, downloaded, pinned, resized, and shown through **View latest**. See [Scene Video Generation](SCENE_VIDEO_GENERATION.md) for setup and provider details.

## Generation parameters

Roleplay uses Marinara's shared generation parameter system. See [Generation Parameters](GENERATION_PARAMETERS.md) for the defaults table, tuning advice, and per-backend gotchas (Claude `temperature`/`topP` conflict, Claude thinking mode, OpenRouter caveats).

Defaults work well for Roleplay as-is. Two tuning hints:

- **Sprite expressions or HUD widgets keep going wrong** — this is usually the agent connection, not the sampler. Switch the agent connection to a more capable model rather than tweaking parameters.
- **Character voice feels stiff or repetitive** — raise `temperature` to `1.1`–`1.2` on the chat connection, or raise `frequencyPenalty`/`presencePenalty` slightly (`0.3`–`0.6`).

## Troubleshooting

### How do I see what calls Roleplay Mode is making?

Set `LOG_LEVEL=debug` in your `.env` file and restart the server. Marinara logs complete LLM prompts (every message role and content), full responses, token counts, and per-agent batch details. For Roleplay specifically, this is the easiest way to see what each agent — World-State, Expression, Background, etc. — is producing per turn.

Set it back to `warn` (the default) when you're done — debug output is high-volume. See [Logging Levels](CONFIGURATION.md#logging-levels) for full details.

**Privacy note before sharing logs:** debug output contains your full prompts — character cards, persona content, lorebook entries, chat history, and world-state details. Redact private content (NSFW, real-world identifiers, private campaign material) before posting logs in Discord, GitHub issues, or any public forum.

### HUD widgets keep going wrong (wrong time, wrong location, wrong inventory)

The widgets are populated by the World-State agent. If values drift:

- Check the agent connection — a weak model may be failing to extract state correctly. Switch the agent connection to a more capable model.
- Manually re-run the tracker via the widget popover (it triggers a fresh extraction).
- If the world-state has genuinely drifted because the model lost track in narrative, edit the widget value directly in the popover.

### Sprite expressions don't change

Two common causes:

- **No image-generation connection / no sprite library uploaded** — sprites can't render without sprites to render. The Expression agent runs but its output has nothing to show.
- **The Expression agent is failing silently** on a weak model — the keyword fallback should still work for common emotion words. If even the fallback doesn't match what you'd expect, check `LOG_LEVEL=debug` to see what the agent returned.

### Background doesn't change

The Background agent picks from your **asset library**. If you have only one or two backgrounds available, the agent will keep picking those. Add more backgrounds to your asset library (in the Game Assets folder, organized by category) so the agent has more options.

### Connected Conversation context isn't showing up in Roleplay

Two diagnostic steps:

- Check that the Conversation has at least one `<note>` or `<influence>` tag — without those, nothing flows to the Roleplay (this is the asymmetric design; see [the FAQ entry](FAQ.md#why-doesnt-my-roleplay-character-remember-the-messages-from-our-connected-conversation)).
- Check that you're not in a **scene chat** (forked from the parent roleplay). Scene chats explicitly bypass connected-conversation context to stay self-contained.

### Long roleplays lose track of earlier events

Long contexts compress when they hit the model's window. Things to try:

- Bump to a model with a larger context window.
- Use the **Summary** panel (toolbar button) to write down major events explicitly. Marinara stores rolling summary entries for manual and automated updates, then compiles enabled entries into the summary text injected into prompts.
- Author key facts into a lorebook as **constant** entries — they'll always be in scope regardless of where they were established in chat.

### Regenerating a reply keeps using the wrong guidance

If Prose Guardian, Narrative Director, knowledge retrieval, or a custom prompt-section agent pushed the reply in a bad direction or decided to continue the RP inside its guidance, enable **Settings -> Advanced -> Debug mode**. Open the Roleplay HUD's Agents menu, inspect the Injections tab, then edit or re-run the specific cached injection and regenerate the same assistant message.

This works because Marinara stores the prompt injections used for each assistant message. On regeneration, it reuses that message's cached guidance instead of blindly using whatever the newest chat state would produce.

### Narrative Director Secret Plot keeps steering toward the wrong arc

Open **Chat Settings -> Agents**, make sure Narrative Director is active with **Secret Plot** enabled, expand the Secret plot panel, and use **Reveal spoilers** to edit the arc fields. Use **Regenerate** if the hidden arc itself is wrong. Removing Narrative Director from the chat wipes its hidden plot memory for that chat, so only do that if you want a clean slate.

---

## Found this confusing? Tell us

This guide will only get better with feedback. If something here didn't make sense, contradicted what you saw, or missed a question you actually had — [join the Discord](https://discord.com/invite/KdAkTg94ME) or [open a GitHub issue](https://github.com/Pasta-Devs/Marinara-Engine/issues). The most useful feedback is the specific kind: "I read X and still didn't know how to do Y."
