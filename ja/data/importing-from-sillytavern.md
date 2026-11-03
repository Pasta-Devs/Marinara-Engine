# SillyTavernからのインポート

SillyTavernのデータをMarinara Engineに取り込みます。ファイルを1つずつインポートすることも、SillyTavernのフォルダー全体をスキャンしてまとめて取り込むこともできます。

## 引き継げるもの

| SillyTavernのデータ | Marinaraでの扱い |
| --- | --- |
| キャラクター | キャラクター |
| チャットとグループチャット | チャット |
| プリセット | プリセット(生成設定をひとまとめにして保存したもの) |
| World Info | ロアブック(特定の言葉が出てきたときにAIが読むメモ) |
| 背景 | チャットの背景 |
| ペルソナ | ペルソナ(自分の代わりになるプロフィール) |

## 単一ファイルの簡易インポート

1. **Settings → Imports**(設定 → インポート)を開きます。
2. **SillyTavern Import**で、ファイルの種類に合うボタンをクリックします。
3. ファイルを選びます。

| ボタン | ファイル |
| --- | --- |
| **Import Character (JSON/PNG)** | `.json`または`.png`のキャラクターカード。 |
| **Import Chat (JSONL)** | `.jsonl`のチャット記録(1行に1件のJSONレコードを書く、SillyTavernがチャットを保存する形式)。 |
| **Import Preset (JSON)** | `.json`のプリセット。 |
| **Import Lorebook (JSON)** | `.json`のWorld Infoファイル。 |

これらのボタンに設定はありません。キャラクターのインポートでは、元のタグをすべて引き継ぎ、正規表現スクリプトの適用範囲をそのキャラクターに限定します。正規表現スクリプトとは、テキストを検索して置き換えるルールです。この2つを自分で選ぶには、Charactersパネルの**Import**を使ってください。[キャラクターカードのインポートとエクスポート](../characters/import-export.md)を参照してください。

キャラクターカードの中にロアブックが入っていると、独立したロアブックとしてインポートするかどうかをブラウザーが確認します。後で使い回せるロアブックとして残すなら**OK**を、キャラクターだけをインポートするなら**Cancel**をクリックします。

**Import Chat (JSONL)**は、ファイルに別のモードが記録されていない限りRoleplayのチャットを作成し、そのチャットを開きます。

### モードを指定したチャットのインポート

モードを選ぶには、チャット一覧の上部にあるインポートボタンを使います。ツールチップは**Import SillyTavern or Marinara chat JSONL**です。開いているモードのタブ(Conversation、Roleplay、Game)にインポートします。[チャットのエクスポートとインポート](../chats/export-import.md)を参照してください。

## SillyTavernフォルダーのインポート

始める前に: ウィザードは、サーバーのコンピューター上のファイルを読み取ります。SillyTavernが別のコンピューターにある場合は、先にそのフォルダー(SillyTavernをインストールしたフォルダー)をMarinaraのコンピューターにコピーしてください。Marinaraのコンピューターでは、ウィザードはそのまま使えます。別のデバイスから使う場合は、管理者用のシークレットを設定し、**Settings → Advanced → Admin Access**に入力してください。[Marinaraのバックアップと復元](backup-and-restore.md)と、[サーバー設定リファレンス](../CONFIGURATION.md)の「Privileged APIs (ADMIN_SECRET)」のセクションを参照してください。

1. **Settings → Imports → SillyTavern Import**を開きます。
2. **Import from SillyTavern Folder**をクリックします。
3. SillyTavernのフォルダーを選びます。メインフォルダーを選んでください。通常は`data/`または`public/`のフォルダーがあるフォルダーです。次のいずれかの方法を使います。
   - **Browse**をクリックして、フォルダーを選びます。
   - フォルダー選択画面がない場合(リモートサーバー)は、アプリ内蔵のフォルダーブラウザーが開きます。ここには、サーバーを動かしているユーザーのホームフォルダー内のフォルダーだけが表示されます。**Select This Folder**をクリックします。
   - **SillyTavern Folder Path**にパスを入力します。例: `/path/to/SillyTavern`。入力したパスが使えるのは、サーバーの`IMPORT_ALLOWED_ROOTS`設定に、そのパスを含むフォルダーが挙げられている場合だけです。
4. **Scan Folder**をクリックします。Marinaraが、カテゴリーごとに見つかった件数を表示します。
5. **Choose exactly what to import**で、取り込みたい項目にチェックを入れます。カテゴリーごとに**All**と**None**のボタンがあり、個々の項目には**Show**と**Hide**のトグルがあります。
6. **Import Selected**をクリックします。進行状況バーに、処理中の項目とカテゴリーごとの件数が表示されます。
7. **Import complete!**と表示されたら、カテゴリーごとの件数を確認し、**Done**をクリックします。

ほとんどの項目は、最初から選択されています。SillyTavern標準のプリセット(`deterministic`、`neutral`、`universal-*`など)は、Marinaraがチェックを外したままにし、バナーでそのことを知らせます。コピーが必要でない限り、チェックは外したままにしてください。

スキャンでキャラクターが見つかると、さらに2つの設定が表示されます。

**Imported character tags**(デフォルトは**All tags**)

- **All tags**は、元のタグを残します。
- **No tags**は、タグを取り込みません。
- **Existing only**は、すでにあるタグだけを残します。

**Imported regex scripts**(デフォルトは**Character only**)

- **Character only**は、スクリプトを各キャラクターに適用します。
- **Global**は、すべてのチャットに適用するために、**Presets → Regexes**へ追加します。

うまくいかなかった場合:

- 「Could not find SillyTavern data directory.」は、Marinaraがそのフォルダーを読み取れないという意味です。SillyTavernのメインフォルダーを選んでください。
- 「folderPath is not allowed」は、サーバーがそのパスを拒否したという意味です。代わりに**Browse**をクリックして、フォルダーを選んでください。サーバーの管理者は、`IMPORT_ALLOWED_ROOTS`設定で、インポートできるフォルダーを制限できます。この設定がある場合は、選んだフォルダーであっても、挙げられたフォルダーのどれかの中にある必要があります。サーバーを運用している人に尋ねるか、[サーバー設定リファレンス](../CONFIGURATION.md)を参照してください。
- 項目が1つ失敗した場合、Marinaraはその項目を飛ばして処理を続け、最後のステップの警告に`Character "Foo": error message`のような形で一覧表示します。

## データの扱い

- 1つのキャラクターに属するチャットファイルは、1つのチャットの分岐としてインポートされます。分岐とは、チャットのコピーを別々に続けるものです。
- グループチャットは、Roleplayのチャットとしてインポートされます。
- インポートした項目には、インポートした日付ではなく、元のファイルの最終更新日が付きます。

## 引き継がれないもの

ウィザードが読み取るのは、最初の表にあるカテゴリーだけです。アプリ全体の設定やクイックリプライなど、他のSillyTavernのデータはインポートされません。

## 関連ガイド

- [キャラクターカードのインポートとエクスポート](../characters/import-export.md)
- [ロアブックのインポートとエクスポート](../lorebooks/import-export.md)
- [チャットのエクスポートとインポート](../chats/export-import.md)
- [正規表現スクリプト](../extending/regex-scripts.md)
