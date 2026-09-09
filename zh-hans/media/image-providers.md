# 图像生成服务商与设置

本指南介绍如何把图像生成服务接入 Marinara Engine，也逐一说明这 17 个服务各自需要什么。图像生成支撑着场景插图、自拍、场景背景，以及生成出来的头像、肖像和立绘。

图像生成是作为一种特殊的连接来设置的。只要有一个图像连接可用，应用里所有图像功能都能用上它。

## 如何添加图像生成连接

**API Key**(API 密钥) 是服务商给的一串秘密字符，类似密码，Marinara 靠它使用你的账号。**Base URL**(基础 URL) 是这个服务的应用接口地址。选好服务之后，Marinara 会自动填好正确的 Base URL。

按下面的步骤添加图像连接。

1. 打开 **Connections**(连接) 面板。
2. 点击 **New**，打开 **Create Connection**(创建连接) 窗口。
3. 输入名称，然后选择 **Image Generation**(图像生成) 服务商。
4. 在连接编辑器里，从网格中选择一个 **Service**(服务)。
5. 如果这个服务需要密钥，粘贴 **API Key**。免费服务和本地服务不需要。
6. 从列表里选择 **Model**(模型)，或者直接输入模型 ID。部分服务提供 **Fetch Models from API**(从 API 获取模型)，可以加载当前的模型列表。
7. 点击 **Save**。
8. 点击 **Test Image**(测试图像) 确认是否可用。Marinara 会生成一张小尺寸的测试图。

**Test Image** 返回了图片，说明连接已经可以用了。失败的话，检查 API 密钥和 Base URL。

## 选择服务

17 个服务分成三类。云端服务需要账号和 API 密钥。免费服务不需要密钥。本地服务在自己的电脑上运行图像软件。

下面这张表可以快速对照各个服务。细节和注意事项见后面的分服务小节。

| 服务 | API 密钥 | 运行位置 |
| --- | --- | --- |
| OpenAI (DALL-E) | 需要 | 云端 |
| Stability AI | 需要 | 云端 |
| Together AI | 需要 | 云端 |
| NovelAI | 需要 | 云端 |
| OpenRouter Images | 需要 | 云端 |
| xAI / Grok Imagine | 需要 | 云端 |
| Venice.ai | 需要 | 云端 |
| Z.AI | 需要 | 云端 |
| Atlas Cloud | 需要 | 云端 |
| NanoGPT | 需要 | 云端 |
| Block Entropy | 需要 | 云端 |
| RunPod Serverless (ComfyUI) | 需要 | 云端 |
| Pollinations | 不需要 | 免费云端 |
| Stable Horde | 可选 | 免费云端 |
| SD Web UI (AUTOMATIC1111 / Forge) | 不需要 | 本地 |
| ComfyUI | 不需要 | 本地 |
| Draw Things | 不需要 | 本地 |

## OpenAI (DALL-E)

云端服务，默认 Base URL 是 `https://api.openai.com/v1`。需要 OpenAI 账号的 API 密钥。提供 DALL-E 和 GPT Image 系列模型。最多接受 16 张参考图。

## Stability AI

云端服务，默认 Base URL 是 `https://api.stability.ai/v2beta`。需要 Stability AI 的 API 密钥。提供 Stable Diffusion 和 Stable Image 系列模型。

## Together AI

云端服务，默认 Base URL 是 `https://api.together.xyz/v1`。需要 Together AI 的 API 密钥。提供 FLUX 以及其他开源图像模型。

## NovelAI

云端服务，默认 Base URL 是 `https://image.novelai.net`。需要 NovelAI 的 API 密钥。它专注于动漫风格的图像。使用 V4、V4.5 和 V5 模型时，Marinara 会为多角色分镜和 Illustrator 场景发送带位置的原生角色提示词。部分较新的功能，比如精确参考图，只能在 V4.5 模型上使用。

## OpenRouter Images

云端服务，默认 Base URL 是 `https://openrouter.ai/api/v1`。需要 OpenRouter 的 API 密钥。它通过 OpenRouter 的聊天接口调用图像模型，所以具体能用哪些模型因账号而异。

## xAI / Grok Imagine

云端服务，默认 Base URL 是 `https://api.x.ai/v1`。需要 xAI 的 API 密钥。图像生成使用 Grok Imagine。

## Venice.ai

云端服务，默认 Base URL 是 `https://api.venice.ai/api/v1`。需要 Venice 的 API 密钥。用 **Fetch Models from API** 加载当前账号可用的图像模型。Marinara 使用 Venice 的原生图像接口，会关闭 Venice 可选的安全模式模糊处理，并自动把请求的尺寸换算成各模型所用的像素、宽高比或分辨率档位格式。即便如此，服务商侧的策略或模型自身的限制仍可能拒绝请求。

## Z.AI

云端服务，默认 Base URL 是 `https://api.z.ai/api/paas/v4`。需要通用的 Z.AI API 密钥；GLM Coding Plan 的密钥和 `/api/coding/paas/v4` 接口不能用于图像生成。用 **Fetch Models from API** 选择 **GLM-Image** 或 **CogView 4**。Marinara 会把请求的宽高比换算成所选模型支持的尺寸，把请求发到 Z.AI 的原生图像接口，再把临时结果 URL 下载到本地存储。当前这一版只支持文生图，不会发送参考图。

## Atlas Cloud

云端服务，默认 Base URL 是 `https://api.atlascloud.ai/api/v1`。需要 Atlas Cloud 的 API 密钥。Marinara 内置了一份小型起步目录，包含 Nano Banana、Gemini Flash Image 和 FLUX 1.1 Pro，也可以直接输入其他准确的 Atlas Cloud 图像模型 ID。任务是异步执行的，Marinara 会先发起生成，然后轮询 Atlas Cloud 直到图像就绪。常见的文生图参数会自动映射；对于声明支持图生图、编辑或 Kontext 行为的模型 ID，参考图会一并发送。由于 Atlas 各模型的接口结构可能不同，使用其他模型 ID 时请查阅该模型在 Atlas Cloud 的文档。

## NanoGPT

云端服务，默认 Base URL 是 `https://nano-gpt.com/api/v1`。需要 NanoGPT 的 API 密钥。NanoGPT 是一个聚合平台，所以要用 **Fetch Models from API** 加载它的模型列表。

## Block Entropy

云端服务，默认 Base URL 是 `https://api.blockentropy.ai`。需要 API 密钥。Marinara 没有为 Block Entropy 专门写处理逻辑，请求按 OpenAI 兼容格式发送。它的实际兼容性尚未确认，正式使用前先用 **Test Image** 测一下。

## RunPod Serverless (ComfyUI)

云端服务，默认 Base URL 是 `https://api.runpod.ai/v2`。它在 RunPod 的 serverless 端点上运行一套 ComfyUI 工作流。需要三样东西：填在 **API Key** 里的 RunPod API Token、一个 **RunPod Endpoint ID**(RunPod 端点 ID)，以及一份 **ComfyUI Workflow**(ComfyUI 工作流) JSON。参见下面的 ComfyUI 工作流小节。

## Pollinations

免费云端服务，默认 Base URL 是 `https://image.pollinations.ai`。不需要账号，也不需要 API 密钥。想先体验一下图像生成，这是最快的办法。

## Stable Horde

免费云端服务，默认 Base URL 是 `https://stablehorde.net/api/v2`。这是一个众包算力网络。API 密钥可选。申请一个免费密钥能获得更高的排队优先级。

## SD Web UI (AUTOMATIC1111 / Forge)

本地服务，默认 Base URL 是 `http://localhost:7860`。它连接自己电脑上运行的 Stable Diffusion Web UI。启动那个软件时必须开启它的应用接口。不需要 API 密钥。

## ComfyUI

本地服务，默认 Base URL 是 `http://127.0.0.1:8188`。它连接自己电脑上运行的 ComfyUI 服务器。支持自定义工作流，具体见下文。不需要 API 密钥。

## Draw Things

本地服务，默认 Base URL 是 `http://localhost:7860`。它连接 macOS 或 iOS 上的 Draw Things 应用。Marinara 把它当作 AUTOMATIC1111 服务器来对待。不需要 API 密钥。

## 网络中的本地服务

`localhost`(也叫环回地址) 指的就是运行 Marinara 的这台电脑。同一台电脑上的本地图像服务器不用额外设置就能直接用。

如果图像服务器跑在家庭网络里的另一台电脑上，就必须在服务器配置中放行本地网络地址。具体做法见[服务器配置参考](../CONFIGURATION.md)。

有些服务商返回的不是图像数据，而是一个 URL。这种情况下，Marinara 会按照常规的出站请求安全检查来下载公开 CDN 地址。指向私有地址或环回地址的结果 URL 只有在协议、主机名和端口与已配置的图像服务商完全一致时才会被接受。从该私有源发出的跳转也不能转到另一个本地服务。如果某个本地代理把结果存放在另一个私有源上，请把代理配置成用与其图像 API 相同的源来提供这些文件。

## ComfyUI 工作流 JSON 与 RunPod

选择 **ComfyUI** 或 **RunPod Serverless (ComfyUI)** 时，会出现一个 **ComfyUI Workflow** 输入框。把从 ComfyUI 导出的工作流 JSON 粘贴进去，导出用的菜单项因前端版本而异，可能叫 **Save (API Format)**、**Export (API)** 或 **Export to API**。这个输入框对 **ComfyUI** 标注为 Optional，对 **RunPod Serverless (ComfyUI)** 标注为 Required。

Marinara 通过占位符往工作流里填内容。把下面这些文本标记放在工作流中该填值的位置。

- `%prompt%` 和 `%negative_prompt%` 对应正负提示词。
- `%width%`、`%height%` 和 `%seed%` 对应图像尺寸和种子。
- `%model%`、`%steps%`、`%cfg%`、`%sampler%`、`%scheduler%` 和 `%denoise%` 对应生成参数。
- `%reference_image%` 以及 `%reference_image_01%` 到 `%reference_image_04%` 用于注入参考图数据。
- `%reference_image_name%` 以及 `%reference_image_name_01%` 到 `%reference_image_name_04%` 用于上传参考图，并把文件名注入本地 ComfyUI 的 LoadImage 节点。

最关键的是 `%prompt%` 占位符。缺了它，编辑器会给出警告。对 **ComfyUI** 来说，这个输入框留空就会使用内置的默认工作流。对 **RunPod Serverless (ComfyUI)** 来说，工作流是必填的，因为端点那边没有默认值。两者都最多接受 4 张原始 base64 参考图；文件名上传类的占位符只有本地 ComfyUI 能用。

完整的导出流程、JSON 示例、占位符的引号规则、参考图设置、为特定角色准备的工作流、局域网访问以及故障排查，见 [ComfyUI 工作流设置](comfyui.md)。

## 每个连接的 Local Image Defaults

当服务选的是 **SD Web UI (AUTOMATIC1111 / Forge)**、**ComfyUI**、**NovelAI** 或 **Draw Things** 时，连接上会出现一个 **Local Image Defaults**(本地图像默认值) 面板。对 **Draw Things**，这个面板显示的字段和默认值与 **SD Web UI (AUTOMATIC1111 / Forge)** 完全相同。这些设置只在当前这个连接生成图像时生效。**Reset**(重置) 按钮可以恢复内置值。

这四个服务都有 **Seed**(种子) 输入框。填 -1 表示每张图都随机。填其他数字则每次都复用同一个种子。

其余字段因服务而异。

| 服务 | 字段 | 默认值 |
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

每个服务还有 **Prompt Prefix**(提示词前缀) 和 **Negative Prefix**(负面前缀) 两个文本框。写在这里的文字会加在这个连接每一条提示词的最前面。AUTOMATIC1111 / Forge 和 ComfyUI 都有 **Clip Skip** 输入框。AUTOMATIC1111 / Forge 另有一个 **Restore faces** 开关。ComfyUI 另有一个开关叫 **Upload a 1x1 placeholder when no reference image is provided**，它只对带参考图占位符的自定义工作流有意义。NovelAI 另有 **Guidance Rescale** 和 **UC Preset** 两个字段。

## 参考图支持因服务商而异

**参考图**就是随提示词一起发过去的一张现成图片，它能帮新图保持角色的长相或某种画风。各家服务商能接受的数量不一样。

| 服务商 | 参考图 |
| --- | --- |
| OpenAI (DALL-E) | 最多 16 张 |
| NovelAI | 最多 16 张，仅限 V4.5 模型 |
| xAI / Grok Imagine | 最多 3 张 |
| Venice.ai | 文生图不支持 |
| Z.AI | 当前的文生图集成不支持 |
| Atlas Cloud | 支持图生图、编辑或 Kontext 的模型 ID 只取第一张 |
| NanoGPT | 最多 3 张 |
| Stability AI | 只取第一张，按图生图使用 |
| OpenRouter Images | 支持，无固定上限 |
| ComfyUI 和 RunPod Serverless (ComfyUI) | 最多 4 张，通过工作流占位符传入 |
| Together AI、Pollinations、Stable Horde | 不支持 |

NovelAI 的精确参考图只能在 V4.5 模型上使用，比如 `nai-diffusion-4-5-full`。NovelAI 尚未为 V5 发布 Precise Reference。在其他模型上请求参考图时，Marinara 会在不使用参考图的情况下生成图像，并在服务器日志中记录警告。

## 图像生成请求排队

**Queue image generation requests**(图像生成请求排队) 开关位于 **Settings**(设置)，然后 **Generations**(生成)，然后 **Image Generation**。默认开启。

开启时，Marinara 一次只发一个图像任务。如果服务不接受同时两个请求，就保持开启。只有当服务能同时处理多个请求、而你又想快一点时，才关掉它。

## 相关指南

- [ComfyUI 工作流设置](comfyui.md) 逐步讲解本地和 RunPod 的自定义工作流 JSON。
- [Illustrator 智能体](illustrator-agent.md) 讲如何设置自动场景插图。
- [图像风格方案](style-profiles.md) 决定每一张生成图像的整体观感。
- [场景背景与 Gallery 面板](scene-backgrounds.md) 介绍生成式场景背景。
- [自拍](../conversation/selfies.md) 是 Conversation(对话模式) 里的角色自拍命令。
- [支持的 AI 服务商](../connections/providers-reference.md) 列出了全部聊天、图像和视频服务商。
