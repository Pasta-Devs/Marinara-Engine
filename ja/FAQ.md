# よくある質問

Marinara Engineについてのよくある質問に、短く答えます。各回答から、詳しい手順を載せたガイドへ移動できます。

<a id="how-do-i-access-marinara-engine-from-my-phone-or-another-device"></a>

## スマートフォンやほかのデバイスからMarinara Engineを使うには?

Marinaraは1台のコンピューターでサーバーとして動き、ブラウザーで開いて使います。起動スクリプトはほかのデバイスからもサーバーに届くようにしますが、ホストのコンピューターでログイン(ユーザー名とパスワード)を設定するまでは、アクセス制御がブロックします。それまでは、離れたデバイスには**Access blocked**ページだけが表示されます。

1. ホストのコンピューターでMarinaraを起動したままにします。
2. ホストのローカルIPアドレスを調べます。Windowsでは`ipconfig`を実行し、**IPv4 Address**の値を読み取ります。macOSやLinuxでは`hostname -I`を実行します。
3. ほかのデバイスのブラウザーで`http://<host IP>:7860`を開きます。たとえば`http://192.168.1.42:7860`です。`7860`はデフォルトのポートです。
4. ログインを設定します。ほかのデバイスからMarinaraを開くと、ブロックのページに**Setup code**(セットアップコード)のフォームがあります。ホストのコンピューターのサーバーログで1回限りのコードを探し(Dockerでは`docker logs <container> 2>&1 | grep "setup code"`を実行します)、新しいユーザー名とパスワードと一緒に入力します。または、ホストですでにサインインしているブラウザーで、**Settings → Advanced → Access**(設定 → 詳細設定 → アクセス)を開きます。
5. サインインします。パスワードを入力せずにデバイスを追加するには、**Settings → Advanced → Access**の**Add a device**(デバイスを追加)を使います。

通常のデスクトップインストールでは、同じコンピューター(`127.0.0.1`)からのアクセスにパスワードは要りません。同じコンピューター上のリバースプロキシはリモートの訪問者として扱われ、ログインが必要です。すべての方法、セットアップコード、Dockerについては[リモートアクセス](REMOTE_ACCESS.md#option-1-login-recommended)を参照してください。別々のネットワークにあるデバイスには、Tailscaleを使います。[Tailscaleでどこからでも接続する](REMOTE_ACCESS.md#connect-from-anywhere-with-tailscale)を参照してください。接続できないときは[トラブルシューティング](TROUBLESHOOTING.md)を参照してください。

## Marinaraのモバイルアプリはありますか?

専用のネイティブアプリはありません。スマートフォンやタブレットでは、ブラウザーでWebアプリを使います。多くのブラウザーには**Add to Home Screen**(ホーム画面に追加)や**Install App**(アプリをインストール)があり、これでPWA(ブラウザーのバーがなく、アプリのように開くWebサイト)として保存できます。

Androidでは、[最新のAPKをダウンロード](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk)することもできます。Termuxを通じて、スマートフォン上でMarinaraを動かします。[Androidのインストール](installation/android-termux.md)を参照してください。iPhoneとiPadについては、[iOS PWAガイド](installation/ios-pwa.md)を参照してください。

Androidアプリでは、ランチャーに**Open in browser**(ブラウザーで開く)、**Retry connection**(接続を再試行)、**Install / Start Marinara**(Marinaraのインストール/起動)が表示されます。あとで選択を変えるには、**Settings → General → App Behavior → Open Android launcher (app or browser)**(設定 → 一般 → アプリの動作 → Androidランチャーを開く(アプリまたはブラウザー))を使います。古いAPKでは、`/android-login`で手動でサインインします。

<a id="can-i-play-with-other-people"></a>

## ほかの人と一緒にプレイできますか?

はい。オプションのマルチプレイヤーでは、複数の人で1つのConversation、Roleplay、Gameを共有できます。全員が設定をオンにしてから、ホストするか参加します。ゲストにAIキーは不要です。パスワードがあっても、知らないホストが安全になるわけではありません。オンにする前に[マルチプレイヤーの設定、警告、制限](CONFIGURATION.md#optional-multiplayer)を読んでください。

## 3つのチャットモードとは?

- **Conversation**: メッセージアプリのような形式で、キャラクターとチャットします。
- **Roleplay**: 語りの文章とキャラクターのアバターを伴う、没入感のある物語のシーンです。
- **Game**: AIのゲームマスターが進行するテキストアドベンチャーです。

どれを選ぶかは、[Marinara Engineをはじめる](home/welcome.md#choose-a-chat-mode)を参照してください。

## Conversationのスケジュールで使うタイムゾーンを変更するには?

Conversationを開き、Chat Settings(チャット設定)で**Schedule timezone**(スケジュールのタイムゾーン)を選びます。**Use device**(デバイスに合わせる)を選ぶと、デバイスのタイムゾーンに戻ります。これはすべてのConversationチャットに共通する1つの設定で、同じサーバーにつながっているほかのデバイスにも同期します。[Conversationモード: はじめに](conversation/getting-started.md)を参照してください。

## Conversationのチャットごとに別のスケジュールがありますか?

いいえ。スケジュールはキャラクターに属するので、そのキャラクターとのConversationチャットはすべて同じスケジュールを使います。編集は**Character Editor → Convo → Weekly schedule**(キャラクターエディター → Convo → 週間スケジュール)で行います。

1つのチャットだけですぐに返信がほしい場合は、そのチャットのChat Settingsで**Conversation schedules**(Conversationのスケジュール)をオフにします。**dnd**のような手動のステータス設定は引き続き適用され、すべてのチャットでそのキャラクターに属します。解除するには**clear**を使います。

## Marinaraを使うにはAPIキーが必要ですか?

オンラインのAIサービスを使う場合は必要です。**APIキー**とは、AIサービスが発行する秘密の文字列で、Marinaraがそのサービスのアカウントを使えるようにします。チャットを始めるには、アカウントが1つ以上必要です。**Connections**(接続)を開き、**Add**(追加)をクリックし、サービスを選んでキーを貼り付け、**Connect**(接続)をクリックします。[AIプロバイダーへの接続](connections/connecting-to-a-provider.md)を参照してください。

キーが不要な選択肢もあります。サブスクリプション方式の選択肢(Claude、ChatGPT、Grok)は、コマンドラインツールでサインインします。**Built-in model**(内蔵モデル)は、自分のコンピューター上で動きます。[内蔵モデルのセットアップ](connections/local-model.md)を参照してください。

## 対応しているAIプロバイダーは?

Marinaraは、テキスト、画像、動画の生成について、OpenAI、Anthropic、Google Gemini、OpenRouterをはじめとする多くのサービスに対応しています。Ollama、LM Studio、KoboldCppなどの**OpenAI-compatible**(OpenAI互換)のサーバーにも対応しています。全一覧は[対応しているAIプロバイダー](connections/providers-reference.md)にあります。追加するには、[AIプロバイダーへの接続](connections/connecting-to-a-provider.md)を参照してください。

## Marinaraの利用にお金はかかりますか?

Marinaraは無料です。費用は、使うAIサービスの料金だけです。無料で試せる選択肢もあります。**Pollinations**の画像生成にキーは要りません。**Stable Horde**は無料です。**Built-in model**(内蔵モデル)は、自分のコンピューター上で動きます。サブスクリプション方式の選択肢は、すでに契約しているかもしれない有料プランを使います。

## APIキーは安全ですか?

はい。APIキーはすべて、保存する前にAES-256で暗号化されます。アカウントとプロファイルのエクスポートでは秘密の値が除外されるので、**Import Profile**(プロファイルのインポート)を使ったあとは、キーを入力し直してください。フルバックアップのZIPに使った場合も同じです。フルバックアップのZIPには、暗号化されたレコードと、それを解除する鍵ファイルが含まれるので、他人の目に触れないように保管してください。[バックアップと復元](data/backup-and-restore.md)を参照してください。

## キャラクターカードとは?

キャラクターカードは、AIキャラクターのプロフィールを保存したものです。名前、アバター、性格、背景の設定、挨拶メッセージが含まれます。カードは**Character Editor**(キャラクターエディター)で作るか、ほかのアプリからインポートします。[キャラクターの作成と編集](characters/creating-and-editing-characters.md)を参照してください。

## ロアブックとは? 複数のキャラクターで使うには?

ロアブックは、世界の設定の集まりです。各エントリーは、きっかけになる言葉がチャットに現れたときだけプロンプトに加わります。使い方は次のとおりです。

1. ロアブックエディターで**Linked Characters**(紐付けるキャラクター)または**Linked Personas**(紐付けるペルソナ)を入力します。これで、そのキャラクターやペルソナがいるどのチャットでも働きます。
2. **Chat Settings → Lorebooks → Add Lorebook**(チャット設定 → ロアブック → ロアブックの追加)を開いて、1つのチャットに付けます。
3. 個々のエントリーを、特定のキャラクターに限定します。

[ロアブック](lorebooks/overview.md)を参照してください。

## エージェントとは?

エージェントは、チャット中に動いて決まった役割をこなす、任意のAIの補助機能です。たとえば、シーンを追跡したり、マップを追加したりします。インストール直後の状態では、1つも入っていません。**Agents → Agent Organizer**を開き、エージェントを選んでインストールします。そのあと、**Chat Settings**(チャット設定)でチャットごとにオンにします。[エージェント](agents/agents-overview.md)を参照してください。

## Noodleを設定するには?

Noodleは、キャラクターのための、ローカルで動く架空のソーシャルネットワークです。**Agents → Agent Organizer**から**Noodle**をインストールし、求められたらMarinaraを再起動してから、**Home → Noodle**(ホーム → Noodle)を開きます。[Noodle: アプリ内のソーシャルタイムライン](agents/noodle.md)を参照してください。

## キャラクターが返信しないのはなぜ?

多くの場合、チャットにアカウントやモデルがない、APIキーが間違っている、アカウントのクレジットが切れている、のいずれかです。[キャラクターが返信しない](TROUBLESHOOTING.md#my-character-does-not-reply)を参照してください。

## キャラクターが前のメッセージを覚えていないのはなぜ?

モデルが一度に読める文章の量には限りがあるので、長いチャットでは古いメッセージが外れていきます。これを補う道具が2つあります。**Memory Recall**(記憶の呼び出し)は関連する古いメッセージを呼び戻し、要約は古いメッセージを短いあらすじにまとめます。どちらも**Chat Settings**(チャット設定)にあります。長いRoleplayのチャットでは、**Chat Settings → Memory Recall**(チャット設定 → 記憶の呼び出し)の**Advanced Memory Recall**(高度な記憶の呼び出し)を使ってください。[記憶と要約](agents/memory.md)を参照してください。

## データをバックアップするには?

**Settings → Advanced → Backup & Export**(設定 → 詳細設定 → バックアップとエクスポート)を開き、**Download Backup**(バックアップのダウンロード)をクリックします。データとアップロードしたファイルをまとめた`.zip`が保存されます。復元するには、**Settings → Imports**(設定 → インポート)の**Import Profile (JSON/ZIP)**を使います。同じセクションでは、日次、週次、月次のバックアップを実行することもできます。[バックアップと復元](data/backup-and-restore.md)を参照してください。

## 拡張機能はどのような仕組みですか? 第三者のコードをインポートできますか?

デフォルトでは、Personal Extensionの下書きを作れるのはProfessor Mariだけです。下書きは最初はオフで、実行する前に、そのコードそのものを自分で承認します。第三者のインポートは、ホストが`.env`で`ENABLE_EXTERNAL_EXTENSIONS=true`を設定し、**Settings → Advanced → Danger Zone**(設定 → 詳細設定 → 危険な操作)の警告に同意するまで表示されません。[個人用拡張機能](extending/personal-extensions.md)を参照してください。

## データはどこに保存されますか?

Marinaraを動かしているコンピューターの、インストール先の`data`フォルダーに保存されます。クラウドには何も保存されません。[データの保存場所](data/where-data-is-stored.md)を参照してください。

## アップデートするとデータは消えますか?

消えません。アップデートしても、キャラクター、チャット、設定は残ります。それでも、先にバックアップを取ってください。古いバージョンに戻すと、新しいバージョンだけが保存しているデータが失われることがあります。[アップデート](UPGRADING.md)と[古いバージョンへダウングレードする](UPGRADING.md#downgrading-to-an-older-version)を参照してください。

## Professor Mariには何ができますか?

Professor Mariは、ホーム画面に組み込まれたアシスタントです。アプリの説明をし、頼めばキャラクター、ペルソナ、ロアブック、プリセットの作成や編集をします。変更のたびに、**Undo**(元に戻す)の付いたカードが表示されます。[Professor Mari](home/professor-mari.md)を参照してください。

## Storyboardエージェントとは何ですか? Game Modeではどう使いますか?

できあがった物語の文章を、画像に変えるエージェントです。**Agents → Agent Organizer**から**Storyboard**をインストールし、チャットでオンにします。[Storyboardエージェントガイド](game/storyboard.md)を参照してください。

## 通話でキャラクターに声を出してもらえますか?

はい。Conversationモードで使えます。**Connections**(接続)で**Text to Speech**(音声合成)を設定しておく必要があります。マイクの音声認識を含む手順は、[通話](conversation/calls.md)を参照してください。

## Marinaraは画像を生成できますか?

はい。**Pollinations**(キー不要)や有料のサービスなど、画像生成のアカウントを追加してください。[AIプロバイダーへの接続](connections/connecting-to-a-provider.md)を参照してください。

## アプリの中でドキュメントを読むには?

ホーム画面で、ブックマークの**Documentation**(ドキュメント)をクリックします。スマートフォンでは、先にブックマークのメニューを開いてください。ホーム画面のFAQで、**Open Documentation**(ドキュメントを開く)をクリックすることもできます。

## 助けを求めたり、バグを報告したりするには?

まずは[トラブルシューティング](TROUBLESHOOTING.md)を確認してください。ホーム画面では、**Discord**でコミュニティのチャットが、**Support**でプロジェクトのサポートページが開きます。バグの報告と機能の要望は、プロジェクトのGitHubページで行ってください。

## 関連ガイド

- [トラブルシューティング](TROUBLESHOOTING.md)
- [インストール](INSTALLATION.md)
- [リモートアクセス](REMOTE_ACCESS.md)
- [AIプロバイダーへの接続](connections/connecting-to-a-provider.md)
