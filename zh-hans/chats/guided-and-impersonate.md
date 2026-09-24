# 引导生成与 Impersonate

本指南介绍在 Marinara Engine 里左右聊天走向的两种办法。引导生成能给 AI 指个方向，同时不会在聊天里留下可见的消息。Impersonate(替你发言) 则让 AI 替你写出你自己的那条回复。此外还会讲到 Quick replies 菜单，它把这两个操作直接放在 Send(发送) 按钮旁边。

## 引导生成

引导生成用来告诉 AI 下一条回复该往哪个方向走。这条指示属于戏外内容，只影响回复走向，不会作为普通聊天消息显示出来。

### 用 /guided 引导一条回复

引导回复主要靠 `/guided` 斜杠命令。

1. 在消息输入框里输入 `/guided`，后面接上你的方向说明。
2. 按 Enter 或点击 Send。
3. AI 会按照给出的方向生成下一条回复。

比如下面这条方向说明，会把接下来的回复推向坦白：

```
/guided make him admit he is lying
```

这个命令有几个简写。`/narrator`、`/narrate`、`/nar` 都等同于 `/guided`。

在群聊里，方向说明还可以只针对某一个角色。输入 `/guided respond for <character> <direction>`，把 `<character>` 换成角色名，`<direction>` 换成你的指示。例如：

```
/guided respond for Alice make her admit she is lying
```

### 引导式重新生成

重新生成一条回复时也可以顺带引导。这种方式会把消息输入框里已经打好的文字当成一次性的方向说明。

1. 打开 **Settings**(设置)，进入 **Advanced**(高级)，再进入 **Message Tools**(消息工具)。
2. 开启 **Guide swipes/regens with chat input**。这个设置默认是关闭的。
3. 回到聊天界面，在消息输入框里写下方向说明，但先不要发送。
4. 在 AI 消息上点击 **Regenerate**(重新生成)。

设置开启、且输入框里有文字时，**Regenerate** 按钮的提示文字会变成 **Regenerate (guided)**。AI 会以输入的文字为方向，重做一版回复。

### 查看 Stored guidance

一条回复如果带着方向说明生成，Marinara 会把这条说明保存下来供你日后查看。消息上会出现 **Stored guidance**(已保存的引导) 操作，图标是一卷卷轴。

1. 在 AI 消息上点击 **Stored guidance** 图标。
2. 一个标题为 **Stored guidance** 的窗口会打开，里面显示的就是促成这条回复的方向说明。

窗口会按来源给方向说明标注出处：

- **/guided**：方向说明来自 `/guided` 命令。
- **Guided regenerate**：方向说明来自一次引导式的 **Regenerate** 点击。
- **Game start**：方向说明来自 Game Mode 的初始设置。

对于 `/guided` 和引导式重新生成产生的方向说明，还有一个 **Copy /guided** 按钮，可以把这条说明复制成一条可以直接用的 `/guided` 命令。粘贴到另一个聊天里，就能沿用同一个引导方向。

## Impersonate

Impersonate 会让 AI 用用户角色的口吻，替你写出下一条消息。用户角色就是你扮演的那个角色，在聊天里以 `{{user}}` 的形式写入。设置方法见[用户角色](../characters/personas.md)。

Impersonate 只在 Roleplay(角色扮演) 聊天里可用，Conversation(对话模式) 和 Game(游戏) 聊天里都没有。在 Conversation 聊天里尝试使用时，会看到提示“Impersonate is not available in Conversation mode.”

### 使用 /impersonate

1. 在消息输入框里输入 `/impersonate`，后面可以选择性地接一段方向说明。
2. 按 Enter 或点击 Send。
3. AI 会以用户角色的身份写一条用户消息，并发到聊天里。

比如下面这条会让 AI 用你的口吻写一条询问天气的消息：

```
/impersonate ask about the weather
```

这个命令有一个简写，`/imp` 等同于 `/impersonate`。

Impersonate 写出来的消息可以重做。**Regenerate** 操作对由 Impersonate 生成的用户消息同样有效，点一下就能换一个版本。

### Impersonate 相关设置

Impersonate 有一组设置，对你运行的每一次 `/impersonate` 都生效，所有聊天通用。入口在单个聊天的设置里。

1. 在一个 Roleplay 聊天里打开 **Chat Settings**(聊天设置) 面板。
2. 找到 **Impersonate** 这一节。

这一节包含以下几项：

- **Prompt Template**(提示词模板)：一段可选的指示，每次执行 impersonate 都会发给模型。留空则使用聊天自己的提示词；聊天没有提示词时，使用内置的默认值。这里支持 `{{user}}`、`{{persona_description}}` 和 `{{impersonate_direction}}` 三个宏。宏就是一段占位符，Marinara 会在发送前把它替换成真实文字。点击 **Built-in default** 可以查看默认文本。**Reset** 按钮会把自定义模板清空。
- **Preset**(预设)：只为 impersonate 回复指定一个提示词预设。预设就是保存好的一组提示词设置，详见[预设](../prompts/presets.md)。默认值是 **Use chat default**。预设只在 Roleplay 里生效。
- **Connection**(连接)：把 impersonate 回复交给指定的连接处理，比如更便宜或更快的模型。连接就是保存下来的一套 AI 服务接入信息，详见[连接 AI 服务商](../connections/connecting-to-a-provider.md)。默认值是 **Use chat default**，也可以选 **Random**。
- **Skip agents**(跳过智能体)：开启后，Marinara 在 impersonate 期间会跳过智能体流水线，包括追踪器、世界书路由等各类辅助智能体。这样 impersonate 更快，也不会改动世界状态。默认关闭。详见[智能体](../agents/agents-overview.md)。
- **Use CYOA as direction**(把 CYOA 选项当作方向说明)：开启后，点击一个 CYOA 选项会把它当成 impersonate 的方向说明，而不是作为普通消息发出去。CYOA 指的是自选冒险，也就是某些聊天在回复之后给出的一组可点击选项。这个设置默认关闭。

### 为单个聊天设置自定义 impersonate 提示词

用斜杠命令还能只给某一个聊天设置 impersonate 提示词。

1. 输入 `/impersonate_prompt`，后面用引号括上你的提示词。
2. 按 Enter。

例如：

```
/impersonate_prompt "You will now play as my OC:"
```

要清除这个聊天专属的提示词、恢复默认，输入：

```
/impersonate_prompt reset
```

这个命令有一个简写，`/imp_prompt`。

## Quick replies 菜单

Quick replies(快捷回复) 菜单会在普通的 Send 按钮旁边加上几个额外的发送操作，让你不用敲斜杠命令就能一键使用引导生成和 Impersonate。

具体显示哪些操作由设置决定。

1. 打开 **Settings**，进入 **Advanced**，再进入 **Message Tools**。
2. 开启 **Quick replies**，它默认是关闭的。
3. 展开这一项，挑选要显示的操作。菜单一旦启用，三个操作默认都是开启的。

这三个操作分别是：

- **Post only**(仅发布)：把打好的消息发到聊天里，但不触发 AI 回复。也可以用 `/send <message>` 斜杠命令执行。
- **Guide reply**(引导回复)：把打好的文字当成 `/guided` 方向说明发出去，而不是当成普通消息。
- **Impersonate**：以用户角色的身份生成一条回复，并以打好的文字为方向说明。这个操作在 Conversation 聊天里会被隐藏，因为 Impersonate 在那里用不了。

只开启一个操作时，它的按钮会直接显示在 Send 旁边。开启多个时，它们会收进一个小菜单，点击那个三点按钮（标注为 **Quick replies**）就能展开。

## 相关指南

- [消息操作：编辑、删除、备选回复、重新生成](messages.md)
- [Peek Prompt：查看 AI 收到的内容](peek-prompt.md)
- [用户角色：创建与编辑](../characters/personas.md)
- [预设](../prompts/presets.md)
