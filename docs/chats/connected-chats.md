# Connecting a Conversation to a Roleplay or Game

Link a Conversation chat to a Roleplay or Game chat so the two share context. A common use: you run a story in one chat and talk about it out of character (OOC) in a Conversation that stays aware of the story.

The **Connected Chats** section of **Chat Settings** holds two different features. A **Connected Chats** link is one-to-one and you set it up by hand. **Cross-Chat Awareness** is a toggle that works on its own and lets a character remember its other Conversation chats.

## How a link works

A link joins one Conversation to one Roleplay or Game chat. Each chat can have only one link at a time.

- The Conversation reads the linked story chat's recent messages automatically, on every turn.
- The story chat does not read the Conversation back. Characters pass information the other way with tags, described below.

## Linking a Conversation to a Roleplay or Game chat

Before you start: have both chats ready. See [Managing Your Chat List](managing-chats.md).

1. Open the Conversation chat and open **Chat Settings**. See [Chat Settings](chat-settings.md).
2. Open the **Connected Chats** section.
3. Click **Link to Roleplay or Game**.
4. Search for the chat in the picker, then click it.

The section now shows the linked chat's name and mode, with a small unlink button.

If it did not work: only chats that are not already linked appear in the picker. Unlink the other chat first.

To start from a Game chat, open its **Chat Settings → Connected Chats**, click **Link to Conversation**, and pick the Conversation. A Roleplay chat has no link button. It shows the link once one exists, so create it from the Conversation side.

### Remove a link

Open **Chat Settings → Connected Chats** and click the unlink button (labeled **Disconnect**). This also clears pending influences and saved notes tied to the link. Deleting a chat disconnects it too.

## Cross-Chat Awareness

**Cross-Chat Awareness** is a toggle in the **Connected Chats** section of a Conversation. Its description reads "Characters know what happens in their other chats". When a character is in more than one Conversation chat, it can remember and mention what happened in the others. Marinara matches those chats by shared character, not by shared user. It is on by default and needs no link.

## Passing information across the link

Characters write these tags inside their messages. You do not need to do anything. This is how the two chats talk to each other.

| Tag | What it does |
| --- | --- |
| `<influence>` | A one-time steer from the Conversation into the linked story chat. It affects the next linked turn, then it is used up. |
| `<note>` | Saves a lasting fact from the Conversation into the story chat. It stays in the story chat's prompt on every turn until you clear it. |
| `<ooc>` | Lets a Roleplay character step out of the story and reply to the linked Conversation. Marinara posts the text there. |

### Conversation Notes

Saved `<note>` facts appear in a **Conversation Notes** section in the story chat's **Chat Settings**. Each note has a delete button. **Clear all notes** removes all of them after you confirm, and this cannot be undone. With no notes, the section says notes wrapped in a `<note>` tag will appear there.

## Switching between connected chats

With a link in place, a **Connected chat** button (a double-arrow icon) appears on both chats. On a computer it starts at the top right, and you can drag it. On a phone, open the **Chat tools** three-dot menu, open **Connected chat**, and choose **Switch to** and the other chat's name.

To keep the control inside Chat Settings, choose **Put back in Chat Settings**. It then appears as its own **Connected chat** section. Use that section's pop-out button to make it a separate window again.

## Other controls in this section

- **Discord webhook URL**: a box with no label, only a placeholder that starts with `https://discord.com/api/webhooks/`. Paste a webhook URL to mirror the chat's messages to a Discord channel. It has its own guide.
- **Allow Noodle references**: lets the Noodle timeline pull recent messages from this chat. It is off by default and appears only when Noodle is installed.
- **Allow character DMs** (Roleplay): lets a Roleplay character open a new Conversation direct message with you from inside the story. It is off by default and works even with no link.
