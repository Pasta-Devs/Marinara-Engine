# Game ModeのLTX 2.3絵コンテ

このガイドでは、ローカルのLTX 2.3 ComfyUI image-to-videoワークフローをGame Modeの絵コンテにつなぎ、絵コンテの各フレームを短い動画クリップにする方法を説明します。ローカルのGPUとComfyUIを持つプレイヤーのための、上級者向けの設定です。この機能をStory Modeと呼ぶ人もいます。Marinaraの画面では、**Game Mode**と**Storyboards**(絵コンテ)というラベルが付いています。

この設定は、**Krea 2**で作る最初のフレームの画像と、Image Style **Z-Image Turbo Narrative**を使って作りました。説明的な自然言語のシーンプロンプトを受け付ける画像のアカウントであれば、ほかのアカウントでも動作するはずです。LTXの動画はローカルのComfyUIでレンダリングします。最初のフレームの画像をローカルで作るかホスト型のサービスで作るかは、選んだ画像のアカウントによって決まります。

完成した処理の流れは、次の手順で進みます。

1. GMが語りのターンを書きます。
2. Animation Plannerが`imagePrompt`と`narrationBeat`を返します。
3. `imagePrompt`が画像のアカウントに送られ、最初のフレームの挿絵になります。
4. `narrationBeat`が**Narration Passthrough**を通って`%prompt%`になります。
5. 最初のフレームとプロンプトがComfyUIのLTX 2.3ワークフローに送られ、MP4のクリップが作られます。

挿絵が、そのままクリップの最初のフレームになります。LTXは、出発点となる画像と、次に何が動くかを書いたプロンプトの両方を受け取ります。うまくいくと、Galleryの**Videos**タブにクリップが表示されます。

## 始める前に

必要なものは次のとおりです。

1. Marinaraから到達できる、動作中のローカルComfyUI。[ComfyUIワークフローの設定](../media/comfyui.md)を参照してください。
2. 十分なVRAM(グラフィックカードのメモリー)を持つGPU。最初のテストを480pとキーフレーム1枚で行うなら、8 GBのカードでも動くことがあります。
3. 編集可能な`ltx-director-simple`ワークフロー、またはComfyUI内で最後まで完走する同等のLTX 2.3 image-to-videoグラフと、そのAPI形式の書き出しである`ltx-director-simple-api`。
4. 最初のフレームの挿絵を作るための、Marinaraの画像のアカウント。
5. **Agents → Agent Organizer**(エージェント → エージェント管理)からダウンロードし、**Chat Settings → Agents**(チャット設定 → エージェント)でそのゲームに対してオンにした**Storyboard**エージェント。[Storyboardエージェントガイド](storyboard.md)を参照してください。

編集可能なワークフローと、そのAPI書き出しは別々のファイルです。ComfyUIで`ltx-director-simple`を開き、ComfyUI Managerが不足していると報告したカスタムノードをすべてインストールしてから、ComfyUI上でグラフを試します。Marinaraには`ltx-director-simple-api`を読み込みます。ノードやモデルを変更したときは、そのつどグラフをAPI形式で書き出し直し、Marinaraのアカウントに保存されているJSONを置き換えてください。通常のビジュアルエディター用のワークフローをMarinaraに貼り付けないでください。

## ComfyUIのAPIワークフローを準備する

まず、編集可能なワークフローを、実際のソース画像と簡単なプロンプトでComfyUIのキューに入れて実行します。音声付きのMP4が保存されることを確認してください。

Marinaraのシンプルな経路では、LTX Directorのグローバルプロンプト入力に、完成したプロンプトを1つだけ入れます。

```json
{
  "global_prompt": "%prompt%",
  "local_prompts": "",
  "segment_lengths": ""
}
```

LTX Directorノードは、画像のコンディショニング、ガイドデータ、音声、2段階のサンプリングを引き続き扱えます。「シンプル」とは、MarinaraがPrompt Relayのタイムラインではなく、image-to-video用のまとまった段落を1つ送るという意味です。

### プレースホルダー

API書き出しの中で、該当する値を次の引用符付きのMarinaraのプレースホルダーに置き換えます。

| プレースホルダー | Marinaraが渡す値 |
| --- | --- |
| `%prompt%` | Animation Plannerと動画テンプレートが作った完成プロンプト |
| `%reference_image_name%` | ComfyUIにアップロードされた最初のフレームの画像 |
| `%duration_seconds%` | クリップの長さ(秒) |
| `%length%` | 長さを、Marinaraのデフォルトである16 FPSでのフレーム数に換算したもの |
| `%fps%` | Marinaraが使うフレームレート |
| `%width%`, `%height%` | 動画のアカウントの解像度とアスペクト比から決まる寸法 |
| `%seed%` | リクエストごとに新しく作られる乱数シード |
| `%model%` | ワークフローがローダーのモデルを固定していない場合に、アカウントから渡される任意のモデル値 |

Marinaraは`%length_s%`、`%global_prompt%`、`%local_prompts%`、`%segment_lengths%`も埋められます。この4つは任意です。シンプルな経路ではこれらは必要なく、プロンプトは`%prompt%`で送ります。

参照画像は、LTX Directorの`timeline_data`にある`segments`配列の中に置きます。APIワークフローでは、`timeline_data`はJSONを文字列にしたものです。`%length%`は、`normalDurationFrames`を通じてクリップの長さを可変に保ちます。フレーム0の参照画像セグメントは、固定の`"length":16`をそのまま保ちます。

```json
{
  "timeline_data": "{\"global_prompt\":\"\",\"normalStartFrame\":0,\"normalDurationFrames\":%length%,\"segments\":[{\"id\":\"marinara-reference\",\"start\":0,\"length\":16,\"prompt\":\"\",\"type\":\"image\",\"imageFile\":\"%reference_image_name%\",\"isEndFrame\":false}],\"motionSegments\":[],\"audioSegments\":[]}"
}
```

- `%reference_image_name%`を`timeline_data`と並べて置いたり、トップレベルの別の画像項目に置いたりしないでください。
- `%reference_image_name%`のような文字列のプレースホルダーは、引用符で囲んだままにします。
- 数値のノード入力では、`%length%`、`%duration_seconds%`、`%fps%`を引用符で囲んでもかまいません。Marinaraが数値に変換するからです。文字列化された`timeline_data`の中では、デコード後の値が数値になるよう、上の例のとおり`%length%`を引用符なしのままにします。
- フレーム数、秒数、フレームレートは、これらのプレースホルダーにつないだままにします。編集可能なComfyUIグラフに表示されている数値は、Marinaraのデフォルトではありません。

### 編集のたびに書き出す

1. 編集可能なワークフローをComfyUIのキューに入れ、再生できるMP4が作られることを確認します。
2. ComfyUIのバージョンに応じて、**Save (API Format)**、**Export (API)**、**Export to API**のいずれかを選びます。
3. 新しいAPI JSONにプレースホルダーを追加するか、入っていることを確認します。
4. Marinaraのアカウントに保存されているワークフローを置き換えます。

ノードを削除したまま古い書き出しを使い続けると、すでに存在しないノードへの参照が残ります。その場合、ComfyUIはリクエストを拒否します。

## 動画のアカウントを作る

1. **Settings → Connections**(設定 → 接続)を開きます。
2. **Add account**(アカウントの追加)をクリックし、**Video Generation**(動画生成)のアカウントを選びます。
3. **ComfyUI**を選びます。
4. **Base URL**(ベースURL)を入力します。ComfyUIを同じコンピューターで動かしている場合は、通常`http://127.0.0.1:8188`です。
5. API形式のワークフロー全体を**ComfyUI workflow**(ComfyUIワークフロー)に貼り付けます。
6. 最初の省VRAMのテストでは、デフォルトの長さを6秒、**16:9**、480pにします。
7. アカウントを保存します。

テキストだけの接続テストでは`%reference_image_name%`を試せません。保存したあと、Galleryの画像か絵コンテからimage-to-videoを試してください。

## Game Modeのチャットを設定する

Game Modeのチャットを開き、**Chat Settings → Agents**(チャット設定 → エージェント)を開きます。まず**Enable Agents**(エージェントを有効にする)と**Enable Storyboards**(絵コンテを有効にする)をオンにします。ウィザードでStoryboard Optimizedの演出を選んでも、エージェントはオンになりません。

### Illustrator

| 設定 | 推奨値 |
| --- | --- |
| **Game Illustrator** | On |
| **Image model** | **Krea 2** |
| **Image Style** | **Z-Image Turbo Narrative** |
| **Use Campaign Art Style** | Off |
| **Attach Card Appearance** | Off |
| **Send Avatar References** | この検証済みのワークフローではOff |

Animation Plannerは、そのターンのキャラクターの外見情報をすでに受け取っています。そのため、同じ情報を二重に加えないよう、**Attach Card Appearance**はオフのままにします。**Storyboard First Frame**も、Plannerが仕上げた最初のフレームのシーンの前後に、キャンペーンのアートディレクションを重ねて書き足しません。

**Send Avatar References**が制御するのは、最初のフレームを作る画像サービスに送る参照画像です。LTXの最初のフレームの入力は制御しません。LTXは、完成した挿絵を`%reference_image_name%`経由で受け取ります。アバターの参照は、画像のアカウントがそれに対応していて、効果があると確認できてからオンにしてください。

最初のフレームは、アニメーションの品質を大きく左右します。計画した動きが始まる直前の瞬間を写し、被写体、動く経路、手、扉、小道具、対象がはっきり見えている必要があります。

### Scene Videos

| 設定 | 推奨値 |
| --- | --- |
| **Video model** | 作成したLTX 2.3のComfyUIアカウント |
| **Game Video Prompt** | **Narration Passthrough** |

**Game Video Prompt**は、GalleryとGame Assetsからの手動のアニメーションを制御します。絵コンテのクリップは、それらを変えずに独自のプロンプトを使えます。

### Storyboards

| 設定 | 推奨する初期値 |
| --- | --- |
| **Automatic Storyboard Illustrations** | On |
| **Automatic Storyboard Animations** | On |
| **Use NovelAI Character Prompts** | Off |
| **Keyframes per Turn** | 通常は3。最初の8 GB VRAMのテストでは1から始めます。 |
| **Animation Clip Duration** | 5秒 |
| **Viewer Display** | テスト中はFloating |
| **Illustration Planner** | **Still Keyframes**(動画のないターンのための受け皿) |
| **Animation Planner** | **LTX Simple Image-to-Video** |
| **Use Storyboard Template** | On |
| **Storyboard Illustration Prompt** | **Storyboard First Frame** |
| **Storyboard Video Prompt** | **Narration Passthrough** |

- おすすめのPlannerは**LTX Simple Image-to-Video**です。動かしやすい最初のフレームを1枚と、4から8文の率直な動きのプロンプトを1つ計画します。主となる動作を1つ、カメラの動きを1つに絞り、その周りの動きは控えめにして、必要な音や短いせりふを添えます。
- **LTX Director Storyboard**は上級者向けの選択肢です。長さを意識した、より細かい演出指示と、つながりを保つためのルールを備えています。シンプルな経路が安定してから、あるいは長いクリップで複数の段階をつなぐ必要があるときに試してください。どちらも`%prompt%`という同じ受け渡しの取り決めを使います。
- アニメーションがオンのときは、**LTX Simple Image-to-Video**が両方の出力を書きます。Krea向けの`imagePrompt`と、LTX向けの`narrationBeat`です。**Still Keyframes**は、動画のないターンでだけ使われます。
- **Storyboard First Frame**は、Plannerが書いた自然言語の最初のフレームのシーンを、そのままKreaに送ります。キーフレームの見出し、プロンプトのラベル、外見の説明の繰り返し、キャンペーンのアートディレクションは付けません。これが適用されるよう、**Use Storyboard Template**はオンのままにしてください。
- **Narration Passthrough**は、Plannerが仕上げた`narrationBeat`を、シーンの説明を重ねずに、動画プロンプトの受け渡しの取り決めに沿って渡します。

キーフレーム1枚につき、Kreaの画像ジョブが1件と、ローカルのLTX動画ジョブが1件作られます。そのため、キーフレームが3枚なら、画像のレンダリングが3回、動画のレンダリングも3回始まります。

## 最初のテストを実行する

扉を開ける、音のするほうを見る、短いせりふを1つ言うといった、はっきり目に見える動作が1つある完了済みのGMのターンを使います。

1. 省VRAMでいちばん手早く確認するには、**Keyframes per Turn**(1ターンあたりのキーフレーム数)を1にして、**Animation Clip Duration**は5秒のままにします。
2. GMのターンが完了してから、絵コンテの自動設定を2つともオンにします。
3. **Chat Settings → Gallery**(チャット設定 → ギャラリー)を開き、**Create storyboard**(絵コンテの作成)を選びます。こうすると、次のターンを待たずに、挿絵からアニメーションまでの流れ全体が始まります。
4. プロンプトの確認をオンにしている場合は、送信する前に最初のフレームのプロンプトを確認します。
5. 最初のフレームが、動きの出発点として物理的に使えるポーズになっているか確認します。
6. 最初のフレームのレンダリングと、続くComfyUIのクリップができるまで待ちます。
7. 手動の経路がうまくいったら、**Keyframes per Turn**を3に戻し、自動設定は2つともオンのままにします。

設定中は**Floating**のビューアーを使うと、画像とクリップを1つずつ確かめられます。絵コンテのメディアをGameのシーンに表示したい場合は、あとで**Background**に切り替えてください。

うまくいかなかった場合は、[トラブルシューティング](#troubleshooting)を参照してください。

## プロンプトの受け渡しの仕組み

キーフレームごとに、Animation Plannerは`imagePrompt`(時刻T=0で見えている最初のフレームだけ)と`narrationBeat`(次に何が起きるかを書いた、完全なLTXのプロンプト)を返します。**Storyboard First Frame**が`imagePrompt`を整形してKrea 2に送ります。画像ができると、**Narration Passthrough**は`narrationBeat`に解決されます。Marinaraはそれを動画リクエストの`prompt`項目に入れ、ComfyUIワークフローの`%prompt%`を置き換え、最初のフレームをアップロードして、`%reference_image_name%`をComfyUI上のファイル名に置き換えます。ローカルのプロンプトセグメントを2つ作る必要はありません。グローバルプロンプトを1つ使うのが通常の経路です。

## よいLTXプロンプトを書く

外見、構図、舞台、光、スタイルは、すでにソース画像が表しています。動画のプロンプトは動きについて書いてください。

- 現在形で書いた、流れのある段落を1つ。
- クリップの長さに収まる、焦点の定まった動作を1つ。
- 被写体を基準にして書いたカメラの動き。
- 視線、表情、姿勢、呼吸、しぐさで見せる反応。
- 環境の動きは、効果のあるものを多くても1つ。
- 必要に応じて、環境音、効果音、音楽、引用符で囲んだ短いせりふ。
- 自然な終わり方、動きの落ち着き、または短い静止。

シーンの切り替え、カット、瞬間移動、無関係な複数の動作、複雑な物理挙動、大人数の振り付け、読み取れる正確な文字、最初のフレームですでに見えている細部の繰り返しは避けてください。

```text
She pushes the door open and walks outside as the camera follows closely behind her. A light breeze moves her hair while her pace remains steady. She glances toward the empty street and says, "Stay close." Footsteps and distant traffic continue as the camera settles behind her.
```

<a id="troubleshooting"></a>

## トラブルシューティング

### ComfyUIがHTTP 400または「Prompt outputs failed validation」を返す

APIワークフローが、インストールされているグラフと一致していません。削除されたノード、宙に浮いたノードID、不足しているカスタムノード、ノードのアップデートで名前が変わった入力、すでに存在しないモデルのファイル名を探してください。動作しているグラフから、APIワークフローを新しく書き出し直します。

### 画像はできるが動画ができない

**Automatic Storyboard Animations**と、Game Modeの**Video model**を確認します。アニメーションには、最初のフレームの挿絵と、選択済みの動画のアカウントの両方が必要です。

### LTXに開始画像が渡らない

保存済みのAPIワークフローに`%reference_image_name%`があり、LTX Directorの画像セグメントにつながっていることを確認します。Marinaraは、このプレースホルダーがある場合にだけ最初のフレームをアップロードします。

### クリップが崩れる、キャラクターが変わる、破綻する

**LTX Simple Image-to-Video**に戻し、キーフレームを1枚にして、動作が1つだけのターンで試します。1枚の画像が、短いクリップの中で複数の場所、ポーズ、結末にきれいに変わることはできません。最初のフレームも確認してください。出発点のポーズがわかりにくいと、アニメーションは難しくなります。

### どの生成結果も似すぎている

ワークフローに直接書き込まれたサンプリングのシードを`%seed%`に置き換えます。使える結果が出たら、プロンプトやサンプリングの変更を比べるあいだだけ、そのシードを一時的にワークフローに固定します。

### 生成中にメモリーが足りなくなる

まず480pから始めます。次に長さを短くします。テスト中は1ターンあたりキーフレーム1枚にとどめ、ほかのGPUアプリを閉じ、VRAMの少ない同じGPUにローカルの言語モデルを読み込んだままにしないでください。量子化したチェックポイントはモデルが使うメモリーを減らしますが、動画のlatent、テキストエンコーダー、VAE、音声、アップスケールが使うメモリーは減りません。

### Marinaraが待機をやめてもComfyUIがレンダリングを続ける

ブラウザーのリクエストを閉じたり接続が切れたりすると、ComfyUIのキューにすでに入っているジョブは取り消されないまま、Marinaraのポーリングだけが止まることがあります。同じレンダリングをやり直す前に、ComfyUIのキュー、履歴、出力フォルダーを確認してください。

### ComfyUIでは動くのにMarinaraからは失敗する

アカウントに保存されたJSONと、最新のAPI書き出しを比べます。ベースURL、プレースホルダーのつづり、カスタムノード、モデルのパス、出力ノード、寸法、長さの項目を確認してください。編集可能なグラフが動いていても、Marinaraが古い書き出しのスナップショットを保持したままのことがあります。

サーバーのトレースを見るには、デバッグログをオンにして`[debug/game/storyboard-video]`と`[video-gen/comfyui]`を探します。正常なリクエストでは、完成したグローバルプロンプト、アップロードした参照画像のファイル名、長さ、フレーム数、ComfyUIのキューに登録されたプロンプトIDが表示されます。

## リファレンス: LTX 2.3のモデル

モデルの形式は、GPUの世代と、ComfyUIがテキストエンコーダー、VAE、アップスケーラーを読み込んだあとに残るメモリー量に合わせて選びます。以下はあくまで出発点で、動作を保証するものではありません。

| GPUの世代 | 実用的な出発点 | 備考 |
| --- | --- | --- |
| RTX 30 series (Ampere) | INT8 ConvRot | 3070、3080、3090クラスのカード向けの省メモリーな出発点です。 |
| RTX 40 series(16～24 GB) | FP8 input-scaled | Ada世代のハードウェアで高速なFP8経路を使います。 |
| RTX 40 series(8～12 GB) | FP8のオフロードが遅すぎる場合はINT8 ConvRot | 使っているワークフローで両方を比べてください。 |
| RTX 50 series (Blackwell) | NVFP4のdevワークフロー | NVFP4に対応したComfyUI、CUDA、ノード一式が必要です。 |
| 既存のdistilledワークフローを使うRTX 50 | FP8 input-scaled | 公式のdistilled NVFP4チェックポイントが出るまでは、これを使います。 |

動作を確認したRTX 3080のワークフローでは、`ltx-2.3-22b-distilled-1.1_transformer_only_int8_convrot.safetensors`を使っています。これらの接尾辞は量子化の形式と実行経路の違いを表すもので、いつでも差し替えられる品質プリセットではありません。**Dev**と**distilled**のワークフローはサンプリングの前提が異なるため、ワークフローを変更せずに、distilledのグラフへdevのチェックポイントを入れないでください。チェックポイントが収まっても、長い動画や高解像度の動画が収まるとはかぎりません。

公式の入門ワークフローは、`ltx-2.3-22b-dev-fp8.safetensors`、`ltx-2.3-22b-distilled-lora-384.safetensors`、`gemma_3_12B_it_fp4_mixed.safetensors`、`ltx-2.3-spatial-upscaler-x2-1.1.safetensors`を使います。独自のワークフローでは、別のチェックポイント、量子化、ローダーノード、フォルダーを使うこともあります。APIワークフローに保存されたファイル名は、ComfyUIから見えるファイルと完全に一致していなければなりません。`LTX2/`のように別のフォルダーにモデルを置いている場合は、ローダーの値を書き換えて、APIのコピーを新しく書き出し直してください。

ワークフローを共有するときは、GPUのモデル名とVRAM容量、ComfyUIのバージョン、NVIDIAドライバー、CUDA、PyTorch、Pythonのバージョン、カスタムノードとそのバージョン、モデルのファイル名とフォルダー、解像度、長さ、キーフレーム数、レンダリング時間、そしてKrea 2をローカルで動かしたのかホスト型のサービスを使ったのかを記録してください。

公式の資料は次のとおりです。

- [LTX 2.3 image-to-videoガイド](https://docs.ltx.io/open-source-model/usage-guides/image-to-video)
- [LTXプロンプトガイド](https://docs.ltx.io/open-source-model/usage-guides/prompting-guide)
- [LTX 2.3モデルカード](https://huggingface.co/Lightricks/LTX-2.3)
- [LTX 2.3 NVFP4モデルカード](https://huggingface.co/Lightricks/LTX-2.3-nvfp4)
- [公式のLTX 2.3 ComfyUIサンプル](https://github.com/Lightricks/ComfyUI-LTXVideo/tree/master/example_workflows/2.3)
- [コミュニティによるComfyUI用に分割した重みとFP8の重み](https://huggingface.co/Kijai/LTX2.3_comfy)

## 関連ガイド

- [Storyboardエージェントガイド](storyboard.md)
- [ComfyUIワークフローの設定](../media/comfyui.md)
- [シーン動画の生成](../media/scene-video.md)
- [Game Mode: はじめに](getting-started.md)
