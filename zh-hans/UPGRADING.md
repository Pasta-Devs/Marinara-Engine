# 升级 Marinara Engine

本指南介绍如何把 Marinara Engine 更新到新版本，涵盖所有安装方式、应用内的更新工具，以及升级失败时的处理办法。升级之后，聊天和设置都会保留。

## 数据会完整保留

升级 Marinara Engine 不会删除数据。聊天、角色、用户角色、世界书、预设、连接和各项设置都原样保留。

Marinara 把数据存在运行服务器的那台机器上的本地数据文件夹里，Docker 和 Podman 则存在 `marinara-data` 卷中。更新只替换应用代码，不会动这个数据文件夹或卷。

如果原来的版本内置了第一方智能体、地图、通话或 Conversation(对话模式) 小游戏，升级后第一次启动会从官方目录下载对应的可选包。已有的聊天选择、智能体设置、已存储的运行数据和历史记录都会保留。第一次启动时请保持服务器联网。如果目录连不上，Marinara 会在下次启动时重试迁移，而不会删除或禁用已保存的配置。

如果使用了下载的文档语言（**Settings**(设置) → **General**(常规) → **Documentation Language**(文档语言)），更新后第一次启动还会检查这个语言包有没有变化，并自动刷新。如果下载源连不上，Marinara 会保留已安装的语言包（其中缺失的指南显示英文），并在下次启动时再试一次。更新永远不会重置语言选择。

数据存放在哪里、怎么另存一份副本，见[备份与恢复 Marinara](data/backup-and-restore.md)。

## 先做备份

升级本身是安全的，但备份成本很低，值得一做。跨版本大幅升级前先备份一次。

1. 打开 **Settings**。
2. 切换到 **Advanced**(高级) 选项卡。
3. 找到 **Backup & Export**(备份与导出) 一节。
4. 点击 **Download Backup**(下载备份)。
5. 把 `.zip` 文件保存到安全的位置。

处理过程中按钮会变成 **Creating backup…**。完成后，浏览器会保存一个包含数据的 `.zip` 压缩包。

备份和恢复的完整步骤见[备份与恢复 Marinara](data/backup-and-restore.md)。

## 按平台升级

找到与安装方式对应的小节。下文说的“git checkout”指用 Git 工具安装的副本，“clone”指用 Git 下载下来的副本。

### Windows

用 Windows 安装程序或 git checkout 装的版本，启动脚本会自动完成更新。

1. 关闭 Marinara Engine。
2. 从开始菜单的快捷方式重新打开，或者运行 `start.bat`。

启动脚本会拉取最新代码，重新安装有变动的部分，重新构建应用，然后启动新版本。安装程序和手动 clone 两种情况都适用。

只想跳过这一次更新，运行 `start.bat --skip-update`。想让 Engine 版本在此后每次启动时都保持不变，在项目的 `.env` 里设置 `AUTO_UPDATE_ENABLED=false`。这只关闭 Engine 的自动更新，手动命令和 **Settings → Advanced → Check for Updates**(检查更新) 仍然可用。

如果启动脚本提示 Node.js 版本太旧，先安装 Node.js 24 LTS，再启动 Marinara。LTS 是 Long Term Support 的缩写，指 Node.js 推荐的长期支持稳定版。

也可以从 GitHub Releases 页面下载最新的安装程序运行。它走的是同一套基于 git 的流程，以后的更新照样由启动脚本完成。

### macOS 和 Linux

关闭 Marinara Engine，然后在 Marinara 文件夹里运行启动脚本。

```bash
./start.sh
```

启动脚本会拉取最新代码，重新安装有变动的依赖，重新构建并启动新版本。

只跳过这一次用 `./start.sh --skip-update`；想长期关闭，在 `.env` 里设置 `AUTO_UPDATE_ENABLED=false`。手动更新命令和应用内的更新控件仍然可用。

如果提示 Node.js 版本太旧，先安装 Node.js 24 LTS，再重新运行启动脚本。

### Docker 或 Podman

容器安装靠拉取新镜像更新，不走启动脚本。在存放 Compose 文件的文件夹里运行下面的命令。

```bash
docker compose down && docker compose pull && docker compose up -d
```

Podman 用同样的命令，把命令名换成 `podman`。

```bash
podman compose down && podman compose pull && podman compose up -d
```

发布镜像会推送为 `ghcr.io/pasta-devs/marinara-engine:X.Y.Z` 和 `:latest`，还有对应的 `-lite` 标签。除非有意留在旧版本，否则拉取 `:latest` 或最新的版本标签。拉取镜像不会动 `marinara-data` 卷里的数据。

### Android (Termux)

Termux 是 Android 上的终端和 Linux 环境。它的启动脚本每运行一次就更新一次 Marinara。

1. 打开 Termux。
2. 运行启动脚本。

```bash
cd Marinara-Engine
./start-termux.sh
```

启动脚本会更新代码，必要时把 Node.js 一并更新，重新构建并启动本地服务器。

如果某次更新有问题，需要留在当前副本上，那就跳过更新检查。

```bash
cd Marinara-Engine
./start-termux.sh --skip-update
```

想长期关闭，在项目的 `.env` 里设置 `AUTO_UPDATE_ENABLED=false`。这只影响由启动脚本管理的 Engine 更新，手动更新和应用内的更新控件仍然可用。

如果用的是 Android 应用图标（APK），请[下载最新 APK](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk)并打开下载的文件，让 Android 更新外壳本身。然后打开 Marinara Engine，点击 **Install / Start Marinara** 来更新并启动背后的 Termux 副本。应用会自动保留并交换私密 localhost 凭据；更新不会要求签名凭据或这个密钥。

### iPhone 和 iPad

iPhone 和 iPad 不运行 Marinara 服务器，而是通过 Safari 打开跑在另一台设备上的服务器。添加到主屏幕的那个副本是 PWA，全称 Progressive Web App。PWA 就是添加到主屏幕、能像应用一样打开的网站。

1. 更新真正运行 Marinara 服务器的电脑、Docker 主机或 Android 设备，参照上面对应的小节。
2. 在 iPhone 或 iPad 上重新加载主屏幕的 PWA 或 Safari 选项卡。

如果服务器已经更新，Safari 却一直显示旧版本，就清掉缓存的副本。

1. 删除主屏幕图标。
2. 清除 Safari 中这个 Marinara 主机的网站数据。
3. 重新添加到主屏幕。

## 在应用内检查并应用更新

Marinara 可以在应用内向 GitHub 检查有没有新版本。部分安装方式还能直接在浏览器里应用更新。

1. 打开 **Settings**。
2. 切换到 **Advanced** 选项卡。
3. 找到 **Updates**(更新) 一节。

### Release Channel

**Release Channel**(发布通道) 下拉菜单决定跟踪哪一类构建，有两个选项。

- **Latest Stable**：跟踪打了 `vX.Y.Z` 标签的正式发布版本，大多数人选这个。
- **Staging/UAT**：跟踪预发布的测试版构建。这些版本可能还没做完，用之前先备份数据。

选择 **Staging/UAT** 会出现一条警告：“Staging builds are pre-release tester builds. Back up your app data before applying them.”

切换通道算作一次有意的选择。在运行服务器的那台机器上用浏览器选中另一个通道时，更新按钮会变成 **Switch to** 加通道名，即使应用内更新已经关闭，它照样能用；运行期间按钮显示 **Switching…**。同通道的普通更新仍然需要下面 Apply Update 一节说明的配置，远程设备则任何时候都需要。

### Check for Updates

点击 **Check for Updates**(检查更新)，检查期间按钮显示 **Checking…**。

按钮下方会显示 **Release** 版本号和 **Build** 提交码。分支已知时还会多出一行 **Branch**。

- 已经是最新版时，会出现一行绿色对勾，写着“You're on the latest ... target”和当前版本号。
- 有新版本时，会出现一张卡片，写着“vX.Y.Z available”，并带一个 **Release notes** 链接。
- git 安装只是落后了若干提交时，卡片改为显示“N commits behind”。一个提交就是代码里的一次保存改动，所以这个数字可能包含尚未发布的工作。

更新检查的结果会缓存。发布版本检查缓存约 15 分钟，“commits behind”计数缓存约 5 分钟。刚点完马上再点一次 **Check for Updates**，看到的可能还是同样的数字。

### Apply Update

只有当前安装方式支持在浏览器里自我更新，**Apply Update**(应用更新) 按钮才会出现。这需要同时满足以下两点。

- 是基于 git 的安装（Docker 和打包安装用不了这种方式）。
- 服务器所有者在服务器的 `.env` 文件里设置了 `UPDATES_APPLY_ENABLED=true`。`.env` 文件里存放的是服务器设置。

在运行服务器的那台机器上点击 **Apply Update**，条件到此为止，不需要任何密钥。

从别的设备应用更新默认是关闭的，需要同时满足以下三点。

- 服务器所有者在 `.env` 里设置了 `UPDATES_ALLOW_REMOTE_APPLY=true`。
- 服务器所有者在 `.env` 里设置了 `ADMIN_SECRET`(受保护操作使用的密码)。
- 在自己的设备上，把同一个密钥保存到 **Settings -> Advanced -> Admin Access**(管理员访问)。

点击 **Apply Update** 后，按钮会显示 **Updating...**。服务器会拉取新代码，重新安装依赖，重新构建，然后关闭。接着会看到：“Update applied successfully. Please relaunch the app to use the new version.”重新启动 Marinara 就完成了。

如果 **Apply Update** 不可用，Marinara 会说明原因和替代做法。

- 容器安装会显示镜像标签，以及要在主机上运行的 `docker compose pull && docker compose up -d` 命令。
- 关掉了这项功能的 git 安装会显示一条可以直接复制的手动更新命令。
- 其他安装方式会显示一个指向 GitHub 发布页的 **Download**(下载) 链接。

如果检查本身失败，会看到：“Could not check for updates. Try again later.”这通常是网络或 GitHub 出了问题，过一会儿再试。

## Refresh App 按钮

**Refresh App**(刷新应用) 按钮就在同一个 **Updates** 一节。它不是服务器更新，只刷新当前浏览器里的应用。

**Refresh App** 会注销 service worker、清空浏览器缓存，然后重新加载页面。service worker 是浏览器用来快速加载和离线加载应用的一个小脚本。已保存的聊天、设置和其他本地数据都不受影响。

服务器已经跑在新版本上，应用界面却还是旧的、或者一片空白，这时候用 **Refresh App**。它解决的是网页卡住的问题，不会改动服务器代码，所以代替不了真正的升级。

运行期间按钮显示 **Refreshing…**，随后应用重新加载。

## 降级到旧版本

升级始终是安全的，但不一定能直接回退。新版 Marinara 会使用更新的磁盘格式保存聊天消息，早于数据格式的版本无法读取它。为了保护聊天记录，启动器会跳过会落到不兼容版本的自动更新，应用内更新器也会拒绝应用它。

如果仍然需要旧版本，可以先用一条转换命令把数据恢复为旧格式。步骤请参阅[切换到旧版本后聊天不显示消息](TROUBLESHOOTING.md#chats-show-no-messages-after-switching-to-an-older-version)。

## 升级失败怎么办

升级出问题，多半是 Node.js 版本太旧、下载不完整，或者浏览器缓存过期。

- 启动脚本提示 Node.js 版本太旧，安装 Node.js 24 LTS 后重新启动。
- 服务器更新完，应用界面看起来不正常，试试上面的 **Refresh App** 按钮。
- git 安装没法干净更新，就按对应安装指南里给出的手动更新命令操作。

具体报错信息和逐步解决办法，见 [Marinara Engine 故障排查](TROUBLESHOOTING.md)。

## 相关指南

- [备份与恢复 Marinara](data/backup-and-restore.md)
- [Marinara Engine 故障排查](TROUBLESHOOTING.md)
- [Windows 安装指南](installation/windows.md)
- [macOS / Linux 安装指南](installation/macos-linux.md)
- [通过容器运行（Docker / Podman）](installation/containers.md)
- [Android (Termux) 安装指南](installation/android-termux.md)
- [iOS / iPadOS PWA 指南](installation/ios-pwa.md)
