# 自定义工具与函数调用

自定义工具（也叫函数）能让 AI 在聊天过程中执行一个小动作。这个动作可以返回一段固定文字、请求一个网址，或者在服务器上运行一小段脚本。想让 AI 去查询或计算某样东西、而不是靠猜的时候，就用自定义工具。

函数调用就是 AI 请求应用执行一个动作，再把结果用到回复里。Marinara 本身已经内置了一些工具，比如掷骰、世界书搜索和游戏状态更新。你的自定义工具与它们并列工作。自定义工具不挂在角色卡上。你要为某个聊天开启它，或者把它挂到智能体（在聊天旁边运行的辅助程序）上。

> **注意：** 工具需要支持它们的连接。Claude 和 Grok 的订阅连接会忽略工具定义，因此 **Chat Settings**(聊天设置) 会显示提示，并为这些连接禁用工具控件。文本命令和骰子标签仍然可用。

## 创建工具

开始之前，从顶栏打开 **Presets**(预设) 面板。工具位于它的 **Functions**(函数) 区块（扳手图标）。如果你从另一台设备打开 Marinara，先在 **Settings → Advanced → Admin Access**(设置 → 高级 → 管理员访问) 下保存管理员密钥。它必须与服务器的 `ADMIN_SECRET` 一致；见[服务器配置参考](../CONFIGURATION.md)。

第一次尝试时，选 **Static Result**(静态结果)：它不需要任何其他东西。

### 创建工具的步骤

1. 打开 **Presets**，找到 **Functions**。
2. 点击 **Create function**(创建函数)（加号图标）。一个空白的工具编辑器会打开。
3. 用小写 snake_case 填一个名称，例如 `check_weather`。AI 调用时用的就是这个确切的名称。名称以小写字母开头，之后使用小写字母、数字和下划线。
4. 填写 **Description**(说明)。把它写成给 AI 的指令，因为 AI 要靠它判断何时调用该工具。例如：`Get the current weather for a city the user names.`
5. 添加工具需要的参数（见[添加参数](#add-parameters)）。
6. 选择一个 **Execution Type**(执行类型)：**Static Result**、**Webhook** 或 **Script**(脚本)。
7. 填写该类型对应的字段（见[选择执行类型](#choose-an-execution-type)）。
8. 点击 **Save**(保存)。按钮附近会闪现绿色的 **Saved** 提示。

名称和说明的规则：

- 名称为 1 到 100 个字符，说明为 1 到 500 个字符。
- 两个工具不能重名，工具也不能使用内置名称，例如 `roll_dice`、`update_game_state`、`set_expression`、`trigger_event`、`search_lorebook`、`web_search` 或 `update_about_me`。名称冲突时会显示类似 `"your_name" is a reserved built-in tool name.` 的消息。
- 如果你带着未保存的改动离开编辑器，会出现一条横幅，提供 **Keep editing**(继续编辑)、**Discard**(放弃) 或 **Save & close**(保存并关闭)。

**Functions** 标题栏有三个图标按钮：

- **Create function**，即加号图标
- **Import functions from ZIP or JSON**(从 ZIP 或 JSON 导入函数)
- **Export functions to ZIP**(导出函数为 ZIP)（没有任何工具时显示为灰色）

列表中的每个工具显示：

- 名称、类型、参数个数和说明
- 一个开关
- **Edit function**(编辑函数) 和 **Delete Function**(删除函数)

拖动工具的手柄可以调整列表顺序。顺序只影响显示。没有任何工具时，列表显示 **No functions yet**。

<a id="add-parameters"></a>

## 添加参数

参数是 AI 调用你的工具时传入的输入。每个参数都有名称、类型、必填标记和说明。

1. 在 **Parameters**(参数) 分组中点击 **Add Parameter**(添加参数)。
2. 填一个名称，例如 `city`。
3. 选择类型：`string`、`number`、`boolean`、`array` 或 `object`。
4. 如果 AI 每次都必须传这个值，就开启 **Required**(必填)。
5. 写一段说明，告诉 AI 这个值代表什么，例如 `The city name to look up, such as Tokyo.`

用 **Add Parameter** 再加几行，或者用某行的减号按钮删掉这一行。名称为空的行会在保存时被丢弃。

如果 AI 似乎从不调用某个导入的工具，可能是它的参数不合法，这时应用会跳过该工具，而且不会告诉你。删掉这些参数，再手动重新添加。

<a id="choose-an-execution-type"></a>

## 选择执行类型

### Static Result

**Static Result** 工具每次都返回同一段文字。它不需要任何外部服务。它的卡片上写着 **Returns a fixed string when called.**

唯一的字段是 **Static Result**，一个多行文本框。如果留空，工具会返回 `OK`。

示例：一个名为 `store_hours`、没有参数的工具，**Static Result** 填写如下：

```text
We are open Monday to Friday, 9am to 5pm. We are closed on weekends.
```

AI 调用 `store_hours` 时，会收到这段文字，连同工具名和它传过去的参数，然后就能把你的营业时间告诉用户。

### Webhook

**Webhook** 工具会把调用发送到一个网址，再把该服务的回复交给 AI。Webhook 是一个能接收数据并返回数据的地址。它的卡片上写着 **Sends a POST request to an external URL.**

唯一的字段是 **Webhook URL**。应用会发送一个 POST 请求，这是向网络服务发送数据的一种方式。请求体是 JSON，一种表示结构化数据的纯文本格式，形式如下：

```json
{ "tool": "your_tool_name", "arguments": { ... } }
```

如果你开启了 **Include hidden chat context**(附带隐藏的聊天上下文)，请求体中还会有一个 `context` 值。服务以 JSON 或纯文本回复，这份回复会交回给 AI。

示例：一个名为 `check_weather` 的工具，带一个必填的字符串参数 `city`，**Webhook URL** 填写如下：

```text
https://api.example.com/weather
```

AI 以 `city` 为 Tokyo 调用它时，你的服务会查好天气并回复，AI 再把这份回复用在它的消息里。

限制：

- 回复上限为 512 KB。
- 每次调用都有时间上限。默认为 60 秒（`CUSTOM_TOOL_TIMEOUT_MS`）。
- 默认只允许 `https://` 地址。私有地址和本地地址（例如 `localhost` 或家庭网络地址）会被拦下，直到服务器管理员放行。见[服务器配置参考](../CONFIGURATION.md)。
- 如果调用失败或超时，AI 会收到一个错误结果，聊天照常继续。

如果没有成功：检查地址是否以 `https://` 开头，并且能够访问。除非管理员放行，否则本地地址会一直被拦下。响应慢的服务可能会撞上 60 秒的时间上限。

### Script

**Script** 工具会在服务器上运行一小段 JavaScript 并返回结果。JavaScript 是一种常见的编程语言。它的卡片上写着 **Runs a JavaScript expression server-side.**

脚本工具默认关闭。如果你的服务器没有开启它们，**Script** 卡片会变灰，并显示一个琥珀色的 **Script disabled** 标记。要开启脚本工具，服务器管理员需要在服务器的 `.env` 文件中加入这一行，然后重启 Marinara：

```text
CUSTOM_TOOL_SCRIPT_ENABLED=true
```

唯一的字段是 **Script Body**(脚本正文)。脚本读取 `args`(AI 传来的值)，并且必须 `return` 一个结果。可以使用 `JSON`、`Math` 和 `Date`。

示例：一个名为 `add_numbers` 的工具，带两个必填的数字参数 `x` 和 `y`，**Script Body** 填写如下：

```js
const result = args.x + args.y;
return { sum: result };
```

AI 以 `x` 为 2、`y` 为 3 调用它时，工具返回的和为 5。如果脚本抛出错误，AI 会收到一个错误结果。

脚本会在你的服务器上运行真实代码，运行环境是一个沙箱（一块隔离出来、限制代码能做什么的区域）：

- 不能访问网络，也不能访问文件。
- 不能访问环境变量或服务器机密。
- 有时间上限。默认为 60 秒。

沙箱并不是完整的操作系统级隔离。能创建工具的人仍然可以写出浪费 CPU 或内存的脚本。只在你信任的服务器上开启脚本工具，对别人写的脚本也要多加小心。

如果没有成功：**Script** 卡片显示为灰色时，请管理员设置 `CUSTOM_TOOL_SCRIPT_ENABLED=true` 并重启。

### 附带隐藏的聊天上下文

**Webhook** 和 **Script** 工具可以接收额外的聊天数据，AI 不会把这些数据当作工具输入看到。在工具编辑器中开启 **Include hidden chat context**，它默认是关闭的。之后你的工具会收到一个 `context` 值，其中可能包括：

- 聊天模式
- 当前用户角色的名字和各角色的名字
- 已保存的聊天变量
- 在 Game Mode(游戏模式) 中，还有游戏状态

这样工具就能把结果个性化，而不必让 AI 把这些数据全部传一遍。

## 为聊天开启工具

创建了工具，AI 并不会因此就去使用它。你还需要为聊天开启工具调用。

1. 打开一个聊天，然后打开 **Chat Settings**。
2. 打开 **Function Calling**(函数调用) 区块（扳手图标）。
3. 开启 **Enable Tool Use**(启用工具调用)。它的说明写着 **Allow AI to call functions (dice rolls, game state, etc.)**。新聊天默认关闭此项。
4. 检查是否生效：问 AI 一个你的工具能回答的问题，比如针对 `store_hours` 示例问“你们的营业时间是几点？”，回复里应该会用上工具的文字。

开启 **Enable Tool Use** 且下方没有添加任何工具时，聊天可以使用所有全局启用、且它支持的工具：内置工具，加上每个在 **Functions** 中开关已开启的自定义工具。Game 聊天要使用 `search_lorebook`，还需要开启 **Let the GM search lore**(允许 GM 搜索世界设定)。

要把聊天限定在一组选定的工具：

1. 点击 **Add Functions**(添加函数)。会打开一个选择器，其中的搜索框只匹配工具名称。
2. 勾选你想要的工具。列表中内置工具和自定义工具混在一起。
3. 点击 **Add Selected**(添加选中项)。

一旦添加了任何工具，该聊天中就只有这些工具可用。选择器里的 **New Custom Function**(新建自定义函数) 会跳转到工具编辑器。

Game 聊天可以为工具规划使用单独的连接。其费用和行为见[可选的工具规划与世界设定搜索](../game/getting-started.md#optional-tool-planning-and-lore-searches)。

如果没有成功：确认 **Enable Tool Use** 已开启；如果你添加过具体工具，确认该工具在聊天的列表里；并确认该工具在 **Functions** 中的开关已开启。把 **Description** 和参数说明写得更清楚，能帮助 AI 判断何时调用它。

## 把工具挂到智能体上

你也可以把工具交给智能体，而不是交给聊天。

1. 打开 **Agents**(智能体) 面板，打开一个智能体。
2. 打开它的 **Tools / Function Calling**(工具/函数调用) 分组。
3. 开启该智能体可以使用的工具。

你仍然需要在聊天的 **Function Calling** 区块中开启 **Enable Tool Use**。智能体编辑器的底部会提醒你这一点。关于智能体的一般介绍，见[创建自定义智能体](../agents/custom-agents.md)。

## 导出与导入工具

- 要导出单个工具，打开它并点击 **Export function**(导出函数)。这会保存一个 `.json` 文件。
- 要导出全部工具，点击 **Export functions to ZIP**。
- 要导入，点击 **Import functions from ZIP or JSON**，选择一个 `.json` 或 `.zip` 文件。会有一条消息报告导入了多少个工具。

导入的 Webhook 和脚本工具一律以关闭状态保存，**Include hidden chat context** 也是关闭的，即使文件要求开启其中任何一项。随后 Marinara 会显示类型、Webhook 地址和文件请求的权限。逐个打开导入的工具，检查它，只有在你信任它时才开启。Static 工具会保留导入时的开关状态。

导入时，名称与现有工具或内置工具冲突的工具会被跳过。智能体包不会打包自定义工具：单独导出并检查它们，导入智能体之后再把它们挂上去。

## 相关指南

- [创建自定义智能体](../agents/custom-agents.md)
- [Home Assistant 集成](../integrations/home-assistant.md)
- [服务器配置参考](../CONFIGURATION.md)
