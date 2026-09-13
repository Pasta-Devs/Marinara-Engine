# Text to Speech (TTS) 设置

本指南介绍如何在 Marinara Engine 里配置 Text to Speech(语音合成)，让应用把消息和游戏旁白朗读出来。Text to Speech (TTS) 就是把聊天里的文字变成语音。下面会讲怎么挑选语音服务商、怎么选声音、怎么设置自动朗读，以及每条消息上的播放控件。

## TTS 设置在哪里

几乎所有 TTS 设置都集中在同一个地方。打开 **Connections**(连接) 面板，找到 **Text to Speech** 卡片。这张卡片默认是收起的，点击标题栏即可展开。

TTS 请求由应用自己的服务器转发。服务商的 API 密钥会加密保存在服务器上。保存密钥之后，输入框里显示的是一串圆点，不是真正的密钥。真正的密钥不会回传到浏览器。

开启 TTS 并不会让应用自己开口。它只是让每条消息上的 **Speak**(朗读) 按钮和 **Auto-play** 选项显示出来。读什么、什么时候读，仍然由你决定。

同一组播放设置还提供**Skip text inside HTML and custom tags**(跳过HTML及自定义标签内的文字)、**Skip fenced code blocks**(跳过围栏代码块)和**Skip text inside square brackets**(跳过方括号内的文字)。默认跳过代码块，另外两个过滤选项默认关闭。标签过滤会移除标签包围的文字，例如隐藏的`<simulation>...</simulation>`块，但会保留用于选择语音的说话人标签。这些过滤选项同时适用于手动播放和自动播放，包括Game旁白及Roleplay说话人提取。

## 第 1 步：开启 TTS 并选择 Source

1. 打开 **Connections** 面板，展开 **Text to Speech** 卡片。
2. 点击卡片标题栏里的开关，把 TTS 打开。把鼠标停在开关上会看到提示：关闭状态显示 **Enable TTS**，开启状态显示 **Disable TTS**。
3. 打开 **Source** 下拉菜单，选择服务商。

**Source**(语音来源) 就是负责生成音频的服务。一共有四个选项：

- **OpenAI-compatible**：OpenAI，或任何兼容 OpenAI TTS 格式的服务器。
- **ElevenLabs**：ElevenLabs 语音服务。
- **PocketTTS**：一个在自己电脑上运行的免费语音服务器。
- **xAI Voice**：xAI 的语音服务。

默认的 Source 是 **OpenAI-compatible**。Marinara 会为每个 Source 单独保存一套配置，包括加密的 API 密钥、接口地址、模型、声音和服务商参数。切换 Source 时会恢复该 Source 上次的配置；还没配置过的 Source 则使用它自己的默认值。

## 第 2 步：填写 Base URL、API Key 和 Model

每个 Source 都需要一个网址，大多数还需要 API 密钥。API 密钥是服务商发给你的一串秘密字符，用来证明这个请求是你发出的。

1. 检查 **Base URL**(基础 URL) 输入框。每个 Source 都会自动填入合适的默认值，见下表。只有使用代理或自建服务器时才需要改动。
2. 把服务商密钥粘贴到 **API Key** 输入框。想保留已有密钥，就让那串圆点原样留着。想删掉已保存的密钥，清空这个输入框即可。
3. 检查 **Model** 输入框。每个 Source 都会填入一个默认模型。也可以手动输入服务商支持的其他模型名。

应用为各个 Source 预填的默认值如下：

| Source            | 默认 Base URL             | 默认 Model             | 应用预填的默认声音              |
| ----------------- | ------------------------- | ---------------------- | ------------------------------- |
| OpenAI-compatible | https://api.openai.com/v1 | tts-1                  | alloy                           |
| ElevenLabs        | https://api.elevenlabs.io | eleven_multilingual_v2 | 无（必须自己选一个）            |
| PocketTTS         | http://localhost:49112    | pocket-tts             | alba                            |
| xAI Voice         | https://api.x.ai/v1       | grok-tts               | eve                             |

选择 **ElevenLabs** 时，**Model** 输入框会加载当前连接可用的语音合成模型，并且每次打开都会完整显示整个列表。请选择普通的语音合成模型。模型 ID 里带 `ttv` 的是声音设计模型，不是语音合成模型，无法朗读文字。选错了的话，播放会失败，并提示改用语音合成模型。

### PocketTTS 是一个独立程序

PocketTTS 并没有内置在 Marinara Engine 里。Marinara 的适配层对接的是 [PocketTTS OpenAI-compatible server](https://github.com/teddybear082/pocket-tts-openai_streaming_server)，它同时提供了 Marinara 需要的语音合成接口和声音列表接口。请按照该项目的说明自行安装并运行这个服务器，Marinara 不会替你下载或管理它。

这个兼容服务器默认使用 `http://localhost:49112`。除非改过服务器端口，否则 **Base URL** 保持这个值就行。之前自定义过的 PocketTTS 地址不会被改动。

## 第 3 步：选择声音（Voice Option）

**Voice Option**(声音分配方式) 决定声音如何分配：

- **One voice for all characters**：所有说话人使用同一个声音。这是默认设置。
- **Selected per character**：给指定角色单独指定声音。

### 所有角色共用一个声音

在 **All Characters Voice** 输入框里选择声音。PocketTTS 会在下拉菜单里列出服务器返回的声音，旁边还留了一个文本框，可以填自定义的声音 ID、URL 或路径。

想从服务商那里加载真实的声音列表，先填好连接信息，再点击 **Refresh voices**(刷新声音列表) 按钮（圆形箭头图标）。这一步可以在开启播放之前做。刷新前会先保存当前卡片，所以刚填的 API 密钥会立刻生效。连接成功之前，应用会显示一份简短的内置备用列表，让输入框不至于是空的。如果服务商返回错误，应用会直接报错，而不会把备用列表伪装成刷新成功的结果。

选择 **ElevenLabs** 时必须自己指定一个声音。Marinara 会分页加载账号的完整声音库，包括个人声音、工作区声音、收藏声音和默认声音。选择器带搜索框；声音库比面板长时，滚动条会始终显示。它还会告诉你一共加载了多少个声音。选择器初始状态是“Select an ElevenLabs voice”，在真正选中一个声音之前无法播放。

### 给指定角色单独指定声音

1. 把 **Voice Option** 设为 **Selected per character**。
2. 界面上会出现 **Character Voices** 表格，包含 **Character** 和 **Voice** 两列。
3. 点击 **Add character voice** 添加一行。
4. 在左边的下拉菜单里选角色，在右边的下拉菜单里选声音。
5. 每个需要单独配声的角色重复一次。

Character Voices 区域里的 **Refresh** 按钮会重新加载同一份服务商声音库，不需要切回共用声音模式。前提是角色已经建好。一个角色都没有时，应用会提示先去 Characters 选项卡添加角色，再来分配声音。没有单独配声的角色会使用全局声音。参见[创建和编辑角色](../characters/creating-and-editing-characters.md)。

## Narrator Voice

旁白指的是不属于任何具体角色的文字，比如场景描写或者游戏主持人的叙述。可以给它单独配一个声音。

1. 在 **Narrator Voice**(旁白声音) 区域打开 **Use separate narrator voice**。
2. 在随后出现的选择器里选一个声音。

当某一行的说话人是 Narrator、GM、Game Master 或 System 时，应用就会用这个声音。Roleplay 和 Conversation 的消息都适用，Game Mode 里没有指明说话人的旁白同样适用。使用 ElevenLabs 时，请在这里指定一个旁白声音。留空的话，只有设置了全局声音，旁白才会退回去用全局声音。

## Random NPC Voices(仅限 Game Mode)

这个功能会给次要的游戏角色随机分配备用声音。它只在 Game Mode 里生效，而且只作用于 Game Mode 追踪的 NPC(玩家之外的角色)。在 Roleplay 和 Conversation 里没有任何效果。

1. 在 **Random NPC Voices**(随机 NPC 声音) 区域打开 **Use default voices for random NPCs**。
2. 界面上会出现两组复选框：**Male NPC defaults** 和 **Female NPC defaults**。
3. 勾选每个声音池可以抽取的声音。

被追踪的 NPC 如果没有单独配声，就会从对应的声音池里拿到一个固定的结果。同一个 NPC 在一次会话里始终使用同一个声音。已经指定过角色声音的 NPC 永远保留那个声音。如果应用识别不出带男声、女声标记的声音，两个池子都会改用完整的声音列表。

## Audio Format 和 Speed

**Audio Format**(音频格式) 可以选 **MP3**(默认) 或 **WAV**。本地或自建服务器生成不了 MP3 时，就用 WAV。两点说明：

- 选择 ElevenLabs 时 **Audio Format** 控件会隐藏，它始终使用 MP3。
- 选择 xAI Voice 时控件会显示，但不起作用。xAI Voice 返回的始终是 MP3。

**Speed**(语速) 滑块控制说话的快慢。可用范围随 Source 变化：

- OpenAI-compatible 和 PocketTTS：正常语速的 0.25 到 4.0 倍。
- ElevenLabs：0.7 到 1.2 倍。
- xAI Voice：0.7 到 1.5 倍。

如果保存的语速超出了当前 Source 的范围，应用会在朗读时把它收到最接近的合法值。

只有选择 **ElevenLabs** 时，才会多出两个控件。**Language** 可以强制指定朗读语言，也可以保持 **Auto detect**。**Stability** 用来在“更有表现力”和“更稳定一致”之间调节。

## Auto-play：自动朗读消息

**Auto-play**(自动朗读) 标题下的每个开关，都让应用在某一类新消息生成完毕后立刻朗读它。这些开关都需要先打开 **Enable TTS**。所有开关默认都是关闭的。

- **Roleplay messages**：朗读新的 Roleplay 回复。
- **Conversation messages**：朗读新的 Conversation 模式回复。
- **Game narration**：朗读新的 Game Mode 旁白和战斗描述。
- **Progressive playback**：一条回复包含多行时，第一行出来就开始播，不必等整条回复写完。
- **Only read dialogues**：只朗读带引号或带标记的对白，跳过纯叙述部分。

自动朗读只在最新一条回复生成完毕的那一刻触发一次。重新打开聊天或者往回滚动时，不会重读旧消息。

## 朗读单条消息

TTS 开启之后，每条角色消息或旁白消息下方的工具栏里会出现 **Speak** 按钮（麦克风图标），点一下就朗读这一条。

- 点击 **Speak** 开始朗读。获取音频期间，按钮会显示加载状态。
- 播放过程中再点一次即可停止。消息正在播放时，提示文字是 **Stop speaking**。
- 没有可朗读文字的消息（比如只有一张图），会显示 **No dialogue to speak** 并保持禁用状态。

消息正在朗读时，还会多出两个按钮。**Pause speaking** 和 **Resume speaking** 用来暂停和继续播放。**Restart speaking** 让这条消息从头重播。

喇叭图标的按钮会展开 **Line volume**(单条音量) 滑块，范围是 0% 到 100%，默认 50%。这个音量是独立保存的设置，和 Game Mode 的混音器、Conversation 的通话音量互不相干，改一个不会影响另外两个。

## 缓存的音频片段

应用会把生成好的音频存在浏览器里，同一句话不用生成两次。**Cached clips**(缓存片段) 面板会实时显示数量和总体积。

点击 **Export cached TTS clips**(导出缓存的 TTS 片段) 按钮（下载图标），可以把每个缓存片段作为独立的音频文件保存到设备上。缓存会自动清理最旧的片段。应用内没有手动清空按钮，想彻底清空就去清除浏览器数据。

## TTS 在各个聊天模式里的表现

同一套 TTS 配置服务于所有模式，各模式另有一些补充：

- Roleplay 使用 **Roleplay messages** 自动朗读开关，以及每条消息上的 **Speak** 控件。参见 [Roleplay 模式：入门](../roleplay/getting-started.md)。
- Conversation 模式使用 **Conversation messages** 开关和同样的 **Speak** 控件。语音通话是一个更大的功能，详见 [Conversation 音频和视频通话](../conversation/calls.md)。
- Game Mode 使用 **Game narration** 开关。Game Mode 还有自己的音频混音器，**TTS** 通道和 **Master**、**Music**、**Sound Effects**、**Ambient** 并列。这个通道控制游戏语音的整体音量，初始值是 100%。参见 [Game Mode：入门](../game/getting-started.md)。

## Phonetic name(通话中的读音)

如果某个角色或用户角色的名字写法容易被念错，可以填一个 **Phonetic name**(读音名)。在 **Character Editor** 里，这个输入框紧挨着角色的 **Name** 输入框；在 **Persona Editor** 里，它和其他基本信息输入框放在一起。填上名字应该念成什么样就行。

这个读音设置只在 Conversation 的语音和视频通话中生效。普通的逐条消息 **Speak** 按钮、聊天自动朗读和 Game Mode 旁白都不会读这个字段。

## 故障排查

- 完全没有声音：先确认 **Enable TTS** 开关已打开，再检查对应模式的 **Auto-play** 开关，或者直接用消息上的 **Speak** 按钮。**Speak** 按钮和自动朗读选项只有在 TTS 开启后才会出现。
- 下拉菜单里没有声音：在 TTS 已开启、API 密钥有效的状态下保存卡片，然后点击 **Refresh voices**。使用 PocketTTS 时，还要确认兼容服务器的 `<Base URL>/v1/voices` 有响应。
- ElevenLabs 不出声：确认选中的是一个真正的声音，而不是“Select an ElevenLabs voice”占位文字。同时检查 **Model** 是语音合成模型，而不是 ID 里带 `ttv` 的声音设计模型。
- 本地地址上的自建 TTS 服务器被拦截：打开服务器设置 `TTS_LOCAL_URLS_ENABLED`。它允许应用访问 OpenAI 兼容或 ElevenLabs 风格服务器的本地地址和内网地址。PocketTTS 不需要这个设置。参见[服务器配置参考](../CONFIGURATION.md)。
- 想快速验证配置：点击卡片里的 **Preview**(预览) 按钮，用当前设置播放一小段示例语音。

## 相关指南

- [Conversation 音频和视频通话](../conversation/calls.md)
- [Roleplay 模式：入门](../roleplay/getting-started.md)
- [Game Mode：入门](../game/getting-started.md)
- [支持的 AI 服务商](../connections/providers-reference.md)
- [创建和编辑角色](../characters/creating-and-editing-characters.md)
- [服务器配置参考](../CONFIGURATION.md)
