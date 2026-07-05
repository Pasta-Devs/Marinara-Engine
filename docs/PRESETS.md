# Preset Editor And Prompt Manager

Presets define reusable prompt structure and default generation parameters. They are the main place to tune how a chat is assembled.

## Sections And Groups

A preset is made of prompt sections. Sections can be enabled, disabled, reordered, and grouped. Marker sections help place content at known positions without adding text by themselves.

Ordering matters: earlier sections set broad context, later sections can narrow or override it. Keep the layout readable so future edits do not become archaeology.

## Preset Variables

Preset Variables, formerly called choice blocks in some older code paths, let a preset expose selectable values. Use them for tone, style, relationship state, censorship level, or any other reusable prompt option.

Variables can be referenced with macros such as `{{NAME}}`, and the prompt preview can render a preset with selected choices for a specific chat.

## Prompt Preview

Use the preview action to check how a preset renders with a chat. This is the fastest way to verify section order, macro expansion, variables, and chat-specific context before spending a generation.

## Conversation Presets

Conversation Mode uses the preset's Conversation prompt, not necessarily the full Roleplay/Game prompt stack. In the Conversation setup wizard, choose a Prompt Preset or enable a custom Conversation prompt override.

