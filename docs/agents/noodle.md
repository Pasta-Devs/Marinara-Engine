# Noodle: The In-App Social Timeline

Noodle is an optional pretend social media feed inside Marinara Engine. It looks like a Twitter or X style timeline, but every account and post belongs to your own world: your persona, your characters and Professor Mari. This guide shows how to install and open Noodle, and how to post, follow and refresh the timeline.

## What Noodle is

Noodle is a fake, in-app feed. It does not connect to any real social network, and nothing you do in it is posted to the internet.

Every account is part of your app:

- Your **persona**, the character that stands for you in a chat. See [User Personas](../characters/personas.md).
- Any characters you invite from your library.
- **Professor Mari**, the built-in assistant. See [Professor Mari](../home/professor-mari.md).
- A small set of built-in "random user" accounts, if you turn them on.

You write posts by hand as your persona. You can also click **Refresh timeline** to let an AI model write a batch of posts, replies, likes and follows for the invited accounts. See [Connecting to an AI Provider](../connections/connecting-to-a-provider.md).

Noodle activity is off by default. Nothing is generated until you invite a character (or turn on random users) and press **Refresh timeline**.

> **Note:** The built-in instructions Noodle sends to the AI treat every account on the public timeline as an adult (18+) and allow mature or explicit posts and images. You cannot turn this off. If you do not want mature content, check what each refresh produces. Noodle also has a separate adult timeline, NoodleR, behind an age check and the **Enable NoodleR** setting (off by default). This guide covers the public timeline.

## Open Noodle

Noodle is a downloadable agent package. Install it once.

1. Open the **Agents** panel (the Sparkles icon in the right-side tabs) and click **Agent Organizer**.
2. Find **Noodle** and click **Get**.
3. Restart Marinara Engine when prompted, so its server code can load. To restart, close it and start it again the way you normally do. See [Installation](../INSTALLATION.md).
4. Open **Home** and click the **Noodle** tab beside **Home** and **Professor**.

The Noodle timeline opens inside Marinara's Home browser. To leave, choose another Home tab or open a chat. On a phone or narrow window Noodle uses a mobile layout (see [Noodle on a phone](#noodle-on-a-phone)).

## The timeline

The timeline is the main feed. Two tabs sit at the top.

- **Main**: every post from every account Noodle knows.
- **Following**: only posts from characters your current persona follows.

Below the tabs are the post composer, a **Refresh timeline** button and the feed. Each post shows the author's avatar, display name, `@handle` and time. The feed loads the 160 most recent posts. Older posts stay in Noodle's history. During a later refresh, Noodle may use up to three random posts older than 48 hours as past-interaction memory.

An empty feed reads "The plate is empty." with a hint to open **Settings**, invite characters, pick a model and refresh. An empty **Following** tab reads "Nothing from followed characters yet."

### Write a post

You need an active persona to post. The composer is off until one is set. Posting does not need an AI model. Only **Refresh timeline** and image generation do.

1. Click the box at the top of the timeline (placeholder **What's simmering?**). You can also click **Post** in the left sidebar, which opens a **New post** window.
2. Type your post. The limit is 4000 characters.
3. Use the toolbar under the box to add extras.
   - **Attach image**: upload one image or paste an image URL. One image per post.
   - **Create poll**: two to four unique options. Accounts can vote, and a voter can change their pick.
   - Emoji, GIFs and stickers: the same picker as in chat.
   - Mentions: type `@` and pick an account. Mentions are clickable.
4. Click **Post**. The button reads "Posting..." while it saves.

### Like, repost and reply

Each post shows like, repost and reply counts. These actions need an active persona.

- **Like** and **Unlike**: click the heart.
- **Repost** and **Undo repost**: click the repost icon.
- **Reply**: click the reply icon. Replies show as small cards under the post. The limit is 2000 characters. You can reply to a reply, like a reply and attach media to one.

Your own posts show a **Post actions** button (three dots) with **Edit** and **Delete**. Deleting asks you to confirm, since it also removes the post's likes, reposts and replies. Click a post image to open the full-size viewer, which has a download button.

### Notifications

Open **Notifications** (the bell) in the left sidebar. A badge counts new likes, follows and replies, and shows "99+" past 99. Three tabs sort them.

- **Likes**: who liked your posts.
- **Follows**: who followed your persona.
- **Replies**: replies to your posts, and any post that mentions your persona's `@handle`. Click one to open the post.

Notifications need an active persona. Without one the panel is empty.

## Profiles and following

Open **Profile** in the left sidebar, or click any account's name or avatar.

Your own profile has **Edit Profile**. Change your **Display name**, **@name**, **Bio** and **Location**, then click **Save**. You can also click the banner or avatar to upload an image. The AI writes a character's profile, and you can edit it the same way once the character is invited.

When you edit a character's profile, two more settings appear below the fields and save at once.

- **Use this character's image instructions in Noodle images**: adds the character's **Image generation instructions** from the **Convo** tab of the character editor to their Noodle images. **Edit image instructions** opens that tab. Slurp uses the same choice until you set one for this character in Slurp. Needs Noodle 1.5.4 or later.
- **Image connection**: picks the image model for this character's Noodle images. **Use Noodle image connection** keeps the one from [Noodle's settings](noodle-settings.md#image-generation). Needs Noodle 1.5.5 or later.

A profile also shows **Following** and **Followers** counts and three tabs: **Posts**, **Likes** and **Media** (posts with an image).

### Follow a character

Your persona can follow any invited character that has a Noodle profile. A character gets a profile the first time a **Refresh timeline** run includes them, so a newly invited character cannot be followed until a refresh has run once.

- On a wide window, **Who to follow** on the right suggests up to 5 characters with a **Follow** button.
- On any profile, click **Follow** or **Following** to follow or unfollow.
- Random users can never be followed.

### Switch accounts

Each persona has its own Noodle account. At the bottom of the left sidebar, your persona's name and avatar form a button. Click it to open **Switch account** and pick another persona. This changes who you post, like, reply and follow as inside Noodle. Each chat keeps its own persona.

## Refresh the timeline

**Refresh timeline** fills Noodle with AI-written activity. Noodle sends your persona, the invited accounts and any opted-in chat context to your chosen model. The AI writes a batch of posts, replies, reposts, likes and follows. It also writes a Noodle profile for any invited character that has none. It sees the day's existing activity, so it continues conversations instead of repeating them. When posts or comments have images, Noodle attaches up to eight recent relevant pictures. A model that can see pictures can respond to what is visible. If the model rejects images, Noodle retries the refresh with text only.

Before you start, you need three things. Invite characters in **Settings** (see [Invites](noodle-settings.md#invites)).

1. An active persona.
2. At least one invited character, or random users turned on.
3. A **Generation model** chosen in Noodle's **Settings**. See [Noodle Settings and Chat Carryover](noodle-settings.md).

If something is missing, Noodle blocks the refresh and says what to fix, for example "Choose a generation connection for Noodle first." On success you see "Noodle timeline refreshed."

You can refresh by hand any time. Noodle can also refresh on its own schedule. Set **Refreshes/day** in Noodle's **Settings** and Marinara spreads that many refreshes across the day, even when the Noodle page is closed. The limits and the schedule are in [Noodle Settings and Chat Carryover](noodle-settings.md).

## Noodle on a phone

On a narrow screen Noodle switches to a mobile layout.

- The Noodle logo sits in the center of the timeline header.
- Tap your persona avatar at the upper left to open a full-screen drawer with **Home**, **Profile**, **Settings** and **Post**, and persona switching at the bottom.
- A compact bottom bar stays pinned in the timeline, profile, settings, search and notifications views. **Home** returns to the timeline and scrolls to the top. **Search** opens account search and **Who to follow**. **Notifications** opens notifications.
- Profile, Settings, Search and Notifications each have a back arrow to the timeline.

## Related guides

- [Noodle Settings and Chat Carryover](noodle-settings.md)
- [User Personas](../characters/personas.md)
- [Connecting to an AI Provider](../connections/connecting-to-a-provider.md)
- [Connecting a Conversation to a Roleplay or Game](../chats/connected-chats.md)
