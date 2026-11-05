# Roleplay 背景

Roleplay(角色扮演) 聊天会在消息后面铺一整张场景图。你可以让 **Background**(背景) 智能体在每次回复之后挑图，也可以手动生成一张新图，或者给单个聊天固定一张图。图片切换时，Marinara 会把旧图淡出、新图淡入。

不一定要用图像生成。没有图像生成账号时，背景会显示成纯色，聊天照常按纯文字进行。

## 给单个聊天指定背景

不想让智能体挑图时，可以用这个办法给当前打开的聊天固定一张图片。它只改变这一个聊天。

1. 打开这个聊天，再打开 **Settings → Appearance**(设置 → 外观)，找到 **Backgrounds**(背景)。
2. 在 **Chat Background**(聊天背景) 下面，选一张上传的图片，或者一张游戏素材背景。

这张图会出现在消息后面。想换回默认背景，点击 **Chat Background** 旁边的 **Remove**(移除)。

还没有图片？先上传一张。见[聊天背景](../appearance/chat-backgrounds.md)。

## 让 Background 智能体挑选背景

**Background** 智能体是随回复一起运行的帮手。每次回复之后，它会读取当前场景，从你所有的背景里挑出最贴合的一张。它只挑现成的图片。自动生成新图是 **Illustrator** 智能体的活。

1. 打开 Roleplay 聊天。
2. 用聊天里的滑块按钮打开 **Chat Settings**(聊天设置)。
3. 打开 **Agents**(智能体)，开启 **Enable Agents**(启用智能体)。
4. 添加 **Background** 智能体。

之后故事走到哪里，背景就会自己跟着换。

如果没有成功：背景只有一两张时，智能体会一直挑这几张。往图库里多加一些。见[聊天背景](../appearance/chat-backgrounds.md)。

## 手动生成背景

Marinara 会根据场景（题材、设定、地点、天气和时间）拼出一段图像提示词，生成一张新背景。

开始之前：安装 **Illustrator** 智能体并给它设置一个图像生成账号，或者把某个图像生成账号设为默认。见[连接 AI 服务商](../connections/connecting-to-a-provider.md)。不需要把 Illustrator 添加到聊天里。

1. 用聊天里的滑块按钮打开 **Chat Settings**，展开 **Gallery**(图库)。
2. 点击 **Background**。生成期间按钮显示 **Generating...**，Gallery 里会显示“Illustrator is generating a background image for this scene.”
3. 等它完成。新图片会加进背景图库，并应用到当前场景。

手动生成优先用 Illustrator 智能体的图像账号，其次用你的默认图像生成账号。它在 Roleplay 和 Game Mode(游戏模式) 里可用，Conversation(对话模式) 里不可用。

如果没有成功：出现“Choose an image generation connection for the Illustrator agent, or mark one as the default image connection.”这条消息，说明 Marinara 找不到图像账号。设置一个之后再试。如果没有 **Background** 按钮，说明还没安装 Illustrator。

## 背景图库与模糊

可选的这些图片就放在同一个 **Backgrounds** 部分。导入、标签、改名、删除、**Background Blur**(背景模糊) 滑块，以及新建 Roleplay 聊天的默认背景，都在[聊天背景](../appearance/chat-backgrounds.md)里讲。

## 相关指南

- [聊天背景](../appearance/chat-backgrounds.md)：上传图库和外观控件。
- [场景背景](../media/scene-backgrounds.md)：从 Gallery 生成的 AI 场景画。
- [Roleplay 模式：入门](getting-started.md)：Roleplay 舞台、立绘和 HUD。
