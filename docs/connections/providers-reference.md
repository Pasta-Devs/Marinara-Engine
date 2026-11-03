# Supported AI Providers

This page is a reference for every service Marinara Engine can connect to: where to get its API key, its default address, and its quirks. To add an account step by step, read [Connecting to an AI Provider](connecting-to-a-provider.md) first.

You choose a service in the **Add account** window, under the section for what it does: **Chat**, **Decisions**, **Images & video**, or **Voice**. The tile uses the name shown below. The address is the web address Marinara sends requests to. It is called **Address** in the account editor and **Base URL** in the model editor. Marinara fills it in for known services. Change it only for a proxy or a server you run.

Models change often, so this page does not list them. After you connect, the model list loads in the picker. Click **Refresh model list** in the picker to reload it.

## Chat services

These services use an API key, except the three subscription services, which use a sign-in on your computer.

| Service | Where to get a key | Default address |
| --- | --- | --- |
| OpenAI | `https://platform.openai.com/api-keys` | `https://api.openai.com/v1` |
| Anthropic | `https://console.anthropic.com/settings/keys` | `https://api.anthropic.com/v1` |
| Google Gemini | `https://aistudio.google.com/apikey` | `https://generativelanguage.googleapis.com/v1beta` |
| Google Vertex AI | `https://cloud.google.com/vertex-ai/docs/authentication` (credential guide) | `https://us-central1-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/us-central1` |
| Mistral | `https://console.mistral.ai/api-keys` | `https://api.mistral.ai/v1` |
| Cohere | `https://dashboard.cohere.com/api-keys` | `https://api.cohere.ai/compatibility/v1` |
| OpenRouter | `https://openrouter.ai/keys` | `https://openrouter.ai/api/v1` |
| NanoGPT | `https://nano-gpt.com/api` | `https://nano-gpt.com/api/v1` |
| xAI / Grok | `https://console.x.ai` | `https://api.x.ai/v1` |
| Arli AI | `https://www.arliai.com/account` | `https://api.arliai.com/v1` |
| Z.AI | `https://z.ai/manage-apikey/apikey-list` | `https://api.z.ai/api/paas/v4` |
| DeepSeek | `https://platform.deepseek.com/api_keys` | `https://api.deepseek.com/v1` |
| OpenAI-compatible | None. Your server or proxy sets it. | None. You enter one. |
| Claude (Subscription) | None. Sign in with Claude Code. | None |
| OpenAI (ChatGPT) | None. Sign in with the Codex CLI. | None |
| Grok CLI (Subscription) | None. Sign in with the Grok CLI. | None |

The three subscription services hide the **API key** and address fields. They do not offer embeddings. Install and sign-in steps are in [Claude, ChatGPT, and Grok Subscription Connections](subscription-clis.md), which also covers plan usage.

An aggregator is a service where one key reaches models from many companies. OpenRouter and NanoGPT are aggregators. A gateway is the same idea for a proxy you run or rent.

## Service notes

### OpenAI

**OpenAI** runs the GPT models and is for chat only. For DALL-E images, use the **Images & video** section and its **OpenAI (DALL-E)** service instead.

### Anthropic

**Anthropic** runs the Claude models. Prompt caching lets the service reuse the start of your prompt, which can lower the cost of long chats. Turn it on with **Enable prompt caching** in the model editor. **Anthropic** does not offer embeddings (see [Embeddings](#embeddings)).

### Google Gemini and Google Vertex AI

**Google Gemini** runs the Gemini models through Google AI Studio. It is the simpler Google option. On both Google options, Marinara turns off Google's adjustable safety filters, except for any category you set yourself in **Custom Parameters**. Google's core protections, such as child safety, still apply.

**Google Vertex AI** runs Gemini through a Google Cloud project and needs more setup. Edit the address and replace `YOUR_PROJECT_ID` with your project ID. Change the region if it is not `us-central1`. The **API key** field accepts any one of these, and Marinara detects which you pasted:

1. A service-account JSON key (a file Google Cloud gives you that names a service account).
2. An OAuth access token, for example from `gcloud auth print-access-token`.
3. A Vertex API key.

**Gemini 4 Argon** runs only in the `global`, `us`, and `eu` locations, not in one region such as `us-central1`. This comes from Google's documentation. To use it, set the address to `https://aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/global`. With another location, Google returns an error and Marinara shows it.

Argon can take several minutes to answer on either Google option. If chat replies time out, raise `CHAT_GENERATION_TIMEOUT_MS`. If agent calls time out, raise `AGENT_CALL_TIMEOUT_MS`. Google suggests allowing at least 15 minutes, which is `900000`. See [Configuration](../CONFIGURATION.md).

### Cohere

**Cohere** uses its OpenAI-compatible endpoint. If you paste an older Cohere v2 address, Marinara switches it to the compatibility endpoint for you.

### OpenRouter

**OpenRouter** is an aggregator with two extra options in the model editor:

- **Preferred provider** forces routing to one named backend. The name must match the one on the OpenRouter models page. Leave it empty for automatic routing.
- **Enable prompt caching** sends caching hints for Claude models routed through OpenRouter. Most other models cache on their own.

### NanoGPT

**NanoGPT** is an aggregator with no built-in model list. After you connect, the picker loads the models your account can use. It reads NanoGPT's detailed catalog and marks which models your subscription covers:

| Pill | Meaning |
| --- | --- |
| `1x` in green | Included in your subscription, at the normal rate. |
| A higher value such as `2x` | Included, but each input token costs that many tokens of your quota. |
| **Paid** | Not included. Usage bills to your paid balance. |
| No pill | NanoGPT had no subscription data for it. |

#### Subscription usage

With a NanoGPT subscription, the account can show your live quota.

1. Click **⋯** on the account's row, choose **Edit account**, and open **Usage and balance**.
2. If outside reads are off, click **Turn on**. To add a management key, click **Add a usage-only key**, paste it, and click **Show usage**.
3. Turn on **Show the usage meter on the card** and save.

The meter shows your weekly and daily input-token quotas, with what is left and when each resets, for example `42M remaining · resets in 4d`. A quota NanoGPT cannot report shows as unknown, not as unused. An inactive subscription is called out instead of drawn as full. The refresh button reads it again.

Two credentials can read the usage:

- **Management key** (recommended). Create one at `https://nano-gpt.com/settings#management-api-tokens` with the **Usage only** scope. It reads quotas but cannot run models or spend your balance. Marinara stores it encrypted and sends it only to NanoGPT's management endpoint.
- **Your API key**, used when no management key is saved. It works, but the quota read then uses a key that can spend your balance.

The same meter shows under the context bar in a chat's connection picker and in the chat's **Connection** settings. It shows only when the chat's model is a NanoGPT one with the meter turned on, and not for **Shuffle**.

### xAI / Grok

**xAI / Grok** runs the Grok models. Grok 4.6 and 4.7 have a 500,000-token context window and reasoning up to **Extra high**. They support the chat tools, including **Web Search**, so search results can feed the finished reply.

### Arli AI

**Arli AI** is a hosted chat service with no built-in model list. After you connect, the picker loads its models. For Arli AI images, use the **Images & video** section and its **Arli AI** service instead.

### Z.AI

**Z.AI** serves the GLM models (GLM 5.3, GLM 5.3 Flash, and earlier) on its own API. GLM 5.3 models always reason. The **Reasoning Effort** in your preset maps onto the levels Z.AI accepts, **Low**, **High**, and **Maximum**. If you leave it unset, Z.AI's default, Maximum, applies. The default address is the pay-as-you-go endpoint. Z.AI's Coding Plan uses a different endpoint that its usage policy reserves for the tools on its list, so a Coding Plan key is not expected to work here.

### DeepSeek

**DeepSeek** serves `deepseek-flash` and `deepseek-v4-pro`. DeepSeek thinks by default. Its **Reasoning Effort** uses **Low**, **High**, and **Max**, and **Off** turns thinking off for that request. There is no **Medium**, because DeepSeek serves a medium request as High. The thinking shows in the reply with the usual thought display.

Some parameters do not apply, so the panel leaves them out: **Verbosity**, **Top K**, and the penalties are retired and ignored. **Temperature** and **Top P** are a pair, because DeepSeek uses one at a time. You see **Temperature** when thinking is off and **Top P** when it is on.

Connect DeepSeek with its own tile, not by pointing **OpenAI** at DeepSeek's address. The OpenAI service expects OpenAI's models, so it hides the generation controls for a DeepSeek model and sends almost none of your settings.

### OpenAI-compatible

**OpenAI-compatible** connects a server or proxy that accepts the OpenAI request format, such as Ollama, LM Studio, or KoboldCpp. In the **Add account** window it appears as **OpenAI-compatible address**. The key can stay empty for most local servers. You enter the address. See [Connecting a Local or Self-Hosted Model](local-self-hosted.md). For the small model Marinara runs by itself, see [Built-in Model Setup](local-model.md).

## Images and video

Under **Images & video**, you pick a service, and each has its own address and its own rule about whether a key is needed. Image services include paid APIs such as **OpenAI (DALL-E)**, **Stability AI**, **NovelAI**, and **Z.AI**, free ones such as **Pollinations** and **Stable Horde**, and local servers such as **ComfyUI** and **SD Web UI (AUTOMATIC1111 / Forge)**. See [Image Generation Providers and Setup](../media/image-providers.md).

Video services make short MP4 scene videos: **Google AI Studio**, **xAI Imagine**, **OpenRouter Video**, **NanoGPT**, **Atlas Cloud**, **Seedance 2.0**, **ComfyUI**, and **SwarmUI**. Cloud services need a key. **ComfyUI** and **SwarmUI** run on your computer and normally do not. See [Scene Video Generation](../media/scene-video.md).

## Decision

Under **Decisions**, **TypeSafe** (default address `https://api.typesafe.ai`) and **Own decision server** are the Decision services. Other chat services can also do decisions with their key. A decision model answers yes-or-no questions about your chat. See [Decision Models](decision-models.md).

## Audio

Under **Voice**, an audio service speaks character voices and narration. Pick an **Audio source**:

| Source | What it is |
| --- | --- |
| ElevenLabs | Character voices and narration. |
| OpenAI-compatible | OpenAI, or any server that copies OpenAI's speech format. |
| PocketTTS | A free voice server you run on your own computer. |
| xAI Voice | xAI's voice service. |

Each source fills in a default address and model. **Default voice** is the voice used when nothing more specific, such as a per-character voice, is set. **Request timeout (seconds)** is how long Marinara waits for one spoken line, 60 by default. Raise it for a slow voice server.

To choose the speech account Marinara uses by default, click the **Voice (Text to Speech)** row in the **Jobs** box. To read messages aloud with one, pick it as the **Source** in the **Text to Speech** card. See [Text to Speech (TTS) Setup](../media/tts-setup.md) and [Use an Audio connection](../media/tts-setup.md#use-an-audio-connection).

## Music & Sound Effects

This account type makes instrumental music and sound effects, separately from speech. Pick a service, enter its key and models, and turn on **Music generation**, **Sound-effect generation**, or both. In Game setup, **Music & Sound Effects account** picks which account a game uses, and its default choice is **Use the default Music & Sound Effects account**.

| Service | Default address | Setup |
| --- | --- | --- |
| ElevenLabs | `https://api.elevenlabs.io` | An ElevenLabs key. Music and sound effects have separate model fields. |
| SunoAPI | `https://apibox.erweima.ai` | A key from [sunoapi.org](https://sunoapi.org/), and a public HTTPS **SunoAPI music callback URL** when music is on. This is SunoAPI's own service, not a Suno subscription sign-in. |
| Custom compatible server | Your server's address | An explicit music or sound-effect endpoint path and a supported request format. See [compatible audio contracts](../media/tts-setup.md#game-music-and-sound-effects-on-a-compatible-audio-server). |

- SunoAPI needs the callback address even though Marinara checks for the finished track itself. You provide the address. Marinara does not create one.
- Music style prompts can have up to 1,000 characters. Sound-effect prompts can have up to 500.
- Each request can cost money with your provider. See the [music API](https://docs.sunoapi.org/suno-api/generate-music) and [sound-effects API](https://docs.sunoapi.org/suno-api/generate-sounds). SunoAPI sound effects have not been verified with a paid account.

On upgrade, each Audio account with generation turned on gains a separate Music & Sound Effects account. Older standalone ElevenLabs Game settings can create their own, so you may see more than one. Speech accounts and voice assignments stay unchanged, and saved Game account IDs do not change. Generation works only when the matching migrated account is available and has the music or sound-effect option on. Otherwise pick another suitable account. Removing a migrated account does not recreate it on restart. Endpoints restored from a profile stay unavailable until you review and save them locally.

Turn on generated audio per Game, or turn on **Sound effects** in Roleplay's command settings to use `[sound: description]`. Gacha Forge has its own generative-audio setting. Stock Game audio stays available when generation is off.

## Embeddings

Embeddings turn text into lists of numbers so Marinara can find related text. They power lorebook semantic search and Memory Recall. Most chat services let you set an embedding model and an optional **Embedding endpoint URL** under **Semantic search (embeddings)** in the model editor.

**Anthropic**, **Claude (Subscription)**, **OpenAI (ChatGPT)**, and **Grok CLI (Subscription)** cannot make embeddings. For those, use the **Embedding provider** dropdown to borrow another account, such as an OpenAI-compatible one, **Google Gemini**, or the **Built-in model**.

To use one embedding source for every account that has no embedding settings of its own, click the **Embeddings** row in the **Jobs** box. **Marinara's own search** keeps the built-in embedding model. An account's own embedding model or **Embedding provider** still wins. Vectorize your lorebooks and memories again after you change it. See [Semantic Search for Lorebooks](../lorebooks/semantic-search.md).

## Related guides

- [Connecting to an AI Provider](connecting-to-a-provider.md)
- [Claude, ChatGPT, and Grok Subscription Connections](subscription-clis.md)
- [Connecting a Local or Self-Hosted Model](local-self-hosted.md)
- [Image Generation Providers and Setup](../media/image-providers.md)
- [Scene Video Generation](../media/scene-video.md)
- [Decision Models](decision-models.md)
- [Text to Speech (TTS) Setup](../media/tts-setup.md)
