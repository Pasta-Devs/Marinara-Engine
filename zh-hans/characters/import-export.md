# 导入和导出角色卡

本指南介绍如何把角色卡导入 Marinara Engine，以及如何把自己做的角色导出。内容包括 Marinara 支持的文件格式、导入窗口里的各个选项，还有三种导出格式。

角色卡是一个文件，里面装着一个角色的全部内容：名字、描述、性格、开场白，通常还有一张头像。有了角色卡，同一个角色就能在 Marinara 和其他角色扮演应用之间搬来搬去。

## 导入格式

**Import Character**(导入角色) 窗口支持四种文件格式。可以一次拖入多个文件，格式混着放也没问题。

| 文件格式 | 说明 |
| --- | --- |
| **.json** | 纯文本形式的角色卡（Chara Card V2）。 |
| **.png** | 角色卡数据藏在图片内部的角色卡图像。 |
| **.charx** | Character Card V3 打包格式（CharX），RisuAI 使用的基于 zip 的格式。 |
| **.marinara** | Marinara 自家的导出文件（有时写成 `.marinara.json`）。 |

**.marinara** 是 Marinara 自己的格式，保留的细节最多。另外三种来自 SillyTavern、Chub、Risu 这类工具。

## 导入一个角色

按下面的步骤把一个或多个角色卡放进角色库。

1. 打开 **Characters**(角色) 面板。
2. 点击工具栏里的 **Import**(导入) 按钮，它是一个带下载箭头的图标按钮。**Import Character** 窗口随即打开。
3. 把文件拖到窗口上，或者点击窗口去浏览文件。窗口里会显示“Drop one or more files here or click to browse”。
4. 设置两个导入选项（下面分别说明）。这两个选项对本批次的每个文件都生效。
5. 等待结果列表出现。每个文件要么显示绿色对勾加“Imported”和名称，要么显示红色标记加一条错误信息。

### 选择保留哪些标签

**Imported card tags**(导入的角色卡标签) 选项决定如何处理传入角色卡上的标签，也就是标签导入模式。有三个选择：

- **All tags**：保留来源角色卡的全部标签。这是默认值。
- **No tags**：跳过来源标签。
- **Existing only**：只保留角色库里已经有的标签。

### 选择正则脚本的作用范围

有些角色卡自带正则脚本，也就是一些小的文本替换规则。**Imported regex scripts**(导入的正则脚本) 选项控制它们的作用范围：

- **Character only**：脚本只对这个角色生效。这是默认值。
- **Global**：脚本会加进 **Presets**(预设) 的 **Regexes** 部分，在每一次聊天里都生效。

除非确实想让这些规则处处生效，否则就选 **Character only**。

### 自带世界书的角色卡

世界书是一组背景设定条目，AI 在聊天过程中可以随时查阅。如果正在导入的角色卡内嵌了世界书，导入会暂停，并弹出 **Embedded lorebook found**(发现内嵌世界书) 面板，逐个列出文件以及各自包含多少条目。整批文件只能选一种处理方式：

- **Import Lorebook**：额外创建一本独立的 Marinara 世界书，并关联到该角色。
- **No Import**：世界书只留在角色卡内部。

### 一次导入多个角色卡

批量导入用的还是 **Import Character** 窗口。选中多个文件，Marinara 会挨个导入。结果列表里每个文件占一行，哪些角色卡成功、哪些失败一目了然。

## 导出一个角色

在编辑器里打开一个角色，然后点击顶部工具栏的 **Export character**(导出角色)。**Export Character** 窗口提供三种格式。

| 格式 | 得到什么 | 适合场景 |
| --- | --- | --- |
| **Marinara Native** | 一个 `.marinara.json` 文件，保留 Marinara 的元数据、立绘、图库图片和关联的世界书。 | 在不同的 Marinara 安装之间完整搬运一个角色。 |
| **Compatible JSON** | 纯 Chara Card V2 格式的 JSON，不带 Marinara 的外层包装。 | 分享给其他能读 JSON 角色卡的应用。 |
| **Compatible PNG Card** | Chara Card V2 图像，角色卡数据直接嵌在图片里。 | 需要 PNG 角色卡的应用和网站，比如 SillyTavern、Chub、Risu。 |

想把所有内容原样留住就选 **Marinara Native**。文件要交给别的工具时，选两种 **Compatible** 格式之一。这两种兼容格式会丢掉立绘、图库图片这类 Marinara 专有的附加内容。非空的 **Backstory**(背景故事) 和 **Appearance**(外貌) 字段会附加到标准 Description 中，让其他 V2 读取工具也能保留这些角色信息。这些字段会从导出的扩展信息中移除，避免重新导入时重复。保存的角色卡不会改变；**Marinara Native** 会保留独立字段。

## 一次导出多个角色

多个角色可以打包成一个 zip 文件一起导出。

1. 打开 **Characters** 面板。
2. 点击工具栏里的 **Select**(选择) 按钮进入选择模式，它是一个带对勾的图标按钮。
3. 勾选想导出的角色。
4. 点击底部操作栏里的 **Export**(导出)。Marinara 会下载一个名为 `marinara-characters.zip` 的压缩包。

zip 里每个角色对应一个 **Marinara Native** 文件。批量导出没有 PNG 和兼容 JSON 选项，需要这两种格式时请用单个角色的导出。

## 导入整个 SillyTavern 文件夹

上面的步骤适用于手动挑选的角色卡。要一次搬走整个 SillyTavern 安装，请改用批量文件夹导入功能，它会把角色、聊天、预设和世界书一起搬过来，入口在 **Settings**(设置) 的 **Imports** 选项卡下。完整流程见[从 SillyTavern 导入](../data/importing-from-sillytavern.md)。

## 相关指南

- [创建和编辑角色](creating-and-editing-characters.md)
- [Card Browser：查找并导入角色](bot-browser.md)
- [从 SillyTavern 导入](../data/importing-from-sillytavern.md)
