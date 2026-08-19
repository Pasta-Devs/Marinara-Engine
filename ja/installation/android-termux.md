# Android(Termux)インストールガイド

このガイドでは、AndroidのスマートフォンやタブレットでMarinara Engineを動かす方法を説明します。MarinaraはAndroid向けの無料のLinux環境であるTermuxの中で動きます。Androidアプリを使った簡単な方法と、Termuxのターミナルで手作業で進める方法があります。

## TermuxとF-Droidとは

Termuxは、スマートフォンに小さなLinuxシステムとコマンドラインを用意する無料のアプリです。MarinaraはネイティブのAndroidアプリではなくLinuxのサーバーなので、Marinara EngineにはTermuxが必要です。

F-Droidは、Android向けの無料でオープンソースのアプリストアです。Marinaraの自動設定では、Termuxの安定版F-Droidビルドをダウンロードします。Termuxには別の試験的なGoogle Playビルドもあります。すでにインストール済みならMarinaraは公式の署名者を認識しますが、このガイドでは引き続きF-Droidを推奨します。

Termuxは[Termux on F-Droid](https://f-droid.org/en/packages/com.termux/)からインストールします。Termuxやそのプラグインアプリを異なる配布元から混在させないでください。署名が一致する必要があります。配布元ごとの詳細は[Termuxの公式インストールノート](https://github.com/termux/termux-app#installation)を参照してください。

## Androidアプリ(APK)でインストールする

いちばん簡単なのは、Marinara EngineのAndroidアプリを使う方法です。APKとは、Androidアプリのインストール用ファイルです。このアプリは小さな補助ツールで、Termuxの準備を代行し、ローカルサーバーが動き出したらMarinaraを開きます。実際の処理はTermuxが担当するため、Androidからいくつかのシステム確認画面が表示されます。ビルド済みAPKのインストールに、署名キー、パスワード、ローカルアクセス用シークレット、`CSRF_TRUSTED_ORIGINS`の変更は必要ありません。アプリが非公開のlocalhost認証情報を自動で生成し、受け渡します。`CSRF_TRUSTED_ORIGINS`に`null`を追加しないでください。意図的に未設定として扱われ、APKのハンドシェイクには不要です。

1. [最新のAndroid APKをダウンロード](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk)をタップします。
2. APKをインストールし、アプリを開きます。
3. **Install / Start Marinara**(Marinaraのインストール/起動)をタップします。
4. Termuxがまだ入っていない場合は、Androidのインストール確認を許可します。これでアプリがF-DroidからTermuxをダウンロードしてインストールできます。
5. Androidから求められたら、**Run commands in Termux environment**(Termux環境でコマンドを実行)の権限を許可します。
6. Termuxが準備を止めてしまう場合は、アプリが`allow-external-apps`のコマンドをコピーしてくれます。そのコマンドをTermuxに1回貼り付けて実行し、もう一度**Install / Start Marinara**をタップします。
7. Termuxが依存関係をインストールし、Marinaraをビルドするまで待ちます。最初のビルドには数分かかります。
8. Termuxの処理が終わったらMarinara Engineアプリに戻ります。ローカルサーバーの準備ができると、アプリが自動的に接続してログインします。

普通のアプリと同じようにホーム画面のアイコンからMarinaraを開きたい場合も、このAndroidアプリが対応しています。ただしTermuxのサーバーを包む仕組みなので、先にサーバーの準備が必要です。Androidのインストール確認や権限の確認を省くことはできませんが、Marinaraのインストール用シークレットを設定するよう求められることはありません。

## Termuxで手動インストールする

アプリを使いたくない場合は、手作業でMarinaraをインストールできます。Termuxを開き、次の1つのコマンドを貼り付けます。

```
pkg update -y && pkg install -y git nodejs-lts && ([ -d "$HOME/Marinara-Engine/.git" ] || git clone https://github.com/Pasta-Devs/Marinara-Engine.git "$HOME/Marinara-Engine") && cd "$HOME/Marinara-Engine" && chmod +x start-termux.sh && ./start-termux.sh
```

この1つのコマンドは、5つの処理をまとめて行います。

1. Termuxのパッケージを更新します。
2. GitとNode.jsをインストールします。MarinaraはNode.jsのバージョン24、25、26に対応しています。
3. Marinara Engineをダウンロードします(すでにインストール済みなら何もしません)。
4. 起動スクリプト(`start-termux.sh`)を実行できる状態にします。
5. 起動スクリプトを初めて実行します。

起動スクリプトは、アプリの依存関係をインストールし、デバイス上でMarinaraをビルドして、ローカルサーバーを起動します。Node.jsのバージョンが古すぎるときはアップデートも行います。初回はアプリのビルドがあるため時間がかかりますが、2回目以降はずっと速くなります。

処理が終わったら、Androidのブラウザーで次のアドレスを開きます。

```
http://127.0.0.1:7860
```

Marinaraは`PORT`(アプリが使うネットワークのポート)で指定したポートで待ち受けます。デフォルトは7860です。別の`PORT`を設定した場合は、その番号を使います。

ヒント: アプリのようなアイコンが欲しいときは、ブラウザーのメニューを開き、Marinaraをホーム画面に追加する項目を選びます。メニューの名前はブラウザーによって違います。

## Marinaraを次回以降に起動する

最初の準備が済めば、インストールをやり直す必要はありません。Termuxを開いて次を実行します。

```
cd Marinara-Engine
./start-termux.sh
```

起動スクリプトはアップデートを確認してからMarinaraを起動します。GitHubを確認せずに手元のバージョンをそのまま起動したいときは、`--skip-update`を付けます。

```
cd Marinara-Engine
./start-termux.sh --skip-update
```

起動スクリプトは、依存関係のアップデート時にローカルのpnpmキャッシュから参照されていないパッケージも削除します。古いリリースが数ギガバイト分たまるのを防ぐためで、Marinaraのチャットや設定などのデータには影響しません。

## 別のデバイスからアクセスする

デフォルトでは、起動スクリプトはMarinaraをローカルネットワークからアクセスできる状態にします。つまり、同じWi-Fiにつないだラップトップや別のスマートフォンからも開けます。正しいアドレスを調べる手順は、[よくある質問](../FAQ.md)を参照してください。

## アップデート

起動スクリプト(`./start-termux.sh`)を実行するたびに、GitHubで新しいバージョンを確認し、アップデートしてから起動します。つまり、いつもどおりMarinaraを起動するだけで最新の状態を保てます。

アップデートせずにインストール済みのバージョンを起動したいときは、スキップ用のフラグを使います。

```
./start-termux.sh --skip-update
```

起動のたびにEngineのバージョンを固定したい場合は、プロジェクトの`.env`に`AUTO_UPDATE_ENABLED=false`を追加します。手動のアップデートコマンドや**Settings → Advanced → Updates**は、この設定では無効になりません。

アップデートの確認はアプリの中でもできます。**Settings**(設定)を開き、**Advanced**タブに移動して、**Updates**セクションを開きます。**Check for Updates**をクリックすると、新しいリリースがあるかどうかがわかります。アプリ内の**Apply Update**ボタンはデフォルトでオフになっていて、別途設定が必要です。有効にする方法と使い方は、[Marinara Engineのアップデート](../UPGRADING.md)を参照してください。

## 関連ガイド

- [Marinara Engineのインストール](../INSTALLATION.md)
- [iOS / iPadOS PWAガイド](ios-pwa.md)
- [Marinara Engineのアップデート](../UPGRADING.md)
- [よくある質問](../FAQ.md)
