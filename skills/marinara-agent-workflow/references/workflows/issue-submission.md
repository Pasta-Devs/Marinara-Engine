# Issue Submission Workflow Card

Use this when the user asks to make, post, submit, or file a GitHub issue from rough notes, screenshots, logs, or excerpts.

## Routing

- Broken behavior: bug issue.
- Desired capability: feature request.
- Unclear or missing required facts: ask one focused question.
- Existing product behavior already covers the request: explain the existing path and do not file unless the user explicitly says to file anyway.

## Intake

Extract only visible facts: title, reporter/source, timestamp, description, expected behavior, actual behavior, repro steps, environment, logs, screenshots, missing facts, and whether files/URLs exist for attachments.

For bug reports, require enough information to state summary, expected behavior, actual behavior, reproduction, environment, and needed screenshot/log evidence honestly.

For feature requests, check whether existing Marinara features, settings, docs, prompts, lorebooks, or workflows already cover the requested outcome. If an existing path only partially covers it, explain the gap and file only the missing capability.

## Screenshot Gate

Model-visible pasted images are enough for reading. They are not automatically uploadable GitHub attachments. If the issue needs images attached, require local files or URLs before claiming attachments.

## Template And Label Gate

This repo currently has `.github/ISSUE_TEMPLATE/issue_report.md` and `.github/ISSUE_TEMPLATE/feature_request.md`. Use the matching template exactly. Do not pretend template fields, defaults, or labels exist if a future checkout removes them.

When labels are available, apply only labels from the live repo label list. Leave uncertain labels off rather than guessing.

## Posting Rule

Do not invent facts. Leave template checkboxes unchecked unless the target team explicitly wants otherwise.

If the user's wording grants standing approval to post, create the issue after the screenshot/template gates are satisfied. Otherwise draft exact text and wait for approval before posting.
