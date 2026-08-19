# 常见问题

本指南集中回答大家问得最多的 Marinara Engine 问题，按主题分组。每个回答都附了对应的完整指南，想深入了解就点进去。

## 手机或者别的设备怎么访问 Marinara Engine？

Marinara Engine 以本地服务器的形式跑在一台电脑上，用浏览器打开使用。这一节讲的是怎么从同一网络下的手机、平板或另一台电脑访问它。

启动脚本（`start.sh`、`start.bat` 和 `start-termux.sh`）已经把服务器绑定到了全部网络接口（`0.0.0.0`）。其他设备在网络上能连到服务器，但访问控制默认会把它们挡在外面。在主机电脑上配好访问方式之前，远程设备只会看到一个 **Access blocked** 页面，上面写着配置说明。

按下面的步骤操作：

1. 让 Marinara 在主机电脑上保持运行。
2. 在主机电脑上配置访问控制：Basic Auth(一组用户名和密码) 或者 IP 允许列表（一份可信设备地址清单）。[远程访问](REMOTE_ACCESS.md)逐项讲解了这两种方式，也介绍了完全可信的私有网络可以走的放行方式。
3. 查出主机电脑的局域网 IP 地址。Windows 上运行这条命令，看 **IPv4 Address**(IPv4 地址)：

```
ipconfig
```

macOS 或 Linux 上运行这条命令：

```
hostname -I
```

4. 在另一台设备上打开浏览器，输入主机 IP 加端口号。默认端口是 `7860`：

```
http://192.168.1.42:7860
```

把 `192.168.1.42` 换成自己的主机 IP 地址。

5. 浏览器要求输入 Basic Auth 用户名和密码时登录一下。如果看到的是 **Access blocked** 页面，说明主机上的第 2 步还没做完。

普通桌面安装在同一台电脑上（`127.0.0.1`）不需要密码。由 APK 管理的 Android 安装会为 localhost 添加私密登录，防止其他 Android 应用冒充 Marinara，但 Android 外壳会自动创建并使用这份凭据。其他设备在配好访问控制（Basic Auth 或 IP 允许列表）之前一律被拦。两种方式都在[远程访问](REMOTE_ACCESS.md)里有详细说明。

两台设备不在同一网络时，可以借助 Tailscale 这类工具。Tailscale 会给每台设备分配一个固定的私有地址，这样在哪都能连上，也不用把 Marinara 暴露到公网。连不上的话，看 [Marinara Engine 故障排查](TROUBLESHOOTING.md)。

## Marinara 有手机应用吗？

没有单独的手机原生应用。在手机或平板上，用浏览器打开的是同一个网页版。大多数手机浏览器都有 **Add to Home Screen**(添加到主屏幕) 或 **Install App**(安装应用) 之类的选项，加上之后没有浏览器地址栏，用起来跟真正的应用差不多。这种形式叫 PWA(Progressive Web App，可以像应用一样装到设备上的网站)。

Android 上还可以[直接下载最新 APK](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk)，通过 Termux 把 Marinara 跑在手机本地。安装不需要签名密钥、密码或本地访问密钥；Android 权限提示见 [Android (Termux) 安装指南](installation/android-termux.md)。iPhone 和 iPad 用户见 [iOS / iPadOS PWA 指南](installation/ios-pwa.md)。

Android 外壳打开由 APK 管理的 Termux 服务器时会自动登录。私密凭据只会在用户有意用同一部手机的其他浏览器打开服务器时出现：打开 `/android-login`，在 Termux 中运行 `cat ~/.marinara-engine/android-secret`，然后粘贴显示的值。本地 `mari` CLI 也会自动读取由启动脚本管理的同一密钥。手动安装 Termux 时仍采用普通的 localhost 和网络访问规则。

## 三种聊天模式分别是什么？

Marinara 有三种聊天模式，打开聊天列表时显示为三个选项卡：

- **Conversation**(对话模式)：短信或私聊风格的聊天，就像在聊天软件里跟一个角色发消息。
- **Roleplay**(角色扮演)：带旁白、角色头像和可选角色立绘的沉浸式剧情场景。
- **Game Mode**(游戏模式)：由游戏主持人（GM）带着走的文字冒险，可以配场景图像和视频。

每种模式都有自己的入门指南。先挑一个想玩的模式，再去看它的进阶指南。

## Conversation 的日程用的时区怎么改？

打开一个 Conversation，在 Chat Settings(聊天设置) 里选 **Schedule timezone**(日程时区)，也可以在 Conversation 的创建流程里安排日程时顺手选。Marinara 一开始用的是设备上报的时区，但可以换成任何受支持的 IANA 时区，也可以选 **Use device**(使用设备时区) 恢复默认。这是一个全局设置，对所有 Conversation 聊天生效，包括服务器端发出的自主消息，并且会同步到连着同一个 Marinara 服务器的其他设备。

## 用 Marinara 一定要有 API 密钥吗？

绝大多数情况下都要。**connection**(连接) 就是保存下来的一套 AI 服务接入信息，告诉 Marinara 该怎么连上某个 AI 服务：哪家服务商、哪个模型、用什么身份登录。**API key**(API 密钥) 则是一串秘密字符，作用类似密码，从 AI 服务商那里申请，Marinara 拿它替你跟那家服务商通信。

开始聊天前至少要有一个连接。新建方法：打开 **Connections**(连接) 面板，点 **New**(新建)，选一家服务商，粘贴 **API Key**，再选一个模型。完整流程见[连接 AI 服务商](connections/connecting-to-a-provider.md)。

也有少数几家服务商完全不用 API 密钥。订阅类选项（Claude、ChatGPT 和 Grok）改用命令行工具登录，内置的 Local Model 则直接跑在自己的机器上，同样不需要密钥。

## 支持哪些 AI 服务商？

Marinara 支持的服务商很多，每个连接选一家。

聊天和角色扮演的文本生成可以选 **OpenAI**、**OpenAI (ChatGPT)**、**Anthropic**、**Claude (Subscription)**、**Grok CLI (Subscription)**、**Google Gemini**、**Google Vertex AI**、**Mistral**、**Cohere**、**OpenRouter**、**NanoGPT**、**xAI / Grok**，以及给 Ollama、LM Studio、KoboldCpp 这类本地或自建模型用的 **Custom (OAI-Compatible)**。

图像生成可以选 **OpenAI (DALL-E)**、**Stability AI**、**Together AI**、**NovelAI**、**OpenRouter Images**、**xAI / Grok Imagine**、**Venice.ai**、**Atlas Cloud**、**Pollinations**、**Stable Horde**、**SD Web UI (AUTOMATIC1111 / Forge)**、**ComfyUI**、**RunPod Serverless (ComfyUI)**、**Draw Things**、**NanoGPT** 和 **Block Entropy** 等等。

视频生成可以选 **Google AI Studio**、**xAI Imagine**、**OpenRouter Video**、**Atlas Cloud**、**Seedance 2.0**，以及本地 **ComfyUI** 的 API 格式工作流。

多个连接可以同时保存下来，每个聊天分配不同的连接。见[连接 AI 服务商](connections/connecting-to-a-provider.md)。

## 用 Marinara 要花钱吗？

Marinara 本身免费，而且跑在自己的电脑上。花的钱是所选 AI 服务商收的，具体多少取决于服务商和模型。

有些选项试起来完全不花钱。**Pollinations** 的图像生成不需要密钥。**Stable Horde** 免费，填密钥只是为了排队更靠前。内置的 **Local Model** 跑在自己的机器上，同样不需要密钥。订阅类选项（Claude、ChatGPT 和 Grok）用的是可能早就买好的付费套餐，不走按量计费的 API 密钥。

## API 密钥安全吗？

安全。每个 API 密钥在写入磁盘前都会用 AES-256 加密。导出连接和档案时，
秘密字段会被剔除。完整备份不一样：里面既有加密后的记录，也可能含有解锁它们所需的加密密钥文件，
所以完整备份的 ZIP 文件一定要自己保管好，别外传。

档案的导入过程是故意不带秘密字段的，所以导入之后每个 API 密钥都得重新填一遍，
对完整备份 ZIP 用 **Import Profile**(导入档案) 时也一样。手动恢复整个数据文件夹则可以保住加密后的密钥，
前提是配套的加密密钥文件也一起恢复了。

## 角色卡是什么？

**character card**(角色卡) 就是一个 AI 角色的存档资料：名字、头像、性格、背景故事和开场白。角色卡在 **Character Editor**(角色编辑器) 里创建和修改，也可以导入在其他应用里做好的卡。见[创建和编辑角色](characters/creating-and-editing-characters.md)。

## 世界书是什么？一本世界书怎么给多个角色用？

**lorebook**(世界书) 是一组世界设定条目。每个条目只在它的关键词出现在聊天里时，才把相应的设定加进提示词（Marinara Engine 发给 AI 的那段文字），这样既省 Token(模型切分文本的最小单位)，设定也不会前后矛盾。让一本世界书生效的范围有三种设定方式，挑合适的用：

1. 关联到角色或用户角色。在世界书编辑器里填写 **Linked Characters**(关联角色) 或 **Linked Personas**(关联用户角色)。之后，只要聊天里有关联的角色、或者用了关联的用户角色，这本世界书就会激活。两个输入框都能填多项，把想要的角色全加进去就行。
2. 挂到某一个聊天上。打开 **Chat Settings**(聊天设置)，找到 **Lorebooks**(世界书) 一节，用 **Add Lorebook**(添加世界书) 加进去。设定只属于某一个聊天时用这种方式。
3. 按角色筛选单个条目。在一本共用的世界书里，可以给每个条目单独设置成只在特定角色在场时触发。适合那种大部头的世界设定书，里面有一部分条目是专属于某个角色的。

完整功能见[世界书](lorebooks/overview.md)。

## 智能体是什么？

**agent**(智能体) 是聊天过程中运行的可选 AI 帮手，各自负责一件具体的事。比如追踪当前场景、盯着文笔质量、加地图或通话、跑 Conversation 里的桌游。全新安装的 Marinara 不带任何可选智能体。打开 **Agents**(智能体) 面板，点 **Download Agents**(下载智能体)，看清楚某一项的说明再安装。装好后在 **Chat Settings** 里给每个聊天分别启用兼容的智能体。已装的官方包有兼容的新版本时，Marinara 会先问一句再下载。选 **No** 就保留当前版本，Download Agents 里的 **Update** 按钮仍然留着，随时可以再更新。主机离线或者校验没通过时，已安装的版本照常能用。这个目录也支持把整个包彻底卸载。见[智能体](agents/agents-overview.md)和公开的 [Marinara-Agents 仓库](https://github.com/Pasta-Devs/Marinara-Agents)。

## Noodle 怎么配置？

Noodle 是 Marinara 内置的本地虚构社交网络，专给自己的角色用。打开 **Noodle** 选项卡，进它的 **Settings**(设置)。邀请角色或者角色文件夹，在 **Refresh**(刷新) 下面选一个用来生成内容的连接，然后点 **Refresh now**(立即刷新) 生成第一批动态。还可以设置自动刷新时间、图像生成、随机用户，以及把内容延续到自己的聊天里。

完整说明见 [Noodle：应用内的社交时间线](noodle/overview.md)和 [Noodle 设置与聊天延续](noodle/settings.md)。

## 角色为什么不记得前面说过的话？

AI 模型一次能装下的文字量有限，聊得久了，早先的消息就滑出视野了。Marinara 有两套记忆功能可以帮忙：

- **Memory Recall**(记忆功能) 会去翻检早先的消息，悄悄把最相关的片段重新塞回提示词。在 **Chat Settings** 的 **Memory Recall** 里开启。
- 摘要则把旧消息压缩成简短的回顾。Roleplay 聊天用 **Chat Summary**(聊天摘要)，Conversation 聊天用 **Automatic Summarization**(自动摘要)。

配置方法和细节见[记忆功能与聊天摘要](agents/memory.md)。

## 数据怎么备份？

打开 **Settings**，进 **Advanced**(高级) 选项卡，找到 **Backup & Export**(备份与导出) 一节，点 **Download Backup**(下载备份)。这会导出一个 `.zip` 压缩包，里面装着数据和上传过的文件。以后要恢复，在 **Settings** 的 **Imports**(导入) 选项卡里用 **Import Profile (JSON/ZIP)**，选同一个 `.zip` 就行。

同一节里还能开启按日、按周或按月轮换的自动备份。完整备份的 ZIP 里可能既有加密后的记录，
也有解锁它们所需的密钥文件，所以要自己保管好。**Import Profile** 依然会把服务商的秘密字段留空，
导入之后记得重新填密钥。完整说明见
[备份与恢复](data/backup-and-restore.md)。

## 扩展是怎么运作的？能导入第三方代码吗？

默认情况下，只有 Professor Mari 能替你起草一个 Personal Extension(个人扩展)。它一开始是禁用状态，必须先检查代码、确认那串 SHA-256 哈希值无误并批准，才会真正运行。

浏览器端代码默认跑在一个不透明源 iframe 里的专用 Worker 中。除了受限的日志、私有存储、定时器、清理和声明式 UI 能力之外，它还会拿到当前聊天和其中角色的不透明 ID，这样 Notepad 之类的扩展才能保存跟聊天绑定的状态。Browser Extension(浏览器扩展) 还可以单独申请只包含该聊天参与角色的角色卡快照，以及为该聊天选定的用户角色快照，范围严格受限。这些权限会在确认哈希值批准时一并列出，没申请就拿不到对应的记录。沙箱里的扩展永远拿不到消息、完整的角色库或用户角色库、未声明的字段、聊天元数据、DOM 访问权、网络访问权和任何修改类接口。服务器端代码在受支持的 macOS 和 Linux 主机上跑在单独的操作系统沙箱进程里，也拿不到浏览器端的聊天上下文。

第三方导入默认是隐藏的。主机管理者必须在 `.env` 里设置 `ENABLE_EXTERNAL_EXTENSIONS=true`，然后还要在 **Settings → Advanced → Danger Zone** 下面接受警告提示。这两道关没有同时打开之前，外部记录（包括手动存进去的和从档案导入的）既不会显示，也无法批准、无法执行。

External Extension(外部扩展) 在确实需要用到 Marinara 的 DOM 才能兼容老代码时，可以申请 **Full page access**(整页访问)。这一项没有沙箱：批准的那份代码会直接在 Marinara 的页面里运行，能读取页面内容、浏览器存储、网络接口，以及当前的同源会话。Professor Mari 起草的扩展无权申请这一项。只有在检查过、并且确实信任那个具体版本之后才开启；禁用之后如果还有未注销的改动残留，刷新一下页面。见[个人扩展](extending/personal-extensions.md)。

## 数据存在哪里？

全部内容都在跑 Marinara 的那台电脑上，位于安装目录下的 `data` 文件夹里。角色、聊天、用户角色、世界书、预设和各项设置都存在那儿，云端不留任何东西。见 [Marinara 的数据保存在哪里](data/where-data-is-stored.md)。

## 更新会不会把数据弄丢？

不会。更新 Marinara 不影响已有的角色、聊天和设置。不过重大更新之前先备份一次总归稳妥。各平台的更新步骤见[升级 Marinara Engine](UPGRADING.md)。

## Professor Mari 能做什么？

Professor Mari 是主页上的内置助手，点 **Ask Professor Mari**(问问 Professor Mari) 按钮就能叫出来。她可以讲解应用的用法，也能帮着做初始配置。用大白话跟她说一声，她还能直接创建或修改数据：角色、用户角色、世界书、提示词预设（保存好的指令模板）以及新聊天。

她还会在输入框上方给出快捷回复建议，引导多步骤的创建和修改流程，省得一个细节一个细节地手动敲。

她改动数据时，会弹出一张带 **Keep**(保留) 和 **Restore**(恢复) 按钮的确认卡片，不想要的改动随时撤销。她是个帮手，遇到跟版本相关的具体问题，还是得看这些指南。她能做的事情全列在 [Professor Mari](home/professor-mari.md) 里。

Professor Mari 也能修改 Marinara 的普通源码文件。依赖文件、启动脚本、安装程序和 CI 工作流则一律等着人工审核。她的改动如果需要引入某个公开的 npm 库，Marinara 会先把解析出来的确切版本和仓库完整性信息摆出来，安装时也会禁用生命周期脚本。

注意：走普通远程地址时，Professor Mari 的数据改动操作既要 Basic Auth，也要管理员密钥。可信或在允许列表里的网络路径可以使用[远程访问](REMOTE_ACCESS.md)里讲的放行方式。

## Storyboard 智能体是什么？在 Game Mode 里怎么用？

可下载的 **Storyboard**(分镜) 智能体把写完的剧情文字变成一串有先后顺序的关键帧图像，还能把每一帧做成一小段动画片段。在 **Game Mode** 里，它为一轮已完成的 GM 叙述生成分镜，画面显示在浮动查看器里，也可以直接当作游戏背景。在 **Roleplay** 里，它把新完成的几轮往来合成一段内嵌的小剧集。

想在 Game Mode 里用它，先从 **Agents > Download Agents** 安装 **Storyboard**。打开游戏，进 **Chat Settings > Agents**，开启 **Enable Agents**(启用智能体) 和 **Enable Storyboards**(启用分镜)，再在这局游戏里或 Storyboard 的全局设置里选好一个图像连接。跑完一轮 GM 叙述，打开 **Gallery**(图库) 点 **Create storyboard**(创建分镜)。想重新打开查看器就点 **View storyboard**(查看分镜)。

想让游戏里的分镜自动生成，开启 **Automatic Storyboard Illustrations**(自动分镜插图)。还想要动画片段，就再开启 **Automatic Storyboard Animations**(自动分镜动画)，并选好一个视频生成连接。新建游戏向导里的 **Storyboard Optimized**(分镜优化) 呈现方式只影响 GM 叙述的写法，既不会安装也不会启用这个智能体。Game 和 Roleplay 两边的配置、提示词、查看器、迁移行为和排查方法，都写在 [Storyboard 智能体指南](game/storyboard.md)里。

## 角色能在通话里出声说话吗？

能，在 **Conversation** 模式里。语音和视频通话是 Conversation 独有的功能。想听角色开口说话，先在 **Connections** 面板里配好 **Text to Speech**(语音合成)。

如果想用麦克风跟角色对话，而浏览器自带的语音识别又不太靠谱，先从 **Agents > Download Agents** 里安装 **Calls**(通话)。然后打开 **Connections** 面板，展开 **Local Model** 卡片，找到 **Local Speech Model**(本地语音模型)，选 **Whisper Tiny (Multilingual)** 或 **Whisper Base (Multilingual)**，点 **Download Whisper**(下载 Whisper)。卸载 Calls 时，它下载的 Whisper 模型也会一并删掉，把磁盘空间腾出来。完整的通话配置见[通话](conversation/calls.md)。

## Marinara 能生成图像吗？

能。添加一个图像生成连接，比如 **Pollinations**(不需要密钥) 或者某家付费服务商。之后 Marinara 就能生成角色头像、场景图、自拍，以及 Roleplay 或 Game Mode 里 Storyboard 智能体产出的关键帧。添加方法见[连接 AI 服务商](connections/connecting-to-a-provider.md)。

## 在应用里怎么看文档？

每一份安装包都带着全套指南，不用离开应用就能读：

- 在主页底部点 **Documentation**(文档) 按钮，就在 **Replay Tutorial**(重看教程) 旁边。
- 在主页的常见问题里，展开关于文档的那一条，点 **Open Documentation**(打开文档)。

两个按钮打开的是同一个应用内阅读器。它会列出全部指南，并直接在 Marinara 里渲染出来。

## 去哪里求助或者报 Bug？

先看 [Marinara Engine 故障排查](TROUBLESHOOTING.md)，那篇是按症状分类整理的。主页底部的 **Discord** 按钮通向社区聊天，**Support**(支持) 按钮通向项目的支持页面。报 Bug 和提功能需求请到项目的 GitHub 页面。

## 相关指南

- [Marinara Engine 故障排查](TROUBLESHOOTING.md)
- [安装](INSTALLATION.md)
- [远程访问](REMOTE_ACCESS.md)
- [连接 AI 服务商](connections/connecting-to-a-provider.md)
