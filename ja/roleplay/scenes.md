# シーン: Roleplayを枝分かれさせる

シーンとは、Conversationのチャットから枝分かれする短いロールプレイです。本筋を見失わずに、回想、デート、戦闘を描くときに使います。

シーンは1つ1つが独立したRoleplayのチャットで、専用の背景、キャラクター、最初のメッセージを持ちます。シーンが開いている間、元のConversationのチャットには、**A scene is in progress**と書かれたカードが**Go to Scene**ボタンとともに表示されます。

シーンの実行中、そのキャラクターはConversationのチャットでは返信せず、進行中のシーンにいることを示す通知が表示されます。それでもそこで返信させたい場合は、カードの**Allow replies here**(ここでの返信を許可)をオンにします。最初はオフです。オンにすると、シーンのキャラクターはこちらからメッセージを送れば返信しますが、それでも自分からメッセージを送ることはありません。

## シーンの開始

始める前に: すでにメッセージがいくつかあるConversationのチャットを開いてください。[Conversationモード: はじめに](../conversation/getting-started.md)を参照してください。

1. メッセージ入力欄に、`/scene`と短い説明を入力します。`/rp`でも同じです。例: `/scene we sneak into the old library at midnight`
2. <kbd>Enter</kbd>を押します。**Scene Prompt Setup**(シーンプロンプトの設定)が開きます。
3. **Scene persona**(シーンのペルソナ)が表示された場合は、自分を演じるペルソナを選びます。**Use the Conversation persona**(Conversationのペルソナを使う)を選ぶと、Conversationのペルソナのままになります。
4. **Scene characters**(シーンのキャラクター)が表示された場合、Marinaraに選ばせるなら、**Let the scene planner choose characters**(シーンのプランナーにキャラクターを選ばせる)をオンのままにします。または、オフにしてキャラクターを1人以上選びます。
5. **Prompt preset**(プロンプトプリセット)を選びます。デフォルトのRoleplayの[設定プロファイル](../chats/settings-profiles.md#choosing-the-default-profile)のプリセットを使う場合は、**None**(なし)のままにします。この選択は、次のシーンのためにMarinaraが記憶します。
6. **POV**(視点)で、**First Person**、**Second Person**、**Third Person**のいずれかを選びます。
7. **Tense**(時制)で、**Past**、**Present**、**Future**のいずれかを選びます。
8. 任意: **Extra instructions**(追加の指示)に補足を書いて、シーンの方向性を指定します。
9. **Plan Scene**(シーンを計画)をクリックします。

シーンは新しいRoleplayのチャットとしてチャット一覧に加わり、状況を提示する最初のメッセージとともに開きます。シーンを作らずにやめるには、設定ウィンドウで**Cancel**をクリックします。

Conversationに十分な履歴があれば、`/scene`だけでも使えます。Conversationにまだメッセージがない場合は、説明を書き足すか、先にチャットを進めるようMarinaraが求めます。

キャラクターのほうからシーンを始めようと提案することもあります。その返信の横に**Set up scene**(シーン設定)の招待が表示されます。クリックすると**Scene Prompt Setup**が開くので、手順3から続けてください。**Cancel**を押すと設定が閉じますが、招待は再読み込みした後も残り、引き続き使えます。

シーンの始まり方は次のとおりです。

- ほかの新しいRoleplayチャットと同じく、デフォルトのRoleplay設定プロファイルを基に始まります。[設定プロファイル](../chats/settings-profiles.md)とは、保存したチャット設定のセットです。
- シーンの計画にそれらがある場合、まずシーンの演じ方についての短いメモがナレーターのメッセージとして投稿され、次にシーンの説明が2つ目のナレーターのメッセージとして投稿されます。計画にどちらかがない場合、その投稿は省かれます。
- キャラクターが1人の場合、冒頭はそのキャラクターの語り口で書かれ、声に出した言葉は二重引用符で囲まれます。ただし、文章の指示で別のスタイルを指定した場合は、それに従います。
- グループシーンの冒頭は、プロファイルのグループモードに従います。デフォルトは**Merged (Narrator)**で、1つの返信が全キャラクターの分を語ります。**Individual**(個別)モードでは、シーンを始めるキャラクターが冒頭を書きます。[グループチャット](../chats/group-chats.md#choose-who-speaks)を参照してください。

## シーンバーを使う

シーンの中では、メッセージ入力欄の上にあるバーで、シーンをどう扱うかを決めます。表示されるボタンは、シーンに元のConversationがあるかどうかで変わります。

| ボタン | 働き |
| --- | --- |
| **Back to conversation** | シーンを始めたConversationのチャットに戻ります。シーンは開いたまま残ります。元のConversationがある場合だけ表示されます。 |
| **End Scene** | 要約を保存して、シーンを終えます。**End and save summary?**で**Yes**をクリックします。 |
| **Discard** | シーンを削除し、何も保存しません。**Discard scene?**で**Yes**をクリックします。 |
| **Convert** | シーンを独立したRoleplayに変えます。後述します。 |

**End Scene**は**Saving...**と表示し、短い要約を記憶としてConversationに書き込んでから、そこへ戻ります。**Discard**は何も残しません。どちらも、Conversationからシーンを取り除きます。

## メッセージからシーンを複製する

元のシーンを開いたまま、あるメッセージまでのシーンをコピーして別に続けるには、次の手順に従います。

1. 分岐させたいメッセージにカーソルを合わせます。
2. そのメッセージの**Clone from here**(ここから複製)の操作をクリックします。

Marinaraは、そのメッセージまで(そのメッセージを含む)のメッセージで新しい独立したRoleplayを作り、確認の表示を出してから開きます。

## シーンをRoleplayに変換する

シーンが育って、通常のRoleplayとして残したい物語になったときは**Convert**を使います。

1. シーンバーの**Convert**(変換)をクリックします。
2. **Convert this scene into a standalone roleplay?**を読みます。この操作は、シーンから新しいRoleplayのチャットを作り、元のシーンをConversationから切り離します。シーンの要約もキャラクターの記憶も、書き戻されません。
3. **Convert**をクリックします。何も変えない場合は、**Cancel**をクリックします。

複製では、元のシーンが開いたまま残ります。変換では残りません。

## シーンとつないだチャット

シーンは、それだけで完結しています。親のチャットが取り込んでいても、シーンはつないだConversationからコンテキストを取り込みません。また、つないだConversationがリンク先のRoleplayに送れる、物語を導く短いメモも無視します。ConversationとRoleplayの間で双方向のつながりを保ち続けたいときは、つないだチャットを使ってください。[ConversationをRoleplayやGameにつなぐ](../chats/connected-chats.md)を参照してください。

## 関連ガイド

- [Roleplayモード: はじめに](getting-started.md)
- [チャットの分岐](../chats/branches.md)
- [ConversationをRoleplayやGameにつなぐ](../chats/connected-chats.md)
