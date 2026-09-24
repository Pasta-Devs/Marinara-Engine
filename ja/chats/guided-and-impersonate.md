# ガイド付き生成とImpersonate

このガイドでは、Marinara Engineでチャットの流れを操作する2つの方法を説明します。ガイド付き生成は、目に見えるメッセージを投稿せずにAIの返信の方向だけを指示する機能です。Impersonateは、自分の返信をAIに書いてもらう機能です。あわせて、この2つの操作を**Send**(送信)ボタンの隣に並べるQuick repliesメニューについても取り上げます。

## ガイド付き生成

ガイド付き生成は、次の返信をどの方向へ進めてほしいかをAIに伝える機能です。指示はキャラクターの外側からのもので、返信の内容を動かしますが、通常のチャットメッセージとしては表示されません。

### /guidedで返信を導く

返信を導く基本の方法は、`/guided`スラッシュコマンドです。

1. メッセージ入力欄に`/guided`と入力し、続けて指示を書きます。
2. Enterを押すか、**Send**をクリックします。
3. 指示した方向に沿って、AIが次の返信を生成します。

たとえば次の指示は、次の返信を告白へ向かわせます。

```
/guided make him admit he is lying
```

このコマンドには短い別名があります。`/guided`の代わりに`/narrator`、`/narrate`、`/nar`と入力できます。

グループチャットでは、指示を特定のキャラクターに向けられます。`/guided respond for <character> <direction>`の形で入力し、`<character>`をキャラクター名に、`<direction>`を指示に置き換えます。たとえば次のように書きます。

```
/guided respond for Alice make her admit she is lying
```

### ガイド付きの再生成

返信を再生成するときにも、方向を指示できます。この場合、メッセージ入力欄に入力してある文章が、その一度だけの指示として使われます。

1. **Settings**(設定)を開き、**Advanced**(詳細設定)、**Message Tools**(メッセージツール)の順に進みます。
2. **Guide swipes/regens with chat input**をオンにします。この設定はデフォルトではオフです。
3. チャットに戻り、メッセージ入力欄に指示を入力します。送信はしません。
4. AIのメッセージで**Regenerate**(再生成)をクリックします。

設定がオンで入力欄に文章があるとき、**Regenerate**ボタンのツールチップは**Regenerate (guided)**に変わります。AIは入力した文章を指示として、返信の新しい版を作ります。

### Stored guidanceを読む

指示付きで作られた返信については、その指示をMarinaraが保存するので、後から確認できます。メッセージには**Stored guidance**(保存された指示)の操作(巻物のアイコン)が表示されます。

1. AIのメッセージにある**Stored guidance**のアイコンをクリックします。
2. **Stored guidance**というタイトルのウィンドウが開き、その返信のもとになった指示が表示されます。

ウィンドウでは、指示の出どころに応じてラベルが付きます。

- **/guided**: `/guided`コマンドで与えた指示です。
- **Guided regenerate**: ガイド付きの**Regenerate**で与えた指示です。
- **Game start**: Game Modeの設定時に与えた指示です。

`/guided`とガイド付き再生成の指示には、**Copy /guided**ボタンが付きます。指示をそのまま使える`/guided`コマンドの形でコピーできるので、別のチャットに貼り付けて同じ方向付けを再利用できます。

## Impersonate

Impersonateは、次の自分のメッセージをペルソナの口調でAIに書いてもらう機能です。ペルソナとは自分が演じるキャラクターのことで、チャットには`{{user}}`として書き込まれます。設定方法は[ペルソナの作成と編集](../characters/personas.md)を参照してください。

ImpersonateはRoleplayのチャットでのみ動作します。ConversationとGameのチャットでは使えません。Conversationのチャットで実行すると、「Impersonate is not available in Conversation mode.」というメッセージが表示されます。

### /impersonateの使い方

1. メッセージ入力欄に`/impersonate`と入力します。続けて指示を書くこともできます。
2. Enterを押すか、**Send**をクリックします。
3. AIがペルソナとして自分のメッセージを書き、チャットに投稿します。

たとえば次のように書くと、天気をたずねるメッセージを自分の口調でAIが書きます。

```
/impersonate ask about the weather
```

このコマンドには短い別名があります。`/impersonate`の代わりに`/imp`と入力できます。

Impersonateが書いたメッセージはやり直せます。Impersonateで作られた自分のメッセージにも**Regenerate**の操作が使えるので、別の版を作れます。

### Impersonateの設定

Impersonateには専用の設定欄があり、ここでの設定はすべてのチャットで実行する`/impersonate`に適用されます。設定はチャットごとの設定画面から開きます。

1. Roleplayのチャットで**Chat Settings**(チャット設定)パネルを開きます。
2. **Impersonate**のセクションを探します。

このセクションには次の項目があります。

- **Prompt Template**(プロンプトテンプレート): impersonateのたびにモデルへ送る指示です。任意で設定します。空のままにすると、そのチャット自身のプロンプトが使われ、チャットにプロンプトがない場合は組み込みのデフォルトが使われます。マクロ`{{user}}`、`{{persona_description}}`、`{{impersonate_direction}}`を使えます。マクロとは、送信前にMarinaraが実際の文章へ置き換えるプレースホルダーです。デフォルトの文面は**Built-in default**をクリックすると読めます。**Reset**ボタンを押すと、カスタムのテンプレートが消えて空に戻ります。
- **Preset**: impersonateの返信にだけ特定のプロンプトプリセットを使います。プリセットとは、保存したプロンプト設定のひとまとまりです。[Preset Editorとプロンプトの管理](../prompts/presets.md)を参照してください。デフォルトは**Use chat default**です。プリセットが効くのはRoleplayだけです。
- **Connection**: impersonateの返信を、より安価なモデルや高速なモデルなど、特定の接続に振り分けます。接続とは、AIプロバイダーへの接続情報を保存したものです。[AIプロバイダーへの接続](../connections/connecting-to-a-provider.md)を参照してください。デフォルトは**Use chat default**です。**Random**を選ぶこともできます。
- **Skip agents**: オンにすると、impersonateの実行中はエージェントの処理(トラッカー、ロアブックの振り分け、そのほかの補助機能)をMarinaraが省略します。impersonateが速くなり、世界の状態も変化しません。デフォルトではオフです。[エージェント](../agents/agents-overview.md)を参照してください。
- **Use CYOA as direction**: オンにすると、CYOAの選択肢をクリックしたときに、それが通常のメッセージとして投稿される代わりにimpersonateの指示として使われます。CYOAはchoose your own adventureの略で、返信の後に表示されるクリック可能な選択肢のことです。この設定はデフォルトではオフです。

### impersonateのプロンプトを個別に設定する

スラッシュコマンドを使えば、1つのチャットにだけ有効なimpersonateのプロンプトも設定できます。

1. `/impersonate_prompt`と入力し、続けてプロンプトを引用符で囲んで書きます。
2. Enterを押します。

たとえば次のように書きます。

```
/impersonate_prompt "You will now play as my OC:"
```

チャットごとのプロンプトを消してデフォルトに戻すには、次のように入力します。

```
/impersonate_prompt reset
```

このコマンドには`/imp_prompt`という短い別名があります。

## Quick repliesメニュー

Quick repliesメニューは、通常の**Send**ボタンの隣に送信系の操作を追加します。スラッシュコマンドを打たなくても、ガイド付き生成とImpersonateをワンクリックで使えます。

どの操作を表示するかは設定で選びます。

1. **Settings**を開き、**Advanced**、**Message Tools**の順に進みます。
2. **Quick replies**をオンにします。デフォルトではオフです。
3. 項目を展開して、表示する操作を選びます。メニューを有効にすると、3つの操作はデフォルトですべてオンです。

3つの操作は次のとおりです。

- **Post only**: 入力したメッセージをチャットに追加するだけで、AIの返信は生成しません。スラッシュコマンド`/send <message>`でも実行できます。
- **Guide reply**: 入力した文章を通常のメッセージではなく`/guided`の指示として送ります。
- **Impersonate**: 入力した文章を指示として、ペルソナとしての返信を生成します。この操作はConversationのチャットでは表示されません。Impersonateが動作しないためです。

オンの操作が1つだけのときは、そのボタンが**Send**の隣に直接表示されます。2つ以上オンのときは、小さなメニューにまとまります。開くには点が3つ並んだボタン(ラベルは**Quick replies**)をクリックします。

## 関連ガイド

- [メッセージの操作: 編集、削除、スワイプ、再生成](messages.md)
- [Peek Prompt: AIが受け取った内容を確認する](peek-prompt.md)
- [ペルソナの作成と編集](../characters/personas.md)
- [Preset Editorとプロンプトの管理](../prompts/presets.md)
