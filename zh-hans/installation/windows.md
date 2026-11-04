# Windows 安装指南

用安装程序（步骤最少）或从源码在 Windows 电脑上安装 Marinara Engine。装好后，Marinara 就运行在你自己的电脑上。

## 准备工作

需要 Windows 10 或 Windows 11(64 位)、几个 GB 的可用磁盘空间，安装过程中还要能联网。安装程序建议预留约 2.5 GB 的可用空间。

还需要两个工具：

- **Node.js** 24、25 或 26 版。Node.js 负责运行这个应用。推荐用 24 版，它是 LTS(Long Term Support，长期支持) 版本。
- **Git**。Git 负责下载代码，也让 Marinara 能自我更新。

用安装程序的话，不用自己装这两个工具，它会替你下载。从源码安装则要自己装。不需要安装 pnpm(负责安装应用各个组成部分的工具)，安装程序和 `start.bat` 会把它准备好。

## 用 Windows 安装程序安装

1. 打开 [Marinara Engine 发布页面](https://github.com/Pasta-Devs/Marinara-Engine/releases)。
2. 下载最新的 Windows 安装程序。它的文件名是 `Marinara-Engine-Installer-` 加上版本号。
3. 运行安装程序。如果 Windows 显示“Windows protected your PC”，选择 **More info**(更多信息)，再选 **Run anyway**(仍要运行)，但只对从发布页面下载的文件这样做。
4. 按提示往下走。如果缺 Node.js 或 Git，让安装程序把它装上。
5. 选择安装文件夹，或者直接用默认值（`%LOCALAPPDATA%\Marinara-Engine`）。
6. 等它下载并构建应用。进度列表会显示每一步。这要花几分钟。
7. 提示安装完成后，双击桌面上的 **Marinara Engine** 快捷方式。

控制台窗口（一个黑色的文字窗口）会打开并显示进度。随后浏览器会打开 Marinara。如果没有打开，访问 `http://127.0.0.1:7860`。

安装程序会为最新的稳定版做一份 Git 副本，所以 Marinara 每次启动时都能自我更新。

> **提示：** 有些杀毒软件会把安装程序标记出来，因为它会下载 Node.js 和 Git。只运行从上面发布页面拿到的安装程序。

## 启动和停止 Marinara

- **启动：** 双击桌面快捷方式或开始菜单里的条目。从源码安装的话，在 Marinara 文件夹里运行 `start.bat`。
- **停止：** 快捷方式会打开一个控制台窗口，在里面按 <kbd>Ctrl</kbd>+<kbd>C</kbd>。

如果 Marinara 已经在运行，快捷方式会在浏览器里重新打开它。

## 从源码安装

如果更愿意自己敲命令，或者想用 staging(测试版) 版本，就选这种方式。

1. 安装 [Node.js](https://nodejs.org/en/download) 和 [Git for Windows](https://git-scm.com/download/win)。
2. 打开一个新的命令提示符窗口（输入命令的文字窗口）。
3. 检查两个工具。`node -v` 必须显示 24、25 或 26 版。

   ```bat
   node -v
   git --version
   ```

   如果提示找不到命令，关掉命令提示符再重新打开，或者把缺的那个工具重装一遍。

4. 下载代码。

   ```bat
   git clone https://github.com/Pasta-Devs/Marinara-Engine.git
   ```

5. 进入它的文件夹。

   ```bat
   cd Marinara-Engine
   ```

6. 可选：第一次启动之前切换到 staging 版本。要留在稳定版就跳过这一步。用 staging 之前先备份数据。

   ```bat
   git checkout staging
   ```

   之后启动脚本更新时会一直留在 staging 上。

7. 运行启动脚本，也就是负责搭建并启动 Marinara 的脚本。

   ```bat
   start.bat
   ```

第一次启动要几分钟，因为要安装和构建所有东西。控制台窗口会显示进度。就绪后浏览器会打开 Marinara。之后想再启动，在同一个文件夹里运行 `start.bat`。

如果没有成功：`[ERROR] Node.js 24 LTS or newer is required` 表示 Node.js 版本太旧。从 [nodejs.org](https://nodejs.org) 安装 Node.js 24 或更新版本，然后再运行一次 `start.bat`。

### 不用启动脚本的手动搭建

这种方式需要 `pnpm` 命令。下面的命令都在 `Marinara-Engine` 文件夹里运行。

1. 安装 pnpm，只需运行一次。

   ```bat
   npm install -g pnpm
   ```

2. 安装依赖（应用需要的各个组成部分），构建应用，然后启动服务器。

   ```bat
   pnpm install --force
   pnpm build
   pnpm start
   ```

3. 打开 `http://127.0.0.1:7860`。

用 `pnpm start` 时，只有这台电脑能访问 Marinara。想让其他设备连进来，在 `Marinara-Engine` 文件夹里新建一个名为 `.env` 的文件，加上下面这行，然后重启服务器。

```env
HOST=0.0.0.0
```

## 从其他设备打开 Marinara

安装程序、它的快捷方式和 `start.bat` 都允许网络里的其他设备访问 Marinara，但在你设置登录之前会拦住它们。具体步骤见[远程访问](../REMOTE_ACCESS.md)和[常见问题](../FAQ.md#how-do-i-access-marinara-engine-from-my-phone-or-another-device)。

## 更新 Marinara

每次从快捷方式或 `start.bat` 启动 Marinara 时，启动脚本都会检查更新、安装更新、重新构建，然后启动。聊天、角色和设置都会原样保留。如果你自己改过代码，启动脚本会把这些改动暂存起来，更新完再放回去；做不到时，它会保留当前版本并打印一条说明。应用内的 **Apply Update**(应用更新) 按钮、跳过更新和手动命令，见[升级 Marinara Engine](../UPGRADING.md#windows)。

## 找到数据或卸载

数据在 Marinara 文件夹里的 `packages\server\data` 文件夹中。要卸载，打开开始菜单里的 **Uninstall Marinara Engine**(卸载 Marinara Engine)。卸载程序会问你是否同时删除数据。选 **No**(否) 可以保留数据，留着以后重装时用。见[备份与恢复 Marinara](../data/backup-and-restore.md)。

## 可选：AI 立绘背景去除

Marinara 会为生成的立绘请求透明背景，并能自己清理纯色背景。对付细节丰富的布景，可以另外装一个可选的 `backgroundremover` 工具作为兜底。它要下载体积很大的机器学习文件，所以默认是关闭的。

1. 从 [python.org](https://www.python.org/downloads/windows/) 安装 Python 3.11。Python 3.9 到 3.11 都能用。
2. 在 `Marinara-Engine` 文件夹里运行这条命令。

   ```bat
   pnpm backgroundremover:install
   ```

这会在数据文件夹下建一个私有的 Python 文件夹（一个 venv）。Marinara 会自动使用它。

想让 `start.bat` 在下次启动时替你装好它，往 `.env` 文件里加上这行：

```env
BACKGROUNDREMOVER_AUTO_INSTALL=true
```

## 出问题了怎么办

确认 Node.js 是 24、25 或 26 版，并且已经装好 Git。更多解决办法见 [Marinara Engine 故障排查](../TROUBLESHOOTING.md)。

## 相关指南

- [Marinara Engine 安装](../INSTALLATION.md)
- [升级 Marinara Engine](../UPGRADING.md)
- [Marinara Engine 故障排查](../TROUBLESHOOTING.md)
- [常见问题](../FAQ.md)
