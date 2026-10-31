# Cheapest recommended models catch-up - 2026-10-31

English: Engine `staging` at `2e0dadf0cc63f55905ca0382646fb928bbcd5fc5` (every manifest's `sourceCommit`).

All ten documentation packs add the #8616 sentence to `game/getting-started.md`, under "Choosing a model". The model names stay in English.

## Not done

`chats/slash-commands.md` and `roleplay/getting-started.md` still lag English by #8587, tracked in #8603, although the manifests name a newer commit.

## Verification

- The guide in all ten packs has the same heading counts and levels, bullets and table rows as English, and byte-identical fenced code blocks.
- `DeepSeek V4 Flash` and `Claude Haiku 5.5` appear in all ten packs.
- `build-manifest.mjs <pack> --source-commit 2e0dadf0cc63f55905ca0382646fb928bbcd5fc5` and `validate-pack.mjs <pack>` passed for all ten packs.
- `git diff --check` passed. Markdown and JSON only.
