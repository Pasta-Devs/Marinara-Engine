# 可选智能体包与能力包

状态：已在 v2.3.0 开发周期内实现，对应 issue #3612。

## 目标

Marinara Engine 的基础发行版不编译、也不附带任何可选的智能体实现和能力实现。全新安装的应用里没有任何可选包。从旧版本升级时，这套包机制引入之前就已具备的能力会全部保留。

官方目录、包源码、可复现的产物、校验脚本和贡献流程都放在 [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents)。安装后的产物存放在配置好的 Marinara 数据目录下面，这样应用更新就不会覆盖它们。

## 包模型

一个智能体包可以提供一个或多个声明式智能体，以及可选的受信任可执行能力：

- 服务器端入口点：路由、生命周期钩子、提示词提供方、结果处理器、存储迁移；
- 客户端入口点：面板、聊天界面、设置区块、设置向导中的选项、运行时显示内容；
- 共享的 JSON 结构定义和稳定的通信契约；
- 包自带的资源文件、文档和 Professor Mari 知识片段。

包面向的是带版本号的 Marinara 能力 API，不允许从引擎导入私有源码路径。

客户端的能力组件通过自身的 `lang`、`dir` 属性和 `capabilityProps.localization` 对象拿到 Engine 当前选中的界面语言。包自带的界面维护自己的语言文件，缺失时回退到包内的英文；Engine 不翻译包的提示词，也不翻译包自己写死的机器可读值。切换语言时复用现有的 `marinara-capability-props` 事件，已安装的界面无需重启 Engine 就能重新渲染。

### 交付和缓存

已安装的包文件会带上强验证器，它们来自清单中每个文件的 SHA-256 哈希；Engine 每次读取时也会用这些值重新验证字节。客户端包(`/api/capability-packages/<id>/client`)和每个包资源都会始终重新验证(`no-cache` 加 `ETag`)。未变化的文件会返回 `304 Not Modified`，不会重新下载；重新发布的文件则会立即被取用。任何内容都不会以 `immutable` 方式提供：安装政策允许使用不同字节重新发布同一版本，因此包 URL 并不是内容寻址 URL。

Capability API 1.1 在服务器端的激活上下文里加了一层通用的运行时门面。包可以读取当前生效的智能体调试状态，也可以通过 Engine 的 Pino 日志器写日志，包括显式覆盖调试模式，全程不需要导入私有的日志模块或运行时配置模块。这层门面只暴露操作，不暴露 Engine 内部对象。

Capability API 1.2 加入了事务范围内的聊天/消息操作、范围收窄的聊天元数据写入和世界书条目存在性读取，以及空间快照兼容存储。包可以在一个 Engine 事务内校验领域数据的变更，并把元数据与所属消息、备选回复或空间快照一起原子提交，全程拿不到数据库句柄或数据表对象。回滚和历史存储兼容由 Engine 负责，校验和领域规则由包负责。同一套 API 还提供归一化后的聊天记录和角色记录、可用世界书条目的筛选、类 JSON 响应的解析，以及解析完成的语言模型调用。连接凭据、服务商实现、数据库句柄和存储对象始终只属于 Engine 内部。

### Capability API 1.7 的聊天分支

Capability API 1.7 给 `CapabilityChatRecord` 增加了归一化的分支元数据：

```ts
branch: {
  title: string | null;
  parentChatId: string | null;
  parentMessageId: string | null;
  childMessageId: string | null;
} | null;
```

`title` 是持久化保存、去掉首尾空白后的分支名。根聊天返回 `null`。由 Engine 创建且可识别的分支会给出直接父聊天、分支来源的那条消息，以及复制出来的子消息。空分支的消息锚点为 null。旧版分支、元数据损坏的分支，以及导入进来、关系无从判断的群聊同级分支，血缘字段一律返回 null，Engine 不去推断历史关系。通用的导出/导入会省略父级 ID 和消息 ID，因为这些 ID 在不同安装之间并不相同。删除父级不会影响子级的血缘信息。

### Capability API 1.8 的 Game Experience

Capability API 1.8 增加了包提供的 Game Experience、每个 Game 回合的提示词上下文和资源写入。

包可以提供完整的 Game Mode，而不仅是内置模式的附加功能。它声明 `game-surface` 槽位，并在创建游戏时从设置向导的 Experiences 区块中选择。选择会记录到游戏中，并在整个游戏生命周期内保持不变，因此不会在游戏进行途中切换 Experience。该界面会在共享旁白之上绘制自己的 HUD、菜单和战斗，并声明要替换哪些内置系统。没有声明的功能会保留内置实现，所以 Experience 只会退出自己确实实现的部分。可选的 `contributions.gameSurface.surfaceClass` 指定界面挂载期间由 Engine 应用到游戏区域的类名，让包的样式表能够调整在自身元素之外渲染的共享界面。

持有 `prompt-context` 权限的包可以向每个生成的 Game 回合的系统提示词贡献文本。拥有实时状态的包因此能让模型与玩家眼前的内容保持一致。贡献项还可以声明它替换了哪些内置游戏系统；Engine 随后会停止指示模型驱动这些系统。贡献项按回合收集，而且从不是必需项：没有返回内容的贡献项会被跳过；抛出错误或没有在截止时间内完成的贡献项会被记录并跳过，不会影响生成。

资源门面在读取之外还提供写入，所以包的设置流程可以查找或创建玩家的用户角色及其世界书。存储、验证和身份信息仍由 Engine 管理；领域内容仍由包管理。

### Capability API 1.10 的包资源

Capability API 1.10 增加了包自有静态资源的通用交付方式。清单可以声明 `contributions.assets.paths`，即包内最多 256 个图像(`png`/`webp`/`gif`/`jpg`/`jpeg`)和 JSON 文件的允许列表。Engine 通过 `/api/capability-packages/<id>/assets/<path>` 提供这些文件，并使用与浏览器标签图标完全相同的验证链：路径限制、`files[]` 中的哈希成员关系、被动内容类型允许列表，以及每次读取时重新验证完整性。架构会拒绝主动文档类型（SVG、HTML 和脚本）；每条声明路径都必须在 `files[]` 中固定哈希；包内的 `manifest.json` 即使声明了也绝不能提供。声明 `contributions.assets` 需要使用 `schemaVersion` 2 且 `capabilityApi` 不低于 1.10 的清单；v1 清单完全无法声明。资源始终会重新验证：与客户端包一样，它们带有基于清单哈希的强 `ETag`，未变化的重新验证会返回无响应体的 `304 Not Modified`。图块集只有在字节确实变化时才会重新下载。响应被有意设为永远不使用 `immutable`，因为安装政策允许使用不同字节重新发布同一版本，带版本的 URL 也不是内容寻址 URL。这样，`game-surface` Experience 就能随包提供真正的美术资源，而不必把它内联进客户端包。

违反规则的清单会在安装时被拒绝，并显示以下消息之一："A declared package asset must be listed in the package file manifest"、"contributions.assets requires schemaVersion 2 and capabilityApi 1.10 or newer"、针对非图像/JSON 路径的架构扩展名错误，或者，对于文件名仅大小写不同、会在不区分大小写的文件系统上合并成同一文件的压缩包，显示 "Package contains duplicate file" / "Package manifest declares files that collide on case-insensitive filesystems"。

为此，每个功能元素都会收到自己的身份信息：`capabilityProps.packageId` 和 `capabilityProps.packageVersion` 会和 `localization` 一起传入。客户端包可以据此把资源 URL 构造成 `/api/capability-packages/<packageId>/assets/<path>`，并可选择添加 `?v=<packageVersion>`，让版本升级清除所有中间缓存，不必重新获取已安装列表，也不必解析自己的导入 URL。

### Capability API 1.11 的 Experience 战斗接口

Capability API 1.11 向 `game-surface` 功能属性添加了战斗接口。`combatActive` 会在内置战斗 UI 真正挂载的那一刻报告状态；而 GM 的叙事场景状态 `chatMeta.gameActiveState` 会落后于切换，甚至可能在没有任何遭遇时显示 "combat"。`combatStyle` 会传递有效样式(`classic` 或 `tactical`)。`requestCombat()` 要求 Engine 通过与手动 Start Combat 按钮完全相同的流程生成遭遇，只省略确认对话框，因为 Experience 自己的界面已经表达了意图。遭遇的内容仍由 Engine 的生成流程决定。包有意无法直接提供战斗人员或战斗状态，战斗仍归 Engine 管理。

`requestCombat()` 的身份稳定，在包路径上不会显示消息，并返回一个由 Experience 自行渲染反馈的代码：成功为 `"started"`；拒绝为 `"combat-active"`、`"pending"`（已有生成正在进行）、`"no-turn"`（GM 尚未写出回合）或 `"unavailable"`（已结束的会话或重放）。`combatPending` 和 `combatError` 会反映生成进度和失败，让包不会在生成失败后继续等待 `combatActive`。与 1.7/1.8 接口一样，但不同于受到严格门控的 1.10 `contributions.assets`，无论包声明的 `capabilityApi` 是什么，这些属性都会提供给所有 `game-surface` 包。1.11 标签表示它们何时出现；依赖这些属性的包声明 1.11，旧版 Engine 就能明确拒绝它。

### Capability API 1.12：面向所属 Experience 的空间事件

Capability API 1.12 还会把空间功能事件发送给拥有游戏的 Experience 包。以前在 `marinara-capability-server-event` 窗口事件中只发送给 `hierarchical-maps` 的 `spatial_transition_committed`、`spatial_transition_rejected` 和无类型 `spatial_context_refresh` 提醒，现在还会把 `packageId` 设为聊天的 `gameExperienceId` 后再次发送。不同事件的载荷不同：已提交事件包含 `{ chatId, commandId, currentLocationId, definitionRevision, travel? }`；已拒绝事件包含 `{ chatId, commandId, code?, message? }`，因为移动没有发生，所以没有位置字段；刷新提醒包含 `data: null`。通过 `sendMessage` 的 `pendingSpatialTransition` 参数发送旅行命令的 Experience，可以在主机知道结果时立即确认或清除行程，不必根据之后的状态读取来推断。1.12 还补上了一个会影响 World Maps 自身的缺口：通过两个静默 HTTP 路径之一被拒绝的转换，也就是生成中流式输出前的所有者回合提交，或独立 REST 提交，以前完全不会产生事件。现在两者都会合成 `spatial_transition_rejected`，但仅限存在确定证据时，也就是出现 `already_applied` 以外的 `spatial_*` 错误代码。无法确定的失败，例如可能丢失成功提交响应的网络错误，会改为发送无类型 `spatial_context_refresh` 提醒，让监听器与服务器状态重新同步，而不是接受虚构的结论。已提交事件中 `travel.mode` 为 `"step_by_step"` 且 `complete: false`，表示行程仍在继续；请把待处理状态保留到完成事件。这是与 1.11 一样的软接口：无论声明的 `capabilityApi` 是什么，事件都会传递。只有包依赖这些事件时才声明 1.12。

### Capability API 1.13：临时折叠旁白

Capability API 1.13 向 `game-surface` 包传给 `setExperienceChrome` 的 chrome 声明中添加了 `requestsCollapsedNarration`。标记为 true 时，Game Mode 的旁白框会折叠成细窄手柄，让 Experience 可以为过场动画或全屏演出腾出屏幕。

这是请求，不是偏好设置。玩家自己的折叠设置绝不会被写入，并且只有 Experience 是当前界面时才会接受该标记。移除标记或不再作为当前界面，旁白框就会回到玩家选择的状态。这就是“结束后总会重新打开”的保证；包有意无法永久保存折叠状态。

Engine 的安全规则优先于请求。只要屏幕上显示玩家文本输入框，旁白框就会强制展开，包括场景刚开始、尚无任何分段时；分段推进控件处于活动状态时也会强制展开，因为这些控件是结束回合的唯一方式，能隐藏它们的包可能会让玩家永远卡住。存在待处理的场景分析、生成或战斗生成重试时，手柄也会继续显示注意提示。玩家在请求期间手动展开旁白框后，它会保持打开，直到请求结束。与 1.11/1.12 一样，这是软接口：无论声明的 `capabilityApi` 是什么，该字段都会生效。1.13 标签表示它何时出现，因此依赖它的包声明 1.13。

## 首批包

- 目前所有内置智能体；
- Roleplay 和 Game 用的分层空间地图；
- Conversation 的语音和视频通话；
- UNO；
- 国际象棋；
- 扑克；
- 八球台球；
- 井字棋；
- 石头剪刀布。

基础发行版保留包管理器、目录客户端、通用智能体流程契约、通用回合制游戏宿主契约，以及处于待命状态的宿主接口。具体实现都归包所有。

## 信任与安装

官方目录是一份带版本号、经过结构校验的 JSON 文档，通过 HTTPS 获取。每个发布条目都包含不可变的产物 URL、SHA-256 摘要、字节大小、引擎兼容性、权限，以及该包的运行时是否需要重启。

服务器启动时，只要装有至少一个官方包，宿主就会拉取一次目录，只挑出与当前 Engine 和能力 API 兼容的更新版本，走常规安装流程完成校验，并在各个包的运行时激活之前装好。失败按包隔离，互不影响。目录离线或校验失败时，已有的文件和注册表状态照常可用；服务器运行时就绪失败则走回退到上一版本的路径。

安装器必须做到：

1. 要求具备本地环回/管理员级别的特权访问；
2. 强制 HTTPS，并施加下载大小上限和超时；
3. 解压前先校验目录的可信性和产物的 SHA-256；
4. 拒绝绝对路径、路径穿越、链接、设备文件和未声明的文件；
5. 校验清单和引擎兼容性；
6. 解压到同级的临时文件夹；
7. 只有全部校验通过后才原子地激活；
8. 在新运行时成功启动之前保留旧版本；
9. 失败时回滚激活操作；
10. 绝不执行安装、更新或卸载脚本。

官方目录只启用第一方的受信任可执行包。将来若要支持第三方，需要单独设计一套明确的信任机制。

## 运行时与重启行为

服务器持有已安装包的注册表，并把已安装的能力暴露给客户端。声明式模块和可热重载的模块会立即激活。激活之后，界面会让目录、智能体、模式能力和当前聊天这几类查询失效并重新拉取。

只有当宿主无法安全地重载某个入口点时，清单里才可以声明 `restartRequired`。热激活成功时提示 `Agent installed. It is ready to use.`，需要重启时提示 `Agent installed. Restart Marinara Engine to finish setup.`。

回合制游戏包支持热重载：安装时会立刻注册它的服务器引擎和手动斜杠命令启动方式，卸载时无需重启 Engine 就能卸下运行时。每个聊天里的 Conversation Commands 设置只决定角色能不能发出该包的隐藏命令，不会限制你自己用斜杠命令启动。目前官方的回合制游戏清单出于保守考虑仍保留旧版的重启标记，以兼容 Engine 2.x；Engine 3.x 能识别 `turn-game` 这个类型，会执行安全的热激活，并把包直接标记为已激活、可使用。

## 兼容性迁移

升级后首次启动时：

- 自定义智能体不受任何影响；
- 该安装能看到的每一个旧版内置智能体都会被记录为已安装；
- 地图、Conversation 通话和 Conversation 小游戏保持原来的可用状态；
- 已有的单聊天配置、快照、游戏状态、通话记录和智能体记忆全部原样保留；
- 迁移是幂等的，只有在所有旧版可用性记录都落盘之后才会记为完成。

旧版包的产物仍然可以从官方目录获取，作为迁移来源。全新安装的应用不会展示或激活它们，除非自己动手安装。

## 卸载

卸载会把这个包从各个聊天的启用列表里移除，删掉它的智能体配置和下载来的可执行文件，必要时在重启时卸下它的运行时。历史聊天、消息、地图快照、通话摘要和已完成的对局记录依然可读，所以卸载一个包不会毁掉已有的成果。要彻底删除这些历史领域数据，得由自己另外明确地操作一次。

每次卸载都需要确认。受影响的聊天会退回到普通的基础界面，历史记录不会损坏。

## 目录界面

Agents(智能体) 面板里有一个 `Download Agents` 控件，与 Card Browser 里的 `Download Cards` 一一对应。点开是一个全屏的自适应库页面，提供搜索、包类型、兼容性信息、安装/更新状态、权限、占用空间、文档和卸载控件。

桌面端用一份浏览列表加旁边的详情区。移动端只用一栏，配明确的返回导航和适合触摸的按钮。空列表、离线、不兼容、下载损坏、安装中断、有更新、已回滚、需重启这些状态都是一等公民，各有对应界面。

## 抽离验收标准

只有同时满足以下几点，抽离才算完成：基础版的生产客户端和服务器打包产物里不再含有该包的实现；全新安装的应用不下载这个包就无法激活它；升级上来的安装仍然保留它；而且包的安装、更新、卸载在桌面端、移动端和 Termux 兼容的文件系统上都能跑通。
