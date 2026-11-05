# コンテナーでの実行(Docker / Podman)

DockerまたはPodmanを使って、Marinara Engineをコンテナーで動かします。コンテナーとは、アプリと動作に必要なものを一式にまとめたパッケージです。そのため、Node.jsをインストールする必要はありません。できるだけ少ない準備でMarinaraを動かしたい場合は、ここから始めてください。

## 始める前に

Marinaraを動かすコンピューターに、次のどちらかをインストールします。

- Docker Desktop(WindowsまたはmacOS)、またはDocker Engine(Linux)。
- Podman。Dockerの代わりに使えるツールで、常駐サービスが不要で、root権限なしで動作します。

以下で使う用語は次のとおりです。

- **イメージ:** ダウンロードできる、読み取り専用のMarinaraのコピーです。イメージを実行すると、コンテナーが作られます。
- **ボリューム:** コンテナーツールが管理する保存領域です。コンテナーを削除して作り直しても、データが残ります。

公式のイメージは`ghcr.io/pasta-devs/marinara-engine`にあります。

<a id="start-marinara"></a>

## Marinaraを起動する

プロジェクトには、そのまま使える`docker-compose.yml`ファイルが入っています。Composeは、このファイルを読み込んでコンテナーを起動するDockerの機能です。この方法をおすすめします。

1. ターミナル(コマンドを入力するウィンドウ)を開きます。Marinaraのチェックアウトがすでにある場合は、そのフォルダーでターミナルを開き、次の2つの手順を飛ばしてください。
2. プロジェクトのファイルをダウンロードします。

   ```bash
   git clone https://github.com/Pasta-Devs/Marinara-Engine.git
   ```

3. できたフォルダーに移動します。

   ```bash
   cd Marinara-Engine
   ```

4. コンテナーをバックグラウンドで起動します。

   ```bash
   docker compose up -d
   ```

   初回は`ghcr.io/pasta-devs/marinara-engine:latest`イメージをダウンロードするため、数分かかることがあります。完了すると、ターミナルにコンテナーが`Started`と表示されます。

5. ブラウザーで`http://127.0.0.1:7860`を開きます。Marinaraのホーム画面が表示されます。

うまくいかなかった場合: 別のプログラムがポート`7860`を使っている可能性があります。`8080`など、空いているポートを選んでください。`docker-compose.yml`と同じフォルダーに`.env`という名前のファイルを作って`PORT=8080`という行を書き、もう一度`docker compose up -d`を実行します。Composeはこのファイルを毎回読み込むので、以後のアップデートでも新しいポートが保たれます。その後、`http://127.0.0.1:8080`を開きます。ほかの対処法は[トラブルシューティング](#troubleshooting)にあります。

## Marinaraを停止する

同じフォルダーで次のコマンドを実行します。コンテナーが停止して削除されます。データはボリュームに残ります。

```bash
docker compose down
```

Podmanでは`podman compose down`を使います。

## データの保存場所

Marinaraは、チャット、キャラクター、アップロードしたファイル、フォント、デフォルトの背景を、`marinara-data`という名前のComposeボリュームに通常のファイルとして保存します。Composeは名前の先頭にプロジェクトフォルダー名を付けるので、実際の名前は`PROJECT_marinara-data`のような形になります。正確な名前と保存場所は、次のコマンドで調べます。

```bash
docker volume ls --filter name=marinara-data
docker volume inspect PROJECT_marinara-data
```

`PROJECT_marinara-data`は、1つ目のコマンドが表示した名前に置き換えてください。

Marinaraは初回起動時に、ボリューム内の`/app/data/.env`に空の設定ファイルも作成します。サーバーの設定はここに追加してください。再起動やイメージのアップデートのあとも残ります。[サーバー設定リファレンス](../CONFIGURATION.md)を参照してください。

コンテナーは起動のたびに、アプリが書き込めるようにデータフォルダーの所有権を直します。rootとして起動して所有権を直し、そのあとroot以外のユーザーに切り替えます。これはボリュームでも、自分のコンピューターからマウントしたフォルダーでも動作します。

<a id="open-marinara-from-another-device"></a>

## 別のデバイスからMarinaraを開く

デフォルトでは、ComposeはこのコンピューターからだけMarinaraに接続できるようにします。スマートフォンや別のコンピューターで開くには、ポートをすべてのインターフェースで公開する必要があります。その前にログインを設定してください。ログインなしでMarinaraをネットワークに公開しないでください。

Docker Desktop、OrbStack、rootless Docker(rootなしで動かすDocker)では、どのデバイスも1つのゲートウェイアドレスとして見えます。ログインがないと、すべてのインターフェースで公開したポートから誰でも入れてしまいます。ログインを設定すると、このコンピューターでもログインを求められます。[TailscaleとDockerのバイパス](../REMOTE_ACCESS.md#tailscale-and-docker-bypass)を参照してください。

1. Marinaraのフォルダーにある`docker-compose.yml`を、テキストエディターで開きます。
2. `ports:`の一覧から`127.0.0.1:`を削除します。

   ```yaml
   ports:
     - "${PORT:-7860}:7860"
   ```

3. `environment:`の一覧に、管理者用シークレットを追加します。自分で決めた、長くランダムな値を使ってください。

   ```yaml
   environment:
     - ADMIN_SECRET=another-long-random-value
   ```

4. 同じ一覧に、ログインを追加します。自分のユーザー名と、長くランダムなパスワードを使ってください。

   ```yaml
   - BASIC_AUTH_USER=your-username
   - BASIC_AUTH_PASS=another-long-random-password
   ```

5. ファイルを保存し、コンテナーを再起動します。

   ```bash
   docker compose up -d
   ```

6. 別のデバイスで`http://YOUR_COMPUTER_IP:7860`を開きます。`PORT`を設定した場合は、そのポートを使います。ページでログインを求められます。

`BASIC_AUTH_USER`と`BASIC_AUTH_PASS`を省いた場合は、代わりに1回限りのセットアップコードを求められます。ログからコードを探し、新しいユーザー名とパスワードと一緒にページで入力してください。

```bash
docker logs <container> 2>&1 | grep "setup code"
```

アプリのログインは、あとからサインイン済みのブラウザーの**Settings → Advanced → Access**(設定 → 詳細設定 → アクセス)で変更できます。パスワードを忘れた場合は、`docker exec <container> node scripts/reset-login.mjs`を実行します。このコマンドは、`BASIC_AUTH_USER`と`BASIC_AUTH_PASS`で設定したログインは変更しません。その場合は、composeファイルでこれらを編集し、コンテナーを作り直してください。

Docker Desktop、OrbStack、rootless Dockerでは、このコンピューターで`http://localhost:7860`からMarinaraを開き、**Settings**(設定)でログインを設定します。これらの環境ではIP許可リストでデバイスを区別できないため、ログインを使ってください。アクセスを制限するほかの方法と、管理者用シークレットの役割については、[リモートアクセス: ログインとIP許可リスト](../REMOTE_ACCESS.md)を参照してください。

## Marinaraをアップデートする

コンテナーは自動ではアップデートされません。先にバックアップを作成し([Marinaraのバックアップと復元](../data/backup-and-restore.md)を参照)、新しいイメージを取得して再起動します。`docker-compose.yml`のあるフォルダーで次のコマンドを実行します。

```bash
docker compose pull && docker compose up -d
```

Podmanでは、代わりに`podman compose`を使います。アプリでは、**Settings → Advanced → Updates → Check for Updates**(設定 → 詳細設定 → アップデート → アップデートの確認)にイメージのタグとこのコマンドが表示されます。コンテナーの場合、アプリ自身がアップデートを適用することはできません。

古いリリースに戻すには、`docker-compose.yml`の`image:`行にそのタグを指定してから、`docker compose up -d`を実行します。先に[古いバージョンに戻す](../UPGRADING.md#downgrading-to-an-older-version)を参照してください。古いビルドは、新しいビルドが保存したデータを開けません。

## イメージのタグを選ぶ

| タグ | 内容 |
| --- | --- |
| `latest` | 安定版のリリースです。`docker-compose.yml`はこれを使います。 |
| `X.Y.Z` | `ghcr.io/pasta-devs/marinara-engine:2.5.1`のように、1つのバージョンに固定したタグです。 |
| `staging` | 未リリースのコードから作る不安定なテストビルドです。動かなくなることがあり、安定版のビルドへデータを戻せない場合もあります。 |
| `lite` | サイズの小さいイメージです。下を参照してください。 |
| `X.Y.Z-lite` | liteイメージのバージョンを固定したタグです。 |

`staging`を動かす場合は、安定版のデータを変更できないように、別のボリュームを使ってください。

```bash
docker run -d --name marinara-staging \
  -p 127.0.0.1:7860:7860 \
  -v marinara-staging-data:/app/data \
  ghcr.io/pasta-devs/marinara-engine:staging
```

### liteイメージ

liteイメージは、コンテナー向けの最小構成のLinuxベースであるWolfiの上に作られた、ダウンロードサイズの小さいイメージです。大きなローカルファイルを必要とする機能を省いています。

| liteで省かれるもの | 使えなくなること |
| --- | --- |
| 内蔵モデル | AIモデルを自分のハードウェアで動かせません。 |
| ローカル埋め込みモデル | デバイス上でのテキスト埋め込みができません。 |
| Memory Recall(セマンティック検索) | ローカル埋め込みモデルに依存しています。 |
| ローカルのWhisper音声入力 | Conversationの通話で音声をテキストに変換できません。 |
| アバターの気分の読み取り | 2D Avatarsと3D Avatarsは、小さなローカルの感情モデルではなく、単語の一覧から表情を選びます。 |

チャット、Roleplay、Game Mode、エージェント、ロアブック、キャラクター、リモートのAIサービスなど、それ以外の機能はすべて動きます。AIの機能を使うには、外部サービスのアカウントを追加する必要があります。[AIプロバイダーへの接続](../connections/connecting-to-a-provider.md)を参照してください。

```bash
docker run -d --name marinara-lite \
  -p 127.0.0.1:7860:7860 \
  -v marinara-data:/app/data \
  ghcr.io/pasta-devs/marinara-engine:lite
```

古いliteイメージの一部は、Raspberry Pi 4などのARMコンピューターで、AIへの送信中に`SIGILL`エラー(不正命令エラー)を出して異常終了します。こうしたデバイスでは、通常の`latest`イメージを使ってください。最新の情報は[Marinara Engineのトラブルシューティング](../TROUBLESHOOTING.md)を参照してください。

## Podman

Podmanは同じイメージを実行できます。ほとんどのコマンドでは、`docker`を`podman`に置き換えます。

```bash
podman compose up -d
```

Composeを使わずにコンテナーを1つ実行するには、次のようにします。

```bash
podman run -d \
  -p 127.0.0.1:7860:7860 \
  -v marinara-data:/app/data \
  ghcr.io/pasta-devs/marinara-engine:latest
```

`podman compose`には`podman-compose`ヘルパーが必要です。次のいずれかでインストールします。

```bash
sudo dnf install podman-compose
sudo apt install podman-compose
pip install podman-compose
```

1行目はFedora用、2行目はDebianまたはUbuntu用で、3行目はpipが使える環境ならどこでも使えます。

## イメージを自分でビルドする

ダウンロードせずにソースからビルドするには、次のようにします。

```bash
docker build -t marinara-engine .
docker run -d -p 127.0.0.1:7860:7860 -v marinara-data:/app/data marinara-engine
```

liteイメージをビルドするには、lite用のビルドファイルを使います。

```bash
docker build -f Dockerfile.lite -t marinara-engine:lite .
```

<a id="troubleshooting"></a>

## トラブルシューティング

**ページが表示されない、またはポートがすでに使われている。** [Marinaraを起動する](#start-marinara)にあるポートの対処法を参照してください。

**Marinaraがファイルを書き込めない、または権限エラーが表示される。** コンテナーは起動のたびにフォルダーの所有権を直します。ホストのファイルシステムによってはこの修復に失敗することがあり、`MARINARA_SKIP_DATA_CHOWN=true`を設定した場合は修復を行いません。エラーが続くときは、デフォルトの`marinara-data`ボリュームを使ってください。これがもっとも確実です。

**liteイメージがRaspberry Pi 4で異常終了する。** 通常の`latest`イメージを使ってください。

さらに詳しくは[Marinara Engineのトラブルシューティング](../TROUBLESHOOTING.md)を参照してください。

## 関連ガイド

- [サーバー設定リファレンス](../CONFIGURATION.md)
- [リモートアクセス: ログインとIP許可リスト](../REMOTE_ACCESS.md)
- [Marinara Engineのトラブルシューティング](../TROUBLESHOOTING.md)
