# 个人扩展

个人扩展是一小段代码，可以给 Marinara 添加按钮、面板或辅助功能。Professor Mari 可以帮你写一个，而它会不会运行，始终由你决定。本指南介绍如何审查、启用、导出和恢复扩展。要自己编写扩展，请参阅[编写个人扩展](writing-personal-extensions.md)。

## 各种扩展分别是什么

| 名称 | 含义 |
| --- | --- |
| Personal Extension(个人扩展) | Professor Mari 为你写的扩展。它以草稿形式出现在 **Settings → Addons**(设置 → 插件) 下。 |
| External Extension(外部扩展) | 别人写的扩展，或者你自己写的扩展。它需要完成[允许第三方导入](#allow-third-party-imports)中的额外步骤。 |
| Browser Extension(浏览器扩展) | 在你的浏览器里的沙箱中运行。默认情况下是安全的。 |
| Server Extension(服务器扩展) | 在运行 Marinara 的那台电脑上运行，处于操作系统沙箱之中。需要受支持的平台。 |
| Full page access(整页访问) | 一项会去掉沙箱的权限。只用于你完全信任的代码。 |

## 安装别人分享的扩展

开始之前，先完成[允许第三方导入](#allow-third-party-imports)中的两个步骤。不完成这两步，导入按钮就不会显示。

1. 打开 **Settings → Addons**。在 **External Extensions**(外部扩展) 下，导入 `.zip`、`.json`、`.css` 或 `.js` 文件时选择 **Import Extension File**(导入扩展文件)，导入文件夹时选择 **Import Extension Folder**(导入扩展文件夹)。
2. 打开新的草稿。它处于禁用状态，并显示自己的代码和一个哈希值。哈希值是这段确切代码的简短指纹（Marinara 使用 SHA-256）。
3. 阅读代码和 **Requested access**(申请的权限) 列表。
4. 只有在你认可这个确切版本时，才选择 **Review and Run**(审查并运行)。之后扩展会显示为已启用。

如果没有成功：如果导入按钮不见了，说明那两个步骤中有一步还没完成。修改 `.env` 之后，记得重启 Marinara。

## 审查 Professor Mari 写的扩展

开始之前，先请 [Professor Mari](../home/professor-mari.md) 创建一个扩展。她可以保存代码，但不能批准或启用它。这个区块没有 New Draft(新建草稿) 按钮，也没有导入控件。

1. 打开 **Settings → Addons → Personal Extensions**(设置 → 插件 → 个人扩展)。没有草稿时，这里显示：“Ask Professor Mari to create an extension for you. Nothing runs until you enable it and approve the exact code hash.”
2. 打开草稿并阅读代码。核对哈希值和 **Requested access** 列表。
3. 只有在你认可这个确切版本时，才选择 **Review and Run**。

每份草稿一开始都是禁用状态。任何代码修改、权限变更或恢复的修订版本，都会让扩展禁用，需要重新批准。

> **警告：** 沙箱能限制代码的行为，但不能让代码变得可信。有害的扩展仍然可以白白占用处理器时间，直到看门狗（一个会停止失控代码的计时器）结束它；可以把自己的存储塞满到上限；也可以通过日志误导你。整页扩展是刻意放弃沙箱的。启用之前请先阅读代码，第三方代码要逐行检查。

如果没有成功：Professor Mari 的修改和任何恢复的修订版本，都会让草稿回到禁用状态。重新审查一遍，并确认对话框中的哈希值就是你读过的那个。

## 扩展能做什么

浏览器扩展运行在你浏览器里的沙箱（一块隔离出来的区域）中。它访问不到 Marinara 的页面、Cookie、浏览器存储或网络。它可以：

- 使用私有存储并写入日志
- 添加按钮、菜单项和面板，由 Marinara 按你的主题绘制
- 读取当前打开的聊天的 ID
- 读取当前角色或用户角色的部分字段，但仅在你批准相应权限之后

完整列表见[编写个人扩展](writing-personal-extensions.md#what-a-browser-extension-can-do)。

服务器扩展运行在一个独立的 Node 进程（服务器电脑上的一个程序）里，外面套着操作系统沙箱。它访问不到 Marinara 的文件、你的文件、服务器密钥、网络、子进程、Worker 或原生插件。

<a id="platform-support"></a>

### 平台支持

浏览器扩展由浏览器做沙箱隔离，所以在哪里都能用。服务器扩展需要受支持的操作系统沙箱。没有这种沙箱的平台上，它们会保持禁用，Marinara 绝不会在没有沙箱的情况下运行它们。

| 平台 | 服务器扩展 |
| --- | --- |
| macOS | 通过 macOS 沙箱 Seatbelt 隔离 |
| 装了 Bubblewrap 的 Linux | 通过 Linux 沙箱工具 Bubblewrap 隔离 |
| 没有 `bwrap` 的 Linux | 已禁用：请安装 `bwrap` |
| Docker(默认) | 已禁用：受容器权限限制 |
| Windows | 已禁用：请改用浏览器扩展 |
| Android | 已禁用：请改用浏览器扩展 |

浏览器扩展在所有平台上都有沙箱隔离。整页外部扩展在任何平台上都没有沙箱，始终需要你明确表示信任。

官方 Docker 镜像包含 Bubblewrap，但默认容器无法创建 Bubblewrap 所需的嵌套命名空间和挂载。Marinara 会在运行时测试沙箱；如果容器不允许，服务器扩展就保持禁用。关于调整 Docker 权限的方法及其安全取舍，请参阅[故障排除](../TROUBLESHOOTING.md#a-server-extension-says-no-supported-sandbox-is-available)。

Windows 和 Android 上没有受支持的进程沙箱，所以服务器扩展不可用。请改用浏览器扩展，或者把 Marinara 服务器运行在 macOS 或装了 `bwrap` 的 Linux 上。

<a id="allow-third-party-imports"></a>

## 允许第三方导入

第三方导入默认是锁定并隐藏的，因为它们会运行别人写的代码。打开它需要两步：

1. 在运行 Marinara 的电脑上，在 `.env` 文件里设置 `ENABLE_EXTERNAL_EXTENSIONS=true`，然后重启 Marinara。参见[服务器配置参考](../CONFIGURATION.md)。
2. 打开 **Settings → Advanced → Danger Zone**(设置 → 高级 → 危险区域)，滚动到数据删除控件下方，阅读警告，然后开启 **Allow third-party extension imports**(允许导入第三方扩展)。

之后，**Settings → Addons** 里会显示 **External Extensions**，其中有文件和文件夹导入控件。支持的格式：

- `.personal-extension.zip` 和兼容的 `.zip` 扩展包
- `.json` 清单文件
- `.css`
- `.js`、`.mjs` 和 `.cjs`
- `.server.js`、`.server.mjs` 和 `.server.cjs`

导入的扩展一律不带批准状态，也无法自行启用。大多数浏览器扩展都应该留在安全的沙箱里。标着 **Full page access** 的扩展包则不同：

- 它的代码在 Marinara 的页面里运行，没有沙箱。
- 它可以读取聊天和角色卡、使用浏览器存储、发起网络请求，并调用 Marinara 自己的 API。
- 只有在你检查过并信任这个确切版本之后，才启用它。
- Professor Mari 的草稿不能申请这项权限。

旧版记录、随档案导入的记录、手动存入的记录以及来源不明的记录，也都按外部扩展处理。在这两步都完成之前，它们会保持隐藏，无法批准，也不会运行。

关闭其中任何一步，都会禁用所有导入的扩展。重新开启不会让它们再次运行。如果某个整页扩展留下了改动，请刷新页面。

如果没有成功：如果导入控件没有出现，请确认两步都已完成，并且你是在服务器电脑上操作，或者已经在 **Settings → Advanced → Admin Access**(设置 → 高级 → 管理员访问) 中保存了管理员密钥。

## 导出、修订版本与恢复

用扩展的导出操作可以下载一个可移植的扩展包。导出和恢复的扩展包都保持禁用状态。恢复某个修订版本，也会让它回到禁用的草稿状态。

**Settings → Addons → Extension revision history**(设置 → 插件 → 扩展版本历史) 决定每个个人扩展和外部扩展保留多少个旧代码版本。默认是 **10**。可选 **0** 到 **10**，其中 **0** 表示关闭历史记录。降低上限时，会在永久删除较早的修订版本之前要求确认。当前代码、批准状态、启用状态和已保存的扩展数据都会保留。通过 Professor Mari 进行的修改也遵循同一上限。

如果扩展出了问题，选择 **Disable**(禁用)。如果界面无法使用，请停止 Marinara，把对应 `installed_extensions` 记录的 `enabled` 值设为 `"false"`。绝不要手动设置 `approvedHash`。

## 相关指南

- [编写个人扩展](writing-personal-extensions.md)
- [Professor Mari](../home/professor-mari.md)
- [服务器配置](../CONFIGURATION.md)
- [备份与恢复](../data/backup-and-restore.md)
- [远程访问](../REMOTE_ACCESS.md)
