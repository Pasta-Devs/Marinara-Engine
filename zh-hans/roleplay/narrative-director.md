# Narrative Director 与 Secret Plot

本指南介绍 Marinara Engine 里的 Narrative Director 智能体，内容包括 Push Story(推进剧情) 按钮、Natural(自然推进) 和 Random Event(随机事件) 两种模式，以及隐藏的 Secret Plot(秘密剧情线) 长线剧情。这些功能只在 Roleplay(角色扮演) 模式下使用。

## Narrative Director 是什么

智能体是在聊天背后跑后台任务的 AI 帮手。Narrative Director 就是其中之一。它会为下一条回复写一次性的剧情指示，让故事按你想要的方向走。想了解智能体的整体机制，见[智能体：聊天里的 AI 帮手](../agents/agents-overview.md)。

Narrative Director 只在 Roleplay 模式下生效，而且不会自作主张。只有用 **Push Story** 按钮给它上膛（也就是只为一条回复开启它），或者开启 **Secret Plot** 功能，它才会动作。

用之前要先把这个智能体加进聊天。打开 **Chat Settings**(聊天设置)，进入 **Agents**(智能体) 部分，启用 **Narrative Director** 智能体。启用之后，消息输入框上方会出现 **Push Story** 按钮，**Agents** 部分里也会出现一张 **Narrative Director** 设置卡片。

## Push Story

**Push Story** 是个一次性按钮，只影响下一条回复，用完自动关闭。场面卡住、想让 AI 把剧情往前推的时候就用它。

按下面的步骤操作。

1. 打开一个已启用 **Narrative Director** 智能体的 Roleplay 聊天。
2. 在消息输入框上方找到 **Push Story** 按钮。
3. 点击 **Push Story**。在 Natural 模式下会看到提示“The next time a character responds, they will push the story forward naturally!”，在 Random Event 模式下结尾则换成“randomly!”
4. 发送下一条消息，或者生成一条新回复。
5. AI 会在这一条回复里应用剧情推进。
6. 回复结束后，**Push Story** 自动关闭。

发送之前改主意了，再点一次 **Push Story** 就能关掉，此时会看到提示“Push Story disarmed.”

回复正在生成时，**Push Story** 按钮不可用。等当前回复生成完，再给它上膛。

## Natural 和 Random Event 两种模式

**Push Story** 有两种模式，在 **Chat Settings** 里的 **Narrative Director** 卡片中选择。选的模式不同，推进方式也不同。

两种模式分别是：

- **Natural**：把现有剧情往前推。AI 会推进故事里已经存在的线索。
- **Random Event**：加入一个说得通的意外。AI 会引入一个新转折，同时又不脱离当前场景。

默认是 **Natural**。要改模式，打开 **Chat Settings**，进入 **Agents**，找到 **Narrative Director** 卡片，点击想要的模式。

**Push Story** 按钮的提示文字会告诉你当前上膛的是哪种模式。**Natural** 模式下显示“Arm a natural Narrative Director push for the next response.”，**Random Event** 模式下显示“Arm a random Narrative Director event for the next response.”

## Secret Plot

**Secret Plot** 是给角色扮演准备的一条隐藏长线剧情。AI 会为故事的走向保留一份秘密计划，这份计划会加进提示词（Marinara Engine 发给 AI 的那段文字），但除非你主动揭晓，否则一直对你保密。该功能默认关闭。

**Push Story** 只作用一次，**Secret Plot** 则会贯穿很多条回复。随着聊天继续，它按设定的间隔更新那份隐藏计划。

### 开启 Secret Plot

1. 打开 **Chat Settings**，进入 **Agents** 部分。
2. 找到 **Narrative Director** 卡片。
3. 打开 **Secret Plot** 开关，它的说明文字是“Maintain a hidden long-term arc for this roleplay.”

### Run Interval

**Secret Plot** 开启后会出现 **Run Interval**(运行间隔) 输入框，用来设定每隔多少条用户消息和 Assistant 消息更新一次隐藏剧情线。

默认是 8，可以填 1 到 100 之间的任意整数。数值越小，计划更新得越频繁；数值越大，更新得越少。

### 揭晓和编辑隐藏剧情线

**Run Interval** 输入框下方是 **Secret plot** 面板，用它查看和修改隐藏计划。

点击揭晓按钮就能看到剧情线。已经有剧情线时按钮显示 **Reveal spoilers**(揭晓剧透)，AI 还没写出来时显示 **Reveal empty arc**(揭晓空剧情线)。点击 **Hide spoilers**(隐藏剧透) 可以重新藏起来。剧情线处于隐藏状态时，面板显示“Spoilers hidden”。

剧情线揭晓后，可以编辑这几个字段：

- **Arc description**(剧情线描述)：整条隐藏故事线。
- **Protagonist arc**(主角剧情线)：你的角色会走向何方。
- **Character arc**(角色剧情线)：角色扮演里某一个选定角色会走向何方。
- **Completed**(已完成)：一个复选框，剧情线走完之后勾上。

改完字段，用保存按钮保存修改。

想丢掉当前剧情线、让 AI 重写一条，点击 **Regenerate**(重新生成)。屏幕上会弹出标题为“Regenerate Secret Plot”的窗口请你确认，选 **Regenerate** 替换，选 **Keep Current Arc**(保留当前剧情线) 取消。

### 剧情线跟着智能体走

隐藏剧情线保存在 **Narrative Director** 智能体身上。清空聊天的智能体运行记录和记忆不会把它抹掉。只有把 **Narrative Director** 智能体从聊天里移除，剧情线才会删除。移除智能体时会有一条警告，提示隐藏剧情线会一并清除，且无法撤销。

### Secret Plot 提示词

**Secret Plot Prompt**(秘密剧情提示词) 保存的是 Narrative Director 编写和更新隐藏剧情线时遵循的指令。内置提示词把每条剧情线都写成一个有待揭开的谜团。这适合冒险和阴谋类故事，但不一定适合由角色驱动的故事。

想使用自己的指令，按下面的步骤操作。

1. 打开 **Agents**(智能体)，编辑 **Narrative Director**。
2. 在 **Secret Plot**(秘密剧情) 一节里，点击 **Copy default to edit**(复制默认值以编辑)。
3. 修改文字，然后保存智能体。

点击 **Reset to default**(重置为默认值) 可以回到内置提示词，之后再保存智能体。

请保留提示词末尾的 JSON 回复格式：一个 `overarchingArc` 对象，包含 `description`、`protagonistArc`、可选的 `characterArc` 以及 `completed`。没有它，剧情线就无法读取。

这个提示词保存在智能体上，所以会作用于所有使用这个 Narrative Director 的聊天。

## 相关指南

- [可下载智能体参考](../agents/built-in-agents.md)
- [Roleplay 模式：入门](getting-started.md)
- [引导生成与 Impersonate](../chats/guided-and-impersonate.md)
