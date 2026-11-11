# Roleplay 模式：入门

Roleplay(角色扮演) 是用来讲故事的聊天模式。它会在消息背后加上一块舞台（背景和角色立绘），还有一个显示故事细节的抬头显示（HUD）。智能体是跟着回复一起运行的帮手，比如追踪天气的智能体，或者挑选立绘的智能体。

想演一场故事，就选 Roleplay。想普通地发消息，选 [Conversation 模式](../conversation/getting-started.md)；想要带队伍、战斗和骰子的结构化游戏，选 [Game Mode](../game/getting-started.md)。不开图像生成时，Roleplay 就是纯文字聊天：立绘位留空，背景显示为纯色，HUD 照样追踪故事。

## 开始一段角色扮演

开始之前：在应用右侧的 **Connections**(连接) 面板里添加一个账号。见[连接 AI 服务商](../connections/connecting-to-a-provider.md)。

1. 在聊天侧边栏里点击 **RP** 选项卡。
2. 点击侧边栏顶部附近的 **+** 按钮，它的提示文字是 **New Roleplay**(新建 Roleplay 聊天)。

聊天打开后，会同时打开 **Chat Settings**(聊天设置) 和一个五步的设置向导。只有账号是必填的，其余一切之后都能改。

1. **Name & Connection**(名称与连接)。给这段角色扮演起个名字（可选），并选择由哪个连接来回复。
2. **Pick a Preset**(选择预设)。预设决定提示词的结构和生成参数。默认预设适合大多数聊天。
3. **Persona & Characters**(用户角色与角色)。选择你的用户角色和场景里的角色。在这一步里，一个名为 **Create your persona**(创建你的用户角色) 的按钮可以通过几个问题替你创建用户角色。见[交互式引导](../characters/interactive-onboarding.md)。
4. **Attach Lorebooks**(附加世界书)。世界书是一组世界设定，相关关键词出现时 AI 就会读到。可选。
5. **Enable Agents**(启用智能体)。选择这个聊天里要运行哪些智能体。之后可以在 **Chat Settings → Agents**(聊天设置 → 智能体) 里修改。

完成后，你会看到带消息框的聊天。输入第一条消息并发送。

## 舞台：背景、立绘和 HUD

- **Background**(背景)：铺在消息后面的整屏图像，切换时会淡入淡出。**Background** 智能体可以每回合挑一张，你也可以给每个聊天固定一张。见 [Roleplay 背景](backgrounds.md)。
- **Sprites**(立绘)：舞台上的角色图片。每个开启了立绘的角色都可以出现。角色卡上需要有立绘库，否则这个角色的立绘位就是空的。见[角色立绘](../characters/sprites.md)。
- **HUD**：你的追踪器（日期、时间、天气、位置、在场角色、物品、任务、属性）。在 **Chat Settings → Agents** 里开启。见 [Roleplay 的 HUD 与追踪器](hud-and-trackers.md)。

### 立绘显示控制

点聊天里的滑块按钮打开 **Chat Settings**，进入 **Agents**，找到 **Expression Engine** 卡片。这个智能体负责挑选立绘表情。至少有一个角色开启立绘之后，这些控件才会出现。

| 控件 | 作用 |
| --- | --- |
| **Sprite Source**(立绘来源) | 选择 **Expressions**、**Full-body**，或两者都选。至少要留一个开着。 |
| **Expression Size**、**Full-body Size** | 设置每种立绘的大小。 |
| **Expression Opacity**、**Full-body Opacity** | 设置每种立绘的透明程度。 |
| **Default Side**(默认站位) | **Left** 或 **Right**：新立绘一开始站在哪一边。 |
| **Expression Avatars**(表情头像) | 开启后，消息头像会使用角色当前的表情立绘。 |

这四个大小和透明度滑块只保存在当前浏览器里，不会同步到其他设备。

手动挪动立绘：

1. 点击舞台上的 **Arrange**(排列) 按钮，它会变成 **Done**(完成)。
2. 拖动立绘，再点它上方的小对勾确认。
3. 点 **Done** 结束。**Reset**(重置) 会清空所有自定义摆放。

想用输入的方式指定表情，发送 `/emote happy` 给整个场景设定表情，或发送 `/emote "Aria" angry` 只给一个角色设定。只发送 `/emote`，会列出每个角色可用的表情。

如果没有成功：角色需要上传过立绘库。没有立绘库，表情智能体照样在跑，只是没东西可显示。

## 聊天工具

聊天工具是 **Chat Settings** 里的各个区域：搜索、分支、摘要、活动上下文、Agent activity、Author's Notes 和 Gallery(图库)。用聊天里的滑块按钮打开它。每个区域的作用见[聊天设置](../chats/chat-settings.md)，弹出方法见[把区域弹出为独立窗口](../chats/chat-settings.md#popping-a-section-out-into-its-own-window)。

### Author's Notes

**Author's Notes**(作者注释) 是 AI 每次回复都会读到的一段笔记。它适合放长期有效的提醒，比如语气规则或者某个隐藏设定。

1. 打开 **Chat Settings**，展开 **Agents** 下方的 **Author's Notes**。
2. 写下笔记，例如：“把语气写得阴郁又悬疑。”
3. 拿不准的话，**Injection Depth**(注入深度) 保持原样就行。它决定笔记插在聊天里的哪个位置：0 表示放在最新一条消息之后，4 表示放在距末尾四条消息的位置。

笔记较长时，在电脑上拖动输入框的底角把它拉大。Author's Notes 在 Game Mode 和 Conversation 模式里的用法完全一样。

<a id="agent-activity"></a>

## 智能体活动

**Agent activity**(智能体活动) 显示聊天里的智能体做了什么。聊天用上智能体或 Advanced Memory 后，它就会出现。它在 **Chat Settings** 里是紧挨着 **Agents** 下方的独立区域，也出现在 Tracker Panel 底部，以及电脑上的 Trackers 窗口底部。

- **Activity**(动态) 选项卡：智能体保存下来的输出，也就是思维气泡。可以逐条关闭，或用 **Clear all**(全部清除) 一次清空。自定义智能体的输出也在这里。
- 智能体工作时，它的图标会变成转圈的加载动画。某个智能体失败时，图标上会出现一个圆点，直到你打开它为止。
- 失败的智能体会列出来，并附带重试按钮。这里还能停止正在运行的智能体、重跑追踪器，以及使用 **Clear Trackers**(清空追踪器)。
- **Injections**(注入) 选项卡：只有开启 **Debug mode**(调试模式) 时才显示（**Settings → Advanced**(设置 → 高级)）。它列出上一条回复生成之前，写作类智能体保存下来的提示词片段。这类智能体包括按你的风格规则重写回复的 **Prose Guardian**，以及负责推动剧情的 **Narrative Director**。片段可以查看、编辑和重跑。编辑只影响重新生成同一条回复时用到的内容，这样重新生成才可复现。它不会改动屏幕上已有的回复。

全部智能体见[智能体：聊天里的 AI 帮手](../agents/agents-overview.md)。推动剧情的智能体见 [Narrative Director 与 Secret Plot](narrative-director.md)。

## 战斗与场景

- Roleplay 带一层轻量的战斗。添加 Combat 智能体，然后点输入框上方的 **Encounter**(遭遇战)。见[战斗遭遇战（Roleplay）](combat-encounters.md)。
- 场景是一条侧分支，用来插一段闪回或去一个支线地点。见[场景：分支出一段角色扮演](scenes.md)。
- 想引导剧情，见 [Narrative Director 与 Secret Plot](narrative-director.md)。
- 想按桌面规则游玩、带掷骰检定和人物卡，见[Roleplay：按规则集游玩](rulesets.md)。

## 挑选模型

聊天连接负责写角色的文字。更强的模型能在长场景里稳住角色的口吻。智能体连接跑的是读状态、挑表情这类结构化小任务，小模型容易做错。很多人把聊天放在强模型上，把智能体放在又快又便宜的模型上。如果 HUD 的数值或者立绘老是出错，就把智能体换到更强的模型上。采样参数见[生成参数](../prompts/generation-parameters.md)。

## 命令

这些都是可选功能。命令是角色可以自己执行的动作，以简短的方括号文字写在回复里，比如 `[illustrate: ...]`。Marinara 读到方括号后会执行动作，并把方括号从消息里隐藏掉。

### 开启命令

1. 打开 **Chat Settings → Agents**，展开 **Commands**(命令)。
2. 打开顶部的 **Commands** 开关。里面的每个命令一开始都是关闭的。
3. 开启你想要的命令。灰掉的命令会显示它还缺什么。

- **Illustrations**(插图)、**Video clips**(视频短片)：在这个聊天里添加 Illustrator 智能体。
- **Combat**(战斗)：在这个聊天里添加 Combat 智能体。
- **Soundtrack**(配乐)：添加 Music DJ 智能体，并开启智能体。
- **Personal Notes**(个人笔记)、**Reminders**(提醒)、**Whisper**(耳语)：使用单人聊天，或使用 **Individual**(各自独立) 生成的群聊。
- **Sound Cues**(音效提示)：选择一个开启了音效的 Music & Sound Effects 连接。
- **Documents**(文档)、**HTML Artifacts**(HTML 物件)、**Rolls**(掷骰)、**Direct Messages**(私信)、**Interruptions**(打断)：无需额外设置。

**Rolls**、**Combat**、**Documents** 和 **Whisper** 还会询问谁可以使用：**All**(所有) 角色，或者只有 **Narrator**(旁白)。旁白就是你在 **Narrator character**(旁白角色) 下选的那个角色。它可以使用仅限旁白的命令，并能读到所有人的笔记、提醒和耳语。

如果没有成功：灰掉的命令缺少所需的智能体或聊天类型。看看它开关下面的那行说明。

### 插图

开始之前：在聊天里添加 Illustrator 智能体，并开启 **Illustrations**。

这样角色就可以用 `[illustrate: subject="..." characters="..."]` 请求一张图片。图片使用这个聊天的 Illustrator 设置，显示在消息下方。

开启 **Render in-line**(内嵌显示)，每张图片就会显示在消息内部，也就是角色写下这条命令的位置。选中图片可以查看它的提示词，点 **X** 可以移除它。这项设置只对新图片生效。Illustrator 智能体自己生成的图片，以及 Visual Novel(视觉小说) 布局，都不受影响。

你也可以用 `/illustrate` 自己生成一张插图。在 Roleplay 里，这需要 Illustrator 智能体。

<a id="artifacts-on-demand"></a>

### 按需生成物件

开启 **HTML Artifacts**，旁白就可以制作一件世界观内的物件，比如一页魔法书、一块招牌、信纸上的一幅草图或一段终端输出。命令是 `[html: prompt="..."]`，不需要智能体。你也可以用 `/html <what you want>` 自己要一件。

回复写完之后，物件会出现在旁白放置命令的位置。在 Visual Novel 布局里只能看到一个标记。一条回复最多生成 3 件物件，每件都是一次单独的模型请求。如果 **Immersive HTML** 智能体设置了连接，请求就用它的连接；否则用默认的智能体连接；再否则用这个聊天的连接。该连接的 **Parallel requests**(并行请求数) 设置（在账号编辑器里）决定同时运行几个。如果只要一张普通的带样式页面，内置的 **Documents** 类型免费，而且立即可用。

旁白看不到物件的 HTML。在之后的回合里，它看到的是一个简短的纯文本版本：物件里可读的文字，外加一行描述它的样子。打开消息下方的“used html command”标记，可以阅读或编辑这段文字，也可以删除物件，删除后旁白的记忆里也不会再有它。如果某次运行失败，标记会说明原因。

<a id="whispers-and-secrets"></a>

### 耳语与秘密

开启 **Whisper**，就能在回复里加入私下的话、秘密和幻象。命令是 `[whisper: character="name" text="the secret"]`。只能指定聊天里的一个角色，或者你的用户角色。只有这个角色和旁白会在提示词里收到这段文字。未知或有歧义的名字会被忽略，所以秘密不会泄露。

- **Reveal a secret**(揭示秘密) 会在你的屏幕上显示一条耳语。它只改变你看到的内容，不改变角色知道的信息。发给你的用户角色的耳语会立即可见。
- 用 **Edit whisper**(编辑耳语) 修改文字，然后点 **Save**(保存)。要移除一条耳语，清空它的文字再点 **Save**。**Cancel**(取消) 会保持原样。
- 你可以在自己的消息里写一条耳语，悄悄说给一个角色听。编辑角色或旁白的消息时，同样的方括号也有效。文字可以跨行，也可以保留引号，例如 `text=""I love you.""`。
- 只包含耳语的消息，对耳语没有送达的角色是隐藏的。
- 如果你对一条消息使用 **Hide from AI**(对 AI 隐藏)，只对部分角色隐藏，耳语的收件人仍会收到耳语，但收不到消息的其余部分。

智能体也能读取耳语：

- 会读取耳语的智能体有：Echo Chamber、追踪器、Lorebook Keeper 和 Long-Term Memory。在群聊里，**Smart**(智能挑选) 回复顺序也会读取耳语，所以一条耳语可能让那个角色接着回复。
- 每条耳语都标记为私密，并注明收件人。智能体根据它写出的内容，例如世界书条目或追踪器笔记，仍可能传到其他角色那里。
- 在房主主持的多人模式房间里，智能体和 **Smart** 回复顺序都收不到耳语。
- Relationship Tracker 和 Memory Nag 会自行读取聊天，目前还看不到耳语。

<a id="your-private-notes"></a>

### 你的私人笔记

开启 **Personal Notes**，然后在自己的消息里写入 `[notes: content="your private note"]`。只有旁白会收到这些笔记，其他角色和共享智能体都收不到。通过消息的命令详情可以编辑或删除笔记。如果某个角色被禁用或移出群组，旁白就不再收到这个角色的笔记。重新启用这个角色后，笔记会恢复。

你也可以给单条消息记一条笔记：

1. 在消息下方选择 **Bookmark, pin or note**(添加书签、固定或记笔记)。
2. 填写 **Private note**(私人笔记)。默认情况下它保持私密，不会发送给模型。
3. 想分享给模型，就开启 **Show the note to the narrator character**(向旁白角色展示笔记)，并选一个角色。只有这个角色会收到这条笔记，附在那条消息旁边。分享需要单人聊天，或使用 **Individual** 生成的群聊。

**Remove note**(删除笔记) 也会停止分享。

<a id="video-clips"></a>

### 视频短片

开始之前：在聊天里添加 Illustrator 智能体，并在 Illustrator 的 **Scene Videos**(场景视频) 下选择一个视频连接。

开启 **Video clips**，角色就可以用 `[video: subject="the moment" motion="what moves and how the camera moves" characters="names"]` 为关键时刻请求一段短片。模型会收到指令：当这一刻重在动作时，优先用它，而不是 `[illustrate]`。短片从 Illustrator 的 **First frame**(首帧) 设定的图片开始（一张新的 Illustrator 图片、角色的头像或立绘，或者不用图片）。短片准备好后会在回复里播放。只有 **Video Run Interval**(视频运行间隔) 允许时才会提供短片，而且它计入 **Videos per reply**(每条回复的视频数)。

### 角色打断

开启 **Interruptions**，角色就可以在适合打断的时候截断最新一条消息。命令是 `[interrupt: part="a verbatim phrase of at least three words"]`。Marinara 会在回复紧前面的那条消息里找到这个片段，保留到片段为止的文字，并以破折号结尾。对白会保留右引号。如果找不到这个片段，或者匹配到两处，消息保持不变。

想找回原文，打开回复的命令信息，选择 **Restore original message**(恢复原始消息)。重新生成时会先恢复完整的原文，让新回复重新选择。选择已有的备选回复时，会应用那条备选回复的打断，除非你已经恢复过原文。你之后的手动编辑会保留。

## Echo Chamber

**Echo Chamber** 是一个可选智能体，会给你的场景加上一批实时观众来做出反应，效果像直播弹幕，按定时器不断刷出新反应。在 **Chat Settings → Agents** 的 **Echo Chamber** 卡片上开启它。

- 电脑上，拖动标题栏可以移动它，拖动边缘可以调整大小。固定后它会保持打开。**X** 会把它收起为可以移动的按钮。
- 手机上，它最初以小窗口显示在消息上方。拖动标题栏可以移动它，拖动边缘或角落可以调整大小。固定后，点击别处它也会保持打开；锁定可以避免误移动。
- 它会使用 **Settings → Appearance → App**(设置 → 外观 → 应用) 中的 **Chat widget style**(聊天组件样式)。每个聊天都会记住自己的布局。

## CYOA 选项

CYOA 是 Choose Your Own Adventure(自选冒险) 的缩写。CYOA Choices 智能体默认关闭，而且只在 Roleplay 里有效。开启后，它会在回复之后加上可点击的选项按钮，点一个选项，它就作为你的下一条消息发出去。想合并几个选项，或者先改一改再发，就在 **Settings → General → Input & Editing**(设置 → 常规 → 输入与编辑) 中开启 **Add CYOA choices to the message box instead of sending them**(把 CYOA 选项放进消息框，而不是直接发送)。之后点击选项只会把它的文字加进消息框。

## 故障排查

| 症状 | 解决办法 |
| --- | --- |
| HUD 里的某个值不对。 | 手动改掉它，再锁定，下一次运行就不会动它。见 [Roleplay 的 HUD 与追踪器](hud-and-trackers.md)。如果数值总是跑偏，换一个更强的智能体模型。 |
| 立绘不变。 | 检查这个角色有没有立绘库。也可以用 `/emote`。 |
| 背景一直不换。 | **Background** 智能体是从你的背景库里挑的，所以多加几张背景。见 [Roleplay 背景](backgrounds.md)。 |
| 重新生成的回复还是走错方向。 | 开启 **Debug mode**，打开 **Agent activity → Injections**，在重新生成之前编辑或重跑保存下来的片段。 |

更多帮助见 [Marinara Engine 故障排查](../TROUBLESHOOTING.md)。

## 相关指南

- [Roleplay 背景](backgrounds.md)
- [Roleplay 的 HUD 与追踪器](hud-and-trackers.md)
- [战斗遭遇战（Roleplay）](combat-encounters.md)
- [Narrative Director 与 Secret Plot](narrative-director.md)
- [Roleplay：按规则集游玩](rulesets.md)
- [场景：分支出一段角色扮演](scenes.md)
- [角色立绘](../characters/sprites.md)
- [把 Conversation 聊天连接到 Roleplay 或 Game](../chats/connected-chats.md)
- [宏](../prompts/macros.md)
