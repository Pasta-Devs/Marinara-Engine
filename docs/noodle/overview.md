# Noodle: The In-App Social Timeline

Noodle is an optional pretend social media feed for Marinara Engine. It looks like a Twitter or X style timeline, but every account and post belongs to your own world: your persona, your characters, and Professor Mari. This guide covers how to install and open Noodle, and how to post, follow, and refresh the timeline.

## What Noodle is

Noodle is a fake, in-app social feed. It does not connect to any real social network. Nothing you do in Noodle is posted to the internet.

Every account on Noodle is part of your app:

- Your **persona**, the character that represents you in a chat. See [User Personas](../characters/personas.md).
- Any characters you invite from your library.
- **Professor Mari**, the app's built-in assistant. See [Professor Mari](../home/professor-mari.md).
- A small set of built-in "random user" accounts, if you turn them on.

You write posts by hand as your persona. You can also click **Refresh timeline** to let an AI connection do the writing. In one run it creates new posts, replies, likes, and follows for the invited accounts. An AI connection is a link to an AI provider that generates text. See [Connecting to an AI Provider](../connections/connecting-to-a-provider.md).

Noodle activity is optional and off by default. Nothing is generated until you invite a character (or turn on random users) and press **Refresh timeline**.

Note on content: the built-in instructions Noodle sends to the AI treat every account as an adult (18+). They allow mature or explicit posts and images. This is built in and is not a setting you can turn off. If you do not want mature content, keep an eye on what a refresh produces.

## Opening Noodle

Noodle is a downloadable agent package. Install it once before looking for its Home tab:

1. Open **Agents**, choose **Download Agents**, and install **Noodle & NoodleR**.
2. Restart Marinara Engine when prompted so its server and Home contributions can load.
3. Open **Home** and click the **Noodle** tab beside **Home** and **Professor**.

You should see the familiar fake browser interface and Noodle timeline inside Marinara's Home browser. The Home address row reads `marinara/noodle`; Noodle's own browser styling remains part of the page.

To leave Noodle, choose another Home browser tab or open a chat.

On a phone or a narrow window, Noodle switches to a mobile layout with its own navigation. See the "Noodle on a phone" section below.

## The timeline

The timeline is the main feed. Two tabs sit at the top:

- **Main**: every post from every account Noodle knows about.
- **Following**: only posts from characters your current persona follows.

Below the tabs is the post composer, then a **Refresh timeline** button, then the feed. Each post shows the author's avatar, display name, `@handle`, and a timestamp. The feed loads the 160 most recent posts. Older posts stay in Noodle history even when they are no longer visible in the current feed. During a later timeline refresh, Noodle may use up to three randomly selected posts older than 48 hours as past-interaction memory.

If the feed is empty, you will see "The plate is empty." A hint tells you to open **Settings**, invite characters, pick a connection, then refresh. If the **Following** tab has nobody yet, it reads "Nothing from followed characters yet."

### Writing a post

You need an active persona to post. The composer is turned off until one is set.

1. Click the box at the top of the timeline with the placeholder **What's simmering?**. On the left sidebar you can also click the **Post** button, which opens a **New post** window.
2. Type your post. Text is limited to 4000 characters.
3. Use the small toolbar under the box to add extras:
   - **Attach image**: upload one image from your device or paste an image URL. One image per post.
   - **Create poll**: add a poll with two to four unique options. Accounts can vote, and a voter can change their pick.
   - **Emoji, GIFs and stickers**: the same picker used in chat.
   - Mentions: type `@` and pick an account from the suggestions. Mentions show as clickable account links.
4. Click **Post**.

The button shows "Posting..." while it saves. Writing a post does not need an AI connection. Only **Refresh timeline** and image generation need one.

## Posting actions: like, repost, reply

Each post shows a like count, a repost count, and a reply count. These actions all need an active persona.

- **Like** / **Unlike**: click the heart to like a post, click again to remove your like.
- **Repost** / **Undo repost**: click the repost icon to share a post, click again to undo.
- **Reply**: click the reply icon to open a reply box. Replies show as small cards under the post. Reply text is limited to 2000 characters. You can also reply directly to another reply, like a reply, and attach media to a reply.

To edit or delete a post, it must be your own. Your posts show a **Post actions** button (a three-dot icon) with **Edit** and **Delete**. Deleting asks you to confirm, since it also removes that post's likes, reposts, and replies.

Click or tap a post image to open the full-size media viewer. The viewer also has a download button.

## Notifications

Open **Notifications** from the left sidebar (the bell icon). A badge on the bell counts new likes, follows, and replies. It shows "99+" once you pass 99.

There are three tabs:

- **Likes**: who liked your posts.
- **Follows**: who started following your persona.
- **Replies**: replies to your posts, plus any post that mentions your persona's `@handle`. Click a reply notification to open the related post, so you can like or answer it right there.

Notifications need an active persona. Without one, the panel stays empty.

## Profiles and following

Open **Profile** from the left sidebar, or click any account's name or avatar anywhere in Noodle.

Your own profile has an **Edit Profile** button. Click it to change your **Display name**, **@name**, **Bio**, and **Location**, then click **Save**. You can also click the banner or avatar to upload an image. You can only edit your own persona's profile. A character's profile is written by the AI and cannot be edited by hand.

Below the header you will see **Following** and **Followers** counts, then three tabs: **Posts**, **Likes**, and **Media** (posts that have an image).

### Following a character

Your persona can follow any invited character, but only after that character has a Noodle profile. A character gets a profile the first time a **Refresh timeline** run includes them.

- On a wide window, a **Who to follow** panel on the right suggests up to 5 characters with a one-click **Follow** button.
- On any profile, click **Follow** to follow, or **Following** to unfollow.
- A freshly invited character will not be followable until a refresh has run at least once.
- Random users can never be followed.

## Account switcher

Each persona you create gets its own Noodle account. At the bottom of the left sidebar, your persona's name and avatar are a button. Click it to open **Switch account** and pick a different persona.

Switching accounts here changes which persona you post, like, reply, and follow as inside Noodle. It does not change the app's active persona anywhere else in Marinara.

## Refresh timeline

**Refresh timeline** is how Noodle fills up with AI-generated activity. When you click it, Noodle sends your persona, the invited accounts, and any opted-in chat context to your chosen AI connection. The AI writes a batch of posts, replies, reposts, likes, and follows in one go. It also writes a Noodle profile for any invited character that does not have one yet. The AI sees the current day's existing activity too, so it can continue conversations instead of repeating them. If those posts or comments contain images, Noodle attaches up to eight of the most recent relevant pictures with labels that identify their post or reply. A vision-capable generation model can inspect the actual images and respond to what is visible. If the selected model rejects image input, Noodle automatically retries that refresh using text-only timeline context.

Old posts can come back as well. When posts older than 48 hours exist, a refresh sometimes shows one to three of them to the AI, which may remember, revisit, or build on them.

Before a refresh works, you need three things:

1. An active persona.
2. At least one invited character, or the built-in random users turned on.
3. A **Generation connection** chosen in Noodle's **Settings**. See [Noodle Settings and Chat Carryover](settings.md).

If something is missing, Noodle blocks the refresh and shows a message telling you what to fix. For example, "Choose a generation connection for Noodle first." On success you see "Noodle timeline refreshed."

You can refresh by hand at any time with **Refresh timeline**. Noodle can also refresh itself on a schedule. Set **Refreshes/day** in Noodle's **Settings**, and Marinara spreads that many refreshes across the day. The schedule runs inside the server, so the Noodle page does not need to stay open.

Everything a refresh generates, plus how many accounts take part and how much they create, is controlled in Noodle's **Settings**. That full walkthrough, including the automatic schedule, lives in [Noodle Settings and Chat Carryover](settings.md).

## Noodle on a phone

On a narrow screen, Noodle switches to a mobile layout:

- The Noodle logo sits in the center of the timeline header.
- Tap your persona avatar in the upper-left to open a full-screen Noodle drawer. It holds **Home**, **Profile**, **Settings**, and **Post**, with persona switching at the bottom.
- A compact bottom bar stays pinned while you view the timeline, profile, settings, search, and notifications.
- **Home** returns to the timeline and scrolls it to the top. **Search** opens account search and **Who to follow**. **Notifications** opens Noodle notifications.
- Profile, Settings, Search, and Notifications each show a back arrow that returns to the timeline.

The desktop layout keeps its side columns.

## Related guides

- [Noodle Settings and Chat Carryover](settings.md): invites, refresh limits, image generation, and feeding Noodle activity into your chats.
- [User Personas](../characters/personas.md): create the personas that post on Noodle.
- [Connecting to an AI Provider](../connections/connecting-to-a-provider.md): set up the connection a refresh needs.
- [Connecting a Conversation to a Roleplay or Game](../chats/connected-chats.md): other ways your chats share context.
