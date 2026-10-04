# 把 Conversation 聊天连接到 Roleplay 或 Game

本指南介绍如何把一个 Conversation(对话模式) 聊天和一个 Roleplay(角色扮演) 或 Game(游戏模式) 聊天连起来，让两边共享上下文，同时还会讲到 **Cross-Chat Awareness**(跨聊天感知)、用来跨连接传递信息的特殊标签，以及如何在两个聊天之间快速跳转。

Marinara Engine(下文简称 Marinara) 里有两个让聊天彼此知情的功能，一个全自动，另一个是手动建立的一对一连接。两者原理不同，本指南分开讲。

## Connected Chats 有什么用

**Connected Chats**(已连接聊天) 把一个 Conversation 聊天和一个 Roleplay 或 Game 聊天绑在一起。这种连接是一对一的，一个聊天同一时间只能连接另一个聊天。

连接建立后，Conversation 那边会自动读取故事聊天的最近消息，每一轮都把它们拉进自己的上下文。这是连接中自动生效的方向。

故事聊天（Roleplay 或 Game）不会反过来自动读取 Conversation 的消息。要往反方向传信息，得由角色使用特殊标签，具体见下文。

一种常见玩法：在一个聊天里跑沉浸式的 Roleplay 或 Game，同时在一个 Conversation 里开一条轻松的戏外（OOC）私聊。这条私聊始终了解故事进展，剧情一边推进，一边就能聊。

## Cross-Chat Awareness 不等于连接

这两个功能很容易混淆，动手配置之前先读这一节。

**Cross-Chat Awareness** 是自动的，属于 Conversation 模式的设置。当同一个角色出现在多个 Conversation 聊天里时，它能记住并提起其他聊天里发生过的事，不需要手动连接任何东西。这项设置默认开启。

它在 **Chat Settings**(聊天设置) 的 **Cross-Chat Awareness** 区块里，帮助文字是：“Characters remember and reference conversations from other chats they're in. Pulls recent messages from sibling chats and injects them as context.”Marinara 判断这些同源聊天的依据是共用角色，而不是共用用户。

**Connected Chats** 连接则不一样，它是特意建立的，只把一个 Conversation 和一个 Roleplay 或 Game 聊天绑起来，负责传递故事上下文和下文介绍的特殊标签。

一句话概括：**Cross-Chat Awareness** 自动把一个角色在自己各个 Conversation 聊天之间打通；**Connected Chats** 连接则是手动把一个 Conversation 和一个故事聊天绑在一起。

## 把 Conversation 连接到 Roleplay 或 Game 聊天

连接可以从 Conversation 聊天发起，也可以从 Game 聊天发起。从 Conversation 这边开始的步骤如下。

1. 打开要连接的 Conversation 聊天。
2. 打开 **Chat Settings**(点击聊天里的 **Chat Settings** 按钮；除非移动过，否则它在右上角)。
3. 找到 **Connected Chats** 区块。
4. 点击 **Link to Roleplay or Game**(关联到 Roleplay 或 Game)。
5. 在选择器里搜索目标 Roleplay 或 Game 聊天，然后点击它。

这时 **Connected Chats** 区块里应该显示出所连聊天的名称和模式，旁边有一个小的解除连接按钮。

想从 Game 聊天这边发起，就打开该聊天的 **Chat Settings**，找到 **Connected Chats**，点击 **Link to Conversation**(关联到 Conversation)，再选择对应的 Conversation。

Roleplay 聊天没有自己的连接按钮。连接建立后它会显示出来，但必须从 Conversation 那边创建。

选择器里只会列出尚未连接的聊天。一个聊天同一时间只能保持一条连接。

### 解除连接

要解除连接，打开 **Chat Settings**，找到 **Connected Chats**，点击解除连接按钮（提示文字是 **Disconnect**）。解除连接的同时，还会清掉这条连接上所有待生效的影响和已保存的笔记。

删除聊天同样会解除它与所连聊天的连接。

## 跨连接传递信息

Conversation 读取故事聊天是自动的，其他方向要靠标签完成。这些标签出现在角色的消息里，由 AI 写出，通常不用自己敲，但知道它们各自的作用有助于理解这座桥怎么搭起来。

如果需要提到这些标签，就按字面文本写。下面每个都用代码形式给出，以保证显示准确。

- `<influence>` 把一次性的引导从 Conversation 送进所连的故事聊天，只影响紧接着的那一轮，用过即失效。
- `<note>` 把一条长期有效的事实从 Conversation 存进所连的故事聊天。在清除之前，它每一轮都留在故事聊天的提示词里。
- `<ooc>` 让 Roleplay 角色跳出故事，直接回复所连的 Conversation。Marinara 会把这段文字发到所连的私聊里。

也就是说，Conversation 里的角色可以用 `<influence>` 和 `<note>` 悄悄影响或补充故事，Roleplay 里的角色可以用 `<ooc>` 回话给 Conversation。

## Conversation Notes

Conversation 里的角色保存一条长期的 `<note>` 之后，故事那边就会看到它：Roleplay 或 Game 聊天的 **Chat Settings** 里会多出一个 **Conversation Notes**(对话笔记) 区块。

这个区块列出所有已保存的笔记，每条都带一个删除按钮。想一次性全部清除，就用 **Clear all notes** 按钮。Marinara 会先请你确认，清除之后无法撤销。

如果还没有任何角色保存过笔记，区块里会说明：用 `<note>` 标签包起来的笔记保存后会出现在这里。

<a id="switching-between-connected-chats"></a>

## 在已连接的聊天之间切换

聊天有了所连聊天后，会出现可移动的 **Connected chat**(所连聊天) 双向箭头按钮，最初位于右上角。电脑和手机上都能拖动。点击按钮打开小窗口，再选择 **Switch to** 加另一个聊天的名称。

这样就能直接进入所连聊天，省得在聊天列表里找。连接的 Conversation 一侧和 Roleplay 一侧都有这个按钮。

想把它放进 Chat Settings，就在窗口里选择 **Put back in Chat Settings**(放回聊天设置)。它会变成 **Connected chat** 区域；用该区域的弹出按钮可以再恢复为独立窗口。

## 这个区块里的其他控件

**Connected Chats** 区块里还有两个控件，它们属于别的功能，放在这里只是为了顺手。

- 一个 **Discord webhook URL** 输入框。它没有可见标签，只有一段以 `https://discord.com/api/webhooks/` 开头的占位文字。把 Discord 的 webhook URL 粘贴进去，这个聊天的消息就会同步到对应的 Discord 频道。这是 Discord 消息同步功能的一部分，另有专门的指南。
- 一个 **Allow Noodle references**(允许引用 Noodle) 开关（默认关闭）。开启后，应用内的 Noodle 时间线可以拉取这个聊天的最近消息。Noodle 也有自己的指南。

在 Roleplay 一侧，还能看到一个 **Allow character DMs**(允许角色发私聊) 开关（默认关闭）。开启后，Roleplay 角色可以在故事里主动给你开一条新的 Conversation 私聊。即使还没有连接任何 Conversation，这个功能也能用。

## 相关指南

- [Conversation 模式：入门](../conversation/getting-started.md)
- [Roleplay 模式：入门](../roleplay/getting-started.md)
