# Conversationの音声通話とビデオ通話

通話とは、ボイスチャットアプリのようなライブ画面で、1人以上のキャラクターに、マイクまたは文字入力で話しかけるものです。実行中は、通常のConversationのチャットの上に重なって表示されます。通話は、Conversationモードでだけ使えます。

通話は、任意のパッケージです。**Agents → Agent Organizer**から**Calls**をインストールしてください。カタログが再起動を求めた場合は、Marinaraを停止して、いつもの方法でもう一度起動します([インストール](../INSTALLATION.md)を参照)。

通話中は、動作するText to Speech(TTS、テキストを音声に変える機能)の音声を持つキャラクターが、声に出して話します。音声のないキャラクターは、通話チャットに文字で返信します。静止したアバターの代わりに、キャラクターのAI生成のループ動画クリップを表示することもできます。

Marinaraは、ブラウザーでマイクまたはカメラを録音します。入力モード(下記を参照)によって、音声は自分のコンピューター上でテキストに変えられるか、選んだチャット用のモデルに送られます。返信は、TTSサービスで読み上げられます。通話が終わると、短い要約がConversationに戻ります。全文の記録は、通話専用のストレージに残ります。

## 必要なもの

- **Calls**がインストールされている。
- キャラクターが1人以上いるConversationのチャットと、返信を書くモデルのアカウント。
- チャットの設定で、**Audio/Video Calls**と**Call Audio Pipeline**がオンになっている。
- 任意: Text to Speechのアカウント。これでキャラクターが話せます。ないと、文字で返信します。
- 任意: デフォルトのマイクモードには、一度だけLocal Whisperのダウンロードが必要です([Local Whisperのダウンロード](#download-local-whisper)を参照)。代わりに、通話チャットで文字を入力することもできます。

## 最初の通話の準備

始める前に: キャラクターが1人以上いるConversationのチャットと、返信を書くモデルのアカウントが必要です([AIプロバイダーへの接続](../connections/connecting-to-a-provider.md)を参照)。

1. 任意: Text to Speechを設定します([Text to Speechの設定](#set-up-text-to-speech)を参照)。設定しないと、キャラクターは全員、文字だけで参加します。
2. チャットを開き、**Chat Settings → Agents → Calls**を開きます。
3. **Audio/Video Calls**をオンにします。会話の名前の隣に、通話ボタンが表示されます。
4. **Call Audio Pipeline**をオンにします。これをオフにすると、通話を始められません。文字を入力するだけ、聞くだけの場合でも同じです。マイクも有効になります。
5. **Audio input mode**を選びます(下記を参照)。
6. **Start call**をクリックします。

うまくいかなかった場合: 「Conversation call audio is not enabled in Chat Settings」と表示されたら、**Call Audio Pipeline**がオフです。これはグローバルな設定なので、1つのチャットでオンにすると、すべてのConversationの通話でオンになります。新しいチャットでは、先にセットアップウィザードを完了してから、そのチャットの**Chat Settings**を開いてください。Callsの設定は、Callsをインストールしたときだけ表示されます。

似たスイッチが2つありますが、役割は違います。

- **Audio/Video Calls**は、通話ボタンを表示します。これで、自分からキャラクターに通話をかけられます。
- **Calls**コマンドは、キャラクターから先に電話をかけられるようにします。これがオフでも、自分から通話を始められます。

同じセクションにあるマスターの**Commands**スイッチも、通話中のコマンドのためにオンにする必要があります。通話そのものは、オフのままでも始められます。

<a id="set-up-text-to-speech"></a>

### Text to Speechの設定

Text to Speechは、どのキャラクターが、どの声で話せるかを決めます。全体の手順は[Text to Speech(TTS)のセットアップ](../media/tts-setup.md)を読んでください。要点は次のとおりです。**Connections**を開き、**Add account**をクリックして、**Text to speech**を選びます。すでに**On this device**の下に一覧表示されている場合は、そこで開きます。そのうえで、次の手順に従います。

1. Text to Speechをオンにします。
2. ソースを選びます: **OpenAI-compatible**、**ElevenLabs**、**PocketTTS**、**xAI Voice**。
3. そのソースのAPIキーかローカルサーバーのアドレスを入力します。
4. モデルと声を選びます。
5. **Voice option**を**One voice for all**または**Selected per character or persona**に設定します。キャラクターごとに声を決めると、グループ通話が聞き分けやすくなります。
6. 保存してから、プレビューのボタンを使って、音声が聞こえることを確認します。

キャラクターにMarinaraが特定できる声がない場合、そのキャラクターは、通話中は文字だけになります。

### Audio input modeの選択

**Call Audio Pipeline**がオンのときは、**Audio input mode**の一覧が表示されます。迷ったら、デフォルトのままにしてください。

| モード | 働き |
| --- | --- |
| **Mic recording + Local Whisper**(デフォルト) | ミュートを解除しているあいだ録音し、無音を無視して、自分のコンピューター上で音声をテキストに変えます。Firefoxに最適です。 |
| **Browser speech recognition** | ブラウザーに組み込まれた音声認識ツールを使います。対応状況はさまざまです。使えないときは、MarinaraがLocal Whisperに切り替えます。 |
| **Manual system dictation** | 通話のテキストボックスにカーソルを置くだけなので、お使いのOSの音声入力で入力できます。Marinaraは録音しません。 |
| **Provider-native audio/video** | モデルがメディアを受け付ける場合に、録音した音声や動画を、そのままモデルに送ります。 |

カメラと画面共有のボタンは、**Camera and screen input**をオンにしたときだけ、**Provider-native audio/video**モードで動作します。ほかのモードでは、ボタンは表示されますが、無効のままです。

## 通話の開始、応答、終了

**通話を始める。** 通話がオンのとき、会話の名前の隣に電話ボタンがあります。ツールチップは**Start call**、通話が実行中のときは**Open call**です。クリックすると、通話画面が開きます。1つのチャットで、アクティブになれるのも呼び出し中になれるのも、通話1つだけです。別の通話を始めると、現在の通話が開き直されます。

**通話に応答する。** **Calls**コマンドがオンのとき、キャラクターから着信があります。そのチャットでは、メッセージ入力欄の上に**Incoming call**のバナーが表示され、**Decline call**と**Answer call**があります。Marinaraのほかの場所では、着信の通知と短い着信音が出ます。Marinaraが、自分から応答することはありません。参加できるのは、利用可能なキャラクターだけです。スケジュールやステータスがオフラインのキャラクターは参加しません。

**通話を終える。** 通話画面または最小化したポップアウトの、赤い**End call**ボタンをクリックします。キャラクターも、通話中のコマンドで、通話から抜けたり終了したりできます。その後、Marinaraは録音を止め、Conversationにカードを追加します。

## 通話画面

ステージには、参加者ごとに1つのタイルが表示されます。ペルソナと、利用可能な各キャラクターです。話している人が強調表示されます。通話チャットには、入力したメッセージと、文字だけの返信が表示されます。声に出して話した内容は、そこには繰り返されません。デスクトップでは、サイドパネルです。スマートフォンでは、**Open call chat**で開き、**Close call chat**で閉じるドロワーです。

通話のコンポーザーには、**Message in call**ボックス、**Send**、絵文字、GIF、スタンプのピッカー、モデルのクイック切り替えがあります。通話チャットでは、ファイルの添付には対応していません。

| コントロール | 働き |
| --- | --- |
| マイク | ミュートとミュート解除を切り替えます。ツールチップはモードによって変わります。例: **Unmute microphone with Local Whisper**。 |
| **Turn camera on** / **Turn camera off** | **Provider-native audio/video**モードで、**Camera and screen input**がオンのときだけ。 |
| **Share screen** / **Stop sharing screen** | カメラと同じルールです。 |
| **Character volume** | ミュートボタンと、0から100のスライダー。デフォルトは100で、ブラウザーに保存されます。 |
| **Soundboard** | **Upload**コントロール付きの、音の一覧。 |
| **End call** | 赤い受話器のボタン。 |

ミュートのまましばらく話さないでいると、「You are muted! Remember to unmute yourself first if you want to talk.」と表示されます。

通話中にConversationを離れると、通話は、チャット名、経過時間、**End call**を表示する、浮かぶポップアウトに縮小されます。ポップアウトをクリックすると、元に戻ります。閲覧しているあいだも、通話は続きます。

### Soundboard

サウンドボードには、削除できない組み込みの音が4つあります。**Soft Chime**、**Tap**、**Sparkle**、**Pop**です。クリックすると再生されます。**Upload**で、自分の音を追加します(mp3、wav、ogg、webm、m4a、各8 MBまで)。自分のアップロードは削除できます。キャラクターも、サウンドボードのコマンドで音を鳴らせます。

## Character Video Presence

この部分は、任意で、上級者向けです。**Character video presence**は、静止したアバターのタイルを、キャラクターのAI生成のループ動画クリップに置き換えます。デフォルトではオフです。スイッチは、**Chat Settings → Agents → Calls**にあります。

始める前に: **Connections**でVideo Generationのアカウントを追加し、**Default for Videos**にするか、毎回選んでください。

1. キャラクターまたはペルソナのエディターを開きます。
2. **Sprites**タブを開き、**Clips**サブタブに進みます。
3. **Generate Clips**をクリックするか、**Upload extra**で自分のクリップを追加します。
4. **Generate Call Clips**ウィンドウで、**Video Generation Connection**を選び、**Use avatar as reference**を選びます。
5. 標準のクリップを選びます: **Idle**、**Talking**、**Laughing**、**Angry**、**Crying**、**Sighing**。**Clip name**と動きの説明を入力して、自分だけのクリップを定義することもできます。

声に出して話すターンのあいだ、Marinaraは`[sighs]`のような行の中の声のキューを読み取り、合うリアクションのクリップを選び、その後Idleに戻します。クリップがなくても、通話は止まりません。キャラクターは、静止したアバターを表示します。トリミングしたクリップは、そのトリミング範囲の中でループします。[キャラクタースプライト(表情と全身)](../characters/sprites.md)を参照してください。

**Character video presence**がオンのときは、さらに2つのスイッチが、その下に表示されます。

- **Automatic video clips generation**(デフォルトはオフ)は、参加者に必要な**Idle**と**Talking**だけを作ります。リアクションやカスタムのクリップは、自動では作られません。
- **Custom clips**(デフォルトはオフ)は、キャラクターが、ライブ通話で1回限りのクリップをまれに依頼し、用意できたものを再生できるようにします。特別な依頼のためのもので、毎回の気分のためのものではありません。

**Character video presence**をオフにすると、この2つもオフになります。クリップは、再利用できるプレゼンスのループです。シーン動画を入れるGalleryの**Videos**ではありません。

## Speech-to-textの設定(上級)

**Mic recording + Local Whisper**モードのとき、または自分の音声認識サーバーを使いたいときだけ必要です。

<a id="download-local-whisper"></a>

### Local Whisperのダウンロード

Local Whisperは、Marinaraを動かしているコンピューター上で、音声をテキストに変えます。そのため、マイクの音声は文字起こしのために外へ出ません。ただし、通話の一部として、テキストは引き続きモデルに送られます。音声認識の対応が弱いブラウザー(Firefoxなど)では、もっとも確実なマイクの経路です。

始める前に: Callsをインストールしてください。インストールしないと、このセクションは表示されません。

1. **Connections**を開き、**On this device**の下にある**Speech to text**を探します。一覧にない場合は、**Add account**をクリックして、**Speech to text**を選びます。
2. このページの**Local Speech model**を探します。
3. モデルを選びます。
   - **Whisper Tiny (Multilingual)**: ダウンロードは約180 MB、メモリーは約350 MB。スマートフォンや古いコンピューターに最適です。
   - **Whisper Base (Multilingual)**: ダウンロードは約320 MB、メモリーは約650 MB。聞き取りにくい音声に向いています。
4. **Download Whisper**をクリックして、進行状況バーが終わるまで待ちます。
5. Callsを使う前に、Marinaraを完全に再起動します。

ごみ箱アイコンの**Delete Local Whisper**で、モデルを削除します。Callsをアンインストールすると、ダウンロードしたWhisperモデルも削除されます。再インストールしても、自分で選ぶまで、再ダウンロードはされません。

うまくいかなかった場合: MarinaraのLiteビルドでは、「Local Whisper is disabled in Lite mode. Use a full Marinara install to download and run the local speech model.」と表示されます。「native ONNX runtime」についてのメッセージが表示された場合は、お使いのプラットフォーム用の音声エンジンが見つかりません。Marinaraを動かしているのと同じNodeのビルドで、依存関係を再インストールしてから、再起動してください。

<a id="use-your-own-speech-to-text-server"></a>

### 自分の音声認識サーバーを使う

Local Whisperが、自分の言語やアクセントで苦戦する場合は、代わりに別の音声認識サーバーに音声を送ります。OpenAIの音声認識の形式(`/audio/transcriptions`のアドレス)を受け付けるサーバーであれば、自分で動かしているものでも、OpenAIやGroqのようなサービスでも使えます。

1. **Connections**を開き、**On this device**の下にある**Speech to text**を開きます。一覧にない場合は、**Add account**をクリックして、**Speech to text**を選びます。Callsがインストールされていないと、表示されません。
2. **Server URL**を入力します。例: `http://localhost:8000/v1`。
3. サーバーが必要とする場合は、**API key**を入力します。暗号化されて保存され、伏せて表示されます。
4. サーバーが使う**Model**名を入力します。空にすると、`whisper-1`を送ります。
5. 任意: **Language**のコードを入力します。`pl`や`de`のような形です。空にすると、サーバーが検出します。
6. **Test**をクリックします。Marinaraは、1秒間の無音のクリップを送ります。「The server answered.」または「The test failed.」と表示されます。
7. **Use your own speech-to-text server**をオンにします。

オンのあいだは、**Mic recording + Local Whisper**が、音声をこのサーバーに送ります。Local Whisperをダウンロードする必要はありません。音声がそのサーバーに届くので、信頼できるものを使ってください。同じコンピューター上のサーバーは動作します。ネットワーク上の別のコンピューターのサーバーは、`.env`で`STT_LOCAL_URLS_ENABLED=true`を設定しない限り、拒否されます([サーバー設定リファレンス](../CONFIGURATION.md)を参照)。

うまくいかなかった場合: **Test**の下のメッセージを読んでください。「Could not reach the speech-to-text server」は、アドレスが違うか、サーバーが停止しているという意味です。`STT_LOCAL_URLS_ENABLED`を挙げているメッセージは、サーバーが別のコンピューター上にあるという意味です。サーバーから返る数字のうち、401はたいていAPIキーの誤り、404はアドレスかモデル名の誤りです。通話がそれでもLocal Whisperを使う場合は、**Agents → Agent Organizer**からCallsをアップデートしてください。

## 設定とデフォルト

**Per chat**の設定は、1つのチャットに適用されます。**Global**の設定は、すべてのConversationの通話に適用されます。

| 設定 | 適用範囲 | デフォルト |
| --- | --- | --- |
| **Audio/Video Calls** | Per chat | オフ |
| **Calls**(コマンド) | Per chat | オン |
| **Generate voice cues in [tags]** | Per chat | オン |
| **Call Audio Pipeline** | Global | オフ |
| **Audio input mode** | Global | Mic recording + Local Whisper |
| **Camera and screen input** | Global | オフ |
| **Character video presence** | Global | オフ |
| **Automatic video clips generation** | Global | オフ |
| **Custom clips** | Global | オフ |

1つのチャットで変えたグローバルな設定は、すべてのConversationの通話に影響します。**Generate voice cues in [tags]**は、声に出して話す行の中に、`[whispering]`、`[laughing]`、`[sighs]`のような短いキューを加えるようモデルに頼みます。キューは、TTSが行を読む方法を形作り、リアクションのクリップの選択にも役立ちます。声に出して話す行をそのままにしたい場合は、オフにします。

## 通話中のコマンド

キャラクターは、通常のメッセージと同じ、見えないコマンドを、通話中にも使います。そのスイッチは、**Chat Settings → Agents → Commands**にあり、マスターの**Commands**スイッチがオンです。[キャラクターが使えるCommandsの選択](getting-started.md#choose-which-commands-a-character-can-use)を参照してください。コマンドは静かに実行され、声に出して読み上げられることはありません。

通話中には、追加のものが2つ働きます。**Soundboard**(キャラクターがサウンドボードの音を鳴らす)と、離脱または終了(キャラクターが通話から抜ける、または通話を終える)です。**Notes**と**Influence**は、チャットにつながっているチャットがあるときだけ表示されます([ConversationをRoleplayやGameにつなぐ](../chats/connected-chats.md)を参照)。自撮り写真には、**Selfie model**が必要です([自撮り写真](selfies.md)を参照)。コマンドによっては、画像付きの「sent a selfie」のような小さな項目が、通話チャットに追加されます。

## 通話終了後の要約

通話が終わると、カードがConversationに表示されます。タイトルは、**Call Started**、**Incoming Call**、**Call Ended**(長さ付き)、**Call Declined**、**Missed Call**のいずれかです。**Call Ended**の後、意味のある出来事があった場合、Marinaraは裏で短い要約を書き、モデルが読める非表示の文脈として追加します。これで、見えるチャットにコピーしなくても、モデルは通話を把握しています。

## トラブルシューティング

| 症状 | 対処 |
| --- | --- |
| キャラクターに自分の声が聞こえない | **Call Audio Pipeline**がオンで、ブラウザーがMarinaraのページでマイクを許可していることを確認してください。Firefoxや、ブラウザーの音声認識が使えない場合は、Local Whisperをダウンロードして、**Mic recording + Local Whisper**を使ってください。 |
| ブラウザーの音声認識を選んでも何も起きない | Firefoxには、ChromiumとSafariのブラウザーが持つWeb Speech認識がありません。**Mic recording + Local Whisper**か、**Manual system dictation**を使ってください。 |
| キャラクターが話さずに文字を入力する | Text to Speechの設定と声の割り当てを確認してください。[Text to Speech(TTS)のセットアップ](../media/tts-setup.md)を参照してください。 |
| モデルが話した内容を取り違える | **Whisper Base (Multilingual)**を試すか、雑音を減らすか、モデルが対応していれば**Provider-native audio/video**を使ってください。Whisperが苦手な言語では、[自分の音声認識サーバーを使い](#use-your-own-speech-to-text-server)、その**Language**を設定してください。 |
| カメラまたは画面のボタンが無効になっている | **Provider-native audio/video**モードを使い、**Camera and screen input**をオンにしてください。モデルもカメラや画面の入力に対応している必要があります。 |
| キャラクターが通話の途中で返信しなくなった | そのチャットのモデルのアカウントを確認して、通話チャットでもう一度メッセージを送ってください。 |
| スマートフォンで通話がうまく動かない | 通話チャットは**Open call chat**で開きます。音声については、TTSが設定されていることを確認してください。マイクについては、同じLocal Whisperと、許可の手順が当てはまります。 |

## 関連ガイド

- [Text to Speech(TTS)のセットアップ](../media/tts-setup.md)
- [内蔵モデルのセットアップ](../connections/local-model.md)
- [キャラクタースプライト(表情と全身)](../characters/sprites.md)
- [Conversationモード: はじめに](getting-started.md)
