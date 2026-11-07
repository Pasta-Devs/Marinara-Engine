# ペルソナ

ペルソナとは、チャットの中で自分を表すキャラクターカードです。自分の名前、説明、そのほか任意の詳細からなります。Marinaraはこれらを毎回のプロンプトで送るため、AIは誰と話しているのかを把握できます。ペルソナはいくつでも持てて、チャットごとに1つを選べます。使い方は[チャットで使うペルソナの選択](choosing-your-persona.md)を参照してください。

## ペルソナの作成

1. 上部のナビゲーションバーで**Personas**(ペルソナ)をクリックします。見当たらない場合は、先に**More**(その他)を開きます。
2. **New**(新規作成)をクリックします。**Create Persona**(ペルソナの作成)ウィンドウが開きます。
3. **Name**(名前)に名前を入力します。必須の欄はこれだけです。
4. **Create**(作成)をクリックします。

ペルソナは説明が空の状態で作成され、Persona Editor(ペルソナエディター)で開きます。

5. **Card**タブを開き、**Description**に自分の名前、見た目、ふるまいを書きます。
6. ヘッダーの**Save**(保存)をクリックします。

その後、使いたいチャットでペルソナを選びます。[チャットで使うペルソナの選択](choosing-your-persona.md)を参照してください。

## ペルソナの役割

Marinaraは毎回のプロンプトで、ペルソナをAIに送ります。ペルソナを送らないようにするには、チャットで**None**(なし)を選びます。ペルソナがない場合、AIは「User」と呼びかけます。

`{{user}}`マクロはプレースホルダーです。Marinaraはプロンプトを送る前に、これをペルソナの名前に置き換えます。ペルソナの名前がAlexなら、`{{user}}`はAlexになります。[マクロ](../prompts/macros.md)を参照してください。

## Personasパネル

**Personas**パネルはペルソナのライブラリーです。行をクリックすると、そのペルソナがPersona Editorで開きます。

| 操作 | 動作 |
| --- | --- |
| **Download**(ダウンロード) | [Card Browser](bot-browser.md)を開きます。PlotLightのペルソナもここで探せます。 |
| **Open Library**(ライブラリーを開く) | 全画面のPersona Libraryを開きます。Character Libraryと同じグリッドとプレビューで表示されます。 |
| **New**(新規作成) | ペルソナを作成します。 |
| **Import**(インポート) | **Import Persona**(ペルソナのインポート)ウィンドウを開きます。 |
| **Select**(選択) | 一括削除と一括エクスポートのための選択モードをオンにします。 |
| 検索ボックス | プレースホルダーは**Search personas/tags**(ペルソナ/タグを検索)です。名前、説明、コメント、タグに一致するものを探します。タグでの検索については[検索](library-organization.md#search)を参照してください。 |
| 並べ替えのドロップダウン | **Manual order**(手動の順番)、**A-Z**、**Z-A**、**Newest**、**Oldest**、**Tokens**(プロンプトの推定サイズ)のいずれかです。 |
| **New Folder**(新しいフォルダー) | フォルダーを作成します。 |
| **Tags**(タグ) | 絞り込み用のタグ一覧を展開します。 |

**Manual order**では、行をドラッグするか、行にフォーカスを合わせて<kbd>Alt</kbd>+<kbd>Up</kbd>または<kbd>Alt</kbd>+<kbd>Down</kbd>を押します。タッチスクリーンでは、行を長押しして持ち上げます。行にカーソルを合わせると、**Duplicate**(複製)と**Delete**(削除)が表示されます。1ページに収まらないほどペルソナが多いときは、**Load more**(さらに読み込む)ボタンが表示されます。ペルソナが1つもないときは、パネルに**No personas yet**と表示されます。

## Persona Editor

ペルソナを開くと、チャット画面が全画面のPersona Editor(ペルソナエディター)に切り替わります。ヘッダーには次の要素があります。

- **Back**(戻る)矢印。
- アバターのタイル。クリックすると画像をアップロードできます。画像生成の接続を設定してある場合は、杖のボタンで画像を生成することもできます。
- 名前の欄と、コメントの欄。コメントの欄は、`Modern AU version`のような短いラベル用です。
- **Save**(保存)。何かを変更するまではオフのままです。
- **Export persona**(ペルソナのエクスポート)、**Add persona as character**(ペルソナをキャラクターとして追加)、**Duplicate persona**(ペルソナの複製)、**Delete persona**(ペルソナの削除)。

エディターを離れると、先に変更が保存されます。保存に失敗した場合は、下書きを残したままエディターが開いた状態になります。

タブは、**Metadata**、**Card**、**Convo**、**Lorebook**、**Sprites**、**Gallery**、**Colors**、**Stats**の順に並びます。各タブを押すと、1つの長いフォームの中の対応するセクションへ移動します。

ペルソナエディターは[キャラクターエディター](creating-and-editing-characters.md)と同じように動作します。以下では、異なる点を説明します。

| タブ | ペルソナ固有の注意点 |
| --- | --- |
| **Metadata** | 識別情報とライブラリーでの扱いに関する項目です。この表の下の一覧を参照してください。 |
| **Card** | 下の[Cardタブ](#card-tab)を参照してください。 |
| **Convo** | Conversationモードでのみ使われる欄です。[Conversationモードのプロフィール](../conversation/profiles.md)を参照してください。 |
| **Lorebook** | このペルソナがチャットにいるときに発動するロアブックのエントリーを紐付けます。[ロアブックの概要](../lorebooks/overview.md)を参照してください。 |
| **Sprites** | GameとRoleplayで使う立ち絵です。**Facial Expressions**、**Full-body**、**Clips**と、**Upload Folder**(フォルダーをアップロード)があります。[キャラクターのスプライト](sprites.md)を参照してください。 |
| **Gallery** | 資料用の画像と動画です。**Upload Persona Images**(ペルソナ画像のアップロード)と**Upload Persona Videos**(ペルソナ動画のアップロード)があります。[キャラクターとペルソナのギャラリー](galleries.md)を参照してください。 |
| **Colors** | 名前、セリフ、メッセージボックスの色です。[キャラクターの色とロールプレイ用ステータス](colors-and-stats.md)を参照してください。 |
| **Stats** | ステータスバーとRPGの能力値です。下の[Statsタブ](#stats-tab)を参照してください。 |

**Metadata**タブには次の項目があります。

- **Copy**(コピー)付きの**Persona ID**。
- アバターの切り抜き。
- **Name**と**Creator**。
- **Phonetic name**(読み仮名)。音声合成が自分の名前を読み上げるときにだけ使われます。
- **Title / Comment**。短いラベルです。
- **Version**。デフォルトは`1.0`で、**Automatic versioning**(自動バージョン管理)のスイッチがあります。
- **Tags**。
- **Creator Notes**。AIには送られません。

<a id="card-tab"></a>

### Cardタブ

**Card**タブには、AIに自分のことを伝える欄があります。各欄には推定トークン数がリアルタイムで表示されます。

| 欄 | 書く内容 | AIへの送信 |
| --- | --- | --- |
| **Summary**(概要) | ライブラリーやプレビュー用の概要です。 | いいえ |
| **Description** | 全体的な人物像と役割です。 | 毎回のプロンプト |
| **Personality** | 気質、ふるまい、話し方の癖です。 | はい |
| **Backstory** | 経歴、出自、人間関係です。 | はい |
| **Appearance** | 外見、服装、見た目の詳細です。 | はい |
| **Scenario** | ロールプレイでのデフォルトの状況です。 | はい |
| **Example Dialogue**(会話例) | やり取りの見本です。`<START>`で区切ります。ペルソナには`{{user}}`、相手のキャラクターには`{{char}}`を使います。 | はい |

**Appearance**の下にある**Image Appearance Override**(画像用の外見指定)は、キャラクターの場合と同じように動作します。[Cardタブ](creating-and-editing-characters.md#card-tab)を参照してください。テキストボックスはマクロに対応しています。

次の機能は、対象がペルソナになるだけで、キャラクターと同じように動作します。

- 各欄の上にある杖のボタンで、その欄を書いてもらえます。[杖でカードの欄を書く](creating-and-editing-characters.md#write-a-card-field-with-the-wand)を参照してください。
- 各欄の下にある**Add Alternative Field**(代替項目を追加)を使うと、選んだチャットで別のバージョンを使えます。**Active in**の一覧にはこのペルソナを使うチャットだけが表示され、チャットが別のペルソナを選ぶと割り当ては休止します。[選択したチャットで代替項目を使う](creating-and-editing-characters.md#use-an-alternative-field-in-selected-chats)を参照してください。
- **Version history**(バージョン履歴)は**Metadata**タブにあります。最初の編集の前は`Previous persona states will appear here after the next edit.`と表示されます。**Reset**(リセット)はすべてのスナップショットを削除し、バージョンを1.0に設定します。[バージョン履歴](creating-and-editing-characters.md#version-history)を参照してください。

<a id="stats-tab"></a>

### Statsタブ

**Stats**タブは、独立した2つのブロックに分かれています。どちらもHUDに反映されます。HUDとは、チャット中に画面に表示されるステータスのパネルです。

- **Enable Persona Stats**(ペルソナのステータスを有効化)は、ステータスバーをオンにします。ステータスバーとは、空腹や気分などの状態を示すメーターです。新しく有効にすると、Satiety、Energy、Hygiene、Moodが、いずれも最大100のうち100の状態で用意されます。値は物語の進行に合わせて**Persona Stats**エージェントが調整します。
- **Enable Roleplay Stats**(ロールプレイ用ステータスを有効にする)は、Pools(HPやMPなどのバー)とAttributes(筋力などの数値)をオンにします。どちらも[キャラクターの色とロールプレイ用ステータス](colors-and-stats.md)で説明しています。新しく有効にすると、HPとMPが最大100のうち100、STR、DEX、CON、INT、WIS、CHAが10で用意されます。これらは、戦闘とGame Modeのため、また任意のダイスロールのために、ペルソナといっしょに送られます。エージェントがこれらを更新することはありません。

**Game Mode Icon**(Game Modeのアイコン)ブロックでは、Game Modeの戦闘で自分のトークンに表示する画像を設定します。[Game Modeのアイコン](colors-and-stats.md#game-mode-icon)を参照してください。Game Modeのルールセット(卓上ゲーム風のゲームのためのルール一式)がインストールされていると、**Ruleset sheets**(ルールセットのシート)ブロックに、そのルールセットでの自分の開始時の構成が入ります。[ルールセットのシート](colors-and-stats.md#ruleset-sheets)を参照してください。ここで設定した値は、新しいチャットの開始時のデフォルトです。

## ペルソナのインポートとエクスポート

インポートするには、**Personas**パネルの**Import**(インポート)をクリックします。**Import Persona**(ペルソナのインポート)ウィンドウでは`.marinara`と`.json`のファイルを扱え、複数のファイルを一度に読み込めます。Marinaraのファイルは、詳細、スプライト、ギャラリーの構成を丸ごと復元します。ほかのツールの一般的なJSONファイルは、項目ごとに対応付けて新しいペルソナに取り込まれます。名前は必須です。各ファイルには成功か失敗かの印が表示されます。

エクスポートするには、エディターの**Export persona**(ペルソナのエクスポート)をクリックするか、選択モードで**Export**(エクスポート)を使います。**Export Persona**(ペルソナのエクスポート)ウィンドウでは、2つの形式を選べます。

| 形式 | 書き出される内容 |
| --- | --- |
| **Marinara Native** | Marinaraのペルソナの詳細、スプライト、紐付けたロアブックのすべてです。Marinaraのインストール環境どうしでペルソナを移すときに使います。 |
| **Compatible JSON** | ペルソナの基本的な欄だけです。ほかのツール向けです。 |

一括エクスポートでは、ペルソナごとに1ファイルを収めたzipファイルが1つダウンロードされます。

## ペルソナの複製と削除

複製するには、行の**Duplicate**(複製)か、エディターの**Duplicate persona**(ペルソナの複製)をクリックします。コピーの名前は「{original name} (Copy)」になり、カードの全項目、色、ステータス、Convoの項目が引き継がれます。どのチャットのペルソナも変わりません。

削除するには、行の**Delete**(削除)か、エディターの**Delete persona**(ペルソナの削除)をクリックし、確認します。元に戻すことはできません。まとめて削除するには、**Select**(選択)をクリックしてペルソナにチェックを入れ、選択バーの**Delete**を使います。削除に失敗したペルソナは選択されたまま残るので、やり直せます。

## ペルソナをキャラクターとして追加

エディターのヘッダーにある**Add persona as character**(ペルソナをキャラクターとして追加)を使うと、キャラクターに新しいカードが作成されます。名前、説明、性格、シナリオ、経歴、外見、タグ、作成者、バージョン、アバターがコピーされます。ペルソナは元のまま残ります。新しいカードの編集については[キャラクターの作成と編集](creating-and-editing-characters.md)を参照してください。

## 関連ガイド

- [チャットで使うペルソナの選択](choosing-your-persona.md)
- [キャラクターの色とロールプレイ用ステータス](colors-and-stats.md)
- [キャラクターの作成と編集](creating-and-editing-characters.md)
- [Conversationモードのプロフィール](../conversation/profiles.md)
- [マクロ](../prompts/macros.md)
