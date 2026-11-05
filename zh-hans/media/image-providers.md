# 图像生成服务商与设置

图像生成支撑着场景插图、自拍、场景背景，以及生成出来的头像、肖像和立绘。本指南介绍如何添加图像服务，也说明各个服务需要什么。只要有一个图像模型可用，应用里所有图像功能都能用上它。

## 添加图像服务

API 密钥是服务给你的一串秘密代码，Marinara 靠它使用你的账号。每个服务的网址都由 Marinara 自动填好，所以很少需要自己输入。

1. 点击顶栏里的 **Connections**(连接)，再点击 **Add**(添加)。**Add account**(添加账号) 窗口随即打开。
2. 找到要用的服务。列表里有 **Images & video**(图像与视频) 分区，也可以用 **Search providers**(搜索服务商) 查找。
3. 把密钥粘贴到 **API key**(API 密钥) 输入框。免费服务和本地服务不需要密钥。如果是你自己运行的服务器，就填好地址字段。
4. 点击 **Connect**(连接)。Marinara 会测试这个账号。
5. 从列表里选一个图像模型，或者输入模型 ID。这就是你的图像模型，它会显示在 **Connections** 面板里这个账号的下方。
6. 打开这个图像模型，点击 **Test image**(测试图像)。Marinara 会生成一张小尺寸的测试图。
7. 要让应用用它来出图，在 **Connections** 面板顶部的 **Defaults**(默认值) 下设置 **Images**(图像) 这项工作。

要给某个账号再添加一个图像模型，打开它的 **⋯** 菜单，点击 **Add image model**(添加图像模型)。窗口的完整说明见[连接 AI 服务商](../connections/connecting-to-a-provider.md)。

如果没有成功：密钥或地址不对时，**Test image** 会失败，先把这两项都检查一遍。**Test provider**(测试服务商) 只检查 Marinara 能否连上这个服务。**Test image** 会实际生成一张图，可能消耗额度。

## 在聊天里生成图片

把某个图像模型设为 **Images** 这项工作之后，就可以在聊天里要图了。

1. 把 Illustrator 智能体添加到一个 Roleplay(角色扮演) 聊天里。见 [Illustrator 智能体](illustrator-agent.md)。
2. 打开 **Chat Settings**(聊天设置)，展开 **Gallery**(图库)，点击 **Illustrate**(生成插图)。
3. 等 **Generating...** 结束。图片会出现在 Gallery 里。

在 Roleplay 聊天里，也可以用 `/illustrate` 命令。见[斜杠命令](../chats/slash-commands.md)。

## 选择服务

每个服务的地址都由 Marinara 自动填好。云端服务需要账号，其中大多数还需要 API 密钥。免费服务不需要密钥。本地服务在你自己的电脑上运行图像软件。

**最简单的起步：** 选 **Pollinations**。它免费，不需要账号，也不需要密钥。想要更好的图片，之后再换一个更强的服务。

| 服务 | API 密钥 | 运行位置 |
| --- | --- | --- |
| OpenAI (DALL-E) | 需要 | 云端 |
| ChatGPT (Codex login) | 不需要，改用 `codex login` 登录 | 云端 |
| Stability AI | 需要 | 云端 |
| Together AI | 需要 | 云端 |
| Arli AI | 需要 | 云端 |
| NovelAI | 需要 | 云端 |
| OpenRouter Images | 需要 | 云端 |
| xAI / Grok Imagine | 需要 | 云端 |
| Venice.ai | 需要 | 云端 |
| Z.AI | 需要 | 云端 |
| Atlas Cloud | 需要 | 云端 |
| fal.ai | 需要 | 云端 |
| SpicyAPI | 需要 | 云端 |
| NanoGPT | 需要 | 云端 |
| Block Entropy | 需要 | 云端 |
| RunPod Serverless (ComfyUI) | 需要 | 云端 |
| Pollinations | 不需要 | 免费云端 |
| Stable Horde | 可选 | 免费云端 |
| SD Web UI (AUTOMATIC1111 / Forge) | 不需要 | 本地 |
| ComfyUI | 不需要 | 本地 |
| SwarmUI | 可选 | 本地 |
| Draw Things | 不需要 | 本地 |

简单服务的说明：

- **OpenAI (DALL-E)**：提供 DALL-E 和 GPT Image 系列模型。只有 GPT Image 2.6 能生成循环播放的 GIF。见 [GPT Image 2.6](#gpt-image-26)。
- **Stability AI**：Stable Diffusion 和 Stable Image 系列模型。
- **Together AI**：FLUX 以及其他开源图像模型。
- **OpenRouter Images**：通过 OpenRouter 的聊天接口调用图像模型，所以具体能用哪些模型因账号而异。
- **xAI / Grok Imagine**：使用 Grok Imagine。
- **NanoGPT**：一个聚合平台，所以要用它的模型列表。
- **Pollinations**：想试试图像生成，这是最快的办法。不需要账号。
- **Stable Horde**：一个众包算力网络。申请一个免费密钥能获得更高的排队优先级。
- **SD Web UI** 和 **Draw Things**：启动软件时要开启它的应用接口。Marinara 把 Draw Things 当作 AUTOMATIC1111 服务器来对待（这个应用运行在 macOS 或 iOS 上）。
- **Block Entropy**：Marinara 没有为它专门写处理逻辑，所以按 OpenAI 兼容格式发送请求。实际兼容性尚未确认。正式使用前先用 **Test image** 测一下。

## 需要特别设置的服务

### GPT Image 2.6

GPT Image 2.6 要通过 **OpenAI (DALL-E)** 账号使用。**GPT Image 2.6 Flare** 是速度更快的模型。**GPT Image 2.6 Sunburst** 画质更高，多次编辑时也更稳定。两者支持的尺寸和透明背景都与 GPT Image 2.5 相同，**Image quality**(图像质量) 可以一直调到 **Max**(最高) 档。

这个模型在作画之前会先规划每张图片。想让它少规划一些，就在图像模型的 **Custom Parameters**(自定义参数) 里加上 `{"complexity": "low"}` 或 `{"complexity": "medium"}`。默认值是 `high`。复杂度越高，耗时可能越长，编辑时也可能改动超出你要求的范围。

GPT Image 2.6 还能生成一小段循环播放的 GIF。只有在某个功能或下载的智能体提供 GIF 时，Marinara 才会请求生成：

| 限制 | 值 |
| --- | --- |
| 账号 | **OpenAI (DALL-E)**，使用 API 密钥 |
| 模型 | GPT Image 2.6 Flare 或 Sunburst |
| 帧数 | 2 到 12，默认 9 |
| 每帧时长 | 20 到 2000 ms，默认 200 ms |
| 帧尺寸 | 约 0.66 MP：正方形 816x816，竖图 608x1088 |
| 发送的图片 | 无。GIF 只根据提示词绘制 |
| 透明背景 | 不支持 |

OpenAI 允许更多帧，但没有公布一个 GIF 最多可以有多少像素，所以 Marinara 把 GIF 控制在最多 12 帧，每帧尺寸也较小。**ChatGPT (Codex login)**、**OpenRouter Images**、**NanoGPT**、ToAPIs 和其他服务都不能生成 GIF。Marinara 会在发出任何内容之前就拒绝这些请求，所以你不用付任何费用。**OpenAI-compatible**(OpenAI 兼容) 账号则按 OpenAI 的方式尝试。

生成失败的 GIF 绝不会换成静态图。如果服务返回的是静态图，这次请求就失败。只有当 **Images** 这项工作的 **If it fails**(失败时) 模型能生成 GIF 时，才会转而尝试它。

> **警告：** OpenAI 没有公布 GIF 的价格。预计一个 GIF 的费用相当于好几张图片，而服务改为返回的静态图同样会计费。

### ChatGPT (Codex login)

这个服务用 ChatGPT 套餐代替 API 密钥，所以生成图像不需要 OpenAI API 额度。

1. 在运行 Marinara 的那台电脑上安装 Codex CLI，然后运行一次 `codex login`。这和 ChatGPT 聊天账号用的是同一套登录。见 [Claude、ChatGPT 和 Grok 订阅连接](../connections/subscription-clis.md#openai-chatgpt)。
2. 选择这个服务。不需要填写密钥或地址。Marinara 会自动填入模型 `gpt-image-2`，也就是 Codex 生成图像所用的模型。

**Test provider** 只检查 Marinara 能否读到你的 Codex 登录信息。**Test image** 会实际生成一张图像，并计入 ChatGPT 的图像用量上限。即使填的是 GPT Image 2.6 的模型 ID，这个服务也不能生成 GIF。带参考图时，Marinara 会发送图像编辑请求，最多附带 16 张参考图。ChatGPT 返回的像素尺寸可能不一样，所以 Marinara 还会在提示词里写明想要的宽高比。这个服务调用的是 Codex 所用的 ChatGPT 图像端点，而不是公开的 OpenAI API，所以 OpenAI 可能随时改动它，不会提前通知。

### Arli AI

它运行托管的 Stable Diffusion 模型。模型是必填项，所以要输入你想用的 Arli AI 图像模型名称。它使用与 SD Web UI 相同的 **Local Image Defaults**(本地图像默认值) 字段（见 [Local Image Defaults](#local-image-defaults-per-connection)）。第一张参考图会作为起始图片。这个服务只用于图像。Arli AI 的聊天模型见[支持的 AI 服务商](../connections/providers-reference.md#arli-ai)。

### NovelAI

NovelAI 专注于动漫风格的图像。使用 V4、V4.5 和 V5 模型时，Marinara 会为多角色分镜和 Illustrator 场景发送带位置的原生角色提示词。精确参考图只能在 V4.5 模型上使用。

### Venice.ai

Marinara 使用 Venice 的原生图像端点，会关闭 Venice 可选的安全模式模糊处理，并把请求的尺寸换算成各模型所用的尺寸格式。Venice 自己的策略或模型限制仍可能拒绝请求。

### Z.AI

要用通用的 Z.AI API 密钥。GLM Coding Plan 的密钥和 `/api/coding/paas/v4` 地址不能用于图像。选择 **GLM-Image** 或 **CogView 4**。Marinara 会把宽高比换算成模型支持的尺寸，并把临时结果下载到本地存储。它只支持文生图，不会发送参考图。

### Atlas Cloud

Marinara 会加载 Atlas Cloud 当前的文生图和图生图模型目录。加载不了时，会显示一份初始列表（Nano Banana、Gemini Flash Image、FLUX 1.1 Pro）。你也可以随时输入准确的模型 ID。任务以异步方式运行，所以 Marinara 会先启动任务，再轮询到图像就绪为止。ID 表明支持图生图、编辑或 Kontext 的模型会收到参考图。Atlas 各模型的输入结构不同，使用其他 ID 时，请查看该模型的 Atlas Cloud 文档。

### fal.ai

在 [fal.ai](https://fal.ai/dashboard/keys) 创建 API 密钥。初始列表提供 `fal-ai/flux/schnell` 和 `fal-ai/flux/dev`。也可以输入其他文生图端点 ID，只要输入和输出兼容就行。**Test provider** 只检查配置。**Test image** 会发送真实请求，消耗 fal.ai 额度。

Marinara 发送提示词和尺寸，然后下载返回的第一张图像。负面提示词会以文字形式追加。模型选项（例如 `seed`、`num_inference_steps` 或 `image_size`）用 **Custom Parameters** 设置。它使用同步的文生图请求，不发送参考图，也不会恢复中断的任务。见该模型的 [API 参考](https://fal.ai/models/fal-ai/flux/schnell/api)。

### SpicyAPI

在 [SpicyAPI 控制台](https://spicyapi.ai/console/keys)创建密钥，然后选择 **SpicyAPI**。Marinara 会自动填入模型 `alibaba/z-image-spicy-pro/text-to-image`。也可以输入其他 ID，例如 `bytedance/seedream-5.0-pro/text-to-image`。**Test provider** 读取的是模型列表，所以不花钱。**Test image** 会实际生成一张图像，消耗你的余额。

请选择 **SpicyAPI** 服务。不要用 **OpenAI (DALL-E)** 或 OpenAI 兼容账号搭配 SpicyAPI 的地址。SpicyAPI 的 OpenAI 风格地址只处理文本。

每个模型接受的设置各不相同。Marinara 会向 SpicyAPI 查询模型接受哪些设置，并且只发送这些设置，选用模型提供的最接近的尺寸形式（宽高比、宽和高，或者固定尺寸）。如果模型没有负面提示词字段，负面提示词会追加到提示词末尾。其他选项（例如 `seed`、`resolution` 或 `loras`）用 **Custom Parameters** 设置。

每张图像都是一个任务。Marinara 会等待，大约一分钟后回头查询，然后下载结果。如果连接中断，它会接着处理同一个任务，而不是花钱重新开一个。编辑模型（ID 以 `/edit` 结尾）会收到你的参考图。SpicyAPI 每张图最大接受 1 MB、每次请求合计最大 2 MB，所以 Marinara 会缩小较大的图像，并舍弃放不下的多余图像。

### SwarmUI

SwarmUI 可以把 ComfyUI 任务分配到自己的队列中处理。没有账号体系的本地服务器不需要密钥。如果你的服务器要求账号，就把 Swarm Auth Token 粘贴到 **API key**。模型列表显示的是 SwarmUI 服务器上的模型。

**ComfyUI workflow (optional)**(ComfyUI 工作流，可选) 输入框可以留空。留空就使用 SwarmUI 自己的图像设置，也可以粘贴一份工作流（见下文）。在 **Local Image Defaults** 里开启 **Save images in SwarmUI**(在 SwarmUI 中保存图像)，每张图像还会另外保存在 SwarmUI 的输出文件夹里。无论哪种方式，Marinara 都会保留自己的一份副本。

### 网络中的本地服务

`localhost` 指的就是运行 Marinara 的这台电脑。这台电脑上的本地图像服务器不用额外设置就能直接用。如果服务器跑在网络里的另一台电脑上，就要在服务器配置中放行本地网络地址。见[服务器配置参考](../CONFIGURATION.md)。

如果服务返回的不是图像数据而是一个 URL，Marinara 会按照常规的出站请求检查来下载公开 CDN 地址。指向私有地址或环回地址的结果 URL，只有在协议、主机名和端口与已配置的图像服务完全一致时才会被接受。从该源发出的跳转也不能转到另一个本地服务。如果某个本地代理把结果存放在另一个私有源上，请让它用与其图像 API 相同的源来提供这些文件。

## ComfyUI 工作流 JSON 与 RunPod

选择 **ComfyUI**、**SwarmUI** 或 **RunPod Serverless (ComfyUI)** 时，会出现 **ComfyUI workflow (optional)** 或 **(required)**(必填) 输入框。把从 ComfyUI 导出的工作流 JSON 粘贴进去；导出用的菜单项因 ComfyUI 版本而异，可能叫 **Save (API Format)**、**Export (API)** 或 **Export to API**。它对 ComfyUI 和 SwarmUI 是可选的，对 RunPod 是必填的。RunPod 需要把 RunPod API Token 填作 API 密钥，还需要一个 **RunPod endpoint ID**(RunPod 端点 ID) 和这份工作流。

把下面这些文本标记放在工作流中需要 Marinara 填值的位置：

- `%prompt%` 和 `%negative_prompt%` 对应提示词。
- `%width%`、`%height%` 和 `%seed%` 对应尺寸和种子。
- `%model%`、`%steps%`、`%cfg%`、`%sampler%`、`%scheduler%` 和 `%denoise%` 对应生成参数。
- `%reference_image%` 以及 `%reference_image_01%` 到 `%reference_image_04%` 用于参考图数据。
- `%reference_image_name%` 以及 `%reference_image_name_01%` 到 `%reference_image_name_04%` 用于上传参考图，并把文件名填进本地 ComfyUI 的 LoadImage 节点。

最关键的是 `%prompt%`，缺了它编辑器会给出警告。对 ComfyUI 来说，输入框留空就会使用内置的默认工作流。对 SwarmUI 来说，留空则使用 SwarmUI 自己的设置。RunPod 没有默认工作流，所以必须填。三者都最多接受 4 张原始 base64 参考图。文件名上传类的占位符只有本地 ComfyUI 能用。

完整的导出步骤、示例、引号规则、参考图、为特定角色准备的工作流、网络访问以及故障排查，见 [ComfyUI 工作流设置](comfyui.md)。

<a id="local-image-defaults-per-connection"></a>

## 每个连接的 Local Image Defaults

服务为 **SD Web UI (AUTOMATIC1111 / Forge)**、**ComfyUI**、**NovelAI**、**Draw Things**、**Arli AI**、**SwarmUI** 或 **RunPod Serverless (ComfyUI)** 时，图像模型上会出现 **Local image defaults** 面板。Draw Things 和 Arli AI 显示的是 SD Web UI 的字段，SwarmUI 和 RunPod 显示的是 ComfyUI 的字段。这些设置只在这个模型生成图像时生效。**Reset**(重置) 会恢复内置值。

每个服务都有 **Seed**(种子) 字段。填 -1 表示每张图都随机，填其他数字则每次都复用同一个种子。其余字段因服务而异。

| 服务 | 字段 | 默认值 |
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

每个服务还有 **Prompt prefix**(提示词前缀) 和 **Negative prefix**(负面前缀) 两个字段。写在这里的文字会加在这个模型每一条提示词的最前面。AUTOMATIC1111 / Forge 和 ComfyUI 都有 **Clip skip** 字段。AUTOMATIC1111 / Forge 另有一个 **Restore faces** 开关。ComfyUI 另有一个开关，用于在没有提供参考图时上传一张 1x1 占位图，它只对带参考图占位符的自定义工作流有意义。NovelAI 另有 **Guidance rescale** 和 **UC preset**。

## 参考图支持因服务而异

参考图就是随提示词一起发过去的一张现成图片，能让新图保持角色的长相或某种画风。

| 服务 | 参考图 |
| --- | --- |
| OpenAI (DALL-E) | 最多 16 张，仅限 GPT Image 模型。GIF 不能带参考图 |
| ChatGPT (Codex login) | 最多 16 张 |
| NovelAI | 最多 16 张，仅限 V4.5 模型 |
| xAI / Grok Imagine | 最多 3 张 |
| NanoGPT | 最多 3 张 |
| ComfyUI、RunPod Serverless (ComfyUI)、SwarmUI | 最多 4 张，通过工作流占位符传入 |
| Stability AI、Arli AI、SD Web UI、Draw Things | 只取第一张，按图生图使用 |
| Atlas Cloud | 取第一张，用于兼容的图生图、编辑或 Kontext 模型 ID |
| SpicyAPI | 仅限编辑模型，不超过模型的上限，会缩小到符合要求 |
| OpenRouter Images | 支持，无固定上限 |
| Venice.ai、Z.AI | 文生图不支持 |
| Together AI、Pollinations、Stable Horde、fal.ai | 不支持 |

NovelAI 的精确参考图只能在 V4.5 模型上使用，比如 `nai-diffusion-4-5-full`。NovelAI 尚未为 V5 发布 Precise Reference。在其他模型上请求参考图时，Marinara 会在不使用参考图的情况下生成图像，并在服务器上记录一条警告。

## 媒体生成请求排队

**Queue media generation requests**(媒体生成请求排队) 开关位于 **Settings → Generations → Overall Generations**(设置 → 生成 → 总体生成)。默认开启。

开启时，Marinara 用两条独立的队列：每个图像账号的图像任务一次只发一个，每个视频账号的视频任务也一次只发一个。同一个账号的图像和视频可以同时进行。所有会请求图像或视频的功能都适用：Illustrator、追踪器、命令、Gallery、Game 素材，以及 Slurp 等下载的智能体。地址和 API 密钥都相同的两个模型共用一条队列。不同的账号仍然可以同时工作。NovelAI 的任务之间还会稍作停顿；NovelAI 回复正忙时，Marinara 会等一会儿再重试两次。

如果服务不接受同时两个请求，就保持开启。只有当服务能同时处理多个请求、而你又想快一点时，才关掉它。

## 相关指南

- [ComfyUI 工作流设置](comfyui.md)
- [Illustrator 智能体](illustrator-agent.md)
- [图像风格方案](style-profiles.md)
- [场景背景与 Gallery 面板](scene-backgrounds.md)
- [自拍](../conversation/selfies.md)
- [支持的 AI 服务商](../connections/providers-reference.md)
