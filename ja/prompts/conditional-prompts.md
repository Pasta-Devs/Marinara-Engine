# 条件付きプロンプト({{#if}})

このガイドでは、Marinara Engineの`{{#if}}`ブロックの使い方を説明します。条件ブロックを使うと、ある値が決めておいた条件に一致したときだけ、プロンプトの一部を含められます。条件ブロックはマクロ機能の一部なので、キャラクターカード、ペルソナ、ロアブックのエントリー、プロンプトプリセットなど、マクロが使える場所ならどこでも動きます。

## 条件付きプロンプトでできること

マクロとは、Marinara Engineがプロンプトを組み立てるときに実際の値へ置き換える`{{double-brace}}`形式のプレースホルダーです。条件ブロックはそこから一歩進みます。値を調べたうえで、片方のテキストだけを残し、残りは捨てます。

条件、条件が真のときに使うテキスト、そして必要であれば偽のときに使うテキストを書きます。Marinaraはプロンプトを組み立てるたびに条件を読み直します。つまり、同じカードやプリセットでも、キャラクター、ペルソナ、チャットごとに違う動きをさせられます。

よくある使い方は、共通のプリセットの中にキャラクターごとの指示を入れることです。もう1つは、内容が入っているときだけその項目を含めて、空のラベルをモデルに送らないようにする使い方です。

## 基本の書き方

条件ブロックは`{{#if condition}}`で始まり、`{{/if}}`で終わります。その間にあるテキストが、条件が真のときに使われます。

```
{{#if condition}}
Text used when the condition is true.
{{/if}}
```

偽の場合に使うテキストは、`{{else}}`の分岐に書けます。

```
{{#if condition}}
Text used when true.
{{else}}
Text used when false.
{{/if}}
```

`{{else if}}`でさらに条件をつなげることもできます。Marinaraは分岐を上から順に調べます。条件が真になった最初の分岐だけを残し、その中のマクロを展開して、ほかの分岐はすべて捨てます。どの条件も真にならず、`{{else}}`もない場合、ブロック全体には何も残りません。

```
{{#if length == "short"}}
Keep your reply to one or two sentences.
{{else if length == "long"}}
Write a detailed, multi-paragraph reply.
{{else}}
Write a reply of normal length.
{{/if}}
```

ブロックは上の例のように複数行で書いても、1行にまとめて書いてもかまいません。大きい条件ブロックの分岐の中に、別の条件ブロックを入れ子にすることもできます。

## 使える演算子

条件は通常、左の値、演算子、右の値の組み合わせで、`char == "Alice"`のように書きます。使える演算子は下の表のとおりです。演算子はすべてコード表記で示しています。

| 演算子 | 意味 |
| --- | --- |
| `==`, `=`, `is` | 等しい。 |
| `!=`, `is not` | 等しくない。 |
| `>` | より大きい(数値のみ)。 |
| `<` | より小さい(数値のみ)。 |
| `>=` | 以上(数値のみ)。 |
| `<=` | 以下(数値のみ)。 |
| `contains`, `includes` | 左の値が右の値をテキストとして含む。 |
| `not contains`, `not includes` | 左の値が右の値を含まない。 |

比較の動き方には、次のルールがあります。

1. `==`、`=`、`is`、`!=`、`is not`では、両側が数値に見える場合、Marinaraは数値として比較します。そのため`5`と`5.0`は等しくなります。それ以外はテキストとして、大文字と小文字を区別せずに比較します。そのため`Mari`と`mari`は等しくなります。
2. `>`、`<`、`>=`、`<=`では、両側とも数値である必要があります。どちらかが数値でなければ、条件は偽になります。
3. `contains`、`includes`、`not contains`、`not includes`では、大文字と小文字を区別しません。そのため`contains "dr"`は`Dr Smith`というテキストに一致します。

## ORとANDによる条件の組み合わせ

どちらかの条件に当てはまればよいときは`||`を、すべての条件に当てはまる必要があるときは`&&`を使います。

```
{{#if character == "Maukie" || character == "Pantalone"}}
Use the shared Maukie and Pantalone instructions.
{{/if}}

{{#if characters contains "Maukie" && characters contains "Pantalone"}}
Both characters are present in this chat.
{{/if}}
```

`&&`は`||`より先に評価されます。順序をはっきり指定したいときは、丸括弧で囲みます。

```
{{#if (character == "Maukie" || character == "Pantalone") && scenario contains "lake"}}
Use the lakeside instructions for either character.
{{/if}}
```

同じ値に対して等しいかどうかの選択肢を複数並べるときは、`||`の後ろで左辺の繰り返しを省略できます。

```
{{#if character == "Maukie" || "Pantalone"}}
Use the shared instructions.
{{/if}}
```

この省略形は`character == "Maukie" || character == "Pantalone"`と同じ意味です。使えるのは等値の演算子`==`、`=`、`is`です。`&&`の両側には条件を省略せずに書いてください。1つの値が同時に2つの異なる値と等しくなることは、まずないためです。

### 中身があるかどうかの判定(演算子なし)

演算子を書かずに条件だけを書くと、Marinaraは中身があるかどうかを判定します。見ているのは「この値に実質的な中身があるか」という点だけです。

```
{{#if scenario}}
Current scene: {{scenario}}
{{else}}
No specific scene is set.
{{/if}}
```

この判定は、値が空でなく、しかも`false`、`0`、`no`、`off`、`null`、`undefined`のいずれでもないときに真になります。語の比較では大文字と小文字を区別しません。欄に入力があるときだけテキストを含めたい場合は、この判定を使います。

### 比較に使えるもの

条件の左辺と右辺には、次のいずれかを書けます。

1. `char`、`user`、`group`、`persona`、`description`、`personality`、`scenario`、`input`、`model`などの項目キーワードや本人を指すキーワード。対応するマクロと同じ値を読み取ります。`group`は、いま返信するキャラクターを除いた、チャットに参加中のほかのキャラクターを並べます。
2. `"Alice"`のような引用符付きのリテラル。
3. `length`のようなプリセット変数の名前。プリセット変数とは、プロンプトプリセットの中で定義する名前付きの値です。[プリセット変数](preset-variables.md)を参照してください。
4. `var:name`または`var.name`と書く、明示的な変数の参照。
5. 別のマクロ。先にその値が展開されてから比較されます。
6. `decision:"..."`または`decision_choice:"..."`と書くDecisionモデルへの問い合わせです。[Decisionモデルへの問い合わせ](#asking-the-decision-model)を参照してください。

キーワードでない単語をそのまま書くと、Marinaraは変数名として扱います。その名前の変数が存在しない場合は、その単語自体をテキストとして使います。リテラルを引用符で囲めばこの取り違えを防げるので、迷ったときは引用符を付けてください。

## 引用符のルール

決まったテキストと比較するときは、引用符で囲みます。こうすると、Marinaraはそれをキーワードや変数ではなく、そのままのリテラルとして扱います。

```
{{#if char == "Dottore"}}
Speak in a cold, clinical tone.
{{/if}}
```

引用符には、まっすぐな二重引用符とまっすぐな一重引用符のどちらも使えます。Marinaraは曲がった(活字体の)引用符も受け付けますが、まっすぐな引用符がいちばん安全で、アプリ内のすべての例とも一致します。引用符で囲んだ値の中では、バックスラッシュで引用符をエスケープでき、改行は`\n`と書けます。

`"Dr Smith"`のように空白を含むリテラルは、必ず引用符で囲みます。引用符のない複数語の値は1つの変数名として読まれるので、まず意図どおりにはなりません。

## 複数キャラクター向けのグループブロック

2人以上のキャラクターがいるグループチャットでは、グループブロックが同じテキストをキャラクターの数だけ繰り返します。これで、シーンにいるキャラクター全員の説明を1つのブロックで書けます。

グループブロックを作るには、1行に`[`だけを書き、続けてテキストを書き、最後に1行に`]`だけを書きます。ブロックの中には、`{{char}}`や`{{description}}`などのキャラクターマクロ、または`{{#if char == "Alice"}}`のようなキャラクターを使った条件を必ず入れます。するとMarinaraはブロックをキャラクターごとに繰り返し、キャラクターマクロをそれぞれのキャラクターに合わせて順に展開します。

```
[
{{char}}'s current attitude:
{{#if char == "Alice"}}cheerful and open{{else}}guarded and quiet{{/if}}
]
```

AliceとBobがいるグループチャットでは、このブロックは2回実行されます。1回目はAliceの名前が入り、Aliceの分岐が選ばれます。2回目はBobの名前が入り、Bobの分岐が選ばれます。グループブロックの外では、キャラクターマクロは現在のキャラクター、または主役のキャラクターだけを参照して展開されます。

グループブロックが展開されるのは、2人以上のキャラクターがいるチャットだけです。1人だけのチャットでは、`[`と`]`の行はただのテキストとして残ります。

## 実例(変換前と変換後)

モデルが実際に受け取る結果まで含めて、3つの例を示します。

共通のプリセットの中で、キャラクターごとに口調を変える例です。

```
{{#if char == "Dottore"}}
Speak in a cold, clinical tone.
{{else}}
Speak warmly and casually.
{{/if}}
```

`Dottore`という名前のキャラクターの場合、モデルは`Speak in a cold, clinical tone.`を受け取ります。それ以外のキャラクターでは`Speak warmly and casually.`を受け取ります。

内容が入っているときだけ項目を含める例です。

```
{{#if backstory}}
Backstory to remember: {{backstory}}
{{/if}}
```

キャラクターに**Backstory**(背景設定)が設定されていれば、モデルはその文章を含む行を受け取ります。**Backstory**欄が空の場合はブロック全体に何も残らないので、空のラベルが送られることはありません。

ユーザー名の一部に一致させる例です。

```
{{#if user contains "Dr"}}
Address the user as Doctor.
{{/if}}
```

ペルソナ名に`Dr`が含まれていれば、モデルはDoctorと呼びかけるよう指示されます。含まれていなければ、ブロックには何も残りません。

<a id="asking-the-decision-model"></a>

## Decisionモデルへの問い合わせ

条件はチャット内で起きていることを**Decision model**(判定モデル)に尋ねることもできます。使うのはConnectionsパネルの**Decision model**で選んだモデルで、実行中のローカルモデル、ホスト型Decision接続、インストールした判定モデルのいずれかです。直近のメッセージと作成した文を読み、その文が真かを答えます。チャットには何も書き込みません。概要と選び方は[Decisionモデル](../connections/decision-models.md)で説明しています。

これにより、毎ターン「Xが起きたらYをする」と送る代わりに、プリセット、カード、ロアブックエントリー、エージェントプロンプトが該当するターンだけ指示を送れます。テキストを絞るのではなく、ロアブックエントリー全体の起動を決めるには、エントリーの[Decision](../lorebooks/entries.md#decision-activation)欄を使ってください。利用例:

- **場面転換。** 実際に場面が移ったときだけ、新しい場所や時間経過を描写します。
- **場面の種類。** 戦闘、親密さ、緊張の進行ルールを、その種類の場面が進んでいる間だけ読み込みます。
- **質問への回答を優先。** `{{#if decision:"In the latest message, {{user}} asks a direct question"}}Answer it before anything else.{{/if}}`
- **カードの気分。** キャラクターカードに「慌てたとき」「怒ったとき」の行動を含め、最近のメッセージにその様子が出た場合だけ表示できます。
- **進行の制御。** 関係をゆっくり育てるプリセットでは、関係が明らかに進むまで、進展を促す指示を控えられます。
- **グループの場面。** グループブロック内の`{{#if decision:"{{char}} is addressed in the latest message"}}`は、話しかけられたキャラクターのセクションだけに直接返答するよう指示します。

### はい・いいえ: `decision:`

```
{{#if decision:"The latest message moves the scene to a new place"}}
Open your reply by describing the new location in one or two sentences.
{{/if}}
```

Decisionモデルが文を真と答えると、条件が真になります。このガイドのほかの要素、`{{else}}`、`{{else if}}`、`&&`、`||`、括弧、入れ子、グループブロックと組み合わせられます。

```
{{#if char == "Dottore" && decision:"In the latest message, {{user}} says something that contradicts what they said earlier"}}
Dottore notices the inconsistency and files it away.
{{/if}}
```

文内のマクロを先に展開するため、`{{user}}`と`{{char}}`を使えます。グループブロックでは、`{{char}}`を名指す文はキャラクターごとに1回尋ねます。

### 複数の回答からの選択: `decision_choice:`

`decision_choice:`はDecisionモデルに選択肢を1つ選ばせます。選択肢は、プロンプト内のどこかでその判定と比較している値です。

```
{{#if decision_choice:"Kaelen's mood in the latest message" == "angry"}}
Kaelen's lines are short and clipped.
{{else if decision_choice:"Kaelen's mood in the latest message" == "sad"}}
Kaelen speaks quietly and looks away.
{{else}}
Kaelen is his usual self.
{{/if}}
```

この例では「angry」「sad」「none of these」から選びます。短縮形も使え、`decision_choice:"The weather in the latest message" == "rain" || "snow"`は両方の選択肢を提示します。判定文は「Kaelen's mood in the latest message」のような主題として書き、選択肢はそれへの短い回答にしてください。

<a id="sticky-and-cooldown"></a>

### StickyとCooldown

毎ターン尋ねる代わりに、回答を数ターン保持できます。判定文の後ろに`sticky:`と`cooldown:`を書きます。

```
{{#if decision:"The latest message starts a fight" sticky:3 cooldown:5}}
Keep combat pacing rules in effect.
{{/if}}
```

- **sticky:N.** はいの後、次のNターンは問い合わせずにはいを保ち、制御している内容がプロンプトに残ります。
- **cooldown:N.** stickyが終わると開始し、stickyがなければはいの直後に始まります。Nターンはいいえとして扱い、尋ねません。その後また尋ねます。
- 1ターンはDecisionモデルが読む新しいメッセージ1件です。同じメッセージの再生成やスワイプは同じターンなので、返信を引き直してもタイマーは進みません。
- stickyやcooldownが判定文を保持している間は問い合わせず、**Decision statements per turn**(1ターンあたりの判定文数)にも数えないため、その枠をほかの文に使えます。
- `decision_choice:`ではstickyが選んだ選択肢を保持し、cooldownはすべての比較をいいえとして扱います。該当する選択肢がなければ何も開始しません。
- 複数箇所に書いた同じ判定文は、指定された中で最も長いstickyとcooldownを使います。
- Peek Promptは保持された回答を表示し、タイマーを進めません。

組み合わせると、場面転換、一度だけの通知、数ターン続かせたい気分など、一度入れた後に休ませたい内容に適します。**Decision**欄で起動するロアブックエントリーには、エントリー自身の**Sticky**と**Cooldown**を使ってください。sticky中は再問い合わせせずに残り、cooldown中のエントリーには問い合わせません。

<a id="checking-every-few-turns"></a>

### 数ターンごとの確認

毎ターン尋ねる必要がない文もあります。後ろに`every:`を書くと、Nターンごとだけ尋ねます。

```
{{#if decision:"The weather changes in the latest message" every:3}}
Describe the new weather in a sentence.
{{/if}}
```

- 初めてその文に到達したターンに尋ね、その3ターン後、さらに3ターン後と続きます。
- 数値の変更はすぐに反映されます。次回の確認は、最後に尋ねたターンから数えます。
- 確認の間はいいえとして扱い、問い合わせず、**Decision statements per turn**にも数えません。
- ターンの数え方はstickyとcooldownと同じで、再生成やスワイプでは予定は進みません。回答の再利用は[回答キャッシュの規則](#answer-reuse)に従います。
- stickyとcooldownは引き続き回答を保持します。`every:`は、これらに保持されていない文をいつ尋ねるかだけを決めます。
- 複数箇所に書いた同じ文は、指定された中で最小の`every:`を使います。

<a id="priority"></a>

### 優先順位

プロンプトの計画に含まれる文が**Decision statements per turn**の枠を超える場合、`priority:`で問い合わせる文を決めます。枠は[複数の段階](#statement-allowance)で適用されます。

```
{{#if decision:"In the latest message, a character is badly hurt" priority:high}}...{{/if}}
{{#if decision:"The latest message mentions food" priority:low}}...{{/if}}
```

- `priority:high`を先に、`priority:low`を最後に尋ねます。未指定の優先順位は中です。
- 同じ優先順位では、プロンプトに現れる順序で決まります。
- 上限を超えると、優先順位の最も低い文から除外します。それらはいいえとして扱い、Peek Promptに一覧表示します。
- 複数箇所に書いた同じ文は、指定された中で最も高い優先順位を使います。
- プロンプト自身の判定文(プリセット、カード、ペルソナ、作者メモ)を先に計画します。ロアブックの本文内の文は、スキャンで起動するエントリーが判明してから残りの枠で計画するため、優先順位に関係なく、プロンプトの文から枠を奪うことはありません。

修飾子は任意の順序で組み合わせられます: `decision:"..." priority:high sticky:3 cooldown:5 every:2`。

### 回答なしはいいえ

Decisionモデル未設定、時間内に答えなかった、処理失敗など、回答がない場合は判定条件が**false**になります。`decision_choice:`ではすべての比較がfalseです。したがってモデルがない利用者には、`{{else}}`分岐、または何もない結果が渡ります。

これを前提に設計してください。

- 判定は**指示の追加や絞り込み**に使い、物語に不可欠な内容は載せないでください。分岐を逃しても、返信の調整が少し減るだけで壊れないようにします。
- 判定ブロックには妥当なデフォルトを用意します。何も送らないか、どのターンにも適する`{{else}}`にします。
- 1つの誤回答がほかの複数の判定を変えるような連鎖を作らないでください。
- 同意、コンテンツ警告、安全上の指示を判定で制限しないでください。常に含めます。

どのモデルも誤回答することがあります。「Jev必須」ではなく「Decisionモデル」を前提に書いてください。ローカルチャットモデルもこれらの文に答えられます。構文は共通ですが、回答や精度はモデルで変わります。

<a id="writing-statements"></a>

### 判定文の書き方

以下はローカルチャットモデルとOpen-Jev 2B・9Bのテストに基づきます。

- 報告書の1行のように、**真か偽かが決まる事実を述べてください**。質問(「Did the scene change?」)や指示(「If the scene changed, describe it」)にしないでください。ローカルチャットモデルは指示に毎回いいえと答え、ブロックが一度も実行されませんでした。
- このターンを意味するときは**「in the latest message」と書いてください**。モデルは複数メッセージを読み、「Mira asks questions」には以前のメッセージの質問を根拠にはいと答えました。
- **誰についてかを明記してください。** 「He is angry」は別のキャラクターとして解釈されました。
- モデルが解釈する必要のある雰囲気の語(「The scene is intense」)や隠れた意図(「Mira is lying」)ではなく、行動や発言など**テキストに現れていることを記述してください**。
- 短くしてください。単純な「and」や否定はテストで問題なく機能したため、自然なほうを使ってください。

表現を試す手順:

1. **Decision model**でモデルを選び、**Test**(テスト)をクリックします。固定サンプルで接続を確認するもので、自分の判定文や現在のチャットは試しません。
2. プロンプトに判定文を加え、真になるはずの例と偽になるはずの例の両方を含む、代表的なチャットメッセージを送ります。
3. **Peek Prompt**で送信された分岐を確認します。判定文の確率やはい・いいえの結果が必要なら、[デバッグログ](../CONFIGURATION.md#logging-levels)を有効にしてください。
4. 表現を調整して再テストします。正常な回答は[再利用](#answer-reuse)できるため、新しいケースでは新しいメッセージか変更した文を使ってください。新しいPeek Promptプレビューを開くだけではモデルに尋ねません。

テスト結果について。各表現を、はいを想定した2ターンといいえを想定した2ターンの計4つのラベル付きRoleplayターンで、Open-Jev 2B、Open-Jev 9B、Gemma 4 E4Bローカルモデルに試しました。1場面の小規模な標本で、一般的な精度ベンチマークでもホスト型Jevのテストでもありません。表はその標本での観察結果で、別のモデルやチャットで同じ結果を保証するものではありません。

| 推奨する表現 | 避けたい表現 | 避けたい表現で起きたこと |
| --- | --- | --- |
| The latest message moves the scene to a new place. | Did the scene change? | 質問形ではOpen-Jev 2Bが「いいえ」とすべきターンでもしきい値を超えました。ローカルモデルには影響しませんでした。 |
| In the latest message, a character draws a weapon or attacks someone. | The scene is intense. | 3モデルすべてが激しい口論を「intense」と判定しました。曖昧な語の意味を決めるのは、作者ではなくモデルになります。 |
| In the latest message, Mira asks Kaelen a direct question. | Mira asks questions. | 最新のMiraのメッセージでは何も尋ねていなくても、以前のメッセージが質問していたため、ローカルモデルとOpen-Jev 9Bははいと答えました。 |
| Kaelen is angry in the latest message. | He is angry. | ローカルモデルは「he」を怒っている酒場の主人と解釈しました。 |
| In the latest message, Mira says something that contradicts what she said earlier. | Mira is lying. | 矛盾を安定して嘘と判定したモデルはありませんでした。 |
| The latest message moves the scene to a new place. | If the scene changed, describe the new location in two sentences. | ローカルモデルは指示に毎回いいえと答え、ブロックは実行されませんでした。 |
| Someone is injured in the latest message. | A fight starts and someone is injured and the city guards arrive. | 正しく処理しました。それでも分割したほうが再利用やデバッグは容易です。 |
| In the latest message, the characters stay in the same place. | The characters did not leave the room. | 違いはありませんでした。自然なほうを書いてください。 |

推奨表現は32問中、Open-Jev 2Bが31問、Open-Jev 9Bが31問、ローカルモデルが32問正答しました。避けたい表現はそれぞれ26、25、24問でした。小規模標本による表現の選び方の例です。チャットに適したモデルは、自分のケースで判断してください。

<a id="limits-and-cost"></a>

### 制限と費用

<a id="statement-allowance"></a>

#### 判定文の枠

**Decision model**の**Decision statements per turn**は、デフォルト32です。名前に反して、全Decisionリクエストや支出に対する単一の上限ではありません。Marinaraは段階ごとに適用します。

1. メインチャットプロンプトの判定文を枠内で計画します。その計画で残った枠をロアブック判定が使います。
2. 返信前や返信と並行するエージェントについては、メインプロンプトとそれらのエージェントプロンプトの判定文をまとめ、設定された枠を再び使って計画します。この段階では先のロアブック使用分を差し引かないため、合計は設定値を超える場合があります。
3. 後処理エージェントには返信後の別枠があります。その判定文は完成した返信を読みます。

エージェントの**起動質問**と**Smart応答順**は、この設定とは別です。

計画に入るのは、その段階で利用可能な判定文だけです。有効なプリセットセクションとグループ、選択した変数の選択肢、起動したロアブックエントリーの本文が該当します。固定条件で文を除外できます。`{{#if char == "Dottore" && decision:"..."}}`はキャラクターがMiraなら尋ねません。変数はプロンプト組み立て中に変わる可能性があるため、変数条件では事前に除外しません。

[sticky、cooldown](#sticky-and-cooldown)、[`every:`](#checking-every-few-turns)で保持される文は枠を消費しません。[優先順位](#priority)はプロンプト計画に収まる文を選びます。ロアブック起動は各エントリーを検討するときに残り枠を使います。除外された文はいいえとなり、Peek Promptに表示されます。

#### リクエストと時間

ホスト型Decision接続では、1ターンに有料リクエストが複数発生する場合があります。判定文はまとめられますが、ロアブック起動、新たに起動したエントリーの本文、再帰的一致、エージェントのフェーズでは追加バッチが必要になることがあります。起動質問はScan Depthとフェーズごとにまとめ、Smart順序は独自のリクエストを行います。判定文の枠はリクエスト数や金額の上限ではありません。

ローカルチャットモデルはホスト型料金の代わりに処理時間を使います。`decision_choice:`は選択肢ごとに1つのはい・いいえの質問で答えるため、1回の選択に複数の生成が必要な場合があります。

各リクエストには[制限時間](../connections/decision-models.md#time-limits)があります。Decision接続はデフォルト1.5秒、ローカルではバックエンドの時間枠です。複数回の合計待ち時間は長くなる場合があります。先に推論が必要なローカルモデルは、**Also gate agents that run before the reply**(返信前に実行するエージェントも判定)をオンにしない限り、返信前の処理では回答を控えます。

<a id="answer-reuse"></a>

#### 回答の再利用

正常な回答は通常、同じターンとDecisionモデルで再利用するため、再生成では追加リクエストなしで同じ分岐を送ることがよくあります。このキャッシュは実行中サーバー内にあり、最大200件のターンキーを保持します。再起動やキャッシュからの除外で再問い合わせが発生します。最新メッセージの追加・編集、モデル変更、判定文変更、選択肢集合の変更でも新しい回答が必要になることがあります。

未回答や失敗は正常な「いいえ」としてキャッシュしません。同じターンを再試行すると再問い合わせし、別の分岐になる場合があります。sticky/cooldownのタイミングは回答キャッシュとは別です。

エージェントプロンプトの判定文も同じ再利用規則に従います。生成前・並行エージェントは返信前のターンを読み、後処理エージェントは完成した返信を読むため、スワイプが変わると新しい回答が必要になる場合があります。手動再実行は入力に対応する正常な回答がキャッシュにあれば再利用します。[エージェントのプロンプト内の判定文](../agents/custom-agents.md#decision-statements-in-the-agents-prompt)を参照してください。

<a id="prompt-caching"></a>

#### プロンプトキャッシュ

プロバイダーの**プロンプトキャッシュ**は、MarinaraのDecision回答キャッシュとは別です。チャットモデルに送るプロンプトの、変わらない接頭部分を再利用できます。判定分岐が変わると、その地点以降を再利用できなくなる場合がありますが、それより前の変わらない接頭部分は対象になる場合があります。再利用範囲と課金は、プロバイダー、キャッシュ境界、最小長、キャッシュ有効期間によって決まります。

**変わりやすい判定ブロックはプロンプトの後方に置いてください。** たとえば履歴後の指示や浅い深度の作者メモです。前方の変更はキャッシュによる節約の大部分を失わせる場合があります。答えがほとんど変わらず、その指示を前方に置く必要があるときだけ、先頭付近に残します。プリセット変数の選択肢も同様で、テキストは`{{name}}`の位置に入ります。

直接のAnthropic接続で**Enable prompt caching**(プロンプトキャッシュを有効化)をオンにすると、Marinaraはシステムプロンプトの末尾と、最新から**Cache depth**(キャッシュ深度)件戻ったメッセージ(デフォルト5件)に印を付けます。履歴前の変更はシステム境界と後続履歴を無効にする場合がありますが、それより前に一致する接頭部分は再利用できる場合があります。履歴の印付き境界より後の変更なら、そのキャッシュ接頭部分を保てます。2つの境界の間の変更では、システム接頭部分を保ちつつ履歴のキャッシュの一部を失う場合があります。キャッシュ読み取りと書き込みは料金が異なります。

最小キャッシュ長と対応する境界はモデルで異なり、変更される可能性があります。詳細と課金規則は、プロバイダーの最新の[Anthropicプロンプトキャッシュガイド](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)または[OpenAIプロンプトキャッシュガイド](https://developers.openai.com/api/docs/guides/prompt-caching)を確認してください。

<a id="when-a-decision-branch-never-appears"></a>

### 判定分岐が表示されない場合

判定分岐が一度も表示されないと報告された場合、考えられる原因は次の順です。

1. **Decisionモデルが未設定。** すべてのターンですべての判定条件がfalseになります。利用する欄の下にエディターが警告を表示します。
2. **Decisionモデルが答えていない。** ホスト型のキー不正、クレジット不足、レート制限、ローカルモデルの停止や時間枠に対する遅さ、インストール済み判定モデルの起動失敗などです。
3. **推論モデルであるため、**返信前の判定を控えています。
4. **該当する計画段階の判定文が多すぎ、**枠を超えています。
5. **回答しているがしきい値未満。** 通常は表現の問題か、そのターンを想定より低く評価するモデルが原因です。

選択したDecisionモデルと**Test**の結果を利用者に確認してください。**Peek Prompt**では実際に送信した分岐がわかります。新たなプレビューを組み立てる場合は、まだ回答のない判定文を一覧にし、その場ではいいえとして扱います。ログレベルをdebugにすると、各判定文、回答、はいとして扱ったかが記録されます。[ログレベル](../CONFIGURATION.md#logging-levels)を参照してください。

原因がプリセットにあることはまれです。ある場合は、たいてい表現か、プロンプトに不可欠な内容を分岐に入れたことが原因です。

## 関連ガイド

- [Decisionモデル](../connections/decision-models.md)
- [プロンプトマクロ](macros.md)
- [プリセット変数](preset-variables.md)
- [グループチャットとグループでの会話](../chats/group-chats.md)
