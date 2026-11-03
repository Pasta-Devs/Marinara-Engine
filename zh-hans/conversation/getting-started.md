# Conversation 模式：入门

Conversation(对话模式) 是即时通讯风格的聊天模式：一个或多个角色、一个输入栏，以及一段可以往上翻的历史记录，就像给朋友发消息一样。它没有游戏主持人（GM），也没有场景美术。角色还可以主动给你发消息、按每周日程作息、发送自拍和玩桌游。这些功能只存在于这个模式中。

## 开始一个 Conversation 聊天

**开始之前：** 在 **Connections**(连接) 中添加一个账号（参见[连接 AI 服务商](../connections/connecting-to-a-provider.md)），并至少有一个角色。用户角色是代表你自己的角色卡，可选（参见[用户角色](../characters/personas.md)）。

1. 在聊天侧边栏中打开 **CONVO** 选项卡，然后点击 **New Conversation**(新建 Conversation 聊天)。随即打开一个四页的设置向导。
2. 在第一页 **Name & Connection**(名称与连接) 中，为聊天命名，并选择负责生成回复的账号。
3. 在第二页 **Prompt Preset**(提示词预设) 中，选择 Conversation 提示词所用的预设，也可以保持默认。
4. 在第三页 **Persona & Characters**(用户角色与角色) 中，选择你的用户角色，以及一个或多个角色。
5. 在最后一页 **Automation**(自动化) 中，选择角色可以自主行动的程度（见下表）。
6. 点击 **Start Chatting**(开始聊天)。

一个角色是私聊。两个或更多角色就是群聊，不需要额外的模式。轮流发言的规则参见[群聊](../chats/group-chats.md)。

如果没有成功：**Start Chatting** 需要一个账号和至少一个角色。你可以关闭向导，稍后在 **Chat Settings**(聊天设置) 中完成所有设置。

## 选择自动化选项

| 选项 | 默认 | 作用 |
| --- | --- | --- |
| **Autonomous Messages**(自主消息) | 开启 | 当你一段时间没有动静时，角色会先给你发消息。 |
| **Generate Schedules**(生成日程) | 关闭 | 为每个角色生成每周作息。仅在 **Autonomous Messages** 开启时显示。 |
| **Commands**(命令) | 关闭 | 角色自主行动的总开关。 |

打开 **Generate Schedules**，然后在出现的字段中选择你的时区。在 **Chat Settings** 中，同一个开关叫 **Schedules**(日程)。日程以及自主消息的每日上限见[角色日程与自主消息](schedules.md)。

之后可以在 **Chat Settings → Autonomous Messaging**(自主消息设置) 中修改这些选项。如果角色发消息太频繁，请在那里关闭 **Autonomous Messages**，或把你的在线状态设为 **Do Not Disturb**(勿扰)。

<a id="choose-which-commands-a-character-can-use"></a>
## 选择角色可以使用的命令

命令是角色自己决定执行的动作。你不需要输入它们。设置完成后，打开 **Chat Settings → Agents → Commands**。总开关 **Commands** 管控所有命令组：它关闭时，任何命令组都不会生效。

每个命令组都有自己的开关。除 **Videos**(视频) 需要你自己打开外，其他开关默认都是开启的。属于可选智能体的命令组，只有你在 **Agents → Agent Organizer** 中安装该智能体后才会显示。

| 命令组 | 角色可以做什么 | 需要的智能体 |
| --- | --- | --- |
| **Schedule Updates**(更新日程) | 更改自己当前的状态。 | 无 |
| **Cross-Post**(跨聊天转发) | 把消息发送到另一个聊天。 | 无 |
| **Memories**(记忆) | 为其他角色创建记忆。 | 无 |
| **Scenes**(场景) | 开启一段沉浸式场景。 | 无 |
| **Influence**(影响) | 影响一个已连接的聊天。 | 无 |
| **Notes**(笔记) | 为已连接的聊天保存长期笔记。 | 无 |
| **Reactions**(表情回应) | 用 emoji 角标回应消息。 | 无 |
| **Selfies**(自拍) | 请求生成一张自拍。 | Illustrator |
| **Videos**(视频) | 发送短视频消息。 | Illustrator |
| **Music**(音乐) | 通过当前的音乐播放器播放歌曲。 | Music DJ |
| **Haptics**(触感) | 控制已连接的触感设备。 | Haptic Feedback |
| **Calls**(通话) | 给你打来电话。 | Calls |
| **UNO** | 开始或接受一局 UNO。 | UNO |
| **Chess**(国际象棋) | 接受国际象棋挑战。 | Chess |
| **Poker**(扑克) | 入座参加德州扑克。 | Poker |
| **8-Ball Pool** | 摆好球，开始一局台球。 | 8-Ball Pool |
| **Tic-Tac-Toe**(井字棋) | 接受井字棋挑战。 | Tic-Tac-Toe |
| **Rock-Paper-Scissors**(石头剪刀布) | 接受一场对局。 | Rock-Paper-Scissors |

**Influence** 和 **Notes** 的说明见[把 Conversation 聊天连接到 Roleplay 或 Game](../chats/connected-chats.md)。表格最后一列写的是需要从 **Agent Organizer** 安装的智能体。

<a id="your-presence-status"></a>
## 你的在线状态

你的在线状态是侧边栏底部的一枚彩色胶囊标记。它在所有聊天中都相同。点击它即可选择：

| 状态 | 含义 |
| --- | --- |
| **Active** | 你在线。 |
| **Idle** | 你暂时离开。 |
| **Do Not Disturb** | 停止自主消息。 |
| **Invisible** | 对模型隐藏你的状态。 |

如果你保持 **Active** 状态且 10 分钟没有操作，Marinara 会把状态设为 **Idle**，你回来后再改回 **Active**。如果你自己选了一个状态，这项自动切换会停止，直到你重新选择 **Active**。**Idle** 不会阻止角色的主动消息。

胶囊标记旁边是状态框。框为空时显示 “What's up?”。在那里输入你当前在做什么（最多 120 个字符），角色就能知道。最近的内容会显示在 **Recent status**(最近状态) 下，方便你重复使用。

<a id="react-and-get-notified"></a>
## 回应与通知

在消息上使用 **Add reaction**(添加回应)，即可用 emoji 回应。之后的回复能看到你的回应。开启 **Reactions** 命令后，角色也能回应你的消息以及彼此的消息。

当角色在你没有查看的聊天中发言时，屏幕边缘会出现一个头像气泡。点击它即可打开该聊天，点击其中的 X 则可关闭它。在手机上，多个气泡会合并成一组，你可以点击展开。

## 需要知道的事

Conversation 聊天不使用角色卡的 **First Message**(开场白)，也不使用 **Dialogue Highlight Color**(对白高亮颜色) 和 **Message Box Color**(消息框颜色)。**Name Display Color**(名字显示颜色) 仍会为每条消息上方的名字上色。参见[这些颜色分别用在哪里](../characters/colors-and-stats.md#where-your-colors-show)。

## 相关功能

- [自拍](selfies.md)：角色发送它们自己的生成照片。
- [Conversation 音频和视频通话](calls.md)
- [Conversation 桌游](table-games.md)：用 `/uno`、`/chess`、`/poker`、`/8ball`、`/tictactoe` 或 `/rps` 开始一局游戏。
- [角色日程与自主消息](schedules.md)
- [Conversation 模式个人资料](profiles.md)
- [自定义表情、贴纸和 GIF](emoji-stickers-gifs.md)
- [把 Conversation 聊天连接到 Roleplay 或 Game](../chats/connected-chats.md)

## 故障排查

| 症状 | 解决方法 |
| --- | --- |
| 角色发消息太频繁 | 关闭 **Autonomous Messages**，把在线状态设为 **Do Not Disturb**，或在[日程](schedules.md)里把更多时段标为离开。 |
| 群聊里某个角色什么都要接一句 | 在[群聊](../chats/group-chats.md)中设置谁来发言。 |
| 角色忘了前面的聊天内容 | 使用上下文窗口更大的模型（即一次能读取的文字量），或把关键事实添加到世界书条目中。 |
| 自拍不像那个角色 | 参见[自拍](selfies.md)。 |

更多帮助：[Marinara Engine 故障排查](../TROUBLESHOOTING.md)。
