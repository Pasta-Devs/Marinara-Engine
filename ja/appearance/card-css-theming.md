# カードCSSテーマ設定ガイド

カードCSSを使うと、キャラクターカードやペルソナカードに、チャット内での独自の見た目を持たせられます。カードの**Creator Notes**(作成者メモ)にCSSを埋め込むと、Marinaraがそれをそのキャラクターのメッセージに適用します。スタイルを当てられるのはチャットだけで、アプリのほかの部分には当てられません。このガイドは、カードを作る人向けです。

## 始める前に

このガイドで使う用語は次のとおりです。

- **CSS**は、色、フォント、枠線、余白を制御します。
- **カードCSS**は、カードに埋め込むCSSです。そのカードのメッセージにテーマを適用します。
- **Card Theming**(カードテーマ)は、カードCSSをオンにするチャットごとのコントロールです。**Chat Settings → Characters**(チャット設定 → キャラクター)にあります(Gameでは**Party**(パーティー))。
- **セレクター**は、CSSルールのうち、どの要素にスタイルを当てるかを選ぶ部分です。2つのセレクターの間の空白は「内側にある」ことを表すので、`.a .b`は`.a`の内側にある`.b`に一致します。
- **レイアウト**は、メッセージの並べ方です。Conversationには、行形式の**Linear**と**Bubbles**があります。

## クイックスタート

手順2で貼り付ける、出発点のブロックです。

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

まずカードにCSSを追加し、次にチャットでオンにします。

1. Character Editor(キャラクターエディター)でキャラクターを開き、**Creator Notes**を探します。ペルソナにも、Persona Editor(ペルソナエディター)に同じ欄があります。
2. 出発点のブロックを**Creator Notes**に貼り付け、カードを保存します。
3. そのキャラクターとのチャットを開きます。
4. **Chat Settings**(チャット設定)を開き、**Characters**を開きます(Gameでは**Party**)。
5. **Card Theming**の下で**Exclusive**か**Chat**を選びます。初期状態は**Disabled**です。

キャラクターのメッセージがすぐに変わります。

うまくいかなかった場合: **Disabled**、**Exclusive**、**Chat**のボタンが現れるのは、チャットで有効なキャラクターの**Creator Notes**にCSSが入っているときだけです。ペルソナのCSSだけではボタンは現れません。そのため、ペルソナのテーマを効かせるにも、チャット内の1人のキャラクターが`<style>`ブロックを持っている必要があります。`<style>`ブロックが保存されているか確かめてください。Roleplayのチャットでは、**Color Character Names in Text**(本文中のキャラクター名に色を付ける)は**Characters**内の**Add Character**(キャラクターを追加)の下にあります。

どのレイアウトでも、名前がピンクに光り、本文が淡いピンクになります。バブルのルールは、紫のグラデーションとピンクの枠線を加えます。`.mari-message-bubble`は**Bubbles**レイアウトとroleplayにしか存在しないため、Conversationのデフォルトの**Linear**レイアウトでは、バブルのルールは何も起こしません。

見逃しようのないテストには、次のルールを使います。対象はどのモードとレイアウトにも存在するメッセージ本文で、その背景を鮮やかなピンクにします。

```css
[data-card-css] .mari-message-content {
  background: hotpink;
}
```

## Card Themingの仕組み

**Creator Notes**にCSSを持つキャラクターが有効なとき、Marinaraはすべての`<style>`ブロックを読み込み、危険な記述を取り除き([スタイルを当てられないもの](#what-you-cannot-style)を参照)、CSSがチャットにしか届かないようにスコープを付け、そのセレクターがアプリ自身のメッセージスタイルを上書きするように挿入します。

適用のしかたは、チャットごとに**Chat Settings → Characters**(チャット設定 → キャラクター)で選びます(Gameでは**Party**)。

| モード | 動作 |
| --- | --- |
| **Disabled**(デフォルト) | カードCSSはオフです。 |
| **Exclusive** | 各キャラクターのCSSは、そのキャラクター自身のメッセージにだけ影響します。 |
| **Chat** | すべてのカードCSSが、UI要素を含むチャット領域全体に影響します。 |

キャラクターごとに見た目を持たせるグループチャットでは**Exclusive**を使います。背景など、チャット画面全体にテーマを適用する1対1のカードには**Chat**を使います。

## スコープの規則

MarinaraはCSSを書き換えて、チャットにしか届かないようにします。

- **Chat**モードでは、すべてがチャット領域の下にスコープされます。`[data-card-css]`はチャット領域を指します。
- **Exclusive**モードでは、すべてがキャラクターの各メッセージ要素の下にスコープされます。`[data-card-css]`はこのキャラクターのメッセージを指します。

そのため、メッセージ要素そのものには`[data-card-css]`を使い、その内側にあるものには`.mari-message-bubble`、`.mari-message-content`、`.mari-message-name`のような通常のクラスセレクターを使います。同じ要素に付いたクラスは、子孫としては一致しません。`[data-card-css] .mari-message-...`で組み立てれば、カードはどちらのモードでも動きます。

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

**Exclusive**スコープでは、`[data-card-css]`はキャラクター自身のメッセージで、これは`.mari-message-assistant`でもあります。自分の行にもテーマを適用するには、**Chat**スコープを使います。そこでは`[data-card-css] .mari-message-user`と`.mari-message-assistant`で、それぞれの側を選べます。

## @chat-modeで1つのモードを対象にする

1つの画面だけを対象にするには、ルールを`@chat-mode roleplay`、`@chat-mode conversation`、`@chat-mode game`のいずれかで囲みます。どのブロックにも入っていないCSSは、すべての画面に適用されます。標準の`@media`クエリーは、これらのブロックの中でも動きます。

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

Game Modeは基本的な対応にとどまります。**Chat**モードでは、カードCSSがゲーム画面全体に届くので、`[data-card-css]`でゲーム領域にテーマを適用できます。Gameは独自のレイアウトを使い、メッセージバブルがないため、領域の背景など、広い範囲を対象にしてください。ゲームのナレーションをキャラクターごとに(**Exclusive**で)装飾する機能は、まだありません。

## スタイルを当てられるもの

RoleplayとConversationは同じ骨組みを共有しています。下に挙げる`mari-*`クラスと`data-*`属性だけを使ってください。それ以外のクラスは、バージョンによって変わります。

| セレクター | 対象 |
| --- | --- |
| `[data-card-css]` | メッセージ行全体(スコープの要素)。縁のアクセントや、**Chat**モードではチャット領域に向いています。 |
| `[data-card-css] .mari-message-bubble` | 目に見えるバブル。背景、枠線、角、影。**Bubbles**とroleplayにあります。 |
| `[data-card-css] .mari-message-content` | **Bubbles**ではバブルの要素そのもの。**Linear**ではメッセージ本文だけです。 |
| `[data-card-css] .mari-message-name` | キャラクターの表示名。 |
| `[data-card-css] .mari-message-meta` | 名前とタイムスタンプが入るヘッダー行。 |
| `[data-card-css] .mari-message-timestamp` | タイムスタンプ。 |
| `[data-card-css] .mari-message-avatar` | アバターの列。 |
| `[data-card-css] .mari-message-narrator` | ナレーターのメッセージ(roleplay)。 |
| `[data-card-css] .mari-message-user` | ユーザーのメッセージ。キャラクターのメッセージには`.mari-message-assistant`を使います。 |
| `[data-card-css] p`, `[data-card-css] span` | 本文の中の段落と、インラインのspan。 |
| `[data-grouped]` | 同じキャラクターからの続きのメッセージ。Conversationのみ。グループの最初のメッセージには`[data-card-css]:not([data-grouped])`を使います。 |

レイアウトを変えるには、**Settings → Appearance → Conversation**(設定 → 外観 → Conversation)を開き、**Conversation Display**、**Chat Layout**(チャットのレイアウト)の順に開きます。**Linear**にはバブルがないため、`.mari-message-content`(本文)と`[data-card-css]`(行)にスタイルを当てます。

バブルにスタイルを当てた例です。

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

### 入力中インジケーター

Conversationの**Linear**レイアウトでは、キャラクターが書いている間、「(name) is typing...」の行が表示されます。

| セレクター | 対象 |
| --- | --- |
| `[data-card-css] .mari-typing-text` | ラベル。 |
| `[data-card-css] .mari-typing-dots span` | アニメーションする点。 |
| `[data-card-css] .mari-typing-indicator` | 行。`data-typing-name`として名前を持ちます。 |

```css
[data-card-css] .mari-typing-text {
  color: #ff66cc;
  font-style: italic;
}
[data-card-css] .mari-typing-dots span {
  background: #ff66cc;
}
```

### アバター

アバターはデフォルトでは円形です。次の例は、クリックできるアバターのボタンを対象にしています。クリックできないアバターには`.mari-message-avatar > div`を使います。roleplayでは、ボタンが光彩用の追加のラッパー`div`の内側に入っています。自分で付けたリングだけを見せたいときは、このラッパーの効果を消してください。

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

### About Meプロフィールポップアウト(Conversationのみ)

Conversationモードでアバターをクリックすると、「about me」を載せたプロフィールのポップアウトが開きます。キャラクターカードもペルソナも、自分のポップアウトにテーマを適用できます。このポップアウトはroleplayやgameには存在しないため、ほかのモード向けのCSSも一緒に配布する場合は、これらのルールを`@chat-mode conversation`で囲んでください。

ポップアウトのカードがスコープの要素です。指定には`[data-card-css].mari-about-me-popout`を使い(空白なし、同じ要素)、その子要素は子孫として指定します。**Chat**モードでは、`.mari-about-me-name`をそのまま使えます。

| セレクター | 対象 |
| --- | --- |
| `[data-card-css].mari-about-me-popout` | ポップアウトのカード。背景、枠線、形。 |
| `[data-card-css] .mari-about-me-banner` | 上部のバナー帯(デフォルトでは名前の色)。 |
| `[data-card-css] .mari-about-me-avatar` | 拡大表示したアバターのラッパー。円形の部分には`... > div`を使います。 |
| `[data-card-css] .mari-about-me-status` | 在席状態を示す点(キャラクターのみ)。 |
| `[data-card-css] .mari-about-me-name` | 表示名の見出し。 |
| `[data-card-css] .mari-about-me-handle` | 補助的な@nameの行。Convoの表示名が異なるときに表示されます。 |
| `[data-card-css] .mari-about-me-presence` | 状態やアクティビティーの行(キャラクターのみ)。 |
| `[data-card-css] .mari-about-me-box` | About Meを囲むボックス。 |
| `[data-card-css] .mari-about-me-label` | 「ABOUT ME」のキャプション。 |
| `[data-card-css] .mari-about-me-badge` | DefaultまたはChat-specificのピル。 |
| `[data-card-css] .mari-about-me-text` | about meの本文。 |

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

## スタイルを当てられないもの

次のものは、セキュリティのためにサニタイザーが取り除きます。

| ブロックされるもの | 理由 |
| --- | --- |
| `url(https://...)` | 追跡や情報漏えいを防ぐため、ネットワークリクエストは行いません。許可されるのは`url(data:...)`だけで、インラインの画像やフォントに使えます。 |
| 外部URLを使う`@font-face` | 残るのは`data:`のフォントソースだけです。ファミリー名は付け替えられ、アプリのフォントを上書きできません。 |
| `@import` | 外部のスタイルシートは読み込めません。 |
| `:has()`セレクター | チャットの外側にある要素を調べられません。 |
| 入れ子のルールと、`~`や`+`で始まるセレクター | 取り除かれるので、カードCSSがスコープの外に届くことはありません。通常のセレクターで書いてください。 |
| `content:`の中のHTML | 装飾的な文字は使えますが、`<`と`>`は取り除かれ、文字数は200文字までに制限されます。`attr()`と`counter()`は使えます。 |
| `position: fixed` | `position: absolute`に書き換えられるので、全画面のオーバーレイは作れません。 |
| `!important` | 取り除かれるので、カードCSSでアプリのスタイルを強制的に上書きすることはできません。 |
| アプリのテーマトークン | `--primary`や`--background`などのトークンは取り除かれるので、カードCSSでアプリのUIを塗り替えることはできません。 |

チャットの中では、色、背景、枠線、フォントについて、カードCSSがアプリ自身のメッセージスタイルより優先されます。サニタイザーが取り除いた記述、チャットの外側にあるもの、アプリがインラインや`!important`で当てているスタイルには勝てません。**Settings**(設定)で設定するチャット全体の文字色と文字サイズが、その一例です。

カスタムフォントを使うには、base64の`data:`URIで埋め込むか、システムフォントの組み合わせを使います。

```css
@font-face {
  font-family: "MyFont";
  src: url(data:font/woff2;base64,d09GMgAB...) format("woff2");
}
```

## ヒント

1. バブルには`[data-card-css]`ではなく`.mari-message-bubble`でスタイルを当てます。行は横幅いっぱいなので、行に背景を付けてもほとんど見えません。
2. 色は`rgba()`で指定すると、明るいテーマでも暗いテーマでもなじみます。
3. アニメーションは控えめにします。性能の低いデバイスでは、重い`animation`より`transition`を選びます。`box-shadow`は毎フレーム再描画されるので、アニメーションさせるのは`box-shadow`ではなく`opacity`にします。
4. スマートフォン向けには`@media (max-width: 768px)`を使います。
5. ユーティリティークラスに頼らないでください。安定しているのは、ドキュメントに載っている`mari-*`のフックだけです。

## 実例: Eldritch Grimoire

この例は、すべてのモードで主なフックを一通り使っています。光る名前、テーマに合わせたセリフ体の本文、リングを付けたアバター、角にルーンを配したアニメーション付きのroleplayバブル、Conversationのバブル、不気味な入力中インジケーター、ゲーム画面です。**Creator Notes**に貼り付けてから、**Chat Settings → Characters**(チャット設定 → キャラクター)でCard Themingのモードを選びます(Gameでは**Party**)。ゲーム画面には**Chat**を設定します。色、`content`の文字、フォントを差し替えれば、自分だけのカードになります。

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

## AIアシスタントでカードCSSを作る

CSSを手で書かずに済ませるには、次のプロンプトをAIアシスタントに渡します。印を付けた箇所に、キャラクターの構想を書き込んでください。

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

## 関連ガイド

- [外観の設定](appearance-settings.md)
- [カスタムCSSテーマ(Theme Library)](custom-css-themes.md)
- [キャラクターの作成と編集](../characters/creating-and-editing-characters.md)
