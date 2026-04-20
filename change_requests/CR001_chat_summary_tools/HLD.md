# Title: Read & Append Chat Summary Built-In Tools
## Status: Draft
## Goals:
- Expose the rolling chat summary to the AI agent via explicit function calls.
- Enable any agent to read the current summary to maintain long-term context.
- Enable agents to append new plot points or developments to the summary dynamically.
- Replace hardcoded post-processing logic with a more flexible tool-based architecture.

## Proposed Solution:
- **`packages/shared/src/types/agent.ts`**: Register `read_chat_summary` and `append_chat_summary` in `BUILT_IN_TOOLS`.
- **`packages/server/src/services/tools/tool-executor.ts`**: 
    - Expand `executeToolCalls` context to include `db`, `chatId`, and `chatSummary`.
    - Implement `readChatSummary` to return the summary from context.
    - Implement `appendChatSummary` to use `chatsStore.updateMetadata` to persist new summary text.
- **`packages/server/src/routes/generate.routes.ts`**: Update all calls to `executeToolCalls` to provide the required database and chat context.
