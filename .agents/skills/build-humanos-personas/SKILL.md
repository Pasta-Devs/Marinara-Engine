---
name: build-humanos-personas
description: Build or revise portable AI roleplay personas using the HumanOS layered workflow. Use when creating a character or user persona, separating character, world, story, and runtime truth, adapting a persona for JanitorAI/SillyTavern/other chat platforms, compressing a persona card to a token budget, or auditing an existing character card that has become overbloated or mixed its truth layers.
---

# Build HumanOS Personas

Create durable, reusable roleplay architecture. Treat the persona as portable and keep campaign-specific material outside it unless the user explicitly wants a non-portable card.

## Workflow

1. Identify the requested deliverables and platform. Infer sensible defaults from supplied material; ask one focused question at a time, only when a missing choice would materially change the build.
2. Establish the character kernel first: identity, personality, internal model, psychology, relationships, intimacy approach when relevant, and speech. Do not include plot events, setting facts, or current-scene facts here.
3. Create the supporting truth layers separately:
   - **World truth:** durable setting logic, institutions, norms, locations, NPC routines, and rules that are true regardless of this character's current scene.
   - **Story binding:** the premise, inciting situation, fixed relationship history, and narrative pressures specific to this pairing or campaign.
   - **Runtime truth:** the current moment only--location, immediate situation, recent changes, active objectives, mindset, known facts, and near-term open threads.
4. Apply the layer audit in `references/humanos-layer-rules.md`. Move facts to the narrowest layer that can truthfully own them.
5. Compress only after the full logic works. Preserve behavioural causality, boundaries, contradictions, and high-yield speech cues; remove duplicated description and decorative detail first.
6. Produce requested platform adaptations without silently merging the layers. For platforms with one large description field, use clearly labelled sections and retain user agency instructions.
7. Finish with a concise consistency check: no story/world leakage into the persona; no stale runtime facts presented as permanent; no instructions that write dialogue, decisions, or internal states for `{{user}}`.

## Output Rules

- Keep modules 1-7 (the persona card) story-free unless the user explicitly changes that architecture.
- Do not "discard" Story Truth - this gets moved to a lorebook layer, or, if the user does not wish to create a lorebook, can be added as optional author notes.
- Write observable patterns from inner rules: trait -> internal logic -> outward behaviour. Avoid adjective piles.
- Preserve ambiguity where it supports play. Provide motivations and pressures, not predetermined outcomes.
- Use third-person past narrative and present-tense dialogue only when the user asks for roleplay operating instructions.
- Include consent, player agency, and no-forcing-user rules where relevant to the target platform.
- Treat a runtime update as a patch to the runtime layer, not a reason to rewrite character, world, or story truth.

## Common Deliverables

- **Portable user persona / character kernel:** character truth only, usually Modules 1-7.
- **Campaign pack:** character kernel + world truth + story binding + current runtime.
- **Card-lite version:** compressed character kernel within the stated token ceiling; put optional depth into lorebook-ready material.
- **Platform card:** reorganise the same truths to fit the platform without changing their ownership.
- **Runtime update:** replace only current location, situation, objectives, mindset, current knowledge, and open threads.

## Reference

Read `references/humanos-layer-rules.md` before drafting or auditing a layered build. Use it as the decision standard whenever a fact could belong to more than one layer.
