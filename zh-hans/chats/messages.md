# 消息操作：编辑、删除、备选回复、重新生成

本指南介绍在聊天里能对单条消息做哪些操作，包括消息工具栏、怎么编辑和删除一条消息，以及备选回复和重新生成分别是怎么工作的，还有用来显示 Token 数量和消息编号的两个开关。

Marinara Engine 里的每条消息都带一个小工具栏，你写的和 AI 写的都有。在电脑上把鼠标移到消息上，或者在手机、平板上点一下消息，工具栏就会出现。

## 消息工具栏

下面这些按钮会出现在消息上。有几个只在特定情况下才显示，表格里注明了。每个按钮都有提示文字，和这里列出的标签一致。

| 按钮 | 作用 | 出现时机 |
| --- | --- | --- |
| **Copy**(复制) | 复制消息文字。图标会短暂变成一个对勾。 | 始终显示 |
| **Add reaction**(添加表情反应) | 打开表情选择器，为这条消息添加或取消你的表情反应。 | 仅 Conversation(对话模式) 下 |
| **Translate**(翻译) / **Hide translation**(隐藏译文) | 把消息翻译成你的语言，再把译文收起来。 | 始终显示 |
| **Edit**(编辑) | 让消息进入编辑状态。见下文。 | 始终显示 |
| **Regenerate**(重新生成) | 生成一条新的备选回复。见下文。 | AI 消息上。Roleplay(角色扮演) 模式下，你自己的消息上也有。Conversation 模式下，由 Impersonate 代写的你的消息上也有 |
| **Show original before rewrite**(显示改写前的原文) / **Show rewritten version**(显示改写后的版本) | 在原文和改写后的文字之间来回切换。两个版本都会保留，可以对比，也可以留下更喜欢的那个。 | 只有智能体改写过这条消息之后 |
| **Hide from AI**(对 AI 隐藏) / **Unhide from AI**(恢复对 AI 显示) | 让后续回合不再把这条消息发给 AI，或者恢复发送。在 Roleplay 群聊里会打开一个角色选择器。 | 始终显示 |
| **Peek prompt**(查看提示词) | 显示 AI 为这条回复实际收到的提示词。 | 只在最新一条 AI 消息上 |
| **Stored guidance**(已保存的引导) | 显示引导这条回复的方向说明。 | 只有这条回复用了引导方向，或者由 Impersonate 代写时 |
| **Branch from here**(从这里分支) | 把这条消息之前的聊天复制成一个新分支。 | 始终显示 |
| **View model thoughts**(查看模型思考过程) | 打开模型隐藏的推理文字。 | 只有模型返回了推理内容时 |
| **Delete**(删除) | 删除这条消息。见下文。 | 始终显示 |
| **Pause speaking**(暂停朗读) / **Resume speaking**(继续朗读) / **Restart speaking**(重新朗读) | 控制这条消息的语音朗读。 | 只有 Text to Speech 开启并且正在朗读时 |

**Peek prompt** 查看器见 [Peek Prompt](peek-prompt.md)。**Branch from here** 见[聊天分支](branches.md)。**Translate** 见[消息翻译](../integrations/message-translation.md)。朗读控制见 [Text to Speech (TTS) 设置](../media/tts-setup.md)。引导方向、**Stored guidance** 和 Impersonate 见[引导生成与 Impersonate](guided-and-impersonate.md)。

## 编辑消息

任何一条消息都能改文字，你的和 AI 的都行。

1. 点击消息上的 **Edit**，文字会变成一个可编辑的输入框。
2. 改文字。
3. 点击 **Save**(保存)，或者按 Ctrl + Enter(Mac 上是 Cmd + Enter)。按钮提示文字是 **Save (Cmd+Enter)**。
4. 不想保存就点 **Cancel**(取消)，或者按 Esc 键。按钮提示文字是 **Cancel (Esc)**。

有两个设置能让你更快进入编辑状态，都在 **Settings**(设置) → **General** 选项卡的 **Input & Editing** 分组里。

- **Up Arrow edits last message**(默认开启)：输入框为空时按 Up Arrow 键，最近一条消息就会进入编辑状态。
- **Double-click edits messages**(默认开启)：双击一条 Roleplay 消息，或者在触屏上点两下，它就会进入编辑状态。

## 删除消息

删除消息时会弹出一个标题为 **How to proceed?** 的窗口，可选的删除方式有：

- **Delete only this swipe (1/3)**：只删掉当前正在看的这一条备选回复。只有当消息带多个备选回复时才会出现这一项。括号里的数字表示当前是第几条备选回复，一共有几条。
- **Delete this message**：删掉整条消息，连同它的所有备选回复。
- **Delete more**：选中这条消息以及它下面的所有消息，同时开启消息多选，删除前还能调整选中范围。
- **Cancel**：关掉窗口，什么都不删。

系统消息，比如“joined the chat”这样的一行，只有一个简单的删除按钮，不会弹出窗口。

## 备选回复：同一轮的其他版本

备选回复就是 AI 回复的某一个版本。一条消息可以存好几条备选回复，方便对比同一轮的不同答案，再挑一条喜欢的。

消息有两条或更多备选回复时，上面会出现一组备选回复控件，显示当前是第几条和总共几条，比如“2/4”，控件包括：

- **Previous swipe**(上一条备选回复) 和 **Next swipe**(下一条备选回复)：在备选回复之间往前或往后翻。
- 一个数字输入框：输入序号后按 Enter 直接跳过去。提示文字是 **Jump to swipe 1-N**，其中 N 是总数。
- **Generate next swipe**(生成下一条备选回复)：翻到最新一条备选回复时，往后翻的按钮会变成这个，点它会生成一条全新的备选回复。

一条消息的最后一条备选回复删不掉。硬删的话，应用会提示“Cannot delete the last remaining swipe”。要整条删除，请改用 **Delete this message**。

## 重新生成、续写和重试

这三个操作看着像，实际做的事完全不同，按需要挑一个。

**Regenerate** 会生成一条新的备选回复。在 AI 消息上点 **Regenerate**，就会为这一轮另外生成一个版本，原来那条备选回复照样保留。在触摸屏上，应用会先问一句“Regenerate this message as a new swipe?”，免得误触。准备好引导方向之后，按钮会变成 **Regenerate (guided)**。

**/continue** 命令是在同一条消息上接着写。在输入框里输入 `/continue`(简写 `/cont`) 发送，AI 会从上一条回复断掉的地方继续，把新文字加到那条消息里，而不是新建一条备选回复。

默认情况下，Marinara 会在续写的文字前面加一个空行。想让续写紧接着上一段的最后一个字符，就关闭 **Settings → General → Responses → Add a new line before /continue text**。这样 Marinara 会让模型从断点处严丝合缝地接着写，中间不加分隔。

```
/continue
```

空输入重试会生成一条全新的回复。如果聊天里最后一条消息是你发的，而输入框是空的，那么同一个 **Send**(发送) 按钮就会变成重试，外观不变。点它或者按 Enter，不用重打一遍消息就能拿到回复。在 Roleplay 模式下，空着点 **Send** 还能推动 AI 用新的一轮继续场景。这和 **/continue** 不一样：空输入重试永远是新建一条回复，**/continue** 是在已有的那条后面接着写。

## 对 AI 隐藏消息

AI 上下文就是应用每一轮发给 AI 的那批消息。点击 **Hide from AI**，这条消息在之后的回合里就不会进入上下文。消息你自己还看得见，上面会带一个 **Hidden from AI** 标记。点 **Unhide from AI** 就恢复发送。

在有多个角色的 Roleplay 群聊里，**Hide from AI** 会打开一个紧凑的头像选择器。选群组头像表示对所有人隐藏，选一个或多个角色头像则只对这些角色隐藏。选了所有人会清空单选，选了单个角色则会关掉所有人这一项。消息上那个划掉的眼睛图标会显示看不到它的角色头像。在单角色聊天里，这个按钮还是直接隐藏或恢复消息。

如果只对某个角色隐藏消息，而消息里有发给这个角色的耳语，耳语仍会送达：该角色能收到耳语，但收不到消息的其余部分。对所有人隐藏消息时，其中的耳语也会一并移除。见[耳语与秘密](../roleplay/getting-started.md#whispers-and-secrets)。

也可以用 `/hide [range] [name (optional)]` 隐藏消息，例如 `/hide 3-8`。在 Roleplay 中，`/hide 3-8 Maukie` 只对 Maukie 隐藏这些消息；省略名字则对所有角色隐藏。`/unhide [range]` 会恢复全局隐藏的消息。要取消针对特定角色的隐藏，在 Roleplay 群聊中使用头像选择器，在只有一个角色的 Roleplay 聊天中使用消息上的 **Unhide from AI** 操作。消息编号从 1 开始，从聊天里的第一条消息数起。格式和示例见[斜杠命令参考](slash-commands.md)。

开启 Advanced Memory 的 **Decide who sees new messages**(决定谁能看到新消息) 后，在角色逐个回复的群聊里，新消息会自动对不在场的角色隐藏，并带上同样的标记。你自己更改某条消息的隐藏设置时，始终以你的选择为准；见[决定谁能看到新消息](../agents/memory.md#deciding-who-sees-new-messages)。

## 消息显示开关

有两个开关控制消息上额外显示哪些信息，都在 **Settings** 的 **Advanced** 选项卡，**Message Tools** 分组里，默认都是关闭的。

- **Show message numbers**：在每条消息上显示编号。编号从聊天第一条消息开始算，从 1 起。`/goto`、`/hide`、`/unhide` 这几个命令用的就是这套编号。需要查某条消息的编号时把它打开。
- **Show token usage on messages**：给 AI 回复加上单条消息的 Token 数。Token 是 AI 读写文本时切分出的最小单位。这里会显示这条回复的提示词 Token 数和补全 Token 数，条件允许时还会显示缓存命中情况和这条回复用了多长时间。

同一个 **Message Tools** 分组里还有一个相关开关 **Show model name on messages**，它会显示写出每条回复的 AI 模型名，默认同样是关闭的。

如果为了让提示词放得下，不得不把较早的消息排除在外，回复下方会有一条简短提示说明排除了多少条，例如“1109 older messages not sent”。要隐藏回复下方的这条提示，在同一个分组里关掉 **Show "older messages not sent" note**(显示“较早消息未发送”提示)。打开 Checkup 时仍然可以看到它。它默认开启。关于回复被截断或返回为空的提示仍会显示。

## 相关指南

- [发送消息与流式输出](sending-and-streaming.md)
- [引导生成与 Impersonate](guided-and-impersonate.md)
- [Peek Prompt](peek-prompt.md)
- [聊天分支](branches.md)
- [Text to Speech (TTS) 设置](../media/tts-setup.md)
- [消息翻译](../integrations/message-translation.md)
- [设置总览](../settings/settings-overview.md)
- [Marinara Engine 故障排查](../TROUBLESHOOTING.md)
