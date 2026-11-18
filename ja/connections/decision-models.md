# Decisionモデル

Decisionモデルとは、「最新のメッセージでシーンが新しい場所に移りましたか?」や「Kaelenの気分は、怒り、悲しみ、落ち着きのどれですか?」など、チャットについての短い質問にMarinaraのために答える小型のモデルです。チャットの画像やクリップを参照できるものもあります。ロアブック、カスタムエージェント、プロンプト、グループチャット、Illustratorが使います。設定は任意です。なくてもチャットは動作し、各機能は[Marinaraでの用途](#where-marinara-uses-it)に記載したフォールバックを使います。

回答はMarinaraの動作を制御するもので、チャットに投稿されることはありません。質問の種類と例は、[判定モデルが答えられること](#what-a-decision-model-can-answer)を参照してください。

迷ったら、**None**(なし)のままにしておくのがおすすめです。判定を使いたい場合は、すでに持っているかもしれない内蔵モデルか、すでに動かしているサーバー上のチャットモデルを使ってください。どちらも追加の費用はかかりません。

## 判定モデルが答えられること

どの回答も、モデルの確信度を表す0から1の数値で返ります。Marinaraは、その数値を各機能が必要とする回答に変換します。

### はい・いいえ

モデルは判定文を読み、それが正しい可能性を答えます。Marinaraは、その値を[しきい値](#thresholds)と比較し、しきい値以上なら「はい」として扱います。最も一般的な種類で、起動質問、ロアブックの**Decision**(判断)欄、`{{#if decision:"..."}}`、Illustratorの確認で使います。

| 判定文 | 切り替えられる動作 |
| --- | --- |
| `In the latest message, the characters move to a different location` | 場所が変わったターンだけ、トラッカーが場所を更新します。 |
| `In the latest message, a dragon is physically present` | ドラゴンについてのロアブックエントリーがプロンプトに加わります。 |
| `{{user}} asked a question that {{char}} has not answered yet` | プロンプトの1行で、その質問に答えるようモデルに促します。 |
| `The latest message describes a fight` | このターンだけ戦闘エージェントが動きます。 |

### 複数の回答から1つを選ぶ

モデルは、用意した短い選択肢のリストから最も合うものを選びます。Marinaraはすべての選択肢について質問し、スコアが最も高いものを残すため、回答は複数ではなく1つになります。`{{#if decision_choice:"..." == "..."}}`を使います。

```text
{{#if decision_choice:"Kaelen's mood in the latest message" == "angry"}}
Kaelen speaks in short, clipped sentences.
{{else if decision_choice:"Kaelen's mood in the latest message" == "sad"}}
Kaelen speaks quietly and avoids eye contact.
{{else if decision_choice:"Kaelen's mood in the latest message" == "calm"}}
Kaelen speaks normally.
{{/if}}
```

シーンの種類(`combat`、`dialogue`、`exploration`、`rest`)、時間帯(`morning`、`afternoon`、`evening`、`night`)、家のどの部屋が舞台か、といった選択肢もうまく機能します。選択肢は明確に区別できるものにし、どれも当てはまらない可能性がある場合は`none of these`などを加えてください。エージェントは同じ仕組みで複数の指示の組から1つを選び、Illustratorは天候の種類を選びます。

### スコア

はい・いいえではなく、数値そのものを使う機能もあります。[Smart応答順](../chats/group-chats.md#response-order-individual-only)は、各キャラクターが次に発言する可能性を採点し、最も高いキャラクターを選びます。[Advanced Memory](../agents/memory.md#optional-decision-model)は、過去の各シーンの関連度を採点します。Peek Promptの**Test decisions**(判断をテスト)は、すべての判定文のスコアを表示するため、しきい値を選ぶのに役立ちます。[判定文のテスト](../chats/peek-prompt.md#testing-decision-statements)を参照してください。

### 画像とクリップ

画像を読み取れる内蔵判定モデルは、`The picture shows the character at the beach`のように、チャットの画像についても同じ種類の質問に答えられます。Liquid d1、Valen、Winnowは画像を読み取り、Valenの完全版は短いクリップも読み取れます。それ以外のモデルや、すべてのホスト型またはサーバーのアカウントは、テキストだけを読み取り、画像が送られることはありません。

画像が増えるほど回答に時間がかかるため、指定しないかぎり画像は送られません。

- 判定文には`pictures:1`(最大3枚)または`clips:1`を加えます。最新の2件のメッセージのどれかに画像があるときだけ質問するには、`media_within:2`を加えます。[画像とクリップ](../prompts/conditional-prompts.md#pictures-and-clips)を参照してください。
- ロアブックエントリーでは、**Decision**欄の下の**Show the decision model**(判断モデルに見せるもの)を設定します。[Decisionによる起動](../lorebooks/entries.md#decision-activation)を参照してください。
- カスタムエージェントの起動質問では、**Show the decision model**を設定します。[起動質問](../agents/custom-agents.md#activation-questions)を参照してください。
- Marinara自身の画像機能については、[画像を参照する機能](#features-that-look-at-pictures)を参照してください。

### モデルのページに表示される情報

各内蔵判定モデルのページには、次の2行が表示されます。

- **Answers**(回答)は、モデルがどのような回答をするために作られたかを示します。**Yes/no**(はい/いいえ)、**Weighted choice**(重み付きの選択)、**Score on a scale**(尺度に沿ったスコア)、モデルによっては**Boxes on a picture**(画像上の枠、画像内の物体の位置)があります。Marinaraは、はい・いいえと選択式の質問をして、そのスコアを読み取ります。枠はまだ要求しないため、その記載はモデルの説明にとどまります。
- **Reads**(読み取れるもの)には、**Text**(テキスト)、**Pictures**(画像)、**Video**(動画)が並びます。別のリリースだけが読み取れる種類は、「完全版では動画にも対応」のように、その後に記載されます。

## Decisionモデルを選ぶ

始める前に、[選択の目安](#which-one-to-pick)を参照してください。

1. 上部バーの**Connections**(接続)をクリックし、**Jobs**(役割)ボックスを開きます。
2. **Behind the scenes**(裏方の処理)の下にある**Decision**の行をクリックします。リストが開きます。
3. モデルを選びます。リストは3つのグループに分かれています。
   - **None (decisions off)**(なし、判定オフ)がデフォルトです。何も問い合わせず、エージェントエディターの起動質問欄は無効のままです。
   - **Built-in model**(内蔵モデル)には、Marinaraが自分のコンピューター上で動かすモデルが並びます。**Built-in model**、**Built-in model (utility)**(補助用の内蔵モデル)、**Built-in model (decisions)**(判定用の内蔵モデル)です。情報はコンピューターの外に出ません。
   - **Connections**には、判定に回答できる自分のアカウントが並びます。ホスト型のサービスか、すでに動かしているサーバー上のチャットモデルです。

   左側のアカウントをクリックすると、そのモデルを閲覧できます。NanoGPT、OpenRouter、Google Geminiのアカウントでは、最初に**Decision models**(判定モデル)に専用の判定モデルが、続いて**Chat models**(チャットモデル)にチャットモデルが並びます。Google Geminiのチャットモデルは判定に回答できないため、判定モデルのみ表示されます。以前に選んだ判定モデルは**Starred**(お気に入り)の上に表示され、モデル名の下にアカウント名が付きます。
4. テストするには、行にある**Decision settings**(判定の設定)の歯車をクリックし、**Test**(テスト)をクリックします。このボタンは内蔵モデルの項目に表示されます。TypeSafe、OpenRouter、NanoGPT、Google Geminiの判定モデルでは、モデルの**Edit model**(モデルの編集)を開き、**Test provider**(プロバイダーをテスト)をクリックします。**Own decision server**(自分の判定サーバー)のアカウントでは、アカウントの**⋯**メニューにある**Test**を使います。

テストに成功すると、「はい」の確率と、回答にかかった時間が表示されます。自分のコンピューター上のモデルでは、対数確率が利用できたかと、モデルが直接回答するかも表示されます。対数確率とは、モデルが書く可能性のある各単語について、モデルがどれだけ確信しているかを表す数値です。テストでは固定のサンプルを送り、自分のチャットは送りません。

うまくいかなかった場合は、メッセージに理由が表示されます。よくある原因は、キーが拒否された、サービスがリクエストを制限している、内蔵モデルが動いていない、回答が制限時間を超えた、のいずれかです。[トラブルシューティング](#troubleshooting)を参照してください。

今は回答できない項目も、理由とともにグレー表示でリストに残ります。**None**を選ぶと、起動質問や判定文を削除せずに判定をオフにできます。

<a id="which-one-to-pick"></a>

### 選択の目安

- **内蔵モデルですでに動かしているモデル。** 追加の費用はかかりません。内蔵モデルを使っているほとんどの人に最適です。
- **自分のサーバー上のチャットモデル**(Ollama、LM Studio、llama.cpp、またはほかのOpenAI互換サーバー)。追加の費用はかかりません。モデルをMarinaraの外で動かしている場合に向いており、同じモデルを二重に読み込まずに済みます。
- **ホスト型の判定モデル**(TypeSafe、OpenRouter、NanoGPT、Google Gemini)。リクエストごとに課金され、1ターンで複数回リクエストすることがあります。NanoGPTのサブスクリプションには一部の判定モデルが含まれ、OpenRouterには無料のものもあります。スマートフォンやローカルモデルを動かさないコンピューターに向いています。
- **Built-in decision model**(内蔵の判定モデル)。Marinaraがダウンロードしてチャットモデルと並行して動かす判定専用モデルで、専用のディスク容量とメモリーを使います。ほとんどは幅広いコンピューターで動作し、プロセッサーだけで動くものもあります。画像やクリップを参照できる唯一の選択肢です。[Marinaraによる判定モデルのインストール](#let-marinara-install-a-decision-model)を参照してください。

すでにローカルモデルを動かしているなら、まずそれを試し、自分のチャットのターンでテストしてください。判定文の表現は結果を大きく左右します。[判定文の書き方](../prompts/conditional-prompts.md#writing-statements)を参照してください。

JevとOpen-Jevは別のモデルです。JevはTypeSafeのホスト型モデルで、直接またはOpenRouter経由で利用できます。[Open-Jev](https://huggingface.co/ZefanCai/Open-Jev-2B)はQwenを基盤に別途公開されたモデルで、Marinaraでローカル実行できます。Open-Jevのテストは、ホスト型のJevを測定したものではありません。

Android(Termux)で**Built-in decision model**として提供されるのはJevK5とLiquid d1だけで、これらもスマートフォンのプロセッサーでは遅すぎることがあります。OpenRouter経由のJevなど、ホスト型のアカウントが実用的です。[Decision接続の設定](#set-up-a-decision-account)を参照してください。

プリセット、カード、エージェントは「Decisionモデル」を前提に書き、「Jev必須」とはしないでください。画像を要求する判定文も、テキストだけを読み取るモデルで動作し、その場合はテキストだけが渡されます。どのモデルでも同じ判定文の構文を使いますが、モデルによって回答が異なることがあります。判定を使うコンテンツをインポートすると、カスタムエージェントやAgent Organizerからのインストールも含め、Marinaraはこのガイドへのリンク付きの通知を表示します。プロファイル全体のZIPを復元した場合は表示されません。

## 内蔵モデルを使う

内蔵モデルをダウンロード済みなら、アカウントも費用もなしで判定に使えます。[内蔵モデルのセットアップ](local-model.md)を参照してください。

1. **Jobs**(役割)ボックスの**Behind the scenes**(裏方の処理)の下にある**Decision**の行をクリックします。
2. **Built-in model**(内蔵モデル)を選びます(補助用のモデルがある場合は**Built-in model (utility)**(補助用の内蔵モデル)でもかまいません)。
3. **Decision settings**(判定の設定)の歯車をクリックし、**Test**(テスト)をクリックします。

Marinaraはモデルにはい・いいえの質問を1つ送り、1トークンだけ書かせて、そのトークンの確率から回答を読み取ります。返信は書かれないため、リクエストは短く済みます。複数の回答から選ぶ場合は、回答ごとに1つのはい・いいえの質問として問い合わせます。

**Thinking**(推論)の設定は、モデルが1語で答えられないときの動作を決めます。常に先に推論するモデルもあります。

| Thinking | 動作 |
| --- | --- |
| **Auto (try one word, allow thinking if the model cannot)**(自動: まず1語を試し、答えられなければ推論を許可) | デフォルトです。1語での回答に2回続けて失敗すると、モデルが先に推論できるようになり、Marinaraがそれを知らせます。 |
| **Off (always answer in one word)**(オフ: 常に1語で答える) | 1語で答えられないモデルは、回答なしになります。 |
| **Allowed (let the model think first)**(許可: モデルに先に推論させる) | モデルに推論を省略するよう求めることはありません。 |

先に推論するモデルは数秒かかるため、デフォルトでは、後処理エージェントなど、返信が画面に表示された後に行う確認にだけ回答します。返信前に動くエージェントの判定にも使うには、**Also gate agents that run before the reply**(返信前に実行するエージェントも判定)をオンにします。その場合、すべての返信がこのモデルの回答を待ちます。

汎用チャットモデルのはい・いいえの確率もしきい値に使えますが、判定専用モデルのように校正する訓練は受けていません。対数確率を返さないランタイムは、単純な1か0で回答します。しきい値は自分のチャットで調整してください。

<a id="on-a-server-you-already-run"></a>

### 稼働中のサーバーでの利用

チャットモデルをOllama、LM Studio、llama.cpp、またはほかのOpenAI互換サーバーで動かしているなら、Marinaraが2つ目のコピーを読み込まなくても、そのモデルが判定に回答できます。

1. **Jobs**(役割)ボックスの**Behind the scenes**(裏方の処理)の下にある**Decision**の行をクリックします。選択ウィンドウには、チャットモデルを含むすべてのアカウントのモデルが表示されます。または、モデルの**⋯**をクリックし、**Use for…**(用途…) → **Decision**(判断)を選びます。
2. **Decision**の行の歯車をクリックし、**Test**(テスト)をクリックします。テストに成功すると、サーバーが対数確率を返したかと、モデルが先に推論する必要があったかが表示されます。**Done**(完了)をクリックします。
自分で作成することもできます。ソースを**OpenAI-compatible chat model (Ollama, LM Studio, llama.cpp)**(OpenAI互換チャットモデル)にしたDecisionアカウントを使い、チャット用のアカウントと同じアドレス(Ollamaなら例えば`http://localhost:11434/v1`)と、サーバーが使うモデル名を指定します。

問い合わせ方は内蔵モデルと同じで、判定文ごとにはい・いいえの1語を求めます。サーバーが同時にいくつのリクエストを処理できるかMarinaraには分からないため、判定文は1つずつ送ります。アカウントの**Thinking**(推論)は常に**Auto**です。別のコンピューター上のサーバーには`PROVIDER_LOCAL_URLS_ENABLED`が必要です。[ローカルモデルやセルフホストモデルへの接続](local-self-hosted.md)を参照してください。

<a id="set-up-a-decision-connection"></a>

## Decision接続の設定

ホスト型のDecisionアカウントは、選択した最近のメッセージと判定文をサービスに送信し、料金が発生することがあります。Smart応答順では[キャラクター一覧](#what-the-model-sees)も送信します。

1. 上部バーの**Connections**(接続)をクリックし、**Add**(追加)をクリックします。
2. 種類のボタンで**Decision**(判定)をクリックし、**TypeSafe**または**Own decision server**をクリックします。NanoGPTは[NanoGPT経由](#through-nanogpt)、OpenRouterまたはGoogle Geminiは[OpenRouterまたはGoogle Gemini経由](#through-openrouter-or-google-gemini)を参照してください。
3. **API key**(APIキー)を入力します。**Own decision server**の場合は**Server address**(サーバーのアドレス)を入力します。**Connect**(接続)をクリックします。ウィンドウが閉じ、パネルに新しいアカウントが表示されます。
4. **Behind the scenes**(裏方の処理)の下にある**Decision**の行をクリックし、新しいモデルを選びます。
5. テストするには、パネルでモデルをクリックして**Edit model**(モデルの編集)を開き、**Provider tests**(プロバイダーのテスト)カードの**Test provider**(プロバイダーをテスト)をクリックします。**Own decision server**のモデルには、そこに**Test provider**ボタンがありません。代わりに、パネルでアカウントの**⋯**メニューを開き、**Test**(テスト)をクリックします。

**Test provider**に成功すると、確率、回答にかかった時間、アカウントの制限時間が表示されます。**⋯**メニューにあるアカウントの**Test**では、動作したかどうかと、かかった時間だけが表示されます。テストは少なくとも10秒待ちます。制限時間がそれより長い場合は、その制限時間の5秒後まで待ちます。回答が制限時間より長くかかった場合は、結果にその旨が表示されます。チャットでは、その回答は回答なしとして扱われます。

うまくいかなかった場合は、[トラブルシューティング](#troubleshooting)を参照してください。

Decisionエディター(判定モデルの**Edit model**)には、次の欄があります。

| 欄 | 内容 |
| --- | --- |
| **Decision source**(判定のソース) | **TypeSafe**、**OpenRouter**、**NanoGPT**、**Google Gemini**、**Custom System One endpoint**(カスタムSystem Oneエンドポイント)、**OpenAI-compatible chat model (Ollama, LM Studio, llama.cpp)**(OpenAI互換チャットモデル)のいずれかです。モデルを作成した時点で固定されます。 |
| **API key source**(APIキーの取得元) | **Enter a separate key (optional for local servers)**(別のキーを入力、ローカルサーバーでは任意)か、ほかのアカウントの**Use key from …**(…のキーを使用)です。リンクしたキーは、後からのキーの変更に追従します。カスタムSystem OneモデルやOpenAI互換モデルがカスタムチャットアカウントのキーを借りられるのは、両方のアドレスのスキーム、ホスト、ポートが同じ場合だけです。 |
| **Recent-message token budget**(最近のメッセージのトークン予算) | 送信するチャットの推定トークン数です。1から30,000まで。デフォルトはTypeSafe、OpenRouter、NanoGPT、Google Geminiで30,000、カスタムサーバーで3,500です。NanoGPT、OpenRouter、Google Geminiのアカウントの判定モデルで入力上限がこれより小さい場合は、その上限の4分の3を使います。Marinaraは古いメッセージから除外し、続いて最新メッセージの最も古い部分を切り詰めます。拒否されたリクエストや予算を超えたリクエストは、回答なしになります。 |
| **Time limit (seconds)**(制限時間、秒) | チャット中に、判定文ごとに回答を待つ時間です。0.5から30まで。デフォルトは1.5、NanoGPTとOpenAI互換チャットモデルでは4です。[制限時間](#time-limits)を参照してください。 |
| **Custom Request Headers**(カスタムリクエストヘッダー) | 判定リクエストのたびに送る追加ヘッダーです。`{"x-billing-mode": "paygo"}`のようなJSONオブジェクトで指定します。キーには使えません。認証ヘッダーは拒否されます。 |

TypeSafeは`https://api.typesafe.ai`に送信します。**Base URL**(ベースURL)は、TypeSafeのAPIを動かしている別のサーバーのアドレスに置き換えられます。アドレスには`/v1/systemone`を含めません。その場合もTypeSafeのキーが必要で、キーはそのサーバーに送信されます。**Custom System One endpoint**には、Open-Jevや[Strands decider](#run-strands-decider-yourself)など、自分で動かしているSystem Oneサーバーを指定できます。アドレスは`/v1/systemone`を含めずに入力します。OllamaなどのチャットモデルサーバーはSystem Oneに対応していません。その場合は**OpenAI-compatible chat model**を使ってください。

<a id="through-nanogpt"></a>
### NanoGPT経由

NanoGPTにはJev Latestなどの独自の判定モデルがあり、MarinaraはNanoGPTのキーを使ってDecisions APIに問い合わせます。一部はNanoGPTのサブスクリプションに含まれ、それ以外の料金は残高から引かれます。

1. 通常どおりNanoGPTを接続します。**Add**では、種類の**Decision**にもNanoGPTが表示されます。
2. **Found in NanoGPT — use it for:**(NanoGPTに対応する機能)で**Decision**にチェックを入れます。Marinaraがプランに含まれる判定モデルを選びます。優先されるのはJev Latestです。
3. 別のモデルを選ぶには、NanoGPTアカウントの**⋯**、**Add model**(モデルを追加)、**Decision**タブの順にクリックします。ここには判定モデルだけが並び、サブスクリプションに含まれるものには**Plan**(プラン)の印が付きます。モデルを選び、**Test decision**(判定をテスト)をクリックします。

判定モデルはチャットに対応していないため、チャット用モデルの一覧には表示されません。

デフォルトでは、サブスクリプションと残高のどちらを使うかはNanoGPTが決めます。常に残高を使うには、判定モデルの**Edit model**を開き、**Custom Request Headers**に`{"x-billing-mode": "paygo"}`と入力します。

<a id="through-openrouter-or-google-gemini"></a>
### OpenRouterまたはGoogle Gemini経由

OpenRouterとGoogle Geminiのアカウントにも独自の判定モデルがあり、Marinaraはアカウントのキーを使って各サービスの判定APIに問い合わせます。OpenRouterには多数のモデルがあり、名前の末尾が`:free`のものは無料です。Google Geminiには**Gemini Decision 1**が1つだけあります。

1. 通常どおりOpenRouterまたはGoogle Geminiを接続します。
2. **Jobs**ボックスの**Behind the scenes**にある**Decision**の行をクリックし、左側のアカウントを選びます。**Decision models**からモデルを選びます。
3. テストするには、モデルの**Edit model**を開き、**Test provider**をクリックします。

OpenRouterアカウントでは、その下の**Chat models**に対数確率を返すチャットモデルが並び、これらも使えます。Google Geminiアカウントでは判定モデルだけを選べます。

このバージョンより前に追加したアカウントでは、保存されたモデル一覧が古く、最初は**Decision models**が表示されないことがあります。選択ウィンドウの更新ボタンをクリックしてください。Marinaraも保存済みのモデル一覧を1日1回更新します。

**Add**で作成した単独の**OpenRouter**判定アカウントも引き続き使えます。そのアカウントのキーで同じAPIに問い合わせます。

ホスト型サービスの中には、ときどき回答が1.5秒より遅くなるものがあり、判定が不規則に壊れているように見えます。数回テストし、最も遅い回答より長い制限時間に設定してください。プリセットの判定や、返信前に動くエージェントの起動質問など、返信前に問い合わせる判定文は、それぞれ最大でその時間だけ返信を遅らせることがあります。

判定にキーを使っているアカウントを削除すると、警告が表示されます。その後はDecisionアカウントのリンクをやり直す必要があり、それまで判定は回答なしになります。インポートした接続ファイルにはAPIキーも借用元アカウントへのリンクも含まれないため、手動で復元してください。

<a id="where-marinara-uses-it"></a>

## Marinaraでの用途

- [起動質問](../agents/custom-agents.md#activation-questions)は、カスタムエージェントを実行するかどうかを決めます。回答がない場合、質問によって実行が止まることはありません。キーワードと**Trigger Cadence**(起動頻度)は引き続き適用されます。
- [プロンプト内の判定文](../prompts/conditional-prompts.md#asking-the-decision-model)は、チャットやエージェントのプロンプトを組み立てるときにテキストを選びます。回答がない場合は判定がいいえとなるため、判定ブロックに`{{else}}`分岐があればそれを使います。
- [ロアブックのDecision欄](../lorebooks/entries.md#decision-activation)は、ロアブックのスキャン中にRequireまたはTriggerを確認します。回答がない場合、Requireは新しいエントリーを通せず、Triggerは起動経路を追加しません。Stickyによる保持と、Triggerの通常の起動経路は引き続き適用されます。
- [Smart応答順](../chats/group-chats.md#response-order-individual-only)は、オンにしている場合、グループチャットで次に誰が話すかを採点します。回答がない場合、Smart応答順は通常のAI呼び出しを行います。
- [アクティブなキャラクターの自動化](../chats/group-chats.md#automate-active-characters-merged-only)は、**Decision model**に設定している場合、MergedのRoleplayグループで返信のたびに、シーンにいるのは誰かを尋ねます。回答がない場合、どのキャラクターについても回答が得られなければ、Character Trackerの直近のシーンを使うか、一覧をそのまま維持します。
- [Advanced Memory Recall](../agents/memory.md#optional-decision-model)は、Roleplayのシーン境界と記憶の選択に、専用のDecisionモデルを使えます。そのチャットのAdvanced Memory設定で**Use Decision model**(判断モデルを使用)をオンにしてください。回答がない場合、失敗した判定は通常の記憶の呼び出しまたはシーン確認に戻ります。要約には引き続き補助モデルを使います。

- [画像を参照する機能](#features-that-look-at-pictures)は、オンにすると、新しい画像の確認、重複の省略、背景の再利用、スプライトの顔への印付けを行います。画像を読み取れる判定モデルが必要です。

起動質問はエージェントを実行するかどうかを決め、プロンプト内の判定文は、実行中のそのエージェントに何を伝えるかを決めます。はい・いいえの条件には`{{#if decision:"..."}}`を、複数の回答からの選択には`{{#if decision_choice:"..." == "..."}}`を使います。

### 画像を参照する機能

これらには、画像を読み取れる内蔵判定モデル(Liquid d1、Valen、Winnow)が必要です。すべて、オンにするまではオフです。対応するモデルがない場合はグレー表示になり、ⓘに理由が表示されます。以前オンにしたものは、その状態でもオフにできます。

| 機能 | 場所 | 動作 |
| --- | --- | --- |
| **Picture check**(画像の確認) | **Chat Settings → Agents → Illustrator**(チャット設定 → エージェント → Illustrator) | Illustratorの新しい画像や自撮り写真を1枚ずつ見て、依頼した内容が描かれているかを確認します。自撮り写真はキャラクターのアバターとも比較します。**Make another if it doesn't match**(合っていなければ別の画像を作る)は、不一致の場合にもう1枚描きます。**Always make two, keep the better**(常に2枚作り、良い方を残す)は、2枚描いて依頼内容により合うほうを残します。画像を追加するたびに、もう1回分の画像生成費用がかかります。 |
| **Also check**(追加の確認項目) | **Picture check**の下 | `Kaelen has short red hair`のような独自の確認項目を、1行に1つ、最大6つ指定します。画像に含めたくないものは、行頭に`not:`を付けて、`not: The picture has writing or a watermark`のように書いてください。 |
| **Skip a picture the newest one already shows**(最新の画像にすでに描かれている内容は描かない) | Illustratorのカード | 描く前にチャットの最新の画像とこれから描く内容を比較し、同じシーンをもう一度描くことになる場合は省きます。手動で依頼した画像は必ず作成します。 |
| **Reuse a library background that looks like the place**(場所の見た目に合う背景をライブラリーから再利用) | Illustratorのカード | 新しい場所と同じ名前の背景がライブラリーにない場合、名前に共通の単語を含む背景を最大4枚確認し、合うものがあれば、新しく描かずにその背景を表示します。[判定モデルで画像を確認する](../media/illustrator-agent.md#check-pictures-with-a-decision-model)を参照してください。 |
| **Flag faces that don't match their expression**(指定の表情に合わない顔に印を付ける) | **Generate Sprites**(スプライトを生成)ウィンドウ、表情のみ | 描画後の顔を1つずつ確認し、指定の表情に見えない可能性がある顔に印を付けます。チェックを外したり、描き直したりできます。[AIでスプライトを生成する](../characters/sprites.md#generate-sprites-with-ai)を参照してください。 |

モデルがオフ、遅い、失敗するなどの理由で実行できない確認は、合格として扱われます。画像は生成されたまま残ります。

<a id="what-the-model-sees"></a>

## モデルが受け取る情報

起動質問と、プロンプトおよびロアブックの判定文では、モデルは判定文と、チャットに保存されたとおりの最近のメッセージを受け取ります。プリセット、キャラクターカード、ペルソナ、ロアブックエントリー(Constantのものも含む)、要約、エージェントの出力は受け取りません。**@ Depth**に設定したエントリーなど、メッセージの間に挿入されるテキストも含まれません。これらに依存する判定文では、必要な事実を判定文自体に書いてください。

- プロンプトとロアブックの判定文、Smart応答順、アクティブなキャラクターの自動化は、直近5件のメッセージを読みます。この数は固定です。
- 起動質問は、エージェントの**Scan Depth**(スキャン深度)の件数を読みます。デフォルトは5です。
- 各メッセージには発言者の名前が付きます。AIから隠したメッセージは除外されます。
- 後処理エージェントの質問など、返信の後に行う確認では、書き終えた返信も読み取ります。
- 判定文のマクロは先に展開されるため、`{{char}}`はキャラクター名として渡ります。
- メッセージがモデルの予算に収まらない場合は、古いメッセージから除外されます。

**Smart response order**(Smart応答順)ではキャラクター一覧も送信します。分かっている場合は各候補の名前、状態、活動、発言頻度と、最大300文字の性格(性格が空なら説明)を含めます。

**Automate active characters**(アクティブなキャラクターを自動化)でもキャラクター一覧を送信します。各キャラクターの名前と、最大300文字の説明(説明が空なら性格)を含めます。出演者が多くて収まらない場合は、100文字まで、または名前だけに切り詰めます。さらに、Character Trackerが直近に見たキャラクターの名前も含めます。名前だけにしてもメッセージの余地が足りない場合は、モデルに質問せず、Character Trackerが代わりを務めます。Mergedグループでは、1つの返信が全員の声を担うため、返信に「the narrator」というラベルが付きます。

ホスト型の判定サービスは、メッセージに加えてこれらの一覧も受け取ります。

**Advanced Memory**は、チャットごとの専用Decisionモデルを使い、直近5件のルールは適用されません。シーン確認は、関連する履歴の範囲を読み取ります。記憶の呼び出しでは、最近の会話のテキストと、候補に絞り込んだ過去の要約を最大24件送ります(**Maximum recalled scenes**(想起するシーンの最大数)のほうが大きい場合はそれ以上)。続いて、キャラクターのアクセス権を確認したうえで、モデルが選んだシーンの元のメッセージを送ります。ホスト型サービスはこれらのテキストを受け取り、複数のバッチに分けて受け取ることもあります。記憶の呼び出しの各段階には、通常、モデルの速さに合わせて10～25秒が割り当てられます。両段階は1回の返信につき合わせて40秒を共有するため、1つの段階の時間が10秒未満になることもあります。時間内に回答が得られなかった記憶は、通常の記憶の呼び出しに戻ります。[任意のDecisionモデル](../agents/memory.md#optional-decision-model)を参照してください。

<a id="thresholds"></a>

## しきい値

確率はモデル間で比較できません。同じ例でも、あるモデルでは0.99、別のモデルでは0.2になることがあります。はい・いいえのデフォルトのしきい値は、モデルによって異なります。

- **内蔵モデル、またはOpenAI互換チャットモデルのアカウント:** 0.5
- **TypeSafe、OpenRouter、NanoGPT、Google Gemini、またはCustom System Oneのアカウント:** 0.5
- **Built-in decision model:** モデル自身の推奨値で、可能なものはRoleplayのターンで測定しています。JevK5、Liquid d1、Valen-Decision 1.5 4Bは0.3、Valenの完全版とWinnowは0.5(未測定)、Open-Jev 2Bと9Bは0.1

エージェントの**Run when probability is at least**(実行に必要な最小確率)は、この値を上書きします。保存した値が異なると、エディターはモデルの推奨値に戻すことを提案します。モデルを切り替えるたびに確認してください。プロンプトの判定文とロアブックのDecision欄はモデルのデフォルトを使い、エージェントのしきい値を変えてもこれらは変わりません。

Custom System Oneのアカウントの背後で自分で動かしているOpen-Jevも0.5を使います。Marinaraは任意のカスタムエンドポイントを校正できないためです。そのため、0.5未満の肯定的な結果をいいえと読むなど、内蔵のOpen-Jevとは結果が異なることがあります。

<a id="time-limits"></a>

## 制限時間

時間内に届かない判定は回答なしとなり、生成は機能ごとのフォールバックで続行します([Marinaraでの用途](#where-marinara-uses-it)を参照)。制限時間はすべて判定文単位です。複数の判定文を含むリクエストでは、判定文ごとに制限時間が与えられ、Choiceの回答候補もそれぞれ1つの判定文と数えます。ローカルモデルは一度に少数のリクエストしか処理しないため、判定文は順番を待ちます。各判定文の時間は、モデルがその処理を始めた時点から計測します。

- **TypeSafe、OpenRouter、Google Gemini、またはCustom System Oneのアカウント:** 1.5秒、または設定した**Time limit**(制限時間)。測定時、OpenRouterとGoogle Geminiの回答は0.2秒から0.5秒でした。
- **NanoGPTの判定モデル:** 4秒、または設定した**Time limit**。測定時の回答は0.4秒から2.5秒でした。
- **OpenAI互換チャットモデルのアカウント:** 4秒、または設定した**Time limit**。先に推論する必要があるモデルには、少なくとも20秒が与えられます。
- **内蔵モデル:** 4秒。先に推論する必要があるモデルには20秒が与えられます。
- **Built-in decision model:** Open-Jevは最初の判定文に4秒、以降は測定時間が与えられます。2Bでは0.35秒、9Bでは0.8秒です。ほかのモデルは起動するたびに読み取り速度を測定し、それに合わせて制限時間を決めるため、遅いプロセッサーには長い時間が与えられます。判定文が画像やクリップを要求するたびに、さらに時間が加わります。モデルを初めて起動するまでは、判定文ごとに4秒、画像1枚ごとに30秒、クリップ1本ごとに60秒が与えられます。

生成をキャンセルすると、判定リクエストも停止します。

## その他の設定

これらは**Decision settings**(判定の設定)の歯車の中にあります。

- **Also use it to pick who speaks in Smart response order**(Smart応答順の発言者選択にも使用)は、デフォルトでオフです。[グループチャット](../chats/group-chats.md#response-order-individual-only)を参照してください。
- **Decision statements per turn**(1ターンあたりの判定文数)は、プロンプトとロアブックの判定文の計画を制限します。デフォルトは32、最大255です。この枠は複数の段階で適用され、1ターンのすべてのリクエストや支出に対する単一の上限ではありません。エージェントの起動質問とSmart応答順は別枠です。[制限と費用](../prompts/conditional-prompts.md#limits-and-cost)を参照してください。
- **Also gate agents that run before the reply**(返信前に実行するエージェントも判定)と**Thinking**(推論)は、推論できる内蔵モデルの項目に表示されます。**Built-in decision model**は推論しないため、どちらもありません。

## 誤回答に備える

どのモデルも誤回答することがあり、正しい「はい」の回答がしきい値すれすれになることもあります。

- 判定は返信の微調整に使い、チャットに不可欠なものには決して使わないでください。判定を見落としても、返信の調整が少し減るだけで、返信が壊れないようにします。
- 同意、コンテンツ警告、安全上の指示を判定の条件にしないでください。
- 起動質問だけで実行するエージェントには、**Bypass the question after this many messages**(指定メッセージ数の後で質問を省略)を設定してください。そうすれば、「いいえ」と答え続けるモデルによって、エージェントが永久に止められることはありません。

<a id="troubleshooting"></a>

## トラブルシューティング

- **テストが失敗する。** メッセージに理由が表示されます。キーが拒否された、サービスがリクエストを制限している、内蔵モデルが動いていない、判定モデルがインストールされていない、モデルがはい・いいえで答えなかった、時間切れになった、のいずれかです。
- **選択ウィンドウにアカウントのDecision modelsが表示されない。** 保存されたモデル一覧が判定モデルより古い状態です。選択ウィンドウでアカウント名の横にある更新ボタンをクリックしてください。
- **サーバーにそのエンドポイントがないと表示される。** Decisionのソースがサーバーに合っていません。Ollama、LM Studioなどのチャットモデルサーバーには**OpenAI-compatible chat model**(OpenAI互換チャットモデル)が必要です。**Custom System One endpoint**(カスタムSystem Oneエンドポイント)は、Open-JevなどのSystem Oneサーバー専用です。
- **回答が制限時間を超えた、または判定がときどきしか動かない。** サービスの回答が、ときどき**Time limit**(制限時間)より遅くなっています。数回テストし、最も遅い回答より長い制限時間に上げてください。
- **起動質問があるエージェントが毎ターン動く。** Decisionモデルが設定されていないか回答していないため、質問がない場合と同じようにエージェントが動いています。テストを実行してください。
- **プロンプトの判定分岐が一度も表示されない。** [判定分岐が表示されない場合](../prompts/conditional-prompts.md#when-a-decision-branch-never-appears)を参照してください。
- **Smart応答順が通常のAI呼び出しを続ける。** スイッチがオフになっているか、そのターンにDecisionモデルが回答しませんでした。
- **画像の設定がⓘ付きでグレー表示になる。** 選択した判定モデルはテキストしか読み取れないか、判定モデルが設定されていません。**Built-in decision model**でLiquid d1、Valen、Winnowのいずれかを選んでください。[内蔵判定モデルの選択](#which-built-in-decision-model)を参照してください。
- **`pictures:`を含む判定文が「いいえ」になる。** `media_within:`を指定している場合、直近のメッセージに画像がありませんでした。そうでなければ、画像によって回答に時間がかかり、制限時間を超えました。モデルのページの**On this computer**(このコンピューターでの速度)の行に、画像1枚にかかる時間が表示されます。
- **この端末では実行できないとモデルに表示される。** リストの下の理由に、プロセッサーの機能、グラフィックカードの世代、ライブラリーなど、不足しているものが表示されます。別のモデルを選んでください。Liquid d1とJevK5は、ほとんどのコンピューターで動作します。
- **アクティブなキャラクターの自動化がCharacter Trackerに従う。** モデルがすべてのキャラクターについて回答しなかったか、先に推論するモデルで**Also gate agents that run before the reply**(返信前に実行するエージェントも判定)がオフになっているか、出演者が多すぎて、名前だけでもモデルの入力に収まりません。

生成中の判定スコアと出力を見るには、Debug Modeをオンにするか、ログレベルをdebugにします。[ログレベル](../CONFIGURATION.md#logging-levels)を参照してください。返信を生成せずに自分の判定文をテストするには、**Peek Prompt → Decision diagnostics → Test decisions**(Peek Prompt → Decision診断 → 判断をテスト)を開きます。明示的なテストは選択したモデルを呼び出すため、ホスト型サービスでは料金が発生することがあります。[判定文のテスト](../chats/peek-prompt.md#testing-decision-statements)を参照してください。

<a id="let-marinara-install-a-decision-model"></a>

## Marinaraによる判定モデルのインストール

**Built-in decision model**(内蔵の判定モデル)は、Marinaraがダウンロードして、自分のコンピューターでチャットモデルと並行して動かす判定専用モデルです。情報はコンピューターの外に出ません。使用メモリーは、チャットモデルの使用分に加算されます。ローカルモデルがすでにあるなら、まずそのモデルの判定を試してください。

### 内蔵判定モデルの選択

| モデル | ダウンロード | 読み取れるもの | 言語 | 動作環境 |
| --- | --- | --- | --- | --- |
| **JevK5 4B** | 約2.7 GB | テキスト | 英語 | ほとんどのコンピューター。NVIDIA、AMD、Intel、Appleのグラフィックス、またはプロセッサーだけで動作します。内蔵モデルと同じランタイムを使います。 |
| **JevK5 2B** | 約2 GB | テキスト | 英語 | 4Bと同じです。プロセッサーや小型のグラフィックカードではより速く動作しますが、精度は少し低くなります。 |
| **Liquid d1 3B** | 約2.3 GB | テキスト、画像 | 日本語、中国語、韓国語、ドイツ語、スペイン語、ロシア語を含む16言語 | ほとんどのコンピューター。英語以外のチャットに向いています。個人と年間売上1,000万ドル未満の企業は無料で使えます。 |
| **Valen-Decision 1.5 4B** | 約5.8 GB | テキスト、画像 | 8言語で確認済み | 64ビットのIntelまたはAMDプロセッサーを搭載したLinux。プロセッサーのみで動作します。 |
| **Valen-Decision 1.5 2B (full release)** | 約6.4 GB | テキスト、画像、クリップ | 記載なし | Windows、Apple siliconのmacOS、Linuxで、プロセッサー上で動作します。約6 GBのメモリーが必要です。 |
| **Valen-Decision 1.5 4B (full release)** | 約11.8 GB | テキスト、画像、クリップ | 8言語で確認済み | 2Bと同じです。約12 GBのメモリーが必要で、遅いものの精度は高くなります。 |
| **Winnow E4B** | 約9 GB | テキスト、画像 | 記載なし | NVIDIA RTX 50シリーズのカード、CUDA 13のライブラリー、AVX-512対応プロセッサー(AMD Ryzen 7000や9000など。現在のIntelのノート・デスクトップ向けチップは非対応)を備えたLinuxのみです。約11 GBのグラフィックメモリーが必要です。 |
| **Open-Jev 2B** | 約4.6 GB | テキスト | 英語 | RTX 20シリーズ以降のNVIDIAカードと、バージョン580以降のドライバーを備えたLinux。約4.8 GBのグラフィックメモリーと10 GBのディスク容量を使います。 |
| **Open-Jev 9B** | 約19.4 GB | テキスト | 英語 | 2Bと同じです。約23.6 GBのグラフィックメモリーを使うため、24 GBのカードではほかのものを一緒に載せられません。 |

8言語にわたる20ターンのRoleplayでは、JevK5 4B、Liquid d1、Valen-Decision 1.5 4Bが20件すべてに正しく答えました。迷ったらLiquid d1を、クリップを読み取らせたい場合はValenの完全版を選んでください。

ダウンロードの前に、Marinaraはシステム、プロセッサーの機能、グラフィックカードとそのライブラリー、空きメモリーを確認し、そのコンピューターでモデルを動かせるか調べます。動かせないモデルもリストに残り、**(cannot run here)**(この端末では実行不可)と理由が表示されます。

### インストール手順

1. 上部バーの**Connections**(接続)をクリックします。**On this device**(このデバイス上)の下にある**Built-in model (decisions)**(判定用の内蔵モデル)をクリックします。**Connections**パネルで**Add**(追加)をクリックし、**Decisions**(判断)の下の**Built-in model (decisions)**をクリックしても開けます。
2. **Model**(モデル)のリストからモデルを選びます。その下に説明、**Answers**(回答)と**Reads**(読み取れるもの)([モデルのページに表示される情報](#what-a-model-page-lists)を参照)、対応言語、ライセンスが表示されます。
3. モデル名とサイズが付いた**Download**(ダウンロード)をクリックします。サイズ、ハードウェアの診断結果、ライセンスを確認します。それまでは何もダウンロードされません。
4. **Use for Decision**(判断に使う)をクリックするか、**Jobs**(役割)ボックスの**Behind the scenes**(裏方の処理)の下にある**Decision**(判断)の行をクリックし、**Built-in model (decisions)**を選びます。

モデルを一度実行すると、そのページの**On this computer**(このコンピューターでの速度)に、そこでかかった時間も表示されます。チャットの数ターン、画像1枚、対応モデルではクリップ1本の時間です。自分のコンピューターでの時間なので、画像を要求すると判定文の処理がどれだけ遅くなるかが分かります。

切り替えるには、リストから別のモデルを選びます。以前ダウンロードしたモデルには**(downloaded)**(ダウンロード済み)と表示され、**Use this model**(このモデルを使う)で再ダウンロードせずに切り替えられます。

ページには、ほかに次の操作があります。

- **Turn off**(オフにする)はモデルを停止し、ファイルを残します。**Turn on**(オンにする)で再び起動します。
- **Runs on**(動作環境)は、複数のNVIDIAカードがあるコンピューターで使うカードを選びます。変更するとモデルが停止し、新しいカードで再び起動します。
- **Starts**(起動)は、デフォルトの**When an agent first needs it**(エージェントが初めて必要としたとき)、または**With Marinara**(Marinaraと同時)を選べます。
- **Install from a repository**(リポジトリーからインストール)には、Hugging Faceの判定モデルを`owner/model-name`の形式で入力します。Open-Jevのチェックポイント、判定モデルであると宣言されたGGUF、ValenのGGUFパッケージに対応します。名前の後に`:Q8_0`を付けると、GGUFのサイズを1つ指定できます。**Check**(確認)をクリックします。Marinaraはファイル自身の説明を読み、サイズとライセンスを表示します。保証できないリポジトリーは、理由とともに拒否されます。続いて**Download and install this one**(これをダウンロードしてインストール)をクリックします。
- **Remove files**(ファイルを削除)は、モデルとそのランタイムを削除します。
- **Reinstall**(再インストール)は、インストール済みのモデルのファイルやランタイムが見つからないか古くなっていて、モデルを起動できないときに表示されます。多くはアップデートの後です。モデルには**Needs reinstall**と表示されます。再インストールしても、すでにダウンロードされていて壊れていないファイルは残るため、通常はランタイムだけがもう一度ダウンロードされます。

起動直後のモデルの最初の回答は遅いため、Marinaraは読み込み中にウォームアップ用の質問を1つ送ります。これに失敗してもモデルは起動し、最初の実際の質問でその遅延が発生します。起動直後にモデルが停止した場合は、必要な機能がプロセッサーにないなどの理由がページに表示されます。

<a id="run-strands-decider-yourself"></a>

### Strands deciderのセルフホスト

[Strands decider 2B](https://huggingface.co/StrandsAgents/strands-decider-2B-hobson-v19)は、System Oneに対応した別のオープンなDecisionモデル(Apache-2.0)です。Marinaraからはインストールできませんが、自分で起動したままにしておけば**Custom System One endpoint**(カスタムSystem Oneエンドポイント)として動作します。

1. Python 3.10以降の環境でインストールし、サーバーを起動します。

   ```bash
   pip install strands-decider
   strands-decider serve StrandsAgents/strands-decider-2B-hobson-v19 --port 8000
   ```

   NVIDIA GPUかApple siliconが見つかればそれを使い、なければプロセッサーで動作しますが遅くなります。初回起動時にモデルと約4.6 GBのベース重みをダウンロードし、Pythonパッケージは約5.5 GBを使います。サーバーにパスワードはないので、`127.0.0.1`で運用してください。

2. **Server address**(サーバーのアドレス)を`http://127.0.0.1:8000`にして、**Own decision server**(自分の判定サーバー)のアカウントを追加します。モデル名は何でもかまいません。
3. **Decision**の行でそれを選び、アカウントの**⋯**メニューにある**Test**(テスト)でテストします。起動後の最初の回答には約2秒かかり、デフォルトの制限時間より長いため、チャットを始める前に1回テストしてください。

確率は校正済みなので、セルフホストのOpen-Jevと違い、デフォルトのしきい値0.5が適しています([しきい値](#thresholds)を参照)。回答は判定文の表現に左右されるため、[判定文の書き方](../prompts/conditional-prompts.md#writing-statements)に従ってください。

## 関連ガイド

- [カスタムエージェントの作成](../agents/custom-agents.md)
- [条件付きプロンプト](../prompts/conditional-prompts.md)
- [グループチャット](../chats/group-chats.md)
- [内蔵モデルのセットアップ](local-model.md)
- [AIプロバイダーへの接続](connecting-to-a-provider.md)
