# Roleplay 模式：入门

本指南介绍 Roleplay 模式是什么、怎么开始一段角色扮演、屏幕上都有些什么，另外还会讲到立绘控制、聊天工具栏、Author's Notes(作者注释)，以及更深入的功能该去哪篇文档看。

## Roleplay 模式是什么

Roleplay(角色扮演) 是 Marinara Engine 的聊天模式之一，另外两种是 Conversation(对话模式) 和 Game。Roleplay 围绕一个故事展开，给出一块沉浸式的场景画面。

一个角色扮演场景里可以有背景图、角色立绘，还有一条显示世界状态的信息条。会随情绪变化的角色图片叫立绘。聊天上方那一小排信息小组件叫 HUD。

Roleplay 还会用到一类叫智能体的帮手。智能体是跟着 AI 回复一起跑的小型自动任务，负责追踪世界状态、挑立绘、选背景等等。

不开图像生成也能用 Roleplay 模式。没有图像生成时，这个模式就是纯文字聊天：立绘位留空，背景显示为纯色，HUD 照样正常追踪。配置连接的方法见[连接 AI 服务商](../connections/connecting-to-a-provider.md)。

想要沉浸式场景就选 Roleplay 模式。想要普通的消息式聊天，选 [Conversation 模式](../conversation/getting-started.md)。想要带队伍、战斗和骰子的结构化角色扮演游戏，选 [Game Mode](../game/getting-started.md)。

## 开始一段角色扮演

新建一个 Roleplay 聊天就会打开设置向导。向导一共 5 步，其中只有 AI 连接是必填的，其余每一步都可选，之后也能改。

1. **Name & Connection**(名称与连接)。给这段角色扮演起个名字，并选择由哪个 AI 连接来回复。名字可以留空。
2. **Pick a Preset**(选择预设)。预设决定提示词（Marinara Engine 发给 AI 的那段文字）的结构和生成参数。默认预设适合绝大多数聊天。
3. **Persona & Characters**(用户角色与角色)。选择你扮演的用户角色，以及哪些角色出场。
4. **Attach Lorebooks**(附加世界书)。世界书是一组世界设定条目，聊天里出现关键词时 AI 就会读到它们。这一步可选。
5. **Enable Agents**(启用智能体)。选择这个聊天里要跑哪些智能体。之后也能在 **Chat Settings**(聊天设置) 的 **Agents**(智能体) 里增删。

向导走完，场景就打开了，可以发出第一条消息。

## 舞台：背景、立绘和 HUD

Roleplay 舞台指消息背后和四周的那片场景区域，主要由三部分组成。

**background**(背景) 是铺在消息列后面的整屏图像，切换时会平滑淡入淡出。**Background** 智能体可以每回合从背景库里挑一张，也可以给每个聊天固定一张背景。完整的背景系统见 [Roleplay 背景](backgrounds.md)。

**Sprites**(立绘) 是摆在舞台上的角色图片，数量没有上限，聊天里每个开了立绘的角色都能出现。立绘需要角色卡上传过立绘库。没有立绘库，这个立绘位就什么都不显示。给角色添加立绘的方法见[角色立绘](../characters/sprites.md)。

**HUD** 是聊天顶部的一排小组件。每个小组件都属于某个追踪器智能体，所以只有对应的智能体开着时它才出现。小组件可以显示日期、时间、天气、地点、在场角色、物品栏、任务和属性。点击小组件会打开一个面板，可以手动改里面的值。全部小组件和锁定模式见 [Roleplay 的 HUD 与追踪器](hud-and-trackers.md)。

### 立绘显示控制

立绘控制在 **Chat Settings** 的 **Agents** 里，位于 **Expression Engine** 卡片上。至少有一个角色开启立绘之后，这些设置才会出现。

- **Sprite Source**(立绘来源)。一组开关，可选 **Expressions** 和 **Full-body**，选一个或者两个都选，但至少要留一个开着。
- **Expression Size**、**Full-body Size**、**Expression Opacity** 和 **Full-body Opacity**。四个滑块，控制立绘的大小和透明程度。这几项只保存在当前浏览器上，不会同步到其他设备。
- **Default Side**(默认站位)。在 **Left** 和 **Right** 之间切换的开关，决定新出现的立绘一开始站在哪一边。
- **Expression Avatars**(表情头像)。开启后，聊天记录里的消息头像会使用角色当前的表情立绘。

想手动挪动立绘，点舞台上的 **Arrange**(排列) 按钮，它会变成 **Done**。拖动立绘，再点它上方的小对勾确认。点 **Done** 结束。**Reset** 按钮会清空所有自定义摆放。

在输入框里输入 **/emote** 命令也能指定表情，有两种写法：

```
/emote happy
```

```
/emote "Aria" angry
```

第一种写法给整个场景设定表情，第二种只针对指定的那个角色。输入 **/emote** 而不带任何词，会列出场景里每个角色可用的表情。

## 聊天工具栏

工具栏位于聊天区顶部，上面的按钮会展开一个个小的弹出面板。主要按钮有：

- **Chat Summary**(聊天摘要)。查看和编辑这个聊天的滚动摘要。
- **Active Context**(活动上下文)。列出上一条回复用到的关联角色、世界书条目和预设，并显示哪些世界书条目命中并已注入。
- **Author's Notes**。每回合都会加进提示词的一段自由文本。详见下文。
- **Gallery**(图库)。打开这个聊天的图像和视频图库，可以在里面生成插图或背景。
- **Chat Settings**。打开这个聊天的完整设置面板。

### Author's Notes

**Author's Notes** 是你自己写的一段说明，AI 每次生成都会读到。它适合放长期有效的提醒，比如语气规则或者某个隐藏设定。点工具栏里的钢笔按钮打开。

在框里写下笔记。例如：“把语气写得阴郁又悬疑。反派其实是盟友。”

笔记下面是 **Injection Depth**(注入深度) 数字输入框，它决定这段笔记插在聊天记录里往上数第几条的位置。应用内的说明是：“Depth 0 = after the latest message, 4 = four messages from the end.”深度 0 会让笔记离最新的那条回复最近。

Author's Notes 在 Game Mode 和 Conversation 模式里的用法完全一样，这篇指南是它的主要参考。

## Agents and Actions 菜单

HUD 那一行里的星光按钮会打开 **Agents & Actions**(智能体与操作) 菜单。它的 **Activity**(动态) 选项卡列出智能体的输出，也就是所谓的思维气泡。每一条都可以单独关掉，也可以用 **Clear all** 一次清空。自定义智能体的输出同样显示在这里。

如果某个智能体在上一回合失败了，这里会出现一个失败列表和一个重试按钮。也可以从这个菜单里重跑全部追踪器智能体。想通俗地了解整套智能体系统，见[智能体：聊天里的 AI 帮手](../agents/agents-overview.md)。

只有开启 **Debug mode**(调试模式) 之后才会出现 **Injections**(注入) 选项卡。开关在 **Settings**(设置) 的 **Advanced**(高级) 里。这个选项卡显示上一条回复生成之前，写作类智能体保存下来的提示词片段。写作类智能体包括按你的风格规则重写回复的 **Prose Guardian**，以及负责推动剧情的 **Narrative Director**。

保存下来的片段可以查看、编辑和重跑。编辑只影响重新生成这条回复时用到的内容，不会改动屏幕上已有的那条回复。这样重新生成才稳定、可复现。

Narrative Director 在输入框上方有一个 **Push Story** 按钮，按下后只对下一条回复生效。Narrative Director 还能维护一条隐藏的长期故事线，叫 **Secret Plot**。两者详见 [Narrative Director 与 Secret Plot](narrative-director.md)。

## 角色打断

在 **Chat Settings → Agents → Roleplay Commands** 中启用 **Interruptions**(打断)，角色就可以在合理的言语或身体介入场景下，截断最新消息。默认关闭，不需要下载智能体。

模型使用 `[interrupt: part="a verbatim phrase of at least three words"]`。Marinara 只会在回复紧前面的那条消息中匹配这个原文片段，保留到片段末尾的内容，并将结尾改为表示打断的破折号。对话会保留右引号，动作不会被额外加上引号。没有匹配或匹配不唯一时，消息保持不变。

打开回复的命令信息，选择 **Restore original message**(恢复原始消息)，即可恢复原文。重新生成时会先恢复完整的原始输入，让新回复重新决定是否打断。选择已有的备选回复时，会应用那条回复的打断，除非你已经明确恢复了原文。之后的手动编辑会保留，不会被旧的打断覆盖。

## Echo Chamber

**Echo Chamber** 是一个可选智能体，会给场景加上一批实时观众来做出反应。它的效果像直播弹幕，按定时器不断刷出新反应。开关在 **Chat Settings** 的 **Agents** 里，位于 **Echo Chamber** 卡片上。这个面板浮在场景上方，也可以收起成一个小胶囊。

## CYOA 选项

**CYOA** 是 Choose Your Own Adventure(自选冒险) 的缩写。**CYOA Choices** 智能体默认关闭，开启后会在回复末尾加上可点击的选项按钮。点一个选项，它就作为你的下一条消息发出去。这个功能只在 Roleplay 模式里有效。

## 遭遇战

Roleplay 模式带一层轻量的战斗。启用 **Combat** 智能体，然后点输入框上方的 **Encounter** 按钮（它的提示文字是“Start Combat Encounter”）。先弹出一个设置窗口，接着进入带血条和行动按钮的战斗界面。它和 Game Mode 自带的战斗是两套东西。完整流程见[遭遇战（Roleplay）](combat-encounters.md)。

## 场景

**scene**(场景) 是角色扮演的一条侧分支。想插一段闪回、跑一个支线地点，或者试另一条路线，又不想丢掉主线时，就用它。即使父级的角色扮演接了 Conversation，场景本身也不会从中取上下文。见[场景：分支出一段角色扮演](scenes.md)。

## 挑选模型

Roleplay 模式用默认设置就挺好。有两条通用建议对大多数配置都管用。

聊天连接负责写角色的文字，中档以上的模型才能在长场景里稳住角色的口吻。智能体连接跑的是读状态、挑表情这类结构化小任务，模型太弱就容易给出错误的状态或不合适的立绘。

智能体可以用比聊天更便宜的模型。很多人把聊天放在强模型上，把智能体放在又快又便宜的模型上。如果 HUD 的数值或者立绘老是出错，就把智能体连接换成能力更强的模型。采样参数见[生成参数](../prompts/generation-parameters.md)。

## 故障排查

**HUD 小组件显示的值不对。** 每个小组件由一个追踪器智能体填写。打开小组件面板手动改就行。如果数值总是跑偏，把智能体连接换成更强的模型。也可以锁定某个字段，下一次自动运行就不会覆盖它。

**立绘表情不变。** 检查这个角色有没有上传过立绘库。只有想让 Marinara 生成新立绘时才需要图像生成。没有立绘可显示时，表情智能体照样在跑，只是没东西可显示。也可以用 **/emote** 命令手动指定表情。

**背景一直不换。** **Background** 智能体是从背景库里挑的。库里只有一两张时，它就只能反复挑这几张。多加几张背景，智能体的选择就多了。见 [Roleplay 背景](backgrounds.md)。

**重新生成的回复还是走错方向。** 在 **Settings** 的 **Advanced** 里开启 **Debug mode**。打开 **Agents & Actions** 菜单，找到 **Injections** 选项卡，在重新生成之前编辑或重跑保存下来的片段。更多帮助见 [Marinara Engine 故障排查](../TROUBLESHOOTING.md)。

## 相关指南

- [Roleplay 背景](backgrounds.md)
- [Roleplay 的 HUD 与追踪器](hud-and-trackers.md)
- [遭遇战（Roleplay）](combat-encounters.md)
- [Narrative Director 与 Secret Plot](narrative-director.md)
- [场景：分支出一段角色扮演](scenes.md)
- [角色立绘](../characters/sprites.md)
- [把 Conversation 聊天连接到 Roleplay 或 Game](../chats/connected-chats.md)
- [宏](../prompts/macros.md)
