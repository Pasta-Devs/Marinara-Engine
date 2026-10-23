# iOS PWAの下部セーフエリア(開発者向け)

この開発者向けガイドでは、画面の下端に色の付いた帯が出る現象を説明します。Marinara EngineをiPhoneのホーム画面アプリとして開いたときに現れます。Marinara Engineが採用している対処、その対処と引き換えになるもの、そして今後の変更で帯が再発したときの切り分け方法を扱います。

PWA(Progressive Web App)とは、ホーム画面に追加してネイティブアプリのように開けるWebサイトのことです。この文書はコントリビューター向けのコードレベルの資料で、利用者向けのガイドではありません。

## 問題

ホームインジケーターのあるiPhone(Face IDのモデル)では、画面の下端がホームジェスチャー用のセーフエリアとして予約されています。iOSはこの領域の高さをおよそ34pxとして扱います。CSS変数`env(safe-area-inset-bottom)`の値と一致します。

PWAのステータスバーのスタイルが`black-translucent`になっていると、iOSは`position: fixed`の要素がこの領域に描画されるのを一切許しません。CSS側の回避策はすべて失敗します。WebKitは負の下方向オフセット、`calc(100dvh + env(safe-area-inset-bottom))`、負の高さ指定のいずれもクランプします。

その結果、チャット入力欄の下に帯が見えます。この帯は通称「chin」と呼ばれ、UIのほかの部分とは違う色で表示されます。

## 採用している対処

Marinara Engineはステータスバーのスタイルを`black-translucent`ではなく`black`に設定しています。metaタグは`packages/client/index.html`にあります。

```html
<meta name="apple-mobile-web-app-status-bar-style" content="black" />
```

viewportのタグは`viewport-fit=cover`とキーボードのデフォルト動作をそのまま維持します。

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
```

`black`モードならiOSは下端の領域をロックしません。アプリのシェルはビューポート高さの上書きなしで`fixed inset-0`を使うため、セーフエリアの下端まで描画されます。`packages/client/src/components/layout/AppShell.tsx`のシェルに付いているclassNameは次のとおりです。

```
mari-app mari-app-background-paint fixed inset-0 flex overflow-hidden
```

viewportのタグに`interactive-widget=resizes-content`を追加しないでください。モバイルのPWAでは、キーボードのアニメーション中にチャットのシェル全体がリサイズされ、メッセージのスクロールが途中で切れたままになることがあります。

## 引き換えになるもの

半透明のステータスバーと下端まで塗られた画面は両立しません。`black`モードのステータスバーは濃い色で塗りつぶされた帯になります。`black-translucent`のほうが上部は透明で見栄えがよいものの、下端の帯は取り除けなくなります。これはiOS側の動かせない制限です。

<a id="landscape-the-cameras-side-insets"></a>

## 横向き: カメラ側の余白

iPhoneを横向きにすると、カメラ(ノッチまたはDynamic Island)は左端か右端に来ます。`viewport-fit=cover`ではページがその下まで広がり、iOSはその空間を`env(safe-area-inset-left)`と`env(safe-area-inset-right)`で通知します。Dynamic Island搭載モデルでは、向きに関係なく両側とも約59pxです。MarinaraのAndroidアプリ(ターゲットSDK 34、エッジツーエッジではありません)はカットアウトを避けて配置されるため、両方とも0です。他のAndroidブラウザーでは、全画面やエッジツーエッジなどで0以外の値になることがあり、同じ変数で対応します。

Marinaraは縦向きのステータスバー部分と同じように、この空間を避けます。

- `packages/client/src/styles/globals.css`が両側の値を1回だけ読み、`:root`の`--mari-safe-area-inset-left`と`--mari-safe-area-inset-right`に格納します。他の箇所はすべてこの変数を読み、`env()`を直接読みません。`scripts/regressions/mobile-safe-area-inset.regression.ts`がこれを検証します。ダイアログ、omnibar、全画面エディター、TopBarの操作部品は、カメラや丸い角からの保護を維持します。
- iPhoneでは、`AppShell.tsx`が`window.orientation`(利用できない場合は`screen.orientation.angle`)からカメラ側を識別します。90°では左、−90°/270°では右です。`<html>`の`data-mari-camera-side`属性によって、CSSは反対側の**シェル**の余白である`--mari-shell-inset-left`または`--mari-shell-inset-right`だけを0にできます。不明な回転角度、iPad、Androidではシステムの余白を維持します。
- スマートフォンのシェルでは、`.mari-app`は`left`と`right`をシェル変数から取得します。カメラの上にはbodyのページ背景が縦向きのステータスバー部分と同じ色で表示され、反対側に対称な余白はできません。
- シェル内の固定要素はシェルではなく画面を基準に配置されるため、自分で余白を確保します。`AppShell.tsx`のスマートフォン用シートと背景は、シェル変数とともに`MOBILE_SHELL_PANEL_X_CLASS`を使います。シェルの星などの装飾は`absolute`なので、シェル内に収まります。

実機を使わずに確認するには、874×402のタッチ用ビューポートを開き、スタイルシートの`:root`ルールで両変数を`59px`に設定します(インラインスタイルはカメラ側のセレクターより優先されます)。Chromiumでは、DevTools Protocolの`Emulation.setSafeAreaInsetsOverride`コマンドで実際の余白をエミュレートすることもできます。`e2e/phone-camera-side.e2e.ts`は両方向の回転、新旧の画面方向API、不明な回転角度、その他のデバイスを確認します。e2eテスト"a phone turned sideways keeps the app out from under its camera"は、両側の余白を維持するフォールバックを確認します。

## 切り分けの経緯

帯の正体は、各レイヤーに色を付けてアプリを開き直す方法で突き止めました。診断用のスタイルは`packages/client/dist/index.html`のインラインの`<style>`ブロックに書き込みます。このファイルはservice workerにキャッシュされず、常に最新のものが配信されます。次にアプリを開いた時点で変更が反映され、キャッシュの削除は不要です。

```
html, body { background-color: #ff0000 !important; }
.mari-chat-input-box { background-color: #00ff00 !important; }
.mari-app { background: #0000ff !important; }
```

結果は次のように読み取ります。

- 帯が赤なら、そこを描画しているのはhtmlのキャンバスです。`black-translucent`モードでは、どのfixed要素でも覆えません。
- 帯が青なら、アプリのシェルの領域が下端まで届いています。これが正常な状態です。
- 帯が緑なら、入力欄そのものが下端まで広がっています。

## アップデートで壊れたときは

### 症状: 入力欄の下に帯が再び現れる

確認1。`packages/client/index.html`の`apple-mobile-web-app-status-bar-style`が`black`のままか確かめます。`black-translucent`に戻されていたら、`black`に直します。

確認2。`packages/client/src/components/layout/AppShell.tsx`のAppShellのclassNameが`mari-app mari-app-background-paint fixed inset-0 flex overflow-hidden`のままか確かめます。`inset-0`を`h-screen`、`h-dvh`、`max-h-screen`と組み合わせないでください。fixedのシェルに制約が掛かりすぎて、モバイルのキーボードでUIが押し動かされます。

確認3。上記の色による診断を実行し、どのレイヤーが帯を描画しているか調べます。アプリを強制終了して開き直してください。`dist/index.html`はプリキャッシュされないため、キャッシュの削除は不要です。

- ほかの部分は青いシェルなのに帯が赤い場合は、シェルの領域が下端まで届いていません。ステータスバーのスタイルが`black`か確かめます。
- 青いシェルのまま帯が赤い場合は、シェルが覆えていません。`fixed inset-0`が壊れていないか確かめます。
- 帯が青い場合は、シェルは覆えているものの入力欄が下端まで広がっていません。次の項目にある入力欄のラッパーのpaddingを確認します。

### 症状: 入力欄が画面の端にぴったり付いてしまう

3つの入力コンポーネントは、自然に浮いて見える余白のために外側のラッパーに`pb-0`ではなく`pb-3`が必要です。

- `packages/client/src/components/chat/ChatInput.tsx`: ラッパーは`mari-chat-input chat-input-container px-3 pb-3`です。
- `packages/client/src/components/chat/ConversationInput.tsx`: ラッパーは`mari-chat-input chat-input-container relative px-2 sm:px-3 pb-3`です。
- `packages/client/src/components/game/GameInput.tsx`: ラッパーは`px-3 pt-2 pb-3`です。

## 再ビルド

サーバーは`packages/client/dist`にあるビルド済みのクライアントを配信するため、ソースを変更したら再ビルドが必要です。

```
pnpm build:client
```

そのあとデバイス側でサイトデータを削除し、PWAを開き直します。スマートフォンでは**Settings**(設定)を開き、**Safari**、**Advanced**、**Website Data**と進みます。service workerはJSとCSSを内容のハッシュ単位でキャッシュするので、ハッシュが変わった新しいチャンクを読み込むにはサイトデータの削除が必要です。

`dist/index.html`はservice workerにキャッシュされず、常に最新のものが配信されます。フルビルドなしで診断用のスタイルを手早く差し込みたいときに使えます。

## 押さえておきたい点

- `black-translucent`はステータスバーを透明にしますが、下端のセーフエリアをロックします。CSSによる回避策はありません。
- `black`または`default`はステータスバーを塗りつぶし、fixed要素が下端のセーフエリアまで届くようにします。
- `env(safe-area-inset-bottom)`はFace IDのiPhoneでおよそ34pxです。必要に応じて、操作できる要素をホームインジケーターより上に逃がす余白として使います。
- `black-translucent`モードでは、ビューポート単位の`dvh`と`lvh`は物理的な画面の高さではなく、安全に表示できる高さと一致します。この境界より先へシェルを広げる目的では使わないでください。
- `interactive-widget=resizes-content`を指定すると、キーボードが開くときにfixedのチャットのシェルがリサイズされることがあります。viewportはデフォルトの動作のままにしてください。

## 関連ガイド

- [フロントエンドアーキテクチャ(開発者向け)](frontend.md)
- [iOS / iPadOS PWAガイド](../installation/ios-pwa.md)
