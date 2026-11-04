# メッセージの翻訳

Marinara Engineには、チャットのメッセージを別の言語に翻訳する機能があります。このガイドでは、翻訳サービスの選び方、言語の設定、自動翻訳をオンにする方法、1つのメッセージを翻訳する方法を説明します。

翻訳の設定はチャットごとです。サービス、言語、キーは、チャットごとに保存されます。新しいチャットを同じ設定で始めるには、[新しいチャット用の翻訳のデフォルト](#translator-defaults-for-new-chats)として保存してください。

## 翻訳設定の場所

1. いずれかのモード(Conversation、Roleplay、Game)でチャットを開きます。
2. **Chat Settings**(チャット設定)を開きます。
3. **Translation**(翻訳)セクションを探します。

以下の設定は、すべてこのセクションにあります。

## プロバイダーを選ぶ

**Provider**の一覧には4つの選択肢があります。

| プロバイダー | 必要なもの | 備考 |
| --- | --- | --- |
| **Google Translate** | なし | デフォルト。無料で、キーも不要。1回のリクエストにつき5000文字まで。 |
| **DeepL API** | DeepLのAPIキー | 品質が高い。無料キーと有料キーのどちらでも使えます。 |
| **DeepLX (self-hosted)** | DeepLXサーバーのURL | 自分で動かしているDeepLXサーバー向け。 |
| **AI (via connection)** | AIのアカウント | 手持ちのAIモデルの1つに翻訳させます。 |

Google Translateは、準備なしで使えます。ほかのプロバイダーは、それが提供するものが必要な場合にだけ選んでください。

### 言語を設定する

言語は2つの欄で指定します。どちらもデフォルトは`en`(英語)です。

- **Model Language**(モデルの言語)は、AIモデルが理解し、返信に使う言語です。自分の言語で入力すると、AIが読む前にメッセージがこの言語に翻訳されます。**Translate My Messages**と**Translate draft**はこの言語を使います。
- **My Language**(自分の言語)は、自分が読む言語です。AIの返信はこの言語に翻訳されます。**Auto-Translate Responses**とメッセージごとの**Translate**(翻訳)ボタンはこの言語を使います。

たとえば、スペイン語で書き、AIは英語のほうがうまく動く場合は、**Model Language**を`en`に、**My Language**を`es`にします。

Google Translate、DeepL API、DeepLXでは、`en`、`ja`、`es`、`de`、`fr`、`zh`、`ko`のような短いコードを入力します。AI (via connection)では、`English`、`Japanese`、`Spanish`のような言語名を入力します。

うまくいかなかった場合: コードや名前が間違っていると、エラーになるか、テキストが変わらないままになります。使っているプロバイダーの形式を確認してください。

### DeepL API

**DeepL API**を選び、DeepLアカウントのキーを**DeepL API Key**(DeepLのAPIキー)に貼り付けます。`:fx`で終わるキーは無料プランのキーで、MarinaraはDeepLの無料サービスに送信します。それ以外のキーは有料として扱います。

```text
xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx
```

### DeepLX

DeepLXは、自分で動かす無料の翻訳サーバーです。**DeepLX (self-hosted)**を選び、**DeepLX URL**(DeepLXのURL)にサーバーのアドレスを入力します。たとえば`http://localhost:1188`です。

自分のコンピューターやローカルネットワークにあるDeepLXサーバーのアドレスは、ローカルアドレスです。Marinaraは安全のため、デフォルトでローカルアドレスをブロックします。許可するには、`.env`ファイルに次の行を追加して保存します。再起動は不要です。ふつうは数秒以内、長くても約30秒で反映されます。ファイルの場所は[サーバー設定リファレンス](../CONFIGURATION.md)で説明しています。

```text
DEEPLX_LOCAL_URLS_ENABLED=true
```

インターネット上の公開アドレスにあるDeepLXサーバーなら、この設定は不要です。

### AI (via connection)

**AI (via connection)**を選ぶと、手持ちのAIモデルの1つに翻訳させます。3つの欄が表示されます。

- **Connection**(接続): どのAIアカウントに翻訳させるかを選びます。必須です。未設定のままだと、翻訳は「Connection ID is required for AI translation」というメッセージで失敗します。[AIプロバイダーへの接続](../connections/connecting-to-a-provider.md)を参照してください。
- **Outgoing Message Prompt**(送信メッセージのプロンプト)と**Incoming Response Prompt**(受信した返信のプロンプト): 自分のメッセージとAI自身の返信を翻訳するときに、AIが受け取る指示です。どちらにも組み込みのデフォルトが入っていて、このチャット用に書き換えられます。`{{targetLanguage}}`は、**Model Language**または**My Language**に置き換わります。プロンプトを変更したあとは、**Restore**(復元)で元に戻せます。デフォルトのプロンプトは次のとおりです。

```text
You are a translator. Translate the given text accurately into {{targetLanguage}},
preserving formatting, markdown, and any special characters like *asterisks* for actions.
Output ONLY the translated text, nothing else -- no explanations, no extra commentary.
```

## 自動翻訳をオンにする

プロバイダーの設定の下に、4つのトグルがあります。どれも最初はオフです。

- **Auto-Translate Responses**(AIの返信を自動翻訳): AIの返信が生成された直後に、毎回翻訳します。Game Modeでは、先に地の文からゲームマスター専用のタグを取り除きます。
- **Translate My Messages**(自分のメッセージを翻訳): 自分のメッセージをAIに送る直前に**Model Language**へ翻訳し、入力した文章を置き換えます。翻訳に失敗した場合は、Marinaraが元の文章を送信し、エラーを表示します。
- **Show Draft Translate Button**(下書きの翻訳ボタンを表示): **Send**の隣に**Translate draft**ボタンを追加します。送信する前に翻訳を確かめ、手直しできます。**Translate My Messages**の手動版です。
- **Show Only Translation**(翻訳だけを表示): 翻訳したメッセージで、原文と翻訳を並べる代わりに、原文の位置に翻訳を表示します。

Conversationでは、パソコンでもモバイルでも、入力欄のスマイルボタンから**Tools → Translate draft**(ツール → 下書きを翻訳)を選んで、未送信の下書きをいつでも翻訳できます。どちらのトグルもオンにする必要はありません。このチャットの入力翻訳の設定を使い、確認できるよう下書きを置き換えます。何も送信しません。翻訳に失敗した場合、下書きは元のまま残ります。

<a id="translator-defaults-for-new-chats"></a>

## 新しいチャット用の翻訳のデフォルト

トグルの下にある**Save translator defaults**(翻訳のデフォルト設定を保存)は、このチャットの翻訳設定を、すべてのモードの新しいチャット用に保存します。セットアップウィザードと設定プロファイルの設定が優先されます。既存のチャットは、それぞれの設定を保ちます。**Forget saved defaults**(保存したデフォルトを消去)で消去できます。[Noodle](../agents/noodle-settings.md#translation)も同じデフォルトを使います。

DeepLのAPIキーとDeepLXのURLは、このMarinaraのインストールの中にとどまります。チャットのエクスポート、エクスポートした設定プロファイル、**Export Profile**のファイルにはこれらが含まれず、それらをインポートしても設定されることはありません。チャットを別のインストールに移した後は、もう一度入力してください。

## 1つのメッセージを翻訳する

自分のメッセージにもAIのメッセージにも、操作バーに**Translate**(翻訳)ボタン(言語のアイコン)があります。上のトグルはどれもオンにしなくても使えます。

1. メッセージにポインターを重ねる、またはスマートフォンではタップして、操作バーを表示します。
2. **Translate**をクリックします。
3. メッセージの下に翻訳が表示されます。**Show Only Translation**がオンの場合は、メッセージの代わりに表示されます。
4. もう一度ボタンをクリックすると翻訳が隠れます。このときボタンの表示は**Hide translation**に変わります。

翻訳はメッセージと一緒に保存され、ページを再読み込みしても、チャットを切り替えても残ります。上のセクションで設定したのと同じプロバイダーと**My Language**を使います。

## プロバイダーの制限

- **Google Translate**は5000文字を超えるテキストを受け付けず、「Text too long for Google Translate (max 5000 characters). Use DeepL or AI provider for longer texts.」というエラーを表示します。
- **DeepL API**、**DeepLX (self-hosted)**、**AI (via connection)**はもっと長いテキストを扱えます。上限はサーバー側の制限で、1回のリクエストにつき50000文字です。
- **Google Translate**、**DeepL API**、**DeepLX (self-hosted)**は、15秒で処理を打ち切ってエラーを表示します。
- **AI (via connection)**は、15秒の制限ではなく、AIモデル自体のタイムアウトに従います。
- ローカルアドレスにある**DeepLX (self-hosted)**は、`DEEPLX_LOCAL_URLS_ENABLED=true`を設定しないかぎりブロックされます。

## 関連ガイド

- [メッセージの操作: 編集、削除、スワイプ、再生成](../chats/messages.md)
- [Chat Settingsの概要](../chats/chat-settings.md)
- [AIプロバイダーへの接続](../connections/connecting-to-a-provider.md)
- [サーバー設定リファレンス](../CONFIGURATION.md)
