# Marinara Engineのアップデート

Marinara Engineを新しいバージョンにアップデートする方法、アプリ内でアップデートを確認する方法、問題が起きたときに元のバージョンへ戻す方法を説明します。アップデートしてもチャットと設定はそのまま残ります。

## どのアップデート方法を使うか

| インストールした方法 | アップデートの方法 |
| --- | --- |
| Windowsインストーラーまたは`start.bat` | Marinaraを終了して、もう一度開きます。[Windows](#windows)を参照してください。 |
| macOSまたはLinux | `./start.sh`をもう一度実行します。[macOSとLinux](#macos-and-linux)を参照してください。 |
| DockerまたはPodman | 新しいイメージを取得して再起動します。[DockerまたはPodman](#docker-or-podman)を参照してください。 |
| Androidアプリ | APKをアップデートしてから、**Install / Start Marinara**(Marinaraのインストール/起動)をタップします。[Android (Termux)](#android-termux)を参照してください。 |
| iPhoneまたはiPad | サーバーを動かしているデバイスをアップデートします。[iPhoneとiPad](#iphone-and-ipad)を参照してください。 |

<a id="back-up-first"></a>

## 事前のバックアップ

バージョンを大きく飛ばす前には、バックアップを作成してください。古いバージョンに戻す可能性があるときは、必ず作成してください。

1. **Settings**(設定)を開きます。
2. **Advanced**(詳細設定)タブを開きます。
3. **Backup & Export**(バックアップとエクスポート)セクションを探します。
4. **Download Backup**(バックアップのダウンロード)をクリックします。
5. `.zip`ファイルを安全な場所に保存します。

処理中はボタンの表示が**Creating backup…**に変わります。完了すると、ブラウザーがデータの`.zip`を保存します。復元については[Marinaraのバックアップと復元](data/backup-and-restore.md)を参照してください。

## プラットフォーム別のアップデート

Marinaraをインストールした方法に合う節を選んでください。gitのコピーとは、Gitというツールでインストールしたコピーのことです。Windowsインストーラーでのインストールや、`git clone`で取得したものも含みます。

### Windows

ランチャーは、起動したときにMarinaraをアップデートします。

1. Marinara Engineを終了します。
2. デスクトップかスタートメニューのショートカットから開き直すか、`start.bat`を実行します。

ランチャーが最新のコードを取得し、変更された部分を再インストールし、ビルドし直して新しいバージョンを起動します。自分でコードを変更していた場合は、その変更をいったん退避し、アップデート後に元に戻します。退避できない場合は、今のバージョンのままにして、その旨を表示します。アップデートの前にはデータをコピーし、データより古いバージョンに移ることになるアップデートはスキップします([古いバージョンへダウングレードする](#downgrading-to-an-older-version)を参照)。

1回だけアップデートを飛ばすには、`start.bat --skip-update`を実行します。起動のたびにインストール済みのバージョンを保つには、プロジェクトの`.env`に`AUTO_UPDATE_ENABLED=false`を設定します。これでオフになるのは自動アップデートだけです。手動のコマンドと**Settings → Advanced → Check for Updates**(設定 → 詳細設定 → アップデートの確認)は引き続き使えます。

Node.jsが古いとランチャーに表示された場合は、Node.js 24 LTS(Long Term Support。推奨される安定版)をインストールしてから、Marinaraを起動し直します。GitHubのReleasesページから最新のインストーラーをダウンロードして実行することもできます。

<a id="macos-and-linux"></a>

### macOSとLinux

1. Marinara Engineを終了します。
2. Marinaraのフォルダーからランチャーを実行します。

```bash
./start.sh
```

ランチャーが最新のコードを取得し、変更された依存パッケージを再インストールし、ビルドし直して新しいバージョンを起動します。1回だけ飛ばすには`./start.sh --skip-update`を使います。自動アップデートをオフにするには、`.env`に`AUTO_UPDATE_ENABLED=false`を設定します。Node.jsが古い場合は、Node.js 24 LTSをインストールしてからランチャーを実行し直します。

<a id="docker-or-podman"></a>

### DockerまたはPodman

コンテナーは、ランチャーではなく新しいイメージを取得してアップデートします。バックアップを作成してから、Composeファイルのあるフォルダーで次のコマンドを実行してください。

```bash
docker compose pull && docker compose up -d
```

Podmanでは、代わりに`podman compose`を使います。リリースイメージは`ghcr.io/pasta-devs/marinara-engine:X.Y.Z`と`:latest`、および対応する`-lite`タグです。pullしても、`marinara-data`ボリュームの中のデータには影響しません。[コンテナーでのインストール](installation/containers.md)を参照してください。

### Android (Termux)

Termuxは、Marinaraのために小さなLinux環境を動かすAndroidアプリです。Termuxのランチャーは、実行するたびにMarinaraをアップデートします。

1. Termuxを開きます。
2. ランチャーを実行します。

```bash
cd Marinara-Engine
./start-termux.sh
```

ランチャーはコードをアップデートし、必要に応じてNode.jsをアップグレードし、ビルドし直してサーバーを起動します。アップデートで問題が起き、今のコピーのまま使いたいときは、`--skip-update`を付けます。自動アップデートをオフにするには、プロジェクトの`.env`に`AUTO_UPDATE_ENABLED=false`を設定します。

Androidアプリ(APK)を使っている場合は、[最新のAPKをダウンロード](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk)して開き、Androidにアプリをアップデートさせます。その後Marinara Engineを開き、**Install / Start Marinara**(Marinaraのインストール/起動)をタップして、Termux側のコピーをアップデートして起動します。アップデートの際に、署名の認証情報やシークレットを求められることはありません。

<a id="iphone-and-ipad"></a>

### iPhoneとiPad

これらのデバイスではサーバーは動きません。ホーム画面のアイコンはPWAです。PWAとは、ホーム画面に保存してアプリのように開けるWebサイトのことです。

1. Marinaraのサーバーを動かしているコンピューター、コンテナーのホスト、Androidデバイスをアップデートします。上にあるそのデバイスの節を参照してください。
2. ホーム画面のアプリか、Safariのタブを再読み込みします。

Safariが古いビルドを表示し続ける場合は、PWAをインストールし直します。[PWAの削除と再インストール](installation/ios-pwa.md#clearing-and-reinstalling-the-pwa)を参照してください。

<a id="manual-update-git-copy-no-launcher"></a>

### 手動アップデート(gitのコピー、ランチャーなし)

ランチャーではなく`pnpm start`でgitのコピーを動かしている場合は、この方法を使います。次のコマンドはMarinaraのフォルダーで実行します。

1. 最新の安定版のコードを取得します。

```bash
git fetch origin +refs/heads/main:refs/remotes/origin/main
```

2. そのコードに移動します。

```bash
git merge --ff-only origin/main || git checkout --detach origin/main
```

3. 依存パッケージを再インストールし、ビルドし直して起動します。

```bash
pnpm install --force --frozen-lockfile
pnpm build
pnpm start
```

staging(テスター向け)版では、手順1と2の代わりに次の2つのコマンドを実行します。

```bash
git fetch origin +refs/heads/staging:refs/remotes/origin/staging
git checkout -B staging origin/staging
```

> **Warning:** stagingのビルドは、リリース前のテスター向けビルドです。使う前にデータをバックアップしてください。

## アプリ内からのアップデート

MarinaraはGitHubを確認して、新しいバージョンがあるかを調べられます。インストールによっては、ブラウザーからアップデートを適用することもできます。

1. **Settings**(設定)を開きます。
2. **Advanced**(詳細設定)タブを開きます。
3. **Updates**(アップデート)セクションを探します。

### リリースチャンネルを選ぶ

**Release Channel**(リリースチャンネル)で、どのビルドを追うかを決めます。

- **Latest Stable:** `vX.Y.Z`のタグが付いたリリースです。通常はこちらを選びます。
- **Staging/UAT:** リリース前のテスター向けビルドで、未完成の場合があります。選ぶと「Staging builds are pre-release tester builds. Back up your app data before applying them.」という警告が表示されます。

サーバーを動かしているコンピューター上のブラウザーで別のチャンネルを選ぶと、アップデートのボタンが**Switch to**とチャンネル名の表示に変わります。このボタンは通常のアプリ内アップデートがオフでも動き、実行中は**Switching…**と表示されます。別のデバイスからは、後述の**Apply Update**(アップデートの適用)の条件を満たさないかぎり、この操作はできません。

### Check for Updates

**Check for Updates**(アップデートの確認)をクリックします。処理中はボタンに**Checking…**と表示されます。ボタンの下には、**Release**のバージョン、**Build**のコミットコード、わかる場合は**Branch**が表示されます。

- 最新の状態なら、緑の行に「You're on the latest」とバージョンが表示されます。
- 新しいリリースがある場合は、「vX.Y.Z available」と表示されたカードに**Release notes**リンクが付きます。
- gitのコピーが遅れている場合は、カードに「N commits behind」と表示されます。コミットとはコードに保存された変更1件のことなので、この数にはまだリリースされていない作業も含まれることがあります。

リリースの確認結果は約15分、コミット数は約5分キャッシュされます。そのため、すぐにもう一度クリックしても同じ数字が表示されることがあります。

確認に失敗すると「Could not check for updates. Try again later.」と表示されます。たいていはネットワークかGitHub側の問題です。

### Apply Update

**Apply Update**(アップデートの適用)は、ブラウザーからgitのコピーをアップデートします。このボタンは、次の条件がすべて満たされている場合にだけ表示されます。

- gitのコピーでインストールしていること。コンテナーやその他のインストールでは、この方法で適用できません。
- ブランチが`main`、`master`、`staging`のいずれかか、detached状態のチェックアウトであること。それ以外のブランチにあるコピーは開発用のチェックアウトとみなされ、Marinaraは適用を拒否します。
- サーバーの管理者が、サーバーの`.env`ファイルに`UPDATES_APPLY_ENABLED=true`を設定していること。
- `UPDATES_APPLY_DISABLED`が設定されていないこと。これはチャンネルの切り替えも含めてすべての適用を止める設定で、開発者向けのランチャーが設定します。

サーバーを動かしているコンピューターから適用する場合は、管理者用シークレットは不要です。Marinaraを`http://127.0.0.1:7860`または`http://localhost:7860`で開いてください。

次の2つの設定で、この扱いが変わります。

- リバースプロキシやトンネルが提供するアドレスは、別のデバイスとして扱われます。`REQUIRE_AUTH_FOR_LOOPBACK_PROXY=false`を設定すると、そうした訪問者もローカルとして扱われ、ローカルでは管理者用シークレットが不要になる扱いも適用されます。公開しているプロキシやトンネルでは、この設定をオンのままにしてください。
- `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK=true`を設定すると、ローカルからのリクエストでもシークレットが必要になります。

別のデバイスからの適用は、デフォルトでオフです。次の3つがすべて必要です。

- サーバーの`.env`に`UPDATES_ALLOW_REMOTE_APPLY=true`が設定されていること。
- サーバーの`.env`に`ADMIN_SECRET`が設定されていること。これは、危険を伴う操作のための2つ目のパスワードです。
- 同じシークレットが、手元のデバイスの**Settings → Advanced → Admin Access**(設定 → 詳細設定 → 管理者アクセス)に保存されていること。

**Apply Update**をクリックします。サーバーがコードを取得し、再インストールし、ビルドし直して停止するまでの間、ボタンには**Updating…**と表示されます。その後「Update applied successfully. Please relaunch the app to use the new version.」と表示されます。Marinaraを起動し直せば完了です。

うまくいかなかった場合: **Apply Update**が表示されないときは、その理由をMarinaraが表示します。

- コンテナーでのインストールでは、イメージのタグと、ホストで実行する`docker compose pull && docker compose up -d`コマンドが表示されます。
- 適用がオフになっているgitのコピーでは、コピーして使える手動のコマンドが表示されます。
- それ以外のインストールでは、GitHubのリリースへの**Download**リンクが表示されます。

## ブラウザーでアプリを再読み込みする

**Refresh App**(アプリの再読み込み)は、同じ**Updates**セクションにあります。これはサーバーをアップデートしません。サービスワーカー(アプリを速く読み込むためにブラウザーが使う小さなスクリプト)を削除し、ブラウザーのキャッシュを消去してから、ページを再読み込みします。チャットと設定はそのまま残ります。

サーバーのアップデートは済んでいるのに、アプリの表示が古いままだったり真っ白になったりするときに使います。処理中はボタンに**Refreshing…**と表示されます。

## データと任意のダウンロード

アップグレードで置き換わるのはアプリのコードだけで、データフォルダーや`marinara-data`ボリュームは置き換わりません。チャット、キャラクター、ペルソナ、ロアブック、プリセット、接続、設定はそのまま残ります。データの保存場所については、[Marinaraのバックアップと復元](data/backup-and-restore.md)を読んでください。

- **任意のパッケージ。** 公式のエージェント、マップ、通話、Conversationのゲームを同梱していたバージョンからアップグレードすると、最初の起動時に、対応する任意のパッケージをダウンロードします。選択、設定、履歴はそのまま残ります。この最初の起動の間は、サーバーをオンラインのままにしてください。ダウンロード元に接続できない場合、Marinaraは何も削除せず、次回の起動時にもう一度試します。
- **ガイドの言語。** ダウンロードしたドキュメント言語(**Settings → General → Documentation Language**(設定 → 一般 → ドキュメント言語))を使っている場合は、アップデート後の最初の起動時にその言語を最新の状態にします。ダウンロード元に接続できない場合は、インストール済みのパックをそのまま使い、パックにないガイドを英語で表示して、次回の起動時にもう一度試します。
- **画面の言語。** UI言語パックは、別に手動でダウンロードします。翻訳を同梱していたバージョンから初めてアップグレードすると、画面は英語に戻ります。**Settings → General → Language**(設定 → 一般 → 言語)で言語を選び直してください。その後のアップデートでは、ダウンロード済みのパックは保持されます。新しい翻訳を入れるには**Refresh language pack**(言語パックを更新)を使います。翻訳がない部分は英語で表示されます。

## 2.5.0からのアップデート

上の手順はこれまでと同じです。ただし、ほかのデバイスやほかの人が使うサーバーには、いくつかの変更が影響します。該当する場合は、詳細を開いてください。

<details>
<summary>共有サーバーに関する変更</summary>

- **同じコンピューター上のリバースプロキシやトンネル。** nginx、Caddy、Cloudflare Tunnel、Tailscale Serve、ngrokがMarinaraに中継した訪問者は、リモートとして扱われるようになりました。ログインがない場合、訪問者にはセットアップページが表示され、バックアップなどの保護された操作には管理者用シークレットが必要です。[同じコンピューター上のリバースプロキシとトンネル](REMOTE_ACCESS.md#reverse-proxies-and-tunnels-on-the-same-computer)を参照してください。
- **Tailscaleのログインバイパス。** このコンピューターのTailscaleアドレスへの直接接続は、引き続きログインを省略します。`100.64.0.0/10`からのそれ以外の接続はログインを省略しなくなり、Tailscale ServeやFunnel経由の訪問者にはログインが必要です。[TailscaleとDockerのバイパス](REMOTE_ACCESS.md#tailscale-and-docker-bypass)を参照してください。
- **パスワードや許可リストを設定したDocker。** ログイン(アプリのログインまたはBasic Auth)を設定している場合、ホストのコンピューター上のブラウザーでもログインを求められるようになりました。`TRUSTED_AUTH_PROXY`でも、接続してくるのがそのプロキシ自身でないかぎり、同じことが起こります。`IP_ALLOWLIST`だけを設定している場合は、コンテナーのゲートウェイをリストに加えないかぎりホストのブラウザーも拒否されるため、ログインを使ってください。[TailscaleとDockerのバイパス](REMOTE_ACCESS.md#tailscale-and-docker-bypass)を参照してください。
- **別のインストールに移したチャットとプロファイル。** チャットのログ、設定プロファイル、完全なプロファイルを別のインストールに移しても、**Discord Mirror**、**DeepLX URL**、**DeepL API Key**、**Intiface URL**は引き継がれなくなりました。移した先で入力し直してください。自分のプロファイルと、同じインストールに復元した完全なプロファイルでは、これらは保持されます。
- **アップデート後にログインできなくなりましたか?** [アップデート後にログインできなくなった場合](REMOTE_ACCESS.md#locked-out-after-updating)を参照してください。

</details>

<a id="downgrading-to-an-older-version"></a>

## 古いバージョンへダウングレードする

元のバージョンに戻せるとは限りません。新しいバージョンはデータを新しいストレージ形式で保存し、ビルドは自分が知っている形式より新しい形式のデータを拒否します。現在のビルドはストレージ形式10を使います。形式8、9、10では、それぞれMMDアバター、接続とアカウントのリンク、GLB/FBXアバターが追加されました。それより古い形式しか知らないビルドでは、これらの形式で保存したデータを開けません。

ランチャーは互換性のないバージョンに移ることになる自動アップデートをスキップし、アプリ内のアップデーターもその適用を拒否します。古いビルドへ戻すには、Marinaraを停止し、アップグレードする前に作成した完全なバックアップを復元してください。下のチャットファイルの変換コマンドでは、MMDアバターの設定を変換できません。形式番号を手作業で変更しないでください。

データがストレージ形式8より古い場合は、1つのコマンドでチャットファイルを以前の配置に戻せます。[古いバージョンへ切り替えたらチャットのメッセージが表示されない](TROUBLESHOOTING.md#chats-show-no-messages-after-switching-to-an-older-version)を参照してください。

<a id="going-back-to-250"></a>

### 2.5.0に戻す

バージョン2.5.0は、ストレージ形式8以降にアップグレードしたデータを開けません。アップグレード前に作成したバックアップを使ってください。

2.5.0が開ける古いデータでも、2.5.0は新しい機能が追加したデータを認識できません。具体的には、一部の接続設定、チャットの画像を再生成するための情報、ゲームのチェックポイント、ルールセットのクロック、シーン動画の一部です。2.5.0がチャットや接続を保存すると(たとえば、メッセージを送る、ゲームのターンを進める、画像を作る、接続を変更するといった操作のとき)、その新しいデータはチャット全体または接続全体から削除されます。もう一度アップデートしても、削除されたデータは戻りません。

元の状態にそのまま戻れるようにするには、アップデートの前にバックアップを作成してください。[事前のバックアップ](#back-up-first)を参照してください。

## アップデートに失敗したとき

失敗のほとんどは、古いNode.js、途中で終わったダウンロード、ブラウザーの古いキャッシュが原因です。

- Node.jsが古いとランチャーに表示された場合は、Node.js 24 LTSをインストールしてから起動し直します。
- サーバーのアップデート後にアプリの表示が崩れている場合は、**Refresh App**(アプリの再読み込み)をクリックします。
- gitのコピーがうまくアップデートできない場合は、[手動アップデート](#manual-update-git-copy-no-launcher)のコマンドを使います。

エラーメッセージと対処法は、[Marinara Engineのトラブルシューティング](TROUBLESHOOTING.md)を参照してください。

## 関連ガイド

- [Marinaraのバックアップと復元](data/backup-and-restore.md)
- [Marinara Engineのトラブルシューティング](TROUBLESHOOTING.md)
- [Windowsインストールガイド](installation/windows.md)
- [macOS / Linuxインストールガイド](installation/macos-linux.md)
- [コンテナーでの実行(Docker / Podman)](installation/containers.md)
- [Android(Termux)インストールガイド](installation/android-termux.md)
- [iOS / iPadOS PWAガイド](installation/ios-pwa.md)
