# 导入与导出世界书

导入世界书可以从文件里带入世界设定，导出则用来分享或备份。本指南介绍单个文件、一次多个文件，以及四种导出格式。世界书是一组由关键词触发的笔记，聊天里出现匹配的词时，Marinara 会把它们加进提示词。其他工具把这个功能叫作 World Info。

## 可以导入哪些文件

Marinara 会自动判断文件类型。两类都是 `.json` 文件，不需要账号，也不需要 API 密钥。

- 从 Marinara 导出的世界书。所有字段和文件夹都会保留。
- 来自其他工具的 World Info 文件，比如 SillyTavern 的 World Info，或者 V2 角色卡的“character-book”格式。Marinara 会把这些字段映射到自己的字段上。

## 导入世界书

1. 打开 **Lorebooks**(世界书) 面板。
2. 点击顶部一排三个图标中间的那个下载箭头图标，它的提示文字是 **Import**(导入)。加号图标是 **New**(新建)，对勾图标是 **Select**(选择)。
3. 在 **Import Lorebook**(导入世界书) 窗口里，点按或点击写着 **Drop one or more lorebook files here or click to browse** 的方框，选择你的 `.json` 文件。在电脑上也可以把文件拖到方框上。可以一次选多个，也可以把 Marinara 文件和 World Info 文件混在一起。
4. 等待结果。每个文件要么显示绿色对勾和 **Imported lorebook**，要么显示红色标记和一条错误信息。有多个文件时，会有一行汇总显示成功和失败各多少个。
5. 点击 **Close**(关闭)。新的世界书就出现在 **Lorebooks** 面板里了。

Marinara 会沿用文件自带的日期作为创建日期。

如果没有成功：查看文件旁边的错误信息。不是世界书的文件或已损坏的文件会单独失败，其他文件照常导入。

## 导入之后

导入的世界书立刻就能用关键词触发。如果你用语义搜索，需要重新为它构建向量。见[世界书的语义搜索](semantic-search.md)。

## 导出世界书

1. 在 **Lorebooks** 面板里点击一本世界书，打开它。
2. 点击编辑器标题栏右上角附近的导出图标，它的提示文字是 **Export lorebook**(导出世界书)。
3. 在 **Export Lorebook** 窗口里选择一种格式。浏览器会下载这个文件。

| 格式 | 得到什么 | 用途 |
| --- | --- | --- |
| **Marinara Native**(Marinara 原生格式) | 所有条目字段和文件夹。文件名以 `.marinara.json` 结尾。 | 把世界书搬到另一个 Marinara 安装实例。 |
| **Compatible JSON**(兼容 JSON) | 不带文件夹的 World Info 文件，文件名以 `.json` 结尾。部分 Marinara 独有的细节会丢失。 | 其他角色扮演工具。 |
| **Markdown** | 每个条目一个 `## Name` 标题，下面带一行 `Keys:`。 | 在文本编辑器里阅读和编辑。 |
| **CSV** | 一张电子表格，包含 name、keys、content、folder、enabled、constant 和 probability 列。 | 在电子表格里编辑大量条目。 |

## 一次导出多本世界书

1. 在 **Lorebooks** 面板里点击对勾图标（**Select**）。
2. 勾选每本想导出的世界书。
3. 点击底部栏里的 **Export**(导出)。

浏览器会下载 `marinara-lorebooks.zip`。批量导出始终使用 **Marinara Native**，所以导入回来时什么都不会丢。

## 从 Markdown 或 CSV 导入条目

你可以从 Markdown 或 CSV 文本文件向世界书添加条目，比如你导出后编辑过的文件。

1. 打开这本世界书，点击编辑器标题栏里的 **Import entries from Markdown or CSV**(从 Markdown 或 CSV 导入条目)。
2. 在 **Import entries**(导入条目) 窗口里点击 **Choose file**(选择文件)，或者把文本粘贴到输入框里。
3. 检查 **Format**(格式)。Marinara 会根据文本猜测格式。
4. 查看预览。Markdown 每个条目用一个 `## Name` 标题，可选一行 `Keys: a, b`，然后是正文。CSV 要有一行表头，包含 name、keys 和 content，可选 folder、enabled、constant 和 probability 列。预览会显示有多少条目已就绪，并按行列出错误和警告。
5. 在 **Import into**(导入到) 下选择 **This lorebook**(此世界书) 或 **New lorebook**(新世界书)。选新世界书时，在 **New lorebook name**(新世界书名称) 下填写名称。
6. 在 **When an entry name already exists**(条目名称已存在时) 下，选择 **Skip the imported entry**(跳过导入的条目)、**Import as a renamed copy**(作为重命名的副本导入) 或 **Overwrite the existing entry**(覆盖现有条目)。
7. 点击 **Import** 按钮，按钮上会显示条目数。

一条弹出提示会告诉你新增、覆盖和跳过了多少条目。

如果没有成功：如果文件有影响整个文件的错误，比如缺少必需的列，或者没有任何有效条目，按钮就会保持不可用。按预览列出的行逐一修正。

## 导入整个 SillyTavern 文件夹

想从完整的 SillyTavern 文件夹导入，连同角色、聊天和预设一起，见[从 SillyTavern 导入](../data/importing-from-sillytavern.md)。

## 相关指南

- [世界书总览](overview.md)
- [把世界书关联到角色和用户角色](linking-to-characters.md)
- [世界书的语义搜索](semantic-search.md)
- [从 SillyTavern 导入](../data/importing-from-sillytavern.md)
