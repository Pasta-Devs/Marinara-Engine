# Fact-checker brief

You did NOT write these changes. Your job: check every factual claim in the diff against the code, adversarially.

- Repo worktree and branch: named in your task. Read-only for you except the single report file. Do not edit guides, do not commit.
- Get the diff: git -C <worktree> diff origin/staging...HEAD -- <paths>
- For every ADDED or CHANGED line that states a fact (UI label, menu path, button text, default, limit, command, path, port, env var, file name, behavior), find proof in code: packages/client/src/localization/locales/en.json (grep only), packages/client/src components, packages/shared, packages/server, scripts, launchers (start.sh, start.bat, start-termux.sh), win/installer, Dockerfile*, docker-compose*, .env.example, android/.
- Also check facts that were REMOVED: was correct information lost? (Moving it is fine; deleting needed information is not.)
- Rules for style: SKILL.md at the path in your task; flag word-list violations and ban-list words briefly.
- Write the report file: per guide, a list of: `FAIL` (claim is wrong; give the proof file:line and the correct text), `UNPROVEN` (no proof found; quote the claim), `LOST` (removed needed info). Skip claims that pass. End with a count.
- Return to the lead a ≤12-line summary with the FAIL items.
