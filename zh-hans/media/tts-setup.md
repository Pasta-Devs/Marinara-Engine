# Text to Speech (TTS) 设置

语音合成（Text to speech，TTS）会把聊天消息和游戏旁白朗读出来。本指南介绍如何开启它、选择语音服务和声音、设置自动朗读，以及使用每条消息上的控件。

## 快速上手

1. 打开语音合成卡片（步骤见下文），开启 **Use text to speech**(使用语音合成)。
2. 选择一个 **Source**(语音来源)，把密钥粘贴到 **API key**(API 密钥)。
3. 点击 **Preview**(试听)，听一段示例。
4. 在聊天里，点击消息下方的 **Speak**(朗读)。

## 开启语音合成

几乎所有 TTS 设置都在同一张卡片里。开启 TTS 并不会让任何内容自己开口。它会让每条消息上的 **Speak** 按钮和 **Auto-play**(自动朗读) 选项显示出来。读什么、什么时候读，仍然由你决定。

1. 点击顶栏里的 **Connections**(连接)，再点击 **Add**(添加)。**Add account**(添加账号) 窗口随即打开。
2. 在 **Voice**(声音) 下选择 **Text to speech**(语音合成)。卡片随即打开。如果语音合成已经在用你的电脑或私有网络上的 PocketTTS 或其他语音服务器，同一张卡片也列在 **On this device**(在你的电脑上) 下。
3. 开启 **Use text to speech**。关闭时，什么都不会朗读。
4. 打开 **Source** 列表，选择一个服务。

**Source** 就是负责生成音频的服务。

- **OpenAI-compatible**：OpenAI，或任何沿用 OpenAI TTS 格式的服务器。这是默认选项。
- **ElevenLabs**：ElevenLabs 语音服务。
- **PocketTTS**：在你自己电脑上运行的免费语音服务器。
- **xAI Voice**：xAI 的语音服务。

Marinara 会为每个 Source 单独保存一套配置：密钥、地址、模型、声音和参数。切换 Source 时会恢复该 Source 之前的设置。还没设置过的 Source 从默认值开始。

请求经由 Marinara 自己的服务器发出。你的 API 密钥加密保存在服务器上。保存之后，输入框只显示一串圆点，真正的密钥不会回传到你的浏览器。

<a id="use-an-audio-connection"></a>

### 使用音频连接

如果你已经添加了 **Audio**(音频) 账号（见[支持的 AI 服务商](../connections/providers-reference.md#audio)），就不用再填一遍它的信息。它会出现在 **Source** 列表的 **Audio providers**(音频服务商) 分组下，括号里注明它的来源类型。

1. 打开 **Source** 列表，选择这个账号。
2. 选择它的声音和下面的其他设置。

之后 Marinara 会使用该账号的地址、密钥、模型和 **Request timeout (seconds)**(请求超时，单位为秒)，所以卡片会隐藏这些字段。密钥留在账号里，不会复制到卡片中，也不会发送到你的浏览器。对账号的改动，比如换了新密钥，会立即生效。

声音、语速和其他语音设置按账号分别保存。两个同类型的账号绝不会共用这些设置。四个常规 Source 的设置保持原样。卡片上的开关仍然用来开启和关闭常规 TTS。

如果所选账号被删除或无法使用，卡片会显示 **Missing Audio provider**(缺少音频服务商)，在你另选一个 Source 之前不会朗读任何内容。Marinara 绝不会自行切换。如果账号能列出自己的声音，卡片会指出不在列表里的已保存声音。

## 设置地址、密钥和模型

如果选的是音频账号，跳过这一步，这些信息由账号提供。

1. 检查 **Base URL**(基础 URL)。每个 Source 都会填入一个默认值（见下表）。只有使用代理或自己运行的服务器时才需要改。
2. 把密钥粘贴到 **API key**。想保留已有密钥，就让那串圆点原样留着。想删除它，清空这个输入框。
3. 检查 **Model**(模型)。每个 Source 都会填入一个默认值。也可以输入你的服务支持的其他模型。

| Source | 默认 Base URL | 默认模型 | 默认声音 |
| --- | --- | --- | --- |
| OpenAI-compatible | `https://api.openai.com/v1` | `tts-1` | `alloy` |
| ElevenLabs | `https://api.elevenlabs.io` | `eleven_multilingual_v2` | 无，必须自己选一个 |
| PocketTTS | `http://localhost:8000` | `pocket-tts` | `alba` |
| xAI Voice | `https://api.x.ai/v1` | `grok-tts` | `eve` |

选择 **ElevenLabs** 时，**Model** 列表会加载你的账号可用的语音合成模型。选一个普通的语音合成模型。ID 里带 `ttv` 的是声音设计模型，无法朗读文字。选了这种模型，播放会失败，并报错提示改用语音合成模型。

### PocketTTS

PocketTTS 并非 Marinara 内置。单独安装[官方 PocketTTS 服务器](https://github.com/kyutai-labs/pocket-tts)，再用 `uvx pocket-tts serve` 启动。Marinara 不会代为下载或管理它。官方服务器使用 `http://localhost:8000`。除非你改了主机或端口，否则 **Base URL** 保持这个值。Marinara 会检测官方的 multipart `/tts` API。[OpenAI 兼容 PocketTTS 包装服务器](https://github.com/teddybear082/pocket-tts-openai_streaming_server)的自定义 URL 仍然可用。

<a id="request-timeout"></a>

### 请求超时

Marinara 为每一句语音最多等待 60 秒。你自己电脑上的语音服务器，尤其是笔记本上的，读一句长句可能需要更久。调高 **Model** 下方的 **Request timeout (seconds)**。范围是 10 到 3,600 秒。

音频账号有自己的 **Request timeout (seconds)**，在账号编辑器里 **Default voice**(默认声音) 的下方。通过音频账号朗读的聊天（包括被选作 **Source** 的账号）使用该账号的时限。卡片的时限适用于卡片自身设置产生的语音，包括 **Preview**。如果某一句耗时太久，报错会写明 Marinara 等了多少秒，以及应该调高哪项设置。

## 选择声音

**Voice option**(声音分配方式) 决定声音如何分配。

- **One voice for all**(所有角色共用一个声音)：每个说话人都使用同一个声音。这是默认设置。
- **Selected per character or persona**(按角色或用户角色单独选择)：给选定的角色和用户角色各自指定声音。

### 所有角色共用一个声音

在 **Shared voice**(共用声音) 里选择声音。想加载你的服务提供的真实声音列表，先填好它的信息，再点击 **Refresh voices from provider**(从服务商刷新声音列表)（圆形箭头图标）。它会先保存卡片，所以刚填的密钥会立即生效。连接之前，会显示一份简短的内置列表，让输入框不至于是空的。服务返回错误时会直接显示错误，不会把备用列表伪装成刷新成功。

官方 PocketTTS 服务器没有声音列表端点，因此 Marinara 显示它的内置声音，并在列表旁保留一个文本框，可以填写其他内置名称或受支持的声音 URL。兼容的包装服务器可以返回自己的列表，并接受自定义 ID 或路径。

选择 **ElevenLabs** 时必须选一个声音。Marinara 会加载账号的整个声音库：个人声音、工作区声音、收藏声音和默认声音。选择器带搜索框，并显示已加载的声音数量。它初始显示“Select an ElevenLabs voice”，在你选中一个真正的声音之前无法播放。

### 按角色或用户角色单独选择

1. 把 **Voice option** 设为 **Selected per character or persona**。
2. 在 **Character and persona voices**(角色与用户角色声音) 里点击 **Add voice**(添加声音)。
3. 在左边的列表里选一个角色或用户角色，在右边的列表里选一个声音。
4. 每个角色或用户角色重复一次。

也可以在 **Character Editor**(角色编辑器) 的 **Voice** 选项卡里设置角色的声音。那里改的是同一行。这个区域里的 **Refresh**(刷新) 会重新加载声音列表。先把角色建好。一个都没有时，应用会提示先添加角色或用户角色，再分配声音。

没有单独配声的角色会使用名字匹配的角色卡的声音，比如 AU 副本对应的原版卡。否则就使用共用声音。参见[创建和编辑角色](../characters/creating-and-editing-characters.md)。

### 旁白声音

旁白是不属于任何单个角色的文字，比如场景描写或游戏主持人的台词。

1. 在 **Narrator voice**(旁白声音) 里开启 **Use separate narrator voice**(使用单独的旁白声音)。
2. 选一个声音。

在 Roleplay(角色扮演) 和 Conversation(对话模式) 消息中，某一行的说话人是 Narrator、GM、Game Master 或 System 时，就会使用这个声音；Game Mode(游戏模式) 里没有指明说话人的旁白也会使用它。使用 ElevenLabs 时，请在这里选一个旁白声音。留空的话，只有设置了全局声音，旁白才会退回使用全局声音。

### 随机 NPC 声音（仅限 Game Mode）

这个功能会给 Game Mode 追踪的次要游戏角色分配备用声音。在 Roleplay 和 Conversation 里没有效果。

1. 在 **Random NPC voices**(随机 NPC 声音) 里开启 **Use default voices for random NPCs**(为随机 NPC 使用默认声音)。
2. 在 **Male NPC defaults**(男性 NPC 默认声音) 和 **Female NPC defaults**(女性 NPC 默认声音) 里勾选声音。

被追踪的 NPC(玩家之外的角色) 如果没有单独配声，会从对应的声音池里得到一个固定的选择，并在整个会话中保持不变。已指定声音的 NPC 保留那个声音。性别不明确的 NPC 从两个池子里挑选。如果应用找不到标注为男声或女声的声音，每个池子都使用完整的声音列表。

## 音频格式和语速

**Audio format**(音频格式) 可以选 **MP3**(默认) 或 **WAV**。本地服务器生成不了 MP3 时，就用 WAV。选择 ElevenLabs 时这个控件会隐藏，它始终使用 MP3。选择 xAI Voice 时控件会显示，但不起作用，因为 xAI 始终返回 MP3。

**Speed**(语速) 滑块的范围随 Source 而定：

| Source | 范围 |
| --- | --- |
| OpenAI-compatible | 0.25 到 4.0 倍 |
| PocketTTS | 兼容包装服务器上为 0.25 到 4.0。官方服务器自行控制语速。 |
| ElevenLabs | 0.7 到 1.2 倍 |
| xAI Voice | 0.7 到 1.5 倍 |

已保存的语速超出范围时，会被收到最接近的允许值。ElevenLabs 还多出两个控件：**Language**(语言)（强制指定一种语言，或保持 **Auto detect**(自动检测)）和 **Stability**(稳定性)（从更有表现力到更稳定一致）。

## 自动朗读

每个 **Auto-play** 开关都会在某一类新消息生成完毕后立刻朗读它。这些开关需要先开启 **Use text to speech**。它们默认全部关闭。

- **Roleplay messages**(Roleplay 消息)：新的 Roleplay 回复。
- **Conversation messages**(Conversation 消息)：新的 Conversation 回复。
- **Game narration**(Game 旁白)：新的 Game Mode 旁白和战斗台词。
- **Progressive playback**(渐进播放)：一条回复有多行时，第一行出来就开始播放，不必等整条回复。
- **Only read dialogues**(只朗读对白)：只朗读带引号或带标记的对白，跳过纯叙述。

自动朗读只在最新一条回复生成完毕时触发一次。重新打开聊天或滚动聊天时，不会重读旧消息。

在 Roleplay 中，主回复一保存就开始准备语音。如果开启的智能体会改写回复，例如 Prose Guardian，Marinara 会等待最终文本。

### 文本过滤和情绪提示

这些过滤选项同时适用于手动朗读和自动朗读，包括 Game 旁白和 Roleplay 说话人提取。默认跳过代码块，另外两项默认关闭。

- **Skip text inside HTML and custom tags**(跳过 HTML 及自定义标签内的文字)：移除被标签包围的文字，例如隐藏的 `<simulation>...</simulation>` 块。用于选择声音的说话人标签会保留。
- **Skip fenced code blocks**(跳过围栏代码块)。
- **Skip text inside square brackets**(跳过方括号内的文字)。

开启 **Roleplay speaker extractor**(Roleplay 说话人提取器) 后，会显示 **Enable emotion indicators**(启用情绪提示)。它会添加朗读提示，不改动对白的字词。启用情绪提示后，即使开启了 **Skip text inside square brackets**，方括号里的文字也会发送给语音服务，其中可能包含备注。要让方括号里的备注不被朗读，就关闭情绪提示，并保持跳过选项开启。较长的一行被拆开时，`[Low, steady voice, restrained urgency]` 这样的朗读提示会保持完整。已知的说话人和场景标签仍会移除。每条提示怎么用，由语音模型决定。**Use text to speech**、**Game narration** 和情绪提示都开启时，Game 的场景、队伍和战斗对白也可以带有朗读提示。

## 朗读单条消息

TTS 开启后，每条角色消息或旁白消息下方的工具栏里会出现 **Speak** 按钮（麦克风图标）。

- 点击 **Speak** 朗读这条消息。获取音频期间，按钮会显示加载状态。
- 播放时再点一次即可停止。提示文字是 **Stop speaking**。
- 没有可朗读文字的消息（比如只有一张图片）会显示 **No dialogue to speak**，并保持禁用。

消息朗读时，会出现 **Pause speaking**(暂停朗读)、**Resume speaking**(继续朗读) 和 **Restart speaking**(重新朗读) 按钮。喇叭图标按钮会打开 **Line volume**(单条音量) 滑块，范围是 0% 到 100%，默认 50。它与 Game Mode 的混音器和 Conversation 的通话音量相互独立。

如果没有成功，见[故障排查](#troubleshooting)。

## 缓存的音频片段

Marinara 会把生成的音频保存在你的浏览器里，同一句话不会生成两次。**Cached clips**(缓存片段) 面板实时显示数量和总大小。点击 **Export cached TTS clips**(导出缓存的 TTS 片段)（下载图标），可以把每个缓存片段保存为独立的音频文件。缓存会自动清理最旧的片段。应用里没有清空按钮。要清空缓存，就清除浏览器数据。

## TTS 在各个聊天模式里

- **Roleplay** 使用 **Roleplay messages** 开关和 **Speak** 控件。参见 [Roleplay 模式：入门](../roleplay/getting-started.md)。
- **Conversation** 使用 **Conversation messages** 开关和同样的控件。音频通话见 [Conversation 音频和视频通话](../conversation/calls.md)。
- **Game Mode** 使用 **Game narration** 开关。它的混音器在 **Master**、**Music**、**Sound Effects** 和 **Ambient** 旁边有一个 **TTS** 通道。这个通道设置游戏语音的音量，初始值是 100%。参见[游戏的控件](../game/getting-started.md#the-games-controls)。

### Phonetic name(通话中的读音)

如果声音念错了角色或用户角色的名字，就添加一个 **Phonetic name**(读音名)，填上它应该怎么念。在 **Character Editor** 里，它在 **Voice** 选项卡上。在 **Persona Editor**(用户角色编辑器) 里，它和基本信息字段放在一起。它只在 Conversation 的音频和视频通话中使用。**Speak**、自动朗读和 Game Mode 旁白都会忽略它。

<a id="troubleshooting"></a>

## 故障排查

- **完全没有声音**：确认 **Use text to speech** 已开启。再检查对应的 **Auto-play** 开关，或者用消息上的 **Speak**。
- **卡片显示 Missing Audio provider**：被选作 **Source** 的账号已被删除或无法使用。另选一个 Source。见[使用音频连接](#use-an-audio-connection)。
- **列表里没有声音**：在 TTS 已开启、密钥有效的状态下保存卡片，然后点击 **Refresh voices from provider**。官方 PocketTTS 服务器使用 Marinara 的内置列表。如果使用兼容的 PocketTTS 包装服务器，确认 `<Base URL>/v1/voices` 有响应。
- **ElevenLabs 不出声**：选一个真正的声音，而不是“Select an ElevenLabs voice”占位项。确认 **Model** 是语音合成模型，而不是 ID 里带 `ttv` 的声音设计模型。
- **某一句中断并提示“No audio after 60 s”**：语音服务器需要更多时间。按提示里说的位置调高 **Request timeout (seconds)**。见[请求超时](#request-timeout)。
- **本地地址上的自建服务器被拦截**：在 `.env` 里开启 `TTS_LOCAL_URLS_ENABLED`。它允许 Marinara 访问 OpenAI 兼容或 ElevenLabs 风格服务器的本地地址或内网地址。PocketTTS 不需要它。参见[服务器配置参考](../CONFIGURATION.md)。
- **快速测试**：点击卡片里的 **Preview**，用当前设置听一小段示例。

## 参考：音乐、音效和 Gacha Forge

下面几节适用于进阶设置。

<a id="game-music-and-sound-effects-on-a-compatible-audio-server"></a>

### 通过兼容音频服务器生成 Game 音乐和音效

1. 在 **Connections** 里，用 **Edit model**(编辑模型) 打开你的 **Music & Sound Effects**(音乐与音效) 账号，选择 **Custom compatible server**(自定义兼容服务器)。**Add account** 窗口里没有这类账号的按钮；它来自升级或导入（见[账号参考](../connections/providers-reference.md#music--sound-effects)）。
2. 填写音乐或音效服务器的地址、密钥和模型。
3. 设置 **Generation API format**(生成 API 格式)，并填入服务器提供的端点路径。路径留空，对应的功能就不可用。
4. 开启 **Music generation**(音乐生成)、**Sound-effect generation**(音效生成)，或同时开启两项。
5. 在 Game 设置或游戏的音频设置中选择这个账号。语音账号仍在 TTS 卡片里单独选择。

端点路径会接在账号的 Base URL 后面。例如 `http://localhost:8002/v1` 搭配 `chat/completions`，访问的就是 `/v1/chat/completions`。与其他本地兼容音频请求一样，本地 HTTP 端点需要在 `.env` 里设置 `TTS_LOCAL_URLS_ENABLED=true`。

支持两种 API 格式：

- **Prompt JSON → MP3 audio** 发送 `{ "model": "your-model", "prompt": "the requested sound", "duration": 5, "response_format": "mp3" }`，并期望收到 MP3 字节。Game 音乐使用情境曲目的时长（默认 120 秒）。音效请求 5 秒。
- **Chat Completions → inline audio (ACE-Step compatible)** 发送 `model`、一条用户 `messages`、`stream: false`，以及带有 `duration`、`instrumental: true` 和 `format: "mp3"` 的 `audio_config`。它接受来自 `choices[0].message.audio` 的内嵌 MP3，可以是包含 base64 数据 URL 的 ACE-Step 音频 URL 数组，也可以是带有 base64 `data` 的对象。参见 [ACE-Step 兼容 API 协议](https://github.com/ace-step/ACE-Step-1.5/blob/main/docs/en/Openrouter_API_DOC.md)。不支持远程结果 URL 和异步任务 API。

只开启服务器实际实现的功能。仅有 OpenAI 兼容的语音端点，并不代表支持音乐或音效。Infermatic 这类服务必须提供上述格式之一，或提供适配器。这里没有验证过它实际的音乐端点。要使用 ElevenLabs 或 SunoAPI 的原生生成，在 **Music & Sound Effects** 下选择对应的来源。见[账号参考](../connections/providers-reference.md#music--sound-effects)。

生成的情境音乐按区域或遭遇等级创作一次，之后重复使用。重复的音效使用音频缓存。生成出错后，缓存仍可用于重试。

<a id="gacha-forge-dialogue-and-audio"></a>

### Gacha Forge 对白与音频

Gacha Forge 1.11.0 及更新版本使用 TTS 卡片选中的账号及其按角色分配的声音。 - 开启 **Read character dialogue**(朗读角色对白)，就会朗读已分配声音的导入角色的对白。这个开关在新世界设置的 **Lore**(世界设定) 步骤里；已有世界则在 Gacha Forge 自己的世界设置里。旁白、想法、没有 Engine 角色 ID 的生成单位，以及没有声音的角色都保持静音。只凭名字，绝不会借用另一个角色的声音。
- 世界的 TTS 开关开启时，可以使用选中的音频账号。直接使用卡片自身的来源设置时，还必须开启 **Use text to speech**。
- Game 自带的音乐和音效不需要生成账号。要创作新曲目，在 Gacha Forge 里开启 **Generate music and sound effects**(生成音乐和音效)，并在 **Audio connection**(音频连接) 下选择一个 Music & Sound Effects 账号。它在生成开启后才会出现。主页、战斗、首领战、故事场景和角色故事的曲目在首次需要时生成，之后重复使用。这些请求使用你的服务账号。
- 右上角的静音按钮会同时静音音乐、对白和音效。Gacha Forge 的视觉设置里有这三者各自的音量控制（可以调到零），以及自动播放的暂停时长（默认 **3 秒**，在文字显示完毕且语音对白结束之后开始）。选项仍然等待玩家选择。离开场景时，语音对白会被取消。离开世界会停止它的音频。

要获得这些控件，除了 Engine，也要更新已安装的 Gacha Forge 包。

## 相关指南

- [Conversation 音频和视频通话](../conversation/calls.md)
- 适用于 2D 和 3D 虚拟形象的[配合语音合成的口型同步](../agents/avatars.md#lip-sync-with-text-to-speech)
- [Roleplay 模式：入门](../roleplay/getting-started.md)
- [Game Mode：入门](../game/getting-started.md)
- [支持的 AI 服务商](../connections/providers-reference.md)
- [创建和编辑角色](../characters/creating-and-editing-characters.md)
- [服务器配置参考](../CONFIGURATION.md)
