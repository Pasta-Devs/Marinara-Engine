# Discord Message Mirror

This guide explains the Discord Message Mirror in Guksu Motor. The mirror copies your chat messages into a Discord channel, one way, as you chat. It works in Conversation, Roleplay, and Game modes.

## What the mirror does

The Discord Message Mirror is a one-way relay. Guksu sends messages out to a Discord channel. Discord cannot send messages back into Guksu. This is not a two-way Discord bot.

The mirror uses a Discord webhook. A webhook is a special URL that lets one app post messages into a Discord channel.

The mirror is set per chat. Each chat has its own webhook URL. You turn the mirror on for one chat by pasting a URL there. Other chats stay off until you paste a URL in each one.

## Create a Discord webhook URL

You create the webhook inside Discord, not inside Guksu. You need permission to manage the Discord channel you want to use.

1. Open your Discord server and pick the channel where messages should appear.
2. Open that channel's settings, then open **Integrations**, then **Webhooks**.
3. Create a new webhook and copy its webhook URL.

A Discord webhook URL looks like this:

```
https://discord.com/api/webhooks/123456789012345678/AbCdEf-example-token
```

Keep this URL private. Anyone who has it can post messages to your Discord channel.

## Turn the mirror on

The webhook setting lives in each chat's settings. It sits inside the **Connected Chats** section. The input box has no label of its own. You find it by its placeholder text, which reads `https://discord.com/api/webhooks/...`.

1. Open the chat you want to mirror.
2. Open **Chat Settings**.
3. Find the **Connected Chats** section.
4. Paste your webhook URL into the input box near the bottom of that section.

The mirror is now on for that chat. To turn it off, clear the input box so it is empty.

If the URL is not a valid Discord webhook, you see the red text "Invalid webhook URL format" below the box. Fix the URL, and the mirror will save. Guksu also checks the URL again on the server when you save.

## What gets sent

Guksu mirrors your messages and the AI replies as they are generated.

- Sender name: your messages use your active persona name. AI messages use the character name.
- In Game Mode, story narration is sent under the name "Narrator". Turns by party members or NPCs (non-player characters) are sent under the name "Party". If your game uses the **Character GM** option, the game master's replies use that character's name instead.
- No picture is sent. Discord shows the sender name and the text only.
- Long messages: Discord caps each message at 2000 characters. A message longer than 1997 characters is shortened, and the mirrored copy ends with "...".
- Mentions like @everyone or @here inside the text do not ping anyone in your Discord channel.

## What is not sent

- Regenerated replies and swipes are not mirrored again. Only the first reply for each turn is sent to Discord.
- Impersonated messages are not mirrored. Impersonate is the feature where the AI writes a message in your place.
- If a send to Discord fails, Guksu does not show an error and does not retry. The failure is recorded on the server only.

## Rate limiting

Discord limits how fast an app can post. Guksu sends at most one message about every 1.2 seconds per webhook. That is around 50 messages per minute. Extra messages wait in a queue and go out in order. If Discord asks Guksu to slow down, Guksu waits, then continues sending.

## Related guides

- [Connecting a Conversation to a Roleplay or Game](../chats/connected-chats.md)
