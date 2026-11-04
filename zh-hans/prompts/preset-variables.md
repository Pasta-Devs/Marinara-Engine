# 预设变量

预设变量是内置在提示词预设里、带标题的选择项。预设作者只需定义一次，之后任何人把这个预设分配给聊天时，都可以自己挑选项。用它可以让同一个预设表现出不同的行为，而不用改提示词原文。

给变量起个名字，写一句问题，再列出几个选项。然后在任意提示词小节里用双花括号写上这个名字，比如 `{{tone}}`。AI 生成回复时，Marinara 会把 `{{tone}}` 换成用户选中的那个选项值。

预设变量需要提示词预设，所以在 Roleplay(角色扮演) 聊天中生效。它们不适用于 Conversation(对话模式) 或 Game(游戏模式) 聊天，因为这两种聊天用的是单独一段提示词文本，而不是按小节组织。想了解预设本身，见[预设编辑器与提示词管理器](presets.md)。

## 预设变量的类型

带多个选项的变量默认是单选：用户只能选一个，界面上显示为单选按钮。有三项设置会改变这一点。

| 类型 | 怎么得到 | 行为 |
| --- | --- | --- |
| **Boolean Toggle**(布尔开关) | 给变量恰好一个选项。 | 一个开关。开启时插入该选项的值，关闭时什么都不插入。 |
| **Multi-Select**(多选) | 打开 **Multi-Select**。 | 用户可以选多个选项。各个值用分隔符连接，默认是 `, `。Romance、Fantasy 和 Action 会变成“Romance, Fantasy, Action”。 |
| **Random Pick**(随机抽取) | 打开 **Random Pick**。 | 对于单选变量，Marinara 会在每个新聊天中随机预选一个选项，这个选择会一直保持，直到你修改它。开启 **Multi-Select** 时，用户圈定一个选项池，每条回复从中抽取一个选项。 |

## 添加预设变量

1. 打开 **Presets**(预设) 面板，点击一个预设，打开 **Preset Editor**(预设编辑器)。
2. 切换到 **Sections**(小节) 选项卡，滚动到底部的 **Preset Variables**(预设变量) 面板。
3. 点击 **Add Variable**(添加变量)。会出现一张新的变量卡片，点击它展开。
4. 设置 **Variable Name**(变量名)。这个字段只保留字母、数字和下划线。这就是要写进花括号里的名字。
5. 填写 **Question (shown to user)**(向用户展示的提问)。用户挑选时会读到它。
6. 编辑 **Options**(选项) 列表。每个选项都有 **Label**(标题)，即用户看到的文字，还有 **Value**(值)，即插入提示词的文本。值留空就什么都不插入。
7. 在 **Presentation**(呈现方式) 下，选择 **Auto**、按钮样式（**Radios** 或 **Checkboxes**）或紧凑样式（**Dropdown** 或 **Listbox**）。打开 **Alphabetical option display**(选项按字母排序显示)，选项就会按标题排序。
8. 按 <kbd>Escape</kbd> 或点击 **Done**(完成)。改动会自动保存，底部写着“Changes auto-save. Press Escape to close.”

现在，在某个提示词小节里写上花括号名字。举个例子，在一个小节里放上 `{{tone}}`，再建一个名为 `tone` 的变量，给它一个 **Gentle** 选项和一个 **Harsh** 选项。用户选了 **Harsh**，这个小节就会收到它的值。

一个变量至少保留一个选项。想删掉最后一个选项时，Marinara 会把它留下。

## 回答变量

把带变量的预设分配给聊天时，**Configure Preset Variables**(配置预设变量) 窗口会打开。它写着：“This preset has configurable variables. Select option(s) for each to customize your experience.”

每个变量都会显示自己的问题、它的占位符（比如 `{{tone}}`），以及适用时的一个角标（**Boolean toggle**、**Multi-select** 或 **Random pick**）。

1. 为每个变量选一个值。
2. 点击 **Confirm Choices**(确认选择)。

其他按钮：

- **Save as default**(保存为默认) 把你的选择存到预设上，下次会预先填好。
- **Skip**(跳过) 关闭窗口，不保存。

只要还有单选变量没有取值，**Confirm Choices** 就一直不可用。**Boolean toggle** 和 **Multi-select** 变量不会挡住它，一个都没选也一样。切换到别的预设，会清空你对旧预设做的选择。

## 之后再改答案

在 **Chat Settings**(聊天设置) 里，如果选中的预设带有变量，**Prompt Preset**(提示词预设) 一节会显示一个铅笔按钮 **Edit preset variables**(编辑预设变量)。点击它，窗口会重新打开，里面是你当前的选择。

## 不是变量的名字

Marinara 会先解析 `{{user}}` 和 `{{char}}` 这类内置宏。然后，它把其他任何 `{{NAME}}`(字母、数字和下划线) 拿去和你的预设变量比对。如果没有对上的，它会尝试聊天自己的变量，也就是 **Chat Settings** 中 **Chat Variables**(聊天变量) 一节里的变量。两边同名时，预设变量优先。如果两边都没有这个名字，文本会原样保留，不会报错。见[提示词宏](macros.md)。

## 选项里的判定块

选项值和其他提示词文本一样，可以包含判定块 `{{#if decision:"..."}}`。只会询问聊天已选中的选项，它们会计入 **Decision statements per turn**(每回合判定陈述数)。对于 **Random Pick** 变量，池子里的每个选项都会被询问，因为任何一个都可能被抽中。见[询问 Decision 模型](conditional-prompts.md#asking-the-decision-model)。

变量值会出现在它的 `{{name}}` 所在的位置。如果判定在预设靠前的位置改变了这个值，可能会损失服务商的大部分提示词缓存复用。把频繁变化的内容放到后面。见[判定块与提示词缓存](presets.md#decision-blocks-and-prompt-caching)。

## 开场白

预设变量也会在角色开场白中替换，包括开场白创建之后才确认的选择。原始开场白仍可编辑，其中的宏完整保留。

## 相关指南

- [预设编辑器与提示词管理器](presets.md)
- [提示词宏](macros.md)
