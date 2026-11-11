# 生成参数

生成参数是控制模型怎么写每条回复的设置，比如 **Temperature**(温度) 和 **Max Output Tokens**(最大输出 Token 数)。预设和账号提供默认值，**Chat Settings**(聊天设置) 里的 **Advanced Parameters**(高级参数) 一节可以为单个聊天覆盖这些值。默认值在日常聊天和角色扮演里都够用，所以只有想解决某个具体问题时才去改。

## 在哪里找到它们

| 内容 | 位置 |
| --- | --- |
| 预设的起始值 | **Presets**(预设)，打开一个预设，**Parameters**(参数) 选项卡 |
| 账号上保存的值 | **Connections**(连接)，打开该账号，**Chat defaults**(聊天默认值) 一节 |
| 单个聊天的覆盖值 | **Chat Settings**，**Advanced Parameters** 一节 |

预设不设置上下文或输出 Token 上限。上下文窗口在 **Connections** 里设置，输出上限在 **Connections** 或 **Advanced Parameters** 里设置。旧版预设文件仍可加载，但其中保存的 Token 上限会被忽略。内置的 **Marinara's Universal Preset**(Marinara 通用预设) 不提供任何生成参数。

为单个聊天覆盖参数：

1. 打开聊天。
2. 打开 **Chat Settings**。
3. 找到 **Advanced Parameters**，点击展开。
4. 找到要改的参数，比如 **Temperature**，输入新值。
5. 看看参数名旁边的小开关。如果它是关闭的，就把它打开。开关关闭的参数不会发送，你的修改也就不起作用。**Temperature** 的开关初始是关闭的（见 [Send 开关](#the-send-switch)）。

你会看到一条说明：“Change generation settings for this chat only. Leave these alone unless you know what they do.”**Advanced Parameters** 在 Conversation(对话模式)、Roleplay(角色扮演) 和 Game(游戏模式) 聊天里都有。

## 每个参数的大白话解释

每个数值参数都有一个输入框和一个 Send 开关（见下文）。

| 参数 | 作用 | 范围 |
| --- | --- | --- |
| **Temperature** | 随机性。数值越低，回复越集中、越好预测；越高越有创意。1 附近是常见的折中值。 | 0 到 2 |
| **Max Output Tokens** | 模型一轮最多能写多长的回复。Token 是文本的小片段。回复被截断时就调大。 | 没有固定上限 |
| **Top P** | 模型只从累计概率达到这个值的那批最可能的词里挑选。设为 1 表示考虑所有词。 | 0 到 1 |
| **Top K** | 限制模型每一步只在概率最高的若干个词里选。设为 0 就是关闭。很多服务会忽略它。 | 0 到 500 |
| **Frequency** | 一个词已经出现得越多，惩罚越重。正值能减少用词重复。 | -2 到 2 |
| **Presence** | 只要一个词出现过就施加惩罚。正值会推着模型转向新话题。 | -2 到 2 |

**Frequency** 和 **Presence** 就是重复惩罚。

**Reasoning Effort**(推理强度) 告诉具备思考能力的模型（也就是会先在隐藏步骤里把问题想一遍的模型）回答之前要推理到什么程度。可选项有 **Off**(关闭)、**Low**、**Medium**、**High**、**Extra high** 和 **Maximum**。如果模型不支持你选的档位，Marinara 会把它降到该模型允许的最高档。选定模型之后，按钮会以该模型实际得到的级别命名，所以 **Maximum** 可能显示为 **Max**、**Extra high** 或 **High**。

- Send 开关开启时，如果已知模型支持，**Off** 会要求服务关闭思考。有些模型关不掉思考，仍然可能返回推理内容。确实不能有思考过程时，就换一个不带推理的模型。
- Send 开关关闭时，不会发送任何推理偏好，服务使用它自己的默认值。

**Verbosity**(详细度) 设定回复应该多长、多详细：**None**、**Low**、**Medium** 或 **High**。只有部分模型会用到它。

## 调参技巧

一次只改一项，这样才看得出是哪一项起了作用。这些只是经验法则，不同模型的反应也不同。

| 问题 | 试试 |
| --- | --- |
| 回复读着生硬或者翻来覆去 | 把 **Temperature** 稍微调高，调到 1.1 到 1.3 之间。 |
| 回复读着混乱或者跑题 | 把 **Temperature** 调低，调到 0.7 到 0.9 之间。 |
| 回复被截断 | 调大 **Max Output Tokens**。 |
| 角色反复用同一套措辞 | 把 **Frequency** 或 **Presence** 稍微调高，调到 0.3 到 0.6 之间。 |

想知道某条消息发送了哪些参数，用 **Peek Prompt**(查看提示词)。它会显示组装好的提示词，还有模型、temperature、最大 Token 数、推理强度等信息。

<a id="the-send-switch"></a>

## Send 开关

每个数值参数，加上 **Reasoning Effort** 和 **Verbosity**，名字旁边都有一个小开关。它没有文字标签。把鼠标停在上面，会显示“This parameter is sent to the model”或者“This parameter is not sent to the model.”

- 开启：Marinara 会把这个参数放进请求里。
- 关闭：Marinara 不发送这个参数，服务使用它自己的默认值。这和把值设成 0 或 1 不同，设成某个值仍然是在告诉服务该用什么。

服务说两项设置不能同时使用时（关闭其中一个），或者报错说某个参数不被接受（关闭它）或必须提供（开启它）时，就用这个开关。

在聊天的 **Advanced Parameters** 里，默认只发送 **Max Output Tokens** 和 **Reasoning Effort**。

## 默认值

下面是编辑器显示的值，不一定就是发送的值。没有预设时，生成从 4096 个输出 Token 开始，再应用账号和聊天的覆盖值。进行中的场景可以使用 8192。**Effective**(有效值) 一行显示最终解析出的值。

| 参数 | 起始值 | 默认发送 |
| --- | --- | --- |
| Temperature | 1 | 否 |
| Max Output Tokens | Conversation 中为 4096，Roleplay 中为 8192；Game 不覆盖 | 是 |
| Top P | 1 | 否 |
| Top K | 0(关闭) | 否 |
| Frequency | 0 | 否 |
| Presence | 0 | 否 |
| Reasoning Effort | Maximum | 是 |
| Verbosity | High | 否 |

Send 开关关闭时，输入框里照样显示这个值。打开开关之前，它不会被发送。

## 预填与思考标签

**Assistant Prefill**(助手预填) 是一段可选的文字，加在 AI 回复的最开头。除非模型支持，否则留空。

- 它是最后发送的内容，排在你的消息以及其后的所有指令之后。
- 如果聊天以一条 AI 回复结尾，并且 **Post-Processing Messages**(消息后处理) 设为 **Apply**(应用)，预填会加到那条回复的末尾。
- 有些模型会拒绝以 AI 自己的话结尾的提示词，**Claude (Subscription)** 不管用哪个模型都是如此。对这些模型，Marinara 会改为把预填加到 AI 上一条回复的开头，所以新回复不会以它开头。
- 在还没有 AI 回复的聊天里，预填会作为你的消息放在最后发送。

**Assistant Reasoning Prefill**(助手推理预填) 是一段可选的隐藏文字，加在 AI 推理的最开头，位于可见回复之前。只在支持单独推理预填的模型上使用它，比如 Kimi K3。它可以和 **Assistant Prefill** 一起使用。

**Thinking Tags**(思考标签) 告诉 Marinara 某个模型在纯文本里怎样标记隐藏的推理，这样它就能把推理藏到 **View model thoughts**(查看模型思考过程) 后面。每行写一组包裹标记，中间留一个位置放隐藏文字。think、thinking、thought、pipe、channel 以及成对括号这些常见写法已经内置识别。只有遇到少见的包裹方式才需要填这一项。

## Custom Parameters

**Custom Parameters**(自定义参数) 用来添加 Marinara 没有单独提供字段的原始设置。输入一个 JSON 对象，Marinara 会把它合并进请求。

- 作为账号默认值保存时，凡是使用这个账号的文本生成都会发送它们，包括 Conversation、Roleplay、Game、Noodle、摘要、智能体和已安装的智能体资源包。跑在你自己电脑上的自定义端点也包括在内。
- 按聊天设置的 Custom Parameters 只加到那个聊天里，并且会覆盖账号上同名的键。
- 键写错可能让服务拒绝请求。要用小写的 `true`、`false` 和 `null`。除非某个服务的指南让你加某个键，否则留空。

## Service Tier

**Service Tier**(服务档位) 只在聊天所用的账号是 OpenRouter 或 NanoGPT 时才出现。它决定服务怎样路由你的请求。**Default**(默认) 不发送任何档位。**Flex** 可能更便宜、更慢。**Priority** 可能更快、更贵。

## 上下文消息数限制

**Limit Context Messages**(限制上下文消息数)（也标作 **Context message limit**(上下文消息上限)）只发送最近 N 条消息，而不是整段聊天。它默认关闭。开启后，计数从 50 起步，可以设为 1 到 9999。数字越小，费用越低、速度越快，AI 记住的内容也越少。

在开启了 **Advanced Memory Recall**(高级记忆功能) 的 Roleplay 聊天里，这个限制不起作用。Advanced Memory Recall 用 **Maximum allowed context before compression (tokens)**(压缩前允许的最大上下文 Token 数) 决定发送多少历史。想少发一些，就到 **Chat Settings → Memory Recall**(聊天设置 → 记忆功能) 里调低那项设置。参见 [Advanced Memory Recall](../agents/memory.md#advanced-memory-recall-roleplay-and-game-mode)。

## Exclude Past Reasoning

**Exclude Past Reasoning**(排除历史推理) 默认开启。它会把此前几轮保存下来的推理挡在新提示词之外。除非有明确理由要把旧推理重新喂给模型，否则保持开启。

关闭它后会显示 **Past reasoning blocks**(历史推理块数)。默认值是 1，保留最近一个可用的推理块。设为 0 则包含所有可用的推理块。这不会删除已保存的思考内容，而且只有当前账号支持的推理才能再次发送。

## Image captioning

**Image captioning**(图像描述) 让 Marinara 用另一个模型把每张附件图片描述成文字，而不是把图片本身发出去。看不了图的模型就用它。它默认关闭。

1. 在 **Advanced Parameters** 里开启 **Image captioning**。
2. 在 **Captioning model**(描述用模型) 下拉菜单里选一个模型。
3. 可选：编辑 **Captioning Prompt**(图像描述提示词)，也就是随每张图片一起发送的指令。点重置按钮或清空输入框，就会恢复默认值。这段提示词只保存在当前聊天里，**Save as Connection Default**(保存为连接默认值) 也不会复制它。

如果没有成功：图像描述失败时（比如描述用的账号坏了、被删除了或者什么都没返回），回复会中止，并报 **Image captioning failed** 错误。Marinara 不会改为发送图片本身。修复或更换描述用模型，或者关闭 **Image captioning**。

## Save as Connection Default

在 **Advanced Parameters** 底部，**Save as Connection Default** 会把你当前的值写到账号上。之后使用这个账号的新聊天都从这些值开始。它只对已保存的普通账号显示，随机连接池和内置模型下会隐藏。

**Reset to Defaults**(恢复默认值) 会清掉这个聊天的所有改动，让聊天回到继承的设置。继承的 Send 开关跟随所选账号。你自己改过的 Send 开关会一直作为聊天覆盖设置保留，直到你重置为止。

## 默认值如何分层覆盖

Marinara 按下面的顺序确定每个参数。后面的项会覆盖前面的项。

1. 预设的 **Parameters**，不使用预设时则用内置默认值。输出从 4096 Token 开始，因为预设无法设置输出上限。在 Roleplay 中，账号的预设覆盖设置优先于聊天选择的预设。
2. 账号的 **Chat defaults**。
3. 当前聊天的 **Advanced Parameters**。
4. 模式规则。进行中的场景聊天会把输出设为 8192、推理设为 **Maximum**、详细度设为 **High**。Game 使用账号和聊天保存的参数，不强制设置采样、推理或最小输出长度。
5. 输出上限。Game 会应用模型已知的输出上限，账号的 **Max output tokens override**(最大输出 Token 数覆盖) 在所有模式下限制请求。可用上下文还可能进一步缩减预算。

参数旁边的 **Effective** 一行显示最终胜出的值，以及它来自哪一层，例如 **Effective: 16384 · this chat**；账号上限生效时则显示 **Effective: 4096 · output token cap**。关闭的 Send 开关会显示 **not sent**。服务仍然可能强制要求某些参数，或者调整不支持的值。Custom Parameters 和上下文适配也可能改变最终请求。重置聊天参数只会移除这个聊天的覆盖值（第 3 项）。之后如果账号设置了 **Chat defaults**，值就来自它，否则来自预设。模式规则和输出上限（第 4 和第 5 项）之后仍然适用。

<a id="parameters-for-agents"></a>

## 智能体参数

智能体调用使用其运行账号上保存的 **Chat defaults**：智能体自己有账号就用它的，没有就用聊天的账号。Send 开关和模型限制的规则与聊天回复相同。除了下面的温度规则，预设和聊天的 **Advanced Parameters** 都不会改变智能体调用。

- **发送给智能体的设置**：Temperature、Top P、Top K、Frequency、Presence、Reasoning Effort、Verbosity、Service Tier、Custom Parameters、自定义请求头，以及依次打开 **Settings**(设置)、**Advanced**(高级)、**Parameters** 后添加的额外参数（例如 Top A 或种子）。Send 开关关闭的参数不会发送。
- **不发送给智能体的设置**：Max Output Tokens、停止序列、预填、Thinking Tags 和其他提示词格式设置。每个智能体保留自己的 **Max Output Tokens**。
- **Temperature**：智能体使用账号的温度，没有保存值时使用 0.7。Beholder 始终使用 0，Illustrator 的提示词编写器使用自己的值。生成聊天回复期间，使用聊天账号的智能体会沿用聊天最终确定的温度和 Send 开关。重试时使用账号保存的值。
- **Reasoning Effort**：你选的级别或 **Off**，会应用到该账号上所有模型支持它的智能体。**Use custom defaults for this model**(为此模型使用自定义默认值) 在大多数账号上让 Reasoning Effort 从 **Maximum** 起步（Codex 上是 **Default**），所以智能体会以最高级别思考，速度更慢，费用也更高。想让它们少思考一些，就选一个较低的级别，或者关闭它的 Send 开关。没有保存级别时，以 JSON 作答的智能体会请求关闭思考，其他智能体则保留模型的默认行为。Gemini 4 Argon 和 Carbon 无法关闭思考，所以在 Google AI Studio 和 Vertex 上，它们的智能体会改为发送 **Medium**。
- **思考余量**：账号保存了 Reasoning Effort，或者模型是 Gemini 4 Argon 或 Carbon 时，Marinara 会在智能体的 **Max Output Tokens** 之上增加思考余量，但不超出账号的输出上限、模型的限制和剩余的上下文。自定义端点即使不发送这个级别，也会获得这部分余量。

已安装的智能体资源包遵循同样的账号值。账号保存并发送的值会替代资源包请求的值，没设置的项则保留资源包自己的设置。账号上关闭了开关的 **Reasoning Effort** 或 **Max Output Tokens** 不会发送，即使资源包请求也一样。Temperature 和 Verbosity 初始是关闭的，所以会保留资源包自己的值。

## 有些模型会忽略部分参数

不是每个模型都接受每个参数。Marinara 知道某个模型会拒绝某项设置时，就把这项从请求里去掉。控件照样显示，但改了也没有效果。这在推理模型上很常见，它们会拒绝 temperature 之类的采样设置。如果用的是每次都可能换模型作答的自动路由模型，参数表现可能一轮一轮地变。固定用一个模型，行为才稳定。

## 相关指南

- [预设编辑器与提示词管理器](presets.md)
- [Peek Prompt：查看 AI 收到的内容](../chats/peek-prompt.md)
- [连接 AI 服务商](../connections/connecting-to-a-provider.md)
