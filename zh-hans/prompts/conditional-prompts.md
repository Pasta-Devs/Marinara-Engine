# 条件提示词（{{#if}}）

本指南介绍 Marinara Engine 里 `{{#if}}` 块的用法。条件块的作用是：只有当某个值符合你设定的规则时，才把一段提示词（Marinara Engine 发给 AI 的那段文字）放进去。条件块属于宏系统的一部分，因此凡是能用宏的地方都能用，包括角色卡、用户角色、世界书条目和提示词预设。

## 条件提示词能做什么

宏是形如 `{{double-brace}}` 的占位符，Marinara Engine 在拼装提示词时会把它替换成当前的真实值。条件块更进一步：先判断一个值，再从几段文字里留下一段，其余全部丢掉。

你写好一个条件、条件成立时使用的文字，以及（可选的）条件不成立时使用的文字。每次拼装提示词，Marinara 都会重新判断一次条件。也就是说，同一张卡、同一套预设，面对不同的角色、不同的用户角色、不同的聊天，表现可以完全不同。

常见用法之一，是在一套共用预设里写针对特定角色的指令。另一种常见用法，是只在某个字段有内容时才把它带上，免得给模型送去一个空标题。

## 基本写法

条件块以 `{{#if condition}}` 开头，以 `{{/if}}` 结尾。中间的所有文字，就是条件成立时使用的内容。

```
{{#if condition}}
Text used when the condition is true.
{{/if}}
```

需要处理不成立的情况时，可以加一个 `{{else}}` 分支：

```
{{#if condition}}
Text used when true.
{{else}}
Text used when false.
{{/if}}
```

还可以用 `{{else if}}` 串联更多条件。Marinara 从上往下逐个分支判断，保留第一个条件成立的分支，解析该分支内部的宏，其余分支一律丢弃。如果所有条件都不成立，又没有写 `{{else}}`，整个块就什么都不留下。

```
{{#if length == "short"}}
Keep your reply to one or two sentences.
{{else if length == "long"}}
Write a detailed, multi-paragraph reply.
{{else}}
Write a reply of normal length.
{{/if}}
```

一个块可以像上面那样分成好几行写，也可以写在一行里。条件块之间还能嵌套，把一个条件块放进另一个更大的条件块的某个分支里。

## 支持的运算符

条件通常由左值、运算符、右值三部分组成，例如 `char == "Alice"`。下表列出全部可用的运算符，一律以代码样式显示。

| 运算符 | 含义 |
| --- | --- |
| `==`、`=`、`is` | 相等。 |
| `!=`、`is not` | 不相等。 |
| `>` | 大于（仅限数字）。 |
| `<` | 小于（仅限数字）。 |
| `>=` | 大于或等于（仅限数字）。 |
| `<=` | 小于或等于（仅限数字）。 |
| `contains`、`includes` | 左值的文本里含有右值。 |
| `not contains`、`not includes` | 左值的文本里不含右值。 |

比较的具体行为遵循以下几条规则：

1. 用 `==`、`=`、`is`、`!=`、`is not` 时，如果两边看上去都是数字，Marinara 就按数字比较，所以 `5` 等于 `5.0`。否则按文本比较，且忽略大小写，所以 `Mari` 等于 `mari`。
2. 用 `>`、`<`、`>=`、`<=` 时，两边必须都是数字。只要有一边不是数字，条件就不成立。
3. 用 `contains`、`includes`、`not contains`、`not includes` 时，匹配忽略大小写，所以 `contains "dr"` 能匹配到文本 `Dr Smith`。

## 用 OR 和 AND 组合条件

任意一个条件成立即可，用 `||`；所有条件都必须成立，用 `&&`。

```
{{#if character == "Maukie" || character == "Pantalone"}}
Use the shared Maukie and Pantalone instructions.
{{/if}}

{{#if characters contains "Maukie" && characters contains "Pantalone"}}
Both characters are present in this chat.
{{/if}}
```

`&&` 先于 `||` 求值。想自己指定判断顺序时，加括号：

```
{{#if (character == "Maukie" || character == "Pantalone") && scenario contains "lake"}}
Use the lakeside instructions for either character.
{{/if}}
```

同一个值要和好几个选项比相等时，`||` 后面重复的左值可以省略：

```
{{#if character == "Maukie" || "Pantalone"}}
Use the shared instructions.
{{/if}}
```

这种简写等同于 `character == "Maukie" || character == "Pantalone"`，只对相等运算符 `==`、`=`、`is` 有效。`&&` 两边则要写完整的条件，毕竟一个值通常不可能同时等于两个不同的选项。

### 真值判断（不写运算符）

条件里不写运算符时，Marinara 做的是真值判断，也就是问一个很简单的问题：这个值里到底有没有实际内容？

```
{{#if scenario}}
Current scene: {{scenario}}
{{else}}
No specific scene is set.
{{/if}}
```

值不为空，并且不是 `false`、`0`、`no`、`off`、`null`、`undefined` 这几个词中的任何一个，真值判断才成立。词的比对忽略大小写。只想在某个字段填了内容时才带上一段文字，就用真值判断。

### 可以拿来比较的东西

条件的左边或右边可以是下面这几种：

1. 字段或身份关键词，例如 `char`、`user`、`group`、`persona`、`description`、`personality`、`scenario`、`input`、`model`。它们读取的值和同名的宏完全一致。`group` 列出的是当前聊天中除本次回复者以外的其他在场角色。
2. 带引号的字面值，例如 `"Alice"`。
3. 预设变量名，例如 `length`。预设变量是在 Prompt Preset 里自己定义的具名值，详见[预设变量](preset-variables.md)。
4. 写成 `var:name` 或 `var.name` 的显式变量查找。
5. 另一个宏，它的值会先解析出来，再参与比较。
6. 向 Decision 模型提出的问题，写作 `decision:"..."` 或 `decision_choice:"..."`。见[询问 Decision 模型](#asking-the-decision-model)。

如果写了一个光秃秃的词，而它又不是关键词，Marinara 会把它当成变量名。要是找不到同名变量，就把这个词本身当作纯文本。给字面值加引号可以避免这种混淆，拿不准的时候就加上引号。

## 引号规则

要和一段固定的文字做比较，就给它加引号。这等于告诉 Marinara：把它当作确切的字面值，不是关键词，也不是变量。

```
{{#if char == "Dottore"}}
Speak in a cold, clinical tone.
{{/if}}
```

直双引号和直单引号都可以。Marinara 也接受弯引号，但直引号最稳妥，也和应用内的所有示例一致。引号内部可以用反斜杠转义引号，还可以用 `\n` 表示换行。

字面值里带空格时一定要加引号，例如 `"Dr Smith"`。不加引号的多词值会被当成一个变量名，这几乎肯定不是你想要的结果。

## 面向多角色的分组块

在有两个或更多角色的群聊里，分组块会把同一段文字按角色逐个重复一遍。这样只写一个块，就能描述场景中的每一个角色。

写分组块的方法是：单独一行只写一个 `[`，接着写正文，最后单独一行只写一个 `]`。块里必须包含角色宏，例如 `{{char}}` 或 `{{description}}`，或者包含基于角色的条件，例如 `{{#if char == "Alice"}}`。Marinara 会按角色数量重复这个块，并依次针对每个角色解析里面的角色宏。

```
[
{{char}}'s current attitude:
{{#if char == "Alice"}}cheerful and open{{else}}guarded and quiet{{/if}}
]
```

在 Alice 和 Bob 的群聊里，这个块会跑两遍。第一遍填入 Alice 的名字并选中属于她的分支，第二遍填入 Bob 的名字并选中属于他的分支。在分组块之外，角色宏只针对当前角色或主角色解析。

分组块只在有两个或更多角色的聊天里展开。单人聊天中，`[` 和 `]` 所在的行会原样保留为普通文本。

## 实例演示（处理前后对照）

下面是三个完整示例，同时给出模型最终收到的内容。

在共用预设里给特定角色定制语气：

```
{{#if char == "Dottore"}}
Speak in a cold, clinical tone.
{{else}}
Speak warmly and casually.
{{/if}}
```

角色名为 `Dottore` 时，模型收到的是 `Speak in a cold, clinical tone.`；换成其他任何角色，模型收到的都是 `Speak warmly and casually.`

只在字段填了内容时才带上它：

```
{{#if backstory}}
Backstory to remember: {{backstory}}
{{/if}}
```

角色填了 **Backstory**(背景故事)，模型就会收到这一行以及背景故事的正文。**Backstory** 输入框为空时，整个块什么都不留下，也就不会送出一个空标题。

匹配用户名的一部分：

```
{{#if user contains "Dr"}}
Address the user as Doctor.
{{/if}}
```

用户角色的名字里含有 `Dr`，模型就会被要求称呼你为 Doctor；没有的话，这个块什么都不留下。

<a id="asking-the-decision-model"></a>

## 询问 Decision 模型

条件也能向 **Decision model**(判定模型) 询问聊天里发生了什么。使用的是 Connections 面板里 **Decision model** 下选择的模型：已经运行的本地模型、托管 Decision 连接或已安装的判定模型。它读取最近几条消息和你写的陈述，判断陈述是否为真。它从不往聊天里写内容。[Decision 模型](../connections/decision-models.md)介绍它是什么以及如何选择。

这样，预设、角色卡、世界书条目或智能体提示词只在适用的回合发送指示，不必每回合都发送“如果 X 发生，就做 Y”。要决定整个世界书条目是否激活，而不只是裁减文本，改用条目的 [Decision](../lorebooks/entries.md#decision-activation) 字段。可以这样用：

- **场景变化。** 只有场景确实移动时，才描述新地点或时间跳跃。
- **场景类型。** 只有正在发生对应场景时，才载入战斗、亲密或紧张节奏规则。
- **先回答问题。** `{{#if decision:"In the latest message, {{user}} asks a direct question"}}Answer it before anything else.{{/if}}`
- **角色卡情绪。** 角色卡可以保存“慌乱时”或“生气时”的行为，只在最近消息显示这些状态时出现。
- **节奏控制。** 慢热预设可以在关系明显推进之前暂缓升级指示。
- **群体场景。** 分组块里的 `{{#if decision:"{{char}} is addressed in the latest message"}}` 只指示被搭话角色的小节直接回答。

### 是或否：`decision:`

```
{{#if decision:"The latest message moves the scene to a new place"}}
Open your reply by describing the new location in one or two sentences.
{{/if}}
```

Decision 模型认定陈述为真时，条件为真。它可以和本指南的其他功能组合：`{{else}}`、`{{else if}}`、`&&`、`||`、括号、嵌套和分组块。

```
{{#if char == "Dottore" && decision:"In the latest message, {{user}} says something that contradicts what they said earlier"}}
Dottore notices the inconsistency and files it away.
{{/if}}
```

陈述里的宏先展开，所以支持 `{{user}}` 和 `{{char}}`。在分组块里，含 `{{char}}` 的陈述会对每位角色分别询问一次。

### 多选一：`decision_choice:`

`decision_choice:` 让 Decision 模型选一个选项。选项来自提示词中任何位置与它比较的值：

```
{{#if decision_choice:"Kaelen's mood in the latest message" == "angry"}}
Kaelen's lines are short and clipped.
{{else if decision_choice:"Kaelen's mood in the latest message" == "sad"}}
Kaelen speaks quietly and looks away.
{{else}}
Kaelen is his usual self.
{{/if}}
```

这里模型从“angry”“sad”和“none of these”中选择。也支持简写：`decision_choice:"The weather in the latest message" == "rain" || "snow"` 会提供两个选项。陈述写成主题，例如“Kaelen's mood in the latest message”，选项写成简短答案。

<a id="sticky-and-cooldown"></a>

### Sticky 与 Cooldown

陈述可以保留答案几回合，不必每回合询问。在陈述后写 `sticky:` 和 `cooldown:`：

```
{{#if decision:"The latest message starts a fight" sticky:3 cooldown:5}}
Keep combat pacing rules in effect.
{{/if}}
```

- **sticky:N.** 得到是以后，接下来 N 个回合不再询问，继续保持是，因此它控制的内容留在提示词里。
- **cooldown:N.** sticky 结束后开始；没有 sticky 时，在得到是后立即开始。持续 N 个回合按否处理且不询问，之后再询问。
- 一个回合是 Decision 模型读取的一条新消息。同一消息的重新生成或备选回复属于同一回合，所以重抽回复不会消耗计时。
- sticky 或 cooldown 保持陈述时，不询问也不计入 **Decision statements per turn**(每回合判定陈述数)，把额度留给其他陈述。
- 对 `decision_choice:`，sticky 保留所选选项，cooldown 让所有比较都按否处理。选择“都不符合”不会启动任何计时。
- 同一陈述写在多处时，使用各处指定的最长 sticky 和 cooldown。
- Peek Prompt 显示保持的答案，绝不会推进计时。

结合使用适合出现一次后暂停的内容：场景转换、一次性提醒，或应持续几回合的情绪。通过 **Decision** 字段激活的世界书条目，改用条目自己的 **Sticky** 和 **Cooldown**：sticky 条目不再询问也会保留，cooldown 条目不会询问。

<a id="checking-every-few-turns"></a>

### 每隔几回合检查

部分陈述不必每回合询问。在后面写 `every:`，即可每 N 个回合才询问一次：

```
{{#if decision:"The weather changes in the latest message" every:3}}
Describe the new weather in a sentence.
{{/if}}
```

- 首次遇到该陈述的回合询问，再过 3 个回合再次询问，以此类推。
- 修改数值立即生效：下次检查从上次询问的回合开始计数。
- 两次检查之间按否处理，不询问，也不计入 **Decision statements per turn**。
- 回合计数与 sticky 和 cooldown 相同，重新生成或备选回复不会推进计划。是否复用答案遵守[答案缓存规则](#answer-reuse)。
- sticky 和 cooldown 仍然保持陈述的答案；`every:` 只决定何时询问未被它们保持的陈述。
- 同一陈述写在多处时，使用各处指定的最小 `every:`。

<a id="priority"></a>

### 优先级

提示词计划里的陈述超过 **Decision statements per turn** 的额度时，由 `priority:` 决定询问哪些。额度会在[多个阶段](#statement-allowance)应用：

```
{{#if decision:"In the latest message, a character is badly hurt" priority:high}}...{{/if}}
{{#if decision:"The latest message mentions food" priority:low}}...{{/if}}
```

- 先询问 `priority:high`，最后询问 `priority:low`。没有优先级的陈述按中等处理。
- 同一优先级内仍按陈述在提示词中出现的顺序决定。
- 超过限制时，先丢弃最低优先级的陈述；它们按否处理，并列在 Peek Prompt 里。
- 同一陈述写在多处时，使用各处指定的最高优先级。
- 先规划提示词自身的陈述（预设、角色卡、用户角色、作者注）。扫描确定哪些世界书条目激活后，再用剩余额度规划其文本里的陈述，因此世界书陈述无论优先级多高，都不会抢走提示词陈述的额度。

所有修饰符都可任意排序组合：`decision:"..." priority:high sticky:3 cooldown:5 every:2`。

### 没有答案就是否

没有设置 Decision 模型、模型未及时回答或发生失败时，判定条件都是 **false**。对 `decision_choice:`，所有比较均为 false。因此没有 Decision 模型的用户会得到 `{{else}}` 分支，或者什么都没有。

设计时要考虑这一点：

- 用判定**增减指导内容**，不要承载故事必不可少的内容。漏掉分支应当只让回复少一些针对性，而不是破坏它。
- 每个判定块都应有合理默认值：不输出内容，或使用任何回合都合适的 `{{else}}`。
- 不要串联判定，避免一个错误答案改变其他多个判定。
- 不要用判定控制同意、内容警告或安全指示。始终保留这些内容。

任何模型都可能答错。按“一个 Decision 模型”编写，不要写成“必须使用 Jev”：本地聊天模型也能回答这些陈述。语法通用，但不同模型的答案和准确度可能不同。

<a id="writing-statements"></a>

### 编写陈述

以下建议来自本地聊天模型及 Open-Jev 2B、9B 的测试：

- 像报告里的一行文字那样，**陈述一个非真即假的事实**。不要写成问题（“Did the scene change?”）或指示（“If the scene changed, describe it”）。本地聊天模型每次都对指示回答否，因此块从未运行。
- 指当前回合时，**写明“in the latest message”**。模型读取多条消息，“Mira asks questions”曾因之前的消息提出过问题而被答为是。
- **点明主体是谁。** “He is angry”曾被理解成错误的角色。
- **描述文本里可见的内容**，例如行为或说过的话，不要用需要模型解释的氛围词（“The scene is intense”）或隐藏意图（“Mira is lying”）。
- 保持简短。普通的“and”和否定句在测试中都正常，因此选择自然的写法即可。

测试措辞的方法：

1. 在 **Decision model** 下选择模型并点击 **Test**(测试)。这使用固定样本检查连接，不会测试你的陈述或读取当前聊天。
2. 把陈述加入提示词，发送有代表性的聊天消息，既包括应为真的情况，也包括应为假的情况。
3. 用 **Peek Prompt** 检查发出的分支。如果需要陈述的概率和是/否结果，启用[调试日志](../CONFIGURATION.md#logging-levels)。
4. 调整措辞后重测。测试新案例时要用新消息或修改陈述，因为成功答案可能会[复用](#answer-reuse)。打开新的 Peek Prompt 预览不会询问模型。

关于测试结果：每种措辞都在 Open-Jev 2B、Open-Jev 9B 和 Gemma 4 E4B 本地模型上，用四个带标签的角色扮演回合测试（两个应为是，两个应为否）。这只是一个场景的小样本，不是通用准确度基准，也不是托管 Jev 的测试。表格记录样本中的观察，不保证其他模型或聊天得到相同结果。

| 推荐写法 | 避免写法 | 避免写法的实际结果 |
| --- | --- | --- |
| The latest message moves the scene to a new place. | Did the scene change? | 疑问句使 Open-Jev 2B 在应为“否”的回合也超过阈值。本地模型未受影响。 |
| In the latest message, a character draws a weapon or attacks someone. | The scene is intense. | 三个模型都把激烈争吵称为“intense”。使用模糊词时，词义由模型决定，而不是由你决定。 |
| In the latest message, Mira asks Kaelen a direct question. | Mira asks questions. | Mira 的最新消息没有提问，但之前提过，因此本地模型和 Open-Jev 9B 回答是。 |
| Kaelen is angry in the latest message. | He is angry. | 本地模型把“he”理解成了生气的酒馆老板。 |
| In the latest message, Mira says something that contradicts what she said earlier. | Mira is lying. | 没有模型能可靠地把矛盾判断成撒谎。 |
| The latest message moves the scene to a new place. | If the scene changed, describe the new location in two sentences. | 本地模型每次都对指示回答否，因此块从未运行。 |
| Someone is injured in the latest message. | A fight starts and someone is injured and the city guards arrive. | 处理正确。不过拆开仍更容易复用和调试。 |
| In the latest message, the characters stay in the same place. | The characters did not leave the room. | 没有差别。选择自然的写法即可。 |

推荐措辞在 Open-Jev 2B、Open-Jev 9B 和本地模型上分别答对 32 题中的 31、31 和 32 题。避免措辞分别为 26、25 和 24 题。这些小样本结果用于说明措辞选择；判断哪个模型适合聊天，应使用自己的案例。

<a id="limits-and-cost"></a>

### 限制与成本

<a id="statement-allowance"></a>

#### 陈述额度

**Decision model** 下的 **Decision statements per turn** 默认是 32。虽然名称如此，它不是所有 Decision 请求或支出的全局统一上限。Marinara 分阶段应用它：

1. 主聊天提示词的陈述在额度内规划。世界书判定随后使用该计划剩下的额度。
2. 对回复前或与回复并行的智能体，Marinara 将主提示词陈述与这些智能体的提示词陈述合并规划，再次使用配置的额度。此阶段不扣除世界书之前的使用量，因此总量可能超过设置。
3. 后处理智能体在回复之后获得独立额度。其陈述读取已完成的回复。

智能体**激活问题**和 **Smart 回复顺序**独立于此设置。

只有当前阶段能用的陈述才进入计划：已启用的预设小节和分组、选中的变量选项，以及已激活世界书条目的内容。固定条件可以排除陈述：角色为 Mira 时，不会询问 `{{#if char == "Dottore" && decision:"..."}}`。变量可能在组装提示词时变化，因此变量条件不会提前排除陈述。

由 [sticky、cooldown](#sticky-and-cooldown) 或 [`every:`](#checking-every-few-turns) 保持的陈述不占额度。[优先级](#priority)决定哪些陈述能进入提示词计划。世界书激活在逐个考虑条目时使用剩余额度。被排除的陈述按否处理，并在 Peek Prompt 中列出。

#### 请求与耗时

托管 Decision 连接在一个回合可能发出多个付费请求。陈述可以批处理，但世界书激活、新激活条目内容、递归匹配和智能体阶段可能需要更多批次。激活问题按 Scan Depth 和阶段分批；Smart 顺序使用独立请求。陈述额度不是请求次数或金额上限。

本地聊天模型增加的是处理时间，而非托管费用。它用每个选项一个是/否问题回答 `decision_choice:`，因此一次选择可能需要多次补全。

每个请求都有[时限](../connections/decision-models.md#time-limits)：Decision 连接默认 1.5 秒，本地后端使用自己的预算。多个请求可能累计出更长等待。必须先推理的本地模型会暂缓回复前的判定，除非开启 **Also gate agents that run before the reply**(也判定回复前运行的智能体)。

<a id="answer-reuse"></a>

#### 答案复用

成功答案通常在同一回合、同一 Decision 模型下复用，所以重新生成经常无需额外请求就发送同样的分支。缓存存在于运行中的服务器，最多保存 200 个回合键。重启或缓存移除可能导致再次请求。新增或编辑最新消息、更换模型、修改陈述或选择题的选项集合，也可能需要新答案。

缺失或失败的答案不会缓存成成功的否答案：重试同一回合可以再次询问，并采用不同分支。Sticky/cooldown 计时独立于此答案缓存。

智能体提示词陈述遵守同样的复用规则。生成前/并行智能体读取回复前的回合；后处理智能体读取完成的回复，因此更换备选回复可能需要新答案。手动重新运行智能体会复用仍缓存着的对应输入的成功答案。见[智能体提示词中的判定陈述](../agents/custom-agents.md#decision-statements-in-the-agents-prompt)。

<a id="prompt-caching"></a>

#### 提示词缓存

服务商的**提示词缓存**独立于 Marinara 的 Decision 答案缓存。它可以复用发给聊天模型的提示词中未变化的前缀。更改判定分支可能阻止从该处开始的复用；更早且未变化的前缀仍可能符合条件。具体可复用部分和计费取决于服务商、缓存边界、最小长度和缓存寿命。

**把会变化的判定块放在提示词后面**，例如历史之后的指示或较浅深度的作者注。靠前的变化可能损失大部分缓存节省。只有答案很少变化、指示确实应在前面时才保留在开头。预设变量选项也一样：文本会出现在 `{{name}}` 所在的位置。

直接 Anthropic 连接启用 **Enable prompt caching**(启用提示词缓存) 时，Marinara 标记系统提示词末尾，以及从最新消息往前数 **Cache depth**(缓存深度) 条的消息（默认 5）。历史之前的变化可能使系统边界和后续历史失效，不过更早匹配的前缀仍可能复用。标记的历史边界之后发生变化，可以保留该缓存前缀。两个边界之间的变化可以保留系统前缀，但丢失部分历史缓存。缓存读取和写入的价格不同。

最小缓存长度和支持的边界因模型而异，也可能变化。具体细节和计费规则请查服务商最新的 [Anthropic 提示词缓存指南](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)或 [OpenAI 提示词缓存指南](https://developers.openai.com/api/docs/guides/prompt-caching)。

<a id="when-a-decision-branch-never-appears"></a>

### 判定分支始终不出现时

用户报告判定分支从不出现时，按可能性排序的原因是：

1. **没有设置 Decision 模型。** 每回合的所有判定条件均为 false。编辑器会在使用判定的字段下面显示警告。
2. **Decision 模型没有回答。** 托管连接密钥错误、无额度或限流；本地模型停止或慢于预算；已安装的判定模型未启动。
3. **它是推理模型，**暂缓回复之前的判定。
4. **相关规划阶段的陈述太多，**超过额度。
5. **它回答了，但低于阈值。** 通常是措辞问题，或模型给该回合的评分低于预期。

询问用户选择了哪个 Decision 模型，以及 **Test** 的结果。**Peek Prompt** 显示实际发送的分支。必须构建新预览时，它会列出尚无答案的判定陈述，并在预览中按否处理。日志级别设为 debug 后，会记录每条陈述、答案及是否读作是，见[日志级别](../CONFIGURATION.md#logging-levels)。

问题很少在预设本身。如果是，通常是措辞，或某个分支承载了提示词不能缺少的内容。

## 相关指南

- [Decision 模型](../connections/decision-models.md)
- [提示词宏](macros.md)
- [预设变量](preset-variables.md)
- [群聊与 Conversation 模式群聊](../chats/group-chats.md)
