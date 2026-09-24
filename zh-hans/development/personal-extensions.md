# 个人扩展架构

个人扩展默认禁用，代码要按哈希批准后才能跑，并且分处两套彼此隔离的运行时。默认可用的扩展只有 Professor Mari 起草的那一类。其余来源一律算外部扩展，必须开启两道彼此独立、需人工操作的开关才能使用。

## 安全不变量

下面这些性质必须始终成立：

1. 创建和导入产生的永远是禁用、未批准的草稿。
2. 批准时必须给出当前完全一致的 `sha256:` 内容哈希，并明确确认知悉这会执行代码。开启完整页面访问还要再做一次明确确认。
3. 可执行内容只要有改动，扩展立即禁用，`approvedHash` 一并清空。
4. 回滚恢复出来的是一份禁用状态的草稿。
5. 备份恢复和档案导入都会清除批准状态和启用状态。
6. Professor Mari 可以创建和更新草稿，但没有任何手段批准或启用它们。
7. 除 `professor_mari` 以外的来源全都算外部来源，包括 `external`、`local`、`legacy`、`profile_import`，以及会被归一化成 `legacy` 的未知值。
8. 除非 `ENABLE_EXTERNAL_EXTENSIONS=true`，并且持久保存的 Danger Zone(危险区域) 手动启用项同样为 true，否则管理接口和运行时响应里都不会出现外部记录。
9. 任何一道开关关闭，都会禁用已存储的外部记录，并停掉正在运行的服务端进程。浏览器运行时的轮询则会移除处于活动状态的浏览器 worker。
10. 沙箱里的浏览器代码绝不会在 Marinara 的文档中执行。只有通过精确哈希批准、且带 `full_page_access` 的外部浏览器扩展，才能使用另外那套页面运行时。服务器代码绝不会在 Marinara 的服务器进程里执行。
11. 没有 URL 安装器，没有远程目录，也没有自动更新器。
12. 宿主贡献项只是经过校验的纯描述符。扩展的标记、样式、URL、组件和回调永远不会进入 Marinara 的 React 树。
13. 贡献项的注册、激活、事件、更新和移除，始终绑定在已启用扩展那份获批的精确内容哈希上。
14. 浏览器上下文快照在基线状态下只包含当前聊天 ID 和角色 ID。可选的 `read_active_characters` 和 `read_active_persona` 权限能再加进一批有上限、在允许清单内的字段，且这些字段只来自该聊天中处于活动状态的记录；它们绝不会暴露消息、完整资料库、未声明的字段、元数据或应用访问权限。
15. 请求的权限属于可执行哈希的一部分。权限一有变动，扩展立即禁用，必须重新走一次精确哈希批准。
16. `full_page_access` 仅限外部扩展，要求两道外部扩展开关都开启，Professor Mari 的草稿永远拿不到它。它是一种明确表态的信任模式，不代表有沙箱保护。

这两道开关在路由和运行时服务里强制执行。把控件藏起来不算安全边界。手动添加、从备份恢复、遗留下来或从别处混进来的外部记录，只要有任意一道开关是关闭的，就必须既不可见也不可执行。

## 存储与策略

`installed_extensions` 文件表保存元数据、可执行代码、`contentHash`、`approvedHash`、来源，以及最多十份历史可执行版本。扩展的私有设置存在 `app_settings` 中以 `extension-storage:` 为前缀的键里。Danger Zone 的手动启用项对应 `external-extensions-enabled`。

启动时会运行 `preparePersonalExtensionTrust`。没有哈希的遗留行会保留下来，但置为禁用且未批准。存储哈希与可执行字段对不上的行同样会被禁用，并重新计算指纹。

`personal-extension-policy.service.ts` 把实时的 `.env` 开关和持久保存的用户手动启用项合并成一条策略。`personal-extension-storage.service.ts` 可以禁用所有非 Professor 来源的记录。`.env` 的监听器大约两秒内重新应用策略，并在开关关闭时要求服务端运行时停止执行代码。

## API

管理接口位于 `/api/personal-extensions` 之下：

- `GET /policy` 返回两道开关的状态和服务端沙箱的可用性。
- `PATCH /policy/external` 修改 Danger Zone 手动启用项，`.env` 那道开关没开启时会拒绝设为 `true`。
- `GET /` 列出 Professor 草稿，只有两道开关都开启时才一并列出外部草稿。
- `POST /` 导入一个外部扩展，两道开关没有都开启就会被拒绝。
- `PATCH /:id` 编辑或禁用一份草稿。
- `POST /:id/approve` 批准当前那份精确哈希，套用外部开关策略，操作系统没有受支持的沙箱时拒绝批准服务器扩展。
- `POST /:id/rollback` 恢复某份此前的禁用版本。
- `DELETE /:id` 删除扩展及其私有设置。

已批准的浏览器运行时元数据从 `GET /runtime/client` 读取。沙箱代码由 `GET /:id/sandbox.html?hash=...` 提供。完整页面代码和 CSS 由 `GET /:id/page-runtime.js?hash=...` 和 `GET /:id/page-style.css?hash=...` 提供。所有端点都要求哈希完全一致，且扩展仍处于启用、已批准、策略允许的状态；页面相关的端点还额外要求来源是外部扩展并带有 `full_page_access`。

## 沙箱浏览器运行时

`PersonalExtensionInjector.tsx` 会创建一个隐藏的 iframe，设置 `sandbox="allow-scripts"` 且不带 `allow-same-origin`。因此这个 iframe 的源是不透明的，访问不到 Marinara 的 DOM、cookie、存储或任何同源 API。

沙箱响应会用一套极窄的 CSP 替换掉正常页面策略：不允许任何默认资源，不允许发起连接，不允许表单，不允许对象，也没有导航权限。扩展 CSS 只作用在这个隐藏的 iframe 内部。JavaScript 跑在由受信任的 iframe 引导程序创建的专用 Worker 里。网络和嵌套 worker 相关的全局对象都被删掉，作为纵深防御。

worker 能拿到的只有：

- 带命名空间的日志；
- 由父页面代管的扩展私有存储；
- 受管理的定时器；
- 清理逻辑的注册接口；
- 通过 `marinara.context` 只读获取当前聊天和角色的标识符；
- 只有单独批准了相应能力，才能拿到活动角色卡和所选用户角色的有限字段；
- 通过 `marinara.ui.showWindow(...)` 打开的一个受约束的 iframe 窗口；
- 通过 `marinara.ui.registerContribution(...)` 使用宿主提供的受信任贡献位。

浏览器扩展 API 第 5 版新增了 `marinara.context.get()` 和 `marinara.context.subscribe(listener)`。这份不可变快照的结构如下：

```ts
{
  chatId: string | null;
  characterId: string | null;
  characterIds: readonly string[];
  personaId: string | null;
  characters: readonly PersonalExtensionCharacterSnapshot[];
  persona: PersonalExtensionPersonaSnapshot | null;
}
```

客户端从 `useChatStore` 推导出这份快照，并在当前聊天、聊天的角色列表或所选用户角色发生变化时发送出去。ID 是非空字符串，长度上限 256 个字符；角色列表会去重，最多 256 条。iframe 只接受来自父页面的上下文更新，而且要求 `contentHash` 与扩展当前那份精确版本一致，随后 Worker 会再次归一化并冻结这份数据。扩展启动时会等待宿主的第一份快照，一秒后回退成空上下文，避免桥接失败时 Worker 无限期卡住。

`characterId` 只是单人聊天下的便利字段，群聊时始终是 `null`；`characterIds` 则包含每一位活动参与者。`personaId` 只有在拿到 `read_active_persona` 时才有值。没有活动聊天时，`chatId`、`characterId`、`personaId` 和 `persona` 都是 `null`，`characterIds` 和 `characters` 为空。扩展可以放心把这些标识符当作自己私有存储里的键。

有了 `read_active_characters`，`characters` 里也只能出现活动角色卡的 `id`、`name`、`description`、`personality`、`scenario`、`firstMessage`、`exampleDialogue`、`creator`、`characterVersion`、`tags`、`backstory`、`appearance`、`aboutMe` 和 `conversationDisplayName`。有了 `read_active_persona`，`persona` 里也只能出现 `id`、`name`、`description`、`personality`、`scenario`、`backstory`、`appearance`、`tags`、`aboutMe` 和 `conversationDisplayName`。这两组数据都由服务器根据当前活动聊天推导，逐字段和整体都做上限限制，并且绝不会把客户端传来的记录 ID 当成访问范围的凭据。

能力在扩展载荷中声明，随每一份版本一起持久保存，显示在 Settings(设置) 和批准窗口里，并计入可执行哈希。宿主先发出只含 ID 的快照，再通过获批的、按扩展隔离的代理接口把内容补全。Worker 这边会独立地丢弃未声明的记录，拒收 ID 不在 `characterIds` 里的角色记录，再次做上限限制，最后冻结结果。

`marinara.ui.showWindow({ title, elements, onEvent, onClose })` 返回一个句柄，带 `update({ title?, elements? })` 和 `close()`。worker 只负责发送描述符，每个元素都由受信任的 iframe 引导程序用 DOM API 和 `textContent` 构建（绝不用 `innerHTML`）。只有窗口打开期间宿主才会显示那个平时隐藏的沙箱 iframe，关闭后重新藏起来。

`marinara.ui.registerContribution({ id, kind, label, description?, icon?, surface?, position?, elements?, onActivate?, onEvent? })` 返回带有 `update(patch)` 和 `remove()` 的冻结句柄，支持以下受信任的宿主位置：

- `button`：默认是顶栏的紧凑操作项，也可以是由宿主渲染在 `chats`、`bots`、`characters`、`personas`、`lorebooks`、`presets`、`connections`、`agents` 或 `settings` 界面的操作项；
- `menu-item`：Extensions 菜单里的一个操作项；
- `panel`：一个入口，点开后进入 Marinara 受信任的 Extensions 侧边面板。

侧栏按钮接受 `position: "header"`、`"before-content"` 或 `"after-content"`。顶栏按钮省略 `position`。图标使用 Marinara 的 Lucide 图标目录中受限的 kebab-case 名称；不支持的名称会回退到拼图图标。

面板元素使用与受约束窗口相同的声明式词汇：`heading`、`text`、`pre`、`button`、`input`、`select`、`toggle`、`slider`、`color` 和 `spacer`。可交互的控件必须有唯一 ID。面板按钮会向 `onEvent` 投递 `{ contributionId, elementId, values }`，其中 `values` 包含每个控件当前的字符串值。用户打开或触发某个贡献项时，`onActivate` 在扩展的 Worker 内运行。状态变化后，扩展可以调用 `handle.update(...)` 来替换自己的标签、描述、图标或面板元素。

客户端在将每个描述符加入运行时存储前都会独立验证。贡献项类型、界面、位置、控件、ID、选项列表、图标名称语法、文本长度、面板总文本量、元素数量以及每个扩展的贡献项数量都经过验证并设有上限。React 将扩展文本作为文本渲染，不接受扩展控制的 HTML、CSS、URL、React 组件或宿主回调。当 Worker 停止、哈希更改或从已批准的运行时响应中消失时，宿主会移除所有贡献项。事件仅分派给以相同扩展 ID 和内容哈希注册的 Worker。

这里没有 DOM 辅助函数，没有 Marinara API 请求，拿不到父页面的事件，也没有任意的网络能力。iframe 会校验消息并做限流。心跳看门狗会终止失去响应或陷入忙循环的 worker。

## 完整页面兼容运行时

对设置项繁多的工具和多步骤工作流来说，贡献协议依然是首选路径。复杂的扩展可以逐步替换面板里的元素，把自身状态放进扩展私有存储。

已有的遗留包如果靠宿主选择器插入按钮、遍历 React 内部结构、随意往页面上写浮层，或者调用同源 `/api` 路由，在安全运行时里是跑不起来的。建议把它们改写成贡献描述符，配上范围收窄的代理能力。

如果兼容性确实离不开宿主页面，外部扩展可以申请 `full_page_access`。`PersonalExtensionInjector.tsx` 会通过一个同源的 script 元素加载获批的那份精确版本，样式表则是可选的。源码在一个 async 函数里运行，并拿到一个精简的兼容用 `marinara` 对象，提供身份标识、日志、私有存储、受管理的定时器和清理注册；页面上的环境全局对象照样可用，因为这正是它申请到的权限。

页面加载器在调用代码之前，会拿 `id`、名称和内容哈希与运行时元数据比对。服务器则在每一次脚本或样式表请求上单独校验精确哈希、启用状态、外部来源、权限以及两道开关的策略。关闭任意一道开关都会禁用该记录，随后运行时轮询会移除已注入的节点，并尽力做清理。全权限页面代码此前造成的任意副作用是撤不回来的，所以面向用户的流程会提示可能需要重新加载页面。

带 `kind: "marinara.extension"` 且没有显式声明 `capabilities` 的遗留导入包，会被指定为 `full_page_access`。现代导出格式总会写出 capabilities 字段（哪怕是空数组），这样安全的包重新导入时就不会被错误归类。

## 服务器运行时

服务器源码在一个独立的 Node 进程里运行，绝不通过进程内 import 加载。Node 的权限模型会拒绝文件系统、网络、子进程、worker、原生插件、WASI 和调试器等能力。这个子进程还额外运行在：

- macOS Seatbelt 内；或者
- Linux Bubblewrap 内，配有独立的 PID、网络、IPC 和挂载命名空间。

沙箱拿到的是一份最小化环境、很小的 V8 堆，没有应用文件，没有服务器机密，只有私有临时目录里几个大小受限、按行分隔的协议文件。它只拿得到日志、扩展私有存储、受管理的定时器和清理注册。消息配额和单独的心跳文件用来遏制协议洪泛和忙循环。

Node 权限和 `node:vm` 属于纵深防御层，不是安全边界。独立的操作系统沙箱是必备条件。Windows、Android、没有 `bwrap` 的 Linux，以及任何其他不受支持的平台，都会拒绝启用服务器扩展。

## 验证

运行：

```bash
pnpm check
pnpm regression:extensions-security
pnpm regression:professor-mari-shell-sandbox
pnpm smoke:ui
```

安全回归测试必须证明这些点都成立：两步开关、精确哈希失效机制、不透明源的 worker 结构、有上限且与哈希绑定的上下文快照、宿主贡献项的校验与清理、仅限外部扩展的完整页面路由与确认流程、遗留包的归类、环境变量剥离、文件系统与网络拒绝、私有存储，以及沙箱可用性判定的失败即拒绝行为。
