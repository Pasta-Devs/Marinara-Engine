# 斜杠命令速查

斜杠命令是在消息框里输入、以 `/` 开头的快捷指令，用来快速完成某件事。有些会立刻改动屏幕上的内容，有些则会让模型写点东西。

## 斜杠命令怎么用

1. 在聊天底部的消息框里输入命令。
2. 点击 **Send**(发送)；如果当前聊天模式开启了 **Send on Enter**(按 Enter 发送)，也可以按 <kbd>Enter</kbd>。见[发送与流式输出](sending-and-streaming.md#send-on-enter)。

一输入 `/`，输入框上方就会弹出匹配命令的菜单。每一行显示命令格式和一句简短说明。点击某一行，命令就会填进输入框，补上额外的文字后发送即可。输入框的提示文字也会提到命令：Roleplay(角色扮演) 中是 **Write your response, / for commands**，Conversation(对话模式) 中是“Message @Alice, / for commands”。

表格里每一行都写着该命令的格式。把 `[name]` 或 `[range]` 这样的方括号标签换成自己的值，不要输入方括号。标有 `(optional)` 的输入可以省略。`|` 用来分隔可选项。不少命令还有更短的别名，比如 `/cont` 就是 `/continue`。想在应用里查看全部命令，输入：

```text
/help
```

有些命令在浏览器里运行，不产生任何费用。另一些会让模型写文本，这会用到你的账号，可能消耗 Token(服务商计数和计费的单位)。

斜杠命令可以在 Conversation 和 Roleplay 的消息框里使用。在 Game(游戏模式) 中，只有不带范围或提示词的单独 `/illustrate`(或 `/ill`) 可用，而且要用图像账号设置好 Game 插图才行。其他以斜杠开头的输入都按普通文本发送。在 Roleplay 和 Conversation 中，`/illustrate`、`/selfie` 和 `/video` 命令需要 Illustrator 智能体，只有安装了它才会出现。

有几条命令要用到消息编号。Marinara 把聊天里的第一条消息记为 1 号。`/goto`、`/hide` 和 `/unhide` 用的就是这套编号。**Show message numbers**(显示消息编号) 会把编号显示出来。见[消息操作](messages.md#message-display-toggles)。

## 聊天与消息命令

这些命令在 Conversation 和 Roleplay 中都能用。

| 命令 | 作用 |
|---|---|
| `/help` | 列出全部斜杠命令。 |
| `/send` | 以你的用户角色身份发一条消息，不请求回复。宏会像用 **Send** 时一样被填入。格式：`/send [message]`。 |
| `/continue` | 在最后一条 AI 回复后面接着写，不新发一条消息。也可以用 `/cont`。**Settings → General → Responses → Add a new line before /continue text**(设置 → 常规 → 回复 → 在 /continue 文本前另起一行) 决定续写内容是空一行再开始，还是紧接着断点继续。 |
| `/goto` | 把聊天滚动到指定编号的消息。也可以用 `/jump`、`/scroll`。格式：`/goto [number]`。 |
| `/hide` | 在之后的回合里对模型隐藏消息。格式：`/hide [range] [name (optional)]`。 |
| `/unhide` | 恢复全局隐藏的消息。格式：`/unhide [range]`。 |
| `/sys` | 添加一条系统消息。它会显示在聊天里并影响模型，但不属于任何角色的发言。也可以用 `/system`。格式：`/sys [message]`。 |
| `/macros` | 列出 `{{user}}`、`{{char}}` 这类提示词宏。也可以用 `/macro`。 |
| `/remind` | 设一个定时器，到点在聊天里发出提醒。也可以用 `/reminder`、`/timer`。格式：`/remind [time] [message]`。 |

示例：

```text
/goto 27
/hide 3-8
/remind 30m check the oven
```

`/hide` 和 `/unhide` 接受单个编号、一段区间，或者两者混写：`/hide 5`、`/hide 3-8`、`/hide 2-5,9,12`。隐藏的消息仍留在聊天里，但模型不会读取。

在 Roleplay 中，在区间后面加上角色名，就能只对该角色隐藏这些消息。其他角色仍能看到。

```text
/hide 3-8 Maukie
/hide 2-5,9 "Powers That Be"
```

含空格的名字要加引号。名字在前的旧写法，比如 `/hide Maukie 3-8`，仍然可用。如果名字匹配多个角色，请使用全名。纯数字的名字要加引号，以免和消息编号混淆，例如 `/hide 1 "123"`。要查看或取消针对特定角色的隐藏，在 Roleplay 群聊中使用消息上的 **Hide from AI**(对 AI 隐藏) 头像选择器，在只有一个角色的聊天中使用 **Unhide from AI**(对 AI 恢复显示)。`/unhide` 只取消全局隐藏。

`/remind` 先跟时间，用 `h`(小时)、`m`(分钟) 或 `s`(秒) 表示，再跟提醒内容。提醒只存在于当前浏览器会话里，所以在它响起之前别关掉选项卡。

## 故事与角色扮演命令

| 命令 | 作用 |
|---|---|
| `/guided` | 引导下一条回复。也可以用 `/narrator`、`/narrate`、`/nar`。格式：`/guided [direction]`。 |
| `/as` | 以某个角色的身份发一条消息，或者请那个角色回复。也可以用 `/respond`。格式：`/as [name] [message (optional)]`。 |
| `/emote` | 列出或切换立绘表情。也可以用 `/emotion`、`/sprite`。格式：`/emote [expression]`。 |
| `/roll` | 掷骰子并把结果发出来。也可以用 `/r`、`/dice`。格式：`/roll [dice (optional)]`。 |
| `/random` | 让模型加一个意外事件。也可以用 `/rand`、`/event`。 |
| `/scene` | 从这段对话分支出一个 Roleplay 场景。也可以用 `/rp`。格式：`/scene [description (optional)]`。 |
| `/illustrate` | 仅限 Roleplay。生成一张图库图像，需要 Illustrator 智能体。也可以用 `/ill`。格式：`/illustrate [range=N-M] [prompt]`。 |
| `/html` | 仅限 Roleplay。在最新回复的末尾生成一件世界观内的物件，例如 `a spellbook page`。格式：`/html [what you want]`。 |
| `/video` | 仅限 Roleplay。为最新回复或你的描述生成一段短片，显示在这条回复下方。遵循 Illustrator 的 **First frame**(首帧) 设置，需要 Illustrator。格式：`/video [description]`。 |
| `/impersonate` | 以你的用户角色身份写一条回复。也可以用 `/imp`。格式：`/impersonate [direction (optional)]`。 |
| `/impersonate_prompt` | 设定本聊天里 `/impersonate` 使用的指令。也可以用 `/imp_prompt`。格式：`/impersonate_prompt [prompt or reset]`。 |

这些命令大多在 Roleplay 中效果最好。`/scene` 要在 Conversation 中运行。`/impersonate` 和 `/impersonate_prompt` 在 Conversation 中不可用。

### 引导回复

```text
/guided make him confess he is lying
/guided respond as "Powers That Be" describe the approaching storm
```

也可以用 `reply as` 或 `respond for` 代替 `respond as`。见[引导生成与 Impersonate](guided-and-impersonate.md)。

### 以角色身份发消息

省略消息内容时，模型会写出该角色的下一条回复。

```text
/as Dottore "The experiment begins."
/as Dottore
```

### 掷骰子

`/roll 2d6` 掷两颗六面骰。可以加修正值，比如 `/roll 1d20+5`。后面什么都不写时，`/roll` 会掷 `1d20`。只想保留部分骰子时，加上 `kh`(保留最高) 或 `kl`(保留最低) 和一个数字：`/roll 4d6kh3` 把最高的三颗相加，`/roll 2d20kl1` 保留两颗中较低的一颗。`dl` 和 `dh` 则分别丢弃最低或最高的骰子，例如 `/roll 4d6dl1`。不计入结果的骰子仍会显示，但会变暗。

### 切换立绘

立绘是带表情的角色美术图。单独输入 `/emote` 可以看到有哪些表情，也可以直接指定一个：

```text
/emote joy
/emote "Powers That Be" joy
```

只写名字不写表情时，会列出该角色的表情。这需要一个已上传立绘的 Roleplay 聊天。见[角色立绘](../characters/sprites.md)。

### 生成插图和物件

`/illustrate range=12` 为第 12 条消息生成插图，`/illustrate range=12-18` 把第 12 到 18 条消息交给 Illustrator。消息编号与 `/goto` 相同，按升序指定，最多 200 条。隐藏的消息会被排除。图片会附加到范围内最后一条可见消息上。开启 Advanced Memory 后，较早的消息仍可选。不带 `range=` 时，命令作用于当前场景。你输入的提示词会原样使用。

`/html a terminal readout` 不需要智能体，无论 **HTML Artifacts**(HTML 物件) 是否开启都能用。在 **Roleplay Commands**(Roleplay 命令) 下开启 **HTML Artifacts** 后，旁白也可以用 `[html: prompt="..."]` 发出同样的请求。见[按需生成物件](../roleplay/getting-started.md#artifacts-on-demand)。

### 代写你的回复

`/impersonate ask about the weather` 会用你的用户角色的口吻写一条回复。用户角色就是在聊天里代表你的那个角色，在提示词里写作 `{{user}}`。这两条命令在 Conversation 中不可用。

## Conversation 模式命令

这些命令只在 Conversation 聊天里有效。

| 命令 | 作用 |
|---|---|
| `/games` | 打开已安装游戏的选择器。`/game` 和 `/play` 的作用相同。 |
| `/selfie` | 用 Illustrator 智能体生成一张自拍。加上名字即可选择角色。格式：`/selfie [name (optional)]`。 |
| `/video` | 让角色发一条短视频消息，使用这个聊天的 **Video messages**(视频消息) 设置。见[视频消息](../conversation/selfies.md#video-messages)。格式：`/video [name (optional)]`。 |
| `/uno` | 和聊天里的角色开一局 UNO。 |
| `/chess` | 和一个角色单挑国际象棋。 |
| `/poker` | 和角色们开一局德州扑克。 |
| `/8ball` | 和一个角色单挑美式八球台球。`/pool` 的作用相同。 |
| `/status` | 设置或清除角色的在线状态。格式：`/status [online, idle, dnd, offline or clear] [name]`。 |

游戏命令会打开对应游戏的设置界面，每条命令只有在安装了对应的游戏智能体时才会出现。一个聊天里同时只能进行一局游戏。见 [Conversation 桌游](../conversation/table-games.md)。

`/status` 会覆盖角色的在线状态。状态可以是 `online`、`idle`、`dnd`(勿扰) 或 `offline`。`clear` 取消覆盖。如果聊天里有多个角色，在末尾加上名字。

```text
/status idle
/status online Alice
```
