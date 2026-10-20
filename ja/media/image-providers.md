# 画像生成プロバイダーと設定

このガイドでは、画像生成サービスをMarinara Engineに接続する方法を説明します。各サービスに何が必要かもまとめています。画像生成は、シーンの挿絵、自撮り写真、シーン背景、そして生成されるアバター、ポートレート、スプライトを支える機能です。

画像生成は、特別な種類の接続として設定します。画像用の接続が1つ動けば、アプリ内のすべての画像機能がそれを利用できます。

## 画像生成の接続を追加する方法

**API key**(APIキー)とは、プロバイダーが発行する秘密のパスワードのような文字列で、これによってMarinaraがアカウントを利用できるようになります。**Base URL**とは、そのサービスのAPIのWebアドレスです。サービスを選ぶと、Marinaraが正しいBase URLを自動で入力します。

画像用の接続は次の手順で追加します。

1. **Connections**(接続)パネルを開きます。
2. **New**をクリックして、**Create Connection**ウィンドウを開きます。
3. 名前を入力し、プロバイダーとして**Image Generation**を選びます。
4. 接続エディターで、グリッドから**Service**(サービス)を選びます。
5. そのサービスにAPIキーが必要な場合は、**API Key**欄に貼り付けます。無料サービスとローカルサービスには不要です。
6. 一覧から**Model**を選ぶか、モデルIDを直接入力します。サービスによっては**Fetch Models from API**で最新の一覧を読み込めます。
7. **Save**をクリックします。
8. **Test Image**をクリックして動作を確認します。Marinaraが小さなテスト画像を生成します。

**Test Image**で画像が返ってくれば、接続の準備は完了です。失敗する場合は、APIキーとBase URLを確かめます。

## サービスの選び方

サービスは3つのグループに分かれます。クラウドサービスにはアカウントが必要で、ほとんどのサービスではAPIキーも必要です。無料サービスにキーは要りません。ローカルサービスは、自分のコンピューターで画像生成ソフトを動かします。

次の表は各サービスの概要です。細かい違いや注意点は、サービスごとの節で説明します。

| サービス | APIキー | 動作場所 |
| --- | --- | --- |
| OpenAI (DALL-E) | 必要 | クラウド |
| ChatGPT (Codex login) | 不要、`codex login`を使用 | クラウド |
| Stability AI | 必要 | クラウド |
| Together AI | 必要 | クラウド |
| Arli AI | 必要 | クラウド |
| NovelAI | 必要 | クラウド |
| OpenRouter Images | 必要 | クラウド |
| xAI / Grok Imagine | 必要 | クラウド |
| Venice.ai | 必要 | クラウド |
| Z.AI | 必要 | クラウド |
| Atlas Cloud | 必要 | クラウド |
| fal.ai | 必要 | クラウド |
| SpicyAPI | 必要 | クラウド |
| NanoGPT | 必要 | クラウド |
| Block Entropy | 必要 | クラウド |
| RunPod Serverless (ComfyUI) | 必要 | クラウド |
| Pollinations | 不要 | 無料クラウド |
| Stable Horde | 任意 | 無料クラウド |
| SD Web UI (AUTOMATIC1111 / Forge) | 不要 | ローカル |
| ComfyUI | 不要 | ローカル |
| SwarmUI | 任意 | ローカル |
| Draw Things | 不要 | ローカル |

## OpenAI (DALL-E)

デフォルトのBase URLが`https://api.openai.com/v1`のクラウドサービスです。OpenAIアカウントのAPIキーが必要です。DALL-EとGPT Imageのモデルを利用できます。GPT Imageのモデルは参照画像を最大16枚まで受け付けますが、DALL-Eのモデルは受け付けません。

## ChatGPT (Codex login)

APIキーの代わりにChatGPTのプランを使うクラウドサービスです。そのため、画像生成にOpenAIのAPIクレジットは要りません。Marinaraのサーバーが動いているコンピューターにCodex CLIをインストールし、`codex login`を一度だけ実行してください。**OpenAI (ChatGPT)**のチャット接続で使うログインと同じものです。手順は[Claude、ChatGPT、Grokのサブスクリプション接続](../connections/subscription-clis.md#openai-chatgpt)を参照してください。APIキーやBase URLを入力する必要はありません。モデルには、Codex自身が画像生成に使っている`gpt-image-2`をMarinaraが自動で入力します。

**Test Connection**(接続テスト)は、MarinaraがCodexのログイン情報を読み取れるかどうかだけを確認します。**Test Image**は実際に画像を生成するので、ChatGPTの画像生成の利用上限にカウントされます。参照画像がある場合は、Marinaraが最大16枚の参照画像を付けて画像編集のリクエストを送ります。ChatGPTは指定したものとは異なるピクセルサイズで画像を返すことがあるため、Marinaraは希望するアスペクト比をプロンプトにも明記します。

このサービスは、OpenAIの公開APIではなく、Codexが使うChatGPTの画像エンドポイントと通信します。そのため、このエンドポイントはOpenAIによって予告なく変更される可能性があります。

## Stability AI

デフォルトのBase URLが`https://api.stability.ai/v2beta`のクラウドサービスです。Stability AIのAPIキーが必要です。Stable DiffusionとStable Imageのモデルを利用できます。

## Together AI

デフォルトのBase URLが`https://api.together.xyz/v1`のクラウドサービスです。Together AIのAPIキーが必要です。FLUXをはじめとするオープンな画像モデルを利用できます。

## Arli AI

デフォルトのBase URLが`https://api.arliai.com/v1`のクラウドサービスです。Arli AIのAPIキーが必要です。ホスト型のStable Diffusionモデルを利用できます。**Model**の指定が必須なので、使いたいArli AIの画像モデルの名前を入力してください。後述の**Local Image Defaults**では、**SD Web UI (AUTOMATIC1111 / Forge)**と同じ欄を使います。参照画像を送ると、Marinaraは1枚目を元画像として使います(image to image)。

ここでの**Arli AI**サービスは画像専用です。Arli AIのチャットモデルを使うには、代わりに**Arli AI**チャットプロバイダーを使ってください。[対応しているAIプロバイダー](../connections/providers-reference.md#arli-ai)を参照してください。

## NovelAI

デフォルトのBase URLが`https://image.novelai.net`のクラウドサービスです。NovelAIのAPIキーが必要です。アニメ調のイラストを得意とします。V4、V4.5、V5モデルでは、複数のキャラクターを含むストーリーボードやIllustratorのシーンに対して、位置情報付きのキャラクタープロンプトをNovelAI標準の形式で送信します。精密な参照画像などの新しい機能は、V4.5系のモデルでしか動作しません。

## OpenRouter Images

デフォルトのBase URLが`https://openrouter.ai/api/v1`のクラウドサービスです。OpenRouterのAPIキーが必要です。OpenRouterのチャット用インターフェイスを経由して画像モデルを利用するため、実際に使えるモデルはアカウントによって変わります。

## xAI / Grok Imagine

デフォルトのBase URLが`https://api.x.ai/v1`のクラウドサービスです。xAIのAPIキーが必要です。画像生成にはGrok Imagineを使います。

## Venice.ai

デフォルトのBase URLが`https://api.venice.ai/api/v1`のクラウドサービスです。VeniceのAPIキーが必要です。**Fetch Models from API**を使うと、アカウントで利用できる画像モデルを読み込めます。MarinaraはVenice独自の画像エンドポイントを使い、Veniceの任意設定であるセーフモードのぼかしを無効にしたうえで、指定されたサイズを各モデルのピクセル指定、アスペクト比指定、解像度ティア指定のいずれかの形式へ自動的に変換します。それでも、プロバイダー側のポリシーやモデルの制限によってリクエストが拒否されることはあります。

## Z.AI

デフォルトのBase URLが`https://api.z.ai/api/paas/v4`のクラウドサービスです。Z.AIの一般向けAPIキーが必要です。GLM Coding Planのキーと`/api/coding/paas/v4`エンドポイントは、画像生成には使えません。**Fetch Models from API**を使って、**GLM-Image**か**CogView 4**を選びます。Marinaraは指定されたアスペクト比を、選んだモデルが対応するサイズへ変換し、Z.AI独自の画像エンドポイントへリクエストを送ったうえで、一時的な結果URLをローカルストレージにダウンロードします。この最初のバージョンはtext-to-image専用で、参照画像は送信しません。

## Atlas Cloud

デフォルトのBase URLが`https://api.atlascloud.ai/api/v1`のクラウドサービスです。Atlas CloudのAPIキーが必要です。**Fetch Models**(モデルを取得)は、Atlas Cloudの最新のテキストから画像・画像から画像のモデル一覧を読み込みます。一覧を取得できない場合は、Nano Banana、Gemini Flash Image、FLUX 1.1 Proの初期リストを表示します。Atlas Cloudの画像モデルIDを正確に直接入力することもできます。処理は非同期で行われ、Marinaraは生成を開始した後、画像が完成するまでAtlas Cloudに状態を問い合わせます。一般的なテキストから画像の設定は自動で対応付けられます。参照画像は、IDがimage-to-image、編集、Kontextの機能を示すモデルに送信されます。モデルごとにスキーマが異なるため、別のIDを使う場合は、そのモデルのAtlas Cloudドキュメントを確認してください。

## fal.ai

デフォルトの**Base URL**が`https://fal.run`のクラウドサービスです。[fal.ai](https://fal.ai/dashboard/keys)でAPIキーを作成し、画像サービスの一覧で**fal.ai**を選んでください。初期の**Model**一覧には`fal-ai/flux/schnell`と`fal-ai/flux/dev`があります。入出力スキーマが対応する別のテキストから画像を生成するエンドポイントIDも入力できます。**Test Connection**(接続テスト)は設定だけを確認します。**Test Image**は実際に生成をリクエストし、fal.aiのクレジットを消費します。

Marinaraはプロンプトと指定サイズを送り、最初に返された画像を既存の画像処理フローにダウンロードします。ネガティブプロンプトはテキストの指示として追加します。`seed`、`num_inference_steps`、`image_size`などモデル固有のオプションには**Custom Parameters**(カスタムパラメーター)を使ってください。この連携は同期式のテキストから画像への生成リクエストを使います。参照画像の送信や中断したジョブの再開には対応していません。対応する入力は、選択したモデルや独自エンドポイントのAPIページで確認してください。例として[flux/schnellのAPIリファレンス](https://fal.ai/models/fal-ai/flux/schnell/api)を参照できます。

## SpicyAPI

デフォルトの**Base URL**が`https://api.spicyapi.ai/api/v1`のクラウドサービスです。[SpicyAPIのコンソール](https://spicyapi.ai/console/keys)でAPIキーを作成し、画像サービスの一覧で**SpicyAPI**を選んでください。モデルには`alibaba/z-image-spicy-pro/text-to-image`をMarinaraが入力します。**Fetch Models from API**をクリックすると、SpicyAPIのテキストから画像を生成するモデルと編集モデルをすべて読み込めます。`bytedance/seedream-5.0-pro/text-to-image`のようにモデルIDを入力することもできます。**Test Connection**(接続テスト)はモデル一覧を読み取ってキーを確認するだけなので、費用はかかりません。**Test Image**は実際に画像を生成し、SpicyAPIの残高を消費します。

**SpicyAPI**のサービスを選んでください。**OpenAI (DALL-E)**や、SpicyAPIのアドレスを入れた**Custom (OAI-Compatible)**の接続は使わないでください。SpicyAPIのOpenAI形式のアドレスはテキストしか扱わないため、それらでは画像を作れません。

SpicyAPIのモデルは、それぞれ受け付ける設定が異なります。Marinaraは、選んだモデルが受け付ける設定をSpicyAPIに問い合わせ、それだけを送ります。サイズは、アスペクト比、幅と高さ、固定サイズなど、モデルが受け付ける形式のうち最も近いものを選びます。モデルにネガティブプロンプトの欄がない場合は、ネガティブプロンプトをテキストとしてプロンプトの末尾に追加します。`seed`、`resolution`、`loras`など、それ以外のモデルのオプションには**Custom Parameters**(カスタムパラメーター)を使ってください。

SpicyAPIは、画像を1枚ずつタスクとして処理します。Marinaraはタスクの完了を待ち、1分ほどたっても終わらない場合はあらためて状態を確認してから、結果をダウンロードします。接続が切れた場合は、新しいタスクに料金を払うのではなく、同じタスクを引き継ぎます。編集モデル(IDが`/edit`で終わるもの)には参照画像が送られます。SpicyAPIが受け付ける参照画像は1枚あたり1 MBまで、1リクエストあたり2 MBまでなので、Marinaraは大きい画像を縮小し、収まらない分の画像は送りません。

## NanoGPT

デフォルトのBase URLが`https://nano-gpt.com/api/v1`のクラウドサービスです。NanoGPTのAPIキーが必要です。NanoGPTは複数のサービスをまとめるアグリゲーターなので、**Fetch Models from API**でモデル一覧を読み込みます。

## Block Entropy

デフォルトのBase URLが`https://api.blockentropy.ai`のクラウドサービスです。APIキーが必要です。MarinaraにはBlock Entropy専用の処理がなく、OpenAI互換の形式でリクエストを送ります。実際の互換性は確認できていないので、本格的に使う前に**Test Image**で試してください。

## RunPod Serverless (ComfyUI)

デフォルトのBase URLが`https://api.runpod.ai/v2`のクラウドサービスです。RunPodのサーバーレスエンドポイント上でComfyUIのワークフローを実行します。必要なものは3つあります。**API Key**に入れるRunPodのAPIトークン、**RunPod Endpoint ID**、そして**ComfyUI Workflow**のJSONです。後述のComfyUIワークフローの節を参照してください。

## Pollinations

デフォルトのBase URLが`https://image.pollinations.ai`の無料クラウドサービスです。アカウントもAPIキーも要りません。画像生成をいちばん手軽に試せます。

## Stable Horde

デフォルトのBase URLが`https://stablehorde.net/api/v2`の無料クラウドサービスです。有志のコンピューターを集めたネットワークです。APIキーは任意です。無料のキーを取得すると、順番待ちの優先度が上がります。

## SD Web UI (AUTOMATIC1111 / Forge)

デフォルトのBase URLが`http://localhost:7860`のローカルサービスです。自分のコンピューターで動いているStable Diffusion Web UIと通信します。そのアプリは、APIを有効にした状態で起動してください。APIキーは不要です。

## ComfyUI

デフォルトのBase URLが`http://127.0.0.1:8188`のローカルサービスです。自分のコンピューターで動いているComfyUIサーバーと通信します。後述のカスタムワークフローに対応しています。APIキーは不要です。

## SwarmUI

デフォルトのBase URLが`http://127.0.0.1:7801`のローカルサービスです。SwarmUIサーバーと通信します。SwarmUIは、ComfyUIの処理を独自のキューに振り分けられます。アカウントのないローカルサーバーなら、APIキーは不要です。SwarmUIサーバーでアカウントが必要な場合は、**API Key**にSwarm Auth Tokenを貼り付けます。**Fetch Models from API**で、SwarmUIサーバーにあるモデルの一覧を表示できます。

SwarmUIでは、**ComfyUI Workflow**欄は任意です。空のままにするとSwarmUI自身の画像設定を使います。後述のワークフローを貼り付けることもできます。各画像をSwarmUIの出力フォルダーにも残すには、**Local Image Defaults**で**Save images in SwarmUI**(SwarmUIに画像を保存)をオンにします。どちらの場合も、Marinaraは自分用のコピーを保存します。

## Draw Things

デフォルトのBase URLが`http://localhost:7860`のローカルサービスです。macOSまたはiOSのDraw Thingsアプリと通信します。MarinaraはこれをAUTOMATIC1111のサーバーと同じように扱います。APIキーは不要です。

## ネットワーク上のローカルサービス

`localhost`(ループバックとも呼びます)は、Marinaraが動いているコンピューター自身を指します。同じコンピューター上のローカル画像サーバーなら、追加の設定なしで使えます。

画像サーバーを家庭内ネットワークの別のコンピューターで動かしている場合は、サーバーの設定でローカルネットワークのアドレスを許可する必要があります。手順は[サーバー設定リファレンス](../CONFIGURATION.md)を参照してください。

プロバイダーが画像データではなくURLを返す場合、Marinaraは通常の外部リクエストの安全確認を通して、公開CDNのURLをダウンロードします。プライベートアドレスやループバックのURLが返ってきたときは、スキーム、ホスト名、ポートが設定済みの画像プロバイダーと完全に一致する場合にだけ受け入れます。そのプライベートオリジンからのリダイレクトで、別のローカルサービスへ飛ぶことはできません。ローカルのプロキシが結果を別のプライベートオリジンに保存している場合は、画像APIと同じオリジンからそれらのファイルを配信するようプロキシを設定してください。

## ComfyUIのワークフローJSONとRunPod

**ComfyUI**、**SwarmUI**、**RunPod Serverless (ComfyUI)**では、**ComfyUI Workflow**欄が表示されます。ComfyUIから**Save (API Format)**、**Export (API)**、**Export to API**のいずれか(フロントエンドのバージョンによって名前が異なります)で書き出したワークフローJSONを貼り付けます。この欄は、**ComfyUI**と**SwarmUI**ではOptional、**RunPod Serverless (ComfyUI)**ではRequiredと表示されます。

Marinaraはプレースホルダーを使ってワークフローを埋めます。値を入れたい位置に、次のテキストマーカーを書いておきます。

- `%prompt%`と`%negative_prompt%`はプロンプトに使います。
- `%width%`、`%height%`、`%seed%`は画像サイズとシード値に使います。
- `%model%`、`%steps%`、`%cfg%`、`%sampler%`、`%scheduler%`、`%denoise%`は生成設定に使います。
- `%reference_image%`と`%reference_image_01%`から`%reference_image_04%`までは、参照画像のデータを挿入します。
- `%reference_image_name%`と`%reference_image_name_01%`から`%reference_image_name_04%`までは、参照画像をアップロードし、ローカルのComfyUIのLoadImageノード用にそのファイル名を挿入します。

中でも重要なのは`%prompt%`です。これが見つからないと、エディターが警告します。**ComfyUI**では、欄を空のままにすると組み込みのデフォルトワークフローを使います。**SwarmUI**では、空のままにするとSwarmUI自身の画像設定を使います。**RunPod Serverless (ComfyUI)**では、エンドポイント側にデフォルトがないため、ワークフローが必須です。3つともbase64形式の参照画像を最大4枚まで受け付けます。ファイル名でアップロードするプレースホルダーは、ローカルのComfyUIでしか使えません。

書き出しの手順、JSONの例、プレースホルダーの引用符の扱い、参照画像の設定、キャラクターごとのワークフロー、LANからのアクセス、トラブルシューティングについては、[ComfyUIワークフローの設定](comfyui.md)を参照してください。

## 接続ごとのLocal Image Defaults

サービスが**SD Web UI (AUTOMATIC1111 / Forge)**、**ComfyUI**、**NovelAI**、**Draw Things**、**Arli AI**、**SwarmUI**、**RunPod Serverless (ComfyUI)**のいずれかのとき、その接続に**Local Image Defaults**(ローカル画像のデフォルト設定)パネルが表示されます。**Draw Things**と**Arli AI**では、**SD Web UI (AUTOMATIC1111 / Forge)**と同じ欄とデフォルト値が並びます。**SwarmUI**と**RunPod Serverless (ComfyUI)**では、**ComfyUI**と同じ欄とデフォルト値が並びます。これらの設定は、この接続で画像を生成するときにだけ適用されます。**Reset**ボタンで組み込みの値に戻せます。

これらのサービスにはいずれも**Seed**欄があります。-1のままにすると、毎回ランダムな画像になります。ほかの数値を入れると、常に同じシード値を使い回します。

そのほかの欄はサービスによって異なります。

| サービス | 欄 | デフォルト |
| --- | --- | --- |
| AUTOMATIC1111 / Forge | Steps | 20 |
| AUTOMATIC1111 / Forge | CFG Scale | 7 |
| AUTOMATIC1111 / Forge | Sampler | Euler a |
| AUTOMATIC1111 / Forge | Img2Img Denoise | 0.6 |
| ComfyUI | Steps | 20 |
| ComfyUI | CFG Scale | 7 |
| ComfyUI | Sampler | euler_ancestral |
| ComfyUI | Scheduler | normal |
| ComfyUI | Denoise | 1 |
| NovelAI | Steps | 28 |
| NovelAI | Prompt Guidance | 6 |
| NovelAI | Sampler | k_euler_ancestral |
| NovelAI | Noise Schedule | karras |

どのサービスにも**Prompt Prefix**と**Negative Prefix**のテキスト欄があります。ここに入れた文章は、この接続で送るすべてのプロンプトの先頭に追加されます。AUTOMATIC1111 / ForgeとComfyUIには、どちらにも**Clip Skip**欄があります。AUTOMATIC1111 / Forgeにはさらに**Restore faces**トグルが加わります。ComfyUIには**Upload a 1x1 placeholder when no reference image is provided**というトグルが加わります。これは、参照画像のプレースホルダーを含むカスタムワークフローでのみ意味を持ちます。NovelAIには**Guidance Rescale**と**UC Preset**の欄が加わります。

## プロバイダーごとに異なる参照画像への対応

**参照画像**とは、プロンプトと一緒に送る既存の画像です。キャラクターの顔立ちや絵柄を新しい画像に引き継ぐのに役立ちます。受け付けられる枚数はプロバイダーごとに違います。

| プロバイダー | 参照画像 |
| --- | --- |
| OpenAI (DALL-E) | 最大16枚、GPT Imageのモデルのみ |
| ChatGPT (Codex login) | 最大16枚 |
| NovelAI | 最大16枚、V4.5系モデルのみ |
| xAI / Grok Imagine | 最大3枚 |
| Venice.ai | text-to-imageの生成では非対応 |
| Z.AI | 現在のtext-to-image連携では非対応 |
| Atlas Cloud | image-to-image、編集、Kontextに対応したモデルIDでは1枚目のみ |
| SpicyAPI | 編集モデルのみ、モデルの上限まで。大きい画像は収まるように縮小 |
| NanoGPT | 最大3枚 |
| Stability AI | 1枚目のみ、image to imageとして使用 |
| Arli AI | 1枚目のみ、image to imageとして使用 |
| SD Web UI (AUTOMATIC1111 / Forge)とDraw Things | 1枚目のみ、image to imageとして使用 |
| OpenRouter Images | 対応、枚数の上限なし |
| ComfyUIとRunPod Serverless (ComfyUI) | 最大4枚、ワークフローのプレースホルダー経由 |
| SwarmUI | 最大4枚 |
| Together AI、Pollinations、Stable Horde、fal.ai | 非対応 |

NovelAIの精密な参照画像は、`nai-diffusion-4-5-full`のようなV4.5系モデルでしか動作しません。NovelAIはV5向けのPrecise Referenceをまだ公開していません。ほかのモデルで参照画像を指定すると、Marinaraは参照画像なしで画像を生成し、サーバーログに警告を記録します。

## メディア生成リクエストを順番に処理

**Queue media generation requests**(メディア生成リクエストを順番に処理)トグルは、**Settings**(設定) → **Generations** → **Overall Generations**にあります。デフォルトはオンです。

オンのとき、Marinaraは画像のジョブを画像プロバイダーのアカウントごとに1件ずつ、動画のジョブを動画プロバイダーのアカウントごとに1件ずつ、別々のキューで送ります。同じアカウントでも、画像と動画は同時に処理できます。これは、依頼元の機能にかかわらず適用されます。対象は、Illustrator、トラッカー、コマンド、Gallery、Gameのアセット、Slurpのようなダウンロードしたエージェントです。アドレスとAPIキーが同じ2つの接続は、対応するキューを共有します。異なるアカウントやプロバイダーは、引き続き同時に処理されます。NovelAIでは、ジョブの間に短い間隔も空けます。NovelAIが混雑していると応答した場合は、画像を失敗させずに、待ってから2回まで再試行します。

同時に2件のリクエストを受け付けないサービスでは、オンのままにしてください。同時に多くのリクエストを処理できるサービスを使っていて、生成を速くしたい場合だけオフにします。

## 関連ガイド

- [ComfyUIワークフローの設定](comfyui.md)では、ローカルとRunPod向けのカスタムワークフローJSONを手順を追って説明します。
- [Illustratorエージェント](illustrator-agent.md)では、シーンの挿絵の自動生成を設定します。
- [画像スタイルプロファイル](style-profiles.md)は、生成されるすべての画像の見た目を決めます。
- [シーン背景とギャラリー](scene-backgrounds.md)では、生成したシーン背景について説明します。
- [自撮り写真](../conversation/selfies.md)は、Conversationモードでキャラクターの自撮り写真を撮るコマンドです。
- [対応しているAIプロバイダー](../connections/providers-reference.md)には、チャット、画像、動画の全プロバイダーが一覧されています。
