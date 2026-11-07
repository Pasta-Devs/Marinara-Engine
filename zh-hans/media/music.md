# Music DJ：Spotify、YouTube 与本地音乐

**Music DJ** 会播放与场景相配的背景音乐。本指南介绍怎么连接 Spotify、YouTube 或你自己的音频文件，怎么使用音乐播放器，以及怎么在 Game Mode(游戏模式) 和 Conversation(对话模式) 里使用音乐。

## Music DJ 是什么

**Music DJ** 是一个可选的可下载智能体。智能体是在聊天后台运行的帮手。每条回复之后，它可以读出场景的情绪，播放相配的音乐。

开始之前：打开 **Agents**(智能体)，选择 **Agent Organizer**(智能体管理器)，安装 **Music DJ**。装好后它默认是关闭的，要像其他智能体一样为聊天开启。它可以用在 Roleplay(角色扮演) 聊天里，在 Game Mode 里通过一个单独的开关使用（[Music DJ 在 Game Mode 中的用法](#music-dj-in-game-mode)），在 Conversation 里则通过 **Music**(音乐) 命令使用（[Conversation 的 Music 命令](#the-conversation-music-command)）。

它可以从三种来源播放。

| 来源 | 需要的账号 | 费用 | 适合 |
|---|---|---|---|
| **Spotify** | 自己的 Spotify 账号，播放还需要 Spotify Premium | 设置免费，播放需要 Premium | 在自己的设备上播放真实的指定曲目 |
| **YouTube** | 一个免费的 Google API 密钥 | 免费 | 不用登录、不用 Premium 就能播放 |
| **Custom** | 不需要 | 免费 | 你自己的音频文件 |

当前生效的来源会以一个小小的 **Music Player**(音乐播放器) 固定在顶栏里。在手机和窄窗口下，它会变成一个可以拖动的圆形浮动小组件。

Music DJ 的设置集中在一个地方。打开右侧的 **Agents** 面板，再打开 **Music DJ**。也可以点迷你播放器上的齿轮图标（提示文字为 **Music DJ setup**）。

### 选择音乐来源

在 **Music DJ** 编辑器里，**Music Player** 设置项有三个按钮：**Spotify**、**YouTube** 和 **Custom**。按钮下面有一行字显示当前生效的来源，例如“Visible player: Spotify. Saved provider: Spotify.”这个选择对整个应用生效，不是按聊天保存的。**Custom** 从哪个文件夹播放，可以按聊天或角色分别设置：见[为聊天或角色使用不同的文件夹](#use-a-different-folder-for-a-chat-or-character)。

## 设置 Spotify

Spotify 用的是你自己创建的免费 Spotify 开发者应用。只需要粘贴一个 **Spotify Client ID**，没有 client secret。

1. 在 **Music DJ** 编辑器里找到 **Spotify Connection**。
2. 通过应用里显示的链接打开 **Spotify Developer Dashboard**。
3. 新建一个应用，选择“Web API”。
4. 在这个应用的 Redirect URIs 里，一字不差地填入 Marinara 在应用内设置框第 3 步显示的跳转地址。跳转地址就是登录完成后 Spotify 把你送回来的地址。
5. 复制 **Client ID**，粘贴到 **Spotify Client ID**。
6. 保存智能体，然后点击 **Connect Spotify Account**(连接 Spotify 账号)。

这时会弹出 Spotify 的登录和授权窗口。同意之后，它会显示一个简短的成功页面并关闭。Marinara 会显示绿色的 **Connected to Spotify** 标记。**Disconnect** 会删掉已保存的连接。

> **注意：** 播放、暂停、切歌和音量都需要 Spotify Premium(付费套餐)。免费账号也能连接。Token 会自动刷新。

如果没有成功：在另一台机器上，登录窗口可能会失败（见下文）。否则就检查跳转地址是否完全一致。

### Spotify 设备

Spotify 通过某个设备播放，比如你的手机、电脑上的 Spotify 客户端，或者应用内播放器。

- 在电脑上，点迷你播放器上的笔记本电脑图标（**Enable Marinara player** 或 **Use Marinara player**），把浏览器选项卡变成一个名叫“Marinara Engine”的 Spotify 设备。在选项卡里播放需要 Premium。
- 在手机上，播放器会优先用手机自己的 Spotify 设备，所以是在手机上播放，而不是在后台选项卡里。
- 如果某个设备不允许远程调音量，滑块会换成 **Use device volume**。请用设备自己的音量键。

### 在另一台机器上使用 Spotify

Spotify 只接受安全的 `https://` 跳转地址，或者环回地址 `http://127.0.0.1`(同一台电脑)。如果 Marinara 跑在另一台机器上、走的又是普通 `http`，登录窗口可能会失败。有两个办法：

- 连接时，展开 **Connect Spotify Account** 下方的“Browser couldn't reach the callback?”一节，从失败的窗口复制完整地址，粘贴到输入框里，然后点击 **Complete connection**。
- 或者用环境变量（服务器启动时读取的一项设置）固定一个跳转地址：

```text
SPOTIFY_REDIRECT_URI=https://your-address/api/spotify/callback
```

见[服务器配置参考](../CONFIGURATION.md)。

### 选择 Spotify 从哪里挑歌（Roleplay）

Music DJ 在 Roleplay 聊天里运行时，它的卡片上有一个 **Spotify source**(Spotify 来源) 列表。

- **Liked Songs**：优先从你收藏的曲目里挑。
- **Playlist**：只在一个歌单里挑，歌单在 **Playlist** 列表里选。
- **Artist**：围绕一位艺人搜索，在 **Artist** 输入框里填写。
- **Any Spotify**：合适的时候让 DJ 使用 Spotify 搜索。

## 设置 YouTube

YouTube 模式需要一个免费的 YouTube Data API 密钥。API 密钥是一串秘密代码，Marinara 拿着它就能代表你使用某项服务。不需要登录 YouTube，也不需要 Premium。

1. 在 **Music DJ** 编辑器里找到 **YouTube Connection**。
2. 通过应用里的链接打开 **Google Cloud Console**，新建或选一个项目。
3. 启用 **YouTube Data API v3**。
4. 依次进入 Credentials、Create credentials、API key。
5. 把密钥粘贴到 **YouTube Data API Key**。
6. 点击 **Save Key**(保存密钥)。按钮随后会变成 **Update Key**，并出现绿色的“API key configured”标记。**Remove** 会删除密钥。

密钥可以不加限制，或者只按 API 限制为 YouTube Data API v3。不要按 HTTP referrer 限制。搜索在服务器上运行，所以 referrer 限制会把它挡住。应用里说免费配额（大约每天 100 次搜索）对个人 DJ 来说足够了。这个数字来自应用自带的文案，以后可能变化。密钥加密保存在服务器上。

## 使用自己的音乐文件

Custom 模式播放运行 Marinara 的那台机器上的音频文件，支持 `.mp3`、`.ogg`、`.wav`、`.flac`、`.m4a`、`.aac` 和 `.webm`。

在 **Music DJ** 编辑器里找到 **Custom Music Library**。里面只有一个开关：**Use Game Assets music folder**。

- **On**(开启)：Custom 模式读取你上传到 Game Assets 的音频。Game Assets 是 Marinara 为 Game Mode 准备的素材库。用 **Game Assets music folder** 指定文件夹。填 `music` 表示整个音乐库，也可以填 `music/combat` 这样的子文件夹。**Open Folder** 会在服务器那台机器上打开它。
- **Off**(关闭)：Custom 模式读取服务器设备上的一个文件夹。用 **Select Folder** 在服务器那台机器上打开文件夹选择窗口，或者把路径粘贴到 **Default music folder on this device**。所有没有单独设置文件夹的聊天都使用这个文件夹。

播放 Game Assets 之外的文件夹需要服务器本机权限。保存手动输入的文件夹路径，也需要和文件夹选择窗口相同的权限。从另一台设备访问、又没有登录或管理密钥时，这两者都可能会被拦下。见[远程访问：登录与 IP 允许列表](../REMOTE_ACCESS.md)。

<a id="use-a-different-folder-for-a-chat-or-character"></a>

### 为聊天或角色使用不同的文件夹

聊天或角色可以有自己的音乐文件夹，这样每个故事都能播放各自的配乐。角色的文件夹会在所有只有这一个角色的聊天里播放。

1. 打开聊天，再打开它的 **Chat Settings**(聊天设置)。
2. 在 **Music DJ** 设置里选中 **Custom** 播放器，打开 **Apply to**(应用到)，选择文件夹保存在哪一级。
3. 点击 **Choose Folder**，或者把路径粘贴到 **Music folder on this device**。

| Apply to | 哪些聊天使用这个文件夹 |
| --- | --- |
| **This chat**(此聊天) | 只有这个聊天。分支一开始沿用同一个文件夹，之后可以改。 |
| 角色名 | 所有只有这一个角色的聊天。只在单角色聊天里显示。 |
| **All chats (default)**(所有聊天，默认) | 所有没有单独设置文件夹的聊天。这就是 **Music DJ** 编辑器里的默认文件夹。 |

Music DJ 使用它找到的第一个文件夹：先是这个聊天的文件夹，然后是角色的文件夹，最后是默认文件夹。群聊从不使用角色的文件夹。即使默认来源是 Game Assets，聊天或角色的文件夹也照样播放。

如果聊天从 Game Assets 播放音乐（它在这台设备上没有自己的文件夹），选中 **This chat** 时还会出现 **Game Assets Music Folder**。填入 Game Assets 里的一个子文件夹，比如 `music/combat`，它就只在这个聊天里播放。留空则使用默认文件夹。

**In use:**(当前使用) 显示这个聊天正在播放的文件夹及其来源：**This chat**、**From** 加角色名，或者 **Default**。

- **Use default**(使用默认) 会移除这个聊天的文件夹。之后聊天会播放角色的文件夹，没有的话就播放默认文件夹。
- **Unlink from**(取消关联) 加角色名，会从所有聊天里移除这个角色的文件夹。

把 Music DJ 添加到聊天时，也会出现同样的 **Apply to** 选项。聊天自己的文件夹不会写进聊天导出、设置方案和 **Export Profile**(导出档案) 文件。智能体导出则不包含默认文件夹和角色的文件夹。每个路径指向的都是这台服务器上的文件，换到另一台服务器上就没有意义了。

## 使用音乐播放器

**Music Player** 在电脑上是顶栏里的一个小胶囊，在手机上是可以拖动的小组件。要显示或隐藏它，打开 **Settings → General → App Behavior**(设置 → 常规 → 应用行为)，切换 **Music Player**。它默认开启。开着但没装 Music DJ 时，播放器会显示 **Download Music DJ Agent to configure**，并提供一个 **Agent Organizer** 按钮。

在全新的配置里，来源一开始是 **YouTube**。可以用播放器上的圆形来源切换按钮（提示文字为“Switch to ... player”）、编辑器里的 **Music Player** 按钮，或某个聊天的 **Music DJ** 设置来更换。

播放器会显示曲目的封面或缩略图、标题，以及艺人或频道名。控件取决于来源。

- **Spotify**：随机播放、**Previous**、播放或暂停、**Next**、循环、带静音的音量、**DJ**、笔记本电脑形状的 **Marinara player** 按钮，以及 **Music DJ setup** 齿轮。没连上 Spotify 时，播放器会显示“Spotify not connected”，点它会打开 **Music DJ setup**。
- **YouTube**：播放或暂停、一个打开 16:9 小视频面板的箭头、**Stop**，以及带静音的音量。
- **Custom**：播放或暂停和音量。

## DJ Mari：AI 歌单生成

Spotify 迷你播放器上的 **DJ** 按钮（“DJ Mari composes a playlist for you!”）会生成一份有主题的歌单。DJ Mari 会让你已连接的 AI 模型根据你的用户角色、你用得最多的角色，以及所有聊天里的近期内容来生成它。它会把匹配到的歌曲加进一个新建的 Spotify 歌单，名字是“DJ Mari”加当天日期，然后开始播放。

它需要两个条件。

- **Music DJ** 智能体上指定了一个模型。没有的话会看到“Configure a model connection on the Music DJ agent before using DJ Mari.”见[连接 AI 服务商](../connections/connecting-to-a-provider.md)。
- 至少匹配到 25 首 Spotify 歌曲。它最多挑 50 首。不到 25 首时，它会提示你多收藏一些 Liked Songs 再试一次。

成功后会看到“DJ Mari playlist is ready”，旁边有 **Open playlist** 按钮。

<a id="music-dj-in-game-mode"></a>

## Music DJ 在 Game Mode 中的用法

Game Mode 有自己来自 Game Assets 的背景音乐。想改用 Music DJ，就在 Game 设置里打开 **Music DJ** 开关（“Use the Music DJ for this game instead of local music assets”）。它默认关闭。之后会有和 Roleplay 里一样的 **Spotify**、**YouTube**、**Custom** 选项和设置项。

用 Spotify 时，每个场景之后，服务器会从你选的来源整理出一小批真实存在的候选曲目，再由 AI 从中挑一首。这样它就不会编出不存在的歌。Game Mode 每次只循环播放一首。要为当前场景重新挑一首，打开 **Game controls**(游戏控制)，选择 **Retry Music DJ**。见[游戏控件](../game/getting-started.md#the-games-controls)。

<a id="the-conversation-music-command"></a>

## Conversation 的 Music 命令

在 Conversation 里不能把 Music DJ 添加为智能体。角色改为通过 **Music** 命令放歌。

1. 打开聊天的 **Commands**(命令) 一节，打开总的 **Commands** 开关。
2. 打开 **Music**，它的说明是“Let characters play songs through the active Music Player”。

之后角色就可以点名一首 Spotify 歌曲，或者为 YouTube 描述一段曲子，Marinara 会用当前来源播放。即使 Music DJ 在任何地方都没启用，这也能用，只需要连上 Spotify 或保存好 YouTube 密钥。如果 Spotify 没连上或没有播放权限，Spotify 点歌命令不会有任何反应，也不会报错。

## 故障排查

- **迷你播放器不见了**：在 **Settings → General → App Behavior** 里打开 **Music Player**。
- **Spotify 什么都不播放**：播放需要 Spotify Premium 和一个活动中的 Spotify 设备。在某台设备上打开 Spotify 客户端，或者在电脑上点击 **Enable Marinara player**。
- **在另一台机器上 Spotify 登录窗口失败**：用“Browser couldn't reach the callback?”粘贴框，或者在服务器上设置 `SPOTIFY_REDIRECT_URI`。
- **YouTube 搜索失败**：确认项目已启用 **YouTube Data API v3**，并且密钥没有按 HTTP referrer 限制。如果用满了每日配额，第二天再试，或者换一个密钥。
- **远程访问时 Custom 音乐无法播放设备文件夹里的歌，或者手动输入的文件夹路径保存不了**：这两者都需要服务器本机权限。见[远程访问：登录与 IP 允许列表](../REMOTE_ACCESS.md)。
- **聊天播放的文件夹不对**：在聊天的 **Music DJ** 设置里看看 **In use:** 显示的是什么。**This chat** 优先于角色的文件夹，所以要点击 **Use default**，聊天才会重新跟随角色的文件夹。
- **Conversation 里角色的点歌命令没反应**：连上 Spotify 或保存 YouTube 密钥，并确认 **Commands** 和 **Music** 开关都已打开。

## 相关指南

- [可下载智能体参考](../agents/built-in-agents.md)
- [智能体：聊天里的 AI 帮手](../agents/agents-overview.md)
- [连接 AI 服务商](../connections/connecting-to-a-provider.md)
- [游戏素材](../game/game-assets.md)
- [Conversation 模式：入门](../conversation/getting-started.md)
