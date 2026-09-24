# Local Modelのセットアップ

このガイドでは、Marinara Engineがダウンロードして手元のコンピューターで動かす小さなAIモデル、**Local Model**(ローカルモデル)について説明します。APIキーもオンラインのアカウントも必要ありません。セットアップの手順、**Runtime Settings**(ランタイム設定)、そしてトラッカーエージェント、Game Modeのシーン効果、オフラインでの通話の文字起こしといった補助機能をLocal Modelがどう支えているのかがわかります。

## Local Modelとは

**Local Model**は、コンピューターの中だけで完結して動く小型の言語モデル(Gemma)です。APIキーとは、Marinaraがオンラインのサービスと通信するための秘密の文字列です。Local Modelは何もコンピューターの外に送らないため、APIキーは必要ありません。

Local Modelは意図的に小さく作られています。用途は裏方の補助作業で、メインのチャットやロールプレイ用ではありません。Marinaraは次の仕事にLocal Modelを使います。

- Roleplayモードのトラッカーエージェント。
- Game Modeのシーン効果(背景、音楽、天候など)。
- セマンティック検索のためのロアブックの埋め込み生成。
- Conversationの通話でのマイク入力の文字起こし(別の音声モデルを使用)。
- Decisionモデルに選ぶと、起動質問と判定文に回答します。[Decisionモデル](decision-models.md)を参照してください。


設定ウィンドウではこの機能を**Local AI Model**と呼び、接続のドロップダウンでは**Local Model (sidecar)**と表示します。どちらも同じ機能です。

メインのチャット、ロールプレイ、ゲームマスター(GM)の語り、Professor Mariによる編集にLocal Modelを使うのはおすすめしません。これらの用途には小さすぎて、良い結果になりません。より高性能な接続を使ってください。[AIプロバイダーへの接続](connecting-to-a-provider.md)を参照してください。

## Local Modelのカードを開く

Local Modelは**Connections**(接続)パネルにあります。

1. **Connections**パネルを開きます。
2. **Local Model**というタイトルのカードを探します。
3. カードをクリックするか、**Open local model settings**という説明の付いた歯車ボタンをクリックします。

歯車ボタンを押すと、**Local AI Model**という完全な設定ウィンドウが開きます。モデルをまだダウンロードしていない場合は、カードに**Download now**ボタンと**Choose model options**ボタンも表示されます。どちらを押しても同じ設定ウィンドウが開きます。

設定ウィンドウの中には、**Local Model is for helpers, not main roleplay**というタイトルの警告ボックスがあります。このモデルが補助作業専用であることを、あらためて伝えるものです。

## ハードウェアとオペレーティングシステムの対応

Local Modelは、ランタイム(モデルを動かすプログラム)とモデルファイルをダウンロードします。この両方を置ける空きディスク容量とメモリー(RAM)が必要です。

対応状況はオペレーティングシステムによって異なります。

- **Windows (64-bit)とLinux (64-bit)**: **Runtime Target**の選択肢がすべて使えます。グラフィックスカード(GPU)の系統を選ぶことも、プロセッサー(CPU)だけで動かすこともできます。
- **Windows on ARMとLinux on ARM**: 選択肢は少なくなり、ほとんどがCPU向けです。
- **macOS on Apple Silicon**: MarinaraはApple製チップに最適化されたMLXランタイムを使います。独自モデルは単一のファイルではなく、HuggingFaceのリポジトリーを指定します。
- **macOS on IntelとAndroid**: 実質的にCPUのみです。

Local Modelは「Lite」版のインストールでは利用できません。Lite版は、容量を節約するためにローカルランタイムを含めずに軽量化したビルドです。Lite版ではLocal Modelのカード自体が表示されません。

## 初回のセットアップ

先にランタイムを用意し、そのあとでモデルを選びます。

1. **Local AI Model**の設定ウィンドウを開きます。
2. **Install Runtime**をクリックします。Apple Siliconではこのボタンが**Install MLX Runtime**になります。
3. ランタイムのインストールが終わるまで待ちます。ダウンロードの進み具合はプログレスバーに表示します。
4. 後述の「モデルのダウンロード」の手順でモデルを選びます。
5. モデルのダウンロードが終わるまで待ちます。
6. 状態が**Ready**になったら**Done**をクリックします。

途中でやめたいときは**Skip for Now**をクリックします。モデルが1つでも入っている場合、このボタンは**Close**に変わります。

ランタイムのインストールと再インストールは保護された操作です。Windowsのワンクリックインストール版では自動的に許可されています。macOS、Linux、Dockerでは、自分で許可する必要がある場合があります。後述の「トラブルシューティング」を参照してください。

Marinaraがダウンロードするのは、使用中のEngineのリリースで承認されたllama.cpp、MLX、uvのバージョンだけです。展開や実行の前に、ファイルサイズとSHA-256チェックサムが完全に一致するか検証します。MLXのPython依存関係もバージョンを固定してハッシュを検証したうえで、審査済みのmlx-lmのソースを追加パッケージの解決なしにインストールします。そのためランタイムの更新は、上流の「latest」ビルドに黙って追従するのではなく、審査を経たMarinaraのアップデートとして届きます。

## モデルのダウンロード

設定ウィンドウには、モデルを入手する方法が2つあります。

### 厳選済みプリセット

**Curated Gemma 4 Presets**では、あらかじめ用意された2つの選択肢から選びます。Apple製以外のハードウェアではGGUF形式を使います。

| プリセット | ダウンロードサイズ | 実行時のRAM |
| --- | --- | --- |
| Q8 (Best Quality) | 約5.4 GB | 約5.8 GB |
| Q4_K_M (Smaller, Faster) | 約3.2 GB | 約3.6 GB |

Q8には**Recommended**のタグが付いており、品質がいちばん高くなります。Q4_K_Mはサイズが小さくて動作が速く、メモリーの使用量も少なくて済みます。

Apple Siliconでは、この2つがMLXのプリセットに変わります。8-bitのMLXプリセットはダウンロードが約5.9 GB、RAMが約7.5 GB必要です。4-bitのMLXプリセットはダウンロードが約3.6 GB、RAMが約4.8 GB必要です。

プリセットをダウンロードする手順は次のとおりです。

1. 使いたいプリセットを選びます。
2. **Use Curated Preset**をクリックします。すでにモデルが入っている場合、このボタンは**Switch to Curated Preset**になります。

### 自分で選んだモデルを使う

**Use Your Own Model From HuggingFace**では、モデル共有サイトHuggingFaceから好きなモデルを指定できます。

1. 欄にリポジトリー名を入力します。形式は`owner/repo`です。
2. **List Models**をクリックします。Apple Siliconではこのボタンが**Validate Repo**になります。
3. Apple製以外のハードウェアでは、ドロップダウンから使いたいファイルを選び、**Download Selected GGUF**をクリックします。
4. Apple Siliconでは、リポジトリーの検証が終わったら**Use Validated MLX Repo**をクリックします。

Marinaraがディスク上に保持するLocal Modelのファイルは常に1つだけです。新しいモデルをダウンロードすると、先に古いモデルを削除します。メインのLocal Modelには専用の削除ボタンがありません。取り除きたいときは、別のモデルをダウンロードして上書きします。

## Runtime Settingsのリファレンス

モデルの動かし方を調整するには、設定ウィンドウ内の**Runtime Settings**セクションを開きます。項目によって保存の仕方が異なります。

- ドロップダウンと**Native Tool Calls**スイッチは、変更した時点で保存します。
- **Context Window**、**Max Response Tokens**、**Temperature**、**Top P**、**Top K**は、**Apply Settings**をクリックしたときにだけ反映します。
- **Physical Batch Size**には専用の**Apply**ボタンがあります。**GPU Offload**を**Custom GPU layers**にしたときに現れるレイヤー数の欄も同じです。

| 設定 | デフォルト | 内容 |
| --- | --- | --- |
| Runtime Target | Auto detect | どのGPU系統向けにインストールするか |
| GPU Offload | Auto offload | どれだけの処理をGPUに任せるか |
| Native Tool Calls | On | モデルにツールと関数呼び出しを使わせる |
| Pooling Type | None | ロアブック検索のための埋め込み計算 |
| Physical Batch Size | 512 | ロアブックの埋め込み要求のバッチサイズ |
| Context Window | 8192 | モデルが一度に読み取れる文章の量 |
| Max Response Tokens | 4096 | モデルが書ける返信の最大の長さ |
| Temperature | 0.3 | 返信のランダムさ |
| Top P | 0.95 | 単語選択の絞り込みの基準 |
| Top K | 64 | 単語選択の絞り込みの基準 |

分かりにくい項目についての補足です。

- **Runtime Target**と**GPU Offload**はGGUFランタイムでのみ表示します。Apple SiliconではMLXがアクセラレーターを自動で選びます。
- **Pooling Type**と**Physical Batch Size**もGGUFランタイム限定で、**Embedding Endpoint**の見出しの下にあります。調整の対象はロアブックの埋め込みだけで、通常のチャットの返信は変わりません。
- **Pooling Type**のデフォルトは**None**です。Local Modelをロアブックの埋め込みに使うときは**Mean**に切り替えます。
- **Physical Batch Size**は、埋め込みのエンドポイントが一度に処理する文章の量を決めます。長いロアブックのエントリーのベクトル化が失敗するときは値を上げてください。Gemmaでは1024が推奨として表示されます。
- ツールを動かすには**Native Tool Calls**をオンにする必要があります。警告には、ローカルモデルでツールを実行するにはProfessor Mariとカスタムエージェントのためにこの設定を有効にする必要がある、と書かれています。この項目はMLXランタイムでは使えません。
- **Max Response Tokens**は、通常のチャットとエージェントの返信に上限を設けます。Game Modeのシーン解析には適用されません。こちらは内部で独自の上限を持っています。

## Send Test Message

ランタイムが正しく動くかどうかは**Send Test Message**で確認します。このボタンはRuntimeのセクションにあります。モデルのダウンロードとランタイムのインストールが終わるまでは押せません。

1. **Send Test Message**をクリックします。
2. 結果のボックスが出るまで待ちます。
3. 成功すると**Local Test Message Succeeded**と往復にかかった時間を表示します。
4. 失敗すると**Local Test Message Failed**とエラー内容を表示します。

テストには固定のプロンプトを使います。Temperatureやトークン数の設定は無視するため、モデルが応答するかどうかだけを素直に確かめられます。

## Local Modelを補助機能に使う

モデルをダウンロードすると、Local Modelのカードに2つのスイッチが現れます。

- **Use for tracker agents (roleplay)**。デフォルトはオフです。
- **Use for game scene analysis**。デフォルトはオンです。

この2つのスイッチが、MarinaraがLocal Modelをバックグラウンドで動かし続けるかどうかを決めます。両方ともオフなら、ランタイムは自動では起動しません。どちらか一方でもオンにすると、Marinaraはローカルサーバーを自動的に起動します。オンにした直後の最初の起動には少し時間がかかることがあります。

カードには**Use local model for all tracker agents**ボタンもあります。標準搭載のトラッカーエージェントすべてを、ワンクリックでLocal Modelに向けられます。すぐ下の行には、いくつのトラッカーエージェントがローカルモデルを指しているかを「3/7 built-in tracker agents currently point at the local model.」のように表示します。これで変わるのはエージェントが使うモデルだけで、エージェント自体はオンになりません。エージェントを有効にする方法は[Memory Recallとチャットの要約](../agents/memory.md)と、使っているモードのガイドを参照してください。

Game Modeでは、シーンの処理をLocal Modelに任せることもできます。Gameのセットアップにある**Scene Effects Connection**ドロップダウンで**Local Model (Gemma)**を選べます。これを選ぶと**Use for game scene analysis**スイッチがオンになります。[Game Mode: はじめに](../game/getting-started.md)を参照してください。

### ロアブックの埋め込みにLocal Modelを使う

ロアブックのセマンティック検索をLocal Modelで動かすこともできます。ロアブックのベクトル化の設定で、接続として**Local Model (sidecar)**を選びます。これには**Use for tracker agents (roleplay)**か**Use for game scene analysis**が先にオンになっている必要があります。両方ともオフの場合は、トラッカーかゲームのシーン解析のためにローカルモデルを有効にするよう促すメッセージが出て、処理は失敗します。この機能はGGUFランタイムを使うため、Apple SiliconのMLXでは利用できません。[ロアブックのセマンティック検索](../lorebooks/semantic-search.md)を参照してください。

## Local Modelをチャットの接続として使う

モデルをダウンロードすると、ほとんどの接続の選択欄の末尾にLocal Modelが並びます。表示は**Local Model (sidecar)**で、モデル名が判明している場合は**Local Model**の後ろに括弧付きでモデル名が入ります。

通常のチャットにこれを選ぶと警告が出ます。Local Modelは非常に小さく補助作業向けであること、そしてメインのチャットやロールプレイの返信が遅い、短い、品質が低いといった結果になりうることを伝える内容です。この項目は実際に保存された接続ではないため、接続のデフォルト値を保存することはできません。

チャットに選んだ場合は、補助機能のスイッチが両方ともオフでも、必要に応じてローカルサーバーが起動します。Game Modeのメインモデルのドロップダウンには表示しません。Game ModeがLocal Modelを使うのは**Scene Effects Connection**経由だけです。

## 通話のためのLocal Speech Model

**Local Speech Model**は、オフラインでマイクの音声を文字起こしするための、Calls用の追加ダウンロードです。Conversationの通話で、自分の声を手元のコンピューターで文字起こしすると決めたときに動きます。中身はWhisperモデル、つまり話した言葉をテキストに変換する音声認識モデルです。

まず**Agents > Download Agents**から**Calls**をインストールします。その後、Connectionsの**Local Model**カードにある**Local Speech Model**の見出しからWhisperを管理できます。Callsが入っていない間は、この見出しとダウンロードの操作は表示しません。

選択肢は2つです。

- **Whisper Tiny (Multilingual)**: ダウンロード約180 MB、RAM約350 MB。スマートフォンや古いコンピューターでは、まずこちらが向いています。
- **Whisper Base (Multilingual)**: ダウンロード約320 MB、RAM約650 MB。聞き取りにくい音声でも精度は上がりますが、起動は遅くなります。

セットアップの手順は次のとおりです。

1. **Local Model**カードを開いて展開します。
2. **Local Speech Model**の下のドロップダウンからモデルを選びます。
3. **Download Whisper**をクリックします。
4. **Ready**と表示されればセットアップは完了です。

選択中のモデルだけを削除するには、**Delete Local Whisper**という説明の付いたゴミ箱ボタンをクリックします。Callsをアンインストールすると、ダウンロード済みのWhisperと選択内容をすべて自動的に削除し、ディスク容量を解放します。あとでCallsを入れ直せば、Local Speech Modelの操作も戻り、Whisperを再びダウンロードできます。

録音した音声がコンピューターの外に出ることはありません。送信されるのは、文字起こしされたテキストだけで、宛先は選んだチャットの接続です。通話で使うには、通話の音声入力モードをLocal Whisperの選択肢に設定します。[Conversationの音声通話とビデオ通話](../conversation/calls.md)を参照してください。

## トラブルシューティング

**「Sidecar runtime install is disabled.」** ランタイムのインストールと再インストールは保護された操作です。Windowsのワンクリックインストール版では自動的に許可されます。macOS、Linux、Dockerでは方法が2つあります。1つは、サーバーの`.env`ファイルに`SIDECAR_RUNTIME_INSTALL_ENABLED=true`を設定する方法です。次のように書きます。

```
SIDECAR_RUNTIME_INSTALL_ENABLED=true
```

もう1つは、**Settings -> Advanced -> Admin Access**でAdmin Accessのシークレットを一度入力してから、もう一度試す方法です。[サーバー設定リファレンス](../CONFIGURATION.md)を参照してください。

**ランタイムが起動しない。** 設定ウィンドウに**Local runtime failed to start**というタイトルのボックスが出て、エラー内容とログファイルのパスを表示します。**Retry Startup**をクリックしてください。それでも駄目なら**Reinstall Runtime**をクリックするか、別の**Runtime Target**を試します。**Continue Without Local AI**をクリックすれば、Local ModelなしでそのままMarinaraを使い続けられます。Connectionsのカードには同じ問題が**Local runtime unavailable**として表示されます。

**ランタイムのダウンロードでサイズかSHA-256の不一致が報告される。** Marinaraは展開する前にそのダウンロードを破棄しています。まずMarinaraをアップデートし、承認済みのランタイムのマニフェストとダウンロード内容が一致する状態にしてから試し直してください。同じリリースでなお失敗する場合は、アーカイブを手動で展開したり実行したりせず、Runtime Targetとエラー内容をメンテナーに報告してください。

**ロアブックの検索でローカルモデルが有効になっていないと表示される。** Local Modelのカードで**Use for tracker agents (roleplay)**か**Use for game scene analysis**をオンにしてから、ベクトル化をやり直してください。

**Game Modeのバナーに「Local scene helper failed to start.」と表示される。** バナー内の**Open Local AI Model**をクリックすると、再試行、モデルの切り替え、ローカルのシーン解析のオフができます。

さらに詳しい情報は[Marinara Engineのトラブルシューティング](../TROUBLESHOOTING.md)を参照してください。

## 関連ガイド

- [AIプロバイダーへの接続](connecting-to-a-provider.md)
- [Decisionモデル](decision-models.md)
- [ローカルモデルやセルフホストモデルへの接続](local-self-hosted.md)
- [Memory Recallとチャットの要約](../agents/memory.md)
- [Conversationの音声通話とビデオ通話](../conversation/calls.md)
- [Game Mode: はじめに](../game/getting-started.md)
- [ロアブックのセマンティック検索](../lorebooks/semantic-search.md)
