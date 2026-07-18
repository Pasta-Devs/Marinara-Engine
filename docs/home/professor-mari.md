# Professor Mari, Your In-App Assistant

Professor Mari is Guksu Motor's built-in assistant on the Home screen. This guide shows where to find her, what she can do, how she keeps her changes reversible, and how to fix common problems.

## Where to find her

Professor Mari lives on the Home screen. The Home screen is what you see when no chat is open.

Look for the card with her pixel art and the heading **Professor Mari**. A status line reads **Ready to help** when she is idle, or **Working on it...** while she is busy. Click the **Ask Professor Mari** button to open her full chat window.

You talk to her in plain language. Type a message in the box, then press Enter to send. Press Shift and Enter together to add a new line instead.

Sending your very first message to her unlocks the **Hello World** achievement.

## What she can do

Professor Mari is more than a question box. She can explain the app, help you get set up, and make things for you when you ask.

Ask her for help with any of these:

- Explaining a setting, a mode, or a concept before you change anything.
- Creating or editing a character. A character is a card that gives the AI a name, personality, and voice.
- Creating or editing a persona. A persona is the identity you play as in a chat, the "you" in the story.
- Creating or editing a lorebook. A lorebook is a set of world notes the AI pulls in when they are relevant.
- Creating or editing a theme, an agent, or a prompt preset. A theme is a look for the app. An agent is a background AI helper. A preset is a saved bundle of prompt settings.
- Comparing all 29 official downloadable agents and feature packages, explaining which modes they support, and advising which ones fit a user's goal. She distinguishes catalog availability from what is actually installed, directs users to **Agents → Download Agents** when needed, and knows that package sources and the complete catalog are available in [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents).
- Generating or assigning images, such as avatars, sprites, and backgrounds. A sprite is a character image, like a portrait or a full body pose, shown during a chat.
- Looking up public Fandom wiki pages to help you research a character or world.
- Following quick-reply suggestion chips above the chat input, color-coded by entity type, through a multi-step creation or edit.

She reads an item before she edits it, and she asks for missing details when your request is vague. For image tasks you need a working image generation connection set up first. She does not create one for you.

## Guided suggestion chips

On an empty Professor Mari chat, starter chips such as **Create a Character**, **Create a Lorebook**, and **Create a Persona** help begin common tasks. During a guided creation or edit, the chips change to match the next step. Clicking a chip fills the input draft; you can edit that draft before sending it.

Guided flows ask one focused question at a time instead of presenting a long form all at once.

## She can also read and edit the app's own files

Professor Mari can look inside Guksu's own program files, change them, and run commands on your computer. This is a real and powerful ability, so it is worth understanding clearly.

Here is the trust boundary in plain terms:

- She works only inside the folder where Guksu is installed. She cannot reach the rest of your computer.
- She cannot write straight into your saved data folder, where your characters and chats live. Instead she uses the reviewable change flow described below.
- Commands she runs stop on their own after a short time, so a stuck command cannot run forever.

Most people never need this. It exists so she can inspect or repair the app itself when something is broken.

## Picking a connection

Professor Mari needs a connection to think. A connection links Guksu to an AI provider using an API key. An API key is a secret code from that provider.

Click the link icon next to the paperclip to open the **Connections** dropdown. Pick any text generation connection you have set up. If you have downloaded the built in local model, it appears here too as **Local Model (sidecar)**. If the app knows the model's name, that name shows in the parentheses instead. Your choice is remembered in your browser.

If you have no connections yet, the dropdown shows **Add a connection** instead. If you try to send a message with no connection, the **Connections** panel opens for you. You also see this pop-up message (called a toast):

> You haven't set up a connection yet! Click the link icon beside the paperclip to select one.

For a full walkthrough, see the connection guide linked at the end.

## Attaching files

Click the paperclip button, labeled **Attach files**, to add a file to your message.

She accepts images, PDF files, and common text files such as `.txt`, `.md`, `.json`, `.csv`, and `.log`. Each file can be up to 20 MB. Attached files show as removable chips above the message box before you send.

To have her read an image, your selected connection's model must support image input.

## Reviewing her changes (Keep and Restore)

When Professor Mari edits something you already have, she saves the change right away and then shows a review card. This lets you undo it if you do not like the result.

The card is titled **Review Mari's changes**. It shows what she did and which data it touched. It has two buttons:

- **Keep** confirms the change. You see the message "Kept Mari's workspace change."
- **Restore** puts the previous saved version back. You see the message "Restored the previous app data snapshot."

A few things to know:

- Brand new items, like a fresh character or lorebook, usually skip this step. Nothing existing was overwritten, so there is nothing to undo.
- A review card expires on its own after 10 minutes if you do not answer it.
- Characters and personas also keep their own version history inside their editors. You can restore an older version there as a second safety net.

## Custom Skills

A Skill is a short instruction document you write to change how Professor Mari handles a certain kind of request.

Click the **Skills** button in her chat header to open the **Professor Mari Skills** panel. From there you can:

- Click **New** to start a Skill from a template.
- Click **Upload** to add a Skill from a `.md` or `.txt` file.
- Toggle each Skill on or off. A Skill that is off still exists but is not used.
- Select a Skill to edit its **Name**, **Description**, and **Instructions**, then click **Save**. Click **Delete** to remove it.

When you have no Skills yet, the panel reads **No custom skills yet**.

## Chat history and Restart

Professor Mari keeps her own separate chats. They do not appear in your normal chat list.

Click the **Chats** button in her header to open your saved Professor Mari chats. The panel notes: "Restart saves the current chat here." You can click a saved chat to open it, rename it, or delete it.

Click the **Restart** button to start a fresh conversation with her. Restart first saves your current chat into the **Chats** list. You can also type `/restart` in the message box to do the same thing. You see the message "Professor Mari's previous chat was saved."

While she is working, a **Stop** button appears in the header. Click it to cancel the current task.

## The floating chat bubble

If you leave her chat window open and then move to another page, Professor Mari can follow you as a small floating bubble.

On a phone or a narrow screen, she becomes a small round avatar you can drag around. Tap it to reopen the full chat. On a wide screen, a small draggable **Ask Professor Mari** window appears. Each version has a control to dismiss the bubble for the rest of your session.

## Her FAQ is separate from the chat

Next to her chat card, the Home screen shows an **FAQ** panel. This is a fixed, written list of questions and answers. It is not the AI chat.

Type in the **Search FAQ** box to filter the questions. Each question has a colored category tag, such as **Setup**, **Connections**, or **Game Mode**. Tap a question to read its answer.

Because the FAQ is written into the app, it does not know your live setup. For anything about your own data or current state, use the chat.

## Limitations and safety

Professor Mari is a helper, not the full documentation. Keep these limits in mind:

- She cannot promise her built in knowledge matches your exact app version. When something is version specific or recently changed, trust the guides and release notes first.
- Creating new content is usually safe, since nothing gets overwritten. Editing existing content deserves more care.
- For edits, name the exact item and the exact field you want changed. A request like "rewrite this whole character" is riskier than "make Luna's greeting shorter, keep her personality the same."
- For multi-step creation, use the suggestion chips to answer one focused question at a time instead of trying to provide every field at once.
- If she says she finished a task but the app does not show it, trust the app. Finish the task yourself from the matching panel.
- If you reach Guksu from another device instead of the same computer, her editing actions need remote access set up. See the remote access guide.

## Troubleshooting

- No reply at all: check that a connection is selected using the link icon. If none is set up, open the **Connections** panel and add one.
- "You haven't set up a connection yet" pop-up message: pick a connection from the link icon dropdown, or add one first.
- She cannot read your attached image: your model must support image input. Switch to a connection whose model can see images.
- Fandom lookups fail: these need an internet connection, since Fandom is an outside website.
- Her actions are blocked with a permission error: you are reaching Guksu over a network, not from the same computer. Set up remote access first.

## Related guides

- [Getting Started with Guksu Motor](welcome.md)
- [The First-Time Tutorial](tutorial.md)
- [Connecting to an AI Provider](../connections/connecting-to-a-provider.md)
- [Creating and Editing Characters](../characters/creating-and-editing-characters.md)
- [Downloadable Agents Reference](../agents/built-in-agents.md)
- [Remote Access: Basic Auth and IP Allowlist](../REMOTE_ACCESS.md)
