# Music DJ：Spotify、YouTube 与本地音乐

本指南介绍如何在 Marinara Engine 里用 **Music DJ** 播放背景音乐，包括怎么连接 Spotify、YouTube 或本地音乐文件，也会讲清楚音乐播放器、**DJ Mari** 歌单生成和 Game Mode(游戏模式) 音乐各自怎么用。

## Music DJ 是什么

**Music DJ** 是一个可选的下载型智能体。智能体是在聊天后台自动运行的小帮手。设置之前，先打开 **Agents**(智能体)，选择 **Download Agents**(下载智能体)，把 **Music DJ** 装上。装好之后，它会在每条回复结束时读出场景的情绪，播放相配的背景音乐。

**Music DJ** 可以从三种来源播放音乐：

- **Spotify**：直接控制你自己的 Spotify 账号和设备上的播放。
- **YouTube**：搜索 YouTube，在应用内的小播放器里播放搜到的结果。不需要登录。
- **Custom**：播放运行 Marinara 的那台机器上某个文件夹里的音频文件。

当前生效的来源会以一个小小的 **Music Player**(音乐播放器) 固定显示在应用顶栏。在手机和窄窗口下，它会变成一个可以拖动的圆形浮动小组件。

装好之后 **Music DJ** 默认是关的，需要像其他智能体一样逐个聊天开启。它可以用在 **Roleplay**(角色扮演) 聊天里，**Game** 模式则通过一个单独的开关启用（见下面的 Music DJ 在 Game Mode 中的用法）。**Conversation**(对话模式) 模式里没有这个智能体，改用 **Music** 命令（见下面的 Conversation 的 Music 命令）。

**Music DJ** 的设置集中在一个地方。打开右侧的 **Agents** 面板，再打开 **Music DJ**。也可以点迷你播放器上的齿轮图标，它的提示文字是 **Music DJ setup**。

### 选择音乐来源

在 **Music DJ** 编辑器里，**Music Player** 设置项里有三个按钮：**Spotify**、**YouTube** 和 **Custom**。说明文字是“Choose which service Music DJ should use for future music picks. The same choice switches the visible player surface.”

按钮下面有一行字显示当前生效的来源，例如“Visible player: Spotify. Saved provider: Spotify.”这个来源选择对整个应用生效，不是按聊天单独保存的。

快速选择可以参考下表：

| 来源 | 需要的账号 | 费用 | 适合 |
|---|---|---|---|
| **Spotify** | 自己的 Spotify 账号，播放还需要 Spotify Premium | 设置免费，播放需要 Premium | 在自己的设备上播放真实的指定曲目 |
| **YouTube** | 一个免费的 Google API 密钥 | 免费 | 不用登录、不用 Premium 就能播放 |
| **Custom** | 不需要 | 免费 | 播放自己的本地音频文件 |

## Spotify 设置

Spotify 走的是你自己创建的免费 Spotify 开发者应用。只需要粘贴一个 **Spotify Client ID**，不用填 client secret。

打开 **Music DJ** 编辑器，找到 **Spotify Connection** 设置项，然后按下面的步骤操作。

1. 通过应用里给出的链接打开 **Spotify Developer Dashboard**。
2. 新建一个应用，选择“Web API”。
3. 在这个应用的 Redirect URIs 里，一字不差地填入 Marinara 在应用内设置框第 3 步给出的那个跳转地址。跳转地址就是登录完成后 Spotify 把你送回来的那个网址。
4. 从 Spotify 应用里复制 **Client ID**，粘贴到 **Spotify Client ID** 输入框。
5. 保存智能体，然后点击 **Connect Spotify Account**(连接 Spotify 账号)。

这时会弹出 Spotify 的登录和授权窗口。同意授权后，窗口会短暂显示一个“Spotify Connected!”页面，然后自动关闭。回到 Marinara，应该能看到绿色的 **Connected to Spotify** 标记。点 **Disconnect** 按钮可以删掉已保存的连接。

应用里有这样一句提示：“Requires Spotify Premium. Tokens refresh automatically, no need to reconnect.”免费 Spotify 账号也能连上，但播放、暂停、切歌和音量控制都需要 Spotify Premium，也就是 Spotify 的付费套餐。

### Spotify 设备说明

Spotify 的播放要落到某个设备上，比如手机、电脑上的 Spotify 客户端，或者应用内播放器。

在电脑上可以把浏览器选项卡本身变成一个 Spotify 设备。点迷你播放器上的笔记本电脑图标，它的提示文字是 **Enable Marinara player** 或 **Use Marinara player**。这样会注册一个名叫“Marinara Engine”的 Spotify 设备，音乐就直接放进这个选项卡里。应用内播放同样需要 Spotify Premium。

在手机上，播放器会优先选手机自己的 Spotify 设备。所以点播放是在手机上出声，而不是在后台的浏览器选项卡里。

如果某个 Spotify 设备不允许远程调音量，音量滑块会变成一个 **Use device volume** 按钮，这时请用设备自己的音量键。

### 在另一台机器上使用 Spotify

Spotify 只接受安全的 `https://` 跳转地址，或者环回地址 `http://127.0.0.1`。环回指的就是同一台电脑。如果 Marinara 跑在另一台机器上、走的又是普通 `http`，登录窗口可能会打不开。

有两个办法：

- 连接过程中，展开 **Connect Spotify Account** 按钮下面的“Browser couldn't reach the callback?”一节，把打不开的那个窗口的完整地址复制进输入框，然后点击 **Complete connection**。
- 或者在服务器上用环境变量固定一个跳转地址。环境变量是服务器启动时读取的一项设置。

```
SPOTIFY_REDIRECT_URI=https://your-address/api/spotify/callback
```

设置环境变量的方法见[服务器配置参考](../CONFIGURATION.md)。

## YouTube 设置

YouTube 模式需要一个免费的 YouTube Data API 密钥。API 密钥是一串秘密字符，Marinara 拿着它就能代表你使用某项服务。不需要登录 YouTube 账号，也不需要 Premium。

打开 **Music DJ** 编辑器，找到 **YouTube Connection** 设置项，然后按下面的步骤操作。

1. 通过应用里给出的链接打开 **Google Cloud Console**，新建或选一个项目。
2. 启用 **YouTube Data API v3**。
3. 依次进入 Credentials、Create credentials、API key。
4. 把密钥粘贴到 **YouTube Data API Key** 输入框。
5. 点击 **Save Key**(保存密钥)。保存后按钮会变成 **Update Key**，并出现绿色的“API key configured”标记。点 **Remove** 链接可以删除密钥。

密钥可以完全不加限制，也可以只按 API 限制并选中 YouTube Data API v3。不要按 HTTP referrer 限制，搜索是在服务器上跑的，加了 referrer 限制反而会被挡住。

应用里有这样一句提示：“The free quota (~100 searches/day) is plenty for a personal DJ.”Quota 指的是每天的用量上限。这个数字来自应用自带的文案，以后可能变化。密钥保存在服务器上，并且是加密存储的。

## Custom(本地) 音乐

Custom 模式播放的是运行 Marinara 服务器的那台机器上的音频文件，支持 `.mp3`、`.ogg`、`.wav`、`.flac`、`.m4a`、`.aac` 和 `.webm`。

打开 **Music DJ** 编辑器，找到 **Custom Music Library** 设置项，里面只有一个开关：**Use Game Assets music folder**。

- 开关打开：Custom 模式会读取你上传到 Game Assets 的音频。Game Assets 是 Marinara 为 Game Mode 内置的素材库。用 **Game Assets music folder** 输入框指定文件夹，填 `music` 表示整个音乐库，也可以填 `music/combat` 这样的子文件夹。点 **Open Folder** 按钮会在服务器那台机器上打开这个文件夹。
- 开关关闭：Custom 模式会读取服务器设备上的一个文件夹。点 **Select Folder** 会在服务器机器上打开文件夹选择窗口，也可以直接把路径粘贴到 **Music folder on this device** 输入框。

Roleplay 和 Game 聊天的设置里显示的是同一个已选来源。如果选的是服务器设备上的文件夹，聊天的 Music DJ 设置会显示这个已保存路径和一个 **Choose Folder** 按钮，而不是让你填 Game Assets 路径。

播放 Game Assets 之外的文件夹需要服务器本机权限。如果你是从另一台设备访问 Marinara，又没有设置密码或管理密钥，这一个功能可能会被拦下。见[远程访问：Basic Auth 与 IP 允许列表](../REMOTE_ACCESS.md)。

## 使用音乐播放器

**Music Player** 在电脑上是顶栏里的一个小胶囊，在手机上是可以拖动的浮动小组件。它可以通过设置隐藏或显示。

打开 **Settings**(设置)，切到 **General**(常规) 选项卡，找到 **App Behavior**(应用行为) 一节，开启或关闭 **Music Player**。说明文字是“Shows the compact Music Player. Switch between Spotify, YouTube, and Custom from the player itself or the Music DJ agent settings.”这个开关始终可用，默认开启。如果开着却没装 Music DJ，电脑和手机上的播放器位置会显示 **Download Music DJ Agent to configure**，并给出一个 **Download Agents** 按钮。

全新的配置里，默认显示的来源是 **YouTube**。换来源有三种方式：

- 用播放器上那个小圆形的来源切换按钮，它的提示文字是“Switch to ... player”。
- 用 **Music DJ** 编辑器里的 **Music Player** 按钮。
- 用某个聊天的 **Music DJ** 设置。

播放器会显示当前曲目的封面或缩略图、标题，以及艺人或频道名。可用的控件取决于来源。

- Spotify：随机播放、**Previous**、播放或暂停、**Next**、循环、带静音的音量滑块、**DJ** 按钮、笔记本电脑形状的 **Marinara player** 按钮，以及 **Music DJ setup** 齿轮。
- YouTube：播放或暂停、一个展开箭头（打开 16:9 的小视频面板）、**Stop** 按钮，以及带静音的音量滑块。
- Custom：播放或暂停和音量，放的是本地文件。

如果还没连上 Spotify，播放器上会显示“Spotify not connected”，点它就会打开 **Music DJ setup**。

### 按聊天设置 Spotify 来源

**Music DJ** 在 **Roleplay** 聊天里运行时，它的设置卡片上会有一个 **Spotify source** 下拉菜单，有四个选项。

- **Liked Songs**：优先从你收藏的曲目里挑。
- **Playlist**：只在某一个 Spotify 歌单里挑。旁边的 **Playlist** 下拉菜单会列出你的歌单。
- **Artist**：只围绕指定的艺人搜索，此时会出现一个 **Artist** 输入框。
- **Any Spotify**：合适的时候允许 DJ 直接用 Spotify 搜索。

## DJ Mari：AI 歌单生成

Spotify 迷你播放器上的 **DJ** 按钮可以生成一份有主题的歌单，它的提示文字是“DJ Mari composes a playlist for you!”

**DJ Mari** 会让已连接的 AI 模型根据你的用户角色、用得最多的角色，以及所有聊天里的近期内容来生成歌单。然后把匹配到的歌曲加进一个新建的 Spotify 歌单，名字是“DJ Mari”加当天日期，并开始播放。

**DJ Mari** 需要两个条件：

- **Music DJ** 智能体上指定了模型连接。没有的话会看到“Configure a model connection on the Music DJ agent before using DJ Mari.”设置方法见[连接 AI 服务商](../connections/connecting-to-a-provider.md)。
- 匹配到足够多的 Spotify 歌曲。至少要 25 首，最多取 50 首。如果凑不够 25 首，它会提示你多收藏一些 Liked Songs 再试一次。

成功后会看到“DJ Mari playlist is ready”提示，旁边有 **Open playlist** 按钮。

## Music DJ 在 Game Mode 中的用法

Game Mode 自带一套来自 Game Assets 的背景音乐。想改用 **Music DJ**，就在 Game 的设置里打开 **Music DJ** 开关，它的说明是“Use the Music DJ for this game instead of local music assets.”这个开关默认关闭。

打开之后，可选的 **Spotify**、**YouTube**、**Custom** 三种来源和各来源的设置项都和 Roleplay 里一样。

Spotify 在 Game Mode 里的工作方式略有不同。每个场景结束后，服务器先从你选的来源里整理出一小批真实存在的候选曲目，再由 AI 从这批里挑一首，这样 AI 就不会编出根本不存在的歌。Game Mode 每次只循环播放一首。

打开 **Game controls**，选择 **Retry Music DJ**，就能为当前场景重新挑选音乐。电脑和手机上都可用，见[游戏控件](../game/getting-started.md#the-games-controls)。

## Conversation 的 Music 命令

**Conversation** 模式里不能把 **Music DJ** 添加为智能体，但角色可以通过 **Music** 命令放歌。

打开聊天的 **Commands** 一节，先打开总的 **Commands** 开关，再打开 **Music** 开关。它的说明是“Let characters play songs through the active Music Player.”

这样一来，角色就可以点名一首 Spotify 歌曲，或者描述一段适合在 YouTube 上找的曲子，Marinara 会用当前来源播放。哪怕 **Music DJ** 在任何地方都没启用，这个功能也照样能用，只要连上了 Spotify 或者存好了 YouTube 密钥。

如果 Spotify 没连上或者没有播放权限，角色的点歌命令不会有任何反应，也不会报错。所以歌放不出来的时候，先把来源配好。

## 故障排查

- 迷你播放器不见了。到 **Settings** 的 **General** 选项卡、**App Behavior** 一节里打开 **Music Player**。
- Spotify 一点声音都没有。播放控制需要 Spotify Premium 和一个正在活动的 Spotify 设备。在某台设备上打开 Spotify 客户端，或者在电脑上点 **Enable Marinara player**。
- 在另一台机器上打不开 Spotify 登录窗口。用“Browser couldn't reach the callback?”那个粘贴框，或者在服务器上设置 `SPOTIFY_REDIRECT_URI`。
- YouTube 搜索失败。确认项目里已经启用 **YouTube Data API v3**，并且密钥没有按 HTTP referrer 限制。如果当天的用量已经用满，第二天再试，或者换一个密钥。
- 远程访问时，Custom 音乐放不出设备文件夹里的歌。那个文件夹需要服务器本机权限。见[远程访问：Basic Auth 与 IP 允许列表](../REMOTE_ACCESS.md)。
- Conversation 模式里角色的点歌命令没反应。连上 Spotify 或保存 YouTube 密钥，并确认 **Commands** 和 **Music** 两个开关都已打开。

## 相关指南

- [可下载智能体参考](../agents/built-in-agents.md)
- [智能体：聊天里的 AI 帮手](../agents/agents-overview.md)
- [连接 AI 服务商](../connections/connecting-to-a-provider.md)
- [游戏素材](../game/game-assets.md)
- [Conversation 模式：入门](../conversation/getting-started.md)
