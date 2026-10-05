# Card Browser：查找并导入角色

本指南介绍 Marinara Engine 的 **Card Browser**(角色卡浏览器)，它是内置的角色卡查找工具，可以在公开网站上找角色卡，并直接导入到自己的角色库。内容包括各个来源站点、搜索和筛选的方法，以及各来源对成人内容的处理方式，另外还有导入角色和把角色存成文件的做法。旧版本里这个选项卡叫 **Bot Browser** 或 **Browser**。

角色卡是一个文件，里面存着一个角色的名字、性格、开场白和其他细节。通常的做法是先从网站下载角色卡，再上传到 Marinara。**Card Browser** 把这两步合并到了一处。

## Card Browser 是什么

**Card Browser** 可以在 Marinara 内部搜索多个公开的角色卡网站，支持五个来源：**ChubAI**、**JannyAI**、**Pygmalion**、**Wyvern** 和 **DataCat**。**CharacterTavern** 仍在列表里，但暂时无法浏览（见 [CharacterTavern](#charactertavern)）。选定来源后可以搜索、筛选结果，并预览角色的完整信息，然后把角色导入角色库，或者存成 PNG 文件。默认设置下，浏览和导入角色卡都不需要账号，也不需要 API 密钥（类似密码的一串秘密字符）。

## 打开 Card Browser

打开 **Card Browser** 有两种方式。

1. 点击顶栏的 **Card Browser** 图标，它在右侧那排面板按钮里。
2. 或者打开右侧边栏的 **Card Browser** 面板，再点击面板顶部的 **Download Cards**(下载角色卡) 按钮。

无论用哪种方式，整个内容区都会切换成完整的 **Card Browser** 视图。这个视图会取代聊天区域，不是一个小的弹出窗口。

想离开，点击 **Card Browser** 顶部左上角的返回箭头按钮，就会回到进来之前的画面。

应用开着的时候，**Card Browser** 会一直驻留着。关掉再打开，上次的搜索词、筛选条件和选中的角色都还在。重新加载整个应用才会清空。

## 选择来源

点击顶部的来源按钮，它上面显示当前来源名和一个小箭头。菜单会按这个顺序列出各个来源：**ChubAI**、**JannyAI**、**CharacterTavern**、**Pygmalion**、**Wyvern** 和 **DataCat**。**CharacterTavern** 会标为 **Unavailable**(不可用)。

第一次打开 **Card Browser** 时默认选中 **ChubAI**。切换来源会清空搜索词、标签和筛选条件。每个来源的成人内容设置和登录状态各自独立保存，改动其中一个不会影响其他来源。

名称上有一处要注意：菜单里写的是 **ChubAI**，但在角色详情页上，跳转到站外的链接写的是 **View on Chub**。这是那个网站自己的叫法。其他来源在两处用的是同一个名字。

## CharacterTavern

CharacterTavern 重建了网站，不再提供 Marinara 原先用来搜索和下载角色卡的连接。选择 **CharacterTavern** 时，**Card Browser** 会显示一段简短的说明，而不是搜索结果。如果 CharacterTavern 日后开放 API 访问，浏览功能可能会恢复。

在那之前，仍然可以手动把 CharacterTavern 的角色带进 Marinara：

1. 点击说明里的 **Open CharacterTavern**(打开 CharacterTavern)，网站会在新选项卡里打开。
2. 从 character-tavern.com 下载角色卡文件。
3. 点击说明里的 **Import Character**(导入角色)，选择下载好的文件。导入方法见[导入和导出角色卡](import-export.md)。

之前从 CharacterTavern 导入的角色仍然留在角色库里。

## 搜索、排序与翻页

在 **Search characters...** 输入框里输入内容就能搜索，不用按 Enter。停止输入大约半秒后，Marinara 会自动开始搜索。清空输入框或者改动筛选条件，同样会重新搜索一次。

搜索框旁边是排序下拉菜单。各来源的选项不一样，默认排序也各不相同：

| 来源      | 默认排序        |
| --------- | --------------- |
| ChubAI    | Most Downloaded |
| JannyAI   | Newest          |
| Pygmalion | Downloads       |
| Wyvern    | Popular         |
| DataCat   | Relevance       |

点击 **Refresh**(刷新) 按钮（圆形箭头图标）可以重新执行当前的搜索。

结果下方是 **Previous**(上一页) 和 **Next**(下一页) 按钮，中间是形如 **Page 2** 的页码。当来源报不出确切的结果总数时，这里只显示当前页码。

**DataCat** 有一点要注意：它的 **Fresh** 排序只有在既没有标签筛选、也没有搜索词的时候才真正给出最新结果。一旦输入搜索词或选中标签，**DataCat** 就退回到普通的相关度结果。

## 按标签筛选

点击工具栏的 **Tags**(标签) 按钮打开标签面板。

- 在 **Search tags...** 输入框里输入内容可以缩小标签列表。
- 点击标签旁边的绿色对勾把它加进筛选，点击红色减号把它排除。同一个标签只能二选一。
- 加进筛选的标签显示为绿色小标，被排除的显示为红色小标。点击任意小标即可移除。
- **Clear**(清除) 按钮会一次清掉所有生效的标签。

大多数来源的标签列表是根据最近几次搜索出来的角色生成的。第一次搜索之前，面板上写着 **Tags will appear after searching**。想要的标签没列出来时，直接输入名字，会出现两个按钮，分别用来把它加进筛选或者从结果里屏蔽掉。

**DataCat** 的做法不同。它的标签库非常庞大，所以一打开就直接加载最热门的标签。其他标签仍然可以手动输入。

## 更多筛选项

部分来源会在工具栏多出一个 **Filters**(筛选) 按钮。只有当该来源确实提供筛选项时它才出现，所以 **DataCat** 上看不到。按钮上的小角标显示当前生效了几项筛选。

筛选面板里可能有：

- 内容复选框，例如 **Lorebook** 或 **Alt Greetings**，勾上之后只保留带这项内容的角色。世界书是角色可以随身携带的一组额外背景设定。
- **Sort Direction**(排序方向)，可选 **Descending** 或 **Ascending**，只在 **ChubAI** 和 **Pygmalion** 上提供。
- **Min Tokens** 和 **Max Output Tokens** 两个数字输入框，按体量限制结果。留空则使用来源自己的默认值。
- **JannyAI** 多一个 **Show Low Quality** 开关，默认关闭，会隐藏被 **JannyAI** 标记为低质量的角色。开启后这些角色也会出现在结果里。

**Wyvern** 要注意：它的 **Lorebook** 和 **Alt Greetings** 复选框会显示，**Min Tokens** 和 **Max Output Tokens** 输入框也在，但它们都不会改变 **Wyvern** 的结果。想缩小 **Wyvern** 的结果范围，改用排序下拉菜单和标签。

## 各来源的成人内容（NSFW）

应用里把成人内容标记为 **NSFW**。工具栏上只有一个 **NSFW** 复选框，但每个来源对它的处理都不一样。这是最常被问到的地方，看仔细一点。

- **ChubAI** 和 **JannyAI**：**NSFW** 复选框直接生效，不需要登录，默认关闭。
- **Pygmalion**：登录之前 **NSFW** 复选框是灰的，鼠标悬停的提示会让你先登录。登录之后，应用会跟随你在 Pygmalion 上的账号设置，复选框的文字随之变成 **NSFW depends on your account settings**。登录后就没有单独的开关了。
- **Wyvern**：**NSFW** 复选框始终是灰的，旁边有一条说明 **Use "🔞 Popular NSFW" sort for NSFW content**。想在 **Wyvern** 上看成人内容，要在排序下拉菜单里选 **🔞 Popular NSFW**。
- **DataCat**：站上每个角色都带成人标记，所以复选框被锁定为开启。第一次选择 **DataCat** 时会弹出一个标题为 **DataCat is NSFW only** 的窗口，点击 **Continue to DataCat** 继续浏览，点击 **Don't continue to DataCat** 返回。

成人角色的缩略图角上会有一个红色的 **NSFW** 小角标。

## 登录 Pygmalion

**Pygmalion** 把成人内容藏在登录之后。普通的公开角色不用登录，登录只是为了解锁成人内容。

登录时点击工具栏的 **Log In**(登录) 按钮，会打开一个登录窗口，需要粘贴一段从你的 Pygmalion 账号里复制出来的值。Marinara 不会索要密码。

**Pygmalion** 的窗口标题是 **Pygmalion Authentication**，要填的是 **Auth Token**：

1. 打开 pygmalion.chat 并登录账号。
2. 打开浏览器的开发者工具，大多数浏览器按 F12 键即可。开发者工具是浏览器内置的一个面板，面向进阶用户。
3. 切换到 **Application** 选项卡，再进入 **Local Storage**。
4. 找到名为 `authn` 的条目，复制它的值。
5. 把这个值粘贴到 Marinara 的 **Auth Token** 输入框里。输入框会隐藏粘贴进去的内容。
6. 点击 **Save & Connect**。接着应该会看到一条提示，说明 NSFW 内容已启用。

窗口里有一段帮助说明，把这些步骤重复了一遍，还有一个打开 pygmalion.chat 的 **Website** 链接。

这是你的 Pygmalion 账号登录信息。Marinara 会把它保留在内存里，直到重启或点击 **Log Out** 为止。想退出登录，重新打开登录窗口并点击 **Log Out**。要彻底退出，还得在 pygmalion.chat 上也退出登录。

Marinara 会先向 Pygmalion 核实这个 Token，确认有效才会保留。如果 Pygmalion 不接受，就什么都不会保存，并会有一条消息说明原因。如果之后 Pygmalion 不再接受这个 Token，Marinara 会自动退出登录，并提示你重新登录。

重要提示：这个登录信息只保存在服务器的内存里，绝不会写进文件。重启 Marinara 服务器之后就会退出登录，必须重新粘贴一次 Token。发生这种情况时，Marinara 会提示重新登录。

## 导入前先查看角色

点击任意一张结果卡片就能打开它的详情视图，用 **Back to results**(返回结果) 回到列表。

详情视图里有角色的头像、名字、作者、一句简短的介绍语，以及最多二十个标签小标。另外还有一个 **View on** 链接，会在新选项卡里打开角色在原站点的页面。

再往下是角色的完整信息，只有来源提供时才显示。这些板块的标题包括 **Creator's Notes**、**Personality**、**Scenario**、**First Message** 和 **Alternate Greetings**。角色自带世界书时，会出现一个琥珀色的 **Has embedded lorebook** 角标。

有些来源不一定每次都返回完整信息。如果什么都没加载出来，视图里会说明仍然可以按基本信息导入这个角色。

## 导入或下载角色

详情视图里有两个按钮。**Import**(导入) 把角色加入 Marinara 角色库。**Download as PNG**(下载为 PNG) 把角色存成设备上的一个文件，不加入角色库。

把角色卡导入角色库的步骤：

1. 打开某个角色的详情视图。
2. 选择一个 **Imported tags**(导入的标签) 选项，见下面的表格。
3. 点击 **Import**。处理过程中按钮显示 **Importing...**。
4. 等待成功提示。应该会看到一条消息，说明角色已导入。
5. 开始聊天之前，打开 **Characters**(角色) 面板找到刚导入的角色。

导入后的角色和其他角色没有区别。想真正和它聊天，还需要一个可用的服务商连接，见[连接 AI 服务商](../connections/connecting-to-a-provider.md)。

### Imported tags

头像旁边的 **Imported tags** 面板决定哪些标签会跟着角色一起导入，默认是 **All tags**。

| 选项          | 作用                                 |
| ------------- | ------------------------------------ |
| All tags      | 保留来源的标签。                     |
| No tags       | 不保留来源的标签。                   |
| Existing only | 只保留 Marinara 里已经在用的标签。   |

### 内嵌世界书的确认框

角色自带内嵌世界书时，导入过程中浏览器会弹出一个小的确认框，问要不要同时把这个世界书另存为一份独立的 Marinara 世界书。点击 **OK** 会在角色自带的那份副本之外，再建一份独立的世界书。点击 **Cancel** 则只保留角色自带的那份。

### Download as PNG

点击 **Download as PNG** 把角色存成标准的 PNG 角色卡文件。处理过程中按钮显示 **Building PNG...**。所有来源都支持这个操作。保存下来的文件以角色名命名，例如 `Some_Character.png`。这个文件可以分享给别人，也可以以后导入到别的应用里。

JSON 和 PNG 是同一份角色数据的两种常见格式。JSON 是纯文本格式，PNG 角色卡则是一张图片文件，角色数据存在图片内部。两者都包含完整的角色。

## 已导入的角色

右侧边栏的 **Card Browser** 面板会单独列出通过 **Card Browser** 导入的角色。手动创建的角色，或者用别的方式导入的角色，都不会出现在这里，但它们全都能在主 **Characters** 角色库里找到。

- **Download Cards** 按钮会打开完整的 **Card Browser** 视图。
- **Search imported...** 输入框用来过滤这份列表。
- 排序下拉菜单提供 **A-Z**、**Z-A**、**Newest** 和 **Oldest**。
- 右键点击某一行，或者用行内的按钮，可以找到 **Quick Start Roleplay** 和 **Quick Start Conversation**，它们会用这个角色开一段新聊天。也可以在这里把角色从列表中删除。

## 故障排查

**JannyAI 的搜索或详情加载失败，报 Cloudflare 错误。** 有些网站会拦截自动化请求。用同一个浏览器访问一次 jannyai.com，通过它出示的验证，然后回到 Marinara 重新搜索。

**Pygmalion 的登录突然失效了。** 重启 Marinara 服务器会清掉这个登录信息。重新打开 **Log In** 窗口，再粘贴一次 Token。

**CharacterTavern 只显示一条说明。** 这是正常现象。想把它的角色卡作为文件导入，见 [CharacterTavern](#charactertavern)。

**搜索失败，或者某个来源用不了了。** 公开网站随时可能改版或者封锁访问，过一阵再试。某个来源一直失败的话，直接到该网站上打开角色，自己下载角色卡，再走常规的导入流程带进来，见[导入和导出角色卡](import-export.md)。

## 相关指南

- [导入和导出角色卡](import-export.md)
- [连接 AI 服务商](../connections/connecting-to-a-provider.md)
- [Marinara Engine 故障排查](../TROUBLESHOOTING.md)
