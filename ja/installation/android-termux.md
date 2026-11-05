# Android(Termux)インストールガイド

AndroidのスマートフォンやタブレットでMarinara Engineを動かすためのガイドです。MarinaraはTermuxの中で動きます。Termuxは、スマートフォンに小さなLinuxシステムを用意する無料のアプリです。セットアップには、MarinaraのAndroidアプリを使う方法(いちばん簡単です)と、Termuxで手作業で進める方法があります。

## TermuxとF-Droidについて

MarinaraはネイティブのAndroidアプリではなくLinuxのサーバーなので、動かすにはTermuxが必要です。F-Droidは、無料でオープンソースのアプリストアです。Androidアプリのセットアップでは、Termuxの安定版F-Droidビルドをダウンロードします。Termuxには試験的なGoogle Playビルドもあります。すでにインストール済みならMarinaraはそれも受け付けますが、このガイドではF-Droidを推奨します。

Termuxは[Termux on F-Droid](https://f-droid.org/en/packages/com.termux/)からインストールします。署名が一致する必要があるため、Termuxやそのプラグインアプリを異なる配布元から混在させないでください。[Termuxの公式インストールノート](https://github.com/termux/termux-app#installation)を参照してください。

## Androidアプリでインストールする

Marinara EngineのAndroidアプリはTermuxを準備し、ローカルサーバーが動き出したらMarinaraを開きます。途中で、Androidからいくつかのシステム確認画面の承認を求められます。

1. [最新のAndroid APKをダウンロード](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk)をタップします。APKとは、Androidアプリのインストール用ファイルです。
2. APKをインストールし、アプリを開きます。
3. **Install / Start Marinara**(Marinaraのインストール/起動)をタップします。
4. Termuxが入っていない場合は、アプリがF-DroidからTermuxをインストールできるように、Androidのインストール確認を承認します。このアプリにアプリのインストールを許可する確認も含まれます。
5. Androidから求められたら、**Run commands in Termux environment**(Termux環境でコマンドを実行)の権限を許可します。
6. Termuxがセットアップを止めた場合は、アプリが`allow-external-apps`のコマンドをコピーしてTermuxを開きます。Termuxの画面を長押しして**Paste**(貼り付け)をタップし、Enterキーを押します。それからアプリに戻り、もう一度**Install / Start Marinara**をタップします。
7. Termuxが依存関係(アプリに必要な部品)をインストールし、Marinaraをビルドするまで待ちます。Termuxにはテキストが次々と流れるように表示されます。最初のビルドには数分かかります。
8. Termuxの処理が終わったらMarinara Engineアプリに戻ります。サーバーの準備ができると、アプリが自動的に接続してサインインし、Marinaraのホーム画面が表示されます。

代わりにブラウザーを使う場合は、アプリのランチャーで**Open in browser**(ブラウザーで開く)を選びます。アプリはこの選択を記憶し、ブラウザーでも自動的にサインインします。

うまくいかなかった場合: 止まる原因になった確認画面を解決してから、もう一度**Install / Start Marinara**をタップします。アプリがlocalhostを開けない場合は、APKをアップデートして**Install / Start Marinara**をタップします。[Androidのlocalhostログインのヘルプ](../TROUBLESHOOTING.md#android-localhost-opens-the-login-page-or-returns-401503)を参照してください。

アプリには、署名キー、パスワード、`CSRF_TRUSTED_ORIGINS`の変更は必要ありません。非公開のlocalhost認証情報は、アプリが自分で作成します。`CSRF_TRUSTED_ORIGINS`に`null`を追加しないでください。

## Termuxで手動インストールする

アプリを使いたくない場合は、この方法を使います。Termuxを開き、画面を長押しして**Paste**(貼り付け)をタップし、次のコマンドを貼り付けます(全体をコピーしてください)。

```bash
pkg upgrade -y && pkg install -y git nodejs-lts && \
([ -d "$HOME/Marinara-Engine/.git" ] || \
  git clone https://github.com/Pasta-Devs/Marinara-Engine.git "$HOME/Marinara-Engine") && \
cd "$HOME/Marinara-Engine" && chmod +x start-termux.sh && ./start-termux.sh
```

このコマンドは、次の処理を順に行います。

1. Termuxのすべてのパッケージをアップグレードします。新しいNode.jsは古いTermuxのライブラリーでは起動できないため、Termux全体のアップグレードが必要です。設定ファイルを残すかどうか聞かれたら、Enterキーを押して今の設定ファイルを残してください。
2. GitとNode.jsをインストールします。MarinaraはNode.js 24、25、26に対応しています。
3. Marinaraがまだなければダウンロードします。
4. 起動スクリプト(`start-termux.sh`)を実行できる状態にして、実行します。

起動スクリプトは、依存関係をインストールし、デバイス上でMarinaraをビルドして、ローカルサーバーを起動します。Node.jsのバージョンが古すぎるときはアップグレードします。初回は時間がかかり、Termuxにはテキストが次々と流れるように表示されます。2回目以降は速くなります。

サーバーが動いていると表示されたら、Androidのブラウザーで次のアドレスを開きます。

```text
http://127.0.0.1:7860
```

別の`PORT`を設定した場合は、その番号を使います。アプリのようなアイコンが欲しいときは、ブラウザーのメニューにある、ページをホーム画面に追加する項目を使います。項目の名前はブラウザーによって違います。

## Marinaraの起動と停止

アプリを使っている場合は、アプリを開き、サーバーが停止していれば**Install / Start Marinara**(Marinaraのインストール/起動)をタップします。アプリとブラウザーを切り替えるには、ランチャーの**Open in browser**(ブラウザーで開く)を使ってから、**Retry connection**(接続を再試行)を使います。アプリ内からは、**Settings → General → App Behavior → Open Android launcher (app or browser)**(設定 → 一般 → アプリの動作 → Androidランチャーを開く(アプリまたはブラウザー))でランチャーに戻れます。

手動でインストールした場合は、Termuxを開いて次を実行します。

```bash
cd Marinara-Engine
./start-termux.sh
```

サーバーを停止するには、Termuxで<kbd>Ctrl</kbd>+<kbd>C</kbd>を押します。

## Marinaraのアップデート

`./start-termux.sh`を実行するたびに、起動スクリプトはGitHubで新しいバージョンを確認し、アップデートしてから起動します。アップデートせずに起動するには、`--skip-update`を付けます。そのほかのオプションとAPKのアップデート手順は、[Marinara Engineのアップデート](../UPGRADING.md#android-termux)を参照してください。

起動スクリプトは、アップデートのときにローカルのpnpmキャッシュから使われていないパッケージも削除します。これで、古いリリースがストレージを数ギガバイトも埋めてしまうのを防ぎます。チャットや設定には影響しません。

## 別のデバイスからMarinaraを開く

起動スクリプトは、同じWi-Fi上のほかのデバイスからもMarinaraに届くようにしますが、ログインを設定するまでそれらのデバイスをブロックします。[よくある質問](../FAQ.md#how-do-i-access-marinara-engine-from-my-phone-or-another-device)と[リモートアクセス](../REMOTE_ACCESS.md)を参照してください。

アップデート後に別のデバイスからサインインできない場合は、[アップデート後にログインできなくなった場合](../REMOTE_ACCESS.md#locked-out-after-updating)を参照してください。Termuxで次のコマンドを実行すると、アプリのログインが削除され、すべてのブラウザーがサインアウトされます。

```bash
cd "$HOME/Marinara-Engine" && node scripts/reset-login.mjs
```

## 関連ガイド

- [Marinara Engineのインストール](../INSTALLATION.md)
- [iOS / iPadOS PWAガイド](ios-pwa.md)
- [Marinara Engineのアップデート](../UPGRADING.md)
- [よくある質問](../FAQ.md)
