# Linking Lorebooks to Characters and Personas

This guide shows how to link lorebooks to a character or a persona so they turn on automatically in the right chats. It also covers embedding a lorebook inside a character card, and the per-chat **Lorebooks** controls. A lorebook is a keyword-triggered set of world-info entries. See [Lorebooks Overview](overview.md) if you are new to them.

## Two ways to attach a lorebook

There are two different ways to attach a lorebook to a character. They behave differently, so pick the one you want.

- **Link (Assign)**: the lorebook stays in your library. The character or persona points to it. The lorebook turns on by itself in chats that include that character or use that persona. A linked lorebook does NOT travel inside an exported character card.
- **Embed**: the lorebook is written into the character card itself. It travels with the card when you export or share the character. Embedding is available for characters only, not personas.

Most of the time you want to link a lorebook. Embed only when you plan to share the character card with the lorebook baked in.

## The Lorebook tab in the editor

Both the Character editor and the Persona editor have a **Lorebook** tab.

1. Open a character or persona for editing.
2. Click the **Lorebook** tab.
3. You will see a **Lorebooks** section with two buttons: **New** and **Assign Lorebook**.

**New** creates a fresh lorebook that is already linked to the character or persona you are editing. It opens the **Create Lorebook** window with the **Category** set to **Character**.

**Assign Lorebook** links an existing lorebook from your library. The picker only shows lorebooks in the **Character** category. This is described next.

## Assign an existing lorebook

The **Assign Lorebook** picker only shows lorebooks whose **Category** is **Character**. This is true when editing a persona too. A lorebook in another category, such as World or NPC, will not appear in the picker or in the assigned list. To make it appear, open the lorebook and set its **Category** to **Character** on the **Overview** tab. The **New** button avoids this problem, because it creates a Character-category lorebook for you.

1. In the **Lorebook** tab, click **Assign Lorebook**.
2. In the search box, type part of the lorebook name to find it.
3. Click the lorebook you want. A check mark appears next to it.
4. On the right, choose a **Scope** (see the next section).
5. Click **Assign**.

The lorebook now appears in the assigned list. Each assigned lorebook row has a **Scope** button to change its scope later, and a trash icon to remove the link. Click the lorebook name to open it in the full editor.

A lorebook that is set to Global is active in every chat. It cannot also be linked to a character or persona. Global is explained in [Lorebooks Overview](overview.md).

## Scope: which chats can use the linked lorebook

**Scope** controls where a linked lorebook is allowed to turn on. It does not mean every chat in Guksu. It means chats that include this character, or that use this persona. There are three scope modes.

- **All chats with [name]**: the default. The lorebook turns on in every chat that includes this character or uses this persona.
- **Disabled for all chats**: the link stays, but the lorebook never turns on. Use this to pause a lorebook without unlinking it.
- **Specific chats**: you pick exact chats from a checklist. Only the chats you check can use the lorebook. The list shows chats that already include this character or use this persona.

If you choose **Specific chats**, you must check at least one chat before you can save.

To change scope later, click the **Scope** button on the assigned lorebook row, adjust it, and click **Assign** again.

## Embed a lorebook into a character card

Embedding writes a lorebook into the character card so it exports with the character. This is for characters only. Use it when you want to share a character that already carries its world info.

1. Open the character in the Character editor.
2. Go to the **Lorebook** tab.
3. Make sure the lorebook you want is already assigned (see above).
4. On that lorebook's row, click **Embed into card**.

You should see an **Embedded** badge appear on the row. From now on the lorebook entries live inside the card and export with it.

A character card holds one embedded lorebook at a time. If a card already has one, the **Embed into card** button is disabled with the note "Remove the current embedded lorebook first". Remove the existing embedded copy before embedding a different lorebook.

If you edit the linked lorebook after embedding, click **Refresh** on its row. This rewrites the embedded copy from the lorebook's current entries, so the baked-in copy stays up to date.

## Managing an embedded lorebook

When a character card already has an embedded lorebook, extra controls appear below the assigned list. A read-only list of the embedded entries appears there too.

- **Import Embedded Lorebook**: turns the card's baked-in entries into a normal, editable lorebook in your library. The new lorebook is linked back to the character. The button reads **Reimport Embedded Lorebook** once a linked copy already exists.
- **Edit Embedded Lorebook**: opens that linked lorebook in the full editor. Your edits there sync back into the card's embedded copy automatically.
- **Remove from card**: deletes the embedded copy from the card. Any separately linked lorebook in your library is left alone.

This is useful for cards you imported from other tools. Many imported cards arrive with an embedded lorebook. Click **Import Embedded Lorebook** to get a fully editable version in Guksu.

## The Chat Settings Lorebooks section

Each chat has its own **Lorebooks** controls. This is where you see which lorebooks are active in the current chat and adjust them for that chat only.

1. Open a chat.
2. Open **Chat Settings**.
3. Find the **Lorebooks** section. The count badge shows how many lorebooks are active.

Every active lorebook shows one or more badges telling you why it is on:

- **Chat**: you pinned it to this chat by hand.
- **Global**: it is a global lorebook.
- **Character**: it is linked to a character in this chat.
- **Persona**: it is linked to the persona in this chat.

You can change what is active for just this chat.

- **Add Lorebook**: pins a lorebook to this chat. Pinned lorebooks show the **Chat** badge.
- Trash icon (**Remove from chat**): unpins a lorebook you added by hand.
- Eye-off icon (**Disable in this chat**): temporarily hides an auto-activated lorebook for this chat only, without unlinking it. Disabled lorebooks show a struck-through name and a **Disabled** badge.
- Eye icon (**Enable in this chat**): turns a disabled lorebook back on for this chat.

### Lorebook Token Budget

**Lorebook Token Budget** is a numeric field in this section. It caps how much lorebook text can be injected in this chat, measured in tokens. The default is **8192**. Set it to **0** for no cap. This chat-wide budget is separate from each lorebook's own token budget. Both limits apply. See [Lorebook Token Budgets and Recursion](token-budgets.md) for how the two budgets work together.

## Related guides

- [Lorebooks Overview](overview.md)
- [Lorebook Token Budgets and Recursion](token-budgets.md)
- [Importing and Exporting Lorebooks](import-export.md)
- [Creating and Editing Characters](../characters/creating-and-editing-characters.md)
- [Chat Settings Overview](../chats/chat-settings.md)
