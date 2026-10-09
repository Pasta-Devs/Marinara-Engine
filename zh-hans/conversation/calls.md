# Conversation 音频和视频通话

本指南介绍 Marinara Engine 里的 Conversation 通话，包括通话的原理、配置步骤、通话中怎么交流，以及常见问题的解决办法。

通话只存在于 Conversation(对话模式)。Roleplay 和 Game 聊天没有通话界面。

Calls 是一个可选的智能体包。按下面的步骤配置之前，先从 **Agents → Download Agents**(智能体 → 下载智能体) 安装 **Calls**，目录提示时重启 Marinara。

## 通话是什么

通话会打开一个 Discord 风格的实时界面，可以在里面和一个或多个角色交谈。通话进行期间，这个界面浮在普通的 Conversation 聊天之上。

通话过程中：

- 配好可用 Text to Speech (TTS) 语音的角色会把台词念出来。TTS 就是把文字变成语音。
- 没有语音的角色则在通话聊天里以文字消息回复。
- 你可以用麦克风说话，也可以打字。
- 还可以让角色显示 AI 生成的循环视频片段，代替静态头像。

通话不是点对点的电话。Marinara 采集本地浏览器的麦克风或摄像头，把这些输入发给该 Conversation 选定的模型，再通过 TTS 服务商把回复读出来。通话数据全部存在自己的机器上。

通话结束后，Marinara 会把一段简短的通话摘要写回普通的 Conversation。完整的通话记录留在单独的通话存储里，不会逐条复制到主聊天中。

## 开始之前

想跑通一次语音通话，按顺序准备好下面几项。标了“可选”的步骤可以跳过。

1. 一个 Conversation 模式的聊天，里面至少有一个角色。
2. 为这个聊天选好一个普通的模型连接。通话中角色的回复就由这个模型生成。
3. 为该聊天开启 **Audio/Video Calls**(音视频通话)（见下文“为聊天开启通话”一节）。
4. 开启 **Call Audio Pipeline**(通话音频管线)。任何通话都需要它，哪怕你只打字或只听。它同时也负责麦克风输入。
5. 配置 Text to Speech，角色才能说话。没配的话，所有角色都只能发文字。
6. 可选：浏览器的语音识别不够可靠时（Firefox 就是这样），装好 Calls 之后从 Connections 下载 Local Whisper。也可以不用 Local Whisper，改用你自己的语音识别服务器。
7. 可选：想用 **Character Video Presence**(角色视频形象)，还需要一个视频连接和生成好的片段。
8. 可选：想让角色在通话里发自拍，需要为聊天的 Selfie Connection(自拍连接) 设置一个图像连接。

### 配置 Text to Speech

Text to Speech 决定哪些角色能说话，以及各自用什么声音。它是多处共用的功能，所以单独有一篇指南。

完整步骤见 [Text to Speech (TTS) 设置](../media/tts-setup.md)。简单说，打开 **Connections**(连接)，再打开 **Text to Speech**，然后：

1. 开启 Text to Speech。
2. 选择一个来源：**OpenAI-compatible**、**ElevenLabs**、**PocketTTS** 或 **xAI Voice**。
3. 填入该来源的服务商密钥或本地服务器地址。
4. 选一个模型和一个声音。
5. 把 **Voice Option** 设为 **One voice for all characters** 或 **Selected per character**。
6. 保存，然后用预览按钮确认能听到声音。

多人通话时，给每个角色分别配音更容易分辨谁在说话。如果 Marinara 找不到某个角色可用的声音，这个角色在通话里就只能发文字。

### 选择麦克风输入模式

开启 **Call Audio Pipeline** 后，会出现一个 **Audio input mode**(音频输入模式) 下拉菜单，共四个选项。挑一个适合自己浏览器和服务商的。

- **Mic recording + Local Whisper**：取消静音期间录音，自动忽略静默，并在本机把语音转成文字。这是默认选项，也是 Firefox 上的最佳选择。
- **Browser speech recognition**：使用浏览器自带的 Web Speech 功能。Web Speech API 是浏览器内置的语音转文字工具。各浏览器的支持程度不一，缺失时 Marinara 会回退到 Local Whisper。
- **Manual system dictation**：只把光标放进通话输入框，让操作系统的听写功能往里打字。这个模式下 Marinara 自己不录麦克风。
- **Provider-native audio/video**：在模型本身能直接接收媒体时，把录下的音频或视频直接发给 Conversation 模型。模型做不到的话，改用 Local Whisper 或浏览器语音识别。

只有开启 **Camera and screen input**(摄像头和屏幕输入) 后，摄像头和屏幕按钮才会出现，而且只在 **Provider-native audio/video** 模式下可用。其他模式里按钮虽然可见，但一直是禁用状态。

### 下载 Local Whisper

Local Whisper 在运行 Marinara 的机器上把语音转成文字。麦克风音频不会为了转写离开这台机器。转出来的文字仍会作为通话内容发给 Conversation 模型。

Local Whisper 属于 Calls 包。对于语音支持较弱的浏览器（包括 Firefox），它是最可靠的麦克风方案。装好 Calls 之后，打开 **Connections**，打开 **Local Model**，展开卡片，找到 **Local Speech Model**。没装 Calls 时这一节不会显示。关于 Local Model 卡片的通用说明，见[本地模型设置](../connections/local-model.md)。

1. 选一个模型。默认是 **Whisper Tiny (Multilingual)**，下载约 180 MB，运行时占用约 350 MB 内存。手机和老机器首选它。
2. 想在语音比较杂乱时获得更好的准确率，可以改选 **Whisper Base (Multilingual)**，下载约 320 MB，占用约 650 MB 内存。
3. 点击 **Download Whisper**。
4. 等进度条走完。

下载完成后会出现 **Delete Local Whisper**(垃圾桶图标)，需要时可以用它删掉模型。

卸载 Calls 会连带删掉所有下载过的 Whisper 模型和保存的选择，模型占用的磁盘空间也会释放。重新安装 Calls 会恢复下载按钮，但在你重新选择之前不会自动下载模型。

<a id="use-your-own-speech-to-text-server"></a>

### 使用自己的语音识别服务器

如果 Local Whisper 对你的语言或口音识别得不好，可以把录下的语音改发给另一个语音识别模型。任何提供 OpenAI 风格 `/audio/transcriptions` 端点的服务器都可以，包括 Speaches、faster-whisper 服务器、LocalAI 和 whisper.cpp 服务器（启动时要加上 `--inference-path /v1/audio/transcriptions`）这类自建服务器，以及 OpenAI、Groq 这类服务商。

1. 安装 Calls，然后打开 **Connections**，找到 **Speech to Text**(语音识别) 卡片。没装 Calls 时这张卡片不会显示。
2. 展开卡片，填入 **Server URL**(服务器地址)，比如服务器就在本机时填 `http://localhost:8000/v1`。
3. 服务器或服务商需要密钥的话，填入 **API key**(API 密钥)。密钥会加密保存，卡片上只显示打码后的密钥。
4. 在 **Model**(模型) 里填入服务器使用的模型名称。留空则发送 `whisper-1`。
5. 可选：填入 **Language**(语言) 代码，比如 `pl` 或 `de`。告诉模型你说的是哪种语言，通常能提高准确率。留空则由服务器自动识别。
6. 点击 **Test**(测试)。Marinara 会发送一段一秒钟的静音片段，并告诉你服务器有没有响应。
7. 打开卡片上的开关。

开关打开期间，**Mic recording + Local Whisper** 会把你的语音发给这个服务器，而不是交给 Local Whisper。这时不需要下载 Local Whisper。关掉开关就回到 Local Whisper。你的音频会发到你填写的服务器上，所以要用自己信得过的服务器。

和 Marinara 在同一台机器上的服务器可以直接使用。家庭网络里另一台机器上的服务器会被拒绝，除非在 Marinara 的 `.env` 文件里设置 `STT_LOCAL_URLS_ENABLED=true`。见[服务器配置参考](../CONFIGURATION.md)。

这需要支持该功能的 Calls 版本。如果打开开关后通话仍在使用 Local Whisper，就从 **Agents → Download Agents** 更新 Calls。

## 为聊天开启通话

通话可以在新建 Conversation 时开启，也可以之后在聊天设置里开启。

新建 Conversation 时，先走完设置向导，再打开该聊天的设置，按下面同样的步骤操作。可选包的设置只有装好 Calls 之后才会显示。

现有的 Conversation 这样操作：

1. 打开聊天。
2. 打开 **Chat Settings**(聊天设置)。
3. 进入 **Agents**(智能体) 部分。
4. 打开 **Calls**。
5. 开启 **Audio/Video Calls**。这时聊天名称旁边应该会出现一个通话按钮。
6. 开启 **Call Audio Pipeline**。没有它任何通话都无法开始，哪怕你根本不用麦克风。
7. 选择 **Audio input mode**。

**Audio/Video Calls** 和 **Calls** 命令是两个不同的设置。**Audio/Video Calls** 负责显示通话按钮，让你可以主动发起通话。**Calls** 命令则允许角色先打给你。关掉 **Calls** 之后，你自己仍然可以发起通话，只是角色不会再打进来。

装了提供命令的包之后，**Agents** 部分里还会有一个总开关 **Commands**。通话中的隐藏命令要生效就必须开启它。即使它关着，通话本身依然能开始。

### 设置项和默认值

大部分通话设置都在 **Chat Settings** → **Agents** → **Calls** 里。其中一些是全局设置。也就是说，在一个聊天里改动，整个应用的所有 Conversation 通话都会跟着变。

| 设置项 | 生效范围 | 默认值 |
|---|---|---|
| **Audio/Video Calls** | 按聊天 | Off |
| **Calls**(命令) | 按聊天 | On |
| **Generate voice cues in [tags]** | 按聊天 | On |
| **Call Audio Pipeline** | 全局 | Off |
| **Audio input mode** | 全局 | Mic recording + Local Whisper |
| **Camera and screen input** | 全局 | Off |
| **Character video presence** | 全局 | Off |
| **Automatic video clips generation** | 全局 | Off |
| **Custom clips** | 全局 | Off |

**Generate voice cues in [tags]** 会让模型在台词里加入简短的方括号提示，比如 `[whispering]`、`[laughing]` 或 `[sighs]`。这些提示会影响 TTS 的朗读方式，也用来挑选对应的反应视频片段。默认开启。想让台词保持干净，就关掉它。

## 发起、接听和结束通话

### 发起通话

聊天开启通话后，聊天名称旁会出现一个电话按钮。没有进行中的通话时，它的提示文字是 **Start call**；已经有通话在进行时，则是 **Open call**。

点击 **Start call**，完整的通话界面会立刻打开。

每个聊天同时只能有一个进行中或正在响铃的通话。已有通话时再点发起，Marinara 只会重新打开那个通话，不会新建一个。

### 角色打进来的通话

只要 **Calls** 命令开着，角色就可以打给你。人在该聊天里时，消息框上方会出现 **Incoming call** 横幅，上面有 **Decline call** 和 **Answer call** 两个按钮。

如果当时正在 Marinara 的其他地方，会弹出一条通话通知，样式和角色自主消息的通知类似，同时播放一小段铃声。Marinara 不会替你接听，必须自己点 **Answer call**。

只有当前有空的角色才会加入通话。如果日程或在线状态把某个角色标为离线，那么即使它属于这个聊天，也不会加入通话。

### 结束通话

红色的 **End call** 按钮随时可以结束通话，通话界面和最小化的浮窗上都有。角色也可以通过通话中的命令自己离开或结束通话。

通话结束时，Marinara 会停止录音，安全关闭媒体，并在普通的 Conversation 里添加一张卡片。

## 通话界面和控制条

通话舞台为每个参与者显示一个画面块，包括你的用户角色和每个有空的角色，正在说话的一方会高亮。

通话聊天里放的是打字消息和纯文字的角色回复。电脑上它在侧边面板里，手机上则收在 **Open call chat** 按钮后面。点开后会展开成整块面板，用 **Close call chat** 关掉。念出来的台词只用于播放音频，不会再重复成单独的聊天气泡。

通话输入区有一个 **Message in call** 输入框和一个 **Send** 按钮，还带表情、GIF 和贴纸选择器，以及一个快速切换连接的入口。通话聊天暂时不支持文件附件。

舞台底部的控制条上是一排图标按钮：

- 麦克风：静音和取消静音。提示文字随输入模式变化，比如 **Unmute microphone with Local Whisper**。
- **Turn camera on** 和 **Turn camera off**：只有在 **Provider-native audio/video** 模式下并且开启 **Camera and screen input** 时可用。
- **Share screen** 和 **Stop sharing screen**：条件和摄像头一样。
- **Character volume**：打开一个弹出面板，里面有静音按钮和 0 到 100 的音量滑块。默认 100%，你的选择会保存在浏览器里。
- **Soundboard**：打开音效列表，附带 **Upload** 按钮。
- **End call**：红色的挂断按钮。

静音状态持续一段时间后会出现提醒：“You are muted! Remember to unmute yourself first if you want to talk.”

通话进行中离开这个 Conversation，通话会缩成一个小浮窗，上面显示聊天名称、已通话时长和红色的 **End call** 按钮。点浮窗本体就能回到完整的通话界面。你在其他面板里浏览时，Marinara 会让通话继续。

### 音效板

音效板是一个小型音效库，任何通话中都可以播放。内置四个音效：**Soft Chime**、**Tap**、**Sparkle** 和 **Pop**。内置音效不能删除。

用 **Upload** 按钮可以上传自己的音效，支持 mp3、wav、ogg、webm 和 m4a，单个最大 8 MB。自己上传的音效带删除按钮。角色也可以通过音效板命令播放音效。

## Character Video Presence 和通话视频片段

**Character Video Presence** 会把静态头像画面块换成 AI 生成的角色循环视频片段。默认关闭。开关是 **Chat Settings** → **Agents** → **Calls** 里的 **Character video presence**。

配置通话视频片段的步骤：

1. 在 **Settings**(设置) → **Connections** 下创建一个 Video Generation 连接。
2. 把某个连接标记为 **Default for Videos**，或者每次生成时手动挑一个视频连接。
3. 打开角色或用户角色编辑器。
4. 打开 **Sprites**(立绘) 选项卡，再进入 **Clips** 子选项卡。
5. 用 **Generate Clips** 或 **Upload extra** 添加需要的片段。

关于立绘和编辑器的更多说明，见[角色立绘（表情和全身）](../characters/sprites.md)。

**Generate Clips** 按钮会打开 **Generate Call Clips** 窗口。在里面选择一个 **Video Generation Connection**，并选择 **Use avatar as reference**，然后勾选要生成哪些标准片段。还可以用 **Clip name** 加一段动作描述，自定义一个片段。

六种标准片段是 **Idle**、**Talking**、**Laughing**、**Angry**、**Crying** 和 **Sighing**。角色说话时，Marinara 会读取台词里的语音提示，比如 `[sighs]` 或 `[laughs]`，挑一个对应的反应片段播放，播完再让角色回到 Idle。

开启 **Character video presence** 后，下方会多出两个开关：

- **Automatic video clips generation**：默认关闭。开启后，Marinara 只会为需要的通话参与者自动生成两个基础片段 **Idle** 和 **Talking**。反应片段和自定义片段永远不会自动生成，要自己在 **Clips** 子选项卡里手动做。
- **Custom clips**：默认关闭。开启后，角色偶尔可以在通话中临时请求生成一个一次性片段，之后也能重播已经做好的自定义片段。这是为特殊的画面需求准备的，不是每种情绪、每句台词都用。

缺片段不会影响通话。片段做好之前，角色就显示静态头像。裁剪过的片段会在你设定的裁剪区间内循环。

关掉 **Character video presence** 会同时关掉 **Automatic video clips generation** 和 **Custom clips**。

通话视频片段和 Gallery(图库) 里的 **Videos** 不是一回事。Gallery 的 Videos 放的是 Roleplay、Game 或 Conversation 聊天里的场景视频，**Clips** 子选项卡放的则是这里说的可复用循环片段。

## 通话中的隐藏命令

角色在通话里可以使用和普通 Conversation 消息中一样的隐藏方括号命令。每条命令都要在 **Chat Settings → Agents** 里打开对应的开关，同时该部分里的总开关 **Commands** 也必须开着。这些命令在后台静默执行，既不会被念出来，也不会显示成正文。

- **Selfies**：角色生成一张照片并发到通话聊天里。这需要为该聊天设置好 **Selfie Connection**。见[自拍](selfies.md)。
- **Memories**：角色根据这次通话，保存一条关于另一个角色的记忆。
- **Music**：连接了音乐源时，角色可以通过 Music Player 播放歌曲。
- **Haptics**：连接了触觉设备时，角色可以在亲密场景中驱动设备。
- **Reactions**：角色用 emoji 对你最新发出的通话文字消息做出反应。
- **Cross-Post**：角色把当前话题搬到另一个共享的 Conversation 聊天里。
- **Schedule Updates**：角色修改自己的在线、空闲、免打扰或离线状态以及活动内容，持续一段时间后再回到自己的日程。见[角色日程与自主消息](schedules.md#characters-can-change-their-own-status)。
- **Notes** 和 **Influence**：保存一条长期笔记或一次性的引导，只有聊天设置了关联聊天时才会出现。
- **Soundboard**：角色播放通话音效板里的某个音效。
- 离开和结束：角色可以自己离开通话，也可以为所有人结束通话。

有些命令会在通话聊天里加一条小的系统记录。比如自拍会显示一条“sent a selfie”记录和对应的图片，自定义片段则会在渲染期间先显示一个占位。

## 通话结束摘要

通话结束后，Marinara 会在普通的 Conversation 记录里添加一张卡片，显示这次通话的状态。可能出现的标题有：

- **Call Started**
- **Incoming Call**
- **Call Ended**(通话结束)，并附上通话时长
- **Call Declined**
- **Missed Call**

出现 **Call Ended** 卡片之后，只要通话里发生了值得记录的内容，Marinara 就会在后台生成一段简短的通话摘要，并作为模型可读的隐藏上下文加进 Conversation。这样模型知道通话里说了什么，又不必把整段通话搬进可见的聊天里。

详细的通话记录留在单独的通话存储里，回流到普通聊天的只有那段简短摘要。

## 故障排查

### 点 Start call 却提示通话音频未启用

点击 **Start call** 后看到“Conversation call audio is not enabled in Chat Settings”，说明 **Call Audio Pipeline** 没开。依次打开 **Chat Settings** → **Agents** → **Calls**，把它开启。每一次通话都需要这个设置，哪怕你只打字。它是全局设置，在一个聊天里打开，所有 Conversation 通话都会一起生效。

### 能听见角色，角色听不见我

依次打开 **Chat Settings** → **Agents** → **Calls**，确认 **Call Audio Pipeline** 已开启。然后确认浏览器已经给 Marinara 页面授予麦克风权限。

用的是 Firefox，或者浏览器语音识别不工作时，安装 Calls 并下载 Local Whisper。依次打开 **Connections** → **Local Model** → **Local Speech Model**，然后选择 **Mic recording + Local Whisper**。

### Local Whisper 显示不可用

Local Whisper 需要对应平台的原生 ONNX 运行时。ONNX 就是跑本地语音模型的引擎。如果模型当初是按另一个 Node 版本装的，就用运行 Marinara 的那个 Node 版本重新安装依赖，然后重启。

用的是 Marinara 的“Lite”版本时，Local Whisper 在该版本里是关闭的。应用会提示：“Local Whisper is disabled in Lite mode. Use a full Marinara install to download and run the local speech model.”想用 Local Whisper 就换成完整安装版。

### 浏览器语音选项没有任何反应

浏览器语音识别取决于浏览器的支持情况。Firefox 没有提供和 Chromium、Safari 一样的 Web Speech 识别能力。想直接靠说话输入，就用 **Mic recording + Local Whisper**；也可以用 **Manual system dictation**，配合操作系统的听写打字。

### 角色只打字不说话

检查 Text to Speech 设置和声音分配。角色要么用全局的那一个声音，要么用一个 TTS 服务商能找到的专属声音。见 [Text to Speech (TTS) 设置](../media/tts-setup.md)。

### 模型听错了我说的话

把 Whisper Tiny 换成 **Whisper Base (Multilingual)**，准确率更高。减少背景噪音和音乐。模型支持的话，把 **Audio input mode** 切换到 **Provider-native audio/video**，让模型直接听你的声音。如果 Whisper 不擅长你的语言，就[使用自己的语音识别服务器](#use-your-own-speech-to-text-server)，换一个懂这种语言的模型，并设置它的 **Language** 代码。

### Speech to Text 测试失败

看 **Test** 按钮下方的提示。“Could not reach the speech-to-text server”表示地址不对，或者服务器没在运行。提示里提到 `STT_LOCAL_URLS_ENABLED`，说明服务器在你网络里的另一台机器上；在 `.env` 里把这个变量设为 `true`。401 或 404 这类数字来自你的服务器：401 通常是 API 密钥不对，404 则是地址或模型名称不对。

### 摄像头或屏幕按钮是禁用的

这两个按钮只在 **Provider-native audio/video** 模式下、并且开启 **Camera and screen input** 时才能用。先切换 **Audio input mode**，再开启 **Camera and screen input**，然后重试。另外，只有模型真的能处理摄像头或屏幕输入，这两个按钮才有意义。

### 手机上通话用不了

手机上通话聊天用 **Open call chat** 按钮打开，用 **Close call chat** 关闭。角色不说话就确认 Text to Speech 是否配好。手机上遇到麦克风问题，同样按前面 Local Whisper 和权限那几步处理。

### 角色通话中途不回复了

只有为该聊天选定的模型连接正常工作时，角色才会回复。回复停了就检查那个连接，然后在通话聊天里再发一条消息试试。

## 相关指南

- [Text to Speech (TTS) 设置](../media/tts-setup.md)
- [本地模型设置](../connections/local-model.md)
- [角色立绘（表情和全身）](../characters/sprites.md)
- [Conversation 模式：入门](getting-started.md)
