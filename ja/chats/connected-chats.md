# ConversationをRoleplayやGameにつなぐ

このガイドでは、ConversationのチャットをRoleplayやGameのチャットにリンクし、両者でコンテキストを共有する方法を説明します。あわせて**Cross-Chat Awareness**(チャット間の状況把握)、リンクをまたいで情報を渡す特別なタグ、リンクしたチャット間を移動する方法も取り上げます。

Marinara Engine(以下Marinara)には、チャット同士が互いを把握するための機能が2つあります。1つは自動で働きます。もう1つは手動で作る1対1のリンクです。仕組みがまったく違うため、このガイドでは2つを分けて説明します。

## Connected Chatsの役割

**Connected Chats**(接続チャット)は、1つのConversationチャットと1つのRoleplayまたはGameチャットを結び付けます。リンクは1対1です。1つのチャットが同時にリンクできる相手は1つだけです。

リンクすると、Conversation側はリンク先の物語チャットの最近のメッセージを自動的に読み取ります。毎ターン、それを自分のコンテキストに取り込みます。これがリンクの自動的な方向です。

物語チャット(RoleplayまたはGame)の側は、Conversationのメッセージを自動では読み取りません。逆方向に情報を送るときは、キャラクターが特別なタグを使います。タグについてはこの後で説明します。

よくある使い方はこうです。1つのチャットで没入感のあるRoleplayやGameを進め、別のConversationチャットではキャラクターの外側(OOC)から気軽にダイレクトメッセージをやり取りします。OOC側のチャットは物語の状況を把握し続けるので、進行中の出来事についてそのまま話せます。

## Cross-Chat Awarenessはリンクとは別物

この2つの機能は混同しやすいので、設定を始める前にこの節を読んでください。

**Cross-Chat Awareness**は自動で働きます。Conversationモードの設定です。同じキャラクターが複数のConversationチャットに登場している場合、そのキャラクターは他のチャットでの出来事を覚えていて、話題にできます。手動でリンクする必要はありません。この設定はデフォルトでオンです。

場所は**Chat Settings**(チャット設定)の**Cross-Chat Awareness**セクションです。説明文は「Characters remember and reference conversations from other chats they're in. Pulls recent messages from sibling chats and injects them as context.」です。Marinaraは、同じユーザーではなく同じキャラクターを基準にして、こうした兄弟チャットを結び付けます。

**Connected Chats**のリンクはこれとは違います。意図して自分で作るものです。1つのConversationと1つのRoleplayまたはGameチャットだけを結び付け、物語のコンテキストと、次に説明する特別なタグを運びます。

まとめると、**Cross-Chat Awareness**は1人のキャラクターを、そのキャラクターが登場するConversationチャット同士で自動的につなぎます。**Connected Chats**のリンクは、1つのConversationと1つの物語チャットを手動で結び付けます。

## ConversationとRoleplayやGameのチャットをリンクする

リンクはConversationチャットから、またはGameチャットから作ります。Conversation側から始める手順は次のとおりです。

1. リンクしたいConversationチャットを開きます。
2. **Chat Settings**(チャット設定)を開きます(チャット内の**Chat Settings**ボタンで、移動していなければ右上にあります)。
3. **Connected Chats**セクションを探します。
4. **Link to Roleplay or Game**(RoleplayまたはGameにリンク)をクリックします。
5. 選択画面でRoleplayまたはGameのチャットを検索し、クリックします。

これで**Connected Chats**セクションに、リンクしたチャットの名前とモードが表示されます。その隣には小さなリンク解除ボタンがあります。

Gameチャットから始める場合は、そのチャットの**Chat Settings**を開き、**Connected Chats**を探して**Link to Conversation**(Conversationにリンク)をクリックします。続いてConversationを選びます。

Roleplayチャットには専用のリンクボタンがありません。リンクができていれば表示はしますが、リンクの作成はConversation側から行う必要があります。

選択画面に出てくるのは、まだリンクされていないチャットだけです。1つのチャットが持てるリンクは同時に1つです。

### リンクを解除する

リンクを解除するには、**Chat Settings**を開いて**Connected Chats**を探し、リンク解除ボタン(ツールチップは**Disconnect**)をクリックします。解除すると、そのリンクに紐づいた未反映の影響と保存済みのメモもあわせて消えます。

チャットを削除した場合も、リンクは解除されます。

## リンクをまたいで情報を渡す

Conversationは物語チャットを自動的に読み取ります。それ以外の方向にはタグを使います。タグはキャラクターのメッセージの中に現れ、書くのはAIです。自分で入力することは通常ありませんが、それぞれの働きを知っておくと橋渡しの仕組みを理解しやすくなります。

これらのタグを文中で参照する必要があるときは、そのままの文字列として書いてください。ここでは正確に表示されるよう、いずれもコードとして示します。

- `<influence>`は、Conversationからリンク先の物語チャットへ一度きりの方向付けを送ります。次の1ターンにだけ効き、そこで使い切ります。
- `<note>`は、Conversationからリンク先の物語チャットへ、持続する事実を保存します。消すまでは毎ターン、物語チャットのプロンプトに残ります。
- `<ooc>`は、Roleplayのキャラクターが物語からいったん抜け出し、リンク先のConversationに直接返事をするためのものです。Marinaraはそのテキストを、リンクしたダイレクトメッセージのチャットに投稿します。

つまり、Conversationのキャラクターは`<influence>`と`<note>`で物語をそっと方向付けたり、情報を伝えたりできます。Roleplayのキャラクターは`<ooc>`でConversationに返事ができます。

## Conversation Notes

Conversationのキャラクターが持続する`<note>`を保存すると、それは物語側に現れます。RoleplayまたはGameのチャットの**Chat Settings**に**Conversation Notes**(Conversationのメモ)セクションが追加されます。

このセクションには保存されたメモがすべて並びます。メモごとに削除ボタンがあります。まとめて消すときは**Clear all notes**ボタンを使います。消す前にMarinaraが確認しますが、消したメモは元に戻せません。

まだどのキャラクターもメモを保存していない場合は、`<note>`タグで囲んだ内容が保存されるとここに表示される、という案内が出ます。

<a id="switching-between-connected-chats"></a>

## リンクしたチャット間を移動する

リンク先があるチャットでは、二重矢印アイコンの小さな**Connected chat**(接続したチャット)ボタンが、最初はチャットの右上に表示されます。コンピューターでもスマートフォンでも、別の場所へドラッグできます。クリックまたはタップすると小さなウィンドウが開くので、**Switch to**に相手のチャット名が続くボタンをクリックしてください。

接続されたチャットにそのまま移動します。このボタンは、リンクの両側に表示されます。

**Put back in Chat Settings**(Chat Settingsに戻す)で、この操作をChat Settings内に移せます。独立した**Connected chat**セクションとして表示され、その切り離しボタンで再び別のウィンドウに戻せます。

## このセクションにあるその他の設定

**Connected Chats**セクションには、別の機能に属する設定が2つ置かれています。使いやすさのためにここにまとめて表示しています。

- **Discord webhook URL**の入力欄。見えるラベルはなく、`https://discord.com/api/webhooks/`で始まるプレースホルダーだけがあります。ここにDiscordのwebhook URLを貼り付けると、チャットのメッセージがDiscordのチャンネルにも流れます。これはDiscordのメッセージ転送機能の一部で、専用のガイドがあります。
- **Allow Noodle references**(Noodleからの参照を許可)トグル(デフォルトはオフ)。オンにすると、アプリ内のNoodleのタイムラインがこのチャットの最近のメッセージを取り込めるようになります。Noodleにも専用のガイドがあります。

Roleplay側にはさらに**Allow character DMs**(キャラクターからのDMを許可)トグル(デフォルトはオフ)があります。オンにすると、Roleplayのキャラクターが物語の中から新しいConversationのダイレクトメッセージを開けるようになります。これはConversationがまだリンクされていない状態でも動作します。

## 関連ガイド

- [Conversationモード: はじめに](../conversation/getting-started.md)
- [Roleplayモード: はじめに](../roleplay/getting-started.md)
