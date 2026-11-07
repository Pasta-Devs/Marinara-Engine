# 创建和编辑角色

角色卡就是定义一个 AI 角色的文件：这个角色是谁、说话什么样、长什么样，以及和它的聊天怎么开始。角色卡在 Character Editor(角色编辑器) 里撰写。AI 每次回复都会读取角色卡的各个字段，所以写得越清楚、越具体，角色的表现就越稳定。

## 创建角色

1. 点击顶部导航栏里的 **Characters**(角色)。如果看不到它，先打开 **More**(更多)。
2. 点击 **New**(新建，加号图标)。**Create Character**(创建角色) 窗口会打开。
3. 在 **Name \*** 里输入名字。名字是必填项。
4. 点击圆形头像区域添加一张图片。这一步可以跳过。
5. 点击 **Create**(创建)。

角色卡会以空白字段的状态保存下来，随后 Character Editor 会打开。

6. 打开 **Card**(卡片) 选项卡，写好 **Description**(描述)：这个角色是谁。在 **Dialogue & Greetings**(对白与开场白) 下添加一条 **First Message**(首条消息)，Roleplay(角色扮演) 聊天就从它开场。
7. 点击标题栏里的 **Save**(保存)。

如果手上已经有角色卡文件，就改点 **Import**(导入)。参见[导入和导出角色卡](import-export.md)。

### 和你的角色开始聊天

开始聊天时选中这个角色即可。参见 [Roleplay 模式：入门](../roleplay/getting-started.md)或 [Conversation 模式：入门](../conversation/getting-started.md)。

## Character Editor 总览

Character Editor 会把聊天区域换成一整页的工作区。屏幕够宽时，选项卡竖排在左侧；屏幕较窄时，它们会变成顶部一条可横向滚动的条。选项卡依次是 **Metadata**(元数据)、**Card**、**Onboarding**(交互式引导)、**Convo**(对话)、**Lorebook**(世界书)、**Sprites**(立绘)、**Gallery**(图库)、**Colors**(颜色)、**Voice**(声音)、**Stats**(属性) 和 **Advanced**(高级)。每个选项卡都会跳到同一张长表单里对应的部分，所以也可以直接滚动浏览。

标题栏里放着最常用的部分：

- **Back**(返回) 箭头、头像方块、名字输入框，以及标题或备注输入框，用来写一个简短的标记，比如 `Modern AU version`。下面一行显示作者和版本。
- **Save**。改动之前这个按钮不可用。保存过程中，它会显示 **Uploading…**(正在上传头像)、**Embedding…**(正在把世界书加入角色卡) 或 **Saving…**。
- **Favorite**(收藏) 星标。
- **Export character**(导出角色)。参见[导入和导出角色卡](import-export.md)。
- **Import character as persona**(导入为用户角色)，把这张角色卡复制成一个新的用户角色。参见[用户角色](personas.md)。
- **Duplicate character**(复制角色)。
- **Delete character**(删除角色)。

离开编辑器时会先保存改动。如果保存失败，编辑器会保持打开并保留草稿，方便你重试。

有专门指南的选项卡：

| 选项卡 | 指南 |
| --- | --- |
| **Onboarding** | [交互式引导](interactive-onboarding.md) |
| **Convo** | [Conversation Mode 个人资料](../conversation/profiles.md) |
| **Lorebook** | [把世界书关联到角色](../lorebooks/linking-to-characters.md) |
| **Sprites** | [角色立绘](sprites.md) |
| **Gallery** | [角色与用户角色图库](galleries.md) |
| **Colors** 和 **Stats** | [角色颜色与角色扮演属性](colors-and-stats.md) |

下面几节讲 **Metadata**、**Card**、**Voice** 和 **Advanced**，以及头像和版本历史。

<a id="metadata-tab"></a>

## Metadata 选项卡

**Metadata** 选项卡放的是身份和整理用的信息。它们方便排序、分享和追踪一张角色卡，大部分不会发给 AI。

- **Character ID**。只读，角色卡保存之后才会显示。点击 **Copy**(复制) 可以复制它。
- **Name**(名字)。显示用的名字。在提示词里它是 `{{char}}`，这是一个占位符，Marinara 会把它替换成角色的名字。
- **Creator**(作者)。角色卡的作者，分享时用来署名。
- **Version**(版本)。自己设定的版本号，比如 `1.0`。旁边的 **Automatic versioning**(自动版本管理) 开关会在角色卡改动时保留之前的版本，并调高这个数字。只有这个开关开着时，版本历史才会保存快照。
- **Talkativeness**(发言频率)。0 到 100% 的滑块，决定这个角色在群聊里发言的频繁程度。默认是 50%。
- **Tags**(标签)。在添加标签的输入框里输入标签，按 <kbd>Enter</kbd> 或点击 **Add**(添加)。多个标签用逗号分隔。输入框会推荐角色库里已经在用的标签，用得最多的排在最前。点标签上的 X 删除单个标签，点 **Remove All**(全部清空) 删掉全部标签。
- **Creator Notes**(创作者备注)。私人备注，永远不会发给 AI。

**Split description into fields**(把描述拆分到各字段) 是 **Version** 下方的一个按钮。它会把带标签的文字（性格、外观、背景故事、场景、规则、对话示例）从 **Description** 移到各自的字段里。你会先看到一份简短的摘要，应用之后，角色卡会保存为一个新版本。**Description** 为空时这个按钮不可用。

**Version history**(版本历史) 面板也在这个选项卡上。参见[版本历史](#version-history)。

<a id="card-tab"></a>

## Card 选项卡

**Card** 选项卡是主要的写作区域。顶部的跳转链接可以直达各个分区，每个字段都有实时字符计数。

| 字段 | 写什么 | 是否发给 AI |
| --- | --- | --- |
| **Summary**(摘要) | 用于角色库和角色卡预览的简短概述。 | 否 |
| **Description** | 角色的整体身份和定位。 | 每条提示词都会带上 |
| **Personality**(性格) | 性情、说话习惯、行为模式。 | 是 |
| **Backstory**(背景故事) | 经历、出身、重要的人际关系。 | 是 |
| **Appearance**(外观) | 外貌、衣着、视觉细节。也会作为 AI 头像提示词的起点。 | 是 |
| **Scenario**(场景设定) | 和这个角色开新聊天时的默认设定。 | 是 |

**Image Appearance Override**(图像专用外貌) 位于 **Appearance** 下方，默认关闭。打开后会显示第二个输入框，用来填写简短的图像标签，例如 LoRA 触发词（一个能开启自定义图像风格的关键词）。开关打开且输入框有内容时，图像提示词会原样使用这些标签，**Appearance** 则作为背景信息保留。AI 头像提示词也会以它为起点。旁白始终会看到 **Appearance** 的完整内容。

**Dialogue & Greetings** 一节决定聊天怎么开场、角色说话是什么调子：

- **First Message**。新的 Roleplay 聊天的开场消息。Conversation(对话模式) 和 Game(游戏模式) 聊天开始时没有开场白。
- **Alternate Greetings**(备选开场白)。额外的开场消息。开新的 Roleplay 聊天时，可以挑用哪一条。用上下控件调整顺序，用 X 删除一条。
- **Example Dialogue**(对话示例)。示范角色语气的对话样例。用 `<START>` 分隔每段对话，用 `{{user}}` 和 `{{char}}` 作为占位符。

```text
<START>
{{user}}: Hello!
{{char}}: *waves excitedly* Hey there!
```

开场白和示例消息可以显示角色 Gallery 里的图片。参见[在消息和开场白中复用图库图片](galleries.md#reuse-a-gallery-image-in-messages-and-greetings)。开场白里显示的是其他网站的图片时，**Save images locally**(保存图片到本地) 会在 Gallery 里存一份副本。参见[保存开场白中的网络图片](galleries.md#save-web-images-from-greetings)。

<a id="write-a-card-field-with-the-wand"></a>

### 用魔杖撰写角色卡字段

**Summary**、**Description**、**Personality**、**Backstory**、**Appearance**、**Scenario**、**Example Dialogue**、**First Message** 和每个 **Alternate Greeting** 的上方都有一个只显示魔杖图标的按钮。它的悬停提示会写明它生成哪个字段。

开始之前：先配置好一个可用的文本连接。参见[连接 AI 服务商](../connections/connecting-to-a-provider.md)。

1. 在字段里写下想保留的想法，例如 `smart, scientist, handsome`，也可以留空。
2. 填好希望 AI 参考的其他角色卡字段。不必先保存。
3. 点击该字段的魔杖。Marinara 会以你的文字为起点，为这个字段请求 100–300 个单词的内容。Example Dialogue 请求的是示例对话。**First Message** 和每个 **Alternate Greeting** 请求的是一条开场消息，不替你决定怎么回应。
4. 编辑结果，然后点击 **Save**。

魔杖使用你的默认智能体文本连接；没有的话，就用默认文本连接。配置好的智能体备用连接仍然适用。

魔杖只替换未保存草稿里选定的那个字段。生成失败时，原有文字会保留。如果等待期间你修改了这个字段，或者切换到了其他角色卡，迟到的结果不会覆盖你的内容。不需要 Professor Mari 也能使用魔杖。

## 添加头像

头像是角色在聊天里和角色库里显示的那张图片。

### 上传图片

1. 点击编辑器标题栏里的头像方块。
2. 选一个图片文件。新图片会立刻显示出来。

角色有了头像之后，**Metadata** 选项卡上会出现头像裁剪工具。用它可以在圆形框里移动或缩放图片，也可以移除头像。

### 用 AI 生成头像

开始之前：添加一个图像生成连接。只有配置了图像生成连接，AI 头像按钮才会出现。参见[连接 AI 服务商](../connections/connecting-to-a-provider.md)。

1. 把鼠标移到头像方块上，点击魔杖按钮。**Generate Character Avatar**(生成角色头像) 窗口会打开。
2. 选择一个 **Image Generation Connection**(图像生成连接)。
3. 检查或修改 **Avatar Prompt**(头像提示词)。**Image Appearance Override** 打开且填有内容时，就以它为起点。否则依次使用 **Appearance**、**Description**、**Personality**，取第一个有内容的字段。
4. 如果角色卡已经有头像，可以勾选 **Use current avatar as a reference**(用当前头像作参考)。
5. 点击 **Generate**(生成)。想再试一次就点 **Regenerate**(重新生成)。
6. 对结果满意后，点击 **Use Avatar**(使用头像)。

图片尺寸取自图像生成设置里的 **Portraits**(肖像) 图片尺寸，默认是 1024 × 1024。如果开启了 **Expose media prompts before sending**(发送前显示媒体提示词)，每次请求前都会多出一步提示词审阅。

## Voice 选项卡

**Voice** 选项卡设置 Text to Speech(语音合成) 朗读这个角色时的声音。

- **Voice**。这个角色用的声音。改动会立刻保存，不需要点 **Save**。它和 **Connections → Text to Speech**(连接 → 语音合成) 里这个角色那一行是同一项设置。留空则使用默认声音。如果某张名字匹配的角色卡设置了声音（比如某个 AU 副本对应的原版卡），这个字段留空时会显示那个声音，因为这张卡也会用它。
- **Preview**(试听)。用这个声音播放一句简短的台词。台词会说出角色的名字，设置了 **Phonetic name**(读音名) 的话就改用它。
- **Phonetic name**。可选的拼写，只用来纠正发音。它属于角色卡本身，所以要点击 **Save** 才能保留。

如果 Text to Speech 没有开启，或者所有角色共用一个声音，**Voice** 字段的位置会换成一段简短的说明。所有角色共用一个声音时，说明里会提供 **Use a voice per character**(为每个角色单独配声)。**Open Text to Speech settings**(打开语音合成设置) 会打开 Connections。参见 [Text to Speech (TTS) 设置](../media/tts-setup.md)。

## Advanced 选项卡

**Advanced** 选项卡放的是提示词控制项。普通角色可以全部留空。它们在 Conversation、Roleplay 和 Game 三种模式下都会生效。Conversation 或 Game 预设会改变外围的提示词，但不会让角色的 Post-History Instructions 或 Depth Prompt 失效。

- **System Prompt**(系统提示词)。针对这个角色的指令，会通过当前预设的角色块、Conversation 的角色上下文或 Game 的角色卡加进去。它不会替换聊天本身的主系统提示词。
- **Post-History Instructions**(历史之后的指令)。放在聊天历史之后、紧挨 AI 开始写之前的文字，比如“Stay in character”。
- **Depth Prompt**(深度提示词)。注入到聊天历史里的文字。**Depth**(深度) 是往回数多少条消息：0 是紧跟在最新一条消息之后。默认是 4。**Role**(消息角色) 可选 **System**、**User** 或 **Assistant**。默认是 System。

**Regex Scripts**(正则脚本) 一节放的是只对这一个角色生效的查找替换脚本。参见[正则脚本](../extending/regex-scripts.md)。

<a id="use-an-alternative-field-in-selected-chats"></a>

## 在选定聊天中使用替代字段

替代字段能让同一个角色在选定的聊天里使用不同的描述、外观、背景故事或其他细节，其他聊天则继续使用原样。七个角色卡字段下方各有 **Add Alternative Field**(添加替代字段)。

1. 在想调整的字段下方点击 **Add Alternative Field**。Marinara 会把这个字段的文字复制到新建的替代字段里。
2. 编辑替代字段。它有自己的魔杖，会以替代字段的文字为起点，不会改动原始字段。
3. 打开 **Active in 0 chats**(在 0 个聊天中启用)，勾选要使用它的聊天。列表只显示包含这个角色的聊天。
4. 点击 **Save**。

规则：

- 每个聊天的同一个字段只能用一个替代版本。在另一个替代版本里勾选某个聊天，会把它移到那边。
- 一个聊天都不勾选时，替代字段会保持停用，留待以后使用。
- 留空的替代字段会清空它所在聊天里的对应字段。
- 聊天专属的场景和图像外貌覆盖设置仍然优先。
- **Summary** 的替代版本仍是元数据，不会发给 AI。
- 角色离开某个聊天时，它的分配会暂停；重新添加这个角色后会恢复。
- 角色卡导出、导入、复制，以及角色与用户角色之间的转换，会保留替代文字，但清除聊天勾选。整份档案的备份会保留这些勾选。

要删除替代字段，点击它的垃圾桶按钮，确认 **Delete**(删除)，然后点 **Save**。它的聊天会重新使用原始字段。删除替代字段绝不会删除原始字段。

<a id="version-history"></a>

## 版本历史

**Automatic versioning** 开着时，每次保存都可能往 **Metadata** 选项卡上的 **Version history** 里加一份快照。在那之前，面板上写着 `Previous card states will appear here after the next edit.` 旁边有个计数，显示已经保存了多少份快照。

把某个已保存的版本和当前角色卡对比：

1. 打开 **Metadata** 选项卡。
2. 在 **Version history** 里点击一个已保存的版本。对比窗口会把角色卡字段左右并排列出，并标出每一处有变化的字段。

回到旧版本：

1. 打开那个版本的对比窗口，或者点列表里它的恢复图标。
2. 点击 **Restore this version**(恢复这个版本)，然后确认。

Marinara 会先把当前角色卡存进版本历史（除非它已经和那个版本一致），方便你以后再切换回来。

面板里的其他控件：

- 铅笔图标可以修改某份快照的角色卡版本号，而不恢复它。
- 垃圾桶图标会删除一份快照。当前角色卡不受影响。
- **Reset**(重置) 会删除所有已保存的快照，并把角色卡版本设为 1.0。Marinara 会请你确认，而且无法撤销。有未保存的编辑时，**Reset** 不可用。

## 审阅智能体提出的角色卡改动

在 Roleplay 聊天里，一个可选的智能体可以根据场景，对角色卡字段提出小幅修改建议。这时会打开 **Review Character Card Updates**(审阅角色卡更新) 窗口，由你决定保留哪些。对每一条修改建议：

- **Approve**(批准) 会应用它，调高版本号，并添加一条版本历史记录。
- **Regenerate** 让智能体重新试一次。
- **Reject**(拒绝) 会丢弃它。

如果提出建议之后对应的文字又有了变化，应用会先警告你，再允许你强行应用这处修改。想开启或关闭这类智能体，参见[智能体：聊天里的 AI 帮手](../agents/agents-overview.md)。

## 如果没有成功

- **魔杖没反应或者失败了。** 检查是否有可用的文本连接。生成失败时，你的草稿绝不会被覆盖。
- **没有 AI 头像按钮。** 先添加一个图像生成连接。
- **Professor Mari 无法删除。** 她是内置角色，Marinara 每次启动都会重置她。参见 [Professor Mari，你的应用内助手](../home/professor-mari.md)。

## 相关指南

- [用户角色](personas.md)
- [导入和导出角色卡](import-export.md)
- [整理角色库](library-organization.md)
