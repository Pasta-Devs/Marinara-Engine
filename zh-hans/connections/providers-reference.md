# 支持的 AI 服务商

本指南列出 Marinara Engine 能连接的所有 AI 服务商，逐个说明去哪里拿 API 密钥、默认的基础 URL 是什么、有哪些需要注意的特殊之处。API 密钥是服务商发放的一串秘密字符，作用类似密码，有了它 Marinara 才能调用对方的 AI 服务。

添加连接的通用步骤请先看[连接 AI 服务商](connecting-to-a-provider.md)。本页是一份参考资料，想查某一家服务商的细节时来搜就行。

## 怎么看这一页

服务商是在 **Connections**(连接) 面板里创建连接时选定的。每家服务商在 **Create Connection**(创建连接) 窗口里都有对应的 **Provider**(服务商) 按钮，按钮上的名称与下文完全一致。

本页大多数服务商都是云服务，AI 跑在他们那边。在服务商那里注册账号，复制一个 API 密钥，粘贴到 **API Key**(API 密钥) 输入框即可。有三家订阅制服务商不用密钥，改为本地登录，对应小节里会写明。

有两个词会反复出现：

- 基础 URL：Marinara 发送请求的网址。大多数服务商会自动填好，只有本地或自定义服务器才需要改。
- 模型：选好服务商之后再挑的那个具体 AI 模型。可用模型变动频繁，所以本页不逐一列出。在连接编辑器里用 **Model**(模型) 下拉菜单，或者点击 **Fetch Models from API**(从 API 获取模型) 按钮，就能看到当前的清单。

## OpenAI

- 密钥获取地址：`https://platform.openai.com/api-keys`
- 默认基础 URL：`https://api.openai.com/v1`

**OpenAI** 提供 GPT 系列模型。粘贴密钥之后，从下拉菜单里挑一个模型，或者点击 **Fetch Models from API** 载入最新清单。这个连接只用于聊天模型。要生成 DALL-E 图像，请改用 **Image Generation**(图像生成) 服务商下的 **OpenAI (DALL-E)** 服务。

## Anthropic

- 密钥获取地址：`https://console.anthropic.com/settings/keys`
- 默认基础 URL：`https://api.anthropic.com/v1`

**Anthropic** 提供 Claude 系列模型，支持提示词缓存，长聊天的花费能因此降下来。在连接编辑器里开启 **Enable prompt caching**(启用提示词缓存) 开关即可。

**Anthropic** 不提供嵌入。嵌入会把文本转成一串数字，Marinara 靠它来搜索世界书和记忆。要用这些功能，得单独建一个嵌入连接，见下文的 Embeddings 一节。

## Google Gemini

- 密钥获取地址：`https://aistudio.google.com/apikey`
- 默认基础 URL：`https://generativelanguage.googleapis.com/v1beta`

**Google Gemini** 通过 Google AI Studio 提供 Gemini 系列模型。两个 Google 选项里，这个更省事。

## Google Vertex AI

- 凭据文档：`https://cloud.google.com/vertex-ai/docs/authentication`
- 默认基础 URL：`https://us-central1-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/us-central1`

**Google Vertex AI** 通过一个 Google Cloud 项目提供 Gemini 系列模型，配置起来比 **Google Gemini** 麻烦。必须编辑 **Base URL**(基础 URL)，把 `YOUR_PROJECT_ID` 换成真实的项目 ID。如果地区不是 `us-central1`，也要一并改掉。

**API Key** 输入框接受下面三种凭据中的任意一种，Marinara 会自动识别粘贴进去的是哪一种：

1. 服务账号 JSON 密钥。
2. OAuth 访问 Token，例如 `gcloud auth print-access-token` 的输出。
3. Vertex API 密钥。

## Mistral

- 密钥获取地址：`https://console.mistral.ai/api-keys`
- 默认基础 URL：`https://api.mistral.ai/v1`

**Mistral** 提供 Mistral 系列模型。除了 API 密钥之外不需要任何额外配置。

## Cohere

- 密钥获取地址：`https://dashboard.cohere.com/api-keys`
- 默认基础 URL：`https://api.cohere.ai/compatibility/v1`

**Cohere** 默认走它的 OpenAI 兼容端点。如果粘贴的是旧的 Cohere v2 网址，Marinara 会自动换成兼容端点，请求照样能通。

## OpenRouter

- 密钥获取地址：`https://openrouter.ai/keys`
- 默认基础 URL：`https://openrouter.ai/api/v1`

**OpenRouter** 是聚合服务，一个密钥就能用上多家公司的大量模型。它在连接编辑器里多出两个选项：

- **Preferred Provider**(优先服务商)：一个文本输入框，强制 **OpenRouter** 把请求路由到指定的后端。名称必须和 OpenRouter 模型页上显示的一致。留空则自动路由。
- **Enable prompt caching**：为经由 **OpenRouter** 路由的 Claude 模型发送缓存提示。**OpenRouter** 上的其他模型大多自己就会缓存，不需要开这个。

## NanoGPT

- 密钥获取地址：`https://nano-gpt.com/api`
- 默认基础 URL：`https://nano-gpt.com/api/v1`

**NanoGPT** 同样是聚合服务。它没有内置模型清单，所以 **Model** 下拉菜单一开始是空的。粘贴密钥之后点击 **Fetch Models from API**，就能载入账号可用的模型。

## xAI / Grok

- 密钥获取地址：`https://console.x.ai`
- 默认基础 URL：`https://api.x.ai/v1`

**xAI / Grok** 提供 Grok 系列模型。在 **Create Connection** 窗口里选中这家服务商时，Marinara 会把模型预填为 Grok 4.5，之后可以随时改。

## Z.AI

- 密钥获取地址：`https://z.ai/manage-apikey/apikey-list`
- 默认基础 URL：`https://api.z.ai/api/paas/v4`

**Z.AI** 通过自有 API 提供 GLM 模型（GLM 5.3、GLM 5.3 Flash 及更早的模型）。**Model** 下拉列表显示当前的 GLM 模型，**Fetch Models from API** 会从你的账户刷新列表。GLM 5.3 模型始终会进行推理：预设中的 **Reasoning Effort**(推理强度) 会映射到 Z.AI 支持的三个级别：**Low**(低)、**High**(高) 和 **Maximum**(最大)。不设置时会使用 Z.AI 的默认值 **Maximum**。默认基础 URL 是按用量付费的端点。Z.AI 的 Coding Plan 使用另一个端点，其使用政策仅允许列表中的指定工具使用，因此不应期待 Coding Plan 的密钥能在这里使用。

## Claude (Subscription)

- API 密钥：不需要，改为登录一个本地工具。

**Claude (Subscription)** 借助 Claude Code 工具使用 Anthropic 的 Pro 或 Max 订阅。该工具运行在托管 Marinara 服务器的那台电脑上，登录一次即可。这家服务商的 **API Key** 和 **Base URL** 输入框会被隐藏。它不提供嵌入，见下文的 Embeddings 一节。

安装和登录步骤见 [Claude、ChatGPT 和 Grok 订阅连接](subscription-clis.md)。

## OpenAI (ChatGPT)

- API 密钥：不需要，改为登录一个本地工具。

**OpenAI (ChatGPT)** 借助 Codex 工具使用 ChatGPT 账号。该工具运行在托管 Marinara 服务器的那台电脑上，登录一次即可。这家服务商的 **API Key** 和 **Base URL** 输入框会被隐藏。它不提供嵌入，见下文的 Embeddings 一节。

安装和登录步骤见 [Claude、ChatGPT 和 Grok 订阅连接](subscription-clis.md)。

## Grok CLI (Subscription)

- API 密钥：不需要，改为登录一个本地工具。

**Grok CLI (Subscription)** 借助 Grok CLI 工具使用 SuperGrok 或 X Premium+ 账号。该工具运行在托管 Marinara 服务器的那台电脑上，登录一次即可。这家服务商的 **API Key** 和 **Base URL** 输入框会被隐藏。它不提供嵌入，见下文的 Embeddings 一节。

安装和登录步骤见 [Claude、ChatGPT 和 Grok 订阅连接](subscription-clis.md)。

## Custom (OAI-Compatible)

- 默认基础 URL：没有，必须自己填。

要连接本地或自建的模型服务器，比如 Ollama、LM Studio、KoboldCpp，就选 **Custom (OAI-Compatible)**。任何能说 OpenAI 聊天格式的托管代理也适用。大多数本地服务器的 **API Key** 可以留空。**Base URL** 填自己的服务器地址。

分步配置说明以及 **Treat as local/custom endpoint**(按本地/自定义端点处理) 开关，见[连接本地或自托管模型](local-self-hosted.md)。Marinara 内置的那个小模型，见[本地模型设置](local-model.md)。

## Image Generation

**Image Generation** 是一个特殊的服务商。选中它之后还要再选一个 **Service**(服务)，也就是真正干活的图像后端。每个服务都有自己的默认基础 URL，以及自己那套是否需要 API 密钥的规则。可选的服务里有付费云 API，比如 **OpenAI (DALL-E)**、**Stability AI**、**NovelAI** 和 **Z.AI**，也有免费选项，比如 **Pollinations** 和 **Stable Horde**。**ComfyUI** 和 **SD Web UI (AUTOMATIC1111 / Forge)** 这类本地服务器同样可用。

图像服务的完整清单、配置方法和生成设置，见[图像生成服务商与设置](../media/image-providers.md)。

## Video Generation

**Video Generation**(视频生成) 也是特殊服务商，有自己的 **Video Service**(视频服务) 选择器。Game Mode(游戏模式) 用它来生成简短的 MP4 场景视频。可选服务有 **Google AI Studio**、**xAI Imagine**、**OpenRouter Video** 和 **Seedance 2.0**，每个都需要 API 密钥。

各视频服务的完整配置和限制，见[场景视频生成](../media/scene-video.md)。

## 嵌入

世界书的语义搜索和 Memory Recall(记忆功能) 都靠嵌入驱动。嵌入把文本转成一串数字，Marinara 借此找出相关条目。大多数聊天服务商都允许在连接编辑器里设置 **Embedding Model**(嵌入模型)，以及可选的 **Embedding Endpoint URL**(嵌入端点 URL)。

有些服务商做不了嵌入。**Anthropic**、**Claude (Subscription)**、**OpenAI (ChatGPT)** 和 **Grok CLI (Subscription)** 都不提供。遇到这几家，就用 **Embedding Connection**(嵌入连接) 下拉菜单借用另一个连接，比如某个 OpenAI 兼容连接、**Google Gemini**，或者内置的 **Local Model**(本地模型)。

## 相关指南

- [连接 AI 服务商](connecting-to-a-provider.md)
- [Claude、ChatGPT 和 Grok 订阅连接](subscription-clis.md)
- [连接本地或自托管模型](local-self-hosted.md)
- [图像生成服务商与设置](../media/image-providers.md)
- [场景视频生成](../media/scene-video.md)
