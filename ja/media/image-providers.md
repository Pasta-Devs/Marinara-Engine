# 画像生成プロバイダーと設定

画像生成は、シーンの挿絵、自撮り写真、シーン背景、そして生成されるアバター、ポートレート、スプライトを支える機能です。このガイドでは、画像サービスを追加する方法と、各サービスに必要なものを説明します。画像モデルが1つ動けば、アプリ内のすべての画像機能がそれを使えます。

## 画像サービスを追加する

APIキーとは、サービスが発行する秘密のコードで、Marinaraが自分のアカウントを使えるようにするものです。各サービスのWebアドレスはMarinaraが自動で入力するので、自分で入力することはほとんどありません。

1. 上部バーの**Connections**(接続)をクリックし、**Add**(追加)をクリックします。**Add account**(アカウントの追加)ウィンドウが開きます。
2. サービスを探します。一覧には**Images & video**(画像と動画)のセクションがあり、**Search providers**(プロバイダーを検索)を使って探すこともできます。
3. **API key**(APIキー)欄にキーを貼り付けます。無料サービスとローカルサービスにはキーは不要です。自分で動かしているサーバーの場合は、アドレスの欄に入力します。
4. **Connect**(接続)をクリックします。Marinaraがアカウントをテストします。
5. 一覧から画像モデルを選ぶか、モデルIDを入力します。これが画像モデルになります。**Connections**パネルで、そのアカウントの下に表示されます。
6. 画像モデルを開き、**Test image**(画像をテスト)をクリックします。Marinaraが小さなテスト画像を作ります。
7. アプリが画像に使うモデルにするには、**Connections**パネル上部の**Defaults**(デフォルト)で、**Images**(画像)の役割に設定します。

アカウントに別の画像モデルを追加するには、そのアカウントの**⋯**メニューを開き、**Add image model**(画像モデルを追加)をクリックします。ウィンドウ全体については[AIプロバイダーへの接続](../connections/connecting-to-a-provider.md)を参照してください。

うまくいかなかった場合: キーかアドレスが間違っていると、**Test image**は失敗します。まずその両方を確認してください。**Test provider**(プロバイダーをテスト)は、Marinaraがサービスに到達できるかどうかだけを確認します。**Test image**は実際に画像を作るので、クレジットを消費することがあります。

## チャットで画像を作る

画像モデルを**Images**(画像)の役割に設定したら、チャットで画像を依頼します。

1. RoleplayのチャットにIllustratorエージェントを追加します。[Illustratorエージェント](illustrator-agent.md)を参照してください。
2. **Chat Settings**(チャット設定)を開き、**Gallery**(ギャラリー)を展開して、**Illustrate**(イラストを生成)をクリックします。
3. **Generating...**の表示が終わるまで待ちます。画像がGalleryに表示されます。

Roleplayのチャットでは、`/illustrate`コマンドも使えます。[スラッシュコマンド](../chats/slash-commands.md)を参照してください。

## サービスの選び方

各サービスのアドレスはMarinaraが自動で入力します。クラウドサービスにはアカウントが必要で、ほとんどはAPIキーも必要です。無料サービスにキーは要りません。ローカルサービスは、自分のコンピューターで画像生成ソフトを動かします。

**いちばん手軽な始め方:** **Pollinations**を選びます。無料で、アカウントもキーも要りません。もっと良い画像がほしくなったら、あとでより高性能なサービスを選んでください。

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

設定の簡単なサービスについての補足です。

- **OpenAI (DALL-E)**: DALL-EとGPT Imageのモデルを利用できます。ループするGIFを作れるのはGPT Image 2.6だけです。[GPT Image 2.6](#gpt-image-26)を参照してください。
- **Stability AI**: Stable DiffusionとStable Imageのモデルを利用できます。
- **Together AI**: FLUXをはじめとするオープンな画像モデルを利用できます。
- **OpenRouter Images**: OpenRouterのチャット用インターフェイスを経由して画像モデルを利用するため、使えるモデルはアカウントによって変わります。
- **xAI / Grok Imagine**: Grok Imagineを使います。
- **NanoGPT**: 複数のサービスをまとめるアグリゲーターなので、NanoGPTのモデル一覧から選んでください。
- **Pollinations**: 画像生成をいちばん手早く試せます。アカウントは不要です。
- **Stable Horde**: 有志のコンピューターを集めたクラウドソーシング型のネットワークです。無料のキーを取得すると、順番待ちの優先度が上がります。
- **SD Web UI**と**Draw Things**: ソフトウェアは、アプリケーションインターフェイスをオンにした状態で起動してください。MarinaraはDraw ThingsをAUTOMATIC1111のサーバーと同じように扱います(このアプリはmacOSまたはiOSで動きます)。
- **Block Entropy**: MarinaraにはBlock Entropy専用の処理がないため、OpenAI互換のリクエストを送ります。互換性は確認されていません。本格的に使う前に**Test image**(画像をテスト)で試してください。

## 特別な設定が必要なサービス

### GPT Image 2.6

GPT Image 2.6は**OpenAI (DALL-E)**のアカウントで動きます。**GPT Image 2.6 Flare**は速いほうのモデルです。**GPT Image 2.6 Sunburst**は品質がより高く、編集を重ねてもより安定します。どちらもGPT Image 2.5と同じサイズと透過背景に対応し、**Image quality**(画質)は**Max**(最大)まで上げられます。

このモデルは、描く前に画像ごとに計画を立てます。計画を減らすには、画像モデルの**Custom Parameters**(カスタムパラメーター)に`{"complexity": "low"}`または`{"complexity": "medium"}`を追加してください。デフォルトは`high`です。complexityが高いほど時間がかかることがあり、編集では頼んだ以上に変更されることがあります。

GPT Image 2.6は、短いループGIFも作れます。MarinaraがGIFを依頼するのは、機能やダウンロードしたエージェントがGIFを提供している場合だけです。

| 制限 | 値 |
| --- | --- |
| アカウント | APIキーを使う**OpenAI (DALL-E)** |
| モデル | GPT Image 2.6 FlareまたはSunburst |
| フレーム数 | 2から12枚、デフォルトは9枚 |
| フレームの長さ | 20から2000 ms、デフォルトは200 ms |
| フレームサイズ | 約0.66 MP: 正方形なら816x816、縦長なら608x1088 |
| 送る画像 | なし。GIFはプロンプトだけから描かれます |
| 透過背景 | 非対応 |

OpenAIはもっと多くのフレームを認めていますが、1つのGIFに使えるピクセル数を公開していないため、Marinaraは小さなフレーム12枚までにとどめます。**ChatGPT (Codex login)**、**OpenRouter Images**、**NanoGPT**、ToAPIs、その他のサービスはGIFを作れません。Marinaraはこうしたリクエストを何も送らないうちに拒否するので、料金はかかりません。**OpenAI-compatible**(OpenAI互換)のアカウントは、OpenAIと同じように試します。

失敗したGIFが静止画に置き換えられることはありません。サービスが静止画を返した場合、リクエストは失敗します。**Images**(画像)の役割の**If it fails**(失敗したとき)のモデルは、GIFを作れる場合にだけ試されます。

> **Warning:** OpenAIはGIFの料金を公開していません。GIF 1つで画像数枚分の料金がかかるものと考えてください。代わりに静止画が返ってきた場合も、その分の料金がかかります。

### ChatGPT (Codex login)

このサービスはAPIキーの代わりにChatGPTのプランを使うので、画像生成にOpenAIのAPIクレジットは要りません。

1. Marinaraが動いているコンピューターにCodex CLIをインストールし、`codex login`を一度だけ実行します。ChatGPTのチャット用アカウントが使うのと同じサインインです。[Claude、ChatGPT、Grokのサブスクリプション接続](../connections/subscription-clis.md#openai-chatgpt)を参照してください。
2. サービスを選びます。キーやアドレスを入力する必要はありません。モデルには、Codexが画像に使う`gpt-image-2`をMarinaraが自動で入力します。

**Test provider**(プロバイダーをテスト)は、MarinaraがCodexのログイン情報を読み取れるかどうかだけを確認します。**Test image**(画像をテスト)は実際に画像を作るので、ChatGPTの画像生成の利用上限にカウントされます。GPT Image 2.6のモデルIDを指定しても、このサービスではGIFを作れません。参照画像がある場合、Marinaraは最大16枚の参照画像を付けて編集リクエストを送ります。ChatGPTは異なるピクセルサイズで画像を返すことがあるため、Marinaraは希望するアスペクト比をプロンプトにも明記します。このサービスはOpenAIの公開APIではなく、Codexが使うChatGPTの画像エンドポイントを使うため、OpenAIによって予告なく変更される可能性があります。

### Arli AI

ホスト型のStable Diffusionモデルを動かします。モデルの指定が必須なので、使いたいArli AIの画像モデルの名前を入力してください。**Local Image Defaults**(ローカル画像のデフォルト設定)では、SD Web UIと同じ欄を使います([Local Image Defaults](#local-image-defaults-per-connection)を参照)。参照画像は、1枚目が元画像として使われます。このサービスは画像専用です。Arli AIのチャットモデルについては、[対応しているAIプロバイダー](../connections/providers-reference.md#arli-ai)を参照してください。

### NovelAI

NovelAIはアニメ調のイラストを得意とします。V4、V4.5、V5のモデルでは、複数のキャラクターが登場する絵コンテやIllustratorのシーンに対して、Marinaraが位置情報付きのキャラクターごとのプロンプトをNovelAI標準の形式で送ります。精密な参照画像は、V4.5のモデルでしか動作しません。

### Venice.ai

MarinaraはVenice独自の画像エンドポイントを使い、Veniceの任意設定であるセーフモードのぼかしをオフにして、指定されたサイズを各モデルのサイズ形式に変換します。それでも、Venice自身のポリシーやモデルの制限によってリクエストが拒否されることはあります。

### Z.AI

Z.AIの一般向けAPIキーを使ってください。GLM Coding Planのキーと`/api/coding/paas/v4`のアドレスは、画像生成には使えません。**GLM-Image**か**CogView 4**を選びます。Marinaraはアスペクト比をモデルが対応するサイズに変換し、一時的な結果をローカルストレージにダウンロードします。text-to-image専用で、参照画像は送りません。

### Atlas Cloud

MarinaraはAtlas Cloudの最新のtext-to-imageとimage-to-imageのカタログを読み込みます。読み込めない場合は、初期リスト(Nano Banana、Gemini Flash Image、FLUX 1.1 Pro)を表示します。正確なモデルIDは、いつでも直接入力できます。ジョブは非同期で実行されるため、Marinaraはジョブを開始し、画像ができあがるまで状態を問い合わせます。参照画像は、image-to-image、編集、Kontextの動作をうたうモデルIDに送られます。Atlasのモデルはスキーマがそれぞれ異なるため、ほかのIDについては、そのモデルのAtlas Cloudドキュメントを確認してください。

### fal.ai

[fal.ai](https://fal.ai/dashboard/keys)でAPIキーを作成します。初期リストには`fal-ai/flux/schnell`と`fal-ai/flux/dev`があります。入力と出力の形式が対応している、別のtext-to-imageエンドポイントIDも入力できます。**Test provider**(プロバイダーをテスト)は設定だけを確認します。**Test image**(画像をテスト)は実際にリクエストを送り、fal.aiのクレジットを消費します。

Marinaraはプロンプトとサイズを送り、最初に返された画像をダウンロードします。ネガティブプロンプトはテキストとして追加されます。`seed`、`num_inference_steps`、`image_size`などのモデルのオプションには、**Custom Parameters**(カスタムパラメーター)を使ってください。同期式のtext-to-imageリクエストを使い、参照画像は送らず、中断したジョブは再開しません。モデルの[APIリファレンス](https://fal.ai/models/fal-ai/flux/schnell/api)を参照してください。

### SpicyAPI

[SpicyAPIのコンソール](https://spicyapi.ai/console/keys)でキーを作成し、**SpicyAPI**を選びます。モデルには`alibaba/z-image-spicy-pro/text-to-image`をMarinaraが自動で入力します。`bytedance/seedream-5.0-pro/text-to-image`のように、別のIDを入力することもできます。**Test provider**(プロバイダーをテスト)はモデル一覧を読み取るだけなので、費用はかかりません。**Test image**(画像をテスト)は実際に画像を作り、残高を消費します。

**SpicyAPI**のサービスを選んでください。**OpenAI (DALL-E)**や、SpicyAPIのアドレスを入れたOpenAI互換のアカウントは使わないでください。SpicyAPIのOpenAI形式のアドレスは、テキストしか扱いません。

モデルごとに受け付ける設定が異なります。Marinaraは、モデルが受け付ける設定をSpicyAPIに問い合わせてそれだけを送り、モデルが用意している形式のうち最も近いもの(アスペクト比、幅と高さ、固定サイズ)を使います。ネガティブプロンプトの欄がないモデルでは、ネガティブプロンプトをプロンプトの末尾に追加します。`seed`、`resolution`、`loras`などのその他のオプションには、**Custom Parameters**(カスタムパラメーター)を使ってください。

画像は1枚ずつタスクとして処理されます。Marinaraは完了を待ち、1分ほどたったら状態を確認し直してから、結果をダウンロードします。接続が切れた場合は、新しいタスクに料金を払うのではなく、同じタスクを引き継ぎます。編集モデル(IDが`/edit`で終わるもの)には参照画像が送られます。SpicyAPIが受け付けるのは1枚あたり1 MBまで、1リクエストあたり2 MBまでなので、Marinaraは大きい画像を縮小し、収まらない分の画像は送りません。

### SwarmUI

SwarmUIは、ComfyUIの処理を独自のキューに振り分けられます。アカウントのないローカルサーバーなら、キーは不要です。サーバーでアカウントが必要な場合は、**API key**(APIキー)にSwarm Auth Tokenを貼り付けます。モデル一覧には、SwarmUIサーバーにあるモデルが表示されます。

**ComfyUI workflow (optional)**(ComfyUIワークフロー、任意)欄は空のままでかまいません。空のままにするとSwarmUI自身の画像設定を使います。ワークフローを貼り付けることもできます(後述)。各画像をSwarmUIの出力フォルダーにも残すには、**Local Image Defaults**(ローカル画像のデフォルト設定)で**Save images in SwarmUI**(SwarmUIに画像を保存)をオンにします。どちらの場合も、Marinaraは自分用のコピーを保存します。

### ネットワーク上のローカルサービス

`localhost`は、Marinaraが動いているコンピューターを指します。そのコンピューター上のローカル画像サーバーなら、追加の設定なしで使えます。サーバーがネットワーク上の別のコンピューターで動いている場合は、サーバーの設定でローカルネットワークのアドレスを許可してください。[サーバー設定リファレンス](../CONFIGURATION.md)を参照してください。

サービスが画像データではなくURLを返す場合、Marinaraは通常の外部リクエストの確認を通して、公開CDNのURLをダウンロードします。結果のURLがプライベートアドレスやループバックの場合は、スキーム、ホスト名、ポートが設定済みの画像サービスと完全に一致するときだけ受け入れます。そのオリジンからのリダイレクトで、別のローカルサービスへ飛ぶことはできません。ローカルのプロキシが結果を別のプライベートオリジンに保存している場合は、画像APIと同じオリジンからそれらのファイルを配信するようにしてください。

## ComfyUIのワークフローJSONとRunPod

**ComfyUI**、**SwarmUI**、**RunPod Serverless (ComfyUI)**では、**ComfyUI workflow (optional)**(ComfyUIワークフロー、任意)または**(required)**(必須)の欄が表示されます。ComfyUIのバージョンに応じて、**Save (API Format)**、**Export (API)**、**Export to API**のいずれかで書き出したワークフローJSONを貼り付けます。この欄はComfyUIとSwarmUIでは任意、RunPodでは必須です。RunPodには、APIキーとしてのRunPodのAPIトークン、**RunPod endpoint ID**(RunPodのエンドポイントID)、そしてワークフローが必要です。

Marinaraに値を入れてほしい位置に、ワークフロー内で次のテキストマーカーを書いておきます。

- `%prompt%`と`%negative_prompt%`はプロンプトに使います。
- `%width%`、`%height%`、`%seed%`はサイズとシードに使います。
- `%model%`、`%steps%`、`%cfg%`、`%sampler%`、`%scheduler%`、`%denoise%`は生成設定に使います。
- `%reference_image%`と`%reference_image_01%`から`%reference_image_04%`までは、参照画像のデータに使います。
- `%reference_image_name%`と`%reference_image_name_01%`から`%reference_image_name_04%`までは、参照画像をアップロードし、ローカルのComfyUIのLoadImageノード用にそのファイル名を入れます。

中でも重要なのは`%prompt%`です。これがないと、エディターが警告します。ComfyUIでは、欄が空のときは組み込みのデフォルトワークフローを使います。SwarmUIでは、SwarmUI自身の設定を使います。RunPodにはデフォルトがないので、ワークフローが必須です。3つとも、base64の生データの参照画像を最大4枚まで受け付けます。ファイル名でアップロードするプレースホルダーは、ローカルのComfyUIでしか使えません。

エクスポートの詳しい手順、例、引用符のルール、参照画像、キャラクターごとのワークフロー、ネットワークからのアクセス、トラブルシューティングについては、[ComfyUIワークフローの設定](comfyui.md)を参照してください。

<a id="local-image-defaults-per-connection"></a>

## 接続ごとのLocal Image Defaults

**SD Web UI (AUTOMATIC1111 / Forge)**、**ComfyUI**、**NovelAI**、**Draw Things**、**Arli AI**、**SwarmUI**、**RunPod Serverless (ComfyUI)**の画像モデルには、**Local image defaults**(ローカル画像のデフォルト設定)パネルが表示されます。Draw ThingsとArli AIにはSD Web UIの欄が、SwarmUIとRunPodにはComfyUIの欄が表示されます。これらの設定は、このモデルで画像を作るときにだけ適用されます。**Reset**(リセット)で組み込みの値に戻せます。

どのサービスにも**Seed**欄があります。-1にすると、毎回ランダムな画像になります。ほかの数値を入れると、毎回そのシードを使います。そのほかの欄はサービスによって異なります。

| サービス | 欄 | デフォルト |
| --- | --- | --- |
| AUTOMATIC1111 / Forge | Steps | 20 |
| AUTOMATIC1111 / Forge | CFG scale | 7 |
| AUTOMATIC1111 / Forge | Sampler | Euler a |
| AUTOMATIC1111 / Forge | Img2img denoise | 0.6 |
| ComfyUI | Steps | 20 |
| ComfyUI | CFG scale | 7 |
| ComfyUI | Sampler | euler_ancestral |
| ComfyUI | Scheduler | normal |
| ComfyUI | Denoise | 1 |
| NovelAI | Steps | 28 |
| NovelAI | Prompt guidance | 6 |
| NovelAI | Sampler | k_euler_ancestral |
| NovelAI | Noise schedule | karras |

どのサービスにも**Prompt prefix**と**Negative prefix**の欄もあります。ここに入れたテキストは、このモデルで送るすべてのプロンプトの先頭に追加されます。AUTOMATIC1111 / ForgeとComfyUIには**Clip skip**欄があります。AUTOMATIC1111 / Forgeにはさらに**Restore faces**トグルがあります。ComfyUIには、参照画像がないときに1x1のプレースホルダー画像をアップロードするトグルがあります。これは、参照画像のプレースホルダーを含むカスタムワークフローでだけ意味を持ちます。NovelAIには**Guidance rescale**と**UC preset**があります。

## サービスごとに異なる参照画像への対応

参照画像とは、プロンプトと一緒に送る既存の画像で、新しい画像にキャラクターの顔や絵柄を引き継ぐためのものです。

| サービス | 参照画像 |
| --- | --- |
| OpenAI (DALL-E) | 最大16枚、GPT Imageのモデルのみ。GIFの場合はなし |
| ChatGPT (Codex login) | 最大16枚 |
| NovelAI | 最大16枚、V4.5のモデルのみ |
| xAI / Grok Imagine | 最大3枚 |
| NanoGPT | 最大3枚 |
| ComfyUI、RunPod Serverless (ComfyUI)、SwarmUI | 最大4枚、ワークフローのプレースホルダー経由 |
| Stability AI、Arli AI、SD Web UI、Draw Things | 1枚目のみ、image to imageとして使用 |
| Atlas Cloud | 1枚目、image-to-image、編集、Kontextに対応したモデルIDの場合 |
| SpicyAPI | 編集モデルのみ、モデルの上限まで。収まるように縮小 |
| OpenRouter Images | 対応、固定の上限なし |
| Venice.ai、Z.AI | text-to-imageでは非対応 |
| Together AI、Pollinations、Stable Horde、fal.ai | 非対応 |

NovelAIの精密な参照画像は、`nai-diffusion-4-5-full`のようなV4.5のモデルでしか動作しません。NovelAIはV5向けのPrecise Referenceをまだ公開していません。ほかのモデルで参照画像を指定すると、Marinaraは参照画像なしで画像を生成し、サーバーに警告を記録します。

## メディア生成リクエストを順番に処理

**Queue media generation requests**(メディア生成リクエストを順番に処理)トグルは、**Settings → Generations → Overall Generations**(設定 → 生成 → 生成全般)にあります。デフォルトはオンです。

オンのとき、Marinaraは画像のジョブを画像のアカウントごとに1件ずつ、動画のジョブを動画のアカウントごとに1件ずつ、別々のキューで送ります。同じアカウントでも、画像と動画は同時に処理できます。これは、画像や動画を求めるすべての機能に適用されます。対象は、Illustrator、トラッカー、コマンド、Gallery、Gameのアセット、Slurpのようなダウンロードしたエージェントです。アドレスとAPIキーが同じ2つのモデルは、キューを共有します。異なるアカウントは、引き続き同時に処理されます。NovelAIでは、ジョブの間に短い間隔も空けます。NovelAIが混雑していると応答した場合、Marinaraは待ってから、さらに2回まで再試行します。

同時に2件のリクエストを受け付けないサービスでは、オンのままにしてください。サービスが同時に多くのリクエストを処理でき、速さを優先したい場合だけオフにします。

## 関連ガイド

- [ComfyUIワークフローの設定](comfyui.md)
- [Illustratorエージェント](illustrator-agent.md)
- [画像スタイルプロファイル](style-profiles.md)
- [シーン背景とギャラリー](scene-backgrounds.md)
- [自撮り写真](../conversation/selfies.md)
- [対応しているAIプロバイダー](../connections/providers-reference.md)
