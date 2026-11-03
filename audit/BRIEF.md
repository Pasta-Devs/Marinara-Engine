# Audit brief (read-only)

Repo (read-only checkout of staging): /tmp/claude-0/-home-user-Marinara-Engine/a5b245ec-f036-586c-974e-94c0812b16ad/scratchpad/ro . Do NOT edit anything there.
Style rules: /tmp/claude-0/-home-user-Marinara-Engine/a5b245ec-f036-586c-974e-94c0812b16ad/scratchpad/SKILL.md

UI labels: packages/client/src/localization/locales/en.json (search it with grep, it is huge; never read it whole). Defaults: packages/shared/src, packages/server/src. Use targeted grep, not whole directories.

For EACH guide in your categories, return compactly (bullets, terse):
- Main reader task(s); are they easy to find (yes/no + why)
- Wrong/stale facts, each with the code location proving it (file:line). Check at least the 5 most important claims per guide (labels, menu paths, defaults). Only report what you verified.
- Missing steps, missing "what you see now", unexplained terms
- Duplication with other guides (name the owner guide)
- Length: what to cut or move to a reference table (rough % cuttable)
- Ban-list style problems: count + 2-3 examples
- Broken relative links/anchors (check every link target file exists and anchor matches a GitHub-slug heading)
- Priority: high (wrong facts or blocks a common task) / medium / low
- Terms used for the same thing (e.g. connection/provider/account/API) and which one the UI uses

End with a short "Word list candidates" section: term the UI uses → synonyms seen in docs → one-line plain explanation.

Write your full result to the output file named in your task (Markdown). Return to the lead only a 10-line summary: priorities per guide and the top 5 wrong facts.
