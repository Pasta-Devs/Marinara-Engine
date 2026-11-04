# Marinara Engine 入门

Marinara Engine 是一个用来和 AI 角色聊天、玩角色扮演的应用。它跑在你自己的电脑上。本指南介绍主页，以及开始第一次聊天的步骤。

## 开始第一次聊天

开始之前：你需要一个 AI 服务发的 API 密钥（一串秘密字符，作用类似密码），或者使用下文介绍的 **Built-in model**(内置模型)。

1. 安装 Marinara Engine，然后在浏览器里打开它。到 [Marinara Engine 安装](../INSTALLATION.md)里选择你的平台。
2. 添加一个账号。一个账号就是某个 AI 服务的一个 API 密钥。见[连接 AI 服务商](../connections/connecting-to-a-provider.md)。
3. 挑选这个账号要用的模型。同一篇指南里有操作方法。
4. 创建或导入一个角色。打开 **Characters**(角色) 面板，点击 **New**(新建) 打开 **Create Character**(创建角色) 窗口，或者点击 **Import**(导入) 从文件导入一张角色卡。见[创建和编辑角色](../characters/creating-and-editing-characters.md)。
5. 用侧边栏按钮打开聊天侧边栏。它的选项卡写着 **CONVO**、**RP** 和 **GM**。选一个，然后点击 **+** 按钮。这个按钮会随选项卡叫作 **New Conversation**、**New Roleplay** 或 **New Game**。
6. 按照打开的设置窗口操作，然后点击 **Create Chat**(创建聊天)。

你会看到：新聊天打开，你可以写第一条消息了。

如果你还没有账号，会先打开添加账号的窗口，最后一步是 **Start chatting**(开始聊天)。如果 **Set Up**(设置) 窗口要你选择账号，就从列表里选一个，然后点击 **Create Chat**。

Marinara 不自带在线 AI。多数人会连到在线服务。你也可以下载 **Built-in model**，这是一个在你电脑上运行、不需要 API 密钥的小模型。它适合做轻量的辅助工作，不适合当主力聊天模型。见[内置模型设置](../connections/local-model.md)。

第一次打开 Marinara 时，会开始一段简短的引导。见[首次使用的引导教程](tutorial.md)。哪一步卡住了？问问内置助手 Professor Mari：[Professor Mari，你的应用内助手](professor-mari.md)。

## 主页一览

没有打开任何聊天时，显示的就是主页。它看起来像一个网页浏览器：顶部是标签页和书签，下面是小组件。

- **标签页。**主页面是 **Home**(主页)。**Professor**(教授) 会打开 Professor Mari。有些已安装的智能体会添加自己的标签页。
- **搜索栏。**在电脑上，点击标签页下方的搜索栏，或者按 <kbd>Ctrl</kbd>+<kbd>K</kbd>(Mac 上是 <kbd>⌘</kbd>+<kbd>K</kbd>)，即可查找聊天、角色、设置等内容。手机、平板和窄窗口上不显示这个搜索栏。
- **书签。**通往 **Discord**、**Support**(支持)、**Credits**(致谢)、**Documentation**(文档)、**Tutorial**(教程)、**FAQ**(常见问题)、**Achievements**(成就) 和 **Widgets**(小组件) 的快捷链接。**Achievements** 只有开启了成就设置才会显示。书签只在 **Home** 标签页上显示。在手机、平板或窄窗口上，点击标签页左侧的书签按钮（**Open bookmarks**(打开书签)），就能以列表形式查看它们。

中间是应用图标、**Marinara Engine** 字样和版本号。下面的 **Conversation**(对话模式)、**Roleplay**(角色扮演) 和 **Game**(游戏模式) 按钮，分别以对应模式新建一个聊天。

<a id="choose-a-chat-mode"></a>

## 选择聊天模式

新建聊天时选择一种模式。

- **Conversation**：普通的 AI 聊天，界面像即时通讯软件。见 [Conversation 模式：入门](../conversation/getting-started.md)。
- **Roleplay**：和一个或多个角色一起展开的故事。应用会追踪场景，比如地点和时间。见 [Roleplay 模式：入门](../roleplay/getting-started.md)。
- **Game**：单人游戏。AI 担任讲故事的游戏主持人（Game Master）。你会有一队同伴（队伍）、掷骰、地图和任务。见 [Game Mode：入门](../game/getting-started.md)。

<a id="home-widgets"></a>

## 主页小组件

小组件是可以显示、隐藏和移动的小卡片。

1. 点击书签里的 **Widgets**。**Home Widgets**(主页小组件) 窗口随即打开。它把小组件分别列在 **Built-in**(内置)、**Agents**(智能体) 和 **Personal**(个人) 下。
2. 点击小组件旁边的眼睛按钮即可显示或隐藏它。重新显示的小组件会放到主页上第一个空位。
3. 要移动小组件，拖动它右上角的手柄。在电脑上，指针移到小组件上时手柄才会出现。

你的布局保存在这个浏览器里。个人小组件还有编辑和删除按钮。窗口底部的 **Browser chrome**(浏览器外框) 有一个开关：**Show URL bar**(显示地址栏) 用来在电脑上显示或隐藏搜索栏。

你可以请 Professor Mari 为你做一个个人小组件。已安装的智能体也能添加小组件。

## 参考：内置小组件

| 小组件 | 作用 | 初始是否显示 |
| --- | --- | --- |
| **Professor Mari** | **Ask Professor Mari**(问问 Professor Mari) 会打开她的聊天。 | 是 |
| **Recent chats**(最近聊天) | 你最近的聊天。点击某个聊天即可重新打开。为空时显示 **Your chats will show here**(你的聊天会显示在这里)。 | 是 |
| **Learn the engine**(了解引擎) | 链接到 **Documentation**、**Replay tutorial**(重看教程) 和 **Read FAQ**(查看常见问题)。 | 是 |
| **What's New**(新功能) | **See what's new**(查看新功能) 和 **Read release notes**(查看发行说明)。 | 是 |
| **Community**(社区) | 链接到 **Discord**、**Support** 和 **Credits**。 | 是 |
| **Character Library**(角色库) | 每天从你的角色里挑选一批新的展示。 | 否 |
| **Discovery desk**(发现台) | 你还没安装的智能体。**Browse agents**(浏览智能体) 会打开目录。 | 否 |
| **Character of the Day**(今日角色) | 从你的角色库里选出的一个角色，带有 **Start a chat**(开始聊天) 和 **View character**(查看角色)。 | 否 |
| **Clock & calendar**(时钟与日历) | 今天的日期和时间。 | 否 |
| **Achievements** | 你最近获得的成就和最接近完成的成就。需要开启成就设置。 | 否 |

## 到哪里求助

- 在主页上问 Professor Mari。
- 打开 **FAQ** 书签，查看速查答案。
- 打开 **Documentation** 书签，阅读应用内指南。
- 点击 **Discord** 进入社区，或者点击 **Support** 支持这个项目。

如果哪里坏了，见 [Marinara Engine 故障排查](../TROUBLESHOOTING.md)。

## 相关指南

- [Marinara Engine 安装](../INSTALLATION.md)
- [连接 AI 服务商](../connections/connecting-to-a-provider.md)
- [创建和编辑角色](../characters/creating-and-editing-characters.md)
- [首次使用的引导教程](tutorial.md)
- [Professor Mari，你的应用内助手](professor-mari.md)
