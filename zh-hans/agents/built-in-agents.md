# 可下载智能体参考

本指南按分组列出 **Agents → Agent Organizer**(智能体 → 智能体管理器) 里的官方第一方智能体。全新安装并不自带智能体。它们的源码和目录公开在 [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents)。每个条目都会说明这个智能体做什么、什么时候运行、在哪里可用，以及主要设置。安装和启用智能体的步骤，请先看[智能体](agents-overview.md)。标记为 **staging only**(仅 staging) 的条目供 Engine staging 用户使用；包发布到稳定版之后，稳定版用户也会看到这些条目。

## 如何阅读本参考

先从 **Agent Organizer** 安装智能体，再把它添加到你想用的每个聊天里。智能体按聊天设置，而不是按角色卡设置。安装、更新、按聊天设置和费用，见[智能体](agents-overview.md)。

每个条目都列出同样几条速查信息。

- **阶段**或**集成方式**：流水线智能体在什么时候运行。**Pre-Generation**(生成前) 在回复之前运行，可以往提示词里加文字。**Parallel**(并行) 与回复同时运行，看不到最终成文。**Post-Processing**(生成后) 在回复之后运行，能读到回复内容。有些还能改写它。World Maps、Calls 和 Conversation(对话模式) 小游戏这类功能包则直接接入各自的聊天界面。应用类会在自己的 **Home**(主页) 标签页中打开。
- **适用范围**：哪些聊天模式接受这个智能体。多数智能体用在 Roleplay(角色扮演) 里。
- **主要设置**：最可能需要改动的设置，位于 **Chat Settings**(聊天设置) 里这个智能体的卡片上。

运行间隔让智能体每隔几条用户消息和 AI 回复才运行一次，而不是每条消息之后都运行。最大可以设为 100。

在 Roleplay 里，Illustrator 的运行间隔按聊天分别设置，位置在 **Chat Settings** 里它的卡片上。它设置里的值就是默认值，供没有单独设置的聊天使用。Illustrator 也接受 **0**：这时它永远不会自动运行，但仍可用于 Gallery 操作。

<a id="apps"></a>

## 应用类

应用类在 **Home** 里有自己的标签页。它们单独使用，不需要添加到聊天里。每个应用安装后都会提示你重启。

### Noodle

在专属的 **Home** 标签页里添加可选的本地 Noodle 公共时间线。它不在聊天智能体管线中运行。

- **集成方式**：功能包，带有本地路由、生成与媒体流程以及后台调度器。
- **适用范围**：Home，可选择带入 Conversation、Roleplay 和 Game 聊天中的上下文。
- **主要设置**：从 **Agents → Agent Organizer** 安装，并在提示时重启。在 Noodle 里可以设置受邀账号、文本与图像连接、时间线刷新、随机用户和聊天内容延续。
- **数据**：卸载后，重启时会移除这个标签页并停止调度器。你的 Noodle 数据会保留，供以后重装。
- **完整指南**：[Noodle：应用内的社交时间线](noodle.md)。

### Slurp

一款为你的角色准备的私密社交应用。把角色和用户角色变成创作者，发布公开或上锁的照片，再看着模拟观众关注、订阅、购买、评论和私信。它默认针对成人内容调校。一切都是虚构的：价格是假的，也不会发生任何真实付款。

- **集成方式**：应用，位于 **Home** 中自己的 **Slurp** 标签页。
- **适用范围**：Home。
- **主要设置**：安装后在提示时重启，然后打开 **Home → Slurp**。想让某个聊天里的角色记住最近的 Slurp 帖子和私信，就在该聊天的 **Chat Settings** 中，到 **Connected Chats**(关联聊天) 下开启 **Include Slurp activity**(包含 Slurp 动态)。同时还要在 Slurp 的设置里为该聊天模式开启内容延续。**Slurp Settings → Autopurge** 会删除旧的 Slurp 媒体以节省空间。它默认关闭。
- **旧名称**：旧版目录里它叫 **Slurp Remastered**，旁边是已停用的 **Slurp Legacy**，后者不再更新。
- **完整指南**：[Slurp 包指南](https://github.com/Pasta-Devs/Marinara-Agents/blob/main/packages/slurp2/README.md)。

### Gacha Forge

一款根据你描述的世界搭建的抽卡游戏：可以抽的卡池、由模型撰写并绘制的角色阵容、由视觉小说式旁白讲述的剧情章节，以及战斗、装备和活动。你的世界书可以为这个世界提供素材，不过一段手写的场景设定就够用了。

- **集成方式**：应用，位于 **Home** 中自己的 **Gacha Forge** 标签页。
- **适用范围**：Home。
- **主要设置**：安装后在提示时重启，然后打开 **Home → Gacha Forge**。卸载后，重启时会移除这个标签页。
- **完整指南**：[Gacha Forge 包指南](https://github.com/Pasta-Devs/Marinara-Agents/blob/main/packages/gacha-forge/README.md)。

### Modern Life Sim

一款人生模拟游戏。你生活在一座按时钟运转的小镇里，要保住一份工作，按时付账单，还得照顾自己的精力和饥饿。身边的人来自你的角色卡，重要的场景由视觉小说式的旁白讲述。

- **集成方式**：应用，位于 **Home** 中自己的 **Life Sim** 标签页。
- **适用范围**：Home。
- **可用性**：**Staging only**(仅 staging)，需要 Engine **2.4.4+**(低于 4.0.0)。目前是 alpha 版。如果某次更新改动了旧存档依赖的内容，打开那个存档时 Life Sim 会提示你。你可以开始新的人生，也可以自担风险继续。
- **主要设置**：安装后在提示时重启，然后打开 **Home → Life Sim**。它需要一个文本连接。图像连接是可选的：没有的话，地点会显示插画卡片。可选模块默认关闭，直到你为某段人生开启它们。**Adult** 模块会要求你确认自己已经成年。
- **完整指南**：[Modern Life Sim 包指南](https://github.com/Pasta-Devs/Marinara-Agents/blob/staging/packages/modern-life-sim/README.md)。

### Story Writer

一本和模型共同创作的书。在侧栏设置故事、角色阵容和世界书，把作者指令留在便签上，你提出请求时，模型就会续写下一章。可以点击正文的任意位置修改，也可以自己写第一章。

- **集成方式**：应用，位于 **Home** 中自己的 **Story Writer** 标签页。
- **适用范围**：Home。
- **可用性**：需要比 **v2.5.1** 更新的 Marinara Engine(下一个正式版本或当前的 staging 构建)。
- **主要设置**：安装后在提示时重启，然后打开 **Home → Story Writer**，在侧栏里选择一个文本连接。故事都保存在你的 Marinara 服务器上。可以开始新故事、回到旧故事，也可以把它们下载为 Markdown 或纯文本。
- **完整指南**：[Story Writer 包指南](https://github.com/Pasta-Devs/Marinara-Agents/blob/staging/packages/story-writer/README.md)。

## 写作类智能体

写作类智能体负责塑造故事或文笔。它们在回复之前补充写作指引，或在回复之后做润色。

### Prose Guardian

改写最新一条回复，去掉禁用词和重复表达，同时不改变原意。模型老是重复句式或者滥用某个词时就用它。

- **阶段**：Post-Processing。
- **适用范围**：Roleplay。
- **主要设置**：**Banned Words**(禁用词，默认 `ozone`)、**Prefer In Writing**(偏好用词) 和 **Remove From Writing**(剔除用词) 三个输入框。**Hold Message Until Rewrite**(改写完成前不显示消息) 默认开启，会把回复藏到润色结束再显示。关闭之后，原始回复先出现，随后再被替换。

### Continuity Checker

修正最新回复里的具体逻辑错误，比如一个角色同时出现在两个地方，或者时间线对不上。发现问题时，它会列出一份清单，由你挑选要应用哪些修改。

- **阶段**：Post-Processing。
- **适用范围**：Roleplay。
- **主要设置**：**Hold Message Until Rewrite** 开关。

### Card Evolution Auditor

观察角色在游玩过程中的变化，并对这个角色的角色卡提出修改建议。它绝不会自动改动。每条建议都会打开 **Review Character Card Updates**(审阅角色卡更新) 窗口，由你决定接受还是拒绝。

- **阶段**：Post-Processing。
- **适用范围**：Roleplay。
- **主要设置**：默认每 8 条用户消息和 AI 回复运行一次。见[智能体审批与 Agent Suite](approvals-and-agent-suite.md)。

### Narrative Director

在你要求时为故事推上一把，效果仅此一次。在 Roleplay 聊天里启用这个智能体后，会出现 **Push Story**(推动剧情) 按钮。点一下，下一条回复就会推进剧情或者抛出一个意外。

- **阶段**：Pre-Generation。
- **适用范围**：仅 Roleplay。
- **主要设置**：**Story Push Mode**(剧情推动方式)（**Natural** 沿着当前线索往下走，**Random Event** 加入一个合理的意外）。它还可以维护一条隐藏的长线剧情，叫 **Secret Plot**(秘密剧情)。见 [Narrative Director 与 Secret Plot](../roleplay/narrative-director.md)。

### Knowledge Retrieval

在回复之前扫描你选定的世界书，以及你上传的文件。它把其中重要的部分整理成摘要，再加进提示词。世界书就是一组关于你的世界的背景设定。这是一种轻量搜索，不需要额外的数据库。

- **阶段**：Pre-Generation。
- **适用范围**：Roleplay。
- **主要设置**：**Use chat-active lorebooks**(使用聊天中已启用的世界书)、**Fixed Source Lorebooks**(固定来源世界书) 选择器和文件上传。它和 Knowledge Router 功能重叠，不要同时运行。见[知识源](knowledge-sources.md)。

### Knowledge Router

Knowledge Retrieval 的省钱替代方案。它读取世界书条目的简短描述，然后把匹配上的条目原文照搬加进去。条目描述写得好时，它的效果最好。

- **阶段**：Pre-Generation。
- **适用范围**：Roleplay。
- **主要设置**：**Use chat-active lorebooks** 和 **Fixed Source Lorebooks** 选择器。覆盖率徽标会显示来源条目里有多大比例写了描述。见[知识源](knowledge-sources.md)。

## 追踪类智能体

追踪类智能体会持续记录场景、角色和你的各项数值。**Add as Prompt Section**(作为提示词段落加入) 会把智能体的最新输出加进提示词，让模型保持前后一致。除了 Expression Engine 和 Background，所有追踪器都默认开启它。

### World State

追踪日期、时间、天气、地点以及在场角色。这样场景有了依托，模型不会忘记故事发生在何时何地。

- **阶段**：Post-Processing。
- **适用范围**：Roleplay。
- **主要设置**：**Add as Prompt Section**(默认开启)。

### Expression Engine

读取最新回复里的情绪，为角色挑一张匹配的立绘或表情。立绘就是显示在场景里的角色图像。想让角色立绘随着氛围变化时就用它。

- **阶段**：Post-Processing。
- **适用范围**：Roleplay。
- **主要设置**：**Sprite Source**(立绘来源)（**Expressions**、**Full-body** 或两者都用）、**Expression Avatars**(表情头像) 开关、**Sprite Owners**(立绘归属) 选择器，以及尺寸和不透明度滑块。见[角色立绘](../characters/sprites.md)。

### Quest Tracker

管理任务目标、完成情况和奖励。想在冒险类玩法里看到一份可见的任务列表时就用它。

- **阶段**：Post-Processing。
- **适用范围**：Roleplay。
- **主要设置**：**Add as Prompt Section**(默认开启)。

### Background

从你上传的背景里，为当前场景挑一张最合适的背景。它不生成图像。需要生成场景背景时，请用 Illustrator。

- **阶段**：Post-Processing。
- **适用范围**：Roleplay。
- **主要设置**：标准的智能体连接和上下文设置项。它只从背景库里已有的图像中挑选。

### Character Tracker

追踪在场角色，以及他们的情绪、动作、外貌、服装、心理活动和 HP 之类的个人数值。它还能为没有肖像的新角色生成肖像。

一张描述多个人物的角色卡，例如带一组登场人物的场景卡，可以按人分别追踪。在卡片文本里，用 `[CHARACTER: Name]` 标题或 `Name:` 字段标记每个人物。每个成员都保留自己的名字、情绪、服装、心理活动和肖像。他们不会共用卡片的肖像。以卡片名称命名的旧条目会一直保留，直到追踪器报告了一个具体成员来替换它。手动添加的角色会保留手动设定的身份。

角色离开场景后再次出现时，追踪器会复用他们最近保存的数值和自定义字段。有角色卡的角色还会获得卡片上配置的角色扮演属性，包括资源池和属性值。在 Merged 模式的 Roleplay 群聊里，在场角色还能决定下一条回复启用哪些角色卡。见[自动管理活跃角色](../chats/group-chats.md#automate-active-characters-merged-only)。

- **阶段**：Post-Processing。
- **适用范围**：Roleplay。
- **主要设置**：**Add as Prompt Section**(默认开启)，以及可选的 **Auto-Generate NPC Avatars**(自动生成 NPC 头像) 设置，它有自己的图像连接选择器。**Include the outfit in portraits**(在肖像中包含服装) 默认开启。关闭后，肖像只按外貌来画。

### Beholder

按身体部位追踪每个角色的服装，以及手持物品、伤口、缺失的身体部位、明确裸露的部位和非人类物种。最近一次通过验证的快照会显示在 Roleplay **Chat Settings** 里 Beholder 的抽屉中。它会传给 Beholder 的下一次追踪调用，以及下一条主回复。

- **阶段**：Post-Processing。
- **适用范围**：仅 Roleplay。
- **主要设置**：在 **Chat Settings → Agents → Tracker Agents**(聊天设置 → 智能体 → 追踪类智能体) 下添加它，然后打开 **Configure Beholder**，选择它的连接、模型、提示词、上下文和输出限制。**Add as Prompt Section** 默认开启。
- **提示词模板**：选择与 Beholder 连接背后的模型相匹配的模板。Marinara 无法检测是哪种模型，所以只能手动选择。选错不会造成致命问题，但效果会变差。
  - **SOTA model — one prompt**(高性能模型，单次提示词)（默认）：一次调用覆盖所有追踪字段。请使用强大的通用模型。
  - **Beholder local model — five passes**(Beholder 本地模型，五次处理)：五次范围较窄的调用，每个追踪类别一次，供在你的电脑上运行、专门训练过的 [Beholder](https://huggingface.co/GetBeholder/Beholder-GGUF) 提取模型使用（例如通过 koboldcpp 或 llama.cpp 运行的 `Beholder-Q8_0.gguf`）。该模型一次只回答一个类别，所以单提示词模板只会返回部分状态。它离线运行，不产生费用。
- **来源**：改编自采用 AGPL-3.0-only 许可证的 [GetBeholder/Beholder-ME](https://github.com/GetBeholder/Beholder-ME)。官方包不会加载旧扩展的 DOM、轮询或本地存储运行时。

### Persona Stats

追踪你自己角色的状态条，比如饱食度、精力和清洁度，也包括你添加的自定义状态条。适合生存或者生活模拟类玩法。

- **阶段**：Post-Processing。
- **适用范围**：Roleplay。
- **主要设置**：**Add as Prompt Section**(默认开启)。见[角色颜色与角色扮演属性](../characters/colors-and-stats.md)。

### Custom Tracker

追踪你自己定义的字段，比如货币、计数器或者标记位。内置追踪器管不到故事需要的东西时就用它。

- **阶段**：Post-Processing。
- **适用范围**：Roleplay。
- **主要设置**：**Add as Prompt Section**(默认开启)。

### Inventory Tracker

用三份结构化列表分别追踪金钱、已装备物品和随身物品。重名条目会合并，锁定的行在之后的追踪中保持不变。

- **阶段**：Post-Processing。
- **适用范围**：Roleplay。
- **主要设置**：**Add as Prompt Section**(默认开启)。在 HUD 和 Tracker Panel 里可以编辑并锁定每个名称和数量。

### Quartermaster

管理当前用户角色的物品栏、装备槽位、物品数量、存放位置和保存的服装搭配。它会在回复后阅读剧情，并应用物品变化。浮动面板和 Tracker Panel 都能手动编辑同一份物品栏。物品和服装图片是可选的。

- **阶段**：Post-Processing，并为后续回复提供物品栏上下文。
- **适用范围**：Roleplay。它追踪当前用户角色，不追踪队友或 NPC。
- **可用性**：需要 Engine **2.4.6+**。
- **设置步骤**：安装后在提示时重启。在每个 Roleplay 聊天里，先在 **Chat Settings → Agents**(聊天设置 → 智能体) 中开启智能体，再在 **Tracker Agents** 下添加 Quartermaster，并选择它的模型连接。用 Tracker Panel 上方的启动按钮打开浮动面板。
- **主要操作**：装备和存放物品、保存服装搭配、恢复物品栏或撤销最近的追踪器改动，以及导出或导入一个聊天的配置。图像生成使用它自己的图像连接。开启外观宏或头像替换之前，先看 [Quartermaster 包指南](https://github.com/Pasta-Devs/Marinara-Agents/blob/main/packages/quartermaster/README.md)。

### Relationship Tracker

为 Roleplay 群聊里的角色卡维护一张可编辑的关系网，以及每个角色对当前用户角色的看法。关系分为正面、中立、负面或复杂。手动锁定能保护你的编辑不被自动更改。

- **阶段**：Post-Processing，并为后续回复提供关系上下文。
- **适用范围**：Roleplay 群聊。
- **可用性**：需要 Engine **2.4.4+**(低于 4.0.0)。
- **设置步骤**：安装后在提示时重启。在每个 Roleplay 聊天里，先在 **Chat Settings → Agents** 中开启智能体，再在 **Tracker Agents** 下添加它，并选择它的模型连接。关系网显示在 Tracker Panel 里。在那里选择一次 **All relationships**(所有关系) 或 **Scene-only relationships**(仅场景内关系)，为这个聊天完成初始化。
- **主要操作**：用 **All relationships** 或 **Scene-only relationships** 选择提示词上下文，用 **Update from History**(从历史更新) 扫描最近的消息，还可以手动编辑和锁定，以及使用 **Resume automatic updates**(恢复自动更新)。**Context Size**(上下文大小，默认 5 条消息)、**Presence lookback**(出场回溯范围，默认 15) 和历史扫描的消息数量是各自独立的设置。见 [Relationship Tracker 包指南](https://github.com/Pasta-Devs/Marinara-Agents/blob/main/packages/relationship-tracker/README.md)。

### Memory Nag

为每个 Roleplay 聊天维护一个简短、可编辑的记忆库。它分批扫描聊天，按当前和过去的参与者整理记忆，并把已经解决的记忆移到可以恢复的 Resolved 列表。原话很重要时，一条记忆可以逐字保留一句简短的对白。

每次回复之后，词语匹配只会把最相关的活跃记忆交给追踪器。追踪器判断当前场景是否需要提醒，并且只能从这些记忆里挑选。它不能在回忆时创造新记忆。

- **阶段**：Post-Processing。
- **适用范围**：仅 Roleplay。
- **主要设置**：**Vault scan connection**(默认使用 Agent 连接)、**Messages per batch**(20)、**Maximum memories created per character**(10)、**Maximum memories considered per character**(5) 和 **Maximum memories injected**(3)。用 **Scan chat** 完成首次回填，用 **Open vault** 搜索、添加、编辑、解决、恢复或删除记忆。
- **提示词位置**：没有预设标记时，选中的提醒会放在 `<context><memory_nags>…</memory_nags></context>` 里进入下一次回复。添加一个 Memory Nag Agent 段落，就能自己决定它们的位置。
- **数据**：记忆库只属于一个聊天；停用或卸载这个包后，它仍会保留。删除记忆是永久性的，并且总会先询问。

### World Maps

为故事加入嵌套的地点和空间关联。你可以编写大区、区域、房间和通路，在地点之间移动，当前位置也会为生成补充空间上下文。Game Mode(游戏模式) 也会获得世界地图视图。

- **集成方式**：功能包，提供地图界面和聊天上下文，而不是生成阶段的智能体。
- **适用范围**：Roleplay 和 Game。
- **主要设置**：在 **Chat Settings → Agents** 里为 Roleplay 聊天开启它，或者在创建游戏时选上它，之后在那个游戏的设置里管理。安装或移除之后需要重启。
- **完整指南**：[World Maps：搭建地图、编写内容与移动](hierarchical-maps.md)。

## 杂项类智能体

杂项类智能体提供图像、音乐、观众反应、角色卡更新之类的附加功能。

### Echo Chamber

模拟一群实时观众对你的场景做出反应，显示在聊天区域里浮动的 **Echo** 小组件中。每 30 秒放出一条新反应。

- **阶段**：Parallel。
- **适用范围**：Roleplay。
- **主要设置**：挑一种风格，比如 **AO3 / Wattpad**、**Twitter / Reddit**、**4chan**、**Constructive**、**Hype Squad** 或 **Harbingers**。小组件里有 **Re-run Echo Chamber**(重新运行 Echo Chamber) 和 **Clear messages**(清空消息)。

### Long-Term Memory

从聊天摘要、角色记录和世界书里提取长期记忆，存进这个包自己的记忆库，然后在主回复之前召回相关上下文。它支持浏览记忆库、导入来源、审阅待处理的草稿，以及用预设标记指定插入位置。

- **集成方式**：功能包，提供生成前上下文和记忆管理界面。
- **适用范围**：Conversation、Roleplay 和 Game。
- **主要设置**：召回 Token 预算（128-16,384）、最大召回片段数（1-100）、分数阈值、近期消息上下文（1-20）、召回风格、搜索权重、是否纳入已解决的记忆、召回前言、提取设置、来源上限、提示词模板、AI 关键词提取，以及 Game Mode 提取。
- **数据**：用 Memory Settings 里的备份功能导出或替换记忆库、草稿和设置。**Delete all data**(删除全部数据) 会永久清除记忆、草稿、活动记录和索引，但保留设置。卸载时记忆库会保留下来，供以后重装。安装、更新或移除之后需要重启。
- **兼容性**：Engine `2.3.5` 起，`4.0.0` 之前。权限：`agent-runtime`、`chat-read`、`chat-write`、`routes`、`storage`、`ui`。

### Illustrator

生成图像和视频。它为重要时刻撰写画面提示词，再发送给你的图像或视频服务。

- **阶段**：Post-Processing。
- **适用范围**：Roleplay。
- **主要设置**：Illustrator 默认每 5 条用户消息和 AI 回复运行一次。要修改这个值，就在每个 Roleplay 聊天的卡片上设置 **Image Run Interval**(图像运行间隔)。**Illustrator makes** 设为 **Pictures and clips** 或 **Clips only** 时，自动短片使用 **Video Run Interval**(视频运行间隔)。把 **Video Run Interval** 设为 **0** 就会关闭自动短片。设置包括 **Prompt Model**、**Image Style**、**Attach Card Appearance** 和 **Send Avatar References**。完整设置步骤见 [Illustrator 智能体](../media/illustrator-agent.md)。

### Lorebook Keeper

把聊天里的重要信息写成世界书条目，也会更新已有条目，世界观笔记就随着游玩不断充实。

- **阶段**：Post-Processing。
- **适用范围**：Roleplay。在 Game Mode 里，名为 **Game Session Keeper** 的会话结束版本会做同样的事。
- **主要设置**：默认每 8 条用户消息和 AI 回复运行一次。**Target Lorebook**(目标世界书) 决定条目写到哪里，并提供自动选择选项。高级提示词可以返回一个可写世界书的名称，或者 `world`、`npc`、`scene` 或 `player` 这类别名。别名对应的目标不存在时，会自动创建并关联到这个聊天。不指定目标时，仍保持单世界书的行为。

### Combat

管理战斗：先攻、HP 和回合顺序。启用之后，消息框上方会出现 **Encounter**(遭遇战) 按钮。

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
- **主要设置**：**Touch Sensitivity**(触感强度) 选项（**Subtle**、**Standard** 或 **Intense**），以及 **Intiface URL** 输入框。强度设置会引导智能体的选择，但不会限制可用的 `0.0-1.0` 强度范围。完整设置步骤见 [Haptic Feedback 触感反馈设置](../integrations/haptic-feedback.md)。

### CYOA Choices

在每条回复之后加入可点击的“What will you do?”选项按钮，营造 CYOA(自选冒险) 的感觉。每个按钮都对应一条完整的行动，点一下就能发出去。

- **阶段**：Post-Processing。
- **适用范围**：Roleplay。
- **主要设置**：**Edit**(编辑) 用来改写选项，**Re-roll**(重掷) 用来生成一批新的。在 **Settings → General → Input & Editing**(设置 → 常规 → 输入与编辑) 中开启 **Add CYOA choices to the message box instead of sending them**(把 CYOA 选项放进消息框，而不是直接发送)，点击的选项就会进入你的消息框。

### Storyboard

根据已完成的 Roleplay 往来对话和 Game 旁白，规划静态或动态的分镜。规划和面向服务商的格式化分开进行，从而在各个关键帧和视频之间保持故事顺序、角色身份和选定的风格。

- **集成方式**：智能体包；Game 和 Roleplay 通过 Engine 的 Storyboard 集成使用它的提示词模板和设置。
- **适用范围**：Roleplay 和 Game。
- **主要设置**：静态或动画规划器、图像和视频连接、关键帧数量、时长、显示模式、角色参考图的处理方式、Roleplay 的分集模板和风格模板，以及 Game 的插图模板和视频模板。
- **兼容性**：Engine `2.3.5` 起，`3.0.0` 之前。权限：`agent-runtime`、`chat-read`、`prompt-context`、`storage`、`ui`。不需要重启。
- **完整指南**：[Storyboard 智能体指南](../game/storyboard.md)。

### 2D Avatars

把角色和用户角色显示为会动的 2D 虚拟形象，它们会眨眼、说话，并随每条回复变换表情。虚拟形象可以是 PNGTuber 风格的立绘（你的表情立绘，加上眨眼和说话图片），也可以是网格虚拟形象文件（`.mavatar`）。

- **集成方式**：智能体包。虚拟形象由 Engine 绘制。聊天时它不会向你的 AI 连接发送额外请求。
- **适用范围**：Roleplay 和 Game，适用于角色和用户角色。
- **可用性**：所有安装都能在 **Agent Organizer** 里找到。需要 Marinara Engine 2.5.1 或更新版本。
- **主要设置**：在 **Agents**(智能体) 里这个智能体的页面上设置每个虚拟形象。这个智能体还带有提示词，用来根据一张立绘生成眨眼和说话图片以及网格虚拟形象。
- **兼容性**：Engine `2.5.0` 起，`4.0.0` 之前，Capability API 1.73。权限：`agent-runtime`、`chat-read`、`storage`、`ui`。不需要重启。
- **完整指南**：[2D 和 3D 虚拟形象](avatars.md)。

### 3D Avatars

把角色和用户角色显示为会动的 3D 模型，它们会眨眼、说话，并随每条回复变换表情。它支持 VRM 模型（`.vrm`，0.x 和 1.0 版本），可以配一个可选的待机动画（`.vrma`）；也支持 MMD PMX 模型，以及已绑定骨骼、按名称匹配骨骼的 GLB 和 FBX 模型。

- **集成方式**：智能体包。虚拟形象由 Engine 绘制。聊天时它不会向你的 AI 连接发送额外请求。
- **适用范围**：Roleplay 和 Game，适用于角色和用户角色。
- **可用性**：所有安装都能在 **Agent Organizer** 里找到。需要 Marinara Engine 2.5.1 或更新版本。
- **主要设置**：在 **Agents** 里这个智能体的页面上设置每个虚拟形象。
- **兼容性**：与 2D Avatars 相同。
- **完整指南**：[2D 和 3D 虚拟形象](avatars.md)。

### Calls

加入与 Conversation 角色的实时语音和视频通话：你发起的通话、来电、仅限通话的记录、语音合成、麦克风输入和角色视频片段。

- **集成方式**：Conversation 功能包，在工具栏、聊天界面和 Chat Settings 里提供设置项。
- **适用范围**：Conversation。
- **主要设置**：打开 **Chat Settings → Agents → Calls**，开启通话，并设置语音、麦克风、铃声和视频行为。见 [Conversation 音频和视频通话](../conversation/calls.md)。安装或移除之后需要重启。

### UNO

加入一张严格执行规则的 UNO 牌桌，供你和 Conversation 角色对局，支持房规，可容纳 2 到 10 名玩家。

- **集成方式**：Conversation 游戏包。
- **适用范围**：Conversation。
- **主要设置**：从游戏选择器启动，或者用 `/uno`，然后选择玩家和房规。安装或移除之后需要重启。

### Chess

加入一对一的国际象棋棋盘，会检查走法是否合法，识别将军和将死，显示被吃的棋子，对手以角色身份行棋。

- **集成方式**：Conversation 游戏包。
- **适用范围**：Conversation。
- **主要设置**：从游戏选择器启动，或者用 `/chess`，然后选择对手和你执哪一方。安装或移除之后需要重启。

### Poker

加入一张德州扑克牌桌，可容纳 2 到 8 名玩家，包含盲注、下注轮、边池、摊牌，对手以角色身份参战。

- **集成方式**：Conversation 游戏包。
- **适用范围**：Conversation。
- **主要设置**：从游戏选择器启动，或者用 `/poker`，然后选择玩家、初始筹码和盲注。安装或移除之后需要重启。

### 8-Ball Pool

加入一张一对一的台球桌，分全色球和花色球，可以瞄准和调节击球力度，包含犯规、自由球，对手也以角色身份击球。

- **集成方式**：Conversation 游戏包。
- **适用范围**：Conversation。
- **主要设置**：从游戏选择器启动，或者用 `/8ball`，然后选择对手。安装或移除之后需要重启。

### Tic-Tac-Toe

加入一对一的井字棋棋盘，棋子标记可以自选也可以随机，自动处理回合，并能判定胜负和平局。

- **集成方式**：Conversation 游戏包。
- **适用范围**：Conversation。
- **主要设置**：从游戏选择器启动，或者用 `/tictactoe`(别名 `/ttt`)，然后选择对手和标记。安装或移除之后需要重启。

### Rock-Paper-Scissors

加入一对一的对局，双方的选择在揭晓之前都保持隐藏。

- **集成方式**：Conversation 游戏包。
- **适用范围**：Conversation。
- **主要设置**：从游戏选择器启动，或者用 `/rps`，然后选择对手，以及三局两胜、五局三胜还是七局四胜。安装或移除之后需要重启。

## 相关指南

- [智能体](agents-overview.md)
- [Illustrator 智能体](../media/illustrator-agent.md)
- [Music DJ](../media/music.md)
- [Haptic Feedback 触感反馈设置](../integrations/haptic-feedback.md)
- [知识源](knowledge-sources.md)
- [Narrative Director 与 Secret Plot](../roleplay/narrative-director.md)
- [Conversation 音频和视频通话](../conversation/calls.md)
- [Conversation 桌游](../conversation/table-games.md)
