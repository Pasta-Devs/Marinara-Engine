# Game Mode：会话与存档

Game Mode(游戏模式) 把一场冒险切分成带编号的会话，相当于跑团时的一个个晚上。本指南介绍怎么结束和开始会话、回看过往会话、分享你的配置、手动修正保存的数据，以及回到更早的某一刻。

第一个会话是 **Session 1**。结束它再重新开始，就产生 **Session 2**，依此类推。结束会话时，游戏主持人（GM，负责主持游戏的 AI）会写一份摘要，之后随时可以重读。

## 保存与继续

没有保存按钮。游戏会在你玩的过程中自动保存。

1. 想暂时停下，关掉标签页或应用即可。
2. 想继续，打开同一个游戏聊天。你会回到停下的地方。
3. 想给一章收尾，就结束会话（见[结束会话](#end-a-session)）。

想回到更早的某一刻，见[游戏怎么保存](#how-your-game-saves)。

<a id="opening-session"></a>

## 打开 Session

**Session**(会话) 用来结束会话、开始新会话，以及查看历史记录。

1. 打开一个 Game Mode 聊天。
2. 点击或点按聊天右上角附近的 **Session** 按钮（羽毛图标）。它可以拖到别处（见[控制窗口及其按钮](../chats/chat-settings.md#control-windows-and-their-buttons)）。
3. **Session** 在电脑上是窗口，在手机上是全宽面板。第一行显示当前会话的编号和状态。
4. 它有两个选项卡：**Session History**(会话历史) 和 **Journal**(日志)。会话控制都在 **Session History** 里。

如果用 **Put back in Chat Settings** 把这个窗口放回过聊天设置，就改为打开 Chat Settings 里的 **Session** 区域。

<a id="end-a-session"></a>

## 结束会话

想给一章收尾、让 GM 写一段摘要时，就结束会话。

1. 打开 **Session**，停留在 **Session History**。
2. 顶部就是当前会话，标为 **Session N (Current)**。
3. 在这一行点击 **End Session**(结束会话) 按钮（小方块图标）。这一行有好几个小图标按钮，把指针悬停在上面就能看到提示文字。随后会弹出标题为 **End Session** 的窗口，要求确认。
4. 可选：在 **What do you want to happen in the next session (optional)?** 里写一条备注（最多 5,000 个字符）。留空则由 GM 来引导。
5. 点击窗口里的 **End Session**。点击 **Cancel**(取消) 则退出。

GM 写摘要期间，窗口标题会变成 **Ending Session**。请留在这个界面上等它完成。之后该会话会被标记为已结束，并出现在历史记录里。

如果没有成功，检查 GM 模型能否连通。摘要是一次模型请求，和其他请求一样可能失败。再试一次，并参阅 [Marinara Engine 故障排查](../TROUBLESHOOTING.md)。

## 开始新会话

会话结束后，它那一行的同一个按钮会变成 **New Session**(新会话)。

1. 打开 **Session**，切到 **Session History**。
2. 在当前会话那一行点击 **New Session** 按钮（播放图标）。

GM 会根据上一份摘要，以及你结束会话时写下的备注，接着往下讲。在带有生成世界的游戏里，世界会从上次留下的样子继续下去：过去的天数、队伍的事迹和声望、故事新增的地点和团体，以及队伍去过的地方。

## 回看过往会话

**Session History** 按时间倒序列出已结束的会话。一个都还没结束时，这里显示 **No completed sessions yet**。每一行显示会话编号、日期，以及记录了多少条发现。点击一行即可展开。可能出现这些字段：

| 字段 | 内容 |
| --- | --- |
| **Summary**(摘要) | 发生了什么。 |
| **Resume Point**(续接点) | 下个会话该从哪里接下去。 |
| **Party Dynamics**(队伍关系) | 队伍成员之间的相处状况。 |
| **Key Discoveries**(关键发现) | 重要事实、转折和揭露。 |
| **Character Moments**(角色高光) | 亮眼的瞬间。 |
| **Little Details To Recall**(值得记住的小细节) | 细小的习惯、承诺或细节。 |
| **NPC Updates**(NPC 变化) | 非玩家角色（NPC，即由 GM 控制的角色）身上发生的变化。 |
| **Next Session Request**(下次会话要求) | 结束会话时留下的那条备注。 |
| **Stats Snapshot**(数值快照)、**Party Status**(队伍状态) | 保存下来的数值和队伍状态。 |

### 重播会话

重播是只读的：不会调用 GM，不会产生消息，不会改动物品栏或数值，不会更新日志，也不会恢复检查点。

1. 展开一个已结束的会话。
2. 点击 **Replay Session**(重播会话)。
3. 用 **Next**(下一步) 和 **Next turn**(下一回合) 逐段翻看当初的叙述和对话。
4. 遇到选项时，只有当初选中的那一项可点。点它继续沿着记录下来的路线走。
5. 看完之后，点击顶部的关闭按钮，或者点击 **Return to current session**(返回当前会话)。

重播功能出现之前的会话，同样可以用保存下来的文本、效果、选项和素材重播。较早的回合可能缺少某个当时没有存下来的场景效果。

### 编辑过往会话

修改已结束会话的笔记，好让后续会话记对内容。

1. 展开这个会话。
2. 点击 **Edit Details**(编辑详情)。
3. 修改任意字段，然后点击 **Save Details**(保存详情)。点击 **Cancel** 则放弃修改。

展开后的会话上还有另外两个按钮：

- **Regenerate**(重新生成) 会让 AI 重新为这个会话收尾。它会重写摘要和其他所有字段，所以用 **Edit Details** 改过的内容都会丢失。
- **Update Plot Arcs**(更新剧情线) 会让 AI 根据这个会话发生的事，更新 GM 那份不公开的故事规划。这些规划就是 **Show Spoilers**(显示剧透) 视图里的 **Story Arc**(故事主线)、**Plot Twists**(剧情转折) 和 **Party Arcs**(队伍支线)。

**Regenerate Lorebook**(重新生成世界书) 只出现在最近一个已结束的会话上，而且要开启 Lorebook Keeper 功能才会有。世界书是一组 AI 可以调取的世界设定。

## 分享创建游戏时用的配置

每次新建战役，Game Mode 都会保存一份当时创建配置的快照。可以先玩起来，觉得这套组合好用之后再分享出去。

1. 打开这个战役，再打开 **Session**。
2. 在 **Session History** 里展开 **Initial Game Setup**(初始游戏配置)。
3. 查看保存下来的冒险设定、出场角色、模型、提示词、生成参数，以及视觉、分镜和世界工具方面的设置。
4. 点击 **Copy setup**(复制配置) 复制这段文本，或者点击 **Download setup**(下载配置) 保存成一个文本文件。

> **警告：** 这段文本包含篇幅较长的玩家偏好和自定义 GM 指令。发布之前先读一遍。凭据、服务器 URL、API 密钥和本地数据库 ID 一律不会包含在内。

角色卡、用户角色、世界书、模型和账号只会写出名称，本身并不打包，所以另一位玩家需要自己准备对应项。在快照功能出现之前创建的战役，没存下来的设置也没法找回，因此只有存在可信的快照时，**Initial Game Setup** 才会显示。

## 查看 GM 的隐藏笔记

当前会话那一行里的眼睛图标 **Show Spoilers** 会显示 GM 为当前会话写的私密笔记。看了可能会剧透剧情转折。

1. 打开 **Session**，切到 **Session History**。
2. 在当前会话那一行点击 **Show Spoilers** 按钮（眼睛图标）。

这个视图可能显示 **World Overview**(世界概览)、**Story Arc**、**Plot Twists**、**Party Arcs**，以及保存下来的 **Maps**(地图)、**NPCs** 和 **Character Cards**(角色卡)。再点一次同一个按钮（此时显示为 **Hide Spoilers**(隐藏剧透)），就能把它们藏起来。

要修改这些笔记，点击 **Edit Spoilers**(编辑剧透)，改好文字后点击 **Save Spoilers**(保存剧透)。有些字段是 JSON，一种结构化文本格式。只有看得懂这种格式时才去改，因为格式有误的 JSON 保存不了。

<a id="editing-game-data-by-hand"></a>

## 手动编辑游戏数据

当 GM 搞错了什么，例如某个 NPC 的好感度，或者一个一直没结束的任务，你可以自己修正保存的数据。

1. 打开 **Game controls**(游戏控制)，选择 **Edit game data**(编辑游戏数据)。手机上的 **Game controls** 在三点 **Chat tools**(聊天工具) 菜单里。
2. **Game Data**(游戏数据) 窗口会打开。其中有一条警告：“Hand edits can break a game. Every change is checked before it saves, and names can't change here.”
3. 从列表里选一个分区（手机上是一排小标签）。搜索框可以一次在所有分区中查找某个值。
4. 在 **Fields**(字段) 里修改值，或者切换到 **JSON** 编辑原始数据。
5. 点击 **Review changes**(查看改动)，看清楚具体改了什么，再点击 **Save changes**(保存改动)。

> **警告：** 手动编辑可能损坏游戏。每次保存之前，Marinara 都会尝试记录一个标为 **Before a State Editor save** 的检查点（见[游戏怎么保存](#how-your-game-saves)）。读取它就能撤销一次糟糕的编辑。游戏如果太新，连第一回合都还没保存，就还没有可以记录检查点的内容。

如果没有成功，编辑器会说明原因，并保留你的草稿，方便你修正。如果你编辑期间游戏改动了同一份数据，保存会被拒绝，以免撤销游戏的改动。**Reload**(重新加载) 会显示游戏的版本，并丢弃你的草稿。

可以修改的分区有 **Party Cards**(队伍卡片)、**Party Sheet**(队伍人物卡)、**NPCs**、**Journal**、**Player Notes**(玩家笔记)、**Inventory**(物品栏)、**Story**(故事)、**Session Summaries**(会话摘要)、**World Edits**(世界编辑)、**Story Script**(故事脚本) 和 **HUD Widgets**(HUD 小组件)。只有游戏里有对应数据时才会显示这个分区，所以没有世界的游戏没有 **World Edits**。**World**(世界)、**Maps & Position**(地图与位置)、**Time, Weather & Morale**(时间、天气与士气)、**Combat**(战斗) 和 **Settings**(设置) 等分区标为 **Read-only**(只读)：你可以阅读和搜索它们，但它们由游戏自己维护。提示词、图像、音乐和骰子偏好在 **Chat Settings**(聊天设置) 里修改。

检查会执行这些规则：

- 名称不能改，因为卡片、NPC、队伍和背包是靠名称互相找到的。这里不能添加或移除队伍成员。
- NPC 的好感度范围是 -100 到 100。
- 在 **Inventory** 里，可以修改物品的数量、昵称、携带者，以及它是否穿戴着、是否已同调、是否已开启。去掉一叠就会移除它，添加一叠不带 id 的就会添加一件物品。
- 在 **Session Summaries** 里，只能修改会话的文字。
- **World Edits** 保存你对世界做的手动编辑，例如改名的地点或添加的人物。世界本身永远不会被改动。

这个窗口的用法与 Roleplay 的 State Editor 相同。见 [State Editor](../roleplay/hud-and-trackers.md#the-state-editor)。

<a id="how-your-game-saves"></a>

## 游戏怎么保存

Game Mode 会自动保存。玩的过程中，世界、队伍、地图、物品栏、游戏内时间和会话摘要都会替你留着，不需要保存按钮。

Marinara 还会自动记录检查点：会话开始、会话结束、战斗开始或结束、抵达新地点时，以及按固定间隔。每种检查点只保留最新的五个，较旧的会被清理掉。Game Data 编辑器每次保存之前也会尝试记录一个。

要回到过去：

1. 打开 **Game controls → Checkpoints**(游戏控制 → 检查点)。检查点按时间倒序排列。
2. 在想要回到的那一刻上点击 **Load**(读取)。

**Load** 会让游戏回到那一刻。追踪器、地图、**World Edits**、故事、队伍的卡片和人物卡、NPC、日志、你的笔记、物品栏、会话摘要、GM 的故事规划、HUD 小组件，以及时间、天气和士气，全都会回到那一刻。一条系统消息会标出游戏回退的位置。你的设置保持不变。**Delete**(删除) 会永久删除一个检查点。

只想撤销一个糟糕的回合，就用 **Game controls** 里的 **Retry turn**(重试本回合)，或者换到另一条备选回复。

想自己留一份数据副本，见[备份与恢复](../data/backup-and-restore.md)。

## 相关指南

- [Game Mode：入门](getting-started.md)
- [备份与恢复](../data/backup-and-restore.md)
