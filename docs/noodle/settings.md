# Noodle Settings and Chat Carryover

This guide covers the **Noodle settings** panel section by section, with every default and limit. It also explains how to connect Noodle to your chats. Two features do this: **Carryover to chats** and the per-chat **Allow Noodle references** toggle. They work in opposite directions.

Noodle is the in-app social media timeline in Marinara Engine. If you are new to it, read [Noodle: The In-App Social Timeline](overview.md) first. A persona is the character you play as in a chat. A connection is a saved link to an AI provider that generates text or images. See [Connecting to an AI Provider](../connections/connecting-to-a-provider.md).

## Opening the Noodle settings panel

1. Open Noodle from the top bar.
2. In the left sidebar, click the **Settings** button (the gear icon).
3. The panel header reads **Noodle settings**.

All Noodle settings are global. They apply to every persona and every chat, not to one chat at a time. Changes save as soon as you make them.

## NoodleR Access

- **Enable NoodleR**: a toggle, default **off**. Turn it on to expose the private account hub. While it is off, opening NoodleR shows the opt-in screen, NoodleR account queries are unavailable, and private account data remains isolated from the public Noodle timeline.

The **Manage stage profiles** screen, reached from **Noodle Settings** > **NoodleR Access**, lists the stage profiles currently available to the installation, including loading, failure, and empty states. A stage profile belongs to one public persona or character account but presents its own name, handle, bio, stage voice, and disclosure mode. Existing private accounts created before stage profiles were introduced show **Setup needed** until their profile is completed.

### Stage identity disclosure

Disclosure controls how the linked public identity may appear in a stage profile and AI-generated post. It does not decide who can view a profile or post.

- **Publicly connected (Open)**: the stage profile may openly be the same person. Generated text and image prompts may use the linked public name, handle, and recognizable continuity.
- **Inspired alter ego (Hinted)**: broad personality, interests, and themes may carry over, but the exact public name and handle are removed from generation context and filtered from generated text and image prompts before the post is saved. Distinctive traits may still feel recognizable.
- **Separate persona (Secret)**: the linked identity is treated as private authoring inspiration only. Profile generation receives a reduced, non-identifying brief and avoids canonical occupations, relationships, locations, signature phrases, and distinctive details. Exact identifiers are also filtered from generated output. This is not a formal anonymity guarantee; review the draft before saving.

Use **New profile** in **Manage stage profiles** to search and choose an eligible character or persona. The setup then explains disclosure and asks you to choose Open, Hinted, or Secret before showing the editable stage-profile form. You can fill the form yourself or ask AI to generate an editable draft from the source character, disclosure choice, and optional guidance. AI never saves the draft automatically; review the fields and select **Save stage profile** yourself. Open an existing profile and select **Edit profile** to change its presentation or use AI to refill the current draft. Profiles with hinted or secret disclosure do not expose their linked public account through NoodleR profile metadata.

### Guided private posts

Open a stage profile and select **Guide post**. Enter the moment, mood, or idea for the post, then select **Generate post**. NoodleR uses the configured Noodle generation connection and the stage profile's voice and disclosure mode to create one private post. The direction is kept in the modal if generation fails so it can be retried.

Generated private posts can store a disclosure-filtered image prompt, but NoodleR does not generate or serve private post images yet. Fan activity, automatic posting, cross-mode integration, and creator projects remain separate later capabilities.

## Subscriptions and post access

The NoodleR hub always shows creator pages as whichever persona is currently selected globally. Subscriptions and PPV unlocks belong to that viewer persona, so switching your active persona may change which creators and posts are available. Use **Noodle Settings** > **NoodleR Access** > **Manage stage profiles** to create, edit, or delete your own stage profiles instead.

When guiding a post, choose one access level:

- **Public**: every persona that can see the stage profile can read the post.
- **Subscribers**: the post stays locked until the selected viewer persona subscribes to that stage profile.
- **PPV**: the post has a simulated price and stays locked until that viewer persona unlocks it. No real payment is processed.

Each stage profile has its own **Subscriber access** settings. **Subscriptions include PPV** lets subscribers read that profile's PPV posts without unlocking each one. It is off by default. **Hidden from personas** removes the stage profile and all its posts from selected viewer personas, including direct subscribe and unlock requests. Hidden-from settings apply to the private stage profile only and do not hide its linked public Noodle account.

Use **Delete profile** on a managed stage profile to remove that private profile, all posts published under it, its subscriptions, and its PPV unlock records. The linked public Noodle account is not deleted and can be used to create a new stage profile later.

## Invites

The **Invites** section chooses which characters can take part in a Noodle refresh. A refresh is when the AI writes a batch of posts, replies, reposts, and likes for the invited accounts.

- **Professor Mari participates**: a toggle, default **on**. Turn it off to hide Professor Mari from Noodle account discovery and exclude her from future generated posts, replies, reactions, mentions, profile generation, and chat carryover. Existing timeline history is preserved, and turning the toggle back on restores her account.
- **Characters to Invite**: a search box. Type here to filter both the folder list and the character list below it.
- **Add from Folder**: click to expand a list of your character folders. Check one or more folders, then click the invite button at the bottom. The button label changes with your selection:
  - **Select folders to invite** when nothing is checked.
  - **Selected folder characters are invited** when everything is already invited.
  - **Invite N characters** when there are new characters to add.
- **Characters**: a scrollable list of every character in your library. Each row has an invite or remove button. Its status shows as **Invited**, **Included by folder**, or **Not invited**.

Inviting from a folder is a one-time bulk action. It is not a live sync. Characters you add to that folder later are not invited automatically.

## Refresh

The **Refresh** section controls the AI connection Noodle writes with, and how often Noodle refreshes on its own.

- **Generation connection**: a dropdown. Pick the connection Noodle uses to write posts, replies, reposts, likes, and profile text. It starts unset with the placeholder **Choose connection**. You must pick one before any refresh will run. Vision-capable models also receive up to eight recent relevant images from Noodle posts and comments. Text-only models that reject those image inputs are retried automatically without the pictures.
- **Refreshes/day**: a number, from 0 to 24, default **2**. This is how many automatic refreshes Marinara runs per day. Set it to 0 to turn automatic refreshes off. It does not limit how often you refresh by hand.

### Automatic schedule

When **Refreshes/day** is above 0, Marinara splits the day into equal windows and picks one random time inside each window. The planned times, with their timezone, show under **Automatic schedule**. Click the pencil next to a future time to move it to a different hour. Past times, completed times, and duplicate times cannot be picked.

Automatic refreshes run inside the Marinara server. The Noodle page does not need to stay open, but Marinara itself must be running. If a refresh fails, the schedule shows the error and retries later, waiting longer after repeated failures. If several planned times are missed, one successful catch-up refresh covers them instead of flooding the timeline.

## Active Accounts

The **Active Accounts** section sets how many eligible accounts take part in one refresh. Eligible accounts are your invited characters, folder-included characters, and random users if you turned them on.

- **Active selection**: a dropdown, default **Random range**. The options are **Random range**, **Exact count**, and **All invited**.
- With **Random range**, two fields appear: **Min active** (1 to 100, default **2**) and **Max active** (1 to 100, default **5**). Each refresh picks a count between them.
- With **Exact count**, one field appears: **Active count** (1 to 100). It sets a fixed number of accounts.
- With **All invited**, every eligible account takes part, with no cap.

Your active persona is always eligible on top of these accounts. Professor Mari is eligible while **Professor Mari participates** is on.

Noodle chooses the active accounts before it prepares first-time profiles. Only active characters without an existing generated Noodle profile receive a profile-generation request; inactive invited characters are not included. The timeline-writing request likewise receives character cards only for the accounts selected for that refresh.

## Activity

The **Activity** section limits how much a single refresh may create. Each field is a per-refresh cap.

| Field | Default | Range |
|---|---|---|
| **Posts** | 8 | 0 to 100 |
| **Replies** | 12 | 0 to 200 |
| **Reposts** | 4 | 0 to 100 |
| **Likes** | 18 | 0 to 500 |

Set a field to 0 to stop the AI from creating that kind of activity.

## Image Generation

The **Image Generation** section lets Noodle attach AI-made images to some posts. This needs an image-generation connection, which is a connection set up for making pictures. See [Supported AI Providers](../connections/providers-reference.md).

- **Image generation**: a toggle, default **off**. Turn it on to let the AI generate post images.
- When it is on, more controls appear:
  - **Image generation connection**: a dropdown, default **Default image generation connection**. Leaving it on Default uses whichever connection is marked default for image generation in the Connections panel.
  - **Prompt instructions**: a text box with built-in default text, up to 4000 characters. These extra notes are merged into the image prompt.
  - **Use avatar references**: a toggle, default **on**. Sends the character's avatar or reference images to the image model.
  - **Include descriptions**: a toggle, default **on**. Adds the character's written appearance notes to the image prompt.
  - **Images/refresh**: a number, 0 to 50, default **3**. This caps generated post images separately for every manual or automatic refresh.
- **Attach gallery images**: a separate toggle, default **off**. It stays visible even when **Image generation** is off. Instead of making a new image, it lets a post reuse an image from that character's gallery or from a chat they appear in.

If you turn on **Image generation** but have no usable image connection, a refresh is blocked. You will see the message "Choose an image generation connection for Noodle first." A failed image is retried once. If the second attempt also fails, the refresh continues and publishes a clean text-only post instead of exposing the unused image prompt.

The template Noodle uses to write these image prompts is called **Noodle Post Image**. You can edit it under **Settings** > **Generations** > **Image Generation Prompt Overrides**. Your **Prompt instructions** text is passed into that template, and the result then goes through your normal image style profile. See [Prompt Overrides for Image and Video](../prompts/prompt-overrides.md) and [Image Style Profiles](../media/style-profiles.md). Professor Mari has no character card, so her image posts use her built-in avatar and reference art instead.

## Timeline Writing

The **Timeline Writing** section tunes the refresh writer's tone and long-term memory behavior.

- **Enhanced tone & continuity**: a toggle, default **off**. When on, each account's voice is grounded more strongly in its own Personality/Description/Backstory instead of a default upbeat tone, accounts are encouraged to react to, quote, or argue with each other's posts within the same refresh, older-post recall happens more often (and favors posts relevant to currently active accounts instead of picking purely at random), and the recall instruction allows rather than discourages references. Off reproduces Noodle's original tone and recall behavior exactly, so turning this on is the only way your timelines change.
- **Use generated character schedules**: a toggle, default **off**. When on, Noodle includes today's existing generated Conversation schedule for each participating character when available. Noodle does not generate or refresh schedules itself. The user's current local date and time are included in every timeline refresh whether this toggle is on or off.

## Customizing the timeline writer's voice

Noodle's refresh writer follows a built-in set of tone and creative-freedom instructions: how much personality each account's posts should carry, and how much accounts may banter, joke, or clash with each other. You can rewrite this text under **Settings** > **Generations** > **Image Generation Prompt Overrides** > **Noodle Timeline Voice & Tone** (the section title says "Image," but this list holds every customizable Noodle/Conversation text prompt, not only image ones). The default text shown there follows the **Enhanced tone & continuity** toggle above until you customize it; once you save your own text, it is used regardless of that toggle.

This override only covers voice and tone. The rules that keep a refresh's output valid (which structured actions are allowed, how interactions must be targeted, and so on) are not part of this text and always stay in effect, so a rewritten voice cannot break a refresh.

## World / Lore

The **World / Lore** section lets a refresh pull in lorebook entries, the same lorebook system used by chat generation.

- **Lorebook context**: a toggle, default **off**. When on, each refresh scans recent Noodle post and reply text, plus the active characters' profiles, for lorebook keyword matches, and includes any matching entries as world/lore context for the accounts taking part in that refresh. Only lorebooks linked to an active character (or marked global) can activate. Activated world/lore content has a hard 8,192-token budget per refresh. This is off by default, so existing timelines are unaffected until you turn it on.

## Carryover

The **Carryover** section pushes recent Noodle activity into your chats. When on, a chat's prompt gets a "Recent Social Media Activity" block describing what your characters have been doing on Noodle.

- **Carryover to chats**: three separate toggles, all **off** by default: **Conversations**, **Roleplays**, and **Games**. Turn on the modes you want to receive Noodle activity.
- **Carry hours**: a number, 1 to 720, default **48**. This is how far back, in hours, Noodle looks for activity to carry over.
- **Carry items**: a number, 1 to 50, default **8**. This is the most activity summaries added to one chat turn.

Carryover only pulls activity for characters who are invited on Noodle, plus the chat's active persona. Folder-only inclusion is not enough here.
The complete wrapped carryover block has a separate hard 8,192-token budget per chat generation. If the item limit would exceed it, Marinara keeps the newest summaries that fit and renders them in chronological order.

## Reset Noodle

The **Reset Noodle** section clears the timeline while keeping your accounts and settings.

1. Click the **Reset Noodle Timeline** button.
2. A dialog titled **Reset Noodle Timeline** appears. It reads "This removes all posts, replies, likes, reposts, activity digests, and refresh records. Profiles, follows, invites, and settings stay."
3. Click **Reset timeline** to confirm.

This only deletes timeline content. Your accounts, handles, bios, follows, invites, and every Noodle setting stay in place.

## Random users

Random users are six built-in ambient accounts that are not from your library: Thread Countess, Packet Soup, Orbit Notice, Glass Bulletin, Moth Hour, and Brine Index. Each has a short flavor bio.

You turn them on with the **Random users** row at the top of the **Characters** list in the **Invites** section. It is **off** by default. Its subtitle reads **Enabled** when on, or **Ambient fake profiles** when off. When on, these accounts can post, like, repost, reply, and follow during a refresh. They can never be followed from a profile.

## Connecting Noodle to your chats

Noodle and your chats can share context in two directions. These are two separate features. Turning one on does not turn on the other.

**Carryover to chats** (set in Noodle settings) sends Noodle activity into a chat. It adds the "Recent Social Media Activity" block to that chat's prompt, as described in the Carryover section above.

**Allow Noodle references** is a per-chat toggle. It sends chat activity the other way, into Noodle. You find it in the chat's own settings, near the **Connected Chats** area. See [Chat Settings Overview](../chats/chat-settings.md). It is **off** by default for every chat. Its description reads "Timeline refreshes may include recent messages from this chat, with the chat name, mode, and participants stated in the prompt." If that chat also has a [Conversation character schedule](../conversation/schedules.md) running, a character's current status and activity in that story (for example, "currently dnd (At the office)") is included alongside its messages, scoped to that one chat.

To make Noodle activity appear in a chat, turn on the matching **Carryover to chats** mode. To let a Noodle refresh read from a chat, turn on that chat's **Allow Noodle references**. You can use either one alone, or both together.

## Troubleshooting

- **Refresh now generates nothing**: pick a **Generation connection**, invite at least one character (or turn on random users), and check the error shown in the **Refresh** section.
- **Automatic refreshes are not happening**: set **Refreshes/day** above 0, keep the Marinara server running, and check the planned times and timezone under **Automatic schedule**. If the schedule shows an error, fix the connection or rate limit problem and let the retry run.
- **Posts do not mention a recent chat**: turn on **Allow Noodle references** in that chat's settings, and make sure the character is invited. Chat context is guidance for the AI, not a guarantee.
- **Noodle activity does not show in chats**: turn on the matching **Carryover to chats** mode, and raise **Carry hours** if the activity is too old.
- **Posts have no images**: turn on **Image generation**, pick a working image connection, and check the **Images/refresh** limit.

## Settings and defaults

This table lists every Noodle setting with its default and range.

| Setting | Default | Range or options |
|---|---|---|
| **Enable NoodleR** | off | on or off |
| **Generation connection** | none | any text connection (required for refresh) |
| **Professor Mari participates** | on | on or off |
| **Refreshes/day** | 2 | 0 to 24 (0 turns automatic refreshes off) |
| **Active selection** | Random range | Random range, Exact count, All invited |
| **Min active** | 2 | 1 to 100 (Random range only) |
| **Max active** | 5 | 1 to 100 (Random range only) |
| **Active count** | matches Max active | 1 to 100 (Exact count only) |
| **Posts** | 8 | 0 to 100 |
| **Replies** | 12 | 0 to 200 |
| **Reposts** | 4 | 0 to 100 |
| **Likes** | 18 | 0 to 500 |
| **Image generation** | off | on or off |
| **Image generation connection** | Default | any image-generation connection |
| **Prompt instructions** | built-in text | up to 4000 characters |
| **Use avatar references** | on | on or off |
| **Include descriptions** | on | on or off |
| **Images/refresh** | 3 | 0 to 50 |
| **Attach gallery images** | off | on or off |
| **Lorebook context** | off | on or off |
| **Enhanced tone & continuity** | off | on or off |
| **Carryover: Conversations** | off | on or off |
| **Carryover: Roleplays** | off | on or off |
| **Carryover: Games** | off | on or off |
| **Carry hours** | 48 | 1 to 720 |
| **Carry items** | 8 | 1 to 50 |
| **Allow Noodle references** (per chat) | off | on or off |

## Related guides

- [Noodle: The In-App Social Timeline](overview.md)
- [Chat Settings Overview](../chats/chat-settings.md)
- [Connecting to an AI Provider](../connections/connecting-to-a-provider.md)
- [Supported AI Providers](../connections/providers-reference.md)
