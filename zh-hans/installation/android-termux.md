# Android (Termux) 安装指南

本指南介绍如何在 Android 手机或平板上运行 Marinara Engine。Marinara 跑在 Termux 里，这是一个面向 Android 的免费 Linux 环境。可以用 Android 应用一键搞定，也可以在 Termux 终端里手动安装。

## Termux 和 F-Droid 是什么

Termux 是一个免费应用，能在手机上提供一套小型 Linux 系统和命令行。Marinara Engine 需要它，因为 Marinara 是一个 Linux 服务器，不是原生的 Android 应用。

F-Droid 是面向 Android 的免费开源应用商店。Marinara 的自动设置会下载稳定的 F-Droid 版 Termux。Termux 还有单独的实验性 Google Play 版；如果已经安装，Marinara 会识别其官方签名，但本指南仍推荐 F-Droid。

从这里安装 Termux：[Termux on F-Droid](https://f-droid.org/en/packages/com.termux/)。不要混用不同来源的 Termux 或插件应用，因为它们的签名必须匹配。各来源的细节见 [Termux 官方安装说明](https://github.com/termux/termux-app#installation)。

## 用 Android 应用安装（APK）

最省事的办法是用 Marinara Engine 的 Android 应用。APK 就是 Android 的应用安装文件。这个应用只是个辅助工具：它帮你配好 Termux，等本地服务器跑起来之后再打开 Marinara。真正干活的还是 Termux，所以 Android 会弹出几个系统提示要你同意。安装预构建 APK 不需要签名密钥、密码、本地访问密钥，也不用修改 `CSRF_TRUSTED_ORIGINS`。应用会自动生成并交换私密 localhost 凭据。不要向 `CSRF_TRUSTED_ORIGINS` 添加 `null`；它会被有意视为未设置，APK 握手也不需要它。

1. 点击[下载最新 Android APK](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk)。
2. 安装 APK，然后打开应用。
3. 点击 **Install / Start Marinara**(安装 / 启动 Marinara)。
4. 如果还没装 Termux，同意 Android 的安装提示，应用就能从 F-Droid 下载并安装 Termux。
5. Android 询问时，授予 **Run commands in Termux environment**(在 Termux 环境中运行命令) 权限。
6. 如果 Termux 拦下了这次配置，应用会帮你复制好一条 `allow-external-apps` 命令。把这条命令粘贴到 Termux 里执行一次，然后再点一次 **Install / Start Marinara**。
7. 等 Termux 装好依赖并构建 Marinara。首次构建要花几分钟。
8. Termux 完成后返回 Marinara Engine 应用。本地服务器就绪后，应用会自动连接并登录。

想要一个像普通应用一样点开就用的主屏幕图标，这个 Android 应用同样能提供。它只是 Termux 服务器外面的一层壳，所以得先把服务器配好，也绕不开 Android 的安装和权限提示，但不会要求你配置任何 Marinara 安装密钥。

## 在 Termux 里手动安装

不想用应用的话，也可以手动安装 Marinara。打开 Termux，粘贴这一条命令：

```
pkg update -y && pkg install -y git nodejs-lts && ([ -d "$HOME/Marinara-Engine/.git" ] || git clone https://github.com/Pasta-Devs/Marinara-Engine.git "$HOME/Marinara-Engine") && cd "$HOME/Marinara-Engine" && chmod +x start-termux.sh && ./start-termux.sh
```

这一条命令做了五件事：

1. 更新 Termux 的软件包。
2. 安装 Git 和 Node.js。Marinara 支持 Node.js 24、25、26 三个版本。
3. 下载 Marinara Engine，已经装过就跳过。
4. 给启动脚本（`start-termux.sh`）加上可执行权限。
5. 第一次运行启动脚本。

启动脚本会安装应用的依赖，在设备上构建 Marinara，然后启动本地服务器。Node.js 版本太旧时，它还会顺手升到新版。首次运行比较慢，因为要构建应用，之后再跑就快多了。

跑完之后，在 Android 浏览器里打开这个地址：

```
http://127.0.0.1:7860
```

Marinara 监听 `PORT`(应用使用的网络端口) 指定的端口，默认是 7860。如果改过 `PORT`，就换成对应的数字。

小提示：想要一个类似应用的图标，打开浏览器菜单，选择把 Marinara 添加到主屏幕的那一项。具体的菜单名各家浏览器不太一样。

## 再次启动 Marinara

首次配置完成后就不用再装一遍了。打开 Termux 运行：

```
cd Marinara-Engine
./start-termux.sh
```

启动脚本会先检查更新，再启动 Marinara。想直接启动当前这份、不去访问 GitHub，就加上 `--skip-update`：

```
cd Marinara-Engine
./start-termux.sh --skip-update
```

更新依赖时，启动脚本还会从本地 pnpm 缓存里清掉没有被引用的包，免得旧版本在手机上越堆越多、占掉好几个 GB。这个清理不会碰 Marinara 的聊天、设置和其他用户数据。

## 从其他设备访问

默认情况下，启动脚本会让 Marinara 在局域网内可访问，也就是说同一个 Wi-Fi 下的笔记本或另一部手机都能打开它。找到正确地址的详细步骤见[常见问题](../FAQ.md)。

## 更新

每次运行启动脚本（`./start-termux.sh`），它都会去 GitHub 查有没有新版本，有就先更新再启动。所以想一直用最新版，正常启动 Marinara 就行。

想启动已安装的版本、跳过更新，用这个跳过参数：

```
./start-termux.sh --skip-update
```

想让 Engine 版本在多次启动之间保持不变，在项目的 `.env` 里加上 `AUTO_UPDATE_ENABLED=false`。这不会禁用手动更新命令，也不影响 **Settings → Advanced → Updates**。

也可以在应用内检查更新。打开 **Settings**(设置)，进入 **Advanced**(高级) 选项卡，展开 **Updates**(更新) 一节，点击 **Check for Updates**(检查更新) 就能看到有没有更新的版本。应用内的 **Apply Update**(应用更新) 按钮默认关闭，需要额外配置。启用和使用方法见[升级 Marinara Engine](../UPGRADING.md)。

## 相关指南

- [Marinara Engine 安装](../INSTALLATION.md)
- [iOS / iPadOS PWA 指南](ios-pwa.md)
- [升级 Marinara Engine](../UPGRADING.md)
- [常见问题](../FAQ.md)
