# 升级 Marinara Engine

把 Marinara Engine 更新到新版本，在应用内检查更新，出了问题时退回旧版本。升级时，聊天和设置都会保留。

## 我该用哪种更新方式？

| 安装方式 | 更新方法 |
| --- | --- |
| Windows 安装程序或 `start.bat` | 关闭 Marinara 再重新打开。见 [Windows](#windows)。 |
| macOS 或 Linux | 再运行一次 `./start.sh`。见 [macOS 和 Linux](#macos-and-linux)。 |
| Docker 或 Podman | 拉取新镜像并重启。见 [Docker 或 Podman](#docker-or-podman)。 |
| Android 应用 | 更新 APK，然后点击 **Install / Start Marinara**。见 [Android (Termux)](#android-termux)。 |
| iPhone 或 iPad | 更新运行服务器的设备。见 [iPhone 和 iPad](#iphone-and-ipad)。 |

<a id="back-up-first"></a>

## 先做备份

跨版本大幅升级之前先做一次备份；只要之后可能退回旧版本，就一定要先备份。

1. 打开 **Settings**(设置)。
2. 切换到 **Advanced**(高级) 选项卡。
3. 找到 **Backup & Export**(备份与导出) 一节。
4. 点击 **Download Backup**(下载备份)。
5. 把 `.zip` 文件保存到安全的位置。

处理过程中按钮会显示 **Creating backup…**。完成后，浏览器会保存一个包含数据的 `.zip` 压缩包。恢复方法见[备份与恢复 Marinara](data/backup-and-restore.md)。

## 按平台升级

找到与安装方式对应的小节。下文说的“git 副本”指用 Git 工具安装的副本，Windows 安装程序装出来的副本和任何 `git clone` 都属于这一类。

### Windows

启动 Marinara 时，启动脚本会顺便更新它。

1. 关闭 Marinara Engine。
2. 从桌面或开始菜单的快捷方式重新打开，或者运行 `start.bat`。

启动脚本会拉取最新代码，重新安装有变动的部分，重新构建，然后启动新版本。如果你自己改过代码，它会把这些改动暂存起来，更新完再放回去；做不到时，它会保留当前版本并打印一条说明。更新之前它会先复制一份数据；如果某次更新会落到比数据更旧的版本上，它会跳过这次更新（见[降级到旧版本](#downgrading-to-an-older-version)）。

只想跳过这一次更新，运行 `start.bat --skip-update`。想让已安装的版本在之后每次启动时都保持不变，在项目的 `.env` 里设置 `AUTO_UPDATE_ENABLED=false`。这只关闭自动更新，手动命令和 **Settings → Advanced → Check for Updates**(设置 → 高级 → 检查更新) 仍然可用。

如果启动脚本提示 Node.js 版本太旧，先安装 Node.js 24 LTS(Long Term Support，即推荐使用的长期支持稳定版)，再重新启动 Marinara。也可以从 GitHub Releases 页面下载最新的安装程序来运行。

<a id="macos-and-linux"></a>

### macOS 和 Linux

1. 关闭 Marinara Engine。
2. 在 Marinara 文件夹里运行启动脚本。

```bash
./start.sh
```

启动脚本会拉取最新代码，重新安装有变动的依赖，重新构建并启动新版本。只跳过这一次用 `./start.sh --skip-update`；想关闭自动更新，在 `.env` 里设置 `AUTO_UPDATE_ENABLED=false`。如果 Node.js 版本太旧，先安装 Node.js 24 LTS，再重新运行启动脚本。

<a id="docker-or-podman"></a>

### Docker 或 Podman

容器靠拉取新镜像更新，不走启动脚本。先做一次备份，然后在存放 Compose 文件的文件夹里运行下面的命令。

```bash
docker compose pull && docker compose up -d
```

用 Podman 时改用 `podman compose`。发布镜像是 `ghcr.io/pasta-devs/marinara-engine:X.Y.Z` 和 `:latest`，另外还有对应的 `-lite` 标签。拉取镜像不会动 `marinara-data` 卷里的数据。见[容器安装](installation/containers.md)。

### Android (Termux)

Termux 是一款 Android 应用，它为 Marinara 运行一个小型 Linux 系统。它的启动脚本每运行一次就更新一次 Marinara。

1. 打开 Termux。
2. 运行启动脚本。

```bash
cd Marinara-Engine
./start-termux.sh
```

启动脚本会更新代码，必要时升级 Node.js，然后重新构建并启动服务器。如果某次更新出了问题，想留在当前副本上，就加上 `--skip-update`。想关闭自动更新，在项目的 `.env` 里设置 `AUTO_UPDATE_ENABLED=false`。

如果用的是 Android 应用（APK），请[下载最新 APK](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk) 并打开它，让 Android 更新应用。然后打开 Marinara Engine，点击 **Install / Start Marinara** 来更新并启动 Termux 副本。更新绝不会要求你提供签名凭据或任何密钥。

<a id="iphone-and-ipad"></a>

### iPhone 和 iPad

这些设备不运行服务器。主屏幕上的图标是 PWA，也就是保存到主屏幕、能像应用一样打开的网站。

1. 更新运行 Marinara 服务器的电脑、容器主机或 Android 设备，参照上面对应的小节。
2. 重新加载主屏幕应用或 Safari 选项卡。

如果 Safari 一直显示旧版本，就重装 PWA。见[清除并重装 PWA](installation/ios-pwa.md#clearing-and-reinstalling-the-pwa)。

<a id="manual-update-git-copy-no-launcher"></a>

### 手动更新（git 副本，不用启动脚本）

如果你的 git 副本是用 `pnpm start` 而不是启动脚本来运行的，就用这种方式。下面的命令都在 Marinara 文件夹里运行。

1. 拉取最新的稳定版代码。

```bash
git fetch origin +refs/heads/main:refs/remotes/origin/main
```

2. 切换到这个版本。

```bash
git merge --ff-only origin/main || git checkout --detach origin/main
```

3. 重新安装依赖，重新构建并启动。

```bash
pnpm install --force --frozen-lockfile
pnpm build
pnpm start
```

想用 staging(测试版)，就用下面这两条命令代替第 1 步和第 2 步：

```bash
git fetch origin +refs/heads/staging:refs/remotes/origin/staging
git checkout -B staging origin/staging
```

> **警告：** Staging 构建是预发布的测试版构建。用之前先备份数据。

## 在应用内更新

Marinara 可以向 GitHub 检查有没有新版本。部分安装方式还能直接在浏览器里应用更新。

1. 打开 **Settings**。
2. 切换到 **Advanced** 选项卡。
3. 找到 **Updates**(更新) 一节。

### 选择发布通道

**Release Channel**(发布通道) 决定你跟踪哪一类构建。

- **Latest Stable**：打了 `vX.Y.Z` 标签的正式发布版本，一般选这个。
- **Staging/UAT**：预发布的测试版构建，可能还没做完。选中它会出现警告“Staging builds are pre-release tester builds. Back up your app data before applying them.”

在服务器所在电脑的浏览器里选中另一个通道时，更新按钮会变成 **Switch to** 加通道名。即使普通的应用内更新已经关闭，它照样能用，运行期间显示 **Switching…**。远程设备只有满足下面 **Apply Update**(应用更新) 的条件，才能这样切换。

### Check for Updates

点击 **Check for Updates**(检查更新)。检查期间按钮显示 **Checking…**。按钮下方会显示你的 **Release** 版本号、**Build** 提交码，已知时还会显示 **Branch**。

- 已经是最新版时，会出现一行绿色提示，写着“You're on the latest”和当前版本号。
- 有新版本时，会出现一张卡片，写着“vX.Y.Z available”，并带一个 **Release notes** 链接。
- git 副本落后时，卡片会显示“N commits behind”。一个提交就是代码里的一次保存改动，所以这个数字可能包含尚未发布的工作。

发布版本检查的结果缓存约 15 分钟，提交数缓存约 5 分钟，所以紧接着再点一次，看到的可能还是同样的数字。

如果检查失败，会看到“Could not check for updates. Try again later.”这通常是网络或 GitHub 出了问题。

### Apply Update

**Apply Update** 在浏览器里更新 git 副本。只有以下条件全部满足时，它才会出现：

- 这是一个 git 副本。容器和其他安装方式没法这样应用更新。
- 分支是 `main`、`master` 或 `staging`，或者是处于分离（detached）状态的仓库。其他任何分支上的副本都算作开发用的仓库，Marinara 会拒绝更新。
- 服务器所有者在服务器的 `.env` 文件里设置了 `UPDATES_APPLY_ENABLED=true`。
- 没有设置 `UPDATES_APPLY_DISABLED`。它会阻止所有应用更新的操作，包括通道切换；开发者用的启动脚本会设置它。

在运行服务器的那台电脑上应用更新，不需要管理员密钥。用 `http://127.0.0.1:7860` 或 `http://localhost:7860` 打开 Marinara 就行。

有两项设置会改变这一点：

- 由反向代理或隧道提供的地址算作另一台设备。`REQUIRE_AUTH_FOR_LOOPBACK_PROXY=false` 会把这些访客当作本地访客，包括本地免管理员密钥的放行。公开的代理或隧道请保持开启。
- `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK=true` 会让本地请求也需要密钥。

从另一台设备应用更新默认是关闭的，需要同时满足以下三点：

- 服务器的 `.env` 里设置了 `UPDATES_ALLOW_REMOTE_APPLY=true`。
- 服务器的 `.env` 里设置了 `ADMIN_SECRET`。这是用于高风险操作的第二个密码。
- 在你的设备上，把同一个密钥保存到 **Settings → Advanced → Admin Access**(设置 → 高级 → 管理员访问)。

点击 **Apply Update**。服务器拉取代码、重新安装、重新构建并关闭期间，按钮显示 **Updating…**。接着会看到“Update applied successfully. Please relaunch the app to use the new version.”再次启动 Marinara 就完成了。

如果没有成功：**Apply Update** 不出现时，Marinara 会说明原因。

- 容器安装会显示镜像标签，以及要在主机上运行的 `docker compose pull && docker compose up -d` 命令。
- 关闭了应用更新的 git 副本会显示一条可以复制的手动命令。
- 其他安装方式会显示一个指向 GitHub 发布页的 **Download**(下载) 链接。

## 在浏览器里刷新应用

**Refresh App**(刷新应用) 也在同一个 **Updates** 一节。它不会更新服务器。它会移除 service worker(浏览器用来快速加载应用的一个小脚本)，清空浏览器缓存，然后重新加载页面。聊天和设置都不受影响。

服务器已经更新，应用却看起来还是旧的或一片空白时，就用它。运行期间按钮显示 **Refreshing…**。

## 数据与可选下载

升级替换的是应用代码，不会动数据文件夹或 `marinara-data` 卷。聊天、角色、用户角色、世界书、预设、连接和设置都原样保留。想知道数据存放在哪里，读[备份与恢复 Marinara](data/backup-and-restore.md)。

- **可选包。** 从内置了第一方智能体、地图、通话或 Conversation(对话模式) 小游戏的版本升级时，第一次启动会下载对应的可选包。你的选择、设置和历史记录都会保留。第一次启动时请保持服务器联网。如果下载源连不上，Marinara 会在下次启动时重试，不会删除任何东西。
- **指南语言。** 如果使用了下载的文档语言（**Settings → General → Documentation Language**(设置 → 常规 → 文档语言)），更新后第一次启动会刷新它。如果连不上下载源，Marinara 会保留已安装的语言包，缺失的指南显示英文，并在下次启动时再试一次。
- **界面语言。** 界面语言包需要单独手动下载。首次从内置翻译的版本升级时，界面会恢复为英文。请在 **Settings → General → Language**(设置 → 常规 → 语言) 里重新选择你的语言。后续更新会保留已下载的语言包。使用 **Refresh language pack**(刷新语言包) 获取新翻译。缺失的翻译显示英文。

## 从 2.5.0 更新

上面的步骤不变。有几处变化会影响供其他设备或其他人使用的服务器。如果你属于这种情况，展开下面的详情。

<details>
<summary>共享服务器的变化</summary>

- **同一台电脑上的反向代理或隧道。** nginx、Caddy、Cloudflare Tunnel、Tailscale Serve 或 ngrok 转发给 Marinara 的访客现在算作远程访客。没有登录时，他们看到的是设置页面，备份和其他受保护的操作也需要管理员密钥。见[同一台电脑上的反向代理和隧道](REMOTE_ACCESS.md#reverse-proxies-and-tunnels-on-the-same-computer)。
- **Tailscale 登录放行。** 直接连到这台电脑 Tailscale 地址的连接仍然跳过登录。来自 `100.64.0.0/10` 的其他连接不再跳过，通过 Tailscale Serve 和 Funnel 的访客需要登录。见 [Tailscale 与 Docker 放行](REMOTE_ACCESS.md#tailscale-and-docker-bypass)。
- **设置了密码或允许列表的 Docker。** 设置了登录（应用登录或 Basic Auth）后，主机上的浏览器现在也会被要求登录。设置了 `TRUSTED_AUTH_PROXY` 时也一样，除非连接过来的正是那个代理。如果只设置了 `IP_ALLOWLIST`，主机浏览器会被拒绝，除非你把容器的网关列进去，所以请改用登录。见 [Tailscale 与 Docker 放行](REMOTE_ACCESS.md#tailscale-and-docker-bypass)。
- **迁移到另一个安装的聊天和档案。** 聊天记录、设置方案或完整档案不会再把它的 **Discord Mirror**(Discord 镜像)、**DeepLX URL**(DeepLX 地址)、**DeepL API Key**(DeepL API 密钥) 或 **Intiface URL**(Intiface 地址) 带到另一个安装里，需要在那边重新填写。你自己的设置方案，以及在同一个安装上恢复的完整档案，会保留这些值。
- **更新后被锁在外面？** 见[更新后被锁在外面](REMOTE_ACCESS.md#locked-out-after-updating)。

</details>

<a id="downgrading-to-an-older-version"></a>

## 降级到旧版本

回退并不总是可行。新版本会用更新的存储格式保存数据，而构建遇到比自己认识的格式更新的数据时会拒绝打开。当前构建使用存储格式 10。格式 8、9 和 10 分别加入了 MMD 虚拟形象、连接的账号关联和 GLB/FBX 虚拟形象。只认识较旧格式的构建打不开以这些格式保存的数据。

启动器会跳过会落到不兼容版本上的自动更新，应用内更新器也会拒绝应用这样的更新。要回到旧构建，请停止 Marinara，并恢复升级之前做的完整备份。下面提到的聊天文件转换命令无法转换 MMD 虚拟形象设置。不要手动修改格式编号。

如果你的数据早于存储格式 8，一条转换命令就能把聊天文件恢复为旧布局。见[切换到旧版本后聊天不显示消息](TROUBLESHOOTING.md#chats-show-no-messages-after-switching-to-an-older-version)。

<a id="going-back-to-250"></a>

### 回到 2.5.0

2.5.0 无法打开已升级到存储格式 8 或更新格式的数据，请使用升级之前做的备份。

对于 2.5.0 能打开的较旧数据，它也不认识新功能添加的内容：一些连接设置、重新生成聊天图像所用的细节，以及游戏检查点、规则集时钟和场景视频的部分内容。2.5.0 保存聊天或连接时，例如你发送消息、玩一个游戏回合、生成图像或修改连接时，它会把这些较新的数据从整个聊天或连接中丢弃。再次更新也找不回来。

想原样回到之前的状态，就在更新前先做一次备份。见[先做备份](#back-up-first)。

## 升级失败怎么办

升级出问题，多半是 Node.js 版本太旧、下载不完整，或者浏览器缓存过期。

- 启动脚本提示 Node.js 版本太旧时，安装 Node.js 24 LTS 后重新启动。
- 服务器更新后应用看起来不正常时，点击 **Refresh App**。
- git 副本没法干净地更新时，用[手动更新](#manual-update-git-copy-no-launcher)的命令。

具体报错信息和解决办法，见 [Marinara Engine 故障排查](TROUBLESHOOTING.md)。

## 相关指南

- [备份与恢复 Marinara](data/backup-and-restore.md)
- [Marinara Engine 故障排查](TROUBLESHOOTING.md)
- [Windows 安装指南](installation/windows.md)
- [macOS / Linux 安装指南](installation/macos-linux.md)
- [通过容器运行（Docker / Podman）](installation/containers.md)
- [Android (Termux) 安装指南](installation/android-termux.md)
- [iOS / iPadOS PWA 指南](installation/ios-pwa.md)
