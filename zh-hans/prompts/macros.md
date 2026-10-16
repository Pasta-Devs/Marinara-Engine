# 提示词宏

本指南介绍 Marinara Engine 里的提示词宏。宏就是一小段 `{{tag}}`，Marinara 会把它换成当时的真实值。替换发生在组装提示词（Marinara Engine 发给 AI 的那段文字）的时候，换进去的可能是你的名字，也可能是当天日期。下面会讲全部内置宏、能在哪些地方写宏，以及要避开的坑。

## 宏是什么，能用在哪里

宏就是用双大括号包起来的一串字面文本，比如 `{{user}}` 或 `{{char}}`。Marinara 组装要发给 AI 的文字时，会扫描这些标签，把每一个换成它当前的值。宏没有总开关，只要某个输入框支持宏，它就一定会解析。

内置标签的宏名不区分大小写，`{{user}}` 和 `{{USER}}` 都能用。

应用里很多地方都可以写宏：

- **Character Editor**(角色编辑器) 里的角色字段：Description、Personality、Backstory、Appearance、Scenario、Example Dialogue、System Prompt、Post-History Instructions，以及 **Depth Prompt**。
- **Persona Editor**(用户角色编辑器) 里的用户角色字段（和角色卡上同名的那几个字段）。
- 世界书条目的 Description 和 Content 输入框。
- **Preset Editor**(预设编辑器) 里的提示词预设小节。
- 正则脚本的 Find、Replace、Trim 输入框。
- 智能体的提示词模板。
- 聊天输入框。在消息里写 `{{roll:1d20}}`，消息发出去之前就会被解析。

宏展开出来的内容里还可以再有宏，Marinara 会继续解析。

## 开始之前

不用做任何准备。内置宏开箱即用，既不需要 API 密钥，也不需要额外的连接。API 密钥（类似密码的一串秘密字符）是 Marinara 跟 AI 服务商通信的凭据，而宏完全在 Marinara 内部运行。

只有两项宏功能依赖应用的其他部分：

- 预设变量（`{{NAME}}` 这种通配写法）需要提示词预设先把它们定义好。见[预设变量](preset-variables.md)。
- 智能体宏 `{{agent::TYPE}}` 只有等对应的智能体跑完并产出内容之后，才会显示文字。

## 身份、角色与用户角色相关的宏

这类宏取的是发言方和回复方的名字与角色卡字段。user 指你自己（或者当前启用的用户角色），character 指正在回复的那个角色。

| 宏 | 展开结果 |
| --- | --- |
| `{{user}}` / `{{userName}}` | 你当前的显示名称（或者用户角色名）。没有设置用户角色时默认是 `User`。 |
| `{{userNamePhonetic}}` | 用户角色的 Phonetic 名称；留空时等同 `{{user}}`。 |
| `{{char}}` / `{{charName}}` | 当前角色的名字。默认是 `Character`。 |
| `{{21-character-card-ID}}` | 其他角色的姓名。将占位文字替换为该卡准确的 21 字符 ID，即可把卡片加入上下文。 |
| `{{persona-21-character-card-ID}}` | 引用另一个用户角色名字的占位写法。把 `persona-` 后面的内容换成那张卡精确的 21 位 ID，即可带入卡片上下文。 |
| `{{charNamePhonetic}}` | 角色的 Phonetic 名称；留空时等同 `{{char}}`。 |
| `{{characters}}` | 聊天里的所有角色，用逗号连接。 |
| `{{group}}` | 群聊里除当前回复者之外的所有启用角色。用户角色不算在这份角色名单里。 |
| `{{persona}}` | 用户角色的 Description、Personality、Backstory、Appearance 和 Scenario，用换行连接。 |
| `{{personaDescription}}` | 用户角色的 Description 字段。 |
| `{{personaPersonality}}` | 用户角色的 Personality 字段。 |
| `{{personaBackstory}}` | 用户角色的 Backstory 字段。 |
| `{{personaAppearance}}` | 用户角色的 Appearance 字段。 |
| `{{personaScenario}}` | 用户角色的 Scenario 字段。 |

下面这组宏读取的是当前角色的角色卡：

| 宏 | 角色卡字段 |
| --- | --- |
| `{{description}}` | Description |
| `{{personality}}` | Personality |
| `{{backstory}}` | Backstory |
| `{{appearance}}` | Appearance |
| `{{scenario}}` | Scenario |
| `{{example}}` | Example Dialogue |
| `{{charSysInfo}}` | System Prompt |
| `{{charPostHistory}}` | Post-History Instructions |

单角色聊天里，这些宏对应的就是那个角色。群聊里默认对应第一个角色。想让同一段文字对每个角色各出现一次，就把它放进方括号包起来的 group 块里。group 块的用法见[条件提示词](conditional-prompts.md)。

`{{group}}` 始终跟着当前正在回复的角色走，群聊里逐个角色生成时也一样。举个例子，Roleplay(角色扮演) 群聊里有 Powers That Be、Maukie 和 Pantalone，轮到 Pantalone 回复时，`{{group}}` 展开为 `Powers That Be, Maukie`。角色卡的名字就算恰好和 `{{user}}` 相同，也仍然留在这份名单里。

Phonetic 名称字段有两个作用。一是决定语音合成怎么念这个名字，二是给 `{{charNamePhonetic}}` 和 `{{userNamePhonetic}}` 提供内容。**Character Editor** 和 **Persona Editor** 里都有这个字段。

要引用不在当前聊天里的角色，复制卡片 ID，直接放进双大括号，例如 `{{V1StGXR8_Z5jdHi6B-myT}}`。不要包含字面的 `<` 或 `>` 字符。Marinara 将宏替换为角色姓名。在使用提示词预设的 Roleplay 聊天里，还会把卡片的 Description、Personality、Appearance、Backstory、Scenario 和 Example Dialogue 加入系统提示词；在其他聊天里，宏只会变成姓名。它适用于聊天消息和提示词字段；在使用预设的 Roleplay 聊天里，也适用于已激活的世界书条目。卡片的初始开场白会排除。关联的已启用世界书仍遵守通常的关键词、constant、筛选、概率和 Token 预算规则。如果角色已经在聊天里，宏照样替换为角色姓名，卡片则不会重复加入。

想引用当前未启用的用户角色，请在复制的 ID 前加上 `persona-`，例如 `{{persona-P1StGXR8_Z5jdHi6B-myT}}`。Marinara 会把宏换成用户角色名，并把其 Description、Personality、Appearance、Backstory 和 Scenario 字段加入 ID Macro Cards。所附世界书仍按通常的激活规则运行。

## Conversation 模式相关的宏

这四个宏只在 Conversation(对话模式) 里有效。在其他任何模式下，它们一律展开为空，哪怕同一段角色卡或预设文字在多个模式之间共用。

| 宏 | 展开结果 |
| --- | --- |
| `{{convo_display}}` | 角色的 **Convo Display Name**(对话显示名)，留空时用角色卡名字。 |
| `{{char_about}}` | 角色当前的 **About Me**(自我介绍)，设了单聊覆盖就用覆盖值，否则用角色卡默认值。 |
| `{{persona_about}}` | 用户角色当前的 About Me。 |
| `{{convo_behavior}}` | 角色的 **Convo Behavior**(对话行为) 文本，仅当它的插入位置设置为放在这个宏处时才生效。 |

这些字段在 **Character Editor** 和 **Persona Editor** 的 **Convo** 选项卡里编辑。完整的配置方法见 [Conversation Mode 个人资料](../conversation/profiles.md)。

## Conversation 的位置控制宏

Conversation 模式会自动往提示词里插入好几个内容块。这些宏的作用是让预设把某个块**挪**到宏所在的位置。用了宏之后，Marinara 就在宏的位置渲染这个块，并**跳过**原本的自动插入，内容不会重复。每个宏都有一到多个别名，所有别名的行为完全一样。

| 宏（含别名） | 放置的内容 |
| --- | --- |
| `{{context}}`, `{{status}}` | 对话的上下文 / 状态块。 |
| `{{commands}}`, `{{commandList}}` | 可用命令提醒。 |
| `{{reactRules}}`, `{{emojiReact}}` | 自定义表情的**反应**规则。 |
| `{{replyRules}}` | 自定义表情和贴纸的**回复**规则。 |
| `{{memories}}`, `{{memoryRecall}}` | 记忆功能的内容块。 |
| `{{lorebook}}`, `{{lore}}` | 世界书注入内容。 |

这些宏只在 Conversation 模式下生效。单角色的 Conversation 聊天里，用 `{{char_about}}` / `{{persona_about}}`(见上文) 自己安排参与者简介，道理也一样：Marinara 会跳过自动插入的参与者“about me”块，简介就不会插两遍。群聊仍然保留自动的参与者块，因为这两个宏各自只覆盖一位参与者，不能让其他人的简介被藏起来。

## 上下文相关的宏

这类宏描述的是当前聊天和当前这次请求。

| 宏 | 展开结果 |
| --- | --- |
| `{{input}}` | 提示词能拿到的最近一条用户消息。 |
| `{{model}}` | 当前的模型名称，前提是已经选了模型。 |
| `{{reasoning}}` | 生成这条回复所用的推理等级：`low`、`medium`、`high`、`xhigh` 或 `max`；如果没有要求模型思考，则为 `off`。 |
| `{{chatId}}` | 当前聊天的 ID。 |
| `{{lastGenerationType}}` | 说明这次回复因何而生成的标签。 |
| `{{idle_duration}}` | 距离上次聊天活动过去了多久，形如 `8 minutes` 或 `1 hour 5 minutes`。 |
| `{{gameStoryboardKeyframeCount}}` | Game Mode(游戏模式) 当前的 **Keyframes per Turn**(每回合关键帧数) 目标值，范围 1 到 6，默认是 `3`。 |
| `{{agent::TYPE}}` | 指定类型的智能体保存下来的输出。 |

`{{reasoning}}` 给出的是模型实际收到的等级，即叠加了预设、连接和聊天设置之后的结果。**Maximum** 会显示为该模型接受的最高等级，所以可能读作 `max`、`xhigh` 或 `high`。因为 `off` 会被当作假值，所以 `{{#if reasoning}}` 只在模型思考时才保留其中的块。如果你的预设或聊天里已经有一个名为 `reasoning` 的变量，这个名字归那个变量所有。

`{{lastGenerationType}}` 的值只是一个普通标签。应用里出现过的取值包括 `normal`、`continue`、`regenerate`、`impersonate`、`guided`、`autonomous`、`turn_game`、`preview`、`game_setup`、`lorebook_scan` 和 `retry_agents`。这份清单以后还会变长，所以只当举例看，不是固定集合。

`{{gameStoryboardKeyframeCount}}` 会提供给 Game Mode 的 GM(游戏主持人) 提示词，内置的 **Storyboard Game Prompt** 也在其中。它表示叙事上的目标数量，不是硬性要求必须写这么多段。一个回合里如果没有那么多值得入镜的画面，分镜规划仍然会返回更少的镜头。

`{{agent::TYPE}}` 宏插入的是智能体保存下来的输出。智能体是在后台干活的帮手，比如负责填写场景追踪器。最省事的添加方式是在 **Preset Editor** 里操作：点击 **Add Section**(添加小节)，展开 **Agent Sections** 分组，选一个智能体。Marinara 会创建一个已经带好对应 `{{agent::TYPE}}` 标签的小节。这个宏在最后才解析，所以智能体产出的文字没办法再往提示词里塞新的宏。

## 世界书 Outlet 宏

`{{outlet::name}}` 插入的是世界书条目的内容，条件是这些条目的 **Position**(位置) 设为 **Outlet**，并且 **Outlet name**(Outlet 名称) 与 `name` 完全一致。Outlet 名称区分大小写，比如 `{{outlet::character_rules}}` 匹配不到名为 `Character_Rules` 的 Outlet。

Outlet 条目照常走世界书的激活逻辑。关键词、Constant 模式、概率、筛选、时机、条目数量上限和 Token 预算共同决定一个条目在这次生成里是否激活。Outlet 名称相同的激活条目按各自的 **Order**(排序) 依次拼接，中间用换行分隔。它们只在宏所在的位置插入，不会再额外插到世界书的常规位置。

Outlet 宏可以用在 Conversation、Roleplay 或 Game Mode 的提示词小节里。就算宏出现在预设的世界书标记之前也照样有效；如果只用 Outlet 条目，预设里甚至不需要世界书标记。未知的或者没激活的 Outlet 展开为空。Outlet 条目内部不能再展开另一个 Outlet 宏，所以 Outlet 不会递归嵌套。

## 世界书大小宏

`{{lorebooksize::ID}}` 展开为指定 ID 的世界书条目总数。将 `ID` 替换为世界书实际 ID，可从 Lorebooks 面板复制。例如 ID 为 `V1StGXR8_Z5jdHi6B-myT` 且有 151 个条目时，`{{lorebooksize::V1StGXR8_Z5jdHi6B-myT}}` 展开为 `151`。

未知 ID 展开为 `0`。计数包含所有条目，无论是否启用或位于文件夹中。

可在提示词小节、角色卡字段、世界书条目内容或其他解析宏的位置使用。

<a id="lorebook-include-macro"></a>

## 世界书引入宏

`{{include::ENTRY}}` 会把一个世界书条目的文本放到宏所在的位置。可以把一段共用的文字（比如房规）存在一个条目里，再在其他条目、提示词小节或角色卡里重复使用，这样要改的只有一份。将 `ENTRY` 替换为条目的 ID 或名称。名称不区分大小写。

- 在世界书条目里，名称会在该条目自己所在的世界书中查找。
- 在其他任何地方，名称会在这个聊天使用的世界书中查找：添加到聊天里的世界书、关联到聊天中角色和用户角色的世界书，以及全局世界书。
- 用 ID 可以在任意一本世界书中找到条目。

`{{include::BOOK::ENTRY}}` 从你用 ID 或名称指定的那本世界书里取出条目。这本世界书不必添加到聊天里，甚至不必启用。

```text
{{include::Rules of the arena}}
{{include::Shared lore::Rules of the arena}}
```

被引入的条目不需要激活，也可以是关闭的，所以可以保留一些只用来被引入的条目。被引入文本里的宏照常解析，它也可以再引入其他条目。如果某次引入又绕回到它已经身处其中的条目，比如一个条目引入了自己，这次引入就会展开为空，而不会无限重复下去。找不到的条目或世界书同样展开为空。

名称和 ID 要写成纯文本。写在里面的宏，比如 `{{include::{{char}}}}`，不会被展开。

## 时间宏

每次解析时，所有时间宏读的都是同一个时刻，因此彼此永远一致。时区取自浏览器。

| 宏 | 展开结果 |
| --- | --- |
| `{{date}}` | 当前日期，格式为 `YYYY-MM-DD`。 |
| `{{time}}` | 当前时间，24 小时制，格式为 `HH:MM`。 |
| `{{datetime}}` / `{{isotime}}` | 带时区偏移的完整时间戳。这两个名字含义完全相同。 |
| `{{weekday}}` | 星期名，比如 `Monday`。 |
| `{{timezone}}` | 时区名，比如 `Europe/Warsaw`。 |

## 随机与掷骰宏

这类宏给提示词加入随机性。要随机数或者随机选项，就用随机宏 `{{random}}`；要掷骰子，就用掷骰宏 `{{roll}}`。

| 宏 | 行为 |
| --- | --- |
| `{{random}}` | 0 到 100 之间的随机整数。 |
| `{{random:X:Y}}` | X 到 Y 之间的随机整数，两端都包含。 |
| `{{random::A::B::C}}` | 随机挑一个选项，然后只解析被选中那个选项里的宏。 |
| `{{random::A@2::B@0.5}}` | 带权重的随机选择，权重规则见下文。 |
| `{{roll:XdY}}` | 掷骰的总点数。比如 `{{roll:2d6}}` 掷两个六面骰并求和。 |

下面这段随机选择可以直接复制：

```text
{{random::The door creaks open.::A bell rings.::Someone laughs nearby.}}
```

### 带权重的选择

在选项末尾加一个 `@number`，就能设定它被选中的可能性。这个数字是相对权重，越大越容易被选中。

```text
{{random::Common event@1::Rare event@0.25}}
```

这个例子里总权重是 1.25，所以概率如下：

| 选项 | 权重 | 概率 |
| --- | --- | --- |
| Common event | 1 | 80% |
| Rare event | 0.25 | 20% |

权重规则：

- 没写权重就按 1 算。
- 可以用小数，比如 0.5 或 0.01。
- 权重为 0 的选项仍然保留，但永远不会被选中。
- 所有选项的权重都是 0 时，这个宏展开为空。
- 只有位于末尾的 `@number` 才算权重。出现在别处的 `@`，比如邮箱地址里的那个，不受影响。

## 动态变量

变量的作用是让提示词的前一部分存下一个值，后面的部分再读出来。

| 宏 | 行为 |
| --- | --- |
| `{{setvar::name::value}}` | 存下一个值，在文本里不留任何痕迹。 |
| `{{getvar::name}}` | 读取存下的值（从没设过就是空）。 |
| `{{addvar::name::value}}` | 两个值都是数字时做加法，否则在末尾追加文本。 |
| `{{addnumvar::name::value}}` | Marinara 扩展，始终按数字相加。缺失或无效值按 0 处理，溢出则忽略。 |
| `{{incvar::name}}` | 给数值变量加 1，并插入新值。 |
| `{{decvar::name}}` | 给数值变量减 1，并插入新值。 |

变量在提示词组装时按从左到右的顺序解析，并保存到当前聊天。靠前的位置设好的值，比如排在最前面的那条世界书条目，同一次提示词里后面就能读到。与 SillyTavern 的局部变量一样，它会在后续回合和重启后保留，但不会泄漏到其他聊天。

凡是不属于内置宏的 `{{NAME}}`，都会按名字查找：先查预设变量，再查聊天自身的变量。如果两边都没有这个名字，标签就原样留在文本里，跟你输入的一模一样。两边使用同一个名字时，预设变量优先。预设部分的说明见[预设变量](preset-variables.md)。

### 聊天变量

创建变量不一定要使用 `{{setvar}}`。在 **Chat Settings**(聊天设置)面板的 **Chat Variables**(聊天变量)部分，你可以直接输入名字和值，再把这个名字用在任何支持宏的地方，包括你自己的消息。添加 `char1`，把值设为 `Mary`，再输入 `{{char1}} walks in.`，AI 读到的就是 "Mary walks in."。

需要知道的规则：

- 名字可以包含字母、数字和下划线，而且必须以字母或下划线开头。正好 21 个字符的名字保留给角色引用。带点号或连字符的名字仍然可以用 `{{setvar}}` 设置、用 `{{getvar}}` 读取，但不能直接写成 `{{name}}` 来解析。
- 不能使用内置宏的名字。`{{char}}` 始终代表角色。
- 你自己的消息仍然显示输入的标签。值会在构建提示词时填入，所以以后修改值时，之前用过它的回合也会随之改变。
- 这里也会列出 `{{setvar}}` 设置的变量，因为它们在每个聊天里共用一份存储。

面板本身的介绍见[聊天设置概览](../chats/chat-settings.md)。

## 格式化宏

这类宏用来调整周围文本的形态。

| 宏 | 行为 |
| --- | --- |
| `{{newline}}` / `{{\n}}` | 插入一个换行。 |
| `{{trim}}` | 删掉自身，并去掉这个位置前后的空白。 |
| `{{trimStart}}` | 去掉所在文本开头的空白。 |
| `{{trimEnd}}` | 去掉所在文本结尾的空白。 |
| `{{uppercase}}...{{/uppercase}}` | 把包住的文字变成全大写。 |
| `{{lowercase}}...{{/lowercase}}` | 把包住的文字变成全小写。 |
| `{{noop}}` | 从输出里移除。编辑过程中拿来当无害的占位符很方便。 |
| `{{// comment}}` | 作者注释，会从输出里移除。 |
| `{{banned "text"}}` | 从输出里移除。它不会过滤或者屏蔽任何东西。 |

## 让双大括号原样显示

宏没有转义字符。想让双大括号留在文本里，就用一个 Marinara 不认识的名字。只要既没有同名的预设变量，也没有同名的聊天变量，任何未知的 `{{name}}` 都会原样保留。如果需要一段永远不会发给 AI 的私人备注，改用 `{{// like this}}`。

## Macro reference 与 /macros

每个支持宏的输入框，角落里都有两个小按钮：

- **Expand editor**(展开编辑器) 会为这个字段打开一个更大的编辑窗口。
- **Macro reference**(宏速查) 会打开一个标题为 **Macro reference** 的窗口，按分类列出全部内置宏和它们的准确写法。这份列表由引擎使用的同一份源数据生成，所以永远准确。

也可以在聊天输入框里输入 `/macros`(简写 `/macro` 同样有效)。完整的宏列表会直接打印在聊天里，方便随时对照。

条件块里可以用 `||`(或)、`&&`(与) 和小括号组合多个比较。判断相等时还能用紧凑写法 `{{#if character == "Maukie" || "Pantalone"}}`。优先级、群聊示例和完整的运算符清单见[条件提示词](conditional-prompts.md)。

条件也能向 Decision 模型询问场景：是/否使用 `{{#if decision:"The latest message moves the scene to a new place"}}`，多选一使用 `{{#if decision_choice:"The kind of scene in the latest message" == "combat"}}`。没有模型或没有答案时都按否处理。见[询问 Decision 模型](conditional-prompts.md#asking-the-decision-model)。陈述后加 `sticky:3 cooldown:5` 可保持是 3 回合，再休息 5 回合；见 [Sticky 与 Cooldown](conditional-prompts.md#sticky-and-cooldown)。加 `until:"..."` 或 `while:"..."`，只要第二条陈述允许，就一直保持是；见 [Until 与 While](conditional-prompts.md#until-and-while)。`every:3` 只每 3 回合询问一次，`priority:high` 或 `priority:low` 决定哪些陈述进入提示词计划；见[每隔几回合检查](conditional-prompts.md#checking-every-few-turns)、[优先级](conditional-prompts.md#priority)和[限制与成本](conditional-prompts.md#limits-and-cost)。

## 常见错误

- 不要在 `{{random::...}}` 块里写变量。放在随机选项里的 `{{setvar}}` 会在选择发生之前对每个选项都跑一遍，而不是只跑被选中的那个。
- 不要把局部变量当成全局变量。`{{setvar}}` 设置的值只在当前聊天中保留，其他聊天各有自己的值。
- 提示词章节或世界书条目执行 `{{setvar}}` 时，会覆盖同名的聊天变量，因为两者在每个聊天里共用一份存储。如果想保留两者，请使用不同的名字。
- `{{prompt}}` 不是宏。如果整条消息就是 `{{prompt}}`，Marinara 不会把它发出去，而是打开 **Peek Prompt** 查看器。见 [Peek Prompt](../chats/peek-prompt.md)。
- Custom Tools 不认 `{{macro}}` 这种写法。别把 `{{roll:1d20}}` 粘进工具的字段里，指望它会解析。
- **Impersonate**(代写) 提示词模板只接受少数几个占位符，不是完整的宏列表。它用的名字也不一样，所以在角色卡里能用的宏，放到那里未必有效。
- 体量过大或者嵌套过深的宏输出会被静默截断。不会有任何报错，所以宏展开的规模要控制在合理范围内。

## 相关指南

- [条件提示词](conditional-prompts.md)
- [预设变量](preset-variables.md)
- [预设编辑器与提示词管理器](presets.md)
- [Peek Prompt](../chats/peek-prompt.md)
- [创建和编辑角色](../characters/creating-and-editing-characters.md)
- [Conversation Mode 个人资料](../conversation/profiles.md)
