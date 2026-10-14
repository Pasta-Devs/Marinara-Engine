# 外観の設定

このガイドでは、Marinara Engineの**Settings -> Appearance**(外観)タブをセクションごとに順番に説明します。色、文字サイズ、チャットのレイアウト、モードごとのメッセージの見た目、そしてすべてをデフォルトに戻す方法を扱います。

フォント、背景、カスタムCSSテーマには、それぞれ専用のガイドがあります。このページでは該当する箇所からリンクします。

## 外観の設定を開く

1. **Settings**(設定)を開きます。
2. **Appearance**タブを選びます。

タブはスクロールして見ていく複数のセクションに分かれています。**App Style**、**Text & Scale**、**Conversation Display**、**Tracker Panel**、**Roleplay Messages**、**Game Presentation**、**Atmosphere**、**Conversation Theme**、**Backgrounds**です。

## Color Scheme(ダークまたはライト)

**Color Scheme**(配色)ドロップダウンは**App Style**セクションにあります。選択肢は2つです。

- **Dark**(デフォルト)。暗い部屋でも目が疲れにくい配色です。
- **Light**。

以下で説明する色のいくつかは、ダークとライトで別々のデフォルト値を持っています。自分で色を指定するまでは、選んでいるColor Schemeに自動で合わせて切り替わります。

## Visual Style

**Visual Style**(見た目のスタイル)はアプリ全体の雰囲気を決めます。2つのカードから選びます。

- **Default (Marinara)**(デフォルト)。発光効果のあるレトロなY2K風の見た目です。
- **SillyTavern**。オリジナルのSillyTavernを参考にした、すっきりとしたミニマルな見た目です。

これは見た目だけの設定です。SillyTavernからのデータのインポートとは関係ありません。データのインポートは別の機能です。

## Background ColorとAccent Color

この2つはどちらも**App Style**セクションにあります。単色でもグラデーションでも指定できます。グラデーションとは、2色以上をなめらかに混ぜた塗り方です。

- **Background Color**(背景色)はアプリ全体の土台となる背景を塗ります。デフォルトはDarkモードが`#050312`、Lightモードが`#faf8ff`です。
- **Accent Color**(アクセントカラー)はボタン、選択中のアイコン、フォーカスリング、ハイライト、パネルの枠線の色になります。デフォルトはどちらの配色でも`#d4acfb`です。

`#d4acfb`のような値は16進カラーコードで、色を短く書き表す記法です。配色のデフォルトに戻すときは、**Reset to default**で欄を空にします。

Accent Colorの見え方を変えるトグルが2つあります。

- **Accent Pulse**(デフォルトはオフ)はAccent Colorをゆっくり動かします。単色なら明るさが変化し、グラデーションなら色が順に巡ります。
- **RGB Mode**(デフォルトはオフ)はオンの間、アクセントの色を虹色に巡回させます。保存したAccent Color自体は変わりません。

この2つは同時には使えません。**RGB Mode**をオンにすると**Accent Pulse**がオフになり、**Accent Pulse**をオンにすると**RGB Mode**がオフになります。Accent PulseはAppearanceタブを開いている間、その場でプレビューできます。デバイス側で視覚効果を減らす設定にしている場合は、どちらのアニメーションも再生しません。

## Chat widget style

**App Style**の下部で、移動できるチャットのボタン、ウィンドウ、セクションに使うスタイルを**Default**(デフォルト)、**Dottore**、**Prof. Mari**から選びます。フォント、枠の形、3つの主な色は個別に変更できます。カラーピッカーはグラデーションにも対応しています。

**Button size (px)**(ボタンのサイズ、px)は、Display Sizeを変えずに、移動できるチャットボタンとそのアイコンのサイズを変えます。32から96ピクセルの値を入力してください。欄を空にするか、リセットボタンを使うと、現在のデフォルトを維持できます。サイズは外観の設定と一緒に保存され、別のプリセットを選んでも変わりません。

カラーピッカーの下にある**Apply preset font**(プリセットのフォントを適用)、**Apply preset shape**(プリセットの形を適用)、**Apply preset colors**(プリセットの色を適用)で、チャットのほかの部分もそろえられます。3つとも最初はオフで、それぞれ独立して動作します。メッセージ、入力欄、チャットの操作部品が対象です。Game Modeでは、HUDウィジェット、マップパネル、補足の発言、キャラクターシート、ログ、インベントリー、戦闘画面のパネル、ダイアログも対象になります。Conversationメッセージには選んだフォントと色が適用されますが、元の形は保たれます。独自に選んだフォント、形、色も適用されます。**Apply preset colors**をオンにしても、引用符で囲まれたセリフにはキャラクターやペルソナごとのDialogue Highlight Colorが使われます。例やカスタムテーマについては[カスタムCSSテーマ](custom-css-themes.md#ready-made-chat-window-styles)を参照してください。

## Custom Mouse Pointer

**Custom Mouse Pointer**(カスタムマウスポインター、デフォルトはオン)は、アプリ全体でMarinaraのアクセントカラーのカーソルを使います。システム標準のカーソルに戻したいときや、カスタムCSSテーマにカーソルを任せたいときはオフにします。

## Display SizeとChat Font Size

この2つは**Text & Scale**セクションにあります。

- **Display Size**(表示サイズ)は、このデバイスでのアプリ全体の基準となる文字サイズを決めます。選択肢は**Tiny**、**Small**、**Medium**、**Default**(17px)、**Large**、**Huge**です。
- **Chat Font Size**(チャットの文字サイズ)はスライダーで、チャットメッセージの文字サイズを決めます。範囲は12pxから48pxまで、デフォルトは16pxです。

**Font**ドロップダウンも同じセクションにあります。自分のフォントを追加したり、Google Fontsからダウンロードしたりする方法は[カスタムフォントとGoogle Fonts](fonts.md)を参照してください。

## チャットの文字色と縁取り

同じ**Text & Scale**セクションには、背景の上でチャットの文字がどう見えるかを調整する4つの設定があります。

- **Chat Text Color**はチャットメッセージの基本の文字色を決めます。デフォルトはDarkモードが`#d4d4d4`、Lightモードが`#1a1025`です。
- **Default Dialogue Color**は、キャラクターカードやペルソナのカードが独自のDialogue Highlight Colorを指定していないときに、引用符で囲まれたセリフを着色します。カード側の色指定があればそちらが優先されます。**Apply preset colors**がオンの間は、このセリフにDefault Dialogue Colorではなくチャットウィジェットのスタイルの文字色を使います。
- **Chat Chrome Text Color**は、トラッカーのウィジェット、フォルダーのラベル、設定の説明文といった通常のテキストの色を決めます。デフォルトは**Chat Text Color**と同じです。
- **Text Outline / Stroke**はチャットの文字に縁取りを付け、模様の多い背景の上でも読みやすくします。縁取りの色と、0pxから5pxまでの**Width**を指定します。デフォルトの太さは0.5pxです。太さを0にすると縁取りがオフになります。

どの色も、自分で指定するまではColor Schemeのデフォルトに従います。色の欄を空にすると、空白のままにはならず、その配色のデフォルトに戻ります。

## チャットのレイアウト(Conversation Display)

**Conversation Display**セクションには**Chat Layout**(チャットのレイアウト)という設定が1つだけあり、Conversationモードのメッセージの見た目を変えられます。選ぶとその場でプレビューが更新されます。

- **Linear**(デフォルト)。チャット風に行が並ぶ表示です。
- **Bubbles**。メッセンジャー風の吹き出し表示です。

## Tracker Panel

**Tracker Panel**セクションでは、Roleplayのトラッカー用サイドパネルの見た目を設定します。このパネル自体は独立した機能で、専用のガイドがあります。[Roleplay HUDとトラッカー](../roleplay/hud-and-trackers.md)を参照してください。

## Roleplayのメッセージの見た目

**Roleplay Messages**セクションでは、Roleplayチャットのメッセージの見た目を設定します。

- **Chat position**は、画面が広い場合にメッセージと入力欄をどこに置くかを選びます。選択肢は**Left**、**Center**(デフォルト)、**Right**の3つです。メッセージと入力欄は一緒に動き、同じ側でサイドバーやTracker Panelが開いているときは、チャットがその下に隠れないように位置がずれます。スマートフォンや幅の狭いウィンドウではチャットは画面幅いっぱいのままで、Game Modeのセリフ欄は中央に表示されたままです。
- **Roleplay Messages Background Opacity**は0%から100%までのスライダーです。デフォルトは90%です。値を下げると、メッセージの吹き出しから背景が透けて見えます。
- **Roleplay Avatars**は、各メッセージの横に表示するアバターのスタイルを選びます。選択肢は**None**、**Small Circles**(デフォルト)、**Small Rectangles**、**Glued Side Panel**の4つです。
- **Scrollable Avatars**(デフォルトはオフ)は、長いメッセージをスクロールしている間もアバターを表示し続けます。
- **Message avatar scale**は75%から250%までのスライダーです。デフォルトは100%です。
- **Default sprite scale**は50%から175%までのスライダーです。デフォルトは100%です。チャットごとにスプライトのサイズを指定した場合は、そちらがこのデフォルトより優先されます。

## Game Presentation

**Game Presentation**セクションでは、Game Modeの画像の大きさを調整します。Game Modeではセリフ用のポートレートと全身のスプライトの両方を表示できます。この2つのスライダーでそれぞれの大きさを決めます。

- **Dialogue portrait scale**は75%から175%までのスライダーです。デフォルトは100%です。
- **Full-body sprite scale**は75%から275%までのスライダーです。デフォルトは135%です。

**Game Dialogue Display**では、セリフ欄の動き方を選びます。

- **Classic VN**(デフォルト)。セリフ欄には進行中の1区切りだけを表示します。過去のセリフは**Logs**ボタンから読めます。
- **History Above VN**。それまでのセリフをセリフ欄の上に表示します。そのセッション全体をスクロールして読み返せます。

## Atmosphereの天候エフェクト

**Atmosphere**セクションには**Dynamic weather effects (rain, snow, fog, etc.)**というトグルが1つあり、デフォルトでオンです。物語の中の天候と時刻に合わせて、天候の粒子アニメーションを表示します。

このトグルが効果を発揮するのは、そのチャットで**World State**エージェントをオンにしている場合だけです。天候を物語から読み取るのはこのエージェントです。オンにしていないと、トグルを切り替えても見た目は変わりません。[エージェント: チャットを支えるAIヘルパー](../agents/agents-overview.md)を参照してください。

## Conversation Theme

**Conversation Theme**セクションでは、すべてのConversationモードのチャットに使う2色のグラデーション背景を設定します。**Dark**と**Light**のタブが分かれているので、配色ごとに別々のグラデーションを保存できます。これはConversationチャット全体に適用されるデバイス単位のデフォルトで、チャットごとの設定ではありません。

## Backgrounds

**Backgrounds**セクションでは、チャットの背景画像をインポートして選んだり、**Background Blur**を設定したりできます。独自のライブラリーを持つ独立した機能なので、専用のガイドがあります。[チャットの背景](chat-backgrounds.md)を参照してください。

## Reset Appearance

**Reset Appearance**(外観のリセット)ボタンは**App Style**セクションの先頭にあります。**Appearance**タブ全体をMarinaraのデフォルトに戻します。色、文字サイズ、レイアウト、アバターとスプライトの拡大率、グラデーションがすべて対象です。

リセットすると、現在のチャットの背景も消え、Theme Libraryで適用中のカスタムテーマもオフになります。設定をいじりすぎて収拾がつかなくなったときに、まっさらな状態から始め直せます。

## このデバイスにだけ残る設定

Appearanceの設定はほとんどが他のデバイスにも同期されます。同期されないのは2つ、**Display Size**と**Chat Font Size**です。この2つは使っているブラウザーに保存され、同期されることはありません。

どの設定がデバイス間で同期され、どの設定が手元に残るのかは、[設定の概要](../settings/settings-overview.md)にまとめてあります。

## 関連ガイド

- [カスタムフォントとGoogle Fonts](fonts.md)
- [チャットの背景](chat-backgrounds.md)
- [カスタムCSSテーマ(Theme Library)](custom-css-themes.md)
- [カードCSSテーマ設定ガイド](card-css-theming.md)
- [設定の概要](../settings/settings-overview.md)
