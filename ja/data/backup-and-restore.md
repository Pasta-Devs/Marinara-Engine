# Marinaraのバックアップと復元

Marinara Engineのデータのコピーを保存し、後から戻す方法を説明します。アップデートの前、新しいデバイスへの移行前、[データを消去する](clearing-data.md)前に行ってください。

## 使う方法の選び方

| 方法 | 作られるもの | 用途 |
| --- | --- | --- |
| **Download Backup** | すべてのデータとファイルを収めた`.zip`。 | すべてをまるごと1つにしたコピー。 |
| **Export Profile** | アカウントのデータ(キャラクター、チャット、ロアブックなど)だけを収めた小さめのファイル。 | 秘密の値を含まないコピーや、他のツール向けのファイル。 |

`.zip`は、たくさんのファイルを1つにまとめたファイルです。どちらの方法も**Settings → Advanced → Backup & Export**(設定 → 詳細設定 → バックアップとエクスポート)にあります。復元は**Settings → Imports → Profile & Marinara**(設定 → インポート → プロファイルとMarinara)で行います。

**始める前に:** Marinaraを動かしているコンピューターでは、これらの機能はそのまま使えます。スマートフォン、タブレットなどの別のデバイスから使う場合は、サーバーに管理者用のシークレットを設定し、同じ値を**Settings → Advanced → Admin Access**に入力してください。管理者用のシークレットは、サーバーの`.env`ファイルに`ADMIN_SECRET`という設定で書くパスワードです。[サーバー設定リファレンス](../CONFIGURATION.md)の「Privileged APIs (ADMIN_SECRET)」のセクションと[リモートアクセス](../REMOTE_ACCESS.md)を参照してください。

## Download Backup

1. **Settings → Advanced**を開きます。
2. **Backup & Export**で**Download Backup**をクリックします。ボタンの表示は**Creating backup…**になります。
3. ブラウザーが確認したらファイルを保存します。または、ダウンロードフォルダーで見つけます。

`.zip`には次のものが入っています。

- 保存済みのテキストデータ(キャラクター、チャット、ロアブック、プリセット、接続、設定)
- アップロードしたファイルと生成したファイル(アバター、スプライト、背景、ギャラリーの画像、フォント、カスタム絵文字とスタンプ、自分で設定した通知音など)
- `.encryption-key`ファイル(存在する場合)
- 手作業での復元方法を書いた`RESTORE.txt`のメモ([手作業での復元](#restore-by-hand)を参照)

フォルダー名については、[Marinaraがデータを保存する場所](where-data-is-stored.md)を参照してください。

> **Warning:** バックアップには、保存済みのAPIキーと、それを復号する`.encryption-key`ファイルが入っています。絶対に共有しないでください。他人に見られない場所に保管してください。

Androidではアプリのデータフォルダーに手が届きません。そのため、デバイスの外にコピーを取り出すには**Download Backup**を使います。

うまくいかなかった場合: 「Backup preparation timed out after one hour.」と表示されたら、もう一度試してください。別のデバイスからダウンロードできない場合は、**Admin Access**を確認してください(上記を参照)。

<a id="automatic-backups"></a>

## 自動バックアップ

Marinaraは、動かしているコンピューター上で、スケジュールに沿って完全バックアップを作れます。

1. **Settings → Advanced → Backup & Export**を開きます。
2. **Automatic backups**をオンにします。
3. **Daily**、**Weekly**、**Monthly**のいずれかを選びます。
4. **Automatic backups kept**を1から9999までの範囲で設定します。

Marinaraは、オンにしてまもなく最初のバックアップを作ります。実行のたびに、新しいバックアップを設定した数まで残し、古い自動バックアップを削除します。**Download Backup**で作ったバックアップは削除しません。

自動バックアップは、データフォルダー内の`backups/`フォルダーにあります。最新のものは`marinara-automatic-backup.zip`です。古いものは、名前に日付と時刻が付きます。形式は**Download Backup**と同じです。

新しいアーカイブが完成するまで古いものが残るため、実行のたびに完全なアーカイブ1つ分の空き容量が必要です。空き容量が足りないと、Marinaraはその回をスキップし、設定の横に理由を表示します。空き容量ができたら、再試行します。

> **Tip:** データフォルダーの外にも、コピーをもう1つ置いてください。ディスクの故障やアプリの消去では、自動バックアップも一緒に消えます。

## プロファイルのエクスポート

1. **Settings → Advanced → Backup & Export**を開きます。
2. **Export Profile**をクリックします。同じタイトルのウィンドウが開きます。
3. 形式を選びます。
4. ブラウザーがファイルをダウンロードします。

- **Marinara Native**は、キャラクター、ペルソナ、チャット、ロアブック、プリセット、エージェント、テーマ、Personal Extensionのコード、メディアを保持します。APIキー、Webhookのリンク、一部のチャット設定は復元されません([キーの再入力](#enter-your-keys-again)を参照)。Marinaraで復元できます。
- **Compatible JSON**は、他のツール向けに、素のキャラクター、ペルソナ、ロアブックのファイルを集めた`.zip`を作ります。Marinaraでは復元できません。

ネイティブ形式のプロファイルは、`marinara-profile.json`としてダウンロードされます。大きすぎる場合、MarinaraはZIPファイルを代わりに提案します。**Export ZIP**をクリックすると、`marinara-profile.zip`がダウンロードされます。

ネイティブ形式のプロファイルにはPersonal Extensionのコードも残りますが、有効かどうかの状態と承認は残りません。復元された拡張機能はすべて無効の状態で入ります。**Settings → Addons**で、もう一度確認してください。

## Import Profileでの復元

**Import Profile**は、プロファイルのファイルまたは**Download Backup**の`.zip`を読み込みます。

1. **Settings → Imports**を開きます。
2. **Profile & Marinara**で**Import Profile (JSON/ZIP)**をクリックします。
3. `marinara-profile.json`、`marinara-profile.zip`、またはバックアップの`.zip`を選びます。ボタンの表示は**Scanning Profile...**になります。
4. **Import Profile**ウィンドウを読みます。Marinaraが見つけた内容が一覧表示され、インポートは取り消せないという警告が出ます。
5. 続けるなら**Import**を、やめるなら**Cancel**をクリックします。ボタンの表示は**Importing Profile...**になり、進捗バーが続きます。完了すると、プロファイルをインポートしたというメッセージが表示されます。

うまくいかなかった場合:

- `localhost`、`127.0.0.1`、`[::1]`以外でMarinaraを開いている場合、プロファイルのインポートにはHTTPSが必要です。エラーは「Profile import requires HTTPS outside local development.」です。HTTPSのアドレスでMarinaraを開いてください。
- `.zip`の中にメディアのファイルが一部欠けていても、インポートは最後まで進みます。欠けているものを列挙した警告が表示され、Marinaraは残りをインポートします。

同じプロファイルを2回インポートすると、Marinaraは項目をコピーせずに更新します。かなり古いバージョンのプロファイルでは、重複が作られることがあります。

<a id="enter-your-keys-again"></a>

## キーの再入力

**Import Profile**は、**Download Backup**の`.zip`からでも、APIキーとWebhookのリンクを復元しません。APIキーとは、サービスが発行する秘密のコードです。プロファイルのファイルと、バックアップの中のプロファイルでは、これらの値が空になっています。そのため、新しいコンピューターにインポートした後は、次の手順で入力し直します。

1. 上部バーから**Connections**を開きます。
2. 使っているアカウントを1つずつ開き、APIキーを入力して保存します。[AIプロバイダーへの接続](../connections/connecting-to-a-provider.md)を参照してください。
3. Webhookのリンクを使うカスタムツールごとに、リンクを入力し直します。

アドレスやキーを含む一部のチャット設定(Discord、DeepL、Intiface)も、空の状態で戻ります。各チャットの**Chat Settings**で入力し直してください。

インポートで、同じインストールにすでに設定したキーが空になることはありません。

## 新しいコンピューターへの移行

1. 新しいコンピューターにMarinaraをインストールして起動します。[インストール](../INSTALLATION.md)を参照してください。
2. **Settings → Imports → Profile & Marinara**を開き、**Import Profile (JSON/ZIP)**をクリックします。
3. **Download Backup**の`.zip`またはプロファイルのファイルを選び、**Import**をクリックします。
4. 上で説明したとおり、APIキーを入力し直します。

バックアップに入っているキーのファイルが役に立つのは、次のようにデータフォルダー全体を手作業でコピーする場合だけです。

<a id="restore-by-hand"></a>

## 手作業での復元

**Import Profile**が使えない場合にだけ使ってください。`.zip`の中には、たとえば`marinara-backup-...`のようなフォルダーが1つあり、`RESTORE.txt`のメモが入っています。

1. Marinaraを停止します。
2. バックアップを展開します。
3. 展開したフォルダーから、各フォルダーと`.encryption-key`ファイルを、データフォルダーへコピーします。[Marinaraがデータを保存する場所](where-data-is-stored.md)を参照してください。
4. Marinaraを起動します。

`.encryption-key`ファイルは`storage`フォルダーと一緒に置いてください。そうしないと、保存済みのAPIキーを読み取れません。

**Backup & Export**の**Existing backups**一覧は、通常は空です。この一覧は使う必要がありません。

## 関連ガイド

- [Marinaraがデータを保存する場所](where-data-is-stored.md)
- [データの消去とリセット](clearing-data.md)
- [Marinara Engineのアップデート](../UPGRADING.md)
- [AIプロバイダーへの接続](../connections/connecting-to-a-provider.md)
- [リモートアクセス: ログインとIP許可リスト](../REMOTE_ACCESS.md)
