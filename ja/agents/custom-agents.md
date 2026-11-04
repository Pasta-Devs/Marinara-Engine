# カスタムエージェントの作成

カスタムエージェントとは、自分で書くヘルパーです。指示の内容、動くタイミング、変更してよいものを自分で決めます。やりたいことをこなす[ダウンロードできるエージェント](built-in-agents.md)がないときに作ってください。インストール済みのエージェントに近いものがあれば、**Agents**(エージェント)パネルでそのカードにマウスを合わせ、**Copy agent**(エージェントをコピー)をクリックすると、編集できるコピーが作られます。

始める前に: [エージェント: チャットを支えるAIヘルパー](agents-overview.md)を読んでください。エージェントは作っただけでは動きません。作ったあとでチャットに追加します。カスタムエージェントは、どのチャットモードでも動きます。

## カスタムエージェントの作り方

1. **Agents**パネルを開きます。
2. 上部にある**New**(新規)ボタン(プラスアイコン)をクリックします。全画面のエージェントエディターが開きます。
3. タイトル欄に名前を入力します。たとえば`Weather Reporter`のようにします。
4. **Description**(説明)と**Author**(作者)を記入します。
5. **Pipeline Phase**(実行フェーズ)を選びます([Pipeline Phase](#pipeline-phase)を参照)。
6. **Custom Agent Abilities**(カスタムエージェントの権限)で、エージェントに必要な権限をオンにします。
7. エージェントが出力する内容に合う**Result Type**(結果の種類)を選びます。迷ったら**Context Injection**を選んでください。権限も、厳密な出力形式も必要ありません。
8. **Prompt Template**(プロンプトテンプレート)に、エージェントへの指示を書きます。
9. 上部バーの**Save**(保存)をクリックします。緑色の**Saved**バッジが表示されます。

作成したエージェントは、**Agents**パネルの**Custom Agents**(カスタムエージェント)セクションに表示されます。使うときは、チャットを開いて**Chat Settings**(チャット設定)に移動し、**Enable Agents**(エージェントを有効にする)をオンにしてから、**Custom Agents**でエージェントを追加します。

## Pipeline Phase

**Pipeline Phase**は、エージェントが動くタイミングを決めます。

- **Pre-Generation**: 返信の前に動きます。コンテキストを追加したり、プロンプトを変更したりできます。
- **Parallel**: 返信と同時に動きます。完成した返信は見えません。
- **Post-Processing**: 返信のあとに動きます。返信を読めるほか、一部の結果の種類では返信を編集できます。

結果の種類によっては、フェーズが固定されます。**Text Rewrite**を選ぶと、フェーズは**Post-Processing**に切り替わります。**Prompt Patch**と**Character Activity**を選ぶと、フェーズは**Pre-Generation**に切り替わります。

Post-Processingのエージェントには、**Turn Data Access**(ターンデータへのアクセス)セクションも表示されます。ここには**Pre-generation injections**と**Parallel agent results**という2つのトグルがあります。オンにすると、同じターンで他のエージェントが生成した内容をエージェントが読めるようになります。

## Custom Agent Abilities

権限は、明示的にオンにしたときだけ使える機能です。どの権限も、トグルをオンにするまではブロックされたままです。

- **Create lorebooks**: ロアの出力に対象が指定されていないとき、エージェントが作るロアブックを新しく作成します。
- **Edit lorebooks**: ロアブックのエントリーを書き込むか、ロアブックの更新結果を返します。
- **Edit messages**: 生成されたメッセージのテキストを置き換えるか、続きの選択肢を追加します。
- **Edit trackers**: ゲーム、キャラクター、ペルソナ、カスタムの各トラッカーの状態を更新します。
- **Frontend styling**: 生成中に一時的な視覚スタイルを適用します。
- **Change chat backgrounds**: チャットの背景を変更して保存します。
- **Change character sprites**: チャットに表示されるキャラクターとペルソナの表情を変更します。
- **Control media playback**: Spotify、YouTube、手元の音楽を操作します。
- **Control haptic devices**: 接続されたハプティックデバイスに、範囲を限定したコマンドを送ります。
- **Edit About Me details**: チャットごとのAbout Meのテキストを変更します。公開されるカードの変更には、引き続き承認が必要です。
- **Image generation**: 画像生成に画像プロンプトを送ります。
- **Vectors/embeddings**: ベクトルのコンテキストを使います。ベクトルを使うと、Marinaraは意味からテキストを検索できます。
- **Main prompt edits**: メインのモデルに送るプロンプトを編集します。
- **Create character cards**: 新しいキャラクターカードを提案します。保存されるのは、内容を確認して受け入れたあとだけです。
- **Choose active chat characters**: 現在のConversationまたはRoleplayの返信で、チャットに追加されたキャラクターのうちどれを有効にするかを選びます。

**Edit lorebooks**をオンにすると、**Lorebook Writer**(ロアブックへの書き込み)セクションが表示されます。**Allow lorebook entry writes**をオンにして、**Target lorebook**でロアブックを1つ選びます。エージェントが書き込めるのは、そのロアブックだけです。

## Result Type

**Result Type**は、エージェントの回答をMarinaraがどう読み取るかを決めます。ほとんどの種類はJSONを前提にしています。JSONは、波括弧と引用符で書くテキスト形式です。種類は、必要な権限をオンにするまでグレーアウトしたままです。

権限が不要な種類:

- **Context Injection**: 生成前にテキストを追加するか、生成後にメモを記録します。いちばん始めやすい種類です。

**Edit messages**が必要な種類:

- **Text Rewrite**: 返信のあとに、メッセージのテキストを置き換えます。
- **Interactive Choices**: メッセージに続きの選択肢を追加します。

**Edit trackers**が必要な種類:

- **Character Tracker**: その場にいるキャラクターを更新します。
- **Persona Stats**: ペルソナの能力値、状態、インベントリーを更新します。
- **Custom Tracker**: 自作のカスタムトラッカーの項目を置き換えます。
- **Game State**: 世界の状態にあたるゲームデータを更新します。

それぞれ専用の権限が必要なその他の種類:

- **Lorebook Update**(Edit lorebooks): ロアブックのエントリーを作成または更新します。
- **Image Prompt**(Image generation): 画像生成にシーンを描かせます。
- **Prompt Patch**(Main prompt edits): プロンプトのセクションを追加、先頭に挿入、または置き換えます。
- **Frontend Style**(Frontend styling): 一時的なスタイル効果を適用します。
- **Background Change**(Change chat backgrounds): 使える背景を選んで保存します。
- **Sprite Change**(Change character sprites): チャットに表示される表情を変更します。
- **Spotify Control**、**YouTube Control**、**Local Music Control**(Control media playback): 再生を操作します。
- **Haptic Command**(Control haptic devices): ハプティックデバイスに、範囲を限定したコマンドを送ります。
- **About Me Update**(Edit About Me details): チャットごとのAbout Meのテキストを更新し、公開用の編集を提案します。
- **Character Card Creation**(Create character cards): 編集できるキャラクターカードを1枚提案し、承認を求めます。
- **Character Activity**(Choose active chat characters): 現在の返信で使うキャラクターカードを選びます。返信の前に動き、チャットに追加されたキャラクターを少なくとも1人選ぶ必要があります。

### チャット内での画像エージェントのコントロール

**Image generation**の権限を持つエージェントには、**Chat Settings → Agents → Custom Agents**(チャット設定 → エージェント → カスタムエージェント)に2つのコントロールが追加されます。

- **Image model**(画像モデル): このチャットでだけ、このエージェントの画像接続を上書きします。エージェント自身の設定を使うには、**Agent default**のままにします。チャットの**Image Style**(画像スタイル)も、カスタムエージェントの画像に適用されます。
- **Camera button**(カメラボタン): 起動キーワードを待たずに、今すぐ画像を作ります。エージェントのテンプレートがプロンプトを書かなかった場合は、画像の代わりにエラートーストが表示されます。

## Activation Keywords

デフォルトでは、エージェントは通常の周期(どのくらいの頻度で動くか)で動きます。**Activation Keywords**(起動キーワード)を設定すると、場面に関係がないときはエージェントを動かさないため、トークンを節約できます。

1. **Activation Keywords**に、`tavern`や`secret door`のようなキーワードやフレーズを、1行に1つずつ入力します。
2. **Scan Depth**(検索する深さ)に、検索する直近のメッセージ数を設定します。デフォルトは5、最大は200です。

これで、それらのメッセージにキーワードが現れたときだけ、エージェントが動きます。欄を空にすると、このフィルターは無効になります。周期と、設定した起動質問は引き続き適用されます。

## ツールの追加

エージェントはツールを呼び出せます。ツールとは、AIが実行して何かを取得したり変更したりし、その結果を読み取る関数のことです。function calling(関数呼び出し)とも呼ばれます。

1. エージェントエディターで**Tools / Function Calling**を開き、使いたいツールをそれぞれオンにします。一覧には、組み込みのツールと自作のツールが並びます。ツールの作り方は[カスタムツール](../extending/custom-tools.md)を参照してください。
2. **Chat Settings**で**Function Calling**を開き、**Enable Tool Use**(ツールの使用を有効にする)をオンにします。これがオフのままだと、エージェントのツールは使えません。

インポートしたエージェントには、ツールの利用権限が付きません。インポートしたエージェントを確認してから、使わせるツールを自分で選んでください。

エージェントは1回の実行で、最大16ラウンドまでツールを呼び出せます(サーバーの`MAX_TOOL_ROUNDS`のほうが小さい場合は、それより少なくなります)。その後は、手元の情報で回答します。一度に1つのツールしか呼ばないモデルは呼び出しごとに1ラウンドを使うため、多くのエントリーを保存するエージェントは、1回の応答で複数の呼び出しを行うようにしてください。ロアブックのバックフィルの実行では、最大64ラウンドまで使えます。

## Named prompt options

1つのエージェントに、複数のプロンプトの候補を持たせられます。チャットごとに、エージェントを編集しなくても候補を1つ選べます。

1. **Prompt Template**の下にある**Named prompt options**(名前付きプロンプト)を探します。
2. **Add option**(候補の追加)をクリックします。
3. 名前と短い説明を付け、その候補で使うプロンプト本文を最後まで書きます。

このエージェントをチャットに追加すると、**Prompt Mode**(プロンプトモード)ドロップダウンに候補が並びます。候補がなければ、デフォルトのプロンプトだけが表示されます。

## その他の設定

- **Model override**(モデルの上書き): このエージェントだけ別のモデルを使います。たとえば、より安価なモデルです。空のままにすると、チャットのモデルを使います。エージェントは、その接続に保存された生成パラメーターを送信します。[エージェントのパラメーター](../prompts/generation-parameters.md#parameters-for-agents)を参照してください。
- **Agent Budget**(エージェントの予算): **Context Size**(コンテキストサイズ)は、エージェントが読む直近のメッセージ数です(デフォルトは5)。**Max Output Tokens**(最大出力トークン)は、出力用に確保する枠です(デフォルトは4096、範囲は128から32768まで)。
- **Add as Prompt Section**(プロンプトセクションとして追加): エージェントの最新の出力を、プロンプトプリセットに配置できるセクションとして使えるようにします。

**Prompt Template**では、`{{user}}`や`{{char}}`などのマクロが使えます。[マクロ](../prompts/macros.md)を参照してください。

## 作例

このエージェントは、返信をすべてイギリス英語に書き換えます。

1. 名前を`British English Editor`にします。
2. **Custom Agent Abilities**で**Edit messages**をオンにします。
3. **Result Type**で**Text Rewrite**を選びます。フェーズは**Post-Processing**に切り替わります。
4. **Prompt Template**に次の内容を貼り付けます。

   ```text
   You are a copy editor. Rewrite the latest reply into British English.
   Change spelling and vocabulary only. Do not change the meaning, tone, or events.
   Return JSON with an "editedText" field holding the full rewritten reply,
   and a "changes" array of short notes describing what you changed.
   ```

5. **Save**をクリックします。
6. Roleplayのチャットを開き、**Chat Settings**で**Enable Agents**をオンにして、**Custom Agents**からエージェントを追加します。

返信のたびに、エージェントは次のようなJSONを返します。

```json
{"editedText":"The colour of the harbour caught her eye.","changes":[{"description":"color to colour, harbor to harbour"}]}
```

Marinaraは`editedText`を返信と差し替えます。`changes`のメモは、短い要約として表示されます。

## エージェントのインポートとエクスポート

1つのエージェントをエクスポートするには、エディターの上部バーにある**Export agent**(エージェントのエクスポート)ボタン(アップロードアイコン)をクリックします。ファイルにはエージェントのプロンプトと設定が入り、カスタムツールの定義は含まれません。複数をエクスポートするには、**Agents**パネルの**Select agents**(エージェントの選択)を使い、対象を選んでエクスポートします。

外部からのインポートは、デフォルトでロックされています。

1. **Settings → Advanced → Danger Zone**(設定 → 詳細設定 → 危険な操作)を開き、**Allow custom Agent imports**(カスタムエージェントのインポートを許可)をオンにします。`.env`の変更は必要ありません。
2. **Agents**パネルで**Import agents**(エージェントのインポート)をクリックし、エージェントのファイルかフォルダーを選びます。
3. Marinaraが表示する権限の一覧を確認します。承認するのは、そのエージェントに必要なものだけにしてください。チェックしていない機能は、ブロックされたままです。

このロックが影響するのは、ファイル、フォルダー、カスタムリポジトリーから取り込むエージェントだけです。自分で作ったエージェントと、**Agent Organizer**の公式エージェントは通常どおり動きます。インポートしたファイルには毎回新しいカスタムの識別子が割り当てられるため、公式エージェントを置き換えることはできません。

安全のため、Marinaraは同梱された関数を無視し、ツールの選択を消去し、一時的なCSSを無害化します。さらに、インポートしたエージェントがメッセージ、トラッカー、ロアブック、背景、スプライト、メディア、ハプティクス、About Meのデータ、プロンプト、画像を変更する前に、承認済みの機能かどうかを確認します。信頼できる関数は別途インポートして内容を確認し、自分でエージェントに紐付けてください。**Danger Zone**のトグルをオフにすると、インポートしたエージェントは動かなくなります。

<a id="activation-questions"></a>

## 起動質問

起動質問は、直近の場面でこのエージェントが必要かどうかを尋ねます。キーワードでは拾えない言い換えも捉えられます。起動質問には**Decision model**(判定モデル)が必要です。これは、はいかいいえで答える質問に回答する小型のモデルです。Connectionsパネルで1つ選んでください。[Decisionモデル](../connections/decision-models.md)を参照してください。**Decision model**がデフォルトの**None**(なし)のままだと、質問の欄は無効のままで、質問があるエージェントも質問がない場合と同じように動きます。

1. カスタムエージェントを開きます。
2. 最大500文字の**Question**(質問)を入力します。マクロの`{{user}}`と`{{char}}`も使えます。
3. **Run when probability is at least**(実行に必要な最小確率)に、このエージェントのしきい値を設定します。「はい」の確率がこの値以上のときにエージェントが動くため、値を高くするほど実行を省く回数が増えます。エディターには、使っているモデルに合わせた推奨値が表示されます。ローカルのチャットモデルとDecisionアカウントでは0.5、組み込みのOpen-Jevモデルでは0.1です。モデルを切り替えたら、自分のチャットで値を確認してください。[しきい値](../connections/decision-models.md#thresholds)を参照してください。
4. 任意: **Bypass the question after this many messages without a successful run**(指定メッセージ数の間に実行が成功しなければ質問を省略)を設定します。その数のメッセージが進むと質問が省略されるため、「いいえ」と答え続けるモデルがエージェントをずっと止めてしまうことはありません。キーワードと周期は引き続き適用されます。

質問は、`The latest message moves the scene to a new place.`のように、最新のメッセージについて述べる文として書いてください。小型のモデルは、`Did the scene change?`よりもこちらのほうが安定して答えました。[判定文の書き方](../prompts/conditional-prompts.md#writing-statements)を参照してください。

動作の仕組み:

- キーワードと周期を先に確認するため、省かれたエージェントは判定リクエストを使いません。スキャン深度が同じ質問は、フェーズごとにまとめて問い合わせます。
- **Scan Depth**は、キーワードと質問の両方が使うメッセージを決めます。
- 生成前と並行のエージェントは、返信前のチャットを使います。後処理のエージェントは、完成した返信も読みます。
- 時間切れ、モデルが使えない、無効な回答のいずれかの場合、エージェントは通常どおり動きます。制限時間は、モデルの種類と、モデルが先に考える必要があるかどうかで変わります。[制限時間](../connections/decision-models.md#time-limits)を参照してください。
- 起動質問または判定文を持つエージェントをインポートすると、Decisionモデルのガイドへのリンクが付いた通知が表示されます。Decisionモデルがない場合、エージェントはキーワードと**Trigger Cadence**(起動頻度)が許すたびに動き、プロンプトの判定文は「いいえ」として扱われます。

起動質問が使えるのは、カスタムエージェントだけです。

<a id="decision-statements-in-the-agents-prompt"></a>

## エージェントのプロンプト内の判定文

起動質問は、エージェントが動くかどうかを決めます。**Prompt Template**内の判定文は、動いているエージェントに何を伝えるかを決めます。構文は[条件付きプロンプト](../prompts/conditional-prompts.md#asking-the-decision-model)で説明しています。

```text
{{#if decision:"In the latest message, the characters move to a different location"}}
Update the location field.
{{else}}
Leave the location as it is.
{{/if}}
```

判定文を使うと、動きの少ないターンには小さなプロンプトを送れます。トラッカーは、場所が変わったときだけ場所を更新できます。画像エージェントは、場面が変わったときだけ新しい絵を記述できます。音楽エージェントは、雰囲気が変わったときだけ曲を変えられます。複数の指示セットから1つを選ぶには、`{{#if decision_choice:"The kind of scene in the latest message" == "combat"}}`、続いて`{{else if decision_choice:"The kind of scene in the latest message" == "dialogue"}}`のように書いていきます。[条件付きプロンプト](../prompts/conditional-prompts.md#asking-the-decision-model)を参照してください。

- 生成前と並行のエージェントは返信前のチャットを読み、回答をメインプロンプトと共有します。後処理のエージェントは完成した返信を読み、判定文はその返信を含めて改めて問い合わせられます。
- エージェントを再実行すると、同じターン、モデル、判定文についてキャッシュに残っている正常な回答を再利用します。[回答の再利用](../prompts/conditional-prompts.md#answer-reuse)を参照してください。
- エージェントのプロンプトでは、`{{char}}`はチャット内のすべてのキャラクターを表すため、グループでは`{{char}} is angry`が「Kaelen, Alyssa is angry」になります。キャラクターの名前を書くか、「a character」と書いてください。
- 回答がなければ、判定文は「いいえ」として扱われます。Decisionモデルを使っていない利用者も多いため、`{{else}}`分岐でも妥当な動作になるようにしてください。

Marinara-Agentsからインストールしたエージェントも、同じ方法でプロンプトを処理します。

## 関連ガイド

- [エージェント: チャットを支えるAIヘルパー](agents-overview.md)
- [Decisionモデル](../connections/decision-models.md)
- [ダウンロードできるエージェント一覧](built-in-agents.md)
- [カスタムツール](../extending/custom-tools.md)
- [マクロ](../prompts/macros.md)
