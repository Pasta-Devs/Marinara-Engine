# 世界书条目：关键词、位置与时机

条目就是世界书里的一条事实，外加一组规则，这组规则决定 Marinara 什么时候把它加进提示词。本指南讲解如何添加条目、选择关键词和条目类型、决定条目落在提示词的什么位置，以及时机控制。

开始之前：先新建一本世界书并打开它。参见[世界书总览](overview.md)。

## Entries 选项卡

从 **Lorebooks**(世界书) 面板打开一本世界书。编辑器有两个选项卡：**Overview**(总览) 和 **Entries**(条目)。点击 **Entries** 查看条目列表。选项卡上的角标显示条目的数量。

工具栏有这些控件。

- **Search entries…** 输入框按名称、关键词或内容筛选条目。
- 排序菜单的选项有 **Order**、**Entries**、**Name A→Z**、**Name Z→A**、**Tokens ↓**、**Keys ↓**、**Fired ↓**、**Newest** 和 **Oldest**。带 ↓ 的选项按从高到低排序。
- **Select**(选择) 开启多选，可以一次复制、移动或删除多个条目。
- **Add Folder**(添加文件夹) 新建一个文件夹（见[条目文件夹](#entry-folders)）。
- **Add Entry**(添加条目) 在列表顶部新建一个空白条目。

工具栏下方有一行，显示条目数、文件夹数，以及全部条目内容的估算 Token(模型切分文本的最小单位) 总量。

## 添加和编辑条目

1. 点击 **Add Entry**，会出现新的一行。
2. 在这一行里填写名称。每个条目都必须有名称。名称是给你自己和搜索用的，不是给 AI 看的。
3. 点击这一行或者行上的箭头，下方会展开一个面板，里面是全部字段。
4. 在 **Primary Keys**(主关键词) 里输入一个关键词，按 <kbd>Enter</kbd>。然后在 **Content**(内容) 里写下给 AI 看的文本。见[内容与关键词](#content-and-keys)。

编辑会自动保存。抽屉面板上先显示 **Autosaving…**，再显示 **Saving…**，然后显示 **Saved automatically**。保存失败时文字不会丢失，Marinara 会在你下次编辑时重试。

要复制条目，点击它那一行上的 **Duplicate entry**(复制条目)。要删除条目，点击 **Delete entry**(删除条目) 并确认。在电脑上，鼠标指向那一行时才会显示这两个按钮。

<a id="content-and-keys"></a>

### 内容与关键词

| 字段 | 说明 |
| --- | --- |
| **Primary Keys** | 触发这个条目的词。输入一个关键词后按 <kbd>Enter</kbd> 添加。任何一个关键词匹配上，**Normal** 条目就会激活。 |
| **Content** | 发给 AI 的文本。写成一条平实的事实。内容里可以用[宏](../prompts/macros.md)，输入框下方会显示 Token 估算。 |
| **Secondary Keys**(次关键词) | 额外的关键词，只有 **Selective** 条目才会用到。 |
| **Description**(描述) | 一段简短的摘要，只有 **Knowledge Router**(知识路由) 智能体会读它。它永远不会发给主模型。参见[知识源](../agents/knowledge-sources.md)。 |

关键词超过 10 个时，列表只显示前 10 个。点击 **Show N more**(再显示 N 个) 查看其余的关键词，点击 **Collapse**(收起) 再把它们藏起来。被藏起来的关键词照常参与匹配。

例如，一个名为 `Silverhaven` 的条目，关键词是 `Silverhaven` 和 `the capital`，内容是 `Silverhaven is the mountain capital. Its people mine blue crystal and distrust outsiders.`，只要最近的聊天里出现其中任意一个关键词，AI 就会收到它。

### 匹配规则

默认情况下，关键词只要出现在最近聊天里的任意位置就算匹配，不区分大小写。有三个控件可以改变这一点。

- **Whole Words**(全词匹配)（在条目面板里，默认关闭）：关键词必须是一个完整的词。`Ash` 能匹配“Ash”，但不匹配“cash”。
- **Case Sensitive**(区分大小写)（在条目面板里，默认关闭）：大小写必须一致。`IT` 能匹配“IT”，但不匹配“it”。
- **Regex**(正则)（行上的一个图标，提示文字是 **Enable regex key matching**(启用正则关键词匹配)，默认关闭）：把每个关键词当作正则表达式，也就是一种文本匹配模式。开启后图标会变成橙色。

只有懂正则表达式时才用 **Regex**。每个模式运行时都有很短的时间限制，跑得太久的模式就不算匹配，所以模式要尽量简单。例如，`\bVlad(?:'s)?\b` 能匹配“Vlad”和“Vlad's”。

## 选择条目类型

点击行上的彩色圆点，打开类型菜单。

- **Normal**(绿点，默认类型)：主关键词匹配时激活。大部分条目都用它，比如人物、地点、物品。每个条目给三到八个具体的关键词。
- **Constant**(黄点)：只要世界书处于启用状态就每次都激活，不需要关键词。用于少数必须始终在场的事实，比如年代或基调。时机、概率和筛选条件仍然生效。
- **Selective**(红点)：主关键词匹配，并且次关键词逻辑也通过时激活。常用词做关键词、会在不相干的场景里触发时，就用它。

每个 **Constant** 条目在每条消息上都要花 Token，所以要少用。

**Selective** 条目要添加 **Secondary Keys**，并选择一个 **Logic**(逻辑) 按钮。

| 逻辑 | 条目在这种情况下触发 |
| --- | --- |
| **AND Any** | 至少还出现一个次关键词。 |
| **AND All** | 每个次关键词也都出现。 |
| **NOT Any** | 没有出现任何次关键词。 |
| **NOT All** | 次关键词没有全部同时出现。 |

例如，主关键词 `king`、次关键词 `Silverhaven`，逻辑选 **AND Any**，只有聊天同时提到这两个词时才触发。

如果没有生效：没有关键词的 **Normal** 条目无从匹配。给它加关键词，或者改成 **Constant**。不带关键词的条目仍然可以按意思被找到，但前提是[语义搜索](semantic-search.md)已经完全配好。

## Position、Depth 和 Order

这几个控件决定激活的条目落在提示词的哪个位置。宽屏时它们就在紧凑行上。窄屏时，点击行上的 **Entry quick controls**(条目快捷控件) 按钮。

| 控件 | 作用 |
| --- | --- |
| **Position**(位置) | 条目放在哪里。默认是 **Before character definitions**(角色定义之前)。 |
| **Before character definitions** | 在提示词里放在角色卡之前。行上的标签是 **↑Char**。 |
| **After character definitions**(角色定义之后) | 放在角色卡之后。行上的标签是 **↓Char**。 |
| **@ Depth** | 放在聊天记录内部。行上的标签是 **@Depth**。 |
| **Outlet** | 不自动放到任何位置（见下文）。 |
| **Depth**(深度) | 只有选 **@ Depth** 时才显示。条目放在从最新消息往前数第几条消息的位置。默认是 4。 |
| **Order**(顺序) | 多个条目同时激活时的先后顺序。数字越小越靠前，预算吃紧需要裁剪时也越不容易被丢掉。默认是 100。 |

**Role**(消息角色) 在展开的条目面板里，不在快捷控件里。它把注入的文本标记成 **System**、**User** 或 **Assistant**，只对 **@ Depth** 有意义，默认是 **System**。

除非某个条目确实需要，否则这些都保持默认。**@ Depth** 要少用。那段文字会落在最近几条消息之间，读起来就像有人插了一句话，所以只把它留给模型老是忘掉的规则，或者刚刚发生变化的事实。例如，把“The tavern is now on fire.”放在 **@ Depth** 1。

### Outlet

**Outlet** 条目只出现在你放置宏的位置。

1. 把 **Position** 设为 **Outlet**，会出现 **Outlet name**(Outlet 名称) 字段。
2. 填一个精确、区分大小写的名称，例如 `character_rules`。
3. 在[预设](../prompts/presets.md)的某个提示词分区里写上 `{{outlet::character_rules}}`。

同名的条目按 **Order** 顺序拼接，中间用换行分隔。Outlet 宏在 Conversation(对话模式)、Roleplay(角色扮演) 和 Game(游戏模式) 聊天的提示词分区里都能用。只有本次回复激活的条目才会出现。它们仍然遵守关键词、概率、筛选、时机、**Entry Limit**(条目上限) 和 **Token Budget**(Token 预算) 的规则。没有激活条目时，这个宏什么也不添加。Outlet 条目里不能再调用另一个 Outlet 宏。这个宏的用法见[宏](../prompts/macros.md)。

## 概率与时机

**Probability**(概率) 是关键词匹配时条目触发的几率。默认是 100%。设成 25%，每次就有四分之一的几率触发。

**Timing**(时机) 这组字段控制条目在多条消息之间的行为。四项初始都没有设置，也就是关闭。

| 字段 | 作用 | 例子 |
| --- | --- | --- |
| **Sticky**(保持) | 条目触发后，再多保持这么多条消息的激活状态，哪怕没有关键词匹配。 | 刚揭晓的秘密设成 3，会在接下来三条消息里保持激活。 |
| **Cooldown**(冷却) | 条目触发后，要等这么多条消息才能再次触发。 | 不祥预兆设成 5，最多每五条消息触发一次。 |
| **Delay**(延迟) | 聊天进行到这么多条消息之前，条目不能触发。 | 转折设成 20，一开始会保持隐藏。 |
| **Ephemeral**(限次) | 激活这么多次之后就自我关闭。0 表示不限次数。 | 开场说明设成 1，只触发一次。 |

**Sticky**、**Cooldown** 和 **Delay** 按消息条数计算，**Ephemeral** 按激活次数计算。

<a id="decision-activation"></a>

## Decision 激活

**Decision**(判定) 字段让你的 Decision 模型（一个专门回答是或否问题的小模型）决定条目是否适用。写一条关于最近聊天的陈述，例如 `In the latest message, a dragon is physically present`，然后选一种模式。

| 模式 | 效果 |
| --- | --- |
| **Off**(关闭) | 条目照常激活。这是默认值。 |
| **Require**(必需) | 条目照常激活，但只在陈述也为真时才激活。它能过滤顺带的提及。 |
| **Trigger**(触发) | 陈述是激活条目的另一条途径，即使没有关键词出现也行。它能捕捉改述和情境。 |

陈述里可以用 `{{user}}`、`{{char}}` 等宏。

开始之前：在 **Connections**(连接) 面板的 **Decision model**(判定模型) 下选好一个 Decision 模型。没有 Decision 模型，或者没有答案时，陈述一律算作否。没有设置时，编辑器会提醒你。

- 这时 **Require** 永远不会放行新条目，不过已有的 **Sticky** 保持仍可让条目继续激活。
- **Trigger** 不会增加激活途径，条目仍然可以靠关键词激活。

重要的条目也要有一条普通的激活途径，**Require** 只用来过滤可有可无的设定。

**Require** 只检查已经通过关键词、语义匹配、**Constant** 或地图位置获得资格的条目，并且只在陈述也为真时才放行。用在 **Constant** 条目上，它能让条目按情境出现，例如给战斗规则配上 `A fight is happening in the latest message`。它不会扫描所有未使用的条目。

Decision 陈述会增加模型请求，并且共用 **Decision statements per turn**(每回合判定陈述数) 这个上限。措辞技巧、限制、成本和答案复用，见[编写陈述](../prompts/conditional-prompts.md#writing-statements)、[限制与成本](../prompts/conditional-prompts.md#limits-and-cost)和[答案复用](../prompts/conditional-prompts.md#answer-reuse)。模型的设置见 [Decision 模型](../connections/decision-models.md)。

更多细节：

- **sticky** 条目在保持期间不会再次询问，处于冷却期的条目则根本不会询问。
- 活跃世界书列表会给由 **Trigger** 陈述激活的条目标注 **decision**。
- **Peek Prompt**(查看提示词) 从不询问。它显示这一回合已有的答案。
- Decision 激活只适用于聊天回合。Game 设置，以及智能体为自己执行的扫描，都把 Decision 条目读作否。
- 条目内容里的 `{{#if decision:"..."}}` 是另一回事。它裁减的是已经激活的条目的文本。

## 分组、筛选与其他选项

展开的抽屉面板里还有更多字段。

| 字段 | 作用 |
| --- | --- |
| **Group**(分组) | 同一分组里的条目互斥，每条回复只激活其中一个。用于几种备选内容，比如三个“今天的天气”条目。配上较低的 **Probability**，传闻就只会偶尔出现。 |
| **Tag**(标签) | 自己用来分类的自由文本标签。不影响激活。 |
| **Locked**(锁定) | 禁止 **Lorebook Keeper** 智能体改动这个条目。参见[可下载智能体参考](../agents/built-in-agents.md)。 |
| **No Vector**(不向量化) | 把条目排除在语义搜索之外。参见[世界书的语义搜索](semantic-search.md)。 |
| **Recursion**(递归) | 允许这个条目的内容再触发别的条目。默认关闭。参见[世界书的 Token 预算与递归](token-budgets.md)。 |

**Context filters & matching sources**(上下文筛选与匹配来源) 分区可以把条目限定到特定角色、角色标签或生成类型。它还能让条目的关键词额外扫描角色卡的其他字段，比如角色描述。在 **Individual**(各自独立) 模式的群聊里，每条回复只算写这条回复的那个角色，所以角色筛选能让条目不进入其他角色的回复。在 **Merged (Narrator)**(合并叙述) 的回复里，聊天中的每个角色都算数，所以只要筛选指定的任意一个角色在聊天里，条目就会保留。它适合只有一个角色知道的秘密。

## 为一条事实选择设置

先问自己 AI 应该在什么时候看到这条事实，然后对照这张表。

| 这条事实 | 设置 |
| --- | --- |
| 始终成立 | **Constant**。这类条目要少。 |
| 只在被提到时才重要 | **Normal**，配上具体的关键词，比如 `Castle Dracul`、`the castle`、`the fortress`。 |
| 它的关键词是常用词，比如 `king` 或 `home` | **Whole Words**，或者 **Selective** 加次关键词。 |
| 很重要，但很少被直接提到 | **Normal** 配合[语义搜索](semantic-search.md)，或者放宽关键词。 |
| 有好几个版本，绝不能一起出现 | 放进同一个 **Group**。 |
| 模型在场景中途老是忘掉的规则 | **@ Depth**，设在 1 到 4 附近。 |

几个让世界书保持精简的习惯：

- 关键词尽量具体。`he` 或 `the city` 这类关键词几乎每条消息都能匹配上，白白浪费预算。
- 凡是打算交给 **Knowledge Router** 调度的条目，都把 **Description** 填上。它读的是描述，不是内容。
- 大世界观用树状结构搭建。除了给每个成员各写一个条目，再给它们所属的群体加一个枢纽条目，比如一个介绍帝国、列出其成员的条目。
- 枢纽条目上不要开 **Recursion**。否则一提到这个群体，每个成员的完整条目都会一次性被拉进提示词。

举个例子：怎样才能杀死反派这条规则，AI 很容易忘掉。把它设成 **Selective**，逻辑选 **AND Any**，开启 **Whole Words**，**Order** 设为 10。主关键词用 `weakness`、`kill`、`destroy`、`stake`，次关键词用 `Vlad`、`the count`。有了次关键词，队伍杀狼时它不会出声。**Whole Words** 让 `stake` 不会匹配到“mistake”。较低的顺序值让它在条目扎堆的场景里不会被裁掉。

世界书放在哪里，决定了哪些聊天能看到它。全局、关联和嵌入的世界书，见[世界书总览](overview.md)和[把世界书关联到角色和用户角色](linking-to-characters.md)。

## 在条目内容里使用宏

**Content** 和其他提示词文本一样，发送前会先展开。好用的宏：

- `{{char}}` 和 `{{user}}` 给出名字，这样一个共用条目在任何聊天里读起来都顺。
- `{{roll:1d6}}` 掷一个骰子。`{{setvar::mood::angry}}` 为当前聊天存一个值，`{{getvar::mood}}` 把它读回来。
- `{{random::a::b::c}}` 随机挑一个选项。可以加权重，比如 `{{random::common@3::rare@1}}`。再配上较低的 **Probability**，一整张遭遇表就能塞进一个条目里。
- `{{include::Entry name}}` 引入同一本世界书里另一个条目的文本，哪怕那个条目已经关闭。见[世界书引入宏](../prompts/macros.md#lorebook-include-macro)。
- `{{// note}}` 是注释。它在 AI 看到之前就被剔除，也在递归扫描之前被剔除，所以永远触发不了任何东西。

完整列表见[提示词宏](../prompts/macros.md)。

开启 **Recursive**(递归) 后，Marinara 会把已激活条目展开后的内容再扫描一遍。宏产生的文本也能触发更多条目。

## 关键词测试工具

**Entries** 选项卡顶部的 **Keyword test**(关键词测试) 面板不用聊天就能检验关键词。

1. 展开 **Keyword test**。
2. 把一段示例文字或者几条消息粘贴进输入框。

能匹配上的条目会带上绿色高亮和一个 **Would activate** 标记。**Constant** 条目会带 **Always active** 标记。计数行显示有多少个已启用的条目会激活。**Include other lorebooks**(包含其他世界书) 开关会把你其他世界书里已启用的条目也一起检查。

这个测试不考虑时机、几率、角色和用户角色筛选，也不考虑按意思匹配，所以实际聊天的结果仍然可能不同。

<a id="entry-folders"></a>

## 条目文件夹

文件夹把一本世界书内部的条目分组。它和 **Lorebooks** 面板里的库文件夹是两回事。

- 点击 **Add Folder**，然后就地给文件夹改名。
- 把条目拖到文件夹上，或者用条目的 **Folder**(文件夹) 选择器（点按也能用）。
- 把一个文件夹拖到另一个文件夹上可以嵌套，拖到顶部那一栏可以取消嵌套。
- 每个文件夹都有一个启用开关（提示文字是“Folder enabled”）。关掉它，里面的每个条目都会停止激活。
- **Clone folder**(克隆文件夹) 会复制这个文件夹，连同里面所有的条目和子文件夹。
- **Delete folder**(删除文件夹) 只删除文件夹本身，里面的内容会移到顶层。

只有按 **Order** 排序且没有搜索时，文件夹才会以分组形式显示。否则你看到的是平铺列表，并附有提示 **Folder view paused (clear search and sort by Order)**。

## 故障排查

| 症状 | 解决办法 |
| --- | --- |
| 条目从来不触发。 | 给它加关键词，或者改成 **Constant**。确认这本世界书已启用，并且在当前聊天里生效。 |
| 某个关键词起过作用，后来不灵了。 | Marinara 只扫描最近几条消息（**Scan Depth**(扫描深度)，默认是 2）。调高 **Scan Depth**，加上 **Sticky**，或者把条目改成 **Constant**。 |
| 条目在不该出现的场景里触发。 | 用 **Whole Words**、**Selective** 的次关键词，或者角色筛选。 |
| 重要设定被丢掉了。 | 给它一个更小的 **Order**，或者调高 **Token Budget**。**Chat Settings**(聊天设置) 里的 **Active Context**(活动上下文) 会显示哪些内容被跳过、为什么跳过。参见[世界书的 Token 预算与递归](token-budgets.md)。 |
| AI 不理会某个条目。 | 先在 **Active Context** 里确认它确实激活了。离最新消息很远的事实，分量不如用 **@ Depth** 放在最新消息附近的事实。 |

## 相关指南

- [世界书总览](overview.md)
- [Decision 模型](../connections/decision-models.md)
- [世界书的 Token 预算与递归](token-budgets.md)
- [世界书的语义搜索](semantic-search.md)
- [知识源：Knowledge Retrieval 与 Knowledge Router 智能体](../agents/knowledge-sources.md)
