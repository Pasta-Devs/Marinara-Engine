# Storyboardエージェントガイド

ダウンロードできる**Storyboard**エージェントは、完成した物語の本文を、順序の付いたキーフレーム画像に変換します。必要に応じて、image-to-videoによる短いクリップも作れます。対応するのは**Roleplay**と**Game Mode**です。Conversationのチャットで絵コンテは使えません。

現在の絵コンテは、このエージェントを軸にした仕組みで動きます。計画用のプロンプト、デフォルト値、チャットごとの設定項目はStoryboardパッケージが持ちます。メディアを生成し、Gallery(ギャラリー)に保存し、チャットやGameのビューアーに表示する部分はMarinara Engineが受け持ちます。

## RoleplayとGame Modeの早見表

| | Roleplay | Game Mode |
| --- | --- | --- |
| 物語の元になる本文 | 前回成功したエピソード以降の、完了したユーザーとAIのメッセージ | 完了したGMの語り1ターン |
| 自動生成の選択肢 | **Manual only**、**Still images**、**Animations**のいずれか | **Automatic Storyboard Illustrations**と**Automatic Storyboard Animations**の独立した2つのスイッチ |
| 手動の操作 | 直近の完了したAIの返信に対する**Gallery > Create storyboard** | 直近の完了したGMのターンに対する**Gallery > Create storyboard** |
| 表示 | エピソードを締めくくるAIの返信の直下にそのまま表示 | フローティングのビューアーかGameの背景。語りの進行に同期 |
| 計画用のプロンプト | エピソードの取り決め、視覚スタイル、任意のアニメーション追加分、出力の取り決め | 静止画とアニメーションで別々のプランナー |
| 共通の最終プロンプト | イラスト用の画像プロンプトとアニメーション用の動画プロンプト | イラスト用の画像プロンプトとアニメーション用の動画プロンプト |

どちらのモードでも、キーフレームの画像はGalleryの**Images**タブに、クリップは**Videos**タブに保存します。

## エージェントのインストール

1. Sparklesのアイコンから**Agents**(エージェント)パネルを開きます。
2. **Download Agents**を選びます。
3. **Storyboard**を開いて**Install**を選びます。
4. RoleplayかGameのチャットを開き、**Chat Settings > Agents**(チャット設定 > エージェント)を開きます。
5. **Enable Agents**をオンにし、Storyboardカードの**Enable Storyboards**をオンにします。

パッケージをインストールすると、対応するチャットで使えるようになります。ただし、すべてのチャットで勝手に有効になるわけではありません。現在のパッケージは、インストール後にMarinaraを再起動する必要はありません。

Chat SettingsにStoryboardが出てこないときは、パッケージがインストールされているか、チャットがRoleplayかGame Modeになっているかを確かめます。

## Storyboardエージェントの設定

**Agents**パネルを開き、**Storyboard**を選んで設定画面を開きます。ここでの値は、独自の上書きを持たないチャットのデフォルトになります。

### 生成とメディアのデフォルト

| 設定 | デフォルト | 役割 |
| --- | --- | --- |
| Agent connection | 選択中のAgent connection | LLMで絵コンテを計画します |
| **Image connection** | Use the Game image connection | すべてのキーフレームを生成します。フォールバックの流れのどこかに画像の接続が必要です |
| **Video connection** | Use the Game video connection | アニメーションが有効なときにクリップを生成します |
| **Automatic generation** | Still images | 新しく有効にしたチャットで最初に使う自動生成の動作を決めます |
| **Keyframes per turn** | 3(範囲は1から6) | 目標とするフレームの枚数を決めます |
| **Clip seconds** | 5(範囲は1から15) | クリップ1本ごとに要求する長さを決めます |
| **Viewer display** | Floating viewer | Game Modeのビューアーのデフォルトを決めます。Roleplayの絵コンテは常にチャット内にそのまま表示します |
| **Default Roleplay episode interval** | 1(範囲は1から100) | 自動エピソードの間にRoleplayの新しい本文をどれだけためるかを決めます |
| **Attach Card Appearance** | On | 該当するキャラクターの外見の情報を画像プロンプトに加えます |
| **Send Avatar References** | On | 画像プロバイダーが参照画像に対応している場合に、該当するキャラクターとペルソナのアバターを送ります |
| **Use the final image template** | On | 計画したフレームを、画像プロバイダーへ送る前に整形します |
| **Use NovelAI character prompts** | On | 対応する公式NovelAI V4/V4.5の接続で、キャラクターごとの本来のプロンプト方式を使います |

### Game prompt library(Gameのプロンプトライブラリー)

Gameのライブラリーには、計画の系統が2つあります。どちらを使うかは、そのGameが静止画を作るのかクリップを作るのかで決まります。

| 設定 | デフォルト | 役割 |
| --- | --- | --- |
| **Still planner** | Still Keyframes | 完了したGMの1ターンを、完成した静止画の見せ場に分割します |
| **Animation planner** | Comic Page Animation | アニメーション向きの最初のフレームと、長さを考慮した動きの指示を作ります |

パッケージにはこのほか、NovelAI、コミック、カラー漫画、白黒漫画、アニメのエピソード、LTX向けのプランナーも入っています。プランナーのプロンプト本文は、全体のエージェント設定で編集できます。Gameのチャットでは、**Chat Settings > Agents > Storyboards**にある静止画とアニメーションの選択肢から選びます。

### Roleplay prompt library(Roleplayのプロンプトライブラリー)

Roleplayでは、選んだ4つのプロンプトを組み合わせて1回分の計画リクエストを作ります。

| 設定 | デフォルト | 役割 |
| --- | --- | --- |
| **Episode contract** | Completed Roleplay Episode | 本文に裏付けのある完了した見せ場を選び、メッセージの順序どおりに並べます |
| **Visual style** | Normal / Anime | すべてのキーフレームの画づくりを決めます |
| **Animation addon** | Simple Storyboard Motion | クリップのときだけ、動き、カメラ、元になるセリフと効果音、環境音、終わりの静止を加えます |
| **Output contract** | Roleplay Keyframe JSON | プランナーが返すキーフレームの項目構成を定義します |

これらの全コレクションは、Stage 1内の折りたたまれた**Prompt library**(プロンプトライブラリー)で編集します。**Add option**(候補を追加)で独自プロンプトを追加し、名前、短い説明、本文を編集してください。組み込みの候補はパッケージのデフォルトに戻せます。

### Shared provider formatters(共通のプロバイダー向け整形プロンプト)

どちらのモードでも、フレームの計画が終わると、共通の整形プロンプトがプロバイダーへ送る最終的なリクエストを作ります。

| 設定 | デフォルト | 役割 |
| --- | --- | --- |
| **Default image prompt** | Game Scene Illustration | 計画された各キーフレームを画像プロバイダー向けに整形します |
| **Default video prompt** | Cinematic Scene Video | 最初のフレームの画像と動きの計画を動画プロバイダー向けに整形します |

番号付きの各ステージには独立した折りたたみ式**Prompt library**があります。Stage 2は画像整形、Stage 3は画像を考慮した動作計画、Stage 4は動画の受け渡し用整形を管理します。組み込み画像候補には**Storyboard Illustration**と**Storyboard First Frame**もあります。動画候補は**Anime Game Video**、**Comic Page Video**、**Narration Passthrough**です。GameとRoleplayのチャットは、共通のプロンプトコレクションを変更せずに異なる整形を選べます。

### 全体のデフォルトとチャットごとの上書き

チャットごとにエージェントのデフォルトを上書きできます。Chat Settingsでは、継承している値に**Using agent default**と表示され、上書きを作ると元に戻すためのボタンが現れます。

接続の優先順位は、モードによって少し異なります。

- Roleplayには、チャットごとのプロンプト、画像、動画の選択欄があります。**Use global default**を選ぶとStoryboardの設定を引き継ぎます。
- Game Modeは、Game専用の計画、画像、動画の接続が設定されていればそれを使い、設定がなければStoryboardエージェントのデフォルトに戻ります。

静止画には画像の接続が必要です。アニメーションには、キーフレーム画像の生成が成功していることと、動画の接続の両方が必要です。

## Roleplayの絵コンテ

Roleplayの絵コンテは、完了した一連のメッセージを1つの映像的なエピソードにまとめ、その区切りとなったAIの返信の下に表示します。

### クイックスタート

1. Storyboardをインストールし、Roleplayのチャットで有効にします。
2. **Chat Settings > Agents > Storyboards**で**Prompt connection**と**Image connection**を選びます。全体の設定が済んでいれば**Use global default**のままでかまいません。
3. **Automatic mode**を選びます。
   - **Manual only**: 自動のエピソードは作りません。**Create storyboard**を押したときだけ静止画のエピソードを作ります。
   - **Still images**: イラスト付きのエピソードを自動で作ります。
   - **Animations**: キーフレーム画像と、フレームごとのクリップを自動で作ります。動画の接続が必要です。
4. **Messages per episode**と**Keyframes per episode**を設定します。
5. 新しいAIの返信を完了させるか、Galleryを開いて**Create storyboard**を選びます。

キーフレームが複数ある絵コンテでは、矢印でフレームを切り替えます。アニメーション付きのフレームは、そのまま再生できるクリップを表示します。クリップが生成中か利用できない場合は画像を表示します。

### エピソードの間隔の仕組み

この間隔は、自動の絵コンテが成功してから次の絵コンテまでに、ユーザーとAIの新しいメッセージを何件ためるかを決めます。どちらの側のメッセージも間隔を進め、エピソードには新しいメッセージが時系列で入ります。

デフォルトは1なので、次に完了したAIの返信ですぐエピソードを作れます。値を大きくすると、セリフや展開がたまってからになります。元になる本文は直近の20件、12,000文字までに制限されるため、古いチャットや非常に長いチャットでも計画リクエストが際限なく膨らむことはありません。

間隔の起点が進むのは、絵コンテが完全に、または一部だけでも保存されたあとだけです。失敗したエピソードは元の本文を消費しません。既存のチャットを開いても、古い返信をさかのぼって処理することはありません。自動生成は、新しく完了したAIの返信を待ちます。

### Roleplayのプロンプトの流れ

Roleplayでは、共通の整形プロンプトに渡す前に、4つの計画の層を通します。

1. **Episode contract**が、本文に裏付けのある完了した見せ場を選び、渡されたメッセージに結び付けます。
2. **Visual style**が、Normal/Anime、NovelAI、Comic、Colored Manga、B&W Mangaのいずれかの画づくりを選びます。
3. **Animation addon**は、アニメーション付きの絵コンテのときだけ加わります。実現できる動作を1つ、カメラの挙動、本文に裏付けのあるセリフと効果音、環境音、終わりの静止を記述します。
4. **Output contract**が、プランナーの返すキーフレームの構造を定義します。

続いて**Storyboard Illustration Prompt**が、計画された最初のフレームをそれぞれ画像プロバイダー向けに整形します。クリップを有効にしている場合は、**Storyboard Video Prompt**が動きの計画を動画プロバイダー向けに整形します。

Roleplayのプロンプトライブラリーは、Gameのプランナーの一覧とは別物です。Roleplayの視覚スタイルを編集しても、Game Modeの静止画やアニメーションのプランナーは書き換わりません。

### StoryboardとIllustratorの併用

StoryboardはIllustratorとは別のエージェントです。Illustratorの手動操作やそのほかのIllustratorのメディアは、これまでどおり使えます。Roleplayの絵コンテを**Still images**か**Animations**にしていると、その完了した返信については、Marinaraが通常自動で作る前景のIllustrator画像を抑止します。2つのエージェントが返信後のメディアを重ねて作らないようにするためです。**Manual only**の場合、Illustratorの通常の動作はそのままです。

## Game Modeの絵コンテ

Game Modeの絵コンテは、完了したGMの語り1ターンだけを物語の元にします。隠されたGMコマンドタグを取り除き、順序の付いたフレームを計画し、各フレームをターン本文の該当する区間に結び付けます。ビューアーは、読み進めた位置に合わせてフレームを切り替えます。

### クイックスタート

1. Storyboardをインストールします。
2. Game Modeのチャットを作るか、既存のものを開きます。
3. **Chat Settings > Agents**を開き、**Enable Agents**をオンにしてから**Enable Storyboards**をオンにします。
4. そのGameに画像の接続があるか、全体のStoryboardの設定が画像の接続を用意しているかを確かめます。
5. GMの語りのターンを終わらせます。
6. **Gallery**を開いて**Create storyboard**を選びます。

閉じたGameのビューアーを開き直すには、Galleryで**View storyboard**を選びます。手動生成は現在のアニメーション設定に従うので、**Automatic Storyboard Animations**がオンなら、手動の絵コンテもクリップを要求します。

### Gameの絵コンテの自動生成

Storyboardカードには、自動生成のスイッチが2つあります。

- **Automatic Storyboard Illustrations**は、GMのターンが完了したあとに静止画のキーフレームを作ります。
- **Automatic Storyboard Animations**は、さらにキーフレームごとにクリップを作ります。アニメーションをオンにするとイラストも有効になり、イラストをオフにするとアニメーションも無効になります。

自動生成が動くのは、そのGameでStoryboardエージェントが有効なときだけです。すでに絵コンテのあるターンに対して、絵コンテを作り直すこともありません。直近のターンにもう1つ絵コンテが欲しいときは、Galleryの手動操作を使います。

Generationの設定で**Expose image prompts before sending**を有効にしていると、手動のGameの絵コンテでは、組み立て済みの画像プロンプトを確認できます。自動の絵コンテは確認のウィンドウを出さずに進むので、プレイが止まりません。

### Gameの設定

**Chat Settings > Agents > Storyboards**を開きます。

| 設定 | エージェントのデフォルト | 制御する内容 |
| --- | --- | --- |
| **Enable Storyboards** | チャットごとにOff | インストール済みのエージェントをこのGameで有効にします |
| **Automatic Storyboard Illustrations** | Automatic generationから決まります | GMのターンが終わるたびに静止画のキーフレームを作ります |
| **Automatic Storyboard Animations** | Automatic generationから決まります | キーフレームごとにMP4のクリップを作ります |
| **Keyframes per Turn** | 3(範囲は1から6) | 目標とするフレームの枚数。ターンが短いと枚数が減ることがあります |
| **Animation Clip Duration** | 5秒(範囲は1から15) | クリップ1本ごとに要求する長さ。プロバイダー側で短く丸められることがあります |
| **Viewer Display** | Floating | ドラッグできるビューアーか、Game全体の背景か |
| **Still Planner** | Still Keyframes | 完成した静止画のイラストを計画します |
| **Animation Planner** | Comic Page Animation | アニメーション向きの最初のフレームと動きの指示を計画します |
| **Use Storyboard Template** | On | 選んだ最終的なイラスト整形プロンプトを適用します |
| **Storyboard Illustration Prompt** | Game Scene Illustration | 計画されたフレームを画像プロバイダー向けに整形します |
| **Storyboard Video Prompt** | Cinematic Scene Video | 最初のフレームと動きの計画を動画プロバイダー向けに整形します |

パッケージには、NovelAI、コミック、漫画、アニメ、LTX向けのプランナーも入っています。アニメーションのプランナーを選んだだけでは動画生成は有効になりません。**Automatic Storyboard Animations**と動画の接続がやはり必要です。

### Gameのプロンプトの流れ

Game Modeは、静止画とアニメーションで別々のプランナーを使います。

```text
completed GM narration
  -> Still Planner or Animation Planner
  -> Storyboard Illustration Prompt
  -> image connection
  -> optional Storyboard Video Prompt
  -> video connection
```

見せ場を選び、順序を決めるのはプランナーです。イラストのプロンプトはプロバイダー向けの整形役であり、2つ目の物語プランナーではありません。アニメーションを有効にすると、アニメーションのプランナーは最初のフレームの正確な描写と動きの指示の両方を作ります。動画のプロンプトは、その動きの指示を最終的なリクエストに変えます。

### 改訂したGame Modeのレシピ

以下のレシピは、パッケージが適用する絵コンテの流れと、残りのGameおよびプロバイダーの設定を組み合わせたものです。パッケージにその名前の流れがあれば適用し、なければ一覧の選択内容を手動で再現します。

#### Googleでのコミック絵コンテ

パッケージが適用する流れは次のとおりです。

- **Illustration Planner**: Still Keyframes
- **Animation Planner**: Comic Page Animation
- **Storyboard Illustration Prompt**: Game Scene Illustration
- **Storyboard Video Prompt**: Comic Page Video
- **Use Storyboard Template**: On

Gameのチェックリストは次のとおりです。

- **Visual Generation**: On
- **Image Connection**: Google/Nano Banana
- **Image Style**: Default
- 初期設定で生成された画風はそのままにします。
- **Automatic Storyboard Illustrations**: On
- **Automatic Storyboard Animations**: Off
- **Keyframes per Turn**: 3
- **Video Connection**: None

これで通常の静止画の絵コンテを作れます。保存されたComic Pageのアニメーションの流れが働くのは、あとから動画の接続を選び、**Automatic Storyboard Animations**をオンにしたときだけです。

#### NovelAIへのタグの直接送信

パッケージが適用する流れは次のとおりです。

- **Illustration Planner**: NovelAI Keyframes
- **Storyboard Illustration Prompt**: プロンプト本文が次の内容だけの自作の選択肢を作ります。

  ```text
  ${scenePrompt}
  ```

- **Use Storyboard Template**: On
- Animation PlannerとStoryboard Video Promptは変更しません。

Gameのチェックリストは次のとおりです。

- **Image Style**: Danbooru
- **Use Campaign Art Style**: Off
- **Attach Card Appearance**: Off
- **Send Avatar References**: Off
- **Use NovelAI Character Prompts**: Off
- **Queue media generation requests**: On
- Danbooruのプロファイルから、文章形式の**Style Text**を削除します。
- ポジティブ、ネガティブ、イラストの各タグは必要に応じて調整します。

この自作のそのまま渡すテンプレートは、プランナーの作った簡潔なNovelAIのタグを、通常の文章形式のイラスト整形プロンプトで包まずに送ります。

#### ローカルのKrea 2 + LTX 2.3

パッケージが適用する流れは次のとおりです。

- **Illustration Planner**: Still Keyframes(静止画だけの場合の受け皿)
- **Animation Planner**: LTX Simple Image-to-Video
- **Storyboard Illustration Prompt**: Storyboard First Frame
- **Storyboard Video Prompt**: Narration Passthrough
- **Use Storyboard Template**: On

VRAMが8 GBのGPUでは、480pのキーフレーム1枚から始めます。それが問題なく完了したら、キーフレーム3枚やより高い解像度へ進めます。ComfyUIの接続、プレースホルダー、確認手順の全体は[Game ModeのLTX 2.3絵コンテ](ltx-2-3-storyboards.md)を参照してください。

### Storyboard Optimizedの演出とエージェントのスイッチは別物

Gameの設定ウィザードにある**Storyboard Optimized**の演出は、GMの語りのプロンプトを変えて、絵にしやすい視覚的な手がかりがターンに多く含まれるようにします。ただし、Storyboardのインストールや有効化、メディアの自動生成の有効化、画像と動画の接続の選択は行いません。

Storyboardエージェントは、StandardとStoryboard Optimizedのどちらの演出でも使えます。エージェントのインストールと有効化は別に行ってください。

### Gameのビューアー

**Floating viewer**は、Gameの上に浮かぶ、ドラッグとリサイズができるパネルです。GMの語りを読んでいる位置を追いかけ、対応するフレームを表示します。動画は用意できていれば再生し、そうでなければフレームの画像を表示します。

**Game background**は、現在のフレームをGameの操作要素の後ろに敷きます。このモードのあいだは通常生成するシーンの背景を置き換えるため、いつもの**Generate background**は使えません。背景のクリップは1回だけ再生し、最後のフレームで停止します。再生し直し、再生と一時停止、ミュートの操作はGameの操作要素から行えます。

フローティングのビューアーを閉じると、現在のターンのあいだだけ隠れます。開き直すには**Gallery > View storyboard**を使います。

## 画像プロンプトとキャラクターの一貫性

選んだプランナーと最終的な画像プロンプトは、役割が違います。

- プランナーは、どの瞬間を見せるかを決め、各フレームの視覚的な中身を書きます。
- 最終的な画像テンプレートは、プロバイダー向けの構成、該当するキャラクターの外見、参照画像の扱い、場所の状況、キャンペーンのアートディレクション、画像への指示を加えます。

プランナーが、画像プロバイダーへそのまま渡すべき形式のプロンプトをすでに返している場合は、`${scenePrompt}`のようなそのまま渡すテンプレートを使います。**Use the final image template**をオフにするのは、選んだ整形プロンプト自体を通さないと決めたときだけにしてください。必須の画像への指示はそれでも適用されます。

キャラクターを安定させるには、次の点に気を付けます。

- キャラクターカードのAppearance欄を具体的に書き、内容を最新に保ちます。
- 選んだプランナーが必要な外見の情報をすべて書き直している場合を除き、**Attach Card Appearance**はオンのままにします。
- プロバイダーが参照画像を受け取れて、アバターが狙いどおりの見た目なら、**Send Avatar References**はオンのままにします。
- 1フレームに登場させるキャラクターは人数を絞り、一人ひとりがはっきり見える状態にします。Storyboardが送る参照画像は、チャットのすべてのキャラクターではなく、その場面に映る該当のキャラクターとペルソナだけです。

**Use NovelAI character prompts**が変えるのは、対応する公式NovelAI V4/V4.5の接続で送るリクエストだけです。ほかのプロバイダーでは、スイッチをオンにしても共通のプロンプトの経路を使います。

## 費用と処理時間

キーフレーム1枚ごとに、画像ジョブが1件動きます。アニメーション付きの絵コンテでは、成功したキーフレーム1枚につき動画ジョブが1件増えます。3枚構成のアニメーション付きの絵コンテなら、画像のリクエストが3件、動画のリクエストが3件になります。

新しいプロバイダーやローカルのワークフローを試すときは、静止画とキーフレーム1枚から始めます。フレームの枚数、クリップの長さ、自動生成の頻度を増やすのは、基本の流れが安定してからにします。

## 旧来の絵コンテの仕組みで作った既存のGame

Storyboardは現在ダウンロードできるエージェントですが、既存のGameのチャットには、Engineに内蔵されていた旧来の絵コンテのUIで設定した値が残っていることがあります。パッケージをインストールすると、Marinaraはその値をチャットごとの上書きとして保持します。動いているGameの設定を捨てることはありません。

そのため、古いGameは現在のエージェントのデフォルトとは違う動きをすることがあります。ある欄をStoryboardエージェントのデフォルトに戻したいときは、**Chat Settings > Agents > Storyboards**を開いて、その欄のリセットボタンを使います。

古い設定は移行用のデータであり、2つ目の絵コンテの実装ではありません。現在の生成には、そのGameでStoryboardパッケージがインストールされ、有効になっていることが必要です。

## トラブルシューティング

### Chat SettingsにStoryboardが出てこない

- **Agents > Download Agents**から**Storyboard**をインストールします。
- RoleplayかGameのチャットで使います。Conversationは対象外です。
- パッケージのバージョンが、インストール済みのEngineのバージョンに対応しているか確かめます。

### Create storyboardは押せるのに生成が失敗する

- そのチャットで**Enable Agents**と**Enable Storyboards**をオンにします。
- RoleplayのStoryboardカード、Gameの設定、全体のStoryboardの設定のいずれかで、有効な画像生成の接続を選びます。
- AIかGMの返信が終わるのを待ってから、もう一度試します。

### Roleplayで自動のエピソードができない

- **Manual only**ではなく、**Still images**か**Animations**を選びます。
- 新しく完了したAIの返信を待ちます。チャットを開いても、古いメッセージをさかのぼって処理することはありません。
- **Messages per episode**を確かめます。前回成功した起点から、ユーザーとAIの新しいメッセージが必要な件数だけたまる必要があります。
- 失敗した実行では起点が進まないので、サーバーのログでプロバイダー側の元のエラーや解析エラーを調べます。

### 画像は出るのに動画が出ない

- Roleplayでは**Animations**を選びます。Game Modeでは**Automatic Storyboard Animations**をオンにします。
- Video Generationの接続を選びます。
- その動画の接続がimage-to-videoの入力に対応しているか確かめます。
- Galleryの**Videos**タブを確認します。クリップは、そのキーフレーム画像より遅れて仕上がることがあります。
- LLMの失敗で計画が代替の処理に切り替わった場合、Marinaraは代替の画像を残したまま、その実行の動画を省くことがあります。

### 絵コンテが途中までしかない、または止まったままになる

プロバイダーのジョブが1件以上、失敗したか、タイムアウトしたか、レート制限や内容の制限に当たっている可能性があります。プロバイダーが正常でも遅い場合は、`.env`の`IMAGE_GEN_TIMEOUT_MS`か`VIDEO_GEN_TIMEOUT_MS`の値を大きくしてから、Marinaraを再起動します。これらの値は起動時に読み込まれるためです。

プランナー、組み立て済みの画像プロンプト、参照画像の選択、動画のプロンプトを調べるには、Debugモードを有効にして、サーバーのログを`storyboard`で検索します。デバッグのログにはチャットの私的な本文やプロンプトが含まれることがあるので、共有する前に見せたくない部分を伏せてください。

## 関連ガイド

- [エージェント: チャットを支えるAIヘルパー](../agents/agents-overview.md)
- [ダウンロードできるエージェント一覧](../agents/built-in-agents.md)
- [Game Mode: はじめに](getting-started.md)
- [Roleplayモード: はじめに](../roleplay/getting-started.md)
- [画像生成プロバイダーと設定](../media/image-providers.md)
- [シーン動画の生成](../media/scene-video.md)
- [Game ModeのLTX 2.3絵コンテ](ltx-2-3-storyboards.md)
