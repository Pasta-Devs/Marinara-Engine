# Noodle 设置与聊天延续

本指南逐节介绍 **Noodle settings**(Noodle 设置) 面板，列出每一项的默认值和取值范围，同时讲清楚怎么把 Noodle 和聊天连起来。负责这件事的有两个功能：**Carryover to chats**(向聊天延续) 和每个聊天各自的 **Allow Noodle references**(允许引用 Noodle) 开关，它们的方向正好相反。

Noodle 是 Marinara Engine 内置的社交媒体时间线。第一次接触的话，先读 [Noodle：应用内的社交时间线](overview.md)。用户角色就是聊天里自己扮演的那个角色。连接则是保存下来的一套 AI 服务商接入信息，负责生成文字或图像。见[连接 AI 服务商](../connections/connecting-to-a-provider.md)。

## 打开 Noodle 设置面板

1. 从顶栏打开 Noodle。
2. 在左侧边栏点击 **Settings**(设置) 按钮（齿轮图标）。
3. 面板标题显示为 **Noodle settings**。

Noodle 的所有设置都是全局的，对每一个用户角色、每一个聊天都生效，不是只管当前这一个聊天。改动即时保存。

## NoodleR Access(NoodleR 访问)

- **Enable NoodleR**(启用 NoodleR)：开关，默认 **off**。开启后才会显示 NoodleR 账号中心。关闭时，打开 NoodleR 只能看到启用提示页，NoodleR 的账号查询不可用，NoodleR 的账号数据也和 Noodle 时间线彼此隔离。

NoodleR 和 Noodle 是两个各自独立的模拟应用，一个账号只属于其中之一。这种隔离是为了不让 NoodleR 的内容混进 Noodle 时间线，**不是**隐私或安全功能。两边的数据都留在本机，任何能访问这个应用或它的数据文件夹的人都读得到。某一条 NoodleR 帖子谁能看，是另一项按帖子设置的选项，见下面的**订阅与帖子访问权限**一节。

从 **Noodle Settings**(Noodle 设置) > **NoodleR Access** 进入的 **Manage stage profiles**(管理舞台资料) 页面，会列出当前这套安装可用的全部舞台资料，加载中、加载失败和列表为空几种状态也都会显示。一份舞台资料归属于某一个公开的用户角色账号或角色账号，但对外呈现的是它自己的名字、账号名、简介、舞台语气和公开度模式。在舞台资料这个功能上线之前就已经存在的 NoodleR 账号，在补完资料之前会显示 **Setup needed**。

### 舞台身份公开度

公开度决定关联的那个公开身份可以在舞台资料和 AI 生成的帖子里露出到什么程度，它不决定谁能看到资料页或帖子。

- **Publicly connected (Open)**(公开关联)：舞台资料可以大方承认就是同一个人。生成的文字和图像提示词可以直接使用关联身份的公开名字、账号名，以及能被认出来的前后设定。
- **Inspired alter ego (Hinted)**(暗示性马甲)：大致的性格、兴趣和主题会延续过来，但确切的公开名字和账号名会从生成上下文里剔除，帖子保存之前也会从生成的文字和图像提示词里过滤掉。有辨识度的特征仍然可能让人认出来。在创作者资料页上，把鼠标悬停在 **Hinted** 徽章上、让它获得焦点或者点一下，就能看到关联的 Noodle 身份。
- **Separate persona (Secret)**(完全独立)：关联身份只作为不对外的创作灵感使用。生成资料时收到的是一份删减过、不含身份信息的简报，会避开原设定里的职业、人际关系、地点、口头禅和有辨识度的细节，确切的身份标识同样会从生成结果里过滤掉。这不是严格意义上的匿名保证，保存之前先自己看一遍草稿。

在 **Manage stage profiles** 里点 **New profile**(新建资料)，搜索并选中一个符合条件的角色或用户角色。接着设置流程会解释公开度，让你先在 Open、Hinted、Secret 之间做选择，然后才显示可编辑的舞台资料表单。表单可以自己填，也可以让 AI 根据来源角色、公开度选择和可选的补充说明生成一份可编辑的草稿。AI 绝不会自动保存草稿，检查各字段之后由你自己点 **Save stage profile**(保存舞台资料)。想改已有资料的呈现方式，或者让 AI 重新填一遍当前草稿，打开这份资料再点 **Edit profile**(编辑资料)。对观看者来说，Hinted 资料只会通过那个刻意设计的徽章提示露出关联身份的显示名和账号名，不会露出它的账号 ID。Secret 资料则完全不向观看者暴露关联身份的任何信息。

### 引导生成 NoodleR 帖子

每一份舞台资料都带一个内嵌的、默认折叠的 NoodleR 发帖框。标题和正文都可以不填，填好之后点 **Post**(发布)，就会原样发布输入的内容，不经过任何 AI 服务商。正文、图像、投票三者至少要有一个，所以单发一张图或者一个 2 到 4 选项的投票也没问题。上传的图像存在 NoodleR 自己的媒体存储里，不进 Noodle 图库。

点 **Guide**(引导) 会把当前的标题和正文草稿交给现有的 NoodleR 生成器改写。选好的图像、投票、访问级别和 PPV 价格都会保留，生成结果只涉及标题和正文，不会生成或替换附件。还没发布的图像文件和 URL 一直留在当前的客户端草稿里，直到 Post 或 Guide 成功为止。如果发布、引导或者媒体保存失败，当前草稿仍然在，可以改完再试。

帖子的访问级别保护的是整条帖子。处于锁定状态的订阅者帖子和 PPV 帖子不会露出它的图像、投票选项和投票结果。能读到帖子的观看者可以投一次票，之后还能改票；和创作者关联的那个用户角色不能给自己舞台资料下的帖子投票。

## 订阅与帖子访问权限

NoodleR 中心里的创作者页面，永远以当前全局选中的那个用户角色的视角显示。订阅关系和 PPV 解锁记录都属于这个观看用户角色，所以换一个当前用户角色，能看到的创作者和帖子也会跟着变。要新建、编辑或删除自己的舞台资料，走 **Noodle Settings** > **NoodleR Access** > **Manage stage profiles**。

引导生成帖子时，要选一个访问级别：

- **Public**(公开)：所有能看到这份舞台资料的用户角色都能读这条帖子。
- **Subscribers**(订阅者)：帖子保持锁定，直到当前观看的用户角色订阅了这份舞台资料。
- **PPV**(按次付费)：帖子有一个模拟的价格，保持锁定，直到观看的用户角色把它解锁。不会产生任何真实付款。

每一份舞台资料都有自己的 **Subscriber access**(订阅者权限) 设置。**Subscriptions include PPV**(订阅包含 PPV) 开启后，订阅者不用逐条解锁就能读这份资料下的 PPV 帖子，默认关闭。**Hidden from personas**(对指定用户角色隐藏) 会把这份舞台资料和它的全部帖子从选中的观看用户角色那里彻底移除，直接发起的订阅和解锁请求也一并挡掉。隐藏设置只作用于 NoodleR 的舞台资料，不会隐藏它关联的那个公开 Noodle 账号。

在管理列表里对一份舞台资料点 **Delete profile**(删除资料)，会删掉这份舞台资料、它名下发布的全部帖子、它的订阅关系和 PPV 解锁记录。关联的公开 Noodle 账号不会被删除，以后还能用它建新的舞台资料。

## Invites(邀请)

**Invites** 这一节决定哪些角色可以参与 Noodle 刷新。所谓刷新，就是 AI 一次性替受邀账号写出一批帖子、回复、转发和点赞。

- **Professor Mari participates**(Professor Mari 参与)：开关，默认 **on**。关闭后，Noodle 的账号发现里不再出现 Professor Mari，此后生成的帖子、回复、互动、提及、资料生成和向聊天的延续也都不会带上她。已有的时间线历史会保留，重新打开开关就能恢复她的账号。
- **Characters to Invite**(邀请角色)：搜索框。在这里输入内容，可以同时过滤下方的文件夹列表和角色列表。
- **Add from Folder**(从文件夹添加)：点击后展开角色文件夹列表。勾选一个或多个文件夹，再点底部的邀请按钮。按钮上的文字会随选择变化：
  - 一个都没勾选时显示 **Select folders to invite**。
  - 选中文件夹里的角色已经全部受邀时显示 **Selected folder characters are invited**。
  - 有新角色可以添加时显示 **Invite N characters**。
- **Characters**(角色)：可滚动的列表，收录角色库里的每一个角色。每一行都有一个邀请或移除按钮，状态显示为 **Invited**、**Included by folder** 或 **Not invited**。

按文件夹邀请是一次性的批量操作，不是实时同步。之后再往这个文件夹里添加的角色不会自动受邀。

## Refresh(刷新)

**Refresh** 这一节决定 Noodle 用哪个 AI 连接来写内容，以及它自己多久刷新一次。

- **Generation connection**(生成连接)：下拉菜单。选择 Noodle 用来写帖子、回复、转发、点赞和资料文本的连接。初始为空，占位文字是 **Choose connection**。不选一个的话，任何刷新都跑不起来。支持视觉输入的模型还会额外收到最多 8 张来自 Noodle 帖子和评论的近期相关图像。纯文本模型如果拒绝这些图像输入，Marinara 会自动去掉图片重试。
- **Refreshes/day**(每天刷新次数)：数值，0 到 24，默认 **2**。这是 Marinara 每天自动刷新的次数。设为 0 就关闭自动刷新。手动刷新的次数不受它限制。

### Automatic schedule(自动日程)

**Refreshes/day** 大于 0 时，Marinara 会把一天平均切成若干个时间段，在每段里随机选一个时刻。这些日程时刻连同所属时区显示在 **Automatic schedule** 下面。点击未来某个时刻旁边的铅笔图标，可以把它挪到别的整点。已经过去的时刻、已经完成的时刻和与现有时刻重复的时刻都选不了。

自动刷新在 Marinara 服务器里执行。Noodle 页面不必一直开着，但 Marinara 本身必须在运行。刷新失败时，日程表里会显示错误并在稍后重试，连续失败会让等待时间越来越长。如果连着错过好几个日程时刻，Marinara 只用一次成功的补跑刷新把它们一起补上，不会把时间线刷屏。

## NoodleR 自动发布

这是与上方 **Refresh** 分开的日程器。**Refresh** 驱动公开的 Noodle 时间线，而这里驱动 NoodleR 创作者。开启 **Enable NoodleR** 后，它会出现在 **Noodle Settings** > **Publishing** 中。

NoodleR 不会在整点才开始写帖，而是提前把帖子准备到一个小型储备中，并在各自的计划时刻发布。因此，创作者可能会在帖子尚未生成时就显示下一次发帖时间。

- **Automatic posting schedule**：开关，默认 **on**。关闭后会停止所有 NoodleR 自动发布。在关闭期间错过计划时刻的准备帖子会被撤销，而不会延迟发布。
- **Posts/day**：1 到 24，默认 **4**。这是自动文本尝试的每日上限，自动图像尝试也使用相同上限。手动发布和 **Refresh NoodleR now** 不计入其中。
- **Night quiet**：开关，默认 **on**。与**角色**关联的创作者不会获得当地时间 23:00 到 07:00 之间的计划时刻。与用户角色关联的创作者不受影响。
- **Text attempts** 和 **Image attempts**：只读计数器，显示今天已使用的尝试次数以及 **Posts/day** 上限。
- **Prepared posts**：只读，显示储备中的帖子数量及最后一个计划时刻。
- **Refresh all now**：立即为每个已开启 **Automatic** 的创作者写一篇帖子。关闭的创作者完全不参与也不会被报告；正在执行其他任务的创作者会被跳过。以这种方式写出的帖子会撤销同一创作者在接下来一小时内到期的准备帖子。
- **Per creator**：每个创作者行都有 **Automatic** 和 **Images** 开关。在引导设置之外创建的创作者默认两者均为 **off**；通过引导设置创建时则采用你当时的选择。关闭 **Automatic** 后，该创作者只保留手动发布。

创作者自动回复使用单独的全安装上限：所有创作者共享每滚动 24 小时 10 条，而不是每位创作者 10 条。

自动发布在 Marinara 服务器内运行。Marinara 必须保持运行，但不需要一直打开 NoodleR 页面。

## Active Accounts(活跃账号)

**Active Accounts** 这一节决定一次刷新有多少个符合条件的账号参与。符合条件的账号包括受邀角色、因文件夹而纳入的角色，以及开启了随机用户之后的随机用户。

- **Active selection**(活跃账号选取方式)：下拉菜单，默认 **Random range**。可选项为 **Random range**、**Exact count** 和 **All invited**。
- 选 **Random range** 时会出现两个输入框：**Min active**(1 到 100，默认 **2**) 和 **Max active**(1 到 100，默认 **5**)。每次刷新在这个区间里取一个数量。
- 选 **Exact count** 时会出现一个输入框：**Active count**(1 到 100)，账号数量固定为这个值。
- 选 **All invited** 时，所有符合条件的账号全部参与，没有上限。

除了这些账号，当前的用户角色永远符合条件。只要 **Professor Mari participates** 是开着的，Professor Mari 也符合条件。

Noodle 先选定活跃账号，然后才去准备首次的资料。只有还没有生成过 Noodle 资料的活跃角色才会触发一次资料生成请求，没被选中的受邀角色不在其中。写时间线的请求同样只拿到这次刷新选中的那些账号的角色卡。

## Activity(动态)

**Activity** 这一节限制单次刷新最多能产出多少内容。每一项都是按次刷新的上限。

| 项目 | 默认值 | 取值范围 |
|---|---|---|
| **Posts** | 8 | 0 到 100 |
| **Replies** | 12 | 0 到 200 |
| **Reposts** | 4 | 0 到 100 |
| **Likes** | 18 | 0 到 500 |

某一项设为 0，AI 就不会再产出这一类动态。

## Image Generation(图像生成)

**Image Generation** 这一节让 Noodle 给一部分帖子配上 AI 生成的图像。这需要一个图像生成连接，也就是专门为出图配置好的连接。见[支持的 AI 服务商](../connections/providers-reference.md)。

- **Image generation**：开关，默认 **off**。开启后 AI 才能给帖子生成配图。
- 开启之后会多出几个控件：
  - **Image generation connection**(图像生成连接)：下拉菜单，默认 **Default image generation connection**。保持默认时，用的是 Connections(连接) 面板里标记为图像生成默认项的那个连接。
  - **Prompt instructions**(提示词补充说明)：文本框，自带一段默认文字，最多 4000 个字符。这些额外说明会并进图像提示词里。
  - **Use avatar references**(使用头像参考图)：开关，默认 **on**。会把角色的头像或参考图发给图像模型。
  - **Include descriptions**(附带外观描述)：开关，默认 **on**。会把角色写好的外观描述加进图像提示词。
  - **Images/refresh**(每次刷新的图像数)：数值，0 到 50，默认 **3**。这个上限只管生成的帖子配图，对每一次手动刷新和自动刷新分别计算。
- **Attach gallery images**(附带图库图像)：一个独立的开关，默认 **off**。即使 **Image generation** 关着，它也一直显示。它不生成新图，而是让帖子复用该角色图库里的图，或者复用该角色出现过的聊天里的图。

开启了 **Image generation** 却没有可用的图像连接，刷新会被拦下，屏幕上出现提示“Choose an image generation connection for Noodle first.”生成失败的图像会重试一次。第二次仍然失败的话，刷新照常进行，发布一条干净的纯文字帖子，而不会把没用上的图像提示词暴露出来。

Noodle 写这些图像提示词用的模板叫 **Noodle Post Image**，可以在 **Settings** > **Generations** > **Image Generation Prompt Overrides** 里修改。**Prompt instructions** 里的文字会传进这个模板，结果再经过平时用的图像风格方案处理一遍。见[图像与视频的提示词覆盖](../prompts/prompt-overrides.md) 和[图像风格方案](../media/style-profiles.md)。Professor Mari 没有角色卡，所以她的图像帖子用的是她内置的头像和参考图。

## Timeline Writing(时间线写作)

**Timeline Writing** 这一节调节刷新写手的语气和长期记忆行为。

- **Enhanced tone & continuity**(增强语气与连贯性)：开关，默认 **off**。开启后有这些变化：每个账号的说话方式更多地依据它自己的 Personality/Description/Backstory，而不是统一的默认活泼语气；同一次刷新里，账号之间会被鼓励互相回应、引用或者抬杠；对旧帖子的回顾更频繁，而且优先挑选和当前活跃账号相关的帖子，不再纯随机；回顾指令也从不鼓励引用改成允许引用。关闭时完全复现 Noodle 原来的语气和回顾行为，所以时间线会不会变，只取决于这个开关开不开。
- **Use generated character schedules**(使用已生成的角色日程)：开关，默认 **off**。开启后，如果参与的角色已经有今天生成好的 Conversation 日程，Noodle 就会把它带上。Noodle 自己不生成也不刷新日程。无论这个开关开还是关，每一次时间线刷新都会带上本地的当前日期和时间。

## 自定义时间线写手的语气

Noodle 的刷新写手遵循一套内置的语气和创作自由度指令：每个账号的帖子该带多少个性，账号之间可以怎样斗嘴、开玩笑或者起冲突。这段文字可以在 **Settings** > **Generations** > **Image Generation Prompt Overrides** > **Noodle Timeline Voice & Tone** 里重写（这一节的标题虽然写着“Image”，但列表里收的是所有可自定义的 Noodle 和 Conversation 文本提示词，不只是图像相关的）。在你自定义之前，那里显示的默认文字会跟随上面的 **Enhanced tone & continuity** 开关；一旦保存了自己的文字，无论开关是什么状态都以你的文字为准。

这个覆盖项只管语气和风格。保证刷新结果有效的那些规则（允许哪些结构化动作、互动必须怎样指定目标等等）不在这段文字里，任何时候都生效，所以重写语气不会把刷新搞坏。

## World / Lore(世界与设定)

**World / Lore** 这一节让刷新能调用世界书条目，用的就是聊天生成时的同一套世界书系统。

- **Lorebook context**(世界书上下文)：开关，默认 **off**。开启后，每一次刷新都会在近期的 Noodle 帖子和回复文本以及活跃角色的资料里查找世界书关键词，把命中的条目作为世界设定上下文，提供给这次参与的账号。只有关联到活跃角色的世界书（或者标记为全局的世界书）才会触发。触发的世界设定内容每次刷新有 8,192 个 Token(模型切分文本的最小单位) 的硬上限。这项默认关闭，不主动开启就不会影响已有的时间线。

## Carryover(延续)

**Carryover** 这一节把近期的 Noodle 动态推送进聊天。开启后，聊天的提示词里会多出一段“Recent Social Media Activity”内容，说明角色们最近在 Noodle 上做了什么。

- **Carryover to chats**：三个各自独立的开关，默认全部 **off**，分别是 **Conversations**、**Roleplays** 和 **Games**。想让哪种模式收到 Noodle 动态，就开启哪一个。
- **Carry hours**(延续时长)：数值，1 到 720，默认 **48**。表示 Noodle 往回追溯多少小时之内的动态。
- **Carry items**(延续条数)：数值，1 到 50，默认 **8**。表示一个聊天回合最多加入多少条动态摘要。

延续只取那些在 Noodle 上受邀的角色的动态，外加这个聊天当前的用户角色。仅仅因为文件夹而被纳入，在这里是不够的。
包装好的整段延续内容，在每次聊天生成时另有 8,192 个 Token 的硬上限。如果按条数上限会超出预算，Marinara 会保留放得下的最新几条摘要，并按时间先后顺序排列。

## Reset Noodle(重置 Noodle)

**Reset Noodle** 这一节清空时间线，同时保留账号和设置。

1. 点击 **Reset Noodle Timeline**(重置 Noodle 时间线) 按钮。
2. 弹出一个标题为 **Reset Noodle Timeline** 的窗口，内容是“This removes all posts, replies, likes, reposts, activity digests, and refresh records. Profiles, follows, invites, and settings stay.”
3. 点击 **Reset timeline** 确认。

这个操作只删除时间线内容。账号、账号名、简介、关注关系、邀请状态和每一项 Noodle 设置都原样保留。

## Random users(随机用户)

随机用户是 6 个内置的背景账号，不来自角色库：Thread Countess、Packet Soup、Orbit Notice、Glass Bulletin、Moth Hour 和 Brine Index。每个都有一小段风味简介。

开启它们的开关是 **Invites** 一节中 **Characters** 列表顶部的 **Random users** 那一行，默认 **off**。开启时它的副标题显示 **Enabled**，关闭时显示 **Ambient fake profiles**。开启后，这些账号可以在刷新中发帖、点赞、转发、回复和关注别人。它们的资料页上永远没法关注它们。

## 把 Noodle 和聊天连起来

Noodle 和聊天可以双向共享上下文。这是两个各自独立的功能，开启一个不等于开启另一个。

**Carryover to chats**(在 Noodle 设置里开启) 把 Noodle 动态送进聊天，也就是上面 Carryover 一节说的，给那个聊天的提示词加上“Recent Social Media Activity”段落。

**Allow Noodle references** 是每个聊天各自的开关，方向相反，把聊天里的动态送进 Noodle。它在聊天自己的设置里，靠近 **Connected Chats**(关联聊天) 区域。见[聊天设置总览](../chats/chat-settings.md)。每个聊天默认都是 **off**。它的说明文字是“Timeline refreshes may include recent messages from this chat, with the chat name, mode, and participants stated in the prompt.”如果这个聊天同时还跑着[角色日程](../conversation/schedules.md)，那么角色在这个故事里的当前状态和活动（例如“currently dnd (At the office)”）会连同消息一起带上，范围只限这一个聊天。

想让 Noodle 动态出现在某个聊天里，就开启对应模式的 **Carryover to chats**。想让 Noodle 刷新能读到某个聊天，就开启那个聊天的 **Allow Noodle references**。两者可以单独用，也可以一起用。

## 故障排查

- **刷新之后什么都没生成**：选好 **Generation connection**，至少邀请一个角色（或者开启随机用户），再看看 **Refresh** 一节里显示的错误。
- **自动刷新一直不发生**：把 **Refreshes/day** 设成大于 0，保持 Marinara 服务器运行，并核对 **Automatic schedule** 下面的日程时刻和时区。如果日程表里显示错误，先解决连接或速率限制的问题，然后等重试自己跑。
- **帖子里没有提到最近的聊天**：在那个聊天的设置里开启 **Allow Noodle references**，并确认角色已经受邀。聊天上下文只是给 AI 的参考，不是保证。
- **Noodle 动态没有出现在聊天里**：开启对应模式的 **Carryover to chats**，如果动态太旧，就把 **Carry hours** 调大。
- **帖子没有配图**：开启 **Image generation**，选一个能用的图像连接，再检查 **Images/refresh** 的上限。

## 设置项与默认值

下表列出每一项 Noodle 设置的默认值和取值范围。

| 设置项 | 默认值 | 取值范围或选项 |
|---|---|---|
| **Enable NoodleR** | off | on 或 off |
| **Generation connection** | 无 | 任意文本连接（刷新必需） |
| **Professor Mari participates** | on | on 或 off |
| **Refreshes/day** | 2 | 0 到 24(设为 0 关闭自动刷新) |
| **Automatic posting schedule** | on | on 或 off |
| **Posts/day** | 4 | 1 到 24 |
| **Night quiet** | on | 角色创作者跳过 23:00–07:00 |
| 每位创作者的 **Automatic** | off | 引导设置可以将其开启 |
| 每位创作者的 **Images** | off | 引导设置可以将其开启 |
| 创作者自动回复 | 每 24 小时 10 条 | 全安装共享，而非每位创作者 |
| **Active selection** | Random range | Random range、Exact count、All invited |
| **Min active** | 2 | 1 到 100(仅 Random range) |
| **Max active** | 5 | 1 到 100(仅 Random range) |
| **Active count** | 与 Max active 相同 | 1 到 100(仅 Exact count) |
| **Posts** | 8 | 0 到 100 |
| **Replies** | 12 | 0 到 200 |
| **Reposts** | 4 | 0 到 100 |
| **Likes** | 18 | 0 到 500 |
| **Image generation** | off | on 或 off |
| **Image generation connection** | Default | 任意图像生成连接 |
| **Prompt instructions** | 内置文字 | 最多 4000 个字符 |
| **Use avatar references** | on | on 或 off |
| **Include descriptions** | on | on 或 off |
| **Images/refresh** | 3 | 0 到 50 |
| **Attach gallery images** | off | on 或 off |
| **Lorebook context** | off | on 或 off |
| **Enhanced tone & continuity** | off | on 或 off |
| **Carryover: Conversations** | off | on 或 off |
| **Carryover: Roleplays** | off | on 或 off |
| **Carryover: Games** | off | on 或 off |
| **Carry hours** | 48 | 1 到 720 |
| **Carry items** | 8 | 1 到 50 |
| **Allow Noodle references**(每个聊天) | off | on 或 off |

## 相关指南

- [Noodle：应用内的社交时间线](overview.md)
- [聊天设置总览](../chats/chat-settings.md)
- [连接 AI 服务商](../connections/connecting-to-a-provider.md)
- [支持的 AI 服务商](../connections/providers-reference.md)
