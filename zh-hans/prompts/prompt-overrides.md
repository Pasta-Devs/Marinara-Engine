# 图像与视频的提示词覆盖

Prompt Overrides(提示词覆盖) 是一组编辑器，用来修改 Marinara 给图像模型和视频模型写提示词时所用的模板。想改变肖像、自拍、立绘、场景美术、分镜或视频片段描述给模型的方式，就用其中一个编辑器。

它们不会改变发给聊天模型的提示词。要改那个，就用预设。见[预设编辑器与提示词管理器](presets.md)和[生成参数](generation-parameters.md)。

立绘是一张角色美术图，比如一个表情或一个姿势。分镜是一组插画帧，来自 Game Mode(游戏模式) 的一个回合，或一集已完成的 Roleplay(角色扮演)。

开始之前：Prompt Overrides 只对会生成图像或视频的功能起作用，而这些功能需要先有一个图像或视频生成账号。没有账号，模板就永远用不上。见[图像生成服务商与设置](../media/image-providers.md)和[场景视频生成](../media/scene-video.md)。

## 找到编辑器

1. 打开 **Settings**(设置)。
2. 点击 **Generations**(生成) 选项卡。
3. 向下滚动到 **Prompt Overrides**，它的说明文字是“Reusable image and video prompt templates”。

那里有两个编辑器。点击标题即可展开。

| 编辑器 | 涵盖的模板 |
| --- | --- |
| **Video Generation Prompt Overrides**(视频生成提示词覆盖) | Game 和 Gallery(图库) 的场景视频、Conversation(对话模式) 的视频消息、Conversation Call 的角色片段、会动的 Expression(表情) 肖像。 |
| **Image Generation Prompt Overrides**(图像生成提示词覆盖) | Conversation 自拍、Game 的 NPC 肖像、场景美术、分镜提示词、**Noodle Post Image** 模板，以及其他图像构建器。 |

## 编辑模板

1. 打开一个编辑器。
2. 从 **Registered prompt**(已注册提示词) 里选一个模板。列表内容取决于编辑器。
3. 看一下旁边的状态标记，再读一读下拉菜单下方的简短说明。
4. 在 **Available variables**(可用变量) 下面，点击变量按钮即可插入。变量写成 `${charName}` 这样的形式。
5. 在 **Template**(模板) 框里编辑文本。
6. 查看 **Rendered preview**(渲染预览)。它会用示例值填充你的模板。
7. 修正所有 **Unknown variables**(未知变量) 警告。**Available variables** 列表里没有的名字不会被填充。
8. 点击 **Save**(保存)。

你会看到“Prompt override saved”，状态标记随即变成 **Custom active**。

| 状态标记 | 含义 |
| --- | --- |
| **Default** | 没有保存自定义模板。 |
| **Custom active** | 正在使用你保存的模板。 |
| **Custom paused** | 模板已保存，但被关闭了。 |

## 保留模板但不使用

关闭预览下方的 **Apply this override**(应用此覆盖)。它的帮助文字写着“Turn this off to keep the template saved without using it.”之后 Marinara 会继续使用内置模板，状态标记显示 **Custom paused**。

## 恢复内置模板

点击 **Reset to Default**(恢复默认)。如果已经保存过覆盖，Marinara 会让你确认。状态标记随后回到 **Default**。

## 相关指南

- [图像生成服务商与设置](../media/image-providers.md)
- [场景视频生成](../media/scene-video.md)
- [图像风格方案](../media/style-profiles.md)
- [Noodle 设置与聊天延续](../agents/noodle-settings.md)
- [预设编辑器与提示词管理器](presets.md)
- [生成参数](generation-parameters.md)
