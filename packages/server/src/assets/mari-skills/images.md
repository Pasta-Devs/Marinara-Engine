---
name: Image generation
description: Read before making, editing, showing or assigning an image with mari images, or when a generated image looks wrong or doesn't show.
---

# Image generation

Purpose: make an image the user asked for, show it, and assign it only after they approve.

CLI: `mari images` (no `app_data` action). `generate` and `edit` save an unassigned preview asset; `assign` and `delete` change app images and need `--apply`. `mari images help` lists every subcommand.

## The flow

1. `mari images connections` when you don't know which image model to use. `--connection <id|name>` picks one; without it the default image model is used.
2. `mari images preview --prompt <text> [--kind <kind>] [--style …]` shows exactly what would be sent, without generating.
3. `mari images generate --prompt <text> [--negative <text>] [--kind <kind>] [--width <n> --height <n>]`. Edit an image with `mari images edit --prompt <text> --source <asset-id|app-url>`.
4. Show it: put the result's `show` line (`![alt](asset.url)`) in your reply. The user sees the image and can open it.
5. After the user approves: `mari images assign --asset <id> --target <target> … --apply` (see `mari images help` for targets).

## Your prompt goes out as written

Without a style flag, the prompt and negative reach the image model exactly as you wrote them: no style profile, no per-image tags, no connection prompt prefix, no rewriting. `--no-style` says the same explicitly. So write the whole prompt yourself, in the model's own style (tags for NovelAI or Stable Diffusion models, sentences for GPT Image or Gemini).

To use the user's house style instead:

- `mari images styles` lists the style profiles: id, name, the default, prompt grammar, and their style text and positive tags, cut short.
- `mari images styles <id|name>` shows one profile in full, including negative tags and its **per-image tags** for each kind.
- `--style` (or `--style default`) applies the default profile (or the image model's own, if it has one). `--style <id|name>` applies that profile.

A style adds the profile's positive tags, its per-image tags for `--kind`, its style text and the connection's prompt prefix. For kind `avatar`, `portrait` or `sprite` it may also distil your prose into short tags. Every result has a `style` block: the profile and why it was chosen, your `requestedPrompt`, the final `prompt`, what was `added`, removed or `movedToNegative`. Check it before you show the image, and tell the user when a style changed the prompt.

## The kind

`--kind` is `illustration` (default), `avatar`, `portrait`, `selfie`, `background` or `sprite`. Without a style it only picks the default size. With a style it also picks the per-image tags, and `avatar`, `portrait` and `sprite` add character framing such as "portrait, upper body". For scenery, world cards, covers and lorebook images use `illustration` or `background`, even when the image will become an avatar.

## When something looks wrong

- The image doesn't load: check `asset.url` starts with `/api/gallery/file/mari-images/`. Only the newest 200 preview assets are kept.
- Unexpected tags or framing: read `mari images get <asset-id>`. `requestedPrompt` is what you asked for, `prompt` what the model got, `styleProfileId` the profile used.
