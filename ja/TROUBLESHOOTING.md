# Marinara Engineのトラブルシューティング

症状を探して、その対処法に従ってください。ほとんどの問題は、ランチャー(`start.bat`、`start.sh`、または`start-termux.sh`)からMarinaraを再起動すると解消します。

## 最初に試すこと

1. ページをハードリフレッシュします。WindowsやLinuxでは<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>、Macでは<kbd>⌘</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>を押します。
2. サーバーコンソール(Marinaraを動かしているターミナルウィンドウ)に赤いエラー行が出ていないか確認します。たいていは、その行に本当の原因が書かれています。
3. 助けを求めるときは、先に**Debug mode**(デバッグモード)をオンにしてください。[さらに助けを求める](#get-more-help)を参照してください。

<a id="my-character-does-not-reply"></a>

## キャラクターが返信しない

次の項目を順に確認してください。

1. トースト(画面下部に出る短いメッセージ)が出ていないか確認します。たいていは、そこに問題が示されています。[接続と生成のエラー](#connection-and-generation-errors)を参照してください。
2. チャットにアカウントとモデルが設定されているか確認します。**Chat Settings**(チャット設定)を開いて、接続を見てください。設定されていない場合は、**Connections**(接続)でアカウントを追加します。[AIプロバイダーへの接続](connections/connecting-to-a-provider.md)を参照してください。
3. APIキーが正しいか、アカウントにクレジットが残っているかを確認します。キーの誤りや残高切れは、よくある原因です。
4. モデル名を確認します。OllamaやLM Studioなどのローカルサーバーを使っている場合は、そのサーバーが動いているかも確認します。
5. メッセージをもう一度送るか、別のモデルを選びます。

どれも効かない場合は、**Debug mode**(デバッグモード)をオンにして、サーバーコンソールを読んでください。[さらに助けを求める](#get-more-help)を参照してください。

## モバイルや別のデバイスでアプリが読み込まれない

スマートフォン、タブレット、別のコンピューターからMarinaraを開けませんか?

原因の多くは、次の3つのどれかです。

- **アドレス。** サーバーはデフォルトで`127.0.0.1`(このコンピューターのみ)を待ち受けます。ランチャーは`HOST=0.0.0.0`を設定します。`pnpm start`で起動した場合は、先に`.env`で`HOST=0.0.0.0`を設定してください。
- **ネットワーク。** 両方のデバイスが同じWi-Fiネットワークにつながっている必要があり、ファイアウォールがポートをふさいでいてはいけません。デフォルトのポートは`7860`で、`PORT`を設定した場合はその値です。
- **ログイン。** ログインを設定してください。遮断されているデバイスで、サーバーのログにある1回限りのセットアップコードを、新しいユーザー名とパスワードと一緒に入力します。Dockerでは、`docker logs <container> 2>&1 | grep "setup code"`でコードを確認できます。または、すでにサインインしているブラウザーで、**Settings → Advanced → Access**(設定 → 詳細設定 → アクセス)から設定します。ヘッドレスサーバーでは、`ssh -L 7860:127.0.0.1:7860 user@server`を実行し、`http://localhost:7860`を開いて**Settings**(設定)を使います。[リモートアクセス](REMOTE_ACCESS.md#option-1-login-recommended)を参照してください。

ほかにも、次の原因が考えられます。

- **同じマシン上のプロキシやトンネル。** 同じマシン上のリバースプロキシやトンネルを経由する場合は、ログインが必要です。Tailscaleからの直接の通信は、デフォルトで信頼されます。Tailscale ServeやFunnel、nginxのデフォルトのHTTP/1.0の`proxy_pass`は、中継された通信と見なされ、ログインが必要です。同じホストのDockerブリッジからの通信が信頼されるのは、ログイン、`IP_ALLOWLIST`、`TRUSTED_AUTH_PROXY`のどれも設定されていないあいだだけです。
- **このコンピューターに付けた独自の名前。** `/etc/hosts`で`127.0.0.1`に対応付けた名前は、中継された通信と見なされます。代わりに`localhost`、`127.0.0.1`、マシンのホスト名、または`*.localhost`の名前を使ってください。
- **Too many wrong passwords**と表示される。15分待ってから、サインインしてください。パスワードを忘れましたか?Marinaraを動かしているコンピューターで、Marinaraのフォルダーから`node scripts/reset-login.mjs`を実行します。Dockerでは、`docker exec <container> node scripts/reset-login.mjs`を実行します。サーバーを再起動しても、もう一度試せるようになります。
- **Untrusted request host**と表示される。公開ドメインやリバースプロキシのドメインでは、`.env`の`TRUSTED_HOSTS`にそのホスト名を正確に追加してください。IPアドレスで直接アクセスする場合は、引き続き受け入れられます。
- そのデバイスから**リスクのある操作がブロックされる**(バックアップ、データの消去、アップデート)。サーバーのコンピューター上で**Settings → Advanced → Admin Access**(設定 → 詳細設定 → 管理者アクセス)を開いて**Make admin secret**(管理者用シークレットを作成)をクリックするか、サーバーの`.env`に`ADMIN_SECRET`を設定します。もう一方のデバイスで、そのシークレットを**Admin Access**に入力し、**Save**(保存)をクリックします。

[リモートアクセス](REMOTE_ACCESS.md)と[よくある質問](FAQ.md)を参照してください。アップデート後にサインインできなくなった場合は、[アップデート後にログインできなくなった場合](REMOTE_ACCESS.md#locked-out-after-updating)を参照してください。

## 保存がブロックされる、または設定が保持されない

保存できたように見えるのに、再読み込みすると元に戻ります。クロスサイト保護(CSRF)がこのブラウザーのアドレスを信頼していないため、保存をブロックしています。保存が知らないうちに失敗するという赤いバナーか、**Save blocked: missing CSRF header**、**Save blocked: cross-site request rejected**、**Save blocked: origin not trusted**のいずれかのタイトルのトーストが表示されます。

ループバック、プライベートネットワークのアドレス、Tailscale、Dockerブリッジは自動的に信頼されます。この問題が起きるのは、たいてい公開IPアドレスやドメイン名を使っている場合です。そのアドレスを、`.env`の`CSRF_TRUSTED_ORIGINS`にカンマ区切りで追加してください。バナーには、その行を用意してくれる**Copy**(コピー)ボタンがあります。再起動は不要です。

```bash
CSRF_TRUSTED_ORIGINS=http://203.0.113.10:7831,https://chat.example.com
```

<a id="connection-and-generation-errors"></a>

## 接続と生成のエラー

生成のエラーは、画面下部のトーストに表示されます。トーストには理由が示され、コピーできるだけの時間表示されます。

| メッセージまたは症状 | 対処法 |
| --- | --- |
| **No API connection configured for this chat** | チャットにアカウントがありません。**Connections**(接続)でアカウントを追加してから、そのチャットで選んでください。[AIプロバイダーへの接続](connections/connecting-to-a-provider.md)を参照してください。 |
| モデルがパラメーターを受け付けない | **Chat Settings → Advanced Parameters**(チャット設定 → 詳細パラメーター)を開き、トーストに示されたパラメーターの横にあるスイッチをオフにします。 |
| モデルがパラメーターを必須だと言う | そのパラメーターのスイッチをオンにします。 |
| **This model's chat template needs user and assistant messages to take turns** | llama.cppで動かすMistral系のモデルなど、一部のローカルモデルでは、メッセージが交互に並んでいる必要があります。Marinaraは連続したメッセージをまとめて、1回だけ再試行します。それでも続く場合は、**Chat Settings → Advanced Parameters**で**Post-Processing Messages**(メッセージの後処理)を**Single User Message**(1つのユーザーメッセージ)に設定するか、制約の緩いチャットテンプレートでモデルを動かしてください。 |
| **The AI returned an empty response. Try sending your message again.** | もう一度送ってください。繰り返し起きる場合は、別のモデルかアカウントを試します。 |
| **A generation is already in progress for this chat** | 返信がまだストリーミング中です。待つか、**Stop**(停止)をクリックしてから、もう一度試します。 |
| **No connections are marked for the random pool** | ランダム振り分けがオンなのに、プールにアカウントが1つもありません。アカウントを追加するか、ランダム振り分けをオフにしてください。 |
| どのメッセージもネットワークエラーで失敗し、コンピューターがプロキシ経由でしかインターネットに出られない | Marinaraにプロキシを設定してください。[外向きのHTTPプロキシ](CONFIGURATION.md#outbound-http-proxy)を参照してください。 |

## アップデートの後

アップデート直後に起きる問題を、まずは平易な言葉で挙げます。

- 画面が真っ白、または古く見える: [画面が真っ白、古いまま、または古く見える](#blank-stale-or-old-looking-screen)と[アップデート後にページが真っ白になる、またはJavaScriptがHTMLとして返される](#blank-page-or-javascript-served-as-html-after-an-update)を参照してください。
- チャットやプリセットが見当たらない: [アップデート後にデータがなくなったように見える](#data-seems-missing-after-an-update)を参照してください。データは、ほぼ確実にまだディスクに残っています。
- 古いバージョンに戻したらチャットが空に見える: [古いバージョンへ切り替えたらチャットのメッセージが表示されない](#chats-show-no-messages-after-switching-to-an-older-version)を参照してください。

<a id="blank-stale-or-old-looking-screen"></a>

### 画面が真っ白、古いまま、または古く見える

サーバーは動いているのに、ブラウザーに真っ白なページが表示される、またはアップデート後もアプリが古いままに見えることがあります。ブラウザーがWebアプリのキャッシュを保持しているためです。

1. ハードリフレッシュします。
2. それでも直らない場合は、**Settings → Advanced → Updates**(設定 → 詳細設定 → アップデート)を開き、**Refresh App**(アプリの再読み込み)をクリックします。

**Refresh App**は、ブラウザーのサービスワーカー(アプリをキャッシュする、裏側で動くスクリプト)とキャッシュを消去してから、再読み込みします。データは変わらず、サーバーもアップデートされません。アプリ本体をアップデートするには、[Marinara Engineのアップデート](UPGRADING.md)を参照してください。

<a id="blank-page-or-javascript-served-as-html-after-an-update"></a>

### アップデート後にページが真っ白になる、またはJavaScriptがHTMLとして返される

`text/html`というタイプを伴う「Failed to load module script」などのエラーは、ビルドに含まれていないJavaScriptファイルをブラウザーが要求したことを意味します。データを削除しても直りません。

1. サーバーを停止します。
2. `start.bat`、`start.sh`、または`start-termux.sh`をもう一度実行します。ランチャーは、起動する前に不完全なクライアントのファイルを再ビルドします。手動でインストールした場合は、先にリポジトリーのルートで`pnpm build`を実行します。
3. それでもページが真っ白なら、ハードリフレッシュするか、プライベートウィンドウを試します。

それでも失敗する場合は、読み込めなかったファイルの完全なURL、HTTPステータス、Content-Type、応答の最初の行を、ランチャーの出力と一緒に報告してください。

<a id="data-seems-missing-after-an-update"></a>

### アップデート後にデータがなくなったように見える

データのフォルダーは削除しないでください。Marinaraは実際のデータを、データフォルダーの中の`storage`フォルダーに保存しています。`packages/server/data/`と`data/`の中で`storage`を探してください。サーバーは起動時に、解決したフォルダーを表示します。

<a id="chats-show-no-messages-after-switching-to-an-older-version"></a>

### 古いバージョンへ切り替えたらチャットのメッセージが表示されない

新しいバージョンのMarinaraは、各チャットの記録(メッセージ、スワイプ、記憶、画像)をチャットごとのファイルに保存します。これにより、長いチャットの保存が速くなります。古いバージョンはこの配置を読めないため、チャットが空に見えます。データはディスクに残っています。

Marinaraは明らかなダウングレードをブロックします。ランチャーは互換性のないバージョンになる自動アップデートをスキップし、アプリ内のアップデーターはこのページを案内するエラーを表示します。

アップデートしてから古いバージョンに戻した場合は、アップデート前に作ったバックアップを復元してください。[古いバージョンへダウングレードする](UPGRADING.md#downgrading-to-an-older-version)を参照してください。以下は技術的な詳細です。

現在のデータはストレージ形式10です。形式8、9、10では、古いビルドが安全に読めない3Dアバターの設定(MMD、続いてGLBとFBX)と、接続のアカウントへの関連付けが追加されています。データが形式8以降に達している場合、古いビルドを使うには、そのアップグレードより前に作った完全なバックアップを復元してください。下のコマンドは、古いチャットファイルの配置を変換するだけです。形式番号を手作業で変更しないでください。[古いバージョンへダウングレードする](UPGRADING.md#downgrading-to-an-older-version)を参照してください。

形式8より前のデータでは、チャットファイルの配置を変換します。

1. Marinaraサーバーを停止します。
2. Marinaraのフォルダーで、次を実行します。

   ```bash
   node scripts/protect-launcher-data.mjs unshard
   ```

3. 古いバージョンに切り替えて、起動します。

このコマンドは、チャットごとのファイルから単一ファイルの配置を作り直します。何も削除されません。チャットごとのファイルは`<table>.post-unshard-<timestamp>`という名前のフォルダーに残り、`.pre-shard`の原本も残ります。もう一度アップグレードすると、Marinaraがデータを変換し直します。

DockerやPodmanでは、データは`marinara-data`ボリュームにあります。コンテナーを停止し、次のコマンドを実行してから、古いイメージを起動してください。

```bash
docker compose run --rm marinara node scripts/protect-launcher-data.mjs unshard
```

## インストールと起動の問題

### Termux: 「CANNOT LINK EXECUTABLE "node"」と表示される

Termuxが`CANNOT LINK EXECUTABLE "node"`と一緒に、`cannot locate symbol`または`library ... not found`を表示します。Termuxのほかの部分はそのままで、Node.jsだけがアップグレードされています。このとき、Androidアプリが**Could not verify that this Marinara Android build can safely read your stored data**と表示して止まることがあります。原因はデータではなく、APKをインストールし直しても直りません。

1. Termuxで、次を実行します。

   ```bash
   pkg upgrade -y
   ```

2. Androidアプリで**Install / Start Marinara**(Marinaraのインストール/起動)をタップします。手動でインストールした場合は、`cd "$HOME/Marinara-Engine" && ./start-termux.sh`を実行します。

アップグレード中に設定ファイルを残すかどうか聞かれたら、Enterキーを押して今の設定ファイルを残してください。現在のランチャーとAndroidアプリは、このアップグレードを自動で実行します。

### Termux: クライアントのビルド時にメモリー不足になる

Viteが`Reached heap limit`または`JavaScript heap out of memory`で止まります。アップデートしてから、`./start-termux.sh`を再実行してください。クライアントのビルドは、専用の1536 MiBのヒープを使います。上限は端末のRAMの半分ですが、1280 MiBを下回ることはありません。自分で設定した`NODE_OPTIONS`のヒープ上限が優先されるため、以前の1024 MiBの指定は削除してください。再試行する前に、ほかのアプリを閉じてください。RAMが約3 GB未満のスマートフォンでは、それでもメモリーが足りなくなることがあります。ビルドの失敗を直すために、チャットやプロファイルを削除しないでください。

### デスクトップ: クライアントの型チェック中にメモリー不足になる

ビルドが止まり、`The client type-check needs about 2.5 GiB of Node.js heap`と表示されます。`NODE_OPTIONS`の上限が小さすぎ、ビルドは自分で設定した上限をそのまま使います。`--max-old-space-size`を2560以上に引き上げてください。`NODE_OPTIONS`に`--max-old-space-size-percentage`が含まれている場合は、こちらがもう一方より優先されるため、代わりにこちらを引き上げてください。または、両方のオプションを削除します。そのあと、もう一度ランチャーを実行してください。データには影響しません。

### Termux: マルチプレイヤーのゲストファイルが見つからない

起動時に、`packages/client/dist/multiplayer/guest.js`が見つからないと表示されます。Marinaraをアップデートし、`./start-termux.sh`を再実行してください。これでクライアントのビルドがすべて実行されます。マルチプレイヤーをオンにする必要はありません。

### Termux: Marinaraを開くとサーバーが停止する、またはSharpを読み込めない

Sharpは、Marinaraがサムネイルやスプライトに使う画像ライブラリーです。AndroidではWebAssemblyのフォールバックを通じて動作します。Marinaraをアップデートし、ランチャーに依存関係を再インストールさせてください。アップデートする前にサーバーが停止してしまう場合は、Termuxで次のようにインストールを手動で修復します。

```bash
cd ~/Marinara-Engine
rm -f node_modules/.modules.yaml
SHARP_IGNORE_GLOBAL_LIBVIPS=1 pnpm --config.trustPolicy=off --config.confirmModulesPurge=false install --frozen-lockfile --prefer-offline
./start-termux.sh
```

チャットや設定には影響しません。それでもSharpを読み込めない場合、Marinaraは画像処理をオフにした状態で動き続けます。作成済みのサムネイルはそのまま表示され、新しいサムネイルにはフルサイズの画像が使われます。スプライトの生成と内蔵の背景除去は使えません。Sharpを別のバージョンに置き換えないでください。報告用に、エラー出力全体を残しておいてください。

<a id="browser-opens-before-startup-finishes"></a>

### 起動が完了する前にブラウザーが開く

アップデートして、ランチャーから再起動してください。ランチャーは、サーバーが準備完了を通知してからブラウザーを開きます。起動に失敗した場合はタブが開かないので、ターミナルのエラーを残しておいてください。アプリを自分で開きたい場合は、`AUTO_OPEN_BROWSER=false`を設定します。

### Windows: pnpmのインストール時にEPERMまたはcorepackの署名エラーが出る

pnpmは、Marinaraがコードをインストールするために使うパッケージマネージャーです。`EPERM: operation not permitted`またはcorepackの署名エラーは、corepackがNodeのインストール先フォルダーに書き込めなかったことを意味します。次のどれか1つを試してから、もう一度ランチャーを実行してください。

1. ターミナルを右クリックして**Run as administrator**(管理者として実行)を選び、ランチャーを実行します。
2. `npm install -g pnpm@12.15.0`で、pnpmを自分でインストールします。
3. 管理者権限のターミナルで`npm install -g corepack`を実行し、corepackをアップデートします。

### pnpmのバージョンエラー、または`'pnpm' is not recognized`と表示される

Marinaraはpnpm 12.15.0を使います。ランチャーが正しいバージョンを取得するため、古いグローバルのpnpmを先に入れ替える必要はありません。Marinaraをアップデートしてから(ランチャーでアップデートできない場合は、Marinaraのフォルダーで`git pull`を実行します)、もう一度ランチャーを実行してください。それでも失敗する場合は、正確なバージョンをインストールしてから、ランチャーを再実行します。

```bash
npm install -g pnpm@12.15.0
```

### Linux: インストール中にERR_PNPM_ENAMETOOLONGが出る

以前のインストールで、長いフォルダーパスが残っています。Marinaraのフォルダーで、次を実行します。

```bash
rm -rf node_modules .pnpm .pnpm-store
```

そのあと、もう一度`./start.sh`を実行します。手動でインストールした場合は、`pnpm install`を実行します。

### インストール中に「Ignored build scripts: @google/genai」と表示される

この通知は無害です。`pnpm approve-builds`は実行しないでください。Marinaraが管理しているファイルが変更されてしまいます。アップデート後も通知が出続ける場合は、Marinaraのフォルダーにある`node_modules/.modules.yaml`を削除してから、もう一度ランチャーを実行してください。

### インストール中にERR_PNPM_TRUST_DOWNGRADEが出る

ほとんどの場合、インストールが途中で終わっているのが原因です。もう一度ランチャーを実行してください。手動でインストールした場合は、Marinaraのフォルダーで次を実行します。

```bash
pnpm --config.trustPolicy=off --config.confirmModulesPurge=false install --frozen-lockfile
```

## 内蔵モデルの問題

**Built-in model**(内蔵モデル)は、APIキーなしで自分のコンピューター上で動きます。エラーメッセージによっては、sidecarと呼ばれます。セットアップについては、[内蔵モデルのセットアップ](connections/local-model.md)を参照してください。

- **Sidecar runtime install is disabled**と表示される。自分のコンピューターでは、`.env`に`SIDECAR_RUNTIME_INSTALL_ENABLED=true`を設定します。別のデバイスからは、先に管理者用のシークレットを**Settings → Advanced → Admin Access**(設定 → 詳細設定 → 管理者アクセス)に保存してください。
- **別のデバイスからモデルのダウンロードやセットアップに失敗する**(ネットワークアドレスやDocker)。この場合も、管理者用のシークレットが必要なことがあります。自分のコンピューターでは不要です。
- 同梱のllama.cpp、MLX、uvのファイルで**サイズまたはSHA-256の不一致**が出る。Marinaraは、そのファイルを使う前に拒否しました。Marinaraをアップデートまたは再インストールしてから、もう一度試してください。そのファイルを展開したり、編集したり、チェックを迂回して使ったりしないでください。

## 記憶機能と要約

### Memory Recallが何も思い出さない

**Memory Recall**(記憶の呼び出し)は、過去のメッセージを検索し、関連の強いものをプロンプトに加え直します。

1. **Chat Settings → Memory Recall**(チャット設定 → 記憶の呼び出し)を開き、**Enable Memory Recall**がオンになっているか確かめます。
2. **Access memories for this chat**を開きます。**Memories for This Chat**で、各チャンクの状態を確認します。
3. **Waiting for vector**は、その記憶がまだ処理中であることを示します。少し待ってから、もう一度チャットしてください。
4. **Embedding unavailable**は、使える埋め込みの生成元が1つもないことを示します。埋め込み用のアカウントを設定するか、内蔵モデルを読み込ませてください。すべてのチャットで1つの生成元を使うには、**Connections**(接続)の**Defaults**(デフォルト)セクションにある**Embeddings**(埋め込み)で選びます。

記憶が作られるには、新しいメッセージが5件以上必要です。呼び出しでは新しいメッセージと強く一致する記憶だけが表示されるため、記憶があっても何も返らないことがあります。

<a id="advanced-memory-says-scenes-need-attention"></a>

### Advanced Memoryでシーンに対応が必要と表示される

**Chat Settings**(チャット設定)ボタンに点滅しない点が表示されている場合や、Advanced Memoryが問題を見つけたという通知が出た場合は、一部のシーンの記憶が不明確か、古くなっているか、欠けています。

1. **Chat Settings → Memory Recall**(チャット設定 → 記憶の呼び出し)を開くか、通知の**Fix**(修復)をクリックします。
2. **Fix**をクリックします。補助モデルを使って、直せるシーンをすべて修復します。自分で編集した要約が変更されることはありません。
3. **need your review**の下にある各シーン番号を選び、**Access memories for this chat**で本文とキャラクターを確認してから、**Save correction**(修正を保存)をクリックします。

**Fix**がエラーで止まった場合は、補助モデルのアカウントを確認してから、**Resume processing**(処理を再開)か、もう一度**Fix**をクリックしてください。[記憶の問題を直す](agents/memory.md#fixing-memory-problems)を参照してください。

### 要約が生成されない

要約には、動作するテキスト用のアカウントが必要です。

- Roleplay: **Chat Settings → Chat Summary**(チャット設定 → チャットの要約)を開いてアカウントが設定されているか確かめ、古いチャットに追いつかせるには**Backfill Summary**を使います。
- Conversation: **Automatic Summarization**(自動要約)を開き、失敗した日を**Backfill**で再試行します。
- チャットでエージェントの書き込み承認を必須にしている場合、AIによる要約はレビュー待ちになります。
- 失敗が続く要約(たとえばAPIキーの誤りによるもの)は、あとで再試行されます。アカウントを直してから、**Backfill**を使ってください。

## ダウンロードできるエージェントの問題

- **Agent Organizerでカタログを利用できない。** ブラウザーだけでなく、サーバーを動かしているコンピューターが、[Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents)のカタログにHTTPSで到達できる必要があります。インストール済みのエージェントは、オフラインでも動き続けます。接続を回復してから、**Refresh**(更新)か**Try again**(もう一度試す)をクリックしてください。
- **インストールしたマップや通話が表示されない。** Marinaraを完全に終了してから、もう一度起動してください。これらのパッケージは、次に起動するまで**Restart required**の状態のままです。Conversationのゲームは、すぐに有効になります。インストールに失敗した場合は、カタログを更新して、ゲームが準備完了と表示されているか確かめてください。チャットの**Commands**(コマンド)設定にゲームを追加する必要があるのは、キャラクター自身にゲームを始めさせたいときだけです。手動のスラッシュコマンドには必要ありません。
- **最初のパッケージ移行が完了しない。** `data/capability-packages`やチャットのデータを削除しないでください。Marinaraは次回の起動時に再試行し、チャットの選択内容は保存されたままです。
- **`data/capability-runtime-snapshots`や`data/capability-packages/versions`が大きい。** 整理は不要です。Marinaraは起動時に古いコピーを削除し、各エージェントの現在のバージョンと1つ前のバージョンを残します。
- **パッケージのダウンロードが拒否される。** チェックサム、ファイル一覧、Marinaraのバージョン範囲、アーカイブ内のパスのいずれかが、公式カタログと一致していません。Marinaraをアップデートし、カタログを更新してから、もう一度試してください。成果物をデータフォルダーへ手動で展開しないでください。
- **アップデート。** エージェントのアップデートが起動時に適用されることはありません。Marinaraが先に確認します。**Not now**(今はしない)を選ぶとインストール済みのバージョンが残り、**Update**(アップデート)は**Agents → Agent Organizer**に残ります。アップデートに失敗しても、インストール済みのバージョンはそのまま残ります。起動時のチェックに失敗したサーバーランタイムは、元に戻されます。

## Card Browserの問題

**Card Browser**(カードブラウザー)は、公開されているキャラクターサイトを検索します。**Characters**(キャラクター)パネルか**Personas**(ペルソナ)パネルの上部にある**Download**(ダウンロード)ボタンから開きます。

- **JannyAIでCloudflareのブロックが表示される。** 同じブラウザーでJannyAIのサイトを一度開いてチャレンジを解除してから、もう一度試してください。
- **再起動後にPygmalionのログインが切れる。** 仕様どおりです。このログイン情報は、サーバーのメモリー上にだけ存在します。ログインのウィンドウを開いて、トークンを貼り付け直してください。
- **CharacterTavernで検索結果の代わりに案内が表示される。** 仕様どおりです。新しいWebサイトでは、Marinaraが使っていた接続が提供されなくなりました。character-tavern.comからカードをダウンロードして、そのファイルをインポートしてください。

## メディア生成の問題

### 複雑なシーンでスプライトの背景除去がうまくいかない

生成したスプライトは通常、そのままの透過情報か、Marinaraが取り除く単色の背景を使います。写真の室内、描き込まれた風景、濃い影、背景と近い色などでは、任意のAIによる代替処理が必要になることがあります。

```bash
pnpm backgroundremover:install
```

そのあとMarinaraを再起動し、スプライト生成のウィンドウで**Reapply Cleanup**(クリーンアップを再適用)をクリックします。Marinaraはまず内蔵の背景除去を試し、ふちが均一に見えないときだけAIモデルを使います。インストールに失敗する場合は、次を試してください。

- Python 3.9から3.11までがインストールされているか確かめます。これより新しいバージョンでは、時間のかかるネイティブビルドが必要になることがあります。
- `pnpm backgroundremover:reinstall`を実行します。
- 原因を調べている間、AIによる代替処理を使わないようにするには、`.env`に`SPRITE_BACKGROUND_REMOVAL_ENGINE=builtin`を設定します。

### Game ModeやRoleplayの絵コンテが表示されない

絵コンテは、書き終わった語りをキーフレーム画像と、任意の短い動画に変換します。[Storyboardエージェントガイド](game/storyboard.md)と[Game Mode: はじめに](game/getting-started.md)を参照してください。

- **Agents → Agent Organizer**から**Storyboard**をインストールし、そのチャットで**Enable Agents**(エージェントを有効にする)と**Enable Storyboards**(絵コンテを有効にする)をオンにします。
- キーフレームには、画像用のアカウントが必要です。動画には、さらに動画用のアカウントも必要です。
- Game(自動): **Chat Settings → Agents → Storyboards**(チャット設定 → エージェント → 絵コンテ)を開き、**Automatic Storyboard Illustrations**がオンになっているか確かめます。短い動画も作るには、**Automatic Storyboard Animations**をオンにします。
- 手動のシーン動画: **Chat Settings → Gallery**(チャット設定 → ギャラリー)を開き、画像を生成またはアップロードしてから、**Video**か**Animate**を使います。**Videos**タブを確認してください。
- Roleplay: **Storyboard**エージェントをチャットに追加します。**Still images**か**Animations**を選び、**Messages per episode**を設定して、画像用のアカウントを選びます。**Manual only**の場合は、**Chat Settings**の**Gallery**セクションにある**Create storyboard**から実行します。
- すべてのキャラクターをまとめたカスタムのプロンプトのほうがうまくいく場合は、**Use NovelAI Character Prompts**をオフにします。
- 応答の遅いサービスでは、タイムアウトすることがあります。`.env`の`IMAGE_GEN_TIMEOUT_MS`または`VIDEO_GEN_TIMEOUT_MS`を大きくしてから、Marinaraを再起動してください。
- `Outbound response exceeded 31457280 bytes`: デフォルトでは、30 MiBを超える画像の応答は失敗します。ワークフローと参照画像を埋め込んだComfyUIのファイルは、この大きさに達することがあります。`.env`の`IMAGE_GEN_MAX_RESPONSE_BYTES`を大きくして再起動するか、ComfyUIでメタデータをオフにしてください。

### Game Modeの世界生成でJSONのエラーが出る

モデルが壊れたJSON(構造化されたテキスト)を返した場合、Marinaraはターンを捨てずに**Repair JSON**(JSONの修復)ウィンドウを開きます。

1. エディターで括弧、カンマ、項目を直します。テキストを正しく解析できるようになると、バナーに**JSON is valid.**と表示されます。
2. **Format**(整形)をクリックすると、レイアウトが整います。
3. **Apply Repaired JSON**(修復したJSONを適用)をクリックすると、応答を再生成せずにそのJSONを使えます。

## 音声、通話、TTS

- **通話中にキャラクターが話さない。** 音声合成が設定されていません。**Connections → Text to Speech**(接続 → 音声合成)を開いてオンにし、生成元を選び、キーを入力し、声を選んで保存します。声のないキャラクターは、テキストだけで表示されます。
- **音声が「No audio after N s」で止まる。** 音声サーバーの応答が、Marinaraの待ち時間より遅くなっています。ノートパソコン上のローカルサーバーでは、よくあることです。`N`は、現在のタイムアウトの値です。**Connections → Text to Speech**、またはメッセージに示された音声のアカウントで、**Request timeout (seconds)**(リクエストのタイムアウト、秒単位)を大きくしてください。[リクエストのタイムアウト](media/tts-setup.md#request-timeout)を参照してください。
- **マイクが動かない。** **Agents → Agent Organizer**から**Calls**をインストールします。次に**Connections → Speech to text**(接続 → 音声認識)を開き、**On this device**(このデバイス上)の下にある**Local speech model**(ローカル音声モデル)を探して、Whisperのモデルを選び、**Download Whisper**(Whisperをダウンロード)をクリックします。Firefoxにはブラウザーの音声認識がないため、この手順が必要です。Callsをアンインストールすると、そのWhisperのモデルも削除されます。自分のサーバーを使うこともできます。[自分の音声認識サーバーを使う](conversation/calls.md#use-your-own-speech-to-text-server)を参照してください。
- **Local Whisper is disabled in Lite mode**と表示される。liteイメージでは、ローカルの音声認識モデルを動かせません。通常のインストールを使ってください。

### リモートやネットワーク越しのインストールでMusic DJのSpotifyログインが失敗する

Music DJエージェントのSpotifyモードは、OAuthを使います。OAuthはログインを引き渡す仕組みで、Spotifyはログイン後にコールバックアドレス(リダイレクトURI)へ戻します。Spotifyが受け付けるのは`https://`のアドレスか`http://127.0.0.1`だけで、ネットワークのIPアドレスをそのまま使うと拒否されます。

- localhostでは、エディターに`127.0.0.1`のコールバックが表示されます。これをSpotifyに登録します。
- HTTPSでは、エディターにHTTPSのコールバックが表示されます。これを登録します。
- HTTPSが手前で終端されていてホストが一致しない場合は、`.env`の`SPOTIFY_REDIRECT_URI`に公開用のコールバックアドレスを設定します。
- HTTPのままのネットワーク越しのインストールでは、ポップアップは読み込めませんが、そのアドレスバーには有効なコードが入っています。URL全体をコピーし、Connectボタンの下にある**Browser couldn't reach the callback?**を展開して貼り付けてください。URLは10分間有効です。

いちばんすっきりする解決策は、MarinaraをHTTPSで提供することです。

## ストレージとデータ

### Restart Server後にサーバーが戻らない

Marinaraは`start.bat`、`start-local.bat`、`start.sh`、`start-termux.sh`、または`pnpm start`で起動してください。これらはサーバーをランチャーにつないだ状態に保ち、古いプロセスが終了したあとに代わりのプロセスを起動します。アプリ内からの再起動では、4秒後に残っている接続を閉じ、8秒後に強制終了します。強制終了すると、保留中の書き込みが中断されることがあります。`node`で直接起動した場合や開発用の監視プロセスは置き換えられないため、自分で停止して起動し直してください。Dockerでは、コンテナーの再起動ポリシーが使われます。Windowsでは、ランチャーのコンソールで<kbd>Ctrl</kbd>+<kbd>C</kbd>を押し、**Shutdown complete**と表示されるのを待ってから閉じてください。

1つ目のサーバーが動いている間は、同じデータフォルダーで2つ目のサーバーを起動しないでください。残っているプロセスを先に停止してください。

### 起動時に別のプロセスがデータフォルダーを使っているかもしれないと表示される

ローカルのデータフォルダーに書き込めるサーバーは1つだけです。起動時にそのフォルダーについて**Another Marinara Engine process ... may be using**と表示された場合は、もう一方のMarinaraのプロセスを終了してから、もう一度起動してください。

クラッシュのあとやDockerのボリュームを移動したあとは、起動時に**The storage writer lease ... is incomplete or invalid**と表示されたり、もう存在しないプロセスが示されたりすることがあります。

1. そのデータフォルダーを使うMarinaraのプロセスとコンテナーが、すべて停止していることを確認します。
2. エラーで示された`.writer-lease`フォルダーだけを削除します。
3. Marinaraを再起動します。`storage`フォルダーやテーブルファイルは削除しないでください。

データフォルダーがローカルのドライブにある場合、Linux、Android、コンテナー、Windowsでは、クラッシュしたプロセスが残したリースをMarinaraが自動で解除します。手動の手順は、ネットワークストレージや共有ストレージ、取り外し可能なドライブ、そして(Windowsで)クラッシュ後にコンピューターの名前を変えた場合のためのフォールバックです。

### バックアップやエクスポートが403を返す

同じコンピューターからのセッションなら、管理者用のシークレットなしでバックアップできます。別のデバイス、ネットワークアドレス、Docker、または同じコンピューター上のプロキシやトンネルからのリクエストには、シークレットが必要です。サーバーのコンピューター上の**Settings → Advanced → Admin Access**(設定 → 詳細設定 → 管理者アクセス)で作成するか、サーバーに`ADMIN_SECRET`を設定します。そのうえで、同じ値をもう一方のデバイスの**Admin Access**に保存してください。ループバックでも必須にするには、`MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK=true`を設定します。`REQUIRE_AUTH_FOR_LOOPBACK_PROXY=false`の場合は、転送された訪問者にもローカルの免除が適用されます。公開しているプロキシやトンネルでは、この設定をオンのままにしてください。

### インポートでファイルが読み取れるZIPアーカイブではないと表示される

Marinaraは、`.charx`カード、`.marinara`パッケージ、エージェントパッケージ、独自のエージェントリポジトリーをZIPアーカイブとして読み込みます。壊れたアーカイブや、中身がファイル一覧と一致しないアーカイブは拒否し、**The file is not a readable ZIP archive**(または**Could not read .marinara package**)と表示します。よくある原因はダウンロードが途中で切れたことなので、ファイルをもう一度ダウンロードしてください。アーカイブを自分で作った場合は、システムの圧縮機能、`zip`、7-Zipのいずれかで作り直してください。

**Package contains too many files**は、エージェントパッケージまたはリポジトリーに8,192個を超えるファイルが含まれていることを示します。**.marinara package has too many entries**は、`.marinara`パッケージに8個を超える項目が含まれていることを示します。余分なファイルを取り除いてから、もう一度試してください。

### ConversationのスケジュールやNoodleが間違ったタイムゾーンを使う、または`Etc/Unknown`と表示される

Conversationのスケジュールについては、ConversationのChat Settingsか、キャラクターのスケジュールエディターで**Schedule timezone**(スケジュールのタイムゾーン)を選びます。**Use device**(デバイスに合わせる)で元に戻せます。

Noodleやそのほかのサーバーのジョブについては、`.env`から空の`TZ=`の行を削除し、Marinaraを再起動してホストのタイムゾーンを使わせてください。タイムゾーンを指定するには、`TZ=Europe/Warsaw`のようなIANA名を使います。

## Androidの問題

### AndroidアプリがConnectingまたはWaiting for Serverから進まない

Androidアプリは、Termuxを包む小さな入れ物です。TermuxはAndroid向けのLinuxターミナルアプリで、実際のMarinaraサーバーを動かします。

1. **Install / Start Marinara**(Marinaraのインストール/起動)をタップします。
2. AndroidがTermuxのインストールを求めたら、表示される確認を承認します。
3. AndroidがTermuxでのコマンド実行の許可を求めたら、許可します。
4. ランチャーがサーバーを起動するまで待ってから、アプリに戻ります。

アプリはlocalhost用の非公開の認証情報を作成し、自動的にサインインします。シークレットを貼り付ける必要はありません。`CSRF_TRUSTED_ORIGINS`に`null`、`http://null`、APKのシークレットを追加しないでください。

アプリとTermuxが同じポートを使っているかも確認してください。デフォルトは`7860`です。別のポートでアプリをビルドした場合は、Termuxの`.env`に同じ`PORT`を設定します。

<a id="android-localhost-opens-the-login-page-or-returns-401503"></a>

### Androidのlocalhostでログインページが開く、または401/503が返る

APKが管理するTermuxのインストールでは、インストールごとの非公開のシークレットでlocalhostを保護し、アプリは自動的にサインインします。アプリ内にログインページが表示された場合は、[最新のAPK](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk)をインストールし、もう一度**Install / Start Marinara**(Marinaraのインストール/起動)をタップして、Termuxの処理が終わったらアプリに戻ってください。

オリジン`null`を示すエラーは、古いAPKとサーバーの組み合わせであることを意味します。`.env`を編集しても直りません。APKとMarinaraをアップデートしてください。

同じスマートフォンのブラウザーで開くには、Androidランチャーで**Open in browser**(ブラウザーで開く)をタップし、次に**Retry connection**(接続を再試行)をタップします。サーバーの再起動後やセッションの期限切れ後も、この方法で開き直してください。ランチャーに戻るには、**Settings → General → App Behavior → Open Android launcher (app or browser)**(設定 → 一般 → アプリの動作 → Androidランチャーを開く(アプリまたはブラウザー))を使います。

古いAPKでは、`/android-login`で`cat ~/.marinara-engine/android-secret`の値を使ってサインインします。ブラウザー用のリンクは1回だけ使え、1分で期限が切れるため、ランチャーから新しいリンクを開いてください。

- **401:** 貼り付けたシークレットまたはチャレンジが拒否されました。`/android-login`を再読み込みして、現在の値を貼り付けてください。
- **503:** サーバーが受け取ったシークレットの形式が正しくありません。`./start-termux.sh`で再起動してください。シークレットファイルが無効または空であるとランチャーが表示した場合は、アプリで**Install / Start Marinara**をタップして、もう一度用意させてください。

ローカルの`mari`コマンドも、同じファイルを自動で読み込みます。このシークレットを、スクリーンショットや問題の報告に含めないでください。

### Androidのアップデートが終了ステータス134で止まる

ビルドの途中で、Androidのメモリーが足りなくなりました。もう一度ランチャーを実行してください。

```bash
./start-termux.sh
```

それでも止まる場合は、ほかのアプリを閉じ、Termuxを開き直して、もう一度試してください。

### Marinaraの実行中にTermuxが終了または再起動する

ランチャーは、サーバーの実行中にwake lockを要求し、各セッションを`~/.marinara-engine/logs/`に保存します。予期しない再起動のあとは、最新の`server-*.log`を報告に添えてください。ログがMarinaraやNodeのエラーなしで終わっている場合は、Androidかスマートフォンのメーカーが、Termuxを終了した可能性が高いです。

Androidの設定で、Termuxのバックグラウンド実行を許可し、バッテリー最適化の対象から外してください。`termux-wake-lock`と`termux-wake-unlock`は、標準のTermuxに含まれています。これらの設定でも、メーカー固有のプロセス終了をすべて防ぐことはできません。

### Termuxを前面に出すまでMarinaraが応答しなくなる

チャットが「Opening chat...」のまま止まり、アプリが**Server unreachable**と表示し、Support Diagnosticsでコピーした内容ではサーバーの項目が**Unreachable (request timed out)**になり、Termuxを開いた瞬間にすべてが復旧します。Androidがキャッシュ状態のアプリを凍結する仕組み(cached app freezer)が、Termuxのプロセスを停止させています。スマートフォンは接続を受け付けますが、凍結されたサーバーが応答することはありません。wake lockでは防げません。セッションのログには、エラーではなく、凍結されていた時間帯のタイムスタンプの空白が残ります。

Termuxをバッテリー最適化の対象から外し、バックグラウンドでの動作を許可し、端末が対応していれば最近使ったアプリの画面でTermuxをロックして、通知も表示したままにしてください。それでも凍結が続く場合は、Marinaraを使っている間、Termuxを前面に出したままにするか、画面をつけたままにしてください。

### Androidのアップデート中に依存関係のインストールで空き容量が足りなくなる

アップデート中に一時的に大きな容量を使うのは、たいてい、何回かリリースをまたいだあとや再インストールが中断されたあとの、pnpmの依存関係のストアが原因です。現在のランチャーは古いパッケージを削除し、アプリ内のアップデートはAndroid用のパッケージだけをインストールします。古いランチャーで端末の容量がいっぱいになった場合は、空き容量を確保してから、もう一度試してください。

```bash
cd Marinara-Engine
git pull --ff-only
pnpm store prune
./start-termux.sh
```

`data`、`storage`、`marinara-engine.db`は削除しないでください。チャットや設定が入っている可能性があります。それでも止まる場合は、`Installing dependencies`以降の行を控え、スマートフォンの空き容量とメモリーも報告に含めてください。

### AndroidでStableとStagingを切り替えるとアプリ内アップデートが失敗する

チャンネルを切り替えると、依存関係のほぼ全体を入れ直すことになり、Termuxのストレージでは時間がかかります。アプリ内のアップデーターは、各ステップに余分な時間を認めています。それでもアップデートに失敗する場合、エラーには失敗したステップの名前と、その出力の末尾が表示されます。依存関係やロックファイルの本当のエラーは、そこに表示されます。エラーのヒントに示されるコマンドで、Termuxから手動でアップデートすることもできます。先に空き容量を確保してもかまいません。

```bash
cd Marinara-Engine
pnpm store prune
./start-termux.sh
```

## Dockerの問題

### ボリュームマウントでコンテナーの権限エラーが出る

- アップデート後の名前付きボリューム: `docker compose pull && docker compose up -d`を実行します。公式イメージは、起動時に所有権を修復します。
- バインドマウント: ホスト側のフォルダーをユーザーIDとグループID`1000`で書き込めるようにするか、名前付きボリュームを使います。
- FedoraやRHELなどのSELinuxを使うシステム: ボリュームマウントに`:Z`という接尾辞を付けます。

### Raspberry Pi 4でLiteコンテナーがクラッシュする

Raspberry Pi 4などのARMデバイスで、AIへのリクエストを送るたびにliteイメージが再起動する場合は、終了コードを確認してください。終了コード132やSIGILL(CPUが実行できない命令に行き当たったこと)は、一部のARMチップでliteイメージのNodeビルドに起きる、既知の上流の問題を示しています。そのデバイスでは、通常のイメージを使ってください。

<a id="a-server-extension-says-no-supported-sandbox-is-available"></a>

### Server Extensionが利用できるサンドボックスはないと表示される

Server ExtensionとProfessor Mariの生のシェルコマンドは、macOSのSeatbeltかLinuxのBubblewrapがある場合にだけ動きます。ネイティブのLinuxホストでは、`bwrap`をインストールしてからMarinaraを再起動してください。公式のDockerイメージにはBubblewrapが含まれていますが、デフォルトのコンテナーでは入れ子の名前空間を作れないため、Marinaraはこれらの機能をオフのままにします。

より広いコンテナーの権限を受け入れる場合は、次の内容を`docker-compose.yml`の隣に`docker-compose.override.yml`として保存してから、コンテナーを作り直してください。

```yaml
services:
  marinara:
    environment:
      MARINARA_DOCKER_USER: root
    cap_add:
      - SYS_ADMIN
    security_opt:
      - apparmor=unconfined
```

> **Warning:** `SYS_ADMIN`を付け、AppArmorプロファイルなしでサーバーをrootで動かすのは、広範な権限昇格です。このメッセージを消すためだけに有効にしないでください。

Dockerのデフォルトのseccompプロファイルは追加した権限に合わせて調整されるため、現在のDockerでは`seccomp=unconfined`は必要ないはずです。

Windows、Android、そのほかの非対応のホストでは、Server Extensionの実行が拒否されます。Browser Extensionは、引き続きそれぞれのサンドボックスで動きます。

## 拡張機能の問題

### AddonsにExternal Extensionsが表示されない

このセクションは、2つの条件がどちらも満たされるまで表示されません。

1. ホストの`.env`に`ENABLE_EXTERNAL_EXTENSIONS=true`を設定します。
2. 少し待ってから、**Settings → Advanced → Danger Zone**(設定 → 詳細設定 → 危険な操作)を開き、データ削除の操作より下までスクロールして、**Allow third-party extension imports**(サードパーティー製拡張機能のインポートを許可)をオンにします。

スイッチが無効になっている場合は、ホスト側のフラグがまだfalseか、アプリが変更をまだ検知していません。[サーバー設定](CONFIGURATION.md)で説明している、実際に使われている`.env`を編集したか確認してください。Dockerでは通常`/app/data/.env`です。

どちらかの条件が満たされていない間は、外部拡張機能の記録は表示されず、実行もできません。条件を満たし直しても、それらが再び有効になることはありません。

### インポートしたブラウザー拡張機能は表示されるのに動かない

**Settings → Addons → External Extensions**(設定 → アドオン → 外部拡張機能)でその拡張機能を開き、**Requested access**(要求されている権限)を読みます。機能の宣言がない`marinara.extension` v1形式の古いパッケージには、**Full page access**(ページ全体へのアクセス)と表示されます。承認するのは、自分で中身を確認して信頼できるハッシュだけにしてください。

機能の一覧を空にして再エクスポートされたパッケージは、安全なサンドボックス拡張機能として扱われるため、ページのDOMを必要とするコードは動きません。マニフェストに`full_page_access`を追加するのは、そのコードがページ全体、ブラウザーのストレージ、ネットワークAPI、セッションにアクセスできるようになることを受け入れる場合だけにしてください。

ページ全体にアクセスする拡張機能を無効にしたあと、ツールバーの項目、オーバーレイ、リスナーが残っている場合は、Marinaraを再読み込みしてください。ページのコードはMarinaraが追跡しない副作用を起こすことがあるため、後片付けは可能な範囲でしか行われません。

<a id="multiplayer-connection-or-turn-problems"></a>

## マルチプレイヤーの接続・ターンの問題

| 症状 | 対処法 |
| --- | --- |
| 操作できない | 正しいMarinaraの`.env`に`MULTIPLAYER_ENABLED=true`を書き、そのMarinaraを再起動してから、設定を別途オンにします。Androidのネイティブラッパーでは参加できません。 |
| ホストに接続できない | 到達可能な専用のHTTPSルームポート、有効な証明書チェーンとホスト名、招待と一致するフィンガープリントを使ってください。TLSの検証をオフにしたり、信頼するオリジンに`null`を追加したり、通常のAPIを公開したり、ホストが提供したクライアントを開いたりしないでください。 |
| 承認待ち | ホストがPlayersで承認する必要があります。承認されるまで、履歴は見られません。招待の期限が切れた場合は、新しい招待を依頼してください。 |
| 切断された | 自分のMarinaraを動かしたままにしてください。セッションが続いている間は同じホストに再接続し、未送信の下書きも残ります。再起動したあとは、もう一度参加してください。同じペルソナ名を使い続けるには、先にホストに古い席を削除してもらってください。 |
| Gameが待機中 | Playersを開きます。切断したプレイヤーは、自動ではパスされません。ホストは**Pass**、**Kick**、**Pause**を選べます。 |
| 生成が中断された | ラウンドを送り直さないでください。ホストは保存された語りと状態を確認してから、ルームを再開するか停止してください。マルチプレイヤーは、結果のはっきりしないリクエストを再実行したり、世界への効果を二重に適用したりすることはありません。 |
| コマンドが制限される、またはメディアがない | ルームはテキストだけを扱います。[互換性一覧](development/multiplayer.md#command-and-feature-compatibility)を参照してください。ほかの参加者が提供したファイルや拡張機能をインストールしないでください。 |

接続エラーを報告するときは、モード、プラットフォーム、表示されたエラー、承認がうまくいったかどうかを含めてください。招待、ルームのパスワード、セッショントークン、非公開の履歴、APIキーは投稿しないでください。

## ログインを設定した環境でAndroid ChromeからPWAとしてインストールできない

HTTPSのアドレスを使ってサインインし、Marinaraをアップデートしたあとに再読み込みしてください。アプリは認証情報付きでマニフェストを要求するため、ログインはオンのままでかまいません。それでもインストールできない場合は、プロキシが`/manifest.json`を、ログインページやエラーではなくJSONとして返しているか確認してください。

<a id="get-more-help"></a>

## さらに助けを求める

1. **Settings → Advanced → Message Tools**(設定 → 詳細設定 → メッセージツール)を開き、**Debug mode**(デバッグモード)をオンにします。プロンプトと応答がサーバーコンソールに記録されます。
2. 使っているオペレーティングシステム、Node.jsのバージョン、コンソールに出たエラーの全文を控えます。
3. 何かを共有する前に、APIキー、アクセストークン、管理者用のシークレット、私的なチャットの内容を取り除きます。

そのうえで、コミュニティに質問してください。

- [未解決のissue](https://github.com/Pasta-Devs/Marinara-Engine/issues)を読みます。
- [Discord](https://discord.com/invite/KdAkTg94ME)に参加します。
- 上の情報を添えて、同じGitHubのissuesでバグを報告します。

## 関連ガイド

- [よくある質問](FAQ.md)
- [サーバー設定リファレンス](CONFIGURATION.md)
- [リモートアクセス](REMOTE_ACCESS.md)
- [Marinara Engineのアップデート](UPGRADING.md)
- [AIプロバイダーへの接続](connections/connecting-to-a-provider.md)
- [内蔵モデルのセットアップ](connections/local-model.md)
- [Game Mode: はじめに](game/getting-started.md)
- [設定の概要](settings/settings-overview.md)

<details>
<summary>メンテナー向け: 固定したローカルランタイムのアップデート</summary>

GitHubが生成するソースアーカイブは、コミットの内容が変わらない場合でも、バイト単位で同一であり続ける保証はありません。ユーザーの環境で見えたバイト列をそのまま受け入れたり、検証を弱めたりして不一致を「修正」しないでください。ランタイムの入力を固定し直すのは、レビューを経たEngineの変更の中だけにします。

1. 変更されない上流のリビジョンかリリース資産を選び、上流の変更内容をレビューします。
2. 一時フォルダーに成果物をダウンロードし、正確なバイト数を記録して、SHA-256ダイジェストを独立に計算します。
3. `runtime-integrity-manifest.ts`を、そのリビジョン、URL、サイズ、ダイジェストで更新します。MLXの場合は、Apple SiliconかつPython 3.12の環境で、固定したuvのバージョンを使って`.in`ファイルから`packages/server/src/assets/mlx-runtime-requirements.lock`を生成し直し、依存関係の変更をすべてレビューしたうえで`requirementsLockSha256`を更新します。
4. `pnpm regression:runtime-integrity`と`pnpm check`を実行し、対象のプラットフォームでクリーンな状態からのランタイムインストールを実際に試します。
5. レビュー済みのEngineのアップデートを配布してから、再試行を案内します。チェックサムを手動で上書きする手段は用意しないでください。

</details>
