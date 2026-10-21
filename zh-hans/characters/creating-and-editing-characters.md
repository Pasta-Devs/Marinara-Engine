# 创建和编辑角色

本指南介绍如何在 Marinara Engine 里做出一个角色，以及如何用 Character Editor(角色编辑器) 撰写、保存和管理角色卡的各个版本。内容涵盖 Metadata(元数据)、Card(卡片)、Voice(声音) 和 Advanced(高级) 四个选项卡，还有头像和已保存的版本历史。

## 什么是角色卡

角色卡就是定义一个 AI 角色的文件，里面写着这个角色是谁、说话什么样、长什么样，以及和它的聊天从哪里开始。这些细节都在 Character Editor 里填写。角色卡可以从零开始做，可以从别的应用导入，也可以导出分享给别人。

要写的内容大多集中在几个文本框里。AI 每次回复都会读这几个框，所以写得越清楚、越具体，角色的表现就越稳定。

## 创建角色

1. 从侧边栏打开 **Characters**(角色) 面板。
2. 点击 **New**(新建，加号图标)，打开 **Create Character**(创建角色) 窗口。
3. 点击圆形头像区域上传一张图片。这一步可以跳过。
4. 在 **Name \*** 输入框里填写名字。名字是必填项。
5. 点击 **Create**。

新角色卡会以空白字段的状态保存下来，随后完整的 Character Editor 会打开，剩下的内容在这里填。如果手上已经有角色卡文件，也可以用 **Import**(导入) 代替 **New** 起步。参见[导入和导出角色卡](import-export.md)。

## Character Editor 总览

Character Editor 会把聊天区域换成一整页的工作区，顶部横贯的标题栏里放着最常用的部分。

左上角依次是 **Back**(返回) 返回箭头、头像方块、名字输入框，以及标题或备注输入框。备注输入框用来写一个简短的标记，比如 `Modern AU version`。下面一行小字显示作者和版本。

右上角是这几个按钮：

- **Save**(保存)。改动之前这个按钮是灰的。它的文字会显示当前状态：**Uploading…**、**Embedding…** 或 **Saving…**。
- **Favorite**(收藏) 星标，把角色卡标记为收藏。
- **Export character**(导出角色)。
- **Import character as persona**(导入为用户角色)，把这张角色卡复制成一个新的用户角色。
- **Duplicate character**(复制角色)。
- **Delete character**(删除角色)。

离开编辑器时，会先保存已修改的角色卡，再切换页面。如果保存失败，编辑器会保持打开并保留草稿，方便你重试。

编辑器分成若干选项卡。屏幕够宽时，选项卡竖排在左侧；屏幕较窄时，它们变成顶部一条可横向滚动的条。选项卡依次是 **Metadata**、**Card**、**Onboarding**(交互式引导)、**Convo**(对话)、**Lorebook**(世界书)、**Sprites**(立绘)、**Gallery**(图库)、**Colors**(颜色)、**Voice**、**Stats**(属性) 和 **Advanced**。

本指南讲 **Metadata**、**Card**、**Voice**、**Advanced**，以及头像和版本历史。其余选项卡各有专门的指南：

- **Onboarding**：[交互式引导](interactive-onboarding.md)。
- **Convo**：[Conversation Mode 个人资料](../conversation/profiles.md)。
- **Lorebook**：[把世界书关联到角色](../lorebooks/linking-to-characters.md)。
- **Sprites**：[角色立绘](sprites.md)。
- **Gallery**：[角色与用户角色图库](galleries.md)。
- **Colors** 和 **Stats**：[角色颜色与 RPG 属性](colors-and-stats.md)。

## Metadata 选项卡

**Metadata** 选项卡放的是身份和整理用的信息。它们方便排序、分享和追踪一张角色卡，但大部分并不会发给 AI。

- **Character ID**。只读值，角色卡保存之后才会显示。点击 **Copy**(复制) 可以复制。
- **Name**(名字)。显示用的名字，在提示词（Marinara Engine 发给 AI 的那段文字）里以 `{{char}}` 的形式使用。
- **Creator**(作者)。角色卡的作者，分享时用来署名。
- **Version**(版本)。自己设定的版本号，比如 `1.0`。
- **Talkativeness**(发言频率)。0 到 100 的百分比滑块，决定这个角色在群聊里发言的频繁程度，默认 50%。
- **Tags**(标签)。在添加标签的输入框里输入一个或多个标签，按 Enter 或点击 **Add**(添加)。用逗号分隔可以一次添加多个。输入框还会推荐你的角色库里已经在用的标签，按使用次数从多到少排列，并显示每个标签有多少个角色在用。继续输入会缩小列表。点击某条推荐，或者用方向键选中后按 Enter 即可。点标签上的 X 删除单个标签，点 **Remove All**(全部清空) 一次清掉所有标签。
- **Creator Notes**(创作者备注)。私人备注，永远不会发给 AI，但会作为摘要显示在角色库里。

**Version history**(版本历史) 面板也在这个选项卡上，具体说明见下面的“保存与版本历史”一节。

## Card 选项卡

**Card** 选项卡是主要的写作区域。顶部的跳转链接可以直达各个分区，每个字段都有实时字符计数。

- **Summary**(摘要)：用于角色库和角色卡预览的概述。它属于元数据，不会随聊天提示词发送给模型。
- **Description**(描述)。角色的整体身份和定位。每次的提示词里都会带上。
- **Personality**(性格)。性情、说话习惯和行为模式的简短摘要。
- **Backstory**(背景故事)。经历、出身和重要的人际关系。
- **Appearance**(外观)。外貌、衣着和视觉细节。Marinara 也会用这段文字来生成 AI 头像的提示词。
- **Image Appearance Override**(图像专用外貌)。位于 **Appearance** 下方，是一个可选开关，默认关闭。打开后会显示第二个输入框，用来填写描述这个角色的简短图像标签，例如 LoRA 触发词。开关打开且输入框有内容时，图像提示词会原样使用这些标签，**Appearance** 则作为背景信息保留，AI 头像的提示词也会以它为基础。负责写旁白的模型始终会收到 **Appearance** 的完整内容。保持关闭即可维持通常的行为。
- **Scenario**(场景设定)。和这个角色开新聊天时的默认设定。

**Dialogue & Greetings**(对白与开场白) 一节决定聊天怎么开场、角色说话是什么调子：

- **First Message**(首条消息)。新的 Roleplay(角色扮演) 聊天开始时显示的首条消息。Conversation(对话模式) 和 Game(游戏模式) 聊天开始时没有开场白。
- **Alternate Greetings**(备选开场白)。额外的开场白。开新的 Roleplay 聊天时可以挑一条用。用上下按钮调整顺序，用 X 删除。
- **Example Dialogue**(对话示例)。示范角色语气的对话样例。用 `<START>` 分隔每段对话，用 `{{user}}` 和 `{{char}}` 作为占位文字。

问候语和示例消息也可以展示角色 Gallery 中的图片，参见[角色图库 → 在消息和问候语中复用图库图片](galleries.md#reuse-a-gallery-image-in-messages-and-greetings)。

开场白里显示的是其他网站的图片时，**Save images locally**(保存图片到本地) 可以把这些图片的副本存进角色 Gallery，参见[角色图库 → 保存开场白中的网络图片](galleries.md#save-web-images-from-greetings)。

一段简短的 Example Dialogue 长这样：

```
<START>
{{user}}: Hello!
{{char}}: *waves excitedly* Hey there!
```

### 用魔杖生成角色卡字段

**Summary**、**Description**、**Personality**、**Backstory**、**Appearance**、**Scenario**、**Example Dialogue**、**First Message** 和每个 **Alternate Greeting** 字段上方都有一个仅显示魔杖图标的按钮。悬停提示和无障碍名称会说明按钮生成哪个字段。

1. 在字段里写下想保留的想法，例如 `smart, scientist, handsome`，也可以留空。
2. 填写希望 AI 参考的其他角色卡字段，不必先保存这些修改。
3. 点击该字段的魔杖。Marinara 会要求生成该部分的 100–300 个单词，以现有文字为起点，并参考其他角色卡字段。**Example Dialogue** 会请求示例对话。**First Message** 和 **Alternate Greeting** 各请求一条 Roleplay 开场消息，不替你决定如何回应。
4. 检查并编辑结果，然后点击 **Save** 保存。

魔杖与原来的摘要生成器使用相同的连接选择方式：优先使用默认智能体文本连接，必要时回退到默认文本连接。配置的智能体备用连接仍然适用。生成前请先配置可用的文本连接，见[连接 AI 服务商](../connections/connecting-to-a-provider.md)。

生成只替换编辑器未保存草稿中选定的字段。魔杖本身不会保存角色卡，也不会改动其他字段；离开编辑器时，仍会按正常方式保存。如果生成失败，原有文字会保留。如果等待期间修改了目标字段，或切换到其他角色卡，迟到的结果不会覆盖新内容。移动备选问候语后，生成仍绑定在那条问候语上；删除它会丢弃尚未返回的结果。不打开 Professor Mari 也能使用魔杖。

### 在选定聊天中使用替代字段

7 个角色卡字段下方各有 **+ Add Alternative Field**(添加替代字段)。你可以让同一个角色在特定聊天中使用不同的描述、外貌、背景故事或其他细节，同时让其他聊天继续使用原始角色卡。

1. 点击要调整的字段下方的 **+ Add Alternative Field**。Marinara 会把当前文字复制到新建的替代字段中。
2. 编辑替代字段，或使用它自己的魔杖。该魔杖以替代字段的文字为起点，参考其他角色卡字段，不会替换原始字段。
3. 打开 **Active in 0 chats**(在 0 个聊天中启用)，选择任意数量的聊天。列表只显示包含该角色的聊天。在其他聊天中添加或移除该角色后，重新打开选择器即可刷新列表。
4. 点击 **Save** 应用替代字段。离开编辑器时的正常保存方式也适用。

替代字段的数量不限。一个聊天都不选时，该替代字段会保持停用，留待以后使用。留空的替代字段会有意清空选定聊天中的对应字段。每个聊天的同一个字段只能使用一个替代版本：在另一替代版本中选中该聊天，会把分配关系移到那里。其他字段和其他聊天保留原值。已有的聊天专属场景和图像外貌覆盖设置仍然优先。

**Summary** 的替代版本仍是元数据，不会把摘要文字加到模型的聊天提示词中。

**Active in** 计数只包含当前使用该角色的聊天。从聊天中移除角色后，已保存的分配会暂停；重新添加后会恢复。聊天列表正在加载或暂时不可用时，不会删除分配关系；重新打开选择器即可刷新选项。

角色卡导出、导入、复制以及角色与用户角色之间的转换，会保留替代文字，但清除聊天选择。整个资料的备份会保留这些选择。

要删除替代字段，点击它的垃圾桶按钮并确认 **Delete**(删除)。取消则保留。保存角色卡后，删除才会生效；原先选定的聊天会重新使用原始字段，同时仍遵循已有的聊天覆盖设置。删除替代字段绝不会删除原始字段。

## 添加头像

头像是角色在聊天里和角色库里显示的那张图片。可以自己上传，可以调整取景，也可以让 AI 生成。

### 上传图片

1. 点击编辑器标题栏里的头像方块。
2. 选一个图片文件，新图片会立刻显示出来。

角色有了头像之后，**Metadata** 选项卡上会出现头像裁剪工具。用它可以在圆形框里重新调整位置和缩放，不必重新上传文件。这个工具里还有一个移除头像的控件。

### 用 AI 生成头像

只有在至少配置了一个图像生成连接时，AI 头像这个选项才会出现。参见[连接 AI 服务商](../connections/connecting-to-a-provider.md)。

1. 把鼠标移到头像方块上，点击那个小小的 **Generate avatar**(生成头像) 魔杖按钮。
2. **Generate Character Avatar** 窗口打开。
3. 选择一个 **Image Generation Connection**(图像生成连接)。
4. 检查或修改 **Avatar Prompt**(头像提示词)。如果 **Image Appearance Override** 已打开且填有内容，就会用这段文字预先填好。否则依次使用 **Appearance**、**Description**、**Personality**，取第一个有内容的字段。
5. 如果角色卡已经有头像，可以勾选 **Use current avatar as a reference**。
6. 点击 **Generate**。想再试一次就点 **Regenerate**(重新生成)。
7. 对结果满意后，点击 **Use Avatar**。

图片尺寸取自图像生成设置里的 **Portraits** 尺寸选项，默认是 1024 × 1024。如果开启了 **Expose media prompts before sending**，每次请求前都会多出一步提示词确认。

## Voice 选项卡

**Voice** 选项卡设置 Text to Speech(语音合成) 朗读这个角色时用的声音。

- **Voice**。Text to Speech 给这个角色用的声音。改动会立刻保存，不需要点 **Save**。它和 **Connections → Text to Speech**(连接 → 语音合成) 里这个角色的那一行是同一项设置，所以两边始终一致。留空则使用默认声音。如果某张名字匹配的角色卡设置了声音（比如某个 AU 副本对应的原版卡），这个字段留空时会显示那个声音，因为这张卡也会用它。
- **Preview**(试听)。用这个声音播放一句简短的台词。台词会说出角色的名字，设置了 Phonetic name(读音名) 的话就改用它，方便你听听实际效果。
- **Phonetic name**。可选的拼写方式，只用来纠正语音合成的发音。留空就按正常名字念。和声音设置不同，它属于角色卡本身，所以要点击 **Save** 才能保留。

如果 Text to Speech 没有开启，或者所有角色共用一个声音，**Voice** 字段的位置会换成一段简短的说明。所有角色共用一个声音时，说明里会提供 **Use a voice per character**(为每个角色单独配声) 按钮。**Open Text to Speech settings**(打开语音合成设置) 会打开 Connections，那里的 **Text to Speech** 卡片包含全部相关设置。参见 [Text to Speech (TTS) 设置](../media/tts-setup.md)。

## Advanced 选项卡

**Advanced** 选项卡放的是给进阶用法准备的提示词控制项。普通角色可以全部留空。

这些由角色卡自带的提示词控制项在 Conversation、Roleplay 和 Game 三种模式下都会生效。选用某个 Conversation 或 Game 预设会改变外围的提示词，但不会让角色的 Post-History Instructions 或 Depth Prompt 失效。

- **System Prompt**(系统提示词)。针对该角色的指令，会视情况通过当前预设的角色块、Conversation 的角色上下文，或者 Game 的角色/GM 卡加进去。它不会替换聊天本身的主系统提示词。
- **Post-History Instructions**(历史之后的指令)。放在提示词末尾、紧挨生成位置的文字。常见用法是加一句简短提醒，比如“Stay in character”。
- **Depth Prompt**(深度提示词)。注入到聊天历史中某个指定位置的文字。**Depth**(深度) 决定往回数多少条消息：深度 0 是紧跟在最新一条消息之后，深度 4 则是往回四条，默认深度为 4。**Role**(消息角色) 决定这段文字以 **System**、**User** 还是 **Assistant** 的身份插入，默认是 System。

这个选项卡上的 **Regex Scripts**(正则脚本) 一节放的是只对这一个角色生效的查找替换脚本，它们用的是共用的正则引擎。想了解工作原理，参见[正则脚本](../extending/regex-scripts.md)。

## 保存与版本历史

点击标题栏里的 **Save** 保存改动。没有改动时按钮是灰的，一旦编辑过就会亮起。

每次保存都可能往 **Version history** 里加一份快照，这个面板在 **Metadata** 选项卡上。在第一次追加编辑之前，面板显示的是 `Previous card states will appear here after the next edit.`。旁边有个计数显示已经保存了多少份快照。

把某个已保存版本和当前角色卡对比：

1. 打开 **Metadata** 选项卡。
2. 在 **Version history** 里点击一个已保存的版本。
3. **Compare**(对比) 窗口打开，把 Name、Description、Personality、Scenario、First Message、Example Dialogue 等字段左右并排列出，并标出每一处有变化的字段。

回退到旧版本：

1. 打开目标版本的 **Compare** 窗口，或者直接点列表里它的恢复图标。
2. 点击 **Restore this version**，然后确认。

恢复会用那份快照替换当前的角色卡，并且不会新增历史记录。铅笔图标可以在不恢复的前提下修改某份快照的版本标签。列表里的快照也可以删除，删除快照不影响当前的角色卡。

想重新开始给角色卡编版本号时，用 **Version history** 标题栏里的 **Reset**(重置)。确认之后，Marinara 会删掉所有已保存的快照，并把当前角色卡版本设为 `0.0`。此操作无法撤销。

## 审阅智能体提出的角色卡改动

在 Roleplay 聊天过程中，有一个可选的智能体会根据场景里发生的事，对角色卡字段提出小幅修改建议。这时会弹出 **Review Character Card Updates**(审阅角色卡更新) 窗口，主动权始终在你手里，保留哪些改动由你决定。

对每一条修改建议可以：

- **Approve**(批准)。应用这处改动，同时递增版本号并添加一条版本历史记录。
- **Regenerate**。让智能体重新想一个。
- **Reject**(拒绝)。丢弃这条建议。

如果对应的原文在提出建议之后又发生了变化，应用会先给出警告，再允许强行应用这处修改。想知道怎么开启或关闭这类智能体，参见[智能体：聊天里的 AI 帮手](../agents/agents-overview.md)。

## 关于 Professor Mari

**Professor Mari** 是 Marinara 自带的内置助手角色，无法删除。试图删除时，应用会拦下操作并提示这是内置角色。想了解她能做什么，参见 [Professor Mari，你的应用内助手](../home/professor-mari.md)。

## 相关指南

- [用户角色：创建与编辑](personas.md)
- [交互式引导](interactive-onboarding.md)
- [角色立绘](sprites.md)
- [角色与用户角色图库](galleries.md)
- [导入和导出角色卡](import-export.md)
- [角色颜色与 RPG 属性](colors-and-stats.md)
- [Conversation Mode 个人资料](../conversation/profiles.md)
- [把世界书关联到角色](../lorebooks/linking-to-characters.md)
