# 自定义 CSS 主题（Theme Library）

自定义 CSS 主题会给整个 Marinara 重新上色。在 **Theme Library**(主题库) 里可以创建、导入、导出和切换主题。本指南还会列出主题可用的 CSS 变量和类名，并说明主题和 Card CSS(角色卡 CSS) 之间是什么关系。不写 CSS 也想快速换个样子，见[现成的聊天窗口样式](#ready-made-chat-window-styles)。

开始之前：如果从另一台设备（比如手机）打开 Marinara，服务器需要先设置管理员密钥，你才能创建、编辑、导入、启用或删除主题。在运行服务器的那台电脑上不需要密钥。

1. 在服务器上，于 `.env` 文件中设置 `ADMIN_SECRET`。
2. 在应用里打开 **Settings → Advanced → Admin Access**(设置 → 高级 → 管理员访问)，填入同一个值。

见[服务器配置参考](../CONFIGURATION.md)和[远程访问指南](../REMOTE_ACCESS.md)。要切换到别人给你的主题，直接看[启用主题](#activating-a-theme)。

## 什么是自定义主题

CSS 全称 Cascading Style Sheets(层叠样式表)，是决定配色、边框和间距的代码。主题就是一段 CSS，可以改页面背景、强调色、卡片、边框、文字等等。

主题存放在 Marinara 服务器上的 **Theme Library** 里，因此会同步到连接同一台服务器的每台设备。其他大多数外观设置只留在本机。同一时间只能启用一个主题，主题想存多少个都可以。

## 在哪里找到 Theme Library

1. 打开 **Settings**(设置)。
2. 打开 **Addons**(附加组件) 选项卡。
3. 找到 **Theme Library** 区块。

## 创建主题

1. 在 **Theme Library** 区块里点击 **Create Theme**(创建主题)。
2. 在名称输入框里填一个名字（框里显示“Theme name...”）。
3. 在大文本框里写入或粘贴 CSS。
4. 保持 **Preview**(预览) 开启，就能边写边看到实时效果。关闭它就停止实时预览。
5. 点击 **Save**(保存)。

新建的主题会带一个模板，模板把常用变量以注释形式列了出来。去掉注释符号，再填上自己的值。全新的主题保存后就会启用，并显示：Theme "My Theme" saved and activated.

之后想改主题，在 **Installed Themes**(已安装主题) 里找到它，点击代码图标（提示文字 **Edit theme CSS**），改完点击 **Save**。编辑不会改变当前启用的是哪个主题。

## 导入和导出主题

导入主题的步骤：

1. 在 **Theme Library** 区块里点击 **Import File**(导入文件)。
2. 选择一个 `.css` 或 `.json` 文件。
3. 看一下提示消息，上面会写明成功导入、跳过和失败的主题各有多少个。

一个 `.css` 文件会变成一个主题，名字取自文件名。一个 `.json` 文件可以装一个或多个主题。从 Marinara 导出的文件直接原样导入，也可以自己手写一个小文件：

```json
{ "name": "My Theme", "css": "..." }
```

导入的主题不会自动启用。如果服务器上已有一个同名、CSS 也完全相同的主题，导入时会跳过它。

导出主题时，在 **Installed Themes** 里点击该主题那一行的上传图标（提示文字 **Export theme**）。Marinara 会下载一个 `.json` 文件，可以拿到别处导入。

<a id="activating-a-theme"></a>

## 启用主题

**Installed Themes** 会列出所有主题，顶部还有一项 **Default Theme**(默认主题)。

1. 点击某个主题的名字即可启用，当前启用的主题带一个对勾。
2. 点击 **Default Theme** 就关闭自定义主题，回到自带的外观。

**Reset Appearance**(重置外观) 位于 **App Style**(应用样式) 顶部（在 **Settings → Appearance**(设置 → 外观) 里），它同样会关闭当前启用的主题。

要删除主题，点击垃圾桶图标（提示文字 **Remove theme**），然后在 **Delete Theme**(删除主题) 窗口里确认。这会把它的 CSS 从服务器上永久删除。

如果没有成功：界面显示不正常时，把当前启用的主题和聊天里的 Card CSS 都查一查。见[主题与 Card CSS](#themes-and-card-css)。

<a id="ready-made-chat-window-styles"></a>

## 现成的聊天窗口样式

开始之前：这不需要写 CSS。

1. 打开 **Settings → Appearance → App**(设置 → 外观 → 应用)。
2. 在 **App Style** 底部找到 **Chat widget style**(聊天组件样式)。
3. 选一个样式。

| 样式 | 外观 |
| --- | --- |
| **Default**(默认) | 原本的外观。 |
| **Dottore** | 冰蓝色的仪器边框、浅金属色边缘和切角。 |
| **Prof. Mari** | 镶金边的故事书式边框与宝石蓝，窗口标题带原石装饰。按钮与窗口使用相同背景。 |

每个样式都有自己的字体，适应浅色和深色模式，并同时改变按钮、窗口和可展开区域的样式。选择样式会重置 **Font**(字体)、**Shape**(形状) 和三种颜色。窗口位置保持不变。

以下几项可以单独更改：

- **Font** 和 **Shape** 会跟随样式（**Preset font**(预设字体)、**Preset shape**(预设形状)），直到你另选其他字体或形状。
- **Border & Buttons Color**(边框与按钮颜色) 改变边框和按钮图标。图标使用渐变的第一个颜色。
- **Background Color**(背景色) 填充按钮、窗口、可展开区域和可编辑字段的背景。
- **Text Color**(文字颜色) 改变组件文字。标题和标签可以显示渐变，可编辑字段则使用第一个颜色。

每种颜色都有一个用于纯色的颜色选择器，以及一个渐变选项。控件旁的 **Reset color**(重置颜色) 会让它重新跟随样式的浅色或深色配色。装饰徽记保持原有颜色。

### 把样式延伸到聊天中

颜色选择器下方的三个开关可以把样式延伸到更多地方。每个开关初始都是关闭的，且独立生效。关闭某个开关，就会恢复聊天对应部分原本的样式；选择其他样式不会改变开关状态。

| 开关 | 应用的内容 |
| --- | --- |
| **Apply preset font**(应用预设字体) | 组件字体，用于消息、输入框和聊天控件。 |
| **Apply preset shape**(应用预设形状) | 边框形状，用于 Roleplay(角色扮演) 消息（经典布局和视觉小说布局）、Game 对话框、输入框和控件。Conversation 消息保留自己的形状。 |
| **Apply preset colors**(应用预设颜色) | 这些区域的边框、背景和文字颜色，也包括 Conversation 消息。自定义颜色和渐变同样适用。引号内的对白仍保留每个角色或用户角色自己的 Dialogue Highlight Color。由 HTML 构成的消息，例如智能体生成的样式卡片，会保留它自己设置的文字颜色。 |

历史按钮（**Load More**(加载更多)、**Show older**(显示更早内容)）和其他聊天控件一样遵循这些开关。在 Game Mode(游戏模式) 中，这些开关还作用于补充发言、HUD 组件、地图面板、人物卡、日志、物品栏、战斗面板和弹窗。也可以让 Professor Mari 为这些区域创建自定义主题。

自定义主题仍可覆盖这些样式。下面的窗口和抽屉变量优先于样式自带的颜色。用 `--mari-window-font-family` 设置窗口字体，`--mari-drawer-radius` 设置区域圆角，`--mari-window-ornament: none` 隐藏标题装饰。想去掉所有样式装饰，先选择 **Default**。

<a id="themes-and-card-css"></a>

## 主题与 Card CSS

Marinara 有两种添加自定义 CSS 的方式，两者可以同时生效。

- 自定义主题作用于整个应用。它可以覆盖 Marinara 的核心变量，可以用 `!important`，也可以用 `position: fixed`。
- Card CSS 嵌在角色卡或用户角色卡里，按聊天单独开启。它的清理严格得多：不能覆盖核心变量，`!important` 会被剥掉，`position: fixed` 会被改成 `position: absolute`。它只作用于聊天消息，不作用于整个应用。详见[角色卡 CSS 主题指南](card-css-theming.md)。

## 大小和名称限制

主题名最长 200 个字符。CSS 最大 256 KiB，按 UTF-8 字节计算。超过这个大小的主题在保存或导入时会被拒绝。自定义主题的 CSS 在生效前还会先经过清理：从其他网站加载文件的样式不会生效。图片或字体请改为嵌成 `data:` URI。

## CSS 变量参考

主题编辑器里有一个可折叠的 **CSS Variable Reference**(CSS 变量参考)，点开就能看到最常用的可覆盖变量。主题正是通过在 `:root` 块里设置这些变量来改变应用外观的。参考里列出的变量如下：

| 变量 | 控制的内容 |
| --- | --- |
| `--background` | 页面背景 |
| `--foreground` | 正文文字 |
| `--primary` | 强调色和按钮 |
| `--primary-foreground` | 强调色上的文字 |
| `--secondary` | 卡片和输入框 |
| `--card` | 卡片背景 |
| `--border` | 边框 |
| `--muted-foreground` | 淡化的文字 |
| `--sidebar` | 侧边栏背景 |
| `--sidebar-border` | 侧边栏边框 |
| `--marinara-shell-edge-border` | 左右两侧的外框边缘 |
| `--destructive` | 报错和删除 |
| `--popover` | 下拉菜单背景 |
| `--accent` | 悬停高亮 |

Marinara 用到的任何 CSS 变量，主题都可以设置，不限于这些。有些效果有专属变量。比如 `--marinara-theme-accent-pulse: enabled` 会请求强调色脉冲动画。

## 设置聊天窗口和抽屉的样式

电脑上的 **Chat Settings**(聊天设置) 是可移动窗口，其中的可折叠区域叫 **drawers**(抽屉)。抽屉可以弹出为独立窗口，再最小化为可移动的小按钮，叫作 **bubble**(气泡)。

其他聊天工具也使用这些窗口和按钮，包括 Game controls、Session、Volume、Game Assets、连接的聊天和资源包控件。手机上，大多数窗口会显示为全宽面板；Echo Chamber 保持为可以移动和调整大小的小窗口。从 Chat Settings 移出的工具会汇总到可移动的三点 **Chat tools**(聊天工具) 菜单中，追踪器按钮仍单独显示。

下面的类名、数据属性和变量可以统一设置这些部分的外观。主题规则无需 `!important` 就能覆盖默认样式。

### 类名

| 部分 | 类名 |
| --- | --- |
| 窗口 | `.mari-window` |
| 标题栏 | `.mari-window__header` |
| 标题及其图标 | `.mari-window__title-row` |
| 标题 | `.mari-window__title` |
| 标题栏按钮（Reset View、收藏布局星标、Tracker Panel、固定、锁定、关闭、Put back） | `.mari-window__controls`(每个按钮是 `.mari-window__control`) |
| 窗口内容 | `.mari-window__body` |
| 调整大小的边缘和角落 | `.mari-window__resize-handle` |
| 鼠标或焦点位于窗口内时显示的角标 | `.mari-window__resize-grip` |
| 抽屉 | `.mari-drawer` |
| 抽屉标题栏和标题 | `.mari-drawer__header`, `.mari-drawer__title` |
| 抽屉图标、数量徽标和 **?** | `.mari-drawer__icon`, `.mari-drawer__count`, `.mari-drawer__help` |
| 收起的抽屉预览（追踪器的小组件） | `.mari-drawer__summary` |
| 抽屉箭头旁的按钮和弹出按钮 | `.mari-drawer__actions`, `.mari-drawer__popout` |
| 抽屉箭头和内容 | `.mari-drawer__arrow`, `.mari-drawer__body` |
| 抽屉向外拖动时跟随鼠标的预览 | `.mari-drawer-ghost` |
| 最小化窗口的按钮（气泡） | `.mari-window-bubble` |
| 气泡代替图标显示的实时摘要（World State 的横幅） | `.mari-window-bubble__banner` |
| 拖动气泡与另一个气泡对齐时出现的线 | `.mari-window-snap-guide` |
| 智能体运行时的小圆点（Chat Settings 按钮、Trackers 窗口） | `.mari-agents-running-dot` |

### 数据属性

- `data-window` 标识窗口及其气泡：`chat-settings`、`trackers`，控制窗口 `control:game`、`control:session`、`control:volume`、`control:assets`、`control:connected-chat`、`control:package:<package>` 和 `control:beholder:<package>`，以及弹出抽屉的 `drawer:<window>:<drawer>`，比如 `drawer:chat-settings:chat-name`。
- `data-drawer` 标识抽屉，比如 `chat-name`。有些名称以聊天模式开头，比如 `roleplay-agents` 或 `conversation-agents`。追踪器使用 `tracker-world`、`tracker-persona`、`tracker-characters`、`tracker-quests`、`tracker-inventory`、`tracker-custom` 和 `agent-activity`。
- `data-presentation` 在电脑窗口上是 `"window"`，在手机面板上是 `"sheet"`。
- 窗口固定或锁定时，`data-pinned` 和 `data-locked` 为 `"true"`。
- `data-window-control` 标识每个标题栏按钮：`"pin"`、`"lock"`、`"close"` 或 `"put-back"`。处于按下状态的固定或锁定按钮还带有 `aria-pressed="true"`。
- `data-chat-settings-control` 标识 Chat Settings 的额外标题栏按钮：`"reset-view"`、`"favorite-layout"` 和 `"tracker-panel"`。当前布局与收藏一致时，星标带有 `aria-pressed="true"`，图标会填满。
- 每个调整手柄的 `data-edge` 为 `"n"`、`"s"`、`"e"`、`"w"`、`"ne"`、`"nw"`、`"se"` 或 `"sw"`。
- 已展开抽屉在 `.mari-drawer__header` 内的开关按钮带有 `aria-expanded="true"`。
- `data-drawer-control="pop-out"` 标记抽屉的弹出按钮。
- `data-outside="true"` 标记已经拖到足够远、松手后就会弹出窗口的预览。
- 竖直对齐辅助线的 `data-axis` 为 `"x"`，水平辅助线为 `"y"`。
- 抽屉在独立窗口中显示时，窗口和内部抽屉的 `data-detached` 都为 `"true"`。弹出窗口用 `data-window="drawer:<window>:<drawer>"` 命名，比如 `data-window="drawer:chat-settings:chat-name"`，`data-drawer-host` 则标识它原来的窗口。
- 拖动抽屉标题时，抽屉的 `data-dragging` 为 `"true"`；把弹出抽屉悬停在可放回的窗口上时，那个窗口的 `data-drop-target` 为 `"true"`。
- 气泡带有其窗口的 `data-window` 和 `data-minimized="true"`，比如 `.mari-window-bubble[data-window="control:volume"]`。控制窗口名称为 `control:game`、`control:session`、`control:volume`、`control:assets`、`control:connected-chat`、`control:package:<package>` 和 `control:beholder:<package>`。拖动气泡时，它的 `data-dragging` 为 `"true"`。显示实时摘要而不是图标的气泡（比如最小化的 World State 追踪器）带有 `data-banner="true"`，并会随摘要内容变宽。
- 锁定的气泡带有 `data-locked="true"`，Chat Settings 按钮也一样。它仍能打开窗口，但在窗口解锁前不能移动。用 `.mari-window-bubble[data-locked="true"]` 可以为这类按钮设置不同外观。
- 手机上的窗口及其稍大的气泡都带有 `data-presentation="sheet"`。Tracker Panel 的气泡是 `.mari-window-bubble[data-tracker-panel-toggle="bubble"]`。
- Chat Settings 按钮也是气泡：`.mari-window-bubble[data-chat-settings-button]`，Chat Settings 打开时带有 `data-open="true"`。
- 弹出区域缩成气泡后带有 `data-drawer-host`(原来的窗口)，其窗口上的 **Put back** 按钮是 `[data-window-control="put-back"]`。

### 变量

没有设置的变量会沿用聊天控件的共享颜色，因此主题只需定义想改变的变量。

| 变量 | 控制内容 |
| --- | --- |
| `--mari-window-bg` | 窗口背景 |
| `--mari-window-text` | 窗口文字 |
| `--mari-window-border`, `--mari-window-border-width` | 窗口边框 |
| `--mari-window-radius` | 窗口圆角 |
| `--mari-window-shadow` | 窗口阴影 |
| `--mari-window-backdrop-filter` | 窗口背后的模糊 |
| `--mari-window-header-bg`, `--mari-window-header-text`, `--mari-window-header-border` | 标题栏颜色 |
| `--mari-window-header-padding` | 标题栏间距 |
| `--mari-window-control-color`, `--mari-window-control-color-hover`, `--mari-window-control-bg-hover` | 标题栏按钮，包括收藏星标 |
| `--mari-window-control-color-active`, `--mari-window-control-bg-active` | 按下的标题栏按钮，包括固定、锁定和填满的收藏星标 |
| `--mari-window-control-radius`, `--mari-window-control-gap` | 按钮圆角和间距 |
| `--mari-window-focus-ring` | 键盘焦点边框，以及抽屉准备放回的窗口边框 |
| `--mari-window-resize-handle-size` | 调整大小边缘的宽度 |
| `--mari-window-bubble-size`, `--mari-window-bubble-radius`, `--mari-window-bubble-shadow` | 气泡大小、圆角和阴影 |
| `--mari-window-bubble-bg`, `--mari-window-bubble-bg-hover`, `--mari-window-bubble-border` | 气泡背景和边框 |
| `--mari-window-bubble-text`, `--mari-window-bubble-text-hover` | 气泡图标颜色 |
| `--mari-window-snap-guide` | 对齐辅助线颜色 |
| `--mari-drawer-bg`, `--mari-drawer-border` | 抽屉背景和分隔线 |
| `--mari-drawer-header-bg`, `--mari-drawer-header-bg-hover` | 抽屉标题栏颜色 |
| `--mari-drawer-header-padding`, `--mari-drawer-body-padding-inline`, `--mari-drawer-body-padding-bottom` | 抽屉间距 |
| `--mari-drawer-title-color`, `--mari-drawer-icon-color`, `--mari-drawer-arrow-color` | 抽屉标题栏文字和图标 |
| `--mari-drawer-count-bg`, `--mari-drawer-count-text` | 抽屉数量徽标 |

把变量设在 `:root` 上会改变所有窗口，设在选择器上则只改变对应窗口：

```css
:root {
  --mari-window-radius: 0.5rem;
  --mari-window-bubble-bg: #3b0764;
}

[data-window="chat-settings"] .mari-drawer[data-drawer="chat-name"] {
  --mari-drawer-border: transparent;
}
```

<a id="styling-messages-input-boxes-and-chat-controls"></a>

## 为消息、输入框和聊天控件设置样式

三个 **Apply preset** 开关也能让自定义主题把组件设计应用到聊天的其他区域。主题可以用以下变量覆盖各部分的样式。如果不想自己写 CSS，可以让 Professor Mari 创建一套风格一致的聊天主题。

| 部分 | 类名 |
| --- | --- |
| Roleplay 和 Game 的消息框、Game 补充发言、HUD 组件、地图面板、人物卡以及聊天输入框 | `.mari-chat-style-surface` |
| Game 日志、物品栏、战斗面板、选项和弹窗；这些面板还带有 `data-game-section`，值为面板名称，例如 `logs`、`inventory` 或 `combat-actions` | `.mari-game-section.mari-chat-style-surface` |
| 窗口中的 Game 内容，例如 Journal(日志)，会跟随窗口的颜色 | `.mari-game-section` |
| Conversation 消息（仅字体和颜色） | `.mari-chat-style-conversation` |
| 无边框的 Conversation 消息文字 | `.mari-chat-style-text` |
| 聊天控件，包括 Calls 和 Conversation 群聊控件 | `.mari-chat-style-control` |
| 历史按钮：**Load More**、**Show older**、**Show newer**(显示更新内容)、**Latest**(最新)，以及 Game 日志的 **Older**(更早)、**All**(全部) 和 **Show more older logs**(显示更多早期记录)。它们同时也带有 `.mari-chat-style-control` | `.mari-chat-history-pager` |
| 由 HTML 构成的消息，例如智能体生成的样式卡片。开启 **Apply preset colors** 时，会保留它内部设置的文字颜色 | `.mari-html-content` |

| 变量 | 控制内容 |
| --- | --- |
| `--mari-chat-font-family` | 对应聊天区域的字体 |
| `--mari-chat-bg` | 框体背景，可使用纯色或渐变 |
| `--mari-chat-text` | 清晰易读的纯色文字颜色 |
| `--mari-chat-border` | 框体轮廓，可使用纯色或渐变 |
| `--mari-chat-border-color` | 纯色边框的备用值 |
| `--mari-chat-radius` | 框体圆角，不包括 Conversation 消息 |
| `--mari-chat-control-bg`, `--mari-chat-control-bg-hover` | 聊天按钮背景 |
| `--mari-chat-control-color`, `--mari-chat-control-radius` | 聊天按钮图标颜色与圆角 |
| `--mari-chat-input-bg` | 可编辑字段内部的背景 |

例如，开启 **Apply preset font** 和 **Apply preset colors** 后：

```css
:root {
  --mari-chat-font-family: Georgia, serif;
  --mari-chat-bg: #251e29;
  --mari-chat-text: #f4e8dc;
  --mari-chat-border: linear-gradient(100deg, #d6aa66, #dda0b2);
}
```

未设置的变量沿用组件设置和预设。要让这些变量通过内置样式生效，必须开启对应的开关。即使开启 **Apply preset shape**，Conversation 消息仍保留自己的形状。自定义主题也能直接选取这些类；做装饰性裁剪时，不要裁掉焦点轮廓、菜单或消息内容。

手机上，三点菜单会展开成圆形按钮。开关按钮为 `[data-chat-tools-menu-button]`，展开的按钮列为 `[data-chat-tools-menu]`，每个列表项的 `data-chat-tools-menu-item` 都设为对应窗口的 ID。工具按钮使用 `.mari-window-bubble.mari-chat-tools-button`，`data-chat-tools-menu-tool` 也设为同一个 ID。按钮列没有窗口边框；按钮保持圆形，并沿用组件颜色和按钮大小，不受聊天其他区域的三个开关影响。

## 相关指南

- [角色卡 CSS 主题指南](card-css-theming.md)
- [外观设置](appearance-settings.md)
- [服务器配置参考](../CONFIGURATION.md)
- [远程访问：登录与 IP 允许列表](../REMOTE_ACCESS.md)
