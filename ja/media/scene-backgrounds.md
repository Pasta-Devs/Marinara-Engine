# シーン背景とギャラリー

このガイドでは、AIが生成するシーン背景、つまりMarinara Engineが**Gallery**(ギャラリー)から作る背景画像と、Galleryそのものについて説明します。関連するガイドが2つあります。手動でアップロードして選ぶライブラリーについては[チャットの背景](../appearance/chat-backgrounds.md)を、ターンごとに背景を自動で選ぶエージェントについては[Roleplayの背景](../roleplay/backgrounds.md)を参照してください。

## シーン背景が使える場所

シーン背景はRoleplayモードとGame Modeで使えます。Conversationモードでは利用できません。Conversationモードで生成しようとすると、次のメッセージが表示されます。

```
Scene background generation is available in Roleplay and Game modes.
```

背景を生成するには、**Image Generation**(画像生成)の接続が必要です。まだ用意していない場合は先に設定してください。[画像生成プロバイダーと設定](image-providers.md)を参照してください。

## Galleryから背景を生成して適用する

**Gallery**には、チャットの画像と動画が保存されます。**Chat Settings**(チャット設定)内のセクションなので、Chat Settingsを開いて**Gallery**を展開してください。コンピューターでは、独立したウィンドウとして切り離すこともできます([チャット設定の概要](../chats/chat-settings.md#popping-a-section-out-into-its-own-window)を参照)。**Background**(背景)ボタンを押すと、現在のシーンに合わせた背景を生成できます。

背景を生成する手順は次のとおりです。

1. **Chat Settings**内の**Gallery**セクションを開きます。
2. **Background**ボタンをクリックします。
3. 画像を作成している間、ボタンの表示が**Generating...**に変わります。
4. 次の状態メッセージが表示されます: 「AI background generation is running. The new background will be applied when it finishes.」
5. 生成が終わると、新しい画像がすぐに現在のシーンへ適用されます。「Background generated.」というメッセージが表示されて完了がわかります。

背景は現在のシーンをもとに作られます。ゲーム中であれば、ジャンル、舞台設定、現在地、天候、時間帯が反映されます。生成される背景のサイズは**Backgrounds**のキャンバスサイズに従い、デフォルトは1280×720ピクセルです。このサイズは**Settings**(設定)、**Generations**(生成)、**Image Generation**の順に開いて変更できます。

### 画像の接続が設定されていない場合

使用する画像の接続が見つからないと、生成は次のメッセージとともに失敗します。

```
Choose an image generation connection for the Illustrator agent, or mark one as the default image connection.
```

このときは、**Connections**(接続)パネルを開いて**Defaults**(デフォルト)を展開し、**Images**で画像の接続を選びます。または**Illustrator**エージェント側で画像の接続を個別に指定します。

## Galleryセクション

**Gallery**には**Images**と**Videos**の2つのタブがあります。各タブには保持している項目数が表示されます。**Videos**タブは、そのチャットでシーン動画が有効なときだけ表示されます。

セクション上部の操作ボタンは、対応する機能がそのチャットで使えるときだけ表示されます。

- **Illustrate**(イラスト生成): Illustratorエージェントを実行し、その場かぎりのシーン画像を作ります。[Illustratorエージェント](illustrator-agent.md)を参照してください。
- **Selfie**(自撮り): Conversationモードでキャラクターの自撮り写真を生成します。
- **Background**: 上で説明したとおり、シーン背景を生成して適用します。
- **Video**(動画): 最新のイラストからシーン動画を作ります。
- **Create storyboard**(絵コンテの作成): 絵コンテが有効なときに、Game Modeの最新のターン、または完了したRoleplayのエピソードのキーフレームを生成します。
- **Browse Images**(画像を参照): 保存済みの画像を挿入するためのブラウザーを開きます。
- **View storyboard**(絵コンテを表示): 最新のGame Modeの絵コンテを開きます。

ボタンの下には**Upload Images**(画像のアップロード)のドロップ領域があります。ここに画像をドラッグすると、手持ちの画像をこのチャットのGalleryへ追加できます。

### 画像ごとの操作

**Images**タブの画像にポインターを重ねる、またはモバイルでタップすると、その画像の操作が表示されます。

- 画像を原寸で開く(**Open gallery image**)。
- **Pin to chat**: 画像をチャットに固定します。
- **Download image**: 画像をデバイスに保存します。
- **Animate illustration**: その画像をシーン動画にします。
- **Copy prompt**: 保存されている画像のプロンプトをコピーします。プロンプトが保存されていない画像では**No prompt saved**と表示され、この操作は無効になります。
- **Delete gallery image**: 確認したうえで画像を削除します。

## 送信前にプロンプトを確認する

Marinaraが背景の生成リクエストを画像のプロバイダーへ送る前に、プロンプトを確認して編集できます。

1. **Settings**、**Generations**、**Image Generation**の順に開きます。
2. **Expose media prompts before sending**(送信前にメディアのプロンプトを表示)をオンにします。

この設定をオンにすると、リクエストを送る前に毎回**Review Image Prompt**ウィンドウが開きます。説明文は次のとおりです: 「Edit the prompt below before Marinara sends the image request to your provider.」

このウィンドウでは次の操作ができます。

- プロンプトのテキストとネガティブプロンプトを編集する。
- 画像の種類とサイズ、そしてリアルタイムの文字数を確認する。
- **Cancel**をクリックして中止する、または**Generate**をクリックして送信する。

いずれかのプロンプト欄が空だと**Generate**は無効になり、次の注意書きが表示されます: 「Every image request needs a prompt.」入力したテキストは、書いたとおりそのまま送信されます。

## 保存した背景を管理する

生成したシーン背景はすべて背景ライブラリーに保存されます。同じライブラリーには手持ちの画像も追加できます。アップロードできる背景はJPG、PNG、GIF、WebP、AVIFの各形式で、1つあたり20 MBまでです。

自分で追加した背景には、タグ付け、名前の変更、削除ができます。タグは小文字で、英字、数字、空白、ハイフン、アンダースコアを使え、1つあたり40文字までです。組み込みのゲームアセットの背景も並んで表示されますが、こちらは名前の変更、タグ付け、削除ができません。

このライブラリーの管理と、チャットごとまたはデフォルトの背景の設定は、外観の設定から行います。ライブラリー全体、選択画面、**Background Blur**については、[チャットの背景](../appearance/chat-backgrounds.md)を参照してください。

## 関連ガイド

- [チャットの背景](../appearance/chat-backgrounds.md): 手動で選ぶアップロード用のライブラリー。
- [Roleplayの背景](../roleplay/backgrounds.md): ターンごとに背景を自動で選ぶエージェント。
- [Illustratorエージェント](illustrator-agent.md): RoleplayモードとGame Modeのシーンイラスト。
- [画像生成プロバイダーと設定](image-providers.md): 画像の接続を設定する。
- [シーン動画の生成](scene-video.md): Galleryの画像を動画にする。
