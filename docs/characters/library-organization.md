# Organizing Your Character Library

The **Characters** panel is the sidebar list of every character you have created or imported. Use it to search, sort, group characters into folders, mark favorites, filter by tags, and export or delete many at once.

## The Characters panel

From the top of the panel you can:

- Click **Download** to open the [Card Browser](bot-browser.md) and find characters on public sites.
- Click **Open Library** to open a larger full-page grid of the same characters.
- Click **New** (the plus icon) to open the **Create Character** window.
- Click **Import** (the download icon) to import a character file. See [Importing and Exporting Character Cards](import-export.md).
- Click **Select** (the check icon) to turn on selection mode for bulk actions.

The full library keeps your selected card, sort order and scroll position when you open a character for editing and come back.

Each row shows the avatar, name, an optional title line, the creator and version, up to 3 tags, and a rough token estimate. A small star badge marks a favorite. Hover a row to see **Duplicate** and **Delete**. If you have many characters, click **Load more** at the bottom to load the next page.

## Search

Type in the search box at the top. The placeholder reads **Search characters/tags**. Plain text matches a character's name, title, description and tags, ignoring case. Typing `knight` shows every character with "knight" in any of those.

| Search | What it finds |
| --- | --- |
| `male genshin` or `male,genshin` | Cards that have both exact tags. |
| `male "Modern AU"` | Quote a tag that has spaces or commas. |
| `-tag:"slow burn"` | Hides every card with that tag, even if the rest of your search matches. |
| `-vampire` | The same, for a one-word tag. You can drop the quotes. |
| `mage -tag:"villain"` | Cards matching "mage", without the ones tagged "villain". |

Ordinary phrase searches still work. The same search works in the full-page Character Library and for personas.

## Sort

Pick an order in the sort dropdown next to the search box.

| Option | What it does |
| --- | --- |
| **Manual order** | The order you set yourself. |
| **A-Z** | Names from A to Z. |
| **Z-A** | Names from Z to A. |
| **Newest** | Most recently created first. |
| **Oldest** | Oldest created first. |
| **Favorites** | Favorites first, then the rest. |

To set a manual order, drag a row up or down, or press <kbd>Alt</kbd>+<kbd>Up</kbd> or <kbd>Alt</kbd>+<kbd>Down</kbd> on a focused row. Either switches the sort to **Manual order**.

## Folders

Folders group related characters, for example by story or series, so a long list is easier to scan. They are optional.

1. Click **New Folder**. A folder named **unnamed** appears.
2. Rename it: double-click or double-tap it, or select it and press <kbd>F2</kbd>. Type the new name and press <kbd>Enter</kbd>.
3. Drag a character row onto the folder to put it inside. Once you have a folder, a helper line reads **Drag and drop characters to folders, double-click or double-tap to rename**.

To take a character out, hover its row inside the folder and click the remove-from-folder button, or drag it out. Click a folder to expand or collapse it. The number next to its name is how many characters it holds.

On a touch screen, press and hold a row to pick it up, then drag. A normal swipe still scrolls.

To move several at once, hold one row and tap other rows with a second finger to carry them along as a stack. Then drop the stack on a folder.

To delete a folder, hover it and click its trash button. A folder with characters asks you to confirm: **Delete "name"? Its N characters will stay in the library and move out of the folder.** An empty folder is removed at once. Deleting a folder never deletes the characters in it.

### Use a folder as a group chat roster

Each folder is also a saved roster for group chats. When you set up a chat with more than one character, **Add from Folder** adds every character in a folder in one step. See [Group Chats and Group Conversations](../chats/group-chats.md).

## Favorites and tags

### Favorites

Open a character and click its **Favorite** star to turn it on or off. You cannot set it from the panel list. Favorites show a small star badge. Under the search box, three buttons filter the list:

- **All** shows every character.
- **Favs** shows only favorites.
- **Non-favs** shows only characters that are not favorites.

You can also pick **Favorites** in the sort dropdown to put favorites at the top.

### Tags

Tags are labels such as `fantasy` or `slow burn`. You add them in the character editor. See [Creating and Editing Characters](creating-and-editing-characters.md#metadata-tab). In the panel, click a tag chip on any row to filter the list to characters that share that tag.

When your characters have tags, a **Tags** button with a count appears, such as **Tags (12)**. Click it to expand the full list:

- Click a tag to include it as a filter. With several tags selected, a character matches if it has any of them.
- Click the X on a tag to delete that tag from every character that has it. You are asked to confirm: **Remove tag "name" from all characters?**
- **Clear** appears once a tag filter is active. Click it to clear the tag filters.

To exclude a tag instead, use `-tag:` in the search box, as shown in [Search](#search).

## Export or delete many characters

1. Click **Select** at the top of the panel. A checkbox appears on each row.
2. Click the characters you want. The panel header shows how many are selected.
3. Use the action bar at the bottom.

The action bar has two buttons:

- **Export** downloads the selected characters as one zip named `marinara-characters.zip`, in Marinara's native format.
- **Delete** removes the selected characters. You are asked first: **Delete N characters?**

In selection mode you can also drag the selected characters into a folder together. For file formats, see [Importing and Exporting Character Cards](import-export.md).

## Related guides

- [Importing and Exporting Character Cards](import-export.md)
- [Creating and Editing Characters](creating-and-editing-characters.md)
- [Group Chats and Group Conversations](../chats/group-chats.md)
