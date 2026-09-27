# 斜杠命令速查

本指南列出在 Marinara Engine 聊天里可以输入的斜杠命令。斜杠命令是在消息输入框里以正斜杠开头的快捷指令，用来快速完成某件事。有些命令直接改动屏幕上的内容，有些则会让 AI 写点东西。

## 斜杠命令怎么用

在聊天底部的消息输入框里输入命令，然后点击 **Send**(发送) 就能运行。如果当前聊天模式在 **Settings**(设置) 里开启了 **Send on Enter**(按 Enter 发送)，按 Enter 也能发出去。默认情况下，Conversation(对话模式) 聊天里 Enter 是发送，Roleplay(角色扮演) 聊天里 Enter 是换行。消息输入框本身会提示斜杠命令：Roleplay 聊天的占位文字是 **Write your response, / for commands**，Conversation 聊天的占位文字显示角色名字，比如“Message @Alice, / for commands”；如果一个对话里有多个角色，显示的则是聊天名称。

只要输入一个斜杠，输入框上方就会弹出匹配命令的小菜单。每一行显示包含参数的命令格式和一句简短说明。点击或轻触某一行，命令就会填进输入框，接着补上额外的文字发送即可。

把 `[name]` 或 `[range]` 这样的方括号标签替换成自己的值，不要输入方括号。标有 `(optional)` 的参数可以省略。`|` 用来分隔可选项，既可以是 `prompt|reset` 这样的值，也可以是完整的命令格式。

不少命令还有更短的别名。比如 `/continue` 和别名 `/cont` 效果完全一样。想随时在应用里查看完整列表，运行这条命令：

```
/help
```

有些命令在浏览器里运行，立刻改动聊天内容，不产生任何费用。另一些命令会让 AI 生成文本，这会调用已连接的服务商，可能消耗 Token(模型切分和计费文本的最小单位)。下面的表格标明了每条命令的作用。

斜杠命令可以在 **Conversation** 和 **Roleplay** 的消息输入框里使用。在 **Game** 模式下，只有 `/illustrate` 会作为斜杠命令生效，其他以斜杠开头的输入都按普通文本发送。

有几条命令要用到消息编号。Marinara 把聊天里的首条消息记为 1，接着是 2、3，依此类推。`/goto`、`/hide`、`/unhide` 这类命令用的就是这套编号。

## 聊天与消息命令

这组命令用来管理聊天和其中的消息，在 **Conversation** 和 **Roleplay** 聊天里都能用。

| 命令 | 别名 | 作用 |
|---|---|---|
| `/help` | | 列出全部斜杠命令。 |
| `/send [message]` | | 以用户角色的身份发送消息，不触发生成。 |
| `/continue` | `/cont` | 在最后一条 AI 回复后面接着写，不新发一条消息。**Settings → General → Responses** 里的 **Add a new line before /continue text**(在 /continue 文本前另起一行) 选项决定续写内容是空一行再开始，还是紧接着断点继续。 |
| `/goto [number]` | `/jump`、`/scroll` | 按编号把聊天滚动到某条消息。 |
| `/hide [range] [name (optional)]` | | 让 AI 在之后的回合里看不到一条或多条消息。 |
| `/unhide [range]` | | 把隐藏的消息重新放回 AI 的视野。 |
| `/sys [message]` | `/system` | 添加一条系统消息。这条备注会出现在聊天里并影响 AI，但不属于任何角色的发言。 |
| `/macros` | `/macro` | 列出支持的提示词宏，比如 `{{user}}` 和 `{{char}}`。 |
| `/remind [time] [message]` | `/reminder`、`/timer` | 设一个定时器，到点在聊天里发出提醒消息。 |

跳到第 27 条消息，这样输入：

```
/goto 27
```

`/hide` 和 `/unhide` 接受单个编号、一段区间，或者两者混写。下面这条会隐藏第 3 到第 8 条消息：

```
/hide 3-8
```

也可以用 `/hide 5` 隐藏单条消息，或用 `/hide 2-5,9,12` 隐藏多条。不加角色名时，消息会对所有角色隐藏。隐藏的消息仍留在聊天中，但 AI 在下一轮不会读取。用 `/unhide` 配合同样格式的编号列表，可以恢复全局隐藏的消息。

在 **Roleplay** 中，把角色名加在区间后面，就能只对该角色隐藏这些消息：

```
/hide 3-8 Maukie
/hide 2-5,9 "Powers That Be"
```

其他角色的访问范围不变。把名字放在前面时，含空格的名字要加引号：原来的 `/hide Maukie 3-8` 和 `/hide "Powers That Be" 2-5,9` 格式仍然可用。如果名字匹配多个角色，请使用全名。纯数字角色名要加引号，以免和消息编号混淆，例如 `/hide 1 "123"`。在 Roleplay 群聊中，用消息上的 **Hide from AI**(对 AI 隐藏) 头像选择器查看或取消针对特定角色的隐藏。在只有一个角色的 Roleplay 聊天中，改用消息上的 **Unhide from AI**(对 AI 恢复显示) 操作。`/unhide` 只取消全局隐藏。

`/remind` 命令先跟时间，再跟提醒内容。时间用 `h` 表示小时，`m` 表示分钟，`s` 表示秒。下面这条会在 30 分钟后提醒：

```
/remind 30m check the oven
```

提醒只存在于当前浏览器会话里，所以在它响起之前别关掉选项卡。

## 故事与角色扮演命令

这组命令用来把控剧情走向、扮演角色、添加插图，大多在 **Roleplay** 聊天里效果最好。例外是 `/scene`，它要在 **Conversation** 聊天里运行。

| 命令 | 别名 | 作用 |
|---|---|---|
| `/guided [direction]` \| `/guided respond for [name] [direction (optional)]` | `/narrator`、`/narrate`、`/nar` | 按描述的方向引导 AI 的下一条回复。 |
| `/as [name] [message (optional)]` | `/respond` | 以某个角色的身份发一条消息，或者点名让某个角色回复。 |
| `/emote [expression (optional)]` \| `/emote "[name]" [expression (optional)]` | `/emotion`、`/sprite` | 列出或切换角色的立绘表情。 |
| `/roll [dice (optional)]` | `/r`、`/dice` | 掷骰子并把结果发出来。 |
| `/random` | `/rand`、`/event` | 让 AI 给故事加一个意外事件。 |
| `/scene [description (optional)]` | `/rp` | 在 Conversation 聊天里运行。从这段对话分支出一个新的 Roleplay 场景。 |
| `/illustrate [range=N\|range=N-M (optional)] [prompt (optional)]` | `/ill` | 为当前聊天生成一张图库图像。 |
| `/impersonate [direction (optional)]` | `/imp` | 以用户角色的身份写一条回复。 |
| `/impersonate_prompt [prompt\|reset]` | `/imp_prompt` | 设定本聊天里 `/impersonate` 使用的指示内容。 |

在 **Roleplay** 模式中，`/illustrate range=12` 会为第 12 条消息生成插图，`/illustrate range=12-18` 会将第 12 至 18 条消息交给 Illustrator。消息编号与 `/goto` 相同，必须按升序指定，最多选择 200 条消息。隐藏的消息仍会排除。图片会附加到范围内最后一条可见消息上；即使在审核提示词时收到新消息，所选范围也不会改变。开启 Advanced Memory 后仍可选择较早的消息。不带 `range=` 时，命令仍按原有方式为当前场景生成插图。可选的手动提示词也会像以前一样直接使用。

想引导下一条回复，把方向写在 `/guided` 后面：

```
/guided make him confess he is lying
```

在 Roleplay 群聊中，用 `/guided respond for [name] [direction (optional)]` 选择要回复的角色。例如：

```
/guided respond for "Powers That Be" describe the approaching storm
```

用 `/as [name] [message (optional)]` 以某个角色的身份发送文字。省略消息内容时，模型会改为生成该角色的下一条回复：

```
/as Dottore "The experiment begins."
/as Dottore
```

`/roll` 命令识别骰子表达式。下面这条掷两个六面骰：

```
/roll 2d6
```

还可以加修正值，比如 `/roll 1d20+5`。如果 `/roll` 后面什么都不写，Marinara 会掷 `1d20`。

立绘是带表情的角色美术图。`/emote` 命令负责切换当前显示的是哪一张。单独输入 `/emote` 可以看到有哪些表情，指定名字就切换过去：

```
/emote joy
```

要指定一个角色，使用 `/emote "[name]" [expression (optional)]`，例如 `/emote "Powers That Be" joy`。省略表情时，会列出该角色可用的表情。

切换立绘的前提是这个 Roleplay 聊天已经上传了立绘。添加方法见[角色立绘](../characters/sprites.md)。

用户角色就是在聊天里代表你的那个角色，在提示词里写作 `{{user}}`。`/impersonate` 命令替你写出一条回复，后面也可以补上方向：

```
/impersonate ask about the weather
```

`/impersonate` 和 `/impersonate_prompt` 在 **Conversation** 聊天里不可用。引导生成和代笔回复的完整说明见[引导生成与 Impersonate](guided-and-impersonate.md)。

## Conversation 模式专用命令

这组命令只在 **Conversation** 聊天里有效。

| 命令 | 作用 |
|---|---|
| `/games` | 打开已安装的 Conversation 游戏选择器。`/game` 和 `/play` 的作用相同。 |
| `/selfie [name (optional)]` | 通过已安装的 Illustrator 智能体生成自拍。加上名字即可选择角色。 |
| `/uno` | 和聊天里的角色开一局 UNO。 |
| `/chess` | 和一个角色单挑国际象棋。 |
| `/poker` | 和聊天里的角色开一局德州扑克。 |
| `/8ball` | 和一个角色单挑美式八球台球。`/pool` 效果相同。 |
| `/status [online\|idle\|dnd\|offline\|clear] [name (optional)]` | 设置或清除角色的在线状态。 |

`/uno`、`/chess`、`/poker`、`/8ball` 会打开对应游戏的设置界面。一个聊天里同时只能进行一局游戏。规则和选项见 [Conversation 桌游](../conversation/table-games.md)。

`/status` 命令会覆盖角色原本的在线状态。状态可以是 `online`、`idle`、`dnd`(勿扰) 或 `offline`。用 `clear` 取消覆盖。下面这条把角色设为 idle：

```
/status idle
```

如果聊天里有多个角色，在末尾加上角色名字，比如 `/status online Alice`。

## 相关指南

- [消息操作](messages.md)
- [引导生成与 Impersonate](guided-and-impersonate.md)
- [Conversation 桌游](../conversation/table-games.md)
- [宏](../prompts/macros.md)
