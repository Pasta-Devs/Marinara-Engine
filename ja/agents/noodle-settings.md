# Noodleの設定とチャットへの引き継ぎ

**Noodle settings**(Noodleの設定)パネルでは、タイムラインに誰が参加するか、どれだけ投稿するか、Noodleがチャットとどうコンテキストを共有するかを決めます。コンテキストを逆の方向に共有する機能が2つあります。**Carryover to chats**(チャットへの引き継ぎ)と、チャットごとの**Allow Noodle references**(Noodleでの参照を許可)トグルです。

Noodleを初めて使う場合は、先に[Noodle: アプリ内のソーシャルタイムライン](noodle.md)を読んでください。ペルソナとは、チャットで自分が演じるキャラクターです。AIのアカウントについては[AIプロバイダーへの接続](../connections/connecting-to-a-provider.md)を参照してください。

## 設定を開く

1. **Home**(ホーム)からNoodleを開きます。
2. 左のサイドバーで、歯車のアイコンの**Settings**(設定)をクリックします。見出しに**Noodle settings**と表示されます。
3. 見出しの下のボタンでページを選びます。

| ページ | セクション |
| --- | --- |
| **General**(一般) | [Refresh](#refresh)、[Translation](#translation) |
| **Timeline**(タイムライン) | [Activity](#activity)、[Image Generation](#image-generation) |
| **Participants**(参加者) | [Invites](#invites)、[Random users](#random-users)(**Ambient Profiles**)、[Active Accounts](#active-accounts) |
| **Advanced**(詳細設定) | **Noodle Prompt**、[Image Understanding](#image-understanding)、[Timeline Writing](#timeline-writing)、[World / Lore](#world--lore)、[Carryover](#carryover)、[Reset Noodle](#reset-noodle) |

Noodleの設定はすべてグローバルで、すべてのペルソナとチャットに適用されます。変更はその場で保存されます。デフォルト値の一覧は[設定とデフォルト値](#settings-and-defaults)にあります。

<a id="refresh"></a>

## Refresh(更新)

更新とは、招待したアカウントのために、AIが投稿、返信、リポスト、いいねをまとめて書く処理です。このセクションでは、Noodleが文章を書くときに使うモデルと、Noodleが自動で更新する頻度を設定します。

- **Generation model**(生成用のモデル): Noodleが投稿、返信、リポスト、いいね、プロフィールの文章を書くときに使うモデルです。最初は未設定で、**Choose connection**というプレースホルダーが表示されます。更新を実行する前に、必ず1つ選んでください。画像を見られるモデルには、投稿とコメントから、関連する最近の画像も最大8枚まで渡します。画像を受け付けないテキスト専用のモデルには、画像なしで再試行します。
- **Refreshes/day**(1日あたりの更新回数): 0から24、デフォルトは**2**です。1日に実行する自動更新の回数です。0にすると自動更新がオフになります。手動の更新は制限しません。

### Automatic schedule(自動スケジュール)

**Refreshes/day**が0より大きいとき、Marinaraは1日を均等な時間帯に分け、それぞれの中からランダムな時刻を1つ選びます。予定された時刻は、タイムゾーンとともに**Automatic schedule**の下に表示されます。これからの時刻の横にある鉛筆をクリックすると、別の時間に移せます。過去の時刻、実行済みの時刻、重複する時刻は選べません。

自動更新はサーバーの中で動くので、Noodleのページは閉じていてもかまいませんが、Marinaraは起動している必要があります。更新に失敗した場合は、スケジュールにエラーが表示され、後で再試行します。失敗が続くと、待ち時間が長くなります。予定された時刻をいくつも逃した場合は、1回の埋め合わせの更新が成功すれば、それでまとめてカバーされます。

<a id="translation"></a>

## Translation(翻訳)

**Translate posts automatically**(投稿を自動翻訳)をオンにすると、自分のペルソナ以外が書いたすべての投稿とコメントの下に翻訳が表示されます。1件ずつ**Translate**(翻訳)をクリックする必要はありません。デフォルトは**off**で、Noodle 1.5.0以降が必要です。Noodleは、チャットの**Translation**(翻訳)設定にある**Save translator defaults**(翻訳のデフォルト設定を保存)で保存したデフォルト設定を使います。保存したデフォルト設定がない場合は、Google Translateで英語に翻訳します。[メッセージの翻訳](../integrations/message-translation.md)を参照してください。すでに翻訳先の言語で書かれている文章には翻訳を追加せず、自分で隠した翻訳は隠したままになり、スイッチをオフにすると、まだ待機中の翻訳は止まります。

翻訳は、自動で作ったものも**Translate**で作ったものも、このブラウザーに保存されます。更新した後も、Noodleを離れて戻った後も、再読み込みした後も、翻訳はまた表示されます。別のデバイスや、データを消去したブラウザーでは、あらためて翻訳します。**Reset Noodle Timeline**(Noodleのタイムラインをリセット)を実行したときも、翻訳は消えます。

<a id="invites"></a>

## Invites(招待)

**Invites**では、更新に参加できるキャラクターを選びます。

- **Professor Mari participates**(Professor Mariを参加させる): デフォルトは**on**です。オフにすると、アカウント検索からProfessor Mariを隠し、新しい投稿、返信、リアクション、メンション、プロフィール生成、チャットへの引き継ぎから除外します。これまでの履歴は残り、もう一度オンにするとアカウントも戻ります。
- **Characters to Invite**(招待するキャラクター): フォルダー一覧とキャラクター一覧の両方を絞り込む検索ボックスです。
- **Add from Folder**(フォルダーから追加): キャラクターフォルダーの一覧を開きます。1つ以上にチェックを入れ、下部の招待ボタンをクリックします。ボタンのラベルは、何もチェックしていないときは**Select folders to invite**、すでに全員が招待済みのときは**Selected folder characters are invited**、新しいキャラクターがいるときは**Invite N characters**と表示されます。
- **Characters**(キャラクター): ライブラリーにあるすべてのキャラクターです。各行には、招待ボタンか削除ボタンと、**Invited**、**Included by folder**、**Not invited**のいずれかの状態が表示されます。

フォルダーからの招待は、その場かぎりの一括操作で、自動では同期しません。後からそのフォルダーに追加したキャラクターは、自動では招待されません。

<a id="random-users"></a>

## Random users(ランダムユーザー)

ランダムユーザーとは、ライブラリーには含まれない、6つの組み込みの背景アカウントです。Thread Countess、Packet Soup、Orbit Notice、Glass Bulletin、Moth Hour、Brine Indexの6つで、それぞれに短い自己紹介があります。

オンにするには、**Invites**(招待)の**Characters**(キャラクター)一覧の先頭にある**Random users**の行を使います。デフォルトは**off**で、オフのときは**Ambient fake profiles**、オンのときは**Enabled**と表示されます。オンにすると、これらのアカウントは更新のあいだに投稿、いいね、リポスト、返信、フォローができます。これらをフォローすることはできません。

**Participants**(参加者)ページの**Ambient Profiles**(背景のプロフィール)では、これらのアカウントを編集したり、別の組み合わせを生成したりできます。生成し直しても投稿と関係は残りますが、プロフィール画像は削除されます。

<a id="active-accounts"></a>

## Active Accounts(アクティブなアカウント)

**Active Accounts**では、1回の更新に参加する対象アカウントの数を決めます。対象になるのは、招待したキャラクター、フォルダー経由で含まれるキャラクター、オンにしている場合はランダムユーザーです。これに加えて、アクティブなペルソナは常に対象になり、Professor Mariも参加しているあいだは対象になります。

- **Active selection**(アクティブの選び方): デフォルトは**Random range**です。**Random range**、**Exact count**、**All invited**から選びます。
- **Random range**では、**Min active**(1から100、デフォルトは2)と**Max active**(1から100、デフォルトは5)が表示されます。更新のたびに、その範囲から数を選びます。
- **Exact count**では、**Active count**(1から100)が表示されます。
- **All invited**: 対象のアカウントがすべて参加し、上限はありません。

Noodleは、初回のプロフィールを用意する前にアクティブなアカウントを選びます。プロフィール生成の要求が送られるのは、生成済みのプロフィールがないアクティブなキャラクターだけです。タイムラインを書く要求にも、その更新で選ばれたアカウントのキャラクターカードだけが渡されます。

<a id="activity"></a>

## Activity(アクティビティー)

各欄は、1回の更新で作れる量の上限です。欄を0にすると、その種類のアクティビティーは作られなくなります。

| 欄 | デフォルト | 範囲 |
| --- | --- | --- |
| **Posts** | 8 | 0から100 |
| **Replies** | 12 | 0から200 |
| **Reposts** | 4 | 0から100 |
| **Likes** | 18 | 0から500 |

<a id="image-generation"></a>

## Image Generation(画像生成)

このセクションを使うと、Noodleが一部の投稿にAIの作った画像を添付できます。画像モデルが必要です。[対応しているAIプロバイダー](../connections/providers-reference.md)と[画像生成プロバイダーと設定](../media/image-providers.md)を参照してください。

- **Image generation**(画像生成): デフォルトは**off**です。オンにすると、AIが投稿用の画像を作り、さらに設定が表示されます。
- **Image width**(画像の幅)と**Image height**(画像の高さ): 64から4096ピクセル、デフォルトは**1024**×**1536**です。
- **Image generation connection**(画像生成用の接続): デフォルトは**Default image generation connection**で、**Connections**(接続)で画像のデフォルトに指定したモデルを使います。キャラクターごとに独自のものを使わせることもできます([プロフィールとフォロー](noodle.md#profiles-and-following)を参照)。
- **Image instructions (sent to your LLM)**(画像の指示。LLMに送信): 組み込みの文章が入っていて、4000文字までです。タイムラインのモデルは、各投稿の画像の説明を書くときにこれに従います。そのため、画像のタグではなく指示を書いてください。画像モデルに直接送るスタイルのタグには、スタイルプロファイルを使います。
- **Use avatar references**(アバターを参照に使う): デフォルトは**on**です。キャラクターのアバターや参照用の画像を画像モデルに送ります。
- **Interpret image prompts**(画像プロンプトを解釈する): デフォルトは**on**です。テキストモデルが、画像モデルの**Image prompting instructions**(画像プロンプトの作成指示)とスタイルプロファイルのStyle textに従って、画像プロンプトを1つずつ書き直します。オフにすると、その指示は使われず、Style textは書かれたとおりに追加されます。
- **Include descriptions**(説明を含める): デフォルトは**on**です。キャラクターの外見について書かれた内容を画像プロンプトに追加します。**Interpret image prompts**がオンのときは、テキストモデルがその内容をそのまま貼り付けずに、プロンプトへ組み込みます。
- **Images/refresh**(更新1回あたりの画像数): 0から50、デフォルトは**3**です。手動と自動のどちらの更新でも、1回ごとに生成する投稿画像の枚数を制限します。

**Attach gallery images**(ギャラリーの画像を添付)は独立したトグルで、デフォルトは**off**です。画像生成がオフのときも表示されます。新しい画像を作る代わりに、そのキャラクターのギャラリーや、そのキャラクターが登場するチャットにある画像を、投稿で使い回せます。

うまくいかなかった場合: 画像生成がオンでも使える画像モデルがないと、「Choose an image generation connection for Noodle first.」と表示されて更新が止まります。画像の生成に失敗すると1回だけ再試行します。もう一度失敗した場合は、更新はそのまま続き、テキストだけのきれいな投稿を公開します。

これらの画像プロンプトのテンプレートは**Noodle Post Image**です。**Settings → Generations → Image Generation Prompt Overrides**(設定 → 生成 → 画像生成のPrompt Overrides)で編集します。画像の指示はこのテンプレートに入り、その結果がスタイルプロファイルを通ります。[画像と動画のPrompt Overrides](../prompts/prompt-overrides.md)と[画像スタイルプロファイル](../media/style-profiles.md)を参照してください。Professor Mariにはキャラクターカードがないため、画像の投稿には組み込みのアバターと参照用のイラストを使います。

<a id="image-understanding"></a>

## Image Understanding(画像の理解)

このセクションでは、タイムラインにすでにある画像を、タイムラインの書き手がどう見るかを決めます。

- **Show images to the writer**(書き手に画像を見せる): デフォルトは**on**です。書き手のモデルが画像を受け付ける場合、タイムラインの最近の画像を最大8枚渡します。オフにすると、画像は渡しません。
- **Image captioning**(画像の説明文生成): 画像を扱えるモデルがタイムラインの画像を説明するので、テキスト専用の書き手でも画像の内容を追えます。変更するまでは、**Generation model**(生成用のモデル)の説明文の設定に従います。**Use connection default**(接続のデフォルトを使う)を選ぶと、その設定に戻ります。
- **Captioning model**(説明文生成用のモデル): 説明文の生成がオンのときに表示されます。**Use Noodle generation connection**(Noodleの生成用の接続を使う)を選ぶと、**Generation model**を使います。そのモデルが画像を見られない場合は、別のモデルを選んでください。

**Show images to the writer**がオフでも、説明文の生成では、タイムラインの画像が説明文用のモデルに送られます。

<a id="timeline-writing"></a>

## Timeline Writing(タイムラインの執筆)

このセクションでは、更新で文章を書くときの語り口と記憶を調整します。

- **Enhanced tone & continuity**(語り口と連続性の強化): デフォルトは**off**です。オンにすると、各アカウントの語り口は、デフォルトの明るい調子ではなく、そのアカウント自身のPersonality、Description、Backstoryに、より強く根ざしたものになります。同じ更新の中で、アカウント同士が互いの投稿に反応したり、引用したり、言い争ったりするよう促されます。古い投稿を思い出す頻度が上がり、アクティブなアカウントに関係する投稿が優先されます。想起の指示も、過去の投稿への言及を控えさせるのではなく、認めるものになります。オフのあいだは、Noodle本来の語り口と想起の挙動がそのまま保たれます。
- **Use generated character schedules**(生成したキャラクタースケジュールを使う): デフォルトは**off**です。オンにすると、参加する各キャラクターについて、その日に生成済みのConversationのスケジュールがあれば、Noodleがそれを含めます。Noodle自身がスケジュールを作ったり更新したりすることはありません。現在のローカルの日付と時刻は、どちらの場合も毎回の更新に含まれます。

### 書き手の語り口をカスタマイズする

書き手の組み込みの語り口と創作の自由度に関する指示は、**Settings → Generations → Image Generation Prompt Overrides → Noodle Timeline Voice & Tone**(設定 → 生成 → 画像生成のPrompt Overrides → Noodle Timeline Voice & Tone)で書き換えられます。セクション名には「Image」とありますが、この一覧には、カスタマイズできるNoodleとConversationのテキストプロンプトがすべて入っています。そこに表示されるデフォルトの文章は、自分の文章を保存するまでは**Enhanced tone & continuity**に従い、保存した後はその設定に関係なく自分の文章が使われます。

この上書きが対象にするのは語り口だけです。どの構造化された操作が許されるかなど、更新を正しく保つためのルールは常に有効です。

<a id="world--lore"></a>

## World / Lore(世界とロア)

**Lorebook context**(ロアブックのコンテキスト)を使うと、更新でロアブックのエントリーを使えます。デフォルトは**off**です。オンにすると、更新のたびに、Noodleの最近の投稿と返信の文面、それにアクティブなキャラクターのプロフィールを、ロアブックのキーワードと照合します。一致したエントリーは、その更新に参加するアカウント向けの世界のコンテキストとして入ります。発動できるのは、アクティブなキャラクターに紐づいたロアブックか、グローバルに指定したロアブックだけです。発動した内容には、更新1回あたり8,192トークンという固定のトークン予算があります。

<a id="carryover"></a>

## Carryover(引き継ぎ)

**Carryover**は、Noodleの最近のアクティビティーをチャットへ送ります。オンにすると、チャットのプロンプトに「Recent Social Media Activity」というブロックが加わり、キャラクターがNoodleで何をしたかを伝えます。

- **Carryover to chats**(チャットへの引き継ぎ): **Conversations**、**Roleplays**、**Games**の3つのトグルで、すべてデフォルトは**off**です。Noodleのアクティビティーを受け取るモードをオンにします。
- **Carry hours**(引き継ぐ時間): 1から720、デフォルトは**48**です。Noodleが何時間前までさかのぼるかを決めます。
- **Carry items**(引き継ぐ件数): 1から50、デフォルトは**8**です。1回のチャットのターンに追加する要約の上限です。

引き継ぐのは、Noodleに招待したキャラクターと、そのチャットのアクティブなペルソナのアクティビティーだけです。フォルダー経由で含まれているだけでは足りません。引き継ぎブロック全体には、チャットの生成1回あたり8,192トークンという固定のトークン予算があります。件数の上限どおりだとこれを超える場合、Marinaraは収まる範囲でいちばん新しい要約を残し、時系列の順に表示します。

<a id="reset-noodle"></a>

## Reset Noodle(Noodleのリセット)

ここでは、アカウントと設定を残したままタイムラインを消去します。

1. **Reset Noodle Timeline**(Noodleのタイムラインをリセット)をクリックします。
2. ダイアログの「This removes all posts, replies, likes, reposts, activity digests, and refresh records. Profiles, follows, invites, and settings stay.」という説明を読みます。
3. **Reset timeline**(タイムラインをリセット)をクリックして確定します。

削除されるのはタイムラインの内容だけです。アカウント、ハンドル、自己紹介、フォロー、招待、すべての設定はそのまま残ります。

## Noodleとチャットをつなぐ

Noodleとチャットは、2つの方向でコンテキストを共有できます。片方をオンにしても、もう片方はオンになりません。

- **Carryover to chats**(チャットへの引き継ぎ)はNoodleの設定にあり、Noodleのアクティビティーをチャットへ送ります。[Carryover](#carryover)を参照してください。
- **Allow Noodle references**(Noodleでの参照を許可)は、チャットのアクティビティーをNoodleへ送る、チャットごとのトグルです。チャット自身の設定の、**Connected Chats**(接続チャット)の近くにあります。[Chat Settingsの概要](../chats/chat-settings.md)を参照してください。デフォルトは**off**です。説明には「Timeline refreshes may include recent messages from this chat, with the chat name, mode, and participants stated in the prompt.」と書かれています。そのチャットで[Conversationのキャラクタースケジュール](../conversation/schedules.md)も動いている場合は、その物語でのキャラクターの現在の状態と行動(たとえば「currently dnd (At the office)」)も含まれ、そのチャットの中だけに適用されます。

どちらか一方だけでも、両方を一緒に使ってもかまいません。

## トラブルシューティング

- **更新しても何も作られない**: **Generation model**を選び、キャラクターを1人以上招待し(またはランダムユーザーをオンにし)、**Refresh**セクションに表示されるエラーを読んでください。
- **自動更新が実行されない**: **Refreshes/day**を0より大きくし、Marinaraを起動したままにして、**Automatic schedule**の下にある予定の時刻とタイムゾーンを確認してください。エラーが表示されている場合は、アカウントかレート制限の問題を直し、再試行を待ってください。
- **投稿が最近のチャットに触れない**: そのチャットで**Allow Noodle references**をオンにし、キャラクターが招待されていることを確認してください。チャットのコンテキストはAIへの手がかりであって、保証ではありません。
- **Noodleのアクティビティーがチャットに出ない**: 対応する**Carryover to chats**のモードをオンにし、アクティビティーが古すぎる場合は**Carry hours**を大きくしてください。
- **投稿に画像が付かない**: **Image generation**をオンにし、動作する画像モデルを選び、**Images/refresh**を確認してください。

<a id="settings-and-defaults"></a>

## 設定とデフォルト値

| 設定 | デフォルト | 範囲や選択肢 |
| --- | --- | --- |
| **Generation model** | なし | 任意のテキストモデル(更新に必須) |
| **Professor Mari participates** | on | onまたはoff |
| **Refreshes/day** | 2 | 0から24(0で自動更新をオフ) |
| **Translate posts automatically** | off | onまたはoff |
| **Active selection** | Random range | Random range、Exact count、All invited |
| **Min active** | 2 | 1から100(Random rangeのときのみ) |
| **Max active** | 5 | 1から100(Random rangeのときのみ) |
| **Active count** | Max activeと同じ | 1から100(Exact countのときのみ) |
| **Posts** | 8 | 0から100 |
| **Replies** | 12 | 0から200 |
| **Reposts** | 4 | 0から100 |
| **Likes** | 18 | 0から500 |
| **Image generation** | off | onまたはoff |
| **Image width** | 1024 | 64から4096 |
| **Image height** | 1536 | 64から4096 |
| **Image generation connection** | Default | 任意の画像モデル |
| **Image instructions (sent to your LLM)** | 組み込みの文章 | 4000文字まで |
| **Use avatar references** | on | onまたはoff |
| **Interpret image prompts** | on | onまたはoff |
| **Include descriptions** | on | onまたはoff |
| **Images/refresh** | 3 | 0から50 |
| **Attach gallery images** | off | onまたはoff |
| **Show images to the writer** | on | onまたはoff |
| **Image captioning** | Generation modelに従う | onまたはoff |
| **Captioning model** | Use Noodle generation connection | 画像を見られる任意のモデル |
| **Use connection default** | on | onまたはoff。Generation modelの説明文の設定に戻す |
| **Lorebook context** | off | onまたはoff |
| **Enhanced tone & continuity** | off | onまたはoff |
| **Use generated character schedules** | off | onまたはoff |
| **Carryover: Conversations** | off | onまたはoff |
| **Carryover: Roleplays** | off | onまたはoff |
| **Carryover: Games** | off | onまたはoff |
| **Carry hours** | 48 | 1から720 |
| **Carry items** | 8 | 1から50 |
| **Allow Noodle references**(チャットごと) | off | onまたはoff |

## 関連ガイド

- [Noodle: アプリ内のソーシャルタイムライン](noodle.md)
- [Chat Settingsの概要](../chats/chat-settings.md)
- [AIプロバイダーへの接続](../connections/connecting-to-a-provider.md)
- [対応しているAIプロバイダー](../connections/providers-reference.md)
