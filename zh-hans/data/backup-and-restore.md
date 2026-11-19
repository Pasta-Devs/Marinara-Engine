# 备份与恢复 Marinara

保存一份 Marinara Engine 数据的副本，之后再把它恢复回去。在升级、换到新设备或[清除数据](clearing-data.md)之前，请先这样做。

## 选择方式

| 选项 | 生成的内容 | 用途 |
| --- | --- | --- |
| **Download Backup**(下载备份) | 一个包含全部数据和文件的 `.zip`。 | 完整保存一份所有内容的副本。 |
| **Export Profile**(导出档案) | 一个较小的文件，包含你的账号数据（角色、聊天、世界书等）。 | 不含密钥的副本，或供其他工具使用的文件。 |

`.zip` 是一个能装下许多文件的压缩文件。两个选项都在 **Settings → Advanced → Backup & Export**(设置 → 高级 → 备份与导出) 里。恢复数据在 **Settings → Imports → Profile & Marinara**(设置 → 导入 → 档案与 Marinara) 里。

**开始之前：** 在运行 Marinara 的电脑上，这些工具可以直接使用。从手机、平板或其他任何设备访问时，请先在服务器上设置管理员密钥，然后把同样的值填入 **Settings → Advanced → Admin Access**(设置 → 高级 → 管理员访问)。管理员密钥是服务器 `.env` 文件中的一个密码，对应的设置项是 `ADMIN_SECRET`。参见 [服务器配置参考](../CONFIGURATION.md) 中的“授权 API(ADMIN_SECRET)”一节，以及 [远程访问](../REMOTE_ACCESS.md)。

## Download Backup

1. 打开 **Settings → Advanced**。
2. 在 **Backup & Export** 中点击 **Download Backup**。按钮会显示 **Creating backup…**。
3. 浏览器询问时保存该文件，或到下载文件夹中找到它。

`.zip` 包含：

- 你保存的文本数据（角色、聊天、世界书、预设、连接和设置）；
- 你上传和生成的文件，例如头像、立绘、背景、图库图片、字体、自定义表情和贴纸，以及你自定义的通知音；
- `.encryption-key` 文件（如果存在）；
- 一份关于手动恢复文件的 `RESTORE.txt` 说明（见 [手动恢复](#restore-by-hand)）。

文件夹的名称见 [Marinara 的数据保存在哪里](where-data-is-stored.md)。

> **警告：** 备份中保存着你的 API 密钥，以及能解锁这些密钥的 `.encryption-key` 文件。千万不要分享它，请存放在私密的地方。

在 Android 上无法访问应用的数据文件夹，因此 **Download Backup** 是把副本导出到设备之外的唯一简便办法。

如果没有成功：如果看到 “Backup preparation timed out after one hour.”，请再试一次。如果其他设备无法下载，请检查 **Admin Access**(见上文)。

<a id="automatic-backups"></a>
## 自动备份

Marinara 可以在运行它的电脑上按计划自动创建完整备份。

1. 打开 **Settings → Advanced → Backup & Export**。
2. 开启 **Automatic backups**(自动备份)。
3. 选择 **Daily**、**Weekly** 或 **Monthly**。
4. 把 **Automatic backups kept**(保留的自动备份数量) 设为 1 到 9999 之间的数字。

开启后，Marinara 很快会创建第一份备份。每次运行后，它会保留最新的若干份备份，数量与你设定的一致，并删除更早的自动备份。它从不删除你用 **Download Backup** 创建的备份。

自动备份保存在数据文件夹里的 `backups/` 文件夹中。最新的一份是 `marinara-automatic-backup.zip`。较早的备份文件名中带有日期和时间。它们和 **Download Backup** 使用同样的格式。

每次运行都需要多出一份完整归档的空间，因为旧的归档要等新归档完成后才会删除。空间不足时，Marinara 会跳过这次运行，并在设置旁边显示原因。腾出空间后，它会再次尝试。

> **提示：** 在数据文件夹之外另存一份副本。磁盘丢失或应用被删除时，自动备份也会一起消失。

<a id="export-a-profile"></a>

## 导出档案

1. 打开 **Settings → Advanced → Backup & Export**。
2. 点击 **Export Profile**。随即打开一个同名窗口。
3. 选择一种格式。
4. 浏览器会下载该文件。

- **Marinara Native** 保留你的角色、用户角色、聊天、世界书、预设、智能体、主题、Personal Extension(个人扩展)代码和媒体文件。恢复时不会还原 API 密钥、webhook 链接以及部分聊天设置（见 [恢复之后：重新填写密钥](#enter-your-keys-again)）。这种档案可以在 Marinara 里恢复。
- **Compatible JSON** 会生成一个 `.zip`，里面是供其他工具使用的普通角色、用户角色和世界书文件。这种档案不能在 Marinara 里恢复。

原生档案会下载为 `marinara-profile.json`。如果档案太大，Marinara 会改为提供 ZIP 文件。点击 **Export ZIP** 即可下载 `marinara-profile.zip`。

原生档案会保留正则脚本、所在的文件夹以及每个文件夹的暂停设置。要将单条脚本作为 JSON 分享，见[正则脚本](../extending/regex-scripts.md#import-and-replace-scripts)。

原生档案保留 Personal Extension 的代码，但不保留扩展是否开启或是否获得批准的状态。恢复出来的每个扩展都处于禁用状态。请在 **Settings → Addons**(设置 → 插件) 里重新审核。

## 使用 Import Profile 恢复

**Import Profile**(导入档案) 可以加载档案文件，或者 **Download Backup** 生成的 `.zip`。

1. 打开 **Settings → Imports**。
2. 在 **Profile & Marinara** 中点击 **Import Profile (JSON/ZIP)**。
3. 选择 `marinara-profile.json`、`marinara-profile.zip` 或备份用的 `.zip`。按钮会显示 **Scanning Profile...**。
4. 阅读 **Import Profile** 窗口。窗口列出 Marinara 找到的内容。Marinara 里已有的项目会被文件中的版本替换，除非你选择[只添加缺少的内容](#only-add-whats-missing)。
5. 点击 **Import** 开始导入，或点击 **Cancel** 停止。按钮会显示 **Importing Profile...**。Marinara 会先为你的数据保存一份安全副本，然后出现进度条。完成后，会有一条提示说明档案已导入。

如果没有成功：

- 除非你通过 `localhost`、`127.0.0.1` 或 `[::1]` 打开 Marinara，否则导入档案需要 HTTPS。错误信息是 “Profile import requires HTTPS outside local development.” 请通过 HTTPS 地址打开 Marinara。
- 如果 `.zip` 缺少部分媒体文件，导入仍会完成。警告会列出缺失的文件，其余内容照常导入。
- 如果磁盘空间不足，无法保存安全副本，就什么都不会导入。错误信息以 “Nothing was imported, because a safety copy could not be saved first.” 开头。请腾出大约一份完整备份所需的空间，然后重新导入。

同一份档案导入两次时，Marinara 会更新已有项目，不会重复复制。较旧版本导出的档案可能会产生重复项。

<a id="only-add-whats-missing"></a>
### 只添加缺少的内容

想找回删掉的内容，又不想丢掉之后做的改动，就开启 **Import Profile (JSON/ZIP)** 上方的 **Keep my current versions, only add what's missing**(保留我当前的版本，只添加缺少的内容)，然后按上文的步骤导入。Marinara 里已有的每个项目和文件都保持原样，只添加 Marinara 没有的内容。这包括文件保存之后你删掉的所有内容，例如单条消息或世界书条目，而不只是你想找回的那一项。长期记忆算作一个项目：如果 Marinara 里已经有长期记忆，就不会添加文件中的长期记忆。

这种方式不会替换任何内容，所以 Marinara 不会保存安全副本，**Undo Last Import**(撤销上次导入) 撤销的仍然是这次之前的那次导入。

较旧版本导出的档案做不到这一点：它们总是把自己的项目添加在你已有的项目旁边，**Import Profile** 窗口也会说明这一点。

### 撤销导入

每次会替换项目的导入开始之前，Marinara 都会把你的数据完整复制一份，保存在数据文件夹的 `backups/` 文件夹里，文件名以 `marinara-before-import-` 开头，后面跟着日期和时间。导入完成后，上一次导入留下的副本会被删除，所以只保留最新的一份。

1. 打开 **Settings → Imports**。
2. 在 **Profile & Marinara** 中点击 **Undo Last Import**。按钮下方的一行显示安全副本的保存时间。
3. 在窗口中点击 **Undo Last Import** 确认。

撤销会把上次导入替换掉的项目和文件恢复成你原来的版本。如果你在导入之后改动过其中某个项目，这个改动会丢失。其他内容都保持原样，包括导入添加的项目。每次导入只能撤销一次，之后安全副本会被删除。

导入出于安全考虑关闭的内容，撤销不会重新开启。请手动重新开启这些内容：

- 你当前启用的主题；
- Personal Extensions(在 **Settings → Addons** 里重新审核)；
- 运行脚本或 webhook 的自定义工具；
- Professor Mari 的记忆。

如果导入清空了某个连接的 API 密钥，请重新填写（见[恢复之后：重新填写密钥](#enter-your-keys-again)）。如果这个连接原本是你的默认连接或备用连接，也请重新这样设置。

被导入替换的分支聊天，仍然与它们分出来的那个聊天断开关联。导入时已经移除了这层关联，撤销也无法恢复。

较旧版本导出的档案只会添加项目，所以 Marinara 不会为它们保存安全副本，也没有可撤销的内容。

安全副本占用的空间和一份完整备份一样大。如果想腾出这些空间又不撤销导入，在 **Profile & Marinara** 中点击 **Delete Safety Copy**(删除安全副本)，然后确认。你的数据保持原样，但你将无法再撤销那次导入。如果某次导入被中断，**Delete Safety Copy** 可能会单独出现；这时这份副本不能用于撤销，但你仍然可以删除它。

<a id="enter-your-keys-again"></a>
## 恢复之后：重新填写密钥

即使是从 **Download Backup** 生成的 `.zip` 导入，**Import Profile** 也不会恢复 API 密钥或 webhook 链接。API 密钥是服务商提供给你的秘密代码。档案文件和备份中的档案都会把这些值清空。因此，在新电脑上导入之后，你必须重新填写：

1. 从顶栏打开 **Connections**(连接)。
2. 打开你使用的每个账号，填写其 API 密钥并保存。参见 [连接 AI 服务商](../connections/connecting-to-a-provider.md)。
3. 在每个使用 webhook 链接的自定义工具上重新填写该链接。

一些带有地址或密钥的聊天设置（Discord、DeepL、Intiface）也会变回空白。请在每个聊天的 **Chat Settings**(聊天设置) 里重新填写。

导入不会清空同一安装实例中你已经设好的密钥。

## 迁移到新电脑

1. 在新电脑上安装并启动 Marinara。参见 [安装指南](../INSTALLATION.md)。
2. 打开 **Settings → Imports → Profile & Marinara**，点击 **Import Profile (JSON/ZIP)**。
3. 选择你的 **Download Backup** `.zip` 或档案文件，然后点击 **Import**。
4. 按上文所述，重新填写你的 API 密钥。

备份中的密钥文件只有在你像下文那样手动复制整个数据文件夹时才有用。

<a id="restore-by-hand"></a>
## 手动恢复

只有在无法使用 **Import Profile** 时，才使用这种方法。`.zip` 里有一个文件夹，例如 `marinara-backup-...`，里面附有一份 `RESTORE.txt` 说明。

1. 停止 Marinara。
2. 解压备份文件。
3. 把解压后文件夹中的各个文件夹和 `.encryption-key` 文件复制到你的数据文件夹。参见 [Marinara 的数据保存在哪里](where-data-is-stored.md)。
4. 启动 Marinara。

请把 `.encryption-key` 文件和 `storage` 文件夹放在一起保存，否则已保存的 API 密钥将无法读取。

**Backup & Export** 里的 **Existing backups**(已有备份) 列表通常是空的，你不需要它。

## 相关指南

- [Marinara 的数据保存在哪里](where-data-is-stored.md)
- [清除或重置数据](clearing-data.md)
- [升级 Marinara Engine](../UPGRADING.md)
- [连接 AI 服务商](../connections/connecting-to-a-provider.md)
- [远程访问：登录与 IP 允许列表](../REMOTE_ACCESS.md)
