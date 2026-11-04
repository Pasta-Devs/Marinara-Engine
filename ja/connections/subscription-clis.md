# Claude、ChatGPT、Grokのサブスクリプション接続

**Claude (Subscription)**、**OpenAI (ChatGPT)**、**Grok CLI (Subscription)**の3つのサービスでは、APIキーの代わりに、すでに料金を払っているプランを使ってチャットできます。小さなコマンドラインツール(CLI)をインストールし、一度サインインします。あとはMarinara Engineがそのサインインを再利用します。Marinaraには何も貼り付けません。

必要なプランは次のとおりです。

- **Claude (Subscription)**: AnthropicのProまたはMax、あるいはClaude Codeが受け付けるほかのプラン。
- **OpenAI (ChatGPT)**: ChatGPTのアカウント。利用量の上限はプランによって異なります。
- **Grok CLI (Subscription)**: SuperGrokまたはX Premium+。

## サブスクリプションのアカウントを追加する

始める前に、CLIはMarinaraのサーバーが動いているコンピューターにインストールし、そこでサインインしておく必要があることを押さえておいてください。Marinaraの画面を表示しているスマートフォンやブラウザーではありません。Marinaraが別のコンピューターやDockerで動いている場合は、手順1と2をそちらで行います。`npm`コマンドにはNode.jsが必要です。Marinaraをソースからインストールしていれば、すでに入っています。[インストール](../INSTALLATION.md)を参照してください。

1. Marinaraが動いているコンピューターでターミナルを開きます。ターミナルとは、コマンドを入力するウィンドウです。WindowsではPowerShellを、macOSではTerminalを開きます。
2. 使うサービスのインストールコマンドを実行してから、サインインのコマンドを実行します。ツールが独自のサインイン手順を表示します。たいていは、サインインするためのWebページが開きます。

| サービス | インストール | サインイン |
| --- | --- | --- |
| Claude | `npm i -g @anthropic-ai/claude-code` | `claude login` |
| ChatGPT | `npm i -g @openai/codex` | `codex login` |
| Grok | 下記を参照 | `grok login` |

Grokについては、アプリに次のインストールコマンドが表示されます。自分のシステムで動かない場合は、x.ai自身のGrok CLIの手順に従ってください。

```bash
curl -fsSL https://x.ai/cli/install.sh | bash
```

3. Marinaraで、上部バーの**Connections**(接続)をクリックし、**Add**(追加)をクリックします。
4. **Chat**(チャット)の下で、使うサービスをクリックします。これらのサービスには**Sign in**(サインイン)のタグが付いています。
5. ウィンドウに**Sign in first**と表示され、実行するコマンドが示されます。キーの欄はありません。**Connect**(接続)をクリックします。Marinaraがログインをテストします。**Connected**と表示されれば、正しく機能しています。
6. 一覧からモデルを選び、**Done**(完了)をクリックします。Grok CLIでは、モデルを空のままにすることもできます。その場合はCLI自身のデフォルトが使われます([Grok CLI (Subscription)](#grok-cli-subscription)を参照)。

チャットでメッセージを送って確認してください。返信が来れば、正しく動いています。

うまくいかなかった場合:

- **Marinara could not use the login on this computer.**と表示された場合は、Marinaraのコンピューターで、CLIがインストールされていないか、サインインしていない状態です。そのコンピューターでサインインのコマンドを実行してから、**Try again**(もう一度試す)をクリックします。

## Claude (Subscription)

ここから先のセクションは任意の設定です。チャットするだけなら必要ありません。

このサービスは、Claude Codeを通じてClaudeのプランを使います。モデルエディターである**Edit model**(モデルの編集)には、プロンプトキャッシュ、**Fast mode**、**Diagnose model routing**(モデルのルーティングを診断)の3つの追加の操作があります。

### Extended token caching

プロンプトキャッシュを使うと、Claudeはプロンプトの冒頭を再利用できるため、繰り返しのリクエストで消費する上限が少なくなります。**Prompt caching → Extended token caching (1 hour)**(プロンプトキャッシュ → 1時間の拡張トークンキャッシュ)は、1時間のキャッシュを要求します。メッセージの合間に時間が空くときに役立ちます。Claude Code 2.1.242以降が必要です。Marinaraはこの設定をリクエストと一緒に送り、保存済みのClaudeの設定は変更しません。

オフのときは、Claudeがアカウントに応じた独自のデフォルトを使います。[Claude Codeのプロンプトキャッシュ](https://code.claude.com/docs/en/prompt-caching)を参照してください。

### Fast mode

**Fast mode → Use Claude Code fast-mode routing**(Fast mode → Claude Codeの高速モードのルーティングを使う)は、デフォルトでオフです。オフのままにしてください。Claude Codeに高速なモデルの階層を要求する設定ですが、アプリの説明によると、現在のモデルにはその階層がもうありません。そのため、オンにしても役に立たず、余計な負荷が増えることがあります。オンにしようとすると、**Turn on fast mode?**(高速モードをオンにしますか?)というタイトルのダイアログが表示されます。**Keep it off**(オフのままにする)をクリックしてください。

### Diagnose model routing

Opusのような大きなモデルを指定したのに、小さいモデルが使われているのではないかと思うときは、**Diagnose model routing**(モデルのルーティングを診断)を使います。

1. モデルを選びます。モデルが設定されるまで、ボタンは押せません。
2. **Diagnose model routing**をクリックします。Marinaraは、保存していない変更を先に保存します。
3. 結果を確認します。MarinaraはClaude Codeのサインインを通じて実際のプロンプトを送信し、アカウントに課金されたモデルがどれだったかを表示します。

## OpenAI (ChatGPT)

このサービスは、Codex CLIを通じてChatGPTのアカウントを使います。Marinaraはローカルに保存されたCodexのログインファイルを読み取り、可能なときはセッションを更新します。

Codexが答える前にどれだけ考えるかを設定するには、**Edit model**(モデルの編集)を開き、**Use custom defaults for this model**(このモデルで独自のデフォルトを使う)をオンにして、**Reasoning Effort**(推論の度合い)を選びます。最初は**Default**(デフォルト)になっており、Codexがそのモデルに使うレベルがそのまま使われます。チャットごとのレベルは**Advanced Parameters**(詳細パラメーター)で選べます。プリセットで設定したレベルでは、これは変わりません。フォールバックとして使われるCodexのモデルは、そのモデル自身のレベルにだけ従います。そのモデルを使うエージェントは、モデルのレベルを使います。表示されるレベルは、選んだモデルで使えるレベルと同じです。

## Grok CLI (Subscription)

このサービスは、MarinaraのコンピューターでGrok CLIを実行します。ほかのサービスとは2つの点が異なります。

- ストリーミングしません。返信は1語ずつではなく、一度にまとめて表示されます。
- コンテキストウィンドウのデフォルトは32,000トークンです。トークンとは、モデルが数える小さなテキストの単位です。プロンプトが大きいとCLI自身のターン上限に達することがあるため、デフォルトは低めになっています。モデルで、より大きな**Max Context Window**(最大コンテキストウィンドウ)を設定できます。

モデルエディターで**Use the Grok CLI default**(Grok CLIのデフォルトを使う)を選ぶと、モデルが空のままになり、CLIが自分でモデルを選びます。エディターでは、ロールプレイにはたいてい`grok-composer-2.5-fast`がいちばん無難なモデルだと案内しています。MarinaraはCLIをヘッドレスで実行し、Grok自身のツール、記憶、Web検索、プラン、サブエージェントをオフにしているためです。

## プランの使用量

Claude (Subscription)とOpenAI (ChatGPT)のアカウントでは、プランの上限をどれだけ使ったかを表示できます。

1. アカウントの行にある**⋯**をクリックし、**Edit account**(アカウントの編集)を選んで、**Usage and balance**(使用量と残高)を開きます。
2. 外部の情報の読み取りがオフになっている場合は、**Turn on**(オンにする)をクリックします。
3. **Show the usage meter on the card**(カードに使用量メーターを表示)をオンにして、保存します。

上限の期間ごとに、使用率とリセットまでの時間を示すバーが表示されます。たとえば`58% · resets in 2h`です。このアカウントが有効な間は、同じバーがチャットの接続ピッカーと、チャットの**Connection**(接続)設定にも表示されます。**Shuffle**のときは表示されません。

- バーは、Marinaraだけでなく、プランでのすべての利用を数えます。Claudeの場合は、Claude Codeとclaude.aiも含まれます。ChatGPTの場合は、Codex CLIなど、Codexのすべての利用が含まれます。chatgpt.comでのチャットには別の上限があり、含まれません。
- サービスが報告するのは期間ごとの割合だけで、トークン数は報告されません。
- 読み取りでは、Marinaraのコンピューター上のCLIに、CLI自身の使用量コマンドが表示するのと同じデータを問い合わせます。モデルにメッセージは送らず、プランも消費しません。更新ボタンを押すと、もう一度読み取ります。
- 期間が1つしかないプランでは、バーも1本だけです。
- Claude Codeは、使用量のデータを実験的なものとしています。新しいバージョンでこれが変わった場合、バーには誤った数値の代わりに、エラーと再試行ボタンが表示されます。

## これらのサービスの制限

- 有料のプラン(または対象となるChatGPTのプラン)と、Marinaraのコンピューターでサインイン済みのCLIが必要です。
- どのサービスも埋め込みに対応していません。ロアブックのセマンティック検索と記憶の呼び出しには、埋め込み用の別のアカウントが必要です。
- **Send test message**(テストメッセージを送信)を使うには、先にモデルを選ぶ必要があります。ただしGrok CLIは例外です。

## 関連ガイド

- [AIプロバイダーへの接続](connecting-to-a-provider.md)
- [対応しているAIプロバイダー](providers-reference.md)
