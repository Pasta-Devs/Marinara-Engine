# Android (Termux) 安装指南

在 Android 手机或平板上运行 Marinara Engine。Marinara 跑在 Termux 里，这是一个免费应用，能在手机上提供一套小型 Linux 系统。可以用 Marinara 的 Android 应用来配置（最省事），也可以在 Termux 里手动安装。

## 关于 Termux 和 F-Droid

Marinara 是一个 Linux 服务器，不是原生的 Android 应用，所以要靠 Termux 才能运行。F-Droid 是一个免费的开源应用商店。Android 应用在配置时会下载稳定的 F-Droid 版 Termux。Termux 还有一个实验性的 Google Play 版。如果已经装了这个版本，Marinara 也能用，但本指南推荐 F-Droid。

从 [Termux on F-Droid](https://f-droid.org/en/packages/com.termux/) 安装 Termux。不要混用不同来源的 Termux 或它的插件应用，因为它们的签名必须匹配。参见 [Termux 官方安装说明](https://github.com/termux/termux-app#installation)。

## 用 Android 应用安装

Marinara Engine 的 Android 应用会帮你配好 Termux，等本地服务器跑起来之后再打开 Marinara。过程中 Android 会弹出几个系统提示，要你同意。

1. 点击[下载最新 Android APK](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk)。APK 就是 Android 的应用安装文件。
2. 安装 APK，然后打开应用。
3. 点击 **Install / Start Marinara**(安装 / 启动 Marinara)。
4. 如果还没装 Termux，同意 Android 的安装提示，包括允许这个应用安装应用，这样它才能从 F-Droid 安装 Termux。
5. Android 询问时，授予 **Run commands in Termux environment**(在 Termux 环境中运行命令) 权限。
6. 如果 Termux 拦下了这次配置，应用会复制一条 `allow-external-apps` 命令并打开 Termux。在 Termux 屏幕上长按，点击 **Paste**(粘贴)，按 Enter，然后返回，再点一次 **Install / Start Marinara**。
7. 等 Termux 安装依赖（应用需要的组件）并构建 Marinara。Termux 会不断滚动显示文字。首次构建要花几分钟。
8. Termux 完成后返回 Marinara Engine 应用。服务器就绪后，应用会自动连接并登录，然后就能看到 Marinara 的主页。

想改用浏览器，在应用的启动界面选择 **Open in browser**(在浏览器中打开)。应用会记住这个选择，浏览器里同样会自动登录。

如果没有成功：先处理好拦住它的那个提示，再点一次 **Install / Start Marinara**。如果应用打不开 localhost，更新 APK，然后点击 **Install / Start Marinara**。参见 [Android localhost 登录帮助](../TROUBLESHOOTING.md#android-localhost-opens-the-login-page-or-returns-401503)。

这个应用不需要签名密钥、密码，也不用修改 `CSRF_TRUSTED_ORIGINS`。它会自己生成私密的 localhost 凭据。不要向 `CSRF_TRUSTED_ORIGINS` 添加 `null`。

## 在 Termux 里手动安装

不想用应用的话，就用这种方式。打开 Termux，在屏幕上长按并点击 **Paste**，粘贴这条命令（要完整复制）：

```bash
pkg upgrade -y && pkg install -y git nodejs-lts && \
([ -d "$HOME/Marinara-Engine/.git" ] || \
  git clone https://github.com/Pasta-Devs/Marinara-Engine.git "$HOME/Marinara-Engine") && \
cd "$HOME/Marinara-Engine" && chmod +x start-termux.sh && ./start-termux.sh
```

这条命令会依次：

1. 升级 Termux 的所有软件包。新版 Node.js 无法搭配旧版 Termux 库启动，所以 Termux 需要整体升级。如果它询问是否保留某个配置文件，按 Enter 保留当前的那份。
2. 安装 Git 和 Node.js。Marinara 支持 Node.js 24、25 和 26。
3. 下载 Marinara，已经有了就跳过。
4. 给启动脚本（`start-termux.sh`）加上可执行权限，然后运行它。

启动脚本会安装依赖，在设备上构建 Marinara，然后启动本地服务器。Node.js 版本太旧时，它会升级 Node.js。首次运行比较慢，Termux 会不断滚动显示文字。之后再运行就快了。

等它提示服务器已在运行，在 Android 浏览器里打开这个地址：

```text
http://127.0.0.1:7860
```

如果设置了别的 `PORT`，就换成那个数字。想要一个类似应用的图标，用浏览器菜单里把页面添加到主屏幕的那一项。这一项的名字各家浏览器不一样。

## 启动和停止 Marinara

使用应用时，打开应用；如果服务器已停止，点击 **Install / Start Marinara**。要在应用和浏览器之间切换，在启动界面使用 **Open in browser**，然后点击 **Retry connection**(重试连接)。在应用里，可以通过 **Settings → General → App Behavior → Open Android launcher (app or browser)**(设置 → 常规 → 应用行为 → 打开 Android 启动界面(应用或浏览器)) 回到启动界面。

手动安装时，打开 Termux 运行：

```bash
cd Marinara-Engine
./start-termux.sh
```

要停止服务器，在 Termux 里按 <kbd>Ctrl</kbd>+<kbd>C</kbd>。

## 更新 Marinara

每次运行 `./start-termux.sh`，启动脚本都会去 GitHub 查有没有新版本，有就先更新再启动。想不更新直接启动，就加上 `--skip-update`。更多选项和 APK 的更新步骤见[升级 Marinara Engine](../UPGRADING.md#android-termux)。

更新时，启动脚本还会从本地 pnpm 缓存里清掉没用到的包，免得旧版本越堆越多、占掉好几个 GB 的存储空间。这个清理不会碰你的聊天和设置。

## 从其他设备打开 Marinara

启动脚本会让同一个 Wi-Fi 下的其他设备连到 Marinara，但在你设置登录之前，会把它们挡在外面。参见[常见问题](../FAQ.md#how-do-i-access-marinara-engine-from-my-phone-or-another-device)和[远程访问](../REMOTE_ACCESS.md)。

如果更新后其他设备无法登录，参见[更新后被锁在外面](../REMOTE_ACCESS.md#locked-out-after-updating)。在 Termux 里运行这条命令，会移除应用登录，并让所有浏览器退出登录：

```bash
cd "$HOME/Marinara-Engine" && node scripts/reset-login.mjs
```

## 相关指南

- [Marinara Engine 安装](../INSTALLATION.md)
- [iOS / iPadOS PWA 指南](ios-pwa.md)
- [升级 Marinara Engine](../UPGRADING.md)
- [常见问题](../FAQ.md)
