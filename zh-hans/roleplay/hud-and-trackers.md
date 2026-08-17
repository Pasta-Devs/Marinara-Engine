# Roleplay 的 HUD 与追踪器

本指南介绍 Roleplay 的 HUD 和它上面那排追踪器小组件，讲清楚怎么修改和锁定这些值，以及更大的 Tracker Panel 怎么用。内容适用于 Marinara Engine 的 Roleplay(角色扮演) 模式。

## HUD 是什么

HUD(抬头显示) 是聊天区顶部的一排图标小组件。每个小组件显示一项实时的故事状态，比如时间、属性，或者当前谁在场。故事往前推进时，Marinara 会自动把这些值更新好。

这些值来自追踪器智能体。智能体是在后台运行的小型 AI 帮手，每个追踪器智能体盯住故事的一个侧面，在每条消息之后更新 HUD 的对应部分，不用专门去要求它。

只有当对应的追踪器智能体在这个聊天里开启时，小组件才会出现。开关智能体的位置在 **Chat Settings**(聊天设置) 的 **Agents**(智能体) 部分。一个追踪器智能体都没开的话，HUD 里就只剩 **Agents & Actions**(智能体与操作) 按钮，没有任何小组件。

## HUD 小组件

一共有 7 个追踪器小组件，每个都要启用各自的智能体才会出现。

| 小组件                 | 需要的智能体      | 显示内容                                                                          |
| ---------------------- | ----------------- | -------------------------------------------------------------------------------- |
| **World State**        | World State       | 地点、日期、时间、天气、气温，以及自定义的世界字段                               |
| **Persona Stats**      | Persona Stats     | 用户角色的状态条和一行状态文字                                                   |
| **Present Characters** | Character Tracker | 场景里在场的角色，附带心情、外貌和角色专属的自定义字段                           |
| **Inventory**          | Persona Stats     | 身上携带的物品及数量                                                             |
| **Inventory Tracker**  | Inventory Tracker | 货币、已装备的装具和随身携带物品的独立清单                                        |
| **Active Quests**      | Quest Tracker     | 当前的目标                                                                       |
| **Custom Tracker**     | Custom Tracker    | 自己命名的字段，比如计数器或货币                                                 |

注意 **Inventory**(物品栏) 小组件和 **Persona Stats** 小组件靠的是同一个 **Persona Stats** 智能体。开启 **Persona Stats** 就能同时得到这两个。

独立的 **Inventory Tracker** 与 Persona Stats 的物品栏互不相干。它把名称加数量的精简条目分成 **Currencies**、**Equipped**、**Inventory** 三组，并且不让已装备的装具同时出现在随身携带的物品里。

每个条目都是一个小胶囊。胶囊沿着面板宽度排开，放不下就换到下一行，所以携带的东西再多，列表也保持好读，不会拉成很高的一列。数量只有大于 1 时才显示，写成名称后面的 `×4`；只有一件的物品就只显示名称。面板较窄时，胶囊会一行一个往下排。

要改动当前为 1 的数量，请打开添加模式或锁定模式，这两种模式都会在每个条目上露出数量控件。

**Present Characters** 小组件最多显示 3 个角色 emoji，多出来的用一个“+N”的计数表示。**Inventory** 和 **Custom Tracker** 小组件会把各自的条目逐条轮播。

## 在弹出面板里改值

点击任意小组件就能打开它的弹出面板，也就是一小块浮动的面板。里面每个字段都能改，AI 写错的值可以直接纠正过来，改完立即保存。

各个弹出面板能改的内容如下：

- **World State**：**Location**、**Date**、**Time**、**Weather**、**Temperature**，以及自定义的世界字段行。
- **Persona Stats**：一行 **Status**，再加上若干带名字的状态条，每条有当前值和最大值。状态条可以增删。
- **Present Characters**：增删角色，并修改每个角色的 emoji、名字、**Mood**、**Look**、**Outfit**、**Thinks**(内心想法) 和自定义字段的值。每个角色都可以单独上传头像。**Auto** 按钮用来在“Auto-generate avatars: ON”和“Auto-generate avatars: OFF”之间切换。
- **Inventory**：增删物品，并修改每件物品的名称和数量。
- **Inventory Tracker**：在 **Currencies**、**Equipped**、**Inventory** 下增删条目，并修改每条的名称或数量。把物品从一组挪到另一组还不能一步完成，需要先从一组删掉，再添加到另一组。
- **Active Quests**：增删任务。每个任务下面是带完成复选框的具体目标。
- **Custom Tracker**：增删字段，或修改字段的名称和值。

## 锁定模式

每个回合之后，追踪器智能体都会覆盖 HUD 里的值。多数时候这很省事，但有时候某个值老是跑偏，就需要手动把它钉住。锁定模式做的就是这件事。

字段一旦锁定，下一次追踪器自动运行时就会跳过它。锁定的字段带有标记，一眼就能认出来。

锁定一个字段的步骤：

1. 打开该小组件的弹出面板。
2. 点击面板顶部附近的锁定开关，它的提示文字是 **Enter lock mode**。
3. 这时每个可编辑的值旁边都会出现一个小锁按钮。
4. 点击要钉住的那个值旁边的锁按钮，它的提示文字是 **Lock field**。

再点一次同一个按钮即可解锁（提示文字变成 **Unlock field**）。再点一次顶部的开关就退出锁定模式（提示文字是 **Exit lock mode**）。锁定模式对整个 HUD 生效，在一个弹出面板里打开它，所有地方的锁按钮都会显示出来。

## 重跑某个追踪器

不想等下一条消息的话，可以强制让追踪器立刻更新。

每个弹出面板里都有一个小小的刷新按钮（圆形箭头）。点它就只重跑这一个追踪器，针对最新的回合。提示文字里会写明是哪个追踪器，比如 **Re-run world state tracker only** 或 **Re-run quest tracker only**。

在 **Chat Settings → Agents** 里，**Manual Trackers** 会把所有已启用的追踪器都改成手动控制。也可以让这个开关保持关闭，只在 **Individual tracker schedule** 下面把选中的几个智能体设为手动。只要有至少一个追踪器处于手动状态，HUD 那一行就会出现一个刷新按钮，点它可以为当前回合运行这一组手动追踪器。各个追踪器弹出面板里的刷新按钮仍然是直接运行那一个追踪器。

HUD 行首的星光图标用来打开 **Agents & Actions** 菜单。在那里可以重跑全部追踪器、重试失败的智能体，还能用 **Clear Trackers**(清空追踪器) 清空这个聊天记录下来的全部世界状态。**Clear Trackers** 无法撤销，用之前想清楚。

## Tracker Panel

**Tracker Panel**(追踪器面板) 是一块更大的侧边面板，显示的数据和紧凑的 HUD 小组件相同。它给追踪器卡片留出了更多空间，还多了肖像和想法两项功能。设置位置在 **Settings**(设置) 的 **Appearance**(外观) 选项卡，**Tracker Panel** 部分。

面板顶栏的几个控件还能用来调整追踪器的结构：

- 点击 **+** 进入添加模式。World 部分会多出 **Add world field**，每张在场角色卡会多出 **Add custom field**。字段名在普通模式下也一直可见，所以值的含义随时都清楚。
- 点击垃圾桶图标进入删除模式，然后删掉自定义的世界字段或角色字段。删除字段的同时，该字段保存的锁定状态也一并删除。
- 点击锁图标进入锁定模式。自定义字段的值和内置追踪器的值遵循同样的锁定行为。
- 点击带斜杠的眼睛图标进入隐藏模式，然后在角色卡上选择 **Mood**、**Look**、**Outfit** 或 **Thoughts**。被隐藏的字段会从 Tracker Panel 和 Roleplay 的 HUD 中消失、内容被清空，并保持锁定，追踪器智能体不会再往里填内容。再次进入隐藏模式，可以把隐藏的字段以空字段的形式显示回来。

自定义字段的名称决定了结构，在多次追踪器运行之间保持不变。故事里发生变化时，追踪器智能体会更新这些字段的值；而智能体输出里没提到的字段，不会因此被抹掉。

控制它的设置项如下：

- **Tracker Panel**：总开关，默认开启。开启时标签显示“Shown in the Roleplay HUD”。
- **Replace tracker HUD icons**：隐藏那条紧凑的图标带，让面板改为停靠在屏幕边缘。**Agents & Actions** 按钮仍然保留。
- **Use expression sprites for tracker portraits**：有表情立绘（角色当前情绪的那张立绘）时，追踪器肖像就用它，而不是普通头像。表情立绘的说明见[角色立绘](../characters/sprites.md)。
- **Panel background**：面板背景的颜色或渐变选择器。
- **Desktop size**：选择面板宽度，可选 **Compact**、**Standard** 和 **Expanded**。
- **Thought display mode**：选择角色的想法以什么方式呈现。**Docked** 把想法展开在角色卡内部，**Floating** 把想法做成肖像旁边的气泡。
- **Always show Docked thoughts**：当 **Thought display mode** 为 **Docked** 时，让每个重点角色的想法一直显示，而不是收在按钮后面。
- **Temperature unit**：在 **Celsius** 和 **Fahrenheit** 之间切换气温显示单位，默认是 Celsius。这只改变显示方式，保存下来的世界状态数值不变。

## 哪些智能体在填充 HUD

HUD 的每个小组件都由一个在回合结束后运行的追踪器智能体填充。本指南开头的小组件表格列出了各个小组件对应哪个智能体。

想设定用户角色或角色初始拥有哪些状态条和 RPG 属性，用角色编辑器或用户角色编辑器里的 **Stats** 选项卡。之后故事怎么发展，追踪器智能体就怎么调整这些数值。

## 相关指南

- [可下载智能体参考](../agents/built-in-agents.md)
- [智能体：聊天里的 AI 帮手](../agents/agents-overview.md)
- [角色颜色与 RPG 属性](../characters/colors-and-stats.md)
- [Roleplay 模式：入门](getting-started.md)
- [Game Mode：HUD 小组件](../game/hud-widgets.md)
