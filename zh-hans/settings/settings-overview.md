# 设置总览

本指南带你摸清 Marinara Engine 的 **Settings**(设置) 面板：六个选项卡分别管什么。其中 **General**(常规) 选项卡讲得最细，另外还有负责给聊天文字排版的 **Text Rules**(文本规则)，以及设置在多台设备之间怎么同步。

## Settings 面板和它的六个选项卡

点击顶栏的齿轮图标打开 **Settings**。面板顶部有一个 **Search settings**(搜索设置) 输入框，随便输入一个词（比如 `delete`、`streaming` 或 `quotes`），Marinara 就会直接跳到对应的部分。按你的界面语言或英语里的设置名称都能找到对应的设置。

面板共有六个选项卡。下表列出每个选项卡管什么。

| 选项卡 | 在这里设置什么 |
| --- | --- |
| **General** | 应用行为、通知、回复、输入、文本规则和游戏播放。 |
| **Appearance** | 主题、配色、字体、聊天布局、动效和背景。 |
| **Generations** | 图像和视频的默认值，以及可复用的提示词模板。 |
| **Addons** | Professor Mari 在沙箱里写的 Personal Extension 草稿、按需解锁的 External Extensions，还有自定义主题。 |
| **Imports** | 恢复完整档案，以及从其他应用导入。 |
| **Advanced** | 管理员访问、可选功能开关、更新、消息工具、备份，以及有破坏性的重置操作。 |

每个选项卡的详细说明分别在这些地方：

- **General**：就在本页（见下面几节）。
- **Appearance**：见[外观设置](../appearance/appearance-settings.md)。
- **Generations**：见[风格方案](../media/style-profiles.md)和[场景视频](../media/scene-video.md)。
- **Addons**：见[个人扩展](../extending/personal-extensions.md)和[自定义 CSS 主题](../appearance/custom-css-themes.md)。
- **Imports**：见[从 SillyTavern 导入](../data/importing-from-sillytavern.md)和[备份与恢复](../data/backup-and-restore.md)。
- **Advanced**：见下面的 **Message Tools**(消息工具) 一节、[功能开关](../configuration/features.md)，以及[升级 Marinara Engine](../UPGRADING.md)、[远程访问](../REMOTE_ACCESS.md)和[清除或重置数据](../data/clearing-data.md)。

## Settings 的 General 选项卡

**General** 选项卡下有六个部分。本页完整介绍其中两个：**App Behavior**(应用行为) 和 **Text Rules**。其余四个这里只做概述，详细内容在各自的指南里。

- **App Behavior**：语言、删除保护，以及几个显示/隐藏开关。下面详述。
- **Notifications**(通知)：通知提示音，以及浏览器和 Android 应用各自独立的开关。**Custom sound**(自定义提示音) 可以上传 MP3、WAV、OGG、M4A/MP4 或 WebM 格式的文件（最大 10 MB），用来替换 Marinara 内置的提示音，连接到这台服务器的所有设备都会生效。这个文件随时可以预览、替换或删除；文件读不出来时会自动退回内置提示音，它也会一起进入备份和档案导出。**Background Notifications**(后台通知) 管的是 Conversation 的自主消息，**Generation Completion Notifications**(生成完成通知) 管的是在 Conversation、Roleplay 和 Game Mode 里手动发起的回复。两者都在 Marinara 保持打开但不在前台时生效，消息内容不会显示出来。
- **Responses**(回复)：回复怎么流式输出、怎么保存、怎么分页。见[发送消息与流式输出](../chats/sending-and-streaming.md)。
- **Input & Editing**(输入与编辑)：消息输入框和快速编辑相关的控件。见[消息操作](../chats/messages.md)。
- **Text Rules**：应用到聊天文字上的格式规则。下面详述。
- **Game Playback**(游戏播放)：Game Mode 里的阅读和导航方式。

## App Behavior

这一节在 **Settings** > **General** > **App Behavior**，控制日常使用中的应用行为和几个显示/隐藏开关。

- **Language**(语言)：选择应用界面语言。Marinara 目前内置阿拉伯语、简体中文、英语、
  法语、德语、印地语、日语、韩语、波兰语、巴西葡萄牙语、俄语和西班牙语。阿拉伯语采用
  从右到左的布局。尚未翻译的界面文字会退回英语。这项设置只改变 Marinara 的控件和说明文字，
  不影响模型提示词和聊天内容。想改进某个译文或者贡献新的语言，
  见[界面本地化](../development/localization.md)。
- **Documentation Language**(文档语言)：为 Marinara 内置的指南单独选一种语言，和上面的界面语言互不相干。英语是内置的，永远不需要下载。选英语以外的语言会出现 **Download & Replace**(下载并替换)，点它会下载一次该语言包并删掉上一个语言包，所以本地始终只保留一个下载好的语言。尚未翻译的指南会以英语打开，并带一个小小的 `EN` 徽章；文档搜索按当前生效的语言工作。选择结果在更新后依然保留，语言包的译文有变动时也会在更新后自动刷新。万一下载好的指南丢失或损坏，界面上会出现 **Fix documentation**(修复文档) 按钮：它会重新下载语言包，如果连不上下载源，就把指南恢复成英语。
- **Confirm before deleting**(删除前确认)：默认开启。开启时，Marinara 在永久删除聊天、角色或其他条目之前会先确认一次。建议保持开启，免得误删。
- **Hide chat Help button**(隐藏聊天帮助按钮)：默认关闭。开启后，Conversation、Roleplay 和 Game 聊天里的 **Help**(帮助) 按钮会消失。
- **Show Android status bar**(显示 Android 状态栏)：默认关闭，只在 Marinara Engine 的 Android 应用里起作用。开启后，时间、电量和通知图标会一直显示在 Marinara 上方。
- **Achievements**(成就)：默认开启。开启时，主页会显示 **Achievements** 书签和解锁提示。如果你把可选的 **Achievements** 小组件加入了主页布局，它也会显示。关闭后，成就仍在后台记录，只是不再提示。见[成就](../home/achievements.md)。
- **Music Player**(音乐播放器)：默认开启。开启时会显示紧凑的音乐播放器。它需要从 **Agents** > **Download Agents** 安装 **Music DJ** 智能体，安装之前这个开关会一直是灰色的。见[音乐](../media/music.md)。
- **Search and Professor Mari settings**(Search 与 Professor Mari 设置)：选择 **Open**(打开) 进入它们的设置页面。所有 Search(搜索栏) 和 Professor Mari 的设置都在那里，分成这几组：

  - **Search**(搜索)：提议改进字段和搜索历史。
  - **Quick answers**(快速回答)：**Quick answers in Search**(Search 中的快速回答)、**Answer with**(回答使用) 和 **Wait after typing**(输入后等待)。
  - **Search window**(Search 窗口) 和 **Professor Mari window**(Professor Mari 窗口)：每个窗口都有 **Height**(高度) 和 **Width**(宽度) 设置。手机上不显示这两组。
  - **Professor Mari**：Ask Professor Mari from Search(从 Search 问问 Professor Mari)、权限模式、**Runtime**(运行时)、回复建议按钮、改动卡片的打开方式和 Enter sends to Professor Mari(按 Enter 发送给 Professor Mari)。
  - **Around the app**(应用各处)：Mini Professor Mari visits(迷你 Professor Mari 来访)。
  - **Appearance**(外观)：她的形象。每个形象包都会显示她的肖像。正在使用的那个标着 **In use**(使用中)。锁定的形象包会显示你为解锁它累计的游玩时间。

  Search 里的齿轮图标也能打开同一个页面。搜索其中任何一项设置，无论用新名字还是旧名字，都会直接跳到它。

## Text Rules

这一节在 **Settings** > **General** > **Text Rules**。这些规则决定聊天文字怎么处理。**Bold dialogue in quotes**(引号内对白加粗) 和 **Convert LaTeX symbols**(转换 LaTeX 符号) 只影响显示，不会动到已保存的消息。**Quote style**(引号样式) 不一样：它会真的改写你输入并保存下来的引号字符。

### Bold dialogue in quotes

默认开启。开启时，引号里的文字会以粗体显示。以这一行为例：

```
"I missed you," she said.
```

开启 **Bold dialogue in quotes** 后，`I missed you` 这几个词会显示为粗体。关掉它，对白仍保留原有的颜色，只是不再加粗。

### Convert LaTeX symbols

默认开启。有些模型会用 LaTeX 命令写数学式。开启时，`\rightarrow`、`\neq`、`\times`、`\alpha` 这类常见命令会显示成对应的符号。比如 `\times` 显示为乘号 `×`，`\alpha` 显示为希腊字母 `α`。代码片段不受影响。

### Quote style

决定引号如何统一。和上面两条规则不同，这一条会改动文字本身：Marinara 会把你输入并保存的消息改写成所选的样式。有两个选项：

- **Straight**：保留普通的直引号，例如 `"Hello," it's me.` 这是默认值。
- **Typographic**：把直引号换成弯引号和弯撇号。

### Load images from other websites in messages

默认关闭。关闭时，消息、开场白或卡片预览里来自其他网站的图片会改为显示该网站的名称和一个 **Load image**(加载图片) 按钮，这样消息就无法自行联系其他网站。选择 **Load image** 即可显示那张图片；Marinara 会在你所有的设备上记住这个选择。打开这项设置，所有图片都会立刻显示。保存在 Marinara 里的图片，例如图库图片、头像和立绘，始终会显示。

## Responses 和 Input & Editing

**General** 里的这两个部分负责调整回复的呈现方式，以及输入和编辑的手感。下面列出各个控件，并给出完整指南的链接。

**Responses** 部分包含：

- **Enable streaming**(启用流式输出)：AI 文字边生成边逐词显示。
- **Streaming speed**(流式速度)：流式文字出现的快慢。
- **Trim incomplete sentences from the response**(裁掉回复中不完整的句子)：保存前把末尾没写完的句子裁掉。
- **Add a new line before /continue text**(在 /continue 文本前添加新行)：让 `/continue` 添加的文字在一个空行之后开始。默认开启。
- **Messages per page**(每页消息数)：一次加载多少条消息。

详见[发送消息与流式输出](../chats/sending-and-streaming.md)。

**Input & Editing** 部分包含：

- **Send on Enter**(按 Enter 发送)：选择哪些模式下按 Enter 直接发送。
- **Keep guidance after regenerating**(重新生成后保留引导)：引导式重新生成之后，把方向说明留在消息输入框里。默认开启。
- **Add CYOA choices to the message box instead of sending them**(把 CYOA 选项加入消息框而不是直接发送)：点击的 CYOA 选项会进入你的消息框，你可以先编辑再发送。
- **Quick replies**(快捷回复)：在 Send 按钮旁边加上几个备选草稿动作。见[引导生成与 Impersonate](../chats/guided-and-impersonate.md)。
- **Speech-to-text microphone**(语音识别麦克风)：在聊天输入框里显示麦克风按钮。
- **Intuitive swipe navigation**(直觉式备选回复导航)：用方向键或触屏滑动在备选回复之间切换。
- **Reroll past the newest swipe**(滑过最新备选回复时重新生成)：滑过最新的一条备选回复时，生成一条新回复。
- **Up Arrow edits last message**(Up Arrow 编辑上一条消息)：输入框为空时按 Up Arrow 编辑上一条消息。
- **Double-click edits messages**(双击编辑消息)：双击 Roleplay 的消息即可编辑。

详见[消息操作](../chats/messages.md)。

## Message Tools

**Message Tools** 这一节在 **Settings** > **Advanced** > **Message Tools**，集中放着一批显示类和修复类开关。下面的开关默认都是关闭的，只有 **Show context usage**(显示上下文用量) 和 **Show "older messages not sent" note**(显示“较早消息未发送”提示) 默认开启。表格列出各自的作用和延伸阅读。

| 开关 | 作用 | 完整指南 |
| --- | --- | --- |
| **Show message timestamps** | 在每条消息上显示日期和时间。 | [消息操作](../chats/messages.md) |
| **Show characters in Persona pickers** | 在用户角色选择器里列出你的角色，这样你就可以扮演其中一个。 | [用户角色](../characters/personas.md) |
| **Show model name on messages** | 显示每条回复由哪个 AI 模型写成。 | [消息操作](../chats/messages.md) |
| **Show token usage on messages** | 显示每条消息的提示词和补全 Token 数。 | [消息操作](../chats/messages.md) |
| **Show context usage** | 在连接切换器和 Game 聊天设置里，显示最近一次测量的请求占用了模型上下文的多少。 | [整理连接](../connections/organizing-connections.md#the-random-pool-and-quick-connection-switcher) |
| **Show message numbers** | 在聊天里的每条消息上显示编号。 | [消息操作](../chats/messages.md) |
| **Show "older messages not sent" note** | 较早的消息放不进提示词时，在最新一条回复下方显示一条提示。关闭它，就能在长聊天里隐藏这条提示。回复被截断或为空时，仍会显示它自己的提示。 | [Peek Prompt](../chats/peek-prompt.md) |
| **Guide swipes/regens with chat input** | 重新生成时，把输入框里的草稿当作方向指引。 | [引导生成与 Impersonate](../chats/guided-and-impersonate.md) |
| **Include reasoning in exports** | 把隐藏的思考过程一并写入聊天导出文件。 | [导出与导入聊天](../chats/export-import.md) |
| **Include private notes in exports** | 把你的私人消息笔记加进 JSONL 和文本格式的聊天导出。分享聊天记录时请保持关闭。 | [导出与导入聊天](../chats/export-import.md) |
| **Debug mode** | 在服务器控制台记录发给模型的内容，方便求助排查。 | [故障排查](../TROUBLESHOOTING.md) |

**Advanced** 选项卡的其余内容在别处介绍：**Updates** 见[升级 Marinara Engine](../UPGRADING.md)，**Admin Access** 见[远程访问](../REMOTE_ACCESS.md)，**Backup & Export** 见[备份与恢复](../data/backup-and-restore.md)，**Danger Zone** 见[清除或重置数据](../data/clearing-data.md)。

## 设置如何在多台设备之间同步

Marinara 把大部分设置存在服务器上，所以换浏览器、换设备都会跟着走。设置同步的行为是这样的。

具体流程如下：

1. 在 **Settings** 的任意位置改动一项设置。
2. 大约一秒后，Marinara 把这次改动连同时间戳一起存到服务器。
3. 另一个浏览器打开同一台 Marinara 服务器时，会载入这些保存好的设置。

每台设备保留较新的那一份，也就是按时间戳“后写覆盖先写”。这条规则有一个副作用要留意：在第二台设备上打开 Marinara 时，它那份设置可能悄悄覆盖掉你刚在第一台设备上改好的值。换设备之前，先留几秒钟让应用完成同步。

有两项设置永远不同步，只留在设置它的那个浏览器里：

- **Display Size**(界面文字大小)
- **Chat Font Size**(聊天文字大小)

两者都在 **Settings** > **Appearance** > **Text & Scale**。每台设备都要单独设一次。见[外观设置](../appearance/appearance-settings.md)。

服务器连不上时，应用会继续使用本地设置正常工作，并在下次改动设置时重试。

## 相关指南

- [外观设置](../appearance/appearance-settings.md)
- [消息操作](../chats/messages.md)
- [发送消息与流式输出](../chats/sending-and-streaming.md)
- [导出与导入聊天](../chats/export-import.md)
- [Marinara 的数据保存在哪里](../data/where-data-is-stored.md)
- [升级 Marinara Engine](../UPGRADING.md)
- [故障排查](../TROUBLESHOOTING.md)
- [成就](../home/achievements.md)
- [个人扩展](../extending/personal-extensions.md)
- [界面本地化](../development/localization.md)
