# Ruleset layer items catch-up - 2026-10-31

English: Engine `staging` at `04e328e06f97b42e1c6b05cbc8019309760ec17b` (every manifest's `sourceCommit`).

All ten documentation packs mirror #8623, tracked in #8624:

- `game/rulesets.md`: a layer can change which shops sell what and what treasure drops.
- `extending/ruleset-layers-and-translations.md`: the `items` bullet and its JSON example, "add a seller or a loot table" under "What a layer cannot do", and Capability API 1.813 under "Limits".
- `extending/ruleset-items.md`: `unsold` (Capability API 1.813) in the capability list and the market bullets.

## Not done

`chats/slash-commands.md` and `roleplay/getting-started.md` still lag English by #8587, tracked in #8603, although the manifests name a newer commit.

## Verification

- The three pages in all ten packs have the same headings and fenced code blocks as English, the fenced blocks byte-identical. Inline code in the changed lines matches English.
- `build-manifest.mjs <pack> --source-commit 04e328e06f97b42e1c6b05cbc8019309760ec17b` and `validate-pack.mjs <pack>` passed for all ten packs.
- `git diff --check` passed. Markdown and JSON only.
