# 服务器日志

本页介绍如何阅读 Marinara Engine 服务器日志，以及如何编写有用的日志。它补充而非替代 [CONTRIBUTING.md 的 Logging 部分](../../CONTRIBUTING.md#logging)。共享 Pino logger、错误对象作为首参、格式占位符和四级日志表仍然适用。

<a id="what-every-line-carries"></a>

## 每行包含什么

所有服务器日志都来自同一个 Pino 实例：`packages/server/src/lib/logger.ts` 中的 `logger`。Fastify 通过 `loggerInstance` 使用它，因此 `req.log`、`reply.log` 和 `app.log` 都是其子 logger。它们使用相同序列化器，并跟随环境监视器对 `LOG_LEVEL` 的热更新。

| 字段 | 出现位置 | 含义 |
| --- | --- | --- |
| `pid` | 每行 | 进程 ID（Pino 默认）。 |
| `hostname` | 每行 | 主机名（Pino 默认）。 |
| `bootId` | 每行 | 每次进程启动生成的 8 位十六进制字符，用于区分同一日志文件中的不同运行。 |
| `requestId` | 请求引起的每行 | 与响应头 `x-request-id` 相同，同时出现在 `req.log` 和服务内部共享 `logger` 的日志中。 |
| `route` | 正文解析后的行 | 匹配的路由模式，例如 `/api/chats/:id`，绝不保存原始 URL。 |

<a id="request-ids"></a>

### 请求 ID

`lib/request-logging.ts` 为每个请求分配 ID：

- 客户端可发送 `x-request-id`。如果是由 `A-Z a-z 0-9 . _ : -` 组成的 8 至 80 个字符，服务器保留它；否则替换。
- 没有时，服务器创建 UUID。Fastify 默认的 `req-1` 计数器在每次启动时重置，导致 ID 重复。
- ID 通过 CORS 公开的 `x-request-id` 响应头返回。错误报告可提供该 ID，再用 `grep <id>` 找到请求的所有日志。

ID 保存在 `AsyncLocalStorage` 上下文（`lib/log-context.ts`）中，由 Pino mixin 复制到每行。不用手动传递；服务深处的 `logger.warn(err, "...")` 会自动获取。正文解析后再次设置上下文，因为正文解析运行在 HTTP 解析器自己的异步上下文中。

上下文会跟随请求内启动的所有工作，包括计时器、监听器和子进程。对于会活得比请求更久的工作，用 `runWithRootLogContext({}, fn)` 包住其启动过程，让之后的日志不带原始请求 ID。本地辅助进程对 llama-server 和 MLX 这样处理，Decision 和 Utility 辅助进程也采用同样方式，因此被后续请求共用的进程不会一直保留首个调用者的 ID。路由处理器启动的其他长期计时器或轮询器，在采用同样包装前仍会保留该路由的 `requestId`。

<a id="request-lines"></a>

### 请求日志行

`RequestLogController` 是 Fastify 默认 `LogController` 的以下调整版：

- ID 字段叫 `requestId`，不是默认的 `reqId`。已保存的搜索或日志过滤器若使用 `reqId`，需要改名。
- `incoming request` 和 `Route ... not found` 行去掉查询字符串，因为其中可能有令牌或搜索文本。输入行保留其他 `req` 字段（`method`、`version`、`host`、`remoteAddress`、`remotePort`），并添加 `route`。
- 客户端提前关闭请求时，以 info 记录一行 `Client aborted request`。Fastify 原先不记录此情况。

`LOG_DISABLE_REQUEST_LOGGING` 与以前一样工作，也会关闭中止日志行。

终端收到的是 pino-pretty 格式的日志行：包括 `pnpm dev`，以及 stdout 指向终端的生产服务器（启动脚本）。生产输出发往其他位置时，使用每行一个对象的 JSON。`LOG_FORMAT=pretty|json` 会覆盖这个选择；Termux 启动脚本设为 `pretty`，因为它的输出要经过 `tee` 才到终端。pino-pretty 隐藏 `hostname`(默认行为) 和 `bootId`；JSON 输出保留两者。

<a id="startup-timeline"></a>

## 启动时间线

`lib/startup-timeline.ts` 测量每个启动步骤：

```ts
const db = await startup.phase("storage.open", () => getDB());
```

- 每行包含 `event: "startup.phase"`、`stage`、`elapsedMs`（实际经过时间）和 `selfMs`（不含嵌套阶段的自身时间）。级别由 `selfMs` 决定：低于 1 秒为 debug，超过 1 秒为 info，超过 15 秒为 warn。在默认 `LOG_LEVEL=warn` 下，正常启动即使首次较慢也不打印阶段行。
- 阶段可以嵌套。`index.ts` 中的 `app.build` 包含 `buildApp` 内的所有阶段。由于使用 `selfMs`，缓慢的内部步骤只由自己报告一次；除非外层自身工作也慢，否则 `app.build` 保持 debug。
- 失败步骤不在阶段内部记录。错误原样向上抛，由 `index.ts` 的 `main().catch` 记录一行 `startup.failed`，指出步骤（`startup.stageOf(err)`）。
- 服务器开始监听后，`index.ts` 记录一行 info：`[startup] Ready in N ms`，含 `event: "startup.ready"`、阶段总数和 `selfMs` 最大的五个步骤。

阶段不向日志上下文添加 `stage`。阶段内启动的服务会保留计时器，否则这些计时器将在整个进程生命周期内携带该阶段。

<a id="one-line-per-failure"></a>

## 每次失败只记一行

一次失败应恰好产生一行，由决定接下来如何处理的代码记录。

- **记录或重新抛出，二选一。**重新抛出时由调用方记录。额外细节放在 debug，例如 `[agent-tools] ... failed` 中的工具名。
- **记录位置：**
  - 未知 500：`middleware/error-handler.ts`
  - 智能体失败：`executeAgent`（非关键失败，用 warn）
  - 聊天生成失败：`generate.routes.ts` 的主 catch
  - 相应服务商代码只抛出，不记录。最多像 Grok CLI 和 Claude (Subscription) 一样，补一行包含模型名和原始错误的 debug。Claude (Subscription) 抛出的友好消息已经包含 SDK 错误文本，因此不会再把 SDK 错误附为 `cause`；聊天 SSE 错误和智能体错误文本会追加原因消息，否则用户会看到重复内容。
- **取消用 info。**用户停止、关闭标签页或中止信号都是预期结果。使用 `lib/log-context.ts` 中的 `failureLevel(err)` 或 `failureLevel(err, "warn")`。`isCancellation(err)` 为真时返回 `"info"`。`TimeoutError` 是真实失败，不算取消。

  ```ts
  logger[failureLevel(err)](err, "[agent-batch] Batch call FAILED: %s", errMsg);
  ```

- **保留原因。**使用 `new Error("Could not save chat", { cause: err })` 包装。`err` 和 `error` 序列化器会把原因消息与堆栈加入日志（`caused by: ...`）。以 `{ error }` 记录的 Error 也会序列化，不再显示为 `{}`。

<a id="repeating-failures"></a>

## 重复失败

轮询器、健康检查和每回合钩子可能每几秒发生同样的失败。使用 `lib/log-rate-limit.ts` 中的 `logRateLimited`：

```ts
logRateLimited("warn", "autonomous-scheduler:poll", err, "[autonomous-scheduler] Poll failed");
```

某个键首次出现时记录；时间窗口内（默认 60 秒）的后续重复只计数，下次输出附带 `suppressedRepeats`。键中应包含失败对象，如包 ID 或聊天 ID，防止一个故障掩盖另一个。

<a id="prompt-and-model-text"></a>

## 提示词与模型文本

提示词、模型输出、服务商响应正文和轮询正文放在 **debug**，绝不放入 warn 或 error。它们可能包含用户故事，服务商正文还可能回显凭据或提示词。warn 只记录大小（`rawLength`、`bodyLength`）和原因。JSON 解析错误消息可能引用失败文本，因此 warn 只记错误类型；错误本身和文本另放一行 debug：

```ts
logger.warn(
  { errorType: err instanceof Error ? err.name : typeof err, rawLength: raw.length },
  "[game/scene-wrap] Failed to parse LLM response as JSON",
);
logger.debug({ err }, "[game/scene-wrap] Unparsed LLM response: %s", raw.slice(0, 200));
```

UI 调试开关仍通过 `logDebugOverride` 工作。这是在 `LOG_LEVEL` 隐藏 debug 时查看提示词的指定方式。

用 `%s` 原样打印提示词文本。对于结构化值（消息数组、服务商请求正文、解析后的回复），将 `debugJson(value)` 传给 `%s`，不要用 `%j` 或 `JSON.stringify(value)`。它打印带缩进的 JSON，并把字符串里的换行显示为真正的换行，让多行提示词保持可读；只有实际打印这一行时才会渲染。用于脱敏的 replacer 放在第二个参数，与 `JSON.stringify` 一样。应用内调试视图使用 `@marinara-engine/shared` 的 `readableJson` 打印相同文本。`debug-log-line-breaks` 回归测试覆盖了这一点和格式选择。

内嵌媒体在日志里以缩略形式显示。`debugJson` 会把每段 base64 数据替换成类似 `[image/png base64, ~1.2 MB: iVBORw0KGgoAAAA...ElFTkSuQmCC]` 的标记，包含类型、大小以及开头和结尾各 16 个字符。这适用于 `data:` URL（整个字符串或正文的一部分），也适用于 Anthropic 和 Google 媒体部分中没有前缀的 `data` 字段，即使 base64 分成多行也是如此。`msg` 序列化器也会缩短普通 `%s` 和 `%j` 日志行中的 `data:` URL；没有前缀的 `data` 字段只会通过 `debugJson` 缩短。变化只发生在输出的副本里，传入的值保持原样。在 `.env` 中设置 `LOG_INLINE_MEDIA=full` 可恢复完整输出。回归测试 `log-inline-media` 覆盖了这个行为。

<a id="checks"></a>

## 应用内控制台

在 NAS、VPS、Docker、Termux 等无法直接访问终端的安装环境中，可通过 Settings → Advanced → **Open Console**(打开控制台) 在应用里查看最近的服务器日志。

- `lib/log-buffer.ts` 在内存中保留最近 1,500 行，总计最多约 400 万个字符，每条消息和每个字段块都在 16,000 个字符处截断。日志不会写入磁盘，重启会清空缓冲区。
- `logger.ts` 通过 Pino 的 `hooks.streamWrite` 将每一行序列化日志复制到缓冲区，因此它和终端或日志文件收到的内容一致，也遵循同一个 `LOG_LEVEL`。绕过 Pino 的行不会进入缓冲区，例如 dotenv 的 `injected env` 行或子进程的原始输出。
- `GET /api/admin/logs?afterId=` 返回 `afterId` 之后的行，以及 `latestId`、`truncated`（这次读取前是否丢弃了日志行）和服务器的 `logLevel`。该路由由 `requirePrivilegedAccess` 保护，使用 `no-store`。路由设置为 `logLevel: "silent"`，因此控制台自己的轮询不会出现在日志里。
- 本页的规则在这里也适用。远程管理员会在应用里读到 warn 或 error 级别的日志，因此提示词和发给服务商的请求体及其响应体应留在 debug 级别。

## 检查

回归测试 `logging-request-trail`、`logging-failure-lines` 和 `logging-startup-timeline` 覆盖本页，`server-console-logs` 覆盖应用内控制台：

```sh
node scripts/run-regressions.mjs --filter logging-
```
