# Haptic Feedback 触感反馈设置

本指南介绍如何在 Marinara Engine 里让 AI 角色控制已连接的触感设备，内容包括安装配套应用、把 **Haptic Feedback** 智能体加进聊天、连接设备，以及可以调整的触感选项。

## 什么是触感反馈

触感反馈让 AI 角色在聊天过程中，把触碰指令发给一台已连接的触感设备（也就是情趣玩具）。Marinara Engine 不直接和设备通信，而是把命令发给一个免费的配套应用 **Intiface Central**，再由它去驱动设备。

**Intiface Central** 使用的设备协议叫 **Buttplug.io**，这是一套开放标准，很多玩具和应用都支持。**Intiface Central** 只需安装一次，把设备和它配好对，Marinara 就能通过一个本地网络地址连上去。

触感反馈是聊天 **Agents**(智能体)之一，也就是可以加进聊天的那些 AI 帮手。它在 Conversation(对话模式)、Roleplay(角色扮演)和 Game(游戏模式)下都能用。

## 开始之前

开启触感反馈之前，要先准备好三样东西。

1. 从官网安装 **Intiface Central**。在浏览器里打开下面这个地址。

```
https://intiface.com/central/
```

2. 打开 **Intiface Central** 并启动它的服务器。启动按钮就在应用界面里。
3. 在 **Intiface Central** 里配对或连接设备，让应用能识别到它。

如果 **Intiface Central** 没运行，或者服务器没启动，Marinara 一条触碰指令也发不出去。

## 添加 Haptic Feedback 智能体

添加触感反馈和添加其他智能体一样，都在聊天的设置里操作。

1. 打开一个 Conversation、Roleplay 或 Game 聊天。
2. 打开该聊天的 **Chat Settings**(聊天设置)。
3. 进入 **Agents** 区域。
4. 把 **Haptic Feedback** 智能体加进这个聊天。
5. 在 **Agents** 列表里找到刚出现的 **Haptic Feedback** 卡片。

开启卡片顶部的 **Haptic Feedback** 开关。关闭时，说明文字显示“Allow this agent to send touch cues during the chat.”；开启后变成“Touch cues are enabled for this chat.”这个开关默认是关的。

开关一旦开启，AI 就能在写回复的同时发出隐藏的触碰指令。这些指令不会以文字形式出现在聊天里，而是发给每一台已连接的设备。

## 连接、扫描并找到设备

打开 **Haptic Feedback** 卡片时，Marinara 会用保存好的地址自动尝试连接 **Intiface Central**。也可以手动连接。

卡片上有一行状态，前面带一个彩色圆点。绿点表示已连接，红点表示未连接。旁边的按钮在未连接时显示 **Connect**(连接)，已连接时显示 **Disconnect**(断开连接)。

手动连接就点 **Connect**。连上之后，这一行会显示“Connected”和服务器地址。

连接失败时会出现一条提示，说明应用连不上，并提醒检查 **Intiface Central** 是否在运行、服务器是否已启动。提示里还带一个指向 **Intiface Central** 官网的链接。

连上以后，卡片会显示找到了多少台设备。一台都没有时显示“No devices found”，有设备时显示数量。点击 **Scan for devices**(扫描设备) 可以重新搜索，扫描过程中按钮显示“Scanning...”卡片会逐台列出设备的名称和支持的动作，比如振动或旋转。

Marinara 还会把 Intiface 中的准确名称、根据能力推断的玩具类型和支持的动作交给 Haptic Agent。这样它就能选对设备和动作，而不会把每种玩具都当成振动器。

## 支持的动作与模式

Marinara 会使用 Intiface 为已连接设备报告的每一种输出类型：振动、旋转、往复运动、收缩、充气、线性位置、温度、喷射和灯光。线性位置控制做抽动、推进或泵动的设备；充气控制使用气压泵的设备。

智能体可以把 **Steady**、**Tap**、**Pulse**、**Wave**、**Ramp** 或 **Impact** 模式用于停止以外的任意动作。位置模式会交替设置真实的移动目标，因此泵动或抽动模式会随时间执行，而不是一次发送多个动作。

### Intiface URL 输入框

**Intiface URL** 输入框填的是 **Intiface Central** 服务器的网络地址。这是一个 WebSocket 地址，说白了就是两个应用之间通信用的本地链接。默认值见下方。

```
ws://127.0.0.1:12345
```

地址 `127.0.0.1` 的意思是“本机”。输入框留空时，Marinara 会用服务器默认值。Marinara 还会把地址记在浏览器里，换聊天、换设备都会沿用。

如果 Marinara 跑在 Docker 里，或者在另一台设备的浏览器里打开 Marinara，`127.0.0.1` 就够不着 **Intiface Central** 了。这种情况下要填运行 **Intiface Central** 那台电脑的地址，格式参照下面的示例，把数字换成那台电脑的真实地址。

```
ws://192.168.1.50:12345
```

## 触感强度

在每种聊天模式里，**Haptic Feedback** 卡片都会显示一个有三个档位的 **Touch sensitivity**(触感强度)控件。强度设置会引导智能体更倾向于选择轻柔还是强烈的输出，但不会设置硬性上限。当前动作需要时，每个档位都可以使用设备完整的 `0.0-1.0` 强度范围。

三个档位引导智能体的反应风格。

| 档位 | 手感 | 说明 |
|---|---|---|
| **Subtle** | 倾向于更轻柔的反馈 | 仍可使用完整范围 |
| **Standard** | 适合大多数场景的均衡反馈 | 默认档位；可使用完整范围 |
| **Intense** | 更倾向于选择强烈反馈 | 可以使用完整输出 |

默认选中 **Standard**。挑一个和当前场景相称的反应风格就行。Marinara 仍会根据 Intiface 的物理 `0.0-1.0` 范围验证每条命令。

## 无意触碰

在强度控件下方，每种聊天模式还会显示一个 **Incidental contact**(无意触碰)开关，说明文字是“Tiny taps for accidental brushes and bumps.”这个开关默认是关的。

关闭时，AI 会忽略故事里那些轻微的无意触碰，只为刻意的或有力度的接触发出指令。想让轻蹭和碰撞也带来轻微震动，就把它开启。

## 在另一台设备上使用

默认情况下，Marinara 只接受来自运行 Marinara 服务器那台电脑的触感命令，这样设备控制权就留在本地，也更私密。

正因如此，从手机或其他设备打开 Marinara 时，触感反馈用不了。这指的是那台设备去访问运行在别处的 Marinara 服务器的情况。除非改动服务器设置，否则连接、扫描和发送命令都会被拒绝。

想允许其他设备控制触感，需要开启服务器设置 `HAPTICS_ALLOW_REMOTE`，同时还必须配好访问保护，比如 Basic Auth 或管理员密钥。设置项见[服务器配置参考](../CONFIGURATION.md)，访问保护见[远程访问](../REMOTE_ACCESS.md)指南。管理员访问信息在 **Settings**(设置) 的 **Advanced** 区域，**Admin Access** 部分填写。

## 遇到问题时

如果 AI 始终触发不了设备，按顺序检查以下几项。

1. 确认 **Intiface Central** 已打开，服务器已启动。
2. 点击 **Scan for devices** 之后，确认设备已配对并出现在设备列表里。
3. 确认状态圆点是绿色的，并且 **Haptic Feedback** 开关处于开启状态。
4. 如果用的是手机或远程设备，回看上面关于远程访问的说明。

**Intiface Central** 未连接、或者没有设备接入时，Marinara 会悄悄跳过 AI 的触碰指令，聊天里不会出现任何报错。

## 相关指南

- [智能体：聊天里的 AI 帮手](../agents/agents-overview.md)
- [可下载智能体参考](../agents/built-in-agents.md)
- [远程访问：Basic Auth 与 IP 允许列表](../REMOTE_ACCESS.md)
