# macOS / Linux 安装指南

在 Mac 或 Linux 电脑上安装 Marinara Engine，并用 `start.sh` 启动脚本启动它。装好后，Marinara 就运行在你自己的电脑上。

## 准备工作

需要两个工具：

- **Node.js** 24、25 或 26 版。Node.js 负责运行 Marinara。推荐用 24 版，它是 LTS(Long Term Support，长期支持) 版本。
- **Git**。Git 负责下载 Marinara 并获取更新。

不需要安装 pnpm(负责安装应用各个组成部分的工具)，启动脚本会准备好版本正确的 pnpm。

### 在 macOS 上安装 Node.js 和 Git

用 Homebrew 的话，一条命令就能装好这两个工具：

```bash
brew install node git
```

不用 Homebrew 的话，从 [nodejs.org](https://nodejs.org) 下载 Node.js 安装包，再通过 Xcode 命令行工具安装 Git：

```bash
xcode-select --install
```

### 在 Linux 上安装 Node.js 和 Git

用发行版的包管理器即可。Ubuntu 或 Debian 自带的 Node.js 往往低于 24 版，所以先添加 NodeSource 的发布源：

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo bash -
sudo apt install -y nodejs git
```

Fedora 上：

```bash
sudo dnf install -y nodejs git
```

Arch 上：

```bash
sudo pacman -S nodejs npm git
```

### 检查工具

```bash
node -v
git --version
```

`node -v` 必须显示 `v24` 或更高版本。如果有哪条命令报“command not found”，说明这个工具没装好。

## 安装并启动 Marinara

1. 打开终端，也就是输入命令的窗口。在 Mac 上，按 <kbd>Cmd</kbd>+<kbd>Space</kbd>，输入 Terminal，然后按 Enter。在 Linux 上，打开你的终端应用。
2. 下载 Marinara。

   ```bash
   git clone https://github.com/Pasta-Devs/Marinara-Engine.git
   ```

3. 进入新建的文件夹。

   ```bash
   cd Marinara-Engine
   ```

4. 用启动脚本启动 Marinara，也就是负责搭建并启动它的脚本。

   ```bash
   ./start.sh
   ```

第一次运行要几分钟，因为要下载并构建所有东西。终端会显示进度，然后显示 `Press Ctrl+C to stop`。Marinara 会在浏览器里打开 `http://127.0.0.1:7860`。如果浏览器没有打开，就自己访问这个地址。

如果没有成功：

- `permission denied`：运行 `chmod +x start.sh`，然后再运行一次 `./start.sh`。
- `[ERROR] Node.js 24 LTS or newer is required`：Node.js 版本太旧。安装较新的版本，然后再运行一次 `./start.sh`。

## 启动和停止 Marinara

- **再次启动：** 在 Marinara 文件夹里运行 `./start.sh`。如果 Marinara 已经在运行，它会在浏览器里重新打开 Marinara。
- **停止：** 在终端里按 <kbd>Ctrl</kbd>+<kbd>C</kbd>。

从 Git 下载的版本每次运行 `./start.sh` 时，启动脚本会：

1. 检查有没有新版本，有就先更新。
2. 检查 Node.js 和版本正确的 pnpm。
3. 代码有改动时，补装缺失的组成部分并重新构建应用。
4. 启动服务器并打开浏览器。

## 修改启动脚本设置

启动脚本的设置写在 Marinara 文件夹里的 `.env` 文件中。`.env` 是一个纯文本文件，一行一条设置。想让启动脚本不再自动打开浏览器，加上这一行：

```bash
AUTO_OPEN_BROWSER=false
```

`PORT` 用来设置端口，也就是地址里冒号后面的数字（默认 7860）。启动脚本允许局域网里的其他设备访问 Marinara，但在你设置登录之前会拦住它们。见[远程访问](../REMOTE_ACCESS.md)。

## 更新 Marinara

运行 `./start.sh` 时会先更新 Marinara。聊天、角色和设置都会原样保留。如果你自己改过代码，启动脚本会把这些改动暂存起来，更新完再放回去。跳过更新、应用内的 **Apply Update**(应用更新) 按钮和手动命令，见[升级 Marinara Engine](../UPGRADING.md#macos-and-linux)。

## 不用启动脚本的手动搭建

大多数人用启动脚本就够了。想每一步都自己来，就需要 pnpm。Node.js 24 自带 Corepack，一个用来启用 pnpm 的工具；Node.js 25 则没有。

1. 在 Node.js 24 上，启用 pnpm：

   ```bash
   corepack enable pnpm
   ```

   在 Node.js 25 或 26 上，先安装 Corepack：

   ```bash
   npm install --global corepack
   corepack enable pnpm
   ```

2. 下载 Marinara。

   ```bash
   git clone https://github.com/Pasta-Devs/Marinara-Engine.git
   ```

3. 进入它的文件夹。

   ```bash
   cd Marinara-Engine
   ```

4. 安装各个组成部分，构建应用，然后启动服务器。

   ```bash
   pnpm install --force
   pnpm build
   pnpm start
   ```

5. 打开 `http://127.0.0.1:7860`。

用 `pnpm start` 时，服务器只监听你自己的电脑。想让其他设备连进来，在 `.env` 里加上 `HOST=0.0.0.0` 并重启。

## 可选：背景移除工具

Marinara 会为生成的立绘（角色图片）请求透明背景，并能自己清理纯色背景。对付细节丰富的布景或阴影，可以另外装一个可选的 AI 背景移除工具作为兜底。它会建一个 Python venv(存放 Python 包的私有文件夹)，并下载体积很大的文件：PyTorch(一个机器学习库) 和 U2Net 模型（在图片里找出主体的文件）。

1. 在 macOS 上，Python 3.11 最合适，先装好它。Python 3.9 到 3.11 都能用。

   ```bash
   brew install python@3.11
   ```

2. 在 Marinara 文件夹里运行：

   ```bash
   pnpm backgroundremover:install
   ```

想让启动脚本在下次启动时装好它，在 `.env` 里加上这一行：

```bash
BACKGROUNDREMOVER_AUTO_INSTALL=true
```

## 出问题了怎么办

在某些 Linux 系统上，安装会失败，报错里包含 `ERR_PNPM_ENAMETOOLONG`(文件路径过长)。删掉装到一半的文件夹，再运行一次启动脚本：

```bash
rm -rf node_modules .pnpm .pnpm-store
./start.sh
```

更多解决办法见 [Marinara Engine 故障排查](../TROUBLESHOOTING.md)。

## 相关指南

- [Marinara Engine 安装](../INSTALLATION.md)
- [升级 Marinara Engine](../UPGRADING.md)
- [远程访问：登录与 IP 允许列表](../REMOTE_ACCESS.md)
- [Marinara Engine 故障排查](../TROUBLESHOOTING.md)
