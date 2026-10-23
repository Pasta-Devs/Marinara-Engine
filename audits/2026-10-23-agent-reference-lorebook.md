# Agent reference lorebook documentation follow-up, 2026-10-23

Follow-up for #8145 and #8148, owned by @SpicyMarinara (Codex).
Depends on English PR #8153; translations must not be published to the
app-consumed docs-i18n branch before that source merges.

Translate only the new section `A reference lorebook for one agent` in
`agents/agents-overview.md` into all ten documentation packs, preserving the
English UI labels and canonical fragment. Other guide content remains unchanged.

## English source and scope

The current candidate English source is
`de0f1e0a07c30afe0f79c726116dcab09e1ac5af` from #8153, including its concise
shared-reference visibility sentence. The translated section preserves per-chat
selection, normal triggers and manual retries, isolation from the main reply and
unrelated agents, possible shared context for agents running together, disabling
or unavailable-book behavior, and independent custom-agent source settings.
The prose introduces no behavior beyond that English section.

## Validation

- All ten pack validators pass against that exact English snapshot: 140 guides
  per language, 1,400 manifest entries in total.
- Every manifest entry's byte size and SHA-256 match its local guide. Only
  `agents/agents-overview.md` changes within each manifest, alongside
  `sourceCommit`.
- Each guide preserves every existing byte outside the new section, the four
  English UI labels in source order, and the explicit
  `a-reference-lorebook-for-one-agent` fragment.
- New text passes NFC/LF and whitespace checks. Local review results are recorded
  in the PR conversation before publication.

The candidate source must be confirmed after #8153 lands. The guide content and
manifests remain local until then; only the draft ownership record is currently
remote. In-app downloads/rendering and native-reader review remain manual checks.
