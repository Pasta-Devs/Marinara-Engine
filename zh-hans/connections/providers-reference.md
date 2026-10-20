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

在两个 Google 选项上，Marinara 都会关闭 Google 可调整的安全过滤器，你自己在 **Custom Parameters**(自定义参数) 里设置的类别除外；不过 Google 的核心保护措施，例如儿童安全，仍然有效。

## Google Vertex AI

- 凭据文档：`https://cloud.google.com/vertex-ai/docs/authentication`
- 默认基础 URL：`https://us-central1-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/us-central1`

**Google Vertex AI** 通过一个 Google Cloud 项目提供 Gemini 系列模型，配置起来比 **Google Gemini** 麻烦。必须编辑 **Base URL**(基础 URL)，把 `YOUR_PROJECT_ID` 换成真实的项目 ID。如果地区不是 `us-central1`，也要一并改掉。

**API Key** 输入框接受下面三种凭据中的任意一种，Marinara 会自动识别粘贴进去的是哪一种：

1. 服务账号 JSON 密钥。
2. OAuth 访问 Token，例如 `gcloud auth print-access-token` 的输出。
3. Vertex API 密钥。

**Gemini 4 Argon** 只在 `global`、`us` 和 `eu` 这几个位置运行，不在 `us-central1` 这样的单个地区运行。要使用它，把 **Base URL** 设为 `https://aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/global`。用其他位置时，Google 会返回错误，Marinara 会把错误显示出来。

无论用哪种 Google 连接，Argon 都可能要几分钟才回答。如果聊天回复超时，调大 `CHAT_GENERATION_TIMEOUT_MS`。如果智能体调用超时，调大 `AGENT_CALL_TIMEOUT_MS`(见[服务器配置参考](../CONFIGURATION.md))。Google 建议至少留出 15 分钟，也就是 `900000`。

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

Marinara 会读取 NanoGPT 的详细模型目录，因此下拉列表会标明哪些模型包含在订阅中，以及哪些模型会消耗更多额度：

- 订阅包含的模型会显示**输入 token 倍率**标记：按正常速率消耗额度时显示绿色的 `1x`；如果每个发送的 token 会从额度中扣除多个输入 token，则显示 `2x` 等更高数值。订阅*不包含*的模型显示 **Paid**(付费)，因为其使用费用会从付费余额扣除。没有标记表示该模型未提供订阅数据。

### 订阅用量

如果你订阅了 NanoGPT，此连接可以显示当前额度：

1. 在连接编辑器中开启 **Show subscription usage**(显示订阅用量) 并保存。
2. 也可以先粘贴 **Management Token**(管理令牌)。

小组件读取 NanoGPT 的用量端点，显示每周和每日输入 token 额度。可以使用两种凭据读取：

- **Management Token**(推荐)：在 `https://nano-gpt.com/settings#management-api-tokens` 创建令牌，并选择 **Usage only**(仅用量) 权限范围。它能读取额度，但不能运行模型或花费余额，因此更适合安全地显示用量。Marinara 会加密保存它，并仅发送到 NanoGPT 的管理端点。
- **你的 API 密钥**：未保存管理令牌时自动使用。这也能工作，但读取额度所用的凭据同时具有花费余额的权限。

每个用量条下面，小组件会显示剩余多少，以及窗口何时重置，例如 `42M remaining · resets in 4d`。

NanoGPT 暂时无法提供的额度会显示为**未知**，而非未使用。未激活的订阅会明确标出，不会显示为完整可用额度。点击刷新按钮即可按需更新小组件。

同一用量条也会出现在聊天连接选择器的上下文指示条下方，以及聊天的 **Connection**(连接) 设置中，让你无需离开聊天就能查看额度。它跟随当前连接：仅在 NanoGPT 连接开启 **Show subscription usage** 时显示；**Random** 没有唯一可查询的连接，因此不显示。选择器中的样式与上方上下文条一致，读法也相同，即已用量相对于每周额度，例如 `8.9M / 60M tokens`，重置时间显示在百分比旁边。

## xAI / Grok

- 密钥获取地址：`https://console.x.ai`
- 默认基础 URL：`https://api.x.ai/v1`

**xAI / Grok** 提供 Grok 系列模型。在 **Create Connection** 窗口里选中这家服务商时，Marinara 会把模型预填为 Grok 4.5，之后可以随时改。 Grok 4.6 和 4.7 提供 500,000 Token 的上下文窗口，推理最高支持 **Extra high**(超高，即 `xhigh`)。它们支持现有聊天工具，包括 **Web Search**(网络搜索)，让搜索结果能够用于最终回复。

## Arli AI

- 密钥获取地址：`https://www.arliai.com/account`
- 默认基础 URL：`https://api.arliai.com/v1`

**Arli AI** 是一项托管聊天服务。它没有内置模型清单，所以 **Model** 下拉菜单一开始是空的。粘贴密钥之后点击 **Fetch Models from API**，载入它当前的模型。想用 Arli AI 生成图像，请改用 **Image Generation** 服务商及其中的 **Arli AI** 服务。

## Z.AI

- 密钥获取地址：`https://z.ai/manage-apikey/apikey-list`
- 默认基础 URL：`https://api.z.ai/api/paas/v4`

**Z.AI** 通过自有 API 提供 GLM 模型（GLM 5.3、GLM 5.3 Flash 及更早的模型）。**Model** 下拉列表显示当前的 GLM 模型，**Fetch Models from API** 会从你的账户刷新列表。GLM 5.3 模型始终会进行推理：预设中的 **Reasoning Effort**(推理强度) 会映射到 Z.AI 支持的三个级别（Low、High、Maximum），不设置时会使用 Z.AI 的默认值（Maximum）。默认基础 URL 是按用量付费的端点。Z.AI 的 Coding Plan 使用另一个端点，其使用政策仅允许列表中的指定工具使用，因此不应期待 Coding Plan 的密钥能在这里使用。

## DeepSeek

- 密钥获取地址：`https://platform.deepseek.com/api_keys`
- 默认基础 URL：`https://api.deepseek.com/v1`

**DeepSeek** 提供自家的聊天模型 `deepseek-flash` 和 `deepseek-v4-pro`。粘贴密钥之后，**Model** 下拉列表会列出它们，**Fetch Models from API** 会从你的账户刷新列表。

DeepSeek 默认会思考。它的 **Reasoning Effort** 使用 DeepSeek 自己的级别，即 **Low**、**High** 和 **Max**；**Off**(关闭) 则为该次请求关闭思考。这里没有 **Medium**：DeepSeek 会把中等强度的请求按 High 处理，所以 Marinara 提供的是 High，而不是再放一个效果完全相同的按钮。它的思考内容会出现在回复里，显示方式与平时相同。

参数面板里有些设置对 DeepSeek 不适用，所以面板直接不显示它们，而不是假装它们有效。**Verbosity**(详细度)、**Top K** 和重复惩罚都在此列：DeepSeek 已经弃用这些参数，发送了也会被忽略。**Temperature**(温度) 和 **Top P** 是一对：DeepSeek 一次只用其中一个，取决于它是否在思考。因此关闭思考时你看到的是 **Temperature**，开启思考时看到的是 **Top P**。

请直接用这家服务商连接 DeepSeek，不要把 **OpenAI** 服务商指向 DeepSeek 的网址。OpenAI 服务商只认 OpenAI 自家的模型，配上 DeepSeek 模型时会隐藏生成参数控件，你的设置也几乎都不会发送出去。

## Claude (Subscription)

- API 密钥：不需要，改为登录一个本地工具。

**Claude (Subscription)** 借助 Claude Code 工具使用 Anthropic 的 Pro 或 Max 订阅。该工具运行在托管 Marinara 服务器的那台电脑上，登录一次即可。这家服务商的 **API Key** 和 **Base URL** 输入框会被隐藏。它不提供嵌入，见下文的 Embeddings 一节。

安装和登录步骤见 [Claude、ChatGPT 和 Grok 订阅连接](subscription-clis.md)。

### 套餐用量

这个连接可以显示你的 Claude 套餐用掉了多少速率限制：

1. 在连接编辑器中开启 **Show subscription usage**(显示订阅用量)。
2. 保持勾选 **5-hour window**(5 小时窗口)和 **Weekly window**(每周窗口)，或取消勾选你不想看的那一个。
3. 保存连接。

每个窗口都有一条用量条，显示已用百分比和重置时间，例如 `58% · resets in 2h`。只要这个连接处于活动状态，同样的用量条也会出现在聊天连接选择器的上下文指示条下方，以及聊天的 **Connection** 设置中。**Random** 没有唯一可查询的连接，因此不会显示。

需要了解：

- 用量条统计的是你 Claude 套餐上的全部使用，例如 Claude Code 和 claude.ai，而不只是 Marinara。
- Claude 只报告每个窗口的百分比，不提供 token 数，所以不会显示 token 数。
- 每次读取，都会让 Marinara 主机上的 Claude Code 工具提供与其 `/usage` 命令相同的数据。它不会向 Claude 发送消息，也不消耗你套餐的任何额度。耗时一两秒，刷新按钮会重新读取一次。
- 标题旁的套餐名称，例如 **Pro**，是 Claude 为当前登录账号报告的名称。
- Claude Code 把这份用量数据标为实验性的。如果将来的版本改动了它，用量条会显示带重试按钮的错误，而不是错误的数字。

## OpenAI (ChatGPT)

- API 密钥：不需要，改为登录一个本地工具。

**OpenAI (ChatGPT)** 借助 Codex 工具使用 ChatGPT 账号。该工具运行在托管 Marinara 服务器的那台电脑上，登录一次即可。这家服务商的 **API Key** 和 **Base URL** 输入框会被隐藏。它不提供嵌入，见下文的 Embeddings 一节。它的思考程度由连接参数或聊天参数里的 **Reasoning Effort** 决定；选定级别之前，Codex 对该模型使用它自己的默认级别。

安装和登录步骤见 [Claude、ChatGPT 和 Grok 订阅连接](subscription-clis.md)。

### 套餐用量

这个连接可以显示你的 ChatGPT 套餐用掉了多少 Codex 限额。它的用法和上面的 Claude (Subscription) 一样：开启 **Show subscription usage**，保持勾选或取消勾选 **5-hour window** 和 **Weekly window**，然后保存。用量条会出现在连接编辑器、聊天的连接选择器，以及聊天的 **Connection** 设置中。

需要了解：

- 用量条统计的是你 ChatGPT 套餐上的全部 Codex 使用，例如 Codex CLI，而不只是 Marinara。chatgpt.com 上的聊天有各自的限额，不计入这些用量条。
- ChatGPT 只报告每个窗口的百分比，不提供 token 数，所以不会显示 token 数。
- 每次读取，都会通过 Marinara 主机上的 Codex 登录，向 ChatGPT 请求与 Codex CLI 显示的限额相同的数据。它不会向任何模型发送消息，也不消耗你套餐的任何额度。
- 只有两个窗口中的一个的套餐，只显示一条用量条。

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

**Video Generation**(视频生成) 也是特殊服务商，有自己的 **Video Service**(视频服务) 选择器。Marinara 用它来生成简短的 MP4 场景视频。可选服务有 **Google AI Studio**、**xAI Imagine**、**OpenRouter Video**、**NanoGPT**、**Atlas Cloud**、**Seedance 2.0**、**ComfyUI** 和 **SwarmUI**。云端服务需要 API 密钥。**ComfyUI** 和 **SwarmUI** 在你自己的电脑上运行，通常不需要。

各视频服务的完整配置和限制，见[场景视频生成](../media/scene-video.md)。

## Decision

- 默认基础 URL：**TypeSafe** 来源为 `https://api.typesafe.ai`。

**Decision**(判定) 是一个可选的特殊服务商，用于接入回答聊天相关是非题的模型。例如，它可以判断某个自定义智能体是否应该运行。它的答案用来引导 Marinara，不会发布到聊天里。选中它之后，再选择一个来源：**TypeSafe**、**OpenRouter**、**Custom System One endpoint**(自定义 System One 端点) 或 **OpenAI-compatible chat model**(OpenAI 兼容聊天模型)。托管来源需要 API 密钥。

判定模型能做什么、怎么挑选，以及完整的设置方法，见 [Decision 模型](decision-models.md)。

## Audio

**Audio**(音频) 是用于语音和生成音效的特殊服务商。选中它之后，再选择一个 **Audio Source**(音频来源)：

- **ElevenLabs**：语音、音效和音乐。
- **OpenAI-compatible**：OpenAI，或任何照搬 OpenAI 语音格式的服务器。
- **PocketTTS**：一个在自己电脑上运行的免费语音服务器。
- **xAI Voice**：xAI 的语音服务。

每个来源都会自动填好默认的基础 URL 和模型。**Default Voice**(默认声音) 是在没有设置更具体的声音（比如单个角色的声音）时使用的声音。**Request timeout (seconds)**(请求超时，单位为秒) 是 Marinara 等待一句语音的时长，默认 60 秒；语音服务器较慢时可以调高。要选择 Marinara 默认使用哪个音频连接，打开 **Connections** 面板，展开 **Defaults**(默认值)，在 **Audio** 下选择。要用它朗读消息，在 **Text to Speech**(语音合成) 卡片里把它选为 **Source**(语音来源)。见[使用音频连接](../media/tts-setup.md#use-an-audio-connection)。

使用 **ElevenLabs** 来源时，还会多出两个开关：**Game sound effects**(游戏音效) 和 **Game music**(游戏音乐)。它们让 Game Mode(游戏模式) 用这个连接生成音效和音乐。参见[生成音效与音乐](../game/game-assets.md#generated-sound-effects-and-music)。语音和朗读消息，见 [Text to Speech (TTS) 设置](../media/tts-setup.md)。

## 嵌入

世界书的语义搜索和 Memory Recall(记忆功能) 都靠嵌入驱动。嵌入把文本转成一串数字，Marinara 借此找出相关条目。大多数聊天服务商都允许在连接编辑器里设置 **Embedding Model**(嵌入模型)，以及可选的 **Embedding Endpoint URL**(嵌入端点 URL)。

有些服务商做不了嵌入。**Anthropic**、**Claude (Subscription)**、**OpenAI (ChatGPT)** 和 **Grok CLI (Subscription)** 都不提供。遇到这几家，就用 **Embedding Connection**(嵌入连接) 下拉菜单借用另一个连接，比如某个 OpenAI 兼容连接、**Google Gemini**，或者内置的 **Local Model**(本地模型)。

想让所有没有自己嵌入设置的连接都使用同一个嵌入来源，打开 **Connections** 面板，展开 **Defaults**，在 **Embeddings**(嵌入) 下选择它。**None (built-in local model)**(无，使用内置本地模型) 会保留内置的本地嵌入模型。连接自己的嵌入模型或 **Embedding Connection** 仍然优先。更改之后，请重新向量化你的世界书和记忆。见[世界书的语义搜索](../lorebooks/semantic-search.md)。

## 相关指南

- [连接 AI 服务商](connecting-to-a-provider.md)
- [Claude、ChatGPT 和 Grok 订阅连接](subscription-clis.md)
- [连接本地或自托管模型](local-self-hosted.md)
- [图像生成服务商与设置](../media/image-providers.md)
- [场景视频生成](../media/scene-video.md)
- [Decision 模型](decision-models.md)
- [Text to Speech (TTS) 设置](../media/tts-setup.md)
