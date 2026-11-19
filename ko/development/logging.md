# 서버 로깅

이 페이지는 Marinara Engine 서버 로그를 읽고 유용한 줄을 작성하는 방법을 설명합니다. [CONTRIBUTING.md의 Logging 절](../../CONTRIBUTING.md#logging)을 보완하며 대체하지 않습니다. 공유 Pino 로거, 오류 객체 우선 호출, 형식 지정자, 네 단계 수준 표는 계속 적용됩니다.

<a id="what-every-line-carries"></a>

## 각 줄의 정보

모든 서버 줄은 `packages/server/src/lib/logger.ts`의 `logger`라는 Pino 인스턴스 하나에서 나옵니다. Fastify도 `loggerInstance`로 이를 사용하므로 `req.log`, `reply.log`, `app.log`는 그 자식입니다. 같은 직렬화기를 사용하며 환경 감시기의 `LOG_LEVEL` 즉시 갱신을 따릅니다.

| 필드 | 위치 | 의미 |
| --- | --- | --- |
| `pid` | 모든 줄 | 프로세스 ID(Pino 기본값). |
| `hostname` | 모든 줄 | 호스트명(Pino 기본값). |
| `bootId` | 모든 줄 | 프로세스 시작마다 새로 만드는 16진수 8자. 한 로그 파일을 공유하는 실행을 구분합니다. |
| `requestId` | 요청이 일으킨 모든 줄 | 응답 헤더 `x-request-id`와 같은 값. `req.log`뿐 아니라 서비스 안의 공유 `logger`에도 붙습니다. |
| `route` | 본문 파싱 이후 줄 | 일치한 경로 패턴(예: `/api/chats/:id`). 원시 URL은 담지 않습니다. |

<a id="request-ids"></a>

### 요청 ID

`lib/request-logging.ts`가 요청마다 ID를 부여합니다.

- 클라이언트는 `x-request-id`를 보낼 수 있습니다. `A-Z a-z 0-9 . _ : -`로 된 8~80자면 유지하고 다른 값은 바꿉니다.
- 없으면 서버가 UUID를 만듭니다. Fastify 기본 `req-1` 카운터는 시작마다 초기화되어 ID가 반복되었습니다.
- ID는 CORS가 노출하는 `x-request-id` 헤더로 반환됩니다. 버그 보고에 넣으면 `grep <id>`로 요청의 모든 줄을 찾습니다.

ID는 `AsyncLocalStorage` 컨텍스트(`lib/log-context.ts`)에 저장합니다. Pino 믹스인이 각 줄에 복사하므로 직접 전달할 필요가 없습니다. 서비스 깊은 곳의 `logger.warn(err, "...")`도 자동으로 가져옵니다. 본문 파싱은 HTTP 파서 자체 비동기 컨텍스트에서 실행되므로 파싱 후 컨텍스트를 다시 설정합니다.

컨텍스트는 요청 안에서 시작된 타이머, 리스너, 자식 프로세스 등을 모두 따라갑니다. 요청보다 오래 사는 작업의 시작은 `runWithRootLogContext({}, fn)`으로 감싸 이후 줄에 최초 요청 ID가 남지 않게 합니다. 로컬 사이드카는 llama-server와 MLX에 적용하며 Decision 및 Utility 사이드카도 같은 방식으로 프로세스를 시작합니다. 이후 요청이 공유하는 프로세스에 첫 요청자의 ID가 남지 않습니다. 경로 핸들러에서 시작한 다른 장기 타이머나 폴러는 같은 방식으로 감싸기 전까지 해당 `requestId`를 유지합니다.

<a id="request-lines"></a>

### 요청 로그 줄

`RequestLogController`는 Fastify 기본 `LogController`에서 다음을 바꿉니다.

- ID 이름은 `requestId`입니다. 기본 `reqId`로 저장된 검색이나 필터는 새 이름이 필요합니다.
- `incoming request`와 `Route ... not found` 줄은 토큰이나 검색 텍스트가 있을 수 있는 쿼리 문자열을 제외합니다. 수신 줄은 다른 `req` 필드(`method`, `version`, `host`, `remoteAddress`, `remotePort`)를 유지하고 `route`를 더합니다.
- 클라이언트가 요청을 일찍 닫으면 info로 `Client aborted request` 한 줄을 기록합니다. Fastify는 여기서 기록하지 않았습니다.

`LOG_DISABLE_REQUEST_LOGGING`는 이전처럼 동작하며 중단 줄도 끕니다.

`pnpm dev`에서 pino-pretty는 기본적으로 숨기는 `hostname`과 `bootId`를 감춥니다. 운영 JSON 출력에는 둘 다 남습니다.

<a id="startup-timeline"></a>

## 시작 타임라인

`lib/startup-timeline.ts`는 시작 단계마다 시간을 잽니다.

```ts
const db = await startup.phase("storage.open", () => getDB());
```

- 각 줄은 `event: "startup.phase"`, `stage`, `elapsedMs`(경과 시간), `selfMs`(내부 단계를 뺀 자체 시간)를 담습니다. 수준은 `selfMs`에 따라 1초 미만 debug, 1초 초과 info, 15초 초과 warn입니다. 기본 `LOG_LEVEL=warn`에서는 느린 첫 실행을 포함한 정상 시작이 단계 줄을 출력하지 않습니다.
- 단계는 중첩됩니다. `index.ts`의 `app.build`가 `buildApp` 내부 전체 단계를 감쌉니다. `selfMs` 기준이므로 느린 내부 단계는 스스로 한 번 보고하고, `app.build`는 내부 단계 외 자체 작업이 느리지 않으면 debug에 머뭅니다.
- 실패한 단계는 내부에서 기록하지 않습니다. 오류가 그대로 올라가며 `index.ts`의 `main().catch`가 단계명(`startup.stageOf(err)`)을 담은 `startup.failed` 한 줄을 기록합니다.
- 서버가 수신을 시작하면 `index.ts`가 `[startup] Ready in N ms`를 info로 한 줄 기록하며 `event: "startup.ready"`, 단계 수, 가장 큰 `selfMs` 다섯 단계를 담습니다.

단계는 로그 컨텍스트에 `stage`를 넣지 않습니다. 단계 중 시작한 서비스는 타이머를 유지하므로, 넣으면 프로세스 수명 내내 단계명이 남기 때문입니다.

<a id="one-line-per-failure"></a>

## 실패당 한 줄

실패는 다음 동작을 결정하는 코드가 정확히 한 줄만 기록해야 합니다.

- **기록하거나 다시 던지되 둘 다 하지 마세요.** 다시 던지면 호출자가 기록합니다. 추가 정보가 필요하면 `[agent-tools] ... failed`의 도구명처럼 debug에 넣습니다.
- **한 줄을 기록할 위치:**
  - 알 수 없는 500: `middleware/error-handler.ts`
  - 에이전트 실패: `executeAgent`(비치명적 실패이므로 warn)
  - 채팅 생성 실패: `generate.routes.ts`의 주요 catch
  - 해당 제공자 코드는 기록하지 않고 던집니다. 많아야 Grok CLI, Claude (Subscription)처럼 모델명과 원시 오류를 debug로 더합니다. Claude (Subscription)는 SDK 오류 텍스트가 이미 포함된 친절한 메시지를 던지므로 SDK 오류를 `cause`에 또 붙이지 않습니다. 채팅 SSE 오류와 에이전트 오류 텍스트가 원인 메시지를 덧붙여 같은 텍스트를 두 번 보게 되기 때문입니다.
- **취소는 info입니다.** 사용자 중지, 탭 닫힘, 신호 취소는 예상된 결과입니다. `lib/log-context.ts`의 `failureLevel(err)` 또는 `failureLevel(err, "warn")`를 사용하세요. `isCancellation(err)`가 true이면 `"info"`를 반환합니다. `TimeoutError`는 실제 실패이며 취소로 보지 않습니다.

  ```ts
  logger[failureLevel(err)](err, "[agent-batch] Batch call FAILED: %s", errMsg);
  ```

- **원인을 보존하세요.** `new Error("Could not save chat", { cause: err })`로 감쌉니다. `err`와 `error` 직렬화기가 원인 메시지와 스택을 더합니다(`caused by: ...`). `{ error }`로 기록한 Error도 직렬화되어 더는 `{}`로 나오지 않습니다.

<a id="repeating-failures"></a>

## 반복되는 실패

폴러, 상태 확인, 턴별 훅은 몇 초마다 같은 실패를 낼 수 있습니다. `lib/log-rate-limit.ts`의 `logRateLimited`를 사용하세요.

```ts
logRateLimited("warn", "autonomous-scheduler:poll", err, "[autonomous-scheduler] Poll failed");
```

키의 첫 발생을 기록합니다. 시간 창(기본 60초) 안의 후속 발생은 세고 다음 줄에 `suppressedRepeats`를 넣습니다. 패키지 ID나 채팅 ID처럼 실패 대상을 키에 담아 한 문제 항목이 다른 문제를 숨기지 않게 하세요.

<a id="prompt-and-model-text"></a>

## 프롬프트와 모델 텍스트

프롬프트, 모델 출력, 제공자 응답 본문과 폴링 본문은 **debug**로 기록하며 warn이나 error에 넣지 않습니다. 사용자 이야기나, 제공자가 되돌려 준 자격 증명/프롬프트가 있을 수 있습니다. warn에는 크기(`rawLength`, `bodyLength`)와 이유를 기록합니다. JSON 파싱 오류 메시지는 실패한 텍스트를 인용할 수 있으므로 warn에는 오류 유형만 넣습니다. 오류 자체와 텍스트는 별도 debug 줄에 둡니다.

```ts
logger.warn(
  { errorType: err instanceof Error ? err.name : typeof err, rawLength: raw.length },
  "[game/scene-wrap] Failed to parse LLM response as JSON",
);
logger.debug({ err }, "[game/scene-wrap] Unparsed LLM response: %s", raw.slice(0, 200));
```

UI 디버그 토글은 계속 `logDebugOverride`를 통해 동작합니다. `LOG_LEVEL`이 debug를 숨길 때 프롬프트를 보는 정해진 방법입니다.

<a id="checks"></a>

인라인 미디어는 기본적으로 전체가 로그에 남지 않습니다. `debugJson`은 각 base64 페이로드를 `[image/png base64, ~1.2 MB: iVBORw0KGgoAAAA...ElFTkSuQmCC]` 같은 표시로 바꿉니다. 여기에는 유형, 크기, 처음과 끝의 16자가 각각 들어갑니다. 문자열 전체나 텍스트 안의 `data:` URL과 Anthropic 및 Google 미디어 부분의 단독 `data` 필드에 적용되며, base64가 여러 줄로 나뉘어도 처리합니다. `msg` 직렬화기는 일반 `%s`, `%j` 줄의 `data:` URL에 같은 처리를 합니다. 단독 `data` 필드는 `debugJson`에서만 줄입니다. 출력할 사본만 바꾸며 전달한 값은 그대로 유지합니다. `.env`에서 `LOG_INLINE_MEDIA=full`을 설정하면 페이로드 전체를 다시 출력합니다. `log-inline-media` 회귀 테스트가 이 동작을 검사합니다.

## 앱 내 콘솔

NAS, VPS, Docker, Termux처럼 터미널을 직접 볼 수 없는 환경에서는 Settings → Advanced → **Open Console**(콘솔 열기)에서 최근 서버 로그를 앱으로 볼 수 있습니다.

- `lib/log-buffer.ts`는 최근 1,500줄을 메모리에 보관합니다. 총 약 400만 자까지 보관하며 각 메시지와 필드 블록은 16,000자에서 잘립니다. 디스크에 쓰지 않으며 다시 시작하면 비워집니다.
- `logger.ts`는 Pino의 `hooks.streamWrite`를 통해 직렬화된 줄을 모두 복사합니다. 버퍼에는 같은 `LOG_LEVEL`에서 터미널이나 로그 파일에 기록된 줄이 들어갑니다. dotenv의 `injected env` 줄이나 하위 프로세스의 원시 출력처럼 Pino를 거치지 않는 줄은 들어가지 않습니다.
- `GET /api/admin/logs?afterId=`는 `afterId` 뒤의 줄과 `latestId`, `truncated`(읽기 전에 버려진 줄이 있는지), 서버의 `logLevel`을 반환합니다. `requirePrivilegedAccess`로 보호되며 `no-store`가 적용됩니다. 경로의 `logLevel: "silent"` 설정 덕분에 콘솔 자체의 폴링은 로그에 나타나지 않습니다.
- 이 페이지의 규칙은 콘솔에도 적용됩니다. 원격 관리자는 앱에서 warn 및 error 로그를 읽으므로 프롬프트와 제공자 요청과 응답의 본문은 debug 수준에 두세요.

## 검사

`logging-request-trail`, `logging-failure-lines`, `logging-startup-timeline` 회귀 테스트는 이 페이지를 검증하며, `server-console-logs`는 앱 내 콘솔을 검증합니다.

```sh
node scripts/run-regressions.mjs --filter logging-
```
