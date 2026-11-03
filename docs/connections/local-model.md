# Built-in Model Setup

The **Built-in model** is a small AI model that Marinara downloads and runs on your own computer. It needs no API key and no online account, and nothing leaves your computer. It is made for background helper work: tracker agents, Game Mode scene effects, lorebook embeddings, and (if you choose it) decision checks. It is too small for good roleplay, Game Master narration, or Professor Mari edits. Use a stronger account for those. See [Connecting to an AI Provider](connecting-to-a-provider.md).

The Built-in model is not part of "Lite" installs, a slimmed-down build without the local runtime. On a Lite install its card does not appear.

## Download the Built-in model

Before you start, make sure you have free disk space and memory (RAM) for the model. Each model below lists its sizes.

1. Click **Connections** in the top bar.
2. Find the **Built-in model** card under the **Jobs** box. It says **Not downloaded**.
3. Click the card, or click its **Download** button. A window titled **Built-in model** opens.
4. Under **Which model?**, pick a model. **Gemma 4 E2B — Q8 (Best Quality)** is tagged **Recommended**. Pick the Q4_K_M one if you have less memory.
5. Click the **Download** button at the bottom. It shows the model size, for example **Download 5.4 GB**.
6. Wait. The window shows three steps: **Install runtime**, **Download model**, and **Start and test**. A runtime is the program that runs the model. Marinara installs it first when it is missing.
7. When the window shows the model name with a green dot, click **Test**. A box titled **Local test message** says **Succeeded** and shows how long the reply took.
8. Click **Done**.

The card now says **Ready**, with the model size and the jobs it does.

If it did not work:

- **Sidecar runtime install is disabled.** Installing the runtime is a protected action. See [Allow runtime installs](#allow-runtime-installs).
- **Local runtime failed to start.** See [Troubleshooting](#troubleshooting).
- **Download failed.** The window shows the error. Check your internet connection and free disk space, then click the download button again.

You can also reach this window from **Add** in the **Connections** panel, under **Built-in model** in the **Add account** window.

### Curated presets

The window offers two ready-made presets of Gemma 4 E2B, a small Google model. Apple Silicon gets MLX presets instead of GGUF files. GGUF and MLX are two file formats for local models.

| Computer | Preset | Download | RAM while running |
| --- | --- | --- | --- |
| Windows, Linux, Intel Mac | Q8 (Best Quality) | about 5.4 GB | about 5.8 GB |
| Windows, Linux, Intel Mac | Q4_K_M (Smaller, Faster) | about 3.2 GB | about 3.6 GB |
| Apple Silicon | 8-bit MLX (Best Quality) | about 5.9 GB | about 7.5 GB |
| Apple Silicon | 4-bit MLX (Smaller, Faster) | about 3.6 GB | about 4.8 GB |

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

**Built-in model (on this device)** appears at the bottom of most model pickers. If you pick it for a normal chat, a warning says it is small and replies may be slow, short, or low quality. Game Mode's main model list does not include it.

## Runtime settings

To open them, click **Runtime settings** on the card's page, or click **Settings** in the **Built-in model** window. They sit in four groups: **Speed**, **Memory**, **Replies**, and **Expert**. Dropdowns and switches save at once. The number fields save when you click **Apply settings**, except **Physical batch size** and **Custom GPU layers**, which each have their own **Apply**.

| Setting | Group | Default | Allowed | What it controls |
| --- | --- | --- | --- | --- |
| **Runtime target** | **Speed** | Auto detect | Depends on your system | Which GPU family Marinara installs for. |
| **GPU offload** | **Speed** | Auto offload | **Auto offload**, **CPU only**, **Custom GPU layers** (1 to 1024) | How much work goes to the graphics card. |
| **Context window** | **Memory** | 8192 | 512 or more | How much text the model reads at once. |
| **KV cache type** | **Memory** | f16 | f16, q8_0, q4_0 | Cache memory. q8_0 and q4_0 use less memory and need Flash Attention support. |
| **Max response tokens** | **Replies** | 4096 | 64 or more | The longest reply the model may write. |
| **Temperature** | **Replies** | 0.3 | 0 to 2 | How random replies are. |
| **Top P** | **Replies** | 0.95 | above 0 to 1 | A limit on word choice. |
| **Top K** | **Replies** | 64 | 0 to 500 | A limit on word choice. |
| **Native tool calls** | **Expert** | On | On or off | Lets the model use tools. Professor Mari and custom agents need it on. |
| **Max parallel agent jobs** | **Expert** | 2 | 1 to 16 | How many jobs run at once. |
| **Pooling type** | **Expert** | None | None, Mean, CLS, Last token, Rank | Embedding math for lorebook search. Use **Mean** for lorebook embeddings. |
| **Physical batch size** | **Expert** | 512 | 128 to 32768 | Text per embedding batch. Raise it when long lorebook entries fail. Gemma often works with 1024. |

Some settings differ by system:

- **Runtime target** options: Windows and Linux on x64 offer Auto detect, NVIDIA GPU, AMD GPU, Intel GPU, Vulkan GPU, CPU only, and System llama-server. Linux on ARM offers Auto detect, Vulkan, CPU only, and System. Windows on ARM and Intel Mac offer Auto detect, CPU only, and System. Android offers Auto detect and CPU only.
- On Apple Silicon, MLX chooses the accelerator for you, so **Runtime target**, **GPU offload**, **KV cache type**, **Native tool calls**, **Pooling type**, and **Physical batch size** do not show.
- **Max response tokens** does not limit Game Mode scene analysis, which has its own cap.
- **Diagnostics** in **Expert** shows the runtime build, the detected GPU, and the last launch command.

### Allow runtime installs

Installing or reinstalling the runtime is a protected action. Windows one-click installs allow it for you. On macOS, Linux, and Docker, do one of these, then try again:

- Add `SIDECAR_RUNTIME_INSTALL_ENABLED=true` to the server `.env` file. See [Server Configuration Reference](../CONFIGURATION.md).
- Enter your admin secret once in **Settings → Advanced → Admin Access**.

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
| **Sidecar runtime install is disabled.** | See [Allow runtime installs](#allow-runtime-installs). |
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
