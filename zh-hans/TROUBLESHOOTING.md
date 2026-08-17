# Marinara Engine 故障排查

本指南汇总 Marinara Engine 的常见问题和对应的解决办法。先找到和自己症状相符的小节，再按步骤操作。如果都不管用，看最后一节“获取更多帮助”。

## 先试这两步

不少问题两步就能解决。

1. 强制刷新页面。Windows 和 Linux 按 **Ctrl+Shift+R**，Mac 按 **Cmd+Shift+R**。
2. 看服务器控制台（运行 Marinara 的那个终端窗口）里有没有红色报错行。这些行通常直接点明真正的问题。

要向团队求助的话，先打开 **Debug mode**(调试模式)，让服务器把提示词（Marinara Engine 发给 AI 的那段文字）和回复都记进日志。见本指南结尾的“获取更多帮助”。

## 安装和启动问题

### Windows：安装 pnpm 时出现 EPERM 或 corepack 签名错误

pnpm 是 Marinara 用来安装自身代码的包管理器。如果看到 `EPERM: operation not permitted` 或者 corepack 签名校验失败，说明 corepack 写不进 Node 的安装文件夹。

任选一种办法：

1. 右键点击终端，选择“以管理员身份运行”，然后重新运行启动脚本。
2. 自己安装 pnpm。运行下面这条命令，再重新运行启动脚本：

```bash
npm install -g pnpm
```

3. 在管理员终端里更新 corepack，然后重新运行启动脚本：

```bash
npm install -g corepack
```

### Windows：构建 shared 包时提示 `'pnpm' is not recognized`

Marinara v2.3.0 能通过 Corepack 正常启动 pnpm，却会在构建 shared 包时失败，原因是这一步又去调用了第二个全局 `pnpm` 可执行文件。v2.3.1 去掉了这层嵌套依赖。关掉失败的启动脚本，重新运行 `start.bat`，它会先拉取修正后的构建脚本再重新构建。数据不用删。

如果仓库本身没法更新，在 Marinara 文件夹里运行 `git pull` 再启动。在 v2.3.0 上还可以临时这样绕过：全局安装指定版本的包管理器，重新运行启动脚本，然后照常更新：

```bash
npm install -g pnpm@10.33.2
```

### Linux：安装过程中出现 ERR_PNPM_ENAMETOOLONG

这说明上一次旧的安装留下了过长的文件夹路径。在 Marinara 文件夹里清掉没装完的内容，再重新运行启动脚本：

```bash
rm -rf node_modules .pnpm .pnpm-store
```

然后用 `./start.sh` 重新启动 Marinara。如果是手动安装，删完这些文件夹后运行 `pnpm install`。

### 安装过程中出现 ERR_PNPM_TRUST_DOWNGRADE

这几乎都是安装装到一半没完成。先重新运行启动脚本，让它修复工作区。如果是手动安装，在 Marinara 文件夹里运行这一条命令：

```bash
pnpm --config.trustPolicy=off --config.confirmModulesPurge=false install --frozen-lockfile
```

## 白屏、内容不刷新、界面像旧版

有时候服务器明明在跑，浏览器却是一片空白；或者更新之后应用看起来还是老版本。这种情况是浏览器还留着网页应用的缓存副本。

1. 强制刷新（**Ctrl+Shift+R** 或 **Cmd+Shift+R**）。
2. 还不行的话，打开 **Settings**(设置)，切到 **Advanced**(高级) 选项卡，找到 **Updates**(更新) 一节，点击 **Refresh App**(刷新应用)。

**Refresh App** 会清掉浏览器的 service worker(在后台缓存网页应用的脚本) 和浏览器缓存，然后重新加载。数据不受影响，聊天、设置和其他本地数据都会原样保留。它也不会更新服务器代码，所以不能代替真正的更新。要更新应用本身，见[升级 Marinara Engine](UPGRADING.md)。

## 可下载智能体的问题

如果 **Agents → Download Agents**(下载智能体) 提示目录不可用，说明运行 Marinara 服务器的那台机器（不只是浏览器）必须能通过 GitHub HTTPS 访问官方的 [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) 目录。已经装好的智能体在离线状态下仍按当前版本正常工作。恢复服务器的网络连接后，点击 **Refresh** 或 **Try again** 就能浏览目录并检查更新。

如果装好的地图或通话没有出现，把 Marinara Engine 完全关掉再启动。这类带路由的包会一直处于 **Restart required** 状态，直到进程下一次启动。Conversation 游戏则不一样：当前版本的 Engine 会立即热激活它们。安装失败就刷新目录，然后确认游戏显示为就绪状态；只有想让角色自己发起游戏时，才需要在聊天的 **Commands**(命令) 设置里添加它，手动用斜杠命令并不需要。

如果旧版安装完成不了首次包迁移，先别删 `data/capability-packages` 文件夹和聊天数据。Marinara 会保留未完成的迁移状态，下次启动时重试。目录访问不通的期间，已有的聊天选择和设置都会保留。

只要包的校验和、声明的文件列表、Engine 版本范围或压缩包内路径与官方目录对不上，下载就会被拒绝。先更新 Marinara Engine，刷新目录，再重试。不要手动把产物解压进数据目录。

智能体更新绝不会在启动时自动应用。有更新的兼容版本时，Marinara 会先问要不要应用。选 **No** 就保持已安装的版本，**Update** 按钮会一直留在 **Agents → Download Agents** 里。更新失败同样会保留已注册的已安装版本；如果新更新的服务器运行时启动自检没通过，会自动回滚到上一个版本。

## 从其他设备访问 Marinara

如果手机、平板或局域网里的另一台电脑访问不了 Marinara，按下面几条逐项排查。

- 让服务器监听一个能被访问到的地址。默认情况下服务器只监听 `127.0.0.1`(环回地址，仅限本机)。shell 启动脚本会自动设置 `HOST=0.0.0.0`。如果是手动用 `pnpm start` 启动的，先在 `.env` 文件里设置 `HOST=0.0.0.0`。
- 确认两台设备连的是同一个 Wi-Fi 网络。
- 确认没有防火墙拦端口。默认端口是 `7860`，或者你在 `PORT` 里设置的值。
- 配好访问控制。面向普通网络或公网的客户端，在 `.env` 里设置 `BASIC_AUTH_USER` 和 `BASIC_AUTH_PASS`。环回访问仍然免密码。经 Tailscale 的直连流量、同主机的 Docker 网桥或识别到的容器网关默认受信任；经代理转发的 Docker 流量则需要正常授权，除非显式设置 `REQUIRE_AUTH_FOR_DOCKER_PROXY=false`。
- 要在那台设备上执行特权操作（备份、清除数据、更新），在服务器的 `.env` 里设置 `ADMIN_SECRET`。然后把同一个值粘贴到那台设备的 **Settings** > **Advanced** > **Admin Access**(管理员访问) 里，点击 **Save**(保存)。
- 如果用的是公网域名或反向代理域名，并且看到 **Untrusted request host**，把它准确的主机名加进 `.env` 的 `TRUSTED_HOSTS`。手机、局域网电脑和 Tailscale 节点使用的直连 IP 地址仍然会自动放行。

完整操作流程见[远程访问](REMOTE_ACCESS.md)和[常见问题](FAQ.md)。

## 保存被拦截，或设置存不住

如果保存看着成功了，重新加载后又变回原样，说明 Marinara 的跨站保护把它拦下了。CSRF(跨站请求伪造) 保护专门看守会改动数据的操作，只信任特定的浏览器来源。

会看到下面一种或两种迹象：

- 屏幕顶部出现红色横幅，提示当前来源不受信任，保存会静默失败。
- 出现标题为 **Save blocked: missing CSRF header**、**Save blocked: cross-site request rejected** 或 **Save blocked: origin not trusted** 的提示。

环回地址、私有网络地址、Tailscale 和 Docker 网桥都自动受信任。所以这种情况基本只在通过公网 IP 地址或域名访问 Marinara 时才出现。把那个地址加进 `.env` 的 `CSRF_TRUSTED_ORIGINS`。多个地址用逗号分隔，例如：

```bash
CSRF_TRUSTED_ORIGINS=http://203.0.113.10:7831,https://chat.example.com
```

不需要重启。横幅上有一个 Copy 按钮，会直接帮你填好这一整行。更多内容见[远程访问](REMOTE_ACCESS.md)。

## 连接和生成报错

生成失败会在屏幕底部弹出提示。连接出问题时，提示里会写明原因。提示停留的时间够看完也够复制。

- **No API connection configured for this chat**：这个聊天没有选连接。打开 **Connections**(连接) 面板，新建一个，然后给聊天选上。见[连接 AI 服务商](connections/connecting-to-a-provider.md)。API 密钥是服务商给的一串秘密字符，Marinara 靠它才能调用对方的模型。
- 模型不接受某个参数：提示里会写明是哪一个。打开 **Chat Settings**(聊天设置) > **Advanced Parameters**(高级参数)，找到那个参数，关掉它名字旁边的开关（悬停提示写的是“This parameter is sent to the model”）。
- 模型要求必须提供某个参数：同样的做法，但要把那个参数旁边的开关打开。
- **The AI returned an empty response. Try sending your message again.**：把消息重新发一次。如果一直这样，换个模型或换个连接试试。
- **A generation is already in progress for this chat**：还有一条回复正在流式输出。等它结束，或者点 Stop 按钮，然后再试。
- **No connections are marked for the random pool**：开启了随机连接路由，却没有把任何连接标进随机池。至少往池里加一个连接，或者把随机路由关掉。

## Local Model 相关问题

**Local Model**(本地模型) 是跑在自己机器上的 AI 模型，不需要 API 密钥。有些报错信息里把这个功能称作 sidecar。

- 安装运行时失败并提示 **Sidecar runtime install is disabled**，说明服务器出于安全考虑关闭了这个操作。在自己机器上，在 `.env` 里设置 `SIDECAR_RUNTIME_INSTALL_ENABLED=true`。从其他设备操作时，先把管理员密钥粘贴到 **Settings** > **Advanced** > **Admin Access**。
- 从其他设备（网络地址或 Docker）下载模型或做初始配置失败时，同样可能需要管理员密钥。在自己机器上则不需要。密钥粘贴到哪里见上一条。
- 如果内置的 llama.cpp、MLX、uv 或 MLX 依赖锁校验报告文件大小或 SHA-256 不匹配，说明 Marinara 已经在解压或安装之前把它丢弃或拒绝了。更新或重装 Marinara 后重试，不要手动运行、解包、修改或绕过被拒绝的产物。

### 维护者：更新固定版本的本地运行时

GitHub 自动生成的源码压缩包并不保证逐字节稳定，哪怕提交内容没有变化。绝不要拿用户机器上看到的字节当作正确值来“修复”不匹配，也不要削弱校验。重新固定运行时输入只能通过一次经过评审的 Engine 改动完成：

1. 选定一个不可变的上游修订版本或发布产物，并审阅上游改动。
2. 把产物下载到临时目录，记录准确的字节数，并独立计算它的 SHA-256 摘要。
3. 用新的修订版本、URL、大小和摘要更新 `runtime-integrity-manifest.ts`。MLX 部分要在 Apple Silicon/Python 3.12 上用固定版本的 uv，从 `.in` 文件重新生成 `packages/server/src/assets/mlx-runtime-requirements.lock`，逐条审阅依赖变化，并更新 `requirementsLockSha256`。
4. 运行 `pnpm regression:runtime-integrity`、`pnpm check`，并在受影响的平台上真实执行一次全新的运行时安装。
5. 先发布经过评审的 Engine 更新，再让用户重试。不要提供手动跳过校验和的开关。

完整的配置流程见[本地模型设置](connections/local-model.md)。

## 记忆和摘要

### Memory Recall 什么都想不起来

**Memory Recall**(记忆功能) 会检索早先的消息，把最相关的几条悄悄加回提示词里。如果它好像什么都没记住，检查下面几点。

1. 打开 **Chat Settings** > **Memory Recall**，确认 **Enable Memory Recall** 是开着的。
2. 打开 **Access memories for this chat**。在 **Memories for This Chat** 窗口里逐块查看状态。
3. 状态是 **Waiting for vector** 表示这条记忆还在处理。等一会儿再继续聊。
4. 状态是 **Embedding unavailable** 表示没有可用的嵌入来源。配置一个嵌入连接，或者等内置的本地模型加载完成。见[本地模型设置](connections/local-model.md)。

一条记忆需要积累至少 5 条新消息才会生成。而且召回只会给出和新消息高度相关的记忆，所以即使记忆存在，也可能什么都不返回。

### 摘要生成不出来

写聊天摘要需要一个能正常工作的文本连接。

- 在 Roleplay 模式下，打开 **Chat Summary**(聊天摘要) 浮层，确认已经设好连接。老聊天可以用 **Backfill Summary** 补齐。
- 在 Conversation 模式下，打开 **Automatic Summarization**，用 **Backfill** 重试失败的日期。
- 如果这个聊天要求智能体写入前先经审批，AI 生成的摘要会等你确认后才生效。
- 一直失败的摘要（比如 API 密钥有问题）会延迟重试。修好连接，然后用 **Backfill**。

## Card Browser 相关问题

**Card Browser**(角色卡浏览器) 可以搜索公开的角色卡站点并导入角色。从顶栏的 **Card Browser** 图标打开，然后点击 **Download Cards**。

- 如果 JannyAI 搜索或某个角色页面被 Cloudflare 拦截，Marinara 会给出提示，让你用同一个浏览器访问一次 JannyAI 站点以通过验证，然后重试。
- 如果重启服务器后 CharacterTavern 或 Pygmalion 的登录失效了，这是正常现象。这类登录信息只存在服务器内存里，重启就清空。打开登录窗口，重新粘贴 cookie 或 Token。

## 媒体生成问题

### 立绘抠背景在复杂场景下效果不好

生成的静态立绘一般使用原生透明通道，或者自适应的纯色蒙版底色。内置的清理流程还能识别旧的白底、保留主体内部的细节、柔化 alpha 边缘并去除底色溢色。但拍摄的房间、精细的景物、浓重的投影，或者主体颜色和背景接近的情况，可能仍然需要可选的 AI 兜底方案：

```bash
pnpm backgroundremover:install
```

然后重启 Marinara，在立绘生成窗口里点击 **Reapply Cleanup**。Marinara 仍会先走内置的蒙版流程，只有边缘看起来不均匀时才动用 AI 模型。如果安装失败：

- 确认装的是 Python 3.9 到 3.11。更新的 Python 版本可能会触发很慢的原生编译。
- 用 `pnpm backgroundremover:reinstall` 重新构建这个工具。
- 排查期间想强制只用自动蒙版清理、不走 AI 兜底，在 `.env` 里设置 `SPRITE_BACKGROUND_REMOVAL_ENGINE=builtin`。

### Game Mode 或 Roleplay 的分镜不出现

Game Mode 分镜会把一段完整的 GM 叙述变成关键帧图像和可选的短片。Roleplay 分镜则会把完整的往来对话合起来，在 Assistant 回复之后内嵌显示结果。

- 确认已经从 **Agents** > **Download Agents** 装好 **Storyboard**，然后为这个聊天开启 **Enable Agents**(启用智能体) 和 **Enable Storyboards**(启用分镜)。
- 手动做场景视频时，先生成或上传一张 **Gallery**(图库) 图像，再用它的 **Video** 或 **Animate** 操作。**Gallery** 把 **Images** 和 **Videos** 分成了两个选项卡，记得看 **Videos** 选项卡。
- 想自动生成 Game Mode 分镜，打开 **Chat Settings** > **Agents**(智能体) > **Storyboards**，确认 **Automatic Storyboard Illustrations** 已开启。也想要短片的话，把 **Automatic Storyboard Animations** 一起打开。
- 在 Roleplay 里，把 **Storyboard** 智能体加进聊天。选择 **Still images** 或 **Animations**，设置 **Messages per episode**，再选好分镜用的图像连接。选 **Manual only** 则改为从图库里的 **Create storyboard** 手动运行。
- 关键帧图像需要图像连接。短片还额外需要视频连接。
- 如果自定义提示词在所有角色合并处理时效果更好，把 **Use NovelAI Character Prompts** 关掉。
- 服务商太慢会超时。在 `.env` 里调大 `IMAGE_GEN_TIMEOUT_MS` 或 `VIDEO_GEN_TIMEOUT_MS`，然后重启 Marinara。服务器只在启动时读取这两个值。

两种工作流见 [Storyboard 智能体指南](game/storyboard.md)，游戏本身的配置见 [Game Mode：入门](game/getting-started.md)。

### Game Mode 世界生成报 JSON 错误

如果开局失败是因为模型返回的 JSON 有问题，Marinara 不会把整个回合直接扔掉，而是打开 **Repair JSON** 窗口。JSON 是模型必须返回的结构化文本格式。

1. 在编辑器里补好括号、逗号或字段。文本能解析之后，横幅会显示 **JSON is valid.**。
2. 点击 **Format** 整理排版。
3. 点击 **Apply Repaired JSON**，无需重新生成整段回复就能直接采用。

## 语音、通话和 TTS

- 如果通话中角色不出声，说明语音合成还没配好。打开 **Connections** > **Text to Speech**，启用它，选择来源，填入密钥，挑一个音色并保存。没有配音色的角色只会以文字形式出现。
- 如果麦克风不工作，可能需要本地语音模型。从 **Agents > Download Agents** 安装 **Calls**，然后打开 **Connections** > **Local Model**，展开卡片，找到 **Local Speech Model**，选一个 Whisper 模型，点击 **Download Whisper**。Firefox 尤其需要这一步，因为它没有浏览器语音识别。卸载 Calls 会一并删掉它的 Whisper 模型以腾出磁盘空间。
- 在 Lite 版本上，提示 **Local Whisper is disabled in Lite mode** 表示这个精简版跑不了本地语音模型。改用完整版的 Marinara。

### 远程或局域网安装时 Music DJ 的 Spotify 登录失败

Music DJ 智能体的 Spotify 模式走的是 OAuth。OAuth 是一种登录交接方式，Spotify 会把你送回一个回调地址。重定向 URI 就是这个回调地址，而 Spotify 只接受 `https://` 地址或环回地址 `http://127.0.0.1`，普通的网络 IP 地址会被拒绝。

- 如果通过 localhost 访问 Marinara，编辑器里显示的是 `127.0.0.1` 回调地址。把它注册到 Spotify，登录就能完成。
- 如果通过 HTTPS 访问 Marinara，编辑器里显示的是你的 HTTPS 回调地址。注册这一个。
- 如果 HTTPS 在上游终结、主机名对不上，在 `.env` 里把 `SPOTIFY_REDIRECT_URI` 设为你的公网回调地址。
- 在纯 HTTP 的局域网安装上，弹出窗口页面加载不出来，但地址栏里仍然带着有效的授权码。把弹出窗口里的完整 URL 复制下来，然后展开 Connect 按钮下方的 **Browser couldn't reach the callback?**，粘贴进去。粘贴的 URL 有效期为 10 分钟。

长期来看最干净的办法是给服务器套上 HTTPS。最近一次核对基于 Marinara Engine 2.2.0。Spotify 在 2025 年 2 月收紧了这些规则。

## 存储和数据

### 更新之后数据像是丢了

如果更新后聊天或预设看着不见了，先别急着删任何数据文件夹。Marinara 把正在用的数据放在数据目录下的 `storage` 文件夹里。

这两个本地位置都要查一下有没有 `storage` 文件夹：

1. `packages/server/data/`
2. `data/`

服务器启动时会打印它解析出的数据目录和存储目录。

### 备份或导出返回 403

环回会话不用管理员密钥就能做备份。但从其他设备、网络地址或 Docker 访问时，备份和档案导出需要额外授权。在服务器上设置 `ADMIN_SECRET`，并把同一个值保存到 **Settings** > **Advanced** > **Admin Access**。如果希望环回访问也必须提供密钥，设置 `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK=true`。

## Android 和 Docker

### Android 应用卡在 Connecting 或 Waiting for Server

Android 应用只是套在 Termux 外面的一层轻壳。Termux 是 Android 上的 Linux 终端应用，真正的 Marinara 服务器跑在它里面。

1. 点击 **Install / Start Marinara**。
2. 如果 Android 要求安装 Termux，同意这些提示。
3. 如果 Android 要求在 Termux 里执行命令，授予权限。
4. 等启动脚本跑完并把服务器拉起来，再回到应用。

另外确认应用和 Termux 用的是同一个端口。默认是 `7860`。如果打包应用时改了端口，Termux 的 `.env` 里也要设置成一样的 `PORT`。

### Android localhost 打开登录页面或返回 401/503

由 APK 管理的 Termux 安装会用每次安装独有的私密密钥保护 localhost。Android 应用会自动认证。在同一部手机的其他浏览器中打开 `/android-login`，然后粘贴以下 Termux 命令显示的值：

```bash
cat ~/.marinara-engine/android-secret
```

本地 `mari` CLI 会自动读取同一个文件。401 表示粘贴的密钥或认证质询遭到拒绝；请重新加载 `/android-login` 并粘贴当前值。503 表示服务器收到的已配置密钥格式错误。请通过 `./start-termux.sh` 重新启动。如果启动脚本报告密钥文件无效或为空，请回到 Android 应用并点击 **Install / Start Marinara**，让 APK 重新生成。不要把这个密钥放进截图或问题报告。

### Android 更新停在 exit status 134

exit status 134 通常表示构建过程中 Android 内存不够了。用最新的启动脚本重新更新：

```bash
./start-termux.sh
```

还是停下来的话，关掉其他 Android 应用，重新打开 Termux，再运行一次这条命令。

### Marinara 运行时 Termux 关闭或重启

服务器运行期间，启动脚本会申请 Android 唤醒锁，并把每次服务器会话保存到 `~/.marinara-engine/logs/`。意外重启后，请在报告中附上最新的 `server-*.log` 文件。如果文件结尾没有 Marinara 或 Node 错误，最可能是 Android 或手机厂商在服务器进程之外终止了 Termux。

请在 Android 设置中允许 Termux 在后台运行，并取消其电池优化。在支持 Termux:API 附加组件的设备上，请安装该附加组件和 `termux-api` 软件包，以便使用 `termux-wake-lock`。这些设置无法阻止所有厂商特有的进程终止，但能消除常见的闲置暂停原因，同时持久日志会保留应用层故障的证据。

### Android 更新时安装依赖把存储空间占满

构建好的 Marinara 应用并没有好几个 GB，Noodle 也不会自己下载 AI 模型。更新期间临时占用大，通常来自 pnpm 的依赖存储和虚拟存储，尤其是连着更新了好几个版本，或者曾经中断过一次强制重装之后。

当前的启动脚本会清理旧版本遗留的包，并且同一次更新不会重复重建依赖存储。如果旧的启动脚本已经把设备塞满了，先更新启动脚本并回收无引用的缓存，再重试：

```bash
cd Marinara-Engine
git pull --ff-only
pnpm store prune
./start-termux.sh
```

不要删 `data`、`storage` 或 `marinara-engine.db`，这些位置可能存着聊天和设置。如果命令仍然中断，把从 `Installing dependencies` 开始的那些行抓下来，连同手机的剩余空间和内存数据一起写进反馈。

### 在 Android 上切换 Stable 和 Staging 时应用内更新失败

切换通道（Stable ↔ Staging）会触发近乎完整的依赖重装，在 Termux 较慢的存储上，耗时会远超一次普通更新。现在应用内更新器在 Android 上给每一步都留了更多时间，所以以前那种只报一句 `Update failed: Command failed: corepack pnpm ... install` 就中断的通道切换，应该能顺利完成。

如果更新仍然失败，报错现在会写明是哪一步失败，并附上那一步输出的末尾内容。仔细读这条信息：真正的依赖或锁文件错误都写在里面。也可以按报错提示里给出的手动命令，在 Termux 里自己跑一次更新，或者先腾出空间：

```bash
cd Marinara-Engine
pnpm store prune
./start-termux.sh
```

### Noodle 显示 `Etc/Unknown`，或日程用错了时区

Conversation 的日程要在 Conversation 的 Chat Settings 或角色日程编辑器里选择 **Schedule timezone**。这是一个全局选择，对每个 Conversation 聊天都生效，包括后台的自主消息，也可以用 **Use device** 重置。

如果是 Noodle 或服务器任务，而且没有在 Conversation 里单独指定时区，把 `.env` 里空的 `TZ=` 行删掉并重启 Marinara，让服务器继承主机时区。想显式指定一个主机兜底时区，就填一个有效的 IANA 名称，比如 `TZ=Europe/Warsaw` 或 `TZ=America/New_York`。当前版本会把空值当作未设置，但仍然必须重启，Node 的时区状态和定时任务才能一致地重建。

### 挂载数据卷时容器报权限拒绝

如果 Docker 或 Podman 容器在数据卷上报权限错误：

- 更新之后使用命名卷的情况，拉取最新镜像并用 `docker compose pull && docker compose up -d` 重启。官方镜像会在启动时修复归属权。
- 绑定挂载的情况，把宿主机文件夹的读写权限开放给用户和组 ID `1000`，或者改用命名卷。
- 在 Fedora、RHEL 这类启用 SELinux 的系统上，给卷挂载加上 `:Z` 后缀。

### Lite 容器在 Raspberry Pi 4 上崩溃

如果 lite 容器在 Raspberry Pi 4 或类似的 ARM 设备上，一发 AI 请求就重启，先看退出码。退出码 132 或 SIGILL 指向 lite 镜像的 Node 构建在部分 ARM 芯片上的一个已知上游问题。SIGILL 表示程序执行到了 CPU 跑不了的指令。

普通（非 lite）镜像不受影响。在上游修复发布之前，在那台设备上改用普通镜像。已知受影响的 lite 镜像包括 `1.5.7-lite` 和 `1.5.8-lite`。最近一次核对基于 Marinara Engine 2.2.0。

### Addons 里找不到 External Extensions

这一节是刻意隐藏的，只有两道安全开关都打开才会出现：

1. 在宿主机的 `.env` 里设置 `ENABLE_EXTERNAL_EXTENSIONS=true`。
2. 等大约两秒让配置监听器生效，然后打开 **Settings → Advanced → Danger Zone**，滚动到数据删除控件下方，启用 **Allow third-party extension imports**。

如果 Danger Zone 里的这个开关是禁用状态，说明宿主机的标志仍然是 false，或者应用还没察觉到这次改动。确认改的是[服务器配置](CONFIGURATION.md)里说明的那个生效中的 `.env` 路径。在 Docker 上通常是 `/app/data/.env`。

只要有一道开关是关的，外部的、旧格式的、从档案导入的、手动存放的以及来源不明的扩展记录都不会显示，也无法运行。重新打开开关也不会自动重新启用它们。

### 导入的浏览器扩展出现了却不工作

在 **Settings → Addons → External Extensions** 里打开这个扩展，查看 **Requested access**。使用 `marinara.extension` v1 格式、没有能力声明的旧包，这里应当显示 **Full page access**。只批准你确认并信任的那个准确哈希值。

如果旧包在重新导出时带上了一个明确为空的能力列表，Marinara 会把它当作安全的沙箱扩展处理，依赖 DOM 的代码在这种模式下不会生效。只有在清楚代码将拿到整个 Marinara 页面、浏览器存储、网络 API 和同源会话的访问权时，才给它的清单加上 `full_page_access`。

禁用整页访问扩展之后，如果工具栏项、浮层、监听器或某处视觉改动还留着，重新加载 Marinara。清理只能尽力而为，因为页面代码可能在 Marinara 可追踪的兼容 API 之外留下副作用。

### 服务器扩展提示没有可用的沙箱

服务器扩展只能在 macOS Seatbelt 或 Linux Bubblewrap 下运行。在 Linux 宿主机上安装 `bwrap`，然后重启 Marinara。Windows、Android 和其他不受支持的宿主环境会直接拒绝执行服务器扩展，而不是退回到主服务器进程里跑。浏览器扩展仍然可以使用它们的不透明来源 Worker 沙箱。

## 获取更多帮助

如果还是需要帮助，先把细节收集齐。

1. 打开 **Settings** > **Advanced** > **Message Tools**，开启 **Debug mode**。这会把提示词和回复的完整内容记录到服务器控制台，方便你分享出去。
2. 记下操作系统、Node.js 版本，以及服务器控制台里完整的报错文本。

分享调试输出之前，先删掉 API 密钥、访问 Token、管理员密钥、私密提示词和私密聊天内容。

然后到社区里来：

- 在 https://github.com/Pasta-Devs/Marinara-Engine/issues 查看已有的 issue
- 加入 Discord 寻求社区帮助：https://discord.com/invite/KdAkTg94ME
- 带上前面收集的细节，到 https://github.com/Pasta-Devs/Marinara-Engine/issues 提交 bug 反馈。

## 相关指南

- [常见问题](FAQ.md)
- [服务器配置参考](CONFIGURATION.md)
- [远程访问](REMOTE_ACCESS.md)
- [升级 Marinara Engine](UPGRADING.md)
- [连接 AI 服务商](connections/connecting-to-a-provider.md)
- [本地模型设置](connections/local-model.md)
- [Game Mode：入门](game/getting-started.md)
- [设置总览](settings/settings-overview.md)
