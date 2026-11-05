# Peek Prompt：查看 AI 收到的内容

Peek Prompt(查看提示词) 会原样显示 Marinara Engine 为一条回复发给模型的文字，也可以实时预览下一条回复的提示词。回复不符合预期、想知道模型看到了什么时，就用它。

提示词就是 Marinara 拼装好并发出去的一整块内容，里面有各种指令和聊天记录。模型读完它，再写出回复。

## 打开 Peek Prompt

打开 **Assembled Prompt**(拼装后的提示词) 窗口有两种方式。

从消息打开：

1. 点一下最新的那条 AI 消息，显示它的操作栏。
2. 点击 **Peek prompt**(查看提示词)（一个放大镜图标）。

它只出现在最后一条 AI 消息上，更早的消息上没有。

从输入框打开，这种方式在还没有任何 AI 回复时也能用：

1. 在消息框里原样输入这段文字：`{{prompt}}`
2. 按 <kbd>Enter</kbd> 或点击 **Send**(发送)。

Marinara 不会发出消息，而是清空输入框并打开这个窗口。`{{prompt_preview}}` 和 `{{preview_prompt}}` 效果相同。

## 窗口里显示什么

标题旁边的角标说明你看到的是哪个版本的提示词。

| 角标 | 含义 |
| --- | --- |
| **Exact Text Model Request** | 实际发给模型的那份原始请求。 |
| **Live Preview** | 当场生成的预览。 |
| **Raw Messages** | 未经处理的消息列表。 |
| **Prompt Preview** | 一般的预览。 |
| **Decision test preview** | 用一次决策测试的答案拼装出的提示词。它没有发给聊天模型。 |

角标下面是一个信息面板，可以显示服务商和模型、估算的 Token 数，回复完成后还会显示真实的提示词 Token 数。Token 是一小段文本，模型统计长度时数的是 Token，不是单词。面板还会用标签列出这次用到的取值，比如 **Temperature**(温度)、**Max Output Tokens**(最大输出 Token 数)、**Thinking**(思考)、**Reasoning**(推理)、**Verbosity**(详细度)、**Service Tier**(服务层级) 和 **Assistant Prefill**(助手预填)，以及 **Top P**、**Top K** 和 **Min P** 这类采样取值。**Service Tier**、**Assistant Prefill** 这类标签和采样取值都属于高级模型设置，刚开始可以先不管。如果第一个模型失败、由你的备用模型写出了回复，面板会写明失败的模型和一个简短的原因，比如“key rejected”或“rate limited”。

窗口其余部分就是提示词本身，分成一个个可折叠的区块，每个区块都有各自的粗略 Token 估算。聊天消息统一归在 **Chat History**(聊天记录) 下。如果看的是已保存的真实请求，服务商可能把好几轮聊天合并进了同一个块，所以要逐个展开才能看到全部文字。点击区块标题即可展开或收起。

**Exact Text Model Request** 是那条回复当时原样发出的请求。它保存在回复结束后运行的一切操作之前，比如自动摘要或隐藏消息，所以里面可能有下一条回复收不到的消息。点击 **Show current context**(显示当前上下文)，就会按聊天现在的状态拼装提示词，但不会发送。点击 **Show sent request**(显示已发送的请求) 即可返回。

### 复制提示词

点击关闭按钮旁边的复制按钮。它会按发送顺序，把每个区块和每条消息都复制成纯文本，收起的区块也包括在内。每条消息开头都有一行标明它的消息角色，比如 `[system]`、`[user]` 或 `[assistant]`。如果看的是已保存的真实请求，复制的就是当时原样发出的那份请求。复制不会发送任何内容。

### 在提示词中查找文字

使用顶部的 **Find**(查找) 输入框，或者在窗口内按 <kbd>Ctrl</kbd>+<kbd>F</kbd>(Mac 上是 <kbd>Cmd</kbd>+<kbd>F</kbd>)。查找不区分大小写，会搜索整份提示词，包括收起的区块和聊天记录。计数器会显示当前匹配项，比如“2 of 5”。用向上、向下按钮，或者 <kbd>Enter</kbd> 和 <kbd>Shift</kbd>+<kbd>Enter</kbd>，在匹配项之间切换。到达任意一端后，会从另一端接着找。只要 **Find** 里有文字，窗口就会显示消息的完整文本。清空它就会回到区块视图。

## 用 Reply checkup 检查回复

Marinara 发现回复质量差的可能原因时，窗口会在提示词上方显示一个 **Reply checkup**(回复检查) 面板。它可能会指出：

- 角色卡很大，占了提示词预算的一大块（**Large character card**）。
- 回复达到了 Token 上限，在句子中途停下（**Cut off**）。
- 模型没有返回任何可见文字（**Empty reply**）。
- 提示词放不下，较早的消息没有发送（**N older messages not sent**）。
- 有世界书条目匹配上了，但超出了预算（**N lorebook entries left out**）。
- 为了给提示词腾出空间，回复上限被调低了（**Reply limit cut**）。

在有帮助的地方，会有一个链接直接跳到需要修改的设置，比如 **Max output tokens**(最大输出 Token 数) 或 **Lorebook token budget**(世界书 Token 预算)。

## 排查不符合预期的回复

打开 **Assembled Prompt**，检查这几项：

- **缺失的信息。** 如果世界书条目、记忆或用户角色的某个设定不在任何区块里，说明模型根本没看到。
- **参数标签。** **Temperature** 过高会让回复变得随机，**Max Output Tokens** 太低则会把回复截短。
- **Chat History。** 确认你期望的消息都在，而且顺序正确。
- **Token 数。** 提示词太大，会把较早的消息挤出模型的上限。

然后对症处理：修改角色卡、调整世界书条目，或者更改生成设置。见[生成参数](../prompts/generation-parameters.md)。

想看一条被引导的回复背后用了什么方向，就用消息上的 **Stored guidance**(已保存的引导)。见[引导生成与 Impersonate](guided-and-impersonate.md#read-stored-guidance)。

<a id="testing-decision-statements"></a>

## 测试 Decision 语句

[Decision 模型](../connections/decision-models.md)会为世界书等功能回答“是或否”问题。Peek Prompt 里的 **Decision diagnostics**(决策诊断) 可以检查和测试当前聊天的这些问题。

1. 打开 Peek Prompt，找到 **Decision diagnostics**。
2. 打开它，或者点击 **Preview inputs**(预览输入)，会准备好请求正文，但不会询问任何模型。展开 **Prepared request bodies**(已准备的请求正文)，可以查看近期消息、解析后的语句、选项和请求格式。
3. 点击 **Test decisions**(测试决策)，把符合条件的问题发给你的 Decision 模型。

**Test decisions** 会发出真实的请求，所以托管模型可能会收费。它不会写聊天回复、运行智能体、改变游戏状态，也不会把答案或计时器保存到聊天里。有些靠后的世界书语句，要等前面的语句得到回答后才会变得可达。即使普通的回复前决策被推迟，明确执行的测试仍可以等待本地推理模型。这不会改变你对实际回复的设置。

每个结果会显示分数（如果有）、是/否语句的阈值和答案。只返回“yes”或“no”的模型会被相应标明，它的答案不会显示成概率。Choice 结果会显示选中的选项。保持中、已推迟、超出限制、不可用和失败的决策都有各自的说明。

测试之后，下方的提示词会使用测试的答案。点击 **Show original prompt**(显示原始提示词) 回到最初打开的内容，或者点击 **Show tested prompt**(显示测试后的提示词) 切换回来。**Requests sent and results**(已发送的请求和结果) 会显示实际的请求正文和结果，不包含身份验证请求头。

如果没有成功：看到 **Could not prepare the decision test. Check the chat connection and try again.** 时，检查这个聊天是否有一个能用的模型，然后重试。

即使你是从较早的回复打开 Peek Prompt，测试也使用当前的聊天和设置，不会重建当时的决策请求。测试涵盖提示词语句和世界书决策，不包括智能体激活和回复后决策。

在 Advanced Memory(Marinara 的长期记忆功能，见[记忆功能与聊天摘要](../agents/memory.md)) 中开启 **Use Decision model**(使用决策模型) 后，面板还会显示 **Advanced Memory activity**(Advanced Memory 活动)。这些已保存的报告列出最近一次回忆和场景结束检查，以及所用的模型、时间、分数、选择和备用处理状态。它们描述的是过去的调用，不是当前的预览；即使提示词里没有 Decision 语句，它们也可能出现。兼容的备选回复可以复用较早的回忆报告。每份报告最多保留 128 个结果，选中的排在前面，其余的只计数。下一次符合条件的 Decision 模型调用之后会出现新报告。查看报告不会发出任何模型请求。
