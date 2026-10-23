# Advanced Memory Recall excerpt default

Issue: [#8177](https://github.com/Pasta-Devs/Marinara-Engine/issues/8177). Owner: @SpicyMarinara. English source: [#8175](https://github.com/Pasta-Devs/Marinara-Engine/pull/8175), merged into `staging` as `a45d57b036d7b63669afdeca290550988390479a`.

## Scope

Updated only the documented default range from **3–10** to **3–5** in `agents/memory.md` in all ten existing language packs. The surrounding translated prose, inline code, links, and minimum of three messages remain unchanged. Explicit saved limits and scene-selection behavior do not change.

## Validation

- Exact byte comparison against `docs-i18n` base `023c6bee7e08b0a404559aac04d6bbe5eb10d707` proves each guide has exactly one numeric-range replacement; reversing that replacement restores every original byte.
- Built all ten manifests and ran the pack validator from an isolated archive of the merged English source above. All ten pass with 141 guides each: 1,410 manifest entries in total.
- Verified the byte size and SHA-256 of every manifest entry. Only `agents/memory.md` changes in each pack; all 140 other entries retain their prior hashes and byte sizes. Manifest source metadata points to the merged English source.
- Confirmed NFC normalization, LF line endings, unchanged inline code and link targets, and `git diff --check`.
- This documentation-only branch has no runtime packages. No runtime build, local container, browser UI, physical-device, provider or native-language prose rewrite is claimed.

## Publication

Local review and required hosted checks must complete before merge. After merge, verify the published bytes of all 21 changed files and every manifest hash before closing #8177. Subsequent #8155 and #8173 manifest publication must build on this branch's merged state.
