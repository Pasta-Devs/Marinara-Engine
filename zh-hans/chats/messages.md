# 消息操作：编辑、删除、备选回复、重新生成

每条消息都带一个工具栏，你写的和 AI 写的都有。用它可以编辑、删除、重新生成或隐藏一条消息，也可以从这条消息开出分支。

在手机或平板上点一下消息，或者在电脑上把鼠标指向消息，工具栏就会出现。

## 消息工具栏

最常用的几个：

- **Edit**(编辑) 修改消息文字。
- **Regenerate**(重新生成) 让模型为一条 AI 回复生成一个新版本。每个版本叫作一条备选回复（swipe）。
- **Delete**(删除) 删除这条消息。

这些按钮都是图标，它们的标签列在下面。有些按钮只在特定情况下出现。

| 按钮 | 作用 |
| --- | --- |
| **Copy**(复制) | 复制消息文字。 |
| **Edit** | 让消息进入编辑状态。 |
| **Regenerate** | 生成一条新的备选回复（这条回复的另一个版本）。仅限 AI 消息。Roleplay(角色扮演) 中你自己的消息上也有，Conversation(对话模式) 中由 Impersonate 代写的你的消息上也有。 |
| **Delete** | 删除这条消息。 |
| **Translate**(翻译) / **Hide translation**(隐藏译文) | 把消息翻译成你的语言，之后再隐藏译文。 |
| **Add reaction**(添加表情反应) | 打开表情选择器。仅限 Conversation。 |
| **Hide from AI**(对 AI 隐藏) / **Unhide from AI**(恢复对 AI 显示) | 停止或恢复把这条消息发给模型。在 Roleplay 群聊里会打开一个角色选择器。 |
| **Bookmark, pin or note**(添加书签、固定或记笔记) | 给消息加书签；或者固定它，让它超出历史上限后仍留在提示词里（每个聊天最多 10 条）；或者添加一条 **Private note**(私人笔记)。除非开启 **Show the note to the narrator character**(向旁白角色展示笔记)，否则模型永远看不到笔记。这个开关适用于单角色聊天，以及角色各自回复的群聊。 |
| **Branch from here**(从这里分支) | 把截至这条消息的聊天复制成一个新分支。场景聊天里没有。 |
| **Clone from here**(从这里克隆) | 把截至这条消息的场景聊天复制成一段新的 Roleplay。仅限场景聊天。 |
| **Peek prompt**(查看提示词) | 显示这条回复实际使用的提示词。仅限最新一条 AI 消息。 |
| **Stored guidance**(已保存的引导) | 显示引导这条回复的方向说明。仅限用引导方向或 Impersonate 生成的回复。 |
| **View model thoughts**(查看模型思考过程) | 打开模型隐藏的推理内容。仅限模型返回了推理内容时。 |
| **Show original before rewrite**(显示改写前的原文) / **Show rewritten version**(显示改写后的版本) | 当某个智能体（随回复一起运行的辅助程序）改写过这条消息时，在原文和改写后的文字之间切换。 |
| **Mark as new start**(标记为新起点) | 仅限 Roleplay。开启 Advanced Memory(Marinara 的长期记忆功能) 时，让模型对这个聊天的记忆从这条消息开始。见 [Advanced Memory](../agents/memory.md)。 |
| **Pause speaking**(暂停朗读) / **Resume speaking**(继续朗读) / **Restart speaking**(重新朗读) | 在 Text to Speech(语音合成，用声音把消息朗读出来) 开启并正在朗读时，控制语音播放。 |

更多内容：[Peek Prompt](peek-prompt.md)、[聊天分支](branches.md)、[场景](../roleplay/scenes.md)（场景聊天是从某个聊天分支出来的一段简短 Roleplay）、[消息翻译](../integrations/message-translation.md)、[Text to Speech (TTS) 设置](../media/tts-setup.md)、[引导生成与 Impersonate](guided-and-impersonate.md)、[私人笔记](../roleplay/getting-started.md#your-private-notes)。

## 编辑消息

1. 点击消息上的 **Edit**，文字会变成一个可编辑的输入框。
2. 修改文字。
3. 点击 **Save**(保存)，或者按 <kbd>Ctrl</kbd>+<kbd>Enter</kbd>(Mac 上是 <kbd>Cmd</kbd>+<kbd>Enter</kbd>)。
4. 不保存就退出，点击 **Cancel**(取消) 或按 <kbd>Esc</kbd>。

**Settings → General → Input & Editing**(设置 → 常规 → 输入与编辑) 里有两个设置能让你更快进入编辑，两个都默认开启。

- **Up Arrow edits last message**(按上箭头编辑最后一条消息)：输入框为空时按 <kbd>Up</kbd>。
- **Double-click edits messages**(双击编辑消息)：双击一条 Roleplay 消息，或者在触屏上点两下。

## 删除消息

1. 点击消息上的 **Delete**，会打开 **Delete message**(删除消息) 对话框。
2. 选择其中一项。

| 选项 | 作用 |
| --- | --- |
| **Delete only this swipe (1/3)**(只删除这条备选回复) | 删除你正在看的这条备选回复。只有消息带多条备选回复时才显示。 |
| **Delete all other swipes**(删除其他所有备选回复) | 保留你正在看的这条备选回复，删除其余的。只有消息带多条备选回复时才显示。 |
| **Delete this message**(删除这条消息) | 删除整条消息及其所有备选回复。 |
| **Delete more**(删除更多) | 选中这条消息和它下面的每条消息，并打开选择栏。 |
| **Cancel** | 关闭对话框。 |

在选择栏里，点击消息就能把它们加进选择范围。**Select all messages above**(选择上方所有消息) 和 **Select all messages below**(选择下方所有消息) 用来扩大选择范围，**Unselect all**(取消全选) 清空选择，**Delete selected**(删除所选消息) 则把选中的消息删掉。选择栏会显示已选中多少条。

系统消息（比如一行“joined the chat”）点一下就会删除，不会弹出对话框。

## 备选回复：同一轮的其他版本

备选回复就是 AI 回复的一个版本。一条消息可以存好几条，方便对比不同的答案，留下喜欢的那条。消息有两条或更多备选回复时，会出现一组备选回复控件，显示当前是第几条和总共几条，比如“2/4”。

- **Previous swipe**(上一条备选回复) 和 **Next swipe**(下一条备选回复) 在备选回复之间前后翻。
- 数字输入框可以直接跳到某条备选回复。输入序号后按 <kbd>Enter</kbd>。它的标签是 **Jump to swipe 1-N**。
- 翻到最新一条备选回复时，往后翻的按钮会变成 **Generate next swipe**(生成下一条备选回复)，点它会生成一条新的备选回复。

最后一条备选回复删不掉，应用会提示“Cannot delete the last remaining swipe”。请改用 **Delete this message**。

## 重新生成、续写和重试

这三个操作看着像，做的事却不同。

| 操作 | 结果 |
| --- | --- |
| **Regenerate** | 生成一条新的备选回复，原来那条会保留。在触摸屏上，应用会先问一句“Regenerate this message as a new swipe?”准备好引导方向后，按钮会显示为 **Regenerate (guided)**(带引导的重新生成)。 |
| `/continue` | 在同一条消息上续写更多文字，不新建备选回复。 |
| 空输入时点 **Send**(发送) | 生成一条全新的回复。 |

### 续写回复

在输入框里输入 `/continue`(或 `/cont`) 并发送。模型会从上一条回复停下的地方接着写。

```text
/continue
```

Marinara 会在新文字前面加一个空行。想让新文字直接紧接上一段的最后一个字符，就关闭 **Settings → General → Responses → Add a new line before /continue text**。

### 空输入时用 Send 重试

如果最后一条消息是你发的，并且输入框是空的，**Send** 就会重试，而不是发送。在 Roleplay 中，即使 AI 已经回答过，空输入时点 **Send** 也会开始新的一轮。它永远不会接着上一条回复往下写。见[发送消息与流式输出](sending-and-streaming.md#retry-without-retyping)。

## 对 AI 隐藏消息

点击 **Hide from AI**，这条消息在之后的回合里就不会进入提示词。消息你自己仍然看得见，上面带一个 **Hidden from AI** 标签。点击 **Unhide from AI** 就会恢复发送。

在 Roleplay 群聊里，**Hide from AI** 会打开一个头像选择器。选群组头像会对所有人隐藏这条消息，选一个或多个角色则只对这些角色隐藏。消息上那个划掉的眼睛标记会显示谁看不到它。在单角色聊天里，这个按钮直接隐藏或恢复消息。

如果只对某个角色隐藏一条消息，该角色仍会收到消息里的耳语，但收不到其余内容。对所有人隐藏时，耳语也会一并移除。见[耳语与秘密](../roleplay/getting-started.md#whispers-and-secrets)。

要隐藏一段范围的消息，用 `/hide` 和 `/unhide`。见[斜杠命令](slash-commands.md)。消息编号从第一条消息开始，从 1 算起。

开启 Advanced Memory 的 **Decide who sees new messages**(决定谁能看到新消息) 后，在角色逐个回复的群聊里，新消息会自动对不在场的角色隐藏。你自己的选择始终优先。见[决定谁能看到新消息](../agents/memory.md#deciding-who-sees-new-messages)。

<a id="message-display-toggles"></a>

## 消息显示开关

这些开关在 **Settings → Advanced → Message Tools**(设置 → 高级 → 消息工具) 里。

| 开关 | 默认 | 显示内容 |
| --- | --- | --- |
| **Show message numbers**(显示消息编号) | 关闭 | 每条消息上的编号，也就是 `/goto`、`/hide` 和 `/unhide` 使用的那套编号。 |
| **Show token usage on messages**(在消息上显示 Token 用量) | 关闭 | 每条 AI 回复的提示词 Token 数和补全 Token 数（Token 是模型计数用的小段文字），条件允许时还会显示缓存命中情况和回复用时。 |
| **Show model name on messages**(在消息上显示模型名) | 关闭 | 写出每条回复的模型。 |
| **Show "older messages not sent" note**(显示“较早消息未发送”提示) | 开启 | 较早的消息放不进提示词时，回复下方会显示一条提示，例如“1109 older messages not sent”。关于回复被截断或为空的提示总会显示。 |
