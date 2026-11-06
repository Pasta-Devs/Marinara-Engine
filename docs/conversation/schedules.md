# Character Schedules and Autonomous Messaging

Autonomous messages are messages a character sends you first, after you have been quiet for a while. A schedule is a character's weekly plan that makes it seem awake, busy or asleep at different times. Both work only in Conversation Mode.

Schedules are optional. With schedules off, characters still reach out based on their talkativeness (how often a character starts a conversation) and your presence.

Jump to: [Turn on schedules](#turn-on-schedules) if you only want a schedule.

## Turn on autonomous messages

Before you start: open a Conversation chat. New chats start with this on (see [Conversation Mode: Getting Started](getting-started.md)).

1. Open **Chat Settings** in the chat.
2. Find the **Autonomous Messaging** section.
3. Turn on **Autonomous Messages**.

If it did not work: characters stay silent while your presence is **Do Not Disturb** (see [Your presence status](getting-started.md#your-presence-status)).

### Set the check-in limit

In **Chat Settings → Autonomous Messaging**, **Chat Check-In Cap** limits how many check-ins characters may send per day in this chat.

- **Default chat ceiling (talkativeness-based)** takes the limit from each character's talkativeness (table below).
- **Numeric value** shows a number field. Enter any whole number of 1 or more. High numbers can mean many model requests and notifications.

A character can also have its own **Daily safety limit** (set in its schedule). The limit for a character works like this:

- Chat cap set to **Numeric value** and a **Daily safety limit** set: the lower number wins.
- Only one of them set: that number applies, even if it is higher than the talkativeness number below.
- Neither set: the number comes from the character's talkativeness.

| Character talkativeness | Check-ins per day |
| --- | --- |
| 80 or higher | 8 |
| 60 to 79 | 6 |
| 40 to 59 | 5 |
| 20 to 39 | 3 |
| below 20 | 2 |

## Turn on schedules

Before you start: turn on **Autonomous Messages**.

1. In **Chat Settings → Autonomous Messaging**, turn on **Schedules**. (In the new-chat wizard the same option is called **Generate Schedules**.) Schedules that already exist appear at once.
2. Pick your time zone in the field below it.
3. Click **Generate** to make schedules for characters that have none. The button reads **Regenerate** once schedules exist.
4. Wait for it to finish. An **Edit schedules** list then appears with one row per character. A row says how many days are filled (for example **3 days scheduled**) or **Create schedule**. The list shows only once schedules exist.
5. Click a character's row to open its schedule editor (next section).

A schedule belongs to the character and is reused in every Conversation chat. Turning **Schedules** off in a chat keeps it off there and keeps the schedule.

Automatic weekly renewal is off unless you turn on **Renew weekly** for that character in the **Character Schedule Manager**. Open it with the calendar button in the sidebar footer, next to the status box.

Marinara tries a renewal once for each chat each time the app page loads. If it fails, it does not try again until you reload the page. Click **Generate** to try again.

**Schedule generation preferences**, in the same **Schedules** area of **Chat Settings**, holds free-text guidance for how schedules are written. It applies to every Conversation chat the next time schedules are generated. Example:

```text
Make everyone go to sleep before midnight. I work 9-5 on weekdays.
```

## The Schedules editor

The editor's title reads **Edit** plus the character name and **Schedule**.

At the top, **Routine profile** shows a plain-language summary of the week. Click **Generate summary** to make it, or **Refresh summary** to update it. After you change the schedule, **Summary may be stale** appears. **Generation model** picks the model that writes schedules.

### Tuning

Open **Tuning** for the main controls.

- **Chat talkativeness**: a slider with **Rare**, **Quiet**, **Balanced**, **Social** and **Very frequent**. The default is **Balanced**. It sets how often the character starts messages and joins group talk, and its default daily limit.
- **Wait before checking in**: quiet minutes before the character may check in. The default is 120. You can use 15 to 360.
- **Check-in moments**: chips for **Morning**, **Goodnight**, **Meal breaks**, **After busy** and **Long absence**. All are on. Click one to turn it off.

Open **Advanced timing** inside **Tuning** for three more controls.

- **Daily safety limit**: the most check-ins per day for this character. Leave it on **Default**, or enter a whole number of 1 or more. If the chat also has a numeric cap, the lower number wins; otherwise this number replaces the talkativeness number.
- **Delay while you're away**: extra minutes before the character replies while its status is **Away**. Leave it blank for a random 1 to 3 minutes. You can use 0 to 120.
- **Delay while you're busy**: the same while its status is **Busy**. Leave it blank for a random 2 to 5 minutes. You can use 0 to 120.

### Schedule AI: redraft the week

Open **Schedule AI** to have the model rewrite the schedule. Pick one **Week action**:

| Action | Result |
| --- | --- |
| **Rewrite** | A fresh full-week draft. |
| **Adjust** | Keeps most of the schedule and applies your guidance. |
| **Vary** | A clearly different week that is still believable. |
| **Repair** | Fixes gaps and obvious problems with small changes. |

1. Pick a **Week action**.
2. Under **Weekly generation**, choose **Entire week in one request** or **One request per day**. One request per day makes seven smaller requests and may use more tokens (the small pieces of text models count).
3. Type optional hints in **Week guidance**, for example `make weekdays more nocturnal, keep weekends social`.
4. Click the button that names your action, such as **Rewrite week**.
5. Click **Save schedule** to keep the result. Until then it is a draft only (**Unsaved draft**).

If it did not work: your draft is kept. A failed call is not retried, so click the button again. Click **Stop** or close the editor to cancel a running request. If the editor shows **Edit generated schedule JSON**, the model returned text it could not read. Correct the text there and click **Apply to draft**.

### Daily blocks

Each day from Monday to Sunday has its own row. An empty day shows **No blocks scheduled for this day**. Each block has a status, a time range such as `09:00-11:30` and a short activity such as `at work`.

1. Click **Add block** under a day.
2. Pick a status: **Online**, **Away**, **Busy** or **Offline**.
3. Type the time range and the activity.
4. Click **Save schedule**. **Cancel** closes the editor without saving.

Use the trash icon to remove a block. To redraft one day, type a hint in **Guide Monday** (or the day you want) and click **Regenerate Monday**.

During an **Offline** block the character never messages first. During a **Busy** block it waits three times longer than usual.

### Move a schedule between characters

Click **Export schedule** to download the draft as a JSON file (weekly blocks, summary, talkativeness, check-in moments and timing). In another character's editor, click **Import schedule** to load it. Marinara checks the file and moves the schedule to the current week. Nothing is saved until you click **Save schedule**.

## Set a status with /status

`/status` sets or clears a temporary status for a character without changing its saved schedule. It works only in Conversation Mode. The status belongs to the character, so it applies in every chat that character is in.

Type one of these in the message box:

```text
/status dnd Mira
/status clear Mira
```

The first makes Mira busy. The second returns her to her schedule. With one character in the chat you can leave the name out. `/status` alone lists the characters and usage.

The full form is below. `idle` means **Away** and `dnd` means **Busy**. Square brackets mean the name is optional.

```text
/status online|idle|dnd|offline|clear [character name]
```

A status you set stays until you clear it, and a character cannot replace it.

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
| Follow-ups | Up to two more while you stay silent, three in total. The first follow-up comes after twice the wait, the second after four times the wait. |
| Your reply | The count resets. |
| Several characters ready | The one with the highest talkativeness and best timing goes first. A character that is **Online** ranks higher. |

In a group chat where each character answers in its own reply (see [Group Chats](../chats/group-chats.md)), the characters share one daily limit and one pace. After any character checks in, the next check-in from anyone waits like a follow-up. Any character whose own wait has passed can send it, and the one with the fewest check-ins that day goes first. After a long absence, only one character checks in.

## Related guides

- [Conversation Mode: Getting Started](getting-started.md)
- [Conversation Mode Profiles](profiles.md)
- [Chat Settings Overview](../chats/chat-settings.md)
