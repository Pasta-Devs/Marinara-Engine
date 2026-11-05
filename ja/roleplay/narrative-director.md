# Narrative DirectorとSecret Plot

Narrative Directorは、Roleplayチャットの話の流れを導くエージェント(返信と並行して動く補助役)です。**Push Story**(物語を進める)は、場面が行き詰まったと感じたときに、1回の返信を後押しします。**Secret Plot**(隠された筋書き)は、多くの返信を形づくる、隠された長期的な筋書きを持ち続けます。Roleplayでのみ動作します。エージェント全般の仕組みは、[エージェントの概要](../agents/agents-overview.md)を参照してください。

## チャットにNarrative Directorを追加する

1. チャット内のスライダーボタンで**Chat Settings**(チャット設定)を開き、**Agents**に進みます。
2. **Enable Agents**(エージェントを有効にする)をオンにしてから、**Narrative Director**エージェントを追加します。

これでメッセージ入力欄の上に**Push Story**ボタンが現れ、**Agents**に**Narrative Director**カードが表示されます。**Push Story**を使うか、**Secret Plot**をオンにするまで、このエージェントは何もしません。

## 物語を前に進める

**Push Story**は1回かぎりです。次の返信だけに効き、その後は自動でオフに戻ります。先にNarrative Directorをチャットに追加してください(前述)。

1. メッセージ入力欄の上にある**Push Story**をクリックします。どう後押しするかを尋ねるメニューが開きます。
   - **Naturally**(自然に): 今ある筋を前へ進めます。すでに物語に出ている流れを、AIが展開させます。
   - **Randomly**(ランダムに): 場面に、ありそうな意外性を加えます。
2. どちらかを選びます。「The next time a character responds, they will push the story forward naturally!」(または末尾が「randomly!」)と表示されます。ボタンの表示は**Push Story: Naturally**か**Push Story: Randomly**に変わります。
3. 次のメッセージを送るか、返信を新しく生成します。AIはその1回の返信に、後押しを反映して書きます。
4. 返信が終わると、**Push Story**は自動でオフになります。

モードは毎回このメニューから選びます。デフォルトのモードはなく、**Chat Settings**にモードの設定もありません。

送信する前に取り消すには、待機中のボタンをもう一度クリックします。「Push Story disarmed.」と表示されます。

うまくいかなかった場合: 返信の生成中は、**Push Story**が反応しません。返信が終わるのを待ってから、クリックしてください。

## Secret Plotをオンにする

**Secret Plot**は、隠された長期的な筋書きです。物語がどこへ向かうのか、AIが秘密の計画を持ち続けます。計画はプロンプトに追加されますが、自分で表示しないかぎり見えません。デフォルトはオフです。**Push Story**と違い、多くの返信にまたがって働き、決まった間隔で計画を更新します。

1. **Chat Settings → Agents**(チャット設定 → エージェント)を開き、**Narrative Director**カードを探します。
2. **Secret Plot**トグルをオンにします。ラベルには「Maintain a hidden long-term arc for this roleplay.」と書かれています。
3. 必要に応じて、**Run Interval**(実行間隔)を設定します。筋書きを更新するまでに、メッセージ(自分のものとAIのもの)を何件挟むかを決めます。デフォルトは8です。1から100までの整数を指定できます。数字を小さくすると、計画の更新が頻繁になります。

## 隠された筋書きの表示と編集

**Secret plot**パネルは、**Run Interval**の下にあります。

1. **Reveal spoilers**(ネタバレの表示)をクリックします。AIがまだ筋書きを書いていない場合、このボタンは**Reveal empty arc**と表示されます。隠れているあいだ、パネルには「Spoilers hidden」と表示されます。また隠すには、**Hide spoilers**をクリックします。
2. 編集したい項目を編集します。
   - **Arc description**(筋書きの説明): 隠された物語全体の流れ。
   - **Protagonist arc**(主人公の筋書き): 自分のキャラクターが向かう先。
   - **Character arc**(キャラクターの筋書き): 選んだ1人のキャラクターが向かう先。
   - **Completed**(完了): 筋書きが終わったときにチェックを入れます。
3. 保存ボタンで変更を確定します。

今の筋書きを捨ててAIに新しく書かせるには、**Regenerate**(再生成)をクリックします。「Regenerate Secret Plot」というタイトルのダイアログで、確認を求められます。筋書きを置き換えるなら**Regenerate**を、取りやめるなら**Keep Current Arc**を選びます。

筋書きは、**Narrative Director**エージェントとともに保存されます。チャットのエージェントの結果を消去しても、筋書きは消えません。消えるのはチャットからエージェントを外したときだけで、その前に警告が表示されます。

## Secret Plotのプロンプトを変更する

**Secret Plot Prompt**(Secret Plotのプロンプト)には、Narrative Directorが筋書きを書いたり更新したりするときに従う指示が入っています。組み込みのプロンプトは、それぞれの筋書きを解き明かす謎として扱います。冒険や陰謀の物語には合いますが、キャラクターが動かす物語には合わないことがあります。

1. **Agents**を開き、**Narrative Director**を編集します。
2. **Secret Plot**セクションで、**Copy default to edit**(デフォルトをコピーして編集)をクリックします。
3. 文章を変更し、エージェントを保存します。

組み込みのプロンプトに戻すには、**Reset to default**(デフォルトに戻す)をクリックしてから、エージェントを保存します。

> **Note:** プロンプトの最後の部分は削除しないでください。そこには返信の形式が書かれており、これがないとMarinaraは筋書きを読み取れません。

このプロンプトはエージェントに保存されるため、そのNarrative Directorを使うすべてのチャットに適用されます。

## 関連ガイド

- [ダウンロードできるエージェント一覧](../agents/built-in-agents.md)
- [Roleplayモード: はじめに](getting-started.md)
- [ガイド付き生成とImpersonate](../chats/guided-and-impersonate.md)
