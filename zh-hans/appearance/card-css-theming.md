# 角色卡 CSS 主题指南

这篇指南写给角色和用户角色的作者，教你如何让一张卡在聊天里拥有自己的外观。做法是把 CSS 写进角色卡的 Creator Notes(创作者备注) 里，Marinara Engine 会安全地把它应用到这个角色的消息上。它的作用范围只有聊天，碰不到应用的其他部分。

## 开始之前

先明确几个贯穿全文的说法：

- **CSS** 是控制网页颜色、字体、边框和间距的语言。
- **角色卡 CSS** 指的是嵌在角色卡或用户角色卡里的 CSS，用来给这张卡的消息做主题。
- **Card Theming**(角色卡主题) 是界面上的那个控件，负责为某个聊天开启角色卡 CSS。
- **选择器**是 CSS 规则里决定“给哪些元素设置样式”的部分。
- **后代选择器**用空格表示“内部”。`.a .b` 匹配的是位于 `.a` 内部的 `.b`。
- **层叠**是 CSS 用来决定多条规则同时命中一个元素时谁生效的机制。
- **布局**指消息在屏幕上的排布方式。Marinara 提供 **Linear**(线性) 行布局和 **Bubbles**(气泡) 布局两种。

## 快速上手

给一张卡做主题要在两个地方操作。先把 CSS 加到卡上，再到聊天里把它开启。

1. 在 Character Editor(角色编辑器) 里打开角色，找到 **Creator Notes** 输入框。用户角色在 Persona Editor(用户角色编辑器) 里有同样的输入框。
2. 把一段 `<style>` 粘贴进 **Creator Notes**，保存角色卡。
3. 打开与这个角色的聊天。
4. 打开 **Chat Settings**(聊天设置)，找到 **Card Theming** 一节。
5. 选择 **Exclusive** 或 **Chat**。这个模式初始为 **Disabled**。

角色的消息应该立刻变样。只有当聊天里的某个活跃角色在 **Creator Notes** 中写了 CSS 时，**Card Theming** 的模式按钮（Disabled、Exclusive、Chat）才会出现。Roleplay 聊天中始终显示该区域，因为它还包含 **Color Character Names in Text**(为正文中的角色名称着色)开关。光有用户角色的 CSS 不足以让按钮出现，聊天里至少要有一个角色自带 `<style>` 块。如果看不到这些按钮，先确认 `<style>` 块确实保存成功了。

下面是一段可以直接粘进 **Creator Notes** 的起步代码：

```html
<style>
  /* the visible message bubble (Bubbles layout, and roleplay) */
  [data-card-css] .mari-message-bubble {
    background: linear-gradient(135deg, #2a1240, #3a1030);
    border: 1px solid #ff66cc;
    border-radius: 14px;
  }
  /* the name and the text (works in every message style) */
  [data-card-css] .mari-message-name {
    color: #ff8fd4;
    text-shadow: 0 0 8px rgba(255, 102, 204, 0.6);
  }
  [data-card-css] .mari-message-content {
    color: #ffd6f0;
  }
</style>
```

在所有布局下，角色名都会泛起粉色光晕，正文变成淡粉色。气泡那条规则会加上紫色渐变和粉色边框。有一点要注意：`.mari-message-bubble` 只存在于 **Bubbles** 布局和 Roleplay 里。Conversation 默认使用 **Linear** 布局，那里没有气泡元素，所以气泡规则不起作用。下文“Bubbles 与 Linear 的区别”会讲清楚两者的差异。

**验证是否生效：** 想做一次绝对可靠的测试，就用下面这条规则。它针对的是消息正文，任何模式和布局下都存在。正文背景应该立刻变成亮粉色。

```css
[data-card-css] .mari-message-content {
  background: hotpink;
}
```

## Card Theming 的工作方式

当一个在 **Creator Notes** 里写了 CSS 的角色处于活跃状态时，Marinara 会做四件事：

1. 读取 **Creator Notes** 里的每一段 `<style>`。
2. 对 CSS 做净化处理，剥掉一切危险内容。详见下文“哪些东西不能改”。
3. 给 CSS 加上作用域限制，让它只能影响聊天。
4. 注入这段 CSS，让加过作用域的选择器盖过应用自带的消息样式。

具体怎么应用，由每个聊天各自在 **Chat Settings** 的 **Card Theming** 里决定，共有三种模式。

| 模式 | 效果 |
| --- | --- |
| **Disabled**(默认) | 关闭角色卡 CSS，不应用任何角色样式。 |
| **Exclusive** | 每个角色的 CSS 只影响自己的消息。 |
| **Chat** | 所有角色卡 CSS 影响整个聊天区域，界面元素也包括在内。 |

群聊里每个角色各有各的外观时用 **Exclusive**。单角色聊天里想让卡给整个聊天界面做主题时用 **Chat**。

## 唯一需要记住的作用域规则

Marinara 会改写你的 CSS，让它只能影响聊天。改写方式取决于模式。

- **Chat** 模式把所有规则限定在聊天区域之下。`.mari-message-bubble` 正常匹配，因为它就在这个区域里面。
- **Exclusive** 模式把所有规则限定在这个角色自己的消息元素之下，这些元素带有 `data-card-css`。同一个元素上的类名无法作为后代被匹配到，只有它内部的东西才能匹配。

于是就有了这条通用写法：用 `[data-card-css]` 给消息元素本身设置样式，用普通类选择器处理它内部的一切，比如 `.mari-message-bubble`、`.mari-message-content` 和 `.mari-message-name`。

`[data-card-css]` 在 **Exclusive** 模式下表示“这个角色的消息”，在 **Chat** 模式下表示“聊天区域”，两边都能用。带空格的内部元素选择器在两种模式下行为一致。

```css
[data-card-css] {
  /* the message row itself, good for a left accent border */
  border-left: 3px solid #ff66cc;
}
[data-card-css] .mari-message-bubble {
  /* the visible bubble inside it */
  border-radius: 14px;
}
```

## 用 @chat-mode 指定模式

把规则包进 `@chat-mode` 块里，就能只针对某一种界面生效。写在所有块外面的 CSS 到处都生效。

```html
<style>
  /* Applies in ALL modes */
  [data-card-css] .mari-message-name {
    color: #00ff95;
  }

  /* Only in Roleplay mode */
  @chat-mode roleplay {
    [data-card-css] .mari-message-bubble {
      border: 1px solid rgba(0, 255, 149, 0.4);
      box-shadow: 0 0 16px rgba(0, 255, 149, 0.25);
    }
  }

  /* Only in Conversation mode */
  @chat-mode conversation {
    [data-card-css] .mari-message-bubble {
      background: rgba(0, 40, 28, 0.9);
      border-radius: 1rem;
    }
  }
</style>
```

标准的 `@media` 查询在 `@chat-mode` 块内部照常可用，用它来做响应式布局。

**Game Mode** 目前只有基础支持。在 **Chat** 模式下，角色卡 CSS 能作用于整个游戏界面，`[data-card-css]` 会给游戏区域做主题，`@chat-mode game` 用来指定它。Game 使用自己的一套布局，上面那些消息气泡钩子在这里并不存在，所以要针对范围更大的目标，比如区域背景。按角色区分的 Exclusive 叙事文本样式还不支持。

## 哪些东西可以改

Roleplay 和 Conversation 的聊天结构是同一套骨架。下面这些元素就是角色卡 CSS 可以选中的对象。内部的工具类不是稳定的钩子，版本之间会变，所以请只用下表里的 `mari-*` 类和 `data-*` 属性。

| 选择器 | 作用对象 |
| --- | --- |
| `[data-card-css]` | 整条消息行（作用域元素）。适合做左侧或边缘装饰，在 **Chat** 模式下则是聊天区域。 |
| `[data-card-css] .mari-message-bubble` | 可见的气泡：背景、边框、圆角、阴影。存在于 **Bubbles** 布局和 Roleplay 中。 |
| `[data-card-css] .mari-message-content` | 在 **Bubbles** 下是气泡元素本身，包括背景、边框和圆角。在 **Linear** 下只是消息正文。 |
| `[data-card-css] .mari-message-name` | 角色的显示名。 |
| `[data-card-css] .mari-message-meta` | 装着名字和时间戳的头部行。 |
| `[data-card-css] .mari-message-timestamp` | 时间戳。 |
| `[data-card-css] .mari-message-avatar` | 头像那一列。 |
| `[data-card-css] .mari-message-narrator` | 旁白消息（Roleplay）。 |
| `[data-card-css] .mari-message-user` | 用户消息。角色消息用 `.mari-message-assistant`。 |
| `[data-card-css] p`、`... span` | 正文里的段落和行内 span。 |
| `[data-grouped]` | 同一角色连续发出的后续消息。仅限 Conversation 模式，Roleplay 的消息行永远不带它。想选中一组里的第一条，用 `[data-card-css]:not([data-grouped])`。 |

**Bubbles 与 Linear 的区别。** `.mari-message-bubble` 针对的是 **Bubbles** 布局。**Linear** 布局没有气泡元素，改用 `.mari-message-content`(正文) 和 `[data-card-css]`(消息行)。切换布局的位置是 **Settings**(设置) → **Appearance**(外观) → **Conversation Display**(Conversation 显示) 一节 → **Chat Layout**(聊天布局)。Roleplay 始终带气泡。

下面是一个做过主题的 Conversation 或 Roleplay 气泡：

```css
[data-card-css] .mari-message-bubble {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border: 1px solid rgba(100, 149, 237, 0.35);
  border-radius: 1rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
}
[data-card-css] .mari-message-name {
  color: #6495ed;
  text-shadow: 0 0 8px rgba(100, 149, 237, 0.5);
}
[data-card-css] .mari-message-content {
  font-family: Georgia, serif;
}
```

### 正在输入提示

角色正在写回复时，Conversation 的 **Linear** 布局会显示一行“(name) is typing...”这一行也可以设置样式。

| 选择器 | 作用对象 |
| --- | --- |
| `[data-card-css] .mari-typing-text` | “(name) is typing...”这段文字。 |
| `[data-card-css] .mari-typing-dots span` | 那几个跳动的点。 |
| `[data-card-css] .mari-typing-indicator` | 整行本身。它还会以 `data-typing-name` 的形式携带角色名。 |

```css
[data-card-css] .mari-typing-text {
  color: #ff66cc;
  font-style: italic;
}
[data-card-css] .mari-typing-dots span {
  background: #ff66cc;
}
```

### 头像

头像默认是圆形，用纯 CSS 就能改形状、加描边。下面的例子针对的是可点击的头像按钮。如果某个界面把头像渲染成不可点击的，就在那个布局下对 `.mari-message-avatar > div` 这个后备元素套用同样的思路。Roleplay 里按钮外面还包了一层发光容器 `div`，只想要自己的描边就把这层抹平。

```css
[data-card-css] .mari-message-avatar button {
  border-radius: 6px; /* 0 for sharp corners, 50% for a circle */
  box-shadow: 0 0 0 2px #ff66cc;
}
/* roleplay only: drop the app glow wrapper so just your ring shows */
@chat-mode roleplay {
  [data-card-css] .mari-message-avatar > div {
    box-shadow: none;
  }
}
```

### About Me 个人资料浮层（仅限 Conversation）

在 Conversation 模式下点击头像，会弹出一个展示角色或用户角色“about me”的个人资料浮层。用同一套 `[data-card-css]` 作用域就能给它做主题。这个浮层只存在于 Conversation 模式，Roleplay 和 Game 里没有。如果这张卡同时还带 Roleplay 或 Game 的 CSS，记得把这些规则包进 `@chat-mode conversation`。角色卡和用户角色都可以从各自的 **Creator Notes** 里给自己的浮层做主题。

用户角色有一点要注意：只有当聊天里的某个活跃角色在 **Creator Notes** 中写了 CSS 时，**Card Theming** 的模式按钮才会出现。只有用户角色的 CSS 是不够的。所以想让用户角色的浮层主题生效，聊天里至少还要有一个角色也带着 `<style>` 块。

| 选择器 | 作用对象 |
| --- | --- |
| `[data-card-css].mari-about-me-popout` | 浮层卡片本身（作用域元素）：背景、边框、形状。 |
| `[data-card-css] .mari-about-me-banner` | 顶部的横幅条（默认取名字的颜色）。 |
| `[data-card-css] .mari-about-me-avatar` | 放大后的头像容器。圆形本身用 `... > div`。 |
| `[data-card-css] .mari-about-me-status` | 在线状态圆点（仅角色有）。 |
| `[data-card-css] .mari-about-me-name` | 显示名标题。 |
| `[data-card-css] .mari-about-me-handle` | 第二行的 @name(Convo 显示名不同时才出现)。 |
| `[data-card-css] .mari-about-me-presence` | 状态或活动那一行（仅角色有）。 |
| `[data-card-css] .mari-about-me-box` | About Me 的容器方框。 |
| `[data-card-css] .mari-about-me-label` | “ABOUT ME”那行小标题。 |
| `[data-card-css] .mari-about-me-badge` | Default 或 Chat-specific 胶囊标记。 |
| `[data-card-css] .mari-about-me-text` | 渲染出来的 about-me 正文。 |

浮层卡片就是作用域元素，要用 `[data-card-css].mari-about-me-popout` 选中它（不加空格，同一个元素）。它的子元素用后代选择器，比如 `[data-card-css] .mari-about-me-name`。在 **Chat** 模式下整个区域都在作用域内，可以直接写 `.mari-about-me-name`。

下面是一个做过主题的“about me”浮层。把它粘进角色或用户角色的 **Creator Notes**，再到 **Chat Settings** 里启用 **Card Theming**。如果粘的是用户角色，别忘了上面那条注意事项：聊天里必须还有一个角色的 **Creator Notes** 里也有 CSS，否则模式按钮不会出现。

```html
<style>
@chat-mode conversation {
  [data-card-css].mari-about-me-popout {
    background: radial-gradient(120% 120% at 50% 0%, #241a3a 0%, #14101f 70%);
    border: 1px solid rgba(180, 120, 255, 0.45);
    border-radius: 1.25rem;
  }
  [data-card-css] .mari-about-me-banner {
    background: linear-gradient(90deg, #b478ff, #ff77c6);
  }
  [data-card-css] .mari-about-me-avatar > div {
    border-radius: 0.9rem; /* squircle avatar */
    box-shadow: 0 0 0 2px #b478ff;
  }
  [data-card-css] .mari-about-me-name {
    color: #e9d8ff;
    text-shadow: 0 0 10px rgba(180, 120, 255, 0.6);
  }
  [data-card-css] .mari-about-me-box {
    background: rgba(180, 120, 255, 0.08);
    border: 1px solid rgba(180, 120, 255, 0.25);
    border-radius: 0.75rem;
  }
  [data-card-css] .mari-about-me-label {
    color: #b478ff;
    letter-spacing: 0.12em;
  }
  [data-card-css] .mari-about-me-text {
    font-family: Georgia, serif;
    color: #f2e9ff;
  }
}
</style>
```

## 哪些东西不能改

出于安全考虑，净化器会剥掉下面这些内容。

| 被拦截的写法 | 原因 |
| --- | --- |
| `url(https://...)` | 不允许发网络请求，防止追踪和数据泄露。只允许 `url(data:...)`，用于内嵌图片和字体。 |
| 带外部 URL 的 `@font-face` | 只保留 `data:` 形式的字体来源。字体族名会被自动改名，免得盖掉应用自己的字体。 |
| `@import` | 不允许加载外部样式表。 |
| `:has()` 选择器 | 不能探测聊天之外的元素。 |
| 嵌套规则，以及以 `~` 或 `+` 开头的选择器 | 会被丢弃，这样角色卡 CSS 就无法越出自己的作用范围。请改写成普通选择器。 |
| `content:` 里的 HTML | 装饰性文字可以用，但 `<` 和 `>` 会被剥掉，文字上限 200 个字符。`attr()` 和 `counter()` 允许使用。 |
| `position: fixed` | 会被改写成 `position: absolute`，因此做不出全屏遮罩层。 |
| `!important` | 会被剥掉，所以角色卡 CSS 无法强行盖过应用样式。 |
| 应用主题变量 | 像 `--primary`、`--background` 这类变量会被剥掉，所以角色卡 CSS 无法给应用界面换色。 |

角色卡 CSS 注入时带的选择器优先级高于应用自带的消息样式，因此在聊天内部，颜色、背景、边框和字体都由它说了算。它赢不了的只有三类：被净化器剥掉的写法、聊天之外的一切，以及应用用行内样式或 `!important` 设置的样式。**Settings** 里的全局聊天字体颜色和字号就属于最后这一类。

**自定义字体。** 用 base64 的 `data:` URI 内嵌字体，或者使用系统字体和 web-safe 字体栈。

```css
@font-face {
  font-family: "MyFont";
  src: url(data:font/woff2;base64,d09GMgAB...) format("woff2");
}
```

```css
font-family: "Courier New", Consolas, monospace;
```

## Exclusive 与 Chat 的区别：作用域怎么选

- **Exclusive** 让 `[data-card-css]` 表示这个角色的消息，最适合群聊和按角色区分外观的场景。针对消息内部元素的 CSS 与 **Chat** 模式下表现一致。
- **Chat** 让 `[data-card-css]` 表示整个聊天区域，最适合一对一的卡，尤其是想给背景或整体氛围做主题、而不只是改气泡的时候。

只要用 `[data-card-css] .mari-message-...` 这种写法来构建，一张卡在两种模式下都能正常工作。

## 实用建议

1. 给气泡设置样式要用 `.mari-message-bubble`，不要用 `[data-card-css]`。后者是整行的全宽区域，给它加背景基本看不出来。
2. 用 `rgba()` 颜色，这样在浅色和深色主题下都能融得进去。
3. 动效克制一点。在性能较弱的设备上，`transition` 比重量级的 `animation` 更合适。
4. 手机端用 `@media (max-width: 768px)`。
5. 不要依赖工具类。只有文档里写明的 `mari-*` 钩子是稳定的。

## 示例展示：Eldritch Grimoire

这是一张刻意做得很夸张的卡，把文档里记载的每一个钩子、每一种模式都用到了。它演示了：

- 泛着光的符文大写角色名，以及配套的衬线正文
- 改过形状并加了描边的头像，还有小型大写的时间戳
- 消息行边缘的印记
- 带角落符文的动态 Roleplay 气泡，以及做过样式的旁白
- Conversation 气泡和一个诡异的正在输入提示
- 点头像弹出的个人资料浮层，全套主题
- 游戏界面

把它整段粘进 **Creator Notes**，再到 **Chat Settings** 里启用 **Card Theming**。它会给 Roleplay 和 Conversation 的消息、Conversation 的浮层以及 Game 的界面做主题（Game 需要把模式设为 **Chat**）。各部分按 `@chat-mode` 拆开，每种模式只拿到它真正有的钩子。所有写法都能通过净化器。

```html
<style>
  /* shared keyframe. Animate OPACITY, never box-shadow: box-shadow is a "paint"
     property, so animating it repaints and re-blurs the whole element every frame
     (which pins weak GPUs). Animating a layer's opacity is GPU-composited and cheap. */
  @keyframes grimoire-pulse {
    0%,
    100% {
      opacity: 0.35;
    }
    50% {
      opacity: 1;
    }
  }

  /* EVERYWHERE (all modes). */
  /* These descendant hooks only match where message rows exist, so they are inert
     in Game and safe to leave unwrapped. */

  /* the character name, glowing crimson rune-caps */
  [data-card-css] .mari-message-name {
    color: #ff5c8a;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-size: 0.82rem;
    text-shadow: 0 0 8px rgba(255, 92, 138, 0.7), 0 0 16px rgba(168, 85, 247, 0.45);
  }
  /* header row and timestamp */
  [data-card-css] .mari-message-meta {
    align-items: baseline;
  }
  [data-card-css] .mari-message-timestamp {
    color: rgba(243, 215, 255, 0.5);
    font-variant: small-caps;
  }
  /* reshape, ring, and saturate the clickable avatar. For a non-clickable avatar,
     target .mari-message-avatar > div for that layout. */
  [data-card-css] .mari-message-avatar button {
    border-radius: 7px;
    box-shadow: 0 0 0 2px rgba(220, 38, 120, 0.6), 0 0 14px rgba(168, 85, 247, 0.5);
    filter: saturate(1.2) contrast(1.05);
  }
  /* glowing serif message text */
  [data-card-css] .mari-message-content {
    color: #f3d7ff;
    text-shadow: 0 0 2px rgba(168, 85, 247, 0.4);
    font-family: "Iowan Old Style", Georgia, "Times New Roman", serif;
  }

  /* ROLEPLAY */
  @chat-mode roleplay {
    /* the row itself, an arcane left edge. (data-grouped does not exist in
       roleplay, so there is no first-of-run trick here.) */
    [data-card-css] {
      border-left: 2px solid rgba(220, 38, 120, 0.35);
    }
    /* roleplay wraps the avatar button in its own glow layer. Flatten it
       so only the eldritch ring above hugs the picture. */
    [data-card-css] .mari-message-avatar > div {
      box-shadow: none;
    }
    /* the visible bubble and a corner sigil */
    [data-card-css] .mari-message-bubble {
      background: linear-gradient(135deg, #1a0a24 0%, #2d0a2e 55%, #3a0a1e 100%);
      border: 1px solid rgba(220, 38, 120, 0.45);
      border-radius: 4px 16px 16px 16px;
      position: relative;
      overflow: hidden;
      /* a steady outer halo. An element's own box-shadow is not clipped by its own
         overflow: hidden, so this bloom shows even though message content is clipped.
         (No inset here: the pulsing inset glow lives on the ::after, so a static inset
         would stack with it and over-brighten the inner glow.) */
      box-shadow: 0 0 16px rgba(190, 70, 190, 0.4);
    }
    /* the breathing inner glow. Animate a full-bleed overlay's OPACITY (cheap, GPU
       composited) instead of the bubble's box-shadow (expensive: a full repaint every
       frame). overflow: hidden clips a child's OUTER shadow, so the pulse rides the inset
       glow while the halo above stays steady. pointer-events keeps it click-through. */
    [data-card-css] .mari-message-bubble::after {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      box-shadow: inset 0 0 26px rgba(120, 0, 80, 0.65);
      animation: grimoire-pulse 4s ease-in-out infinite;
      will-change: opacity;
    }
    [data-card-css] .mari-message-bubble::before {
      content: "✦";
      position: absolute;
      top: 1px;
      right: 7px;
      font-size: 0.7rem;
      color: rgba(220, 38, 120, 0.55);
      text-shadow: 0 0 6px rgba(220, 38, 120, 0.9);
    }
    /* narration */
    [data-card-css] .mari-message-narrator {
      color: #c9a8ff;
      font-style: italic;
      opacity: 0.9;
    }
  }

  /* CONVERSATION */
  @chat-mode conversation {
    /* an arcane left edge on the first message of a run. [data-grouped] marks
       continuations from the same character, and it exists only in
       Conversation mode. */
    [data-card-css]:not([data-grouped]) {
      border-left: 2px solid rgba(220, 38, 120, 0.35);
    }
    [data-card-css][data-grouped] {
      border-left: 2px solid transparent;
    }
    /* the Bubbles-layout bubble. In the Linear layout there is no bubble, so
       the EVERYWHERE row hooks above carry the theme instead. */
    [data-card-css] .mari-message-bubble {
      background: rgba(26, 10, 36, 0.92);
      border: 1px solid rgba(220, 38, 120, 0.4);
      border-radius: 1rem;
    }
    /* "(name) is typing..." (Linear layout) */
    [data-card-css] .mari-typing-text {
      color: #ff5c8a;
      font-style: italic;
      letter-spacing: 0.05em;
      text-shadow: 0 0 8px rgba(255, 92, 138, 0.6);
    }
    [data-card-css] .mari-typing-dots span {
      background: #ff5c8a;
      box-shadow: 0 0 6px rgba(255, 92, 138, 0.85);
    }

    /* the avatar-click profile popout. The popout card is the scope element,
       so target it with no space, and its children as descendants. */
    [data-card-css].mari-about-me-popout {
      background: radial-gradient(120% 120% at 50% 0%, #241a3a 0%, #12081c 72%);
      border: 1px solid rgba(220, 38, 120, 0.45);
      border-radius: 1.25rem;
    }
    [data-card-css] .mari-about-me-banner {
      background: linear-gradient(90deg, #a855f7, #dc2678);
    }
    [data-card-css] .mari-about-me-avatar > div {
      border-radius: 0.9rem;
      box-shadow: 0 0 0 2px #dc2678, 0 0 14px rgba(168, 85, 247, 0.5);
    }
    [data-card-css] .mari-about-me-status {
      box-shadow: 0 0 8px rgba(255, 92, 138, 0.9);
    }
    [data-card-css] .mari-about-me-name {
      color: #ffd7ef;
      text-shadow: 0 0 10px rgba(220, 38, 120, 0.6);
    }
    [data-card-css] .mari-about-me-handle {
      color: rgba(201, 168, 255, 0.8);
    }
    [data-card-css] .mari-about-me-presence {
      color: rgba(201, 168, 255, 0.7);
    }
    [data-card-css] .mari-about-me-box {
      background: rgba(168, 85, 247, 0.08);
      border: 1px solid rgba(220, 38, 120, 0.3);
      border-radius: 0.75rem;
    }
    [data-card-css] .mari-about-me-label {
      color: #dc2678;
      letter-spacing: 0.14em;
    }
    [data-card-css] .mari-about-me-badge {
      background: rgba(220, 38, 120, 0.18);
      color: #ffd7ef;
    }
    [data-card-css] .mari-about-me-text {
      color: #f3d7ff;
      font-family: "Iowan Old Style", Georgia, serif;
    }
  }

  /* GAME (set the mode to Chat) */
  @chat-mode game {
    /* Game has its own layout with no message bubbles. In Chat scope,
       [data-card-css] is the whole game surface, so theme the area broadly. */
    [data-card-css] {
      background-image: radial-gradient(120% 80% at 50% 0%, rgba(58, 10, 46, 0.5), transparent 70%);
    }
  }
</style>
```

**用户消息行与角色消息行的区别。** 在 **Exclusive** 作用域下，`[data-card-css]` 指的是角色自己的消息，同时它也是 `.mari-message-assistant`。想连自己的消息行一起做主题，就改用 **Chat** 作用域。那里 `[data-card-css]` 是整个区域，`[data-card-css] .mari-message-user` 和 `.mari-message-assistant` 分别选中两边。

把颜色、`content` 里的字符和字体换掉，这套主题就成了你自己的。

## 让 AI 工具帮你写角色卡 CSS

不想手写 CSS 的话，把下面这段提示词（也就是发给 AI 的那段文字）交给 AI 工具，在标注的位置填上自己的角色设定即可。

```text
I'm creating a character card for Marinara Engine (an AI chat app). The card has a
"Creator Notes" field where I can embed <style> blocks. Write CSS that themes the
character's messages.

Character concept: [describe the aesthetic]

Technical constraints:
- Use [data-card-css] for the message row (works in both Exclusive and Chat modes);
  use normal class selectors for things inside it.
- [data-card-css] .mari-message-bubble = the visible bubble (background / border /
  corners / shadow); [data-card-css] .mari-message-content = the text;
  [data-card-css] .mari-message-name = the display name;
  [data-card-css] .mari-message-avatar button = the clickable avatar
  (non-clickable fallback: .mari-message-avatar > div; in roleplay the button sits
  under an extra glow-wrapper div).
- Style the typing indicator via [data-card-css] .mari-typing-text and
  [data-card-css] .mari-typing-dots span.
- Conversation only: the avatar-click "about me" popout is themable via
  [data-card-css].mari-about-me-popout (the card), the banner via
  .mari-about-me-banner, the avatar via .mari-about-me-avatar > div, the name via
  .mari-about-me-name, the box via .mari-about-me-box, and the body via
  .mari-about-me-text. Wrap these in @chat-mode conversation { ... }.
- Wrap roleplay-only CSS in @chat-mode roleplay { ... }, conversation-only in
  @chat-mode conversation { ... }; CSS outside applies everywhere.
- Blocked: url(https://...), @import, :has(), !important, app theme tokens
  (--primary, etc.). position: fixed becomes absolute. Use url(data:...) and
  rgba() colors.
- [data-grouped] marks continuation messages, in Conversation mode ONLY
  (roleplay rows never carry it); there, use
  [data-card-css]:not([data-grouped]) for first-in-group.

Output a single <style> block I can paste into Creator Notes.
```

## 相关指南

- [外观设置](appearance-settings.md)
- [自定义 CSS 主题（Theme Library）](custom-css-themes.md)
- [创建和编辑角色](../characters/creating-and-editing-characters.md)
