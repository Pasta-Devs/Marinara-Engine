# 群聊与 Conversation 模式群聊

群聊就是有两个或更多角色的 Conversation(对话模式) 或 Roleplay(角色扮演) 聊天。本指南介绍怎么创建群聊、管理成员，以及选择谁来发言。Game Mode(游戏模式) 有自己的队伍系统，本指南不涉及。

界面上没有单独的“群聊”按钮。聊天加进第二个角色，就成了群聊。群聊既不是 **Folder**(文件夹，保存下来、可以反复使用的角色名单)，也不是 **Chat Branch**(聊天分支，同一个聊天的另一个版本)。

## 创建群聊

1. 在 **Chats**(聊天) 面板里，点击对应模式的 **+** 按钮（**New Conversation**(新建 Conversation 聊天) 或 **New Roleplay**(新建 Roleplay 聊天)）。
2. 设置向导会打开。在 **Persona & Characters**(用户角色与角色) 这一步，在 **Search characters...**(搜索角色) 里输入，然后点击角色把它加进来。
3. 用同样的方式加入第二个角色。
4. 完成向导，聊天就会打开。

选择器上方的标签会变。Conversation 里显示 **Group Chat**(群聊) 加成员数量，Roleplay 里显示 **Characters**(角色) 加数量。不给聊天改名的话，Marinara 会用角色名给它命名，比如“Alice, Bob, Carol”。

角色数量没有固定上限。但角色越多，提示词越长，每条回复的成本也越高，所以只加场景用得上的角色。

要一次加入整个 Folder，在同一步打开 **Add from Folder**(从文件夹添加)，选一个 Folder，然后点击 **Add**(添加)。已经在聊天里的角色会被跳过。只有至少有一个 Folder 时，这个控件才会出现。见[整理角色库](../characters/library-organization.md)。**Random**(随机) 那一行（标注为 **Dice pick**(掷骰选取)）会随机加入一个还不在聊天里的角色。

## 管理成员

打开 **Chat Settings**(聊天设置)，找到 **Characters** 区域。Game Mode 里没有这一节。每一行成员都带头像、名字、拖动手柄、眼睛图标和垃圾桶图标。

| 想要 | 操作 |
|---|---|
| 添加角色 | 点击 **Add Character**(添加角色) 然后搜索。 |
| 添加 Folder | 点击 **Add Character**，再点文件夹那一行的 **Add all**(全部添加)。 |
| 一次修改多个 | 点击某个成员的名字，会打开同一个选择器。 |
| 移除角色 | 点击垃圾桶图标（**Remove from chat**(从聊天中移除)）。 |
| 调整顺序 | 拖动手柄（**Drag to reorder**(拖动调整顺序)）。在 **Sequential**(依次轮流) 顺序下，角色按这里的排列回复。 |
| 暂时停用 | 点击眼睛图标（**Disable in chat**(在此聊天中禁用)）。再点一次重新启用（**Enable in chat**(在此聊天中启用)）。 |

禁用的角色仍留在列表里，但不会出现在任何回复中。它的角色卡不会发给模型，它也不能被选来发言。如果把所有角色都禁用了，Marinara 会把他们全部当作启用状态，免得回复为空。这个状态按聊天保存，不会影响其他地方。在 Merged 模式的 Roleplay 群聊里，可以由[自动管理活跃角色](#automate-active-characters-merged-only)替你设置。

<a id="choose-who-speaks"></a>

## 选择谁来发言

打开 **Chat Settings → Group Chat**(聊天设置 → 群聊)。只有聊天里有两个或更多角色时，这个区域才会出现。两种模式使用同一个 **Mode**(模式) 开关。

- 一条回复演绎所有角色。在 Roleplay 中叫 **Merged (Narrator)**(合并叙述)，在 Conversation 中叫 **Grouped**(合并)。这是默认值。在 Roleplay 中，旁白是描述场景的声音，也包含在同一条回复里。
- **Individual**(各自独立) 让每个角色各自回复一条。

在 Conversation 中切换到 **Individual** 时，会显示一条警告：**Individual replies can use many tokens**。每个回复的角色都会单独发起一次模型请求，开启了 Autonomous Messaging(自主消息) 的大群会很快消耗 Token。

### Automate active characters(Roleplay，仅 Merged 模式)

这个设置会在角色众多时替你开关角色。见本指南末尾的[自动管理活跃角色](#automate-active-characters-merged-only)。

### Color Dialogues(Roleplay，仅 Merged 模式)

**Color Dialogues**(对白配色) 默认关闭。开启后，每个角色的台词会使用 Character Editor(角色编辑器) 的 **Colors**(颜色) 选项卡里该角色自己的配色。在 Conversation 群聊中，台词会自动按发言人上色，没有这个开关。

<a id="response-order-individual-only"></a>

### Response Order(仅 Individual 模式)

**Mode** 为 **Individual** 时，会出现 **Response Order**(回复顺序)。默认是 **Sequential**。

| 顺序 | 会发生什么 |
|---|---|
| **Sequential** | 角色按 **Characters** 列表里的顺序轮流回复。在 Conversation 中，离线的角色会被跳过。 |
| **Smart**(智能挑选) | 一次简短的隐藏模型调用会挑出下一个回复的人，通常只有一个角色。你在消息里写 `@Alice` 这样的提及，会覆盖它的选择。在 Conversation 中，它会参考对话内容、日程状态和话多程度。 |
| **Manual**(手动) | 没有人会主动回复。在 Roleplay 中，使用 **Trigger Response**(触发回复) 选择器。在 Conversation 中，用 `@mention` 提及一个或多个角色，或者使用选择器。 |

用 **Smart** 顺序时，模型可能一次排出多个角色，但只有第一个会立刻回复。用 **Trigger Response** 选择器，或者发一条空消息，就能让队列里的下一个角色生成回复。

如果你选择了 [Decision 模型](../connections/decision-models.md)，可以开启它下方的 **Also use it to pick who speaks in Smart response order**(也用于 Smart 回复顺序的发言者选择)。之后 Smart 顺序会为每位候选人请求一个是/否评分。

- 这些问题共享最近 5 条消息，以及一份名单，列出每位候选人的名字、状态、活动、话多程度和简短的性格摘录。托管服务也会收到这份名单。见[模型能看到什么](../connections/decision-models.md#what-the-model-sees)。
- 速度和成本取决于模型和候选人数。
- 在 Roleplay 中，Marinara 选出最可能的发言者。在 Conversation 中，有理由回复的人都会回复，可能性最高的排在前面。如果其他人有理由回答，刚刚发言的角色会等待。
- 如果 Decision 模型没有给出答案，Smart 顺序会改用平常的模型调用。

在 Roleplay 的 **Individual** 模式下，使用 **Smart** 或 **Manual** 顺序时，选择器的第一个选项是 **Smart**，带有人群图标。它会请模型为这一条回复选择下一位发言者。已保存的顺序不会改变。

### 手动触发回复

用 **Trigger Response** 选择器指定发言人。电脑上，它是 **Send**(发送) 旁边的一个按钮，标签为 **Trigger character response**(触发角色回复)。手机上，它在从消息栏打开的工具盘里，位于 **Trigger Response** 下。想用文字点名发言人，输入 `@` 再跟上角色名，会弹出自动补全列表。

### 更多 Individual 设置

- **Add Turn To Prompt**(把当前回合写进提示词) 默认开启。它会加一句简短的指令，点明这一轮该由哪个角色回复。
- **Name Prefix History**(历史消息加姓名前缀，仅 Roleplay) 默认关闭。它会改变历史消息标注发言人名字的方式。除非某个角色总是搞混谁说了什么，否则保持关闭。

### Scenario Override(Roleplay)

**Scenario Override**(场景覆盖) 给整个群组一个共用的场景。输入框里的文字会取代提示词中每个角色各自的场景。留空则各角色的场景保持原样。这里没有开关。想在更大的窗口里编辑，点击展开图标（**Expand editor**(展开编辑器)，窗口标题为 **Group Scenario Override**(群组场景覆盖)）。这段文字只属于一个聊天，不会存进设置方案。

### Character Exchanges(Conversation)

在 **Chat Settings → Autonomous Messaging**(聊天设置 → 自主消息) 里开启 **Character Exchanges**(角色互聊)，你不在的时候角色之间也能互相聊天。它默认关闭，只在群聊中出现。它只在 Marinara 于浏览器里保持打开时运行，并和自主消息共用同一个每日消息上限。无论是否设置了角色日程，它都能运行。在 **Individual** 群聊里，角色互聊和 `@mention` 回复都不会占用群聊当天的最后一次问候。

## 设置项与默认值

| 设置项 | 位置 | 默认值 |
|---|---|---|
| **Mode** | Group Chat 区域 | Roleplay 中为 **Merged (Narrator)**，Conversation 中为 **Grouped** |
| **Color Dialogues** | Roleplay，Merged | 关闭 |
| **Automate active characters**(自动管理活跃角色) | Roleplay，Merged | 关闭 |
| **Response Order** | Individual | Sequential |
| **Add Turn To Prompt** | Individual | 开启 |
| **Name Prefix History** | Roleplay，Individual | 关闭 |
| **Scenario Override** | Roleplay | 空 |
| **Character Exchanges** | Conversation，Autonomous Messaging | 关闭 |

设置方案会保存这些设置，**Scenario Override** 和自动化的固定除外。见[设置方案](settings-profiles.md)。

## 参考

<a id="automate-active-characters-merged-only"></a>

### Automate active characters(仅 Merged 模式)

在 Merged 模式下，每个活跃角色的卡片在每次回复时都会进入提示词。在 Roleplay 中，**Automate active characters** 可以替你开关这些卡片，免得角色一多就撑满上下文。它有三个选项，默认是 **Off**(关闭)。

| 选项 | 作用 |
|---|---|
| **Off** | 由你用眼睛开关选择谁活跃。 |
| **Decision model**(判定模型) | 每次回复前，你的 [Decision 模型](../connections/decision-models.md)会为每个角色回答一个是/否问题：这个角色是否在本次回复所延续的场景中，或正要进入场景？只是被提到或被回忆起的角色保持关闭。 |
| **Character Tracker** | 由 [Character Tracker](../agents/built-in-agents.md#character-tracker) 在上一条回复中记录的在场角色决定谁活跃。它不需要额外的模型调用，但会晚一轮生效：现在才进场的角色，要到下一条回复才会开启。 |

设置下方的提示会说明缺了什么：没有选择 Decision 模型、此聊天里的 Character Tracker 处于关闭状态，或者追踪器为手动运行（这样列表只会在你运行它之后才改变）。

- **固定。** 自动化开启时，每一行角色在眼睛图标左边都会显示一个图钉。点击它可以把这个角色固定在当前状态（开或关），之后自动化就不再动它。手动拨眼睛开关也会固定该角色。再点一次图钉可取消固定。把自动化切到 **Off** 会清除所有固定。
- **旁白保持活跃。** 被指定的 Narrator(旁白) 永远不会被关闭。
- **没有答案就保留列表。** 在 **Decision model** 模式下，如果模型没有给出答案，就改用 Character Tracker 的最近一个场景（如果有的话）。这也适用于先思考的模型，除非开启了 **Also gate agents that run before the reply**(也判定回复前运行的智能体)；角色阵容大到塞不进 Decision 模型输入时也一样。如果两者都没有答案，列表保持原样。
- **不允许没有人活跃。** 会让所有人都关闭的结果不会被采用。
- **Character Activity 智能体优先。** 如果聊天里有自定义智能体使用 **Character Activity** 结果类型，就由该智能体继续负责。

Character Tracker 会按自己的叫法为每个角色写名字。Marinara 先按卡片 id 把它匹配到卡片，再按名字，最后按 **Colors** 选项卡里的名字别名。如果追踪器的列表里没有聊天中任何一个角色的名字，就保留当前列表。自动化在每次回复、备选回复和重新生成之前运行，并跳过 **Continue** 和代写。这个设置会存进设置方案；固定只属于单个聊天。
