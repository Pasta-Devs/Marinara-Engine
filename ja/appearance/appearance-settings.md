# 外観の設定

**Appearance**(外観)タブでは、Marinaraの見た目を変えられます。対象は、色、文字サイズ、チャットのレイアウト、チャットモードごとのメッセージの見た目です。

ほかのものをお探しですか?

- 別のフォント: [カスタムフォントとGoogle Fonts](fonts.md)
- チャットの背景画像: [チャットの背景](chat-backgrounds.md)
- **Settings → Addons → Theme Library**(設定 → アドオン → テーマライブラリー)のカスタムテーマ: [カスタムCSSテーマ](custom-css-themes.md)
- チャットでのキャラクター独自の見た目: [カードCSSテーマ設定ガイド](card-css-theming.md)

## 外観の設定を開く

1. **Settings**(設定)を開きます。
2. **Appearance**タブを選びます。
3. 上部のボタンから、**App**(アプリ)、**Conversation**、**Roleplay**、**Game**のいずれかを選びます。

ボタンはチャットモードごとに設定をまとめたもので、タブには選んだグループだけが表示されます。

| ボタン | セクション |
| --- | --- |
| **App** | **App Style**、**Text & Scale**、**Atmosphere**、**Backgrounds** |
| **Conversation** | **Conversation Display**、**Conversation Theme** |
| **Roleplay** | **Tracker Panel**、**Roleplay Presentation** |
| **Game** | **Game Presentation** |

最初からやり直すには、**App Style**(アプリのスタイル)の先頭にある**Reset Appearance**(外観のリセット)をクリックします。タブ全体がMarinaraのデフォルトに戻り、現在のチャットの背景が消え、Theme Libraryで適用中のテーマもオフになります。

## Appボタン

### Color SchemeとVisual Style

**App Style**(アプリのスタイル)の**Color Scheme**(配色)ドロップダウンには、**Dark**(デフォルト)と**Light**があります。アプリはすぐに切り替わります。ダークとライトで別々のデフォルトを持つ色は、自分で色を指定するまでこの設定に従います。

**Visual Style**(見た目のスタイル)には2つのカードがあります。**Default (Marinara)**(デフォルト)は、発光効果のあるレトロなY2K風の見た目です。**SillyTavern**は、すっきりとしたミニマルな見た目です。変わるのは見た目だけで、SillyTavernからのインポートとは関係ありません。

### アプリの背景とAccent Color

**Accent Color**は単色かグラデーションを指定できます。グラデーションとは、2色以上をなめらかに混ぜた塗り方です。**Reset to default**(デフォルトに戻す)で欄を空にすると、デフォルトに戻ります。

| 設定 | 色を付ける対象 | デフォルト |
| --- | --- | --- |
| **Accent Color**(アクセントカラー) | ボタン、選択中のアイコン、フォーカスリング、ハイライト、パネルの枠線、チャットの周りの操作部品。 | ピンク、オレンジ、シアンを混ぜた**Marinara Gradient** |

アプリ全体の土台となる画面の背景を変えるには、**App Style**にある**UI Editor**(UIエディター)を使います。

1. **Choose what to change…**(変更する対象を選ぶ)と表示されているドロップダウンを開き、**Whole app**(アプリ全体)を選びます。
2. **Background**(背景)をクリックし、色かグラデーションを選びます。
3. **Save**(保存)をクリックします。

背景を保存していない場合、アプリはDarkでは`#050312`、Lightでは`#faf8ff`を使います。デフォルトに戻すには、もう一度**Whole app**を開いて**Reset to default**をクリックします。

`#050312`のような値は16進カラーコードで、色を短く書き表す記法です。

アクセントの動きを変えるスイッチが2つあります。同時にオンにできるのは1つだけです。

- **Accent Pulse**はアクセントカラーを動かします。単色なら明るさが変化し、グラデーションなら色が順に巡ります。デフォルトでは、デスクトップではオン、スマートフォンではオフです。
- **RGB Mode**はアクセントの色を虹色に巡回させます。保存した**Accent Color**は変わりません。デフォルトはオフです。

デバイス側で視覚効果を減らす設定にしている場合は、どちらのアニメーションも再生しません。

### App Styleのその他の設定

- **Custom Mouse Pointer**(カスタムマウスポインター、デフォルトはオン)は、Marinaraのアクセントカラーのカーソルを使います。システム標準のカーソルを使うときや、カスタムテーマにカーソルを任せるときはオフにします。
- **Reduce Ambient Animations & Effects**(周囲のアニメーションと効果を減らす)は、装飾用のアニメーション、周囲の粒子、回転するプレビュー、文字が少しずつ現れる表示を止めます。デバイス側で視覚効果を減らす設定にしている場合も、Marinaraは同じようにします。
- **Desktop sidebar width**(デスクトップのサイドバーの幅)は、デスクトップで両側のサイドバーの幅を決めます。**Reset width**(幅をリセット)で元に戻ります。スマートフォンのレイアウトは変わりません。

### Chat widget style

**App Style**の下部で、移動できるチャットのボタン、ウィンドウ、セクションに使うスタイルを**Default**(デフォルト)、**Dottore**、**Prof. Mari**から選びます。フォント、形、3つの主な色は個別に変更できます。3つの**Apply preset**(プリセットを適用)スイッチを使うと、そのスタイルがメッセージ、入力欄、チャットの操作部品にも及びます。**Button size (px)**(ボタンのサイズ、px)は、**Display Size**を変えずに、移動できるチャットボタンとそのアイコンのサイズを変えます。32から96の値を入力するか、欄を空にしてデフォルトにします。すべての操作については[カスタムCSSテーマ](custom-css-themes.md#ready-made-chat-window-styles)を参照してください。

### Display SizeとChat Font Size

**Text & Scale**セクションには、次の設定があります。

- **Display Size**(表示サイズ)は、このデバイスでのアプリ全体の基準となる文字サイズを決めます。変更はすぐに反映されます。次のいずれかを選びます。

| 選択肢 | サイズ |
| --- | --- |
| **Tiny** | 12 px |
| **Small** | 14 px |
| **Medium** | 16 px |
| **Default** | 17 px |
| **Large** | 19 px |
| **Huge** | 22 px |
| **Extra large** | 26 px |
| **Extra extra large** | 30 px |
| **Maximum** | 34 px |

- **Chat Font Size**(チャットの文字サイズ)は、チャットメッセージの文字サイズを決めるスライダーです。範囲は12 pxから72 pxまでで、デフォルトは16 pxです。

**Font**(フォント)ドロップダウンも同じセクションにあります。[カスタムフォントとGoogle Fonts](fonts.md)を参照してください。

### チャットの文字色と縁取り

同じ**Text & Scale**セクションには、次の設定もあります。

- **Chat Text Color**(チャットの文字色)は、メッセージの基本の文字色です。デフォルトはDarkでは`#d4d4d4`、Lightでは`#1a1025`です。
- **Default Dialogue Color**(セリフのデフォルト色)は、キャラクターやペルソナが独自のDialogue Highlight Colorを持たないときに、引用符で囲まれたセリフを着色します。カード側の色が優先されます。**Apply preset colors**(プリセットの色を適用)がオンの間は、セリフにチャットのスタイルの文字色を使います。
- **Chat Chrome Text Color**は、チャットの周りの操作部品の文字色を決めます。対象は、トラッカーのウィジェット、フォルダーのラベル、設定の説明文です。デフォルトは**Chat Text Color**と同じです。
- **Text Outline / Stroke**(文字の縁取り)は、文字に縁取りを付け、模様の多い背景の上でも読みやすくします。縁取りの色と、0から5 pxまでの**Width**(太さ)を指定します。デフォルトは0.5 pxで、0にするとオフになります。

色の欄を空にすると、その配色のデフォルトに戻ります。

### Atmosphere

**Dynamic weather effects (rain, snow, fog, etc.)**(動的な天候エフェクト)はデフォルトでオンです。物語の中の天候と時刻に合わせて、天候の粒子を表示します。何かが表示されるのは、そのチャットで**World State**エージェントがオンのときだけです。[エージェント: チャットを支えるAIヘルパー](../agents/agents-overview.md)を参照してください。

### Backgrounds

**Backgrounds**(背景)セクションには、**Chat Background**(チャットの背景)ピッカーと**Background Blur**(背景のぼかし)があります。ほかに2つの設定もここにあります。**Conversation background image opacity**(Conversationの背景画像の不透明度)は、グラデーションを残したまま、Conversationモードでチャットの背景をどのくらい強く表示するかを決めます。**Chat List Backgrounds**(チャット一覧の背景)は、チャット一覧の各行の後ろに、そのチャットの背景を控えめなバナーとして表示します。**Active & Hovered**、**Every Row**、**Off**から選びます。[チャットの背景](chat-backgrounds.md)を参照してください。

## Conversationボタン

- **Conversation Display**の**Chat Layout**(チャットのレイアウト)は、Conversationのメッセージの見た目を変えます。その場でプレビューが表示されます。**Linear**(デフォルト)はチャット風に行を並べます。**Bubbles**はメッセンジャー風の吹き出しで表示します。
- **Avatar Shape**(アバターの形)は**Circular**(円形)か**Square**(四角形)です。アバターの大きさは変わりません。
- **Always display swipe menu**(スワイプメニューを常に表示)は、最初の返信からスワイプの矢印とカウンターを表示します。オフにすると、再生成した後にだけ表示されます。
- **Conversation Theme**(Conversationのテーマ)は、すべてのConversationチャットの後ろに2色のグラデーションを設定します。**Dark**と**Light**のタブは、それぞれ別のグラデーションを保持します。これはデバイス単位のデフォルトで、チャットごとの設定ではありません。

## Roleplayボタン

**Tracker Panel**(トラッカーパネル)では、Roleplayのトラッカー用サイドパネルの見た目を設定します。[Roleplay HUDとトラッカー](../roleplay/hud-and-trackers.md)を参照してください。

**Roleplay Presentation**(Roleplayの表示)では、Roleplayのメッセージの見た目を設定します。

| 設定 | 内容 | デフォルト |
| --- | --- | --- |
| **Chat position** | 広い画面でメッセージと入力欄を置く位置です。**Left**、**Center**、**Right**から選びます。同じ側でサイドバーやTracker Panelが開いていると、それに合わせて位置がずれます。スマートフォンでは画面幅いっぱいのままです。 | **Center** |
| **Visual Novel display** | セリフ用のポートレートとスプライトを添えて、完成した段落を1つずつ表示します。変更は、現在のRoleplayチャットと、スタイルを保存していないチャットのデフォルトに適用されます。 | オフ |
| **Roleplay Messages Background Opacity** | 0%から100%までのスライダーです。値を下げると、メッセージの吹き出しから背景が透けて見えます。 | 90% |
| **Roleplay Avatars** | 各メッセージの横に表示するアバターのスタイルです。**None**、**Small Circles**、**Small Rectangles**、**Glued Side Panel**から選びます。 | **Small Circles** |
| **Scrollable Avatars** | 長いメッセージをスクロールしている間もアバターを表示し続けます。 | オフ |
| **Message avatar scale** | 75%から250%までのスライダーです。 | 100% |
| **Default sprite scale** | 50%から175%までのスライダーです。チャットごとのスプライトのサイズのほうが優先されます。 | 100% |

このセクションには、**Custom chat width**(チャットの幅を指定)、**Always display swipe menu**(スワイプメニューを常に表示)、**Reduced paint effects**(描画効果を減らす。負荷の大きい透過と影を平らにして、画面の移動をなめらかに保ちます)、**Show Thinking In Messages**(メッセージ内に思考を表示)、**Don't Collapse Thinking**(思考を折りたたまない)、**Narrator's Cycling Avatars**(ナレーターのアバターを切り替える)もあります。**Visual Novel display**をオンにすると、**Paragraph delay**(段落の間隔)付きの**Auto-play VN paragraphs**(VNの段落を自動再生)、**Dialogue portrait scale**、**Full-body sprite scale**も表示されます。

## Gameボタン

**Game Presentation**(Gameの表示)の**Game VN Art**には、2つのスライダーがあります。**Dialogue portrait scale**(セリフ用ポートレートの拡大率、75%から175%、デフォルトは100%)と**Full-body sprite scale**(全身スプライトの拡大率、75%から275%、デフォルトは135%)です。

**Game Dialogue Display**では、セリフ欄の動き方を選びます。

- **Classic Dialogue Box**(デフォルト)は、進行中の1区切りだけを表示します。過去のセリフは**Logs**ボタンから読めます。
- **History Above Dialogue Box**は、それまでの区切りをセリフ欄の上に表示します。そこではセッション全体をスクロールして読み返せます。

**Game text effects**(Gameの文字エフェクト、デフォルトはオン)は、劇的な言葉、すべて大文字の強調、括弧書きの補足、文字エフェクト用のタグをアニメーションで表示します。オフにすると、普通の文字で表示されます。

## このデバイスにだけ残る設定

Appearanceの設定はほとんどが他のデバイスにも同期されます。**Display Size**と**Chat Font Size**は同期されません。この2つは使っているブラウザーに保存されます。何が同期されるかは[設定の概要](../settings/settings-overview.md)を参照してください。

## 関連ガイド

- [カスタムフォントとGoogle Fonts](fonts.md)
- [チャットの背景](chat-backgrounds.md)
- [カスタムCSSテーマ(Theme Library)](custom-css-themes.md)
- [カードCSSテーマ設定ガイド](card-css-theming.md)
- [設定の概要](../settings/settings-overview.md)
