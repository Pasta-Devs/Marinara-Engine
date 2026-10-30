# 角色立绘（表情和全身）

本指南介绍怎么给角色添加立绘（角色的站立画像），怎么用 AI 生成立绘，也包括清理背景和控制立绘在屏幕上的显示方式。立绘只在 Roleplay Mode(角色扮演) 和 Game Mode(游戏模式) 里生效。

## 什么是立绘

立绘就是角色的站立画像：一张角色的图片，Marinara Engine 会把它悬浮显示在聊天场景上方。Marinara 用到两类立绘：

- **Facial Expressions**(面部表情)：对应不同心情的半身像，比如开心、难过、生气。
- **Full-body**(全身)：对应不同姿势的全身图，比如待机、行走、战斗姿态。

立绘只在 **Roleplay Mode** 和 **Game Mode** 里显示，普通的 Conversation(对话模式) 聊天不显示立绘。不过在任何模式下都可以上传立绘，因为立绘跟着角色走，与哪个聊天用到它无关。

立绘是按角色添加的。用户角色（代表你自己的那个角色）也可以加立绘，用户角色编辑器里有同样的 **Sprites**(立绘) 选项卡，用法和下面讲的一致。

## Sprites 选项卡在哪里

立绘在角色编辑器（或用户角色编辑器）里管理。

1. 打开一个角色进入编辑。
2. 点编辑器里的 **Sprites** 选项卡。
3. 在选项卡顶部选一个分类：**Facial Expressions**、**Full-body** 或 **Clips**(片段)。

本指南只讲 **Facial Expressions** 和 **Full-body** 两个分类。**Clips** 是语音和视频通话用的另一项功能，说明见 [Conversation 音频和视频通话](../conversation/calls.md)。

## 上传自己的立绘

手头已有的画可以直接传上来，Marinara 支持常见的图片格式。效果最好的是透明背景的 PNG 文件，角色周围的空白区域会透出底下的场景。

### 上传单张立绘

1. 打开 **Sprites** 选项卡，选 **Facial Expressions** 或 **Full-body**。
2. 在 **Add Sprite**(添加立绘) 区域的输入框里填一个名字。表情的占位文字是“Expression name (e.g. happy, sad, angry)”，姿势的占位文字是“Pose name (e.g. idle, walk, battle_stance)”。
3. 点 **Upload**(上传)，选一个图片文件。

新立绘会带着刚才填的名字出现在下方的网格里。

### 快速添加常用表情

在 **Facial Expressions** 分类下，**Quick add**(快速添加) 一栏会列出还没用过的常用表情名，比如 happy 或 angry。点其中一个就会直接打开文件选择器，名字已经填好，省得自己再敲一遍。

### 一次上传整个文件夹

如果立绘都放在一个文件夹里，可以一步全部导入。

1. 把图片文件按表情名或姿势名命名。比如文件叫 `admiration.png`，就会生成一个叫 admiration 的表情。
2. 在 **Add Sprite** 区域点 **Upload Folder**(上传文件夹)。
3. 选中存放图片的那个文件夹。

每个文件名去掉后缀就是立绘名。导入过程中会显示一行进度：“Uploading X/Y sprites”。

想给同一个表情做多个版本，就让下划线前面的名字保持一致。比如 `happy_01.png` 和 `happy_blush.png` 都算 happy 的变体。

### 管理一张立绘

把鼠标移到网格里的立绘卡片上，就能看到它的操作按钮：

- **Frame**(取景)：裁剪图片，把角色摆到想要的位置。
- **Download**(下载)：把立绘文件保存到电脑上。
- **Replace**(替换)：用新图片换掉同名的立绘。
- **Delete**(删除)：删掉这张立绘。

删除时会弹出确认，提示文字是“Delete sprite for”加上立绘名。当前显示的立绘不止一张时，同一个窗口还会给出 **Delete All Expressions**(删除全部表情) 或 **Delete All Full-Body**(删除全部全身图)。

## 用 AI 生成立绘

配好图像连接之后，Marinara 可以直接帮你画立绘。连接就是 Marinara 和一家 AI 服务之间的接入信息。生成立绘需要图像连接，生成动态立绘还需要视频连接，配置方法见[连接 AI 服务商](../connections/connecting-to-a-provider.md)。

在 **Add Sprite** 区域点 **Generate Sprite**(生成立绘) 开始，这会打开 **Generate Sprites** 窗口。窗口顶部选择来源：**Expressions (Portrait)**(表情半身像) 或 **Full-body**。

窗口里要填的内容：

1. 从下拉菜单里选一个 **Image Generation Connection**(图像生成连接)。
2. 想让画风贴近某种样子，最多可以加四张 **Reference Images**(参考图)。也可以勾选复选框，直接把当前头像当参考。
3. 在 **Appearance Description**(外观描述) 里写清角色长什么样，这一项必填。
4. 需要的话开启 **Transparent sprite background**(透明立绘背景)。Marinara 会先向服务商请求 PNG 原生透明。对方返回不了 alpha 通道时，它会在饱和的绿色、洋红、青色里挑一种与 **Appearance Description** 中颜色重叠最少的底色，事后自动把这层底色去掉。
5. 用 **Expression Count**(表情数量)（全身图则是 **Pose Count**(姿势数量)）决定生成几张，再挑要生成哪些表情或姿势。
6. 点 **Generate**(生成) 按钮。

图片出来之后可以先审阅：每张都能单独开关、改名、裁剪，满意了再把选中的图片存进这个角色的立绘集。

在 **Full-body** 来源下，如果角色已经有半身表情，可以勾选 **Match existing expression sprites**(匹配已有表情立绘)，这样生成的全身姿势会和现有的每个表情名一一对应。

关于 AI 生成，有两点要注意：

- 生成可能要花好几分钟，哪怕应用里的提示文字让人觉得会快一些。AI 服务慢的时候等得更久，耐心等着就行，不要重来一遍。
- 在某些设备上，比如部分 Android 安装环境，AI 生成立绘和清理背景用不了。这种情况下按钮是灰的，Marinara 会在屏幕上说明原因。

### 动态半身立绘

**Expressions (Portrait)** 来源下有一个 **Generate animated portraits**(生成动态立绘) 复选框。开启后生成的不是静态图片，而是短小的动态片段，再把每个片段转成循环播放的 GIF 立绘。GIF 是一种能播放短动画的图片格式。动态立绘用的是视频连接，不是图像连接。

## 清理立绘背景

立绘最好看的状态是只留角色、背景透明。生成的静态立绘在服务商支持时会直接用原生透明。不支持时，Marinara 会去掉自适应的纯色抠像底，边缘做柔化处理，并把这种颜色从头发、布料等半透明像素里清理干净。早期的白底立绘同样继续支持。

### 手动清理单张立绘

点网格里立绘的图片，会打开清理编辑器。在这里可以擦掉背景、把误擦的区域涂回来，还能切换深色、浅色和棋盘格底来检查效果。修改可以撤销，也可以恢复成原图，弄好之后应用即可。

### 一次清理多张立绘

**Clean Backgrounds**(清理背景) 按钮会把网格里当前显示的每一张立绘都去背。

1. 拖动 **Cleanup strength**(清理强度) 滑块。它从 Soft 到 Aggressive，取值 0 到 100，初始为 35。数值越高背景去得越干净，但也更容易啃到角色本身。
2. 点 **Clean Backgrounds** 并确认。

批量清理之后 Marinara 会留一份安全副本，界面上会出现一行“Last cleanup has a restore point”和一个 **Undo Cleanup**(撤销清理) 按钮。点它就能把受影响的立绘全部恢复成原样。

背景清理支持 PNG、JPG、JPEG、WEBP 和 AVIF 图片，不支持 GIF 和 SVG 文件。

自动清理会先分析图片，再决定用哪种引擎。内置的快速抠像清理优先处理纯色底和早期的白底。如果边缘其实并不均匀，Marinara 可以改用可选的 AI 去背组件作为后备，前提是它已经装好。画面很杂，或者角色配色和背景几乎一模一样时，手动清理编辑器依然是最稳妥的选择。

## 导出立绘

角色的立绘可以打包成一个 zip 文件存到电脑上。zip 就是把许多文件装在一起的单个文件。

1. 打开 **Sprites** 选项卡。
2. 在 **Add Sprite** 区域点 **Export**(导出)。
3. 选 **Expressions only**(仅表情) 或 **Full-body only**(仅全身) 导出当前分类，或者选 **All sprites**(全部立绘) 导出所有内容。

下载下来的是一个以角色命名的文件夹，里面装着立绘图片文件。

## 立绘在聊天里怎么出现

传好立绘只完成了一半，它们在聊天中什么时候出现、以什么方式出现，还要另外设定。这部分在聊天设置里，不在角色编辑器里。

### Roleplay Mode

在 **Roleplay Mode** 里，立绘的显示由可选的 **Expression Engine**(表情引擎) 智能体负责。先从 **Agents → Agent Organizer(智能体管理器)** 下载它，再添加到聊天里。它会读取每条消息的情绪，挑一张对应的表情立绘。详见[可下载智能体参考](../agents/built-in-agents.md)。

Roleplay 聊天里要让立绘出现，下面几条必须同时成立：

- 这个聊天启用了 **Expression Engine** 智能体。
- 至少选定了一个角色或当前用户角色作为立绘的归属对象。
- 至少开启了一个立绘来源。

打开聊天设置，找到 **Expression Engine** 智能体卡片，立绘的显示方式就在这里控制：

- **Sprite Source**(立绘来源)：可选 **Expressions**、**Full-body** 或两者都要。默认两个都开，至少要留一个开着。
- **Expression Avatars**(表情头像)：不再悬浮显示立绘，而是把消息旁边的小头像换成对应的表情立绘。默认关闭，且只在 Roleplay Mode 里有效。

### Game Mode

在 **Game Mode** 里，正在说话或战斗的角色会自动显示全身立绘，不需要 Expression Engine 智能体，只要那个角色传过全身立绘就行。Game Mode 的整体配置见 [Game Mode：入门](../game/getting-started.md)。

### 移动和缩放立绘（Arrange 模式）

只要启用了立绘归属对象，**Expression Engine** 智能体卡片上就会出现 **Sprite Layout**(立绘布局) 一节。

- 点 **Arrange**(排布) 进入拖动模式，把每张立绘拖到想要的位置，弄好后点 **Done**(完成)。
- **Reset**(重置) 会清掉自定义位置，回到自动布局。
- **Default Side**(默认方位) 决定新立绘偏向 **Left**(左) 还是 **Right**(右)，默认是 Left。改动方位会让当前布局左右翻转。
- 四个滑块控制大小和透明度：**Expression Size**(表情大小) 和 **Full-body Size**(全身大小) 的范围是 5% 到 200%，**Expression Opacity**(表情不透明度) 和 **Full-body Opacity**(全身不透明度) 的范围是 15% 到 100%，四个都从 100% 起步。

## 视频通话片段

**Sprites** 选项卡里的 **Clips** 分类是另一项功能，它生成的是短小的循环视频，在 Conversation 模式的语音或视频通话中充当角色的摄像头画面。因为归属于通话功能，这部分单独成文，见 [Conversation 音频和视频通话](../conversation/calls.md)。

## 相关指南

- [创建和编辑角色](creating-and-editing-characters.md)
- [Roleplay 模式：入门](../roleplay/getting-started.md)
- [Game Mode：入门](../game/getting-started.md)
- [Conversation 音频和视频通话](../conversation/calls.md)
- [动态表情](../media/animated-expressions.md)
- [可下载智能体参考](../agents/built-in-agents.md)
