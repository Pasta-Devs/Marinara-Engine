# Provider icons

The icons on Connection tiles, the Add connection window, the quick switch and the media service lists
(concept decision 34c). `ProviderIcon.tsx` maps a service to a file here; nothing is fetched at run time.

## Lobe Icons (MIT)

Every `.svg` not listed below comes unchanged from [Lobe Icons](https://github.com/lobehub/lobe-icons)
(`@lobehub/icons-static-svg` 1.95.1), Copyright (c) 2023 LobeHub, under the MIT License in [`LICENSE`](LICENSE).
Only the single-colour icons Marinara uses are copied; to add one, copy it from the package and add it to the maps
in `ProviderIcon.tsx` (the file map and `BRAND_COLORS`). The tile shows every mark in white on the brand's colour.

## Owners' logos

Lobe Icons has no icon for these brands, so the mark comes from the owner's own logo:

- `llamacpp.svg` — llama.cpp's `media/llama1-icon-transparent.svg` (ggml-org/llama.cpp, MIT)
- `koboldcpp.png` — white silhouette of KoboldCpp's `niko.ico` (LostRuins/koboldcpp)
- `swarmui.png` — white silhouette of SwarmUI's `favicon.ico` (mcmonkeyprojects/SwarmUI)
- `horde.png` — white silhouette of AI Horde's `icon.png` (Haidra-Org/AI-Horde)
- `arliai.png` — white silhouette of arliai.com's favicon
- `linkapi-color.png` — LinkAPI's own logo, from linkapi.ai (shown in colour on the sponsor banner)

## Marinara-made marks

Simple single-colour marks Marinara drew after each owner's logo. They are not the owners' artwork and not part of
Lobe Icons:

- `nanogpt.svg` — NanoGPT (traced from the crystal logo)
- `linkapi.svg` — LinkAPI (two crescents and a star)
- `bifrost.svg` — Bifrost (the pixel B)
- `litellm.svg` — LiteLLM (the bullet train)
- `spicyapi.svg` — SpicyAPI (the flame in a circle)
- `drawthings.svg` — Draw Things (the horse)
- `blockentropy.svg` — Block Entropy (a cube; no logo to follow)
- `pockettts.svg` — PocketTTS by Kyutai (the "/k")

## Trademarks

Product names and logos are trademarks of their owners. Marinara Engine is not affiliated with them.
