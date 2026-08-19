# 个人扩展

个人扩展是 Professor Mari 为你写的私人代码草稿。打开 **Settings**(设置) > **Addons**(附加组件) > **Personal Extensions**(个人扩展)。

默认提示是：

> Ask Professor Mari to create an extension for you. Nothing runs until you enable it and approve the exact code hash.

这个区块里既没有新建草稿的入口，也没有导入控件。要新建或修改草稿，直接找 Professor Mari。她可以保存代码，但不能批准或启用。

要自己编写并导入软件包，请使用[个人扩展编写指南](writing-personal-extensions.md)。自行编写的软件包走单独授权的 External Extensions 流程。

## 审查并启用

每份草稿一开始都是禁用状态。Marinara 会用 SHA-256 给可执行代码算出精确指纹。打开草稿，逐行看代码，核对界面上显示的哈希值，只有认可这个确切版本时才选 **Review and Run**(审查并运行)。可执行部分只要有任何改动，或者恢复了某个历史修订版本，扩展就会自动禁用，需要重新批准。

沙箱只是削减权限，并不能让来路不明的代码变得可信。恶意扩展仍然可以耗着 CPU 直到看门狗把它掐掉，可以在配额允许的范围内塞满自己的存储，也可以在日志里写误导性的内容。整页扩展更是主动放弃了这层隔离。启用之前一定要先看代码。

## 运行时隔离

浏览器扩展运行在一个不透明源沙箱 iframe 里的专用 Worker 中。它访问不到 Marinara 的页面、DOM、Cookie、浏览器存储、同源 API 和网络。它能用的只有扩展私有存储、日志、受管定时器、清理回调注册、受限窗口、安全的宿主界面贡献位，以及当前聊天和角色 ID 的只读快照。只有在相应权限已声明并获批之后，它才能拿到当前聊天中角色卡或所选用户角色的部分字段。

扩展可以用 `marinara.ui.registerContribution(...)` 添加顶栏操作、Extensions 菜单项和常驻的右侧面板。这些界面由 Marinara 用当前主题和一组固定控件渲染：标题、文本、预格式化输出、按钮、文本输入框、下拉菜单、开关、滑块、颜色控件和间隔块。扩展只提供内容和状态，永远不提供 HTML、CSS、URL、React 组件或宿主事件处理函数。

不管来源是什么，所有沙箱内的浏览器扩展都适用同一套界面能力和规则。导入的第三方（外部）扩展默认也跑在这个安全运行时里，除非它的扩展包明确申请 **Full page access**(整页访问权限)，或者用了下面讲到的沙箱之前的 `marinara.extension` 格式。

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

紧凑操作使用 `kind: "button"`，Extensions 菜单操作使用 `kind: "menu-item"`。按钮默认使用 `surface: "top-bar"`，也可以指向 `chats`、`bots`、`characters`、`personas`、`lorebooks`、`presets`、`connections`、`agents` 或 `settings`，并将 `position` 设为 `header`、`before-content` 或 `after-content`。`icon` 可接受 Marinara 支持的任意 kebab-case Lucide 图标名称。两种操作都会触发 `onActivate`。`panel` 在打开时触发 `onActivate`；其按钮会带着所有面板控件的当前值触发 `onEvent`。句柄支持按种类更新：`button` 接受 `label`、`description`、`icon`、`surface` 和 `position`；`menu-item` 接受 `label`、`description` 和 `icon`；`panel` 接受 `label`、`description`、`icon` 和 `elements`。所有句柄都支持 `remove()`。ID 可以包含字母、数字以及 `.`、`_` 和 `-`。

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

### 使用当前聊天的上下文

浏览器扩展 API 第 5 版会给出一组不透明标识符，指向 Marinara 当前显示的那个聊天：

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

### 旧版扩展与整页扩展

天气控制器、提示词编辑器这类比较完整的工作流，都是合适的贡献用例。它们的安全移植版可以用一个菜单入口或顶栏入口，配合逐步更新的面板来实现。已有的扩展包如果会注入 DOM 浮层、查询 Marinara 的 CSS 选择器、遍历 React 内部结构或调用同源 `/api` 路由，就无法原样导入安全运行时。

界面贡献只提供界面，不附带环境权限。上下文 API 始终提供当前聊天 ID 和角色 ID，除此之外最多只能给出上面列出的、已声明的活动记录字段。需要消息、预设、世界书、未声明的角色或用户角色数据、视觉场景特效的功能，仍然要等 Marinara 提供单独的、范围收窄的中介能力。扩展不得通过访问宿主 DOM 或发起不受限的网络请求来自行模拟这类能力。

如果某个外部扩展确实离不开宿主 DOM 访问权限，它可以这样申请：

```json
{
  "runtime": "client",
  "capabilities": ["full_page_access"]
}
```

**整页访问权限不是一项沙箱能力。** 获批的 JavaScript 和 CSS 直接跑在 Marinara 的页面里。这些代码能读取或修改当前浏览器会话可见的一切，能查看聊天和角色卡，能使用浏览器存储、发起网络请求、调用同源的 Marinara API。它的实际页面权限，和你往浏览器控制台里粘贴一段代码没有区别。Professor Mari 的草稿不能申请这项权限。

Marinara 会把不带显式 `capabilities` 字段的旧版 `kind: "marinara.extension"` v1 封装识别成沙箱之前的老扩展包，并在导入时给它分配 **Full page access**。这样 WeatherTweaker 这类旧扩展包就能走进正确的审查流程，而不是在 Worker 里悄无声息地失败。如果一个新扩展包用了这种封装、却想留在安全运行时里，就必须写上 `"capabilities": []`。

外部扩展的那两道开关和精确哈希审批依然有效。代码、CSS 或权限一旦变化，扩展就会自动禁用，需要重新批准。禁用时，Marinara 会移除自己插入的脚本和样式表节点，取消通过兼容 API 创建的定时器，并执行通过 `marinara.onCleanup(...)` 注册的回调。由于页面代码可以创建未登记的监听器、定时器、全局变量和 DOM 改动，清理只能做到尽力而为；禁用扩展后如果还有残留，刷新一下页面。

旧的 `marinara.ui.showWindow(...)` API 仍然可用，它会在不透明源 iframe 里开一个临时窗口，用的是同一组固定控件，返回 `update(...)` 和 `close()` 句柄。如果希望这个工具能从 Marinara 的常规导航里进入，优先用界面贡献。

服务器扩展跑在一个独立的、权限受限的 Node 进程里，外面套着 macOS Seatbelt 或 Linux Bubblewrap。它访问不到 Marinara 的文件、用户文件、继承来的服务器密钥、网络、子进程、Worker 和原生插件。如果 Marinara 建立不起受支持的操作系统沙箱，服务器扩展就一直保持禁用。

### 平台支持

浏览器扩展由浏览器本身做沙箱隔离，所以在哪都能用。服务器扩展需要受支持的操作系统沙箱；没有沙箱的平台上，它们会一直禁用且无法启用，Marinara 绝不会退而在无沙箱状态下运行它们。

| 平台                    | 沙箱内的浏览器扩展           | 整页外部扩展                  | 服务器扩展                            |
| ----------------------- | ---------------------------- | ----------------------------- | ------------------------------------- |
| macOS                   | ✅ 已沙箱隔离                | ⚠️ 需要明确信任               | ✅ 已沙箱隔离（Seatbelt）            |
| Linux(装了 Bubblewrap) | ✅ 已沙箱隔离                | ⚠️ 需要明确信任               | ✅ 已沙箱隔离（Bubblewrap）          |
| Linux(没有 `bwrap`)   | ✅ 已沙箱隔离                | ⚠️ 需要明确信任               | ⛔ 已禁用，请安装 `bwrap`             |
| Windows                 | ✅ 已沙箱隔离                | ⚠️ 需要明确信任               | ⛔ 已禁用，请改用浏览器扩展           |
| Android                 | ✅ 已沙箱隔离                | ⚠️ 需要明确信任               | ⛔ 已禁用，请改用浏览器扩展           |

Windows 和 Android 上没有受支持的操作系统进程沙箱，所以服务器扩展按设计就不可用。请改用浏览器扩展；确实需要服务器扩展的话，把 Marinara 服务器跑在 macOS 或 Linux(装了 `bwrap`) 上。

## 外部扩展

第三方导入默认是锁死并隐藏的，要开需要两步：

1. 在 Marinara 所在的主机上，在 `.env` 里设置 `ENABLE_EXTERNAL_EXTENSIONS=true`。
2. 打开 **Settings** > **Advanced** > **Danger Zone**，往下滚到数据删除控件下方，读完警告，然后启用 **Allow third-party extension imports**(允许导入第三方扩展)。

只有这样，**Settings** > **Addons** 里才会出现 **External Extensions**(外部扩展) 以及文件和文件夹导入控件。支持的格式列表始终展开显示：

- `.personal-extension.zip` 和兼容的 `.zip` 扩展包；
- `.json` 清单文件；
- `.css`；
- `.js`、`.mjs` 和 `.cjs`；
- `.server.js`、`.server.mjs` 和 `.server.cjs`。

导入进来的扩展一律不带批准状态，也无法自行启用。旧版记录、随档案导入的记录、手动存进来的记录以及来源不明的记录，同样按外部扩展处理。两道开关全部开启之前，它们会一直隐藏，无法批准，两个运行时都不会加载。

批准某个精确哈希之前，先看一遍 **Requested access** 列表。大多数浏览器扩展都应该留在安全沙箱里。标着 **Full page access** 的扩展包是刻意不做隔离的，只有在逐行看过并且信任这个确切版本时才启用。

任意一道开关关闭，都会停掉正在运行的外部服务器进程，移除浏览器 Worker 和整页运行时节点，并禁用已存储的外部扩展记录。重新开启开关不会自动把它们跑起来。如果某个整页扩展留下了没登记清理的改动，刷新页面即可。

第三方扩展可能包含恶意或危险代码。下载、导入或启用之前，请务必逐行检查。后果完全由你自己承担。

## 导出、修订版本与恢复

用扩展的导出功能可以下载一个可移植的扩展包。导出和恢复得到的扩展包都是禁用状态。恢复某个修订版本，同样会让它回到禁用的草稿状态。

扩展出问题时，选择 **Disable**(禁用)。如果界面打不开，先停掉 Marinara，再把对应 `installed_extensions` 记录的 `enabled` 值改成 `"false"`。绝对不要手动设置 `approvedHash`。

## 相关指南

- [编写个人扩展](writing-personal-extensions.md)
- [Professor Mari](../home/professor-mari.md)
- [服务器配置](../CONFIGURATION.md)
- [备份与恢复](../data/backup-and-restore.md)
- [远程访问](../REMOTE_ACCESS.md)
