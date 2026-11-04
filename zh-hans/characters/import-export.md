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
| | **Global**(全局)：规则会加进 **Presets → Regexes**(预设 → 正则)，在每一次聊天里都生效。 |
| **Split description into fields**(将描述拆分到各字段) | 默认关闭。勾选后，**Description**(描述) 里标明为性格、外观等内容的文字会移到各自的字段里。 |

正则脚本就是一些小的文本替换规则。除非确实想让这些规则处处生效，否则就保留 **Character only**。拆分不会改动旁白类、世界设定类和多角色的角色卡，它们保持原样。

### 自带世界书的角色卡

世界书是一组背景设定条目，AI 会在聊天过程中查阅它。如果角色卡内置了世界书，导入会暂停，并显示 **Embedded lorebook found**(发现内嵌世界书)。这里会逐个列出文件，以及每个文件包含多少条目。为整批文件选一种处理方式：

- **Import Lorebook**(导入世界书) 会额外创建一本独立的 Marinara 世界书，并关联到该角色。
- **No Import**(不导入) 只把世界书留在角色卡内部。

### 导入整个 SillyTavern 文件夹

要搬走整个 SillyTavern 安装，请使用 **Settings**(设置) 中 **Imports**(导入) 选项卡里的批量导入工具。它会把角色、聊天、预设和世界书一起搬过来。见[从 SillyTavern 导入](../data/importing-from-sillytavern.md)。

## 导出一个角色

1. 在编辑器里打开这个角色。
2. 点击编辑器顶部的 **Export character**(导出角色)。**Export Character** 窗口随即打开。
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
