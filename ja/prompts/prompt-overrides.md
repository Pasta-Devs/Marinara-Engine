# 画像と動画のPrompt Overrides

Prompt Overrides(プロンプトの上書き)は、Marinaraが画像モデルや動画モデル向けのプロンプトを書くときに使うテンプレートを編集するエディターです。ポートレート、自撮り写真、スプライト、シーンのイラスト、絵コンテ、動画クリップをモデルにどう説明するかを変えたいときに使います。

Prompt Overridesでは、チャットモデルに送られるプロンプトは変わりません。そちらを変えるには、プリセットを使います。[Preset Editorとプロンプトの管理](presets.md)と[生成パラメーター](generation-parameters.md)を参照してください。

スプライトとは、表情やポーズなどを描いたキャラクターの立ち絵です。絵コンテとは、Game Modeの1ターン、または完了したRoleplayのエピソードから作られる、挿絵付きのコマの集まりです。

始める前に: Prompt Overridesが影響するのは画像や動画を生成する機能だけで、それらの機能を使うには、先に画像生成または動画生成のアカウントが必要です。アカウントがなければ、テンプレートは使われません。[画像生成プロバイダーと設定](../media/image-providers.md)と[シーン動画の生成](../media/scene-video.md)を参照してください。

## エディターを探す

1. **Settings**(設定)を開きます。
2. **Generations**(生成)タブをクリックします。
3. 「Reusable image and video prompt templates」と説明された**Prompt Overrides**までスクロールします。

ここにエディターが2つあります。タイトルをクリックすると展開します。

| エディター | 対象のテンプレート |
| --- | --- |
| **Video Generation Prompt Overrides** | GameとGalleryのシーン動画、Conversationの動画メッセージ、Conversationの通話のキャラクタークリップ、動く表情のポートレート。 |
| **Image Generation Prompt Overrides** | Conversationの自撮り写真、GameのNPCポートレート、シーンのイラスト、絵コンテのプロンプト、**Noodle Post Image**テンプレート、そのほかの画像ビルダー。 |

## テンプレートの編集

1. エディターを開きます。
2. **Registered prompt**(登録済みプロンプト)からテンプレートを選びます。一覧の中身はエディターによって変わります。
3. 横にあるステータス表示を確認し、ドロップダウンの下にある短い説明を読みます。
4. **Available variables**(使用できる変数)の下にある変数チップをクリックして挿入します。変数は`${charName}`のような形です。
5. **Template**(テンプレート)欄の文章を編集します。
6. **Rendered preview**(表示プレビュー)を確認します。テンプレートにサンプルの値を入れて表示します。
7. **Unknown variables**の警告が出たら直します。**Available variables**の一覧にない名前には値が入りません。
8. **Save**(保存)をクリックします。

「Prompt override saved」と表示され、ステータス表示が**Custom active**に変わります。

| ステータス表示 | 意味 |
| --- | --- |
| **Default** | 独自のテンプレートは保存されていません。 |
| **Custom active** | 保存したテンプレートが使われています。 |
| **Custom paused** | テンプレートは保存されていますが、オフになっています。 |

## テンプレートを使わずに保存しておく

プレビューの下にある**Apply this override**(この上書きを適用)をオフにします。ヘルプには「Turn this off to keep the template saved without using it.」と書かれています。Marinaraは組み込みのテンプレートを使い続け、ステータス表示は**Custom paused**になります。

## 組み込みのテンプレートに戻す

**Reset to Default**(デフォルトに戻す)をクリックします。上書きが保存されている場合は、Marinaraが確認を求めます。ステータス表示は**Default**に戻ります。

## 関連ガイド

- [画像生成プロバイダーと設定](../media/image-providers.md)
- [シーン動画の生成](../media/scene-video.md)
- [画像スタイルプロファイル](../media/style-profiles.md)
- [Noodleの設定とチャットへの引き継ぎ](../agents/noodle-settings.md)
- [Preset Editorとプロンプトの管理](presets.md)
- [生成パラメーター](generation-parameters.md)
