# Roleplayの背景

Roleplayのチャットでは、メッセージの後ろにシーン全体の画像が表示されます。この画像は、返信のたびに**Background**(背景)エージェントに選ばせることも、手動で新しく作ることも、1枚の画像を1つのチャットに固定することもできます。画像が変わるときは、Marinaraが古い画像から新しい画像へフェードで切り替えます。

画像生成は必須ではありません。画像生成のアカウントがない場合、背景は単色になり、チャットはテキストとして動きます。

## 特定のチャットに背景を設定する

エージェントに選ばせる代わりに、開いているチャットの後ろに1枚の画像を置いたままにしたいときに使います。変わるのはそのチャットだけです。

1. チャットを開きます。次に**Settings → Appearance**(設定 → 外観)を開き、**Backgrounds**(背景)を探します。
2. **Chat Background**(チャットの背景)で、アップロードした画像かゲームアセットの背景を選びます。

メッセージの後ろにその画像が表示されます。デフォルトに戻すには、**Chat Background**の横にある**Remove**(削除)をクリックします。

画像がまだない場合は、先にアップロードしてください。[チャットの背景](../appearance/chat-backgrounds.md)を参照してください。

## Backgroundエージェントに背景を選ばせる

**Background**(背景)エージェントは、返信と並行して動く補助機能です。返信のたびに現在のシーンを読み取り、すべての背景の中からいちばん場面に合う画像を選びます。選ぶのは既存の画像だけです。新しい画像を自動で作るのは**Illustrator**エージェントです。

1. Roleplayのチャットを開きます。
2. チャット内のスライダーボタンで**Chat Settings**(チャット設定)を開きます。
3. **Agents**(エージェント)を開き、**Enable Agents**(エージェントを有効にする)をオンにします。
4. **Background**エージェントを追加します。

これで、物語の舞台が移るのに合わせて背景が自動で切り替わります。

うまくいかなかった場合: 背景が1枚か2枚しかないと、エージェントはそれを選び続けます。ライブラリーに背景を追加してください。[チャットの背景](../appearance/chat-backgrounds.md)を参照してください。

## 手動で背景を生成する

Marinaraがシーンの内容(ジャンル、設定、場所、天候、時刻)から画像プロンプトを組み立て、新しい背景を作ります。

始める前に: **Illustrator**エージェントをインストールしてそのエージェントに画像生成のアカウントを設定するか、画像生成のアカウントを1つデフォルトに指定してください。[AIプロバイダーへの接続](../connections/connecting-to-a-provider.md)を参照してください。Illustratorをチャットに追加する必要はありません。

1. チャット内のスライダーボタンで**Chat Settings**(チャット設定)を開き、**Gallery**(ギャラリー)を展開します。
2. **Background**(背景)をクリックします。処理中はボタンに**Generating...**と表示され、Galleryには「Illustrator is generating a background image for this scene.」と表示されます。
3. 完了するまで待ちます。新しい画像は背景ライブラリーに追加され、シーンに適用されます。

手動生成では、まずIllustratorエージェントの画像用のアカウントを使い、次にデフォルトの画像生成のアカウントを使います。使えるのはRoleplayモードとGame Modeで、Conversationでは使えません。

うまくいかなかった場合: 「Choose an image generation connection for the Illustrator agent, or mark one as the default image connection.」というメッセージは、Marinaraが画像用のアカウントを見つけられなかったことを意味します。アカウントを設定してから、もう一度試してください。**Background**ボタンがない場合は、Illustratorがインストールされていません。

## ライブラリーとぼかし

選ぶ画像は、同じ**Backgrounds**(背景)セクションにあります。インポート、タグ、名前の変更、削除、**Background Blur**(背景のぼかし)スライダー、新しいRoleplayチャット用のデフォルト背景については、[チャットの背景](../appearance/chat-backgrounds.md)で説明しています。

## 関連ガイド

- [チャットの背景](../appearance/chat-backgrounds.md): アップロードライブラリーと外観の設定。
- [シーン背景](../media/scene-backgrounds.md): Galleryから作るAIのシーン画像。
- [Roleplayモード: はじめに](getting-started.md): Roleplayのステージ、スプライト、HUD。
