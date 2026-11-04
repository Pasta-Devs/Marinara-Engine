# Home Assistant 集成

这个集成让 AI 角色直接在聊天里控制真实的智能家居设备，比如灯光、温控、窗帘和车库门等遮挡设备，以及媒体播放器。它也让 Home Assistant 的自动化能把消息发进 Marinara Engine。Home Assistant 是一个免费的开源智能家居平台。没有在用它的话，就不需要看这篇指南。

## 这个集成会添加什么

集成本身是一小段软件，安装在 Home Assistant 内部，把它和你的 Marinara 服务器连起来。首次设置时，它会替你创建下面这些东西。你完全不需要手动复制工具地址，也不需要手动配置工具。

- Presets(预设) 面板 **Functions**(函数) 部分里的智能家居工具。见[自定义工具](../extending/custom-tools.md)。
- 一个名为 **Home Assistant** 的智能体，也就是伴随聊天一起运行的 AI 帮手。见[智能体概览](../agents/agents-overview.md)。
- 若干 Home Assistant 实体（设备、传感器和控制项），方便你从 Home Assistant 查看和控制 Marinara。

## 准备工作

- Home Assistant 2024.1.0 或更高版本。
- Home Assistant 里已安装 HACS。HACS 即 Home Assistant Community Store，是一个用来安装自定义集成的工具。
- Marinara 正在运行，而且 Home Assistant 所在的机器能访问到它。默认地址是 `localhost:7860`。
- Marinara 的 `.env` 文件里有 `WEBHOOK_LOCAL_URLS_ENABLED=true`。

`.env` 是 Marinara 服务器的纯文本设置文件，它在哪里见[服务器配置](../CONFIGURATION.md)。集成用到了 webhook，也就是让一个应用能把数据发给另一个应用的网址。Home Assistant 的 webhook 是本地的普通 `http` 地址，而 Marinara 出于安全考虑默认拦截这类地址。这项设置就是放行它们。加上这一行并保存。不用重启就会生效，通常几秒之内（最多约 30 秒）：

```text
WEBHOOK_LOCAL_URLS_ENABLED=true
```

### 如果 Home Assistant 跑在另一台设备上

集成连接时不带用户名和密码，设置表单里也没有地方可填。

- 同一台机器：连接开箱即用。
- 另一台设备：Marinara 默认会拦截。把那台设备的 IP 地址（它在网络中的编号地址）加进 `.env` 里的 `IP_ALLOWLIST`。如果家里的网络完全可信，也可以改为设置 `ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK=true`。
- 如果 Marinara 设置了 `BASIC_AUTH_USER` 和 `BASIC_AUTH_PASS`(也就是登录)，集成无法登录。这时它只能在同一台机器上工作，或者从 `IP_ALLOWLIST` 里的设备工作。

该选哪种做法，见[远程访问](../REMOTE_ACCESS.md)。

## 安装集成

### 加进 HACS

1. 在 Home Assistant 里打开 **HACS**。
2. 打开三点菜单，点击 **Custom repositories**(自定义仓库)。
3. 在仓库地址框里填入 `https://github.com/Pasta-Devs/Marinara-Engine`。
4. 把类别设为 **Integration**(集成)，然后点击 **Add**(添加)。
5. 搜索 **Marinara Engine** 并安装。
6. 重启 Home Assistant。

### 完成设置

1. 打开 **Settings → Devices & Services**(设置 → 设备与服务)，点击 **Add Integration**(添加集成)。
2. 搜索 **Marinara Engine**。
3. 填入 Marinara 运行所在的 **Host**(主机) 和 **Port**(端口)。默认是 `localhost` 和 `7860`。
4. 点击 **Submit**(提交)。

如果没有成功：Home Assistant 访问不到 Marinara 时会报错。见[故障排查](#troubleshooting)。

设置成功后，集成会在 Home Assistant 里注册一个私有 webhook，在 Marinara 的 **Functions** 部分创建指向这个 webhook 的工具，创建列出所有已启用工具的 **Home Assistant** 智能体，并创建下文介绍的那些实体。

## 把智能体加进聊天

创建好智能体，并不等于它会挂到每个聊天上。想在哪个聊天里控制智能家居，就把它加进哪个聊天。

1. 打开聊天，点击 **Chat Settings**(聊天设置)。
2. 打开 **Agents**(智能体) 部分。
3. 添加 **Home Assistant** 智能体。

它在 Roleplay(角色扮演)、Conversation(对话模式) 和 Game(游戏) 聊天里都能用。加进去之后，这个聊天里的 AI 就能使用这些工具，不需要再开启别的东西。

### 检查是否生效

1. 在这个聊天里用大白话提个要求，例如 `Turn on the office lights`，然后发送。
2. AI 应该会调用 `ha_turn_on` 之类的工具，灯随之亮起，AI 再确认一下。

如果毫无反应，检查是否设置了 `WEBHOOK_LOCAL_URLS_ENABLED=true`，再看[故障排查](#troubleshooting)。

## 选择 AI 可以使用哪些工具

工具分成八类。要选择 Marinara 可以使用哪几类，打开 **Settings → Devices & Services**，点击 **Marinara Engine**，再点击 **Configure**(配置)。这里有两个选项：

- **Primary Chat**(主聊天)：Home Assistant 服务默认作用的聊天。
- **Exposed Tool Categories**(开放的工具类别)：允许 Marinara 使用的类别。

| 类别 | 默认 | 工具 |
| --- | --- | --- |
| Lights & Switches(灯光与开关) | 开启 | ha_turn_on, ha_turn_off, ha_toggle, ha_set_brightness, ha_set_color, ha_set_color_temp |
| Climate(温控) | 开启 | ha_set_temperature, ha_set_hvac_mode |
| Covers (Blinds & Garage)(遮挡设备：窗帘与车库门) | 开启 | ha_open_cover, ha_close_cover, ha_set_cover_position |
| Locks(门锁) | 关闭 | ha_lock, ha_unlock |
| Media Players(媒体播放器) | 开启 | ha_media_play, ha_media_pause, ha_set_volume |
| Scenes & Scripts(场景与脚本) | 开启 | ha_activate_scene, ha_run_script |
| Query(查询) | 开启 | ha_get_state, ha_list_areas, ha_list_entities, ha_notify |
| Generic Service Calls (Advanced)(通用服务调用：进阶) | 关闭 | ha_call_service |

> **警告：** **Generic Service Calls (Advanced)** 允许 AI 调用任意 Home Assistant 服务。**Locks** 允许它给门上锁和解锁。两者默认都是关闭的，确实需要时再开启。

多数工具既接受单个设备，也接受房间名。给的是房间名时，工具会作用于那个房间里所有匹配的设备。类别的改动要等你按下 **Marinara Sync HA Tools** 或重启 Home Assistant 之后才生效。

## Home Assistant 里的实体

集成会在名为 **Marinara Engine** 的设备下创建这些实体。

| 实体 | 类型 | 作用 |
| --- | --- | --- |
| Marinara Chat Count | 传感器 | Marinara 聊天的总数 |
| Marinara Active Agent Count | 传感器 | 有多少个 Marinara 智能体处于启用状态 |
| Marinara Active Chat | 选择器 | 选择服务作用于哪个聊天 |
| Marinara Agent: (name) | 开关 | 开启或关闭某一个智能体，每个智能体一个开关 |
| Marinara Abort Generation | 按钮 | 取消正在生成的 AI 回复 |
| Marinara Sync HA Tools | 按钮 | 重新发送全部工具，并重建 Home Assistant 智能体 |

集成每 30 秒向 Marinara 查询一次新增的聊天和智能体，所以刚建好的东西最多要等 30 秒才会出现。

### 改过设置之后重新同步

在 **Marinara Engine** 的设备页面上按 **Marinara Sync HA Tools**。它会就地更新已有的工具；如果你删掉了 **Home Assistant** 智能体，会重新建好它；已关闭类别下的工具会被禁用（不会删除）。不要在 Marinara 里手动编辑这些 Home Assistant 工具。下一次同步会覆盖你的改动，并把工具重新开启。

## 从自动化控制 Marinara

集成为自动化添加了两个 Home Assistant 服务。它们在 Home Assistant 里运行，而不是在 Marinara 里。两个服务默认都作用于 **Primary Chat**。

### Send Message (marinara_engine.send_message)

- `message`：消息正文，必填。
- `chat_id`：发给哪个聊天。留空则使用 Primary Chat。
- `role`：`user`、`assistant`、`system` 或 `narrator`，默认是 `user`。
- `trigger_generation`：设为 true 时，AI 也会回复。默认是 false。

下面这个自动化会在前门打开时告诉 AI：

```yaml
automation:
  trigger:
    platform: state
    entity_id: binary_sensor.front_door
    to: "on"
  action:
    service: marinara_engine.send_message
    data:
      message: "Someone has arrived at the front door."
      trigger_generation: true
```

### Trigger Generation (marinara_engine.trigger_generation)

这个服务不发出可见消息，直接让 AI 开始回复。

- `chat_id`：使用哪个聊天。留空则使用 Primary Chat。
- `user_message`：可选，随这一轮回复一起带上的消息。

<a id="troubleshooting"></a>

## 故障排查

### 设置表单提示连不上

确认 Marinara 正在运行，并且 **Host** 和 **Port** 与它实际监听的地址一致（默认是 `localhost` 和 `7860`）。如果 Home Assistant 在另一台设备上，除非这台设备在 `IP_ALLOWLIST` 里，否则 Marinara 会拦截它。集成没办法发送密码，所以设了登录保护的 Marinara 也会拒绝它。见[远程访问](../REMOTE_ACCESS.md)。设置完成之后，这些规则依然有效。如果 Marinara 后来拦截了这台设备，传感器和聊天列表会悄无声息地停止更新。

### AI 调用了设备工具，却什么都没发生

多半是 webhook 调用被拦下了。在 `.env` 里加上 `WEBHOOK_LOCAL_URLS_ENABLED=true` 并保存。少了这一项，工具调用可能失败，报错内容大意是不允许 `http`，或者拒绝私有地址。如果 Marinara 和 Home Assistant 在同一台机器上，集成会自动使用内部地址。如果 Marinara 在另一台设备上，要确保从那台设备能访问到 Home Assistant 的局域网地址。

### Functions 里看不到这些工具

按一下 **Marinara Sync HA Tools**，或者重启 Home Assistant，然后到 Presets 面板的 **Functions** 里查看。

### 聊天里没有 Home Assistant 智能体

先确认 Marinara 的 Agents 下面确实有这个智能体。如果没有，按 **Marinara Sync HA Tools** 重建它。然后在 **Chat Settings → Agents**(聊天设置 → 智能体) 里把它加进聊天。

### 手动查找 webhook 地址

每个工具都已经填好了地址，一般用不上这一步。在 Home Assistant 里打开 **Settings → Devices & Services → Marinara Engine**(设置 → 设备与服务 → Marinara Engine)。webhook 地址的格式如下，其中 8123 是 Home Assistant 的默认端口：

```text
http://<homeassistant-ip>:8123/api/webhook/<webhook-id>
```

## 卸载

在 Home Assistant 的 **Settings → Devices & Services → Marinara Engine** 里删除这个集成。这会删掉那些实体。Marinara **Functions** 部分里的工具和 **Home Assistant** 智能体仍会保留。不再需要的话，在 Marinara 里手动删掉它们。

## 相关指南

- [自定义工具](../extending/custom-tools.md)
- [智能体概览](../agents/agents-overview.md)
- [服务器配置](../CONFIGURATION.md)
- [远程访问](../REMOTE_ACCESS.md)
