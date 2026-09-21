# 角色日程与自主消息

本指南介绍 Conversation(对话模式) 里的角色怎么主动给你发消息，以及怎么控制它们发消息的时机，内容包括自主消息、角色日程、**/status** 命令和你自己的在线状态。这些功能只在 Conversation 模式下有效。

## 自主消息和日程的作用

自主消息就是角色抢先发来的消息，你一个字都不用写。你安静一段时间之后，Marinara Engine(下文简称 Marinara) 就会发出这类消息，让聊天更像现实中的日常联络。

控制这个行为的设置有两个：

- **Autonomous Messages**(自主消息) 决定角色能不能主动来找你。
- **Schedules**(日程) 给每个角色安排一套每周作息，让它们在不同时段呈现清醒、忙碌或睡着的状态。

日程不是必需的。只开自主消息、不开日程时，角色照样会按照各自的健谈度和你的状态来找你。健谈度是每个角色单独的设置，决定它主动开口的频率。

## 开启自主消息

这项开关在聊天里控制，不在角色卡上。下面这些控件都在 **Chat Settings**(聊天设置) 的 **Autonomous Messaging**(自主消息设置) 部分里。

1. 打开一个 Conversation 聊天。
2. 打开 **Chat Settings**(齿轮图标)。
3. 找到 **Autonomous Messaging** 部分。
4. 打开 **Autonomous Messages** 开关。

新建聊天的设置向导里，**Autonomous Messages** 默认是开的。随时可以在 **Chat Settings** 里关掉。

### Chat Check-In Cap

开关下方的 **Chat Check-In Cap**(问候次数上限) 限制角色每天在这个聊天里主动来找你的次数。

- 默认选项是 **Default chat ceiling (talkativeness-based)**，上限由每个角色各自的健谈度决定。
- 选 **Numeric value** 会出现一个数字输入框，可以填任意正整数上限。上限定得越高，产生的模型请求和通知就越多。

这个上限管的是整个聊天。角色在自己日程里设的单独上限只能把这个数字调低，不能调高。

基于健谈度的默认值是这样的：

| 角色健谈度 | 每天默认问候次数 |
|---|---|
| 80 或更高 | 8 |
| 60 到 79 | 6 |
| 40 到 59 | 5 |
| 20 到 39 | 3 |
| 低于 20 | 2 |

### 开启日程

**Schedules**(日程)开关位于**Autonomous Messaging**中。保存的作息属于角色，并在各个 Conversation 聊天中复用，包括把角色加入已有聊天时。在某个聊天中明确关闭日程，会保留该聊天的关闭状态，不会删除角色作息。

1. 打开 **Schedules** 开关。
2. 现有作息会立即显示。启用日程不会自动生成新作息；需要时点击**Generate**。
3. 作息生成之后，界面上会出现 **Edit schedules**(编辑日程) 列表，每个角色一行。

每周自动更新默认关闭，只有在**Character Schedule Manager**(角色日程管理器)中为该角色启用后才会运行。失败后重新打开聊天不会反复重试；请使用生成按钮手动重试。

每一行显示已经排好几天，例如 **3 days scheduled**；如果这个角色还没有日程，显示的是 **Create schedule**。**Generate** 按钮（已有作息之后显示为 **Regenerate**）可以随时重新生成作息。

## Schedules 编辑器

在 **Edit schedules** 列表里点击某个角色所在的行，就会打开日程编辑器。窗口标题是 **Edit** 加角色名再加 **Schedule**。

顶部的 **Routine profile**(作息概况) 区域用大白话把一周的安排讲一遍。点 **Generate summary** 按钮生成，点 **Refresh summary** 更新。生成摘要之后又改了日程，界面上会出现 **Summary may be stale** 提示。

### Tuning

展开 **Tuning**(调节) 部分，主要的控件都在里面。

- **Chat talkativeness**(聊天健谈度) 是一个五档滑块：**Rare**、**Quiet**、**Balanced**、**Social**、**Very frequent**。中间的 **Balanced** 是默认值。这个值会在使用该日程的所有聊天中覆盖角色自带的默认健谈度。它影响角色主动发消息、追加消息和参与群聊闲聊的频率，同时决定角色的默认每日上限。
- **Wait before checking in**(问候前的等待时长) 指角色开始问候之前需要多久的安静时间，单位是分钟。范围是 15 到 360 分钟，默认 **120**。
- **Check-in moments**(问候时机) 是角色主动来找你的理由，可选项有 **Morning**、**Goodnight**、**Meal breaks**、**After busy** 和 **Long absence**，默认全部开启，点一下就关掉。

### Advanced timing

在 **Tuning** 里展开 **Advanced timing**(高级时间设置)，还有三个控件。

- **Daily safety limit**(每日安全上限) 是这一个角色的硬性上限，可以选 **Default**，也可以填每天 1 到 8 之间的数字。它只能把聊天上限调低，不能调高。一般保持 **Default** 就行。
- **Delay while you're away**(离开时的延迟) 决定角色自身状态为 **Away** 时，发消息前要等多少分钟。留空则用默认值，也就是随机 1 到 3 分钟。范围是 0 到 120 分钟。
- **Delay while you're busy**(忙碌时的延迟) 的作用一样，对应角色状态为 **Busy** 的情况。留空则用默认值，也就是随机 2 到 5 分钟。范围是 0 到 120 分钟。

### Schedule AI：重新起草一周

展开 **Schedule AI**(日程 AI) 部分，可以让模型帮你重写作息。先选一个 **Week action**(整周操作)：

- **Rewrite** 重新起草完整的一周。
- **Adjust** 保留大部分作息，按你的说明做调整。
- **Vary** 生成明显不一样、但依然合理的一周。
- **Repair** 用小改动补上空缺和明显的问题。

可以在 **Week guidance**(整周说明) 框里写点提示，例如：

```
make weekdays more nocturnal, keep weekends social
```

然后点击对应操作的按钮，例如 **Rewrite week**。结果只是草稿，点击 **Save schedule** 之前不会保存任何内容。 如果模型返回无效 JSON，可在**Edit generated schedule JSON**(编辑生成的日程 JSON)中修正，然后选择**Apply to draft**(应用到草稿)。验证通过的修正和成功生成的日期会保留在草稿中，直到保存。调用失败后会停止，不会自动重试。**Stop**或关闭编辑器会取消当前请求。关闭日程管理器或聊天设置，也会取消在其中启动的生成。

### 每日时段块

这几个部分下面，周一到周日各占一行。什么都没安排的那天显示 **No blocks scheduled for this day**。

每个时段块由三部分组成，这一栏标着 **Status, time & activity**：

- 一个**状态**，从 **Online**、**Away**、**Busy**、**Offline** 里选。
- 一个时间范围，写法像 `09:00-11:30`。
- 一句简短的活动说明，例如 `at work`。

点 **Add block** 添加时间范围，点垃圾桶图标删掉一个。每一天还有各自的说明框，标着 **Guide Monday**、**Guide Tuesday**，依此类推。在里面写一句提示，再点对应的按钮，例如 **Regenerate Monday**，就只重新起草那一天。

时段块的状态决定问候时间到了之后角色怎么做。处在 **Offline** 时段块里的角色，那段时间绝不会主动发消息。处在 **Busy** 时段块里的角色，来找你之前要多等三倍的时间。

改完之后点 **Save schedule**。点 **Cancel** 则关闭编辑器，不保存。

### 在角色之间、不同安装之间搬运日程

编辑器底部的 **Export schedule**(导出日程) 可以把当前草稿下载成一个 JSON 文件。导出内容包含每周的时段块、作息摘要、健谈度、问候时机和高级时间设置。

打开另一个角色的日程编辑器，选择 **Import schedule**(导入日程) 加载这个文件。Marinara 会先校验文件再替换编辑器里的草稿，并把导入的作息挪到当前这一周。导入不会自动保存：点 **Save schedule** 保留，点 **Cancel** 则不动这个角色原有的日程。

### Schedule generation preferences

回到 **Chat Settings**，**Schedule generation preferences**(日程生成偏好) 框里可以自由写一段文字，指导作息的编写方式。这是全局设置。下一次生成日程时，它对每个 Conversation 聊天都生效，手动生成和应用自动生成都算。例如：

```
Make everyone go to sleep before midnight. I work 9-5 on weekdays.
```

## 用 /status 设置一次性状态

**/status** 命令用来给角色设置或清除临时状态，不会改动已经保存的日程。它只在 Conversation 模式下有效。

命令格式：

```
/status <online|idle|dnd|offline|clear> [character name]
```

Away 写 `idle`，Busy 写 `dnd`。这四个状态和日程时段块里用的是同一套。要让名叫 Mira 的角色现在显示为忙碌：

```
/status dnd Mira
```

要清除这个临时状态，让 Mira 回到自己的日程：

```
/status clear Mira
```

聊天里只有一个角色时，名字可以省略。不带任何参数运行 **/status**，会列出角色清单和用法说明。

## 自主消息的节奏

Marinara 会控制自主消息的节奏，不让角色刷屏。下面这些规则依据的是每个角色自己的日程。

- 角色会一直等到你安静满 **Wait before checking in** 设定的时长，默认是 120 分钟。
- 当前状态是 **Offline** 的角色不会主动发消息。
- 当前状态是 **Busy** 的角色要多等三倍时间。
- 第一条消息之后，只要你一直不说话，角色最多再发两条，也就是一段沉默期内总共三条。
- 每条追加消息的间隔都比上一条长：第一条追加等基础时长的两倍，第二条等四倍。
- 你一回复，计数就归零，下一段沉默重新开始。

如果几个角色同时都准备好了，健谈度最高、时机最合适的那个先发。

## 你的在线状态

你自己的状态告诉角色你在不在。状态控件在侧边栏底部，任何聊天模式下都看得到，但它对消息的影响只在 Conversation 模式里生效。

点击状态胶囊标记，会展开四个选项：

- **Active**(在线)：你在线，也有空。
- **Idle**(离开)：表示你暂时离开。
- **Do Not Disturb**(勿扰)：停掉所有自主消息。
- **Invisible**(隐身)：对角色隐藏你的状态。

**Idle** 基本上是自动的。状态为 **Active** 且 10 分钟没有任何操作时，Marinara 会把你切到 **Idle**，你回来之后再切回 **Active**。也可以自己在弹出菜单里选 **Idle**。只要手动选过状态，自动切换就会停用，直到你重新选 **Active**。

想清静一会儿就设成 **Do Not Disturb**，开着的时候不会有角色主动来找你。**Idle** 不会拦下自主消息，你离开期间角色照样可以来问候。

状态胶囊标记旁边是 **What are you doing?** 输入框，可以写一句简短的自定义活动，最多 120 个字符。写过的内容会出现在 **Recent status** 列表里，方便重复使用。

## 相关指南

- [Conversation 模式：入门](getting-started.md)
- [Conversation Mode 个人资料（显示名称、自我介绍、行为指令）](profiles.md)
- [聊天设置总览](../chats/chat-settings.md)
