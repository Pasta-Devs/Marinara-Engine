# 聊天背景

本指南介绍 Marinara Engine 的背景库。里面放的是自己上传、再手动挑选的图片，显示在聊天内容后面。如果想让 **Background**(背景) 智能体每回合自动挑一张场景背景，见 [Roleplay 背景](../roleplay/backgrounds.md)。如果想在 Gallery(图库) 里用 AI 生成场景背景，见[场景背景与 Gallery](../media/scene-backgrounds.md)。

## 背景在哪里管理

背景全部集中在一个地方管理：打开 **Settings**(设置)，切到 **Appearance**(外观) 选项卡，找到 **Backgrounds**(背景) 区块。

**Backgrounds** 区块分三部分：

1. **Chat Background**(聊天背景) 选择器，用来给当前所在的聊天挑图。
2. **Background Blur**(背景模糊) 滑块。
3. 背景库，导入、整理、筛选、打标签、改名、下载和删除图片都在这里完成。

聊天背景只在 Roleplay(角色扮演) 和 Game Mode(游戏模式) 的聊天里显示。Conversation(对话模式) 用的是渐变色，在 **Conversation Theme**(Conversation 主题) 区块设置，详见[外观设置](appearance-settings.md)。

## 背景库

背景库里放着所有可选的图片，既有自己上传的，也有 Marinara 自带的美术素材。每张图上都有一个小标签，用来区分来源：

- **Library**(自有素材)：自己上传的图片，可以改名、打标签、删除。
- **Game asset**(内置素材)：Marinara 自带的图片，只读，不能改名、打标签或删除。

### 导入背景

1. 在背景库顶部找到 **Import Backgrounds**(导入背景) 区域。
2. 把一张或多张图片拖进去，也可以点击它再选文件。
3. 等待上传完成。上传过程中这块区域会显示 **Importing...**。
4. 新图片会带着 **Library** 标签出现在下方的网格里。

一次可以导入多个文件。每个文件都必须是图片，格式为 JPG、PNG、GIF、WebP 或 AVIF 之一，单个文件最大 20 MB。

Marinara 会检查文件的真实内容，不只看文件名。把一个非图片文件改名成 `.png` 结尾，上传照样会被拒绝。

### 给当前聊天挑一张背景

1. 打开 **Settings**，进入 **Appearance**，再到 **Backgrounds**。
2. 在网格里点击想用的缩略图。
3. 被选中的图片上会出现一个对勾，它随即成为当前打开的这个聊天的背景。
4. 想恢复默认，再点一次选中的缩略图，或者点击 **Chat Background** 旁边的 **Remove**(移除) 按钮。

### 在背景库里搜索

用背景库上方的 **Search backgrounds**(搜索背景) 输入框可以按名称、标签或来源筛选。计数那一行会显示有多少张图匹配，例如“3 of 20 backgrounds”。点击搜索框里的小 X 即可清空。

搜索框旁边的选择器用来排序，可选 **A-Z**、**Z-A**、**Newest** 或 **Oldest**。选 **All** 会清除标签筛选；展开 **Tags**(标签) 则可以选中一个或多个标签。选中多个标签时，只要命中其中任意一个，背景就会显示出来。

### 用文件夹整理背景

文件夹只改变背景库的组织方式，不会移动或隐藏底层的图片文件。

1. 点击 **New Folder**(新建文件夹)，Marinara 会创建一个名称唯一的文件夹。
2. 双击文件夹名称（触屏上连点两下）即可改名，也可以选中它再按 F2。
3. 在电脑上，把某一行背景拖进文件夹。在手机或平板上，长按那一行，然后拖动。
4. 把背景拖回未归类区域，就能把它移出文件夹。

文件夹和归属关系保存在服务器上，也包含在备份里。删除文件夹只会把里面的背景放回未归类列表，不会删掉图片。搜索和标签筛选会自动展开文件夹，露出里面匹配的项目。

**Background** 智能体依然能看到全部可用背景，包括放进文件夹的那些。文件夹只影响 Settings 里的组织方式。

### 给背景改名

只有带 **Library** 标签的图片才能改名。

1. 把鼠标移到图片所在行，点击铅笔图标（**Rename**(重命名)）。
2. 输入新名称，不需要输入文件后缀名。
3. 点击 **Save**(保存)。

### 给背景打标签

标签方便给上传的图片分组和搜索。只有带 **Library** 标签的图片才能打标签。

1. 点击图片所在行的标签图标（**Edit tags**(编辑标签)）。
2. 在 **Add tag...** 输入框里输入标签。输入时 Marinara 会提示之前用过的标签。
3. 按 Enter 或点击 **Add**(添加)。
4. 想删掉某个标签，直接点击它。标签编辑打开时，每个标签都显示为一个带 X 的按钮。

<a id="download-a-background"></a>

### 下载背景

任何背景都能下载，内置的也一样。把鼠标移到图片所在行，点击下载图标（**Download background**(下载背景)）。图片会按原文件名保存。在 iPhone 或 iPad 上会打开分享面板，从那里保存即可；如果分享面板没有打开，就在随后出现的提示里点按 **Save file**(保存文件)。

### 删除背景

只有带 **Library** 标签的图片才能删除。把鼠标移到图片所在行，点击垃圾桶图标，然后确认删除。如果这张图正是当前的聊天背景或默认 Roleplay 背景，Marinara 会自动切回内置的默认图。

## 设置默认 Roleplay 背景

默认 Roleplay 背景是每个新建 Roleplay 聊天在自行挑图之前使用的初始背景。设置一次，之后所有新建的 Roleplay 聊天都会用它。

1. 在 **Backgrounds** 区块的网格里找到想用的图片。
2. 点击该行的图钉图标（**Set as default for new Roleplay chats**(设为新建 Roleplay 聊天的默认背景)）。
3. 图钉按钮会保持高亮，缩略图上会出现 **Default**(默认) 标签。之后新建的 Roleplay 聊天就从这张图开始。

图片左上角的星形用来把它加入收藏，不会改变默认背景。

想改回来，点击当前默认图上的图钉即可。也可以点击网格顶部附近的 **Reset Roleplay default**(重置 Roleplay 默认背景) 按钮。只有当默认背景不是内置那张时，这个按钮才会出现。

## Background Blur(背景模糊)

**Background Blur** 会把聊天内容后面的背景图模糊化，让文字更容易读。它对 Roleplay 和 Game Mode 的背景都生效。

1. 在 **Backgrounds** 区块找到 **Background Blur** 滑块。
2. 在 0 到 24 之间拖动，数值越大越模糊。
3. 设为 0 则背景保持清晰。此时数值显示为 **Off**。

默认值是 0(**Off**)。

## 上传的图片和内置背景如何共存

背景库把自己上传的图片和内置的 **Game asset** 图片放在同一个网格里，挑选方式完全一样。区别在于 **Game asset** 图片是只读的，所以它们上面不会出现改名、打标签和删除的控件。

在 Gallery 里用 AI 生成的场景背景也会进入同一个背景库，方便以后重复使用。见[场景背景与 Gallery](../media/scene-backgrounds.md)。

## 背景选择保存在哪里

有三项设置共同决定一个聊天显示什么背景，它们的保存方式各不相同：

- 给某个聊天挑的 **Chat Background** 随该聊天一起保存在服务器上，在任何设备上打开这个聊天都跟着走。
- 背景文件夹和它们的归属关系保存在服务器上，会随背景库同步到其他设备。
- 默认 Roleplay 背景和 **Background Blur** 按设备保存，不会在不同浏览器或设备之间同步。完整的同步规则见[外观设置](appearance-settings.md)。

## 自动背景和 AI 生成的背景

本指南讲的是手动挑选的背景库。另外两个相关功能可以代劳：

- **Background** 智能体能在 Roleplay 聊天里自动从背景库挑选场景背景，一回合换一次。见 [Roleplay 背景](../roleplay/backgrounds.md)。
- Gallery 能根据当前场景用 AI 生成一张全新的场景背景。见[场景背景与 Gallery](../media/scene-backgrounds.md)。

## 相关指南

- [Roleplay 背景](../roleplay/backgrounds.md)：每回合自动挑选背景的 Background 智能体。
- [场景背景与 Gallery](../media/scene-backgrounds.md)：在 Gallery 里用 AI 生成的场景背景。
- [外观设置](appearance-settings.md)：完整的 Appearance 选项卡，包括哪些设置会同步、哪些只留在单台设备上。
