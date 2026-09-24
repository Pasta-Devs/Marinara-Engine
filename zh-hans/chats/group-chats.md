# 群聊与 Conversation 模式群聊

本指南介绍 Marinara Engine 里的群聊，也就是同时装着两个或更多角色的聊天，讲清楚怎么建一个群聊、怎么加人和踢人，也讲怎么在 Conversation(对话模式) 和 Roleplay(角色扮演) 里控制谁开口。

## 什么是群聊

只要一个聊天里有两个或更多角色，它就是群聊。界面上没有单独的“群聊”按钮，普通聊天加进第二个角色，自动就成了群聊。

群聊支持两种模式：**Conversation** 和 **Roleplay**。Game Mode(游戏模式) 有自己独立的队伍系统，本指南不涉及。

Marinara 里“群组”这个说法对应好几样东西，容易混。群聊指的是一个聊天里有多个角色，这和 **Folders**(文件夹) 不一样，后者是保存下来、可以反复使用的角色名单；也和 **Chat Branches**(聊天分支) 不一样，那是同一个聊天的不同版本。本指南只讲群聊。

## 创建群聊

群聊用的还是平时那个 New Chat 设置向导，只不过角色要选两个以上。

1. 在侧边栏点击对应模式的新建聊天按钮，按钮上写的是 **New Conversation**(新建 Conversation 聊天) 或 **New Roleplay**(新建 Roleplay 聊天)。
2. 走到向导中标题为 **Persona & Characters**(用户角色与角色) 的那一步。
3. 在 **Search characters...**(搜索角色) 输入框里搜索角色，点头像或名字把人加进来。
4. 用同样的方式加入第二个角色。想加多少个都行。
5. 完成向导，聊天就打开了。

加进第二个角色之后，选择器上方的标签会变。Conversation 模式下显示 **Group Chat**(群聊) 加成员数量，Roleplay 模式下显示 **Characters**(角色) 加数量。

角色数量没有硬性上限。但角色越多，提示词（Marinara Engine 发给 AI 的那段文字）越长，每条回复的成本也越高。场景用得上谁就加谁。

不给聊天改名的话，Marinara 会拿角色名当标题，中间用逗号隔开，比如“Alice, Bob, Carol”。

### 用 Folders 一次加入多个角色

如果已经建好了 Folder，可以一步把整个 Folder 加进来。Folder 是在 **Characters** 面板里攒出来的角色名单，要搭一个以后还会反复用的群聊，这是最快的办法。

1. 在 **Persona & Characters** 这一步，打开 **Add from Folder**(从文件夹添加) 下拉菜单。
2. 从列表里选一个 Folder。
3. 点击下拉菜单旁边的 **Add**(添加)。

这个 Folder 里还没在聊天中的角色会全部加进来。只有至少存在一个 Folder 时，**Add from Folder** 控件才会出现。Folder 的创建和管理方法见文末关于整理角色库的指南。

也可以点击 **Random**(随机) 那一行（标注为 **Dice pick**(掷骰选取)），随机加入一个还不在聊天里的角色。

## 创建之后管理成员

加人、踢人、调顺序都在 **Chat Settings**(聊天设置) 面板里完成。点击聊天顶栏的齿轮图标就能打开，齿轮的提示文字是 **Chat Settings**。

在面板里找到 **Characters** 这一节，那里显示成员数量，还有一句说明文字“Characters in this chat. Each character has their own personality that the AI roleplays as.”每一行成员都带头像、角色名、拖动手柄、眼睛图标和垃圾桶图标。

- 再加一个角色，点击 **Add Character**(添加角色) 然后搜索。
- 加入整个 Folder，点击 **Add from Folder** 选一个。
- 移除角色，点击垃圾桶图标，它的提示文字是 **Remove from chat**(从聊天中移除)。
- 调整顺序，用拖动手柄把成员上下拖动，提示文字是 **Drag to reorder**(拖动调整顺序)。

成员顺序是有讲究的。在 **Sequential**(依次轮流) 回复顺序下（下面会讲），角色按这里的排列依次回复。想改谁先开口，拖一下就行。

Game Mode 里没有 **Characters** 这一节，它的队伍在别的地方管理。

### 让成员暂时不出场，但不移出名单

有时候只是想让某个角色歇一阵子，人还留在名单里。用成员那一行的眼睛图标。

- 点一下眼睛就禁用这个角色，提示文字变成 **Disable in chat**(在此聊天中禁用)，眼睛上会出现一道斜杠。
- 再点一下把人放回来，提示文字是 **Enable in chat**(在此聊天中启用)。

禁用的角色仍然留在成员列表里，但不会出现在任何回复里。Marinara 不会把他的角色卡发给模型，也不会挑他发言。

这里有一道保险：如果把聊天里所有角色都禁用了，Marinara 会重新把他们全部当作启用状态，免得生成一条没有任何角色的回复。

启用和禁用的状态按聊天单独保存，不会影响这个角色在应用其他地方的表现。

## 谁来发言：Roleplay 模式

在 Roleplay 模式下，群聊会在 **Chat Settings** 里多出一个 **Group Chat** 分区，只有聊天里有两个或更多角色时才出现。角色怎么回复就在这里控制。

### Merged (Narrator) 还是 Individual

**Mode**(模式) 是一个双按钮开关。

- **Merged (Narrator)**(合并叙述) 是默认值，一条回复一次性演完所有角色，旁白也包含在内。
- **Individual**(各自独立) 让每个角色各自生成一条独立的回复。

### Color Dialogues(仅 Merged 模式)

**Mode** 为 **Merged (Narrator)** 时，可以开启 **Color Dialogues**(对白配色)，默认关闭。开启后，每个角色的台词按各自的配色显示。配色来自 Character Editor 的 **Colors**(颜色) 选项卡，那里设置名字颜色、对白颜色和文本框颜色。具体设置方法见角色编辑指南。

<a id="response-order-individual-only"></a>

### Response Order(仅 Individual 模式)

**Mode** 为 **Individual** 时会出现 **Response Order**(回复顺序) 设置，是一个三按钮开关。

- **Sequential** 是默认值，所有角色轮流回复，顺序就是 **Characters** 列表里的排列顺序。调整成员顺序即可改变发言次序。
- **Smart**(智能挑选) 会用一次简短的隐藏 AI 调用来判断接下来该谁回复，它会读最近的消息和每个角色的资料，通常只挑一个发言者。如果消息里写了 `@Alice` 这样的 @ 提及，就以你指定的为准。

  已选择 **Decision model**(判定模型) 时（见 [Decision 模型](../connections/decision-models.md)），可以开启其下的 **Also use it to pick who speaks in Smart response order**(也用于 Smart 回复顺序的发言者选择)。Smart 顺序随后为每位候选人请求独立的是/否评分。这些问题共享最近 5 条消息，以及含候选人姓名、状态、活动、话多程度和简短性格或描述摘录的名单。托管服务商也会收到名单，见[模型能看到什么](../connections/decision-models.md#what-the-model-sees)。

  这些评分可能比完整 AI 回复更快，但速度和成本取决于模型和候选人数。Roleplay 中 Marinara 选择最可能的发言者。Conversation 中，有理由回复的人都会回复，可能性最高的排在前面。刚发言的角色在其他人有理由回答时会等待。如果 Decision 模型不回答，Smart 顺序改用原有 AI 调用。

- **Manual**(手动) 关掉一切自动回复，谁开口完全由你在消息栏的 **Trigger Response**(触发回复) 选择器里指定。

用 **Smart** 顺序时，AI 可能一次排出多个角色，但只有第一个会立刻回复。想让下一位发言，用消息栏的 **Trigger Response** 选择器；也可以发一条空消息，让队列里的下一个角色生成回复。

**Individual** 模式下还会多出两个开关：

- **Add Turn To Prompt**(把当前回合写进提示词) 默认开启，它会加一句简短的指令，点明这一轮该由哪个角色回复。
- **Name Prefix History**(历史消息加姓名前缀) 默认关闭，它会改变历史消息发给模型之前标注发言人姓名的方式。除非某个角色总是搞混谁说了什么，否则保持关闭。

### Scenario Override

**Scenario Override**(场景覆盖) 输入框用来给整个群组指定一个共用场景。往里面填任何文字，这段文字就会取代提示词中每个角色各自的场景。留空则各角色照常使用自己的场景。

这里没有开关：填上文字就是开启，清空文字就是关闭。想在更大的窗口里编辑，点击展开图标（提示文字 **Expand editor**(展开编辑器)），放大后的编辑器标题是 **Group Scenario Override**(群组场景覆盖)。

复用时要注意一点：**Scenario Override** 的文字只属于当前这一个聊天，不会写进设置方案，所以换到新聊天时不会跟着方案一起过去。

### 设置项与默认值（Roleplay）

| 设置项 | 位置 | 默认值 |
|---|---|---|
| **Mode**(**Merged (Narrator)** / **Individual**) | Group Chat 分区 | Merged (Narrator) |
| **Color Dialogues** | Group Chat 分区，Merged 模式 | Off |
| **Response Order**(Sequential / Smart / Manual) | Group Chat 分区，Individual 模式 | Sequential |
| **Add Turn To Prompt** | Group Chat 分区，Individual 模式 | On |
| **Name Prefix History** | Group Chat 分区，Individual 模式 | Off |
| **Scenario Override** | Group Chat 分区 | 留空（关闭） |

这些设置大多会存进设置方案，可以反复使用。唯一的例外是 **Scenario Override**，它只留在单个聊天里。

## 谁来发言：Conversation 模式

Conversation 模式同样支持群聊，但不显示 **Group Chat** 分区，相关控件放在 **Chat Settings** 的 **Autonomous Messaging**(自主消息) 分区里。

默认情况下，群聊在 Conversation 模式下的表现和 Merged 模式一样：一条回复可以同时演多个角色，台词会自动按发言人上色。Conversation 模式里没有单独的配色开关要设。

### Reply When Mentioned

开启 **Reply When Mentioned**(被提及时才回复)，聊天就切换成一次只有一个角色说话。开启后，角色只在被点名或被手动触发时才回复。开关的说明文字是“Characters wait for direct mentions or manual response triggers.”

点名靠 @ 提及。在消息输入框里输入 `@` 再跟上角色名，会弹出自动补全列表。被提及的角色就是会回复的角色。

不想打字提及、直接指定发言人，用 **Trigger Response** 选择器。

- 电脑上，它是 Send 旁边的一个按钮。
- 手机上，它在消息栏展开的工具盘里，标题为 **Trigger Response**。

按钮的提示文字是“Trigger character response”。

### Character Exchanges

开启 **Character Exchanges**(角色互聊)，角色之间就能自己聊起来，默认关闭。说明文字是“Characters chat with each other in group chats.”

开启后，你不在的时候角色也能互相回复，而不只是回复你。这只在 Marinara 于浏览器里保持打开时才运行，关掉应用，互聊就停了。它和自主消息共用同一个每日消息上限。

## 回合处理速览

| 模式与设置 | 会发生什么 | 怎么干预 |
|---|---|---|
| Roleplay，Merged | 一条回复演完所有角色 | 始终是所有角色一起上 |
| Roleplay，Individual，Sequential | 各角色按成员顺序依次回复 | 拖动成员调整顺序 |
| Roleplay，Individual，Smart | AI 挑出下一位或下几位发言者 | 用 `@Name` 提及覆盖它的选择 |
| Roleplay，Individual，Manual | 没人会主动回复 | 用 **Trigger Response** 选择器 |
| Conversation，默认 | 一条回复可以演多个角色 | 用 `@Name` 提及指定角色 |
| Conversation，开启 Reply When Mentioned | 没有提及或触发就没人回复 | 用 `@Name` 提及或 **Trigger Response** 选择器 |
| Conversation，开启 Character Exchanges | 角色之间也会互相发消息 | 关掉它就停 |

## 相关指南

- [整理角色库](../characters/library-organization.md)
- [Conversation 模式：入门](../conversation/getting-started.md)
- [Roleplay 模式：入门](../roleplay/getting-started.md)
