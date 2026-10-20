# メッセージの翻訳

Marinara Engineには、チャットのメッセージを別の言語に翻訳する機能があります。このガイドでは、4つの翻訳プロバイダー、自動翻訳のトグル、メッセージごとの**Translate**(翻訳)ボタン、そして各プロバイダーの制限を説明します。

翻訳の設定はチャットごとです。プロバイダー、言語、キーは、そのチャットだけに保存されます。新しいチャットを同じ設定で始めるには、[新しいチャット用の翻訳のデフォルト](#translator-defaults-for-new-chats)として保存してください。

## 翻訳設定の場所

1. いずれかのモード(Conversation、Roleplay、Game)でチャットを開きます。
2. そのチャットの**Chat Settings**(チャット設定)パネルを開きます。
3. **Translation**(翻訳)セクションを探します。

以下で説明するプロバイダーとトグルの設定は、すべてこの**Translation**セクションにあります。

## プロバイダーの選び方

**Provider**ドロップダウンには4つの選択肢があります。

| プロバイダー | 必要なもの | 備考 |
|---|---|---|
| **Google Translate** | なし | デフォルト。無料で、キーも不要。1回のリクエストにつき5000文字まで。 |
| **DeepL API** | DeepLのAPIキー | 品質が高い。無料キーと有料キーのどちらでも使えます。 |
| **DeepLX (self-hosted)** | DeepLXサーバーのURL | 自分で動かしているDeepLXに接続する場合に使います。 |
| **AI (via connection)** | AIの接続 | 手持ちのAIプロバイダーに翻訳させます。 |

デフォルトでは**Google Translate**が選ばれていて、準備は何も要りません。以下の機能が必要なときだけ、別のプロバイダーに切り替えてください。

### Model LanguageとMy Language

言語は2つの欄で指定します。どちらもデフォルトは`en`(英語)です。

- **Model Language**(モデルの言語): 自分のメッセージは、AIが読む前にこの言語に翻訳されます。**Translate My Messages**と**Translate draft**はこの言語を使います。
- **My Language**(自分の言語): AIの返信はこの言語に翻訳されます。**Auto-Translate Responses**とメッセージごとの**Translate**ボタンはこの言語を使います。

書き方はプロバイダーによって変わります。

- **Google Translate**、**DeepL API**、**DeepLX (self-hosted)**では、短い言語コードを入力します。例: `en`、`ja`、`es`、`de`、`fr`、`zh`、`ko`。
- **AI (via connection)**では、言語名を入力します。例: `English`、`Japanese`、`Spanish`。

### DeepL APIの設定

**DeepL API**を選ぶと、**DeepL API Key**(DeepLのAPIキー)欄が現れます。ここにDeepLアカウントのキーを貼り付けます。DeepLのキーは次のような形です。

```
xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx
```

`:fx`で終わるキーは無料プランのキーで、MarinaraはDeepLの無料サービスに送信します。それ以外のキーは有料キーとして扱います。

### DeepLXの設定

DeepLXは、自分で動かす無料の翻訳サーバーです。**DeepLX (self-hosted)**を選ぶと、**DeepLX URL**(DeepLXのURL)欄が現れます。ここにDeepLXサーバーのアドレスを入力します。例:

```
http://localhost:1188
```

DeepLXサーバーを同じコンピューターやローカルネットワークで動かしている場合、そのアドレスはローカルアドレスです。Marinaraは安全のため、デフォルトではローカルアドレスへのリクエストをブロックします。許可するには、`.env`ファイルに次の行を書いて保存します。

```
DEEPLX_LOCAL_URLS_ENABLED=true
```

`.env`はサーバーの設定ファイルです。置き場所は[サーバー設定リファレンス](../CONFIGURATION.md)で説明しています。サーバーを再起動する必要はありません。数秒以内に変更が反映されます。

インターネット上の公開アドレスにあるDeepLXサーバーなら、この設定は不要です。デフォルトでブロックされるのは、ローカルアドレスとプライベートネットワークのアドレスだけです。

### AI翻訳の設定

**AI (via connection)**を選ぶと、Marinaraは手持ちのAIプロバイダーに翻訳させます。このとき3つの欄が追加されます。

**Connection**(接続)ドロップダウンでは、どのAIの接続に翻訳させるかを選びます。この欄は必須です。未設定のままだと翻訳は失敗し、「Connection ID is required for AI translation」というメッセージが表示されます。接続とは、AIプロバイダーへの接続情報をまとめて保存したものです。作り方は下の接続のガイドを参照してください。

**Outgoing Message Prompt**(送信メッセージのプロンプト)欄と**Incoming Response Prompt**(受信した返信のプロンプト)欄は、自分のメッセージとAIの返信を翻訳するときにAIへ送る指示です。どちらにも組み込みのデフォルトが入っていて、このチャット用にそれぞれ書き換えられます。プロンプト内の`{{targetLanguage}}`は、**Model Language**または**My Language**に置き換わります。プロンプトを書き換えると**Restore**(復元)ボタンが現れ、押すと組み込みのデフォルトに戻ります。デフォルトのプロンプトは次のとおりです。

```
You are a translator. Translate the given text accurately into {{targetLanguage}}, preserving formatting, markdown, and any special characters like *asterisks* for actions. Output ONLY the translated text, nothing else -- no explanations, no extra commentary.
```

## 自動翻訳のトグル

プロバイダーの設定の下には、4つのトグルがあります。4つともデフォルトはオフです。

**Auto-Translate Responses**(AIの返信を自動翻訳)は、AIの返信が生成された直後に、毎回自動で翻訳します。Game Modeでは、地の文からゲームマスター専用のタグを取り除いてから翻訳します。

**Translate My Messages**(自分のメッセージを翻訳)は、自分が書いたメッセージをAIに送信する直前に、**Model Language**で指定した言語へ翻訳します。入力した文章は翻訳文に置き換わります。翻訳に失敗した場合は、Marinaraが元の文章をそのまま送信し、エラーメッセージを表示します。

**Show Draft Translate Button**(下書きの翻訳ボタンを表示)をオンにすると、**Send**ボタンの隣に**Translate draft**ボタンが追加されます。送信する前にメッセージを翻訳して、結果を確かめたり手直ししたりできます。**Translate My Messages**は送信時に翻訳するため内容を確認できませんが、こちらはその手動版です。

**Show Only Translation**(翻訳だけを表示)をオンにすると、翻訳したメッセージは、原文と翻訳を並べる代わりに翻訳だけを表示します。

**Conversation**では、パソコンでもモバイルでも、入力欄のスマイルボタン→**Tools → Translate draft**(ツール → 下書きを翻訳)から未送信の下書きをいつでも翻訳できます。**Show Draft Translate Button**や自動翻訳を有効にする必要はありません。このチャットの入力翻訳設定を使い、確認できるよう下書きを置き換えます。メッセージは送信しません。翻訳に失敗した場合、下書きはそのまま残ります。

<a id="translator-defaults-for-new-chats"></a>

## 新しいチャット用の翻訳のデフォルト

トグルの下にある**Save translator defaults**(翻訳のデフォルト設定を保存)は、このチャットの翻訳設定を、すべてのモードの新しいチャット用に保存します。セットアップウィザードと設定プロファイルの設定が優先されます。既存のチャットは、それぞれの設定を保ちます。**Forget saved defaults**(保存したデフォルトを消去)で消去できます。[Noodle](../noodle/settings.md#translation)も同じデフォルトを使います。

DeepLのAPIキーとDeepLXのURLは、このMarinaraのインストールの中にとどまります。チャットのエクスポート、エクスポートした設定プロファイル、**Export Profile**のファイルにはこれらが含まれず、それらをインポートしても設定されることはありません。チャットを別のインストールに移した後は、もう一度入力してください。

## メッセージごとのTranslateボタン

自分のメッセージもAIのメッセージも、カーソルを重ねると出る操作バーに**Translate**ボタンがあります。ボタンのアイコンは言語のマークです。このボタンは単独で動くので、上のトグルはどれもオンにする必要はありません。

1. メッセージにポインターを重ねて、操作バーを表示します。
2. **Translate**ボタンをクリックします。
3. メッセージの下に翻訳が表示されます。**Show Only Translation**がオンの場合は、メッセージの代わりに表示されます。
4. もう一度同じボタンをクリックすると翻訳が隠れます。このときボタンのヒントは**Hide translation**に変わります。

こうして作った翻訳はメッセージと一緒に保存されます。ページを再読み込みしても消えず、別のチャットに移って戻ってきても残っています。

メッセージごとのボタンは、**Translation**セクションで設定したプロバイダーと**My Language**をそのまま使います。

## プロバイダーの制限

プロバイダーを選ぶときは、次の制限を頭に入れておいてください。

- **Google Translate**は5000文字を超えるテキストを受け付けません。「Text too long for Google Translate (max 5000 characters). Use DeepL or AI provider for longer texts.」というエラーが表示されます。長い文章はDeepLかAIに切り替えてください。
- **DeepL API**、**DeepLX (self-hosted)**、**AI (via connection)**はもっと長いテキストを扱えます。上限はサーバー側の制限で、1回のリクエストにつき50000文字です。
- **Google Translate**、**DeepL API**、**DeepLX (self-hosted)**は、15秒を超えると処理を打ち切ってエラーを表示します。
- **AI (via connection)**はこの15秒の制限ではなく、その接続のモデルとタイムアウトの挙動に従います。
- ローカルアドレスへの**DeepLX (self-hosted)**は、上で説明した`DEEPLX_LOCAL_URLS_ENABLED=true`を設定しないかぎりブロックされます。

## 関連ガイド

- [メッセージの操作: 編集、削除、スワイプ、再生成](../chats/messages.md)
- [Chat Settingsの概要](../chats/chat-settings.md)
- [AIプロバイダーへの接続](../connections/connecting-to-a-provider.md)
- [サーバー設定リファレンス](../CONFIGURATION.md)
