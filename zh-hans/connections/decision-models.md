# Decision 模型

本指南介绍 **Decision model**(判定模型)：它的作用、获取它的三种方式、各自的设置方法，以及 Marinara 在哪些地方使用它。它是可选功能。没有判定模型，聊天仍会生成，但各功能会采用下文介绍的备用行为。

## 判定模型是什么

Decision 模型回答一种特定问题。它接收聊天的最近消息及一条语句，例如 "The latest message moves the scene to a new place"，用 0 到 1 的数字表示该语句为真的可能性。Marinara 将数字与阈值比较，视为是或否。它也可以从简短列表中选择一个答案，例如 "angry"、"sad" 或 "none of these"。

它的答案控制 Marinara 的行为，不会作为回复发布到聊天里。专用判定模型直接给陈述打分。通常会要求本地聊天模型只输出一个是/否 Token，不过部分模型需要先推理。判定可能比生成完整回复更快，但陈述很多或使用推理模型时，耗时也可能明显增加。

<a id="where-marinara-uses-it"></a>

## Marinara 在哪里使用它

- **[激活问题](../agents/custom-agents.md#activation-questions)**在自定义智能体开始所属阶段的工作前，决定是否运行它。没有答案时，问题不会阻止运行；关键词和 **Trigger Cadence**(触发频率) 仍然适用。
- **[提示词陈述](../prompts/conditional-prompts.md#asking-the-decision-model)**在准备聊天或智能体提示词时选择文本。没有答案时，判定按否处理，因此简单判定块会使用 `{{else}}` 分支（如果有）。
- **[世界书 Decision 字段](../lorebooks/entries.md#decision-activation)**在聊天的世界书扫描期间检查 Require 或 Trigger。没有答案时，Require 无法放行新条目，Trigger 不会增加激活路径。已有 Sticky 保持和 Trigger 条目的普通激活路径仍然适用。
- **[Smart 回复顺序](../chats/group-chats.md#response-order-individual-only)**启用后，会为群聊的下一位发言者打分。没有答案时，Smart 顺序会执行原有的 AI 调用。

激活问题控制是否运行智能体；智能体提示词内的判定陈述控制运行时告诉它什么。是/否提示词条件使用 `{{#if decision:"..."}}`，多选一使用 `{{#if decision_choice:"..." == "..."}}`。

<a id="what-the-model-sees"></a>

## 模型能看到什么

对于激活问题和提示词/世界书陈述，模型接收陈述与聊天里保存的最近消息。它不会收到组装后提示词的其余部分，包括预设、角色卡、用户角色描述、世界书条目（包括 Constant 条目）、摘要或智能体输出。放在 **@ Depth** 的预设或世界书条目等插入消息之间的文本也会排除。如果陈述依赖这些事实，就必须把事实本身写入陈述。

**Smart 回复顺序还会发送角色名单。** 名单包含每位候选角色的姓名，以及可用的状态、活动、话多程度，并包含最多 300 个字符的性格；性格为空时改用描述。托管 Decision 服务商会同时收到名单和最近消息。

- 提示词和世界书条目里的判定陈述，以及 Smart 回复顺序，会读取最近 5 条消息。这个数量固定不变。
- 激活问题读取智能体的 **Scan Depth**(扫描深度)，默认是 5。
- 每条消息都标注发言者姓名。对 AI 隐藏的消息会排除。
- 在回复之后检查的内容，例如后处理智能体的激活问题或提示词陈述，也能看到刚写完的回复。
- 陈述里的宏先展开，因此 `{{char}}` 会以角色姓名传入。
- 消息超出模型预算时，先丢弃旧消息。托管服务的预算见[设置 Decision 连接](#set-up-a-decision-connection)。

## 选择 Decision 模型

打开 **Connections**(连接)，再打开 **Connection defaults**(默认连接)，从 **Decision model** 中选择。列表分三组：

- **None**(无)，默认选项。不发出询问，智能体编辑器里的激活问题字段保持禁用。
- **Local models**(本地模型)：已经运行的 **Primary local model**(主本地模型) 或 **Utility local model**(辅助本地模型)。不会额外下载，信息也不会离开电脑。安装了 **Decision sidecar**(判定辅助进程) 后，它也会列在这里。
- **Connections**：创建的任何 Decision 连接，包括托管服务和自行运行的服务。

当前无法回答的条目仍会保留在列表里，以灰色显示并说明原因，方便查看需要修复什么。选择后点击 **Test**(测试)。测试发送固定样本，不会发送聊天。

### 如何选择

如果已经运行本地模型，先试它。在一个角色扮演场景的小型措辞测试中，Gemma 4 E4B 对 32 条推荐陈述全部答对，Open-Jev 2B 和 9B 各答对 31 条。这说明措辞为什么重要，不是通用准确度排名。用自己的聊天中有代表性的回合测试，见[编写陈述](../prompts/conditional-prompts.md#writing-statements)。

**Jev 和 Open-Jev 是不同的模型。** Jev 是 TypeSafe 的托管模型，可直接使用，也可通过 OpenRouter 使用。[Open-Jev](https://huggingface.co/ZefanCai/Open-Jev-2B) 是基于 Qwen 单独发布的模型，Marinara 可以在本地运行它。Open-Jev 措辞测试没有测量托管 Jev 的准确度。

| 选项 | 成本 | 所需条件 | 适合 |
| --- | --- | --- | --- |
| 已经运行的模型 | 无额外成本 | **Local Model**(本地模型) 里的模型 | 大多数本地模型用户 |
| 托管 Decision 连接 | 按请求计费；一个回合可能发出多次请求 | API 密钥（TypeSafe 或 OpenRouter） | 手机，以及不运行本地模型的电脑 |
| 可安装的判定模型 | 额外占用磁盘和显存，见[模型大小](#let-marinara-install-a-decision-model) | Linux x86-64 和受支持的 NVIDIA GPU | 在聊天模型旁运行独立判定模型 |

**在 Android (Termux) 上，**可安装的判定模型无法运行，因为它需要配备 NVIDIA GPU 的电脑。手机处理器上运行的小型本地模型也可能无法在时限内完成。手机上更实用的是托管 Decision 连接，例如通过 OpenRouter 使用 Jev。见[设置 Decision 连接](#set-up-a-decision-connection)。

预设、角色卡和智能体应以“一个 Decision 模型”为前提编写，不要写成“必须使用 Jev”。无论用户选择哪个模型，陈述语法都相同，但答案可能不同。

导入使用判定的内容时，Marinara 会显示通知并链接到本指南。这也包括自定义智能体和 Agent 目录安装。如果没有选择 Decision 模型，通知会解释备用行为：提示词陈述按否处理，世界书条目无法通过判定激活，而智能体激活问题会在关键词和 **Trigger Cadence** 允许时放行。如果不希望智能体在没有 Decision 模型时每回合运行，也要为它设置频率。恢复整个档案的 ZIP 不会显示此导入通知。

<a id="use-a-model-you-already-run"></a>

## 使用已经运行的模型

如果 **Local Model** 里有本地模型，就能用它判定，无须创建连接或支付请求费用。

1. 在 **Connections** 中打开 **Connection defaults**，将 **Decision model** 设为 **Primary local model**，或在已配置辅助模型时设为 **Utility local model**。
2. 点击 **Test**。成功后会显示概率和请求耗时，以及本地模型特有的两个信息：是否提供对数概率，以及模型是否直接回答。

Marinara 向模型提出一个是/否问题，让它生成一个 Token，再从该 Token 的概率读取答案。不会撰写回复，所以请求很短。多选一会拆成每个选项一个是/否问题。能容纳多少最近消息，按该槽位自身的上下文大小计算。

**推理。** 大多数模型用一个词作答。部分模型无论收到什么要求都会先推理。下拉框下面的 **Thinking**(推理) 设置控制这一点：

- **Auto**(自动，默认) 先尝试快速的单词回答方式；连续两次无法按此方式回答，就允许该模型先推理并通知你。
- **Off**(关闭) 始终使用单词回答方式。无法按此方式作答的模型按没有答案处理。
- **Allowed**(允许) 从不要求模型跳过推理。

先推理的模型需要数秒，因此默认只回答回复显示之后的任务，例如后处理智能体。回复之前的任务按没有答案处理，除非开启 **Also gate agents that run before the reply**(也判定回复前运行的智能体)，这样每次回复都会等待它。

**如何理解数值。** 通用聊天模型的是/否概率可以用于阈值比较，但它们没有像专用判定模型一样经过概率校准训练。不返回对数概率的运行时只会给出固定的 1 或 0。用自己的聊天调整阈值，不要直接相信默认值。

<a id="set-up-a-decision-connection"></a>

## 设置 Decision 连接

1. 在 **Connections** 中创建连接，将服务商设为 **Decision**。
2. 选择 **TypeSafe**、**OpenRouter** 或 **Custom System One endpoint**(自定义 System One 端点)。托管服务需要 API 密钥。Custom 接受已经自行运行的 System One 服务器，包括 Open-Jev；输入不含 `/v1/systemone` 的基础 URL，并使用服务器支持的模型名称。
3. 使用 OpenRouter 时，在 **API key source**(API 密钥来源) 下选择已保存的 OpenRouter 连接，或输入单独的密钥。其编辑器还提供 **Use this key for decisions (Jev)**(将此密钥用于判定)。关联密钥会自动跟随后续密钥变更。Custom 连接只有在两个 URL 同源（协议、主机和端口相同）时，才能借用自定义聊天连接的密钥。
4. 保存后在 **Decision model** 下选择它，再点击 **Test**。成功后显示概率、回答耗时和连接的时限。Test 至少等待 10 秒；时限更长时，等待时限再加 5 秒，因此慢回答也会按实际耗时报告。如果超过时限，结果会注明：在聊天中，这样的回答会视为没有答案。

Decision 默认值独立于聊天、智能体、图像、视频和音频默认值。选择 **None** 会关闭判定，不会删除激活问题或判定陈述。

托管判定会把选定的最近消息和陈述发给所选服务商，可能产生费用。Smart 回复顺序还会包含[角色名单](#what-the-model-sees)。**Recent-message token budget**(最近消息 Token 预算) 的默认值为托管服务估算 30,000 个 Token、自定义服务器 3,500 个。如果服务器上下文上限更小，就调低此值。Marinara 先丢弃旧消息，再裁去最新消息开头较旧的部分。Token 估算可能与服务器的分词器不同；请求被拒绝或超出预算时，按没有答案处理。

**Time limit (seconds)**(时限，秒) 是聊天中每个 Decision 连接等待答案的时间，范围为 0.5 到 30 秒，默认 1.5 秒。晚于时限的答案视为没有答案。一些托管服务商偶尔会慢于 1.5 秒，使判定看起来像随机失灵。点击 **Test** 几次，把时限设得比最慢的回答更长。代价是回复前询问的陈述，例如预设里的判定或回复前智能体的激活问题，可能让回复最多等待这么长时间。

删除作为关联密钥来源的连接时，会显示警告，Decision 连接也需要重新关联。导入独立连接文件后同样需要恢复密钥或关联；这些文件从不包含 API 密钥或借用的连接 ID。

<a id="let-marinara-install-a-decision-model"></a>

## 让 Marinara 安装判定模型

Marinara 也可以代为下载和运行专用判定模型。无论是否同时运行本地聊天模型，它都作为独立本地进程运行。它占用的内存会叠加到聊天模型之上。如果已有本地模型，先试它的判定能力，再考虑下载另一个模型。

内置 Open-Jev 模型需要 Linux **x86-64**、计算能力 7.5 或更高的 NVIDIA GPU(Turing、RTX 20 系列或更新)，以及 580 或更高版本驱动。这些包不支持 Linux ARM 设备和 Pascal 或更老的显卡。无法运行时，选项仍然可见，会说明原因并提供设置 Decision 连接的替代方案。

| 内置模型 | 模型下载 | 含运行时的磁盘占用 | 显存 |
| --- | --- | --- | --- |
| Open-Jev 2B | 约 4.6 GB | 约 10 GB | 约 4.8 GB (4.5 GiB) |
| Open-Jev 9B | 约 19.4 GB | 约 25.3 GB | 约 23.6 GB (22 GiB) |

这些是目录根据固定模型版本和实测工作负载给出的估算值。GPU 占用和速度随任务变化。9B 模型在 24 GB GPU 上几乎不留余量；查看安装器针对所选显卡和其他运行中模型的判断。

1. 打开 **Connections**，展开 **Local Model**，选择 **Decision sidecar (experimental)**(判定辅助进程，实验性)。
2. 阅读警告，然后开启 **Enable decision sidecar**(启用判定辅助进程)。确认后会显示对机器的判断；如果结果是警告，按钮会显示 **Enable anyway**(仍然启用)。
3. 选择模型，确认大小、硬件判断和许可证。在此之前不会开始下载。**Open-Jev 2B** 比 **Open-Jev 9B** 需要的内存少得多，但两者都不保证对聊天作出正确回答。
4. 在 **Decision model** 下选择 **Decision sidecar**。

也可以粘贴判定模型的 HuggingFace 仓库。Marinara 会读取该仓库自己的清单，检查产物类型是否对应当前构建包含的运行时，并在提出安装选项之前展示要拉取的基础权重和总大小。无法确认的仓库会附带原因拒绝安装，不会盲目尝试。

机器有多块 NVIDIA GPU 时，通过 **GPU** 菜单选择加载到哪块卡。判断针对该卡；更改选择会停止模型，以便在新卡上重新启动。

关闭辅助进程会停止进程并保留文件。**Remove files**(删除文件) 会删除模型和运行时，辅助进程关闭时也能使用。

<a id="thresholds"></a>

## 阈值

不同模型的概率不能直接比较。同一个肯定案例，在一个模型上可能得 0.99，在另一个上只有 0.2。Marinara 的默认阈值取决于连接方式：

| 所选后端 | 默认是/否阈值 |
| --- | --- |
| Primary 或 Utility 本地聊天模型 | 0.5 |
| TypeSafe、OpenRouter 或 Custom System One Decision 连接 | 0.5 |
| 托管的 Decision sidecar | 模型清单建议值；内置 Open-Jev 2B 和 9B 为 0.1 |

智能体的 **Run when probability is at least**(运行所需的最低概率) 可以覆盖此默认值。保存值不同时，编辑器会提供恢复后端建议值的选项。每次切换模型都要检查。

提示词陈述和世界书 Decision 字段使用后端默认值；修改智能体阈值不会改变它们。**通过 Custom System One 连接自行托管的 Open-Jev 仍使用 0.5。** Marinara 无法自动识别并校准任意自定义端点。因此其结果可能不同于托管的 Open-Jev 辅助进程，包括把低于 0.5 的肯定结果读作否。

<a id="time-limits"></a>

## 时限

未及时返回的判定视为没有答案。生成会按[各功能的备用行为](#where-marinara-uses-it)继续，这可能省略提示词分支或必需的世界书条目。

- Decision 连接为 **1.5 秒**，除非更改 **Time limit**(时限)。见[设置 Decision 连接](#set-up-a-decision-connection)。
- 本地模型或判定辅助进程为 **4 秒**。一个回合询问很多陈述时，Open-Jev 9B 每多一条会获得少量额外时间。
- 必须先推理的本地模型为 **20 秒**。

取消生成会停止判定请求。

## Decision model 下的其他设置

- **Also use it to pick who speaks in Smart response order.**(也用于 Smart 回复顺序的发言者选择) 默认关闭。见[群聊](../chats/group-chats.md#response-order-individual-only)。
- **Decision statements per turn.**(每回合判定陈述数) 限制提示词和世界书陈述的规划，默认 32，最多 255。额度在多个阶段应用，不是一个回合内所有 Decision 请求或支出的统一上限。智能体激活问题和 Smart 回复顺序独立计算。范围、批处理和优先级规则见[限制与成本](../prompts/conditional-prompts.md#limits-and-cost)。
- 本地模型会显示 **Also gate agents that run before the reply** 和 **Thinking**。见[使用已经运行的模型](#use-a-model-you-already-run)。

## 准确度：为错误答案做好准备

任何模型都可能答错。在前述小型措辞测试中，Open-Jev 2B 的部分正确“是”答案只比阈值高一点。应考虑漏判和误判：

- 用判定微调内容，不要控制聊天必不可少的内容。漏判应当只让回复少一些针对性，而不是破坏聊天。
- 不要用判定来控制同意、内容警告或安全指示的出现。
- 对只靠激活问题运行的智能体，设置 **Bypass the question after this many messages**(经过指定消息数后跳过问题)，避免模型持续回答“否”而让它永久沉默。

具体措辞示例，以及在自己聊天中测试的方法，见[编写陈述](../prompts/conditional-prompts.md#writing-statements)。

## 故障排查

- **Test 失败。** 消息会说明原因：密钥被拒绝、服务商限流、本地模型未运行、判定模型未安装、模型未回答是或否，或超时。
- **Test 提示答案超时，或判定只是偶尔有效。** 服务商至少有时比连接的 **Time limit** 更慢。多测几次，把时限提高到最慢答案以上。
- **有激活问题的智能体每回合都运行。** 没有设置 Decision 模型，或模型没有回答，因此智能体按没有问题的情况运行。检查 **Test**。
- **提示词判定分支从不出现。** 见[判定分支始终不出现时](../prompts/conditional-prompts.md#when-a-decision-branch-never-appears)。
- **Smart 回复顺序仍执行原有 AI 调用。** 开关关闭，或 Decision 模型在该回合没有回答。
- **要查看每条陈述及其答案，**将日志级别设为 debug。见[日志级别](../CONFIGURATION.md#logging-levels)。

## 相关指南

- [创建自定义智能体](../agents/custom-agents.md)
- [条件提示词](../prompts/conditional-prompts.md)
- [群聊](../chats/group-chats.md)
- [设置本地模型](local-model.md)
- [连接 AI 服务商](connecting-to-a-provider.md)
