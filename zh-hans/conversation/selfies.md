# 自拍

本指南介绍 Conversation(对话模式) 里的自拍。自拍就是角色生成一张自己的图片发进聊天，就像在聊天软件里发照片一样。下面讲解怎么开启自拍、怎么配置，以及怎么手动要一张。

## 自拍是什么

自拍是 Conversation 模式专属的功能。角色可以在普通聊天过程中发来一张生成的自己的照片。这和 Roleplay(角色扮演) 模式、Game Mode(游戏模式) 里的场景图不是一回事。自拍是为了配合 Conversation 模式那种聊天软件的感觉而做的。

自拍依赖图像生成。角色每发一张自拍，就会向选定的连接发出一次图像生成请求。正因如此，自拍在配置好之前一直是关闭的。

自拍功能由可选的 **Illustrator** 包提供。配置之前先从 **Agents → Download Agents**(智能体 → 下载智能体) 安装 Illustrator。

## 开启自拍

自拍的开关在 Conversation 聊天的 **Agents**(智能体) 部分，位于 **Illustrator Settings**(Illustrator 设置) 里面。**Commands**(命令) 指角色可以自行采取的隐藏动作，比如发一张自拍或者放一首歌。装了提供命令的包之后，命令相关的控件就会出现在 **Agents** 里。

开启自拍的步骤：

1. 打开一个 Conversation 聊天。
2. 打开 **Chat Settings**(聊天设置)（滑块图标）。
3. 找到 **Agents** 部分。
4. 打开里面的总开关 **Commands**。关着的时候，角色无法使用任何隐藏动作。
5. 找到 **Illustrator Settings**。
6. 打开 **Generated Selfies**(生成自拍) 开关。

打开 **Generated Selfies** 之后，自拍的各项设置会出现在开关下方，包括连接、提示词模型、风格和参考图几个输入框。**Resolution**(分辨率) 那排按钮要先选好 **Selfie Connection**(自拍连接) 才会出现。

## 自拍设置

自拍开启后，接下来决定它长什么样、由哪个服务生成。所有这些设置都在 **Chat Settings → Agents** 的 **Illustrator Settings** 里，只对当前聊天生效。

### Selfie Connection

**Selfie Connection** 决定由哪个图像生成服务来画这张图。默认值是 **None (selfies disabled)**，也就是还没选服务。在这里选一个已经配好的图像连接。

没选 **Selfie Connection** 之前，角色发不出自拍。如果看到提示“Choose a Selfie Connection to let characters generate selfie images”，说明连接还空着。

图像连接怎么添加，见[图像生成服务商与设置](../media/image-providers.md)。

### Prompt Model

**Prompt Model**(提示词模型) 决定由哪个文本模型来写这张自拍的描述，图像连接再照着这段描述作画。默认值是 **Main chat model**，即复用聊天当前用的那个模型。想换个模型来写自拍描述，选另一个文本连接就行。

### Image Style

**Image Style**(图像风格) 为自拍指定一个 Style Profile(风格方案)。Style Profile 就是保存好的一组画风词，比如“anime”或“realistic photo”。默认值是 **Use default style from Style Profiles in Advanced settings**，也就是跟随全局默认风格。

关于风格的更多内容，见[图像风格方案](../media/style-profiles.md)。

### Send Avatar References

**Send Avatar References**(发送头像参考) 是一个下拉菜单，默认为 **Off**(关闭)。它位于 **Video messages**(视频消息) 部分下方，每个选项都写明了它适用于什么：**Images only**(仅图片)、**Videos only**(仅视频) 或 **Images and videos**(图片和视频)。

- 对于图片，Marinara 会把角色的头像或立绘作为参考图发给图像服务，让自拍更像这个角色。只有图像服务商支持参考图时才有效果。
- 对于视频，**First frame**(首帧) 为 **Prompt only**(只用提示词) 的视频消息会从角色的头像或立绘开始，而不是不带图片。视频服务只接受一张起始图片，所以其他本来就从角色图片开始的首帧选项不受影响。

### Attach Card Appearance

**Attach Card Appearance**(附带角色卡外貌) 是一个下拉菜单，默认为 **Off**，选项同样是 **Images only**、**Videos only** 和 **Images and videos**。它会把提示词里点到名的每个角色的卡片外貌描述加进自拍提示词、视频提示词，或两者都加，让模型更清楚角色长什么样。

如果角色卡或用户角色还打开了 **Image Appearance Override**(图像专用外貌)，并填写了内容，Marinara 就会发送这段文字，而不是 **Appearance** 的内容。如果完整的 **Appearance** 描述更适合写旁白的模型，而不适合图像模型，可以在角色或用户角色编辑器的 **Appearance** 下方打开这个开关。撰写自拍描述的 AI 仍然会读取角色卡的 **Appearance**。它会原样保留覆盖内容里的措辞，只用 **Appearance** 的文字来补充其他细节。

### Resolution

**Resolution** 设定自拍图片的尺寸。**Resolution** 按钮要先选好 **Selfie Connection** 才会出现，直接点其中一个即可。默认是 **896x1152**，一种偏高的竖构图，适合大多数自拍。

可选的尺寸有：

| 分辨率 | 构图 |
| ---------- | ------------------ |
| 512x512    | 正方形 |
| 512x768    | 竖构图 |
| 768x768    | 正方形 |
| 768x1024   | 竖构图 |
| 896x1152   | 竖构图（默认） |
| 1024x1024  | 正方形 |

## 角色怎么发自拍

自拍配置好以后，角色会在聊天中自行决定什么时候发一张，不需要输入任何命令。时机由角色把握，Marinara 负责生成图片并发进聊天。之后的回复会看到一条简短的备注，写明自拍里拍了什么，这样角色就记得自己发过它。

模型回复使用 `[selfie]`，也可以附上上下文：

```text
Here is a picture from my walk!
[selfie: context="standing beside the river at sunset"]
```

`[selfie: "standing beside the river"]` 和 `[selfie: standing beside the river]` 也能使用。命令不区分大小写，所以 `[SELFIE:xxxxx.]` 是有效语法。这是 Conversation 命令，不是 Roleplay 或 Game Mode 的图像触发命令。如果标记原样留在消息中，可能是聊天处于其他模式，或 **Commands** 已关闭。请确认已安装 Illustrator，开启 **Generated Selfies**，并选好 **Selfie Connection**。如果生成开始后失败，请检查报告的连接或图像服务商错误；改变标记的大小写无法解决问题。

## 手动要一张自拍

也可以自己主动要一张，不用干等角色。

1. 打开 **Chat Settings**，展开 **Gallery**(图库)。
2. 点击 **Selfie**(自拍) 按钮（相机图标）。
3. 如果聊天里不止一个角色，在按钮旁边的角色列表中选出由谁来拍。
4. 如果在 **Settings**(设置)、**Generations**(生成)、**Overall Generations**(总体生成) 下开启了 **Expose media prompts before sending**，可以先检查或修改最终编译好的自拍提示词，再点 **Generate**。取消检查则不会发出图像请求。
5. 等待按钮上显示的 **Generating...** 结束。

自拍完成后会看到一条“Selfie generated.”消息，图片随之出现在聊天里。手动请求同样走选定的 **Selfie Connection**，因此也会消耗一次图像生成请求。

## 重新生成自拍

对某张图片不满意？在聊天里点击这张自拍打开它，再点击 **Regenerate image**(重新生成图片)（固定按钮旁边的圆形箭头）。你可以修改提示词、负面提示词和各个角色提示词，并选择一个 **Image connection**(图像连接)。点击 **Generate image**(生成图片)。新图片会替换消息里的旧图片，旧图片仍保留在 Gallery 里。每次尝试都会消耗一次图像生成请求。

在这个选项出现之前生成的图片也可以重新生成。它们使用聊天的自拍连接，而且它们的负面提示词和角色提示词当时没有保存。

<a id="video-messages"></a>

## 视频消息

角色也可以给你发一段短视频。输入 `/video`，或者输入 `/video Aster` 指定角色；也可以点击聊天 **Gallery** 里的 **Video**(视频)（胶片图标），这时由 Gallery 里选中的角色来发。只要装了 Illustrator，**Video** 就能用，即使自拍处于关闭状态也一样。短片会作为该角色的一条新消息发来，并直接在聊天里播放。用这种方式要来的短片，展示的是对话最新的一刻：撰写短片的 AI 读取的最近消息条数，和 Illustrator 生成图片时一样（即 Illustrator 的 **Agent Budget**(智能体预算) 里的上下文大小）。以自拍作为首帧时，读取的也是这些消息，所以短片同样从这一刻开始。之后的回复会看到一条简短的备注，写明短片里展示了什么。也可以让 Gallery 里的一张图片动起来：短片会接着这张图片往下演，由 Gallery 里选中的角色发出，并归入最新的一条回复。如果短片没能加进聊天，它仍会保存在 Gallery 的 **Videos**(视频) 选项卡下。只有当短片拍到某个角色时，这条视频消息才会列在该角色自己的图库里；见[角色与用户角色图库](../characters/galleries.md)。

相关设置位于 **Chat Settings**、**Agents**、**Illustrator Settings** 下的 **Video messages**(视频消息) 部分：

- **Video Connection**(视频连接) 用来选择 Video Generation(视频生成) 连接。保持 **Default video connection**(默认视频连接) 即可使用你的默认连接。连接里的 **Video Prompting Instructions**(视频提示词指令) 会指导撰写视频提示词的 AI。
- **First frame**(首帧) 用来选择短片从哪张图片开始：
  - **New selfie, or the avatar if no selfie connection**(新自拍，没有自拍连接时用头像)（默认）会在自拍已开启且设置了 **Selfie Connection** 时拍一张新自拍，否则使用头像。
  - **New selfie, then animate it**(先拍新自拍，再让它动起来) 总是先拍一张新自拍。这需要开启自拍并设置 **Selfie Connection**，拍好的自拍也会保存到 Gallery。开启 **Expose media prompts before sending** 时，你会把自拍的提示词和短片的提示词放在一起检查。
  - **Avatar or sprite**(头像或立绘) 从角色的头像开始；没有头像时，改用全身立绘。
  - **Prompt only (no picture)**(只用提示词，不带图片) 不发送图片，视频模型只根据提示词生成。有些 ComfyUI 工作流必须有图片，没有就会失败。当 **Send Avatar References** 包含视频时，这个选项显示为 **Prompt only (avatar from Send Avatar References)**(只用提示词，头像来自 Send Avatar References)，短片会改为从头像开始。

其他格式的图片（比如 WebP）会先转换成视频服务能用的格式。一条视频消息会发出一次视频请求；如果从新自拍开始，还会多发一次图像请求。撰写提示词的 AI 就是你的 **Prompt Model**，它的指令位于 **Settings**、**Generations**、**Video Generation Prompt Overrides**(视频生成提示词覆盖)、**Conversation Video Message**(Conversation 视频消息)。

## 相关指南

- [Conversation 模式：入门](getting-started.md)
- [图像生成服务商与设置](../media/image-providers.md)
- [图像风格方案](../media/style-profiles.md)
