# 常见问题

关于 Marinara Engine 常见问题的简短回答。每个回答都链接到写有完整步骤的指南。

<a id="how-do-i-access-marinara-engine-from-my-phone-or-another-device"></a>

## 手机或者别的设备怎么访问 Marinara Engine？

Marinara 以服务器的形式跑在一台电脑上，用浏览器打开使用。启动脚本让其他设备能连到服务器，但在主机电脑上设置登录（一个用户名和密码）之前，访问控制会把它们挡在外面。在那之前，远程设备只会看到一个 **Access blocked** 页面。

1. 让 Marinara 在主机电脑上保持运行。
2. 查出主机的局域网 IP 地址。Windows 上运行 `ipconfig`，看 **IPv4 Address**(IPv4 地址)。macOS 或 Linux 上运行 `hostname -I`。
3. 在另一台设备上，用浏览器打开 `http://<host IP>:7860`，例如 `http://192.168.1.42:7860`。`7860` 是默认端口。
4. 设置登录。在另一台设备上打开 Marinara：被拦截的页面上有一个 **Setup code**(设置码) 表单。在主机电脑的服务器日志里找到一次性设置码（Docker 里运行 `docker logs <container> 2>&1 | grep "setup code"`），然后连同新的用户名和密码一起输入。或者，在主机上已经登录的浏览器里打开 **Settings → Advanced → Access**(设置 → 高级 → 访问)。
5. 登录。想添加更多设备又不想输入密码，就用 **Settings → Advanced → Access** 里的 **Add a device**(添加设备)。

普通桌面安装在同一台电脑上（`127.0.0.1`）不需要密码。同一台电脑上的反向代理算作远程访客，需要登录。所有方式、设置码和 Docker 的说明见[远程访问](REMOTE_ACCESS.md#option-1-login-recommended)。设备不在同一网络时，用 Tailscale：见[用 Tailscale 从任何地方连接](REMOTE_ACCESS.md#connect-from-anywhere-with-tailscale)。连不上的话，见[故障排查](TROUBLESHOOTING.md)。

## Marinara 有手机应用吗？

没有单独的原生应用。在手机或平板上，用浏览器打开网页版。大多数浏览器都有 **Add to Home Screen**(添加到主屏幕) 或 **Install App**(安装应用)，可以把它保存为 PWA(像应用一样打开、没有浏览器地址栏的网站)。

Android 上还可以[下载最新 APK](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk)。它通过 Termux 在手机上运行 Marinara。见 [Android 安装](installation/android-termux.md)。iPhone 和 iPad 见 [iOS PWA 指南](installation/ios-pwa.md)。

在 Android 应用里，启动界面提供 **Open in browser**(在浏览器中打开)、**Retry connection**(重试连接) 和 **Install / Start Marinara**。以后想改选择，用 **Settings → General → App Behavior → Open Android launcher (app or browser)**(设置 → 常规 → 应用行为 → 打开 Android 启动界面（应用或浏览器）)。旧版 APK 在 `/android-login` 手动登录。

<a id="can-i-play-with-other-people"></a>

## 可以和别人一起玩吗？

可以。可选的多人模式让几个人共享一个 Conversation、Roleplay 或 Game。每个人都先打开这项设置，然后主持或加入。访客不需要 AI 密钥。有密码不代表陌生房主就安全。开启之前，请阅读[多人模式的设置、警告和限制](CONFIGURATION.md#optional-multiplayer)。

## 三种聊天模式分别是什么？

- **Conversation**(对话模式)：聊天软件风格的角色聊天。
- **Roleplay**(角色扮演)：带旁白和角色头像的沉浸式剧情场景。
- **Game**(游戏模式)：由 AI 游戏主持人（GM）主持的文字冒险。

想挑一个，见 [Marinara Engine 入门](home/welcome.md#choose-a-chat-mode)。

## Conversation 的日程用的时区怎么改？

打开一个 Conversation，在 Chat Settings(聊天设置) 里选择 **Schedule timezone**(日程时区)。**Use device**(使用设备时区) 会把它重置为设备的时区。这是一个全局设置，对所有 Conversation 聊天生效，并会同步到连着同一个服务器的其他设备。见 [Conversation 模式：入门](conversation/getting-started.md)。

## 每个 Conversation 聊天都有自己的日程吗？

没有。日程属于角色，所以和这个角色的每个 Conversation 聊天都用同一份日程。在 **Character Editor → Convo → Weekly schedule**(角色编辑器 → Convo → 每周日程) 里编辑。

想在某个聊天里立刻得到回复，就在那个聊天的 Chat Settings 里关掉 **Conversation schedules**(Conversation 日程)。**dnd**(请勿打扰) 这样的手动状态覆盖仍然生效，而且它属于角色，在每个聊天里都适用。用 **clear**(清除) 移除它。

## 用 Marinara 一定要有 API 密钥吗？

用在线 AI 服务就需要。**API key**(API 密钥) 是 AI 服务发的一串秘密字符，Marinara 凭它使用你在那里的账号。开始聊天前至少要有一个账号。打开 **Connections**(连接)，点击 **Add**(添加)，选一个服务，粘贴密钥，再点击 **Connect**(连接)。见[连接 AI 服务商](connections/connecting-to-a-provider.md)。

有些选项不需要密钥。订阅类选项（Claude、ChatGPT 和 Grok）通过命令行工具登录。**Built-in model**(内置模型) 在你的电脑上运行。见[内置模型设置](connections/local-model.md)。

## 支持哪些 AI 服务商？

Marinara 支持 OpenAI、Anthropic、Google Gemini、OpenRouter 等众多文本、图像和视频生成服务，还支持 Ollama、LM Studio 和 KoboldCpp 这类 **OpenAI-compatible**(兼容 OpenAI) 服务器。完整列表见[支持的 AI 服务商](connections/providers-reference.md)。添加方法见[连接 AI 服务商](connections/connecting-to-a-provider.md)。

## 用 Marinara 要花钱吗？

Marinara 本身免费。你付的是 AI 服务收的费用。有些选项试起来完全不花钱：**Pollinations** 的图像不需要密钥，**Stable Horde** 免费，**Built-in model** 在你的电脑上运行。订阅类选项用的是你可能已经买好的付费套餐。

## API 密钥安全吗？

安全。每个 API 密钥在保存之前都会用 AES-256 加密。导出账号和档案时，秘密字段会被剔除，所以用 **Import Profile**(导入档案) 之后要重新填写密钥，对完整备份 ZIP 也一样。完整备份 ZIP 里既有加密后的记录，也有解锁它们的密钥文件，所以要自己保管好，别外传。见[备份与恢复](data/backup-and-restore.md)。

## 角色卡是什么？

角色卡就是一个 AI 角色保存下来的资料：名字、头像、性格、背景故事和开场白。角色卡在 **Character Editor**(角色编辑器) 里制作，也可以从其他应用导入。见[创建和编辑角色](characters/creating-and-editing-characters.md)。

## 世界书是什么？一本世界书怎么给多个角色用？

世界书是一组世界设定。每个条目只在它的关键词出现在聊天里时，才会加入提示词。你可以：

1. 在世界书编辑器里填写 **Linked Characters**(关联角色) 或 **Linked Personas**(关联用户角色)。之后，在任何有它们的聊天里，这本世界书都会生效。
2. 打开 **Chat Settings → Lorebooks → Add Lorebook**(聊天设置 → 世界书 → 添加世界书)，把它挂到某一个聊天上。
3. 把单个条目限定给特定角色。

见[世界书](lorebooks/overview.md)。

## 智能体是什么？

智能体是聊天过程中运行的可选 AI 帮手，各自负责一件具体的事，比如追踪场景或添加地图。全新安装不带任何智能体。打开 **Agents → Agent Organizer**(智能体 → 智能体管理器)，选一个安装。然后在 **Chat Settings** 里按聊天启用它。见[智能体](agents/agents-overview.md)。

## Noodle 怎么配置？

Noodle 是专给你的角色用的本地虚构社交网络。从 **Agents → Agent Organizer** 安装 **Noodle**，按提示重启 Marinara，然后打开 **Home → Noodle**(主页 → Noodle)。见 [Noodle：应用内的社交时间线](agents/noodle.md)。

## 角色为什么不回复？

通常是聊天没有账号或模型、API 密钥不对，或者账号余额用完了。见[角色不回复](TROUBLESHOOTING.md#my-character-does-not-reply)。

## 角色为什么不记得前面说过的话？

模型一次只能读这么多文字，所以聊得久了，早先的消息就会掉出去。有两个工具可以帮忙。**Memory Recall**(记忆功能) 会把相关的早先消息找回来，摘要则把旧消息压缩成简短的回顾。两者都在 **Chat Settings** 里。较长的 Roleplay 聊天，用 **Chat Settings → Memory Recall**(聊天设置 → 记忆功能) 里的 **Advanced Memory Recall**(高级记忆功能)。见[记忆功能与聊天摘要](agents/memory.md)。

## 数据怎么备份？

打开 **Settings → Advanced → Backup & Export**(设置 → 高级 → 备份与导出)，点击 **Download Backup**(下载备份)。这会保存一个 `.zip`，里面是你的数据和上传过的文件。要恢复，用 **Settings → Imports**(设置 → 导入) 下的 **Import Profile (JSON/ZIP)**。同一节里还能设置按日、按周或按月自动备份。见[备份与恢复](data/backup-and-restore.md)。

## 扩展是怎么运作的？能导入第三方代码吗？

默认情况下，只有 Professor Mari 能创建 Personal Extension(个人扩展) 草稿。草稿一开始是关闭的，你要先批准它的确切代码，它才会运行。第三方导入默认隐藏，直到主机管理者在 `.env` 里设置 `ENABLE_EXTERNAL_EXTENSIONS=true`，并且你在 **Settings → Advanced → Danger Zone**(设置 → 高级 → 危险区域) 下接受警告。见[个人扩展](extending/personal-extensions.md)。

## 数据存在哪里？

存在运行 Marinara 的那台电脑上，位于安装目录的 `data` 文件夹里。云端不存任何东西。见[你的数据保存在哪里](data/where-data-is-stored.md)。

## 更新会不会把数据弄丢？

不会。更新会保留你的角色、聊天和设置。不过还是先备份一次。退回旧版本可能会丢失只有新版本才保存的数据。见[升级](UPGRADING.md)和[降级到旧版本](UPGRADING.md#downgrading-to-an-older-version)。

## Professor Mari 能做什么？

Professor Mari 是主页上的内置助手。她能讲解这个应用，也能按你的要求创建或编辑角色、用户角色、世界书和预设。每次改动都会显示一张带 **Undo**(撤销) 的卡片。见 [Professor Mari](home/professor-mari.md)。

## Storyboard 智能体是什么？在 Game Mode 里怎么用？

它把写完的剧情文字变成图像。从 **Agents → Agent Organizer** 安装 **Storyboard**(分镜)，然后在聊天里开启它。见 [Storyboard 智能体指南](game/storyboard.md)。

## 角色能在通话里出声说话吗？

能，在 Conversation 模式里。你需要先在 **Connections** 里配好 **Text to Speech**(语音合成)。具体步骤见[通话](conversation/calls.md)，包括麦克风的语音识别。

## Marinara 能生成图像吗？

能。添加一个图像生成账号，比如 **Pollinations**(不需要密钥) 或者某个付费服务。见[连接 AI 服务商](connections/connecting-to-a-provider.md)。

## 在应用里怎么看文档？

在主页上，点击书签里的 **Documentation**(文档)。手机上要先打开书签菜单。在主页的常见问题里，也可以点击 **Open Documentation**(打开文档)。

## 去哪里求助或者报 Bug？

先看[故障排查](TROUBLESHOOTING.md)。在主页上，**Discord** 通向社区聊天，**Support**(支持) 打开项目的支持页面。Bug 和功能需求请到项目的 GitHub 页面提交。

## 相关指南

- [故障排查](TROUBLESHOOTING.md)
- [安装](INSTALLATION.md)
- [远程访问](REMOTE_ACCESS.md)
- [连接 AI 服务商](connections/connecting-to-a-provider.md)
