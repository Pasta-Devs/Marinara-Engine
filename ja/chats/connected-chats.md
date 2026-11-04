# ConversationをRoleplayやGameにつなぐ

ConversationのチャットをRoleplayやGameのチャットにリンクして、両者でコンテキストを共有します。よくある使い方は、1つのチャットで物語を進め、その物語を把握し続けるConversationで、キャラクターの外側(OOC)から物語について話すというものです。

**Chat Settings**(チャット設定)の**Connected Chats**(接続チャット)セクションには、2つの別々の機能があります。**Connected Chats**のリンクは1対1で、手動で設定します。**Cross-Chat Awareness**(チャット間の状況把握)は単独で働くトグルで、キャラクターが自分の他のConversationチャットを覚えていられるようにします。

## リンクの仕組み

リンクは、1つのConversationと1つのRoleplayまたはGameチャットを結び付けます。1つのチャットが同時に持てるリンクは1つだけです。

- Conversationは、リンク先の物語チャットの最近のメッセージを、毎ターン自動的に読み取ります。
- 物語チャットは、Conversationを読み返しません。逆方向には、キャラクターがタグを使って情報を渡します。タグについてはこの後で説明します。

## ConversationとRoleplayやGameのチャットをリンクする

始める前に: 両方のチャットを用意しておいてください。[チャット一覧の管理](managing-chats.md)を参照してください。

1. Conversationのチャットを開き、**Chat Settings**(チャット設定)を開きます。[Chat Settingsの概要](chat-settings.md)を参照してください。
2. **Connected Chats**(接続チャット)セクションを開きます。
3. **Link to Roleplay or Game**(RoleplayまたはGameにリンク)をクリックします。
4. 選択画面でチャットを検索し、クリックします。

セクションに、リンクしたチャットの名前とモードが、小さなリンク解除ボタンとともに表示されます。

うまくいかなかった場合: 選択画面に出てくるのは、まだリンクされていないチャットだけです。先にもう一方のチャットのリンクを解除してください。

Gameのチャットから始める場合は、そのチャットの**Chat Settings → Connected Chats**を開いて**Link to Conversation**(Conversationにリンク)をクリックし、Conversationを選びます。Roleplayのチャットにはリンクボタンがありません。リンクができていれば表示はされるので、リンクはConversation側から作ってください。

### リンクを解除する

**Chat Settings → Connected Chats**(チャット設定 → 接続チャット)を開き、リンク解除ボタン(ラベルは**Disconnect**)をクリックします。そのリンクに紐づいた未反映の影響と保存済みのメモも、あわせて消えます。チャットを削除した場合も、リンクは解除されます。

## Cross-Chat Awareness

**Cross-Chat Awareness**(チャット間の状況把握)は、Conversationの**Connected Chats**(接続チャット)セクションにあるトグルです。説明文は「Characters know what happens in their other chats」です。同じキャラクターが複数のConversationチャットに登場している場合、そのキャラクターは他のチャットでの出来事を覚えていて、話題にできます。Marinaraは、同じユーザーではなく同じキャラクターを基準にして、こうしたチャットを結び付けます。デフォルトでオンで、リンクは必要ありません。

## リンクをまたいで情報を渡す

キャラクターは、メッセージの中にこれらのタグを書きます。自分で何かをする必要はありません。2つのチャットは、この方法でやり取りします。

| タグ | 働き |
| --- | --- |
| `<influence>` | Conversationからリンク先の物語チャットへ送る、一度きりの方向付けです。リンク先の次の1ターンに効き、そこで使い切られます。 |
| `<note>` | Conversationから物語チャットへ、持続する事実を保存します。消すまでは毎ターン、物語チャットのプロンプトに残ります。 |
| `<ooc>` | Roleplayのキャラクターが物語からいったん抜け出し、リンク先のConversationに返事できるようにします。Marinaraはそのテキストをそこに投稿します。 |

### Conversation Notes

保存された`<note>`の事実は、物語チャットの**Chat Settings**(チャット設定)にある**Conversation Notes**(Conversationのメモ)セクションに表示されます。メモごとに削除ボタンがあります。**Clear all notes**は、確認したうえですべてのメモを削除します。この操作は元に戻せません。メモがないときは、`<note>`タグで囲んだメモがここに表示される、という案内が出ます。

<a id="switching-between-connected-chats"></a>

## リンクしたチャット間を移動する

リンクがあると、両方のチャットに**Connected chat**(接続したチャット)ボタン(二重矢印のアイコン)が表示されます。コンピューターでは最初は右上にあり、ドラッグして動かせます。スマートフォンでは、3点アイコンの**Chat tools**(チャットツール)メニューを開いて**Connected chat**を開き、**Switch to**と相手のチャット名を選びます。

この操作をChat Settingsの中に置いておくには、**Put back in Chat Settings**(Chat Settingsに戻す)を選びます。すると、独立した**Connected chat**セクションとして表示されます。そのセクションの切り離しボタンで、再び別のウィンドウにできます。

## このセクションにあるその他の設定

- **Discord webhook URL**: ラベルのない入力欄で、`https://discord.com/api/webhooks/`で始まるプレースホルダーだけがあります。webhook URLを貼り付けると、チャットのメッセージがDiscordのチャンネルにも流れます。専用のガイドがあります。
- **Allow Noodle references**(Noodleからの参照を許可): Noodleのタイムラインが、このチャットの最近のメッセージを取り込めるようにします。デフォルトはオフで、Noodleがインストールされているときだけ表示されます。
- **Allow character DMs**(キャラクターからのDMを許可、Roleplay): Roleplayのキャラクターが物語の中から、新しいConversationのダイレクトメッセージを開いて話しかけてこられるようにします。デフォルトはオフで、リンクがなくても動作します。
