---
name: "Marinara Engine"
description: "A playful immersive AI chat, roleplay, and game engine with visual novel warmth."
colors:
  void-night: "#050312"
  soft-silver: "#d4d4d4"
  ink-glass: "#141414d9"
  blush-primary: "#ffb3d9"
  blush-primary-foreground: "#0a0a0a"
  deep-violet: "#1a1a2e"
  lavender-text: "#e8d4ff"
  muted-orchid: "#d4adfc"
  plum-accent: "#2a1a3e"
  frost-text: "#f0e8ff"
  danger-rose: "#ff6b9d"
  orchid-border: "#d4adfc33"
  sidebar-night: "#08061a"
  light-blush-bg: "#faf8ff"
  light-ink: "#1a1025"
  light-rose-primary: "#e0709a"
  light-panel: "#ffffffee"
  sillytavern-blue: "#4a72b0"
typography:
  display:
    fontFamily: "Straight Quotes, Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0"
  headline:
    fontFamily: "Straight Quotes, Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0"
  title:
    fontFamily: "Straight Quotes, Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "0"
  body:
    fontFamily: "Straight Quotes, Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  label:
    fontFamily: "Straight Quotes, Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "0"
rounded:
  xs: "2px"
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
components:
  button-primary:
    backgroundColor: "{colors.blush-primary}"
    textColor: "{colors.blush-primary-foreground}"
    rounded: "{rounded.sm}"
    padding: "8px 20px"
  surface-glass:
    backgroundColor: "{colors.ink-glass}"
    textColor: "{colors.soft-silver}"
    rounded: "{rounded.lg}"
    padding: "16px"
  input-default:
    backgroundColor: "{colors.deep-violet}"
    textColor: "{colors.soft-silver}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
---

# Design System: Marinara Engine

## 1. Overview

**Creative North Star: "The Velvet Game Console"**

Marinara should feel like a lovingly built story machine: visual, intimate, a little magical, and still practical enough for power users who live in settings panels. The default surface is dark because the main play moment is long-form chat, roleplay, or game mode in a focused evening setting, where bright white UI would fight the scene. Light mode exists for comfort and accessibility, but the brand signal lives in blush, violet, soft glow, character art, and compact tools.

The system rejects sterile SaaS dashboards, bland SillyTavern cloning, generic Discord surfaces, and developer-only control panels. Even dense controls should feel like part of an immersive engine, not a spreadsheet of toggles.

**Key Characteristics:**

- Dark blush-violet shell with soft silver text and clear contrast.
- Compact control density, large enough tap targets, no hidden hover-only essentials.
- Character and scene surfaces may be expressive; settings and editing surfaces stay calm.
- Mobile layouts are first-class play surfaces, not reduced desktop leftovers.

## 2. Colors

The palette is a nocturne of near-black violet, soft silver, rose-blush primary actions, and lavender support colors.

### Primary

- **Blush Primary** (`#ffb3d9`): Main action color, active icons, highlighted controls, and glow accents in the dark theme.
- **Light Rose Primary** (`#e0709a`): Light theme equivalent for primary actions and active states.

### Secondary

- **Deep Violet** (`#1a1a2e`): Secondary panels, muted controls, and low-emphasis button backgrounds.
- **Plum Accent** (`#2a1a3e`): Active tabs, selected areas, and roleplay mood accents.

### Tertiary

- **Muted Orchid** (`#d4adfc`): Secondary emphasis, borders, quiet metadata, and decorative highlights.
- **SillyTavern Blue** (`#4a72b0`): Compatibility theme primary color only. Do not let it overtake the Marinara default identity.

### Neutral

- **Void Night** (`#050312`): Default app background.
- **Soft Silver** (`#d4d4d4`): Default body text on dark surfaces.
- **Ink Glass** (`#141414d9`): Card, popover, and elevated shell surfaces.
- **Sidebar Night** (`#08061a`): Persistent navigation and app frame.
- **Light Blush Background** (`#faf8ff`): Light theme app background.
- **Light Panel** (`#ffffffee`): Light theme panels and popovers.
- **Orchid Border** (`#d4adfc33`): Default border and input stroke.

### Named Rules

**The Blush Is Earned Rule.** Blush primary is for actions, selection, and emotional emphasis. Do not flood every panel with pink.

**The Compatibility Theme Rule.** The SillyTavern visual theme is a compatibility skin, not the source of Marinara's default visual identity.

## 3. Typography

**Display Font:** Straight Quotes with Inter and system sans fallbacks.
**Body Font:** Straight Quotes with Inter and system sans fallbacks.
**Label/Mono Font:** System sans for labels; Consolas, Monaco, Courier New for inline and fenced code.

**Character:** The type system is clean and readable, with personality coming from color, surfaces, motion, sprites, and game UI rather than ornate fonts.

### Hierarchy

- **Display** (700, `1.5rem`, 1.3): Compact page and modal headings. Reserve larger hero scale for true first-viewport brand moments.
- **Headline** (700, `1.25rem`, 1.3): Section headings and important drawer titles.
- **Title** (700, `1rem`, 1.35): Card titles, message author labels, compact panels.
- **Body** (400, `0.875rem`, 1.5): Default app text, chat metadata, settings descriptions, and dense controls. Keep prose line length around 65 to 75 characters where possible.
- **Label** (600, `0.8125rem`, 1.25): Buttons, chips, tabs, field labels, compact status text.

### Named Rules

**The No Tiny Mystery Rule.** Mobile controls must keep labels and icon buttons readable without hover help.

**The Compact Is Not Cramped Rule.** Dense panels may use small type, but text must not clip, overlap, or rely on negative letter spacing.

## 4. Elevation

Marinara uses a hybrid of tonal layering, soft glow, and selective frosted surfaces. Core reading areas should stay stable and legible; blur and glow belong to shell chrome, overlays, and special immersive moments.

### Shadow Vocabulary

- **Glass Strong** (`0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px rgba(255, 255, 255, 0.1)`): Modals, strong popovers, and elevated shell panels.
- **Control Lift** (`0 2px 6px rgba(0, 0, 0, 0.2)`): Primary compact buttons at rest.
- **Control Hover Lift** (`0 3px 8px rgba(0, 0, 0, 0.3)`): Buttons that rise on hover or focus.
- **Character Glow** (`0 0 12px rgba(255, 179, 217, 0.25), 0 4px 12px rgba(0, 0, 0, 0.15)`): Avatar rings, roleplay focus, and expressive character states.

### Named Rules

**The Reading Surface Rule.** Never put heavy blur behind long chat text, JSON editors, prompt editors, or logs. Use solid or near-solid surfaces there.

## 5. Components

### Buttons

- **Shape:** Compact rounded rectangles with 4px to 8px radius for tools; circular icon buttons for icon-only actions.
- **Primary:** Blush Primary background with dark foreground in dark mode; Light Rose Primary with light foreground in light mode.
- **Hover / Focus:** Small lift, glow, or border contrast. Focus states must be visible without relying on color alone.
- **Secondary / Ghost:** Use muted violet surfaces, borders, and icon color shifts. Do not invent large pill buttons for every action.

### Chips

- **Style:** Small rounded pills or compact segmented controls with border and tint.
- **State:** Selected states need both tonal fill and clear text/icon treatment. Color alone is not enough.

### Cards / Containers

- **Corner Style:** 8px to 12px for most panels; keep repeated cards restrained.
- **Background:** Use Ink Glass or tokenized card surfaces. Use stronger opacity for editors, logs, and settings.
- **Shadow Strategy:** Flat by default, lifted only for popovers, modals, hoverable cards, and special game surfaces.
- **Border:** Use tokenized borders such as Orchid Border. Avoid decorative side stripes.
- **Internal Padding:** 12px to 20px depending on density.

### Inputs / Fields

- **Style:** Tokenized input stroke, muted violet or card background, 8px radius, readable contrast.
- **Focus:** Ring color uses the primary token, with visible outline or border shift.
- **Error / Disabled:** Error state uses Danger Rose plus text or icon. Disabled controls reduce opacity but must remain readable.

### Navigation

- **Style:** Persistent sidebars use Sidebar Night, compact labels, active blush or lavender accents, and enough contrast for long sessions.
- **Mobile Treatment:** Navigation and settings controls must be touch-friendly, avoid hover-only disclosure, and keep primary chat/game actions reachable.

### Chat, Roleplay, and Game Surfaces

Conversation mode can use familiar message bubbles, but roleplay and game mode should feel more like visual novel and RPG surfaces. Sprites, backgrounds, narration boxes, dice, maps, and command badges should support the scene without making logs or controls hard to scan.

## 6. Do's and Don'ts

### Do:

- **Do** use the existing semantic tokens (`--primary`, `--background`, `--card`, `--muted`, `--border`) before adding one-off colors.
- **Do** keep game and roleplay surfaces immersive, with room for sprites, backgrounds, voice, image prompts, and command results.
- **Do** make mobile controls touch-friendly and readable, especially settings drawers, prompt editors, maps, logs, and modal workflows.
- **Do** pair color with labels, icons, shape, or state text for color-blind support.
- **Do** use solid or near-solid surfaces for long text, JSON repair, prompt previews, and advanced parameter fields.

### Don't:

- **Don't** turn Marinara into a sterile SaaS dashboard with gray card grids and dry enterprise spacing.
- **Don't** make it a bland SillyTavern clone. Compatibility themes may exist, but Marinara's default should keep its own blush-violet visual novel identity.
- **Don't** make it feel like a generic Discord clone. Chat familiarity is useful, but roleplay and game mode need their own atmosphere.
- **Don't** build developer-only control panels that assume technical confidence. Advanced settings still need clear labels, forgiving defaults, and helpful validation.
- **Don't** use colored side-stripe borders, decorative gradient text, nested cards, or glassmorphism as the default layout answer.
- **Don't** rely on hover for important mobile actions.
