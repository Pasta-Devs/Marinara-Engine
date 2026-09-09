# 対応しているAIプロバイダー

このガイドでは、Marinara Engineが接続できるAIプロバイダーをすべて紹介します。プロバイダーごとに、APIキーの入手先、デフォルトのBase URL、知っておきたいクセをまとめました。APIキーとは、プロバイダーが発行するパスワードのような秘密の文字列です。これがあることで、MarinaraはそのAIサービスとやり取りできます。

接続を追加する一般的な手順は、先に[AIプロバイダーへの接続](connecting-to-a-provider.md)をお読みください。このページは、特定のプロバイダーの詳細を調べたいときに検索して使うリファレンスです。

## このページの読み方

プロバイダーは、**Connections**(接続)パネルで接続を作成するときに選びます。**Create Connection**(接続の作成)ウィンドウには、プロバイダーごとに**Provider**(プロバイダー)ボタンが並びます。ボタンのラベルは、以下に挙げる名前とまったく同じです。

このページに載っているプロバイダーの多くは、AIを代わりに動かしてくれるクラウドサービスです。プロバイダーでアカウントを作り、APIキーをコピーして、**API Key**(APIキー)欄に貼り付けます。サブスクリプション型の3つのプロバイダーだけは、キーの代わりにローカルでのサインインを使います。該当するセクションにその旨を書いてあります。

次の2つの用語がこのあと何度も出てきます。

- Base URL: Marinaraがリクエストを送る宛先のWebアドレスです。ほとんどのプロバイダーでは自動的に入力されます。変更が必要なのは、ローカルサーバーやカスタムサーバーを使う場合だけです。
- Model: プロバイダーを選んだあとに指定する、具体的なAIモデルです。使えるモデルは頻繁に入れ替わるため、このページには一覧を載せていません。最新の一覧は、接続エディターの**Model**(モデル)ドロップダウン、または**Fetch Models from API**(APIからモデルを取得)ボタンで確認できます。

## OpenAI

- キーの入手先: `https://platform.openai.com/api-keys`
- デフォルトのBase URL: `https://api.openai.com/v1`

**OpenAI**はGPTシリーズのモデルを提供しています。キーを貼り付けたら、ドロップダウンからモデルを選ぶか、**Fetch Models from API**をクリックして最新の一覧を読み込みます。この接続で使えるのはチャット用のモデルだけです。DALL-Eの画像を使いたい場合は、代わりに**Image Generation**プロバイダーとその**OpenAI (DALL-E)**サービスを利用します。

## Anthropic

- キーの入手先: `https://console.anthropic.com/settings/keys`
- デフォルトのBase URL: `https://api.anthropic.com/v1`

**Anthropic**はClaudeのモデルを提供しています。プロンプトキャッシュに対応しており、長いチャットのコストを抑えられます。接続エディターの**Enable prompt caching**(プロンプトキャッシュを有効にする)トグルでオンにできます。

**Anthropic**は埋め込みに対応していません。埋め込みとは、テキストを数値の並びに変換する仕組みです。これによってMarinaraはロアブックや記憶を検索できます。この機能を使うには、埋め込み用の接続を別に用意します(下の「埋め込み」のセクションを参照)。

## Google Gemini

- キーの入手先: `https://aistudio.google.com/apikey`
- デフォルトのBase URL: `https://generativelanguage.googleapis.com/v1beta`

**Google Gemini**は、Google AI Studio経由でGeminiのモデルを提供します。2つあるGoogleの選択肢のうち、こちらのほうが手軽です。

## Google Vertex AI

- 資格情報のドキュメント: `https://cloud.google.com/vertex-ai/docs/authentication`
- デフォルトのBase URL: `https://us-central1-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/us-central1`

**Google Vertex AI**は、Google CloudのプロジェクトからGeminiのモデルを利用します。**Google Gemini**より設定の手間がかかります。**Base URL**を編集し、`YOUR_PROJECT_ID`を実際のプロジェクトIDに置き換えてください。リージョンが`us-central1`でない場合は、そこも変更します。

**API Key**欄には、次の3種類の資格情報のいずれかを入力できます。どれを貼り付けたかはMarinaraが自動で判別します。

1. サービスアカウントのJSONキー。
2. OAuthのアクセストークン(たとえば`gcloud auth print-access-token`で取得したもの)。
3. Vertex APIキー。

## Mistral

- キーの入手先: `https://console.mistral.ai/api-keys`
- デフォルトのBase URL: `https://api.mistral.ai/v1`

**Mistral**はMistralシリーズのモデルを提供しています。APIキー以外に特別な設定は必要ありません。

## Cohere

- キーの入手先: `https://dashboard.cohere.com/api-keys`
- デフォルトのBase URL: `https://api.cohere.ai/compatibility/v1`

**Cohere**はデフォルトでOpenAI互換のエンドポイントを使います。古いCohere v2のURLを貼り付けた場合は、Marinaraが互換エンドポイントに切り替えます。リクエストはそのまま動作します。

## OpenRouter

- キーの入手先: `https://openrouter.ai/keys`
- デフォルトのBase URL: `https://openrouter.ai/api/v1`

**OpenRouter**は複数のサービスをまとめて扱うアグリゲーターです。1つのキーで、さまざまな企業の多くのモデルを利用できます。接続エディターには次の2つの項目が追加されます。

- **Preferred Provider**(優先プロバイダー): **OpenRouter**の転送先を特定のバックエンドに固定するテキスト欄です。名前は、OpenRouterのモデルページに表示されているものと完全に一致させてください。自動で振り分けたい場合は空のままにします。
- **Enable prompt caching**: **OpenRouter**経由で利用するClaudeのモデルにキャッシュのヒントを送ります。**OpenRouter**上のほかのモデルは自動でキャッシュするため、通常は不要です。

## NanoGPT

- キーの入手先: `https://nano-gpt.com/api`
- デフォルトのBase URL: `https://nano-gpt.com/api/v1`

**NanoGPT**もアグリゲーターです。モデル一覧を内蔵していないため、**Model**ドロップダウンは最初は空です。キーを貼り付けたら、**Fetch Models from API**をクリックして、アカウントで使えるモデルを読み込みます。

## xAI / Grok

- キーの入手先: `https://console.x.ai`
- デフォルトのBase URL: `https://api.x.ai/v1`

**xAI / Grok**はGrokのモデルを提供しています。**Create Connection**ウィンドウでこのプロバイダーを選ぶと、モデルにはGrok 4.5があらかじめ入ります。あとから変更できます。

## Z.AI

- キーの入手先: `https://z.ai/manage-apikey/apikey-list`
- デフォルトのBase URL: `https://api.z.ai/api/paas/v4`

**Z.AI**は、GLMモデル(GLM 5.3、GLM 5.3 Flash、およびそれ以前のモデル)を独自のAPIで提供しています。**Model**ドロップダウンには現在のGLMモデルが表示され、**Fetch Models from API**でアカウントから一覧を更新できます。GLM 5.3モデルは常に推論を行います。プリセットの**Reasoning Effort**(推論の強度)は、Z.AIが受け付ける**Low**(低)、**High**(高)、**Maximum**(最大)の3段階に対応付けられます。未設定の場合は、Z.AIのデフォルトである**Maximum**が使われます。デフォルトのBase URLは従量課金用のエンドポイントです。Z.AIのCoding Planは別のエンドポイントを使い、利用規約では指定の一覧にあるツール専用とされています。そのため、この接続でCoding Planのキーが動作することは想定されていません。

## Claude (Subscription)

- APIキー: 不要です。代わりにローカルのツールにサインインします。

**Claude (Subscription)**は、Claude Codeというツールを介してAnthropicのProプランまたはMaxプランを利用します。ツールはMarinaraのサーバーが動いているコンピューターで実行し、最初に一度だけサインインします。このプロバイダーでは**API Key**欄と**Base URL**欄は表示されません。埋め込みには対応していません(下の「埋め込み」のセクションを参照)。

インストールとログインの手順は[Claude、ChatGPT、Grokのサブスクリプション接続](subscription-clis.md)にあります。

## OpenAI (ChatGPT)

- APIキー: 不要です。代わりにローカルのツールにサインインします。

**OpenAI (ChatGPT)**は、Codexというツールを介してChatGPTのアカウントを利用します。ツールはMarinaraのサーバーが動いているコンピューターで実行し、最初に一度だけサインインします。このプロバイダーでは**API Key**欄と**Base URL**欄は表示されません。埋め込みには対応していません(下の「埋め込み」のセクションを参照)。

インストールとログインの手順は[Claude、ChatGPT、Grokのサブスクリプション接続](subscription-clis.md)にあります。

## Grok CLI (Subscription)

- APIキー: 不要です。代わりにローカルのツールにサインインします。

**Grok CLI (Subscription)**は、Grok CLIというツールを介してSuperGrokまたはX Premium+のアカウントを利用します。ツールはMarinaraのサーバーが動いているコンピューターで実行し、最初に一度だけサインインします。このプロバイダーでは**API Key**欄と**Base URL**欄は表示されません。埋め込みには対応していません(下の「埋め込み」のセクションを参照)。

インストールとログインの手順は[Claude、ChatGPT、Grokのサブスクリプション接続](subscription-clis.md)にあります。

## Custom (OAI-Compatible)

- デフォルトのBase URL: ありません。自分で入力します。

Ollama、LM Studio、KoboldCppのように、ローカルまたは自前で立てたモデルサーバーにつなぐときは**Custom (OAI-Compatible)**を選びます。OpenAIのチャット形式に対応したホスティング型のプロキシにも使えます。ほとんどのローカルサーバーでは、**API Key**は空のままでかまいません。**Base URL**にはサーバーのアドレスを入力します。

手順の詳しい説明と**Treat as local/custom endpoint**(ローカル/カスタムエンドポイントとして扱う)トグルについては、[ローカルモデルやセルフホストモデルへの接続](local-self-hosted.md)をお読みください。Marinaraに同梱されている小さなモデルについては、[Local Modelのセットアップ](local-model.md)を参照してください。

## Image Generation

**Image Generation**(画像生成)は特別なプロバイダーです。これを選んだあと、実際の処理を担当する画像バックエンドとして**Service**(サービス)も選びます。サービスごとにデフォルトのBase URLが違い、APIキーが必要かどうかも違います。サービスには、**OpenAI (DALL-E)**、**Stability AI**、**NovelAI**、**Z.AI**のような有料のクラウドAPIがあります。**Pollinations**や**Stable Horde**のような無料の選択肢もあります。**ComfyUI**や**SD Web UI (AUTOMATIC1111 / Forge)**のようなローカルサーバーも利用できます。

画像サービスの全一覧、その設定、生成のオプションは[画像生成プロバイダーと設定](../media/image-providers.md)にまとめています。

## Video Generation

**Video Generation**(動画生成)も特別なプロバイダーで、専用の**Video Service**(動画サービス)の選択肢があります。Game Modeでは、これを使って短いMP4のシーン動画を作ります。サービスは**Google AI Studio**、**xAI Imagine**、**OpenRouter Video**、**Seedance 2.0**です。どのサービスにもAPIキーが必要です。

各動画サービスの詳しい設定と制限は[シーン動画の生成](../media/scene-video.md)にまとめています。

## 埋め込み

埋め込みは、ロアブックの意味検索とMemory Recallを支える仕組みです。テキストを数値の並びに変換することで、Marinaraは関連するエントリーを見つけられます。ほとんどのチャットプロバイダーでは、接続エディターで**Embedding Model**(埋め込みモデル)と、任意で**Embedding Endpoint URL**(埋め込みエンドポイントのURL)を設定できます。

埋め込みを作れないプロバイダーもあります。**Anthropic**、**Claude (Subscription)**、**OpenAI (ChatGPT)**、**Grok CLI (Subscription)**は対応していません。これらを使う場合は、**Embedding Connection**(埋め込み用の接続)ドロップダウンでほかの接続を借ります。OpenAI互換の接続、**Google Gemini**、内蔵の**Local Model**などが使えます。

## 関連ガイド

- [AIプロバイダーへの接続](connecting-to-a-provider.md)
- [Claude、ChatGPT、Grokのサブスクリプション接続](subscription-clis.md)
- [ローカルモデルやセルフホストモデルへの接続](local-self-hosted.md)
- [画像生成プロバイダーと設定](../media/image-providers.md)
- [シーン動画の生成](../media/scene-video.md)
