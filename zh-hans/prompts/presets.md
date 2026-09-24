# 预设编辑器与提示词管理器

本指南介绍 Marinara Engine 里的提示词预设：预设是什么、怎么在 **Preset Editor**(预设编辑器) 里做一个，以及怎么把它指派给某个聊天。预设决定 Marinara 发给 AI 的那段文字长什么样。

## 预设是什么

预设就是一份可以反复使用的蓝图，它决定 Marinara 把哪些信息发给 AI、按什么顺序发。这些信息包括自己写的系统指令、角色卡、用户角色、聊天记录、世界书条目等等。

预设负责组装 **Roleplay**(角色扮演) 和 **Game**(游戏) 聊天的提示词。**Conversation**(对话) 模式的机制不一样，它只用一个提示词输入框。见下文“Conversation 和 Game Mode 有什么不同”。

预设本身不需要 API 密钥，也不需要账号，它只描述提示词怎么拼出来。要真正把提示词发出去，还是得有一个能用的连接。见[连接 AI 服务商](../connections/connecting-to-a-provider.md)。

## 打开 Preset Editor

提示词预设放在应用左侧 **Presets**(预设) 面板的 **Prompts** 分区里。这个面板还有另外两个分区：**Regexes** 和 **Functions**。

面板顶部有三个按钮：

- **New**(新建，加号图标)：新建一个预设。
- **Import**(导入，下载图标)：从 `.json` 文件加载预设。
- **Select**(选择，对勾图标)：一次选中多个预设，批量导出或删除。

按钮下面是 **Search presets** 搜索框和排序菜单，排序方式有 **A-Z**、**Z-A**、**Newest** 和 **Oldest**。**New Folder**(新建文件夹) 按钮可以把预设归到文件夹里。把预设拖到文件夹上就能移进去。双击文件夹可以给它改名，触屏上则连点两下。

每一行预设会显示名称、包装格式、小节数量和作者。如果这个预设是加星的默认预设，行上会有一个 **DEFAULT** 标记。点击预设行，就能在 **Preset Editor** 里打开它。

## 新建和编辑预设

按下面的步骤做一个新预设。

1. 打开 **Presets** 面板。
2. 点击 **New** 按钮，**Create Preset**(新建预设) 窗口打开。
3. 填写 **Name**(名称)。这一项必填。
4. 可以再填一个 **Description**(描述)，方便以后想起这个预设是干什么的。
5. 点击 **Create**(创建)。新预设会在 **Preset Editor** 里打开。
6. 在 **Sections**(小节) 选项卡里搭建提示词（下面细讲）。
7. 弄完之后点击右上角的 **Save**(保存)。

编辑器不会自动保存，改动只有点了 **Save** 才会留下。如果带着未保存的改动想离开，会弹出一条警告，上面有 **Keep editing**(继续编辑)、**Discard**(放弃) 和 **Save & close**(保存并关闭) 三个按钮。

要导出预设，打开它，点顶栏的导出按钮（向上箭头图标）。如果有未保存的改动，Marinara 会先问要不要保存。要删除预设，用顶栏的垃圾桶图标。

## Overview、Sections、Prompts 三个选项卡

**Preset Editor** 有三个选项卡。

- **Overview**(概览)：预设名称、描述、包装格式和作者。
- **Sections**：提示词的实际结构，由块和标记搭成。
- **Prompts**：Conversation 和 Game 聊天用的模式提示词。

### Overview 选项卡

**Overview** 选项卡里有四项。**Name** 是显示在 **Presets** 面板里的名字。**Description** 是这个预设的简短说明。**Wrap Format**(包装格式) 决定各个小节怎么被格式化（见“包装格式”）。**Author**(作者) 是可填可不填的创作者名字，分享预设时挺有用。另有两张只读卡片，显示 **Sections** 和 **Groups**(分组) 的数量。

### Prompts 选项卡

**Prompts** 选项卡放的是各模式的提示词。

- **Conversation Mode**：一个文本框，作为这个预设的 Conversation 提示词。留空就用 Marinara 内置的对话提示词。
- **Roleplay Mode**：这里不能编辑。Roleplay 用的是 **Sections** 组装出来的提示词。
- **Game Mode**：一个文本框，作为这个预设的 Game 提示词。留空就用 Marinara 内置的游戏提示词。

## 小节与标记

**Sections** 选项卡就是搭建提示词的地方。每一个小节都会成为最终发给 AI 的文本的一部分，小节自上而下依次拼接。

点击 **Add Section**(添加小节) 会打开添加菜单，里面有两类小节。

**Prompt Block**(提示词块) 是自由文本小节，内容由自己写。系统指令、语气规则，或者任何希望每次提示词里都带上的话，都放在这里。

**marker**(标记) 是自动填充的小节，本身没有文字。Marinara 会在发送时用聊天里的实时内容把它填上。下表列出了所有标记。

| 标记 | 插入的内容 |
|---|---|
| **Character Info** | 当前角色卡的详细信息。 |
| **Persona** | 当前用户角色的详细信息。 |
| **Chat History** | 正在进行的聊天消息。 |
| **Chat Summary** | 这个聊天已编好的聊天摘要。 |
| **Dialogue Examples** | 角色的对话示例。 |
| **Lorebook Marker (All)** | 全部生效的世界书条目。 |
| **Lorebook Marker (Before)** | 设为插入到前面的世界书条目。 |
| **Lorebook Marker (After)** | 设为插入到后面的世界书条目。 |

属于标记的小节，行上会显示一个 **MARKER** 标记。展开它可以看到一行说明，标出这是哪种标记。大部分标记里没法自己输入内容，因为内容由 Marinara 生成。

如果预设里没有启用的 **Dialogue Examples** 标记，非空的 Example Dialogue 会接在 **Character Info** 中 Scenario 的后面。它用的是预设的 XML、Markdown 或不加包装的格式。想自己决定它出现在哪里，就加一个 Dialogue Examples 标记，Marinara 不会重复放两遍。

如果聊天里有生效的世界书，预设却没有世界书标记，就会出现一条警告：“Add a lorebook marker when this preset should receive active lorebook entries.”加一个世界书标记，那些条目才能送到 AI 那里。见[世界书总览](../lorebooks/overview.md)。

如果自定义智能体开启了“inject as section”选项，添加菜单里会多出一个 **Agent Sections**(智能体小节) 分组。每个智能体小节会把该智能体最近一次的输出插进提示词，周围还可以自己补充说明。

每一行小节右侧都有一组控件。**Duplicate**(复制) 会复制这个小节。眼睛图标用来启用或禁用小节。**Delete**(删除) 把它移除。要调整顺序，可以拖动抓手、点上下箭头，或者在触屏上长按。

展开小节（点它的名字或者尖角图标）就能编辑。可以改 **Name** 和角色（**System**、**User** 或 **Assistant**）。如果是 **Prompt Block**，还可以编辑 **Content**(内容)。内容框支持宏，见[提示词宏](macros.md)。

## 分组与小节位置

### 分组

分组把若干小节装进同一个容器，这样相关的小节在最终提示词里会挨在一起。

1. 在 **Sections** 选项卡的工具栏里点击 **Groups** 按钮。
2. 点击 **New Group**(新建分组)，会出现一个名为“New Group”的分组。
3. 点击分组名字可以改名。
4. 展开某个小节，在它的 **Group**(分组) 下拉菜单里选中这个分组。

用 **XML** 包装格式时，一个分组会变成包住其中所有小节的一层父标签。用 **Markdown** 时，一个分组会变成一个标题。删掉分组不会删掉里面的小节，它们只是不再属于任何分组。

### 位置与深度

每个小节展开后的编辑区里都有一项 **Position**(位置) 设置。

- **Ordered (in sequence)**：小节就待在列表里它所处的位置。一般都选这个。
- **Depth (from end of chat)**：小节被放到距离聊天末尾指定条消息的地方。选了它之后会出现一个 **Depth**(深度) 数值。深度为 0 表示这个小节放在最后一条消息之后。

如果希望 AI 在最新消息附近看到某些提醒，比如一小段文风说明，就用 **Depth**。

## 包装格式

**Overview** 选项卡上的 **Wrap Format** 决定组装提示词时每个小节怎么被包起来，有三个按钮。

- **XML**：每个小节都用标签包住，比如在内容外面套一个同名标签。分组会变成父标签。这是默认选项。
- **MARKDOWN**：每个小节用一个标题包住。分组会变成层级更高的标题。
- **NONE**：不加任何包装，小节内容按原样发出。

对多数模型来说，XML 是个不错的默认选择。只有当某个模型在没有标签时表现更好，才去试 **MARKDOWN** 或 **NONE**。

## 把预设指派给聊天

预设只有指派给某个聊天才会起作用。在 **Roleplay** 聊天里有两种做法。

从 **Presets** 面板：

1. 打开要改的那个聊天。
2. 在 **Presets** 面板里把鼠标悬停在某一行预设上。
3. 点击对勾形状的 **Assign to chat**(指派给聊天) 按钮。再点一次就取消指派。

从 **Chat Settings**(聊天设置)：

1. 打开聊天。
2. 打开 **Chat Settings**(齿轮图标)。
3. 找到 **Prompt Preset**(提示词预设) 一栏。
4. 从下拉菜单里选一个预设。

如果预设带变量，指派时会弹出 **Configure Preset Variables**(配置预设变量) 窗口，在那里填好选项。见[预设变量](preset-variables.md)。换成另一个预设，之前做的变量选择会被清空。

在 **Conversation** 模式下，面板里用不了提示词预设。在 Conversation 聊天里点指派按钮会提示：“Prompt presets are not available in conversation mode.”下一节讲 Conversation 和 Game 聊天改用什么方式使用预设。

## Conversation 和 Game Mode 有什么不同

**Conversation** 和 **Game** 聊天不从 Sections 组装提示词，而是用一条模式提示词，并且可以按聊天单独覆盖。

在这两种模式下，**Chat Settings** 里的 **Prompt Preset** 一栏会有一个 **Prompt source**(提示词来源) 下拉菜单，里面列出已有的预设。默认值是“Default conversation prompt”或“Default game prompt”。如果一个预设都没有，这里显示“No presets available”。

下拉菜单下面是一行状态，一共有三种：

- **Default**：用的是内置的模式提示词。
- **Preset**：提示词来自选中的预设。
- **Custom**：为这一个聊天单独写了一份提示词。

点击 **Edit Prompt**(编辑提示词) 可以只给当前聊天写一条提示词。编辑器会以 **Edit Conversation Prompt** 或 **Edit Game Prompt** 的形式打开。如果写出来的内容和预设或默认值完全一样，Marinara 就当作没有自定义。一旦存在自定义内容，就会出现 **Reset to default prompt**(重置为默认提示词) 按钮，用来清除它。

Game 聊天还多一个 **Extra instructions**(额外指令) 输入框，里面的文字会追加到 Game 提示词后面，上限 2000 个字符。可以这样写：“Write in the style of Terry Pratchett.”

<a id="decision-blocks-and-prompt-caching"></a>

## 判定块与提示词缓存

小节可以包含 `{{#if decision:"..."}}` 判定块，只在关于聊天的陈述为真的回合发送这部分预设。见[询问 Decision 模型](conditional-prompts.md#asking-the-decision-model)。

**把会变化的判定块放在提示词后面**，例如历史记录之后的指示。分支变化可能使服务商无法复用从该位置开始的提示词，因此靠前的变化可能损失大部分缓存节省。更早且未变化的前缀仍可能符合条件；不一定整段提示词都按新输入计费。只有答案很少变化、指示也确实应放在前面时，才把判定留在开头。各服务商的细节见[提示词缓存](conditional-prompts.md#prompt-caching)。

禁用的小节和分组里的陈述从不询问，也不计入 **Decision statements per turn**(每回合判定陈述数)。

## 确认 AI 实际收到了什么

想确认到底是哪个预设、哪些小节真的送到了 AI 那里，用 **Peek Prompt**。它会显示某条消息完整组装后的提示词，排查回复不对劲的问题时这是最快的办法。见 [Peek Prompt：查看 AI 收到的内容](../chats/peek-prompt.md)。

## 相关指南

- [预设变量](preset-variables.md)
- [提示词宏](macros.md)
- [生成参数](generation-parameters.md)
- [设置方案](../chats/settings-profiles.md)
- [聊天设置总览](../chats/chat-settings.md)
- [Peek Prompt：查看 AI 收到的内容](../chats/peek-prompt.md)
