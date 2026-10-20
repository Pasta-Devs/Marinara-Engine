# Marinara Engine 入门

欢迎使用 Marinara Engine。本指南介绍这个应用是什么、主页上各部分都是什么，以及开启第一次聊天要做的几步。全文面向新手，不需要任何配置经验。

## Marinara Engine 是什么

Marinara Engine 是一个本地应用，用来和 AI 角色聊天、玩角色扮演。它跑在自己的电脑上，再接到一家自选的 AI 服务上。角色可以自己创建，也可以导入现成的，选好聊天方式就能开聊。Marinara 本身不运行 AI，所以第一件事是添加一个连接。多数人会连到线上的 AI 服务商。应用也内置了一个可下载的小型 **Local Model**(本地模型)，它适合做些轻量的辅助工作，不适合当主力聊天模型，详见[本地模型设置](../connections/local-model.md)。这一步配置完成后，剩下的事情在应用里就能全部搞定。

## 主页一览

没有打开任何聊天时，看到的就是主页。它看起来有点像网页浏览器：顶部是标签页和书签，下面是一张摆着小组件的桌面。

顶部有这几个部分：

- **标签页。**主页是 **Home**(主页)。**Professor**(教授) 会打开 Professor Mari，也就是能讲解应用、帮你完成配置的内置助手。有些已安装的智能体会添加自己的标签页。
- **搜索栏。**在电脑上，点击标签页下方的搜索栏，或者按 Ctrl+K(Mac 上是 Cmd+K)，就能查找聊天、角色、设置等内容。
- **书签。**通往 **Discord**、**Support**(支持)、**Credits**(致谢)、**Documentation**(文档)、**Tutorial**(教程)、**FAQ**(常见问题)、**Achievements**(成就) 和 **Widgets**(小组件) 的快捷链接。**Achievements** 只有开启了成就设置才会显示。在手机上，点击标签页左侧的书签按钮，就能以列表形式查看它们。

中间是应用图标、**Marinara Engine** 字样和版本号。下面的 **Conversation**、**Roleplay** 和 **Game** 按钮分别以对应模式新建一个聊天。

第一次打开 Marinara 时会有一段简短的引导，指出主要按钮和几种聊天模式。完整流程见[首次使用的引导教程](tutorial.md)。

<a id="home-widgets"></a>

## 主页小组件

主页的其余部分由小组件组成：可以显示、隐藏和四处移动的小卡片。应用自带这些小组件：

| 小组件 | 作用 | 初始是否显示 |
| --- | --- | --- |
| **Professor Mari** | 点击 **Ask Professor Mari**(问问 Professor Mari) 打开她的聊天。 | 是 |
| **Recent chats**(最近聊天) | 显示你最近的聊天及其最后一条消息。点击某个聊天即可重新打开。一个聊天都还没有时，显示 **Your chats will show here**(你的故事从这里开始)。 | 是 |
| **Learn the engine**(了解引擎) | 链接到 **Documentation**、**Replay tutorial**(重看教程) 和 **Read FAQ**(查看常见问题)。 | 是 |
| **What's New**(新功能) | **See what's new**(查看新功能) 会再次打开这个版本的 What's New 窗口，即使你之前关掉了它。**Read release notes**(查看发行说明) 会在网页上打开完整的发行说明。 | 是 |
| **Community**(社区) | 链接到 **Discord**、**Support** 和 **Credits**。 | 是 |
| **Character Library**(角色库) | 每天从你的角色里挑选一批新的展示。 | 否 |
| **Discovery desk**(发现台) | 推荐你还没安装的智能体。用箭头查看更多，或者用 **Browse agents**(浏览智能体) 打开目录。 | 否 |
| **Character of the Day**(今日角色) | 从你的角色库里选出的一个角色，带有 **Start a chat**(开始聊天) 和 **View character**(认识这个角色)。 | 否 |
| **Clock & calendar**(时钟与日历) | 今天的日期和时间。 | 否 |
| **Achievements** | 你最近获得的成就和最接近完成的成就。只有开启了成就设置才可用。 | 否 |

有些已安装的智能体也会添加小组件。你也可以请 Professor Mari 为你做一个个人小组件。

要选择显示哪些小组件，点击书签里的 **Widgets**。**Home Widgets**(主页小组件) 窗口会把它们分别列在 **Built-in**(内置)、**Agents**(智能体) 和 **Personal**(个人) 下。点击小组件旁边的眼睛按钮即可显示或隐藏它。重新显示的小组件会放到主页上第一个空位。个人小组件还有编辑和删除按钮。

要移动小组件，拖动它右上角的手柄。在电脑上，指针移到小组件上时手柄才会出现。使用键盘时，聚焦手柄后按方向键。你的小组件布局保存在这个浏览器里。

**Home Widgets** 窗口底部的 **Browser chrome**(浏览器外框) 有三个开关：**Show URL bar**(显示地址栏) 用来显示或隐藏搜索栏，**Other-tab bookmarks (desktop)**(其他标签页的书签，桌面端) 和 **Other-tab bookmarks (mobile)**(其他标签页的书签，移动端) 让书签在 **Home** 以外的标签页上也保持显示。

## 上手第一步

按顺序做完下面几步，就能开始第一次聊天。

1. 安装 Marinara Engine，然后在浏览器里打开。到 [Marinara Engine 安装](../INSTALLATION.md)里选择自己的平台。
2. 添加一个连接，应用才能接上 AI 服务。一个连接会保存服务商、API 密钥和模型。API 密钥是一串秘密字符，作用有点像密码，由 AI 服务商发放。参见[连接 AI 服务商](../connections/connecting-to-a-provider.md)。
3. 创建或导入一个用来聊天的角色。打开 **Characters**(角色) 面板，点击 **New**(新建) 打开 **Create Character**(创建角色) 窗口，或者点击 **Import**(导入) 从文件导入一张角色卡。参见[创建和编辑角色](../characters/creating-and-editing-characters.md)。
4. 开始聊天。在聊天侧边栏里选一个模式选项卡，然后点击 **+** 按钮。这个按钮会随选项卡变成 **New Conversation**、**New Roleplay** 或 **New Game**。新聊天打开后会弹出一个设置窗口，带着走完剩下的步骤。如果还没有保存过任何连接，会先出现 **Set Up Conversation**、**Set Up Roleplay** 或 **Set Up Game** 窗口。在那里选好连接，再点击 **Create Chat**。

哪一步卡住了，就去问内置助手。读一读 [Professor Mari，你的应用内助手](professor-mari.md)，看看她都能做什么。

## 三种聊天模式

Marinara 有三种聊天模式，新建聊天时选择其中一种。

- **Conversation**(对话模式)：朴素直接的 AI 聊天，没有角色扮演成分，界面像即时通讯软件。参见 [Conversation 模式：入门](../conversation/getting-started.md)。
- **Roleplay**(角色扮演)：沉浸式角色扮演，带角色、场景追踪和世界状态。参见 [Roleplay 模式：入门](../roleplay/getting-started.md)。
- **Game**(游戏模式)：由 AI 担任游戏主持人（GM）的单人角色扮演游戏，有队伍、骰子、地图和任务。参见 [Game Mode：入门](../game/getting-started.md)。

## 到哪里求助

不用离开应用就有好几种求助途径：

- 在主页问 **Professor Mari**，配置问题和操作方法都能答。
- 看主页上的 **FAQ**，常见问题在那里有速查答案。
- 用主页上的 **Documentation** 书签打开应用内指南。
- 点击 **Discord** 书签进入社区，或者点击 **Support** 支持这个项目。

如果哪里坏了、用不了，参见 [Marinara Engine 故障排查](../TROUBLESHOOTING.md)。

## 相关指南

- [Marinara Engine 安装](../INSTALLATION.md)
- [连接 AI 服务商](../connections/connecting-to-a-provider.md)
- [创建和编辑角色](../characters/creating-and-editing-characters.md)
- [首次使用的引导教程](tutorial.md)
- [Professor Mari，你的应用内助手](professor-mari.md)
- [Conversation 模式：入门](../conversation/getting-started.md)
- [Roleplay 模式：入门](../roleplay/getting-started.md)
- [Game Mode：入门](../game/getting-started.md)
