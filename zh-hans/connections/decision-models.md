# Decision 模型

Decision 模型是一种小模型，替 Marinara 回答关于聊天的简短问题，例如“最新消息是否把场景移到了新地点？”或“Kaelen 现在的心情是愤怒、悲伤还是平静？”。有些模型还可以查看聊天里的图片和视频片段。世界书、自定义智能体、提示词、群聊和 Illustrator 都会用到它。它是可选的。没有它，聊天照常进行，各功能会采用[Marinara 在哪里使用它](#where-marinara-uses-it)中说明的备用行为。

它的答案控制 Marinara 的行为，从不会发到聊天里。问题类型和示例见[判定模型能回答什么](#what-a-decision-model-can-answer)。

我们的建议：拿不准就保持 **None**(无)。想用判定的话，就用你可能已经有的内置模型，或者你已在运行的服务器上的聊天模型。两者都不产生额外费用。

## 判定模型能回答什么

每个答案返回的都是一个 0 到 1 的数字，表示模型有多大把握。Marinara 会把这个数字转成各项功能需要的答案。

### 是或否

模型读取一条陈述，判断它有多大可能成立。Marinara 把这个数值和[阈值](#thresholds)比较：达到或超过阈值就算是。这是最常见的类型，激活问题、世界书 **Decision** 字段、`{{#if decision:"..."}}` 和 Illustrator 的检查都会用到它。

| 陈述 | 可以控制什么 |
| --- | --- |
| `In the latest message, the characters move to a different location` | 追踪器只在地点发生变化的回合更新地点。 |
| `In the latest message, a dragon is physically present` | 关于龙的世界书条目加入提示词。 |
| `{{user}} asked a question that {{char}} has not answered yet` | 一行提示词提醒模型回答这个问题。 |
| `The latest message describes a fight` | 战斗智能体只在这个回合运行。 |

### 从多个答案中选一个

模型从你写的简短列表里选出最符合的答案。Marinara 会逐一询问每个选项，保留分数最高的一个，所以只会得到一个答案，不会得到多个。用法是 `{{#if decision_choice:"..." == "..."}}`：

```text
{{#if decision_choice:"Kaelen's mood in the latest message" == "angry"}}
Kaelen speaks in short, clipped sentences.
{{else if decision_choice:"Kaelen's mood in the latest message" == "sad"}}
Kaelen speaks quietly and avoids eye contact.
{{else if decision_choice:"Kaelen's mood in the latest message" == "calm"}}
Kaelen speaks normally.
{{/if}}
```

其他适用的列表包括：场景类型（`combat`、`dialogue`、`exploration`、`rest`）、一天中的时段（`morning`、`afternoon`、`evening`、`night`），或场景在房子的哪个房间里。选项之间要有明确区别；可能都不符合时，添加一个 `none of these` 之类的选项。智能体用同样的方式从几组指令中选择一组，Illustrator 则用它选择天气类型。

### 分数

有些功能直接使用这个数字，不把它转成是或否。[Smart 回复顺序](../chats/group-chats.md#response-order-individual-only)会给每个角色接下来发言的可能性打分，选出分数最高的角色。[Advanced Memory](../agents/memory.md#optional-decision-model) 会给过去各个场景的相关性打分。Peek Prompt 的 **Test decisions**(测试决策) 会显示每条陈述的分数，帮助选择阈值。见[测试判定陈述](../chats/peek-prompt.md#testing-decision-statements)。

### 图片和视频片段

能读取图片的内置判定模型，也可以针对聊天里的图片回答同样类型的问题，例如 `The picture shows the character at the beach`。Liquid d1、Valen 和 Winnow 能读取图片，Valen 完整版还可以读取短视频片段。其他模型，以及所有托管服务或服务器账号，都只读取文本，从不会收到图片。

只有明确要求时才会发送图片，因为每张图片都会让回答变慢：

- 在陈述里添加 `pictures:1`（最多 3 张）或 `clips:1`。加上 `media_within:2` 后，只有最新的 2 条消息中有图片时才会询问。见[图片和视频片段](../prompts/conditional-prompts.md#pictures-and-clips)。
- 在世界书条目的 **Decision** 字段下设置 **Show the decision model**(向决策模型展示)。见[Decision 激活](../lorebooks/entries.md#decision-activation)。
- 在自定义智能体的激活问题里设置 **Show the decision model**。见[激活问题](../agents/custom-agents.md#activation-questions)。
- Marinara 自带的图片功能：见[会查看图片的功能](#features-that-look-at-pictures)。

### 模型页面列出什么

每个内置判定模型的页面都会显示两行：

- **Answers**(回答类型) 列出模型原本支持的答案类型：**Yes/no**(是/否)、**Weighted choice**(加权选择)、**Score on a scale**(量表评分)，有些还有 **Boxes on a picture**(图片上的边界框)（某个对象在图中的位置）。Marinara 会询问是非题和选择题，并读取它们的分数。目前还不会请求边界框，所以这一项只是介绍模型的能力。
- **Reads**(读取内容) 列出 **Text**(文本)、**Pictures**(图片) 和 **Video**(视频)。只有该模型另一个版本才能读取的类型，会列在其他类型之后，例如“完整版本可读取视频”。

## 选择 Decision 模型

开始之前，先看[如何选择](#which-one-to-pick)。

1. 点击顶栏里的 **Connections**(连接)，打开 **Jobs**(分工) 框。
2. 在 **Behind the scenes**(幕后) 下点击 **Decision**(判定) 行，会打开一个列表。
3. 选一个模型。列表分三组：
   - **None (decisions off)**(无，关闭判定) 是默认选项。不会发出任何询问，智能体编辑器里的激活问题字段保持禁用。
   - **Built-in model**(内置模型) 列出 Marinara 在你电脑上运行的模型：**Built-in model**、**Built-in model (utility)**(内置模型，辅助) 和 **Built-in model (decisions)**(内置模型，判定)。所有内容都不会离开你的电脑。
   - **Connections** 列出能回答判定的账号：托管服务，或者你已在运行的服务器上的聊天模型。

   点击左侧的账号即可浏览它的模型。NanoGPT、OpenRouter 或 Google Gemini 账号会先在 **Decision models**(判定模型) 下列出自己的判定模型，再在下方的 **Chat models**(聊天模型) 中列出聊天模型。Google Gemini 的聊天模型无法回答判定，因此它的账号只列出判定模型。你之前选过的判定模型会在 **Starred**(已加星标) 上方显示，模型名下方会显示账号名。
4. 要测试它，点击这一行上的 **Decision settings**(判定设置) 齿轮，再点击 **Test**(测试)。这个按钮出现在内置模型的条目上。测试 TypeSafe、OpenRouter、NanoGPT 或 Google Gemini 判定模型时，打开模型的 **Edit model**(编辑模型)，再点击 **Test provider**(测试服务商)。**Own decision server**(自有判定服务器) 账号则使用账号的 **⋯** 菜单中的 **Test**。

测试通过时，会显示“是”的概率和回答耗时。如果是你电脑上的模型，还会说明能否拿到对数概率，以及模型是否直接作答。对数概率是模型对它可能写出的每个词给出的置信度数值。测试发送的是固定样本，不是你的聊天。

没有成功时，消息会说明原因。常见原因有：密钥被拒绝、服务正在限制请求、内置模型没有运行，或者回答超过了时限。见[故障排查](#troubleshooting)。

当前无法回答的条目仍留在列表里，显示为灰色，并注明原因。选择 **None** 会关闭判定，但不会删除任何激活问题或判定陈述。

<a id="which-one-to-pick"></a>

### 如何选择

- **内置模型里已经在运行的模型。** 没有额外费用。最适合大多数使用内置模型的人。
- **你自己服务器上的聊天模型**（Ollama、LM Studio、llama.cpp 或其他 OpenAI 兼容服务器）。没有额外费用。适合模型运行在 Marinara 之外的情况，这样就不会加载两份。
- **托管的判定模型**（TypeSafe、OpenRouter、NanoGPT 或 Google Gemini）。按请求计费，一个回合可能发出多次请求。NanoGPT 订阅包含部分判定模型，OpenRouter 也列有一些免费模型。适合手机和不运行本地模型的电脑。
- **内置判定模型。** 由 Marinara 下载并在聊天模型旁运行的专用判定模型，会单独占用磁盘空间和内存。大多数几乎能在任何电脑上运行，有些只用处理器运行。这是唯一能查看图片和视频片段的选择。见[让 Marinara 安装判定模型](#let-marinara-install-a-decision-model)。

如果已经在运行本地模型，先试它，并用你自己聊天里的回合来测试。措辞的影响很大。见[编写陈述](../prompts/conditional-prompts.md#writing-statements)。

Jev 和 Open-Jev 是不同的模型。Jev 是 TypeSafe 的托管模型，可以直接使用，也可以通过 OpenRouter 使用。[Open-Jev](https://huggingface.co/ZefanCai/Open-Jev-2B) 是基于 Qwen 单独发布的模型，Marinara 可以在本地运行它。Open-Jev 的测试没有测量托管的 Jev。

在 Android (Termux) 上，**Built-in decision model**(内置判定模型) 只提供 JevK5 和 Liquid d1，而手机处理器运行它们可能太慢。托管账号是实际可行的选择，例如通过 OpenRouter 使用 Jev。见[设置 Decision 账号](#set-up-a-decision-account)。

写预设、角色卡和智能体时，应以“一个 Decision 模型”为前提，不要写成“必须使用 Jev”。请求图片的陈述在只读取文本的模型上仍可使用，只是模型只收到文本。无论用哪个模型，陈述语法都相同，但不同模型可能给出不同的答案。导入使用判定的内容时，包括自定义智能体和 Agent Organizer 安装，Marinara 会显示一条链接到本指南的通知。恢复整个档案 ZIP 时不会显示。

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

1. 点击 **Jobs** 框中 **Behind the scenes** 下的 **Decision** 行。选择器列出所有账号的模型，包括你的聊天模型。也可以点击模型上的 **⋯**，选择 **Use for…** → **Decision**。
2. 点击 **Decision** 行的齿轮，再点击 **Test**。测试通过时会说明服务器是否返回了对数概率，以及模型是否需要先推理。点击 **Done**。
也可以自己创建一个。使用来源为 **OpenAI-compatible chat model (Ollama, LM Studio, llama.cpp)**(OpenAI 兼容聊天模型) 的 Decision 账号，填写与聊天账号相同的地址（例如 Ollama 的 `http://localhost:11434/v1`），以及服务器使用的模型名称。

询问方式与内置模型相同：每条陈述要一个表示是或否的词。陈述逐条发送，因为 Marinara 无法知道你的服务器一次能处理多少请求。对账号来说，**Thinking** 始终是 **Auto**(自动)。另一台电脑上的服务器需要 `PROVIDER_LOCAL_URLS_ENABLED`。见[连接本地或自托管模型](local-self-hosted.md)。

<a id="set-up-a-decision-connection"></a>

<a id="set-up-a-decision-account"></a>

## 设置 Decision 账号

托管的 Decision 账号会把选定的最近消息和陈述发给该服务，可能产生费用。Smart 回复顺序还会发送[角色名单](#what-the-model-sees)。

1. 点击顶栏里的 **Connections**，再点击 **Add**(添加)。
2. 点击类型按钮中的 **Decision**(判定)，再点击 **TypeSafe** 或 **Own decision server**。如果用 NanoGPT，见[通过 NanoGPT](#through-nanogpt)；如果用 OpenRouter 或 Google Gemini，见[通过 OpenRouter 或 Google Gemini](#through-openrouter-or-google-gemini)。
3. 填写 **API key**(API 密钥)；如果是 **Own decision server**，则填写 **Server address**(服务器地址)。点击 **Connect**(连接)。
4. 在 **Found in TypeSafe — use it for:** 下勾选 **Decision**，再点击 **Done**。模型会显示在 **Jobs** 框中 **Behind the scenes** 下的 **Decision** 行。
5. 要测试它，在面板里点击该模型打开 **Edit model**，然后点击 **Provider tests**(服务商测试) 卡片里的 **Test provider**。**Own decision server** 模型在那里没有 **Test provider** 按钮。请改为在面板里打开账号的 **⋯** 菜单，点击 **Test**。

**Test provider** 通过时，会显示概率、回答耗时和账号的时限。**⋯** 菜单里账号的 **Test** 只说明是否成功以及耗时多久。测试至少等待 10 秒；时限更长时，等待时限再加 5 秒。如果回答耗时超过时限，结果会注明：在聊天中，这样的回答会算作没有答案。

没有成功时，见[故障排查](#troubleshooting)。

判定模型有以下字段。点击面板中的模型可打开 **Edit model**，或点击 **Jobs** 框中 **Decision** 行的齿轮，打开当前判定模型的 **Decision settings**。

| 字段 | 作用 |
| --- | --- |
| **Decision source**(判定来源) | **TypeSafe**、**OpenRouter**、**NanoGPT**、**Google Gemini**、**Custom System One endpoint**(自定义 System One 端点) 或 **OpenAI-compatible chat model (Ollama, LM Studio, llama.cpp)**。创建模型时即固定。 |
| **API key source**(API 密钥来源) | **Enter a separate key (optional for local servers)**(输入单独的密钥，本地服务器可不填)，或者用 **Use key from …**(使用……的密钥) 借用另一个账号的密钥。关联的密钥会跟随之后的密钥更改。自定义 System One 或 OpenAI 兼容模型只有在两个地址的协议、主机和端口都相同时，才能借用自定义聊天账号的密钥。 |
| **Recent-message token budget**(最近消息 Token 预算) | 发送多少估算 Token 的聊天内容。范围 1 到 30,000。TypeSafe、OpenRouter、NanoGPT 和 Google Gemini 默认 30,000，自定义服务器默认 3,500。如果 NanoGPT、OpenRouter 或 Google Gemini 账号中的判定模型输入上限更小，则使用该上限的四分之三。Marinara 先丢弃较旧的消息，再裁掉最新消息里最旧的部分。请求被拒绝或超出预算时，不会得到答案。 |
| **Time limit (seconds)**(时限，秒) | 聊天中每条陈述等待多久。范围 0.5 到 30。默认 1.5，NanoGPT 和 OpenAI 兼容聊天模型默认 4。见[时限](#time-limits)。 |
| **Custom Request Headers**(自定义请求头) | 随每次判定请求发送的额外请求头，以 JSON 对象填写，例如 `{"x-billing-mode": "paygo"}`。此处不能填写密钥，身份验证请求头会被拒绝。 |

TypeSafe 发送到 `https://api.typesafe.ai`。可以把它的 **Base URL**(基础 URL) 换成另一台运行 TypeSafe API 的服务器，不带 `/v1/systemone`。这样仍然需要你的 TypeSafe 密钥，而密钥会发到那台服务器。**Custom System One endpoint** 接受你自己运行的 System One 服务器，例如 Open-Jev 或 [Strands decider](#run-strands-decider-yourself)。填写它的地址时不带 `/v1/systemone`。Ollama 这类聊天模型服务器不使用 System One。它要用 **OpenAI-compatible chat model**。

<a id="through-nanogpt"></a>
### 通过 NanoGPT

NanoGPT 提供 Jev Latest 等自己的判定模型。Marinara 会用你的 NanoGPT 密钥通过 Decisions API 请求判定。部分模型包含在 NanoGPT 订阅中，其余模型会从余额扣费。

1. 照常连接 NanoGPT。**Add** 的 **Decision** 类型按钮也会列出它。
2. 在 **Found in NanoGPT — use it for:**(在 NanoGPT 中找到，可用于) 下勾选 **Decision**。Marinara 会从你的订阅中选择判定模型，优先选择 Jev Latest。
3. 要换一个，点击 NanoGPT 账号的 **⋯**，再点击 **Add model**(添加模型)，然后打开 **Decision** 选项卡。这里只列出判定模型，订阅包含的模型会带有 **Plan**(套餐) 标记。选择一个模型，点击 **Test decision**(测试判定)。

判定模型无法聊天，因此不会出现在任何聊天模型列表中。

默认情况下，NanoGPT 决定请求使用订阅还是余额。要始终使用余额，打开判定模型的 **Edit model**，在 **Custom Request Headers** 中输入 `{"x-billing-mode": "paygo"}`。

<a id="through-openrouter-or-google-gemini"></a>
### 通过 OpenRouter 或 Google Gemini

OpenRouter 和 Google Gemini 账号也会列出各自的判定模型，Marinara 会用该账号的密钥请求对应服务的判定 API。OpenRouter 列出了许多模型，其中名称以 `:free` 结尾的可以免费使用。Google Gemini 只列出一个，即 **Gemini Decision 1**。

1. 照常连接 OpenRouter 或 Google Gemini。
2. 点击 **Jobs** 框中 **Behind the scenes** 下的 **Decision** 行，再点击左侧的账号。在 **Decision models** 下选一个模型。
3. 要测试它，打开模型的 **Edit model**，点击 **Test provider**。

在 OpenRouter 账号中，会返回对数概率的聊天模型列在下方的 **Chat models** 中，也可以用来判定。Google Gemini 账号只提供它的判定模型。

在此版本之前添加的账号一开始可能没有 **Decision models**，因为保存的模型列表早于这些判定模型。点击选择器里的刷新按钮，或等待 Marinara 每天刷新一次已保存的模型列表。

通过 **Add** 创建的独立 **OpenRouter** 判定账号仍可使用。它会用自己的密钥向同一个 API 发请求。

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

- [会查看图片的功能](#features-that-look-at-pictures)开启后，会检查新图片、跳过重复内容、复用背景并标记立绘的面部图片。它们需要能读取图片的判定模型。

激活问题决定智能体是否运行。智能体提示词里的判定陈述，决定告诉这个运行中的智能体什么内容。是或否的条件用 `{{#if decision:"..."}}`，在多个答案中选择用 `{{#if decision_choice:"..." == "..."}}`。

<a id="what-the-model-sees"></a>

### 会查看图片的功能

这些功能需要能读取图片的内置判定模型（Liquid d1、Valen 或 Winnow）。手动开启之前，它们全部关闭。没有这类模型时，选项会显示为灰色，旁边的 ⓘ 会说明原因。之前已经开启的选项仍可以关闭。

| 功能 | 位置 | 作用 |
| --- | --- | --- |
| **Picture check**(图片检查) | **Chat Settings → Agents → Illustrator**(聊天设置 → 智能体 → 插画师) | 查看每张新生成的 Illustrator 图片和自拍，检查是否画出了要求的内容。自拍还会与角色头像比较。**Make another if it doesn't match**(不符合要求时再生成一张) 会在不符合要求时再画一次。**Always make two, keep the better**(始终生成两张，保留较好的一张) 会画两张，保留更符合要求的一张。每多画一张，就多消耗一次图像生成。 |
| **Also check**(额外检查) | **Picture check** 下 | 自己添加的检查项，每行一条，最多 6 条，例如 `Kaelen has short red hair`。图片中不应出现的内容，以 `not:` 开头，例如 `not: The picture has writing or a watermark`。 |
| **Skip a picture the newest one already shows**(最新图片已展示的内容不再绘制) | Illustrator 卡片 | 绘制前，把聊天里最新的图片和准备绘制的内容比较，如果会重复同一个场景，就跳过。主动要求的图片始终会生成。 |
| **Reuse a library background that looks like the place**(复用图库中看起来符合该地点的背景) | Illustrator 卡片 | 如果图库里没有以新地点命名的背景，就查看最多 4 张名称中含有相同词语的背景，显示其中符合地点的一张，不再画新背景。见[用判定模型检查图片](../media/illustrator-agent.md#check-pictures-with-a-decision-model)。 |
| **Flag faces that don't match their expression**(标记不符合指定表情的面部图片) | **Generate Sprites**(生成立绘) 窗口，仅限表情 | 每张脸画好后都会检查，标记可能没有体现指定表情的图片，方便取消勾选或重新绘制。见[用 AI 生成立绘](../characters/sprites.md#generate-sprites-with-ai)。 |

模型关闭、太慢或失败，导致检查无法执行时，算作通过：生成的图片会原样保留。

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
- **TypeSafe、OpenRouter、NanoGPT、Google Gemini 或 Custom System One 账号：** 0.5
- **Built-in decision model：** 模型自己的推荐值；能测量的模型已用角色扮演回合测量过：JevK5、Liquid d1 和 Valen-Decision 1.5 4B 为 0.3；Valen 完整版和 Winnow 为 0.5（尚未测量）；Open-Jev 2B 和 9B 为 0.1。

智能体的 **Run when probability is at least**(运行所需的最低概率) 会覆盖这个值。保存的值与模型建议值不同时，编辑器会提供恢复建议值的选项。每次换模型都要检查它。提示词陈述和世界书 Decision 字段使用模型的默认值，智能体的阈值不会改变它们的阈值。

通过 Custom System One 账号接入的自托管 Open-Jev 仍然使用 0.5，因为 Marinara 无法校准任意的自定义端点。它的结果可能与内置的 Open-Jev 不同，包括把低于 0.5 的肯定结果读作否。

<a id="time-limits"></a>

## 时限

没有及时返回的判定算作没有答案，生成会按该功能的备用行为继续（见 [Marinara 在哪里使用它](#where-marinara-uses-it)）。所有时限都按陈述计算。一次请求里有多条陈述时，每条都获得这段时限；每个 Choice 答案也算一条陈述。本地模型一次只处理少量请求，所以陈述要排队，每条陈述的计时从模型开始处理它时算起。

- **TypeSafe、OpenRouter、Google Gemini 或 Custom System One 账号：** 1.5 秒，或你设置的 **Time limit**。实测中，OpenRouter 和 Google Gemini 在 0.2 到 0.5 秒内回答。
- **NanoGPT 判定模型：** 4 秒，或你设置的 **Time limit**。实测中，它在 0.4 到 2.5 秒内回答。
- **OpenAI 兼容聊天模型账号：** 4 秒，或你设置的 **Time limit**。必须先推理的模型至少获得 20 秒。
- **内置模型：** 4 秒。必须先推理的模型获得 20 秒。
- **Built-in decision model：** Open-Jev 的第一条陈述有 4 秒，之后每条采用实测耗时：2B 为 0.35 秒，9B 为 0.8 秒。其他模型每次启动时都会测量读取速度，并据此设置时限，因此较慢的处理器会得到更多时间。陈述每请求一张图片或一个视频片段，都会额外增加时间。模型首次启动之前，每条陈述有 4 秒，每张图片另加 30 秒，每个视频片段另加 60 秒。

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
- **选择器中某个账号没有显示 Decision models。** 它保存的模型列表早于判定模型。点击选择器里账号名旁的刷新按钮。
- **服务器没有该端点。** Decision 来源与服务器不匹配。Ollama、LM Studio 等聊天模型服务器需要 **OpenAI-compatible chat model**。**Custom System One endpoint** 只用于 Open-Jev 等 System One 服务器。
- **回答超过了时限，或者判定只是偶尔有效。** 该服务有时比 **Time limit** 慢。多测试几次，把时限提高到最慢那次回答以上。
- **带激活问题的智能体每回合都运行。** 没有设置 Decision 模型，或者它没有回答，所以智能体就像没有问题一样运行。运行一次测试。
- **提示词里的判定分支始终不出现。** 见[判定分支始终不出现时](../prompts/conditional-prompts.md#when-a-decision-branch-never-appears)。
- **Smart 回复顺序仍然执行原有的 AI 调用。** 开关是关闭的，或者 Decision 模型在那个回合没有回答。
- **图片设置显示为灰色，旁边有一个 ⓘ。** 所选判定模型只读取文本，或者尚未设置判定模型。选择 Liquid d1、Valen 或 Winnow 作为 **Built-in decision model**。见[选择哪种内置判定模型](#which-built-in-decision-model)。
- **带 `pictures:` 的陈述按否处理。** 使用 `media_within:` 时，是因为最新的几条消息里没有图片。否则，是图片让回答超过了时限。模型页面的 **On this computer**(在此电脑上) 一行会显示处理一张图片需要多久。
- **模型提示无法在此设备上运行。** 列表下的原因会指出缺少什么，例如某项处理器功能、某一代显卡或某个库。换一个模型；Liquid d1 和 JevK5 几乎能在任何电脑上运行。
- **自动管理活跃角色改为跟随 Character Tracker。** 模型没有为每个角色都给出答案；或者它先推理，而 **Also gate agents that run before the reply** 是关闭的；或者角色阵容太大，即使只放名字也塞不进模型的输入。

要在生成时查看判定的评分和输出，开启 Debug Mode，或者把日志级别设为 debug。见[日志级别](../CONFIGURATION.md#logging-levels)。要在不生成回复的情况下测试自己的陈述，打开 **Peek Prompt → Decision diagnostics → Test decisions**(Peek Prompt → 判定诊断 → 测试判定)。显式测试会调用选定的模型，在托管服务上可能产生费用。见[测试判定陈述](../chats/peek-prompt.md#testing-decision-statements)。

<a id="let-marinara-install-a-decision-model"></a>

## 让 Marinara 安装判定模型

**Built-in decision model** 是一个专用判定模型，由 Marinara 下载并在你的电脑上与聊天模型一起运行。所有内容都不会离开电脑。它占用的内存会叠加在聊天模型之上。如果已经在运行本地模型，先试试它的判定能力。

### 选择哪种内置判定模型

| 模型 | 下载 | 读取内容 | 语言 | 运行环境 |
| --- | --- | --- | --- | --- |
| **JevK5 4B** | 约 2.7 GB | 文本 | 英语 | 几乎任何电脑：NVIDIA、AMD、Intel 或 Apple 显卡，也可以只用处理器。与内置模型使用同一个运行时。 |
| **JevK5 2B** | 约 2 GB | 文本 | 英语 | 与 4B 相同。在处理器或小显卡上更快，准确度略低。 |
| **Liquid d1 3B** | 约 2.3 GB | 文本、图片 | 16 种，包括日语、中文、韩语、德语、西班牙语和俄语 | 几乎任何电脑。适合非英语聊天。个人和年营收低于 1000 万美元的公司可免费使用。 |
| **Valen-Decision 1.5 4B** | 约 5.8 GB | 文本、图片 | 已检查 8 种 | 配备 64 位 Intel 或 AMD 处理器的 Linux，只在处理器上运行。 |
| **Valen-Decision 1.5 2B (full release)** | 约 6.4 GB | 文本、图片、视频片段 | 未说明 | Windows、搭载 Apple silicon 的 macOS，以及 Linux，在处理器上运行。需要约 6 GB 内存。 |
| **Valen-Decision 1.5 4B (full release)** | 约 11.8 GB | 文本、图片、视频片段 | 已检查 8 种 | 与 2B 相同。需要约 12 GB 内存，更慢但更准确。 |
| **Winnow E4B** | 约 9 GB | 文本、图片 | 未说明 | 仅限配备 NVIDIA RTX 50 系列显卡、CUDA 13 库和支持 AVX-512 的处理器的 Linux（例如 AMD Ryzen 7000 或 9000；目前的 Intel 笔记本和台式机芯片不支持）。需要约 11 GB 显存。 |
| **Open-Jev 2B** | 约 4.6 GB | 文本 | 英语 | 配备 RTX 20 系列或更新 NVIDIA 显卡、580 或更新驱动的 Linux。占用约 4.8 GB 显存和 10 GB 磁盘空间。 |
| **Open-Jev 9B** | 约 19.4 GB | 文本 | 英语 | 与 2B 相同。占用约 23.6 GB 显存，所以 24 GB 显卡上放不下其他模型。 |

在 8 种语言的 20 个角色扮演回合中，JevK5 4B、Liquid d1 和 Valen-Decision 1.5 4B 全部答对。拿不准就选 Liquid d1；需要读取视频片段时，选 Valen 完整版。

下载任何内容之前，Marinara 会检查电脑能否运行模型：系统、处理器功能、显卡及其库，以及可用内存。无法运行的模型仍会留在列表里，标记为 **(cannot run here)**(无法在此设备运行)，并说明原因。

### 安装模型

1. 点击顶栏里的 **Connections**。在 **On this device**(在你的电脑上) 下点击 **Built-in model (decisions)**。也可以在 **Connections** 面板里点击 **Add**，再点击 **Decisions** 下的 **Built-in model (decisions)**。
2. 在 **Model**(模型) 列表里选择一个模型。下方会显示它的描述，然后是 **Answers** 和 **Reads**（见[模型页面列出什么](#what-a-model-page-lists)），以及语言和许可证。
3. 点击带模型名称和大小的 **Download**(下载)。确认大小、硬件判断和许可证。在此之前什么都不会下载。
4. 点击 **Use for Decision**(用于判定)，或者在 **Jobs** 框的 **Behind the scenes** 下点击 **Decision** 行，再选择 **Built-in model (decisions)**。

模型运行过后，它的页面还会显示 **On this computer**，列出在这台电脑上处理几轮聊天、一张图片，以及一个视频片段（支持读取时）的耗时。这些时间来自你自己的电脑，可以看出请求图片会让陈述的判定慢多少。

要切换模型，在列表里另选一个。之前下载过的模型会标记为 **(downloaded)**(已下载)，点击 **Use this model**(使用此模型) 就能切换过去，不必重新下载。

页面上的其他控件：

- **Turn off**(关闭) 会停止模型并保留文件。**Turn on**(开启) 会再次启动它。
- 电脑有多块 NVIDIA 显卡时，**Runs on**(运行设备) 用来选择使用哪块卡。更改它会停止模型，模型随后在新卡上重新启动。
- **Starts**(启动时机) 默认为 **When an agent first needs it**(在代理首次需要时)，也可以设为 **With Marinara**(随 Marinara 启动)。
- **Install from a repository**(从仓库安装) 接受 `owner/model-name` 形式的 Hugging Face 判定模型：Open-Jev 检查点、声明自己为判定模型的 GGUF，或 Valen GGUF 包。在名称后加上 `:Q8_0` 可以选择 GGUF 的一种大小。点击 **Check**(检查)。Marinara 会读取文件的自我描述，显示大小和许可证。无法确认的仓库会被拒绝，并附上原因。然后点击 **Download and install this one**(下载并安装这一个)。
- **Remove files**(删除文件) 会删除模型及其运行时。
- 已安装的模型因为文件或运行时缺失、过期而无法启动时（通常发生在更新之后），会出现 **Reinstall**(重新安装)。这时模型会标记为 **Needs reinstall**。重新安装会保留已经完整下载的文件，所以通常只需重新下载运行时。

模型启动后的第一次回答较慢，所以 Marinara 会在加载时问一个预热问题。预热失败时，模型照样启动，只是延迟落到第一个真正的问题上。如果模型刚启动就停止，页面会说明原因，例如处理器缺少它需要的某项功能。

### 自行运行 Strands decider

[Strands decider 2B](https://huggingface.co/StrandsAgents/strands-decider-2B-hobson-v19) 是另一个支持 System One 的开放判定模型（Apache-2.0）。Marinara 无法安装它，但只要你让它保持运行，它就能作为 **Custom System One endpoint** 使用。

1. 在 Python 3.10 或更新版本的环境中安装它并启动服务器：

   ```bash
   pip install strands-decider
   strands-decider serve StrandsAgents/strands-decider-2B-hobson-v19 --port 8000
   ```

   检测到 NVIDIA GPU 或 Apple silicon 时会使用它们，否则在处理器上运行，速度较慢。首次启动会下载模型和约 4.6 GB 的基础权重，它的 Python 包约占 5.5 GB。服务器没有密码，因此要让它保持在 `127.0.0.1` 上。

2. 添加一个 **Own decision server** 账号，**Server address** 设为 `http://127.0.0.1:8000`。模型名称可以随意填写。
3. 在 **Decision** 行上选中它，然后用账号 **⋯** 菜单里的 **Test** 测试。它启动后的第一次回答约需 2 秒，比默认时限更长，所以开始聊天前先测试一次。

它的概率经过校准，所以默认的 0.5 阈值适合它，这一点和自托管的 Open-Jev 不同（见[阈值](#thresholds)）。它的回答受措辞影响，所以请按照[编写陈述](../prompts/conditional-prompts.md#writing-statements)来写。

## 相关指南

- [创建自定义智能体](../agents/custom-agents.md)
- [条件提示词](../prompts/conditional-prompts.md)
- [群聊](../chats/group-chats.md)
- [内置模型设置](local-model.md)
- [连接 AI 服务商](connecting-to-a-provider.md)
