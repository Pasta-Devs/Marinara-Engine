# Game Mode：入门

Game Mode(游戏模式) 把 Marinara Engine 变成一款由 AI 主持的单人角色扮演游戏。本指南先介绍 Game Mode 是什么、开始前要准备什么，然后带着走完设置向导，并指出每项玩法功能各自在哪。通读一遍，先开一局，想深入某个专题时再看文末的链接。

## Game Mode 是什么

Game Mode 是 Marinara 的聊天模式之一，另外两种是 Conversation(对话模式) 和 Roleplay(角色扮演)。

在 Game Mode 里，由 AI 扮演游戏主持人（GM），为你主持一个故事。游戏主持人就是负责讲述世界、扮演遇到的每一个角色、决定接下来发生什么的那个 AI，作用和桌面跑团里的 DM 一样。

引擎会跨回合替你追踪游戏状态，包括地图、队伍、非玩家角色（NPC，即玩家之外的角色）、物品、任务、世界内的时间和天气。一局游戏会持续很多回合。一场长游戏可以拆成若干个**会话**，就像跑团团队把一条战役分到好几个晚上来跑。战役指的是整条持续推进的故事线。

所有机制都不是必须用的。有的玩家完全跳过战斗和骰子，只把 Game Mode 当成偏剧情、偏画面的玩法。RPG 系统随时待命，想用再用。

## 开始之前

开一局游戏只需要一样东西：给 GM 用的 AI 服务商连接。连接负责把 Marinara 接到 AI 服务商，这样才能生成文字。还没配过的话，见[连接 AI 服务商](../connections/connecting-to-a-provider.md)。

其余全是可选项，默认关闭，随时可以后补：

- **图像生成。** Game Mode 有一套带背景和角色画面的视觉布局。要把画面填满，就需要一个图像生成连接。向导里的 **Visual Generation**(视觉生成) 默认关闭，得自己打开。不开也能正常玩，故事、状态追踪和战斗都在，只是视觉区域是空的。
- **跑场景效果的本地模型。** Marinara 可以在自己的机器上跑一个小模型，界面上叫 **Local Model (Gemma)**。它负责背景和音乐建议，不产生额外费用，也是向导里的默认选项。见[本地模型设置](../connections/local-model.md)。
- **Storyboard 智能体。** 从 **Agents > Download Agents** 安装，想要静态或动态分镜时，再到 **Chat Settings > Agents** 里为建好的游戏启用它。
- **视频生成连接。** 只有要做场景视频或动态分镜时才需要。
- **音乐。** **Music DJ** 智能体可以播放游戏音乐，需要 Spotify 或者一个本地音乐文件夹，默认关闭。

## 设置向导

新建 Game Mode 聊天时会打开一个**设置向导**，一共七步。唯一必填的是第一步的 GM 连接，其他每一项都有合理的默认值。可以快速点过去，剩下的交给 Marinara 填。

七步分别是：

1. **Connection。** 设置游戏名称，选择 GM 连接，可以再选一个跑场景效果的连接。场景效果默认用 **Local Model (Gemma)**。
2. **World。** 设置题材、背景设定、基调、难度、内容分级和语言。
3. **Party。** 选择你的用户角色（也就是你扮演的角色）、**Game Master Mode**(游戏主持人模式)，以及队伍成员。
4. **Goals。** 告诉 GM 你想从这场冒险里得到什么。
5. **Lorebooks。** 挂上世界书，里面的设定 GM 会当作正典。世界书就是一组世界背景设定条目。见[世界书](../lorebooks/overview.md)。
6. **Features。** 开启可选系统，比如 Visual Generation、Music DJ 和 HUD 小组件。可安装的智能体要等游戏建好之后，从 Chat Settings 里启用。
7. **GM。** 在生成世界之前，选择呈现方式并检查 GM 的高级指令。

填完之后点击 **Start Game**(开始游戏)。

### 值得先了解的默认值

下面是 **World**、**Party**、**Features** 三步里的初始值，全部都能改。

| 设置项 | 默认值 | 说明 |
|---|---|---|
| Genre | Fantasy | 可多选，也能自己加条目 |
| Tone | Heroic | 可多选 |
| Difficulty | Normal | Casual、Normal、Hard 或 Brutal；越高战斗越难熬 |
| Content Rating | SFW | SFW 或 NSFW；NSFW 只是允许成人内容，不会强制出现 |
| Language | English | 游戏内所有文字都用这个语言书写 |
| Game Master Mode | Standalone GM | Standalone GM 会替你造一个 GM；Character GM 用你的某张角色卡当 GM |
| Visual Generation | Off | 想要图像就打开；需要图像生成连接 |
| Game Presentation | Standard | **Storyboard Optimized** 用 Storyboard Game Prompt 来塑造 GM 的叙述；它不会安装也不会启用 Storyboard 智能体 |
| Music DJ | Off | 需要 Spotify 或本地音乐文件夹 |
| Custom HUD Widgets | On | 使用新世界里由 AI 生成的状态小组件 |
| Start Muted | Off | 开局时静音 |

第一次玩 Game Mode 的话，**Game Master Mode** 就留在 **Standalone GM**。Marinara 会造一个公正、偶尔毒舌的 GM，先摸清这个模式的路数，再考虑自己写 GM 角色卡。

想让 GM 的回合写成可拍摄的视觉段落时，在最后一步选 **Storyboard Optimized**(分镜优化)。它会为 GM 的叙述选中内置的 **Storyboard Game Prompt**。它不会安装或启用 Storyboard 智能体，不会打开图像生成或视频生成，不会改动已选的连接，也不会替换这个智能体自带的规划器和格式化器默认值。游戏建好之后，另行安装并启用 Storyboard，再到 **Chat Settings > Agents > Storyboards** 里配置它的关键帧、规划器、图像和视频设置。

设置完成后，另一套动画单镜组合依然可用：Animation Planner 选 **Anime Episode Director**，Storyboard Video Prompt 选 **Anime Game Video**。

**GM Prompt**(GM 提示词) 编辑器会按当前选中的呈现方式预览实际生效的提示词。选中 **Storyboard Optimized** 时打开编辑器，看到的就是 Storyboard Game Prompt，其中包含关键帧数量的宏。不动这段文字，内置预设就保持选中；一旦编辑，就会生成一个自定义提示词，覆盖掉呈现方式自带的预设。

## 三种 AI 调用

Game Mode 会发起三种不同的 AI 调用。搞清楚它们，就知道费用和报错分别出在哪。

1. **世界生成。** 点击 **Start Game** 时只跑一次。GM 连接会返回一份很大的结构化文档，格式叫 JSON。这份文档里有世界总览、初始地图、NPC、队伍的人物卡，以及屏幕上的小组件。JSON 是一种严格的文本格式，AI 必须一字不差地返回，否则游戏读不了。这是要求最高的一步，所以模型选得好不好，在这里影响最大。
2. **游戏回合。** 每发一条消息，都会带上当前状态重新组一份提示词，然后由 GM 叙述并更新世界。战斗回合的数值由引擎计算，不交给模型，结果才公平、稳定。
3. **会话摘要。** 结束一个会话时，GM 会写一份结构化的回顾和连贯性备注。开始新会话时，它会写一小段承接消息，让下一章顺畅接上。更早的会话会被压缩成摘要，这样长战役也不会把模型撑爆。

## 发言对象：你在跟谁说话

输入栏里，附件按钮旁边有一个小小的对话气泡按钮，提示文字是 **Choose who to address**(选择发言对象)。这个按钮决定消息发给谁，有三种状态。

- 默认情况下，消息进入场景，算作一次普通的游戏内行动或台词，GM 和队伍会在故事里作出回应。
- **Talk to Party**(对队伍说) 会加上 `[To the party]` 标记，直接对同伴说话。适合“我们该怎么办”这类战术讨论。只有队伍非空时才会出现这个选项。
- **Talk to GM**(对 GM 说) 会加上 `[To the GM]` 标记，以角色之外的身份向 GM 提问。适合“我的角色知道那座神庙吗”这类问题，或者调整节奏的请求。

当前生效的模式会在菜单里显示 **On** 标记。想关掉 **Talk to Party** 或 **Talk to GM**，再点一次同一个菜单项即可，消息就会回到场景里。

## 可选的工具规划与世界设定搜索

游戏中打开 **Chat Settings → Function Calling**(聊天设置→函数调用)。**Let the GM search lore**(允许 GM 搜索世界设定) 让 GM 按含义查找信息，无须同时启用所有其他可选工具。请先为相关世界书开启向量化，并将条目向量化。搜索会遵循已启用的世界书、文件夹以及当前聊天的条目开关，使用配置好的嵌入连接，也可能增加一次后续模型请求。

**Game tool connection**(游戏工具连接) 默认为 **Same as narrator**(与旁白相同)，保留通常的工具调用循环。选择其他连接后，会在叙述前单独执行一次规划请求。由该模型选择工具，旁白则以文本形式收到工具的真实结果。额外请求由所选连接计费；更便宜的模型可能降低工具成本，但也可能选择不同的工具。这一次规划无法根据第一次搜索的结果继续发起第二次查询。如果希望旁白经过多轮工具调用来推理，请使用 **Same as narrator**。

Claude 和 Grok 订阅连接不支持原生工具调用。相关控件会说明原因，并在选中受支持的 Game 工具连接前保持禁用。文本命令和骰子标签仍可使用。如果独立连接不存在或请求失败，该回合会报告失败，不会悄悄略过请求的工具工作后继续叙述。

## 开启智能体

智能体是可选的 AI 帮手，和 GM 并行运行。要在游戏里用它们，玩的过程中打开 **Chat Settings**(聊天设置)，进入 **Agents**(智能体) 部分，打开 **Enable Agents**(启用智能体)。智能体会额外发起调用，因此会增加费用。

Game Mode 里有两个智能体值得了解：

- **Game Session Keeper** 帮忙维持各个会话之间的连贯性。
- **Music DJ** 负责挑选背景音乐，需要 Spotify 或本地音乐文件夹。

Game Mode 还会用到 **Review Agent Outputs**(查看智能体输出)，方便检查智能体产出了什么。想全面了解智能体，见[智能体：聊天里的 AI 帮手](../agents/agents-overview.md)。

## 怎么选模型

世界生成是 Game Mode 里最难的一环，要求模型一口气输出一份又长又严格、一个字段都不能缺的 JSON。日常聊天表现不错的模型，在这一步照样可能翻车。

世界生成建议用付费连接上当下能力最强的一线模型。截至 2026 年，玩家反馈几家主流服务商的旗舰档位效果都不错，比如 Anthropic Claude、OpenAI GPT 和 Google Gemini。具体型号名变动频繁，这里只是举例，不是固定名单。

后续的游戏回合有时可以降级到便宜一些的模型，因为回合要的是叙述，不是严格的 JSON。一旦 GM 开始忘记 NPC 或者和前面的细节自相矛盾，就换回更强的模型。

世界生成不要用免费模型或自动路由模型，它们可能把请求路由到一个小模型，产不出合法的世界生成 JSON。小参数量的开放权重模型通常也过不了这一关。

完整的参数说明见[生成参数](../prompts/generation-parameters.md)。

## 各个玩法专题在哪

本指南负责把你送进游戏，更深入的专题各有独立的指南：

- [Game Mode：战斗](combat.md)介绍遭遇战、行动菜单、伤害计算和快速反应事件。
- [Game Mode：队伍与 NPC](party-and-npcs.md) 介绍队伍栏、人物卡和冒险日志。
- [Game Mode：会话与存档](sessions-and-saves.md)介绍如何结束和开始会话，以及会话历史。
- [Game Mode：地图、时间与天气](map-time-weather.md)介绍地图视图，以及自动推进的时钟和天气。
- [Game Mode：骰子与技能检定](dice-and-skill-checks.md)介绍骰子菜单和技能检定规则。
- [Game Mode：HUD 小组件](hud-widgets.md)介绍屏幕上的状态小组件。
- [游戏素材](game-assets.md)介绍音乐、音效、立绘和背景素材库。
- [Storyboard 智能体指南](storyboard.md)介绍安装步骤，以及 Roleplay 和 Game Mode 两边的分镜。

作者注释在这里的用法和其他模式一样，见 [Roleplay 模式：入门](../roleplay/getting-started.md)。

## 故障排查

### 世界生成报 JSON 错误或 422 错误

最常见的原因就是模型没能产出完整的结构化 JSON。按顺序试试下面几步。

1. 看看 GM 用的是哪个连接。如果指向免费模型或自动路由模型，换成能力过关的付费模型。
2. 再试一次。有些失败是偶发的，同样的配置第二次就成了。
3. 把过长的背景设定或偏好内容缩短。输入太长，留给模型输出 JSON 的余地就少了。

如果这次调用其实差一点就成了，只是 JSON 有小毛病，Marinara 会提供一个 **Repair JSON**(修复 JSON) 窗口。它会打开一个带行号的编辑器，里面是模型的原始输出。状态行会告诉你 JSON 是否合法，或者显示解析错误。点击 **Format**(格式化) 可以把合法的 JSON 整理整齐，然后点击 **Apply Repaired JSON**(应用修复后的 JSON)，直接用改好的版本，不必再花一次完整重试的钱。会话摘要和其他结构化调用出问题时，同样会出现 **Repair JSON** 选项。

更多症状和解决办法见 [Marinara Engine 故障排查](../TROUBLESHOOTING.md)。

### 明明选了黑暗基调，GM 却讲得很欢快

有些模型不管什么基调都保持乐观。有两个办法：在向导的偏好栏里写一条明确的指令，比如“叙述保持阴郁，失败不要美化”；或者换一个默认口吻更贴合目标基调的模型。

## 相关指南

- [Game Mode：战斗](combat.md)
- [Game Mode：队伍与 NPC](party-and-npcs.md)
- [Game Mode：会话与存档](sessions-and-saves.md)
- [Game Mode：地图、时间与天气](map-time-weather.md)
- [Game Mode：骰子与技能检定](dice-and-skill-checks.md)
- [Game Mode：HUD 小组件](hud-widgets.md)
- [游戏素材](game-assets.md)
- [Storyboard 智能体指南](storyboard.md)
- [Roleplay 模式：入门](../roleplay/getting-started.md)
- [连接 AI 服务商](../connections/connecting-to-a-provider.md)
- [智能体：聊天里的 AI 帮手](../agents/agents-overview.md)
- [生成参数](../prompts/generation-parameters.md)
- [Marinara Engine 故障排查](../TROUBLESHOOTING.md)
