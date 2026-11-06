# Noodle Settings and Chat Carryover

Use the **Noodle settings** panel to choose who takes part in the timeline, how much they post, and how Noodle shares context with your chats. Two features share context in opposite directions: **Carryover to chats** and the per-chat **Allow Noodle references** toggle.

If you are new to Noodle, read [Noodle: The In-App Social Timeline](noodle.md) first. A persona is the character you play as in a chat. See [Connecting to an AI Provider](../connections/connecting-to-a-provider.md) for AI accounts.

## Open the settings

1. Open Noodle from **Home**.
2. In the left sidebar, click **Settings** (the gear icon). The header reads **Noodle settings**.
3. Pick a page with the buttons under the header.

| Page | Sections |
| --- | --- |
| **General** | [Refresh](#refresh), [Translation](#translation) |
| **Timeline** | [Activity](#activity), [Image Generation](#image-generation) |
| **Participants** | [Invites](#invites), [Random users](#random-users) (**Ambient Profiles**), [Active Accounts](#active-accounts) |
| **Advanced** | **Noodle Prompt**, [Image Understanding](#image-understanding), [Timeline Writing](#timeline-writing), [World / Lore](#world--lore), [Carryover](#carryover), [Reset Noodle](#reset-noodle) |

All Noodle settings are global. They apply to every persona and chat. Changes save as you make them. A full list of defaults is in [Settings and defaults](#settings-and-defaults).

## Refresh

A refresh is when the AI writes a batch of posts, replies, reposts and likes for the invited accounts. This section sets the model Noodle writes with and how often it refreshes alone.

- **Generation model**: the model Noodle uses to write posts, replies, reposts, likes and profile text. It starts unset, with the placeholder **Choose connection**. You must pick one before any refresh runs. A model that can see pictures also gets up to eight recent relevant images from posts and comments. A text-only model that rejects them is retried without the pictures.
- **Refreshes/day**: 0 to 24, default **2**. How many automatic refreshes run per day. 0 turns them off. It does not limit manual refreshes.

### Automatic schedule

When **Refreshes/day** is above 0, Marinara splits the day into equal windows and picks one random time in each. The planned times, with their timezone, show under **Automatic schedule**. Click the pencil next to a future time to move it to another hour. Past, completed and duplicate times cannot be picked.

Automatic refreshes run inside the server, so the Noodle page can be closed, but Marinara must be running. If a refresh fails, the schedule shows the error and retries later, waiting longer after repeated failures. If several planned times are missed, one successful catch-up refresh covers them.

## Translation

**Translate posts automatically** (default **off**, needs Noodle 1.5.0 or later) shows a translation under every post and comment your personas did not write, without clicking **Translate** on each. Noodle uses the translator defaults saved from a chat's **Translation** settings (**Save translator defaults**). Without saved defaults it uses Google Translate into English. See [Message Translation](../integrations/message-translation.md). Text already in the target language gets no extra copy, a translation you hide stays hidden, and turning the switch off stops translations still waiting.

Translations are kept in this browser, whether automatic or made with **Translate**. They return after a refresh, leaving Noodle or reloading. Another device, or a browser with cleared data, translates again. **Reset Noodle Timeline** also forgets them.

## Invites

**Invites** chooses which characters can take part in a refresh.

- **Professor Mari participates**: default **on**. Turn it off to hide her from account discovery and exclude her from new posts, replies, reactions, mentions, profile generation and chat carryover. Existing history stays, and turning it on again restores her account.
- **Characters to Invite**: a search box that filters both the folder list and the character list.
- **Add from Folder**: expands your character folders. Check one or more, then click the invite button at the bottom. Its label reads **Select folders to invite** when nothing is checked, **Selected folder characters are invited** when all are already invited, and **Invite N characters** when there are new ones.
- **Characters**: every character in your library. Each row has an invite or remove button and a status: **Invited**, **Included by folder** or **Not invited**.

Inviting from a folder is a one-time bulk action, not a live sync. Characters you add to the folder later are not invited automatically.

## Random users

Random users are six built-in ambient accounts that are not from your library: Thread Countess, Packet Soup, Orbit Notice, Glass Bulletin, Moth Hour and Brine Index. Each has a short bio.

Turn them on with the **Random users** row at the top of the **Characters** list in **Invites**. It is **off** by default and reads **Ambient fake profiles** when off and **Enabled** when on. When on, they can post, like, repost, reply and follow during a refresh. They can never be followed.

**Ambient Profiles** on the **Participants** page lets you edit these identities or generate a different set. Rerolling keeps posts and relationships but removes profile images.

## Active Accounts

**Active Accounts** sets how many eligible accounts take part in one refresh. Eligible accounts are your invited characters, folder-included characters and random users, if on. Your active persona is always eligible on top, and so is Professor Mari while she participates.

- **Active selection**, default **Random range**: **Random range**, **Exact count** or **All invited**.
- **Random range** shows **Min active** (1 to 100, default 2) and **Max active** (1 to 100, default 5). Each refresh picks a count between them.
- **Exact count** shows **Active count** (1 to 100).
- **All invited**: every eligible account takes part, with no cap.

Noodle picks the active accounts before it prepares first-time profiles. Only active characters without a generated profile get a profile request. The timeline-writing request gets character cards only for the accounts chosen for that refresh.

## Activity

Each field caps what one refresh may create. Set a field to 0 to stop that kind of activity.

| Field | Default | Range |
| --- | --- | --- |
| **Posts** | 8 | 0 to 100 |
| **Replies** | 12 | 0 to 200 |
| **Reposts** | 4 | 0 to 100 |
| **Likes** | 18 | 0 to 500 |

## Image Generation

This section lets Noodle attach AI-made images to some posts. It needs an image model. See [Supported AI Providers](../connections/providers-reference.md) and [Image Generation Providers and Setup](../media/image-providers.md).

- **Image generation**: default **off**. Turn it on to let the AI make post images. More controls then appear.
- **Image width** and **Image height**: 64 to 4096 pixels, default **1024** by **1536**.
- **Image generation connection**: default **Default image generation connection**, which uses the model marked default for images in **Connections**. A character can use its own (see [Profiles and following](noodle.md#profiles-and-following)).
- **Image instructions (sent to your LLM)**: built-in text, up to 4000 characters. The timeline model follows it when writing each post's image description, so write directions, not image tags. For style tags sent straight to the image model, use a style profile.
- **Use avatar references**: default **on**. Sends the character's avatar or reference images to the image model.
- **Interpret image prompts**: default **on**. A text model rewrites each image prompt, following your image model's **Image prompting instructions** and your style profile's Style text. When off, the instructions are not used and the Style text is added as written.
- **Include descriptions**: default **on**. Adds the character's written appearance notes to the image prompt. With **Interpret image prompts** on, the text model works them in instead of pasting them.
- **Images/refresh**: 0 to 50, default **3**. Caps generated post images for each manual or automatic refresh.

**Attach gallery images** (default **off**) is a separate toggle that stays visible even when image generation is off. Instead of making a new image, a post can reuse an image from that character's gallery or from a chat they are in.

If it did not work: with image generation on but no usable image model, a refresh is blocked with "Choose an image generation connection for Noodle first." A failed image is retried once. If it fails again, the refresh goes on and publishes a clean text-only post.

The template for these image prompts is **Noodle Post Image**. Edit it under **Settings → Generations → Image Generation Prompt Overrides**. Your image instructions go into that template, and the result goes through your style profile. See [Prompt Overrides for Image and Video](../prompts/prompt-overrides.md) and [Image Style Profiles](../media/style-profiles.md). Professor Mari has no character card, so her image posts use her built-in avatar and reference art.

## Image Understanding

This section decides how the timeline writer sees pictures already on the timeline.

- **Show images to the writer**: default **on**. The writer gets up to eight recent timeline images when its model accepts pictures. Off, it gets none.
- **Image captioning**: a vision-capable model describes timeline images, so a text-only writer can follow them too. Until you change it, it follows the captioning setting of the **Generation model**. **Use connection default** goes back to that.
- **Captioning model**: shown when captioning is on. **Use Noodle generation connection** uses the **Generation model**. Pick another when that model cannot see images.

Captioning still sends timeline images to the captioning model when **Show images to the writer** is off.

## Timeline Writing

This section tunes the refresh writer's tone and memory.

- **Enhanced tone & continuity**: default **off**. When on, each account's voice rests more on its own Personality, Description and Backstory instead of a default upbeat tone. Accounts are encouraged to react to, quote or argue with each other's posts in the same refresh. Older-post recall happens more often and favors posts relevant to active accounts. The recall instruction allows references instead of discouraging them. Off keeps Noodle's original tone and recall exactly.
- **Use generated character schedules**: default **off**. When on, Noodle includes today's existing generated Conversation schedule for each participating character when available. Noodle does not make or refresh schedules itself. The current local date and time go into every refresh either way.

### Customize the writer's voice

You can rewrite the writer's built-in tone and creative-freedom instructions under **Settings → Generations → Image Generation Prompt Overrides → Noodle Timeline Voice & Tone**. The section is titled "Image," but the list holds every customizable Noodle and Conversation text prompt. The default text there follows **Enhanced tone & continuity** until you save your own text, and then yours is used regardless.

This override covers voice and tone only. The rules that keep a refresh valid, such as which structured actions are allowed, always stay in effect.

## World / Lore

**Lorebook context** (default **off**) lets a refresh use lorebook entries. When on, each refresh scans recent Noodle post and reply text, plus the active characters' profiles, for lorebook keyword matches. Matching entries go in as world context for the accounts in that refresh. Only lorebooks linked to an active character, or marked global, can activate. Activated content has a hard 8,192-token budget per refresh.

## Carryover

**Carryover** pushes recent Noodle activity into your chats. When on, a chat's prompt gets a "Recent Social Media Activity" block about what your characters did on Noodle.

- **Carryover to chats**: three toggles, all **off** by default: **Conversations**, **Roleplays** and **Games**. Turn on the modes that should get Noodle activity.
- **Carry hours**: 1 to 720, default **48**. How far back Noodle looks.
- **Carry items**: 1 to 50, default **8**. The most summaries added to one chat turn.

Carryover pulls activity only for characters invited on Noodle, plus the chat's active persona. Folder-only inclusion is not enough. The whole carryover block has a hard 8,192-token budget per chat generation. If the item limit would exceed it, Marinara keeps the newest summaries that fit and shows them in time order.

## Reset Noodle

This clears the timeline and keeps your accounts and settings.

1. Click **Reset Noodle Timeline**.
2. Read the dialog: "This removes all posts, replies, likes, reposts, activity digests, and refresh records. Profiles, follows, invites, and settings stay."
3. Click **Reset timeline** to confirm.

Only timeline content is deleted. Accounts, handles, bios, follows, invites and every setting stay.

## Connect Noodle and your chats

Noodle and chats can share context in two directions. Turning one on does not turn on the other.

- **Carryover to chats** (Noodle settings) sends Noodle activity into a chat. See [Carryover](#carryover).
- **Allow Noodle references** is a per-chat toggle that sends chat activity into Noodle. Find it in the chat's own settings near **Connected Chats**. See [Chat Settings Overview](../chats/chat-settings.md). It is **off** by default. Its description reads "Timeline refreshes may include recent messages from this chat, with the chat name, mode, and participants stated in the prompt." If the chat also runs a [Conversation character schedule](../conversation/schedules.md), a character's current status and activity in that story, such as "currently dnd (At the office)", is included, scoped to that chat.

Use either one alone, or both together.

## Troubleshooting

- **A refresh generates nothing**: pick a **Generation model**, invite at least one character (or turn on random users), and read the error in the **Refresh** section.
- **Automatic refreshes are not happening**: set **Refreshes/day** above 0, keep Marinara running, and check the planned times and timezone under **Automatic schedule**. If it shows an error, fix the account or rate limit and let the retry run.
- **Posts do not mention a recent chat**: turn on **Allow Noodle references** in that chat and make sure the character is invited. Chat context is guidance for the AI, not a guarantee.
- **Noodle activity does not show in chats**: turn on the matching **Carryover to chats** mode and raise **Carry hours** if the activity is too old.
- **Posts have no images**: turn on **Image generation**, pick a working image model and check **Images/refresh**.

## Settings and defaults

| Setting | Default | Range or options |
| --- | --- | --- |
| **Generation model** | none | any text model (required for refresh) |
| **Professor Mari participates** | on | on or off |
| **Refreshes/day** | 2 | 0 to 24 (0 turns automatic refreshes off) |
| **Translate posts automatically** | off | on or off |
| **Active selection** | Random range | Random range, Exact count, All invited |
| **Min active** | 2 | 1 to 100 (Random range only) |
| **Max active** | 5 | 1 to 100 (Random range only) |
| **Active count** | matches Max active | 1 to 100 (Exact count only) |
| **Posts** | 8 | 0 to 100 |
| **Replies** | 12 | 0 to 200 |
| **Reposts** | 4 | 0 to 100 |
| **Likes** | 18 | 0 to 500 |
| **Image generation** | off | on or off |
| **Image width** | 1024 | 64 to 4096 |
| **Image height** | 1536 | 64 to 4096 |
| **Image generation connection** | Default | any image model |
| **Image instructions (sent to your LLM)** | built-in text | up to 4000 characters |
| **Use avatar references** | on | on or off |
| **Interpret image prompts** | on | on or off |
| **Include descriptions** | on | on or off |
| **Images/refresh** | 3 | 0 to 50 |
| **Attach gallery images** | off | on or off |
| **Show images to the writer** | on | on or off |
| **Image captioning** | follows the Generation model | on or off |
| **Captioning model** | Use Noodle generation connection | any model that can see pictures |
| **Use connection default** | on | on or off; restores the Generation model's captioning setting |
| **Lorebook context** | off | on or off |
| **Enhanced tone & continuity** | off | on or off |
| **Use generated character schedules** | off | on or off |
| **Carryover: Conversations** | off | on or off |
| **Carryover: Roleplays** | off | on or off |
| **Carryover: Games** | off | on or off |
| **Carry hours** | 48 | 1 to 720 |
| **Carry items** | 8 | 1 to 50 |
| **Allow Noodle references** (per chat) | off | on or off |

## Related guides

- [Noodle: The In-App Social Timeline](noodle.md)
- [Chat Settings Overview](../chats/chat-settings.md)
- [Connecting to an AI Provider](../connections/connecting-to-a-provider.md)
- [Supported AI Providers](../connections/providers-reference.md)
