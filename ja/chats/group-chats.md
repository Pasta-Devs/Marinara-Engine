# グループチャットとグループでの会話

グループチャットとは、2人以上のキャラクターがいるConversationまたはRoleplayのチャットのことです。このガイドでは、グループチャットの作り方、メンバーの管理、発言者の決め方を説明します。Game Modeには独自のパーティーの仕組みがあるため、ここでは扱いません。

「group chat」専用のボタンはありません。2人目のキャラクターを追加した時点で、そのチャットがグループチャットになります。グループチャットは、**Folder**(フォルダー、再利用できるキャラクターの一覧を保存したもの)とも、**Chat Branch**(チャットの分岐、1つのチャットの別バージョン)とも違います。

## グループチャットを作る

1. **Chats**(チャット)パネルで、使いたいモードの**+**ボタン(**New Conversation**または**New Roleplay**)をクリックします。
2. 設定ウィザードが開きます。**Persona & Characters**ステップで**Search characters...**に入力し、キャラクターをクリックして追加します。
3. 同じ手順で2人目のキャラクターを追加します。
4. ウィザードを完了すると、チャットが開きます。

選択欄の上のラベルが変わります。Conversationでは**Group Chat**とメンバー数が、Roleplayでは**Characters**と人数が表示されます。チャットの名前を変更しない場合、Marinaraはキャラクター名から「Alice, Bob, Carol」のような名前を付けます。

キャラクターの人数に決まった上限はありません。ただし人数が増えるほどプロンプトは長くなり、返信1回あたりの費用も上がります。そのシーンに必要なキャラクターだけを追加してください。

フォルダーをまとめて追加するには、同じステップで**Add from Folder**を開き、フォルダーを選んで**Add**をクリックします。すでにチャットにいるキャラクターは追加されません。この操作は、フォルダーが1つ以上あるときだけ表示されます。[キャラクターライブラリーの整理](../characters/library-organization.md)を参照してください。**Random**の行(表示は**Dice pick**)は、まだチャットにいないキャラクターを1人ランダムに追加します。

## メンバーを管理する

**Chat Settings**(チャット設定)を開き、**Characters**セクションを探します。このセクションはGame Modeにはありません。各メンバーの行には、アバター、名前、ドラッグハンドル、目のアイコン、ゴミ箱アイコンが並びます。

| したいこと | 操作 |
| --- | --- |
| キャラクターを追加する | **Add Character**をクリックして検索します。 |
| フォルダーを追加する | **Add Character**をクリックし、フォルダーの行にある**Add all**をクリックします。 |
| 複数をまとめて変更する | メンバーの名前をクリックします。同じ選択欄が開きます。 |
| キャラクターを外す | ゴミ箱アイコン(**Remove from chat**)をクリックします。 |
| 並べ替える | ハンドル(**Drag to reorder**)をドラッグします。**Sequential**の順番では、この順にキャラクターが返信します。 |
| 一時的にオフにする | 目(**Disable in chat**)をクリックします。もう一度クリックするとオンに戻ります(**Enable in chat**)。 |

無効にしたキャラクターは一覧に残りますが、どの返信にも加わりません。カードはモデルに送られず、発言者として選ばれることもありません。全員を無効にすると、返信が空にならないよう、Marinaraは全員を有効として扱います。この状態はチャットごとに保存され、ほかの場所には影響しません。MergedのRoleplayグループでは、[アクティブなキャラクターの自動化](#automate-active-characters-merged-only)で自動的に設定できます。

<a id="choose-who-speaks"></a>

## 発言者を決める

**Chat Settings → Group Chat**(チャット設定 → グループチャット)を開きます。このセクションは、チャットにキャラクターが2人以上いるときだけ表示されます。どちらのモードでも、同じ**Mode**(モード)トグルを使います。

- 1回の返信で全キャラクターを演じます。Roleplayでは**Merged (Narrator)**、Conversationでは**Grouped**です。これがデフォルトです。Roleplayでは、ナレーターはシーンを描写する語り手で、同じ返信の一部です。
- **Individual**は、キャラクターごとに別々の返信を生成します。

Conversationで**Individual**に切り替えると、**Individual replies can use many tokens**という警告が表示されます。返信するキャラクターごとに別々のモデルリクエストを使うため、Autonomous Messagingを使う大きなグループではトークンをすぐに消費します。

### Automate active characters(Roleplay、Merged時のみ)

この設定は、出演者が多いときにキャラクターのオンとオフを自動で切り替えます。このガイドの最後にある[アクティブなキャラクターの自動化](#automate-active-characters-merged-only)を参照してください。

### Color Dialogues(Roleplay、Merged時のみ)

**Color Dialogues**(セリフの色分け)は、デフォルトでオフです。オンにすると、各キャラクターのセリフに、Character Editorの**Colors**タブで設定したそのキャラクター独自の色が使われます。Conversationのグループでは、セリフは発言者ごとに自動で色分けされ、トグルはありません。

<a id="response-order-individual-only"></a>

### Response Order(Individual時のみ)

**Mode**が**Individual**のときは、**Response Order**(応答順)が表示されます。デフォルトは**Sequential**です。

| 順番 | 動作 |
| --- | --- |
| **Sequential** | **Characters**一覧の順に、キャラクターが順番に返信します。Conversationでは、オフラインのキャラクターは飛ばされます。 |
| **Smart** | 短い非表示のモデル呼び出しで、次に返信するキャラクターを選びます。たいていは1人です。メッセージに`@Alice`のようなメンションを書くと、そちらが優先されます。Conversationでは、会話の流れ、スケジュール上の状態、発言頻度をもとに選びます。 |
| **Manual** | 誰も自分からは返信しません。Roleplayでは、**Trigger Response**の選択メニューを使います。Conversationでは、1人以上のキャラクターに`@mention`するか、選択メニューを使います。 |

**Smart**では、モデルが複数のキャラクターを順番待ちに並べることがあります。すぐに返信するのは最初の1人だけです。順番待ちの次のキャラクターに生成させるには、**Trigger Response**の選択メニューを使うか、空のメッセージを送ってください。

[Decisionモデル](../connections/decision-models.md)を選んでいる場合は、その下にある**Also use it to pick who speaks in Smart response order**(Smart応答順の発言者選択にも使用)をオンにできます。すると、Smart順序は候補ごとに「はい/いいえ」のスコアを求めます。

- 質問には、共通の直近5件のメッセージと、各候補の名前、状態、活動、発言頻度、短い性格の抜粋を含む一覧を使います。ホスト型のサービスにも、この一覧が送られます。[モデルが受け取る情報](../connections/decision-models.md#what-the-model-sees)を参照してください。
- 速度と費用は、モデルと候補の数によって変わります。
- Roleplayでは、Marinaraが最も可能性の高い発言者を選びます。Conversationでは、答える理由のある全員が、可能性の高い順に返信します。直前に話したキャラクターは、ほかに答える理由のある人がいれば順番を待ちます。
- Decisionモデルが答えない場合、Smart順序は通常のモデル呼び出しを行います。

Roleplayの**Individual**モードで順序が**Smart**または**Manual**の場合、選択メニューの最初の項目は、人物のアイコンが付いた**Smart**です。その1回の返信について、次の発言者をモデルに選ばせます。保存した順序は変わりません。

### 返信を手動で指示する

**Trigger Response**の選択メニューで発言者を選びます。コンピューターでは**Send**の横にあるボタンで、ラベルは**Trigger character response**です。スマートフォンでは、メッセージバーから開くツールトレイの**Trigger Response**の下にあります。テキストで発言者を指定するには、`@`に続けてキャラクター名を入力します。候補の一覧が表示されます。

### そのほかのIndividualの設定

- **Add Turn To Prompt**は、デフォルトでオンです。どのキャラクターが返信するかを示す短い指示を追加します。
- **Name Prefix History**(Roleplayのみ)は、デフォルトでオフです。過去のメッセージに発言者名を付ける方法を変えます。誰が何を言ったかをキャラクターが取り違え続ける場合以外は、オフのままにしてください。

### Scenario Override(Roleplay)

**Scenario Override**は、グループ全体に共通のシナリオを1つ与えます。欄のテキストは、プロンプト内で各キャラクター自身のシナリオの代わりになります。欄が空なら、各シナリオはそのまま使われます。スイッチはありません。大きなウィンドウで編集するには、展開アイコン(**Expand editor**、タイトルは**Group Scenario Override**)をクリックします。このテキストは1つのチャットだけに属し、設定プロファイルには含まれません。

### Character Exchanges(Conversation)

離れている間にキャラクター同士が話せるようにするには、**Chat Settings → Autonomous Messaging**で**Character Exchanges**(キャラクター同士のやり取り)をオンにします。デフォルトはオフで、グループチャットにだけ表示されます。Marinaraをブラウザーで開いている間だけ動作し、1日あたりのメッセージ上限を自動送信メッセージと共有します。キャラクターのスケジュールの有無にかかわらず動作します。**Individual**のグループでは、やり取りや`@mention`への返信が、グループのその日最後の声かけの1回分を使うことはありません。

## 設定とデフォルト

| 設定 | 場所 | デフォルト |
| --- | --- | --- |
| **Mode** | Group Chatセクション | Roleplayでは**Merged (Narrator)**、Conversationでは**Grouped** |
| **Color Dialogues** | Roleplay、Merged | オフ |
| **Automate active characters** | Roleplay、Merged | オフ |
| **Response Order** | Individual | Sequential |
| **Add Turn To Prompt** | Individual | オン |
| **Name Prefix History** | Roleplay、Individual | オフ |
| **Scenario Override** | Roleplay | 空 |
| **Character Exchanges** | Conversation、Autonomous Messaging | オフ |

設定プロファイルには、**Scenario Override**と自動化のピン留めを除き、これらが保存されます。[設定プロファイル](settings-profiles.md)を参照してください。

## リファレンス

<a id="automate-active-characters-merged-only"></a>

### Automate active characters(Merged時のみ)

Mergedモードでは、アクティブなキャラクター全員のカードが、返信のたびにプロンプトに入ります。Roleplayでは、**Automate active characters**(アクティブなキャラクターを自動化)がカードのオンとオフを代わりに切り替えるため、出演者が多くてもコンテキストがいっぱいになりません。選択肢は3つで、デフォルトは**Off**(オフ)です。

| 選択肢 | 動作 |
| --- | --- |
| **Off** | 目のトグルで、誰をアクティブにするかを自分で選びます。 |
| **Decision model** | 返信のたびにその前に、[Decisionモデル](../connections/decision-models.md)がキャラクターごとに「はい/いいえ」の質問に1つずつ答えます。そのキャラクターは、返信が続くシーンにいるか、またはこれから登場するか、という質問です。話題に出ただけ、思い出されただけのキャラクターはオフのままです。 |
| **Character Tracker** | [Character Tracker](../agents/built-in-agents.md#character-tracker)が直近の返信で記録した登場キャラクターをもとに、誰をアクティブにするかが決まります。追加のモデル呼び出しは不要ですが、1ターン遅れて反映されます。今登場したキャラクターは、次の返信でオンになります。 |

設定の下のヒントは、足りないものがあるときに知らせます。Decisionモデルが選ばれていない場合、このチャットでCharacter Trackerがオフの場合、またはトラッカーが手動で実行される設定の場合です。手動の場合、一覧が変わるのは実行したあとだけです。

- **ピン留め。** 自動化がオンの間、各キャラクターの行で、目の左にピンが表示されます。クリックすると、そのキャラクターを現在の状態(オンまたはオフ)のままピン留めし、自動化はそのキャラクターに触れなくなります。目を手動で切り替えたキャラクターも、ピン留めされます。もう一度ピンをクリックすると解除されます。自動化を**Off**にすると、すべてのピン留めが解除されます。
- **ナレーターはアクティブのままです。** 指定したナレーターがオフになることはありません。
- **回答がなければ一覧は維持されます。** **Decision model**モードでモデルが回答しなかった場合は、あればCharacter Trackerの直近のシーンが使われます。先に思考するモデルの場合(**Also gate agents that run before the reply**(返信前に実行するエージェントも判定)がオンのときを除く)や、Decisionモデルの入力に収まらないほど出演者が多い場合も同じです。どちらからも回答がなければ、一覧はそのままです。
- **誰もアクティブにならない結果は無視されます。** 全員をオフにしてしまう結果は適用されません。
- **Character Activityエージェントが優先されます。** 結果の種類に**Character Activity**を使うカスタムエージェントがあるチャットでは、そのエージェントが引き続き管理します。

Character Trackerは、キャラクターごとに独自の名前を書き込みます。Marinaraはその名前を、カードのID、名前、**Colors**タブにある名前の別名の順に照合して、カードと対応付けます。チャットのキャラクターが1人も含まれないトラッカーの一覧では、現在の一覧が維持されます。自動化は、返信、スワイプ、再生成のたびにその前に実行され、**Continue**とImpersonateでは実行されません。この設定は設定プロファイルに保存されます。ピン留めは1つのチャットに属します。
