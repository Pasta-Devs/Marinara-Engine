# Narrative Director 与 Secret Plot

Narrative Director 是一个智能体（跟着回复一起运行的帮手），负责引导 Roleplay 聊天的剧情。场面卡住时，**Push Story**(推动剧情) 会推动一条回复。**Secret Plot**(秘密剧情) 会保留一条隐藏的长线剧情，影响很多条回复。它只在 Roleplay(角色扮演) 里有效。智能体的整体机制见[智能体概览](../agents/agents-overview.md)。

## 把 Narrative Director 加进聊天

1. 用聊天里的滑块按钮打开 **Chat Settings**(聊天设置)，进入 **Agents**(智能体)。
2. 开启 **Enable Agents**(启用智能体)，然后添加 **Narrative Director** 智能体。

这时消息框上方会出现 **Push Story** 按钮，**Agents** 里也会出现一张 **Narrative Director** 卡片。在你使用 **Push Story** 或开启 **Secret Plot** 之前，这个智能体什么都不做。

## 推进剧情

**Push Story** 只生效一次。它只影响下一条回复，然后自动关闭。先把 Narrative Director 加进聊天（见上文）。

1. 点击消息框上方的 **Push Story**。一个菜单会问你怎么推进：
   - **Naturally**(自然推进)：把现有剧情往前推。AI 会推进故事里已经存在的线索。
   - **Randomly**(随机推进)：给场景加入一个说得通的意外。
2. 选一个。你会看到“The next time a character responds, they will push the story forward naturally!”（或“randomly!”）。按钮这时显示 **Push Story: Naturally** 或 **Push Story: Randomly**。
3. 发送下一条消息，或者生成一条新回复。AI 会在这一条回复里应用剧情推进。
4. 回复结束后，**Push Story** 会自动关闭。

每次都要在这个菜单里选择模式。没有默认模式，**Chat Settings** 里也没有模式设置。

发送之前想取消，再点一次已上膛的按钮。你会看到“Push Story disarmed.”

如果没有成功：回复正在生成时，**Push Story** 不会响应。等回复生成完，再点它。

## 开启 Secret Plot

**Secret Plot** 是一条隐藏的长线剧情。AI 会为故事的走向保留一份秘密计划。这份计划会加进提示词，但除非你主动揭晓，否则一直对你隐藏。它默认关闭。和 **Push Story** 不同，它会贯穿很多条回复，并按计划定期更新。

1. 打开 **Chat Settings → Agents**(聊天设置 → 智能体)，找到 **Narrative Director** 卡片。
2. 打开 **Secret Plot** 开关。它的说明文字是“Maintain a hidden long-term arc for this roleplay.”
3. 需要的话，设置 **Run Interval**(运行间隔)。它表示每隔多少条消息（你的和 AI 的都算）更新一次剧情线。默认是 8，可以填 1 到 100 之间的任意整数。数值越小，计划更新得越频繁。

## 揭晓和编辑隐藏剧情线

**Secret plot** 面板在 **Run Interval** 下方。

1. 点击 **Reveal spoilers**(揭晓剧透)。AI 还没写出剧情线时，它显示 **Reveal empty arc**(揭晓空剧情线)。隐藏状态下，面板显示“Spoilers hidden”。点击 **Hide spoilers**(隐藏剧透) 可以重新藏起来。
2. 编辑你想改的字段：
   - **Arc description**(剧情线描述)：整条隐藏故事线。
   - **Protagonist arc**(主角剧情线)：你的角色会走向何方。
   - **Character arc**(角色剧情线)：选定的某个角色会走向何方。
   - **Completed**(已完成)：剧情线走完后勾上。
3. 用保存按钮保存修改。

想丢掉当前剧情线、让 AI 重写一条，点击 **Regenerate**(重新生成)。一个标题为“Regenerate Secret Plot”的对话框会请你确认。选 **Regenerate** 替换剧情线，选 **Keep Current Arc**(保留当前剧情线) 取消。

剧情线保存在 **Narrative Director** 智能体上。清空聊天的智能体结果不会把它抹掉。只有把这个智能体从聊天里移除，它才会被删除，而且移除之前会有一条警告提醒你。

## 修改 Secret Plot 提示词

**Secret Plot Prompt**(秘密剧情提示词) 保存的是 Narrative Director 编写和更新剧情线时遵循的指令。内置提示词把每条剧情线都当作一个有待揭开的谜团。这适合冒险和阴谋类故事，但不一定适合由角色驱动的故事。

1. 打开 **Agents**，编辑 **Narrative Director**。
2. 在 **Secret Plot** 一节里，点击 **Copy default to edit**(复制默认值以编辑)。
3. 修改文字，然后保存智能体。

点击 **Reset to default**(重置为默认值) 可以回到内置提示词，之后再保存智能体。

> **注意：** 不要删掉提示词的最后一部分。它描述的是回复格式，没有它，Marinara 就读不出剧情线。

这个提示词保存在智能体上，所以会作用于所有使用这个 Narrative Director 的聊天。

## 相关指南

- [可下载智能体参考](../agents/built-in-agents.md)
- [Roleplay 模式：入门](getting-started.md)
- [引导生成与 Impersonate](../chats/guided-and-impersonate.md)
