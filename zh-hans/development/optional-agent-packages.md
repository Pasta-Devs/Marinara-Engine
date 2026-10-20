# 可选智能体包与能力包

状态：已在 v2.3.0 开发周期内实现，对应 issue #3612。

## 目标

Marinara Engine 的基础发行版不编译、也不附带任何可选的智能体实现和能力实现。全新安装的应用里没有任何可选包。从旧版本升级时，这套包机制引入之前就已具备的能力会全部保留。

官方目录、包源码、可复现的产物、校验脚本和贡献流程都放在 [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents)。安装后的产物存放在配置好的 Marinara 数据目录下面，这样应用更新就不会覆盖它们。

## 包模型

一个智能体包可以提供一个或多个声明式智能体，以及可选的受信任可执行能力：

- 服务器端入口点：路由、生命周期钩子、提示词提供方、结果处理器、存储迁移；
- 客户端入口点：面板、聊天界面、设置区块、设置向导中的选项、运行时显示内容，以及完整的 Game Mode 界面；
- 共享的 JSON 结构定义和稳定的通信契约；
- 包自带的资源文件、文档和 Professor Mari 知识片段。

包面向的是带版本号的 Marinara 能力 API，不允许从引擎导入私有源码路径。

客户端的能力组件通过自身的 `lang`、`dir` 属性和 `capabilityProps.localization` 对象拿到 Engine 当前选中的界面语言。包自带的界面维护自己的语言文件，缺失时回退到包内的英文；Engine 不翻译包的提示词，也不翻译包自己写死的机器可读值。切换语言时复用现有的 `marinara-capability-props` 事件，已安装的界面无需重启 Engine 就能重新渲染。

### 交付和缓存

已安装的包文件会带上强验证器，它们来自清单中每个文件的 SHA-256 哈希；Engine 每次读取时也会用这些值重新验证字节。客户端包(`/api/capability-packages/<id>/client`)和每个包资源都会始终重新验证(`no-cache` 加 `ETag`)。未变化的文件会返回 `304 Not Modified`，不会重新下载；重新发布的文件则会立即被取用。任何内容都不会以 `immutable` 方式提供：安装政策允许使用不同字节重新发布同一版本，因此包 URL 并不是内容寻址 URL。

Capability API 1.1 在服务器端的激活上下文里加了一层通用的运行时门面。包可以读取当前生效的智能体调试状态，也可以通过 Engine 的 Pino 日志器写日志，包括显式覆盖调试模式，全程不需要导入私有的日志模块或运行时配置模块。这层门面只暴露操作，不暴露 Engine 内部对象。

Capability API 1.2 加入了事务范围内的聊天/消息操作、范围收窄的聊天元数据写入和世界书条目存在性读取，以及空间快照兼容存储。包可以在一个 Engine 事务内校验领域数据的变更，并把元数据与所属消息、备选回复或空间快照一起原子提交，全程拿不到数据库句柄或数据表对象。回滚和历史存储兼容由 Engine 负责，校验和领域规则由包负责。同一套 API 还提供归一化后的聊天记录和角色记录、可用世界书条目的筛选、类 JSON 响应的解析，以及解析完成的语言模型调用。连接凭据、服务商实现、数据库句柄和存储对象始终只属于 Engine 内部。

### 宿主客户端命名空间

客户端状态和这些库都归 Engine 所有，智能体包的客户端直接使用它们，而不是把副本打包进去。副本会有一份自己的状态：曾经把 UI 设置 store 打包进去的包客户端，每次加载都会用旧版本的设置覆盖 Engine 的设置（Pasta-Devs/Marinara-Agents#1478），而每个打包进去的聊天 store 都停留在页面加载时打开的那个聊天上。

Engine 在导入第一个包客户端之前，会定义一个全局变量：

```ts
globalThis.__MARINARA_HOST__ = {
  version: 1,
  capabilityApi,
  stores,
  services,
  modules,
  queryClient,
  components,
  data,
  api,
};
```

这个属性不可写、不可配置，命名空间本身及其 `stores`、`services`、`modules`、`components` 和 `data` 对象都已冻结。包加载器（`useCapabilityClientModules`）在导入任何包客户端之前，会用 `import()` 加载 `lib/marinara-host.ts` 并等待 `ensureMarinaraHost()` 完成，所以包模块求值时命名空间已经完整。没有包客户端的 Engine 永远不会加载它。如果它加载失败（比如更新后残留了过期的 chunk），每个包会显示它原有的加载错误，Engine 的其余部分照常工作。TypeScript 类型是 `packages/client/src/lib/marinara-host-contract.ts` 里的 `MarinaraHostV1`，本页的各个列表也定义在那里。包构建会声明与之匹配的结构类型，而不是导入 Engine 源码。

| 成员 | 值 |
| --- | --- |
| `version` | `1`。只有结构发生破坏性变化时才会改变。 |
| `capabilityApi` | Engine 的 `supportedCapabilityApi`，例如 `{ major: 1, minor: 341 }`。 |
| `stores` | 实时的 zustand store：`ui`、`chat`、`agent`、`sidecar`、`dialog`、`gallery`、`encounter`、`gameState` 和 `backfill`。`chat` 包含待处理空间过渡的状态切片。 |
| `services.tts` | `lib/tts-service.ts` 模块（`ttsService`、`playWhenAvailable` 等）。 |
| `services.dialogs` | `lib/app-dialogs.ts` 模块（`showAlertDialog`、`showConfirmDialog`、`showPromptDialog`、`showChoiceDialog`）。 |
| `modules` | 库模块，以裸模块说明符为键（见下文）。 |
| `queryClient` | Engine 渲染时使用的那一个 React Query `QueryClient`。 |
| `components.Modal` | Engine 的 `Modal`，带有它的覆盖层顺序、Escape 键和返回键处理。 |
| `data.emojiCatalog` | `lib/emoji-catalog.generated.ts` 模块。 |
| `api` | `lib/api-client.ts` 模块（`api`、`ApiError`、`getApiErrorMessage` 等）。 |

包只有先检查过某个成员，才会读取它，例如 `const host = globalThis.__MARINARA_HOST__; if (host?.version === 1 && typeof host.stores?.ui?.getState === "function")`。命名空间只增不减：新成员会随一个 Capability API 次版本号一起加入，需要它的包就要求这个次版本号。为命名空间构建的包要求引入它的那个 Capability API 版本，所以旧版 Engine 永远不会安装它们，而是保留已有的版本。如果某个成员仍然缺失，包也绝不会回退到自己打包的有状态 Engine 服务副本：`ui` 和 `chat` store 会变成从不写入的只读副本，其他所有成员则提示该功能需要更新版本的 Marinara Engine。

**宿主模块。** `modules[specifier]` 与 Engine 自身构建中 `import * as m from "<specifier>"` 返回的内容完全相同，库有 `default` 时也包括它。这些说明符是 `react`、`react/jsx-runtime`、`react-dom`、`react-dom/client`、`@tanstack/react-query`、`zustand`、`zustand/middleware`、`sonner`、`zod`、`i18next`、`react-i18next`、`framer-motion`、`tailwind-merge` 和 `clsx`。包构建会把这些说明符解析为读取命名空间的垫片（shim），所以包用 Engine 唯一的那份 React 渲染，并共享它的 React Query 缓存和 toast 提示。

- 包绝不渲染 `<Toaster>`，也绝不创建 `QueryClient`。来自 `sonner` 的 `toast` 会显示在用户设定的提示位置。除非查询设置了自己的选项，否则沿用 Engine 的查询默认值（30 秒的 `staleTime`、重试一次、窗口获得焦点时不重新拉取）；包新建的查询键以包 ID 开头。
- 包在 `<I18nextProvider>` 内使用自己通过 `i18next.createInstance()` 创建的 i18next 实例。它绝不使用 `initReactI18next`、`setI18n` 或 `setDefaults`，因为这些会替换掉 Engine 的实例。
- `lucide-react`、`chess.js`、`scheduler` 和 `@marinara-engine/shared` 不是宿主模块；包自行打包其中用到的部分。
- 包针对这些主版本构建：`react` 19、`react-dom` 19、`@tanstack/react-query` 5、`zustand` 5、`sonner` 2、`zod` 3、`i18next` 26、`react-i18next` 17、`framer-motion` 13、`tailwind-merge` 3 和 `clsx` 2。Engine 里其中任何一个升级主版本（首先是 React），都会让所有针对旧主版本构建的包失效，所以需要升级 Capability API 的**主版本**。如果 `packages/client/package.json` 里的某个主版本变了而契约没变，`scripts/regressions/marinara-host-namespace.regression.ts` 就会失败。

**包读取的 store 字段。** 已发布的包目前会读取下面这些字段。Engine 会保留每一个字段，删除或重命名其中任何一个都需要升级 Capability API 主版本（`MARINARA_HOST_STORE_FIELDS` 用 `Pick<>` 固定了它们）：

| Store | 字段 |
| --- | --- |
| `ui` | `achievementsEnabled`、`debugMode`、`includeReasoningInExports`、`enableStreaming`、`userStatus`、`enterToSendConvo`、`conversationCallVoiceVolume`、`conversationCallVoiceMuted`、`setConversationCallVoiceVolume`、`setConversationCallVoiceMuted`、`conversationTimeZone`、`noodleNavigation`、`setNoodleNavigation`、`noodleSelectedPersonaId`、`setNoodleSelectedPersonaId`、`reviewImagePromptsBeforeSend`、`musicPlayerEnabled`、`musicPlayerSource`、`sidebarOpen`、`setSidebarOpen`、`chatBackground`、`setChatBackground`、`characterDetailId`、`lorebookDetailId`、`presetDetailId`、`connectionDetailId`、`agentDetailId`、`toolDetailId`、`personaDetailId`、`regexDetailId`、`characterLibraryOpen`、`botBrowserOpen`、`gameAssetsBrowserOpen`、`modal`、`rightPanelOpen`、`closeModal`、`closeRightPanel`、`closeBotBrowser`、`closeAllDetails` |
| `chat` | `activeChatId`、`activeChat`、`isStreaming`、`streamingChatId`、`abortControllers`、`reset`、`pendingSpatialTransitions`、`setPendingSpatialTransition`、`clearPendingSpatialTransition`、`setPendingSpatialTransitionStatus` |
| `agent` | `setYoutubePlay`、`reset` |
| `sidecar` | `modelDownloaded`、`modelDisplayName`、`fetchStatus` |
| `dialog` | `dialog`、`openDialog`、`closeDialog` |
| `gallery` | `pinImage`、`pinVideo` |
| `encounter` | `reset` |
| `gameState` | `current`、`setGameState`、`reset` |
| `backfill` | `resetBackfill` |

**Engine 所有的浏览器存储。** 包可以读取下面这些键，但绝不写入或删除它们：`marinara-engine-ui`、`marinara-engine-ui:host`、`marinara-active-chat-id`、`marinara-input-drafts`(local storage 和 session storage)、`marinara-pending-spatial-transitions`、`marinara-pinned-gallery-images` 和 `marinara_sidecar_prompted`。包也绝不打开 IndexedDB 数据库 `marinara-tts-audio-cache`。要修改某项设置，包应调用 store 的 action，例如 `host.stores.ui.getState().setConversationCallVoiceMuted(true)`，由 Engine 负责保存。

**应用对话框。** Engine 把它的提醒、确认、输入和选择对话框渲染在最顶层，也就是命令栏所在的那一层，所以包打开的对话框会显示在包自己的覆盖层之上，并获得焦点。

**命名空间出现之前的包构建。** 它们打包了自己的一份版本为 74 的 UI store 副本，并只用这份副本认识的设置覆盖 `marinara-engine-ui`。Engine 还会把每次写入同时保存到仅供宿主使用的 `marinara-engine-ui:host` 副本；加载时，只要这份副本处于当前版本，Engine 就会忽略比自身版本旧的已存储数据。对于使用经典 JSX 运行时的已安装包，Engine 仍会设置 `globalThis.React` 和 `globalThis.ReactDOM`。

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

### Capability API 1.14：追踪器界面与智能体生命周期

Capability API 1.14 为具有客户端入口、处于活动且已启用状态的 Roleplay 智能体包增加两个 `contributions.slots` 值：

- `roleplay-tracker` 将包的 `toolbar` 视图挂载到 Roleplay HUD。属性包括 `chatId`、`chatMode`、`mobileCompact`、宿主的 `toolbarButtonClass`、`onRerunTracker`、`trackerRetryBusy`、`lockMode` 和 `onToggleLockMode`。回调是可选的，使用前请检查是否存在。
- `tracker-panel` 将包的 `tracker` 视图挂载到现有 Tracker Panel，传入 `chatId`、`chatMode` 和 `detached`。请复用宿主界面，不要另开第二个面板。两个插槽还会收到普通的功能身份和本地化属性。

提示词上下文贡献仍通过 `api.registerPromptContext` 注册，需要 `prompt-context` 权限。请求现在公开 `targetCharacterIds`、`personaId` 和 `placedAgentTypes`(为兼容而设为可选)。`placedAgentTypes` 告知预设已经放置哪些智能体数据区段，避免重复上下文。宿主在 `packageBlocks` 中保留各贡献的包身份，以便把包文本放入对应智能体区段。返回按受众区分的文本时，应遵守传入的目标角色 ID。

服务端入口也可通过 `api.registerService("agent-runtime:<package-id>", service)` 注册自身的后处理生命周期服务。它需要 `agent-runtime` 权限；以其他包 ID 注册会被拒绝。可选钩子如下：

```ts
const cleanup = api.registerService(`agent-runtime:${packageId}`, {
  prepareContext({ agent, context }) {
    // Return small, JSON-serializable context for this agent, or nothing.
    return { chatId: context.chatId };
  },
  finalizeResult({ agent, context, preparedContext, result }) {
    // Validate or enrich the result before the host publishes/applies it.
    return result;
  },
});
// Return cleanup from activate(), or include it in the activation cleanup.
```

`prepareContext` 在后处理之前运行；其非 null 结果限定于该智能体，并以序列化的运行时上下文加入提示词。`finalizeResult` 收到该值和生成结果，返回 `AgentResult`。生成和手动重试路径会推迟发布结果，直到最终处理完成。每个异步钩子的时限为两秒：准备失败会记录并跳过，最终处理失败则将结果变为失败，避免应用未经验证的输出。这些是短时宿主生命周期钩子，不适合再加一次缓慢的模型调用。

这些新增项没有逐字段的 1.14 版本门槛。包可检测可选属性并在旧 Engine 上降级，但若插槽、放置或生命周期行为是必需的，就必须在 v2 清单中声明 `capabilityApi: { major: 1, minor: 14 }`，使旧 Engine 明确拒绝安装。

### Capability API 1.15：当前嵌入配置

`api.runtime.resolveEmbeddings()` 使用包当前的智能体连接配置，返回新的 `Promise<CapabilityEmbeddingHost>`。应在开始嵌入操作时调用，而不要缓存 `api.runtime.embeddings`：后者是激活时的快照，未重新激活就不会跟随后来的连接变化。

```ts
const embeddings = await api.runtime.resolveEmbeddings();
const vectors = await embeddings.embed(texts, signal);
// Store/compare embeddings.spaceId with persisted vectors; do not mix embedding spaces.
```

返回的宿主具有 `spaceId`、`label` 和 `embed(texts, signal?, inputType?)`(输入类型见 Capability API 1.68)。解析使用已配置的嵌入源；没有可用源或配置解析失败时，回退到内置本地 MiniLM 嵌入器。`embed` 可以返回 `null`；空批次、超过 128 段文本或合计超过 200,000 字符都会被拒绝。新宿主不会重新嵌入现有向量，因此包必须先处理 `spaceId` 变化，再将新向量与已存向量比较。

当前 Engine 无论包声明何种 API 版本都会公开此方法。若必须跟随连接变化，请声明 API 1.15。特意支持旧 Engine 的包可以检查 `typeof api.runtime.resolveEmbeddings === "function"`，并接受激活时快照的限制，回退到 `api.runtime.embeddings`。

### Capability API 1.16：包声明的 Game Master 动词

Capability API 1.16 允许 Experience 包声明一份简短且封闭的具名 Game Master 动作列表，即动词。Engine 将其渲染到 GM 格式提醒中，从完成的叙述里读回，再代表包执行。整个过程不运行任何包服务端代码，因此只有 `agents` 和 `client` 入口的 `game-surface` Experience 也能让 GM 用文字改变世界。

整条接口已可用：包括模式、保留名称与键归属规则、表读取、提示词渲染和执行器。包只要提供表并拥有 `chat-write`，其绑定聊天的每个 Game 回合都会在 GM 提醒中显示动词，GM 使用时就执行。未绑定包的聊天，或包未声明表的聊天，解析零个动词，回合与该接口出现之前逐字节一致。

包以 `gm-verbs.json` 声明表，像其他资源一样列入 `contributions.assets.paths`，并在 `files[]` 固定哈希。通过保留文件名发现资源是一项新约定：包管线中其他文件都是按名称读取的已声明路径(`entrypoints`、图标路径、资源路径)，没有其他按形状发现的文件。资源路径有两个后果。只放进 `files[]` 却未列入 `contributions.assets.paths` 的文件，在安装和目录构建时均无声通过，包只是没有动词，任何地方都没有诊断。另外，资源路由不做特权访问检查，声明的表会在 `/api/capability-packages/<id>/assets/gm-verbs.json` 无保护地提供，因此绝不能包含敏感内容。与 1.11–1.13 一样，这是软接口：旧 Engine 将其当普通 JSON 资源忽略，因此可以提供表而不缩小安装范围。只有必须运行这些动词时才声明 `capabilityApi` 1.16；该声明会拒绝所有更旧的 Engine 安装。

文档形如 `{ "schemaVersion": 1, "verbs": [ … ] }`，包含一至十六个动词。每个动词都严格验证，内部未知键会被拒绝，而非静默容忍。与 `schemaVersion` 和 `verbs` 并列的未知字段则在两个场合有意采用不同处理：Engine 自身读取时将其剥离，因此新 Engine 的表仍能提供当前版本理解的动词；编写工具使用的共享文档模式则严格拒绝。因此，编写时的模式验证比 Engine 运行时更严格，这正是所需的方向。

```json
{
  "schemaVersion": 1,
  "verbs": [
    {
      "name": "weather",
      "description": "Set the sky when the weather visibly changes.",
      "effect": "state",
      "metadataKey": "pixelforgeWeather",
      "args": [
        { "name": "word", "type": "string", "enum": ["fair", "overcast", "rain", "storm", "snow"] },
        { "name": "intensity", "type": "string", "enum": ["light", "heavy"], "optional": true }
      ]
    }
  ]
}
```

动词名必须符合 `[a-z][a-z0-9_]*`，最多 32 字符，不能使用 Engine 自身的 GM 方括号标签。检查会统一大小写，因为提醒中 `[Note:` 和 `[Book:` 首字母大写，而解析正则不区分大小写，小写 `note` 也会遮蔽日志标签。保留集取自 GM 和队伍提醒的所有分支能渲染的标签，以及从完成回合读取标签的五个叙述解析器：客户端标签解析器、客户端叙述格式器、服务端片段编辑器、侧车场景分析器，以及生成路由的对话改写器。它们的词汇比任何提醒都广，包括对话标记 `main`、`side`、`extra`、`action`、`thought`、`whisper`，以及仅叙述格式器匹配的 QTE 对 `qte_bonus` / `qte_result`。最后一组说明固定检查为何必要：名为 `whisper` 的动词会在保存前删去对话行中的 `[whisper:Tam]`，使该行永久失去对话身份。回归检查连同提取器一起固定这些内容。提供独有名称的解析器——标签解析器的 `party-chat` / `party-turn` 和格式器的 QTE 对——必须持续提供它们；某个来源悄然退出扫描会导致构建失败，而非缩小保留集。其余三个即使没有独有名称也继续扫描，以捕获最先出现在其中的新标签。但固定检查不保证完备：扫描范围之外的文件新增标签，或提取器无法读取的写法，仍会漏掉，因此新解析器出现时必须扩展集合，不能假定它永远封闭。`action`、`state`、`status`、`note` 这些普通词也是内置标签，所以普通动词名被拒绝通常是该规则，而不是拼写错误。`description` 为 1–200 字符的单行，不含方括号或换行，因为它会原样渲染进提醒的 `COMMANDS:` 块。这里的换行不止 CR 和 LF，还包括读取该块时会结束一行的 `U+0085`、`U+2028`、`U+2029`；C0 控制字符和 DEL 也被拒绝，尤其是制表符，因为它们不结束行也能改变块的形状。但“原样”并不绕过宏处理：整个提醒发送前会展开宏，说明中的 `{{…}}` 会展开而不是打印，也包括 `{{setvar::…}}` 等写入聊天变量的宏。这未超出 `chat-write` 已授予的范围，但容易误触，因此除非确有意图，请避免宏花括号。每个动词最多六个 `{ name, type, enum?, maxLength?, optional? }` 参数，名称符合 `[a-z][a-zA-Z0-9_]*`，最多 32 字符。它是 JSON 键而非方括号标签，因此有意比禁止大写的动词名更宽松。只有字符串参数可带 `enum`，包含 1–16 个不同值；重复值不增加集合信息，会像表内其他重复项一样被拒绝。无 enum 的字符串必须声明 `maxLength`(1–500)，因为执行器的限定解析没有自己的上限，无限制自由文本可能把整段叙述带入包。enum 已经限定了取值，因此同时声明 `enum` 与 `maxLength` 会被拒绝。载荷是扁平的单行 JSON；嵌套的 `}` 会提前结束标签匹配。每条消息每个动词名只解析一次，重复动词只应用一次。

这些不必全部写进说明。提醒行依据解析后的表生成，依次包含示意载荷、说明以及一个可复制例子：

```
- [weather:{"word":"fair|overcast|rain|storm|snow","intensity"?:"light|heavy"}] — Set the sky when the weather visibly changes. Example: [weather:{"word":"fair"}]
```

教授词汇的是示意结构：按声明顺序显示所有参数，可选项在 JSON 字符串外标记 `"name"?:`，enum 显示完整候选项，无 enum 的字符串显示上限，数字和布尔值不加引号，因为验证器会拒绝数字位置的 `"3"` 而不强制转换。例子只是具体实例，只能展示单个 enum 值，因此不能承担教授词汇的职责。只收到 `{"word":"fair"}` 的 GM 会写 "sunny"，验证器随后拒绝一个从未告知的词，而拒绝过程不可见：标签按名称匹配剥离，不以验证成功为条件，所以叙述干净，世界却没有改变。两种展示源于同一解析表也能防止漂移：值不再由说明定义，说明就不会承诺验证器拒绝的值。请用这 200 字符解释何时使用动词，而非复述参数。

降级按动词进行。当前 Engine 不能使用的动词——新 `effect`、无法表示的结构，或保留名、非本包键等被拒绝声明——会单独丢弃并记一行日志，仍运行能理解的其他动词，与 `parseCapabilityCatalogWithCompat` 对目录条目的规则相同。因此，拒绝的动词是静默失败；声明的动词不出现时请看日志。整个文档不可用时(未知 `schemaVersion`、空 `verbs` 数组或不是对象)，返回空表并记一行日志。读取前还会按声明的 `files[].bytes` 拒绝超过 64 KB 的表，因为 `files[]` 允许最大 100 MB，其他地方没有读取前的资源大小上限。任何失败都不会改变回合。

声明 `metadataKey` 的动词是**状态动词**：将全部参数写入聊天元数据行的该键，包通过已有属性看到变化。不带 `metadataKey` 的是**事件动词**：以实时功能客户端事件发送，没有持久写入、队列、重放或确认。事件动词禁止 `metadataKey`，防止占据不写入的键；状态动词则必须提供。

选择前应理解二者差别。状态写入持久且不会回退：切换回合滑动结果、编辑或删除回合都保留值，最后生成的滑动结果胜出，而不是最后显示的结果，因此同一会话中的文字和世界可能不一致，也没有调和机制。事件完全没有记忆，只有一帧、一次同步分派。回合中止、流式输出期间关闭或重载标签页、包首次挂载前到达的分派、玩家已切走的聊天，以及包自己的加载门控期间，都会静默丢失事件，且不会重发。作为交换，如果包把效果存于可随回溯重建的位置，事件效果就能随故事回退；状态写入做不到，因为聊天元数据行不会回溯。两边都不留痕迹的损失，是事件已作用于实时状态，却在包下次保存刷新之前被强制重载丢掉。

因此两类都在设计上拒绝相对语义。状态动词是绝对覆盖，结构上无法表达“增加五枚金币”。相对事件动词也被规则禁止，因为重新生成回合会创建新滑动索引，且不继承上一滑动结果的标记，导致每次生成都累加。按 `chatId:messageId:swipeIndex` 去重只能防止此通道本来就不会发生的重发，不能防止实际会发生的重新生成。让动词安全应用两次的是绝对值，而非账本。相对词汇只有改为按消息的绝对值后才能放在这里。

同一回合包含两类动词时，事件的同步分派会先于状态动词的异步重新获取到达包。事件处理器不能读取同回合状态动词的效果并期待得到新值。

拒绝具有不对称性，这是有意的。Engine 只验证形状——参数名、类型、enum 成员关系、字符串上限——因为语义属于包：按聊天构建世界时，NPC 名无法在声明时枚举。对于状态动词，包看到时元数据行已提交，所以包自身的拒绝仅具建议性；对于事件动词，Engine 尚未提交任何内容，相同拒绝就具有约束力，拒绝未知名称确实能阻止效果。

状态动词的 `metadataKey` 必须按三条规则归属于声明包。键以包 ID 规范成 camel case 后的名称开头(`hierarchical-maps` → `hierarchicalMaps`)；随后必须有以大写边界起始的非空后缀，防止一个包侵入另一个包的命名空间；规范化 ID 不能是 Engine 拥有的元数据命名空间，也不能在其大写边界上扩展。名单取自每个顶层 `ChatMetadata` 键、Engine 元数据键常量，以及存在于接口索引签名而非声明中的键。最后一组包括 `encounterActive`、`internalAssistant`、`imageGenConnectionId` 等前两个来源完全看不到的未声明元数据。读取第三组需要七个来源，因为 Engine 读写形式不止一种：传给 `patchMetadata`/`updateMetadata` 的对象；使用频率相近的更新回调返回对象；从不接触 `patchMetadata` 的客户端 `useUpdateChatMetadata()` 变更和 `onMetadataChange` 属性；连该钩子也跳过的直接 `PATCH /chats/:id/metadata` 调用(Game 界面这样写战斗、场景、叙述键)；`chatMetadata.key` 与 `chat.metadata.key` 属性读取；从 `parseChatMetadata(…)` 结果读取，这是 Engine 最常用且唯一能看到 `scenario` 等键的方式；最后是 Engine 为聊天设置配置档手动维护的键列表，其中收录完全跨函数边界读写的键。

所有这些连同提取器都由回归检查固定。有两类有意在扫描之外。将变量或辅助函数返回值交给写入(`patchMetadata(id, hydratedMeta)`，或元数据路由中的同样形式)，会提交静态扫描读不到的键。目前共有二十处，回归检查固定这个数量；出现第二十一处时，必须人工阅读后构建才能通过。另一类是在辅助函数内部从参数读取，属于跨过程分析，超出读取扫描能力。`spatialContext` 正是这样：由来自 Agents 仓库而非本仓库的 `hierarchical-maps` 客户端写入，再在这里通过辅助函数和文件内解析读取。手工列表填补了第二个缺口，因此七个来源中有一个是维护列表而非自动推导。此方法明确盲点，不宣称没有盲点。列表中的 `persona` 是人工加入的最低保留项，目前没有来源会产出它。第三条规则有意拒绝整个包：`conversation-calls` 规范为 `conversationCalls`，而 `conversationCalls` + `Enabled` 已是 Engine 键，因此该包不能在自身 ID 下拥有聊天元数据键。`noodle` 和 `background` 也一样，后者因为 `background` 本身就是 Engine 键。这些包仍可声明完全不占键的事件动词。键采用扁平顶层形式，因为现有包协调器读取的就是这种结构。

包声明的模型命令只会在包已声明 `chat-write`、完成安装且准备就绪时运行。该权限也控制通过包持久化 API 执行的写入，包括消息、聊天元数据、roleplay 事件和空间快照。`chat-read` 控制聊天、消息、游戏状态和空间快照的读取。持久化事务和聊天锁内部也会执行相同检查；写入权限不会隐式授予读取权限。引擎自身的持久化调用仍受信任。

安装后，Download Agents(下载智能体) 详情页会显示已安装版本声明的权限。如果目录中的版本请求了不同权限，页面会将它们分开显示。安装或更新代码仍需获得现有的批准，且批准与确切的版本和校验和绑定；模型命令不会在每个回合另行请求批准。

这些是 API 检查，并不是 JavaScript 沙箱。网络、存储和 UI 权限只是访问声明。包的浏览器端和服务器端代码仍是受信任代码，可以访问宿主环境；请只安装你信任的包。系统检查的是就绪状态，而不是能否提供文件，因此更新后若包处于 `restart-required` 状态，其命令会停止解析，直到引擎重启。

### Capability API 1.17：在首个回合前准备 Experience

`game-surface` 包可以使用架构版本 2 和 Capability API 1.17 声明 `contributions.gameSurface.prepareBeforeStart: true`。当游戏处于就绪状态时，Engine 会先挂载该界面，再启用 Start Game(开始游戏)。经典游戏和未设置此标志的包保留原有启动流程。

选择启用此功能的主界面会收到两个额外属性：

- `startup: boolean` 会保持 true，直到玩家通过 Continue(继续) 完成 Engine 的开场介绍。在此期间暂停世界模拟和玩家操作。
- `setStartupReady(context: string | null): void` 用于报告准备状态。加载、保存或从故障中恢复时发送 `null`。只有实际世界已经持久保存并且可用时，才发送字符串；空字符串允许不带额外上下文直接启动。

在收到就绪字符串前，宿主会阻止 Start Game、小组件准备确认和首回合重试。在等待期间，包自己的加载界面以及错误和重试界面仍然可见。准备完成后，包会隐藏在 Engine 的正常开场介绍后面。Continue 会打开常规界面，此时可能重新挂载：请让世界准备保持幂等，恢复已保存的状态，而不是再次生成。返回已经完成开场介绍的游戏时，不会重复启动准备。

开场上下文上限为 **8,000 个字符**。无效或过长的上下文会继续阻止启动并显示错误；宿主不会截断世界事实。请简洁描述准备好的起始地点及其实际角色阵容。Engine 会以 `game_start` 为来源，将这段文本追加到现有首回合 `generationGuide`，让开场使用已经存在的世界。这不会为后续回合注册上下文；后续仍应使用包正常提供的提示词内容或回合生成上下文。

就绪回调属于当前挂载的聊天、游戏和包。来自其他作用域的迟到回调会被忽略。模块或运行时故障会阻止启动，不会把缺少世界上下文当成成功。重新加载后，包必须根据保存的世界报告就绪状态。服务器端提示词上下文提供者仍然是只读的，并受较短的时限约束；不要用它生成世界，也不要把它当作长期等待的启动关卡。

### Capability API 1.19：包提供的工具

Capability API 1.16 让包能够要求模型_说出_某些内容，再据此执行操作。这一版本让模型能够_调用_某项功能。拥有新 `tools` 权限的包可以在服务器入口中注册具名工具。Engine 在每个聊天的每一轮中，将它与内置工具一起提供给模型，按包的 JSON Schema 验证调用，再把参数交给包的处理函数。

```ts
export async function activate({ api }) {
  api.registerTool({
    name: "set_time",
    description: "Move the world clock forward or back.",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["advance", "rewind"] },
        minutes: { type: "integer", minimum: 0 },
      },
      required: ["action", "minutes"],
      additionalProperties: false,
    },
    handler: async (args, { chatId }) => {
      const clock = await moveClock(chatId, args.action, args.minutes);
      return { time: clock.label };
    },
  });
}
```

这里有意使用工具调用，而不是响应格式。响应格式会占用整个回复：叙述必须放进 JSON 对象的字段，也无法流式输出。工具调用可以与正文同时到达，模型仍然照常写完这一轮。包接收的是已经受提供商约束的参数，无需从完成的叙述里重新解析。这就是架构约束与仅仅要求模型遵守约定的区别。

这一点之所以重要，是因为枚举值。如果包知道它的世界里有十二个地点，就可以把这十二个字符串写进架构，点名第十三个地点的调用会在处理函数看到之前就被拒绝。拒绝复用 Engine 自己的工具参数验证器，它会列出本来可用的值，所以模型拿到的是可以据此修正的信息，而不是“must be equal to one of the allowed values”。处理函数返回的任何内容都会作为工具结果展示给模型。

编写工具前，请了解这些规则：

- 名称以 `<packageId>_<name>` 加上命名空间，其中 `-` 转为 `_`，因此 `world-clock` 的 `set_time` 会以 `world_clock_set_time` 提供给模型。已被其他包占用的限定名称会被拒绝。名称冲突时，内置工具和已启用的自定义工具保留所有权：包的定义会被省略，运行的是内置或自定义的处理器。限定名称必须符合服务商 **64 个字符**的上限。无论是展示给模型的定义还是执行器，解析顺序都是先内置、再自定义、最后是包，所以名称的所有者始终就是执行调用的那一方。
- 只要包处于激活状态，它的工具就会被附加。这里没有像内置工具那样的额外聊天开关：声明权限并注册工具就是启用决定。所选提供商必须支持原生工具调用。
- 参数架构会在注册时复制并编译。如果 Engine 无法编译，包会在激活时失败，让开发者及时看到问题，而不是到一轮对话中途才失败。
- 处理函数抛出异常时，模型会收到调用失败的结果，异常会写入日志，但异常消息不会转发给模型。如果 **10 秒**内尚未完成，这一轮也会停止等待。处理函数仍会继续运行，但不会一直阻塞当前轮次。
- 结果必须能序列化为最多 **64 KiB**。更大或无法序列化的结果会使调用失败，而不是挤占对话空间。描述和结果属于受信任的包内容。包作者在读取或修改某个聊天的数据前，必须检查 `chatId`。
- 每个定义都会在每轮提供商请求中序列化，并计入上下文适配。因此注册有上限：**每个包 16 个工具**、**所有包合计 64 个**、描述最多 **512 个字符**、参数架构最多 **8 KiB**。超出任何上限都会抛出错误，导致激活失败。重新注册包自己拥有的名称会替换该工具，不会额外占用名额。
- 激活结束后，其上下文不再可用。如果包保留 `api`，并在后续回调中调用 `registerTool`，调用会被拒绝。已结束的运行时不能注册工具，也不能替换重新激活后注册的工具。
- 停用、更新或删除包会释放其工具。模型不会收到已经没有包能响应的工具。工具会在等待清理前移除；每个清理回调有 8 秒的时限。

这些时限仅限制异步等待。软件包以受信任代码的形式在服务器进程中运行；计时器无法中断阻塞事件循环的同步任务。强制取消需要独立的工作线程或进程，而此 API 不提供这种隔离。

`api.registerTool` 仅在这一版本及更新的 Engine 中存在。依赖它的包必须声明 `capabilityApi` 1.19，且会拒绝安装到更旧的版本。

## Decision 语句与 Decision 模型

用户的 **Decision model**(Decision 模型) 回答有关最近聊天的是非语句和选项语句。概念和设置方法见 [Decision 模型](../connections/decision-models.md)。

包附带的智能体提示词模板可以像用户的自定义智能体一样使用 `{{#if decision:"..."}}` 和 `{{#if decision_choice:"..." == "..."}}`。Engine 在模板中找到语句，在智能体运行前询问（后处理智能体则在回复之后），再用答案解析模板。这不涉及 Capability API 版本。语法和措辞建议见[条件提示词](../prompts/conditional-prompts.md#asking-the-decision-model)，各智能体阶段如何读取它们见[创建自定义智能体](../agents/custom-agents.md#decision-statements-in-the-agents-prompt)。

包的服务器代码还可以通过 `api.runtime.decisions.evaluate(...)`，向用户配置的 Decision 模型询问有边界的是非问题和选项问题，问题基于包自己提供的上下文。它与智能体激活问题和提示词条件使用同一个 Decision 模型（托管的本地模型或 Decision 连接），并且绝不暴露密钥或 Engine 内部实现。`decisions` 是可选的，不需要更新的 Capability API 或权限：检查 `typeof api.runtime.decisions?.evaluate === "function"`，在旧 Engine 上回退。

```ts
const result = await api.runtime.decisions?.evaluate({
  messages: [{ role: "user", content: "The tavern falls silent as the stranger draws a blade." }],
  questions: [
    { id: "danger", question: "Someone is about to be attacked." },
    { id: "mood", question: "The mood of the scene is", options: ["calm", "tense", "festive"] },
  ],
  // Optional: pass `signal` to cancel and `debugMode: true` to log the Decision prompt.
});
// null: no Decision model is configured, or it gave no answer (unreachable, timed out or cancelled).
if (result && (result.answers.danger ?? 0) >= result.threshold) {
  // ...
}
```

- `messages` 是包自己的上下文，按从旧到新排列（最多 200 条消息和 200,000 字符；消息的 `name` 最多 100 字符）。为适应模型，最旧的消息会被丢弃。
- 每个 `question` 最多 500 字符；id 必须唯一。选项问题至少有两个 `options`，答案是其中之一或 `"none of these"`。
- 一次请求最多可以要求用户的 **Decision statements per turn**(每回合判定陈述数) 上限那么多个答案；每个选项问题的每个选项计一次，再加一。无效请求会抛出 `TypeError`。
- `answers` 保存每个是非问题回答“是”的概率，没出现在其中的问题表示没有得到回答。把它与 `threshold` 比较，后者是模型自己的工作点：不同 Decision 模型之间的概率不可比。

每处使用都应考虑未配置 Decision 模型的用户。没有答案的语句视为否，因此 `{{else}}` 分支或不输出任何内容必须是合理默认行为。请面向一般 Decision 模型编写，而不要要求 Jev：本地聊天模型和其他支持的后端使用相同语法，但答案可能不同。依赖特定分数、请求次数或缓存答案前，请先阅读[阈值](../connections/decision-models.md#thresholds)及[限制与成本](../prompts/conditional-prompts.md#limits-and-cost)。

### 给 Game Mode Experience 开发者的说明

Engine 战斗自行决定普通敌人的行为。GM 方的每个非首领敌人都会根据技能与职业获得角色定位（bruiser、bulwark、skirmisher、marksman、spellcaster、supporter 或 controller），未自行指定时按等级获得熟练程度（novice、trained、veteran 或 master），以及 reckless、cautious、opportunistic、protective 等性格。beasts 和 monstrosities 总是 mindless。Engine 代码不调用模型，直接从种子选择这些值，游戏难度决定敌人按类型行事的一致程度。只有专门编写的首领由 GM 通过模型调用指挥。参见 [Game Mode 战斗 AI](game-combat-ai-design.md)。

后续还会继续改进战斗。在战斗流程中引入 Decision 模型前，请确认原生 Engine 战斗是否已满足需求。如果敌人需要特定性格，先赋予匹配的熟练程度和性格。每个敌人回合做一次 Decision 会增加模型工作和时限；托管后端还会增加网络请求与费用。战斗也将依赖用户可能尚未配置的模型答案，因此需要无答案时的合理回退。

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

更新需要用户同意：除了为升级上来的安装保留原有内置功能的一次性迁移（见[兼容性迁移](#compatibility-migration)）之外，启动时绝不会下载或安装任何包。`GET /api/capability-packages/updates/pending` 会列出每个已安装、目录版本更新且与当前 Engine 和能力 API 兼容的官方包，用户已经拒绝过的版本不在其中。客户端会在一个 **Agent updates available**(有智能体更新可用) 提示里一并显示它们。**Update all**(全部更新) 会走常规安装流程逐个安装，并固定为所提供的版本和产物 SHA-256。**Not now**(暂不更新) 会把被拒绝的版本记录到 `DATA_DIR/capability-packages/update-decisions-v1.json`(`POST /api/capability-packages/updates/decline`)，这样该版本不会再被提供，更新的版本则仍会提供。无论哪种情况，**Download Agents** 里的 **Update**(更新) 都一直可用。失败按包隔离，互不影响。目录离线或校验失败时，已有的文件和注册表状态照常可用；服务器运行时就绪失败则走回退到上一版本的路径。

发行说明以 `notes.json` 的形式发布在它所描述的 `catalog.json` 旁边，绝不放进目录条目或清单：旧版 Engine 会丢弃带有未知键的目录条目。每个待处理的更新都带有 `releaseNotes`，内容是已安装版本之后、直到所提供版本为止每个版本的说明，最新的在前；只要其中任何一条被标记为用户会注意到的变化，`releaseHighlight` 就为 true。说明是纯文本，绝不会按 Markdown 或 HTML 渲染。

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

### 磁盘占用：运行时副本与保留的版本

包的服务器端并不直接从 `DATA_DIR/capability-packages/versions/<id>/<version>` 运行。每次激活都会校验已安装的文件，把它们复制到 `DATA_DIR/capability-runtime-snapshots` 下的一个新文件夹，然后导入这份副本。该运行时停止时，副本就会被删除。

- **运行时副本。** 副本包含除客户端入口点之外的所有已校验清单文件。服务器从不加载客户端入口点，浏览器则从 `versions/` 获取它。资源文件会保留，所以服务器可以读取 `server.mjs` 旁边的文件，就像 Quartermaster 读取 `icons/` 那样。复制出的文件是只读的。
- **启动清扫。** 崩溃或强制停止会跳过副本的清理。每次启动时，在任何包激活之前，Engine 都会删除 `capability-runtime-snapshots` 里除共享 `node_modules` 链接之外的全部内容，因为新进程不可能正在使用它们。删除前它会先把只读文件改为可写（Windows 需要这一步），并且从不跟随链接。只有持有存储写入租约的进程才会走到这一步，所以在同一个数据文件夹上启动的第二个 Engine 会在打开存储时停下，绝不会删除正在运行的 Engine 的副本。
- **保留的版本。** `versions/<id>` 保留当前版本和 `previousVersion`；新的服务器运行时启动失败时，回滚会恢复后者。更旧的版本，以及更新失败后被回滚掉的那个版本，会在激活或更新成功后以及启动时删除。如果某个包的更新正在等待重启（`restart-required`），或者它的运行时还没启动（`readiness: "pending"`），它会保留所有版本，直到启动为止。
- **永不删除：** 包数据（例如 `DATA_DIR/long-term-memory` 这类文件夹，以及包在 `storage` 中的数据表）、聊天、设置、`installed.json`、更新决定、`.install-*` 文件夹，以及注册表中不存在的 ID 对应的 `versions/` 文件夹。卸载仍会移除包的代码，并保留它的数据。

<a id="compatibility-migration"></a>

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

Agents(智能体) 面板里有一个 `Download Agents` 控件，与 Characters 和 Personas 面板里打开 Card Browser 的 `Download` 按钮相对应。点开是一个全屏的自适应库页面，提供搜索、包类型、兼容性信息、安装/更新状态、权限、占用空间、文档和卸载控件。

桌面端用一份浏览列表加旁边的详情区。移动端只用一栏，配明确的返回导航和适合触摸的按钮。空列表、离线、不兼容、下载损坏、安装中断、有更新、已回滚、需重启这些状态都是一等公民，各有对应界面。

## 抽离验收标准

只有同时满足以下几点，抽离才算完成：基础版的生产客户端和服务器打包产物里不再含有该包的实现；全新安装的应用不下载这个包就无法激活它；升级上来的安装仍然保留它；而且包的安装、更新、卸载在桌面端、移动端和 Termux 兼容的文件系统上都能跑通。

### Capability API 1.30：伤势轨道、检定消费，以及按轨道作战

规则集的 `live.tracks` 条目可声明 `levels` 和 `kinds`，把有界整数变为伤势轨道：一列各有名称和惩罚、可放置标记的格子。`levels` 是 1 到 16 级，从最好到最差排列，每级有 `label` 和整数 `penalty`。`kinds` 是轨道可接受的 1 到 6 类伤害，每类有 `id`、简短 `label` 和不同的 `severity`。两者配套：没有 `levels` 的 `kinds` 会被拒绝，因为没有放标记的位置。旁边的 `resolution.penaltyFrom` 指定惩罚应用于每次掷骰的轨道：`dice-pool` 从池中减去相应骰子，但不低于 `pool.min`；`dice-sum` 则应用固定调整值。

本阶段其余新增项也属于 1.30，包只要提供任意一项就声明 1.30：

- `combat.health` 可指向伤势轨道而非资源池，此时 `combat.damageKinds` 规定各伤害类型标记什么：`default`、可选的 `byType` 映射，以及 `marks`：它为 `per-blow` 时，命中的一击标一格；为 `per-point` 时，伤害掷骰按生命等级计数。伤势轨道必须有 `damageKinds`，资源池则禁止它。
- `resolution.spend`(仅限 `dice-pool`) 规定玩家能为检定消费哪个池、每次支付多少、购买 `successes` 还是 `dice`，以及单次掷骰上限 `perCheck`。
- 目录条目的 `mechanics.check` 规定角色实际选取的内容如何影响检定：`reroll`(`upTo` 加 `once` 或 `until`)、`dice`、`successes` 或 `threshold`。同样仅限骰池。

```json
{
  "capabilityApi": { "major": 1, "minor": 30 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

伤势轨道长度就是等级数，因此 `min` 为 0，`max` 为 `levels.length`；不符的文件会被拒绝，而非悄悄修正。`resolution.penaltyFrom` 指向的必须是伤势轨道，普通轨道没有可应用的惩罚。

与 1.20 到 1.28 同理，这不是软接口：无法读取 `levels`、`kinds`、`penaltyFrom`、`damageKinds`、`resolution.spend` 或 `mechanics.check` 的 Engine 会拒绝整个规则集文件。因此安装会读取经过验证的 `ruleset.json` 字节，并拒绝声明旧版本的包。轨道为普通数字、生命为资源池且未声明检定消费的规则集不受影响。

### Capability API 1.29：规则集战斗一回合可以做什么

为 `combat` 块及战斗读取的目录条目增加五项可选内容：

- 一击除首段伤害外，最多可附带三段额外伤害。目录条目的 `mechanics.plus` 和生物动作的 `damage.plus` 各为 `{ dice?, flat?, type?, save?: { save,
difficulty?, onSuccess: "none" | "half" } }`：独立掷骰、拥有自身类型、暴击时各自翻倍、目标各自豁免，但整击仍只做一次专注检定和一次倒下检定。
- `combat.attacks[].strikes` 是值引用，指定消耗一次该列表额度可换多少次攻击。剩余次数保留到回合结束；还有余量时，该列表所有行都不消耗额度。
- `mechanics.free` 不消耗额度；`mechanics.gives` 仅为本回合返还额度，并受接收处上限限制；`mechanics.standard` 允许持有者用另一个额度购买具名标准动作。声明 `gives` 或 `standard` 的 `utility` 条目会提供给用户，而非丢弃。
- 新条目类型 `rider` 及生物自身的 `riders` 会为回合或轮次内首次符合条件的命中添加伤害段。它被动触发，从不进入菜单。
- 封闭的状态效果列表增加 `own-saves-advantage`、`own-saves-disadvantage`、`resist-all`、`cannot-target-source`、`cannot-approach-source`。状态可用 `saves` 缩小影响的豁免范围，用 `whileSourceInSight` 限定仅在来源可见时生效，或用 `endsWhenSourceDown` 在来源倒下时结束。

```json
{
  "capabilityApi": { "major": 1, "minor": 29 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

与 1.20 到 1.28 同理，这不是软接口：无法读取这些键的 Engine 会拒绝整个规则集文件或包含它们的目录文件，因此安装会读取 `ruleset.json` 及每个已声明 `catalogs/<id>.json` 的验证后字节，在旧版本声明下拒绝其中任一个。无需权限，未声明任何新增项的规则集不变。

### Capability API 1.28：棋盘上的规则集战斗

规则集的 `combat` 块可以通过 `distance: { label, perCell }` 指定战场每格对应的自身距离，这才使战斗具备位置。旁边的 `ranged` 指定超出正常射程或邻格有敌人时射击的代价；`cover` 指定遮挡物为攻击所对抗的防御增加多少；`opportunity` 指定攻击离开者要消耗的额度。攻击列表可以为其行提供 `reach` 和 `range`，取自列表某列或统一声明一次。生物动作的 `range` 也可以是 `{ "normal": 30, "long": 120 }`，而非单一数值。

```json
{
  "capabilityApi": { "major": 1, "minor": 28 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

未声明 `distance` 却声明 `ranged`、`cover`、`opportunity` 或武器触及范围、射程的规则集会在导入时被拒绝，因为没有可测量的格子，这些声明都无意义。棋盘本身使用战术战斗样式自己的生成器、地形和部署，因此该级别不增加第二个战场模型，也不增加权限。

与 1.20 到 1.27 同理，这不是软接口：无法读取这些键的 Engine 会拒绝整个规则集文件，或含有双值射程生物的目录文件。因此安装会读取 `ruleset.json` 和每个已声明 `catalogs/<id>.json` 的验证后字节，在旧版本声明下拒绝任一个。未声明距离的规则集不变。

### Capability API 1.27：规则集生物图鉴

规则集目录可声明 `"holds": "creatures"`，携带生物数据块而非人物卡行。生物按 `combat` 块已声明的数值书写：生命可以是数值或开战时掷出的骰子，另有防御、先攻调整值、以人物卡自身 ID 指定的属性值与豁免调整值、抵抗/易伤/免疫的伤害类型、绝不会陷入的状态、威胁等级、展示给 GM 的特征，以及可命中、要求豁免、施加状态、限定次数、按充能掷骰恢复、以一次额度顺序执行区块其他动作，或用生物自身特色点数购买的动作。

```json
{
  "capabilityApi": { "major": 1, "minor": 27 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/beasts.json"] } }
}
```

生物目录不声明 `feeds`，也不进入人物卡编辑器的选择器，因为读取者是战斗而非人物卡。读取它的是战斗导演的 `ruleset` 样式，不需要自己的 Capability API 级别：它直接使用已安装规则集所带的 `combat` 块和图鉴。

与 1.20 到 1.26 同理，这不是软接口：无法读取 `holds` 或条目 `creature` 的 Engine 会拒绝整个规则集文件或包含它的目录文件。因此安装会读取 `ruleset.json` 及每个已声明 `catalogs/<id>.json` 的验证后字节，在旧版本声明下拒绝任一个。无需权限，没有图鉴的规则集不变。

### Capability API 1.26：规则集战斗

规则集可以带一个可选的顶层 `combat` 块，说明战斗如何按它自己的数值结算：掷什么、对抗什么，行动经济，人物卡上哪些列表是攻击、哪些是能力，它的状态有什么效果，专注，角色降到零时会怎样，它有哪些伤害类型，以及挑选对手所依据的强度等级。同一版本还让目录条目的 `mechanics` 可以说明它作用于多少个目标、是否必定命中、施加哪些状态、给予多少临时点数、如何随人物卡成长，以及消耗哪种额度。

```json
{
  "capabilityApi": { "major": 1, "minor": 26 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

声明 `combat` 的规则集游戏，在战斗导演启用时，会在战斗界面按该块结算。没有它的规则集仍按之前的 `battle` 块或玩家的 Classic、Tactical 偏好作战。

与 1.20 到 1.25 同理，这不是软接口：无法读取 `combat` 或新 `mechanics` 键的 Engine 会拒绝整个规则集文件或包含它们的目录文件。因此安装会读取 `ruleset.json` 及每个已声明 `catalogs/<id>.json` 的验证后字节，在旧版本声明下拒绝任一个。无需权限，两者都没有的规则集不变。

### Capability API 1.25：层与世界指引

规则集可声明可选的顶层 `layers` 数组，即 Low magic、Hard winter 等具名变体，供玩家创建游戏时启用，并固定在该游戏的版本信息中直至游戏结束。同一发布还为基础 `gm` 块增加可选 `worldGuidance` 字符串；世界生成在设置时读取一次，让背景符合队伍实际使用的规则。

```json
{
  "capabilityApi": { "major": 1, "minor": 25 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

层效果为封闭集合，全部是收窄或追加：在规则集自身指引后追加指引、从 enum 字段移除值、用相同结算类型的难度阶梯替换原阶梯，以及从人物卡编辑器选择器隐藏目录项。不新增任何条目，因此无论游戏选择哪些层，人物卡都能读取；层不带包代码，也不增加模型调用。规则集作者以外的人提供的层留待后续支持。

与 1.20 到 1.24 同理，这不是软接口：不认识 `layers` 或 `gm.worldGuidance` 的 Engine 会拒绝整个规则集文件，因此安装读取 `ruleset.json` 验证后的字节，并在旧版本声明下拒绝任一个。无需权限，两者都没有的规则集不变。

### Capability API 1.24：dice-pool 结算类型

规则集的 `resolution` 可以声明 `"kind": "dice-pool"`，而不是 `"dice-sum"`。这时检定会按人物卡上的数值掷出相应数量的骰子，并统计达到目标值的骰子数，还可以选用双倍计数的点数、爆骰点数、抵消成功的点数、大失败、卓越成功，以及 Game Master 在单次检定中可以增减的情境骰子范围。

```json
{
  "capabilityApi": { "major": 1, "minor": 24 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

人物卡还是同一张人物卡：在 `dice-sum` 里加到掷骰上的数值，在这里就是骰子的数量。因此这种类型不带来新的人物卡词汇、编辑器槽位或包代码。

与 1.20 到 1.23 同理，这不是软接口：只认识 `dice-sum` 的 Engine 会拒绝整个规则集文件，因此安装会读取经过验证的 `ruleset.json` 字节，并在旧版本声明下拒绝 `dice-pool` 结算方式。无需权限，求和掷骰的规则集不变。

### Capability API 1.23：随角色变化的目录数值

目录条目的行可以带一个可选的 `scaled` 映射：该行自己最多四个数字列，它们的值由规则集维护，而不是由玩家填写。每一列都是一个普通的数值引用，可附带阶梯表，因此职业资源可以随等级变化、能力的使用次数可以随属性值变化，而格式无需学会任何新的算术。

```json
{
  "capabilityApi": { "major": 1, "minor": 23 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/spells.json"] } }
}
```

数值在编辑人物卡时计算，读取时不计算，因此实时状态、Game Master 提示词块和战斗桥接都继续读取已保存的数字。

缩放行可以内嵌在 `ruleset.json` 里，也可以放在 `catalogs/<id>.json` 资源中。清单把两个文件都声明为资源，但看不到其中的键，因此安装会读取两者经过验证的字节，在低于 1.23 的声明下拒绝 `scaled` 键，方式与 1.21 的 `catalogs` 和 1.22 的 `battle` 完全相同。旧 Engine 的严格模式本来也会拒绝包含它的文件。无需权限，目录中没有缩放行的规则集不变。

同一版本还新增了 `[sheet: op="use" name="..."]` 命令，它会支付目录条目的 `mechanics.cost`，并从该条目写入的每个行资源池中扣除一次使用。它不需要声明：它读取的是 Engine 已经提供的目录。

### Capability API 1.22：battle 块

规则集可以带一个可选的 `battle` 块，把人物卡上的数值借给战斗使用：作为生命值的实时资源池、一个可选的会变成 MP 的资源池、变成法术位的资源池，以及哪些人物卡列表中带目录标记的行会变成 Engine 自己的 `CombatSkill`。战斗结束时，战斗中消耗的生命值、能量和法术位会通过玩家自己的按钮所用的同一套人物卡操作写回。

```json
{
  "capabilityApi": { "major": 1, "minor": 22 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

这不是战斗适配器。伤害计算仍由 Engine 负责，目录条目上的 `attackRoll`、`save`、`concentration` 和 `perCostStep` 没有任何地方读取：符合规则的精确结算属于战斗交接文档中按规则集划分的适配器。`coverage.combat` 保持自己的含义，桥接从不读取它。

这个块位于 `ruleset.json` 里，清单看不到它，因此安装会读取经过验证的字节，在低于 1.22 的声明下拒绝 `battle` 键，方式与 1.21 的 `catalogs` 完全相同。旧 Engine 的严格模式本来也会拒绝整个规则集文件。无需权限，没有 `battle` 块的规则集不变。

### Capability API 1.21：规则集目录

规则集可以附带**目录**：成组的现成条目（法术、职业能力、装备），人物卡编辑器会在选择器中提供它们，这样玩家就不必逐行输入列表。目录头位于 `ruleset.json` 的 `catalogs` 下；条目要么内联在这个目录头里，要么放在自己的保留资源中，每个目录一个文件：

```json
{
  "capabilityApi": { "major": 1, "minor": 21 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/spells.json"] } },
  "files": [
    { "path": "ruleset.json", "sha256": "<sha256>", "bytes": 25767 },
    { "path": "catalogs/spells.json", "sha256": "<sha256>", "bytes": 418204 }
  ]
}
```

`catalogs/<id>.json` 是一个保留的资源系列：文件名就是目录自己的 ID，因此 Engine 只凭规则集就能找到文件，任何目录都不能指向另一个目录的文件。目录资源和其他声明的资源一样在 `files[]` 中固定哈希，只会和声明它的 `ruleset.json` 一起发布，并且在读取前就会因声明大小超过 2 MB 而被拒绝（Capability API 1.340 之前为 1 MB；目录文件超过 1 MB 的包要声明 1.340）。它的内容与内联条目经过同样的检查，针对的也是同一张人物卡，所以目录绝不会写入人物卡容纳不了的行。每个规则集最多 12 个目录，每个目录最多 2000 个条目。

客户端只在打开选择器时才获取目录，途径是 `GET /api/capability-packages/rulesets/catalog?rulesetId=&catalogId=&version=`。已安装规则集列表从不携带内联条目，只带数量，因为每次打开人物卡编辑器都会读取它。目录文本绝不会进入提示词：Game Master 仍然只看到 `gm.sheetSummary` 指定的内容，所以目录不消耗任何 Token。

与 1.20 一样，这不是软接口；而且因为目录位于规则集文件内部而不在清单中，门槛分为两半。声明 `catalogs/<id>.json` 资源需要 1.21；清单声明的版本更低时，带有 `catalogs` 键的 `ruleset.json` 会在安装时被拒绝，因为旧 Engine 的严格模式本来也会拒绝整个规则集文件。和之前一样，无需权限。

### Capability API 1.20：Game Mode 规则集

规则集就是以经过验证的数据表达的游戏规则：一种 Engine 已经实现的结算类型、一张由封闭的基本元素集合声明出来的人物卡、休息规则，以及给 Game Master 提示词的指引。包以保留文件名的资源 `ruleset.json` 发布它，并像 `gm-verbs.json` 一样按约定发现：列在 `contributions.assets.paths` 中，并在 `files[]` 中固定哈希。

```json
{
  "schemaVersion": 2,
  "capabilityApi": { "major": 1, "minor": 20 },
  "id": "ruleset-5e-2014",
  "kind": ["ruleset"],
  "permissions": [],
  "entrypoints": {},
  "contributions": { "assets": { "paths": ["ruleset.json"] } },
  "files": [{ "path": "ruleset.json", "sha256": "<sha256 of the file>", "bytes": 25767 }]
}
```

示例只列出与规则集相关的键；常规的清单字段（`name`、`version`、`description`、`engine`、`builtAgainst`）仍然必填。

规则集包不需要权限、服务器或客户端入口，也不需要智能体。类型和资源必须同时存在：类型为 `ruleset` 的包必须列出 `ruleset.json`，列出 `ruleset.json` 的包也必须声明这个类型，所以规则集无法借其他类型混进来。文件中的任何内容都不会被执行：没有表达式字符串；任何结算类型都表达不了的机制，需要修改 Engine 来增加一种结算类型，不是规则集能做到的事。格式、第一方 5e 文件以及它采用这种结构的原因，见 [`game-rulesets-and-sheets-implementation.md`](game-rulesets-and-sheets-implementation.md)。

这不是软接口。规则集包在读不了它的 Engine 上什么也做不了，所以列出 `ruleset.json` 的清单必须声明 Capability API 1.20，旧 Engine 会明确拒绝安装。

Engine 在读取前就会拒绝声明大小超过 512 KB 的资源（Capability API 1.340 之前为 256 KB；规则集超过 256 KB 的包要声明 1.340），然后按安装时的哈希重新验证，并用严格的共享模式（`packages/shared/src/schemas/ruleset.schema.ts`）校验。无法使用的文件会被丢弃，并记一行日志，写明包名和最先出现的几项 `path: message` 问题。两个包声明同一个规则集 ID 时，按包 ID 顺序取第一个，另一个被丢弃并记一行日志。`engine-legacy` 和 `traditional` 是 Engine 自有的 ID，文件不得占用。

游戏在创建时把规则集固定一次，记为 `chat.metadata.gameRuleset`。没有固定引用就使用 Engine 自身的规则，与以前完全一样。安装状态无法兑现的固定引用（包已不存在，或已安装的定义比固定的版本更旧）会报告为不可用，绝不会被重新解释成另一个规则集。固定引用按规则集 ID 和提供它的包一起匹配，所以另一个声明相同 ID 的包不会接管已有的游戏。

### Capability API 1.73：虚拟形象智能体

Engine 托管两个虚拟形象智能体：`2d-avatars`(PNGTuber 立绘和网格虚拟形象) 和 `3d-avatars`(VRM 模型)。它们的包保持精简，各自只有一份智能体定义、默认提示词、本地化文本和目录条目。其余部分都归 Engine 所有：`DATA_DIR/avatar-models/` 下按所有者划分的存储、导入、懒加载的渲染器、各智能体在智能体编辑器页面上的设置、流式指挥器（stream director）、表情分类器和生成路由。共享契约是 `packages/shared/src/types/avatars.ts`(其结构定义在 `schemas/avatars.schema.ts` 中)，客户端那一半是 `packages/client/src/features/avatars/contract.ts`。用户指南是 [`docs/agents/avatars.md`](../agents/avatars.md)。

没有新增清单字段。虚拟形象包声明架构版本 2 和 Capability API 1.73，因此缺少这些宿主接口的 Engine 会拒绝安装，而不会列出一个什么都不显示的智能体。引入 1.73 的那次改动只把这些接口作为不起作用的占位实现发布；现在 Engine 的设置界面、舞台和渲染器都已进入 `staging`，这两个包也已列在预览目录中。它们引用的产物 URL 必须先发布，安装才能成功；仅有目录条目并不能证明对应的可下载产物可用。2D 智能体的生成提示词作为 `defaultSettings` 中的 `avatarGenerationTemplates` 提示词模板集合发布，其 ID 列在 `AVATAR_PROMPT_TEMPLATE_IDS` 中；智能体编辑器会像处理其他内置模板集合一样合并和重置它们。

### Capability API 1.72：Experience 的地图包

通过 Game 向导进行设置的 `game-surface` 包（`gameSurface.setup`，1.18）可以用架构版本 2 和 Capability API 1.72 附带一个地图包：它自己的设定包、用这个设定包构建的现成世界，以及它自己的图块包。每一项都是 Game Mode 和 Pixelforge 已经在读写的共享文件（一个 `.worldkit.json`、若干 `.world.json` 文件和一个 `.tilepack.json`），同时也都是已声明、固定哈希的资源。

```json
{
  "gameSurface": {
    "setup": {},
    "mapPack": {
      "kit": "map/riverlands.worldkit.json",
      "worlds": ["map/upriver.world.json", "map/downriver.world.json"],
      "tiles": "map/riverlands.tilepack.json"
    }
  },
  "assets": {
    "paths": [
      "map/riverlands.worldkit.json",
      "map/upriver.world.json",
      "map/downriver.world.json",
      "map/riverlands.tilepack.json"
    ]
  }
}
```

`worlds`(最多 32 个) 和 `tiles` 是可选的。世界文件可以带上它的世界故事脚本（worldgen W10），这个脚本作为地图的一部分随地图一起发布。版本 2 的世界文件还带有世界的 `snapshot`，也就是世界生成时的原样（W11）：世界生成器此后有所变化的 Engine 会从中读取世界，并完全按生成时的样子还原，因此地图包在 Engine 更新后依然可用。请通过游戏或资料库世界的 **Download**(下载)（或 `GET /api/game/:chatId/world/file`）写出这些文件，它们包含快照。地图包里的单个文件最大 8 MB，这是 Engine 读取的共享文件的最大尺寸（图块包保留自己更小的上限），所以文件更大的世界（非常大的世界快照）无法放进地图包。故事设置了 `intro` 的世界需要 Capability API 1.339(见[开场消息](../extending/writing-story-scripts.md#the-intro-message))。`tiles` 可以是图像图块包（图块包版本 2：网格单元上的 PNG 图集，精灵可以占据多个单元），这需要 Capability API 1.80；Engine 对每个包版本只解码并检查一次图集。开启这个 Experience 后，新游戏会锁定为地图包的设定包；如果地图包附带世界，玩家只能从中选择一个（含故事），不能另做世界。关闭这个 Experience，玩家自己的选择就会回来。`POST /api/game/create` 对游戏施加同样的锁定。游戏像任何游戏一样保留它的设定包和世界，所以即使移除了包也能继续玩；只要包仍然安装，就会用地图包的图块绘制它的大地图和城镇。

Engine 通过经过验证的资源路径读取这些文件（每个文件声明的大小最多 8 MB，并重新检查哈希），并像检查共享文件一样检查它们。只要有一个文件读不了、某个世界是用另一个设定包生成的或与设定包不符，或者文件字节不是已安装的那些，整个地图包就会被拒绝，并说明原因；这时这个 Experience 就无法开始游戏。规则集绝不会是地图包的一部分：需要自己规则的 Experience 要单独发布一个规则集包。

### Capability API 1.18：在 Game 向导中保留 Experience 设置

`game-surface` 包可以使用架构版本 2 和 Capability API 1.18 声明 `contributions.gameSurface.setup`。Engine 保留通常的七个设置步骤，包括 Party、目标、模型和世界书。只有新游戏提供 Experiences；重新打开已有游戏的设置会保留其 Experience 和包配置。没有此声明的包继续使用原有的设置对话框。

```json
{
  "setup": {
    "seed": { "key": "seed", "label": "World seed" },
    "config": { "generate": true, "packWanted": true },
    "requires": { "enableCustomWidgets": false }
  }
}
```

三个字段均为可选。声明的种子会显示在所选 Experience 下方，并带有 Randomize 按钮。种子是 0 到 4294967295 之间的无符号整数；空白、小数、负数、指数或十六进制输入都会阻止 Start。宿主将数值种子和声明的常量写入 `experienceConfig`；`config` 不能包含种子键。常量序列化后不得超过 8,000 个字符。种子标签是包作者提供的显示文本；省略它即可使用 Engine 的本地化标签。

声明的小组件要求在 Experience 处于启用状态时强制生效。宿主把控件设为声明的值并锁定，同时说明是哪个 Experience 设置的。导入设置文件无法覆盖声明的值。玩家自己之前的选择原样保留，一旦关闭这个 Experience 就会恢复。这些 Experiences 会隐藏空间地图设置控件，因此不会启动单独的地图草稿、模板或构建器。

Lorebooks 步骤最多可选择 100 条已启用的单独条目，也包括尚未附加的世界书中的条目。已禁用的世界书、条目和聊天排除设置都会得到遵守。这些 ID 通过 `GameSetupConfig.activeLorebookEntryIds` 传递。在 `/game/setup` 中，它们作为额外的强制条目加入：跳过概率判定，但仍受常规 Token 上限约束。全局、绑定角色和已附加的世界设定仍参与常规扫描。包也可以从设置配置中读取同一组已选 ID，用于自己的世界生成请求。导入的条目 ID 如果在这台机器上不存在，会报告并跳过。

导入设置文件时，会恢复已安装且兼容的 Experience 及其有效数值种子，但会丢弃任意包配置。常量由当前清单重新提供。文件里没有可用的 Experience 种子时，预先填好的随机种子保持不变。已有游戏会跳过 Experience 导入并说明原因。创建快照会保留 Experience 名称和种子，用于设置摘要。

如果世界必须在首个回合前准备完毕，请独立使用现有的启动就绪声明。将 API 1.18 声明为包的最低要求；旧宿主无法理解此设置声明。

### Capability API 1.71：按智能体读到的样子读取消息

在 Roleplay 中，一条消息可以带有不属于其 `content` 的耳语。Engine 运行的每个智能体都会读到这些耳语，现在自行读取聊天的包也能读到同样的文本。`persistence.listMessages(chatId)` 返回的每条记录都多了 `agentContent`：即 Engine 智能体读到的消息。每条耳语都留在原位，标为 `[Private whisper to <name>: …]`；只有耳语的消息，读到的就是它的耳语。角色递交的文档（例如一封信）跟在消息后面。玩家的私人笔记不包含在内。

`agentContent` 只在 Roleplay 聊天中存在。其他模式下没有它，房主主持的多人模式房间里也没有，那里所有人都能看到智能体写出的内容。`content` 始终不变：它仍是公开文本。`extra` 也不变：它是消息保存的数据，在任何模式下都包含每一条耳语。绝不要把由它生成的文本展示给耳语对象以外的玩家或角色。

```ts
const messages = await api.runtime.persistence.listMessages(chatId);
const history = messages.map((message) => message.agentContent ?? message.content);
```

这是软接口：旧 Engine 不提供这个字段，因此读取 `agentContent ?? content` 的包无需声明 1.71。它和 `listMessages` 一样需要 `chat-read` 权限。耳语是私密的：包根据耳语写下的任何内容，例如一条笔记或一段记忆，都可能传到耳语对象以外的角色那里。

### Capability API 1.68：把搜索查询作为查询嵌入

`embeddings.embed(texts, signal?, inputType?)` 接受第三个参数：搜索文本要传 `"query"`，例如召回查询。文本默认为 `"document"`。有些嵌入模型要求给查询加前缀，有些还要求给文档加前缀：e5 和 nomic-embed-text 对两者各加一个，Snowflake Arctic Embed v2 只给查询加。Engine 会加上正确的前缀。查询被当作文档嵌入时，召回效果会变差。其他模型，包括内置的 MiniLM 嵌入器，无论哪种类型都不加前缀。输入类型不会改变 `spaceId`，因此已存向量仍可比较，无需重新嵌入任何内容。

```ts
const embeddings = await api.runtime.resolveEmbeddings();
const [queryVector] = (await embeddings.embed([query], signal, "query")) ?? [];
const memoryVectors = await embeddings.embed(memoryTexts, signal); // documents
```

这是软接口：旧 Engine 会忽略第三个参数，因此包始终可以传入它，无需声明 1.68。输入类型要作为第三个参数传入，绝不要放进选项对象：旧 Engine 会把第二个参数直接作为中止信号交给服务商。

### Capability API 1.67：在编辑器中打开角色

浏览器视图新增 `openCharacter(characterId, { tab })`。它会打开角色编辑器，有指定标签页时就打开到该标签页，这样包可以把用户带到它所读取的角色卡字段。旧 Engine 没有这个方法：显示链接前，先检查 `openCharacter` 是否存在。

```ts
if (typeof props.openCharacter === "function") props.openCharacter(characterId, { tab: "convo" });
```

### Capability API 1.66：来自包对话线程的场景

角色扮演场景通常从 Conversation 分支出来（`/scene`）。持有新权限 `scenes` 的包可以让它自己的对话线程（比如私信线程）作为场景的起点。这个场景就是普通的场景聊天：同样的规划器、提示词偏好对话框、场景指令、End Scene、Discard 和 Convert 控件，结束时也同样写入角色记忆。线程那一侧归包负责：规划器读取什么、场景进行期间的锁定，以及回顾摘要如何处理。

```ts
export async function activate({ api }) {
  api.registerSceneOrigin({
    // Planning context, or null when the thread no longer exists.
    getContext: async (threadId) => ({
      characterIds: [creatorCharacterId],
      personaId,
      connectionId: null, // the Engine's default connection
      transcript: [{ speaker: "Mina", content: "Come to my shoot tonight?" }],
      notes: "Stage persona, limits and anything else the scene writer must respect.",
    }),
    // Lock the thread. Return false when it already has an active scene.
    claim: async (threadId, { sceneChatId, characterIds }) => lockThread(threadId, sceneChatId),
    // Unlock and receive the outcome.
    release: async (threadId, end) => {
      if (!(await holdsLock(threadId, end.sceneChatId))) return;
      if (end.kind === "concluded") await saveRecap(threadId, end.summary);
      await unlockThread(threadId);
    },
  });
}
```

浏览器视图（`home-browser-tab`）会收到这些属性：

- `startScene({ originId, prompt?, planHint?, plan?, data?, initiatorCharacterId?, initiatorName? })` 会打开场景提示词偏好对话框，规划并创建场景，然后打开它的聊天。传入 `plan`(一个 `SceneFullPlan`：名称、描述、隐藏情境、第一条消息、场景系统提示词、分级、关系历史、参与指南、背景、角色阵容) 就可以自己编写场景；这时会跳过对话框和 Engine 规划器，场景完全按计划创建。它解析为 `{ chatId }`；用户取消或创建失败时解析为 `null`(用户会看到原因)。这个辅助函数始终使用包自己的 ID。它只是便利工具，不是安全边界：场景路由接受任何包 ID，所以 `getContext` 只能返回玩家在那个线程里本来就能看到的内容。
- `openChat(chatId)` 会跳转到某个聊天，用于锁定线程上的“Go to scene”按钮。
- `focusSceneOriginId` 是用户从场景返回时（Back、End Scene、Discard）要显示的线程。显示之后调用一次 `onFocusSceneOriginHandled()`。

重要规则：

- `data` 是这个场景自己的设置，是一个最多 4,000 字符的普通 JSON 对象。Engine 会把它随场景保存，并传给 `claim(originId, { sceneChatId, characterIds, data })`，以及以 `end.data` 的形式传给 `release`，这样每个场景都可以自行决定：`claim` 可以不加锁就接纳场景（返回 `true`，什么都不保存），`release` 可以解锁但不接收回顾摘要，或者按场景要求的范围接收它。
- 只有 `getContext` 是必需的。只想启动场景的包可以省略 `claim` 和 `release`：这样什么都不会锁定，同一个起点可以同时运行任意数量的场景，场景结束时也不会传回任何内容（**Back**(返回) 仍会回到包）。只省略 `release` 可以加锁而不接收结果，只省略 `claim` 可以接收结果而不加锁。
- 每个包只有一个提供者；再次注册会替换它，停用会移除它。
- `characterIds` 必须是 Engine 中的角色；未知 ID 会被丢弃，没有任何已知角色的上下文会被拒绝。未知的 `personaId` 视为没有。`notes` 会截断到 8,000 字符，提供给规划器，并与对话记录一起作为隐藏上下文提供给场景编写者。
- `claim` 在场景聊天创建之后运行。返回 `false` 会以 409 丢弃场景聊天；抛出错误会以 503 丢弃它。`getContext`、`claim` 和 `release` 各有 8 秒时限：超时的 `getContext` 或 `claim` 算作失败（503，场景聊天会被移除），超时的 `release` 会记录日志后丢弃。
- `release` 会收到 `concluded`(带 `summary`、`description`、`scenario`、`rating` 和角色阵容)、`abandoned`、`deleted` 或 `converted`。它必须是幂等的，并且必须忽略没有持有锁的场景。抛出错误的 release，或者在包未激活时到达的 release，会记录日志后丢弃：无论哪种情况，场景聊天都保持结束状态，所以要通过 `chat-read` 读取场景聊天来清理过期的锁。它的元数据中有 `sceneStatus`，已结束的场景还有 `sceneSummary`。
- 对于来自包的起点，Engine 不会向任何 Conversation 写入内容。结束时的角色记忆与 Conversation 场景完全一样地保存。

声明的 `capabilityApi` 早于 1.66 时，清单中的 `scenes` 会被拒绝。

<a id="capability-api-150-professor-mari-actions"></a>

### Capability API 1.50：Professor Mari 操作

拥有新权限 `mari-actions` 的包可以向 Professor Mari 提供命名操作。它以自己的 ID 注册一个服务；Mari 的 `package_service` 工具列出所有操作，并在用户要求时执行其中一个。

```ts
export async function activate({ api }) {
  api.registerService("mari-actions:my-package", {
    list: () => [
      {
        name: "add-idea",
        summary: "Give a Creator an idea for a post.",
        inputs: { accountId: "The Creator.", text: "The idea." },
      },
    ],
    run: async (name, input, { signal }) => {
      const parsed = schemas[name]?.safeParse(input);
      if (!parsed?.success) return { ok: false, status: 400, error: "Invalid input." };
      return { ok: true, value: await doIt(name, parsed.data, signal) };
    },
  });
}
```

重要规则：

- 键必须是注册包自身的 `mari-actions:<package-id>`。缺少权限或使用其他包的 ID 注册会抛错，确保 Mari 执行的操作始终属于它所指的包。
- `list()` 返回 `{ name, summary?, inputs? }` 条目。名称由 1 至 80 个字母、数字、`.`、`_` 或 `-` 组成；其他条目不显示。Mari 会读取 `summary` 和 `inputs`，请用清楚的文字编写。仅前 50 个操作可见或可执行；每个操作最多向 Mari 展示 40 个输入，输入名截为 80 个字符，每段文本截为 300 个字符。`list()` 必须在 5 秒内返回，否则略过该包的操作。
- `run(name, input, { signal })` 只会接收列表中的名称和不超过 64,000 字符的普通 JSON 对象。输入来自模型，执行前须用自己的 schema 验证。返回 `{ ok: true, value }` 或 `{ ok: false, status?, error }`；Mari 只看错误文本的前 2,000 个字符。用户停止 Mari 或经过 5 分钟后，`signal` 会中止；Engine 此时不再等待，因此也应停止工作。
- Engine 在 Mari 读取前省略 `value` 中的数据 URL，并截断长回复。应返回 ID 和短文本，而不是文件。
- 列表查询是只读的。每次执行在 Mari 的 Permissions Mode 中都算变更：Plan 拒绝，Manual 等待用户 Accept。Engine 无法预览或撤销包操作，所以不显示 Keep/Restore 卡片。难以恢复的变更应提供自己的撤销操作。因此，Plan 也会拒绝只读操作。
- 停用或移除包会移除其操作。

声明的 `capabilityApi` 早于 1.50 时，清单中的 `mari-actions` 会被拒绝。

### Capability API 1.36：包成就

拥有新增 `achievements` 权限的包可以向主页的 **Achievements**(成就) 面板添加徽章、读取解锁状态，以及解锁徽章。面板会在 Engine 自身的徽章之后，用以包名称为标题的区块显示它们。

```ts
export async function activate({ api }) {
  api.registerAchievements([
    { id: "first_run", title: "First Run", description: "Ran the package once.", iconPath: "art/first-run.png" },
    {
      id: "ten_runs",
      title: "Regular",
      description: "Ran the package ten times.",
      target: 10,
      readProgress: () => runs,
    },
  ]);
  // Later, when the package decides a badge is earned:
  if (await api.runtime.achievements.unlock("first_run")) celebrate();
}
```

需要了解的规则：

- ID 使用 `<packageId>.<id>` 命名空间。内置 ID 没有点号，因此两者不会冲突。宿主接受本地 ID 或带命名空间的 ID，并拒绝该包未亲自注册的任何 ID。
- `unlock(id)` 只有在本次调用实际解锁了徽章时才返回 `true`。`isUnlocked(id)` 和 `list()` 读取状态；`list()` 返回该包自身的徽章及进度。
- 计数由包负责。分级徽章必须同时设置 `target` 和 `readProgress` 回调，或两者都不设置；当计数达到目标时，Engine 会在检查自身分级徽章的同一轮处理中将其解锁。请将计数器保存在持久化宿主中。回调若抛出异常，或未在 **2 秒**内完成，则报告为零并记入日志。与工具一样，这只限制异步等待：阻塞事件循环的同步工作无法被中断。
- `iconPath` 是包的资源根目录内的路径，通过包资源路由提供。锁定的卡片仍显示锁图标。图片加载失败时，卡片回退到 `icon`（默认值为 `trophy`）。
- `title` 和 `description` 是显示文本。语言包可以通过 `capabilityAchievements.<packageId>.<id>.title` 和 `.description` 覆盖它们。
- **每个包最多 32 枚徽章**。一批注册中只要有一个无效条目，整批就都不注册。
- 停用或移除包会隐藏其徽章。与 Engine 自身的徽章一样，解锁记录会保留，并在包恢复后再次显示。

`api.registerAchievements` 和 `api.runtime.achievements` 只存在于支持这一新版 API 的 Engine 中，因此使用它们的包需声明 `capabilityApi` 1.36。

<a id="capability-api-135-agent-home-widgets"></a>

### Capability API 1.35：智能体 Home 小组件

智能体包可为 Home 小组件网格提供最多三张卡片。Engine 不会自行放置；用户在 **Widget Manager**(小组件管理器) 中添加、隐藏、恢复和排序，卡片按智能体分组。Engine 管理网格、边框和布局，包负责卡片内部。

将 `home-widget` 插槽与小组件定义一起声明：

```json
{
  "schemaVersion": 2,
  "capabilityApi": { "major": 1, "minor": 35 },
  "kind": ["agent"],
  "permissions": ["ui"],
  "entrypoints": { "client": "client.js" },
  "contributions": {
    "slots": ["home-widget"],
    "homeWidgets": [
      {
        "id": "latest",
        "label": "Latest Posts",
        "description": "The newest posts from the feed.",
        "size": "large",
        "iconPath": "art/widget.png",
        "accent": "violet",
        "surface": "solid",
        "header": "banner"
      }
    ]
  }
}
```

- `id` 使用小写 kebab-case，最多 64 个字符，在包内唯一。
- `label`（1–80 字符）和 `description`（最多 200 字符）是 Widget Manager 的文本。语言包可通过 `localizations.<locale>.homeWidgets.<id>.label` 和 `.description` 覆盖。
- `size` 为 `compact` 或 `large`。大型小组件占更多网格空间。
- `icon` 是 Engine 图标名之一（`activity`、`bell`、`calendar`、`chart`、`circle`、`clock`、`file`、`flame`、`heart`、`image`、`list`、`message`、`sparkles`、`star`、`zap`）。`iconPath` 是包图片（`gif`、`jpg`、`jpeg`、`png`、`webp`），必须列入 `files[]`。
- `accent`、`surface` 和 `header` 从 Engine 的显示预设中选择。

如果包不是具有 `ui` 权限和客户端入口的 `agent`、插槽与 `homeWidgets` 未一起声明、两个组件共用 ID，或 `capabilityApi` 早于 1.35，安装会被拒绝。

Engine 用 `view="widget"` 挂载包的客户端元素。除常见的 `packageId`、`packageVersion` 和 `localization` 外，`capabilityProps` 还包含：

- `widgetId`、`widgetLabel`、`widgetDescription`、`widgetIcon`、`widgetIconPath`、`widgetAccent`、`widgetSurface` 和 `widgetHeader`：正在绘制的卡片定义，使一个 bundle 能绘制其全部组件。
- `active`：仅当 Home 显示且卡片可见时为 `true`。为 `false` 时暂停轮询和动画。
- `onOpenNoodle()`：打开包自己的 Home 浏览器标签页。虽然名称如此，但适用于所有声明了 `home-browser-tab` 插槽的包。没有该标签页时，它与 `onOpenPost` 都不执行任何动作。
- `onOpenPost(id)`：打开包自己的 Home 标签页并定位一项。`id` 是最多 128 字符的字符串；其他值忽略。标签页的 `view="browser"` 元素随后收到 `focusPostId: id`。显示该项后应调用 `onFocusPostHandled()`，避免重复聚焦。切换到其他标签页会丢弃待处理的聚焦。

小组件是智能体的小视图，不是第二个副本。保持轻量，更大的操作引导用户进入浏览器标签页。

### Capability API 1.34：按规则集自身术语编写生物

图鉴生物可以携带 `sheet`，即按规则集自身术语编写的人物卡，可按需要只填写部分内容。战斗以与队员完全相同的方式构建它，因此生命、防御、豁免、先攻、速度和列表能力都来自规则集自身声明，并从其自身资源池支付。此时不得在人物卡旁再提供 `health`、`defense`、`initiativeModifier`、`speed`、`abilities` 或 `saves`，也可以省略自己的区块动作。

```json
{
  "capabilityApi": { "major": 1, "minor": 34 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/creatures.json"] } }
}
```

门槛检查与 1.27 一样，读取规则集自身字节和安装包含的每个目录文件。生物人物卡上的行可用 `_catalog: "<catalog>/<entry>"` 指向为该列表供给条目的目录项，Engine 会随图鉴一起为战斗加载这些目录。与 1.20 到 1.33 同理，这不是软接口：无法读取该键的 Engine 会拒绝整个严格目录文件，因此提供它的包必须声明 1.34。无需权限。

### Capability API 1.33：反应等待的时刻

目录条目的 `mechanics.reaction` 可以是对象，而非 `true`。`on` 指定 Engine 察觉的时刻，`at` 指定所选动作指向谁，`cancels` 则阻止窗口所暂存的效果发生：

```json
{
  "capabilityApi": { "major": 1, "minor": 33 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/spells.json"] } }
}
```

`on` 为 `aimed`(效果落到条目持有者之前) 或 `harmed`(已经受到伤害之后)，指定它才会把条目放进对应窗口菜单。`at` 为 `source` 时自动填入引发该时刻者，为 `chosen` 时保留条目自身目标。只有 `aimed` 条目可以 `cancel`，因为已经发生的时刻不能撤销；被取消动作的成本仍然消耗，因为询问任何人之前已经支付。

仍只写 `"reaction": true` 的条目只说明它不在自身回合使用，不足以在任何位置提供，因此不会出现在菜单，也不需要更新的版本。与 1.20 到 1.32 同理，这不是软接口：无法读取该对象的 Engine 会拒绝整个严格目录文件，所以提供它的包声明 1.33。无需权限。

### Capability API 1.32：自行限制攻击次数的武器

攻击来源可声明 `strikesCappedBy`，即自身列表的一列布尔值。某行设为 true 时，无论列表的 `strikes` 可换多少次攻击，该行都只换一次。因此每回合只能发射一次的武器仍只射一发，而列表其他武器可按人物卡允许的次数攻击。它对应 SRD 5.1 的 Loading 属性：“使用动作、附赠动作或反应射击时，只能发射一份弹药，无论你通常能进行多少次攻击。”

```json
{
  "capabilityApi": { "major": 1, "minor": 32 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

必须同时有 `strikes`，否则拒绝，因为每次消耗只换一次攻击的列表本就把每行限制为一次。与 1.20 到 1.31 同理，这不是软接口：无法读取该键的 Engine 会拒绝整个规则集文件，因此提供它的包声明 1.32。无需权限。

### Capability API 1.31：宿主生成服务集成

服务端包可调用 `api.runtime.integrations` 使用当前 Engine 的 LLM、图像和视频服务。在包清单中声明 Capability API 1.31，并在激活时检查集成宿主是否可用。旧 Engine 会在激活包之前拒绝更高 API 要求。服务商操作需要 `network` 权限；保存、暂存和移除媒体需要 `storage`。

- `llm.createProvider(...)` 接受与 Engine 服务商工厂相同的连接设置，包括自定义请求参数和请求头。返回的服务商支持 `chat`、`chatComplete`、`embed`、`maxContextValue` 和 `maxTokensOverrideValue`，不公开凭据属性。
- `llm.localSidecar()` 通过同一门面返回宿主本地侧车服务商。
- `llm.withFallback(...)` 包装同一包宿主创建的服务商，保留 Engine 的准入、回退通知和服务商选择行为。
- `images.generate(...)` 和 `videos.generate(...)` 使用当前 Engine 实现，包括取消、请求日志、网络检查和媒体队列。调用方提供 `signal` 和 UI `debugMode` 时，请转发。
- `images.save`、`images.remove`、`images.stage` 和 `images.sweepStaged` 复用图库安全写入和暂存文件生命周期。`videos.save` 与 `videos.remove` 复用视频存储路径。`images.resolveNovelAiRequestSize` 复用宿主的 NovelAI 尺寸规范化。视频时长和公开参考上传规范化也可通过 `videos.resolveDuration` 与 `videos.resolveReferenceUpload` 使用。
- `speech.transcribe(audio, { filename, mimeType, signal })` 把录制的音频发送到用户在 **Connections → Speech to Text**(连接 → 语音识别) 中设置的语音识别服务器，并返回转写文本；该服务器关闭时返回 `null`，包据此继续使用自己的转写。它应用宿主的 URL 策略（`STT_LOCAL_URLS_ENABLED`）以及大小和时间限制，且从不暴露已保存的密钥。`speech` 是可选的，不需要更高版本的能力 API：检查 `typeof api.runtime.integrations?.speech?.transcribe === "function"`，在旧 Engine 上回退。

共享请求和结果类型由 `@marinara-engine/shared` 导出。包专属的提示词构建和流程编排应保留在包内；服务商 I/O 请调用这些宿主入口，而不要复制 Engine 服务实现。纯辅助函数和类型仍可打包。

### Capability API 1.341：宿主运行时服务和共享服务端库

如果服务端包把 Engine 服务的副本打进自己的包里，就会运行第二个实例，并维护独立的状态：独立的 Intiface 连接、连接准入、聊天元数据队列和服务注册表。Capability API 1.341 新增了能直接使用 Engine 当前运行实例的 `api.runtime` 成员，还允许服务端包直接使用 Engine 的一些库，不必自行打包。所有新成员在 `CapabilityRuntimeHost` 中都是可选的，使用前要检查是否存在。

- `runtime.services.get(key)` 返回某个包通过 `api.registerService` 注册的服务；服务不存在或共享房间正在生成时，返回 `null`。它读取 Engine 自己的注册表，因此每个包都能看到同一个服务。`agent-runtime:` 和 `mari-actions:` 键始终返回 `null`；这些键只有 Engine 自己读取。
- `runtime.commands.parse(content)`、`strip(content)` 和 `instructions()` 使用 Engine 的语法和所有包注册的标签读取 Conversation 命令。
- `runtime.logger.isLevelEnabled(level)` 表示 Engine 的日志器当前是否会记录该级别。
- `runtime.persistence.patchChatMetadata(chatId, patch, { touchUpdatedAt })` 使用 Engine 的队列修补元数据，每个聊天只有一个队列，与 Engine 自己的写入方共享，并保留共享房间保护和写入序号。补丁中的键会替换对应的键，其他键全部保留。`patch` 也可以是接收当前元数据的函数。在同一聊天的 `withChatLock` 内调用时，会在该锁内执行。与 `updateChatMetadata` 一样，它会拒绝新增对 Global Gallery 中已不存在图片的引用。
- `runtime.persistence.appendMessages(chatId, messages)` 批量添加消息，每条都带上第一条备选回复，并返回这些消息。`createChatNote` 和 `createChatInfluence` 会从 Conversation 向其连接的 Roleplay 添加笔记或一次性影响。这四个持久化成员需要 `chat-write`。
- `runtime.persistence.updateCharacterStatus(chatId, characterId, { status, activity, duration })` 会按 Engine 在
  Conversation 回复后采用的方式应用 `[schedule_update]`：在角色卡上设置临时状态，让这个角色在所有聊天里
  都显示该状态，直到状态到期。`status` 可以是 `online`、`idle`、`dnd` 或 `offline`，`activity` 最多
  500 个字符，两者至少要提供一个。`duration` 按命令使用的格式填写（`2h`、`30m`）；不填写或无法解析时，
  状态持续 60 分钟，而且最长不会超过一周。它返回 `{ status, activity, expiresAt }`，没有变化时返回 `null`：
  用户手动设置的状态仍然优先，共享房间也保留自己的日程。它会拒绝无效更新、不是 Conversation 的聊天，
  以及不在聊天中的角色，并且需要 `chat-write`。这个成员是在首批报告支持 1.341 的 Engine 之后加入
  Capability API 1.341 的，因此要检查 `typeof api.runtime.persistence.updateCharacterStatus === "function"`，
  如果没有这个方法，就跳过状态变更。
- `runtime.integrations.admission` 就是 Engine 的连接准入，因此包的后台任务会等待用户在同一连接上直接发出的请求。`withProvider(provider, connectionId, mode)` 包装同一个包的集成功能创建的服务商，`run(connectionId, mode, operation)` 执行一次尝试，`tryBackground(connectionId)` 在连接空闲时取得后台槽位，`isFailure(error)` 识别 Engine 的忙碌和拒绝错误。它只预约槽位，不需要权限。
- `runtime.integrations.haptics`（`status`、`connect`、`executeCommand`）使用 Engine 唯一的 Intiface Central 连接，需要 `network`。
- `runtime.integrations.spotify`（`commandsAvailable`、`playSong`）使用 Music DJ 智能体的 Spotify 账号。`playSong` 会以 `ConversationSpotifyCommandError` 拒绝；错误码 `spotify_unavailable` 和 `missing_playback_scope` 表示 Spotify 尚未设置，此时直接丢弃命令，不必提示。它需要 `network`。
- `runtime.integrations.speech.transcribeLocal(wav)` 使用在 **Connections**(连接) 中下载的 Local Whisper 模型转写 PCM WAV 录音；模型未下载时，以 Engine 的消息拒绝。它需要 `network`。
- `runtime.integrations.images.addToChatGallery(input)` 将通过 `images.save` 保存的图片列入聊天图库，`images.persistToEntityGalleries(input)` 则像 Engine 生成的图片一样，将它列入图中角色和用户角色的图库。两者都需要 `storage`。

**绝不使用打包的副本。** 缺少这些成员时，包会提示该功能需要更新的 Marinara Engine。它绝不会回退到自行打包的有状态 Engine 服务副本，例如服务商注册表、本地侧车、连接准入、触觉、Spotify、日志器、注册表或存储队列，因为第二个副本会拆散 Engine 集中维护的状态。纯辅助函数和类型仍可打包。

**共享服务端库。** 服务端包可以不把 `zod`、`adm-zip`、`dotenv`、`nanoid` 和 `jsonrepair` 打进包里，而是按名称导入，就像已有的 `@huggingface/transformers`、`onnxruntime-node`、`onnxruntime-web`、`sharp`、`pino`、`pino-pretty` 和 `undici` 一样。Node 从包的运行时副本出发，通过 `<runtime copy>/node_modules` 到 `DATA_DIR/capability-packages/node_modules` 再到 Engine 的 `packages/server/node_modules` 这两层链接解析模块，因此包得到的就是 Engine 使用的同一个模块实例。pnpm 只把服务端的直接依赖放在那里，所以只有这些名称能解析；像 `ws` 这样的间接依赖无法解析。Engine 把上述名称保留为 `packages/server` 的直接生产依赖，所有安装方式都维持这套布局：源码和启动器安装、Windows（数据链接为目录联接）、Android 和 Termux，以及两种 Docker 镜像。Engine 启动或激活包时，会重建任何指向别处的数据链接，也包括从另一安装路径移动数据文件夹后留下的悬空链接。不是链接的内容会原样保留。

**声明方式。** 使用这些功能的包需要声明 `schemaVersion: 2`、`capabilityApi: { major: 1, minor: 341 }` 和 `builtAgainst`，并保留 `engine` 版本范围。`schemaVersion: 1` 清单从不按能力 API 检查，因此需要改为版本 2。门槛是能力 API，而不是 Engine 版本：缺少这些成员的 Engine 会拒绝安装或更新（“Package requires capability API 1.341; this Engine supports ...”），将包排除在更新列表之外，并继续运行已安装的版本。
