# 连接本地或自托管模型

本指南介绍如何通过 Ollama、LM Studio、KoboldCpp 或 llama.cpp 这类程序，把 Marinara Engine 连到跑在你自己电脑或服务器上的 AI 模型。Marinara 自己运行、不需要另外服务器的小模型，见[内置模型设置](local-model.md)。

## 建立 Custom 连接

在应用里，这类账号叫 **OpenAI-compatible**(OpenAI 兼容)。意思是服务器接受与 OpenAI 聊天 API 相同的请求格式。Ollama、LM Studio、KoboldCpp 和 llama.cpp 都是这样。

开始之前，先装好一个模型服务器，启动它，并在里面加载一个模型。比如从 `ollama.com` 下载 Ollama，按它的步骤拉取一个模型。Marinara 只负责连上服务器，不会替你启动它。服务器在你电脑上的某个网址响应请求，这个网址叫端点（endpoint）。

1. 点击顶栏的 **Connections**(连接)，再点击 **Add**(添加)。**Add account**(添加账号) 窗口随即打开。
2. 在 **Chat**(聊天) 下面点击你的服务器：**Ollama**、**LM Studio**、**KoboldCpp** 或 **llama.cpp**。这些卡片带有 **Self-hosted**(自托管) 标签。其他服务器点击 **OpenAI-compatible address**(OpenAI 兼容地址)。
3. 检查 **Server address**(服务器地址)。上面这四种服务器会自动填好。其他服务器要自己输入地址。见下表。
4. **API key (optional)**(API 密钥，可选) 留空。多数本地服务器不需要密钥。想给账号起个名字，就填 **Name (optional)**(名称，可选)。
5. 点击 **Connect**(连接)。Marinara 会测试这个地址。显示 **Connected** 就说明连上了服务器。
6. 接下来怎样，取决于你是否已经有 Main 模型。如果还没有，或者你是从新聊天里打开 Add 的，窗口会列出服务器上报的模型。选一个，或者在 **Search or enter model ID…**(搜索或输入模型 ID…) 里输入模型 ID，然后点击 **Done**(完成)。如果已经有 Main 模型，窗口会关闭，并弹出一条消息说明账号已添加。之后点击账号上的 **⋯**，选择 **Add model**(添加模型)。

这时面板里就能看到这个账号。正式依赖它之前先测一下（见[测试连接](#test-the-connection)）。

如果没有成功：

- **Marinara could not reach** 这个地址。检查服务器是否在运行，地址和端口是否一致。**Continue anyway**(仍然继续) 会在测试没通过的情况下保存账号。
- 地址在另一台电脑上。见[连接另一台电脑上的服务器](#reach-a-server-on-another-computer)。

## 常见本地服务器的地址

端口是服务器在你电脑上使用的带编号的通道。`localhost` 表示“同一台电脑”，所以只要 Marinara 和服务器在同一台电脑上，这些地址照抄就能用。

| 服务器 | 地址 |
| --- | --- |
| Ollama | `http://localhost:11434/v1` |
| LM Studio | `http://localhost:1234/v1` |
| KoboldCpp | `http://localhost:5001/v1` |
| llama.cpp | `http://localhost:8080/v1` |

在 **Edit model**(编辑模型) 里，地址字段会显示一条警告：“Only use URLs from providers you trust. A malicious endpoint could intercept your messages and API keys.”只填自己搭建或完全信任的地址。

在 Windows 上，服务器明明在运行，也可能被拦住。如果 Marinara 检测不到它，可能是 Windows Defender Firewall 挡住了。打开 **Windows Security → Firewall & network protection → Allow an app through firewall**(Windows 安全中心 → 防火墙和网络保护 → 允许应用通过防火墙)，把 Node.js 或你的服务器程序加进去。

<a id="test-the-connection"></a>

## 测试连接

**Connect** 已经检查过这个地址。模型编辑器里有一张 **Provider tests**(服务商测试) 卡片，可以再检查一遍。

1. 在 **Connections** 面板里点击你的模型，打开模型编辑器。
2. 点击 **Test provider**(测试服务商)。它检查地址是否可达，并显示耗时。
3. 还没选模型的话，先选一个，然后点击 **Send test message**(发送测试消息)。它会发送一条简短的消息，并显示回复。

两项都通过后，打开一个聊天，在 **Model for this chat**(此聊天的模型) 里选这个账号。见[为单个聊天选择模型](connecting-to-a-provider.md#choosing-a-model-for-one-chat)。

某项测试失败时，确认服务器在运行并且已经加载了模型，地址和端口也完全一致。服务器在另一台电脑上时，核对下面的步骤。

<a id="reach-a-server-on-another-computer"></a>

## 连接另一台电脑上的服务器

`localhost` 和 `127.0.0.1` 这类地址永远可用。如果模型服务器在你网络里的另一台电脑上，Marinara 默认会屏蔽这个私有地址。运行 Marinara 服务器的人可以用一个环境变量放行它。环境变量就是服务器启动时读取的一项设置。

1. 打开服务器的 `.env` 文件。普通安装时，它在 Marinara 项目文件夹里。Docker 和 Podman 见[服务器配置参考](../CONFIGURATION.md#edit-the-env-file)。
2. 加上这一行：

```
PROVIDER_LOCAL_URLS_ENABLED=true
```

3. 保存文件，并重启 Marinara 服务器。
4. 使用另一台电脑的地址，比如 `http://192.168.1.50:11434/v1`。

在 Android 上，不设置这一项时它默认是开启的。

## 用这个模型做判定

同一个模型也能回答判定问题，例如智能体激活检查，不需要再加载一份。在面板里点击这个模型上的 **⋯**，选择 **Use this model for decisions**(将此模型用于判定)。有模型名称的 OpenAI 兼容模型才会显示这一项。见 [Decision 模型](decision-models.md#on-a-server-you-already-run)。

## Treat as local/custom endpoint 开关

在 **Edit model** 里，**Local / custom endpoint**(本地 / 自定义端点) 下面有一个名为 **Treat as local/custom endpoint**(按本地/自定义端点处理) 的开关，默认关闭。它只对没有绑定账号的旧模型显示。现在添加的模型永远不会显示它。

代理或自托管服务器不是已知服务时，开启它。开启后，Marinara 会一律尝试工具调用，并让 Professor Mari 改用备用的工具方案（一套 JSON 工具协议），而不是只走原生工具调用。如果 Professor Mari 用完工具就停住不动，或者服务器声称兼容 OpenAI、却处理不好工具调用，就开启它。模型不开也正常的话，保持关闭即可。

## 相关指南

- [连接 AI 服务商](connecting-to-a-provider.md)
- [内置模型设置](local-model.md)
- [Decision 模型](decision-models.md)
- [服务器配置参考](../CONFIGURATION.md)
