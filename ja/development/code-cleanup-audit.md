# コードクリーンアップ監査

**監査日:** 2026-07-22

**対象ブランチ:** `staging`

**目的:** 実行時の動作を変えずに削除できる不要物と、範囲を限定した簡素化の候補を洗い出します。

**実装状況:** 確度が高く危険の少ない指摘は、同じクリーンアップ変更の中で対応済みです。

## 実装の結果

対応が完了したもの:

- 到達不能なソースモジュール4つ、不要になったサイドカーのビルドスクリプト、テストを1件も実行しないテストランナー、完了済みのタスク指示書を削除しました。
- 到達不能なデバッグパネルのためだけに存在していたデバッグログのバッファーを削除し、ブラウザーのコンソールでの診断は残しました。
- コンパイラーが証明した未使用コードの指摘60件をすべて解消し、クライアントとサーバーで未使用チェックを有効にしました。
- どこからも使われていないクライアントのフック、ヘルパー、型、UI宣言53件を、領域ごとのまとまった単位で削除しました。
- 確度の高い孤立した依存関係8件を削除し、ロックファイル、ワークスペースのインストール確認、トラブルシューティングの記述を修正しました。
- ルートの`pnpm test`が、テスト0件で成功を報告する代わりに、実際のリグレッションを実行するようにしました。
- 既存の絵コンテのキーフレーム選択処理を再利用し、重複していたSpotifyのクエリートークン処理を1つにまとめました。
- プリセット変数の並べ替えを、要求されたプリセットだけに限定しました。これまで無視されていた`presetId`を、整合性の境界として使っています。

互換性や機能面の作業として切り離し、意図的に残したもの:

- `@rollup/wasm-node`。
- ツリー外のAPIやテスト用の差し込み口である可能性があるサーバーのエクスポート。
- PNGパーサーとチュートリアルの座標計算の共通化。
- 広範囲に及ぶエディター/コンポーザーのリファクタリングと、大きなモジュールのリファクタリング。
- 次のメジャーリリースで対応予定の互換性のための項目。

以下の詳細な指摘は、変更前の証拠の記録として残してあります。推奨の文言が残っている箇所については、この実装結果のほうが正となります。

## 検証

実施したクリーンアップは、リポジトリーがサポートする検証レーンをすべて通過しました。

- `pnpm install --frozen-lockfile`
- `pnpm check` (未使用コードのチェック、TypeScript、ESLint、本番ビルド)
- `pnpm test` (すべてのリグレッションレーンとブラウザーのスモークテスト: 81件成功、51件は意図的にスキップ)

汎用のテストコマンドを実態に合わせる過程で、ブラウザーのテスト群からも、画面の状態に依存した要素指定の思い込みが4件見つかりました。該当するテストは、明示的に画面遷移し、モバイル側で重複するコントロールを絞り込み、Noodleのタイムラインのスクロール領域を正しく指定するようになりました。動作を確かめるという本来の目的は弱めていません。

## 概要

リポジトリーは大規模です(追跡対象ファイル1,665件、調査対象としたソース系ファイル形式で約478,000行)。ただし、大きなファイルの多くは明らかな不要物ではなく、現役の製品コードです。もっとも安全なクリーンアップは、大がかりな書き直しではなく、根拠のある小さな削除を積み重ねることです。

当初の監査における最初のクリーンアップ対象は次のとおりです。

- 参照元がまったくないソースモジュール4件(合計899行)。
- 不要になったサイドカーのビルドスクリプト1件(173行)。
- テストを1件も実行しないまま成功するテストランナー1件(54行、およびパッケージスクリプトの設定)。
- リポジトリーのルートに残っていた完了済みのフェーズタスク指示書2件(235行)。
- コンパイラーが証明した未使用の宣言、import、パラメーター、ローカル変数60件。
- 孤立している可能性が高い直接依存8件(クリーンな状態でのインストールとビルドでの確認が前提)。
- 使われていない可能性が高いMariの静止スプライト1件(ブラウザーでのスモークテストでの確認が前提)。

到達不能なモジュール4件、古いスクリプト、何もしないテストランナー、タスク指示書だけで、追跡対象の1,361行に相当します。それでも作業は小さなクリーンアップPRに分けるべきです。そうすれば、削除ごとに根拠が絞られ、元に戻すのも簡単になります。

## 監査の進め方

この監査では、次のような複数の種類の証拠を組み合わせました。

1. 追跡対象ファイル、ファイル形式、主要なソース領域、最大のファイルの一覧化。
2. TypeScriptのASTによるimport/exportの解析(相対importとリポジトリーのエイリアスを含む)。
3. 追跡対象のソース、スクリプト、ドキュメント、マニフェスト、ワークフローを横断した、シンボル名とファイル名の完全一致検索。
4. クライアントとサーバーで`noUnusedLocals`と`noUnusedParameters`を強制的に有効にしたTypeScriptコンパイラーによる調査。
5. 直接依存の検索と、過去のリファクタリングで依存やスクリプトが取り残されたように見える箇所についてのGit履歴の確認。
6. 正規化したうえでの重複範囲の比較と、特に大きな一致箇所の目視確認。
7. 追跡対象のJSON、Python、Bashファイルの構文チェック。

以下で使う確度のラベルは次の意味です。

- **高:** 複数の独立したチェックが一致しており、削除は機械的に進められます。
- **中:** 現時点で参照されていませんが、動的な読み込み、外部の利用者、製品としての意図が関わる可能性があります。
- **保留:** 簡素化の余地は確かにありますが、不要物の削除という枠に対して、影響範囲が広すぎます。

静的解析では、実行時の文字列による参照、ダウンロードしたパッケージの利用、読者が指定するパス、外部の利用者がないことまでは証明できません。そうした箇所は、デッドコードとして扱わずに明記しています。

## 1. 確度の高いファイル削除

### 1.1 到達不能なソースモジュール

| 候補 | 根拠 | 削除時の注意 | 必要な確認 |
| --- | --- | --- | --- |
| `packages/client/src/components/agents/AgentDebugPanel.tsx` (296行) | importしている箇所がなく、`AgentDebugPanel`は宣言部にしか出てきません。 | コンポーネントを削除します。その後、エージェントのストアにある`debugLog`と`clearDebugLog`を確認します。この到達不能なパネル以外に使い道がありません。`lastResults`は`SpriteOverlay`が使っているので削除しないでください。 | `pnpm check`。エージェントの設定とデバッグモードを開き、現役のデバッグ画面が動くことを確かめます。 |
| `packages/client/src/components/agents/AgentThoughtBubbles.tsx` (113行) | importしている箇所がなく、`AgentThoughtBubbles`は宣言部にしか出てきません。現在の思考バブルとチェックリストのUIは`RoleplayHUD`と`RoleplayHUDActionsMenu`が描画しています。 | コンポーネントと、`packages/client/.instructions.md`に残っている古い記述を削除します。 | `pnpm check`、`pnpm regression:roleplay`。ブラウザーでroleplayのHUDと連続性チェックリストを確認します。 |
| `packages/client/src/components/panels/GlobalGalleryPanel.tsx` (468行) | importしている箇所も、ルート登録も、名前の完全一致もありません。 | 削除するのはこのパネルだけです。ギャラリー機能全体が使われていないと**判断しないでください**。`NoodleHome`、ギャラリーのフック、サーバーのルート、ストレージには現役の参照が残っています。 | `pnpm check`、`pnpm smoke:ui`。Noodleの画像アップロードとギャラリーの動作を手作業で確認します。 |
| `packages/shared/src/features/turn-games/engine-utils.ts` (22行) | importもバレルエクスポートもなく、エクスポートされている4つのシンボルはすべてこのファイル内にしか出てきません。 | ファイルを削除します。 | `pnpm check`、`pnpm regression`。 |

### 1.2 不要になったサイドカーのビルドスクリプト

`scripts/build-sidecar-runtime.mjs`は、パッケージスクリプト、ワークフロー、ドキュメント、ソースのいずれからも参照されていません。中では`pnpm exec node-llama-cpp`を呼び出していますが、`node-llama-cpp`はすでにワークスペースの依存ではありません。Git履歴を見ると、かつてのローカルGemmaのサイドカーのビルド経路に由来するものです。

**推奨(確度: 高):** このスクリプトを削除します。ただし、インストーラーのパイプラインがリポジトリーの外に設定されている場合に備えて、事前にリリース成果物をリポジトリー外まで含めて一度だけ検索しておきます。

### 1.3 ルートに残っている完了済みの実装指示書

`MARI_PHASE2_TASK.md`と`MARI_PHASE3_TASK.md`は、すでにコードベースに取り込まれた作業について書かれた、ブランチ単位の実装指示です。リポジトリー内に参照はなく、読者や貢献者が長く参照するドキュメントでもありません。

**推奨(確度: 高):** 作業ツリーから削除します。履歴はGitに残ります。残す価値のある背景説明があれば、タスクの指示ごと保存するのではなく、その部分だけを該当するアーキテクチャのドキュメントに移してください。

### 1.4 実態と食い違うテスト0件のランナー

`packages/server/scripts/run-tests.mjs`は3つの`.test.ts`のパターンを対象にしていますが、対象のフォルダーにはテストファイルが1つもありません。`pnpm --filter @marinara-engine/server test`もルートの`pnpm test`も、テスト0件、スイート0件で成功終了します。以前のテストは意図的に削除されたもので、リポジトリーの規約でも`.test.ts`ファイルを残すことは禁止されています。

これは通常のデッドコードよりも危険です。現状では`pnpm test`が緑になること自体が、存在しないはずのカバレッジをあるように見せてしまうからです。

**推奨(確度: 高):**

1. サーバーのランナーと、サーバーの`test`スクリプトを削除します。
2. Windowsインストーラーのレイアウト確認は残しますが、必要なら実態に合った専用のスクリプト名を付けます。
3. ルートの`test`を、意図して選んだリグレッションとスモークの一部を実行するように定義し直します。あるいは汎用のエイリアス自体をなくし、`pnpm check`、`pnpm regression:*`、`pnpm smoke:ui`を実際の検証コマンドとして明記します。
4. テスト0件の実行だけでCIが「tests passed」と報告できない状態にします。

## 2. 依存関係のクリーンアップ

次の直接依存は、注記がない限り、マニフェストとロックファイルの外にimport、登録、設定、実行時の文字列参照がいずれもありません。

| ワークスペース | 依存 | 確度と根拠 |
| --- | --- | --- |
| client | `class-variance-authority` | **高。** ソースにも設定にも使用箇所がありません。過去の依存関係のクリーンアップでも未使用として扱われていました。 |
| client | `autoprefixer` | **高(ビルドでの確認あり)。** PostCSSの設定もimportもなく、クライアントはTailwindのViteプラグインを使っています。 |
| server | `@earendil-works/pi-ai` | **高。** Professor Mariのランタイムは、Piへの依存を外す形でリファクタリング済みです。すでにimportされておらず、後日のクリーンアップに回したことがリポジトリーの履歴に明記されています。 |
| server | `@fastify/websocket` | **高。** プラグインの登録も、websocketのルートも、importもありません。 |
| server | `png-chunk-text` | **高。** importがありません。現在のPNGメタデータの処理は直接実装されています。 |
| server | `png-chunks-encode` | **高。** importがありません。 |
| server | `png-chunks-extract` | **高。** importがありません。 |
| shared | `chess.js` | **高(互換性の確認あり)。** 現在のソースにimportがありません。組み込みのチェス機能は任意のパッケージへ切り出されました。削除する場合は、`scripts/check-workspace-install.mjs`にある記述も消し、`chess.js`が見つからないという古いトラブルシューティングの記述も直す必要があります。 |

クライアントの`@rollup/wasm-node`も参照されていませんが、これは環境によって使われるRollupのフォールバックである可能性があります。**確度は中**として扱い、パッケージングとCIの履歴を確認し、サポート対象のプラットフォームでビルドが通ることを確かめてから削除してください。

`workbox-window`、`pino-pretty`、ルートの`esbuild`、型定義パッケージ、CLI専用ツールのような依存を、importの文字列だけを見て未使用と判断しないでください。これらは、生成されるモジュール、文字列で指定する転送設定、ビルドスクリプト、パッケージスクリプトから使われています。

依存関係のPRでは、`pnpm-lock.yaml`を更新し、依存をクリーンな状態からインストールし直したうえで、ビルドとチェックの全レーンを実行してください。すでに展開済みの`node_modules`からパッケージを消すだけでは、根拠として不十分です。

## 3. コンパイラーが証明した未使用コード

TypeScriptの未使用チェックを強制すると、**サーバーで57件**、**クライアントで3件**の診断が出ました。これはテキスト検索だけの候補より強い根拠です。ほとんどはimportかローカル変数で機械的に削除できますが、コールバックのパラメーターと公開メソッドのパラメーターは、先に呼び出し側のシグネチャを確認する必要があります。

### 3.1 クライアント

- `ChatSettingsDrawer.tsx`: 未使用の`subject`フィルターパラメーター。
- `GameCombatUI.tsx`: 未使用の`line`マップパラメーター。
- `hooks/use-encounter.ts`: 未使用の`_res`。代入せずにリクエストをawaitします。

### 3.2 サーバー

- `db/file-backed-store.ts`: 未使用の`TABLES_REVERSE`、未使用の`loadedManifest`インスタンス項目と代入。
- ルートのimportとローカル変数: `backup.routes.ts` (`dirname`)、`sprites.routes.ts` (`readdir`)、`scene.routes.ts` (`gsStorage`)、`noodle.routes.ts` (`extractNoodleMentionHandles`、`NoodleInteractionType`)、`generate/dry-run-route.ts` (`lorebooksStore`)。
- 未使用のルートコールバックのパラメーター: `game-assets.routes.ts`、`lorebooks.routes.ts`、`sprites.routes.ts`、`youtube.routes.ts` (`reply`)。Fastifyのシグネチャ上の位置を保つ必要がある場合にかぎり`_reply`に名前を変えます。
- `game.routes.ts`: `GmPromptContext`、`formatMoraleContext`、`sceneSpotifyTrackCandidateSchema`。
- `generate.routes.ts`: `readFileSync`、`LIMITS`、`AgentPhase`、`CharacterStat`、`GameState`、`createLLMProvider`、`formatZonedConversationDate`、`formatZonedConversationTime`、`chatsTable`、`normalizeCustomEmojiSelection`、`embedMemoryRecallTexts`、`latestHistoryUserContent`、`getActiveTurnGame`、`startTurnGame`、`pruneEmptyPromptWrappers`、`areConversationSchedulesEnabled`、`addEventEntry`、`normalizeAgentMaxTokens`、`resolveAgentRunInterval`、およびローカル変数の`chatParams`。
- `generate/dry-run-route.ts`: 使われていないローカルのヘルパー`wrapperMessages`。
- `services/agents/agent-executor.ts`: `sanitizeTextAgentResponse`の未使用パラメーター`agentType`。削除する場合は内部の呼び出し側も直します。
- `services/agents/agent-pipeline.ts`: 未使用の`AgentPhase`。
- `services/conversation/schedule.service.ts`: 未使用の`createLLMProvider`と`ConversationStatusOverride`。
- `services/game/perception.service.ts`: 未使用の`RPGAttributes`。
- `services/generation/conversation-react-command-runtime.ts`: 未使用のヘルパーパラメーター`command`。
- `services/import/st-bulk.importer.ts`: 未使用の`personasTable`。
- `services/lorebook/keyword-scanner.ts`: 分割代入した未使用の`currentMessageIndex`。削除前に内部のオプションの形を確認します。
- `services/lorebook/prompt-injector.ts`: 未使用の`LorebookEntry`。
- `services/mari-db/mari-db.service.ts`: 使われていないヘルパー`makeEmptyValidation`。
- `services/prompt/assembler.ts`: 未使用の`PromptPreset`、`PromptSection`、`PromptGroup`、`groupOrder`、`chatHistoryEndIdx`。
- `services/sidecar/scene-analyzer.ts`: 使われていないヘルパー`widgetUpdateHint`と`widgetStateSummary`。
- `services/sidecar/scene-postprocess.ts`: 使われていないヘルパー`normalizeExpression`。
- `services/sidecar/sidecar-process.service.ts`: `lastReadyAt`は代入されるだけで読み出されません。
- `services/storage/noodle.storage.ts`: 未使用の`NoodlerStageProfile`。
- `services/storage/prompts.storage.ts`: `reorderVariables`の未使用パラメーター`presetId`。シグネチャを変える前に、呼び出し側と保存時の並び順の扱いを確認します。

このリストを片付けたら、サーバーとクライアントのTypeScript設定で`noUnusedLocals`と`noUnusedParameters`を有効にします。これで、この監査は一度きりの棚卸しから、維持され続ける不変条件に変わります。意図的に必要なコールバックのパラメーターは、ルール自体を再び全体で無効にするより、`_`を先頭に付けるほうが望ましい対処です。

## 4. リポジトリー内に利用者がいない内部エクスポート

エクスポートされた宣言は通常の未使用ローカル変数のチェックの対象外です。そこで2回目の調査として、宣言部にしか出てこない名前を探しました。クライアントは公開ライブラリーではなくアプリケーションなので、これらは削除の候補になります。領域ごとのまとまった単位で削除し、それに伴って不要になる非公開のヘルパーやimportはコンパイラーに洗い出させてください。

### 4.1 クライアントのフックとヘルパー

- エージェント関連のフック: `useAgentConfig`、`useUpdateAgentByType`、`useToggleAgent`。
- キャラクター関連のフック: `useUpdatePersonaGalleryClipTrim`、`useCharacterGroup`。
- チャットとフォルダー関連のフック: `useReorderChats`、`useActiveChatPreset`、`useCreateChatPreset`、`useTouchChat`、`useMarkAutonomousUnread`、`useBulkSetMessagesHiddenFromAI`、`useSwipes`、`useMoveConnection`。
- Game Mode関連のフック: `useRegeneratePartyCard`、`useUpdateGameMapBinding`、`useCombatLoot`、`useLootGenerate`、`useGameJournal`、`useGameCheckpoints`、`useCreateCheckpoint`、`useLoadCheckpoint`、`useDeleteCheckpoint`。
- Haptic Feedback関連のフック: `useHapticStopScan`、`useHapticCommand`、`useHapticStopAll`。
- ロアブック関連のフック: `useLorebookEntry`、`useBulkCreateEntries`、`useSearchLorebookEntries`。
- その他のフック: `useCustomTool`、`useUpdateNoodleAccount`、`usePreset`、`useCreatePreset`、`usePresetGroups`、`useReorderGroups`、`usePresetSections`、`usePresetVariables`、`usePreviewPreset`、`useRegexScript`、`useUpdateSpatialContext`。
- UIの宣言: `parseQteTag`、`NoodlerNotificationItem`、`LabelWithHelp`、`RESOURCE_PANEL_SORT_OPTIONS`、`SyncedSettings`。
- ライブラリーのヘルパー: `isManagedChatBackgroundUrl`、`isBrowserSpeechRecognitionSupported`、`requestTurnGameBotGeneration`、`resolveInputMacrosForChat`、`createCustomToolFolderPackageFilename`、`resolveCurrentGameSessionChatId`、`readTextFileFromZip`、`buildTTSMessageText`。

クライアントのフックが未使用であっても、対応するサーバーのエンドポイントが未使用だという証明には**なりません**。まずフックを削除し、ルートについてはUI、機能パッケージ、外部APIとの互換性と照らして別途調べてください。

### 4.2 APIかテスト用の差し込み口かの最終判断が必要なサーバー側の候補

次のエクスポートされたサーバーの宣言も、リポジトリー内に利用者がいません。ほとんどは内部向けに見えますが、エクスポートされたテスト用の差し込み口やヘルパーはツリー外のツールから使われている可能性があります。そのため、サポート対象のAPIではないとメンテナーが確認するまでは確度は中です。

- ランタイムとBasic認証: `getServerRoot`、`getSpotifyRedirectUri`、`isAutoOpenBrowserDisabled`、`hasBasicAuthConfigured`。
- テスト用の差し込み口: `resetRateLimitBucketsForTests`、`buildKnowledgeRetrievalAgentMessagesForTest`、`splitRuntimeHandledAgentInjectionsForTest`、`__setSdkForTesting`。
- 生成とプロンプトのヘルパー: `normalizeSecretPlotSceneDirections`、`buildUserMessageRegenerationPrompt`、`buildUserMessageRegenerationSourceMessage`、`wrapFields`、`mergeTruncation`、`modelAccessOptions`、`isStandaloneCharacterProfileBlock`、`resolveChatSummaryPromptFromMetadata`。
- Game Modeのヘルパー: `buildNpcPortraitImagePrompt`、`buildBackgroundImagePrompt`、`buildSceneIllustrationImagePrompt`、`buildSessionSummaryPrompt`、`buildCardAdjustmentPrompt`、`moraleDiceModifier`、`buildNpcRelationshipSummary`、`buildSessionCarryoverContext`、`getTurnGameContextText`。
- ロアブックのヘルパー: `enforceMaxActivatedEntries`、`applyPerLorebookTokenBudgets`、`resolveActivatedLorebookEntryContent`、`resolveBudgetAndRecursivelyActivateLorebookEntries`、`recursiveScan`。
- ユーティリティーと型: `AgentPipelineResult`、`resolveVideoRequestDuration`、`newTimeSortableId`、`parseBoolean`、`sanitizePathFilename`。

この「出現箇所が1つだけ」という判定を`packages/shared`にそのまま当てはめないでください。sharedのエクスポートは、クライアント、サーバー、ダウンロード可能なエージェントパッケージ、さらにはこのリポジトリーの外にある利用者に対する互換性の約束です。

## 5. 静的アセットの候補

`packages/client/public/sprites/mari/Mari_point_down_left.png`は、同梱されているMariのスプライトのうち、ファイル名やパスがリポジトリーのどこからも参照されていなかった唯一のもので、omnibar slice 38aで削除されました。

同梱されているゲームのアセットの整理に、ファイル名の検索を使わないでください。サーバーのシーダーとマニフェストは、一部のアセットのフォルダーを動的に走査します。

## 6. 範囲を限定した簡素化

ここに挙げるのは保守性の改善であり、デッドコードの削除ではありません。いずれも動作を厳密に保ち、対象を絞ったリグレッションでの確認を伴う必要があります。

### 6.1 完全またはほぼ完全に重複した業務ロジック

1. **絵コンテのキーフレーム選択。リスクは低。** `GameSurface.tsx`にあるローカルの`findStoryboardKeyframeForSegment`は、`lib/game-session-replay.ts`でエクスポートされている`findReplayStoryboardKeyframe`と同じ内容です。ライブラリー側のヘルパーを再利用し、ローカルの実装を削除します。
2. **Spotify検索の正規化。リスクは低から中。** `SPOTIFY_STOP_WORDS`、`SPOTIFY_MOOD_EXPANSIONS`、展開の流れが`game-spotify-music.service.ts`と`tool-executor.ts`で重複しています。小さなSpotifyクエリートークンのヘルパーを切り出し、2つの経路がずれないようにします。
3. **PNGのキャラクターカードのメタデータ抽出。リスクは中。** `extractCharaFromPng`が`import.routes.ts`と`st-bulk.importer.ts`で別々に実装されています。サーバーのユーティリティーを1つ切り出し、通常のテキストチャンク、国際化テキストチャンク、base64と生のペイロード、V2/V3のカード、壊れたPNGについて、リグレッション用の入力データで確認します。
4. **チュートリアルのツールチップの座標計算。リスクは中。** `GameTutorial.tsx`と`OnboardingTutorial.tsx`で衝突判定と配置のロジックが重複しています。共通の座標計算だけを切り出し、各チュートリアルのモバイル向けの扱いや機能固有の方針は、明示的なオプションとして残します。
5. **クライアントとサーバーのゲームセグメント編集の正規化。リスクは中から高。** クライアントとサーバーの純粋な正規化処理は似ています。実行時の挙動に本当に影響しないスキーマや正規化処理だけをsharedへ移し、サーバー側の解析と永続化に関わる部分はサーバーに残します。

### 6.2 大きく重複したUI領域: 大規模な統合は保留

- `CharacterEditor.tsx`と`PersonaEditor.tsx`には、スプライト管理の流れがかなりの分量で重複しています。
- `ChatInput.tsx`と`ConversationInput.tsx`には、ガイド付きプランと入力欄の挙動が重複しています。

統合する価値は確かにありますが、どちらの組み合わせも丸ごと統合するとリグレッションの影響範囲が大きくなります。まとまりのあるフックやコンポーネントを1つずつ切り出してください。エディターならスプライト管理から、入力欄ならガイド付きプランの挙動からです。切り出しのたびに、両方の呼び出し側をブラウザーで確認します。

### 6.3 現役の複雑さのホットスポット

現役のモジュールでもっとも大きいのは`server/routes/game.routes.ts`、`client/components/game/GameSurface.tsx`、`client/features/chat-settings/ChatSettingsDrawer.tsx`、`server/routes/generate.routes.ts`、`client/components/panels/SettingsPanel.tsx`です。これらは削除の候補ではありません。範囲を限定したルートハンドラー、ドメインサービス、パネルのセクション、純粋なヘルパーの切り出しは、その機能をすでに変更している場合にかぎって続けてください。分割だけを目的としたPRは、動作を確かめる手立てがないまま変更を増やすだけです。Chat Settings Drawerは例外で、1回のPRにつき1セクションずつ分割しました(#9119)。フォルダーの規則は`packages/client/.instructions.md`のChat Settingsセクションにあります。

## 7. クリーンアップから意図的に除外した項目

- 2.xの系列を通じて受け入れると明記されている互換性のための項目。画像スタイル、ゲームの状態、TTS、ペルソナのトラッカー、チャットのコンテキストに関する互換性のための形式が含まれます。これらは次のメジャーリリースで、バージョンを区切った移行としてのみ削除します。
- 生成される機能レジストリーとマニフェスト。手作業で削らず、生成用のスクリプトで作り直してください。
- ダウンロード可能なIllustrator、Music DJ、Lorebook Keeperなどのエージェントパッケージのコード。エージェント側のランタイムとプロンプトの整理は`Pasta-Devs/Marinara-Agents`の担当で、このリポジトリーが受け持つのは連携部分だけです。
- `custom_components`配下のHome Assistantのモジュール。検出は命名規則とマニフェストによって行われます。
- `MarinaraLauncher.exe`。タスクバーのショートカットの移行コードから使われています。
- `start-local.bat`。パッケージスクリプトからは参照されていませんが、人が直接使うローカル起動用として残っている可能性があります。メンテナーの意図を確認してから削除してください。
- 参照されていないように見えても、モジュールの初期化やテーブル登録の一部として実行されるスキーマ宣言。
- 便利に使うためのReactのフックが未使用だというだけの理由で、サーバーのルートを削除すること。ダウンロード可能なパッケージやAPIの利用者が今も呼び出している可能性があります。

## 8. 推奨するクリーンアップの順序

作業は単純で、レビューしやすい形に保ちます。

1. **PR A: 不要物。** 到達不能なモジュール4件、コンポーネントに関する古いドキュメントの記述、不要になったサイドカーのスクリプト、完了済みのタスク指示書を削除します。未使用のMariのスプライトは、手作業で確認してから削除します。
2. **PR B: テストの実態を正す。** テスト0件のランナーを削除し、成功したコマンドが実際の確認を表すようにパッケージスクリプトの名前と内容を見直します。
3. **PR C: コンパイラー由来の整理。** TypeScriptの診断60件を解消し、クライアントとサーバーの設定で未使用チェックを有効にします。
4. **PR D: 依存関係。** 確度の高いパッケージ8件を削除し、ワークスペースのインストール確認とトラブルシューティングの記述を直し、ロックファイルを作り直し、クリーンな状態でのインストールとビルドを確認します。
5. **PR E以降: 領域ごとのまとまった単位。** 未使用のクライアントのエクスポートを領域ごとに削除し、そのあとリスクの低い重複ヘルパーを1つずつ片付けます。

依存関係の削除、大規模なUIのリファクタリング、ルートの分割を1つのクリーンアップPRにまとめないでください。

## 9. 検証の対応表

変更の内容に応じた確認を実施してください。

- コードのクリーンアップ全般: `pnpm check`。
- sharedや広範囲のサーバーの変更: まず`pnpm regression`か、範囲を絞った`pnpm regression:<domain>`を実行し、マージ前に全レーンを実行します。
- UIのコンポーネントやフックの整理: `pnpm smoke:ui`と、影響する流れのブラウザーでの手作業の確認。
- プロンプト、エージェント、roleplayの経路: `pnpm regression:prompt`と`pnpm regression:roleplay`のいずれか、または両方。
- 依存関係の整理: クリーンな状態またはロックファイル固定でのインストール、`pnpm check`、本番ビルド、サポート対象プラットフォームでのCI。
- PNGインポートの共通化: 正常なキャラクターカードと壊れたキャラクターカードの両方を含むインポートのリグレッション。
- リリースやバージョンのファイルに意図せず変更が及んだ場合: `pnpm version:check`と`pnpm credits:check`。

このクリーンアップより前は、汎用の`pnpm test`の結果をテストの根拠として示すことはできませんでした。テストを実行しないまま成功していたためです。

## 10. 監査の検証と限界

この監査では次のことを確認しました。

- 追跡対象のJSONファイルはすべて正しく解析できました。
- 追跡対象のPythonファイル12件は、PythonのASTパーサーですべて正しく解析できました。
- `start.sh`、`start-termux.sh`、`android/build-apk.sh`は`bash -n`を通過しました。
- TypeScriptの未使用チェックでは、上記のとおりサーバー57件、クライアント3件の指摘が出ました。
- サーバーとルートのテストコマンドが、テスト0件のまま成功する様子を直接確認しました。

ShellCheckとPowerShellが導入されていなかったため、シェルスクリプトの意味的な検査と、PowerShellやWindows向けスクリプトの解析は実施していません。AndroidとHome Assistantの対象は構造的に確認しましたが、この監査ではビルドまでは行っていません。これらのプラットフォーム固有の確認は、該当ファイルに触れるクリーンアップPRの中で実施してください。
