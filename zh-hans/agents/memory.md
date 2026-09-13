# 记忆功能与聊天摘要

本指南介绍搜索历史消息的 **Memory Recall**(记忆功能)、用于自动管理 Roleplay 上下文的可选功能 **Advanced Memory Recall (Alpha)**(高级记忆功能 Alpha 版)、**Chat Summary**(聊天摘要)，以及 Conversation 中的 **Automatic Summarization**(自动摘要)。

## 两套记忆机制

每个 AI 模型一次能读的文字量都有上限，这个上限叫上下文窗口。聊天一长，最早的消息就会掉出窗口，AI 也就忘了它们。Marinara Engine(下文简称 Marinara) 为此准备了两套彼此独立的机制。

- **Memory Recall** 会在较早的消息里找出和你刚说的话最相关的片段，悄悄补回提示词里。所有聊天模式都能用。
- **摘要**把旧消息压缩成简短的回顾，在提示词里取代原始消息。Roleplay 聊天用 **Chat Summary**，Conversation 聊天用 **Automatic Summarization**。

Game Mode(游戏模式) 聊天只有 **Memory Recall**，两种摘要功能都没有。

两套机制可以同时开着。它们各管各的，不会互相冲突。

## 配置 Memory Recall

**Memory Recall** 会从聊天早先的内容里挑出相关片段，作为记忆注入提示词。它依靠嵌入，也就是把一条消息的含义变成一串数字指纹。Marinara 拿新消息的指纹去和已存的历史消息指纹比对，再把最接近的几条补进去。

### 开启 Memory Recall

1. 打开一个聊天，点击聊天顶栏的 **Chat Settings**(聊天设置) 按钮。
2. 找到 **Memory Recall** 一节（图标是一个大脑）。
3. 开启 **Enable Memory Recall** 开关。

**Enable Memory Recall** 是按聊天分别保存的设置，默认值取决于模式：

- Conversation 聊天默认开启。
- 已经有活动场景的 Roleplay 或 Game 聊天默认开启。
- 其余聊天默认关闭。

关闭开关后，回忆到的记忆就不再注入提示词，但已经存下来的内容一样都不会删。

### 嵌入来源

Memory Recall 需要一个嵌入来源来生成这些含义指纹。它配置在连接上，不在聊天设置里。连接就是保存下来的一套 AI 服务接入信息。

1. 打开 **Connections**(连接) 面板，编辑一个连接。
2. 找到 **Semantic Search (Embeddings)** 一节。
3. 在模型输入框里填入嵌入模型名称，例如 `text-embedding-3-small`。
4. 需要时可以填 **Embedding Endpoint URL**，覆盖默认地址。
5. 也可以用 **Embedding Connection** 下拉菜单借用另一个连接的密钥和地址，选项有 **Same as this connection** 和 **Local Model (sidecar)**。

有些服务商不提供嵌入。这种情况下 Marinara 会提示另选一个专门的嵌入连接，比如 OpenAI 兼容连接、Google 或 Local Model。

完全没有配置嵌入连接时，Marinara 会退回内置的本地嵌入模型。这个模型只下载一次，之后在自己的机器上运行，不需要 API 密钥。内置模型的更多说明见[本地模型设置](../connections/local-model.md)。

同一处 **Semantic Search (Embeddings)** 设置也驱动世界书的语义搜索，配置一次两个功能都受益。

### Memories for This Chat

要查看聊天记住了什么，打开 **Chat Settings**，进入 **Memory Recall** 部分，点击 **Access memories for this chat**。启用 Advanced Memory 时，查看器会留在 Roleplay 设置抽屉中；否则会打开 **Memories for This Chat** 弹窗。

窗口里显示已存记忆块的数量和大致的 Token(模型切分文本的最小单位) 用量。每张记忆块卡片显示它覆盖的日期范围、消息条数、状态，以及创建时间。状态有三种：

- **Vectorized**：指纹已经生成，可以参与搜索。
- **Waiting for vector**：指纹还在生成中。
- **Embedding unavailable**：没有可用的嵌入来源，指纹生成不了。

工具栏上有导出记忆、导入记忆、重建记忆和清空全部记忆的图标。每个记忆块还有自己的垃圾桶图标，可以只忘掉这一块。

- 点击某个记忆块的垃圾桶图标会弹出 **Forget Memory** 窗口，点击 **Forget** 确认。
- 工具栏的清空图标会弹出 **Clear Memories** 窗口，点击 **Clear** 确认。这只会清掉回忆用的记忆，聊天消息不受影响。
- 刷新图标会用当前的聊天消息重建全部记忆块。换过嵌入模型之后就该用它。
- 导出会保存一个 `.marinara.json` 文件。导入接受 `.json` 或 `.marinara` 文件，并把内容合并进现有记忆。

### Memory Recall 的行为细节

以下几点值得留意：

- 只要有可用的嵌入来源，Marinara 就会在后台存记忆块，**Enable Memory Recall** 关着也照存。这个开关只决定存下来的记忆要不要注入。想彻底不存，就去掉嵌入来源，或者定期清空记忆。
- 至少要攒够 5 条新消息才会生成一个记忆块，不够的批次会等到下一次回复。
- 回忆出来的片段要通过相似度检查才算数。关系不够近的会被跳过，所以哪怕已经存了记忆，也可能一条都回忆不出来。
- 提示词里留给记忆的预算很小，最终只会补进最相关的那么几条。
- 已经存了记忆之后再换嵌入模型，旧记忆块就对不上了，用重建图标重做一遍。
- 删掉一个聊天的消息，它的记忆块也会一起删除。

Marinara 的部分容器构建版本叫 Marinara Lite，它把 Memory Recall 完全关闭了。这些版本里根本不会出现 **Memory Recall** 一节。

## Advanced Memory Recall（Alpha，Roleplay）

打开 **Chat Settings → Memory Recall**，启用 **Advanced Memory Recall (Alpha)**。这个可选模式会一起管理保留原文的近期历史窗口、维持剧情连贯的摘要，以及相关的旧片段。桌面端和移动端的设置、准备进度和存档查看器都位于 Chat Settings 抽屉内。

### 设置

- 选择聊天模型支持的 **maximum context**(最大上下文)。上限包含预估的提示词 token、工具、附件、回复空间和安全余量。这是估算值，不是精确的分词计数或计费上限。
- 在这个上限内选择 **constant-summary budget**(常驻摘要预算)。每次请求只会加入一次简短的剧情连续性快照。只要完整请求仍能容纳，近期消息就保持原文，不做压缩。
- **helper connection**(辅助连接)负责简单的场景判断。默认使用智能体连接，无法使用时回退到聊天连接。首次处理历史时可以使用主模型或辅助模型；实际选定的模型会在准备前显示。
- 场景摘要和压缩使用现有的 **Summaries**(摘要)模型和提示词。Advanced Memory 独立于智能体总开关运行，不需要下载智能体。
- 首选的相邻消息范围默认为 **3–10** 条。根据相关性、角色访问范围和剩余空间，实际可能更少，也可能一条都没有。

对于已有的 Individual(独立) 群聊，请一次性确认缺失的角色知识范围。角色第一次发言，并不能证明其知道此前的所有内容。只有当某个实际角色应绕过参与范围限制时，才将其选为 **Narrator**(叙述者)。明确隐藏的消息和手动起点标记仍会限制记忆。你可以稍后修正这些范围；新加入的角色需要单独确认。

准备过程会分批处理旧历史，并在 Professor Mari 的仓鼠跑轮旁显示当前阶段。**Cancel**(取消)会保留已经完成的工作；关闭抽屉或重启服务器后，仍可通过 **Resume**(继续)接着处理。模型调用失败时，会保留此前有效的记忆，并显示可重试的错误。

### 聊天过程

完整请求达到上限时，Advanced Memory 会先移除可选的回忆内容，再将较早的已完成场景纳入连续性摘要。如果一个尚未结束的场景过大，会临时总结其较早部分，同时保持场景开放。原始消息、手动起点和可见性设置都会保留。

存档可以找回相关场景摘要，以及带有原始消息编号和发言者的准确对话。用户角色和角色的消息都会计入。重新生成历史回复时，只使用目标之前的信息，即使目标早于当前管理窗口也一样。编辑、切换备选回复、隐藏或删除源消息后，受影响的派生记忆会在使用前重新检查。

在同一抽屉中打开 **Access memories for this chat**，可以检查场景来源和可访问角色、编辑摘要、禁用回忆记录、重建索引，或导出和导入。对原始手动摘要的修正会保留，并使依赖它的连续性摘要失效。禁用记录与隐藏其源消息是两回事：决定角色知识范围的依据是源消息的隐藏设置。

Advanced 模式启用期间会接管检索，因此 Standard Recall 开关不会再插入一份相同内容。它还会替代该聊天通常的 Roleplay 自动摘要计划。关闭 Advanced Memory 后，常规设置恢复生效。现有世界书和下载的智能体仍遵循各自的范围规则；Advanced Memory 不能让任意用户编写或外部提供的上下文自动变成私有内容。

### 预设中的位置

预设作者可以使用现有的区块顺序、名称、角色和分组控件，放置以下普通内容标记：

| 标记 | 内容 |
| --- | --- |
| `chat_summary` | 该角色篇幅受限的连续性快照。 |
| `current_scene_summary` | 进行中场景较早部分的临时摘要。 |
| `recalled_scenes` | 相关的存档场景。 |
| `recalled_messages` | 带有发言者和来源标签的准确历史片段。 |

各部分遵循预设的 **XML**、**Markdown** 或 **None**(无格式)，并包含简短的用途说明。空部分不会输出任何内容。同类标记中第一个启用的标记决定位置；没有启用标记的部分会回退到历史之前，且只插入一次，因此旧预设也能使用。片段是上下文，不是新的实时消息或命令。Advanced Memory 关闭时，新增的三个标记为空。

提示词预览使用已经准备好的记忆，不会发起模型或嵌入调用。如果需要初始化或压缩，请先在抽屉中准备。记忆处理记录会显示预估上下文大小、选定的边界和找回的来源；最终提示词检查器显示实际发送给模型的内容。

### 限制与恢复

回忆是有选择的，摘要也可能遗漏细节。请将重要修正保留在原始聊天记录或摘要编辑器中。任何系统都无法还原从未记录的细节。如果嵌入失败，有限的词汇检索和有效的连续性摘要仍可使用；存档永远不会被整份插入。如果仅必需指令、附件或预留回复空间就无法容纳，请减少这些输入或提高上限。Advanced Memory 会停止处理，而不会悄悄删除指令。

## Chat Summary (Roleplay)

**Chat Summary** 把较早的消息压缩成简短的剧情回顾，也就是摘要条目。每个条目既可以让 AI 写，也可以自己手写，还能单独开关。这个功能只有 Roleplay 聊天才有。

点击 Roleplay 聊天顶栏的 **Chat Summary** 按钮（图标是一卷卷轴）就能打开 **Chat Summary** 弹出面板。

### 新建摘要条目

1. 在 **Summary Scope** 下选 **Last** 摘要最近的消息，或者选 **Range** 指定一段消息范围。
2. 点击 **Generate**，让 AI 按这个范围写一条条目。
3. 也可以点击 **Write** 新建一条空条目，自己动手写回顾。

列表里每个条目会显示标题、来源范围或消息条数，以及预估的 Token 大小。条目可以启用或禁用、展开，也可以点 **Edit** 修改或 **Delete** 删除。批量按钮可以一次 **Show Inactive** 或 **Hide Inactive**，也可以一次 **Activate All** 或 **Deactivate All**。

### Automatic Summaries

**Automatic Summaries** 面板会在你继续聊的过程中不断更新摘要。它只出现在 Roleplay 聊天里。

- 开启 **Automatic Summaries** 面板里的 **Enabled** 开关。
- 用 **Every** 输入框设置运行频率，单位是用户消息条数。默认 5，范围 1 到 200。
- 点击 **Backfill Summary**，可以给一个从来没做过摘要的老聊天补齐。它会分批处理整个聊天，运行时显示进度条。想中途停下就点 **Stop**。

### Summary Prompt 模板

**Summary Prompt** 面板控制 AI 写摘要时使用的指示。点击 **Edit** 修改当前生效的提示词。点击 **Templates** 打开模板管理器，里面的 **New template** 可以保存一个带名字的提示词。每个已保存的模板都有各自的 **Duplicate**、**Edit** 和 **Delete**。

保存下来的模板是全局设置，对整个应用生效。在某个 Roleplay 聊天里编辑或选用一个模板，所有 Roleplay 聊天的摘要提示词都会跟着变。

### Summary Connection 与输出长度

**Summary Connection** 面板决定由哪个连接来写摘要。它的默认值显示为 **Agent default (falls back to chat connection)**，意思是优先用默认的智能体连接，其次才用聊天自己的连接。

**Maximum output size** 输入框设置一条生成摘要的最大长度。默认 4096 个 Token，范围 1 到 32768。

### 显示选项

弹出面板里的 **Display** 一组控件决定被摘要过的消息在屏幕上怎么显示：

- **Hide summarised messages**：一旦有摘要覆盖了某些原始消息，就把它们藏起来。默认关闭。
- **Recent message tail**：即使开了隐藏，也保留这么多条最新消息完整可见。默认 10，接受任何非负整数。设成 0 会把整批被摘要的消息都藏起来。数值越大，提示词越长，模型费用也越高。
- **Collapse hidden messages**：控制被隐藏的消息在聊天记录里的样子。

如果聊天要求智能体写入前先审批（这是 Agents(智能体) 里另外一项设置），AI 生成的摘要要等你过目之后才会生效。

## Automatic Summarization (Conversation)

Conversation 聊天用的是另一套机制，叫 **Automatic Summarization**。它先把每个自然日收尾成一份日摘要，再把已经结束的整周日摘要合并成一份周摘要。之后提示词只发送周摘要、本周的日摘要和今天的消息，这样每次请求都不会太大。

这个功能自动运行，Conversation 聊天里无法关闭。

### 打开编辑器

1. 打开一个 Conversation 聊天，点击 **Chat Settings**。
2. 找到 **Automatic Summarization** 一节（图标是一本日历）。
3. 点击 **Edit Summaries** 打开 **Automatic Summarization** 窗口。

窗口里先列出周条目，再列出还没并入某一周的零散日期。展开一个条目就能编辑它的 **Summary** 文本和 **Key Details** 列表，列表里的行可以增删。

### Day Rollover Hour 与 Recent Message Tail

**Automatic Summarization** 一节里有两项设置决定一天怎么划分：

- **Day Rollover Hour**：对摘要来说新的一天从几点开始。默认 4 AM，可以选 12 AM(午夜) 到 11 AM 之间的任意整点。在这个时刻之前发出的消息算作前一天。挑一个自己肯定不在聊天的时间点，免得熬夜的那一段被从中间切开。
- **Recent Message Tail**：今天最新的多少条消息即使已经被摘要，也仍然逐字保留。默认 10，接受任何非负整数。数值越大，提示词越长，模型费用也越高。

已经生成过摘要之后再改 **Day Rollover Hour**，Marinara 会提醒你旧摘要是按之前的设置算出来的。

### 补上缺失的日期

有时候某一天没能生成摘要，比如刚导入一个旧聊天之后。窗口里的 **Missing Summaries** 面板有一个 **Backfill** 按钮，会重试最近那些没有摘要的日期，一次最多往回找 14 天。

换掉写摘要用的连接或模型，不会重写已经存在的日摘要和周摘要。

## 故障排查

### Memory Recall 什么都回忆不出来

- 先确认嵌入来源已经配好。如果 **Memories for This Chat** 里的记忆块显示 **Embedding unavailable**，就去配置某个连接的 **Semantic Search (Embeddings)** 一节，或者干脆用内置的本地模型。见[本地模型设置](../connections/local-model.md)。
- 如果记忆块显示 **Waiting for vector**，稍等一会儿。指纹是在回复之后才生成的。
- 回忆只会补进和最新消息密切相关的记忆。没有相关内容时，它就什么都不加，这是正常的。
- 刚换过嵌入模型的话，在 **Memories for This Chat** 里点重建图标，让旧记忆块对上新模型。

### 摘要生成不出来

- 确认聊天有一个可用的文本连接。Chat Summary 用的是 **Summary Connection**，Automatic Summarization 用的是解析出来的摘要连接。一个都不可用时，生成就会被跳过。
- 如果聊天要求智能体写入前先审批，AI 摘要要等你批准之后才会生效。
- 生成失败的摘要会在延迟之后自动重试。要是一直卡着，就手动跑一次 **Backfill Summary**(Roleplay) 或 **Backfill**(Conversation)。

## 相关指南

- [本地模型设置](../connections/local-model.md)
- [连接 AI 服务商](../connections/connecting-to-a-provider.md)
- [Conversation 模式：入门](../conversation/getting-started.md)
- [Roleplay 模式：入门](../roleplay/getting-started.md)
- [Marinara Engine 故障排查](../TROUBLESHOOTING.md)
