# 成就

本指南介绍 Marinara Engine 的成就功能。成就是一批纯装饰性的徽章，用着用着就会陆续解锁。下面讲清楚在哪里查看、完整清单有哪些、开关在哪里，以及解锁是怎么判定的。

## 成就是什么

成就就是一枚枚可以收集的小徽章。平时该干什么干什么，比如新建聊天、新建角色、新建用户角色，或者点开社区链接，Marinara Engine 会在后台悄悄把对应的徽章解锁。

成就纯粹是装饰。它不会解锁任何功能，也不会改变应用的行为，只是一种记录自己做过什么的小乐趣。

进度保存在本地，跟着当前使用的档案走。换一份档案，或者重装一遍，解锁记录就是空的。由于这些记录和其他档案数据存在一起，做完整备份时会一并带走。

## 打开 Achievements 面板

**Achievements**(成就) 按钮在主页上。没有打开任何聊天时看到的界面就是主页。按钮在 Professor Mari 聊天框的正下方，图标是一个奖杯。

按钮标签下方会实时显示进度，比如 **12 of 23 unlocked**。还在加载时，这里显示的是 **Checking the collection...**。

打开面板的步骤：

1. 回到主页。
2. 找到 Professor Mari 聊天框下方的 **Achievements** 按钮。
3. 点击。

**Achievements** 窗口会打开。顶部是一行汇总文字，比如 **12 of 23 achievements unlocked in this profile.**，下面是成就卡片组成的网格。

每张卡片包含徽章图标、标题、分类标签和一句简短说明。未解锁的卡片标题显示为 **?????**，图标是一把锁，解锁之前看不到具体内容。拿到之后，卡片上会出现 **unlocked** 标签。带目标数量的卡片还会多一行 **Progress**(进度) 和一条进度条。

只有 **Achievements** 设置处于开启状态，按钮和面板才会出现，详见下面的设置一节。应用里没有第二个入口能看到成就。

## 23 项成就

一共 23 项成就，分成四类：**Milestone**(里程碑)、**Community**(社区)、**Creation**(创作) 和 **Collection**(收藏)。

有些成就只解锁一次。**Creation** 和 **Collection** 这两类是分级的，三个等级分别标记为 **I**、**II**、**III**，对应 5、25、100 三个门槛。所以到了第二级，徽章标题会变成 **Hoarder II** 这样的形式。

| 成就 | 分类 | 解锁条件 |
|---|---|---|
| **Diligent Student** | Milestone | 完成或跳过首次使用教程。 |
| **Hello World** | Milestone | 在主页给 Professor Mari 发出第一条消息。 |
| **One Of Us** | Community | 点击主页页脚的 **Discord** 链接。 |
| **Based Backer** | Community | 点击主页页脚的 **Support** 链接（会跳转到 Ko-fi）。 |
| **Backseat Appreciator** | Community | 点击主页页脚的 **Credits** 按钮。 |
| **Who Needs IRL Friends** | Creation | 创建 Conversation 模式的聊天（5、25、100）。 |
| **They Feel Real To Me** | Creation | 创建 Roleplay 聊天（5、25、100）。 |
| **I Have No Other Hobbies** | Creation | 创建 Game Mode 的聊天（5、25、100）。 |
| **Hoarder** | Collection | 收集角色（5、25、100）。 |
| **The World's A Stage** | Collection | 收集世界书（5、25、100）。 |
| **I Am A Gamer** | Collection | 收集用户角色（5、25、100）。 |

关于这份清单，有几点补充：

- 用户角色就是在聊天里代表你本人的那份资料。世界书则是一组背景设定条目，AI 可以随时调用。
- **Collection** 类成就统计的是资料库里该类型的全部内容。导入和下载来的同样计数，不限于自己做的。**Hoarder** 有一个例外：内置的 Professor Mari 角色永远不计入。
- 社区类成就只要点开链接就算数，不需要在对方网站上注册或者完成任何操作。

## 智能体的成就

已安装的智能体可以添加自己的成就。它们显示在同一个 **Achievements** 窗口中，位于内置成就之后，归在 **From Noodle**(来自 Noodle) 这样的标题下。只有添加了成就的智能体才会显示这个区块。

智能体的成就遵循与内置成就相同的规则。它们起初处于锁定状态，有些带有进度条，解锁时也会弹出相同的通知。智能体可以在已解锁的卡片上显示自己的徽章图片。

移除智能体后，它的区块会消失。解锁记录仍会保留。如果重新安装该智能体，已经解锁的成就会再次显示为已解锁。

窗口顶部的总数也包含你已安装的智能体所提供的成就。

## Achievements 设置

整个功能可以用一个开关关掉。打开 **Settings**(设置)，切到 **General**(常规) 选项卡，找到 **App Behavior**(应用行为) 部分。开关的名字是 **Achievements**，默认开启。

帮助文字写的是：“Shows the Home achievements button and unlock notifications. Tracking stays silent in the current profile when this is off.”

这个开关的效果如下：

- 开启：主页显示 **Achievements** 按钮和窗口，每次解锁都会弹出提示。
- 关闭：按钮隐藏，弹出提示也不再出现。应用仍会在后台默默记录解锁情况。

因为关闭期间统计照常进行，进度不会丢。以后重新打开，这段时间里赚到的成就已经都在了。

## 解锁是怎么判定的

Marinara 会拿分级成就和当前的实时计数做比对。触发比对的时机有两个：一是发生了被统计的操作，比如创建聊天或者点击页脚链接；二是打开 Achievements 面板的时候。

如果某个操作触发了解锁，而且设置是开启的，屏幕上会弹出一条小提示，标题是 **Achievement unlocked**，正文写明是哪一枚徽章，比如 **Hoarder II** 或者 **One Of Us**。

打开面板同样可能补发一批徽章，也就是那些其实早就达成、只是还没记上的。这类补发是静默的，卡片直接变成已解锁，不会弹提示。

成就一旦解锁就永久保留。哪怕之后删掉聊天、角色、世界书或用户角色，计数掉回门槛以下，徽章也不会重新上锁。

有一点需要有心理准备：已解锁卡片上的 **Progress** 进度条显示的仍然是当前的实时计数。所以徽章明明已经拿到手，卡片上却可能写着 **2 / 5**，这是正常现象。

应用里没有任何按钮可以重置或清空成就。

## 相关指南

- [Marinara Engine 入门](welcome.md)
- [首次使用的引导教程](tutorial.md)
- [Professor Mari，你的应用内助手](professor-mari.md)
- [连接 AI 服务商](../connections/connecting-to-a-provider.md)
