# アニメーション表情

このガイドでは、Marinara Engineのアニメーション表情について説明します。アニメーション表情とは、キャラクターの立ち絵スプライトとして使う、短くループする動画のことです。スプライトとは、チャット中にMarinaraが表示するキャラクターの立ち絵です。アニメーション表情を使うと、この立ち絵が静止したままではなく動きます。

## アニメーション表情とは

通常の表情スプライトは、笑顔や怒った顔などの静止画です。アニメーション表情は、その静止画の代わりに再生される短いループ動画です。Marinaraはこれをそれぞれ1つのGIFスプライトとして保存します。GIFは、短いアニメーションを自動でループ再生する画像ファイルです。

Marinaraはアニメーション表情を2段階で作ります。まず**Video Generation**(動画生成)接続に依頼して、その表情の短い動画クリップを生成します。次に、そのクリップを手元のコンピューターでループするGIFスプライトに変換します。

保存されたあとは、アニメーション表情もほかのスプライトとまったく同じように動作します。ダウンロードできる**Expression Engine**エージェントがシーンの感情に合わせてスプライトを選び、表示します。スプライトの表示方法は[キャラクターのスプライト(表情と全身)](../characters/sprites.md)を、Expression Engineについては[ダウンロードできるエージェント一覧](../agents/built-in-agents.md)を参照してください。

## 始める前に

アニメーション表情を生成するには、事前に2つの準備が必要です。

1. **Video Generation**接続。動画を生成できるプロバイダーへの接続情報を保存したものです。追加方法は[シーン動画の生成](scene-video.md)を参照してください。
2. Marinaraを動かしているコンピューターにインストールしたffmpeg。ffmpegは無料のメディア変換ツールで、動画クリップをGIFスプライトに変換します。

ffmpegが見つからない場合、生成はすぐに失敗し、次のメッセージが表示されます。

```
Animated expression GIF conversion requires ffmpeg. Install ffmpeg and make it available on PATH, or set FFMPEG_PATH.
```

これを解決するには、ffmpegをインストールし、システムから見つけられる状態にします。環境変数`FFMPEG_PATH`にffmpegのプログラムのフルパスを設定する方法もあります。環境変数とは、サーバーの起動前に渡しておく設定のことです。

## アニメーション立ち絵をオンにする

アニメーション表情は、静止スプライトと同じウィンドウから生成します。

1. キャラクターの場合は**Character Editor**(キャラクターエディター)を、ペルソナの場合は**Persona Editor**(ペルソナエディター)を開きます。
2. **Sprites**タブを開き、**Facial Expressions**カテゴリーを選びます。
3. **Generate Sprite**をクリックします。**Generate Sprites**ウィンドウが開きます。
4. **Generate animated portraits**のチェックボックスをオンにします。ウィンドウがアニメーションモードに切り替わります。
   - 接続の選択欄が**Image Generation Connection**から**Video Generation Connection**に変わります。
   - 静止スプライトシート用のグリッド設定が消えます。
   - Marinaraはシート全体ではなく、1つずつ表情を生成するようになります。
5. ドロップダウンから**Video Generation Connection**を選びます。
6. プロバイダーがキャラクターの外見を把握できるように、**Appearance Description**(外見の説明)を入力します。
7. 生成したい表情を選びます。
8. 表情が1つなら**Generate Animated Portrait**を、複数なら**Generate Animated Portraits**をクリックします。

生成中は「Generating animated portrait GIFs...」というメッセージが表示されます。各表情はまず短い動画になり、そのあとMarinaraがGIFスプライトに変換します。

生成が終わったら、結果を確認して保存ボタンをクリックし、キャラクターまたはペルソナに追加します。一部の表情が失敗しても、Marinaraは成功した分をそのまま保持します。失敗した表情の名前が一覧表示されるので、あとからやり直せます。

## 長さと縦横比

アニメーション表情は必ず縦長の立ち絵クリップになります。縦横比は9:16(縦向き)に固定されていて、変更できません。

1つのクリップの長さは変更できます。**Settings**(設定)を開き、**Video Generation**セクションを探してください。設定項目の名前は**Animated expression length**です。デフォルトは3秒で、1秒から8秒までの範囲で指定できます。

Marinaraは最終結果を、幅512ピクセルの小さなループGIFとして保存します。クリップが短いほどファイルは小さくなり、ループも速くまとまりのあるものになります。

## 透過についての注意

静止スプライトは背景を消して、キャラクターだけがシーンの上に浮かんでいるように見せられます。アニメーション表情はこれとは異なり、Marinaraは背景の除去処理を行いません。

アニメーションモードでは、背景を透過するチェックボックスの名前が**Prefer clean transparent-style background**に変わります。このチェックボックスは動画のプロンプトにヒントを1つ追加するだけです。説明文にも次のように明記されています: 「Adds a flat transparent-friendly background instruction to the video prompt. GIF transparency is not guaranteed.」

確認画面にも同じ内容が表示されます: 「Animated portrait sprites are saved as looping GIFs. Static background cleanup, sheet slicing, and frame cropping are skipped for GIF output.」つまり、アニメーション表情には背景が残ることがあります。すっきりした見た目にしたいときは、**Appearance Description**で無地の背景を指定してください。

## 生成時の注意点

アニメーション表情の生成には、静止スプライトより時間がかかります。Marinaraはまとめて処理せず、1つずつ表情を生成します。一度にたくさんの表情を選ぶとかなり待つことになるので、まずは少数から試してください。

**Expose media prompts before sending**(**Settings**の**Overall Generations**セクションにあります)をオンにしている場合、Marinaraはプロンプトの確認画面でいったん停止します。プロバイダーに送信する前に、それぞれのプロンプトを読んで編集できます。確認画面を挟みたくないときは、この設定をオフのままにしてください。

## トラブルシューティング

ffmpegに関するメッセージが出て生成に失敗します。ffmpegをインストールし、サーバーから見つけられる状態にするか、環境変数`FFMPEG_PATH`を設定してください。上の「始める前に」を参照してください。

ドロップダウンに動画生成の接続が見つからないと表示されます。まず**Video Generation**接続を追加してください。[シーン動画の生成](scene-video.md)を参照してください。

**Generate Sprite**ボタンが無効になっています。デバイスによってはMarinaraが画像ライブラリーを読み込めず、アニメーション表情を含むすべてのスプライト生成がオフになります。これは一部のAndroid環境やTermux環境で起こります。

保存したGIFに背景が残っています。これは仕様どおりの動作です。アニメーション表情では背景の除去処理を行いません。上の「透過についての注意」を参照してください。

## 関連ガイド

- [キャラクターのスプライト(表情と全身)](../characters/sprites.md)
- [シーン動画の生成](scene-video.md)
- [ダウンロードできるエージェント一覧](../agents/built-in-agents.md)
