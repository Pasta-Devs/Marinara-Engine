# 备份与恢复 Marinara

本指南介绍在 Marinara Engine 里保存一份完整数据副本的两种方式，以及之后怎么把这份副本装回去。更新版本、换新设备、重置数据之前，都先看这里。

## 保存数据的两种方式

Marinara 提供两个保存入口。它们位置不同，用途也不同。

- **Download Backup**(下载备份) 会把磁盘上的所有内容打包成一个完整的 **.zip** 压缩包。**.zip** 是一个压缩文件，里面可以装下许多文件。这是最完整的副本，也是防止数据丢失最可靠的手段。
- **Export Profile**(导出档案) 生成的文件更轻，只包含账号数据（角色、用户角色、聊天、世界书、预设、智能体、主题以及 Personal Extensions(个人扩展)）。档案就是 Marinara 为账号做的一份便携副本，之后可以在 Marinara 里恢复回来。

只想要一份万无一失的完整副本，就用 **Download Backup**。想要体积更小、或者能被其他角色扮演工具读取的文件，就用 **Export Profile**。

两个保存入口都在 **Settings**(设置) 的 **Advanced**(高级) 选项卡里，位于 **Backup & Export**(备份与导出) 一节。

## 在本机和其他设备上使用

在运行 Marinara 的那台电脑上，这两个功能可以直接用。这属于本机环回（loopback）访问，也就是在同一台机器上通过 `localhost` 或 `127.0.0.1` 打开应用。

从手机、平板或任何其他设备访问时，备份和恢复需要 **Admin Access**(管理员访问) 密钥。先在服务器上设好这个密钥，再把同样的值粘贴到 **Settings** 的 **Advanced** 选项卡下的 **Admin Access** 里。具体做法见文末链接的远程访问指南。

## Download Backup

**Download Backup** 会生成一个 **.zip** 文件，里面包含数据库、设置，以及全部媒体文件夹（头像、立绘、背景、图库图片、字体、自定义通知音等等）。

1. 打开 **Settings**。
2. 切到 **Advanced** 选项卡。
3. 找到 **Backup & Export** 一节。
4. 点击 **Download Backup**。
5. 处理期间按钮会显示 **Creating backup…**。
6. 压缩包准备好后，Marinara 会直接把它流式传输到浏览器，不会在页面内存中保存整个文件。
7. 根据下载设置，浏览器会打开常规的 **Save As** 窗口，或者把文件放进下载文件夹。

这一步在 Android 和 iOS 上尤其重要。这些设备上通常访问不到应用自己的数据文件夹，**Download Backup** 就成了把副本导出到设备之外的唯一简便办法。存到安全又私密的地方，比如自己的云盘。

**.zip** 里还有一个名为 `RESTORE.txt` 的纯文本文件，说明了必要时如何手动恢复数据。备份文件要当作私密文件对待：它可能包含用于解锁已保存 API 密钥的秘密文件。想知道每个文件夹装的是什么，见下方链接的数据位置指南。

## 自动备份

**Backup & Export** 一节还可以在运行 Marinara 的设备上创建轮换式的自动完整备份。
打开 **Automatic Backups**(自动备份)，选择 **Daily**、**Weekly** 或 **Monthly**，
再把 **Automatic backups kept**(保留的自动备份数量) 设为 1 到 9999 之间的值。启用后 Marinara 很快就会创建第一份备份。
此后每次成功运行，都会保留设定数量的最新自动压缩包，并删除多出来的最旧的那份自动压缩包。
这个保留上限绝不会删除手动备份，也不会删除用 **Download Backup** 保存的备份。

自动备份存放在 Marinara 数据文件夹下的 `backups/` 里。
最新的压缩包是 `marinara-automatic-backup.zip`，保留下来的较早自动压缩包则使用带时间戳的文件名。
它们和 **Download Backup** 使用同一种可恢复的流式压缩包格式，同样包含上传的媒体文件，
以及加密密钥文件（如果存在的话）。
如果要防范磁盘损坏、应用存储被清空或设备重置，还需要在 Marinara 数据文件夹之外另存一份。

## Export Profile

**Export Profile** 生成的文件更小，只包含账号数据。媒体文件也在其中，所以头像、图片和自定义通知音都会一起带走。

1. 打开 **Settings**。
2. 切到 **Advanced** 选项卡。
3. 找到 **Backup & Export** 一节。
4. 点击 **Export Profile**。
5. 弹出标题为 **Export Profile** 的窗口，里面有两个选项。
6. 选择一种格式（下面有说明）。
7. 文件会下载到设备上。

窗口提供两种格式：

| 格式 | 是什么 | 能在 Marinara 里恢复吗？ |
| --- | --- | --- |
| **Marinara Native** | 保留 Marinara 专有字段、世界书文件夹、角色和用户角色数据、预设、智能体、主题、Personal Extension 草稿以及内嵌媒体。 | 能 |
| **Compatible JSON** | 供其他角色扮演工具使用的普通角色、用户角色和世界书文件。 | 不能 |

想留一份日后能在 Marinara 里恢复的副本，就选 **Marinara Native**。
体积较小的档案会下载为 `marinara-profile.json`，较大的档案则以流式的 `marinara-profile.zip` 形式提供，
其中的数据会拆分成若干大小受限的表文件，这样内容再多也不必全部塞进一个内存中的 JSON 字符串里。

原生档案会保留 Personal Extension 的代码，但不保留它的启用状态和执行授权。恢复出来的扩展一律处于禁用状态，必须在 **Settings** > **Addons** 里重新审核一遍。

只有在需要把角色或世界书搬到别的工具里时，才选 **Compatible JSON**。它下载的是一个装着普通文件的 **.zip**，无法再用 **Import Profile** 导回 Marinara。

## 用 Import Profile 恢复

要把保存好的档案或 **Download Backup** 压缩包装回去，用 **Import Profile**(导入档案)。它和保存类功能不在同一个选项卡里。

1. 打开 **Settings**。
2. 切到 **Imports**(导入) 选项卡。
3. 找到 **Profile & Marinara**(档案与 Marinara) 一节。
4. 点击 **Import Profile (JSON/ZIP)**。
5. 选择文件。可以是 `marinara-profile.json`、`marinara-profile.zip`，也可以是完整的 **Download Backup** **.zip**。
6. Marinara 会先扫描文件，按钮显示 **Scanning Profile...**。
7. 弹出标题为 **Import Profile** 的窗口，列出扫描到的内容，比如角色和用户角色的数量。
8. 窗口会提示导入无法撤销。看完之后点击 **Import** 继续，或者点击 **Cancel** 中止。
9. 导入开始运行，显示 **Importing Profile...** 和一个进度条。

较新的 Marinara 档案在恢复时，依据的是每个项目自身的身份标识，而不是名称。所以同一份档案导入两次，只会就地更新已有项目，不会产生重复。

很旧的档案文件（来自版本老得多的 Marinara）没有这个特性。重复导入这类文件可能造出重复的角色、用户角色和世界书。只恢复较新导出的文件就不会遇到这个问题。

如果选好文件之后、确认之前又在磁盘上改动了它，导入会中止并给出警告。重新选一次文件就行。

如果 **.zip** 里缺少部分媒体文件，导入依然能完成。界面会显示一条琥珀色警告，列出缺失的文件，其余内容照常导入。

## 恢复之后：重新填写密钥

**Export Profile** 会把秘密值从档案文件里剔除，保存的 API 密钥和 webhook 链接在里面都是空的。这样档案文件存放和分享起来才安全。API 密钥是把 Marinara 接入 AI 服务商的那串密码。

**Download Backup** 压缩包则不一样，Marinara 不会从中剔除秘密值。备份 **.zip** 是数据的原样副本，里面既有保存的密钥，也有能解锁它们的秘密文件。备份 **.zip** 绝对不要分享，请存放在私密的地方。

**Import Profile** 始终从档案文件恢复，即便选的是备份 **.zip** 也一样。压缩包内部带有一份档案文件的副本，导入读取的就是这份副本。所以导入创建出来的项目，密钥和 webhook 链接都是空的。

导入档案之后，按下面的步骤操作：

1. 打开 **Settings**。
2. 切到 **Connections**(连接) 选项卡。
3. 为用到的每个服务商重新填写 API 密钥。

如果用了会调用 webhook 链接的自定义工具，也要在每个工具上重新填一遍链接。

导入不会抹掉已经设好的密钥。重新导入旧档案时，对于仍然存在的项目，Marinara 会保留当前生效的密钥和 webhook 链接，重新导入不会把它们清空。

## Existing backups 列表

**Backup & Export** 一节可能会显示一个带删除按钮的 **Existing backups**(已有备份) 列表。正常使用下这个列表一直是空的。**Download Backup** 会把文件直接存到设备上，不会在这个列表里留下副本；而那份轮换的自动压缩包则由 Automatic Backups 控件负责管理。制作和保管下载下来的备份，不需要用到这个列表。

## 相关指南

- [Marinara 的数据保存在哪里](where-data-is-stored.md)
- [清除或重置数据](clearing-data.md)
- [升级 Marinara Engine](../UPGRADING.md)
- [连接 AI 服务商](../connections/connecting-to-a-provider.md)
- [远程访问：Basic Auth 与 IP 允许列表](../REMOTE_ACCESS.md)
