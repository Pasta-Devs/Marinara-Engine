# Illustrator 智能体

**Illustrator**(插画师) 是一个可下载的智能体，能在聊天过程中把场景画出来。本指南介绍怎么开启它、怎么选画风和图像模型，以及怎么制作短片。智能体是一个小型 AI 帮手，只在一个聊天里自动运行。

## Illustrator 做什么

Illustrator 是一个后处理智能体，所以它在 AI 写完每条回复之后运行。它会读最新的回复，判断这一刻值不值得配一张图。值得的话，它会写一段图像提示词（告诉图像模型该画什么的文字），发给你的图像服务。它画出的每张图都会保存到聊天的 **Gallery**(图库)。

它不会每条消息都画。默认情况下，画完一张图之后，要再经过 5 条被采纳的用户消息和 AI 回复，它才能画下一张。每个 Roleplay 聊天都可以改这个数字。切换备选回复或重新生成回复，都不会推进这个计数。如果它判断某一刻不值得配图，就直接跳过。

它可以用在 Roleplay(角色扮演) 和 Game Mode(游戏模式) 聊天里。装上它还会一并加入 Conversation(对话模式) 的自拍和[视频消息](../conversation/selfies.md#video-messages)。本指南的设置针对 Roleplay。Game Mode 只用一个开关（见 [Game Mode](#game-mode-the-game-illustrator-toggle)）。

## 开始之前

Illustrator 负责写提示词，但画图的是另一个图像模型。你需要一个图像模型。见[图像生成服务商与设置](image-providers.md)。

有两种方式给它指定图像模型。

1. 在 **Connections**(连接) 面板的 **Defaults**(默认) 下设置 **Images**(图像) 这项工作。
2. 或者在 Illustrator 的 **Open Setup**(打开设置) 界面里给它单独指定一个图像模型。

找不到任何图像模型时，出图会失败，应用会让你选一个。

## 开启 Illustrator

开始之前：从 **Agent Organizer**(智能体管理器) 安装 **Illustrator**。见[智能体概览](../agents/agents-overview.md)。

1. 打开想配图的 Roleplay 聊天。
2. 打开 **Chat Settings**(聊天设置)，找到 **Agents**(智能体)。
3. 开启 **Enable Agents**(启用智能体)。
4. 在 **Misc Agents**(其他智能体) 分组里找到 **Illustrator**，点加号按钮添加。

这时会出现一张 **Illustrator** 卡片，上面是它自己的选项。智能体会额外消耗 Token，也可能让每轮多出几次模型调用。Token 估算只包含智能体指令。

<a id="game-mode-the-game-illustrator-toggle"></a>

### Game Mode：Game Illustrator 开关

Game Mode 没有 **Prompt Mode**(提示词模式) 和 **Prompt Model**(提示词模型) 选项。打开游戏的 **Chat Settings**，开启 **Game Illustrator**(游戏插图生成)（“Auto-generate scene illustrations, NPC portraits, and location backgrounds during gameplay”）。

## 选择画风

**Prompt Mode** 选择器（卡片上的标签是 **Prompt**）决定 Illustrator 写每段提示词时采用的画风。新的 Illustrator 默认用 **Background**(背景)。

| 画风 | 画什么 |
|---|---|
| **Illustration**(插图) | 一张精修完整的场景图，属于通用画风。 |
| **Comic Page**(漫画页) | 带分格、对话气泡、旁白框和音效字的漫画页。 |
| **Colored Manga**(彩色漫画) | 彩色日式漫画场景，气泡和音效字都经过风格化处理。 |
| **B&W Manga**(黑白漫画) | 黑白日式漫画页，勾线加网点阴影。 |
| **Background** | 场景图或定场镜头，画面里没有角色。 |
| **Selfie**(自拍) | 符合角色设定的自拍，或随意一些的人像。 |

成图的最终观感还取决于你的风格方案。见[图像风格方案](style-profiles.md)。

## 选择提示词模型

**Prompt Model** 是负责写图像提示词的文本模型，它不画图。在卡片上的 **Prompt Model** 列表里选。默认是 **Main chat model**(聊天主模型)，也就是沿用聊天的模型。想让另一个模型来写提示词，就另选一个文本模型。

真正画图的图像模型，就是你在**开始之前**一节里设置的那个。

## 保持角色形象一致

卡片上有两项设置，能让角色在不同图片里看起来一样。两项一开始都是关闭的。

**Attach Card Appearance**(附带角色卡外貌) 会把每个可见角色保存好的外貌描述加进图像提示词。在 Roleplay 聊天里，它是一个有四个选项的列表。

- **Off**(关闭)
- **Images only**(仅图片)，即通常的行为。
- **Videos only**(仅视频)：短片会加上其中出场角色的外貌描述。这对 **Prompt only**(仅提示词) 短片最重要，因为它没有图片。
- **Images and videos**(图片和视频)：两者都加。

开启后，如果角色卡或用户角色打开了 **Image Appearance Override**(图像专用外貌)，发送的就是这段覆盖文字，而不是它的 **Appearance**(外观) 文字。当 **Appearance** 是为旁白写的、图像模型却读不顺时，就用它：把完整描述留在 **Appearance** 里，再在覆盖里填一段更短的标签式描述。覆盖关闭或留空时，图像提示词使用 **Appearance**。旁白始终能看到完整的 **Appearance**。这个开关在角色编辑器和用户角色编辑器的 **Appearance** 下方。

**Send Avatar References**(发送头像参考图) 会把角色和用户角色的头像或立绘作为参考图发给图像服务，让模型照着画出同一张脸或同一身衣服。不是每个服务都接受参考图。在 Roleplay 聊天里，它和 **Attach Card Appearance** 一样是一个列表。包含视频时，**First frame**(首帧) 为 **Prompt only** 的短片会从角色的头像或立绘开始，这个选项也会显示为 **Prompt only (avatar from Send Avatar References)**。

## 控制出图频率

Illustrator 卡片上有一个 **Open Setup** 按钮，点开就是完整的设置界面。你可以在那里设置默认的运行间隔，并给它单独指定图像模型。

每个 Roleplay 聊天在 **Chat Settings** 的卡片上都有自己的 **Image Run Interval**(图像运行间隔)（“Messages between automatic images in this chat. 0 means only when you ask.”）。没有单独设置的聊天会使用设置界面里的值，默认是 **5**。卡片会显示 **Using agent default** 或 **Chat override**。按 **Use agent default**(改用智能体默认值) 就能回到默认值。把 Illustrator 加进聊天时，添加窗口里也有同一个字段，只保存到那个聊天。

把 **Image Run Interval** 设为 **0** 就是仅手动模式。它会停止自动运行，包括自动场景背景，但智能体仍可用于 Gallery 操作。设为正数即可恢复。

要立刻出一张图，打开 **Chat Settings**，展开 **Gallery**，点击 **Illustrate**(生成插图)。Illustrator 会立即运行一次，按钮上会显示 **Generating...**。

## 制作短片

在 Roleplay 聊天里，**Chat Settings → Agents → Illustrator**(聊天设置 → 智能体 → Illustrator) 中有一个 **Illustrator makes**(Illustrator 生成内容) 设置。

- **Pictures**(图片)（默认）：只生成图片。
- **Pictures and clips**(图片和短片)：当动作是重点时，例如打斗、追逐或物体破碎，Illustrator 还可以把一张新图片做成一段短片。这也包括负责讲故事的模型用 `[illustrate]` 请求的图片。它会按照视频模型的 **Video prompting instructions**(视频提示词指令) 自己编写动作。图片先显示，短片好了之后会加入同一条消息。
- **Clips only**(仅短片)：凡是 Illustrator 原本要显示图片的地方，都改为显示一段短片。它画出的图片会成为短片的起始帧，存进 Gallery，而不出现在回复里。短片失败时，会显示这张图片。

短片使用 **Scene Videos**(场景视频) 下的视频模型，每段短片都是一次视频请求。没有可用的视频模型时，即使选了 **Clips only**，Illustrator 也会生成图片。生成图像的自定义智能体也遵循同一个设置。见[场景视频生成](scene-video.md)。

让 Illustrator 生成短片后，会出现 **Video Run Interval**(视频运行间隔)。它表示一段短片之后，必须经过多少条用户消息和 AI 回复才能生成下一段，并且与 **Image Run Interval** 分开。

- 选 **Clips only** 时，每次运行都是短片，**Video Run Interval** 决定 Illustrator 多久运行一次，**Image Run Interval** 则隐藏。
- 没有设置值的聊天会使用 **Open Setup** 界面里的 **Video Run Interval**，或者 5。
- **0**：不自行生成短片，`[illustrate]` 请求的图片也不例外，只会得到图片。
- 一条回复最多生成 **Videos per reply**(每条回复的视频数) 段短片（**Settings → Generations → Video Generation**(设置 → 生成 → 视频生成)）。
- 你仍然可以从 Gallery 把图片做成动画。选 **Clips only** 时，消息上的 **Illustrate** 按钮会生成短片。
- 为一条已有短片的回复生成的备选回复算作一条新回复，可以有自己的短片。原来那条备选回复保留它的短片。

**First frame** 在同一区域，决定每段 Roleplay 短片从什么开始：Illustrator 的短片、`/video` 和 Gallery 的 **Video**(视频) 按钮都受它影响。选项有：一张新的 Illustrator 图片、被点名角色的头像或立绘、优先用图片并以头像作为后备，或者不用图片。Conversation 的视频消息使用同一个设置。

- **Clips only** 搭配头像或不用图片：不画图片。短片根据 Illustrator 描述的场景和动作生成。
- **Pictures and clips**：图片仍然显示，只有短片从头像开始或不用图片。
- 没有选择首帧：短片从不专门为自己画一张图片。**Pictures and clips** 会把 Illustrator 刚画的图片做成动画。**Clips only**、`/video` 和 **Video** 只根据场景生成短片。

没有自身图片的短片会描述它点名的每个人，包括你的用户角色。头像首帧从最先被点名的人开始。

从消息的 **Illustrate** 按钮重新运行 Illustrator，同样遵循 **Illustrator makes** 和 **First frame**。

## NovelAI 上的多角色场景

当 Illustrator 的图像模型是 NovelAI 的 V4、V4.5 或 V5 模型时，写提示词的模型会为每个可见角色加一段角色描述。每段描述包含该角色的外观、表情、姿势，以及在画面中的大致位置。Marinara 会把这些描述与场景的角色列表核对，丢掉无法匹配的，再把其余描述作为 NovelAI 原生角色提示词，和主提示词一起发送。这样可以避免不同角色的发型、服装和其他特征混在一起。通过 **Illustrate** 生成的图片，以及角色用 `[illustrate]` 命令生成的图片，也会得到同样的描述。

V5 最多接受 22 个角色，V4 和 V4.5 最多接受 6 个。可见角色更多时，保留最重要的角色，其余的变成没有名字的背景人物。

固定特征来自 **Appearance** 字段。如果它已经是 Danbooru 标签，就原样复制；如果是普通文字，写提示词的模型会把它转成标签。服装来自角色追踪器运行时记录的当前穿着，同样转成标签。

开启 **Attach Card Appearance** 后，写提示词的模型还会收到聊天里每张角色卡和每个用户角色的完整 Appearance 文本，所以较长的角色卡或多人角色卡不会被截断。以 `[NAME] tags | [NAME] tags` 格式描述多个角色的多人卡会按角色分别列出。模型会把固定特征复制到对应的描述里，把卡片里的服装标签当作可被追踪器或场景覆盖的默认值，并忽略不在场景里的角色。描述返回后，Marinara 不再追加任何内容。没有描述时，也就是只有一个角色的情况，会像以前一样把常规外观描述行加进主提示词。

不需要任何设置。只有直接连 NovelAI 自有服务器时才会生成角色描述，代理或其他服务不受影响。开启 **Expose media prompts before sending**(发送前显示媒体提示词) 后，检查窗口会在主提示词下方列出这些描述，只读。主提示词照常编辑。

## 图库保存与提示词查看

在 **Settings → Generations → Image Generation**(设置 → 生成 → 图像生成) 中，**Automatically save generated images to character galleries**(自动将生成的图片保存到角色图库) 默认开启。关闭后，聊天插图和自拍就不会再加入图中角色和用户角色的图库。图片仍会显示在聊天记录和聊天 Gallery 里，手动保存到图库也照常可用。已有条目不变。各图库共享图片文件，所以这个选项控制的是图片属于哪些图库，而不是删除。

对于新的 NovelAI 插图，图片检查器会先显示场景和风格提示词，再显示各角色的正向描述，用 ` | ` 分隔。保存到图库的提示词也一样。

要用修改过的提示词重画一张插图，而不重新生成回复，打开它并使用 **Regenerate image**(重新生成图片)。见[重新生成图片](scene-backgrounds.md#regenerating-an-image)。

要为较早的 Roleplay 消息或消息范围生成插图，使用 `/illustrate range=12` 或 `/illustrate range=12-18`。见[斜杠命令](../chats/slash-commands.md)。

## 相关指南

- [图像生成服务商与设置](image-providers.md)
- [图像风格方案](style-profiles.md)
- [场景背景与 Gallery 面板](scene-backgrounds.md)
- [智能体：聊天里的 AI 帮手](../agents/agents-overview.md)
- [连接 AI 服务商](../connections/connecting-to-a-provider.md)
