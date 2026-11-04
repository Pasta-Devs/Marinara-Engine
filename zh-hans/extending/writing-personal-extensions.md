# 编写 Personal Extensions

本指南介绍如何编写 Browser Extension 或 Server Extension，以及如何打包和导入。它面向会写 JavaScript 的人。要审查并运行扩展，见 [Personal Extensions](personal-extensions.md)。

自行编写并导入的代码会被视为 **External Extension**(外部扩展)。它一开始处于禁用状态；只有在你检查代码并批准它精确的 SHA-256 哈希之后，它才能运行。

## 开始之前

只有完成[允许第三方导入](personal-extensions.md#allow-third-party-imports)中的两个安全步骤后，External Extensions 才会显示：在 `.env` 中设置 `ENABLE_EXTERNAL_EXTENSIONS=true`，并在 **Settings → Advanced → Danger Zone**(设置 → 高级 → 危险区域) 下启用 **Allow third-party extension imports**(允许导入第三方扩展)。

导入和管理扩展还需要通过 localhost 访问，或者提供管理员密钥。从手机、LAN 地址或远程浏览器访问时，在服务器上设置 `ADMIN_SECRET`，并在 **Settings → Advanced → Admin Access**(设置 → 高级 → 管理员访问) 中填入相同的值。

选择能完成任务且权限最少的运行时：

| 运行时 | 适用场景 | 重要边界 |
| --- | --- | --- |
| Sandboxed Browser Extension | 私有状态、当前聊天上下文、按钮、菜单操作，以及由 Marinara 渲染的面板 | 无法访问 Marinara DOM、Cookie、浏览器存储、网络或任意 HTML |
| Server Extension | 需要托管计时器和扩展私有存储的后台逻辑 | 独立的操作系统沙箱；无法访问 Marinara 文件、密钥、网络、子进程或原生模块 |
| Full-page External Extension | 需要访问 Marinara 页面或同源 API 的旧代码 | 没有沙箱；只用于已经逐字检查且完全信任的代码 |

Browser Extensions 可在所有受支持的平台上运行。Server Extensions 需要 macOS Seatbelt 或 Linux Bubblewrap。选择 Server Extension 前，请先查看[平台表](personal-extensions.md#platform-support)。

## Browser Extension 快速入门

创建采用以下结构的文件夹：

```text
Hello Panel/
  manifest.json
  extension.js
  extension.css
```

使用以下 `manifest.json`：

```json
{
  "kind": "marinara.personal-extension",
  "version": 1,
  "config": {
    "name": "Hello Panel",
    "version": "1.0.0",
    "description": "A minimal sandboxed Browser Extension.",
    "runtime": "client",
    "capabilities": [],
    "jsPath": "extension.js",
    "cssPath": "extension.css"
  }
}
```

使用以下 `extension.js`：

```js
const saved = await marinara.storage.get();
let count = Number(saved.count) || 0;

const statusElement = () => ({
  kind: "text",
  text: `Button pressed ${count} time${count === 1 ? "" : "s"}.`,
});
const elements = () => [
  statusElement(),
  { kind: "button", id: "increment", label: "Count one" },
];

const panel = marinara.ui.registerContribution({
  id: "hello-panel",
  kind: "panel",
  label: "Hello Panel",
  description: "Minimal Personal Extension example",
  icon: "hand",
  elements: elements(),
  onEvent: async ({ elementId }) => {
    if (elementId !== "increment") return;
    count += 1;
    await marinara.storage.patch({ count });
    panel.update({ elements: elements() });
    marinara.ui.showWindow({ title: "Hello Panel", elements: [statusElement()] });
  },
});

marinara.log.info("Hello Panel loaded");
marinara.onCleanup(() => panel.remove());
```

使用以下 `extension.css`，为按钮打开的受限 iframe 窗口设置样式：

```css
[data-ext-root] {
  font-size: 16px;
}
```

然后导入并运行扩展：

1. 打开 **Settings → Addons → External Extensions**(设置 → 插件 → 外部扩展)。
2. 选择 **Import Extension Folder**(导入扩展文件夹) 并指定 `Hello Panel`，或者把文件夹压缩成 ZIP，再用 **Import Extension File**(导入扩展文件) 导入这个 ZIP。
3. 打开已禁用的草稿，检查其清单和 JavaScript。
4. 选择 **Review and Run**(审查并运行)，批准界面显示的精确哈希。
5. 打开 Extensions 菜单，选择 **Hello Panel**。

仓库的 `docs/examples/personal-extensions/browser-minimal/` 中提供了同一个可运行示例。

## Browser API 参考

在沙箱中运行的 Browser Extensions 会获得一个名为 `marinara` 的冻结全局对象：

| API | 用途 |
| --- | --- |
| `runtime`, `version` | 运行时名称（`client`）和当前 Browser API 版本 |
| `extensionId`, `extensionName`, `capabilities` | 此扩展修订版本的身份信息和已批准能力 |
| `log.debug/info/warn/error(...)` | 向浏览器控制台写入带标签的记录 |
| `storage.get()` | 读取此扩展的私有 JSON 对象 |
| `storage.patch(object)` | 把值合并到私有存储中，并返回新对象 |
| `storage.delete()` | 清空私有存储 |
| `context.get()` | 读取当前聊天的最新快照 |
| `context.subscribe(listener)` | 接收上下文变化；返回取消订阅函数 |
| `ui.registerContribution(options)` | 添加安全按钮、Extensions 菜单项或由 Marinara 渲染的面板 |
| `ui.showWindow(options)` | 打开受限的 iframe 窗口 |
| `dice.registerFormat(options)` | 为 `/roll` 添加一种写法；Marinara 负责掷出它指定的骰子 |
| `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval` | 扩展停止时会移除的托管计时器 |
| `onCleanup(callback)` | 注册额外的清理逻辑 |

普通 UI 请使用[由 Marinara 渲染的面板](#add-a-marinara-rendered-panel)，需要感知聊天的行为请使用[当前聊天上下文](#use-active-chat-context)，自定义 `/roll` 写法则使用[骰子格式](#add-a-dice-format)。扩展状态应保存在 `marinara.storage` 中，而不是浏览器存储中。

`showWindow({ title, elements, onEvent, onClose })` 会返回带有 `update({ title?, elements? })` 和 `close()` 的句柄。包内 CSS 会为这些沙箱 iframe 窗口设置样式；由主机渲染的内容始终使用 Marinara 自己的主题和控件。

安全 Browser 运行时不提供 DOM 或网络 API。请勿绕过这项边界。如果缺少实用能力，请请求范围明确的主机能力，而不要默认改用整页访问权限。

### 上下文能力

在 `config.capabilities` 中声明可选的记录访问权限：

```json
{
  "capabilities": ["read_active_characters", "read_active_persona"]
}
```

- `read_active_characters` 会填充当前聊天中角色卡的受限字段。
- `read_active_persona` 会填充已选用户角色的受限字段。
- `full_page_access` 会选择不带沙箱的兼容运行时，且仅供 External Extensions 使用。

更改能力会改变可执行代码的哈希、禁用扩展，并要求重新审核。

<a id="what-a-browser-extension-can-do"></a>

### Browser Extension 能做什么

Browser Extension 运行在一个不透明源沙箱 iframe 里的专用 Worker 中。它访问不到 Marinara 的页面、DOM、Cookie、浏览器存储、同源 API 和网络。它能用的只有扩展私有存储、日志、托管计时器、清理回调注册、受限窗口、安全的主机贡献位，以及当前聊天和角色 ID 的只读快照。只有在相应权限已声明并获批之后，它才能拿到当前聊天中角色卡或所选用户角色的部分字段。

扩展可以用 `marinara.ui.registerContribution(...)` 添加顶栏或侧边面板操作、Extensions 菜单项和常驻的右侧面板。这些界面由 Marinara 用当前主题和一组固定控件渲染：标题、文本、预格式化输出、按钮、文本输入框、下拉菜单、开关、滑块、颜色控件和间隔块。扩展只提供内容和状态，永远不提供 HTML、CSS、URL、React 组件或主机事件处理函数。

不管来源是什么，所有沙箱内的 Browser Extension 都适用同一套界面能力和规则。导入的第三方扩展（External Extension）默认也运行在这个安全运行时里，除非它的扩展包明确申请 **Full page access**(整页访问)，或者使用了下文介绍的沙箱之前的 `marinara.extension` 格式。

### 估算文本的 Token 数

Browser、Full page access 和 Server Personal Extensions 都可以使用 Marinara 内置的文本 Token 数估算函数：

```js
const tokens = marinara.estimateTextTokens(text);
```

函数签名是 `estimateTextTokens(text: string): number`，`@marinara-engine/shared` 导出的 `PersonalExtensionTokenApi` 类型也描述了这个接口。调用是同步的，不需要额外能力，返回的是 Marinara 不依赖特定模型的 Token 数估算值，并非分词器计算的精确结果。在旧版 Engine 上，调用前先检查 `typeof marinara.estimateTextTokens === "function"`。

<a id="add-a-marinara-rendered-panel"></a>

### 添加由 Marinara 渲染的面板

```js
const panel = marinara.ui.registerContribution({
  id: "weather-settings",
  kind: "panel",
  label: "Weather controls",
  description: "Tune a weather scene without leaving Marinara.",
  icon: "sparkles",
  elements: [
    { kind: "heading", text: "Atmosphere" },
    {
      kind: "select",
      id: "weather",
      label: "Weather",
      value: "rain",
      options: [
        { value: "rain", label: "Rain" },
        { value: "snow", label: "Snow" },
        { value: "aurora", label: "Aurora" },
      ],
    },
    { kind: "slider", id: "intensity", label: "Intensity", min: 0, max: 100, value: 60 },
    { kind: "toggle", id: "lightning", label: "Lightning", checked: false },
    { kind: "color", id: "tint", label: "Tint", value: "#6d8cff" },
    { kind: "button", id: "apply", label: "Apply" },
  ],
  onActivate: async () => {
    const settings = await marinara.storage.get();
    // Update the panel when stored state should be reflected in the controls.
  },
  onEvent: async ({ elementId, values }) => {
    if (elementId !== "apply") return;
    await marinara.storage.patch(values);
  },
});

marinara.onCleanup(() => panel.remove());
```

紧凑操作使用 `kind: "button"`，Extensions 菜单操作使用 `kind: "menu-item"`。`kind: "command"` 用于 Command Center(命令中心) 里的条目，它会激活同一扩展修订版本中已有的某个贡献项。命令必须带 `targetContributionId`，不能使用 `onActivate` 或 `onEvent`。

```js
marinara.ui.registerContribution({
  id: "open-weather",
  kind: "command",
  label: "Open weather controls",
  targetContributionId: "weather-settings",
});
```

只有目标与命令的扩展 ID 和内容哈希都相同时，主机才会解析这条命令。目标缺失、跨扩展或属于过期修订版本时，一律按拒绝方式失败。按钮默认使用 `surface: "top-bar"`，也可以改为指向 `chats`、`bots`、`characters`、`personas`、`lorebooks`、`presets`、`connections`、`agents` 或 `settings`，并将 `position` 设为 `header`、`before-content` 或 `after-content`。`icon` 可接受 Marinara 支持的任意 kebab-case Lucide 图标名称。两种操作都会触发 `onActivate`。`panel` 在打开时触发 `onActivate`；其按钮会带着所有面板控件的当前值触发 `onEvent`。返回的句柄支持按种类更新：`button` 接受 `label`、`description`、`icon`、`surface` 和 `position`；`menu-item` 接受 `label`、`description` 和 `icon`；`panel` 接受 `label`、`description`、`icon` 和 `elements`。所有句柄都支持 `remove()`。ID 可以包含字母、数字以及 `.`、`_` 和 `-`。

例如，下面会在 Presets 面板内容上方放置一个原生操作：

```js
marinara.ui.registerContribution({
  id: "preset-helper",
  kind: "button",
  label: "Preset helper",
  description: "Run the preset helper",
  icon: "list-sparkles",
  surface: "presets",
  position: "before-content",
  onActivate: () => {
    // Run extension behavior here.
  },
});
```

复杂工具可以在事件发生后更新面板元素，做出多步骤界面。应用状态放在 `marinara.storage` 里，不要编码进标记结构。

<a id="use-active-chat-context"></a>

### 使用当前聊天的上下文

Browser Extension API 第 5 版会给出一组不透明标识符，指向 Marinara 当前显示的那个聊天：

```js
const renderForContext = async ({ chatId, characterId, characterIds, personaId, characters, persona }) => {
  if (!chatId) return; // Home, a library, or another surface without an active chat.

  const storage = await marinara.storage.get();
  const tab = storage.tabsByChat?.[chatId];

  // characterId is available only for a single-Character chat.
  // Use characterIds for group chats.
  marinara.log.debug("Loaded Notepad tab", {
    chatId,
    characterId,
    characterIds,
    personaId,
    characterNames: characters.map((character) => character.name),
    personaName: persona?.name ?? null,
    tab,
  });
};

const unsubscribe = marinara.context.subscribe(renderForContext);
marinara.onCleanup(unsubscribe);
```

`marinara.context.get()` 返回同样的当前快照，但不建立订阅。没有活动聊天时，`chatId` 为 `null`，`characterIds` 为空。只有聊天中恰好只有一个角色参与时，`characterId` 才有值；群聊会通过 `characterIds` 给出全部参与角色，`characterId` 保持为 `null`。`personaId` 只有在 `read_active_persona` 获批后才有值。

聊天 ID 和角色 ID 始终可用，扩展可以拿它们给自己的私有存储划分命名空间。要拿到记录里的字段，需要在扩展清单里声明一个或两个可选权限：

```json
{
  "runtime": "client",
  "capabilities": ["read_active_characters", "read_active_persona"]
}
```

- `read_active_characters` 会为参与当前聊天的角色卡填充 `characters`。
- `read_active_persona` 会为当前聊天所选的用户角色填充 `persona`。

没有相应权限时，对应的值就一直是 `[]` 或 `null`。扩展申请的每一项权限，Marinara 都会在 **Requested access**(申请的权限) 里列出，并在精确哈希审批窗口里再列一次。增删任何一项权限都会改变可执行代码的哈希值，扩展随之禁用，需要重新批准。

角色快照只包含 `id`、`name`、`description`、`personality`、`scenario`、`firstMessage`、`exampleDialogue`、`creator`、`characterVersion`、`tags`、`backstory`、`appearance`、`aboutMe` 和 `conversationDisplayName`。用户角色快照只包含 `id`、`name`、`description`、`personality`、`scenario`、`backstory`、`appearance`、`tags`、`aboutMe` 和 `conversationDisplayName`。文本在跨过沙箱桥之前长度就已经受限。

Marinara 绝不会发送消息、创作者备注、系统提示词、历史后指令、注释、头像路径、完整的角色库或用户角色库、未声明的字段、聊天元数据、数据库句柄、网络访问权限，也不会开放任何写操作。上下文更新同样绑定在已批准的代码哈希上，只在当前聊天、它的角色列表或所选用户角色发生变化时下发。

<a id="add-a-dice-format"></a>

### 添加骰子格式

Browser Extension API 第 6 版允许扩展为 `/roll` 添加自己的写法，例如叙事骰池。扩展解析写法，指定要掷哪些骰子；Marinara 用自身安全的掷骰器掷出骰子，再把骰面交回扩展。扩展可以解释掷骰结果的含义，但不能决定掷出了什么。

```js
const SYMBOLS = { boost: [0, 0, 1, 1, 2, 1], setback: [0, 0, -1, -1, 0, 0] };

const format = marinara.dice.registerFormat({
  id: "narrative",
  label: "Narrative dice",
  // Return null for notation this format does not read.
  parse(notation) {
    const terms = [...notation.matchAll(/(\d+)\s*(boost|setback)/g)];
    if (!terms.length) return null;
    const kinds = terms.flatMap(([, count, kind]) => Array(Number(count)).fill(kind));
    return { dice: kinds.map(() => 6), kinds };
  },
  // rolls[i] is the face Marinara threw for dice[i]; plan is what parse returned.
  read({ notation, dice, rolls, plan }) {
    const net = rolls.reduce((sum, face, i) => sum + SYMBOLS[plan.kinds[i]][face - 1], 0);
    return { total: net, text: net > 0 ? `${net} success` : "failure" };
  },
});
marinara.onCleanup(() => format.remove());
```

这样，`/roll 2 boost 1 setback` 就会发布骰面、总值和扩展的文字，并标注格式名称。`2d6` 或 `4d6kh3` 这样的普通写法始终按原来的方式掷骰，不会交给扩展。其他写法会依次交给各个已注册的格式，由第一个通过 `parse` 返回骰子的格式处理。

- `parse(notation)` 返回 `null` 或 `{ dice: [sides, ...] }`，包含 1 到 100 颗骰子，每颗有 2 到 1000 面。对象上的其他内容留在沙箱中，以 `plan` 传回 `read`。
- `read(...)` 返回 `{ total, text?, kept? }`：一个有限数值、最多 200 个字符的纯文本，以及可选的、按升序排列的计入结果的骰子位置。`/roll` 会给其余骰子加上删除线。
- 每个扩展可以注册 4 种格式。写法最多 100 个字符。`parse` 和 `read` 可以异步执行，但各自都必须在 2 秒内返回。
- 文字以纯文本显示：链接、图片、格式和 HTML 都会被转义。

骰子格式适用于浏览器中的 `/roll`。游戏主持人的 `roll_dice` 工具和其他服务端掷骰仍使用内置写法和规则集骰子。在旧版 Engine 上调用前，先检查 `typeof marinara.dice?.registerFormat === "function"`。

### 旧版扩展与整页扩展

天气控制器、提示词编辑器这类比较完整的工作流，都是合适的贡献用例。它们的安全移植版可以用一个菜单入口或顶栏入口，配合逐步更新的面板来实现。已有的扩展包如果会注入 DOM 浮层、查询 Marinara 的 CSS 选择器、遍历 React 内部结构或调用同源 `/api` 路由，就无法原样导入安全运行时。

界面贡献只提供界面，不附带环境权限。上下文 API 始终提供当前聊天 ID 和角色 ID，除此之外最多只能给出上面列出的、已声明的活动记录字段。需要消息、预设、世界书、未声明的角色或用户角色数据、视觉场景特效的功能，仍然要等 Marinara 提供单独的、范围收窄的中介能力。扩展不得通过访问主机 DOM 或发起不受限的网络请求来自行模拟这类能力。

如果某个 External Extension 离不开主机 DOM 访问权限，它可以这样申请：

```json
{
  "runtime": "client",
  "capabilities": ["full_page_access"]
}
```

**整页访问权限不是一项沙箱能力。** 获批的 JavaScript 和 CSS 直接运行在 Marinara 的页面里。这些代码能读取或修改当前浏览器会话可见的一切，能查看聊天和角色卡，能使用浏览器存储、发起网络请求、调用同源的 Marinara API。它的实际页面权限，和你往浏览器控制台里粘贴一段代码没有区别。Professor Mari 的草稿不能申请这项权限。

整页扩展应使用 `marinara.fetch(...)` 发送网络请求。它的签名和返回结果与 `window.fetch` 相同，同时让 **Settings > Addons > External Extensions**(设置 → 插件 → 外部扩展) 能够显示该扩展在当前会话中的请求数、响应所报告的传输字节数、近期请求频率，以及持续高流量警告。整页访问的代码属于受信任的页面代码，因此仍可直接调用原始的 `window.fetch`，但这些请求无法归属于该扩展。

Marinara 会把不带显式 `capabilities` 字段的旧版 `kind: "marinara.extension"` v1 封装识别成沙箱之前的老扩展包，并在导入时给它分配 **Full page access**。这样 WeatherTweaker 这类旧扩展包就能走进正确的审查流程，而不是在 Worker 里悄无声息地失败。如果一个新扩展包用了这种封装、却想留在安全运行时里，就必须写上 `"capabilities": []`。

External Extension 的两道开关和精确哈希审批依然适用。代码、CSS 或权限一旦变化，扩展就会自动禁用，需要重新批准。禁用时，Marinara 会移除自己插入的脚本和样式表节点，取消通过兼容 API 创建的计时器，并执行通过 `marinara.onCleanup(...)` 注册的回调。由于页面代码可以创建未登记的监听器、计时器、全局变量和 DOM 改动，清理只能做到尽力而为；禁用扩展后如果还有残留，刷新一下页面。

旧的 `marinara.ui.showWindow(...)` API 仍然可用，它会在不透明源 iframe 里开一个临时窗口，用的是同一组固定控件，返回 `update(...)` 和 `close()` 句柄。如果希望这个工具能从 Marinara 的常规导航里进入，优先用界面贡献。

## Server Extension 快速入门

创建以下文件夹：

```text
Server Counter/
  manifest.json
  server-extension.js
```

使用以下 `manifest.json`：

```json
{
  "kind": "marinara.personal-server-extension",
  "version": 1,
  "config": {
    "name": "Server Counter",
    "version": "1.0.0",
    "description": "A minimal sandboxed Server Extension.",
    "runtime": "server",
    "capabilities": [],
    "serverJsPath": "server-extension.js"
  }
}
```

使用以下 `server-extension.js`：

```js
const saved = await marinara.storage.get();
const starts = (Number(saved.starts) || 0) + 1;
await marinara.storage.patch({ starts });

marinara.log.info(`Server Counter started ${starts} time${starts === 1 ? "" : "s"}`);

const timer = marinara.setInterval(() => {
  marinara.log.debug("Server Counter heartbeat");
}, 60_000);

marinara.onCleanup(() => marinara.clearInterval(timer));
```

`docs/examples/personal-extensions/server-minimal/` 中提供了同一个可运行包。

服务器代码会获得 `marinara.runtime`、`marinara.version`、扩展身份信息、`log`、`storage`、托管计时器和 `onCleanup`。它无法访问文件系统、进程、网络、模块加载功能或 Marinara 数据库。

主机无法建立 Seatbelt 或 Bubblewrap 时，Server Extensions 会保持禁用。这是平台限制，不是扩展错误。

## 包和清单参考

| 字段 | 说明 |
| --- | --- |
| `kind` | `marinara.personal-extension` 或 `marinara.personal-server-extension` |
| 顶层 `version` | 包封装版本；当前为 `1` |
| `config.name` | 必填显示名称，1-200 个字符 |
| `config.version` | 可选扩展版本，例如 `1.2.0`；以点分隔的数字版本支持降级警告 |
| `config.description` | 可选说明，最多 2,000 个字符 |
| `config.runtime` | `client` 或 `server`；默认为 `client` |
| `config.capabilities` | 请求的 Browser 能力；Server Extensions 必须使用空列表 |
| `config.jsPath` / `config.serverJsPath` | 相对于清单的 JavaScript 文件路径或有序路径数组 |
| `config.cssPath` | 可选 CSS 文件路径或有序数组；安全运行时 CSS 只会留在沙箱 iframe 内 |
| `config.js`, `config.serverJs`, `config.css` | 不需要独立文件时使用的内联替代项 |

请使用普通 JavaScript。Marinara 不会编译 TypeScript，也不会安装扩展依赖。必要时，请在导入前把依赖打包进 JavaScript。

还可以直接导入独立的 `.js`、`.mjs`、`.cjs`、`.server.js`、`.server.mjs`、`.server.cjs` 和 `.css` 文件。建议使用清单，因为它会明确记录身份信息、运行时、版本、能力和文件顺序。

### 验证限制

| 内容 | 当前边界 |
| --- | --- |
| 名称 / 版本 / 说明 | 200 个字符 / 64 个字符 / 2,000 个字符 |
| Browser 或 Server JS | 每个字段没有单独的源码上限；外层文件、压缩包或请求的边界仍然适用 |
| CSS | 256 KiB |
| 导入的 ZIP | 压缩后 32 MiB，每个文本条目 2 MiB，解压后文本总量 16 MiB |
| 私有存储 | 每个扩展最多 1,000,000 字节的序列化 JSON |

ZIP、请求、沙箱消息和存储限制分别保护不同的传输或运行时边界；它们不是针对可执行源码的政策。

## 更新和恢复生命周期

- 每次新导入都会从禁用且未批准的状态开始。
- 编辑代码、CSS、运行时或能力会清除批准并禁用扩展。
- 重新导入同名项目会在确认后更新现有记录。逐字节完全相同的重新导入会保留当前哈希和批准；可执行内容发生变化则会清除批准。数字版本表示降级时，Marinara 会发出警告。
- **Export**(导出) 会把当前清单和源文件写入可移植包。批准状态绝不会导出。
- 恢复修订版本、导入档案或恢复备份后，扩展会保持禁用，直到重新审核。
- **Disable**(禁用) 会停止运行时和已注册的清理操作。如果整页代码产生了未注册的副作用，可能需要重新加载页面。
- **Delete**(删除) 会删除已安装记录。如果以后可能还需要源码，请先导出。

## 调试

| 症状 | 检查项 |
| --- | --- |
| 外部导入控件未显示 | 打开上文介绍的两道 External Extension 安全门 |
| 管理界面提示需要 localhost 或 Admin Access | 配置 `ADMIN_SECRET` 并保存到 **Admin Access** |
| 导入操作找不到扩展 | 检查 `manifest.json` 及其相对路径；Server 需要 JS，Browser 需要 CSS 或 JS |
| 编辑后扩展被禁用 | 这是预期行为；检查并批准新的精确哈希 |
| Browser 代码无法使用 `document`、`window`、`fetch` 或本地存储 | 在安全沙箱中属于预期行为；使用文档列出的代理 API |
| Server Extension 不可用 | 使用 macOS Seatbelt 或装有 Bubblewrap 的 Linux，或者改用 Browser Extension |
| Browser Extension 抛出异常 | 打开浏览器开发者工具；`marinara.log` 和启动错误会带有扩展名称标签 |
| Server Extension 抛出异常 | 在 **Settings → Addons**(设置 → 插件) 中检查它的状态，并查看 Marinara 服务器日志 |

CSS、私有存储、导入压缩包和运行时消息分别有独立的安全限制。Marinara 应报告拒绝包的具体边界，而不是把问题显示为执行失败。

## 相关指南

- [Personal Extensions](personal-extensions.md)
- [服务器配置](../CONFIGURATION.md)
- [故障排除](../TROUBLESHOOTING.md)
- [Personal Extension 架构](../development/personal-extensions.md)
