# Narrative DirectorとSecret Plot

このガイドでは、Marinara EngineのNarrative Directorエージェントについて説明します。**Push Story**ボタン、**Natural**と**Random Event**の2つのモード、そして隠された筋書きであるSecret Plotを取り上げます。これらの機能はRoleplayモード専用です。

## Narrative Directorとは

エージェントとは、チャットの裏側で動いて決まった仕事をこなすAIの補助役です。Narrative Directorもそのひとつで、次の返信だけに効く指示を1回分書き出し、物語を望む方向へ動かします。エージェント全般の仕組みは[エージェント: チャットを支えるAIヘルパー](../agents/agents-overview.md)を参照してください。

Narrative Directorが動くのはRoleplayモードだけです。自分から勝手に動くことはありません。**Push Story**(物語を進める)ボタンで次の返信1回分だけオンにしたときか、**Secret Plot**(隠された筋書き)機能をオンにしたときにだけ働きます。

使うには、まずチャットにこのエージェントを追加します。**Chat Settings**(チャット設定)を開き、**Agents**セクションで**Narrative Director**エージェントを有効にします。有効になると、メッセージ入力欄の上に**Push Story**ボタンが現れ、**Agents**セクションに**Narrative Director**の設定カードが表示されます。

## Push Story

**Push Story**は1回かぎりのボタンです。効くのは次の返信だけで、そのあとは自動でオフに戻ります。場面が行き詰まったと感じ、話を先へ進めたいときに使います。

手順は次のとおりです。

1. **Narrative Director**エージェントを有効にしたRoleplayチャットを開きます。
2. メッセージ入力欄の上にある**Push Story**ボタンを探します。
3. **Push Story**をクリックします。**Natural**モードなら「The next time a character responds, they will push the story forward naturally!」というメッセージが表示されます。**Random Event**モードでは、末尾が「randomly!」に変わります。
4. 次のメッセージを送るか、返信を新しく生成します。
5. AIはその1回の返信にだけ、物語の後押しを反映して書きます。
6. 返信が終わると、**Push Story**は自動でオフになります。

送信する前に気が変わったときは、もう一度**Push Story**をクリックするとオフにできます。「Push Story disarmed.」というメッセージが表示されます。

返信を生成しているあいだは**Push Story**ボタンを使えません。今の返信が終わるのを待ってから有効にしてください。

## NaturalモードとRandom Eventモード

**Push Story**には2つのモードがあります。モードは**Chat Settings**内の**Narrative Director**カードで選びます。選んだモードによって、後押しの種類が変わります。

2つのモードは次のとおりです。

- **Natural**(自然に進める): 今ある筋をそのまま前へ進めます。すでに物語に出ている流れをAIが展開させます。
- **Random Event**(ランダムな出来事): ありそうな意外性を加えます。場面に合った新しい展開をAIが持ち込みます。

デフォルトは**Natural**です。モードを変えるには、**Chat Settings**を開いて**Agents**へ進み、**Narrative Director**カードを見つけて、使いたいモードをクリックします。

どちらのモードが有効になっているかは、**Push Story**ボタンのツールチップでわかります。**Natural**モードでは「Arm a natural Narrative Director push for the next response.」、**Random Event**モードでは「Arm a random Narrative Director event for the next response.」と表示されます。

## Secret Plot

**Secret Plot**は、ロールプレイの裏で長く続く隠された筋書きです。物語がどこへ向かうのか、AIが秘密の計画を持ち続けます。この計画はプロンプトに追加されますが、自分で表示を選ばないかぎり見えません。デフォルトはオフです。

1回だけ働く**Push Story**とは違い、**Secret Plot**は多くの返信にまたがって動きます。チャットが続くあいだ、決まった間隔で隠された計画を更新します。

### Secret Plotをオンにする

1. **Chat Settings**を開き、**Agents**セクションへ進みます。
2. **Narrative Director**カードを見つけます。
3. **Secret Plot**トグルをオンにします。ラベルには「Maintain a hidden long-term arc for this roleplay.」と書かれています。

### Run Interval

**Secret Plot**をオンにすると、**Run Interval**(実行間隔)欄が現れます。ここでは、隠された筋書きを更新するまでにユーザーとアシスタントのメッセージを何件挟むかを決めます。

デフォルトは8です。1から100までの整数を指定できます。数字を小さくすると計画の更新が頻繁になり、大きくすると更新の間隔が空きます。

### 隠された筋書きの表示と編集

**Run Interval**欄の下にあるのが**Secret plot**パネルです。ここで隠された計画を確認したり、書き換えたりできます。

表示用のボタンをクリックすると筋書きが現れます。筋書きがすでにある場合は**Reveal spoilers**(ネタバレの表示)、AIがまだ書いていない場合は**Reveal empty arc**と表示されます。**Hide spoilers**をクリックすると、また隠せます。隠れているあいだ、パネルには「Spoilers hidden」と表示されます。

筋書きを表示すると、次の項目を編集できます。

- **Arc description**(筋書きの説明): 隠された物語全体の流れ。
- **Protagonist arc**(主人公の筋書き): 自分のキャラクターがこれから向かう先。
- **Character arc**(キャラクターの筋書き): ロールプレイに登場するキャラクターのうち、選んだ1人が向かう先。
- **Completed**(完了): 筋書きが終わったときにチェックを入れるチェックボックス。

項目を編集したら、保存ボタンで変更を確定します。

今の筋書きを捨てて、AIに新しく書き直させたいときは**Regenerate**(再生成)をクリックします。「Regenerate Secret Plot」というウィンドウで確認を求められるので、置き換える場合は**Regenerate**、取りやめる場合は**Keep Current Arc**を選びます。

### 筋書きはエージェント側に残る

隠された筋書きは**Narrative Director**エージェントとともに保存されます。チャットのエージェント実行履歴と記憶を消しても、筋書きは消えません。消えるのは、チャットから**Narrative Director**エージェントを取り外したときだけです。取り外そうとすると、隠された筋書きが消去され、元に戻せないという警告が表示されます。

### Secret Plotのプロンプト

**Secret Plot Prompt**(Secret Plotのプロンプト)には、Narrative Directorが隠された筋書きを書いたり更新したりするときに従う指示が入っています。組み込みのプロンプトは、それぞれの筋書きを解き明かす謎として組み立てます。冒険や陰謀の物語には合いますが、キャラクターが動かす物語には合わないことがあります。

独自の指示を使うには、次の手順に従います。

1. **Agents**を開き、**Narrative Director**を編集します。
2. **Secret Plot**セクションで、**Copy default to edit**(デフォルトをコピーして編集)をクリックします。
3. 文章を変更し、エージェントを保存します。

組み込みのプロンプトに戻すには、**Reset to default**(デフォルトに戻す)をクリックしてから、エージェントを保存します。

プロンプトの末尾にあるJSONの返信形式は残してください。`description`、`protagonistArc`、任意の`characterArc`、`completed`を持つ`overarchingArc`オブジェクトです。これがないと、筋書きを読み取れません。

このプロンプトはエージェントに保存されるため、そのNarrative Directorを使うすべてのチャットに適用されます。

## 関連ガイド

- [ダウンロードできるエージェント一覧](../agents/built-in-agents.md)
- [Roleplayモード: はじめに](getting-started.md)
- [ガイド付き生成とImpersonate](../chats/guided-and-impersonate.md)
