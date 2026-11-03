# Conversation Mode 个人资料（显示名称、自我介绍、行为指令）

每个角色和用户角色都有一份用于 Conversation(对话模式) 的小型聊天应用资料：显示名称、“关于我”简介和行为指令。这些字段在 Roleplay(角色扮演) 和 Game Mode(游戏模式) 中从不使用。

这里的个人资料不是设置方案（即一组保存下来的聊天选项，参见[设置方案](../chats/settings-profiles.md)）。第一次使用这个模式？请先阅读[Conversation 模式：入门](getting-started.md)。用户角色是代表你自己的角色卡。

## 这些字段在哪里

这些字段位于名为 **Convo**(对话) 的选项卡中。

1. 在 **Character Editor**(角色编辑器) 中打开角色，或在 **Persona Editor**(用户角色编辑器) 中打开用户角色。进入的方法是：从侧边栏打开 **Characters** 面板，或从右侧边栏顶栏的人形图标打开 **Personas** 面板，然后点击对应卡片（参见[创建和编辑角色](../characters/creating-and-editing-characters.md)和[用户角色](../characters/personas.md)）。
2. 点击 **Convo** 选项卡。

该选项卡包含 **Convo Display Name**(对话显示名称)、**About Me**(自我介绍) 和 **Convo Behavior**(对话行为)。角色还有 **Weekly schedule**(每周日程)，其中可以用 **Edit schedule**(编辑日程) 或 **Create schedule**(创建日程)，参见[日程](schedules.md)。还有 **Image generation instructions**(图像生成指令)，即该角色自拍的可选说明，参见[自拍](selfies.md)。

## 设置显示名称

**Convo Display Name**(对话显示名称) 是在 Conversation 聊天中显示的名字。留空则使用卡片上的名字。已有消息会立即更新。

角色还有 **Declare this name on the card in the prompt**(在提示词中的角色卡上声明此名称)。开启后，Marinara 会在提示词的角色卡文本中加入一行类似 “Conversation display name: X” 的内容（即 Marinara 发给模型的文本），让模型知道哪张卡使用哪个名称。这个选项需要先设置显示名称。

## 编写自我介绍

**About Me**(自我介绍) 是一段简短的简介：一两句话、一个 emoji、一个笑话，或者留空都可以。Marinara 每一轮都会把在场每个角色和用户角色的 About Me 加入提示词，让模型知道每个人如何介绍自己。这部分无需你做任何操作。

要填写它，可以这样做：

- 自己输入。工具栏里的 emoji 按钮可以插入 emoji。**Revert**(恢复) 会把文字恢复到你本次编辑之前的状态。
- 对已保存的角色，点击魔杖按钮（**Generate About Me from this card**(根据此卡生成自我介绍)）。
- 在首页向 **Professor Mari** 提出请求，例如 `Write Luna's About Me as a cryptic one-line bio.`。她会读取已保存的资料，以该人物的口吻写出简介并保存。你可以按常规审核流程保留或恢复她的改动。

如果没有成功：还没保存的卡片上没有魔杖按钮。请先保存卡片。

## 设置对话行为

**Convo Behavior**(对话行为) 是一条指令，规定角色或用户角色在 Conversation 模式中如何表现，例如：回复要简短、全部小写，并且像真人一样发消息。post-history 指令是放在最近聊天记录之后的提示词文本。如果你不编写自定义提示词，请保持默认值。使用 **Insertion**(插入位置) 选择该指令在提示词中的位置：

| 选项 | 指令放在哪里 |
| --- | --- |
| **Constant — after the card**(默认) | 始终加入，紧跟在角色卡文本之后。 |
| **Constant — before the card** | 始终加入，紧挨在角色卡文本之前。 |
| **Append to post-history** | 加在 post-history 指令的末尾。 |
| **Prepend to post-history** | 加在 post-history 指令的开头。 |
| **Replace post-history** | 替换 post-history 指令。 |
| **Only where {{convo_behavior}} is placed** | 仅在你于自定义提示词中放置宏的位置。 |

## 单个聊天专属的 About Me 覆盖

卡片上的 **About Me** 是所有地方的默认值。你也可以只为某一个聊天设置不同的简介。

1. 在 Conversation 聊天中，点击角色或用户角色的头像或名字。资料卡会在旁边打开（手机上从底部弹出）。
2. 阅读这张卡片。它显示头像、名字和当前的 **About Me**。标记会显示 **Default**(默认) 或 **Chat-specific**(聊天专属)。角色还会显示 **Online**、**Away**、**Busy** 或 **Offline**。
3. 点击 **Edit**(编辑)。
4. 输入这个聊天专用的简介。可以使用包含 **Custom emojis**(自定义表情) 选项卡的 emoji 选择器。
5. 点击 **Save**(保存)。你会看到 “Chat-specific about me saved” 的提示。

**Cancel**(取消) 会关闭编辑模式且不保存。**Revert**(恢复) 会撤销未保存的改动。**Clear**(清除) 会删除已有的覆盖，恢复为卡片的默认值。保存一段空白简介也会清除覆盖。

## 让角色更改自己的 About Me

这是一个高级选项。名为 `update_about_me` 的工具可以让角色在聊天过程中编辑自己的简介。它默认关闭。要使用它，请打开 **Chat Settings → Function Calling**(聊天设置 → 函数调用)，开启 **Enable Tool Use**(启用工具调用)，然后添加 `update_about_me` 工具。

角色可以在两种范围中选一种：

- Public 会改变每个聊天中都能看到的真实简介。你需先确认。
- Chat 只改变当前聊天中的私有简介。

## 自定义提示词中使用的宏

资料要进入模型，并不需要宏。只有在自定义提示词中需要把某个值放在精确位置时，才使用宏。在 Conversation 模式之外，每个宏都为空。参见[宏](../prompts/macros.md)。

| 宏 | 值 |
| --- | --- |
| `{{convo_display}}` | 正在回复的角色的显示名称。 |
| `{{char_about}}` | 角色当前生效的 About Me。 |
| `{{persona_about}}` | 用户角色当前生效的 About Me。 |
| `{{convo_behavior}}` | 角色的 Convo Behavior。 |

## 相关指南

- [Conversation 模式：入门](getting-started.md)
- [创建和编辑角色](../characters/creating-and-editing-characters.md)
- [用户角色：创建与编辑](../characters/personas.md)
- [宏](../prompts/macros.md)
