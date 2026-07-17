# Image Generation Providers and Setup

This guide explains how to connect an image generation service to Marinara Engine. It also covers what each of the 15 services needs. Image generation powers scene illustrations, selfies, scene backgrounds, and generated avatars, portraits, and sprites.

You set up image generation as a special kind of connection. Once one image connection works, every image feature in the app can use it.

## How to add an image generation connection

An **API key** is a secret password from a provider that lets Marinara use your account. A **Base URL** is the web address of the service's application interface. Marinara fills in the correct Base URL for you when you pick a service.

Follow these steps to add an image connection.

1. Open the **Connections** panel.
2. Click **New** to open the **Create Connection** modal.
3. Enter a name, then pick the **Image Generation** provider.
4. In the connection editor, choose a **Service** from the grid.
5. Paste your **API Key** if that service needs one. Free and local services do not.
6. Pick a **Model** from the list, or type a model ID. Some services offer **Fetch Models from API** to load the current list.
7. Click **Save**.
8. Click **Test Image** to confirm it works. Marinara generates a small test image.

If **Test Image** returns a picture, your connection is ready. If it fails, check the API key and Base URL.

## Choosing a service

The 15 services fall into three groups. Cloud services need an API key and an account. Free services need no key. Local services run image software on your own computer.

The table below shows each service at a glance. Details and quirks follow in the per-service sections.

| Service | API key | Where it runs |
| --- | --- | --- |
| OpenAI (DALL-E) | Yes | Cloud |
| Stability AI | Yes | Cloud |
| Together AI | Yes | Cloud |
| NovelAI | Yes | Cloud |
| OpenRouter Images | Yes | Cloud |
| xAI / Grok Imagine | Yes | Cloud |
| Venice.ai | Yes | Cloud |
| NanoGPT | Yes | Cloud |
| Block Entropy | Yes | Cloud |
| RunPod Serverless (ComfyUI) | Yes | Cloud |
| Pollinations | No | Free cloud |
| Stable Horde | Optional | Free cloud |
| SD Web UI (AUTOMATIC1111 / Forge) | No | Local |
| ComfyUI | No | Local |
| Draw Things | No | Local |

## OpenAI (DALL-E)

Cloud service with the default Base URL `https://api.openai.com/v1`. It needs an API key from your OpenAI account. It offers DALL-E and GPT Image models. It accepts up to 16 reference images.

## Stability AI

Cloud service with the default Base URL `https://api.stability.ai/v2beta`. It needs a Stability AI API key. It offers Stable Diffusion and Stable Image models.

## Together AI

Cloud service with the default Base URL `https://api.together.xyz/v1`. It needs a Together AI API key. It offers FLUX and other open image models.

## NovelAI

Cloud service with the default Base URL `https://image.novelai.net`. It needs a NovelAI API key. It focuses on anime style art. Some newer features, like precise reference images, only work on a V4.5 model.

## OpenRouter Images

Cloud service with the default Base URL `https://openrouter.ai/api/v1`. It needs an OpenRouter API key. It reaches image models through OpenRouter's chat interface, so the exact models available vary by account.

## xAI / Grok Imagine

Cloud service with the default Base URL `https://api.x.ai/v1`. It needs an xAI API key. It uses Grok Imagine for image generation.

## Venice.ai

Cloud service with the default Base URL `https://api.venice.ai/api/v1`. It needs a Venice API key. Use **Fetch Models from API** to load the image models available to your account. Marinara uses Venice's native image endpoint and automatically maps requested dimensions to each model's pixel, aspect-ratio, or resolution-tier sizing format.

## NanoGPT

Cloud service with the default Base URL `https://nano-gpt.com/api/v1`. It needs a NanoGPT API key. NanoGPT is an aggregator, so use **Fetch Models from API** to load its model list.

## Block Entropy

Cloud service with the default Base URL `https://api.blockentropy.ai`. It needs an API key. Marinara has no dedicated handler for Block Entropy, so it sends requests in the OpenAI compatible format. Its real compatibility is not confirmed, so test it with **Test Image** before you rely on it.

## RunPod Serverless (ComfyUI)

Cloud service with the default Base URL `https://api.runpod.ai/v2`. It runs a ComfyUI workflow on a RunPod serverless endpoint. It needs three things: your RunPod API token as the **API Key**, a **RunPod Endpoint ID**, and a **ComfyUI Workflow** JSON. See the ComfyUI workflow section below.

## Pollinations

Free cloud service with the default Base URL `https://image.pollinations.ai`. It needs no account and no API key. It is the fastest way to try image generation.

## Stable Horde

Free cloud service with the default Base URL `https://stablehorde.net/api/v2`. It is a crowdsourced network. An API key is optional. A free key gives you higher queue priority.

## SD Web UI (AUTOMATIC1111 / Forge)

Local service with the default Base URL `http://localhost:7860`. It talks to a Stable Diffusion Web UI running on your own computer. You must start that software with its application interface enabled. No API key is needed.

## ComfyUI

Local service with the default Base URL `http://127.0.0.1:8188`. It talks to a ComfyUI server running on your own computer. It supports a custom workflow, described below. No API key is needed.

## Draw Things

Local service with the default Base URL `http://localhost:7860`. It talks to the Draw Things app on macOS or iOS. Marinara treats it like an AUTOMATIC1111 server. No API key is needed.

## Local services on your network

The word `localhost` (also called loopback) means the same computer that runs Marinara. Local image servers on that same computer work with no extra setup.

If your image server runs on a different computer on your home network, you must allow local network addresses in the server configuration. See the [Server Configuration Reference](../CONFIGURATION.md) for how to do that.

## ComfyUI workflow JSON and RunPod

For **ComfyUI** and **RunPod Serverless (ComfyUI)**, a **ComfyUI Workflow** field appears. Paste a workflow JSON that you exported from ComfyUI with **Save (API Format)**, **Export (API)**, or **Export to API**, depending on the frontend version. The field is labeled Optional for **ComfyUI** and Required for **RunPod Serverless (ComfyUI)**.

Marinara fills your workflow using placeholders. Put these text markers in your workflow where the value should go.

- `%prompt%` and `%negative_prompt%` for the prompts.
- `%width%`, `%height%`, and `%seed%` for the image size and seed.
- `%model%`, `%steps%`, `%cfg%`, `%sampler%`, `%scheduler%`, and `%denoise%` for generation settings.
- `%reference_image%` and `%reference_image_01%` through `%reference_image_04%` to inject reference image data.
- `%reference_image_name%` and `%reference_image_name_01%` through `%reference_image_name_04%` to upload reference images and inject their filenames for a local ComfyUI LoadImage node.

The `%prompt%` placeholder is the important one. The editor warns you if it is missing. For **ComfyUI**, leaving the field empty uses a built-in default workflow. For **RunPod Serverless (ComfyUI)**, the workflow is required because the endpoint has no default. Both accept up to 4 raw base64 reference images; filename-upload placeholders are available only for local ComfyUI.

See [ComfyUI Workflow Setup](comfyui.md) for the complete export process, JSON examples, placeholder quoting rules, reference-image setup, character-specific workflows, LAN access, and troubleshooting.

## Local Image Defaults per connection

When your service is **SD Web UI (AUTOMATIC1111 / Forge)**, **ComfyUI**, **NovelAI**, or **Draw Things**, a **Local Image Defaults** panel appears on the connection. For **Draw Things**, the panel shows the same fields and defaults as **SD Web UI (AUTOMATIC1111 / Forge)**. These settings only apply when this connection generates an image. A **Reset** button restores the built-in values.

Every one of these four services shows a **Seed** field. A value of -1 keeps each image random. Any other number reuses the exact same seed every time.

The other fields depend on the service.

| Service | Field | Default |
| --- | --- | --- |
| AUTOMATIC1111 / Forge | Steps | 20 |
| AUTOMATIC1111 / Forge | CFG Scale | 7 |
| AUTOMATIC1111 / Forge | Sampler | Euler a |
| AUTOMATIC1111 / Forge | Img2Img Denoise | 0.6 |
| ComfyUI | Steps | 20 |
| ComfyUI | CFG Scale | 7 |
| ComfyUI | Sampler | euler_ancestral |
| ComfyUI | Scheduler | normal |
| ComfyUI | Denoise | 1 |
| NovelAI | Steps | 28 |
| NovelAI | Prompt Guidance | 6 |
| NovelAI | Sampler | k_euler_ancestral |
| NovelAI | Noise Schedule | karras |

Each service also has **Prompt Prefix** and **Negative Prefix** text fields. Text you put there is added to the front of every prompt on this connection. Both AUTOMATIC1111 / Forge and ComfyUI have a **Clip Skip** field. AUTOMATIC1111 / Forge adds a **Restore faces** toggle. ComfyUI adds a toggle named **Upload a 1x1 placeholder when no reference image is provided**. It only matters for custom workflows with reference image placeholders. NovelAI adds **Guidance Rescale** and **UC Preset** fields.

## Reference image support varies by provider

A **reference image** is an existing picture you send along with your prompt. It helps the new image keep a character's face or an art style. Providers differ in how many they accept.

| Provider | Reference images |
| --- | --- |
| OpenAI (DALL-E) | Up to 16 |
| NovelAI | Up to 16, V4.5 model only |
| xAI / Grok Imagine | Up to 3 |
| Venice.ai | Not supported for text-to-image generation |
| NanoGPT | Up to 3 |
| Stability AI | First image only, used as image to image |
| OpenRouter Images | Supported, no fixed limit |
| ComfyUI and RunPod Serverless (ComfyUI) | Up to 4, through workflow placeholders |
| Together AI, Pollinations, Stable Horde | Not supported |

NovelAI precise reference images only work on a V4.5 model, such as `nai-diffusion-4-5-full`. If you request references on another model, generation fails with a clear message.

## Queue image generation requests

The **Queue image generation requests** toggle lives in **Settings**, then **Generations**, then **Image Generation**. It is on by default.

When it is on, Marinara sends image jobs one at a time. Keep it on for services that reject two requests at once. Turn it off only if your service handles many requests at the same time and you want them faster.

## Related guides

- [ComfyUI Workflow Setup](comfyui.md) explains custom local and RunPod workflow JSON step by step.
- [Illustrator Agent](illustrator-agent.md) sets up automatic scene illustrations.
- [Image Style Profiles](style-profiles.md) shapes the look of every generated image.
- [Scene Backgrounds and the Gallery](scene-backgrounds.md) covers generated scene backgrounds.
- [Selfies](../conversation/selfies.md) is the Conversation mode character selfie command.
- [Supported AI Providers](../connections/providers-reference.md) lists every chat, image, and video provider.
