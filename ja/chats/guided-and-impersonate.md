# ガイド付き生成とImpersonate

チャットの流れを操作する方法は2つあります。ガイド付き生成は、目に見えるメッセージを投稿せずに、次の返信の方向を指示します。Impersonateは、自分の返信をモデルに書かせます。Quick repliesメニューを使うと、この2つを**Send**(送信)の隣に置けます。

## /guidedで返信を導く

指示はキャラクターの外側からのものです。返信の内容を方向づけますが、チャットのメッセージとしては表示されません。

1. メッセージ入力欄に、`/guided`と指示を入力します。
2. <kbd>Enter</kbd>を押すか、**Send**をクリックします。

モデルは、指示した方向に沿って次の返信を書きます。たとえば次のとおりです。

```text
/guided make him admit he is lying
```

`/guided`の代わりに、`/narrator`、`/narrate`、`/nar`と入力することもできます。グループチャットでは、`respond as`、`reply as`、`respond for`を使って、指示を1人のキャラクターに向けられます。

```text
/guided respond as Alice make her admit she is lying
```

## ガイド付きの再生成

メッセージ入力欄の文章を、再生成のための一度だけの指示として使います。

1. **Settings → Advanced → Message Tools**(設定 → 詳細設定 → メッセージツール)を開き、**Guide swipes/regens with chat input**(チャットの入力でスワイプと再生成を導く)をオンにします。デフォルトではオフです。
2. チャットで、メッセージ入力欄に指示を入力します。送信はしません。
3. AIのメッセージで**Regenerate**(再生成)をクリックします。入力欄に文章があるときは、ボタンのラベルが**Regenerate (guided)**になります。

再生成の後も指示は入力欄に残るので、手直ししてもう一度再生成できます。指示を消したい場合は、**Settings → General → Input & Editing**(設定 → 一般 → 入力と編集)で**Keep guidance after regenerating**(再生成後も指示を残す)をオフにします。

うまくいかなかった場合: ボタンのラベルが**Regenerate (guided)**になっている必要があります。**Regenerate**としか表示されない場合は、設定がオフか、入力欄が空です。

<a id="read-stored-guidance"></a>

## Stored guidanceを読む

Marinaraは、返信を方向づけた指示を保存します。

1. AIのメッセージにある、巻物の形をした**Stored guidance**(保存された指示)のアイコンをクリックします。
2. **Stored guidance**というタイトルのウィンドウに、指示が表示されます。

ウィンドウには、指示の出どころを示すラベルが付きます。**/guided**、**Guided regenerate**、**Game start**(Game Modeの設定)のいずれかです。`/guided`とガイド付き再生成の指示では、**Copy /guided**で、そのまま使える`/guided`コマンドをコピーできます。別のチャットに貼り付けて使えます。

## Impersonateで自分の返信を書かせる

Impersonateは、次の自分のメッセージを、ペルソナの口調でモデルに書かせます。ペルソナとは自分が演じるキャラクターのことで、`{{user}}`と表されます。[ペルソナ](../characters/personas.md)を参照してください。

始める前に: ImpersonateはRoleplayのチャットでのみ動作します。Conversationでは「Impersonate is not available in Conversation mode.」と表示されます。Gameでも使えません。

1. メッセージ入力欄に`/impersonate`と入力します。必要なら、続けて指示を書きます。
2. <kbd>Enter</kbd>を押すか、**Send**をクリックします。

モデルが、ペルソナとして自分のメッセージを投稿します。たとえば次のように書くと、天気をたずねるメッセージが書かれます。

```text
/impersonate ask about the weather
```

短い別名は`/imp`です。Impersonateが書いたメッセージにも**Regenerate**が使えるので、別の版を作れます。

### Impersonateの設定

これらの設定は、すべてのチャットのすべての`/impersonate`に適用されます。Roleplayのチャットで**Chat Settings**(チャット設定)を開き、**Impersonate**のセクションを探してください。パネルの開き方は[Chat Settings](chat-settings.md)を参照してください。

| 項目 | 動作 |
| --- | --- |
| **Prompt Template**(プロンプトテンプレート) | impersonateのたびに送る任意の指示です。空のままにすると、チャット自身のプロンプト、または組み込みのデフォルトが使われます。`{{user}}`、`{{persona_description}}`、`{{impersonate_direction}}`を使えます。これらは、Marinaraが実際の文章に置き換えるプレースホルダーです。**Built-in default**を選ぶとデフォルトを読めます。**Copy built-in default to edit**でコピーを作って編集を始め、**Save as**で名前を付けてテンプレートを保存し、**Delete template**でテンプレートを削除します。 |
| **Preset** | impersonateの返信にだけ使うプロンプトプリセットです。デフォルトは**Use chat default**です。[プリセット](../prompts/presets.md)を参照してください。 |
| **Connection** | impersonateの返信に使うモデルです。より安価なモデルや速いモデルなどを選べます。デフォルトは**Use chat default**です。**Random**も選べます。[AIプロバイダーへの接続](../connections/connecting-to-a-provider.md)を参照してください。 |
| **Skip agents** | impersonateの実行中は、エージェント(トラッカー、ロアブックの振り分けなどの補助機能)を省略します。impersonateが速くなり、世界の状態も変わりません。デフォルトではオフです。[エージェント](../agents/agents-overview.md)を参照してください。 |
| **Use CYOA as direction** | CYOA(choose your own adventure、選択肢で進む形式)の選択肢をクリックしたときに、それを投稿する代わりに、impersonateの指示として使います。デフォルトではオフです。**Settings → General → Input & Editing**で**Add CYOA choices to the message box instead of sending them**(CYOAの選択肢を送信せずメッセージ入力欄に追加する)がオンの場合、クリックしても文章がメッセージ欄に追加されるだけで、この設定は効果がありません。 |

### 1つのチャットにプロンプトを設定する

1. `/impersonate_prompt`と入力し、続けてプロンプトを引用符で囲んで書きます。
2. <kbd>Enter</kbd>を押します。

```text
/impersonate_prompt "You will now play as my OC:"
```

デフォルトに戻すには、`/impersonate_prompt reset`と入力します。別名は`/imp_prompt`です。

## Sendの隣にQuick repliesを追加する

Quick repliesは、ワンクリックで使える、**Send**の代わりの操作を追加します。スラッシュコマンドを入力する必要はありません。

1. **Settings → General → Input & Editing**(設定 → 一般 → 入力と編集)を開きます。
2. **Quick replies**をオンにします。デフォルトではオフです。
3. 展開して、表示する操作を選びます。オンにすると、3つの操作はデフォルトですべてオンです。

| 操作 | 動作 |
| --- | --- |
| **Post only** | 入力したメッセージを、返信なしでチャットに追加します。コマンド`/send <message>`でも同じことができます。 |
| **Guide reply** | 入力した文章を、`/guided`の指示として送ります。 |
| **Impersonate** | 入力した文章を指示として、ペルソナ側の返信を生成します。Conversationのチャットでは表示されません。 |

オンの操作が1つだけのときは、そのボタンが**Send**の隣に表示されます。2つ以上のときは、点が3つ並んだボタン(**Quick replies**)にまとまり、押すとメニューが開きます。
