# Image Generation

Marinara Engine centralizes image prompt style through **Settings -> Image Generation -> Style Profiles**. A style profile controls how roleplay selfies, avatars, sprites, Game Mode backgrounds, NPC portraits, and scene illustrations are shaped before they are sent to the selected image provider.

## Style profiles

Built-in profiles cover common local Stable Diffusion workflows:

- **Auto** keeps prompts flexible and lets the current character, game, scene, and model imply the style.
- **Anime** uses general anime-style tags.
- **Danbooru / Illustrious** uses SDXL/Danbooru-style tags for checkpoints such as Illustrious, Pony, NovelAI-like, and related anime models.
- **Realistic SDXL** and **Photorealistic** favor natural-language realism and photo-oriented negative prompts.
- **Cinematic**, **Digital Painting**, and **Painterly Fantasy** add art-direction language for key-art and illustration workflows.
- **Z-Image Turbo Narrative** preserves compact narrative expression for Z-Image Turbo-style models that parse prose well.

Profiles are user-editable. Clone a built-in profile to define what "anime", "photorealistic", or any custom house style should mean for your own local install. Each profile can define:

- Prompt grammar: natural language, comma tags, Danbooru tags, or hybrid.
- Positive style text and tags.
- Negative tags.
- Per-image tags for avatars, portraits, selfies, backgrounds, illustrations, and sprites.

## Prompt cleanup

Before a request reaches the image provider, Marinara compiles the prompt with the selected style profile. The compiler:

- Removes near-duplicate tags such as repeated quality tags.
- Moves simple negative phrases like `avoid text` or `no watermark` into the negative prompt.
- Keeps user wording intact where possible, especially for natural-language and Z-Image Turbo profiles.
- Adds the profile's per-image tags so backgrounds, portraits, and illustrations can share one style without identical composition language.

Use the Style Profiles test bench to paste a messy sample prompt and see the final positive and negative prompts that Marinara would send.

## Connection defaults

Each local image connection can optionally choose a style profile in **Connections -> Local Image Defaults**. Leave it on **Use global default** to follow the global profile. Marinara also suggests a profile from common model/checkpoint names, but it does not switch profiles automatically.

Style profile precedence is: explicit chat/game/profile selection, then the image connection default, then the global default style profile.

The backend-specific controls for AUTOMATIC1111/Forge, ComfyUI, NovelAI, and other providers remain in the existing connection defaults. Style profiles only control prompt shape.

## Prompt review

When **review prompts before image generation** is enabled, Marinara shows the final compiled positive prompt and, when available, the final compiled negative prompt before generation. Editing either field changes exactly what is sent for that request; reviewed prompts are not compiled a second time after confirmation.
