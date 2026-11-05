# 智能体：聊天里的 AI 帮手

智能体是一批小型 AI 帮手，在主聊天回复的前后运行。有的追踪时间和天气，有的挑选角色表情，还有的为重要时刻画一张图。本指南介绍如何安装智能体、在聊天里开启它们，以及如何确认它们运行过。

## 智能体是什么

智能体按聊天开启，不按角色开启。同一个角色的两个聊天，可以运行不同的智能体。

全新安装不带任何可选智能体。从 **Agent Organizer**(智能体管理器) 安装它们，这是官方一键安装包的商店。源码和目录都公开在 [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents)。通过 **Agent Organizer** 安装，Marinara 才能校验兼容性、权限和文件哈希。每个智能体是做什么的，见[可下载智能体参考](built-in-agents.md)。想自己做一个，见[创建自定义智能体](custom-agents.md)。

## 把智能体加进聊天

开始之前：先安装智能体。打开 **Agents**(智能体) 面板（右侧选项卡里的 Sparkles 图标），点击 **Agent Organizer**，打开该智能体的页面，再点击 **Get**(获取)。见[安装和更新智能体](#install-and-update-agents)。

1. 打开聊天。
2. 打开 **Chat Settings**(聊天设置)，找到 **Agents** 部分。
3. 开启 **Enable Agents**(启用智能体)。这是总开关，关闭时这个聊天不会运行任何智能体。
4. 点击 **Add Agent**(添加智能体)，打开该智能体所属的分组（比如 **Writer Agents**(写作智能体) 或 **Misc Agents**(其他智能体)），然后选中它。

添加过的智能体会列为已激活，每个后面带一个小的移除按钮。智能体随时都可以添加或移除。

> **注意：** 每个聊天模式只显示能在该模式下工作的智能体。在 Conversation(对话模式) 里，已安装的游戏会出现在游戏选择器里，**Calls**(通话) 会加上工具栏控件。在 Game Mode(游戏模式) 里，创建游戏时选择智能体，或者之后再添加。

如果某个智能体没有运行，检查 **Enable Agents** 是否开着、这个智能体在当前聊天里是否已激活，以及它的模式和你的聊天是否相符。

### Agents 部分里的更多控制项

这些控制项也在同一个 **Agents** 部分里。

- **Agent Menus**(智能体菜单)（仅限 Roleplay）：点击某个智能体的名字，就能跳到它的设置。
- **Trackers Control**(追踪器控制)（仅限 Roleplay）：一张默认收起的卡片，里面是下面这些追踪器选项。
- **Agent Suite**：打开一个查看器，可以读取和编辑智能体为这个聊天存下的内容。
- **Review Agent Outputs**(审核智能体输出)：让世界书、摘要和角色卡的改动先等你批准。在 Roleplay 里，它位于 **Trackers Control** 中。见[智能体审批与 Agent Suite](approvals-and-agent-suite.md)。

**Trackers Control** 里的选项：

- **Attach chat summaries**(附加聊天摘要)：默认关闭。把已保存的聊天摘要加进智能体请求，重试时也一样。这不会从主回复中删除摘要，也不会停止生成摘要。能访问完整主提示词的智能体仍可在那里读到摘要。
- **Attach Lorebooks to Trackers**(为追踪器附加世界书)：追踪器智能体也会收到主回复用到的世界书条目。聊天里有了追踪器智能体之后才会显示。
- **Individual tracker schedule**(单独的追踪器运行计划)：让某个追踪器不再每次回复之后都运行，改由你从 HUD(Roleplay 里屏幕上的状态浮层) 手动运行。

### 为单个智能体设置参考世界书

1. 在 **Chat Settings** 中打开 **Agents**，再打开这个智能体的设置。
2. 开启 **Attach lorebook for the specific agent**(为此智能体附加世界书)。它默认关闭。
3. 在 **Reference lorebook**(参考世界书) 里选择一本世界书。

这个选择只属于当前聊天中的这个智能体。匹配的条目遵循正常的世界书触发规则，提供给这个智能体，手动重试时也一样。这项设置不会把这本书加给主回复或无关的智能体，但一起运行的智能体也可能看到相同的条目。已删除或不可用的世界书不会提供任何条目。

## 智能体什么时候运行

每个智能体都在回复前后的某一个时间点运行，这个时间点叫作它的 **pipeline phase**(流水线阶段)。每个内置智能体都有默认值，你可以在智能体编辑器里修改。

| 阶段 | 运行时机 | 例子 |
| --- | --- | --- |
| **Pre-Generation**(生成前) | 在回复之前。它可以往提示词里补充上下文。 | 知识查询 |
| **Parallel**(并行) | 和回复同时。它改不了回复。 | 实时观众反应 |
| **Post-Processing**(后处理) | 在回复之后。它能读到回复，重写类智能体还能修改回复。 | 大多数追踪器、文风清理、图像 |

<a id="tell-whether-an-agent-ran"></a>

## 怎么判断智能体运行过

- 追踪器智能体会写入 HUD 和追踪器面板。时间、地点、心情或数值有变化，就说明有追踪器运行过。
- **Chat Settings** 里的 **Agent activity**(智能体活动) 会列出智能体留下的简短记录。智能体工作时它的图标会旋转，有智能体失败时图标上会出现一个圆点。见[智能体活动](../roleplay/getting-started.md#agent-activity)。
- **Prose Guardian** 和 **Continuity Checker** 会改动回复文本。回复变得更干净或错误得到纠正，就说明它们运行过。
- 想看完整的追踪记录，在 **Settings → Advanced → Message Tools**(设置 → 高级 → 消息工具) 里开启 **Debug mode**(调试模式)。它会把每个智能体的提示词和响应记到服务器控制台，智能体的调试条目也会出现在浏览器控制台里。缓存的提示词注入显示在 **Agent activity** 的 **Injections**(注入) 选项卡里。

## 留意开销

每个智能体都会加上自己的指令，往往还要单独调用一次模型。共用同一个连接的智能体，Marinara 会尽量合并成一次调用。

智能体列表上方有一处读数，估算每一轮额外多出的 Token(模型切分文本的最小单位) 和调用次数。点读数旁边的帮助图标可以看详细说明。负担很重时，读数会变成琥珀色并带上警告图标。实际开销比这更高，因为每次调用都会带上聊天历史和角色详情。

看到警告的话，可以移除用不上的智能体，或者把一部分挪到更便宜的连接或本地连接上。连接上保存的 **Reasoning Effort**(推理强度) 也会应用到使用这个连接的智能体。见[智能体参数](../prompts/generation-parameters.md#parameters-for-agents)。

<a id="install-and-update-agents"></a>

## 安装和更新智能体

打开 **Agents** 面板（右侧选项卡里的 Sparkles 图标），点击 **Agent Organizer**。桌面端和移动端都能用。

- **Home**(主页) 显示精选智能体，以及每个分区的一排智能体：**Apps**(应用)、**Chat games**(聊天游戏)、**Trackers**(追踪器) 和 **Writing help**(写作帮助)。
- **Updates**(更新) 列出有新版本的已安装智能体。**Installed**(已安装) 列出你拥有的全部内容，附带版本和大小。
- 搜索和模式筛选可以缩小每份列表的范围。
- 选中一个智能体，可以看到它的说明、下载体积、权限、兼容性和 **Version history**(版本历史)。点击 **Get** 安装。**⋯** 菜单里有 **Uninstall**(卸载)。
- 标题旁的 **⋯** 菜单里有 **Update all**(全部更新)、**Install all**(全部安装)、**Refresh catalog**(刷新目录) 和 **Uninstall all**(全部卸载)。

已安装的智能体分成 **Apps**、**Writer Agents**、**Tracker Agents**(追踪器智能体) 和 **Misc Agents** 几组，你自己做的则放在 **Custom Agents**(自定义智能体)。**Apps** 是有自己 Home 标签页的包，比如 Noodle 和 Slurp。它们单独使用，不用添加到聊天里。

标为 **Rules**(规则) 的包不是智能体。它添加一个 Game Mode 规则集，例如 5e (SRD 5.1)，创建游戏时在 **Rules** 下选择它。见[使用规则集游玩](../game/rulesets.md)。5e 包仍是预览版，所以只有 `staging` 分支上的 Engine 会列出它。

卸载一个包会删掉它的代码和设置，但会保留你的聊天消息和历史记录。删除自定义智能体则是彻底删除。

### 更新智能体

已安装的包有兼容的新版本时，会弹出 **Agent updates available**(有智能体更新可用) 窗口，列出每项更新的版本，以及是否需要重启。

1. 不想要哪项更新，就取消它的勾选。所有更新默认勾选。
2. 如果包发布了更新日志，可以在 **What's new**(更新内容) 里阅读。**More**(更多) 会完整显示较长的说明。带圆点的是你会注意到的改动。
3. 点击 **Update all**；如果取消了部分勾选，按钮会显示 **Update 2 of 3**(更新 3 项中的 2 项)。每一行会显示 **Updated**(已更新) 或 **Failed**(失败)。失败的行会显示原因和 **Retry**(重试)。
4. 如果某项更新需要重启，点击 **Restart now**(立即重启)，或者稍后再重启 Marinara。

点击 **Not now**(暂不更新) 保留当前版本。你跳过的版本，Marinara 不会再问。你随时都可以在 **Agent Organizer** 里更新。已安装的包会一直以当前版本工作，即使连不上目录也一样。**See in Agent Organizer**(在智能体管理器中查看) 会打开该智能体的页面。

更新只针对你安装过的包。包保存在 Marinara 服务器上，所以浏览器客户端使用的是服务器上安装的包。

从内置这些功能的旧版 Engine 升级上来时，Marinara 会把对应的包下载一次，并保留你的聊天选择、设置和历史记录。如果连不上目录，它会在下次启动时重试。

## 相关指南

- [可下载智能体参考](built-in-agents.md)
- [2D 和 3D 虚拟形象](avatars.md)
- [创建自定义智能体](custom-agents.md)
- [智能体审批与 Agent Suite](approvals-and-agent-suite.md)
- [Roleplay 的 HUD 与追踪器](../roleplay/hud-and-trackers.md)
