# Marinara Engineをはじめる

Marinara Engineは、AIキャラクターとチャットしたりロールプレイしたりするためのアプリです。自分のコンピューターで動きます。このガイドでは、ホーム画面と、最初のチャットまでの手順を紹介します。

## 最初のチャットを始める

始める前に: AIサービスのAPIキー(パスワードのような秘密の文字列)か、後述の**Built-in model**(内蔵モデル)が必要です。

1. Marinara Engineをインストールして、ブラウザーで開きます。プラットフォームは[Marinara Engineのインストール](../INSTALLATION.md)で選んでください。
2. アカウントを追加します。アカウントとは、1つのAIサービスの1つのAPIキーのことです。[AIプロバイダーへの接続](../connections/connecting-to-a-provider.md)を参照してください。
3. そのアカウントで使うモデルを選びます。手順は同じガイドにあります。
4. キャラクターを作るか、インポートします。**Characters**(キャラクター)パネルを開き、**New**(新規)をクリックすると**Create Character**(キャラクターの作成)ウィンドウが開きます。ファイルからカードを取り込むときは、**Import**(インポート)をクリックします。[キャラクターの作成と編集](../characters/creating-and-editing-characters.md)を参照してください。
5. サイドバーのボタンで、チャットのサイドバーを開きます。タブには**CONVO**、**RP**、**GM**と表示されています。どれかを選び、**+**ボタンをクリックします。ボタンの名前は、タブに合わせて**New Conversation**、**New Roleplay**、**New Game**になります。
6. 開いた設定ウィンドウの案内に従い、**Create Chat**(チャットを作成)をクリックします。

表示される内容: 新しいチャットが開き、最初のメッセージを書けます。

アカウントがまだない場合は、先にアカウントの追加ウィンドウが開き、最後に**Start chatting**(チャットを始める)が表示されます。**Set Up**ウィンドウでアカウントを選ぶよう求められたら、一覧から選んでから**Create Chat**をクリックします。

Marinaraには、オンラインのAIは含まれていません。多くの人はオンラインのサービスにつなぎます。**Built-in model**をダウンロードすることもできます。これは、APIキーなしで自分のコンピューター上で動く小さなモデルです。軽い補助作業には向いていますが、メインのチャットには向きません。[内蔵モデルのセットアップ](../connections/local-model.md)を参照してください。

Marinaraを初めて開くと、短いガイドツアーが始まります。[初回チュートリアル](tutorial.md)を参照してください。途中でわからなくなったら、内蔵アシスタントのProfessor Mariに聞いてください。[Professor Mari: アプリ内アシスタント](professor-mari.md)を参照してください。

## ホーム画面の全体像

ホーム画面は、チャットを開いていないときに表示されます。見た目はWebブラウザーに似ていて、上部にタブとブックマーク、その下にウィジェットが並びます。

- **タブ。** **Home**(ホーム)がメインのページです。**Professor**(プロフェッサー)でProfessor Mariが開きます。インストールしたエージェントの中には、独自のタブを追加するものもあります。
- **検索バー。** コンピューターでは、タブの下のバーをクリックするか、<kbd>Ctrl</kbd>+<kbd>K</kbd>(Macでは<kbd>⌘</kbd>+<kbd>K</kbd>)を押すと、チャット、キャラクター、設定などを探せます。スマートフォン、タブレット、幅の狭いウィンドウでは、このバーは表示されません。
- **ブックマーク。** **Discord**、**Support**、**Credits**、**Documentation**、**Tutorial**、**FAQ**、**Achievements**、**Widgets**へのクイックリンクです。**Achievements**は、Achievementsの設定がオンのときだけ表示されます。ブックマークは**Home**タブでだけ表示されます。スマートフォン、タブレット、幅の狭いウィンドウでは、タブの左にあるブックマークのボタン(**Open bookmarks**)をタップすると、一覧で表示されます。

中央には、ロゴ、**Marinara Engine**の文字、バージョン番号が表示されます。その下にある**Conversation**、**Roleplay**、**Game**の各ボタンで、そのモードの新しいチャットを始められます。

<a id="choose-a-chat-mode"></a>

## チャットモードを選ぶ

モードは、チャットを始めるときに選びます。

- **Conversation**: メッセージアプリのような見た目の、シンプルなAIチャットです。[Conversationモード: はじめに](../conversation/getting-started.md)を参照してください。
- **Roleplay**: 1人以上のキャラクターと進める物語です。場所や時間など、シーンの状態をアプリが追跡します。[Roleplayモード: はじめに](../roleplay/getting-started.md)を参照してください。
- **Game**: 1人用のゲームです。AIが、物語を語るゲームマスターを務めます。仲間のグループ(パーティー)、ダイスロール、マップ、クエストが登場します。[Game Mode: はじめに](../game/getting-started.md)を参照してください。

<a id="home-widgets"></a>

## ホームのウィジェット

ウィジェットとは、表示したり隠したり動かしたりできる小さなカードです。

1. ブックマークの**Widgets**(ウィジェット)をクリックします。**Home Widgets**(ホームのウィジェット)ウィンドウが開きます。ウィジェットは**Built-in**(組み込み)、**Agents**(エージェント)、**Personal**(個人用)に分けて並んでいます。
2. ウィジェットの横にある目のボタンをクリックすると、表示と非表示を切り替えられます。もう一度表示したウィジェットは、ホームの最初の空いている場所に入ります。
3. ウィジェットを動かすには、右上の角にあるハンドルをドラッグします。コンピューターでは、ウィジェットにポインターを合わせるとハンドルが現れます。

配置は、このブラウザーに保存されます。個人用のウィジェットには、編集と削除のボタンもあります。ウィンドウの下部にある**Browser chrome**(ブラウザーの表示部分)には、スイッチが1つあります。**Show URL bar**(URLバーを表示)は、コンピューターで検索バーの表示と非表示を切り替えます。

Professor Mariに頼めば、個人用のウィジェットを作ってもらえます。インストールしたエージェントも、ウィジェットを追加できます。

## リファレンス: 組み込みのウィジェット

| ウィジェット | できること | 最初から表示 |
| --- | --- | --- |
| **Professor Mari** | **Ask Professor Mari**(Professor Mariに質問)で、Professor Mariとのチャットが開きます。 | はい |
| **Recent chats**(最近のチャット) | 最近のチャットです。クリックすると開き直せます。空のときは**Your chats will show here**と表示されます。 | はい |
| **Learn the engine**(エンジンを学ぶ) | **Documentation**、**Replay tutorial**、**Read FAQ**へのリンクです。 | はい |
| **What's New**(新機能) | **See what's new**と**Read release notes**です。 | はい |
| **Community**(コミュニティ) | **Discord**、**Support**、**Credits**へのリンクです。 | はい |
| **Character Library**(キャラクターライブラリー) | 自分のキャラクターから、毎日新しく選んだものを表示します。 | いいえ |
| **Discovery desk**(発見デスク) | まだインストールしていないエージェントです。**Browse agents**でカタログが開きます。 | いいえ |
| **Character of the Day**(今日のキャラクター) | ライブラリーから選んだキャラクター1人を、**Start a chat**と**View character**とともに表示します。 | いいえ |
| **Clock & calendar**(時計とカレンダー) | 今日の日付と時刻です。 | いいえ |
| **Achievements**(実績) | 最近獲得した実績と、獲得に最も近い実績です。Achievementsの設定がオンである必要があります。 | いいえ |

## 困ったときの相談先

- ホーム画面でProfessor Mariに聞く。
- **FAQ**のブックマークを開いて、手早く答えを見る。
- **Documentation**のブックマークを開いて、アプリ内のガイドを読む。
- **Discord**をクリックしてコミュニティに参加する。プロジェクトを支援するときは**Support**をクリックする。

うまく動かないところがあるときは、[Marinara Engineのトラブルシューティング](../TROUBLESHOOTING.md)を参照してください。

## 関連ガイド

- [Marinara Engineのインストール](../INSTALLATION.md)
- [AIプロバイダーへの接続](../connections/connecting-to-a-provider.md)
- [キャラクターの作成と編集](../characters/creating-and-editing-characters.md)
- [初回チュートリアル](tutorial.md)
- [Professor Mari: アプリ内アシスタント](professor-mari.md)
