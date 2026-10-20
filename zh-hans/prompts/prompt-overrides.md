# 图像与视频的提示词覆盖

本指南介绍 **Prompt Overrides**(提示词覆盖)。Marinara Engine 生成图像和视频时会先套用模板拼出提示词，这两个编辑器改的就是这些模板。下面讲清楚它们在哪里、能改什么，以及怎样安全地保存一份自定义模板。

## 提示词覆盖是什么

**Prompt Override** 就是一份可复用的媒体提示词模板。Marinara 生成图像或视频之前，会先为图像模型或视频模型写好一段文字提示词，而 Prompt Overrides 编辑的正是这些模板。

这个功能只管图片和视频的提示词，不会影响 Conversation(对话模式) 或 Roleplay(角色扮演) 中发给聊天模型的文字提示词。这一点很容易搞混。想改发给聊天模型的提示词，要用提示词预设和生成参数，见[预设编辑器与提示词管理器](presets.md) 和[生成参数](generation-parameters.md)。

下面会用到几个术语：

- **立绘**指角色美术素材，比如一张表情图或者一张全身姿势图。
- **分镜**是一组插画帧，由 Game Mode(游戏模式) 的一个回合，或者一集已完成的 Roleplay 生成。

## 在哪里找到它们

这两个编辑器在应用设置里。

1. 打开 **Settings**(设置)。
2. 点击 **Generations**(生成) 选项卡。
3. 向下滚动到 **Prompt Overrides** 区域，它的说明文字是“Reusable image and video prompt templates.”

那里应该能看到两个可折叠的编辑器。

## 两个编辑器

点击编辑器标题即可展开。

**Video Generation Prompt Overrides**(视频生成提示词覆盖) 编辑的是可复用的视频模板，涵盖 Game 和 Gallery(图库) 的场景视频、Conversation 的视频消息、Conversation Call 的角色片段，以及会动的 Expression(表情) 肖像。每个视频提示词模板决定一类片段该怎么描述给视频模型。

**Image Generation Prompt Overrides**(图像生成提示词覆盖) 编辑的是图像、立绘、Game 以及提示词构建系统所用的模板，包括 Conversation 自拍、Game 的 NPC 肖像、场景美术、分镜提示词、Noodle 帖子用的 **Noodle Post Image** 模板，还有其他已注册的图像构建器。每个图像提示词模板决定一类图片该怎么描述给图像模型。

所以这两个编辑器合起来，就能调整肖像、自拍、立绘、场景美术、分镜和视频片段的提示词。

## 编辑模板

两个编辑器的用法一样，按下面的步骤操作。

1. 打开需要的那个编辑器。
2. 在 **Registered prompt**(已注册提示词) 下拉菜单里选一个模板。列表内容取决于打开的是哪个编辑器。
3. 看一下下拉菜单旁边的状态标记。没有保存自定义模板时显示 **Default**；正在使用你保存的模板时显示 **Custom active**；模板已保存但被关闭时显示 **Custom paused**。
4. 读一读下拉菜单下方的简短说明，了解这个模板的用途。
5. 在 **Available variables**(可用变量) 下面，点击任意变量按钮就能把它插入模板。变量写作 `${name}` 形式，例如 `${charName}`。
6. 在 **Template**(模板) 框里编辑文本。
7. 看下面的 **Rendered preview**(渲染预览) 框。预览会用示例值填充模板，最终效果一目了然。
8. 如果预览里出现 **Unknown variables**(未知变量) 警告，就把拼错的变量名改正。**Available variables** 列表里没有的变量名，Marinara 不会去填充。
9. 点击 **Save**(保存)。

保存成功后会看到“Prompt override saved”提示，状态标记也会变成 **Custom active**。

## 保留模板但不使用

预览下方是 **Apply this override**(应用此覆盖) 开关，帮助文字写着“Turn this off to keep the template saved without using it.”关闭它，草稿就会存下来，同时功能继续使用内置的默认模板。状态标记这时显示 **Custom paused**。

## 恢复内置模板

点击 **Reset to Default**(恢复默认) 会丢弃自定义模板，重新使用内置模板。如果已经保存过覆盖，Marinara Engine 会先让你确认。状态标记随后回到 **Default**。

## 覆盖什么时候生效

Prompt Override 只对真正会生成图像或视频的功能起作用，比如 Game 资产、Conversation 的自拍和通话、立绘，以及 Noodle 帖子图片。这些功能还需要先配好图像生成连接或视频生成连接。没有可用的生成连接，什么都跑不起来，模板也就永远用不上。参见[图像生成服务商与设置](../media/image-providers.md) 和[场景视频生成](../media/scene-video.md)。

## 相关指南

- [图像生成服务商与设置](../media/image-providers.md)
- [场景视频生成](../media/scene-video.md)
- [图像风格方案](../media/style-profiles.md)
- [Noodle 设置与聊天延续](../noodle/settings.md)
- [预设编辑器与提示词管理器](presets.md)
- [生成参数](generation-parameters.md)
