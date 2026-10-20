# Engine 기반: 시리즈 개요

이 문서는 Engine 기반 기여 작업(issue #6624)을 정리합니다. 처음의 큰 pull request를 A부터 H까지 8개로 나누어 각각 검토할 수 있게 했습니다. 모두 Marinara Engine에서 이미 잘 작동하는 코드를 활용합니다. 기존 API 이름, 공유 로거, 파일 규칙을 바꾸지 않습니다. 모두에게 적용되는 변경은 명시하며, 나머지는 직접 켜기 전까지 꺼져 있습니다.

<a id="the-pull-requests"></a>

## Pull request 목록

| PR | 내용 | 의존성 |
| --- | --- | --- |
| **A** | 기반: 격리된 회귀 실행, 요청 추적과 시작 타임라인, 선택적 로어북 설정 2개, 선택적 견고성 설정과 런타임 진단, 시작 inject 게이트, 기능 스위치, 최선 노력 헬퍼 | 없음(이 PR) |
| **B** | 코딩 도우미용 Dev MCP(`tools/dev-mcp/`) | 없음 |
| **C** | Ctrl+K 명령 팔레트와 "?" 단축키 오버레이(클라이언트만, 스위치 없음) | 없음 |
| **D** | 검토된 서버 수정 1부: 라우트와 미들웨어, 저장소 복구, 채팅과 생성, 가져오기, 사이드카, SSRF | A |
| **E** | 검토된 서버 수정 2부: 서비스와 저장소 | A |
| **F** | 프롬프트 캐시: Claude 구독 캐시 마커 수정, Agent SDK 업데이트, 캐시 친화적 구성, 낮은 캐시 사용 전송 경고, 진단 | A |
| **G** | 탭을 닫아도 계속되는 생성 작업, 작업 보기, Windows 콘솔 트레이 | A(팔레트 동작은 C도 필요) |
| **H** | Engine 진단과 실행기: 빌드 무결성, 메모리 계측, 프롬프트 디버그 파일, 백그라운드 호출 한도, 백업과 준비 후 열기, 추론 비활성화 관련 재시도 | A |

A, B, C는 독립적이어서 순서와 관계없이 검토할 수 있습니다. D부터 H는 A 이후에 진행하며 기능 레지스트리(`isFeatureEnabled`, Settings > Advanced > Features), 로그 추적과 최선 노력 헬퍼를 쓰거나 시작 타임라인과 진단 라우트를 확장합니다. 각각 스위치, CHANGELOG 항목, 이 문서의 절을 추가합니다.

A의 각 부분은 기존 동작, 추가 사항, 유지되는 점, 확인 방법, 끄거나 되돌리는 방법을 설명합니다.

기본값: 저장 데이터, 프롬프트, 재시도, 서버 시작 구성 변경은 환경 변수나 **Settings > Advanced > Features**(설정 > 고급 > 기능, A6) 뒤에서 기본적으로 꺼져 있습니다. 아무것도 켜지 않으면 기존 동작입니다. 버그 수정, 테스트 실행기, 추가 헬퍼에는 스위치가 없으며 각 절에서 명시합니다.

되돌리기: A의 커밋에는 순서가 있고 일부 파일(`app.ts`, `index.ts`, `runtime-config.ts`, `capability-module-runtime.service.ts`, `CHANGELOG.md`)이 겹칩니다. 최신 커밋부터 되돌리면 충돌을 피할 수 있습니다.

대부분 기존 회귀 실행기로 확인합니다. 먼저 공유 패키지를 한 번 빌드(`pnpm build:shared`)하고 저장소 루트에서 명령을 실행하세요.

---

<a id="pr-a-foundations"></a>

# PR A: 기반

> **Decision 모델 업데이트 위로 리베이스했습니다.** Decision 호출은 이미 해당 요청 안에서 실행되어 그 `requestId`를 가집니다. Decision 및 유틸리티 사이드카는 루트 로그 컨텍스트에서 시작하므로 후속 로그에 첫 요청자의 ID가 남지 않습니다. 실패한 Decision 슬롯은 턴마다 여러 경고 대신 빈도가 제한된 경고 하나를 남깁니다. 사용자 중단은 info, 버린 Decision 문 개수는 warn, 본문은 debug만 사용합니다. 종료 시 두 사이드카를 이름 있는 단계로 중지합니다. Decision 호출은 공급자 재시도 래퍼를 거치지 않아 이중 재시도하지 않습니다.

<a id="a1-test-harness-each-regression-file-runs-in-its-own-data-folder"></a>

## A1. 테스트 환경: 회귀 파일마다 별도 데이터 폴더

**기존 동작.** `scripts/run-regressions.mjs`가 회귀를 찾아 `runRegression()`으로 하나씩 실행하며 시간 제한과 신호(`terminateActiveChild`, `releaseActiveChild`, `FILE_TIMEOUT_MS`)를 처리합니다. 자식 프로세스는 개발자의 `process.env` 전체를 받습니다. 서버는 `MARINARA_ENV_FILE`으로 `.env` 경로를 바꿀 수 있고(`packages/server/src/config/runtime-config.ts`의 `getEnvFilePath()`), `e2e/start-servers.mjs`도 이미 이렇게 서버를 격리합니다.

**추가 사항.** 작은 헬퍼 `regressionEnvironment(scratchDir)`입니다. `runRegression()`이 파일별 임시 폴더(OS 임시 경로의 `marinara-regression-*`)를 만들고 자식의 `DATA_DIR`, `FILE_STORAGE_DIR`, `MARINARA_ENV_FILE`을 그 안으로 지정합니다. 성공, 실패, 시간 초과, 시작 실패 모두 끝나면 삭제합니다. 자체 격리를 빠뜨린 회귀도 개발자의 `.env`를 읽거나 실제 데이터의 쓰기 임대와 충돌하지 않습니다.

**유지되는 점.** 함수, `--filter`/`--list`, 시간 제한, 요약, `package.json` 스크립트, CI는 같습니다. 자체 변수를 설정하는 회귀는 그 값을 씁니다. 셸에서 내보낸 `DATA_DIR`, `FILE_STORAGE_DIR`, `MARINARA_ENV_FILE`은 파일별로 교체되며, 의도된 테스트 전용 변경입니다.

**확인 방법.**

```sh
node scripts/run-regressions.mjs --filter env-watcher
```

이후 임시 폴더에 `marinara-regression-*`이 남지 않아야 합니다.

**끄기 / 되돌리기.** 스위치 없이 격리가 기본입니다. 실행기 커밋을 되돌리면 이전 방식으로 돌아갑니다. 먼저 후속 커밋을 되돌리세요. 공유 파일은 `CHANGELOG.md`과 `CONTRIBUTING.md`뿐입니다. `MARINARA_REGRESSION_INHERIT_STORAGE=1` 같은 제외 옵션은 몇 줄이면 가능하지만 요청되지 않은 설정이라 추가하지 않았습니다.

---

<a id="a2-logging-follow-one-request-one-boot-and-one-failure"></a>

## A2. 로그: 요청 하나, 시작 하나, 실패 하나 추적

**기존 동작.** `packages/server/src/lib/logger.ts`는 공유 Pino `logger`를 내보냅니다. `protectTerminalLogger`은 터미널 종료로 인한 서버 충돌을 막고 `logDebugOverride`는 UI 디버그 전환을 지원합니다. `CONTRIBUTING.md`의 Logging 규칙인 공유 로거, 오류 객체 먼저, 형식 지정자, 4단계 수준을 모두 유지합니다. `app.ts`의 `buildApp()`은 Fastify에 자체 옵션을 주어 같은 수준의 두 번째 Pino를 만들었고, ID `req-1`/`req-2`는 시작마다 초기화되었습니다.

**추가 사항.** 자세한 내용은 `docs/development/logging.md`이며 `CONTRIBUTING.md`의 Logging에서 연결합니다.

- Fastify가 공유 로거(`loggerInstance: logger`)를 씁니다. `req.log`은 같은 직렬화기를 쓰고 `followLogLevel`으로 `LOG_LEVEL` 핫 리로드를 따릅니다. 종료 시 구독을 해제합니다. `CONTRIBUTING.md`에 이미 설명된 방식입니다.
- 요청에서 발생한 모든 줄에 `requestId`가 붙고 내부 서비스도 포함됩니다(`lib/log-context.ts`, `AsyncLocalStorage` 컨텍스트와 Pino mixin). UUID 또는 올바른 클라이언트 `x-request-id`이며, 보고용으로 `x-request-id` 헤더에 반환합니다.
- 모든 줄에 `bootId`가 있어 한 파일에서 여러 실행을 구분합니다.
- 시작 타임라인 `lib/startup-timeline.ts`: `app.ts`/`index.ts`의 단계를 `startup.phase("name", fn)`으로 감쌉니다. info 줄 `[startup] Ready in N ms`은 느린 단계를 나열하고 시작 실패는 해당 단계를 표시합니다.
- 실패당 한 줄: 공급자와 도구는 먼저 기록하지 않고 다시 던집니다. 생성 실패는 error 한 줄, 사용자 중지는 `failureLevel(err)`을 통한 info입니다. `cause` 체인을 보존합니다.
- 상태 검사, 스케줄러 폴링, 프롬프트 컨텍스트 제공자의 반복 실패는 `logRateLimited`과 `suppressedRepeats`을 씁니다.
- 모델 출력, 주사위 요청, Spotify 토큰 본문, 비디오 폴링 본문은 debug로 옮기고 warn에는 길이만 표시합니다.
- 회귀 3개: `logging-request-trail`, `logging-failure-lines`, `logging-startup-timeline`.

**유지되는 점.** `logger`의 내보내기와 파일, `protectTerminalLogger`, `logDebugOverride`, `pid`/`hostname`, 기존 `logger.*`/`req.log` 호출은 같습니다. Fastify `LogController`은 교체가 아닌 하위 클래스로 확장합니다. `LOG_LEVEL`(기본 `warn`), `LOG_DISABLE_REQUEST_LOGGING`도 같습니다. `pnpm dev` 콘솔에서는 pino-pretty가 `bootId`와 `hostname`을 숨겨 새 필드가 보이지 않습니다. `CONTRIBUTING.md`은 추가만 합니다.

`logging.md`에 설명된 변경:

- `reqId` 대신 `requestId`를 씁니다. 저장된 `reqId` 필터는 이름을 바꿔야 합니다.
- 수신 요청 및 찾지 못한 경로 로그에서 토큰을 포함할 수 있는 쿼리 문자열을 뺍니다. 다른 `req` 필드는 유지하고 `route`를 추가합니다.
- info의 `Client aborted request`을 추가하며 `LOG_DISABLE_REQUEST_LOGGING`으로 끌 수 있습니다.
- 하위 단계를 뺀 자체 시간 `selfMs`이 15초를 넘는 시작 단계는 기본 수준에서도 보이는 warn입니다. 중첩(`app.build`이 `buildApp`를 포함)해도 자체 시간 기준이라 느린 단계 하나에 한 줄입니다.

**확인 방법.**

```sh
node scripts/run-regressions.mjs --filter logging-
```

또는 서버에 요청을 보내 반환된 `x-request-id`를 `grep`으로 찾으세요.

**끄기 / 되돌리기.** `LOG_DISABLE_REQUEST_LOGGING=true`은 기존처럼 요청 로그를 끄고 `LOG_LEVEL=warn`는 새 info를 숨깁니다. 전체를 제거하려면 후속 코드 커밋을 먼저 되돌린 뒤 로그 커밋을 되돌리세요.

---

<a id="a3-performance"></a>

## A3. 성능

두 옵션 모두 기본적으로 꺼져 있으며 이때 프롬프트와 저장 데이터는 바이트 단위로 같습니다. `.env.example`과 `docs/CONFIGURATION.md`의 Lorebooks 표에 설명합니다.

<a id="a3a-stable-lorebook-group-winners-lorebook_stable_group_winners-switch-stablelorebookgrouppicks"></a>

### A3a. 로어북 그룹의 일관된 선택(`LOREBOOK_STABLE_GROUP_WINNERS`, 스위치 `stableLorebookGroupPicks`)

**기존 동작.** `packages/server/src/services/lorebook/keyword-scanner.ts`의 `applyGroupSelection()`은 포함 그룹마다 가중 추첨(`pickWeightedGroupEntry`)으로 하나를 고르며 유지 항목을 우선합니다. 난수원은 주입 가능(`random`, 기본 `Math.random`)하여 변경이 쉬웠습니다. 매번 추첨하면 다른 변화 없이도 선택이 달라져 프롬프트 접두부와 공급자 캐시가 깨질 수 있습니다.

**추가 사항.** `applyGroupSelection`/`ScanOptions`에 선택적 `groupSeed`를 추가합니다. 켜면 `processLorebooks`가 채팅 ID를 전달하여 같은 활성 후보는 그 채팅에서 매 턴 같은 선택을 만듭니다. 다른 채팅과 후보 집합은 달라질 수 있습니다. Active Context(활성 컨텍스트)의 기존 `stableHash` + `createSeededRandom`를 `lorebooks.routes.ts`에서 공유 `lorebook/seeded-random.ts`로 그대로 옮겨 같은 생성기를 씁니다. A6부터 **Stable lorebook picks**(일관된 로어북 선택)도 제공하며 환경 변수가 우선합니다.

**유지되는 점.** 이름과 서명(새 인수는 선택적), 유지 처리, 가중치는 같습니다. 주입 난수는 확률 관문을 계속 제어하지만 켜면 그룹 선택은 시드가 결정하여 Active Context와 생성이 일치합니다. 끄면 시드를 전달하지 않고 기존 경로입니다.

**확인 방법.** `node scripts/run-regressions.mjs --filter lorebook-group-seed`이 변수와 스위치를 확인합니다.

**끄기 / 되돌리기.** `LOREBOOK_STABLE_GROUP_WINNERS`를 설정하지 않고 스위치를 끄세요.

<a id="a3b-compact-stored-lorebook-scans-lorebook_compact_stored_scans"></a>

### A3b. 저장된 로어북 스캔 압축(`LOREBOOK_COMPACT_STORED_SCANS`)

**기존 동작.** 생성 메시지는 활성 항목 전체를 `extra.lorebookScan`에 저장하며 메시지 행과 각 스와이프에 반복합니다. Active Context가 정확한 생성 내용을 보여주지만 큰 로어북의 긴 채팅에서는 테이블이 매우 커집니다.

**추가 사항.** 켜면 Active Context와 에이전트 재시도가 읽는 최신 어시스턴트/내레이터 메시지는 행과 모든 스와이프에 전체 텍스트를 유지합니다. 이전 스와이프도 원래 내용을 보여줍니다. 사용자 사칭 턴의 스캔은 압축하며 그 자리를 차지하지 않습니다. 이전 메시지는 ID, 이름, 키, 점수만 남깁니다. 생성 저장 경로에서 압축하지 않고, 백그라운드에서 이전 메시지를 메시지 큐 하나씩 처리합니다. 오류는 `logRateLimited`으로 기록하고 다음 저장 때 재시도합니다. 새 메시지를 지우면 Active Context(`lorebooks.routes.ts`)와 재시도(`retry-agents-route.ts`의 `storedContentForTextlessScanEntries`)는 항목의 현재 저장 텍스트로 대체합니다. `scripts/compact-lorebook-scans.mjs`는 이전 채팅에도 적용합니다. 기본 모의 실행, 서버가 쓰기 임대를 가지면 거부, `--apply` 전에 두 테이블 백업입니다.

**유지되는 점.** 끄면 새 쓰기 없이 기존 구조입니다. 스캔 형식과 Active Context/재시도 응답은 유지하며 텍스트가 없을 때만 대체합니다. 기본 동작의 작은 수정 2개도 텍스트 없는 옛 스캔만 해당합니다. Active Context는 빈 문자열 대신 저장 텍스트를 보여주고 재시도는 항목을 빼지 않고 포함합니다.

**확인 방법.** `node scripts/run-regressions.mjs --filter lorebook-scan-compaction`은 기본 구조, 스와이프 복귀, 사칭 턴, 첫 저장 시 이전 메시지 정리, 실제 Active Context 경로의 대체, 유지보수 스크립트를 확인합니다.

**끄기 / 되돌리기.** `LOREBOOK_COMPACT_STORED_SCANS`을 미설정 또는 `false`로 둡니다. 이미 압축된 메시지는 그대로이고 최신 메시지는 텍스트를 유지합니다. `--apply` 백업으로 예전 구조를 복원할 수 있습니다.

---

<a id="a4-robustness"></a>

## A4. 견고성

모두 기본적으로 꺼진 환경 설정이며 `docs/CONFIGURATION.md`의 견고성 표와 `.env.example`에 설명합니다. 별도 파일이라 독립 검토, 분리, 되돌리기가 가능합니다. 새 인수와 필드는 선택적이며 이 커밋은 `isRateLimitError`/`base-provider.ts`을 바꾸지 않습니다.

<a id="a4a-storage-writes"></a>

### A4a. 저장소 쓰기

**기존 동작.** `packages/server/src/db/file-backed-store.ts`은 변경된 샤드와 `manifest.json`를 `serializeTableRows()`/`atomicWriteFile()`로 기록하고 복구용 `.bak`를 남깁니다. 원자적 쓰기와 백업 설계는 유지합니다.

**추가 사항.**

- `STORAGE_SKIP_UNCHANGED_WRITES`은 내용이 이 프로세스의 마지막 영구 쓰기와 같고 디스크의 크기/mtime도 같으면 생략합니다. `.bak`에서 복구한 파일은 항상 다시 씁니다.
- `STORAGE_YIELDING_SERIALIZE`은 큰 샤드를 12ms 조각으로 직렬화하며 이벤트 루프에 양보합니다. 긴 채팅 저장이 다른 요청을 막지 않으며 `serializeTableRows`과 바이트 단위로 같습니다.

**유지되는 점.** 둘 다 끄면 `serializeTableRows`, `beforeTableWrite`, `atomicWriteFile`이 기존대로입니다. 실제 쓰기는 항상 `atomicWriteFile`을 거칩니다.

**확인 방법.** `node scripts/run-regressions.mjs --filter robustness-storage-write`

**끄기 / 되돌리기.** 두 설정을 지정하지 마세요.

<a id="a4b-windows-boot"></a>

### A4b. Windows 시작

**기존 동작.** 쓰기 임대는 `file-backed-store.ts`의 `readBootId()`로 OS 부팅을 식별합니다. 매번 PowerShell(Windows에서 약 1.5~2초)과 `reg.exe` 식별 조회를 실행합니다.

**추가 사항.**

- `STORAGE_CACHE_WINDOWS_BOOT_ID`는 OS 부팅별 정확한 결과를 `DATA_DIR/.writer-boot-id.json`에 캐시합니다(`db/writer-boot-id-cache.ts`). `LOCALAPPDATA`에는 쓰지 않습니다.
- 항상 활성: `reg.exe`/PowerShell에 `windowsHide`를 전달하여 콘솔 없이 시작할 때 창이 깜박이지 않게 합니다. 다른 영향은 없습니다.

**유지되는 점.** 임대 로직과 조회 자체는 같으며 끄면 시작마다 조회합니다.

**확인 방법.** `node scripts/run-regressions.mjs --filter robustness-boot-performance`

**끄기 / 되돌리기.** 설정하지 않거나 `.writer-boot-id.json`을 삭제하세요.

<a id="a4c-shutdown"></a>

### A4c. 종료

**기존 동작.** `packages/server/src/index.ts`는 `shutdown(signal)`으로 SIGINT/SIGTERM 및 Windows 외의 SIGHUP를 처리하고, 반복은 warn과 함께 무시합니다. 8초 `armShutdownDeadline`를 설정하고 모든 런타임 정지를 기다린 뒤 `closeDB()`을 호출합니다. 순서는 유지합니다.

**추가 사항.** `index.ts`/`app.ts`가 쓰는 `lib/shutdown-signals.ts`/`lib/shutdown-steps.ts`:

- `SHUTDOWN_WINDOWS_CONSOLE_SIGNALS`: Ctrl+Break와 콘솔 닫기에도 같은 정상 종료를 수행하며 Windows의 약 5초 안에 맞춥니다.
- `SHUTDOWN_FORCE_EXIT_ON_REPEAT`: 첫 Ctrl+C 뒤 1.5초를 넘겨 두 번째 입력이 오면 강제 종료합니다.
- `SHUTDOWN_EARLY_FLUSH`: 정지 신호 즉시 대기 중 저장을 시작합니다. 실패를 여기서 다시 기록하지 않습니다. 저장소가 이미 기록했고 닫을 때 재시도합니다.
- `SHUTDOWN_RUNTIME_STOP_BUDGET_MS`(최대 2500, 기본 0 = 모두 대기): 신호 종료에서 런타임이 멈춰도 예산 시간이 지나면 `closeDB()`을 호출합니다. 마지막 두 설정은 신호 종료만 해당하며 `admin.routes.ts`의 Advanced Settings 재시작은 같습니다.
- 항상 활성: 정지 3단계에 이름을 붙이고 실패나 1초 초과 지연을 단계와 함께 기록합니다.

**유지되는 점.** 모두 끄면 같은 신호, 반복 무시, `closeDB()` 전 모든 정지 대기, 8초 제한입니다.

**확인 방법.** `node scripts/run-regressions.mjs --filter robustness-shutdown-safety`

**끄기 / 되돌리기.** 설정을 지정하지 마세요. 처음 두 개는 재시작이 필요하며 환경 감시자가 알려줍니다.

<a id="a4d-provider-retry-on-transient-network-errors-provider_retry_transient_errors-switch-providerretry"></a>

### A4d. 일시적 네트워크 오류의 공급자 재시도(`PROVIDER_RETRY_TRANSIENT_ERRORS`, 스위치 `providerRetry`)

**기존 동작.** `packages/server/src/services/llm/rate-limit-aware-provider.ts`의 `RateLimitAwareProvider`은 속도 제한을 `MAX_RATE_LIMIT_RETRIES`까지 점진적 대기로 재시도하고 `Retry-After`를 따릅니다. `connection-fallback-provider.ts`은 대체 연결로 전환합니다. 둘 다 잘 작동하지만 연결 거부나 502는 생성 실패로 끝났습니다.

**추가 사항.** 연결 거부/도달 불가와 502/503은 최대 2번, 0.5~2초의 무작위 대기로 재시도합니다(`Retry-After` 최대 5초). 텍스트나 추론이 전달되기 전만 적용합니다. 504와 소켓 리셋은 제외합니다. 사용 가능한 대체가 있는 주 연결(`transientRetry: false`)에는 적용하지 않아 전환 속도를 유지합니다. 기능 패키지가 `llm.withFallback`에 넘기는 자체 래퍼를 이미 가진 주 연결도 제외합니다. A6부터 **Retry failed provider calls**(실패한 공급자 호출 재시도)가 있으며 환경 변수가 우선입니다.

**유지되는 점.** 속도 제한 일정, 무작위 지연 없음, 콜백은 같습니다. `isRateLimitError`/`base-provider.ts`은 그대로입니다.

**확인 방법.** `node scripts/run-regressions.mjs --filter robustness-provider-resilience`

**끄기 / 되돌리기.** 변수를 지정하지 않고 스위치를 끄세요.

<a id="a4e-runtime-diagnostics"></a>

### A4e. 런타임 진단

**기존 동작.** `packages/server/src/routes/admin.routes.ts`은 `/request-timeouts` 같은 권한 있는 관리 경로를 제공하지만 저장소와 기능 런타임을 함께 보는 읽기 전용 화면은 없습니다.

**추가 사항.** `GET /api/admin/runtime-diagnostics`(`lib/runtime-diagnostics.ts`), `requirePrivilegedAccess`, `no-store`, 분당 30회 자체 제한으로 보호합니다. 상주 데이터 개수, 변경 테이블, 마지막 쓰기 오류, 런타임 활성 여부와 마지막 활성화 실패를 보여줍니다. 선택적 훅은 컨트롤러의 `getStorageStats()`, `db/connection.ts`의 `getFileStoreStats()`, `CapabilityModuleRuntime`의 `runtimeState()`입니다.

**유지되는 점.** 읽기 전용으로 기존 경로, 응답, 접근 규칙은 같습니다.

**확인 방법.** `node scripts/run-regressions.mjs --filter robustness-runtime-diagnostics` 또는 권한 있는 로컬 서버에서 `/api/admin/runtime-diagnostics`을 여세요.

**끄기 / 되돌리기.** 호출하지 않으면 아무 일도 하지 않습니다. 제거하려면 `admin.routes.ts`의 경로와 `lib/runtime-diagnostics.ts`을 삭제합니다.

<a id="two-catches-that-used-to-be-silent"></a>

### 조용히 무시하던 두 catch

CONTRIBUTING에 따라 `import.routes.ts`의 SillyTavern 채팅 헤더 파싱(오류 메시지에 채팅이 포함될 수 있으므로 유형만)과 에이전트 활성화 질문 전송(빈도 제한)을 warn으로 기록합니다.

---

<a id="a5-startup-internal-requests-wait-until-route-registration-has-ended"></a>

## A5. 시작: 내부 요청은 라우트 등록 완료까지 대기

항상 활성인 버그 수정이며 설정이 아닙니다.

**기존 동작.** `packages/server/src/app.ts`의 `buildApp()`은 핵심 경로를 등록하고 `services/capability-packages/capability-module-runtime.service.ts`의 `activateOne()`으로 패키지를 활성화하는 `capabilityModuleRuntime.start(app)`를 기다린 뒤 `startServerAutonomousScheduler(app)`를 시작합니다. 내부 `app.inject()`은 `capability-route-registration.service.ts`의 `runCapabilityInternalRoute()`를 쓰는 패키지, `server-autonomous-scheduler.service.ts`의 자율 스케줄러, `routes/generate/prompt-preview.ts`에서 호출합니다. 첫 `inject()`이 Fastify 전체를 시작하면 경로/훅/플러그인을 추가할 수 없습니다. `buildApp()` 중 이른 타이머나 워커가 호출하면 후속 패키지가 "Root plugin has already booted"로 실패하고 다음 `addHook`이 서버를 멈췄습니다. `activateOne()`의 `catch`는 기록 후 `capabilityPackageManager.rollbackRuntime()`로 되돌리거나 상태/준비 상태 `"error"`를 저장합니다. 정상 패키지도 다음 시작부터 되돌려진 상태나 `"error"`로 남을 수 있었습니다.

**추가 사항.**

- `lib/fastify-inject-gate.ts`: `buildApp()`은 인스턴스 생성 직후 `holdInjectUntilRegistered(app)`를 호출하고 `return app` 직전에 해제합니다. 이전 `app.inject()`은 promise/콜백 모두 기다렸다가 나중에 등록된 경로에도 도달합니다. 보류된 `inject()`이 예외를 던지면 콜백에 전달합니다.
- `activate()`/`selfCheck()`은 등록의 일부여서 자신의 내부 경로를 기다리면 영구 대기합니다. `activateOne()`은 둘을 `failInjectFastDuring()` 안에서 실행하여 직접 `inject()`하면 즉시 `InjectDuringRegistrationError`(`code`는 `MARINARA_INJECT_DURING_REGISTRATION`)로 실패합니다. 해당 패키지만 실패하고 시작은 계속됩니다. `activate()` 반환 후 실행되는 타이머는 다른 백그라운드 호출처럼 기다립니다.
- 다른 보류 호출은 60초 후 호출자 스택과 경고를 내고 10분 후 같은 오류로 거부됩니다. 멈춘 시작이 명확하게 실패합니다. 타이머는 참조를 해제하므로 프로세스를 계속 살려두지 않습니다.
- `capability-module-runtime.service.ts`의 `isHostLifecycleActivationError()`는 `AVV_ERR_ROOT_PLG_BOOTED`("Root plugin has already booted")와 `FST_ERR_INSTANCE_ALREADY_LISTENING`("Fastify instance is already listening")를 인식합니다. 이 경우 롤백이나 상태/준비 상태 `"error"` 저장 없이 버전과 상태를 유지하여 다음에 정상 활성화합니다. warn 한 번과 진단 기록은 남습니다. 다른 실패는 error, 롤백, `"error"`를 유지합니다.
- 회귀: `startup-inject-gate`.

**유지되는 점.** `buildApp()` 반환 뒤 `app.inject()`은 래퍼 없는 Fastify 원래 호출입니다. 인수 없는 체인 형태는 보류하지 않습니다. 등록 순서, 경로, `runCapabilityInternalRoute()`, 스케줄러, 시작 후 활성화/업데이트는 같습니다. 실행 중 한 가지 경우는 UI에서 활성화한 패키지가 새 경로를 추가할 때입니다. `FST_ERR_INSTANCE_ALREADY_LISTENING`를 그대로 반환하지만 새 버전을 되돌리지 않고 다음 시작을 위해 설치 상태로 둡니다. 호출자는 여전히 오류를 받습니다.

**확인 방법.**

```sh
node scripts/run-regressions.mjs --filter startup-inject-gate
```

해제 후 실행과 후속 경로, 콜백, `activate()` 내부 즉시 실패, `activate()`의 타이머, 짧은 시험값의 10분 한도, `buildApp()`의 설치/해제, 호스트 수명주기 오류가 롤백 전에 반환하고 경고 한 번을 남기는지 검사합니다.

**끄기 / 되돌리기.** 스위치가 없습니다. `MARINARA_INJECT_DURING_REGISTRATION`은 `InjectDuringRegistrationError`의 코드이지 설정이 아닙니다. inject 게이트 커밋을 되돌리세요.

---

<a id="a6-feature-switches-settings--advanced--features"></a>

## A6. 기능 스위치: Settings > Advanced > Features

**기존 동작.** 선택적 서버 동작은 환경 변수(A3/A4)이며 통합 UI가 없습니다. 새 옵션마다 설정/경로/UI가 필요했습니다.

**추가 사항.** 단일 레지스트리와 설정 절이며 F/G/H가 확장합니다. 자세한 내용은 `docs/configuration/features.md`입니다.

- `packages/shared/src/schemas/feature-settings.schema.ts`은 이름과 기본값을 정의하며 `features` JSON에 기본값과 다른 값만 저장합니다.
- 스위치 2개: **Stable lorebook picks**(`stableLorebookGroupPicks`, A3a), **Retry failed provider calls**(`providerRetry`, A4d).
- `services/features/feature-settings.ts`의 `isFeatureEnabled()`는 메모리 사본을 읽어 자주 쓰는 경로의 부담을 피합니다. 설정 경로 등록 시 읽고 행 쓰기/삭제, 관련 Professor Mari DB 명령, `.env` 재로드 후 갱신합니다. `GET`과 `PUT /api/app-settings/features`를 제공하며 `PUT`은 엄격하게 검증합니다.
- 환경 변수는 켜기/끄기 모두 우선합니다. `LOREBOOK_STABLE_GROUP_WINNERS`/`PROVIDER_RETRY_TRANSIENT_ERRORS`는 별도 읽기 대신 스위치를 고정합니다.
- 클라이언트의 Settings > Advanced > Features에 나열하고 고정된 것은 변수명과 잠금을 표시합니다. 다른 컴포넌트는 `useFeatureEnabled()`를 씁니다.

**유지되는 점.** 모두 기본 꺼짐이므로 절을 열지 않으면 기존 동작입니다. 기존 환경 변수의 효과도 같습니다.

**확인 방법.** `node scripts/run-regressions.mjs --filter feature-settings`은 레지스트리, 기본값, 정규화, 환경 우선, 경로, 저장, Mari식 무효화, 리스너를 검사합니다. UI에서 Settings > Advanced > Features 또는 `features` 검색입니다.

**끄기 / 되돌리기.** 둘 다 끄거나 변수를 해제하세요. 커밋을 되돌리면 체계가 사라지고 변수는 이전처럼 독립적으로 작동합니다.

---

<a id="a7-logged-best-effort-helpers"></a>

## A7. 로그를 남기는 최선 노력 헬퍼

추가 헬퍼로, 스위치나 자체 동작 변경이 없습니다.

**기존 동작.** 정리, 커서 이동, 캐시 쓰기 등에 빈 `catch`로 의도적으로 무시하는 오류가 있습니다. 동작은 맞지만 기록이 없습니다.

**추가 사항.** `packages/server/src/lib/best-effort.ts`에 `logSuppressed`, `orFallback`, `bestEffort`를 추가합니다. 무시한 실패는 `logRateLimited`(A2)으로 이벤트/채팅/단계별 분당 최대 한 줄입니다. D/E의 수정에서 빈 catch를 대체합니다.

**유지되는 점.** 이 PR에서는 아직 호출하지 않아 기존 경로가 바뀌지 않습니다.

**확인 방법.** `node scripts/run-regressions.mjs --filter best-effort`.

**끄기 / 되돌리기.** 스위치 없음. 커밋을 되돌리면 파일을 제거합니다.

---

<a id="coming-in-later-pull-requests"></a>

# 후속 pull request

의도적으로 짧은 절입니다. 각 PR을 열 때 같은 다섯 부분으로 채웁니다.

상태: PR A는 #6647로, PR B는 #6648로 병합되었습니다. PR C(#6649)는 병합되지 않고 닫혔으며, PR D부터 H까지는 별도 pull request로 열리지 않았습니다. 아래 C부터 H까지의 절은 작성 당시의 계획을 설명하므로, 이 형태 그대로 출시된 기능으로 읽지 마세요.

<a id="pr-b-dev-mcp-for-coding-assistants"></a>

## PR B: 코딩 도우미용 Dev MCP

`tools/dev-mcp`의 선택적 로컬 서버이며 pnpm workspace와 Docker 이미지 밖에 둡니다. A2 추적을 사용하며 B가 추가할 `tools/dev-mcp/README.md`에 설정/검증이 있습니다.

<a id="pr-c-command-palette-and-keyboard-shortcuts-overlay"></a>

## PR C: 팔레트와 단축키 오버레이

C에서 Ctrl+K 팔레트와 "?" 목록을 추가합니다. 클라이언트만, 스위치 없음, 기존 단축키 그대로입니다.

<a id="pr-d-reviewed-server-fixes-part-1"></a>

## PR D: 검토된 서버 수정 1부

D에서 경로, 미들웨어, 복구, 채팅/생성, 가져오기, 사이드카, SSRF를 각각 회귀와 함께 수정합니다. 스위치 없는 버그 수정입니다.

<a id="pr-e-reviewed-server-fixes-part-2"></a>

## PR E: 검토된 서버 수정 2부

E에서 서비스와 저장소를 각각 회귀와 함께 수정합니다. 스위치가 없습니다.

<a id="pr-f-prompt-caching"></a>

## PR F: 프롬프트 캐시

F에서 Claude 구독 기록 마커, Claude Agent SDK 업데이트, 캐시 친화 구성(기본 꺼짐 스위치), 채팅별 낮은 캐시 전송 경고(기본 꺼짐), 선택적 진단을 추가합니다.

<a id="pr-g-generation-jobs-and-console-tray"></a>

## PR G: 생성 작업과 콘솔 트레이

G에서 탭을 닫아도 계속되는 이미지/스프라이트/비디오 작업과 보기(기본 꺼짐 스위치), Windows 트레이 아이콘(기본 꺼짐 스위치)을 추가합니다.

<a id="pr-h-engine-diagnostics-and-launcher"></a>

## PR H: Engine 진단과 실행기

H에서 시작 무결성, 런타임 메모리 계측, 선택적 디버그 파일, 백그라운드 호출 한도(기본 꺼짐 스위치), 실행기 안전 조치, 항상 추론하는 모델을 위한 추론 끄기 없이 재시도를 추가합니다.

---

<a id="test-results-for-pr-a-on-the-development-machine"></a>

## 개발 컴퓨터의 PR A 테스트 결과

`staging` 기준 커밋 `dd876831a`에서 확인했습니다. 유료 모델 호출은 없습니다.

- **Linux Node 회귀**: CI `complete-node-regressions` 방식(WSL의 Ubuntu 24.04, Node 24, `pnpm install --frozen-lockfile`, `pnpm regression`)으로 384개 모두 통과했습니다. 부하가 높으면 `server-signal-shutdown`이 30초에 도달하기도 했으며 원본 `staging`도 같았습니다. 시간에 민감한 `smart-group-decision`, `agent-activation-questions`, `advanced-memory-core`은 각각 한 번 실패한 뒤 재실행은 모두 통과했습니다.
- **Windows Node 회귀**: 384개 중 379개 통과. `decision-sidecar-runtime`, `gallery-previews`, `request-timeouts`, `server-signal-shutdown`, `storage-writer-lock`는 같은 컴퓨터의 원본 `staging`에서도 실패합니다. 원인은 로컬 파일 잠금, 콘솔 신호, 디스크 공간 검사입니다.
- **타입/lint/서식/빌드**: shared, server, client, 루트, 토큰 추정 프로젝트 `tsc --noEmit`, lint 오류 0개, `packages/**/*.{ts,tsx}` Prettier, locale 및 정적 JSX 검사, 클라이언트/서버 빌드입니다.
- **설정 브라우저 테스트**(`core-flows`, `issue-sweep-settings`, `ux-feedback-sweep`, `afternoon-sweep`, `client-runtime-diagnostics`)를 `mobile-chromium`에서 실행: 171개 통과, 0개 실패. `mobile-webkit`(Windows WebKit)의 재실행 후 남은 실패도 원본 `staging`와 같습니다.
- **Features 절**은 기본/SillyTavern 테마, 밝게/어둡게, 데스크톱/휴대폰 크기로 시각 확인했습니다.
