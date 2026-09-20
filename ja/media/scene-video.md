# シーン動画の生成

このガイドでは、Marinara Engineがシーンのイラストを短いMP4動画クリップに変換する仕組みを説明します。動画のプロバイダー、Galleryからクリップを生成する手順、Game Modeでの操作、動画関連の設定を取り上げます。シーン動画とは、1枚の静止画から作る短いアニメーションクリップです。

## シーン動画でできること

シーン動画は、ギャラリーにある既存の画像を短いMP4クリップとして動かします。静止画が最初のフレームになり、そこにAIが動きを加えます。シーン動画は**Roleplay**と**Game Mode**のチャットで使えます。

先に画像が必ず必要です。シーン動画の生成はテキストだけでは実行できません。動かす前に、ギャラリーの画像を生成するかアップロードしておきます。

シーン動画は**Video Generation**(動画生成)という専用の接続タイプを使います。通常の画像生成とは別物です。完成したクリップはチャットとともに保存され、Galleryに表示されます。Galleryではピン留め、ダウンロード、再生ができます。

## Video Generationの接続

シーン動画を作るには、まず動画を生成できる接続を追加します。チャットや画像生成の接続と同じConnectionsパネルを使います。

1. **Settings**(設定)を開き、**Connections**(接続)を開きます。
2. **Add Connection**(接続の追加)をクリックします。
3. プロバイダーの種類を**Video Generation**にします。
4. **Video Service**(動画サービス)で、下の6つのサービスから1つを選びます。
5. クラウドサービスの場合はAPIキーを入力します。ローカルのComfyUIには不要です。
6. クラウドサービスではモデルを選ぶか、プロバイダーのデフォルトのままにします。ComfyUIでは、ワークフローが`%model%`を使っていないかぎりモデルは未設定のままにします。
7. 接続を保存します。

**Video Service**の選択肢は6つです。それぞれデフォルトのWebアドレスと、該当する場合はデフォルトのモデルが自動で入ります。

| Video Service        | デフォルトのモデル                | 備考                                                                          |
| -------------------- | --------------------------------- | ---------------------------------------------------------------------------- |
| **Google AI Studio** | `gemini-omni-flash-preview`       | Gemini API経由でGemini OmniとVeoの動画モデルを実行します。                     |
| **xAI Imagine**      | `grok-imagine-video-1.5`          | xAI Videos API経由のGrok Imagine動画です。                                     |
| **OpenRouter Video** | `google/veo-3.1`                  | OpenRouter経由の動画モデルです。OpenRouterの動画モデルIDを自由に入力できます。 |
| **Atlas Cloud**      | `google/veo3.1/text-to-video`     | Atlas Cloudでホストされるテキストから動画、画像から動画のモデルです。          |
| **Seedance 2.0**     | `seedance-2-0`                    | テキスト、最初のフレーム、最初と最後のフレームの各モードに対応します。          |
| **ComfyUI**          | ワークフローで指定                | ローカルのWANなど、API形式で書き出した動画ワークフローです。                   |

**Google AI Studio**は2つのモデルファミリーを扱います。**Gemini Omni**は`gemini-omni-flash-preview`を使います。**Google Veo**は`veo-3.1-generate-preview`を使います。どちらが動くかは、接続で選んだモデルによって決まります。

**ComfyUI**では、ローカルアドレスの`http://127.0.0.1:8188`を使い、API形式の動画ワークフローを**ComfyUI Workflow**(ComfyUIワークフロー)に貼り付けます。ワークフローは必須です。プレースホルダーと出力ノードの要件については[ComfyUIワークフローの設定](comfyui.md#comfyui-video-workflows)を参照してください。

### デフォルトの動画接続にする

Video Generationの接続エディターには**Default for Videos**(動画のデフォルト)というグループがあります。**Use as default video connection**(デフォルトの動画接続として使う)をオンにすると、動画接続が個別に設定されていないチャットでもMarinaraがこの接続を使えます。デフォルトの動画接続に指定するのは1つだけにしてください。

### 接続ごとの動画デフォルト

Video Generationの接続には、接続エディター内に専用の**Video Generation Defaults**(動画生成のデフォルト)パネルがあります。ここでは、その接続で使うクリップの長さ、アスペクト比、解像度のデフォルトを設定します。接続ごとのこの設定は、アプリ全体のフォールバックの長さより優先されます。

| サービス         | デフォルトの長さ | 長さの範囲     | アスペクト比 | 解像度                 |
| ---------------- | -------------- | ------------ | ------------ | ---------------- |
| Gemini Omni      | 10秒           | 1秒から60秒     | 16:9         | プロバイダーのデフォルト |
| Google Veo       | 8秒            | 4秒、6秒、8秒  | 16:9         | 720p             |
| xAI Imagine      | 10秒           | 1秒から15秒     | 16:9         | 720p             |
| OpenRouter Video | 10秒           | 1秒から60秒     | 16:9         | 720p             |
| Atlas Cloud      | 8秒            | 1秒から60秒     | 16:9         | 720p             |
| Seedance 2.0     | 5秒            | 4秒から15秒     | 16:9         | 720p             |
| ComfyUI          | 5秒            | 1秒から60秒     | 16:9         | 720p             |

Gemini Omniには解像度の欄がなく、長さも独立した設定ではなくプロンプトの文章に書き込まれます。Google Veoは参照画像を動かすときに必ず8秒になります。最初と最後のフレームをつなぐのに8秒必要だからです。

### Seedanceの参照フレーム

Seedanceは、参照画像を動かす前に公開Webリンク経由でその画像を取得する必要があります。ローカルのMarinaraサーバーには公開リンクがないため、そのままのローカル環境ではもう1手順必要です。

Seedanceの接続を開き、**Upload Seedance reference frames temporarily**(Seedanceの参照フレームを一時的にアップロードする)をオンにします。これで参照フレームが一時的な公開リンクにアップロードされ、Seedanceから読み取れるようになります。リンクの有効期間は**Temporary link lifetime**(一時リンクの有効期間)で選べます。デフォルトは12時間です。

Marinaraサーバーにすでに公開Webアドレスがある場合は、一時アップロードの代わりに環境変数を設定できます。動画の参照に関する設定は[サーバー設定リファレンス](../CONFIGURATION.md)を参照してください。

## プロバイダーの選び方

6つのサービスはいずれも画像から短いクリップを作ります。違いは速度、クリップの長さ、参照画像の扱い方です。

- **Google AI Studio (Gemini Omni)**: 最長60秒まで長さを自由に指定できます。長さは独立した設定ではなくプロンプトに埋め込まれます。
- **Google AI Studio (Veo)**: 品質が高い一方、長さは4秒、6秒、8秒に固定されます。画像を動かすときは8秒になります。
- **xAI Imagine**: 1秒から15秒のクリップを作ります。プロンプトの上限が他のサービスより短めです。
- **OpenRouter Video**: 1秒から60秒に対応し、OpenRouterのアカウントで使える動画モデルを自由に入力できます。
- **Atlas Cloud**: **Fetch Models**（モデルを取得）は最新の動画モデル一覧を読み込み、画像から動画のモデルを先に表示します。各モデルには出力動画 1 秒あたりの開始価格が表示されます。一覧を取得できない場合は、Veo 3.1 と Seedance 2.0 の初期モデルを表示します。Atlas Cloud の動画モデル ID を正確に直接入力することもできます。モデル固有の長さ、解像度、参照画像の制限は引き続き適用されます。
- **Seedance 2.0**: 4秒から15秒のクリップを作り、最初のフレーム、最初と最後のフレームのモードがあります。参照画像への公開リンクが必要です。
- **ComfyUI**: 自分で用意したAPI形式のワークフローによるローカル生成です。ワークフローが`%reference_image_name%`を使っている場合、Marinaraは参照画像をComfyUIへ直接アップロードします。

動画の処理には時間がかかります。プロバイダーが処理を開始し、Marinaraはクリップが完成するまで待って状態を確認し続けます。1本あたり数分かかることもあり、静止画より長くなります。大きなローカルのWANモデルではデフォルトの30分では足りない場合があります。必要に応じて`VIDEO_GEN_TIMEOUT_MS`の値を上げ、Marinaraを再起動してください。

### Atlas Cloud のモデルごとの違い

Atlas Cloud のモデルが受け付ける設定は一律ではありません。Marinara はリクエストごとに `static.atlascloud.ai` から公開された入力スキーマを読み込み、接続のデフォルト設定を調整します。

- 元のイラストは、そのモデルが使う画像フィールドに送信されます。
- クリップの長さは、対応する長さのうち最も近い値に変わります。5 秒または 10 秒だけに対応するモデルでは、デフォルトの 8 秒は 10 秒になります。
- 解像度は、対応する段階のうち最も近いものに変わります。ピクセル単位のサイズを受け付けるモデルには、アスペクト比と解像度に最も近い `width*height` が送られます。
- モデルにない設定は省かれ、モデル側のデフォルトが使われます。

変更した値は、サーバーログの `[video-gen/atlas-cloud] fitted request` で始まる行に記録されます。スキーマを読み取れない場合、Marinara は従来と同じ汎用リクエストを送信します。

シーン動画には **image-to-video**（画像から動画）モデルを選んでください。テキストから動画のモデルには画像フィールドがないため、イラストを無視し、プロンプトだけから別のクリップを生成します。この場合はサーバーログにも記録されます。

選択した Atlas Cloud モデルが画像を必須とする場合、**Test Video**（動画をテスト）は単純なグラデーションを最初のフレームとして送信します。これにより、画像から動画のモデルでも接続テストを実行できます。

### Atlas Cloud のモデルオプション

多くの Atlas Cloud モデルには、`negative_prompt`、`seed`、`generate_audio`、`shot_type`、`enable_prompt_expansion`、LoRA リストなどの独自の入力があります。接続エディターは選択したモデルの入力を表示します。

1. Atlas Cloud の接続を開き、モデルを選択するか入力します。
2. **Video Defaults**（動画のデフォルト設定）、続いて **Atlas Cloud setup**（Atlas Cloud の設定）を開きます。
3. 長さ、アスペクト比、解像度の下にある **Model options**（モデルオプション）を確認します。

**Model options** の上部には、モデルが対応する長さ、解像度、フレームサイズ、アスペクト比が表示されます。テキストから動画のモデルでは、ギャラリー画像を使えないため、ここに警告も表示されます。

各オプションの名前と説明は Atlas Cloud の表記のままです。すべてのオプションは **Model default**（モデルのデフォルト）から始まり、プロバイダーのデフォルト値が括弧内に表示されます。**Model default** のままのオプションは送信されず、Atlas Cloud が値を決めます。変更した値は、この接続で作るすべての動画に送信され、**Test Video** にも適用されます。LoRA などのリストやオブジェクトの入力には JSON を使います。

選択内容はモデルごとに保存されます。別のモデルに切り替えて戻っても、それぞれの設定が保持されます。**Reset model options**（モデルオプションをリセット）は現在のモデルの選択内容を消去します。変更を保存するには、接続の **Save**（保存）をクリックしてください。

Atlas Cloud による入力仕様の変更などで保存済みのオプションがモデルに合わなくなった場合、Marinara はそのオプションを送信せず、`[video-gen/atlas-cloud] fitted request` のログ行に名前を記録します。

## Galleryから動画を生成する

**Roleplay**と**Game Mode**のどちらのチャットでも、**Gallery**(ギャラリー)パネルからシーン動画を作れます。パネルはチャットの画像アイコンまたはギャラリーアイコンから開きます。Game Modeのチャットには、このガイドの後半で説明する**Game Assets**パネルという2つ目の入口もあります。

Galleryには**Images**タブと**Videos**タブがあり、それぞれ件数が表示されます。静止画は**Images**に、完成したクリップは**Videos**に入ります。

いちばん新しい画像を動かす手順は次のとおりです。

1. **Images**タブに画像が1枚以上あることを確かめます。まず**Illustrate**を使うか、画像をアップロードします。
2. Galleryの上部にある操作列で**Video**をクリックします。
3. **Settings**、**Generations**、**Overall Generations**の下で**Expose media prompts before sending**が有効になっている場合は、組み立てられたアニメーション用のプロンプトを確認または編集し、**Generate**をクリックします。このウィンドウをキャンセルした場合、プロバイダーへのリクエストは発生しません。
4. ボタンの表示が**Generating...**に変わり、動画生成が進行中であることを知らせるバナーが出ます。
5. 完成すると、クリップが**Videos**タブに表示されます。

いちばん新しい画像ではなく、特定の画像を動かす手順は次のとおりです。

1. **Images**タブを開きます。
2. 動かしたい画像にカーソルを合わせます。
3. ホバー時の操作から**Animate illustration**ボタン(フィルムのアイコン)をクリックします。

プロンプトの確認が有効な場合、**Animate illustration**でも同じ**Review Video Prompt**ウィンドウが開きます。そこには、選んだ画像に実際に使われる、サーバーで組み立てられたプロンプト、長さ、アスペクト比、解像度が表示されます。ここでの編集はその生成にだけ適用されます。Roleplayでは、このプロンプトのもとになる繰り返し使う指示を、**Settings**、**Generations**、**Video Generation Prompt Overrides**にある**Roleplay Gallery Animation Director**で個別に管理します。

**Videos**タブでは、各クリップがその場で再生され、長さとモデル名が表示されます。**Pin video to chat**でクリップをピン留めしたり、**Download scene video**で保存したりできます。クリップがまだない場合、タブには**No videos yet**と表示されます。

チャットに画像がない状態で動画を作ろうとすると、Marinaraは「Add or generate a gallery image before generating a scene video.」というメッセージを表示します。先に画像を生成するかアップロードしてから、もう一度試してください。

## Game Modeのシーン動画

Game Modeには、シーン動画を作る2つ目の場所として**Game Assets**(ゲームアセット)パネルがあります。ゲームの操作にある**Game Assets**ボタンから開きます。

1. **Game Assets**パネルを開きます。
2. **Generate video**をクリックします。ツールチップには「Generate a scene video from the latest illustration.」と表示されます。
3. 完成すると、いちばん新しいクリップがパネル内で再生されます。

**Generate video**ボタンは、ゲームに動画接続とシーンのイラストの両方がそろうまで押せません。早すぎるタイミングでクリックすると、次のいずれかのメッセージが出ることがあります。

- 「Choose a Video Generation connection in Game Settings first.」ゲームに動画接続を設定してください。
- 「Generate a scene illustration before generating a scene video.」先に画像を作ってください。

クリップの生成に失敗すると、パネルに「Scene video generation failed.」と表示されます。もう一度試し、それでも失敗が続く場合は接続とAPIキーを確認してください。

## チャットで使う動画接続を選ぶ

動画接続はチャットごとに選びます。**Chat Settings**(チャット設定)、**Agents**、**Scene Videos**の順に開いて設定します。

**Roleplay**のチャットには「Generate manual MP4 scene videos from gallery images.」と説明された**Scene Videos**カードが表示されます。操作は1つだけで、**Video Connection**ドロップダウンです。ここでVideo Generationの接続を選びます。

**Game Mode**のチャットには「Generate MP4 scene videos from game illustrations.」と説明された**Scene Videos**カードが表示されます。こちらは操作が多くなります。

- **Video Connection**: このゲームで使うVideo Generationの接続です。
- **Game Video Prompt**: 画像をどう動かすかを決めるプロンプトのテンプレートです。組み込みのデフォルトは**Cinematic Scene Video**です。
- **Edit Video Presets**: このチャット用に、動画プロンプトのテンプレートのコピーを追加したり編集したりします。

**Game Video Prompt**は、Game ModeでGalleryとGame Assetsから手動で作る動画にも引き続き適用されます。RoleplayのGalleryのアニメーションでは、代わりに**Roleplay Gallery Animation Director**を使います。インストールしたStoryboardエージェントは、独自のデフォルトの**Storyboard Video Prompt**を持ちます。RoleplayとGameのチャットごとに、**Chat Settings > Agents > Storyboards**で上書きできます。この選択をリセットするとStoryboardエージェントのデフォルトに戻り、ほかのチャットのプロンプトを引き継ぐことはありません。

Game Modeのチャットを新規作成すると、設定ウィザードにも**Video Generation Connection**の選択肢があります。**Features**のステップにあり、**Visual Generation**をオンにすると表示されます。

チャットに動画接続が設定されていない場合、Marinaraは**Use as default video connection**を指定した接続にフォールバックします。チャットの接続もデフォルトもない場合は、動画の操作時に接続を選ぶよう促す警告が表示されます。

## 動画生成の設定

動画のデフォルトの一部は、接続ではなくアプリの設定にあります。**Settings**、**Generations**の順に開き、**Video Generation**セクションを開きます。このセクションは「Set default clip lengths and edit reusable video prompts for Game, Gallery, and Calls.」と説明されています。

ここにあるシーン動画の主な設定は**Scene video fallback length**で、デフォルトは10秒です。選んだ動画接続に長さの設定がない場合にだけ使われます。1秒から60秒の範囲で設定できます。

このセクションには**Video Generation Prompt Overrides**もあり、繰り返し使う動画プロンプトのテンプレートを編集できます。**Roleplay Gallery Animation Director**は、RoleplayのGalleryのクリップを生成する前に、選んだPrompt Modelへ送る指示を管理します。`${durationSeconds}`の変数は、選んだクリップの長さに置き換わります。コードを書かずにクリップの動きを変えられる、上級者向けの方法です。

同じセクションには**Animated expression length**という設定もあります。これは別の機能であるアニメーションする立ち絵スプライトの設定です。詳しくは[アニメーション表情](animated-expressions.md)を参照してください。

## 絵コンテ

ダウンロードして使うStoryboardエージェントは、RoleplayとGame Modeで、順番に並んだキーフレーム画像とクリップを作れます。Game Modeは完了したGMの1ターンを使い、Roleplayは完了したやり取りをまとめてチャット内のエピソードにします。アニメーションを有効にすると、Marinaraは選択した動画接続とエージェントの**Storyboard Video Prompt**を使って、成功した各キーフレームを動かします。

絵コンテには専用の操作と専用のガイドがあります。インストール方法と両モードの使い方は[Storyboardエージェントガイド](../game/storyboard.md)を参照してください。

## トラブルシューティング

### 「Choose a Video Generation connection」と表示される

チャットに動画接続が選ばれていません。**Chat Settings**、**Agents**、**Scene Videos**の順に開いて接続を選びます。ドロップダウンが空の場合は、**Settings**、**Connections**の順に開いて接続を追加します。

### 「Add or generate a gallery image before generating a scene video」と表示される

シーン動画は必ず既存の画像を動かします。**Illustrate**を使うか、画像をアップロードするか、手持ちの画像で**Animate illustration**をクリックしてください。

### 動画の生成に時間がかかる

これは正常です。プロバイダーが処理を開始し、Marinaraはクリップが完成するまで待って状態を確認し続けます。Veo、xAI、OpenRouter、Atlas Cloud、Seedanceはいずれもこの方式で動作し、1本に数分かかることがあります。

### Seedanceが参照画像を読み取れない

Seedanceには画像への公開リンクが必要です。ローカルサーバーの場合は、Seedanceの接続を開いて**Upload Seedance reference frames temporarily**をオンにします。上のSeedanceの節を参照してください。

### 動画のリクエストが失敗し続ける

接続に有効なAPIキーが設定されていること、アカウントで動画機能が使えることを確かめてください。**Settings**、**Connections**の順に開いて接続を開き、キーとモデルを確認します。サーバー側の動画のタイムアウトについては[サーバー設定リファレンス](../CONFIGURATION.md)で説明しています。

## 関連ガイド

- [アニメーション表情](animated-expressions.md)
- [Storyboardエージェントガイド](../game/storyboard.md)
- [Game ModeのLTX 2.3絵コンテ](../game/ltx-2-3-storyboards.md)
- [対応しているAIプロバイダー](../connections/providers-reference.md)
- [サーバー設定リファレンス](../CONFIGURATION.md)
