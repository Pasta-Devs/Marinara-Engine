# Text to Speech (TTS)の設定

Text to Speech (TTS)は、チャットのメッセージとゲームの語りを音声で読み上げます。このガイドでは、TTSをオンにする方法、音声サービスと声の選び方、自動再生の設定、メッセージごとの操作を説明します。

## クイックスタート

1. 上部バーの**Connections**(接続)をクリックし、**Add**(追加)をクリックします。
2. 種類のチップで**Voice**(音声)をクリックし、サービスを選んで**API key**(APIキー)にキーを貼り付けます。**Connect**(接続)をクリックします。
3. **Found in … — use it for:**で**Voice**にチェックを入れ、**Done**(完了)をクリックします。Voiceのモデルを選ぶと音声合成がオンになります。
4. **Jobs**(役割)ボックスの**Voice**の行の歯車をクリックし、**Preview**(プレビュー)でサンプルを聴きます。チャットでは、メッセージの下の**Speak**(読み上げ)をクリックします。

## 音声合成をオンにする

**Voice**(音声)の役割にモデルを選ぶと、音声合成がオンになります。各メッセージに**Speak**(読み上げ)ボタンが付き、**Auto-play**(自動再生)の選択肢が表示されます。どの内容をいつ読み上げるかは自分で選べます。

1. 上部バーの**Connections**(接続)をクリックします。**Jobs**(役割)ボックスの**Pictures & sound**(画像と音声)の下にある**Voice**の行を探します。
2. 行をクリックして音声モデルか音声サービスを選びます。選んだ内容が行に表示されます。
3. 行の歯車をクリックして音声の設定を開きます。音声アカウントがなければ、行の**Add**(追加)をクリックするか、クイックスタートの手順で追加します。
4. オフにするには、行をクリックして**Turn voice off**(音声をオフ)を選びます。行に**Off**(オフ)と表示され、読み上げが止まります。

音声を生成するサービスは、次の中から選べます。

- **OpenAI-compatible**: OpenAI、またはOpenAIのTTS形式に合わせた任意のサーバー。これがデフォルトです。
- **ElevenLabs**: ElevenLabsの音声サービス。
- **PocketTTS**: 自分のコンピューターで動かす無料の音声サーバー。
- **xAI Voice**: xAIの音声サービス。

Marinaraは音声サービスごとに、キー、アドレス、モデル、声、パラメーターを別々のプロファイルとして保存します。音声サービスを切り替えると、その音声サービスで前回使った設定が戻ります。まだ設定していない音声サービスは、デフォルトの状態から始まります。

リクエストは、Marinara自身のサーバーを経由して送られます。APIキーは、サーバー上で暗号化して保存されます。キーを保存すると、欄には伏せ字の点が並び、実際のキーがブラウザーに返ることはありません。

<a id="use-an-audio-connection"></a><a id="use-a-voice-model-from-an-account"></a>

### アカウントのVoiceモデルの利用

すでに**Audio**(音声)アカウントを追加していれば([対応しているAIプロバイダー](../connections/providers-reference.md#audio)を参照)、詳細を入力し直す必要はありません。そのアカウントの音声モデルが**Voice**(音声)の選択画面に表示されます。

1. **Jobs**(役割)ボックスの**Voice**の行をクリックしてモデルを選びます。
2. 行の歯車をクリックして、声やほかの設定を選びます。

Marinaraはアカウントのアドレス、キー、モデル、**Request timeout (seconds)**(リクエストのタイムアウト、秒単位)を使うので、音声の設定にはそれらの欄が表示されません。キーはアカウントに残り、音声の設定へコピーしたりブラウザーへ送信したりしません。キーの更新など、アカウントの変更はすぐに反映されます。

声、速度、ほかの読み上げ設定はアカウントごとに保存します。同じ種類のアカウント間でも共有しません。通常の4つの音声サービスの設定はそのまま残ります。

選んだアカウントが削除されたり利用できなくなったりすると、行に**The voice account is missing**(音声アカウントがありません)と表示され、別のモデルを選ぶまで読み上げは行われません。Marinaraが自動で切り替えることはありません。

## アドレス、キー、モデルを設定する

**Add account**(アカウントの追加)ウィンドウで求められるのはキーかアドレスだけです。後で変更するには、**Connections**(接続)でアカウントの**⋯**をクリックし、**Edit account**(アカウントの編集)を開きます。Audioアカウントを選んだ場合は、この手順を飛ばしてください。設定値はアカウントから取得します。

1. **Address**(アドレス)を確認します。サービスごとのデフォルト値は下の表のとおりです。プロキシか自分で動かすサーバーを使う場合だけ変更します。
2. **API key**(APIキー)にキーを貼り付けます。既存のキーをそのまま使うときは、伏せ字の点を残しておきます。キーを削除するときは、欄を空にします。
3. モデルを選ぶか、サービスが対応する別のモデルIDを入力します。

| 音声サービス | デフォルトのアドレス | デフォルトのモデル | デフォルトの声 |
| --- | --- | --- | --- |
| OpenAI-compatible | `https://api.openai.com/v1` | `tts-1` | `alloy` |
| ElevenLabs | `https://api.elevenlabs.io` | `eleven_multilingual_v2` | なし、自分で選ぶ必要があります |
| PocketTTS | `http://localhost:8000` | `pocket-tts` | `alba` |
| xAI Voice | `https://api.x.ai/v1` | `grok-tts` | `eve` |

**ElevenLabs**の場合、**Model**の一覧には、自分のアカウントで使える読み上げモデルが読み込まれます。通常の読み上げモデルを選んでください。IDに`ttv`を含むモデルは音声デザイン用で、テキストを読み上げられません。選ぶと、読み上げモデルを使うように促すエラーが出て、再生に失敗します。

### PocketTTS

PocketTTSはMarinaraに内蔵されていません。[公式PocketTTSサーバー](https://github.com/kyutai-labs/pocket-tts)を別途インストールし、`uvx pocket-tts serve`で起動してください。Marinaraがダウンロードや管理をすることはありません。公式サーバーは`http://localhost:8000`を使います。ホストやポートを変えていなければ、**Address**はこの値のままにします。Marinaraは公式のmultipart `/tts` APIを検出します。[OpenAI互換PocketTTSラッパー](https://github.com/teddybear082/pocket-tts-openai_streaming_server)用の独自URLも引き続き使えます。

<a id="request-timeout"></a>

### リクエストのタイムアウト

Marinaraは1行の読み上げにつき最大60秒待ちます。自分のコンピューター、特にノートパソコン上の音声サーバーでは、長い行にさらに時間がかかることがあります。**Voice settings**(音声の設定)の**More**(その他)にある**Request timeout (seconds)**(リクエストのタイムアウト、秒単位)を大きくしてください。**Jobs**(役割)ボックスで**Voice**(音声)の行にある歯車から開けます。範囲は10～3,600秒です。

Audioアカウントには固有の**Request timeout (seconds)**があり、モデルの**Edit model**(モデルの編集)で**Default voice**(デフォルトの声)の下、および**Voice settings**にあります。**Voice**に選んだアカウントも含め、Audioアカウント経由の読み上げにはアカウントの上限を使います。**Voice settings**の上限は、**Preview**(プレビュー)など、その設定から生成する読み上げに適用します。時間がかかりすぎた場合は、Marinaraが待った秒数と、変更すべき設定がエラーに表示されます。

## 声を選ぶ

キャラクターやペルソナに個別の声を設定するまでは、話者全員が**Shared voice**(共通の声)を使います。どちらも**Voice settings**(音声の設定)の**Who speaks**(話者)セクションから設定できます。

### 全員で1つの声を使う

声は**Shared voice**(共通の声)で選びます。サービスの実際の声の一覧を読み込むには、**Refresh voices from provider**(プロバイダーから声を再読み込み)ボタン(円形の矢印アイコン)をクリックします。再読み込みの前にカードを保存するので、入力したばかりのキーもすぐに使われます。接続する前は、欄が空にならないよう、短い内蔵の一覧が表示されます。サービス側でエラーが起きたときは、その代替の一覧を再読み込みの成功のように見せず、エラーを表示します。

公式PocketTTSサーバーには声の一覧を返すエンドポイントがないため、Marinaraは内蔵の声を表示し、一覧の横に、別の内蔵の名前や対応する音声URLを入力できる欄を残します。互換ラッパーサーバーは、独自の一覧を返し、カスタムIDやパスを受け付けることができます。

**ElevenLabs**では、声を必ず選ぶ必要があります。Marinaraはアカウントのライブラリー全体(個人の声、ワークスペースの声、保存済みの声、デフォルトの声)を読み込みます。選択画面には、検索欄と、読み込んだ声の数があります。最初は「Select an ElevenLabs voice」が選ばれた状態で、実際の声を選ぶまで再生はできません。

### キャラクターやペルソナごとに選ぶ

1. **Character and persona voices**(キャラクターとペルソナの声)で**Add voice**(声を追加)をクリックします。
2. 左の一覧からキャラクターかペルソナを選び、右の一覧から声を選びます。
3. 必要な人数分、繰り返します。

キャラクターの声は、**Character Editor**(キャラクターエディター)の**Voice**(声)タブでも設定できます。変更対象は同じ行です。声を共有している場合は、タブに**All characters share one voice right now.**と表示されます。**Use a voice per character**(キャラクターごとの声を使う)をクリックし、声を選びます。**Open Text to Speech settings**(音声合成の設定を開く)から**Voice settings**(音声の設定)へ移動できます。**Character and persona voices**内の**Refresh**(再読み込み)で声の一覧を読み込み直します。先にキャラクターを作成してください。キャラクターがいなければ、声を割り当てる前にキャラクターかペルソナを追加するよう案内が出ます。

個別の声がないキャラクターは、名前が一致するカード(AU版のコピー元など)の声を使います。それもなければ、共有の声を使います。[キャラクターの作成と編集](../characters/creating-and-editing-characters.md)を参照してください。

### 語り手の声

語りとは、シーンの描写やゲームマスターのせりふのように、特定のキャラクターが話すわけではない文章です。

1. **Narrator voice**(語り手の声)で、**Use separate narrator voice**をオンにします。
2. 声を選びます。

この声は、RoleplayとConversationのメッセージで行の話し手がNarrator、GM、Game Master、Systemのいずれかのとき、およびGame Modeで話し手の名前がない語りに使われます。ElevenLabsでは、ここで語り手の声を選んでください。空のままにすると、全体の声が設定されているときだけ、語りがその声に切り替わります。

### NPCのランダムな声(Game Modeのみ)

この機能は、Game Modeが追跡している脇役のキャラクターに、余っている声を割り当てます。RoleplayとConversationでは効果がありません。

1. **Random NPC voices**(NPCのランダムな声)で、**Use default voices for random NPCs**をオンにします。
2. **Male NPC defaults**と**Female NPC defaults**で、声にチェックを入れます。

個別の声を持たない追跡中のNPCには、対応する候補から一定の規則で声が選ばれ、そのセッションのあいだ同じ声を保ちます。声を割り当て済みのNPCは、その声を使います。性別がはっきりしないNPCは、両方の候補から選ばれます。男性向け、女性向けと判別できる声が見つからない場合は、どちらの候補も声の全一覧を使います。

## 音声形式と速さ

**Audio format**(音声形式)は**MP3**(デフォルト)か**WAV**です。MP3を生成できないローカルのサーバーではWAVを使ってください。ElevenLabsは常にMP3を使うため、この項目は表示されません。xAI Voiceでは表示されますが、効果はありません。xAIは常にMP3を返すからです。

**Speed**(話す速さ)のスライダーの範囲は、音声サービスによって異なります。

| 音声サービス | 範囲 |
| --- | --- |
| OpenAI-compatible | 0.25倍から4.0倍 |
| PocketTTS | 互換ラッパーでは0.25から4.0。公式サーバーは速さを自身で制御します。 |
| ElevenLabs | 0.7倍から1.2倍 |
| xAI Voice | 0.7倍から1.5倍 |

保存済みの速さが範囲外の場合は、いちばん近い許容値に収められます。ElevenLabsには、さらに2つの項目があります。**Language**(言語を指定するか、**Auto detect**のままにします)と、**Stability**(表情豊かな話し方から安定した話し方まで)です。

## 自動再生

各**Auto-play**(自動再生)トグルは、対応する種類の新しいメッセージの生成が終わるとすぐに読み上げます。**Voice**(音声)の役割にモデルが必要です。初期状態ではすべてオフです。

- **Roleplay messages**: Roleplayの新しい返信
- **Conversation messages**: Conversationの新しい返信
- **Game narration**: Game Modeの新しい語りと戦闘の行
- **Progressive playback**: 複数行の返信で、全体を待たずに最初の行からすぐ再生を始めます。
- **Only read dialogues**: 引用符やタグの付いたせりふだけを読み上げ、地の語りは飛ばします。

自動再生が動くのは、いちばん新しい返信が完成したときの1回だけです。チャットを開き直したりスクロールしたりしても、古いメッセージを読み直すことはありません。

Roleplayでは、メインの返信が保存されるとすぐに音声の準備が始まります。Prose Guardianなど、オンにしたエージェントが返信を書き直す場合、Marinaraは最終的なテキストを待ちます。

### テキストのフィルターと感情の指示

これらのフィルターは手動の再生と自動再生の両方に適用され、Gameの語りとRoleplayの話者抽出にも反映されます。コードブロックはデフォルトで省略されます。ほかの2つは最初はオフです。

- **Skip text inside HTML and custom tags**(HTMLタグとカスタムタグ内のテキストを省略): 非表示の`<simulation>...</simulation>`ブロックなど、囲まれたテキストを取り除きます。声の選択に使う話者タグは残ります。
- **Skip fenced code blocks**(フェンスで囲まれたコードブロックを省略)
- **Skip text inside square brackets**(角括弧内のテキストを省略)

**Roleplay speaker extractor**(Roleplayの話者抽出)をオンにすると、**Enable emotion indicators**(感情表現の指示を使う)が表示されます。この設定は、せりふの言葉を変えずに声の指示を加えます。感情表現の指示がオンのときは、**Skip text inside square brackets**がオンでも、角括弧内のテキストが音声サービスに送られます。メモも含まれる場合があります。括弧内のメモを読み上げ対象から外すには、感情表現の指示をオフにし、省略の設定はオンのままにしてください。`[Low, steady voice, restrained urgency]`のような指示は、長い行を分割しても途中で切れません。アプリが認識する話者やシーンのラベルは、引き続き取り除かれます。各指示をどう使うかは、音声モデルが決めます。**Voice**(音声)の役割にモデルがあり、**Game narration**、感情表現の指示をオンにすると、Gameのシーン、パーティー、戦闘でのせりふにも指示が含まれることがあります。

## メッセージを1つ読み上げる

**Voice**(音声)の役割にモデルを設定すると、各キャラクターまたはナレーターのメッセージの下のツールバーに**Speak**(読み上げ、マイクアイコン)が表示されます。

- **Speak**をクリックすると読み上げます。音声を取得しているあいだ、ボタンは読み込み中の表示になります。
- 再生中にもう一度クリックすると停止します。ツールチップは**Stop speaking**になります。
- 読み上げられる文章がないメッセージ(画像だけの場合など)は**No dialogue to speak**と表示され、ボタンは無効のままです。

読み上げ中は、**Pause speaking**、**Resume speaking**、**Restart speaking**のボタンが表示されます。スピーカーのアイコンのボタンを押すと、0から100パーセントの**Line volume**(この読み上げの音量)スライダーが開きます(デフォルトは50)。この音量は、Game Modeのミキサーとも、Conversationの通話の音量とも別です。

うまくいかなかった場合は、[トラブルシューティング](#troubleshooting)を参照してください。

## 保存済みの音声

Marinaraは生成した音声をブラウザーに保存し、同じ行を2回生成しないようにします。**Voice settings**(音声の設定)の**Cached clips**セクションには、現在の件数と合計サイズが表示されます。**Export cached TTS clips**(保存済みの音声を書き出す)ボタン(ダウンロードのアイコン)をクリックすると、保存済みの音声をすべて個別の音声ファイルとして保存できます。キャッシュは古いクリップから自動的に整理されます。アプリ内に消去ボタンはありません。空にするには、ブラウザーのデータを削除してください。

## 各チャットモードでのTTS

- **Roleplay**では、**Roleplay messages**のトグルと**Speak**の操作を使います。[Roleplayモード: はじめに](../roleplay/getting-started.md)を参照してください。
- **Conversation**では、**Conversation messages**のトグルと同じ操作を使います。音声通話については、[Conversationの音声通話とビデオ通話](../conversation/calls.md)で説明します。
- **Game Mode**では、**Game narration**のトグルを使います。ミキサーには、**Master**、**Music**、**Sound Effects**、**Ambient**と並んで**TTS**のチャンネルがあります。このチャンネルはゲーム内の読み上げ音声の音量を決め、最初は100パーセントです。[Gameの操作](../game/getting-started.md#the-games-controls)を参照してください。

### Phonetic name(通話での読み方)

声がキャラクターやペルソナの名前を正しく読めないときは、**Phonetic name**(読み仮名)を追加し、どう読むかを入力してください。**Character Editor**(キャラクターエディター)では、**Voice**タブにあります。**Persona Editor**(ペルソナエディター)では、基本情報の欄と並んでいます。これが使われるのは、Conversationの音声通話とビデオ通話のときだけです。**Speak**、自動再生、Game Modeの語りでは使われません。

<a id="troubleshooting"></a>

## トラブルシューティング

- **何も読み上げない**: **Jobs**(役割)ボックスにある**Voice**(音声)の行が**Off**(オフ)になっていないか確かめてください。次に、対応する**Auto-play**(自動再生)のトグルを確認するか、メッセージの**Speak**(読み上げ)を使います。
- **Voiceの行にThe voice account is missingと表示される**: 音声モデルのアカウントが削除されたか使えなくなっています。別の音声モデルを選んでください。[アカウントのVoiceモデルの利用](#use-a-voice-model-from-an-account)を参照してください。
- **一覧に声がない**: **Voice**の行にモデルと有効なキーがあることを確認し、**Refresh voices from provider**をクリックしてください。公式PocketTTSサーバーでは、Marinara内蔵の一覧を使います。互換PocketTTSラッパーの場合は、`<Base URL>/v1/voices`が応答するか確かめてください。
- **ElevenLabsが読み上げない**: プレースホルダーの「Select an ElevenLabs voice」ではなく、実際の声を選んでください。**Model**が読み上げモデルであり、IDに`ttv`を含む音声デザイン用モデルでないことも確認します。
- **行が「No audio after 60 s」で止まる**: 音声サーバーにもっと時間が必要です。メッセージに示された場所で**Request timeout (seconds)**の値を大きくしてください。[リクエストのタイムアウト](#request-timeout)を参照してください。
- **ローカルアドレスにある自前のサーバーがブロックされる**: `.env`で`TTS_LOCAL_URLS_ENABLED`をオンにします。これで、OpenAI-compatibleやElevenLabs形式のサーバーについて、Marinaraがローカルアドレスやプライベートアドレスへ接続できるようになります。PocketTTSにこの設定は不要です。[サーバー設定リファレンス](../CONFIGURATION.md)を参照してください。
- **すぐに試す**: **Voice settings**(音声の設定)で**Preview**(試聴)をクリックすると、現在の設定で短いサンプルを聞けます。

## リファレンス: 音楽、効果音、Gacha Forge

これらのセクションは、上級者向けの設定です。

<a id="game-music-and-sound-effects-on-a-compatible-audio-server"></a>

### 互換オーディオサーバーでGameの音楽と効果音を生成する

1. **Connections**(接続)で、**Music & Sound Effects**(音楽と効果音)のアカウントを**Edit model**(モデルの編集)で開き、**Custom compatible server**(カスタム互換サーバー)を選びます。**Add account**(アカウントの追加)ウィンドウには、この種類のアカウント用のタイルはありません。このアカウントは、アップグレードかインポートによって作られます([アカウントリファレンス](../connections/providers-reference.md#music--sound-effects)を参照)。
2. 音楽や効果音のサーバーのアドレス、キー、モデルを入力します。
3. **Generation API format**を設定し、サーバーが提供するエンドポイントパスを入力します。パスが空の機能は使えません。
4. **Music generation**(音楽生成)、**Sound-effect generation**(効果音生成)、またはその両方をオンにします。
5. Gameのセットアップかゲームの音声設定で、このアカウントを選びます。読み上げ用のアカウントは、**Voice**(音声)の役割の設定で別に選んでおきます。

エンドポイントのパスは、アカウントのBase URLに追加されます。`http://localhost:8002/v1`の場合は`chat/completions`を指定すると、`/v1/chat/completions`にアクセスします。ローカルのHTTPエンドポイントには、ほかのローカル互換オーディオリクエストと同じく、`.env`で`TTS_LOCAL_URLS_ENABLED=true`の設定が必要です。

対応するAPI形式は次の2種類です。

- **Prompt JSON → MP3 audio**は`{ "model": "your-model", "prompt": "the requested sound", "duration": 5, "response_format": "mp3" }`を送信し、MP3のバイト列を受け取ります。Gameの音楽はコンテキストトラックの長さ(デフォルトは120秒)を使います。効果音は5秒を要求します。
- **Chat Completions → inline audio (ACE-Step compatible)**は、`model`、ユーザーの`messages`を1件、`stream: false`、および`duration`、`instrumental: true`、`format: "mp3"`を持つ`audio_config`を送信します。`choices[0].message.audio`内のインラインのMP3を受け付けます。形式は、base64データURLを含むACE-StepのオーディオURL配列、またはbase64の`data`を持つオブジェクトです。[ACE-Step互換APIの仕様](https://github.com/ace-step/ACE-Step-1.5/blob/main/docs/en/Openrouter_API_DOC.md)を参照してください。リモートの結果URLや非同期ジョブAPIには対応していません。

サーバーが実装している機能だけをオンにしてください。OpenAI互換の音声エンドポイントがあるだけでは、音楽や効果音に対応しているとは限りません。Infermaticなどのサービスは、これらの形式のいずれかを提供するか、アダプターを用意する必要があります。Infermaticの実際の音楽エンドポイントは、ここでは検証していません。ElevenLabsやSunoAPIのネイティブ生成には、**Music & Sound Effects**でそのソースを使ってください。[アカウントリファレンス](../connections/providers-reference.md#music--sound-effects)を参照してください。

生成したコンテキスト音楽は、エリアや遭遇段階ごとに1回作曲され、再利用されます。同じ効果音には、オーディオキャッシュを使います。生成エラーが起きても、キャッシュは再試行に使える状態で残ります。

<a id="gacha-forge-dialogue-and-audio"></a>

### Gacha Forgeの会話と音声

Gacha Forge 1.11.0以降では、**Voice**(音声)の役割で選んだアカウントと、キャラクターごとの声の割り当てを使います。 - **Read character dialogue**(キャラクターの会話を読み上げる)をオンにすると、声が割り当てられたインポート済みキャラクターの会話を読み上げます。この設定は、新しいワールドの**Lore**(背景設定)のセットアップステップ、または既存のワールドの場合はGacha Forge自体のワールド設定にあります。ナレーション、思考、EngineのキャラクターIDを持たない生成ユニット、声のないキャラクターは読み上げません。名前があるだけで、ほかのキャラクターの声を借りることはありません。
- **Voice**の役割が**Off**でなければ、選んだAudioアカウントを使えます。
- 同梱のGameの音楽と効果音には、生成用のアカウントは不要です。新しいトラックを作曲するには、Gacha Forgeで**Generate music and sound effects**(音楽と効果音を生成する)をオンにし、**Audio connection**(オーディオ接続)でMusic & Sound Effectsのアカウントを選んでください。この欄は、生成がオンのときに表示されます。Home、戦闘、ボス、ストーリーシーン、キャラクターストーリーのトラックは、初めて必要になったときに生成され、その後は再利用されます。これらのリクエストには、自分のサービスのアカウントが使われます。
- 右上のミュートボタンは、音楽、会話、効果音をまとめて消音します。Gacha Forgeの見た目の設定には、この3つの個別の音量調整(0を含む)と、自動再生の待ち時間(デフォルトは**3秒**で、テキストの表示と会話の読み上げが終わったあとに始まります)があります。選択肢は引き続きプレイヤーを待ちます。シーンを離れると、会話の読み上げは取り消されます。ワールドを離れると、そのワールドの音声は止まります。

これらの操作を使うには、Engineとあわせて、インストール済みのGacha Forgeパッケージもアップデートしてください。

## 関連ガイド

- [Conversationの音声通話とビデオ通話](../conversation/calls.md)
- 2Dと3Dのアバター向けの[音声合成によるリップシンク](../agents/avatars.md#lip-sync-with-text-to-speech)
- [Roleplayモード: はじめに](../roleplay/getting-started.md)
- [Game Mode: はじめに](../game/getting-started.md)
- [対応しているAIプロバイダー](../connections/providers-reference.md)
- [キャラクターの作成と編集](../characters/creating-and-editing-characters.md)
- [サーバー設定リファレンス](../CONFIGURATION.md)
