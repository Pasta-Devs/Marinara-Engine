# Illustratorエージェント

このガイドでは、チャットの最中にシーンの絵を描いてくれる組み込みのエージェント**Illustrator**を説明します。何をするエージェントなのか、オンにする手順、選べる画風、そして必要になる2つの接続がわかります。

## Illustratorエージェントの役割

エージェントとは、1つのチャットの中で自動的に動く小さなAIヘルパーです。**Illustrator**は後処理型のエージェントで、AIが返信を書き終えたあとに動きます。直前の返信を読み、その場面が絵にする価値のある瞬間かどうかを判断します。価値があると判断したときは、画像プロンプトを書いて画像プロバイダーに送ります。プロンプトとは、何を描くかを画像モデルに伝える文章です。

Illustratorはすべてのメッセージを絵にするわけではありません。デフォルトでは、1枚生成したあと、採用されたメッセージ(自分の入力とAIの返信)が5件たまるまで次の生成を行いません。同じ返信をスワイプしたり再生成したりしても、この間隔は進みません。絵にする場面ではないと判断したときは、その返信を飛ばして画像を作りません。生成した画像はすべてチャットの**Gallery**(ギャラリー)に保存します。

Illustratorは**Roleplay**と**Game Mode**のチャットで使えます。さらに、インストールするとConversationの自撮り写真も使えるようになります。アプリ内の短い説明は「Responsible for image and video generations.」です。このガイドで扱う設定手順と項目はRoleplayのチャット向けです。Game Modeでは代わりにスイッチが1つあるだけで、詳しくは後半のGame Modeの節で説明します。

## 始める前に

Illustratorが書くのは画像プロンプトまでです。実際に絵を描くには、別途、画像用の接続が必要です。画像の接続とは、OpenAIやローカルのStable Diffusionサーバーなど、画像プロバイダーへの接続情報をまとめて保存したものです。

まず画像の接続を用意します。Illustratorに接続を渡す方法は2つあります。

1. 画像の接続を1つデフォルトに指定します。**Connections**(接続)パネルを開き、**Defaults**(デフォルト)を展開して、**Images**(画像)の下で選びます。
2. または、Illustrator専用の画像の接続をフル設定画面から指定します(後述の**Open Setup**(設定を開く)を参照)。

画像の接続が1つも見つからない場合、画像の生成は失敗し、アプリが接続の選択を求めます。プロバイダーを追加する手順は[画像生成プロバイダーと設定](image-providers.md)を参照してください。

## Illustratorをオンにする

Illustratorはデフォルトでオフです。**Roleplay**のチャットでは、次の手順で追加します。

1. 絵を付けたいチャットを開きます。
2. 歯車アイコンから**Chat Settings**(チャット設定)を開きます。
3. **Agents**(エージェント)セクションを探し、**Enable Agents**(エージェントを有効にする)をオンにします。
4. **Misc Agents**(その他のエージェント)グループで**Illustrator**を見つけ、プラスボタンで追加します。

これで、専用の設定項目を持つ**Illustrator**の設定カードが表示されます。エージェントを追加すると1ターンあたりのトークン消費とAI呼び出しが増えるため、パネルには概算コストが表示されます。

### Game Mode: Game Illustratorのトグル

Game Modeでは上記の手順を使わず、**Prompt Mode**や**Prompt Model**の項目も表示されません。代わりに、ゲームの**Chat Settings**を開き、**Game Illustrator**(ゲームのイラスト生成)というトグルを1つオンにします。説明文は「Auto-generate scene illustrations, NPC portraits, and location backgrounds during gameplay.」です。

## プロンプトモード

**Prompt Mode**(プロンプトモード)の選択肢は、Illustratorが書くすべてのプロンプトの画風を決めます。エージェントのカード上では、この選択肢のラベルは**Prompt**です。すぐ下には「Prompt mode controls how Illustrator writes image prompts for this chat.」という短い説明が表示されます。

選べる画風は次のとおりです。

- **Illustration**(イラスト): 仕上げの整った1枚絵です。汎用の画風です。
- **Comic Page**(コミックページ): コマ割り、吹き出し、キャプション、効果音のあるコミックのページです。
- **Colored Manga**(カラー漫画): 様式化された吹き出しと効果音のあるカラーの漫画シーンです。
- **B&W Manga**(白黒漫画): ペン入れの線とスクリーントーンで陰影を付けた白黒の漫画ページです。
- **Background**(背景): キャラクターの写り込まない、場所や情景を示すカットです。
- **Selfie**(自撮り写真): キャラクターになりきった自撮り写真、または気取らない人物写真です。

追加したばかりのIllustratorエージェントは**Background**の画風から始まります。画風はいつでも選び直せます。最終的な絵の雰囲気はスタイルプロファイルにも左右されます。設定方法は[画像スタイルプロファイル](style-profiles.md)を参照してください。

## Prompt Modelと画像の接続

Illustratorは2種類の接続を使います。混同しないように整理しておきます。

**Prompt Model**(プロンプトモデル)は、画像プロンプトを書くテキストモデルです。絵を描くモデルではありません。Illustratorのカードにある**Prompt Model**ドロップダウンから選びます。デフォルトは**Main chat model**で、チャットが使っている接続をそのまま再利用します。別のモデルにプロンプトを書かせたいときは、ほかのテキストの接続を選びます。

画像の接続は、最終的な絵を描く画像プロバイダーです。「始める前に」で説明したとおり、**Defaults → Images**で指定するか、エージェント専用の設定画面から指定します。

## Attach Card AppearanceとSend Avatar References

Illustratorのカードにある2つのトグルは、キャラクターの見た目を安定させるためのものです。どちらもデフォルトではオフです。

**Attach Card Appearance**(カードの外見情報を添付)は、その場に登場しているキャラクターごとに、保存された外見の記述を画像プロンプトへ追加します。ヘルプの文言は「Append matched character appearance lines to image prompts, using only visible/generated names.」です。キャラクターの設定どおりの姿で描いてほしいときにオンにします。

**Send Avatar References**(アバターを参照画像として送信)は、キャラクターとペルソナのアバター、またはそのスプライトを、参照画像として画像プロバイダーに送ります。ヘルプの文言は「Send matching character and persona avatars or sprites as reference images when the provider supports them.」です。顔立ちや衣装を画像モデルに真似させたいときに役立ちます。参照画像に対応していないプロバイダーもあるため、効果は選んだプロバイダーによって変わります。

## そのほかの設定と手動での実行

Illustratorのカードには**Open Setup**ボタンがあります。押すとエージェントのフル設定画面が開き、実行の頻度を調整したり、専用の画像の接続を指定したりできます。

手動生成専用にするには、**Run Interval**(実行間隔)を**0**に設定します。シーン背景の自動生成を含むIllustratorの自動実行が停止しますが、エージェントはインストールされたままGalleryの操作で利用できます。デフォルトは引き続き**5**です。自動実行を再開するには正の値を設定してください。Illustratorをチャットに追加するときにも0を選べます。

生成を待たずに、その場で1枚描かせることもできます。チャットの**Gallery**を開き、**Illustrate**(イラストを生成)ボタンを押します。Illustratorがすぐに1回だけ動き、処理中はボタンの表示が**Generating...**に変わります。今この瞬間の絵がほしいのに、エージェントがまだ描いていないときに便利です。

## 関連ガイド

- [画像生成プロバイダーと設定](image-providers.md)
- [画像スタイルプロファイル](style-profiles.md)
- [シーン背景とギャラリー](scene-backgrounds.md)
- [エージェント: チャットを支えるAIヘルパー](../agents/agents-overview.md)
- [AIプロバイダーへの接続](../connections/connecting-to-a-provider.md)
