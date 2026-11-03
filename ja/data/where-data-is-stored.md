# Marinaraがデータを保存する場所

Marinara Engineがデータを保存しているフォルダーを見つけます。データを移したりコピーしたりするときに、どの部分を残すべきかもわかります。

Marinara Engine(以下Marinara)は手元のコンピューターで動き、キャラクター、チャット、設定をそこに保存します。返信を生成するときは、接続したAIサービスへチャットの内容が送られます。

## データフォルダーの見つけ方

作成したものはすべて、サーバーを動かしているコンピューター上の1つのフォルダーに入ります。これがデータフォルダーです。この場所の設定は`DATA_DIR`で、サーバーを起動する前に渡す値(環境変数)です。**Settings**(設定)の中にはありません。

- デフォルトでは、サーバーのファイルの隣にある`data`という名前のフォルダーです。
- 公式のDockerコンテナーでは、`/app/data`です。
- 正確なパスを確認するには、Marinaraを起動したウィンドウ(ターミナルまたはコンソール)を見ます。起動すると、`[storage] DATA_DIR=`で始まる行に続けてパスが出力されます。そのウィンドウが見つからない場合は、Marinaraのフォルダーの中にある`data`という名前のフォルダーを探してください。

フォルダーを移すには、`DATA_DIR`を設定してMarinaraを再起動します。[サーバー設定リファレンス](../CONFIGURATION.md)を参照してください。

## 中に入っているもの

テキストデータは`storage`フォルダーにあります。キャラクター、チャット、メッセージ、ロアブック、プリセット、接続です。Marinaraはこれを多数の小さなファイルとして保存します。古い構成からアップグレードした後は、`storage/tables/`に、名前が`.pre-shard`で終わる古いコピーが見つかることがあります。Marinaraはこれを削除しません。すべてが動くことを確認できたら、空き容量を増やすために自分で削除できます。

画像、音声、その他のファイルは、`storage`の隣にある専用のフォルダーに入ります。フォルダー名は次のとおりです。

| フォルダー | 入っているもの |
| --- | --- |
| `avatars` | キャラクターとペルソナのアバター |
| `sprites` | キャラクターのスプライト画像 |
| `avatar-models` | **2D Avatars**と**3D Avatars**エージェントのファイル。PNGTuberの画像や3Dモデルなど |
| `backgrounds` | アップロードしたチャットの背景 |
| `gallery` | ギャラリーの画像 |
| `fonts` | 追加したカスタムフォント |
| `knowledge-sources` | 知識エージェント用にアップロードしたファイル |
| `game-assets` | Game Modeのアセット |
| `game-scene-videos` | Game Modeのシーン動画 |
| `conversation-call-character-videos` | Conversationの通話で使うキャラクターの動画 |
| `custom-emojis` | カスタム絵文字の画像 |
| `custom-stickers` | カスタムスタンプの画像 |
| `notification-sounds` | 自分で設定した通知音 |
| `long-term-memory` | 長期記憶エージェント用のデータ |
| `lorebooks/images`、`prompts/images`、`agents/images`、`connections/images` | ロアブック、プリセット、エージェント、アカウントに付けた画像 |

データフォルダーには、`backups/`([自動バックアップ](backup-and-restore.md#automatic-backups))と、暗号化キーのファイルも入っています。**Download Backup**には、表のすべてのフォルダー、`storage`、キーのファイルが含まれます。開発者は[ファイルネイティブストレージ](../development/file-storage.md)を読んでください。

## 暗号化キーのファイルを残す

Marinaraは、保存したAPIキーを暗号化します。そのためのキーが、データフォルダー内の`.encryption-key`ファイルです。

このファイルなしでデータを新しいコンピューターにコピーすると、Marinaraは保存したAPIキーを読み取れません。APIキーを入力し直すことになります。データフォルダーの残りと一緒にコピーしてください。

構成によっては、ファイルの代わりに`ENCRYPTION_KEY`環境変数でキーを渡します。その場合、コピーするファイルはありません。その値を別に安全に保管してください。[サーバー設定リファレンス](../CONFIGURATION.md)を参照してください。

## Androidからのデータのコピー

Androidでは、データフォルダーはroot権限なしでは手が届かないアプリのストレージにあるため、コピーできません。**Settings → Advanced → Backup & Export → Download Backup**を使ってください。`.zip`には、`.encryption-key`ファイルが存在すれば含まれます。[Marinaraのバックアップと復元](backup-and-restore.md)を参照してください。

自動バックアップは、同じアプリのストレージに保存されます。アプリをアンインストールしたりリセットしたりすると、実データと一緒に消えることがあります。コピーを別の場所にも置いてください。

## 関連ガイド

- [Marinaraのバックアップと復元](backup-and-restore.md)
- [データの消去とリセット](clearing-data.md)
- [サーバー設定リファレンス](../CONFIGURATION.md)
- [ファイルネイティブストレージ](../development/file-storage.md)
