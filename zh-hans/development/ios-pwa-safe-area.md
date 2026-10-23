# iOS PWA 底部安全区（开发者）

本指南面向开发者，讲的是屏幕底部有时会冒出来的一条彩色横条。Marinara Engine 以 iPhone 主屏应用的形式运行时就可能出现它。下面介绍 Marinara 内置的解决办法、这个办法必须付出的代价，以及日后某次改动让横条重新出现时该怎么排查。

PWA(渐进式 Web 应用) 指的是安装到主屏、像原生应用一样打开的网站。本文是给贡献者看的代码层面资料，不是面向普通读者的使用指南。

## 问题是什么

带主屏指示条的 iPhone(Face ID 机型) 会在屏幕底部留出一块安全区，供主屏手势使用。iOS 认为这块区域大约 34px 高，正好等于 CSS 变量 `env(safe-area-inset-bottom)` 的值。

PWA 的状态栏样式设成 `black-translucent` 时，iOS 不允许任何 `position: fixed` 元素把内容画进这块区域。所有 CSS 变通写法都无效：负的 bottom 偏移、`calc(100dvh + env(safe-area-inset-bottom))`、负值高度改写，统统会被 WebKit 钳制掉。

结果就是聊天输入框下方露出一条可见的色条。这条色条一般被称为“下巴”，颜色和界面其他部分不一致。

## Marinara 采用的方案

Marinara 把状态栏样式设为 `black`，而不是 `black-translucent`。对应的 meta 标签在 `packages/client/index.html` 里。

```html
<meta name="apple-mobile-web-app-status-bar-style" content="black" />
```

viewport 标签保留 `viewport-fit=cover`，键盘行为也维持默认。

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
```

在 `black` 模式下，iOS 不会锁死底部区域。应用外壳用的是 `fixed inset-0`，没有改写视口高度，所以能一直画到安全区里。`packages/client/src/components/layout/AppShell.tsx` 里外壳的 className 是：

```
mari-app mari-app-background-paint fixed inset-0 flex overflow-hidden
```

不要往 viewport 标签里加 `interactive-widget=resizes-content`。在移动端 PWA 上，键盘弹出的动画过程中它会让整个聊天外壳跟着改变尺寸，消息滚动区域还会被裁掉一块。

## 必须付出的代价

半透明的状态栏和填满的底部只能二选一。`black` 模式下状态栏是一条纯深色的实心条；`black-translucent` 的顶部更好看，是透明的，但底部那条色条就再也去不掉了。这是 iOS 的硬性限制。

<a id="landscape-the-cameras-side-insets"></a>

## 横屏：摄像头一侧的边距

iPhone 横放时，摄像头（刘海或 Dynamic Island）位于左侧或右侧边缘。使用 `viewport-fit=cover` 时，页面会延伸到摄像头下面，iOS 通过 `env(safe-area-inset-left)` 和 `env(safe-area-inset-right)` 报告这部分空间。在 Dynamic Island 机型上，不论手机朝哪边转，两侧都约为 59px。Marinara 的 Android 应用（目标 SDK 34，非边到边布局）会避开摄像头开孔，因此两侧边距均为 0。其他 Android 浏览器在全屏或边到边显示等情况下可能报告非零边距，同样由这些变量处理。

Marinara 避开这部分空间的方式与竖屏时的状态栏色带相同：

- `packages/client/src/styles/globals.css` 只读取一次两侧边距，将其写入 `:root` 上的 `--mari-safe-area-inset-left` 和 `--mari-safe-area-inset-right`。其他地方都读取这些变量，不直接读取 `env()`。`scripts/regressions/mobile-safe-area-inset.regression.ts` 会检查这一规则。弹窗、omnibar、全屏编辑器和 TopBar 控件仍保留针对摄像头与圆角的保护。
- 在 iPhone 上，`AppShell.tsx` 通过 `window.orientation`（不可用时改用 `screen.orientation.angle`）识别摄像头在哪一侧。90° 时摄像头在左侧，−90°/270° 时在右侧。`<html>` 上的 `data-mari-camera-side` 属性让 CSS 只将相反一侧的**外壳**边距 `--mari-shell-inset-left` 或 `--mari-shell-inset-right` 设为零。未知旋转方向、iPad 和 Android 保留系统边距。
- 在手机外壳中，`.mari-app` 从外壳变量取得 `left` 和 `right`。摄像头上方显示 body 的页面背景，颜色与竖屏状态栏色带相同，而不会在另一端出现镜像空白边距。
- 外壳内的固定元素相对屏幕定位，而非相对外壳，因此要自行避让。`AppShell.tsx` 中的手机面板及其背景使用带外壳变量的 `MOBILE_SHELL_PANEL_X_CLASS`。外壳的星星等装饰使用 `absolute`，所以会留在外壳内。

不用手机检查时，打开 874×402 的触控视口，并在样式表的 `:root` 规则中把两个变量都设为 `59px`（内联样式会覆盖摄像头侧选择器）。在 Chromium 中，也可以使用 DevTools Protocol 命令 `Emulation.setSafeAreaInsetsOverride` 模拟真实边距。`e2e/phone-camera-side.e2e.ts` 会检查两个旋转方向、新旧方向 API、未知旋转及其他设备。e2e 测试 “a phone turned sideways keeps the app out from under its camera” 检查保留两侧边距的回退行为。

## 当初是怎么排查出来的

排查思路是给每一层刷上不同的颜色，然后重新打开应用。把诊断用的样式写进 `packages/client/dist/index.html` 内联的 `<style>` 块里。这个文件不会被 service worker 缓存，每次都是最新的，改完下次重开应用就能看到效果，不用清缓存。

```
html, body { background-color: #ff0000 !important; }
.mari-chat-input-box { background-color: #00ff00 !important; }
.mari-app { background: #0000ff !important; }
```

结果这样解读：

- 下巴是红色，说明画在那里的是 html 画布。在 `black-translucent` 模式下，没有任何 fixed 元素能盖住它。
- 下巴是蓝色，说明应用外壳的盒子已经铺到了底部。这是正常状态。
- 下巴是绿色，说明输入框本身一直填充到了屏幕边缘。

## 如果某次更新把它弄坏了

### 症状：输入框下面又出现了下巴色条

检查 1：确认 `packages/client/index.html` 里的 `apple-mobile-web-app-status-bar-style` 仍然是 `black`。如果被改回了 `black-translucent`，改回 `black`。

检查 2：确认 `packages/client/src/components/layout/AppShell.tsx` 里 AppShell 的 className 仍然是 `mari-app mari-app-background-paint fixed inset-0 flex overflow-hidden`。不要把 `inset-0` 和 `h-screen`、`h-dvh` 或 `max-h-screen` 一起用，那会让这个 fixed 外壳受到过多约束，移动端键盘一弹出就会把界面顶来顶去。

检查 3：运行上面的颜色诊断，看清楚下巴那一块究竟是哪一层画出来的。强制退出再重新打开应用即可，不需要清缓存，因为 `dist/index.html` 没有被预缓存。

- 下巴是红色、其他地方是蓝色，说明外壳盒子没铺到底部。确认状态栏样式是不是 `black`。
- 外壳已经是蓝色、下巴却还是红色，说明外壳没盖过去。确认 `fixed inset-0` 有没有被改掉。
- 下巴是蓝色，说明外壳盖住了，但输入框没有向下填满。检查下面讲的输入框外层容器内边距。

### 症状：输入框紧贴着屏幕边缘

三个输入组件的外层容器都要有 `pb-3` 才会有自然的悬浮间距，不能写成 `pb-0`。

- `packages/client/src/components/chat/ChatInput.tsx`：外层容器应为 `mari-chat-input chat-input-container px-3 pb-3`。
- `packages/client/src/components/chat/ConversationInput.tsx`：外层容器应为 `mari-chat-input chat-input-container relative px-2 sm:px-3 pb-3`。
- `packages/client/src/components/game/GameInput.tsx`：外层容器应为 `px-3 pt-2 pb-3`。

## 重新构建

服务器是从 `packages/client/dist` 提供构建好的客户端，所以改了源码就必须重新构建。

```
pnpm build:client
```

构建完在设备上清除站点数据，再重新打开 PWA。在手机上依次打开 **Settings**(设置)、**Safari**、**Advanced**(高级)、**Website Data**(网站数据)。service worker 按内容哈希缓存 JS 和 CSS，哈希变了就得清一次站点数据才能加载新的分块。

`dist/index.html` 不会被 service worker 缓存，每次都是最新的。想快速注入诊断样式又不想完整重新构建时就用它。

## 要点速查

- `black-translucent` 给出透明的状态栏，但会锁死底部安全区，没有任何 CSS 变通办法。
- `black` 或 `default` 给出实心状态栏，同时允许 fixed 元素铺进底部安全区。
- `env(safe-area-inset-bottom)` 在 Face ID 机型的 iPhone 上大约是 34px。需要时用它给可交互内容留出主屏指示条上方的空间。
- 在 `black-translucent` 模式下，`dvh` 和 `lvh` 这两个视口单位等于安全内容区的高度，不是屏幕的物理高度。不要拿它们把外壳撑出这条边界。
- `interactive-widget=resizes-content` 会让 fixed 的聊天外壳在键盘弹出时改变尺寸。还是用默认的视口行为更稳妥。

## 相关指南

- [前端架构（开发者向）](frontend.md)
- [iOS / iPadOS PWA 指南](../installation/ios-pwa.md)
