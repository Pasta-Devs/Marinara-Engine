# Conversation 音频和视频通话

通话是一个实时画面，类似语音聊天应用。你可以通过麦克风或打字与一个或多个角色交谈。通话进行时，它会覆盖在普通的 Conversation(对话模式) 聊天之上。通话只存在于 Conversation 模式中。

通话是一个可选包。从 **Agents → Agent Organizer**(智能体管理器) 安装 **Calls**(通话)。如果目录提示你重启，请停止 Marinara，然后按你平常的方式再次启动（参见[安装指南](../INSTALLATION.md)）。

通话中，已配置可用的语音合成（TTS，即把文字转换为语音）声音的角色会开口说话。没有声音的角色会在通话聊天中以文字消息回复。你也可以用循环播放的 AI 生成视频片段代替静态头像来展示角色。

Marinara 在你的浏览器中录制麦克风或摄像头。根据下文的输入模式，你的语音会在你自己的电脑上转换为文字，或发送给你为该聊天选择的模型。回复通过你的语音合成服务朗读出来。通话结束时，一段简短的摘要会回到 Conversation 中。完整的记录则保存在单独的通话存储中。

## 所需条件

- 已安装 **Calls**。
- 一个至少有一个角色的 Conversation 聊天，以及一个用于撰写回复的模型账号。
- 在聊天设置中开启 **Audio/Video Calls**(音视频通话) 和 **Call Audio Pipeline**(通话音频管线)。
- 可选：语音合成账号，让角色开口说话。没有它，角色会以文字回复。
- 可选：默认的麦克风模式需要一次性下载 Local Whisper（参见[下载 Local Whisper](#download-local-whisper)）。你也可以改为在通话聊天中打字。

## 设置你的第一次通话

**开始之前：** 你需要一个至少有一个角色的 Conversation 聊天，以及一个用于撰写回复的模型账号（参见[连接 AI 服务商](../connections/connecting-to-a-provider.md)）。

1. 可选：设置语音合成（参见[设置语音合成](#set-up-text-to-speech)）。没有它，每个角色都只能以文字参与通话。
2. 打开聊天，然后打开 **Chat Settings → Agents → Calls**。
3. 开启 **Audio/Video Calls**。聊天名称旁边会出现一个通话按钮。
4. 开启 **Call Audio Pipeline**。没有它，任何通话都无法开始，即使你只打字或只听也一样。它还会启用麦克风。
5. 选择一个 **Audio input mode**(音频输入模式)（见下文）。
6. 点击 **Start call**(开始通话)。

如果没有成功：如果看到 “Conversation call audio is not enabled in Chat Settings”，说明 **Call Audio Pipeline** 已关闭。它是全局设置，因此在一个聊天中开启它，就会对所有 Conversation 通话生效。

对于新聊天，请先完成设置向导，然后打开该聊天的 **Chat Settings**。只有安装了 Calls，通话设置才会显示。

有两个开关看起来相似，但作用不同：

- **Audio/Video Calls** 会显示通话按钮，让你可以给角色打电话。
- **Calls** 命令让角色可以先给你打电话。关闭它后，你仍可以自己发起通话。

同一区域中的总开关 **Commands** 必须开启，通话中的命令才能使用。通话本身即使在它关闭时也能开始。

<a id="set-up-text-to-speech"></a>
### 设置语音合成

语音合成决定哪些角色能开口说话，以及使用哪种声音。完整步骤请阅读 [Text to Speech (TTS) 设置](../media/tts-setup.md)。简而言之，打开 **Connections**，点击 **Add account**(添加账号)，然后选择 **Text to speech**。如果它已列在 **On this device**(在你的电脑上) 下，就直接在那里打开它。然后：

1. 开启语音合成。
2. 选择来源：**OpenAI-compatible**、**ElevenLabs**、**PocketTTS** 或 **xAI Voice**。
3. 输入该来源的 API 密钥或本地服务器地址。
4. 选择模型和声音。
5. 把 **Voice option**(声音选项) 设为 **One voice for all**（所有角色同一声音）或 **Selected per character or persona**（按角色或用户角色单独选择）。为每个角色单独配声，可以让群组通话更容易听清。
6. 保存，然后使用预览按钮，确认你能听到声音。

如果某个角色没有 Marinara 能解析的声音，该角色在本次通话中只能以文字参与。

### 选择音频输入模式

开启 **Call Audio Pipeline** 后，会显示 **Audio input mode** 列表。如果你不确定，请保持默认值。

| 模式 | 作用 |
| --- | --- |
| **Mic recording + Local Whisper**(默认) | 在你未静音时录音，忽略静音部分，并在你自己的电脑上把语音转换为文字。最适合 Firefox。 |
| **Browser speech recognition** | 使用浏览器内置的语音识别工具。支持情况因浏览器而异。如果缺少该工具，Marinara 会退回到 Local Whisper。 |
| **Manual system dictation** | 只把光标放在通话文本框中，让操作系统的听写功能可以在那里输入文字。Marinara 不录音。 |
| **Provider-native audio/video** | 如果模型支持媒体输入，就把你录制的音频或视频直接发送给模型。 |

摄像头和屏幕按钮需要开启 **Camera and screen input**(摄像头与屏幕输入)，并且只在 **Provider-native audio/video**(服务商原生音视频) 模式下可用。在其他模式下，它们会显示，但保持禁用。

## 发起、接听和结束通话

**发起通话。** 开启通话后，聊天名称旁边会有一个电话按钮。它的提示文字是 **Start call**(开始通话)，通话进行中则显示 **Open call**(打开通话)。点击它，通话界面就会打开。每个聊天同一时间只能有一个进行中或正在响铃的通话。再次发起通话会重新打开当前通话。

**接听通话。** 开启 **Calls** 命令后，角色可以给你打电话。在该聊天中，消息框上方会出现一条 **Incoming call**(来电) 横幅，其中有 **Decline call**(拒接) 和 **Answer call**(接听)。在 Marinara 的其他位置，你会收到来电通知和一段短促的铃声。Marinara 绝不会替你接听。只有可用的角色才会加入：日程或状态为离线的角色则不会加入。

**结束通话。** 点击通话界面或最小化弹窗上的红色 **End call**(结束通话) 按钮。角色也可以通过通话中的命令离开或结束通话。之后，Marinara 会停止录音，并在 Conversation 中添加一张卡片。

## 通话界面

舞台区为每位参与者显示一个方块，包括你的用户角色和每个可用的角色，并高亮正在说话的人。通话聊天中保存打字消息和纯文字回复。语音内容不会在那里重复。在电脑上，它是侧边面板。在手机上，它会以抽屉的形式打开，通过 **Open call chat**(打开通话聊天) 打开，并通过 **Close call chat**(关闭通话聊天) 关闭。

通话输入区有 **Message in call**(通话中的消息) 输入框、**Send**(发送) 按钮、emoji、GIF 和贴纸选择器，以及快速模型切换器。通话聊天不支持文件附件。

| 控件 | 作用 |
| --- | --- |
| 麦克风 | 让你静音或取消静音。提示文字会随模式变化，例如 **Unmute microphone with Local Whisper**（使用 Local Whisper 取消麦克风静音）。 |
| **Turn camera on** / **Turn camera off** | 仅在服务商原生音视频模式且开启 **Camera and screen input** 时可用。 |
| **Share screen** / **Stop sharing screen** | 与摄像头的规则相同。 |
| **Character volume** | 一个静音按钮和一个 0 到 100 的滑块。默认值为 100，保存在浏览器中。 |
| **Soundboard** | 一个音效列表，带有 **Upload**(上传) 控件。 |
| **End call** | 红色的挂断按钮。 |

如果你静音一段时间，会看到提示：“You are muted! Remember to unmute yourself first if you want to talk.”

如果你在通话期间离开 Conversation，它会缩小为一个浮动弹窗，显示聊天名称、已通话时长和 **End call**。点击弹窗即可返回。你浏览其他页面时，通话会继续进行。

### 音效板

音效板有四个内置音效，无法删除：**Soft Chime**、**Tap**、**Sparkle** 和 **Pop**。点击 **Upload** 可以添加你自己的音效（mp3、wav、ogg、webm 或 m4a 格式，每个最大 8 MB）。你可以删除自己上传的音效。角色可以使用音效板命令播放音效。

## Character Video Presence

这一部分是可选的高级功能。**Character video presence** 会用角色的循环 AI 生成片段，替换静态头像方块。它默认关闭。开关位于 **Chat Settings → Agents → Calls** 中。

**开始之前：** 在 **Connections** 中添加一个视频生成账号，并将其设为 **Default for Videos**，或每次手动选择。

1. 打开角色编辑器或用户角色编辑器。
2. 打开 **Sprites**(立绘) 选项卡，然后打开 **Clips**(片段) 子选项卡。
3. 点击 **Generate Clips**(生成片段)，或点击 **Upload extra**(额外上传) 添加你自己的片段。
4. 在 **Generate Call Clips** 窗口中，选择一个 **Video Generation Connection**(视频生成连接)，并选择 **Use avatar as reference**(使用头像作为参考)。
5. 选择要制作的标准片段：**Idle**（待机）、**Talking**（说话）、**Laughing**（大笑）、**Angry**（生气）、**Crying**（哭泣）和 **Sighing**（叹气）。你也可以用 **Clip name**(片段名称) 和一段动作描述，定义一个自定义片段。

角色说话时，Marinara 会读取一行中的语音提示（例如 `[sighs]`），选择匹配的反应片段，然后回到 Idle。缺少片段绝不会阻碍通话：角色会显示静态头像。经过裁剪的片段会在其裁剪范围内循环播放。参见[角色立绘（表情和全身）](../characters/sprites.md)。

开启 **Character video presence** 后，它下方还会出现两个开关：

- **Automatic video clips generation**（默认关闭）只会为需要的参与者制作 **Idle** 和 **Talking**。反应片段和自定义片段从不会自动生成。
- **Custom clips**（默认关闭）允许角色在通话中偶尔请求一次性片段，并重播已准备好的自定义片段。它用于特殊请求，而不是每种情绪都用。

关闭 **Character video presence** 也会同时关闭这两个开关。这里的片段是可重复使用的呈现循环，而不是 Gallery 中的 **Videos**(视频)（那里保存的是场景视频）。

## 语音识别设置（高级）

只有在使用 **Mic recording + Local Whisper** 模式，或你想使用自己的语音识别服务器时才需要。

<a id="download-local-whisper"></a>
### 下载 Local Whisper

Local Whisper 会在运行 Marinara 的电脑上把你的语音转换为文字，因此麦克风音频不会为了转录而离开这台电脑。文字仍会作为通话的一部分发送给你的模型。对于语音支持较弱的浏览器（例如 Firefox），这是最可靠的麦克风路径。

**开始之前：** 安装 Calls。没有它，本节会隐藏。

1. 打开 **Connections**，在 **On this device** 下找到 **Speech to text**(语音识别)。如果没有列出，请点击 **Add account**，然后选择 **Speech to text**。
2. 在该页面找到 **Local speech model**(本地语音模型)。
3. 选择一个模型：
   - **Whisper Tiny (Multilingual)**：下载约 180 MB，占用约 350 MB 内存。最适合手机和较旧的电脑。
   - **Whisper Base (Multilingual)**：下载约 320 MB，占用约 650 MB 内存。对不清晰的语音效果更好。
4. 点击 **Download Whisper**(下载 Whisper)，然后等待进度条完成。
5. 使用 Calls 之前，请彻底重启 Marinara。

垃圾桶图标 **Delete Local Whisper**(删除 Local Whisper) 会删除该模型。卸载 Calls 也会删除已下载的 Whisper 模型；重新安装时，除非你再次选择，否则不会重新下载。

如果没有成功：在 Marinara 的 Lite 版本中，你会看到：“Local Whisper is disabled in Lite mode. Use a full Marinara install to download and run the local speech model.” 如果你看到关于 “native ONNX runtime” 的提示，说明你的平台缺少语音引擎。请使用运行 Marinara 时所用的同一 Node 版本重新安装依赖，然后重启。

<a id="use-your-own-speech-to-text-server"></a>
### 使用你自己的语音识别服务器

如果 Local Whisper 对你的语言或口音识别不佳，可以改为把语音发送到另一个语音识别服务器。只要接受 OpenAI 语音识别格式（即 `/audio/transcriptions` 地址）的服务器都可以使用，无论是你自己架设的，还是 OpenAI、Groq 等服务。

1. 打开 **Connections**，并打开 **On this device** 下的 **Speech to text**。如果没有列出，请点击 **Add account**，然后选择 **Speech to text**。未安装 Calls 时，它会隐藏。
2. 输入 **Server URL**（服务器地址），例如 `http://localhost:8000/v1`。
3. 如果服务器需要，请输入 **API key**(API 密钥)。它会加密保存，并以掩码方式显示。
4. 输入服务器使用的 **Model**(模型) 名称。留空则发送 `whisper-1`。
5. 可选：输入 **Language**(语言) 代码，例如 `pl` 或 `de`。留空则由服务器自行检测。
6. 点击 **Test**(测试)。Marinara 会发送一段一秒钟的静音片段。你会看到 “The server answered.” 或 “The test failed.”
7. 开启 **Use your own speech-to-text server**(使用你自己的语音识别服务器)。

开启后，**Mic recording + Local Whisper** 会把你的语音发送到该服务器，你无需下载 Local Whisper。你的音频会发送到该服务器，因此请使用你信任的服务器。

同一台电脑上的服务器可以直接使用。网络中另一台电脑上的服务器会被拒绝，除非你在 `.env` 中设置 `STT_LOCAL_URLS_ENABLED=true`（参见[服务器配置参考](../CONFIGURATION.md)）。

如果没有成功：请阅读 **Test** 下方的消息。“Could not reach the speech-to-text server” 表示地址错误或服务器已关闭。提到 `STT_LOCAL_URLS_ENABLED` 的消息表示服务器位于另一台电脑上。数字来自你的服务器：401 通常表示 API 密钥错误，404 表示地址或模型名称错误。如果通话仍在使用 Local Whisper，请从 **Agents → Agent Organizer** 更新 Calls。

## 设置与默认值

**Per chat**(按聊天) 设置只作用于一个聊天。**Global**(全局) 设置作用于每一次 Conversation 通话。

| 设置 | 范围 | 默认值 |
| --- | --- | --- |
| **Audio/Video Calls** | 按聊天 | 关闭 |
| **Calls**(命令) | 按聊天 | 开启 |
| **Generate voice cues in [tags]** | 按聊天 | 开启 |
| **Call Audio Pipeline** | 全局 | 关闭 |
| **Audio input mode** | 全局 | Mic recording + Local Whisper |
| **Camera and screen input** | 全局 | 关闭 |
| **Character video presence** | 全局 | 关闭 |
| **Automatic video clips generation** | 全局 | 关闭 |
| **Custom clips** | 全局 | 关闭 |

在一个聊天中更改的全局设置，会对每一次 Conversation 通话生效。**Generate voice cues in [tags]**（在 [标签] 中生成语音提示）会要求模型在语音内容中加入简短提示，例如 `[whispering]`、`[laughing]` 或 `[sighs]`。这些提示会影响语音合成读取该行的方式，并帮助选择反应片段。关闭它可以让语音内容保持平实。

## 通话中的命令

角色在通话中使用的隐藏命令，与普通消息中的相同。每个命令都需要在 **Chat Settings → Agents → Commands** 中开启其开关，并且总开关 **Commands** 也要开启。参见[选择角色可以使用的命令](getting-started.md#choose-which-commands-a-character-can-use)。这些命令会静默运行，绝不会被说出来。

通话中还有两个额外功能：**Soundboard**（音效板，角色播放一段音效），以及离开或结束（角色离开通话，或为所有人结束通话）。**Notes** 和 **Influence** 只有在聊天中有连接的聊天时才会出现（参见[把 Conversation 聊天连接到 Roleplay 或 Game](../chats/connected-chats.md)）。自拍需要 **Selfie model**（参见[自拍](selfies.md)）。有些命令会在通话聊天中添加一条小记录，例如附带图片的 “sent a selfie”。

## 通话结束摘要

通话结束时，Conversation 中会出现一张卡片。卡片标题为 **Call Started**（通话开始）、**Incoming Call**（来电）、**Call Ended**（通话结束，并附带时长）、**Call Declined**（已拒接）或 **Missed Call**（未接来电）。在 **Call Ended** 之后，如果发生了任何有意义的事情，Marinara 会在后台写一段简短摘要，并将其作为隐藏上下文添加，供模型读取。这样模型能了解通话情况，而不会把它复制到可见的聊天中。

## 故障排查

| 症状 | 解决方法 |
| --- | --- |
| 角色听不到我说话 | 确认 **Call Audio Pipeline** 已开启，并且浏览器允许 Marinara 页面使用麦克风。在 Firefox 上，或浏览器语音不工作时，请下载 Local Whisper，并使用 **Mic recording + Local Whisper**。 |
| 浏览器语音选项没有任何反应 | Firefox 不具备 Chromium 和 Safari 等浏览器所有的 Web Speech 语音识别功能。请使用 **Mic recording + Local Whisper**，或 **Manual system dictation**。 |
| 角色只打字不说话 | 检查语音合成设置和声音分配。参见 [Text to Speech (TTS) 设置](../media/tts-setup.md)。 |
| 模型听错了我说的话 | 请尝试 **Whisper Base (Multilingual)**、减少噪音，或在模型支持时使用 **Provider-native audio/video**。对于 Whisper 处理不佳的语言，请[使用你自己的语音识别服务器](#use-your-own-speech-to-text-server)，并设置其 **Language**。 |
| 摄像头或屏幕按钮是禁用的 | 请使用 **Provider-native audio/video** 模式，并开启 **Camera and screen input**。你的模型也必须接受摄像头或屏幕输入。 |
| 角色通话中途不回复了 | 检查该聊天的模型账号，然后在通话聊天中重新发送消息。 |
| 手机上通话用不了 | 通话聊天通过 **Open call chat** 打开。要说话，请确认已设置语音合成。麦克风的 Local Whisper 和权限步骤同样适用。 |

## 相关指南

- [Text to Speech (TTS) 设置](../media/tts-setup.md)
- [本地模型设置](../connections/local-model.md)
- [角色立绘（表情和全身）](../characters/sprites.md)
- [Conversation 模式：入门](getting-started.md)
