# Agent Approvals and the Agent Suite

This guide covers how you review and control what agents (small AI helpers that run alongside your replies) write during a chat. It explains the **Review Agent Outputs** toggle, the two review windows, the **Agent Suite** editor, and the **Cached prompt injections** panel.

## Review Agent Outputs

Some agents want to write new data into your chat. A Lorebook agent can add lorebook entries. A summary agent can save a chat summary. By default, some of these writes are saved for you automatically. The **Review Agent Outputs** toggle lets you check each write first.

To find the toggle:

1. Open the chat you want to control.
2. Open **Chat Settings**.
3. Scroll to the **Agents** section.
4. Turn on **Review Agent Outputs**.

When **Review Agent Outputs** is on, lorebook updates, summary updates, and other reviewable writer-agent outputs wait for your approval before they are saved. When it is off, lorebook and summary updates can be saved automatically.

Character card edits are a special case. They always ask for your approval first, even when **Review Agent Outputs** is off. You cannot turn that safety check off.

## The Agent Write Approval modal

When **Review Agent Outputs** is on and an agent proposes a lorebook or summary write, a review window opens. Its title is **Review Lorebook Update** or **Review Summary Update**, depending on the type of write.

The window shows:

- The name of the agent that made the proposal.
- A **Proposed Text** box that you can edit before saving.
- For lorebook writes, a short reminder to keep each entry under a `###` heading.

You have three choices at the bottom of the window:

- **Accept**: saves the text (after any edits you made) into your chat.
- **Regenerate**: reruns just that one agent to get a fresh proposal.
- **Discard**: throws the proposal away without saving.

If more than one proposal is waiting, the window shows how many are still queued. It reopens for the next one after you handle the current one.

## Character Card Update review

The **Card Evolution Auditor** agent can suggest edits to character-card fields based on what happened during roleplay. Conversation mode's built-in `update_about_me` tool can also propose a public About Me change. Neither path edits your card on its own; both open the **Review Character Card Updates** window so you decide.

The window lists each proposed edit. For every edit you see:

- The card field it touches (for example description, personality, or appearance).
- A short reason for the change, when the agent gives one.
- A **Before** block showing the current text.
- An **After** box showing the new text. You can edit this text before you approve it.

You have these actions:

- **Approve**: applies the edits. The number in the button shows how many edits will apply. Approving raises the character's version number and saves a version-history entry.
- **Regenerate**: reruns the agent for a fresh set of proposals.
- **Reject**: dismisses the proposals without changing the card.

Sometimes a card changed since the agent wrote its proposal. When that happens, the app marks the edit **stale** and dims it. If any edits are stale, an **Override stale** button appears with the count. Use it only if you still want to keep that text. The app asks you to confirm first. It then adds the stale text to the field instead of replacing text that no longer matches.

## The Agent Suite editor and AI-assisted rewrite

The **Agent Suite** lets you view and edit everything the agents in this chat have stored. This includes tracker data (like the current scene, present characters, and persona stats) and the saved output of your custom agents. You can fix a wrong name, correct a stat, or clean up messy stored text by hand or with AI help.

To open it:

1. Open **Chat Settings**.
2. Scroll to the **Agents** section.
3. Click **Agent Suite**.

On the left is a list of the agents active in this chat. Pick one to see what it has stored. The right side shows editable blocks. They are grouped into **Stored Memory**, **Tracker Data** (only for tracker agents), and **Recent Outputs** (only for custom agents). Agents that do not track data show only **Stored Memory**.

Each block is a text or JSON editor. After you change a block:

- Click **Save** to keep your edit.
- Click **Reset** to undo your unsaved change and return to the stored value.

You can also let AI rewrite a block for you:

1. Click **AI Edit** on the block you want to change.
2. To target only part of the text, select that part in the editor first. If you select nothing, the whole block is rewritten.
3. Type an instruction, for example "fix the garbled character names, she is called Mira".
4. Optional: click **Add Context** to attach character cards or lorebook entries. This helps the AI understand what the data means.
5. Pick the connection (the AI provider and model) that will do the rewrite.
6. Click **Rewrite**.

The rewritten text goes into the block as an unsaved draft. Review it, then click **Save** to keep it or **Reset** to drop it.

A few notes:

- If agents are still running for this chat, saving is paused until they finish.
- The **Stored Memory** section has one **Clear memory** button. It appears only when the agent has stored data. It deletes everything that agent stored for this chat at once, and it cannot be undone. The app asks you to confirm first.
- For the **Narrative Director**, stored spoilers are hidden. Use **Reveal spoilers** to view and edit them.

## Cached prompt injections panel

Before your reply is generated, some writer agents add text to the prompt. This is common for **Prose Guardian**, **Narrative Director**, and custom injection agents. The **Cached prompt injections** panel is a troubleshooting view of that added text. You find it on the **Injections** tab of **Agent activity** in a Roleplay chat, which shows while **Debug mode** is on. See [Agent activity](../roleplay/getting-started.md#agent-activity). It covers the most recent reply.

For each cached injection you can:

- Expand it to read and edit the text.
- Click the **Save** icon to keep your edit.
- Click the **Re-run** icon to have that one agent write a fresh injection.

**Knowledge Retrieval** and **Knowledge Router** injections cannot be rerun from this panel. Your edits and re-runs only take effect if you regenerate that same reply. A re-run uses the original chat history from that point, not any newer messages.

## Related guides

- [Agents Overview](agents-overview.md)
- [Downloadable Agents Reference](built-in-agents.md)
- [Creating and Editing Characters](../characters/creating-and-editing-characters.md)
