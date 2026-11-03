# Game Mode: Sessions and Saves

Game Mode splits your adventure into numbered sessions, like tabletop game nights. This guide shows how to end and start a session, read past sessions, share your setup, fix saved data by hand and go back to an earlier moment.

Your first session is **Session 1**. Ending it and starting again creates **Session 2**, and so on. When you end a session, the Game Master (GM, the AI that runs your game) writes a summary you can reread later.

## Save and continue

There is no save button. Your game saves by itself as you play.

1. To stop for now, close the tab or the app.
2. To continue, open the same game chat. You are back where you stopped.
3. To wrap up a chapter, end the session (see [End a session](#end-a-session)).

For going back to an earlier moment, see [How your game saves](#how-your-game-saves).

## Opening Session

**Session** is where you end sessions, start new ones and read your history.

1. Open a Game Mode chat.
2. Click or tap the **Session** button (the feather icon) near the top right of the chat. You can drag it elsewhere (see [Control windows and their buttons](../chats/chat-settings.md#control-windows-and-their-buttons)).
3. **Session** opens as a window on a computer or a full-width panel on a phone. Its first line shows the current session number and status.
4. It has two tabs: **Session History** and **Journal**. Stay on **Session History** for session controls.

If you used **Put back in Chat Settings** to move this window, open the **Session** section in Chat Settings instead.

## End a session

End a session when you want to wrap up a chapter and let the GM summarize it.

1. Open **Session** and stay on **Session History**.
2. Find the current session at the top, labeled **Session N (Current)**.
3. In that row, click the **End Session** button (the small square icon). The row has several small icon buttons, so hover to read their tooltips. A dialog titled **End Session** asks you to confirm.
4. Optional: type a note in **What do you want to happen in the next session (optional)?** (up to 5,000 characters). Leave it empty to let the GM steer.
5. Click **End Session** in the dialog. Click **Cancel** to back out.

The dialog title changes to **Ending Session** while the GM writes the summary. Wait on this screen until it finishes. The session is then marked concluded and appears in your history.

If it did not work, check that your GM model is reachable. The summary is a model request and can fail like any other. Try again, and see [Troubleshooting Marinara Engine](../TROUBLESHOOTING.md).

## Start a new session

After a session is concluded, the same button in its row changes to **New Session**.

1. Open **Session** and go to **Session History**.
2. In the current session row, click **New Session** (the play icon).

The GM resumes the story from the last summary and any note you wrote when you ended the session. In a game with a generated world, the world goes on from where it was left: the days that passed, the party's deeds and standing, the places and groups the story added, and where the party went.

## Read past sessions

**Session History** lists concluded sessions, newest first. Before you finish one it shows **No completed sessions yet**. Each row shows the session number, the date and how many discoveries it recorded. Click a row to expand it. These fields can appear:

| Field | What it holds |
| --- | --- |
| **Summary** | What happened. |
| **Resume Point** | How the next session should pick up. |
| **Party Dynamics** | How party members related to each other. |
| **Key Discoveries** | Important facts, twists and reveals. |
| **Character Moments** | Standout moments. |
| **Little Details To Recall** | Small habits, promises or details. |
| **NPC Updates** | Changes to non-player characters (NPCs, people the GM controls). |
| **Next Session Request** | The note you left when ending the session. |
| **Stats Snapshot**, **Party Status** | Saved numbers and party state. |

### Replay a session

Replay is read-only. It does not call the GM, create messages, change inventory or stats, update the journal or restore a checkpoint.

1. Expand a concluded session.
2. Click **Replay Session**.
3. Use **Next** and **Next turn** to click through the original narration and dialogue.
4. At a choice, only the option you picked originally is enabled. Click it to continue along the recorded path.
5. Click the close button at the top, or **Return to current session**, when you are done.

Sessions from before replay existed still replay from their saved text, effects, choices and assets. An older turn may miss a scene effect that was not stored then.

### Edit a past session

Edit a concluded session's notes so future sessions remember them correctly.

1. Expand the session.
2. Click **Edit Details**.
3. Change any field, then click **Save Details**. Click **Cancel** to discard your edits.

Two more buttons appear on an expanded session:

- **Regenerate** runs the AI conclusion again. It rewrites the summary and every other field, so changes from **Edit Details** are lost.
- **Update Plot Arcs** asks the AI to update the GM's hidden story plans from that session's events. These plans are the **Story Arc**, **Plot Twists** and **Party Arcs** in the **Show Spoilers** view.

**Regenerate Lorebook** appears only on your latest concluded session, and only when the Lorebook Keeper feature is on. A lorebook is a set of world facts the AI can recall.

## Share the setup that created a game

Game Mode keeps a snapshot of the setup used to create each new campaign. Play first, then share the combination if it works well.

1. Open the campaign and open **Session**.
2. On **Session History**, expand **Initial Game Setup**.
3. Review the saved adventure, cast, model, prompt, generation parameters, visual, storyboard and world-tool settings.
4. Click **Copy setup** to copy the text, or **Download setup** to save a text file.

> **Warning:** The text includes your long player preferences and custom GM instructions. Read it before you post it. Credentials, server URLs, API keys and local database IDs are never included.

Character cards, personas, lorebooks, models and accounts are named but not bundled, so another player needs their own equivalents. Campaigns created before snapshots existed cannot recover settings that were never stored, so **Initial Game Setup** shows only when a trustworthy snapshot exists.

## See the GM's hidden notes

**Show Spoilers** (the eye icon in the current session row) reveals the GM's private notes for the current session. Reading them can spoil plot twists.

1. Open **Session** and go to **Session History**.
2. In the current session row, click **Show Spoilers** (the eye icon).

The view can show **World Overview**, **Story Arc**, **Plot Twists**, **Party Arcs**, and the saved **Maps**, **NPCs** and **Character Cards**. Click the same button, now **Hide Spoilers**, to hide them.

To change these notes, click **Edit Spoilers**, edit the text and click **Save Spoilers**. Some fields are JSON, a structured text format. Edit them only if you know the format, because bad JSON will not save.

## Editing game data by hand

When the GM gets something wrong, such as an NPC's reputation or a quest that stays open, you can fix the saved data yourself.

1. Open **Game controls** and choose **Edit game data**. On a phone, **Game controls** is in the three-dot **Chat tools** menu.
2. The **Game Data** window opens. A warning reads: "Hand edits can break a game. Every change is checked before it saves, and names can't change here."
3. Pick a section from the list (a row of chips on a phone). The search box finds a value in every section at once.
4. Change values in **Fields**, or switch to **JSON** for the raw data.
5. Click **Review changes** to see exactly what changes, then click **Save changes**.

> **Warning:** Hand edits can corrupt a game. Before each save, Marinara tries to take a checkpoint marked **Before a State Editor save** (see [How your game saves](#how-your-game-saves)). Load it to undo a bad edit. A game too new to have a saved first turn has nothing to checkpoint yet.

If it did not work, the editor says why and keeps your draft so you can fix it. If the game changed the same data while you were editing, the save is refused so it does not undo the game's change. **Reload** shows the game's version and discards your drafts.

You can change these sections: **Party Cards**, **Party Sheet**, **NPCs**, **Journal**, **Player Notes**, **Inventory**, **Story**, **Session Summaries**, **World Edits**, **Story Script** and **HUD Widgets**. A section shows only when the game has that data, so a game without a world has no **World Edits**. Sections such as **World**, **Maps & Position**, **Time, Weather & Morale**, **Combat** and **Settings** are marked **Read-only**: you can read and search them, but the game keeps them itself. Prompt, image, music and dice preferences are changed in **Chat Settings**.

Rules the checks enforce:

- Names can't change, because cards, NPCs, the party and bags find each other by name. Party members can't be added or removed here.
- An NPC's reputation runs from -100 to 100.
- In **Inventory**, you can change an item's quantity, nickname, carrier, and whether it is worn, attuned or switched on. Leave a stack out to remove it, or add one without an id to add an item.
- In **Session Summaries**, only the text of a session can change.
- **World Edits** holds your hand edits over the world, such as renamed places or added people. The world itself never changes.

The window works like the Roleplay State Editor. See [The State Editor](../roleplay/hud-and-trackers.md#the-state-editor).

## How your game saves

Game Mode saves automatically. Your world, party, map, inventory, in-game time and session summaries are kept as you play, with no save button.

Marinara also records automatic checkpoints at session start, session end, when combat begins or ends, when you reach a new place and at set intervals. It keeps the five newest of each kind and cleans up older ones. The Game Data editor also tries to take one before every save.

To go back:

1. Open **Game controls → Checkpoints**. They are listed newest first.
2. Click **Load** on the moment you want.

**Load** takes the game back to that moment. The tracker, map, **World Edits**, story, party cards and sheets, NPCs, journal, your notes, inventory, session summaries, the GM's story plans, HUD widgets, time, weather and morale all go back. A system message marks where the game was set back. Your settings stay as they are. **Delete** removes a checkpoint for good.

To undo only one bad turn, use **Retry turn** in **Game controls**, or swipe to another version of the reply.

To keep your own copy of your data, see [Backup and Restore](../data/backup-and-restore.md).

## Related guides

- [Game Mode: Getting Started](getting-started.md)
- [Backup and Restore](../data/backup-and-restore.md)
