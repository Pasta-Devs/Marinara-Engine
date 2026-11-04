# 角色立绘（表情和全身）

立绘是角色在某种心情下的一张图片，比如开心或难过。Marinara 会把它悬浮显示在聊天场景上方。你可以上传自己的立绘、用 AI 生成立绘、清理它们的背景，并控制它们的显示方式。

开始之前：每个文件都按心情命名，比如 `happy.png`，这样 Marinara 才能挑中它。在 Roleplay(角色扮演) 聊天里，立绘还需要开启 **Expression Engine**(表情引擎) 智能体（负责挑选立绘的帮手）。参见[立绘在聊天里怎么出现](#how-sprites-show-up-in-your-chat)。

立绘分两类：

- **Facial Expressions**(面部表情) 是对应不同心情的半身像，比如开心、难过或生气。
- **Full-body**(全身) 是对应不同姿势的全身图，比如待机、行走或战斗姿态。

立绘只在 Roleplay Mode 和 Game Mode(游戏模式) 里显示在屏幕上，Conversation(对话模式) 聊天里不显示。不过在任何模式下都可以上传立绘，因为角色的立绘在每个聊天里都跟着它。用户角色也有同样的 **Sprites**(立绘) 选项卡。

## 找到 Sprites 选项卡

1. 在编辑器里打开一个角色（或用户角色）。
2. 点击 **Sprites** 选项卡。
3. 在顶部选一个分类：**Facial Expressions**、**Full-body** 或 **Clips**(片段)。

下面几节讲 **Facial Expressions** 和 **Full-body**。**Clips** 属于通话功能，参见 [Conversation 音频和视频通话](../conversation/calls.md)。

## 上传自己的立绘

可以上传 PNG、JPEG、GIF、WebP、AVIF 和 SVG 图片。透明背景的 PNG 文件效果最好，因为角色周围的空白区域会保持透明。无效的替换图片会被拒绝，已保存的立绘保持不变。

### 上传一张或多张立绘

1. 打开 **Sprites** 选项卡，选择 **Facial Expressions** 或 **Full-body**。
2. 点击 **Add sprites**(添加立绘)。
3. 点击 **Upload images**(上传图片)，选择文件。可以一次选多个。
4. 每个文件名会成为立绘的名称（也就是它的标签）。之后想改名，打开那张立绘即可。

新立绘会出现在网格里，不属于任何文件夹。在用户角色编辑器里，用 **Add Sprite**(添加立绘) 的名称输入框和 **Upload**(上传) 按钮上传单张立绘。

### 上传整个文件夹

1. 把图片文件按表情或姿势命名，比如一个叫 admiration 的表情就用 `admiration.png`。
2. 打开 **Add sprites**，点击 **Import folder**(导入文件夹)。在用户角色编辑器里，点击 **Add Sprite** 里的 **Upload Folder**(上传文件夹)。
3. 选择存放图片的那个文件夹。

每个文件名去掉后缀就是立绘名。进度行显示“Uploading X/Y sprites”。子文件夹会变成可选的立绘文件夹。导出时生成的 `catalog.json` 还能恢复文件夹和改过的标签。文件夹里有坏条目时会单独报告，能用的图片照样导入。

如果没有成功：导入失败或只成功一部分时，会报告失败，而不是显示成功导入了 0 张图片。检查一下上面列出的文件类型。

### 名称变体

| 文件名 | 含义 |
| --- | --- |
| `happy_01.png`、`happy_blush.png` | 两张 happy 图片。两个名字都以 `happy_` 开头。 |
| `happy_pajamas.png` | 开心，穿着睡衣。心情放在前面，服装放在后面。 |
| `angry_formalwear_soaked_01.png` | 生气，穿正装，浑身湿透。末尾的数字只表示同一张图的另一个版本。 |

Expression Engine 既能看到表情（`happy`），也能看到完整名称（`happy_pajamas`）。没有哪张立绘匹配全部词语时，先去掉最后一个词，所以缺少 `happy_pajamas_wounded` 时会退回到 `happy_pajamas`，再退回到任意一张 happy 立绘。

<a id="how-sprites-show-up-in-your-chat"></a>

## 立绘在聊天里怎么出现

立绘什么时候出现、以什么方式出现，要在聊天设置里设定，不在角色编辑器里。

### Roleplay Mode

在 Roleplay 里，立绘由 Expression Engine 智能体负责。智能体是和回复一起运行的帮手，参见[智能体：聊天里的 AI 帮手](../agents/agents-overview.md)。它会读取每条消息的情绪，挑一张对应的表情立绘。把它添加到聊天里；如果还没有，就先从 **Agent Organizer**(智能体管理器) 安装它。参见[可下载智能体参考](../agents/built-in-agents.md#expression-engine)。

要让立绘出现，下面几条必须同时成立：

- 这个聊天开启了 Expression Engine 智能体。
- 至少选定了一个角色或用户角色作为立绘的归属对象。
- 至少开启了一个立绘来源。

打开 **Chat Settings → Agents**(聊天设置 → 智能体)，找到 **Expression Engine** 卡片：

- **Sprite Source**(立绘来源) 可选 **Expressions**、**Full-body** 或两者都要。默认两个都开，至少要留一个开着。
- **Expression Avatars**(表情头像) 会把消息旁边的小头像换成对应的表情立绘。默认关闭，且只在 Roleplay 里有效。
- **Only show active sprites**(只显示活跃立绘) 只显示最新一个已完成结果里出现的角色，并在生成下一个结果期间保持当前立绘可见。

### Game Mode

在 Game Mode 里，正在说话或战斗的角色会自动显示全身立绘。不需要 Expression Engine，只要那个角色有全身立绘就行。参见 [Game Mode：入门](../game/getting-started.md)。

### 移动和缩放立绘

只要开启了立绘归属对象，**Expression Engine** 卡片上就会出现 **Sprite Layout**(立绘布局)。

1. 点击 **Arrange**(排布)，然后把每张立绘拖到想要的位置。
2. 点击 **Done**(完成)。

**Reset**(重置) 会清掉你设置的位置，回到自动布局。**Default Side**(默认方位) 可选 **Left**(左) 或 **Right**(右)，初始是 Left。改动它会让当前布局左右翻转。**Apply to**(应用于) 可以把布局设置给所有角色，或者只给某一个角色。

四个滑块控制大小和透明程度。**Expression Size**(表情大小) 和 **Full-body Size**(全身大小) 的范围是 5% 到 200%。**Expression Opacity**(表情不透明度) 和 **Full-body Opacity**(全身不透明度) 的范围是 0% 到 100%。大小和不透明度都从 100% 起步。

## 用 AI 生成立绘

开始之前：添加一个图像生成连接。要生成动态立绘，还需要一个视频连接。参见[连接 AI 服务商](../connections/connecting-to-a-provider.md)。

1. 打开 **Add sprites**，点击 **Generate Sprite**(生成立绘)。在用户角色编辑器里，这个按钮在 **Add Sprite** 里。**Generate Sprites** 窗口会打开。
2. 在顶部选择来源：**Expressions (Portrait)**(表情半身像) 或 **Full-body**。
3. 选择一个 **Image Generation Connection**(图像生成连接)。
4. 可以添加最多四张 **Reference Images**(参考图)，或者勾选复选框，把当前头像当作参考。
5. 填写 **Appearance Description**(外观描述)。这一项必填。
6. 可以开启 **Transparent sprite background**(透明立绘背景)。Marinara 会让背景透明。如果服务做不到，Marinara 会画一层和 **Appearance Description** 里的颜色都不同的纯绿色、洋红或青色背景，然后再把它去掉。
7. 设置 **Expression Count**(表情数量)（全身图则是 **Pose Count**(姿势数量)），并挑选要生成哪些表情或姿势。
8. 点击 **Generate**(生成)。

图片返回后，可以逐张开启或关闭、改名和裁剪。然后把选中的图片存进这个角色的立绘。如果这个分类里恰好只有一张已保存的立绘使用生成出来的标签，保存时会替换它的图片，并保留它的文件夹和句柄。已经改名、不再用这个标签的立绘会被保留。不同文件夹里有重复标签时，要手动替换你想替换的那张立绘。

在 **Full-body** 来源下，如果角色已经有半身表情，勾选 **Match existing expression sprites**(匹配已有表情立绘)，就会生成与每个表情名对应的全身姿势。

生成可能要几分钟，服务慢的时候更久。耐心等着，不要重来。在某些设备上，比如部分 Android 安装环境，AI 生成立绘和背景清理不可用。这时按钮不可用，Marinara 会显示原因。

### 动态半身立绘

在 **Expressions (Portrait)** 来源下，**Generate animated portraits**(生成动态立绘) 会生成短小的动态片段，并把每个片段转成循环播放的 GIF 立绘。GIF 是一种能播放短动画的图片文件。它用的是视频连接，不是图像连接。参见[动态表情](../media/animated-expressions.md)。

## 清理立绘背景

立绘只显示角色时效果最好。服务支持时，生成的立绘会使用原生透明。否则 Marinara 会去掉一层自适应的纯色背景，边缘做柔化处理，并把这种颜色从头发、布料和其他半透明像素里清理掉。早期的白底立绘仍然可用。

### 手动清理单张立绘

打开角色立绘的预览，使用其中的魔杖清理操作，或者点击用户角色立绘的图片。在清理编辑器里可以擦掉背景、把区域涂回来，还能在深色、浅色和棋盘格底上检查效果。可以撤销、重置为原图，弄好之后应用即可。

### 一次清理多张立绘

1. 在角色编辑器里，点击 **Select**(选择) 并选好立绘。在用户角色编辑器里，清理按钮作用于选中的立绘；什么都没选时，作用于当前显示的分类。
2. 点击 **Clean Backgrounds**(清理背景)。
3. 设置 **Cleanup strength**(清理强度) 滑块，从 **Soft**(柔和) 到 **Aggressive**(激进)，取值 0 到 100，初始为 35。数值越高，去掉的背景越多，但也可能啃到角色本身。
4. 确认。

Marinara 会保留一份安全副本。界面上会出现一行“Last cleanup has a restore point”和 **Undo Cleanup**(撤销清理)。点击它就能把所有受影响的立绘恢复原样。

清理支持 PNG、JPG、JPEG、WEBP 和 AVIF，不支持 GIF 和 SVG。

自动清理会先查看图片。内置的快速清理处理纯色背景和早期的白底。如果边缘并不均匀，Marinara 可以改用可选的 AI 背景去除工具作为后备，前提是已经安装。画面很杂，或者主体的颜色和背景很接近时，手动编辑器是最稳妥的选择。

## 管理立绘

打开一张角色立绘，就能预览它并看到它的操作。用户角色立绘的操作在缩略图上。

- **Frame**(取景) 裁剪图片，把角色摆到想要的位置。
- **Download**(下载) 保存立绘文件。
- **Replace**(替换) 用新图片覆盖同名的立绘。
- **Rename**(重命名，在角色预览中) 修改标签，最多 160 个字符，文件句柄和 URL 保持不变，所以已有的图片引用照常可用。
- **Folder**(文件夹，在角色预览中) 或 **Move sprite**(移动立绘，在用户角色缩略图上) 不用拖动就能选一个文件夹，或选 **No folder**(不放入文件夹)。
- **Delete**(删除) 在你确认后删掉这张立绘。在用户角色编辑器里，带分类名的 **Delete All**(全部删除) 会删掉整个分类，即使当前正在搜索也一样。

### 文件夹与多选

点击 **New folder**(新建文件夹) 会创建一个折叠着的文件夹，名字是 **unnamed**。双击或双点它的名字可以改名，用箭头展开它。表情立绘和全身立绘的文件夹是分开的。文件夹显示在未归档立绘的上方，可以拖动调整顺序。

把立绘拖进文件夹，或者把文件夹里的立绘拖到未归档区域，把它移出文件夹。在手机上，长按缩略图开始拖动；正常滑动仍然是滚动页面。文件夹只用来整理：它们不会选定一组生效的立绘，也不会对聊天或智能体隐藏图片。删除文件夹后，里面的立绘会留下来，变成未归档。

点击 **Select** 会显示复选框和 **Select all sprites**(选择全部立绘)，然后可以把选中的立绘一起拖动，或者使用清理和删除。**Cancel**(取消) 退出选择模式。搜索会筛选显示的立绘。搜索没有结果并不代表立绘库是空的。

### Character Sheet

角色编辑器里的 **Character Sheet** 一行用 **Manage**(管理) 打开。在那里创建或上传一张设定图。打开 **Use as reference image**(用作参考图)，还原角色长相时就会优先使用它。

## 导出立绘

1. 打开 **Sprites** 选项卡。
2. 在角色网格上方，或在用户角色的 **Add Sprite** 框里，点击 **Export**(导出)。
3. 选 **Expressions only**(仅表情) 或 **Full-body only**(仅全身) 导出当前分类，或者选 **All sprites**(全部立绘) 导出所有内容。

你会得到一个 zip，里面有立绘文件，以及记录标签和文件夹的 `catalog.json`。角色和用户角色的原生格式导出以及档案备份也会保留这些数据。

## 相关指南

- [创建和编辑角色](creating-and-editing-characters.md)
- [用户角色](personas.md)
- [Roleplay 模式：入门](../roleplay/getting-started.md)
- [Game Mode：入门](../game/getting-started.md)
- [Conversation 音频和视频通话](../conversation/calls.md)
- [动态表情](../media/animated-expressions.md)
- [可下载智能体参考](../agents/built-in-agents.md)

## 开发者参考：立绘 API 与链接

`GET /api/sprites/:ownerId` 返回所有立绘，不管是否归入文件夹。`GET /api/sprites/:ownerId/catalog` 会额外返回文件夹和归属信息，供逐个文件夹导入的工具使用。每张立绘都有一个稳定的 `expression` 句柄、可编辑的 `label`、`folderId` 和 URL。判断归属请用文件夹 ID。`folders` 数组是保存时的顺序，编辑器会倒序显示，让新文件夹排在最前。文件夹顺序不决定智能体的优先级或可用性。

聊天里的资源浏览器显示改过的标签，但插入的是具体的 `card://sprites/<ownerId>/<filename>` 链接，改名之后依然有效。像 `card://sprites/facial/joy.png` 这样的聊天范围链接也能解析改过的标签。已有的同名文件优先。

可选的元数据缺失或无法读取时，能用的图片不会被隐藏。编辑操作遇到损坏的元数据会拒绝，而不是替换它。只读列表会跳过无法访问的立绘库，导出和写入路径会拒绝链接过来的所有者目录。
