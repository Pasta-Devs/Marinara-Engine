# Character Schedules and Autonomous Messaging

This guide explains how characters in Conversation Mode message you first, and how you shape when they do it. It covers autonomous messages, character schedules, the **/status** command, and your own presence status. These features work only in Conversation Mode.

## What autonomous messages and schedules do

An autonomous message is a message a character sends you first, without you writing anything. Marinara Engine (Marinara for short) sends these when you have been quiet for a while, so a chat feels like a real messaging relationship.

Two settings control this behavior:

- **Autonomous Messages** decides whether characters can reach out at all.
- **Schedules** give each character a weekly routine, so they seem awake, busy, or asleep at different times.

Schedules are optional. With autonomous messages on but schedules off, characters still reach out based on their talkativeness and your status. Talkativeness is a per-character setting for how often a character starts a conversation on its own.

## Turn on autonomous messages

You control this from the chat, not the character card. All of these controls live in the **Autonomous Messaging** section of **Chat Settings**.

1. Open a Conversation chat.
2. Open **Chat Settings** (the gear icon).
3. Find the **Autonomous Messaging** section.
4. Turn on the **Autonomous Messages** toggle.

In the new-chat setup wizard, **Autonomous Messages** is on by default. You can turn it off any time in **Chat Settings**.

### Chat Check-In Cap

Below the toggle, **Chat Check-In Cap** limits how many times per day characters may reach out in this chat.

- The default option is **Default chat ceiling (talkativeness-based)**. The limit comes from each character's talkativeness.
- Choose **Numeric value** to show a number field and enter any positive whole-number ceiling. Higher ceilings can create many model requests and notifications.

This cap is a ceiling for the whole chat. A character's own limit, set in its schedule, can only lower this number, never raise it.

The talkativeness-based default works like this:

| Character talkativeness | Default check-ins per day |
|---|---|
| 80 or higher | 8 |
| 60 to 79 | 6 |
| 40 to 59 | 5 |
| 20 to 39 | 3 |
| below 20 | 2 |

### Turn on schedules

The **Schedules** toggle sits in the same **Autonomous Messaging** section and is off by default.

1. Turn on the **Schedules** toggle.
2. The first time you turn it on with characters in the chat, Marinara starts writing a weekly routine for each character.
3. When routines exist, an **Edit schedules** list appears with one row per character.

Each row shows how many days are filled, for example **3 days scheduled**, or **Create schedule** if that character has none yet. A **Generate** button (labeled **Regenerate** once routines exist) rebuilds the routines whenever you want.

## The Schedules editor

Click a character's row in the **Edit schedules** list to open the schedule editor. The window title reads **Edit** followed by the character name and **Schedule**.

At the top, the **Routine profile** area shows a plain-language readout of the week. Use the **Generate summary** button to create it, or **Refresh summary** to update it. If you change the schedule after making a summary, a **Summary may be stale** note appears.

### Tuning

Open the **Tuning** section for the main controls.

- **Chat talkativeness** is a slider with five steps: **Rare**, **Quiet**, **Balanced**, **Social**, and **Very frequent**. **Balanced** is the middle default. This value overrides the character's default talkativeness for this chat only. It affects how often the character starts messages, sends follow-ups, and joins group chatter. It also sets the character's default daily limit.
- **Wait before checking in** is the quiet time, in minutes, before this character may start a check-in. The range is 15 to 360 minutes. The default is **120**.
- **Check-in moments** are reasons the character can use to reach out. The chips are **Morning**, **Goodnight**, **Meal breaks**, **After busy**, and **Long absence**. All are on by default. Click one to turn it off.

### Advanced timing

Inside **Tuning**, open **Advanced timing** for three more controls.

- **Daily safety limit** is a hard maximum for this one character, either **Default** or a number from 1 to 8 per day. It can only lower the chat cap, not raise it. Usually leave it on **Default**.
- **Delay while you're away** sets how many minutes this character waits before sending a message while its own status is **Away**. Leave it blank to use the default, a random 1 to 3 minutes. The range is 0 to 120 minutes.
- **Delay while you're busy** does the same while the character's status is **Busy**. Leave it blank to use the default, a random 2 to 5 minutes. The range is 0 to 120 minutes.

### Schedule AI: redraft the week

Open the **Schedule AI** section to have the model rewrite the routine for you. Pick one **Week action**:

- **Rewrite** makes a fresh full-week draft.
- **Adjust** keeps most of the routine and applies your guidance.
- **Vary** makes the week clearly different but still believable.
- **Repair** fixes gaps and obvious problems with small changes.

Type optional hints in the **Week guidance** box, for example:

```
make weekdays more nocturnal, keep weekends social
```

Then click the button that names your action, such as **Rewrite week**. The result is a draft only. Nothing is saved until you click **Save schedule**.

### Daily blocks

Below the sections, each day from Monday to Sunday has its own row. A day with nothing set shows **No blocks scheduled for this day**.

Each block has three parts, labeled **Status, time & activity**:

- A **status** you pick from **Online**, **Away**, **Busy**, or **Offline**.
- A time range, typed like `09:00-11:30`.
- A short activity note, for example `at work`.

Use **Add block** to add a time range. Use the trash icon to remove one. Each day also has its own guidance box, labeled **Guide Monday**, **Guide Tuesday**, and so on. Type a hint there and click the matching button, such as **Regenerate Monday**, to redraft that day only.

The block status changes what a character does when the check-in time passes. A character with an **Offline** block never messages first during that time. A character with a **Busy** block waits three times longer than usual before reaching out.

When you finish, click **Save schedule**. **Cancel** closes the editor without saving.

### Schedule generation preferences

Back in **Chat Settings**, the **Schedule generation preferences** box holds free-text guidance for how routines are written. This setting is global. It applies to every Conversation chat the next time schedules are generated, by hand or by the app. For example:

```
Make everyone go to sleep before midnight. I work 9-5 on weekdays.
```

## Set a one-off status with /status

The **/status** command sets or clears a temporary status for a character, without changing their saved schedule. It works only in Conversation Mode.

The command form is:

```
/status <online|idle|dnd|offline|clear> [character name]
```

Type `idle` for Away and `dnd` for Busy. These are the same four statuses used in schedule blocks. To make a character named Mira appear busy right now:

```
/status dnd Mira
```

To clear that override and return Mira to her schedule:

```
/status clear Mira
```

If the chat has only one character, you can leave the name out. Run **/status** with no options to see the list of characters and usage help.

## How autonomous messages are paced

Marinara paces autonomous messages so a character never spams you. The rules below use each character's own schedule.

- A character waits until you have been silent for its **Wait before checking in** time. The default is 120 minutes.
- A character whose current status is **Offline** does not message first.
- A character whose current status is **Busy** waits three times as long.
- After the first message, a character may send up to two more while you stay silent. That is three messages total per silent stretch.
- Each follow-up waits longer than the last. The first follow-up waits twice the base time, and the second waits four times the base time.
- When you reply, the count resets. The next silence starts fresh.

If several characters are ready at once, the one with the highest talkativeness and best timing goes first.

## Your presence status

Your own status tells characters whether you are around. The status control sits in the sidebar footer and stays visible in every chat mode. Its effect on messaging applies only in Conversation Mode.

Click the status pill to open four choices:

- **Active**: you are online and available.
- **Idle**: shown when you are away.
- **Do Not Disturb**: stops all autonomous messages.
- **Invisible**: hides your status from characters.

**Idle** is mostly automatic. If your status is **Active** and you do nothing for 10 minutes, Marinara sets you to **Idle**. It sets you back to **Active** when you return. You can also pick **Idle** yourself from the popup. Picking any status by hand turns off the automatic switch until you choose **Active** again.

Set **Do Not Disturb** when you want quiet. No character will message you first while it is on. **Idle** does not block autonomous messages. Characters can still check in while you are away.

Next to the status pill is a **What are you doing?** field. Type a short custom activity, up to 120 characters. Recent entries appear under a **Recent status** list so you can reuse them.

## Related guides

- [Conversation Mode: Getting Started](getting-started.md)
- [Conversation Mode Profiles (Display Name, About Me, Behavior)](profiles.md)
- [Chat Settings Overview](../chats/chat-settings.md)
