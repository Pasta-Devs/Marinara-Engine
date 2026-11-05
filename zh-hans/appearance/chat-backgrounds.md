# 聊天背景

背景库里放的是你自己上传、再手动挑选的图片，显示在聊天内容后面。想让 **Background**(背景) 智能体每回合替你挑一张背景，见 [Roleplay 背景](../roleplay/backgrounds.md)。想用 Gallery(图库) 生成 AI 背景，见[场景背景与 Gallery](../media/scene-backgrounds.md)。

聊天背景在所有聊天模式里都会显示。在 Conversation(对话模式) 聊天里，**Conversation Theme**(Conversation 主题) 的渐变会叠在图片上方，**Conversation background image opacity**(Conversation 背景图片不透明度) 决定图片显示得有多明显。见[外观设置](appearance-settings.md)。

## 更换聊天背景

开始之前：先打开想更换背景的聊天。你挑的背景会应用到这个聊天。

1. 打开 **Settings**(设置)，再打开 **Appearance**(外观)，然后点 **App**(应用) 按钮。
2. 在 **Backgrounds**(背景) 里点按 **Browse library**(浏览背景库)。
3. 点按一张图片。它会成为这个聊天的背景，窗口随即关闭。

想用自己的图片，先导入它（见[导入背景](#import-a-background)）。

## 背景在哪里

1. 打开 **Settings**。
2. 选择 **Appearance** 选项卡，再点 **App** 按钮。
3. 找到 **Backgrounds** 区块。

这里有 **Chat Background**(聊天背景) 选择器、**Background Blur**(背景模糊) 滑块，以及 **Conversation background image opacity** 和 **Chat List Backgrounds**(聊天列表背景) 两项控件（见[外观设置](appearance-settings.md)）。

选择器会显示当前背景的预览，还没选背景时显示 **Default background**(默认背景)。它下方有最多三张 **Recent**(最近使用) 背景，点一下就能选。点击 **Browse library** 会打开 **Background Library**(背景库) 窗口。

## 背景库

背景库里既有你上传的图片，也有 Marinara 自带的美术素材。每张图都带一个标签。

| 标签 | 含义 |
| --- | --- |
| **My upload**(我的上传) | 你上传的图片。可以改名、打标签和删除。 |
| **Game asset**(游戏素材) | 内置的美术素材。它是只读的：不能改名、打标签或删除。 |

**Filter by source**(按来源筛选) 按钮，也就是 **All sources**(所有来源)、**My uploads**(我的上传) 和 **Game assets**(游戏素材)，会显示各自包含多少张图片。

<a id="import-a-background"></a>

### 导入背景

1. 在 **Background Library** 窗口里，找到搜索框旁边的 **Import Backgrounds**(导入背景)。
2. 点按或点击它，然后选择图片文件。可以一次选多个。在电脑上也可以把文件拖放到它上面。
3. 等待完成。处理期间它会显示 **Importing…**。

新图片会带着 **My upload** 标签出现在网格里。

每个文件都必须是 JPG、PNG、GIF、WebP 或 AVIF 格式，最大 20 MB。Marinara 检查的是文件里的实际内容，而不是文件名。把非图片文件改名成 `.png`，照样会被拒绝。

### 给当前聊天挑一张背景

1. 打开 **Browse library**。
2. 点击一张缩略图。上面会出现一个对勾，这张图成为这个聊天的背景，窗口随即关闭。
3. 想恢复默认，就再点一次选中的缩略图，或者点击预览上的 X(**Clear selection**(清除选择))。

### 搜索和筛选

- **Search backgrounds**(搜索背景) 按名称、标签或来源筛选。计数那一行会显示有多少张匹配，例如“3 of 20 backgrounds”。点击输入框里的 X 即可清空。
- **Sort backgrounds**(背景排序) 提供 **Manual order**(手动排序)、**A-Z**、**Z-A**、**Newest** 和 **Oldest**。选 **Manual order** 时，可以拖动来调整顺序，也可以在获得焦点的图片上按 <kbd>Alt</kbd>+<kbd>Up</kbd> 或 <kbd>Alt</kbd>+<kbd>Down</kbd>。
- 文件夹小标签 **All folders**(所有文件夹)、**Favorites**(收藏) 和 **Unfiled**(未归类)，加上每个文件夹各自的小标签，用来按文件夹筛选。
- 在标签下，**All**(全部) 会清除标签筛选。展开 **Tags**(标签)，选一个或多个标签。图片只要带有任意一个选中的标签，就算匹配。

点击图片上的星形，就能把它加入收藏。这不会改变默认背景。

### 用文件夹整理背景

文件夹只改变背景库的组织方式，不会移动或隐藏图片文件。

1. 点击 **New Folder**(新建文件夹)，输入名称，再点击 **Add**(添加)。
2. 点按图片上的 **Move to folder**(移至文件夹) 按钮，选择文件夹。也可以把图片拖到某个文件夹小标签上。在手机或平板上，长按图片，然后拖动。
3. 想把图片移回来，就把它拖到 **Unfiled** 上。
4. 选中某个文件夹小标签，就会显示铅笔（**Rename folder**(重命名文件夹)）和垃圾桶（**Delete folder**(删除文件夹)）按钮。

删除文件夹会把里面的图片放回 **Unfiled**，不会删掉它们。文件夹保存在服务器上，也包含在备份里。**Background** 智能体依然能看到全部背景，包括放进文件夹的那些。

### 给背景改名

只有 **My upload** 图片才能改名。

1. 点击图片上的铅笔图标（**Rename background**(重命名背景)）。
2. 输入新名称，不需要输入文件后缀名。
3. 点击 **Save**(保存)。

### 给背景打标签

只有 **My upload** 图片才能打标签。

1. 点击图片上的标签图标（**Edit tags**(编辑标签)）。
2. 在 **Add tag…** 里输入标签。Marinara 会提示你之前用过的标签。
3. 按 <kbd>Enter</kbd> 或点击 **Add**。

想删掉某个标签，在编辑标签时点击它即可。

<a id="download-a-background"></a>

### 下载背景

点击任意图片上的下载图标（**Download background**(下载背景)），内置图片也一样。在 iPhone 或 iPad 上会打开分享面板。如果没有打开，就在随后出现的提示里点按 **Save file**(保存文件)。

### 删除背景

只有 **My upload** 图片才能删除。

1. 点击图片上的垃圾桶图标（**Delete background**(删除背景)）。
2. 确认。

如果这张图正是当前的聊天背景或默认 Roleplay 背景，Marinara 会切回内置的默认图。

## 设置默认 Roleplay 背景

默认 Roleplay 背景是每个新建 Roleplay 聊天一开始使用的图片。

1. 在 **Background Library** 窗口里找到这张图片。
2. 点击它的图钉图标（**Set as default for new Roleplay chats**(设为新建 Roleplay 聊天的默认背景)）。

缩略图上会显示 **Default**(默认) 标签。想撤销，就再点一次这张图上的图钉，或者点击网格上方的 **Reset Roleplay default**(重置 Roleplay 默认背景)。只有当你的默认背景不是内置那张时，这个按钮才会出现。

## Background Blur

**Background Blur** 会把聊天后面的背景模糊化，让文字更容易读。它对所有聊天模式的背景都生效。

1. 在 **Backgrounds** 区块找到 **Background Blur** 滑块。
2. 在 0 到 24 之间拖动，数值越大越模糊。

设为 0 时显示 **Off**，背景保持清晰。默认值是 0。

## 背景选择保存在哪里

| 设置 | 保存方式 |
| --- | --- |
| 某个聊天的 **Chat Background** | 随该聊天保存在服务器上，在任何设备上都跟着这个聊天走。 |
| 文件夹和归属关系 | 保存在服务器上，与背景库放在一起。 |
| 默认 Roleplay 背景和 **Background Blur** | 按设备保存，不会在不同浏览器或设备之间同步。 |

完整的同步规则见[外观设置](appearance-settings.md)。

## 相关指南

- [Roleplay 背景](../roleplay/backgrounds.md)：每回合挑选背景的 Background 智能体。
- [场景背景与 Gallery](../media/scene-backgrounds.md)：在 Gallery 里用 AI 生成的场景背景。它们也会进入这个背景库。
- [外观设置](appearance-settings.md)：完整的 Appearance 选项卡。
