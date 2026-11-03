# 从 SillyTavern 导入

把你的 SillyTavern(社区常称“酒馆”) 数据导入 Marinara Engine。可以一次导入一个文件，也可以扫描整个 SillyTavern 文件夹，一次全部导入。

## 可以导入的内容

| SillyTavern 数据 | 在 Marinara 中 |
| --- | --- |
| 角色 | 角色 |
| 聊天和群聊 | 聊天 |
| 预设 | 预设（一组保存好的生成设置） |
| World Info | 世界书（AI 在出现特定词语时会读取的笔记） |
| 背景 | 聊天背景 |
| 用户角色 | 用户角色（代表你自己的资料） |

## 单文件快速导入

1. 打开 **Settings → Imports**(设置 → 导入)。
2. 在 **SillyTavern Import**(SillyTavern 导入) 中，点击与你的文件类型对应的按钮。
3. 选择文件。

| 按钮 | 文件 |
| --- | --- |
| **Import Character (JSON/PNG)**(导入角色卡) | 一个 `.json` 或 `.png` 角色卡。 |
| **Import Chat (JSONL)**(导入聊天) | 一个 `.jsonl` 聊天记录（每行一条 JSON 记录，SillyTavern 保存聊天用的就是这种格式）。 |
| **Import Preset (JSON)**(导入预设) | 一个 `.json` 预设。 |
| **Import Lorebook (JSON)**(导入世界书) | 一个 `.json` World Info 文件。 |

这几个按钮没有可选项。导入角色时会保留源文件的全部标签，并把所有正则脚本限定在该角色上。正则脚本是一条文本查找替换规则。想自行选择这些选项，请使用角色面板里的 **Import** 按钮。参见[导入和导出角色卡](../characters/import-export.md)。

如果角色卡里内嵌了世界书，浏览器会询问是否把它导入为独立的世界书。点击 **OK** 会把它保存为一本可以重复使用的世界书。点击 **Cancel** 则只导入角色。

**Import Chat (JSONL)** 会创建一个 Roleplay(角色扮演) 聊天并打开它，除非文件中记录的是其他模式。

### 把聊天导入到你选择的模式

要选择模式，请使用聊天列表顶部的导入按钮。它的提示文字是 **Import SillyTavern or Marinara chat JSONL**。它会导入到你当前打开的模式选项卡中（Conversation(对话模式)、Roleplay 或 Game）。参见[导出与导入聊天](../chats/export-import.md)。

## 从 SillyTavern 文件夹导入

**开始之前：** 向导会读取服务器电脑上的文件。如果 SillyTavern 装在另一台电脑上，请先把它的文件夹（也就是 SillyTavern 的安装文件夹）复制到运行 Marinara 的电脑上。在运行 Marinara 的电脑上，向导可以直接使用。从其他设备使用时，请先设置管理员密钥，然后把它填入 **Settings → Advanced → Admin Access**(设置 → 高级 → 管理员访问)。参见[备份与恢复 Marinara](backup-and-restore.md)，以及[服务器配置参考](../CONFIGURATION.md)中的“授权 API(ADMIN_SECRET)”一节。

1. 打开 **Settings → Imports → SillyTavern Import**。
2. 点击 **Import from SillyTavern Folder**(从 SillyTavern 文件夹导入)。
3. 选择你的 SillyTavern 文件夹。选主文件夹，通常是包含 `data/` 或 `public/` 文件夹的那一个。可以用以下任一方式：
   - 点击 **Browse**(浏览)，然后选择该文件夹。
   - 如果没有文件夹选择器（例如远程服务器），会打开应用内置的文件夹浏览器。它只列出运行服务器的用户主文件夹内的文件夹。点击 **Select This Folder**(选择此文件夹)。
   - 在 **SillyTavern Folder Path**(SillyTavern 文件夹路径) 中输入路径，例如 `/path/to/SillyTavern`。只有服务器的 `IMPORT_ALLOWED_ROOTS` 设置列出了包含该路径的文件夹，手动输入的路径才有效。
4. 点击 **Scan Folder**(扫描文件夹)。Marinara 会显示每个类别找到了多少条目。
5. 在 **Choose exactly what to import**(精确选择要导入的内容) 页面中，勾选你想要的条目。每个类别都有 **All**(全选) 和 **None**(全不选) 按钮，以及用于查看单个条目的 **Show**(显示) 或 **Hide**(隐藏) 切换。
6. 点击 **Import Selected**(导入所选)。进度条会显示当前条目，以及每个类别的计数。
7. 看到 **Import complete!** 后，查看每个类别的数量，然后点击 **Done**(完成)。

大多数条目一开始都是选中的。Marinara 会取消勾选 SillyTavern 自带的预设，例如 `deterministic`、`neutral` 和 `universal-*` 预设，并显示一条横幅说明。除非你想要一份副本，否则请保持不勾选。

如果扫描到了角色，还会出现两个选项：

**Imported character tags**(导入的角色标签)（默认 **All tags**）：

- **All tags** 保留源文件中的标签。
- **No tags** 全部跳过。
- **Existing only** 只保留你已有的标签。

**Imported regex scripts**(导入的正则脚本)（默认 **Character only**）：

- **Character only** 让脚本只作用于各自的角色。
- **Global** 把脚本添加到 **Presets → Regexes**(预设 → 正则)，对所有聊天生效。

如果没有成功：

- 出现 “Could not find SillyTavern data directory.” 表示 Marinara 无法读取该文件夹。请选择 SillyTavern 的主文件夹。
- 出现 “folderPath is not allowed” 表示服务器拒绝了该路径。请改为点击 **Browse** 并选择文件夹。服务器的管理者可以通过 `IMPORT_ALLOWED_ROOTS` 设置限制允许导入的文件夹。设置之后，即使是手动选择的文件夹，也必须位于其中某个允许的文件夹之内。请询问运行服务器的人，或参见[服务器配置参考](../CONFIGURATION.md)。
- 如果某一条目失败，Marinara 会跳过它并继续处理，然后在最后一步的警告中列出它，例如 `Character "Foo": error message`。

## 导入如何处理你的数据

- 属于同一个角色的聊天文件，会作为同一个聊天的分支导入。分支是一份可以单独续写的聊天副本。
- 群聊会导入为 Roleplay 聊天。
- 导入的条目保留源文件的最后修改日期，而不是导入当天的日期。

## 不会导入的内容

向导只读取上面第一个表格中列出的类别。其他 SillyTavern 数据（例如全局应用设置和快速回复）不会被导入。

## 相关指南

- [导入和导出角色卡](../characters/import-export.md)
- [导入与导出世界书](../lorebooks/import-export.md)
- [导出与导入聊天](../chats/export-import.md)
- [正则脚本](../extending/regex-scripts.md)
