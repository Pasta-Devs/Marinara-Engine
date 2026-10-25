# Novel Mode: Writing a Story Together

This guide explains Novel Mode in Marinara Engine. Novel Mode turns a Roleplay chat into one continuous page, like a manuscript, where you and the AI write a story together. It covers how to start a novel, write and edit passages, steer the AI, and listen to the story.

## What Novel Mode is

Novel Mode is a display style for Roleplay chats. The story reads as one page instead of a chat: there are no avatars, names, timestamps, or message bubbles. Each time the AI writes, it adds a passage to the page. Paragraphs are indented as in a printed book, and passages run on into each other.

Unlike a regular roleplay, the AI also writes your protagonist. It writes their actions, dialogue, and thoughts, so the story keeps moving without waiting for your turn. You steer it instead, by writing passages of your own, editing what is already on the page, and giving short guidance for the next passage.

A novel is still a Roleplay chat underneath. Lorebooks, summaries, memory, branches, and agents all work the same way they do in any roleplay.

With several characters, a novel always uses the **Merged** group mode: the AI writes every character in one voice, the way a novelist does, so there are no turns to take. Chat Settings hides the group mode, response order, and dialogue color options for novels. The group **Scenario Override** still applies.

## Starting a novel

1. Start a new Roleplay chat.
2. In the setup wizard's first step, set **Display style** to **Novel**.
3. Finish the wizard. Characters and a persona are optional. Add characters only if you want their cards in the story's context.

Choosing **Novel** keeps your agents, as in any roleplay. Sprites, the HUD, and weather effects show when the agents behind them are on (Expression Engine, World State, and the tracker agents); remove those agents in the wizard or in **Chat Settings** for a plain page. Novels show a book icon in the chat list.

Choosing **Novel** also selects **Marinara's Novel Preset**, which tells the AI to write your protagonist (see below). You can pick another preset in the wizard's **Preset** step or later in **Chat Settings**. If you switch back to another display style in the same wizard, your earlier preset returns, unless you picked a different one in the meantime.

## Writing and editing

- **Add your own text:** type on the line at the end of the page, which reads **Keep writing, or press Send…**. When you leave the line or press **Send**, your text becomes the next passage of the story.
- **Edit anything on the page:** the whole page is one editor. Click anywhere and type, as in a word processor. Your changes save on their own a moment after you stop typing, and **Ctrl+Z** undoes them.
- **Formatting:** to make text *italic* or **bold**, select it and press **Ctrl+I** or **Ctrl+B** (**Cmd** on a Mac). Other formatting, such as headings and lists, shows as plain text. Editing a passage keeps its line breaks as they were.
- **Selecting across passages:** you can select, copy, and delete text that spans several passages. Each passage stays its own part of the story: deleting across them removes text from each one, never the passages themselves. If you empty a passage completely and move on, Marinara asks whether to delete it.
- **Passage actions:** point at a passage, or put the cursor in it, to see its actions in the margin: copy, translate, retry, bookmark, pin or note, **Mark as new start**, hide from the AI, branch, and delete, plus **Speak** when text to speech is on. The last passage also has **Peek prompt**, and a passage written with guidance has **Stored guidance**, which shows the direction it was given. On a phone, tap the passage, or move the cursor into it, to show them.

## Asking the AI for more

The message bar under the page works as in any roleplay, with one difference: what you type there never becomes a message. It only steers the next passage.

- **Send** with an empty bar writes the next few paragraphs of the story.
- Type a short direction, such as `a storm arrives`, and press **Send**. The AI steers the next passage toward it without writing it into the story.
- Slash commands, dictation, and the connection and persona switchers work as usual. Attachments and the **Post only** and **Guide reply** quick replies are not offered: nothing you post becomes a message, and **Send** already sends your text as guidance.
- Impersonate is not offered in a novel: there is no turn of yours to write, because the AI already writes your protagonist. The `/impersonate` command, the Impersonate quick reply, and the Impersonate chat settings are hidden, and so is `/send`, which would post a message as your persona.
- With the CYOA agent on, choosing one of its options steers the next passage toward it, like guidance. It never becomes a message of yours, so the Impersonate switch on the choices is hidden. With **Add CYOA choices to the message box instead of sending them** on, the choice goes into the message bar instead, where you can combine it with your own guidance.
- To write a passage again, use retry (**Regenerate**) in its actions. Your edits are saved first. With **Guide swipes/regens with chat input** on in **Settings** and text in the message bar, the button reads **Regenerate (guided)** and steers the new version toward that text, as **Send** does. Once a passage has more than one version, arrows under it switch between them, and any edit you were typing is saved to the version you typed it on.
- While the AI is writing, **Send** becomes **Stop**.

## How the AI is told to write a novel

**Marinara's Novel Preset** is a built-in preset written for novels. It tells the AI that it is co-writing one book with you. The AI writes every character, your protagonist included. It writes book prose, with dialogue in quotation marks. It uses *italics* only for thoughts and emphasis, and no other formatting. Each passage continues from where the page ends. It stops at a natural pause, never on a question to you. The AI follows the guidance you type in the message bar, but never copies it into the story.

Who the protagonist is depends on how you set the novel up:

| Setup | Protagonist | Cast |
| --- | --- | --- |
| No persona and no characters | The protagonist the manuscript already follows. On an empty page, the AI establishes one with a name, a voice, and something they want, and keeps them consistent. | No prepared cast. The AI brings in characters as the story needs them. |
| A persona and characters | Your persona. The AI reads its profile to write them. | Your characters, each kept true to their card. |
| Characters but no persona | The protagonist the story already follows. On a new page with one character, that character is the protagonist. If the card describes someone else as the lead, the AI creates that person. With several characters, the AI picks one of them, or creates a new lead if the cards point to someone else. | Your characters. |
| A persona but no characters | Your persona. | No prepared cast. |

A persona needs a description or other text to count. A persona with only a name is ignored. Without a persona, a character card that refers to you shows the word "User" instead, so for a novel without a persona, use cards that name the protagonist or don't refer to you.

The preset asks a few questions when you start the novel. The first option of each is the default.

- **Content rating:** NSFW or SFW.
- **Point of view:** third, first, or second person.
- **Narration style:** close to the protagonist, shifting between characters at scene breaks, or all-knowing (omniscient).
- **Tense**, passage **Length**, and **language**.

Like Marinara's Universal Preset, the Novel preset is read-only and cannot be deleted. Open it in **Presets** and create an editable copy to change its wording. It uses your connection and chat generation settings rather than its own. See [Prompt Presets](../prompts/presets.md).

A few things to know:

- In Roleplay chats, a connection with its own preset override uses that preset instead, in novels too.
- The **Visual Novel display** toggle in **Settings > Appearance** can change a novel to Visual Novel or Classic. The Novel preset stays selected. To stop the AI from writing your protagonist, pick another preset in **Chat Settings**.
- The same toggle also sets the default display style for Roleplay chats that have no saved style, not only the open novel.
- Another preset works in a novel too, but most roleplay presets tell the AI never to write your character. Marinara's Universal Preset does, so with it the AI leaves your protagonist to you.

## Listening to the story

When text to speech is on, each passage's actions include **Speak**. With **Only read dialogues** off, narration is read too, in the narrator voice when **Use separate narrator voice** is on. With **Only read dialogues** on, only the quoted dialogue is read.
