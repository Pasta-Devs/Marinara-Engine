# Card Browser: Finding and Importing Characters

This guide explains the **Card Browser** in Marinara Engine, the built-in tool for finding character cards on public sites and importing them into your library. It covers the sources, how to search and filter, and how adult content works on each source. It also covers how to import a character or save it as a file. Older versions called this tab **Bot Browser** or **Browser**.

A character card is a file that holds one character's name, personality, greeting, and other details. Normally you would download a card from a website and then upload it into Marinara. The **Card Browser** does both steps for you in one place.

## What the Card Browser is

The **Card Browser** searches several public character-card sites from inside Marinara. It supports five sources: **ChubAI**, **JannyAI**, **Pygmalion**, **Wyvern**, and **DataCat**. **CharacterTavern** is still listed, but it can't be browsed for now (see [CharacterTavern](#charactertavern)). You can search a source, filter the results, and preview a character's full details. Then you can import that character into your library or save it as a PNG file. You do not need an account or an API key to browse and import character cards at the default settings.

## Opening the Card Browser

There are two ways to open the **Card Browser**.

1. Click the **Card Browser** icon in the top bar. It sits in the row of panel buttons on the right side.
2. Or open the **Card Browser** panel in the right sidebar, then click the **Download Cards** button at the top of that panel.

Either way, the whole content area switches to the full **Card Browser** view. This view replaces the chat area. It is not a small pop-up window.

To leave, click the back-arrow button in the top-left of the **Card Browser** header. You should return to the screen you came from.

The **Card Browser** stays loaded while the app is open. If you close it and open it again, your last search, filters, and selected character are still there. Reloading the whole app resets it.

## Choosing a source

Click the source button in the header. It shows the current source name and a small arrow. A menu opens with the sources in this order: **ChubAI**, **JannyAI**, **CharacterTavern**, **Pygmalion**, **Wyvern**, and **DataCat**. **CharacterTavern** is marked **Unavailable**.

**ChubAI** is selected the first time you open the **Card Browser**. When you switch sources, your search text, tags, and filters are cleared. Each source remembers its own adult-content setting and login separately, so a change on one source does not affect the others.

One naming note: the menu lists **ChubAI**, but on a character's detail page the outside link reads **View on Chub**. That is the site's own name for itself. The other sources use the same name in both places.

## CharacterTavern

CharacterTavern rebuilt its website and no longer offers the connection Marinara used to search and download cards. When you pick **CharacterTavern**, the **Card Browser** shows a short notice instead of search results. Browsing may return if CharacterTavern offers API access.

Until then, you can still bring CharacterTavern characters into Marinara by hand:

1. Click **Open CharacterTavern** in the notice. The site opens in a new tab.
2. Download the character card file from character-tavern.com.
3. Click **Import Character** in the notice and choose the downloaded file. See [Importing and Exporting Character Cards](import-export.md).

Characters you already imported from CharacterTavern stay in your library.

## Searching, sorting, and pages

Type in the **Search characters...** box to search. You do not need to press Enter. Marinara waits a moment (about half a second) after you stop typing, then searches automatically. Clearing the box or changing a filter also searches again.

Next to the search box is a sort dropdown. The options are different on each source, and each source starts on its own default sort:

| Source    | Default sort    |
| --------- | --------------- |
| ChubAI    | Most Downloaded |
| JannyAI   | Newest          |
| Pygmalion | Downloads       |
| Wyvern    | Popular         |
| DataCat   | Relevance       |

Click the **Refresh** button (the circular-arrow icon) to run the current search again.

Below the results are **Previous** and **Next** buttons with a page label such as **Page 2**. When the source cannot report an exact total, only the current page number is shown.

One note on **DataCat**: its **Fresh** sort only shows fresh results when you have no tag filter and no search text. As soon as you type a search or pick a tag, **DataCat** falls back to normal relevance results.

## Filtering by tags

Click the **Tags** button in the toolbar to open the tag panel.

- Type in the **Search tags...** box to shrink the tag list.
- Click the green check next to a tag to include it. Click the red minus to exclude it. A tag can be included or excluded, not both.
- Included tags show as a green chip. Excluded tags show as a red chip. Click any chip to remove it.
- The **Clear** button removes all active tags.

On most sources the tag list is built from the characters in your recent searches. Before your first search the panel says **Tags will appear after searching**. If a tag you want is not listed, type its name. Two buttons appear so you can add it as a filter or block it from results.

**DataCat** works differently. It loads the most popular tags right away, because it has a very large tag list. You can still type any other tag name by hand.

## More filters

Some sources add a **Filters** button in the toolbar. It only appears when the source has filters to offer, so it does not show for **DataCat**. A small badge shows how many filters are active.

The filter panel can include:

- Content checkboxes, such as **Lorebook** or **Alt Greetings**, which keep only characters that have that feature. A lorebook is extra background info that a character can carry with it.
- **Sort Direction**, either **Descending** or **Ascending**, on **ChubAI** and **Pygmalion**.
- **Min Tokens** and **Max Output Tokens** number boxes, which limit results by size. If you leave them blank, the source uses its own default.
- **JannyAI** has a **Show Low Quality** toggle. It is off by default, which hides characters that **JannyAI** marked as low quality. Turn it on to include them.

Note on **Wyvern**: its **Lorebook** and **Alt Greetings** checkboxes appear, and so do its **Min Tokens** and **Max Output Tokens** boxes. None of them change **Wyvern** results. To narrow **Wyvern** results, use the sort dropdown and tags instead.

## Adult content (NSFW) per source

Adult content is labeled **NSFW** in the app. There is a single **NSFW** checkbox in the toolbar, but each source treats it differently. This is the most common question, so read it carefully.

- **ChubAI** and **JannyAI**: the **NSFW** checkbox works right away. No login is needed. It is off by default.
- **Pygmalion**: the **NSFW** checkbox is greyed out until you log in. Its tooltip tells you to log in first. After you log in, the app follows your account settings on Pygmalion. The checkbox then reads **NSFW depends on your account settings**. There is no separate on and off switch after login.
- **Wyvern**: the **NSFW** checkbox is always greyed out. A notice reads **Use "🔞 Popular NSFW" sort for NSFW content**. To see adult content on **Wyvern**, pick the **🔞 Popular NSFW** option in the sort dropdown.
- **DataCat**: every character is adult-tagged, so the checkbox is locked on. The first time you pick **DataCat**, a dialog titled **DataCat is NSFW only** appears. Click **Continue to DataCat** to browse it, or **Don't continue to DataCat** to go back.

Adult characters show a small red **NSFW** badge in the corner of their thumbnail.

## Logging in for Pygmalion

**Pygmalion** hides its adult content behind a login. You do not need to log in for normal, public characters. Logging in only unlocks adult content.

To log in, click the **Log In** button in the toolbar. A login window opens. You paste a value copied from your own Pygmalion account. Marinara does not ask for your password.

For **Pygmalion**, the window is titled **Pygmalion Authentication** and asks for an **Auth Token**:

1. Go to pygmalion.chat and log in to your account.
2. Open your browser's developer tools. On most browsers you press the F12 key. Developer tools are a built-in browser panel for advanced users.
3. Open the **Application** tab, then **Local Storage**.
4. Find the entry named `authn` and copy its value.
5. Paste the value into the **Auth Token** box in Marinara. The box hides what you paste.
6. Click **Save & Connect**. You should see a message that NSFW content is enabled.

The window has a help section that repeats these steps, and a **Website** link that opens pygmalion.chat.

This is your Pygmalion account login. Marinara keeps it in memory until restart or **Log Out**. To sign out, open the login window again and click **Log Out**. To fully sign out, also log out on pygmalion.chat.

Marinara checks the token with Pygmalion before keeping it. If Pygmalion doesn't accept it, nothing is saved and a message says why. If Pygmalion stops accepting it later, Marinara logs you out and asks you to log in again.

Important: this login is held in the server's memory only. It is never saved to a file. If you restart the Marinara server, you are logged out and must paste the token again. Marinara shows a message telling you to log in again when this happens.

## Reviewing a character before import

Click any result card to open its detail view. Use **Back to results** to return.

The detail view shows the character's avatar, name, creator, a short tagline, and up to twenty tag chips. It also has a **View on** link that opens the character's original page in a new tab.

Below that are the character's full details, shown only when the source provides them. These sections use headings such as **Creator's Notes**, **Personality**, **Scenario**, **First Message**, and **Alternate Greetings**. An amber **Has embedded lorebook** badge appears when the character carries a lorebook.

Some sources do not always return full details. If nothing loads, the view says you can still import the character with its basic info.

## Importing or downloading a character

The detail view gives you two buttons. **Import** adds the character to your Marinara library. **Download as PNG** saves the character as a file on your device without adding it to your library.

To import character cards into your library:

1. Open a character's detail view.
2. Choose an **Imported tags** option (see the table below).
3. Click **Import**. The button shows **Importing...** while it works.
4. Wait for the success message. You should see a message that the character was imported.
5. Open the **Characters** panel to find the imported character before you start a chat.

The imported character behaves like any other character. To actually chat with it, you still need a working provider connection. See [Connecting to an AI Provider](../connections/connecting-to-a-provider.md).

### Imported tags

The **Imported tags** panel next to the avatar controls which tags come along with the character. The default is **All tags**.

| Option        | What it does                                 |
| ------------- | -------------------------------------------- |
| All tags      | Keeps the source's tags.                     |
| No tags       | Skips the source's tags.                     |
| Existing only | Keeps only tags you already use in Marinara. |

### Embedded lorebook prompt

If the character carries an embedded lorebook, importing shows a small confirm box from your web browser. It asks if you also want to save the lorebook as a separate, standalone Marinara lorebook. Click **OK** to create the separate lorebook plus the copy attached to the character. Click **Cancel** to keep the lorebook attached to the character only.

### Download as PNG

Click **Download as PNG** to save the character as a standard PNG character card file. The button shows **Building PNG...** while it works. This works for every source. The saved file is named after the character, for example `Some_Character.png`. You can share this file or import it into another app later.

JSON and PNG are two common formats for the same character data. JSON is a plain text format. A PNG card is an image file with the character data stored inside it. Both hold the full character.

## Your imported characters

The **Card Browser** panel in the right sidebar keeps a separate list of characters you imported through the **Card Browser**. Characters you made by hand or imported another way do not appear here. All of them still appear in the main **Characters** library.

- The **Download Cards** button opens the full **Card Browser** view.
- The **Search imported...** box filters this list.
- The sort dropdown offers **A-Z**, **Z-A**, **Newest**, and **Oldest**.
- Right-click a row, or use its buttons, to find **Quick Start Roleplay** and **Quick Start Conversation**. These open a new chat with that character. You can also delete the character from this list here.

## Troubleshooting

**JannyAI search or details fail with a Cloudflare error.** Some sites block automated requests. Visit jannyai.com once in the same web browser, pass any challenge it shows, then return to Marinara and search again.

**My Pygmalion login stopped working.** Restarting the Marinara server clears this login. Open the **Log In** window again and paste your token once more.

**CharacterTavern only shows a notice.** That is expected. See [CharacterTavern](#charactertavern) for how to import its cards as files.

**A search fails or a source stops working.** Public sites can change their pages or block access at any time. Try again later. If a source keeps failing, open the character on the site directly and download the card yourself. Then bring it in through the normal import flow. See [Importing and Exporting Character Cards](import-export.md).

## Related guides

- [Importing and Exporting Character Cards](import-export.md)
- [Connecting to an AI Provider](../connections/connecting-to-a-provider.md)
- [Troubleshooting](../TROUBLESHOOTING.md)
