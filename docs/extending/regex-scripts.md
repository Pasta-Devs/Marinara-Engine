# Regex Scripts

This guide explains regex scripts in Guksu Motor. A regex script is a find and replace rule that rewrites chat text automatically. This guide covers what regex scripts do, how to create one, where they run, and how to scope them to a single character.

## What a regex script is

Regex is short for "regular expression". A regular expression is a search pattern. It finds text that matches a rule, and a regex script replaces that text with something else. You do not need to know how to code to use one.

A regex script runs on its own every time a message passes through a chat. It can clean up an AI reply before you see it. It can change your own message before it is sent. It can also change the text the model receives. You set the pattern once, and it keeps working in every matching message.

Here is a simple before and after example. Some models wrap actions in asterisks, like this:

```
*She smiles* Hello there.
```

If you find the pattern `\*([^*]+)\*` and replace it with `$1`, the asterisks are removed and the text inside them is kept:

```
She smiles Hello there.
```

The `$1` in the replacement means "the text that the pattern captured in the first pair of parentheses". You will use `$1`, `$2`, and similar tokens often.

Common uses include removing asterisks, deleting out of character notes in parentheses, censoring a word, and fixing repeated formatting quirks from one character.

## Where to find your regex scripts

Your global regex scripts live in the **Presets** panel. Open it with the **Presets** button in the top bar, then find the section titled **Regexes**. The section note reads "Find/replace patterns applied to AI output or user input".

Each row in the list shows:

- The script name.
- A small **AI** or **User** tag that shows where the script runs.
- The pattern, shown as `/pattern/flags`.
- A toggle to turn the script on or off. This takes effect right away, with no need to open the editor.
- An **Edit regex** button (pencil icon).
- A **Delete regex** button (trash icon).

If you have no scripts yet, the list shows "No regexes yet". You can drag a row by its handle to change the run order. This list shows only your global scripts. Scripts tied to a single character are kept separate. See "Character-scoped regex scripts" below.

The section header also has three icon buttons:

- **Create regex**: opens a new blank script.
- **Import regexes from JSON**: reads scripts from a file.
- **Export regexes to JSON**: saves all your global scripts to one file.

## Creating a regex script

To make a new global script:

1. Open the **Presets** panel and find the **Regexes** section.
2. Click **Create regex**. The full regex script editor opens.
3. Type a name in the box at the top. A new script starts with the name "New Regex Script".
4. Fill in the fields described below.
5. Click **Save**. A green **Saved** note appears for a moment.

The editor has these fields.

### Find Pattern (Regex)

**Find Pattern (Regex)** is the search pattern. Write it without slash delimiters. The placeholder shows an example: `\*([^*]+)\*`. If the pattern is invalid or unsafe, a red error appears under the box and blocks saving. See "Safety and performance" below.

### Replace With

**Replace With** is the text that replaces each match. Leave it empty to delete the matched text. You can reuse captured text with `$1`, `$2`, and so on. Case transforms before a capture change its letter case:

- `\u$1` capitalizes the first letter of the capture.
- `\U$1\E` makes the whole capture uppercase.
- `\l$1` lowercases the first letter of the capture.
- `\L$1\E` makes the whole capture lowercase.

Literal backslash text, such as a Windows path like `C:\Users`, is kept as written.

### Regex Flags

**Regex Flags** are toggle buttons that change how the pattern matches. A new script starts with `g` and `i` on:

- `g` (global): replace every match, not just the first.
- `i` (case-insensitive): match whether letters are uppercase or lowercase.
- `m` (multiline): let `^` and `$` match at line breaks.
- `s` (dotAll): let `.` match newline characters too.
- `u` (unicode), `y` (sticky), and `d` (match indices) are advanced flags for special cases.

### Trim Strings

**Trim Strings** is an optional list of plain strings to strip out after the replacement runs. Click **Add trim string** to add a row, and the **X** button to remove one. This is handy for deleting a fixed piece of text that is easier to type than to match with a pattern.

### Live Test

**Live Test** lets you check your pattern before you save. Paste sample text into the box, and the result appears below under **Result:**. Live Test only proves the find, replace, and trim logic. It does not check placement, on or off state, character scope, or depth. The note under the box says so: "Pattern preview only: placement, enabled state, character scope, and depth are evaluated at runtime".

You can use macros like `{{user}}` and `{{char}}` in the pattern, the replacement, and the trim strings. In Live Test they resolve to sample values. In a real chat they resolve to the real names and text. To learn more about macros, see [Macros](../prompts/macros.md).

## Placement: AI Output or User Input

The **Apply To** field decides which side of the chat a script watches. At least one option must stay selected. You can pick both.

- **AI Output**: the script runs on AI responses before they are displayed.
- **User Input**: the script runs on your messages before they are sent.

Use **AI Output** to clean up what the model writes. Use **User Input** to fix or reshape your own text.

## Apply Mode: Only Display, Only Prompt, or Both

The **Apply Mode** selector lives inside **Advanced Options**. It decides when the rewrite takes effect. This is separate from placement. A new script starts on **Only Display**.

- **Only Display**: change only what you see in the chat. The saved message and the text the model gets in later turns do not change.
- **Only Prompt**: change only what the model receives. The chat display and the saved message do not change. This is also what you see in the app's prompt preview.
- **Both**: change the display and the prompt text.

### Which apply mode do I want

Use this quick guide:

- You only want to tidy how a reply looks on screen: choose **Only Display**. This is the safest choice for cosmetic fixes.
- You want to change what the model reads, for example to strip a tag the model keeps copying: choose **Only Prompt**.
- You want the change to apply on screen and in the model's context: choose **Both**.

One thing to know about your own messages. When a **User Input** script is set to **Only Display** or **Both**, the rewrite happens right before your message is sent. So it changes the message that is actually saved and sent, not just how it looks afterward. There is no display-only mode for your own outgoing messages.

## Execution Order and Depth

Both settings sit in **Advanced Options**.

**Execution Order** is a number. Lower numbers run first. This matters when more than one script can match the same text. A new script starts at 0, and the app assigns the next free number when you save, so brand new scripts do not collide. You can also drag rows in the **Regexes** list to reorder them.

**Depth Range** limits how far back in the chat a script runs, using two number fields, **Min** and **Max**. Depth counts backward from the newest message. The newest message is depth 0, the one before it is depth 1, and so on. Leave both fields empty to run at any depth. If the minimum is larger than the maximum, saving is blocked.

## Character-scoped regex scripts

A regex script can belong to one or more specific characters instead of running everywhere. There are two ways to scope a script to a character.

The first way is inside the editor. Turn on the **Specific Characters** toggle in the **Apply To** card, then pick one or more characters from the grid. When the toggle is off, the script "Applies to all characters". You must pick at least one character if the toggle is on.

The second way is per character. Open a character, go to the **Advanced** tab, and find the card titled **Regex Scripts**. This card lists only the scripts tied to that character, and it has its own **Create regex**, import, and export buttons. You must save the character first before you can add scoped scripts. If the character is unsaved, the card says so.

Opening the full editor from this card leaves the Character Editor. If the character has unsaved changes, the app warns you first so you do not lose them.

### The per-chat Scoped Regex Scripts setting

Character-scoped scripts do not automatically run in every chat. A per-chat setting controls them. Open the **Chat Settings** panel for a chat. A section titled **Scoped Regex Scripts** appears only when at least one character in that chat has scoped scripts. It offers three modes:

- **Disabled** (the default): character-scoped scripts are off, and only global scripts run.
- **Exclusive**: each scoped script only changes messages from the character it belongs to.
- **Chat**: every scoped script changes every message in the chat.

Below the mode buttons, the panel lists each character with scoped scripts and lets you switch each script on or off for that chat. This setting controls display-side scripts. Prompt scripts always follow the character that is actually generating the reply.

## Importing regex scripts from SillyTavern

Guksu can read regex scripts that come bundled inside a SillyTavern character card. When you import a card, a section titled **Imported regex scripts** appears with two choices:

- **Character only** (the default): the scripts stay scoped to that one character.
- **Global**: the scripts are added to **Presets** and run in every chat.

This choice appears both in the single-character import dialog and in the bulk **Import from SillyTavern Folder** flow. Bundled scripts with an empty pattern, or a pattern that fails the safety check, are skipped during import. You can also import a plain JSON file of scripts with the **Import regexes from JSON** button in the **Regexes** section. For the full import walkthrough, see [Importing from SillyTavern](../data/importing-from-sillytavern.md).

## Safety and performance

Every pattern is checked before it can be saved or run. Guksu blocks patterns that are very likely to run slowly and hang the app. A blocked pattern shows this message: "Regex pattern is unsafe: avoid nested quantifiers, ambiguous quantified alternatives, and oversized patterns." Saving is blocked until you fix it.

In plain terms, avoid these shapes:

- Patterns longer than 1000 characters.
- A repeating group placed inside another repeating group, such as `(a+)+`.
- Two broad wildcards in a row, such as `.*.*` or `\s*\w*`. A broad wildcard is a token like `.*`, `\s*`, or `\w+` that can match an unlimited amount of text.
- Three or more broad wildcards anywhere in one pattern, even with other text between them.

A single repeat like `a+` or `(a+)` is fine. One broad wildcard on its own, such as a single `.*`, is also fine.

Even with a safe pattern, the app also limits how long a single replacement may take on a longer message. If one script takes too long on one message, the app skips that script for that message only and keeps going. The script is not turned off, and it will try again on the next message. To be safe, always test a new pattern in **Live Test** on short sample text before you turn it on.

## Related guides

- [Macros](../prompts/macros.md)
- [Creating and Editing Characters](../characters/creating-and-editing-characters.md)
- [Importing from SillyTavern](../data/importing-from-sillytavern.md)
