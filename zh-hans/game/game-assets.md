# 游戏素材：音乐、音效、立绘和背景

游戏素材是 Game Mode(游戏模式) 播放和显示的媒体文件：音乐、声音、角色美术和场景背景。本指南介绍如何使用入门素材、在 **Asset Browser**(素材浏览器) 里上传自己的文件、限定某个游戏能用哪些素材，以及生成音效和音乐。

Game Mode 会自己读取素材库，根据场景挑选音乐、环境音和背景，所以游玩时不需要手动指定素材。

| 分类 | 说明 |
| --- | --- |
| **Music**(音乐) | 随场景变化的背景音乐。 |
| **Ambient**(环境音) | 循环播放的环境声音，比如自然、城市或室内音效。 |
| **Sound Effects**(音效，SFX) | 菜单、战斗和探索用的短音效。 |
| **Sprites**(立绘) | 显示在屏幕上的角色和物件美术。 |
| **Backgrounds**(背景) | 衬在故事后面的场景图像。 |

## 入门素材

服务器首次启动时，Marinara 会装入一套免费的入门素材库；之后启动时，如果自带素材有变化，还会刷新它。其中包含：

- 5 首 **Music** 曲目，对应不同的场景氛围。
- 放在 `nature`、`urban` 和 `interior` 文件夹下的 **Ambient** 循环音。
- 菜单、战斗和探索用的 **Sound Effects**。

Asset Browser 里的 **Backgrounds** 和 **Sprites** 文件夹一开始是空的。没有自带的角色立绘，所以要加入适合你自己游戏的美术。背景方面，Game Mode 还会使用应用自身的背景库。全新安装时，背景库里有 13 张入门图像和一张纯色的 `Black.jpg`，游戏无需上传就能使用。如果那个文件夹里原本已有图像，则只会恢复 `Black.jpg`。生成的场景美术和你上传的文件会添加进去。

所有自带音频都采用 CC0 许可（公有领域，可以随意使用）。每个文件的署名信息都写在随素材一起放在磁盘上的 `CREDITS.md` 文件里，应用内不会显示。

自带的文件和文件夹受保护。在 **Asset Browser** 里不能删除或移动它们，但可以重命名或复制。

## 打开 Asset Browser

**Asset Browser** 是游戏素材的文件管理器。从 **Settings**(设置) 打开：

1. 打开 **Settings**。
2. 切到 **Imports**(导入) 选项卡。
3. 找到 **Game Assets**(游戏素材)，点击 **Asset Browser**。

也可以从游戏里打开：

1. 打开一个 Game Mode 聊天。
2. 点击或轻点聊天右上角附近的 **Game Assets** 按钮（文件夹图标）。在电脑或手机上都可以把它拖到别处。

这个按钮只在 Game Mode 聊天里出现。它会打开内含 **Asset Browser** 的 **Game Assets**：在电脑上是可移动窗口，在手机上是全宽面板。如果你用 **Put back in Chat Settings**(放回聊天设置) 把它移走了，就改为打开 Chat Settings(聊天设置) 里的 **Game Assets** 区域。

工具栏上有一条从 **Game Assets** 开始的路径导航、**Grid view**(网格视图) 和 **List view**(列表视图) 切换开关、**Upload**(上传)、**New**(新建)、**Rescan**(重新扫描)、**Open in system folder**(在系统文件夹中打开)，以及 **Search in folder**(在文件夹中搜索) 输入框。屏幕较宽时，左侧的文件夹树可以帮你在各分类之间快速跳转。

## 上传自己的素材

Marinara 会按[文件类型和大小](#file-types-and-sizes)里的规则检查每一次上传。两种方式任选其一。

### 从 Asset Browser 上传

1. 打开 **Asset Browser**。
2. 打开五个分类文件夹之一，或者其中的某个子文件夹。
3. 点击 **Upload** 选择文件，或者把文件拖到文件区域上。

必须先进入某个分类文件夹。如果在顶层放下文件，应用会提示你先打开一个分类文件夹。

### 从 Settings 上传

1. 打开 **Settings**，切到 **Imports** 选项卡。
2. 在 **Game Assets** 里，从 **Type**(类型) 中选一个分类：**Music**、**Ambient**、**Sound Effects**、**Sprites** 或 **Backgrounds**。
3. 在 **Folder**(文件夹) 里设置目标位置，或者保留默认值。
4. 点击 **Choose Files**(选择文件)，选中你的文件。
5. 点击 **Upload to Server**(上传到服务器)。

如果没有成功：错误提示会列出该分类允许的文件类型。如果是音乐，请检查文件夹路径（见[音乐文件夹规则](#the-music-folder-rule)）。

**Folder** 的默认值：

| 类型 | 默认文件夹 |
| --- | --- |
| **Music** | `exploration/fantasy/calm` |
| **Ambient** | `nature` |
| **Sound Effects** | `exploration` |
| **Sprites** | `generic-fantasy` |
| **Backgrounds** | `custom` |

<a id="file-types-and-sizes"></a>

### 文件类型和大小

| 分类 | 允许的文件类型 |
| --- | --- |
| Music、Ambient、Sound Effects | MP3、OGG、WAV、FLAC、M4A、AAC、WebM |
| Sprites | PNG、JPG、JPEG、GIF、WebP、AVIF、SVG |
| Backgrounds | PNG、JPG、JPEG、GIF、WebP、AVIF |

音频和图像文件每个最大 50 MB。文本文件最大 10 MB。

<a id="the-music-folder-rule"></a>

### 音乐文件夹规则

每首音乐都必须放在 `state/genre/intensity` 这样的三层路径下，例如 `exploration/fantasy/calm`。路径对不上，上传就会失败。Game Mode 正是靠这套结构判断什么时候播放哪首曲子。

- State：`exploration`、`dialogue`、`combat`、`travel_rest`。
- Genre：`fantasy`、`horror`、`romance`、`mystery`、`scifi`、`modern`、`slice_of_life`、`adventure`、`drama`、`custom`，或者某个设定的类别（见下文），例如 `wuxia`。
- Intensity：`calm`、`tense`、`intense`。

环境音、音效、立绘和背景的文件夹没有这条规则，子文件夹可以随意命名。

## 整理素材

在电脑上右键点击文件或文件夹，或者使用它的“...”菜单，就能看到可用的操作。

| 文件操作 | 作用 |
| --- | --- |
| **Rename**(重命名) | 如果该文件夹里已有同名文件，会失败。 |
| **Move**(移动)、**Copy**(复制) | 通过文件夹选择器把文件送到另一个文件夹。 |
| **Delete**(删除)、**Download**(下载) | 删除文件，或者把它保存到你的设备上。 |

| 文件夹操作 | 作用 |
| --- | --- |
| **Create subfolder**(新建子文件夹) | 在里面新建一个文件夹。 |
| **Open in system folder** | 在电脑的文件管理器里显示它。 |
| **Delete folder**(删除文件夹) | 如果里面有文件，必须先勾选 **Delete everything inside**(删除内部全部内容)。 |

工具栏上的 **New** 可以在当前文件夹里创建 **New folder**(新建文件夹)、**New text file**(新建文本文件) 或 **New markdown file**(新建 markdown 文件)。想一次处理多个文件，就勾选它们的复选框。会有一条状态栏显示选中了多少个，并提供 **Select all**(全选)、**Move**、**Copy** 和 **Delete**。文件很多的文件夹会分批加载，并有 **Load more**(加载更多) 按钮。

每个文件夹都可以写一段简短说明。点击说明文字，或者点 **Add description...** 提示，就能写。五个分类文件夹的说明是固定的。

### 在外部改动后重新扫描

Marinara 内部维护着一份素材清单，好让 Game Mode 快速找到素材。通过应用上传时，这份清单会自动更新。如果你绕开应用，直接在电脑上把文件复制进游戏素材文件夹，就点击 **Rescan** 重新读取这个文件夹。**Rescan** 在 **Asset Browser** 工具栏里，也在 **Settings** 下的 **Game Assets** 里。

### 在电脑上打开素材文件夹

只有在运行服务器的那台电脑上使用应用时，**Open in system folder** 才有效。在手机、平板或另一台电脑上，应用会提示只能从运行 Marinara 的那台设备打开系统文件夹。

## 限定某个游戏能用哪些素材

Game Mode 聊天可以只使用你的一部分素材文件夹，比如不让欢快的音乐出现在恐怖游戏里。

1. 创建时，在 **Features**(功能) 这一步展开 **Adjust Game Assets for this Game**(为本游戏调整素材范围)。已有的游戏则打开该游戏的 **Game Assets** 窗口。
2. 点击 **Game assets**，它会变成 **Selecting**。
3. 用每个文件夹上的小状态控件把它纳入或排除。

会有一条状态栏显示“All folders included”或排除了多少个文件夹。**Reset to all**(重置为全部) 会重新纳入全部文件夹。这项选择只保存在那一个聊天里。它改变的是 Game Mode 可以从哪些文件夹里挑选，不会删除或隐藏任何文件。

<a id="a-settings-own-art-and-music"></a>

### 设定自己的美术和音乐

用设定包开始的游戏有一个美术类别，修改设定包用词时显示在 **Art and music**(美术与音乐) 下：`fantasy`、`scifi`、`modern`、`wuxia`、`jazz_age`、`wasteland`，或者设定包自己的类别。游戏会使用以它的类别命名的文件夹，以及所有不以类别命名的文件夹，而不使用其他类别的文件夹。赛博朋克游戏绝不会播放奇幻战斗音乐，也不会显示魔法森林。如果它自己类别的文件夹和共享文件夹里都没有合适的，就什么也不播放，而不是换用其他类别的曲目。没有设定包的游戏使用所有文件夹。

- **音乐**：把设定的曲目放在 `music/<state>/<family>/<intensity>` 里，例如 `combat/wuxia/intense`。它们会优先于共享曲目播放。
- **背景**：`backgrounds/<family>`。在带设定包的游戏中生成的背景也会保存在这里。
- **战斗音效**：`sfx/combat/<family>` 里与某个自带音效同名的音效，例如 `sword-swing`，会在该类别的游戏中替换它。自带的战斗音效是奇幻风格的，所以在你添加其他类别自己的音效之前，那些类别的战斗是安静的。

自带的入门背景算作共享背景，但奇幻的那几张（`ancient_library`、`castle_cliff`、`enchanted_forest`）和现代的 `city_night` 除外。在美术类别出现之前保存的设定包仍然可用：由入门设定包制作的，使用该入门设定包的类别；其他的则使用所有文件夹，直到你在 **Art and music** 下选定类别。上文的选择栏会显示当前打开的游戏的类别。

<a id="generated-sound-effects-and-music"></a>

## 生成音效与音乐

Game Mode 可以通过 **Music & Sound Effects**(音乐与音效) 账号生成音效和音乐。可以选择 ElevenLabs、SunoAPI 或自定义兼容服务器。每段新音效或新曲目都会用到那个服务的账号。自带音频无需生成，始终可用。

**开始之前：** 你需要一个 **Music & Sound Effects** 账号。**Add account**(添加账号) 窗口里没有它的按钮。这类账号来自升级或导入（**Connections**(连接) 里的 **Import a backup**(导入备份)）。见[服务商设置和限制](../connections/providers-reference.md#music--sound-effects)。

1. 在 **Connections** 里，用 **Edit model**(编辑模型) 打开这个账号的模型。
2. 选择服务，填写密钥，再选择音乐和音效模型。SunoAPI 音乐还需要一个公开的 HTTPS 回调 URL。自定义服务器需要填写端点路径。
3. 开启 **Sound-effect generation**(音效生成)、**Music generation**(音乐生成)，或同时开启两项。
4. 保存账号。见[服务商设置和限制](../connections/providers-reference.md#music--sound-effects)。

然后在创建游戏时开启它：

1. 在设置向导的 **Features** 这一步，找到 **Game Audio**(游戏音频) 卡片。
2. 在账号选项下选择你的账号，或者保留 **Use the default Music & Sound Effects account**(使用默认的音乐与音效账号)。
3. 让 **Sound effects**(音效) 和 **Music**(音乐) 保持开启，或者关掉不想要的那一项。

每个开关都要求所选账号已开启对应的功能。仅支持语音的 Audio 账号不会用于生成。

游戏过程中：

- **Sound effects**：GM 回合结束后，Marinara 会向服务请求贴合场景的简短音效。
- **Music**：队伍每到一个地方、每遇到一种战斗（比如首领战），Marinara 都会创作一首约两分钟长的纯器乐曲目。每首曲目只生成一次，之后重复使用。新地点的曲目要等到之后的场景切换时才开始播放，所以音乐不会在场景中途突然切入。战斗曲目一准备好就会淡入。

生成的音效和曲目会和你的游戏素材保存在一起，所以同一段音效不会生成两次。如果 **Music DJ** 正在为这个游戏播放音乐，Game Mode 就不会生成音乐。

## Music DJ 的自定义音乐文件夹

**Music DJ** 是一个辅助智能体，可以在游戏过程中播放音乐。在 Custom 模式下，它会播放你选定的文件夹里的曲目。为某个聊天启用 **Music DJ** 时，它的设置里会显示 **Apply to**(应用到)。它可以为这个聊天、聊天里唯一的角色或所有聊天保存文件夹。**In use:**(当前使用) 显示聊天正在播放的文件夹。选择 **All chats (default)**(所有聊天，默认) 时，**Game Assets** 来源填写的是游戏素材内部的一个路径，比如 `music` 或 `music/combat`。要给某个聊天或角色单独设置文件夹，见[为聊天或角色使用不同的文件夹](../media/music.md#use-a-different-folder-for-a-chat-or-character)。

完整的 **Music DJ** 编辑器里有一个 **Custom Music Library**(自定义音乐库) 部分。**Use Game Assets music folder**(使用游戏素材音乐文件夹) 在两种模式之间切换：

- 打开：**Game Assets music folder**(游戏素材音乐文件夹) 字段读取游戏素材内部的某个文件夹。**Open Folder**(打开文件夹) 会在服务器所在的电脑上打开它。
- 关闭：**Default music folder on this device**(本设备上的默认音乐文件夹) 会播放运行服务器那台电脑上任意文件夹里的音乐。点击 **Select Folder**(选择文件夹)，或者直接粘贴路径。

选择应用之外的文件夹需要更高的权限。在服务器所在的那台电脑上操作，不用额外配置就能用。从别的设备或通过远程访问操作时，要先配置管理员访问权限。见[远程访问](../REMOTE_ACCESS.md)。音乐播放器的其他内容见 [Music DJ](../media/music.md)。

## 相关指南

- [Music DJ：Spotify、YouTube 与本地音乐](../media/music.md)
- [支持的 AI 服务商](../connections/providers-reference.md)
- [Game Mode：入门](getting-started.md)
- [远程访问：登录与 IP 允许列表](../REMOTE_ACCESS.md)
