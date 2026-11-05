# 条件提示词（{{#if}}）

`{{#if}}` 块只在条件成立时才放入某段提示词。用它可以让一套共用预设针对不同的角色、用户角色或聊天给出不同的指令，也可以省掉空着的字段。条件块属于宏系统，所以凡是能用[宏](macros.md)的地方都能用：角色卡、用户角色、世界书条目和预设。

每次拼装提示词，Marinara 都会重新判断条件，留下符合条件的文字，其余全部丢掉。这是一项进阶功能，大多数聊天根本用不到。

## 基本写法

条件块以 `{{#if condition}}` 开头，以 `{{/if}}` 结尾。条件不成立时的内容放在 `{{else}}` 后面，要串联更多条件就用 `{{else if}}`。Marinara 从上往下逐个分支判断，保留第一个成立的分支。如果所有条件都不成立，又没有写 `{{else}}`，整个块就什么都不留下。

```text
{{#if length == "short"}}
Keep your reply to one or two sentences.
{{else if length == "long"}}
Write a detailed, multi-paragraph reply.
{{else}}
Write a reply of normal length.
{{/if}}
```

一个块可以写在一行里，也可以分成好几行写，块与块之间还能嵌套。

## 运算符

条件通常由左值、运算符、右值三部分组成，例如 `char == "Alice"`。

| 运算符 | 含义 |
| --- | --- |
| `==`、`=`、`is` | 相等。 |
| `!=`、`is not` | 不相等。 |
| `>`、`<`、`>=`、`<=` | 大于、小于、大于或等于、小于或等于（仅限数字）。 |
| `contains`、`includes` | 左值的文本里含有右值。 |
| `not contains`、`not includes` | 左值里不含右值。 |

比较规则：

1. 用相等类运算符时，如果两边看上去都是数字，Marinara 就按数字比较，所以 `5` 等于 `5.0`。否则按文本比较，且忽略大小写，所以 `Mari` 等于 `mari`。
2. 用 `>`、`<`、`>=` 和 `<=` 时，两边必须都是数字，否则条件不成立。
3. `contains` 和 `includes` 忽略大小写，所以 `contains "dr"` 能匹配 `Dr Smith`。

### 组合条件

OR 用 `||`，AND 用 `&&`。`&&` 先于 `||` 求值。想自己指定判断顺序，就加括号。

```text
{{#if character == "Maukie" || character == "Pantalone"}}
Use the shared instructions.
{{/if}}

{{#if (character == "Maukie" || character == "Pantalone") && scenario contains "lake"}}
Use the lakeside instructions for either character.
{{/if}}
```

同一个值要和好几个选项比相等时，可以省略重复的左值：`character == "Maukie" || "Pantalone"`。这种简写适用于 `==`、`=` 和 `is`。`&&` 两边要写完整的条件。

### 真值判断

不写运算符的条件，在值里有实际内容时成立。值为空，或者是 `false`、`0`、`no`、`off`、`null`、`undefined` 中的任何一个（不论大小写）时，条件不成立。

```text
{{#if scenario}}
Current scene: {{scenario}}
{{else}}
No specific scene is set.
{{/if}}
```

### 可以拿来比较的东西

条件的左边或右边可以是：

1. 字段或身份关键词，例如 `char`、`user`、`group`、`persona`、`description`、`personality`、`scenario`、`input`、`model` 或 `reasoning`。它们读取的值和同名的宏一致。`group` 列出其他在场角色，不含本次回复者。
2. 带引号的字面值，例如 `"Alice"`。
3. 预设变量名，例如 `length`。见[预设变量](preset-variables.md)。
4. 显式变量查找，写作 `var:name` 或 `var.name`。
5. 另一个宏，它会先被解析。
6. 向 Decision 模型提出的问题：`decision:"..."` 或 `decision_choice:"..."`。见[询问 Decision 模型](#asking-the-decision-model)。

不是关键词的裸词会被当作变量名。要是没有同名变量，就把它当作纯文本。给字面值加引号可以避免混淆。

### 引号规则

固定文字用直双引号或直单引号括起来。引号内部用反斜杠转义引号，用 `\n` 表示换行。带空格的字面值一定要加引号，例如 `"Dr Smith"`。不加引号的多词值会被当成一个变量名。

## 面向多角色的分组块

在有两个或更多角色的群聊里，分组块会为每个角色把里面的文字重复一遍。写法是：单独一行写 `[`，接着写正文，再单独一行写 `]`。块里必须包含角色宏，例如 `{{char}}` 或 `{{description}}`，或者包含基于角色的条件。

```text
[
{{char}}'s current attitude:
{{#if char == "Alice"}}cheerful and open{{else}}guarded and quiet{{/if}}
]
```

有 Alice 和 Bob 两个角色时，这个块会跑两遍，每个角色一遍。在分组块之外，角色宏只针对当前角色或主角色解析。单角色聊天里，`[` 和 `]` 所在的行会原样保留为普通文本。

## 示例

按角色区分语气：

```text
{{#if char == "Dottore"}}
Speak in a cold, clinical tone.
{{else}}
Speak warmly and casually.
{{/if}}
```

只在字段填了内容时才带上它。**Backstory**(背景故事) 为空时，整个块什么都不留下，也就不会送出一个空标题。

```text
{{#if backstory}}
Backstory to remember: {{backstory}}
{{/if}}
```

针对某一系列模型的指令。`model` 是模型 ID，例如 `claude-opus-5-5`，所以 `contains` 会匹配所有 Opus 版本，而 `==` 只匹配某一个确切的模型。

```text
{{#if model contains "opus"}}
Keep replies under 400 words.
{{/if}}
```

取决于是否思考的规划指令。只要推理开着，无论哪个等级，模型都会收到第一行。推理关闭时，`{{reasoning}}` 是 `off`，会被当作假值。想只针对某一个等级生效，就拿它做比较，例如 `{{#if reasoning == "max"}}`。

```text
{{#if reasoning}}
Plan the reply in your thinking before you write it.
{{else}}
Before replying, write your plan inside <plan></plan> tags.
{{/if}}
```

<a id="asking-the-decision-model"></a>

## 询问 Decision 模型

条件可以向你的 Decision 模型询问聊天里正在发生什么。Decision 模型是一个小模型，它读取最近几条消息和你写的陈述，判断陈述是否为真。它从不往聊天里写内容。这样，预设、角色卡、世界书条目或智能体提示词就能只在适用的回合发送某条指令。

开始之前：先在 **Connections**(连接) 面板的 **Decision model**(判定模型) 下选好一个 Decision 模型。它是什么、怎么挑，见 [Decision 模型](../connections/decision-models.md)。要决定整个世界书条目是否激活，改用条目的 [Decision](../lorebooks/entries.md#decision-activation) 字段。

可以这样用：只在场景转移时才描述新地点，只在战斗期间载入战斗节奏规则，在慢热预设里暂缓升级，或者在分组块里只让被搭话的角色直接回答。

### 是或否：`decision:`

```text
{{#if decision:"The latest message moves the scene to a new place"}}
Open your reply by describing the new location in one or two sentences.
{{/if}}
```

Decision 模型认定陈述为真时，条件为真。它可以和 `{{else}}`、`&&`、`||`、括号、嵌套以及分组块一起用。陈述里的宏会先展开，所以可以用 `{{user}}` 和 `{{char}}`。在分组块里，含 `{{char}}` 的陈述会对每个角色分别询问一次。

### 多选一：`decision_choice:`

`decision_choice:` 让模型从几个选项里选一个。选项就是你拿来和它比较的那些值。

```text
{{#if decision_choice:"Kaelen's mood in the latest message" == "angry"}}
Kaelen's lines are short and clipped.
{{else if decision_choice:"Kaelen's mood in the latest message" == "sad"}}
Kaelen speaks quietly and looks away.
{{else}}
Kaelen is his usual self.
{{/if}}
```

这里模型在“angry”“sad”和“none of these”之间选择。陈述写成一个主题，选项写成简短答案。简写 `== "rain" || "snow"` 会提供两个选项。

想说明某个选项在你的故事里是什么意思，就在它后面加上判断标准，用冒号隔开，两部分要用同一种引号：`== "angry":"Kaelen raises his voice, makes threats or breaks something"`。模型仍然回答“angry”。如果同一个选项在几处给了不同的判断标准，以最先出现的那组为准。

<a id="sticky-and-cooldown"></a>

### Sticky 与 Cooldown

在陈述后面加上 `sticky:` 和 `cooldown:`，就能把答案保留几回合，不必每回合都询问。

```text
{{#if decision:"The latest message starts a fight" sticky:3 cooldown:5}}
Keep combat pacing rules in effect.
{{/if}}
```

- `sticky:N`：得到是以后，接下来 N 个回合陈述保持为是，不再询问。
- `cooldown:N`：在 sticky 结束时开始，或者在得到是之后立即开始。接下来 N 个回合，陈述按否处理，也不询问。
- 一个回合是 Decision 模型读取的一条新消息。同一条消息的重新生成或备选回复属于同一回合，所以重抽回复不会消耗计时。
- 被保持的陈述不询问，也不计入 **Decision statements per turn**(每回合判定陈述数)。
- 对 `decision_choice:`，sticky 保留所选的选项，cooldown 让每个比较都按否处理。
- 同一陈述写在多处时，使用最长的 sticky 和 cooldown。
- Peek Prompt 显示被保持的答案，绝不会推进计时。

通过 **Decision** 字段激活的世界书条目，改用条目自己的 **Sticky** 和 **Cooldown**。

<a id="until-and-while"></a>

### Until 与 While

想让一个块在某件事持续期间一直生效，就加上 `until:` 或 `while:` 和第二条陈述。

```text
{{#if decision:"A fight starts in the latest message" until:"The fight ends in the latest message"}}
Keep combat pacing rules in effect.
{{/if}}
```

- 得到是以后，块保持生效，不再询问第一条陈述，改为每回合询问 `until` 陈述。它为真的那个回合，块停止生效。
- `while:` 正好相反：它的陈述为真时块保持生效，为假时停止生效。
- 两者只用其一。如果都写了，只有写在前面的那个有效。
- 块停止生效后，cooldown 照常开始。某个回合没有得到答案时，块保持生效。
- `until` 或 `while` 陈述计入 **Decision statements per turn**。块生效期间，第一条陈述不计入。
- 它适用于 `decision:`，不适用于 `decision_choice:`。

配合 **sticky** 时，在第二条陈述后面加 `:and`(也可写 `:restrict`) 或 `:or`(也可写 `:extend`)，决定两者如何共同作用。

| 写法 | 得到是以后，块保持生效 |
| --- | --- |
| `until:"..." sticky:5` 或 `until:"...":and sticky:5` | 最多再 5 个回合；until 陈述为真时提前停止生效。 |
| `until:"...":or sticky:5` | 至少再 5 个回合，之后持续到 until 陈述为真。 |
| `while:"..." sticky:5` 或 `while:"...":or sticky:5` | 至少再 5 个回合，之后只要 while 陈述为真就继续生效。 |
| `while:"...":and sticky:5` | 最多再 5 个回合；while 陈述为假时提前停止生效。 |

<a id="checking-every-few-turns"></a>

### 每隔几回合检查

加上 `every:N`，陈述就只每 N 个回合询问一次。

```text
{{#if decision:"The weather changes in the latest message" every:3}}
Describe the new weather in a sentence.
{{/if}}
```

- 首次遇到该陈述的回合询问，再过 3 个回合再次询问，以此类推。两次检查之间按否处理，不询问，也不计入 **Decision statements per turn**。
- 重新生成或备选回复不会推进计划。
- sticky 和 cooldown 仍然会保持答案。`every:` 只决定何时询问未被保持的陈述。
- 同一陈述写在多处时，使用最小的 `every:`。

<a id="priority"></a>

### 优先级

提示词计划里的陈述超过 **Decision statements per turn** 的额度时，由 `priority:high` 或 `priority:low` 决定询问哪些。不写优先级就是中等。

```text
{{#if decision:"In the latest message, a character is badly hurt" priority:high}}...{{/if}}
{{#if decision:"The latest message mentions food" priority:low}}...{{/if}}
```

- 高优先级的陈述先询问，低优先级的最后询问。同一优先级内，按陈述在提示词中的顺序决定。
- 超出限制的陈述按否处理，从最低优先级开始，并列在 Peek Prompt 里。
- 同一陈述写在多处时，使用最高的优先级。
- 先规划提示词自身的陈述（预设、角色卡、用户角色、作者注）。世界书陈述无论优先级如何，都只能用剩下的名额。

所有修饰符都可以按任意顺序组合：`decision:"..." priority:high sticky:3 cooldown:5 every:2`。

### 没有答案就是否

只要没有答案，判定条件就是假：没有设置 Decision 模型、模型没有及时回答，或者调用失败。对 `decision_choice:`，每个比较都是假。设计时要考虑这一点。

- 用判定来增减指导内容，绝不要用它承载故事必不可少的内容。
- 给每个判定块一个默认值：什么都不输出，或者一个在任何回合都合适的 `{{else}}`。
- 不要串联判定，免得一个错误答案改变其他好几个判定。
- 不要用判定控制同意、内容警告或安全指令。

任何模型都可能答错。按“一个 Decision 模型”来写，不要针对某一款产品。

<a id="writing-statements"></a>

### 编写陈述

- 像报告里的一行文字那样，陈述一个非真即假的事实。不要写成问题（“Did the scene change?”），也不要写成指令（“If the scene changed, describe it”）。小模型常常对指令回答否，这样块就永远不会运行。
- 指当前回合时，写明“in the latest message”。模型会读取好几条消息，更早的某一条可能让它回答是。
- 点明说的是谁。“He is angry”可能被理解成错误的角色。
- 描述文本里看得见的内容，例如一个动作或一句台词。避免氛围词（“The scene is intense”）和隐藏意图（“Mira is lying”）。
- 保持简短。想复用或调试的话，把长陈述拆成几部分。

测试措辞的方法：

1. 在 **Decision model** 下选择一个模型，点击 **Test**(测试)。这会用固定样本检查连接，不会测试你的陈述。
2. 把陈述加进提示词，分别发送它应为真和应为假的消息。
3. 用 **Peek Prompt** 查看发送的是哪个分支。打开 **Decision diagnostics**(决策诊断)，再选择 **Test decisions**(测试决策)，无需生成回复就能拿到新的答案。托管测试可能收费。见[测试 Decision 语句](../chats/peek-prompt.md#testing-decision-statements)。
4. 调整措辞后再测一次。要查看实际生成时的答案，开启 Debug Mode 或[调试日志](../CONFIGURATION.md#logging-levels)。

<a id="limits-and-cost"></a>

### 限制与成本

<a id="statement-allowance"></a>

#### 陈述额度

**Decision model** 下的 **Decision statements per turn** 默认是 32。它不是所有 Decision 请求或花费的统一上限。Marinara 分阶段应用它。

1. 主聊天提示词的陈述在额度内规划。世界书判定使用剩下的部分。
2. 在回复之前或与回复同时运行的智能体，会和主提示词合并规划，再次使用这份额度。这个阶段不扣除世界书已用的部分，所以总量可能超过设置值。
3. 后处理智能体在回复之后获得一份独立额度。

智能体激活问题和 Smart 回复顺序独立于这项设置。

只有某个阶段用得上的陈述才会进入它的计划：已启用的预设小节和分组、选中的变量选项，以及已激活世界书条目的内容。固定条件可以排除陈述，例如角色是 Mira 时的 `{{#if char == "Dottore" && decision:"..."}}`。变量条件不会，因为变量可能在组装提示词时变化。被 sticky、cooldown 或 `every:` 保持的陈述不占名额。被排除的陈述按否处理。

#### 请求与耗时

用托管的 Decision 账号时，一个回合可能发出多个计费请求。陈述可以批量处理，但世界书激活、新激活条目的内容、递归匹配和智能体阶段可能需要更多批次。本地聊天模型增加的是处理时间而不是费用，它回答 `decision_choice:` 时，每个选项问一个是/否问题。

每个请求都有时限：托管 Decision 账号默认 1.5 秒，兼容 OpenAI 的聊天模型账号或本地模型为 4 秒。见[时限](../connections/decision-models.md#time-limits)。本地推理模型在回复之前不作判定，除非开启 **Also gate agents that run before the reply**(也判定回复前运行的智能体)。

<a id="answer-reuse"></a>

#### 答案复用

Marinara 通常会在同一回合、同一 Decision 模型下复用成功的答案，所以重新生成往往不发新请求就送出同样的分支。缓存存在于运行中的服务器里，最多保存 200 个回合。重启、缓存被移出、新增或编辑过的最新消息、换了模型，或者陈述或选项集合有改动，都可能需要新答案。

缺失或失败的答案不会缓存，所以重试时可以再次询问，并走另一个分支。智能体提示词里的陈述遵守同样的规则。手动重新运行智能体时，会复用对应输入仍在缓存中的答案。见[智能体提示词中的判定陈述](../agents/custom-agents.md#decision-statements-in-the-agents-prompt)。

<a id="prompt-caching"></a>

#### 提示词缓存

服务商的提示词缓存与 Marinara 的答案缓存是两回事。它可以复用发给聊天模型的提示词中没有变化的开头部分。改变一个判定分支，可能让从那里开始的部分无法复用，不过更早且没有变化的部分仍可能符合条件。计费方式取决于服务商。

经常变化的判定块放在提示词靠后的位置，例如历史之后的指令或较浅深度的作者注。只有答案很少变化时，才把判定留在靠前的位置。预设变量选项也一样，因为它们的文字会出现在 `{{name}}` 所在的位置。

直连 Anthropic 的账号开启 **Enable prompt caching**(启用提示词缓存) 时，Marinara 会标记系统提示词的末尾，以及从最新消息往前数第 **Cache depth**(缓存深度) 条的那条聊天消息（默认 5）。历史之前的改动可能让系统边界和之后的历史失效。标记的历史边界之后的改动，可以保留已缓存的部分。最小缓存长度因模型而异。见服务商最新的 [Anthropic 提示词缓存指南](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)或 [OpenAI 提示词缓存指南](https://developers.openai.com/api/docs/guides/prompt-caching)。

<a id="when-a-decision-branch-never-appears"></a>

### 判定分支始终不出现时

可能的原因，按可能性排序：

1. 没有设置 Decision 模型。所有判定条件都是假。编辑器会在使用判定的字段下面显示警告。
2. Decision 模型没有回答：托管账号的密钥错误、没有额度或被限流，本地模型已停止或太慢，或者已安装的判定模型没有启动。
3. 它是推理模型，在回复之前不作判定。
4. 规划阶段的陈述太多，超过了额度。
5. 它回答了，但低于阈值。这通常是措辞的问题。

看看 **Test** 报告了什么，再用 **Peek Prompt** 查看实际发送的分支。它会列出还没有答案的陈述，这些陈述按否处理。日志级别设为 debug 时，会记录每条陈述、它的答案以及是否读作是。见[日志级别](../CONFIGURATION.md#logging-levels)。要改的地方很少在预设里，通常是措辞，或者某个分支承载了提示词不可缺少的内容。

## 相关指南

- [Decision 模型](../connections/decision-models.md)
- [提示词宏](macros.md)
- [预设变量](preset-variables.md)
- [群聊与 Conversation 模式群聊](../chats/group-chats.md)
