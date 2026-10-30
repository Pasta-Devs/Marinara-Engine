# Arabic (ar) — conventions draft

**Status: DRAFT — no Arabic pack exists.** The ar cycle is held pending an
explicit maintainer go-ahead. This file preserves the Arabic conventions worked
out during the RTL viewer scoping (2026-08-02) and hardened by the RTL viewer
PR (#4489, shipped), so the eventual translation cycle doesn't start from zero.
Unlike the other glossaries, nothing here can cite pack evidence yet; every
rule is a recorded scoping ruling, to be confirmed or amended when the pack is
actually built.

## Language & register

- **Undiacritized Modern Standard Arabic.** No dialect, no tashkeel outside
  genuinely ambiguous single words.
- Orthography is part of searchability, not just correctness:
  - **Hamza carriers are never folded** — أ / إ / آ are not ا.
  - **ة is not ه**; **ي is not ى.** These two are NOT reliably
    machine-checkable — native-reader QA is a standing stage from file 1, not
    a final pass.
  - **NFC mandate**, plus a grep for the presentation-forms ranges
    (U+FB50–U+FDFF, U+FE70–U+FEFF), which must never appear.
- Split-spelling audits (hamza variants, ة/ه, ي/ى) play the role the
  ideographic-search runtime probes played for the CJK packs: search the
  rendered pack for both spellings of sampled terms; the wrong spelling must
  return zero results.

## Typography & mechanics

- **Zero tolerance for invisible characters**: no LRM/RLM, no tatweel (ـ), no
  ZWJ/ZWNJ. Direction is handled by the viewer (per-doc `dir` keyed off
  `doc.language`), never by embedded control characters.
- **ASCII digits only.** A Devanagari-style exception does not exist here for
  a hard technical reason: `١.` at the start of a list item silently degrades
  to a paragraph — the markdown renderer's ordered-list regex matches `\d`
  (ASCII) only.
- **Quotes: «…»** for Arabic prose quoting; English UI strings inside them
  stay byte-exact.
- **Backtick mandate for direction-fragile inline literals**: `50%`, dates,
  `8-bit`, and similar digit/Latin fragments visually reverse when set in RTL
  prose — put them in inline code, which the viewer forces LTR. Also
  `MARI_DATA_DIR`-style identifiers: outside code, the ASCII-`\w`
  italic-lookaround in the renderer can eat the underscores.
- **Arrow paths stay ALL-English with →** (Settings → General → …), with the
  Arabic gloss outside the path, covering the whole path — never a mixed
  half-translated path.

## Viewer facts the pack can rely on (shipped in #4489)

- The pack ships WITH its selector row: the ar entry in `DOCS_LANGUAGE_LABELS`
  carries `direction: "rtl"`, plus the `DIR_LABELS_BY_DOCS_LANG` ar map and
  SettingsPanel aliases, landing in the same PR as the pack so the selector
  never offers a missing pack. A regression asserts the direction contract.
- Per-doc direction is keyed off `doc.language`, so English-fallback docs in a
  partial pack render LTR correctly.
- Inline code and fences are forced LTR; `:---`/`---:` table alignment maps to
  start/end; the docs-reader isolation class scopes RTL fixes away from chat.
- Known open question from scoping §5 (maintainer): whether modal chrome keeps
  mirroring under an ar UI locale (recommended) or pins LTR — re-raise at
  cycle start.

## Process notes for the eventual cycle

- Native-reader QA from the first file, not the last (the ة/ه and ي/ى classes
  make late QA unaffordable).
- Glossary preview rows AR-1..AR-11 lived in the original scoping report
  (§4), which was lost with the first-generation glossaries; the rules above
  are the surviving substance. Term-table work (prompt, token, lorebook,
  agent, …) starts fresh at cycle time and must follow the same
  evidence-and-banned-alternates format as the shipped glossaries.


## Agent Organizer

Use the English UI label **Agent Organizer** for the renamed official agent store.
