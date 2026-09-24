# 선택 설치 에이전트 및 기능 패키지

상태: v2.3.0 개발 주기에 이슈 #3612로 구현되었습니다.

## 목표

Marinara Engine의 기본 배포본은 선택 설치 에이전트와 기능 구현을 함께 컴파일하거나 배포하지 않습니다. 새로 설치한 환경은 선택 설치 패키지가 하나도 없는 상태로 시작합니다. 업그레이드할 때는 이 패키지 체계가 도입되기 전부터 쓸 수 있던 기능이 그대로 유지됩니다.

공식 카탈로그, 패키지 소스, 재현 가능한 아티팩트, 검증 스크립트, 기여 워크플로는 [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents)에 있습니다. 설치된 아티팩트는 설정된 Marinara 데이터 폴더 아래에 저장하므로 앱을 업데이트해도 덮어쓰지 않습니다.

## 패키지 모델

에이전트 패키지 하나는 선언형 에이전트를 하나 이상 제공할 수 있고, 신뢰된 실행 코드 기능을 함께 담을 수도 있습니다:

- 라우트, 수명 주기 훅, 프롬프트 제공, 결과 처리, 저장소 마이그레이션을 담당하는 서버 진입점;
- 패널, 채팅 화면, 설정 섹션, 설정 마법사 선택지, 실행 중 표시를 담당하는 클라이언트 진입점;
- 공유 JSON 스키마와 안정적인 통신 규약;
- 패키지가 소유하는 리소스, 문서, Professor Mari 지식 조각.

패키지는 버전이 매겨진 Marinara Capability API를 대상으로 만듭니다. 엔진의 비공개 소스 경로를 가져다 쓰면 안 됩니다.

클라이언트 기능 요소는 `lang`, `dir` 속성과 `capabilityProps.localization` 객체를 통해 엔진이 선택한 UI
언어를 전달받습니다. 패키지가 소유한 인터페이스는 자체 언어 파일을 유지하고, 없으면 패키지에 포함된 영어로
대체합니다. 엔진은 패키지의 프롬프트나 패키지가 정한 기계용 값을 번역하지 않습니다. 언어를 바꿀 때는 기존
`marinara-capability-props` 이벤트를 그대로 재사용하므로, 설치된 인터페이스는 엔진을 다시 시작하지 않아도 다시 그려집니다.

### 전달 및 캐싱

설치된 패키지 파일은 매니페스트의 파일별 SHA-256 해시에서 파생된 강력한 검증자와 함께 제공됩니다. Engine은 읽을 때마다 같은 값으로 바이트를 다시 검증합니다. 클라이언트 번들(`/api/capability-packages/<id>/client`)과 모든 패키지 자산은 항상 재검증됩니다(`no-cache`와 `ETag`). 변경되지 않은 파일은 다시 다운로드하지 않고 `304 Not Modified`로 응답하며, 다시 게시된 파일은 즉시 반영됩니다. 어떤 항목도 `immutable`로 제공되지 않습니다. 설치 정책상 같은 버전을 다른 바이트로 다시 게시할 수 있으므로 패키지 URL은 콘텐츠 주소가 아닙니다.

Capability API 1.1에서는 서버 활성화 컨텍스트에 범용 런타임 파사드가
추가되었습니다. 패키지는 비공개 로거나 런타임 설정 모듈을 가져오지
않고도 에이전트 디버그 상태를 읽고 엔진의 Pino 로거로 기록할 수
있으며, 디버그 모드를 명시적으로 덮어쓸 수도 있습니다. 파사드는
엔진 내부 객체가 아니라 동작만 노출합니다.

Capability API 1.2에서는 트랜잭션 범위의 채팅/메시지 작업, 좁은 범위의
채팅 메타데이터 쓰기와 로어 항목 존재 확인 읽기, 공간 스냅샷 호환
저장소가 추가되었습니다. 패키지는 엔진 트랜잭션 안에서 도메인 변경을
검증하고, 데이터베이스 핸들이나 테이블 객체를 받지 않고도 소유자
메시지, 스와이프, 공간 스냅샷과 함께 메타데이터를 원자적으로 커밋할
수 있습니다. 롤백과 과거 저장 형식 호환은 엔진이 맡고, 검증과 도메인
정책은 패키지가 맡습니다. 같은 API로 정규화된 채팅 및 캐릭터 레코드,
조건에 맞는 로어 항목 선택, JSON 형태의 응답 파싱, 해석이 끝난 언어
모델 호출도 사용할 수 있습니다. 연결 자격 증명, 제공자 구현, 데이터베이스
핸들, 저장소 객체는 엔진 전용으로 남습니다.

### Capability API 1.7의 채팅 분기

Capability API 1.7에서는 `CapabilityChatRecord`에 정규화된 분기 메타데이터가 추가되었습니다:

```ts
branch: {
  title: string | null;
  parentChatId: string | null;
  parentMessageId: string | null;
  childMessageId: string | null;
} | null;
```

`title`은 저장된 분기 이름에서 앞뒤 공백을 다듬은 값입니다. 루트 채팅은 `null`을
반환합니다. 엔진이 만든 것으로 확인되는 분기는 바로 위 부모 채팅, 분기의 기준이 된
메시지, 복사된 자식 메시지를 알려 줍니다. 비어 있는 분기는 메시지 앵커가 null입니다.
예전 방식의 분기, 형식이 깨진 메타데이터, 관계를 알 수 없는 상태로 가져온 그룹 형제
채팅은 계보 필드가 모두 null입니다. 엔진은 과거의 관계를 추론하지 않습니다. 범용
내보내기/가져오기에서는 부모 ID와 메시지 ID를 제외합니다. ID는 설치 환경마다 달라지기
때문입니다. 부모를 삭제해도 자식의 계보 정보는 그대로 남습니다.

### Capability API 1.8의 Game Experience

Capability API 1.8에서는 패키지가 제공하는 Game Experience, Game 턴별 프롬프트 컨텍스트, 리소스 쓰기가 추가됩니다.

패키지는 내장 Game Mode의 부가 기능이 아니라 Game Mode 전체를 제공할 수 있습니다. `game-surface` 슬롯을 선언하고 게임을 만들 때 설정 마법사의 Experiences 블록에서 선택합니다. 선택은 게임에 기록되어 전체 수명 동안 고정되므로 플레이 도중 Experience가 켜지거나 꺼지지 않습니다. 표면은 공용 내레이션 위에 자체 HUD, 메뉴, 전투를 그리고 어떤 내장 시스템을 대체하는지 선언합니다. 선언하지 않은 항목은 내장 상태를 유지하므로 Experience는 실제로 구현하는 항목만 제외합니다. 선택적 `contributions.gameSurface.surfaceClass`는 표면이 마운트된 동안 Engine이 게임 영역에 적용할 클래스를 지정합니다. 패키지 스타일시트는 이를 통해 자체 요소 밖에서 렌더링되는 공용 인터페이스도 꾸밀 수 있습니다.

`prompt-context` 권한이 있는 패키지는 생성된 각 Game 턴의 시스템 프롬프트에 텍스트를 추가합니다. 활성 상태를 소유한 패키지는 모델의 이해를 플레이어가 보는 내용과 일치시킬 수 있습니다. 기여 요소는 대체하는 내장 게임 시스템도 선언할 수 있으며, Engine은 모델에게 해당 시스템을 조작하라고 지시하지 않습니다. 기여 요소는 턴마다 수집되며 필수가 아닙니다. 아무것도 반환하지 않으면 건너뛰고, 오류가 발생하거나 기한 안에 끝나지 않으면 기록 후 건너뛰며 생성에는 영향을 주지 않습니다.

리소스 파사드는 읽기와 함께 쓰기를 제공하므로 패키지 설정 흐름에서 플레이어 Persona와 연결된 로어북을 찾거나 만들 수 있습니다. 저장소, 검증, ID는 Engine이 유지하고 도메인 콘텐츠는 패키지가 유지합니다.

### Capability API 1.10의 패키지 자산

Capability API 1.10에서는 패키지 소유 정적 자산의 일반 전달 기능이 추가됩니다. 매니페스트는 패키지에 포함된 이미지(`png`/`webp`/`gif`/`jpg`/`jpeg`)와 JSON 파일을 최대 256개까지 허용하는 `contributions.assets.paths`를 선언할 수 있습니다. Engine은 브라우저 탭 아이콘과 같은 검증 체인을 사용해 `/api/capability-packages/<id>/assets/<path>`에서 자산을 제공합니다. 경로 제한, `files[]` 해시 포함 여부, 수동적 콘텐츠 유형 허용 목록, 읽기마다 무결성 재검증을 거칩니다. 스키마는 능동 문서 유형(SVG, HTML, 스크립트)을 거부합니다. 선언한 모든 경로는 `files[]`에서 해시로 고정되어야 하며, 패키지 내부 `manifest.json`은 선언해도 제공할 수 없습니다. `contributions.assets`를 선언하려면 `schemaVersion` 2와 `capabilityApi` 1.10 이상인 매니페스트가 필요합니다. v1 매니페스트에서는 선언할 수 없습니다. 자산은 항상 재검증됩니다. 클라이언트 번들처럼 매니페스트 해시 기반의 강력한 `ETag`를 가지며, 변경되지 않은 재검증에는 본문 없이 `304 Not Modified`로 응답합니다. 타일셋은 실제 바이트가 바뀔 때만 다시 다운로드됩니다. 응답은 의도적으로 `immutable`이 아닙니다. 같은 버전을 다른 바이트로 다시 게시할 수 있으므로 버전이 있는 URL도 콘텐츠 주소가 아닙니다. 덕분에 `game-surface` Experience는 그림을 클라이언트 번들에 인라인하지 않고 실제 파일로 포함할 수 있습니다.

이 규칙을 어긴 매니페스트는 설치 중 다음 메시지 중 하나와 함께 거부됩니다. "A declared package asset must be listed in the package file manifest", "contributions.assets requires schemaVersion 2 and capabilityApi 1.10 or newer", 이미지나 JSON이 아닌 경로에 대한 스키마 확장자 오류, 또는 대소문자만 달라 대소문자를 구분하지 않는 파일 시스템에서 하나로 충돌하는 파일명의 아카이브에 대한 "Package contains duplicate file" / "Package manifest declares files that collide on case-insensitive filesystems"입니다.

각 기능 요소에는 이 목적을 위한 자체 ID가 제공됩니다. `capabilityProps.packageId`와 `capabilityProps.packageVersion`이 `localization`과 함께 전달되므로 번들은 자산 URL을 `/api/capability-packages/<packageId>/assets/<path>`로 만들 수 있습니다. 선택적으로 `?v=<packageVersion>`을 사용하면 버전 변경 시 중간 캐시를 무효화할 수 있습니다. 설치 목록을 다시 가져오거나 자체 가져오기 URL을 분석할 필요가 없습니다.

### Capability API 1.11의 Experience 전투 인터페이스

Capability API 1.11에서는 `game-surface` 기능 속성에 전투 인터페이스가 추가됩니다. `combatActive`는 내장 전투 UI가 실제로 마운트되는 순간을 알립니다. GM의 서사 장면 상태인 `chatMeta.gameActiveState`는 전환보다 늦을 수 있고 조우가 없어도 "combat"을 나타낼 수 있지만 `combatActive`에는 그런 문제가 없습니다. `combatStyle`은 적용된 스타일(`classic` 또는 `tactical`)을 전달합니다. `requestCombat()`은 수동 Start Combat 버튼과 같은 과정으로 Engine에 조우 생성을 요청하지만, Experience 자체 인터페이스가 이미 의도를 표현했으므로 확인 대화 상자는 생략합니다. 조우 내용은 여전히 Engine 생성 과정에서 결정합니다. 패키지가 전투원이나 전투 상태를 직접 제공하는 방법은 의도적으로 없습니다. 전투는 Engine이 소유합니다.

`requestCombat()`은 ID가 안정적이고 패키지 경로에서 알림을 표시하지 않으며 Experience가 자체 피드백을 렌더링할 코드를 반환합니다. 성공은 `"started"`, 거부는 `"combat-active"`, `"pending"`(이미 생성 중), `"no-turn"`(GM이 아직 턴을 작성하지 않음), `"unavailable"`(종료된 세션 또는 리플레이)입니다. `combatPending`과 `combatError`는 생성 진행과 실패를 반영하므로 생성 실패 후 패키지가 `combatActive`를 계속 기다리지 않습니다. 1.7/1.8 인터페이스와 마찬가지로, 엄격한 게이트가 있는 1.10의 `contributions.assets`와 달리 이 속성은 선언한 `capabilityApi`와 관계없이 모든 `game-surface` 패키지에 전달됩니다. 1.11이라는 이름은 도입 시점을 나타냅니다. 필요한 패키지는 1.11을 선언하고 이전 Engine은 해당 패키지를 명확히 거부합니다.

### Capability API 1.12: 소유 Experience를 위한 공간 이벤트

Capability API 1.12에서는 게임을 소유한 Experience 패키지에도 공간 기능 이벤트가 전달됩니다. 이전에는 `marinara-capability-server-event` 창 이벤트에서 `hierarchical-maps`에만 전달되던 `spatial_transition_committed`, `spatial_transition_rejected`, 형식 없는 `spatial_context_refresh` 알림이 이제 채팅의 `gameExperienceId`를 `packageId`로 설정해 함께 전달됩니다. 이벤트별 페이로드는 다릅니다. 커밋 이벤트에는 `{ chatId, commandId, currentLocationId, definitionRevision, travel? }`, 거부 이벤트에는 이동이 일어나지 않았으므로 위치 필드가 없는 `{ chatId, commandId, code?, message? }`, 새로 고침 알림에는 `data: null`이 들어갑니다. `sendMessage`의 `pendingSpatialTransition` 인수로 이동 명령을 보낸 Experience는 이후 상태 읽기에서 결과를 추측하지 않고 호스트가 결과를 아는 즉시 이동을 확인하거나 지울 수 있습니다. 1.12는 World Maps에도 영향을 주던 공백을 해소합니다. 생성 중 스트리밍 전 소유자 턴 커밋과 독립 REST 커밋이라는 두 무음 HTTP 경로에서 거부된 전환은 이전에 이벤트를 전혀 만들지 않았습니다. 이제 두 경로 모두 확정적 근거, 즉 `already_applied` 이외의 `spatial_*` 오류 코드가 있을 때만 `spatial_transition_rejected`를 생성합니다. 성공한 커밋의 응답이 유실되었을 수 있는 네트워크 오류처럼 결론을 낼 수 없는 실패에서는 형식 없는 `spatial_context_refresh` 알림을 보냅니다. 수신자는 추측한 결과 대신 서버 상태와 다시 동기화할 수 있습니다. 커밋 이벤트의 `travel.mode`가 `"step_by_step"`이고 `complete: false`이면 이동이 계속되는 중입니다. 완료 이벤트까지 보류 상태를 유지하세요. 이는 1.11과 같은 소프트 인터페이스입니다. 선언한 `capabilityApi`와 관계없이 이벤트가 전달됩니다. 패키지에 필요할 때만 1.12를 선언하세요.

### Capability API 1.13: 일시적 내레이션 접기

Capability API 1.13에서는 `game-surface` 패키지가 `setExperienceChrome`에 전달하는 chrome 선언에 `requestsCollapsedNarration`이 추가됩니다. 플래그가 true인 동안 Game Mode 내레이션 상자는 얇은 핸들까지 접히므로 Experience가 컷신이나 전체 화면 연출에 화면을 넓게 쓸 수 있습니다.

이는 요청이지 환경 설정이 아닙니다. 플레이어가 선택한 접기 설정은 기록되지 않으며 Experience가 현재 표면인 동안에만 플래그가 적용됩니다. 플래그를 제거하거나 현재 표면이 아니게 되면 상자는 플레이어가 선택한 상태로 돌아갑니다. 이것이 나중에 항상 다시 열린다는 보장입니다. 패키지가 접힌 상태를 영구 저장하는 방법은 의도적으로 없습니다.

Engine 안전 규칙이 요청보다 우선합니다. 플레이어의 텍스트 입력이 화면에 보이면, 세그먼트가 생기기 전 장면 시작 시점까지 포함해 상자가 강제로 펼쳐집니다. 세그먼트 진행 컨트롤이 활성화된 동안에도 마찬가지입니다. 이 컨트롤은 턴을 끝내는 유일한 방법이므로 패키지가 숨길 수 있다면 플레이어를 영구적으로 막을 수 있습니다. 대기 중인 장면 분석, 생성 또는 전투 생성 재시도가 있으면 핸들도 주의 표시를 계속 올립니다. 요청 중 플레이어가 상자를 직접 펼치면 요청이 사라질 때까지 열린 상태를 유지합니다. 1.11/1.12와 마찬가지로 소프트 인터페이스이며 선언한 `capabilityApi`와 관계없이 필드가 적용됩니다. 1.13이라는 이름은 도입 시점을 나타내므로 필요한 패키지는 1.13을 선언합니다.

### Capability API 1.14: 트래커 화면과 에이전트 수명 주기

Capability API 1.14는 클라이언트 진입점이 있으며 활성 상태이고 사용 설정된 Roleplay 에이전트 패키지에 `contributions.slots` 값 두 개를 추가합니다.

- `roleplay-tracker`는 Roleplay HUD에 패키지의 `toolbar` 뷰를 마운트합니다. 속성에는 `chatId`, `chatMode`, `mobileCompact`, 호스트의 `toolbarButtonClass`, `onRerunTracker`, `trackerRetryBusy`, `lockMode`, `onToggleLockMode`가 있습니다. 콜백은 선택 사항이므로 존재하는지 확인한 뒤 사용하세요.
- `tracker-panel`은 기존 Tracker Panel 안에 패키지의 `tracker` 뷰를 마운트하고 `chatId`, `chatMode`, `detached`를 받습니다. 두 번째 패널을 열지 말고 호스트 화면을 재사용하세요. 두 슬롯 모두 일반 기능 식별 정보와 현지화 속성을 받습니다.

프롬프트 컨텍스트 기여는 여전히 `api.registerPromptContext`로 등록하고 `prompt-context` 권한이 필요합니다. 요청에는 이제 `targetCharacterIds`, `personaId`, `placedAgentTypes`(호환성을 위해 선택 사항)가 있습니다. `placedAgentTypes`는 프리셋이 이미 배치한 에이전트 데이터 섹션을 알려 컨텍스트 중복을 피하게 합니다. 호스트는 각 기여의 패키지 식별 정보를 `packageBlocks`에 보관해 해당 에이전트 섹션에 패키지 텍스트를 배치합니다. 대상별 텍스트를 반환하는 기여자는 주어진 대상 캐릭터 ID를 존중해야 합니다.

서버 진입점은 `api.registerService("agent-runtime:<package-id>", service)`로 자체 후처리 수명 주기 서비스를 등록할 수도 있습니다. `agent-runtime` 권한이 필요하며 다른 패키지 ID로 등록하면 거부됩니다. 선택적 훅은 다음과 같습니다.

```ts
const cleanup = api.registerService(`agent-runtime:${packageId}`, {
  prepareContext({ agent, context }) {
    // Return small, JSON-serializable context for this agent, or nothing.
    return { chatId: context.chatId };
  },
  finalizeResult({ agent, context, preparedContext, result }) {
    // Validate or enrich the result before the host publishes/applies it.
    return result;
  },
});
// Return cleanup from activate(), or include it in the activation cleanup.
```

`prepareContext`는 후처리 전에 실행됩니다. null이 아닌 결과는 해당 에이전트에 한정되고 직렬화된 런타임 컨텍스트로 프롬프트에 포함됩니다. `finalizeResult`는 그 값과 생성 결과를 받아 `AgentResult`를 반환합니다. 생성 및 수동 재시도 경로는 최종 처리가 끝날 때까지 결과 게시를 미룹니다. 비동기 훅의 기한은 각각 2초입니다. 준비 실패는 기록하고 건너뛰지만, 최종 처리 실패는 검증되지 않은 출력을 적용하지 않고 결과를 실패로 바꿉니다. 짧은 호스트 수명 주기 훅이므로 느린 모델 호출을 추가할 곳이 아닙니다.

이 추가 기능에는 필드별 1.14 버전 검사가 없습니다. 패키지는 선택적 속성을 감지하고 오래된 Engine에서 기능을 축소할 수 있지만, 슬롯, 배치 또는 수명 주기 동작이 필수라면 v2 매니페스트에 `capabilityApi: { major: 1, minor: 14 }`를 선언하여 오래된 Engine이 설치를 명확하게 거부하게 해야 합니다.

### Capability API 1.15: 현재 임베딩 설정

`api.runtime.resolveEmbeddings()`는 패키지의 현재 에이전트 연결 설정을 사용하는 새 `Promise<CapabilityEmbeddingHost>`를 반환합니다. 임베딩 작업을 시작할 때 호출하세요. `api.runtime.embeddings`는 활성화 시점의 스냅샷이므로 캐시하면 재활성화 전에는 이후 연결 변경을 따르지 않습니다.

```ts
const embeddings = await api.runtime.resolveEmbeddings();
const vectors = await embeddings.embed(texts, signal);
// Store/compare embeddings.spaceId with persisted vectors; do not mix embedding spaces.
```

반환한 호스트에는 `spaceId`, `label`, `embed(texts, signal?)`가 있습니다. 설정된 임베딩 소스를 사용하며, 소스가 없거나 설정 해석이 실패하면 내장 로컬 MiniLM 임베더로 대체합니다. `embed`는 `null`을 반환할 수 있습니다. 빈 배치, 128개 초과 텍스트, 합계 200,000자 초과는 거부됩니다. 새 호스트가 기존 벡터를 다시 임베딩하지는 않으므로 패키지는 저장된 벡터와 비교하기 전에 `spaceId` 변경을 처리해야 합니다.

현재 Engine은 패키지가 선언한 API 버전과 관계없이 이 메서드를 공개합니다. 연결 변경 추적이 필수면 API 1.15를 선언하세요. 오래된 Engine을 의도적으로 지원하는 패키지는 `typeof api.runtime.resolveEmbeddings === "function"`을 확인하고, 활성화 시점에 고정된다는 한계를 받아들여 `api.runtime.embeddings`로 대체할 수 있습니다.

### Capability API 1.16: 패키지가 선언하는 Game Master 동사

Capability API 1.16은 Experience 패키지가 이름 붙은 Game Master 행동, 즉 동사의 짧고 닫힌 목록을 선언하게 합니다. Engine이 GM 형식 안내에 표시하고 완성된 서술에서 다시 읽어 패키지 대신 실행합니다. 이 과정에는 패키지 서버 코드가 전혀 실행되지 않으므로 `agents`와 `client` 진입점만 있는 `game-surface` Experience도 GM이 문장으로 세계를 바꾸게 할 수 있습니다.

스키마, 예약 이름과 키 소유권 규칙, 테이블 읽기, 프롬프트 표시, 실행기까지 모두 작동합니다. 테이블을 제공하고 `chat-write`를 가진 패키지는 연결된 채팅의 매 Game 턴 안내에 동사를 표시하며 GM이 쓰면 실행합니다. 패키지에 연결되지 않은 채팅이나 테이블을 선언하지 않은 패키지는 동사를 하나도 해결하지 않으며 턴은 이 기능 이전과 바이트 단위로 같습니다.

테이블은 `gm-verbs.json`으로 선언하고 다른 자산처럼 `contributions.assets.paths`에 넣어 `files[]`로 해시를 고정합니다. 예약 파일명으로 찾는 것은 새 규약입니다. 이전 파이프라인의 `entrypoints`, 아이콘 경로, 자산 경로는 모두 선언한 이름으로 읽으며 형태로 발견하는 파일은 없습니다. 이 자산 경로에는 두 결과가 있습니다. `files[]`에만 넣고 `contributions.assets.paths`에서 빠뜨리면 설치와 카탈로그 빌드 모두 조용히 통과하고 진단 없이 동사가 없는 패키지가 됩니다. 또한 자산 경로에는 특권 접근 검사가 없어 선언한 자산은 `/api/capability-packages/<id>/assets/gm-verbs.json`에서 보호 없이 제공되므로 민감한 내용을 담아서는 안 됩니다. 1.11~1.13처럼 유연한 인터페이스입니다. 오래된 Engine은 일반 JSON 자산으로 보고 무시하므로 설치 범위를 좁히지 않고 테이블을 넣을 수 있습니다. 동사 실행이 필수일 때만 `capabilityApi` 1.16을 선언하세요. 선언하면 그보다 오래된 모든 Engine이 설치를 거부합니다.

문서는 `{ "schemaVersion": 1, "verbs": [ … ] }`이며 동사 1~16개를 담습니다. 각 동사는 엄격하여 알 수 없는 내부 키를 조용히 무시하지 않고 거부합니다. 다만 `schemaVersion`, `verbs` 옆의 알 수 없는 필드는 의도적으로 다르게 처리합니다. Engine의 읽기는 이를 제거하여 더 새 Engine용 테이블에서도 이해하는 동사는 얻습니다. 작성 도구가 검증할 공유 문서 스키마는 엄격하게 거부합니다. 따라서 작성 중 스키마 검증이 Engine 런타임보다 엄격하며, 이는 바람직한 차이입니다.

```json
{
  "schemaVersion": 1,
  "verbs": [
    {
      "name": "weather",
      "description": "Set the sky when the weather visibly changes.",
      "effect": "state",
      "metadataKey": "pixelforgeWeather",
      "args": [
        { "name": "word", "type": "string", "enum": ["fair", "overcast", "rain", "storm", "snow"] },
        { "name": "intensity", "type": "string", "enum": ["light", "heavy"], "optional": true }
      ]
    }
  ]
}
```

동사 이름은 최대 32자의 `[a-z][a-z0-9_]*`이며 Engine 자체 GM 대괄호 태그를 쓸 수 없습니다. 안내는 `[Note:`, `[Book:`처럼 대문자로 쓰지만 파싱 정규식은 대소문자를 구별하지 않아 소문자 `note`도 일지 태그를 가립니다. 따라서 이 검사는 대소문자를 통합합니다. 예약 집합은 GM과 파티 안내의 모든 분기가 표시할 수 있는 태그와 완성된 턴에서 읽는 Engine의 다섯 서술 파서에서 도출합니다. 클라이언트 태그 파서와 서술 포매터, 서버 세그먼트 편집기, 사이드카 장면 분석기, 생성 경로의 대사 재작성기입니다. 이 어휘는 안내보다 넓으며 대사 토큰 `main`, `side`, `extra`, `action`, `thought`, `whisper`와 서술 포매터만 읽는 QTE 쌍 `qte_bonus` / `qte_result`도 포함합니다. 마지막 부류가 고정 검사의 필요성을 보여 줍니다. `whisper` 동사가 있으면 저장 전에 대사의 `[whisper:Tam]`이 잘려 나가 그 줄이 영구히 대사로 인식되지 않습니다. 추출기를 포함해 회귀 검사로 고정합니다. 고유한 이름을 제공하는 파서, 즉 태그 파서의 `party-chat` / `party-turn`과 포매터의 QTE 쌍은 계속 제공해야 합니다. 소스가 조용히 스캔에서 빠지면 예약 집합을 줄이지 않고 빌드가 실패합니다. 고유 이름이 없는 나머지 셋도 새 태그를 먼저 도입할 때 잡도록 스캔합니다. 그러나 완전성을 보장하지는 않습니다. 대상 밖 파일이나 추출기가 읽지 못하는 형태의 태그는 놓칠 수 있어 새 파서가 생기면 집합을 확장합니다. `action`, `state`, `status`, `note`도 내장 태그이므로 평범한 동사 이름이 거부되면 대개 오타가 아니라 이 규칙 때문입니다. `description`은 대괄호와 줄바꿈 없는 1~200자의 한 줄이며 안내의 `COMMANDS:` 블록에 그대로 들어갑니다. 줄바꿈에는 CR, LF 외에도 블록을 읽는 입장에서 줄을 끝내는 `U+0085`, `U+2028`, `U+2029`가 포함됩니다. C0 제어 문자와 DEL도 거부합니다. 특히 탭은 줄을 끝내지 않고도 블록 형태를 바꾸기 때문입니다. 단, 매크로 처리를 건너뛰지는 않습니다. 안내 전체를 보내기 전에 확장하므로 설명 속 `{{…}}`는 문자로 출력하지 않고 확장하며, `{{setvar::…}}`처럼 채팅 변수를 쓰는 매크로도 포함됩니다. `chat-write`가 이미 준 권한을 넘지는 않지만 실수하기 쉬우므로 의도하지 않았다면 설명에 매크로 중괄호를 쓰지 마세요. 동사는 최대 여섯 개의 `{ name, type, enum?, maxLength?, optional? }` 인수를 가지며 이름은 최대 32자의 `[a-z][a-zA-Z0-9_]*`입니다. 대괄호 태그가 아닌 JSON 키이므로 대문자를 금지하는 동사 이름보다 의도적으로 넓습니다. 문자열 인수만 `enum`을 가질 수 있으며 서로 다른 1~16개 값이어야 합니다. 반복 값은 집합에 의미를 더하지 않으므로 다른 중복과 마찬가지로 거부합니다. enum 없는 문자열은 `maxLength`(1~500)가 필수입니다. 실행기의 한정 파싱 자체에는 상한이 없어 자유 텍스트가 무제한이면 서술 덩어리가 통째로 패키지에 들어갈 수 있기 때문입니다. enum이 이미 값을 제한하므로 `enum`과 `maxLength`를 동시에 쓰면 거부합니다. 페이로드는 평평한 한 줄 JSON이며 중첩된 `}`는 태그 일치를 일찍 끝냅니다. 메시지당 동사 이름별 한 번만 파싱하므로 반복 동사는 한 번 적용됩니다.

이를 설명문에 모두 쓸 필요는 없습니다. 파싱한 테이블에서 개략 페이로드, 설명, 복사 가능한 예시 하나 순서로 안내 행을 만듭니다.

```
- [weather:{"word":"fair|overcast|rain|storm|snow","intensity"?:"light|heavy"}] — Set the sky when the weather visibly changes. Example: [weather:{"word":"fair"}]
```

어휘를 가르치는 것은 개략 표시입니다. 모든 인수를 선언 순서로, 선택 항목은 JSON 문자열 밖에 `"name"?:`로, enum은 전체 선택지로, enum 없는 문자열은 상한으로 표시합니다. 숫자와 불리언은 따옴표 없이 표시합니다. 검증기는 숫자의 `"3"`을 변환하지 않고 거부하기 때문입니다. 예시는 구체적 한 사례로 enum 값 하나밖에 보여 줄 수 없어 어휘 설명을 대신할 수 없습니다. `{"word":"fair"}`만 받은 GM은 "sunny"를 쓰고, 검증기는 알려 주지 않은 값을 거부합니다. 이 거부는 보이지 않습니다. 태그는 검증 성공이 아니라 이름 일치 시 제거되어 문장은 깔끔하지만 세계는 바뀌지 않기 때문입니다. 같은 파싱 테이블에서 둘을 만들면 불일치도 방지합니다. 값이 더 이상 설명문에 있지 않으므로 설명이 검증기가 거부하는 값을 약속하지 않습니다. 200자는 인수를 되풀이하지 말고 언제 쓸지에 사용하세요.

기능 축소는 동사별입니다. 새 `effect`, 표현하지 못하는 형태, 예약 이름이나 남의 키처럼 거부되는 선언은 해당 동사만 로그와 함께 버리고 이해하는 동사는 실행합니다. `parseCapabilityCatalogWithCompat`의 카탈로그 항목 규칙과 같습니다. 거부된 동사는 조용히 실패하므로 선언한 동사가 나오지 않으면 로그를 읽으세요. 알 수 없는 `schemaVersion`, 빈 `verbs` 배열, 객체가 아닌 값처럼 문서 전체를 쓸 수 없으면 빈 테이블과 로그 한 줄이 나옵니다. 읽기 전 선언된 `files[].bytes`가 64 KB를 넘을 때도 거부합니다. `files[]`는 100 MB까지 허용하며 다른 사전 읽기 상한이 없기 때문입니다. 어떤 실패에서도 턴은 그대로 유지됩니다.

`metadataKey`를 선언한 동사는 **상태 동사**입니다. 인수 전체를 채팅 메타데이터 행의 해당 키에 쓰고, 패키지는 기존 속성으로 변경을 받습니다. `metadataKey`가 없으면 **이벤트 동사**로, 영구 쓰기, 큐, 재생, 수신 확인 없이 실시간 기능 클라이언트 이벤트로 전달됩니다. 이벤트 동사에는 쓰지도 않는 키를 차지하지 못하도록 `metadataKey`를 금지하고, 상태 동사에는 필수로 요구합니다.

선택 전에 차이를 알아야 합니다. 상태 쓰기는 영구적이며 되돌리지 않습니다. 턴의 스와이프 전환, 편집, 삭제에도 값은 남고 마지막으로 표시된 스와이프가 아니라 마지막으로 생성한 것이 이깁니다. 따라서 세션 중 문장과 세계가 어긋나도 이를 맞추는 것이 없습니다. 이벤트는 기억이 전혀 없는 한 프레임의 동기 전송입니다. 턴 중단, 스트리밍 중 탭 닫기나 새로고침, 패키지 첫 마운트 전 전송, 다른 채팅으로 이동한 경우, 패키지 로딩 게이트 대기 중에는 조용히 사라집니다. 재전송은 없습니다. 대신 패키지가 되감기로 복원되는 곳에 효과를 보관하면 이야기와 함께 되돌릴 수 있습니다. 채팅 메타데이터 행은 되감기지 않아 상태 동사는 불가능합니다. 어느 쪽에도 흔적이 안 남는 손실은 라이브 상태에 적용된 이벤트가 패키지의 다음 저장 플러시 전에 강제 새로고침으로 사라지는 경우입니다.

따라서 양쪽 모두 상대적 의미를 의도적으로 거부합니다. 상태 동사는 절대값 덮어쓰기라 "금 5 추가"를 구조적으로 표현할 수 없습니다. 상대 이벤트 동사도 규칙상 거부합니다. 턴을 재생성하면 새 스와이프 인덱스를 만들고 이전 표시를 계승하지 않아 생성한 스와이프마다 누적되기 때문입니다. `chatId:messageId:swipeIndex` 중복 제거는 이 채널이 애초에 하지 못하는 재전송만 막고 실제 가능한 재생성을 막지 못합니다. 두 번 적용해도 안전하게 하는 것은 원장이 아니라 절대값입니다. 상대 어휘는 메시지별 절대값으로 바꾼 경우에만 여기 속합니다.

두 종류가 함께 있는 턴에서는 상태 동사의 비동기 재조회가 도착하기 전에 이벤트의 동기 전송이 패키지에 도착합니다. 이벤트 핸들러가 같은 턴 상태 동사의 효과를 읽고 새 값이라고 기대해서는 안 됩니다.

거부의 비대칭성은 의도된 기능입니다. Engine은 인수 이름, 타입, enum 포함 여부, 문자열 상한이라는 형태만 검증하고 의미는 패키지가 책임집니다. 채팅별로 세계를 생성하면 NPC 이름은 선언 시점에 열거할 수 없습니다. 상태 동사는 패키지가 볼 때 이미 메타데이터가 커밋되어 패키지의 거부는 권고에 불과합니다. 이벤트 동사는 Engine 쪽에 커밋된 것이 없어 같은 거부가 구속력을 가집니다. 알 수 없는 이름을 거부하면 실제로 거부한 것입니다.

상태 동사의 `metadataKey`는 세 규칙에 따라 선언 패키지 소유여야 합니다. 패키지 ID를 camel case로 정규화한 접두사(`hierarchical-maps` → `hierarchicalMaps`)로 시작하고, 대문자 경계로 시작하는 비어 있지 않은 접미사가 이어져 다른 패키지 이름 공간에 침범하지 못하게 합니다. 또한 정규화 ID는 Engine 소유 메타데이터 이름 공간과 같거나 그 대문자 경계 확장이면 안 됩니다. 이 목록은 모든 최상위 `ChatMetadata` 키, Engine의 메타데이터 키 상수, 인터페이스 선언 대신 인덱스 시그니처에 존재하는 키에서 도출합니다. 마지막에는 앞의 둘로는 못 보는 `encounterActive`, `internalAssistant`, `imageGenConnectionId` 등 미선언 메타데이터가 포함됩니다. 세 번째 부류는 일곱 소스가 필요합니다. `patchMetadata`/`updateMetadata`에 넘기는 객체, 그만큼 흔한 업데이터 콜백 반환 객체, `patchMetadata`를 전혀 거치지 않는 클라이언트 `useUpdateChatMetadata()`와 `onMetadataChange`, 그 훅도 건너뛰는 직접 `PATCH /chats/:id/metadata` 호출(Game 화면이 전투·장면·서술 키를 쓰는 방식), `chatMetadata.key`와 `chat.metadata.key` 속성 읽기, Engine에서 가장 흔하고 `scenario` 같은 키를 유일하게 보는 `parseChatMetadata(…)` 결과 읽기, 함수 경계를 통해서만 쓰고 읽는 키를 담는 수동 채팅 설정 프로필 메타데이터 목록입니다.

추출기를 포함한 모든 내용을 회귀 검사로 고정합니다. 의도적으로 스캔 밖인 것은 둘입니다. 변수나 헬퍼 반환값을 넘기는 쓰기(`patchMetadata(id, hydratedMeta)` 또는 메타데이터 경로의 같은 형태)는 정적 스캔이 키를 읽지 못합니다. 현재 20곳이며 그 수를 고정해 21번째는 사람이 읽을 때까지 빌드가 실패합니다. 헬퍼 내부에서 매개변수로 읽는 것도 함수 간 분석이라 읽기 스캔 범위 밖입니다. `spatialContext`는 이 저장소가 아니라 Agents 저장소에서 배포되는 `hierarchical-maps` 클라이언트가 메타데이터에 쓰고 여기서는 헬퍼와 파일 내부 파싱으로 읽습니다. 두 번째 틈은 수동 목록으로 메우므로 일곱 소스 중 하나가 도출물이 아닌 관리 목록입니다. 사각지대가 없다고 주장하지 않고 이를 명시합니다. 목록의 `persona`는 현재 어떤 소스도 만들지 않는 수동 최소 예약 항목입니다. 세 번째 규칙은 의도적으로 패키지 전체를 거부합니다. `conversation-calls`는 `conversationCalls`로 정규화되고 `conversationCalls` + `Enabled`가 기존 Engine 키라 자체 ID 밑에서도 메타데이터 키를 소유할 수 없습니다. `noodle`과 `background`도 같으며, 후자는 `background` 자체가 Engine 키이기 때문입니다. 이런 패키지도 키를 소유하지 않는 이벤트 동사는 선언할 수 있습니다. 키가 평평한 최상위인 이유는 기존 패키지 조정기가 읽는 형태이기 때문입니다.

패키지가 선언한 모델 명령은 패키지가 `chat-write`를 선언하고 설치되어 준비된 경우에만 실행됩니다. 이 권한은 메시지, 채팅 메타데이터, roleplay 이벤트, 공간 스냅샷을 비롯해 패키지 영속성 API를 통한 쓰기도 제어합니다. `chat-read`는 채팅, 메시지, 게임 상태, 공간 스냅샷 읽기를 제어합니다. 영속성 트랜잭션과 채팅 잠금 안에서도 같은 검사가 적용되며 쓰기 권한이 읽기 권한을 암묵적으로 부여하지 않습니다. 엔진 자체의 영속성 호출은 계속 신뢰됩니다.

설치 후 **Download Agents** (에이전트 다운로드) 상세 화면은 설치된 버전이 선언한 권한을 보여 줍니다. 카탈로그 버전이 다른 권한을 요청하면 별도로 표시합니다. 코드 설치나 업데이트에는 정확한 버전과 체크섬에 연결된 기존 승인이 계속 필요하며 모델 명령은 턴마다 별도 승인을 요청하지 않습니다.

이는 API 검사이며 JavaScript 샌드박스가 아닙니다. 네트워크, 저장소, UI 권한은 접근 선언입니다. 패키지의 브라우저 및 서버 코드는 신뢰된 코드로 남아 호스트 환경에 접근할 수 있으므로 신뢰하는 패키지만 설치하세요. 파일 제공 가능 여부가 아니라 준비 상태를 검사하므로 업데이트 후 패키지가 `restart-required` 상태가 되면 엔진을 다시 시작할 때까지 해당 명령을 해석하지 않습니다.

### Capability API 1.17: 첫 턴 전에 Experience 준비

`game-surface` 패키지는 스키마 버전 2와 Capability API 1.17에서 `contributions.gameSurface.prepareBeforeStart: true`를 선언할 수 있습니다. Engine은 게임이 준비 상태가 되면 **Start Game**(게임 시작)을 활성화하기 전에 해당 화면을 마운트합니다. 클래식 게임과 이 플래그가 없는 패키지는 기존 시작 흐름을 유지합니다.

이 옵션을 사용하는 기본 화면에는 두 가지 속성이 추가됩니다.

- `startup: boolean`은 플레이어가 **Continue**(계속)로 Engine 도입부를 마칠 때까지 true로 유지됩니다. 그동안 월드 시뮬레이션과 플레이어 행동을 일시 중지하세요.
- `setStartupReady(context: string | null): void`는 준비 상태를 알립니다. 로딩, 저장 또는 오류 복구 중에는 `null`을 보내세요. 실제 월드가 영구 저장되고 사용 가능한 상태가 된 뒤에만 문자열을 보내세요. 빈 문자열은 추가 컨텍스트 없이 시작하도록 허용합니다.

호스트는 준비 완료 문자열을 받을 때까지 **Start Game**, 위젯 준비 확인, 첫 턴 재시도를 차단합니다. 차단된 동안에도 패키지 자체의 로딩 및 오류·재시도 화면은 표시됩니다. 준비가 끝나면 패키지는 일반 Engine 도입부 뒤에 숨겨집니다. **Continue**를 누르면 일반 화면이 열리며 다시 마운트될 수 있습니다. 월드 준비가 멱등성을 유지하도록 하고, 다시 생성하는 대신 저장된 상태를 복원하세요. 도입부를 이미 마친 게임으로 돌아오면 시작 준비를 반복하지 않습니다.

시작 컨텍스트는 **8,000자**로 제한됩니다. 유효하지 않거나 너무 긴 컨텍스트는 시작을 차단한 상태로 오류를 표시합니다. 호스트가 월드의 사실을 잘라 내지는 않습니다. 준비된 시작 위치와 실제로 그곳에 있는 캐릭터를 간결하게 설명하세요. Engine은 이 텍스트를 `game_start` 소스로 기존 첫 턴 `generationGuide`에 추가하므로 도입부가 실제로 존재하는 월드를 사용합니다. 이후 턴의 컨텍스트를 등록하는 것은 아닙니다. 이후에는 패키지의 일반 프롬프트 기여나 턴 생성 컨텍스트를 계속 사용하세요.

준비 콜백은 마운트된 채팅, 게임, 패키지에 속합니다. 다른 범위에서 늦게 도착한 콜백은 무시됩니다. 모듈이나 런타임에 오류가 발생하면 월드 컨텍스트 부재를 성공으로 처리하지 않고 시작을 차단합니다. 새로고침 후에는 패키지가 저장된 월드를 기준으로 준비 완료를 보고해야 합니다. 서버 프롬프트 컨텍스트 제공자는 계속 읽기 전용이며 짧은 제한 시간을 적용받습니다. 월드 생성이나 오래 걸리는 시작 대기 장벽으로 사용하지 마세요.

### Capability API 1.19: 패키지가 제공하는 도구

Capability API 1.16은 패키지가 모델에 무언가를 _말하게_ 한 뒤 그 내용에 따라 동작할 수 있게 했습니다. 이번 버전은 모델이 무언가를 _호출할_ 수 있게 합니다. 새 `tools` 권한을 가진 패키지는 서버 진입점에서 이름이 있는 도구를 등록합니다. Engine은 모든 채팅의 매 턴에 기본 도구와 함께 이를 제공하고, 패키지의 JSON Schema로 호출을 검증한 뒤 인수를 핸들러에 전달합니다.

```ts
export async function activate({ api }) {
  api.registerTool({
    name: "set_time",
    description: "Move the world clock forward or back.",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["advance", "rewind"] },
        minutes: { type: "integer", minimum: 0 },
      },
      required: ["action", "minutes"],
      additionalProperties: false,
    },
    handler: async (args, { chatId }) => {
      const clock = await moveClock(chatId, args.action, args.minutes);
      return { time: clock.label };
    },
  });
}
```

응답 형식 대신 도구 호출을 사용하는 것은 의도된 선택입니다. 응답 형식은 답변 전체를 차지하므로 서술을 JSON 객체의 필드에 넣어야 하고 스트리밍할 수 없습니다. 도구 호출은 본문과 함께 도착할 수 있으며 모델은 평소처럼 턴을 작성합니다. 패키지는 완성된 서술에서 인수를 추출하는 대신 제공자가 이미 제한한 인수를 받습니다. 스키마는 규칙을 적용하지만 관례는 모델에 규칙을 지켜 달라고 요청할 뿐입니다.

열거형에서 차이가 드러납니다. 패키지가 세계의 장소 12곳을 알고 있다면 그 이름을 스키마에 넣을 수 있습니다. 열세 번째 이름은 핸들러에 도착하기 전에 거부됩니다. Engine의 기존 인수 검증기는 허용되는 값을 알려 주므로 모델이 호출을 수정할 수 있습니다. 핸들러의 반환값은 도구 결과로 모델에 표시됩니다.

도구를 작성하기 전에 다음 규칙을 확인하세요.

- 이름은 `<packageId>_<name>` 형식이며 `-`는 `_`로 바뀝니다. `world-clock`의 `set_time`은 `world_clock_set_time`으로 모델에 전달됩니다. 다른 패키지가 사용 중인 이름은 거부됩니다. 기본 도구와 활성화된 사용자 지정 도구는 충돌하는 이름을 유지하며 패키지 정의는 생략됩니다. 전체 이름은 **64자** 이하여야 합니다. 정의와 실행 모두 기본, 사용자 지정, 패키지 순서로 우선합니다.
- 패키지가 활성 상태인 동안 도구는 항상 추가됩니다. 기본 도구와 달리 채팅별로 별도 스위치가 없습니다. 권한 선언과 등록이 사용 결정입니다. 선택한 제공자는 네이티브 도구 호출을 지원해야 합니다.
- 매개변수 스키마는 등록할 때 복사하고 컴파일합니다. Engine이 컴파일할 수 없다면 턴 중간이 아니라 개발 중 확인할 수 있는 활성화 단계에서 실패합니다.
- 핸들러가 예외를 던지면 호출 실패를 모델에 알리고 기록하지만 예외 메시지는 전달하지 않습니다. **10초** 안에 완료되지 않아도 턴은 기다리기를 중단합니다. 핸들러는 계속 실행되지만 턴을 계속 막지는 않습니다.
- 결과는 최대 **64 KiB**로 직렬화할 수 있어야 합니다. 더 크거나 직렬화할 수 없는 결과는 대화 공간을 차지하는 대신 호출을 실패시킵니다. 설명과 결과는 신뢰하는 패키지 콘텐츠입니다. 채팅별 데이터를 읽거나 변경하기 전에 `chatId`를 확인하세요.
- 각 정의는 매 턴 제공자 요청에 직렬화되며 컨텍스트 조정에 포함됩니다. 한도는 **패키지당 도구 16개**, **전체 패키지 합계 64개**, 설명 **512자**, 매개변수 스키마 **8 KiB**입니다. 한도를 넘으면 예외가 발생하여 활성화가 실패합니다. 패키지가 소유한 이름을 다시 등록하면 자리를 추가로 쓰지 않고 도구를 교체합니다.
- 활성화가 종료되면 해당 컨텍스트는 작동하지 않습니다. 패키지가 `api`를 보관하고 나중의 콜백에서 `registerTool`을 호출해도 거부됩니다. 종료된 런타임은 도구를 등록하거나 다시 활성화된 패키지의 도구를 교체할 수 없습니다.
- 패키지를 비활성화, 업데이트 또는 제거하면 도구도 해제됩니다. 응답할 패키지가 없는 도구는 모델에 제공되지 않습니다. 정리를 기다리기 전에 도구를 제거하며 각 정리 콜백에는 8초 제한이 있습니다.

이 시간 제한은 비동기 대기에만 적용됩니다. 패키지는 서버 프로세스 안에서 신뢰된 코드로 실행되므로 이벤트 루프를 막는 동기 작업은 타이머로 중단할 수 없습니다. 강제 취소에는 별도의 워커나 프로세스가 필요하며, 이 API는 그러한 격리를 제공하지 않습니다.

`api.registerTool`은 이 Engine 버전부터 존재합니다. 필요한 패키지는 `capabilityApi` 1.19를 선언해야 하며 이전 버전에는 설치할 수 없습니다.

## Decision 문과 Decision 모델

사용자의 **Decision model**(Decision 모델)은 최근 채팅에 관한 예/아니요 문과 선택 문에 답합니다. 개념과 설정 방법은 [Decision 모델](../connections/decision-models.md)을 참고하세요.

패키지의 에이전트 프롬프트 템플릿은 사용자 지정 에이전트처럼 `{{#if decision:"..."}}`와 `{{#if decision_choice:"..." == "..."}}`를 쓸 수 있습니다. Engine은 템플릿에서 문을 찾고 에이전트 실행 전에, 후처리 에이전트라면 답변 후에 질문하여 답으로 템플릿을 해석합니다. Capability API 버전은 관여하지 않습니다. 구문과 문장 작성 요령은 [조건부 프롬프트](../prompts/conditional-prompts.md#asking-the-decision-model), 에이전트 단계별 처리 방식은 [사용자 지정 에이전트 만들기](../agents/custom-agents.md#decision-statements-in-the-agents-prompt)를 참고하세요.

패키지 런타임 코드가 Decision 모델에 직접 질문할 방법은 아직 없습니다. 별도의 Capability API 메서드와 버전 증가가 필요합니다.

모든 사용처는 Decision 모델이 없는 사용자를 고려해 설계하세요. 답이 없는 문은 아니요로 읽으므로 `{{else}}` 분기나 아무것도 없는 상태가 합리적인 기본값이어야 합니다. Jev를 필수로 요구하지 말고 일반적인 Decision 모델을 대상으로 작성하세요. 로컬 채팅 모델과 다른 지원 백엔드도 같은 구문을 쓰지만 답은 다를 수 있습니다. 특정 점수, 요청 횟수 또는 캐시된 답에 의존하기 전에 [임계값](../connections/decision-models.md#thresholds)과 [제한과 비용](../prompts/conditional-prompts.md#limits-and-cost)을 확인하세요.

### Game Mode Experience 개발자를 위한 참고

Engine 전투는 일반 적의 행동을 자체 결정합니다. GM 쪽의 보스가 아닌 모든 적은 기술과 클래스에 따른 역할(bruiser, bulwark, skirmisher, marksman, spellcaster, supporter, controller), 직접 지정하지 않으면 레벨에 따른 숙련도(novice, trained, veteran, master), reckless, cautious, opportunistic, protective 같은 기질을 받습니다. beasts와 monstrosities는 항상 mindless입니다. Engine 코드는 모델 호출 없이 시드로 이를 선택하고 게임 난이도는 성향대로 행동하는 일관성을 바꿉니다. 작성된 보스만 GM이 모델 호출로 지휘합니다. [Game Mode 전투 AI](game-combat-ai-design.md)를 참고하세요.

전투 개선은 계속될 예정입니다. 전투 처리에 Decision 모델을 넣기 전에 기본 Engine 전투가 이미 필요한 동작을 하는지 확인하세요. 특정 성격이 필요한 적은 우선 맞는 숙련도와 기질을 주세요. 적의 매 턴마다 Decision을 수행하면 모델 작업과 시간 제한이 추가되고, 호스팅 백엔드는 네트워크 요청과 비용도 추가합니다. 사용자가 설정하지 않았을 수 있는 모델의 답에 전투가 의존하므로, 답이 없을 때의 합리적인 대체 동작도 필요합니다.

## 최초 제공 패키지

- 현재 기본 내장된 모든 에이전트;
- Roleplay와 Game의 계층형 공간 지도;
- Conversation의 음성 통화와 영상 통화;
- UNO;
- Chess;
- Poker;
- 8-Ball Pool;
- Tic-Tac-Toe;
- Rock-Paper-Scissors.

기본 배포본에는 패키지 관리자, 카탈로그 클라이언트, 범용 에이전트 파이프라인 규약, 범용 턴제 게임 호스트 규약, 그리고 내용이 비어 있는 호스트 인터페이스만 남습니다. 실제 구현은 패키지 쪽에 있습니다.

## 신뢰와 설치

공식 카탈로그는 스키마로 검증하고 버전을 매긴 JSON 문서이며 HTTPS로 다운로드합니다. 릴리스 항목마다 변하지 않는 아티팩트 URL, SHA-256 다이제스트, 바이트 크기, 엔진 호환 정보, 권한, 실행에 다시 시작이 필요한지 여부가 들어 있습니다.

서버를 시작할 때 공식 패키지가 하나라도 설치되어 있으면 호스트가 카탈로그를 한 번 가져옵니다. 그리고 실행 중인 엔진과 Capability API에 맞는 더 새로운 버전만 골라 일반 설치 파이프라인으로 검증한 뒤, 패키지 런타임이 활성화되기 전에 설치합니다. 실패는 패키지 단위로 격리합니다. 카탈로그에 연결하지 못하거나 검증에 실패해도 이미 있는 파일과 레지스트리 상태는 그대로 쓸 수 있고, 서버 런타임 준비에 실패하면 이전 버전으로 되돌리는 경로를 탑니다.

설치 프로그램은 다음을 지켜야 합니다:

1. 권한 있는 루프백/관리자 접근을 요구합니다;
2. HTTPS, 다운로드 크기 제한, 시간 초과를 강제합니다;
3. 압축을 풀기 전에 카탈로그 신뢰성과 아티팩트 SHA-256을 검증합니다;
4. 절대 경로, 상위 경로 이동, 링크, 장치 파일, 매니페스트에 없는 파일을 거부합니다;
5. 매니페스트와 엔진 호환성을 검증합니다;
6. 임시로 만든 형제 폴더에 압축을 풉니다;
7. 검증에 성공한 뒤에만 원자적으로 활성화합니다;
8. 새 런타임이 정상적으로 시작될 때까지 이전 버전을 보관합니다;
9. 실패하면 활성화를 되돌립니다;
10. 설치, 업데이트, 제거 스크립트를 절대 실행하지 않습니다.

공식 카탈로그가 활성화하는 실행 코드 패키지는 프로젝트가 직접 만든 신뢰된 패키지뿐입니다. 나중에 서드파티 패키지를 허용하려면 신뢰 방식을 따로 명확하게 설계해야 합니다.

## 실행과 다시 시작 동작

설치된 패키지 레지스트리는 서버가 관리하며, 설치된 기능을 클라이언트에 알려 줍니다. 선언형 모듈과 다시 불러올 수 있는 모듈은 즉시 활성화됩니다. 활성화가 끝나면 UI가 카탈로그, 에이전트, 모드 기능, 현재 채팅 관련 조회를 무효화합니다.

매니페스트는 호스트가 해당 진입점을 안전하게 다시 불러올 수 없을 때만 `restartRequired`를 선언할 수 있습니다. 즉시 활성화에 성공하면 `Agent installed. It is ready to use.`라고 안내합니다. 다시 시작이 필요하면 `Agent installed. Restart Marinara Engine to finish setup.`이라고 안내합니다.

턴제 게임 패키지는 즉시 다시 불러올 수 있습니다. 설치하면 서버 엔진과 수동 슬래시 실행 명령어가 바로 등록되고, 제거하면 엔진을 다시 시작하지 않아도 런타임이 분리됩니다. 채팅별 **Conversation Commands**(Conversation 명령어) 설정은 캐릭터가 패키지의 숨은 명령을 내보낼 수 있는지만 제어할 뿐, 직접 입력하는 슬래시 실행 명령어까지 막지는 않습니다. 현재 공식 턴제 게임 매니페스트는 엔진 2.x 호환을 위해 예전의 다시 시작 표시를 보수적으로 그대로 두고 있습니다. 엔진 3.x는 `turn-game` 종류를 인식해 안전하게 즉시 활성화하고, 패키지를 바로 쓸 수 있는 활성 상태로 반환합니다.

## 호환성 마이그레이션

업그레이드 후 처음 실행할 때는 다음과 같이 동작합니다:

- 사용자 지정 에이전트는 그대로 둡니다;
- 해당 설치 환경에서 보이던 기존 내장 에이전트는 모두 설치된 것으로 기록합니다;
- 지도, Conversation 통화, Conversation 게임은 이전과 같은 상태로 계속 쓸 수 있습니다;
- 채팅별 설정, 스냅샷, 게임 상태, 통화 기록, 에이전트 기억은 그대로 남습니다;
- 마이그레이션은 여러 번 실행해도 결과가 같으며, 기존 기능 항목이 모두 안전하게 저장된 뒤에야 완료로 기록합니다.

예전 패키지 아티팩트는 마이그레이션 원본으로 공식 카탈로그에 계속 남아 있습니다. 새로 설치한 환경에서는 직접 설치하기 전까지 이 패키지들이 보이지도, 활성화되지도 않습니다.

## 제거

패키지를 제거하면 현재 채팅에서 선택된 목록에서 빠지고, 에이전트 설정과 다운로드한 실행 파일이 삭제되며, 필요하면 다시 시작할 때 런타임이 분리됩니다. 지난 채팅, 메시지, 지도 스냅샷, 통화 요약, 완료된 게임 기록은 계속 읽을 수 있어서 패키지를 지워도 지금까지 만든 결과가 사라지지 않습니다. 과거 도메인 데이터를 완전히 지우는 것은 별도의 명시적인 조작입니다.

제거할 때는 매번 확인을 거칩니다. 영향을 받는 채팅은 기록이 깨지지 않은 채 기본 화면으로 돌아갑니다.

## 카탈로그 화면

**Agents**(에이전트) 패널에는 Card Browser의 `Download Cards`에 대응하는 `Download Agents` 컨트롤이 있습니다. 이 컨트롤을 누르면 전체 화면 라이브러리가 열리고, 검색, 패키지 종류, 호환 정보, 설치/업데이트 상태, 권한, 저장 공간 사용량, 문서, 제거 컨트롤을 화면 크기에 맞춰 보여 줍니다.

데스크톱에서는 목록과 그 옆의 상세 영역을 함께 보여 줍니다. 모바일에서는 한 화면씩 보여 주고, 뒤로 가기와 손가락으로 누르기 쉬운 크기의 조작 버튼을 제공합니다. 비어 있음, 오프라인, 호환되지 않음, 다운로드 손상, 설치 중단, 업데이트, 롤백, 다시 시작 필요 상태도 모두 정식 상태로 처리합니다.

## 분리 완료 기준

분리는 다음 조건을 모두 만족해야 끝난 것으로 봅니다. 기본 배포용 클라이언트와 서버 번들에 패키지 구현이 더 이상 들어 있지 않고, 새로 설치한 환경에서는 패키지를 다운로드하지 않으면 해당 기능을 활성화할 수 없으며, 업그레이드한 환경에서는 기능이 그대로 유지되고, 패키지 설치/업데이트/제거가 데스크톱, 모바일, Termux 호환 파일 시스템에서 모두 통과해야 합니다.

### Capability API 1.30: 부상 트랙, 판정 자원 소비, 트랙으로 싸우는 전투

규칙 집합의 `live.tracks` 항목이 `levels`와 `kinds`를 선언하면 범위가 있는 정수 대신 부상 트랙이 됩니다. 이름과 페널티가 있는 칸의 열에 표시를 둡니다. `levels`는 좋은 상태부터 나쁜 상태 순서의 1~16단계이며 각각 `label`과 정수 `penalty`를 가집니다. `kinds`는 트랙에 표시할 피해 1~6종류이며 각각 `id`, 짧은 `label`, 서로 다른 `severity`를 가집니다. 둘은 함께 사용합니다. 표시할 곳이 없으므로 `levels` 없는 `kinds`는 거부합니다. `resolution.penaltyFrom`은 모든 굴림에 적용할 페널티의 트랙을 지정합니다. `dice-pool`에서는 그만큼 주사위를 빼되 `pool.min` 아래로 내리지 않고, `dice-sum`에서는 고정 수정치로 적용합니다.

이 단계에서 추가한 나머지도 1.30에 포함되며, 하나라도 제공하는 패키지는 1.30을 선언합니다.

- `combat.health`는 풀 대신 부상 트랙을 지정할 수 있으며 이때 `combat.damageKinds`가 피해 타입별 표시를 정합니다. `default`, 선택적 `byType` 맵, `marks`로 구성됩니다. `marks`는 명중한 타격당 한 칸인 `per-blow` 또는 피해 굴림을 체력 단계로 세는 `per-point`입니다. 부상 트랙에는 `damageKinds`가 필수이며 풀에는 금지됩니다.
- `resolution.spend`(`dice-pool` 전용)는 판정에 소비할 풀, 한 번의 지불 비용, 얻는 것이 `successes`인지 `dice`인지, 한 굴림의 상한 `perCheck`를 정합니다.
- 카탈로그 항목의 `mechanics.check`는 캐릭터가 실제 선택한 항목이 판정에 주는 효과입니다. `reroll`(`upTo`와 `once` 또는 `until`), `dice`, `successes`, `threshold`가 있으며 이것도 풀 전용입니다.

```json
{
  "capabilityApi": { "major": 1, "minor": 30 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

부상 트랙의 길이는 단계 수이므로 `min`은 0이고 `max`는 `levels.length`입니다. 다르게 선언한 파일은 조용히 고치지 않고 거부합니다. `resolution.penaltyFrom`이 가리키는 것은 부상 트랙이어야 합니다. 일반 트랙에는 적용할 페널티가 없습니다.

1.20~1.28과 같은 이유로 유연한 인터페이스가 아닙니다. `levels`, `kinds`, `penaltyFrom`, `damageKinds`, `resolution.spend`, `mechanics.check`를 읽지 못하는 Engine은 규칙 집합 파일 전체를 거부하므로, 설치는 검증된 `ruleset.json` 바이트를 읽어 오래된 버전을 선언한 패키지를 거부합니다. 트랙이 일반 숫자이고 체력이 풀이며 판정 소비를 선언하지 않은 규칙 집합은 변하지 않습니다.

### Capability API 1.29: 규칙 집합 전투의 한 턴이 할 수 있는 일

`combat` 블록과 전투가 읽는 카탈로그 항목에 선택적 기능 다섯 가지를 추가합니다.

- 한 타격은 첫 피해 외에 최대 세 개의 추가 피해를 실을 수 있습니다. 카탈로그 항목의 `mechanics.plus`와 생물 행동의 `damage.plus`는 각각 `{ dice?, flat?, type?, save?: { save,
difficulty?, onSuccess: "none" | "half" } }`입니다. 각각 따로 굴리고 타입을 적용하며 치명타로 각각 두 배가 되고 대상이 각각 내성을 굴립니다. 그래도 타격 전체에 대한 집중 판정과 쓰러짐 판정은 각각 한 번입니다.
- `combat.attacks[].strikes`는 목록 예산 한 번을 소비해 얻는 공격 수를 지정하는 값 참조입니다. 남은 횟수는 턴 끝까지 보관하며 남아 있는 동안 해당 목록의 모든 행은 예산을 쓰지 않습니다.
- `mechanics.free`는 예산을 쓰지 않고, `mechanics.gives`는 이번 턴에만 예산을 돌려주며 받는 쪽 상한을 적용합니다. `mechanics.standard`는 소유자가 다른 예산으로 지정한 표준 행동을 사게 합니다. `gives` 또는 `standard`를 선언하는 `utility` 항목은 제외하지 않고 메뉴에 제공합니다.
- 새 항목 종류 `rider`와 생물 자체의 `riders`는 턴이나 라운드의 첫 유효 명중에 피해 절을 더합니다. 자동으로 적용되는 효과이며 메뉴에는 나오지 않습니다.
- 닫힌 상태 효과 목록에 `own-saves-advantage`, `own-saves-disadvantage`, `resist-all`, `cannot-target-source`, `cannot-approach-source`를 추가합니다. 상태는 `saves`로 대상 내성을 좁히고, `whileSourceInSight`로 원인이 시야에 있을 때만 적용하거나, `endsWhenSourceDown`으로 원인이 쓰러지면 끝낼 수 있습니다.

```json
{
  "capabilityApi": { "major": 1, "minor": 29 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

1.20~1.28과 같은 이유로 유연한 인터페이스가 아닙니다. 이 키를 읽지 못하는 Engine은 규칙 집합 전체나 해당 키를 담은 카탈로그 파일 전체를 거부하므로, 설치는 `ruleset.json`과 선언된 모든 `catalogs/<id>.json`의 검증된 바이트를 읽어 오래된 버전 선언이면 둘 다 거부합니다. 권한이 필요 없으며 아무것도 선언하지 않은 규칙 집합은 변하지 않습니다.

### Capability API 1.28: 보드 위의 규칙 집합 전투

규칙 집합의 `combat` 블록은 `distance: { label, perCell }`로 전장 한 칸의 자체 거리를 정할 수 있으며, 이것이 전투에 위치를 부여합니다. 함께 `ranged`는 보통 사거리 밖이나 적이 옆 칸에 있을 때 사격의 비용을, `cover`는 공격을 맞서는 방어에 엄폐가 더하는 값을, `opportunity`는 멀어지는 상대를 공격할 예산을 정합니다. 공격 목록은 `reach`와 `range`를 목록의 열에서 읽거나 모든 행에 공통값으로 쓸 수 있습니다. 생물 행동의 `range`는 단순 숫자 대신 `{ "normal": 30, "long": 120 }`일 수도 있습니다.

```json
{
  "capabilityApi": { "major": 1, "minor": 28 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

`distance` 없이 `ranged`, `cover`, `opportunity` 또는 무기 근접 거리나 사거리를 선언하면 가져오기에서 거부합니다. 측정할 칸 없이는 의미가 없기 때문입니다. 보드는 전술 전투 자체의 생성기, 지형, 배치를 사용하므로 이 버전은 두 번째 전장 모델이나 권한을 추가하지 않습니다.

1.20~1.27과 같은 이유로 유연한 인터페이스가 아닙니다. 이 키를 읽지 못하는 Engine은 규칙 집합 전체 또는 사거리가 쌍인 생물을 담은 카탈로그 전체를 거부합니다. 따라서 설치는 `ruleset.json`과 선언된 모든 `catalogs/<id>.json`의 검증된 바이트를 읽고 오래된 선언이면 둘 다 거부합니다. 거리를 선언하지 않은 규칙 집합은 변하지 않습니다.

### Capability API 1.27: 규칙 집합 생물 도감

규칙 집합 카탈로그는 `"holds": "creatures"`를 선언해 시트 행 대신 생물 능력치 블록을 담을 수 있습니다. 생물은 `combat` 블록이 선언하는 숫자로 작성합니다. 체력은 숫자 또는 전투 시작 시 굴리는 주사위이며, 방어, 우선권 수정치, 시트 자체 ID로 된 능력치와 내성 수정치, 저항·취약·무효인 피해 타입, 절대 걸리지 않는 상태, 위협 단계, GM이 보는 특성을 포함합니다. 행동은 명중, 내성 요구, 상태 적용, 사용 횟수 제한, 재충전 굴림, 한 예산으로 블록의 다른 행동을 순서대로 해결하거나 자체 특수 점수로 구매하는 형태일 수 있습니다.

```json
{
  "capabilityApi": { "major": 1, "minor": 27 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/beasts.json"] } }
}
```

생물 카탈로그는 `feeds`를 선언하지 않으며 시트 편집기 선택기에 나오지 않습니다. 시트가 아니라 전투가 읽습니다. 전투 디렉터의 `ruleset` 스타일이 설치된 규칙 집합의 `combat` 블록과 도감을 그대로 쓰므로 자체 Capability API 수준은 필요 없습니다.

1.20~1.26과 같은 이유로 유연한 인터페이스가 아닙니다. `holds`나 항목의 `creature`를 읽지 못하는 Engine은 규칙 집합 전체 또는 해당 카탈로그 전체를 거부하므로, 설치는 `ruleset.json`과 선언된 모든 `catalogs/<id>.json`의 검증된 바이트를 읽어 오래된 선언이면 둘 다 거부합니다. 권한이 필요 없으며 도감 없는 규칙 집합은 변하지 않습니다.

### Capability API 1.26: 규칙 집합 전투

API 1.26은 굴림, 대상, 행동 예산, 공격과 능력 목록, 상태, 집중, 체력 0 규칙, 피해 유형, 적의 위협 단계를 정하는 `combat`을 추가합니다. 카탈로그 `mechanics`는 대상, 확정 명중, 상태, 임시 점수, 시트 연동, 예산 소모를 설명할 수 있습니다.

```json
{
  "capabilityApi": { "major": 1, "minor": 26 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

`combat`을 선언한 규칙 집합 게임은 전투 디렉터가 켜져 있으면 전투 화면에서 이 블록으로 싸웁니다. 없는 규칙 집합은 이전처럼 `battle` 블록이나 플레이어의 Classic 또는 Tactical 설정을 사용합니다.

1.20~1.25와 같은 이유로 유연한 인터페이스가 아닙니다. `combat`이나 새 `mechanics` 키를 읽지 못하는 Engine은 규칙 집합 전체 또는 해당 키를 담은 카탈로그 전체를 거부하므로, 설치는 `ruleset.json`과 선언된 모든 `catalogs/<id>.json`의 검증된 바이트를 읽어 오래된 선언이면 둘 다 거부합니다. 권한은 필요 없으며 둘 다 없는 규칙 집합은 변하지 않습니다.

### Capability API 1.25: 레이어와 세계 지침

규칙 집합은 선택적 최상위 `layers` 배열로 Low magic, Hard winter 같은 이름 붙은 변형을 선언할 수 있습니다. 플레이어가 게임 생성 시 켜며 게임 전체 수명 동안 고정 정보에 보존합니다. 같은 릴리스는 기본 `gm` 블록에 선택적 `worldGuidance` 문자열을 추가합니다. 세계 생성이 설정 때 한 번 읽어 파티가 사용할 규칙에 세계관을 맞춥니다.

```json
{
  "capabilityApi": { "major": 1, "minor": 25 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

레이어 효과는 닫힌 집합이며 모두 범위를 좁히거나 덧붙입니다. 규칙 집합 지침 뒤에 안내를 추가하고, enum 필드에서 값을 제거하고, 같은 판정 종류의 난이도 단계로 교체하며, 시트 편집기 선택기에서 카탈로그 항목을 숨깁니다. 새 항목을 추가하지 않아 어떤 레이어를 골라도 시트를 읽을 수 있으며, 패키지 코드나 추가 모델 호출이 없습니다. 규칙 집합 작성자 이외의 사람이 제공하는 레이어는 후속 추가 사항입니다.

1.20~1.24와 같은 이유로 유연한 인터페이스가 아닙니다. `layers`나 `gm.worldGuidance`를 모르는 Engine은 규칙 집합 파일 전체를 거부하므로, 설치는 `ruleset.json`의 검증된 바이트를 읽어 오래된 선언이면 둘 다 거부합니다. 권한이 필요 없으며 둘 다 없는 규칙 집합은 변하지 않습니다.

### Capability API 1.24: 주사위 풀

`resolution`은 `"dice-sum"` 대신 `"kind": "dice-pool"`을 선언할 수 있습니다. 시트 값이 주사위 수가 되며 기준 이상인 결과를 셉니다. 집합은 두 배 성공, 폭발, 취소, 대실패, 뛰어난 성공과 GM의 상황별 조정 범위를 지정할 수 있습니다.

```json
{
  "capabilityApi": { "major": 1, "minor": 24 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

시트는 그대로이며 합계 수정치가 주사위 수가 됩니다. 새 시트 요소, 편집기 슬롯, 패키지 코드는 없습니다. 검증된 `ruleset.json`의 `dice-pool`은 API 1.24가 필요합니다. `dice-sum`만 지원하는 이전 Engine은 전체를 거부하기 때문입니다. 새 권한이나 합계 방식 집합의 변경은 없습니다.

### Capability API 1.23: 연동되는 카탈로그 값

`scaled`는 행 자체의 숫자 열을 최대 4개까지 집합이 관리하게 합니다. 기존 값 참조와 선택적인 단계 표를 사용해 레벨별 자원이나 능력치별 횟수를 표현하며 새 산술 연산은 추가하지 않습니다.

```json
{
  "capabilityApi": { "major": 1, "minor": 23 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/spells.json"] } }
}
```

값은 시트를 편집할 때 계산하며 읽을 때는 계산하지 않습니다. 따라서 라이브 상태, Game Master 프롬프트 블록과 전투 연결은 계속 저장된 숫자를 읽습니다.

연동 행은 `ruleset.json` 안이나 `catalogs/<id>.json` 자산에 놓을 수 있습니다. 매니페스트는 둘을 자산으로 선언하지만 내부 키를 보여 주지 못하므로 설치가 양쪽 검증된 바이트를 읽어 1.23보다 오래된 선언의 `scaled` 키를 거부합니다. 1.21의 `catalogs`, 1.22의 `battle`과 같은 방식입니다. 오래된 Engine의 엄격한 스키마도 파일 전체를 거부합니다. 권한은 필요 없으며 연동 항목 없는 카탈로그를 가진 규칙 집합은 변하지 않습니다.

`[sheet: op="use" name="..."]`는 `mechanics.cost`와 항목이 만든 각 행 풀의 사용 횟수 1회를 지불합니다. 이미 지원하는 카탈로그를 읽으므로 새 선언이 필요하지 않습니다.

### Capability API 1.22: battle 블록

선택적인 `battle`은 체력, 선택적인 MP, 주문 슬롯 풀, 카탈로그 행을 `CombatSkill`로 바꿀 목록을 지정합니다. 전투가 끝나면 플레이어 버튼과 같은 시트 작업으로 값을 돌려줍니다.

```json
{
  "capabilityApi": { "major": 1, "minor": 22 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

Engine 전투와 데이터를 연결하는 기능이며 완전한 테이블톱 어댑터는 아닙니다. 내장 계산은 `attackRoll`, `save`, `concentration`, `perCostStep`을 읽지 않습니다. 정확한 시스템 규칙은 별도 어댑터 연결에서 다룹니다. `coverage.combat`는 독립된 의미를 유지하며 이 연결에서는 읽지 않습니다. 검증된 `ruleset.json`의 `battle`은 API 1.22가 필요하며 `catalogs`의 1.21 제한과 같습니다. 새 권한이나 블록이 없는 집합의 변경은 없습니다.

### Capability API 1.21: 카탈로그

카탈로그는 시트 편집기에 준비된 주문, 직업 능력, 장비를 제공합니다. 헤더는 `ruleset.json`의 `catalogs`에 두며 항목은 인라인 또는 예약 파일로 저장합니다.

```json
{
  "capabilityApi": { "major": 1, "minor": 21 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/spells.json"] } },
  "files": [
    { "path": "ruleset.json", "sha256": "<sha256>", "bytes": 25767 },
    { "path": "catalogs/spells.json", "sha256": "<sha256>", "bytes": 418204 }
  ]
}
```

`catalogs/<id>.json`은 해당 카탈로그 ID와 일치해야 하며 다른 카탈로그를 가리킬 수 없습니다. `files[]`의 해시와 선언한 `ruleset.json`이 필요합니다. 선언 크기 1 MB 초과는 읽기 전에 거부합니다. 인라인과 파일 항목은 같은 시트에 대해 검증합니다. 집합당 12개 카탈로그, 카탈로그당 2000개 항목이 한도입니다.

클라이언트는 선택기를 열 때 `GET /api/capability-packages/rulesets/catalog?rulesetId=&catalogId=&version=`로 내용을 불러옵니다. 설치 목록에는 개수만 포함됩니다. 카탈로그 글은 프롬프트에 자동으로 들어가지 않으며 GM은 `gm.sheetSummary`가 고른 정보만 봅니다. 리소스와 검증된 파일의 `catalogs` 필드는 API 1.21이 필요합니다. 이전 엄격한 스키마는 전체 파일을 거부하기 때문입니다. 권한은 필요하지 않습니다.

### Capability API 1.20: Game Mode 규칙 집합

규칙 집합은 검증된 데이터입니다. Engine이 지원하는 판정 방식, 정해진 요소로 만든 시트, 휴식, GM 지침을 제공합니다. 예약 리소스 `ruleset.json`은 `gm-verbs.json`처럼 `contributions.assets.paths`에 등록하고 `files[]`에 해시를 둡니다.

```json
{
  "schemaVersion": 2,
  "capabilityApi": { "major": 1, "minor": 20 },
  "id": "ruleset-5e-2014",
  "kind": ["ruleset"],
  "permissions": [],
  "entrypoints": {},
  "contributions": { "assets": { "paths": ["ruleset.json"] } },
  "files": [{ "path": "ruleset.json", "sha256": "<sha256 of the file>", "bytes": 25767 }]
}
```

예시는 관련 필드만 보여 줍니다. `name`, `version`, `description`, `engine`, `builtAgainst`는 여전히 필수입니다. 권한, 에이전트, 클라이언트나 서버 진입점은 필요하지 않습니다. `ruleset` 종류와 `ruleset.json`은 서로를 요구합니다. 코드나 문자열 표현식을 실행하지 않으므로 새 판정 방식에는 Engine 변경이 필요합니다. 형식과 5e 예시는 [`game-rulesets-and-sheets-implementation.md`](game-rulesets-and-sheets-implementation.md)에 있습니다.

매니페스트는 API 1.20을 선언해야 하며 이전 Engine은 설치를 거부합니다. 선언 크기 256 KB 초과는 읽기 전에 거부하고 설치 해시를 다시 확인한 뒤 엄격한 `packages/shared/src/schemas/ruleset.schema.ts`로 검증합니다. 잘못된 파일은 건너뛰고 패키지와 처음 몇 개의 `path: message` 오류를 로그 한 건에 기록합니다. ID가 겹치면 패키지 ID 순서상 첫 패키지가 우선하며 다른 패키지는 로그와 함께 제외합니다. `engine-legacy`와 `traditional`은 예약 ID입니다.

선택은 `chat.metadata.gameRuleset`에 한 번 저장합니다. 고정 정보가 없으면 기존 규칙입니다. 패키지가 없거나 정의가 오래되면 사용할 수 없는 상태로 두며 다른 규칙을 대신 쓰지 않습니다. 집합 ID와 제공 패키지를 함께 검사해 같은 ID의 다른 패키지가 게임을 가져가지 못하게 합니다.

### Capability API 1.18: Game 마법사 안에서 Experience 설정

`game-surface` 패키지는 스키마 버전 2와 Capability API 1.18에서 `contributions.gameSurface.setup`을 선언할 수 있습니다. Engine은 **Party**(파티), 목표, 모델, 로어북을 포함한 기존 7단계 설정을 유지합니다. 새 게임에서만 Experiences를 제공합니다. 기존 게임의 설정을 다시 열면 해당 Experience와 패키지 설정을 유지합니다. 이 선언이 없는 패키지는 기존 설정 대화상자를 사용합니다.

```json
{
  "setup": {
    "seed": { "key": "seed", "label": "World seed" },
    "config": { "generate": true, "packWanted": true },
    "requires": { "enableCustomWidgets": false }
  }
}
```

세 필드는 모두 선택 사항입니다. 선언한 시드는 선택한 Experience 아래에 **Randomize**(무작위 생성) 버튼과 함께 표시됩니다. 비어 있거나 유한한 숫자가 아닌 입력은 **Start**(시작)를 차단합니다. 호스트는 숫자 시드와 선언된 상수를 `experienceConfig`에 씁니다. `config`에는 시드 키를 포함할 수 없습니다. 상수는 직렬화한 결과가 8,000자 이하여야 합니다. 시드 레이블은 패키지 작성자가 제공하는 표시 텍스트입니다. 생략하면 Engine의 현지화된 레이블을 사용합니다.

선언된 위젯 요구 사항은 플레이어가 해당 컨트롤을 변경하기 전까지만 기본값을 제공합니다. Experience를 끄면 일반 기본값으로 돌아가지만 플레이어가 명시적으로 선택한 값은 그대로 유지됩니다. 컨트롤은 Experience가 기대하는 설정을 설명하며 계속 편집할 수 있습니다. 이러한 Experiences에서는 공간 지도 설정 컨트롤을 숨기므로 별도의 지도 초안, 템플릿 또는 빌더를 실행하지 않습니다.

**Lorebooks**(로어북) 단계에서는 연결되지 않은 책의 항목을 포함해 활성화된 개별 항목을 최대 100개 선택할 수 있습니다. 비활성화된 책과 항목, 채팅 제외 설정을 준수합니다. 이 ID는 `GameSetupConfig.activeLorebookEntryIds`로 전달됩니다. `/game/setup`에서는 추가 강제 항목으로 확률 판정을 건너뛰지만 일반 토큰 제한은 유지합니다. 전역 로어, 캐릭터에 연결된 로어, 첨부된 로어는 계속 일반 스캔에 참여합니다. 패키지도 설정에서 동일한 선택 ID를 읽어 자체 월드 생성 요청에 사용할 수 있습니다.

설정 파일을 가져오면 설치된 호환 Experience와 유효한 숫자 시드를 복원하지만 임의의 패키지 설정은 버립니다. 현재 매니페스트가 상수를 다시 제공합니다. 기존 게임은 이유를 설명하고 Experience 가져오기를 건너뜁니다. 생성 스냅샷은 설정 요약을 위해 Experience 이름과 시드를 보관합니다.

첫 턴 전에 월드를 준비해야 한다면 기존 시작 준비 선언을 별도로 사용하세요. 패키지의 최소 버전으로 API 1.18을 선언하세요. 이전 호스트는 이 설정 선언을 해석하지 못합니다.

### Capability API 1.34: 규칙 집합 자체 형식으로 작성한 생물

도감 생물은 규칙 집합 자체 형식의 캐릭터 시트인 `sheet`를 가질 수 있으며 필요한 부분만 채워도 됩니다. 전투는 동료와 똑같이 구성하므로 체력, 방어, 내성, 우선권, 속도, 목록의 능력은 규칙 집합 선언에서 가져오고 자체 풀로 지불합니다. 이 경우 시트 옆에 `health`, `defense`, `initiativeModifier`, `speed`, `abilities`, `saves`를 주지 않으며 자체 블록 행동도 가질 수 없습니다.

```json
{
  "capabilityApi": { "major": 1, "minor": 34 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/creatures.json"] } }
}
```

검사는 1.27처럼 규칙 집합 자체 바이트와 설치에 있는 모든 카탈로그 파일을 읽습니다. 생물 시트의 행은 그 목록에 공급하는 카탈로그 항목을 `_catalog: "<catalog>/<entry>"`로 표시할 수 있고 Engine은 도감과 함께 해당 카탈로그도 전투에 불러옵니다. 1.20~1.33과 같은 이유로 유연한 인터페이스가 아닙니다. 키를 읽지 못하는 Engine은 엄격한 카탈로그 파일 전체를 거부하므로 제공 패키지는 1.34를 선언합니다. 권한은 필요 없습니다.

### Capability API 1.33: 반응이 기다리는 순간

카탈로그 항목의 `mechanics.reaction`은 `true` 대신 객체일 수 있습니다. `on`은 Engine이 감지하는 순간, `at`은 선택한 행동을 겨누는 대상, `cancels`는 창이 보류한 효과 자체를 취소할지를 지정합니다.

```json
{
  "capabilityApi": { "major": 1, "minor": 33 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/spells.json"] } }
}
```

`on`은 항목 소유자에게 효과가 닿기 전인 `aimed` 또는 피해를 받은 뒤인 `harmed`입니다. 이를 지정해야 해당 창 메뉴에 항목이 나타납니다. `at`은 순간을 일으킨 대상을 채우는 `source` 또는 항목 자체 대상을 유지하는 `chosen`입니다. 이미 일어난 일은 취소할 수 없으므로 `aimed`만 `cancel`할 수 있습니다. 취소한 행동의 비용은 누구에게 묻기 전에 이미 지불했으므로 소비된 채로 남습니다.

`"reaction": true`만 있는 항목은 자기 턴에 쓰지 않는다는 뜻일 뿐 메뉴에 제공하기에는 부족하여 어디에도 나오지 않고 새 버전도 필요 없습니다. 1.20~1.32와 같은 이유로 유연한 인터페이스가 아닙니다. 객체를 읽지 못하는 Engine은 엄격한 카탈로그 파일 전체를 거부하므로 제공 패키지는 1.33을 선언합니다. 권한은 필요 없습니다.

### Capability API 1.32: 공격 횟수를 자체 제한하는 무기

공격 소스는 자체 목록의 불리언 열인 `strikesCappedBy`를 선언할 수 있습니다. 그 열이 켜진 행은 목록의 `strikes`가 몇 회든 한 번의 공격만 얻습니다. 따라서 턴에 한 번 발사하는 무기는 한 발을 유지하고 다른 무기는 시트가 허용한 횟수만큼 공격합니다. SRD 5.1의 Loading 속성, 즉 "보통 가능한 공격 횟수와 무관하게 행동, 보너스 행동 또는 반응으로 발사할 때 탄약 한 발만 쓸 수 있다"는 규칙을 위해 존재합니다.

```json
{
  "capabilityApi": { "major": 1, "minor": 32 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

함께 `strikes`가 필요하며 없으면 거부합니다. 한 번 소비해 한 번 공격하는 목록은 이미 모든 행을 한 번으로 제한하기 때문입니다. 1.20~1.31과 같은 이유로 유연한 인터페이스가 아닙니다. 키를 읽지 못하는 Engine은 규칙 집합 전체를 거부하므로 제공 패키지는 1.32를 선언합니다. 권한은 필요 없습니다.

### Capability API 1.31: 호스트 생성 서비스 통합

서버 패키지는 `api.runtime.integrations`로 현재 Engine의 LLM, 이미지, 영상 서비스를 사용할 수 있습니다. 매니페스트에 Capability API 1.31을 선언하고 활성화 중 통합 호스트가 있는지 확인하세요. 오래된 Engine은 패키지 활성화 전에 새 API 요구를 거부합니다. 제공자 작업에는 `network`, 미디어 저장·임시 배치·제거에는 `storage` 권한이 필요합니다.

- `llm.createProvider(...)`는 사용자 지정 요청 매개변수와 헤더를 포함해 Engine 제공자 팩터리와 같은 연결 설정을 받습니다. 반환 제공자는 `chat`, `chatComplete`, `embed`, `maxContextValue`, `maxTokensOverrideValue`를 지원하며 인증 정보 속성은 공개하지 않습니다.
- `llm.localSidecar()`는 같은 파사드로 호스트의 로컬 사이드카 제공자를 반환합니다.
- `llm.withFallback(...)`는 같은 패키지 호스트가 만든 제공자를 감싸며 Engine의 요청 수용, 대체 알림, 제공자 선택 동작을 유지합니다.
- `images.generate(...)`와 `videos.generate(...)`는 취소, 요청 로그, 네트워크 검사, 미디어 큐를 포함한 현재 Engine 구현을 사용합니다. 호출자의 `signal`과 UI `debugMode`가 있으면 전달하세요.
- `images.save`, `images.remove`, `images.stage`, `images.sweepStaged`는 갤러리의 안전한 쓰기와 임시 파일 수명 주기를 재사용합니다. `videos.save`와 `videos.remove`는 영상 저장 경로를 재사용합니다. `images.resolveNovelAiRequestSize`는 호스트의 NovelAI 크기 정규화를 재사용합니다. 영상 길이와 공개 참조 업로드 정규화도 `videos.resolveDuration`, `videos.resolveReferenceUpload`로 사용할 수 있습니다.

공유 요청·결과 타입은 `@marinara-engine/shared`에서 내보냅니다. 패키지별 프롬프트 구성과 작업 조정은 패키지에 두고, 제공자 입출력은 Engine 서비스 구현을 복사하지 말고 이 호스트 진입점을 호출하세요. 순수 헬퍼와 타입은 여전히 번들에 포함할 수 있습니다.
