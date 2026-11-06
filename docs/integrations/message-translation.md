# Message Translation

Marinara Engine can translate chat messages between languages. This guide shows how to choose a translation service, set languages, turn on automatic translation and translate a single message.

Translation is set per chat. Each chat keeps its own service, languages and keys. To start new chats with the same settings, save them as [translator defaults](#translator-defaults-for-new-chats).

## Where to find translation settings

1. Open a chat in any mode (Conversation, Roleplay or Game).
2. Open **Chat Settings**.
3. Find the **Translation** section.

All the settings below are in that section.

## Choose a provider

The **Provider** list has four options.

| Provider | What it needs | Notes |
| --- | --- | --- |
| **Google Translate** | Nothing | The default. Free, no key. Up to 5000 characters per request. |
| **DeepL API** | A DeepL API key | Higher quality. Free and paid keys both work. |
| **DeepLX (self-hosted)** | A DeepLX server URL | For a DeepLX server you run yourself. |
| **AI (via connection)** | An AI account | Uses one of your AI models to translate. |

Google Translate works with no setup. Pick another only if you need what it offers.

### Set the languages

Two fields set the languages. Both default to `en` (English).

- **Model Language** is the language the AI model understands and replies in. When you type in your own language, your message is translated into this one before the AI reads it. **Translate My Messages** and **Translate draft** use it.
- **My Language** is the language you read. AI replies are translated into this one. **Auto-Translate Responses** and the per-message **Translate** button use it.

For example, if you write in Spanish and the AI works best in English, set **Model Language** to `en` and **My Language** to `es`.

For Google Translate, DeepL API and DeepLX, enter a short code such as `en`, `ja`, `es`, `de`, `fr`, `zh` or `ko`. For AI (via connection), enter a language name such as `English`, `Japanese` or `Spanish`.

If it did not work: a wrong code or name gives an error or an unchanged text. Check the format for your provider.

### DeepL API

Pick **DeepL API** and paste your DeepL account key into **DeepL API Key**. A key ending in `:fx` is a free-tier key, and Marinara sends it to DeepL's free service. Any other key is treated as paid.

```text
xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx
```

### DeepLX

DeepLX is a free translation server you run yourself. Pick **DeepLX (self-hosted)** and enter your server's address in **DeepLX URL**, for example `http://localhost:1188`.

A DeepLX server on your own computer or local network has a local address. Marinara blocks local addresses by default for safety. To allow them, add this line to your `.env` file and save. No restart is needed. It takes effect usually within seconds, up to about 30 seconds. The [Server Configuration Reference](../CONFIGURATION.md) shows where the file is.

```text
DEEPLX_LOCAL_URLS_ENABLED=true
```

A DeepLX server at a public internet address does not need this setting.

### AI (via connection)

Pick **AI (via connection)** to use one of your AI models. Three fields appear.

- **Connection**: which AI account translates. It is required. If you leave it unset, translation fails with "Connection ID is required for AI translation". See [Connecting to an AI Provider](../connections/connecting-to-a-provider.md).
- **Outgoing Message Prompt** and **Incoming Response Prompt**: the instructions the AI gets when it translates your messages and its own replies. Both start with a built-in default you can edit for this chat. `{{targetLanguage}}` becomes **Model Language** or **My Language**. After you change a prompt, **Restore** resets it. The default prompt is:

```text
You are a translator. Translate the given text accurately into {{targetLanguage}},
preserving formatting, markdown, and any special characters like *asterisks* for actions.
Output ONLY the translated text, nothing else -- no explanations, no extra commentary.
```

## Turn on automatic translation

Four toggles sit below the provider settings. All start off.

- **Auto-Translate Responses**: translates every AI response right after it is generated. In Game mode, Marinara removes game-master-only tags from the narration first.
- **Translate My Messages**: translates your message into **Model Language** just before it goes to the AI, replacing your typed text. If translation fails, Marinara sends your original text and shows an error.
- **Show Draft Translate Button**: adds a **Translate draft** button beside **Send**, so you can review and edit the translation before sending. It is the manual alternative to **Translate My Messages**.
- **Show Only Translation**: shows a translated message's translation in place of the original, instead of both together.

In Conversation you can always translate an unsent draft from the composer's smile button, then **Tools → Translate draft**, on desktop or mobile. You do not need either toggle. It uses this chat's input translation settings and replaces the draft for you to review. It does not send anything. A failed translation leaves the draft as it was.

## Translator defaults for new chats

**Save translator defaults**, below the toggles, saves this chat's translation settings for new chats in every mode. Settings from the setup wizard and from a settings profile come first. Existing chats keep their own settings. **Forget saved defaults** clears them. [Noodle](../agents/noodle-settings.md#translation) uses the same defaults.

The DeepL API key and the DeepLX URL stay on this Marinara install. Chat exports, exported settings profiles and **Export Profile** files leave them out, and importing any of them never sets them. Enter them again after you move a chat to another install.

## Translate one message

Every message, from you or the AI, has a **Translate** button (a languages icon) in its action bar. It works without any toggle above.

1. Move your pointer over the message, or tap it on a phone, to show its action bar.
2. Click **Translate**.
3. The translation appears below the message, or in its place with **Show Only Translation** on.
4. Click the button again to hide it. Its label then reads **Hide translation**.

The translation is saved with the message and survives a page refresh and switching chats. It uses the same provider and **My Language** as the section above.

## Provider limits

- **Google Translate** rejects text over 5000 characters with "Text too long for Google Translate (max 5000 characters). Use DeepL or AI provider for longer texts."
- **DeepL API**, **DeepLX (self-hosted)** and **AI (via connection)** accept longer text, up to a server limit of 50000 characters per request.
- **Google Translate**, **DeepL API** and **DeepLX (self-hosted)** stop with an error after 15 seconds.
- **AI (via connection)** follows your AI model's own timeout, not the 15-second limit.
- **DeepLX (self-hosted)** at a local address is blocked unless `DEEPLX_LOCAL_URLS_ENABLED=true` is set.

## Related guides

- [Message Actions: Edit, Delete, Swipe, Regenerate](../chats/messages.md)
- [Chat Settings Overview](../chats/chat-settings.md)
- [Connecting to an AI Provider](../connections/connecting-to-a-provider.md)
- [Server Configuration Reference](../CONFIGURATION.md)
