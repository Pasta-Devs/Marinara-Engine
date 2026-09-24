# Noodleの設定とチャットへの引き継ぎ

このガイドでは、**Noodle settings**(Noodleの設定)パネルをセクションごとに説明し、デフォルト値と上限をすべて示します。Noodleとチャットをつなぐ方法も説明します。これを担う機能は2つあり、**Carryover to chats**(チャットへの引き継ぎ)と、チャットごとの**Allow Noodle references**(Noodleでの参照を許可)トグルです。2つは逆の方向に働きます。

Noodleは、Marinara Engineに組み込まれたソーシャルメディアのタイムラインです。初めて使う場合は、先に[Noodle: アプリ内のソーシャルタイムライン](overview.md)を読んでください。ペルソナとは、チャットで自分が演じるキャラクターです。接続とは、テキストや画像を生成するAIプロバイダーへの接続情報をまとめて保存したものです。[AIプロバイダーへの接続](../connections/connecting-to-a-provider.md)を参照してください。

## Noodleの設定パネルの開き方

1. 上部のバーからNoodleを開きます。
2. 左のサイドバーで**Settings**(設定)ボタン(歯車のアイコン)をクリックします。
3. パネルの見出しに**Noodle settings**と表示されます。

Noodleの設定はすべて全体に適用します。1つのチャットだけに効くのではなく、すべてのペルソナとすべてのチャットに効きます。変更した内容はその場ですぐ保存します。

## Invites(招待)

**Invites**セクションでは、Noodleの更新に参加できるキャラクターを選びます。更新とは、招待したアカウントのために、AIが投稿、返信、リポスト、いいねをまとめて書く処理です。

- **Professor Mari participates**(Professor Mariを参加させる): トグル、デフォルトは**on**です。オフにすると、Noodleのアカウント検索からProfessor Mariを隠し、以降に生成する投稿、返信、リアクション、メンション、プロフィール生成、チャットへの引き継ぎから除外します。これまでのタイムラインの履歴は残り、トグルを戻すとアカウントも復帰します。
- **Characters to Invite**(招待するキャラクター): 検索ボックスです。ここに入力すると、下にあるフォルダー一覧とキャラクター一覧の両方を絞り込みます。
- **Add from Folder**(フォルダーから追加): クリックするとキャラクターフォルダーの一覧が開きます。1つ以上のフォルダーにチェックを入れ、下部の招待ボタンをクリックします。ボタンのラベルは選択内容によって変わります。
  - 何も選んでいないときは**Select folders to invite**。
  - すでに全員が招待済みのときは**Selected folder characters are invited**。
  - 追加できるキャラクターがいるときは**Invite N characters**。
- **Characters**(キャラクター): ライブラリーにあるすべてのキャラクターを並べた、スクロールできる一覧です。各行に招待ボタンか削除ボタンがあります。状態は**Invited**、**Included by folder**、**Not invited**のいずれかで表示します。

フォルダーからの招待は、その場かぎりの一括操作です。自動で同期はしません。後からそのフォルダーに追加したキャラクターは、自動では招待されません。

## Refresh(更新)

**Refresh**セクションでは、Noodleが文章を書くときに使うAIの接続と、Noodleが自動で更新する頻度を設定します。

- **Generation connection**(生成用の接続): ドロップダウンです。投稿、返信、リポスト、いいね、プロフィールの文章をNoodleが書くときに使う接続を選びます。最初は未設定で、**Choose connection**というプレースホルダーが表示されます。更新を実行するには、必ず1つ選んでください。画像を扱えるモデルには、Noodleの投稿とコメントから、関連する最近の画像を最大8枚まで渡します。画像の入力を受け付けないテキスト専用のモデルには、画像なしで自動的に再試行します。
- **Refreshes/day**(1日の更新回数): 0から24までの数値、デフォルトは**2**です。Marinaraが1日に自動で実行する更新の回数です。0にすると自動更新をオフにします。手動で更新する回数は制限しません。

### Automatic schedule(自動スケジュール)

**Refreshes/day**が0より大きいとき、Marinaraは1日を均等な時間帯に分け、それぞれの中からランダムな時刻を1つ選びます。予定された時刻はタイムゾーンとともに**Automatic schedule**の下に表示します。これからの時刻の横にある鉛筆をクリックすると、別の時間に移せます。過去の時刻、実行済みの時刻、重複する時刻は選べません。

自動更新はMarinaraのサーバーの中で動きます。Noodleの画面を開いたままにする必要はありませんが、Marinara自体は起動しておく必要があります。更新に失敗した場合はスケジュールにエラーを表示し、後で再試行します。失敗が続くと、待ち時間を長くします。予定された時刻をいくつも逃した場合は、タイムラインがあふれないように、まとめて1回だけ埋め合わせの更新を実行します。

## Active Accounts(アクティブなアカウント)

**Active Accounts**セクションでは、1回の更新に参加するアカウントの数を決めます。対象になるのは、招待したキャラクター、フォルダー経由で含まれるキャラクター、オンにしている場合はランダムユーザーです。

- **Active selection**(アクティブの選び方): ドロップダウン、デフォルトは**Random range**です。選択肢は**Random range**、**Exact count**、**All invited**です。
- **Random range**を選ぶと、2つの欄が現れます。**Min active**(1から100、デフォルトは**2**)と**Max active**(1から100、デフォルトは**5**)です。更新のたびに、この範囲から数を選びます。
- **Exact count**を選ぶと、**Active count**(1から100)の欄が1つ現れ、アカウント数を固定します。
- **All invited**を選ぶと、対象になるアカウントがすべて参加し、上限はありません。

使用中のペルソナは、これらのアカウントとは別に常に参加できます。**Professor Mari participates**がオンのあいだは、Professor Mariも対象になります。

Noodleは、初回のプロフィールを用意する前にアクティブなアカウントを決めます。生成済みのNoodleプロフィールがないアクティブなキャラクターだけがプロフィール生成の対象で、招待済みでも参加しないキャラクターは含みません。タイムラインを書く要求にも、その更新で選ばれたアカウントのキャラクターカードだけを渡します。

## Activity(アクティビティー)

**Activity**セクションでは、1回の更新で作れる量の上限を決めます。各欄は更新1回あたりの上限です。

| 欄 | デフォルト | 範囲 |
|---|---|---|
| **Posts** | 8 | 0から100 |
| **Replies** | 12 | 0から200 |
| **Reposts** | 4 | 0から100 |
| **Likes** | 18 | 0から500 |

欄を0にすると、その種類のアクティビティーをAIが作らなくなります。

## Image Generation(画像生成)

**Image Generation**セクションを使うと、Noodleが一部の投稿にAIの作った画像を添付できます。これには画像生成用の接続、つまり画像を作るために設定した接続が必要です。[対応しているAIプロバイダー](../connections/providers-reference.md)を参照してください。

- **Image generation**(画像生成): トグル、デフォルトは**off**です。オンにすると、投稿用の画像をAIが生成します。
- オンにすると、さらに次の項目が現れます。
  - **Image generation connection**(画像生成用の接続): ドロップダウン、デフォルトは**Default image generation connection**です。Defaultのままにすると、**Connections**パネルで画像生成のデフォルトに指定した接続を使います。
  - **Prompt instructions**(プロンプトへの指示): あらかじめ文章が入ったテキストボックスで、4000文字までです。ここに書いた補足は画像プロンプトに統合します。
  - **Use avatar references**(アバターを参照に使う): トグル、デフォルトは**on**です。キャラクターのアバターや参照用の画像を画像モデルに送ります。
  - **Include descriptions**(説明を含める): トグル、デフォルトは**on**です。キャラクターの外見について書かれた内容を画像プロンプトに追加します。
  - **Images/refresh**(更新1回あたりの画像数): 0から50までの数値、デフォルトは**3**です。手動と自動のどちらの更新でも、それぞれ生成する投稿画像の枚数をこの数で制限します。
- **Attach gallery images**(ギャラリーの画像を添付): 独立したトグルで、デフォルトは**off**です。**Image generation**がオフのときも表示します。新しい画像を作る代わりに、そのキャラクターのギャラリーや、そのキャラクターが登場するチャットにある画像を投稿で使い回せます。

**Image generation**をオンにしても使える画像用の接続がない場合、更新は実行できません。「Choose an image generation connection for Noodle first.」というメッセージが表示されます。画像の生成に失敗すると1回だけ再試行します。2回目も失敗した場合は、使われなかった画像プロンプトを表に出さず、テキストだけの投稿を公開して更新を続けます。

Noodleがこれらの画像プロンプトを書くときに使うテンプレートは**Noodle Post Image**という名前です。**Settings** > **Generations** > **Image Generation Prompt Overrides**で編集できます。**Prompt instructions**に書いた文章はこのテンプレートに渡され、その結果がいつもの画像スタイルプロファイルを通ります。[画像と動画のPrompt Overrides](../prompts/prompt-overrides.md)と[画像スタイルプロファイル](../media/style-profiles.md)を参照してください。Professor Mariにはキャラクターカードがないため、画像の投稿には組み込みのアバターと参照用のイラストを使います。

## Timeline Writing(タイムラインの執筆)

**Timeline Writing**セクションでは、更新で文章を書くときの語り口と、長期的な記憶の扱いを調整します。

- **Enhanced tone & continuity**(語り口と連続性の強化): トグル、デフォルトは**off**です。オンにすると、各アカウントの語り口はデフォルトの明るい調子ではなく、そのアカウント自身のPersonality/Description/Backstoryに強く根ざしたものになります。同じ更新の中でアカウント同士が互いの投稿に反応したり、引用したり、言い争ったりしやすくなり、古い投稿を思い出す頻度も上がります(完全にランダムに選ぶのではなく、そのとき参加しているアカウントに関係する投稿を優先します)。過去の投稿への言及も、控えさせるのではなく認める指示に変わります。オフのあいだはNoodle本来の語り口と想起の挙動をそのまま再現するので、タイムラインが変わるのはこれをオンにしたときだけです。
- **Use generated character schedules**(生成したキャラクタースケジュールを使う): トグル、デフォルトは**off**です。オンにすると、参加する各キャラクターについて、その日に生成済みのConversationのスケジュールがあればNoodleが取り込みます。Noodle自身がスケジュールを生成したり更新したりすることはありません。現在のローカルの日付と時刻は、このトグルの状態に関係なく、毎回のタイムラインの更新に含めます。

## タイムラインを書く語り口のカスタマイズ

Noodleの更新で文章を書く仕組みは、組み込みの語り口と創作の自由度に関する指示に従います。各アカウントの投稿にどれだけ個性を出すか、アカウント同士がどこまで軽口をたたき、冗談を言い、ぶつかってよいかを定めた指示です。この文章は**Settings** > **Generations** > **Image Generation Prompt Overrides** > **Noodle Timeline Voice & Tone**で書き換えられます(セクション名には「Image」とありますが、この一覧には画像用にかぎらず、カスタマイズできるNoodleとConversationのテキストプロンプトがすべて入っています)。そこに表示されるデフォルトの文章は、カスタマイズするまでは上記の**Enhanced tone & continuity**トグルに連動します。自分の文章を保存すると、以降はトグルの状態に関係なくその文章を使います。

この上書きが対象にするのは語り口だけです。更新の出力を正しく保つためのルール(どの構造化された操作が許されるか、やり取りの相手をどう指定するかなど)はこの文章に含まれず、常に有効です。そのため、語り口を書き換えても更新が壊れることはありません。

## World / Lore(世界とロア)

**World / Lore**セクションを使うと、チャットの生成と同じロアブックの仕組みで、更新にロアブックのエントリーを取り込めます。

- **Lorebook context**(ロアブックのコンテキスト): トグル、デフォルトは**off**です。オンにすると、更新のたびにNoodleの最近の投稿と返信の文面、それにアクティブなキャラクターのプロフィールをロアブックのキーワードと照合し、一致したエントリーを、その更新に参加するアカウント向けの世界とロアのコンテキストとして渡します。発動できるのは、アクティブなキャラクターに紐づいたロアブックか、グローバルに指定したロアブックだけです。発動した世界とロアの内容には、更新1回あたり8,192トークンという固定の上限があります。デフォルトはオフなので、オンにするまで既存のタイムラインは変わりません。

## Carryover(引き継ぎ)

**Carryover**セクションでは、Noodleの最近のアクティビティーをチャットへ送ります。オンにすると、チャットのプロンプトに「Recent Social Media Activity」というブロックが加わり、キャラクターがNoodleで何をしていたかを伝えます。

- **Carryover to chats**(チャットへの引き継ぎ): 独立した3つのトグルで、すべてデフォルトは**off**です。**Conversations**、**Roleplays**、**Games**の3つがあり、Noodleのアクティビティーを受け取りたいモードをオンにします。
- **Carry hours**(引き継ぐ時間): 1から720までの数値、デフォルトは**48**です。Noodleが何時間前までさかのぼってアクティビティーを探すかを決めます。
- **Carry items**(引き継ぐ件数): 1から50までの数値、デフォルトは**8**です。1回のチャットのターンに追加するアクティビティーの要約の上限です。

引き継ぐのは、Noodleに招待したキャラクターと、そのチャットで使用中のペルソナのアクティビティーだけです。ここではフォルダー経由で含まれているだけでは足りません。
まとめられた引き継ぎブロック全体には、チャットの生成1回あたり8,192トークンという別の固定の上限があります。件数の上限を超えそうな場合、Marinaraは収まる範囲でいちばん新しい要約を残し、時系列の順に並べて表示します。

## Reset Noodle(Noodleのリセット)

**Reset Noodle**セクションでは、アカウントと設定を残したままタイムラインを消去します。

1. **Reset Noodle Timeline**(Noodleのタイムラインをリセット)ボタンをクリックします。
2. **Reset Noodle Timeline**というタイトルのウィンドウが開きます。そこには「This removes all posts, replies, likes, reposts, activity digests, and refresh records. Profiles, follows, invites, and settings stay.」と書かれています。
3. **Reset timeline**をクリックして確定します。

削除するのはタイムラインの内容だけです。アカウント、ハンドル、プロフィール、フォロー、招待、Noodleのすべての設定はそのまま残ります。

## Random users(ランダムユーザー)

ランダムユーザーとは、ライブラリーには含まれない6つの組み込みアカウントです。Thread Countess、Packet Soup、Orbit Notice、Glass Bulletin、Moth Hour、Brine Indexの6つで、それぞれに短い紹介文のプロフィールが付いています。

オンにするには、**Invites**セクションの**Characters**一覧の先頭にある**Random users**の行を使います。デフォルトは**off**です。行の説明はオンのとき**Enabled**、オフのとき**Ambient fake profiles**と表示します。オンにすると、これらのアカウントは更新のあいだに投稿、いいね、リポスト、返信、フォローができます。プロフィールからこれらをフォローすることはできません。

## Noodleとチャットをつなぐ

Noodleとチャットは、2つの方向でコンテキストを共有できます。これは別々の2つの機能です。片方をオンにしても、もう片方はオンになりません。

**Carryover to chats**(Noodleの設定にあります)は、Noodleのアクティビティーをチャットへ送ります。上の**Carryover**セクションで説明したとおり、そのチャットのプロンプトに「Recent Social Media Activity」ブロックを追加します。

**Allow Noodle references**はチャットごとのトグルです。こちらは逆に、チャットのアクティビティーをNoodleへ送ります。場所はチャット自身の設定の中、**Connected Chats**(接続チャット)の近くです。[Chat Settingsの概要](../chats/chat-settings.md)を参照してください。どのチャットでもデフォルトは**off**です。説明には「Timeline refreshes may include recent messages from this chat, with the chat name, mode, and participants stated in the prompt.」と書かれています。そのチャットで[キャラクタースケジュールと自律メッセージ](../conversation/schedules.md)も動いている場合は、その物語でのキャラクターの現在の状態と行動(たとえば「currently dnd (At the office)」)もメッセージと一緒に含まれ、そのチャットの中だけに適用します。

Noodleのアクティビティーをチャットに出すには、対応する**Carryover to chats**のモードをオンにします。Noodleの更新でチャットの内容を読ませるには、そのチャットの**Allow Noodle references**をオンにします。どちらか一方だけでも、両方を同時に使ってもかまいません。

## トラブルシューティング

- **手動で更新しても何も作られない**: **Generation connection**を選び、キャラクターを1つ以上招待し(またはランダムユーザーをオンにし)、**Refresh**セクションに表示されるエラーを確認します。
- **自動更新が実行されない**: **Refreshes/day**を0より大きくし、Marinaraのサーバーを起動したままにして、**Automatic schedule**にある予定の時刻とタイムゾーンを確認します。スケジュールにエラーが出ている場合は、接続かレート制限の問題を直し、再試行を待ちます。
- **投稿が最近のチャットに触れない**: そのチャットの設定で**Allow Noodle references**をオンにし、キャラクターが招待されているか確かめます。チャットのコンテキストはAIへの手がかりであって、保証ではありません。
- **Noodleのアクティビティーがチャットに出ない**: 対応する**Carryover to chats**のモードをオンにし、アクティビティーが古すぎる場合は**Carry hours**を大きくします。
- **投稿に画像が付かない**: **Image generation**をオンにし、使える画像用の接続を選び、**Images/refresh**の上限を確認します。

## 設定とデフォルト値

この表は、Noodleのすべての設定について、デフォルト値と範囲を示します。

| 設定 | デフォルト | 範囲や選択肢 |
|---|---|---|
| **Generation connection** | なし | テキスト用の接続すべて(更新に必須) |
| **Professor Mari participates** | on | onまたはoff |
| **Refreshes/day** | 2 | 0から24(0で自動更新をオフ) |
| **Active selection** | Random range | Random range、Exact count、All invited |
| **Min active** | 2 | 1から100(Random rangeのときのみ) |
| **Max active** | 5 | 1から100(Random rangeのときのみ) |
| **Active count** | Max activeと同じ | 1から100(Exact countのときのみ) |
| **Posts** | 8 | 0から100 |
| **Replies** | 12 | 0から200 |
| **Reposts** | 4 | 0から100 |
| **Likes** | 18 | 0から500 |
| **Image generation** | off | onまたはoff |
| **Image generation connection** | Default | 画像生成用の接続すべて |
| **Prompt instructions** | 組み込みの文章 | 4000文字まで |
| **Use avatar references** | on | onまたはoff |
| **Include descriptions** | on | onまたはoff |
| **Images/refresh** | 3 | 0から50 |
| **Attach gallery images** | off | onまたはoff |
| **Lorebook context** | off | onまたはoff |
| **Enhanced tone & continuity** | off | onまたはoff |
| **Carryover: Conversations** | off | onまたはoff |
| **Carryover: Roleplays** | off | onまたはoff |
| **Carryover: Games** | off | onまたはoff |
| **Carry hours** | 48 | 1から720 |
| **Carry items** | 8 | 1から50 |
| **Allow Noodle references**(チャットごと) | off | onまたはoff |

## 関連ガイド

- [Noodle: アプリ内のソーシャルタイムライン](overview.md)
- [Chat Settingsの概要](../chats/chat-settings.md)
- [AIプロバイダーへの接続](../connections/connecting-to-a-provider.md)
- [対応しているAIプロバイダー](../connections/providers-reference.md)
