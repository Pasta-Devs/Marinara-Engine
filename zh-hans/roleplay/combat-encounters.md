# 战斗遭遇战（Roleplay）

战斗遭遇战会给 Roleplay(角色扮演) 场景配上一块回合制战斗界面，有生命条、敌人和队伍列表，还有战斗日志。这个功能是可选的。不用它的话，聊天和以前完全一样。Game Mode(游戏模式) 有自己的一套独立战斗系统，见 [Game Mode：战斗](../game/combat.md)。

## 开启战斗

智能体是随回复一起运行的帮手。**Combat**(战斗) 智能体负责加上战斗功能。它默认关闭，所以要在每个聊天里单独打开。

1. 打开聊天。用聊天里的滑块按钮打开 **Chat Settings**(聊天设置)。
2. 进入 **Agents**(智能体)。
3. 如果 **Enable Agents**(启用智能体) 还没开启，先打开它。
4. 从这个开关下方的列表里添加 **Combat** 智能体。

现在消息框上方会出现一个 **Encounter**(遭遇战) 按钮（两把交叉的剑），提示文字是 **Start Combat Encounter**。

如果没有成功：看不到这个按钮，说明 **Combat** 智能体在这个聊天里没有生效。智能体的工作原理见[智能体：聊天里的 AI 帮手](../agents/agents-overview.md)。

## 发起遭遇战

1. 点击 **Encounter**。**Configure Combat Narrative** 框会打开，用来设定 AI 使用的行文风格。
2. 为 **Combat Narration**(战斗叙述)（战斗进行期间）和 **Summary Narration**(摘要叙述)（战斗结束时写进聊天的摘要）选择风格。两组的设置完全一样，各有四项，见下表。默认值就能用，所以也可以直接点击 **Begin Combat**(开始战斗)。
3. 可选：选一本 **Spellbook**(法术书)。法术书是一种世界书（一组保存下来的世界设定），里面列出这场战斗中可用的法术和能力。不用法术书的话，保持 **None**(无) 就行。
4. 点击 **Begin Combat**。点击 **Cancel**(取消) 则关掉这个框，不开战。

AI 生成敌人、你的队伍以及双方的攻击手段和道具期间，界面会显示“Initializing combat encounter...”，这可能要花几秒钟。

| 风格控件 | 选项 |
| --- | --- |
| 时态 | **Present Tense**(现在时)、**Past Tense**(过去时) |
| 人称 | **First Person**(第一人称)、**Second Person**(第二人称)、**Third Person**(第三人称) |
| 叙述 | **Omniscient**(全知)：什么都知道。**Limited**(限知)：只知道某一个角色知道的事。 |
| 视角 | 一个文本框，填这场戏透过谁的眼睛来讲。留空就是中立的旁白。 |

## 进行你的回合

**Combat Encounter** 界面由四部分组成：

- **Enemies**(敌人)：带生命条和状态效果的卡片。
- **Party**(队伍)：你这一方。你自己的角色标着 **(You)**。
- **Combat Log**(战斗日志)：每个回合的记录。
- **Your Actions**(你的行动)：你的操作按钮。

轮到你时，可以在 **Attacks**(攻击) 下挑一个攻击，在 **Items**(道具) 下使用一件道具，或者在 **Custom Action**(自定义行动) 里写一段自由行动并发送，比如“我踢起沙子扬进卫兵眼里”。

行动需要目标时，会弹出 **Select Target**(选择目标)。可以选一个敌人或一名队友，也可以选 **All Enemies**(全体敌人) 打一次范围攻击。只能打范围的行动会跳过这一步。

AI 结算这一回合期间，界面显示“Processing action...”，你的按钮暂时锁住。回合结束后按钮就会解锁。

如果没有成功：如果 AI 返回了应用读不懂的数据，会出现 **Combat Error**(战斗出错) 页面。点击 **Close Encounter**(关闭遭遇战) 安全退出战斗，然后重新发起一场。

## 结束遭遇战

- 顶栏的 **Conclude**(结束战斗) 用来提前收场。先弹出确认框，确认后战斗摘要会写进聊天。
- 顶栏的 **X** 会关闭并丢弃这场战斗，之前先弹出标题为 **End Combat** 的确认框。这种方式不写摘要。
- 一方获胜时，横幅会显示 **VICTORY**、**DEFEAT**、**FLED** 或 **INTERRUPTED**。摘要会按你选的 **Summary Narration** 风格写进聊天。摘要写好后，点击 **Close Combat Window**(关闭战斗窗口)。

摘要生成失败时，按钮会变成 **Close Anyway**(仍然关闭)。点它就能不带摘要直接回到场景。

## 和 Game Mode 战斗的区别

- Roleplay 的遭遇战由你自己用 **Encounter** 发起。Game Mode 里则是游戏主持人（GM）在剧情需要时开战。
- Roleplay 战斗需要 **Combat** 智能体，Game Mode 战斗不需要。
- 两套系统用的是不同的战斗界面。

## 相关指南

- [Roleplay 模式：入门](getting-started.md)
- [智能体：聊天里的 AI 帮手](../agents/agents-overview.md)
- [可下载智能体参考](../agents/built-in-agents.md)
- [Game Mode：战斗](../game/combat.md)
