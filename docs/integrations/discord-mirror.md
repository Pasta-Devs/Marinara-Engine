# Discord Message Mirror

The Discord Message Mirror copies your chat messages into a Discord channel as you chat. It works in Conversation, Roleplay and Game modes.

It is a one-way relay. Marinara sends messages out, and Discord cannot send anything back, so this is not a two-way bot. It uses a Discord webhook, a special URL that lets one app post messages into a Discord channel. The mirror is set per chat. Each chat has its own webhook URL, and other chats stay off until you paste a URL in each one.

## Create a Discord webhook URL

You create the webhook inside Discord, not inside Marinara. You need permission to manage the Discord channel you want to use.

1. Open your Discord server and pick the channel where messages should appear.
2. Open that channel's settings, then open **Integrations**, then **Webhooks**.
3. Create a new webhook and copy its webhook URL.

A Discord webhook URL looks like this:

```text
https://discord.com/api/webhooks/123456789012345678/AbCdEf-example-token
```

Keep this URL private. Anyone who has it can post messages to your Discord channel.

## Turn the mirror on

The webhook box is in each chat's settings, inside **Connected Chats**. It is labeled **Discord Mirror**, and its placeholder reads `https://discord.com/api/webhooks/...`.

1. Open the chat you want to mirror.
2. Open **Chat Settings**.
3. Find the **Connected Chats** section.
4. Paste your webhook URL into the input box near the bottom of that section.

The mirror is now on for that chat. To turn it off, clear the box.

If it did not work: a URL that is not a valid Discord webhook shows the red text "Invalid webhook URL format" below the box. Fix the URL and the mirror saves. Marinara checks the URL again on the server when you save.

The webhook URL stays on this Marinara install. Chat exports, exported settings profiles and **Export Profile** files leave it out, and importing any of them never turns on a mirror. To mirror a chat you moved to another install, paste the URL again there. A settings profile you saved on this install still sets your mirror when you apply it.

## What gets sent

Marinara mirrors your messages and the AI replies as they are generated.

- Sender name: your messages use your active persona name. AI messages use the character name.
- In Game Mode, turns by party members or NPCs (non-player characters) are sent under the name "Party". Story narration is sent under "Narrator". If your game uses the **Character GM** option, the game master's replies use that character's name instead.
- No picture is sent. Discord shows the sender name and the text only.
- Long messages: Discord caps each message at 2000 characters. A message longer than 1997 characters is shortened, and the mirrored copy ends with "...".
- Mentions like @everyone or @here inside the text do not ping anyone in your Discord channel.

## What is not sent

- Regenerated replies and swipes are not mirrored again. A swipe is another answer kept on the same message. Only the first reply for each turn is sent.
- Impersonated messages are not mirrored. Impersonate is the feature where the AI writes a message in your place.
- A send that fails is not resent. A send Discord answers with a rate limit (429) is not resent either; see below. A failed send shows no error in the chat. Failures other than a rate limit are recorded on the server only.

## Rate limiting

Discord limits how fast an app can post. Marinara sends at most one message about every 1.2 seconds per webhook. That is around 50 messages per minute. Extra messages wait in a queue and go out in order. If Discord answers a send with 429 (slow down), that message is not resent. Marinara waits for the Retry-After time Discord gives, then continues with the next queued message.

## Related guides

- [Connecting a Conversation to a Roleplay or Game](../chats/connected-chats.md)
