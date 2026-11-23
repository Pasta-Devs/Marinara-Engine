# 导入和导出角色卡

角色卡是一个文件，里面装着一个角色：名字、描述、性格、开场白，通常还有一张头像。导入角色卡，就能把其他应用和网站上的角色加进来。导出自己的角色，可以用来备份或分享。

## 导入一个角色

开始之前：设备上要有一个角色卡文件。想直接在网上找角色卡，见 [Card Browser](bot-browser.md)。

1. 点击顶部导航栏里的 **Characters**(角色)。如果没看到它，先打开 **More**(更多)。
2. 点击工具栏里的 **Import**(导入)（带下载箭头的图标）。**Import Character**(导入角色) 窗口随即打开。
3. 设置下面的导入选项。这些选项对本批次的每个文件都生效。
4. 把文件拖到窗口上，或者轻点或点击窗口，打开设备的文件选择器。可以一次选多个文件，格式混着放也没问题。
5. 等待结果列表出现。每个文件要么显示绿色对勾，要么显示红色标记加一条错误信息。提示文字是 `Imported "Name"`、`Imported "Name" with its embedded lorebook` 或 `Imported "Name" without creating the embedded lorebook`。
6. 到 **Characters** 里找到新导入的角色。

Marinara 支持四种文件格式：

| 文件格式 | 说明 |
| --- | --- |
| **.json** | 以文本形式保存的角色卡。Marinara 的导出文件（`.marinara.json`）也是 .json 文件。 |
| **.png** | 角色卡数据藏在图片内部的角色卡图像。 |
| **.charx** | 以 zip 文件形式保存的角色卡包。 |
| **.marinara** | Marinara 的导出文件。 |

Marinara 导出文件保留的细节最多。其他几种格式来自 SillyTavern、Chub、Risu 这类工具。

如果没有成功：看文件旁边的红色提示。本批次的其他文件仍会照常导入。

<a id="import-options"></a>

### 导入选项

| 选项 | 可选值 |
| --- | --- |
| **Imported card tags**(导入的角色卡标签) | **All tags**(默认)：保留所有标签。 |
| | **No tags**：跳过这些标签。 |
| | **Existing only**：只保留角色库里已有的标签。 |
| **Imported regex scripts**(导入的正则脚本) | **Character only**(默认)：规则只对这个角色生效。 |
| | **Global**(全局)：规则会加进 **Presets → Regexes**(预设 → 正则)，可在不同聊天中运行。 |
| **Split description into fields**(将描述拆分到各字段) | 默认关闭。勾选后，**Description**(描述) 里标明为性格、外观等内容的文字会移到各自的字段里。 |

正则脚本就是一些小的文本替换规则。除非确实想让这些规则处处生效，否则就保留 **Character only**。拆分不会改动旁白类、世界设定类和多角色的角色卡，它们保持原样。

### 自带世界书的角色卡

世界书是一组背景设定条目，AI 会在聊天过程中查阅它。如果角色卡内置了世界书，导入会暂停，并显示 **Embedded lorebook found**(发现内嵌世界书)。这里会逐个列出文件，以及每个文件包含多少条目。为整批文件选一种处理方式：

- **Import Lorebook**(导入世界书) 会额外创建一本独立的 Marinara 世界书，并关联到该角色。
- **No Import**(不导入) 只把世界书留在角色卡内部。

### 导入整个 SillyTavern 文件夹

要搬走整个 SillyTavern 安装，请使用 **Settings**(设置) 中 **Imports**(导入) 选项卡里的批量导入工具。它会把角色、聊天、预设和世界书一起搬过来。见[从 SillyTavern 导入](../data/importing-from-sillytavern.md)。

<a id="update-a-character-you-already-have"></a>

## 更新已有角色

角色卡作者发布新版后，可以就地更新现有角色，不必再添加一个。角色会保留聊天、记忆、图库、立绘、文件夹、收藏星标、颜色和你自己的标签。当前角色卡会先保存到 **Version history**(版本历史)（即使自动版本管理已关闭），方便恢复。

### 从导入窗口更新

1. 照常导入新版角色卡文件（步骤见上文）。
2. 如果它与已有角色相符，导入会停在 **Already in your library**(库中已存在)。Marinara 会匹配从同一个 Card Browser 页面下载的角色卡，或名称和创作者相同的角色卡。每个选项下方都会显示匹配原因。
3. 为每张角色卡选择一种处理方式：
   - **Update "Name"**(更新“Name”)：就地更新该角色（默认）。
   - **Update another character…**(更新其他角色…)：从列表里任选一个角色。适用于通过其他途径获取的角色卡，例如先从网站导入 SillyTavern，再导入 Marinara，导致名称或创作者已不再匹配。
   - **Add as a new character**(添加为新角色)：两份都保留。
   - **Skip this card**(跳过此角色卡)：不导入这张卡。
4. 选择是否 **Use the new card's picture**(使用新角色卡的图片)，以及如何处理 **Creator's Notes**(创作者注释)（见下文）。
5. 点击 **Continue**(继续)。如果角色卡内置了世界书，下一步仍会照常询问。更新角色时，已关联的世界书会用新条目刷新，不会再复制一本。
6. 结果会显示 `Updated "Name". Its old card is in Version history.`

### 从角色编辑器更新

1. 打开角色，先保存所有改动。
2. 点击 **Save**(保存) 旁边的 **⋯**，选择 **Update from card file…**(从角色卡文件更新…)。
3. 选择新版角色卡（.png、.json 或 .charx），检查各项选择后点击 **Update**(更新)。

对于从 [Card Browser](bot-browser.md) 下载的角色，同一个菜单里还有 **Check for update**(检查更新)。它会在 Card Browser 中打开该角色卡的页面，可以在那里比较并导入新版。

### 创作者注释

Creator's Notes 是 **Characters** 中每张角色卡下方的简短文字，有些人还会把自定义 CSS 放在这里。选择一种处理方式：

| 选择 | 处理方式 |
| --- | --- |
| **Merge: keep mine, add the author's changes**(合并：保留我的注释，加入作者的改动)（默认） | 保留你的文字和 CSS。作者新增的行会插在第一个样式块之前；作者删除的行，如果你没有修改过，也会删掉。如果你从未编辑过注释，就直接使用新版角色卡的注释。 |
| **Use the card's notes**(使用角色卡的注释) | 用角色卡的注释替换你的注释。 |
| **Keep mine**(保留我的注释) | 你的注释保持原样。 |

此功能推出前导入的角色卡没有记录原始注释，所以第一次合并只会添加你还没有的行。

### 撤销更新

打开角色，在 **Metadata**(元数据) 选项卡里找到 **Version history**，恢复更新前的版本。见[版本历史](creating-and-editing-characters.md#version-history)。

## 导出一个角色

1. 在编辑器里打开这个角色。
2. 点击编辑器顶部的 **…**，然后点击 **Export character**(导出角色)。**Export Character** 窗口随即打开。
3. 选择一种格式。Marinara 会下载这个文件。

| 格式 | 得到什么 | 适合场景 |
| --- | --- | --- |
| **Marinara Native** | 一个 `.marinara.json` 文件，包含 Marinara 的元数据、立绘、图库图片和关联的世界书。 | 在不同的 Marinara 安装之间完整搬运一个角色。 |
| **Compatible JSON** | 一个其他应用能读取的纯角色卡文件。它会丢掉立绘、图库图片这类 Marinara 专有的附加内容。 | 能读取 JSON 角色卡的其他应用。 |
| **Compatible PNG Card** | 角色卡数据嵌在图片里的角色卡图像。它带有你的立绘，但不带图库图片。 | 需要 PNG 角色卡的应用和网站，比如 SillyTavern、Chub、Risu。 |

两种 **Compatible** 格式都会把非空的 **Backstory**(背景故事) 和 **Appearance**(外观) 字段附加到标准的 **Description** 里，让其他应用也能保留这些信息。你保存的角色卡不会改变。

角色卡的[交互式引导](interactive-onboarding.md)会由 **Marinara Native** 和 **Compatible PNG Card** 保留，所以别人把这张卡导入 Marinara 后，它仍会提出这些问题。**Compatible JSON** 则不会保留。

## 一次导出多个角色

1. 点击顶部导航栏里的 **Characters**。如果没显示，先点 **More**。
2. 点击工具栏里的 **Select**(选择，对勾图标)，勾选想导出的角色。
3. 点击底部栏里的 **Export**(导出)。Marinara 会下载 `marinara-characters.zip`。

zip 里每个角色对应一个 **Marinara Native** 文件。批量导出没有 PNG 或 JSON 选项，需要这两种格式时请用单个角色的导出。更多选择角色的方法，见[整理角色库](library-organization.md#export-or-delete-many-characters)。

## 相关指南

- [创建和编辑角色](creating-and-editing-characters.md)
- [Card Browser：查找并导入角色](bot-browser.md)
- [从 SillyTavern 导入](../data/importing-from-sillytavern.md)
