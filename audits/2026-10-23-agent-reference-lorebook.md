# Agent reference lorebook documentation publication, 2026-10-23

Follow-up for #8145 and #8148, owned by @SpicyMarinara (Codex).
English PR #8153 is merged. The exact source commit is `b2a126f952272ed6c5be51ee8b6fef7babdcbfc1`; its overview
bytes match the substantively reviewed English candidate. This publication
updates only `agents/agents-overview.md` in all ten packs.

## Source and translation scope

The English guide SHA-256 is `803b51babdaf8376c7f24c034c921cbd77fb937d2bfdf99b8f650bb65bb621d0`.
The heading-inclusive new-section SHA-256 is `68e7bb5b66b5a825a429a4dac40723947b4671124bf4978dc259667bdaa91f1c`.
All ten translated guides are byte-identical to reviewed translation head
`a94ad05724b0208657c08ca53a27efc33a1e551a`. Each existing guide byte outside
the new section is preserved against published docs base `e3050b2ce255d811df0d95afe8be91a0ae447935`.

The section retains per-chat selection, matching downloadable package updates,
normal triggers and manual retries, isolation from the main reply and unrelated
agents, shared context for agents running together, disabled/unavailable-book
behavior, independent custom-agent source settings, and the conservative fallback
when older/imported history cannot distinguish group replies from continuations.
It adds no promises
beyond the merged English text. The four English UI labels and the canonical
`a-reference-lorebook-for-one-agent` fragment are preserved.

## Validation and publication

All ten pack validators pass against that merged English snapshot: 141 guides
per language and 1,410 manifest entries in total. Every local guide size and
SHA-256 matches its manifest. Within each manifest, only the overview guide entry
changes from the published base, alongside `sourceCommit`; other published guide
entries, including the memory default, Antigravity note, and Roleplay-video
updates, remain intact. Pending audio/scene follow-up content and hashes remain
unchanged. The global `sourceCommit` identifies the English snapshot for this
scoped update; it does not certify that every other guide is fully current.
New section text passes NFC, LF and whitespace checks. Substantive prose review
and the final source/manifest validation are recorded separately in the PR.

Final delivery requires merging this reviewed PR to `docs-i18n`, followed by raw
published-byte, manifest/hash and ancestry verification. In-app downloads,
rendering and independent native-reader review remain manual checks.
