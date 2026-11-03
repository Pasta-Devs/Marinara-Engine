# Writer brief (Phase 2 rewrite)

You rewrite Marinara Engine user guides. Readers: hobbyists who chat and roleplay with AI characters, often non-technical, often on a phone, often reading in a second language.

1. Read the rules: /tmp/claude-0/-home-user-Marinara-Engine/a5b245ec-f036-586c-974e-94c0812b16ad/scratchpad/SKILL.md (structure, wording, Markdown style, ban list, accuracy, website constraints, WORD LIST). Follow them exactly. Use only word-list terms.
2. Read the audit for your guides: the audit file named in your task (find your guides' sections with grep). Audit facts came from a fast scout: re-verify each before you use it.
3. Work ONLY in your git worktree (named in the task). It is on your branch. Never switch branches, never force-push, never rebase, never touch other files than your guides.
4. For each guide, in order:
   a. Rewrite it. Opening 1-2 sentences, common task first, numbered steps with bold UI labels, "Before you start" line when a prerequisite exists, "If it did not work" lines after key tasks, reference tables at the end. Cut padding and repetition, keep information (move rare detail to a reference section at the end). Aim to cut 25-50% of words on long guides.
   b. Check every UI label you write against packages/client/src/localization/locales/en.json (grep, never read it whole) and the component. Check defaults/limits in packages/shared and packages/server. For install/update steps check the actual scripts; do not change install steps you cannot verify.
   c. Keep every screenshot heading text exactly (list: /tmp/claude-0/-home-user-Marinara-Engine/a5b245ec-f036-586c-974e-94c0812b16ad/scratchpad/screenshot-headings.txt). Keep each file name. Keep `initialSearchTerm` phrases (grep packages/client/src for initialDoc).
   d. Run: node /tmp/claude-0/-home-user-Marinara-Engine/a5b245ec-f036-586c-974e-94c0812b16ad/scratchpad/check-docs.mjs <worktree> <category>/<file>.md   (must print ok; fixes broken links/anchors, missing screenshot headings, H1 count). Also check inbound links from other guides to anchors you removed: grep -rn "<file>.md#" <worktree>/docs and fix anchors in YOUR guides only (keep a heading or tell the lead).
   e. Commit just that guide: git -C <worktree> commit -m "docs(<category>): <what changed in which guide>" with these trailer lines at the end of the message:
      Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
      Claude-Session: https://claude.ai/code/session_01R5jnWUseUoEJVRiDfKqrbm
   f. Push right away: git -C <worktree> push origin HEAD:<branch> (retry up to 4 times on network errors, 2s/4s/8s/16s).
5. Keep a running notes file (named in your task) with, per guide: one-line "what changed" (restructured / cut N% words / fixed facts / new steps), every fact change as "before → after (code file:line)", every claim you could not verify (left unchanged), any heading you renamed that other guides link to, and open questions.
6. Return to the lead only a short summary (≤15 lines): commits pushed, % cut per guide, count of fact changes, anything blocked.
