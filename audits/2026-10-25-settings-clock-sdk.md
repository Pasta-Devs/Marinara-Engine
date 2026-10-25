# Settings, world clock and package SDK translation follow-up

Issue: [#8303](https://github.com/Pasta-Devs/Marinara-Engine/issues/8303).

English source: `3ffae95df89001f4d5116c344687ac0dd3fe57bd` on `staging`.
Initial translation base: `d814c33379e782d35e3765a9b3fe92b6cdf1d48b` on `docs-i18n`.

This follow-up covers the documentation and interface changes from PRs #8302,
#8301 and #8210. Runtime behavior and unrelated translation drift are outside
this patch.

## Scope

- Update Card CSS control locations, extension revision-history retention,
  tracked world-clock macros and the native/legacy Zod SDK boundary in the four
  affected guides across the ten existing documentation languages.
- Translate the three world-clock macro descriptions, the two existing Card CSS
  help strings and the extension revision-history interface strings across the
  eleven existing UI packs, preserving interpolation tokens and English fallback.
- Preserve code blocks, inline literals, paths and link targets. No existing
  translated pack carries `extending/ruleset.schema.json`; no translated schema
  is introduced. Its canonical generated English artifact stays authoritative.
- Rebuild and validate documentation and UI manifests, complete review, and
  verify the changed published bytes before closing the issue.

## Delivery evidence

Implementation and validation are in progress. This record will be updated with
the completed checks and publication result before delivery.
