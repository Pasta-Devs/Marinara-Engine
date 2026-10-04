# Music DJ: Spotify、YouTube、ローカルの音楽

このガイドでは、**Music DJ**を使ってMarinara Engineで背景音楽を流す方法を説明します。Spotify、YouTube、手元の音楽ファイルをつなぐ手順がわかります。あわせて、音楽プレイヤー、プレイリストを作る**DJ Mari**、Game Modeでの音楽の動きも紹介します。

## Music DJとは

**Music DJ**は、あとからダウンロードして追加するエージェントです。エージェントとは、チャットの裏側で自動的に動く助っ人のことです。設定を始める前に、**Agents**(エージェント)を開いて**Download Agents**(エージェントのダウンロード)を選び、**Music DJ**をインストールします。返信が届くたびに、Music DJがシーンの雰囲気を読み取り、それに合った背景音楽を流します。

**Music DJ**は3つのソースから音楽を再生できます。

- **Spotify**: 自分の実際のSpotifyアカウントとデバイスで再生を操作します。
- **YouTube**: YouTubeを検索し、結果をアプリ内の小さなプレイヤーで再生します。ログインは不要です。
- **Custom**: Marinaraを動かしているコンピューター上のフォルダーから、手元の音声ファイルを再生します。

有効になっているソースは、アプリ上部のバーに固定される小さな**Music Player**(音楽プレイヤー)として表示されます。スマートフォンや幅の狭いウィンドウでは、ドラッグして動かせる小さな丸いウィジェットになります。

**Music DJ**はインストール直後はオフです。ほかのエージェントと同じように、チャットごとにオンにします。**Roleplay**チャットで使えるほか、**Game**モードでは専用のトグルから使えます(後述のGame ModeでのMusic DJを参照)。**Conversation**モードでは代わりに**Music**コマンドを使います(後述のConversationのMusicコマンドを参照)。

**Music DJ**の設定は1か所にまとまっています。右側の**Agents**パネルを開き、**Music DJ**を開きます。ミニプレイヤーの歯車アイコンからも開けます。アイコンのツールチップには**Music DJ setup**と表示されます。

### 音楽ソースの選択

**Music DJ**の編集画面では、**Music Player**欄に**Spotify**、**YouTube**、**Custom**の3つのボタンが並びます。説明文は「Choose which service Music DJ should use for future music picks. The same choice switches the visible player surface.」です。

ボタンの下には、現在どのソースが動いているかを示す行があります。たとえば「Visible player: Spotify. Saved provider: Spotify.」のように表示されます。このソースの選択はアプリ全体で共有され、チャットごとには保存されません。

選ぶときの目安は次のとおりです。

| ソース | 必要なアカウント | 費用 | 向いている用途 |
|---|---|---|---|
| **Spotify** | 自分のSpotifyアカウントと、再生用のSpotify Premium | 設定は無料、再生にはPremiumが必要 | 自分のデバイスで実在の曲を曲名どおりに流す |
| **YouTube** | 無料のGoogle APIキー | 無料 | ログインもPremiumも不要で再生する |
| **Custom** | 不要 | 無料 | 手元のローカル音声ファイルを流す |

## Spotifyの設定

Spotifyでは、自分で作る無料のSpotifyデベロッパーアプリを使います。貼り付けるのは**Spotify Client ID**だけで、クライアントシークレットの入力は必要ありません。

**Music DJ**の編集画面を開き、**Spotify Connection**欄を探します。そのうえで次の手順を進めます。

1. アプリに表示されているリンクから**Spotify Developer Dashboard**を開きます。
2. 新しいアプリを作成し、「Web API」を選びます。
3. 作成したアプリのRedirect URIsに、アプリ内の設定ボックスの手順3でMarinaraが表示するリダイレクトアドレスをそのまま追加します。リダイレクトアドレスとは、ログイン後にSpotifyが戻し先として使うWebアドレスのことです。
4. Spotifyのアプリから**Client ID**をコピーし、**Spotify Client ID**欄に貼り付けます。
5. エージェントを保存し、**Connect Spotify Account**(Spotifyアカウントの接続)をクリックします。

Spotifyのログインと許可のウィンドウが開きます。許可すると、ウィンドウに短い「Spotify Connected!」のページが表示され、自動的に閉じます。Marinaraの画面に戻ると、緑色の**Connected to Spotify**のバッジが表示されます。保存した接続を消すには**Disconnect**ボタンを使います。

アプリには次の注意書きが表示されます: 「Requires Spotify Premium. Tokens refresh automatically, no need to reconnect.」無料のSpotifyアカウントでも接続はできますが、再生、一時停止、スキップ、音量の操作にはSpotify Premiumが必要です。PremiumはSpotifyの有料プランです。

### Spotifyのデバイスについて

Spotifyは、スマートフォン、デスクトップのSpotifyアプリ、アプリ内プレイヤーなどのデバイスを通じて再生します。

デスクトップでは、ブラウザーのタブ自体をSpotifyのデバイスにできます。ミニプレイヤーにあるノート型コンピューターのアイコンをクリックします。ツールチップには**Enable Marinara player**または**Use Marinara player**と表示されます。これで「Marinara Engine」という名前のSpotifyデバイスが登録され、音楽がタブに流れてきます。アプリ内での再生にもSpotify Premiumが必要です。

モバイルでは、プレイヤーはスマートフォン自身のSpotifyデバイスを優先します。そのため再生をタップすると、背後のブラウザータブではなくスマートフォン側で音楽が鳴ります。

Spotifyのデバイスが遠隔からの音量操作に対応していない場合は、音量スライダーの代わりに**Use device volume**ボタンが表示されます。デバイス本体の音量ボタンで調整してください。

### 別のコンピューターで動かしているSpotify

Spotifyが受け付けるリダイレクトアドレスは、安全な`https://`か、ループバックアドレスの`http://127.0.0.1`だけです。ループバックとは同じコンピューターのことです。Marinaraを別のコンピューターで、しかも暗号化なしの`http`で動かしている場合、ログインウィンドウが読み込めないことがあります。

このときは2つの方法があります。

- 接続の途中で、**Connect Spotify Account**ボタンの下にある「Browser couldn't reach the callback?」のセクションを開きます。失敗したウィンドウのアドレスをすべてコピーして入力欄に貼り付け、**Complete connection**をクリックします。
- または、サーバー側の環境変数でリダイレクトアドレスを固定します。環境変数とは、起動時に読み込まれるサーバーの設定のことです。

```
SPOTIFY_REDIRECT_URI=https://your-address/api/spotify/callback
```

環境変数の設定方法は[サーバー設定リファレンス](../CONFIGURATION.md)を参照してください。

## YouTubeの設定

YouTubeモードには、無料のYouTube Data APIキーが必要です。APIキーとは、Marinaraが自分に代わってサービスを使えるようにする秘密の文字列です。YouTubeアカウントへのログインもPremiumも必要ありません。

**Music DJ**の編集画面を開き、**YouTube Connection**欄を探します。そのうえで次の手順を進めます。

1. アプリに表示されているリンクから**Google Cloud Console**を開き、プロジェクトを作成するか既存のものを選びます。
2. **YouTube Data API v3**を有効にします。
3. Credentials、Create credentials、API keyの順に進みます。
4. 発行されたキーを**YouTube Data API Key**欄に貼り付けます。
5. **Save Key**(キーの保存)をクリックします。保存するとボタンの表示が**Update Key**に変わり、緑色の「API key configured」のバッジが表示されます。キーを削除するには**Remove**リンクを使います。

キーには制限をかけないままにするか、APIによる制限だけをかけてYouTube Data API v3を選びます。HTTPリファラーによる制限はかけないでください。検索はサーバー側で実行されるため、リファラー制限をかけると検索が通らなくなります。

アプリには次の注意書きが表示されます: 「The free quota (~100 searches/day) is plenty for a personal DJ.」クォータとは1日の利用上限のことです。この数値はアプリ自身の表示によるもので、将来変わる可能性があります。キーはサーバーに保管され、暗号化されて保存されます。

## Custom(ローカル)の音楽

CustomモードはMarinaraのサーバーを動かしているコンピューターから、手元の音声ファイルを再生します。対応する形式は`.mp3`、`.ogg`、`.wav`、`.flac`、`.m4a`、`.aac`、`.webm`です。

**Music DJ**の編集画面を開き、**Custom Music Library**欄を探します。ここには**Use Game Assets music folder**というスイッチが1つあります。

- スイッチがオンのとき: CustomモードはGame Assetsにアップロードした音声を読み込みます。Game Assetsは、Game Mode用にMarinaraが備えている素材ライブラリーです。**Game Assets music folder**欄でフォルダーを指定します。音楽ライブラリー全体を使うなら`music`と入力し、一部だけなら`music/combat`のようにサブフォルダーを指定します。**Open Folder**ボタンを押すと、サーバーのコンピューター上でそのフォルダーが開きます。
- スイッチがオフのとき: Customモードはサーバーのデバイス上のフォルダーを読み込みます。**Select Folder**を押すとサーバーのコンピューターでフォルダー選択画面が開きます。**Music folder on this device**欄にパスを貼り付けてもかまいません。

RoleplayとGameのチャット設定には、どちらも同じソースが選ばれた状態で表示されます。サーバーのデバイス上のフォルダーを選んでいる場合は、そのチャットのMusic DJ設定にGame Assetsのパスではなく、保存済みのパスと**Choose Folder**ボタンが表示されます。

Game Assetsの外にあるフォルダーから再生するには、サーバー本体からのアクセスが必要です。パスワードや管理用のシークレットを設定せずに別のデバイスからMarinaraを使っている場合、この機能だけが使えないことがあります。[リモートアクセス: Basic AuthとIP許可リスト](../REMOTE_ACCESS.md)を参照してください。

## 音楽プレイヤーの使い方

**Music Player**は、デスクトップでは上部バーの小さなバッジとして、モバイルではドラッグできる浮動ウィジェットとして表示されます。設定で表示と非表示を切り替えられます。

**Settings**(設定)を開き、**General**(全般)タブの**App Behavior**(アプリの動作)セクションを探します。**Music Player**のトグルをオンまたはオフにします。説明文は「Shows the compact Music Player. Switch between Spotify, YouTube, and Custom from the player itself or the Music DJ agent settings.」です。このトグルは常に使えて、デフォルトではオンです。Music DJをインストールしていない状態でオンにすると、デスクトップでもモバイルでもプレイヤーの表示が**Download Music DJ Agent to configure**に変わり、**Download Agents**ボタンが表示されます。

新しいプロファイルでは、表示されるソースは最初**YouTube**になっています。ソースは次の3つの方法で変更できます。

- プレイヤーにある小さな丸いソース切り替えボタンを使います。ツールチップには「Switch to ... player」と表示されます。
- **Music DJ**の編集画面にある**Music Player**のボタンを使います。
- チャットごとの**Music DJ**設定を使います。

プレイヤーには、再生中の曲のカバー画像またはサムネイル、タイトル、アーティスト名またはチャンネル名が表示されます。操作できる内容はソースによって変わります。

- Spotify: シャッフル、**Previous**、再生と一時停止、**Next**、リピート、ミュート付きの音量スライダー、**DJ**ボタン、ノート型コンピューターのアイコンの**Marinara player**ボタン、**Music DJ setup**の歯車。
- YouTube: 再生と一時停止、16:9の小さな動画パネルを開く展開用の矢印、**Stop**ボタン、ミュート付きの音量スライダー。
- Custom: 再生と一時停止、音量。再生されるのは手元のファイルです。

Spotifyがまだ接続されていない場合、プレイヤーには「Spotify not connected」と表示され、タップすると**Music DJ setup**が開きます。

### チャットごとのSpotifyソース

**Music DJ**が**Roleplay**チャットで動いているとき、その設定カードには**Spotify source**ドロップダウンが表示され、4つの選択肢から選べます。

- **Liked Songs**: 保存済みの曲から優先的に選びます。
- **Playlist**: 1つのSpotifyプレイリストの中だけから選びます。**Playlist**ドロップダウンに自分のプレイリストが並びます。
- **Artist**: 指定したアーティストの周辺だけを探します。**Artist**のテキスト欄が表示されます。
- **Any Spotify**: 場面に合うときにSpotify検索を自由に使わせます。

## DJ Mari: AIによるプレイリスト作成

Spotifyのミニプレイヤーにある**DJ**ボタンを押すと、テーマに沿ったプレイリストが作られます。ツールチップには「DJ Mari composes a playlist for you!」と表示されます。

**DJ Mari**は、ペルソナ、いちばんよく使っているキャラクター、すべてのチャットの最近のやり取りをもとに、接続済みのAIモデルにプレイリストを作らせます。見つかった曲は「DJ Mari」と当日の日付を組み合わせた名前の新しいSpotifyプレイリストに追加され、そのまま再生が始まります。

**DJ Mari**を使うには2つの条件があります。

- **Music DJ**エージェントにモデルの接続が割り当てられていること。割り当てがないと「Configure a model connection on the Music DJ agent before using DJ Mari.」と表示されます。[AIプロバイダーへの接続](../connections/connecting-to-a-provider.md)を参照してください。
- 一致するSpotifyの曲が十分にあること。最低25曲が必要で、最大50曲まで選びます。25曲に届かない場合は、Liked Songsを増やしてからやり直すよう案内されます。

うまくいくと「DJ Mari playlist is ready」というメッセージと**Open playlist**ボタンが表示されます。

## Game ModeでのMusic DJ

Game ModeにはGame Assetsを使った独自の背景音楽が最初から用意されています。代わりに**Music DJ**を使うには、Gameの設定画面で**Music DJ**トグルをオンにします。説明文は「Use the Music DJ for this game instead of local music assets.」です。このトグルはデフォルトではオフです。

オンにすると、Roleplayと同じ**Spotify**、**YouTube**、**Custom**の選択肢と、ソースごとの同じ設定欄が使えます。

SpotifyはGame Modeでは少し動きが違います。シーンが変わるたびに、サーバーが選択中のソースから実在する候補曲の短いリストを作ります。AIはそのリストから1曲を選びます。この仕組みによって、AIが存在しない曲を作り出すことを防いでいます。Game Modeでは常に1曲をループ再生します。

**Game controls**(ゲームの操作)を開き、**Retry Music DJ**を選ぶと、現在のシーンの曲を選び直せます。コンピューターでもスマートフォンでも使えます。[Gameの操作](../game/getting-started.md#the-games-controls)を参照してください。

## ConversationのMusicコマンド

**Conversation**モードでは、**Music DJ**をエージェントとして追加できません。代わりにキャラクターが**Music**コマンドで曲を流せます。

チャットの**Commands**セクションを開きます。まず親となる**Commands**トグルをオンにし、続いて**Music**トグルをオンにします。説明文は「Let characters play songs through the active Music Player.」です。

これでキャラクターはSpotify向けに曲名を挙げたり、YouTube向けに曲の雰囲気を書いたりでき、Marinaraが有効なソースで再生します。この機能は**Music DJ**をどこでも有効にしていなくても動きます。必要なのはSpotifyの接続か、保存済みのYouTubeキーだけです。

Spotifyが接続されていない場合や再生の権限がない場合、Spotify向けの曲コマンドは何も起こさず、エラーも表示しません。曲が流れないときは、まずソースの設定を見直してください。

## トラブルシューティング

- ミニプレイヤーが見当たりません。**Settings**の**General**タブ、**App Behavior**セクションで**Music Player**をオンにします。
- Spotifyで何も再生されません。再生の操作にはSpotify Premiumと、動作中のSpotifyデバイスが必要です。どれかのデバイスでデスクトップアプリを開くか、デスクトップで**Enable Marinara player**をクリックします。
- 別のコンピューターでSpotifyのログインウィンドウが失敗します。「Browser couldn't reach the callback?」の貼り付け欄を使うか、サーバーに`SPOTIFY_REDIRECT_URI`を設定します。
- YouTubeの検索が失敗します。プロジェクトで**YouTube Data API v3**が有効になっているか、キーにHTTPリファラー制限がかかっていないかを確かめます。1日のクォータに達した場合は、翌日にやり直すか別のキーを使います。
- リモートアクセス経由だと、デバイス上のフォルダーからCustomの音楽が再生されません。そのフォルダーにはサーバー本体からのアクセスが必要です。[リモートアクセス: Basic AuthとIP許可リスト](../REMOTE_ACCESS.md)を参照してください。
- Conversationモードでキャラクターの曲コマンドが効きません。Spotifyを接続するかYouTubeキーを保存し、**Commands**と**Music**のトグルがオンになっているか確かめます。

## 関連ガイド

- [ダウンロードできるエージェント一覧](../agents/built-in-agents.md)
- [エージェント: チャットを支えるAIヘルパー](../agents/agents-overview.md)
- [AIプロバイダーへの接続](../connections/connecting-to-a-provider.md)
- [ゲームアセット: 音楽、効果音、スプライト、背景](../game/game-assets.md)
- [Conversationモード: はじめに](../conversation/getting-started.md)
