# 创建自定义智能体

本指南介绍如何在 Marinara Engine 里做出自己的智能体。智能体是一个小型 AI 帮手，会在聊天过程中自动运行。下面会讲到怎么设置它的运行阶段、能力、输出类型、激活关键词、工具和提示词，最后配一个完整实例。

还不了解智能体？先读[智能体：聊天里的 AI 帮手](agents-overview.md)打个基础，再回来看这篇。

## 什么时候需要自定义智能体

Marinara Engine 提供了很多官方的可下载智能体。动手之前，先看看[可下载智能体参考](built-in-agents.md)和公开的 [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) 包仓库。目录里也许已经有满足需求的智能体，官方清单本身也是现成的包示例。

内置智能体覆盖不到的需求，才需要自己做。常见的合理理由有：

- 想要一个按自己的指令和口吻工作的帮手。
- 想在每次的提示词里注入一段固定说明。
- 想把每条回复改写成某种特定风格。
- 想让智能体调用自己写的自定义工具。

如果某个已安装的官方智能体已经很接近，直接复制它更省事。在 **Agents**(智能体) 面板里把鼠标移到它的卡片上，点击 **Copy agent**(复制智能体)，就能得到一份可编辑的自定义副本。

## 开始之前

动手之前有两件事要先弄清楚：

1. 智能体是按聊天设置的，不是按角色设置的。在库里做好一个智能体并不等于它会运行，必须把它加进某个聊天，并在 **Chat Settings**(聊天设置) 里开启 **Enable Agents**(启用智能体)。
2. 自定义智能体在所有聊天模式下都能用：Roleplay(角色扮演)、Game Mode(游戏模式) 和 Conversation(对话模式)。官方包只出现在它们支持的模式里，自己做的自定义智能体则处处可用。

## 创建自定义智能体

按下面的步骤从零创建一个新的自定义智能体。

1. 打开 **Agents** 面板。
2. 点击顶部的 **New**(新建) 按钮（加号图标）。
3. 整页的智能体编辑器会打开，里面是一个空白的自定义智能体。
4. 在顶部的标题输入框里填写名称，例如 `Weather Reporter`。
5. 填好 **Description**(描述) 和 **Author**(作者) 输入框，方便日后回想它的用途。
6. 选择一个 **Pipeline Phase**(流程阶段)，具体见下文。
7. 在 **Custom Agent Abilities**(自定义智能体能力) 下开启需要的能力。
8. 挑一个与预期产出相符的 **Result Type**(结果类型)。
9. 在 **Prompt Template**(提示词模板) 下写智能体的指令。
10. 点击顶栏的 **Save**(保存)。应该会看到一个绿色的 **Saved** 角标。

新建的智能体现在会出现在 **Agents** 面板的 **Custom Agents**(自定义智能体) 区域。要用它，先打开一个聊天，进入 **Chat Settings**，开启 **Enable Agents**，再从那里的 **Custom Agents** 区域把它添加进来。

## Pipeline Phase

**Pipeline Phase** 决定智能体在什么时候运行。三个按钮里选一个：

- **Pre-Generation**(生成前)：在 AI 回复之前运行，可以补充上下文或修改提示词。
- **Parallel**(并行)：与回复同时运行，看不到写完的回复。
- **Post-Processing**(生成后)：在回复完成之后运行，可以读取回复，部分结果类型还能修改回复。

有些结果类型会强制指定阶段。选 **Text Rewrite**(文本改写)，阶段会自动切到 **Post-Processing**；选 **Prompt Patch**(提示词补丁)，阶段会自动切到 **Pre-Generation**。因为这两类活儿只有在对应阶段才说得通。

Post-Processing 的自定义智能体还会多出一个 **Turn Data Access**(回合数据访问) 区域，里面有两个可选开关：**Pre-generation injections** 和 **Parallel agent results**。开启后，智能体就能读到同一回合内其他智能体的产出。保持关闭，智能体则彼此隔离。

## Custom Agent Abilities

**Custom Agent Abilities** 里的能力都要主动开启，开关不打开就一直用不了。默认状态下自定义智能体因此是安全的。可用的能力有：

| 能力 | 允许智能体做什么 |
|---|---|
| **Create lorebooks** | 世界书类输出没有指定目标时，新建一本由智能体生成的世界书。 |
| **Edit lorebooks** | 写入世界书条目，或生成世界书更新结果。 |
| **Edit messages** | 用改写后的文本替换生成的消息，或给消息添加续写选项。 |
| **Edit trackers** | 更新游戏、角色、用户角色或自定义追踪器的状态。 |
| **Frontend styling** | 在生成过程中应用临时的视觉样式效果。 |
| **Change chat backgrounds** | 更改并保存某个聊天所选的背景。 |
| **Change character sprites** | 更改聊天中显示的角色和用户角色立绘表情。 |
| **Control media playback** | 控制 Spotify、YouTube 或本地音乐的播放。 |
| **Control haptic devices** | 向已连接的触觉设备发送受限指令。 |
| **Edit About Me details** | 修改聊天专属的 About Me 文本。改动公开卡片仍需另行批准。 |
| **Image generation** | 用一段图像提示词触发图像生成器。 |
| **Vectors/embeddings** | 使用向量或嵌入上下文。向量是一种按含义搜索文本的方式。 |
| **Main prompt edits** | 修改发给主 AI 模型的提示词。 |

世界书是一组背景设定条目，AI 可以在场景中调用它们。追踪器是一块实时面板，用来记录属性、心情、地点这类信息。

开启 **Edit lorebooks** 后会出现 **Lorebook Writer**(世界书写入) 区域。开启 **Allow lorebook entry writes**，再在 **Target lorebook** 下拉菜单里选一本世界书。智能体只能写入这一本。

## Result Type

**Result Type** 告诉 Marinara 该怎么读取智能体的输出。多数结果类型要求智能体返回 JSON。JSON 是一种用花括号和引号书写的简单文本格式。每种结果类型都需要上表中对应的能力。

| 结果类型 | 作用 | 需要的能力 |
|---|---|---|
| **Context Injection**(上下文注入) | 在生成前添加文本，或在生成后记录一条备注。 | 无 |
| **Text Rewrite** | 在回复之后运行，替换消息文本。 | Edit messages |
| **Lorebook Update** | 创建或更新世界书条目。 | Edit lorebooks |
| **Character Tracker** | 更新角色追踪器（在场角色）。 | Edit trackers |
| **Persona Stats** | 更新用户角色的属性、状态和物品栏。 | Edit trackers |
| **Custom Tracker** | 替换自定义追踪器的字段。 | Edit trackers |
| **Game State** | 更新世界状态类的游戏数据。 | Edit trackers |
| **Image Prompt** | 让图像生成器画出一个场景。 | Image generation |
| **Prompt Patch** | 添加、前置或替换提示词段落。 | Main prompt edits |
| **Frontend Style** | 应用临时的样式效果。 | Frontend styling |
| **Background Change** | 选定并保存一张可用的聊天背景。 | Change chat backgrounds |
| **Sprite Change** | 更改聊天中显示的角色和用户角色立绘表情。 | Change character sprites |
| **Spotify Control** | 控制 Spotify 播放。 | Control media playback |
| **YouTube Control** | 控制 YouTube 播放。 | Control media playback |
| **Local Music Control** | 控制本地音乐库的播放。 | Control media playback |
| **Haptic Command** | 向已连接的触觉设备发送受限指令。 | Control haptic devices |
| **About Me Update** | 更新聊天专属的 About Me 文本，并提出公开资料的修改建议。 | Edit About Me details |
| **Interactive Choices** | 给生成的消息添加续写选项。 | Edit messages |

**Context Injection** 是最好上手的起点，既不用开任何能力开关，也没有严格的输出格式要求。只想让智能体往提示词里补一段短说明，或者记录一段摘要时，用它就够了。

结果类型是灰的，说明对应的能力还没开启。在 **Custom Agent Abilities** 下开启对应开关，这个结果类型就能点了。

### 图像智能体的单聊天控制

拥有 **Image generation** 能力的智能体会在 **Chat Settings → Agents → Custom Agents** 卡片中多出两个控制项，它们位于每个自定义智能体都有的提示词模板选择器旁边：

- **Image Connection** — 仅为当前聊天覆盖该智能体使用的图像连接。保留 **Agent default** 可继续使用智能体自身设置中的连接。聊天级的 **Image Style** 也会应用于自定义智能体图像，因此无需复制智能体就能让它在不同聊天中采用不同的渲染方式。
- **Camera button** — 不等待激活关键词，立即用该智能体生成图像。提示词仍由智能体自己编写；如果模板决定不生成提示词，则会显示错误通知而不是图像。

## Activation Keywords

自定义智能体默认按固定节奏运行。**Activation Keywords**(激活关键词) 可以让它在场景无关时直接跳过，省下 Token 和费用。Token 是 AI 用来计数的一小段文本。

设置方法：

1. 在 **Activation Keywords** 区域，每行填一个关键词或短语。例如：

```
tavern
secret door
moonlit ritual
```

2. 把 **Scan Depth**(扫描深度) 设为要搜索的最近消息条数，默认是 5，最大是 200。
3. 之后只有当这些最近消息里出现至少一个关键词时，智能体才会运行。

关键词框留空，智能体就按固定节奏每次都运行。

## 挂载工具（Function Calling）

智能体可以调用工具。工具是 AI 能执行的一个函数，用来获取或改动某样东西，再把结果读回来。这也叫函数调用。

要挂载工具，打开 **Tools / Function Calling**(工具/函数调用) 区域，逐个开启或关闭工具。列表里既有内置工具，也有自己做过的自定义工具。想学怎么自己写，可以读[自定义工具](../extending/custom-tools.md)。

工具能不能用，还取决于聊天本身是否放行。在 **Chat Settings** 里打开 **Function Calling** 区域，开启 **Enable Tool Use**(启用工具调用)。少了这项聊天设置，就算在这里开启了开关，智能体的工具依然不生效。

导入进来的智能体文件不会自带工具权限。导入之后，先检查它的提示词和设置，再自行勾选想让它使用的工具。

## 命名提示词选项

一个智能体可以带好几套提示词变体，这就是 **Named prompt options**(命名提示词选项) 功能。这样每个聊天都能挑其中一套，而不必改动智能体本身。

添加一套变体：

1. 在 **Prompt Template** 下找到 **Named prompt options**。
2. 点击 **Add option**(添加选项)。
3. 给这个选项起个名字，再写一句简短说明。
4. 为它写完整的提示词正文。

别人把这个智能体加进聊天时，会看到一个 **Prompt Mode**(提示词模式) 下拉菜单，列出所有命名选项。一个都没加的话，聊天菜单里就只有默认提示词。

## 其他可调的设置

自定义智能体和内置智能体共用一部分设置：

- **Connection Override**(连接覆盖)：给这个智能体单独指定一个 AI 连接，比如后台工作用更便宜的模型。留空就沿用聊天本身的连接。
- **Agent Budget**(智能体预算)：设置 **Context Size**(智能体读取的最近消息条数，默认 5)，以及 **Max Output Tokens**(预留的输出空间，默认 4096，取值范围 128 到 32768)。
- **Add as Prompt Section**(作为提示词段落加入)：开启后，智能体的最新输出会作为一个段落暴露出来，可以在提示词预设里注入。

`{{user}}`、`{{char}}` 这类宏在 **Prompt Template** 里同样有效。完整列表见[宏](../prompts/macros.md)。

## 完整实例

下面是一个完整的自定义智能体，作用是把每条回复都改写成英式英语。

编辑器里的设置：

1. 命名为 `British English Editor`。
2. 在 **Custom Agent Abilities** 下开启 **Edit messages**。
3. 在 **Result Type** 下选 **Text Rewrite**，阶段会自动切换到 **Post-Processing**。
4. 把下面这段粘贴进 **Prompt Template**：

```
You are a copy editor. Rewrite the latest reply into British English.
Change spelling and vocabulary only. Do not change the meaning, tone, or events.
Return JSON with an "editedText" field holding the full rewritten reply,
and a "changes" array of short notes describing what you changed.
```

5. 点击 **Save**。
6. 打开一个 Roleplay 聊天，进入 **Chat Settings**，开启 **Enable Agents**，再从 **Custom Agents** 区域添加 `British English Editor`。

每条回复之后，智能体会返回这样的 JSON：

```
{"editedText":"The colour of the harbour caught her eye.","changes":[{"description":"color to colour, harbor to harbour"}]}
```

Marinara 读取 `editedText`，把它换进回复里，于是消息就成了英式英语。`changes` 里的说明会作为一小段摘要显示，告诉你智能体改动了哪些地方。

## 导入和导出智能体

自定义智能体可以作为文件分享出去。

要从编辑器导出，点击顶栏的 **Export agent**(导出智能体) 按钮（上传图标），这会把智能体的提示词和配置保存成一个包。智能体包永远不包含自定义工具的定义。

一次导出多个智能体，可以在 **Agents** 面板里用 **Select agents**(选择智能体)，勾选需要的智能体，然后整组导出。

外部智能体导入默认是锁住的。先打开 **Settings → Advanced → Danger Zone**，启用 **Allow custom Agent imports**(允许导入自定义智能体)。这个开关不需要改 `.env`。它只影响通过文件、文件夹或自定义仓库提供的智能体：在 Marinara 里自己创建的智能体，以及通过 **Download Agents**(下载智能体) 安装的官方智能体，照常可用。

要导入，打开 **Agents** 面板，单个文件点 **Import agents**(导入智能体)，整个文件夹点 **Import agent folder**(导入智能体文件夹)。在存下任何内容之前，Marinara 都会先弹出一次权限审核。只批准这个智能体确实需要的能力，没勾选的能力保持禁用。每次文件导入都会得到一个新的自定义身份，所以它无法顶替内部类型相同的官方智能体。

出于安全考虑，Marinara 会忽略包里附带的函数，清空导入设置中的工具选择，在应用临时 CSS 之前先做净化，并且在导入的智能体改动消息、追踪器、世界书、背景、立绘、媒体、触觉设备、About Me 数据、提示词或生成图像之前，先核对已批准的能力。可信的函数请单独从 **Function Calls** 导入，检查过后再明确挂载到智能体上。把 Danger Zone 的开关重新关闭，外部导入的智能体就不会再运行，本地编写的和官方的智能体则不受影响。

## 相关指南

- [智能体：聊天里的 AI 帮手](agents-overview.md)
- [可下载智能体参考](built-in-agents.md)
- [自定义工具](../extending/custom-tools.md)
- [宏](../prompts/macros.md)
