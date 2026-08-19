# 编写 Personal Extensions

本指南面向为 Marinara Engine 编写自定义扩展的用户。要了解如何安装、检查并安全运行扩展，请先阅读 [Personal Extensions](personal-extensions.md)。

自行编写并导入的代码会被视为 **External Extension**(外部扩展)。它在初始状态下处于禁用状态；只有检查代码并批准其精确的 SHA-256 哈希后，才能运行。

## 开始之前

只有同时打开两道安全门后，External Extensions 才会显示：

1. 在 Marinara 主机的 `.env` 文件中设置 `ENABLE_EXTERNAL_EXTENSIONS=true`。
2. 打开 **Settings** > **Advanced** > **Danger Zone**，启用 **Allow third-party extension imports**。

导入和管理扩展还需要通过 localhost 访问，或者配置 **Admin Access**。如果通过手机、LAN 地址或远程浏览器使用 Marinara，请在服务器上设置 `ADMIN_SECRET`，并在 **Settings** > **Advanced** > **Admin Access** 中输入相同的值。

请选择能完成任务且权限最少的运行时：

| 运行时 | 适用场景 | 重要边界 |
| --- | --- | --- |
| Sandboxed Browser Extension | 私有状态、当前聊天上下文、按钮、菜单操作，以及由 Marinara 渲染的面板 | 无法访问 Marinara DOM、Cookie、浏览器存储、网络或任意 HTML |
| Server Extension | 需要托管计时器和扩展私有存储的后台逻辑 | 独立的操作系统沙箱；无法访问 Marinara 文件、密钥、网络、子进程或原生模块 |
| Full-page External Extension | 确实需要访问 Marinara 页面或同源 API 的旧代码 | 没有沙箱；只用于已经逐字检查且完全信任的代码 |

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

1. 打开 **Settings** > **Addons** > **External Extensions**。
2. 选择 **Import Folder** 并指定 `Hello Panel`，或者把文件夹压缩成 ZIP 后导入。
3. 打开已禁用的草稿，检查其清单和 JavaScript。
4. 选择 **Review and Run**，批准界面显示的精确哈希。
5. 打开 Extensions 菜单，选择 **Hello Panel**。

仓库的 `docs/examples/personal-extensions/browser-minimal/` 中提供了同一个可运行示例。

## Browser API 参考

在沙箱中运行的 Browser Extensions 会获得一个名为 `marinara` 的冻结全局对象：

| API | 用途 |
| --- | --- |
| `runtime`, `version` | 运行时名称（`client`）和当前 Browser API 版本 |
| `extensionId`, `extensionName`, `capabilities` | 此扩展修订版的身份信息和已批准能力 |
| `log.debug/info/warn/error(...)` | 向浏览器控制台写入带标签的记录 |
| `storage.get()` | 读取此扩展的私有 JSON 对象 |
| `storage.patch(object)` | 把值合并到私有存储中，并返回新对象 |
| `storage.delete()` | 清空私有存储 |
| `context.get()` | 读取当前聊天的最新快照 |
| `context.subscribe(listener)` | 接收上下文变化；返回取消订阅函数 |
| `ui.registerContribution(options)` | 添加安全按钮、Extensions 菜单项或由 Marinara 渲染的面板 |
| `ui.showWindow(options)` | 打开受限的 iframe 窗口 |
| `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval` | 扩展停止时会移除的托管计时器 |
| `onCleanup(callback)` | 注册额外的清理逻辑 |

普通 UI 请使用[由 Marinara 渲染的面板](personal-extensions.md#add-a-marinara-rendered-panel)，需要感知聊天的行为请使用[当前聊天上下文](personal-extensions.md#use-active-chat-context)。扩展状态应保存在 `marinara.storage` 中，而不是浏览器存储中。

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
| top-level `version` | 包封装版本；当前为 `1` |
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
- **Export** 会把当前清单和源文件写入可移植包。批准状态绝不会导出。
- 恢复修订版、导入档案或恢复备份后，扩展会保持禁用，直到重新审核。
- **Disable** 会停止运行时和已注册的清理操作。如果整页代码产生了未注册的副作用，可能需要重新加载页面。
- **Delete** 会删除已安装记录。如果以后可能还需要源码，请先导出。

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
| Server Extension 抛出异常 | 在 **Settings** > **Addons** 中检查状态，并查看 Marinara 服务器日志 |

CSS、私有存储、导入压缩包和运行时消息分别有独立的安全限制。Marinara 应报告拒绝包的具体边界，而不是把问题显示为执行失败。

## 相关指南

- [Personal Extensions](personal-extensions.md)
- [服务器配置](../CONFIGURATION.md)
- [故障排除](../TROUBLESHOOTING.md)
- [Personal Extension 架构](../development/personal-extensions.md)
