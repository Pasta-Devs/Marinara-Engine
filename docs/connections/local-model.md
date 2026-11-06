# Built-in Model Setup

The **Built-in model** is a small AI model that Marinara downloads and runs on your own computer. It needs no API key and no online account, and nothing leaves your computer.

It is small, so it suits background helper work: tracker agents (helpers that keep track of story details), Game Mode scene effects, lorebook embeddings, and decision checks. It is too weak for good roleplay or Professor Mari edits. For those, use a stronger account. See [Connecting to an AI Provider](connecting-to-a-provider.md).

If the **Built-in model** card is missing, you have a "Lite" install, a slimmed-down build without the local runtime.

## Download the Built-in model

Before you start, make sure you have free disk space and memory (RAM) for the model. The sizes are in the table below.

1. Click **Connections** in the top bar.
2. Find the **Built-in model** card under the **Jobs** box. It says **Not downloaded**.
3. Click the card, or click its **Download** button. A window titled **Built-in model** opens.
4. Under **Which model?**, pick a model. **Gemma 4 E2B — Q8 (Best Quality)** is tagged **Recommended**. If your computer has little memory, pick **Q4_K_M**. It needs about 3.4 GB of RAM instead of 5.4 GB.
5. Click the **Download** button at the bottom. It shows the model size, for example **Download 5.0 GB**.
6. Wait. The window shows three steps: **Install runtime**, **Download model**, and **Start and test**. A runtime is the program that runs the model. Marinara installs it first when it is missing.
7. When the window shows the model name with a green dot, click **Test**. A box titled **Local test message** says **Succeeded** and shows how long the reply took.
8. Click **Done**.

The card now says **Ready**, with the model size and the jobs it does.

If it did not work:

- **Sidecar runtime install is disabled** (an error message). Installing the runtime is a protected action. See [Allow runtime installs](#allow-runtime-installs).
- **Local runtime failed to start.** See [Troubleshooting](#troubleshooting).
- **Download failed.** The window shows the error. Check your internet connection and free disk space, then click the download button again.

You can also reach this window from **Add** in the **Connections** panel, under **Built-in model** in the **Add account** window.

### Curated presets

The window offers two ready-made presets of Gemma 4 E2B, a small Google model. Apple Silicon computers get MLX versions instead of GGUF files. GGUF and MLX are two file formats for local models. The sizes below are what the window shows (in GB, where 1 GB is 1024 × 1024 × 1024 bytes).

| Preset | Download | RAM while running |
| --- | --- | --- |
| Q8 (Best Quality) | 5.0 GB | 5.4 GB |
| Q4_K_M (Smaller, Faster) | 3.0 GB | 3.4 GB |

Apple Silicon shows two MLX presets instead:

| Preset | Download | RAM while running |
| --- | --- | --- |
| 8-bit MLX (Best Quality) | 5.5 GB | 7.0 GB |
| 4-bit MLX (Smaller, Faster) | 3.4 GB | 4.5 GB |

Marinara keeps one Built-in model on disk at a time. Choosing another model replaces the first one. To switch later, open the card and click **Change model** in the **Built-in model** window. On the card's page, the buttons next to **Model** switch between the presets and ask you to confirm the download size first.

### Use your own model

Under **Your own model** you can use a GGUF model from Hugging Face (a public model-sharing site) or a file on the computer that runs Marinara.

1. Click **Your own model**, then pick a tab: **Hugging Face** or **File on the server**.
2. On **Hugging Face**, type the repository name as `owner/repo`, then click **Find files**. Pick one file from the list.
3. On **File on the server**, type the full path to the `.gguf` file. Marinara uses the file where it is and does not copy it.
4. Click the button at the bottom: **Download**, or **Use this file** for a file on the server.

On Apple Silicon, **Find files** reads **Validate repo**, and the repository must be MLX-native. A GGUF file on the server still works there and uses llama.cpp instead of MLX.

## Use the Built-in model for helper jobs

Open the **Built-in model** card after it is downloaded. Its page shows its state, memory use, and **Used by**, and has these controls:

| Control | What it does |
| --- | --- |
| **Use for tracker agents (roleplay)** | Keeps the model running for tracker agents. Off by default. |
| **Use for game scene analysis** | Keeps it running for Game Mode scene effects such as backgrounds, music, and weather. On by default. |
| **Use the built-in model for all tracker agents** | Points every built-in tracker agent at this model. It does not turn the agents on. |
| **Change in Defaults** | Opens the **Jobs** box, where you can give it other jobs. |

If both switches are off, the model does not start on its own. It starts when you turn one on, or when a chat or job uses it. See [Memory Recall and Chat Summaries](../agents/memory.md) for enabling agents.

In Game Mode setup, **Scene effects model** can use the Built-in model. See [Game Mode: Getting Started](../game/getting-started.md).

### Lorebook embeddings

Embeddings are numbers that let a lorebook search by meaning. To use the Built-in model for them, pick **Built-in model (on this device)** as the lorebook's vectorization model. Turn on **Use for tracker agents (roleplay)** or **Use for game scene analysis** first, or the request fails. This path needs the GGUF runtime, so it does not work on Apple Silicon MLX. See [Semantic Search for Lorebooks](../lorebooks/semantic-search.md).

### Decision model

You can also pick the Built-in model as your Decision model. See [Decision Models](decision-models.md).

### Chat model

To chat with the Built-in model:

1. Open a chat and click the model button in the chat input (the link icon).
2. In **Model for this chat**, pick **Built-in model (on this device)**. It is at the bottom of the list, and shows once the model is downloaded.
3. Send a message. A warning says the model is small, so replies can be slow, short, or low quality.

## Runtime settings

To open them, click **Runtime settings** on the card's page, or click **Settings** in the **Built-in model** window. They sit in four groups. Dropdowns and switches save at once. The number fields save when you click **Apply settings**. **Physical batch size** and **Custom GPU layers** each have their own **Apply**.

**Speed**

| Setting | Default | What it does |
| --- | --- | --- |
| **Runtime target** | Auto detect | Which graphics card family Marinara installs for. |
| **GPU offload** | Auto offload | How much work goes to the graphics card. Choose **Auto offload**, **CPU only**, or **Custom GPU layers** (1 to 1024). |

**Memory**

| Setting | Default | What it does |
| --- | --- | --- |
| **Context window** | 8192 | How much text the model reads at once, in tokens. 512 or more. |
| **KV cache type** | f16 | How the model stores what it has read. Choose f16, q8_0, or q4_0. The last two use less memory and need Flash Attention support. |

**Replies**

| Setting | Default | What it does |
| --- | --- | --- |
| **Max response tokens** | 4096 | The longest reply the model may write. 64 or more. |
| **Temperature** | 0.3 | How random replies are. 0 to 2. |
| **Top P** | 0.95 | A limit on word choice. Above 0, up to 1. |
| **Top K** | 64 | A limit on word choice. 0 to 500. |

**Expert**

| Setting | Default | What it does |
| --- | --- | --- |
| **Native tool calls** | On | Lets the model use tools. Professor Mari and custom agents need it on. |
| **Max parallel agent jobs** | 2 | How many jobs run at once. 1 to 16. |
| **Pooling type** | None | How the model turns text into numbers for lorebook search. Choose **Mean** for lorebook embeddings. |
| **Physical batch size** | 512 | Text per lorebook embedding batch. 128 to 32768. Raise it when long entries fail. Gemma often works with 1024. |

Some settings differ by system:

- **Runtime target** on Windows and Linux (x64) offers Auto detect, NVIDIA GPU, AMD GPU, Intel GPU, Vulkan GPU, CPU only, and System llama-server. Other systems offer fewer choices.
- On Apple Silicon, MLX chooses the accelerator for you. **Runtime target**, **GPU offload**, **KV cache type**, **Native tool calls**, **Pooling type**, and **Physical batch size** do not show.
- **Max response tokens** does not limit Game Mode scene analysis, which has its own cap.
- **Diagnostics** in **Expert** shows the runtime build, the detected graphics card, and the last launch command.

### Allow runtime installs

Installing or reinstalling the runtime is a protected action. Windows one-click installs allow it for you. On macOS, Linux, and Docker, do one of these, then try again:

- Enter the admin secret in **Settings → Advanced → Admin Access**. The admin secret is a second password for risky actions. You make it in **Admin Access** on the server's own computer, or set it as `ADMIN_SECRET` in the server's `.env` file. See [Admin Access](../REMOTE_ACCESS.md#admin-access-and-privileged-actions).
- Add `SIDECAR_RUNTIME_INSTALL_ENABLED=true` to the server `.env` file, then restart Marinara. The `.env` file is a text file in the Marinara folder. See [Edit the .env file](../CONFIGURATION.md#edit-the-env-file).

Marinara downloads only the llama.cpp, MLX, and uv versions approved for your release, and checks each file's size and SHA-256 checksum before it runs anything.

## Local speech model

The **Local speech model** turns your voice into text on your own computer for Conversation calls. It is a Whisper model, a speech-to-text model. It needs the **Calls** agent package, which you install in **Agents → Agent Organizer**.

1. Open the **Connections** panel and click the **Speech to text** item under **On this device**.
2. Under **Local speech model**, pick a model from the dropdown.
3. Click **Download Whisper**.
4. Wait for **Ready**. Restart Marinara completely before you use Calls.

| Model | Download | RAM while running |
| --- | --- | --- |
| Whisper Tiny (Multilingual) | about 180 MB | about 350 MB |
| Whisper Base (Multilingual) | about 320 MB | about 650 MB |

Tiny is the best first choice for phones and older computers. Base is more accurate for messy speech but slower to start. Click **Delete Local Whisper** (the trash button) to remove the downloaded model. Uninstalling Calls removes it too.

Your audio stays on your computer. Only the text goes to your chat model. To use it in a call, set the call's audio input to Local Whisper. See [Conversation Audio and Video Calls](../conversation/calls.md). If you turn on the **Speech to text** server instead, calls send your speech there. See [Use your own speech-to-text server](../conversation/calls.md#use-your-own-speech-to-text-server).

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| **Sidecar runtime install is disabled** (an error message). | See [Allow runtime installs](#allow-runtime-installs). |
| **Local runtime failed to start.** The window shows the error and a log file path. The card shows **Local runtime unavailable**. | Click **Retry startup**. If that fails, click **Reinstall runtime**, or pick a different **Runtime target**. **Continue without local AI** turns off the helper switches and keeps Marinara working without the model. |
| The runtime download reports a size or SHA-256 mismatch. | Marinara discarded the file. Update Marinara and try again. If it still fails, do not open the file yourself. Report the runtime target and the error. |
| Lorebook search says the local model is not enabled. | Turn on **Use for tracker agents (roleplay)** or **Use for game scene analysis**, then vectorize again. |
| A Game Mode banner says **Local scene helper failed to start**. | Click **Open Local AI Model** in the banner to retry, switch models, or turn off local scene analysis. |

For more help, see [Troubleshooting Marinara Engine](../TROUBLESHOOTING.md).

## Related guides

- [Connecting to an AI Provider](connecting-to-a-provider.md)
- [Decision Models](decision-models.md)
- [Connecting a Local or Self-Hosted Model](local-self-hosted.md)
- [Memory Recall and Chat Summaries](../agents/memory.md)
- [Conversation Audio and Video Calls](../conversation/calls.md)
- [Game Mode: Getting Started](../game/getting-started.md)
- [Semantic Search for Lorebooks](../lorebooks/semantic-search.md)
