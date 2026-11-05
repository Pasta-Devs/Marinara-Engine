# Marinara Engine 安装

Marinara 运行在你自己的设备上。在下面选择对应设备的指南。

## 选择平台

| 你的设备 | 指南 |
| --- | --- |
| Windows | [Windows 安装指南](installation/windows.md) |
| macOS 或 Linux | [macOS / Linux 安装指南](installation/macos-linux.md) |
| Docker 或 Podman | [通过容器运行（Docker / Podman）](installation/containers.md) |
| Android 手机或平板 | [Android 安装指南](installation/android-termux.md) |
| iPhone 或 iPad | [iOS / iPadOS](installation/ios-pwa.md) |

## 该选哪一种？

- **Windows：** 用 Windows 安装程序。它会配置好全部内容，还会在桌面上建一个快捷方式。
- **Android：** [下载 APK](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk)。打开下载的文件，然后在应用里点击 **Install / Start Marinara**(安装 / 启动 Marinara)。
- **macOS、Linux 或家用服务器：** 两种任选其一。原生指南用启动脚本把 Marinara 直接跑在你的电脑上。Docker 不需要 Node.js，也不用构建任何东西，但要先安装 Docker。
- **iPhone 或 iPad：** Marinara 无法在这些设备上运行服务器。把它跑在电脑、家用服务器或 Android 设备上，再用 Safari 打开。iOS 指南会说明具体做法。
- **想修改代码：** 从源码运行。也就是下载代码，在自己的设备上构建应用。Windows、macOS 和 Linux、Android 这几篇指南都有介绍。

在 Android 上，Marinara 跑在 **Termux** 里。Termux 是一个免费的 Android 应用，能在手机上提供一套小型 Linux 系统。APK 会帮你把 Termux 配好。

## 需要准备什么

- 从源码运行：需要 **Node.js** 24、25 或 26，以及 **Git**。Node.js 负责运行应用，Git 负责下载和更新代码。各平台指南里都给出了这两者的下载链接。
- 用 Docker 或 Podman：不需要 Node.js。推荐的 Compose 方案会用一次 Git 来下载项目文件。

## 打开 Marinara

Marinara 运行后，在同一台设备的浏览器里打开这个地址。不要在其他设备上使用这个地址。

```text
http://127.0.0.1:7860
```

`127.0.0.1` 指的就是这台设备。`7860` 是默认端口，也就是应用监听的那个数字。启动脚本（用来启动 Marinara 的脚本）也会让同一网络里的其他设备连到它，但在你设置登录之前，这些设备都会被挡在外面。在你修改端口那一行之前，Docker 或 Podman 安装只响应这台设备的访问；参见[容器指南](installation/containers.md#open-marinara-from-another-device)。

## 在手机上打开 Marinara

1. 在电脑、家用服务器或 Android 手机上安装并启动 Marinara。
   用 Docker 或 Podman 时，先按照[从其他设备打开 Marinara](installation/containers.md#open-marinara-from-another-device) 操作。
2. 在那台设备上设置登录。参见[远程访问](REMOTE_ACCESS.md#option-1-login-recommended)。
3. 找到那台设备的 IP 地址。[常见问题](FAQ.md#how-do-i-access-marinara-engine-from-my-phone-or-another-device)里有方法。
4. 在手机上打开 `http://`，后面接上 IP 地址和 `:7860`。

iPhone 的做法见 [iOS / iPadOS](installation/ios-pwa.md)。

## 装好之后

读一读 [Marinara Engine 入门](home/welcome.md)，添加连接，创建或导入角色，然后开始聊天。以后要更新，参见[升级 Marinara Engine](UPGRADING.md)。

## 相关指南

- [Windows 安装指南](installation/windows.md)
- [macOS / Linux 安装指南](installation/macos-linux.md)
- [通过容器运行（Docker / Podman）](installation/containers.md)
- [Android (Termux) 安装指南](installation/android-termux.md)
- [iOS / iPadOS](installation/ios-pwa.md)
- [升级 Marinara Engine](UPGRADING.md)
- [Marinara Engine 入门](home/welcome.md)
