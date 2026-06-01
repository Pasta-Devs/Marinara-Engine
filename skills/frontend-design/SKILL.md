---
name: frontend-design
description: "Create distinctive, production-grade frontend UI direction for Marinara Engine. Use when the user asks to design or build a new UI surface, page, component, dashboard, app shell, modal, onboarding flow, editor, settings view, mode surface, visual treatment, or wants bland UI made more distinctive. In this repo, use frontend-design for initial concept, layout, and implementation direction; use impeccable afterward for critique, accessibility, responsive hardening, polish, and live iteration."
---

# Frontend Design

Use this as Marinara's creative frontend builder lens. It helps choose the visual direction and first strong implementation shape; it does not replace repo architecture, mode boundaries, Impeccable polish, or native proof.

## Marinara Order

1. Keep root `AGENTS.md`, `skills/marinara-agent-workflow`, and the matching workflow card in force.
2. Load `PRODUCT.md` and `DESIGN.md` before choosing visual direction.
3. Load `skills/impeccable/SKILL.md` after the first design pass when critique, accessibility, responsive behavior, hardening, polish, or live iteration matters.
4. Load `marinara-architecture-guard` for ownership/import/shared API questions.
5. Load `marinara-mode-separation` for chat, roleplay, game, prompt, generation, or shared mode UI.

## Role Split

- `frontend-design`: decide the concept, hierarchy, density, layout, motion direction, and first implementation shape.
- `impeccable`: audit and harden product fit, accessibility, responsive behavior, UX copy, edge states, visual consistency, and AI-slop risk.
- `webapp-testing`: prove UI behavior in browser/native paths when needed.

## Design Direction

Before editing, name:

- Surface owner: shell, catalog, runtime, chat, roleplay, game, settings, modal, or shared UI.
- Primary user path and state: what the user is trying to do and what must stay easy.
- Aesthetic sentence: how this surface should feel inside Marinara's product context.
- Proof path: browser, native Tauri, screenshot, typecheck, or manual QA needed.

Favor Marinara's product register: dense, scannable, tactile roleplay/editor tools with blush-violet identity, readable controls, and room for character/story/game atmosphere. Use marketing/hero-page drama only when the user asks for a public or promotional surface.

## Implementation Rules

- Use existing React, Tailwind, CSS variables, theme tokens, lucide icons, and component patterns first.
- Preserve `PRODUCT.md` and `DESIGN.md`: Velvet Game Console, blush-violet identity, mobile-first play surfaces, color-blind support, and no hover-only essentials.
- Keep product behavior in `src/engine`, React UI in `src/features`, runtime wrappers in `src/shared/api`, and privileged capabilities in `src-tauri`.
- Prefer semantic tokens like `--primary`, `--background`, `--card`, `--muted`, and `--border` over one-off colors.
- Do not add new fonts, global visual systems, broad theme shifts, heavy animation frameworks, or decorative effects unless the task explicitly needs them and proof covers readability/performance.
- Keep operational UI compact and predictable. Avoid nested cards, generic SaaS card grids, gradient text, decorative glassmorphism, side-stripe borders, and modal-first workflows.
- Use visual assets when building websites, games, landing pages, or immersive surfaces. For app UI, prefer existing sprites, backgrounds, icons, and theme assets unless new assets are requested.

## Workflow

1. Inspect the current UI/code path and nearby patterns.
2. Pick one clear design direction, not several vague options.
3. Implement the smallest complete version in the owning UI surface.
4. Check states that naturally belong to the surface: loading, empty, error, disabled, long text, small viewport, light/dark theme.
5. Use Impeccable for critique/polish when the surface is medium/high UX risk or the user asks for refinement.
6. Verify with the repo-appropriate checks and state any manual/native gaps.

## Output

For implementation handoff, report:

- Behavior changed
- UI/files touched
- Product/design fit checked
- Verification run
- Remaining risk or polish gap
