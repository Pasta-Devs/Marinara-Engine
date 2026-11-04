# シーン動画の生成

シーン動画は、場面を映す短いMP4クリップです。Galleryの画像を開始フレームにして、AIが動きを加えることができます。Roleplayでは、物語だけから作ることもできます。このガイドでは、動画サービスの設定、GalleryとGame Modeからクリップを作る方法、動画の設定の変え方を説明します。

シーン動画は、RoleplayとGame Modeのチャットで使えます。Conversationのチャットでは、代わりに動画メッセージが送られます。[動画メッセージ](../conversation/selfies.md#video-messages)を参照してください。

Game Modeと**Animate illustration**は必ず画像から始まるため、先に画像を生成するかアップロードしてください。Roleplayの`/video`とGalleryの**Video**ボタンは、Illustratorの**First frame**(開始フレーム)設定に従います。First frameを選んでいなければ、画像は必要ありません。

シーン動画は、通常の画像生成ではなく、**Video Generation**(動画生成)という別の種類のアカウントを使います。完成したクリップはチャットとともに保存され、Galleryに表示されます。Galleryでは、ピン留め、ダウンロード、再生ができます。

## 動画サービスを設定する

1. 上部バーの**Connections**(接続)をクリックし、続いて**Add**(追加)をクリックします。**Add account**(アカウントの追加)ウィンドウが開きます。
2. **Images & video**(画像と動画)のセクションから、サービスを選びます。サービスの一覧は下にあります。
3. クラウドサービスの場合は、APIキーを貼り付けます。ローカルのComfyUIには不要です。SwarmUIでは、サーバーでアカウントが必要な場合にだけSwarm Auth Tokenが要ります。
4. **Connect**(接続)をクリックし、モデルを選ぶか、デフォルトのままにします。NanoGPTにはデフォルトがないため、一覧から1つ選んでください。ComfyUIでは、ワークフローが`%model%`を使っていないかぎり、モデルは未設定のままにします。SwarmUIでは、モデルは任意です。
5. 動画モデルを開き、**Test video**(動画をテスト)をクリックして確認します。

各サービスは、デフォルトのアドレスと、該当する場合はデフォルトのモデルを自動で入力します。NanoGPTにはデフォルトのモデルがないため、1つ選んでください。

| 動画サービス | デフォルトのモデル | 備考 |
| --- | --- | --- |
| **Google AI Studio** | `gemini-omni-flash-preview` | Gemini API経由でGemini OmniとVeoのモデルを実行します。 |
| **xAI Imagine** | `grok-imagine-video-1.5` | xAI Videos API経由のGrok Imagine動画です。 |
| **OpenRouter Video** | `google/veo-3.1` | OpenRouterの動画モデルIDを自由に入力できます。 |
| **NanoGPT** | なし、自分で選ぶ | NanoGPT経由の動画モデルです。 |
| **Atlas Cloud** | `google/veo3.1/text-to-video` | ホストされた、テキストから動画、画像から動画のモデルです。 |
| **Seedance 2.0** | `seedance-2-0` | テキスト、最初のフレーム、最初と最後のフレームの各モードに対応します。 |
| **ComfyUI** | ワークフローで指定 | ローカルのWANなど、API形式の動画ワークフローです。 |
| **SwarmUI** | ワークフローで指定 | SwarmUIサーバー経由で実行するComfyUIの動画ワークフローです。 |

**Google AI Studio**は2つのファミリーを扱います。**Gemini Omni**は`gemini-omni-flash-preview`を、**Google Veo**は`veo-3.1-generate-preview`を使います。どちらが動くかは、選んだモデルで決まります。

**ComfyUI**では`http://127.0.0.1:8188`を使い、API形式の動画ワークフローを**ComfyUI workflow (required)**(ComfyUIワークフロー、必須)に貼り付けます。これは必須です。プレースホルダーと出力ノードについては、[ComfyUIワークフローの設定](comfyui.md#comfyui-video-workflows)を参照してください。

**SwarmUI**では、Marinaraが`http://127.0.0.1:7801`を入力します。API形式の動画ワークフローを**ComfyUI workflow (required)**に貼り付けます。これは必須です。SwarmUIでは`%reference_image_name%`のプレースホルダーを使えないため、`%reference_image%`を使ってください。サーバーでアカウントが必要な場合は、**API key**(APIキー)にSwarm Auth Tokenを貼り付けます。

### デフォルトの動画モデルにする

チャットに独自の動画モデルがないときに使う動画モデルを決めるには、**Connections**(接続)パネル上部の**Defaults**(デフォルト)にある**Video**(動画)の役割を設定します。Chat Settingsでは、これが**Default video provider**と表示されます。チャットのモデルもデフォルトもない場合、動画の操作時にモデルを選ぶよう警告が表示されます。

### Video prompting instructions

各動画モデルには、**Video prompting instructions**(動画プロンプトの作成指示)欄があります。動画のプロンプトを書くAIに、カメラの動き、プロンプトの長さ、音など、使う動画モデルが求めるものを伝えます。この指示は、RoleplayのGalleryのアニメーション、Conversationの動画メッセージ、Storyboardの**Image-aware shot planning**(画像を考慮したショット計画)に使われます。AIがこの欄の文をまるごとプロンプトに写した場合、Marinaraはその文を取り除きます。Game Modeのシーン動画、通話のクリップ、アニメーション表情はプロンプトを別に作るため、この指示を無視します。

### モデルごとの動画デフォルト

動画モデルには、クリップのデフォルトの長さ、アスペクト比、解像度を設定する**Video defaults**(動画のデフォルト設定)パネルがあります。これらは、アプリ全体のフォールバックの長さより優先されます。

サービスごとのデフォルトの長さ、範囲、アスペクト比、解像度は次のとおりです。

- Gemini Omni: 10秒、1秒から60秒、16:9、プロバイダーのデフォルトの解像度
- Google Veo: 8秒、4秒か6秒か8秒、16:9、720p
- xAI Imagine: 10秒、1秒から15秒、16:9、720p
- OpenRouter Video: 10秒、1秒から60秒、16:9、720p
- Atlas Cloud: 8秒、1秒から60秒、16:9、720p
- Seedance 2.0: 5秒、4秒から15秒、16:9、720p
- ComfyUIとSwarmUI: 5秒、1秒から60秒、16:9、720p

Gemini Omniには解像度の欄がなく、長さはプロンプトの文章に書き込まれます。Google Veoは、参照画像を動かすときに必ず8秒になります。最初と最後のフレームをつなぐのに8秒必要だからです。

<a id="seedance-reference-frames"></a>

### Seedanceの参照フレーム

Seedanceは、公開Webリンク経由で参照画像を取得する必要があります。ローカルのMarinaraサーバーには公開リンクがないため、そのままのローカル環境ではもう1手順必要です。

1. Seedanceのモデルを開きます。
2. **Upload Seedance reference frames temporarily**(Seedanceの参照フレームを一時的にアップロードする)をオンにします。フレームは一時的な公開リンクにアップロードされます。
3. 任意: **Temporary link lifetime**(一時リンクの有効期間)を設定します。デフォルトは12時間です。

Marinaraサーバーにすでに公開アドレスがある場合は、代わりに環境変数を設定できます。[サーバー設定リファレンス](../CONFIGURATION.md)を参照してください。

## Galleryから動画を作る

RoleplayとGame Modeのチャットでは、Galleryからシーン動画を作れます。**Chat Settings**(チャット設定)を開き、**Gallery**(ギャラリー)を展開してください。Galleryには**Images**タブと**Videos**タブがあり、それぞれ件数が表示されます。

### Roleplayの場合

Gallery上部の操作列にある**Video**は、`/video`と同じく、最新の返信のクリップを作ります。何を映すか指定するには、`/video`の後に説明を加えてください。

- **First frame**(開始フレーム): Illustratorの**First frame**設定に従います。最新の返信を描いた新しいIllustrator画像(先に描いてから動かします)、キャラクターのアバターやスプライト、または画像なしのいずれかです。何も選んでいなければ、物語だけからクリップを作ります。
- **アバター**: 説明の中で最初に名前を挙げた人物から始まります。ペルソナも対象です。ほかの人と重ならない名前の一部を、先頭を大文字にして書けば十分です(「Dr. Lena Kowalski」に対する「Lena」など)。名前を挙げなければ、チャットのキャラクターから始まります。
- **確認**: **Expose media prompts before sending**(送信前にメディアのプロンプトを表示)がオンなら、先にクリップのプロンプトを確認して編集できます。
- **文脈**: AIは、Illustratorが画像を作るときと同じ件数の最近のメッセージを読みます(Illustratorの設定画面の**Agent Budget**(エージェントの予算)にある**Context Size**(コンテキストサイズ))。
- **画像なし**: 画像なし、またはアバターから始まるクリップでは、AIが場面自体を描写します。その指示は、**Settings → Generations → Video Generation Prompt Overrides**(設定 → 生成 → 動画生成プロンプトの上書き)の**Roleplay Clip Director**(Roleplayクリップの演出)です。

完成したクリップは、画像がそれより前の返信のものでも、最新の返信の下でその場で再生されます。クリップが自動でフローティングウィンドウに開くことはありません。フローティング表示にするには、**Videos**の**Pin video to chat**(動画をチャットにピン留め)を使います。メッセージからクリップを外すには、その**X**ボタンを使います。外したクリップはGalleryに残ります。

### Game Modeの場合

1. **Images**に画像が1枚以上あることを確かめます。**Illustrate**を使うか、画像をアップロードします。
2. Gallery上部の操作列で**Video**をクリックします。
3. **Settings → Generations → Overall Generations**(設定 → 生成 → 生成全般)で**Expose media prompts before sending**(送信前にメディアのプロンプトを表示)がオンになっている場合は、プロンプトを確認または編集し、**Generate**をクリックします。キャンセルした場合、リクエストは送られません。
4. ボタンが**Generating...**になり、動画生成が進行中であることを知らせるバナーが出ます。
5. 完成すると、クリップが**Videos**に表示されます。

画像がない場合、Marinaraは「Add or generate a gallery image before generating a scene video.」と表示します。画像を作るかアップロードしてから、もう一度試してください。

### 1枚の画像を動かす

1. **Images**タブを開きます。
2. 画像にカーソルを合わせます。
3. **Animate illustration**ボタン(フィルムのアイコン)をクリックします。

プロンプトの確認がオンの場合、その画像に使われる、組み立て済みのプロンプト、長さ、アスペクト比、解像度が、そのままウィンドウに表示されます。ここでの編集は、そのクリップにだけ適用されます。Roleplayでは、動きを計画するAIが、Illustratorと同じ件数の最近のメッセージを読みます。読み取る範囲は、その画像が属する返信で終わります。繰り返し使うその指示は、**Settings → Generations → Video Generation Prompt Overrides**(設定 → 生成 → 動画生成プロンプトの上書き)の**Roleplay Gallery Animation Director**です。

**Videos**の各クリップはその場で再生され、長さとモデル名が表示されます。**Pin video to chat**(動画をチャットにピン留め)か**Download scene video**(シーン動画をダウンロード)を使えます。クリップがない場合、タブには**No videos yet**と表示されます。

## サービスを選ぶ

8つのサービスはいずれも、画像から短いクリップを作ります。

- **Google AI Studio (Gemini Omni)**: 最長60秒。長さはプロンプトに書き込まれます。
- **Google AI Studio (Veo)**: 品質が高く、長さは4秒、6秒、8秒のいずれかに固定されます。画像を動かすときは8秒を使います。
- **xAI Imagine**: 1秒から15秒。プロンプトの上限がほかより短めです。
- **OpenRouter Video**: 1秒から60秒。自分のアカウントで使える動画モデルを自由に使えます。
- **NanoGPT**: 1秒から60秒。デフォルトのモデルはありません。
- **Atlas Cloud**: Atlas Cloudの最新の動画カタログを読み込み、画像から動画のモデルを先に表示します。各モデルには、出力1秒あたりの開始価格が表示されます。読み込めない場合、MarinaraはVeo 3.1とSeedance 2.0の初期モデルを表示します。正確なモデルIDを入力することもできます。モデルの制限は引き続き適用されます。
- **Seedance 2.0**: 4秒から15秒。最初のフレームのモードと、最初と最後のフレームのモードがあります。参照画像への公開リンクが必要です。
- **ComfyUI**: API形式のワークフローによるローカル生成です。ワークフローが`%reference_image_name%`を使っている場合、Marinaraは参照画像を直接アップロードします。
- **SwarmUI**: ワークフローとSwarmUIサーバーによるローカル生成です。参照画像は`%reference_image%`で渡します。

動画の処理には時間がかかります。サービスが処理を開始し、Marinaraはクリップが完成するまで待って状態を確認します。1本に数分かかることもあります。大きなローカルのWANモデルでは、デフォルトの30分では足りない場合があります。`VIDEO_GEN_TIMEOUT_MS`の値を上げ、Marinaraを再起動してください。

### Atlas Cloudのモデルごとの違い

Atlas Cloudのモデルが受け付ける設定は一律ではありません。Marinaraはリクエストごとに、`static.atlascloud.ai`で公開されているモデルの入力スキーマを読み込み、デフォルト設定をそれに合わせます。

- 元の画像は、そのモデルが使う画像フィールドに送られます。
- クリップの長さは、モデルが対応する長さのうち最も近い値に変わります。5秒または10秒だけに対応するモデルでは、デフォルトの8秒は10秒になります。
- 解像度は、モデルが対応する段階のうち最も近いものに変わります。ピクセル単位のサイズを受け付けるモデルには、アスペクト比と解像度に最も近い`width*height`が送られます。
- モデルにない設定は省かれ、モデルのデフォルトが使われます。

変更された値はすべて、サーバーログの`[video-gen/atlas-cloud] fitted request`で始まる行に記録されます。スキーマを読み取れない場合、Marinaraは従来と同じ汎用リクエストを送ります。

シーン動画には、画像から動画のモデルを選んでください。テキストから動画のモデルには、画像フィールドがありません。画像を無視してプロンプトから無関係なクリップを作り、そのことがサーバーログに記録されます。モデルが画像を必要とする場合、**Test video**(動画をテスト)は単純なグラデーションを最初のフレームとして送るため、画像から動画のモデルもテストに合格できます。

多くのAtlas Cloudモデルには、`negative_prompt`、`seed`、`generate_audio`、`shot_type`、`enable_prompt_expansion`、LoRAリストなどの独自の入力があります。

1. Atlas Cloudのモデルを開き、モデルを選ぶか入力します。
2. **Video defaults**(動画のデフォルト設定)を展開し、続いて**Atlas Cloud setup**(Atlas Cloudの設定)を展開します。
3. 長さ、アスペクト比、解像度の項目の下にある**Model options**(モデルオプション)を探します。

**Model options**の上部には、モデルが受け付ける長さ、解像度、フレームサイズ、アスペクト比が一覧表示されます。テキストから動画のモデルでは、警告も表示されます。各オプションにはAtlas Cloud自身の名前と説明が使われ、最初は**Model default**(モデルのデフォルト)で、デフォルト値が括弧内に表示されます。**Model default**のままのオプションは送信されません。変更すると、**Test video**を含め、このモデルで作るすべての動画にその値が送られます。LoRAなどのリストやオブジェクトの入力には、JSONを使います。

選択内容はモデルごとに保存されます。**Reset model options**(モデルオプションをリセット)は、現在のモデルの選択内容を消去します。変更を保持するには、**Save**(保存)をクリックします。保存済みのオプションがモデルに合わなくなった場合、Marinaraはそのオプションを送信せず、ログ行にその名前を記録します。

## Game Assetsで動画を作る

Game Modeには、シーン動画を作る2つ目の場所として**Game Assets**(ゲームアセット)があります。チャットの右上付近にあるフォルダーボタンをクリックしてください。コンピューターではウィンドウ、スマートフォンでは画面幅いっぱいのパネルとして開きます。Chat Settingsに移した場合は、そこの**Game Assets**セクションを開いてください。

1. **Game Assets**を開きます。
2. **Generate video**(「Generate a scene video from the latest illustration」)をクリックします。
3. 完成すると、いちばん新しいクリップがそこで再生されます。

**Generate video**は、ゲームに動画モデルとシーンのイラストの両方がそろうまで押せません。早すぎるタイミングでクリックすると、「Choose a Video Generation connection in Game Settings first.」(ゲームに動画モデルを設定してください)や、「Generate a scene illustration before generating a scene video.」と表示されることがあります。クリップの生成に失敗すると、パネルに「Scene video generation failed.」と表示されます。もう一度試し、それでも失敗が続く場合はキーを確認してください。

## チャットで使う動画モデルを選ぶ

動画モデルは、チャットごとに**Chat Settings → Agents → Scene Videos**(チャット設定 → エージェント → シーン動画)で選びます。

- **Roleplay**では、**Scene Videos**カード(「Generate manual MP4 scene videos from gallery images」)が表示されます。操作は、動画モデルの一覧の1つだけです。
- **Game Mode**では、操作の多い**Scene Videos**カード(「Generate MP4 scene videos from game illustrations」)が表示されます。動画モデルの一覧でモデルを選びます。**Game Video Prompt**は、画像をどう動かすかを決めるテンプレートです。組み込みのデフォルトは**Cinematic Scene Video**です。**Edit Video Prompt Presets**では、このチャット用に自分のコピーを追加したり編集したりします。

**Game Video Prompt**は、Game ModeでGalleryとGame Assetsから手動で作る動画に適用されます。RoleplayのGalleryのアニメーションでは、代わりに**Roleplay Gallery Animation Director**を使います。Storyboardエージェントは、独自のデフォルトの**Storyboard Video Prompt**を持ちます。チャットごとに、**Chat Settings → Agents → Storyboards**(チャット設定 → エージェント → 絵コンテ)で上書きできます。リセットすると、Storyboardエージェントのデフォルトに戻ります。

Game Modeのチャットを作成するとき、ビジュアル生成をオンにすると、設定ウィザードの**Features**ステップに動画モデルの選択欄が表示されます。

## 動画生成の設定

動画のデフォルトの一部は、アプリ全体の設定です。**Settings → Generations**(設定 → 生成)を開き、**Video Generation**(「Set default clip lengths and edit reusable video prompts for Game, Gallery, and Calls」)を探します。

- **Scene video fallback length**: 選んだ動画モデルに独自の長さがない場合にだけ使われます。デフォルトは10秒です。範囲は1から60です。
- **Video Generation Prompt Overrides**: 繰り返し使う動画プロンプトのテンプレートを編集します。**Roleplay Gallery Animation Director**は、RoleplayのGalleryのクリップを作る前にPrompt Modelへ送る指示を決めます。その`${durationSeconds}`変数は、クリップの長さに置き換わります。
- **Videos per reply**(返信ごとの動画数): Conversationのキャラクターが1返信で送れる動画メッセージの数と、IllustratorがRoleplayの1返信に追加するクリップの数です。デフォルトは3です。範囲は1から10です。Conversationの各キャラクターが送るのは最大1本です。グループチャットや、複数の動画をまとめて頼むときのための設定です。値を増やすと、より多くのキャラクターがクリップを送れます。値を下げると、リクエストを節約できます。上限を超えるクリップはスキップされます。`/video`とGalleryの**Video**ボタンは、数に含まれません。
- **Animated expression length**は、アニメーションする立ち絵スプライトの設定です。[アニメーション表情](animated-expressions.md)を参照してください。

## 絵コンテ

ダウンロードして使うStoryboardエージェントは、RoleplayとGame Modeで、順番に並んだキーフレーム画像とクリップを作ります。アニメーションがオンの場合、Marinaraは選んだ動画モデルとエージェントの**Storyboard Video Prompt**を使って、成功した各キーフレームを動かします。[Storyboardエージェントガイド](../game/storyboard.md)を参照してください。

## トラブルシューティング

### 「Choose a Video Generation connection」と表示される

チャットに動画モデルがありません。**Chat Settings → Agents → Scene Videos**(チャット設定 → エージェント → シーン動画)を開いて選んでください。一覧が空の場合は、**Connections**(接続)で追加します。

### 「Add or generate a gallery image before generating a scene video」と表示される

Game Modeと**Animate illustration**には、既存の画像が必要です。Roleplayでは、開始フレームを選んでいなければ、物語だけからクリップを作れます。**Illustrate**を使うか、画像をアップロードするか、手持ちの画像で**Animate illustration**をクリックしてください。

### 動画の生成に時間がかかる

これは正常です。Google、xAI、OpenRouter、NanoGPT、Atlas Cloud、Seedanceはいずれも処理を開始し、Marinaraがその完了を待ちます。1本に数分かかることがあります。

### Seedanceが参照画像を読み取れない

Seedanceには、画像への公開リンクが必要です。ローカルサーバーの場合は、Seedanceのモデルで**Upload Seedance reference frames temporarily**(Seedanceの参照フレームを一時的にアップロードする)をオンにします。[Seedanceの参照フレーム](#seedance-reference-frames)を参照してください。

### 動画のリクエストが失敗し続ける

アカウントに有効なAPIキーが設定されていること、動画機能が使えることを確かめてください。**Connections**(接続)でアカウントを開き、キーとモデルを確認します。サーバーのタイムアウトについては、[サーバー設定リファレンス](../CONFIGURATION.md)を参照してください。

## 関連ガイド

- [アニメーション表情](animated-expressions.md)
- [Storyboardエージェントガイド](../game/storyboard.md)
- [Game ModeのLTX 2.3絵コンテ](../game/ltx-2-3-storyboards.md)
- [対応しているAIプロバイダー](../connections/providers-reference.md)
- [サーバー設定リファレンス](../CONFIGURATION.md)
