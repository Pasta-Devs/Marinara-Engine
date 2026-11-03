# Card Browser: Finding and Importing Characters

The **Card Browser** finds character cards on public sites and imports them into your library from inside Marinara, so you do not download and upload files by hand. Older versions called it the **Bot Browser** or **Browser**.

A character card is a file that holds one character's name, personality, greeting and other details. You do not need an account or an API key to browse and import at the default settings.

## Open the Card Browser

1. Click **Characters** or **Personas** in the top navigation bar. If you do not see them, open **More** first.
2. Click the **Download** button at the top. Its tooltip reads **Download character cards**.

The Card Browser fills the whole content area, with the title **Browse character cards online**. To leave, click the back arrow at the top left.

If you close it and open it again, your last search, filters and selected character are still there. Reloading the app resets them.

## Choose a source

Click the source button in the header. The menu lists, in order: **ChubAI**, **JannyAI**, **CharacterTavern**, **Pygmalion**, **Wyvern**, **DataCat**, **PlotLight** and **PlotLight Personas**. **ChubAI** is selected the first time. Switching source clears your search text, tags and filters. Each source keeps its own adult-content setting and login.

| Source | Adult content (NSFW) |
| --- | --- |
| **ChubAI** | The **NSFW** checkbox works. Off by default. |
| **JannyAI** | The **NSFW** checkbox works. Off by default. |
| **Pygmalion** | Greyed out until you [log in](#log-in-to-pygmalion). Then it follows your Pygmalion account settings. |
| **Wyvern** | Always greyed out. Pick the **🔞 Popular NSFW** sort instead. |
| **DataCat** | Every card is adult-tagged, so the checkbox is locked on. |
| **PlotLight** and **PlotLight Personas** | Always greyed out. PlotLight applies its own rules. Adult-tagged results get an **NSFW** badge. |

Not sure where to start? Use **ChubAI**, the first source. Each source starts on its own sort order, and you can change it in the sort dropdown.

Adult cards show a small red **NSFW** badge on their thumbnail. The menu says **ChubAI**, but a card's outside link reads **View on Chub**, which is the site's own name.

### DataCat

The first time you pick **DataCat**, a dialog titled **DataCat is NSFW only** appears. Click **Continue to DataCat** to browse, or **Don't continue to DataCat** to go back. Its **Fresh** sort shows fresh results only when you have no tag filter and no search text.

### CharacterTavern

CharacterTavern rebuilt its site and no longer offers the connection Marinara used. When you pick it, a notice replaces the results. Browsing may return if CharacterTavern offers API access. Until then, import its cards by hand:

1. Click **Open CharacterTavern** in the notice. The site opens in a new tab.
2. Download the card file from character-tavern.com.
3. Click **Import Character** in the notice and choose the file. See [Importing and Exporting Character Cards](import-export.md).

Characters you already imported from it stay in your library.

### PlotLight

PlotLight shares public characters and personas. **PlotLight** lists character cards. **PlotLight Personas** lists personas, the characters that represent you in chats. You need no PlotLight account. The detail view has a **View on PlotLight** link to the original page.

Marinara downloads the file PlotLight offers. A character card usually comes as a PNG with its portrait and any lorebook the creator allows. A persona comes as a text file, and Marinara copies its picture separately. You can import either kind as a character or as a persona.

PlotLight limits how fast apps can ask it for things. If you go too fast, Marinara says **PlotLight is busy** with a number of seconds, and waits that long. Searching and importing have separate limits.

Some cards cannot be downloaded, for example when the creator does not allow it. Marinara then says **PlotLight doesn't offer this for download.** You cannot import that one or see its details, but its picture, creator and **View on PlotLight** link stay.

## Search, sort and pages

Type in **Search characters**. You do not need to press <kbd>Enter</kbd>. Marinara searches a moment after you stop typing, and again when you clear the box or change a filter. Each source has its own sort dropdown. Click the **Refresh** button (circular arrow) to run the search again.

Below the results are **Previous** and **Next** with a label such as **Page 2**. When a source cannot report a total, only the current page shows. **PlotLight** never reports a total, so the header reads **Browsing PlotLight**. A PlotLight page can hold few cards, or none, and still have more pages. **Next** stays on, so you can keep going.

## Filter by tags

1. Click **Tags** in the toolbar.
2. Type in **Search tags** to shrink the list.
3. Click the green check next to a tag to include it, or the red minus to exclude it. A tag cannot be both.
4. Click a chip to remove that tag, or **Clear** to remove all.

On most sources the list is built from the characters in your recent searches. Before your first search the panel says **Tags will appear after searching**. If a tag you want is not listed, type its name. Two buttons appear: one adds it as a filter, one blocks it. **DataCat** loads its most popular tags right away, and you can still type others. On **PlotLight**, Marinara looks a typed tag up in PlotLight's own list, and a tag PlotLight does not have matches nothing.

## More filters

Most sources add a **Filters** button with a badge that counts active filters. It does not show for **DataCat** or **PlotLight**. The panel can hold:

- Content checkboxes such as **Lorebook** or **Alt Greetings**, which keep only characters that have that feature. A lorebook is extra background information a character carries.
- **Sort Direction**, **Descending** or **Ascending**, on **ChubAI** and **Pygmalion**.
- **Min Tokens** and **Max Output Tokens** boxes, which limit results by size. Leave them blank to use the source's default.
- A **Show Low Quality** toggle on **JannyAI**. It is off, which hides cards JannyAI marked as low quality.

On **Wyvern**, the **Lorebook** and **Alt Greetings** checkboxes and the token boxes appear but do not change results. Use the sort dropdown and tags instead.

## Review a character

Click a result to open its detail view. **Back to results** returns to the list.

The detail view shows the avatar, name, creator, a short tagline, up to twenty tag chips and a **View on** link to the original page. Below that are the full details when the source provides them, under headings such as **Creator's Notes**, **Personality**, **Scenario**, **First Message** and **Alternate Greetings**. An amber **Has embedded lorebook** badge shows when the card carries a lorebook. If a source returns no details, the view says you can still import with basic info.

## Import a character

Before you start: to chat with the character you will need a working text connection. See [Connecting to an AI Provider](../connections/connecting-to-a-provider.md).

1. Open a character's detail view.
2. Choose an **Imported tags** option next to the avatar. The default is **All tags**. See [Import options](import-export.md#import-options).
3. Click **Import**. An **Import Card** window opens and asks **Where should this card live?**
4. Optionally tick **Split description into fields**. See [Import options](import-export.md#import-options).
5. Click **Import as Character** to add it to **Characters**, or **Import as Persona** to add it to **Personas**.
6. If the card has an embedded lorebook, an **Embedded lorebook found** panel shows how many entries it has. Click **Import Lorebook** to also create a standalone lorebook, or **No Import** to keep it only inside the card. **Back** returns to step 5.
7. Wait while the button reads **Importing...**. A message says `Imported "Name" successfully!`
8. Open **Characters** (or **Personas**) to find it.

If it did not work: read the error message in the toast. For **JannyAI**, a Cloudflare block is the most common cause (see Troubleshooting below).

### Download as PNG

Click **Download as PNG** in the detail view to save the card as a standard PNG character card on your device, without adding it to your library. The button reads **Building PNG...** while it works. It works for every source, and the file is named after the character, such as `Some_Character.png`. A PNG card is an image with the character data stored inside it. You can share it or import it into another app.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| **JannyAI** search or details fail with an error mentioning Cloudflare (a security check that blocks automatic requests), or the card's full definition is blocked. | Visit jannyai.com once in the same browser and pass any challenge. Then search again. If the card is still blocked, open it on JannyAI, download its PNG, and import that file. |
| My Pygmalion login stopped working. | Restarting the server clears it. Log in again with a fresh token. |
| **CharacterTavern** only shows a notice. | Expected. See [CharacterTavern](#charactertavern). |
| **PlotLight is busy.** | Wait the number of seconds in the message, then retry. |
| **PlotLight doesn't offer this for download.** | The creator may not allow downloads, or the card is no longer public. Use **View on PlotLight** to check. |
| A search fails or a source stops working. | Public sites change or block access at any time. Try later, or download the card from the site and use the normal import. See [Importing and Exporting Character Cards](import-export.md). |

## Log in to Pygmalion

Pygmalion hides its adult content behind a login. Public characters need no login. Marinara never asks for your password. You paste a value copied from your own account.

1. Click **Log In** in the toolbar. The **Pygmalion Authentication** window opens.
2. Go to pygmalion.chat in your browser and log in.
3. Open your browser's developer tools, a built-in panel for advanced users. On most computer browsers, press <kbd>F12</kbd>. Phone browsers usually do not have it, so use a computer for this step.
4. Open the **Application** tab, then **Local Storage**.
5. Find the entry named `authn` and copy its value.
6. Paste it into **Auth Token** in Marinara. The box hides what you paste.
7. Click **Save & Connect**. A message says NSFW content is enabled.

The window has a help section that repeats these steps and a **Website** link to pygmalion.chat.

Marinara checks the token with Pygmalion first. If Pygmalion rejects it, nothing is saved and a message says why. If Pygmalion stops accepting it later, Marinara logs you out and asks you to log in again.

The login is held in the server's memory only. It is never saved to a file, so restarting the Marinara server logs you out. To sign out yourself, open the window again and click **Log Out**. To fully sign out, also log out on pygmalion.chat.

## Related guides

- [Importing and Exporting Character Cards](import-export.md)
- [Connecting to an AI Provider](../connections/connecting-to-a-provider.md)
- [Troubleshooting](../TROUBLESHOOTING.md)
