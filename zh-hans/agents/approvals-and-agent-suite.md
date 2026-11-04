# 智能体审批与 Agent Suite

智能体可以往聊天里写入内容：世界书条目、摘要和角色卡修改。本指南介绍如何在这些写入保存之前先审核，以及如何用 **Agent Suite**(智能体套件) 查看和修正智能体存下来的内容。

## 在保存之前审核智能体写入

默认情况下，有些智能体写入会自动保存。**Review Agent Outputs**(审核智能体输出) 会让每一条写入都先等你批准。

1. 打开聊天，点击 **Chat Settings**(聊天设置)。
2. 滚动到 **Agents**(智能体) 区域。
3. 在 Roleplay(角色扮演) 聊天里，展开 **Trackers Control**(追踪器控制)。在 Game 里跳过这一步。
4. 开启 **Review Agent Outputs**。

开启后，世界书更新、摘要更新，以及其他可审核的写入型智能体输出，都会等你处理。关闭时，世界书更新和摘要更新可以自动保存。

角色卡的修改一律先征求你的批准，即使 **Review Agent Outputs** 是关闭的也一样。这道检查无法关闭。

### 审核世界书或摘要更新

智能体提出写入时，会弹出一个标题为 **Review Lorebook Update** 或 **Review Summary Update** 的窗口。窗口里显示智能体的名称，以及一个可以编辑的 **Proposed Text**(建议文本) 框。如果是世界书写入，还会提醒你把每个条目都放在 `###` 标题下面。

- **Accept**(接受) 保存文本，包括你所做的修改。
- **Regenerate**(重新生成) 只重跑这一个智能体，换一份新建议。
- **Discard**(丢弃) 直接丢掉这条建议，不做保存。

如果还有别的建议在等待，窗口会显示还有多少条。处理完当前这条，窗口会为下一条重新打开。

拥有 **Create character cards**(创建角色卡) 能力的智能体也可以提议新建一张角色卡。它会打开一个显示角色卡文本的审核窗口。在你接受之前，什么都不会保存。

### 审核角色卡更新

**Card Evolution Auditor** 智能体会根据角色扮演里发生的事，给角色卡提出修改建议。在 Conversation(对话模式) 里，内置的 `update_about_me` 工具也能提议修改公开的 About Me。两者都不会自己改动角色卡，而是打开 **Review Character Card Updates** 窗口。

对每条建议的修改，窗口都会显示它涉及的角色卡字段、智能体给出的简短理由（如果有）、一个显示当前文本的 **Before**(修改前) 块，以及一个可以编辑的 **After**(修改后) 框。

- **Approve**(批准) 应用这些修改。按钮上的数字表示会应用多少条。批准后，角色的版本号会增加，并保存一条版本历史记录。
- **Regenerate** 重跑这个智能体，换一批新建议。
- **Reject**(拒绝) 不采纳这些建议，角色卡保持不变。

如果智能体写完建议之后角色卡又改动过，这条修改会被标记为已过期并置灰显示。这时会出现一个带数量的 **Override stale**(强制应用过期修改) 按钮。只有确实还想要那段文字时才用它。Marinara 会先让你确认，然后把过期文本追加到该字段，而不是替换已经对不上的内容。

## 查看和编辑智能体存储的内容

**Agent Suite** 会显示这个聊天里的智能体存下来的所有内容：追踪器数据（例如当前场景、在场角色和用户角色属性），以及自定义智能体保存的输出。可以用它改正写错的名字、修正数值，或者清理杂乱的文本。

1. 打开 **Chat Settings**，滚动到 **Agents**。
2. 点击 **Agent Suite**。
3. 从左侧列表里选一个智能体。

右侧显示可编辑的区块，最多分成三组：**Stored Memory**(存储记忆)、**Tracker Data**(追踪器数据)（仅追踪器智能体）和 **Recent Outputs**(最近输出)（仅自定义智能体）。不追踪数据的智能体只显示 **Stored Memory**。

每个区块都是一个文本或 JSON 编辑器。JSON 区块带有行号，JSON 无效时会立刻提示。在能解析之前，**Save**(保存) 一直不可用。想搜索全部追踪器数据，或把它们当作字段编辑，点击 **Tracker Data** 标题栏里的 **Open in State Editor**(在 State Editor 中打开)。见 [State Editor](../roleplay/hud-and-trackers.md#the-state-editor)。

改完一个区块后，点击 **Save** 保留改动，或点击 **Reset**(重置) 回到已存储的值。

### 让 AI 改写区块

1. 在区块上点击 **AI Edit**(AI 编辑)。
2. 只想改其中一部分时，先选中那段文字。不选任何内容，整个区块都会重写。
3. 输入一条指令，例如“把弄乱的角色名改对，她叫 Mira”。
4. 可选：点击 **Add Context**(添加上下文) 附上角色卡或世界书条目，让 AI 知道这些数据的含义。
5. 选择由哪个连接（AI 服务和模型）来完成改写。
6. 点击 **Rewrite**(改写)。

改写结果会作为未保存的草稿填进区块。看过之后，点击 **Save** 或 **Reset**。

- 这个聊天还有智能体在运行时，保存会等到它们跑完。
- **Clear memory**(清除记忆) 只在该智能体确实存了数据时，才出现在 **Stored Memory** 里。它会一次性删掉这个智能体为当前聊天存下的全部内容，而且无法撤销。Marinara 会先让你确认。
- 对 **Narrative Director** 来说，存储的剧透内容是隐藏的。用 **Reveal spoilers**(显示剧透) 查看和编辑它们。

## 查看缓存的提示词注入

生成回复之前，有些写入型智能体会往提示词里追加文字，**Prose Guardian**、**Narrative Director** 和自定义注入智能体尤其常见。**Cached prompt injections**(缓存的提示词注入) 面板会显示最近一次回复所追加的这些文字。它是一个排查问题用的视图。

开始之前：开启 **Debug mode**(调试模式)（见[智能体概览](agents-overview.md#tell-whether-an-agent-ran)）。在 Roleplay 聊天里，打开 **Agent activity**(智能体活动) 里的 **Injections** 选项卡。见[智能体活动](../roleplay/getting-started.md#agent-activity)。

每条注入都可以展开阅读并编辑文本，点击 **Save** 图标保留改动，或点击 **Re-run**(重新运行) 图标，让那个智能体重写一份。

**Knowledge Retrieval** 和 **Knowledge Router** 的注入无法在这里重新运行。编辑和重新运行只有在重新生成同一条回复时才会生效。重新运行用的是那个时间点的聊天记录，不包含之后的新消息。

## 相关指南

- [智能体概览](agents-overview.md)
- [可下载智能体参考](built-in-agents.md)
- [创建和编辑角色](../characters/creating-and-editing-characters.md)
