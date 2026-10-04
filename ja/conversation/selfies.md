# 自撮り写真

このガイドでは、Conversationモードの自撮り写真を説明します。自撮り写真とは、キャラクターが自分自身の画像を生成してチャットに送る機能です。メッセージアプリで写真を共有する感覚に近いものです。ここでは、自撮り写真をオンにする手順、設定の内容、そして手動でリクエストする方法がわかります。

## 自撮り写真とは

自撮り写真はConversationモードの機能です。ふつうのチャットの途中で、キャラクターが自分を写した画像を生成して送れます。RoleplayモードやGame Modeで使うシーンの画像とは別物です。自撮り写真は、Conversationモードのメッセージアプリらしい雰囲気に合わせて作られています。

自撮り写真は画像生成を使います。キャラクターが自撮り写真を1枚送るたびに、選んだ接続の画像生成リクエストを1回消費します。そのため、設定を済ませるまで自撮り写真はオフになっています。

自撮り写真の機能は、追加パッケージの**Illustrator**が提供します。設定の前に、**Agents → Download Agents**からIllustratorをインストールしてください。

## 自撮り写真をオンにする

自撮り写真の設定は、Conversationチャットの**Agents**(エージェント)セクションにある**Illustrator Settings**(Illustratorの設定)の中にあります。**Commands**(コマンド)とは、曲を再生する、自撮り写真を送るといった、キャラクターが自分の判断で実行できる隠れた操作のことです。コマンドを提供するパッケージをインストールすると、**Agents**の中にコマンドの設定が現れます。

自撮り写真をオンにする手順は次のとおりです。

1. Conversationチャットを開きます。
2. スライダーのアイコンから**Chat Settings**(チャット設定)を開きます。
3. **Agents**セクションを探します。
4. その中にある**Commands**の親トグルをオンにします。これがオフの間、キャラクターは隠れた操作を一切実行できません。
5. **Illustrator Settings**を探します。
6. **Generated Selfies**(自撮り写真の生成)のスイッチをオンにします。

**Generated Selfies**をオンにすると、スイッチの下に自撮り写真の設定が現れます。接続、プロンプトモデル、スタイル、参照画像の欄が表示されます。**Resolution**のボタンは、**Selfie Connection**を選んだあとにだけ現れます。

## 自撮り写真の設定

自撮り写真をオンにしたら、見た目と生成に使うサービスを設定します。以下の設定はすべて、**Chat Settings → Agents**の**Illustrator Settings**にあります。設定が効くのは現在のチャットだけです。

### Selfie Connection

**Selfie Connection**(自撮り写真の接続)では、画像を描く画像生成サービスを選びます。デフォルトは**None (selfies disabled)**で、まだサービスを選んでいない状態です。ここで、設定済みの画像用の接続から1つ選びます。

**Selfie Connection**を選ぶまで、キャラクターは自撮り写真を送れません。「Choose a Selfie Connection to let characters generate selfie images」という注意書きが表示されているときは、接続がまだ空のままです。

画像用の接続を追加する方法は、[画像生成プロバイダーと設定](../media/image-providers.md)を参照してください。

### Prompt Model

**Prompt Model**(プロンプトモデル)では、自撮り写真の説明文を書くテキストモデルを選びます。その説明文をもとに、画像用の接続が絵を描きます。デフォルトは**Main chat model**で、チャットがすでに使っているモデルをそのまま使います。説明文を別のモデルに書かせたいときは、ほかのテキスト用の接続を選べます。

### Image Style

**Image Style**(画像スタイル)では、自撮り写真に使うStyle Profileを選びます。Style Profileとは、「anime」「realistic photo」のような画風を表す語句をまとめて保存したものです。デフォルトは**Use default style from Style Profiles in Advanced settings**で、全体のデフォルトスタイルに従います。

スタイルの詳細は、[画像スタイルプロファイル](../media/style-profiles.md)を参照してください。

### Send Avatar References

**Send Avatar References**(アバターの参照画像を送信)はトグルで、デフォルトはオフです。オンにすると、Marinaraがキャラクターのアバターやスプライトを参照画像として画像生成サービスに送ります。これで自撮り写真がキャラクターの見た目に近づきます。動作するのは、プロバイダーが参照画像に対応している場合だけです。

### Attach Card Appearance

**Attach Card Appearance**(カードの外見情報を添付)はトグルで、デフォルトはオフです。オンにすると、Marinaraがキャラクターカードの外見の記述を自撮り写真の説明文に加えます。キャラクターの見た目の情報がモデルに詳しく伝わります。

### Resolution

**Resolution**(解像度)では、自撮り写真の画像サイズを決めます。**Resolution**のボタンは、**Selfie Connection**を選んだあとにだけ現れます。用意されたボタンから1つ選んでください。デフォルトは**896x1152**で、縦長の形はほとんどの自撮り写真に合います。

選べるサイズは次のとおりです。

| 解像度 | 形状 |
| ---------- | ------------------ |
| 512x512    | 正方形             |
| 512x768    | 縦長             |
| 768x768    | 正方形             |
| 768x1024   | 縦長             |
| 896x1152   | 縦長(デフォルト) |
| 1024x1024  | 正方形             |

## キャラクターが自撮り写真を送る仕組み

設定が終わると、キャラクターはチャットの流れの中で自分の判断で自撮り写真を送れます。コマンドを打つ必要はありません。キャラクターがタイミングを選び、Marinaraが画像を生成してチャットに投稿します。

モデルの応答では`[selfie]`を使い、必要に応じてコンテキストを指定します:

```text
Here is a picture from my walk!
[selfie: context="standing beside the river at sunset"]
```

`[selfie: "standing beside the river"]`と`[selfie: standing beside the river]`も使えます。大文字と小文字は区別しないため、`[SELFIE:xxxxx.]`も有効な構文です。これはConversationのコマンドであり、RoleplayやGame Modeの画像生成トリガーではありません。マーカーがそのままメッセージに残る場合は、別のモードであるか、**Commands**が無効になっている可能性があります。Illustratorがインストール済みで、**Generated Selfies**が有効になり、**Selfie Connection**が選ばれているか確認してください。生成が始まってから失敗する場合は、報告された接続や画像プロバイダーのエラーを確認します。マーカーの大文字・小文字を変えても解決しません。

## 手動で自撮り写真をリクエストする

キャラクターが送ってくるのを待たずに、自分からリクエストすることもできます。

1. **Chat Settings**(チャット設定)を開き、**Gallery**(ギャラリー)セクションを展開します。
2. **Selfie**ボタン(カメラのアイコン)をクリックします。
3. チャットにキャラクターが複数いる場合は、ボタンの隣のキャラクター一覧から、自撮り写真を撮るキャラクターを選びます。
4. **Settings**、**Generations**、**Image Generation**の**Expose media prompts before sending**が有効な場合は、組み立てられた最終的な自撮り写真のプロンプトを確認または編集してから**Generate**をクリックします。この確認をキャンセルすれば、画像生成リクエストは送信されません。
5. ボタンの表示が**Generating...**の間は、そのまま待ちます。

自撮り写真ができあがると「Selfie generated.」というメッセージが表示され、画像がチャットに現れます。この手動のリクエストも、選んだ**Selfie Connection**を使うため、画像生成リクエストを1回消費します。

## 関連ガイド

- [Conversationモード: はじめに](getting-started.md)
- [画像生成プロバイダーと設定](../media/image-providers.md)
- [画像スタイルプロファイル](../media/style-profiles.md)
