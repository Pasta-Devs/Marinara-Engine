# Choosing Your Persona in a Chat

This guide explains how to pick which persona represents you in a chat. It covers your global active persona, per-chat persona overrides, and the quick switchers.

## Your active persona and per-chat personas

A persona is your own character card, the identity Guksu Motor uses to represent you. It gives the AI your name and details so the AI knows who it is talking to. To learn how to build one, see [User Personas](personas.md).

Guksu chooses your persona in two layers:

- Your **active persona** is your global default. Guksu uses it in any chat that has no persona of its own.
- A per-chat persona overrides the active persona for one chat only.

You can have exactly one active persona at a time. You can also have none.

## Setting your active persona

Follow these steps to set your global default persona.

1. Open the **Personas** panel from the right sidebar (the person icon).
2. Move your pointer over the persona you want in the list.
3. Click **Set as active** (the check icon on that row).

The active persona shows a small check badge on its avatar. Setting a new one clears the badge from the old one, so only one persona is ever active.

You can filter the list with the **Active** and **Inactive** chips to see which persona is your default.

New, duplicated, and imported personas are never active on their own. You must set one active yourself.

## Choosing a persona for one chat

Every chat can store its own persona. This is a per-chat persona override, and it always wins over your active persona.

### From Chat Settings

1. Open **Chat Settings** (the gear near the chat).
2. Find the **Persona** section. Its help text starts with "Your persona defines who you are in this chat."
3. When no persona is set, you see "No persona selected."
4. Click **Choose Persona**. This button reads **Change Persona** once a persona is set.
5. Search in the picker (placeholder "Search personas...") and click a persona.

To clear the per-chat persona, click the remove (X) button next to it, or pick **None** at the top of the picker.

In Game Mode this section is framed as your in-game party, but it still uses the **Persona** label.

### When you create a chat

The New Chat setup wizard has a **Your Persona** field. It uses the same searchable picker and a **None** option. In the New Game Setup wizard, this field is labeled **Player's Persona** instead.

## The Quick Persona Switcher

Once a chat is open, a small round avatar button sits near the message box. This is the **Quick Persona Switcher**. Its tooltip shows this name when no persona is set.

1. Click the avatar button.
2. A menu titled **Personas** opens.
3. Click any persona to switch instantly, or click **None** to use no persona.

Personas are grouped by folder. Personas without a folder appear under **Ungrouped**.

On mobile, persona switching shares a menu with connection switching. Tap the **Quick Switcher** chevron near the message box, then open the **Personas** tab. The **Connections** tab sits in the same menu.

## Which persona wins

Guksu picks your chat persona in this order:

1. The chat's own per-chat persona, if you set one.
2. Otherwise, your global active persona.
3. If you have neither, the AI addresses you as "User" and sends no persona details.

In Game Mode, you choose your persona once in the New Game Setup wizard. The chat keeps the persona you picked there. On screen, a Game Mode chat does not switch to your active persona.

Switching your persona in the middle of a chat does not rewrite earlier messages. Each message you already sent keeps the persona it was sent under.

## Related guides

- [User Personas: Creating and Editing](personas.md)
- [Chat Settings Overview](../chats/chat-settings.md)
