# カスタムCSSテーマ(Theme Library)

カスタムCSSテーマは、Marinaraの見た目全体を塗り替えます。テーマの作成、インポート、エクスポート、切り替えには**Theme Library**(テーマライブラリー)を使います。このガイドでは、テーマで使えるCSS変数とクラスの一覧と、テーマとCard CSSの関係も説明します。CSSを書かずに手早く変えたいときは、[用意されているチャットウィンドウのスタイル](#ready-made-chat-window-styles)を参照してください。

始める前に: スマートフォンなどの別のデバイスからMarinaraを開く場合、テーマの作成、編集、インポート、有効化、削除には、サーバーに管理用のシークレットが必要です。サーバーを動かしているコンピューターでは、シークレットは不要です。

1. サーバー側で、`.env`ファイルに`ADMIN_SECRET`を設定します。
2. アプリで**Settings → Advanced → Admin Access**(設定 → 詳細設定 → 管理者アクセス)を開き、同じ値を入力します。

[サーバー設定リファレンス](../CONFIGURATION.md)と[リモートアクセスのガイド](../REMOTE_ACCESS.md)を参照してください。人からもらったテーマに切り替えるには、[テーマの切り替え](#activating-a-theme)に進んでください。

## カスタムテーマとは

CSSはCascading Style Sheetsの略で、色、枠線、余白を決めるコードです。テーマはCSSのかたまりで、ページの背景、アクセントカラー、カード、枠線、文字などを変更できます。

テーマはMarinaraのサーバー上の**Theme Library**(テーマライブラリー)に保存されるので、同じサーバーに接続するすべてのデバイスに反映されます。他の外観設定のほとんどは、1台のデバイスにだけ保持されます。同時に有効にできるテーマは1つだけですが、テーマはいくつでも置いておけます。

## Theme Libraryの場所

1. **Settings**(設定)を開きます。
2. **Addons**タブを開きます。
3. **Theme Library**セクションを探します。

## テーマの作成

1. **Theme Library**セクションで**Create Theme**(テーマの作成)をクリックします。
2. 名前の欄(「Theme name...」と表示されています)に名前を入力します。
3. 大きなテキストボックスにCSSを書くか、貼り付けます。
4. **Preview**(プレビュー)をオンのままにしておくと、入力しながら変更結果をその場で確認できます。ライブプレビューを止めるにはオフにします。
5. **Save**(保存)をクリックします。

新しいテーマは、よく使う変数をコメントアウトした例として並べたテンプレートから始まります。コメント記号を外して、自分の値を設定してください。新規のテーマは保存すると有効になり、「Theme "My Theme" saved and activated」と表示されます。

後からテーマを変更するには、**Installed Themes**(インストール済みのテーマ)でそのテーマを探し、コードのアイコン(ツールチップは**Edit theme CSS**)をクリックして編集し、**Save**をクリックします。編集しても、どのテーマが有効かは変わりません。

## テーマのインポートとエクスポート

テーマをインポートする手順は次のとおりです。

1. **Theme Library**セクションで**Import File**(ファイルのインポート)をクリックします。
2. `.css`ファイルか`.json`ファイルを選びます。
3. 表示されるメッセージを読みます。インポートできた数、スキップされた数、失敗した数が表示されます。

`.css`ファイルは、ファイル名を名前とする1つのテーマになります。`.json`ファイルには1つ以上のテーマを入れられます。Marinaraからエクスポートしたファイルはそのままインポートしてください。または、次のような小さなファイルを自分で書くこともできます。

```json
{ "name": "My Theme", "css": "..." }
```

インポートしたテーマは、自動では有効になりません。名前もCSSもサーバー上の既存のテーマと同じテーマは、スキップされます。

テーマをエクスポートするには、**Installed Themes**のそのテーマの行にあるアップロードのアイコン(ツールチップは**Export theme**)をクリックします。Marinaraが`.json`ファイルをダウンロードするので、別の場所でインポートできます。

<a id="activating-a-theme"></a>

## テーマの切り替え

**Installed Themes**(インストール済みのテーマ)には、すべてのテーマが並び、先頭に**Default Theme**(デフォルトのテーマ)の項目があります。

1. テーマ名をクリックすると、そのテーマが有効になります。有効なテーマにはチェックマークが付きます。
2. **Default Theme**をクリックすると、カスタムテーマが解除され、組み込みの見た目に戻ります。

**Settings → Appearance**(設定 → 外観)の**App Style**(アプリのスタイル)の先頭にある**Reset Appearance**(外観のリセット)でも、有効なテーマがオフになります。

テーマを削除するには、ごみ箱のアイコン(ツールチップは**Remove theme**)をクリックし、**Delete Theme**ダイアログで確定します。これでテーマのCSSがサーバーから完全に削除されます。

うまくいかなかった場合: アプリの表示がおかしいときは、有効なテーマと、チャットのCard CSSの両方を確認してください。[テーマとCard CSS](#themes-and-card-css)を参照してください。

<a id="ready-made-chat-window-styles"></a>

## 用意されているチャットウィンドウのスタイル

始める前に: この方法にCSSは要りません。

1. **Settings → Appearance → App**(設定 → 外観 → アプリ)を開きます。
2. **App Style**(アプリのスタイル)の下部で、**Chat widget style**(チャットウィジェットのスタイル)を探します。
3. スタイルを選びます。

| スタイル | 見た目 |
| --- | --- |
| **Default**(デフォルト) | 元の見た目。 |
| **Dottore** | 氷のような青の計器を思わせる枠、淡い金属色の縁、切り落とした角。 |
| **Prof. Mari** | 金色で縁取った物語の本を思わせる枠、宝石のような青、ウィンドウのタイトルに添えた原石。ボタンにはウィンドウと同じ背景を使います。 |

各スタイルには専用のフォントがあり、ライトモードとダークモードに対応し、ボタン、ウィンドウ、展開できるセクションの外観をまとめて変えます。スタイルを選ぶと、**Font**(フォント)、**Shape**(形)、3つの色がすべてリセットされます。ウィンドウの位置はそのままです。

次の項目は個別に変更できます。

- **Font**と**Shape**は、別のものを選ぶまでスタイルに従います(**Preset font**(プリセットのフォント)、**Preset shape**(プリセットの形))。
- **Border & Buttons Color**(枠線とボタンの色)は、輪郭とボタンのアイコンを変えます。アイコンにはグラデーションの最初の色を使います。
- **Background Color**(背景色)は、ボタン、ウィンドウ、展開できるセクション、編集欄を塗りつぶします。
- **Text Color**(文字色)は、ウィジェットの文字を変えます。見出しとラベルにはグラデーションが表示され、編集欄には最初の色を使います。

どの色にも、単色用のカラーピッカーとグラデーションの選択肢があります。各設定の横にある**Reset color**(色をリセット)を使うと、再びスタイルのライトモードまたはダークモードの色に従います。装飾の紋章は元の色を保ちます。

### スタイルをチャットにも適用する

カラーピッカーの下にある3つのスイッチで、スタイルの適用範囲を広げられます。各スイッチは最初はオフで、それぞれ独立して動作します。スイッチをオフにすると、その部分は通常のチャットの外観に戻ります。別のスタイルを選んでも、スイッチの選択は保たれます。

| スイッチ | 適用されるもの |
| --- | --- |
| **Apply preset font**(プリセットのフォントを適用) | ウィジェットのフォント。メッセージ、入力欄、チャットの操作部品に使います。 |
| **Apply preset shape**(プリセットの形を適用) | 枠の形。Roleplayメッセージ(クラシックとビジュアルノベル)、Gameの会話ボックス、入力欄、操作部品に使います。Conversationメッセージは元の形を保ちます。 |
| **Apply preset colors**(プリセットの色を適用) | これらの領域の枠線、背景、文字の色。Conversationメッセージも対象です。独自の色やグラデーションも適用されます。引用符で囲まれたセリフは、キャラクターやペルソナごとのDialogue Highlight Colorを保ちます。エージェントの装飾付きカードのようにHTMLでできたメッセージは、それ自体が指定した文字の色を保ちます。 |

**Load More**(さらに読み込む)や**Show older**(古いものを表示)などの履歴のボタンも、ほかのチャットの操作部品と同じくスイッチに従います。Game Modeでは、スイッチは補足の発言、HUDウィジェット、マップパネル、キャラクターシート、ログ、インベントリー、戦闘画面のパネル、ダイアログにも適用されます。Professor Mariに、これらの領域のカスタムテーマを作成してもらうこともできます。

カスタムテーマでは、これらのスタイルをさらに上書きできます。以下のウィンドウとドロワーの変数は、スタイルの色より優先されます。ウィンドウの書体には`--mari-window-font-family`、セクションの角には`--mari-drawer-radius`を使い、タイトルの装飾を隠すには`--mari-window-ornament: none`を指定してください。スタイルの装飾をすべて取り除くには、先に**Default**を選んでください。

<a id="themes-and-card-css"></a>

## テーマとCard CSS

Marinaraには、カスタムCSSを追加する方法が2つあり、両方を同時に有効にできます。

- カスタムテーマはアプリ全体を塗り替えます。Marinaraの中核となる変数を上書きでき、`!important`も`position: fixed`も使えます。
- Card CSSはキャラクターやペルソナのカードに埋め込まれ、チャットごとにオンにします。Card CSSはより厳しく整理されます。中核となる変数は上書きできず、`!important`は取り除かれ、`position: fixed`は`position: absolute`に置き換わります。対象はアプリ全体ではなくチャットのメッセージです。[カードCSSテーマ設定ガイド](card-css-theming.md)を参照してください。

## サイズと名前の上限

テーマ名は200文字までです。CSSは256 KiBまでで、UTF-8のバイト数で数えます。これより大きなテーマは、保存時やインポート時に拒否されます。また、カスタムテーマのCSSは実行前に整理されるため、他のWebサイトからファイルを読み込むスタイルは動作しません。画像やフォントは、代わりに`data:` URIとして埋め込んでください。

## CSS変数リファレンス

テーマエディターには、折りたためる**CSS Variable Reference**(CSS変数リファレンス)があります。クリックすると、上書きできる代表的な変数を確認できます。テーマは`:root`ブロックでこれらの変数を設定してアプリの見た目を変えます。リファレンスに載っている変数は次のとおりです。

| 変数 | 変わる場所 |
| --- | --- |
| `--background` | ページの背景 |
| `--foreground` | 本文の文字 |
| `--primary` | アクセントとボタン |
| `--primary-foreground` | primary上の文字 |
| `--secondary` | カードと入力欄 |
| `--card` | カードの背景 |
| `--border` | 枠線 |
| `--muted-foreground` | 薄い文字 |
| `--sidebar` | サイドバーの背景 |
| `--sidebar-border` | サイドバーの枠線 |
| `--marinara-shell-edge-border` | 画面左右の外枠 |
| `--destructive` | エラーと削除 |
| `--popover` | ドロップダウンの背景 |
| `--accent` | ホバー時の強調 |

テーマでは、この一覧に限らず、Marinaraが使うどのCSS変数も設定できます。専用の変数を持つ効果もあります。たとえば`--marinara-theme-accent-pulse: enabled`は、アクセントが脈打つアニメーションを要求します。

## チャットウィンドウとドロワーの外観

コンピューターでは、**Chat Settings**(チャット設定)は移動できるウィンドウとして開きます。その中の折りたたみ可能なセクションは**drawers**(ドロワー)と呼ばれます。ドロワーは独立したウィンドウに切り離し、さらに**bubble**(バブル)と呼ばれる小さな移動可能なボタンに最小化できます。

Game controls、Session、Volume、Game Assets、接続したチャット、パッケージの操作など、ほかのチャットツールもこれらのウィンドウとボタンを使います。スマートフォンでは、ほとんどのウィンドウが画面幅いっぱいのパネルとして開きます。Echo Chamberは、移動やサイズ変更ができる小さなウィンドウのままです。Chat Settingsから切り離したツールは、移動できる3点アイコンの**Chat tools**(チャットツール)メニューにまとめられます。トラッカーのボタンは別に表示されます。

以下のクラス、データ属性、変数を使うと、これらの部品の外観をまとめて変えられます。テーマのルールは、`!important`を使わずにデフォルトを上書きします。

### クラス

| 部品 | クラス |
| --- | --- |
| ウィンドウ | `.mari-window` |
| タイトルバー | `.mari-window__header` |
| タイトルとそのアイコン | `.mari-window__title-row` |
| タイトル | `.mari-window__title` |
| タイトルバーのボタン(Reset View、お気に入りレイアウトの星、Tracker Panel、ピン留め、ロック、閉じる、戻す) | `.mari-window__controls`(各ボタンは`.mari-window__control`) |
| ウィンドウの内容 | `.mari-window__body` |
| サイズ変更用の辺と角 | `.mari-window__resize-handle` |
| ポインターまたはフォーカスがウィンドウ内にある間に表示される角のマーク | `.mari-window__resize-grip` |
| ドロワー | `.mari-drawer` |
| ドロワーのヘッダーとタイトル | `.mari-drawer__header`、`.mari-drawer__title` |
| ドロワーのアイコン、件数バッジ、**?** | `.mari-drawer__icon`、`.mari-drawer__count`、`.mari-drawer__help` |
| 折りたたんだドロワーのプレビュー(トラッカーの小さなウィジェット) | `.mari-drawer__summary` |
| 矢印の横のドロワーボタンと、切り離しボタン | `.mari-drawer__actions`、`.mari-drawer__popout` |
| ドロワーの矢印と内容 | `.mari-drawer__arrow`、`.mari-drawer__body` |
| ドロワーを外へドラッグする間、ポインターに追従するプレビュー | `.mari-drawer-ghost` |
| 最小化したウィンドウのボタン(バブル) | `.mari-window-bubble` |
| アイコンの代わりにバブルが表示するリアルタイムの概要(World Stateのバナー) | `.mari-window-bubble__banner` |
| ドラッグ中のバブルがほかのバブルとそろうときに表示される線 | `.mari-window-snap-guide` |
| エージェントの実行中に表示される点(Chat Settingsボタン、Trackersウィンドウ) | `.mari-agents-running-dot` |

### データ属性

- `data-window`はウィンドウとそのバブルの名前です。`chat-settings`、`trackers`、操作ウィンドウの`control:game`、`control:session`、`control:volume`、`control:assets`、`control:connected-chat`、`control:package:<package>`、`control:beholder:<package>`を使い、切り離したドロワーには`drawer:<window>:<drawer>`を使います。例は`drawer:chat-settings:chat-name`です。
- `data-drawer`はドロワーの名前です。例は`chat-name`です。`roleplay-agents`や`conversation-agents`のように、チャットモードで始まる名前もあります。トラッカーには`tracker-world`、`tracker-persona`、`tracker-characters`、`tracker-quests`、`tracker-inventory`、`tracker-custom`、`agent-activity`を使います。
- `data-presentation`は、コンピューターのウィンドウでは`"window"`、スマートフォンのパネルでは`"sheet"`です。
- `data-pinned`と`data-locked`は、ウィンドウがピン留めまたはロックされている間、`"true"`です。
- `data-window-control`は、タイトルバーの各ボタンの名前です。`"pin"`、`"lock"`、`"close"`、`"put-back"`があります。押された状態のピン留めボタンとロックボタンには、`aria-pressed="true"`も付きます。
- `data-chat-settings-control`は、Chat Settingsの追加のタイトルバーボタンを識別します。`"reset-view"`、`"favorite-layout"`、`"tracker-panel"`があります。現在のレイアウトが保存済みのお気に入りと一致すると、お気に入りの星には`aria-pressed="true"`が付き、アイコンが塗りつぶされます。
- 各サイズ変更ハンドルの`data-edge`は、`"n"`、`"s"`、`"e"`、`"w"`、`"ne"`、`"nw"`、`"se"`、`"sw"`のいずれかです。
- 開いたドロワーの`.mari-drawer__header`内にある切り替えボタンには、`aria-expanded="true"`が付きます。
- `data-drawer-control="pop-out"`は、ドロワーの切り離しボタンを示します。
- `data-outside="true"`は、ドロップすると切り離される距離まで、ウィンドウの外へ移動したドラッグプレビューを示します。
- `data-axis`は、縦に伸びる位置合わせガイドでは`"x"`、横に伸びるガイドでは`"y"`です。
- ドロワーを独立したウィンドウに表示しているとき、ウィンドウとその中のドロワーの両方で`data-detached`が`"true"`になります。切り離したドロワーのウィンドウの名前は`data-window="drawer:<window>:<drawer>"`で、例は`data-window="drawer:chat-settings:chat-name"`です。`data-drawer-host`は元のウィンドウの名前です。
- タイトルをドラッグしているドロワーの`data-dragging`は`"true"`になります。切り離したドロワーを元に戻せる状態でウィンドウの上に重ねている間、そのウィンドウの`data-drop-target`は`"true"`になります。
- バブルには、対応するウィンドウの`data-window`と`data-minimized="true"`が付きます。例は`.mari-window-bubble[data-window="control:volume"]`です。操作ウィンドウの名前は`control:game`、`control:session`、`control:volume`、`control:assets`、`control:connected-chat`、`control:package:<package>`、`control:beholder:<package>`です。ドラッグ中のバブルでは`data-dragging`が`"true"`になります。最小化したWorld Stateトラッカーのように、アイコンの代わりにリアルタイムの概要を表示するバブルには`data-banner="true"`が付き、概要に合わせて横幅が広がります。
- ロックされたバブルには、Chat Settingsボタンを含め、`data-locked="true"`が付きます。ウィンドウを開くことはできますが、そのウィンドウのロックを解除するまで移動はできません。`.mari-window-bubble[data-locked="true"]`で、これらのボタンに別の外観を付けられます。
- スマートフォンでは、ウィンドウと、その少し大きなバブルの両方に`data-presentation="sheet"`が付きます。Tracker Panelのバブルは`.mari-window-bubble[data-tracker-panel-toggle="bubble"]`です。
- Chat Settingsボタンもバブルです。`.mari-window-bubble[data-chat-settings-button]`で指定でき、Chat Settingsが開いている間は`data-open="true"`が付きます。
- 切り離したセクションは、`data-drawer-host`(元のウィンドウ)が付いたバブルに縮みます。そのウィンドウの**Put back**(戻す)ボタンは`[data-window-control="put-back"]`です。

### 変数

各変数には、共通のチャットUIの色へのフォールバックがあります。そのため、テーマでは変えたいものだけ指定すれば十分です。

| 変数 | 制御するもの |
| --- | --- |
| `--mari-window-bg` | ウィンドウの背景 |
| `--mari-window-text` | ウィンドウの文字 |
| `--mari-window-border`, `--mari-window-border-width` | ウィンドウの枠線 |
| `--mari-window-radius` | ウィンドウの角の丸み |
| `--mari-window-shadow` | ウィンドウの影 |
| `--mari-window-backdrop-filter` | ウィンドウの背後のぼかし |
| `--mari-window-header-bg`, `--mari-window-header-text`, `--mari-window-header-border` | タイトルバーの色 |
| `--mari-window-header-padding` | タイトルバーの余白 |
| `--mari-window-control-color`, `--mari-window-control-color-hover`, `--mari-window-control-bg-hover` | お気に入りの星を含むタイトルバーのボタン |
| `--mari-window-control-color-active`, `--mari-window-control-bg-active` | ピン留め、ロック、塗りつぶされたお気に入りの星を含む、押された状態のタイトルバーボタン |
| `--mari-window-control-radius`, `--mari-window-control-gap` | ボタンの丸みと間隔 |
| `--mari-window-focus-ring` | キーボードフォーカスの輪郭と、ドロワーを戻す先のウィンドウの輪郭 |
| `--mari-window-resize-handle-size` | サイズ変更用の辺の幅 |
| `--mari-window-bubble-size`, `--mari-window-bubble-radius`, `--mari-window-bubble-shadow` | バブルのサイズ、丸み、影 |
| `--mari-window-bubble-bg`, `--mari-window-bubble-bg-hover`, `--mari-window-bubble-border` | バブルの背景と枠線 |
| `--mari-window-bubble-text`, `--mari-window-bubble-text-hover` | バブルのアイコンの色 |
| `--mari-window-snap-guide` | 位置合わせガイドの色 |
| `--mari-drawer-bg`, `--mari-drawer-border` | ドロワーの背景と区切り線 |
| `--mari-drawer-header-bg`, `--mari-drawer-header-bg-hover` | ドロワーのヘッダーの色 |
| `--mari-drawer-header-padding`, `--mari-drawer-body-padding-inline`, `--mari-drawer-body-padding-bottom` | ドロワーの余白 |
| `--mari-drawer-title-color`, `--mari-drawer-icon-color`, `--mari-drawer-arrow-color` | ドロワーのヘッダーの文字とアイコン |
| `--mari-drawer-count-bg`, `--mari-drawer-count-text` | ドロワーの件数バッジ |

すべてのウィンドウを変えるには`:root`に、1つだけ変えるにはセレクターに変数を設定してください。

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

## メッセージ、入力欄、チャットの操作部品の外観

3つの**Apply preset**スイッチを使うと、カスタムテーマでもチャットのほかの部分にウィジェットのデザインを適用できます。以下の変数で各部分を上書きできます。CSSを自分で書きたくない場合は、Professor Mariに統一感のあるチャットテーマを依頼してください。

| 部品 | クラス |
| --- | --- |
| RoleplayとGameのメッセージボックス、Gameの補足の発言、HUDウィジェット、マップパネル、キャラクターシート、チャット入力欄 | `.mari-chat-style-surface` |
| Gameのログ、インベントリー、戦闘画面のパネル、選択肢、ダイアログ。パネルには、`logs`、`inventory`、`combat-actions`のように名前を示す`data-game-section`も付きます | `.mari-game-section.mari-chat-style-surface` |
| Journalなど、ウィンドウ内に表示されるGameの内容。ウィンドウの色に従います | `.mari-game-section` |
| Conversationメッセージ(フォントと色のみ) | `.mari-chat-style-conversation` |
| 枠のないConversationメッセージの文字 | `.mari-chat-style-text` |
| CallsとConversationのグループ操作を含むチャットの操作部品 | `.mari-chat-style-control` |
| 履歴のボタン: **Load More**、**Show older**、**Show newer**、**Latest**と、Gameのログの**Older**、**All**、**Show more older logs**。これらには`.mari-chat-style-control`も付いています | `.mari-chat-history-pager` |
| エージェントの装飾付きカードのようにHTMLでできたメッセージ。**Apply preset colors**がオンのときも、その中で指定した文字の色が保たれます | `.mari-html-content` |

| 変数 | 制御するもの |
| --- | --- |
| `--mari-chat-font-family` | 対応するチャット領域のフォント |
| `--mari-chat-bg` | ボックスの背景。単色またはグラデーションを指定できます |
| `--mari-chat-text` | 読みやすい単色の文字色 |
| `--mari-chat-border` | ボックスの輪郭。単色またはグラデーションを指定できます |
| `--mari-chat-border-color` | 単色の枠線のフォールバック |
| `--mari-chat-radius` | Conversationメッセージを除くボックスの角の丸み |
| `--mari-chat-control-bg`, `--mari-chat-control-bg-hover` | チャットボタンの背景 |
| `--mari-chat-control-color`, `--mari-chat-control-radius` | チャットボタンのアイコンの色と角の丸み |
| `--mari-chat-input-bg` | 編集欄の内側の背景 |

たとえば、**Apply preset font**と**Apply preset colors**をオンにすると、次のように指定できます。

```css
:root {
  --mari-chat-font-family: Georgia, serif;
  --mari-chat-bg: #251e29;
  --mari-chat-text: #f4e8dc;
  --mari-chat-border: linear-gradient(100deg, #d6aa66, #dda0b2);
}
```

未設定の変数は、ウィジェットの設定とプリセットに従います。組み込みのスタイルを通してこれらの変数を適用するには、対応するスイッチがオンである必要があります。**Apply preset shape**がオンでも、Conversationメッセージは元の形を保ちます。カスタムテーマでクラスを直接指定することもできます。装飾のために切り抜く場合も、フォーカスの輪郭、メニュー、メッセージの内容は切り抜かないようにしてください。

スマートフォンでは、3点メニューを開くと丸いボタンが展開されます。開閉ボタンは`[data-chat-tools-menu-button]`、開いたボタン列は`[data-chat-tools-menu]`で、各リスト項目の`data-chat-tools-menu-item`には、そのウィンドウのIDが設定されます。ツールのボタンは`.mari-window-bubble.mari-chat-tools-button`を使い、`data-chat-tools-menu-tool`にも同じIDが設定されます。ボタン列にはウィンドウの枠がありません。ボタンは丸い形を保ち、チャットのほかの部分に適用する3つのスイッチとは独立して、ウィジェットの色とボタンのサイズに従います。

## 関連ガイド

- [カードCSSテーマ設定ガイド](card-css-theming.md)
- [外観の設定](appearance-settings.md)
- [サーバー設定リファレンス](../CONFIGURATION.md)
- [リモートアクセス: ログインとIP許可リスト](../REMOTE_ACCESS.md)
