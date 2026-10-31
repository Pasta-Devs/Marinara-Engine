# Game Modeのアーキテクチャー: ルールセット、判定、戦闘

Game Modeのルールに関するコードを変更する際の案内です。ルールセットを読み取る場所、判定と戦闘を解決する仕組み、状態を保持する場所、新しいルールセットキーに必要なものを説明します。プレイヤー向けドキュメントは`docs/game/`にあり、ルールセット作者向けガイドは[`docs/extending/writing-rulesets.md`](../extending/writing-rulesets.md)から始まります。戦闘AIには専用のページ、[Game Modeの戦闘AI](game-combat-ai.md)があります。

## 各要素の配置

| 領域 | コード |
| --- | --- |
| ルールセットの形式 | `packages/shared/src/schemas/ruleset.schema.ts`: zodスキーマ、`RulesetRef`(固定情報)、インポート時に実行する相互検証です。エディター用のJSON Schemaである`docs/extending/ruleset.schema.json`は、`pnpm ruleset:schema`でこのスキーマから生成します。 |
| Capability API | `packages/shared/src/schemas/capability-package.schema.ts`内の`supportedCapabilityApi`です。マイナーバージョンごとに、追加内容を記したコメント行があります。 |
| シートの計算とライブステート | `packages/shared/src/features/rulesets/`: `sheet-math.ts`、`live-state.ts`(`[sheet:]`操作)、`sheet-commands.ts`、`sheet-builder.ts`、`layers.ts`、`item-*.ts`、`loot.ts`、`market.ts`、`combat-bridge.ts`(`battle`ブロック)です。 |
| ルールセットの戦闘 | `packages/shared/src/features/ruleset-combat/`: `resolve.ts`、`options.ts`(メニューの内容)、`grid.ts`、`sight.ts`、`zones.ts`、`creatures.ts`、`pool.ts`、`symbols.ts`、`dice.ts`です。すべて`(definition, state)`に対する純粋な処理です。 |
| Marinara独自の戦闘 | `packages/shared/src/features/tactical-combat/`(Tacticalのエンジン、グリッド生成、AI)、`combat-director.ts`、`combat-conditions.ts`です。 |
| 戦闘AI | `packages/shared/src/features/combat-ai.ts`、`combat-minds.ts`です。[Game Modeの戦闘AI](game-combat-ai.md)を参照してください。 |
| サーバー: ルールセット | `packages/server/src/services/game/ruleset-registry.service.ts`(インストール済みとインポート済みのルールセットを読み取り、ゲームの固定情報を解決)、`ruleset-catalog.service.ts`、`ruleset-sheet-turn.service.ts`(ターンの`[sheet:]`コマンドを適用)、`game-ruleset-version.service.ts`、`routes/game-rulesets.routes.ts`です。 |
| サーバー: 判定とダイス | `skill-check-resolution.service.ts`、`skill-check.service.ts`、`dice.service.ts`、`dice-pool.service.ts`、`one-request-dice.ts`、`dice-rng.ts`です。 |
| サーバー: 戦闘 | `combat-director.service.ts`(ClassicとTactical)、`combat.service.ts`(Classicのラウンド計算、`resolveCombatRound`)、`ruleset-combat-director.service.ts`(ルールセットが解決する戦闘)、`combat-ai.service.ts`、`combat-boss.service.ts`、`tactical-battlefield.service.ts`、`made-battlefield.service.ts`です。ルートは`routes/combat-director.routes.ts`(ディレクターの開始、状態、コマンド)、`routes/encounter.routes.ts`、および`routes/game.routes.ts`にある旧来の`POST /game/combat/round`、`/game/combat/tactical/start`、`/game/combat/tactical/action`です。 |
| プロンプト | `gm-prompts.ts`(`buildGmFormatReminder`、シートのブロック、モデルに教えるタグ)です。 |
| クライアント | `packages/client/src/components/game/`: `GameRulesetSheet.tsx`、`GameSetupRulesChooser.tsx`、`RulesetCombatScreen.tsx`とその他の`RulesetCombat*.tsx`、`TacticalCombatUI.tsx`、`GameCombatUI.tsx`、`DirectedCombatUI.tsx`です。 |

## パッケージからゲームに至るルールセットの流れ

1. **供給元。** 公式ルールセットは、種類が`ruleset`のCapabilityパッケージです。`contributions.assets.paths`に`ruleset.json`(および任意の`catalogs/<id>.json`)を記載し、`files[]`でハッシュ固定します。コミュニティーのルールセットは、単一ファイル、`<name>.ruleset.json`パッケージファイル、またはリポジトリーの`rulesets/`フォルダーからインポートします。名前空間付きID(`local/<id>`、`<owner>/<id>`)で保存するため、公式ルールセットを覆い隠すことは決してありません。
2. **言語。** 公式ルールセットの翻訳は、そのカタログエントリーに記載された言語別パックです。パッケージマネージャーはEngineの言語のものだけを保持します(`package-manager.service.ts`内の`syncRulesetLocalePack`)。インポートしたパッケージファイルでは、インポート時に有効な言語だけを保持します。
3. **レジストリー。** `ruleset-registry.service.ts`は共有スキーマで各定義を解析し、使用できない定義はログ行を出して除外します。定義はIDとバージョンで保存します。同じバージョンでバイト列が異なるものは拒否します。
4. **固定情報。** ゲーム作成時に`chat.metadata.gameRuleset`を一度だけ書き込みます。内容は`{ id, version, packageId, source?, options }`で、`options`には選択したレイヤーを保持します。固定情報がなければMarinara独自のルールになります。このインストール環境で固定情報を満たせない場合(存在しない、または固定バージョンより古い場合)はその旨を報告し、ゲームの判定は未解決のまま保持します。別システムのルールで解決することは決してありません。

## 状態

| 要素 | 内容 | 保存先 | スワイプで巻き戻るか |
| --- | --- | --- | --- |
| 初期ビルド | プレイヤーがカードまたはペルソナに記入するシート | カードの`data.extensions.rulesetSheets[rulesetId]`、ペルソナの`personaStats.rulesetSheets[rulesetId]` | 該当なし |
| ゲームのビルド | 設定時に作成するコピー。**Edit sheet**(シートを編集)とレベルアップで編集 | `chat.metadata.gameCharacterCards[].rulesetSheet` | いいえ |
| ライブステート | プール、トラック、状態、ステート、メモ | `game_state_snapshots.ruleset_live` | はい |
| 戦闘 | 遭遇、シードとダイスカーソル、誰のターンか | 戦闘ディレクターの保存行。チャットごとに一行 | 戦闘を開始したターンとともに復元 |

ライブステートはスナップショットに属するため、ターンを再生成しても二重に消費しません。保存されるシートは`{ v, build }`で、上限(64 KB)があり、許容的に読み取ります。不明なフィールドは保持し、不足するフィールドにはデフォルトを適用します。値を新しいIDに移すレイアウトは`sheet.migrations`を宣言します。これは読み取り時に`readRulesetSheetEnvelope`と`readStoredLiveState`が適用します。インストールされていないルールセットのシートは休眠状態で保持し、削除することは決してありません。

## 判定の全体の流れ

1. Game Masterが`[skill_check: …]`を書き込み、任意で`who=`、`with=`、ラダーのステップ名、チャーム、消費指定を添えます。一回リクエストのダイスがオンの場合は、代わりに分岐ブロックや`[[roll: …]]`プレースホルダーを書き込むこともできます(`one-request-dice.ts`)。
2. `skill-check-resolution.service.ts`が固定されたルールセットを読み取り、`resolution.kind`に応じて`dice-sum`、`dice-pool`、`dice-highest`、`roll-against`、`symbol-pool`に処理を振り分けます。モデルが書き込んだ数値は監査し、ルールセットが保証する場合を除いて置き換えます。プール、採用するダイス、段階別の結果は、決して保証の対象になりません。
3. ダイス: 判定では`rollDieSecurely`(`packages/shared/src/utils/dice-notation.ts`内のWeb Cryptoによる処理)でダイスを振ります。ルールセットの戦闘、そのアイテムの使用、戦利品、市場では、同じモジュールの`seededDieRoller(seed, cursor)`でダイスを振るため、戦闘をシードから再現できます。#8608以降、これ以外のダイス処理はありません。
4. 結果は完全なタグとダイスカードとして書き戻し、**Logs**(ログ)に記録します。

## シートコマンド

Game Masterは`[sheet: who="Name" op="…"]`でシートを変更します。タグに記述できる操作は`spend`、`restore`(別名`heal`)、`damage`、`temp`、`track`、`condition`、`state`、`note`、`rest`、`use`(別名`cast`)、`pass`、`advance`、`dismiss`、`prepare`、`unprepare`です(`live-state.ts`内の`RULESET_SHEET_OP_NAMES`と`RulesetSheetOp`)。`ruleset-sheet-turn.service.ts`はそれぞれを現在のシートに照らして検証します。スロットが残っていない呪文の発動など、実行できない操作は拒否し、ログに記録してターンごとに一度通知します。途中まで適用されることはありません。`sheet`は予約済みのGMタグです。

## 戦闘の全体の流れ

ゲームの戦闘は、ルールセットとゲームの**Combat Preference**(戦闘の好み)に応じて選ばれる、三種類の形式のいずれかで行います。

| ルールセット | 形式 | サーバー |
| --- | --- | --- |
| なし、または`battle`/`combat`ブロックなし | MarinaraのClassicまたはTacticalの戦闘 | `combat-director.service.ts` |
| `battle`ブロック | シートのプール、スロット、カタログのスキルを借りて使うMarinaraの戦闘。体力は最大値に対する割合で引き継ぎ、書き戻す | `combat-director.service.ts`と`combat-bridge.ts` |
| `combat`ブロック | ルールセット独自の戦闘。`combat`がマスの距離を指定し、ゲームがTacticalの場合は盤面上で行う | `ruleset-combat-director.service.ts` |

三種類とも、ディレクターの台帳を共有します。チャットごとに一つの保存行、一つのリビジョン、リクエストIDによるガード、チャット単位のキューです。台帳の対象は、ディレクターが管理する戦闘だけです。`game.routes.ts`にある旧来のルート、`POST /game/combat/round`(受け取った戦闘参加者に対して`resolveCombatRound`を呼び出す)、`/game/combat/tactical/start`、`/game/combat/tactical/action`は台帳を保持しません。クライアントが戦闘の状態を保持し、呼び出しのたびに送り返します。ルールセットの戦闘では、メニューが合法性を決め(`options.ts`)、リゾルバーが選択を適用し(`resolve.ts`)、ダイスは戦闘のシードとカーソルから生成します。パーティーメンバーが消費したものや失ったものはすべてシート自体のルールを通じて書き込むため、戦闘中にタブを閉じても何も失われません。誰も記述していない相手は、ルールセットのクリーチャー図鑑と遭遇の行動枠から構築します。Game Masterは、Engineが順位付けした提案から選び、名前付きの相手やボスを操作できます。

## ルールセットキーの追加

1. 相互検証とともに`ruleset.schema.ts`に追加し、リゾルバーが読み取るTypeScriptの型にも追加してください。
2. `supportedCapabilityApi`をマイナーバージョン一つ分上げ、コメント行を追加してください。このキーを使用するルールセットが、そのマイナーバージョン以降を宣言しなければならないように制限してください。
3. まず純粋な共有コードに実装し、次にサーバー、その次にクライアントを接続してください。
4. `pnpm ruleset:schema`を実行し、`docs/extending/ruleset.schema.json`を再生成してください。
5. 作者向けガイドの該当ページ(`docs/extending/ruleset-*.md`)に記載し、プレイヤーの目に触れる場合はプレイヤー向けドキュメントにも記載してください。
6. 拒否される入力も含めて純粋なコードを通じて動かす`scripts/regressions/*.regression.ts`を追加してください。
7. 変更した英語ページを、オープン中の`[docs-i18n]`のIssueに列挙してください。

`docs/development/ruleset-5e-2014.example.json`は、5eのドラフトを簡略化したもので、何百もの回帰テストとエンドツーエンドテストがフィクスチャーとして読み取ります。出荷されるSRDパッケージではありません。そのパッケージはMarinara-Agentsの`packages/ruleset-5e-2014/`にあります。

## 未完了の作業

- ルールセットの盤面で障害物を飛び越える移動。飛行できるものも、ほかと同じように移動します。
- Marinara独自のClassicとTacticalの戦闘における召喚(ルールセットの戦闘ではすでに召喚できます)。設計は[Game Modeの戦闘AI](game-combat-ai.md#summoning-design-extension)にあります。
- 戦闘の地形概要を用意するBattlefield Scout Agent。[Game Modeの戦闘AI](game-combat-ai.md#encounter-environment-agent-handoff)で説明しています。
