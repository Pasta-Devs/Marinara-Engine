# Decision 模型

Decision 模型是一种小模型，替 Marinara 回答是或否的问题，例如“Does the latest message move the scene to a new place?”这类问题。世界书、自定义智能体、提示词和群聊都会用到它。它是可选的。没有它，聊天照常进行，各功能会采用 [Marinara 在哪里使用它](#where-marinara-uses-it)中说明的备用行为。

它的答案控制 Marinara 的行为，从不会发到聊天里。它给一条陈述打 0 到 1 的分数。Marinara 把这个数字和阈值比较，把结果当作是或否。它也可以从一个简短的列表里挑出一个答案，例如“angry”、“sad”或“none of these”。

我们的建议：拿不准就保持 **None**(无)。想用判定的话，就用你可能已经有的内置模型，或者你已在运行的服务器上的聊天模型。两者都不产生额外费用。

## 选择 Decision 模型

开始之前，先看[如何选择](#which-one-to-pick)。

1. 点击顶栏里的 **Connections**(连接)，打开 **Jobs**(分工) 框。
2. 在 **Behind the scenes**(幕后) 下点击 **Decision**(判定) 行，会打开一个列表。
3. 选一个模型。列表分三组：
   - **None (decisions off)**(无，关闭判定) 是默认选项。不会发出任何询问，智能体编辑器里的激活问题字段保持禁用。
   - **Built-in model**(内置模型) 列出 Marinara 在你电脑上运行的模型：**Built-in model**、**Built-in model (utility)**(内置模型，辅助) 和 **Built-in model (decisions)**(内置模型，判定)。所有内容都不会离开你的电脑。
   - **Connections** 列出能回答判定的账号：托管服务，或者你已在运行的服务器上的聊天模型。
4. 要测试它，点击这一行上的 **Decision settings**(判定设置) 齿轮，再点击 **Test**(测试)。这个按钮出现在内置模型的条目上。TypeSafe 或 OpenRouter 账号要在它的模型上打开 **Edit model**(编辑模型)，点击 **Test provider**(测试服务商)。**Own decision server**(自有判定服务器) 账号则用账号 **⋯** 菜单里的 **Test**。

测试通过时，会显示“是”的概率和回答耗时。如果是你电脑上的模型，还会说明能否拿到对数概率，以及模型是否直接作答。对数概率是模型对它可能写出的每个词给出的置信度数值。测试发送的是固定样本，不是你的聊天。

没有成功时，消息会说明原因。常见原因有：密钥被拒绝、服务正在限制请求、内置模型没有运行，或者回答超过了时限。见[故障排查](#troubleshooting)。

当前无法回答的条目仍留在列表里，显示为灰色，并注明原因。选择 **None** 会关闭判定，但不会删除任何激活问题或判定陈述。

<a id="which-one-to-pick"></a>

### 如何选择

- **内置模型里已经在运行的模型。** 没有额外费用。最适合大多数使用内置模型的人。
- **你自己服务器上的聊天模型**（Ollama、LM Studio、llama.cpp 或其他 OpenAI 兼容服务器）。没有额外费用。适合模型运行在 Marinara 之外的情况，这样就不会加载两份。
- **托管的 Decision 账号**（TypeSafe 或 OpenRouter 密钥）。按请求计费，一个回合可能发出多次请求。适合手机，以及不运行本地模型的电脑。
- **内置判定模型。** 单独占用磁盘空间和显存。需要 Linux x86-64 和受支持的 NVIDIA GPU。适合在聊天模型之外再运行一个独立的判定模型。

如果已经在运行本地模型，先试它，并用你自己聊天里的回合来测试。措辞的影响很大。见[编写陈述](../prompts/conditional-prompts.md#writing-statements)。

Jev 和 Open-Jev 是不同的模型。Jev 是 TypeSafe 的托管模型，可以直接使用，也可以通过 OpenRouter 使用。[Open-Jev](https://huggingface.co/ZefanCai/Open-Jev-2B) 是基于 Qwen 单独发布的模型，Marinara 可以在本地运行它。Open-Jev 的测试没有测量托管的 Jev。

在 Android (Termux) 上，**Built-in decision model**(内置判定模型) 无法运行，而在手机处理器上跑的小型本地模型可能太慢。托管账号是实际可行的选择，例如通过 OpenRouter 使用 Jev。见[设置 Decision 连接](#set-up-a-decision-connection)。

写预设、角色卡和智能体时，应以“一个 Decision 模型”为前提，不要写成“必须使用 Jev”。无论用哪个模型，陈述语法都相同，但不同模型可能给出不同的答案。导入使用判定的内容时，包括自定义智能体和 Agent Organizer 安装，Marinara 会显示一条链接到本指南的通知。恢复整个档案 ZIP 时不会显示。

## 使用内置模型

如果已经下载了内置模型，就能用它来判定，不需要账号，也不花钱。见[内置模型设置](local-model.md)。

1. 在 **Jobs** 框的 **Behind the scenes** 下点击 **Decision** 行。
2. 选择 **Built-in model**；如果有 **Built-in model (utility)**，也可以选它。
3. 点击 **Decision settings** 齿轮，再点击 **Test**。

Marinara 向模型提一个是或否的问题，让它只写一个 Token，再从这个 Token 的概率里读出答案。不会写出回复，所以请求很短。多个答案之间的选择，会拆成每个答案一个是或否的问题。

**Thinking**(推理) 设置决定模型无法用一个词作答时怎么办。有些模型总是先推理。

| Thinking | 作用 |
| --- | --- |
| **Auto (try one word, allow thinking if the model cannot)**(自动：先尝试用一个词作答，做不到时允许推理) | 默认值。连续两次没能用一个词作答后，允许模型先推理，并且 Marinara 会通知你。 |
| **Off (always answer in one word)**(关闭：始终用一个词作答) | 无法用一个词作答的模型不会给出答案。 |
| **Allowed (let the model think first)**(允许：让模型先推理) | 从不要求模型跳过推理。 |

先推理的模型需要好几秒，所以默认只回答回复显示之后才运行的检查，例如后处理智能体。要让它也判定回复之前运行的智能体，开启 **Also gate agents that run before the reply**(也判定回复前运行的智能体)。这样每条回复都会等它。

通用聊天模型给出的是或否概率可以拿来和阈值比较，但它们不像专用判定模型那样经过校准训练。不返回对数概率的运行时只会给出固定的 1 或 0。请用自己的聊天来调整阈值。

<a id="on-a-server-you-already-run"></a>

### 使用已运行的服务器

如果聊天模型运行在 Ollama、LM Studio、llama.cpp 或其他 OpenAI 兼容服务器上，它就能回答判定，Marinara 不必再加载第二份。

1. 在 **Connections** 面板里点击该模型上的 **⋯**，选择 **Use this model for decisions**(将此模型用于判定)。**Add account**(添加账号) 窗口会直接打开到判定这一步，地址、模型和密钥都与原来相同。
2. 选择模型，然后点击 **Test decision**(测试判定)。测试通过时，会说明服务器是否返回了对数概率，以及模型是否必须先推理。点击 **Done**(完成)。
3. 点击 **Behind the scenes** 下的 **Decision** 行，选择新模型。

也可以自己创建一个。使用来源为 **OpenAI-compatible chat model (Ollama, LM Studio, llama.cpp)**(OpenAI 兼容聊天模型) 的 Decision 账号，填写与聊天账号相同的地址（例如 Ollama 的 `http://localhost:11434/v1`），以及服务器使用的模型名称。

询问方式与内置模型相同：每条陈述要一个表示是或否的词。陈述逐条发送，因为 Marinara 无法知道你的服务器一次能处理多少请求。对账号来说，**Thinking** 始终是 **Auto**(自动)。另一台电脑上的服务器需要 `PROVIDER_LOCAL_URLS_ENABLED`。见[连接本地或自托管模型](local-self-hosted.md)。

<a id="set-up-a-decision-connection"></a>

## 设置 Decision 连接

托管的 Decision 账号会把选定的最近消息和陈述发给该服务，可能产生费用。Smart 回复顺序还会发送[角色名单](#what-the-model-sees)。

1. 点击顶栏里的 **Connections**，再点击 **Add**(添加)。
2. 在 **Decisions**(判定) 下点击 **TypeSafe** 或 **Own decision server**。如果用 OpenRouter，在 **Chat**(聊天) 下点击 **OpenRouter** 并完成连接，然后用模型 **⋯** 菜单里的 **Use this key for decisions**(将此密钥用于判定)。
3. 填写 **API key**(API 密钥)；如果是 **Own decision server**，则填写 **Server address**(服务器地址)。点击 **Connect**(连接)。窗口关闭，面板里会出现新账号。
4. 点击 **Behind the scenes** 下的 **Decision** 行，选择新模型。
5. 要测试它，在面板里点击该模型打开 **Edit model**，然后点击 **Provider tests**(服务商测试) 卡片里的 **Test provider**。**Own decision server** 模型在那里没有 **Test provider** 按钮。请改为在面板里打开账号的 **⋯** 菜单，点击 **Test**。

**Test provider** 通过时，会显示概率、回答耗时和账号的时限。**⋯** 菜单里账号的 **Test** 只说明是否成功以及耗时多久。测试至少等待 10 秒；时限更长时，等待时限再加 5 秒。如果回答耗时超过时限，结果会注明：在聊天中，这样的回答会算作没有答案。

没有成功时，见[故障排查](#troubleshooting)。

Decision 编辑器（在判定模型上打开 **Edit model**）有这些字段：

| 字段 | 作用 |
| --- | --- |
| **Decision source**(判定来源) | **TypeSafe**、**OpenRouter**、**Custom System One endpoint**(自定义 System One 端点) 或 **OpenAI-compatible chat model (Ollama, LM Studio, llama.cpp)**。创建模型时即固定。 |
| **API key source**(API 密钥来源) | **Enter a separate key (optional for local servers)**(输入单独的密钥，本地服务器可不填)，或者用 **Use key from …**(使用……的密钥) 借用另一个账号的密钥。关联的密钥会跟随之后的密钥更改。自定义 System One 或 OpenAI 兼容模型只有在两个地址的协议、主机和端口都相同时，才能借用自定义聊天账号的密钥。 |
| **Recent-message token budget**(最近消息 Token 预算) | 发送多少估算 Token 的聊天内容。范围 1 到 30,000。TypeSafe 和 OpenRouter 默认 30,000，自定义服务器默认 3,500。Marinara 先丢弃较旧的消息，再裁掉最新消息里最旧的部分。请求被拒绝或超出预算时，不会得到答案。 |
| **Time limit (seconds)**(时限，秒) | 聊天中每条陈述等待多久。范围 0.5 到 30。默认 1.5，OpenAI 兼容聊天模型默认 4。见[时限](#time-limits)。 |

TypeSafe 发送到 `https://api.typesafe.ai`。可以把它的 **Base URL**(基础 URL) 换成另一台运行 TypeSafe API 的服务器，不带 `/v1/systemone`。这样仍然需要你的 TypeSafe 密钥，而密钥会发到那台服务器。**Custom System One endpoint** 接受你自己运行的 System One 服务器，例如 Open-Jev 或 [Strands decider](#run-strands-decider-yourself)。填写它的地址时不带 `/v1/systemone`。Ollama 这类聊天模型服务器不使用 System One。它要用 **OpenAI-compatible chat model**。

有些托管服务有时回答慢于 1.5 秒，让判定看起来像是随机失灵。多测试几次，把时限设在最慢那次回答的耗时以上。回复之前询问的陈述，例如预设里的判定，或者回复前运行的智能体的激活问题，每条都可能让回复最多多等这么久。

删除一个密钥被用于判定的账号时，会显示警告。之后需要重新关联 Decision 账号，在此之前判定不会给出答案。导入的连接文件从不包含 API 密钥或借用账号的关联，所以要手动恢复它们。

<a id="where-marinara-uses-it"></a>

## Marinara 在哪里使用它

- [激活问题](../agents/custom-agents.md#activation-questions)决定自定义智能体是否运行。没有答案时：问题不会阻止它运行。关键词和 **Trigger Cadence**(触发频率) 仍然适用。
- [提示词陈述](../prompts/conditional-prompts.md#asking-the-decision-model)在组装聊天或智能体提示词时选择文本。没有答案时：判定按否处理，因此判定块会使用它的 `{{else}}` 分支（如果有）。
- [世界书 Decision 字段](../lorebooks/entries.md#decision-activation)在世界书扫描期间检查 Require 或 Trigger。没有答案时：Require 无法放行新条目，Trigger 也不会增加激活路径。Sticky 保持和普通的 Trigger 激活路径仍然适用。
- [Smart 回复顺序](../chats/group-chats.md#response-order-individual-only)开启后，会为群聊里的下一位发言者打分。没有答案时：Smart 顺序照常执行它原有的 AI 调用。
- [自动管理活跃角色](../chats/group-chats.md#automate-active-characters-merged-only)设为 **Decision model**(判定模型) 时，会在 Merged 模式的 Roleplay 群聊里每次回复前询问谁在场景中。没有答案时：如果没有一个角色得到答案，它会使用 Character Tracker 记录的最近一个场景，或保留原有列表。
- [Advanced Memory Recall](../agents/memory.md#optional-decision-model) 可以为 Roleplay 的场景边界和记忆选择使用它自己的 Decision 模型。在该聊天的 Advanced Memory 设置里开启 **Use Decision model**。没有答案时：失败的判定会回退到普通回忆或场景检查。摘要仍然使用 Helper model(辅助模型)。

激活问题决定智能体是否运行。智能体提示词里的判定陈述，决定告诉这个运行中的智能体什么内容。是或否的条件用 `{{#if decision:"..."}}`，在多个答案中选择用 `{{#if decision_choice:"..." == "..."}}`。

<a id="what-the-model-sees"></a>

## 模型能看到什么

对于激活问题，以及提示词和世界书里的陈述，模型收到的是陈述本身和聊天里保存的最近消息。它收不到你的预设、角色卡、用户角色、世界书条目（Constant 条目也一样）、摘要或智能体输出。插在消息之间的文本，例如设为 **@ Depth** 的条目，也会被排除。如果陈述依赖其中某项，就必须在陈述里把这个事实写明。

- 提示词和世界书里的陈述、Smart 回复顺序和自动管理活跃角色，读取最近 5 条消息。这个数字是固定的。
- 激活问题按智能体的 **Scan Depth**(扫描深度) 读取消息，默认 5 条。
- 每条消息都带有发言者的名字。对 AI 隐藏的消息会被排除。
- 在回复之后运行的检查，例如后处理智能体的问题，也能看到刚写好的回复。
- 陈述里的宏会先展开，所以 `{{char}}` 传过去时已经是角色的名字。
- 消息超出模型的预算时，先丢弃较旧的消息。

**Smart 回复顺序**还会发送一份角色名单：每位候选角色的名字，已知时还有状态、活动和话多程度，外加最多 300 个字符的性格；性格为空时改用描述。

**自动管理活跃角色**也会发送一份角色名单：每个角色的名字，以及最多 300 个字符的描述；描述为空时改用性格。角色阵容太大放不下时，会裁到 100 个字符，或只留名字。名单里还有 Character Tracker 最近看到的名字。如果只放名字也给消息留不出足够空间，就不会询问模型，改由 Character Tracker 顶替。Merged 群聊里的回复会标成“the narrator”，因为一条回复替所有人发言。

托管的判定服务除了消息，也会收到这些名单。

**Advanced Memory** 按聊天使用它自己的 Decision 模型，不适用最近 5 条的规则。场景检查读取相关的对话记录窗口。回忆会先发送最近的对话文本和候选名单里最多 24 个已归档的回顾（如果 **Maximum recalled scenes**(最多召回场景数) 设得更高，则会更多），再在检查角色访问权限后，发送模型所选场景里的原始消息。托管服务会收到这些文本，有时分成几批。每一轮回忆通常有 10 到 25 秒，按模型的速度确定。两轮共用每条回复 40 秒，所以一轮可能不到 10 秒。没有及时得到答案的记忆会回退到普通回忆。见[可选的 Decision 模型](../agents/memory.md#optional-decision-model)。

<a id="thresholds"></a>

## 阈值

不同模型的概率没法直接比较。同一个例子在一个模型上可能得 0.99，在另一个模型上只有 0.2。默认的是或否阈值取决于模型：

- **内置模型，或 OpenAI 兼容聊天模型账号：** 0.5
- **TypeSafe、OpenRouter 或 Custom System One 账号：** 0.5
- **内置判定模型：** 模型清单的建议值：Open-Jev 2B 和 9B 为 0.1

智能体的 **Run when probability is at least**(运行所需的最低概率) 会覆盖这个值。保存的值与模型建议值不同时，编辑器会提供恢复建议值的选项。每次换模型都要检查它。提示词陈述和世界书 Decision 字段使用模型的默认值，智能体的阈值不会改变它们的阈值。

通过 Custom System One 账号接入的自托管 Open-Jev 仍然使用 0.5，因为 Marinara 无法校准任意的自定义端点。它的结果可能与内置的 Open-Jev 不同，包括把低于 0.5 的肯定结果读作否。

<a id="time-limits"></a>

## 时限

没有及时返回的判定算作没有答案，生成会按该功能的备用行为继续（见 [Marinara 在哪里使用它](#where-marinara-uses-it)）。所有时限都按陈述计算。一次请求里有多条陈述时，每条都获得这段时限；每个 Choice 答案也算一条陈述。本地模型一次只处理少量请求，所以陈述要排队，每条陈述的计时从模型开始处理它时算起。

- **TypeSafe、OpenRouter 或 Custom System One 账号：** 1.5 秒，或你设置的 **Time limit**
- **OpenAI 兼容聊天模型账号：** 4 秒，或你设置的 **Time limit**。必须先推理的模型至少获得 20 秒。
- **内置模型：** 4 秒。必须先推理的模型获得 20 秒。
- **内置判定模型：** 第一条陈述 4 秒。之后每条使用模型的实测时间：Open-Jev 2B 为 0.35 秒，Open-Jev 9B 为 0.8 秒。从仓库安装的模型每条获得 4 秒。

取消生成时，判定请求也会停止。

## 其他设置

这些设置在 **Decision settings** 齿轮里：

- **Also use it to pick who speaks in Smart response order**(也用于 Smart 回复顺序的发言者选择) 默认关闭。见[群聊](../chats/group-chats.md#response-order-individual-only)。
- **Decision statements per turn**(每回合判定陈述数) 限制提示词和世界书陈述的规划。默认 32，最多 255。这个额度在多个阶段分别生效，不是一个回合内所有请求或花费的统一上限。智能体激活问题和 Smart 回复顺序另行计算。见[限制与成本](../prompts/conditional-prompts.md#limits-and-cost)。
- **Also gate agents that run before the reply** 和 **Thinking** 显示在能推理的内置模型条目上。**Built-in decision model** 从不推理，所以这两项都没有。

## 为错误答案做好准备

任何模型都可能答错，而且正确的“是”答案也可能离阈值很近。

- 用判定来微调回复，不要用它控制聊天离不开的东西。漏掉一次判定应当只让回复少些针对性，而不是破坏回复。
- 不要让同意、内容警告或安全指示取决于判定。
- 对只靠激活问题运行的智能体，设置 **Bypass the question after this many messages**(经过指定消息数后跳过问题)，这样一直回答否的模型也没法让它永远沉默。

<a id="troubleshooting"></a>

## 故障排查

- **测试失败。** 消息会说明原因：密钥被拒绝、服务正在限制请求、内置模型没有运行、判定模型没有安装、模型没有回答是或否，或者超时。
- **服务器没有该端点。** Decision 来源与服务器不匹配。Ollama、LM Studio 等聊天模型服务器需要 **OpenAI-compatible chat model**。**Custom System One endpoint** 只用于 Open-Jev 等 System One 服务器。
- **回答超过了时限，或者判定只是偶尔有效。** 该服务有时比 **Time limit** 慢。多测试几次，把时限提高到最慢那次回答以上。
- **带激活问题的智能体每回合都运行。** 没有设置 Decision 模型，或者它没有回答，所以智能体就像没有问题一样运行。运行一次测试。
- **提示词里的判定分支始终不出现。** 见[判定分支始终不出现时](../prompts/conditional-prompts.md#when-a-decision-branch-never-appears)。
- **Smart 回复顺序仍然执行原有的 AI 调用。** 开关是关闭的，或者 Decision 模型在那个回合没有回答。
- **自动管理活跃角色改为跟随 Character Tracker。** 模型没有为每个角色都给出答案；或者它先推理，而 **Also gate agents that run before the reply** 是关闭的；或者角色阵容太大，即使只放名字也塞不进模型的输入。

要在生成时查看判定的评分和输出，开启 Debug Mode，或者把日志级别设为 debug。见[日志级别](../CONFIGURATION.md#logging-levels)。要在不生成回复的情况下测试自己的陈述，打开 **Peek Prompt → Decision diagnostics → Test decisions**(Peek Prompt → 判定诊断 → 测试判定)。显式测试会调用选定的模型，在托管服务上可能产生费用。见[测试判定陈述](../chats/peek-prompt.md#testing-decision-statements)。

<a id="let-marinara-install-a-decision-model"></a>

## 让 Marinara 安装判定模型

**Built-in decision model** 是一个实验性的专用判定模型，由 Marinara 下载，并在你的聊天模型旁作为独立的本地进程运行。它占用的内存会叠加在聊天模型之上。如果已经有本地模型，先试试它的判定能力。

Open-Jev 模型需要 Linux **x86-64**、计算能力 7.5 或更高的 NVIDIA GPU(Turing、RTX 20 系列或更新)，以及 580 或更新版本的驱动。不支持 Linux ARM 和更老的显卡。模型无法运行时，这个选项仍然可见，会说明原因，并提供 **Set up a Decision provider instead**(改为设置 Decision 服务商)。

| 模型 | 模型下载 | 含运行时的磁盘占用 | 显存 |
| --- | --- | --- | --- |
| Open-Jev 2B | 约 4.6 GB | 约 10 GB | 约 4.8 GB (4.5 GiB) |
| Open-Jev 9B | 约 19.4 GB | 约 25.3 GB | 约 23.6 GB (22 GiB) |

这些是目录给出的估算值。9B 模型在 24 GB 的 GPU 上几乎不留余量。请查看安装器针对你的显卡给出的判断。

1. 在 **Connections** 面板里点击 **Add**，再点击 **Decisions** 下的 **Built-in model (decisions)**。会打开一个标题为 **Built-in decision model** 的窗口。也可以从 **Built-in model** 卡片的页面打开它。
2. 阅读警告，然后开启 **Use the built-in decision model**(使用内置判定模型)。标题为 **Turn on the built-in decision model?** 的对话框会显示针对你电脑的判断。点击 **Enable**(启用)；判断结果是警告时，点击 **Enable anyway**(仍然启用)。
3. 在 **Available decision models**(可用的判定模型) 下选择 **Open-Jev 2B** 或 **Open-Jev 9B**。点击 **Download and install**(下载并安装)，确认大小、硬件判断和许可证。在此之前什么都不会下载。
4. 点击 **Behind the scenes** 下的 **Decision** 行，选择 **Built-in model (decisions)**。

窗口里的其他控件：

- **Install from a repository**(从仓库安装) 接受 `owner/model-name` 形式的 HuggingFace 判定模型。点击 **Check**(检查)。Marinara 会读取仓库自己的清单，检查它是否对应当前构建自带的运行时，并显示基础权重和总大小。无法确认的仓库会被拒绝，并附上原因。然后点击 **Download and install this one**(下载并安装这个)。
- 电脑有多块 NVIDIA GPU 时，**GPU** 用来选择使用哪块卡。更改它会停止模型，模型随后在新卡上重新启动。
- **Start this model when Marinara starts**(Marinara 启动时启动此模型) 是可选的。关闭时，模型会在智能体第一次需要它时启动。
- **Remove files**(删除文件) 会删除模型及其运行时。关闭模型会停止进程，但保留文件。
- 已安装的模型因为文件或运行时缺失、过期而无法启动时（通常发生在更新之后），会出现 **Reinstall**(重新安装)。这时模型会标记为 **Needs reinstall**，**Decision** 行显示 **Not set up**。重新安装会保留已经完整下载的文件，所以通常只需重新下载运行时的 Python 包。

模型启动后的第一次回答较慢，所以 Marinara 会在加载时问一个预热问题。预热失败时，模型照样启动，只是延迟落到第一个真正的问题上。在长聊天里，带很多陈述的回合耗时更长。Open-Jev 2B 在长聊天里每条陈述约需四分之一秒。

<a id="run-strands-decider-yourself"></a>

### 自行运行 Strands decider

[Strands decider 2B](https://huggingface.co/StrandsAgents/strands-decider-2B-hobson-v19) 是另一个支持 System One 的开放判定模型（Apache-2.0）。Marinara 无法安装它，但只要你让它保持运行，它就能作为 **Custom System One endpoint** 使用。

1. 在 Python 3.10 或更新版本的环境中安装它并启动服务器：

   ```bash
   pip install strands-decider
   strands-decider serve StrandsAgents/strands-decider-2B-hobson-v19 --port 8000
   ```

   检测到 NVIDIA GPU 或 Apple silicon 时会使用它们，否则在处理器上运行，速度较慢。首次启动会下载模型和约 4.6 GB 的基础权重，它的 Python 包约占 5.5 GB。服务器没有密码，因此要让它保持在 `127.0.0.1` 上。

2. 添加一个 **Own decision server** 账号，**Server address** 填 `http://127.0.0.1:8000`。模型名称随便填都行。
3. 在 **Decision** 行上选中它，然后用账号 **⋯** 菜单里的 **Test** 测试。它启动后的第一次回答约需 2 秒，比默认时限更长，所以开始聊天前先测试一次。

它的概率经过校准，所以默认的 0.5 阈值适合它，这一点和自托管的 Open-Jev 不同（见[阈值](#thresholds)）。它的回答受措辞影响，所以请按照[编写陈述](../prompts/conditional-prompts.md#writing-statements)来写。

## 相关指南

- [创建自定义智能体](../agents/custom-agents.md)
- [条件提示词](../prompts/conditional-prompts.md)
- [群聊](../chats/group-chats.md)
- [内置模型设置](local-model.md)
- [连接 AI 服务商](connecting-to-a-provider.md)
