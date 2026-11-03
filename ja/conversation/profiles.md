# Conversationモードのプロフィール(表示名、About Me、振る舞い)

キャラクターとペルソナにはそれぞれ、Conversationモード用の小さなチャットアプリ風のプロフィールがあります。表示名、「自分について」の短い紹介文(About Me)、振る舞いの指示です。これらの欄は、RoleplayやGame Modeでは使われません。

これは設定プロファイル(保存したチャットオプションのセット)ではありません。[設定プロファイル](../chats/settings-profiles.md)を参照してください。このモードが初めてなら、先に[Conversationモード: はじめに](getting-started.md)を読んでください。ペルソナとは、自分を表すキャラクターカードです。

## これらの欄がある場所

これらの欄は、**Convo**というタブにあります。

1. キャラクターは**Character Editor**で、ペルソナは**Persona Editor**で開きます。開くには、サイドバーの**Characters**パネルを開くか、右のサイドバー上部バーの人物アイコンから**Personas**パネルを開き、カードをクリックします([キャラクターの作成と編集](../characters/creating-and-editing-characters.md)と[ペルソナの作成と編集](../characters/personas.md)を参照)。
2. **Convo**タブをクリックします。

このタブには、**Convo Display Name**、**About Me**、**Convo Behavior**があります。キャラクターにはさらに、**Weekly schedule**(**Edit schedule**または**Create schedule**から、[キャラクタースケジュールと自律メッセージ](schedules.md)を参照)と、**Image generation instructions**があります。後者は、そのキャラクターの自撮り写真への任意の指示です([自撮り写真](selfies.md)を参照)。

## 表示名を設定する

**Convo Display Name**は、Conversationのチャットに表示される名前です。空欄のままにすると、カードの名前を使います。既存のメッセージの名前は、すぐに更新されます。

キャラクターには、**Declare this name on the card in the prompt**もあります。オンにすると、Marinaraがプロンプト(モデルに送るテキスト)のカードのテキストに「Conversation display name: X」のような行を追加します。これで、どのカードがどの名前を使っているかをモデルが把握できます。表示名が必要です。

## About Meを書く

**About Me**は、短い紹介文です。1〜2行、絵文字、冗談、または何も書かなくてもかまいません。Marinaraは、返信のたびに、応答するキャラクターとペルソナの**About Me**をプロンプトに追加します。そのため、モデルは、それぞれが自分をどう見せるかを把握できます。この操作は必要ありません。

入力するには、次のようにします。

- 自分で入力します。ツールバーの絵文字ボタンで、絵文字を挿入できます。**Revert**は、今回の編集の前のテキストに戻します。
- 保存済みのキャラクターでは、杖のボタン(**Generate About Me from this card**)をクリックします。
- ホーム画面で**Professor Mari**に頼みます。例: `Write Luna's About Me as a cryptic one-line bio.` 彼女は保存済みのプロフィールを読み、その人物の口調で紹介文を書いて保存します。変更は、通常の確認の流れで、そのまま残すか元に戻すかを選べます。

うまくいかなかった場合: 保存していないカードでは、杖のボタンが表示されません。先にカードを保存してください。

## Convo Behaviorを設定する

**Convo Behavior**は、Conversationモードでキャラクターやペルソナがどう振る舞うかについての指示です。例: 返信は短く小文字で書く、本物の人のようにテキストメッセージを送る。履歴の後の指示とは、直近のチャット履歴の後に置かれるプロンプトのテキストです。独自のプロンプトを書かないなら、デフォルトのままにしてください。**Insertion**で、指示をプロンプトのどこに入れるかを選びます。

| 選択肢 | 指示が入る場所 |
| --- | --- |
| **Constant — after the card**(デフォルト) | 常に、カードのテキストの直後。 |
| **Constant — before the card** | 常に、カードのテキストの直前。 |
| **Append to post-history** | 履歴の後の指示の末尾。 |
| **Prepend to post-history** | 履歴の後の指示の先頭。 |
| **Replace post-history** | 履歴の後の指示の代わり。 |
| **Only where {{convo_behavior}} is placed** | 独自のプロンプトでマクロを置いた場所だけ。 |

## チャットごとのAbout Meの上書き

カードの**About Me**は、どこでも使われるデフォルトです。1つのチャットだけ、別の紹介文を設定できます。

1. Conversationのチャットで、キャラクターまたはペルソナのアバターか名前をクリックします。プロフィールカードが横に開きます(スマートフォンでは下から開きます)。
2. カードを読みます。アバター、名前、現在の**About Me**が表示されます。バッジに**Default**または**Chat-specific**と表示されます。キャラクターには、**Online**、**Away**、**Busy**、**Offline**も表示されます。
3. **Edit**をクリックします。
4. このチャット用の紹介文を入力します。**Custom emojis**タブから、絵文字ピッカーを使えます。
5. **Save**をクリックします。「Chat-specific about me saved」と表示されます。

**Cancel**は、保存せずに編集モードを閉じます。**Revert**は、保存していない変更を元に戻します。**Clear**は、既存の上書きを削除して、カードのデフォルトに戻します。空の紹介文を保存しても、上書きは消えます。

## キャラクターが自分のAbout Meを変えられるようにする

これは上級者向けのオプションです。`update_about_me`というツールを使うと、キャラクターがチャットの中で、自分の紹介文を編集できます。デフォルトではオフです。使うには、**Chat Settings → Function Calling**を開き、**Enable Tool Use**をオンにしてから、`update_about_me`ツールを追加します。

キャラクターは、2つの選択肢のどちらかを選びます。

- Publicは、すべてのチャットで見られる本来の紹介文を変更します。先に承認が必要です。
- Chatは、紹介文の変更を、現在のチャットだけの非公開にします。

## 独自プロンプト用のマクロ

プロフィールをモデルに届けるために、マクロは必要ありません。値を独自のプロンプトの正確な場所に置きたいときだけ使います。Conversationモード以外では、どのマクロも空です。[プロンプトマクロ](../prompts/macros.md)を参照してください。

| マクロ | 値 |
| --- | --- |
| `{{convo_display}}` | 応答するキャラクターの表示名。 |
| `{{char_about}}` | そのキャラクターの有効な**About Me**。 |
| `{{persona_about}}` | そのペルソナの有効な**About Me**。 |
| `{{convo_behavior}}` | そのキャラクターの**Convo Behavior**。 |

## 関連ガイド

- [Conversationモード: はじめに](getting-started.md)
- [キャラクターの作成と編集](../characters/creating-and-editing-characters.md)
- [ペルソナの作成と編集](../characters/personas.md)
- [プロンプトマクロ](../prompts/macros.md)
