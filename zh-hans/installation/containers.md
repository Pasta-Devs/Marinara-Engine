# 通过容器运行（Docker / Podman）

用 Docker 或 Podman 在容器里运行 Marinara Engine。容器是一个装好了应用本身和它所需一切的软件包，所以不用安装 Node.js。想用最少的设置把 Marinara 跑起来，就从这里开始。

## 准备工作

在准备运行 Marinara 的电脑上装好下面其中一个：

- Docker Desktop(Windows 或 macOS) 或 Docker Engine(Linux)。
- Podman，一个可以替代 Docker 的工具，不需要后台服务，也不需要 root 权限就能用。

下面会用到几个词：

- **镜像：** 一份可下载的只读 Marinara 副本。运行镜像就会创建出一个容器。
- **卷：** 由容器工具管理的存储。删掉容器再重建时，数据仍保留在卷里。

Marinara 的官方镜像在 `ghcr.io/pasta-devs/marinara-engine`。

<a id="start-marinara"></a>

## 启动 Marinara

项目里自带一个开箱即用的 `docker-compose.yml` 文件。Compose 是 Docker 中负责读取这个文件并启动容器的部分。这是推荐的方式。

1. 打开终端，也就是输入命令的窗口。如果你已经有一份 Marinara 仓库，就在那个文件夹里打开终端，并跳过接下来的两步。
2. 下载项目文件。

   ```bash
   git clone https://github.com/Pasta-Devs/Marinara-Engine.git
   ```

3. 进入新建的文件夹。

   ```bash
   cd Marinara-Engine
   ```

4. 在后台启动容器。

   ```bash
   docker compose up -d
   ```

   第一次运行会下载 `ghcr.io/pasta-devs/marinara-engine:latest` 镜像，可能要花几分钟。完成后，终端会显示容器状态为 `Started`。

5. 在浏览器里打开 `http://127.0.0.1:7860`。Marinara 的主页会加载出来。

如果没有成功：可能有别的程序占用了 `7860` 端口。选一个空闲端口，比如 `8080`。在 `docker-compose.yml` 所在的文件夹里新建一个名为 `.env` 的文件，写入一行 `PORT=8080`，然后再运行一次 `docker compose up -d`。Compose 每次都会读取这个文件，所以之后更新时也会沿用新端口。然后打开 `http://127.0.0.1:8080`。其他解决办法见[故障排查](#troubleshooting)。

## 停止 Marinara

在同一个文件夹里运行下面的命令。它会停止并移除容器，数据仍保留在卷里。

```bash
docker compose down
```

用 Podman 时，运行 `podman compose down`。

## 数据保存在哪里

Marinara 把聊天、角色、上传的文件、字体和默认背景以普通文件的形式，保存在名为 `marinara-data` 的 Compose 卷里。Compose 会在前面加上项目文件夹名，所以实际名字是 `PROJECT_marinara-data` 这种形式。想查到确切名字和存放位置：

```bash
docker volume ls --filter name=marinara-data
docker volume inspect PROJECT_marinara-data
```

把 `PROJECT_marinara-data` 换成第一条命令打印出来的名字。

首次启动时，Marinara 还会在卷里的 `/app/data/.env` 创建一个空的设置文件。服务器设置就加在这里，重启容器和更新镜像都不会丢。见[服务器配置参考](../CONFIGURATION.md)。

容器每次启动都会修正数据文件夹的属主，让应用可以写入。它先以 root 身份启动，修正属主，再切换成非 root 用户。卷和你从电脑上挂载进来的文件夹都适用。

<a id="open-marinara-from-another-device"></a>

## 从另一台设备打开 Marinara

默认情况下，Compose 只允许这台电脑访问 Marinara。想在手机或另一台电脑上打开它，要把端口发布到所有接口上，并且先设置登录。绝对不要在没有登录的情况下把 Marinara 暴露到网络上。

Docker Desktop、OrbStack 和 rootless Docker(不用 root 运行的 Docker) 会把每台设备都显示为同一个网关地址。没有登录时，发布到所有接口上的端口会让所有人都进来。一旦设置了登录，这台电脑也会被要求登录。见 [Tailscale 与 Docker 放行](../REMOTE_ACCESS.md#tailscale-and-docker-bypass)。

1. 用文本编辑器打开 Marinara 文件夹里的 `docker-compose.yml`。
2. 在 `ports:` 列表里，去掉 `127.0.0.1:`。

   ```yaml
   ports:
     - "${PORT:-7860}:7860"
   ```

3. 在 `environment:` 列表里加上管理员密钥。换成你自己的一串长随机值。

   ```yaml
   environment:
     - ADMIN_SECRET=another-long-random-value
   ```

4. 在同一个列表里加上登录信息。换成你自己的用户名和一个长随机密码。

   ```yaml
   - BASIC_AUTH_USER=your-username
   - BASIC_AUTH_PASS=another-long-random-password
   ```

5. 保存文件并重启容器。

   ```bash
   docker compose up -d
   ```

6. 在另一台设备上打开 `http://YOUR_COMPUTER_IP:7860`。如果设置了 `PORT`，就换成那个端口。页面会要求你登录。

如果没有设置 `BASIC_AUTH_USER` 和 `BASIC_AUTH_PASS`，页面会改为要求输入一次性设置码。从日志里找到它，然后在页面上输入，再填一个新的用户名和密码。

```bash
docker logs <container> 2>&1 | grep "setup code"
```

之后可以在已登录的浏览器里，到 **Settings → Advanced → Access**(设置 → 高级 → 访问) 修改应用登录。如果忘了密码，运行 `docker exec <container> node scripts/reset-login.mjs`。这条命令不会改动由 `BASIC_AUTH_USER` 和 `BASIC_AUTH_PASS` 设置的登录；要改它们，请编辑 compose 文件并重新创建容器。

在 Docker Desktop、OrbStack 和 rootless Docker 上，用 `http://localhost:7860` 在这台电脑上打开 Marinara，到 **Settings**(设置) 里设置登录。在这些环境上，IP 允许列表区分不了不同的设备，所以请用登录。想了解其他限制访问的方法，以及管理员密钥的作用，读[远程访问：登录与 IP 允许列表](../REMOTE_ACCESS.md)。

## 更新 Marinara

容器不会自己更新。先做一次备份（见[备份与恢复 Marinara](../data/backup-and-restore.md)），然后拉取新镜像并重启。在存放 `docker-compose.yml` 的文件夹里运行：

```bash
docker compose pull && docker compose up -d
```

用 Podman 时改用 `podman compose`。在应用里，**Settings → Advanced → Updates → Check for Updates**(设置 → 高级 → 更新 → 检查更新) 会显示镜像标签和这条命令。对于容器，应用没法自己应用更新。

要回到较早的发布版本，在 `docker-compose.yml` 的 `image:` 一行写上它的标签，然后运行 `docker compose up -d`。在这之前先读[回到旧版本](../UPGRADING.md#downgrading-to-an-older-version)。旧构建打不开新构建保存的数据。

## 选择镜像标签

| 标签 | 说明 |
| --- | --- |
| `latest` | 稳定版。`docker-compose.yml` 用的就是它。 |
| `X.Y.Z` | 一个固定版本，比如 `ghcr.io/pasta-devs/marinara-engine:2.5.1`。 |
| `staging` | 用尚未发布的代码构建的不稳定测试版。它可能出问题，数据也可能没法再迁回稳定版。 |
| `lite` | 体积更小的镜像。见下文。 |
| `X.Y.Z-lite` | lite 镜像的固定版本。 |

如果要跑 `staging`，请单独用一个卷，免得它改动稳定版的数据：

```bash
docker run -d --name marinara-staging \
  -p 127.0.0.1:7860:7860 \
  -v marinara-staging-data:/app/data \
  ghcr.io/pasta-devs/marinara-engine:staging
```

### lite 镜像

lite 镜像的下载体积更小，它基于 Wolfi 构建，那是一个为容器打造的极简 Linux 底座。它去掉了需要大体积本地文件的功能：

| lite 中已移除 | 失去什么 |
| --- | --- |
| 内置模型 | 无法在自己的硬件上运行 AI 模型。 |
| 本地嵌入模型 | 没有本地的文本嵌入。 |
| Memory Recall(记忆功能，即语义搜索) | 它依赖本地嵌入模型。 |
| 本地 Whisper 语音输入 | Conversation 通话没有语音转文字。 |
| 虚拟形象情绪识别 | 2D 和 3D 虚拟形象改为根据词表挑选表情，而不是使用小型本地情绪模型。 |

其余功能都照常可用：聊天、角色扮演、Game Mode、智能体、世界书、角色和远程 AI 服务。想使用 AI 功能，必须为外部服务添加一个账号。见[连接 AI 服务商](../connections/connecting-to-a-provider.md)。

```bash
docker run -d --name marinara-lite \
  -p 127.0.0.1:7860:7860 \
  -v marinara-data:/app/data \
  ghcr.io/pasta-devs/marinara-engine:lite
```

一些较早的 lite 镜像在 Raspberry Pi 4 及类似的 ARM 电脑上，会在向外发起 AI 请求时因 `SIGILL` 错误（非法指令错误）而崩溃。在这些设备上，请改用常规的 `latest` 镜像。最新情况见 [Marinara Engine 故障排查](../TROUBLESHOOTING.md)。

## Podman

Podman 跑的是同样的镜像。在大多数命令里，把 `docker` 换成 `podman` 就行。

```bash
podman compose up -d
```

不用 Compose，单独运行一个容器：

```bash
podman run -d \
  -p 127.0.0.1:7860:7860 \
  -v marinara-data:/app/data \
  ghcr.io/pasta-devs/marinara-engine:latest
```

`podman compose` 需要 `podman-compose` 这个辅助工具。用下面其中一条命令安装：

```bash
sudo dnf install podman-compose
sudo apt install podman-compose
pip install podman-compose
```

第一条适用于 Fedora，第二条适用于 Debian 或 Ubuntu，第三条在任何装了 pip 的系统上都能用。

## 自己构建镜像

想从源码构建，而不是直接下载：

```bash
docker build -t marinara-engine .
docker run -d -p 127.0.0.1:7860:7860 -v marinara-data:/app/data marinara-engine
```

要构建 lite 镜像，就使用 lite 的构建文件：

```bash
docker build -f Dockerfile.lite -t marinara-engine:lite .
```

<a id="troubleshooting"></a>

## 故障排查

**页面打不开，或者提示端口已被占用。** 见[启动 Marinara](#start-marinara) 下面的端口解决办法。

**Marinara 写不了文件，或者出现权限错误。** 容器每次启动都会修正文件夹的属主。在某些宿主机文件系统上这一步可能失败；设置了 `MARINARA_SKIP_DATA_CHOWN=true` 时也会跳过。错误一直不消失的话，改用默认的 `marinara-data` 卷，它最可靠。

**lite 镜像在 Raspberry Pi 4 上崩溃。** 改用常规的 `latest` 镜像。

需要更多帮助，读 [Marinara Engine 故障排查](../TROUBLESHOOTING.md)。

## 相关指南

- [服务器配置参考](../CONFIGURATION.md)
- [远程访问：登录与 IP 允许列表](../REMOTE_ACCESS.md)
- [Marinara Engine 故障排查](../TROUBLESHOOTING.md)
