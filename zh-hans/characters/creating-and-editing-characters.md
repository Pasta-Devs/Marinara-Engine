# 创建和编辑角色

本指南介绍如何在 Marinara Engine 里做出一个角色，以及如何用 Character Editor(角色编辑器) 撰写、保存和管理角色卡的各个版本。内容涵盖 Metadata(元数据)、Card(卡片) 和 Advanced(高级) 三个选项卡，还有头像和已保存的版本历史。

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

如果改动还没保存就想离开，会出现一条提示：`You have unsaved changes. Close without saving?`，并给出 **Keep editing**(继续编辑)、**Discard & close**(放弃并关闭) 和 **Save & close**(保存并关闭) 三个选择。

编辑器分成若干选项卡。屏幕够宽时，选项卡竖排在左侧；屏幕较窄时，它们变成顶部一条可横向滚动的条。选项卡依次是 **Metadata**、**Card**、**Convo**(对话)、**Lorebook**(世界书)、**Sprites**(立绘)、**Gallery**(图库)、**Colors**(颜色)、**Stats**(属性) 和 **Advanced**。

本指南讲 **Metadata**、**Card**、**Advanced**，以及头像和版本历史。其余选项卡各有专门的指南：

- **Convo**：[Conversation Mode 个人资料](../conversation/profiles.md)。
- **Lorebook**：[把世界书关联到角色](../lorebooks/linking-to-characters.md)。
- **Sprites**：[角色立绘](sprites.md)。
- **Gallery**：[角色与用户角色图库](galleries.md)。
- **Colors** 和 **Stats**：[角色颜色与 RPG 属性](colors-and-stats.md)。

## Metadata 选项卡

**Metadata** 选项卡放的是身份和整理用的信息。它们方便排序、分享和追踪一张角色卡，但大部分并不会发给 AI。

- **Character ID**。只读值，角色卡保存之后才会显示。点击 **Copy**(复制) 可以复制。
- **Name**(名字)。显示用的名字，在提示词（Marinara Engine 发给 AI 的那段文字）里以 `{{char}}` 的形式使用。
- **Phonetic name**(读音名)。可选的拼写方式，只用来纠正语音合成的发音。留空就按正常名字念。
- **Creator**(作者)。角色卡的作者，分享时用来署名。
- **Version**(版本)。自己设定的版本号，比如 `1.0`。
- **Talkativeness**(发言频率)。0 到 100 的百分比滑块，决定这个角色在群聊里发言的频繁程度，默认 50%。
- **Tags**(标签)。在添加标签的输入框里输入一个或多个标签，按 Enter 或点击 **Add**(添加)。用逗号分隔可以一次添加多个。点标签上的 X 删除单个标签，点 **Remove All**(全部清空) 一次清掉所有标签。
- **Creator Notes**(创作者备注)。私人备注，永远不会发给 AI，但会作为摘要显示在角色库里。

**Version history**(版本历史) 面板也在这个选项卡上，具体说明见下面的“保存与版本历史”一节。

## Card 选项卡

**Card** 选项卡是主要的写作工作区，放着 AI 用来扮演这个角色的各个字段。顶部的跳转链接可以直接跳到任意一节，每个输入框都有实时的字数统计。

- **Description**(描述)。角色的整体身份和定位。每次的提示词里都会带上。
- **Personality**(性格)。性情、说话习惯和行为模式的简短摘要。
- **Backstory**(背景故事)。经历、出身和重要的人际关系。
- **Appearance**(外观)。外貌、衣着和视觉细节。Marinara 也会用这段文字来生成 AI 头像的提示词。
- **Scenario**(场景设定)。和这个角色开新聊天时的默认设定。

**Dialogue & Greetings**(对白与开场白) 一节决定聊天怎么开场、角色说话是什么调子：

- **First Message**(首条消息)。新聊天开始时显示的首条消息。
- **Alternate Greetings**(备选开场白)。额外的开场白。开新聊天时可以挑一条用。用上下按钮调整顺序，用 X 删除。
- **Example Dialogue**(对话示例)。示范角色语气的对话样例。用 `<START>` 分隔每段对话，用 `{{user}}` 和 `{{char}}` 作为占位文字。

问候语和示例消息也可以展示角色 Gallery 中的图片，参见[角色图库 → 在消息和问候语中复用图库图片](galleries.md#reuse-a-gallery-image-in-messages-and-greetings)。

一段简短的 Example Dialogue 长这样：

```
<START>
{{user}}: Hello!
{{char}}: *waves excitedly* Hey there!
```

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
4. 检查或修改 **Avatar Prompt**(头像提示词)。它会用 Appearance 里的文字预先填好。Appearance 为空时改用 Description，再空则用 Personality。
5. 如果角色卡已经有头像，可以勾选 **Use current avatar as a reference**。
6. 点击 **Generate**。想再试一次就点 **Regenerate**(重新生成)。
7. 对结果满意后，点击 **Use Avatar**。

图片尺寸取自图像生成设置里的 **Portraits** 尺寸选项，默认是 1024 × 1024。如果开启了 **Expose media prompts before sending**，每次请求前都会多出一步提示词确认。

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
- [角色立绘](sprites.md)
- [角色与用户角色图库](galleries.md)
- [导入和导出角色卡](import-export.md)
- [角色颜色与 RPG 属性](colors-and-stats.md)
- [Conversation Mode 个人资料](../conversation/profiles.md)
- [把世界书关联到角色](../lorebooks/linking-to-characters.md)
