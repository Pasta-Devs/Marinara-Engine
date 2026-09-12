# 生成参数

本指南介绍 Marinara Engine 里的生成参数。这些设置决定 AI 每次回复的写法，比如 **Temperature**(温度) 和 **Max Output Tokens**(最大输出 Token 数)。它们按聊天单独设置，位置在 **Advanced Parameters**(高级参数) 面板里。

## 生成参数的作用

生成参数就是采样设置，决定模型怎么把提示词变成文字。它不改变你对 AI 说的内容，只改变 AI 回话的方式。

举个例子，有的参数让回复更随机、更有创意，还有的参数决定模型一次最多能写多长。大多数人根本不用碰这些，默认值在日常聊天和角色扮演里都够用。

只有想解决某个具体问题时才去改这些设置。本指南末尾列出了常见问题，以及每种问题该先试哪个参数。

## 在哪里找到它们

基础值在 **Presets > Parameters**(预设 → 参数) 中编辑，连接值在 **Connections > Default Parameters**(连接 → 默认参数) 中编辑。聊天覆盖值在 **Chat Settings > Advanced Parameters**(聊天设置 → 高级参数) 中设置。

1. 打开要修改的聊天。
2. 打开 **Chat Settings**(聊天设置)，也就是当前聊天的齿轮图标。
3. 找到 **Advanced Parameters** 一节，点击展开。

展开后能看到一条说明：“Override generation parameters for this chat. Only change these if you know what you're doing.”下面讲到的每一项设置都在 **Advanced Parameters** 里面。

**Advanced Parameters** 在每种聊天模式里都有（Conversation、Roleplay 和 Game）。

## 每个参数的大白话解释

每个数值参数都有一个输入框和自己的开关。这个开关决定该参数是否发送给模型，下一节会详细说明。

**Temperature** 控制随机性，取值 0 到 2。数值越低，回复越集中、越好预测；数值越高，回复越有创意、变化越多。1 附近是常见的折中值。

**Max Output Tokens** 决定模型一轮最多能写多长的回复。Token 是模型切分文本的最小单位，大致相当于一个短单词或单词的一部分。回复老是被截断，就把它调大。输入框里没有固定上限。

**Top P** 又叫核采样，取值 0 到 1。模型只从累计概率达到这个值的那批最可能的词里挑选。数值越低，回复越集中。设为 1 表示让模型考虑所有词。

**Top K** 限制模型每一步只在概率最高的若干个词里选，取值 0 到 500。设为 0 就是关闭这个限制。不少服务商会忽略这项设置。

**Frequency** 按一个词已经出现的次数施加惩罚，出现越多惩罚越重，取值 -2 到 2。正值能减少用词重复。这就是频率惩罚，应用里显示为 **Frequency**。

**Presence** 只要一个词出现过就施加惩罚，不管出现了多少次，取值 -2 到 2。正值会推着模型转向新话题。这就是存在惩罚，应用里显示为 **Presence**。

**Frequency** 和 **Presence** 合起来就是重复惩罚。

**Reasoning Effort**(推理强度) 告诉具备思考能力的模型，在回答之前要推理到什么程度。所谓具备思考能力的模型，就是会先在隐藏步骤里把问题想一遍的模型。可选项有 **None**、**Low**、**Medium**、**High**、**Xhigh** 和 **Maximum**。如果模型不支持选中的档位，Marinara 会自动降到该模型允许的最高档。

参数开关开启时，**None** 会明确要求服务商关闭思考，而不只是省略强度设置。这个关闭指令是各家服务商专有的，Marinara 只会把它发给已知支持的模型。有些模型强制推理，思考关不掉，仍然可能返回推理内容；确实不想要思考过程，就换一个不带推理的模型。把参数开关本身关闭是另一回事：那样不会发送任何推理偏好，服务商的默认行为保持不变。

**Verbosity**(详细度) 控制回复应该多长、多详细。可选项有 **None**、**Low**、**Medium** 和 **High**。**Low** 让回复保持简短，**High** 鼓励更长、描写更多的回复。只有部分模型会用到这项设置。

## Send 开关

每个数值参数，加上 **Reasoning Effort** 和 **Verbosity**，名字旁边都有一个小开关。这个开关在应用里没有文字标签，本指南把它叫作 Send 开关。把鼠标停在上面，会显示“This parameter is sent to the model”或者“This parameter is not sent to the model.”

某个参数的 Send 开关开启时，Marinara 会把这个参数放进发给服务商的请求里。开关关闭时，Marinara 完全不发这个参数，服务商就用自己的默认值。

关闭 Send 开关和把值设成 1 或 0 不是一回事。值设成 1，等于明确告诉服务商用 1。关闭开关则什么都没告诉，交给模型自己决定。

服务商说两项设置不能同时使用时，就用 Send 开关，关闭其中一个再试。报错说某个参数不被接受或者必须提供时，也用得上：不被接受就关闭它的开关，必须提供就开启。

在聊天的 **Advanced Parameters** 里，只有 **Max Output Tokens** 和 **Reasoning Effort** 的 Send 开关默认开启，其余默认关闭。

## 默认值

新建的聊天从一套内置基线开始。下表列出这些起始值，以及每一项是否默认发送。

| 参数 | 起始值 | 默认发送 |
|---|---|---|
| Temperature | 1 | 否 |
| Max Output Tokens | Conversation 里是 4096，Roleplay 和 Game 里是 8192 | 是 |
| Top P | 1 | 否 |
| Top K | 0(关闭) | 否 |
| Frequency | 0 | 否 |
| Presence | 0 | 否 |
| Reasoning Effort | Maximum | 是 |
| Verbosity | High | 否 |

即使 **Send** 开关处于关闭状态，输入框里也照样显示这个值，只是在打开开关之前不会发送出去。

## Assistant Prefill

**Assistant Prefill**(助手预填) 是可选的一段文字，加在 AI 回复的最开头，紧接在你的消息之后。大多数人都留空。

只有支持预填或固定开头标签的模型才用得上。比如可以照着占位文字里的样子输入一个开始标签，强制模型以某种方式起头。不确定是否需要，就留空。

## Assistant Reasoning Prefill

**Assistant Reasoning Prefill**(助手推理预填) 是一段可选的隐藏文字，加在 AI 推理的最开头，位于它写出可见回复之前。大多数人都留空。

只有支持单独推理预填的模型才用得上，比如 Kimi K3。它可以和 **Assistant Prefill** 一起使用：一个为模型的隐藏推理起头，另一个为显示出来的回复起头。不确定模型是否支持，就留空。

## Thinking Tags

**Thinking Tags**(思考标签) 告诉 Marinara，某个模型在纯文本里是怎么标记隐藏推理的。有些模型会用标签把推理包起来。Marinara 认得这些标签，就能把推理藏到 **View thoughts**(查看思考) 操作后面，而不是直接显示在回复里。

每行写一组包裹标记，中间留一个位置放隐藏文字。think、thinking、thought、pipe、channel 以及成对括号这些常见写法已经内置识别。只有用了少见包裹方式的模型才需要填这个框。

## Custom Parameters

**Custom Parameters**(自定义参数) 用来添加 Marinara 没有单独做成输入框的原始设置。你输入一个 JSON 对象，Marinara 会把它合并进发给服务商的请求。

作为连接默认值保存的 Custom Parameters，会跟着这个连接用在所有走 API 的文本生成上，包括 Conversation、Roleplay、Game、Noodle、摘要和智能体。跑在自己电脑上的自定义端点同样如此。按聊天设置的 Custom Parameters 只作用于那个聊天，并且会覆盖连接层同名的键。

这是个高级选项。键写错会让服务商直接拒绝整个请求。对象里必须用小写的 `true`、`false` 和 `null`。除非某家服务商的文档明确要求加某个键，否则留空。

## OpenRouter Service Tier

**OpenRouter Service Tier**(OpenRouter 服务档位) 只在聊天所用的连接是 OpenRouter 服务商时才出现。它决定 OpenRouter 怎么路由你的请求。可选项有 **Default**、**Flex** 和 **Priority**。**Flex** 可能更便宜、更慢，**Priority** 可能更快、更贵。**Default** 不发送任何档位。

## 上下文消息数限制

**Limit Context Messages**(限制上下文消息数) 控制发给模型的聊天记录有多少。开启之后只发送最近 N 条消息，而不是整段聊天。

开启时计数从 50 起步，可以填 1 到 9999 之间的任意数字。数字越小，发送的历史越少，能省钱也能加快速度，但 AI 对更早内容的记忆也随之变少。这项设置默认关闭。

## Exclude Past Reasoning

**Exclude Past Reasoning**(排除历史推理) 默认开启。它会把此前几轮保存下来的思考和推理挡在新提示词之外，那些推理不会再发给模型。

关闭此选项后会显示 **Past reasoning blocks**(历史推理块数)。默认值 `1` 保留最近一个可用的助手推理块；`0` 包含所有可用的推理块。这个选择会保存到当前聊天，再次启用排除时也不会丢失。它不会删除已保存的思考。只有当前连接支持的推理内容才能再次发送。

除非有明确理由要把旧推理重新喂给模型，否则保持开启。

## Image Captioning

**Image Captioning**(图像描述) 改变 AI 处理图片附件的方式。开启后，Marinara 会用你指定的连接把每张附件图片描述成文字，而不是把图片本身发出去。

看不了图的模型就用这个。开启后，在 **Captioning Connection**(描述用连接) 下拉菜单里选一个连接。指到不合适的连接上，纯文本端点可能会失败。这项设置默认关闭。

## Save as Connection Default

在 **Advanced Parameters** 底部，**Save as Connection Default**(保存为连接默认值) 按钮会把当前的参数值写到连接本身上。之后凡是用这个连接新建的聊天，都从这些值开始。

这个按钮只对正常保存的连接出现，随机连接池和内置本地模型下不显示。

它下面的 **Reset to Defaults**(恢复默认值) 按钮会清掉这个聊天的所有参数改动，恢复聊天继承的设置。

## 默认值如何分层覆盖

参数按字段逐项确定，顺序如下：

1. 所选预设的 **Parameters**(参数)；不使用预设时，采用内置生成默认值（温度 `1`，最大输出 `4096`）。在 Roleplay 中，连接的预设覆盖设置优先于聊天选择的预设。
2. 连接的 **Default Parameters**(默认参数)。
3. 当前聊天的 **Advanced Parameters**。
4. 模式规则：正在进行的场景聊天将输出设为 `8192`、推理设为 **Maximum**、详细程度设为 **High**。Game Mode 将输出设为 `16384`、推理设为 **Maximum**、温度/top-p 设为 `1`，并将 top-k、min-p 和重复惩罚设为 `0`。Game Mode 中的 Gemma 连接保留自己的采样设置，输出预算至少为 `16384`。
5. 输出限制：Game Mode 会应用模型已知的输出上限，连接的 **Max Output Tokens override**(最大输出 Token 覆盖值) 则在所有模式中限制请求。可用上下文还可能进一步缩小输出预算。

参数旁的 **Effective**(有效值) 一行显示保存的值和优先采用的设置层，包括模式规则和输出上限。连接编辑器会以当前打开且使用该连接的聊天为准；没有打开聊天时，使用 Roleplay 的基线。保存修改后，显示值才会更新。关闭 Send 开关时会显示 **not sent**，但提供商仍可能强制要求某些参数，或调整不支持的值。Custom Parameters 和上下文适配还可能进一步改变最终请求。

例如，预设为 `8192`，当前聊天为 `16384`，就会显示 **Effective: 16384 · this chat**。如果连接的输出上限为 `4096`，显示会变成 **Effective: 4096 · output token cap**。重置聊天参数会恢复下一层适用的设置，不会移除预设或模式规则。

## 有些模型会忽略部分参数

不是每个模型都接受每个参数。Marinara 知道某个模型会拒绝某项设置时，就把这项从请求里去掉。滑块或输入框在应用里照样显示，但对那个模型来说，改了也没有效果。

这在某些推理和思考类模型上很常见，它们会拒绝 temperature 之类的采样设置。某项设置看着毫无作用，很可能就是模型不接受。模型行为还高度取决于选了哪个模型，同一个值在不同模型上的感受可能差很多。

如果用的是每次都可能换模型作答的自动路由模型，参数表现会一轮一轮地变。固定用某一个具体模型，行为才稳定。

## 按症状调参

大多数人从来不改这些。想试的话，一次只改一项，这样才看得出是哪一项起了作用。

- 回复读着生硬或者翻来覆去：把 **Temperature** 稍微调高，比如从 1 调到 1.1 到 1.3 之间。
- 回复读着混乱或者跑题：把 **Temperature** 调低，比如调到 0.7 到 0.9 之间。
- 回复写到一半被截断：把 **Max Output Tokens** 调大。
- 角色反复用同一套措辞：把 **Frequency** 或 **Presence** 稍微调高，比如调到 0.3 到 0.6 之间。

这些只是经验法则，不是经过测试的推荐值。不同模型反应不同，在一个连接上好用的值，换个连接不一定还管用。

想确切知道某条消息实际发送了哪些参数，用 **Peek Prompt**。它会显示组装好的提示词，还有模型、temperature、最大 Token 数、推理强度等信息。

## 相关指南

- [预设编辑器与提示词管理器](presets.md)
- [Peek Prompt：查看 AI 收到的内容](../chats/peek-prompt.md)
- [连接 AI 服务商](../connections/connecting-to-a-provider.md)
