# 连接本地或自托管模型

本指南介绍如何把 Marinara Engine 连到跑在自己电脑或自己服务器上的 AI 模型，涵盖 Ollama、LM Studio、KoboldCpp 这些常见的本地模型服务端，以及让它们跑通所需的设置。

## 什么是自托管

自托管模型就是跑在自己掌控的硬件上的 AI 模型。装好一个本地模型服务端，由它加载模型，再在本机的某个网址上响应请求。这样 Marinara Engine 连的就是这个地址，而不是付费的云端服务。

常见的本地模型服务端有 Ollama、LM Studio 和 KoboldCpp。它们都跑在自己的电脑上，提供一个私有的 endpoint。endpoint 就是服务端监听请求的那个网址。

本指南讲的是自己安装、自己运行的外部本地服务端。Marinara 本身还内置了一个小模型，不需要另外的服务端。想用内置模型的话，见[本地模型设置](local-model.md)。

动手之前，先确认本地模型服务端已经装好、已经在运行，并且已经加载了模型。Marinara 不会替你启动这个服务端，它只负责连上去。

## 建立 Custom 连接

Marinara 通过 **Custom (OAI-Compatible)**(自定义 OAI 兼容) 服务商连接本地服务端。OAI 兼容的意思是，服务端使用与 OpenAI Chat Completions API 相同的请求格式。Ollama、LM Studio 和 KoboldCpp 都提供这种格式。

按以下步骤创建连接。

1. 从应用右侧打开 **Connections**(连接) 面板。
2. 点击 **Add**(添加)。**Add account**(添加账号) 窗口随即打开。
3. 在第 1 步里选择 **Custom (OAI-Compatible)**。它列在 **On your computer**(在你的电脑上) 下面。
4. 在第 2 步里，把本地服务端的地址填进 **Address**(地址) 输入框（见下表）。
5. **API key**(API 密钥) 输入框留空。多数本地服务端不需要密钥。想给连接起个名字，比如 `Ollama Local`，就打开 **More options**(更多选项)，填在 **Name (optional)**(名称，可选) 下面。
6. 点击 **Connect**(连接)。
7. 在第 3 步里，从服务端上报的列表中选一个模型，也可以手动输入模型 ID。点击 **Done**(完成)。

这时在 **Connections** 面板里就能看到这个连接，它的模型归在它下面。正式用于聊天之前先测一下，见下面的“测试连接”一节。

对本地服务端来说，**API Key** 输入框是可选的。选用 **Custom (OAI-Compatible)** 服务商时，编辑器会在这个输入框下面给出提示：Ollama、LM Studio、KoboldCpp 这类本地模型可以把密钥留空，只填 **Address** 就行。

## 常见本地服务端的 Base URL

**Address** 也叫 Base URL，它告诉 Marinara 本地服务端在哪里监听。每种服务端都有默认的地址和端口。端口是服务端在本机使用的带编号的通道。用哪种服务端，就填哪一行的地址。

| 本地服务端 | 端点 |
|---|---|
| Ollama | `http://localhost:11434/v1` |
| LM Studio | `http://localhost:1234/v1` |
| KoboldCpp | `http://localhost:5001/v1` |

这里的 `localhost` 表示“同一台电脑”。只要 Marinara 和模型服务端在同一台电脑上，这些地址照抄就能用。

**Address** 输入框会显示一条安全警告：“Only use URLs from providers you trust. A malicious endpoint could intercept your messages and API keys.”只填自己搭建或完全信任的地址。

### Windows 防火墙提示

在 Windows 上，本地服务端明明在运行，也可能被拦住。编辑器在 **Custom (OAI-Compatible)** 服务商下会给出这条提示：如果检测不到代理或本地服务端，可能是 Windows Defender Firewall 挡住了连接。解决办法是依次打开 Windows Security、Firewall and network protection、Allow an app through firewall，把 Node.js 或对应的服务端程序加进去。

## Treat as local/custom endpoint 开关

连接编辑器里有一个 **Local / Custom Endpoint**(本地 / 自定义端点) 分区，其中有个名为 **Treat as local/custom endpoint**(按本地/自定义端点处理) 的开关，默认关闭。自托管或经过代理的 endpoint 建议开启，尤其是指向本地网络内模型服务端的自定义网址。

这个开关关闭时，对于认不出来的模型，Marinara 在工具调用上会保守处理。开启后，Marinara 就会一律尝试工具调用，同时让 Professor Mari 改用备用的工具方案（一套 JSON 工具协议），而不是只走原生工具调用。Professor Mari 是应用内置的助手。

如果 Professor Mari 用完工具就停住不动，就开启这个开关。如果 endpoint 声称兼容 OpenAI，工具调用却不太靠得住，同样开启它。本地模型不开也一切正常的话，保持关闭即可。

## 连接另一台电脑上的服务端

连接本机 Marinara 一直是允许的。`localhost` 和 `127.0.0.1` 这类地址叫环回地址，意思是“就是这台机器”。它们无需任何额外设置，永远可用。

如果模型服务端跑在家庭或办公网络里的另一台电脑上，那就属于私有网络地址。出于安全考虑，Marinara 默认屏蔽私有网络地址。要放行，运行 Marinara 服务器的人需要设置一个环境变量。环境变量就是服务器启动时读取的一项设置。

在服务器的 `.env` 文件里加上这一行：

```
PROVIDER_LOCAL_URLS_ENABLED=true
```

保存文件并重启 Marinara 服务器，改动才会生效。之后就可以把 Base URL 指向网络里的另一台机器，比如 `http://192.168.1.50:11434/v1`。

在 Android 上，不设置这一项时它默认是开启的。关于 `.env` 文件和服务器设置的更多内容，见[服务器配置参考](../CONFIGURATION.md)。

## 测试连接

添加流程里的 **Connect** 已经检查过这个连接。模型编辑器底部还有一张 **Connection Tests**(连接测试) 卡片，可以再检查一遍。在聊天里正式依赖这个连接之前，先用它测一下。

1. 在 **Connections** 面板里点击自己的模型，打开模型编辑器。
2. 点击 **Test Connection**(测试连接)。这一步检查 Base URL 和相关设置是否可达，并报告耗时。
3. 还没选模型的话，先选一个。
4. 点击 **Send Test Message**(发送测试消息)。这一步会向选定的模型发送一个“hi”，并显示回复。

两项测试都通过，本地模型就可以在聊天里用了。打开一个聊天，进入它的设置，选中这个连接，或者用聊天输入框里的 **Connections** 菜单。

同一个模型也能回答决策问题，例如智能体激活问题，不需要 Marinara 再加载一份模型。在连接设置中点击 **Use this model for decisions**(使用此模型进行决策)，详见[决策模型](decision-models.md#on-a-server-you-already-run)。

某项测试失败时，先确认本地服务端还在运行、模型也已加载。然后核对 **Address** 是否与服务端的地址和端口完全一致。服务端在另一台电脑上时，确认 `PROVIDER_LOCAL_URLS_ENABLED` 已设置，并且已经重启了 Marinara 服务器。

## 相关指南

- [连接 AI 服务商](connecting-to-a-provider.md)
- [本地模型设置](local-model.md)
- [决策模型](decision-models.md)
- [服务器配置参考](../CONFIGURATION.md)
