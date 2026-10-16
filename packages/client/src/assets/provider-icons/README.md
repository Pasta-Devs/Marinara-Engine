# Provider icons

The icons on Connection tiles, the Add connection window, the quick switch and the media service lists
(concept decision 34c). `ProviderIcon.tsx` maps a service to a file here; nothing is fetched at run time.

## Lobe Icons (MIT)

Every file not listed below comes unchanged from [Lobe Icons](https://github.com/lobehub/lobe-icons)
(`@lobehub/icons-static-svg` 1.95.1), Copyright (c) 2023 LobeHub, under the MIT License in [`LICENSE`](LICENSE).
`<name>.svg` is the single-colour version, `<name>-color.svg` the colour version. Only the icons Marinara uses
are copied; to add one, copy it from the package and add it to the map in `ProviderIcon.tsx`.

## Marinara-made marks

Lobe Icons has no icon for these brands, so Marinara drew simple single-colour marks after each owner's logo.
They are not the owners' artwork and not part of Lobe Icons:

- `nanogpt.svg` — NanoGPT (traced from the crystal logo)
- `linkapi.svg` — LinkAPI (two crescents and a star)
- `koboldcpp.svg` — KoboldCpp (the kobold dragon face)
- `llamacpp.svg` — llama.cpp (the llama-eared C++)
- `arliai.svg` — Arli AI
- `bifrost.svg` — Bifrost (the pixel B)
- `litellm.svg` — LiteLLM (the bullet train)

`linkapi-color.png` is LinkAPI's own logo, from their site.

## Trademarks

Product names and logos are trademarks of their owners. Marinara Engine is not affiliated with them.
