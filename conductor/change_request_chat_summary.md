# Change Request: Read & Append Chat Summary Built-In Tools

## 1. Problem Statement
Currently, the "Chat Summary" agent interacts with the rolling conversation summary through a hardcoded mechanism in the generation pipeline (`generate.routes.ts`). The agent cannot explicitly read or append to the summary via function calling; instead, its JSON output is intercepted and appended automatically by the server. This prevents other agents from reading or updating the long-term summary, limiting multi-agent awareness and architectural consistency.

## 2. Proposed Solution
Implement two new built-in tools (`read_chat_summary` and `append_chat_summary`) that allow any agent (with the tools enabled) to explicitly interact with the conversation's rolling summary.

This requires:
1. Extending the `executeToolCalls` context to include `db`, `chatId`, and `chatSummary`.
2. Registering the new tools in the shared schema (`BUILT_IN_TOOLS`).
3. Implementing the tools' logic in `tool-executor.ts`.
4. Updating `generate.routes.ts` to pass the expanded context when executing tools.

## 3. Scope & Implementation Plan

### Step 1: Update Tool Context Interface
**File:** `packages/server/src/services/tools/tool-executor.ts`
- Update the `context` argument interface in `executeToolCalls` and `executeSingleTool` to include:
  ```typescript
  db?: DB;
  chatId?: string;
  chatSummary?: string | null;
  ```

### Step 2: Register Built-in Tools
**File:** `packages/shared/src/types/agent.ts`
- Add `read_chat_summary` to `BUILT_IN_TOOLS` (no arguments required).
- Add `append_chat_summary` to `BUILT_IN_TOOLS` (requires `text` string argument).
- Optionally, add them to the `DEFAULT_AGENT_TOOLS` for the `chat-summary` agent.

### Step 3: Implement Tool Logic
**File:** `packages/server/src/services/tools/tool-executor.ts`
- Add cases for `read_chat_summary` and `append_chat_summary` in the switch statement.
- Implement `readChatSummary(context)` returning the current `chatSummary`.
- Implement `appendChatSummary(args, context)`:
  - Validates `db` and `chatId` exist in context.
  - Fetches the current `chats` record.
  - Appends the `text` to the `summary` metadata field.
  - Calls `chatsStore.updateMetadata()`.
  - Returns a success string.

### Step 4: Update Generation Route Callers
**File:** `packages/server/src/routes/generate.routes.ts`
- Wherever `executeToolCalls` is invoked (for agents or the main LLM), pass `{ db: app.db, chatId: input.chatId, chatSummary: chatMeta.summary ?? null }` along with existing properties like `spotifyCreds`.

## 4. Verification & Testing
- Use `pnpm check` to ensure all type changes in `executeToolCalls` and `BUILT_IN_TOOLS` are valid.
- Manually run the `chat-summary` agent with the new tools enabled to verify it can read and append the summary correctly.
- Verify that real-time SSE updates (`type: "chat_summary"`) continue to function or can be migrated to the tool's implementation.

## 5. Security & Conventions Checklist
- [x] Changes are non-destructive to unrelated work.
- [x] Uses existing `chatsStore.updateMetadata` patterns.
- [x] Does not expose sensitive database connection details to the `vm` sandbox (only to built-in TS tools).
- [x] The `append_chat_summary` tool handles missing or empty initial summaries gracefully.