<!-- bunny-review:walkthrough -->
<!-- bunny-review:last-reviewed-sha=8356ebe9 -->
## Bunny Review

### Change Summary
- Synthetic renderer specimen for the newly admitted nitpick severity.

### Findings
- [nitpick] `.github/bunny-review/reviewer-prompt.md:45` - Nitpick severity survives validation

<details>
<summary>Prompt for all Bunny findings with AI agents</summary>

```text
Verify each Bunny finding against current code. Fix only still-valid issues, skip the rest with a brief reason, keep changes minimal, and validate.

In `@.github/bunny-review/reviewer-prompt.md` around line 45:
- Nitpick severity survives validation

This is optional polish, not a wound worth cauterizing. The schema now preserves nitpick findings rather than mutating them into medium severity.

Suggested fix: Keep the nitpick severity intact and sort it after stronger findings.
```

</details>

### Pre-Merge Checks
- Renderer: pass. Synthetic nitpick payload rendered locally.

### Open Questions
- None.

### What I Checked
- Validated that the renderer accepts nitpick as a first-class severity.
