# Haptic Feedback 触感反馈设置

触感反馈让 AI 角色在聊天过程中，把触碰指令发给一台已连接的触感设备（也就是情趣玩具）。本指南介绍如何安装配套应用、把 **Haptic Feedback** 智能体加进聊天、连接设备，以及调整触感设置。

Marinara Engine 不直接和设备通信，而是把命令发给一个免费的配套应用 **Intiface Central**，再由它去驱动设备。Intiface Central 使用 **Buttplug.io**，这是一套开放标准，很多玩具和应用都支持。Marinara 通过一个网络地址连上它。触感反馈是一个聊天智能体（可以加进聊天的 AI 帮手），在 Conversation(对话模式)、Roleplay(角色扮演) 和 Game(游戏模式) 下都能用。

## 开始之前

1. 从 `https://intiface.com/central/` 安装 **Intiface Central**。
2. 打开它，用服务器启动按钮启动它的服务器。
3. 在 Intiface Central 里配对设备，让应用能识别到它。

如果 Intiface Central 没运行，或者服务器没启动，Marinara 就发不出触碰指令。另外还需要先安装 **Haptic Feedback** 智能体。见[智能体概览](../agents/agents-overview.md)。

## 添加 Haptic Feedback 智能体

1. 打开一个 Conversation、Roleplay 或 Game 聊天。
2. 打开 **Chat Settings**(聊天设置)，进入 **Agents**(智能体)。
3. 添加 **Haptic Feedback** 智能体。**Agents** 列表里会出现一张 **Haptic Feedback** 卡片。
4. 开启卡片顶部的 **Haptic Feedback** 开关。

这个开关默认是关的。关闭时，说明文字显示“Allow this agent to send touch cues during the chat.”开启时则变成“Touch cues are enabled for this chat.”开关开启后，AI 会在写回复的同时发出隐藏的触碰指令。这些指令不会以文字形式出现在聊天里，而是发给每一台已连接的设备。

## 连接并扫描

打开卡片时，Marinara 会用保存好的地址尝试连接 Intiface Central。状态行在已连接时显示绿点，未连接时显示红点。旁边的按钮在未连接时显示 **Connect**(连接)，已连接时显示 **Disconnect**(断开连接)。

1. 点击 **Connect**。连接成功后，这一行会显示“Connected”和服务器地址。
2. 点击 **Scan for devices**(扫描设备) 重新搜索。扫描过程中，按钮上显示的是“Scanning...”

卡片会显示“No devices found”或设备数量，并逐台列出设备在 Intiface 中的准确名称和它支持的动作。Marinara 还会把这个名称、根据设备能力推断出的玩具类型和支持的动作交给 Haptic Agent，这样它就能选对设备和动作，而不会把每种玩具都当成振动器。

如果没有成功：连接失败时会出现一条提示，提醒你确认 Intiface Central 正在运行、服务器已启动。提示里还带一个指向它官网的链接。

## 支持的动作与模式

Marinara 会使用 Intiface 为设备报告的每一种输出类型：振动、旋转、往复运动、收缩、充气、线性位置、温度、喷射和灯光。线性位置控制做抽动、推进或泵动的设备。充气控制使用气压泵的设备。

智能体可以把 **Steady**、**Tap**、**Pulse**、**Wave**、**Ramp** 或 **Impact** 模式用于停止以外的任意动作。位置模式会交替设置真实的移动目标，因此泵动或抽动模式会随时间执行，而不是一次发送多个动作。

## Intiface URL 输入框

**Intiface URL** 是 Intiface Central 服务器的 WebSocket 地址。WebSocket 地址就是两个应用之间通信用的链接。默认值是：

```text
ws://127.0.0.1:12345
```

`127.0.0.1` 的意思是本机。输入框留空时，Marinara 会用服务器默认值，这个默认值可以用 `.env` 里的 `INTIFACE_URL` 环境变量修改。见[服务器配置参考](../CONFIGURATION.md)。Marinara 会把地址随聊天一起保存，同时也记在这个浏览器里，所以你在这里打开的其他聊天一开始就会用它。

这个地址只保存在这个 Marinara 安装实例里。聊天导出、导出的设置方案和 **Export Profile**(导出档案) 文件都不包含它，导入其中任何一种也绝不会设置它。把聊天挪到另一个安装实例后，要重新填写。

如果 Marinara 跑在 Docker 里，或者在另一台设备的浏览器里打开它，`127.0.0.1` 就连不到 Intiface Central 了。这时要填运行 Intiface Central 那台电脑的地址，把数字换成它的真实地址：

```text
ws://192.168.1.50:12345
```

## 触感强度

在每种聊天模式里，卡片都会显示 **Touch sensitivity**(触感强度) 控件。它引导智能体更倾向于选择轻柔还是强烈的输出，但不是上限：当前动作需要时，每个档位都可以使用完整的 `0.0-1.0` 强度范围。Marinara 会根据 Intiface 的物理范围验证每条命令。

| 档位 | 手感 |
| --- | --- |
| **Subtle** | 倾向于更轻柔的反馈。 |
| **Standard** | 适合大多数场景的均衡反馈。这是默认档位。 |
| **Intense** | 更倾向于选择强烈反馈。 |

## 无意触碰

**Incidental contact**(无意触碰) 开关（“Tiny taps for accidental brushes and bumps.”）默认是关的。关闭时，AI 会忽略轻微的无意触碰，只为刻意的或有力度的接触发出指令。想让轻蹭和碰撞也带来轻微震动，就把它开启。

<a id="use-it-from-another-device"></a>

## 在另一台设备上使用

默认情况下，Marinara 只接受来自运行 Marinara 服务器那台电脑的触感命令，这样设备控制更私密。因此，从手机或其他设备打开 Marinara、去访问运行在别处的服务器时，触感反馈用不了，连接、扫描和发送命令都会被拒绝。

要允许这样用，需要开启服务器设置 `HAPTICS_ALLOW_REMOTE`，并配好访问保护：登录或管理员密钥。见[服务器配置参考](../CONFIGURATION.md)和[远程访问指南](../REMOTE_ACCESS.md)。管理员访问信息在 **Settings → Advanced → Admin Access**(设置 → 高级 → 管理员访问) 里填写。

## 遇到问题时

如果 AI 始终触发不了设备，按顺序检查：

1. Intiface Central 已打开，服务器已启动。
2. 点击 **Scan for devices** 之后，设备已配对并出现在列表里。
3. 状态圆点是绿色的，并且 **Haptic Feedback** 开关处于开启状态。
4. 如果用的是手机或远程设备，见[在另一台设备上使用](#use-it-from-another-device)。

Intiface Central 未连接、或者没有设备接入时，Marinara 会悄悄跳过这条指令，聊天里不会出现任何报错。

## 相关指南

- [智能体：聊天里的 AI 帮手](../agents/agents-overview.md)
- [可下载智能体参考](../agents/built-in-agents.md)
- [远程访问：登录与 IP 允许列表](../REMOTE_ACCESS.md)
