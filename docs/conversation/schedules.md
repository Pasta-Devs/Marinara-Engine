# Character Schedules and Autonomous Messaging

Autonomous messages are messages a character sends you first, after you have been quiet for a while. Schedules give each character a weekly routine, so they seem awake, busy or asleep at different times. Both work only in Conversation Mode.

Schedules are optional. With schedules off, characters still reach out based on their talkativeness (how often a character starts a conversation) and your presence.

## Turn on autonomous messages

Before you start: open a Conversation chat. New chats start with this on (see [Conversation Mode: Getting Started](getting-started.md)).

1. Open **Chat Settings** in the chat.
2. Find the **Autonomous Messaging** section.
3. Turn on **Autonomous Messages**.

If it did not work: characters stay silent while your presence is **Do Not Disturb** (see [Your presence status](getting-started.md#your-presence-status)).

### Set the check-in limit

**Chat Check-In Cap** limits how many check-ins characters may send per day in this chat.

- **Default chat ceiling (talkativeness-based)** takes the limit from each character's talkativeness (table below).
- **Numeric value** shows a number field. Enter any whole number of 1 or more. High numbers can mean many model requests and notifications.

A character's own **Daily safety limit** (set in its schedule) can only lower this cap when both are set.

| Character talkativeness | Check-ins per day |
| --- | --- |
| 80 or higher | 8 |
| 60 to 79 | 6 |
| 40 to 59 | 5 |
| 20 to 39 | 3 |
| below 20 | 2 |

## Turn on schedules

Before you start: turn on **Autonomous Messages**.

1. In **Autonomous Messaging**, turn on **Schedules**.
2. Existing character routines appear at once. Click **Generate** to make routines for characters that have none. It becomes **Regenerate** once routines exist.
3. An **Edit schedules** list shows one row per character. Each row says how many days are filled (for example **3 days scheduled**) or **Create schedule**.

Routines belong to the character and are reused in every Conversation chat. Turning **Schedules** off in a chat keeps them off there and keeps the routine. Automatic weekly renewal is off unless you turn on **Renew weekly** for that character in **Character Schedule Manager**. A failed renewal is not retried when you reopen the chat; use **Generate** to retry.

**Schedule generation preferences** (also in **Chat Settings**) holds free-text guidance for how routines are written. It applies to every Conversation chat the next time routines are generated. Example:

```text
Make everyone go to sleep before midnight. I work 9-5 on weekdays.
```

## The Schedules editor

Click a character's row in **Edit schedules** to open the editor. Its title reads **Edit** plus the character name and **Schedule**.

At the top, **Routine profile** shows a plain-language summary of the week. Click **Generate summary** to make it, or **Refresh summary** to update it. After you change the schedule, **Summary may be stale** appears. **Generation model** picks the model that writes schedules.

### Tuning

Open **Tuning** for the main controls.

| Control | What it does | Default and range |
| --- | --- | --- |
| **Chat talkativeness** | Slider with **Rare**, **Quiet**, **Balanced**, **Social**, **Very frequent**. Sets how often the character starts messages and joins group talk, and its default daily limit. | **Balanced** |
| **Wait before checking in** | Quiet minutes before the character may check in. | 120, from 15 to 360 |
| **Check-in moments** | Chips: **Morning**, **Goodnight**, **Meal breaks**, **After busy**, **Long absence**. Click one to turn it off. | All on |

Open **Advanced timing** inside **Tuning** for three more controls.

| Control | What it does | Default and range |
| --- | --- | --- |
| **Daily safety limit** | Hard maximum per day for this character. It can only lower the chat cap. | **Default**, or a whole number of 1 or more |
| **Delay while you're away** | Extra minutes before the character replies while its status is **Away**. | Blank: random 1 to 3 minutes. Range 0 to 120 |
| **Delay while you're busy** | The same while its status is **Busy**. | Blank: random 2 to 5 minutes. Range 0 to 120 |

### Schedule AI: redraft the week

Open **Schedule AI** to have the model rewrite the routine. Pick one **Week action**:

| Action | Result |
| --- | --- |
| **Rewrite** | A fresh full-week draft. |
| **Adjust** | Keeps most of the routine and applies your guidance. |
| **Vary** | A clearly different week that is still believable. |
| **Repair** | Fixes gaps and obvious problems with small changes. |

1. Pick a **Week action**.
2. Under **Weekly generation**, choose **Entire week in one request** or **One request per day**. One request per day makes seven smaller requests and may use more tokens (the small pieces of text models count).
3. Type optional hints in **Week guidance**, for example `make weekdays more nocturnal, keep weekends social`.
4. Click the button that names your action, such as **Rewrite week**.
5. Click **Save schedule** to keep the result. Until then it is a draft only (**Unsaved draft**).

If it did not work: your draft is kept. If the model returns schedule text the editor cannot read, fix it in **Edit generated schedule JSON** and click **Apply to draft**. A failed call is not retried. Click **Stop** or close the editor to cancel a running request.

### Daily blocks

Each day from Monday to Sunday has its own row. An empty day shows **No blocks scheduled for this day**. Each block has a status, a time range such as `09:00-11:30` and a short activity such as `at work`.

1. Click **Add block** under a day.
2. Pick a status: **Online**, **Away**, **Busy** or **Offline**.
3. Type the time range and the activity.
4. Click **Save schedule**. **Cancel** closes the editor without saving.

Use the trash icon to remove a block. To redraft one day, type a hint in **Guide Monday** (or the day you want) and click **Regenerate Monday**.

During an **Offline** block the character never messages first. During a **Busy** block it waits three times longer than usual.

### Move a schedule between characters

Click **Export schedule** to download the draft as a JSON file (weekly blocks, summary, talkativeness, check-in moments and timing). In another character's editor, click **Import schedule** to load it. Marinara checks the file and moves the routine to the current week. Nothing is saved until you click **Save schedule**.

## Set a status with /status

`/status` sets or clears a temporary status for a character without changing its saved schedule. It works only in Conversation Mode.

```text
/status <online|idle|dnd|offline|clear> [character name]
```

`idle` means **Away** and `dnd` means **Busy**. To make Mira busy, then return her to her schedule:

```text
/status dnd Mira
/status clear Mira
```

With one character in the chat you can leave the name out. `/status` alone lists the characters and usage. A status you set stays until you clear it, and a character cannot replace it.

## Let characters change their own status

With **Schedule Updates** on in **Chat Settings → Agents → Commands**, a character can set its own temporary status and activity. For example, if you ask it to focus for an hour, it can switch to **Busy** with the activity "Studying".

- The change lasts as long as the character says, or one hour if it does not say. The longest is seven days.
- When time is up, the character returns to its schedule, or **Online** if it has none.
- It never edits the saved schedule.

## How check-ins are paced

| Rule | Detail |
| --- | --- |
| First check-in | The character waits until you have been silent for its **Wait before checking in** time (120 minutes by default). |
| Reaction | A reaction from you with no new message opens a shorter wait. |
| **Offline** status | No check-in. |
| **Busy** status | The wait is three times longer. |
| Follow-ups | Up to two more while you stay silent, three in total. The first waits twice the base time, the second four times. |
| Your reply | The count resets. |
| Several characters ready | The one with the highest talkativeness and best timing goes first. A character that is **Online** ranks higher. |

In a group chat set to **Individual**, the characters share one daily limit and one pace. After any character checks in, the next check-in from anyone waits like a follow-up. Any character whose own wait has passed can send it, and the one with the fewest check-ins that day goes first. After a long absence, only one character checks in.

## Related guides

- [Conversation Mode: Getting Started](getting-started.md)
- [Conversation Mode Profiles](profiles.md)
- [Chat Settings Overview](../chats/chat-settings.md)
