# 対応しているAIプロバイダー

このページは、Marinara Engineが接続できる主なサービスのリファレンスです。サービスごとに、APIキーの入手先、デフォルトのアドレス、知っておきたいクセをまとめています。アカウントを順を追って追加する方法は、先に[AIプロバイダーへの接続](connecting-to-a-provider.md)を読んでください。

サービスは、**Add account**(アカウントの追加)ウィンドウで、用途ごとのセクションから選びます。セクションは**Chat**(チャット)、**Images & video**(画像と動画)、**Voice**(音声)、**Decisions**(判定)です。タイルには、以下に挙げる名前が表示されます。アドレスとは、Marinaraがリクエストを送る宛先のWebアドレスです。アカウントエディターでは**Address**(アドレス)、モデルエディターでは**Base URL**(ベースURL)と呼ばれます。既知のサービスなら、Marinaraが自動で入力します。変更するのは、プロキシや自分で動かしているサーバーを使う場合だけにしてください。

モデルは頻繁に入れ替わるため、このページには一覧を載せていません。接続すると、選択画面にモデルの一覧が読み込まれます。読み込み直すには、選択画面で**Refresh model list**(モデル一覧を更新)をクリックします。

## チャットサービス

これらのサービスはAPIキーを使います。ただし、3つのサブスクリプションサービスは、自分のコンピューター上でのサインインを使います。

| サービス | キーの入手先 |
| --- | --- |
| LinkAPI | `linkapi.ai` |
| OpenAI | `platform.openai.com/api-keys` |
| Anthropic | `console.anthropic.com/settings/keys` |
| Google Gemini | `aistudio.google.com/apikey` |
| Google Vertex AI | `cloud.google.com/vertex-ai/docs/authentication`(資格情報のガイド) |
| Mistral | `console.mistral.ai/api-keys` |
| Cohere | `dashboard.cohere.com/api-keys` |
| OpenRouter | `openrouter.ai/keys` |
| NanoGPT | `nano-gpt.com/api` |
| xAI / Grok | `console.x.ai` |
| Arli AI | `www.arliai.com/account` |
| Z.AI | `z.ai/manage-apikey/apikey-list` |
| DeepSeek | `platform.deepseek.com/api_keys` |
| OpenAI-compatible、Claude (Subscription)、OpenAI (ChatGPT)、Grok CLI (Subscription) | キーのページはありません。下の注記を参照してください。 |

デフォルトのアドレスは次のとおりです。Marinaraが自動で入力します。

- LinkAPI: `https://linkapi.ai/v1`(独自のキーを使うOpenAI互換のゲートウェイ)
- OpenAI: `https://api.openai.com/v1`
- Anthropic: `https://api.anthropic.com/v1`
- Google Gemini: `https://generativelanguage.googleapis.com/v1beta`
- Google Vertex AI:
  `https://us-central1-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/us-central1`
- Mistral: `https://api.mistral.ai/v1`
- Cohere: `https://api.cohere.ai/compatibility/v1`
- OpenRouter: `https://openrouter.ai/api/v1`
- NanoGPT: `https://nano-gpt.com/api/v1`
- xAI / Grok: `https://api.x.ai/v1`
- Arli AI: `https://api.arliai.com/v1`
- Z.AI: `https://api.z.ai/api/paas/v4`
- DeepSeek: `https://api.deepseek.com/v1`
- OpenAI-compatibleとサブスクリプションサービス: なし。アドレスを自分で入力するか、アドレスが不要です。

キーのページのアドレスは、すべて`https://`で始まります。

3つのサブスクリプションサービスでは、**API key**(APIキー)欄とアドレス欄が表示されません。埋め込みにも対応していません。インストールとサインインの手順は[Claude、ChatGPT、Grokのサブスクリプション接続](subscription-clis.md)にあり、プランの使用量についてもそちらで説明しています。

アグリゲーターとは、1つのキーで多くの企業のモデルを利用できるサービスです。OpenRouterとNanoGPTはアグリゲーターです。ゲートウェイも同じ考え方のもので、自分で動かすか借りて使うプロキシを指します。

## サービスごとの注意点

### OpenAI

**OpenAI**はGPTシリーズのモデルを提供しています。DALL-Eの画像を使うには、**OpenAI**を追加し、同じアカウントで**Image**(画像)のモデルを選びます。同じキーで画像を作れるほかのサービスでも同様です。

### Anthropic

**Anthropic**はClaudeのモデルを提供しています。プロンプトキャッシュを使うと、サービスがプロンプトの冒頭部分を再利用できるため、長いチャットのコストを抑えられることがあります。モデルエディターの**Enable prompt caching**(プロンプトキャッシュを有効にする)でオンにします。**Anthropic**は埋め込みに対応していません([埋め込み](#embeddings)を参照)。

### Google GeminiとGoogle Vertex AI

**Google Gemini**は、Google AI Studio経由でGeminiのモデルを提供します。Googleの選択肢のうち、こちらのほうが手軽です。どちらのGoogleの選択肢でも、MarinaraはGoogleの調整可能なセーフティフィルターをオフにします。ただし、**Custom Parameters**(カスタムパラメーター)で自分で設定したカテゴリーは除きます。児童の安全などに関するGoogleの基本的な保護は引き続き適用されます。

**Google Vertex AI**は、Google CloudのプロジェクトからGeminiを利用するもので、設定の手間が多くかかります。アドレスを編集し、`YOUR_PROJECT_ID`を自分のプロジェクトIDに置き換えてください。リージョンが`us-central1`でない場合は、そこも変更します。**API key**(APIキー)欄には次のいずれかを入力でき、どれを貼り付けたかはMarinaraが判別します。

1. サービスアカウントのJSONキー(Google Cloudが発行する、サービスアカウントを指定したファイル)。
2. OAuthのアクセストークン(たとえば`gcloud auth print-access-token`で取得したもの)。
3. Vertex APIキー。

Googleのドキュメントに沿ったMarinaraのコード内の注記によると、**Gemini 4 Argon**は`global`、`us`、`eu`のロケーションでのみ動作し、`us-central1`のような単一のリージョンでは動きません。使うには、アドレスを`https://aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/global`に設定してください。ほかのロケーションではGoogleがエラーを返し、Marinaraがそのエラーを表示します。

### Cohere

**Cohere**はOpenAI互換のエンドポイントを使います。古いCohere v2のアドレスを貼り付けた場合は、Marinaraが互換エンドポイントに切り替えます。

### OpenRouter

**OpenRouter**はアグリゲーターで、モデルエディターに次の2つの項目が追加されます。

- **Preferred provider**(優先プロバイダー)は、転送先を名前で指定した1つのバックエンドに固定します。名前は、OpenRouterのモデルページに表示されているものと一致させる必要があります。自動で振り分ける場合は空のままにします。
- **Enable prompt caching**(プロンプトキャッシュを有効にする)は、OpenRouter経由で利用するClaudeのモデルにキャッシュのヒントを送ります。ほかのほとんどのモデルは自動でキャッシュします。

### NanoGPT

**NanoGPT**は、モデル一覧を内蔵していないアグリゲーターです。接続すると、アカウントで使えるモデルが選択画面に読み込まれます。選択画面はNanoGPTの詳細なカタログを読み、サブスクリプションの対象となるモデルに印を付けます。

| バッジ | 意味 |
| --- | --- |
| 緑色の`1x` | サブスクリプションに含まれ、通常の消費率です。 |
| `2x`などのより大きい値 | 含まれますが、入力トークン1個につき、割り当てからその倍数のトークンを消費します。 |
| **Paid** | 含まれません。使用料は有料残高から差し引かれます。 |
| バッジなし | NanoGPTにそのモデルのサブスクリプション情報がありませんでした。 |

#### サブスクリプション使用量

NanoGPTのサブスクリプションがある場合、アカウントに現在の割り当てを表示できます。

1. アカウントの行にある**⋯**をクリックし、**Edit account**(アカウントの編集)を選んで、**Usage and balance**(使用量と残高)を開きます。
2. 外部からの読み取りがオフになっている場合は、**Turn on**(オンにする)をクリックします。管理キーを追加するには、**Add a usage-only key**(使用量専用のキーを追加)をクリックし、キーを貼り付けて、**Show usage**(使用量を表示)をクリックします。
3. **Show the usage meter on the card**(カードに使用量メーターを表示)をオンにして保存します。

メーターには、週ごとと日ごとの入力トークンの割り当てが、残量とそれぞれのリセットまでの時間とともに表示されます。たとえば`42M remaining · resets in 4d`です。NanoGPTが報告できない割り当ては、未使用ではなく不明として表示されます。無効なサブスクリプションは、全量が残っているようには描かれず、その状態が明示されます。更新ボタンで読み取り直せます。

使用量の読み取りには、次の2種類の認証情報を使えます。

- **管理キー**(推奨)。`https://nano-gpt.com/settings#management-api-tokens`で、使用量の読み取り専用として作成します。割り当てを読み取れますが、モデルの実行や残高の消費はできません。Marinaraは暗号化して保存し、NanoGPTの管理エンドポイントにだけ送信します。
- **自分のAPIキー**。管理キーが保存されていない場合に使われます。これでも動作しますが、割り当ての読み取りに、残高を消費できるキーを使うことになります。

同じメーターは、チャットの接続選択にあるコンテキストバーの下と、チャットの**Connection**(接続)設定にも表示されます。チャットのモデルがNanoGPTのもので、メーターがオンになっている場合だけ表示され、**Shuffle**(シャッフル)では表示されません。

### xAI / Grok

**xAI / Grok**はGrokのモデルを提供しています。Grok 4.6と4.7は、500,000トークンのコンテキストウィンドウと、**Extra high**までの推論に対応しています。**Web Search**(ウェブ検索)を含むチャットツールに対応しているため、検索結果を完成した返信に反映できます。

### Arli AI

**Arli AI**は、モデル一覧を内蔵していないホスト型のチャットサービスです。接続すると、選択画面にモデルが読み込まれます。Arli AIで画像を作るには、**Arli AI**を追加し、同じアカウントで**Image**(画像)のモデルを選びます。

### Z.AI

**Z.AI**は、GLMモデル(GLM 5.3、GLM 5.3 Flash、およびそれ以前のモデル)を独自のAPIで提供しています。GLM 5.2と5.3のモデルは、**Maximum**(最大)の推論レベルを受け付けます。デフォルトのアドレスは従量課金用のエンドポイントです。Z.AIのCoding Planは別のエンドポイントを使うため、Coding Planのキーはここでは動作しない場合があります。

### DeepSeek

**DeepSeek**は`deepseek-flash`と`deepseek-v4-pro`を提供しています。DeepSeekはデフォルトで思考します。**Reasoning Effort**(推論の度合い)にはDeepSeek独自の段階を使い、**Off**(オフ)にするとそのリクエストでは思考しません。DeepSeekは中程度の指定をHighとして処理します。思考の内容は、いつもの思考表示で返信に表示されます。

適用されないパラメーターもあるため、パネルではそれらを表示しません。**Verbosity**、**Top K**、各種ペナルティーは廃止されており、無視されます。DeepSeekは一度にどちらか一方しか使わないため、**Temperature**(温度)と**Top P**は対になっています。思考がオフのときは**Temperature**が、オンのときは**Top P**が表示されます。

DeepSeekには、**OpenAI**にDeepSeekのアドレスを指定するのではなく、DeepSeek専用のタイルで接続してください。OpenAIのサービスはOpenAIのモデルを前提としているため、DeepSeekのモデルでは生成の設定項目が非表示になり、設定のほとんどが送信されません。

### OpenAI-compatible

**OpenAI-compatible**は、Ollama、LM Studio、KoboldCppなど、OpenAIのリクエスト形式を受け付けるサーバーやプロキシに接続します。**Add account**(アカウントの追加)ウィンドウでは、**OpenAI-compatible address**(OpenAI互換のアドレス)として表示されます。ほとんどのローカルサーバーでは、キーは空のままでかまいません。アドレスは自分で入力します。[ローカルモデルやセルフホストモデルへの接続](local-self-hosted.md)を参照してください。Marinaraが自分で動かす小さなモデルについては、[内蔵モデルのセットアップ](local-model.md)を参照してください。

## 画像と動画

**Images & video**(画像と動画)の下にある各タイルには、それぞれ独自のアドレスがあり、キーが必要かどうかもタイルごとに異なります。タイルは、Stability AI、Together AI、NovelAI、Venice.ai、Atlas Cloud、fal.ai、SpicyAPI、Pollinations、Stable Horde、Seedance 2.0と、ローカルサーバーのComfyUI、SD Web UI (AUTOMATIC1111 / Forge)、SwarmUI、RunPod Serverless (ComfyUI)、Draw Things、Block Entropyです。Draw Things、ComfyUI、SwarmUI、SD Web UI、RunPodには**Self-hosted**(セルフホスト)のタグが付きます。

OpenAI、OpenRouter、xAI、NanoGPT、Arli AI、Z.AI、Googleの画像と動画のモデルは、そのサービスのチャット用アカウントから使います。チャット用のアカウントを追加し、そのアカウントで**Image**(画像)または**Video**(動画)のモデルを選んでください。

[画像生成プロバイダーと設定](../media/image-providers.md)と[シーン動画の生成](../media/scene-video.md)を参照してください。

## Decision

**Decisions**(判定)の下にあるタイルは、**TypeSafe**(デフォルトのアドレスは`https://api.typesafe.ai`)、**Own decision server**(自分の判定サーバー)、**Built-in model (decisions)**(判定用の内蔵モデル)です。OpenAIのチャット形式を使うチャットサービスも判定に使えますが、対数確率(考えられる各回答のスコア)を返すモデルに限られます。Decisionモデルは、チャットについてのはい・いいえの質問に答えます。[Decisionモデル](decision-models.md)を参照してください。

## Audio

**Voice**(音声)の下にある音声サービスは、キャラクターの声とナレーションを読み上げます。**Audio source**(音声の提供元)を選びます。

| ソース | 内容 |
| --- | --- |
| ElevenLabs | キャラクターの声とナレーション。 |
| OpenAI-compatible | OpenAI、またはOpenAIの音声形式に合わせた任意のサーバー。 |
| PocketTTS | 自分のコンピューターで動かす無料の音声サーバー。 |
| xAI Voice | xAIの音声サービス。 |

ソースごとに、デフォルトのアドレスとモデルが入力されます。**Default voice**(デフォルトの声)は、キャラクターごとの声など、より細かい指定がないときに使われる声です。**Request timeout (seconds)**(リクエストのタイムアウト、秒単位)は、Marinaraが読み上げる1行を待つ時間です。音声サーバーが遅い場合は値を大きくしてください。

Marinaraがデフォルトで使う読み上げ用のアカウントを選ぶには、**Jobs**(役割)ボックスの**Voice (Text to Speech)**(音声合成)の行をクリックします。そのアカウントでメッセージを読み上げるには、**Text to Speech**(音声合成)カードの**Source**(音声の提供元)でそのアカウントを選びます。[Text to Speech (TTS)の設定](../media/tts-setup.md)と[音声の接続を使う](../media/tts-setup.md#use-an-audio-connection)を参照してください。

<a id="music--sound-effects"></a>

## Music & Sound Effects

この種類のアカウントは、読み上げとは別に、インストゥルメンタルの音楽と効果音を作ります。**Add account**(アカウントの追加)ウィンドウには、このアカウント用のタイルはありません。これらのアカウントは、アップグレード(下記を参照)かインポートによって作られます。編集は**Edit model**(モデルの編集)で行い、そこでサービスを選んで、**Music generation**(音楽生成)、**Sound-effect generation**(効果音生成)、またはその両方をオンにします。Gameのセットアップでは**Music & Sound Effects account**(音楽と効果音のアカウント)でアカウントを指定します。デフォルトの選択肢は**Use the default Music & Sound Effects account**(デフォルトの音楽と効果音のアカウントを使用)です。

サービスは次のとおりです。

- **ElevenLabs**: デフォルトのアドレスは`https://api.elevenlabs.io`です。ElevenLabsのキーが必要です。音楽と効果音には別々のモデル欄があります。
- **SunoAPI**: デフォルトのアドレスは`https://apibox.erweima.ai`です。[sunoapi.org](https://sunoapi.org/)のキーが必要で、音楽をオンにする場合は公開HTTPSの**SunoAPI music callback URL**(SunoAPIの音楽コールバックURL)も必要です。これはSunoAPI独自のサービスで、Sunoのサブスクリプションへのサインインではありません。
- **Custom compatible server**(カスタム互換サーバー): 自分のサーバーのアドレスです。音楽または効果音の明示的なエンドポイントパスと、対応するリクエスト形式が必要です。[互換オーディオの入出力仕様](../media/tts-setup.md#game-music-and-sound-effects-on-a-compatible-audio-server)を参照してください。

注意点:

- Marinaraはトラックの完成を自分で確認しますが、SunoAPIにはコールバックアドレスが必要です。アドレスは自分で用意してください。Marinaraは作成しません。
- 音楽スタイルのプロンプトは最大1,000文字、効果音のプロンプトは最大500文字です。
- リクエストごとに、プロバイダーの料金が発生する場合があります。[音楽API](https://docs.sunoapi.org/suno-api/generate-music)と[効果音API](https://docs.sunoapi.org/suno-api/generate-sounds)を参照してください。SunoAPIの効果音は、有料アカウントではまだ検証していません。

アップグレードすると、生成がオンになっている各Audioアカウントに、別のMusic & Sound Effectsアカウントが追加されます。以前の独立したElevenLabsのGame設定からも専用のアカウントが作成される場合があるため、複数表示されることがあります。読み上げ用のアカウントと声の割り当ては変わらず、保存済みのGameのアカウントIDも変わりません。生成が動作するのは、対応する移行済みのアカウントが利用でき、音楽または効果音のオプションがオンになっている場合だけです。それ以外の場合は、適切な別のアカウントを選んでください。移行されたアカウントを削除しても、再起動で再作成されることはありません。プロファイルから復元したエンドポイントは、ローカルで確認して保存するまで使えません。

生成オーディオはGameごとにオンにします。または、Roleplayのコマンド設定で**Sound effects**(効果音)をオンにすると、`[sound: description]`を使えます。Gacha Forgeには独自のオーディオ生成設定があります。生成がオフでも、同梱のGameの音声は使えます。

<a id="embeddings"></a>

## 埋め込み

埋め込みは、テキストを数値の並びに変換し、Marinaraが関連するテキストを見つけられるようにする仕組みです。ロアブックのセマンティック検索とMemory Recallを支えています。ほとんどのチャットサービスでは、モデルエディターの**Semantic search (embeddings)**(埋め込みによるセマンティック検索)で、埋め込みモデルと、任意の**Embedding endpoint URL**(埋め込みエンドポイントのURL)を設定できます。

**Anthropic**、**Claude (Subscription)**、**OpenAI (ChatGPT)**、**Grok CLI (Subscription)**は埋め込みを作れません。これらを使う場合は、**Embedding provider**(埋め込み用のプロバイダー)ドロップダウンで、OpenAI互換のアカウント、**Google Gemini**、**Built-in model**(内蔵モデル)など、ほかのアカウントを借ります。

独自の埋め込み設定がないすべてのアカウントで1つの埋め込みの生成元を使うには、**Jobs**(役割)ボックスの**Embeddings**(埋め込み)の行をクリックします。**Marinara's own search**(Marinara独自の検索)を選ぶと、内蔵の埋め込みモデルを使い続けます。アカウント自身の埋め込みモデルや**Embedding provider**の設定は、引き続き優先されます。変更した後は、ロアブックと記憶をベクトル化し直してください。[ロアブックのセマンティック検索](../lorebooks/semantic-search.md)を参照してください。

## タイムアウト

遅いモデルでは、チャットの返信やエージェントの呼び出しがサーバーの制限時間に達することがあります。これらの制限時間を決めるサーバー側の設定は、[サーバー設定](../CONFIGURATION.md)にあります。

## 関連ガイド

- [AIプロバイダーへの接続](connecting-to-a-provider.md)
- [Claude、ChatGPT、Grokのサブスクリプション接続](subscription-clis.md)
- [ローカルモデルやセルフホストモデルへの接続](local-self-hosted.md)
- [画像生成プロバイダーと設定](../media/image-providers.md)
- [シーン動画の生成](../media/scene-video.md)
- [Decisionモデル](decision-models.md)
- [Text to Speech (TTS)の設定](../media/tts-setup.md)
