# Roleplay 背景

本指南介绍 Roleplay(角色扮演) 模式里的场景背景：每次回复之后自动挑图的 **Background**(背景) 智能体、手动生成背景，以及把某张背景固定给单个聊天。自己上传的背景图库和相关控件请看[聊天背景](../appearance/chat-backgrounds.md)，从 Gallery 生成的 AI 场景画请看[场景背景](../media/scene-backgrounds.md)。

## 场景背景

Roleplay 模式会在消息后面铺一整张场景背景。背景切换时，Marinara 会把旧图淡出、新图淡入，场景转换看起来很柔和，不会突兀。

这个功能不依赖图像生成。没配置图像生成连接也没关系，背景会显示成纯色，聊天照常按纯文字进行。

## Background 智能体

**Background** 智能体是个可选的小帮手，负责替你挑选场景背景。它在每次回复之后运行，先读取当前场景，再从所有可用背景里挑出最贴合的一张。图库里的文件夹只是 Settings(设置) 里的整理工具，不会对智能体隐藏任何选项。它只会挑现成的图片；自动生成背景是 **Illustrator** 智能体的活。

**Background** 智能体默认关闭。开启方法：

1. 打开 Roleplay 聊天。
2. 打开 **Chat Settings**(聊天设置)（点击聊天里的 **Chat Settings** 按钮；除非移动过，否则它在右上角）。
3. 打开 **Agents**(智能体) 部分。
4. 启用 **Background** 智能体。

之后故事走到哪里，场景背景就会自己跟着换。

## 手动生成背景

不用智能体，也可以自己做一张新背景。Marinara 会根据场景（题材、设定、当前地点、天气和时间）拼出一段图像提示词（发给 AI 的那段文字），生成一张全新的背景。

1. 打开 **Chat Settings**，展开 **Gallery**(图库)。
2. 点击 **Background** 按钮。
3. 等按钮跑完。生成过程中按钮显示 **Generating...**。

运行期间会看到这样一条提示：“AI background generation is running. The new background will be applied when it finishes.”新图片会加进背景图库，并应用到当前场景。

手动生成优先用 **Illustrator** 智能体的图像连接，找不到就退回到默认的图像生成连接。**Background** 智能体不需要图像连接，因为它只从图库里挑现成的图片。如果 Marinara 一个连接都找不到，生成会失败并给出这条消息：“Choose an image generation connection for the Illustrator agent, or mark one as the default image connection.”

场景背景生成只在 Roleplay 模式和 Game Mode 里可用，Conversation 模式没有这个功能。

## 给单个聊天指定背景

不想让智能体挑图时，可以给当前正在看的这个聊天固定一张背景。

1. 打开 **Settings**。
2. 打开 **Appearance**(外观) 选项卡。
3. 找到 **Backgrounds**(背景) 部分。
4. 在 **Chat Background**(聊天背景) 下面，选一张上传的图片，或者一张游戏素材背景。

想换回默认背景，点击 **Chat Background** 旁边的 **Remove**(移除)。

## 背景图库与模糊

可选的这些图片就放在 **Settings** 里 **Appearance** 下的同一个 **Backgrounds** 部分。[聊天背景](../appearance/chat-backgrounds.md)这篇指南完整讲了这个图库：导入图片、标签、改名、删除、**Background Blur**(背景模糊) 滑块，以及给新建的 Roleplay 聊天设定默认背景。

## 相关指南

- [聊天背景](../appearance/chat-backgrounds.md)：背景的上传图库和外观控件。
- [场景背景](../media/scene-backgrounds.md)：从 Gallery 生成的 AI 场景画。
- [Roleplay 模式：入门](getting-started.md)：完整的 Roleplay 场景、立绘和 HUD。
