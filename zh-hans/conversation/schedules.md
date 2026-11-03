# 角色日程与自主消息

自主消息是你安静一段时间之后，角色主动发给你的消息。日程是角色的每周计划，让它在不同时段显得清醒、忙碌或在睡觉。两者都只在 Conversation(对话模式) 中生效。

日程是可选的。关闭日程后，角色仍会根据健谈度（角色主动开启对话的频率）和你的在线状态来主动联系你。

如果你只想设置日程，请直接跳到[开启日程](#turn-on-schedules)。

## 开启自主消息

**开始之前：** 打开一个 Conversation 聊天。新聊天默认开启此功能（参见[Conversation 模式：入门](getting-started.md)）。

1. 在聊天中打开 **Chat Settings**(聊天设置)。
2. 找到 **Autonomous Messaging**(自主消息设置) 部分。
3. 开启 **Autonomous Messages**。

如果没有成功：当你的在线状态为 **Do Not Disturb**(勿扰) 时，角色会保持沉默（参见[你的在线状态](getting-started.md#your-presence-status)）。

### 设置问候次数上限

在 **Chat Settings → Autonomous Messaging** 中，**Chat Check-In Cap**(问候次数上限) 限制角色每天在这个聊天中可以发送的问候次数。

- **Default chat ceiling (talkativeness-based)** 会使用每个角色健谈度决定的上限（见下表）。
- **Numeric value** 会显示数字输入框，可以输入任意 1 或更大的整数。数字越大，模型请求和通知可能越多。

角色还可以在自己的日程中设置单独的 **Daily safety limit**(每日安全上限)。角色的上限按以下规则生效：

- 聊天上限设为 **Numeric value**，且设置了 **Daily safety limit**：以较小的数字为准。
- 只设置了其中一个：以该数字为准，即使它高于下表中的健谈度数字。
- 两者都未设置：数字取自角色的健谈度。

| 角色健谈度 | 每天问候次数 |
| --- | --- |
| 80 或更高 | 8 |
| 60 到 79 | 6 |
| 40 到 59 | 5 |
| 20 到 39 | 3 |
| 低于 20 | 2 |

<a id="turn-on-schedules"></a>
## 开启日程

**开始之前：** 开启 **Autonomous Messages**。

1. 在 **Chat Settings → Autonomous Messaging** 中开启 **Schedules**(日程)。（在新建聊天向导中，同一选项叫 **Generate Schedules**(生成日程)。）已有的日程会立即显示。
2. 在其下方的字段中选择你的时区。
3. 点击 **Generate**(生成)，为尚无日程的角色生成日程。日程存在后，按钮会显示 **Regenerate**(重新生成)。
4. 等待生成完成。随后会出现 **Edit schedules**(编辑日程) 列表，每个角色占一行。每行显示已安排的天数（例如 **3 days scheduled**），或显示 **Create schedule**(创建日程)。只有存在日程后，列表才会显示。
5. 点击某个角色的行，打开其日程编辑器（见下一节）。

日程属于角色，会在每个 Conversation 聊天中复用。在某个聊天中关闭 **Schedules**，只会让该聊天中的日程保持关闭，日程本身会保留。

除非你在 **Character Schedule Manager**(角色日程管理器) 中为该角色开启 **Renew weekly**(每周更新)，否则自动每周更新默认关闭。点击侧边栏底部状态框旁边的日历按钮即可打开它。

每次加载应用页面时，Marinara 会对每个聊天尝试一次更新。如果失败，在你重新加载页面之前不会再次尝试。点击 **Generate** 即可重试。

**Schedule generation preferences**(日程生成偏好) 位于 **Chat Settings** 中同一个 **Schedules** 区域，它保存着关于如何编写日程的自由文本指导。下次生成日程时，它会应用于每个 Conversation 聊天。示例：

```text
Make everyone go to sleep before midnight. I work 9-5 on weekdays.
```

## 日程编辑器

编辑器的标题由 **Edit**、角色名和 **Schedule** 组成。

编辑器顶部的 **Routine profile**(作息概况) 用通俗的语言概括一周的安排。点击 **Generate summary**(生成摘要) 即可生成它，点击 **Refresh summary**(刷新摘要) 即可更新它。修改日程后，会出现 **Summary may be stale**(摘要可能已过时) 提示。**Generation model**(生成模型) 用来选择负责编写日程的模型。

### 调节

打开 **Tuning**(调节)，即可看到主要控件。

- **Chat talkativeness**(聊天健谈度)：一个滑块，档位有 **Rare**、**Quiet**、**Balanced**、**Social** 和 **Very frequent**。默认是 **Balanced**。它决定角色主动发消息和加入群聊闲聊的频率，也决定它的默认每日上限。
- **Wait before checking in**(问候前等待)：角色可以开始问候之前，需要保持安静的分钟数。默认为 120。可以设为 15 到 360。
- **Check-in moments**(问候时机)：包括 **Morning**、**Goodnight**、**Meal breaks**、**After busy** 和 **Long absence** 几个标签。默认全部开启。点击某个标签即可关闭它。

在 **Tuning** 中展开 **Advanced timing**(高级时间设置)，可以看到另外三个控件。

- **Daily safety limit**(每日安全上限)：这个角色每天最多的问候次数。保持 **Default** 即可，也可以输入 1 或更大的整数。如果聊天也设置了数字上限，以较小的数字为准；否则，这个数字会取代健谈度对应的数字。
- **Delay while you're away**(离开时的延迟)：角色状态为 **Away** 时，回复前额外等待的分钟数。留空则随机等待 1 到 3 分钟。可以设为 0 到 120。
- **Delay while you're busy**(忙碌时的延迟)：角色状态为 **Busy** 时的相同设置。留空则随机等待 2 到 5 分钟。可以设为 0 到 120。

### Schedule AI：重新起草一周

展开 **Schedule AI**(日程 AI)，让模型重写日程。选择一个 **Week action**(整周操作)：

| 操作 | 结果 |
| --- | --- |
| **Rewrite** | 重新起草一整周的新草稿。 |
| **Adjust** | 保留大部分日程，并应用你的指导。 |
| **Vary** | 生成明显不同、但仍然可信的一周。 |
| **Repair** | 用小改动修补空缺和明显的问题。 |

1. 选择一个 **Week action**。
2. 在 **Weekly generation**(整周生成方式) 下，选择 **Entire week in one request**(整周一次请求) 或 **One request per day**(每天一次请求)。每天一次请求会发出七个较小的请求，可能消耗更多 Token(模型切分文本的最小单位)。
3. 在 **Week guidance**(整周说明) 中输入可选的提示，例如 `make weekdays more nocturnal, keep weekends social`。
4. 点击写有你所选操作的按钮，例如 **Rewrite week**(重写整周)。
5. 点击 **Save schedule**(保存日程) 保留结果。在此之前，它只是草稿（**Unsaved draft**(未保存的草稿)）。

如果没有成功：草稿会保留。失败的调用不会自动重试，因此请再次点击按钮。点击 **Stop**(停止) 或关闭编辑器，即可取消正在运行的请求。如果编辑器显示 **Edit generated schedule JSON**，表示模型返回了它无法读取的文本。请在那里修正文本，然后点击 **Apply to draft**(应用到草稿)。

### 每日时段

从周一到周日，每一天各占一行。没有安排的那天会显示 **No blocks scheduled for this day**。每个时段包含一个状态、一个时间范围（例如 `09:00-11:30`）和一段简短的活动（例如 `at work`）。

1. 点击某一天下方的 **Add block**(添加时段)。
2. 选择状态：**Online**、**Away**、**Busy** 或 **Offline**。
3. 输入时间范围和活动。
4. 点击 **Save schedule**。**Cancel**(取消) 会关闭编辑器，但不保存。

使用垃圾桶图标可以删除一个时段。要重新起草某一天，请在 **Guide Monday**(或你想要的那一天)中输入提示，然后点击 **Regenerate Monday**。

在 **Offline** 时段内，角色绝不会先发消息。在 **Busy** 时段内，它等待的时间是平常的三倍。

### 在角色之间移动日程

点击 **Export schedule**(导出日程)，把草稿下载为 JSON 文件（包括每周时段、摘要、健谈度、问候时机和时间设置）。在另一个角色的编辑器中，点击 **Import schedule**(导入日程) 加载该文件。Marinara 会检查文件，并把日程移到当前这一周。点击 **Save schedule** 之前，不会保存任何内容。

## 用 /status 设置状态

`/status` 为角色设置或清除临时状态，不会改变已保存的日程。它只在 Conversation 模式中生效。这个状态属于角色本身，因此它会应用于该角色所在的每个聊天。

在消息框中输入以下命令之一：

```text
/status dnd Mira
/status clear Mira
```

第一条命令会让 Mira 进入忙碌状态。第二条会让她回到自己的日程。如果聊天中只有一个角色，可以省略名字。单独输入 `/status` 会列出角色和用法。

完整格式如下。`idle` 表示 **Away**，`dnd` 表示 **Busy**。方括号表示名字可以省略。

```text
/status online|idle|dnd|offline|clear [character name]
```

你设置的状态会一直保留，直到你清除它，角色无法替换它。

## 让角色更改自己的状态

在 **Chat Settings → Agents → Commands** 中开启 **Schedule Updates**(更新日程) 后，角色可以设置它自己的临时状态和活动。例如，如果你请它专心一小时，它可以切换到 **Busy**，并把活动设为 “Studying”。

- 这项改动持续的时间由角色指定；如果角色没有指定，则为一小时。最长为七天。
- 时间到后，角色会回到自己的日程；如果没有日程，则回到 **Online**。
- 它绝不会编辑已保存的日程。

## 问候节奏

| 规则 | 说明 |
| --- | --- |
| 第一次问候 | 角色会等到你保持安静达到它的 **Wait before checking in** 时间（默认为 120 分钟）。 |
| 回应 | 你只做出回应、没有发送新消息时，会开始较短的等待。 |
| **Offline** 状态 | 不进行问候。 |
| **Busy** 状态 | 等待时间为三倍。 |
| 追加问候 | 只要你保持安静，最多再追加两条，共三条。第一条追加在两倍等待时间后发出，第二条在四倍等待时间后发出。 |
| 你的回复 | 计数归零。 |
| 多个角色已准备好 | 健谈度最高、时机最合适的角色先发。**Online** 的角色排名更靠前。 |

在每个角色各自回复的群聊中（参见[群聊](../chats/group-chats.md)），角色共享同一个每日上限和同一套节奏。任何角色完成问候之后，下一次问候无论来自谁，都要像追加消息那样等待。自己的等待时间已过的角色都可以发出问候，当天问候次数最少的角色优先。长时间离开之后，只会有一个角色进行问候。

## 相关指南

- [Conversation 模式：入门](getting-started.md)
- [Conversation Mode 个人资料（显示名称、自我介绍、行为指令）](profiles.md)
- [聊天设置总览](../chats/chat-settings.md)
