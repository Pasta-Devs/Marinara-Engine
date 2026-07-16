# Local Model Setup

This guide explains the built-in **Local Model**, a small AI model that Marinara Engine downloads and runs on your own machine. It needs no API key and no online account. This guide covers setup, the **Runtime Settings**, and how the Local Model powers helpers like tracker agents, Game Mode scene effects, and offline call transcription.

## What the Local Model is

The **Local Model** is a compact language model (Gemma) that runs entirely on your computer. An API key is a secret code that lets Marinara talk to an online AI service. The Local Model needs no API key, because nothing leaves your machine.

The Local Model is deliberately small. It is meant for background helper work, not for your main chat or roleplay. Marinara uses it for these jobs:

- Tracker agents in Roleplay mode.
- Scene effects in Game Mode, such as backgrounds, music, and weather.
- Lorebook embeddings for semantic search.
- Microphone transcription in Conversation calls, through a separate speech model.

The setup window calls it the **Local AI Model**. The connection dropdowns call it **Local Model (sidecar)**. These are the same feature.

You should not use the Local Model for main chat, roleplay, Game Master narration, or Professor Mari edits. It is too small for good results there. Use a stronger connection for those. See [Connecting to an AI Provider](connecting-to-a-provider.md).

## Opening the Local Model card

The Local Model lives in the **Connections** panel.

1. Open the **Connections** panel.
2. Find the card titled **Local Model**.
3. Click the card, or click its gear button titled **Open local model settings**.

The gear button opens the full setup window titled **Local AI Model**. If no model is downloaded yet, the card also shows a **Download now** button and a **Choose model options** button. Both open the same setup window.

Inside the setup window you will see a warning box titled **Local Model is for helpers, not main roleplay**. This repeats that the model is for helper tasks only.

## Hardware and operating system support

The Local Model downloads a runtime (the program that runs the model) and a model file. Your computer needs enough free disk space and memory (RAM) for both.

Support depends on your operating system:

- **Windows (64-bit) and Linux (64-bit)**: You get a full **Runtime Target** picker, so you can choose your graphics card (GPU) family or run on the processor (CPU) only.
- **Windows on ARM and Linux on ARM**: A reduced set of options, mostly CPU based.
- **macOS on Apple Silicon**: Marinara uses the MLX runtime, tuned for Apple chips. Custom models are HuggingFace repositories instead of single files.
- **macOS on Intel and Android**: Effectively CPU only.

The Local Model is not available in "Lite" installs. A Lite install is a slimmed-down build that leaves out the local runtime to save space. On a Lite install, the Local Model card does not appear.

## First-time setup

Set up the runtime first, then choose a model.

1. Open the **Local AI Model** setup window.
2. Click **Install Runtime**. On Apple Silicon this button reads **Install MLX Runtime**.
3. Wait for the runtime to finish installing. A progress bar shows the download.
4. Choose a model in the **Downloading a model** section below.
5. Wait for the model download to finish.
6. When the status reads **Ready**, click **Done**.

If you are not ready to finish, click **Skip for Now**. Once a model exists, that button reads **Close** instead.

Installing or reinstalling the runtime is a protected action. On Windows one-click installs it is turned on for you automatically. On macOS, Linux, and Docker you may need to allow it. See the **Troubleshooting** section below.

## Downloading a model

The setup window offers two ways to get a model.

### Curated presets

Under **Curated Gemma 4 Presets** you pick one of two ready-made choices. On non-Apple hardware these use the GGUF format:

| Preset | Download size | RAM while running |
| --- | --- | --- |
| Q8 (Best Quality) | about 5.4 GB | about 5.8 GB |
| Q4_K_M (Smaller, Faster) | about 3.2 GB | about 3.6 GB |

The Q8 choice is tagged **Recommended**. It gives the best quality. The Q4_K_M choice is smaller and faster, and it uses less memory.

On Apple Silicon these become MLX presets instead. The 8-bit MLX preset needs about 5.9 GB download and about 7.5 GB RAM. The 4-bit MLX preset needs about 3.6 GB download and about 4.8 GB RAM.

To download a preset:

1. Select the preset you want.
2. Click **Use Curated Preset**. If you already have a model, this button reads **Switch to Curated Preset**.

### Bring your own model

Under **Use Your Own Model From HuggingFace** you can supply your own model from HuggingFace, a public model-sharing site.

1. Type the repository name into the field. The format is `owner/repo`.
2. Click **List Models**. On Apple Silicon this button reads **Validate Repo**.
3. On non-Apple hardware, pick a specific file from the dropdown, then click **Download Selected GGUF**.
4. On Apple Silicon, once the repository is validated, click **Use Validated MLX Repo**.

Marinara keeps only one Local Model file on disk at a time. Downloading a new model deletes the old one first. There is no separate delete button for the main Local Model. To remove it, download a different model over it.

## Runtime Settings reference

Open the **Runtime Settings** section inside the setup window to tune how the model runs. The fields save in different ways:

- The dropdowns and the **Native Tool Calls** switch save as soon as you change them.
- **Context Window**, **Max Response Tokens**, **Temperature**, **Top P**, and **Top K** take effect only when you click **Apply Settings**.
- **Physical Batch Size** has its own **Apply** button. So does the layer count field that appears when **GPU Offload** is set to **Custom GPU layers**.

| Setting | Default | What it controls |
| --- | --- | --- |
| Runtime Target | Auto detect | Which GPU family Marinara installs for |
| GPU Offload | Auto offload | How much work goes to the GPU |
| Native Tool Calls | On | Lets the model use tools and function calls |
| Pooling Type | None | Embedding math for lorebook search |
| Physical Batch Size | 512 | Batch size for lorebook embedding requests |
| Context Window | 8192 | How much text the model can read at once |
| Max Response Tokens | 4096 | Longest reply the model may write |
| Temperature | 0.3 | How random the replies are |
| Top P | 0.95 | A sampling limit for word choice |
| Top K | 64 | A sampling limit for word choice |

Notes on the trickier fields:

- **Runtime Target** and **GPU Offload** appear only on the GGUF runtime. On Apple Silicon MLX picks the accelerator for you.
- **Pooling Type** and **Physical Batch Size** also appear only on the GGUF runtime, under the **Embedding Endpoint** heading. They tune lorebook embeddings only. They do not change normal chat replies.
- **Pooling Type** defaults to **None**. Switch it to **Mean** when you use the Local Model for lorebook embeddings.
- **Physical Batch Size** sets how much text the embedding endpoint takes in one batch. Raise it when long lorebook entries fail to vectorize. The app suggests 1024 for Gemma.
- **Native Tool Calls** must be on for tools to work. The warning reads that Professor Mari and custom agents need this enabled before the local model can run tools. This option is not available on the MLX runtime.
- **Max Response Tokens** caps normal chat and agent replies. It does not limit Game Mode scene analysis, which has its own internal cap.

## Send Test Message

Use **Send Test Message** to check that the runtime works. This button is in the Runtime section. It is off until a model is downloaded and the runtime is installed.

1. Click **Send Test Message**.
2. Wait for the result box.
3. A success box reads **Local Test Message Succeeded** with the round-trip time.
4. A failure box reads **Local Test Message Failed** with the error.

The test uses a fixed prompt. It ignores your Temperature and token settings, so it is a clean check of whether the model responds.

## Using the Local Model for helpers

Once a model is downloaded, the Local Model card shows two switches:

- **Use for tracker agents (roleplay)**. This is off by default.
- **Use for game scene analysis**. This is on by default.

These two switches decide whether Marinara keeps the Local Model running in the background. If both are off, the runtime does not start on its own. Turning either one on makes Marinara start the local server automatically. The first start after you turn one on can take a moment.

The card also has a **Use local model for all tracker agents** button. It points every built-in tracker agent at the Local Model in one click. A line below shows how many tracker agents point at the local model, for example "3/7 built-in tracker agents currently point at the local model." This only changes which model the agents use. It does not turn the agents on. See [Memory Recall and Chat Summaries](../agents/memory.md) and your mode guide for enabling agents.

In Game Mode you can also route scene work through the Local Model. In the Game setup, the **Scene Effects Connection** dropdown offers **Local Model (Gemma)**. Picking it turns on the **Use for game scene analysis** switch. See [Game Mode: Getting Started](../game/getting-started.md).

### Local Model for lorebook embeddings

You can use the Local Model to power semantic lorebook search. In a lorebook's vectorization controls, pick **Local Model (sidecar)** as the connection. This needs **Use for tracker agents (roleplay)** or **Use for game scene analysis** to be on first. If both are off, the request fails with a message that the local model must be enabled for trackers or game scene analysis. This path uses the GGUF runtime and is not available on Apple Silicon MLX. See [Semantic Search for Lorebooks](../lorebooks/semantic-search.md).

## Using the Local Model as a chat connection

Once a model is downloaded, the Local Model appears at the bottom of most connection pickers. It shows as **Local Model (sidecar)**, or **Local Model** with the model name in parentheses when a name is known.

If you pick it for a normal chat, a warning appears. It reads that the Local Model is tiny and intended for helpers. It also warns that main chat and roleplay replies may be slow, short, or low quality. This entry is not a real saved connection, so you cannot save connection defaults for it.

Selecting it for a chat starts the local server on demand, even when both helper switches are off. Game Mode's main model dropdown does not list it. Game Mode uses the Local Model only through the **Scene Effects Connection**.

## Local Speech Model for calls

The **Local Speech Model** is an optional Calls download for offline microphone transcription. It powers Conversation calls when you choose to transcribe your voice on your own machine. It is a Whisper model, a speech-to-text model that turns your spoken words into text.

First install **Calls** from **Agents > Download Agents**. You can then manage Whisper from the **Local Model** card in Connections, under the **Local Speech Model** heading. The heading and download controls stay hidden when Calls is not installed.

Two choices are offered:

- **Whisper Tiny (Multilingual)**: about 180 MB download, about 350 MB RAM. The best first choice for phones and older machines.
- **Whisper Base (Multilingual)**: about 320 MB download, about 650 MB RAM. Better accuracy for messy speech, but slower to start.

To set it up:

1. Open the **Local Model** card and expand it.
2. Under **Local Speech Model**, pick a model from the dropdown.
3. Click **Download Whisper**.
4. When it reads **Ready**, it is set up.

To remove only the selected model, click the trash button titled **Delete Local Whisper**. Uninstalling Calls removes all downloaded Whisper choices and their saved selection automatically to reclaim their disk space. If you reinstall Calls later, the Local Speech Model controls return and you can download Whisper again.

Your recorded audio never leaves your machine. Only the transcribed text is sent to your chosen chat connection. To use it in a call, set the call audio input mode to the Local Whisper option. See [Conversation Audio and Video Calls](../conversation/calls.md).

## Troubleshooting

**"Sidecar runtime install is disabled."** Installing or reinstalling the runtime is a protected action. Windows one-click installs turn it on for you. On macOS, Linux, and Docker, you have two options. Set `SIDECAR_RUNTIME_INSTALL_ENABLED=true` in the server `.env` file, for example:

```
SIDECAR_RUNTIME_INSTALL_ENABLED=true
```

Or enter your Admin Access secret once in **Settings -> Advanced -> Admin Access**, then try again. See [Server Configuration Reference](../CONFIGURATION.md).

**The runtime failed to start.** The setup window shows a box titled **Local runtime failed to start** with the error and a log file path. Click **Retry Startup**. If that fails, click **Reinstall Runtime**, or try a different **Runtime Target**. You can click **Continue Without Local AI** to keep using Marinara without the Local Model. The Connections card shows the same problem as **Local runtime unavailable**.

**Lorebook search says the local model is not enabled.** Turn on **Use for tracker agents (roleplay)** or **Use for game scene analysis** in the Local Model card, then try the vectorization again.

**A Game Mode banner reads "Local scene helper failed to start."** Click **Open Local AI Model** in the banner to retry, switch models, or turn off local scene analysis.

For more help, see [Troubleshooting Marinara Engine](../TROUBLESHOOTING.md).

## Related guides

- [Connecting to an AI Provider](connecting-to-a-provider.md)
- [Connecting a Local or Self-Hosted Model](local-self-hosted.md)
- [Memory Recall and Chat Summaries](../agents/memory.md)
- [Conversation Audio and Video Calls](../conversation/calls.md)
- [Game Mode: Getting Started](../game/getting-started.md)
- [Semantic Search for Lorebooks](../lorebooks/semantic-search.md)
