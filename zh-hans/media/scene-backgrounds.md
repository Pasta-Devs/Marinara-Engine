# 场景背景与 Gallery 面板

本指南介绍 AI 生成的场景背景，也就是 Marinara Engine 在 **Gallery**(图库) 里为你生成的背景图，以及 Gallery 本身。另有两篇相关指南：[聊天背景](../appearance/chat-backgrounds.md) 讲的是手动挑选的上传图库，[Roleplay 背景](../roleplay/backgrounds.md) 讲的是每回合自动挑背景的那个智能体。

## 场景背景在哪些模式下可用

场景背景在 Roleplay(角色扮演) 和 Game(游戏) 模式下可用，Conversation(对话模式) 下没有这个功能。在 Conversation 模式里尝试生成时，应用会显示这条消息：

```
Scene background generation is available in Roleplay and Game modes.
```

生成背景需要一个 **Image Generation**(图像生成) 连接。还没配好的话先去配一个，见[图像生成服务商与设置](image-providers.md)。

## 在 Gallery 里生成并应用背景

**Gallery** 保存聊天的图像和视频，是 **Chat Settings** 里的一个区域。打开 Chat Settings，再展开 **Gallery** 即可。在电脑上还能把它弹出为独立窗口，见[聊天设置概览](../chats/chat-settings.md#popping-a-section-out-into-its-own-window)。**Background**(背景) 按钮用于生成当前场景的背景图。

在 Roleplay 里，只要安装了 **Illustrator** 智能体，**Background** 按钮就会显示。不需要把这个智能体添加到聊天里，也不需要启用智能体。和 **Illustrate**(生成插图) 一样，它只运行一次，不会因此开始自动运行。

生成背景的步骤：

1. 打开 **Chat Settings** 里的 **Gallery** 区域。
2. 点击 **Background** 按钮。
3. 出图期间按钮文字会变成 **Generating...**。
4. 此时应该能看到这条状态消息：“AI background generation is running. The new background will be applied when it finishes.”
5. 生成完成后，新图会立刻应用到当前场景，并弹出一条“Background generated.”消息确认。

背景是根据当前场景生成的。在游戏里，这包括题材、设定、地点、天气和时间。生成的背景使用 **Backgrounds** 画布尺寸，默认为 1280 × 720 像素。这个尺寸可以在 **Settings**(设置) → **Generations**(生成) → **Image Generation** 下修改。

### 如果没有设置图像连接

如果 Marinara 找不到可用的图像连接，生成这一步会失败，并给出这条消息：

```
Choose an image generation connection for the Illustrator agent, or mark one as the default image connection.
```

解决办法：打开 **Connections**(连接) 面板，展开 **Defaults**(默认)，在 **Images**(图像) 下选一个图像连接；或者给 **Illustrator** 智能体单独指定一个图像连接。

## Gallery 区域

**Gallery** 有 **Images** 和 **Videos**(视频) 两个选项卡，每个选项卡都会显示自己包含多少项。在 Roleplay 和 Game 聊天里，**Videos** 选项卡存放场景视频；在 Conversation 聊天里，它存放视频消息。

区域顶部的操作按钮只在对应功能适用于当前聊天时才显示：

- **Illustrate**(生成插图)：运行 Illustrator 智能体，单独出一张场景图。见 [Illustrator 智能体](illustrator-agent.md)。
- **Selfie**(自拍)：在 Conversation 模式下生成一张角色自拍。
- **Background**：生成场景背景并应用，也就是上面讲的流程。
- **Video**(视频)：用最近一张插图做一段场景视频。在 Conversation 模式下，它会改为让某个角色发送一条视频消息；见[视频消息](../conversation/selfies.md#video-messages)。
- **Create storyboard**(创建分镜)：在 Storyboard 启用时，为最近一个 Game Mode 回合或已完成的 Roleplay 剧集生成关键帧。
- **Browse Images**(浏览图像)：打开已保存图像的浏览器，从中插入图像。
- **View storyboard**(查看分镜)：打开最近一份 Game Mode 分镜。

按钮下方是 **Upload Images**(上传图像) 拖放区。把图像拖上去，就能把自己的图片加进这个聊天的 Gallery。

### 单张图像的操作

在 **Images** 选项卡里把指针移到任意一张图像上，手机端则点一下，就会显示它的操作项：

- 以完整尺寸打开图像（**Open gallery image**）。
- **Pin to chat**(固定到聊天)：把图像以浮动图片的形式固定在聊天里。拖动它可以移动位置，拖动它的角上手柄可以调整大小。在这个浏览器里重新加载页面时，它会保持原来的位置和大小。关闭按钮旁边的锁定按钮可以让它无法移动或调整大小，直到你解锁。
- **Download image**(下载图像)：把图像保存到设备。
- **Animate illustration**(让插图动起来)：把这张图变成一段场景视频。
- **Copy prompt**(复制提示词)：复制随图保存的提示词。图像没有保存提示词时，这里显示 **No prompt saved** 并且不可点击。
- **Delete gallery image**(删除图库图像)：确认后删除图像。

<a id="regenerating-an-image"></a>

### 重新生成图片

你可以重新生成一张图片，而不必重新生成它所属的回复。这适用于聊天 Gallery 里保存了提示词的图片，例如插图、自拍和分镜画面。

1. 从 Gallery 或图片所在的消息里，以原尺寸打开这张图片。
2. 点击 **Regenerate image**(重新生成图片)（图片右上角的圆形箭头按钮）。
3. 在图片下方的输入框里修改你想改的内容：**Prompt**(提示词)、**Negative prompt**(负面提示词)、图片带有角色提示词时 **Character prompts**(角色提示词) 下每个角色各一个输入框，以及 **Image connection**(图像连接)。
4. 点击 **Generate image**(生成图片)，或者点击 **Cancel**(取消) 保持图片不变。

新图片会替换消息里的旧图片。旧图片仍保留在 Gallery 里，所以你可以再次固定它。参考图会根据角色当前的头像重新发送。有些较早的图片没有保存负面提示词和角色提示词；遇到这种情况，编辑器会说明。

## 在提示词发出前先检查一遍

Marinara 把背景请求发给图像服务商之前，可以先检查并修改提示词。

1. 打开 **Settings** → **Generations** → **Overall Generations**(总体生成)。
2. 开启 **Expose media prompts before sending**(发送前显示媒体提示词)。

开启之后，每次请求发出前都会弹出 **Review Image Prompt**(检查图像提示词) 窗口，它的说明文字是：“Edit the prompt below before Marinara sends the image request to your provider.”

在这个窗口里可以：

- 修改提示词正文和负面提示词。
- 查看图像类型和尺寸，以及实时的字符计数。
- 点击 **Cancel**(取消) 中止，或点击 **Generate**(生成) 发送。

只要有一个提示词框是空的，**Generate** 就不可点击，并显示这条提示：“Every image request needs a prompt.”输入什么就原样发送什么。

## 管理保存下来的背景

每张生成的场景背景都会存进背景库，自己的图像也可以加进同一个库。上传的背景支持 JPG、PNG、GIF、WebP 和 AVIF 文件，单张最大 20 MB。

自己添加的背景可以打标签、改名和删除。标签一律小写，可以包含字母、数字、空格、连字符和下划线，每个最长 40 个字符。内置的游戏素材背景会和自己的背景显示在一起，但不能改名、打标签或删除。

这个库的管理，以及给单个聊天或全局设置默认背景，都在外观设置里完成。完整的图库、选择器和 **Background Blur**(背景模糊) 请看[聊天背景](../appearance/chat-backgrounds.md)。

## 相关指南

- [聊天背景](../appearance/chat-backgrounds.md)：手动挑选的上传图库。
- [Roleplay 背景](../roleplay/backgrounds.md)：每回合自动挑背景的智能体。
- [Illustrator 智能体](illustrator-agent.md)：Roleplay 模式和 Game Mode 的场景插图。
- [图像生成服务商与设置](image-providers.md)：配置图像连接。
- [场景视频生成](scene-video.md)：把 Gallery 里的图像变成视频。
