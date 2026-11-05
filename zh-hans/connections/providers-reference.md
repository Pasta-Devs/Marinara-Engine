# 支持的 AI 服务商

本页是一份参考资料，列出 Marinara Engine 能连接的主要服务：每个服务去哪里拿 API 密钥、默认地址是什么，以及有哪些特殊之处。想一步步添加账号，请先读[连接 AI 服务商](connecting-to-a-provider.md)。

服务是在 **Add account**(添加账号) 窗口里选的，按用途分在不同的分区下：**Chat**(聊天)、**Images & video**(图像与视频)、**Voice**(声音) 或 **Decisions**(判定)。按钮上的名称与下文一致。地址是 Marinara 发送请求的网址。它在账号编辑器里叫 **Address**(地址)，在模型编辑器里叫 **Base URL**(基础 URL)。已知服务的地址由 Marinara 自动填好。只有使用代理或自己运行的服务器时才需要改。

模型变动频繁，所以本页不列出它们。连接之后，模型列表会在选择器里载入。在选择器里点击 **Refresh model list**(刷新模型列表) 可以重新载入。

## 聊天服务

这些服务都用 API 密钥，只有三家订阅服务例外，它们用的是你电脑上的登录。

| 服务 | 密钥获取地址 |
| --- | --- |
| LinkAPI | `linkapi.ai` |
| OpenAI | `platform.openai.com/api-keys` |
| Anthropic | `console.anthropic.com/settings/keys` |
| Google Gemini | `aistudio.google.com/apikey` |
| Google Vertex AI | `cloud.google.com/vertex-ai/docs/authentication`(凭据指南) |
| Mistral | `console.mistral.ai/api-keys` |
| Cohere | `dashboard.cohere.com/api-keys` |
| OpenRouter | `openrouter.ai/keys` |
| NanoGPT | `nano-gpt.com/api` |
| xAI / Grok | `console.x.ai` |
| Arli AI | `www.arliai.com/account` |
| Z.AI | `z.ai/manage-apikey/apikey-list` |
| DeepSeek | `platform.deepseek.com/api_keys` |
| OpenAI-compatible、Claude (Subscription)、OpenAI (ChatGPT)、Grok CLI (Subscription) | 没有密钥页面。见下面的说明。 |

默认地址如下，Marinara 会自动替你填好：

- LinkAPI：`https://linkapi.ai/v1`(一个使用自有密钥的 OpenAI 兼容网关)
- OpenAI：`https://api.openai.com/v1`
- Anthropic：`https://api.anthropic.com/v1`
- Google Gemini：`https://generativelanguage.googleapis.com/v1beta`
- Google Vertex AI：`https://us-central1-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/us-central1`
- Mistral：`https://api.mistral.ai/v1`
- Cohere：`https://api.cohere.ai/compatibility/v1`
- OpenRouter：`https://openrouter.ai/api/v1`
- NanoGPT：`https://nano-gpt.com/api/v1`
- xAI / Grok：`https://api.x.ai/v1`
- Arli AI：`https://api.arliai.com/v1`
- Z.AI：`https://api.z.ai/api/paas/v4`
- DeepSeek：`https://api.deepseek.com/v1`
- OpenAI-compatible 和订阅服务：没有。由你填写地址，或者不需要地址。

所有密钥页面的网址都以 `https://` 开头。

三家订阅服务会隐藏 **API key**(API 密钥) 和地址输入框。它们不提供嵌入。安装和登录步骤见 [Claude、ChatGPT 和 Grok 订阅连接](subscription-clis.md)，那里也介绍了套餐用量。

聚合服务是指一个密钥就能用上多家公司模型的服务。OpenRouter 和 NanoGPT 都是聚合服务。网关是同样的思路，只不过是你自己运行或租用的代理。

## 服务说明

### OpenAI

**OpenAI** 提供 GPT 系列模型。要生成 DALL-E 图像，添加 **OpenAI**，在同一个账号上选择 **Image**(图像) 模型。其他用同一个密钥生成图像的服务也是这样。

### Anthropic

**Anthropic** 提供 Claude 系列模型。提示词缓存让服务能复用提示词的开头部分，可以降低长聊天的花费。在模型编辑器里用 **Enable prompt caching**(启用提示词缓存) 开启它。**Anthropic** 不提供嵌入（见[嵌入](#embeddings)）。

### Google Gemini 和 Google Vertex AI

**Google Gemini** 通过 Google AI Studio 提供 Gemini 系列模型。它是两个 Google 选项里更简单的那个。在两个 Google 选项上，Marinara 都会关闭 Google 可调整的安全过滤器，你自己在 **Custom Parameters**(自定义参数) 里设置的类别除外。Google 的核心保护措施，例如儿童安全，仍然有效。

**Google Vertex AI** 通过一个 Google Cloud 项目运行 Gemini，需要更多配置。编辑地址，把 `YOUR_PROJECT_ID` 换成你的项目 ID。如果地区不是 `us-central1`，也要改掉。**API key** 输入框接受下面任意一种，Marinara 会识别你粘贴的是哪一种：

1. 服务账号 JSON 密钥（Google Cloud 给你的、指明某个服务账号的文件）。
2. OAuth 访问 Token，例如 `gcloud auth print-access-token` 的输出。
3. Vertex API 密钥。

根据 Marinara 代码里一条依照 Google 文档写的注释，**Gemini 4 Argon** 只在 `global`、`us` 和 `eu` 这几个位置运行，不在 `us-central1` 这样的单个地区运行。要使用它，把地址设为 `https://aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/global`。用其他位置时，Google 会返回错误，Marinara 会把它显示出来。

### Cohere

**Cohere** 使用它的 OpenAI 兼容端点。如果粘贴的是旧的 Cohere v2 地址，Marinara 会自动替你换成兼容端点。

### OpenRouter

**OpenRouter** 是聚合服务，在模型编辑器里多出两个选项：

- **Preferred provider**(优先服务商) 强制把请求路由到指定的一个后端。名称必须与 OpenRouter 模型页上的一致。留空则自动路由。
- **Enable prompt caching** 为经由 OpenRouter 路由的 Claude 模型发送缓存提示。其他模型大多会自己缓存。

### NanoGPT

**NanoGPT** 是没有内置模型清单的聚合服务。连接之后，选择器会载入你账号可用的模型。它会读取 NanoGPT 的详细模型目录，并标出哪些模型包含在你的订阅里：

| 标记 | 含义 |
| --- | --- |
| 绿色的 `1x` | 包含在订阅里，按正常速率消耗。 |
| 更高的数值，例如 `2x` | 包含在订阅里，但每个输入 Token 会消耗额度里相应倍数的 Token。 |
| **Paid**(付费) | 不包含在订阅里。用量从付费余额里扣除。 |
| 没有标记 | NanoGPT 没有它的订阅数据。 |

#### 订阅用量

有 NanoGPT 订阅时，账号可以显示你的实时额度。

1. 点击账号行上的 **⋯**，选择 **Edit account**(编辑账号)，打开 **Usage and balance**(用量与余额)。
2. 如果外部读取是关闭的，点击 **Turn on**(开启)。要添加管理密钥，点击 **Add a usage-only key**(添加仅限用量的密钥)，粘贴进去，再点击 **Show usage**(显示用量)。
3. 开启 **Show the usage meter on the card**(在卡片上显示用量条) 并保存。

用量条显示每周和每日的输入 Token 额度，以及剩余多少、各自何时重置，例如 `42M remaining · resets in 4d`。NanoGPT 无法报告的额度会显示为未知，而不是未使用。未激活的订阅会明确标出，不会画成满额。刷新按钮会重新读取一次。

有两种凭据可以读取用量：

- **Management key**(管理密钥，推荐)。在 `https://nano-gpt.com/settings#management-api-tokens` 创建一个只用于读取用量的密钥。它能读取额度，但不能运行模型，也不能花你的余额。Marinara 会加密保存它，并且只把它发给 NanoGPT 的管理端点。
- **你的 API 密钥**，在没有保存管理密钥时使用。这样也能用，但读取额度时用的是一个能花你余额的密钥。

同一个用量条也会显示在聊天连接选择器的上下文条下方，以及聊天的 **Connection**(连接) 设置里。只有聊天的模型是开启了用量条的 NanoGPT 模型时才会显示；**Shuffle**(随机轮换) 不显示。

### xAI / Grok

**xAI / Grok** 提供 Grok 系列模型。Grok 4.6 和 4.7 有 500,000 Token 的上下文窗口，推理最高到 **Extra high**(超高)。它们支持聊天工具，包括 **Web Search**(网络搜索)，所以搜索结果能用于最终的回复。

### Arli AI

**Arli AI** 是一项托管聊天服务，没有内置模型清单。连接之后，选择器会载入它的模型。要用 Arli AI 生成图像，添加 **Arli AI**，在同一个账号上选择 **Image** 模型。

### Z.AI

**Z.AI** 通过自有 API 提供 GLM 模型（GLM 5.3、GLM 5.3 Flash 及更早的模型）。GLM 5.2 和 5.3 模型接受 **Maximum**(最高) 推理级别。默认地址是按用量付费的端点。Z.AI 的 Coding Plan 使用另一个端点，所以 Coding Plan 的密钥在这里可能用不了。

### DeepSeek

**DeepSeek** 提供 `deepseek-flash` 和 `deepseek-v4-pro`。DeepSeek 默认会思考。它的 **Reasoning Effort**(推理强度) 使用 DeepSeek 自己的级别，**Off**(关闭) 会为该次请求关闭思考。DeepSeek 会把中等强度的请求按 High 处理。思考内容会以平常的思考显示方式出现在回复里。

有些参数不适用，所以面板不显示它们：**Verbosity**(详细度)、**Top K** 和各项惩罚都已弃用，发送了也会被忽略。**Temperature**(温度) 和 **Top P** 是一对，因为 DeepSeek 一次只用其中一个。关闭思考时看到的是 **Temperature**，开启思考时看到的是 **Top P**。

请用 DeepSeek 自己的按钮连接 DeepSeek，不要把 **OpenAI** 指向 DeepSeek 的地址。OpenAI 服务只认 OpenAI 自家的模型，所以配上 DeepSeek 模型时会隐藏生成参数控件，你的设置也几乎都不会发送出去。

### OpenAI-compatible

**OpenAI-compatible**(OpenAI 兼容) 用来连接接受 OpenAI 请求格式的服务器或代理，例如 Ollama、LM Studio 或 KoboldCpp。在 **Add account** 窗口里，它显示为 **OpenAI-compatible address**(OpenAI 兼容地址)。大多数本地服务器的密钥可以留空。地址由你自己填写。见[连接本地或自托管模型](local-self-hosted.md)。Marinara 自己运行的那个小模型，见[内置模型设置](local-model.md)。

## 图像与视频

**Images & video** 下的每个按钮都有自己的地址，以及自己那套是否需要密钥的规则。这些按钮包括 Stability AI、Together AI、NovelAI、Venice.ai、Atlas Cloud、fal.ai、SpicyAPI、Pollinations、Stable Horde、Seedance 2.0，以及本地服务器：ComfyUI、SD Web UI (AUTOMATIC1111 / Forge)、SwarmUI、RunPod Serverless (ComfyUI)、Draw Things 和 Block Entropy。Draw Things、ComfyUI、SwarmUI、SD Web UI 和 RunPod 带有 **Self-hosted**(自托管) 标签。

OpenAI、OpenRouter、xAI、NanoGPT、Arli AI、Z.AI 和 Google 的图像和视频模型，来自你在该服务上的聊天账号。先添加聊天账号，再在上面选择 **Image** 或 **Video**(视频) 模型。

见[图像生成服务商与设置](../media/image-providers.md)和[场景视频生成](../media/scene-video.md)。

## Decision

**Decisions** 下的按钮有 **TypeSafe**(默认地址 `https://api.typesafe.ai`)、**Own decision server**(自有判定服务器) 和 **Built-in model (decisions)**(内置模型，判定)。使用 OpenAI 聊天格式的聊天服务也能做判定，但只限返回对数概率（每个可能答案的分数）的模型。Decision 模型回答关于你聊天的是或否问题。见 [Decision 模型](decision-models.md)。

<a id="audio"></a>

## 音频

**Voice** 下的音频服务负责说出角色的声音和旁白。选择一个 **Audio source**(音频来源)：

| 来源 | 说明 |
| --- | --- |
| ElevenLabs | 角色声音和旁白。 |
| OpenAI-compatible | OpenAI，或任何照搬 OpenAI 语音格式的服务器。 |
| PocketTTS | 一个在你自己电脑上运行的免费语音服务器。 |
| xAI Voice | xAI 的语音服务。 |

每个来源都会填好默认的地址和模型。**Default voice**(默认声音) 是在没有设置更具体的声音（比如单个角色的声音）时使用的声音。**Request timeout (seconds)**(请求超时，单位为秒) 是 Marinara 等待一句语音的时长。语音服务器较慢时调高它。

要选择 Marinara 默认使用的语音账号，点击 **Jobs**(分工) 框里的 **Voice (Text to Speech)**(语音合成) 行。要用它朗读消息，在 **Text to Speech**(语音合成) 卡片里把它选为 **Source**(语音来源)。见 [Text to Speech (TTS) 设置](../media/tts-setup.md)和[使用音频连接](../media/tts-setup.md#use-an-audio-connection)。

<a id="music--sound-effects"></a>

## 音乐与音效

这类账号用于生成纯器乐音乐和音效，与语音分开。**Add account** 窗口里没有它的按钮。这类账号来自升级（见下文）或导入。用 **Edit model**(编辑模型) 编辑它，在里面选择服务，并开启 **Music generation**(音乐生成)、**Sound-effect generation**(音效生成)，或同时开启两项。Game 设置会在 **Music & Sound Effects account**(音乐与音效账号) 里要求选一个，默认选项是 **Use the default Music & Sound Effects account**(使用默认的音乐与音效账号)。

可用的服务：

- **ElevenLabs**：默认地址 `https://api.elevenlabs.io`。需要 ElevenLabs 密钥。音乐和音效有各自的模型字段。
- **SunoAPI**：默认地址 `https://apibox.erweima.ai`。需要 [sunoapi.org](https://sunoapi.org/) 的密钥；开启音乐时，还需要一个公开的 HTTPS **SunoAPI music callback URL**(SunoAPI 音乐回调 URL)。这是 SunoAPI 自己的服务，不是用 Suno 订阅账号登录。
- **Custom compatible server**(自定义兼容服务器)：你服务器的地址。需要明确的音乐或音效端点路径，以及受支持的请求格式。见[兼容音频协议](../media/tts-setup.md#game-music-and-sound-effects-on-a-compatible-audio-server)。

注意：

- 尽管 Marinara 会自己检查曲目是否完成，SunoAPI 仍然需要回调地址。这个地址由你提供，Marinara 不会创建。
- 音乐风格提示词最多 1,000 个字符，音效提示词最多 500 个字符。
- 每次请求都可能在服务商那里产生费用。见[音乐 API](https://docs.sunoapi.org/suno-api/generate-music) 和[音效 API](https://docs.sunoapi.org/suno-api/generate-sounds)。SunoAPI 音效尚未用付费账号验证过。

升级时，每个开启了生成的 Audio 账号都会多出一个单独的 Music & Sound Effects 账号。旧版独立的 ElevenLabs Game 设置也可能创建自己的账号，所以你可能会看到不止一个。语音账号和声音分配保持不变，已保存的 Game 账号 ID 也不会变。只有对应的迁移账号可用，并且开启了音乐或音效选项时，才能生成。否则，请选另一个合适的账号。删除迁移出来的账号后，重启时不会重新创建它。从档案恢复的端点，在你本地检查并保存之前都不可用。

按游戏单独开启生成音频，或者在 Roleplay 的命令设置里开启 **Sound effects**(音效)，就能使用 `[sound: description]`。Gacha Forge 有自己的生成音频设置。关闭生成时，Game 自带的音频仍然可用。

<a id="embeddings"></a>

## 嵌入

嵌入把文本转成一串串数字，让 Marinara 能找出相关的文本。世界书的语义搜索和 Memory Recall(记忆功能) 都靠它驱动。大多数聊天服务都允许你在模型编辑器的 **Semantic search (embeddings)**(语义搜索与嵌入) 下设置嵌入模型，以及可选的 **Embedding endpoint URL**(嵌入端点 URL)。

**Anthropic**、**Claude (Subscription)**、**OpenAI (ChatGPT)** 和 **Grok CLI (Subscription)** 无法生成嵌入。遇到这几家，就用 **Embedding provider**(嵌入服务商) 下拉菜单借用另一个账号，比如某个 OpenAI 兼容账号、**Google Gemini** 或 **Built-in model**(内置模型)。

想让所有没有自己嵌入设置的账号都使用同一个嵌入来源，点击 **Jobs** 框里的 **Embeddings**(嵌入) 行。**Marinara's own search**(Marinara 自带的搜索) 会保留内置的嵌入模型。账号自己的嵌入模型或 **Embedding provider** 仍然优先。更改之后，请重新向量化你的世界书和记忆。见[世界书的语义搜索](../lorebooks/semantic-search.md)。

## 超时

较慢的模型可能会碰到服务器对聊天回复和智能体调用设定的时限。相关的服务器设置见[服务器配置参考](../CONFIGURATION.md)。

## 相关指南

- [连接 AI 服务商](connecting-to-a-provider.md)
- [Claude、ChatGPT 和 Grok 订阅连接](subscription-clis.md)
- [连接本地或自托管模型](local-self-hosted.md)
- [图像生成服务商与设置](../media/image-providers.md)
- [场景视频生成](../media/scene-video.md)
- [Decision 模型](decision-models.md)
- [Text to Speech (TTS) 设置](../media/tts-setup.md)
