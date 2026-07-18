# Game Mode: Sessions and Saves

This guide explains how Guksu Motor tracks your Game Mode progress across play sessions. It covers ending and starting a session and reading past sessions in the **Session History** panel. It also covers the **Show Spoilers** view and how the game saves your data.

## What a session is

Game Mode splits your adventure into numbered sessions. A session is one continuous stretch of play, like a single tabletop night. The Game Master (GM, the AI that runs your game) narrates each session. When you end a session, the GM writes a summary you can reread later.

Your first session is **Session 1**. Ending it and starting again creates **Session 2**, and so on.

## Opening the Session panel

The **Session** panel is where you end sessions, start new ones, and read your history.

1. Start or open a Game Mode chat so the game surface is showing.
2. In the top toolbar, click the **Session** button (the feather icon).
3. The panel opens. The header shows **Session** with the current number and status.
4. The panel has two tabs: **Session History** and **Journal**. Stay on **Session History** for session controls and setup sharing.

The panel header also has a **Game tutorial** button that reopens the guided tour.

## Sharing the setup that created a game

Game Mode keeps an immutable snapshot of the setup used to create each new campaign. This lets you play first, decide that the combination works well, and share it afterward without manually recording every field before starting.

1. Open the Game Mode campaign you want to share.
2. Click the **Session** button (the feather icon) in the top toolbar.
3. Stay on **Session History**, then expand **Initial Game Setup**.
4. Review the saved adventure, cast, model, prompt, effective generation parameters, visual, storyboard, and world-tool settings.
5. Click **Copy setup** to put the text on your clipboard, or **Download .txt** to save a shareable text file.

The copied text includes long player preferences and custom GM instructions. Read it before posting it publicly if those fields contain private material. Connection credentials, server URLs, API keys, and local database IDs are never included. Character cards, personas, lorebooks, models, and provider accounts are named for reference but are not bundled, so another player must have or select their own local equivalents.

Campaigns created before setup snapshots were added cannot recover preferences that were never stored, so **Initial Game Setup** appears only when a trustworthy creation snapshot is available.

## Ending a session

End a session when you want to wrap up the current chapter and let the GM summarize it.

1. Open the **Session** panel and stay on the **Session History** tab.
2. At the top you see the current session, labeled **Session N (Current)**.
3. In that row, click the **End Session** button (the small square icon next to **Show Spoilers**).
4. A dialog titled **End Session** opens and asks you to confirm.
5. If you want, type into the box labeled **What do you want to happen in the next session (optional)?**. You can enter up to 5000 characters.
6. Leave that box empty to let the GM steer naturally.
7. Click **End Session** in the dialog to confirm, or click **Cancel** to back out.

After you confirm, the engine generates a summary. Wait on this screen until it finishes. While it works, the dialog title reads **Ending Session**. When it is done, the session is marked concluded and appears in your history.

## Starting a new session

Once the current session is concluded, the same button changes to **New Session**.

1. Open the **Session** panel and go to the **Session History** tab.
2. In the current session row, click the **New Session** button (the play icon).
3. The GM resumes the story. It uses the last session's summary and any next-session note you wrote when you ended it.

## Reading past sessions

The **Session History** tab lists your concluded sessions, newest first. Before you finish one, it shows **No completed sessions yet**.

Each row shows the session number, the date, and how many discoveries it recorded. Click a row to expand it. An expanded session can show these fields:

- **Summary**: what happened during the session.
- **Resume Point**: how the next session should pick up.
- **Party Dynamics**: how your party members related to each other.
- **Key Discoveries**: important facts, twists, and reveals.
- **Character Moments**: standout moments for characters.
- **Little Details To Recall**: small habits, promises, or details.
- **NPC Updates**: changes to non-player characters (NPCs, people the GM controls).
- **Next Session Request**: the note you left when ending the session.
- **Stats Snapshot** and **Party Status**: saved numbers and party state.

### Replaying a completed session

Completed sessions can be replayed without changing your campaign.

1. Expand a concluded session in **Session History**.
2. Click **Replay Session**.
3. Use **Next** and **Next turn** to click through the original narration and dialogue.
4. When the replay reaches a choice, only the option you selected during the original session is enabled. Click it to continue along the recorded path.
5. Click the close button at the top of the replay or **Return to current session** when you are finished.

Replay is read-only. It does not call the GM, create messages, change inventory or stats, update the journal, or restore a checkpoint. Sessions created before replay support can still use their saved text, inline effects, choices, and available assets. An older turn may omit a scene effect that was not stored when that turn was originally played.

### Editing a past session

You can hand-edit a concluded session's notes so future sessions remember them correctly.

1. Expand the session you want to change.
2. Click **Edit Details**.
3. Change any field, then click **Save Details**. Click **Cancel** to discard your edits.

Two more buttons appear on an expanded session:

- **Regenerate**: re-runs the AI conclusion for that session. This rewrites the summary and all the other fields in the entry. Any changes you made with **Edit Details** will be lost.
- **Update Plot Arcs**: asks the AI to update the GM's hidden story plans using that session's events. These plans are the **Story Arc**, **Plot Twists**, and **Party Arcs** shown in the **Show Spoilers** view.

A **Regenerate Lorebook** button appears only on your latest concluded session, and only when the optional Lorebook Keeper feature is turned on. A lorebook is a set of world facts the AI can recall.

## The Show Spoilers view

**Show Spoilers** reveals the GM's hidden notes for the current session. These are normally kept secret from you during play. Reading them can spoil plot twists.

1. Open the **Session** panel and go to the **Session History** tab.
2. In the current session row, click **Show Spoilers** (the eye icon).
3. The panel reveals the GM's private state.

The spoiler view can show these sections:

- **World Overview**: the big-picture setting.
- **Story Arc**: the planned direction of the story.
- **Plot Twists**: surprises the GM is holding back.
- **Party Arcs**: planned journeys for your party.
- **Maps**, **NPCs**, and **Character Cards**: the saved game data.

To hide the notes again, click the same button. It now reads **Hide Spoilers**.

You can also edit these secrets, which acts like a game-master cheat panel. Click **Edit Spoilers**, change the text, then click **Save Spoilers**. Some fields are shown as JSON, a structured text format. Only edit JSON fields if you understand the format, since bad JSON will not save.

## How your game saves

Game Mode saves your progress automatically. You do not need to press a save button. Your world, party, map, inventory, in-game time, and session summaries are all kept for you as you play.

The app also records automatic checkpoints behind the scenes. It captures a checkpoint at session start, at session end, and when combat begins or ends. There is currently no in-app screen to browse or restore these checkpoints. So do not rely on loading an old checkpoint to undo a turn.

To keep your own copy of your data, use the app's backup tools. See [Backup and Restore](../data/backup-and-restore.md).

## Related guides

- [Game Mode: Getting Started](getting-started.md)
- [Backup and Restore](../data/backup-and-restore.md)
