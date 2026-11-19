# サーバーログ

このページではMarinara Engineのサーバーログの読み方と、役立つログの書き方を説明します。[CONTRIBUTING.mdのLogging節](../../CONTRIBUTING.md#logging)を補足するもので、置き換えません。共有Pinoロガー、エラーオブジェクトを先頭に渡す呼び出し、書式指定子、4段階のレベル表は引き続き適用されます。

<a id="what-every-line-carries"></a>

## 各行の情報

すべてのサーバーログは`packages/server/src/lib/logger.ts`の`logger`という1つのPinoインスタンスから出ます。Fastifyも`loggerInstance`で同じものを使い、`req.log`、`reply.log`、`app.log`はその子です。シリアライザーを共有し、環境監視による`LOG_LEVEL`のホットリロードにも追従します。

| フィールド | 対象 | 意味 |
| --- | --- | --- |
| `pid` | 全行 | プロセスID(Pinoの既定)。 |
| `hostname` | 全行 | ホスト名(Pinoの既定)。 |
| `bootId` | 全行 | プロセス起動ごとに新しい8桁の16進文字。同じログファイルの別の実行を区別します。 |
| `requestId` | リクエスト由来の全行 | 応答ヘッダー`x-request-id`と同じ値。`req.log`だけでなく、サービス内の共有`logger`にも付きます。 |
| `route` | 本文解析後の行 | 一致したルートパターン。例は`/api/chats/:id`。生のURLは入りません。 |

<a id="request-ids"></a>

### リクエストID

`lib/request-logging.ts`が各リクエストへIDを付けます。

- クライアントは`x-request-id`を送れます。`A-Z a-z 0-9 . _ : -`からなる8～80文字なら保持し、それ以外は置き換えます。
- なければサーバーがUUIDを作ります。Fastifyの既定の`req-1`カウンターは起動ごとに戻るため、IDが重複していました。
- IDはCORSで公開する`x-request-id`ヘッダーで返します。バグ報告に含めれば、`grep <id>`でそのリクエストの全行を探せます。

IDは`AsyncLocalStorage`コンテキスト(`lib/log-context.ts`)に保存し、Pinoのmixinが各行へコピーします。受け渡しは不要で、サービスの奥の`logger.warn(err, "...")`も自動取得します。本文解析はHTTPパーサー独自の非同期コンテキストで動くため、解析後にコンテキストを再設定します。

コンテキストはリクエスト内で開始するタイマー、リスナー、子プロセスなどすべてに引き継がれます。リクエストより長く生きる処理の開始は`runWithRootLogContext({}, fn)`で包み、後の行に開始元のIDを残さないようにします。ローカルサイドカーはllama-serverとMLX、DecisionサイドカーとUtilityサイドカーも自分のプロセスに同じ方法を使います。後のリクエストと共有する起動に、最初の呼び出し元のIDが付いたままにはしません。ルートハンドラーが開始したその他の長寿命タイマーやポーラーは、同様に包むまでそのルートの`requestId`を保持します。

<a id="request-lines"></a>

### リクエストのログ行

`RequestLogController`はFastify既定の`LogController`に次の変更を加えたものです。

- ID名は`requestId`です。Fastify既定の`reqId`を使う保存済み検索やフィルターは、新しい名前へ変更が必要です。
- `incoming request`と`Route ... not found`ではクエリー文字列を除きます。トークンや検索文が含まれる可能性があるためです。入力行はほかの`req`フィールド(`method`、`version`、`host`、`remoteAddress`、`remotePort`)を残し、`route`を加えます。
- クライアントが途中で切断すると、infoで`Client aborted request`を1行記録します。Fastifyはここで何も記録していませんでした。

`LOG_DISABLE_REQUEST_LOGGING`は従来どおり動き、中断行も無効にします。

`pnpm dev`ではpino-prettyが既定の`hostname`と`bootId`を隠します。本番のJSON出力は両方を保持します。

<a id="startup-timeline"></a>

## 起動の時系列

`lib/startup-timeline.ts`が起動の各段階を計測します。

```ts
const db = await startup.phase("storage.open", () => getDB());
```

- 各行は`event: "startup.phase"`、`stage`、`elapsedMs`(経過時間)、`selfMs`(入れ子のフェーズを除く自身の時間)を持ちます。レベルは`selfMs`に従い、1秒未満はdebug、1秒超はinfo、15秒超はwarnです。既定の`LOG_LEVEL=warn`では、遅い初回を含む正常起動でフェーズ行は出ません。
- フェーズは入れ子になります。`index.ts`の`app.build`は`buildApp`内の全フェーズを包みます。`selfMs`基準なので遅い内側の段階は自身で1回報告し、`app.build`は内側以外の自身の処理が遅くない限りdebugのままです。
- 失敗した段階はフェーズ内で記録しません。エラーをそのまま上へ渡し、`index.ts`の`main().catch`が段階名(`startup.stageOf(err)`)付きの`startup.failed`を1行記録します。
- 待ち受け開始後、`index.ts`は`[startup] Ready in N ms`をinfoで1行記録し、`event: "startup.ready"`、フェーズ数、`selfMs`の大きい上位5段階を含めます。

フェーズはログコンテキストに`stage`を加えません。フェーズ中に始まるサービスはタイマーを保持するため、加えるとプロセス終了までその段階名が残ってしまいます。

<a id="one-line-per-failure"></a>

## 失敗1件につき1行

失敗は、その後の動作を決めるコードがちょうど1行だけ記録します。

- **記録するか再スローするかのどちらかにします。**再スロー時は呼び出し元が記録します。追加情報が役立つなら、`[agent-tools] ... failed`のツール名のようにdebugへ出します。
- **記録場所：**
  - 不明な500：`middleware/error-handler.ts`
  - エージェント失敗：`executeAgent`(非致命的なのでwarn)
  - チャット生成失敗：`generate.routes.ts`のメインcatch
  - 対応するプロバイダーは記録せずスローします。追加するとしてもGrok CLIやClaude (Subscription)のように、モデル名と生のエラーをdebugで出すだけです。Claude (Subscription)はSDKのエラー文を含む分かりやすいメッセージをスローするため、SDKエラーをさらに`cause`へ付けません。チャットのSSEエラーとエージェントのエラー文は原因のメッセージを追記するので、付けると同じ文が2回表示されます。
- **キャンセルはinfoです。**ユーザーによる停止、タブの終了、シグナルの中断は想定内です。`lib/log-context.ts`の`failureLevel(err)`または`failureLevel(err, "warn")`を使います。`isCancellation(err)`がtrueなら`"info"`を返します。`TimeoutError`は本当の失敗で、キャンセル扱いしません。

  ```ts
  logger[failureLevel(err)](err, "[agent-batch] Batch call FAILED: %s", errMsg);
  ```

- **原因を保持します。**`new Error("Could not save chat", { cause: err })`で包みます。`err`と`error`のシリアライザーが原因のメッセージとスタックを追記します(`caused by: ...`)。`{ error }`で記録したErrorもシリアライズされ、`{}`とは表示されなくなります。

<a id="repeating-failures"></a>

## 繰り返す失敗

ポーラー、状態確認、ターンごとのフックは数秒ごとに同じ失敗を起こすことがあります。`lib/log-rate-limit.ts`の`logRateLimited`を使います。

```ts
logRateLimited("warn", "autonomous-scheduler:poll", err, "[autonomous-scheduler] Poll failed");
```

キーごとの初回を記録し、時間枠内(既定60秒)の後続は数えて、次の行に`suppressedRepeats`を付けます。キーにはパッケージIDやチャットIDなど失敗対象を含め、1つの不具合が別の不具合を隠さないようにします。

<a id="prompt-and-model-text"></a>

## プロンプトとモデルの本文

プロンプト、モデル出力、プロバイダー応答やポーリングの本文は**debug**へ出し、warnやerrorには入れません。ユーザーの物語を含む場合があり、プロバイダーの本文は認証情報やプロンプトを繰り返すこともあります。warnにはサイズ(`rawLength`、`bodyLength`)と理由を記録します。JSON解析のエラーメッセージは失敗した本文を引用する可能性があるので、warnはエラー型だけにします。エラー本体と本文は別のdebug行へ出します。

```ts
logger.warn(
  { errorType: err instanceof Error ? err.name : typeof err, rawLength: raw.length },
  "[game/scene-wrap] Failed to parse LLM response as JSON",
);
logger.debug({ err }, "[game/scene-wrap] Unparsed LLM response: %s", raw.slice(0, 200));
```

UIのデバッグ切り替えは`logDebugOverride`経由で引き続き機能します。`LOG_LEVEL`でdebugを隠していてもプロンプトを確認するための仕組みです。

<a id="checks"></a>

インラインメディアは通常、全文をログに出しません。`debugJson`は各base64ペイロードを`[image/png base64, ~1.2 MB: iVBORw0KGgoAAAA...ElFTkSuQmCC]`のようなマーカーで置き換え、種類、サイズ、先頭と末尾の各16文字を表示します。文字列全体やテキスト内の`data:` URLと、AnthropicやGoogleのメディアパートの単独の`data`フィールドが対象です。base64が複数行に折り返されていても処理します。`msg`シリアライザーも通常の`%s`と`%j`の行にある`data:` URLに同じ処理を行います。単独の`data`フィールドを短縮するのは`debugJson`だけです。変更は出力用のコピーだけに適用し、渡された値は編集しません。`.env`に`LOG_INLINE_MEDIA=full`を設定すると、再びペイロード全体を出力します。`log-inline-media`回帰テストがこの動作を確認します。

## アプリ内コンソール

NAS、VPS、Docker、Termuxなど、ターミナルにアクセスできない環境では、Settings → Advanced → **Open Console**(コンソールを開く)からサーバーの最近のログをアプリ内で確認できます。

- `lib/log-buffer.ts`は直近1,500行をメモリーに保持します。全体で約400万文字までで、メッセージやフィールドの各ブロックは16,000文字で切り詰められます。ディスクには書き込まれず、再起動すると空になります。
- `logger.ts`はPinoの`hooks.streamWrite`を通じてシリアライズ済みの行をすべてコピーします。バッファーには、同じ`LOG_LEVEL`でターミナルやログファイルに出た行が入ります。dotenvの`injected env`行や子プロセスの生出力など、Pinoを経由しない行は入りません。
- `GET /api/admin/logs?afterId=`は`afterId`より後の行に加え、`latestId`、`truncated`(読み取り前に破棄された行があるかどうか)、サーバーの`logLevel`を返します。`requirePrivilegedAccess`で保護され、`no-store`が適用されます。ルートが`logLevel: "silent"`で実行されるため、コンソール自身のポーリングは記録されません。
- このページのルールはコンソールにも適用されます。warnやerrorのログはリモートの管理者がアプリで読むため、プロンプトとプロバイダーへのリクエストとその応答の本文はdebugに留めてください。

## 検証

このページの内容は`logging-request-trail`、`logging-failure-lines`、`logging-startup-timeline`の回帰テストで確認し、アプリ内コンソールは`server-console-logs`で確認します。

```sh
node scripts/run-regressions.mjs --filter logging-
```
