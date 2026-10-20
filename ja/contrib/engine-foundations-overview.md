# Engine基盤：シリーズの概要

このページはEngine基盤への貢献（Issue #6624）を整理したものです。当初の大きなpull requestは、個別にレビューできるようAからHまでの8件に分割されました。すべてMarinara Engineですでに正常に動作しているコードを土台にします。既存APIの改名、共有ロガーの置き換え、ファイルの規約変更は行いません。全員に影響する変更は明記し、それ以外は有効化するまで無効です。

<a id="the-pull-requests"></a>

## Pull request一覧

| PR | 内容 | 依存先 |
| --- | --- | --- |
| **A** | 基盤：回帰テストの分離、リクエスト追跡と起動タイムライン、2つの任意ロアブック設定、任意の堅牢性設定と実行時診断、起動時injectゲート、機能スイッチ、ベストエフォートヘルパー | なし（このPR） |
| **B** | コーディング支援用Dev MCP（`tools/dev-mcp/`） | なし |
| **C** | Ctrl+Kコマンドパレットと「?」ショートカット一覧（クライアントのみ、スイッチなし） | なし |
| **D** | レビュー済みサーバー修正その1：ルートとミドルウェア、ストレージ復旧、チャットと生成、インポーター、サイドカー、SSRF | A |
| **E** | レビュー済みサーバー修正その2：サービスとストレージ | A |
| **F** | プロンプトキャッシュ：Claudeサブスクリプションのマーカー修正、Agent SDK更新、キャッシュ向け構成、低キャッシュ送信前の警告、診断 | A |
| **G** | タブを閉じても続く生成ジョブ、ジョブ一覧、Windowsコンソールのトレイ | A（パレット操作にはCも必要） |
| **H** | Engine診断とランチャー：ビルド整合性、メモリ計測、プロンプトデバッグファイル、バックグラウンド呼び出し上限、バックアップと準備後の起動、推論無効化に関する再試行 | A |

A、B、Cは独立しており、任意の順序でレビューできます。DからHはAに続き、機能レジストリ（`isFeatureEnabled`、Settings > Advanced > Features）、ログ追跡、ベストエフォートヘルパーを使うか、起動タイムラインや診断ルートを拡張します。それぞれ独自のスイッチ、CHANGELOG項目、このページの節を追加します。

Aの各項目は、既存の仕組み、追加内容、変わらない点、確認方法、無効化または取り消し方を説明します。

既定では、保存データ、プロンプト、再試行、サーバーが起動するものへの変更は無効です。環境変数か**Settings > Advanced > Features**（設定 > 詳細 > 機能、A6）で有効化します。何も有効にしなければ従来の動作です。バグ修正、テストランナー、追加ヘルパーにはスイッチがなく、各節に明記します。

取り消し：Aのコミットには順序があり、一部のファイル（`app.ts`、`index.ts`、`runtime-config.ts`、`capability-module-runtime.service.ts`、`CHANGELOG.md`）が重複します。新しいものから戻すと競合を避けられます。

大半の確認は既存の回帰テストランナーを使います。共有パッケージを一度ビルド（`pnpm build:shared`）してから、リポジトリのルートでコマンドを実行してください。

---

<a id="pr-a-foundations"></a>

# PR A：基盤

> **Decisionモデル更新へリベース済み。** Decision呼び出しは必要とするリクエスト内で実行され、その`requestId`を持ちます。Decisionとユーティリティのサイドカーはルートログコンテキストで起動し、後続ログに最初の呼び出し元IDを残しません。失敗したDecisionスロットは、ターンごとの複数警告ではなく頻度制限付きの1件を記録します。ユーザー中断はinfo、破棄したDecision文の件数はwarn、本文はdebugのみです。終了時は両サイドカーを名前付き手順で停止します。Decisionはプロバイダーの再試行ラッパーを通らず、二重再試行しません。

<a id="a1-test-harness-each-regression-file-runs-in-its-own-data-folder"></a>

## A1. テスト環境：回帰ファイルごとに専用データフォルダー

**既存の仕組み。** `scripts/run-regressions.mjs`が回帰テストを検出し、`runRegression()`で順に実行します。タイムアウトとシグナルは`terminateActiveChild`、`releaseActiveChild`、`FILE_TIMEOUT_MS`で処理します。子プロセスには開発者の`process.env`全体を渡します。サーバーは`MARINARA_ENV_FILE`で`.env`を別の場所へ向けられ（`packages/server/src/config/runtime-config.ts`の`getEnvFilePath()`）、`e2e/start-servers.mjs`もすでにこの方法で分離しています。

**追加内容。** 小さなヘルパー`regressionEnvironment(scratchDir)`です。`runRegression()`がファイルごとにOS一時フォルダー内へ`marinara-regression-*`を作り、子の`DATA_DIR`、`FILE_STORAGE_DIR`、`MARINARA_ENV_FILE`をそこへ向けます。成功、失敗、タイムアウト、起動失敗のいずれでも終了時に削除します。独自の分離を忘れたテストも開発者の`.env`を読まず、実データの書き込みリースと競合しません。

**変わらない点。** 関数、`--filter`、`--list`、タイムアウト、要約、`package.json`スクリプト、CIは同じです。独自の変数を設定するテストはその値を使います。シェルでexportした`DATA_DIR`、`FILE_STORAGE_DIR`、`MARINARA_ENV_FILE`はファイルごとに上書きされますが、意図した変更で、テストのみが対象です。

**確認方法。**

```sh
node scripts/run-regressions.mjs --filter env-watcher
```

終了後、一時フォルダーに`marinara-regression-*`が残っていないことを確認します。

**無効化／取り消し。** スイッチはなく、分離が既定です。ランナーのコミットを取り消すと戻ります。先に新しいコミットを戻してください。共有するのは`CHANGELOG.md`と`CONTRIBUTING.md`だけです。`MARINARA_REGRESSION_INHERIT_STORAGE=1`のような除外設定は数行で実装できますが、未要求の設定を増やさないため追加していません。

---

<a id="a2-logging-follow-one-request-one-boot-and-one-failure"></a>

## A2. ログ：1つのリクエスト、起動、失敗を追跡

**既存の仕組み。** `packages/server/src/lib/logger.ts`は共有Pinoの`logger`を公開します。`protectTerminalLogger`は閉じたターミナルによるサーバークラッシュを防ぎ、`logDebugOverride`はUIのデバッグ切り替えを支えます。`CONTRIBUTING.md`のLogging規則（共有ロガー、エラーオブジェクトを先頭、書式指定子、4段階）を維持します。従来は`app.ts`の`buildApp()`がFastify独自の設定を渡し、同じレベルのPinoをもう1つ作っていました。`req-1`、`req-2`のIDは起動ごとにリセットされました。

**追加内容。** 詳細は`docs/development/logging.md`にあり、`CONTRIBUTING.md`のLoggingから参照します。

- Fastifyは共有ロガー（`loggerInstance: logger`）を使います。`req.log`は同じシリアライザーを使い、`followLogLevel`で`LOG_LEVEL`のホットリロードに追従します。終了時に購読解除します。`CONTRIBUTING.md`に記載済みの動作です。
- リクエストに起因する全行に`requestId`が付き、サービス内部も対象です（`lib/log-context.ts`、`AsyncLocalStorage`コンテキストとPino mixin）。UUIDまたは有効なクライアント`x-request-id`を使い、報告用に`x-request-id`ヘッダーで返します。
- 全行に`bootId`が付き、同じログ内の起動を区別できます。
- 起動タイムライン`lib/startup-timeline.ts`：`app.ts`と`index.ts`の手順を`startup.phase("name", fn)`で包みます。infoの`[startup] Ready in N ms`が遅い手順を列挙し、起動失敗は失敗した手順を示します。
- 失敗ごとに1行です。プロバイダーやツールは記録してから再送出せず、そのまま再送出します。生成失敗はerrorを1行だけ出し、ユーザー停止は`failureLevel(err)`でinfoにします。`cause`の連鎖を残します。
- ヘルスチェック、スケジューラーのポーリング、コンテキスト提供元の反復エラーは`logRateLimited`と`suppressedRepeats`を使います。
- モデル出力、ダイス要求、Spotifyトークン本文、動画ポーリング本文はdebugへ移し、warnには長さだけ出します。
- 回帰テスト：`logging-request-trail`、`logging-failure-lines`、`logging-startup-timeline`。

**変わらない点。** `logger`の公開名とファイル、`protectTerminalLogger`、`logDebugOverride`、`pid`、`hostname`、既存`logger.*`と`req.log`は同じです。Fastifyの`LogController`は置換でなく継承します。`LOG_LEVEL`（既定`warn`）と`LOG_DISABLE_REQUEST_LOGGING`も同じです。`pnpm dev`ではpino-prettyが`bootId`と`hostname`を隠すため表示項目は増えません。`CONTRIBUTING.md`は追記のみです。

`logging.md`に説明する変更：

- `reqId`から`requestId`へ変更します。保存済み`reqId`フィルターも更新が必要です。
- 受信・未検出ログはトークンを含み得るクエリ文字列を省きます。他の`req`フィールドは維持し、`route`を追加します。
- infoの`Client aborted request`を追加し、`LOG_DISABLE_REQUEST_LOGGING`で無効にできます。
- 子手順を除く固有時間`selfMs`が15秒超の起動手順はwarnとなり、既定でも見えます。`app.build`が`buildApp`を包むなど入れ子でも、判定は固有時間なので遅い手順1つに1行です。

**確認方法。**

```sh
node scripts/run-regressions.mjs --filter logging-
```

またはサーバーへリクエストを送り、返された`x-request-id`を`grep`で探します。

**無効化／取り消し。** `LOG_DISABLE_REQUEST_LOGGING=true`は従来どおりリクエスト行を消し、`LOG_LEVEL=warn`は新しいinfoを隠します。全体を戻すなら後続コードのコミットを先に戻し、ログのコミットを取り消します。

---

<a id="a3-performance"></a>

## A3. 性能

両方とも既定で無効です。無効ならプロンプトと保存データはバイト単位で従来と同じです。`.env.example`と`docs/CONFIGURATION.md`のLorebooks表に記載します。

<a id="a3a-stable-lorebook-group-winners-lorebook_stable_group_winners-switch-stablelorebookgrouppicks"></a>

### A3a. ロアブックグループの勝者を固定（`LOREBOOK_STABLE_GROUP_WINNERS`、スイッチ`stableLorebookGroupPicks`）

**既存の仕組み。** `packages/server/src/services/lorebook/keyword-scanner.ts`の`applyGroupSelection()`は包含グループごとに重み付き抽選（`pickWeightedGroupEntry`）で選び、持続エントリーを優先します。乱数源は注入可能（`random`、既定`Math.random`）で、変更を容易にしました。毎回の抽選で他に変更がなくても勝者が変わり、プロンプトの先頭とキャッシュが変わり得ます。

**追加内容。** `applyGroupSelection`と`ScanOptions`に任意の`groupSeed`を追加します。有効時は`processLorebooks`がチャットIDを渡し、同じ有効候補ならそのチャットの各ターンで同じ勝者になります。他のチャットや候補集合は変わり得ます。Active Context（アクティブコンテキスト）が使う既存の`stableHash` + `createSeededRandom`を`lorebooks.routes.ts`から共有`lorebook/seeded-random.ts`へそのまま移し、同じ生成器を使います。A6以降は**Stable lorebook picks**（ロアブック選択を固定）も使えますが、環境変数が優先です。

**変わらない点。** 名前とシグネチャー（追加引数は任意）、持続処理、重みは同じです。注入乱数は確率判定を制御し続けますが、有効時のグループ勝者はシードが決め、Active Contextと生成が一致します。無効時はシードを渡さず従来の経路です。

**確認方法。** `node scripts/run-regressions.mjs --filter lorebook-group-seed`で変数とスイッチを確認します。

**無効化／取り消し。** `LOREBOOK_STABLE_GROUP_WINNERS`を未設定にしてスイッチを切ります。

<a id="a3b-compact-stored-lorebook-scans-lorebook_compact_stored_scans"></a>

### A3b. 保存済みロアブックスキャンの圧縮（`LOREBOOK_COMPACT_STORED_SCANS`）

**既存の仕組み。** 生成メッセージは有効エントリーの全文を`extra.lorebookScan`として行と各スワイプに保存します。Active Contextが正確な生成材料を示せますが、大きなロアブックを使う長いチャットでは表が膨らみます。

**追加内容。** 有効時、Active Contextとエージェント再試行が読む最新のアシスタント／ナレーターメッセージは、行と全スワイプに全文を保持します。戻したスワイプも元の内容を表示します。ユーザーなりきりターンのスキャンは圧縮し、この位置を占めません。古いメッセージはID、名前、キー、スコアのみ保持します。生成保存経路では圧縮せず、バックグラウンドで前のメッセージを、メッセージキューごとに順次処理します。失敗は`logRateLimited`で記録し次の保存で再試行します。新しいメッセージを削除すると、Active Context（`lorebooks.routes.ts`）と再試行（`retry-agents-route.ts`の`storedContentForTextlessScanEntries`）は現在保存されたエントリー本文へフォールバックします。`scripts/compact-lorebook-scans.mjs`は古いチャットにも適用します。既定は試行のみ、サーバーが書き込みリースを持つ間は拒否し、`--apply`前に両表をバックアップします。

**変わらない点。** 無効なら新たな書き込みはなく、保存形式も同じです。スキャン形式とActive Context／再試行ルートの応答は維持し、本文がない場合のみ代替します。既定の小修正は本文のない古いスキャンだけです。Active Contextは空文字列の代わりに保存本文を表示し、再試行は省略せず保存本文付きで含めます。

**確認方法。** `node scripts/run-regressions.mjs --filter lorebook-scan-compaction`は既定形式、スワイプ戻し、なりきりターン、初回保存時の既存メッセージ処理、実ルートでのActive Context代替、保守スクリプトを確認します。

**無効化／取り消し。** `LOREBOOK_COMPACT_STORED_SCANS`を未設定または`false`にします。圧縮済みはそのままで、最新メッセージは本文を保持します。`--apply`のバックアップで旧形式を復元できます。

---

<a id="a4-robustness"></a>

## A4. 堅牢性

すべて既定で無効な環境設定で、`docs/CONFIGURATION.md`の堅牢性表と`.env.example`に記載します。別ファイルなので個別レビュー・分割・取り消しが可能です。追加引数とフィールドは任意で、このコミットは`isRateLimitError`と`base-provider.ts`を変更しません。

<a id="a4a-storage-writes"></a>

### A4a. ストレージ書き込み

**既存の仕組み。** `packages/server/src/db/file-backed-store.ts`は変更済みシャードと`manifest.json`を`serializeTableRows()`と`atomicWriteFile()`で書き、復旧用`.bak`を残します。アトミック書き込みとバックアップ設計は維持します。

**追加内容。**

- `STORAGE_SKIP_UNCHANGED_WRITES`は、プロセスの最後の永続書き込みと内容が同じで、ディスクのサイズとmtimeも一致すれば省略します。`.bak`から復旧したファイルは必ず再書き込みします。
- `STORAGE_YIELDING_SERIALIZE`は大きなシャードを12ミリ秒単位でシリアライズし、イベントループへ制御を戻します。長いチャット保存でも他の要求を止めず、出力は`serializeTableRows`とバイト単位で一致します。

**変わらない点。** 両方無効なら`serializeTableRows`、`beforeTableWrite`、`atomicWriteFile`は従来どおりです。実書き込みは常に`atomicWriteFile`経由です。

**確認方法。** `node scripts/run-regressions.mjs --filter robustness-storage-write`

**無効化／取り消し。** 両方未設定にします。

<a id="a4b-windows-boot"></a>

### A4b. Windows起動

**既存の仕組み。** 書き込みリースは`file-backed-store.ts`の`readBootId()`でOS起動を識別し、毎回PowerShell（Windowsで約1.5～2秒）と`reg.exe`による識別照会を実行します。

**追加内容。**

- `STORAGE_CACHE_WINDOWS_BOOT_ID`は正確な結果をOS起動ごとに`DATA_DIR/.writer-boot-id.json`へキャッシュします（`db/writer-boot-id-cache.ts`）。`LOCALAPPDATA`には書きません。
- 常時有効：`reg.exe`とPowerShellに`windowsHide`を渡し、コンソールなしの起動でウィンドウが一瞬表示されるのを防ぎます。他の影響はありません。

**変わらない点。** リース処理と照会自体は同じで、無効なら毎回照会します。

**確認方法。** `node scripts/run-regressions.mjs --filter robustness-boot-performance`

**無効化／取り消し。** 未設定にするか`.writer-boot-id.json`を削除します。

<a id="a4c-shutdown"></a>

### A4c. 終了

**既存の仕組み。** `packages/server/src/index.ts`は`shutdown(signal)`でSIGINT、SIGTERM、Windows以外のSIGHUPを処理し、重複をwarn付きで無視します。8秒の`armShutdownDeadline`を設定し、全ランタイム停止を待ってから`closeDB()`を呼びます。この順序は維持します。

**追加内容。** `index.ts`と`app.ts`で使う`lib/shutdown-signals.ts`、`lib/shutdown-steps.ts`：

- `SHUTDOWN_WINDOWS_CONSOLE_SIGNALS`：Ctrl+Breakとコンソール閉鎖でも同じ正常終了を実行し、Windowsの約5秒に収まる期限を使います。
- `SHUTDOWN_FORCE_EXIT_ON_REPEAT`：最初から1.5秒超の2回目のCtrl+Cで強制終了します。
- `SHUTDOWN_EARLY_FLUSH`：停止シグナル直後に保留中の保存を開始します。失敗をここで重複記録しません。ストアが記録済みで、閉鎖時に再試行します。
- `SHUTDOWN_RUNTIME_STOP_BUDGET_MS`（最大2500、既定0＝すべて待機）：停止シグナル時、ランタイムが停止しなくても時間予算後に`closeDB()`を呼びます。後者2設定はシグナル終了のみで、`admin.routes.ts`のAdvanced Settings再起動は同じです。
- 常時有効：3つの停止を命名し、失敗や1秒超の遅延を段階付きで記録します。

**変わらない点。** すべて無効なら同じシグナル、重複無視、`closeDB()`前に全停止待機、同じ8秒期限です。

**確認方法。** `node scripts/run-regressions.mjs --filter robustness-shutdown-safety`

**無効化／取り消し。** 未設定にします。最初の2つは再起動が必要で、環境監視が通知します。

<a id="a4d-provider-retry-on-transient-network-errors-provider_retry_transient_errors-switch-providerretry"></a>

### A4d. 一時的ネットワークエラーの再試行（`PROVIDER_RETRY_TRANSIENT_ERRORS`、スイッチ`providerRetry`）

**既存の仕組み。** `packages/server/src/services/llm/rate-limit-aware-provider.ts`の`RateLimitAwareProvider`はレート制限を`MAX_RATE_LIMIT_RETRIES`までバックオフ付きで再試行し、`Retry-After`を尊重します。`connection-fallback-provider.ts`は代替接続へ切り替えます。両方正常ですが、接続拒否や502は生成失敗になっていました。

**追加内容。** 接続拒否・到達不能、502/503を最大2回、0.5～2秒のランダム待機で再試行します（`Retry-After`は最大5秒）。本文も推論もユーザーに届く前のみです。504やソケットリセットは対象外です。有効な代替を持つ主接続（`transientRetry: false`）には適用せず、切り替え速度を維持します。能力パッケージが`llm.withFallback`へ渡すような独自ラッパー付き主接続も除外します。A6以降は**Retry failed provider calls**（失敗したプロバイダー呼び出しを再試行）も使え、環境変数が優先します。

**変わらない点。** レート制限のスケジュール、ジッターなし、コールバックは同じです。`isRateLimitError`と`base-provider.ts`は変更しません。

**確認方法。** `node scripts/run-regressions.mjs --filter robustness-provider-resilience`

**無効化／取り消し。** 変数未設定、スイッチ無効にします。

<a id="a4e-runtime-diagnostics"></a>

### A4e. 実行時診断

**既存の仕組み。** `packages/server/src/routes/admin.routes.ts`は`/request-timeouts`など特権管理ルートを提供しますが、ストレージと能力ランタイムの統一読み取り専用表示はありません。

**追加内容。** `GET /api/admin/runtime-diagnostics`（`lib/runtime-diagnostics.ts`）を`requirePrivilegedAccess`、`no-store`、毎分30回の独自制限で保護します。常駐データ数、変更表、直近の書き込みエラー、各ランタイムの稼働と直近の有効化失敗を示します。任意フックはコントローラーの`getStorageStats()`、`db/connection.ts`の`getFileStoreStats()`、`CapabilityModuleRuntime`の`runtimeState()`です。

**変わらない点。** 読み取りのみです。既存ルート、応答、アクセス規則は変わりません。

**確認方法。** `node scripts/run-regressions.mjs --filter robustness-runtime-diagnostics`または特権アクセスでローカルの`/api/admin/runtime-diagnostics`を開きます。

**無効化／取り消し。** 呼ばれなければ何もしません。削除するなら`admin.routes.ts`のルートと`lib/runtime-diagnostics.ts`を除去します。

<a id="two-catches-that-used-to-be-silent"></a>

### 従来無言だった2つのcatch

CONTRIBUTINGの規則に従い、`import.routes.ts`のSillyTavernチャットヘッダー解析（JSONエラーが本文を引用し得るため型だけ）と、エージェント有効化質問の転送（頻度制限付き）をwarnで記録します。

---

<a id="a5-startup-internal-requests-wait-until-route-registration-has-ended"></a>

## A5. 起動：内部要求はルート登録完了まで待機

常時有効なバグ修正で、設定ではありません。

**既存の仕組み。** `packages/server/src/app.ts`の`buildApp()`は主要ルートを登録し、`services/capability-packages/capability-module-runtime.service.ts`の`activateOne()`で各パッケージを有効化する`capabilityModuleRuntime.start(app)`を待ち、その後`startServerAutonomousScheduler(app)`を開始します。内部`app.inject()`は、`capability-route-registration.service.ts`の`runCapabilityInternalRoute()`経由のパッケージ、`server-autonomous-scheduler.service.ts`の自律スケジューラー、`routes/generate/prompt-preview.ts`で使います。最初の`inject()`でFastify全体が起動し、以後ルート、フック、プラグインを追加できません。`buildApp()`の登録中に、パッケージのタイマーや早く始まったワーカーなどのバックグラウンド処理が`inject()`を呼ぶと、後続パッケージが"Root plugin has already booted"で失敗し、次の`addHook`でサーバーも止まりました。`activateOne()`の`catch`は記録後`capabilityPackageManager.rollbackRuntime()`で戻すか、状態と準備状態`"error"`を保存します。正常なパッケージまで次回以降も旧版や`"error"`のままになる可能性がありました。

**追加内容。**

- `lib/fastify-inject-gate.ts`：`buildApp()`はインスタンス作成直後に`holdInjectUntilRegistered(app)`を呼び、`return app`直前で解放します。それ以前のPromise／コールバック形式の`app.inject()`は登録完了を待ち、後から追加されたルートにも到達します。保留`inject()`の例外はコールバックへ渡します。
- `activate()`と`selfCheck()`は登録の一部なので、自分の内部ルートを待つと永久待機します。`activateOne()`は両方を`failInjectFastDuring()`内で実行し、直接`inject()`すると即座に`InjectDuringRegistrationError`（`code`は`MARINARA_INJECT_DURING_REGISTRATION`）になります。そのパッケージだけ失敗し、起動は継続します。`activate()`の復帰後に動くタイマーは他の背景呼び出し同様に待機します。
- 他の保留呼び出しは60秒で呼び出し元スタック付き警告、10分で同じエラーになります。停止した起動を明示的に失敗させます。タイマーはunrefされ、プロセスを生存させません。
- `capability-module-runtime.service.ts`の`isHostLifecycleActivationError()`は`AVV_ERR_ROOT_PLG_BOOTED`（"Root plugin has already booted"）と`FST_ERR_INSTANCE_ALREADY_LISTENING`（"Fastify instance is already listening"）を認識します。これらではロールバックや状態／準備状態`"error"`の永続化をせず、版と状態を維持して次回通常どおり有効化します。warnは1回で、診断にも残します。他の失敗はerror、ロールバック、`"error"`を維持します。
- 回帰テスト：`startup-inject-gate`。

**変わらない点。** `buildApp()`後は`app.inject()`がラッパーなしのFastify本来の呼び出しに戻ります。引数なしのチェーン形式(`app.inject()`)は保留しません。登録順、ルート、`runCapabilityInternalRoute()`、スケジューラー、起動後の有効化／更新は同じです。稼働中の例外は、UIから有効化したパッケージが新規ルートを加える場合です。`FST_ERR_INSTANCE_ALREADY_LISTENING`は従来どおり返しますが、新版は取り消さず次回起動用にインストールを維持します。呼び出し元はエラーを受け取ります。

**確認方法。**

```sh
node scripts/run-regressions.mjs --filter startup-inject-gate
```

解放後の実行と後追加ルート、コールバック、`activate()`内の即時失敗、`activate()`のタイマー、短い試験値での10分制限、`buildApp()`の設置と解放、ホストライフサイクルエラーでロールバック前に戻り警告1件となることを確認します。

**無効化／取り消し。** スイッチはありません。`MARINARA_INJECT_DURING_REGISTRATION`は`InjectDuringRegistrationError`のコードであり設定ではありません。injectゲートのコミットを取り消します。

---

<a id="a6-feature-switches-settings--advanced--features"></a>

## A6. 機能スイッチ：Settings > Advanced > Features

**既存の仕組み。** 任意のサーバー動作は環境変数（A3/A4）で、統一UIはありません。追加ごとに設定、ルート、UIが必要でした。

**追加内容。** 単一レジストリと設定節です。F/G/Hが後から追加します。詳細は`docs/configuration/features.md`です。

- `packages/shared/src/schemas/feature-settings.schema.ts`は名前と既定値を定義し、`features`のJSONオブジェクトに既定と異なる値だけ保存します。
- 2つのスイッチ：**Stable lorebook picks**（`stableLorebookGroupPicks`、A3a）、**Retry failed provider calls**（`providerRetry`、A4d）。
- `services/features/feature-settings.ts`の`isFeatureEnabled()`はメモリコピーを読み、頻出経路の負担を避けます。設定ルート登録時に読み、行の書き込み／削除、該当するProfessor MariのDBコマンド、`.env`再読み込み後に更新します。`GET`と`PUT /api/app-settings/features`があり、`PUT`は厳密検証します。
- 環境変数はオン・オフとも優先です。`LOREBOOK_STABLE_GROUP_WINNERS`と`PROVIDER_RETRY_TRANSIENT_ERRORS`は別途読む代わりにスイッチを固定します。
- クライアントのSettings > Advanced > Featuresに並び、環境固定は変数名付きのロック表示です。他の部品は`useFeatureEnabled()`を使います。

**変わらない点。** すべて既定で無効で、節を開かなければ従来どおりです。設定済み環境変数の効果も同じです。

**確認方法。** `node scripts/run-regressions.mjs --filter feature-settings`でレジストリ、既定値、正規化、環境優先、ルート、保存、Mari型無効化、リスナーを確認します。UIはSettings > Advanced > Featuresか`features`検索です。

**無効化／取り消し。** 両スイッチを切るか変数を解除します。コミットを戻すと仕組みがなくなり、変数は以前どおり単独で動きます。

---

<a id="a7-logged-best-effort-helpers"></a>

## A7. ログ付きベストエフォートヘルパー

追加ヘルパーで、スイッチも単独の動作変更もありません。

**既存の仕組み。** クリーンアップ、カーソル進行、キャッシュ書き込みなどで空の`catch`による意図的無視があります。動作は正しいですが記録が残りません。

**追加内容。** `packages/server/src/lib/best-effort.ts`に`logSuppressed`、`orFallback`、`bestEffort`を追加します。無視した失敗を`logRateLimited`（A2）で記録し、イベント・チャット・段階ごとに毎分最大1行です。D/Eの修正が空のcatchを置き換える際に使います。

**変わらない点。** このPRではまだ呼び出さず、既存経路は不変です。

**確認方法。** `node scripts/run-regressions.mjs --filter best-effort`。

**無効化／取り消し。** スイッチなし。コミットを戻すとファイルを除去します。

---

<a id="coming-in-later-pull-requests"></a>

# 後続のpull request

意図的に短い節です。各PRを開くときに同じ5項目で補います。

<a id="pr-b-dev-mcp-for-coding-assistants"></a>

Status: PR Aは#6647、PR Bは#6648としてマージされました。PR C(#6649)はマージされずにクローズされ、PR DからHは個別のプルリクエストとして作成されませんでした。以下のCからHの節は、書かれた時点の計画を説明したものです。この形で出荷された機能として読まないでください。

## PR B：コーディング支援用Dev MCP

`tools/dev-mcp`の任意ローカルサーバーで、pnpmワークスペースとDockerイメージの外に置きます。A2の追跡を使い、Bが追加する`tools/dev-mcp/README.md`に設定と検証を記載します。

<a id="pr-c-command-palette-and-keyboard-shortcuts-overlay"></a>

## PR C：パレットとショートカット一覧

CでCtrl+Kパレットと「?」一覧を追加します。クライアントのみ、スイッチなし、既存キー割り当ては不変です。

<a id="pr-d-reviewed-server-fixes-part-1"></a>

## PR D：レビュー済みサーバー修正その1

Dでルート、ミドルウェア、復旧、チャット／生成、インポーター、サイドカー、SSRFを修正し、各回帰テストを追加します。修正なのでスイッチなしです。

<a id="pr-e-reviewed-server-fixes-part-2"></a>

## PR E：レビュー済みサーバー修正その2

Eでサービスと保存を修正します。各回帰テスト付き、スイッチなしです。

<a id="pr-f-prompt-caching"></a>

## PR F：プロンプトキャッシュ

FでClaudeサブスクリプション履歴マーカー修正、Claude Agent SDK更新、キャッシュ向け構成（既定無効スイッチ）、チャット別の低キャッシュ送信警告（既定無効）、任意診断を追加します。

<a id="pr-g-generation-jobs-and-console-tray"></a>

## PR G：生成ジョブとコンソールトレイ

Gでタブを閉じても続く画像・スプライト・動画ジョブと一覧（既定無効スイッチ）、Windowsトレイアイコン（既定無効スイッチ）を追加します。

<a id="pr-h-engine-diagnostics-and-launcher"></a>

## PR H：Engine診断とランチャー

Hで起動時整合性、実行時メモリ計測、任意デバッグファイル、背景呼び出し上限（既定無効スイッチ）、ランチャー保護、常に推論するモデルに対する推論無効化指定なしの再試行を追加します。

---

<a id="test-results-for-pr-a-on-the-development-machine"></a>

## 開発機でのPR Aのテスト結果

`staging`の基点`dd876831a`で確認しました。有料モデル呼び出しは行っていません。

- **LinuxのNode回帰**：CIの`complete-node-regressions`と同じ方法（WSL上Ubuntu 24.04、Node 24、`pnpm install --frozen-lockfile`、`pnpm regression`）で384ファイルすべて成功です。高負荷時の`server-signal-shutdown`は30秒制限に達することがあり、未変更`staging`でも同様でした。時間依存の`smart-group-decision`、`agent-activation-questions`、`advanced-memory-core`は各1回失敗し、その後の再実行はすべて成功しました。
- **WindowsのNode回帰**：384中379成功。`decision-sidecar-runtime`、`gallery-previews`、`request-timeouts`、`server-signal-shutdown`、`storage-writer-lock`は同じ機械の未変更`staging`でも失敗します。原因はローカルのファイルロック、コンソールシグナル、空き容量確認です。
- **型・lint・整形・ビルド**：shared、server、client、ルート、トークン推定プロジェクトの`tsc --noEmit`、lintエラー0、`packages/**/*.{ts,tsx}`のPrettier、ロケールと静的JSX検査、クライアント／サーバービルド。
- **設定のブラウザーテスト**（`core-flows`、`issue-sweep-settings`、`ux-feedback-sweep`、`afternoon-sweep`、`client-runtime-diagnostics`）を`mobile-chromium`で実行：171成功、0失敗。`mobile-webkit`（WindowsのWebKit）で再実行後に残る失敗も未変更`staging`と同じです。
- **Features節**を標準／SillyTavernテーマ、明暗、デスクトップ／スマートフォンサイズで目視確認しました。
