# 内置模型设置

**Built-in model**(内置模型) 是一个由 Marinara 下载、在你自己的电脑上运行的小型 AI 模型。它不需要 API 密钥，也不需要在线账号，任何数据都不会离开你的电脑。

它很小，所以适合后台辅助工作：追踪器智能体（负责记录故事细节的辅助功能）、Game Mode(游戏模式) 场景效果、世界书嵌入和判定检查。它太弱，做不好角色扮演，也做不好 Professor Mari 的编辑。这些工作请改用更强的账号。见[连接 AI 服务商](connecting-to-a-provider.md)。

如果看不到 **Built-in model** 卡片，说明你装的是“Lite”版，这是去掉了本地运行时的精简构建。

## 下载内置模型

开始之前，确认有足够的空闲磁盘空间和内存（RAM）来放这个模型。具体大小见下表。

1. 点击顶栏里的 **Connections**(连接)。
2. 在 **Jobs**(分工) 框下方找到 **Built-in model** 卡片。它显示 **Not downloaded**。
3. 点击卡片，或者点击它的 **Download**(下载) 按钮。一个标题为 **Built-in model** 的窗口会打开。
4. 在 **Which model?**(用哪个模型？) 下面选一个模型。**Gemma 4 E2B — Q8 (Best Quality)** 带有 **Recommended**(推荐) 标记。电脑内存不多的话，选 **Q4_K_M**。它大约需要 3.4 GB 内存，而不是 5.4 GB。
5. 点击底部的 **Download** 按钮。按钮上会显示模型大小，例如 **Download 5.0 GB**。
6. 等待完成。窗口会显示三个步骤：**Install runtime**(安装运行时)、**Download model**(下载模型) 和 **Start and test**(启动并测试)。运行时是负责运行模型的那个程序。缺少运行时时，Marinara 会先安装它。
7. 窗口显示模型名称、旁边有个绿点时，点击 **Test**(测试)。一个标题为 **Local test message**(本地测试消息) 的框会显示 **Succeeded**，以及回复用了多长时间。
8. 点击 **Done**(完成)。

卡片现在会显示 **Ready**，以及模型大小和它负责的工作。

如果没有成功：

- **Sidecar runtime install is disabled**(错误消息)。安装运行时属于受保护操作。见[允许安装运行时](#allow-runtime-installs)。
- **Local runtime failed to start.** 见[故障排查](#troubleshooting)。
- **Download failed.** 窗口会显示错误。检查网络连接和空闲磁盘空间，然后再点一次下载按钮。

也可以从 **Connections** 面板里的 **Add**(添加) 打开这个窗口：在 **Add account**(添加账号) 窗口里，它在 **Built-in model** 下面。

### 精选预设

窗口提供 Gemma 4 E2B 的两个现成预设，这是 Google 的一个小模型。Apple Silicon 电脑拿到的是 MLX 版本，而不是 GGUF 文件。GGUF 和 MLX 是本地模型的两种文件格式。下面的大小就是窗口里显示的数字（单位是 GB，1 GB 为 1024 × 1024 × 1024 字节）。

| 预设 | 下载体积 | 运行时内存占用 |
| --- | --- | --- |
| Q8 (Best Quality) | 5.0 GB | 5.4 GB |
| Q4_K_M (Smaller, Faster) | 3.0 GB | 3.4 GB |

Apple Silicon 上改为显示两个 MLX 预设：

| 预设 | 下载体积 | 运行时内存占用 |
| --- | --- | --- |
| 8-bit MLX (Best Quality) | 5.5 GB | 7.0 GB |
| 4-bit MLX (Smaller, Faster) | 3.4 GB | 4.5 GB |

磁盘上同一时间只保留一个内置模型。选另一个模型会替换掉原来那个。以后想换，打开卡片，在 **Built-in model** 窗口里点击 **Change model**(更换模型)。在卡片的页面上，**Model**(模型) 旁边的按钮可以在预设之间切换，切换前会先请你确认下载大小。

### 使用自己的模型

在 **Your own model**(你自己的模型) 下面，可以使用来自 Hugging Face(一个公开的模型分享站) 的 GGUF 模型，或者运行 Marinara 的那台电脑上的文件。

1. 点击 **Your own model**，然后选一个选项卡：**Hugging Face** 或 **File on the server**(服务器上的文件)。
2. 在 **Hugging Face** 选项卡里，按 `owner/repo` 格式输入仓库名，然后点击 **Find files**(查找文件)。从列表里选一个文件。
3. 在 **File on the server** 选项卡里，输入 `.gguf` 文件的完整路径。Marinara 直接在原位置使用这个文件，不会复制它。
4. 点击底部的按钮：**Download**；如果是服务器上的文件，就点 **Use this file**(使用此文件)。

在 Apple Silicon 上，**Find files** 显示为 **Validate repo**(验证仓库)，而且仓库必须是原生 MLX 格式。服务器上的 GGUF 文件在那里照样能用，走的是 llama.cpp 而不是 MLX。

## 把内置模型用于辅助工作

下载完成后，打开 **Built-in model** 卡片。它的页面会显示状态、内存占用和 **Used by**(使用者)，还有这些控件：

| 控件 | 作用 |
| --- | --- |
| **Use for tracker agents (roleplay)**(用于追踪器智能体，角色扮演) | 让模型为追踪器智能体保持运行。默认关闭。 |
| **Use for game scene analysis**(用于游戏场景分析) | 让它为 Game Mode 的场景效果保持运行，比如背景、音乐和天气。默认开启。 |
| **Use the built-in model for all tracker agents**(所有追踪器智能体都使用内置模型) | 把所有内置追踪器智能体都指向这个模型。它不会把智能体开启。 |
| **Change in Defaults**(在默认设置中更改) | 打开 **Jobs** 框，可以在那里给它分配其他工作。 |

两个开关都关时，模型不会自己启动。开启其中一个，或者有聊天或工作用到它时，它才会启动。启用智能体的方法见[记忆功能与聊天摘要](../agents/memory.md)。

在 Game Mode 的设置里，**Scene effects model**(场景效果模型) 可以使用内置模型。见 [Game Mode：入门](../game/getting-started.md)。

### 世界书嵌入

嵌入是一组数字，让世界书能按意思搜索。要用内置模型生成嵌入，把世界书的向量化模型选为 **Built-in model (on this device)**(内置模型，在此设备上)。先开启 **Use for tracker agents (roleplay)** 或 **Use for game scene analysis**，否则请求会失败。这条路径需要 GGUF 运行时，所以在 Apple Silicon 的 MLX 上不可用。见[世界书的语义搜索](../lorebooks/semantic-search.md)。

### Decision 模型

也可以把内置模型选为你的 Decision 模型。见 [Decision 模型](decision-models.md)。

### 聊天模型

要用内置模型聊天：

1. 打开一个聊天，点击聊天输入框里的模型按钮（链接图标）。
2. 在 **Model for this chat**(此聊天的模型) 里选 **Built-in model (on this device)**。它在列表最下面，模型下载完成后才会出现。
3. 发一条消息。会弹出一条警告，说明这个模型很小，回复可能又慢又短、质量偏低。

## 运行时设置

要打开它们，在卡片页面上点击 **Runtime settings**(运行时设置)，或者在 **Built-in model** 窗口里点击 **Settings**(设置)。设置分成四组。下拉菜单和开关改动后立即保存。数字字段要点击 **Apply settings**(应用设置) 才会保存。**Physical batch size**(物理批大小) 和 **Custom GPU layers**(自定义 GPU 层数) 各有自己的 **Apply**(应用) 按钮。

**Speed**(速度)

| 设置项 | 默认值 | 作用 |
| --- | --- | --- |
| **Runtime target**(运行时目标) | Auto detect | Marinara 按哪个显卡系列安装运行时。 |
| **GPU offload**(GPU 卸载) | Auto offload | 有多少计算交给显卡。可选 **Auto offload**(自动卸载)、**CPU only**(仅 CPU) 或 **Custom GPU layers**(1 到 1024)。 |

**Memory**(内存)

| 设置项 | 默认值 | 作用 |
| --- | --- | --- |
| **Context window**(上下文窗口) | 8192 | 模型一次读入多少文本，单位是 Token。至少 512。 |
| **KV cache type**(KV 缓存类型) | f16 | 模型怎样存储它已经读过的内容。可选 f16、q8_0 或 q4_0。后两种占用内存更少，需要支持 Flash Attention。 |

**Replies**(回复)

| 设置项 | 默认值 | 作用 |
| --- | --- | --- |
| **Max response tokens**(最大回复 Token 数) | 4096 | 模型能写的最长回复。至少 64。 |
| **Temperature**(温度) | 0.3 | 回复的随机程度。0 到 2。 |
| **Top P** | 0.95 | 选词时的一种限制。大于 0，最大为 1。 |
| **Top K** | 64 | 选词时的一种限制。0 到 500。 |

**Expert**(专家)

| 设置项 | 默认值 | 作用 |
| --- | --- | --- |
| **Native tool calls**(原生工具调用) | On | 允许模型使用工具。Professor Mari 和自定义智能体需要开启它。 |
| **Max parallel agent jobs**(智能体最大并行任务数) | 2 | 同时运行多少个任务。1 到 16。 |
| **Pooling type**(池化类型) | None | 模型怎样把文本转成数字，供世界书搜索使用。做世界书嵌入时选 **Mean**。 |
| **Physical batch size** | 512 | 每批世界书嵌入处理的文本量。128 到 32768。长条目失败时调大。Gemma 通常用 1024 就行。 |

有些设置因系统而异：

- 在 Windows 和 Linux(x64) 上，**Runtime target** 提供 Auto detect、NVIDIA GPU、AMD GPU、Intel GPU、Vulkan GPU、CPU only 和 System llama-server。其他系统的选项更少。
- 在 Apple Silicon 上，MLX 会自动帮你选加速器。**Runtime target**、**GPU offload**、**KV cache type**、**Native tool calls**、**Pooling type** 和 **Physical batch size** 都不显示。
- **Max response tokens** 不限制 Game Mode 的场景分析，后者有自己的上限。
- **Expert** 里的 **Diagnostics**(诊断信息) 会显示运行时构建版本、检测到的显卡和上一次的启动命令。

<a id="allow-runtime-installs"></a>

### 允许安装运行时

安装或重装运行时属于受保护操作。Windows 一键安装版会自动为你放行。在 macOS、Linux 和 Docker 上，做下面其中一项，然后重试：

- 在 **Settings → Advanced → Admin Access**(设置 → 高级 → 管理员访问) 里输入管理员密钥。管理员密钥是用于高风险操作的第二个密码。可以在服务器所在电脑的 **Admin Access** 里生成它，也可以在服务器的 `.env` 文件里把它设为 `ADMIN_SECRET`。见 [Admin Access](../REMOTE_ACCESS.md#admin-access-and-privileged-actions)。
- 在服务器的 `.env` 文件里加上 `SIDECAR_RUNTIME_INSTALL_ENABLED=true`，然后重启 Marinara。`.env` 文件是 Marinara 文件夹里的一个文本文件。见[编辑 .env 文件](../CONFIGURATION.md#edit-the-env-file)。

Marinara 只下载为你当前版本批准的 llama.cpp、MLX 和 uv 版本，并在运行任何内容之前校验每个文件的大小和 SHA-256 校验和。

## 本地语音模型

**Local speech model**(本地语音模型) 在你自己的电脑上把你的语音转成文字，供 Conversation(对话模式) 通话使用。它是一个 Whisper 模型，属于语音识别模型。它需要 **Calls**(通话) 智能体包，在 **Agents → Agent Organizer**(智能体 → 智能体管理器) 里安装。

1. 打开 **Connections** 面板，点击 **On this device**(在你的电脑上) 下面的 **Speech to text**(语音识别) 项。
2. 在 **Local speech model** 下面，从下拉菜单里选一个模型。
3. 点击 **Download Whisper**(下载 Whisper)。
4. 等它显示 **Ready**。使用 Calls 之前，完全重启一次 Marinara。

| 模型 | 下载体积 | 运行时内存占用 |
| --- | --- | --- |
| Whisper Tiny (Multilingual) | 约 180 MB | 约 350 MB |
| Whisper Base (Multilingual) | 约 320 MB | 约 650 MB |

手机和老电脑优先选 Tiny。Base 对口齿不清的语音识别更准，但启动更慢。要删除已下载的模型，点击 **Delete Local Whisper**(删除 Local Whisper，垃圾桶按钮)。卸载 Calls 也会删掉它。

你的音频不会离开你的电脑，只有文字会发给你的聊天模型。要在通话中使用它，把通话的音频输入设为 Local Whisper。见 [Conversation 音频和视频通话](../conversation/calls.md)。如果改为开启 **Speech to text** 服务器，通话就会把你的语音发到那里。见[使用你自己的语音识别服务器](../conversation/calls.md#use-your-own-speech-to-text-server)。

<a id="troubleshooting"></a>

## 故障排查

| 症状 | 解决办法 |
| --- | --- |
| **Sidecar runtime install is disabled**(错误消息)。 | 见[允许安装运行时](#allow-runtime-installs)。 |
| **Local runtime failed to start.** 窗口会显示错误和日志文件路径。卡片会显示 **Local runtime unavailable**。 | 点击 **Retry startup**(重试启动)。还是不行就点击 **Reinstall runtime**(重新安装运行时)，或者换一个 **Runtime target**。**Continue without local AI**(不使用本地 AI，继续) 会关闭辅助开关，让 Marinara 在没有这个模型的情况下继续工作。 |
| 运行时下载报告文件大小或 SHA-256 不匹配。 | Marinara 已经丢弃了这个文件。更新 Marinara 后再试。如果仍然失败，不要自己打开这个文件，把运行时目标和错误信息报告出来。 |
| 世界书搜索提示本地模型未启用。 | 开启 **Use for tracker agents (roleplay)** 或 **Use for game scene analysis**，然后重新向量化。 |
| Game Mode 横幅显示 **Local scene helper failed to start**。 | 点击横幅里的 **Open Local AI Model**(打开本地 AI 模型)，可以重试、换模型，或者关闭本地场景分析。 |

需要更多帮助，见 [Marinara Engine 故障排查](../TROUBLESHOOTING.md)。

## 相关指南

- [连接 AI 服务商](connecting-to-a-provider.md)
- [Decision 模型](decision-models.md)
- [连接本地或自托管模型](local-self-hosted.md)
- [记忆功能与聊天摘要](../agents/memory.md)
- [Conversation 音频和视频通话](../conversation/calls.md)
- [Game Mode：入门](../game/getting-started.md)
- [世界书的语义搜索](../lorebooks/semantic-search.md)
