# Game ModeのLTX 2.3絵コンテ

このガイドでは、ローカルのLTX 2.3 ComfyUI image-to-videoワークフローをMarinara EngineのGame Modeの絵コンテにつなぐ手順を説明します。この機能をStory Modeと呼ぶ人もいますが、Marinaraの画面では**Game Mode**と**Storyboards**(絵コンテ)というラベルが付いています。

以下の設定は、**Krea 2**による最初のフレームの生成と、自然言語のImage Style **Z-Image Turbo Narrative**を前提に作りました。説明的な自然言語のシーンプロンプトを受け付ける画像接続であれば、ほかの接続でも動作します。LTXの動画レンダリングはローカルのComfyUIで実行します。最初のフレームの生成がローカルかホスト型かは、選んだ画像接続によって決まります。

完成した処理の流れは次のとおりです。

```text
GM narration
  -> Animation Planner
     -> imagePrompt -> image connection -> first-frame illustration
     -> narrationBeat -> Narration Passthrough -> %prompt%
  -> first frame + prompt -> ComfyUI LTX 2.3 workflow -> MP4 clip
```

生成された挿絵が、そのままクリップの最初のフレームになります。つまりLTXは、映像の出発点と、次に何が動くかに集中したプロンプトの両方を受け取ります。

## 始める前に

必要なものは次のとおりです。

1. Marinaraから到達できる、動作中のローカルComfyUI環境。
2. 編集可能な`ltx-director-simple`ワークフロー、またはComfyUI内で最後まで完走する同等のLTX 2.3 image-to-videoグラフ。
3. Marinaraの接続用に書き出した、API形式の`ltx-director-simple-api`。
4. 最初のフレームの挿絵を作るためのMarinaraの画像生成接続。
5. **Agents > Download Agents**からインストールし、**Chat Settings > Agents**でゲームに対して有効にした**Storyboard**エージェント。

編集可能なComfyUIワークフローと、そのAPI書き出しは別々のファイルです。ComfyUIで`ltx-director-simple`を開き、ComfyUI Managerが不足を報告したカスタムノードをすべてインストールしてから、その場でグラフを試します。Marinaraの接続には`ltx-director-simple-api`を読み込みます。ノードやモデルを変更したときは、そのつどAPI形式で書き出し直し、接続に保存されているJSONを置き換えてください。通常のビジュアルエディター用ワークフローをMarinaraに貼り付けてはいけません。

書き出しと接続の一般的な手順は[ComfyUIワークフローの設定](../media/comfyui.md)を参照してください。

## LTX 2.3のモデルを選ぶ

モデルの形式は、GPUのアーキテクチャーと、ComfyUIがテキストエンコーダー、VAE、アップスケーラーを読み込んだあとに残るメモリー量に合わせて選びます。以下はあくまで出発点であり、どのワークフローでもそのカードに収まるという保証ではありません。

| GPUの世代 | 実用的な出発点 | 備考 |
| --- | --- | --- |
| RTX 30 series (Ampere) | INT8 ConvRot | 3070、3080、3090クラスのカード向けの省メモリーな出発点です。 |
| RTX 40 series with 16-24 GB | FP8 input-scaled | Ada世代のハードウェアで使える高速なFP8経路を利用します。 |
| RTX 40 series with 8-12 GB | FP8のオフロードが遅すぎる場合はINT8 ConvRot | 実際のワークフローで両方を比べます。使えるVRAMの量とオフロードの挙動も影響します。 |
| RTX 50 series (Blackwell) | NVFP4 dev workflow | NVFP4に対応したComfyUI、CUDA、ノード一式が必要です。 |
| 既存のdistilledワークフローを使うRTX 50 | FP8 input-scaled | 公式のdistilled NVFP4チェックポイントが出るまでは、この互換経路を使います。 |

動作を確認したRTX 3080のワークフローでは、次のファイルを使っています。

```text
ltx-2.3-22b-distilled-1.1_transformer_only_int8_convrot.safetensors
```

これらの接尾辞は量子化の形式と実行経路の違いを表すもので、いつでも差し替えられる品質プリセットではありません。

- **INT8 ConvRot**は、RTX 30系のカードや小容量のAdaカード向けに、コミュニティで実用的とされている省メモリー経路です。
- **FP8 input-scaled**は、おおむねRTX 40系以降のNVIDIAハードウェアで高速なFP8行列演算を使います。
- **NVFP4**は、RTX 50系のワークフローが使うBlackwell専用の4ビット経路です。
- **Dev**と**distilled**のワークフローは、サンプリングの前提が異なります。添付のdistilledグラフにdevチェックポイントを入れる場合は、ワークフロー側もそれに合わせて変更してください。

8 GBのカードでは、最初の統合テストは480pとキーフレーム1枚から始めてください。チェックポイントが収まっても、長い動画や高解像度の動画が収まるとはかぎりません。動画のlatent、テキストエンコーダー、VAE、音声、アップスケールもメモリーを使うからです。

公式の入門ワークフローは、次のコンポーネントを使います。

- `ltx-2.3-22b-dev-fp8.safetensors`
- `ltx-2.3-22b-distilled-lora-384.safetensors`
- `gemma_3_12B_it_fp4_mixed.safetensors`
- `ltx-2.3-spatial-upscaler-x2-1.1.safetensors`

独自のワークフローでは、distilled v1.1のチェックポイント、サードパーティー製の量子化、別のローダーノード、別のモデルフォルダーを使うこともあります。APIワークフローに保存されたファイル名は、ComfyUIから見えるファイルと完全に一致していなければなりません。

公式の資料は次のとおりです。

- [LTX 2.3 image-to-video guide](https://docs.ltx.io/open-source-model/usage-guides/image-to-video)
- [LTX prompting guide](https://docs.ltx.io/open-source-model/usage-guides/prompting-guide)
- [LTX 2.3 model card](https://huggingface.co/Lightricks/LTX-2.3)
- [LTX 2.3 NVFP4 model card](https://huggingface.co/Lightricks/LTX-2.3-nvfp4)
- [Official LTX 2.3 ComfyUI examples](https://github.com/Lightricks/ComfyUI-LTXVideo/tree/master/example_workflows/2.3)
- [Community ComfyUI-separated and FP8 weights](https://huggingface.co/Kijai/LTX2.3_comfy)

## ComfyUIのAPIワークフローを準備する

まず、編集可能なワークフローを実際のソース画像と簡単なプロンプトでComfyUIから直接実行します。音声付きのMP4が保存されることを確認してから、そのAPI書き出しをMarinara向けに調整してください。

Marinaraのシンプルな経路では、LTX Directorのグローバルプロンプト入力に完成したプロンプトを1つだけ渡します。

```json
{
  "global_prompt": "%prompt%",
  "local_prompts": "",
  "segment_lengths": ""
}
```

LTX Directorノード自体は、画像のコンディショニング、ガイドデータ、音声、2段階のサンプリングを引き続き扱ってかまいません。「シンプル」なのはプロンプトの受け渡し方です。MarinaraはPrompt Relayのタイムラインではなく、image-to-video用のまとまった段落を1つ送ります。

### 必要なプレースホルダー

API書き出しの該当する値を、引用符付きのMarinaraのプレースホルダーに置き換えます。

| プレースホルダー | 渡される値 |
| --- | --- |
| `%prompt%` | 選択した絵コンテのAnimation Plannerと動画テンプレートが作った完成プロンプト |
| `%reference_image_name%` | ComfyUIにアップロードされた最初のフレームの画像 |
| `%duration_seconds%` | 絵コンテのクリップの長さ(秒) |
| `%length%` | Marinaraの16 FPSというフレーム規約に換算した長さ |
| `%fps%` | Marinaraがそのクリップに使うフレームレート |
| `%width%`, `%height%` | 動画接続の解像度とアスペクト比から決まる寸法 |
| `%seed%` | そのリクエスト用に新しく作られた乱数シード |
| `%model%` | ワークフローがローダーのモデルを直接書き込んでいない場合に、接続から渡される任意のモデル値 |

参照画像は、LTX Directorの`timeline_data`にある`segments`配列の中に置きます。APIワークフローでは、`timeline_data`はJSONを文字列にしたものです。`%length%`は`normalDurationFrames`を通じてクリップの長さを可変に保ちます。フレーム0の参照画像セグメントだけは、意図的に固定の短い`"length":16`を保持します。

```json
{
  "timeline_data": "{\"global_prompt\":\"\",\"normalStartFrame\":0,\"normalDurationFrames\":%length%,\"segments\":[{\"id\":\"marinara-reference\",\"start\":0,\"length\":16,\"prompt\":\"\",\"type\":\"image\",\"imageFile\":\"%reference_image_name%\",\"isEndFrame\":false}],\"motionSegments\":[],\"audioSegments\":[]}"
}
```

`%reference_image_name%`を`timeline_data`と並べて置いたり、トップレベルの別の画像項目に置いたりしないでください。フレーム数、秒数、フレームレートは`%length%`、`%duration_seconds%`、`%fps%`でワークフローの外部入力につないだままにします。編集可能なComfyUIグラフに表示されている数値は、Marinaraのデフォルトではありません。

`%reference_image_name%`のような文字列のプレースホルダーは、引用符で囲んだままにします。数値を厳密に扱うノード入力では、`%length%`、`%duration_seconds%`、`%fps%`を引用符で囲んでもかまいません。Marinaraが数値に変換するからです。ただし、文字列化された`timeline_data`の中では、上の例のとおり`%length%`を引用符なしのままにします。こうするとデコード後のタイムラインの値が数値になります。

### 編集のたびに書き出す

1. 編集可能なワークフローをComfyUIで実行します。
2. 現在のグラフから再生できるMP4が作られることを確認します。
3. **Save (API Format)**、**Export (API)**、**Export to API**のいずれかを選びます。
4. 新しいAPI JSONにプレースホルダーを追加するか、入っているか確認します。
5. Marinaraの接続に保存されているワークフローを置き換えます。

ノードを削除したまま古いAPI書き出しを使い続けると、すでに存在しないノードへの参照が残ります。この場合、ComfyUIは生成を始める前にリクエストを拒否します。

## Marinaraの動画接続を作る

1. **Settings**(設定)を開き、**Connections**(接続)に進みます。
2. **Video Generation**(動画生成)の接続を追加します。
3. **ComfyUI**を選びます。
4. ComfyUIのベースURLを入力します。同じコンピューターで動かしている場合は通常`http://127.0.0.1:8188`です。
5. API形式のワークフロー全体を**ComfyUI Workflow**欄に貼り付けます。
6. 最初の省VRAMテスト用に、デフォルトの長さを6秒、**16:9**、480pにします。
7. 接続を保存します。

テキストだけの接続テストでは`%reference_image_name%`を試せません。接続を保存したあと、Galleryの画像か絵コンテからimage-to-videoを実際に確かめてください。

## Game Modeのチャットを設定する

Game Modeのチャットを開き、**Chat Settings**(チャット設定)から**Agents**を選びます。以下のセクションを設定する前に、**Enable Agents**(エージェントを有効にする)と**Enable Storyboards**(絵コンテを有効にする)をオンにしてください。新規Gameの設定ウィザードにあるStoryboard Optimizedの演出では、エージェントは有効になりません。

### Illustrator

| 設定 | 推奨値 |
| --- | --- |
| **Game Illustrator** | On |
| **Image Connection** | **Krea 2** |
| **Image Style** | **Z-Image Turbo Narrative** |
| **Use Campaign Art Style** | Off |
| **Attach Card Appearance** | Off |
| **Send Avatar References** | この検証済みワークフローではOff |

Animation Plannerは絵コンテのターンのキャラクターの外見情報をすでに受け取っています。そのため、この構成では最終的な画像整形のときに同じ情報が重ねて付かないよう、**Attach Card Appearance**をオフにしています。**Storyboard First Frame**も、Plannerが仕上げたT=0のシーンにキャンペーンのアートディレクションを重ねて書き足しません。

**Send Avatar References**が制御するのは、最初のフレームを作る画像プロバイダーに送る参照画像で、LTXの最初のフレームの入力ではありません。LTXは完成した絵コンテの挿絵を`%reference_image_name%`経由で受け取ります。この検証済みのKrea構成ではアバターの参照をオフのままにして、選んだ画像接続がそれに対応していて効果もあると確認できてから、あらためて有効にしてください。

最初のフレームの画像は、動きの品質を大きく左右します。計画された動きが始まる直前の瞬間を写し、被写体、動く経路、手、扉、小道具、対象がはっきり見えている必要があります。

### Scene Videos

| 設定 | 推奨値 |
| --- | --- |
| **Video Connection** | 上で作成したLTX 2.3のComfyUI接続 |
| **Game Video Prompt** | **Narration Passthrough** |

全体設定の**Game Video Prompt**は、Galleryからの手動生成とGame Assetsのアニメーションを制御します。絵コンテのクリップは、それらの動作を変えずに独自のプロンプトを選べます。

### Storyboards

まずは次の設定から始めてください。

| 設定 | 推奨する初期値 |
| --- | --- |
| **Automatic Storyboard Illustrations** | On |
| **Automatic Storyboard Animations** | On |
| **Use NovelAI Character Prompts** | Off |
| **Keyframes per Turn** | 通常は3。最初の8 GB VRAMのテストでは1から始めます |
| **Animation Clip Duration** | 5秒 |
| **Viewer Display** | テスト中はFloating |
| **Illustration Planner** | **Still Keyframes**。静止画だけのときの受け皿として残します |
| **Animation Planner** | **LTX Simple Image-to-Video** |
| **Use Storyboard Template** | On |
| **Storyboard Illustration Prompt** | **Storyboard First Frame** |
| **Storyboard Video Prompt** | **Narration Passthrough** |

デフォルトとしておすすめなのは**LTX Simple Image-to-Video**です。動かしやすい最初のフレームを1枚と、4から8文の率直な動きのプロンプトを1つ組み立てます。主となる動作を1つ、カメラの動きを1つに絞り、環境の動きは控えめにして、必要な音や短いせりふを添える作りです。

**LTX Director Storyboard**も上級者向けの選択肢として残っています。長さを意識した細かい演出指示と、つながりを保つためのルールを備えています。シンプルな経路が安定してから、あるいは長いクリップで本当に複数の段階をつなぐ必要が出てきたときに試してください。どちらのPlannerも`%prompt%`という同じワークフローの受け渡し方を使います。

**Illustration Planner: Still Keyframes**は、アニメーションが有効なあいだはKrea用のプロンプトを作りません。アニメーションのモードでは、**LTX Simple Image-to-Video**が両方の出力を作ります。Krea向けの自然言語の`imagePrompt`と、LTX向けの`narrationBeat`です。Still Keyframesを選んだままにしておくのは、動画なしで生成されるターンのためだけです。

**Storyboard First Frame**は、Animation Plannerが作った自然言語のT=0のシーンをそのままKreaへ渡します。キーフレームの見出し、プロンプトのラベル、外見の説明の繰り返し、キャンペーンのアートディレクションは足しません。この整形が実際に働くように、**Use Storyboard Template**はオンのままにしてください。

**Narration Passthrough**は意図的に小さく作られています。Animation Plannerが仕上げた`narrationBeat`を、共通の動画プロンプトの受け渡し方に沿って渡すだけで、シーンの説明を重ねて付けることはありません。

キーフレーム1枚につき、Kreaの画像ジョブが1件と、ローカルのLTX動画ジョブが1件走ります。キーフレームが3枚なら、最初のフレームのレンダリングが3回、動画のレンダリングも3回始まります。VRAMが8 GBのGPUでは、480pでキーフレーム1枚から始めてください。それが成功したら、キーフレーム3枚とより高い解像度へ進みます。

## 最初のテストを実行する

扉を開ける、音のするほうを見る、数歩進む、短いせりふを1つ言うといった、目に見える動作が1つ含まれる完了済みのGMのターンを使います。

1. 省VRAMでいちばん手早く確認するには、**Animation Clip Duration**を5秒のままにして、**Keyframes per Turn**を一時的に1にします。通常の検証済み構成はキーフレーム3枚です。
2. 現在のGMのターンがすでに完了してから、絵コンテの自動設定を2つともオンにします。
3. Galleryを開き、その完了済みのGMのターンに対して**Create storyboard**を選びます。こうすると、次のターンを待たずに挿絵からアニメーションまでの流れ全体を手動で開始できます。
4. プロンプトの表示を有効にしている場合は、送信する前に最初のフレームのプロンプトを確認します。
5. 生成された最初のフレームが、動きの出発点として実際に使えるポーズになっているか確認します。
6. 最初のフレームのレンダリングと、続くComfyUIのクリップが終わるまで待ちます。
7. 手動の経路がうまくいったら、**Keyframes per Turn**を3に戻し、以降のターンのために自動設定は2つともオンのままにします。

設定中は**Floating**の表示モードを使うと、画像とクリップを1つずつ確かめやすくなります。ワークフローが安定してから、絵コンテのメディアをGame Modeのシーンに溶け込ませたい場合は**Background**に切り替えてください。

## プロンプトの受け渡しの仕組み

キーフレームごとに、Animation Plannerは次の2つを返します。

- `imagePrompt`: 時刻T=0で見えている最初のフレームだけを書いたもの。
- `narrationBeat`: 次に何が起きるかを書いた、完全なLTXのimage-to-videoプロンプト。

選択したAnimation Plannerが、この両方の項目を書きます。**Storyboard First Frame**が`imagePrompt`を整形し、自然言語のT=0のシーンをKrea 2に送ります。画像ができると、**Narration Passthrough**が`narrationBeat`を解決します。Marinaraはそれを通常の動画リクエストの`prompt`項目に入れ、ComfyUIワークフローの`%prompt%`を置き換え、最初のフレームをアップロードし、`%reference_image_name%`をComfyUI上のファイル名に置き換えます。

ローカルのプロンプトセグメントを2つ作る必要はありません。これらの絵コンテのプリセットでは、グローバルプロンプトを1つ使うのが通常の形です。

## よいLTXプロンプトの条件

キャラクターの外見、構図、舞台、光、色調、質感は、すでにソース画像が表しています。動画のプロンプトは動きに集中させてください。

- 現在形で書いた、流れのある段落を1つ。
- クリップの長さに収まる、焦点の定まった動作を1つ。
- 被写体を基準にして書いたカメラの動き。
- 視線、表情、姿勢、呼吸、しぐさで見せる反応。
- 環境の動きは、効果のあるものを多くても1つ。
- 必要に応じて環境音、効果音、音楽、引用符で囲んだ短いせりふ。
- 最後は自然な収束、動きの落ち着き、または短い静止。

シーンの切り替え、カット、瞬間移動、無関係な複数の動作、複雑な物理挙動、大人数の振り付け、読み取れる正確な文字、最初のフレームですでに見えている細部の列挙は避けてください。

例:

```text
She pushes the door open and walks outside as the camera follows closely behind her. A light breeze moves her hair while her pace remains steady. She glances toward the empty street and says, "Stay close." Footsteps and distant traffic continue as the camera settles behind her.
```

## 再現できる構成を記録する

「8 GBで動いた」という結果は、チェックポイントだけで決まるものではありません。ワークフローを共有するときは、次の情報を記録してください。

- GPUの正確なモデル名とVRAM容量。
- ComfyUIのバージョンまたはコミット。
- NVIDIAドライバー、CUDA、PyTorch、Pythonのバージョン。
- 必要なカスタムノードのパッケージとそのバージョン。
- モデルの正確なファイル名と、置いてあるComfyUIのフォルダー。
- 出力解像度、長さ、キーフレーム数、おおよそのレンダリング時間。
- その構成でKrea 2をローカルで動かしたのか、ホスト型の画像接続を使ったのか。

添付のAPI JSONには、ノードID、モデルのパス、入力名のスナップショットが保存されます。`LTX2/`のように別のフォルダーへモデルを置いている場合は、ローダーの値を書き換えてAPI形式で新しく書き出し直す必要があります。作者の環境で動くワークフローでも、カスタムノードやモデルのパスが違えば別の環境では失敗することがあります。

## トラブルシューティング

### ComfyUIがHTTP 400または「Prompt outputs failed validation」を返す

APIワークフローが、現在インストールされているグラフと一致していません。削除されたノード、宙に浮いたノードID、不足しているカスタムノード、ノードのアップデートで名前が変わった入力、すでに存在しないモデルのファイル名を探してください。動作しているComfyUIのグラフから、API形式で新しく書き出し直します。

### 画像はできるが動画ができない

**Automatic Storyboard Animations**と、Game Modeの**Video Connection**を確認します。アニメーションには、最初のフレームの挿絵と、選択済みの動画接続の両方が必要です。

### LTXに開始画像が渡らない

保存済みのAPIワークフローに`%reference_image_name%`があり、LTX Directorの画像セグメントにつながっているか確認します。Marinaraは、このプレースホルダーがある場合にだけ最初のフレームをアップロードします。

### クリップが崩れる、キャラクターが変わる、破綻する

**LTX Simple Image-to-Video**に戻し、キーフレームを1枚にして、動作が1つだけのターンで試します。1枚のソース画像が、短い連続したクリップの中で複数の場所、ポーズ、結末にきれいに変わることはできません。最初のフレームも確認してください。出発点のポーズがわかりにくいと、よい動きのプロンプトを書いてもアニメーションの難易度は上がります。

### どの生成結果も似すぎている

ワークフローに直接書き込まれたサンプリングのシードを`%seed%`に置き換えます。よい結果が出たあと、プロンプトやサンプリングの変更を比べるときにだけ、そのシードを一時的にワークフローに固定します。

### 生成中にメモリーが足りなくなる

まず480pから始めます。必要なら次にクリップの長さを短くします。テスト中は1ターンあたりキーフレーム1枚にとどめ、ほかのGPUアプリを閉じ、VRAMの少ない同じGPUにローカルの言語モデルを読み込んだままにしないでください。量子化したチェックポイントはモデルが使うメモリーを減らしますが、動画のlatent、テキストエンコーダー、VAE、音声、アップスケールが使うメモリーはなくなりません。

### Marinaraが待機をやめてもComfyUIがレンダリングを続ける

ブラウザーのリクエストを閉じたりクライアントの接続が切れたりすると、ComfyUIにすでに登録されたジョブは取り消されないまま、Marinara側のポーリングだけが止まることがあります。同じレンダリングをやり直す前に、ComfyUIのキュー、履歴、出力フォルダーを確認してください。

### ComfyUIでは動くのにMarinaraからは失敗する

保存済みの接続のJSONと、最新のAPI書き出しを比べます。ベースURL、プレースホルダーのつづり、必要なカスタムノード、モデルのパス、出力ノード、寸法、長さの項目を確認してください。編集可能なグラフが動いていても、Marinaraが古い書き出しを保持したままのことがあります。

サーバーの詳しいトレースを見るには、デバッグログを有効にして`[debug/game/storyboard-video]`と`[video-gen/comfyui]`を探します。正常なリクエストでは、完成したグローバルプロンプト、アップロードした参照画像のファイル名、長さ、フレーム数、ComfyUIに登録されたプロンプトIDが表示されます。

## 関連ガイド

- [Storyboardエージェントガイド](storyboard.md)
- [ComfyUIワークフローの設定](../media/comfyui.md)
- [シーン動画の生成](../media/scene-video.md)
- [Game Mode: はじめに](getting-started.md)
