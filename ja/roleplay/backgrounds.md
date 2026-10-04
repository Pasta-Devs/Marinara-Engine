# Roleplayの背景

このガイドでは、Roleplayモードのシーン背景について説明します。返信のたびに背景を選ぶ**Background**(背景)エージェント、手動での背景の作成、特定のチャットへの背景の固定が対象です。アップロードした背景ライブラリーとその操作は[チャットの背景](../appearance/chat-backgrounds.md)で、Galleryから作るAIのシーン画像は[シーン背景](../media/scene-backgrounds.md)で説明しています。

## シーン背景

Roleplayモードでは、メッセージの後ろに画面いっぱいのシーン背景が表示されます。背景が変わるときは、Marinaraが古い画像から新しい画像へなめらかにクロスフェードします。場面の切り替わりが唐突にならず、やわらかくつながります。

この機能に画像生成は必要ありません。画像生成の接続を用意していない場合、背景は単色で表示されます。チャットはこれまでどおりテキストチャットとして動きます。

## Backgroundエージェント

**Background**エージェントは、シーン背景を自動で選んでくれる、任意で使える補助機能です。返信のたびに動きます。現在のシーンを読み取り、利用できるすべての背景の中から、いちばん場面に合う画像を選びます。ライブラリーのフォルダーは**Settings**(設定)での整理用でしかなく、エージェントの選択肢を狭めることはありません。選ぶのは既存の画像だけです。背景の自動生成は**Illustrator**エージェントの担当です。

**Background**エージェントはデフォルトでオフです。オンにする手順は次のとおりです。

1. Roleplayのチャットを開きます。
2. **Chat Settings**(チャット設定)を開きます(チャット内の**Chat Settings**ボタンで、移動していなければ右上にあります)。
3. **Agents**セクションを開きます。
4. **Background**エージェントを有効にします。

これで、物語の舞台が移るのに合わせてシーン背景が自動で切り替わります。

## 手動で背景を生成する

エージェントを使わずに、自分で新しい背景を作ることもできます。Marinaraがシーンの内容(ジャンル、設定、現在の場所、天候、時刻)から画像プロンプトを組み立て、新しい背景を生成します。

1. **Chat Settings**を開き、**Gallery**(ギャラリー)セクションを展開します。
2. **Background**ボタンをクリックします。
3. 処理が終わるまで待ちます。実行中はボタンに**Generating...**と表示されます。

実行中は「AI background generation is running. The new background will be applied when it finishes.」という案内が表示されます。生成された画像は背景ライブラリーに追加され、シーンに適用されます。

手動生成では、まず**Illustrator**エージェントの画像接続を使い、なければデフォルトの画像生成接続を使います。**Background**エージェントはライブラリーにある画像を選ぶだけなので、画像接続は不要です。使える接続が見つからない場合、生成は失敗し、次のメッセージが表示されます: 「Choose an image generation connection for the Illustrator agent, or mark one as the default image connection.」

シーン背景の生成が使えるのはRoleplayモードとGame Modeだけです。Conversationモードでは使えません。

## 特定のチャットに背景を設定する

エージェントに任せず、表示中のチャットに好きな背景を固定することもできます。

1. **Settings**を開きます。
2. **Appearance**タブを開きます。
3. **Backgrounds**セクションを探します。
4. **Chat Background**で、アップロードした画像かゲームアセットの背景を選びます。

デフォルトの背景に戻すには、**Chat Background**の横にある**Remove**(削除)をクリックします。

## 背景ライブラリーとぼかし

選択できる画像は、**Settings**から**Appearance**へ進んだ先の同じ**Backgrounds**セクションにあります。[チャットの背景](../appearance/chat-backgrounds.md)のガイドでは、このライブラリーを詳しく説明しています。画像のインポート、タグ、名前の変更、削除、**Background Blur**スライダー、新しいRoleplayチャット用のデフォルト背景の設定が含まれます。

## 関連ガイド

- [チャットの背景](../appearance/chat-backgrounds.md): 背景のアップロードライブラリーと外観の設定。
- [シーン背景](../media/scene-backgrounds.md): Galleryから作るAI生成のシーン画像。
- [Roleplayモード: はじめに](getting-started.md): Roleplayのシーン、スプライト、HUDの全体像。
