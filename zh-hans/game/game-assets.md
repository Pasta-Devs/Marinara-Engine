# 游戏素材：音乐、音效、立绘和背景

本指南介绍 Game Mode(游戏模式) 使用的游戏素材库，包括音乐、音效、角色美术和场景背景。内容涵盖自带的入门素材、**Asset Browser**(素材浏览器) 文件管理器、如何上传自己的文件、如何为每个游戏挑选可用素材，以及 Game Mode 可以为你生成的音效和音乐。

## 什么是游戏素材

游戏素材就是 Game Mode 在一局会话进行时播放和显示的媒体文件。Marinara Engine 把它们分成五类：

- **Music**(音乐)：随场景变化的背景音乐。
- **Ambient**(环境音)：循环播放的环境声音，比如自然、城市或室内音效。
- **Sound Effects**(音效，也写作 SFX)：菜单、战斗和探索用的短音效。
- **Sprites**(立绘)：显示在屏幕上的角色和物件美术。
- **Backgrounds**(背景)：衬在故事后面的场景图像。

Game Mode 会自己读取这个素材库，根据场景自动挑选音乐、环境音和背景，游玩过程中不需要手动指定素材。

## 自带的入门素材

服务器首次启动时，Marinara 会装入一套免费的入门素材库。之后启动时，如果自带素材有变化，还会重新刷新这些文件。入门素材包含：

- 5 首 **Music** 曲目，分别对应几种场景氛围。
- 一组 **Ambient** 循环音，分放在自然、城市和室内文件夹下。
- 菜单、战斗和探索用的 **Sound Effects**。

**Backgrounds** 没有自带内容，背景文件夹一开始是空的，只有上传图像或者 Game Mode 生成场景美术之后才会有东西。
角色 **Sprites** 也没有自带内容，只需要加入符合自己游戏的角色美术即可。

自带文件全部采用 CC0 许可，也就是说它们属于公有领域，可以随意使用。每个文件的完整署名信息都写在随素材一起放在磁盘上的 `CREDITS.md` 文本文件里，应用内不会显示。

自带的文件和文件夹受保护，无法在 **Asset Browser** 里删除或移动，入门素材库因此始终保持完整。重命名和复制仍然可以做。

## 打开 Asset Browser

**Asset Browser** 是游戏素材的文件管理器，有两种打开方式。

从 **Settings**(设置) 打开：

1. 打开 **Settings**。
2. 切到 **Imports**(导入) 选项卡。
3. 找到 **Game Assets**(游戏素材) 部分。
4. 点击 **Asset Browser** 按钮。

从游戏里打开：

1. 打开一个 Game Mode 聊天。
2. 点击 **Game Assets**(游戏素材) 按钮（文件夹图标），它最初位于聊天右上角。电脑和手机上都能拖动。

这个按钮只在 Game Mode 聊天里出现。它打开 **Game Assets**，里面包含 **Asset Browser**：在电脑上是可移动窗口，在手机上是全宽面板。

如果用 **Put back in Chat Settings** 把它放回过聊天设置，就打开 Chat Settings 里的 **Game Assets** 区域。

顶部工具栏上有一条从 **Game Assets** 开始的路径导航。旁边是 **Grid view**(网格视图) 和 **List view**(列表视图) 的切换开关、一个 **Upload**(上传) 按钮和一个 **New**(新建) 按钮，此外还有 **Rescan**(重新扫描) 按钮、**Open in system folder**(在系统文件夹中打开) 按钮和 **Search in folder**(在文件夹中搜索) 输入框。屏幕较宽时，左侧的文件夹树可以在各分类之间快速跳转。

## 上传自己的素材

上传素材有两种方式，挑顺手的那种即可。

### 从 Asset Browser 上传

1. 打开 **Asset Browser**。
2. 点进五个分类文件夹之一，或者其中的某个子文件夹。
3. 点击 **Upload** 选择文件，也可以把文件拖到文件区域上。

必须先进入某个分类文件夹。如果在顶层放下文件，应用会提示先打开一个分类文件夹再上传。

### 从 Settings 上传

1. 打开 **Settings**，切到 **Imports** 选项卡。
2. 找到 **Game Assets** 部分。
3. 在 **Type**(类型) 菜单里选一个分类：**Music**、**Ambient**、**Sound Effects**、**Sprites** 或 **Backgrounds**。
4. 在 **Folder**(文件夹) 输入框里设置目标位置，也可以直接用推荐的默认值。
5. 点击 **Choose Files**(选择文件) 挑选文件。
6. 点击 **Upload to Server**(上传到服务器)。

每个 **Type** 都会给 **Folder** 输入框填一个合理的默认值。默认值如下：

- **Music**：`exploration/fantasy/calm`
- **Ambient**：`nature`
- **Sound Effects**：`exploration`
- **Sprites**：`generic-fantasy`
- **Backgrounds**：`custom`

### 文件类型和大小规则

服务器会按下面的规则检查每一次上传。两种上传方式都适用。

| 分类                          | 允许的文件类型                       |
| ----------------------------- | ------------------------------------ |
| Music、Ambient、Sound Effects | MP3、OGG、WAV、FLAC、M4A、AAC、WebM  |
| Sprites                       | PNG、JPG、JPEG、GIF、WebP、AVIF、SVG |
| Backgrounds                   | PNG、JPG、JPEG、GIF、WebP、AVIF      |

音频和图像文件每个最大 50 MB，文本文件最大 10 MB。不符合该分类的文件类型会被服务器拒绝，错误提示里会列出允许的类型。

### 音乐文件夹的规则

音乐的文件夹结构有严格要求。每首音乐都必须放在 `state/genre/intensity` 这样的三层路径下，例如 `exploration/fantasy/calm`。路径对不上，上传就会失败。

允许的取值是：

- State：`exploration`、`dialogue`、`combat`、`travel_rest`。
- Genre：`fantasy`、`horror`、`romance`、`mystery`、`scifi`、`modern`、`slice_of_life`、`adventure`、`drama`、`custom`，或者某个设定的类别（见下文），例如 `wuxia`。
- Intensity：`calm`、`tense`、`intense`。

Game Mode 正是靠这套结构判断什么时候播哪首曲子。环境音、音效、立绘和背景的文件夹没有这条限制，子文件夹可以随意命名。

<a id="a-settings-own-art-and-music"></a>

### 设定自己的美术和音乐

用设定包开始的游戏有一个美术类别，修改设定包用词时显示在 **Art and music**(美术与音乐) 下：`fantasy`、`scifi`、`modern`、`wuxia`、`jazz_age`、`wasteland`，或者设定包自己的类别。游戏会使用以它的类别命名的文件夹，以及所有不以类别命名的文件夹，而不使用其他类别的文件夹，所以赛博朋克游戏绝不会播放奇幻战斗音乐，也不会显示魔法森林。如果它自己类别的文件夹和共享文件夹里都没有合适的，就什么也不播放，而不是换用其他类别的曲目。

- **音乐**：把设定的曲目放在 `music/<state>/<family>/<intensity>` 里，例如 `combat/wuxia/intense`。它们会优先于共享曲目播放。
- **背景**：`backgrounds/<family>`。用设定包进行的游戏中生成的背景也会保存在这里。
- **战斗音效**：`sfx/combat/<family>` 里与某个自带音效同名的音效，例如 `sword-swing`，会在该类别的游戏中替换它。自带的战斗音效是奇幻风格的，所以在你添加其他类别自己的音效之前，那些类别的战斗是安静的。

自带的入门背景算作共享背景，但奇幻的那几张（`ancient_library`、`castle_cliff`、`enchanted_forest`）和现代的 `city_night` 除外。没有设定包的游戏照旧使用所有文件夹。在美术类别出现之前保存的设定包仍然可用：由入门设定包制作的使用该入门设定包的类别，其他的则在你于 **Art and music** 下选定类别之前使用所有文件夹。[限定某个游戏能用哪些素材](#choosing-which-assets-a-game-can-use)中介绍的选择栏会显示当前打开的游戏的类别。

## 整理素材

**Asset Browser** 可以帮你把文件收拾整齐。在电脑上右键点击某个文件或文件夹，或者点它的“...”菜单，就能看到可用操作。

对文件的操作：

- **Rename**(重命名)：给文件改名。如果同一文件夹里已有同名文件，重命名会失败。
- **Move**(移动) 和 **Copy**(复制)：通过文件夹选择器把文件送到另一个文件夹。
- **Delete**(删除)：删掉这个文件。
- **Download**(下载)：把文件保存到设备上。

对文件夹的操作：

- **Create subfolder**(新建子文件夹)：在它里面建一个新文件夹。
- **Open in system folder**：在电脑的文件管理器里显示这个文件夹。
- **Delete folder**(删除文件夹)：删掉这个文件夹。如果里面还有文件，必须先勾选 **Delete everything inside**(删除内部全部内容)。

工具栏上的 **New** 按钮同样可以在当前文件夹里新建东西，提供 **New folder**(新建文件夹)、**New text file**(新建文本文件) 和 **New markdown file**(新建 markdown 文件) 三项。

想一次处理多个文件，就用每个文件上的复选框。会有一条状态栏显示选中了多少文件，并提供 **Select all**(全选)、**Move**、**Copy** 和 **Delete** 按钮。文件很多的文件夹一次只显示一部分内容，下面有 **Load more**(加载更多) 按钮。

每个文件夹都可以写一段简短说明。点击文件夹说明文字，或者点 **Add description...** 提示，就能写。五个分类文件夹的说明是固定的，改不了。

记住自带的入门文件受保护：可以重命名和复制，但不能移动或删除。

## 在外部改动后重新扫描

Marinara 内部维护着一份素材清单，好让 Game Mode 快速找到文件。通过应用上传时，这份清单会自动更新。

如果直接在电脑上把文件复制进游戏素材文件夹，绕开了应用，应用不会立刻察觉。点击 **Rescan** 按钮，它就会重新读取文件夹、收录新文件。**Rescan** 在 **Asset Browser** 工具栏和 **Settings** 下的 **Game Assets** 部分都有。

<a id="choosing-which-assets-a-game-can-use"></a>

## 限定某个游戏能用哪些素材

每个 Game Mode 聊天都可以只使用素材文件夹中的一部分。比如想让恐怖游戏跳过那些欢快的音乐时，这个功能就很有用。

创建时在 **Features**(功能) 这一步展开 **Adjust Game Assets for this Game**(为本游戏调整素材范围)。已有的游戏则打开该游戏的 **Game Assets** 窗口。

然后：

1. 点击 **Game assets** 按钮。启用期间它会变成 **Selecting**。
2. 用每个文件夹上的小状态控件把它纳入或排除。

会有一条状态栏显示“All folders included”或者排除了多少文件夹，并提供 **Reset to all** 按钮重新纳入全部。这项选择只对那一个聊天生效。它改变的是 Game Mode 可以从哪些文件夹里挑素材，不会删除或隐藏任何文件，在那个 Game Mode 聊天之外也没有任何影响。

<a id="generated-sound-effects-and-music"></a>

## 生成音效与音乐

Game Mode 还可以借助 AI 音频服务 ElevenLabs，为你的场景生成新的音效和音乐。你需要一个 ElevenLabs API 密钥。每生成一段新音效或一首新曲目，都会用你的账号向 ElevenLabs 发出一次请求。

先设置一个音频连接：

1. 打开 **Connections**(连接) 面板，用 **Audio**(音频) 服务商新建一个连接。
2. 在 **Audio Source**(音频来源) 下选择 **ElevenLabs**，然后粘贴你的 ElevenLabs API 密钥。
3. 打开 **Game sound effects**(游戏音效) 或 **Game music**(游戏音乐)，也可以两个都打开。这两个开关只在 **ElevenLabs** 来源下出现。
4. 保存连接。

然后在创建游戏时开启它：

1. 在设置向导的 **Features** 这一步，找到 **Game Audio**(游戏音频) 卡片。
2. 在 **Audio Connection**(音频连接) 下选择你的 ElevenLabs 连接，或者保留 **Use the default audio connection**(使用默认音频连接)。
3. 让 **Sound effects**(音效) 和 **Music**(音乐) 保持开启，或者关掉不想要的那一项。

只有所选连接是开启了对应开关的 ElevenLabs 连接，才能打开 **Sound effects** 或 **Music**。条件不满足时，卡片上会给出提示。

游戏过程中：

- **Sound effects**：GM 回合结束后，Marinara 会向 ElevenLabs 请求贴合场景的简短音效。
- **Music**：队伍每到一个地方、每遇到一种战斗（比如首领战），Marinara 都会创作一首约两分钟长的纯器乐曲目。每首曲目只生成一次，之后重复使用。新地点的曲目要等到之后的场景切换时才开始播放，所以音乐不会在场景中途突然切入。战斗曲目一准备好就会淡入。

生成的音效和曲目会和你的游戏素材保存在一起，所以同一段音效不会生成两次。如果 **Music DJ** 正在为这个游戏播放音乐，Game Mode 就不会生成音乐。

## Music DJ 的自定义音乐文件夹

**Music DJ** 是一个辅助智能体，可以在游戏过程中播放音乐。它运行在 Custom 模式时，会播放指定文件夹里的曲目。这个文件夹有两处可以设置。

为某个聊天启用 **Music DJ** 时，设置表单会沿用 Music DJ 智能体上保存的音乐来源。**Game Assets** 显示的是游戏素材内部的一个路径，比如 `music` 或 `music/combat`。**Folder on this device**(本设备上的文件夹) 显示的是保存下来的服务器设备路径，旁边有一个 **Choose Folder**(选择文件夹) 按钮。

完整的 **Music DJ** 编辑器里有一个 **Custom Music Library**(自定义音乐库) 部分，其中的 **Use Game Assets music folder**(使用游戏素材音乐文件夹) 开关在两种模式之间切换：

- 开关打开：**Game Assets music folder** 输入框读取游戏素材内部的某个文件夹，比如 `music` 或 `music/combat`。**Open Folder**(打开文件夹) 按钮会在服务器所在的机器上打开那个文件夹。
- 开关关闭：**Music folder on this device** 输入框可以让 Custom 模式播放运行服务器那台电脑上任意文件夹里的音乐。点击 **Select Folder**(选择文件夹) 打开系统文件夹选择器，也可以直接把文件夹路径粘进输入框。

选择应用之外的文件夹需要更高的权限。在跑服务器的那台电脑上操作时，不用额外配置就能用。从别的设备或通过远程访问操作时，必须先配置管理员访问权限。启用方法见[远程访问](../REMOTE_ACCESS.md)。音乐播放器的其他内容见 [Music DJ](../media/music.md)。

## 在电脑上打开素材文件夹

**Open in system folder** 按钮会在电脑常用的文件管理器里打开选中的素材文件夹。只有在运行服务器的那台电脑上使用应用时才有效。在手机、平板或另一台电脑上，应用会提示只能从运行 Marinara 的那台设备打开系统文件夹。

## 相关指南

- [Music DJ：Spotify、YouTube 与本地音乐](../media/music.md)
- [支持的 AI 服务商](../connections/providers-reference.md)
- [Game Mode：入门](getting-started.md)
- [远程访问：登录与 IP 允许列表](../REMOTE_ACCESS.md)
