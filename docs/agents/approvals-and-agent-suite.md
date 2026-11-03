# Agent Approvals and the Agent Suite

Agents can write into your chat: lorebook entries, summaries and character card edits. This guide shows how to review those writes before they save, and how to read and fix what agents have stored with the **Agent Suite**.

## Review agent writes before they save

By default, some agent writes save on their own. **Review Agent Outputs** makes each one wait for your approval.

1. Open the chat and click **Chat Settings**.
2. Scroll to the **Agents** section.
3. In a Roleplay chat, open **Trackers Control**. In a Game, skip this step.
4. Turn on **Review Agent Outputs**.

With it on, lorebook updates, summary updates and other reviewable writer-agent outputs wait for you. With it off, lorebook and summary updates can save automatically.

Character card edits always ask first, even when **Review Agent Outputs** is off. You cannot turn that check off.

### Review a lorebook or summary update

When an agent proposes a write, a window opens titled **Review Lorebook Update** or **Review Summary Update**. It shows the agent's name and a **Proposed Text** box you can edit. For lorebook writes it also reminds you to keep each entry under a `###` heading.

- **Accept** saves the text, including your edits.
- **Regenerate** reruns only that agent for a fresh proposal.
- **Discard** drops the proposal without saving.

If more proposals are waiting, the window shows how many. It reopens for the next one when you finish the current one.

An agent with the **Create character cards** ability can also propose a new character card. It opens a review window with the card text. Nothing is saved until you accept.

### Review a character card update

The **Card Evolution Auditor** agent suggests edits to a character card based on what happened in the roleplay. In Conversation, the built-in `update_about_me` tool can also propose a public About Me change. Neither edits your card on its own. Both open **Review Character Card Updates**.

For each proposed edit the window shows the card field it touches, a short reason when the agent gives one, a **Before** block with the current text and an **After** box you can edit.

- **Approve** applies the edits. The number in the button is how many will apply. It raises the character's version number and saves a version-history entry.
- **Regenerate** reruns the agent for new proposals.
- **Reject** dismisses them without changing the card.

If the card changed after the agent wrote its proposal, the edit is marked stale and dimmed. An **Override stale** button then appears with the count. Use it only if you still want that text. Marinara asks you to confirm, then adds the stale text to the field instead of replacing text that no longer matches.

## View and edit what agents stored

The **Agent Suite** shows everything the agents in this chat have stored: tracker data such as the current scene, present characters and persona stats, plus the saved output of custom agents. Use it to fix a wrong name, correct a stat or clean up messy text.

1. Open **Chat Settings** and scroll to **Agents**.
2. Click **Agent Suite**.
3. Pick an agent from the list on the left.

The right side shows editable blocks in up to three groups: **Stored Memory**, **Tracker Data** (tracker agents only) and **Recent Outputs** (custom agents only). Agents that do not track data show only **Stored Memory**.

Each block is a text or JSON editor. JSON blocks show line numbers and report invalid JSON right away. **Save** stays off until it parses. To search all tracker data or edit it as fields, click **Open in State Editor** in the **Tracker Data** header. See [The State Editor](../roleplay/hud-and-trackers.md#the-state-editor).

After you change a block, click **Save** to keep it or **Reset** to go back to the stored value.

### Let AI rewrite a block

1. Click **AI Edit** on the block.
2. To change only part of it, select that text first. With no selection, the whole block is rewritten.
3. Type an instruction, for example "fix the garbled character names, she is called Mira".
4. Optional: click **Add Context** to attach character cards or lorebook entries so the AI knows what the data means.
5. Pick the connection (the AI service and model) that does the rewrite.
6. Click **Rewrite**.

The result goes into the block as an unsaved draft. Review it, then **Save** or **Reset**.

- While agents still run for this chat, saving waits until they finish.
- **Clear memory** appears in **Stored Memory** only when the agent has stored data. It deletes everything that agent stored for this chat at once and cannot be undone. Marinara asks you to confirm first.
- For the **Narrative Director**, stored spoilers are hidden. Use **Reveal spoilers** to view and edit them.

## See cached prompt injections

Before a reply is generated, some writer agents add text to the prompt. This is common for **Prose Guardian**, **Narrative Director** and custom injection agents. The **Cached prompt injections** panel shows that text for the most recent reply. It is a troubleshooting view.

Before you start: turn on **Debug mode** (see [Agents overview](agents-overview.md#tell-whether-an-agent-ran)). In a Roleplay chat, open the **Injections** tab of **Agent activity**. See [Agent activity](../roleplay/getting-started.md#agent-activity).

For each injection you can expand it to read and edit the text, click the **Save** icon to keep your edit, or click the **Re-run** icon to have that agent write a fresh one.

**Knowledge Retrieval** and **Knowledge Router** injections cannot be re-run here. Edits and re-runs take effect only if you regenerate that same reply. A re-run uses the chat history from that point, not newer messages.

## Related guides

- [Agents Overview](agents-overview.md)
- [Downloadable Agents Reference](built-in-agents.md)
- [Creating and Editing Characters](../characters/creating-and-editing-characters.md)
