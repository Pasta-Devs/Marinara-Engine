# 内蔵モデルのセットアップ

**Built-in model**(内蔵モデル)は、Marinaraがダウンロードして自分のコンピューターで動かす小さなAIモデルです。APIキーもオンラインのアカウントも必要なく、何もコンピューターの外に出ません。

小さいモデルなので、裏方の補助作業に向いています。トラッカーエージェント(ストーリーの細部を追い続ける補助役)、Game Modeのシーン効果、ロアブックの埋め込み、判定のチェックなどです。良いロールプレイやProfessor Mariによる編集には力不足です。そうした用途には、より高性能なアカウントを使ってください。[AIプロバイダーへの接続](connecting-to-a-provider.md)を参照してください。

**Built-in model**のカードが見当たらない場合は、「Lite」版をインストールしています。Lite版は、ローカルランタイムを含めずに軽量化したビルドです。

## 内蔵モデルをダウンロードする

始める前に、モデルを置ける空きディスク容量とメモリー(RAM)があることを確認してください。サイズは下の表にあります。

1. 上部バーの**Connections**(接続)をクリックします。
2. **Jobs**(役割)ボックスの下にある**Built-in model**(内蔵モデル)のカードを探します。カードには**Not downloaded**と表示されています。
3. カードか、その**Download**(ダウンロード)ボタンをクリックします。**Built-in model**というタイトルのウィンドウが開きます。
4. **Which model?**(どのモデル?)でモデルを選びます。**Gemma 4 E2B — Q8 (Best Quality)**には**Recommended**(おすすめ)のタグが付いています。コンピューターのメモリーが少ない場合は、**Q4_K_M**を選んでください。RAMが5.4 GBではなく、約3.4 GBで済みます。
5. 下部の**Download**ボタンをクリックします。ボタンには、**Download 5.0 GB**のようにモデルのサイズが表示されています。
6. 待ちます。ウィンドウには、**Install runtime**(ランタイムをインストール)、**Download model**(モデルをダウンロード)、**Start and test**(起動とテスト)の3つのステップが表示されます。ランタイムとは、モデルを動かすプログラムのことです。ランタイムがない場合、Marinaraは先にそれをインストールします。
7. ウィンドウに、緑の点と一緒にモデル名が表示されたら、**Test**(テスト)をクリックします。**Local test message**(ローカルのテストメッセージ)というタイトルのボックスに、**Succeeded**と、返信にかかった時間が表示されます。
8. **Done**(完了)をクリックします。

カードには、**Ready**と、モデルのサイズ、担当する役割が表示されるようになります。

うまくいかなかった場合:

- **Sidecar runtime install is disabled**(エラーメッセージ)。ランタイムのインストールは保護された操作です。[ランタイムのインストールを許可する](#allow-runtime-installs)を参照してください。
- **Local runtime failed to start**と表示される。[トラブルシューティング](#troubleshooting)を参照してください。
- **Download failed**と表示される。ウィンドウにエラーが表示されます。インターネット接続と空きディスク容量を確認してから、もう一度ダウンロードボタンをクリックしてください。

**Connections**パネルの**Add**(追加)からも、このウィンドウを開けます。**Add account**(アカウントの追加)ウィンドウの**Built-in model**の下にあります。

### 厳選済みプリセット

ウィンドウには、Googleの小さなモデルであるGemma 4 E2Bの、あらかじめ用意された2つのプリセットがあります。Apple Siliconのコンピューターでは、GGUFファイルの代わりにMLX版が使われます。GGUFとMLXは、ローカルモデルの2つのファイル形式です。下のサイズは、ウィンドウに表示される値です(単位はGBで、1 GBは1024 × 1024 × 1024バイトです)。

| プリセット | ダウンロード | 実行時のRAM |
| --- | --- | --- |
| Q8 (Best Quality) | 5.0 GB | 5.4 GB |
| Q4_K_M (Smaller, Faster) | 3.0 GB | 3.4 GB |

Apple Siliconでは、代わりに2つのMLXプリセットが表示されます。

| プリセット | ダウンロード | 実行時のRAM |
| --- | --- | --- |
| 8-bit MLX (Best Quality) | 5.5 GB | 7.0 GB |
| 4-bit MLX (Smaller, Faster) | 3.4 GB | 4.5 GB |

Marinaraがディスク上に保持する内蔵モデルは、常に1つだけです。別のモデルを選ぶと、最初のモデルと置き換わります。あとで切り替えるには、カードを開き、**Built-in model**ウィンドウで**Change model**(モデルを変更)をクリックします。カードのページでは、**Model**(モデル)の横にあるボタンでプリセットを切り替えられます。その際、先にダウンロードサイズの確認を求められます。

### 自分のモデルを使う

**Your own model**(自分のモデル)では、Hugging Face(公開のモデル共有サイト)のGGUFモデルか、Marinaraを動かしているコンピューター上のファイルを使えます。

1. **Your own model**をクリックし、**Hugging Face**か**File on the server**(サーバー上のファイル)のタブを選びます。
2. **Hugging Face**では、リポジトリー名を`owner/repo`の形式で入力し、**Find files**(ファイルを探す)をクリックします。一覧からファイルを1つ選びます。
3. **File on the server**では、`.gguf`ファイルのフルパスを入力します。Marinaraはファイルをその場所のまま使い、コピーはしません。
4. 下部のボタンをクリックします。ボタンは**Download**です。サーバー上のファイルの場合は**Use this file**(このファイルを使う)です。

Apple Siliconでは、**Find files**が**Validate repo**(リポジトリーを検証)になり、リポジトリーはMLXネイティブである必要があります。サーバー上のGGUFファイルはApple Siliconでも使えます。その場合はMLXではなくllama.cppを使います。

## 内蔵モデルを補助の役割に使う

ダウンロードしたあとで、**Built-in model**(内蔵モデル)のカードを開きます。そのページには、状態、メモリー使用量、**Used by**(使用先)が表示され、次の操作があります。

| 操作 | 内容 |
| --- | --- |
| **Use for tracker agents (roleplay)**(ロールプレイのトラッカーエージェントに使う) | トラッカーエージェントのためにモデルを動かし続けます。デフォルトはオフです。 |
| **Use for game scene analysis**(ゲームのシーン解析に使う) | 背景、音楽、天候などのGame Modeのシーン効果のためにモデルを動かし続けます。デフォルトはオンです。 |
| **Use the built-in model for all tracker agents**(すべてのトラッカーエージェントに内蔵モデルを使う) | 標準搭載のトラッカーエージェントすべてを、このモデルに向けます。エージェント自体はオンになりません。 |
| **Change in Defaults**(デフォルトで変更) | **Jobs**(役割)ボックスを開きます。そこで、ほかの役割を割り当てられます。 |

両方のスイッチがオフの場合、モデルは自動では起動しません。どちらかをオンにしたとき、またはチャットや役割がモデルを使うときに起動します。エージェントを有効にする方法は、[Memory Recallとチャットの要約](../agents/memory.md)を参照してください。

Game Modeのセットアップでは、**Scene effects model**(シーン効果のモデル)に内蔵モデルを使えます。[Game Mode: はじめに](../game/getting-started.md)を参照してください。

### ロアブックの埋め込み

埋め込みとは、ロアブックを意味で検索できるようにするための数値です。埋め込みに内蔵モデルを使うには、ロアブックのベクトル化のモデルとして**Built-in model (on this device)**(このデバイス上の内蔵モデル)を選びます。先に**Use for tracker agents (roleplay)**(ロールプレイのトラッカーエージェントに使う)か**Use for game scene analysis**(ゲームのシーン解析に使う)をオンにしてください。オフのままだとリクエストは失敗します。この方法にはGGUFランタイムが必要なため、Apple SiliconのMLXでは動きません。[ロアブックのセマンティック検索](../lorebooks/semantic-search.md)を参照してください。

### Decisionモデル

内蔵モデルをDecisionモデルとして選ぶこともできます。[Decisionモデル](decision-models.md)を参照してください。

### チャットモデル

内蔵モデルとチャットするには、次のようにします。

1. チャットを開き、チャット入力欄のモデルボタン(リンクのアイコン)をクリックします。
2. **Model for this chat**(このチャットのモデル)で、**Built-in model (on this device)**(このデバイス上の内蔵モデル)を選びます。一覧のいちばん下にあり、モデルをダウンロードすると表示されます。
3. メッセージを送ります。モデルが小さいため、返信が遅い、短い、品質が低いといったことがある、という警告が表示されます。

## ランタイムの設定

開くには、カードのページで**Runtime settings**(ランタイムの設定)をクリックするか、**Built-in model**(内蔵モデル)ウィンドウで**Settings**(設定)をクリックします。設定は4つのグループに分かれています。ドロップダウンとスイッチは、すぐに保存されます。数値の欄は、**Apply settings**(設定を適用)をクリックしたときに保存されます。**Physical batch size**(物理バッチサイズ)と**Custom GPU layers**(GPUレイヤー数を指定)には、それぞれ専用の**Apply**(適用)があります。

**Speed**(速度)

| 設定 | デフォルト | 内容 |
| --- | --- | --- |
| **Runtime target**(ランタイムの対象) | Auto detect | Marinaraがどのグラフィックスカードの系統向けにインストールするか。 |
| **GPU offload**(GPUオフロード) | Auto offload | どれだけの処理をグラフィックスカードに任せるか。**Auto offload**、**CPU only**、**Custom GPU layers**(1から1024)から選びます。 |

**Memory**(メモリー)

| 設定 | デフォルト | 内容 |
| --- | --- | --- |
| **Context window**(コンテキストウィンドウ) | 8192 | モデルが一度に読む文章の量(トークン数)。512以上。 |
| **KV cache type**(KVキャッシュの種類) | f16 | モデルが読んだ内容をどう保存するか。f16、q8_0、q4_0から選びます。後の2つはメモリーの使用量が少なく、Flash Attentionへの対応が必要です。 |

**Replies**(返信)

| 設定 | デフォルト | 内容 |
| --- | --- | --- |
| **Max response tokens**(返信の最大トークン数) | 4096 | モデルが書ける返信の最大の長さ。64以上。 |
| **Temperature** | 0.3 | 返信のランダムさ。0から2。 |
| **Top P** | 0.95 | 単語選択の制限。0より大きく、1以下。 |
| **Top K** | 64 | 単語選択の制限。0から500。 |

**Expert**(上級者向け)

| 設定 | デフォルト | 内容 |
| --- | --- | --- |
| **Native tool calls**(ネイティブのツール呼び出し) | On | モデルにツールを使わせます。Professor Mariとカスタムエージェントには、これをオンにする必要があります。 |
| **Max parallel agent jobs**(エージェントの最大並列ジョブ数) | 2 | 同時に実行するジョブの数。1から16。 |
| **Pooling type**(プーリングの種類) | None | ロアブック検索のために、モデルがテキストを数値に変える方法。ロアブックの埋め込みには**Mean**を選びます。 |
| **Physical batch size** | 512 | ロアブックの埋め込みの1バッチあたりのテキスト量。128から32768。長いエントリーが失敗するときは値を上げてください。Gemmaでは、多くの場合1024で動きます。 |

システムによって異なる設定もあります。

- WindowsとLinux (x64)の**Runtime target**では、Auto detect、NVIDIA GPU、AMD GPU、Intel GPU、Vulkan GPU、CPU only、System llama-serverを選べます。ほかのシステムでは選択肢が少なくなります。
- Apple Siliconでは、MLXがアクセラレーターを自動で選びます。**Runtime target**、**GPU offload**、**KV cache type**、**Native tool calls**、**Pooling type**、**Physical batch size**は表示されません。
- **Max response tokens**は、Game Modeのシーン解析には上限を設けません。シーン解析には独自の上限があります。
- **Expert**の**Diagnostics**(診断)には、ランタイムのビルド、検出されたグラフィックスカード、最後の起動コマンドが表示されます。

<a id="allow-runtime-installs"></a>

### ランタイムのインストールを許可する

ランタイムのインストールと再インストールは、保護された操作です。Windowsのワンクリックインストール版では、自動的に許可されます。macOS、Linux、Dockerでは、次のどちらかを行ってから、もう一度試してください。

- **Settings → Advanced → Admin Access**(設定 → 詳細設定 → 管理者アクセス)で管理者用シークレットを入力します。管理者用シークレットとは、リスクのある操作に使う2つ目のパスワードです。サーバーのコンピューター上の**Admin Access**で作成するか、サーバーの`.env`ファイルに`ADMIN_SECRET`として設定します。[Admin Access](../REMOTE_ACCESS.md#admin-access-and-privileged-actions)を参照してください。
- サーバーの`.env`ファイルに`SIDECAR_RUNTIME_INSTALL_ENABLED=true`を追加し、Marinaraを再起動します。`.env`ファイルは、Marinaraのフォルダーにあるテキストファイルです。[.envファイルの編集](../CONFIGURATION.md#edit-the-env-file)を参照してください。

Marinaraがダウンロードするのは、使っているリリースで承認されたllama.cpp、MLX、uvのバージョンだけです。何かを実行する前に、各ファイルのサイズとSHA-256チェックサムを確認します。

## ローカル音声モデル

**Local speech model**(ローカル音声モデル)は、Conversationの通話のために、自分のコンピューター上で声をテキストに変換します。これはWhisperモデル、つまり音声をテキストに変換するモデルです。**Agents → Agent Organizer**でインストールする**Calls**エージェントパッケージが必要です。

1. **Connections**(接続)パネルを開き、**On this device**(このデバイス上)の下にある**Speech to text**(音声認識)の項目をクリックします。
2. **Local speech model**の下のドロップダウンからモデルを選びます。
3. **Download Whisper**(Whisperをダウンロード)をクリックします。
4. **Ready**になるまで待ちます。Callsを使う前に、Marinaraを完全に再起動してください。

| モデル | ダウンロード | 実行時のRAM |
| --- | --- | --- |
| Whisper Tiny (Multilingual) | 約180 MB | 約350 MB |
| Whisper Base (Multilingual) | 約320 MB | 約650 MB |

スマートフォンや古いコンピューターでは、まずTinyがおすすめです。Baseは聞き取りにくい音声でも精度が上がりますが、起動は遅くなります。ダウンロードしたモデルを削除するには、ゴミ箱のボタン(**Delete Local Whisper**)をクリックします。Callsをアンインストールしても削除されます。

音声はコンピューターの外に出ません。チャットモデルに送られるのはテキストだけです。通話で使うには、通話の音声入力をLocal Whisperに設定します。[Conversationの音声通話とビデオ通話](../conversation/calls.md)を参照してください。代わりに**Speech to text**サーバーをオンにすると、通話では音声がそのサーバーに送られます。[自分の音声認識サーバーを使う](../conversation/calls.md#use-your-own-speech-to-text-server)を参照してください。

<a id="troubleshooting"></a>

## トラブルシューティング

| 症状 | 対処 |
| --- | --- |
| **Sidecar runtime install is disabled**(エラーメッセージ)。 | [ランタイムのインストールを許可する](#allow-runtime-installs)を参照してください。 |
| **Local runtime failed to start**と表示される。ウィンドウにエラーとログファイルのパスが表示されます。カードには**Local runtime unavailable**と表示されます。 | **Retry startup**(起動を再試行)をクリックします。それでも失敗する場合は、**Reinstall runtime**(ランタイムを再インストール)をクリックするか、別の**Runtime target**(ランタイムの対象)を選びます。**Continue without local AI**(ローカルAIなしで続ける)をクリックすると、補助用のスイッチがオフになり、モデルなしでMarinaraを使い続けられます。 |
| ランタイムのダウンロードで、サイズかSHA-256の不一致が報告される。 | Marinaraはそのファイルを破棄しています。Marinaraをアップデートしてから、もう一度試してください。それでも失敗する場合は、そのファイルを自分で開かないでください。ランタイムの対象とエラーを報告してください。 |
| ロアブックの検索で、ローカルモデルが有効になっていないと表示される。 | **Use for tracker agents (roleplay)**(ロールプレイのトラッカーエージェントに使う)か**Use for game scene analysis**(ゲームのシーン解析に使う)をオンにしてから、もう一度ベクトル化してください。 |
| Game Modeのバナーに**Local scene helper failed to start**と表示される。 | バナーの**Open Local AI Model**(ローカルAIモデルを開く)をクリックすると、再試行、モデルの切り替え、ローカルのシーン解析のオフができます。 |

さらに詳しい情報は、[Marinara Engineのトラブルシューティング](../TROUBLESHOOTING.md)を参照してください。

## 関連ガイド

- [AIプロバイダーへの接続](connecting-to-a-provider.md)
- [Decisionモデル](decision-models.md)
- [ローカルモデルやセルフホストモデルへの接続](local-self-hosted.md)
- [Memory Recallとチャットの要約](../agents/memory.md)
- [Conversationの音声通話とビデオ通話](../conversation/calls.md)
- [Game Mode: はじめに](../game/getting-started.md)
- [ロアブックのセマンティック検索](../lorebooks/semantic-search.md)
