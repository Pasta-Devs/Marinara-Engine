# Illustrator 智能体

本指南介绍 **Illustrator**(插画师)，它是内置的帮手，能在聊天过程中把场景画出来。下面会讲它做什么、怎么开启、可以用哪些画风，以及它需要的两个连接。

## Illustrator 智能体做什么

智能体是一个小型 AI 帮手，只在一场聊天里自动运行。**Illustrator** 属于后处理智能体，也就是说，AI 每写完一条回复之后它才动手。它会读最新的这条回复，判断这一刻值不值得配一张图。值得的话，Illustrator 就写一段图像提示词，发给图像服务商。提示词就是告诉图像模型该画什么的那段文字描述。

Illustrator 不会每条消息都画。默认情况下，画完一张图之后，要再经过 5 条被采纳的用户消息和 AI 回复，它才会画下一张。对同一条回复滑动切换备选回复或者重新生成，都不会推进这个间隔。如果它判断某一刻不值得配图，就直接跳过，不出图。它画出来的每张图都会保存到聊天的 **Gallery**(图库) 里。

Illustrator 可以用在 **Roleplay**(角色扮演) 和 **Game Mode**(游戏模式) 聊天里，装上它之后，Conversation(对话模式) 的自拍功能也会一并解锁。应用里给它的简介是“Responsible for image and video generations.”本指南的设置步骤和选项针对的是 Roleplay 聊天。Game Mode 换成了一个简单开关，见下面的 Game Mode 一节。

## 开始之前

Illustrator 只负责写图像提示词，真正画出图还需要另外一个图像连接。图像连接就是保存下来的一套图像服务商接入信息，比如 OpenAI，或者本地的 Stable Diffusion 服务器。

先配好一个图像连接。给 Illustrator 指定图像连接有两种办法：

1. 把某个图像连接设为默认。打开 **Connections**(连接) 面板，展开 **Defaults**(默认)，在 **Images**(图像) 下面选中它。
2. 或者在 Illustrator 的完整设置界面里单独给它一个图像连接（见下文的 **Open Setup**(打开设置)）。

一个图像连接都找不到时，出图会失败，应用会让你选一个。添加服务商的方法见[图像生成服务商与设置](image-providers.md)。

## 开启 Illustrator

Illustrator 默认是关闭的。在 **Roleplay** 聊天里这样添加：

1. 打开想配图的那场聊天。
2. 点击齿轮图标，打开 **Chat Settings**(聊天设置)。
3. 找到 **Agents**(智能体) 区域，打开 **Enable Agents**(启用智能体)。
4. 在 **Misc Agents**(其他智能体) 分组里找到 **Illustrator**，点加号按钮添加。

这时应该能看到一张 **Illustrator** 设置卡片，上面是它自己的选项。每多一个智能体，每回合都会多花一些 Token(模型切分文本的最小单位)，也会多调用几次 AI，所以面板上会实时显示费用估算。

### Game Mode：Game Illustrator 开关

Game Mode 不走上面这套步骤，也不会显示 **Prompt Mode**(提示词模式) 和 **Prompt Model**(提示词模型) 选项。在游戏的 **Chat Settings** 里打开 **Game Illustrator**(游戏插图生成) 这一个开关就行。它的说明写着：“Auto-generate scene illustrations, NPC portraits, and location backgrounds during gameplay.”

## 提示词模式

**Prompt Mode** 选择器决定 Illustrator 写每一段提示词时采用的画风。在智能体卡片上，这个选择器的标签是 **Prompt**。下面有一行小字：“Prompt mode controls how Illustrator writes image prompts for this chat.”

选择器提供这几种画风：

- **Illustration**(插图)：一张精修完整的场景图，属于通用画风。
- **Comic Page**(漫画页)：带分格、对话气泡、旁白框和音效字的漫画页。
- **Colored Manga**(彩色漫画)：彩色日式漫画场景，气泡和音效字都经过风格化处理。
- **B&W Manga**(黑白漫画)：黑白日式漫画页，勾线加网点阴影。
- **Background**(背景)：场景图或者定场镜头，画面里不出现角色。
- **Selfie**(自拍)：符合角色设定的自拍，或者随意一些的人像。

新添加的 Illustrator 智能体默认用 **Background** 画风。画风随时可以在选择器里改。成图的整体观感还取决于图像风格方案，设置方法见[图像风格方案](style-profiles.md)。

## Prompt Model 与图像连接

Illustrator 会用到两个不同的连接，分清这两者很有必要。

**Prompt Model** 是负责写图像提示词的那个文本模型，不是负责画图的模型。在 Illustrator 卡片的 **Prompt Model** 下拉菜单里选。默认是 **Main chat model**，也就是沿用这场聊天已经在用的连接。想换一个模型来写提示词，就另选一个文本连接。

图像连接才是真正画出成图的图像服务商。按**开始之前**一节里说的方式指定：要么在 **Defaults → Images** 下面选，要么在智能体自己的设置界面里选。

## Attach Card Appearance 与 Send Avatar References

Illustrator 卡片上有两个开关，能让角色形象保持一致。两个默认都是关闭的。

**Attach Card Appearance**(附带角色卡外貌) 会把每个出场角色保存好的外貌描述加进图像提示词。它的帮助文字是：“Append matched character appearance lines to image prompts, using only visible/generated names.”想让画面贴合角色卡上写的样子，就打开它。

**Send Avatar References**(发送头像参考图) 会把角色和用户角色的头像，或者他们的立绘，作为参考图发给图像服务商。它的帮助文字是：“Send matching character and persona avatars or sprites as reference images when the provider supports them.”这样图像模型更容易照着画出同一张脸或同一身衣服。并不是所有服务商都接受参考图，实际效果取决于选的那家服务商。

## 更多设置和手动运行

Illustrator 卡片上有一个 **Open Setup** 按钮，点开就是这个智能体的完整设置界面，在那里可以设置它运行的频率，也可以单独给它指定图像连接。

把 **Run Interval**(运行间隔)设为 **0**，即可仅手动生成。这会停止 Illustrator 的自动运行，包括自动生成场景背景，但智能体仍保持安装，也仍可用于 Gallery 操作。默认值仍是 **5**；设为正数即可恢复自动运行。把 Illustrator 加入聊天时也可以选择 0。

也可以不等它自己动手，随时手动出一张图。打开聊天的 **Gallery**，点 **Illustrate**(生成插图) 按钮，Illustrator 会立刻运行一次，出图期间按钮会显示 **Generating...**。想给眼下这一刻配张图、而智能体还没画的时候，这个按钮很好用。

## 相关指南

- [图像生成服务商与设置](image-providers.md)
- [图像风格方案](style-profiles.md)
- [场景背景与 Gallery 面板](scene-backgrounds.md)
- [智能体：聊天里的 AI 帮手](../agents/agents-overview.md)
- [连接 AI 服务商](../connections/connecting-to-a-provider.md)
