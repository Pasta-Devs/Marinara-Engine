# 角色与用户角色图库

角色编辑器和用户角色编辑器里的 **Images**(图像) 选项卡中的 **Gallery**(图库)保存挂在角色或用户角色上的图片和视频，所以即使删掉聊天，它们也会保留。设定参考图、换装差分和导入的图包都适合放在这里。你还可以用 AI 创建新图片，并把图库里的图片标记成自定义 Emoji 或贴纸。

## 找到图库

每个角色和用户角色都有自己的图库。在 Character Editor(角色编辑器) 里打开角色，或者在 Persona Editor(用户角色编辑器) 里打开用户角色。点击 **Images** 选项卡，再点击顶部的 **Gallery**。角色的图库标题是 **Character Gallery**(角色图库)，用户角色的是 **Persona Gallery**(用户角色图库)。两者的用法相同。

Gallery 下面有两个子选项卡：

- **Images**(图片) 存放你上传的图片。
- **Videos**(视频) 存放你上传的视频，外加与这个角色相关的场景视频和视频通话片段。

聊天自己的图库是另一回事，里面装的是那一个聊天专属的场景插图和生成的附件。临时的场景图放在那里，长期保留的图片放在这里。

### 添加图片

1. 打开 **Images → Gallery**，选中 **Images**。
2. 把图片文件拖到 **Upload Character Images**(上传角色图片) 上，或者点击它挑选文件。在用户角色里，这个区域叫 **Upload Persona Images**(上传用户角色图片)。
3. 等待上传完成。新图片会出现在网格里。

点击图片可以放大查看。每个图块都有一个下载控件和一个删除控件。

### 添加视频

1. 打开 **Images → Gallery**，选中 **Videos**。
2. 把视频文件拖到 **Upload Character Videos**(上传角色视频) 上，或者点击它挑选文件。在用户角色里，这个区域叫 **Upload Persona Videos**(上传用户角色视频)。
3. 等待上传完成。

支持的格式是 MP4、WebM 和 MOV。最新的视频排在最前面。哪些场景视频和片段会列在哪个角色名下，见[会列出哪些视频](#which-videos-are-listed)。

## 用 AI 创建图片

Gallery 里的 **Create with AI**(使用 AI 创建) 会通过图像生成连接，为这个角色或用户角色生成新图片。在 **Type**(类型) 中选择要生成的内容：

| 类型                            | 生成内容                                                                          |
| ------------------------------- | --------------------------------------------------------------------------------- |
| **Character sheet**(角色设定图) | 一张设定参考图，保存方式与 **Character Sheet**(角色设定图) 区域相同。             |
| **Background**(背景)            | 根据角色卡的场景设定生成一张地点的横向宽幅图片，保存到 Gallery 并标记为聊天背景。 |
| **Sticker sheet**(贴纸合集图)   | 一张包含多张贴纸的图片，切分后每张图片只保留一张贴纸。                            |
| **Emoji sheet**(Emoji 合集图)   | 与贴纸合集图相同，但内容是小尺寸的面部 Emoji。                                    |

开始之前：添加一个图像生成连接。

1. 打开 **Images → Gallery**，点击 **Create with AI**。
2. 选择 **Type**，如果想换个外观或地点，可以修改提示词。
3. 生成贴纸或 Emoji 合集图时，在 **Stickers to draw**(要绘制的贴纸) 或 **Emoji to draw**(要绘制的 Emoji) 中列出名称，用逗号分隔。一张合集图最多容纳 16 个。
4. 点击 **Generate**(生成)。
5. 点击 **Save as Background**(保存为背景)、**Save Stickers**(保存贴纸) 或 **Save Emoji**(保存 Emoji)，或者 **Save as Character Sheet**(保存为角色设定图)。

### 调整合集图的切分结果

贴纸表或表情表生成后，应用会按轮廓识别每个贴纸，去除绿色背景，再把它们分别显示为带名称的图块。如果模型能生成透明背景图片（见[透明背景](../media/image-providers.md#transparent-backgrounds)），则会要求它生成透明背景的表，绿色背景只作备用；返回的表如果已经透明，就保留原本的边缘。保存的贴纸最大为 512 × 512 像素，Emoji 最大为 256 × 256 像素，每张都会用自己的名称作标签。

- 点击图块可以保留或跳过它。跳过的图块不会保存。
- 修改图块下方的名称即可重命名。
- 点击图块上的 **Recut with a box**(用选框重新裁剪)，在整张合集图上放置选框。拖动选框、拉动四角，或者围绕贴纸画一个新选框，然后点击 **Use this box**(使用此选框)。
- 点击 **Add a sticker**(添加贴纸) 或 **Add an emoji**(添加 Emoji)，裁出漏掉的那一张。
- 点击 **Cut again**(重新切分)，重新开始切分并撤销手动选框。

### 自己编写完整提示词

发给图像模型的提示词由弹窗中的字段组合而成。要修改整段提示词，比如让模型画角色喜欢的东西作为贴纸，而不只是画角色本身，点击 **Edit full prompt**(编辑完整提示词)。提示词会按你写的原样发送。只有点击 **Rebuild**(重新构建)，其他字段的改动才会加入提示词，同时也会覆盖手动编辑的内容。点击 **Rebuild** 旁边的关闭按钮，就能回到按字段组合的提示词。

## 把图库图片标记为自定义 Emoji 或贴纸

自定义 Emoji 是一张随文字内嵌的小图，写法是 `:name:`。贴纸是一张单独成块的大图，写法是 `sticker:name:`。两者都只在 Conversation Mode(对话模式) 聊天里有效，也就是即时通讯风格的那个模式。

1. 打开 **Images → Gallery**，选中 **Images**。
2. 点击图片左上角的小标记按钮（提示文字是 **Tag as emoji or sticker**）。
3. 点击 **Make emoji** 或 **Make sticker**。
4. 在 **Custom Emoji** 或 **Custom Sticker** 窗口里输入名称，然后确认。

名称由 1 到 32 个小写字母、数字和下划线组成。其他字符会自动转换，比如“Big Grin”会变成 `big_grin`。

如果没有成功：Emoji 图片不能超过 256 × 256 像素，贴纸不能超过 512 × 512 像素。图片太大时会出现错误提示，什么都不会被标记。

### 管理已标记的图片

图片标记之后，它的浮层按钮会显示名称。点击这个按钮可以看到更多选项：

- **Rename**(重命名) 修改名称。
- **Switch to sticker** 或 **Switch to emoji** 切换类型。切换时会检查新类型的尺寸上限，所以大于 256 × 256 像素的贴纸无法变成 Emoji。这时会出现错误提示，类型保持不变。
- **Remove emoji** 或 **Remove sticker** 取消标记。图片本身仍然留在 Gallery 里。

在图库里标记的 Emoji 或贴纸只属于那一个角色或用户角色，也只在包含它们的 Conversation Mode 聊天里有效。它和消息输入框里的全局 Emoji、贴纸库是两回事。如果图库里的名称和全局名称相同，那个聊天中以图库版本为准。名称不做唯一性检查，所以给每张图起一个不重样的名称。

## 描述图片

图库中的任何图片都可以添加一段简短描述，说明图片展示的内容。Conversation 聊天会根据已标记的表情和贴纸的描述来挑选候选项（参见[描述表情和贴纸](../conversation/emoji-stickers-gifs.md#describe-emojis-and-stickers)）。描述随图片一起保存，也会包含在 **Marinara Native** 导出中。

- 要自己写描述，点击图片左上角的标记按钮，选择 **Add description**(添加描述)；要修改已有描述，则选择 **Edit description**(编辑描述)。
- 要让 AI 写描述，点击 **Select images**(选择图像)，选好图片，再点击 **Describe with AI**(用 AI 描述)。**Image reading**(读图) 模型会查看每张图片，写出简短描述。如果有些图片已经有描述，可以选择只描述没有描述的图片，或重新描述所有图片。

开始之前：AI 描述需要能识别图片的模型。如果在 **Connections**(连接) 的 **Jobs**(分工) 页面上设置了 **Image reading** 模型，Marinara 就会使用它，否则会使用智能体的模型。每次最多发送 8 张图片，所以选的图片较多时需要稍等一会儿。

聊天自己的图库在选择模式下也有同样的 **Describe with AI** 功能。

<a id="reuse-a-gallery-image-in-messages-and-greetings"></a>

## 在消息和开场白中复用图库图片

角色 Gallery 里的任何图片都可以显示在聊天文本里：开场白、示例消息，或者角色发送的消息。把鼠标悬停在图库图片上，点击 **Copy image reference**(复制图片引用)（链接图标）。它会复制一小段 Markdown，粘贴到角色说话的任何地方即可：

```text
![sunset selfie](card://self/gallery/k3m2xq7.png)
```

`self` 表示正在说这条消息的角色。显示消息时，Marinara 会把 `self` 换成那个角色，并从其图库中载入图片。

适用的地方：

- 角色卡上的 **First Message**(首条消息)、**Alternate Greetings**(备选开场白) 和 **Example Dialogue**(对话示例)。编辑时，字段的 Markdown 预览会显示这张图片。
- 角色发送的任何消息，Roleplay(角色扮演) 和 Conversation 模式都一样。
- 群聊。在包含多个说话者的回复中，`self` 会针对每位说话者分别解析。如果说话者的图库里没有该文件，Marinara 会按聊天中的顺序检查其他角色。如果两个角色有相同的文件名，说话者自己的图片优先。

不适用的地方：

- **你自己的消息**。这类消息没有正在说话的角色，所以 `self` 引用会显示成一张损坏的图片。要自己发出某个角色的图片，请使用聊天资源浏览器的插入功能，它会写入完整的 `card://characters/<id>/...` 形式。
- **系统消息**。它们不显示 Markdown 图片，所以引用会显示为文字。
- **用户角色图库**。你的消息没有说话者，所以请改用用户角色的写法 `card://personas/<id>/gallery/<file>`。

完整链接包含角色的内部 id，而导入角色时会重新生成 id，所以你把角色分享给任何人，完整链接都会失效。`self` 形式不包含 id。它能经受 **Marinara Native** 导出和导入，因为图库图片会保留文件名，随导出一起传递。**Compatible PNG Card** 和 **Compatible JSON** 导出不包含图库，所以这样分享之后，任何图库引用都无法生效。角色用到图库图片时，请使用 **Marinara Native**。

<a id="save-web-images-from-greetings"></a>

### 保存开场白中的网络图片

很多角色卡会在开场白里显示其他网站上的图片，而这些链接可能失效。当 **First Message** 或 **Alternate Greetings** 显示了网络图片时，**Dialogue & Greetings**(对白与开场白) 里会有一个 **Save images locally**(保存图片到本地) 按钮。

1. 打开 **Card**(卡片) 选项卡，找到 **Dialogue & Greetings**。
2. 点击 **Save images locally**。Marinara 会把图片下载到 Gallery，并把每个链接换成 `card://self/gallery/...` 引用。
3. 点击 **Save**(保存)，保留新的链接。

不点这个按钮，就什么都不会下载。只有不超过 10 MB 和 4000 万像素的 PNG、JPEG、GIF 和 WebP 图片才会被保存。指向你自己电脑或家庭网络的链接会被拒绝。无法保存的图片会保留原来的网络链接，并有一条通知说明原因。

**Restore web links**(恢复网络链接) 会把开场白里的链接换回原来的链接。已保存的副本会一直留在 Gallery 里，直到你删除它们。世界书里的图片不在此范围内。

<a id="which-videos-are-listed"></a>

## 会列出哪些视频

**Videos** 子选项卡会列出与这个角色聊天时生成的场景视频，以及视频通话片段。一段视频列在哪个角色名下，取决于它的来源：

- Conversation 的视频消息会列在它拍到的角色名下：发送它的角色，以及文字里点名的任何人。只写名字而不写姓也可以，前提是聊天里没有别人同名，并且名字以大写字母开头。如果文字要求拍合照或自拍合影，聊天里的每个人都算在内。引号里的名字不算。
- 你的用户角色图库只在片段点名你的用户角色时才会列出它。
- 较早的视频，以及来自 Roleplay 和 Game Mode(游戏模式) 聊天的视频，会列在所在聊天的每个角色和用户角色名下。

## 相关指南

- [创建和编辑角色](creating-and-editing-characters.md)
- [用户角色](personas.md)
- [自定义表情、贴纸和 GIF](../conversation/emoji-stickers-gifs.md)
- [场景背景与 Gallery 面板](../media/scene-backgrounds.md)
