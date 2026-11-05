# 创建自定义智能体

自定义智能体是你自己编写的帮手：它的指令、什么时候运行、允许改动什么，都由你决定。没有哪个[可下载智能体](built-in-agents.md)能满足需求时，就自己做一个。如果某个已安装的智能体已经很接近，在 **Agents**(智能体) 面板里把鼠标移到它的卡片上，点击 **Copy agent**(复制智能体)，就能得到一份可编辑的副本。

开始之前：先读[智能体：聊天里的 AI 帮手](agents-overview.md)。做好一个智能体并不会让它运行，之后还要把它加进聊天。自定义智能体在所有聊天模式下都能用。

## 新建一个自定义智能体

1. 打开 **Agents** 面板。
2. 点击顶部附近的 **New**(新建)（加号图标）。整页的智能体编辑器会打开。
3. 在标题输入框里填写名称，例如 `Weather Reporter`。
4. 填好 **Description**(描述) 和 **Author**(作者)。
5. 选择一个 **Pipeline Phase**(流程阶段)（见 [Pipeline Phase](#pipeline-phase)）。
6. 在 **Custom Agent Abilities**(自定义智能体能力) 下开启它需要的能力。
7. 挑一个与智能体产出相符的 **Result Type**(结果类型)。拿不准的话，选 **Context Injection**(上下文注入)。它不需要任何能力，也没有严格的输出格式。
8. 在 **Prompt Template**(提示词模板) 下写它的指令。
9. 点击顶栏的 **Save**(保存)。会出现一个绿色的 **Saved** 角标。

智能体现在会出现在 **Agents** 面板的 **Custom Agents**(自定义智能体) 区域。要使用它，打开一个聊天，进入 **Chat Settings**(聊天设置)，开启 **Enable Agents**(启用智能体)，再从 **Custom Agents** 里添加这个智能体。

## Pipeline Phase

**Pipeline Phase** 决定智能体在什么时候运行。

- **Pre-Generation**(生成前)：在回复之前运行，可以补充上下文或修改提示词。
- **Parallel**(并行)：与回复同时运行，看不到写完的回复。
- **Post-Processing**(生成后)：在回复之后运行，可以读取回复，部分结果类型还能修改回复。

有些结果类型会强制指定阶段。**Text Rewrite**(文本改写) 会切到 **Post-Processing**。**Prompt Patch**(提示词补丁) 和 **Character Activity**(角色活动) 会切到 **Pre-Generation**。

Post-Processing 智能体还会多出一个 **Turn Data Access**(回合数据访问) 区域，里面有两个开关：**Pre-generation injections**(生成前注入) 和 **Parallel agent results**(并行智能体结果)。打开它们，智能体就能读到同一回合内其他智能体的产出。

## Custom Agent Abilities

能力需要你主动开启。每项能力在你打开它的开关之前都用不了。

- **Create lorebooks**(创建世界书)：世界书类输出没有指定目标时，新建一本由智能体生成的世界书。
- **Edit lorebooks**(编辑世界书)：写入世界书条目，或返回世界书更新结果。
- **Edit messages**(编辑消息)：替换生成的消息文本，或给消息添加续写选项。
- **Edit trackers**(编辑追踪器)：更新游戏、角色、用户角色或自定义追踪器的状态。
- **Frontend styling**(前端样式)：在生成过程中应用临时的视觉样式。
- **Change chat backgrounds**(更换聊天背景)：更改并保存某个聊天的背景。
- **Change character sprites**(更换角色立绘)：更改聊天中显示的角色和用户角色表情。
- **Control media playback**(控制媒体播放)：控制 Spotify、YouTube 或本地音乐。
- **Control haptic devices**(控制触觉设备)：向已连接的触觉设备发送受限指令。
- **Edit About Me details**(编辑 About Me 信息)：修改聊天专属的 About Me 文本。改动公开卡片仍需你批准。
- **Image generation**(图像生成)：把一段图像提示词发给图像生成器。
- **Vectors/embeddings**(向量/嵌入)：使用向量上下文。向量能让 Marinara 按含义搜索文本。
- **Main prompt edits**(修改主提示词)：修改发给主模型的提示词。
- **Create character cards**(创建角色卡)：提议一张新的角色卡。只有在你审阅并接受之后，它才会被保存。
- **Choose active chat characters**(选择聊天中的活跃角色)：为当前的 Conversation(对话模式) 或 Roleplay(角色扮演) 回复，选择启用聊天里已加入的哪些角色。

如果开启了 **Edit lorebooks**，会出现 **Lorebook Writer**(世界书写入) 区域。打开 **Allow lorebook entry writes**(允许写入世界书条目)，再在 **Target lorebook**(目标世界书) 里选一本世界书。智能体只能写入这一本。

## Result Type

**Result Type** 告诉 Marinara 该怎么读取智能体的回答。多数类型要求 JSON，这是一种用花括号和引号书写的文本格式。在你开启某个类型所需的能力之前，它会一直显示为灰色。

不需要能力的类型：

- **Context Injection**：在生成前添加文本，或在生成后记录一条备注。最容易上手。

需要 **Edit messages** 的类型：

- **Text Rewrite**：在回复之后替换消息文本。
- **Interactive Choices**(互动选项)：给消息添加续写选项。

需要 **Edit trackers** 的类型：

- **Character Tracker**(角色追踪器)：更新在场角色。
- **Persona Stats**(用户角色属性)：更新用户角色的属性、状态和物品栏。
- **Custom Tracker**(自定义追踪器)：替换自定义追踪器的字段。
- **Game State**(游戏状态)：更新世界状态类的游戏数据。

其他类型各自需要一项对应的能力：

- **Lorebook Update**(世界书更新)：创建或更新世界书条目（Edit lorebooks）。
- **Image Prompt**(图像提示词)：让图像生成器画出一个场景（Image generation）。
- **Prompt Patch**：添加、前置或替换提示词段落（Main prompt edits）。
- **Frontend Style**(前端样式)：应用临时的样式效果（Frontend styling）。
- **Background Change**(更换背景)：选定并保存一张可用的背景（Change chat backgrounds）。
- **Sprite Change**(更换立绘)：更改聊天中显示的表情（Change character sprites）。
- **Spotify Control**(Spotify 控制)、**YouTube Control**(YouTube 控制)、**Local Music Control**(本地音乐控制)：控制播放（Control media playback）。
- **Haptic Command**(触觉指令)：向触觉设备发送受限指令（Control haptic devices）。
- **About Me Update**(About Me 更新)：更新聊天专属的 About Me 文本，并提出公开资料的修改建议（Edit About Me details）。
- **Character Card Creation**(角色卡创建)：提议一张可编辑的角色卡，等你批准（Create character cards）。
- **Character Activity**：选择当前回复使用的角色卡（Choose active chat characters）。它在回复之前运行，并且必须至少选中一个已加入聊天的角色。

### 图像智能体在聊天中的控制项

拥有 **Image generation** 能力的智能体会在 **Chat Settings → Agents → Custom Agents**(聊天设置 → 智能体 → 自定义智能体) 里多出两个控制项。

- **Image model**(图像模型)：只在这个聊天里为这个智能体覆盖图像连接。保持 **Agent default**(智能体默认值) 就会沿用智能体自己的设置。聊天的 **Image Style**(图像风格) 也会作用于自定义智能体生成的图像。
- **Camera button**(相机按钮)：立即生成一张图像，不等激活关键词。如果智能体的模板决定不写提示词，你会看到一条错误通知，而不是图像。

## Activation Keywords

默认情况下，智能体按它正常的节奏（也就是多久运行一次）运行。**Activation Keywords**(激活关键词) 会在场景不相关时跳过智能体，省下 Token。

1. 在 **Activation Keywords** 里每行填一个关键词或短语，例如 `tavern` 或 `secret door`。
2. 把 **Scan Depth**(扫描深度) 设为要搜索的最近消息条数。默认是 5，最大是 200。

之后只有当这些消息里出现某个关键词时，智能体才会运行。框留空就关闭这个筛选。频率和激活问题仍然适用。

## 挂载工具

智能体可以调用工具：工具是 AI 能执行的函数，用来获取或改动某样东西，再把结果读回来。这也叫函数调用。

1. 在智能体编辑器里打开 **Tools / Function Calling**(工具/函数调用)，逐个开启想用的工具。列表里既有内置工具，也有你自己的工具。要自己做一个，见[自定义工具](../extending/custom-tools.md)。
2. 在 **Chat Settings** 里打开 **Function Calling**(函数调用)，开启 **Enable Tool Use**(启用工具调用)。少了这一项，智能体的工具一直不生效。

导入的智能体永远不会获得工具权限。先检查导入的智能体，再自己为它选好工具。

智能体每次运行最多进行 16 轮工具调用（服务器的 `MAX_TOOL_ROUNDS` 更低时则更少），之后就用手头已有的结果作答。一次只调用一个工具的模型，每次调用都要用掉一轮，所以要保存很多条目的智能体，应该在一次回复里发起多个调用。世界书回填每次运行最多可用 64 轮。

## 命名提示词选项

一个智能体可以带好几套提示词变体，这样每个聊天都能挑一套，而不必改动智能体。

1. 在 **Prompt Template** 下找到 **Named prompt options**(命名提示词选项)。
2. 点击 **Add option**(添加选项)。
3. 给它起个名字，写一句简短说明，再写完整的提示词。

有人把这个智能体加进聊天时，会看到一个 **Prompt Mode**(提示词模式) 下拉菜单，列出你的选项。一个选项都没有时，只显示默认提示词。

## 其他设置

- **Model override**(模型覆盖)：给这个智能体换一个模型，比如更便宜的模型。留空就沿用聊天的模型。智能体会发送该连接上保存的生成参数。见[智能体参数](../prompts/generation-parameters.md#parameters-for-agents)。
- **Agent Budget**(智能体预算)：**Context Size**(上下文大小) 是智能体读取的最近消息条数（默认 5）。**Max Output Tokens**(最大输出 Token 数) 是预留的输出空间（默认 4096，范围 128 到 32768）。
- **Add as Prompt Section**(作为提示词段落加入)：把智能体的最新输出作为一个段落暴露出来，可以放进提示词预设。

`{{user}}`、`{{char}}` 这类宏在 **Prompt Template** 里同样有效。见[宏](../prompts/macros.md)。

## 完整实例

这个智能体会把每条回复改写成英式英语。

1. 命名为 `British English Editor`。
2. 在 **Custom Agent Abilities** 下开启 **Edit messages**。
3. 在 **Result Type** 下选 **Text Rewrite**。阶段会切换到 **Post-Processing**。
4. 把下面这段粘贴进 **Prompt Template**：

   ```text
   You are a copy editor. Rewrite the latest reply into British English.
   Change spelling and vocabulary only. Do not change the meaning, tone, or events.
   Return JSON with an "editedText" field holding the full rewritten reply,
   and a "changes" array of short notes describing what you changed.
   ```

5. 点击 **Save**。
6. 打开一个 Roleplay 聊天，在 **Chat Settings** 里开启 **Enable Agents**，再从 **Custom Agents** 添加这个智能体。

每条回复之后，智能体会返回这样的 JSON：

```json
{"editedText":"The colour of the harbour caught her eye.","changes":[{"description":"color to colour, harbor to harbour"}]}
```

Marinara 把 `editedText` 换进回复里。`changes` 里的说明会显示为一小段摘要。

## 导入和导出智能体

要导出一个智能体，点击编辑器顶栏的 **Export agent**(导出智能体)（上传图标）。文件里包含智能体的提示词和设置，但永远不包含自定义工具的定义。要导出多个，在 **Agents** 面板里用 **Select agents**(选择智能体)，选好后导出。

外部导入默认是锁住的。

1. 打开 **Settings → Advanced → Danger Zone**(设置 → 高级 → 危险区域)，开启 **Allow custom Agent imports**(允许导入自定义智能体)。不需要改 `.env`。
2. 在 **Agents** 面板里点击 **Import agents**(导入智能体)，选择智能体文件或文件夹。
3. 检查 Marinara 列出的权限清单。只批准这个智能体确实需要的权限。没勾选的能力保持禁用。

这个锁只影响来自文件、文件夹或自定义仓库的智能体。你自己创建的智能体，以及从 **Agent Organizer**(智能体管理器) 安装的官方智能体，照常可用。每个导入的文件都会得到一个新的自定义身份，所以它无法顶替官方智能体。

出于安全考虑，Marinara 会忽略附带的函数，清空工具选择，清理临时 CSS，并在导入的智能体改动消息、追踪器、世界书、背景、立绘、媒体、触觉设备、About Me 数据、提示词或图像之前，先核对已批准的能力。可信的函数要单独导入，检查之后再自己挂载到智能体上。把 **Danger Zone** 开关关掉，导入的智能体就会停止运行。

<a id="activation-questions"></a>

## 激活问题

激活问题会询问最近的场景是否需要你的智能体。它能识别关键词漏掉的改述。它需要一个 **Decision model**(判定模型)，也就是回答是非问题的小模型。在 Connections(连接) 面板里选一个，见 [Decision 模型](../connections/decision-models.md)。**Decision model** 设为默认的 **None**(无) 时，问题字段保持禁用，带问题的智能体会像没有问题一样运行。

1. 打开这个自定义智能体。
2. 输入最多 500 个字符的 **Question**(问题)。其中可以使用 `{{user}}` 和 `{{char}}` 宏。
3. 把 **Run when probability is at least**(运行所需的最低概率) 设为这个智能体的阈值。“是”的概率达到这个值时智能体才运行，所以值越高，跳过的次数越多。编辑器会为你的模型给出推荐值：本地聊天模型和 Decision 账号为 0.5，内置 Open-Jev 模型为 0.1。切换模型之后，用自己的聊天核对一下。见[阈值](../connections/decision-models.md#thresholds)。
4. 可选：设置 **Bypass the question after this many messages without a successful run**(连续指定消息数未成功运行后跳过问题)。经过这么多条消息后，问题就会被跳过，这样一个一直回答“否”的模型就无法让智能体永远沉默。关键词和频率仍然适用。

把问题写成关于最新消息的陈述，例如 `The latest message moves the scene to a new place.`，小模型回答它比回答 `Did the scene change?` 更可靠。见[编写陈述](../prompts/conditional-prompts.md#writing-statements)。

运行方式：

- 先检查关键词和频率，所以被跳过的智能体不会产生判定请求。扫描深度相同的问题会按阶段批量处理。
- **Scan Depth** 同时决定关键词和问题使用哪些消息。
- 生成前和并行智能体使用回复之前的聊天。生成后智能体还能看到写完的回复。
- 超时、模型不可用或答案无效时，智能体正常运行。时限取决于模型类型，以及模型是否需要先推理。见[时限](../connections/decision-models.md#time-limits)。
- 带有激活问题或判定陈述的导入智能体会显示一条通知，链接到 Decision 模型指南。没有 Decision 模型时，只要关键词和 **Trigger Cadence**(触发频率) 允许，智能体就会运行，提示词里的陈述按否处理。

激活问题只适用于自定义智能体。

<a id="decision-statements-in-the-agents-prompt"></a>

## 智能体提示词中的判定陈述

激活问题决定智能体是否运行。**Prompt Template** 里的判定陈述决定运行中的智能体会收到什么指示。语法见[条件提示词](../prompts/conditional-prompts.md#asking-the-decision-model)：

```text
{{#if decision:"In the latest message, the characters move to a different location"}}
Update the location field.
{{else}}
Leave the location as it is.
{{/if}}
```

用它们可以在平静的回合发送更小的提示词。追踪器可以只在地点改变时更新地点。图像智能体可以只在场景改变时描述新图片。音乐智能体可以只在氛围转变时换曲。要从几组指示里挑一组，使用 `{{#if decision_choice:"The kind of scene in the latest message" == "combat"}}`，然后是 `{{else if decision_choice:"The kind of scene in the latest message" == "dialogue"}}`，依此类推。见[条件提示词](../prompts/conditional-prompts.md#asking-the-decision-model)。

- 生成前和并行智能体读取回复之前的聊天，并与主提示词共享答案。生成后智能体读取写完的回复，它们的陈述会带上这条回复重新询问。
- 重新运行智能体时，会复用同一回合、同一模型、同一组陈述下仍在缓存中的成功答案。见[答案复用](../prompts/conditional-prompts.md#answer-reuse)。
- 在智能体提示词里，`{{char}}` 指代聊天中的所有角色，所以群聊里的 `{{char}} is angry` 会变成“Kaelen, Alyssa is angry”。请直接写出角色名，或者写“a character”。
- 没有答案时，陈述按否处理。要让 `{{else}}` 分支也说得通，因为很多用户没有 Decision 模型。

从 Marinara-Agents 安装的智能体也以同样的方式渲染提示词。

## 相关指南

- [智能体：聊天里的 AI 帮手](agents-overview.md)
- [Decision 模型](../connections/decision-models.md)
- [可下载智能体参考](built-in-agents.md)
- [自定义工具](../extending/custom-tools.md)
- [宏](../prompts/macros.md)
