# 선택 설치 에이전트 및 기능 패키지

상태: v2.3.0 개발 주기에 이슈 #3612로 구현되었습니다.

## 목표

Marinara Engine의 기본 배포본은 선택 설치 에이전트와 기능 구현을 함께 컴파일하거나 배포하지 않습니다. 새로 설치한 환경은 선택 설치 패키지가 하나도 없는 상태로 시작합니다. 업그레이드할 때는 이 패키지 체계가 도입되기 전부터 쓸 수 있던 기능이 그대로 유지됩니다.

공식 카탈로그, 패키지 소스, 재현 가능한 아티팩트, 검증 스크립트, 기여 워크플로는 [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents)에 있습니다. 설치된 아티팩트는 설정된 Marinara 데이터 폴더 아래에 저장하므로 앱을 업데이트해도 덮어쓰지 않습니다.

## 패키지 모델

에이전트 패키지 하나는 선언형 에이전트를 하나 이상 제공할 수 있고, 신뢰된 실행 코드 기능을 함께 담을 수도 있습니다:

- 라우트, 수명 주기 훅, 프롬프트 제공, 결과 처리, 저장소 마이그레이션을 담당하는 서버 진입점;
- 패널, 채팅 화면, 설정 섹션, 설정 마법사 선택지, 실행 중 표시, 전체 Game Mode 화면을 담당하는 클라이언트 진입점;
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

### 호스트 클라이언트 네임스페이스

Engine은 자체 클라이언트 상태와 라이브러리를 소유하며, 에이전트 패키지 클라이언트는 사본을 번들에 넣지 않고 이를 그대로 사용합니다. 사본은 자기만의 상태를 따로 가집니다. UI 설정 스토어를 번들에 넣은 패키지 클라이언트는 불러올 때마다 그 스토어의 오래된 버전으로 Engine 설정을 덮어썼고(Pasta-Devs/Marinara-Agents#1478), 번들에 넣은 채팅 스토어는 저마다 페이지를 불러올 때 열려 있던 채팅을 계속 붙들고 있었습니다.

Engine은 첫 패키지 클라이언트를 가져오기 전에 전역 변수 하나를 정의합니다.

```ts
globalThis.__MARINARA_HOST__ = {
  version: 1,
  capabilityApi,
  stores,
  services,
  modules,
  queryClient,
  components,
  data,
  api,
};
```

이 속성은 쓰기도 재정의도 할 수 없으며, 네임스페이스와 그 안의 `stores`, `services`, `modules`, `components`, `data` 객체는 동결되어 있습니다. 패키지 로더(`useCapabilityClientModules`)는 패키지 클라이언트를 가져오기 전에 `import()`로 `lib/marinara-host.ts`를 불러오고 `ensureMarinaraHost()`를 기다리므로, 패키지 모듈이 평가될 때는 네임스페이스가 이미 완성되어 있습니다. 패키지 클라이언트가 없는 Engine은 이 파일을 아예 불러오지 않습니다. 이 파일을 불러오지 못하면(예: 업데이트 뒤에 남은 오래된 청크) 각 패키지는 기존의 로드 오류를 표시하고, Engine의 나머지 부분은 계속 동작합니다. TypeScript 타입은 `packages/client/src/lib/marinara-host-contract.ts`의 `MarinaraHostV1`이며, 이 페이지의 목록도 같은 파일에 함께 있습니다. 패키지 빌드는 Engine 소스를 가져오지 않고, 이에 맞는 구조적 타입을 직접 선언합니다.

| 멤버 | 값 |
| --- | --- |
| `version` | `1`. 형태가 호환되지 않게 바뀔 때만 바뀝니다. |
| `capabilityApi` | Engine의 `supportedCapabilityApi`입니다. 예: `{ major: 1, minor: 341 }`. |
| `stores` | 실제로 동작 중인 zustand 스토어 `ui`, `chat`, `agent`, `sidecar`, `dialog`, `gallery`, `encounter`, `gameState`, `backfill`입니다. `chat`에는 대기 중인 공간 전환 슬라이스가 포함됩니다. |
| `services.tts` | `lib/tts-service.ts` 모듈(`ttsService`, `playWhenAvailable`, ...)입니다. |
| `services.dialogs` | `lib/app-dialogs.ts` 모듈(`showAlertDialog`, `showConfirmDialog`, `showPromptDialog`, `showChoiceDialog`)입니다. |
| `modules` | 베어 지정자를 키로 하는 라이브러리 모듈입니다(아래 참고). |
| `queryClient` | Engine이 렌더링에 쓰는 단 하나의 React Query `QueryClient`입니다. |
| `components.Modal` | 오버레이 순서, Escape 키와 뒤로 가기 버튼 처리를 갖춘 Engine의 `Modal`입니다. |
| `data.emojiCatalog` | `lib/emoji-catalog.generated.ts` 모듈입니다. |
| `api` | `lib/api-client.ts` 모듈(`api`, `ApiError`, `getApiErrorMessage`, ...)입니다. |

패키지는 멤버를 확인한 뒤에만 읽습니다. 예를 들면
`const host = globalThis.__MARINARA_HOST__; if (host?.version === 1 && typeof host.stores?.ui?.getState === "function")`처럼 확인합니다.
네임스페이스는 늘어나기만 합니다. 새 멤버는 Capability API 마이너 버전과 함께 추가되며, 그 멤버가 필요한 패키지는 해당 마이너 버전을 요구합니다. 네임스페이스에 맞춰 빌드한 패키지는 네임스페이스를 추가한 Capability API 버전을 요구하므로, 오래된 Engine은 이런 패키지를 설치하지 않고 이미 있는 버전을 유지합니다. 그래도 멤버가 없으면, 패키지는 상태를 가진 Engine 서비스의 번들 사본으로 절대 대체하지 않습니다. `ui`와 `chat` 스토어는 절대 쓰지 않는 읽기 전용 사본이 되고, 나머지 멤버는 모두 이 기능에 더 새로운 Marinara Engine이 필요하다고 알립니다.

**호스트 모듈.** `modules[specifier]`는 Engine 자체 빌드에서 `import * as m from "<specifier>"`가 반환하는 것과 정확히 같으며, 라이브러리에 `default`가 있으면 그것도 포함합니다. 지정자는 `react`, `react/jsx-runtime`, `react-dom`, `react-dom/client`, `@tanstack/react-query`, `zustand`, `zustand/middleware`, `sonner`, `zod`, `i18next`, `react-i18next`, `framer-motion`, `tailwind-merge`, `clsx`입니다. 패키지 빌드는 이 지정자를 네임스페이스를 읽는 shim으로 연결하므로, 패키지는 Engine의 단 하나뿐인 React로 렌더링하고 Engine의 React Query 캐시와 토스트를 공유합니다.

- 패키지는 `<Toaster>`를 렌더링하지 않고 `QueryClient`도 만들지 않습니다. `sonner`의 `toast`는 사용자가 정한 토스트 위치에 표시됩니다. 쿼리가 자체 옵션을 지정하지 않으면 Engine의 쿼리 기본값(30초 `staleTime`, 재시도 1회, 창 포커스 시 다시 가져오기 없음)이 적용되며, 패키지가 소유하는 새 쿼리 키는 패키지 ID로 시작합니다.
- 패키지는 `<I18nextProvider>` 안에서 `i18next.createInstance()`로 만든 자체 i18next 인스턴스를 유지합니다. Engine의 인스턴스를 바꿔 버리는 `initReactI18next`, `setI18n`, `setDefaults`는 절대 쓰지 않습니다.
- `lucide-react`, `chess.js`, `scheduler`, `@marinara-engine/shared`는 호스트 모듈이 아닙니다. 패키지는 이 중 사용하는 부분을 번들에 넣습니다.
- 패키지는 다음 메이저 버전에 맞춰 빌드합니다. `react` 19, `react-dom` 19, `@tanstack/react-query` 5, `zustand` 5, `sonner` 2, `zod` 3, `i18next` 26, `react-i18next` 17, `framer-motion` 13, `tailwind-merge` 3, `clsx` 2. Engine에서 이 중 하나의 메이저 버전을 올리면(첫 대상은 React) 이전 메이저 버전으로 빌드한 모든 패키지가 깨지므로, Capability API **메이저** 버전이 필요합니다. `scripts/regressions/marinara-host-namespace.regression.ts`는 `packages/client/package.json`의 메이저 버전이 바뀌었는데 계약이 바뀌지 않으면 실패합니다.

**패키지가 읽는 스토어 필드.** 현재 게시된 패키지는 다음 필드를 읽습니다. Engine은 이 필드를 모두 유지하며, 하나라도 없애거나 이름을 바꾸려면 Capability API 메이저 버전이 필요합니다(`MARINARA_HOST_STORE_FIELDS`가 `Pick<>`으로 고정합니다).

| 스토어 | 필드 |
| --- | --- |
| `ui` | `achievementsEnabled`, `debugMode`, `includeReasoningInExports`, `enableStreaming`, `userStatus`, `enterToSendConvo`, `conversationCallVoiceVolume`, `conversationCallVoiceMuted`, `setConversationCallVoiceVolume`, `setConversationCallVoiceMuted`, `conversationTimeZone`, `noodleNavigation`, `setNoodleNavigation`, `noodleSelectedPersonaId`, `setNoodleSelectedPersonaId`, `reviewImagePromptsBeforeSend`, `musicPlayerEnabled`, `musicPlayerSource`, `sidebarOpen`, `setSidebarOpen`, `chatBackground`, `setChatBackground`, `characterDetailId`, `lorebookDetailId`, `presetDetailId`, `connectionDetailId`, `agentDetailId`, `toolDetailId`, `personaDetailId`, `regexDetailId`, `characterLibraryOpen`, `botBrowserOpen`, `gameAssetsBrowserOpen`, `modal`, `rightPanelOpen`, `closeModal`, `closeRightPanel`, `closeBotBrowser`, `closeAllDetails` |
| `chat` | `activeChatId`, `activeChat`, `isStreaming`, `streamingChatId`, `abortControllers`, `reset`, `pendingSpatialTransitions`, `setPendingSpatialTransition`, `clearPendingSpatialTransition`, `setPendingSpatialTransitionStatus` |
| `agent` | `setYoutubePlay`, `reset` |
| `sidecar` | `modelDownloaded`, `modelDisplayName`, `fetchStatus` |
| `dialog` | `dialog`, `openDialog`, `closeDialog` |
| `gallery` | `pinImage`, `pinVideo` |
| `encounter` | `reset` |
| `gameState` | `current`, `setGameState`, `reset` |
| `backfill` | `resetBackfill` |

**Engine이 소유하는 브라우저 저장소.** 패키지는 다음 키를 읽을 수는 있지만 절대 쓰거나 지우지 않습니다. `marinara-engine-ui`, `marinara-engine-ui:host`, `marinara-active-chat-id`, `marinara-input-drafts`(로컬 저장소와 세션 저장소), `marinara-pending-spatial-transitions`, `marinara-pinned-gallery-images`, `marinara_sidecar_prompted`. IndexedDB 데이터베이스 `marinara-tts-audio-cache`도 절대 열지 않습니다. 설정을 바꾸려면 패키지는 스토어의 액션을 호출합니다. 예를 들어 `host.stores.ui.getState().setConversationCallVoiceMuted(true)`를 호출하면 Engine이 그 설정을 저장합니다.

**앱 대화 상자.** Engine은 알림, 확인, 입력, 선택 대화 상자를 가장 위의 레이어인 명령 바의 레이어에 렌더링합니다. 그래서 패키지가 연 대화 상자는 패키지 자체 오버레이 위에 표시되고 포커스를 가져갑니다.

**네임스페이스 이전의 패키지 빌드.** 이런 빌드는 버전 74인 UI 스토어 사본을 자체 번들에 넣고 있으며, 그 사본이 아는 설정만으로 `marinara-engine-ui`를 덮어씁니다. Engine은 쓸 때마다 호스트 전용 사본인 `marinara-engine-ui:host`에도 저장하고, 불러올 때 그 사본이 현재 버전이면 자기 버전보다 오래된 저장 데이터는 무시합니다. Engine은 클래식 JSX 런타임을 쓰는 설치된 번들을 위해 여전히 `globalThis.React`와 `globalThis.ReactDOM`을 설정합니다.

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

반환한 호스트에는 `spaceId`, `label`, `embed(texts, signal?, inputType?)`가 있습니다. 입력 유형은 Capability API 1.68을 참고하세요. 설정된 임베딩 소스를 사용하며, 소스가 없거나 설정 해석이 실패하면 내장 로컬 MiniLM 임베더로 대체합니다. `embed`는 `null`을 반환할 수 있습니다. 빈 배치, 128개 초과 텍스트, 합계 200,000자 초과는 거부됩니다. 새 호스트가 기존 벡터를 다시 임베딩하지는 않으므로 패키지는 저장된 벡터와 비교하기 전에 `spaceId` 변경을 처리해야 합니다.

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

- 이름은 `<packageId>_<name>` 형식의 이름 공간을 가지며 `-`는 `_`로 바뀝니다. 따라서 `world-clock`의 `set_time`은 `world_clock_set_time`으로 모델에 전달됩니다. 다른 패키지가 이미 사용 중인 전체 이름은 거부됩니다. 기본 도구와 활성화된 사용자 지정 도구는 충돌하는 이름의 소유권을 유지하며, 패키지 정의는 생략되고 기본 도구나 사용자 지정 도구의 핸들러가 실행됩니다. 전체 이름은 제공자 한도인 **64자** 이하여야 합니다. 모델에 보여 주는 정의와 실행부 모두 기본, 사용자 지정, 패키지 순서로 이름을 해석하므로, 호출은 항상 그 이름의 소유자가 실행합니다.
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

패키지 서버 코드는 `api.runtime.decisions.evaluate(...)`로 사용자가 설정한 Decision 모델에 패키지가 제공하는 맥락에 관한 제한된 예/아니요 질문과 선택 질문을 할 수도 있습니다. 에이전트 활성화 질문 및 프롬프트 조건문과 같은 Decision 모델(관리형 로컬 모델 또는 Decision 연결)을 쓰며, 키나 Engine 내부는 노출하지 않습니다. `decisions`는 선택 사항이며 더 새로운 Capability API나 권한이 필요 없습니다. `typeof api.runtime.decisions?.evaluate === "function"`을 확인하고 오래된 Engine에서는 대체 동작을 쓰세요.

```ts
const result = await api.runtime.decisions?.evaluate({
  messages: [{ role: "user", content: "The tavern falls silent as the stranger draws a blade." }],
  questions: [
    { id: "danger", question: "Someone is about to be attacked." },
    { id: "mood", question: "The mood of the scene is", options: ["calm", "tense", "festive"] },
  ],
  // Optional: pass `signal` to cancel and `debugMode: true` to log the Decision prompt.
});
// null: no Decision model is configured, or it gave no answer (unreachable, timed out or cancelled).
if (result && (result.answers.danger ?? 0) >= result.threshold) {
  // ...
}
```

- `messages`는 패키지 자체의 맥락이며 오래된 것부터 순서대로 넣습니다(최대 200개 메시지와 200,000자이며, 메시지 `name`은 최대 100자). 모델에 맞추기 위해 가장 오래된 메시지부터 버려집니다.
- 각 `question`은 최대 500자이며 id는 고유해야 합니다. 선택 질문에는 `options`가 두 개 이상 있어야 하며, 답은 그중 하나이거나 `"none of these"`입니다.
- 요청 하나로 받을 수 있는 답의 수는 최대 사용자의 **Decision statements per turn**(턴당 판정문 수) 한도까지입니다. 선택 질문은 옵션 하나당 1로 세고 거기에 1을 더합니다. 잘못된 요청은 `TypeError`를 던집니다.
- `answers`에는 예/아니요 질문별로 예일 확률이 들어 있으며, 여기에 없는 질문은 답을 받지 못한 것입니다. `threshold`, 즉 모델 자신의 기준점과 비교하세요. 확률은 Decision 모델 사이에서 서로 비교할 수 없습니다.

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

업데이트에는 사용자의 동의가 필요합니다. 업그레이드한 설치의 예전 내장 기능을 유지하는 일회성 마이그레이션([호환성 마이그레이션](#compatibility-migration) 참고)을 제외하면, 시작할 때 패키지를 다운로드하거나 설치하는 일은 없습니다. `GET /api/capability-packages/updates/pending`은 카탈로그 버전이 더 새롭고 실행 중인 엔진 및 Capability API와 호환되는 설치된 공식 패키지를 나열하되, 사용자가 이미 거절한 버전은 뺍니다. 클라이언트는 이를 **Agent updates available**(에이전트 업데이트 있음) 안내 하나로 보여 줍니다. **Update all**(모두 업데이트)은 각 패키지를 제시된 버전과 아티팩트 SHA-256에 고정해 일반 설치 파이프라인으로 설치합니다. **Not now**(나중에)는 거절한 버전을 `DATA_DIR/capability-packages/update-decisions-v1.json`에 기록하므로(`POST /api/capability-packages/updates/decline`) 그 버전은 다시 제시되지 않지만, 더 새 버전은 제시됩니다. 어느 쪽이든 **Download Agents**의 **Update**는 계속 쓸 수 있습니다. 실패는 패키지 단위로 격리합니다. 카탈로그에 연결하지 못하거나 검증에 실패해도 이미 있는 파일과 레지스트리 상태는 그대로 쓸 수 있고, 서버 런타임 준비에 실패하면 이전 버전으로 되돌리는 경로를 탑니다.

릴리스 노트는 설명 대상인 `catalog.json` 옆에 `notes.json`으로 게시하며, 카탈로그 항목이나 매니페스트 안에는 절대 넣지 않습니다. 오래된 엔진은 모르는 키가 있는 카탈로그 항목을 버리기 때문입니다. 대기 중인 각 업데이트에는 설치된 버전 다음부터 제시된 버전까지 모든 버전의 노트가 최신순으로 `releaseNotes`에 담기며, 그중 하나라도 사용자가 알아챌 변경으로 표시되어 있으면 `releaseHighlight`가 true입니다. 노트는 일반 텍스트이며 Markdown이나 HTML로 렌더링하지 않습니다.

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

### 디스크 사용량: 런타임 사본과 보관 버전

패키지 서버는 `DATA_DIR/capability-packages/versions/<id>/<version>`에서 직접 실행되지 않습니다. 활성화할 때마다 설치된 파일을 검증하고, `DATA_DIR/capability-runtime-snapshots` 아래의 새 폴더로 복사한 다음 그 사본을 가져옵니다. 사본은 해당 런타임이 멈출 때 삭제됩니다.

- **런타임 사본.** 사본에는 클라이언트 진입점을 제외한, 검증된 매니페스트 파일이 모두 들어 있습니다. 서버는 클라이언트 진입점을 불러오지 않으며, 브라우저는 `versions/`에서 받아 갑니다. 자산은 남겨 두므로, Quartermaster가 `icons/`를 읽듯이 서버는 자기 `server.mjs` 옆의 파일을 읽을 수 있습니다. 복사한 파일은 읽기 전용입니다.
- **시작 시 정리.** 크래시나 강제 종료가 일어나면 사본 정리를 건너뜁니다. Engine은 시작할 때마다, 어떤 패키지도 활성화하기 전에 공유 `node_modules` 링크를 제외한 `capability-runtime-snapshots`의 모든 항목을 삭제합니다. 그중 어느 것도 새 프로세스가 쓰고 있을 수 없기 때문입니다. 먼저 읽기 전용 파일을 쓰기 가능하게 바꾸며(Windows에서 필요합니다), 링크는 절대 따라가지 않습니다. 저장소 쓰기 임대(writer lease)를 가진 프로세스만 이 단계에 도달하므로, 같은 데이터 폴더로 시작한 두 번째 Engine은 저장소를 열 때 멈추고 실행 중인 Engine의 사본을 절대 삭제하지 않습니다.
- **보관 버전.** `versions/<id>`는 현재 버전과, 새 서버 런타임이 시작에 실패할 때 롤백으로 복원하는 `previousVersion`을 보관합니다. 그보다 오래된 버전과, 업데이트에 실패해 롤백된 새 버전은 활성화나 업데이트가 성공한 뒤와 시작할 때 삭제됩니다. 업데이트가 다시 시작을 기다리는 패키지(`restart-required`)나 런타임이 아직 시작되지 않은 패키지(`readiness: "pending"`)는 시작될 때까지 모든 버전을 보관합니다.
- **절대 삭제하지 않는 것:** 패키지 데이터(`DATA_DIR/long-term-memory` 같은 폴더와 `storage` 안의 패키지 테이블), 채팅, 설정, `installed.json`, 업데이트 결정, `.install-*` 폴더, 레지스트리에 없는 ID의 `versions/` 폴더. 제거할 때도 여전히 패키지 코드만 지우고 데이터는 유지합니다.

<a id="compatibility-migration"></a>

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

**Agents**(에이전트) 패널에는 Characters 패널과 Personas 패널에서 Card Browser를 여는 `Download` 버튼에 대응하는 `Download Agents` 컨트롤이 있습니다. 이 컨트롤을 누르면 전체 화면 라이브러리가 열리고, 검색, 패키지 종류, 호환 정보, 설치/업데이트 상태, 권한, 저장 공간 사용량, 문서, 제거 컨트롤을 화면 크기에 맞춰 보여 줍니다.

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

규칙 집합은 선택적 최상위 `combat` 블록으로 전투를 자체 숫자로 어떻게 판정하는지 정할 수 있습니다. 무엇을 무엇에 맞서 굴리는지, 행동 경제, 시트의 어느 목록이 공격이고 어느 목록이 능력인지, 상태가 어떤 효과를 내는지, 집중, 캐릭터가 0이 되면 어떻게 되는지, 어떤 피해 유형이 있는지, 상대를 고르는 위협 단계의 척도를 정합니다. 같은 릴리스에서 카탈로그 항목의 `mechanics`는 대상을 몇 명 고르는지, 항상 명중하는지, 어떤 상태를 적용하는지, 임시 점수를 얼마나 주는지, 시트에 따라 어떻게 커지는지, 어떤 예산을 소모하는지 정할 수 있습니다.

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

규칙 집합의 `resolution`은 `"dice-sum"` 대신 `"kind": "dice-pool"`을 선언할 수 있습니다. 그러면 판정에서 캐릭터 시트에 적힌 수만큼 주사위를 던지고 목표값에 도달한 주사위를 셉니다. 선택적으로 두 배로 세는 면, 폭발하는 면, 상쇄하는 면, 대실패, 뛰어난 성공을 정할 수 있고, Game Master가 판정 하나에 더하거나 뺄 수 있는 상황별 주사위의 범위도 정할 수 있습니다.

```json
{
  "capabilityApi": { "major": 1, "minor": 24 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

시트는 같은 시트입니다. `dice-sum`에서 굴림에 더하는 값이 여기서는 주사위 수가 됩니다. 그래서 이 방식에는 새 시트 어휘도, 편집기 슬롯도, 패키지 코드도 없습니다.

1.20~1.23과 같은 이유로 유연한 인터페이스가 아닙니다. `dice-sum`만 아는 Engine은 규칙 집합 파일 전체를 거부하므로, 설치는 `ruleset.json`의 검증된 바이트를 읽어 오래된 선언 아래의 `dice-pool` 판정을 거부합니다. 권한은 필요 없으며 주사위를 합산하는 규칙 집합은 변하지 않습니다.

### Capability API 1.23: 연동되는 카탈로그 값

카탈로그 항목의 행은 선택적 `scaled` 맵을 담을 수 있습니다. 플레이어가 아니라 규칙 집합이 값을 관리하는, 그 행 자체의 숫자 열을 최대 4개까지 지정합니다. 각각은 선택적 단계 표가 붙은 일반 값 참조이므로, 형식에 새 산술 연산을 추가하지 않고도 직업 자원이 레벨을 따르고 기능의 사용 횟수가 능력치를 따르게 할 수 있습니다.

```json
{
  "capabilityApi": { "major": 1, "minor": 23 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/spells.json"] } }
}
```

값은 시트를 편집할 때 계산하며 읽을 때는 계산하지 않습니다. 따라서 라이브 상태, Game Master 프롬프트 블록과 전투 연결은 계속 저장된 숫자를 읽습니다.

연동 행은 `ruleset.json` 안이나 `catalogs/<id>.json` 자산에 놓을 수 있습니다. 매니페스트는 둘을 자산으로 선언하지만 내부 키를 보여 주지 못하므로 설치가 양쪽 검증된 바이트를 읽어 1.23보다 오래된 선언의 `scaled` 키를 거부합니다. 1.21의 `catalogs`, 1.22의 `battle`과 같은 방식입니다. 오래된 Engine의 엄격한 스키마도 파일 전체를 거부합니다. 권한은 필요 없으며 연동 항목 없는 카탈로그를 가진 규칙 집합은 변하지 않습니다.

같은 릴리스는 `[sheet: op="use" name="..."]` 명령도 추가합니다. 이 명령은 카탈로그 항목의 `mechanics.cost`와, 그 항목이 만든 모든 행 풀의 사용 횟수 1회를 지불합니다. 선언은 필요 없습니다. Engine이 이미 제공하는 카탈로그를 읽기 때문입니다.

### Capability API 1.22: battle 블록

규칙 집합은 선택적 `battle` 블록을 담을 수 있습니다. 이 블록은 캐릭터 시트의 숫자를 전투에 빌려 줍니다. 체력이 되는 라이브 풀, MP가 되는 선택적 풀, 주문 슬롯이 되는 풀, 그리고 카탈로그 표시가 붙은 행이 Engine 자체의 `CombatSkill`이 되는 시트 목록을 지정합니다. 전투가 끝나면 소모한 체력, 기력, 슬롯을 플레이어 버튼이 쓰는 것과 같은 시트 작업으로 다시 기록합니다.

```json
{
  "capabilityApi": { "major": 1, "minor": 22 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

이것은 전투 어댑터가 아닙니다. 피해 계산은 계속 Engine이 하며, 카탈로그 항목의 `attackRoll`, `save`, `concentration`, `perCostStep`은 아무도 읽지 않습니다. 규칙에 정확한 판정은 전투 인계 작업의 규칙 집합별 어댑터가 맡습니다. `coverage.combat`는 독자적인 의미를 유지하며 이 연결은 그 값을 절대 읽지 않습니다.

블록은 매니페스트가 보여 줄 수 없는 `ruleset.json` 안에 있으므로, 설치는 검증된 바이트를 읽어 1.22보다 오래된 선언 아래의 `battle` 키를 거부합니다. 1.21 아래의 `catalogs`와 똑같은 방식입니다. 오래된 Engine의 엄격한 스키마도 어차피 규칙 집합 파일 전체를 거부합니다. 권한은 필요 없으며 `battle` 블록이 없는 규칙 집합은 변하지 않습니다.

### Capability API 1.21: 카탈로그

규칙 집합은 **카탈로그**를 담을 수 있습니다. 카탈로그는 미리 만들어 둔 항목(주문, 직업 능력, 장비)의 이름 붙은 모음으로, 시트 편집기가 선택기로 제공하므로 플레이어가 목록을 한 행씩 입력하지 않아도 됩니다. 헤더는 `ruleset.json`의 `catalogs` 아래에 두고, 항목은 그 헤더 안에 인라인으로 두거나 카탈로그마다 파일 하나씩인 전용 예약 자산에 둡니다.

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

`catalogs/<id>.json`은 예약 자산 계열입니다. 파일 이름이 카탈로그 자체의 ID이므로 Engine은 규칙 집합만 보고 파일을 찾을 수 있고, 어떤 카탈로그도 다른 카탈로그의 파일을 지정할 수 없습니다. 카탈로그 자산은 다른 선언 자산처럼 `files[]`에서 해시로 고정되고, 그것을 선언한 `ruleset.json` 옆에만 함께 배포되며, 선언 크기가 2 MB를 넘으면 읽기 전에 거부됩니다(Capability API 1.340 이전에는 1 MB이며, 1 MB를 넘는 카탈로그 파일이 있는 패키지는 1.340을 선언합니다). 내용은 인라인 항목과 같은 시트를 기준으로 같은 검사를 거치므로 카탈로그는 시트가 담을 수 없는 행을 절대 쓸 수 없습니다. 규칙 집합당 카탈로그는 최대 12개, 카탈로그당 항목은 최대 2000개입니다.

클라이언트는 선택기가 열릴 때만 `GET /api/capability-packages/rulesets/catalog?rulesetId=&catalogId=&version=`로 카탈로그를 가져옵니다. 설치된 규칙 집합 목록은 시트 편집기가 열릴 때마다 읽으므로 인라인 항목은 담지 않고 개수만 담습니다. 카탈로그 글은 프롬프트에 들어가지 않습니다. Game Master는 여전히 `gm.sheetSummary`가 지정한 내용만 보므로 카탈로그는 토큰을 쓰지 않습니다.

1.20과 마찬가지로 유연한 인터페이스가 아니며, 카탈로그가 매니페스트가 아니라 규칙 집합 파일 안에 있으므로 검사도 두 부분으로 나뉩니다. `catalogs/<id>.json` 자산을 선언하려면 1.21이 필요하고, `catalogs` 키가 있는 `ruleset.json`은 매니페스트가 그보다 낮게 선언하면 설치 시 거부됩니다. 오래된 Engine의 엄격한 스키마도 어차피 규칙 집합 파일 전체를 거부하기 때문입니다. 이전처럼 권한은 필요 없습니다.

### Capability API 1.20: Game Mode 규칙 집합

규칙 집합은 검증된 데이터로 표현한 게임 규칙입니다. Engine이 이미 구현한 판정 방식, 정해진 기본 요소 집합으로 선언한 캐릭터 시트, 휴식, Game Master 프롬프트용 지침으로 이루어집니다. 패키지는 이를 예약 파일명 자산 `ruleset.json`으로 배포하며, `gm-verbs.json`과 똑같이 관례로 찾습니다. `contributions.assets.paths`에 나열하고 `files[]`에서 해시로 고정합니다.

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

예시는 규칙 집합에 중요한 키만 보여 줍니다. 일반 매니페스트 필드(`name`, `version`, `description`, `engine`, `builtAgainst`)는 여전히 필수입니다.

규칙 집합 패키지에는 권한, 서버나 클라이언트 진입점, 에이전트가 필요 없습니다. 종류와 자산은 함께 갑니다. `ruleset` 종류의 패키지는 `ruleset.json`을 나열해야 하고, `ruleset.json`을 나열한 패키지는 그 종류를 선언해야 하므로, 규칙 집합이 다른 종류에 섞여 들어올 수 없습니다. 파일 안의 어떤 것도 실행되지 않습니다. 표현식 문자열이 없으며, 어떤 판정 방식으로도 표현할 수 없는 메커니즘은 규칙 집합이 할 수 있는 일이 아니라 새 판정 방식을 추가하는 Engine 변경입니다. 형식, 공식 5e 파일, 그 구조를 택한 이유는 [`game-rulesets-and-sheets-implementation.md`](game-rulesets-and-sheets-implementation.md)에 있습니다.

유연한 인터페이스가 아닙니다. 규칙 집합 패키지는 그것을 읽지 못하는 Engine에서 아무 일도 하지 않으므로, `ruleset.json`을 나열한 매니페스트는 Capability API 1.20을 선언해야 하며 오래된 Engine은 설치를 명확하게 거부합니다.

Engine은 선언 크기가 512 KB를 넘는 자산을 읽기 전에 거부하고(Capability API 1.340 이전에는 256 KB이며, 규칙 집합이 256 KB를 넘는 패키지는 1.340을 선언합니다), 설치 시점의 해시로 다시 검증한 뒤, 엄격한 공용 스키마(`packages/shared/src/schemas/ruleset.schema.ts`)로 검증합니다. 쓸 수 없는 파일은 패키지 이름과 처음 몇 개의 `path: message` 문제를 적은 로그 한 줄과 함께 제외합니다. 같은 규칙 집합 ID를 선언한 패키지가 둘이면 패키지 ID 순서상 첫 번째로 정해지며, 나머지는 로그와 함께 제외합니다. `engine-legacy`와 `traditional`은 Engine이 소유한 ID라 파일이 사용할 수 없습니다.

게임은 만들 때 한 번 규칙 집합을 `chat.metadata.gameRuleset`으로 고정합니다. 고정이 없으면 이전과 똑같이 Engine 자체 규칙을 씁니다. 설치 환경이 지킬 수 없는 고정(패키지가 없거나 설치된 정의가 고정된 버전보다 오래됨)은 사용할 수 없음으로 보고되며 다른 규칙 집합으로 재해석하지 않습니다. 고정은 규칙 집합 ID와 그것을 제공한 패키지로 함께 대조하므로, 같은 ID를 주장하는 다른 패키지가 기존 게임을 가져가지 않습니다.

### Capability API 1.73: 아바타 에이전트

Engine은 두 아바타 에이전트 `2d-avatars`(PNGTuber 스프라이트와 메시 아바타)와 `3d-avatars`(VRM 모델)를 호스팅합니다. 패키지는 얇게 유지합니다. 각각 에이전트 정의 하나, 기본 프롬프트, 로케일, 카탈로그 항목만 담습니다. 나머지는 모두 Engine이 소유합니다. `DATA_DIR/avatar-models/` 아래의 소유자별 저장소, 가져오기, 지연 로드되는 렌더러, 각 에이전트의 에이전트 편집기 페이지에 있는 설정, 스트림 디렉터, 표정 분류기, 생성 라우트가 여기에 속합니다. 공유 계약은 `packages/shared/src/types/avatars.ts`(스키마는 `schemas/avatars.schema.ts`)이고, 클라이언트 쪽 절반은 `packages/client/src/features/avatars/contract.ts`입니다. 사용자 가이드는 [`docs/agents/avatars.md`](../agents/avatars.md)입니다.

새 매니페스트 필드는 없습니다. 아바타 패키지는 스키마 버전 2와 Capability API 1.73을 선언하므로, 이 화면이 없는 Engine은 아무것도 보여 주지 않는 에이전트를 목록에 올리는 대신 설치를 거부합니다. 1.73을 도입한 변경은 이 화면을 아무 동작도 하지 않는 스텁으로 넣었습니다. 이제 Engine의 설정, 스테이지, 렌더러가 `staging`에 들어왔고, 두 패키지는 미리보기 카탈로그에 올라 있습니다. 설치가 동작하려면 두 패키지가 참조하는 아티팩트 URL이 먼저 게시되어야 합니다. 카탈로그 항목만으로는 다운로드할 아티팩트가 실제로 있다는 증거가 되지 않습니다. 2D 에이전트의 생성 프롬프트는 `defaultSettings` 안의 `avatarGenerationTemplates` 프롬프트 템플릿 모음으로 제공되며, ID는 `AVATAR_PROMPT_TEMPLATE_IDS`에 있습니다. 에이전트 편집기는 다른 내장 템플릿 모음과 똑같이 이 템플릿을 병합하고 초기화합니다.

### Capability API 1.72: Experience의 지도 팩

Game 마법사로 설정하는 `game-surface` 패키지(`gameSurface.setup`, 1.18)는 스키마 버전 2와 Capability API 1.72로 지도 팩을 함께 배포할 수 있습니다. 지도 팩에는 자체 세계관 키트, 그 키트로 미리 만든 월드, 자체 타일 팩이 들어갑니다. 각각은 Game Mode와 Pixelforge가 이미 읽고 쓰는 공유 파일(`.worldkit.json` 하나, `.world.json` 파일들, `.tilepack.json` 하나)이며, 동시에 선언되고 해시가 고정된 에셋입니다.

```json
{
  "gameSurface": {
    "setup": {},
    "mapPack": {
      "kit": "map/riverlands.worldkit.json",
      "worlds": ["map/upriver.world.json", "map/downriver.world.json"],
      "tiles": "map/riverlands.tilepack.json"
    }
  },
  "assets": {
    "paths": [
      "map/riverlands.worldkit.json",
      "map/upriver.world.json",
      "map/downriver.world.json",
      "map/riverlands.tilepack.json"
    ]
  }
}
```

`worlds`(최대 32개)와 `tiles`는 선택 사항입니다. 월드 파일에는 그 월드의 스토리 스크립트(worldgen W10)가 들어 있을 수 있으며, 스토리 스크립트는 지도의 일부로 함께 배포됩니다. 버전 2 월드 파일에는 월드를 만든 당시 모습인 `snapshot`(W11)도 들어 있습니다. 그 뒤로 월드 생성기가 바뀐 Engine도 이 스냅샷에서 월드를 만든 그대로 읽으므로, 팩은 Engine을 업데이트해도 계속 동작합니다. 파일은 게임이나 라이브러리 월드의 **Download**(또는 `GET /api/game/:chatId/world/file`)로 만드세요. 이렇게 만든 파일에는 스냅샷이 들어 있습니다. 팩 파일은 최대 8 MB로, Engine이 읽는 가장 큰 공유 파일 크기입니다(타일 팩은 자체적으로 더 작은 한도를 유지합니다). 따라서 파일이 그보다 큰 월드(아주 큰 월드의 스냅샷)는 팩에 넣어 배포할 수 없습니다. 스토리에서 `intro`를 설정하는 월드는 Capability API 1.339가 필요합니다([도입 메시지](../extending/writing-story-scripts.md#the-intro-message) 참고). `tiles`는 이미지 타일 팩(타일 팩 버전 2: 셀 격자 위의 PNG 시트이며, 여러 셀에 걸친 스프라이트를 포함할 수 있음)일 수도 있으며, 이 경우 Capability API 1.80이 필요합니다. Engine은 패키지 버전마다 한 번 시트를 디코딩하고 검사합니다. Experience를 켜면 새 게임은 팩의 키트로 고정됩니다. 팩에 월드가 있으면 플레이어는 그중 하나를(스토리 포함) 고르고 다른 월드는 만들지 않습니다. Experience를 끄면 플레이어가 다시 직접 고를 수 있습니다. `POST /api/game/create`도 게임에 같은 고정을 적용합니다. 게임은 여느 게임처럼 키트와 월드를 보관하므로 패키지를 제거해도 계속 플레이할 수 있고, 패키지가 설치되어 있는 동안에는 오버월드와 마을을 팩의 타일로 그립니다.

Engine은 검증된 에셋 경로로 파일을 읽고(파일마다 선언 크기 최대 8 MB, 해시 재확인), 공유 파일을 검사하는 방식 그대로 검사합니다. 파일을 읽을 수 없거나, 월드가 다른 키트로 만들어졌거나 키트에 맞지 않거나, 바이트가 설치된 것과 다르면 팩 전체를 이유와 함께 거부합니다. 그러면 그 Experience로는 게임을 시작할 수 없습니다. 규칙 집합은 지도 팩에 절대 들어가지 않습니다. 자체 규칙이 필요한 Experience는 별도의 규칙 집합 패키지를 배포합니다.

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

세 필드는 모두 선택 사항입니다. 선언한 시드는 선택한 Experience 아래에 **Randomize**(무작위 생성) 버튼과 함께 표시됩니다. 시드는 0부터 4294967295까지의 부호 없는 정수입니다. 비어 있거나, 소수, 음수, 지수, 16진수 입력은 **Start**(시작)를 차단합니다. 호스트는 숫자 시드와 선언된 상수를 `experienceConfig`에 씁니다. `config`에는 시드 키를 포함할 수 없습니다. 상수는 직렬화한 결과가 8,000자 이하여야 합니다. 시드 레이블은 패키지 작성자가 제공하는 표시 텍스트입니다. 생략하면 Engine의 현지화된 레이블을 사용합니다.

선언된 위젯 요구 사항은 Experience가 활성인 동안 강제로 적용됩니다. 호스트는 컨트롤을 선언된 값으로 설정해 잠그고, 어떤 Experience가 그렇게 설정했는지 설명합니다. 설정 파일을 가져와도 선언된 값을 바꿀 수 없습니다. 플레이어가 이전에 직접 고른 값은 건드리지 않고 보관했다가 Experience를 끄는 즉시 복원합니다. 이러한 Experiences에서는 공간 지도 설정 컨트롤을 숨기므로 별도의 지도 초안, 템플릿 또는 빌더를 실행하지 않습니다.

**Lorebooks**(로어북) 단계에서는 연결되지 않은 책의 항목을 포함해 활성화된 개별 항목을 최대 100개 선택할 수 있습니다. 비활성화된 책과 항목, 채팅 제외 설정을 준수합니다. 이 ID는 `GameSetupConfig.activeLorebookEntryIds`로 전달됩니다. `/game/setup`에서는 추가 강제 항목으로 확률 판정을 건너뛰지만 일반 토큰 제한은 유지합니다. 전역 로어, 캐릭터에 연결된 로어, 첨부된 로어는 계속 일반 스캔에 참여합니다. 패키지도 설정에서 동일한 선택 ID를 읽어 자체 월드 생성 요청에 사용할 수 있습니다. 이 기기에 없는 가져온 항목 ID는 알린 뒤 건너뜁니다.

설정 파일을 가져오면 설치된 호환 Experience와 유효한 숫자 시드를 복원하지만 임의의 패키지 설정은 버립니다. 현재 매니페스트가 상수를 다시 제공합니다. 쓸 수 있는 Experience 시드가 없는 파일은 미리 채워진 무작위 시드를 그대로 둡니다. 기존 게임은 이유를 설명하고 Experience 가져오기를 건너뜁니다. 생성 스냅샷은 설정 요약을 위해 Experience 이름과 시드를 보관합니다.

첫 턴 전에 월드를 준비해야 한다면 기존 시작 준비 선언을 별도로 사용하세요. 패키지의 최소 버전으로 API 1.18을 선언하세요. 이전 호스트는 이 설정 선언을 해석하지 못합니다.

### Capability API 1.71: 에이전트가 읽는 방식으로 메시지 읽기

Roleplay에서는 메시지에 `content`에 포함되지 않는 귓속말이 담길 수 있습니다. Engine이 실행하는 모든 에이전트는 이 귓속말을 읽으며, 이제 채팅을 직접 읽는 패키지도 같은 텍스트를 읽을 수 있습니다. `persistence.listMessages(chatId)`가 돌려주는 각 레코드에 `agentContent`가 추가됩니다. Engine 에이전트가 읽는 형태의 메시지입니다. 각 귓속말은 원래 자리에 `[Private whisper to <name>: …]` 표시와 함께 들어가며, 귓속말만 있는 메시지는 그 귓속말로 읽힙니다. 편지처럼 캐릭터가 건네는 문서는 메시지 뒤에 이어집니다. 플레이어의 비공개 메모는 빠집니다.

`agentContent`는 Roleplay 채팅에만 있습니다. 다른 모드와, 에이전트가 쓴 내용을 모두가 보는 호스팅한 멀티플레이어 방에서는 빠집니다. `content`는 바뀌지 않으며 여전히 공개 텍스트입니다. `extra`도 바뀌지 않습니다. 이 필드는 모든 모드에서 귓속말이 모두 들어 있는 메시지의 저장 데이터입니다. 이 필드로 만든 텍스트를 귓속말 대상이 아닌 플레이어나 캐릭터에게 절대 보여 주지 마세요.

```ts
const messages = await api.runtime.persistence.listMessages(chatId);
const history = messages.map((message) => message.agentContent ?? message.content);
```

소프트 인터페이스입니다. 오래된 Engine은 이 필드를 넣지 않으므로 `agentContent ?? content`를 읽는 패키지는 1.71을 선언할 필요가 없습니다. `listMessages`와 마찬가지로 `chat-read` 권한이 필요합니다. 귓속말은 비공개입니다. 패키지가 귓속말을 바탕으로 쓰는 메모나 기억 같은 내용은 귓속말 대상이 아닌 캐릭터에게 전달될 수 있습니다.

### Capability API 1.68: 검색 쿼리를 쿼리로 임베딩

`embeddings.embed(texts, signal?, inputType?)`는 세 번째 인수를 받습니다. 회상 쿼리처럼 검색에 쓰는 텍스트에는 `"query"`를 전달하세요. 텍스트의 기본값은 `"document"`입니다. 일부 임베딩 모델은 쿼리에 접두사를 기대하고, 일부는 문서에도 접두사를 기대합니다. e5와 nomic-embed-text는 쿼리와 문서에 각각 하나씩 붙이고, Snowflake Arctic Embed v2는 쿼리에만 접두사를 붙입니다. 알맞은 접두사는 Engine이 붙입니다. 쿼리를 문서로 임베딩하면 회상 성능이 떨어집니다. 내장 MiniLM 임베더를 포함한 다른 모델은 어느 쪽이든 접두사를 받지 않습니다. 입력 유형은 `spaceId`를 바꾸지 않으므로 저장된 벡터를 계속 비교할 수 있고 다시 임베딩할 필요도 없습니다.

```ts
const embeddings = await api.runtime.resolveEmbeddings();
const [queryVector] = (await embeddings.embed([query], signal, "query")) ?? [];
const memoryVectors = await embeddings.embed(memoryTexts, signal); // documents
```

소프트 인터페이스입니다. 오래된 Engine은 세 번째 인수를 무시하므로 패키지는 언제나 이 인수를 전달해도 되며 1.68을 선언할 필요가 없습니다. 입력 유형은 옵션 객체에 넣지 말고 반드시 세 번째 인수로 전달하세요. 오래된 Engine은 두 번째 인수를 중단 신호로 여겨 제공자에게 그대로 넘깁니다.

### Capability API 1.67: 편집기에서 캐릭터 열기

브라우저 뷰에 `openCharacter(characterId, { tab })`가 생깁니다. 캐릭터 편집기를 열고, 탭이 주어지면 해당 탭으로 이동하므로 패키지가 자신이 읽는 카드 필드로 사용자를 안내할 수 있습니다. 오래된 Engine에는 이 함수가 없습니다. 링크를 보여 주기 전에 `openCharacter`가 있는지 확인하세요.

```ts
if (typeof props.openCharacter === "function") props.openCharacter(characterId, { tab: "convo" });
```

### Capability API 1.66: 패키지 스레드에서 시작하는 장면

Roleplay 장면은 보통 Conversation에서 분기합니다(`/scene`). 새 `scenes` 권한을 가진 패키지는 다이렉트 메시지 스레드 같은 자체 스레드를 대신 출발점으로 삼을 수 있습니다. 장면은 일반 장면 채팅입니다. 같은 플래너, 프롬프트 선호 대화 상자, 장면 지침, End Scene, Discard, Convert 컨트롤을 쓰며, 결말이 나면 같은 캐릭터 기억을 남깁니다. 스레드 쪽은 패키지가 소유합니다. 플래너가 읽는 내용, 장면이 진행되는 동안의 잠금, 요약을 어떻게 처리할지를 패키지가 정합니다.

```ts
export async function activate({ api }) {
  api.registerSceneOrigin({
    // Planning context, or null when the thread no longer exists.
    getContext: async (threadId) => ({
      characterIds: [creatorCharacterId],
      personaId,
      connectionId: null, // the Engine's default connection
      transcript: [{ speaker: "Mina", content: "Come to my shoot tonight?" }],
      notes: "Stage persona, limits and anything else the scene writer must respect.",
    }),
    // Lock the thread. Return false when it already has an active scene.
    claim: async (threadId, { sceneChatId, characterIds }) => lockThread(threadId, sceneChatId),
    // Unlock and receive the outcome.
    release: async (threadId, end) => {
      if (!(await holdsLock(threadId, end.sceneChatId))) return;
      if (end.kind === "concluded") await saveRecap(threadId, end.summary);
      await unlockThread(threadId);
    },
  });
}
```

브라우저 뷰(`home-browser-tab`)는 다음 속성을 받습니다.

- `startScene({ originId, prompt?, planHint?, plan?, data?, initiatorCharacterId?, initiatorName? })`는 장면 프롬프트 선호 대화 상자를 열고, 장면을 계획해 만든 다음 그 채팅을 엽니다. 장면을 직접 작성하려면 `plan`(이름, 설명, 숨겨진 시나리오, 첫 메시지, 장면 시스템 프롬프트, 등급, 관계 이력, 참여 안내, 배경, 출연진을 담은 `SceneFullPlan`)을 넘기세요. 그러면 대화 상자와 Engine 플래너를 건너뛰고 계획한 그대로 장면을 만듭니다. 결과는 `{ chatId }`이며, 사용자가 취소하거나 생성에 실패하면 `null`입니다(사용자에게는 이유가 표시됩니다). 이 헬퍼는 항상 패키지 자체 ID를 씁니다. 편의 기능일 뿐 경계가 아닙니다. 장면 라우트는 어떤 패키지 ID든 받으므로 `getContext`는 어차피 그 스레드에서 플레이어가 볼 수 있는 내용만 반환해야 합니다.
- `openChat(chatId)`는 채팅으로 이동합니다. 잠긴 스레드의 "Go to scene" 버튼에 씁니다.
- `focusSceneOriginId`는 사용자가 장면에서 돌아올 때(Back, End Scene, Discard) 보여 줄 스레드입니다. 보여 준 뒤에는 `onFocusSceneOriginHandled()`를 호출하세요.

알아 둘 규칙은 다음과 같습니다.

- `data`는 이 장면의 자체 설정이며, 최대 4,000자의 평범한 JSON 객체입니다. Engine은 이를 장면과 함께 보관하고 `claim(originId, { sceneChatId, characterIds, data })`와 `release`의 `end.data`로 전달합니다. 그래서 장면마다 스스로 결정할 수 있습니다. `claim`은 잠그지 않고 장면을 허용할 수 있고(`true`를 반환하고 아무것도 저장하지 않음), `release`는 요약을 받지 않고 잠금만 풀거나 장면이 요청한 범위로 요약을 받을 수 있습니다.
- 필수는 `getContext`뿐입니다. 장면을 시작하기만 하려는 패키지는 `claim`과 `release`를 생략합니다. 그러면 아무것도 잠기지 않고, 같은 출발점에서 장면을 몇 개든 실행할 수 있으며, 장면이 끝나도 아무것도 전달되지 않습니다(**Back**은 여전히 패키지로 돌아갑니다). 결과를 받지 않고 잠그기만 하려면 `release`만, 잠그지 않고 결과만 받으려면 `claim`만 생략하세요.
- 제공자는 패키지당 하나입니다. 다시 등록하면 교체되고, 비활성화하면 제거됩니다.
- `characterIds`는 Engine 캐릭터여야 합니다. 알 수 없는 ID는 버리며, 알려진 캐릭터가 하나도 없는 컨텍스트는 거부합니다. 알 수 없는 `personaId`는 없는 것으로 처리합니다. `notes`는 8,000자에서 잘리며, 숨겨진 컨텍스트로 플래너에 전달되고 대화 기록과 함께 장면 작성자에게도 전달됩니다.
- `claim`은 장면 채팅이 만들어진 뒤에 실행됩니다. `false`를 반환하면 409로, 예외를 던지면 503으로 장면 채팅을 버립니다. `getContext`, `claim`, `release`에는 각각 8초가 주어집니다. 늦은 `getContext`나 `claim`은 실패로 처리하고(503, 장면 채팅 제거), 늦은 `release`는 기록한 뒤 버립니다.
- `release`는 `concluded`(`summary`, `description`, `scenario`, `rating`, 출연진 포함), `abandoned`, `deleted`, `converted` 중 하나를 받습니다. 멱등이어야 하며 잠금을 가지고 있지 않은 장면은 무시해야 합니다. 예외를 던지거나 패키지가 비활성 상태일 때 도착한 release는 기록한 뒤 버립니다. 어느 쪽이든 장면 채팅은 끝난 상태로 남으므로, 오래된 잠금은 `chat-read`로 장면 채팅을 읽어 맞추세요. 그 메타데이터에는 `sceneStatus`가 있고, 결말이 난 장면에는 `sceneSummary`도 있습니다.
- Engine은 패키지 출발점에 대해 Conversation에 아무것도 쓰지 않습니다. 캐릭터 기억은 결말이 날 때 Conversation 장면과 똑같이 저장됩니다.

`capabilityApi`를 1.66보다 오래된 버전으로 선언한 매니페스트에서는 `scenes`를 거부합니다.

<a id="capability-api-1376-home-browser-fullscreen"></a>

### Capability API 1.376: Home 브라우저 전체 화면

`home-browser-tab` 뷰는 `capabilityProps.browserFullscreen`을 받습니다.

- `active`: 현재 이 패키지가 Home 브라우저 콘텐츠 영역 전체를 채우는지 여부입니다.
- `setActive(boolean)`: 이 활성 패키지의 전체 화면을 켜거나 끕니다.
- `enterLabel`과 `exitLabel`: 토글에 사용할 현지화된 접근성 레이블입니다.

앱 내부 전체 화면입니다. Home의 탭, 주소 표시줄과 북마크는 숨겨지지만 Engine 상단 바는 계속 사용할 수 있습니다. 브라우저 Fullscreen API를 호출하지 않으며 브라우저의 전체 화면 지원도 필요하지 않습니다. 상태는 일시적이며 패키지나 Home을 벗어나면 초기화됩니다. 패키지의 모든 화면에 나가기 버튼을 제공하고 `aria-pressed`로 `active`를 나타내세요. 속성 업데이트 시 작성 중인 양식을 교체하지 않고 버튼만 업데이트해야 합니다. 이 컨트롤에 의존하는 패키지는 Capability API 1.376 이상을 선언하며, 이전 패키지는 기존 레이아웃을 유지할 수 있습니다.

<a id="capability-api-150-professor-mari-actions"></a>

### Capability API 1.50: Professor Mari 동작

새 `mari-actions` 권한을 가진 패키지는 이름 있는 동작을 Professor Mari에게 제공할 수 있습니다. 자체 ID 아래 서비스 하나를 등록하면 Mari의 `package_service` 도구가 동작을 나열하고 사용자 요청에 따라 실행합니다.

```ts
export async function activate({ api }) {
  api.registerService("mari-actions:my-package", {
    list: () => [
      {
        name: "add-idea",
        summary: "Give a Creator an idea for a post.",
        inputs: { accountId: "The Creator.", text: "The idea." },
      },
    ],
    run: async (name, input, { signal }) => {
      const parsed = schemas[name]?.safeParse(input);
      if (!parsed?.success) return { ok: false, status: 400, error: "Invalid input." };
      return { ok: true, value: await doIt(name, parsed.data, signal) };
    },
  });
}
```

주요 규칙:

- 키는 등록 패키지의 `mari-actions:<package-id>`여야 합니다. 권한이 없거나 다른 패키지 ID로 등록하면 예외가 발생하므로 Mari가 실행하는 동작은 항상 명시된 패키지 소유입니다.
- `list()`는 `{ name, summary?, inputs? }` 항목을 반환합니다. 이름은 문자, 숫자, `.`, `_`, `-`로 된 1~80자이며 다른 항목은 표시하지 않습니다. Mari가 읽는 `summary`와 `inputs`는 쉬운 말로 작성하세요. 처음 50개 동작만 보거나 실행할 수 있습니다. Mari는 동작당 입력을 최대 40개 보고 입력 이름은 80자, 각 텍스트는 300자로 자릅니다. `list()`가 5초 내 응답하지 않으면 패키지 동작을 생략합니다.
- `run(name, input, { signal })`은 목록에 있는 이름과 최대 64,000자의 일반 JSON 객체로만 호출됩니다. 모델에서 온 입력이므로 작업 전에 자체 스키마로 검증하세요. `{ ok: true, value }` 또는 `{ ok: false, status?, error }`를 반환하며 Mari는 오류 텍스트 앞 2,000자를 봅니다. 사용자가 Mari를 중지하거나 5분이 지나면 `signal`이 취소됩니다. Engine도 기다리지 않으므로 작업을 중지하세요.
- Engine은 Mari가 읽기 전에 `value`의 데이터 URL을 생략하고 긴 응답을 자릅니다. 파일 대신 ID와 짧은 텍스트를 반환하세요.
- 목록 조회는 읽기 전용입니다. 모든 실행은 Mari Permissions Mode에서 변경으로 셉니다. Plan은 거부하고 Manual은 사용자의 Accept를 기다립니다. Engine은 패키지 동작을 미리 보거나 되돌릴 수 없어 Keep/Restore 카드를 표시하지 않습니다. 되돌리기 어려운 변경에는 자체 취소 동작을 제공하세요. 이 때문에 Plan은 읽기만 하는 동작도 거부합니다.
- 패키지를 비활성화하거나 제거하면 동작도 제거됩니다.

매니페스트의 `capabilityApi`가 1.50보다 오래되면 `mari-actions`를 거부합니다.

### Capability API 1.36: 패키지 업적

새로운 `achievements` 권한이 있는 패키지는 홈의 **Achievements**(업적) 패널에 배지를 추가하고, 열렸는지 확인하고, 직접 열 수 있습니다. 패널에서는 Engine 자체 배지 뒤에 패키지 이름을 제목으로 한 섹션에 표시합니다.

```ts
export async function activate({ api }) {
  api.registerAchievements([
    { id: "first_run", title: "First Run", description: "Ran the package once.", iconPath: "art/first-run.png" },
    {
      id: "ten_runs",
      title: "Regular",
      description: "Ran the package ten times.",
      target: 10,
      readProgress: () => runs,
    },
  ]);
  // Later, when the package decides a badge is earned:
  if (await api.runtime.achievements.unlock("first_run")) celebrate();
}
```

알아 두어야 할 규칙은 다음과 같습니다.

- ID에는 `<packageId>.<id>` 네임스페이스가 붙습니다. 기본 제공 ID에는 점이 없으므로 서로 충돌하지 않습니다. 호스트는 로컬 ID와 네임스페이스가 붙은 ID를 모두 받으며, 패키지가 직접 등록하지 않은 ID는 거부합니다.
- `unlock(id)`는 배지를 실제로 연 호출에만 `true`를 반환합니다. `isUnlocked(id)`와 `list()`는 상태를 읽으며, `list()`는 패키지 자체 배지를 진행 상황과 함께 반환합니다.
- 개수 집계는 패키지가 담당합니다. 등급제 배지는 `target`과 `readProgress` 콜백을 둘 다 설정하거나 둘 다 생략합니다. 개수가 목표에 도달하면 Engine이 자체 등급제 배지를 확인하는 같은 처리 과정에서 업적을 엽니다. 카운터는 영속성 호스트에 보관하세요. 콜백이 예외를 던지거나 **2초** 안에 완료되지 않으면 0으로 보고하고 로그에 기록합니다. 도구와 마찬가지로 이 제한은 비동기 대기에만 적용됩니다. 이벤트 루프를 막는 동기 작업은 중단할 수 없습니다.
- `iconPath`는 패키지 자산 루트 안의 경로이며 패키지 자산 라우트에서 제공합니다. 잠긴 카드에는 계속 자물쇠가 표시됩니다. 이미지를 불러오지 못하면 `icon`으로 대체합니다(기본값은 `trophy`).
- `title`과 `description`은 표시할 텍스트입니다. 언어 팩에서 `capabilityAchievements.<packageId>.<id>.title`과 `.description`으로 덮어쓸 수 있습니다.
- **패키지당 배지는 최대 32개**입니다. 일괄 등록에 잘못된 항목이 하나라도 있으면 아무것도 등록하지 않습니다.
- 패키지를 비활성화하거나 제거하면 배지가 숨겨집니다. Engine 자체 배지처럼 업적을 연 기록은 유지되며, 패키지가 돌아오면 다시 표시됩니다.

`api.registerAchievements`와 `api.runtime.achievements`는 이 API를 지원하는 새로운 Engine에만 있으므로, 이를 사용하는 패키지는 `capabilityApi` 1.36을 선언합니다.

<a id="capability-api-135-agent-home-widgets"></a>

### Capability API 1.35: 에이전트 Home 위젯

에이전트 패키지는 Home 위젯 그리드에 최대 세 카드를 제공할 수 있습니다. Engine이 직접 배치하지는 않습니다. 사용자가 **Widget Manager**(위젯 관리자)에서 추가, 숨기기, 복원, 재정렬하며 에이전트 아래에 묶여 표시됩니다. Engine은 그리드, 프레임, 레이아웃을 담당하고 패키지는 카드 내부를 담당합니다.

`home-widget` 슬롯과 위젯 정의를 함께 선언하세요.

```json
{
  "schemaVersion": 2,
  "capabilityApi": { "major": 1, "minor": 35 },
  "kind": ["agent"],
  "permissions": ["ui"],
  "entrypoints": { "client": "client.js" },
  "contributions": {
    "slots": ["home-widget"],
    "homeWidgets": [
      {
        "id": "latest",
        "label": "Latest Posts",
        "description": "The newest posts from the feed.",
        "size": "large",
        "iconPath": "art/widget.png",
        "accent": "violet",
        "surface": "solid",
        "header": "banner"
      }
    ]
  }
}
```

- `id`는 소문자 kebab-case이며 최대 64자, 패키지 안에서 고유해야 합니다.
- `label`(1~80자)과 `description`(최대 200자)은 Widget Manager 텍스트입니다. 언어 팩은 `localizations.<locale>.homeWidgets.<id>.label`과 `.description`으로 바꿀 수 있습니다.
- `size`는 `compact` 또는 `large`입니다. 큰 위젯은 그리드 공간을 더 차지합니다.
- `icon`은 Engine 아이콘 이름(`activity`, `bell`, `calendar`, `chart`, `circle`, `clock`, `file`, `flame`, `heart`, `image`, `list`, `message`, `sparkles`, `star`, `zap`)입니다. `iconPath`는 패키지 이미지(`gif`, `jpg`, `jpeg`, `png`, `webp`)이며 `files[]`에 등록해야 합니다.
- `accent`, `surface`, `header`는 Engine 표시 프리셋을 선택합니다.

패키지가 `ui` 권한과 클라이언트 진입점이 있는 `agent`가 아니거나, 슬롯과 `homeWidgets`를 함께 선언하지 않았거나, 두 위젯 ID가 같거나, `capabilityApi`가 1.35보다 오래되면 설치를 거부합니다.

Engine은 패키지 클라이언트 요소를 `view="widget"`으로 마운트합니다. 일반적인 `packageId`, `packageVersion`, `localization` 외에 `capabilityProps`에는 다음이 있습니다.

- `widgetId`, `widgetLabel`, `widgetDescription`, `widgetIcon`, `widgetIconPath`, `widgetAccent`, `widgetSurface`, `widgetHeader`: 그릴 카드 정의입니다. 한 번들로 선언된 모든 위젯을 그릴 수 있습니다.
- `active`: Home이 표시되고 카드가 보일 때만 `true`입니다. `false`이면 폴링과 애니메이션을 멈추세요.
- `onOpenNoodle()`: 패키지 자체 Home 브라우저 탭을 엽니다. 이름과 달리 `home-browser-tab` 슬롯을 선언한 모든 패키지에서 작동합니다. 탭이 없으면 이 함수와 `onOpenPost`는 아무것도 하지 않습니다.
- `onOpenPost(id)`: 자체 Home 탭의 항목을 엽니다. `id`는 최대 128자의 문자열이며 다른 값은 무시합니다. 탭의 `view="browser"` 요소가 `focusPostId: id`를 받습니다. 항목을 표시한 뒤 `onFocusPostHandled()`를 호출해 포커스가 반복되지 않게 하세요. 다른 탭으로 전환하면 대기 중인 포커스를 버립니다.

위젯은 에이전트의 작은 화면이지 두 번째 사본이 아닙니다. 가볍게 유지하고 큰 작업은 브라우저 탭으로 안내하세요.

### Capability API 1.34: 규칙 집합 자체 형식으로 작성한 생물

도감 생물은 규칙 집합 자체 형식의 캐릭터 시트인 `sheet`를 가질 수 있으며 필요한 부분만 채워도 됩니다. 전투는 동료와 똑같이 구성하므로 체력, 방어, 내성, 우선권, 속도, 목록의 능력은 규칙 집합 선언에서 가져오고 자체 풀로 지불합니다. 이 경우 시트 옆에 `health`, `defense`, `initiativeModifier`, `speed`, `abilities`, `saves`를 주지 않으며 자체 블록 행동은 생략할 수 있습니다.

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
- `speech.transcribe(audio, { filename, mimeType, signal })`는 녹음한 오디오를 사용자가 **Connections → Speech to Text**(연결 → 음성 인식)에서 설정한 음성 인식 서버로 보내고, 변환된 텍스트를 반환합니다. 그 서버가 꺼져 있으면 `null`을 반환하므로 패키지는 자체 음성 변환을 그대로 사용합니다. 호스트의 URL 정책(`STT_LOCAL_URLS_ENABLED`)과 크기, 시간 제한을 적용하며 저장된 키는 절대 노출하지 않습니다. `speech`는 선택적이며 더 새로운 Capability API를 요구하지 않습니다. `typeof api.runtime.integrations?.speech?.transcribe === "function"`을 확인하고, 오래된 Engine에서는 대체 경로를 사용하세요.

공유 요청·결과 타입은 `@marinara-engine/shared`에서 내보냅니다. 패키지별 프롬프트 구성과 작업 조정은 패키지에 두고, 제공자 입출력은 Engine 서비스 구현을 복사하지 말고 이 호스트 진입점을 호출하세요. 순수 헬퍼와 타입은 여전히 번들에 포함할 수 있습니다.

### Capability API 1.341: 호스트 런타임 서비스와 공유 서버 라이브러리

패키지 서버가 Engine 서비스의 사본을 번들에 넣으면, 그 서비스의 두 번째 인스턴스가 실행되며 자체 상태를 갖습니다. Intiface 연결, 연결 요청 수용, 채팅 메타데이터 큐, 서비스 레지스트리가 각각 별개가 됩니다. Capability API 1.341은 대신 Engine에서 실행 중인 인스턴스에 접근하는 `api.runtime` 멤버를 추가하고, 패키지 서버가 일부 라이브러리를 번들에 넣지 않고 Engine에서 가져다 쓸 수 있게 합니다. 새 멤버는 모두 `CapabilityRuntimeHost`에서 선택적이므로 사용하기 전에 존재하는지 확인하세요.

- `runtime.services.get(key)`는 패키지가 `api.registerService`로 등록한 서비스를 반환하고, 서비스가 없거나 공유방에서 생성하는 동안에는 `null`을 반환합니다. Engine 자체 레지스트리를 읽으므로 모든 패키지에서 같은 서비스를 봅니다. `agent-runtime:`과 `mari-actions:` 키는 항상 `null`을 반환합니다. 이 키는 Engine만 읽습니다.
- `runtime.commands.parse(content)`, `strip(content)`, `instructions()`는 Engine의 문법과 모든 패키지가 등록한 태그로 Conversation 명령을 읽습니다.
- `runtime.logger.isLevelEnabled(level)`은 Engine 로거가 현재 그 수준의 로그를 기록하는지 알려 줍니다.
- `runtime.persistence.patchChatMetadata(chatId, patch, { touchUpdatedAt })`는 Engine의 큐를 거치는 메타데이터 패치입니다. 채팅마다 큐가 하나씩 있으며 Engine 자체 쓰기 작업과 공유하고, 공유방 가드와 쓰기 순번을 사용합니다. 패치에 포함된 키는 해당 키를 바꾸고 다른 키는 모두 유지합니다. `patch`는 현재 메타데이터를 인자로 받는 함수일 수도 있습니다. 같은 채팅의 `withChatLock` 안에서는 그 잠금 안에서 실행됩니다. `updateChatMetadata`처럼, 더는 존재하지 않는 Global Gallery 이미지에 대한 새 참조를 거부합니다.
- `runtime.persistence.appendMessages(chatId, messages)`는 각 메시지를 첫 스와이프와 함께 한 번에 추가하고 반환합니다. `createChatNote`와 `createChatInfluence`는 Conversation에서 연결된 Roleplay에 노트나 일회성 영향을 추가합니다. 이 네 영속화 멤버에는 `chat-write`가 필요합니다.
- `runtime.persistence.updateCharacterStatus(chatId, characterId, { status, activity, duration })`는 Conversation
  답변 뒤에 Engine이 처리하는 방식으로 `[schedule_update]`를 적용합니다. 캐릭터 카드에 임시 상태를 설정해
  만료될 때까지 모든 채팅에서 그 캐릭터에 표시합니다. `status`는 `online`, `idle`, `dnd`, `offline` 중
  하나이고, `activity`는 최대 500자이며, 둘 중 하나 이상이 필요합니다. `duration`은 명령에서 쓰는 형식
  (`2h`, `30m`)으로 지정합니다. 생략하거나 읽을 수 없으면 상태가 60분 동안 유지되며, 최대 일주일을 넘지 않습니다.
  `{ status, activity, expiresAt }`를 반환하고, 아무것도 바뀌지 않으면 `null`을 반환합니다. 사용자가 직접
  설정한 상태가 우선하며, 공유 방은 자체 루틴을 유지합니다. 유효하지 않은 업데이트, Conversation이 아닌 채팅,
  채팅에 없는 캐릭터의 업데이트를 거부하며 `chat-write`가 필요합니다. 이 멤버는 1.341을 지원한다고 보고하는
  초기 Engine이 나온 뒤 Capability API 1.341에 추가되었으므로,
  `typeof api.runtime.persistence.updateCharacterStatus === "function"`인지 확인하고 없으면 상태 변경을 건너뛰세요.
- `runtime.integrations.admission`은 Engine의 연결 요청 수용을 사용하므로, 패키지의 백그라운드 작업은 같은 연결에서 사용자가 직접 보낸 요청이 끝나기를 기다립니다. `withProvider(provider, connectionId, mode)`는 같은 패키지의 통합 기능이 만든 제공자를 감쌉니다. `run(connectionId, mode, operation)`은 한 번의 시도를 실행하고, `tryBackground(connectionId)`는 연결이 유휴 상태일 때 백그라운드 슬롯을 차지하며, `isFailure(error)`는 Engine의 사용 중 오류와 거부 오류를 식별합니다. 슬롯을 예약하기만 하므로 권한은 필요 없습니다.
- `runtime.integrations.haptics`(`status`, `connect`, `executeCommand`)는 Engine의 단일 Intiface Central 연결을 사용합니다. `network`가 필요합니다.
- `runtime.integrations.spotify`(`commandsAvailable`, `playSong`)는 Music DJ 에이전트의 Spotify 계정을 사용합니다. `playSong`은 `ConversationSpotifyCommandError`로 거부합니다. 코드 `spotify_unavailable`과 `missing_playback_scope`는 Spotify가 설정되지 않았다는 뜻이므로, 알림 없이 명령을 버리세요. `network`가 필요합니다.
- `runtime.integrations.speech.transcribeLocal(wav)`는 **Connections**(연결)에서 다운로드한 Local Whisper 모델로 PCM WAV 녹음을 텍스트로 변환하고, 모델을 다운로드하지 않았으면 Engine의 메시지로 거부합니다. `network`가 필요합니다.
- `runtime.integrations.images.addToChatGallery(input)`은 `images.save`로 저장한 이미지를 채팅의 갤러리 목록에 추가합니다. `images.persistToEntityGalleries(input)`은 Engine이 생성한 이미지처럼 이미지에 등장하는 캐릭터와 페르소나의 갤러리 목록에 추가합니다. 둘 다 `storage`가 필요합니다.

**번들 사본은 사용하지 않습니다.** 이 멤버 중 하나가 없으면 패키지는 그 기능에 더 새로운 Marinara Engine이 필요하다고 알립니다. 제공자 레지스트리, 로컬 사이드카, 연결 요청 수용, 햅틱, Spotify, 로거, 레지스트리, 저장 큐처럼 상태를 가진 Engine 서비스의 번들 사본으로 대체하지 않습니다. 두 번째 사본은 Engine이 한곳에서 관리하는 상태를 나누기 때문입니다. 순수 헬퍼와 타입은 여전히 번들에 포함할 수 있습니다.

**공유 서버 라이브러리.** 패키지 서버는 `zod`, `adm-zip`, `dotenv`, `nanoid`, `jsonrepair`를 번들에서 빼고 이름으로 가져올 수 있습니다. 기존에 가능한 `@huggingface/transformers`, `onnxruntime-node`, `onnxruntime-web`, `sharp`, `pino`, `pino-pretty`, `undici`와 같습니다. Node는 패키지의 런타임 사본에서 `<runtime copy>/node_modules`, `DATA_DIR/capability-packages/node_modules`, Engine의 `packages/server/node_modules`로 이어지는 두 링크를 통해 모듈을 찾으므로, 패키지는 Engine과 정확히 같은 모듈 인스턴스를 사용합니다. pnpm은 서버의 직접 의존성만 그곳에 두므로 그 이름만 찾을 수 있습니다. `ws` 같은 의존성의 의존성은 찾지 못합니다. Engine은 위 이름들을 `packages/server`의 직접 프로덕션 의존성으로 유지하며, 모든 설치가 이 구조를 유지합니다. 소스 및 런처 설치, Windows(데이터 링크는 정션), Android와 Termux, 두 Docker 이미지가 모두 해당합니다. 시작하거나 패키지를 활성화할 때 Engine은 다른 위치를 가리키는 데이터 링크를 다시 만듭니다. 다른 설치 경로에서 데이터 폴더를 옮겨 대상이 사라진 링크도 포함됩니다. 링크가 아닌 항목은 그대로 둡니다.

**선언.** 이 기능 중 하나라도 사용하는 패키지는 `schemaVersion: 2`, `capabilityApi: { major: 1, minor: 341 }`, `builtAgainst`를 선언하고 `engine` 범위를 유지합니다. `schemaVersion: 1` 매니페스트는 Capability API를 기준으로 검사하지 않으므로 버전 2로 옮깁니다. 기준은 Engine 버전이 아니라 Capability API입니다. 이 멤버가 없는 Engine은 설치나 업데이트를 거부하고("Package requires capability API 1.341; this Engine supports ..."), 그 패키지를 업데이트 목록에서 빼며 설치된 버전을 계속 실행합니다.
