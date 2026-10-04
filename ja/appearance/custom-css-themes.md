# カスタムCSSテーマ(Theme Library)

このガイドでは、カスタムCSSテーマを使ってMarinara Engineの見た目全体を変える方法を説明します。テーマの作成、インポート、エクスポート、切り替えの手順に加えて、変更できるCSS変数と、Card CSSとの関係もわかります。

## 用意されているチャットウィンドウのスタイル

CSSを書かずに外観を変えるには、**Settings > Appearance > App**(設定 > 外観 > アプリ)を開き、**App Style**の下部にある**Chat widget style**(チャットウィジェットのスタイル)を探してください。**Dottore**は、シアンの計器を思わせる枠と切り落とした角を使います。**Mari**は、ローズとゴールドの枠に、ウィンドウのタイトルの原石を添えます。ボタンにはウィンドウと同じ背景を使います。各プリセットには専用のフォントがあり、ライトモードとダークモードに対応し、ボタン、ウィンドウ、展開できるセクションの外観をまとめて変えます。

**Font**(フォント)と**Shape**(形)では、それぞれを個別に変更できます。**Preset font**(プリセットのフォント)と**Preset shape**(プリセットの形)は、選択したスタイルに従います。

その下には3つの色設定があります。どれも単色用のカラーピッカーと、色を混ぜるグラデーションの選択肢を備えています。

- **Border & Buttons Color**(枠線とボタンの色)は、輪郭とボタンのアイコンを変えます。アイコンにはグラデーションの最初の色を使います。
- **Background Color**(背景色)は、ボタン、ウィンドウ、展開できるセクション、編集欄を塗りつぶします。
- **Text Color**(文字色)は、ウィジェットの文字を変えます。見出しとラベルにはグラデーションが表示され、編集欄の文字には最初の色を使います。

色設定を変えても、装飾の紋章は元の色を保ちます。

各設定の横にある**Reset color**(色をリセット)を使うと、再びプリセットのライトモードまたはダークモードの色に従います。プリセットを選ぶと、**Font**、**Shape**、3つの色がすべてリセットされます。**Default**は元の外観に戻します。ウィンドウの位置は、配置したままです。

カスタムCSSテーマは、これらのプリセットを上書きできます。以下の公開されたウィンドウとドロワーの変数は、プリセットの色より優先されます。ウィンドウの書体には`--mari-window-font-family`、セクションの角には`--mari-drawer-radius`を使い、タイトルの装飾を隠すには`--mari-window-ornament: none`を指定してください。プリセットの装飾をすべて取り除くには、先に**Default**を選んでください。

## カスタムテーマとは

カスタムテーマとは、Marinaraの外観を塗り替えるCSSのかたまりです。CSSはCascading Style Sheetsの略で、アプリ全体の色、枠線、余白を決めるコードです。テーマではページの背景、アクセントカラー、カード、枠線、文字などを変更できます。

カスタムテーマは**Theme Library**(テーマライブラリー)に保存します。保存先はMarinaraのサーバーなので、同じサーバーに接続するすべてのデバイスとブラウザーに反映されます。この点が、デバイスごとに保持される他の外観設定とは異なります。デバイスごとの設定については[外観の設定](appearance-settings.md)を参照してください。

同時に有効にできるカスタムテーマは1つだけです。ライブラリーには好きなだけテーマを置いておき、切り替えて使えます。

## Theme Libraryの場所

1. **Settings**(設定)を開きます。
2. **Addons**タブを開きます。
3. **Theme Library**セクションを探します。

このセクションのタイトルは**Theme Library**で、説明文には「Create, import, activate, edit, export, or remove custom CSS themes.」と表示されます。

## テーマの作成

1. **Theme Library**セクションで**Create Theme**(テーマの作成)をクリックします。
2. **Theme name**欄に名前を入力します。
3. 大きなテキストボックスにCSSを書くか、貼り付けます。
4. **Preview**をオンのままにしておくと、入力しながら変更結果をアプリ上で確認できます。ライブプレビューを止めるには**Preview**をオフにします。
5. **Save**をクリックします。

新しいテーマはテンプレートから始まります。テンプレートにはよく使う変数がコメントアウトされた例として並んでいるので、コメント記号を外して自分の値を設定できます。新規のテーマを保存すると、Marinaraはそのテーマをすぐに有効にします。あわせて、「Theme "My Theme" saved and activated」のようにテーマ名入りの確認メッセージを表示します。

後からテーマを変更するときは、**Installed Themes**リストで目的のテーマを探します。コードのアイコン(ツールチップは**Edit theme CSS**)をクリックして編集し、**Save**をクリックします。保存済みのテーマを編集しても内容が更新されるだけで、どのテーマが有効かは変わりません。

## テーマのインポートとエクスポート

テーマはファイルとして共有できます。サーバー間でテーマを移したり、友人に渡したりするときに便利です。

テーマをインポートする手順は次のとおりです。

1. **Theme Library**セクションで**Import File**(ファイルのインポート)をクリックします。
2. `.css`ファイルか`.json`ファイルを選びます。
3. トースト通知を読みます。インポートできた数、スキップされた数、失敗した数が表示されます。

`.css`ファイルはファイル名を名前とする1つのテーマになります。`.json`ファイルには1つ以上のテーマを入れられ、種類は2つあります。

1つ目はMarinaraからエクスポートしたファイルです。エクスポート時にMarinaraが付ける追加の項目で各テーマを包んだ形になっています。中身を読んだり編集したりする必要はありません。そのままインポートしてください。

2つ目は自分で書く小さなファイルです。テーマが1つなら、これだけで足ります。

```
{ "name": "My Theme", "css": "..." }
```

インポートしたテーマはサーバーに同期されますが、自動では有効になりません。名前もCSSも同じテーマがすでにサーバーにある場合は、二重に追加せずスキップします。

テーマをエクスポートするには、**Installed Themes**リストで目的のテーマを探し、アップロードのアイコン(ツールチップは**Export theme**)をクリックします。Marinaraが`.json`ファイルをダウンロードするので、別の場所でインポートできます。

## テーマの切り替え

**Installed Themes**リストには、すべてのテーマと、先頭の**Default Theme**項目が並びます。

1. テーマ名をクリックすると、そのテーマが有効になります。有効なテーマにはチェックマークが付きます。
2. **Default Theme**をクリックすると、カスタムテーマが解除され、Marinara本来の見た目に戻ります。

**Reset Appearance**(外観のリセット)ボタンは、**Settings -> Appearance**の**App Style**セクションの先頭にあります。このボタンを使うと、有効なカスタムテーマも解除されます。

テーマを完全に削除するには、その行のごみ箱のアイコン(ツールチップは**Remove theme**)をクリックし、**Delete Theme**ウィンドウで確定します。これでテーマのCSSがサーバーから完全に削除されます。

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

使える変数はこの一覧だけではありません。テーマではMarinaraが使うどのCSS変数も設定できますし、独自のスタイルを追加することもできます。

視覚効果の中には専用の変数を持つものもあります。たとえば`--marinara-theme-accent-pulse: enabled`を設定すると、アクセントが脈打つアニメーションを有効にできます。

カスタムテーマのCSSは、安全のため実行前に不要な記述を取り除きます。他のWebサイトからファイルを読み込むスタイルは動作しません。テーマの中で画像やフォントを使うときは、Webのリンクではなく`data:` URIとして埋め込んでください。`data:` URIはファイルの内容をCSSの中に直接持たせる書き方です。

## チャットウィンドウとドロワーの外観

コンピューターでは、**Chat Settings**(チャット設定)は移動できるウィンドウとして開きます。その中の折りたたみ可能なセクションは**drawers**(ドロワー)と呼ばれます。ドロワーは独立したウィンドウに切り離し、さらに**bubble**(バブル)と呼ばれる小さな移動可能なボタンに最小化できます。

Game controls、Session、Volume、Game Assets、接続したチャット、パッケージの操作など、ほかのチャットツールもこれらのウィンドウとボタンを使います。スマートフォンでは、ウィンドウは画面幅いっぱいのパネルとして開き、Tracker Panelには専用の移動可能なボタンがあります。

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
- バブルには、対応するウィンドウの`data-window`と`data-minimized="true"`が付きます。例は`.mari-window-bubble[data-window="control:volume"]`です。操作ウィンドウの名前は`control:game`、`control:session`、`control:volume`、`control:assets`、`control:connected-chat`、`control:package:<package>`、`control:beholder:<package>`です。ドラッグ中のバブルでは`data-dragging`が`"true"`になります。
- ロックされたバブルには、Chat Settingsボタンを含め、`data-locked="true"`が付きます。ウィンドウを開くことはできますが、そのウィンドウのロックを解除するまで移動はできません。`.mari-window-bubble[data-locked="true"]`で、これらのボタンに別の外観を付けられます。
- スマートフォンでは、ウィンドウと、その少し大きなバブルの両方に`data-presentation="sheet"`が付きます。Tracker Panelのバブルは`.mari-window-bubble[data-tracker-panel-toggle="bubble"]`です。
- Chat Settingsボタンもバブルです。`.mari-window-bubble[data-chat-settings-button]`で指定でき、Chat Settingsが開いている間は`data-open="true"`が付きます。
- 切り離したセクションは、`data-drawer-host`(元のウィンドウ)が付いたバブルに縮みます。そのウィンドウの**Put back**ボタンは`[data-window-control="put-back"]`です。

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

## サイズと名前の上限

テーマ名は200文字までです。CSSの本体は256 KiBまでで、文字数ではなくUTF-8のバイト数で数えます。これを超えるテーマは、保存時やインポート時に拒否されます。

## リモート環境でのAdmin Access

テーマの作成、編集、インポート、切り替え、削除は保護された操作です。これが関係するのは、ネットワーク越しにMarinaraを開く場合だけです。

サーバーを動かしているコンピューターと同じ場所でループバック(localhostとも呼びます)を使ってMarinaraを開いているなら、これらの操作はそのまま実行できます。スマートフォンやネットワーク上の別のコンピューターなど、他のデバイスからMarinaraを開く場合は、サーバー側に管理用のシークレットが必要です。

ネットワーク越しにテーマを管理する手順は次のとおりです。

1. サーバー側で、`.env`ファイルに`ADMIN_SECRET`を設定します。
2. アプリで**Settings -> Advanced -> Admin Access**を開き、同じ値を入力します。

これを設定しないと、ネットワーク越しのテーマ変更は失敗します。設定全体については[サーバー設定リファレンス](../CONFIGURATION.md)と[リモートアクセス: Basic AuthとIP許可リスト](../REMOTE_ACCESS.md)を参照してください。

## テーマとCard CSSの関係

Marinaraには、カスタムCSSを追加する方法が2つあります。それぞれ別の機能で、同時に有効にできます。

カスタムテーマはアプリ全体を塗り替えます。Marinaraの中核となる変数を上書きでき、`!important`も`position: fixed`も使えます。それがテーマの役割だからです。

Card CSSはこれとは異なります。キャラクターやペルソナの作者がカードにCSSを埋め込んでおき、チャットごとにオンにする仕組みです。Card CSSはより厳しく整理されます。アプリの中核となる変数は上書きできず、`!important`は取り除かれ、`position: fixed`は`position: absolute`に置き換わります。対象はアプリ全体ではなくチャットのメッセージです。詳しくは[カードCSSテーマ設定ガイド](card-css-theming.md)を参照してください。

アプリの表示が崩れているときは、有効なテーマとCard CSSの両方を確認する価値があります。どちらが原因の場合もあります。

## 関連ガイド

- [カードCSSテーマ設定ガイド](card-css-theming.md)
- [外観の設定](appearance-settings.md)
- [サーバー設定リファレンス](../CONFIGURATION.md)
- [リモートアクセス: Basic AuthとIP許可リスト](../REMOTE_ACCESS.md)
