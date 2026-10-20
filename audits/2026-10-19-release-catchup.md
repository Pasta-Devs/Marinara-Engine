# Documentation translation catch-up - 2026-10-19 (release)

This catch-up brings all ten documentation packs (German, Spanish, French, Brazilian Portuguese, Polish, Russian, Japanese, Korean, Simplified Chinese and Hindi) and the eleven UI packs up to the release English on `staging`. It covers [#7814](https://github.com/Pasta-Devs/Marinara-Engine/issues/7814), [#7817](https://github.com/Pasta-Devs/Marinara-Engine/issues/7817), [#7831](https://github.com/Pasta-Devs/Marinara-Engine/issues/7831), [#7839](https://github.com/Pasta-Devs/Marinara-Engine/issues/7839), [#7846](https://github.com/Pasta-Devs/Marinara-Engine/issues/7846) and [#7853](https://github.com/Pasta-Devs/Marinara-Engine/issues/7853).

## Sources and audit method

- Final English snapshot: `dcae4133750c0a982c2bc4e6efe8f940bc57b4e3` on `staging` (merge of #7870). All ten manifests use it as `sourceCommit`.
- Inventory snapshot: `a9b4c6fccb271ea0e5fbecff5fbf516232b5d24f`, the head of the release docs PR #7821, merged as `a7aa56266`.
- Intermediate snapshot: `be73c3122c35c95d5540009272d810f7e0bb8170` (merge of #7845). Thirty guides changed between the inventory and this snapshot, from the final review commits of #7821 and from #7823, #7824, #7829, #7832, #7838, #7843 and #7845. The per-language translators compared their guides against it.
- Late changes: `be73c3122..dcae41337` changed seven guides (#7851, #7852, #7854, #7855, #7866, #7869 and #7870) and `en.json` (15 keys added, three `avatars.stage.*` keys removed). They were translated into every pack.
- Translation baseline: `dfd05989ec8f191f7d7bb81d30eea7fa05fbda24` on `docs-i18n` (after #7809, whose manifests use English `a2e3f13d80f1a994cb1c10c56fef8be59672ed62`).
- Previous audit source: `1aa2109546f56ab17516e13de7ec7e823beb0246`.
- Scope follows the pack validator: Markdown under `docs/`, excluding `evidence`, `pr-evidence`, `screenshots`, `examples` and `i18n` (140 guides). Every pack has all 140 and no orphans.
- [Per-file dates, commits, groups and outcomes](2026-10-19-dates.json) cover all 140 source guides. The inventory found 92 drifted paths: 78 release updates, 8 earlier English changes that were never translated, 5 previously deferred Game Mode/ruleset guides and 1 older gap. Another 25 paths were already covered by intervening translations and 23 were unchanged. The file also lists the paths that changed after the inventory.

Translators worked per language in groups. Each assigned guide was compared with the English paragraph by paragraph, so drift older than the last sweep was fixed as well. Integration then checked every pack against the final English, as described under Verification.

## Updated guides

The change updates **964 translated guides** across 98 paths:

- all 92 drifted paths in every pack (920 guides);
- `appearance/card-css-theming.md` and `development/multiplayer.md`, which changed in English after the inventory, in every pack (20);
- `extending/personal-extensions.md` in every pack (10): Spanish, French, Japanese, Korean and Polish fix an older gap, and every pack gains the anchors that other guides link to;
- `extending/writing-story-scripts.md` in every pack (10), for the `#the-intro-message` anchor only;
- pack-specific corrections of older gaps: `agents/custom-agents.md` in Hindi, Polish and Russian, and `installation/ios-pwa.md` in German (4).

| Path | Catch-up content |
| --- | --- |
| `CONFIGURATION.md`, `REMOTE_ACCESS.md`, `TROUBLESHOOTING.md`, `UPGRADING.md`, `FAQ.md`, `installation/containers.md` | Auth for local proxies and Docker gateways (#7816), the password rate limit (#7824), private rejoin keys per seat (#7823), the install notice, type-check heap and 2.5.0 rollback (#7838), package disk cleanup (#7870), custom agent repositories and rulesets, Noodle setup from **Download Agents**, and going back to an older version (#7821). |
| `agents/avatars.md` | Newly generated main faces (#7813), Tripo generation removed (#7832), 3D placement (#7843), the Avatars drawer and **Framing** (#7852), blink and talk pictures and **New face** (#7854), faces that follow the voice (#7855), plus #7821. |
| `connections/providers-reference.md`, `media/tts-setup.md` | An Audio connection as the Text to Speech **Source** (#7851), plus #7821. |
| `connections/subscription-clis.md` | How much of a chat Claude reuses with the one-hour cache on or off (#7866), plus #7821. |
| `development/optional-agent-packages.md` | The host client namespace (#7869), runtime snapshots and kept versions (#7870), and the #7821 API updates. |
| `conversation/selfies.md`, `conversation/getting-started.md`, `media/illustrator-agent.md` | Images, videos or both for **Attach Card Appearance** and **Send Avatar References** (#7845), plus #7821. |
| `appearance/card-css-theming.md`, `settings/settings-overview.md` | Images from other websites load on request (#7829), plus #7821 in the settings guide. |
| `development/multiplayer.md` | Private rejoin key per seat and its regression (#7823). |
| `chats/peek-prompt.md` | Copy the assembled prompt in one click (#7807). |
| `prompts/conditional-prompts.md` | Choice options carry criteria for the Decision model (#7808). |
| `data/clearing-data.md` | The Tripo key (#7832), plus #7821. |
| `agents/hierarchical-maps.md`, `characters/galleries.md`, `chats/connected-chats.md`, `development/game-combat-ai-design.md`, `development/game-combat-roadmap.md`, `development/game-combat-rulesets-implementation.md`, `game/game-assets.md`, `roleplay/narrative-director.md` | Earlier English changes that no pack had: **From the world** maps (#7472), video messages (#7695), the phone Connected chat menu (#7082), shared sight, cover and initiative (#7474, #7563), a setting's own art and music (#7471), and the Secret Plot prompt section (#7657, #7733). |
| `characters/colors-and-stats.md` | Older gap: agents never update persona RPG values, and the full Ruleset sheets text (#4577, #6327). |
| `development/game-rulesets-and-sheets-implementation.md`, `extending/writing-rulesets.md`, `game/combat.md`, `game/dice-and-skill-checks.md`, `game/party-and-npcs.md` | Previously deferred Game Mode/ruleset guides, now current in every pack. The baseline packs held 70 of the 129 fenced examples in `extending/writing-rulesets.md`; all 129 are now present. |
| The other 60 paths in `agents/`, `appearance/`, `characters/`, `chats/`, `configuration/`, `connections/`, `contrib/`, `data/`, `development/`, `extending/`, `game/`, `home/`, `integrations/`, `lorebooks/`, `media/`, `noodle/`, `prompts/` and `roleplay/` | The release documentation update (#7821). |

### Integration fixes

The integration pass compared every pack with the final English and fixed what the translators had missed:

- Spanish, Polish and Russian `FAQ.md`: the Noodle answer still described the old tab. It now installs Noodle from **Agents** → **Download Agents** and opens **Home** → **Noodle**.
- Korean `noodle/overview.md`: "Opening Noodle" still described a top-bar button. It now covers the package install and the Home tab, and the intro says Noodle is optional.
- Russian `characters/personas.md`: the **Enable RPG Attributes** bullet now says agents do not update the values, and the Ruleset sheets paragraph is back in English order.
- Brazilian Portuguese `agents/hierarchical-maps.md`: added the missing publish-refresh paragraph and split three merged paragraphs.
- Spanish and Simplified Chinese `development/localization.md`: removed a link with a translated fragment and a paragraph that the English does not have.
- French `development/optional-agent-packages.md`: removed a duplicated line left by an edit. French and Brazilian Portuguese restore inline code that a paraphrase had dropped.
- German and Polish `chats/settings-profiles.md`, German `development/frontend.md`, and Related lists in German `connections/local-model.md`, German and Hindi `lorebooks/entries.md`, and Hindi, Polish and Russian `agents/custom-agents.md` now follow the English order.
- German `TROUBLESHOOTING.md` uses **Audioverbindung** like the rest of the pack. Russian `chats/messages.md` names the **Translate** button.
- Added `<a id>` anchors on translated headings where an English link fragment did not resolve. Every relative fragment link now resolves in every pack; at baseline, 14 did not resolve in each pack.
- Removed doubled blank lines in four guides, and blank lines inside lists in three.

`glossaries/glossary-de.md` records this cycle's German precedents: **Audioverbindung**, **Reverse-Proxy(s)**, ruleset clocks, **Game-Checkpoints** and the avatar framing glosses.

## UI packs

All eleven UI packs were brought up to the current `en.json` (14,819 keys), including the 15 keys added by the late changes:

| Pack | Valid keys at baseline | Valid keys now | Coverage | Stale keys |
| --- | --- | --- | --- | --- |
| `ar` | 348 | 8,575 | 58% | 12 |
| `de` | 861 | 13,997 | 94% | 0 |
| `es` | 350 | 14,124 | 95% | 0 |
| `fr` | 350 | 13,998 | 94% | 3 |
| `hi` | 472 | 14,252 | 96% | 0 |
| `ja` | 350 | 13,975 | 94% | 0 |
| `ko` | 11,145 | 14,462 | 98% | 109 |
| `pl` | 918 | 14,174 | 96% | 3 |
| `pt-BR` | 350 | 14,085 | 95% | 0 |
| `ru` | 472 | 14,335 | 97% | 0 |
| `zh-Hans` | 8,788 | 14,738 | 99% | 84 |

Stale keys are kept on purpose. `docs-i18n` serves every Engine version, so a key removed on `staging`, such as the three `avatars.stage.*` keys removed by #7852, can still be live in the current stable release. Engine ignores stale keys. They can be removed in a `[ui-i18n]` follow-up after the release.

No value copies the English verbatim except short labels that are the same in both languages. All values are NFC, with no ideographic spaces, non-breaking spaces or full-width Latin letters and digits. Simplified Chinese has no traditional forms, and Hindi uses international digits.

The German `settings.controls.queueMedia.label` string („Medienformatierungsanfragen in Warteschlange einreihen“) mistranslates *generation*. It predates this catch-up and is left for a separate correction; the docs keep their own gloss.

## Verification

All ten manifests were rebuilt with the final English snapshot. The repository's `build-manifest.mjs` and `validate-pack.mjs` passed for every pack: **140 translated guides / 140 English guides**, with no missing or orphaned guides, and valid hashes and link targets. `validate-packs.mjs` wrote `ui/manifest.json` and then passed without `--write-manifest`.

Additional checks covered every pack:

- Fenced code blocks are byte-identical to English. Inline code and link targets match English, apart from residuals recorded in earlier audits.
- Heading counts match English, every guide starts with `# `, and the text is NFC with no ideographic spaces, non-breaking spaces, zero-width characters or carriage returns. Simplified Chinese has no traditional forms.
- Paragraph alignment with English, plus checks across packs for missing bold UI labels, numbers and moved paragraphs.
- Changed lines follow each language's quote and dash rules from `CONTRIBUTING.md`. `git diff --check` passed.

Known residuals, unchanged by this catch-up:

- Simplified Chinese `agents/hierarchical-maps.md` gathers several World Maps 1.3.1 rules into one later section instead of following the English paragraph order. Its labels, links and code match English.
- Japanese `development/game-combat-ai-design.md` is translated much more tersely than the English.
- German, Spanish and Brazilian Portuguese split two long paragraphs of `development/optional-agent-packages.md` into several. French and Brazilian Portuguese merge one paragraph in `connections/local-model.md`.
- The inline-code residuals listed in the [2026-10-19 dates file](2026-10-19-dates.json) (`perLanguageNotes`).

Manual Download & Replace, in-app search and navigation, and independent native-reader sampling remain human verification items. Structural checks do not establish native fluency.

## Local review

Local CodeRabbit review was not run for this change. GitHub CodeRabbit reviews the pull request.
