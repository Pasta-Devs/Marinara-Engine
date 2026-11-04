# Noodle 设置与聊天延续

用 **Noodle settings**(Noodle 设置) 面板来决定谁参与时间线、各自发多少内容，以及 Noodle 怎样和聊天共享上下文。有两个功能按相反的方向共享上下文：**Carryover to chats**(向聊天延续) 和每个聊天各自的 **Allow Noodle references**(允许引用 Noodle) 开关。

第一次接触 Noodle 的话，先读 [Noodle：应用内的社交时间线](noodle.md)。用户角色就是聊天里你扮演的那个角色。AI 账号见[连接 AI 服务商](../connections/connecting-to-a-provider.md)。

## 打开设置

1. 从 **Home**(主页) 打开 Noodle。
2. 在左侧边栏点击 **Settings**(设置)（齿轮图标）。标题显示为 **Noodle settings**。
3. 用标题下方的按钮选择一个页面。

| 页面 | 分区 |
|---|---|
| **General**(常规) | [Refresh](#refresh)、[Translation](#translation) |
| **Timeline**(时间线) | [Activity](#activity)、[Image Generation](#image-generation) |
| **Participants**(参与者) | [Invites](#invites)、**Ambient Profiles**(背景账号)（见 [Random users](#random-users)）、[Active Accounts](#active-accounts) |
| **Advanced**(高级) | **Noodle Prompt**(Noodle 提示词)、[Image Understanding](#image-understanding)、[Timeline Writing](#timeline-writing)、[World / Lore](#world--lore)、[Carryover](#carryover)、[Reset Noodle](#reset-noodle) |

Noodle 的所有设置都是全局的，对每一个用户角色、每一个聊天都生效。改动即时保存。完整的默认值列表见[设置项与默认值](#settings-and-defaults)。

<a id="refresh"></a>

## Refresh(刷新)

刷新就是 AI 替受邀账号写出一批帖子、回复、转发和点赞。这一节设置 Noodle 用来写内容的模型，以及它自己多久刷新一次。

- **Generation model**(生成模型)：Noodle 用来写帖子、回复、转发、点赞和资料文本的模型。初始未设置，占位文字是 **Choose connection**。不选一个的话，任何刷新都跑不起来。能看图的模型还会收到最多八张来自帖子和评论的近期相关图片。纯文本模型如果拒绝这些图片，会去掉图片重试。
- **Refreshes/day**(每天刷新次数)：0 到 24，默认 **2**。每天自动刷新的次数。设为 0 就关闭自动刷新。它不限制手动刷新。

### Automatic schedule(自动日程)

**Refreshes/day** 大于 0 时，Marinara 会把一天平均切成若干个时间段，在每段里随机选一个时刻。计划好的时刻连同所属时区显示在 **Automatic schedule** 下面。点击未来某个时刻旁边的铅笔图标，可以把它挪到别的整点。已经过去的、已经完成的和重复的时刻都选不了。

自动刷新在服务器里执行，所以 Noodle 页面可以关掉，但 Marinara 必须在运行。刷新失败时，日程里会显示错误并在稍后重试，连续失败后等待时间会更长。如果错过了好几个计划时刻，一次成功的补跑刷新就会把它们一起补上。

<a id="translation"></a>

## Translation(翻译)

**Translate posts automatically**(自动翻译帖子)（默认 **off**，需要 Noodle 1.5.0 或更高版本）会在每一条不由你的用户角色发出的帖子和评论下方显示译文，不用再逐条点击 **Translate**(翻译)。Noodle 沿用从某个聊天的 **Translation** 设置里保存下来的翻译默认设置（**Save translator defaults**(保存翻译默认设置)）。没有保存过默认设置时，它用 Google Translate 翻译成英语。见[消息翻译](../integrations/message-translation.md)。本来就是目标语言的文字不会再多出一份译文，你隐藏的译文会一直保持隐藏，关闭这个开关后，还在等待的翻译会停止。

不管是自动翻译的，还是点 **Translate** 翻译的，译文都保存在当前这个浏览器里。刷新、离开 Noodle 或者重新加载页面之后，译文会重新显示。换一台设备，或者换成清除了数据的浏览器，就会重新翻译。**Reset Noodle Timeline**(重置 Noodle 时间线) 也会清掉这些译文。

<a id="invites"></a>

## Invites(邀请)

**Invites** 这一节决定哪些角色可以参与刷新。

- **Professor Mari participates**(Professor Mari 参与)：默认 **on**。关闭后，账号发现里不再出现她，此后的新帖子、回复、互动、提及、资料生成和向聊天的延续也都不会带上她。已有的历史会保留，重新打开就能恢复她的账号。
- **Characters to Invite**(邀请角色)：一个搜索框，可以同时过滤文件夹列表和角色列表。
- **Add from Folder**(从文件夹添加)：展开你的角色文件夹。勾选一个或多个，再点底部的邀请按钮。一个都没勾选时，按钮文字是 **Select folders to invite**；选中的角色已经全部受邀时是 **Selected folder characters are invited**；有新角色可以邀请时是 **Invite N characters**。
- **Characters**(角色)：角色库里的每一个角色。每一行都有一个邀请或移除按钮，以及一个状态：**Invited**、**Included by folder** 或 **Not invited**。

按文件夹邀请是一次性的批量操作，不是实时同步。之后再往文件夹里添加的角色不会自动受邀。

<a id="random-users"></a>

## Random users(随机用户)

随机用户是 6 个内置的背景账号，不来自你的角色库：Thread Countess、Packet Soup、Orbit Notice、Glass Bulletin、Moth Hour 和 Brine Index。每个都有一小段简介。

在 **Invites** 里 **Characters** 列表顶部的 **Random users** 那一行开启它们。默认 **off**，关闭时显示 **Ambient fake profiles**，开启时显示 **Enabled**。开启后，它们可以在刷新中发帖、点赞、转发、回复和关注。它们永远无法被关注。

**Participants** 页面上的 **Ambient Profiles** 可以编辑这些身份，或者重新生成一组不同的身份。重新生成会保留帖子和关系，但会移除资料图片。

<a id="active-accounts"></a>

## Active Accounts(活跃账号)

**Active Accounts** 这一节决定一次刷新有多少个符合条件的账号参与。符合条件的账号包括受邀角色、因文件夹而纳入的角色，以及开启后的随机用户。除此之外，当前的用户角色永远符合条件，Professor Mari 参与期间也一样。

- **Active selection**(活跃账号选取方式)，默认 **Random range**：可选 **Random range**、**Exact count** 或 **All invited**。
- **Random range** 会显示 **Min active**(1 到 100，默认 2) 和 **Max active**(1 到 100，默认 5)。每次刷新在这两者之间取一个数量。
- **Exact count** 会显示 **Active count**(1 到 100)。
- **All invited**：所有符合条件的账号全部参与，没有上限。

Noodle 先选定活跃账号，然后才去准备首次的资料。只有还没有生成过资料的活跃角色才会收到资料请求。写时间线的请求也只拿到这次刷新选中的那些账号的角色卡。

<a id="activity"></a>

## Activity(动态)

每一项都限制单次刷新最多能产出多少内容。某一项设为 0，就不再产出这一类动态。

| 项目 | 默认值 | 取值范围 |
|---|---|---|
| **Posts** | 8 | 0 到 100 |
| **Replies** | 12 | 0 到 200 |
| **Reposts** | 4 | 0 到 100 |
| **Likes** | 18 | 0 到 500 |

<a id="image-generation"></a>

## Image Generation(图像生成)

这一节让 Noodle 给一部分帖子配上 AI 生成的图像。这需要一个图像模型。见[支持的 AI 服务商](../connections/providers-reference.md)和[图像生成服务商与设置](../media/image-providers.md)。

- **Image generation**(图像生成)：默认 **off**。开启后 AI 才能给帖子生成配图，同时会出现更多控件。
- **Image width**(图像宽度) 和 **Image height**(图像高度)：64 到 4096 像素，默认宽 **1024**、高 **1536**。
- **Image generation connection**(图像生成连接)：默认 **Default image generation connection**，也就是 **Connections**(连接) 里标记为图像默认项的那个模型。角色也可以用自己的（见[个人资料和关注](noodle.md#profiles-and-following)）。
- **Image instructions (sent to your LLM)**(图像指令，会发给你的 LLM)：内置文字，最多 4000 个字符。时间线模型给每条帖子写配图描述时会遵循它，所以要写成指示，而不是图像标签。想把风格标签直接发给图像模型，就用风格方案。
- **Use avatar references**(使用头像参考图)：默认 **on**。把角色的头像或参考图发给图像模型。
- **Interpret image prompts**(解读图像提示词)：默认 **on**。由一个文本模型改写每段图像提示词，改写时遵循你的图像模型的 **Image prompting instructions**(图像提示词指令) 和风格方案里的 Style text(风格描述)。关闭时不使用这些指令，Style text 按原样加入。
- **Include descriptions**(附带外观描述)：默认 **on**。把角色写好的外观描述加进图像提示词。开启 **Interpret image prompts** 时，文本模型会把它们融进提示词，而不是直接粘贴。
- **Images/refresh**(每次刷新的图像数)：0 到 50，默认 **3**。限制每一次手动或自动刷新生成的帖子配图数量。

**Attach gallery images**(附带图库图像)（默认 **off**）是一个独立的开关，即使图像生成关着也一直显示。它不生成新图，而是让帖子复用该角色图库里的图，或者该角色所在聊天里的图。

如果没有成功：开启了图像生成却没有可用的图像模型，刷新会被拦下，提示“Choose an image generation connection for Noodle first.”生成失败的图像会重试一次。第二次仍然失败的话，刷新照常继续，发布一条干净的纯文字帖子。

这些图像提示词的模板叫 **Noodle Post Image**，可以在 **Settings → Generations → Image Generation Prompt Overrides**(设置 → 生成 → 图像生成提示词覆盖) 里修改。你的图像指令会传进这个模板，结果再经过你的风格方案处理。见[图像与视频的提示词覆盖](../prompts/prompt-overrides.md)和[图像风格方案](../media/style-profiles.md)。Professor Mari 没有角色卡，所以她的图像帖子用的是她内置的头像和参考图。

<a id="image-understanding"></a>

## Image Understanding(图片理解)

这一节决定时间线写手怎样看到时间线上已有的图片。

- **Show images to the writer**(把图片给写手看)：默认 **on**。写手的模型接受图片时，最多会收到八张近期的时间线图片。关闭后，什么图片都收不到。
- **Image captioning**(图像描述)：由一个能看图的模型描述时间线图片，这样纯文本的写手也能跟上。在你改动之前，它跟随 **Generation model** 的图像描述设置。**Use connection default**(使用连接默认值) 会恢复成跟随。
- **Captioning model**(描述用模型)：开启图像描述时出现。**Use Noodle generation connection**(使用 Noodle 生成连接) 会使用 **Generation model**。那个模型看不了图片时，就另选一个。

即使关闭了 **Show images to the writer**，图像描述仍会把时间线图片发给描述用模型。

<a id="timeline-writing"></a>

## Timeline Writing(时间线写作)

这一节调节刷新写手的语气和记忆。

- **Enhanced tone & continuity**(增强语气与连贯性)：默认 **off**。开启后，每个账号的说话方式更多地依据它自己的 Personality、Description 和 Backstory，而不是默认的活泼语气。同一次刷新里，账号之间会被鼓励互相回应、引用或者抬杠。对旧帖子的回顾更频繁，而且优先挑选和活跃账号相关的帖子。回顾指令也从不鼓励引用改成允许引用。关闭时完全保留 Noodle 原来的语气和回顾方式。
- **Use generated character schedules**(使用已生成的角色日程)：默认 **off**。开启后，如果参与的角色已经有今天生成好的 Conversation 日程，Noodle 就会把它带上。Noodle 自己不生成也不刷新日程。无论开还是关，每次刷新都会带上本地的当前日期和时间。

### 自定义写手的语气

写手内置的语气和创作自由度指令可以在 **Settings → Generations → Image Generation Prompt Overrides → Noodle Timeline Voice & Tone** 里重写。这一节的标题虽然写着“Image”，但列表里收的是所有可自定义的 Noodle 和 Conversation 文本提示词。在你保存自己的文字之前，那里的默认文字会跟随 **Enhanced tone & continuity**；保存之后，无论开关是什么状态，都以你的文字为准。

这个覆盖项只管说话方式和语气。保证刷新结果有效的那些规则，例如允许哪些结构化动作，始终生效。

<a id="world--lore"></a>

## World / Lore(世界与设定)

**Lorebook context**(世界书上下文)（默认 **off**）让刷新可以使用世界书条目。开启后，每一次刷新都会在近期的 Noodle 帖子和回复文本以及活跃角色的资料里查找世界书关键词。命中的条目会作为世界设定上下文，提供给这次刷新里的账号。只有关联到活跃角色的世界书，或者标记为全局的世界书，才能触发。触发的内容在每次刷新中有 8,192 个 Token(模型切分文本的最小单位) 的硬性预算。

<a id="carryover"></a>

## Carryover(延续)

**Carryover** 把近期的 Noodle 动态推送进你的聊天。开启后，聊天的提示词里会多出一段“Recent Social Media Activity”内容，说明你的角色们在 Noodle 上做了什么。

- **Carryover to chats**：三个开关，默认全部 **off**：**Conversations**、**Roleplays** 和 **Games**。哪些模式应该收到 Noodle 动态，就开启哪些。
- **Carry hours**(延续时长)：1 到 720，默认 **48**。Noodle 往回追溯多少小时。
- **Carry items**(延续条数)：1 到 50，默认 **8**。一个聊天回合最多加入多少条摘要。

延续只取那些在 Noodle 上受邀的角色的动态，外加这个聊天当前的用户角色。仅仅因为文件夹而被纳入是不够的。整段延续内容在每次聊天生成时有 8,192 个 Token 的硬性预算。如果按条数上限会超出预算，Marinara 会保留放得下的最新几条摘要，并按时间顺序显示。

<a id="reset-noodle"></a>

## Reset Noodle(重置 Noodle)

这会清空时间线，同时保留你的账号和设置。

1. 点击 **Reset Noodle Timeline**。
2. 阅读弹窗内容：“This removes all posts, replies, likes, reposts, activity digests, and refresh records. Profiles, follows, invites, and settings stay.”
3. 点击 **Reset timeline**(重置时间线) 确认。

只有时间线内容会被删除。账号、账号名、简介、关注关系、邀请状态和每一项设置都原样保留。

## 把 Noodle 和聊天连起来

Noodle 和聊天可以双向共享上下文。开启一个不等于开启另一个。

- **Carryover to chats**(在 Noodle 设置里) 把 Noodle 动态送进聊天。见 [Carryover](#carryover)。
- **Allow Noodle references** 是每个聊天各自的开关，把聊天里的动态送进 Noodle。它在聊天自己的设置里，靠近 **Connected Chats**(关联聊天)。见[聊天设置总览](../chats/chat-settings.md)。默认 **off**。它的说明文字是“Timeline refreshes may include recent messages from this chat, with the chat name, mode, and participants stated in the prompt.”如果这个聊天同时还跑着 [Conversation 角色日程](../conversation/schedules.md)，角色在这个故事里的当前状态和活动（例如“currently dnd (At the office)”）也会带上，范围只限这一个聊天。

两者可以单独用，也可以一起用。

## 故障排查

- **刷新之后什么都没生成**：选好 **Generation model**，至少邀请一个角色（或者开启随机用户），再看看 **Refresh** 一节里显示的错误。
- **自动刷新一直不发生**：把 **Refreshes/day** 设成大于 0，保持 Marinara 运行，并核对 **Automatic schedule** 下面的计划时刻和时区。如果显示错误，先解决账号或速率限制的问题，再等重试自己跑。
- **帖子里没有提到最近的聊天**：在那个聊天里开启 **Allow Noodle references**，并确认角色已经受邀。聊天上下文只是给 AI 的参考，不是保证。
- **Noodle 动态没有出现在聊天里**：开启对应模式的 **Carryover to chats**，如果动态太旧，就把 **Carry hours** 调大。
- **帖子没有配图**：开启 **Image generation**，选一个能用的图像模型，再检查 **Images/refresh**。

<a id="settings-and-defaults"></a>

## 设置项与默认值

| 设置项 | 默认值 | 取值范围或选项 |
|---|---|---|
| **Generation model** | 无 | 任意文本模型（刷新必需） |
| **Professor Mari participates** | on | on 或 off |
| **Refreshes/day** | 2 | 0 到 24(设为 0 关闭自动刷新) |
| **Translate posts automatically** | off | on 或 off |
| **Active selection** | Random range | Random range、Exact count、All invited |
| **Min active** | 2 | 1 到 100(仅 Random range) |
| **Max active** | 5 | 1 到 100(仅 Random range) |
| **Active count** | 与 Max active 相同 | 1 到 100(仅 Exact count) |
| **Posts** | 8 | 0 到 100 |
| **Replies** | 12 | 0 到 200 |
| **Reposts** | 4 | 0 到 100 |
| **Likes** | 18 | 0 到 500 |
| **Image generation** | off | on 或 off |
| **Image width** | 1024 | 64 到 4096 |
| **Image height** | 1536 | 64 到 4096 |
| **Image generation connection** | Default | 任意图像模型 |
| **Image instructions (sent to your LLM)** | 内置文字 | 最多 4000 个字符 |
| **Use avatar references** | on | on 或 off |
| **Interpret image prompts** | on | on 或 off |
| **Include descriptions** | on | on 或 off |
| **Images/refresh** | 3 | 0 到 50 |
| **Attach gallery images** | off | on 或 off |
| **Show images to the writer** | on | on 或 off |
| **Image captioning** | 跟随 Generation model | on 或 off |
| **Captioning model** | Use Noodle generation connection | 任意能看图的模型 |
| **Use connection default** | on | on 或 off；恢复 Generation model 的图像描述设置 |
| **Lorebook context** | off | on 或 off |
| **Enhanced tone & continuity** | off | on 或 off |
| **Use generated character schedules** | off | on 或 off |
| **Carryover: Conversations** | off | on 或 off |
| **Carryover: Roleplays** | off | on 或 off |
| **Carryover: Games** | off | on 或 off |
| **Carry hours** | 48 | 1 到 720 |
| **Carry items** | 8 | 1 到 50 |
| **Allow Noodle references**(每个聊天) | off | on 或 off |

## 相关指南

- [Noodle：应用内的社交时间线](noodle.md)
- [聊天设置总览](../chats/chat-settings.md)
- [连接 AI 服务商](../connections/connecting-to-a-provider.md)
- [支持的 AI 服务商](../connections/providers-reference.md)
