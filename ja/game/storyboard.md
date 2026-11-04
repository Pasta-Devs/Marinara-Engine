# Storyboardエージェントガイド

ダウンロードできる**Storyboard**エージェントは、完成した物語の本文を、順序の付いたキーフレーム画像に変換します。必要に応じて、image-to-videoによる短いクリップも作れます。Game ModeとRoleplayで使えます。Conversationのチャットでは使いません。

計画用のプロンプト、デフォルト値、チャットごとの設定項目はStoryboardパッケージが持ちます。メディアの生成はMarinaraが受け持ち、結果をGallery(ギャラリー)に保存して、チャットやGameのビューアーに表示します。このガイドでは、まずGame Modeを説明します。Roleplayの手順は、そのあとの[Roleplayの絵コンテ](#roleplay-storyboards)で説明します。Roleplayのそれ以外の機能については、[Roleplayモード: はじめに](../roleplay/getting-started.md)を参照してください。

- **Game Mode**は、完了したGMの語り1ターンを使います。**Automatic Storyboard Illustrations**と**Automatic Storyboard Animations**の2つのスイッチが別々にあり、直近のGMのターンには**Gallery → Create storyboard**を使います。フローティングのビューアーか、Gameの背景として、語りに同期して表示します。静止画とアニメーションで別々のプランナーを使います。
- **Roleplay**は、前回成功したエピソード以降の、完了したメッセージを使います。自動生成の選択肢は**Manual only**、**Still images**、**Animations**のいずれかで、**Gallery → Create storyboard**は直近の完了したAIの返信に対して動きます。エピソードを締めくくる返信の直下にそのまま表示し、エピソードの取り決め、視覚スタイル、任意のアニメーション追加分、出力の取り決めを使います。

どちらのモードでも、キーフレームの画像はGalleryの**Images**タブに、クリップは**Videos**タブに保存します。

## エージェントのインストール

1. Sparklesのアイコンから**Agents**(エージェント)パネルを開きます。
2. **Agent Organizer**(エージェント管理)を選びます。
3. **Storyboard**を開いて**Install**を選びます。
4. GameかRoleplayのチャットを開き、**Chat Settings → Agents**(チャット設定 → エージェント)を開きます。
5. **Enable Agents**(エージェントを有効にする)をオンにし、続けてStoryboardカードの**Enable Storyboards**(絵コンテを有効にする)をオンにします。

インストールするとエージェントを使えるようになりますが、すべてのチャットで有効になるわけではありません。Marinaraを再起動する必要はありません。

うまくいかず、Chat SettingsにStoryboardが出てこない場合は、パッケージがインストールされているか、チャットがGameかRoleplayか、パッケージのバージョンが使っているMarinaraのバージョンに対応しているかを確かめてください。

## Game Modeの絵コンテ

Game Modeの絵コンテは、完了したGMの語りちょうど1ターンを物語の元にします。隠されたGMコマンドタグを取り除き、順序の付いたフレームを計画し、各フレームをターン本文の読める区間の範囲に結び付けます。ビューアーは、読み手がそれらの区間を読み進めるのに合わせてフレームを切り替えます。

### Gameの絵コンテを作る

**始める前に:** Gameに画像のアカウント(Game独自のものか、全体のStoryboardの設定のもの)が必要です。[画像生成プロバイダーと設定](../media/image-providers.md)を参照してください。

1. Storyboardをインストールし、Game Modeのチャットを開きます。
2. **Chat Settings → Agents**(チャット設定 → エージェント)を開き、**Enable Agents**をオンにしてから、**Enable Storyboards**をオンにします。
3. GMの語りのターンを終わらせます。
4. **Chat Settings → Gallery**(チャット設定 → ギャラリー)を開き、**Create storyboard**(絵コンテの作成)を選びます。

閉じたビューアーを開き直すには、Galleryで**View storyboard**(絵コンテを表示)を選びます。手動生成は現在のアニメーション設定に従います。**Automatic Storyboard Animations**がオンなら、手動の絵コンテもクリップを要求します。

うまくいかなかった場合は、[トラブルシューティング](#troubleshooting)を参照してください。

### Gameの絵コンテの自動生成

Storyboardカードには、スイッチが2つあります。

- **Automatic Storyboard Illustrations**は、GMのターンが完了したあとに静止画のキーフレームを作ります。
- **Automatic Storyboard Animations**は、さらにキーフレームごとにクリップを作ります。アニメーションをオンにするとイラストもオンになり、イラストをオフにするとアニメーションもオフになります。

自動生成が動くのは、そのGameでエージェントが有効なあいだだけです。また、すでに絵コンテのあるターンに対して、絵コンテを作り直すことはありません。直近のターンにもう1つ絵コンテが欲しいときは、Galleryの手動操作を使います。

Generationの設定で**Expose media prompts before sending**(送信前にメディアのプロンプトを表示)がオンの場合、手動のGameの絵コンテでは、組み立て済みの画像プロンプトを表示して確認できます。自動の絵コンテは、プレイが止まらないように確認を省きます。

### Gameの設定

**Chat Settings → Agents → Storyboards**を開きます。

| 設定 | エージェントのデフォルト | 制御する内容 |
| --- | --- | --- |
| **Enable Storyboards** | チャットごとにOff | インストール済みのエージェントをこのGameで有効にします。 |
| **Automatic Storyboard Illustrations** | Automatic generationに従う | GMのターンが終わるたびに静止画のキーフレームを作ります。 |
| **Automatic Storyboard Animations** | Automatic generationに従う | キーフレームごとにMP4のクリップを作ります。 |
| **Keyframes per Turn** | 3(範囲は1から200) | 目標とするフレームの枚数です。ターンが短いと枚数が減ることがあります。 |
| **Animation Clip Duration** | 5秒(範囲は1から15) | クリップ1本ごとに要求する長さです。サービスによっては範囲内に丸められることがあります。 |
| **Viewer Display** | Floating | ドラッグできるビューアーか、Game全体の背景かを選びます。 |
| **Illustration Planner** | Still Keyframes | 完成した静止画のイラストを計画します。 |
| **Animation Planner** | Comic Page Animation | アニメーション向きの最初のフレームと動きの指示を計画します。 |
| **Use Storyboard Template** | On | 選んだ最終的なイラスト整形プロンプトを適用します。 |
| **Storyboard Illustration Prompt** | Game Scene Illustration | 計画したフレームを画像サービス向けに整形します。 |
| **Storyboard Video Prompt** | Cinematic Scene Video | 最初のフレームと動きの計画を動画サービス向けに整形します。 |

パッケージには、NovelAI、コミック、漫画、アニメ、LTX向けのプランナーも入っています。アニメーションのプランナーを選んだだけでは動画は有効になりません。**Automatic Storyboard Animations**と動画のアカウントがやはり必要です。

チャットごとにエージェントのデフォルトを上書きできます。Chat Settingsでは、継承している値に**Using agent default**と表示され、値を上書きするとリセット用の操作が現れます。

### Gameの絵コンテの作られ方

Game Modeは、静止画とアニメーションで別々のプランナーを使います。

```text
completed GM narration
  -> still or animation planner
  -> Storyboard Illustration Prompt
  -> image account
  -> optional Storyboard Video Prompt
  -> video account
```

物語の見せ場を選んで順序を決めるのはプランナーです。イラストのプロンプトはサービス向けの整形役であり、もう1つのプランナーではありません。アニメーションがオンの場合、アニメーションのプランナーが最初のフレームの正確な描写と動きの指示を作り、動画のプロンプトがその動きの指示を最終的なリクエストに変えます。

### Gameのビューアー

- **Floating viewer**(フローティングのビューアー)は、Gameの上に浮かぶ、ドラッグとリサイズができるパネルです。語りを読んでいる位置を追いかけ、対応するフレームを表示します。動画は用意できていれば再生し、そうでなければフレームの画像を表示します。閉じると、現在のターンのあいだだけ隠れます。開き直すには**Gallery → View storyboard**を使います。
- **Game background**(Gameの背景)は、表示中のフレームを画面のほかの要素の背後に置きます。オンのあいだは生成されたシーン背景を置き換えるため、**Generate background**は使えません。背景のクリップは一度だけ再生され、最後のフレームで止まります。

最初から再生、再生と一時停止、ミュートを操作するには、**Game controls**(ゲームの操作。チャットの右上付近にあるゲームコントローラーのボタン)を開きます。コンピューターではウィンドウ、スマートフォンではパネルとして開きます。Chat Settingsに移した場合は、そこにある**Game controls**セクションを開いてください。

### Storyboard Optimizedはエージェントのスイッチではない

ウィザードの**Storyboard Optimized**の演出は、GMの語りのプロンプトを変えて、絵にしやすいはっきりとした視覚的な手がかりがターンに含まれるようにします。Storyboardのインストールや有効化、メディアの自動生成の有効化、画像と動画のアカウントの選択は行いません。エージェントは、**Standard**と**Storyboard Optimized**のどちらでも使えます。エージェントのインストールと有効化は別に行ってください。

### Game Modeのレシピ

各レシピは、Storyboardの流れと、Gameやサービスのそのほかの設定を組み合わせたものです。パッケージにその名前の流れがあれば適用し、なければ記載の選択肢を手動で選びます。

#### Googleでのコミック絵コンテ

流れ: **Illustration Planner**はStill Keyframes、**Animation Planner**はComic Page Animation、**Storyboard Illustration Prompt**はGame Scene Illustration、**Storyboard Video Prompt**はComic Page Video、**Use Storyboard Template**はOnです。

Gameのチェックリストは次のとおりです。

- **Illustrator**: On(ウィザードのFeaturesステップ)
- 画像のアカウント: Google/Nano Banana、**Image Style**: Default、セットアップで生成された画風はそのまま
- **Automatic Storyboard Illustrations**: On
- **Automatic Storyboard Animations**: Off
- **Keyframes per Turn**: 3
- 動画のアカウント: None

これで通常の静止画の絵コンテを作れます。保存されたComic Pageのアニメーションの流れが働くのは、あとから動画のアカウントを選び、**Automatic Storyboard Animations**をオンにしたときだけです。

#### NovelAIへのタグの直接送信

流れ: **Illustration Planner**はNovelAI Keyframesです。**Storyboard Illustration Prompt**には、プロンプトが下のテキストだけの独自の選択肢を作ります。**Use Storyboard Template**はOnにします。Animation PlannerとVideo Promptは変更しません。

```text
${scenePrompt}
```

Gameのチェックリストは次のとおりです。

- **Image Style**: Danbooru。あわせて、Danbooruのプロファイルから文章形式の**Style text**を削除します。
- **Use Campaign Art Style**: Off
- **Attach Card Appearance**: Off
- **Send Avatar References**: Off
- **Use NovelAI Character Prompts**: Off
- **Queue media generation requests**: On
- ポジティブ、ネガティブ、イラストの各タグは必要に応じて調整します。

このそのまま渡すテンプレートは、プランナーの作った簡潔なNovelAIのタグを、通常の文章形式の整形プロンプトで包まずに送ります。

#### ローカルのKrea 2 + LTX 2.3

流れ: **Illustration Planner**は静止画だけの場合の受け皿としてStill Keyframes、**Animation Planner**はLTX Simple Image-to-Video、**Storyboard Illustration Prompt**はStoryboard First Frame、**Storyboard Video Prompt**はNarration Passthrough、**Use Storyboard Template**はOnです。

VRAMが8 GBのGPUでは、480pのキーフレーム1枚から始めます。うまく動いたら、キーフレーム3枚やより大きなサイズへ進めます。ComfyUIのアカウント、プレースホルダー、確認手順の全体は[Game ModeのLTX 2.3絵コンテ](ltx-2-3-storyboards.md)を参照してください。

<a id="roleplay-storyboards"></a>

## Roleplayの絵コンテ

Roleplayの絵コンテは、完了したやり取りを1つの映像的なエピソードにまとめ、そのエピソードを締めくくるAIの返信の下に表示します。

### Roleplayの絵コンテを作る

1. Storyboardをインストールし、Roleplayのチャットでオンにします。
2. **Chat Settings → Agents → Storyboards**で、**Prompt connection**と**Image model**を選びます。全体の設定が済んでいれば、**Use global default**のままでもかまいません。
3. **Automatic mode**を選びます。
   - **Manual only**: 自動のエピソードは作りません。**Create storyboard**で、必要なときに静止画のエピソードを作ります。
   - **Still images**: イラスト付きのエピソードを自動で作ります。
   - **Animations**: キーフレーム画像と、フレームごとのクリップを自動で作ります。動画のアカウントが必要です。
4. **Messages per episode**と**Keyframes per episode**を設定します。
5. 新しいAIの返信を完了させるか、**Chat Settings → Gallery**を開いて**Create storyboard**を選びます。

キーフレームが複数ある絵コンテでは、矢印でフレームを切り替えます。アニメーション付きのフレームはクリップをその場で表示し、クリップが生成中か利用できないあいだは画像を表示します。

### エピソードの間隔の仕組み

間隔とは、自動の絵コンテが成功してから次に成功するまでに、ユーザーとAIの新しいメッセージを何件ためる必要があるかを示す値です。どちらの側のメッセージも数に入り、エピソードには新しいメッセージが順番どおりに入ります。デフォルトは1なので、次に完了したAIの返信ですぐにエピソードを作れます。値を大きくすると、セリフや行動がより多くたまってからになります。元になる本文は直近の20件、12,000文字までに制限されるため、長いチャットでも計画リクエストが際限なく膨らむことはありません。

カウンターが進むのは、絵コンテが完全に、または一部だけでも保存されたあとだけなので、失敗したエピソードが元の本文を使い切ることはありません。既存のチャットを開いても、古い返信をさかのぼって処理することはありません。自動生成は、新しく完了したAIの返信を待ちます。

### Roleplayのプロンプトライブラリー

Roleplayでは、選んだ4つのプロンプトから、1回分のプランナーへのリクエストを作ります。

| 設定 | デフォルト | 役割 |
| --- | --- | --- |
| **Episode contract** | Completed Roleplay Episode | 本文に裏付けのある見せ場を選び、メッセージの順序どおりに並べます。 |
| **Visual style** | Normal / Anime | すべてのキーフレームの見た目です。ほかにNovelAI、Comic、Colored Manga、B&W Mangaがあります。 |
| **Animation addon** | Simple Storyboard Motion | クリップのときだけ使います。実現できる動作を1つ、カメラの挙動、元になるセリフと効果音、環境音、終わりの静止を加えます。 |
| **Output contract** | Roleplay Keyframe JSON | プランナーが返す、構造化されたキーフレームの項目です。 |

続いて**Storyboard Illustration Prompt**が、最初のフレームをそれぞれ画像サービス向けに整形します。クリップがオンなら、**Storyboard Video Prompt**が動きの計画を整形します。これらを編集するには、Stage 1にある折りたたまれた**Prompt library**(プロンプトライブラリー)を開きます。**Add option**(候補を追加)で独自のプロンプトを追加し、名前を変え、短い説明を加え、本文を編集してください。組み込みの選択肢はデフォルトに戻せます。Roleplayの視覚スタイルを編集しても、Game Modeのプランナーは変わりません。

### StoryboardとIllustratorの併用

StoryboardはIllustratorとは別のエージェントで、Illustratorの手動操作はこれまでどおり使えます。Roleplayの絵コンテが**Still images**か**Animations**のとき、Marinaraはその返信について、Illustratorが通常自動で作る画像を省きます。2つが競合するメディアを作らないようにするためです。**Manual only**の場合、Illustratorの動作は変わりません。

## Storyboardエージェントの設定

**Agents**(エージェント)パネルを開き、**Storyboard**を選んで設定画面を開きます。ここでの値は、独自の上書きを持たないチャットのデフォルトになります。

| 設定 | デフォルト | 役割 |
| --- | --- | --- |
| Agent connection | 選択中のエージェント用アカウント | モデルで絵コンテを計画します。 |
| **Image model** | **Use the chat image connection** | すべてのキーフレームを生成します。フォールバックの流れのどこかに画像のアカウントが必要です。 |
| **Video connection** | **Use the chat video connection** | アニメーションがオンのときにクリップを生成します。 |
| **Automatic generation** | Still images | 新しく有効にしたチャットで最初に使う、自動生成の動作です。 |
| **Keyframes per turn** | 3(範囲は1から200) | 目標とする、順序の付いたフレームの枚数です。 |
| **Clip seconds** | 5(範囲は1から15) | クリップ1本ごとに要求する長さです。 |
| **Viewer display** | Floating viewer | Gameのビューアーのデフォルトです。Roleplayでは、絵コンテを常にチャット内にそのまま表示します。 |
| **Default Roleplay episode interval** | 1(範囲は1から100) | 自動エピソードのあいだに必要な、Roleplayの新しい本文の量です。 |
| **Attach Card Appearance** | On | 該当するキャラクターの外見を画像プロンプトに加えます。**Image Appearance Override**(画像用の外見指定)がオンのカードやペルソナは、**Appearance**欄の代わりにその文章を渡します。 |
| **Send Avatar References** | On | 画像サービスが参照画像を受け付ける場合に、該当するキャラクターとペルソナのアバターを送ります。 |
| **Use the final image template** | On | 計画したフレームを、画像サービスへ送る前に整形します。Gameのチャットでは、これが**Use Storyboard Template**です。 |
| **Use NovelAI character prompts** | On | 対応する公式NovelAI V4/V4.5のアカウントでのみ、キャラクターごとの本来のプロンプト方式を使います。ほかのサービスでは、共通のプロンプトの経路を使います。 |

Game Mode向けには、ライブラリーに計画の系統が2つあり、Gameが静止画を作るかクリップを作るかで使い分けます。**Still planner**(デフォルトはStill Keyframes)と**Animation planner**(デフォルトはComic Page Animation)です。プランナーの本文は全体のエージェント設定で編集でき、各Gameのチャットは、自分の設定で選択肢から選びます。

計画のあとは、共通の整形プロンプトが最終的なリクエストを作ります。**Default image prompt**(Game Scene Illustration)と**Default video prompt**(Cinematic Scene Video)です。番号付きの各ステージには、それぞれ折りたたまれた**Prompt library**(プロンプトライブラリー)があります。Stage 2は画像の整形、Stage 3は画像を考慮した動きのプランナー、Stage 4は動画の受け渡し用の整形です。画像の選択肢には**Storyboard Illustration**と**Storyboard First Frame**もあります。動画の選択肢には**Anime Game Video**、**Comic Page Video**、**Narration Passthrough**があります。GameとRoleplayのチャットでは、別々の整形プロンプトを選べます。

Stage 3の**Image-aware shot planning**(画像を考慮したショット計画)は、動画のアカウントの**Video prompting instructions**(動画プロンプトの作成指示)にも従います。アカウントエディターのこの欄に、カメラの言い回し、プロンプトの長さ、音の指示など、使う動画モデルが求めるものを書いてください。

アカウントの選ばれ方は、モードによって少し異なります。Roleplayにはチャットごとのプロンプト、画像、動画の選択欄があり、**Use global default**を選ぶとStoryboardの設定を引き継ぎます。Game Modeは、Game独自の計画、画像、動画のアカウントが設定されていればそれを使い、なければエージェントのデフォルトに戻ります。静止画には画像のアカウントが必要です。アニメーションには、キーフレーム画像の生成の成功と、動画のアカウントが必要です。

## 画像プロンプトとキャラクターの一貫性

プランナーは、どの瞬間を見せるかを決め、各フレームの視覚的な中身を書きます。最終的な画像テンプレートは、サービス向けの構成、該当するキャラクターの外見、参照画像の扱い、場所の状況、キャンペーンのアートディレクション、画像への指示を加えます。

画像サービスが受け取るべき形式を、プランナーがすでにそのまま返している場合は、`${scenePrompt}`のようなそのまま渡すテンプレートを使います。**Use the final image template**をオフにするのは、整形プロンプトを意図的に通さないときだけにしてください。必須の画像への指示はそれでも適用されます。

キャラクターを安定させるには、次の点に気を付けます。

- キャラクターカードのAppearance欄を具体的に書き、内容を最新に保ちます。
- プランナーが必要な情報をすでに繰り返している場合を除き、**Attach Card Appearance**はオンのままにします。
- サービスが参照画像を受け付け、アバターが狙いどおりの見た目なら、**Send Avatar References**はオンのままにします。
- 1フレームに登場させるキャラクターは少人数にし、一人ひとりがはっきり見えるようにします。Storyboardが含めるのは、チャットのすべてのキャラクターではなく、該当する映っているキャラクターとペルソナだけです。

## 費用と処理時間

キーフレーム1枚ごとに、別々の画像ジョブが動きます。アニメーション付きの絵コンテでは、成功したキーフレーム1枚につき動画ジョブが1件増えるため、3枚構成のアニメーション付きの絵コンテでは、画像のリクエストが3件、動画のリクエストが3件になることがあります。新しいサービスやローカルの環境を試すときは、静止画とキーフレーム1枚から始めます。フレームの枚数、クリップの長さ、自動生成の間隔を上げるのは、基本の流れが動いてからにします。

## 旧来の絵コンテの仕組みで作ったGame

既存のGameのチャットには、以前の内蔵の絵コンテUIで設定した値が残っていることがあります。パッケージをインストールすると、Marinaraはそれをチャットごとの上書きとして保持するため、古いGameは現在のエージェントのデフォルトとは違う動きをすることがあります。**Chat Settings → Agents → Storyboards**を開き、各欄のリセット操作を使うと、その欄が再びエージェントのデフォルトに従います。これらの設定は移行用のデータにすぎません。生成には、そのGameでパッケージがインストールされ、オンになっていることが引き続き必要です。

<a id="troubleshooting"></a>

## トラブルシューティング

### Create storyboardは押せるのに生成が失敗する

- そのチャットで**Enable Agents**と**Enable Storyboards**をオンにします。
- RoleplayのStoryboardカード、Gameの設定、全体のStoryboardの設定のいずれかで、有効な画像生成のアカウントを選びます。
- AIかGMの返信が終わるのを待ってから、もう一度試します。

### Roleplayで自動のエピソードができない

- **Manual only**ではなく、**Still images**か**Animations**を選びます。
- 新しく完了したAIの返信を待ちます。チャットを開いても、古いメッセージをさかのぼって処理することはありません。
- **Messages per episode**を確かめます。ユーザーとAIの新しいメッセージが十分にたまる必要があります。
- 失敗した実行ではカウンターが進まないので、サーバーのログでサービス側の元のエラーや解析エラーを調べます。

### 画像は出るのに動画が出ない

- Roleplayでは**Animations**を選びます。Game Modeでは**Automatic Storyboard Animations**をオンにします。
- image-to-videoの入力に対応したVideo Generationのアカウントを選びます。
- Galleryの**Videos**タブを確認します。クリップは、そのキーフレーム画像より遅れて仕上がることがあります。
- モデルの失敗で計画が代替の処理に切り替わった場合、Marinaraは代替の画像を残し、その実行では動画を省くことがあります。

### 絵コンテが途中までしかない、または止まったままになる

サービスのジョブが失敗したか、タイムアウトしたか、レート制限や内容の制限に当たった可能性があります。サービスが正常でも遅い場合は、`.env`の`IMAGE_GEN_TIMEOUT_MS`か`VIDEO_GEN_TIMEOUT_MS`の値を大きくしてから、Marinaraを再起動します。これらの値は起動時に読み込まれるためです。[サーバー設定リファレンス](../CONFIGURATION.md)を参照してください。

プランナー、組み立て済みの画像プロンプト、参照画像の選択、動画のプロンプトを確認するには、Debugモードをオンにして、サーバーのログを`storyboard`で検索します。デバッグのログにはチャットの私的な本文が含まれることがあるので、共有する前に見せたくない部分を取り除いてください。

## 関連ガイド

- [エージェント: チャットを支えるAIヘルパー](../agents/agents-overview.md)
- [ダウンロードできるエージェント一覧](../agents/built-in-agents.md)
- [Game Mode: はじめに](getting-started.md)
- [Roleplayモード: はじめに](../roleplay/getting-started.md)
- [画像生成プロバイダーと設定](../media/image-providers.md)
- [シーン動画の生成](../media/scene-video.md)
- [Game ModeのLTX 2.3絵コンテ](ltx-2-3-storyboards.md)
