# Music DJ: Spotify、YouTube、ローカルの音楽

**Music DJ**は、シーンに合った背景音楽を流します。このガイドでは、Spotify、YouTube、手元の音声ファイルをつなぐ方法、音楽プレイヤーの使い方、Game ModeとConversationで音楽を使う方法を説明します。

## Music DJとは

**Music DJ**は、任意でダウンロードするエージェントです。エージェントとは、チャットの裏側で動くヘルパーです。Music DJは返信のたびにシーンの雰囲気を読み取り、それに合った音楽を流せます。

始める前に: **Agents**(エージェント)を開き、**Agent Organizer**を選んで**Music DJ**をインストールしてください。インストール直後はオフです。ほかのエージェントと同じように、チャットごとにオンにします。Roleplayのチャットで使えるほか、Game Modeでは専用のトグルで([Game ModeでのMusic DJ](#music-dj-in-game-mode))、Conversationでは**Music**コマンドで([ConversationのMusicコマンド](#the-conversation-music-command))使えます。

再生するソースは3つあります。

| ソース | 必要なアカウント | 費用 | 向いている用途 |
| --- | --- | --- | --- |
| **Spotify** | 自分のSpotifyアカウントと、再生用のSpotify Premium | 設定は無料、再生にはPremiumが必要 | 自分のデバイスで、実在の曲を曲名どおりに流す |
| **YouTube** | 無料のGoogle APIキー | 無料 | ログインもPremiumも不要で再生する |
| **Custom** | 不要 | 無料 | 自分の音声ファイルを流す |

有効なソースは、上部バーに固定される小さな**Music Player**(音楽プレイヤー)として表示されます。スマートフォンや幅の狭いウィンドウでは、ドラッグして動かせる小さな丸いウィジェットになります。

Music DJの設定は、共通の1か所で行います。右側の**Agents**パネルを開き、**Music DJ**を開きます。ミニプレイヤーの歯車アイコン(ツールチップは**Music DJ setup**)をクリックしても開けます。

### 音楽ソースの選択

**Music DJ**の編集画面では、**Music Player**欄に**Spotify**、**YouTube**、**Custom**の3つのボタンがあります。その下の行に、現在動いているものが表示されます。たとえば「Visible player: Spotify. Saved provider: Spotify.」のように表示されます。この選択はアプリ全体で共有され、チャットごとには保存されません。**Custom**で再生するフォルダーは、チャットやキャラクターごとに変えられます。[チャットやキャラクターごとに別のフォルダーを使う](#use-a-different-folder-for-a-chat-or-character)を参照してください。

## Spotifyの設定

Spotifyでは、自分で作る無料のSpotifyデベロッパーアプリを使います。貼り付けるのは**Spotify Client ID**だけです。クライアントシークレットはありません。

1. **Music DJ**の編集画面で、**Spotify Connection**を探します。
2. アプリに表示されるリンクから**Spotify Developer Dashboard**を開きます。
3. 新しいアプリを作成し、「Web API」を選びます。
4. そのアプリのRedirect URIsに、アプリ内の設定ボックスの手順3でMarinaraが表示するリダイレクトアドレスを、そのまま追加します。リダイレクトアドレスとは、ログイン後にSpotifyが戻る先のアドレスです。
5. **Client ID**をコピーし、**Spotify Client ID**に貼り付けます。
6. エージェントを保存し、**Connect Spotify Account**(Spotifyアカウントの接続)をクリックします。

Spotifyのログインと許可のウィンドウが開きます。許可すると、短い成功ページが表示されて閉じます。Marinaraには、緑色の**Connected to Spotify**のバッジが表示されます。**Disconnect**(接続を解除)を押すと、保存した接続が削除されます。

> **Note:** 再生、一時停止、スキップ、音量の操作には、Spotify Premium(有料プラン)が必要です。無料のアカウントでも接続はできます。トークンは自動的に更新されます。

うまくいかなかった場合: 別のコンピューターでは、ログインウィンドウが失敗することがあります(下記を参照)。それ以外の場合は、リダイレクトアドレスが完全に一致しているかを確認してください。

### Spotifyのデバイス

Spotifyは、スマートフォン、デスクトップのSpotifyアプリ、アプリ内プレイヤーなどのデバイスを通じて再生します。

- デスクトップでは、ミニプレイヤーのノート型コンピューターのアイコン(**Enable Marinara player**または**Use Marinara player**)をクリックすると、ブラウザーのタブが「Marinara Engine」という名前のSpotifyデバイスになります。タブでのストリーミングにはPremiumが必要です。
- モバイルでは、プレイヤーはスマートフォン自身のSpotifyデバイスを優先するため、再生はバックグラウンドのタブではなくスマートフォンで行われます。
- デバイスが遠隔からの音量操作に対応していない場合、スライダーの代わりに**Use device volume**が表示されます。デバイス本体の音量ボタンを使ってください。

### 別のコンピューターで動かしているSpotify

Spotifyが受け付けるリダイレクトアドレスは、安全な`https://`か、ループバックアドレスの`http://127.0.0.1`(同じコンピューター)だけです。Marinaraを別のコンピューターで、暗号化なしの`http`で動かしている場合、ログインウィンドウが失敗することがあります。対処法は2つあります。

- 接続の途中で、**Connect Spotify Account**の下にある「Browser couldn't reach the callback?」を開きます。失敗したウィンドウのアドレスをすべてコピーしてボックスに貼り付け、**Complete connection**をクリックします。
- または、リダイレクトアドレスを環境変数(起動時に読み込まれるサーバーの設定)で固定します。

```text
SPOTIFY_REDIRECT_URI=https://your-address/api/spotify/callback
```

[サーバー設定リファレンス](../CONFIGURATION.md)を参照してください。

### Spotifyが曲を選ぶ範囲を決める(Roleplay)

Music DJがRoleplayのチャットで動いているとき、そのカードには**Spotify source**(Spotifyのソース)の一覧があります。

- **Liked Songs**: 保存済みの曲から優先的に選びます。
- **Playlist**: 1つのプレイリストの中だけから選びます。プレイリストは**Playlist**の一覧で選びます。
- **Artist**: 1人のアーティストの周辺を探します。アーティストは**Artist**欄に入力します。
- **Any Spotify**: 場面に合うときは、DJにSpotify検索を使わせます。

## YouTubeの設定

YouTubeモードには、無料のYouTube Data APIキーが必要です。APIキーとは、Marinaraが代わりにサービスを使えるようにする秘密の文字列です。YouTubeへのログインもPremiumも必要ありません。

1. **Music DJ**の編集画面で、**YouTube Connection**を探します。
2. アプリのリンクから**Google Cloud Console**を開き、プロジェクトを作成するか、既存のものを選びます。
3. **YouTube Data API v3**を有効にします。
4. Credentials、Create credentials、API keyの順に進みます。
5. キーを**YouTube Data API Key**に貼り付けます。
6. **Save Key**(キーの保存)をクリックします。ボタンの表示が**Update Key**に変わり、緑色の「API key configured」のバッジが表示されます。**Remove**を押すと、キーが削除されます。

キーには制限をかけないままにするか、APIによる制限だけをかけてYouTube Data API v3に限定してください。HTTPリファラーによる制限はかけないでください。検索はサーバー側で実行されるため、リファラー制限をかけると検索が通らなくなります。アプリの説明によると、無料のクォータ(1日に約100回の検索)は個人のDJには十分です。この数値はアプリの表示によるもので、変わる可能性があります。キーはサーバーに暗号化して保管されます。

## 自分の音楽ファイルを使う

Customモードでは、Marinaraを動かしているコンピューターの音声ファイルを再生します。対応する形式は`.mp3`、`.ogg`、`.wav`、`.flac`、`.m4a`、`.aac`、`.webm`です。

**Music DJ**の編集画面で、**Custom Music Library**を探します。ここには**Use Game Assets music folder**というスイッチが1つあります。

- **On**(オン): CustomモードはGame Assetsにアップロードした音声を読み込みます。Game Assetsは、Game Mode用のMarinaraの素材ライブラリーです。**Game Assets music folder**でフォルダーを指定します。ライブラリー全体なら`music`、サブフォルダーなら`music/combat`のように入力します。**Open Folder**を押すと、サーバーのコンピューター上でそのフォルダーが開きます。
- **Off**(オフ): Customモードはサーバーのデバイス上のフォルダーを読み込みます。**Select Folder**を押すと、サーバーのコンピューターでフォルダー選択画面が開きます。**Default music folder on this device**にパスを貼り付けてもかまいません。専用のフォルダーがないチャットは、すべてこのフォルダーを使います。

Game Assetsの外にあるフォルダーから再生するには、サーバー上でのローカルアクセスが必要です。入力したフォルダーのパスを保存するにも、フォルダー選択画面と同じアクセスが必要です。ログインや管理用のシークレットなしで別のデバイスから使っている場合、どちらもブロックされることがあります。[リモートアクセス: ログインとIP許可リスト](../REMOTE_ACCESS.md)を参照してください。

<a id="use-a-different-folder-for-a-chat-or-character"></a>

### チャットやキャラクターごとに別のフォルダーを使う

チャットやキャラクターには、それぞれ専用の音楽フォルダーを持たせられます。これにより、物語ごとに別のサウンドトラックを流せます。キャラクターのフォルダーは、そのキャラクターだけが参加するすべてのチャットで再生されます。

1. チャットを開き、**Chat Settings**(チャット設定)を開きます。
2. **Music DJ**の設定で**Custom**プレイヤーを選んだ状態で、**Apply to**(適用対象)を開き、フォルダーの保存先を選びます。
3. **Choose Folder**(フォルダーを選択)をクリックするか、**Music folder on this device**(この端末の音楽フォルダー)にパスを貼り付けます。

| Apply to | フォルダーを使うチャット |
| --- | --- |
| **This chat**(このチャット) | このチャットだけです。分岐は同じフォルダーで始まり、あとから変更できます。 |
| キャラクターの名前 | そのキャラクターだけが参加するすべてのチャットです。キャラクターが1人のチャットでだけ表示されます。 |
| **All chats (default)**(すべてのチャット、デフォルト) | 専用のフォルダーがないすべてのチャットです。**Music DJ**の編集画面で設定したデフォルトのフォルダーです。 |

Music DJは、最初に見つかったフォルダーを使います。探す順番は、このチャットのフォルダー、キャラクターのフォルダー、デフォルトのフォルダーです。グループチャットでは、キャラクターのフォルダーは使われません。チャットやキャラクターのフォルダーは、デフォルトのソースがGame Assetsの場合でも再生されます。

**In use:**には、このチャットで再生するフォルダーと、その出どころが表示されます。出どころは**This chat**、**From**とキャラクターの名前、**Default**のどれかです。

- **Use default**(デフォルトを使用)は、このチャットのフォルダーの指定を外します。そのあと、チャットではキャラクターのフォルダーか、デフォルトのフォルダーが再生されます。
- **Unlink from**(リンクを解除)とキャラクターの名前が書かれたボタンは、そのキャラクターのフォルダーの指定をすべてのチャットから外します。

チャットにMusic DJを追加するときにも、同じ**Apply to**の選択肢が表示されます。チャット専用のフォルダーは、チャットのエクスポート、設定プロファイル、**Export Profile**のファイルには含まれません。エージェントのエクスポートには、デフォルトのフォルダーとキャラクターのフォルダーが含まれません。どのパスもこのサーバー上のファイルを指しているため、別のサーバーでは意味がありません。

## 音楽プレイヤーの使い方

**Music Player**は、デスクトップでは上部バーの小さなバッジ、モバイルではドラッグできるウィジェットです。表示と非表示を切り替えるには、**Settings → General → App Behavior**(設定 → 一般 → アプリの動作)を開き、**Music Player**をオンまたはオフにします。デフォルトではオンです。オンの状態でMusic DJをインストールしていないと、プレイヤーの表示は**Download Music DJ Agent to configure**になり、**Agent Organizer**ボタンが表示されます。

新しいプロファイルでは、ソースは最初**YouTube**になっています。ソースは、プレイヤーの丸いソース切り替えボタン(ツールチップは「Switch to ... player」)、編集画面の**Music Player**のボタン、チャットの**Music DJ**設定のどれかで変更できます。

プレイヤーには、曲のカバー画像またはサムネイル、タイトル、アーティスト名またはチャンネル名が表示されます。操作できる内容は、ソースによって変わります。

- **Spotify**: シャッフル、**Previous**、再生と一時停止、**Next**、リピート、ミュート付きの音量、**DJ**、ノート型コンピューターのアイコンの**Marinara player**ボタン、**Music DJ setup**の歯車。Spotifyが接続されていないときは、プレイヤーに「Spotify not connected」と表示され、タップすると**Music DJ setup**が開きます。
- **YouTube**: 再生と一時停止、16:9の小さな動画パネルを開く矢印、**Stop**、ミュート付きの音量。
- **Custom**: 再生と一時停止、音量。

## DJ Mari: AIによるプレイリスト作成

Spotifyのミニプレイヤーにある**DJ**ボタン(「DJ Mari composes a playlist for you!」)は、テーマに沿ったプレイリストを作ります。DJ Mariは、ペルソナ、いちばんよく使うキャラクター、すべてのチャットの最近のやり取りをもとに、接続済みのAIモデルにプレイリストを作らせます。見つかった曲は、「DJ Mari」と当日の日付を組み合わせた名前の新しいSpotifyプレイリストに追加され、再生が始まります。

必要なものは2つです。

- **Music DJ**エージェントにモデルが割り当てられていること。割り当てがないと、「Configure a model connection on the Music DJ agent before using DJ Mari.」と表示されます。[AIプロバイダーへの接続](../connections/connecting-to-a-provider.md)を参照してください。
- 一致するSpotifyの曲が少なくとも25曲あること。選ぶのは最大50曲です。25曲に満たない場合は、Liked Songsを増やしてからやり直すよう案内されます。

成功すると、「DJ Mari playlist is ready」と**Open playlist**ボタンが表示されます。

<a id="music-dj-in-game-mode"></a>

## Game ModeでのMusic DJ

Game Modeには、Game Assetsを使った独自の背景音楽があります。代わりにMusic DJを使うには、Gameの設定で**Music DJ**トグル(「Use the Music DJ for this game instead of local music assets」)をオンにします。デフォルトではオフです。オンにすると、Roleplayと同じ**Spotify**、**YouTube**、**Custom**の選択肢と設定欄が使えます。

Spotifyの場合は、シーンのたびに、サーバーが選んだソースから実在する候補曲の短いリストを作り、AIがその中から1曲を選びます。これにより、AIが存在しない曲を作り出すことを防ぎます。Game Modeでは、一度に1曲をループ再生します。現在のシーンの曲を選び直すには、**Game controls**(ゲームの操作)を開き、**Retry Music DJ**を選びます。[Gameの操作](../game/getting-started.md#the-games-controls)を参照してください。

<a id="the-conversation-music-command"></a>

## ConversationのMusicコマンド

Conversationでは、Music DJをエージェントとして追加できません。代わりに、キャラクターが**Music**コマンドで曲を流します。

1. チャットの**Commands**(コマンド)セクションを開き、親となる**Commands**トグルをオンにします。
2. **Music**(「Let characters play songs through the active Music Player」)をオンにします。

これで、キャラクターはSpotify向けに曲名を挙げたり、YouTube向けに曲の雰囲気を書いたりでき、Marinaraが有効なソースで再生します。Music DJをどこでも有効にしていなくても動きます。必要なのは、Spotifyの接続か、保存済みのYouTubeキーだけです。Spotifyが接続されていない場合や再生の権限がない場合、Spotify向けの曲コマンドは何も起こさず、エラーも表示しません。

## トラブルシューティング

- **ミニプレイヤーが見当たらない**: **Settings → General → App Behavior**(設定 → 一般 → アプリの動作)で**Music Player**をオンにします。
- **Spotifyで何も再生されない**: 再生にはSpotify Premiumと、動作中のSpotifyデバイスが必要です。どれかのデバイスでデスクトップアプリを開くか、デスクトップで**Enable Marinara player**をクリックします。
- **別のコンピューターでSpotifyのログインウィンドウが失敗する**: 「Browser couldn't reach the callback?」の貼り付けボックスを使うか、サーバーに`SPOTIFY_REDIRECT_URI`を設定します。
- **YouTubeの検索が失敗する**: プロジェクトで**YouTube Data API v3**が有効になっていること、キーにHTTPリファラー制限がかかっていないことを確認します。1日のクォータに達した場合は、翌日にやり直すか、別のキーを使います。
- **リモートアクセスで、デバイスのフォルダーからCustomの音楽が再生されない、または入力したフォルダーのパスが保存されない**: どちらにも、サーバー上でのローカルアクセスが必要です。[リモートアクセス: ログインとIP許可リスト](../REMOTE_ACCESS.md)を参照してください。
- **チャットで違うフォルダーが再生される**: チャットの**Music DJ**の設定で**In use:**を確認します。**This chat**(このチャット)はキャラクターのフォルダーより優先されるため、もう一度キャラクターのフォルダーに従わせるには**Use default**(デフォルトを使用)をクリックします。
- **Conversationでキャラクターの曲コマンドが効かない**: Spotifyを接続するかYouTubeキーを保存し、**Commands**と**Music**のトグルがオンになっていることを確認します。

## 関連ガイド

- [ダウンロードできるエージェント一覧](../agents/built-in-agents.md)
- [エージェント: チャットを支えるAIヘルパー](../agents/agents-overview.md)
- [AIプロバイダーへの接続](../connections/connecting-to-a-provider.md)
- [ゲームアセット](../game/game-assets.md)
- [Conversationモード: はじめに](../conversation/getting-started.md)
