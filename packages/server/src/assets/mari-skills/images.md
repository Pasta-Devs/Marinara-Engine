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

A style adds the profile's positive tags, its per-image tags for `--kind`, its style text and the connection's prompt prefix. Every result has a `style` block: the profile and why it was chosen, your `requestedPrompt`, the final `prompt`, what was `added`, `removedDuplicates`, `movedToNegative`, and `dropped`: the tags you wrote that didn't reach the image model. Check it before you show the image, and tell the user when a style changed or dropped part of the prompt.

## The kind

Use `illustration` (the default) for every image, character avatars included, and set the shape with `--width` and `--height` (for example 1024 by 1024 for an avatar). It keeps your prompt intact.

`--kind` can also be `avatar`, `portrait`, `selfie`, `background` or `sprite`. Without a style the kind only picks the default size. With a style it also picks the profile's per-image tags, and the kinds treat your prompt differently:

- `avatar` **rewrites your prompt** down to the visual tags the compiler recognises. Character names, series tags, `1girl`, ages and specific traits are usually dropped. That hurts most on NovelAI and other Danbooru-style models, which recognise a character by name and series. The result's `dropped` list and `note` show what went.
- `portrait` and `sprite` add character framing such as "portrait, upper body" and may compact your prompt into tags.
- `illustration`, `background` and `selfie` keep your wording.

Only use `avatar`, `portrait` or `sprite` when the user wants that profile's framing, and check `dropped` before you show the image.

## When something looks wrong

- The image doesn't load: check `asset.url` starts with `/api/gallery/file/mari-images/`. The manifest lists only the newest 200 preview assets; an older one's file stays on disk, but its URL no longer loads.
- Unexpected tags or framing: read `mari images get <asset-id>`. `requestedPrompt` is what you asked for, `prompt` what the model got, `styleProfileId` the profile used.
