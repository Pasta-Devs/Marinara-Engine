# 角色卡 CSS 主题指南

角色卡 CSS 让角色卡或用户角色卡在聊天里拥有自己的外观。把 CSS 嵌进卡的 **Creator Notes**(创作者备注)，Marinara 就会把它应用到这个角色的消息上。它只能给聊天设置样式，碰不到应用的其他部分。本指南写给角色卡作者。

## 开始之前

本指南用到的几个说法：

- **CSS** 控制颜色、字体、边框和间距。
- **角色卡 CSS** 是嵌在卡里的 CSS，用来给这张卡的消息做主题。
- **Card Theming**(角色卡主题) 是按聊天开启角色卡 CSS 的控件，位于 **Chat Settings → Characters**(聊天设置 → 角色)（Game 中则是 **Party**(队伍)）。
- **选择器**是 CSS 规则里决定给哪些元素设置样式的部分。两个选择器之间的空格表示“内部”，所以 `.a .b` 匹配的是位于 `.a` 内部的 `.b`。
- **布局**指消息的排布方式。Conversation(对话模式) 有 **Linear**(线性) 行布局和 **Bubbles**(气泡) 两种。

## 快速上手

下面是第 2 步要粘贴的起步代码：

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

先把 CSS 加到卡上，再到聊天里把它开启。

1. 在 Character Editor(角色编辑器) 里打开角色，找到 **Creator Notes**。用户角色在 Persona Editor(用户角色编辑器) 里有同样的字段。
2. 把起步代码粘进 **Creator Notes**，保存角色卡。
3. 打开与这个角色的聊天。
4. 打开 **Chat Settings**，再进入 **Characters**，Game 中则是 **Party**。
5. 在 **Card Theming** 下选择 **Exclusive**(独占) 或 **Chat**(聊天)。它初始为 **Disabled**(禁用)。

角色的消息会立刻变样。

如果没有生效：只有当聊天里的某个活跃角色在 **Creator Notes** 中写了 CSS 时，**Disabled**、**Exclusive** 和 **Chat** 按钮才会出现。光有用户角色的 CSS 不会让它们出现，所以用户角色的主题还需要聊天里有一个带 `<style>` 块的角色。确认你的 `<style>` 块已经保存。在 Roleplay(角色扮演) 聊天里，**Color Character Names in Text**(为正文中的角色名称着色) 位于 **Characters** 中，在 **Add Character**(添加角色) 下方。

在所有布局下，名字都会泛起粉色光晕，正文变成淡粉色。气泡规则会加上紫色渐变和粉色边框。`.mari-message-bubble` 只存在于 **Bubbles** 布局和 Roleplay 里，所以在 Conversation 默认的 **Linear** 布局下，气泡规则不起作用。

想做一次不会看漏的测试，就用下面这条规则。它针对消息正文，任何模式和布局下都存在，会把正文背景变成亮粉色。

```css
[data-card-css] .mari-message-content {
  background: hotpink;
}
```

## Card Theming 的工作方式

当一个在 **Creator Notes** 里写了 CSS 的角色处于活跃状态时，Marinara 会读取每一段 `<style>` 块，剥掉一切危险内容（见[哪些东西不能改](#what-you-cannot-style)），给 CSS 加上作用域，让它只能影响聊天，然后注入这段 CSS，让它的选择器盖过应用自带的消息样式。

具体怎么应用，在每个聊天的 **Chat Settings → Characters** 里选择，Game 中则在 **Party** 里。

| 模式 | 效果 |
| --- | --- |
| **Disabled**(默认) | 关闭角色卡 CSS。 |
| **Exclusive** | 每个角色的 CSS 只影响自己的消息。 |
| **Chat** | 所有角色卡 CSS 影响整个聊天区域，包括界面元素。 |

群聊里每个角色各有外观时，用 **Exclusive**。一对一的卡要给整个聊天界面（例如背景）做主题时，用 **Chat**。

## 作用域规则

Marinara 会改写你的 CSS，让它只能影响聊天。

- 在 **Chat** 模式下，所有规则都限定在聊天区域之下。`[data-card-css]` 表示聊天区域。
- 在 **Exclusive** 模式下，所有规则都限定在这个角色的每个消息元素之下。`[data-card-css]` 表示这个角色的消息。

所以，用 `[data-card-css]` 给消息元素本身设置样式，用普通类选择器处理它内部的东西，比如 `.mari-message-bubble`、`.mari-message-content` 和 `.mari-message-name`。同一个元素上的类名无法作为后代被匹配到。用 `[data-card-css] .mari-message-...` 这种写法来构建，卡在两种模式下都能正常工作。

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

在 **Exclusive** 作用域下，`[data-card-css]` 是角色自己的消息，它同时也是 `.mari-message-assistant`。想连你自己的消息行一起做主题，就改用 **Chat** 作用域。在那里，`[data-card-css] .mari-message-user` 和 `.mari-message-assistant` 分别选中两边。

## 用 @chat-mode 指定模式

把规则包进 `@chat-mode roleplay`、`@chat-mode conversation` 或 `@chat-mode game`，就能只针对某一种界面生效。写在所有块外面的 CSS 到处都生效。标准的 `@media` 查询在这些块内部照常可用。

```html
<style>
  /* Applies in all modes */
  [data-card-css] .mari-message-name {
    color: #00ff95;
  }

  @chat-mode roleplay {
    [data-card-css] .mari-message-bubble {
      border: 1px solid rgba(0, 255, 149, 0.4);
      box-shadow: 0 0 16px rgba(0, 255, 149, 0.25);
    }
  }

  @chat-mode conversation {
    [data-card-css] .mari-message-bubble {
      background: rgba(0, 40, 28, 0.9);
      border-radius: 1rem;
    }
  }
</style>
```

Game Mode(游戏模式) 目前只有基础支持。在 **Chat** 模式下，角色卡 CSS 能作用于整个游戏界面，所以 `[data-card-css]` 会给游戏区域做主题。Game 使用自己的一套布局，没有消息气泡，所以要针对范围更大的目标，比如区域背景。按角色区分（**Exclusive**）的游戏旁白样式还不支持。

## 哪些东西可以改

Roleplay 和 Conversation 用的是同一套骨架。请只用下表里的 `mari-*` 类和 `data-*` 属性。其他类名在版本之间会变。

| 选择器 | 作用对象 |
| --- | --- |
| `[data-card-css]` | 整条消息行（作用域元素）。适合做边缘装饰，在 **Chat** 模式下则是聊天区域。 |
| `[data-card-css] .mari-message-bubble` | 可见的气泡：背景、边框、圆角、阴影。存在于 **Bubbles** 布局和 Roleplay 中。 |
| `[data-card-css] .mari-message-content` | 在 **Bubbles** 下是气泡元素本身。在 **Linear** 下只是消息正文。 |
| `[data-card-css] .mari-message-name` | 角色的显示名。 |
| `[data-card-css] .mari-message-meta` | 装着名字和时间戳的头部行。 |
| `[data-card-css] .mari-message-timestamp` | 时间戳。 |
| `[data-card-css] .mari-message-avatar` | 头像那一列。 |
| `[data-card-css] .mari-message-narrator` | 旁白消息（Roleplay）。 |
| `[data-card-css] .mari-message-user` | 用户消息。角色消息用 `.mari-message-assistant`。 |
| `[data-card-css] p`、`[data-card-css] span` | 正文里的段落和行内 span。 |
| `[data-grouped]` | 同一角色连续发出的后续消息。仅限 Conversation。想选中一组里的第一条，用 `[data-card-css]:not([data-grouped])`。 |

要切换布局，打开 **Settings → Appearance → Conversation**(设置 → 外观 → Conversation)，找到 **Conversation Display**(Conversation 显示)，再找到 **Chat Layout**(聊天布局)。**Linear** 布局没有气泡，所以给 `.mari-message-content`(正文) 和 `[data-card-css]`(消息行) 设置样式。

一个做过样式的气泡：

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

在 Conversation 的 **Linear** 布局中，角色写回复时会显示“(name) is typing...”这一行。

| 选择器 | 作用对象 |
| --- | --- |
| `[data-card-css] .mari-typing-text` | 提示文字。 |
| `[data-card-css] .mari-typing-dots span` | 跳动的点。 |
| `[data-card-css] .mari-typing-indicator` | 整行。它以 `data-typing-name` 的形式携带名字。 |

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

头像默认是圆形。下面的例子针对可点击的头像按钮。不可点击的头像用 `.mari-message-avatar > div`。在 Roleplay 里，按钮外面还包了一层发光容器 `div`。只想要自己的描边，就把这层抹平。

```css
[data-card-css] .mari-message-avatar button {
  border-radius: 6px; /* 0 for sharp corners, 50% for a circle */
  box-shadow: 0 0 0 2px #ff66cc;
}
@chat-mode roleplay {
  [data-card-css] .mari-message-avatar > div {
    box-shadow: none;
  }
}
```

### About Me 个人资料浮层（仅限 Conversation）

在 Conversation 模式下点击头像，会弹出一个展示“about me”的个人资料浮层。角色卡和用户角色都可以给自己的浮层做主题。Roleplay 和 Game 里没有这个浮层，所以如果卡还带其他模式的样式，就把这些规则包进 `@chat-mode conversation`。

浮层卡片就是作用域元素。用 `[data-card-css].mari-about-me-popout`(不加空格，同一个元素) 选中它，它的子元素则用后代选择器。在 **Chat** 模式下，可以直接写 `.mari-about-me-name`。

| 选择器 | 作用对象 |
| --- | --- |
| `[data-card-css].mari-about-me-popout` | 浮层卡片：背景、边框、形状。 |
| `[data-card-css] .mari-about-me-banner` | 顶部的横幅条（默认取名字的颜色）。 |
| `[data-card-css] .mari-about-me-avatar` | 放大后的头像容器。圆形本身用 `... > div`。 |
| `[data-card-css] .mari-about-me-status` | 在线状态圆点（仅角色有）。 |
| `[data-card-css] .mari-about-me-name` | 显示名标题。 |
| `[data-card-css] .mari-about-me-handle` | 第二行的 @name，Convo 显示名不同时才出现。 |
| `[data-card-css] .mari-about-me-presence` | 状态或活动那一行（仅角色有）。 |
| `[data-card-css] .mari-about-me-box` | About Me 的容器方框。 |
| `[data-card-css] .mari-about-me-label` | “ABOUT ME”那行小标题。 |
| `[data-card-css] .mari-about-me-badge` | Default 或 Chat-specific 胶囊标记。 |
| `[data-card-css] .mari-about-me-text` | about-me 正文。 |

```css
@chat-mode conversation {
  [data-card-css].mari-about-me-popout {
    background: radial-gradient(120% 120% at 50% 0%, #241a3a 0%, #14101f 70%);
    border: 1px solid rgba(180, 120, 255, 0.45);
    border-radius: 1.25rem;
  }
  [data-card-css] .mari-about-me-banner {
    background: linear-gradient(90deg, #b478ff, #ff77c6);
  }
  [data-card-css] .mari-about-me-name {
    color: #e9d8ff;
  }
}
```

<a id="what-you-cannot-style"></a>

## 哪些东西不能改

出于安全考虑，净化器会剥掉下面这些内容。

| 被拦截的写法 | 原因 |
| --- | --- |
| `url(https://...)` | 不允许发网络请求，防止追踪和数据泄露。只允许 `url(data:...)`，用于内嵌图片和字体。 |
| 带外部 URL 的 `@font-face` | 只保留 `data:` 形式的字体来源。字体族名会被改名，免得盖掉应用自己的字体。 |
| `@import` | 不允许加载外部样式表。 |
| `:has()` 选择器 | 不能探测聊天之外的元素。 |
| 嵌套规则，以及以 `~` 或 `+` 开头的选择器 | 会被丢弃，这样角色卡 CSS 就无法越出自己的作用范围。请改写成普通选择器。 |
| `content:` 里的 HTML | 装饰性文字可以用，但 `<` 和 `>` 会被剥掉，文字上限 200 个字符。`attr()` 和 `counter()` 允许使用。 |
| `position: fixed` | 会被改写成 `position: absolute`，因此做不出全屏遮罩层。 |
| `!important` | 会被剥掉，所以角色卡 CSS 无法强行盖过应用样式。 |
| 应用主题变量 | 像 `--primary`、`--background` 这类变量会被剥掉，所以角色卡 CSS 无法给应用界面换色。 |

在聊天内部，角色卡 CSS 设置的颜色、背景、边框和字体优先于应用自带的消息样式。它赢不了的是：被净化器剥掉的写法、聊天之外的一切，以及应用用行内样式或 `!important` 设置的样式。**Settings** 里的全局聊天字体颜色和字号就是一例。

要用自定义字体，就用 base64 的 `data:` URI 内嵌它，或者使用系统字体栈。

```css
@font-face {
  font-family: "MyFont";
  src: url(data:font/woff2;base64,d09GMgAB...) format("woff2");
}
```

## 实用建议

1. 给气泡设置样式要用 `.mari-message-bubble`，不要用 `[data-card-css]`。消息行是全宽的，给它加背景基本看不出来。
2. 用 `rgba()` 颜色，这样在浅色和深色主题下都能融进去。
3. 动效克制一点。在性能较弱的设备上，优先用 `transition`，少用重量级的 `animation`。做动画要改 `opacity`，不要改 `box-shadow`，后者每一帧都要重绘。
4. 手机端用 `@media (max-width: 768px)`。
5. 不要依赖工具类。只有文档里写明的 `mari-*` 钩子是稳定的。

## 示例展示：Eldritch Grimoire

这个例子在每种模式下都用到了主要的钩子：泛着光的名字、带主题的衬线正文、加了描边的头像、带角落符文的动态 Roleplay 气泡、Conversation 气泡、诡异的正在输入提示，以及游戏界面。把它粘进 **Creator Notes**，再到 **Chat Settings → Characters** 里选择一种 Card Theming 模式，Game 中则在 **Party** 里选。游戏界面要设为 **Chat**。把颜色、`content` 里的字符和字体换掉，这套主题就成了你自己的。

```html
<style>
  @keyframes grimoire-pulse {
    0%,
    100% {
      opacity: 0.35;
    }
    50% {
      opacity: 1;
    }
  }

  /* All modes */
  [data-card-css] .mari-message-name {
    color: #ff5c8a;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    text-shadow: 0 0 8px rgba(255, 92, 138, 0.7), 0 0 16px rgba(168, 85, 247, 0.45);
  }
  [data-card-css] .mari-message-timestamp {
    color: rgba(243, 215, 255, 0.5);
    font-variant: small-caps;
  }
  [data-card-css] .mari-message-avatar button {
    border-radius: 7px;
    box-shadow: 0 0 0 2px rgba(220, 38, 120, 0.6), 0 0 14px rgba(168, 85, 247, 0.5);
  }
  [data-card-css] .mari-message-content {
    color: #f3d7ff;
    font-family: "Iowan Old Style", Georgia, "Times New Roman", serif;
  }

  @chat-mode roleplay {
    [data-card-css] {
      border-left: 2px solid rgba(220, 38, 120, 0.35);
    }
    [data-card-css] .mari-message-avatar > div {
      box-shadow: none;
    }
    [data-card-css] .mari-message-bubble {
      background: linear-gradient(135deg, #1a0a24 0%, #2d0a2e 55%, #3a0a1e 100%);
      border: 1px solid rgba(220, 38, 120, 0.45);
      border-radius: 4px 16px 16px 16px;
      position: relative;
      overflow: hidden;
      box-shadow: 0 0 16px rgba(190, 70, 190, 0.4);
    }
    /* breathing inner glow: animate a full-bleed overlay's opacity, which is cheap */
    [data-card-css] .mari-message-bubble::after {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      box-shadow: inset 0 0 26px rgba(120, 0, 80, 0.65);
      animation: grimoire-pulse 4s ease-in-out infinite;
    }
    [data-card-css] .mari-message-bubble::before {
      content: "✦";
      position: absolute;
      top: 1px;
      right: 7px;
      font-size: 0.7rem;
      color: rgba(220, 38, 120, 0.55);
    }
    [data-card-css] .mari-message-narrator {
      color: #c9a8ff;
      font-style: italic;
    }
  }

  @chat-mode conversation {
    [data-card-css]:not([data-grouped]) {
      border-left: 2px solid rgba(220, 38, 120, 0.35);
    }
    [data-card-css] .mari-message-bubble {
      background: rgba(26, 10, 36, 0.92);
      border: 1px solid rgba(220, 38, 120, 0.4);
      border-radius: 1rem;
    }
    [data-card-css] .mari-typing-text {
      color: #ff5c8a;
      font-style: italic;
    }
    [data-card-css] .mari-typing-dots span {
      background: #ff5c8a;
    }
    [data-card-css].mari-about-me-popout {
      background: radial-gradient(120% 120% at 50% 0%, #241a3a 0%, #12081c 72%);
      border: 1px solid rgba(220, 38, 120, 0.45);
      border-radius: 1.25rem;
    }
    [data-card-css] .mari-about-me-banner {
      background: linear-gradient(90deg, #a855f7, #dc2678);
    }
    [data-card-css] .mari-about-me-name {
      color: #ffd7ef;
    }
  }

  /* Game: in Chat scope, [data-card-css] is the whole game surface */
  @chat-mode game {
    [data-card-css] {
      background-image: radial-gradient(120% 80% at 50% 0%, rgba(58, 10, 46, 0.5), transparent 70%);
    }
  }
</style>
```

## 让 AI 助手帮你写角色卡 CSS

不想手写 CSS 的话，把下面这段提示词交给 AI 助手，在标注的位置填上你的角色设定。

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
