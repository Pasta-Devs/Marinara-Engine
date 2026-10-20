# 아키텍처 지도(개발자용)

이 가이드는 기여자를 위한 개발 문서입니다. Marinara Engine의 코드 구성을 설명합니다. 공통 기반, 기능 시스템, 모드별 담당 범위, 그리고 각 코드가 있어야 할 자리를 다룹니다. 현재 덩치가 큰 파일과 앞으로의 리팩터링 방향도 정리했습니다.

범위는 `packages/client/src`, `packages/server/src`, `packages/shared/src`입니다. 이 저장소에는 일반적인 `.test.ts` 테스트 묶음이 없습니다. 자동 검증은 추적 대상인 회귀 스크립트와 Playwright 스모크 커버리지가 담당합니다. 임시로 만드는 `.test.ts` 검증 파일은 gitignore 대상이며 사용 후 삭제합니다.

파일 수, 줄 수, 라우트 수는 저장소가 바뀌면서 함께 달라집니다. 이 지도는 대략적인 형태와 이름만 알려 줍니다. 정확한 숫자는 항상 현재 트리에서 확인하세요.

## 섹션 코드

코드 이동을 계획할 때, 이슈에 라벨을 붙일 때, 아직 옮길 수 없는 코드에 짧은 파일 헤더를 달 때 아래 코드를 사용하세요.

| 코드 | 의미 | 기본 위치 |
| --- | --- | --- |
| `CORE-CONTRACT` | 클라이언트와 서버가 함께 쓰는 타입, 스키마, 상수, 순수 헬퍼 | `packages/shared/src` |
| `CLIENT-APP` | React 앱 부트스트랩, 레이아웃 셸, 전역 UI 연결 | `packages/client/src/App.tsx`, `main.tsx`, `components/layout` |
| `CLIENT-SHARED` | 클라이언트 전용 UI 기본 요소, 공통 훅, 공통 브라우저 헬퍼, 전역 스토어 | `packages/client/src/components/ui`, `hooks`, `lib`, `stores` |
| `SERVER-APP` | Fastify 앱 부트스트랩, 미들웨어, 라우트 등록, 런타임 설정 | `packages/server/src/app.ts`, `index.ts`, `middleware`, `config` |
| `SERVER-SHARED` | 서버 전용 저장소, DB, LLM, 프롬프트, 로어북, 가져오기, 연동 기반 | `packages/server/src/services`, `db`, `utils`, `lib` |
| `MODE-CONVERSATION` | Conversation(대화) 전용 UI와 서버 동작 | conversation 컴포넌트, `/api/conversation`, conversation 서비스 |
| `MODE-ROLEPLAY` | Roleplay(롤플레이) UI, 장면, 스프라이트, 인카운터 헬퍼 | roleplay 채팅 컴포넌트, `/api/scene`, `/api/encounter`, `/api/sprites` |
| `MODE-GAME` | Game Mode(게임 모드) UI, GM 프롬프트, 주사위, 파티, 지도, 전투, 에셋, 세션 | `components/game`, `/api/game`, game 서비스 |
| `FEATURE-AGENTS` | 에이전트 정의, 실행, 디버그 상태, 지식 라우팅 | 에이전트 컴포넌트, 에이전트 스토어, 에이전트 라우트/서비스 |
| `FEATURE-ASSETS` | 배경, 아바타, 갤러리, 생성된 이미지, 스프라이트, 게임 에셋 | 에셋 라우트, 갤러리 저장소, 이미지 서비스 |
| `FEATURE-SIDECAR` | 로컬 모델 런타임, 장면 분석, 다운로드, 프로세스 제어 | 사이드카 스토어, `/api/sidecar`, 사이드카 서비스 |
| `FEATURE-TTS` | TTS 설정, 음성 라우팅, 캐시 키, 오디오 재생 | TTS 설정/훅/라우트/서비스 |
| `FEATURE-IMPORT` | SillyTavern 및 Marinara 가져오기 도구와 마이그레이션 헬퍼 | 가져오기 라우트/서비스 |
| `TEST` | 추적 대상 회귀 및 브라우저 스모크 커버리지, 필요할 때 만드는 임시 검증 테스트 | `scripts/regressions`, `e2e`, 그리고 사용 후 삭제하는 임시 `packages/server/src/**/__tests__/` 파일 |

가능하면 경로 자체가 섹션을 드러내게 하세요. `// Section: MODE-GAME` 같은 주석은 파일이 아직 여러 성격이 섞인 폴더에 남아 있을 때만 쓸모가 있습니다.

## 패키지 경계

### packages/shared

`CORE-CONTRACT`입니다. 이 패키지는 특정 런타임에 의존하지 않아야 합니다.

현재 들어 있는 것:

- `types`: 채팅, 캐릭터, 게임, 세계 상태, 전투, 장면, 사이드카, TTS, 에이전트, 프롬프트, 로어북, 내보내기, 테마.
- `schemas`: 저장되거나 공유되는 엔티티의 Zod 스키마.
- `constants`: 제공자, 기본값, 채팅 모드, 모델 목록, 에이전트 프롬프트.
- `utils`: 매크로 확장, XML 래핑, 음악 점수 계산 같은 순수 헬퍼.
- `features`: 에이전트 매니페스트와 레지스트리, 함수 호출 정의, 폴더 패키지, UNO, Chess, Poker의 턴제 게임 엔진, Game Mode 규칙 집합과 그 전투(`rulesets`, `ruleset-combat`, `tactical-combat`, `combat-*` 파일), 그리고 `world`에 있는 월드 생성기와 그 공유 파일(세계관 키트, 세계, 타일 팩, 보드 팩, 크리처 팩).

규칙:

- React, DOM, Fastify, 서버 저장소, 파일 시스템, 네트워크, 제공자 SDK 코드는 넣지 않습니다.
- 클라이언트와 서버가 같은 계약이나 같은 순수 알고리즘을 써야 할 때만 이곳으로 옮깁니다.
- `shared`를 클라이언트 전용 헬퍼까지 쌓아 두는 잡동사니 창고로 만들지 마세요.

### packages/client

React 19와 Vite PWA를 씁니다. 현재 소스 파일이 수백 개 있습니다.

현재 최상위 구성:

- `App.tsx`, `main.tsx`: 앱 부트스트랩, React Query, PWA, 전역 이펙트.
- `components/layout`: 앱 셸, 사이드바, 상단 바, 창 렌더러.
- `components/ui`: 재사용 가능한 UI 기본 요소.
- `components/chat`: 공통 채팅, conversation, roleplay, 장면, 스프라이트, 인카운터 UI가 섞여 있습니다.
- `components/game`: Game Mode 화면과 패널.
- `components/panels`, `components/modals`, 엔티티 편집기: 설정과 리소스 관리.
- `features`: 따로 떼어낸 기능 모듈입니다. 현재는 채팅 설정 섹션, 트래커 패널 조각, 멀티플레이어, 그리고 아바타 에이전트의 계약, 설정, 스테이지, 렌더러(`features/avatars`)가 들어 있습니다.
- `hooks`: 대부분의 API 기능을 위한 React Query 훅과 런타임 훅.
- `lib`: 브라우저 및 클라이언트 헬퍼. 현재는 공통 헬퍼와 게임 전용 헬퍼가 섞여 있습니다.
- `stores`: UI, 채팅 런타임, 에이전트, 세계 상태, Game Mode, 에셋, 사이드카, 번역, 갤러리, 인카운터, 턴제 게임을 위한 Zustand 스토어.
- `styles`: 전역 스타일시트와 테마별 CSS.

지금 경계를 넘나드는 지점:

- `components/game`이 날씨나 갤러리 드로어처럼 함께 쓰는 시각 요소를 `components/chat`에서 가져다 씁니다.
- `components/chat`이 roleplay 기능을 위해 세계 상태와 인카운터 상태를 가져다 씁니다.
- `hooks/use-generate.ts`가 채팅 상태, 에이전트 상태, 세계 상태, Game Mode 상태, 번역 상태, UI 설정까지 건드립니다.
- `lib/game-*` 헬퍼는 게임 전용인데 전역 헬퍼 옆에 놓여 있습니다.

### packages/server

Fastify API, 파일 네이티브 저장소, 제공자 연동을 담당합니다. 현재 소스 파일이 수백 개 있습니다.

현재 최상위 구성:

- `app.ts`, `index.ts`: 앱 팩토리, 부트스트랩, 정적 파일 서빙, 파일 저장소 하이드레이션, 시더.
- `routes`: 라우트 파일이 많습니다. 대부분은 얇은 CRUD API지만 `generate.routes.ts`와 `game.routes.ts`는 덩치 큰 오케스트레이션 파일입니다. `routes/generate/` 폴더에는 지금까지 생성 경로에서 떼어낸 조각들이 들어 있습니다. 토큰 출력 체인(`generation-stream-output.ts`), 도구 호출 라운드(`tool-rounds.ts`), 답변 명령 파싱과 텍스트 정리, 답변 저장(`save-generated-reply.ts`)이 여기에 포함됩니다.
- `services/storage`: 채팅, 캐릭터, 프롬프트, 로어북, 설정, 에셋, 테마, 세계 상태를 위한 저장소 파사드 계층.
- `services/llm`: 제공자 레지스트리, 기본 제공자 계약, OpenAI 호환 제공자, 로컬 사이드카 브리지.
- `services/prompt`: 게임 외 생성에 쓰는 공통 프롬프트 조립.
- `services/conversation`: 스케줄, 자율 메시지, 인식, conversation 프로필, conversation 명령 처리.
- `services/game`: GM 프롬프트, 주사위, 전투, 상태 머신, 파티 프롬프트, 지도, 날씨, 시간, 세션, 체크포인트, 평판, 에셋.
- `services/sidecar`: 로컬 런타임, 모델 관리, 장면 분석, 장면 후처리.
- `services/agents`: 에이전트 실행과 지식 라우팅.
- 기능 기반: `services/import`, `services/lorebook`, `services/image`, `services/haptic`, `services/tools`, `services/regex`, `services/professor-mari`, `services/mari-db`, `services/turn-games`, `services/spotify`, `services/video`, `services/generation`, `services/chat-summary`, `services/achievements`, `services/prompt-overrides`, `services/setup`, `services/noodle`, `services/memory-recall`, `services/avatars`(아바타 에이전트용 아바타 모델 저장, 생성, 감정 분류기), `speech-to-text.service.ts`, `discord-webhook.ts`.
- `db/schema`: `DATA_DIR/storage` 아래에 저장되는 데이터의 파일 테이블 정의.
- `db/file-schema.ts`, `db/file-query.ts`: 네이티브 테이블 메타데이터와 쿼리 표현식.
- `db/file-backed-store.ts`: 인메모리 테이블 스토어, 트랜잭션 경계, 크래시 복구, JSON 스냅샷 영속화. [파일 네이티브 저장소](file-storage.md) 문서를 참고하세요.

지금 경계를 넘나드는 지점:

- 라우트가 저장소, LLM, 프롬프트, 로어북, 게임, 사이드카, 기능 서비스를 직접 가져다 씁니다.
- `generate.routes.ts`는 conversation과 roleplay의 주 생성 경로를 처리하면서 에이전트 파이프라인까지 맡습니다.
- `game.routes.ts`는 게임 오케스트레이션을 담당하는 동시에 LLM, 사이드카, 로어북, 이미지, 저장소, Discord 웹훅 동작까지 손을 뻗습니다.
- 장면 분석은 사이드카 서비스에 있지만, Game Mode는 사이드카로도 돌릴 수 있고 선택한 LLM 연결로도 돌릴 수 있습니다.

## 모드별 담당 범위

### 모든 모드가 함께 쓰는 부분

전역 기반에 해당합니다:

- 채팅과 메시지 영속화: `packages/server/src/routes/chats.routes.ts`, `packages/server/src/services/storage/chats.storage.ts`, 공통 채팅 타입과 스키마.
- 캐릭터와 페르소나: 캐릭터 라우트, 저장소, 스키마, 그리고 클라이언트의 캐릭터 훅과 편집기.
- 연결과 제공자: 연결 라우트, 저장소, 공통 제공자 상수, `services/llm`.
- 프롬프트 프리셋, 로어북, 정규식, 사용자 지정 도구: 공통 저작 기반과 프롬프트 주입 기반.
- 생성 전송: `packages/client/src/hooks/use-generate.ts`, `packages/server/src/routes/generate.routes.ts`, 제공자 레지스트리.
- TTS, 번역, 갤러리, 테마, 설정, 가져오기, 백업.

### Conversation 모드

주요 코드:

- 클라이언트: `components/chat/ChatConversationSurface.tsx`, `ConversationView.tsx`, `ConversationMessage.tsx`, `ConversationInput.tsx`, 그리고 `ChatArea.tsx`의 conversation 빠른 시작 연결부.
- 클라이언트 훅: `use-autonomous-messaging.ts`, `use-background-autonomous.ts`.
- 서버: `/api/conversation`, `services/conversation/*`.
- 공통 메타데이터: `conversationSchedulesEnabled`, `characterSchedules`, `scheduleWeekStart`, 그리고 일간 및 주간 요약.

기대하는 경계:

- Conversation은 스케줄, 자율 안부 메시지, conversation 활동, roleplay가 아닌 메시지 표시를 담당해야 합니다.
- Conversation은 게임 주사위, GM 태그, 퀵타임 이벤트, 게임 지도, 게임 전투를 알 필요가 없습니다.

### Roleplay 모드

주요 코드:

- 클라이언트: `components/chat/ChatRoleplaySurface.tsx`, `ChatMessage.tsx`, `ChatInput.tsx`, `RoleplayHUD` 컴포넌트들, `SpriteOverlay.tsx`, `SceneBanner.tsx`, `CyoaChoices.tsx`, `EncounterModal.tsx`.
- 서버: `/api/scene`, `/api/encounter`, `/api/sprites`, 그리고 `/api/generate`의 일부.
- 공통 계약: `scene`, roleplay 관련 채팅 메타데이터 필드, 스프라이트 배치 타입.

기대하는 경계:

- Roleplay는 장면, 스프라이트 표시, CYOA 선택지, roleplay HUD, roleplay 인카운터 보조 흐름을 담당해야 합니다.
- Game Mode도 함께 쓰는 시각 효과는 `components/chat` 밖으로 옮겨야 합니다.

### Game Mode

주요 코드:

- 클라이언트: `components/game/*`, `hooks/use-game.ts`, `hooks/use-scene-analysis.ts`, `stores/game-mode.store.ts`, `stores/game-state.store.ts`, `stores/game-asset.store.ts`, `lib/game-*`, `lib/party-dialogue-parser.ts`.
- 서버: `/api/game`, `/api/game-assets`, `services/game/*`, 그리고 `services/sidecar/scene-analyzer.ts`와 `scene-postprocess.ts`의 게임 관련 부분.
- 공통 계약: `types/game.ts`, `types/game-state.ts`, `types/combat-encounter.ts`, 그리고 `ChatMetadata`의 게임 필드.

기대하는 경계:

- Game은 GM 프롬프트, 파티 프롬프트, 주사위, 스킬 판정, 퀵타임 이벤트, 게임 전투, 지도, 이동과 휴식, 날씨와 시간, NPC 평판, 게임 세션 요약, 생성된 게임 에셋, 게임 로그를 담당해야 합니다.
- Game은 공통 기본 요소나 명시적으로 공유하는 기능 컴포넌트를 통하지 않고 채팅 모드 UI에 의존하면 안 됩니다.

## 현재 덩치가 큰 파일

아래 파일들은 한곳에 여러 관심사가 섞여 있어서 앞으로의 작업을 가장 크게 늦출 만한 것들입니다. 줄 수는 자주 바뀌므로 정확한 크기 대신 대략적인 순서와 문제점을 적었습니다.

| 파일 | 섹션 | 문제점 |
| --- | --- | --- |
| `packages/server/src/routes/generate.routes.ts` | 공통 생성 및 에이전트 | 라우트, 스트리밍, 프롬프트, 에이전트, 저장소, 부수 효과가 한 파일에 있습니다. |
| `packages/server/src/routes/game.routes.ts` | `MODE-GAME` | API 핸들러, GM 흐름, 장면 분석, 에셋, 전투, 영속화가 얽혀 있습니다. |
| `packages/client/src/components/game/GameSurface.tsx` | `MODE-GAME` | 렌더링, 상태 조율, 에셋, 로그, 나레이션, 전투, 이펙트가 얽혀 있습니다. |
| `packages/client/src/components/chat/ChatSettingsDrawer.tsx` | 채팅 설정 혼재 | `features/chat-settings`로 섹션을 떼어내는 작업이 진행 중이지만 드로어는 아직 큽니다. |
| `packages/client/src/components/game/GameNarration.tsx` | `MODE-GAME` | 표시 렌더링과 명령 서식 처리가 단단히 붙어 있습니다. |
| `packages/client/src/components/game/GameCombatUI.tsx` | `MODE-GAME` | 전투 표시, 조작, 로그를 더 작은 패널과 훅으로 나눌 수 있습니다. |
| `packages/client/src/components/chat/RoleplayHUD.tsx` | `MODE-ROLEPLAY` | `RoleplayHUDActionsMenu.tsx`와 `RoleplayHUDPanels.tsx`로 일부는 이미 분리했습니다. |

## 목표 구조

앞으로의 리팩터링 방향입니다. 전부 한 번에 옮겨야 하는 것은 아닙니다.

### 클라이언트 목표

```text
packages/client/src/
  app/                         # App bootstrap, shell integration, providers
  shared/
    components/                # UI primitives and mode-agnostic widgets
    hooks/                     # cross-feature client hooks
    lib/                       # browser/runtime helpers
    stores/                    # global client stores only
  features/
    agents/
    assets/
    gallery/
    sidecar/
    tts/
    translation/
  modules/
    conversation/
      components/
      hooks/
      lib/
    roleplay/
      components/
      hooks/
      lib/
    game/
      components/
      hooks/
      lib/
      stores/
```

### 서버 목표

```text
packages/server/src/
  app/                         # Fastify setup, route registration, middleware
  shared/
    db/
    storage/
    llm/
    prompt/
    lorebook/
    utils/
  features/
    agents/
    assets/
    haptic/
    image/
    import/
    sidecar/
    tts/
  modules/
    chat/
    conversation/
    roleplay/
      scene/
      encounter/
      sprites/
    game/
      routes/
      services/
      prompts/
```

### 공통 패키지 목표

```text
packages/shared/src/
  contracts/
    chat/
    conversation/
    roleplay/
    game/
    providers/
  constants/
  utils/
```

예전의 평평한 `types`, `schemas`, `constants` 구성만으로는 더 이상 전체를 설명하지 못합니다. 지금은 `packages/shared/src/features/`가 에이전트, 함수 호출, 폴더 패키지, 턴제 게임, 규칙 집합과 전투, 월드 생성기를 담고 있습니다. 공통 패키지의 첫 정리는 파일을 대거 옮기는 대신 타입 수준에서 조금씩 진행하는 편이 좋습니다.

## 이동 규칙

1. 새 코드는 맞는 섹션 중 가장 좁은 곳에 둡니다.
2. 클라이언트 컴포넌트를 두 개 이상의 모드가 쓴다면, 모드 전용 동작을 더 넣기 전에 `CLIENT-SHARED`로 옮깁니다.
3. 타입, 스키마, 순수 헬퍼를 클라이언트와 서버가 모두 필요로 한다면 `CORE-CONTRACT`로 옮깁니다.
4. 서버만 필요로 한다면 `packages/shared`에 두지 않습니다.
5. 라우트 파일은 HTTP 입력을 검증하고 서비스를 호출하는 역할까지만 맡습니다. 도메인 판단은 서비스로 옮깁니다.
6. 스토어는 전역(`ui`, `chat`, `sidecar`)이거나 모드 전용(`game-mode`, `encounter`) 중 하나여야 합니다. 스토어 하나가 슬그머니 여러 모드를 떠맡지 않게 하세요.
7. 메타데이터는 `ChatMode`로 구분되게 만들어야 합니다. 기본 메타데이터에 conversation, roleplay, game 필드를 더하는 형태입니다.
8. 한 번에 기능 하나씩 옮깁니다. 넓게 쓰이는 임포트 경로가 저장소 전체를 흔들 상황이라면 호환용 export나 래퍼를 남겨 두세요.
9. 옮길 때마다 린트를 실행하세요.

   ```bash
   pnpm lint
   ```

   그다음 수정한 파일만 골라 Prettier 검사를 실행하세요.

## 먼저 손댈 리팩터링 후보

아래 작업은 동작을 바꾸지 않으면서 결합도를 낮추기 때문에 첫 정리 작업으로 좋습니다.

1. `components/chat`을 공통, conversation, roleplay 묶음으로 나눕니다.
   - 공통 후보: `ChatCommonOverlays`, `ChatBranchSelector`, `ChatGalleryDrawer`, `WeatherEffects`, 그리고 공통 메시지 및 입력 기본 요소.
   - Conversation 후보: `ChatConversationSurface`, `ConversationView`, `ConversationMessage`, `ConversationInput`.
   - Roleplay 후보: `ChatRoleplaySurface`, `SpriteOverlay`, `SceneBanner`, `CyoaChoices`, `EncounterModal`. roleplay HUD 분리는 `RoleplayHUDActionsMenu.tsx`와 `RoleplayHUDPanels.tsx`로 일부 진행했습니다.
2. 게임 전용 클라이언트 헬퍼를 게임 모듈 아래로 옮깁니다.
   - 후보: `game-audio`, `game-tag-parser`, `game-full-body-pose`, `game-character-name-match`, `game-segment-edits`, `party-dialogue-parser`.
3. `GameSurface.tsx`를 런타임 훅과 더 작은 컨테이너로 나눕니다.
   - 훅 후보: 나레이션 런타임, 에셋 런타임, 장면 분석 런타임, 전투 런타임, 로그 및 히스토리 런타임, 오디오 런타임.
4. `GameNarration.tsx`를 명령 파싱 및 서식 처리와 표시 컴포넌트로 나눕니다.
5. `game.routes.ts`를 핸들러 묶음별로 나눕니다.
   - 묶음 후보: 설정과 세션, 턴 생성, 주사위와 스킬 판정과 퀵타임 이벤트, 저널과 인벤토리, 지도와 이동과 날씨, 전투, 에셋과 장면 분석.
6. `generate.routes.ts`를 생성 전송, 에이전트 파이프라인 처리, 재시도 라우트, 명령 및 후처리 헬퍼로 나눕니다. 이슈 #7573에서 이 작업을 시작했습니다. 토큰 출력 체인, 도구 라운드, 답변 명령, 답변 텍스트 정리, 저장된 메시지의 생성 정보, 숨은 명령 앵커, 답변 저장이 이제 `routes/generate/`에 있으며 각각 자체 회귀 테스트가 있습니다.
7. `ChatMetadata`를 모드별 메타데이터 계약으로 나눕니다.
8. 게임 쪽이 채팅 내부를 더 많이 가져다 쓰기 전에, 공통으로 쓰는 roleplay 및 게임 시각 요소를 `components/chat` 밖으로 옮깁니다.

## 실전 시작 순서

다음 정리 PR에서는 이 순서를 따르세요.

1. 한 영역에 대해서만 목표 폴더를 만듭니다.
2. 순수 헬퍼를 먼저 옮깁니다.
3. 다음으로 말단 컴포넌트를 옮깁니다.
4. 임포트가 대부분 새 모듈을 가리키게 될 때까지, 덩치 큰 오케스트레이터는 제자리에 둡니다.
5. 호환용 재export는 임포트 변경이 실제 작업의 초점을 흐릴 때만 추가합니다.
6. 린트를 실행하세요.

   ```bash
   pnpm lint
   ```

   그다음 수정한 파일만 골라 Prettier 검사를 실행하세요.

## 관련 가이드

- [프런트엔드 아키텍처(개발자용)](frontend.md)
- [파일 네이티브 저장소](file-storage.md)
