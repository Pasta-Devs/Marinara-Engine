# 自拍

自拍是角色为自己生成的一张图片，并在 Conversation(对话模式) 聊天中发出，就像在聊天软件里分享照片一样。本指南介绍如何开启自拍、选择它的外观、手动请求一张，以及视频消息。

自拍来自可选的 **Illustrator** 包，并使用图像生成。每张自拍都是一次发送给你所选服务的图像请求，因此在你完成设置之前，自拍功能一直关闭。它们不同于 Roleplay(角色扮演) 和 Game Mode(游戏模式) 中的场景图片。

## 开启自拍

**开始之前：** 从 **Agents → Agent Organizer**(智能体管理器) 安装 **Illustrator**，并添加一个图像账号，即用于生成图片的服务的账号（参见[图像生成服务商与设置](../media/image-providers.md)）。

1. 打开一个 Conversation 聊天，然后打开 **Chat Settings**(聊天设置)。
2. 找到 **Agents**(智能体) 部分，然后打开 **Illustrator Settings**(Illustrator 设置)。
3. 开启 **Generated Selfies**(生成自拍)。自拍设置会出现在它下方。
4. 在 **Selfie model**(自拍模型) 中选择你的图像账号。

开启 **Generated Selfies** 也会打开本聊天的总开关 **Commands**(命令)。

只有设置了 **Selfie model** 之后，角色才会发送自拍。在此之前，聊天中会显示 “Choose a Selfie Provider to let characters generate selfie images.”

如果没有成功：只有安装了 Illustrator，**Illustrator Settings** 才会显示。自拍还需要开启 **Selfies**(自拍) 命令（参见[选择角色可以使用的命令](getting-started.md#choose-which-commands-a-character-can-use)）。

## 自拍设置

以下设置都位于 **Illustrator Settings** 中，且只对当前聊天生效。

- **Selfie model**：负责绘制图片的图像账号。默认值为 **None (selfies disabled)**。
- **Prompt Model**：撰写图片描述的文本模型。默认值为 **Agent default**。
- **Image Style**：一组保存好的画风词，例如 “anime”。默认值为高级设置中风格方案的默认风格。参见[图像风格方案](../media/style-profiles.md)。
- **Images Per Generation**：每次生成时，为每张插图或自拍制作多少个变体。
- **Resolution**：图片尺寸。只有设置了 **Selfie model** 之后才会显示。默认值为 896x1152。
- **Send Avatar References**：把角色的头像或立绘作为参考图发送。默认关闭。只有图像服务接受参考图时才有效。
- **Attach Card Appearance**：把每个被点名角色卡片上的 **Appearance**(外观) 文字加入提示词。默认关闭。

**Resolution** 可选：512x512、512x768、768x768、768x1024、896x1152 和 1024x1024。896x1152 是一种高的竖构图，适合大多数自拍。

**Send Avatar References** 和 **Attach Card Appearance** 都提供 **Off**(关闭)、**Images only**(仅图片)、**Videos only**(仅视频) 和 **Images and videos**(图片和视频) 选项。

如果角色卡或用户角色开启了 **Image Appearance Override**(图像外观覆盖)（位于编辑器的 **Appearance** 下方），Marinara 会发送这段文字，而不是 **Appearance**。当 **Appearance** 是为故事而写、而非为图片而写时，就使用它。

## 手动请求自拍

1. 打开 **Chat Settings**，并展开 **Gallery**(图库) 部分。
2. 点击 **Selfie**(自拍)。如果有多个角色，请在按钮旁边的列表中选择由谁拍摄。
3. 如果开启了 **Expose media prompts before sending**（**Settings → Generations → Overall Generations**），请检查或编辑提示词，然后点击 **Generate**(生成)。取消则不会发送请求。
4. 等待，直到按钮显示 **Generating...**。

你会看到 “Selfie generated.”，图片随即出现在聊天中。手动请求使用 **Selfie model**，并消耗一次图像请求。

## 角色如何发送自拍

角色会自行决定何时发送自拍。你无需输入任何内容。Marinara 生成图片并发布，之后的回复会看到一段简短的备注，说明图片展示了什么。

如果没有成功：如果消息中直接显示 `[selfie...]` 文字，请检查聊天是否处于 Conversation 模式，**Commands** 和 **Selfies** 是否已开启，**Generated Selfies** 是否已开启，以及 **Selfie model** 是否已设置。如果生成已开始但失败，请阅读有关图像账号的错误信息。

## 重新生成自拍

1. 点击聊天中的自拍，将其打开。
2. 点击 **Regenerate image**(重新生成图片)（固定按钮旁边的圆形箭头）。
3. 如需要，可编辑提示词，包括 **Character prompts**(角色提示词)。选择一个 **Image model**(图像模型)，或保留 **Chat's image provider**(聊天的图像服务商)。
4. 点击 **Generate image**(生成图片)。

新图片会替换消息中的旧图片，旧图片仍保留在 Gallery 中。每次尝试都会消耗一次图像请求。在此选项出现之前制作的图片，使用的是聊天的自拍账号，而且当时没有保存它们的负面提示词和角色提示词。

<a id="video-messages"></a>
## 视频消息

角色也可以发送一段短视频。请先安装 Illustrator。自拍功能可以保持关闭。

如果想自己请求一段视频，请输入 `/video`，或输入 `/video Aster` 来选择角色。也可以点击聊天 **Gallery** 中的 **Video**(视频)，它会使用在那里选中的角色。短片会作为一条新消息到达，并在聊天中播放。它展示的是对话的最新时刻：撰写短片的模型读取的最近消息数，与 Illustrator 为图片读取的一样（即它的 **Agent Budget**(智能体预算)）。你也可以让 Gallery 中的图片动起来。短片会接续该图片，并归入最新的一条回复。

如果短片无法添加到聊天中，它仍会保存在 Gallery 的 **Videos**(视频) 选项卡下。只有当短片展示了某个角色时，该角色自己的图库才会列出这段视频（参见[角色与用户角色图库](../characters/galleries.md)）。

### 视频设置

打开 **Chat Settings → Agents → Illustrator Settings**，找到 **Video messages**(视频消息)。

- **Generated Videos**：让角色自行发送视频消息。新聊天默认关闭，因为每段短片都是一次视频请求。它也会以 **Videos** 的名称显示在 **Commands** 列表中。
- **Video Run Interval**：在 **Generated Videos** 开启后显示。两段短片之间必须经过的消息数。设为 **0** 会停止它们。
- **Video model**：视频账号。选择 **Default video provider**(默认视频服务商) 即使用你的默认设置。
- **First frame**：短片开始所用的图片（见下文）。

无论上述设置如何，`/video` 和 Gallery 中的 **Video** 按钮都能使用，并且会忽略间隔。对发送过短片的回复进行滑动切换时，新的备选回复也可以发送它自己的短片。在群聊中，每个角色每条回复可以发送一段短片，直至 **Settings → Generations → Video Generation** 下的 **Videos per reply**(默认为 3)。

**First frame** 的选项：

- **New selfie, or the avatar if no selfie provider**(默认)：自拍已开启且设置了 **Selfie model** 时拍一张新自拍，否则使用头像。
- **New selfie, then animate it**：总是先拍一张新自拍，并同时保存到 Gallery。需要开启自拍并设置 **Selfie model**。
- **Avatar or sprite**：使用头像；没有头像时使用全身立绘。
- **Prompt only (no picture)**：不使用图片。有些 ComfyUI 工作流没有图片就会失败。如果 **Send Avatar References** 包含视频，此选项会显示为 **Prompt only (avatar from Send Avatar References)**，并从头像开始。

开启 **Expose media prompts before sending** 后，你可以同时检查自拍提示词和短片提示词。

WebP 等其他格式的图片，会先为视频服务转换格式。一条视频消息是一次视频请求；如果从新自拍开始，还会再加一次图像请求。视频提示词由你的 **Prompt Model** 撰写，其指令保存在 **Settings → Generations → Video Generation Prompt Overrides → Conversation Video Message** 中。

## 参考：自拍标记

角色在回复中用一个标记来请求自拍。你从不需要输入它。它的形式是 `[selfie]`，可以附带上下文：

```text
[selfie: context="standing beside the river at sunset"]
```

`[selfie: "standing beside the river"]` 和 `[selfie: standing beside the river]` 也可以使用，字母大小写不限。Marinara 会移除该标记，并发布图片。

## 相关指南

- [Conversation 模式：入门](getting-started.md)
- [图像生成服务商与设置](../media/image-providers.md)
- [图像风格方案](../media/style-profiles.md)
