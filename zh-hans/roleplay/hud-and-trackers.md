# Roleplay 的 HUD 与追踪器

在 Roleplay(角色扮演) 聊天里，HUD(抬头显示) 实时显示故事的细节：时间、天气、谁在场、你的属性、物品和任务。任何值都可以手动修正，也可以锁定某个值，让 AI 不再改动它，还可以随时重跑某个追踪器。

这些值来自追踪器智能体。智能体是跟着回复一起运行的帮手。追踪器智能体盯着故事，在每条消息之后更新 HUD 的一部分。只有对应的智能体在这个聊天里开启，小组件才会显示。

## 开启 HUD

1. 用聊天里的滑块按钮打开 **Chat Settings**(聊天设置)。
2. 进入 **Agents**(智能体)，开启 **Enable Agents**(启用智能体)。
3. 从开关下方的列表里添加智能体。想要一个基础的 HUD，先添加 **World State**。想要更多，再添加 **Persona Stats**、**Character Tracker** 或 **Quest Tracker**。
4. 发送一条消息。

回复之后，追踪器就会出现。手机上会看到 **World State** 按钮。电脑上会看到 **Tracker Panel**(追踪器面板) 或 **Trackers** 窗口（见下文）。小组件表格列出了每个小组件由哪个智能体提供。

如果没有成功：一个追踪器智能体都没开的话，HUD 不会显示任何小组件。检查 **Enable Agents** 是否开启。

## HUD 出现在哪里

手机上，追踪器是可以移动的 **World State** 和 **Player & Tracker** 按钮。点一个按钮打开它的面板，点 **X** 关闭。World State 有了内容后，它的按钮会显示一条小横幅，上面有地点、日期、时间、天气和气温。按钮可以拖到任意位置，聊天会记住你放的位置。它们会使用 **Settings → Appearance → App**(设置 → 外观 → 应用) 中的 **Chat widget style**(聊天组件样式)。

电脑上，同样的追踪器会出现在下面两个位置之一：

- **Tracker Panel**：消息旁边的侧边面板，默认开启。**Chat Settings** 标题栏里的骰子按钮用来开关它。
- **Trackers** 窗口：一个可以移动的窗口，Tracker Panel 关闭时由它来放追踪器。

两者同一时间只会用一个。见 [Tracker Panel](#the-tracker-panel) 和 [Trackers 窗口](#the-trackers-window)。

## HUD 小组件

| 小组件 | 需要的智能体 | 显示内容 |
| --- | --- | --- |
| **World State** | World State | 地点、日期、时间、天气、气温，以及自定义的世界字段 |
| **Persona Stats** | Persona Stats | 用户角色的状态条和一行状态文字 |
| **Present Characters** | Character Tracker | 场景里有谁，附带心情、外貌和自定义字段 |
| **Inventory** | Persona Stats | 身上携带的物品及数量 |
| **Inventory Tracker** | Inventory Tracker | 货币、已装备的装具和随身携带物品的独立清单 |
| **Active Quests** | Quest Tracker | 当前的目标 |
| **Custom Tracker** | Custom Tracker | 自己命名的字段，比如计数器或货币 |

**Inventory**(物品栏) 小组件来自 **Persona Stats** 智能体，所以开启它就能同时得到这两个。**Inventory Tracker** 是独立的。它把条目分成 **Currencies**、**Equipped** 和 **Inventory** 三组，已装备的装具绝不会列两次。

每个条目都是一个小胶囊。数量只有大于 1 时才显示成 `×4`。要修改数量为 1 的条目，打开添加模式或锁定模式：两者都会在每个条目上显示数量控件。添加模式就是 Tracker Panel 顶栏里的 **+** 按钮。[锁定模式](#lock-mode)见下文。

**Present Characters** 最多显示 3 个角色 emoji，外加一个“+N”计数。**Inventory** 和 **Custom Tracker** 会把各自的条目逐条轮播。

## 编辑追踪器数值

每个字段都能编辑，所以 AI 写错的值可以直接改正。改动会立即保存。下一条回复会从你修正后的值开始；重新生成你修正过的那条回复，或为它生成新的备选回复时，也是如此。

1. 打开追踪器：手机上点它的按钮；电脑上在 Tracker Panel 或 Trackers 窗口里打开它的区域。
2. 点击值，输入新值。

- **World State**：**Location**、**Date**、**Time**、**Weather**、**Temperature** 和自定义的世界字段。
- **Persona Stats**：一行 **Status**，以及若干带名字的状态条，每条有当前值和最大值。状态条可以增删。
- **Present Characters**：增删角色。修改每个角色的 emoji、名字、**Mood**、**Look**、**Outfit**、**Thinks**(内心想法) 和自定义字段。每个角色都可以上传头像。**Auto** 按钮用来开关“Auto-generate avatars”。
- **Inventory**：增删物品，修改名称和数量。
- **Inventory Tracker**：在 **Currencies**、**Equipped** 和 **Inventory** 下增删条目。要把物品挪到另一组，先删掉它，再在那一组里添加。
- **Active Quests**：增删任务。每个任务都有带复选框的目标。
- **Custom Tracker**：增删字段，或修改字段的名称和值。

想一次修正很多值，用 [State Editor](#the-state-editor)。

<a id="lock-mode"></a>

## 锁定模式

每个回合之后，追踪器智能体都会覆盖 HUD 里的值。锁定模式让你可以把某个值钉住。字段锁定后，下一次自动运行会跳过它。某个值老是跑偏时就用它。

1. 打开追踪器。
2. 点击追踪器顶部附近的锁定开关（提示文字是 **Enter lock mode**）。每个可编辑的值旁边都会出现一个小锁按钮。
3. 点击那个值旁边的锁按钮（提示文字是 **Lock field**）。锁定的字段带有标记。

再点一次同一个按钮即可解锁（**Unlock field**）。再点一次顶部的开关就退出锁定模式（**Exit lock mode**）。锁定模式对整个 HUD 生效，在一个追踪器里打开它，所有地方都会显示锁按钮。

## 重跑某个追踪器

想让追踪器现在就更新，而不是等下一条消息，点击它里面的圆形箭头按钮。它只针对最新的回合重跑这一个追踪器。提示文字会写明是哪个追踪器，比如 **Re-run world state tracker only**。

想让某个追踪器只在你要求时运行，打开 **Chat Settings → Agents → Trackers Control**(聊天设置 → 智能体 → 追踪器控制)，在 **Individual tracker schedule**(单独的追踪器运行计划) 下开启这个追踪器。手动追踪器不会在每次回复之后运行。原先开着旧版 **Manual Trackers**(手动追踪器) 开关的聊天，会在那里显示所有追踪器都已开启。

只要至少有一个手动追踪器，就会出现一个刷新按钮：手机上在 HUD 行里，电脑上在 Trackers 窗口标题旁。点它可以为当前回合运行这些手动追踪器。

重跑全部追踪器、重试失败的智能体和使用 **Clear Trackers**(清空追踪器)，都在 **Agent activity** 里。见[智能体活动](getting-started.md#agent-activity)。

> **警告：** **Clear Trackers** 会清除这个聊天的全部世界追踪状态，而且无法撤销。

<a id="the-trackers-window"></a>

## Trackers 窗口

电脑上，Tracker Panel 关闭时，追踪器改用 **Trackers** 窗口。消息旁有足够空间，它就在左边打开；否则最初显示为聊天左上角的一个小型 **Trackers** 按钮，点击按钮即可打开。已保存布局的聊天会保持你之前的排列。

拖动标题栏可以移动窗口，拖动边缘可以调整大小。右上角的按钮有：

- **Pin**：点击别处时让窗口保持打开。初始状态就是固定的。
- **Lock**：阻止移动或调整大小，也把它的按钮固定在原位。按钮仍可打开窗口。
- **Close**：把窗口缩成可以移动的 **Trackers** 按钮。

Chat Settings 里的 **Reset View**(重置视图) 会清除保存的排列，再根据可用空间选择初始的窗口或按钮。

每个追踪器都有一个可折叠的区域。点击标题会收起，只留下一个小预览；再点一次就展开。Marinara 会记住你收起了哪些。

想让某个追踪器拥有独立窗口，点击它箭头旁的弹出按钮，或把它的标题拖出 Trackers 窗口。新窗口默认不固定，固定后它会保持打开。**X** 会把它缩成带追踪器图标的小按钮。**World State** 则会缩成一条横幅，和手机上一样显示地点、日期、时间和天气，所以你可以把它拖到任意位置，比如聊天区域的顶部中间。要放回去，点击 **Put back in Trackers**(**X** 左侧的弯箭头)，或把它拖回 Trackers 窗口。每个聊天都会记住弹出了哪些追踪器，以及它们在哪里。

<a id="the-tracker-panel"></a>

## Tracker Panel

**Tracker Panel** 是一块更大的侧边面板，显示的数据相同。它还会显示角色肖像和想法。

1. 打开 **Chat Settings**。
2. 点击标题栏里固定和锁定按钮旁的 **Tracker Panel** 按钮（骰子）。面板开启期间，按钮保持高亮。
3. 再点一次即可隐藏面板。电脑上，追踪器随后显示在 Trackers 窗口里。

电脑上，面板会放进消息旁边的空间，最宽不超过 **Desktop size**(桌面尺寸) 设定的宽度。窗口宽度不足以同时容纳两者时（比如打开了聊天侧边栏），消息和消息框会稍微变窄。手机或平板上，开启后会添加一个可以拖动的 Tracker Panel 按钮。点它打开面板，再点一次关闭。面板或其他界面盖住聊天时，聊天上的可移动按钮会隐藏，之后在原来的位置重新出现。

### 自定义追踪器字段

面板顶栏的按钮可以改变追踪器的结构：

- **+** 进入添加模式。World 部分会多出 **Add world field**，每张在场角色卡会多出 **Add custom field**。字段名在普通模式下也一直可见。
- 垃圾桶图标进入删除模式，可以删掉自定义的世界字段或角色字段。删除字段时，它的锁定也会一并删除。
- 锁图标进入锁定模式。自定义字段和内置字段遵循同样的锁定行为。
- 带斜杠的眼睛图标进入隐藏模式。在角色卡上选择 **Mood**、**Look**、**Outfit** 或 **Thoughts**。被隐藏的字段会从 Tracker Panel 和 HUD 中消失、内容被清空，并保持锁定，所以智能体不会再往里填内容。再次进入隐藏模式，可以把它以空字段的形式显示回来。

智能体会更新你自定义字段的值。它们绝不会删除你建的字段。

### 生成新肖像

Character Tracker 有了图像连接后，角色的大卡片就能生成新肖像。在紧凑卡片上，点击 **Feature character card**(设为重点角色卡片) 打开大卡片。Trackers 窗口始终显示大卡片。把鼠标悬停在肖像上，点眼睛按钮按 **Look** 生成一张，或点衬衫按钮按 **Look** 和 **Outfit** 生成。只有角色有服装时，才会出现衬衫按钮。新肖像生成好之前，旧肖像会一直保留。生成失败时，旧肖像也会保留。用角色卡头像或表情立绘显示的角色没有这些按钮。

### Tracker Panel 设置

打开 **Settings → Appearance**(设置 → 外观)，展开 **Roleplay** 分组，找到 **Tracker Panel** 部分。

| 设置 | 作用 |
| --- | --- |
| **Tracker Panel** | 总开关，与骰子控制的是同一项。默认开启。开启时标签显示“Shown in the Roleplay HUD”。 |
| **Dock Tracker Panel to edge**(把追踪器面板停靠到边缘) | 把面板贴着屏幕边缘放，并让附近的聊天控件避开它。 |
| **Use expression sprites for tracker portraits**(追踪器肖像使用表情立绘) | 角色有当前的表情立绘时，用它代替普通头像。见[角色立绘](../characters/sprites.md)。 |
| **Panel background**(面板背景) | 面板的颜色或渐变。 |
| **Desktop size** | 面板宽度：**Compact**、**Standard** 或 **Expanded**。 |
| **Thought display mode**(想法显示方式) | **Docked** 把想法展开在角色卡内部。**Floating** 把想法显示为肖像旁边的气泡。 |
| **Always show Docked thoughts**(始终显示 Docked 想法) | 选择 **Docked** 时，让每个重点角色的想法一直显示，而不是收在按钮后面。 |
| **Stat display mode**(属性显示方式) | 把属性显示为状态条或圆形仪表。 |
| **Temperature unit**(气温单位) | **°C**(默认) 或 **°F**。这只改变显示方式，不改变保存的值。 |

<a id="the-state-editor"></a>

## State Editor

**State Editor**(状态编辑器) 把当前回合的所有追踪器放进同一个窗口，让你不用逐个打开追踪器，就能找到并修正某个值。它在手机上同样可用。

从下面任一位置打开它：

- Tracker Panel 顶栏里的齿轮（**Tracker panel settings**），然后点 **{ }** 按钮（**Open in State Editor**）。
- **Trackers** 窗口或你弹出的某个追踪器，其标题栏里的 **{ }** 按钮。
- 手机上，**World State** 和 **Player & Tracker** 面板里的 **{ }** 按钮。
- **Agent Suite** 中 **Tracker Data** 下的 **Open in State Editor** 链接。

它会直接打开你所来自的那个追踪器的分区。比如 World State 会打开 **Scene**。

- **回合行**：在搜索框下方。它写明你正在编辑的是哪条消息的哪条备选回复，例如“Editing message #12 · swipe 2 of 3”。**Latest**(最新) 标出最新的回合。每条备选回复都有自己的状态，所以想编辑另一条，先切换备选回复。
- **分区**：**Scene**、**Present Characters**、**Persona Stats**、**Inventory Tracker**、**Custom Tracker Fields** 和 **Active Quests**。手机上，它们是编辑器上方的一排小标签。带圆点的分区表示改过。
- **搜索**：输入一个键或值，例如 `mood`。点击结果就能跳过去。
- **Fields**(字段)：每个分区都以 **Fields** 打开，文字、数字和开关值都显示为输入框。
- **No value**(无值)：空字段会提供 **Text**(文本)、**Number**(数字) 或 **On/off**(开关) 可选。
- **Add item**(添加条目)：添加一个条目，并复制它上方的那一个。
- **Add**(添加)：给分区或空卡片添加一个带名称的字段。
- **×**：删除一个条目，或清空一个值。
- **JSON**：编辑原始数据。**Format**(格式化) 会整理它。JSON 有错误的分区，修好之前无法保存。
- **Revert**(还原)：撤销你对某个分区的改动。

角色和任务属于故事本身，所以不能在这里添加它们的卡片。不过可以编辑它们内部的列表，比如角色的属性。

保存：

1. 点击 **Review changes**(查看改动)，逐行查看每处改动。
2. 点击 **Save changes**(保存改动)。这会把所有分区一次性写入你正在编辑的回合。

在此之前，草稿都留在窗口里，关闭窗口时会先询问再丢弃。

如果没有成功：如果你编辑期间故事继续推进，编辑器不会覆盖它。新的回复或备选回复，或者追踪器更新了你改过的分区，都会让保存被拒绝，并出现 **Reload**(重新加载) 按钮。**Reload** 会显示最新状态，并丢弃你的草稿。

## 相关指南

- [可下载智能体参考](../agents/built-in-agents.md)
- [智能体：聊天里的 AI 帮手](../agents/agents-overview.md)
- [角色颜色与剧情属性](../characters/colors-and-stats.md)：**Stats** 选项卡设定用户角色或角色一开始有哪些状态条和属性。
- [Roleplay 模式：入门](getting-started.md)
- [Game Mode：HUD 小组件](../game/hud-widgets.md)
