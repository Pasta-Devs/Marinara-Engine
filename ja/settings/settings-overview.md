# 設定の概要

**Settings**(設定)のどこに目的のコントロールがあるのかを調べ、**General**タブを設定し、設定がデバイス間で同期する仕組みを学びます。

## Settingsパネルと6つのタブ

上部バーの歯車アイコンから**Settings**を開きます。パネルの上部にある**Search settings**ボックスで、名前から設定を探せます。`delete`、`streaming`、`quotes`のような語句を入力すると、Marinaraが該当するセクションまで移動します。画面の言語での名前でも英語の名前でも一致します。

パネルには6つのタブがあります。各タブには、それぞれのセクションがあります。

### やりたいこと

| やりたいこと | 移動先 |
| --- | --- |
| 言語を変える | **Settings → General → App Behavior → Language** |
| 文字を大きくする | **Settings → Appearance → App → Text & Scale** |
| テーマや色を変える | **Settings → Appearance → App → App Style** |
| 通知音を設定する | **Settings → General → Notifications** |
| 削除の確認を止める | **Settings → General → App Behavior** |
| クイック返信を追加する | **Settings → General → Input & Editing** |
| バックアップを取る | **Settings → Advanced → Backup & Export** |
| データを削除する | **Settings → Advanced → Danger Zone** |
| Marinaraをアップデートする | **Settings → Advanced → Updates** |

### 各タブの内容

**General**(このガイド)

- **App Behavior**(**Search and Professor Mari settings**の行を含む)
- **Notifications**
- **Responses**
- **Input & Editing**
- **Text Rules**
- **Game Playback**

**Appearance**には4つのボタンがあります。[外観の設定](../appearance/appearance-settings.md)を参照してください。

- **App**: **App Style**、**Text & Scale**、**Atmosphere**、**Backgrounds**
- **Conversation**: **Conversation Display**、**Conversation Theme**
- **Roleplay**: **Tracker Panel**、**Roleplay Presentation**
- **Game**: **Game Presentation**

**Generations**には、**Overall Generations**、**Image Generation**、**Video Generation**、**Prompt Overrides**があります。Illustratorエージェントをインストールするまで、このタブにはダウンロードを促す表示だけが出ます。[スタイルプロファイル](../media/style-profiles.md)と[シーン動画](../media/scene-video.md)を参照してください。

**Addons**には、拡張機能の変更履歴、**Personal Extensions**、**External Extensions**(解放した場合のみ)、**Theme Library**があります。[個人用拡張機能](../extending/personal-extensions.md)と[カスタムCSSテーマ](../appearance/custom-css-themes.md)を参照してください。

**Imports**には、**Profile & Marinara**、**SillyTavern Import**、**Game Assets**があります。[Marinaraのバックアップと復元](../data/backup-and-restore.md)と[SillyTavernからのインポート](../data/importing-from-sillytavern.md)を参照してください。

**Advanced**には、次のセクションが、この順序で並びます。[Advancedタブ](#the-advanced-tab)を参照してください。

- **Multiplayer WIP**
- **Access**
- **Admin Access**
- **Features**
- **Updates**
- **Support Diagnostics**
- **Request timeouts**
- **Parameters**
- **Message Tools**
- **Backup & Export**
- **Storage Optimization**
- **Danger Zone**

## Generalタブ

**General**タブの各セクションは、**Settings → General**にあります。

| セクション | 制御する内容 |
| --- | --- |
| **App Behavior** | 言語、削除時の安全確認、表示と非表示のスイッチ、**Search and Professor Mari settings**の行。[App Behavior](#app-behavior)を参照してください。 |
| **Notifications** | 通知音、ブラウザーとAndroidの通知。[Notifications](#notifications)を参照してください。 |
| **Responses** | ストリーミング、トリミング、**Messages per page**。[メッセージの送信とストリーミング](../chats/sending-and-streaming.md)を参照してください。 |
| **Input & Editing** | **Send on Enter**、**Quick replies**、スワイプと編集のショートカット。[Input and Editing](#input-and-editing)を参照してください。 |
| **Text Rules** | チャットの文章の整形方法。[Text Rules](#text-rules)を参照してください。 |
| **Game Playback** | Game Modeでの読み進め方と画面移動。[Game Mode: はじめに](../game/getting-started.md)を参照してください。 |

### App Behavior

| 設定 | 働き |
| --- | --- |
| **Language** | 画面の表示言語を設定します。モデルへのプロンプトやチャットの内容は変わりません。まだ翻訳されていないテキストは英語で表示されます。アラビア語では右から左に読むレイアウトになります。デフォルトは英語です。 |
| **Documentation Language** | 組み込みのガイドの言語を設定します。下記を参照してください。デフォルトは英語です。 |
| **Confirm before deleting** | チャット、キャラクター、その他の項目を完全に削除する前に、Marinaraが確認します。デフォルトはオンです。 |
| **Hide chat Help button** | Conversation、Roleplay、Gameのチャットから**Help**ボタンを隠します。デフォルトはオフです。 |
| **Show Android status bar** | 時刻、バッテリー、通知アイコンをMarinaraの上に表示したままにします。Androidアプリでだけ働きます。デフォルトはオフです。 |
| **Achievements** | 実績を記録し、解除の通知、ホームのブックマーク、ウィジェットを表示します。[実績](../home/achievements.md)を参照してください。デフォルトはオンです。 |
| **Disable seasonal ME themes** | Marinaraの季節限定テーマをオフにします。デフォルトはオフです。 |
| **Music Player** | コンパクトなMusic Playerを表示します。**Agents → Agent Organizer**の**Music DJ**エージェントが必要で、インストールするまでグレー表示のままです。[Music DJ](../media/music.md)を参照してください。デフォルトはオンです。 |

**Search and Professor Mari settings**は、**App Behavior**の最下部にある行です。**Open**を選ぶと、Search、クイック回答、Professor Mariの設定ページに移動します。[Professor Mari](../home/professor-mari.md)を参照してください。

画面の表示言語は、アラビア語、簡体字中国語、英語、フランス語、ドイツ語、ヒンディー語、日本語、韓国語、ポーランド語、ブラジルポルトガル語、ロシア語、スペイン語です。翻訳を改善したい場合や言語を追加したい場合は、[UIのローカライズ](../development/localization.md)を参照してください。

**Documentation Language**では、英語は最初から入っています。別の言語を選んで**Download & Replace**をクリックします。Marinaraはその言語パックを一度だけダウンロードして、前のパックを削除します。そのため、ダウンロード済みの言語は1つだけです。まだ翻訳されていないガイドは、小さな`EN`バッジ付きで英語のまま開きます。ガイド検索は、選択中の言語で動作します。選んだ言語はアップデート後も引き継がれ、翻訳に変更があったパックは、アップデート後に再取得されます。ダウンロードしたガイドが失われたり壊れたりした場合は、**Fix documentation**ボタンが現れます。このボタンはパックを再ダウンロードします。ダウンロード元に接続できないときは、ガイドを英語に戻します。

### Notifications

Marinaraは、通知に標準の音を鳴らします。自分の音を使うには、次の手順に従います。

1. **Settings → General → Notifications**を開きます。
2. **Custom sound**をアップロードします。MP3、WAV、OGG、M4A、MP4、WebMのいずれかで、10 MBまでです。

この音は、このサーバーに接続しているすべてのデバイスで鳴ります。試聴、差し替え、削除ができます。ファイルを読み込めない場合、Marinaraは標準の音を鳴らします。このファイルは、バックアップとプロファイルのエクスポートに含まれます。

**Background Notifications**は、キャラクターが自分から送るConversationのメッセージが対象です。**Generation Completion Notifications**は、Conversation、Roleplay、Game Modeで自分から始めた返信が対象です。どちらも、Marinaraを開いていてもフォーカスが外れているときに動作します。メッセージの中身は表示しません。

### Input and Editing

**Settings → General → Input & Editing**の設定は次のとおりです。

| 設定 | 働き |
| --- | --- |
| **Send on Enter** | Enterキーを押したときに送信するモードを選びます。 |
| **Keep guidance after regenerating** | ガイド付きの再生成の後も、指示をメッセージ入力欄に残します。デフォルトでオンです。 |
| **Add CYOA choices to the message box instead of sending them** | クリックした選択肢をメッセージ入力欄に入れるので、送信する前に編集できます。 |
| **Quick replies** | 送信ボタンの横に、下書きを作る操作を追加します。[ガイド付き生成とImpersonate](../chats/guided-and-impersonate.md)を参照してください。 |
| **Speech-to-text microphone** | チャットの入力欄にマイクのボタンを表示します。 |
| **Intuitive swipe navigation** | 矢印キーや画面のスワイプで、スワイプ(1つのメッセージに残した複数の回答)を切り替えます。 |
| **Reroll past the newest swipe** | いちばん新しいスワイプの先へ進んだときに、新しい返信を生成します。 |
| **Up Arrow edits last message** | 入力欄が空の状態でUp Arrowを押すと、直前のメッセージを編集できます。 |
| **Double-click edits messages** | Roleplayのメッセージをダブルクリックすると編集できます。 |

**Responses**セクションには、**Enable streaming**、**Streaming speed**、**Trim incomplete sentences from the response**、**Add a new line before /continue text**(デフォルトでオン)、**Messages per page**があります。[メッセージの送信とストリーミング](../chats/sending-and-streaming.md)を参照してください。メッセージの操作については、[メッセージの操作](../chats/messages.md)を参照してください。

### Text Rules

これらのルールは、**Settings → General → Text Rules**で、チャットの文章の扱い方を変えます。**Bold dialogue in quotes**と**Convert LaTeX symbols**は見た目だけを変えるので、保存済みのメッセージは変わりません。**Quote style**は、入力して保存する文章の引用符を書き換えます。

| 設定 | 働き |
| --- | --- |
| **Bold dialogue in quotes** | 引用符で囲まれた文章を太字で表示します。デフォルトでオンです。 |
| **Convert LaTeX symbols** | LaTeXの数式コマンドを記号として表示します。コードはそのままです。デフォルトでオンです。 |
| **Quote style** | **Straight**はまっすぐな記号のままにします(デフォルト)。**Typographic**は、曲がった引用符とアポストロフィーに書き換えます。 |
| **Load images from other websites in messages** | ほかのWebサイトにある画像の扱いを決めます。デフォルトでオフです。 |

#### Bold dialogue in quotes

オンにすると、`"I missed you," she said.`の引用符の中の言葉が太字で表示されます。セリフの色だけを残して太字をやめたいときは、オフにします。

#### Convert LaTeX symbols

モデルによっては、数式をLaTeXのコマンドで書きます。オンにすると、`\rightarrow`、`\neq`、`\times`、`\alpha`が、`→`、`≠`、`×`、`α`として表示されます。

#### Load images from other websites in messages

オフのあいだは、メッセージ、挨拶メッセージ、カードのプレビューにあるほかのWebサイトの画像の代わりに、そのWebサイトの名前と**Load image**ボタンが表示されます。これで、メッセージが勝手にほかのサイトへ接続することはなくなります。**Load image**を選ぶと、その画像が表示されます。Marinaraは、その選択をすべてのデバイスで記憶します。すべての画像をすぐに表示するには、この設定をオンにします。ギャラリーの画像、アバター、スプライトなど、Marinaraに保存されている画像は、常に表示されます。

<a id="the-advanced-tab"></a>

## Advancedタブ

| セクション | 詳しい情報 |
| --- | --- |
| **Admin Access** | [リモートアクセス](../REMOTE_ACCESS.md) |
| **Features** | [機能スイッチ](../configuration/features.md) |
| **Updates** | [Marinara Engineのアップデート](../UPGRADING.md) |
| **Message Tools** | [Message Tools](#message-tools) |
| **Backup & Export** | [Marinaraのバックアップと復元](../data/backup-and-restore.md) |
| **Danger Zone** | [データの消去とリセット](../data/clearing-data.md) |

### Message Tools

これらのスイッチは、**Settings → Advanced → Message Tools**にあります。**Show context usage**と**Show "older messages not sent" note**を除いて、すべてデフォルトでオフです。

| スイッチ | 働き |
| --- | --- |
| **Show message timestamps** | メッセージごとに日付と時刻を表示します。 |
| **Show characters in Persona pickers** | ペルソナの選択画面に自分のキャラクターも並べるので、キャラクターになりきってプレイできます。 |
| **Show model name on messages** | 返信を書いたモデルの名前を表示します。 |
| **Show token usage on messages** | メッセージごとに、プロンプトと返信のトークン数を表示します。 |
| **Show context usage** | 最後に計測したリクエストで、コンテキストウィンドウがどれだけ埋まっていたかを、接続の切り替えメニューとGameのチャット設定に表示します。 |
| **Show message numbers** | メッセージごとに番号を表示します。 |
| **Show "older messages not sent" note** | 古いメッセージがプロンプトに収まらなかったときに、最新の返信の下に注記を表示します。途中で切れた返信や空の返信には、それぞれの注記が引き続き表示されます。 |
| **Guide swipes/regens with chat input** | 再生成のときに、入力欄の下書きを指示として使います。 |
| **Include reasoning in exports** | モデルの表に出ない思考を、チャットのエクスポートに含めます。 |
| **Include private notes in exports** | メッセージに付けた非公開のメモを、JSONLとテキストのエクスポートに含めます。記録を共有するときは、オフのままにしてください。 |
| **Debug mode** | サポート用に、モデルへ送ったデータをサーバーのコンソールに記録します。 |

詳しくは、[メッセージの操作](../chats/messages.md)、[ペルソナ](../characters/personas.md)、[1つのチャットで使うモデルを選ぶ](../connections/connecting-to-a-provider.md#choosing-a-model-for-one-chat)、[Peek Prompt](../chats/peek-prompt.md)、[ガイド付き生成とImpersonate](../chats/guided-and-impersonate.md)、[チャットのエクスポートとインポート](../chats/export-import.md)、[トラブルシューティング](../TROUBLESHOOTING.md)を参照してください。

## 設定がデバイス間で同期する仕組み

Marinaraはほとんどの設定をサーバーに保存します。そのため、ブラウザーやデバイスを変えても設定はついてきます。

1. **Settings**で設定を変更します。
2. 約1秒後に、Marinaraがその設定をサーバーに保存します。
3. 同じサーバーを開いた別のブラウザーが、その設定を読み込みます。

いちばん新しい変更が優先されます。変更の直後に2台目のデバイスでMarinaraを開くと、そちらの古いコピーが、変更内容を上書きすることがあります。デバイスを切り替える前に、少し待ってください。

同期しない設定が2つあります。**Settings → Appearance → Text & Scale**で、使うデバイスごとに設定し直してください。

- **Display Size**(画面のテキストの大きさ)
- **Chat Font Size**(チャットのテキストの大きさ)

[外観の設定](../appearance/appearance-settings.md)を参照してください。サーバーに接続できないときは、アプリは手元の設定で動き続け、次に変更したときに再送を試みます。

## 関連ガイド

- [外観の設定](../appearance/appearance-settings.md)
- [メッセージの操作](../chats/messages.md)
- [Marinaraがデータを保存する場所](../data/where-data-is-stored.md)
- [トラブルシューティング](../TROUBLESHOOTING.md)
