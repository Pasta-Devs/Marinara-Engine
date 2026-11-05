# Image Generation Providers and Setup

Image generation powers scene illustrations, selfies, scene backgrounds, and generated avatars, portraits and sprites. This guide shows how to add an image service and what each service needs. Once one image model works, every image feature in the app can use it.

## Add an image service

An API key is a secret code a service gives you so Marinara can use your account. Marinara fills in each service's web address for you, so you rarely type one.

1. Click **Connections** in the top bar, then **Add**. The **Add account** window opens.
2. Find the service. The list has an **Images & video** section, and **Search providers** helps you find one.
3. Paste your key into the **API key** field. Free and local services need none. For a server you run yourself, fill in the address field.
4. Click **Connect**. Marinara tests the account.
5. Pick an image model from the list, or type a model ID. This is your image model. It appears under the account in the **Connections** panel.
6. Open the image model and click **Test image**. Marinara makes a small test picture.
7. To make it the model the app uses for pictures, set the **Images** job under **Defaults** at the top of the **Connections** panel.

To add another image model to an account, open its **⋯** menu and click **Add image model**. See [Connecting to an AI Provider](../connections/connecting-to-a-provider.md) for the full window.

If it did not work: **Test image** fails when the key or address is wrong. Check both first. **Test provider** only checks that Marinara can reach the service. **Test image** makes a real picture and can use credit.

## Get a picture in a chat

Once an image model is set as the **Images** job, ask for a picture in a chat.

1. Add the Illustrator agent to a Roleplay chat. See [Illustrator Agent](illustrator-agent.md).
2. Open **Chat Settings**, expand **Gallery** and click **Illustrate**.
3. Wait for **Generating...** to finish. The picture appears in the Gallery.

In a Roleplay chat you can also use the `/illustrate` command. See [Slash Commands](../chats/slash-commands.md).

## Choosing a service

Marinara fills in each service's address for you. Cloud services need an account, and most need an API key. Free services need no key. Local services run image software on your own computer.

**Easiest start:** choose **Pollinations**. It is free and needs no account or key. Pick a stronger service later if you want better pictures.

| Service | API key | Where it runs |
| --- | --- | --- |
| OpenAI (DALL-E) | Yes | Cloud |
| ChatGPT (Codex login) | No, uses `codex login` | Cloud |
| Stability AI | Yes | Cloud |
| Together AI | Yes | Cloud |
| Arli AI | Yes | Cloud |
| NovelAI | Yes | Cloud |
| OpenRouter Images | Yes | Cloud |
| xAI / Grok Imagine | Yes | Cloud |
| Venice.ai | Yes | Cloud |
| Z.AI | Yes | Cloud |
| Atlas Cloud | Yes | Cloud |
| fal.ai | Yes | Cloud |
| SpicyAPI | Yes | Cloud |
| NanoGPT | Yes | Cloud |
| Block Entropy | Yes | Cloud |
| RunPod Serverless (ComfyUI) | Yes | Cloud |
| Pollinations | No | Free cloud |
| Stable Horde | Optional | Free cloud |
| SD Web UI (AUTOMATIC1111 / Forge) | No | Local |
| ComfyUI | No | Local |
| SwarmUI | Optional | Local |
| Draw Things | No | Local |

Notes for the simple services:

- **OpenAI (DALL-E)**: offers DALL-E and GPT Image models. Only GPT Image 2.6 makes looping GIFs. See [GPT Image 2.6](#gpt-image-26).
- **Stability AI**: Stable Diffusion and Stable Image models.
- **Together AI**: FLUX and other open image models.
- **OpenRouter Images**: reaches image models through OpenRouter's chat interface, so the models vary by account.
- **xAI / Grok Imagine**: uses Grok Imagine.
- **NanoGPT**: an aggregator, so use its model list.
- **Pollinations**: the fastest way to try image generation. No account needed.
- **Stable Horde**: a crowdsourced network. A free key gives higher queue priority.
- **SD Web UI** and **Draw Things**: start the software with its application interface turned on. Marinara treats Draw Things like an AUTOMATIC1111 server (the app runs on macOS or iOS).
- **Block Entropy**: Marinara has no dedicated handler, so it sends OpenAI-compatible requests. Compatibility is not confirmed. Test with **Test image** before you rely on it.

## Services with special setup

### GPT Image 2.6

GPT Image 2.6 runs on an **OpenAI (DALL-E)** account. **GPT Image 2.6 Flare** is the faster model. **GPT Image 2.6 Sunburst** gives higher quality and stays steadier across edits. Both take the same sizes and transparent backgrounds as GPT Image 2.5, and **Image quality** goes up to **Max**.

The model plans each picture before it draws. To make it plan less, add `{"complexity": "low"}` or `{"complexity": "medium"}` to the image model's **Custom Parameters**. The default is `high`. Higher complexity can take longer and can change more than you asked for in an edit.

GPT Image 2.6 can also make a short looping GIF. Marinara asks for one only where a feature or a downloaded agent offers GIFs:

| Limit | Value |
| --- | --- |
| Account | **OpenAI (DALL-E)** with an API key |
| Models | GPT Image 2.6 Flare or Sunburst |
| Frames | 2 to 12, 9 by default |
| Frame length | 20 to 2000 ms, 200 ms by default |
| Frame size | About 0.66 MP: 816x816 square, 608x1088 portrait |
| Pictures sent | None. A GIF is drawn from the prompt alone |
| Transparent background | No |

OpenAI allows more frames but does not publish how many pixels one GIF may have, so Marinara keeps to 12 small frames. **ChatGPT (Codex login)**, **OpenRouter Images**, **NanoGPT**, ToAPIs and other services can't make GIFs. Marinara refuses those requests before it sends anything, so you pay nothing. An **OpenAI-compatible** account is tried like OpenAI.

A failed GIF is never replaced by a still picture. If the service answers with a still, the request fails. The **Images** job's **If it fails** model is tried only when it can make GIFs.

> **Warning:** OpenAI does not publish the price of a GIF. Expect one GIF to cost several pictures, and a still that comes back instead is charged too.

### ChatGPT (Codex login)

This service uses your ChatGPT plan instead of an API key, so images need no OpenAI API credit.

1. On the computer that runs Marinara, install the Codex CLI and run `codex login` once. It is the same sign-in the ChatGPT chat account uses. See [Claude, ChatGPT, and Grok Subscription Connections](../connections/subscription-clis.md#openai-chatgpt).
2. Choose the service. There is no key or address to fill in. Marinara fills in the model `gpt-image-2`, the one Codex uses for images.

**Test provider** only checks that Marinara can read your Codex login. **Test image** makes a real image and counts against your ChatGPT image limits. This service can't make GIFs, even with a GPT Image 2.6 model ID. With reference images, Marinara sends an edit request with up to 16 of them. ChatGPT may return a different pixel size, so Marinara also states the wanted aspect ratio in the prompt. This service uses the ChatGPT image endpoint that Codex uses, not the public OpenAI API, so OpenAI can change it without notice.

### Arli AI

It runs hosted Stable Diffusion models. A model is required, so type the name of the Arli AI image model you want. It uses the same **Local Image Defaults** fields as SD Web UI (see [Local Image Defaults](#local-image-defaults-per-connection)). The first reference image is used as a starting picture. This service is for images only. For Arli AI chat models, see [Supported AI Providers](../connections/providers-reference.md#arli-ai).

### NovelAI

NovelAI focuses on anime-style art. On V4, V4.5 and V5 models, Marinara sends native per-character prompts with positions for multi-character storyboards and Illustrator scenes. Precise reference images work only on a V4.5 model.

### Venice.ai

Marinara uses Venice's native image endpoint, turns off Venice's optional safe-mode blur and maps requested sizes to each model's size format. Venice's own policy or model limits can still reject a request.

### Z.AI

Use a general Z.AI API key. GLM Coding Plan keys and the `/api/coding/paas/v4` address do not work for images. Choose **GLM-Image** or **CogView 4**. Marinara maps the aspect ratio to a size the model supports and downloads the temporary result into local storage. It is text-to-image only and sends no reference images.

### Atlas Cloud

Marinara loads Atlas Cloud's current text-to-image and image-to-image catalog. If it cannot, it shows a starter list (Nano Banana, Gemini Flash Image, FLUX 1.1 Pro). You can always type an exact model ID. Jobs run asynchronously, so Marinara starts the job and polls until the image is ready. Reference images are sent for model IDs that advertise image-to-image, edit or Kontext behavior. Atlas model schemas differ, so check the model's Atlas Cloud documentation for other IDs.

### fal.ai

Create an API key at [fal.ai](https://fal.ai/dashboard/keys). The starter list has `fal-ai/flux/schnell` and `fal-ai/flux/dev`. You can type another text-to-image endpoint ID with a compatible input and output. **Test provider** checks the setup only. **Test image** sends a real request and uses fal.ai credit.

Marinara sends the prompt and sizes and downloads the first returned image. Negative prompts are added as text. Use **Custom Parameters** for model options such as `seed`, `num_inference_steps` or `image_size`. It uses synchronous text-to-image requests, sends no reference images and does not resume interrupted jobs. See the model's [API reference](https://fal.ai/models/fal-ai/flux/schnell/api).

### SpicyAPI

Create a key in the [SpicyAPI console](https://spicyapi.ai/console/keys) and choose **SpicyAPI**. Marinara fills in the model `alibaba/z-image-spicy-pro/text-to-image`. You can type another ID, such as `bytedance/seedream-5.0-pro/text-to-image`. **Test provider** reads the model list, so it costs nothing. **Test image** makes a real image and uses your balance.

Choose the **SpicyAPI** service. Do not use **OpenAI (DALL-E)** or an OpenAI-compatible account with a SpicyAPI address. SpicyAPI's OpenAI-style address handles text only.

Each model takes its own settings. Marinara asks SpicyAPI which ones the model accepts and sends only those, using the closest shape it offers (aspect ratio, width and height, or a fixed size). A model with no negative prompt field gets the negative prompt added to the end of the prompt. Use **Custom Parameters** for other options such as `seed`, `resolution` or `loras`.

Each image is a task. Marinara waits, checks back after about a minute, then downloads the result. If the connection drops, it picks up the same task instead of paying for a new one. Edit models (IDs ending in `/edit`) receive your reference images. SpicyAPI takes up to 1 MB per image and 2 MB per request, so Marinara shrinks larger images and leaves out extras that do not fit.

### SwarmUI

SwarmUI can spread ComfyUI work across its own queue. A local server without accounts needs no key. If your server requires an account, paste a Swarm Auth Token into **API key**. The model list shows models on your SwarmUI server.

The **ComfyUI workflow (optional)** field can stay empty. Leave it empty to use SwarmUI's own image settings, or paste a workflow (see below). Turn on **Save images in SwarmUI** in **Local Image Defaults** to also keep each image in SwarmUI's output folder. Marinara keeps its own copy either way.

### Local services on your network

`localhost` means the computer that runs Marinara. Local image servers on that computer work with no extra setup. If the server runs on another computer on your network, allow local network addresses in the server configuration. See the [Server Configuration Reference](../CONFIGURATION.md).

When a service returns a URL instead of image data, Marinara downloads public CDN URLs through its normal outbound-request checks. A private or loopback result URL is accepted only when its scheme, hostname and port exactly match the configured image service. Redirects from that origin cannot jump to another local service. If a local proxy stores results on a different private origin, make it serve those files through the same origin as its image API.

## ComfyUI workflow JSON and RunPod

For **ComfyUI**, **SwarmUI** and **RunPod Serverless (ComfyUI)** a **ComfyUI workflow (optional)** or **(required)** field appears. Paste a workflow JSON you exported from ComfyUI with **Save (API Format)**, **Export (API)** or **Export to API**, depending on your ComfyUI version. It is optional for ComfyUI and SwarmUI and required for RunPod, which needs your RunPod API token as the API key, a **RunPod endpoint ID** and the workflow.

Put these text markers in the workflow where Marinara should fill in a value:

- `%prompt%` and `%negative_prompt%` for the prompts.
- `%width%`, `%height%` and `%seed%` for size and seed.
- `%model%`, `%steps%`, `%cfg%`, `%sampler%`, `%scheduler%` and `%denoise%` for generation settings.
- `%reference_image%` and `%reference_image_01%` to `%reference_image_04%` for reference image data.
- `%reference_image_name%` and `%reference_image_name_01%` to `%reference_image_name_04%` to upload reference images and fill in their filenames for a local ComfyUI LoadImage node.

`%prompt%` matters most. The editor warns you when it is missing. For ComfyUI, an empty field uses a built-in default workflow. For SwarmUI it uses SwarmUI's own settings. RunPod has no default, so the workflow is required. All three accept up to 4 raw base64 reference images. Filename-upload placeholders work only for local ComfyUI.

See [ComfyUI Workflow Setup](comfyui.md) for the full export steps, examples, quoting rules, reference images, character-specific workflows, network access and troubleshooting.

## Local Image Defaults per connection

A **Local image defaults** panel appears on an image model for **SD Web UI (AUTOMATIC1111 / Forge)**, **ComfyUI**, **NovelAI**, **Draw Things**, **Arli AI**, **SwarmUI** and **RunPod Serverless (ComfyUI)**. Draw Things and Arli AI show the SD Web UI fields. SwarmUI and RunPod show the ComfyUI fields. These apply only when this model makes an image. **Reset** restores the built-in values.

Every service has a **Seed** field. -1 keeps each image random. Any other number reuses that seed every time. The other fields depend on the service.

| Service | Field | Default |
| --- | --- | --- |
| AUTOMATIC1111 / Forge | Steps | 20 |
| AUTOMATIC1111 / Forge | CFG scale | 7 |
| AUTOMATIC1111 / Forge | Sampler | Euler a |
| AUTOMATIC1111 / Forge | Img2img denoise | 0.6 |
| ComfyUI | Steps | 20 |
| ComfyUI | CFG scale | 7 |
| ComfyUI | Sampler | euler_ancestral |
| ComfyUI | Scheduler | normal |
| ComfyUI | Denoise | 1 |
| NovelAI | Steps | 28 |
| NovelAI | Prompt guidance | 6 |
| NovelAI | Sampler | k_euler_ancestral |
| NovelAI | Noise schedule | karras |

Each service also has **Prompt prefix** and **Negative prefix** fields. Text there is added to the front of every prompt on this model. AUTOMATIC1111 / Forge and ComfyUI have a **Clip skip** field. AUTOMATIC1111 / Forge adds a **Restore faces** toggle. ComfyUI adds a toggle to upload a 1x1 placeholder when no reference image is given, which matters only for custom workflows with reference placeholders. NovelAI adds **Guidance rescale** and **UC preset**.

## Reference image support varies by service

A reference image is an existing picture you send with your prompt, so the new image keeps a character's face or an art style.

| Service | Reference images |
| --- | --- |
| OpenAI (DALL-E) | Up to 16, GPT Image models only. None for a GIF |
| ChatGPT (Codex login) | Up to 16 |
| NovelAI | Up to 16, V4.5 model only |
| xAI / Grok Imagine | Up to 3 |
| NanoGPT | Up to 3 |
| ComfyUI, RunPod Serverless (ComfyUI), SwarmUI | Up to 4, through workflow placeholders |
| Stability AI, Arli AI, SD Web UI, Draw Things | First image only, as image to image |
| Atlas Cloud | First image, for compatible image-to-image, edit or Kontext model IDs |
| SpicyAPI | Edit models only, up to the model's limit, shrunk to fit |
| OpenRouter Images | Supported, no fixed limit |
| Venice.ai, Z.AI | Not supported for text-to-image |
| Together AI, Pollinations, Stable Horde, fal.ai | Not supported |

NovelAI precise reference works only on a V4.5 model such as `nai-diffusion-4-5-full`. NovelAI has not released Precise Reference for V5. If you ask for references on another model, Marinara renders without them and logs a warning on the server.

## Queue media generation requests

The **Queue media generation requests** toggle is in **Settings → Generations → Overall Generations**. It is on by default.

When on, Marinara sends image jobs to each image account one at a time, and video jobs to each video account one at a time, in separate queues. An image and a video for the same account can run together. It applies to every feature that asks for them: the Illustrator, trackers, commands, the Gallery, Game assets and downloaded agents such as Slurp. Two models with the same address and API key share a queue. Different accounts still run at the same time. NovelAI also gets a short pause between jobs, and when it answers that it is busy, Marinara waits and tries twice more.

Keep it on for services that reject two requests at once. Turn it off only if your service handles many at once and you want speed.

## Related guides

- [ComfyUI Workflow Setup](comfyui.md)
- [Illustrator Agent](illustrator-agent.md)
- [Image Style Profiles](style-profiles.md)
- [Scene Backgrounds and the Gallery](scene-backgrounds.md)
- [Selfies](../conversation/selfies.md)
- [Supported AI Providers](../connections/providers-reference.md)
