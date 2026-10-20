# Conversation 模式：入门

本指南介绍 Marinara Engine 里的 Conversation(对话模式)，也就是即时通讯软件风格的聊天模式，说明这个模式是什么，以及四步设置向导怎么用，同时介绍只有这个模式才有的功能：自主消息、在线状态、表情回应、自拍和桌面游戏。

## Conversation 模式是什么

Conversation 是 Marinara Engine 的聊天模式之一，用起来就像一个聊天软件：有一个或多个角色、一个输入栏，还有一条可以往上翻的消息记录。

可以把它理解成发私信，跟给朋友发消息一样。这里没有游戏主持人（GM），没有场景美术，也没有必须遵守的机制。它是最轻量的聊天模式，很多人的大部分时间都花在这里。

Conversation 模式还加了一些只有长期聊天关系才用得上的功能。角色有在线或离开状态，也有每周日程。它们可以主动给你发消息、发自拍、用 emoji 回应，还能玩桌面游戏。每个角色和用户角色也都有一张 Discord 风格的小型个人资料页，带显示名和自我介绍。这些资料字段见 [Conversation Mode 个人资料](profiles.md)。

以上这些功能在 Roleplay 和 Game Mode 里都不生效，哪怕你在那边用的是同一张角色卡。

有些卡片字段则正好相反。Conversation 聊天不会以角色卡的 **First Message**(首条消息) 或其他开场白开始，只有 Roleplay 聊天才会。它也不使用角色卡的 **Dialogue Highlight Color**(对白高亮颜色) 和 **Message Box Color**(消息框颜色)。**Name Display Color**(名字显示颜色) 仍然会给每条消息上方的角色名字上色。见[这些颜色分别用在哪里](../characters/colors-and-stats.md#where-your-colors-show)。

### 什么时候该选 Conversation 模式

有下面这些需求时就选 Conversation 模式：

- 想像给朋友发私信一样跟角色聊天，纯文字来回。
- 想在同一条聊天里同时和多个角色说话。
- 想让角色自己活动：主动发消息、按日程作息、随时间做出反应。

如果想要立绘、背景这类场景美术，或者想要成体系的游戏机制，就改选 Roleplay 或 Game Mode。

## 四步设置向导

新建一个 Conversation 聊天时会弹出一个四步向导。也可以先关掉，之后再到聊天设置面板里配置。四个步骤分别是：

1. **Name & Connection**(名称与连接)：给聊天起名，并选好角色要用的 AI 连接。连接就是保存下来的一套 AI 服务接入信息。见[连接 AI 服务商](../connections/connecting-to-a-provider.md)。
2. **Prompt Preset**(提示词预设)：选择由哪个预设提供 Conversation 的提示词，也可以保持默认。
3. **Persona & Characters**(用户角色与角色)：选好自己的用户角色，再选一个或多个角色。
4. **Automation**(自动化)：决定角色能自主做多少事。

用户角色就是你扮演的那个角色。见[用户角色](../characters/personas.md)。

选几个角色，决定了这条聊天的形态。选一个角色就是一对一私信。选两个或更多就成了群聊，不需要再额外开什么模式。群聊的各项控制见[群聊](../chats/group-chats.md)。

连接和至少一个角色都设好之后，点击 **Start Chatting**(开始聊天) 进入聊天。

### Automation 步骤

**Automation** 这一步始终包含下面这些控制项：

| 开关 | 默认 | 作用 |
|---|---|---|
| **Autonomous Messages**(自主消息) | On | 你没在活动时，角色可以主动给你发消息。 |
| **Generate Schedules**(生成日程) | Off | 生成可选的每周作息。仅在 Autonomous Messages 开启时显示。 |

如果装了带 Conversation 命令的智能体包，这一步还会多出 **Commands**(命令)。通话、Illustrator 自拍、Music DJ、Haptic Feedback 以及各个桌面游戏，只有装了对应的包才会出现。通话相关内容见 [Conversation 音频和视频通话](calls.md)。

### Commands 网格

**Commands** 可用并且开启时，会出现一个最多 17 个命令组的网格。每一组都是角色可以自己触发的隐藏动作。由扩展包提供的选项，只有装了那个包才会出现。所有显示出来的命令组默认都是开启的，关掉某个开关只会停用那一组。这些命令由模型自行调用，不需要你手动输入。

完整的命令组如下：

- **Schedule Updates**(更新日程)：允许角色更改自己当前的状态。
- **Cross-Post**(跨聊天转发)：允许角色把一条消息转发到另一条聊天里。
- **Selfies**(自拍)：允许角色请求生成自拍。
- **Memories**(记忆)：允许角色为其他角色创建记忆。
- **Scenes**(场景)：允许角色开启一段沉浸式场景。
- **Music**(音乐)：允许角色通过当前的 Music Player 播放歌曲。
- **Haptics**(触感反馈)：允许角色控制已连接的触感设备。
- **Influence**(影响)：允许角色影响一条相连的聊天。
- **Notes**(笔记)：允许角色为一条相连的聊天保存长期笔记。
- **Calls**(通话)：允许角色打来 Conversation 通话。
- **Reactions**(表情回应)：允许角色用 emoji 角标回应消息。
- **UNO**：你答应一起玩时，允许角色在桌上开一局 UNO。
- **Chess**：允许角色接受一对一的国际象棋挑战。
- **Poker**：允许角色坐上桌打一局德州扑克。
- **8-Ball Pool**：允许角色在桌上开一局八球台球。
- **Tic-Tac-Toe**：允许角色接受一对一的井字棋挑战。
- **Rock-Paper-Scissors**：允许角色接受一对一的猜拳对局。

所有命令组都受一个 **Commands** 总开关管辖。总开关关掉后，任何命令组都不会生效，哪怕它看上去是启用的。

## 自主消息和你的在线状态

自主消息让角色可以先来找你。**Autonomous Messages** 开启时，只要你安静了一段时间，角色就可能给你发消息。角色会综合考虑自己的健谈度，以及日程开启时自己是否有空。走完向导后，自主消息默认是开启的。

这个开关之后随时可以改。打开聊天设置面板，找到 **Autonomous Messaging**(自主消息设置) 部分。

### 你的在线状态

你自己有一个在线状态，它决定角色什么时候来找你。状态显示在侧边栏底部，是一枚带当前状态的彩色胶囊标记。点击它可以在四个选项里选一个：

- **Active**：在线，有空。
- **Idle**：离开时自动设置。
- **Do Not Disturb**：屏蔽自主消息。
- **Invisible**：对角色隐藏你的状态。

胶囊标记旁边是 **What are you doing?** 输入框。想让角色知道你在忙什么，就在这里写一句简短的自定义活动。在线状态是全局的，在所有聊天里都一样。

## 表情回应和通知

任何一条 Conversation 消息都可以加 emoji 回应。用消息上的回应按钮就能加上自己的回应。Marinara 会把回应存成一条类似 `[User reacted with ...]` 的注记，后续回复能读到它，角色也就知道你做出了回应。

**Reactions** 命令组开启后，角色也能做出回应，既可以回应你的消息，也可以回应彼此的消息。这一点在群聊里特别好用：角色不用发一整条消息，也能轻轻地接一下话。

当角色在你没打开的聊天里给你发消息时，屏幕边缘会浮出一个头像气泡。点击气泡可以跳到那条聊天，也可以用 X 关掉。在手机上，多个待处理的气泡会收成一个可点击的气泡组。

## 自拍

角色可以给你发自拍，也就是 AI 生成的角色照片。自拍和 Roleplay、Game Mode 里用的场景美术不一样，因为一张自拍只属于一个角色。

要用自拍，先从 **Agents → Download Agents** 安装 **Illustrator**。然后打开聊天设置面板，进入 **Agents → Illustrator Settings**，设置一个 **Selfie Connection**(自拍连接)。自拍连接指的是一个图像生成服务商。每张自拍会消耗一次图像生成调用。

完整设置，包括风格、分辨率和手动请求按钮，见[自拍](selfies.md)。

## 桌面游戏

Conversation 模式有六个可选的桌面游戏包：**UNO**、**Chess**、**Poker**、**8-Ball Pool**、**Tic-Tac-Toe** 和 **Rock-Paper-Scissors**。到 **Agents → Download Agents** 安装想玩的游戏。发牌、摆盘和规则判定都由应用负责，每个角色会以自己的口吻讲述自己的每一步。桌面游戏只能在 Conversation 聊天里运行。

开一局游戏有三种方式：

1. 在消息框里输入斜杠命令，然后按 Enter。
2. 直接发一句普通消息，比如“let's play uno”。
3. 让角色来邀请你，前提是对应的命令组已开启。

斜杠命令如下：

```
/uno
```

```
/chess
```

```
/poker
```

```
/8ball
```

```
/tictactoe
```

```
/rps
```

每个游戏都有自己的设置框和选项。完整规则、设置框和棋盘牌桌，见 [Conversation 桌游](table-games.md)。

## 角色日程

Conversation 聊天里的每个角色都可以有一份每周日程。日程在一张 7 天 24 小时的网格上安排角色的状态和活动，让自主消息显得有作息感：标记为离开的角色，在那些时段就不会来找你。

设置时开启 **Generate Schedules** 就能生成日程。也可以之后在聊天设置面板的 **Autonomous Messaging** 部分里创建或编辑。[角色日程与自主消息](schedules.md)详细介绍了完整的日程编辑器、每日上限，以及用来手动改写状态的 `/status` 命令。

## 故障排查

### 自主消息太频繁

打开聊天设置面板，在 **Autonomous Messaging** 部分关掉 **Autonomous Messages**。也可以把在线状态设成 **Do Not Disturb**，它会屏蔽自主消息。如果用了日程，就在[角色日程与自主消息](schedules.md)里把更多时段标成离开。

### 群聊里某个角色什么都要接一句

群聊有控制发言回合的选项，比如 **Reply When Mentioned**(被提到时才回复)。打开[群聊](../chats/group-chats.md)，设置谁在什么时候发言。

### 角色忘了前面发生的事

聊天一长，模型的记忆就装满了。可以换一个上下文窗口更大的模型，或者把关键设定写进世界书条目，让它们一直留在上下文里。也可以用同一个角色和用户角色重开一条聊天。更多帮助见 [Marinara Engine 故障排查](../TROUBLESHOOTING.md)。

### 自拍不像那个角色

打开 **Selfies** 设置，把 **Attach Card Appearance**(附带角色卡外貌) 设为 **Images only**(仅图片) 或 **Images and videos**(图片和视频)。如果图像服务商支持参考图，再设置 **Send Avatar References**(发送头像参考图)。细节见[自拍](selfies.md)。

## 相关指南

- [Conversation 音频和视频通话](calls.md)
- [角色日程与自主消息](schedules.md)
- [Conversation Mode 个人资料](profiles.md)
- [自拍](selfies.md)
- [自定义表情、贴纸和 GIF](emoji-stickers-gifs.md)
- [Conversation 桌游](table-games.md)
- [把 Conversation 聊天连接到 Roleplay 或 Game](../chats/connected-chats.md)
