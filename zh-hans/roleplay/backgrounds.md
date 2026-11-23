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

## 复用已有图片

Illustrator 自动生成背景、故事又来到新地点时，会先检查你是否已为该地点固定背景（见[为地点固定背景](#pin-a-background-to-a-place)）。已固定背景的地点不会再绘制图片。否则，它会查找背景图库。图片的文件名，或由两个及以上单词组成的某个标签，只要出现在 World State 的地点中，就能用于该地点。例如，`john-bedroom.png` 可用于“Smith House, John's bedroom”。匹配时不区分大小写、重音符号和“'s”，更具体的名称优先于普通的 `bedroom.png`。

没有 World State 地点时，会按同样的方式匹配 Illustrator 为新背景写出的地点名称。找到合适的图片就直接显示，不再绘制。只有找不到匹配图片的地点才会生成新图。

要让地点一直使用同一张图片，可以用地点给文件命名（如“Kitchen”对应 `kitchen.png`）。两个及以上单词的标签也可以，例如 `smith house kitchen`；`kitchen` 或 `night` 这样的单词标签会被忽略，因为它们通常只是在描述图片的样子。

## 手动生成背景

Marinara 会根据场景（题材、设定、地点、天气和时间）拼出一段图像提示词，生成一张新背景。

开始之前：安装 **Illustrator** 智能体并给它设置一个图像生成账号，或者把某个图像生成账号设为默认。见[连接 AI 服务商](../connections/connecting-to-a-provider.md)。不需要把 Illustrator 添加到聊天里。

1. 用聊天里的滑块按钮打开 **Chat Settings**，展开 **Gallery**(图库)。
2. 点击 **Background**。生成期间按钮显示 **Generating...**，Gallery 里会显示“Illustrator is generating a background image for this scene.”
3. 等它完成。新图片会加进背景图库，并应用到当前场景。

手动生成优先用 Illustrator 智能体的图像账号，其次用你的默认图像生成账号。它在 Roleplay 和 Game Mode(游戏模式) 里可用，Conversation(对话模式) 里不可用。

如果没有成功：出现“Choose an image generation connection for the Illustrator agent, or mark one as the default image connection.”这条消息，说明 Marinara 找不到图像账号。设置一个之后再试。如果没有 **Background** 按钮，说明还没安装 Illustrator。

<a id="pin-a-background-to-a-place"></a>

## 为地点固定背景

当故事里的某个地点应该始终保持同样外观时，就用这个功能：John 的卧室始终显示 `john-bedroom`，你自己的卧室始终显示 `my-bedroom`。故事来到已固定背景的地点时，无论 Background 智能体原本会选什么，都会显示为这里固定的图片。

1. 用聊天里的滑块按钮打开 **Chat Settings**，再打开 **Background**。
2. 在 **Pinned places**(固定背景的地点) 下点击 **Add place**(添加地点)。
3. 点击空白图片，选择背景。按故事里的写法输入地点，例如 `John's bedroom`。
4. 可选：在下面添加故事可能用到的其他名称，用逗号分隔，例如 `John's room, the master bedroom`。

更快的办法：故事正好在某个地点、显示的图片也合适时，点击 **Pin this picture to "John's bedroom"**(将这张图片固定到“John 的卧室”)。

如何区分地点：

- 最具体的名称优先。`John's bedroom` 和 `{{user}}'s bedroom` 不会混淆；普通的 `bedroom` 固定项只用于没有单独固定背景的卧室。
- 中间多一两个单词也能匹配：“John's guest bedroom”会匹配 `John's bedroom`，除非另一条固定项写的正是这个地点的完整名称。
- `{{user}}` 是用户角色的名字，`{{char}}` 是聊天中任意角色的名字，因此 `{{user}}'s bedroom` 会匹配“Alyssa's bedroom”。
- “My”和“our”指消息作者所属的地点。John 的回复说故事发生在“my bedroom”时，指的是 John 的卧室；他回复中的“your bedroom”指你的卧室。在你自己的消息里，聊天只有一个角色时，“your bedroom”指那个角色的卧室。
- 不区分大小写、重音符号和撇号。名称按完整单词匹配：`John` 不会匹配“Johnson”。
- 使用 **World Maps**(世界地图) 时，改从 **World Maps place**(世界地图地点) 列表中选择地点。给建筑固定背景后，其中没有单独固定背景的房间也会使用它。

具体行为：

- 到达地点时显示一次图片。停留期间如果手动选择了其他背景，会一直保留你的选择，直到故事离开。
- 在已固定背景的地点，Background 智能体不能切换图片，Illustrator 也不会为它绘制新背景。
- 需要 **World State** 智能体提供的地点（或 World Maps）。列表底部显示故事当前所在的位置，**Here**(此处) 标记正在使用的固定项。固定项适用于 Roleplay 聊天。

如果没有成功：检查列表下方的 **Story is at**(故事所在地点) 是否显示了该地点，以及其中是否包含固定项的某个名称。

### 跟随角色的背景

角色（或用户角色）的 **Gallery** 里标记为背景的图片，会出现在该角色参与的每个聊天中，不必在各个聊天里分别固定。

1. 打开角色的 **Gallery**，点击图片上的标签按钮，再选择 **Use as background**(用作背景)。
2. 输入图片对应的地点，用逗号分隔，例如 `{{char}}'s bedroom, {{char}}'s room`。在角色图库里，`{{char}}` 指该角色；在用户角色图库里，`{{user}}` 指该用户角色。如果图片不对应某个地点，就留空。

填写了地点的图片会在该角色参与的每个聊天中像固定项一样生效，并列在 **Chat Settings → Background**(聊天设置 → 背景) 的 **Pinned places** 下。名称相同时，聊天自身设置的固定项优先于图库图片。

## 背景图库与模糊

可选的这些图片就放在同一个 **Backgrounds** 部分。导入、标签、改名、删除、**Background Blur**(背景模糊) 滑块，以及新建 Roleplay 聊天的默认背景，都在[聊天背景](../appearance/chat-backgrounds.md)里讲。

## 相关指南

- [聊天背景](../appearance/chat-backgrounds.md)：上传图库和外观控件。
- [场景背景](../media/scene-backgrounds.md)：从 Gallery 生成的 AI 场景画。
- [Roleplay 模式：入门](getting-started.md)：Roleplay 舞台、立绘和 HUD。
