# スラッシュコマンド一覧

スラッシュコマンドとは、メッセージ入力欄に`/`から始まる文字列を入力して、操作をすばやく実行するショートカットです。画面をその場で変えるコマンドもあれば、モデルに文章を書かせるコマンドもあります。

## スラッシュコマンドの使い方

1. チャット下部のメッセージ入力欄にコマンドを入力します。
2. **Send**(送信)をクリックします。そのチャットモードで**Send on Enter**(Enterで送信)がオンなら、<kbd>Enter</kbd>を押しても送信できます。[メッセージの送信とストリーミング](sending-and-streaming.md#send-on-enter)を参照してください。

`/`を入力するとすぐに、一致するコマンドのメニューが入力欄の上に表示されます。各行には、コマンドの書式と短い説明が並びます。行をクリックすると入力欄にコマンドが入るので、必要な文字列を書き足して送信します。入力欄のヒントにもコマンドの案内があります。Roleplayでは**Write your response, / for commands**、Conversationでは「Message @Alice, / for commands」と表示されます。

表では、各コマンドの書式をその行に記載しています。`[name]`や`[range]`など、角括弧で囲まれたラベルは実際の値に置き換えてください。角括弧自体は入力しません。`(optional)`と記された入力は省略できます。`|`は選択肢の区切りです。多くのコマンドには、`/continue`に対する`/cont`のような短い別名があります。アプリ内のすべてのコマンドを見るには、次のように入力します。

```text
/help
```

ブラウザー内で動作し、費用がかからないコマンドもあります。そのほかのコマンドはモデルに文章を書かせるため、アカウントを使い、トークン(サービスが数えて課金する単位)を消費することがあります。

スラッシュコマンドは、ConversationとRoleplayのメッセージ入力欄で使えます。Gameで動作するのは、範囲やプロンプトを付けない`/illustrate`(または`/ill`)だけで、Gameのイラストを画像用のアカウントで設定している場合に限ります。それ以外のスラッシュから始まる入力は、通常のテキストとして送信されます。RoleplayとConversationでは、`/illustrate`、`/selfie`、`/video`の各コマンドにIllustratorエージェントが必要で、インストールしている場合にだけ表示されます。

いくつかのコマンドはメッセージ番号を使います。Marinaraは、チャットの最初のメッセージを1番として数えます。`/goto`、`/hide`、`/unhide`がこの番号を使います。**Show message numbers**(メッセージ番号を表示)をオンにすると、番号が表示されます。[メッセージの操作](messages.md#message-display-toggles)を参照してください。

## チャットとメッセージのコマンド

これらはConversationとRoleplayで使えます。

| コマンド | 動作 |
| --- | --- |
| `/help` | すべてのスラッシュコマンドを一覧表示します。 |
| `/send` | 返信を求めずに、自分のペルソナとしてメッセージを投稿します。**Send**と同じように、マクロが展開されます。書式は`/send [message]`です。 |
| `/continue` | 新しいメッセージを作らずに、直前のAIの返信に続きの文章を足します。別名は`/cont`です。**Settings → General → Responses → Add a new line before /continue text**(設定 → 一般 → 応答 → /continueの文章の前に改行を追加)で、続きを空行のあとから始めるか、途切れた位置から始めるかを決めます。 |
| `/goto` | 指定した番号のメッセージまでチャットをスクロールします。別名は`/jump`、`/scroll`です。書式は`/goto [number]`です。 |
| `/hide` | 以降のターンで、メッセージをモデルから隠します。書式は`/hide [range] [name (optional)]`です。 |
| `/unhide` | 全体に対して隠したメッセージを元に戻します。書式は`/unhide [range]`です。 |
| `/sys` | システムメッセージを追加します。チャットに表示されてモデルの動きを誘導しますが、どのキャラクターの発言にもなりません。別名は`/system`です。書式は`/sys [message]`です。 |
| `/macros` | `{{user}}`や`{{char}}`などのプロンプトマクロを一覧表示します。別名は`/macro`です。 |
| `/remind` | タイマーを設定し、時間になったらチャットにリマインダーを投稿します。別名は`/reminder`、`/timer`です。書式は`/remind [time] [message]`です。 |

例:

```text
/goto 27
/hide 3-8
/remind 30m check the oven
```

`/hide`と`/unhide`には、番号1つ、範囲、またはその組み合わせを指定できます。たとえば`/hide 5`、`/hide 3-8`、`/hide 2-5,9,12`です。隠したメッセージはチャットに残りますが、モデルは読みません。

Roleplayでは、範囲のあとにキャラクター名を付けると、そのキャラクターに対してだけメッセージを隠せます。ほかのキャラクターは引き続き読めます。

```text
/hide 3-8 Maukie
/hide 2-5,9 "Powers That Be"
```

空白を含む名前は引用符で囲んでください。`/hide Maukie 3-8`のように名前を先に書く従来の形式も、引き続き使えます。名前が複数のキャラクターに一致する場合は、名前を省略せずに入力してください。数字だけの名前は、`/hide 1 "123"`のように引用符で囲み、メッセージ番号と区別してください。キャラクターごとの非表示を確認したり元に戻したりするには、Roleplayのグループチャットではメッセージの**Hide from AI**(AIから隠す)のアバター選択を、キャラクターが1人のチャットでは**Unhide from AI**(AIへの表示を戻す)を使います。`/unhide`で戻せるのは、全体に対する非表示だけです。

`/remind`には、`h`(時間)、`m`(分)、`s`(秒)を付けた時間と、メッセージを指定します。リマインダーはブラウザーのセッション内に保持されるため、通知されるまでタブを開いたままにしてください。

## ストーリーとロールプレイのコマンド

| コマンド | 動作 |
| --- | --- |
| `/guided` | 次の返信を誘導します。別名は`/narrator`、`/narrate`、`/nar`です。書式は`/guided [direction]`です。 |
| `/as` | キャラクターとしてメッセージを投稿するか、そのキャラクターに返信させます。別名は`/respond`です。書式は`/as [name] [message (optional)]`です。 |
| `/emote` | スプライトの表情を一覧表示するか、切り替えます。別名は`/emotion`、`/sprite`です。書式は`/emote [expression]`です。 |
| `/roll` | ダイスを振って結果を投稿します。別名は`/r`、`/dice`です。書式は`/roll [dice (optional)]`です。 |
| `/random` | 予想外の出来事を加えるよう、モデルに頼みます。別名は`/rand`、`/event`です。 |
| `/scene` | Conversationから分岐するRoleplayのシーンを始めます。別名は`/rp`です。書式は`/scene [description (optional)]`です。 |
| `/illustrate` | Roleplay専用です。ギャラリーの画像を生成します。Illustratorエージェントが必要です。別名は`/ill`です。書式は`/illustrate [range=N-M] [prompt]`です。 |
| `/html` | Roleplay専用です。最新の返信の末尾に、`a spellbook page`のような作中世界のアーティファクトを1つ作ります。書式は`/html [what you want]`です。 |
| `/video` | Roleplay専用です。最新の返信、または指定した内容の短いクリップを、その返信の下に作ります。Illustratorの**First frame**(開始フレーム)設定に従います。Illustratorが必要です。書式は`/video [description]`です。 |
| `/impersonate` | 自分のペルソナとして返信を書きます。別名は`/imp`です。書式は`/impersonate [direction (optional)]`です。 |
| `/impersonate_prompt` | このチャットで`/impersonate`が使う指示を設定します。別名は`/imp_prompt`です。書式は`/impersonate_prompt [prompt or reset]`です。 |

ほとんどのコマンドは、Roleplayで使うのに向いています。`/scene`はConversationから実行します。`/impersonate`と`/impersonate_prompt`は、Conversationでは使えません。

### 返信を誘導する

```text
/guided make him confess he is lying
/guided respond as "Powers That Be" describe the approaching storm
```

`respond as`の代わりに、`reply as`や`respond for`も使えます。[ガイド付き生成とImpersonate](guided-and-impersonate.md)を参照してください。

### キャラクターとして投稿する

メッセージを省略すると、そのキャラクターの次の返信をモデルが書きます。

```text
/as Dottore "The experiment begins."
/as Dottore
```

### ダイスを振る

`/roll 2d6`は、6面ダイスを2個振ります。`/roll 1d20+5`のように補正値を足せます。何も付けずに`/roll`だけを入力すると、`1d20`を振ります。一部のダイスだけを採用するには、`kh`(高い出目を採用)または`kl`(低い出目を採用)と個数を付けます。`/roll 4d6kh3`は高い3個を合計し、`/roll 2d20kl1`は2個のうち低いほうを採用します。`dl`と`dh`は、代わりに低い出目または高い出目を除外します。たとえば`/roll 4d6dl1`です。計算に含まれないダイスも、薄く表示されます。

### スプライトを切り替える

スプライトとは、表情を表したキャラクターの立ち絵です。`/emote`だけを入力すると使える表情の一覧が表示され、表情の名前を指定するとその表情に切り替わります。

```text
/emote joy
/emote "Powers That Be" joy
```

名前を指定して表情を省略すると、そのキャラクターの表情を一覧表示します。スプライトをアップロード済みのRoleplayチャットが必要です。[キャラクターのスプライト](../characters/sprites.md)を参照してください。

### イラストとアーティファクトを作る

`/illustrate range=12`は、メッセージ12を描きます。`/illustrate range=12-18`は、メッセージ12から18をIllustratorに送ります。`/goto`と同じメッセージ番号を昇順で使い、最大200件まで指定できます。隠したメッセージは除外されます。画像は、範囲内で最後に表示されているメッセージに添付されます。Advanced Memoryがオンでも、以前のメッセージを引き続き使えます。`range=`を付けない場合、コマンドは現在のシーンを対象にします。入力したプロンプトは、書いたとおりに使われます。

`/html a terminal readout`はエージェントが不要で、**HTML Artifacts**(HTMLアーティファクト)がオンでもオフでも動作します。**Roleplay Commands**(Roleplayコマンド)で**HTML Artifacts**がオンの場合は、ナレーターも`[html: prompt="..."]`で同じものを依頼できます。[オンデマンドのアーティファクト](../roleplay/getting-started.md#artifacts-on-demand)を参照してください。

### 自分の返信を書く

`/impersonate ask about the weather`は、自分のペルソナの口調で返信を書きます。ペルソナとは、自分自身を表すキャラクターで、プロンプトでは`{{user}}`と書きます。この2つのコマンドは、Conversationでは使えません。

## Conversationモードのコマンド

これらは、Conversationのチャットでのみ使えます。

| コマンド | 動作 |
| --- | --- |
| `/games` | インストール済みのゲームの選択画面を開きます。`/game`と`/play`も同じ動作です。 |
| `/selfie` | Illustratorエージェントで自撮りを生成します。名前を付けると、キャラクターを選べます。書式は`/selfie [name (optional)]`です。 |
| `/video` | チャットの**Video messages**(動画メッセージ)の設定を使い、キャラクターに短い動画メッセージを送ってもらいます。[動画メッセージ](../conversation/selfies.md#video-messages)を参照してください。書式は`/video [name (optional)]`です。 |
| `/uno` | チャットにいるキャラクターとUNOを始めます。 |
| `/chess` | キャラクターと1対1のチェスを始めます。 |
| `/poker` | キャラクターとテキサスホールデムを始めます。 |
| `/8ball` | キャラクターと1対1のエイトボール(ビリヤード)を始めます。`/pool`でも同じ動作です。 |
| `/status` | キャラクターの在席ステータスを設定または解除します。書式は`/status [online, idle, dnd, offline or clear] [name]`です。 |

ゲームのコマンドは、そのゲームの設定画面を開きます。各コマンドは、そのゲームのエージェントがインストールされている場合にだけ表示されます。1つのチャットで同時に遊べるゲームは1つだけです。[テーブルゲーム](../conversation/table-games.md)を参照してください。

`/status`は、キャラクターの在席状態を上書きします。ステータスは`online`、`idle`、`dnd`(取り込み中)、`offline`のいずれかです。`clear`で上書きを解除します。キャラクターが2人以上いるチャットでは、末尾に名前を付けます。

```text
/status idle
/status online Alice
```
