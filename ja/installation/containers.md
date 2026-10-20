# コンテナーでの実行(Docker / Podman)

このガイドでは、DockerまたはPodmanを使ってMarinara Engineをコンテナーで動かす方法を説明します。コンテナーとは、アプリと動作に必要なものを一式にまとめたパッケージです。Node.jsなどのツールをコンピューターに個別にインストールする必要はありません。初めて試す場合や、とにかくMarinaraを動かしてみたい場合は、これがいちばん簡単な方法です。

## 事前に必要なもの

始める前に、Marinaraを動かすコンピューターに次のどちらかをインストールします。

- Docker Desktop(WindowsまたはmacOS)、あるいはDocker Engine(Linux)。Dockerはもっとも広く使われているコンテナーツールです。
- もしくはPodman。PodmanはDockerをそのまま置き換えられるツールです。常駐サービスなしで動作し、root権限がなくても問題なく使えます。

以下で使う用語をいくつか説明します。

- **イメージ**: Marinara Engineが入った、ダウンロード可能な読み取り専用のテンプレートです。イメージを実行すると、動作中のコンテナーが作られます。
- **ボリューム**: コンテナーツールが管理する保存領域です。ボリュームを使うと、コンテナーを削除して作り直してもデータが残ります。
- **LAN**: ローカルネットワークのことです。自宅や職場のWi-Fi、または有線でつながったネットワークを指します。

公式のMarinaraイメージは`ghcr.io/pasta-devs/marinara-engine`で公開しています。

## イメージの取得と実行

リポジトリーのルートには、そのまま使える`docker-compose.yml`が入っています。Composeはこのファイルを読み込んでコンテナーを起動します。Marinaraを動かす方法としては、これをおすすめします。

1. リポジトリーを手元に用意します。Marinara Engineのチェックアウトがすでにあれば、そのフォルダーでターミナルを開きます。ない場合は、まずクローンします。

```bash
git clone https://github.com/Pasta-Devs/Marinara-Engine.git
```

2. フォルダーに移動します。

```bash
cd Marinara-Engine
```

3. コンテナーを常駐モードで起動します。

```bash
docker compose up -d
```

`docker-compose.yml`は`ghcr.io/pasta-devs/marinara-engine:latest`イメージを使う設定になっており、このコマンドを初めて実行したときにイメージをダウンロードします。最初のダウンロードには数分かかることがあります。

## 動作の確認

1. ブラウザーを開きます。
2. 次のアドレスにアクセスします。

```text
http://127.0.0.1:7860
```

Marinara Engineのホーム画面が表示されれば、コンテナーは正常に動いています。`127.0.0.1`は「このコンピューター自身」を指すアドレスで、`7860`はMarinaraが待ち受けるデフォルトのポート番号です。

ページが表示されない場合は、後半の「トラブルシューティング」を参照してください。

## データの保存場所

チャット、キャラクター、アップロードしたファイル、フォント、デフォルトの背景といったデータは、通常のファイルとして保存します。Marinaraはファイルベースのストレージを使うため、データは1つのデータベースファイルの中ではなく、普通のファイルとして置かれます。Composeはこれらのファイルを`marinara-data`という名前付きボリュームに保管します。

Composeはボリューム名の先頭にプロジェクトフォルダー名を付けるので、実際のボリューム名は`PROJECT_marinara-data`のような形になります。手元の環境での正確な名前は、ボリュームの一覧で確認できます。

```bash
docker volume ls --filter name=marinara-data
```

一覧に出てきたボリュームを調べると、保存場所がわかります。

```bash
docker volume inspect PROJECT_marinara-data
```

`PROJECT_marinara-data`は、前のコマンドが表示した名前に置き換えてください。

コンテナーは起動のたびにデータフォルダーを準備します。デフォルトではrootとして起動し、アプリが書き込めるようにフォルダーの所有権を直してから、安全のためroot以外のユーザーに切り替えます。この修復は、名前付きボリュームでも、ホスト側からマウントしたフォルダーでも動作します。そのため、以前の構成からファイルベースのストレージへ移行するときも、所有権を変更するコマンドを手作業で実行する必要はありません。

Marinaraは初回起動時に、ボリューム内の`/app/data/.env`に空の設定ファイルも作成します。サーバーの設定は、後からこのファイルに書き足せます。ボリュームの中にあるため、コンテナーを再起動してもイメージをアップデートしても設定は残ります。設定できる項目の一覧は[サーバー設定リファレンス](../CONFIGURATION.md)を参照してください。

## LANへの公開

デフォルトでは、Composeは同じコンピューターからのアクセスだけを許可します。これは安全な初期状態です。スマートフォンやネットワーク上の別のコンピューターからMarinaraを開きたい場合は、2つの作業が必要です。ポートマッピングを変更することと、第三者がアクセスできないようにログインを有効にすることです。

Basic Authは、ユーザー名とパスワードの入力を求めてアプリを保護する仕組みです。これを設定せずにMarinaraをネットワークへ公開しないでください。

1. `docker-compose.yml`をテキストエディターで開きます。

2. ポートの行を探します。次のような行です。

```yaml
ports:
  - "127.0.0.1:${PORT:-7860}:7860"
```

3. 他のデバイスからアクセスできるように、`127.0.0.1:`の部分を削除します。

```yaml
ports:
  - "${PORT:-7860}:7860"
```

4. 同じファイルの`environment:`の一覧に、ログイン情報と管理用のシークレットを追加します。値は自分で決めたものを使ってください。

```yaml
environment:
  - BASIC_AUTH_USER=yourname
  - BASIC_AUTH_PASS=a-long-random-password
  - ADMIN_SECRET=another-long-random-value
```

5. ファイルを保存し、コンテナーを再起動します。

```bash
docker compose up -d
```

これで、`PORT`を設定していない場合は、ネットワーク上の他のデバイスから`http://YOUR_COMPUTER_IP:7860`でMarinaraにアクセスできます。`PORT`を設定した場合は、`7860`をそのホストポートに置き換えます。アクセスするには、設定したユーザー名とパスワードの入力が必要です。

Docker Desktop、OrbStack、rootless Dockerでは、自分のブラウザーも含め、どのデバイスも同じアドレスからコンテナーに接続します。そのため、ログインを設定すると、このコンピューターでもログインを求められ、IP許可リストではデバイスを区別できません。ログインを設定せずに`127.0.0.1:`を外さないでください。これらのランタイムでは、Marinaraはほかのデバイスとこのコンピューターを区別できません。特定のデバイスだけを許可する方法や、管理用シークレットの役割については[リモートアクセス: Basic AuthとIP許可リスト](../REMOTE_ACCESS.md)を参照してください。

## イメージの選び方: latest、staging、lite

Marinaraは複数のイメージタグを公開しています。用途に合うものを選んでください。

- `latest`は安定版のリリースで、これをおすすめします。`docker-compose.yml`もデフォルトでこのタグを使います。
- `X.Y.Z`は`ghcr.io/pasta-devs/marinara-engine:2.0.6`のようにバージョンを固定したタグです。特定のリリースに固定したいときに使います。
- `staging`は開発中のコードから作られる不安定なテストビルドです。未リリースの変更を試すときだけ使ってください。動かなくなることがあり、告知なく挙動が変わることもあり、安定版へデータを戻せない場合もあります。
- `lite`はサイズの小さいイメージです。詳しくは次の節で説明します。

`staging`イメージを動かす場合は、不安定なビルドが安定版のデータを壊さないように、別のボリュームを使ってください。

```bash
docker run -d --name marinara-staging -p 127.0.0.1:7860:7860 -v marinara-staging-data:/app/data ghcr.io/pasta-devs/marinara-engine:staging
```

### liteイメージ

liteイメージは、一部のオフライン機能を省く代わりに、ダウンロードサイズを大幅に小さくした派生版です。コンテナー向けの最小構成のLinuxベースであるWolfiの上に作られています。

liteイメージでは、大きなローカルファイルを必要とする機能を省いています。

| liteで省かれるもの | 使えなくなること |
| --- | --- |
| ローカルモデル(Gemma、手元のコンピューターで動作) | AIモデルを自分のハードウェアで動かせません。 |
| ローカル埋め込みモデル | デバイス上でのテキスト埋め込みができません。 |
| Memory Recall(意味検索) | ローカル埋め込みモデルに依存しています。 |
| ローカルのWhisper音声入力 | Conversationの通話での音声認識が使えなくなります。 |
| アバターの気分の読み取り | 2D Avatarsと3D Avatarsは、小さなローカルの感情モデルではなく、単語の一覧から表情を選びます。 |

それ以外はこれまでどおり動きます。チャット、Roleplay、Game Mode、エージェント、ロアブック、キャラクター、リモートのAIプロバイダーへの接続はすべて同じです。liteイメージでAIの機能を使うには、外部のプロバイダー(OpenRouterやOpenAI、自分で立てたモデルなど)に接続する必要があります。[AIプロバイダーへの接続](../connections/connecting-to-a-provider.md)を参照してください。

liteのタグは`ghcr.io/pasta-devs/marinara-engine:lite`です。各リリースでは、`ghcr.io/pasta-devs/marinara-engine:X.Y.Z-lite`のようにバージョンを固定したliteタグも公開しています。実行するコマンドは次のとおりです。

```bash
docker run -d --name marinara-lite -p 127.0.0.1:7860:7860 -v marinara-data:/app/data ghcr.io/pasta-devs/marinara-engine:lite
```

古いliteイメージには、Raspberry Pi 4のようなARM系のコンピューターで異常終了するものがあります。このとき、AIプロバイダーへの通信中にプロセッサーからの不正命令エラーである`SIGILL`が表示されます。こうしたデバイスを使う場合は、通常の`latest`イメージを使ってください。最新の情報は[Marinara Engineのトラブルシューティング](../TROUBLESHOOTING.md)を参照してください。

## アップデート

コンテナーイメージは自動ではアップデートされません。新しいイメージを取得し、手作業でコンテナーを再起動します。元の状態にそのまま戻れるように、先にバックアップを作成してください。[Marinaraのバックアップと復元](../data/backup-and-restore.md)を参照してください。

Docker Composeでは、次の1つのコマンドを実行します。

```bash
docker compose pull && docker compose up -d
```

Podman Composeでは、次の1つのコマンドを実行します。

```bash
podman compose pull && podman compose up -d
```

バージョンはアプリの中でも確認できます。**Settings**(設定)を開き、**Advanced**タブの**Updates**セクションを表示して、**Check for Updates**(アップデートの確認)をクリックします。コンテナーで動かしている場合、MarinaraはDocker上で動作していることを検出し、リリース版のイメージタグとホストで実行するコマンドを表示します。ブラウザーの中からアップデートを適用することはできないので、上のコマンドはホスト側で実行してください。

古いリリースに戻すには、`docker-compose.yml`の`image:`行にそのバージョンのタグ(たとえば`ghcr.io/pasta-devs/marinara-engine:2.5.0`)を指定してから、`docker compose up -d`を実行します。2.5.0には戻すことができ、チャットも通常どおり開けますが、新しい機能が追加した設定やゲームのデータは2.5.0には認識できません。2.5.0が保存したチャットや接続からはそのデータが失われ、もう一度アップデートしても戻りません。[2.5.0に戻す](../UPGRADING.md#going-back-to-250)を参照してください。

## Podman

PodmanはDockerと同じイメージを実行できます。多くの場合、上のコマンドの`docker`を`podman`に置き換えるだけで動きます。

Composeで起動するコマンドは次のとおりです。

```bash
podman compose up -d
```

Composeを使わずにコンテナーを1つだけ実行するコマンドは次のとおりです。

```bash
podman run -d -p 127.0.0.1:7860:7860 -v marinara-data:/app/data ghcr.io/pasta-devs/marinara-engine:latest
```

`podman compose`コマンドには`podman-compose`ヘルパーが必要です。使っているシステムに合わせたコマンドでインストールしてください。

Fedoraでは次のコマンドを実行します。

```bash
sudo dnf install podman-compose
```

DebianまたはUbuntuでは次のコマンドを実行します。

```bash
sudo apt install podman-compose
```

pipを使う場合は次のコマンドです。

```bash
pip install podman-compose
```

## イメージの自前ビルド

ダウンロードせずに、ソースからイメージをビルドしたい場合は次のコマンドを実行します。

```bash
docker build -t marinara-engine .
```

ビルドしたイメージは次のコマンドで実行します。

```bash
docker run -d -p 127.0.0.1:7860:7860 -v marinara-data:/app/data marinara-engine
```

liteイメージをソースからビルドするときは、lite用のビルドファイルをDockerに指定します。

```bash
docker build -f Dockerfile.lite -t marinara-engine:lite .
```

## トラブルシューティング

**ページが表示されない、またはポートがすでに使われている。** 別のプログラムが`7860`番ポートを使っている可能性があります。`ports:`の一覧で、`8080:7860`のように空いているポートへマッピングを変更してください。その後`docker compose up -d`で再起動し、`http://127.0.0.1:8080`を開きます。

**Marinaraがファイルを書き込めない、または権限エラーが表示される。** コンテナーは起動のたびにデータフォルダーの所有権を直します。これは名前付きボリュームでも、ホスト側からマウントしたフォルダーでも動作します。ただしホストのファイルシステムによっては修復に失敗することがあり、`MARINARA_SKIP_DATA_CHOWN=true`を設定した場合は修復そのものを行いません。エラーが続くときは、デフォルトの`marinara-data`名前付きボリュームを使ってください。これがもっとも確実です。

**liteイメージがRaspberry Pi 4で異常終了する。** 上のliteイメージの注意を参照してください。このハードウェアでは通常の`latest`イメージを使ってください。

さらに詳しい情報は[Marinara Engineのトラブルシューティング](../TROUBLESHOOTING.md)を参照してください。

## 関連ガイド

- [サーバー設定リファレンス](../CONFIGURATION.md)
- [リモートアクセス: Basic AuthとIP許可リスト](../REMOTE_ACCESS.md)
- [Marinara Engineのトラブルシューティング](../TROUBLESHOOTING.md)
