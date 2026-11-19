# Game Mode：入门

Game Mode(游戏模式) 把 Marinara Engine 变成一款由 AI 游戏主持人主持的单人角色扮演游戏。用本指南开一局游戏、玩第一个回合，并找到各项控件。

Game Mode 是三种聊天模式之一（Conversation(对话模式)、Roleplay(角色扮演) 和 Game Mode）。游戏主持人（GM）就是负责讲述世界、扮演你遇到的每一个角色、决定接下来发生什么的那个 AI，作用和桌面跑团里的 DM 一样。Marinara 会替你追踪地图、队伍、非玩家角色（NPC，即玩家之外的角色）、物品、任务、世界内的时间和天气。一场长游戏可以拆成若干个**会话**，就像一条战役分到好几个游戏之夜来跑。

所有机制都不是必须用的。你可以跳过战斗和骰子，只玩故事。

## 开始之前

只需要一样东西：一个给 GM 用的 AI 账号。还没添加的话，见[连接 AI 服务商](../connections/connecting-to-a-provider.md)。

其余全是可选项，默认关闭，以后再加也行：

- **图像。** **Illustrator**(插画师) 智能体会绘制 NPC 肖像、地点背景和场景图像。从 **Agents → Agent Organizer**(智能体 → 智能体管理器) 下载它。它需要一个图像账号。没有它也能照常玩，故事、状态追踪和战斗都在，只是视觉区域是空的。
- **内置模型提供的场景效果。** Marinara 可以在你自己的电脑上跑一个小模型，免费挑选背景和音乐。下载之后，它就成为默认的 **Scene effects model**(场景效果模型)。在那之前，默认是 **Skip - use inline tags from GM**(跳过，使用 GM 的行内标签)。见[内置模型设置](../connections/local-model.md)。
- **分镜。** 下载 Storyboard 智能体，然后为这局游戏开启它。见 [Storyboard 智能体指南](storyboard.md)。
- **视频。** 只有场景视频或动态分镜才需要视频账号。
- **音乐。** **Music DJ** 智能体会播放来自 Spotify 或本地音乐文件夹的音乐。

## 开始一局游戏

1. 在聊天侧边栏打开 **GM** 选项卡，点击 **+** 按钮（**New Game**）。也可以在主屏幕上点击 **Game**。设置向导随即打开。见[管理聊天](../chats/managing-chats.md)。
2. 在第一步选择运行 GM 的 **Model**(模型)。选一个之前添加过的账号。列表为空的话，先添加一个。世界生成建议选一个能力强的付费模型（见[怎么选模型](#choosing-a-model)）。
3. 每一步都点击 **Next**(下一步)。其他字段都有默认值，所以可以一路点过去。
4. 在最后一步点击 **Create world**(创建世界)。Marinara 构建世界时，按钮会显示 **Generating World…**。这是发给模型的一次大请求，所以要等它完成。
5. 世界准备好后，游戏界面会显示 **Start Game**(开始游戏)。点击它，GM 就会写出第一条消息。

如果开着自定义 HUD 小组件（默认开启），**Start Game** 下方会有一个 **Review Starting Widgets**(检查初始小组件) 按钮。可以跳过它，也可以先用它修改初始小组件。见 [Game Mode：HUD 小组件](hud-widgets.md)。

> **提示：** 第一次玩 Game Mode 的话，**Game Master Mode**(游戏主持人模式) 就留在 **Standalone GM**。Marinara 会替你造一个毒舌的旁白。

如果没有成功，见[世界生成报 JSON 错误或 422 错误](#world-generation-fails-with-a-json-or-422-error)。

### 设置向导

| 步骤 | 设置内容 |
| --- | --- |
| **Connection**(连接) | **Game Name**(游戏名称)、运行 GM 的 **Model**，以及可选的 **Scene effects model**。**Game Mode**(游戏玩法) 卡片目前只显示 **VN**。 |
| **World**(世界) | 类型、背景、基调、难度、内容分级、故事风格、暴力程度、内容边界和语言。**Combat Preference**(战斗偏好) 为 **Turn-Based**(回合制) 或 **Tactical**(网格战斗)。所有新游戏都采用 **MRPG**(Marinara RPG) 职业（见 [MRPG 职业](mrpg-classes.md)）。安装了规则集时，会出现 **Rules**(规则) 选项（见[选择规则](#choose-rules)）。 |
| **Party**(队伍) | 你的用户角色（你扮演的角色）、**Game Master Mode**、队伍成员和 **GM intro message**(GM 开场消息)（见 [GM 开场消息](#the-gm-intro-message)）。每位成员的 MRPG 起始树来自其卡片的 **Game Mode** 区块（见[选择角色的树](mrpg-classes.md#choose-a-characters-trees)）。 |
| **Goals**(目标) | 你想从这场冒险里得到什么。 |
| **Lorebooks**(世界书) | GM 会当作正典的世界书。世界书就是一组世界背景设定。见[世界书](../lorebooks/overview.md)。 |
| **Features**(功能) | **Enable Agents**(启用智能体)，然后是每个已下载智能体的卡片（**Illustrator**、**Music DJ**、**Lorebook Keeper**），以及 **Custom HUD Widgets**(自定义 HUD 小组件)、**Quick Time Events**(快速反应事件) 和 **Start Muted**(开局静音)。 |
| **GM** | 呈现方式和 **GM Prompt**(GM 提示词)。 |

背景和目标下方给出的点子，每次打开向导都会变化。在 Tactical 游戏中，GM 会为每场战斗写一段简述，Marinara 据此生成棋盘。见[战斗](combat.md#tactical-battles-and-terrain)。

**World** 步骤里还有针对首领的战斗选项。**GM directs bosses**(GM 控制首领) 默认开启。它让 GM 用你的 GM 连接来决定首领的回合，这可能要花一点时间。普通敌人自己做决定，除非 **GM directs bosses** 开启、且游戏的规则集把对手交给 Game Master 操控（见 [Game Master 文本](../extending/ruleset-sheets.md#game-master-text)）。**GM directs bosses** 开启时，**Game Master also plays named and brilliant opponents**(Game Master 也扮演有名有姓、才智超群的对手)（默认开启）让 GM 也扮演有名字的角色和非常聪明的敌人。另有两个选项始终显示：**Companions fight on their own**(同伴自主战斗)（默认开启；关掉它就由你自己操控整个队伍）和 **Let cruel opponents strike the fallen**(允许残忍的对手攻击倒下的角色)（默认关闭）。新游戏还提供 **Permadeath**(永久死亡)（默认关闭）：队伍成员若在战斗中倒下，且战斗结束前没有获救，就会永远离队。见[战斗](combat.md)。

下载了 **Hierarchical Maps** 智能体（现在叫 World Maps，见 [World Maps](../agents/hierarchical-maps.md)）并开启 **Enable Agents** 后，**Features** 步骤还可以起草一份 **Hierarchical world map**(分层世界地图)、使用已保存的地图模板，或者关联一个共享世界。

### 值得先了解的默认值

| 设置项 | 默认值 | 说明 |
| --- | --- | --- |
| Genre | Fantasy | 可多选，也能自己加。|
| Tone | Heroic | 可多选。 |
| Difficulty | Normal | **Casual**、**Normal**、**Hard** 或 **Brutal**。设置越高，战斗越难：MRPG 游戏会出现更多、更强的敌人（见 [MRPG 游戏中的战斗](combat.md#battles-in-an-mrpg-game)），Legacy 游戏中的敌人则会打得更重（见[难度缩放](combat.md#difficulty-scaling)）。 |
| Content Rating (sexual content)(内容分级（性内容）) | SFW | **SFW** 或 **NSFW**。只涉及性内容。NSFW 只是允许，不会强制出现。 |
| Story style(故事风格) | Standard(标准) | **Gentle**(温和) 会让 GM 带来的压力更小。见[故事风格、暴力程度和内容边界](#story-style-violence-and-content-boundaries)。 |
| Violence(暴力程度) | Serious(严重)（SFW）或 Graphic(血腥)（NSFW） | **Mild**(轻微)、**Serious** 或 **Graphic**。与内容分级分开设置。 |
| Content boundaries(内容边界) | 无 | GM 会从故事中排除的主题。 |
| Language | English | 游戏内所有文字都用这个语言书写。 |
| Game Master Mode | Standalone GM | **Character GM** 用你的某张角色卡当 GM。 |
| Scene effects model | Built-in model | 下载之后才是。在那之前，默认是 **Skip - use inline tags from GM**。 |
| Enable Agents | Off | 开启后才能看到智能体卡片。 |
| Illustrator | Off | 需要 Illustrator 智能体和一个图像账号。 |
| Music DJ | Off | 需要 Spotify 或本地音乐文件夹。 |
| Custom HUD Widgets | On | 模型会为新世界设计状态小组件。 |
| Quick Time Events | On | 使用屏幕阅读器或不想限时游玩时关闭。 |
| Start Muted | Off | 开局时所有音频静音。 |
| Game Presentation | Standard | 见下文。 |

### 故事风格、暴力程度和内容边界

**World** 步骤有四项设置，决定故事可以包含什么内容，以及这些内容带来的冲击有多大。它们集中在 **Content Rating (sexual content)** 下方。游戏开始后，除了内容分级，其余都可以修改。见[在游戏中修改这些设置](#change-them-during-a-game)。

| 设置 | 决定什么 |
| --- | --- |
| **Content Rating (sexual content)** | **SFW**：允许恋爱和亲昵互动，性场景会淡出跳过。**NSFW**：性场景可以露骨描写。这项设置不决定其他内容。 |
| **Story style** | **Standard**：失误和坏运气会带来切实的后果。**Gentle**：挑战仍然存在，但挫折不会升级为惩罚或创伤。 |
| **Violence** | **Mild**、**Serious** 或 **Graphic**：决定如何呈现暴力。SFW 的初始值为 **Serious**，NSFW 为 **Graphic**，与这两种分级原本的含义一致。 |
| **Content boundaries** | 绝不希望在故事中出现的主题，每行一项，例如 `harm to animals`。 |

#### 温和故事风格

如果想享受故事和角色，又不想让 GM 惩罚每一次小失误，就选 **Gentle**。在 **Gentle** 下：

- 挫折会让你花费时间、丢点面子、消耗资源或绕些弯路。GM 不会用受伤、羞辱、失去在乎的人，或你没有主动让故事走向的创伤来回应这些挫折。
- GM 只会在角色自身的技能或选择能影响结果时要求技能检定。它不会针对角色无法控制的事掷骰，例如残障、健康状况、身体或出身。见[温和游戏中的技能检定](dice-and-skill-checks.md#skill-checks-in-a-gentle-game)。
- 世界的规划带着温情：剧情线既源于创伤，也源于希望和关系；转折会带来惊喜，而不是背叛感。

**Gentle** 只替换内置 GM 指令。如果你自己写了 **GM Prompt**，GM 会保留你的文字。战斗、伤害和难度设置在两种风格下的运作方式相同。

#### 内容边界

每行写一个主题，最多 40 个主题，总计 2,000 个字符。超出任一上限的内容都会被忽略。GM 会把每一项都视为硬性限制，优先于分级、基调、任何角色的性格和剧情。它不会提起这些主题，也不会用它们作为威胁、转折或背景故事，甚至不会暗示。如果你主动提起，GM 也只会简短带过，然后转向其他内容。内容边界适用于两种故事风格和两种分级，自定义分级指南也不能取消这些限制。

> **注意：** 故事由 AI 模型编写，因此 Marinara 无法保证列出的主题绝不出现。如果出现了，可以切换备选回复或编辑回复。

#### 编辑分级指南

在分级按钮下方展开 **Edit rating guidelines**(编辑分级指南)，可以查看根据所选分级、暴力程度和故事风格发送给 GM 的文字。编辑它即可为这局游戏制定自己的内容规则，点击 **Reset to default**(重置为默认值) 则恢复内置文字。只要没有改动，它就会跟随所选的分级、暴力程度和风格变化。

#### 在游戏中修改这些设置

打开 **Chat Settings → Prompt Preset**(聊天设置 → 提示词预设)。在游戏中，这个区域还提供 **Story style**、**Violence**、**Content boundaries** 和 **Rating guidelines**(分级指南)。修改从下一回合开始生效。内容分级本身在游戏创建后就固定了。

提示词预设也可以携带故事风格、暴力程度和内容边界，方便在每局游戏中复用。见[游戏故事设置](../prompts/presets.md#game-story-settings)。

<a id="choose-rules"></a>

### 选择规则

**Rules** 只在新游戏中、且至少安装了一个规则集时出现。默认选项是 **Marinara's own rules**(Marinara 自身规则)：内置的 d20 检定和六属性人物卡。规则集（例如 **5e (SRD 5.1)**）会用桌面系统自身的检定和人物卡替换它们，也可能按自身规则进行战斗。向导会显示每个规则集涵盖的内容。游戏创建后，这个选择就固定了。见[使用规则集游玩](rulesets.md)。

<a id="the-gm-intro-message"></a>

### GM 开场消息

**Party** 步骤中的 **GM intro message** 决定游戏如何开场：

- **None**(无)（默认）：GM 按自己的判断开场。
- **Defined**(固定)：把第一条消息原样输入。游戏会以这段文字开场，重新生成也会得到相同的文字。
- **Guided**(引导)：描述开场应该怎样进行，比如从哪里开始、有谁在场。GM 会据此写出开场。

文字最多 8,000 个字符。其中不能包含双花括号，**Guided** 的文字也不能包含方括号。文字无法使用时，输入框会告诉你。世界的故事可以设定自己的开场。这时输入框会显示为锁定，你无法更改。

### Storyboard Optimized 呈现方式

在 **GM** 步骤中，**Game Presentation**(游戏呈现方式) 可以是 **Standard**(标准) 或 **Storyboard Optimized**(分镜优化)。**Storyboard Optimized** 使用 Storyboard Game Prompt，把 GM 的回合塑造成可拍摄的视觉段落。它不会下载或开启 Storyboard 智能体，不会打开图像或视频生成，也不会改动你的账号。游戏创建后，到 **Chat Settings → Agents → Storyboards**(聊天设置 → 智能体 → 分镜) 里设置这些。

**GM Prompt** 编辑器会预览所选呈现方式的提示词。不改动这段文字，内置预设就保持选中。一旦编辑，你的文字就会覆盖预设。

设置完成后，另一套单镜动画组合仍然可用：Animation Planner 选 **Anime Episode Director**，Storyboard Video Prompt 选 **Anime Game Video**。

## 玩第一个回合

输入你的角色做什么或说什么，然后发送。GM 会回复、更新世界，也可能要求掷骰或开始一场战斗。

附件按钮旁边的对话气泡按钮（提示文字是 **Choose who to address**(选择发言对象)）决定消息发给谁：

| 模式 | 作用 |
| --- | --- |
| 默认 | 消息作为一次行动或一句台词进入场景。GM 和队伍会在故事里回应。 |
| **Talk to Party**(对队伍说) | 加上 `[To the party]` 标记，对同伴说话。只有队伍非空时才显示。 |
| **Talk to GM**(对 GM 说) | 加上 `[To the GM]` 标记，以戏外身份向 GM 提问，例如“我的角色知道那座神庙吗？” |

当前生效的模式会在菜单里显示 **On**。再点一次同一个菜单项就能关掉它。

<a id="the-games-controls"></a>

## 游戏控件

在电脑上，控件从聊天右上角附近的按钮打开。在手机上，它们在可移动的 **Chat tools**(聊天工具) 三点菜单里。

| 控件 | 内容 |
| --- | --- |
| **Game controls**(游戏控制)（游戏手柄） | **Retry turn**、**Retry scene analysis**、Music DJ 负责播放音乐时的 **Retry Music DJ**，以及 **Retry assets image generation**。分镜作为背景时，还有重播、播放/暂停和静音。**Edit game data**(编辑游戏数据) 可以手动修正保存的数据（见[手动编辑游戏数据](sessions-and-saves.md#editing-game-data-by-hand)）。**Checkpoints**(检查点) 可以回到更早的某个时刻（见[游戏如何保存](sessions-and-saves.md#how-your-game-saves)）。|
| **Session**(会话)（羽毛） | 会话历史、日志和会话控制。见 [Game Mode：会话与存档](sessions-and-saves.md)。 |
| **Volume**(音量)（扬声器） | **Master**、**Music**、**Sound Effects**、**TTS** 和 **Ambient** 的音量。 |
| **Game Assets**(游戏素材)（文件夹） | 场景媒体和 Asset Browser。见[游戏素材](game-assets.md)。 |
| **Connected chat**(所连聊天) | 游戏关联到 Conversation 时显示。见[所连聊天](../chats/connected-chats.md#switching-between-connected-chats)。 |

选择一个工具，电脑上会在可移动窗口中打开它，手机上则打开全宽面板。在电脑上，拖动工具的按钮即可移动它。在手机上，可以移动三点菜单，或者解锁后重新排列里面的工具。见[控制窗口及其按钮](../chats/chat-settings.md#control-windows-and-their-buttons)。

也可以把某个控件留在 **Chat Settings** 里。打开控件的窗口，选择 **Put back in Chat Settings**(放回聊天设置)。它会作为可展开区域出现在那里，用它的弹出按钮可以再变回窗口。每局游戏都会保存你的选择。**Reset View**(重置视图) 会恢复初始布局。

**Character Profiles**(角色资料) 在电脑和手机上都留在 Chat tools 之外。把它的头像按钮拖到你想要的位置，然后打开它，选择一位队伍成员，查看或编辑其人物卡。在手机上，**Map**(地图) 也有自己的可移动按钮。两者都跟随你的聊天小组件样式，为这局游戏保存位置，并且可以在打开的窗口里锁定。

<a id="choosing-a-model"></a>

## 怎么选模型

世界生成是 Game Mode 里最难的一环。它要求模型输出一份又长又严格、一个字段都不能缺的 JSON 文档（JSON 是一种必须一字不差的文本格式，否则游戏读不了）。日常聊天表现不错的模型，在这一步照样可能失败。

- 世界生成建议用付费账号上当下能力最强的一线模型。截至 2026 年，玩家反馈几家主流服务商的旗舰档位效果都不错，比如 Anthropic Claude、OpenAI GPT 和 Google Gemini。型号名变动频繁，这里只是举例，不是固定名单。
- 我们推荐的最便宜的模型是 DeepSeek V4 Flash 和 Claude Haiku 5.5，截至 2026 年 10 月 31 日，两款都经过实际游玩测试。
- 后续回合有时可以用便宜一些的模型，因为回合要的是叙述，不是严格的 JSON。如果 GM 忘记 NPC 或者和前面的细节自相矛盾，就换回更强的模型。
- 世界生成不要用免费模型或自动路由模型。它们可能把请求路由到一个产不出合法 JSON 的小模型。小型开放权重模型通常也会失败。

完整的参数说明见[生成参数](../prompts/generation-parameters.md)。

## 一个回合的花费

Game Mode 会发起三种 AI 请求：

1. **世界生成。** 点击 **Start Game** 时只跑一次。这是一次大请求，返回世界总览、初始地图、NPC、队伍人物卡和小组件。
2. **游戏回合。** 每条消息都会带上当前状态重新组一份提示词。GM 负责叙述并更新世界。战斗回合的数值由引擎而不是模型计算，所以结果保持公平。
3. **会话摘要。** 结束一个会话时，GM 会写一份回顾和连贯性备注。开始下一个会话时，它会写一小段承接消息。更早的会话会被压缩成摘要，这样长战役也能装进模型。

<a id="optional-tool-planning-and-lore-searches"></a>

## 可选的工具规划与世界设定搜索

游戏中打开 **Chat Settings → Function Calling**(聊天设置 → 函数调用)。

- **Let the GM search lore**(允许 GM 搜索世界设定) 让 GM 按含义查找世界书里的信息。请先为这些世界书开启向量化，并将其条目向量化。搜索会遵循已启用的世界书、文件夹和当前聊天的条目开关。它们使用你的嵌入账号，也可能增加一次模型请求。即使开启了 **Enable Tool Use**(启用工具调用)，Game 聊天也需要这个开关才能查询世界书。它关闭时，工具选择器中的 `search_lorebook` 不可用。
- **Game tool provider**(游戏工具服务商) 默认为 **Same as narrator**(与旁白相同)，保留通常的工具循环（每回合最多四轮工具调用）。选择另一个账号后，会在叙述前单独执行一次规划请求。由该模型选择工具，旁白以文本形式收到工具的结果。这会让该账号每回合多一次请求。更便宜的模型可以降低费用，但可能选择不同的工具。一次规划无法连着发起第二次查询。
- **Finish rolled turns in one request**(用一次请求完成掷骰回合) 默认开启，可以在掷骰的回合省下一次请求。见 [Game Mode：骰子与技能检定](dice-and-skill-checks.md#finishing-a-rolled-turn-in-one-request)。

Claude 和 Grok 订阅账号不支持原生工具调用。相关控件会说明这一点，并保持禁用，除非选中了受支持的 **Game tool provider**。文本命令和骰子标签仍可使用。如果独立账号不存在或其请求失败，该回合会报告失败，而不是跳过工具工作继续叙述。

如果本地模型共享的 GPU 显存有限，打开 **Chat Settings → Agents** 并开启 **Run Game tasks one at a time**(逐个执行 Game 任务)。这样在该 Game 聊天内，旁白、智能体和场景媒体会互相等待。此选项默认关闭，也不会针对其他聊天或应用预留 GPU。

## 开启智能体

智能体是可选的 AI 帮手，和 GM 并行运行。它们会额外发起请求，所以会增加费用。要使用它们，游戏中打开 **Chat Settings → Agents** 并开启 **Enable Agents**。Game Mode 里有两个比较有用：

- **Game Session Keeper** 帮忙维持各个会话之间的连贯性。
- **Music DJ** 负责挑选背景音乐。

**Review Agent Outputs**(审核智能体输出) 让你检查智能体产出了什么。见[智能体：聊天里的 AI 帮手](../agents/agents-overview.md)。

## 故障排查

<a id="world-generation-fails-with-a-json-or-422-error"></a>

### 世界生成报 JSON 错误或 422 错误

最可能的原因是模型没能产出完整的 JSON。按顺序试试下面几步。

1. 看看 GM 用的是哪个模型。如果是免费模型或自动路由模型，换成能力过关的付费模型。
2. 再试一次。有些失败只是偶发。
3. 把过长的背景设定或偏好内容缩短。输入太长，留给 JSON 的余地就少了。

如果某次调用差一点就成功了，Marinara 会提供一个 **Repair JSON**(修复 JSON) 窗口，里面是带行号的编辑器和模型的原始输出。状态行会告诉你 JSON 是否合法，或者显示解析错误。点击 **Format**(格式化) 可以把合法的 JSON 整理整齐，然后点击 **Apply Repaired JSON**(应用修复后的 JSON)，直接用你改好的版本，不必为重试付费。会话摘要和其他结构化调用也会出现 **Repair JSON**。更多解决办法见 [Marinara Engine 故障排查](../TROUBLESHOOTING.md)。

### 明明选了黑暗基调，GM 却讲得很欢快

检查游戏的 **Story style** 是否设为 **Standard**：**Gentle** 会刻意减轻挫折的冲击（见[温和故事风格](#the-gentle-story-style)）。有些模型总是保持乐观。在向导的偏好栏里写一条明确的指令，比如“叙述保持阴郁，失败不要美化”。或者换一个默认口吻贴合这个基调的模型。

### 模型拒绝生成回合

模型拒绝编写这一回合时，会弹出 **The model declined this request** 提示。有些模型会因游戏分级指南、预设或角色卡中的某些措辞而拒绝生成。按顺序试试：

1. 重试这一回合。有些拒绝只是偶发。
2. 如果编辑过分级指南，打开 **Chat Settings → Prompt Preset**，将 **Rating guidelines** 重置为内置文字。
3. 为这局游戏换一个模型。

## 各个专题在哪

- [Game Mode：战斗](combat.md)：遭遇战、行动菜单、伤害计算和快速反应事件。
- [Game Mode：MRPG 职业](mrpg-classes.md)：选择职业、属性、等级与晋升、职业人物卡、共享游戏，以及把 Legacy 游戏迁移过去的方法。
- [Game Mode：队伍与 NPC](party-and-npcs.md)：Character Profiles、人物卡和冒险日志。
- [Game Mode：会话与存档](sessions-and-saves.md)：结束和开始会话、会话历史和检查点。
- [Game Mode：地图、时间与天气](map-time-weather.md)：地图视图、时钟、天气和士气。
- [Game Mode：骰子与技能检定](dice-and-skill-checks.md)：骰子菜单和技能检定规则。
- [Game Mode：HUD 小组件](hud-widgets.md)：屏幕上的状态小组件。
- [游戏素材](game-assets.md)：音乐、音效、立绘和背景素材库。
- [Storyboard 智能体指南](storyboard.md)：Game Mode 和 Roleplay 的分镜。
- [Roleplay 模式：入门](../roleplay/getting-started.md)：作者注释在这里的用法也一样。
