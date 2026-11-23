# 世界书总览

世界书是一组世界设定，聊天里出现对应的关键词时，AI 就会读到它们。地点、势力、背景故事和规则都可以放进去，省得每条消息都重复一遍。

每本世界书都包含若干条目。一个条目由触发关键词和一段文本组成。最近的聊天里出现某个关键词时，Marinara 会把这个条目的文本加进提示词，也就是为一次回复发给模型的文本。在其他工具里，世界书也叫 World Info。

举个例子，一个关键词是 `Eldoria`、正文如下的条目，能让 AI 在任何人提到这座城市时都知道它。

```text
Eldoria is a rainy port city ruled by a council of nine merchants.
```

关键词匹配对任何模型都有效，不需要额外配置。想按含义而不是字面词匹配，见[世界书的语义搜索](semantic-search.md)。

## 创建世界书并添加条目

1. 从顶栏打开 **Lorebooks**(世界书) 面板。
2. 点击 **New**(新建，加号图标)。**Create Lorebook**(新建世界书) 窗口随即打开。
3. 填写 **Name**(名称)。这一项必填。
4. 想写的话，加上 **Description**(描述)。
5. 选一个 **Category**(分类)，默认是 **Other**(其他)。如果要把这本世界书关联到角色，就选 **Character**(角色)，因为角色的选择器只列出这个分类。
6. 点击 **Create Lorebook**。新世界书会出现在列表里。
7. 点击这本世界书所在的行，整页编辑器随即打开。
8. 点击 **Entries**(条目) 选项卡。
9. 点击 **Add Entry**(添加条目)。一个新的空白条目行会出现。
10. 在这一行里输入名称，比如 `Eldoria`，然后点击这一行把它展开。
11. 在 **Primary Keys**(主关键词) 里输入 `Eldoria`，按 <kbd>Enter</kbd>。
12. 在 **Content**(内容) 里写下给 AI 的文本。

停止输入后过一小会儿，条目会自动保存，你会看到 **Saved automatically**。从现在起，只要关键词匹配，这个条目就会加入提示词。关键词、位置和时机见[世界书条目：关键词、位置与时机](entries.md)。

如果没有成功：检查这本世界书是否在聊天中生效（见下文）、它的 **Enabled**(启用) 开关是否打开，以及关键词是否出现在最近几条消息里。Marinara 只扫描 **Scan Depth**(扫描深度) 设置规定的那么多条消息。

## 让世界书在聊天中生效

只有在当前打开的聊天中生效时，世界书才会给 AI 提供内容。有三种方式。

| 方式 | 在哪里设置 | 在哪些聊天中生效 |
| --- | --- | --- |
| 全局 | 世界书 **Overview**(总览) 选项卡上的 **Global**(全局) 开关 | 所有聊天 |
| 关联 | 世界书的 **Overview** 选项卡，或者角色编辑器、用户角色编辑器 | 包含该角色或使用该用户角色的聊天 |
| 添加到单个聊天 | **Chat Settings → Lorebooks**(聊天设置 → 世界书) | 仅这个聊天 |

一本世界书不能既是全局的又是关联的。打开 **Global** 后保存，它的角色和用户角色关联就会被清除。

生效的世界书仍然需要打开自己的 **Enabled** 开关。关联的方法见[把世界书关联到角色和用户角色](linking-to-characters.md)。

## Overview 选项卡的设置

打开一本世界书，点击 **Overview**，就能设置整本世界书的行为。

| 设置 | 作用 | 默认值 |
| --- | --- | --- |
| **Scan Depth** | Marinara 检查最近多少条消息里的关键词。0 表示扫描整段聊天。 | 2 |
| **Token Budget**(Token 预算) | 这本世界书在一次回复中最多能加入多少 Token。0 表示不限。 | 2048 |
| **Entry Limit**(条目上限) | 这本世界书在一次回复中最多能加入多少条目。取值范围 1 到 1000。 | 100 |
| **Max Depth**(最大深度) | 递归时额外扫描的轮数。只在 **Recursive**(递归) 开启时显示。取值范围 1 到 10。 | 3 |

Token 是模型用来计数的文本小片段，在英文中大约相当于四分之三个单词。每项上限的作用以及递归的含义，见[世界书的 Token 预算与递归扫描](token-budgets.md)。

这个选项卡还有下面这些开关。

- **Enabled** 打开或关闭整本世界书，默认开启。
- **Global** 让这本世界书在所有聊天中生效。
- **Recursive** 让已触发条目的文本再去触发更多条目，默认关闭。
- **Vectors**(向量) 让条目也能按含义匹配，默认关闭。无论开不开，关键词都照常工作。

开关下方的 **Semantic search (embeddings)**(语义搜索与嵌入) 面板在[世界书的语义搜索](semantic-search.md)里介绍。

## 为世界书设置图片

图片会显示在 **Lorebooks** 面板、世界书库和世界书选择器中。

1. 打开世界书，留在 **Overview** 选项卡。第一个区域是 **Image**(图片)。
2. 点击 **Upload image**(上传图片) 并选择文件，或点击 **Generate with AI**(用 AI 生成)，通过图片生成连接制作封面。设好连接之前，**Generate with AI** 会显示为灰色。
3. 拖动图片上的方框，选出要显示的部分；拖动方框的角可调整大小。圆形预览会显示裁剪效果。
4. 点击 **Save**。

新图片默认没有裁剪。要去掉图片，点击 **Remove**(移除)。

<a id="the-lorebook-library"></a>
## 世界书库

世界书库是一个整页视图，会显示各本世界书的图片、简介和条目数。点击 **Lorebooks** 面板顶部的 **Open Library**(打开书库) 即可打开。

点击一本世界书可以放大查看。**Edit Lorebook**(编辑世界书) 会打开编辑器，返回箭头会回到世界书库。**Active**(启用) 和 **Enabled** 开关一样，可以在所有聊天中启用或停用这本世界书。

## Lorebooks 面板

面板顶部的 **Download**(下载) 会打开 Card Browser 并显示可下载的世界书，见[导入和导出世界书](import-export.md#download-a-lorebook-from-chub)。**Open Library** 会打开[世界书库](#the-lorebook-library)。

下方有三个图标按钮，将鼠标悬停在上面即可看到名称。

- **New** 打开 **Create Lorebook** 窗口。
- **Import**(导入) 打开 **Import Lorebook**(导入世界书) 窗口。见[导入与导出世界书](import-export.md)。
- **Select**(选择) 开启多选，可以一次导出或删除多本世界书。

按钮下方：

- **Search lorebooks**(搜索世界书) 按名称、描述、关联的角色或用户角色名称以及标签筛选。
- **Sort order**(排序方式) 提供 **Manual order**(手动排序)、**A-Z**、**Z-A**、**Newest**、**Oldest**、**Most tokens**(Token 数从多到少) 和 **Fewest tokens**(Token 数从少到多)。按大小排序时使用世界书全部条目的估算大小，包括已停用的条目。每行也会显示这一估算值。选 **Manual order** 时，把世界书拖到想要的位置，或者用 <kbd>Alt</kbd>+<kbd>Up</kbd> 和 <kbd>Alt</kbd>+<kbd>Down</kbd>。
- **New Folder**(新建文件夹) 会建立一个库文件夹。把世界书拖到上面即可。在手机上，按住世界书，再拖动。这些文件夹和世界书内部的条目文件夹是两回事。

每一行都有 **Copy**(复制，复制出这本世界书的副本) 和 **Delete**(删除) 按钮。鼠标悬停在该行时它们才出现，在手机上则一直可见。已关闭的世界书会显示 **OFF** 标记。点击图片可以上传或替换图片。

### 分类

分类是给你的库用的标签，不影响世界书何时生效。选项卡有 **All**(全部)、**Active**(生效中，即与当前打开的聊天相关的世界书)、**World**(世界)、**Character**、**NPC**、**Spellbook**(法术书) 和 **Other**。你可以在世界书的 **Overview** 选项卡上更改分类，在那里 **Other** 叫作 **Uncategorized**(未分类)。

### 保存世界书组合

世界书组合是一组起了名字、搭配使用的世界书，比如某个设定用到的那几本世界书。选择时可以一次选中整组，不必一本本地选。组合只是指向你的世界书，不会复制它们。

1. 在 **Lorebooks** 面板里点击 **New set**(新建组合)。新组合会在 **Lorebook Sets**(世界书组合) 下打开。
2. 在 **Set name**(组合名称) 里输入名称。
3. 点击 **Choose lorebooks**(选择世界书)，勾选要加入组合的世界书。每次改动都会自动保存。

以后要编辑组合，在 **Lorebook Sets** 下点击它。它的 **Delete set**(删除组合) 按钮会删除这个组合，其中的世界书仍留在你的库里。删除一本世界书时，它会从所有组合中移除。

在 **Choose lorebooks** 上方的 **Use a saved set**(使用已保存的组合) 里选择一个组合。你有了组合之后，这个字段才会出现，位置如下：

- 新建 Roleplay(角色扮演) 时的 **Attach Lorebooks**(附加世界书) 步骤。
- 智能体的固定来源世界书，比如 Knowledge Router 的。见[知识源：Knowledge Retrieval 与 Knowledge Router 智能体](../agents/knowledge-sources.md#choose-the-sources)。

选择组合会替换那里已选的世界书。之后你可以为那个聊天或智能体再添加或移除世界书，已保存的组合不会改变。

要在某一个聊天里单独开关条目，打开 **Chat Settings → Lorebooks**，点击世界书旁边的铅笔图标（**Edit lorebook entries**(编辑世界书条目)）。那里每个条目的开关只影响这个聊天。在那里做的其他编辑会改动世界书本身。

## 相关指南

- [世界书条目：关键词、位置与时机](entries.md)
- [世界书的 Token 预算与递归扫描](token-budgets.md)
- [世界书的语义搜索](semantic-search.md)
- [把世界书关联到角色和用户角色](linking-to-characters.md)
- [导入与导出世界书](import-export.md)
- [知识源：Knowledge Retrieval 与 Knowledge Router 智能体](../agents/knowledge-sources.md)
