# 自撮り写真

自撮り写真とは、キャラクターが自分で生成し、Conversationのチャットに送ってくる画像です。メッセージアプリで共有される写真のようなものです。このガイドでは、自撮り写真のオン、見た目の選び方、手動で依頼する方法、動画メッセージを説明します。

自撮り写真は、任意の**Illustrator**パッケージから届き、画像生成を使います。自撮り写真1枚は、選んだサービスへの画像リクエスト1回です。そのため、設定するまで何も起きません。RoleplayやGame Modeのシーンの画像とは別のものです。

## 自撮り写真をオンにする

始める前に: **Agents → Agent Organizer**から**Illustrator**をインストールし、画像アカウント(画像を作るサービスのアカウント)を追加してください([画像生成プロバイダーとセットアップ](../media/image-providers.md)を参照)。

1. Conversationのチャットを開き、**Chat Settings**を開きます。
2. **Agents**セクションを探し、**Illustrator Settings**を開きます。
3. **Generated Selfies**をオンにします。自撮り写真の設定が、その下に表示されます。
4. **Selfie model**で、画像アカウントを選びます。

**Generated Selfies**をオンにすると、そのチャットのマスターの**Commands**スイッチもオンになります。

キャラクターが自撮り写真を送るのは、**Selfie model**を設定した後だけです。それまでは、チャットに「Choose a Selfie Provider to let characters generate selfie images.」と表示されます。

うまくいかなかった場合: **Illustrator Settings**は、Illustratorをインストールしたときだけ表示されます。自撮り写真には、**Commands**の**Selfies**コマンドもオンである必要があります([キャラクターが使えるCommandsの選択](getting-started.md#choose-which-commands-a-character-can-use)を参照)。

## 自撮り写真の設定

これらはすべて**Illustrator Settings**にあり、現在のチャットだけに適用されます。

- **Selfie model**: 絵を描く画像アカウントです。デフォルトは**None (selfies disabled)**です。
- **Prompt Model**: 画像の説明を書くテキストモデルです。デフォルトは**Agent default**です。
- **Image Style**: 「anime」のような、絵のスタイルを表す言葉を保存したものです。デフォルトは、詳細設定のスタイルプロファイルにあるデフォルトのスタイルです。[画像スタイルプロファイル](../media/style-profiles.md)を参照してください。
- **Images Per Generation**: イラストや自撮り写真1回で作るバリエーションの数です。
- **Resolution**: 画像のサイズです。**Selfie model**を設定した後にだけ表示されます。デフォルトは896x1152です。
- **Send Avatar References**: キャラクターのアバターまたはスプライトを、参照画像として送ります。デフォルトはオフです。画像サービスが参照画像に対応している場合にだけ働きます。
- **Attach Card Appearance**: 名前を挙げた各キャラクターのカードの**Appearance**テキストを、プロンプトに追加します。デフォルトはオフです。

**Resolution**の選択肢は、512x512、512x768、768x768、768x1024、896x1152、1024x1024です。896x1152は縦長のポートレートで、ほとんどの自撮り写真に合います。

**Send Avatar References**と**Attach Card Appearance**には、それぞれ**Off**、**Images only**、**Videos only**、**Images and videos**の選択肢があります。

カードまたはペルソナで、エディターの**Appearance**にある**Image Appearance Override**がオンの場合、Marinaraは**Appearance**の代わりにそのテキストを使います。**Appearance**が、絵ではなく物語のために書かれているときに使ってください。

## 手動で自撮り写真を頼む

1. **Chat Settings**を開き、**Gallery**セクションを展開します。
2. **Selfie**をクリックします。キャラクターが複数いる場合は、ボタンの隣の一覧から、撮るキャラクターを選びます。
3. **Expose media prompts before sending**がオンの場合(**Settings → Generations → Overall Generations**)は、プロンプトを確認または編集して、**Generate**をクリックします。取り消すと、リクエストは送られません。
4. ボタンに**Generating...**と表示されているあいだ、待ちます。
5. 「Selfie generated.」と表示され、画像がチャットに現れます。手動のリクエストでは**Selfie model**を使い、画像リクエスト1回分の費用がかかります。

## キャラクターが自撮り写真を送る仕組み

キャラクターは、自撮り写真をいつ送るかを自分で決めます。自分で入力する必要はありません。Marinaraが画像を生成して投稿し、その後の返信では、写っていたものの短いメモが見られます。

うまくいかなかった場合: メッセージにそのままの文字列`[selfie...]`が表示されたら、チャットがConversationモードで、**Commands**と**Selfies**がオンで、**Generated Selfies**がオンで、**Selfie model**が設定されているかを確認してください。生成が始まっても失敗する場合は、画像アカウントについてのエラーを読んでください。

## 自撮り写真を作り直す

1. チャットの自撮り写真をクリックして、開きます。
2. **Regenerate image**(ピンボタンの隣の円形の矢印)をクリックします。
3. 必要ならプロンプトを編集します(**Character prompts**を含みます)。**Image model**を選ぶか、**Chat's image provider**のままにします。
4. **Generate image**をクリックします。

新しい画像が、メッセージの古い画像に置き換わります。古い画像はギャラリーに残ります。1回の試行は、画像リクエスト1回です。このオプションができる前に作った画像は、チャットの自撮り写真のプロンプトを保存していないため、ネガティブプロンプトとキャラクターのプロンプトも保存されていません。

<a id="video-messages"></a>

## 動画メッセージ

キャラクターは、短い動画クリップを送れます。先にIllustratorをインストールしてください。自撮り写真は、オフのままでもかまいません。自分で頼むには、`/video`と入力するか、`/video Aster`のように入力してキャラクターを選びます。または、チャットの**Gallery**で**Video**をクリックします。この場合は、そこで選んだキャラクターが使われます。クリップは新しいメッセージとして届き、チャットの中で再生されます。会話の最新の場面が使われます。クリップを書くモデルは、Illustratorが絵に使うのと同じ数の最近のメッセージを読みます(**Agent Budget**)。ギャラリーにある画像から動画にすることもできます。クリップはその画像から続き、最新の返信に付きます。

クリップをチャットに追加できなかった場合でも、ギャラリーの**Videos**タブに保存されます。キャラクター自身のギャラリーに動画が一覧表示されるのは、そのクリップにそのキャラクターが写っているときだけです([キャラクターとペルソナのギャラリー](../characters/galleries.md)を参照)。

### 動画の設定

**Chat Settings → Agents → Illustrator Settings**、**Video messages**を開きます。

- **Generated Videos**: キャラクターが自分で動画メッセージを送れるようにします。各クリップは動画リクエスト1回なので、新しいチャットではデフォルトでオフです。**Commands**の一覧にも、**Videos**として表示されます。
- **Video Run Interval**: **Generated Videos**をオンにすると表示されます。動画の間に何通のメッセージを挟むかを決めます。**0**で止まります。
- **Video model**: 動画アカウントです。**Default video provider**は、デフォルトのアカウントを使います。
- **First frame**: クリップを始める画像です(下記を参照)。

`/video`とギャラリーの**Video**ボタンは、どちらの設定でも動作し、間隔を無視します。自撮り写真つきの返信をスワイプすると、新しいスワイプで、その返信ならではのクリップを送れます。グループチャットでは、**Settings → Generations → Video Generation**の**Videos per reply**(デフォルトは3)の範囲で、各キャラクターが返信ごとに1つのクリップを送れます。

**First frame**の選択肢は次のとおりです。

- **New selfie, or the avatar if no selfie provider**(デフォルト): 自撮り写真がオンで**Selfie model**が設定されていれば新しい自撮り写真、そうでなければアバターを使います。
- **New selfie, then animate it**: 常に新しい自撮り写真を作り、ギャラリーにも保存します。自撮り写真がオンで、**Selfie model**が必要です。
- **Avatar or sprite**: アバター。アバターがなければ、全身のスプライトを使います。
- **Prompt only (no picture)**: 画像なしです。ComfyUIのワークフローには、これがないと失敗するものがあります。**Send Avatar References**に動画が含まれている場合は、**Prompt only (avatar from Send Avatar References)**と読み替えて、アバターから始めます。

**Expose media prompts before sending**がオンの場合は、動画プロンプトと一緒に自撮り写真のプロンプトも確認します。

WebPなど別の形式の画像は、動画サービス向けに変換されます。動画メッセージ1つは、動画リクエスト1回です。新しい自撮り写真から始める場合は、画像リクエストがもう1回加わります。**Settings → Generations → Prompt Model**が、動画のプロンプトを書きます。**Settings → Generations → Video Generation Prompt Overrides → Conversation Video Message**が、その指示を持ちます。

## リファレンス: 自撮り写真のタグ

キャラクターは、返信に入れるタグで自撮り写真を頼みます。自分で入力することはありません。形は`[selfie]`のようで、任意で文脈を付けられます。

```text
[selfie: context="standing beside the river at sunset"]
```

`[selfie: "standing beside the river"]`や`[selfie: standing beside the river]`も使え、どの大文字小文字でも動きます。Marinaraがタグを読み取り、画像を投稿します。

## 関連ガイド

- [Conversationモード: はじめに](getting-started.md)
- [画像生成プロバイダーとセットアップ](../media/image-providers.md)
- [画像スタイルプロファイル](../media/style-profiles.md)
