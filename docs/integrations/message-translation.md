# Message Translation

Guksu Motor can translate chat messages between languages. This guide covers the four translation providers, the automatic translation toggles, the per-message Translate button, and the limits of each provider.

Translation is set up per chat. Each chat keeps its own provider, target language, and keys. A setting you enter in one chat does not carry over to another.

## Where to find translation settings

1. Open a chat in any mode (Conversation, Roleplay, or Game).
2. Open the **Chat Settings** panel for that chat.
3. Find the **Translation** section.

All of the provider and toggle settings below live in that **Translation** section.

## Choosing a provider

The **Provider** dropdown has four options:

| Provider | What it needs | Notes |
|---|---|---|
| **Google Translate** | Nothing | Default. Free, no key. Limited to 5000 characters per request. |
| **DeepL API** | A DeepL API key | Higher quality. Free and paid keys both work. |
| **DeepLX (self-hosted)** | A DeepLX server URL | For a DeepLX instance you run yourself. |
| **AI (via connection)** | An AI connection | Uses one of your AI providers to translate. |

**Google Translate** is selected by default and needs no setup. Pick a different provider only if you need one of the features below.

### Target Language

The **Target Language** field sets the language you translate into. The default is `en` (English).

The format depends on the provider:

- For **Google Translate**, **DeepL API**, and **DeepLX (self-hosted)**, enter a short language code. Examples: `en`, `ja`, `es`, `de`, `fr`, `zh`, `ko`.
- For **AI (via connection)**, enter a language name. Examples: `English`, `Japanese`, `Spanish`.

### DeepL API setup

When you pick **DeepL API**, a **DeepL API Key** field appears. Paste your DeepL account key here. DeepL keys look like this:

```
xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx
```

A key that ends in `:fx` is a free-tier key. Guksu sends it to DeepL's free service. Any other key is treated as a paid key.

### DeepLX setup

DeepLX is a free, self-hosted translation server that you run yourself. When you pick **DeepLX (self-hosted)**, a **DeepLX URL** field appears. Enter the address of your DeepLX server, for example:

```
http://localhost:1188
```

If your DeepLX server runs on your own machine or your local network, the address is a local address. Guksu blocks requests to local addresses by default for safety. To allow them, set this line in your `.env` file and save the file:

```
DEEPLX_LOCAL_URLS_ENABLED=true
```

The `.env` file is the server's settings file. The [Server Configuration Reference](../CONFIGURATION.md) explains where to find it. You do not need to restart the server. It picks up the change within a few seconds.

A DeepLX server at a public internet address does not need this setting. Only local and private network addresses are blocked by default.

### AI translation setup

When you pick **AI (via connection)**, Guksu uses one of your AI providers to translate. Two extra fields appear.

The **Connection** dropdown lets you choose which AI connection does the translating. This field is required. If you leave it unset, translation fails with the message "Connection ID is required for AI translation". A connection is a saved link to an AI provider. See the connections guide below to set one up.

The **AI Prompt** field is the instruction sent to the AI for translation. It is filled with a built-in default. You can edit it for this chat. Once you change it, a **Restore** button appears that resets the field to the built-in default. The default prompt is:

```
You are a translator. Translate the given text accurately, preserving formatting, markdown, and any special characters like *asterisks* for actions. Output ONLY the translated text, nothing else -- no explanations, no extra commentary.
```

## The automatic translation toggles

Below the provider settings are three toggles. All three are off by default.

**Auto-Translate Responses** translates every AI response automatically, right after it is generated. In Game mode, Guksu removes game-master-only tags from the narration before translating it.

**Translate My Messages** translates your own message into the target language just before it is sent to the AI. The translation replaces your typed text. If the translation fails, Guksu sends your original text instead and shows an error message.

**Show Draft Translate Button** adds a **Translate draft** button next to the **Send** button. This lets you translate your message and review or edit the result before you send it. This is the manual alternative to **Translate My Messages**, which translates on send with no chance to review.

## The per-message Translate button

Every chat message, whether from you or the AI, has a **Translate** button in its hover action bar. The button uses a languages icon. This button works on its own and does not need any of the toggles above.

1. Move your pointer over a message to show its action bar.
2. Click the **Translate** button.
3. The translation appears below the message.
4. Click the same button again to hide the translation. Its hover text now reads **Hide translation**.

A translation made this way is saved with the message. It survives a page refresh and stays when you switch chats and come back.

The per-message button uses the same provider and target language you set in the **Translation** section.

## Provider limits

Keep these limits in mind when you choose a provider.

- **Google Translate** rejects text longer than 5000 characters. You see the error "Text too long for Google Translate (max 5000 characters). Use DeepL or AI provider for longer texts." Switch to DeepL or AI for longer text.
- **DeepL API**, **DeepLX (self-hosted)**, and **AI (via connection)** accept longer text, up to a server limit of 50000 characters per request.
- **Google Translate**, **DeepL API**, and **DeepLX (self-hosted)** each stop and show an error if they take longer than 15 seconds.
- **AI (via connection)** uses your connection's own model and timeout behavior, not the 15 second limit.
- **DeepLX (self-hosted)** to a local address is blocked unless you set `DEEPLX_LOCAL_URLS_ENABLED=true` as described above.

## Related guides

- [Message Actions: Edit, Delete, Swipe, Regenerate](../chats/messages.md)
- [Chat Settings Overview](../chats/chat-settings.md)
- [Connecting to an AI Provider](../connections/connecting-to-a-provider.md)
- [Server Configuration Reference](../CONFIGURATION.md)
