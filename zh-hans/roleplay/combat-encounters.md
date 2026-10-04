# 战斗遭遇战（Roleplay）

本指南介绍 Roleplay(角色扮演) 模式里的战斗遭遇战，内容包括怎么开启 **Combat**(战斗) 智能体、怎么发起一场战斗，以及怎么在 Encounter 窗口里把它打完。文中还会说明这个功能和 Game Mode(游戏模式) 战斗的区别。

战斗遭遇战是 Roleplay 的可选功能，会给场景配上一块结构化的回合制战斗界面，有生命条、敌人和队伍列表，还有战斗日志。不开这个功能的话，Roleplay 聊天和以前完全一样。

## 开启 Combat 智能体

智能体是生成消息时自动运行的帮手。**Combat** 智能体负责给 Roleplay 聊天加上战斗功能，默认关闭，需要在每个聊天里单独打开。

1. 打开想添加战斗功能的聊天。
2. 打开 **Chat Settings**(聊天设置)（点击聊天里的 **Chat Settings** 按钮；除非移动过，否则它在右上角）。
3. 打开 **Agents**(智能体) 部分。
4. 如果 **Enable Agents**(启用智能体) 还没开启，先打开它。
5. 把 **Combat** 智能体添加到这个聊天。

现在消息框上方的操作栏里应该出现一个 **Encounter**(遭遇战) 按钮，图标是两把交叉的剑，提示文字是 **Start Combat Encounter**。看不到这个按钮，说明 **Combat** 智能体在当前聊天里没有生效。

Agents 面板的完整用法和智能体的工作原理，见[智能体：聊天里的 AI 帮手](../agents/agents-overview.md)。

## 发起遭遇战

点击 **Encounter** 按钮打开设置框，标题是 **Configure Combat Narrative**。这里决定 AI 在战斗过程中和战斗结束后的行文风格。

设置框里有两组风格设定：

- **Combat Narration**(战斗叙述)：战斗进行期间使用的行文风格。
- **Summary Narration**(摘要叙述)：战斗结束时写进聊天的那段摘要使用的行文风格。

两组的控件完全一样，各有四个：

- 时态：**Present Tense**(现在时) 或 **Past Tense**(过去时)。
- 人称：**First Person**(第一人称)、**Second Person**(第二人称) 或 **Third Person**(第三人称)。
- 叙述：**Omniscient**(全知)，叙述者什么都知道；或 **Limited**(限知)，叙述者只知道某一个角色知道的事。
- 视角输入框：填这场戏透过谁的眼睛来讲。留空就保持中立的叙述者口吻。

风格设定下面还有一个可选的 **Spellbook**(法术书) 下拉菜单。法术书是一种特殊的世界书（一组世界设定条目），里面列出这场战斗中可用的法术和能力。挂上一本，AI 就知道角色能放哪些法术。不用法术书的话，保持 **None** 就行。

准备好之后点击 **Begin Combat**。点击 **Cancel** 则关掉设置框，不开战。

点击 **Begin Combat** 之后，应用会显示“Initializing combat encounter...”，同时 AI 在搭建这场战斗，敌人、你的队伍、双方的攻击手段和道具都在这时生成。这可能要花几秒钟。

## 进行遭遇战（Encounter 窗口）

完整的战斗界面（Encounter 窗口）标题是 **Combat Encounter**，由这几部分组成：

- **Enemies**(敌人)：敌人卡片组成的网格。每张卡显示一条生命条，以及身上的状态效果。
- **Party**(队伍)：你这一方。你自己的角色标着 **(You)**。
- **Combat Log**(战斗日志)：逐回合记录战况。
- **Your Actions**(你的行动)：轮到你出手时用的按钮。

在 **Your Actions** 里可以：

- 从 **Attacks**(攻击) 里挑一个。
- 使用 **Items**(道具) 里的一件。
- 在 **Custom Action**(自定义行动) 框里写一段自由行动并发送。按钮覆盖不到的操作都走这里，比如“我抓起沙子扬进卫兵眼里”。

攻击或道具需要指定目标时，会弹出 **Select Target**(选择目标) 框。可以选一个敌人或一名队友，也可以选 **All Enemies**(全体敌人) 打一次范围攻击，一下命中所有敌人。有些行动只能打范围，会直接跳过选单体目标这一步。

AI 结算这一回合期间，界面显示“Processing action...”，按钮暂时锁住，回合结束后解锁。

如果 AI 返回的数据应用读不懂，界面会给出 **Combat Error**(战斗出错) 页面，而不是让应用崩掉。点击上面的 **Close Encounter** 就能安全退出战斗。

## 结束遭遇战

提前结束战斗有两种方式；此外，一方获胜时战斗会自然结束。

- 点击顶栏的 **Conclude**(结束战斗) 提前收场，会先弹出确认框。随后应用把战斗摘要写进聊天。
- 点击顶栏的 **X** 按钮关闭并丢弃这场战斗，会先弹出标题为 **End Combat** 的确认框。这种方式不写摘要。

战斗自然结束时，界面会打出结果横幅：**VICTORY**、**DEFEAT**、**FLED** 或 **INTERRUPTED**。接着应用按你选的 **Summary Narration** 风格，把一条战斗摘要消息写进聊天。摘要写好之后，点击 **Close Combat Window** 回到场景。

摘要生成失败时，按钮会变成 **Close Anyway**。点它就能不带摘要直接回到场景。

## 和 Game Mode 战斗的区别

战斗遭遇战是 Roleplay 模式专用的一层轻量战斗系统，独立于别处。Game Mode 自带另一套战斗系统。

主要区别有：

- Roleplay 的遭遇战由你自己用 **Encounter** 按钮发起。Game Mode 里则是 AI 游戏主持人（GM）在剧情需要时开战。
- Roleplay 战斗必须开启 **Combat** 智能体。Game Mode 战斗不使用 **Combat** 智能体，没有它也照样能打。
- 两套系统用的是不同的战斗界面，彼此不互通。

Game Mode 的战斗系统见 [Game Mode：战斗](../game/combat.md)。

## 相关指南

- [Roleplay 模式：入门](getting-started.md)
- [智能体：聊天里的 AI 帮手](../agents/agents-overview.md)
- [可下载智能体参考](../agents/built-in-agents.md)
- [Game Mode：战斗](../game/combat.md)
