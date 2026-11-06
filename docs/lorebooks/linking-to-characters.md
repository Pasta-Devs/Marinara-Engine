# Linking Lorebooks to Characters and Personas

Link a lorebook to a character or persona and it turns on by itself in the right chats. You can also embed a lorebook inside a character card, and control lorebooks for one chat. New to lorebooks? Start with [Lorebooks Overview](overview.md).

## Link or embed

| Feature | Link (assign) | Embed |
| --- | --- | --- |
| What happens | The character or persona points to a lorebook in your library. | The lorebook is written into the character card. |
| Turns on | In chats with that character or persona. | Same, and it travels with the card. |
| Exports with the card | No | Yes |
| Available for | Characters and personas | Characters only |

Most of the time, link. Embed only when you plan to share the card with its lorebook.

## The Lorebook tab in the editor

The character editor and the persona editor both have a **Lorebook** tab.

1. Open a character or persona for editing.
2. Click the **Lorebook** tab. The **Lorebooks** section has two buttons, **New** and **Assign Lorebook**.

**New** creates a lorebook already linked to this character or persona, with its category set to **Character**. **Assign Lorebook** links a lorebook you already have.

## Assign an existing lorebook

Before you start: the picker lists only lorebooks whose **Category** is **Character**, for personas too. If a lorebook is missing, open it, set **Category** to **Character** on the **Overview** tab, and try again.

1. In the **Lorebook** tab, click **Assign Lorebook**.
2. Type part of the name in the search box.
3. Click the lorebook. A check mark appears.
4. Leave **Scope** on **All chats with** the name, or change it (see below).
5. Click **Assign**.

The lorebook now shows in the assigned list. Use the **Scope** button on its row to change the scope, and the trash icon to remove the link. Click the name to open the lorebook.

A global lorebook cannot also be linked. See [Lorebooks Overview](overview.md).

### Scope

**Scope** decides which chats may use the linked lorebook. Only chats with this character, or using this persona, are ever considered.

| Scope | Result |
| --- | --- |
| **All chats with** (the name) | The default. It turns on in every such chat. |
| **Disabled for all chats** | The link stays, but the lorebook never turns on. Use it to pause. |
| **Specific chats** | Only the chats you check in the list. Check at least one before you can save. |

To change scope later, click **Scope** on the row, adjust it, and click **Assign** again.

## Embed a lorebook into a character card

Before you start: assign the lorebook to the character first (see above).

1. Open the character and click the **Lorebook** tab.
2. On the lorebook's row, click **Embed into card**.

An **Embedded** badge appears on the row, and the entries now export with the card.

A card holds one embedded lorebook. If it already has one, **Embed into card** is disabled, and its tooltip says to remove the current embedded lorebook first.

After you edit the linked lorebook, click **Refresh** on its row to rewrite the embedded copy from the current entries.

### Manage an embedded lorebook

When a card has an embedded lorebook, these controls appear under the assigned list, with a read-only list of its entries.

- **Import Embedded Lorebook** turns the card's entries into a normal lorebook in your library, linked back to the character. Once a linked copy exists, the button reads **Reimport Embedded Lorebook**.
- **Edit Embedded Lorebook** opens that linked lorebook. Your edits sync back into the card's copy.
- **Remove from card** deletes the embedded copy. A separately linked lorebook is left alone.

Many cards imported from other tools arrive with an embedded lorebook. Click **Import Embedded Lorebook** to get an editable version.

## The Chat Settings Lorebooks section

Each chat has its own lorebook controls.

1. Open a chat.
2. Open **Chat Settings**.
3. Find the **Lorebooks** section. A badge shows how many lorebooks are active.

Each active lorebook has a badge that says why it is on.

| Badge | Meaning |
| --- | --- |
| **Chat** | You added it to this chat. |
| **Global** | It is a global lorebook. |
| **Character** | It is linked to a character in this chat. |
| **Persona** | It is linked to this chat's persona. |

You can change what is active for this chat only.

- **Add Lorebook** adds a lorebook to this chat. It shows the **Chat** badge.
- The trash icon (**Remove from chat**) removes a lorebook you added.
- The eye-off icon (**Disable in this chat**) hides an automatic lorebook here without unlinking it. It then shows a struck-through name and a **Disabled** badge.
- The eye icon (**Enable in this chat**) turns it back on.

### Lorebook Token Budget

**Lorebook Token Budget** caps how many tokens of lorebook text this chat can add. The default is 8192, and 0 means no cap. It applies on top of each lorebook's own **Token Budget**. See [Lorebook Token Budgets and Recursion](token-budgets.md).

## Related guides

- [Lorebooks Overview](overview.md)
- [Lorebook Token Budgets and Recursion](token-budgets.md)
- [Importing and Exporting Lorebooks](import-export.md)
- [Creating and Editing Characters](../characters/creating-and-editing-characters.md)
- [Chat Settings Overview](../chats/chat-settings.md)
