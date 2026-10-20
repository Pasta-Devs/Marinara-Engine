# Engine 基础：系列概览

本页介绍 Engine 基础贡献（issue #6624）。原先的大型 pull request 已拆成 A 到 H 共 8 个较小 PR，便于独立审核。各部分都建立在 Marinara Engine 已正常运行的代码之上，不改名现有 API，不替换共享日志器，也不改变文件约定。影响所有人的行为变更会明确说明；其余功能在手动启用前均关闭。

<a id="the-pull-requests"></a>

## Pull request 列表

| PR | 内容 | 依赖 |
| --- | --- | --- |
| **A** | 基础：隔离回归运行、请求追踪与启动时间线、两个可选世界书设置、可选稳健性设置和运行时诊断、启动 inject 闸门、功能开关、尽力而为辅助函数 | 无（本 PR） |
| **B** | 编程助手用 Dev MCP（`tools/dev-mcp/`） | 无 |
| **C** | Ctrl+K 命令面板和 "?" 快捷键浮层（仅客户端，无开关） | 无 |
| **D** | 经审核的服务端修复，第 1 部分：路由和中间件、存储恢复、聊天与生成、导入器、边车进程和 SSRF | A |
| **E** | 经审核的服务端修复，第 2 部分：服务和存储 | A |
| **F** | 提示词缓存：Claude 订阅缓存标记修复、Agent SDK 更新、利于缓存的布局、低缓存发送前警告、缓存诊断 | A |
| **G** | 关闭标签页后继续的生成任务、任务查看器、Windows 控制台托盘 | A（命令面板操作还需 C） |
| **H** | Engine 诊断和启动器：构建完整性、内存遥测、提示词调试文件、后台调用上限、备份与就绪后打开、关闭推理相关的重试 | A |

A、B、C 相互独立，可按任意顺序审核。D 到 H 在 A 之后，使用其功能注册表（`isFeatureEnabled`，Settings > Advanced > Features）、日志追踪及尽力而为辅助函数，或扩展启动时间线与诊断路由。每个 PR 添加自己的开关、CHANGELOG 条目和本页章节。

A 的每一部分都说明现有实现、新增内容、保持不变的内容、验证方式以及关闭或撤销方式。

默认状态：改变存储数据、提示词、重试或服务器启动组件的功能均关闭，由环境变量或 **Settings > Advanced > Features**（设置 > 高级 > 功能，A6）控制。未启用时保持原有行为。没有开关的部分是修复、测试运行器和新增辅助函数，各节会注明。

撤销：A 的提交有先后顺序，部分文件重叠（`app.ts`、`index.ts`、`runtime-config.ts`、`capability-module-runtime.service.ts`、`CHANGELOG.md`）。从新到旧撤销可避免冲突。

多数检查使用现有回归运行器。先构建一次共享包（`pnpm build:shared`），再从仓库根目录执行命令。

---

<a id="pr-a-foundations"></a>

# PR A：基础

> **已变基到 Decision 模型更新。** Decision 调用已在需要它的请求内运行，因此携带该请求的 `requestId`。决策和工具边车在根日志上下文启动，后续记录不携带第一个请求者的 ID。失败的 Decision 槽位只写一条限频警告，而不是每回合多条。用户中止记为 info；丢弃的 Decision 陈述数量记为 warn，文本仅在 debug。关闭时以具名步骤停止两个边车。Decision 不经过提供商重试包装器，因此不会重复重试。

<a id="a1-test-harness-each-regression-file-runs-in-its-own-data-folder"></a>

## A1. 测试环境：每个回归文件使用独立数据目录

**现有实现。** `scripts/run-regressions.mjs` 查找回归并通过 `runRegression()` 逐个运行，处理超时和信号（`terminateActiveChild`、`releaseActiveChild`、`FILE_TIMEOUT_MS`）。每个子进程获得开发者完整的 `process.env`。服务器已支持用 `MARINARA_ENV_FILE` 改变 `.env` 位置（`packages/server/src/config/runtime-config.ts` 中的 `getEnvFilePath()`），`e2e/start-servers.mjs` 已用此方式隔离服务器。

**新增内容。** 小型辅助函数 `regressionEnvironment(scratchDir)`。`runRegression()` 为每个文件创建系统临时目录下的 `marinara-regression-*`，把子进程的 `DATA_DIR`、`FILE_STORAGE_DIR`、`MARINARA_ENV_FILE` 指向其中。无论成功、失败、超时或启动失败，结束后均删除。忘记自行隔离的回归不能再读取开发者 `.env`，也不会争用真实数据目录的写入租约。

**保持不变。** 函数、`--filter`/`--list`、超时、汇总、`package.json` 脚本和 CI 不变。自行设置变量的回归继续用自己的值。可见差异是 shell 导出的 `DATA_DIR`、`FILE_STORAGE_DIR`、`MARINARA_ENV_FILE` 被逐文件替换；这是有意且仅限测试的行为。

**验证方式。**

```sh
node scripts/run-regressions.mjs --filter env-watcher
```

之后临时目录中不应残留 `marinara-regression-*`。

**关闭／撤销方式。** 无开关，隔离是默认行为。撤销运行器提交即可恢复；先撤销更新的提交，它们仅共享 `CHANGELOG.md` 和 `CONTRIBUTING.md`。类似 `MARINARA_REGRESSION_INHERIT_STORAGE=1` 的退出选项只需几行，但为避免添加无人请求的设置而未提供。

---

<a id="a2-logging-follow-one-request-one-boot-and-one-failure"></a>

## A2. 日志：追踪一次请求、启动和失败

**现有实现。** `packages/server/src/lib/logger.ts` 导出共享 Pino `logger`。`protectTerminalLogger` 防止关闭终端导致服务器崩溃，`logDebugOverride` 支持 UI 调试开关。`CONTRIBUTING.md` 的 Logging 要求共享日志器、错误对象在前、格式说明符和四个级别，本改动均遵守。原先 `app.ts` 的 `buildApp()` 给 Fastify 自有选项，创建第二个同级别 Pino；`req-1`/`req-2` 请求计数每次启动重置。

**新增内容。** 详见 `docs/development/logging.md`，现由 `CONTRIBUTING.md` 的 Logging 引用。

- Fastify 使用共享日志器（`loggerInstance: logger`）。`req.log` 共用序列化器，通过 `followLogLevel` 跟随 `LOG_LEVEL` 热重载，并在关闭时取消订阅。这与 `CONTRIBUTING.md` 已有描述一致。
- 请求引发的每行日志都带 `requestId`，包括服务深处（`lib/log-context.ts`，`AsyncLocalStorage` 上下文加 Pino mixin）。ID 是 UUID 或格式有效的客户端 `x-request-id`，并通过 `x-request-id` 响应头返回供报告使用。
- 每行带 `bootId`，区分同一文件内的不同启动。
- 启动时间线 `lib/startup-timeline.ts`：`app.ts`/`index.ts` 中步骤由 `startup.phase("name", fn)` 包装。info 行 `[startup] Ready in N ms` 列出最慢步骤；启动失败会指出阶段。
- 每次失败一行：提供商和工具直接重新抛出，不先记录再抛出。一次生成失败只写一个 error。用户停止通过 `failureLevel(err)` 记 info，保留 `cause` 链。
- 健康检查、调度轮询、上下文贡献器的重复错误使用 `logRateLimited` 和 `suppressedRepeats` 计数。
- 模型输出、骰子请求、Spotify 令牌正文和视频轮询正文移至 debug；warn 仅写长度。
- 三个回归：`logging-request-trail`、`logging-failure-lines`、`logging-startup-timeline`。

**保持不变。** `logger` 的导出和文件名、`protectTerminalLogger`、`logDebugOverride`、`pid`/`hostname`、现有 `logger.*`/`req.log` 调用不变。Fastify 的 `LogController` 通过子类扩展而非替换。`LOG_LEVEL`（默认 `warn`）、`LOG_DISABLE_REQUEST_LOGGING` 不变。`pnpm dev` 控制台没有新增字段，因为 pino-pretty 隐藏 `bootId` 和 `hostname`。`CONTRIBUTING.md` 仅追加。

`logging.md` 中说明的行为变化：

- `requestId` 替换 Fastify 的 `reqId`；已有 `reqId` 过滤器需改名。
- 请求进入和未找到路由日志去掉可能含令牌的查询字符串。其他 `req` 字段保留，新增 `route`。
- 新增 info 行 `Client aborted request`，也可由 `LOG_DISABLE_REQUEST_LOGGING` 禁用。
- 启动步骤自身耗时 `selfMs`（不含子步骤）超过 15 秒时记 warn，默认可见。虽有嵌套（`app.build` 包含 `buildApp`），级别按自身耗时决定，因此一个慢步骤一行。

**验证方式。**

```sh
node scripts/run-regressions.mjs --filter logging-
```

或启动服务器、发送请求，用 `grep` 查找返回的 `x-request-id`。

**关闭／撤销方式。** `LOG_DISABLE_REQUEST_LOGGING=true` 仍关闭请求日志，`LOG_LEVEL=warn` 已隐藏新增 info。完全移除时，先撤销后续代码提交，再撤销日志提交。

---

<a id="a3-performance"></a>

## A3. 性能

两项默认关闭；关闭时提示词和存储数据与原先逐字节相同。文档位于 `.env.example` 和 `docs/CONFIGURATION.md` 的 Lorebooks 表。

<a id="a3a-stable-lorebook-group-winners-lorebook_stable_group_winners-switch-stablelorebookgrouppicks"></a>

### A3a. 稳定的世界书组获选项（`LOREBOOK_STABLE_GROUP_WINNERS`，开关 `stableLorebookGroupPicks`）

**现有实现。** `packages/server/src/services/lorebook/keyword-scanner.ts` 的 `applyGroupSelection()` 用加权抽选（`pickWeightedGroupEntry`）为每个包含组选一个获选项，优先保持激活的条目。随机源可注入（`random`，默认 `Math.random`），便于改动。每次生成重新抽选可能在其他条件不变时改变结果，从而改变提示词前缀并破坏缓存。

**新增内容。** 为 `applyGroupSelection`/`ScanOptions` 添加可选 `groupSeed`。启用时 `processLorebooks` 传入聊天 ID：同一聊天中相同的激活候选每回合选中同一项。不同聊天和候选集仍可不同。Active Context（活动上下文）已有的 `stableHash` + `createSeededRandom` 从 `lorebooks.routes.ts` 原样移到共享 `lorebook/seeded-random.ts`，共用一个生成器。A6 起也可用 **Stable lorebook picks**（稳定世界书选择）；环境变量优先。

**保持不变。** 名称和签名（新参数可选）、持续激活处理、权重不变。注入随机源仍控制概率门槛；启用时种子决定组结果，使 Active Context 与生成一致。关闭则不传种子，走原路径。

**验证方式。** `node scripts/run-regressions.mjs --filter lorebook-group-seed` 检查变量和开关。

**关闭／撤销方式。** 不设置 `LOREBOOK_STABLE_GROUP_WINNERS`，关闭开关。

<a id="a3b-compact-stored-lorebook-scans-lorebook_compact_stored_scans"></a>

### A3b. 压缩保存的世界书扫描（`LOREBOOK_COMPACT_STORED_SCANS`）

**现有实现。** 每条生成消息在 `extra.lorebookScan` 中保存激活条目全文，消息行和每个滑动变体都保存。Active Context 因而能显示准确的生成上下文，但长聊天和大型世界书会显著增大消息表。

**新增内容。** 启用后，Active Context 和智能体重试读取的最新助手或旁白消息在行及所有变体中保留全文，回切仍显示当时文本。模拟用户回合的扫描会压缩，绝不占据最新消息的位置。旧消息只保留 ID、名称、键和评分。压缩不在生成保存路径执行：后台任务压缩上一条消息，逐个处理消息队列。失败通过 `logRateLimited` 记录，下次保存重试。删除较新消息后，Active Context（`lorebooks.routes.ts`）和重试（`retry-agents-route.ts`，通过 `storedContentForTextlessScanEntries`）回退到条目当前保存的文本。`scripts/compact-lorebook-scans.mjs` 对旧聊天应用同一规则：默认试运行，服务器持有写入租约时拒绝，`--apply` 前备份两个表。

**保持不变。** 关闭时没有新写入，结构相同。扫描格式及 Active Context/重试路由响应不变，只有缺少文本才回退。两项默认修复仅影响缺文本的旧扫描：Active Context 显示保存文本而非空字符串，重试包含这些条目而非丢弃。

**验证方式。** `node scripts/run-regressions.mjs --filter lorebook-scan-compaction` 检查默认结构、回切变体、模拟回合、首次保存时清理旧消息、真实 Active Context 路由的回退及维护脚本。

**关闭／撤销方式。** `LOREBOOK_COMPACT_STORED_SCANS` 未设置或为 `false`。已压缩消息保持压缩，最新消息保留文本。`--apply` 的表备份可恢复旧结构。

---

<a id="a4-robustness"></a>

## A4. 稳健性

以下变化均由默认关闭的环境设置控制，见 `docs/CONFIGURATION.md` 的稳健性表及 `.env.example`。涉及不同文件，可单独审核、拆分或撤销。新参数和字段可选；本提交不动 `isRateLimitError`/`base-provider.ts`。

<a id="a4a-storage-writes"></a>

### A4a. 存储写入

**现有实现。** `packages/server/src/db/file-backed-store.ts` 通过 `serializeTableRows()`/`atomicWriteFile()` 刷写变更分片和 `manifest.json`，保留 `.bak` 用于恢复。原子写入和备份设计保持不变。

**新增内容。**

- `STORAGE_SKIP_UNCHANGED_WRITES`：内容与本进程最后一次持久写入相同，且磁盘大小、mtime 一致时跳过。由 `.bak` 恢复的文件总会重写。
- `STORAGE_YIELDING_SERIALIZE`：大分片分成 12 毫秒片段序列化，向事件循环让出控制权。长聊天保存不阻塞其他请求，输出与 `serializeTableRows` 逐字节一致。

**保持不变。** 两项关闭时仍用 `serializeTableRows`、`beforeTableWrite`、`atomicWriteFile`。所有实际写入仍经 `atomicWriteFile`。

**验证方式。** `node scripts/run-regressions.mjs --filter robustness-storage-write`

**关闭／撤销方式。** 两项均不设置。

<a id="a4b-windows-boot"></a>

### A4b. Windows 启动

**现有实现。** 写入租约通过 `file-backed-store.ts` 的 `readBootId()` 识别 OS 启动，每次运行 PowerShell（Windows 约 1.5 至 2 秒）及 `reg.exe` 身份探测。

**新增内容。**

- `STORAGE_CACHE_WINDOWS_BOOT_ID` 按 OS 启动在 `DATA_DIR/.writer-boot-id.json` 缓存精确结果（`db/writer-boot-id-cache.ts`），不写入 `LOCALAPPDATA`。
- 始终启用：`reg.exe`/PowerShell 传入 `windowsHide`，无控制台启动不再闪现窗口，无其他影响。

**保持不变。** 租约逻辑和探测本身不变；关闭时每次启动探测。

**验证方式。** `node scripts/run-regressions.mjs --filter robustness-boot-performance`

**关闭／撤销方式。** 不设置，或删除 `.writer-boot-id.json`。

<a id="a4c-shutdown"></a>

### A4c. 关闭

**现有实现。** `packages/server/src/index.ts` 用 `shutdown(signal)` 处理 SIGINT、SIGTERM 及非 Windows 的 SIGHUP；重复信号记 warn 后忽略，设置 8 秒 `armShutdownDeadline`，等待全部运行时停止再 `closeDB()`。保留此顺序。

**新增内容。** `index.ts`/`app.ts` 使用 `lib/shutdown-signals.ts`/`lib/shutdown-steps.ts`：

- `SHUTDOWN_WINDOWS_CONSOLE_SIGNALS`：Ctrl+Break 和关闭控制台进行相同的正常退出，期限适配 Windows 约 5 秒限制。
- `SHUTDOWN_FORCE_EXIT_ON_REPEAT`：首次 Ctrl+C 后超过 1.5 秒的第二次按键强制退出。
- `SHUTDOWN_EARLY_FLUSH`：停止信号到达即刷写待保存数据。失败不在此重复记录；存储层已记录，并在关闭时重试。
- `SHUTDOWN_RUNTIME_STOP_BUDGET_MS`（最大 2500，默认 0＝等待全部）：信号关闭时，即使运行时挂起，预算用完也会 `closeDB()`。后两项仅用于信号关闭，`admin.routes.ts` 的 Advanced Settings 重启不变。
- 始终启用：三个运行时停止阶段具名，失败或超过 1 秒会记录阶段。

**保持不变。** 全关闭时信号相同、重复忽略、`closeDB()` 前等待全部停止、同样 8 秒期限。

**验证方式。** `node scripts/run-regressions.mjs --filter robustness-shutdown-safety`

**关闭／撤销方式。** 不设置。前两项需重启，环境监视器会提示。

<a id="a4d-provider-retry-on-transient-network-errors-provider_retry_transient_errors-switch-providerretry"></a>

### A4d. 提供商临时网络错误重试（`PROVIDER_RETRY_TRANSIENT_ERRORS`，开关 `providerRetry`）

**现有实现。** `packages/server/src/services/llm/rate-limit-aware-provider.ts` 的 `RateLimitAwareProvider` 对速率限制最多退避重试 `MAX_RATE_LIMIT_RETRIES` 次，尊重 `Retry-After`。`connection-fallback-provider.ts` 切换备用连接。二者正常工作；拒绝连接或 502 原本直接让生成失败。

**新增内容。** 拒绝/不可达连接及 502/503 最多重试两次，随机等待 0.5 至 2 秒（`Retry-After` 最多 5 秒），仅在文本或推理尚未到达用户前。504 和套接字重置不重试。存在可用备用的主连接（`transientRetry: false`）不适用，以保持快速切换。已有自身包装器的主连接也排除，例如能力包传给 `llm.withFallback` 的包装器。A6 起提供 **Retry failed provider calls**（重试失败的提供商调用）；环境变量优先。

**保持不变。** 速率限制安排、无随机抖动、回调不变。`isRateLimitError`/`base-provider.ts` 不动。

**验证方式。** `node scripts/run-regressions.mjs --filter robustness-provider-resilience`

**关闭／撤销方式。** 变量不设置，开关关闭。

<a id="a4e-runtime-diagnostics"></a>

### A4e. 运行时诊断

**现有实现。** `packages/server/src/routes/admin.routes.ts` 提供 `/request-timeouts` 等特权管理路由，但没有存储与能力运行时的统一只读视图。

**新增内容。** `GET /api/admin/runtime-diagnostics`（`lib/runtime-diagnostics.ts`），由 `requirePrivilegedAccess`、`no-store` 和每分钟 30 次的独立限制保护。显示驻留数据计数、变更表、最后刷写错误、各运行时是否活动及最后激活失败。可选钩子：控制器 `getStorageStats()`、`db/connection.ts` 的 `getFileStoreStats()`、`CapabilityModuleRuntime` 的 `runtimeState()`。

**保持不变。** 只读；不改变现有路由、响应或访问规则。

**验证方式。** `node scripts/run-regressions.mjs --filter robustness-runtime-diagnostics`，或以特权访问本地 `/api/admin/runtime-diagnostics`。

**关闭／撤销方式。** 不调用就不工作。删除时移除 `admin.routes.ts` 中路由及 `lib/runtime-diagnostics.ts`。

<a id="two-catches-that-used-to-be-silent"></a>

### 两个原本静默的 catch

按 CONTRIBUTING，`import.routes.ts` 的 SillyTavern 聊天头解析（仅错误类型，因 JSON 错误可能引用聊天内容）以及智能体激活问题传输（限频）改为 warn。

---

<a id="a5-startup-internal-requests-wait-until-route-registration-has-ended"></a>

## A5. 启动：内部请求等待路由注册完成

这是始终启用的修复，不是设置。

**现有实现。** `packages/server/src/app.ts` 的 `buildApp()` 注册核心路由，等待 `capabilityModuleRuntime.start(app)` 通过 `services/capability-packages/capability-module-runtime.service.ts` 的 `activateOne()` 逐个激活包，之后启动 `startServerAutonomousScheduler(app)`。内部 `app.inject()` 来自包的 `capability-route-registration.service.ts` 中 `runCapabilityInternalRoute()`、`server-autonomous-scheduler.service.ts` 的自主调度器及 `routes/generate/prompt-preview.ts`。首次 `inject()` 会启动整个 Fastify，之后不能添加路由、钩子或插件。后台任务（包的定时器或提前启动的工作进程）若在 `buildApp()` 仍在注册时调用 `inject()`，后续每个包都会报 "Root plugin has already booted"，下一个 `addHook` 抛错并停止服务器。`activateOne()` 的 `catch` 记录后执行 `capabilityPackageManager.rollbackRuntime()`，或保存状态及就绪状态 `"error"`。正常包也可能在以后启动中保持回滚或 `"error"`。

**新增内容。**

- `lib/fastify-inject-gate.ts`：`buildApp()` 创建实例后立即 `holdInjectUntilRegistered(app)`，在 `return app` 前释放。之前的 promise/回调式 `app.inject()` 等待注册完成，也能到达调用后新增的路由。保留的 `inject()` 抛错会交给回调。
- `activate()`/`selfCheck()` 本身属于注册，等待自己的内部路由会永久阻塞。`activateOne()` 在 `failInjectFastDuring()` 内运行二者，使直接 `inject()` 立即以 `InjectDuringRegistrationError` 失败（`code` 为 `MARINARA_INJECT_DURING_REGISTRATION`）。仅该包激活失败，启动继续。`activate()` 返回后触发的定时器像其他后台调用一样等待。
- 其他保留调用在 60 秒后记录带调用栈的警告，10 分钟后以同一错误拒绝，让卡住的启动明确失败。定时器解除引用，不会维持进程存活。
- `capability-module-runtime.service.ts` 的 `isHostLifecycleActivationError()` 识别 `AVV_ERR_ROOT_PLG_BOOTED`（"Root plugin has already booted"）及 `FST_ERR_INSTANCE_ALREADY_LISTENING`（"Fastify instance is already listening"）。此时不回滚、不持久化状态/就绪状态 `"error"`，保留版本与状态，下次正常激活。仅一条 warn，诊断仍记录。其他失败保留 error、回滚和 `"error"`。
- 回归：`startup-inject-gate`。

**保持不变。** `buildApp()` 返回后 `app.inject()` 恢复为无包装的 Fastify 原调用。链式形式（不带参数的 `app.inject()`）从不等待。注册顺序、路由、`runCapabilityInternalRoute()`、调度器、启动后激活/更新不变。运行服务器上的一个例外：UI 激活的包添加新路由仍收到 `FST_ERR_INSTANCE_ALREADY_LISTENING`，但新版本保持安装，待下次启动激活，不再回滚。调用方仍收到错误。

**验证方式。**

```sh
node scripts/run-regressions.mjs --filter startup-inject-gate
```

检查释放后运行与后加路由、回调、`activate()` 内快速失败、`activate()` 启动的定时器、用短测试值验证 10 分钟限制、`buildApp()` 安装/释放位置，以及主机生命周期错误在回滚前返回且仅警告一次。

**关闭／撤销方式。** 无开关。`MARINARA_INJECT_DURING_REGISTRATION` 是 `InjectDuringRegistrationError` 的错误码，不是设置。撤销启动 inject 闸门提交即可。

---

<a id="a6-feature-switches-settings--advanced--features"></a>

## A6. 功能开关：Settings > Advanced > Features

**现有实现。** 可选服务端行为是环境变量（A3/A4），没有统一 UI；每个新选项都要独立设置、路由和界面。

**新增内容。** 一个注册表与一个设置章节，后续 F/G/H 扩展。详见 `docs/configuration/features.md`。

- `packages/shared/src/schemas/feature-settings.schema.ts` 定义名称与默认值，`features` 的单个 JSON 只保存偏离默认的值。
- 两个开关：**Stable lorebook picks**（`stableLorebookGroupPicks`，A3a）、**Retry failed provider calls**（`providerRetry`，A4d）。
- `services/features/feature-settings.ts` 的 `isFeatureEnabled()` 读取内存副本，避免频繁路径开销。注册设置路由时加载；每次写入/删除该行、相关 Professor Mari 数据库命令及 `.env` 重载后更新。提供 `GET` 和 `PUT /api/app-settings/features`，`PUT` 严格校验。
- 已设置的环境变量对开启和关闭均优先。`LOREBOOK_STABLE_GROUP_WINNERS`/`PROVIDER_RETRY_TRANSIENT_ERRORS` 改为固定开关，而非单独读取。
- 客户端在 Settings > Advanced > Features 列出全部开关，固定项锁定并显示变量名。其他组件用 `useFeatureEnabled()`。

**保持不变。** 全部默认关闭；不打开此章节的安装行为如旧。原有变量效果不变。

**验证方式。** `node scripts/run-regressions.mjs --filter feature-settings` 检查注册表、默认值、规范化、环境优先级、路由、存储、Mari 式失效处理及监听器。UI 打开 Settings > Advanced > Features 或搜索 `features`。

**关闭／撤销方式。** 关闭两项或取消变量。撤销提交移除机制，两个变量恢复独立工作。

---

<a id="a7-logged-best-effort-helpers"></a>

## A7. 带日志的尽力而为辅助函数

纯新增辅助函数，无开关，也不单独改变行为。

**现有实现。** 清理、游标推进、缓存写入等通过空 `catch` 有意忽略失败，行为正确但没有日志痕迹。

**新增内容。** `packages/server/src/lib/best-effort.ts` 提供 `logSuppressed`、`orFallback`、`bestEffort`。被忽略的失败通过 `logRateLimited`（A2）记录，每个事件、聊天、阶段每分钟最多一行。D/E 的修复用它替换空 catch。

**保持不变。** 本 PR 尚无调用，不改变现有路径。

**验证方式。** `node scripts/run-regressions.mjs --filter best-effort`。

**关闭／撤销方式。** 无开关；撤销辅助函数提交会删除文件。

---

<a id="coming-in-later-pull-requests"></a>

# 后续 pull request

这些章节刻意简短。每个 PR 打开时按同样五部分补充。

状态：PR A 已作为 #6647 合并，PR B 已作为 #6648 合并。PR C(#6649) 未合并即关闭，PR D 到 H 没有作为单独的 pull request 提交。下面 C 到 H 的章节描述的是当时写下的计划；不要把它们当作已按此形式发布的功能。

<a id="pr-b-dev-mcp-for-coding-assistants"></a>

## PR B：编程助手用 Dev MCP

`tools/dev-mcp` 下的可选本地服务器，位于 pnpm workspace 和 Docker 镜像之外。使用 A2 追踪，设置/检查见 B 新增的 `tools/dev-mcp/README.md`。

<a id="pr-c-command-palette-and-keyboard-shortcuts-overlay"></a>

## PR C：命令面板和快捷键浮层

C 添加 Ctrl+K 面板和 "?" 列表。仅客户端，无开关，不改现有按键。

<a id="pr-d-reviewed-server-fixes-part-1"></a>

## PR D：经审核的服务端修复，第 1 部分

D 修复路由、中间件、恢复、聊天/生成、导入、边车、SSRF，各有回归。修复不设开关。

<a id="pr-e-reviewed-server-fixes-part-2"></a>

## PR E：经审核的服务端修复，第 2 部分

E 修复服务和存储，各有回归，无开关。

<a id="pr-f-prompt-caching"></a>

## PR F：提示词缓存

F 修复 Claude 订阅历史标记、更新 Claude Agent SDK，添加利于缓存的结构（默认关闭开关）、每聊天低缓存发送警告（默认关闭）及可选诊断。

<a id="pr-g-generation-jobs-and-console-tray"></a>

## PR G：生成任务与控制台托盘

G 添加关闭标签后继续的图像、精灵图、视频任务及查看器（默认关闭开关），以及 Windows 托盘图标（默认关闭开关）。

<a id="pr-h-engine-diagnostics-and-launcher"></a>

## PR H：Engine 诊断和启动器

H 添加启动完整性检查、运行时内存遥测、可选调试文件、后台调用上限（默认关闭开关）、启动器安全措施，以及对始终推理模型不带关闭推理选项的重试。

---

<a id="test-results-for-pr-a-on-the-development-machine"></a>

## 开发机上的 PR A 测试结果

基于 `staging` 提交 `dd876831a` 检查。未进行付费模型调用。

- **Linux Node 回归**：按 CI `complete-node-regressions`（WSL 下 Ubuntu 24.04、Node 24、`pnpm install --frozen-lockfile`、`pnpm regression`）运行，384 个文件全部通过。机器繁忙时 `server-signal-shutdown` 偶达 30 秒，未改动的 `staging` 也如此。时间敏感的 `smart-group-decision`、`agent-activation-questions`、`advanced-memory-core` 各失败一次，之后重跑均通过。
- **Windows Node 回归**：384 中 379 通过。`decision-sidecar-runtime`、`gallery-previews`、`request-timeouts`、`server-signal-shutdown`、`storage-writer-lock` 在同机未改动的 `staging` 也失败，原因是本地文件锁、控制台信号、磁盘空间检查。
- **类型、lint、格式、构建**：shared、server、client、根项目及令牌估算项目运行 `tsc --noEmit`；lint 零错误；`packages/**/*.{ts,tsx}` 的 Prettier；locale 与静态 JSX 检查；客户端/服务端构建。
- **设置浏览器测试**（`core-flows`、`issue-sweep-settings`、`ux-feedback-sweep`、`afternoon-sweep`、`client-runtime-diagnostics`）在 `mobile-chromium` 上 171 通过、0 失败。`mobile-webkit`（Windows WebKit）重跑后剩余失败也在原始 `staging` 出现。
- **Features 章节**在默认/SillyTavern 主题、明暗模式、桌面/手机尺寸下目视检查。
