# Marinara Engine 安装

本指南帮你为自己的设备挑一种合适的 Marinara Engine 安装方式。Marinara 跑在自己的机器上，所以聊天和数据都留在本地。下表里每个平台都有各自的分步指南。

## 选择平台

想在哪台设备上运行 Marinara，就选对应的那篇指南。

| 平台 | 安装指南 |
|---|---|
| Windows | [Windows 安装指南](installation/windows.md) |
| macOS 或 Linux | [macOS / Linux 安装指南](installation/macos-linux.md) |
| Docker 或 Podman | [通过容器运行（Docker / Podman）](installation/containers.md) |
| Android 手机或平板 | [下载 APK](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk) · [Android 安装指南](installation/android-termux.md) |
| iPhone 或 iPad | [iOS / iPadOS](installation/ios-pwa.md) |

动手之前有几点要先知道：

- 在 **iPhone 或 iPad** 上，Marinara 自己不运行服务器。服务器要跑在一台电脑、家用服务器或者 Android 设备上，再用 iPhone 或 iPad 的 Safari 打开。iOS 指南里有详细说明。
- 在 **Android** 上，Marinara 跑在 **Termux** 里。Termux 是一个免费应用，能给 Android 提供一个小型 Linux 环境。点击 APK 直接下载，批准 Android 必需的安装和 Termux 权限提示，应用会自动处理私密 localhost 凭据。安装程序不会要求 Android 签名凭据或这个本地密钥。

## 该选哪一种

如果是第一次接触，希望尽量少折腾，就从下面两种里挑：

- **Windows** 上用 **Windows installer**(Windows 安装程序)。它会自动下载并配置好全部内容，还会在桌面上建一个快捷方式。
- **Android** 上用上面的 **下载 APK** 链接。打开下载的文件，然后在应用中点击 **Install / Start Marinara**。
- **macOS**、**Linux** 或家用服务器上用 **Docker**。一条命令就能把应用跑起来。镜像里已经装好了 Node.js、全部依赖，以及构建完成的应用，不用自己安装 Node.js，也不用自己构建。

如果用惯了终端，而且以后可能想改代码，那就从源码运行。“从源码运行”的意思是：下载代码，在自己的机器上构建应用。**Windows**、**macOS 和 Linux**、**Android (Termux)** 这三篇指南都介绍了这条路线。

## 基本环境要求

- 需要一台能运行服务器的电脑或设备，系统为 Windows、macOS、Linux 或 Android。
- 从源码运行需要 **Node.js** 24 版和 **Git**。Node.js 负责运行应用，Git 负责下载和更新代码。各平台指南里都给出了这两者的下载链接。
- 用 **Docker** 和 **Podman** 安装不需要 Node.js。推荐的 Compose 方案仍然要用 Git 下载项目文件，容器指南里有说明。
- 默认情况下，应用跑在自己的机器上，地址是：

```text
http://127.0.0.1:7860
```

- 地址里的 `127.0.0.1` 指的就是自己这台电脑，`7860` 是默认端口。想从手机或者同一网络里的其他设备访问 Marinara，局域网访问的说明见[常见问题](FAQ.md)。

## 装好之后做什么

Marinara 跑起来并在浏览器里打开之后，读一读 [Marinara Engine 入门](home/welcome.md)。这篇会带你走完最初几步：添加连接，创建或导入角色，然后开始聊天。

以后想让安装保持最新，参见[升级 Marinara Engine](UPGRADING.md)。

## 相关指南

- [Windows 安装指南](installation/windows.md)
- [macOS / Linux 安装指南](installation/macos-linux.md)
- [通过容器运行（Docker / Podman）](installation/containers.md)
- [Android (Termux) 安装指南](installation/android-termux.md)
- [iOS / iPadOS](installation/ios-pwa.md)
- [升级 Marinara Engine](UPGRADING.md)
- [Marinara Engine 入门](home/welcome.md)
