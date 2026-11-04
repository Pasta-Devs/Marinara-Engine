# 预设编辑器与提示词管理器

预设是一份保存下来的提示词蓝图。提示词就是 Marinara 每次回复时发给模型的那段文字。预设决定里面放哪些内容、按什么顺序放：你的指令、角色卡、用户角色、聊天记录、世界书条目等等。用 **Preset Editor**(预设编辑器) 做一个预设，然后把它指派给聊天。

预设负责组装 **Roleplay**(角色扮演) 聊天的提示词。**Conversation**(对话模式) 和 **Game**(游戏模式) 聊天则改用单独一个提示词输入框（见 [Conversation 和 Game 聊天](#conversation-and-game-chats)）。预设本身不需要 API 密钥，但要把提示词发出去，仍然需要一个能用的账号。见[连接 AI 服务商](../connections/connecting-to-a-provider.md)。

## 把预设指派给聊天

预设只有被聊天使用才会起作用。在 **Roleplay** 聊天里，下面两种做法都可以。要选用一个预设，就指派它。要自己做一个，见[新建预设](#create-a-preset)。

从 **Presets**(预设) 面板：

1. 打开聊天。
2. 在 **Presets** 面板里找到一行预设。在电脑上，鼠标指向这一行才会显示它的按钮。
3. 点击对勾形状的 **Assign to chat**(指派给聊天) 按钮。对勾表示这个预设正在使用。再点一次就取消指派。

从 **Chat Settings**(聊天设置)：

1. 打开聊天，再打开 **Chat Settings**。
2. 找到 **Prompt Preset**(提示词预设)，从下拉菜单里选一个预设。

如果预设带变量，会弹出 **Configure Preset Variables**(配置预设变量) 窗口。见[预设变量](preset-variables.md)。换成另一个预设，之前的变量选择会被清空。

<a id="create-a-preset"></a>

## 新建预设

1. 从侧边栏打开 **Presets** 面板。
2. 点击 **New**(新建，加号图标)，**Create Preset**(新建预设) 窗口打开。
3. 填写 **Name**(名称)。这一项必填。想的话再填一个 **Description**(描述)。
4. 点击 **Create**(创建)。预设会在 **Preset Editor** 里打开。
5. 在 **Sections**(小节) 选项卡里搭建提示词。
6. 点击右上角的 **Save**(保存)。

编辑器不会自动保存。每次改动后都要点 **Save**。如果带着未保存的改动离开，会弹出一条警告，上面有 **Keep editing**(继续编辑)、**Discard**(放弃) 和 **Save & close**(保存并关闭)。

要导出预设，点击顶栏的向上箭头图标（提示文字是 **Export preset**(导出预设)）。如果有未保存的改动，Marinara 会先让你保存。要删除预设，点击垃圾桶图标。

## Presets 面板

**Prompts**(提示词) 是放预设的分区。另外两个分区是 **Regexes**(正则) 和 **Functions**(函数)。顶部的按钮有 **New**、**Import**(导入，加载 `.json` 文件) 和 **Select**(选择，一次导出或删除多个)。

- **Search presets**(搜索预设) 用来筛选列表。
- 排序菜单的选项有 **Manual order**(手动排序)、**A-Z**、**Z-A**、**Newest** 和 **Oldest**。选 **Manual order** 时，可以拖动一行，或者在获得焦点的行上按 <kbd>Alt</kbd>+<kbd>Up</kbd> 或 <kbd>Alt</kbd>+<kbd>Down</kbd>。在触屏上，长按一行就能把它拿起来。
- **New Folder**(新建文件夹) 用来给预设分组。把预设拖到文件夹上就能移进去，双击文件夹或在触屏上连点两下可以给它改名。

每一行显示名称、包装格式、小节数量和作者。加了星标的默认预设会带一个 **DEFAULT** 标记。点击一行就能打开它。

## Preset Editor 的选项卡

| 选项卡 | 内容 |
| --- | --- |
| **Overview**(总览) | 名称、描述、包装格式和作者。 |
| **Sections** | 提示词的结构，由块和标记搭成。 |
| **Prompts** | Conversation 和 Game 聊天用的模式提示词。 |
| **Parameters**(参数) | 初始生成设置。见[生成参数](generation-parameters.md)。 |
| **Regex**(正则) | 关联到这个预设的正则脚本，以及 **Scoped regex default**(限定正则默认模式)。见[正则脚本](../extending/regex-scripts.md)。 |

### Overview 选项卡

- **Name** 是显示在 **Presets** 面板里的标题。
- **Description** 是简短的说明。
- **Wrap Format**(包装格式) 决定各个小节怎么格式化（见[包装格式](#wrap-formats)）。
- **Author**(作者) 是可选的创作者名字，分享预设时很有用。

两张只读卡片显示 **Sections** 和 **Groups**(分组) 的数量。

### Prompts 选项卡

- **Conversation Mode**(对话模式) 是一个文本框，用来写这个预设的 Conversation 提示词。留空就用内置提示词。
- **Roleplay Mode**(角色扮演模式) 在这里不能编辑。Roleplay 用的是你的 **Sections** 组装出来的提示词。
- **Game Mode**(游戏模式) 是一个文本框，用来写这个预设的 Game 提示词。留空就用内置提示词。

内置的 **Marinara's Universal Preset**(Marinara 通用预设) 只提供提示词文字，不提供生成参数。它旧版保存的采样、推理、格式和 Token 设置会被忽略，改用你的账号设置、聊天覆盖值和应用默认值。要自定义它，就创建一份可编辑的副本。

## 小节与标记

**Sections** 选项卡就是搭建提示词的地方。小节自上而下依次拼接。

1. 点击 **Add Section**(添加小节)。
2. 选 **Prompt Block**(提示词块) 或某个标记。

**Prompt Block** 是你自己写的文字：系统指令、语气规则，或者任何希望每次提示词里都带上的内容。标记本身没有文字。Marinara 发送提示词时会用聊天里的实时内容把它填上。

| 标记 | 插入的内容 |
| --- | --- |
| **Character Info** | 当前角色卡的详细信息。 |
| **Persona** | 你当前用户角色的详细信息。 |
| **Chat History** | 聊天消息。 |
| **Chat Summary** | 编好的聊天摘要。 |
| **Dialogue Examples** | 角色的对话示例。 |
| **Lorebook Marker (All)** | 全部生效的世界书条目。 |
| **Lorebook Marker (Before)** | 设为放在前面的世界书条目。 |
| **Lorebook Marker (After)** | 设为放在后面的世界书条目。 |

标记所在的行会显示 **MARKER** 标记。大部分标记都不能输入内容。除非想把世界书条目拆成前后两部分，否则用 **Lorebook Marker (All)** 就行。

三个较少用到的标记：

- **Current Scene Summary**(当前场景摘要) 和 **Recalled Scenes**(召回的场景) 用来放置 Advanced Memory Recall(高级记忆功能) 生成的摘要。没有 **Recalled Scenes** 标记时，它们会出现在聊天记录之前。见[记忆功能](../agents/memory.md)。
- **ID Macro Cards**(ID 宏卡片) 用来放置你在双大括号里写上角色卡 ID、引入提示词的那些角色卡。没有这个标记时，它们会放在默认位置。见[提示词宏](macros.md)。

如果没有启用的 **Dialogue Examples** 标记，非空的对话示例会以预设的包装格式，接在 **Character Info** 里场景设定的后面。想自己决定放在哪里，就加上这个标记。Marinara 永远不会把它放两遍。

如果聊天里有生效的世界书，预设却没有世界书标记，就会出现一条警告：“Add a lorebook marker when this preset should receive active lorebook entries.”加一个世界书标记，条目才能送到模型那里。见[世界书总览](../lorebooks/overview.md)。

如果有自定义智能体开启了“inject as section”，添加菜单里会出现 **Agent Sections**(智能体小节)。每个智能体小节都会插入该智能体最近一次的输出，你还可以在它周围加上自己的指令。

### 编辑小节

1. 点击小节的名字或箭头，展开它。
2. 修改它的 **Name** 或角色（**System**、**User** 或 **Assistant**）。
3. 如果是 **Prompt Block**，编辑 **Content**(内容)。它支持[宏](macros.md)。
4. 点击右上角的 **Save**。

行上的控件：

- **Duplicate**(复制) 复制这个小节。
- 眼睛图标用来启用或禁用它。
- **Delete**(删除) 把它移除。
- 要调整顺序，可以拖动抓手、点上下箭头，或者在触屏上长按。

### 分组

分组把若干小节装进同一个容器。

1. 在 **Sections** 选项卡里点击 **Groups**，再点 **New Group**(新建分组)。
2. 点击分组名字可以改名。
3. 展开某个小节，在它的 **Group**(分组) 下拉菜单里选中这个分组。

用 **XML** 时，一个分组会变成一层父标签。用 **MARKDOWN** 时，它会变成一个标题。删除分组不会删除里面的小节，它们只是不再属于这个分组。

### 位置与深度

每个小节的编辑区里都有一项 **Position**(位置)。

- **Ordered (in sequence)**(按顺序) 让小节待在列表里它所处的位置。一般都选这个。
- **Depth (from end of chat)**(从聊天末尾算起的深度) 按 **Depth**(深度) 数值，把小节放在从聊天末尾往前数指定条消息的位置。深度为 0 表示放在最后一条消息之后。希望模型在最新消息附近看到的提醒，就用它。

<a id="wrap-formats"></a>

## 包装格式

**Overview** 选项卡上的 **Wrap Format** 决定每个小节怎么包装。

| 格式 | 结果 |
| --- | --- |
| **XML** | 每个小节都用标签包住。分组会变成父标签。这是默认选项。 |
| **MARKDOWN** | 每个小节加一个标题。分组会变成层级更高的标题。 |
| **NONE** | 不加任何包装，内容按原样发出。 |

XML 适合大多数模型。只有某个模型在没有标签时回答得更好，才去试另外两种。

想让某个 **Prompt Block** 不带标签或标题发出，就展开它，开启 **Send without wrapper**(不加包装发送)。分组的标签仍可能包在它外面，所以想让它完全不带包装，就把它移出分组。标记始终保留自己的包装，格式为 **NONE** 时这个开关也会隐藏。

<a id="conversation-and-game-chats"></a>

## Conversation 和 Game 聊天

这些聊天不从 Sections 组装提示词，而是用一条模式提示词。在 **Chat Settings** 里，**Prompt Preset** 一节有一个 **Prompt source**(提示词来源) 下拉菜单，列出你的预设。它初始显示 **Default conversation prompt**(默认对话提示词) 或 **Default game prompt**(默认游戏提示词)；一个预设都没有时，显示 **No presets available**。在 **Presets** 面板里，指派按钮会显示“Prompt presets are not available in conversation mode.”

下拉菜单下方有一个标记，显示提示词来自哪里。

| 标记 | 含义 |
| --- | --- |
| **Default**(默认) | 内置提示词。 |
| **Preset**(预设) | 所选预设的提示词。 |
| **Style**(风格) | 所选游戏主持人（GM）提示词风格的提示词。仅限 Game 聊天。 |
| **Custom**(自定义) | 只属于这个聊天的本地修改。它优先于其他所有来源。 |

文本框里显示正在使用的提示词。编辑它，就会生成一份只属于这个聊天的副本。如果你写的内容和预设或默认值完全一样，Marinara 就当作没有自定义。存在自定义修改时，会出现一个重置图标（提示文字是 **Reset to default prompt**(重置为默认提示词)）。

Game 聊天还多两个控件。**GM prompt style**(GM 提示词风格) 只替换 Game 提示词，而聊天本地的修改仍然优先。**Extra instructions**(额外指令) 会把文字追加到 Game 提示词里，上限 2000 个字符，比如“Write in the style of Terry Pratchett.”

<a id="decision-blocks-and-prompt-caching"></a>

## 判定块与提示词缓存

小节里可以放判定块 `{{#if decision:"..."}}`，这样那部分只在关于聊天的某条陈述为真时才发送。见[询问 Decision 模型](conditional-prompts.md#asking-the-decision-model)。

经常变化的判定块要放在提示词靠后的位置，比如聊天记录之后的指令里。分支一旦变化，服务商可能就无法复用从这个位置开始的提示词，所以靠前的变化会损失大部分缓存节省。前面没有变化的部分仍然可以复用。只有答案很少变化时，才把判定放在靠前的位置。见[提示词缓存](conditional-prompts.md#prompt-caching)。

禁用的小节和分组里的陈述永远不会询问，也不计入 **Decision statements per turn**(每回合判定陈述数)。

## 确认 AI 实际收到了什么

**Peek Prompt**(查看提示词) 会显示某条消息完整组装后的提示词。排查奇怪的回复时，这是最快的办法。见 [Peek Prompt：查看 AI 收到的内容](../chats/peek-prompt.md)。

## 相关指南

- [预设变量](preset-variables.md)
- [提示词宏](macros.md)
- [生成参数](generation-parameters.md)
- [设置方案](../chats/settings-profiles.md)
- [聊天设置总览](../chats/chat-settings.md)
- [Peek Prompt：查看 AI 收到的内容](../chats/peek-prompt.md)
