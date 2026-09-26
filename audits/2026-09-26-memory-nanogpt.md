# Memory and NanoGPT translation follow-ups — 2026-09-26

Issues: #6681 and #6690. English source: `d590e61ccc0ddcf76d8f11a906ed7f0e9e309860` on staging, after #6680 and #6686.

Updated `agents/memory.md` and `connections/providers-reference.md` in all ten packs: de, es, fr, hi, ja, ko, pl, pt-br, ru and zh-hans. No paths were renamed or deleted. The source commit identifies this two-guide update; this is not a new audit of every other document in the packs.

Memory guidance now covers weighted distinctive terms, searching indexed messages with excerpts disabled, partial scene participation, private conditions, review of stale/legacy recaps, shared scene dates, narrator-only excerpts for conditional recaps, and complete constant-summary coverage of AI-hidden messages. Recall introduces no extra model call.

NanoGPT guidance now covers model-catalog multipliers and paid labels, optional usage-only management tokens, API-key fallback, weekly/daily quota readings, unknown/inactive states, manual refresh, and the active-connection meter. Literal controls, token scope names, URLs, code and displayed number formats remain in English.

Validation: each pack passed `scripts/docs-i18n/validate-pack.mjs` after manifest regeneration. A focused comparison checked NFC text, all new literal code spans and UI labels, and preservation of every existing inline code span in the two guides. Existing English fallbacks for three unrelated guides remain unchanged. Translation prose was reviewed against the English additions and the per-language glossaries; native-speaker review remains welcome.
