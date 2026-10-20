# カードCSSテーマ設定ガイド

このガイドでは、キャラクターやペルソナを作る人が、チャット内でカードに独自の見た目を持たせる方法を説明します。カードの**Creator Notes**(作成者メモ)にCSSを埋め込むと、Marinara Engineがそれを安全な形でそのキャラクターのメッセージに適用します。影響が及ぶのはチャットだけで、アプリのほかの部分に及ぶことはありません。

## 始める前に

このガイド全体で使う用語を、先に簡単に整理します。

- **CSS**は、Webページの色、フォント、枠線、余白を制御する言語です。
- **カードCSS**は、キャラクターカードやペルソナカードに埋め込むCSSです。そのカードのメッセージにテーマを適用します。
- **Card Theming**(カードテーマ)は、チャットでカードCSSを有効にするための画面上の設定です。
- **セレクター**は、CSSルールのうち、どの要素にスタイルを当てるかを選ぶ部分です。
- **子孫セレクター**は、空白で「内側にある」ことを表します。`.a .b`は、`.a`の内側にある`.b`に一致します。
- **カスケード**は、同じ要素に複数のルールが当たったときに、どれが優先されるかを決めるCSSの仕組みです。
- **レイアウト**は、メッセージが画面上でどう並ぶかを指します。Marinaraには行形式の**Linear**レイアウトと、**Bubbles**レイアウトがあります。

## クイックスタート

カードのテーマ設定は2か所で行います。まずカードにCSSを追加します。次にチャットでオンにします。

1. **Character Editor**(キャラクターエディター)でキャラクターを開き、**Creator Notes**欄を探します。ペルソナにも、**Persona Editor**(ペルソナエディター)に同じ欄があります。
2. `<style>`ブロックを**Creator Notes**に貼り付け、カードを保存します。
3. そのキャラクターとのチャットを開きます。
4. **Chat Settings**(チャット設定)を開き、**Card Theming**セクションを表示します。
5. **Exclusive**か**Chat**を選びます。初期状態は**Disabled**です。

キャラクターのメッセージがすぐに変わるはずです。**Card Theming**の設定が現れるのは、そのチャットで有効なキャラクターの**Creator Notes**にCSSが入っているときだけです。ペルソナのCSSだけでは設定は現れません。チャット内の少なくとも1体のキャラクターが、自分の`<style>`ブロックを持っている必要があります。設定が見当たらないときは、`<style>`ブロックが正しく保存されているか確かめます。

以下は、**Creator Notes**に貼り付けて使える出発点のブロックです。

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

どのレイアウトでも、キャラクター名がピンクに光り、本文が淡いピンクになります。バブルのルールは、紫のグラデーションとピンクの枠線を足します。ただし注意点が1つあります。`.mari-message-bubble`は、**Bubbles**レイアウトとroleplayにしか存在しません。Conversationのデフォルトのレイアウトは**Linear**で、バブルの要素がないため、そこではバブルのルールは何も起こしません。違いは後述の「BubblesとLinearの比較」で説明します。

**動作確認:** 確実に見分けられるテストとして、次のルールを使います。対象はメッセージ本文で、これはどのモードとレイアウトにも存在します。本文の背景がすぐに鮮やかなピンクに変わるはずです。

```css
[data-card-css] .mari-message-content {
  background: hotpink;
}
```

## Card Themingの仕組み

**Creator Notes**にCSSを持つキャラクターが有効なとき、Marinaraは次の4つを行います。

1. **Creator Notes**からすべての`<style>`ブロックを読み込みます。
2. CSSをサニタイズし、危険な記述を取り除きます。後述の「スタイルを当てられないもの」を参照してください。
3. CSSにスコープを付け、チャットの中だけに届くようにします。
4. CSSを挿入し、スコープの付いたセレクターがアプリ自身のメッセージスタイルを上書きするようにします。

適用のしかたは、チャットごとに**Chat Settings**の**Card Theming**で選びます。モードは3つあります。

| モード | 動作 |
| --- | --- |
| **Disabled**(デフォルト) | カードCSSはオフで、キャラクターのスタイルは適用しません。 |
| **Exclusive** | 各キャラクターのCSSは、そのキャラクター自身のメッセージにだけ影響します。 |
| **Chat** | すべてのカードCSSが、UI要素を含むチャット領域全体に影響します。 |

キャラクターごとに見た目を変えたいグループチャットでは**Exclusive**を使います。カードでチャット画面全体にテーマを適用したい1対1のチャットでは**Chat**を使います。

## 押さえておくべきスコープの規則

MarinaraはCSSを書き換えて、チャットの中だけに届くようにします。書き換え方はモードによって変わります。

- **Chat**モードは、すべてをチャット領域の下にスコープします。`.mari-message-bubble`は領域の内側にあるので、通常どおり一致します。
- **Exclusive**モードは、すべてをキャラクター自身のメッセージ要素の下にスコープします。この要素は`data-card-css`を持ちます。同じ要素に付いたクラスは、子孫としては一致しません。一致するのは、その内側にあるものだけです。

そこで、どちらでも通用する書き方はこうです。メッセージ要素そのものには`[data-card-css]`を使います。その内側にあるものには、`.mari-message-bubble`、`.mari-message-content`、`.mari-message-name`のような通常のクラスセレクターを使います。

`[data-card-css]`は、**Exclusive**モードでは「このキャラクターのメッセージ」、**Chat**モードでは「チャット領域」を指します。どちらでも動きます。内側の要素を指すセレクター(空白を含むもの)は、どちらのモードでも同じように動きます。

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

## @chat-modeによるモードの指定

特定の画面だけを対象にするには、ルールを`@chat-mode`ブロックで囲みます。どのブロックにも入っていないCSSは、すべての画面に適用されます。

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

標準の`@media`クエリーは、`@chat-mode`ブロックの中でも通常どおり動きます。画面幅に応じたレイアウトに使えます。

**Game mode**は基本的な対応にとどまります。**Chat**モードでは、カードCSSがゲーム画面全体に届きます。つまり`[data-card-css]`でゲーム領域にテーマを適用でき、`@chat-mode game`でそれを対象にできます。Gameは独自のレイアウトを使います。上に挙げたメッセージバブル用のフックは存在しないので、領域の背景など、広い範囲を対象にしてください。ゲームのナレーションをキャラクターごとに(**Exclusive**で)装飾する機能は、まだありません。

## スタイルを当てられるもの

チャットの構造は、RoleplayでもConversationでも同じ骨組みです。カードCSSで対象にできる要素は次のとおりです。内部のユーティリティークラスは、安定したフックではありません。バージョンによって変わるので、下に挙げる`mari-*`クラスと`data-*`属性だけを使ってください。

| セレクター | 対象 |
| --- | --- |
| `[data-card-css]` | メッセージ行全体(スコープの要素)。左端や縁のアクセント、**Chat**モードではチャット領域に向いています。 |
| `[data-card-css] .mari-message-bubble` | 目に見えるバブル。背景、枠線、角、影。**Bubbles**レイアウトとroleplayに存在します。 |
| `[data-card-css] .mari-message-content` | **Bubbles**ではバブルの要素そのもので、背景、枠線、角を含みます。**Linear**ではメッセージ本文だけです。 |
| `[data-card-css] .mari-message-name` | キャラクターの表示名。 |
| `[data-card-css] .mari-message-meta` | 名前とタイムスタンプが入るヘッダー行。 |
| `[data-card-css] .mari-message-timestamp` | タイムスタンプ。 |
| `[data-card-css] .mari-message-avatar` | アバターの列。 |
| `[data-card-css] .mari-message-narrator` | ナレーターのメッセージ(roleplay)。 |
| `[data-card-css] .mari-message-user` | ユーザーのメッセージ。キャラクターのメッセージには`.mari-message-assistant`を使います。 |
| `[data-card-css] p`, `... span` | 本文の中の段落と、インラインのspan。 |
| `[data-grouped]` | 同じキャラクターの連続したメッセージ。Conversationモードだけで、roleplayの行には付きません。グループの最初のメッセージには`[data-card-css]:not([data-grouped])`を使います。 |

**BubblesとLinearの比較。** `.mari-message-bubble`が対象にするのは**Bubbles**レイアウトです。**Linear**レイアウトにはバブルの要素がないので、代わりに`.mari-message-content`(本文)と`[data-card-css]`(行)にスタイルを当てます。レイアウトは**Settings**(設定) → **Appearance**(外観) → **Conversation Display**セクション → **Chat Layout**で変更します。Roleplayには常にバブルがあります。

以下は、Conversationやroleplayのバブルにスタイルを当てた例です。

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

キャラクターが返信を書いている間、Conversationの**Linear**レイアウトには「(name) is typing...」の行が表示されます。この行にもスタイルを当てられます。

| セレクター | 対象 |
| --- | --- |
| `[data-card-css] .mari-typing-text` | 「(name) is typing...」のラベル。 |
| `[data-card-css] .mari-typing-dots span` | アニメーションする点。 |
| `[data-card-css] .mari-typing-indicator` | 行そのもの。`data-typing-name`として名前も持ちます。 |

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

アバターはデフォルトでは円形です。CSSだけで形を変えたり、リングを付けたりできます。次の例は、クリックできるアバターのボタンを対象にしています。アバターがクリックできない形で描画される画面では、そのレイアウトの`.mari-message-avatar > div`に同じ考え方を当てはめます。roleplayでは、ボタンが光彩用の`div`の内側に入っています。自分で付けたリングだけを見せたいときは、このラッパーの効果を消します。

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

### About Meプロフィールポップアウト(Conversationのみ)

Conversationモードでは、アバターをクリックすると、キャラクターやペルソナの「about me」を載せたプロフィールのポップアウトが開きます。これも同じ`[data-card-css]`のスコープでテーマを適用できます。このポップアウトはConversationモードにしかありません。roleplayとgameには存在しません。roleplayやgame向けのCSSも一緒に配布する場合は、これらのルールを`@chat-mode conversation`で囲んでください。キャラクターカードもペルソナも、それぞれの**Creator Notes**から自分のポップアウトにテーマを適用できます。

ペルソナには注意点が1つあります。**Card Theming**の設定が現れるのは、チャットで有効なキャラクターの**Creator Notes**にCSSが入っているときだけです。ペルソナだけにCSSを書いても、設定は現れません。そのため、ペルソナのポップアウトのテーマを効かせるには、チャット内の少なくとも1体のキャラクターも`<style>`ブロックを持っている必要があります。

| セレクター | 対象 |
| --- | --- |
| `[data-card-css].mari-about-me-popout` | ポップアウトのカードそのもの(スコープの要素)。背景、枠線、形。 |
| `[data-card-css] .mari-about-me-banner` | 上部のバナー帯(デフォルトでは名前と同じ色)。 |
| `[data-card-css] .mari-about-me-avatar` | 拡大表示したアバターのラッパー。円形の部分には`... > div`を使います。 |
| `[data-card-css] .mari-about-me-status` | 在席状態を示す点(キャラクターのみ)。 |
| `[data-card-css] .mari-about-me-name` | 表示名の見出し。 |
| `[data-card-css] .mari-about-me-handle` | 補助的な@name行(Convoの表示名が異なるときに表示)。 |
| `[data-card-css] .mari-about-me-presence` | 状態やアクティビティーの行(キャラクターのみ)。 |
| `[data-card-css] .mari-about-me-box` | About Meの本体を囲むボックス。 |
| `[data-card-css] .mari-about-me-label` | 「ABOUT ME」のキャプション。 |
| `[data-card-css] .mari-about-me-badge` | DefaultまたはChat-specificのピル。 |
| `[data-card-css] .mari-about-me-text` | 表示されるabout meの本文。 |

ポップアウトのカードがスコープの要素です。指定には`[data-card-css].mari-about-me-popout`を使います(空白なし、同じ要素)。その子要素は、`[data-card-css] .mari-about-me-name`のように子孫セレクターで指定します。**Chat**モードでは領域全体がスコープになるので、`.mari-about-me-name`をそのまま使えます。

以下は、「about me」のポップアウトにテーマを適用した例です。キャラクターかペルソナの**Creator Notes**に貼り付けてから、**Chat Settings**で**Card Theming**を有効にします。ペルソナに貼り付ける場合は、上の注意点を思い出してください。チャット内のキャラクターにも**Creator Notes**のCSSが必要で、なければ設定は表示されないままです。

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

## スタイルを当てられないもの

次のものは、安全のためにサニタイザーが取り除きます。

| ブロックされるもの | 理由 |
| --- | --- |
| `url(https://...)` | ネットワーク通信は行いません。追跡や情報漏えいを防ぐためです。許可されるのは`url(data:...)`だけで、画像やフォントの埋め込みに使えます。 |
| 外部URLを使う`@font-face` | 残るのは`data:`のフォントだけです。ファミリー名は自動的に付け替えられ、アプリのフォントを上書きできません。 |
| `@import` | 外部のスタイルシートは読み込めません。 |
| `:has()`セレクター | チャットの外側にある要素を調べられません。 |
| 入れ子のルールと、`~`や`+`で始まるセレクター | 取り除かれるので、カードCSSがスコープの外に届くことはありません。通常のセレクターとして書いてください。 |
| `content:`の中のHTML | 装飾的な文字は使えますが、`<`と`>`は取り除かれ、文字数は200文字までに制限されます。`attr()`と`counter()`は使えます。 |
| `position: fixed` | `position: absolute`に書き換えるので、全画面のオーバーレイは作れません。 |
| `!important` | 取り除くので、カードCSSでアプリのスタイルを強制的に上書きすることはできません。 |
| アプリのテーマトークン | `--primary`や`--background`などのトークンは取り除くので、カードCSSでアプリのUIを塗り替えることはできません。 |

カードCSSは、アプリ自身のメッセージスタイルより優先されるスコープ付きのセレクターとして挿入します。チャットの中では、色、背景、枠線、フォントについてカードCSSが勝ちます。勝てないのは、サニタイザーが取り除いた記述、チャットの外側にあるもの、そしてアプリがインラインや`!important`で当てているスタイルだけです。**Settings**で設定するチャット全体の文字色と文字サイズが、その一例です。

**カスタムフォント。** base64の`data:`URIでフォントを埋め込むか、システムフォントやWebセーフなフォントの組み合わせを使います。

```css
@font-face {
  font-family: "MyFont";
  src: url(data:font/woff2;base64,d09GMgAB...) format("woff2");
}
```

```css
font-family: "Courier New", Consolas, monospace;
```

## ExclusiveとChatの比較: スコープの選び方

- **Exclusive**では、`[data-card-css]`がこのキャラクターのメッセージを指します。グループチャットや、キャラクターごとの個性を出したいときに最適です。メッセージの内側の要素を対象にしたCSSは、**Chat**モードと同じように動きます。
- **Chat**では、`[data-card-css]`がチャット領域全体を指します。メッセージのバブルだけでなく、背景や雰囲気ごとテーマを作りたい1対1のカードに最適です。

`[data-card-css] .mari-message-...`のセレクターで組み立てておけば、カードはどちらのモードでも正しく動きます。

## ヒント

1. バブルには`[data-card-css]`ではなく`.mari-message-bubble`でスタイルを当てます。後者は横幅いっぱいの行なので、背景を付けてもほとんど見えません。
2. 色は`rgba()`で指定すると、明るいテーマでも暗いテーマでもなじみます。
3. アニメーションは控えめにします。性能の低いデバイスでは、重い`animation`より`transition`を選びます。
4. スマートフォン向けには`@media (max-width: 768px)`を使います。
5. ユーティリティークラスに頼らないでください。安定しているのは、ドキュメントに載っている`mari-*`のフックだけです。

## 実例: Eldritch Grimoire

これは、あえて派手に作ったカードです。ドキュメントに載っているフックを、すべてのモードで一通り使っています。内容は次のとおりです。

- 光るルーン風の大文字の名前と、テーマに合わせたセリフ体の本文
- 形を変えてリングを付けたアバターと、スモールキャップスのタイムスタンプ
- メッセージ行の縁に置いた紋章
- 角にルーンを配したアニメーション付きのroleplayバブルと、装飾したナレーション
- Conversationのバブルと、不気味な入力中インジケーター
- アバターのクリックで開くプロフィールのポップアウト(全体にテーマを適用)
- ゲーム画面

全体をそのまま**Creator Notes**に貼り付け、**Chat Settings**で**Card Theming**を有効にします。RoleplayとConversationのメッセージ、Conversationのポップアウト、Gameの画面にテーマが適用されます(gameではモードを**Chat**にします)。`@chat-mode`でセクションを分けてあるので、各モードには実際に存在するフックだけが当たります。すべてサニタイザーを通っても問題ありません。

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

**ユーザーの行とキャラクターの行の比較。** **Exclusive**スコープでは、`[data-card-css]`はキャラクター自身のメッセージであり、これは`.mari-message-assistant`でもあります。自分の行にもテーマを適用するには、**Chat**スコープを使います。この場合`[data-card-css]`は領域全体を指し、`[data-card-css] .mari-message-user`と`.mari-message-assistant`でそれぞれの側を選べます。

色、`content`の文字、フォントを差し替えれば、自分だけのカードになります。

## AIにカードCSSを作ってもらう

CSSを自分で書きたくないときは、次のプロンプトをAIに渡します。印を付けた箇所に、キャラクターの構想を書き込んでください。

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
