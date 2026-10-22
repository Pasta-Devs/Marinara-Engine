# macOS / Linux 安装指南

本指南介绍如何在 macOS 或 Linux 上安装并运行 Marinara Engine。你会装好两个必需的工具，用 shell 启动脚本把应用跑起来，并学会以后怎么更新。Marinara Engine(下文简称 Marinara) 完全运行在自己的电脑上。

## 准备工作

动手之前需要装好两个免费工具：

- **Node.js**：运行 Marinara 的程序。请安装 24、25 或 26 版（推荐 24 这个 LTS 版本）。
- **Git**：负责下载 Marinara 并获取更新的工具。

pnpm 不用自己装。pnpm 是 Marinara 用来获取各个组成部分的包管理器，shell 启动脚本会自动装好版本正确的 pnpm。

### 在 macOS 上安装

最省事的办法是用 Homebrew，一条命令就能装好这两个工具：

```bash
brew install node git
```

如果不用 Homebrew，可以从 https://nodejs.org 下载 Node.js 安装包，再通过 Xcode 命令行工具安装 Git：

```bash
xcode-select --install
```

### 在 Linux 上安装

用所在发行版的包管理器即可。Ubuntu 和 Debian 自带的 Node.js 版本往往低于 24，先添加较新的 NodeSource 版本：

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo bash -
```

然后安装 Node.js 和 Git：

```bash
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

### 检查工具是否就绪

确认两个工具都能用。运行这条命令：

```bash
node -v
```

输出应该是 `v24` 或更高的版本号。然后运行这条命令：

```bash
git --version
```

输出应该类似 `git version 2.40` 或更高版本。如果有哪条命令报“command not found”，说明这个工具没装好。

## 用启动脚本快速开始

推荐用启动脚本 `start.sh` 来运行 Marinara。它会装好所有东西、构建应用，并在浏览器里打开。

1. 下载 Marinara。运行这条命令：

```bash
git clone https://github.com/Pasta-Devs/Marinara-Engine.git
```

2. 进入新建的文件夹。运行这条命令：

```bash
cd Marinara-Engine
```

3. 给启动脚本加上可执行权限。运行这条命令：

```bash
chmod +x start.sh
```

4. 启动 Marinara。运行这条命令：

```bash
./start.sh
```

首次运行要花几分钟，因为需要下载并构建所有内容。跑完之后，Marinara 会在浏览器里打开 http://127.0.0.1:7860。其中 7860 是默认端口，也就是这个应用在电脑上使用的那道门。

如果浏览器没有自动打开，手动打开并访问同一个地址就行。

### 启动脚本每次都会做什么

从 Git 下载的版本每次运行 `./start.sh` 时，启动脚本会：

1. 检查有没有新版本，有就先更新自己。
2. 确认 Node.js 和版本正确的 pnpm 都已就绪。
3. 补装缺失的组成部分。
4. 代码有改动时重新构建应用。
5. 准备好存放数据的本地存储。
6. 启动服务器并在浏览器里打开应用。

### 关闭自动打开浏览器

启动脚本默认会帮你打开浏览器。想关掉的话，在 Marinara 文件夹里新建一个名为 `.env` 的文件，加上这一行：

```bash
AUTO_OPEN_BROWSER=false
```

`.env` 是一个纯文本文件，用来存放设置，一行一条。一个简单的 `.env` 起步内容长这样：

```bash
PORT=7860
AUTO_OPEN_BROWSER=true
```

`PORT` 用来设置地址中的端口（默认 7860）。另外启动脚本默认允许局域网内的其他设备访问这台服务器。局域网指的是家里或办公室的那个网络。在你设置好密码或其他访问方式之前，Marinara 仍然会拦住这些设备。具体做法见[远程访问：登录与 IP 允许列表](../REMOTE_ACCESS.md)。

## 手动安装

大多数人用上面的启动脚本就够了。如果更愿意一步步自己来，就照下面的命令操作。手动安装需要 pnpm 可用。Node.js 24 自带 Corepack，Node.js 25 则没有。

1. 在 Node.js 24 上，通过 Corepack 启用 pnpm：

```bash
corepack enable pnpm
```

在 Node.js 25 或 26 上，先安装用户提供的 Corepack 包，再启用 pnpm：

```bash
npm install --global corepack
corepack enable pnpm
```

2. 下载 Marinara。运行这条命令：

```bash
git clone https://github.com/Pasta-Devs/Marinara-Engine.git
```

3. 进入这个文件夹。运行这条命令：

```bash
cd Marinara-Engine
```

4. 安装各个组成部分。运行这条命令：

```bash
pnpm install --force
```

5. 构建应用。运行这条命令：

```bash
pnpm build
```

6. 启动服务器。运行这条命令：

```bash
pnpm start
```

然后在浏览器里打开 http://127.0.0.1:7860。用 `pnpm start` 启动时，服务器默认只监听本机。所有东西都在本地运行，数据存储会在首次启动时准备好。

### Linux 上安装失败怎么办

有些 Linux 系统在安装过程中不接受过长的文件路径。如果看到包含 `ERR_PNPM_ENAMETOOLONG` 的报错，删掉装到一半的文件夹，再从启动脚本重新开始。运行这条命令：

```bash
rm -rf node_modules .pnpm .pnpm-store
```

然后运行这条命令：

```bash
./start.sh
```

## 可选的背景移除工具

Marinara 可以去掉角色立绘图片的背景。立绘是 Roleplay(角色扮演) 和 Game Mode(游戏模式) 里使用的角色图片。原生透明背景和内置的自适应蒙版清理不需要下载这个工具也能用。只有当立绘的背景是复杂布景、阴影或其他非纯色背景、需要一个兜底方案时，才安装这个额外的 AI 移除工具，因为它要下载很大的文件。

这个额外工具是一个 Python 程序。安装时会创建一个 Python venv(虚拟环境，一个专门存放 Python 包的独立文件夹)，还会下载机器学习库 PyTorch，最后下载 U2Net 模型，也就是负责在图片里找出主体的那些文件。

安装一次即可，在 Marinara 文件夹里运行这条命令：

```bash
pnpm backgroundremover:install
```

在 macOS 上，Python 3.11 版最稳妥。先用 Homebrew 装好它：

```bash
brew install python@3.11
```

然后重新运行安装命令：

```bash
pnpm backgroundremover:install
```

想让启动脚本在下次启动时自动装好这个工具，就在 `.env` 文件里加上这一行：

```bash
BACKGROUNDREMOVER_AUTO_INSTALL=true
```

## 更新

从 Git 下载的版本用 `./start.sh` 启动 Marinara 时，启动脚本会检查有没有新版本，并在启动前自动更新。聊天、角色和设置都会保留。

运行 `./start.sh --skip-update` 可以跳过一次检查。想让已安装的 Engine 版本在多次启动之间保持不变，就在 `.env` 里加上 `AUTO_UPDATE_ENABLED=false`。之后仍然可以从 **Settings → Advanced → Updates** 或用 Git 命令手动检查和更新。

也可以在应用内检查。打开 **Settings**(设置)，切到 **Advanced**(高级) 选项卡，找到 **Updates**(更新) 这一节。点击 **Check for Updates**(检查更新) 看看有没有新版本。**Apply Update**(应用更新) 按钮默认是关闭的。想开启它，需要设置几个服务器选项，然后在 **Settings**、**Advanced**、**Admin Access**(管理员访问) 下保存一个管理员密钥。不开启也没关系，用 `./start.sh` 重新启动一次就能更新。

完整的更新步骤，包括如何先做备份、如何切换发布通道，见下方链接的升级指南。

## 关键术语

- **pnpm**：Marinara 用来下载和管理各个组成部分的包管理器。
- **Corepack**：Node.js 自带的辅助工具，用来启用 pnpm。
- **LAN**：局域网，家里或办公室里的那个私有网络。
- **.env**：Marinara 文件夹里的纯文本设置文件，一行一条设置。
- **venv**：Python 虚拟环境，一个专门存放 Python 包的独立文件夹。
- **PyTorch**：可选的背景移除工具用到的机器学习库。
- **U2Net**：背景移除工具用来在图片里找出主体的模型文件。

## 相关指南

- [Marinara Engine 安装](../INSTALLATION.md)：为自己的设备挑选合适的安装方式。
- [升级 Marinara Engine](../UPGRADING.md)：适用于所有平台的完整更新和备份步骤。
- [远程访问：登录与 IP 允许列表](../REMOTE_ACCESS.md)：设置密码，让其他设备也能访问 Marinara。
- [Marinara Engine 故障排查](../TROUBLESHOOTING.md)：安装和启动问题的解决办法。
