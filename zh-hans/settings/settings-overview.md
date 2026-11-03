# 设置总览

查找某个控件位于 **Settings**(设置) 的哪一部分，设置 **General**(常规) 选项卡，并了解设置如何在多台设备之间同步。

## 设置面板及其六个选项卡

点击顶栏的齿轮图标打开 **Settings**。顶部的 **Search settings**(搜索设置) 框可以按名称查找设置。输入 `delete`、`streaming` 或 `quotes` 之类的词，Marinara 就会跳到对应的部分。它同时匹配你的界面语言和英语中的名称。

这个面板有六个选项卡。每个选项卡都有自己的部分。

### 我想要…

| 我想要… | 前往 |
| --- | --- |
| 更改语言 | **Settings → General → App Behavior → Language**(设置 → 常规 → 应用行为 → 语言) |
| 放大文字 | **Settings → Appearance → App → Text & Scale** |
| 更改主题或配色 | **Settings → Appearance → App → App Style** |
| 设置通知提示音 | **Settings → General → Notifications** |
| 关闭删除确认 | **Settings → General → App Behavior** |
| 添加快捷回复 | **Settings → General → Input & Editing** |
| 创建备份 | **Settings → Advanced → Backup & Export** |
| 删除我的数据 | **Settings → Advanced → Danger Zone** |
| 更新 Marinara | **Settings → Advanced → Updates** |

### 各选项卡包含什么

**General**（本指南）

- **App Behavior**（带有一行 **Search and Professor Mari settings**(Search 与 Professor Mari 设置)）
- **Notifications**(通知)
- **Responses**(回复)
- **Input & Editing**(输入与编辑)
- **Text Rules**(文本规则)
- **Game Playback**(游戏播放)

**Appearance**(外观) 有四个按钮。参见[外观设置](../appearance/appearance-settings.md)。

- **App**：**App Style**(应用样式)、**Text & Scale**(文字与缩放)、**Atmosphere**(氛围)、**Backgrounds**(背景)
- **Conversation**(对话模式)：**Conversation Display**(对话显示)、**Conversation Theme**(对话主题)
- **Roleplay**(角色扮演)：**Tracker Panel**(追踪器面板)、**Roleplay Presentation**(Roleplay 呈现方式)
- **Game**(游戏)：**Game Presentation**(游戏呈现方式)

**Generations**(生成) 包含 **Overall Generations**(整体生成)、**Image Generation**(图像生成)、**Video Generation**(视频生成) 和 **Prompt Overrides**(提示词覆盖)。在你安装 Illustrator 智能体之前，这个选项卡只会显示一个下载它的提示。参见[风格方案](../media/style-profiles.md)和[场景视频](../media/scene-video.md)。

**Addons**(插件) 包含扩展修订历史、**Personal Extensions**(个人扩展)、**External Extensions**（仅在你解锁后出现）和 **Theme Library**(主题库)。参见[个人扩展](../extending/personal-extensions.md)和[自定义 CSS 主题](../appearance/custom-css-themes.md)。

**Imports**(导入) 包含 **Profile & Marinara**(档案与 Marinara)、**SillyTavern Import**(SillyTavern 导入) 和 **Game Assets**(游戏素材)。参见[备份与恢复 Marinara](../data/backup-and-restore.md)和[从 SillyTavern 导入](../data/importing-from-sillytavern.md)。

**Advanced**(高级) 包含以下部分，顺序如下。参见[高级选项卡](#the-advanced-tab)。

- **Multiplayer WIP**(多人功能开发中)
- **Access**(访问)
- **Admin Access**(管理员访问)
- **Features**(功能)
- **Updates**(更新)
- **Support Diagnostics**(支持诊断信息)
- **Request timeouts**(请求超时)
- **Parameters**(参数)
- **Message Tools**(消息工具)
- **Backup & Export**(备份与导出)
- **Storage Optimization**(存储优化)
- **Danger Zone**(危险区域)

## General 选项卡

**General** 选项卡的每个部分都位于 **Settings → General** 下。

| 部分 | 控制内容 |
| --- | --- |
| **App Behavior** | 语言、删除保护、显示和隐藏开关，以及 **Search and Professor Mari settings** 一行。参见[应用行为](#app-behavior)。 |
| **Notifications** | 通知提示音，以及浏览器和 Android 通知。参见[通知](#notifications)。 |
| **Responses** | 流式输出、裁剪和 **Messages per page**(每页消息数)。参见[发送消息与流式输出](../chats/sending-and-streaming.md)。 |
| **Input & Editing** | **Send on Enter**(按 Enter 发送)、**Quick replies**(快捷回复)，以及滑动和编辑快捷操作。参见[输入与编辑](#input-and-editing)。 |
| **Text Rules** | 聊天文字的排版规则。参见[文本规则](#text-rules)。 |
| **Game Playback** | Game Mode 的阅读和导航。参见[Game Mode：入门](../game/getting-started.md)。 |

### 应用行为

<a id="app-behavior"></a>

| 设置 | 作用 |
| --- | --- |
| **Language** | 设置界面语言。它不会改变模型提示词或聊天内容。尚未翻译的文字会以英语显示。阿拉伯语采用从右到左的排版。默认值：英语。 |
| **Documentation Language** | 设置内置指南的语言。见下文。默认值：英语。 |
| **Confirm before deleting** | 在 Marinara 永久删除聊天、角色或其他条目之前进行询问。默认值：开启。 |
| **Hide chat Help button** | 隐藏 Conversation、Roleplay 和 Game 聊天中的 **Help** 按钮。默认值：关闭。 |
| **Show Android status bar** | 让时间、电量和通知图标始终显示在 Marinara 上方。仅在 Android 应用中生效。默认值：关闭。 |
| **Achievements** | 记录成就，显示解锁提示，以及首页书签和小组件。参见[成就](../home/achievements.md)。默认值：开启。 |
| **Disable seasonal ME themes** | 关闭 Marinara 的季节主题。默认值：关闭。 |
| **Music Player** | 显示紧凑的音乐播放器。它需要先从 **Agents → Agent Organizer** 中安装 **Music DJ** 智能体，安装之前一直是灰显状态。参见[音乐](../media/music.md)。默认值：开启。 |

**Search and Professor Mari settings**(Search 与 Professor Mari 设置) 是 **App Behavior** 底部的一行。选择 **Open**(打开)，即可进入 Search、快速回答和 Professor Mari 的设置页面。参见[Professor Mari](../home/professor-mari.md)。

界面语言有阿拉伯语、简体中文、英语、法语、德语、印地语、日语、韩语、波兰语、巴西葡萄牙语、俄语和西班牙语。想改进译文或添加新语言，请参见[界面本地化](../development/localization.md)。

对于 **Documentation Language**(文档语言)，英语是内置的。选择其他语言后点击 **Download & Replace**(下载并替换)。Marinara 会下载一次该语言包，并删除之前的语言包，因此本地只保留一种已下载的语言。尚未翻译的指南会以英语打开，并带有一个小的 `EN` 标记。文档搜索使用当前生效的语言。你的选择在更新后仍然保留；译文有变化时，语言包会在更新后刷新。如果已下载的指南丢失或损坏，会出现 **Fix documentation**(修复文档) 按钮。它会重新下载语言包；如果无法连接下载源，则把指南恢复为英语。

### 通知

<a id="notifications"></a>

Marinara 为通知播放内置提示音。想使用你自己的声音：

1. 打开 **Settings → General → Notifications**。
2. 上传 **Custom sound**(自定义提示音)：支持 MP3、WAV、OGG、M4A、MP4 或 WebM，最大 10 MB。

这个声音会在连接到此服务器的每台设备上播放。你可以预览、替换或删除它。如果无法读取该文件，Marinara 会播放内置提示音。该文件属于备份和档案导出的一部分。

**Background Notifications**(后台通知) 负责角色自行发送的对话消息。**Generation Completion Notifications**(生成完成通知) 负责你在 Conversation、Roleplay 和 Game Mode 中自行发起的回复。两者都在 Marinara 已打开但不在焦点时生效。它们从不显示消息内容。

### 输入与编辑

<a id="input-and-editing"></a>

**Settings → General → Input & Editing** 中的设置：

| 设置 | 作用 |
| --- | --- |
| **Send on Enter** | 选择按下 Enter 时哪些模式会发送。 |
| **Keep guidance after regenerating** | 引导式重新生成之后，把你的方向说明保留在消息框中。默认开启。 |
| **Add CYOA choices to the message box instead of sending them** | 点击的选项会放入消息框，方便你先编辑。 |
| **Quick replies** | 在发送按钮旁边添加草稿操作。参见[引导生成与 Impersonate](../chats/guided-and-impersonate.md)。 |
| **Speech-to-text microphone** | 在聊天输入框中显示麦克风按钮。 |
| **Intuitive swipe navigation** | 使用方向键或触屏滑动，在备选回复（同一条消息上保留的多个回答）之间切换。 |
| **Reroll past the newest swipe** | 滑过最新的备选回复时，生成一条新回复。 |
| **Up Arrow edits last message** | 输入框为空时按 Up Arrow，即可编辑上一条消息。 |
| **Double-click edits messages** | 双击 Roleplay 消息即可编辑它。 |

**Responses** 部分包含 **Enable streaming**(启用流式输出)、**Streaming speed**(流式速度)、**Trim incomplete sentences from the response**(裁掉回复中不完整的句子)、**Add a new line before /continue text**(在 /continue 文本前添加新行)（默认开启）和 **Messages per page**(每页消息数)。参见[发送消息与流式输出](../chats/sending-and-streaming.md)。消息操作请参见[消息操作](../chats/messages.md)。

### 文本规则

<a id="text-rules"></a>

这些规则改变聊天文字的处理方式，位于 **Settings → General → Text Rules**(设置 → 常规 → 文本规则)。**Bold dialogue in quotes**(引号内对白加粗) 和 **Convert LaTeX symbols**(转换 LaTeX 符号) 只改变文字的显示效果，已保存的消息保持不变。**Quote style**(引号样式) 则会改写你输入并保存的文字中的引号。

| 设置 | 作用 |
| --- | --- |
| **Bold dialogue in quotes** | 把引号内的文字显示为粗体。默认开启。 |
| **Convert LaTeX symbols** | 把 LaTeX 数学命令显示为符号。代码不受影响。默认开启。 |
| **Quote style** | **Straight** 保留普通引号（默认）。**Typographic** 把它们改写为弯引号和弯撇号。 |
| **Load images from other websites in messages** | 控制托管在其他网站上的图片。默认关闭。 |

#### 引号内对白加粗

开启后，`"I missed you," she said.` 中引号内的文字会显示为粗体。关闭它则保留对白的颜色，但不加粗。

#### 转换 LaTeX 符号

有些模型用 LaTeX 命令书写数学式。开启后，`\rightarrow`、`\neq`、`\times` 和 `\alpha` 会分别显示为 `→`、`≠`、`×` 和 `α`。

#### 在消息中加载其他网站的图片

关闭时，消息、开场白或卡片预览中来自其他网站的图片会显示该网站的名称和一个 **Load image**(加载图片) 按钮。这样，消息不会自行连接其他网站。选择 **Load image** 即可显示该图片。Marinara 会在你所有的设备上记住你的选择。开启此设置后，所有图片会立即显示。保存在 Marinara 中的图片，例如图库图片、头像和立绘，始终会显示。

## 高级选项卡

<a id="the-advanced-tab"></a>

| 部分 | 更多内容 |
| --- | --- |
| **Admin Access** | [远程访问](../REMOTE_ACCESS.md) |
| **Features** | [功能开关](../configuration/features.md) |
| **Updates** | [升级 Marinara Engine](../UPGRADING.md) |
| **Message Tools** | [消息工具](#message-tools) |
| **Backup & Export** | [备份与恢复 Marinara](../data/backup-and-restore.md) |
| **Danger Zone** | [清除或重置数据](../data/clearing-data.md) |

### 消息工具

<a id="message-tools"></a>

这些开关位于 **Settings → Advanced → Message Tools**(设置 → 高级 → 消息工具) 中。除 **Show context usage**(显示上下文用量) 和 **Show "older messages not sent" note**(显示“较早消息未发送”提示) 之外，它们默认都是关闭的。

| 开关 | 作用 |
| --- | --- |
| **Show message timestamps** | 在每条消息上显示日期和时间。 |
| **Show characters in Persona pickers** | 在用户角色选择器中列出你的角色，方便你扮演其中一个。 |
| **Show model name on messages** | 显示每条回复由哪个模型生成。 |
| **Show token usage on messages** | 在每条消息上显示提示词和回复的 Token 数。 |
| **Show context usage** | 在连接切换器和 Game 聊天设置中，显示上次测量的请求占满了多少上下文窗口。 |
| **Show message numbers** | 在每条消息上显示编号。 |
| **Show "older messages not sent" note** | 当较早的消息放不进提示词时，在最新回复下方显示一条提示。被截断或为空的回复仍会显示它自己的提示。 |
| **Guide swipes/regens with chat input** | 重新生成时，把你的草稿用作方向指引。 |
| **Include reasoning in exports** | 把模型隐藏的思考过程加入聊天导出文件。 |
| **Include private notes in exports** | 把你的私人消息备注加入 JSONL 和文本导出。分享聊天记录时请保持关闭。 |
| **Debug mode** | 在服务器控制台中记录模型负载，便于获取支持。 |

更多内容请参见[消息操作](../chats/messages.md)、[用户角色](../characters/personas.md)、[为单个聊天选择模型](../connections/connecting-to-a-provider.md#choosing-a-model-for-one-chat)、[Peek Prompt](../chats/peek-prompt.md)、[引导生成与 Impersonate](../chats/guided-and-impersonate.md)、[导出与导入聊天](../chats/export-import.md) 和[故障排查](../TROUBLESHOOTING.md)。

## 设置如何在多台设备之间同步

Marinara 把大部分设置保存在服务器上，因此它们会跟着你在不同浏览器和设备之间走。

1. 你在 **Settings** 中更改一项设置。
2. 大约一秒后，Marinara 把它保存到服务器。
3. 打开同一服务器的另一个浏览器会加载这些设置。

最新的改动优先。如果你在改动后不久就在第二台设备上打开 Marinara，那边较旧的副本可能会覆盖你的改动。切换设备前，请稍等片刻。

有两项设置永远不会同步。请在每台设备上，于 **Settings → Appearance → Text & Scale**(设置 → 外观 → 文字与缩放) 中分别设置：

- **Display Size**，即界面文字大小
- **Chat Font Size**，即聊天文字大小

参见[外观设置](../appearance/appearance-settings.md)。如果无法连接服务器，应用会继续使用本地设置，并在你下次改动设置时再次尝试。

## 相关指南

- [外观设置](../appearance/appearance-settings.md)
- [消息操作](../chats/messages.md)
- [Marinara 的数据保存在哪里](../data/where-data-is-stored.md)
- [故障排查](../TROUBLESHOOTING.md)
