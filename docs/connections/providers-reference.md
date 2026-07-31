# Supported AI Providers

This guide lists every AI provider Marinara Engine can connect to. For each one it tells you where to get an API key, the default base URL, and any quirks to know. An API key is a secret password from a provider that lets Marinara talk to their AI service.

To learn the general steps for adding a connection, read [Connecting to an AI Provider](connecting-to-a-provider.md) first. This page is a reference you can search when you want details on one specific provider.

## How to read this page

You choose a provider when you create a connection in the **Connections** panel. Each provider has a **Provider** button in the **Create Connection** modal, labelled with the exact name shown below.

Most providers on this page are cloud services that host the AI for you. You make an account with the provider, copy an API key, and paste it into the **API Key** field. Three subscription providers use a local sign-in instead of a key. Their sections say so.

You will see two terms often:

- Base URL: the web address Marinara sends requests to. Most providers fill this in for you. You only change it for local or custom servers.
- Model: the specific AI model you pick after choosing a provider. Available models change often, so this page does not list them. Use the **Model** dropdown or the **Fetch Models from API** button in the connection editor to see the current list.

## OpenAI

- Where to get a key: `https://platform.openai.com/api-keys`
- Default base URL: `https://api.openai.com/v1`

**OpenAI** runs the GPT model family. After you paste your key, pick a model from the dropdown or click **Fetch Models from API** to load the current list. This connection is for chat models only. For DALL-E images, use the **Image Generation** provider and its **OpenAI (DALL-E)** service instead.

## Anthropic

- Where to get a key: `https://console.anthropic.com/settings/keys`
- Default base URL: `https://api.anthropic.com/v1`

**Anthropic** runs the Claude models. It supports prompt caching, which can lower the cost of long chats. You can turn this on with the **Enable prompt caching** toggle in the connection editor.

**Anthropic** does not offer embeddings. Embeddings turn text into number lists so Marinara can search lorebooks and memory. For those features, use a separate embedding connection (see the Embeddings section below).

## Google Gemini

- Where to get a key: `https://aistudio.google.com/apikey`
- Default base URL: `https://generativelanguage.googleapis.com/v1beta`

**Google Gemini** runs the Gemini models through Google AI Studio. This is the simpler of the two Google options.

## Google Vertex AI

- Credential docs: `https://cloud.google.com/vertex-ai/docs/authentication`
- Default base URL: `https://us-central1-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/us-central1`

**Google Vertex AI** runs Gemini models through a Google Cloud project. It needs more setup than **Google Gemini**. You must edit the **Base URL** and replace `YOUR_PROJECT_ID` with your real project ID. Also change the region if it is not `us-central1`.

The **API Key** field accepts any one of these three credential types, and Marinara detects which one you pasted:

1. A service-account JSON key.
2. An OAuth access token, for example from `gcloud auth print-access-token`.
3. A Vertex API key.

## Mistral

- Where to get a key: `https://console.mistral.ai/api-keys`
- Default base URL: `https://api.mistral.ai/v1`

**Mistral** runs the Mistral model family. No special setup is needed beyond the API key.

## Cohere

- Where to get a key: `https://dashboard.cohere.com/api-keys`
- Default base URL: `https://api.cohere.ai/compatibility/v1`

**Cohere** uses its OpenAI-compatible endpoint by default. If you paste an older Cohere v2 URL, Marinara switches it to the compatibility endpoint for you. Requests still work.

## OpenRouter

- Where to get a key: `https://openrouter.ai/keys`
- Default base URL: `https://openrouter.ai/api/v1`

**OpenRouter** is an aggregator. One key gives you access to many models from many companies. It adds two extra options in the connection editor:

- **Preferred Provider**: a text field that forces **OpenRouter** to route to one named backend. The name must match the one shown on the OpenRouter models page. Leave it empty for automatic routing.
- **Enable prompt caching**: sends caching hints for Claude models routed through **OpenRouter**. Most other models on **OpenRouter** cache on their own and do not need this.

## NanoGPT

- Where to get a key: `https://nano-gpt.com/api`
- Default base URL: `https://nano-gpt.com/api/v1`

**NanoGPT** is also an aggregator. It has no built-in model list, so the **Model** dropdown starts empty. After you paste your key, click **Fetch Models from API** to load the models your account can use.

## xAI / Grok

- Where to get a key: `https://console.x.ai`
- Default base URL: `https://api.x.ai/v1`

**xAI / Grok** runs the Grok models. When you pick this provider in the **Create Connection** modal, Marinara prefills the model with Grok 4.5. You can change the model afterward.

## Claude (Subscription)

- API key: none. You sign in to a local tool instead.

**Claude (Subscription)** uses your Anthropic Pro or Max plan through the Claude Code tool. The tool runs on the computer that hosts the Marinara server, and you sign in once. The **API Key** and **Base URL** fields are hidden for this provider. It does not offer embeddings (see the Embeddings section below).

Install and login steps are in [Claude, ChatGPT, and Grok Subscription Connections](subscription-clis.md).

## OpenAI (ChatGPT)

- API key: none. You sign in to a local tool instead.

**OpenAI (ChatGPT)** uses your ChatGPT account through the Codex tool. The tool runs on the computer that hosts the Marinara server, and you sign in once. The **API Key** and **Base URL** fields are hidden for this provider. It does not offer embeddings (see the Embeddings section below).

Install and login steps are in [Claude, ChatGPT, and Grok Subscription Connections](subscription-clis.md).

## Grok CLI (Subscription)

- API key: none. You sign in to a local tool instead.

**Grok CLI (Subscription)** uses your SuperGrok or X Premium+ account through the Grok CLI tool. The tool runs on the computer that hosts the Marinara server, and you sign in once. The **API Key** and **Base URL** fields are hidden for this provider. It does not offer embeddings (see the Embeddings section below).

Install and login steps are in [Claude, ChatGPT, and Grok Subscription Connections](subscription-clis.md).

## Custom (OAI-Compatible)

- Default base URL: none. You must enter one.

Pick **Custom (OAI-Compatible)** to connect a local or self-hosted model server, such as Ollama, LM Studio, or KoboldCpp. It also works for any hosted proxy that speaks the OpenAI chat format. The **API Key** can be left empty for most local servers. You set the **Base URL** to your server address.

For step-by-step setup and the **Treat as local/custom endpoint** toggle, read [Connecting a Local or Self-Hosted Model](local-self-hosted.md). For the small model that ships inside Marinara, read [Local Model Setup](local-model.md).

## Image Generation

**Image Generation** is a special provider. After you pick it, you also pick a **Service**, which is the image backend that does the work. Each service has its own default base URL and its own rule about whether an API key is required. Services include paid cloud APIs like **OpenAI (DALL-E)**, **Stability AI**, **NovelAI**, and **Z.AI**. They also include free options like **Pollinations** and **Stable Horde**. Local servers like **ComfyUI** and **SD Web UI (AUTOMATIC1111 / Forge)** work too.

The full list of image services, their setup, and generation settings lives in [Image Generation Providers and Setup](../media/image-providers.md).

## Video Generation

**Video Generation** is also a special provider with its own **Video Service** picker. Game Mode uses it to make short MP4 scene videos. The services are **Google AI Studio**, **xAI Imagine**, **OpenRouter Video**, and **Seedance 2.0**. Each service needs an API key.

The full setup and limits for each video service live in [Scene Video Generation](../media/scene-video.md).

## Embeddings

Embeddings power lorebook semantic search and Memory Recall. They turn text into number lists so Marinara can find related entries. Most chat providers let you set an **Embedding Model** and an optional **Embedding Endpoint URL** in the connection editor.

Some providers cannot make embeddings. **Anthropic**, **Claude (Subscription)**, **OpenAI (ChatGPT)**, and **Grok CLI (Subscription)** do not offer them. For those, use the **Embedding Connection** dropdown to borrow another connection, such as an OpenAI-compatible one, **Google Gemini**, or the built-in **Local Model**.

## Related guides

- [Connecting to an AI Provider](connecting-to-a-provider.md)
- [Claude, ChatGPT, and Grok Subscription Connections](subscription-clis.md)
- [Connecting a Local or Self-Hosted Model](local-self-hosted.md)
- [Image Generation Providers and Setup](../media/image-providers.md)
- [Scene Video Generation](../media/scene-video.md)
