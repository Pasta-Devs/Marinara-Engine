# 把 Conversation 聊天连接到 Roleplay 或 Game

把一个 Conversation(对话模式) 聊天和一个 Roleplay(角色扮演) 或 Game(游戏模式) 聊天连起来，让两边共享上下文。一种常见玩法：在一个聊天里跑故事，同时在一个始终了解故事进展的 Conversation 里，以戏外（OOC）的身份聊这个故事。

**Chat Settings**(聊天设置) 的 **Connected Chats**(关联聊天) 区域里有两个不同的功能。**Connected Chats** 连接是一对一的，需要手动建立。**Cross-Chat Awareness**(跨聊天感知) 是一个开关，不用连接也会自行生效，能让角色记住自己所在的其他 Conversation 聊天。

## 连接的工作方式

一条连接把一个 Conversation 和一个 Roleplay 或 Game 聊天绑在一起。每个聊天同一时间只能有一条连接。

- Conversation 每一轮都会自动读取所连故事聊天的最近消息。
- 故事聊天不会反过来读取 Conversation。往反方向传信息，靠角色使用标签，具体见下文。

## 把 Conversation 连接到 Roleplay 或 Game 聊天

开始之前：先准备好这两个聊天。见[管理聊天列表](managing-chats.md)。

1. 打开 Conversation 聊天，再打开 **Chat Settings**。见[聊天设置](chat-settings.md)。
2. 打开 **Connected Chats** 区域。
3. 点击 **Link to Roleplay or Game**(关联到 Roleplay 或 Game)。
4. 在选择器里搜索这个聊天，然后点击它。

这时区域里会显示所连聊天的名称和模式，旁边有一个小的解除连接按钮。

如果没有成功：选择器里只会列出尚未连接的聊天。先解除另一个聊天的连接。

想从 Game 聊天发起，就打开它的 **Chat Settings → Connected Chats**(聊天设置 → 关联聊天)，点击 **Link to Conversation**(关联到 Conversation)，再选择对应的 Conversation。Roleplay 聊天没有连接按钮。连接建立后它会显示出来，所以要从 Conversation 那边创建。

### 解除连接

打开 **Chat Settings → Connected Chats**，点击解除连接按钮（标签是 **Disconnect**）。这样还会清掉这条连接上待生效的影响和已保存的笔记。删除聊天同样会解除它的连接。

## Cross-Chat Awareness

**Cross-Chat Awareness** 是 Conversation 聊天 **Connected Chats** 区域里的一个开关，说明文字是“Characters know what happens in their other chats”。当一个角色出现在多个 Conversation 聊天里时，它能记住并提起其他聊天里发生过的事。Marinara 判断这些聊天的依据是共用角色，而不是共用用户。这个开关默认开启，不需要连接。

## 跨连接传递信息

这些标签由角色写在自己的消息里，你什么都不用做。两个聊天就是靠它们互相传话的。

| 标签 | 作用 |
| --- | --- |
| `<influence>` | 从 Conversation 送进所连故事聊天的一次性引导。它只影响所连聊天的下一轮，用过即失效。 |
| `<note>` | 把一条长期有效的事实从 Conversation 存进故事聊天。在你清除之前，它每一轮都留在故事聊天的提示词里。 |
| `<ooc>` | 让 Roleplay 角色跳出故事，回复所连的 Conversation。Marinara 会把这段文字发到那里。 |

### Conversation Notes

保存下来的 `<note>` 事实会出现在故事聊天 **Chat Settings** 里的 **Conversation Notes**(对话笔记) 区域。每条笔记都带一个删除按钮。**Clear all notes**(清除所有笔记) 会在你确认后删除全部笔记，而且无法撤销。没有笔记时，区域里会说明：用 `<note>` 标签包起来的笔记会出现在这里。

<a id="switching-between-connected-chats"></a>

## 在已连接的聊天之间切换

建立连接后，两个聊天上都会出现一个 **Connected chat**(所连聊天)（双向箭头图标）按钮。在电脑上，它一开始在右上角，可以拖动。在手机上，打开三点 **Chat tools**(聊天工具) 菜单，打开 **Connected chat**，再选择 **Switch to** 加另一个聊天的名称。

想把这个控件留在 Chat Settings 里，就选择 **Put back in Chat Settings**(放回聊天设置)。它会变成单独的 **Connected chat** 区域。用该区域的弹出按钮可以再把它变回独立窗口。

## 这个区域里的其他控件

- **Discord webhook URL**：一个没有标签的输入框，只有一段以 `https://discord.com/api/webhooks/` 开头的占位文字。粘贴 webhook URL，就能把这个聊天的消息镜像到 Discord 频道。它另有专门的指南。
- **Allow Noodle references**(允许引用 Noodle)：让 Noodle 时间线拉取这个聊天的最近消息。它默认关闭，只有安装了 Noodle 才会显示。
- **Allow character DMs**(允许角色发私聊)（Roleplay）：让 Roleplay 角色在故事里主动给你开一条新的 Conversation 私聊。它默认关闭，即使没有连接也能用。
