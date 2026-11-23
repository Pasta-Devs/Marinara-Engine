# 从 SillyTavern 导入

把你的 SillyTavern(社区常称“酒馆”) 数据导入 Marinara Engine。可以一次导入一个文件，也可以扫描整个 SillyTavern 文件夹，一次全部导入。

## 可以导入的内容

| SillyTavern 数据 | 在 Marinara 中 |
| --- | --- |
| 角色 | 角色 |
| 聊天和群聊 | 聊天 |
| 预设 | 预设（提示词的分区和预设的采样设置） |
| World Info | 世界书（AI 在出现特定词语时会读取的笔记） |
| 背景 | 聊天背景 |
| 用户角色 | 用户角色（代表你自己的资料） |
| 正则脚本 | 正则脚本：各角色卡自己的脚本，以及 `settings.json` 中的全局脚本（文件夹导入） |

## 单文件快速导入

1. 打开 **Settings → Imports**(设置 → 导入)。
2. 在 **SillyTavern Import**(SillyTavern 导入) 中，点击与你的文件类型对应的按钮。
3. 选择文件。**Import Character**(导入角色)、**Import Preset**(导入预设) 和 **Import Lorebook**(导入世界书) 会打开与各自面板里的 **Import**(导入) 按钮相同的窗口，提供相同的选项，也会同样报告哪些内容已导入、哪些没有导入。

| 按钮 | 文件 |
| --- | --- |
| **Import Character (JSON/PNG)**(导入角色卡) | 一个 `.json` 或 `.png` 角色卡。 |
| **Import Chat (JSONL)**(导入聊天) | 一个 `.jsonl` 聊天记录（每行一条 JSON 记录，SillyTavern 保存聊天用的就是这种格式）。 |
| **Import Preset (JSON)**(导入预设) | 一个 `.json` 预设。 |
| **Import Lorebook (JSON)**(导入世界书) | 一个 `.json` World Info 文件。 |

正则脚本是一条文本查找替换规则。参见[导入和导出角色卡](../characters/import-export.md)。

如果角色卡里内嵌了世界书，Import Character 窗口会询问如何处理：**Import lorebook**(导入世界书) 会把它保存为一本可以重复使用的世界书，**Skip lorebook**(跳过世界书) 则只导入角色。

**Import Chat (JSONL)** 会创建一个 Roleplay(角色扮演) 聊天并打开它，除非文件中记录的是其他模式。一条简短的消息会说明哪些内容一并导入了，包括 Author's Note、用户角色和对 AI 隐藏的消息。

### 从聊天列表导入聊天

也可以使用聊天列表顶部的导入按钮。它的提示文字是 **Import SillyTavern or Marinara chat JSONL**。处理方式相同：按文件中记录的模式打开聊天，没有记录模式时则作为 Roleplay 聊天打开。参见[导出与导入聊天](../chats/export-import.md)。

## 从 SillyTavern 文件夹导入

**开始之前：** 向导会读取服务器电脑上的文件。如果 SillyTavern 装在另一台电脑上，请先把它的文件夹（也就是 SillyTavern 的安装文件夹）复制到运行 Marinara 的电脑上。在运行 Marinara 的电脑上，向导可以直接使用。从其他设备使用时，请先设置管理员密钥，然后把它填入 **Settings → Advanced → Admin Access**(设置 → 高级 → 管理员访问)。参见[备份与恢复 Marinara](backup-and-restore.md)，以及[服务器配置参考](../CONFIGURATION.md)中的“授权 API(ADMIN_SECRET)”一节。

1. 打开 **Settings → Imports → SillyTavern Import**。
2. 点击 **Import from SillyTavern Folder**(从 SillyTavern 文件夹导入)。
3. 选择你的 SillyTavern 文件夹。选主文件夹，通常是包含 `data/` 或 `public/` 文件夹的那一个。可以用以下任一方式：
   - 点击 **Browse**(浏览)，然后选择该文件夹。
   - 如果没有文件夹选择器（例如远程服务器），会打开应用内置的文件夹浏览器。它只列出运行服务器的用户主文件夹内的文件夹。点击 **Select This Folder**(选择此文件夹)。
   - 在 **SillyTavern Folder Path**(SillyTavern 文件夹路径) 中输入路径，例如 `/home/you/SillyTavern`。输入的路径位于运行服务器的用户的主目录里时就能使用。如果服务器设置了 `IMPORT_ALLOWED_ROOTS`，则必须位于其中一个指定文件夹内。
4. 点击 **Scan Folder**(扫描文件夹)。Marinara 会显示每个类别找到了多少条目。
5. 在 **Choose exactly what to import**(精确选择要导入的内容) 页面中，勾选你想要的条目。每个类别都有 **All**(全选) 和 **None**(全不选) 按钮，以及用于查看单个条目的 **Show**(显示) 或 **Hide**(隐藏) 切换。
6. 点击 **Import Selected**(导入所选)。进度条会显示当前条目，以及每个类别的计数。
7. 看到 **Import complete!** 后，查看每个类别的数量，然后点击 **Done**(完成)。数量下方有一份简短的列表，说明多少聊天保留了 Author's Note 和用户角色、哪些 SillyTavern 用户名在这里没有对应的用户角色、预设如何放置 World Info，以及哪些预设设置没有导入。

**Skip what's already here**(跳过已有内容，默认开启) 会跳过已有的角色、聊天和用户角色，无论之前是从文件夹导入的，还是逐个文件导入的。与现有用户角色同名的 SillyTavern 用户角色不会再复制一份，而是把它的聊天关联到现有用户角色。这次改动前逐个文件导入的聊天无法识别，会再导入一次。

大多数条目一开始都是选中的。Marinara 会取消勾选 SillyTavern 自带的预设，例如 `deterministic`、`neutral` 和 `universal-*` 预设，并显示一条横幅说明。除非你想要一份副本，否则请保持不勾选。

如果扫描到了角色，还会出现两个选项：

**Imported character tags**(导入的角色标签)（默认 **All tags**）：

- **All tags** 保留源文件中的标签。
- **No tags** 全部跳过。
- **Existing only** 只保留你已有的标签。

**Imported regex scripts**(导入的正则脚本)（默认 **Character only**）：

- **Character only** 让脚本只作用于各自的角色。
- **Global** 把脚本添加到 **Presets → Regexes**(预设 → 正则)，你可以在该选项卡管理跨聊天运行的脚本。见[正则脚本](../extending/regex-scripts.md#manage-your-scripts)。

如果没有成功：

- 出现 “Could not find SillyTavern data directory.” 表示 Marinara 无法读取该文件夹。请选择 SillyTavern 的主文件夹。
- “Marinara can only read folders inside your home folder”表示该文件夹不在运行服务器的用户的主目录内。把 SillyTavern 文件夹移进去，或让服务器管理者通过 `IMPORT_ALLOWED_ROOTS` 设置允许读取它所在的位置。如果设置了这个变量，即使用文件夹选择器选取，也必须位于其中一个指定文件夹内。见[服务器配置参考](../CONFIGURATION.md)。
- 如果 **Browse** 收到手动输入的主目录之外的路径，文件夹浏览器会改为打开主目录。
- 如果某一条目失败，Marinara 会跳过它并继续处理，然后在最后一步的警告中列出它，例如 `Character "Foo": error message`。

## 导入如何处理你的数据

- 属于同一个角色的聊天文件，会作为同一个聊天的分支导入。分支是一份可以单独续写的聊天副本。与单文件导入一样，每个聊天都以对应的 SillyTavern 文件命名。文件仍叫“New Chat”时，则使用角色的名字。
- 群聊会导入为 **Individual**(独立) 模式的 Roleplay 聊天，各角色按 SillyTavern 的发言顺序依次回复。
- 在 SillyTavern 中对 AI 隐藏的消息仍然隐藏。
- 导入的项目保留源文件的最后修改日期，不会改成导入日期。每条聊天消息也会保留 SillyTavern 保存它时的日期。
- 聊天的 **Author's Note**(作者备注) 会连同深度一起导入。如果 SillyTavern 为它设置了其他频率、位置或角色，Marinara 仍会在每条回复中按该深度添加它，导入结果会说明这一点。在 SillyTavern 中关闭的备注仍然关闭。
- 聊天会关联到 SillyTavern 使用的用户角色：优先使用锁定的用户角色，否则使用与聊天用户名同名的用户角色。在同一次导入中导入用户角色，或提前创建同名用户角色。没有匹配项时，聊天不会关联用户角色，导入结果会列出缺失的用户角色名称。
- 预设会保留 SillyTavern 的两个 World Info 位置。**World Info (before)**(世界信息（之前）) 和 **World Info (after)**(世界信息（之后）) 会各自成为一个分区，所以设为放在角色之后的条目仍会放在角色之后。预设关闭其中一个分区时，相关条目也会省略，与 SillyTavern 一样。只有一个 World Info 位置的预设会得到一个 **World Info**(世界信息) 分区，把两部分都发送出去。这次改动前导入的预设只有一个 **World Info** 分区。要修正它，可以重新导入，或在预设的分区中把 **Lorebook Marker (Before)**(世界书标记（之前）) 和 **Lorebook Marker (After)**(世界书标记（之后）) 加到需要的位置，再移除旧的 **World Info** 分区。
- 放在 SillyTavern 的 Author's Note 前后的 World Info 条目，会以系统消息插入深度 4，也就是 Author's Note 所在的位置（备注之后的条目紧跟在备注之前的条目后面）。放在示例消息前后的条目会移到角色定义之后。导入结果会说明移动了多少条目。
- 预设会带上采样设置：温度、Top P、Top K、Min P、频率惩罚、存在惩罚和推理强度。这些是使用该预设的聊天的初始值；连接或聊天自身设置的值仍然优先。最大回复长度和上下文大小仍由连接设置。这里没有 Top A 和重复惩罚的对应设置，因此会省略它们。

## 不会导入的内容

向导只读取上面第一个表格中列出的类别。其他 SillyTavern 数据（例如全局应用设置和连接方案）不会被导入。文件夹导入结果的 **Not brought over**(未导入) 列表会统计发现的、这里没有对应功能的内容：Quick Reply 集合、指令模板、上下文模板和系统提示词。这次修复前导入的聊天把导入时间用作了消息日期。要修正某个聊天，删除它并重新导入文件（从文件夹导入时，取消勾选 **Skip what's already here**）。

## 相关指南

- [导入和导出角色卡](../characters/import-export.md)
- [导入与导出世界书](../lorebooks/import-export.md)
- [导出与导入聊天](../chats/export-import.md)
- [正则脚本](../extending/regex-scripts.md)
