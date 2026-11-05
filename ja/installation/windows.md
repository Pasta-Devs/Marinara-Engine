# Windowsインストールガイド

インストーラー(手順がもっとも少ない方法)またはソースから、WindowsのPCにMarinara Engineをインストールします。インストール後、Marinaraは自分のPCで動きます。

## 始める前に

Windows 10またはWindows 11(64ビット)、数ギガバイトのディスクの空き容量、インストール中のインターネット接続が必要です。インストーラーは約2.5 GBの空き容量を推奨しています。

次の2つのツールも必要です。

- **Node.js**のバージョン24、25、26のいずれか。Node.jsがアプリを動かします。推奨はLTS(Long Term Support)版のバージョン24です。
- **Git**。Gitはコードをダウンロードし、Marinaraが自分自身をアップデートできるようにします。

インストーラーを使う場合は、これらをインストールする必要はありません。インストーラーが両方を取得します。ソースからインストールする場合は、自分でインストールします。pnpm(アプリの構成部品をインストールするツール)をインストールする必要はありません。インストーラーと`start.bat`が用意します。

## Windowsインストーラーでインストールする

1. [Marinara Engineのリリースページ](https://github.com/Pasta-Devs/Marinara-Engine/releases)を開きます。
2. 最新のWindowsインストーラーをダウンロードします。ファイル名は`Marinara-Engine-Installer-`のあとにバージョンが続く形です。
3. インストーラーを実行します。Windowsに「Windows protected your PC」と表示された場合は、**More info**(詳細情報)、続いて**Run anyway**(実行)を選びます。ただし、これはリリースページから入手したファイルの場合に限ります。
4. 画面の指示に従って進めます。Node.jsやGitが見つからない場合は、インストーラーにインストールさせます。
5. インストール先のフォルダーを選ぶか、デフォルト(`%LOCALAPPDATA%\Marinara-Engine`)のまま進めます。
6. インストーラーがアプリをダウンロードしてビルドするのを待ちます。進行状況の一覧に各手順が表示されます。数分かかります。
7. インストールの完了が表示されたら、デスクトップの**Marinara Engine**ショートカットをダブルクリックします。

コンソールウィンドウ(黒い文字表示のウィンドウ)が開き、進行状況を表示します。その後、ブラウザーでMarinaraが開きます。開かない場合は、`http://127.0.0.1:7860`にアクセスします。

インストーラーは、最新の安定版リリースをGitのコピーとして用意します。そのため、Marinaraは起動のたびに自分自身をアップデートできます。

> **Tip:** インストーラーがNode.jsとGitをダウンロードするため、ウイルス対策ソフトによってはインストーラーを警告の対象にします。インストーラーは、上のリリースページから入手した場合にだけ実行してください。

## Marinaraの起動と停止

- **起動:** デスクトップのショートカットかスタートメニューの項目をダブルクリックします。ソースからインストールした場合は、Marinaraのフォルダーで`start.bat`を実行します。
- **停止:** ショートカットはコンソールウィンドウを開きます。そのウィンドウで<kbd>Ctrl</kbd>+<kbd>C</kbd>を押します。

Marinaraがすでに動いている場合、ショートカットはブラウザーでMarinaraを開き直します。

## ソースからインストールする

コマンドを自分で実行したい場合や、staging(テスター向け)版を使いたい場合は、この方法を使います。

1. [Node.js](https://nodejs.org/en/download)と[Git for Windows](https://git-scm.com/download/win)をインストールします。
2. 新しいコマンドプロンプトのウィンドウ(コマンドを入力する文字表示のウィンドウ)を開きます。
3. 両方のツールを確認します。`node -v`では、バージョン24、25、26のいずれかが表示される必要があります。

   ```bat
   node -v
   git --version
   ```

   コマンドが見つからない場合は、コマンドプロンプトを閉じて開き直すか、足りないツールをインストールし直してください。

4. コードをダウンロードします。

   ```bat
   git clone https://github.com/Pasta-Devs/Marinara-Engine.git
   ```

5. そのフォルダーに移動します。

   ```bat
   cd Marinara-Engine
   ```

6. 任意: 最初の起動の前にstaging版に切り替えます。安定版を使う場合は、この手順を飛ばしてください。stagingを使う前には、データをバックアップしてください。

   ```bat
   git checkout staging
   ```

   以後のアップデートでも、ランチャーはstagingのまま維持します。

7. ランチャー(Marinaraをセットアップして起動するスクリプト)を実行します。

   ```bat
   start.bat
   ```

最初の起動では、すべてをインストールしてビルドするため数分かかります。コンソールウィンドウに進行状況が表示されます。準備ができると、ブラウザーでMarinaraが開きます。あとでもう一度起動するときは、同じフォルダーで`start.bat`を実行します。

うまくいかなかった場合: `[ERROR] Node.js 24 LTS or newer is required`は、Node.jsが古すぎることを意味します。[nodejs.org](https://nodejs.org)からNode.js 24以降をインストールしてから、もう一度`start.bat`を実行します。

### ランチャーを使わない手動セットアップ

この方法には`pnpm`コマンドが必要です。次のコマンドは`Marinara-Engine`フォルダーの中で実行します。

1. pnpmを一度だけインストールします。

   ```bat
   npm install -g pnpm
   ```

2. 依存関係(アプリが必要とする部品)をインストールし、アプリをビルドして、サーバーを起動します。

   ```bat
   pnpm install --force
   pnpm build
   pnpm start
   ```

3. `http://127.0.0.1:7860`を開きます。

`pnpm start`では、このPCからしかMarinaraに接続できません。ほかのデバイスから接続できるようにするには、`Marinara-Engine`フォルダーに`.env`という名前のファイルを作り、次の行を追加してサーバーを再起動します。

```env
HOST=0.0.0.0
```

## 別のデバイスからMarinaraを開く

インストーラー、そのショートカット、`start.bat`では、ネットワーク上のほかのデバイスからMarinaraに届くようになります。ただし、ログインを設定するまで、Marinaraはそれらのデバイスからの接続をブロックします。手順は[リモートアクセス](../REMOTE_ACCESS.md)と[FAQ](../FAQ.md#how-do-i-access-marinara-engine-from-my-phone-or-another-device)を参照してください。

## Marinaraをアップデートする

ショートカットか`start.bat`からMarinaraを起動するたびに、ランチャーはアップデートを確認してインストールし、ビルドし直してから起動します。チャット、キャラクター、設定はそのまま残ります。自分でコードを変更していた場合、ランチャーはその変更をいったん退避し、アップデート後に元に戻します。退避できない場合は、今のバージョンのままにして、その旨を表示します。アプリ内の**Apply Update**(アップデートの適用)ボタン、アップデートを飛ばす方法、手動のコマンドについては、[Marinara Engineのアップデート](../UPGRADING.md#windows)を参照してください。

## データの場所とアンインストール

データは、Marinaraのフォルダーの中の`packages\server\data`フォルダーにあります。アンインストールするには、スタートメニューの**Uninstall Marinara Engine**(Marinara Engineのアンインストール)を開きます。アンインストーラーは、データも削除するかどうかを尋ねます。あとで再インストールするためにデータを残すには、**No**(いいえ)を選びます。[Marinaraのバックアップと復元](../data/backup-and-restore.md)を参照してください。

## 任意: AIによるスプライトの背景除去

Marinaraは、生成するスプライトに透過した背景を要求し、単色の背景は自分で取り除きます。細かい風景の背景に対する予備の手段として、任意の`backgroundremover`ツールをインストールできます。大きな機械学習ファイルをダウンロードするため、デフォルトではオフです。

1. [python.org](https://www.python.org/downloads/windows/)からPython 3.11をインストールします。Python 3.9から3.11までが動作します。
2. `Marinara-Engine`フォルダーで次のコマンドを実行します。

   ```bat
   pnpm backgroundremover:install
   ```

これで、データフォルダーの下に専用のPythonフォルダー(venv)が作られます。Marinaraはこれを自動的に使います。

次回の起動時に`start.bat`にインストールさせるには、`.env`ファイルに次の行を追加します。

```env
BACKGROUNDREMOVER_AUTO_INSTALL=true
```

## うまくいかないときは

Node.jsがバージョン24、25、26のいずれかであることと、Gitがインストールされていることを確認してください。ほかの対処法は、[Marinara Engineのトラブルシューティング](../TROUBLESHOOTING.md)を参照してください。

## 関連ガイド

- [Marinara Engineのインストール](../INSTALLATION.md)
- [Marinara Engineのアップデート](../UPGRADING.md)
- [Marinara Engineのトラブルシューティング](../TROUBLESHOOTING.md)
- [よくある質問](../FAQ.md)
