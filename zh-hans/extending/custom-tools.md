# 自定义工具与函数调用

本指南介绍 Marinara Engine 里的自定义工具，也就是界面上说的 Functions。自定义工具能让 AI 在聊天过程中执行一个小动作：返回一段固定文字、请求外部网址，或者在服务器上跑一小段脚本。下面会讲怎么做一个工具、怎么给聊天开启工具调用，以及怎么安全地使用脚本工具。

## 什么是函数调用

函数调用就是让 AI 请求应用执行一个动作，再把结果用到回复里。应用本身已经内置了一批工具，比如掷骰、世界书搜索、游戏状态更新。自定义工具和这些内置工具并列，同属一套 **Function Calling**(函数调用) 机制。

自定义工具适合做这类事情：

- 返回一段固定内容，比如营业时间或一套自定规则。
- 向外部服务查询实时数据，比如天气或某个智能家居设备的状态。
- 做一次简单计算，比如求和或者算出一个自定义结果。

自定义工具不挂在角色卡上。要用它，得给某个聊天开启，或者把它挂到智能体上。智能体是在聊天旁边运行的一个助理程序。这两条路子下面都会讲到。

原生函数调用需要支持工具的连接。Claude 和 Grok 的订阅传输方式会忽略原生工具定义，因此 **Chat Settings**(聊天设置) 会显示可用性提示，并禁用这些连接的工具控件。它们的文本命令和骰子标签仍然可用。Game 聊天可以单独选择工具规划连接，费用与行为见[可选的工具规划与世界设定搜索](../game/getting-started.md#optional-tool-planning-and-lore-searches)。

如果已启用的世界书条目具有兼容的向量，世界书搜索就会按语义排序。语义搜索不可用时，Conversation 和 Roleplay 会保留文本匹配。Game 的世界设定搜索需要单独开启，并会报告向量缺失或不兼容；它不会自动为世界书进行向量化。

## Functions 区块

自定义工具在 **Presets**(预设) 面板里创建和管理。

1. 打开顶栏，点击 **Presets**。
2. 找到 **Functions**(函数) 区块，图标是一把扳手。
3. 标题下方会看到一行说明 **Custom function calls available from Chat Settings**。

区块标题栏上有三个图标按钮：

- **Create function**(创建函数)，加号图标，打开一个空白的工具编辑器。
- **Import functions from ZIP or JSON**(从 ZIP 或 JSON 导入函数)，下载图标，打开文件选择器。
- **Export functions to ZIP**(导出函数为 ZIP)，上传图标，把所有工具存成一个文件。一个工具都没有时这个按钮是灰的。

列表里每个工具会显示名称和两个小标记（类型和参数个数），下面是一段简短说明，右侧有开关、**Edit function**(编辑函数) 按钮和 **Delete function**(删除函数) 按钮。如果服务器上关闭了脚本工具，**Script** 类型的工具还会多出一个琥珀色的 **Script disabled** 标记，开启方法见下面的“执行类型：Script”。拖动工具左侧的手柄可以调整顺序，顺序只影响显示，不影响行为。一个工具都没有时，列表显示 **No functions yet**。

管理工具（创建、编辑、删除、排序以及那个开关）走的是应用中受保护的一部分接口。如果不是在运行服务器的那台电脑上操作，而是换了别的设备，就必须先保存一个管理员密钥。参见[服务器配置参考](../CONFIGURATION.md)，以及下面“脚本安全”里的说明。

## 创建工具

按以下步骤做一个工具。

1. 在 **Functions** 区块点击 **Create function**，完整的工具编辑器会打开。
2. 在顶部的名称输入框里填一个小写 snake_case 名字。AI 调用工具时用的就是这个名字，必须一字不差。合法的名字以小写字母开头，之后只能用小写字母、数字和下划线。例如 `check_weather`。
3. 填写 **Description**(说明) 输入框。这段话要当成写给 AI 的指令来写，因为 AI 就是靠它判断什么时候该调用这个工具。例如 `Get the current weather for a city the user names.`
4. 添加工具需要的 **Parameters**(参数)，见下一节。
5. 选一个 **Execution Type**(执行类型)：**Static Result**、**Webhook** 或 **Script**。
6. 填写所选类型对应的那个输入框。
7. 点击 **Save**(保存)。按钮附近应该会闪出绿色的 **Saved** 提示。

几条需要知道的规则：

- 名称长度为 1 到 100 个字符，说明为 1 到 500 个字符。
- 两个工具不能重名，也不能占用内置工具的名字，见下面的“保留名称”。
- 改动没保存就离开编辑器时，会弹出一条横幅，提供 **Keep editing**、**Discard** 和 **Save & close** 三个选项。

## 参数构建器

参数就是 AI 调用工具时传进来的输入。每个参数都有名称、类型、是否必填和说明四项。

1. 在 **Parameters** 分组里点击 **Add Parameter**(添加参数)。
2. 填一个参数名，比如 `city`。
3. 从下拉菜单里选类型：`string`、`number`、`boolean`、`array` 或 `object`。
4. 如果 AI 每次都必须传这个值，就开启 **Required**(必填)。
5. 写一段说明，告诉 AI 这个值代表什么。例如 `The city name to look up, such as Tokyo.`

继续点 **Add Parameter** 可以再加一行，点某行的减号按钮可以删掉这一行。名称留空的行在保存时会被丢弃。参数说明写得好很重要，AI 全靠它判断该传什么。

如果一个工具怎么都不被调用，参数配置出问题是常见原因。这种情况多半出现在导入手工改过的文件、参数配置不合法的时候。此时应用会在生成过程中悄悄跳过这个工具，只往服务器日志里写一条记录。

## 执行类型：Static Result

**Static Result**(静态结果) 类型的工具每次被调用都返回同一段固定文字。它不依赖任何外部服务，谁都能直接用。它的卡片上写着 **Returns a fixed string when called.**

唯一的输入框是 **Static Result**，一个多行文本框。填进去的内容会在 AI 调用工具时原样返回。留空的话，工具返回 `OK`。

举个完整的例子。做一个名叫 `store_hours` 的工具，参数列表留空。在 **Static Result** 框里填：

```
We are open Monday to Friday, 9am to 5pm. We are closed on weekends.
```

这样，AI 调用 `store_hours` 时就会拿回这段文字，然后把营业时间告诉用户。AI 看到的是这段文字连同工具名和它传过去的参数，而不是孤零零的一行内容。

## 执行类型：Webhook

**Webhook** 类型的工具会把这次工具调用发到一个外部网址，再把那个服务的回复交给 AI。Webhook 就是一个能接收数据、也能返回数据的网址。它的卡片上写着 **Sends a POST request to an external URL.**

唯一的输入框是 **Webhook URL**。应用会向这个地址发送 POST 请求。POST 请求是一种向网络服务发送数据的方式。请求体是 JSON，一种表示结构化数据的纯文本格式，形式如下：

```
{ "tool": "your_tool_name", "arguments": { ... } }
```

服务端应该返回 JSON 或纯文本，这份回复会被交给 AI。

举个完整的例子。做一个名叫 `check_weather` 的工具，带一个必填的字符串参数 `city`。把 **Webhook URL** 填成自己的服务地址：

```
https://api.example.com/weather
```

AI 以 `city` 为 Tokyo 调用 `check_weather` 时，你的服务会收到请求，查好天气并返回。AI 随后把这份回复写进消息里。

关于 Webhook 还要注意几点：

- 返回内容上限为 512 KB。
- 每次调用都有服务器设定的时间上限，默认 60 秒。
- 默认只允许 `https://` 开头的地址。私有地址和本地地址（比如 `localhost` 或家庭网络里的地址）会被拦下。要放行本地地址，需要服务器管理员开启一个设置项，参见[服务器配置参考](../CONFIGURATION.md)。
- 调用失败或超时不会让聊天崩掉，AI 会收到一个错误结果。

## 执行类型：Script

**Script**(脚本) 类型的工具会在服务器上运行一小段 JavaScript 并返回结果。JavaScript 是一种常见的编程语言。它的卡片上写着 **Runs a JavaScript expression server-side.**

出于安全考虑，脚本工具默认是关闭的。如果服务器没有开启，**Script** 卡片会变灰并显示一条警告。要开启脚本，服务器管理员需要在服务器的 `.env` 文件里加上这一行，然后重启应用：

```
CUSTOM_TOOL_SCRIPT_ENABLED=true
```

唯一的输入框是 **Script Body**(脚本正文)。脚本里可以读取 `args`(AI 传来的那些值)，并且必须 `return` 一个结果。此外还能用 `JSON`、`Math` 和 `Date`。

举个完整的例子。做一个名叫 `add_numbers` 的工具，带两个必填的数字参数 `x` 和 `y`。在 **Script Body** 框里填：

```
const result = args.x + args.y;
return { sum: result };
```

AI 以 `x` 为 2、`y` 为 3 调用 `add_numbers` 时，工具返回的和是 5。脚本抛出异常也不会导致崩溃，AI 会收到一个错误结果。开启脚本之前先读一遍下面的“脚本安全”。

## 附带隐藏的聊天上下文

**Webhook** 和 **Script** 两类工具都可以接收一个隐藏的上下文对象，里面是额外的聊天数据，AI 并不会把它当作工具输入看到。在工具编辑器里开启 **Include hidden chat context**(附带隐藏的聊天上下文) 开关即可，默认关闭。

开启之后，Webhook 或脚本除了参数还会收到一个 `context` 值，其中可能包含聊天模式、当前用户角色的名字，以及聊天中的角色名，也可能包含已保存的聊天变量，在 Game Mode(游戏模式) 下还包含游戏状态。这样工具就能自己把结果个性化，不必让 AI 把这些数据全部传一遍。

## 给聊天开启工具调用

工具建好了，AI 并不会自动使用，还得给这个聊天开启工具调用。

1. 打开一个聊天，点击齿轮图标进入 **Chat Settings**(聊天设置)。
2. 展开 **Function Calling** 区块，图标是一把扳手。
3. 开启 **Enable Tool Use**(启用工具调用)，它的说明写着 **Allow AI to call functions (dice rolls, game state, etc.)**。新聊天默认是关闭的。

只开了 **Enable Tool Use**、下面没有添加任何工具时，这个聊天可以使用所有全局启用的工具，也就是掷骰、世界书搜索这些内置工具，加上在 **Functions** 区块里开启了开关的每个自定义工具。想把某个聊天限定在指定的一组工具上，就添加具体的工具：

1. 点击 **Add Functions**(添加函数)，会打开一个带搜索框的选择器。
2. 勾选需要的工具。列表里内置工具和自定义工具是混在一起的。
3. 点击 **Add Selected**(添加选中项) 添加。

只要添加了一个以上的工具，这个聊天就只能用这些工具了。在选择器里点 **New Custom Function**(新建自定义函数) 可以直接跳到工具编辑器。选择器的搜索框只匹配工具名称，不匹配说明。

## 把工具挂到智能体上

工具也可以给智能体用，而不是给聊天用。智能体是在生成过程中运行的半自主助理程序，比如世界书管理员，或者负责挑音乐的那种。

1. 打开 **Agents**(智能体) 面板，点开一个智能体。
2. 展开它的 **Tools / Function Calling** 分组。
3. 把想让这个智能体使用的工具逐个开启。

即使配好了智能体，聊天的 **Function Calling** 区块里的 **Enable Tool Use** 仍然要开启。这里有个措辞问题需要留意：智能体编辑器底部的说明文字让你启用“Enable Function Calling”，而实际要点的开关叫 **Enable Tool Use**，两者指的是同一个控件。想更完整地了解智能体，参见[创建自定义智能体](../agents/custom-agents.md)。

## 脚本安全

**Script** 工具会在服务器上运行真实代码，所以要谨慎对待。应用会把每段脚本放进沙箱里运行。沙箱是一块隔离出来的区域，用于限制代码能做的事。限制如下：

- 不能访问网络。脚本无法访问互联网或任何网址。
- 不能访问文件。脚本无法读写服务器上的文件。
- 不能访问环境变量和服务器上的机密信息。
- 有时间上限。运行太久的脚本会被终止，默认上限是 60 秒。

这套机制能防住失误，也挡住了网络和文件访问，但它不是完整的操作系统级隔离。有权限创建工具的人，仍然可以写出一段消耗服务器 CPU 或内存的脚本。只在你信任的服务器上开启脚本工具，导入别人写的脚本工具时也要格外小心。

从别的设备管理工具同样受保护。如果不在运行服务器的那台电脑上，需要在 **Settings**(设置) → **Advanced**(高级) → **Admin Access**(管理员访问) 下保存一个管理员密钥。这个密钥必须和服务器上的设置一致。服务器端的配置参见[服务器配置参考](../CONFIGURATION.md)。

## 导出与导入

工具可以在不同安装之间搬运。

- 导出单个工具：打开它，点击 **Export function**(导出函数)，会保存成一个 `.json` 文件。
- 导出全部工具：在 **Functions** 区块点击 **Export functions to ZIP**。
- 导入：点击 **Import functions from ZIP or JSON**，选一个 `.json` 或 `.zip` 文件，随后会有一条消息报告导入了多少个工具。

导入的 Webhook 和 Script 工具一律以关闭状态保存，**Include hidden chat context** 也一律关闭，哪怕文件里要求开启其中任意一项。导入完成后，Marinara 会显示执行类型、适用时 Webhook 的目标地址，以及文件请求的权限。逐个打开导入的可执行工具，检查其内容，确认信任后再开启。Static 类型的工具会保留文件里的启用状态。

导入时，名称和已有工具或内置工具冲突的会被跳过。智能体包不会打包也不会导入自定义工具：单独导出你信任的函数，在 **Function Calls** 里逐个检查，导入智能体之后再手动挂上去。

## 保留名称

自定义工具的名称不能和内置工具重名。内置名称包括 `roll_dice`、`update_game_state`、`set_expression`、`trigger_event`、`search_lorebook`、`web_search`、`update_about_me` 等等。用了保留名称去保存，会看到这条消息：

```
"your_name" is a reserved built-in tool name.
```

两个自定义工具之间同样不能重名。重复使用名称时会提示已存在同名工具。

## 故障排查

AI 从来不调用我的工具。

- 确认聊天的 **Function Calling** 区块里 **Enable Tool Use** 已经开启。
- 如果给这个聊天添加过具体工具，确认你的工具在那份列表里。
- 确认 **Functions** 区块里这个工具自己的开关是开启的。
- 把 **Description** 和参数说明写得更清楚一些，让 AI 知道什么时候该调用它。
- 如果工具是导入进来的，参数配置有问题会让应用跳过它。手动把参数重建一遍。

Script 卡片是灰的。

- 这台服务器上脚本是关闭的。让管理员设置 `CUSTOM_TOOL_SCRIPT_ENABLED=true` 并重启，参见[服务器配置参考](../CONFIGURATION.md)。

我的 Webhook 失败或超时。

- 确认地址以 `https://` 开头，并且能访问得到。
- 除非管理员放行了本地地址，否则本地地址会被拦下，参见[服务器配置参考](../CONFIGURATION.md)。
- 响应慢的服务可能会撞上 60 秒的时间上限。

我没法在手机或别的设备上创建、编辑工具。

- 在 **Settings** → **Advanced** → **Admin Access** 下保存一个与服务器一致的管理员密钥。

## 相关指南

- [创建自定义智能体](../agents/custom-agents.md)
- [Home Assistant 集成](../integrations/home-assistant.md)
- [服务器配置参考](../CONFIGURATION.md)
