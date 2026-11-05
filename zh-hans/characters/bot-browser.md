# Card Browser：查找并导入角色

**Card Browser**(角色卡浏览器) 可以在公开网站上查找角色卡，并在 Marinara 里直接把它们导入角色库，不用手动下载再上传文件。旧版本里它叫 **Bot Browser** 或 **Browser**。

角色卡是一个文件，里面存着一个角色的名字、性格、开场白和其他细节。在默认设置下，浏览和导入都不需要账号，也不需要 API 密钥。

## 打开 Card Browser

1. 点击顶部导航栏里的 **Characters**(角色) 或 **Personas**(用户角色)。如果看不到它们，先打开 **More**(更多)。
2. 点击顶部的 **Download**(下载) 按钮。它的悬停提示写着 **Download character cards**(下载角色卡)。

Card Browser 会占满整个内容区，标题是 **Browse character cards online**(在线浏览角色卡)。想离开，点击左上角的返回箭头。

关掉再打开，上次的搜索、筛选条件和选中的角色都还在。重新加载应用会把它们清空。

## 选择来源

点击标题栏里的来源按钮。菜单按这个顺序列出：**ChubAI**、**JannyAI**、**CharacterTavern**、**Pygmalion**、**Wyvern**、**DataCat**、**PlotLight** 和 **PlotLight Personas**(PlotLight 用户角色)。第一次默认选中 **ChubAI**。切换来源会清空搜索词、标签和筛选条件。每个来源的成人内容设置和登录状态各自独立。

| 来源 | 成人内容（NSFW） |
| --- | --- |
| **ChubAI** | **NSFW** 复选框直接生效。默认关闭。 |
| **JannyAI** | **NSFW** 复选框直接生效。默认关闭。 |
| **Pygmalion** | [登录](#log-in-to-pygmalion)之前是灰的。登录之后跟随你的 Pygmalion 账号设置。 |
| **Wyvern** | 始终是灰的。改选 **🔞 Popular NSFW** 排序。 |
| **DataCat** | 每张卡都带成人标记，所以复选框被锁定为开启。 |
| **PlotLight** 和 **PlotLight Personas** | 始终是灰的。PlotLight 有自己的规则。带成人标记的结果会显示 **NSFW** 角标。 |

不知道从哪里开始？就用第一个来源 **ChubAI**。每个来源都有自己的初始排序，可以在排序下拉菜单里更改。

成人角色卡的缩略图上有一个红色的 **NSFW** 小角标。菜单里写的是 **ChubAI**，但角色卡的站外链接写的是 **View on Chub**，这是那个网站自己的名字。

### DataCat

第一次选择 **DataCat** 时，会弹出一个标题为 **DataCat is NSFW only** 的对话框。点击 **Continue to DataCat** 继续浏览，或点击 **Don't continue to DataCat** 返回。它的 **Fresh** 排序只有在没有标签筛选、也没有搜索词时才会显示最新结果。

### CharacterTavern

CharacterTavern 重建了网站，不再提供 Marinara 原先使用的连接。选择它时，结果区域会换成一段说明。如果 CharacterTavern 日后开放 API 访问，浏览功能可能会恢复。在那之前，手动导入它的角色卡：

1. 点击说明里的 **Open CharacterTavern**(打开 CharacterTavern)。网站会在新选项卡里打开。
2. 从 character-tavern.com 下载角色卡文件。
3. 点击说明里的 **Import Character**(导入角色)，选择这个文件。参见[导入和导出角色卡](import-export.md)。

之前从它导入的角色仍然留在角色库里。

### PlotLight

PlotLight 分享公开的角色和用户角色。**PlotLight** 列出角色卡。**PlotLight Personas** 列出用户角色，也就是在聊天里代表你的那些角色。不需要 PlotLight 账号。详情视图里有一个 **View on PlotLight** 链接，指向原始页面。

Marinara 会下载 PlotLight 提供的文件。角色卡通常是一个 PNG，里面带着角色的肖像，以及作者允许附带的世界书。用户角色是一个文本文件，Marinara 会另外复制它的图片。两种都可以导入为角色，也可以导入为用户角色。

PlotLight 会限制应用向它发请求的速度。太快的话，Marinara 会提示 **PlotLight is busy** 和一个秒数，并等待这么久。搜索和导入的限制分开计算。

有些角色卡无法下载，比如作者不允许时。这时 Marinara 会提示 **PlotLight doesn't offer this for download.** 这一张无法导入，也看不到详情，但它的图片、作者和 **View on PlotLight** 链接仍会保留。

## 搜索、排序与翻页

在 **Search characters**(搜索角色) 里输入内容，不用按 <kbd>Enter</kbd>。停止输入片刻后，Marinara 就会搜索；清空输入框或改动筛选条件时也会重新搜索。每个来源都有自己的排序下拉菜单。点击 **Refresh**(刷新) 按钮（圆形箭头）可以再搜索一次。

结果下方是 **Previous**(上一页) 和 **Next**(下一页)，以及形如 **Page 2** 的页码。来源报不出总数时，只显示当前页。**PlotLight** 从不报告总数，所以标题栏显示 **Browsing PlotLight**。PlotLight 的某一页可能只有几张卡，甚至一张都没有，但后面仍可能还有更多页。**Next** 会保持可用，可以继续往下翻。

## 按标签筛选

1. 点击工具栏里的 **Tags**(标签)。
2. 在 **Search tags**(搜索标签) 里输入内容，缩小列表。
3. 点击标签旁边的绿色对勾把它加进筛选，或者点击红色减号排除它。同一个标签不能两者都选。
4. 点击某个小标移除那个标签，或者点击 **Clear**(清除) 全部移除。

大多数来源的列表是根据最近几次搜索出来的角色生成的。第一次搜索之前，面板上写着 **Tags will appear after searching**。想要的标签没列出来时，直接输入它的名字，会出现两个按钮：一个把它加为筛选，一个屏蔽它。**DataCat** 会直接加载最热门的标签，其他标签仍然可以手动输入。在 **PlotLight** 上，Marinara 会在 PlotLight 自己的列表里查找你输入的标签，PlotLight 没有的标签什么也匹配不到。

## 更多筛选项

大多数来源多一个 **Filters**(筛选) 按钮，上面的角标显示生效的筛选项数量。**DataCat** 和 **PlotLight** 上没有这个按钮。面板里可能有：

- 内容复选框，例如 **Lorebook** 或 **Alt Greetings**，只保留带这项内容的角色。世界书是角色随身携带的一组额外背景信息。
- **Sort Direction**(排序方向)，可选 **Descending**(降序) 或 **Ascending**(升序)，只在 **ChubAI** 和 **Pygmalion** 上提供。
- **Min Tokens** 和 **Max Output Tokens** 输入框，按体量限制结果。留空则使用来源的默认值。
- **JannyAI** 上的 **Show Low Quality** 开关。它默认关闭，会隐藏 JannyAI 标记为低质量的角色卡。

在 **Wyvern** 上，**Lorebook** 和 **Alt Greetings** 复选框以及 Token 输入框都会显示，但不会改变结果。改用排序下拉菜单和标签。

## 查看角色

点击一条结果，打开它的详情视图。**Back to results**(返回结果) 回到列表。

详情视图显示头像、名字、作者、一句简短的介绍语、最多二十个标签小标，以及一个指向原始页面的 **View on** 链接。再往下是来源提供的完整信息，标题包括 **Creator's Notes**、**Personality**、**Scenario**、**First Message** 和 **Alternate Greetings**。角色卡带有世界书时，会显示一个琥珀色的 **Has embedded lorebook** 角标。如果来源没有返回任何详情，视图里会说明仍然可以按基本信息导入。

## 导入角色

开始之前：要和这个角色聊天，需要一个可用的文本连接。参见[连接 AI 服务商](../connections/connecting-to-a-provider.md)。

1. 打开一个角色的详情视图。
2. 在头像旁边选择一个 **Imported tags**(导入的标签) 选项。默认是 **All tags**(全部标签)。参见[导入选项](import-export.md#import-options)。
3. 点击 **Import**(导入)。**Import Card**(导入角色卡) 窗口会打开，并询问 **Where should this card live?**
4. 可以勾选 **Split description into fields**(把描述拆分到各字段)。参见[导入选项](import-export.md#import-options)。
5. 点击 **Import as Character**(导入为角色) 把它加入 **Characters**，或者点击 **Import as Persona**(导入为用户角色) 把它加入 **Personas**。
6. 如果角色卡内嵌了世界书，**Embedded lorebook found**(发现内嵌世界书) 面板会显示它有多少条目。点击 **Import Lorebook**(导入世界书) 另外创建一本独立的世界书，或者点击 **No Import**(不导入) 只把它留在角色卡里。**Back**(返回) 回到第 5 步。
7. 按钮显示 **Importing...** 时稍等。随后会出现一条消息：`Imported "Name" successfully!`
8. 打开 **Characters** 或 **Personas** 找到它。

如果没有成功：看看提示消息里的错误信息。对 **JannyAI** 来说，最常见的原因是 Cloudflare 拦截（见下面的故障排查）。

### Download as PNG

在详情视图里点击 **Download as PNG**(下载为 PNG)，就能把角色卡存成设备上的一张标准 PNG 角色卡，而不加入角色库。处理过程中按钮显示 **Building PNG...**。所有来源都支持，文件以角色名命名，例如 `Some_Character.png`。PNG 角色卡是一张把角色数据存在内部的图片。你可以分享它，也可以把它导入其他应用。

## 故障排查

| 问题 | 解决办法 |
| --- | --- |
| **JannyAI** 的搜索或详情失败，错误信息提到 Cloudflare(一种会拦截自动请求的安全检查)，或者角色卡的完整定义被拦截。 | 用同一个浏览器访问一次 jannyai.com，通过它出示的验证，然后重新搜索。如果角色卡仍被拦截，到 JannyAI 上打开它，下载它的 PNG，再导入这个文件。 |
| 我的 Pygmalion 登录失效了。 | 重启服务器会清掉登录。用一个新的 Token 重新登录。 |
| **CharacterTavern** 只显示一段说明。 | 这是正常的。参见 [CharacterTavern](#charactertavern)。 |
| **PlotLight is busy.** | 等消息里写的秒数过去，再重试。 |
| **PlotLight doesn't offer this for download.** | 可能是作者不允许下载，也可能这张卡已经不再公开。用 **View on PlotLight** 查看一下。 |
| 搜索失败，或者某个来源用不了了。 | 公开网站随时可能改版或封锁访问。过一阵再试，或者从网站上下载角色卡，走常规的导入流程。参见[导入和导出角色卡](import-export.md)。 |

<a id="log-in-to-pygmalion"></a>

## 登录 Pygmalion

Pygmalion 把成人内容藏在登录之后。公开角色不需要登录。Marinara 从不索要你的密码，你粘贴的是从自己账号里复制出来的一段值。

1. 点击工具栏里的 **Log In**(登录)。**Pygmalion Authentication** 窗口会打开。
2. 在浏览器里打开 pygmalion.chat 并登录。
3. 打开浏览器的开发者工具，这是浏览器内置的一个面板，面向进阶用户。大多数电脑浏览器按 <kbd>F12</kbd> 即可。手机浏览器通常没有它，所以这一步请用电脑完成。
4. 打开 **Application** 选项卡，再打开 **Local Storage**。
5. 找到名为 `authn` 的条目，复制它的值。
6. 把它粘贴到 Marinara 的 **Auth Token** 里。输入框会隐藏粘贴的内容。
7. 点击 **Save & Connect**。会出现一条消息，说明 NSFW 内容已启用。

窗口里有一段帮助说明，重复了这些步骤，还有一个指向 pygmalion.chat 的 **Website** 链接。

Marinara 会先向 Pygmalion 核实这个 Token。如果 Pygmalion 不接受，就什么都不会保存，并会有一条消息说明原因。如果之后 Pygmalion 不再接受它，Marinara 会自动把你登出，并请你重新登录。

登录信息只保存在服务器的内存里，绝不会写进文件，所以重启 Marinara 服务器就会把你登出。想自己退出，重新打开这个窗口并点击 **Log Out**(退出登录)。要彻底退出，还要在 pygmalion.chat 上也退出登录。

## 相关指南

- [导入和导出角色卡](import-export.md)
- [连接 AI 服务商](../connections/connecting-to-a-provider.md)
- [故障排查](../TROUBLESHOOTING.md)
