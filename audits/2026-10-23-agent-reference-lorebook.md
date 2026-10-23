# Agent reference lorebook documentation follow-up, 2026-10-23

Work in progress for #8145 and #8148, owned by @SpicyMarinara (Codex).
Depends on English PR #8153; translations must not be published to the
app-consumed docs-i18n branch before that source merges.

Translate only the new section `A reference lorebook for one agent` in
`agents/agents-overview.md` into all ten documentation packs, preserving the
English UI labels and canonical fragment. Other guide content remains unchanged.

The ten sections are prepared locally, preserving every existing byte outside
the inserted section and the exact English UI labels. Each new heading keeps
its canonical `a-reference-lorebook-for-one-agent` fragment. Focused checks pass
for this scope, NFC/LF and whitespace; local CodeRabbit reviewed these eleven
changed files and completed with zero findings.

The final English source SHA and regenerated pack manifests will be recorded
after #8153 settles. The translated guide content has not been pushed or
published to docs-i18n; only the draft ownership record is currently remote.
In-app downloads/rendering and native-reader review remain manual checks.
