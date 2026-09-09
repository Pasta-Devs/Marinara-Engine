# 画像生成プロバイダーと設定

このガイドでは、画像生成サービスをMarinara Engineに接続する方法を説明します。17種類のサービスそれぞれに何が必要かもまとめています。画像生成は、シーンの挿絵、自撮り写真、シーン背景、そして生成されるアバター、ポートレート、スプライトを支える機能です。

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

17種類のサービスは3つのグループに分かれます。クラウドサービスにはAPIキーとアカウントが必要です。無料サービスにキーは要りません。ローカルサービスは、自分のコンピューターで画像生成ソフトを動かします。

次の表は各サービスの概要です。細かい違いや注意点は、サービスごとの節で説明します。

| サービス | APIキー | 動作場所 |
| --- | --- | --- |
| OpenAI (DALL-E) | 必要 | クラウド |
| Stability AI | 必要 | クラウド |
| Together AI | 必要 | クラウド |
| NovelAI | 必要 | クラウド |
| OpenRouter Images | 必要 | クラウド |
| xAI / Grok Imagine | 必要 | クラウド |
| Venice.ai | 必要 | クラウド |
| Z.AI | 必要 | クラウド |
| Atlas Cloud | 必要 | クラウド |
| NanoGPT | 必要 | クラウド |
| Block Entropy | 必要 | クラウド |
| RunPod Serverless (ComfyUI) | 必要 | クラウド |
| Pollinations | 不要 | 無料クラウド |
| Stable Horde | 任意 | 無料クラウド |
| SD Web UI (AUTOMATIC1111 / Forge) | 不要 | ローカル |
| ComfyUI | 不要 | ローカル |
| Draw Things | 不要 | ローカル |

## OpenAI (DALL-E)

デフォルトのBase URLが`https://api.openai.com/v1`のクラウドサービスです。OpenAIアカウントのAPIキーが必要です。DALL-EとGPT Imageのモデルを利用できます。参照画像は最大16枚まで受け付けます。

## Stability AI

デフォルトのBase URLが`https://api.stability.ai/v2beta`のクラウドサービスです。Stability AIのAPIキーが必要です。Stable DiffusionとStable Imageのモデルを利用できます。

## Together AI

デフォルトのBase URLが`https://api.together.xyz/v1`のクラウドサービスです。Together AIのAPIキーが必要です。FLUXをはじめとするオープンな画像モデルを利用できます。

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

デフォルトのBase URLが`https://api.atlascloud.ai/api/v1`のクラウドサービスです。Atlas CloudのAPIキーが必要です。MarinaraはNano Banana、Gemini Flash Image、FLUX 1.1 Pro向けの小さな初期カタログを用意していますが、ほかのAtlas Cloud画像モデルのIDを正確に入力することもできます。ジョブは非同期で実行されるため、Marinaraは生成を開始したあと、画像ができあがるまでAtlas Cloudに問い合わせ続けます。一般的なtext-to-imageの設定は自動的に対応付けられ、image-to-image、編集、Kontextの動作に対応すると示しているモデルIDには参照画像も送信します。Atlasのモデルスキーマはモデルごとに異なることがあるので、ほかのモデルIDを使うときは、そのモデルのAtlas Cloudドキュメントを確認してください。

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

## Draw Things

デフォルトのBase URLが`http://localhost:7860`のローカルサービスです。macOSまたはiOSのDraw Thingsアプリと通信します。MarinaraはこれをAUTOMATIC1111のサーバーと同じように扱います。APIキーは不要です。

## ネットワーク上のローカルサービス

`localhost`(ループバックとも呼びます)は、Marinaraが動いているコンピューター自身を指します。同じコンピューター上のローカル画像サーバーなら、追加の設定なしで使えます。

画像サーバーを家庭内ネットワークの別のコンピューターで動かしている場合は、サーバーの設定でローカルネットワークのアドレスを許可する必要があります。手順は[サーバー設定リファレンス](../CONFIGURATION.md)を参照してください。

プロバイダーが画像データではなくURLを返す場合、Marinaraは通常の外部リクエストの安全確認を通して、公開CDNのURLをダウンロードします。プライベートアドレスやループバックのURLが返ってきたときは、スキーム、ホスト名、ポートが設定済みの画像プロバイダーと完全に一致する場合にだけ受け入れます。そのプライベートオリジンからのリダイレクトで、別のローカルサービスへ飛ぶことはできません。ローカルのプロキシが結果を別のプライベートオリジンに保存している場合は、画像APIと同じオリジンからそれらのファイルを配信するようプロキシを設定してください。

## ComfyUIのワークフローJSONとRunPod

**ComfyUI**と**RunPod Serverless (ComfyUI)**では、**ComfyUI Workflow**欄が表示されます。ComfyUIから**Save (API Format)**、**Export (API)**、**Export to API**のいずれか(フロントエンドのバージョンによって名前が異なります)で書き出したワークフローJSONを貼り付けます。この欄は、**ComfyUI**ではOptional、**RunPod Serverless (ComfyUI)**ではRequiredと表示されます。

Marinaraはプレースホルダーを使ってワークフローを埋めます。値を入れたい位置に、次のテキストマーカーを書いておきます。

- `%prompt%`と`%negative_prompt%`はプロンプトに使います。
- `%width%`、`%height%`、`%seed%`は画像サイズとシード値に使います。
- `%model%`、`%steps%`、`%cfg%`、`%sampler%`、`%scheduler%`、`%denoise%`は生成設定に使います。
- `%reference_image%`と`%reference_image_01%`から`%reference_image_04%`までは、参照画像のデータを挿入します。
- `%reference_image_name%`と`%reference_image_name_01%`から`%reference_image_name_04%`までは、参照画像をアップロードし、ローカルのComfyUIのLoadImageノード用にそのファイル名を挿入します。

中でも重要なのは`%prompt%`です。これが見つからないと、エディターが警告します。**ComfyUI**では、欄を空のままにすると組み込みのデフォルトワークフローを使います。**RunPod Serverless (ComfyUI)**では、エンドポイント側にデフォルトがないため、ワークフローが必須です。どちらもbase64形式の参照画像を最大4枚まで受け付けます。ファイル名でアップロードするプレースホルダーは、ローカルのComfyUIでしか使えません。

書き出しの手順、JSONの例、プレースホルダーの引用符の扱い、参照画像の設定、キャラクターごとのワークフロー、LANからのアクセス、トラブルシューティングについては、[ComfyUIワークフローの設定](comfyui.md)を参照してください。

## 接続ごとのLocal Image Defaults

サービスが**SD Web UI (AUTOMATIC1111 / Forge)**、**ComfyUI**、**NovelAI**、**Draw Things**のいずれかのとき、その接続に**Local Image Defaults**(ローカル画像のデフォルト設定)パネルが表示されます。**Draw Things**では、**SD Web UI (AUTOMATIC1111 / Forge)**と同じ欄とデフォルト値が並びます。これらの設定は、この接続で画像を生成するときにだけ適用されます。**Reset**ボタンで組み込みの値に戻せます。

この4つのサービスにはいずれも**Seed**欄があります。-1のままにすると、毎回ランダムな画像になります。ほかの数値を入れると、常に同じシード値を使い回します。

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
| OpenAI (DALL-E) | 最大16枚 |
| NovelAI | 最大16枚、V4.5系モデルのみ |
| xAI / Grok Imagine | 最大3枚 |
| Venice.ai | text-to-imageの生成では非対応 |
| Z.AI | 現在のtext-to-image連携では非対応 |
| Atlas Cloud | image-to-image、編集、Kontextに対応したモデルIDでは1枚目のみ |
| NanoGPT | 最大3枚 |
| Stability AI | 1枚目のみ、image to imageとして使用 |
| OpenRouter Images | 対応、枚数の上限なし |
| ComfyUIとRunPod Serverless (ComfyUI) | 最大4枚、ワークフローのプレースホルダー経由 |
| Together AI、Pollinations、Stable Horde | 非対応 |

NovelAIの精密な参照画像は、`nai-diffusion-4-5-full`のようなV4.5系モデルでしか動作しません。NovelAIはV5向けのPrecise Referenceをまだ公開していません。ほかのモデルで参照画像を指定すると、Marinaraは参照画像なしで画像を生成し、サーバーログに警告を記録します。

## 画像生成リクエストを順番に処理

**Queue image generation requests**(画像生成リクエストを順番に処理)トグルは、**Settings**(設定) → **Generations** → **Image Generation**にあります。デフォルトはオンです。

オンのときは、Marinaraが画像のジョブを1件ずつ送ります。同時に2件のリクエストを受け付けないサービスでは、オンのままにしてください。同時に多くのリクエストを処理できるサービスを使っていて、生成を速くしたい場合だけオフにします。

## 関連ガイド

- [ComfyUIワークフローの設定](comfyui.md)では、ローカルとRunPod向けのカスタムワークフローJSONを手順を追って説明します。
- [Illustratorエージェント](illustrator-agent.md)では、シーンの挿絵の自動生成を設定します。
- [画像スタイルプロファイル](style-profiles.md)は、生成されるすべての画像の見た目を決めます。
- [シーン背景とギャラリー](scene-backgrounds.md)では、生成したシーン背景について説明します。
- [自撮り写真](../conversation/selfies.md)は、Conversationモードでキャラクターの自撮り写真を撮るコマンドです。
- [対応しているAIプロバイダー](../connections/providers-reference.md)には、チャット、画像、動画の全プロバイダーが一覧されています。
