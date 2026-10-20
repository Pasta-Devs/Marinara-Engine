# Game Mode：会话与存档

本指南介绍 Marinara Engine 如何在多次游玩之间记录 Game Mode(游戏模式) 的进度，包括结束会话、开始新会话，以及在 **Session History**(会话历史) 里回看过往会话，还会讲到 **Show Spoilers**(显示剧透) 视图、手动修正游戏数据，以及游戏保存数据的方式。

## 什么是会话

Game Mode 把一场冒险切分成带编号的会话。一个会话就是一段连续的游玩过程，相当于跑团时的一个晚上。每个会话都由游戏主持人（GM，负责主持游戏的 AI）来叙述。结束会话时，GM 会写一份摘要，之后随时可以重读。

第一个会话是 **Session 1**。结束它再重新开始，就产生 **Session 2**，依此类推。

<a id="opening-session"></a>

## 打开 Session

**Session**(会话) 用来结束会话、开始新会话，以及查看历史记录。

1. 新建或打开一个 Game Mode 聊天，让游戏界面显示出来。
2. 点击 **Session** 按钮（羽毛图标）。它最初位于聊天右上角附近，可以拖到别处，见[控制窗口及其按钮](../chats/chat-settings.md#control-windows-and-their-buttons)。
3. **Session** 在电脑上是窗口，在手机上是全宽面板。第一行显示 **Session** 以及当前编号和状态。
4. 它有两个选项卡：**Session History** 和 **Journal**(日志)。会话控制和分享创建配置都在 **Session History** 里。

如果用 **Put back in Chat Settings** 把窗口放回过聊天设置，就打开 Chat Settings 里的 **Session** 区域。

## 分享创建游戏时用的配置

每次新建战役，Game Mode 都会把当时的创建配置固化成一份快照。这样就可以先玩起来，觉得这套组合确实好用之后再分享出去，不必在开局前手动记下每一个字段。

1. 打开想要分享的 Game Mode 战役。
2. 打开 **Session**(羽毛图标按钮)。
3. 停留在 **Session History**，然后展开 **Initial Game Setup**(初始游戏配置)。
4. 查看保存下来的冒险设定、出场角色、模型、提示词、实际生效的生成参数，以及视觉、分镜和世界工具方面的设置。
5. 点击 **Copy setup**(复制配置) 把文本复制到剪贴板，或者点击 **Download .txt**(下载 .txt) 保存成一个便于分享的文本文件。

复制出来的文本会包含篇幅较长的玩家偏好和自定义 GM 指令。如果这些字段里写了私人内容，公开发布前请先读一遍。连接凭据、服务器 URL、API 密钥和本地数据库 ID 一律不会包含在内。角色卡、用户角色、世界书、模型和服务商账号只会写出名称供对方参考，本身并不打包，所以另一位玩家需要自己准备或选择本地的对应项。

在快照功能加入之前创建的战役，没存下来的偏好也没法找回，因此只有在存在可信的创建快照时，**Initial Game Setup** 才会出现。

## 结束会话

想给当前这一章收尾、让 GM 写一段摘要时，就结束会话。

1. 打开 **Session**，停留在 **Session History** 选项卡。
2. 顶部就是当前会话，标为 **Session N (Current)**。
3. 在这一行点击 **End Session**(结束会话) 按钮（**Show Spoilers** 旁边的小方块图标）。
4. 弹出标题为 **End Session** 的窗口，要求确认。
5. 需要的话，可以在标着 **What do you want to happen in the next session (optional)?** 的输入框里写点东西，最多 5000 个字符。
6. 留空则由 GM 自然发挥。
7. 点击窗口里的 **End Session** 确认，或者点击 **Cancel** 退出。

确认之后，引擎开始生成摘要。请留在这个界面上等它跑完。生成期间窗口标题会变成 **Ending Session**。完成后，该会话被标记为已结束并进入历史记录。

## 开始新会话

当前会话结束后，同一个按钮会变成 **New Session**(新会话)。

1. 打开 **Session**，切到 **Session History** 选项卡。
2. 在当前会话那一行点击 **New Session** 按钮（播放图标）。
3. GM 接着往下讲。它会参考上一个会话的摘要，以及结束时写下的下次会话备注。

在带有生成世界的游戏里，世界会从上个会话结束时的样子继续下去：过去的天数、队伍的事迹和声望、故事新增的地点和团体，以及队伍去过的地方，都会带进新会话。

## 回看过往会话

**Session History** 选项卡按时间倒序列出已结束的会话。一个都还没结束时，这里显示 **No completed sessions yet**。

每一行显示会话编号、日期，以及记录了多少条发现。点击一行即可展开。展开后的会话可能包含这些字段：

- **Summary**(摘要)：这个会话里发生了什么。
- **Resume Point**(续接点)：下个会话该从哪里接下去。
- **Party Dynamics**(队伍关系)：队伍成员之间的相处状况。
- **Key Discoveries**(关键发现)：重要事实、转折和揭露。
- **Character Moments**(角色高光)：角色的亮眼瞬间。
- **Little Details To Recall**(值得记住的小细节)：细小的习惯、承诺或细节。
- **NPC Updates**(NPC 变化)：NPC(玩家之外、由 GM 控制的角色) 身上发生的变化。
- **Next Session Request**(下次会话要求)：结束会话时留下的那条备注。
- **Stats Snapshot**(数值快照) 和 **Party Status**(队伍状态)：保存下来的数值和队伍状态。

### 重播已结束的会话

已结束的会话可以重播，不会影响战役本身。

1. 在 **Session History** 里展开一个已结束的会话。
2. 点击 **Replay Session**(重播会话)。
3. 用 **Next**(下一步) 和 **Next turn**(下一回合) 逐段翻看当初的叙述和对话。
4. 重播遇到选项时，只有当初实际选中的那一项可点。点它继续沿着记录下来的路线走。
5. 看完之后，点击重播界面顶部的关闭按钮，或者点击 **Return to current session**(返回当前会话)。

重播是只读的：不会调用 GM，不会产生消息，不会改动物品栏或数值，不会更新日志，也不会恢复检查点。重播功能上线之前创建的会话，同样可以用已保存的文本、内嵌效果、选项和现有素材。较早的回合可能缺少某个场景效果，因为当初玩到那一回合时并没有存下来。

### 编辑过往会话

已结束会话的笔记可以手动修改，好让后续会话记对内容。

1. 展开想改的那个会话。
2. 点击 **Edit Details**(编辑详情)。
3. 修改任意字段，然后点击 **Save Details**(保存详情)。点击 **Cancel** 则放弃修改。

展开后的会话上还有另外两个按钮：

- **Regenerate**(重新生成)：让 AI 重跑一遍这个会话的收尾，会重写摘要和条目里所有其他字段。用 **Edit Details** 改过的内容都会丢失。
- **Update Plot Arcs**(更新剧情线)：让 AI 根据这个会话发生的事，更新 GM 那份不公开的故事规划。这些规划就是 **Show Spoilers** 视图里的 **Story Arc**、**Plot Twists** 和 **Party Arcs**。

**Regenerate Lorebook**(重新生成世界书) 按钮只出现在最近一个已结束的会话上，而且要开启可选的 Lorebook Keeper 功能才会有。世界书是一组世界设定条目，AI 可以从中调取内容。

## Show Spoilers 视图

**Show Spoilers** 会展示 GM 为当前会话准备的不公开笔记。游玩过程中这些内容通常是对你保密的，看了可能会剧透剧情转折。

1. 打开 **Session**，切到 **Session History** 选项卡。
2. 在当前会话那一行点击 **Show Spoilers**(眼睛图标)。
3. 面板随即显示 GM 的私密状态。

剧透视图可能包含这些部分：

- **World Overview**(世界概览)：整体设定的大局。
- **Story Arc**(故事主线)：故事计划中的走向。
- **Plot Twists**(剧情转折)：GM 还没抛出来的意外。
- **Party Arcs**(队伍支线)：为队伍安排的成长路线。
- **Maps**(地图)、**NPCs** 和 **Character Cards**(角色卡)：保存下来的游戏数据。

想重新藏起这些笔记，再点一次同一个按钮，此时它显示为 **Hide Spoilers**(隐藏剧透)。

这些秘密还可以直接编辑，相当于一块 GM 作弊面板。点击 **Edit Spoilers**(编辑剧透)，改好文字后点击 **Save Spoilers**(保存剧透)。有些字段以 JSON 这种结构化文本格式呈现。只有在看得懂格式的前提下才去改 JSON 字段，因为格式有误就保存不了。

<a id="editing-game-data-by-hand"></a>

## 手动编辑游戏数据

当 Game Master 搞错了什么，例如某个 NPC 的好感度，或者一个一直没结束的任务，你可以自己修正游戏保存的数据。

1. 打开 **Game controls**(游戏控制)，选择 **Edit game data**(编辑游戏数据)。手机上的 **Game controls** 在三点 **Chat tools**(聊天工具) 菜单里。
2. **Game Data**(游戏数据) 窗口会打开。顶部有一条警告：“Hand edits can break a game. Every change is checked before it saves, and names can't change here.”
3. 从列表里选一个分区，手机上则从那一排小标里选。也可以在搜索框里输入，一次在所有分区中查找某个值。
4. 在 **Fields**(字段) 里修改值，或者切换到 **JSON** 编辑原始数据。
5. 点击 **Review changes**(查看改动)，看清楚具体改了什么，再点击 **Save changes**(保存改动)。

可以修改的分区有 **Party Cards**(队伍卡片)、**Party Sheet**(队伍人物卡)、**NPCs**、**Journal**(日志)、**Player Notes**(玩家笔记)、**Inventory**(物品栏)、**Story**(故事)、**Session Summaries**(会话摘要)、**World Edits**(世界编辑)、**Story Script**(故事脚本) 和 **HUD Widgets**(HUD 小组件)。只有游戏里有对应数据时才会显示这个分区，所以没有世界的游戏没有 **World Edits**。其他分区，例如 **World**(世界)、**Maps & Position**(地图与位置)、**Time, Weather & Morale**(时间、天气与士气)、**Combat**(战斗) 和 **Settings**(设置)，会标为 **Read-only**(只读)。你可以阅读和搜索它们，但它们由游戏自己维护。提示词、图像、音乐和骰子偏好在 **Chat Settings**(聊天设置) 里修改。

每项改动在保存前都会经过检查：

- 名称不能改，因为卡片、NPC、队伍和背包是靠名称互相找到的。这里不能添加或移除队伍成员。
- NPC 的好感度范围是 -100 到 100。
- 在 **Inventory** 里，可以修改物品的数量、昵称和携带者，以及它是否穿戴着、是否已同调、是否已开启。去掉一叠就会移除它，添加一叠不带 id 的就会添加一件物品。
- 在 **Session Summaries** 里，只能修改会话的文字。
- **World Edits** 保存你对世界做的手动编辑，例如改名的地点或添加的人物。世界本身永远不会被改动。

改动无法保存时，编辑器会说明原因，该分区会保留你的草稿，方便你修正。如果你编辑期间游戏改动了同一份数据，保存会被拒绝，以免撤销游戏的改动。**Reload**(重新加载) 会显示游戏的版本，并丢弃你的草稿。

每次保存之前，游戏都会尝试记录一个检查点，在 **Checkpoints**(检查点) 里标为 **Before a State Editor save**。如果编辑出了问题，读取这个检查点即可撤销（见下文）。

这个窗口的用法与 Roleplay 的 State Editor 相同。见 [State Editor](../roleplay/hud-and-trackers.md#the-state-editor)。

<a id="how-your-game-saves"></a>

## 游戏怎么保存

Game Mode 会自动保存进度，不需要按什么保存按钮。玩的过程中，世界、队伍、地图、物品栏、游戏内时间和会话摘要都会替你留着。

应用还会在后台自动记录检查点：会话开始、会话结束、战斗开始或结束、抵达新地点时各记录一次，另外还会按自动间隔记录。[Game data 编辑器](#editing-game-data-by-hand)每次保存之前也会尝试记录一个检查点，不过游戏如果太新，连第一回合都还没保存，就还没有可以记录的内容。打开 **Game controls → Checkpoints**(游戏控制 → 检查点) 即可查看，最新的排在最前。**Load**(读取) 会让游戏回到那一刻：追踪器、地图、Game data 编辑器里的 **World Edits**(世界编辑)，以及那之后的故事都会恢复，并有一条系统消息标出游戏回退的位置。队伍的卡片和人物卡、NPC、日志、你的笔记、物品栏、会话摘要、GM 的故事计划、HUD 小组件，以及时间、天气和士气，也都会回到那一刻。你的设置保持不变。**Delete**(删除) 会永久删除这个检查点。

每种自动检查点只保留最新的五个，所以较旧的会在游玩过程中被清理掉。

只想撤销一个糟糕的回合，就改用 **Game controls** 里的 **Retry turn**(重试本回合)，或者换一条备选回复。读取检查点还会把故事一并恢复到那一刻。

想自己留一份数据副本，就用应用自带的备份工具。参见[备份与恢复](../data/backup-and-restore.md)。

## 相关指南

- [Game Mode：入门](getting-started.md)
- [备份与恢复](../data/backup-and-restore.md)
