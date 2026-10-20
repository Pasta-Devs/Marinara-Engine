# 通过容器运行（Docker / Podman）

本指南介绍如何用 Docker 或 Podman 在容器里运行 Marinara Engine。容器是一个自成一体的软件包，里面装好了应用本身以及它运行所需的一切。不用在电脑上另外安装 Node.js 或别的工具。新手只想先把 Marinara 跑起来的话，这是最省事的一条路。

## 准备工作

开始之前，在准备运行 Marinara 的那台机器上装好下面其中一个：

- Docker Desktop(Windows 或 macOS) 或 Docker Engine(Linux)。Docker 是最常见的容器工具。
- 或者 Podman。Podman 可以直接替代 Docker，不需要后台服务，也不需要 root 权限就能用得很好。

下面会用到几个词：

- **镜像**：一个可下载的只读模板，里面包含 Marinara Engine。运行镜像就会创建出一个正在运行的容器。
- **卷**：由容器工具替你管理的一块存储区域。有了卷，即使删掉容器再重建，数据也还在。
- **LAN**：局域网，也就是家里或办公室的 Wi-Fi 或有线网络。

Marinara 的官方镜像发布在 `ghcr.io/pasta-devs/marinara-engine`。

## 拉取并运行

仓库根目录里自带一个开箱即用的 `docker-compose.yml` 文件。Compose 会读这个文件并替你启动容器，这也是运行 Marinara 的推荐方式。

1. 先拿到仓库的一份副本。如果本地已经有 Marinara Engine 的代码，在那个文件夹里打开终端即可。如果没有，先克隆：

```bash
git clone https://github.com/Pasta-Devs/Marinara-Engine.git
```

2. 进入该文件夹：

```bash
cd Marinara-Engine
```

3. 在后台启动容器：

```bash
docker compose up -d
```

`docker-compose.yml` 使用 `ghcr.io/pasta-devs/marinara-engine:latest` 镜像，第一次执行这条命令时会自动下载。首次下载可能要花几分钟。

## 确认是否正常运行

1. 打开浏览器。
2. 访问这个地址：

```text
http://127.0.0.1:7860
```

看到 Marinara Engine 的主页，就说明容器已经跑起来了。地址里的 `127.0.0.1` 表示“本机自己”，`7860` 则是 Marinara 默认监听的端口。

页面打不开的话，看下面的故障排查一节。

## 数据保存在哪里

聊天、角色、上传的文件、字体和默认背景等数据，都以普通文件的形式保存。Marinara 采用基于文件的存储，也就是说，数据是一个个正常的文件，而不是塞在单个数据库文件里。Compose 把这些文件放在名为 `marinara-data` 的命名卷中。

Compose 会在卷名前面加上项目文件夹名，所以实际卷名是 `PROJECT_marinara-data` 这种形式。想知道本机上的确切名字，列一下卷：

```bash
docker volume ls --filter name=marinara-data
```

然后查看列表里的那个卷，看看它存在什么位置：

```bash
docker volume inspect PROJECT_marinara-data
```

把 `PROJECT_marinara-data` 换成上一条命令打印出来的名字。

容器每次启动都会先准备好数据文件夹。默认情况下容器以 root 身份启动，先把文件夹的属主修正到应用可以写入，再切换成非 root 用户以保证安全。命名卷和你从宿主机挂载进来的文件夹都适用这套修复。所以旧的部署迁移到基于文件的存储时，不用手动执行任何改属主的命令。

首次启动时，Marinara 还会在卷里的 `/app/data/.env` 创建一个空的设置文件，之后可以在这里添加服务器设置。它就存在卷里，所以重启容器、更新镜像都不会丢。完整的设置清单见[服务器配置参考](../CONFIGURATION.md)。

## 把 Marinara 开放给局域网

默认情况下，Compose 只允许从同一台电脑访问 Marinara，这是安全的默认值。想在手机或网络里的另一台电脑上打开 Marinara，就得做两件事：改端口映射，并开启登录验证，免得陌生人也能连进来。

Basic Auth 就是一个简单的用户名加密码提示框，用来保护应用。把 Marinara 开放到网络上时，绝对不要不开它。

1. 用文本编辑器打开 `docker-compose.yml`。

2. 找到端口那一行，长这样：

```yaml
ports:
  - "127.0.0.1:${PORT:-7860}:7860"
```

3. 去掉 `127.0.0.1:` 这一段，其他设备就能访问了：

```yaml
ports:
  - "${PORT:-7860}:7860"
```

4. 在同一个文件里，往 `environment:` 列表中加上登录信息和管理员密钥。值要换成自己的：

```yaml
environment:
  - BASIC_AUTH_USER=yourname
  - BASIC_AUTH_PASS=a-long-random-password
  - ADMIN_SECRET=another-long-random-value
```

5. 保存文件并重启容器：

```bash
docker compose up -d
```

这样，在没有设置 `PORT` 时，网络里的其他设备就能通过 `http://YOUR_COMPUTER_IP:7860` 访问 Marinara。如果设置了 `PORT`，把 `7860` 换成对应的宿主机端口。他们必须输入你设定的用户名和密码。

在 Docker Desktop、OrbStack 和 rootless Docker 上，每台设备都从同一个地址访问容器，包括你自己的浏览器。所以一旦设置了登录，这台电脑也会要求登录，IP 允许列表也无法区分不同的设备。没有设置登录时，千万不要去掉 `127.0.0.1:`：在这些运行环境上，Marinara 分不清其他设备和这台电脑。想知道怎么把访问限制在特定设备上，以及管理员密钥的作用，读[远程访问：Basic Auth 与 IP 允许列表](../REMOTE_ACCESS.md)。

## 选哪个镜像：latest、staging 还是 lite

Marinara 发布了好几个镜像标签，按需要挑一个。

- `latest` 是推荐使用的稳定版，`docker-compose.yml` 默认用的就是它。
- `X.Y.Z` 是固定版本，比如 `ghcr.io/pasta-devs/marinara-engine:2.0.6`。想锁死在某个确切版本时用它。
- `staging` 是用最新开发代码构建的不稳定测试版，只在想尝鲜未发布的改动时用。它可能出问题，可能悄悄改变行为而没有说明，数据也可能没法再迁回稳定版。
- `lite` 是体积更小的镜像，下一节专门讲。

如果要跑 `staging` 镜像，请单独用一个卷，免得不稳定的版本动到稳定版的数据：

```bash
docker run -d --name marinara-staging -p 127.0.0.1:7860:7860 -v marinara-staging-data:/app/data ghcr.io/pasta-devs/marinara-engine:staging
```

### lite 镜像

lite 镜像是一个精简版本，牺牲部分离线功能，换来小得多的下载体积。它基于 Wolfi 构建，那是一个专为容器打造的极简 Linux 底座。

lite 镜像去掉了需要大体积本地文件的那些功能：

| lite 中已移除 | 失去什么 |
| --- | --- |
| 本地模型（Gemma，在本机运行） | 无法在自己的硬件上运行 AI 模型。 |
| 本地嵌入模型 | 没有本地的文本嵌入。 |
| Memory Recall(记忆功能) | 依赖本地嵌入模型。 |
| 本地 Whisper 语音输入 | Conversation 通话的语音识别功能不在了。 |
| 虚拟形象情绪识别 | 2D 和 3D 虚拟形象改为根据词表挑选表情，而不是使用小型本地情绪模型。 |

其余一切照旧：聊天、角色扮演、Game Mode、智能体、世界书、角色，以及连接远程 AI 服务商。用 lite 镜像时，想使用任何 AI 功能都必须接一个外部服务商（比如 OpenRouter、OpenAI，或自己搭的模型）。见[连接 AI 服务商](../connections/connecting-to-a-provider.md)。

lite 的标签是 `ghcr.io/pasta-devs/marinara-engine:lite`，每个版本另外还会发布一个锁定版本号的 lite 标签，形如 `ghcr.io/pasta-devs/marinara-engine:X.Y.Z-lite`。运行方式：

```bash
docker run -d --name marinara-lite -p 127.0.0.1:7860:7860 -v marinara-data:/app/data ghcr.io/pasta-devs/marinara-engine:lite
```

早期的一些 lite 镜像在 Raspberry Pi 4 及类似的 ARM 电脑上可能崩溃。崩溃时会在向 AI 服务商发起请求的过程中报 `SIGILL` 错误（处理器抛出的非法指令错误）。用这类设备的话，改用常规的 `latest` 镜像。最新情况见 [Marinara Engine 故障排查](../TROUBLESHOOTING.md)。

## 更新

容器镜像不会自己更新，需要手动拉取新镜像并重启容器。先做一次备份，这样就能原样回到之前的状态。参见[备份与恢复 Marinara](../data/backup-and-restore.md)。

用 Docker Compose 的话，执行这一条命令：

```bash
docker compose pull && docker compose up -d
```

用 Podman Compose 的话，执行这一条命令：

```bash
podman compose pull && podman compose up -d
```

也可以在应用里查看版本。打开 **Settings**(设置)，切到 **Advanced**(高级) 选项卡，找到 **Updates**(更新) 一节，点击 **Check for Updates**(检查更新)。对于容器安装，Marinara 会识别出自己跑在 Docker 里，显示发布版镜像标签和需要在宿主机上执行的命令。它没法从浏览器里直接完成更新，所以还是要在宿主机上跑上面那条命令。

要回到较早的发布版本，在 `docker-compose.yml` 的 `image:` 一行里写上它的版本标签，例如 `ghcr.io/pasta-devs/marinara-engine:2.5.0`，然后运行 `docker compose up -d`。回到 2.5.0 是可以的，你的聊天也能正常打开，但 2.5.0 不认识新功能添加的设置和游戏数据。2.5.0 保存的任何聊天或连接都会丢失这些数据，再次更新也找不回来。参见[回到 2.5.0](../UPGRADING.md#going-back-to-250)。

## Podman

Podman 跑的是和 Docker 一样的镜像。多数情况下，把上面命令里的 `docker` 换成 `podman` 就行。

用 Compose 启动：

```bash
podman compose up -d
```

不用 Compose，单独跑一个容器：

```bash
podman run -d -p 127.0.0.1:7860:7860 -v marinara-data:/app/data ghcr.io/pasta-devs/marinara-engine:latest
```

`podman compose` 命令需要 `podman-compose` 这个辅助工具，用适合自己系统的命令安装。

Fedora 上：

```bash
sudo dnf install podman-compose
```

Debian 或 Ubuntu 上：

```bash
sudo apt install podman-compose
```

用 pip：

```bash
pip install podman-compose
```

## 自己构建镜像

比起直接下载，更想从源码构建镜像的话：

```bash
docker build -t marinara-engine .
```

然后运行自己构建的版本：

```bash
docker run -d -p 127.0.0.1:7860:7860 -v marinara-data:/app/data marinara-engine
```

想从源码构建 lite 镜像，把 Docker 指向 lite 的构建文件：

```bash
docker build -f Dockerfile.lite -t marinara-engine:lite .
```

## 故障排查

**页面打不开，或者提示端口已被占用。** 可能有别的程序已经占用了 `7860` 端口。把端口映射改到一个空闲端口，比如在 `ports:` 列表里写成 `8080:7860`，然后用 `docker compose up -d` 重启，再打开 `http://127.0.0.1:8080`。

**Marinara 写不了文件，或者出现权限错误。** 容器每次启动都会修复数据文件夹的属主，命名卷和从宿主机挂载的文件夹都适用。在某些宿主机文件系统上这一步可能失败；设置了 `MARINARA_SKIP_DATA_CHOWN=true` 时也会跳过。错误一直不消失的话，改用默认的 `marinara-data` 命名卷，那是最稳妥的选择。

**lite 镜像在 Raspberry Pi 4 上崩溃。** 见上面关于 lite 镜像的说明。这类硬件上请改用常规的 `latest` 镜像。

需要更多帮助，读 [Marinara Engine 故障排查](../TROUBLESHOOTING.md)。

## 相关指南

- [服务器配置参考](../CONFIGURATION.md)
- [远程访问：Basic Auth 与 IP 允许列表](../REMOTE_ACCESS.md)
- [Marinara Engine 故障排查](../TROUBLESHOOTING.md)
