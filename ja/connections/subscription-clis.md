# Claude、ChatGPT、Grokのサブスクリプション接続

このガイドでは、APIキーではなくアカウントでログインして使う3つの接続、**Claude (Subscription)**、**OpenAI (ChatGPT)**、**Grok CLI (Subscription)**を説明します。小さなコマンドラインツールをインストールして一度ログインしておくと、Marinara Engineはそのアカウントを使ってチャットします。コマンドラインツール(CLI)とは、ターミナルのウィンドウにコマンドを打ち込んで動かすプログラムのことです。

## サブスクリプション接続とは

Marinara Engineのほとんどの接続はAPIキーを使います。APIキーとはパスワードのような秘密の文字列で、これを接続に貼り付けると、AIサービスがアカウントに料金を請求できるようになります。

この3つの接続は仕組みが違います。APIキーの代わりに、手元のログイン情報を使います。自分のコンピューターでCLIにログインしておけば、Marinaraがそのログインをそのまま利用します。Marinaraには何も貼り付けません。

アカウントに次のCLI経由の利用が含まれている場合は、サブスクリプション接続を使ってください。

- **Claude (Subscription)**はAnthropicの**Pro**または**Max**のサブスクリプションを使います。
- **OpenAI (ChatGPT)**はChatGPTのアカウントを使います。
- **Grok CLI (Subscription)**は**SuperGrok**または**X Premium+**のアカウントを使います。

## 事前に必要なもの

必要なアカウントはプロバイダーによって異なります。

- **Claude (Subscription)**には、Claude Codeのサブスクリプションログインに対応したClaudeのプランが必要です。
- **OpenAI (ChatGPT)**は、対象となる無料プランと有料プランのChatGPTに対応しています。利用量の上限はプランごとに異なります。
- **Grok CLI (Subscription)**にはSuperGrokまたはX Premium+が必要です。

3つのプロバイダーに共通して、CLIはMarinaraのサーバーが動いているコンピューターにインストールし、そこでログインしておく必要があります。Marinaraの画面を表示しているブラウザーやスマートフォンではありません。MarinaraはCLIをローカルで実行するため、ログイン情報はサーバーと同じ場所になければなりません。

自分のコンピューターでMarinaraを動かしているなら、そのコンピューターがサーバーです。別のコンピューターやDockerで動かしている場合は、そちらにCLIをインストールしてログインします。

## Claude (Subscription)

AnthropicのProまたはMaxのサブスクリプションが必要です。Visual Studio Codeなど、ほかのAnthropicのツールで使うログインと同じものです。

1. Marinaraを動かしているコンピューターで、Claude Code CLIをインストールします。

```
npm i -g @anthropic-ai/claude-code
```

2. 一度だけログインします。

```
claude auth login
```

3. Marinaraで**Connections**(接続)パネルを開き、**New**(新規)をクリックします。
4. **Create Connection**(接続の作成)ウィンドウで名前を入力し、プロバイダーとして**Claude (Subscription)**を選んでから、**Create**(作成)をクリックします。
5. エディターには**API Key**欄も**Base URL**欄もありません。不要であることが情報パネルに表示されます。
6. **Model**ドロップダウンから、OpusやSonnetなどのClaudeのモデルを選びます。
7. **Save**(保存)をクリックし、続けて**Send Test Message**(テストメッセージの送信)をクリックします。短い返信が返ってくれば、ログインは正しく機能しています。

Claudeのサブスクリプション接続はテキストのチャットにのみ対応します。この接続には**Fast Mode**と**Diagnose Model Routing**という2つの追加設定があり、後ほど説明します。

## OpenAI (ChatGPT)

ChatGPTのアカウントが必要です。MarinaraはCodex CLIのログイン経由でチャットをやり取りします。

1. Marinaraを動かしているコンピューターで、Codex CLIをインストールします。

```
npm i -g @openai/codex
```

2. 一度だけログインします。

```
codex login
```

3. Marinaraで**Connections**パネルを開き、**New**をクリックします。
4. **Create Connection**ウィンドウで名前を入力し、プロバイダーとして**OpenAI (ChatGPT)**を選んでから、**Create**をクリックします。
5. **Model**ドロップダウンからモデルを選びます。一覧は可能な場合はChatGPTのセッションから取得し、それ以外のときは内蔵の一覧を使います。
6. **Save**をクリックし、続けて**Send Test Message**をクリックして返信を確認します。

Marinaraはローカルに保存されたCodexのログインファイルを読み取り、可能なときはセッションを更新します。

## Grok CLI (Subscription)

SuperGrokまたはX Premium+のアカウントが必要です。

1. Marinaraを動かしているコンピューターで、Grok CLIをインストールします。

```
curl -fsSL https://x.ai/cli/install.sh | bash
```

2. 一度だけログインします。

```
grok login
```

3. Marinaraで**Connections**パネルを開き、**New**をクリックします。
4. **Create Connection**ウィンドウで名前を入力し、プロバイダーとして**Grok CLI (Subscription)**を選んでから、**Create**をクリックします。
5. モデルを選ぶか、**Model**欄を空のままにしてCLIのデフォルトを使います。ロールプレイでいちばん無難なモデルは、たいてい`grok-composer-2.5-fast`です。
6. **Save**をクリックし、続けて**Send Test Message**をクリックします。この接続はモデルを設定していなくてもテストできます。

Grok CLIには特徴が2つあります。1つはストリーミングに対応しないことで、返信は1語ずつではなく一度にまとめて表示します。もう1つはコンテキストウィンドウのデフォルトが32000トークンと、ほかのプロバイダーより小さいことです。プロンプトが大きすぎると、CLI側のターン上限に引っかかるためです。

Grokのモデルを読み込むには、**Model**セクションの**Fetch Models from Grok CLI**ボタンを使います。

## Claudeのプロンプトキャッシュの保持時間

Claude接続エディターの **Prompt Caching → Extended token caching (1 hour)** は、メッセージ間の長い休止に対応するため、1時間のキャッシュをリクエストします。Claude Code **2.1.242以降**が必要です。Marinaraは保存済みのClaude設定を変更せず、そのリクエストに設定を渡します。

オフの場合、メインの会話とAgent SDKのリクエストにはClaudeのデフォルトが使われます。現在は、プランの上限内でのサブスクリプション利用では1時間、追加利用、クレジット、API課金では5分です。Claude Code自体のサブエージェントは別途設定しない限り5分ですが、サーバー側で制御される一部の補助リクエストでは1時間になることがあります。この値を上書きするCLIの環境変数は引き続き優先されます。[Claude Codeのプロンプトキャッシュ](https://code.claude.com/docs/en/prompt-caching)を参照してください。

デバッグログでは、SDKが報告する使用量をもとに、5分と1時間のキャッシュ書き込みを区別します。コスト換算には通常のAPIトークン料金の倍率を使い、サブスクリプションの請求額を示すものではありません。SDKが保持時間別の書き込み内訳を返さない場合、推定額は不明のままになります。

## APIキーの欄がない理由

3つのサブスクリプションプロバイダーでは、**API Key**欄と**Base URL**欄を非表示にしています。これは意図的な動作です。ログイン情報はサーバー側のコンピューターにあるCLIの中にあるので、Marinaraに入力するものは何もありません。

うっかり別のプロバイダーを選んでしまい、キーの欄が見当たらないときは、プロバイダーの一覧から本来選ぶはずだったものに戻してください。APIキーを使うプロバイダーなら、キーの欄が再び表示されます。

## Fast Mode(Claudeのみ)

**Claude (Subscription)**のエディターには**Fast Mode**セクションがあり、**Use Claude Code fast-mode routing**というトグルが1つあります。デフォルトはオフです。

オフのままにしてください。アプリ自身の説明にもあるとおり、この機能は現在何もしません。Claude Codeに対してより高速なモデルの階層を要求する機能ですが、今のClaudeのモデルにはその階層がありません。オンにしても効果はなく、かえって余計な処理が増えるおそれがあります。このトグルは、Anthropicが機能を復活させた場合に備えて画面に残してあるだけです。

オンにしようとすると、**YOU DON'T WANT THIS SETTING ON!**というタイトルの確認ウィンドウが表示されます。**Keep it off**を選んでください。

## Diagnose Model Routing(Claudeのみ)

**Claude (Subscription)**のエディターには、テスト用の領域に**Diagnose Model Routing**(モデルのルーティング診断)ボタンがあります。あるClaudeのモデルを指定したのに、実際にはもっと小さいモデルが使われている気がするときに使います。

1. モデルを選んで**Save**をクリックします。モデルを選ぶまでボタンは押せません。
2. **Diagnose Model Routing**をクリックします。
3. 結果を確認します。MarinaraはClaude Codeのログインを通じて実際のプロンプトを送信し、アカウントに課金されたモデルがどれだったかを表示します。

これで、Opusのような大きいモデルを指定したのに、気づかないうちにSonnetやHaikuが返ってくる、といった無言の格下げを見つけられます。

## 知っておきたい制限

- これらの接続には、有料のサブスクリプションと、サーバー側のコンピューターでログイン済みのCLIが必要です。
- 3つとも埋め込み(embeddings)には対応していません。ロアブックの意味検索と記憶機能の呼び出しには、埋め込み用の別の接続が必要です。
- **Claude (Subscription)**はテキストのチャットにのみ対応します。
- **Grok CLI (Subscription)**はストリーミングに対応せず、コンテキストウィンドウも小さめの値から始まります。
- **Send Test Message**は先にモデルを選んでおく必要があります。ただしGrok CLIだけは、モデルなしでもテストできます。

## 関連ガイド

- [AIプロバイダーへの接続](connecting-to-a-provider.md)
- [対応しているAIプロバイダー](providers-reference.md)
