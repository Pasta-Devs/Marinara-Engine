# Implementation Plan: Read & Append Chat Summary Built-In Tools
## Prerequisites:
- Access to `packages/server/src/services/storage/chats.storage.ts` for metadata updates.
- Valid `db` connection injected into the generation route.

## Step-by-Step Tasks:
1. Create directory `change_requests/CR001_chat_summary_tools`.
2. Write `HLD.md` and `IMPLEMENTATION_PLAN.md` to the directory.
3. Create git branch `change/CR001-chat-summary-tools`.
4. Modify `packages/shared/src/types/agent.ts` to add tool definitions.
5. Modify `packages/server/src/services/tools/tool-executor.ts` to add tool implementations and update context interfaces.
6. Modify `packages/server/src/routes/generate.routes.ts` to pass new context fields.
7. Run `pnpm check` to verify types and linting.

## Files Affected:
- `packages/shared/src/types/agent.ts`
- `packages/server/src/services/tools/tool-executor.ts`
- `packages/server/src/routes/generate.routes.ts`

## Verification:
- Manual test: Assign `append_chat_summary` to an agent and verify the "Scroll" UI in the client updates after generation.
- Type check: `pnpm check` must pass without errors.

## Rollback:
- `git checkout main` and delete the feature branch.
