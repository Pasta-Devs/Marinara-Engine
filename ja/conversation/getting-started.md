# Conversationモード: はじめに

Conversationモードは、メッセンジャー風のチャットモードです。1人以上のキャラクター、入力バー、スクロールする履歴で構成され、友達とテキストメッセージをやり取りする感覚で使えます。ゲームマスターもシーンのアートもありません。キャラクターから先にメッセージが届いたり、週ごとのスケジュールに従って動いたり、自撮り写真を送ったり、テーブルゲームで遊んだりもできます。これらの機能は、このモードだけにあります。

## Conversationのチャットを始める

始める前に: **Connections**でアカウントを追加し([AIプロバイダーへの接続](../connections/connecting-to-a-provider.md)を参照)、キャラクターを1人以上用意してください。ペルソナ(自分を表すキャラクターカード)は、なくてもかまいません([ペルソナの作成と編集](../characters/personas.md)を参照)。

1. チャットのサイドバーで**CONVO**タブを開き、**New Conversation**をクリックします。4ページのセットアップウィザードが開きます。
2. 最初のページ**Name & Connection**で、チャットに名前を付け、返信を書くアカウントを選びます。
3. 2ページ目の**Prompt Preset**で、Conversationのプロンプト用のプリセットを選びます。デフォルトのままでもかまいません。
4. 3ページ目の**Persona & Characters**で、ペルソナと、1人以上のキャラクターを選びます。
5. 最後のページ**Automation**で、キャラクターが自分でどこまで動くかを選びます(下の表を参照)。
6. **Start Chatting**をクリックします。

キャラクターが1人ならプライベートチャットになります。2人以上ならグループチャットになり、追加のモードは必要ありません。順番の決め方は[グループチャットとグループでの会話](../chats/group-chats.md)を参照してください。

うまくいかなかった場合: **Start Chatting**には、アカウントとキャラクター1人以上が必要です。ウィザードを閉じて、すべて後から**Chat Settings**で設定できます。

## Automationの選択肢

| 選択肢 | デフォルト | 働き |
| --- | --- | --- |
| **Autonomous Messages** | オン | しばらく反応がないと、キャラクターから先にメッセージが届きます。 |
| **Generate Schedules** | オフ | キャラクターごとに、週ごとのルーティンを作ります。**Autonomous Messages**がオンのときだけ表示されます。 |
| **Commands** | オフ | キャラクターが自分で行う操作のマスタースイッチです。 |

**Generate Schedules**をオンにすると、タイムゾーンを入力する欄が表示されます。**Chat Settings**では、同じスイッチが**Schedules**という名前です。スケジュールとチェックインの上限については、[キャラクタースケジュールと自律メッセージ](schedules.md)を参照してください。

これらは後から**Chat Settings → Autonomous Messaging**で変更できます。キャラクターのメッセージが多すぎる場合は、そこで**Autonomous Messages**をオフにするか、自分の在席状況を**Do Not Disturb**に設定してください。

<a id="choose-which-commands-a-character-can-use"></a>

## キャラクターが使えるCommandsの選択

Commandsは、キャラクターが自分で決めて行う操作です。自分で入力する必要はありません。セットアップの後、**Chat Settings → Agents → Commands**を開いてください。マスターの**Commands**スイッチがすべての系統を制御します。オフのときは、どの系統も動きません。

系統ごとに専用のスイッチがあります。**Videos**を除いて、すべて最初からオンです。**Videos**は自分でオンにする必要があります。任意のエージェントに属する系統は、そのエージェントを**Agents → Agent Organizer**からインストールしたときだけ表示されます。

| 系統 | キャラクターができること | 必要なエージェント |
| --- | --- | --- |
| **Schedule Updates** | 自分の現在のステータスを変更する。 | なし |
| **Cross-Post** | 別のチャットにメッセージを送る。 | なし |
| **Memories** | ほかのキャラクターの記憶を作る。 | なし |
| **Scenes** | 没入型のシーンを始める。 | なし |
| **Influence** | つながっているチャットに影響を与える。 | なし |
| **Notes** | つながっているチャットのために、長く残るメモを保存する。 | なし |
| **Reactions** | 絵文字バッジでメッセージにリアクションする。 | なし |
| **Selfies** | 生成した自撮り写真を送ってくる。 | Illustrator |
| **Videos** | 短い動画メッセージを送る。 | Illustrator |
| **Music** | アクティブなMusic Playerで曲を再生する。 | Music DJ |
| **Haptics** | 接続した触覚デバイスを操作する。 | Haptic Feedback |
| **Calls** | 通話をかけてくる。 | Calls |
| **UNO** | UNOを始める、またはUNOの誘いを受ける。 | UNO |
| **Chess** | チェスの勝負を受ける。 | Chess |
| **Poker** | テキサスホールデムの席に着く。 | Poker |
| **8-Ball Pool** | ビリヤードのラックを組む。 | 8-Ball Pool |
| **Tic-Tac-Toe** | 三目並べの勝負を受ける。 | Tic-Tac-Toe |
| **Rock-Paper-Scissors** | 勝負を受ける。 | Rock-Paper-Scissors |

**Influence**と**Notes**については、[ConversationをRoleplayやGameにつなぐ](../chats/connected-chats.md)を参照してください。右端の列は、**Agent Organizer**からインストールするエージェントの名前です。

<a id="your-presence-status"></a>

## 在席ステータス

在席ステータスは、サイドバーのフッターにある色付きのピルです。どのチャットでも同じです。クリックして選びます。

| ステータス | 意味 |
| --- | --- |
| **Active** | オンラインです。 |
| **Idle** | 離席中です。 |
| **Do Not Disturb** | 自律メッセージを止めます。 |
| **Invisible** | モデルからステータスを隠します。 |

**Active**のまま10分間何も操作しないと、Marinaraは**Idle**にし、戻ってくると再び**Active**にします。ステータスを自分で選んだ場合、この自動切り替えは、もう一度**Active**を選ぶまで止まります。**Idle**ではチェックインは止まりません。

ピルの隣にはステータスの入力欄があり、空のときは「What's up?」と表示されます。キャラクターに伝わるように、現在の活動を入力します(120文字まで)。最近の入力は**Recent status**の下に表示されるので、再利用できます。

<a id="react-and-get-notified"></a>

## リアクションと通知

メッセージの**Add reaction**で、絵文字でリアクションします。その後の返信では、キャラクターがそのリアクションを見られます。**Reactions**コマンドがオンのときは、キャラクターがユーザーのメッセージや、お互いのメッセージにリアクションできます。

見ていないチャットにキャラクターがメッセージを書くと、画面の端にアバターのバブルが表示されます。クリックするとそのチャットが開きます。Xをクリックすると閉じます。スマートフォンでは、複数のバブルが、タップできる1つのグループにまとまります。

## 知っておくと役立つこと

Conversationのチャットでは、キャラクターカードの**First Message**、**Dialogue Highlight Color**、**Message Box Color**は使いません。**Name Display Color**は、上の名前の色として引き続き使われます。[色が表示される場所](../characters/colors-and-stats.md#where-your-colors-show)を参照してください。

## 関連機能

- [自撮り写真](selfies.md): キャラクターが、自分の生成した写真を送ってきます。
- [Conversationの音声通話とビデオ通話](calls.md)
- [Conversationモードのテーブルゲーム](table-games.md): `/uno`、`/chess`、`/poker`、`/8ball`、`/tictactoe`、`/rps`でゲームを始めます。
- [キャラクタースケジュールと自律メッセージ](schedules.md)
- [Conversationモードのプロフィール(表示名、About Me、振る舞い)](profiles.md)
- [カスタム絵文字、カスタムスタンプ、GIF](emoji-stickers-gifs.md)
- [ConversationをRoleplayやGameにつなぐ](../chats/connected-chats.md)

## トラブルシューティング

| 症状 | 対処 |
| --- | --- |
| キャラクターのメッセージが多すぎる | **Autonomous Messages**をオフにするか、**Do Not Disturb**に設定するか、[スケジュール](schedules.md)でより多くの時間帯を離席に設定してください。 |
| グループで1人のキャラクターがすべてに答える | [グループチャットとグループでの会話](../chats/group-chats.md)で、発言者の決め方を設定してください。 |
| キャラクターが以前のチャットを忘れる | コンテキストウィンドウ(一度に読めるテキストの量)が大きいモデルを使うか、ロアブックのエントリーに重要な事実を追加してください。 |
| 自撮り写真がキャラクターに似ていない | [自撮り写真](selfies.md)を参照してください。 |

詳しくは、[Marinara Engineのトラブルシューティング](../TROUBLESHOOTING.md)を参照してください。
