# 用户角色

用户角色就是在聊天里代表你的那张角色卡，包括你的名字、你的描述和其他可选的细节。Marinara 会把这些内容写进每一次提示词，让 AI 知道自己在跟谁说话。你可以保存很多个用户角色，每个聊天选一个来用。要使用用户角色，见[在聊天里选择用户角色](choosing-your-persona.md)。

## 创建用户角色

1. 点击顶部导航栏里的 **Personas**(用户角色)。如果没看到它，先打开 **More**(更多)。
2. 点击 **New**(新建)，打开 **Create Persona**(创建用户角色) 窗口。
3. 在 **Name**(名称) 里输入名字。这是唯一必填的字段。
4. 点击 **Create**(创建)。

新建出来的用户角色描述是空的，并会在 Persona Editor(用户角色编辑器) 中打开。

5. 打开 **Card**(卡片) 选项卡，写好你的 **Description**(描述)：你的名字、长相和行为方式。
6. 点击顶部标题栏里的 **Save**(保存)。

然后在想使用它的聊天里选择它，见[在聊天里选择用户角色](choosing-your-persona.md)。

## 用户角色的作用

Marinara 会在每一次提示词里把你的用户角色发给 AI。在聊天里选择 **None**(无) 就不发送用户角色。不发送时，AI 会称呼你为“User”。

`{{user}}` 宏是一个占位符。Marinara 在发送提示词之前，会把它换成用户角色的名字。如果你的用户角色叫 Alex，`{{user}}` 就会变成 Alex。见[宏](../prompts/macros.md)。

## Personas 面板

**Personas** 面板就是你的用户角色库。点击某一行，就能在 Persona Editor 里打开这个用户角色。

| 控件 | 作用 |
| --- | --- |
| **Download**(下载) | 打开 [Card Browser](bot-browser.md)，在那里也能找到 PlotLight 上的用户角色。 |
| **Open Library**(打开资料库) | 打开整页的 Persona Library(用户角色库)，它和 Character Library 用的是同一套网格和预览。 |
| **New** | 创建用户角色。 |
| **Import**(导入) | 打开 **Import Persona**(导入用户角色) 窗口。 |
| **Select**(选择) | 开启选择模式，用于批量删除和导出。 |
| 搜索框 | 占位文字是 **Search personas/tags**(搜索用户角色/标签)。它会匹配名称、描述、备注和标签。按标签搜索的方法见[搜索](library-organization.md#search)。 |
| 排序下拉菜单 | **Manual order**(手动排序)、**A-Z**、**Z-A**、**Newest**、**Oldest** 或 **Tokens**(估算的提示词长度)。 |
| **New Folder**(新建文件夹) | 新建一个文件夹。 |
| **Tags**(标签) | 展开用于筛选的标签列表。 |

在 **Manual order** 下，拖动某一行，或者在获得焦点的行上按 <kbd>Alt</kbd>+<kbd>Up</kbd> 或 <kbd>Alt</kbd>+<kbd>Down</kbd>。在触屏上，长按某一行即可把它拿起来。鼠标悬停在某一行上会出现 **Duplicate**(复制) 和 **Delete**(删除)。用户角色多到一页放不下时，会出现 **Load more**(加载更多) 按钮。一个用户角色都没有时，面板会显示 **No personas yet**。

## Persona Editor

打开一个用户角色后，聊天区域会换成整页的 Persona Editor。顶部标题栏里有：

- **Back**(返回) 箭头。
- 头像图块。点击可以上传图片。如果已经配好图像生成用的连接，还会有一个魔杖按钮，也能生成头像。
- 名称输入框和一个备注输入框，备注用来写 `Modern AU version` 这类简短标签。
- **Save**，在你做出改动之前它是禁用的。
- **Export persona**(导出用户角色)、**Add persona as character**(把用户角色添加为角色)、**Duplicate persona**(复制用户角色) 和 **Delete persona**(删除用户角色)。

离开编辑器时，会先保存你的改动。如果保存失败，编辑器会保持打开，草稿也会保留。

选项卡依次是 **Metadata**(元数据)、**Card**、**Convo**(对话)、**Lorebook**(世界书)、**Sprites**(立绘)、**Gallery**(图库)、**Colors**(颜色) 和 **Stats**(属性)。每个选项卡都会跳到同一张长表单里对应的分区。

用户角色编辑器的用法和[角色编辑器](creating-and-editing-characters.md)一样。下面只说明不同之处。

| 选项卡 | 用户角色的特别说明 |
| --- | --- |
| **Metadata** | 身份信息和库信息，见表格下方的列表。 |
| **Card** | 见下文的 [Card 选项卡](#card-tab)。 |
| **Convo** | 只在 Conversation(对话模式) 下使用的字段，见 [Conversation Mode 个人资料](../conversation/profiles.md)。 |
| **Lorebook** | 挂上世界书条目，这个用户角色在聊天里时，这些条目就会触发。见[世界书总览](../lorebooks/overview.md)。 |
| **Sprites** | Game Mode(游戏模式) 和 Roleplay(角色扮演) 中使用的立绘。包含 **Facial Expressions**(面部表情)、**Full-body**(全身) 和 **Clips**(片段)，以及 **Upload Folder**(上传文件夹)。见[角色立绘](sprites.md)。 |
| **Gallery** | 参考图和视频，带 **Upload Persona Images**(上传用户角色图片) 和 **Upload Persona Videos**(上传用户角色视频)。见[角色与用户角色图库](galleries.md)。 |
| **Colors** | 名字、对话和消息框的颜色。见[角色颜色与 RPG 属性](colors-and-stats.md)。 |
| **Stats** | 状态条和 RPG 属性值。见下文的 [Stats 选项卡](#stats-tab)。 |

**Metadata** 选项卡显示：

- **Persona ID**，带 **Copy**(复制)。
- 头像裁剪。
- **Name** 和 **Creator**(作者)。
- **Phonetic name**(读音名)，只在语音合成朗读你的名字时使用。
- **Title / Comment**(标题/备注)，一段简短的标签。
- **Version**(版本)，默认是 `1.0`，带一个 **Automatic versioning**(自动版本号) 开关。
- **Tags**。
- **Creator Notes**(创作者备注)，永远不会发给 AI。

<a id="card-tab"></a>

### Card 选项卡

**Card** 选项卡放的是向 AI 描述你的那些字段。每个字段都有实时的 Token(模型切分文本的最小单位) 估算。

| 字段 | 写什么 | 是否发给 AI |
| --- | --- | --- |
| **Summary**(摘要) | 用于用户角色库和预览的概述。 | 否 |
| **Description** | 你的总体身份和定位。 | 每一次提示词 |
| **Personality**(性格) | 性情、行为方式、说话习惯。 | 是 |
| **Backstory**(背景故事) | 经历、出身、人际关系。 | 是 |
| **Appearance**(外观) | 长相、穿着、视觉细节。 | 是 |
| **Scenario**(场景设定) | 你在角色扮演中的默认处境。 | 是 |
| **Example Dialogue**(对话示例) | 示例对话。用 `<START>` 分隔各段，用 `{{user}}` 表示你的用户角色，用 `{{char}}` 表示对方角色。 | 是 |

**Appearance** 下方的 **Image Appearance Override**(图像专用外貌) 和角色上的用法一样，见 [Card 选项卡](creating-and-editing-characters.md#card-tab)。这些文本框支持宏。

下面这些功能和角色上的一样，只是对象换成了用户角色：

- 每个字段上方的魔杖按钮可以替你写这个字段，见[用魔杖生成角色卡字段](creating-and-editing-characters.md#write-a-card-field-with-the-wand)。
- 每个字段下方的 **Add Alternative Field**(添加替代字段) 可以让选定的聊天使用另一个版本。**Active in**(在……中启用) 列表只显示使用这个用户角色的聊天；聊天改选其他用户角色后，分配会暂停。见[在选定聊天中使用替代字段](creating-and-editing-characters.md#use-an-alternative-field-in-selected-chats)。
- **Version history**(版本历史) 在 **Metadata** 选项卡上。第一次编辑之前，它显示的是 `Previous persona states will appear here after the next edit.`。**Reset**(重置) 会删除所有快照，并把版本设为 1.0。见[版本历史](creating-and-editing-characters.md#version-history)。

<a id="stats-tab"></a>

### Stats 选项卡

**Stats** 选项卡分成两个独立的区块。两者都会送到 HUD，也就是聊天时显示在屏幕上的属性面板。

- **Enable Persona Stats**(启用用户角色属性) 会开启状态条，也就是饥饿、心情这类需求的量表。新开启时会有 Satiety、Energy、Hygiene 和 Mood 四条，数值都是 100，满值 100。**Persona Stats** 智能体会随着剧情推进调整它们。
- **Enable RPG Attributes**(启用 RPG 属性值) 会开启 Pools(HP、MP 这类条) 和 Attributes(力量这类数值)。两者的说明见[角色颜色与 RPG 属性](colors-and-stats.md)。新开启时，HP 和 MP 都是 100，满值 100，STR、DEX、CON、INT、WIS 和 CHA 都是 10。这些数值会随用户角色一起发送，用于战斗和 Game Mode，以及可选的掷骰。智能体不会更新它们。

**Game Mode Icon**(游戏模式图标) 区块设置你在 Game Mode 战斗中的棋子图片，见 [Game Mode 图标](colors-and-stats.md#game-mode-icon)。安装了 Game Mode 规则集（桌游式玩法的一套规则）后，**Ruleset sheets**(规则集人物卡) 区块会保存你在该规则集下的初始配置，见[规则集人物卡](colors-and-stats.md#ruleset-sheets)。这里设置的数值是新聊天的起始默认值。

## 导入和导出用户角色

要导入，在 **Personas** 面板里点击 **Import**。**Import Persona** 窗口接受 `.marinara` 和 `.json` 文件，也可以一次导入多个。Marinara 文件会完整恢复细节、立绘和图库结构。其他工具导出的普通 JSON 文件会逐字段映射成一个新的用户角色，其中名称是必需的。每个文件都会显示成功或失败的标记。

要导出，在编辑器里点击 **Export persona**，或者在选择模式下用 **Export**(导出)。**Export Persona**(导出用户角色) 窗口提供两种格式：

| 格式 | 得到的内容 |
| --- | --- |
| **Marinara Native** | 全部 Marinara 用户角色细节、立绘和挂载的世界书。在两个 Marinara 安装之间搬用户角色时用它。 |
| **Compatible JSON** | 只有普通的用户角色字段，给其他工具用。 |

批量导出会下载一个 zip 文件，每个用户角色各占一个文件。

## 复制或删除用户角色

要复制，点击某一行上的 **Duplicate**，或者编辑器里的 **Duplicate persona**。副本名为“{original name} (Copy)”，保留全部卡片字段、颜色、属性和 Convo 字段。任何聊天所用的用户角色都不会改变。

要删除，点击某一行上的 **Delete**，或者编辑器里的 **Delete persona**，然后确认。删除无法撤销。要一次删除多个，点击 **Select**，勾选要删的用户角色，然后用选择栏里的 **Delete**。如果有删除失败的，这些用户角色会保持勾选，方便你重试。

## 把用户角色添加为角色

编辑器标题栏里的 **Add persona as character** 会在你的角色里新建一张角色卡。它会复制名称、描述、性格、场景设定、背景故事、外观、标签、作者、版本和头像。用户角色本身保持不变。要编辑新卡片，见[创建和编辑角色](creating-and-editing-characters.md)。

## 相关指南

- [在聊天里选择用户角色](choosing-your-persona.md)
- [角色颜色与 RPG 属性](colors-and-stats.md)
- [创建和编辑角色](creating-and-editing-characters.md)
- [Conversation Mode 个人资料](../conversation/profiles.md)
- [宏](../prompts/macros.md)
