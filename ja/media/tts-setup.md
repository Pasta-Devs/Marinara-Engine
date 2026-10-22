# Text to Speech (TTS)の設定

このガイドでは、Marinara EngineでText to Speechを設定し、メッセージやゲームの語りを音声で読み上げられるようにする手順を説明します。Text to Speech (TTS)は、チャットの文章を音声に変換する機能です。音声のプロバイダーの選び方、声の選び方、自動再生、メッセージごとの再生操作までを取り上げます。

## TTSの設定がある場所

TTSの設定は、ほぼすべてが1か所にまとまっています。**Connections**(接続)パネルを開き、**Text to Speech**(音声合成)カードを探します。このカードはデフォルトで閉じているので、ヘッダーをクリックして展開します。

TTSのリクエストは、アプリ自身のサーバーを経由して送られます。プロバイダーのAPIキーは、サーバー上で暗号化して保存します。キーを保存すると、欄には実際のキーではなく伏せ字の点が並びます。実際のキーがブラウザーに返ることはありません。

TTSをオンにしただけでは、何も読み上げは始まりません。各メッセージの**Speak**(読み上げ)ボタンと**Auto-play**(自動再生)の項目が表示されるようになるだけです。何をいつ読み上げるかは、引き続き自分で選びます。

## ステップ1: TTSを有効にしてSourceを選ぶ

1. **Connections**パネルを開き、**Text to Speech**カードを展開します。
2. カードのヘッダーにあるスイッチをクリックして、TTSをオンにします。スイッチにカーソルを合わせるとツールチップが出ます。オフのときは**Enable TTS**、オンのときは**Disable TTS**です。
3. **Source**(音声の提供元)ドロップダウンを開き、プロバイダーを選びます。

**Source**とは、音声を生成するサービスのことです。選択肢は次の4つです。

- **OpenAI-compatible**: OpenAI、またはOpenAIのTTS形式に合わせたサーバー。
- **ElevenLabs**: ElevenLabsの音声サービス。
- **PocketTTS**: 自分のコンピューターで動かせる無料の音声サーバー。
- **xAI Voice**: xAIの音声サービス。

デフォルトのSourceは**OpenAI-compatible**です。MarinaraはSourceごとに設定を別々に保存します。暗号化されたAPIキー、エンドポイント、モデル、声、プロバイダーのパラメーターがそれぞれ保持されます。Sourceを切り替えると、そのSourceで前回使った設定が戻ります。まだ設定していないSourceは、デフォルトの状態から始まります。

<a id="use-an-audio-connection"></a>

### 音声の接続を使う

**Audio**(音声)の接続をすでに設定している場合([対応しているAIプロバイダー](../connections/providers-reference.md#audio)を参照)は、その詳細をここでもう一度入力する必要はありません。音声の接続は、**Source**ドロップダウンの**Audio connections**(音声の接続)の下に、それぞれソースの種類をかっこ内に添えて並びます。

1. **Source**ドロップダウンを開き、その接続を選びます。
2. 声と、下にあるそのほかの設定を、いつもどおり選びます。

Marinaraはその接続のBase URL、APIキー、モデル、**Request timeout (seconds)**(リクエストのタイムアウト、秒単位)を使って読み上げるので、カードではそれらの欄が隠れます。キーは接続の中にとどまり、カードの設定にコピーされることも、ブラウザーに送られることもありません。新しいキーなど、接続に加えた変更はすぐに反映されます。

声、速度、そのほかの読み上げの設定は、接続ごとに別々に保存されます。2つのOpenAI-compatibleサーバーのように同じ種類の接続どうしでも、設定を共有することはありません。通常の4つのSourceの設定は元のまま残るので、いつでも切り替えて戻せます。カードのヘッダーにあるスイッチは引き続きText to Speechのオンとオフを切り替え、ゲーム独自の音声の接続は引き続きそのゲームの効果音と音楽を作ります。

選んだ接続が削除された場合や使えない場合、カードには**Missing Audio connection**と表示され、別のSourceを選ぶまで何も読み上げません。Marinaraが勝手に別の接続へ切り替えることはありません。

接続が声の一覧を返す場合、保存済みの声のうち一覧にないものをカードが名前で示すので、接続が提供する声を選び直せます。

<a id="game-music-and-sound-effects-on-a-compatible-audio-server"></a>

## 互換オーディオサーバーでGameの音楽と効果音を生成する

**Connections**で**Audio**接続を作成するか開き、**OpenAI-compatible**を選んでください。音楽や効果音のサーバーのアドレス、キー、モデルを指定します。**Generation API format**を設定し、サーバーが提供するエンドポイントのパスを入力して、**Game music**または**Game sound effects**をオンにしてください。パスが空の機能は使えません。Gameのセットアップかゲームのオーディオ設定で、このAudio接続を選んでください。音楽専用モデルは音声モデルではないため、Text to Speechカードでは音声用の接続を別に選んでおきます。

エンドポイントのパスは接続のBase URLに追加されます。`http://localhost:8002/v1`の場合は`chat/completions`を指定すると`/v1/chat/completions`にアクセスします。新しいプロバイダー項目を追加する必要はありません。ローカルHTTPエンドポイントには、ほかのローカル互換オーディオリクエストと同じく、`.env`で`TTS_LOCAL_URLS_ENABLED=true`の設定が必要です。

対応するAPIの入出力仕様は次の2種類です。

- **Prompt JSON → MP3 audio** は`{ "model": "your-model", "prompt": "the requested sound", "duration": 5, "response_format": "mp3" }`を送信し、MP3のバイト列を受け取ります。Gameの音楽はコンテキストトラックの長さ(デフォルト120秒)を使い、効果音は5秒を要求します。これらのフィールドを受け付けるエンドポイントかアダプターを使ってください。
- **Chat Completions → inline audio (ACE-Step compatible)** は`model`、ユーザーの`messages`を1件、`stream: false`、および`duration`、`instrumental: true`、`format: "mp3"`を持つ`audio_config`を送信します。`choices[0].message.audio`内のMP3データを受け取れます。形式は、base64データURLを含むACE-StepのオーディオURL配列、またはbase64の`data`を持つオブジェクトです。[ACE-Step互換APIの仕様](https://github.com/ace-step/ACE-Step-1.5/blob/main/docs/en/Openrouter_API_DOC.md)を参照してください。これらの仕様は、リモートの結果URLや非同期ジョブAPIには対応しません。

サーバーが実装している機能だけをオンにしてください。OpenAI互換の音声エンドポイントがあっても、音楽や効果音に対応しているとは限りません。Infermaticなどのプロバイダーには、上記の仕様のいずれか、またはアダプターが必要です。ここでは実際のInfermaticの音楽エンドポイントを検証していません。ElevenLabsは従来のネイティブな音楽・効果音リクエストを引き続き使います。

コンテキスト音楽は引き続きエリアや遭遇段階ごとに1回生成し、再利用します。同じ効果音にはオーディオキャッシュを使います。生成エラーが起きても、キャッシュは再試行に使える状態で残ります。

## ステップ2: Base URL、API Key、Modelを入力する

Sourceとして音声の接続を選んだ場合、このステップは飛ばしてください。Marinaraはその接続自身の設定を使います。

どのSourceにもWebアドレスが必要で、ほとんどのSourceではAPIキーも必要です。APIキーとは、そのリクエストが自分のものだと証明するための、プロバイダーから受け取る秘密の文字列です。

1. **Base URL**(接続先アドレス)欄を確認します。Sourceごとに適切なデフォルトが入ります。値は下の表のとおりです。プロキシや自分で立てたサーバーを使う場合だけ変更します。
2. プロバイダーのキーを**API Key**欄に貼り付けます。すでに保存したキーをそのまま使うときは、伏せ字の点に触れないでおきます。保存済みのキーを削除するときは、欄を空にします。
3. **Model**欄を確認します。Sourceごとにデフォルトのモデルが入ります。プロバイダーが対応していれば、別のモデル名を入力してもかまいません。

アプリがSourceごとに入れるデフォルトは次のとおりです。

| Source            | デフォルトのBase URL      | デフォルトのModel      | アプリが最初に入れる声          |
| ----------------- | ------------------------- | ---------------------- | ------------------------------- |
| OpenAI-compatible | https://api.openai.com/v1 | tts-1                  | alloy                           |
| ElevenLabs        | https://api.elevenlabs.io | eleven_multilingual_v2 | なし(自分で選ぶ必要があります) |
| PocketTTS         | http://localhost:8000    | pocket-tts             | alba                            |
| xAI Voice         | https://api.x.ai/v1       | grok-tts               | eve                             |

**ElevenLabs**の場合、**Model**欄には接続経由で使える読み上げ対応モデルが読み込まれ、開いたときは常に全一覧が見えたままになります。通常の読み上げモデルを選んでください。IDに`ttv`を含むモデルは音声デザイン用で、読み上げには使えません。誤って選ぶと、読み上げモデルを使うように促すエラーが出て再生に失敗します。

### PocketTTSは別のプログラムです

PocketTTSはMarinara Engineに内蔵されていません。[公式PocketTTSサーバー](https://github.com/kyutai-labs/pocket-tts)を別途インストールし、`uvx pocket-tts serve`で起動してください。Marinaraがダウンロードや管理を代行することはありません。

公式サーバーのデフォルトは`http://localhost:8000`です。ホストやポートを変えていなければ、**Base URL**はこの値のままにします。Marinaraは公式のmultipart `/tts` APIを自動検出します。[OpenAI互換PocketTTSラッパー](https://github.com/teddybear082/pocket-tts-openai_streaming_server)用の既存の独自URLも引き続き使えます。

<a id="request-timeout"></a>

### リクエストのタイムアウト

デフォルトでは、Marinaraは読み上げる1行ごとに最大60秒待ちます。自分のコンピューター、特にノートパソコンで動かす音声サーバーでは、長い行に60秒以上かかることがあります。もっと長く待つには、カードの**Model**の下にある**Request timeout (seconds)**(リクエストのタイムアウト、秒単位)の値を大きくしてください。10秒から3,600秒まで設定できます。

音声の接続には、接続エディターの**Default Voice**(デフォルトの声)の下に、独自の**Request timeout (seconds)**欄があります。カードの**Source**として選んだ接続も含め、チャットが音声の接続を通して読み上げる場合は、その接続の上限を使います。カードの上限は、**Preview**ボタンを含め、カード自体の設定による読み上げに適用されます。

1行に時間がかかりすぎた場合、エラーには、Marinaraが何秒待ったかと、どの設定の値を大きくすればよいかが表示されます。

## ステップ3: 声を選ぶ(Voice Option)

**Voice Option**(声の割り当て方)の設定で、声をどう割り当てるかが決まります。

- **One voice for all characters**: すべての話し手が同じ声になります。これがデフォルトです。
- **Selected per character**: 選んだキャラクターに個別の声を割り当てます。

### すべてのキャラクターで1つの声を使う

**All Characters Voice**欄で音声を選びます。公式PocketTTSサーバーには音声一覧エンドポイントがないため、Marinaraは組み込み音声を表示し、別の組み込み名や対応する音声URLを入力できる欄をドロップダウンの隣に残します。互換ラッパーサーバーは独自の音声一覧とカスタムIDやパスを引き続き使えます。

プロバイダーから実際の声一覧を読み込むには、接続情報を入力して**Refresh voices**(声の再読み込み)ボタン(円形の矢印アイコン)をクリックします。これは再生を有効にする前でも実行できます。再読み込みの前にカードを保存するので、入力したばかりのAPIキーもすぐに使われます。接続前は、欄が空にならないよう、アプリが短い内蔵の代替一覧を表示します。プロバイダー側でエラーが起きたときは、その代替一覧を成功したかのように見せず、エラーを表示します。

**ElevenLabs**では、声を必ず選ぶ必要があります。Marinaraはアカウントのライブラリーをページ単位で読み込み、個人の声、ワークスペースの声、保存済みの声、デフォルトの声を含めて表示します。選択画面には検索欄があり、ライブラリーがパネルより長い場合はスクロールバーが常に表示されます。読み込んだ声の数も表示します。最初は「Select an ElevenLabs voice」が選ばれた状態で、実際の声を選ぶまで再生はできません。

### キャラクターごとに選ぶ

1. **Voice Option**を**Selected per character**にします。
2. **Character**列と**Voice**列を持つ**Character Voices**の表が表示されます。
3. **Add character voice**をクリックして行を追加します。
4. 左のドロップダウンでキャラクターを、右のドロップダウンで声を選びます。
5. 個別の声を割り当てたいキャラクターの数だけ繰り返します。

キャラクターの声は、**Character Editor**(キャラクターエディター)の**Voice**タブでも選べます。変更されるのは同じ行なので、どちらにも常に同じ声が表示されます。

Character Voicesの枠にある**Refresh**ボタンを押すと、1つの声を使うモードに戻らずに、同じプロバイダーのライブラリーを読み込み直せます。先にキャラクターを作成しておく必要があります。1つもない場合は、声を割り当てる前にCharactersタブでキャラクターを追加するよう案内が出ます。個別の声がないキャラクターは、名前が一致するカード(AU版のコピー元など)に設定された声を使います。それもなければ、全体の声を使います。[キャラクターの作成と編集](../characters/creating-and-editing-characters.md)を参照してください。

## Narrator Voice

語りとは、シーンの描写やゲームマスターのせりふのように、特定のキャラクターが話すわけではない文章です。ここには別の声を割り当てられます。

1. **Narrator Voice**(語り手の声)の枠で、**Use separate narrator voice**をオンにします。
2. 表示された選択欄で声を選びます。

アプリは、行の話し手がNarrator、GM、Game Master、Systemのいずれかのときにこの声を使います。RoleplayとConversationのメッセージで機能します。Game Modeで話し手の名前がない語りの行にも適用されます。ElevenLabsを使う場合は、ここで語り手の声を選んでください。空のままにすると、全体の声が設定されているときだけ語りがその声に切り替わります。

## Random NPC Voices (Game Modeのみ)

この機能は、ゲームの脇役に余っている声を割り当てます。動作するのはGame Modeだけで、対象もGame Modeが追跡しているNPCに限られます。RoleplayとConversationでは効果がありません。

1. **Random NPC Voices**(NPCのランダムな声)の枠で、**Use default voices for random NPCs**をオンにします。
2. **Male NPC defaults**と**Female NPC defaults**の2つのチェックボックスの一覧が表示されます。
3. それぞれの候補として使いたい声にチェックを入れます。

個別の声を持たない追跡中のNPCには、対応する候補から一定の規則で声が選ばれます。同じNPCは、そのセッションのあいだ同じ声を保ちます。キャラクターの声を割り当て済みのNPCは、常にその声を使います。男性向け、女性向けと判別できる声が見つからない場合は、どちらの候補も声の全一覧を使います。

## Audio FormatとSpeed

**Audio Format**(音声形式)の設定では、**MP3**(デフォルト)か**WAV**を選びます。MP3を生成できないローカルのサーバーや自分で立てたサーバーではWAVを使ってください。注意点が2つあります。

- **Audio Format**はElevenLabsでは表示されません。ElevenLabsは常にMP3を使います。
- xAI Voiceでは表示されますが、効果はありません。xAI Voiceは常にMP3を返します。

**Speed**(話す速さ)のスライダーで、声が話す速さを調整します。指定できる範囲はSourceによって異なります。

- OpenAI-compatible: 通常の0.25倍から4.0倍。
- PocketTTS: 互換ラッパーでは0.25倍から4.0倍の速度設定を使えます。公式サーバーでは現在、合成速度をサーバー自身が制御します。
- ElevenLabs: 0.7倍から1.2倍。
- xAI Voice: 0.7倍から1.5倍。

保存済みの速さが現在のSourceの範囲から外れている場合、アプリは読み上げの際にいちばん近い値へ収めます。

**ElevenLabs**のときだけ、追加の項目が2つ表示されます。**Language**では話す言語を指定できます。**Auto detect**のままにしておくこともできます。**Stability**は、表情豊かな話し方と安定した話し方のあいだで調整するスライダーです。

## Auto-play: メッセージを自動で読み上げる

**Auto-play**の見出しの下にあるトグルは、それぞれ特定の種類の新しいメッセージを、生成が終わった時点で読み上げるよう指示するものです。どれも先に**Enable TTS**がオンになっている必要があります。すべてのトグルは最初オフです。

- **Roleplay messages**: Roleplayの新しい返信を読み上げます。
- **Conversation messages**: Conversation Modeの新しい返信を読み上げます。
- **Game narration**: Game Modeの新しい語りと戦闘の行を読み上げます。
- **Progressive playback**: 返信が複数行あるとき、全体を待たずに最初の行から再生を始めます。
- **Only read dialogues**: 引用符やタグの付いたせりふだけを読み上げ、地の語りは飛ばします。

Roleplayでは、メインの回答が保存されるとすぐに音声の準備が始まります。話者と感情の抽出はそのテキストから始まり、無関係なエージェントを待ちません。Prose Guardianなど、回答を書き直すエージェントがオンの場合は、書き直し後の最終テキストを待ってから音声を準備します。

自動再生が動くのは、いちばん新しい返信が完成した瞬間の1回だけです。チャットを開き直したりスクロールしたりしても、古いメッセージを読み直すことはありません。

同じ再生設定には、**Skip text inside HTML and custom tags**(HTMLタグとカスタムタグ内のテキストを省略)、**Skip fenced code blocks**(フェンスで囲まれたコードブロックを省略)、**Skip text inside square brackets**(角括弧内のテキストを省略)もあります。コードブロックは標準で省略され、ほかの2つのフィルターは最初はオフです。タグのフィルターは、非表示の`<simulation>...</simulation>`ブロックなど、囲まれたテキストを除去しますが、音声選択に使う話者タグは保持します。これらは手動再生と自動再生の両方に適用され、GameのナレーションやRoleplayの話者抽出にも反映されます。

**Roleplay speaker extractor**(Roleplayの話者抽出)をオンにすると、**Enable emotion indicators**(感情表現の指示を使う)が表示されます。感情表現の指示がオンのときは、**Skip text inside square brackets**がオンでも、角括弧内のテキストが音声サービスに送られます。メモも含まれる場合があります。括弧内のメモを読み上げ対象から外すには、感情表現の指示をオフにし、括弧内を省略する設定はオンのままにしてください。

`[Low, steady voice, restrained urgency]`のような声の出し方の指示は、長いせりふを読み上げ用に分割しても途中で切れません。アプリが認識する話者やシーンのラベルは、引き続き取り除かれます。各指示をどう使うかは音声モデルによって決まります。

**Roleplay speaker extractor**は、元のせりふの言葉を変えずに指示を追加します。**Enable TTS**、**Game narration**、感情表現の指示をオンにすると、Gameのシーンやパーティー、戦闘でのせりふにも、こうした指示が含まれることがあります。

## メッセージを1つだけ読み上げる

TTSをオンにすると、キャラクターや語り手のメッセージの下のツールバーに**Speak**ボタン(マイクのアイコン)が表示されます。押したときにそのメッセージだけを読み上げます。

- **Speak**をクリックするとメッセージを読み上げます。音声を取得しているあいだ、ボタンは読み込み中の表示になります。
- 再生中にもう一度クリックすると停止します。再生中はツールチップが**Stop speaking**になります。
- 読み上げられる文章がないメッセージ(画像だけの場合など)は**No dialogue to speak**と表示され、ボタンは無効のままです。

読み上げ中は、さらに2つのボタンが表示されます。**Pause speaking**と**Resume speaking**で再生を一時停止し、再開します。**Restart speaking**はメッセージを最初から読み直します。

スピーカーのアイコンのボタンを押すと、**Line volume**(この読み上げの音量)スライダーが開きます。範囲は0から100パーセントで、デフォルトは50です。この音量は独立した設定として保存します。Game Modeのミキサーとも、Conversationの通話の音量とも別なので、片方を変えてももう片方は変わりません。

## 保存済みの音声

アプリは生成した音声をブラウザーに保存し、同じ行を2回生成しなくて済むようにします。**Cached clips**(保存済みの音声)パネルには、現在の件数と合計サイズが表示されます。

**Export cached TTS clips**(保存済みの音声を書き出す)ボタン(ダウンロードのアイコン)をクリックすると、保存済みの音声をすべて個別の音声ファイルとしてデバイスに保存できます。保存領域は古いものから自動的に整理されます。アプリ内に手動で消すボタンはないので、空にしたいときはブラウザーのデータを削除してください。

## 各チャットモードでのTTS

同じTTSの設定がすべてのモードで使われ、モードごとに少しずつ違いがあります。

- Roleplayでは、**Roleplay messages**の自動再生トグルと、メッセージごとの**Speak**の操作を使います。[Roleplayモード: はじめに](../roleplay/getting-started.md)を参照してください。
- Conversation Modeでは、**Conversation messages**のトグルと同じ**Speak**の操作を使います。音声通話はより大きな機能で、[Conversationの音声通話とビデオ通話](../conversation/calls.md)で説明します。
- Game Modeでは**Game narration**のトグルを使います。Game Modeには独自の音声ミキサーもあり、**Master**、**Music**、**Sound Effects**、**Ambient**と並んで**TTS**のチャンネルがあります。このチャンネルはゲーム内の読み上げ音声全体の音量を決め、最初は100パーセントです。[Gameの操作](../game/getting-started.md#the-games-controls)を参照してください。

## Phonetic name (通話での読み方)

キャラクターやペルソナの名前の綴りが原因で声が正しく読めないときは、**Phonetic name**(読み方)を追加できます。**Character Editor**では、**Voice**タブにこの欄があります。**Persona Editor**では、ほかの基本情報の欄と並んでいます。名前をどう読ませたいかを入力してください。

この指定が使われるのは、Conversationの音声通話とビデオ通話のときだけです。通常のメッセージごとの**Speak**ボタン、チャットの自動再生、Game Modeの語りでは、この欄は読み上げに使われません。

## トラブルシューティング

- カードに**Missing Audio connection**と表示される: Sourceとして選んだ音声の接続が削除されたか、使えなくなっています。別のSourceを選んでください。[音声の接続を使う](#use-an-audio-connection)を参照してください。
- 何も読み上げない: まず**Enable TTS**のスイッチがオンか確かめます。次に、使っているモードに対応する**Auto-play**のトグルを確認するか、メッセージごとの**Speak**ボタンを使います。**Speak**ボタンと自動再生の項目は、TTSを有効にしてから表示されます。
- ドロップダウンに声が出ない: TTSを有効にし、プロバイダーがキーを必要とする場合は正しいAPIキーを入れた状態でカードを保存し、**Refresh voices**をクリックします。公式PocketTTSサーバーには音声一覧エンドポイントがないため、Marinaraの組み込み一覧を使います。互換PocketTTSラッパーの場合は、`<Base URL>/v1/voices`が応答することを確認してください。
- ElevenLabsが読み上げない: プレースホルダーの「Select an ElevenLabs voice」ではなく、実際の声を選んでいるか確かめます。**Model**が読み上げモデルであり、IDに`ttv`を含む音声デザイン用モデルでないことも確認します。
- 行が**No audio after 60 s**で止まる: 音声サーバーにもっと時間が必要です。メッセージに示された場所で**Request timeout (seconds)**の値を大きくしてください。[リクエストのタイムアウト](#request-timeout)を参照してください。
- ローカルアドレスにある自前のTTSサーバーがブロックされる: サーバー設定`TTS_LOCAL_URLS_ENABLED`をオンにします。これでOpenAI-compatibleやElevenLabs形式のサーバーについて、ローカルアドレスやプライベートアドレスへ接続できるようになります。PocketTTSにこの設定は不要です。[サーバー設定リファレンス](../CONFIGURATION.md)を参照してください。
- 設定をすぐ試す: カード内の**Preview**(試聴)ボタンをクリックすると、現在の設定で短いサンプルを再生できます。

## 関連ガイド

- [Conversationの音声通話とビデオ通話](../conversation/calls.md)
- 2Dと3Dのアバター向けの[音声合成によるリップシンク](../agents/avatars.md#lip-sync-with-text-to-speech)
- [Roleplayモード: はじめに](../roleplay/getting-started.md)
- [Game Mode: はじめに](../game/getting-started.md)
- [対応しているAIプロバイダー](../connections/providers-reference.md)
- [キャラクターの作成と編集](../characters/creating-and-editing-characters.md)
- [サーバー設定リファレンス](../CONFIGURATION.md)
