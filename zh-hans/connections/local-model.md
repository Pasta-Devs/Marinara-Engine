# 本地模型设置

本指南介绍内置的 **Local Model**(本地模型)，这是一个由 Marinara Engine 下载、在你自己的机器上运行的小型 AI 模型。它不需要 API 密钥，也不需要在线账号。本指南介绍如何设置、**Runtime Settings**(运行时设置) 有哪些选项，以及 Local Model 如何支撑追踪器智能体、Game Mode(游戏模式) 场景效果、离线通话转写这类辅助功能。

## Local Model 是什么

**Local Model** 是一个紧凑的语言模型（Gemma），完全在你的电脑上运行。API 密钥是一串类似密码的秘密字符，Marinara 靠它跟在线 AI 服务通信。Local Model 不需要 API 密钥，因为没有任何数据离开本机。

Local Model 是刻意做小的，用途是后台辅助工作，不适合主聊天或角色扮演。Marinara 会在这些场合用到它：

- Roleplay(角色扮演) 模式下的追踪器智能体。
- Game Mode 的场景效果，比如背景、音乐和天气。
- 用于语义搜索的世界书嵌入。
- Conversation(对话模式) 通话中的麦克风转写，走的是另一个语音模型。
- 选为 Decision 模型后，回答激活问题和判定陈述。见[Decision 模型](decision-models.md)。


设置窗口里它叫 **Local AI Model**，连接下拉菜单里它叫 **Local Model (sidecar)**。两者是同一个功能。

主聊天、角色扮演、游戏主持人（GM）旁白和 Professor Mari 的润色都不要用 Local Model。它太小了，在这些地方出不来好结果，请改用更强的连接。参见[连接 AI 服务商](connecting-to-a-provider.md)。

## 打开 Local Model 卡片

Local Model 位于 **Connections**(连接) 面板。

1. 打开 **Connections** 面板。
2. 找到标题为 **Local Model** 的卡片。
3. 点击卡片，或者点击它上面标题为 **Open local model settings** 的齿轮按钮。

齿轮按钮会打开标题为 **Local AI Model** 的完整设置窗口。如果还没下载模型，卡片上还会显示 **Download now** 和 **Choose model options** 两个按钮，它们打开的是同一个设置窗口。

设置窗口里有一个标题为 **Local Model is for helpers, not main roleplay** 的警告框，再次说明这个模型只适合辅助任务。

## 硬件与操作系统支持

Local Model 会下载一个运行时（负责跑模型的那个程序）和一个模型文件，两者都需要足够的空闲磁盘空间和内存（RAM）。

支持程度取决于操作系统：

- **Windows(64 位) 和 Linux(64 位)**：可以使用完整的 **Runtime Target**(运行时目标) 选择器，既能选显卡（GPU）系列，也能只用处理器（CPU）运行。
- **Windows on ARM 和 Linux on ARM**：可选项较少，基本以 CPU 为主。
- **macOS on Apple Silicon**：Marinara 使用针对苹果芯片调优的 MLX 运行时。自定义模型是 HuggingFace 仓库，而不是单个文件。
- **macOS on Intel 和 Android**：实际上只能用 CPU。

“Lite”安装包里没有 Local Model。Lite 安装是精简版构建，为了省空间去掉了本地运行时。在 Lite 安装上，Local Model 卡片不会出现。

## 首次设置

先装好运行时，再选模型。

1. 打开 **Local AI Model** 设置窗口。
2. 点击 **Install Runtime**。在 Apple Silicon 上这个按钮显示为 **Install MLX Runtime**。
3. 等待运行时安装完成，进度条会显示下载进度。
4. 按下面**下载模型**一节的说明选一个模型。
5. 等待模型下载完成。
6. 状态显示为 **Ready** 后，点击 **Done**。

如果暂时不想弄完，点击 **Skip for Now**。模型已存在时，这个按钮会变成 **Close**。

安装或重装运行时属于受保护操作。Windows 一键安装版会自动为你开启。在 macOS、Linux 和 Docker 上可能需要手动放行，见下面的**故障排查**一节。

Marinara 只下载与当前 Engine 版本相匹配的 llama.cpp、MLX 和 uv 版本，并在解压或执行任何内容之前校验文件大小和 SHA-256 校验和。MLX 的 Python 依赖集同样锁定版本并校验哈希，然后在不解析额外依赖包的前提下安装经过审核的 mlx-lm 源码。所以运行时的升级只会随经过审核的 Marinara 更新一起到来，不会悄悄跟着上游的“latest”构建走。

## 下载模型

设置窗口提供两种获取模型的方式。

### 精选预设

在 **Curated Gemma 4 Presets** 下面可以从两个现成方案里选一个。在非苹果硬件上，它们使用 GGUF 格式：

| 预设 | 下载体积 | 运行时内存占用 |
| --- | --- | --- |
| Q8 (Best Quality) | 约 5.4 GB | 约 5.8 GB |
| Q4_K_M (Smaller, Faster) | 约 3.2 GB | 约 3.6 GB |

Q8 带有 **Recommended** 标记，质量最好。Q4_K_M 体积更小、速度更快，占用内存也更少。

在 Apple Silicon 上，这两项会换成 MLX 预设。8-bit 的 MLX 预设约需下载 5.9 GB，运行时占用约 7.5 GB 内存；4-bit 的 MLX 预设约需下载 3.6 GB，运行时占用约 4.8 GB 内存。

下载预设的步骤：

1. 选中想要的预设。
2. 点击 **Use Curated Preset**。如果已经有模型了，这个按钮会显示为 **Switch to Curated Preset**。

### 使用自己的模型

在 **Use Your Own Model From HuggingFace** 下面，可以从公开的模型分享站 HuggingFace 提供自己的模型。

1. 在输入框里填写仓库名，格式是 `owner/repo`。
2. 点击 **List Models**。在 Apple Silicon 上这个按钮显示为 **Validate Repo**。
3. 在非苹果硬件上，从下拉菜单里选中具体文件，然后点击 **Download Selected GGUF**。
4. 在 Apple Silicon 上，仓库通过校验后点击 **Use Validated MLX Repo**。

磁盘上同一时间只保留一个 Local Model 文件。下载新模型会先删掉旧的。主 Local Model 没有单独的删除按钮，想删掉它，就下载另一个模型把它覆盖掉。

## Runtime Settings 参考

打开设置窗口里的 **Runtime Settings** 一节，可以调整模型的运行方式。各个字段的保存方式不一样：

- 下拉菜单和 **Native Tool Calls**(原生工具调用) 开关改动后立即保存。
- **Context Window**(上下文窗口)、**Max Response Tokens**(最大回复 Token 数，Token 是模型切分文本的最小单位)、**Temperature**(温度)、**Top P** 和 **Top K** 要点击 **Apply Settings** 才生效。
- **Physical Batch Size**(物理批大小) 有自己的 **Apply** 按钮。**GPU Offload** 设为 **Custom GPU layers** 时出现的层数输入框也是如此。

| 设置项 | 默认值 | 作用 |
| --- | --- | --- |
| Runtime Target | Auto detect | Marinara 按哪个 GPU 系列安装运行时 |
| GPU Offload | Auto offload | 有多少计算交给 GPU |
| Native Tool Calls | On | 允许模型使用工具和函数调用 |
| Pooling Type | None | 世界书搜索使用的嵌入算法 |
| Physical Batch Size | 512 | 世界书嵌入请求的批大小 |
| Context Window | 8192 | 模型一次能读多少文本 |
| Max Response Tokens | 4096 | 模型回复的最大长度 |
| Temperature | 0.3 | 回复的随机程度 |
| Top P | 0.95 | 选词时的采样限制 |
| Top K | 64 | 选词时的采样限制 |

几个比较绕的字段说明：

- **Runtime Target** 和 **GPU Offload**(GPU 卸载) 只在 GGUF 运行时下出现。在 Apple Silicon 上，MLX 会自动帮你选加速器。
- **Pooling Type**(池化类型) 和 **Physical Batch Size** 同样只在 GGUF 运行时下出现，位于 **Embedding Endpoint** 标题下。它们只影响世界书嵌入，不会改变普通聊天回复。
- **Pooling Type** 默认是 **None**。用 Local Model 做世界书嵌入时，把它改成 **Mean**。
- **Physical Batch Size** 决定嵌入端点一批处理多少文本。长的世界书条目向量化失败时，把它调大。应用建议 Gemma 用 1024。
- 工具功能需要 **Native Tool Calls** 处于开启状态。警告文案写的是，Professor Mari 和自定义智能体要先启用这一项，本地模型才能调用工具。MLX 运行时没有这个选项。
- **Max Response Tokens** 限制的是普通聊天和智能体回复，不限制 Game Mode 的场景分析，后者有自己内部的上限。

## Send Test Message

用 **Send Test Message**(发送测试消息) 确认运行时是否正常。这个按钮在 Runtime 一节里，模型下载完并且运行时装好之前它是灰的。

1. 点击 **Send Test Message**。
2. 等待结果框出现。
3. 成功时结果框显示 **Local Test Message Succeeded** 和往返耗时。
4. 失败时结果框显示 **Local Test Message Failed** 和错误信息。

测试使用固定的提示词，会忽略 Temperature 和 Token 相关设置，因此能干净地检验模型到底有没有响应。

## 把 Local Model 用于辅助功能

模型下载完成后，Local Model 卡片上会出现两个开关：

- **Use for tracker agents (roleplay)**，默认关闭。
- **Use for game scene analysis**，默认开启。

这两个开关决定 Marinara 要不要让 Local Model 一直在后台运行。两个都关时，运行时不会自己启动；开启任意一个，Marinara 就会自动启动本地服务器。刚开启后的第一次启动会稍微慢一点。

卡片上还有一个 **Use local model for all tracker agents** 按钮，一键把所有内置追踪器智能体都指向 Local Model。下面一行会显示有多少个追踪器智能体指向本地模型，例如“3/7 built-in tracker agents currently point at the local model.”这只改变智能体使用哪个模型，不会把智能体本身开启。启用智能体的方法参见[记忆功能与聊天摘要](../agents/memory.md)以及对应模式的指南。

在 Game Mode 里也可以把场景相关的工作交给 Local Model。在 Game 设置中，**Scene Effects Connection** 下拉菜单里有 **Local Model (Gemma)** 一项。选中它会自动开启 **Use for game scene analysis** 开关。参见 [Game Mode：入门](../game/getting-started.md)。

### 用 Local Model 做世界书嵌入

Local Model 也可以为世界书的语义搜索提供支持。在世界书的向量化控件里，把连接选成 **Local Model (sidecar)**。这要求 **Use for tracker agents (roleplay)** 或 **Use for game scene analysis** 至少有一个已经开启。两个都关时请求会失败，并提示必须为追踪器或游戏场景分析启用本地模型。这条路径走的是 GGUF 运行时，在 Apple Silicon 的 MLX 上不可用。参见[世界书的语义搜索](../lorebooks/semantic-search.md)。

## 把 Local Model 当作聊天连接

模型下载完成后，Local Model 会出现在大多数连接选择器的底部，显示为 **Local Model (sidecar)**；已知模型名称时，则显示为 **Local Model** 加上括号里的模型名。

如果把它选成普通聊天的连接，会弹出一条警告，说明 Local Model 非常小、只适合辅助任务，还会提醒主聊天和角色扮演的回复可能又慢又短、质量偏低。这一项并不是真正保存下来的连接，所以没法为它设置连接默认值。

给聊天选中它会按需启动本地服务器，即使两个辅助开关都是关的也一样。Game Mode 的主模型下拉菜单里不会列出它，Game Mode 只通过 **Scene Effects Connection** 使用 Local Model。

## 通话用的 Local Speech Model

**Local Speech Model**(本地语音模型) 是 Calls 的一个可选下载项，用于离线麦克风转写。选择在本机转写自己的语音时，Conversation 通话就靠它工作。它是一个 Whisper 模型，属于语音识别模型，负责把说出来的话转成文字。

先从 **Agents > Download Agents** 安装 **Calls**，之后就能在 Connections 的 **Local Model** 卡片里、**Local Speech Model** 标题下管理 Whisper。没安装 Calls 时，这个标题和下载控件都是隐藏的。

有两个选项：

- **Whisper Tiny (Multilingual)**：下载约 180 MB，占用约 350 MB 内存。手机和老机器优先选它。
- **Whisper Base (Multilingual)**：下载约 320 MB，占用约 650 MB 内存。对口齿不清的语音识别更准，但启动更慢。

设置步骤：

1. 打开 **Local Model** 卡片并展开。
2. 在 **Local Speech Model** 下面从下拉菜单里选一个模型。
3. 点击 **Download Whisper**。
4. 显示 **Ready** 就说明设置好了。

只删除当前选中的模型，点击标题为 **Delete Local Whisper** 的垃圾桶按钮。卸载 Calls 会自动删掉所有已下载的 Whisper 选项和保存的选择，把磁盘空间还给你。以后重新安装 Calls，Local Speech Model 的控件会回来，可以再次下载 Whisper。

录下来的音频不会离开本机，只有转写出来的文字会发给你选定的聊天连接。要在通话中使用它，把通话的音频输入模式设为 Local Whisper 选项。参见 [Conversation 音频和视频通话](../conversation/calls.md)。

## 故障排查

**"Sidecar runtime install is disabled."** 安装或重装运行时属于受保护操作。Windows 一键安装版会自动开启这项权限。在 macOS、Linux 和 Docker 上有两种办法。一是在服务器的 `.env` 文件里设置 `SIDECAR_RUNTIME_INSTALL_ENABLED=true`，例如：

```
SIDECAR_RUNTIME_INSTALL_ENABLED=true
```

二是在 **Settings -> Advanced -> Admin Access** 里输入一次 Admin Access 密钥，然后重试。参见[服务器配置参考](../CONFIGURATION.md)。

**运行时启动失败。** 设置窗口会显示一个标题为 **Local runtime failed to start** 的提示框，里面有错误信息和日志文件路径。点击 **Retry Startup**。还是不行就点击 **Reinstall Runtime**，或者换一个 **Runtime Target**。点击 **Continue Without Local AI** 可以在不用 Local Model 的情况下继续使用 Marinara。Connections 卡片上会把同一个问题显示为 **Local runtime unavailable**。

**运行时下载报告文件大小或 SHA-256 不匹配。** Marinara 已经在解压之前丢弃了这次下载。先更新 Marinara 再重试，让经过审核的运行时清单和下载内容对得上。如果同一个版本仍然失败，不要手动解压或执行压缩包，把运行时目标和错误信息报告给维护者。

**世界书搜索提示本地模型未启用。** 在 Local Model 卡片里开启 **Use for tracker agents (roleplay)** 或 **Use for game scene analysis**，然后重新做一次向量化。

**Game Mode 横幅显示“Local scene helper failed to start.”** 点击横幅里的 **Open Local AI Model**，可以重试、换模型，或者关闭本地场景分析。

需要更多帮助，参见 [Marinara Engine 故障排查](../TROUBLESHOOTING.md)。

## 相关指南

- [连接 AI 服务商](connecting-to-a-provider.md)
- [Decision 模型](decision-models.md)
- [连接本地或自托管模型](local-self-hosted.md)
- [记忆功能与聊天摘要](../agents/memory.md)
- [Conversation 音频和视频通话](../conversation/calls.md)
- [Game Mode：入门](../game/getting-started.md)
- [世界书的语义搜索](../lorebooks/semantic-search.md)
