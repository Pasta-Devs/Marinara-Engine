# Connecting a Conversation to a Roleplay or Game

This guide explains how to link a Conversation chat to a Roleplay or Game chat so the two share context. It also covers **Cross-Chat Awareness**, the special tags that pass information across a link, and how to jump between linked chats.

Guksu Motor (called Guksu after this) has two separate features that let chats know about each other. One is automatic. The other is an explicit one-to-one link you set up yourself. This guide keeps them apart, because they work in different ways.

## What Connected Chats do

**Connected Chats** join one Conversation chat to one Roleplay or Game chat. The link is one-to-one. Each chat can be connected to only one other chat at a time.

Once linked, the Conversation side automatically reads the linked story chat's recent messages. It pulls them into its own context every turn. This is the automatic direction of the link.

The story chat (the Roleplay or Game) does not automatically read the Conversation's messages back. To send information the other way, a character uses special tags. Those tags are described further down.

A common use: you run an immersive Roleplay or Game in one chat, and a casual out-of-character (OOC) direct-message chat in a Conversation. The OOC chat stays aware of the story, so you can talk about it as it happens.

## Cross-Chat Awareness is not the same as a link

Two features are easy to confuse. Read this section before you set anything up.

**Cross-Chat Awareness** is automatic. It is a Conversation-mode setting. When a character is present in more than one Conversation chat, it can remember and reference what happened in those other chats. You do not link anything by hand. The setting is on by default.

You find it in the **Cross-Chat Awareness** section of **Chat Settings**. Its help text reads: "Characters remember and reference conversations from other chats they're in. Pulls recent messages from sibling chats and injects them as context." Guksu matches these sibling chats by shared character, not by shared user.

A **Connected Chats** link is different. It is something you create on purpose. It joins exactly one Conversation to one Roleplay or Game chat. It carries story context and the special tags described below.

In short: **Cross-Chat Awareness** links a character across its own Conversation chats automatically. A **Connected Chats** link joins one Conversation to one story chat by hand.

## Linking a Conversation to a Roleplay or Game chat

You start the link from the Conversation chat, or from a Game chat. Follow these steps to start from the Conversation side.

1. Open the Conversation chat you want to link.
2. Open **Chat Settings** (the gear).
3. Find the **Connected Chats** section.
4. Click **Link to Roleplay or Game**.
5. Search for the Roleplay or Game chat in the picker, then click it.

You should now see the linked chat's name and its mode inside the **Connected Chats** section. A small unlink button sits next to it.

To start the link from a Game chat instead, open that chat's **Chat Settings**, find **Connected Chats**, and click **Link to Conversation**. Then pick the Conversation.

A Roleplay chat does not have its own link button. It shows the link once one exists, but you must create the link from the Conversation side.

Only chats that are not already linked appear in the picker. A chat can hold one link at a time.

### Removing a link

To remove a link, open **Chat Settings**, find **Connected Chats**, and click the unlink button (its tooltip reads **Disconnect**). Disconnecting also clears any pending influences and saved notes tied to that link.

Deleting a chat also disconnects it from its linked chat.

## Passing information across the link

The Conversation reads the story chat automatically. The other directions use tags. These tags appear inside a character's messages. The AI writes them. You do not normally type them yourself, but knowing what they do helps you understand the bridge.

Write these tags as literal text if you ever need to reference them. Each is shown here in code so it displays exactly.

- `<influence>` sends a one-time steer from the Conversation into the linked story chat. It affects the very next linked turn, then it is used up.
- `<note>` saves a durable fact from the Conversation into the linked story chat. It stays in the story chat's prompt on every turn until you clear it.
- `<ooc>` lets a Roleplay character step out of the story and reply directly to the linked Conversation. Guksu posts that text to the linked direct-message chat.

So a Conversation character can quietly shape or inform the story with `<influence>` and `<note>`. A Roleplay character can talk back to the Conversation with `<ooc>`.

## Conversation Notes

When a Conversation character saves a durable `<note>`, it shows up on the story side. The Roleplay or Game chat gets a **Conversation Notes** section in its **Chat Settings**.

This section lists every saved note. Each note has a delete button. To remove all of them at once, use the **Clear all notes** button. Guksu asks you to confirm before it clears them, and this cannot be undone.

If no character has saved a note yet, the section explains that notes wrapped in a `<note>` tag will appear here once saved.

## Switching between connected chats

When a chat has a linked chat, its toolbar shows a switch button. It uses a double-arrow icon. Its tooltip reads "Switch to" followed by the other chat's name.

Click it to jump straight to the connected chat. This saves you from finding the other chat in the chat list by hand. The button appears on both the Conversation side and the Roleplay side of a link.

## Other controls in this section

The **Connected Chats** section also holds two extra controls that belong to other features. They render here for convenience.

- A **Discord webhook URL** box. It has no visible label, only a placeholder that starts with `https://discord.com/api/webhooks/`. Pasting a Discord webhook URL here mirrors the chat's messages to a Discord channel. This is part of the Discord message mirror feature, which has its own guide.
- An **Allow Noodle references** toggle (off by default). It lets the in-app Noodle timeline pull recent messages from this chat. Noodle has its own guide.

On the Roleplay side, you will also see an **Allow character DMs** toggle (off by default). When on, it lets a Roleplay character open a new Conversation direct message with you from inside the story. This works even when no Conversation is linked yet.

## Related guides

- [Conversation Mode: Getting Started](../conversation/getting-started.md)
- [Roleplay Mode: Getting Started](../roleplay/getting-started.md)
