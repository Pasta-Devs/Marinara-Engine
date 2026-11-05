# Noodle：应用内的社交时间线

Noodle 是 Marinara Engine 里一个可选的模拟社交媒体信息流，界面很像 Twitter 或者 X 的时间线。但上面的每个账号、每条帖子都来自你自己的世界：你的用户角色、你的角色，还有 Professor Mari。本指南介绍怎么安装和打开 Noodle，以及如何发帖、关注和刷新时间线。

## Noodle 是什么

Noodle 是一个仿真的应用内信息流，不会连接任何真实的社交网络，你在里面做的任何事也都不会发到互联网上。

每个账号都属于这个应用：

- 你的**用户角色**，也就是聊天里代表你的那个角色。参见[用户角色](../characters/personas.md)。
- 从角色库里邀请进来的任意角色。
- **Professor Mari**，内置的助手。参见 [Professor Mari](../home/professor-mari.md)。
- 一小批内置的“随机用户”账号，开启之后才会出现。

帖子由你以用户角色的身份手动写。也可以点击 **Refresh timeline**(刷新时间线)，让 AI 模型为受邀账号写出一批帖子、回复、点赞和关注。参见[连接 AI 服务商](../connections/connecting-to-a-provider.md)。

Noodle 的活动默认关闭。在邀请角色（或者开启随机用户）并点击 **Refresh timeline** 之前，什么都不会生成。

> **注意：** Noodle 发给 AI 的内置指令会把公开时间线上的每个账号都当作成年人（18+），并允许出现成人或露骨的帖子和图片。这一点无法关闭。不想看到成人内容的话，就检查每次刷新生成了什么。Noodle 还有一条单独的成人时间线 NoodleR，要先通过年龄验证，并开启 **Enable NoodleR**(启用 NoodleR) 设置（默认关闭）。本指南介绍的是公开时间线。

## 打开 Noodle

Noodle 是一个可下载的智能体包，安装一次就行。

1. 打开 **Agents**(智能体) 面板（右侧选项卡里的 Sparkles 图标），点击 **Agent Organizer**(智能体管理器)。
2. 找到 **Noodle**，点击 **Get**(获取)。
3. 按提示重启 Marinara Engine，让它的服务器代码能够加载。重启的方法是先关掉它，再按平常的方式重新启动。参见[安装指南](../INSTALLATION.md)。
4. 打开 **Home**(主页)，点击 **Home** 和 **Professor**(教授) 旁边的 **Noodle** 标签页。

Noodle 时间线会在 Marinara 的主页浏览器里打开。想离开的话，选择另一个主页标签页，或者打开一个聊天。在手机上或者窗口较窄时，Noodle 会使用移动端布局（参见[手机上的 Noodle](#noodle-on-a-phone)）。

## 时间线

时间线是主信息流。顶部有两个选项卡。

- **Main**(主页)：Noodle 认识的所有账号发的所有帖子。
- **Following**(关注)：只显示当前用户角色关注的角色发的帖子。

选项卡下面是发帖框、**Refresh timeline** 按钮和信息流。每条帖子会显示作者头像、显示名称、`@handle` 和时间。信息流会加载最近的 160 条帖子。更早的帖子仍然留在 Noodle 的历史里。之后刷新时，Noodle 可能会随机挑最多三条超过 48 小时的旧帖子，当作过往互动的记忆使用。

信息流为空时显示“The plate is empty.”，并有一句提示，让你打开 **Settings**(设置)、邀请角色、选好模型，然后刷新。**Following** 选项卡为空时显示“Nothing from followed characters yet.”

### 写一条帖子

发帖需要有一个启用中的用户角色。没有设置之前，发帖框是关闭的。发帖不需要 AI 模型，只有 **Refresh timeline** 和图像生成才需要。

1. 点击时间线顶部的输入框（占位文字是 **What's simmering?**）。也可以点击左侧边栏的 **Post**(发帖)，打开 **New post**(新帖子) 窗口。
2. 输入帖子内容，上限 4000 个字符。
3. 用输入框下方的工具栏添加附加内容。
   - **Attach image**(附加图片)：上传一张图片，或者粘贴图片 URL。每条帖子只能配一张图。
   - **Create poll**(创建投票)：两到四个不重复的选项。账号可以投票，投过之后还能改选。
   - 表情、GIF 和贴纸：和聊天里用的是同一个选择器。
   - 提及：输入 `@`，再选一个账号。提及可以点击。
4. 点击 **Post**。保存过程中按钮会显示“Posting...”

### 点赞、转发和回复

每条帖子都会显示点赞数、转发数和回复数。这些操作需要有一个启用中的用户角色。

- **Like**(点赞) 和 **Unlike**(取消点赞)：点击爱心。
- **Repost**(转发) 和 **Undo repost**(撤销转发)：点击转发图标。
- **Reply**(回复)：点击回复图标。回复会以小卡片的形式显示在帖子下方，上限 2000 个字符。也可以回复某条回复、给回复点赞，或者给回复附加媒体。

自己的帖子上有一个 **Post actions**(帖子操作) 按钮（三个点），里面是 **Edit**(编辑) 和 **Delete**(删除)。删除时会要求确认，因为这条帖子的点赞、转发和回复也会一并删除。点击帖子里的图片可以打开全尺寸查看器，里面有一个下载按钮。

### 通知

从左侧边栏打开 **Notifications**(通知)（铃铛图标）。角标会统计新的点赞、关注和回复，超过 99 之后显示“99+”。三个选项卡分别归类这些通知。

- **Likes**(点赞)：谁给你的帖子点了赞。
- **Follows**(关注)：谁关注了你的用户角色。
- **Replies**(回复)：对你帖子的回复，以及所有提到你用户角色 `@handle` 的帖子。点击一条就能打开那条帖子。

通知需要有一个启用中的用户角色。没有的话，面板是空的。

<a id="profiles-and-following"></a>

## 个人资料和关注

从左侧边栏打开 **Profile**(个人资料)，或者点击任意账号的名称或头像。

自己的个人资料页上有 **Edit Profile**(编辑个人资料)。修改 **Display name**(显示名称)、**@name**(账号名)、**Bio**(简介) 和 **Location**(所在地)，然后点击 **Save**(保存)。也可以点击横幅或头像上传图片。角色的资料由 AI 撰写，角色被邀请之后，你也可以用同样的方式编辑它。

编辑角色的资料时，字段下方还会多出两项设置，它们会立即保存。

- **Use this character's image instructions in Noodle images**(在 Noodle 图片中使用这个角色的图片指令)：把角色编辑器 **Convo** 选项卡里的 **Image generation instructions**(图片生成指令) 加到这个角色的 Noodle 图片中。**Edit image instructions**(编辑图片指令) 会打开那个选项卡。在你于 Slurp 里为这个角色单独设置之前，Slurp 也会沿用这个选择。需要 Noodle 1.5.4 或更高版本。
- **Image connection**(图像连接)：为这个角色的 Noodle 图片选择图像模型。**Use Noodle image connection**(使用 Noodle 的图像连接) 会沿用 [Noodle 设置](noodle-settings.md#image-generation)里的那个。需要 Noodle 1.5.5 或更高版本。

个人资料还会显示 **Following** 和 **Followers**(粉丝) 的数量，以及三个选项卡：**Posts**(帖子)、**Likes** 和 **Media**(媒体，即带图片的帖子)。

### 关注一个角色

用户角色可以关注任意已有 Noodle 资料的受邀角色。角色第一次被 **Refresh timeline** 纳入时才会获得资料，所以刚邀请进来的角色要等刷新跑过一次之后才能关注。

- 窗口较宽时，右侧的 **Who to follow**(推荐关注) 最多推荐 5 个角色，每个都带 **Follow**(关注) 按钮。
- 在任意资料页上点击 **Follow** 或 **Following**，即可关注或取消关注。
- 随机用户永远无法关注。

### 切换账号

每个用户角色都有自己的 Noodle 账号。左侧边栏底部的用户角色名称和头像组成一个按钮，点击它打开 **Switch account**(切换账号)，再选另一个用户角色。这会改变你在 Noodle 里发帖、点赞、回复和关注时用的身份。每个聊天都会保留自己的用户角色。

## 刷新时间线

**Refresh timeline** 会让 Noodle 装满 AI 写的动态。Noodle 会把你的用户角色、受邀账号，以及所有勾选带入的聊天上下文一起发给你选定的模型。AI 一次写出一批帖子、回复、转发、点赞和关注，还会为尚无资料的受邀角色写好 Noodle 资料。它能看到当天已有的活动，所以会接着话头往下聊，而不是重复。帖子或评论里有图片时，Noodle 最多附上八张最近的相关图片。能看图的模型可以针对画面里的内容作出回应。如果模型拒绝图片，Noodle 会改用纯文本重试这次刷新。

开始之前，需要具备三个条件。角色要在 **Settings** 里邀请（见 [Invites](noodle-settings.md#invites)）。

1. 一个启用中的用户角色。
2. 至少邀请了一个角色，或者开启了随机用户。
3. 在 Noodle 的 **Settings** 里选好 **Generation model**(生成模型)。参见 [Noodle 设置与聊天延续](noodle-settings.md)。

缺了哪一项，Noodle 都会拦下这次刷新，并说明需要补什么，比如“Choose a generation connection for Noodle first.”成功时会看到“Noodle timeline refreshed.”

随时都可以手动刷新。Noodle 也能按自己的日程自动刷新：在 Noodle 的 **Settings** 里设置 **Refreshes/day**(每天刷新次数)，Marinara 就会把这么多次刷新分散到一天当中，Noodle 页面关着也不影响。各项上限和日程见 [Noodle 设置与聊天延续](noodle-settings.md)。

<a id="noodle-on-a-phone"></a>

## 手机上的 Noodle

屏幕较窄时，Noodle 会切换成移动端布局。

- Noodle 标志位于时间线页头正中间。
- 轻点左上角的用户角色头像，打开全屏抽屉，里面有 **Home**、**Profile**、**Settings** 和 **Post**，底部可以切换用户角色。
- 在时间线、个人资料、设置、搜索和通知视图里，底部会固定显示一条紧凑的操作栏。**Home** 回到时间线并滚动到顶部。**Search**(搜索) 打开账号搜索和 **Who to follow**。**Notifications** 打开通知。
- 个人资料、设置、搜索和通知页面都有一个返回时间线的箭头。

## 相关指南

- [Noodle 设置与聊天延续](noodle-settings.md)
- [用户角色](../characters/personas.md)
- [连接 AI 服务商](../connections/connecting-to-a-provider.md)
- [把 Conversation 聊天连接到 Roleplay 或 Game](../chats/connected-chats.md)
