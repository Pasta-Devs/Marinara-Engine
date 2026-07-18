# Organizing Your Character Library

This guide covers the **Characters panel**, the sidebar where all your characters live. You will learn how to search, sort, group characters into folders, mark favorites, filter by tags, and export or delete many characters at once.

## The Characters panel

The **Characters panel** is the character list in the side panel. It holds every character you have created or imported. From the top of the panel you can:

- Click **Open Full Library** to open a larger full-page grid view of the same characters.
- Click the **New** button (the plus icon) to open the **Create Character** window.
- Click the **Import** button (the download icon) to import a character file.
- Click the **Select** button (the check icon) to turn on multi-select mode for bulk actions.

The full library uses the chroma text color selected in **Settings**, and keeps your selected card, sort order, and scroll position when you open a character for editing and return.

Each character row shows the avatar, name, an optional title line, the creator and version, up to 3 tags, and a rough token estimate. A small star badge marks a favorite. When you hover a row, a **Duplicate** button and a **Delete** button appear.

If you have many characters, a **Load more** button appears at the bottom. Click it to load the next page of characters.

## Search

Type in the search box at the top of the panel to filter the list. The placeholder text reads **Search characters or -tag:"tag name"**.

Plain text matches against a character's name, title, description, and tags. For example, typing `knight` shows every character with "knight" in any of those fields.

You can also exclude characters that have a certain tag. Put a minus sign in front of the tag:

```
-tag:"tag name"
```

A few things to know about tag exclusion:

- Use quotes when the tag has a space, like `-tag:"slow burn"`.
- For a single-word tag you can drop the quotes, like `-vampire`.
- Excluding a tag hides every character that carries that tag, even if the rest of your search text matches them.

You can combine plain text and exclusion in the same box. For example, `mage -tag:"villain"` finds characters matching "mage" while hiding any tagged "villain".

## Sort

Next to the search box is the sort dropdown. Pick one of these orders:

| Option        | What it does                    |
| ------------- | ------------------------------- |
| **A-Z**       | Names from A to Z.              |
| **Z-A**       | Names from Z to A.              |
| **Newest**    | Most recently created first.    |
| **Oldest**    | Oldest created first.           |
| **Favorites** | Favorites first, then the rest. |

## Folders

Folders let you group related characters together inside the panel. They are optional. You can always keep every character in one flat list if you prefer.

To create a folder:

1. Click the **New Folder** button.
2. A new folder appears, named **unnamed** by default.
3. Rename it right away or later (see below).

To rename a folder, double-click it, double-tap it, or select it and press the F2 key. Type the new name and press Enter.

To put a character in a folder, drag the character row and drop it onto the folder. A helper line reads **Drag and drop characters to folders, double-click or double-tap to rename** once you have at least one folder. To take a character back out, hover its row inside the folder and click the remove-from-folder button, or drag it out.

Click a folder to expand or collapse it. The number next to a folder name is how many characters are inside it.

To delete a folder, hover the folder and click its trash button. If the folder has characters in it, you will see a confirm message: **Delete "name"? Its N characters will stay in the library and move out of the folder.** An empty folder is removed right away, with no confirm message. Deleting a folder never deletes the characters inside it. They simply move back to the main list.

## Favorites and tag chips

### Favorites

Marking a character as a favorite makes it easy to find later. You set the favorite star inside the character itself, not from the panel list. Open a character and click its **Favorite** star to turn it on or off. Favorited characters show a small star badge on their avatar in the panel.

Under the search area are three filter buttons:

- **All** shows every character.
- **Favs** shows only your favorites.
- **Non-favs** shows only characters that are not favorites.

You can also choose **Favorites** in the sort dropdown to float all favorites to the top of the list.

### Tags

Tags are labels you add to a character to describe it, such as `fantasy` or `slow burn`. You add and edit a character's tags inside the character editor.

In the panel, each character row shows up to 3 of its tags. Click a tag chip on any row to filter the list down to characters that share that tag.

When your characters have tags, a **Tags** button appears in the filter row, with the total tag count in parentheses (for example, **Tags (12)**). Click it to expand the full list of tags:

- Click a tag in the expanded list to include it as a filter. Clicking more than one tag matches characters that have any of the selected tags.
- Each tag in the expanded list has a small X. Clicking it deletes that tag from every character that has it. You will be asked to confirm: **Remove tag "name" from all characters?**
- A **Clear** button appears once a tag filter is active. Click it to clear your tag filters.

To exclude a tag instead of including it, use the `-tag:` search syntax described above in the Search section.

## Bulk select, export, and delete

When you want to act on several characters at once, use selection mode.

1. Click the **Select** button at the top of the panel.
2. A checkbox appears on each character row.
3. Click the characters you want to include. The panel header shows how many are selected.
4. Use the action bar at the bottom of the panel.

The action bar has two buttons:

- **Export** downloads all selected characters together as a single zip file named `marinara-characters.zip`. This is a bulk export in Guksu Motor's own native format.
- **Delete** removes all selected characters. You will be asked to confirm first: **Delete N characters?**

While in selection mode you can also drag your selected characters into a folder all at once, instead of moving them one by one.

For the full list of import and export file formats, see the guide below on importing and exporting.

## Folders double as group chat rosters

The folders you build here have a second use. Each folder is also a saved roster you can drop into a group chat.

When you set up a chat with more than one character, look for the **Add from Folder** option. It adds every character in a chosen folder in one step. This is the fastest way to start a group chat with a set of characters you use together often. For how group chats work, see the group chats guide below.

## Related guides

- [Importing and Exporting Character Cards](import-export.md)
- [Creating and Editing Characters](creating-and-editing-characters.md)
- [Group Chats and Group Conversations](../chats/group-chats.md)
