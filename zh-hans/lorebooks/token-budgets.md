# 世界书的 Token 预算与递归扫描

预算限制送进 AI 的世界书文字量，免得世界书把聊天内容挤出去。本指南涵盖每本世界书的 **Token Budget**(Token 预算) 和 **Entry Limit**(条目上限)、聊天的 **Lorebook Token Budget**(世界书 Token 预算)、Marinara 怎么裁剪条目，以及 **Recursive**(递归) 扫描。

Token 是模型计数用的一小段文本。模型的上下文窗口是它一次能读进去的文字量，以 Token 计。世界书文字和提示词的其余部分共用这个窗口。

## 两种 Token 预算

Marinara 每次组装提示词时都会套用两种预算。只要某个条目会让其中任意一个超出上限，它就会被跳过。

- 每本世界书都有自己的 **Token Budget**：这本世界书在单次回复里最多能加的 Token 数。
- 每个聊天有一个 **Lorebook Token Budget**：所有启用的世界书加起来最多能加的 Token 数。

## 设置世界书的 Token Budget 和 Entry Limit

1. 从 **Lorebooks**(世界书) 面板打开一本世界书。
2. 点击 **Overview**(总览) 选项卡。
3. 设置 **Token Budget** 和 **Entry Limit**。

| 设置 | 默认值 | 作用 |
| --- | --- | --- |
| **Token Budget** | 2048 | 这本世界书在单次回复里最多加入的 Token 数。0 表示不限。 |
| **Entry Limit** | 100 | 这本世界书在单次回复里最多加入的条目数。范围是 1 到 1000。 |

**Entry Limit** 算的是条目数，不是 Token 数。世界书达到其中任意一个上限，就不再加入条目。

举个例子，**Token Budget** 是 2048 时，单个 3000 Token 的条目永远加不进去。某本世界书占的位置太多，就调低预算；重要条目老是被跳过，就把预算调高。

## 设置聊天的 Lorebook Token Budget

1. 打开一个聊天。
2. 打开 **Chat Settings**(聊天设置)。
3. 找到 **Lorebooks** 分区，设置 **Lorebook Token Budget**。

默认值是 8192，0 表示不限。它是这个聊天里所有启用世界书的总量，叠加在每本世界书自己的 **Token Budget** 之上。

## Marinara 怎么裁剪条目

匹配到的条目超出预算允许的量时，Marinara 按下面的顺序加入条目。

1. **Constant** 条目。
2. 匹配到最新几条消息的条目。
3. 其余条目，按它们的注入顺序（条目的 **Order**(顺序) 字段）。

Marinara 把还放得下的条目逐个加进去。某个条目放不下时，就跳过它，继续检查其余条目，所以大条目被跳过之后，小条目照样有机会进来。

<a id="seeing-skipped-entries-in-active-context"></a>

## 在 Active Context 里查看被跳过的条目

1. 打开 **Chat Settings**。
2. 展开 **Active Context**(活动上下文)。它显示最近一次世界书扫描的结果。

如果有匹配上的条目被跳过，顶部会出现一条提示：“N matching lore entries were skipped by token budget.”它会列出跳过了条目的每一项预算，并说明去哪里修改。展开它，就能看到每个被跳过的条目、它所属的世界书、匹配到的关键词、估算的大小，以及预算已经用掉了多少。原因是下面几种之一。

| 原因 | 含义 |
| --- | --- |
| **lorebook budget** | 这个条目放不进那本世界书的 **Token Budget**。 |
| **chat budget** | 这个条目放不进聊天的 **Lorebook Token Budget**。 |
| **lorebook and chat budgets** | 两个上限都已经满了。 |
| **current-location context cap** | 这个条目挂在当前地图地点上，而这个地点有自己固定的 2,048 Token 上限。 |

正文为空的条目，或者经宏处理后什么都不剩的条目，不会列在这里。它里面的宏照样会运行，所以其中的 `{{setvar}}` 依然会设置变量。两个预算都设为 0 时，只有地点上限还可能让这里列出被跳过的条目。

如果大世界书总是被跳过，**Active Context** 会建议改用 **Knowledge Retrieval**(知识检索) 或 **Knowledge Router**(知识路由) 智能体。见[知识源](../agents/knowledge-sources.md)。它们通常比调高上限更适合大世界书。

## 递归扫描

一般情况下，Marinara 只在最近的消息里找关键词。开启 **Recursive** 后，它还会扫描新激活条目的正文，这样一个条目就能把相关条目一并拉进来。

1. 打开世界书，点击 **Overview**。
2. 开启 **Recursive**。它默认是关闭的。
3. 想调整连锁能走多远，就设置 **Max Depth**(最大深度)。

**Max Depth** 是额外扫描的轮数。默认是 3，范围是 1 到 10。数值越大，找出的关联设定越多，消耗的处理量也越大。

每个条目也有自己的 **Recursion**(递归) 开关，默认关闭，它决定这个条目的内容能不能触发更多条目。除非这个条目确实需要连锁，否则就让它关着。见[世界书条目：关键词、位置与时机](entries.md)。

递归不会绕开预算。递归扫描找出来的条目，同样计入 **Token Budget**、**Entry Limit** 和聊天的 **Lorebook Token Budget**。

## 相关指南

- [世界书条目：关键词、位置与时机](entries.md)
- [世界书总览](overview.md)
- [知识源：Knowledge Retrieval 与 Knowledge Router 智能体](../agents/knowledge-sources.md)
