# macOS / Linuxインストールガイド

MacまたはLinuxのコンピューターにMarinara Engineをインストールし、`start.sh`ランチャーで起動します。インストール後、Marinaraは自分のコンピューターで動きます。

## 始める前に

次の2つのツールが必要です。

- **Node.js**のバージョン24、25、26のいずれか。Node.jsがMarinaraを動かします。推奨はLTS(Long Term Support)版のバージョン24です。
- **Git**。GitはMarinaraをダウンロードし、アップデートを取得します。

pnpm(アプリの構成部品をインストールするツール)をインストールする必要はありません。ランチャーが適切なバージョンを用意します。

### macOSでNode.jsとGitをインストールする

Homebrewを使う場合は、1つのコマンドで両方をインストールできます。

```bash
brew install node git
```

Homebrewを使わない場合は、[nodejs.org](https://nodejs.org)からNode.jsのインストーラーをダウンロードします。そのあと、Xcodeのコマンドラインツールを使ってGitをインストールします。

```bash
xcode-select --install
```

### LinuxでNode.jsとGitをインストールする

パッケージマネージャーを使います。UbuntuやDebianでは、標準のNode.jsがバージョン24より古いことが多いため、先にNodeSourceのリリースを追加します。

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo bash -
sudo apt install -y nodejs git
```

Fedoraでは次のとおりです。

```bash
sudo dnf install -y nodejs git
```

Archでは次のとおりです。

```bash
sudo pacman -S nodejs npm git
```

### ツールを確認する

```bash
node -v
git --version
```

`node -v`では、`v24`以上が表示される必要があります。どちらかのコマンドで「command not found」と表示された場合は、そのツールが正しくインストールされていません。

## Marinaraをインストールして起動する

1. ターミナル(コマンドを入力するウィンドウ)を開きます。Macでは、<kbd>Cmd</kbd>+<kbd>Space</kbd>を押してTerminalと入力し、Enterキーを押します。Linuxでは、ターミナルのアプリを開きます。
2. Marinaraをダウンロードします。

   ```bash
   git clone https://github.com/Pasta-Devs/Marinara-Engine.git
   ```

3. できたフォルダーに移動します。

   ```bash
   cd Marinara-Engine
   ```

4. ランチャー(Marinaraをセットアップして起動するスクリプト)でMarinaraを起動します。

   ```bash
   ./start.sh
   ```

初回は、すべてをダウンロードしてビルドするため数分かかります。ターミナルに進行状況が表示され、そのあと`Press Ctrl+C to stop`と表示されます。ブラウザーで`http://127.0.0.1:7860`のMarinaraが開きます。ブラウザーが開かない場合は、自分でそのアドレスにアクセスします。

うまくいかなかった場合:

- `permission denied`: `chmod +x start.sh`を実行してから、もう一度`./start.sh`を実行します。
- `[ERROR] Node.js 24 LTS or newer is required`: Node.jsが古すぎます。新しいバージョンをインストールしてから、もう一度`./start.sh`を実行します。

## Marinaraの起動と停止

- **もう一度起動する:** Marinaraのフォルダーで`./start.sh`を実行します。Marinaraがすでに動いている場合は、ブラウザーでMarinaraを開き直します。
- **停止:** ターミナルで<kbd>Ctrl</kbd>+<kbd>C</kbd>を押します。

Gitでダウンロードしたコピーで`./start.sh`を実行するたびに、ランチャーは次の処理を行います。

1. 新しいバージョンがないか確認し、見つかればアップデートします。
2. Node.jsと適切なバージョンのpnpmを確認します。
3. 足りない部品をインストールし、コードが変わっていればアプリをビルドし直します。
4. サーバーを起動し、ブラウザーを開きます。

## ランチャーの設定を変える

ランチャーの設定は、Marinaraのフォルダーにある`.env`ファイルに書きます。`.env`ファイルは、1行に1つの設定を書くテキストファイルです。ランチャーがブラウザーを開かないようにするには、次の行を追加します。

```bash
AUTO_OPEN_BROWSER=false
```

`PORT`はポート(アドレスのコロンのあとの番号。デフォルトは7860)を設定します。ランチャーでは、ローカルネットワーク上のほかのデバイスからMarinaraに届くようになります。ただし、ログインを設定するまで、Marinaraはそれらのデバイスからの接続をブロックします。[リモートアクセス](../REMOTE_ACCESS.md)を参照してください。

## Marinaraをアップデートする

`./start.sh`を実行すると、最初にMarinaraがアップデートされます。チャット、キャラクター、設定はそのまま残ります。自分でコードを変更していた場合、ランチャーはその変更をいったん退避し、アップデート後に元に戻します。アップデートを飛ばす方法、アプリ内の**Apply Update**(アップデートの適用)ボタン、手動のコマンドについては、[Marinara Engineのアップデート](../UPGRADING.md#macos-and-linux)を参照してください。

## ランチャーを使わない手動セットアップ

ほとんどの場合はランチャーを使ってください。各手順を自分で実行するには、pnpmが必要です。Node.js 24には、pnpmを有効にするツールであるCorepackが含まれています。Node.js 25には含まれていません。

1. Node.js 24では、pnpmを有効にします。

   ```bash
   corepack enable pnpm
   ```

   Node.js 25または26では、先にCorepackをインストールします。

   ```bash
   npm install --global corepack
   corepack enable pnpm
   ```

2. Marinaraをダウンロードします。

   ```bash
   git clone https://github.com/Pasta-Devs/Marinara-Engine.git
   ```

3. そのフォルダーに移動します。

   ```bash
   cd Marinara-Engine
   ```

4. 部品をインストールし、アプリをビルドして、サーバーを起動します。

   ```bash
   pnpm install --force
   pnpm build
   pnpm start
   ```

5. `http://127.0.0.1:7860`を開きます。

`pnpm start`では、サーバーは自分のコンピューターからの接続だけを待ち受けます。ほかのデバイスから接続できるようにするには、`.env`に`HOST=0.0.0.0`を追加して再起動します。

## 任意: 背景除去ツール

Marinaraは、生成するスプライト(キャラクターの画像)に透過した背景を要求し、単色の背景は自分で取り除きます。細かい風景や影のある背景に対する予備の手段として、任意のAI背景除去ツールをインストールできます。このツールはPythonのvenv(Pythonのパッケージを入れる専用のフォルダー)を作り、PyTorch(機械学習ライブラリー)とU2Netモデル(画像の被写体を見つけるためのファイル)という大きなファイルをダウンロードします。

1. macOSでは、Python 3.11がもっとも安定して動きます。先にインストールしてください。Python 3.9から3.11までが動作します。

   ```bash
   brew install python@3.11
   ```

2. Marinaraのフォルダーで次のコマンドを実行します。

   ```bash
   pnpm backgroundremover:install
   ```

次回の起動時にランチャーにインストールさせるには、`.env`に次の行を追加します。

```bash
BACKGROUNDREMOVER_AUTO_INSTALL=true
```

## うまくいかないときは

一部のLinux環境では、`ERR_PNPM_ENAMETOOLONG`(ファイルパスが長すぎる)を含むエラーでインストールに失敗します。途中まで作られたフォルダーを削除し、もう一度ランチャーを実行します。

```bash
rm -rf node_modules .pnpm .pnpm-store
./start.sh
```

ほかの対処法は、[Marinara Engineのトラブルシューティング](../TROUBLESHOOTING.md)を参照してください。

## 関連ガイド

- [Marinara Engineのインストール](../INSTALLATION.md)
- [Marinara Engineのアップデート](../UPGRADING.md)
- [リモートアクセス: ログインとIP許可リスト](../REMOTE_ACCESS.md)
- [Marinara Engineのトラブルシューティング](../TROUBLESHOOTING.md)
