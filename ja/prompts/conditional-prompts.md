# 条件付きプロンプト({{#if}})

`{{#if}}`ブロックは、条件が真のときだけプロンプトの一部のテキストを含めます。1つの共通のプリセットで、キャラクター、ペルソナ、チャットごとに違う指示を出したり、空の欄を省いたりするのに使います。条件ブロックはマクロ機能の一部なので、[マクロ](macros.md)が使える場所ならどこでも動きます。キャラクターカード、ペルソナ、ロアブックのエントリー、プリセットで使えます。

Marinaraはプロンプトを組み立てるたびに条件を調べ、一致したテキストを残して、残りは捨てます。これは上級者向けの機能で、ほとんどのチャットでは必要ありません。

## 基本の書き方

ブロックは`{{#if condition}}`で始まり、`{{/if}}`で終わります。偽の場合のテキストは`{{else}}`に書き、さらに条件をつなげるときは`{{else if}}`を使います。Marinaraは分岐を上から順に調べ、最初に真になった分岐を残します。どれも真にならず、`{{else}}`もない場合、ブロックには何も残りません。

```text
{{#if length == "short"}}
Keep your reply to one or two sentences.
{{else if length == "long"}}
Write a detailed, multi-paragraph reply.
{{else}}
Write a reply of normal length.
{{/if}}
```

ブロックは1行で書いても、複数行で書いてもかまいません。ブロックを入れ子にすることもできます。

## 演算子

条件は通常、左の値、演算子、右の値の組み合わせで、`char == "Alice"`のように書きます。

| 演算子 | 意味 |
| --- | --- |
| `==`, `=`, `is` | 等しい。 |
| `!=`, `is not` | 等しくない。 |
| `>`, `<`, `>=`, `<=` | より大きい、より小さい、以上、以下(数値のみ)。 |
| `contains`, `includes` | 左の値が右の値をテキストとして含む。 |
| `not contains`, `not includes` | 左の値が右の値を含まない。 |

比較のルールは次のとおりです。

1. 等値の演算子では、両側が数値に見える場合、Marinaraは数値として比較します。そのため`5`と`5.0`は等しくなります。それ以外はテキストとして、大文字と小文字を区別せずに比較します。そのため`Mari`と`mari`は等しくなります。
2. `>`、`<`、`>=`、`<=`では、両側とも数値である必要があります。そうでなければ、条件は偽になります。
3. `contains`と`includes`は大文字と小文字を区別しません。そのため`contains "dr"`は`Dr Smith`に一致します。

### 条件を組み合わせる

ORには`||`を、ANDには`&&`を使います。`&&`は`||`より先に評価されます。順序を決めるには丸括弧を使います。

```text
{{#if character == "Maukie" || character == "Pantalone"}}
Use the shared instructions.
{{/if}}

{{#if (character == "Maukie" || character == "Pantalone") && scenario contains "lake"}}
Use the lakeside instructions for either character.
{{/if}}
```

1つの値に対して等しいかどうかの選択肢を複数並べるときは、繰り返しになる左辺を省略して、`character == "Maukie" || "Pantalone"`のように書けます。これは`==`、`=`、`is`で使えます。`&&`の両側には、省略せずに条件を書いてください。

### 中身があるかどうかの判定

演算子のない条件は、値に実質的な中身があるときに真になります。値が空のとき、または`false`、`0`、`no`、`off`、`null`、`undefined`のいずれかのときは偽になります。大文字と小文字は問いません。

```text
{{#if scenario}}
Current scene: {{scenario}}
{{else}}
No specific scene is set.
{{/if}}
```

### 比較に使えるもの

条件の左辺と右辺には、次のいずれかを書けます。

1. `char`、`user`、`group`、`persona`、`description`、`personality`、`scenario`、`input`、`model`、`reasoning`などの項目キーワードや本人を指すキーワード。対応するマクロと同じ値を読み取ります。`group`は、いま返信するキャラクターを除いた、参加中のほかのキャラクターを並べます。
2. `"Alice"`のような引用符付きのリテラル。
3. `length`のようなプリセット変数の名前。[プリセット変数](preset-variables.md)を参照してください。
4. `var:name`または`var.name`と書く、明示的な変数の参照。
5. 別のマクロ。先に展開されます。
6. Decisionモデルへの問い合わせ。`decision:"..."`または`decision_choice:"..."`と書きます。[Decisionモデルへの問い合わせ](#asking-the-decision-model)を参照してください。

キーワードでない単語をそのまま書くと、変数名として扱われます。その名前の変数がない場合は、ただのテキストとして使われます。取り違えを防ぐため、リテラルの値は引用符で囲んでください。

### 引用符の付け方

決まったテキストは、まっすぐな二重引用符か一重引用符で囲みます。引用符で囲んだ値の中では、引用符をバックスラッシュでエスケープし、改行は`\n`と書きます。`"Dr Smith"`のように空白を含むリテラルは、必ず引用符で囲んでください。引用符のない複数語の値は、1つの変数名として読まれます。

## 複数キャラクター向けのグループブロック

2人以上のキャラクターがいるグループチャットでは、グループブロックがそのテキストをキャラクターごとに1回ずつ繰り返します。1行に`[`だけを書き、続けてテキストを書き、最後に1行に`]`だけを書きます。ブロックの中には、`{{char}}`や`{{description}}`などのキャラクターマクロか、キャラクターを使った条件を必ず入れてください。

```text
[
{{char}}'s current attitude:
{{#if char == "Alice"}}cheerful and open{{else}}guarded and quiet{{/if}}
]
```

AliceとBobがいる場合、このブロックはキャラクターごとに1回ずつ、計2回実行されます。グループブロックの外では、キャラクターマクロは現在のキャラクター、または主役のキャラクターだけを参照して展開されます。キャラクターが1人だけのチャットでは、`[`と`]`の行はただのテキストとして残ります。

## 使用例

キャラクターごとに口調を変える例です。

```text
{{#if char == "Dottore"}}
Speak in a cold, clinical tone.
{{else}}
Speak warmly and casually.
{{/if}}
```

入力されているときだけ項目を含める例です。**Backstory**(背景設定)が空のときはブロックに何も残らないので、空のラベルは送られません。

```text
{{#if backstory}}
Backstory to remember: {{backstory}}
{{/if}}
```

1つのモデルファミリー向けの指示です。`model`は`claude-opus-5-5`のようなモデルIDなので、`contains`はOpusのすべてのバージョンに一致し、`==`は特定の1つのモデルだけに一致します。

```text
{{#if model contains "opus"}}
Keep replies under 400 words.
{{/if}}
```

思考の有無で変わる計画の指示です。推論がどのレベルでもオンなら、モデルは最初の行を受け取ります。推論がオフのときは`{{reasoning}}`が`off`になり、偽として扱われます。特定のレベルに反応させるには、`{{#if reasoning == "max"}}`のように比較します。

```text
{{#if reasoning}}
Plan the reply in your thinking before you write it.
{{else}}
Before replying, write your plan inside <plan></plan> tags.
{{/if}}
```

<a id="asking-the-decision-model"></a>

## Decisionモデルへの問い合わせ

条件は、チャット内で起きていることをDecisionモデルに尋ねることもできます。Decisionモデルは小型のモデルで、直近の数件のメッセージと自分で書いた判定文を読み、その文が真かどうかを答えます。チャットには何も書き込みません。これにより、プリセット、カード、ロアブックのエントリー、エージェントのプロンプトが、指示を該当するターンだけに送れます。

始める前に: **Connections**(接続)パネルの**Decision model**(判定モデル)でDecisionモデルを選んでください。どういうものか、どう選ぶかは[Decisionモデル](../connections/decision-models.md)を参照してください。ロアブックのエントリー全体が起動するかどうかを決めるには、代わりにエントリーの[Decision](../lorebooks/entries.md#decision-activation)欄を使います。

使い方の例としては、場面が移ったときだけ新しい場所を描写する、戦闘中だけ戦闘の進行ルールを読み込む、関係をゆっくり育てるプリセットで関係の進展を控える、グループブロックで話しかけられたキャラクターだけに直接答えさせる、といったものがあります。

### はい・いいえ: `decision:`

```text
{{#if decision:"The latest message moves the scene to a new place"}}
Open your reply by describing the new location in one or two sentences.
{{/if}}
```

Decisionモデルが文を真と答えると、条件が真になります。`{{else}}`、`&&`、`||`、丸括弧、入れ子、グループブロックと組み合わせられます。文の中のマクロは先に展開されるので、`{{user}}`と`{{char}}`を使えます。グループブロックでは、`{{char}}`を名指す文はキャラクターごとに1回ずつ尋ねます。

### 複数の回答からの選択: `decision_choice:`

`decision_choice:`は、モデルに選択肢を1つ選ばせます。選択肢は、それと比較している値です。

```text
{{#if decision_choice:"Kaelen's mood in the latest message" == "angry"}}
Kaelen's lines are short and clipped.
{{else if decision_choice:"Kaelen's mood in the latest message" == "sad"}}
Kaelen speaks quietly and looks away.
{{else}}
Kaelen is his usual self.
{{/if}}
```

モデルは「angry」「sad」「none of these」から選びます。判定文は主題として書き、選択肢は短い回答にしてください。短縮形の`== "rain" || "snow"`は、両方の選択肢を提示します。

選択肢が物語の中で何を意味するかを伝えるには、選択肢の後ろにコロンで区切って基準を加えます。2つの部分は同じ種類の引用符で囲みます。たとえば`== "angry":"Kaelen raises his voice, makes threats or breaks something"`のように書きます。モデルの答えは引き続き「angry」です。1つの選択肢に複数の場所で異なる基準を付けた場合は、最初のものが使われます。

<a id="sticky-and-cooldown"></a>

### StickyとCooldown

毎ターン尋ねる代わりに回答を数ターン保持するには、判定文の後ろに`sticky:`と`cooldown:`を書きます。

```text
{{#if decision:"The latest message starts a fight" sticky:3 cooldown:5}}
Keep combat pacing rules in effect.
{{/if}}
```

- `sticky:N`: はいの後、Nターンのあいだは尋ねずに、その文をはいのままにします。
- `cooldown:N`: stickyが終わったとき、またははいの直後に始まります。Nターンのあいだ、その文はいいえとして扱われ、尋ねられません。
- 1ターンは、Decisionモデルが読む新しいメッセージ1件です。同じメッセージの再生成やスワイプは同じターンなので、返信を引き直してもタイマーは進みません。
- 保持されている文は尋ねられず、**Decision statements per turn**(1ターンあたりの判定文数)にも数えられません。
- `decision_choice:`では、stickyは選ばれた選択肢を保持し、cooldownはすべての比較をいいえとして扱います。
- 複数の場所に書いた同じ文は、指定された中で最も長いstickyとcooldownを使います。
- Peek Promptは保持された回答を表示し、タイマーを進めません。

**Decision**欄で起動するロアブックのエントリーには、代わりにエントリー自身の**Sticky**と**Cooldown**を使ってください。

<a id="until-and-while"></a>

### UntilとWhile

何かが続いているあいだブロックを有効にしておくには、`until:`か`while:`を付けて2つ目の判定文を書きます。

```text
{{#if decision:"A fight starts in the latest message" until:"The fight ends in the latest message"}}
Keep combat pacing rules in effect.
{{/if}}
```

- はいの後、ブロックは有効なままになります。1つ目の判定文は尋ねません。代わりに`until`の判定文を毎ターン尋ね、それが真になったターンにブロックは無効になります。
- `while:`は逆の動きをします。その判定文が真のあいだブロックは有効なままで、偽になると無効になります。
- どちらか一方だけを使ってください。両方を書いた場合は、先に書いたほうだけが使われます。
- ブロックが無効になると、通常どおりcooldownが始まります。あるターンで回答がなかった場合、ブロックは有効なままです。
- `until`または`while`の判定文は**Decision statements per turn**に数えられます。ブロックが有効なあいだ、1つ目の判定文は数えられません。
- この機能は`decision:`で使えますが、`decision_choice:`では使えません。

**sticky**と併用する場合は、2つ目の判定文の後ろに`:and`(`:restrict`でも可)か`:or`(`:extend`でも可)を付けて、両者の組み合わせ方を選びます。

| 書き方 | はいの後、ブロックが有効なままの期間 |
| --- | --- |
| `until:"..." sticky:5`または`until:"...":and sticky:5` | 最大であと5ターン。untilの判定文が真になれば、それより早く無効になります。 |
| `until:"...":or sticky:5` | 少なくともあと5ターン。その後は、untilの判定文が真になるまで続きます。 |
| `while:"..." sticky:5`または`while:"...":or sticky:5` | 少なくともあと5ターン。その後は、whileの判定文が真のあいだ続きます。 |
| `while:"...":and sticky:5` | 最大であと5ターン。whileの判定文が偽になれば、それより早く無効になります。 |

<a id="checking-every-few-turns"></a>

### 数ターンごとの確認

判定文をNターンごとにだけ尋ねるには、`every:N`を付けます。

```text
{{#if decision:"The weather changes in the latest message" every:3}}
Describe the new weather in a sentence.
{{/if}}
```

- 初めてその文に到達したターンに尋ね、その3ターン後、さらに3ターン後と続きます。確認の間はいいえとして扱われ、尋ねられず、**Decision statements per turn**にも数えられません。
- 再生成やスワイプでは、予定は進みません。
- stickyとcooldownは引き続き回答を保持します。`every:`は、保持されていない文をいつ尋ねるかだけを決めます。
- 複数の場所に書いた同じ文は、指定された中で最小の`every:`を使います。

<a id="priority"></a>

### 優先順位

プロンプトの計画に含まれる判定文が**Decision statements per turn**の枠より多い場合、`priority:high`や`priority:low`で、どの文を尋ねるかを決めます。優先順位を指定しなければ中になります。

```text
{{#if decision:"In the latest message, a character is badly hurt" priority:high}}...{{/if}}
{{#if decision:"The latest message mentions food" priority:low}}...{{/if}}
```

- highの文を先に、lowの文を最後に尋ねます。同じ優先順位の中では、プロンプト内の順序で決まります。
- 上限を超えた文は、優先順位の低いものからいいえとして扱われ、Peek Promptに一覧表示されます。
- 複数の場所に書いた同じ文は、指定された中で最も高い優先順位を使います。
- プロンプト自身の判定文(プリセット、カード、ペルソナ、作者メモ)を先に計画します。ロアブックの判定文は、優先順位に関係なく、残った枠を使います。

修飾子はすべて、任意の順序で組み合わせられます。たとえば`decision:"..." priority:high sticky:3 cooldown:5 every:2`のように書きます。

### 回答なしはいいえ

回答がない場合、判定の条件は常に偽になります。Decisionモデルが設定されていない、時間内に答えなかった、処理に失敗した、のいずれかの場合です。`decision_choice:`では、すべての比較が偽になります。これを前提に設計してください。

- 判定は指示の追加や絞り込みに使い、物語に欠かせない内容を載せないでください。
- 判定ブロックにはすべてデフォルトを用意してください。何も送らないか、どのターンでも問題のない`{{else}}`にします。
- 1つの誤回答がほかの複数の判定を変えるような連鎖を作らないでください。
- 同意、コンテンツ警告、安全上の指示を判定で制限しないでください。

どのモデルも誤って答えることがあります。特定の1つの製品ではなく、「Decisionモデル」を前提に書いてください。

<a id="writing-statements"></a>

### 判定文の書き方

- 報告書の1行のように、真か偽かが決まる事実を述べてください。質問(「Did the scene change?」)や指示(「If the scene changed, describe it」)にはしないでください。小型のモデルは指示にいいえと答えることが多く、そうなるとブロックは一度も実行されません。
- このターンのことを指すときは、「in the latest message」と書いてください。モデルは複数のメッセージを読むので、それより前のメッセージを根拠にはいと答えることがあります。
- 誰についての文かを明記してください。「He is angry」は、別のキャラクターのことと読まれることがあります。
- 行動や台詞など、テキストに現れていることを記述してください。雰囲気を表す語(「The scene is intense」)や隠れた意図(「Mira is lying」)は避けてください。
- 短くしてください。再利用やデバッグをしたい場合は、長い文をいくつかに分けてください。

表現を試すには、次の手順に従います。

1. **Decision model**でモデルを選び、**Test**(テスト)をクリックします。これは固定のサンプルで接続を確認するもので、自分の判定文は試しません。
2. プロンプトに判定文を加え、真になるはずのメッセージと偽になるはずのメッセージを送ります。
3. **Peek Prompt**で、どの分岐が送られたかを確認します。**Decision diagnostics**(Decision診断)を開き、**Test decisions**(判断をテスト)を選ぶと、返信を生成せずに新しい回答を得られます。ホスト型でのテストには料金がかかる場合があります。[判定文のテスト](../chats/peek-prompt.md#testing-decision-statements)を参照してください。
4. 表現を調整して、もう一度テストします。実際の生成での回答を見るには、Debug Modeか[デバッグログ](../CONFIGURATION.md#logging-levels)をオンにしてください。

<a id="limits-and-cost"></a>

### 制限と費用

<a id="statement-allowance"></a>

#### 判定文の枠

**Decision model**の下にある**Decision statements per turn**は、デフォルトで32です。これはすべてのDecisionリクエストや支出に対する単一の上限ではありません。Marinaraはこれを段階ごとに適用します。

1. メインのチャットプロンプトの判定文を、枠の範囲内で計画します。ロアブックの判定は、残りの枠を使います。
2. 返信の前や返信と並行して動くエージェントは、メインのプロンプトとまとめた計画になり、枠をもう一度使います。この段階ではロアブックの使用分を差し引かないため、合計が設定値を超えることがあります。
3. 後処理エージェントには、返信の後に別の枠があります。

エージェントの起動質問とSmart応答順は、この設定とは別です。

各段階の計画に入るのは、その段階で使える判定文だけです。有効なプリセットのセクションとグループ、選択した変数の選択肢、起動したロアブックのエントリーの内容が該当します。固定の条件は判定文を除外できます。たとえばキャラクターがMiraのとき、`{{#if char == "Dottore" && decision:"..."}}`の判定文は除外されます。変数の条件では除外されません。変数はプロンプトの組み立て中に変わる可能性があるためです。sticky、cooldown、`every:`で保持されている判定文は枠を使いません。除外された判定文はいいえとして扱われます。

#### リクエストと時間

ホスト型のDecisionアカウントでは、1ターンで課金対象のリクエストが複数発生することがあります。判定文はまとめて送れますが、ロアブックの起動、新たに起動したエントリーの内容、再帰的な一致、エージェントのフェーズでは、追加のバッチが必要になることがあります。ローカルのチャットモデルは、料金の代わりに処理時間がかかります。また、`decision_choice:`には選択肢ごとに1つのはい・いいえの質問で答えます。

各リクエストには制限時間があります。デフォルトは、ホスト型のDecisionアカウントでは1.5秒、OpenAI互換チャットモデルのアカウントやローカルモデルでは4秒です。[制限時間](../connections/decision-models.md#time-limits)を参照してください。ローカルの推論モデルは、**Also gate agents that run before the reply**(返信前に実行するエージェントも判定)をオンにしない限り、返信の前には回答を控えます。

<a id="answer-reuse"></a>

#### 回答の再利用

Marinaraは通常、同じターンと同じDecisionモデルに対する正常な回答を再利用します。そのため再生成では、新しいリクエストなしで同じ分岐を送ることがよくあります。このキャッシュは実行中のサーバー内にあり、最大200ターン分を保持します。再起動、キャッシュからの除外、最新メッセージの追加や編集、モデルの変更、判定文や選択肢の組み合わせの変更があると、新しい回答が必要になることがあります。

回答がなかった場合や失敗した場合はキャッシュされないため、再試行するともう一度尋ね、別の分岐になることがあります。エージェントのプロンプト内の判定文も同じルールに従います。エージェントを手動で再実行すると、その入力に対してまだキャッシュに残っている回答を再利用します。[エージェントのプロンプト内の判定文](../agents/custom-agents.md#decision-statements-in-the-agents-prompt)を参照してください。

<a id="prompt-caching"></a>

#### プロンプトキャッシュ

プロバイダーのプロンプトキャッシュは、Marinaraの回答キャッシュとは別のものです。チャットモデルに送るプロンプトのうち、変わらない先頭部分を再利用できます。判定の分岐が変わると、その地点から後は再利用できなくなることがありますが、それより前の変わらない部分は引き続き対象になることがあります。課金はプロバイダーによって異なります。

よく変わる判定ブロックは、履歴の後の指示や浅い深度の作者メモなど、プロンプトの後ろのほうに置いてください。判定を先頭近くに置くのは、その答えがめったに変わらない場合だけにします。プリセット変数の選択肢も同じです。そのテキストは`{{name}}`がある位置に入るためです。

Anthropicに直接接続するアカウントで**Enable prompt caching**(プロンプトキャッシュを有効にする)をオンにすると、Marinaraはシステムプロンプトの末尾と、最新のメッセージから**Cache depth**(キャッシュ深度)件さかのぼったチャットメッセージ(デフォルトは5件)に印を付けます。履歴より前を変更すると、システムの境界とそれより後の履歴が無効になることがあります。印を付けた履歴の境界より後の変更であれば、キャッシュされた部分を保てます。最小キャッシュ長はモデルによって異なります。プロバイダーの最新の[Anthropicプロンプトキャッシュガイド](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)または[OpenAIプロンプトキャッシュガイド](https://developers.openai.com/api/docs/guides/prompt-caching)を確認してください。

<a id="when-a-decision-branch-never-appears"></a>

### 判定分岐が表示されない場合

考えられる原因を、可能性の高い順に挙げます。

1. Decisionモデルが設定されていません。すべての判定の条件が偽になります。判定を使う欄の下に、エディターが警告を表示します。
2. Decisionモデルが答えていません。ホスト型のアカウントでのキーの誤り、クレジット切れ、レート制限、ローカルモデルの停止や遅すぎる動作、インストールした判定モデルの起動失敗などが考えられます。
3. 返信の前には回答を控える推論モデルです。
4. 計画の段階の判定文が多すぎて、枠を超えています。
5. 回答はしているものの、しきい値に届いていません。たいていは表現が原因です。

**Test**の結果を確認し、**Peek Prompt**で実際に送られた分岐を見てください。Peek Promptには、まだ回答のない判定文が一覧表示され、それらはいいえとして扱われます。ログレベルをdebugにすると、各判定文、その回答、はいとして扱われたかどうかが記録されます。[ログレベル](../CONFIGURATION.md#logging-levels)を参照してください。プリセットそのものを直す必要があることはまれです。たいていは表現か、プロンプトに欠かせない内容を分岐に入れたことが原因です。

## 関連ガイド

- [Decisionモデル](../connections/decision-models.md)
- [プロンプトマクロ](macros.md)
- [プリセット変数](preset-variables.md)
- [グループチャットとグループでの会話](../chats/group-chats.md)
