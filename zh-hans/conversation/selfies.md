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

**Send Avatar References**(发送头像参考) 是一个开关，默认关闭。打开后，Marinara 会把角色的头像或立绘作为参考图发给图像服务，让自拍更像这个角色。只有图像服务商支持参考图时才有效果。

### Attach Card Appearance

**Attach Card Appearance**(附带角色卡外貌) 是一个开关，默认关闭。打开后，Marinara 会把角色卡里的外貌描述加进自拍描述中，让模型更清楚角色长什么样。

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

自拍配置好以后，角色会在聊天中自行决定什么时候发一张，不需要输入任何命令。时机由角色把握，Marinara 负责生成图片并发进聊天。

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
4. 如果在 **Settings**(设置)、**Generations**(生成)、**Image Generation**(图像生成) 下开启了 **Expose media prompts before sending**，可以先检查或修改最终编译好的自拍提示词，再点 **Generate**。取消检查则不会发出图像请求。
5. 等待按钮上显示的 **Generating...** 结束。

自拍完成后会看到一条“Selfie generated.”消息，图片随之出现在聊天里。手动请求同样走选定的 **Selfie Connection**，因此也会消耗一次图像生成请求。

## 相关指南

- [Conversation 模式：入门](getting-started.md)
- [图像生成服务商与设置](../media/image-providers.md)
- [图像风格方案](../media/style-profiles.md)
