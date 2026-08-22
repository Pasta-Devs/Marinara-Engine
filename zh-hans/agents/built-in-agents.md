# 可下载智能体参考

本指南按分类列出通过 **Agents → Download Agents**(智能体 → 下载智能体) 可以获取的全部 36 个官方第一方包。全新安装的 Marinara Engine 并不自带智能体。这些包的源码、清单、构建产物和机器可读目录都发布在 [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents)。下面每个条目都会说明这个智能体做什么、什么时候运行或以什么方式集成、哪些聊天模式可以用它，以及主要设置。安装和启用的步骤请先看[智能体](agents-overview.md)。

## 如何阅读本参考

智能体是一个小型 AI 帮手，会在主聊天回复生成的同时自动运行。先从目录里安装，再逐个聊天开启并设置，而不是按角色卡设置。下载、更新、卸载、按聊天设置以及费用提醒，见[智能体](agents-overview.md)。

下面每个智能体都会列出三条速查信息。

- **阶段或集成方式**：普通流水线智能体在什么时候运行。**Pre-Generation**(生成前) 在回复之前运行，可以往提示词里加文字。**Parallel**(并行) 与回复同时运行，看不到最终成文。**Post-Processing**(生成后) 在回复完成之后运行，能读到回复内容，有些还能改写。Maps、Calls 和 Conversation 小游戏这类功能包则是直接集成进各自的聊天界面。
- **适用范围**：哪些聊天模式允许添加这个智能体。多数智能体用在 **Roleplay**(角色扮演) 聊天里。少数适用于其他模式，每个条目都会写明。
- **主要设置**：最可能需要改动的设置。添加智能体时可以设置，之后也可以在 **Chat Settings**(聊天设置) 里这个智能体的设置卡片中调整。

Marinara 在 **Agents** 面板里把智能体分成三类：**Writer Agents**(写作类)、**Tracker Agents**(追踪类) 和 **Misc Agents**(杂项类)。本参考沿用同样的分类。

运行间隔的意思是，智能体每隔几条用户消息和 AI 回复才运行一次，而不是每条消息之后都运行。运行间隔可以在智能体的设置里改，最大 100。

## 写作类智能体

写作类智能体负责塑造故事和文笔。它们要么在回复之前补充写作指引，要么在回复之后做润色。

### Prose Guardian

改写最新一条回复，去掉禁用词和重复表达，同时不改变原意。模型老是重复句式或者滥用某个词时就用它。

- **阶段**：Post-Processing。
- **适用范围**：Roleplay。
- **主要设置**：**Banned Words**(禁用词，默认为 `ozone`)、**Prefer In Writing**(偏好用词) 和 **Remove From Writing**(剔除用词) 三个输入框。**Hold Message Until Rewrite**(改写完成前不显示消息) 开关默认开启，会把回复藏到润色结束再显示。关闭之后，原始回复先出现，随后再替换成润色版本。

### Continuity Checker

修正最新回复里的具体逻辑错误，比如一个角色同时出现在两个地方，或者时间线对不上。发现问题时会列成一份清单，可以自己挑要应用哪些修改。

- **阶段**：Post-Processing。
- **适用范围**：Roleplay。
- **主要设置**：**Hold Message Until Rewrite** 开关。

### Card Evolution Auditor

观察角色在游玩过程中的变化，并对这张角色卡提出修改建议。它绝不会自动改动。每条建议都会弹出 **Review Character Card Updates**(审阅角色卡更新) 窗口，由你决定接受还是拒绝。

- **阶段**：Post-Processing。
- **适用范围**：Roleplay。
- **主要设置**：默认每 8 条用户消息和 AI 回复运行一次。另见[智能体审批与 Agent Suite](approvals-and-agent-suite.md)。

### Narrative Director

只在你主动要求时，为故事推上一把，效果仅此一次。在 Roleplay 聊天里启用这个智能体后，消息框上方会出现 **Push Story**(推动剧情) 按钮。点一下，下一条回复就会推进剧情或者抛出一个意外。

- **阶段**：Pre-Generation。
- **适用范围**：仅 Roleplay。
- **主要设置**：**Story Push Mode**(剧情推动方式)（**Natural** 沿着当前线索往下走，**Random Event** 加入一个合理的意外）。它还可以维护一条可选的隐藏长线，叫 **Secret Plot**(秘密剧情)。完整说明见 [Narrative Director 与 Secret Plot](../roleplay/narrative-director.md)。

### Knowledge Retrieval

在回复之前扫描指定的世界书，以及上传的文件。它把其中重要的内容整理成摘要，再加进提示词。世界书就是一组关于世界观和角色的背景设定条目。这是一种轻量搜索，不需要额外的数据库。

- **阶段**：Pre-Generation。
- **适用范围**：Roleplay。
- **主要设置**：**Use chat-active lorebooks**(使用聊天中已启用的世界书) 开关、**Fixed Source Lorebooks**(固定来源世界书) 选择器，以及支持格式的文件上传。这个智能体和 Knowledge Router 功能重叠，不要同时开启。设置方法见[知识源](knowledge-sources.md)。

### Knowledge Router

Knowledge Retrieval 的省钱替代方案。它不做摘要，而是读取世界书条目的简短描述，然后把匹配上的条目原文照搬加进去。条目描述写得好，它的效果最好。

- **阶段**：Pre-Generation。
- **适用范围**：Roleplay。
- **主要设置**：**Use chat-active lorebooks** 开关和 **Fixed Source Lorebooks** 选择器。界面上有一个标记，显示来源条目里有多大比例写了描述。设置方法见[知识源](knowledge-sources.md)。

## 追踪类智能体

追踪类智能体会持续记录场景、角色和各项数值。它们的最新输出可以作为一个段落加进提示词，让模型保持前后一致。World State、Quest Tracker、Character Tracker、Persona Stats、Custom Tracker、Inventory Tracker 和 Beholder 默认开启 **Add as Prompt Section**(作为提示词段落加入)。Expression Engine 和 Background 是例外。

### World State

追踪日期、时间、天气、地点以及在场角色。这样场景有了依托，模型不会忘记故事发生在何时何地。

- **阶段**：Post-Processing。
- **适用范围**：Roleplay。
- **主要设置**：**Add as Prompt Section**(默认开启)。

### Expression Engine

读取最新回复里的情绪，为角色挑一张匹配的立绘或表情。立绘就是显示在场景里的角色图像。想让角色立绘随着氛围变化时就用它。

- **阶段**：Post-Processing。
- **适用范围**：Roleplay。
- **主要设置**：**Sprite Source**(立绘来源)（**Expressions**、**Full-body** 或两者都用）、**Expression Avatars**(表情头像) 开关、**Sprite Owners**(立绘归属) 选择器，以及尺寸和不透明度滑块。另见[角色立绘](../characters/sprites.md)。

### Quest Tracker

管理任务目标、完成情况和奖励。想在冒险类玩法里看到一份可见的任务列表时就用它。

- **阶段**：Post-Processing。
- **适用范围**：Roleplay。
- **主要设置**：**Add as Prompt Section**(默认开启)。

### Background

从已上传的背景里，为当前场景挑一张最匹配的背景图。它不生成图像，需要自动生成场景背景的话请用 Illustrator。

- **阶段**：Post-Processing。
- **适用范围**：Roleplay。
- **主要设置**：标准的智能体连接和上下文设置项。背景挑选只会用到背景库里已有的图像。

### Character Tracker

追踪在场角色，以及他们的情绪、动作、外貌、服装、心理活动和 HP 之类的个人数值。它还能为没有图像的新角色生成肖像图。

常驻角色离场后再次登场时，Character Tracker 会沿用他们上次保存的数值和自定义字段，保证前后连贯。有角色卡的角色还会把卡上配置的 RPG 资源池和属性作为依据，并且始终保留角色卡的头像和裁剪设置。自动生成肖像仅限于没有对应角色卡的 NPC。

- **阶段**：Post-Processing。
- **适用范围**：Roleplay。
- **主要设置**：**Add as Prompt Section**(默认开启)，以及可选的 **Auto-Generate NPC Avatars**(自动生成 NPC 头像) 设置，它有自己的图像连接选择器。

### Beholder

按身体部位追踪每个角色当前的服装，以及手持物品、伤口、缺失的身体部位、明确裸露的部位和非人类物种。最近一次通过验证的快照会显示在 Beholder 的 Roleplay Chat Settings 抽屉中，并同时传给 Beholder 的下一次追踪调用和下一条 Roleplay 主回复。

- **阶段**：Post-Processing。
- **适用范围**：仅 Roleplay。
- **主要设置**：在 **Chat Settings → Agents → Tracker Agents** 中添加或移除；在同一位置打开 **Configure Beholder**，选择连接、模型、提示词、上下文和输出限制。**Add as Prompt Section** 默认开启。
- **模型建议**：使用 OpenAI GPT-5.5+、Claude Opus 4.8+ 或 Kimi K3+ 等 SOTA 模型，以可靠追踪完整状态。
- **来源**：根据采用 AGPL-3.0-only 许可证的 [GetBeholder/Beholder-ME](https://github.com/GetBeholder/Beholder-ME) 改编到 Engine 的原生 Agent 运行时。官方包不会加载旧扩展的 DOM、轮询或本地存储运行时。

### Persona Stats

追踪自己角色的状态条，比如饱食度、精力和清洁度，也包括自己添加的自定义状态条。适合生存或者生活模拟类玩法。

- **阶段**：Post-Processing。
- **适用范围**：Roleplay。
- **主要设置**：**Add as Prompt Section**(默认开启)。另见[角色颜色与 RPG 属性](../characters/colors-and-stats.md)。

### Custom Tracker

追踪自己定义的字段，比如货币、计数器或者标记位。内置追踪器管不到故事需要的东西时就用它。

- **阶段**：Post-Processing。
- **适用范围**：Roleplay。
- **主要设置**：**Add as Prompt Section**(默认开启)。

### Inventory Tracker

用三份结构化列表分别追踪金钱、已装备物品和随身物品，不复用 Persona Stats 的库存，也不把数据挤进 Custom Tracker 的字符串里。重名条目会合并，数量为一时保持简洁显示，锁定的行在后续追踪中也不会改变。

- **阶段**：Post-Processing(后处理)。
- **适用模式**：Roleplay。
- **主要设置**：**Add as Prompt Section** 默认开启。你可以在 HUD 和 Tracker Panel 里编辑并锁定每个名称和数量。

### Memory Nag

为每个 Roleplay 聊天维护一个简短且可编辑的记忆库。它按带检查点的批次扫描聊天记录，依照当前和过去参与的角色整理记忆，并将明确已经解决的记忆移入可以恢复的 Resolved 列表。如果原话很重要，一条记忆可以逐字保留简短的对话。

每次回复后，确定性的词语匹配只会向追踪器提供与相关角色最匹配的活跃记忆。追踪器随后判断当前情况是否确实需要提醒，并且只能从这些记忆中选择；它不能在回忆时创造新记忆。

- **阶段**：Post-Processing。
- **适用范围**：仅 Roleplay。
- **主要设置**：单独的 **Vault scan connection**（默认使用 Agent 连接）、**Messages per batch**（20）、**Maximum memories created per character**（10）、**Maximum memories considered per character**（5）和 **Maximum memories injected**（3）。使用 **Scan chat** 完成首次回填，使用 **Open vault** 搜索、筛选、添加、编辑、解决、恢复或删除记忆。
- **提示词位置**：没有 preset marker 时，选中的记忆会以 `<context><memory_nags>…</memory_nags></context>` 的形式进入下一次回复。添加 Memory Nag Agent section 可以明确指定其位置。
- **数据生命周期**：记忆库只属于一个聊天；停用或卸载该包后数据仍会保存，因此重新安装后可以从上一个检查点继续。删除记忆是永久操作，并且始终需要确认。

### World Maps

为故事加入可长期保存的嵌套地点和空间关系。可以编写大区、区域、房间和通路，在地点之间移动，并让当前位置为生成提供空间上下文。Game Mode(游戏模式) 也会获得这个包的世界地图视图。

- **集成方式**：功能包。它提供地图界面和聊天运行时上下文，而不是作为普通的生成阶段智能体运行。
- **适用范围**：Roleplay 和 Game。
- **主要设置**：在 **Chat Settings → Agents** 里为 Roleplay 聊天启用，或者在创建 Game 时勾选，之后在那个游戏的设置里管理。安装或移除之后需要重启 Marinara。
- **完整指南**：[World Maps：搭建地图、编写内容与移动](hierarchical-maps.md)。

## 杂项类智能体

杂项类智能体提供图像、音乐、观众反应、角色卡更新之类的附加功能。

### Echo Chamber

模拟一群实时观众对场景做出反应，以浮动的 **Echo** 小组件显示在聊天区域。每 30 秒放出一条新反应。

- **阶段**：Parallel。
- **适用范围**：Roleplay。
- **主要设置**：从预置选项里挑一种风格，比如 **AO3 / Wattpad**、**Twitter / Reddit**、**4chan**、**Constructive**、**Hype Squad** 和 **Harbingers**。小组件里的操作包括 **Re-run Echo Chamber**(重新运行 Echo Chamber) 和 **Clear messages**(清空消息)。

### Noodle

添加一个可选的本地社交世界，其中包括 Noodle 公共时间线和面向创作者与粉丝角色扮演的 NoodleR 动态流。它在专门的 Home 标签页中打开，不走常规聊天智能体管线。

- **集成方式**：功能包；提供 Home 标签页、本地路由、生成与媒体流程以及后台调度器。
- **适用位置**：Home，可选择带入 Conversation、Roleplay 和 Game 聊天中的上下文。
- **主要设置**：从 **Agents → Download Agents** 安装，并在提示时重启 Marinara Engine。在 Noodle 内可以配置受邀账号、文本和图像连接、时间线刷新、NoodleR Creator 资料、模拟帖文访问权限和受众活动。
- **数据生命周期**：卸载会移除 Home 标签页，并在重启后停止软件包的路由和调度器，但会保留现有 Noodle 与 NoodleR 数据，以便日后重新安装。
- **完整指南**：[Noodle：应用内社交时间线](../noodle/overview.md)。

### Long-Term Memory

从聊天摘要、角色记录和世界书里提取长期记忆，存进这个包自己的记忆库，然后在主回复之前召回相关上下文。它支持按范围浏览记忆库、导入来源、审阅待处理草稿，以及用预设标记指定召回上下文的插入位置。

- **集成方式**：功能包。它提供生成前上下文和记忆管理界面，而不是作为普通的生成后追踪器运行。
- **适用范围**：Conversation(对话模式)、Roleplay 和 Game。
- **主要设置**：启用开关、召回 Token 预算（128 到 16,384）、最大召回片段数（1 到 100）、分数阈值、近期消息上下文（1 到 20）、召回风格以及语义、词法、图谱和关键词权重、是否纳入已解决的记忆、召回前言、提取推理与详细程度、生成上限、来源上限、提示词模板、AI 关键词提取，以及 Game Mode 提取。
- **数据管理**：用 Memory Settings 里的备份功能导出或替换记忆库、草稿和设置。删除全部数据会永久清除记忆、草稿、活动记录和派生索引，但保留设置。卸载这个包时，Long-Term Memory 的记忆库会保留下来，方便以后重装。安装、更新或移除之后需要重启 Marinara。
- **兼容性**：Engine `2.3.5` 起，`4.0.0` 之前。这个包使用 `agent-runtime`、`chat-read`、`chat-write`、`routes`、`storage` 和 `ui` 权限。

### Illustrator

负责图像生成和视频生成。它为重要时刻撰写画面提示词，再发送给配置好的媒体服务商。

- **阶段**：Post-Processing。
- **适用范围**：Roleplay。
- **主要设置**：默认每 5 条用户消息和 AI 回复运行一次。设置包括 **Prompt Model**(提示词模型)、**Image Style**(图像风格)、**Attach Card Appearance**(附带角色卡外貌) 和 **Send Avatar References**(发送头像参考)。完整设置步骤见 [Illustrator 智能体](../media/illustrator-agent.md)。

### Lorebook Keeper

把聊天里的重要信息写成世界书条目，也会更新已有条目，世界观笔记就随着游玩不断充实。

- **阶段**：Post-Processing。
- **适用范围**：Roleplay。在 Game Mode 里，名为 **Game Session Keeper** 的会话结束版本会在一次会话结束时做同样的事。
- **主要设置**：默认每 8 条用户消息和 AI 回复运行一次。**Target Lorebook**(目标世界书) 选择器决定条目写到哪里，也可以让它自动选。高级提示词配置可以返回可写世界书的准确名称，或 `world`、`npc`、`scene`、`player` 等已配置别名；如果别名对应的目标不存在，系统会自动创建并关联到当前聊天。省略目标时仍保持原有的单世界书行为。

### Combat

管理战斗，包括先攻、HP 和回合顺序。启用之后，消息框上方会出现 **Encounter**(遭遇战) 按钮。

- **阶段**：Parallel。
- **适用范围**：Roleplay。
- **主要设置**：自带一个掷骰工具，用来判定回合结果。

### Immersive HTML

在最新回复里加入世界观内的视觉元素，比如一张带样式的字条或者一块屏幕，同时不改动剧情。

- **阶段**：Post-Processing。
- **适用范围**：仅 Roleplay。
- **主要设置**：**Hold Message Until Rewrite** 开关。

### Music DJ

读取场景的氛围，播放匹配的音乐。可以用 Spotify、YouTube 或者本地音频文件。

- **阶段**：Post-Processing。
- **适用范围**：Roleplay 和 Game。
- **主要设置**：**Music Player**(音乐播放器) 设置用来选择服务商，每个服务商都要单独配置。Spotify、YouTube 和本地音乐的完整步骤见 [Music DJ](../media/music.md)。

### Haptic Feedback

读取叙事内容，通过 Intiface Central 实时控制已连接的情趣玩具。启用这个智能体之前，Intiface Central 必须已经在运行，并且已经连上玩具。

- **阶段**：Post-Processing。
- **适用范围**：Conversation、Roleplay 和 Game。
- **主要设置**：**Touch Sensitivity**(触感强度)选项（**Subtle**、**Standard** 或 **Intense**），以及 **Intiface URL** 输入框。强度设置会引导智能体选择，但不会限制可用的 `0.0-1.0` 强度范围。完整设置步骤见 [Haptic Feedback 触感反馈设置](../integrations/haptic-feedback.md)。

### CYOA Choices

在每条回复之后加入可点击的“What will you do?”选项按钮，营造 CYOA(自选冒险) 的感觉。每个按钮都对应一条完整的行动，点一下就能发出去。

- **阶段**：Post-Processing。
- **适用范围**：Roleplay。
- **主要设置**：**Edit**(编辑) 用来改写选项，**Re-roll**(重掷) 用来生成一批新的。

### Storyboard

根据已完成的 Roleplay 往来对话和 Game 叙述，规划静态或动态的视觉分镜。规划和面向服务商的格式化分成两步进行，生成出来的关键帧和视频因此能保持原文的时间顺序、角色身份和选定的视觉风格。

- **集成方式**：智能体包；Game 和 Roleplay 通过 Engine 的 Storyboard 宿主集成，使用已安装的这个包的提示词模板和设置。
- **适用范围**：Roleplay 和 Game。
- **主要设置**：选择静态或动画规划器、图像连接和视频连接、关键帧数量、时长、显示模式、角色参考图的处理方式、Roleplay 的分集模板和风格模板，以及 Game 的插图模板和视频模板。
- **兼容性**：Engine `2.3.5` 起，`3.0.0` 之前。这个包使用 `agent-runtime`、`chat-read`、`prompt-context`、`storage` 和 `ui` 权限，不需要重启。
- **完整指南**：[Storyboard 智能体指南](../game/storyboard.md)。

### Calls

加入与 Conversation 角色的实时语音和视频通话，包括自己发起的通话和来电、仅通话的记录、语音合成、麦克风输入和角色视频片段。

- **集成方式**：Conversation 功能包。它添加工具栏、聊天界面和 Chat Settings 里的设置项，而不是作为普通的生成阶段智能体运行。
- **适用范围**：Conversation。
- **主要设置**：打开 **Chat Settings → Agents → Calls**，启用通话并设置语音、麦克风、铃声和视频行为。另见 [Conversation 音频和视频通话](../conversation/calls.md)。安装或移除之后需要重启 Marinara。

### UNO

加入一张严格执行规则的 UNO 牌桌，供你和 Conversation 角色对局，房规可以自定义，总人数支持 2 到 10 人。

- **集成方式**：Conversation 游戏包。
- **适用范围**：Conversation。
- **主要设置**：从游戏选择器启动，或者用 `/uno`；设置里选择玩家和房规。安装或移除之后需要重启 Marinara。

### Chess

加入一对一的国际象棋棋盘，强制合法走法，识别将军和将死，显示被吃的棋子，对手以角色身份行棋。

- **集成方式**：Conversation 游戏包。
- **适用范围**：Conversation。
- **主要设置**：从游戏选择器启动，或者用 `/chess`，然后选择对手和自己执哪一方。安装或移除之后需要重启 Marinara。

### Poker

加入一张德州扑克牌桌，总人数 2 到 8 人，包含盲注、下注轮、边池、摊牌比大小，对手以角色身份参战。

- **集成方式**：Conversation 游戏包。
- **适用范围**：Conversation。
- **主要设置**：从游戏选择器启动，或者用 `/poker`，然后选择玩家、初始筹码和盲注额度。安装或移除之后需要重启 Marinara。

### 8-Ball Pool

加入一张一对一的台球桌，分全色球和花色球，可以瞄准和调节力度，包含犯规、自由球，对手也以角色身份击球。

- **集成方式**：Conversation 游戏包。
- **适用范围**：Conversation。
- **主要设置**：从游戏选择器启动，或者用 `/8ball`，然后选择对手。安装或移除之后需要重启 Marinara。

### Tic-Tac-Toe

加入一对一的井字棋棋盘，棋子标记可以自选也可以随机，回合合法性自动处理，并能判定胜负和平局。

- **集成方式**：Conversation 游戏包。
- **适用范围**：Conversation。
- **主要设置**：从游戏选择器启动，或者用 `/tictactoe`(别名 `/ttt`)，然后选择对手和自己的标记。安装或移除之后需要重启 Marinara。

### Rock-Paper-Scissors

加入一对一的石头剪刀布对局，双方的出手在揭晓之前都保持隐藏。

- **集成方式**：Conversation 游戏包。
- **适用范围**：Conversation。
- **主要设置**：从游戏选择器启动，或者用 `/rps`，然后选择对手，以及打三局两胜、五局三胜还是七局四胜。安装或移除之后需要重启 Marinara。

## 相关指南

- [智能体](agents-overview.md)
- [Illustrator 智能体](../media/illustrator-agent.md)
- [Music DJ](../media/music.md)
- [Haptic Feedback 触感反馈设置](../integrations/haptic-feedback.md)
- [知识源](knowledge-sources.md)
- [Narrative Director 与 Secret Plot](../roleplay/narrative-director.md)
- [Conversation 音频和视频通话](../conversation/calls.md)
- [Conversation 桌游](../conversation/table-games.md)
