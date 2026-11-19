# 코드 정리 감사

**감사일:** 2026-07-22

**대상 브랜치:** `staging`

**목적:** 런타임 동작을 바꾸지 않으면서 제거할 수 있는 잔재와 범위가 한정된 단순화 지점을 찾아냅니다.

**구현 현황:** 확신도가 높고 위험이 낮은 항목은 이번 정리 작업에서 함께 반영했습니다.

## 구현 결과

완료한 작업입니다.

- 도달할 수 없는 소스 모듈 4개, 쓸모없어진 사이드카 빌드 스크립트, 테스트가 0개인 러너, 이미 끝난 작업 지시서를 삭제했습니다.
- 도달할 수 없는 디버그 패널만 쓰던 디버그 로그 버퍼를 삭제했습니다. 브라우저 콘솔 진단 기능은 그대로 유지했습니다.
- 컴파일러가 증명한 미사용 코드 60건을 모두 처리하고, 클라이언트와 서버에서 미사용 검사를 활성화했습니다.
- 아무 데서도 쓰지 않는 클라이언트 훅, 헬퍼, 타입, UI 선언 53개를 도메인 단위로 묶어 삭제했습니다.
- 확신도가 높은 고아 의존성 8개를 제거하고, 락 파일과 워크스페이스 설치 검사, 문제 해결 문서 문구를 함께 고쳤습니다.
- 루트의 `pnpm test`가 테스트 0개로 성공을 보고하지 않고 실제 회귀 검증을 실행하도록 바꿨습니다.
- 이미 있던 스토리보드 키프레임 선택 로직을 재사용하고, 중복돼 있던 Spotify 검색어 토큰 처리를 하나로 합쳤습니다.
- 프리셋 변수 재정렬이 요청받은 프리셋에만 적용되도록 제한했습니다. 그동안 무시되던 `presetId`를 무결성 경계로 활용합니다.

호환성 작업이나 제품 작업으로 따로 다루기 위해 일부러 남겨 둔 항목입니다.

- `@rollup/wasm-node`
- 저장소 밖의 API이거나 테스트 이음새일 수 있는 서버 export
- PNG 파서와 튜토리얼 위치 계산 로직의 통합
- 범위가 넓은 편집기/입력창 리팩터링과 대형 모듈 리팩터링
- 다음 메이저 릴리스로 예정된 호환성 필드

아래의 상세 조사 내용은 작업 전 근거 기록으로 남겨 둔 것입니다. 권고 문구가 그대로 남아 있는 부분이 있다면 이 구현 결과 쪽이 최신입니다.

## 검증

정리 작업은 저장소가 지원하는 검증 레인을 모두 통과했습니다.

- `pnpm install --frozen-lockfile`
- `pnpm check`(미사용 코드 검사, TypeScript, ESLint, 프로덕션 빌드)
- `pnpm test`(모든 회귀 레인 + 브라우저 스모크 검증: 81건 통과, 51건 의도적 건너뜀)

일반 테스트 명령을 정직하게 고치는 과정에서 브라우저 테스트가 상태에 의존하던 요소 탐색 4건도 드러났습니다. 해당 테스트는 이제 화면 이동을 명시적으로 수행하고, 모바일에서 중복되는 컨트롤의 범위를 좁히며, Noodle 타임라인 스크롤 영역을 정확히 지정합니다. 제품 동작을 확인하는 단언은 그대로입니다.

## 요약

저장소 규모는 큽니다. 추적 중인 파일이 1,665개이고, 조사 대상인 소스 계열 파일 형식을 합치면 약 478,000줄입니다. 다만 큰 파일 대부분은 눈에 띄는 찌꺼기가 아니라 실제로 동작하는 제품 코드입니다. 가장 안전한 정리 방법은 대대적인 재작성이 아니라, 근거가 분명한 작은 삭제를 모으는 것입니다.

최초 감사의 첫 번째 정리 대상은 다음과 같았습니다.

- 들어오는 참조가 하나도 없는 소스 모듈 4개(총 899줄)
- 쓸모없어진 사이드카 빌드 스크립트 1개(173줄)
- 테스트를 하나도 실행하지 않으면서 성공하는 테스트 러너 1개(54줄, 패키지 스크립트 연결 포함)
- 저장소 루트에 남아 있는 완료된 단계별 작업 지시서 2개(235줄)
- 컴파일러가 증명한 미사용 선언, import, 매개변수, 지역 변수 60건
- 고아일 가능성이 큰 직접 의존성 8개(새로 설치해 빌드하는 검사 필요)
- 브라우저 스모크 검사를 거친 뒤 삭제할 수 있는, 쓰이지 않는 것으로 보이는 정적 Mari 스프라이트 1개

도달할 수 없는 모듈 4개, 오래된 스크립트, 아무 일도 하지 않는 러너, 작업 지시서만 합쳐도 추적 중인 코드 1,361줄입니다. 그래도 작업은 작은 정리 PR로 나누는 편이 좋습니다. 그래야 삭제마다 근거가 좁고 되돌리기도 쉽습니다.

## 감사 방법

여러 종류의 근거를 조합했습니다.

1. 추적 중인 전체 파일, 파일 형식, 주요 소스 영역, 가장 큰 파일 목록화
2. 상대 경로 import와 저장소 별칭까지 포함한 TypeScript AST import/export 분석
3. 추적 중인 소스, 스크립트, 문서, 매니페스트, 워크플로 전체를 대상으로 한 정확한 심벌명과 파일명 검색
4. 클라이언트와 서버에 `noUnusedLocals`와 `noUnusedParameters`를 강제로 켠 TypeScript 컴파일러 조사
5. 직접 의존성 검색과, 이전 리팩터링으로 의존성이나 스크립트가 고립돼 보이는 지점에 대한 Git 이력 확인
6. 정규화한 중복 구간 비교, 그리고 그중 규모가 큰 일치 항목의 수동 확인
7. 추적 중인 JSON, Python, Bash 파일의 구문 검사

아래에서 쓰는 확신도 표시입니다.

- **높음:** 서로 독립적인 검사 여러 개가 일치합니다. 기계적으로 삭제해도 됩니다.
- **중간:** 현재는 참조가 없지만, 동적 로딩이나 외부 소비자, 제품 의도가 걸려 있을 수 있습니다.
- **보류:** 단순화할 여지는 분명하지만, 회귀 범위가 넓어 잔재 제거 작업에서 다루기에는 부담이 큽니다.

정적 분석으로는 런타임 문자열 조회, 다운로드한 패키지의 사용, 사용자가 지정한 경로, 외부 소비자가 없다는 것까지 증명할 수 없습니다. 그런 경우는 죽은 코드로 단정하지 않고 따로 표시했습니다.

## 1. 확신도가 높은 파일 삭제

### 1.1 도달할 수 없는 소스 모듈

| 대상 | 근거 | 정리 참고 | 필요한 검증 |
| --- | --- | --- | --- |
| `packages/client/src/components/agents/AgentDebugPanel.tsx`(296줄) | 들어오는 import가 없고 `AgentDebugPanel`은 선언부에만 나옵니다. | 컴포넌트를 삭제하세요. 그다음 에이전트 스토어의 `debugLog`와 `clearDebugLog`를 살펴보세요. 이 두 가지는 도달할 수 없는 이 패널에서만 쓰입니다. `lastResults`는 `SpriteOverlay`가 쓰므로 지우지 마세요. | `pnpm check`. 에이전트 설정과 디버그 모드를 열어 실제로 쓰이는 디버그 화면이 정상인지 확인하세요. |
| `packages/client/src/components/agents/AgentThoughtBubbles.tsx`(113줄) | 들어오는 import가 없고 `AgentThoughtBubbles`는 선언부에만 나옵니다. 현재 생각 풍선과 체크리스트 UI는 `RoleplayHUD` / `RoleplayHUDActionsMenu`가 그립니다. | 컴포넌트와 함께 `packages/client/.instructions.md`에 남아 있는 낡은 항목도 삭제하세요. | `pnpm check`, `pnpm regression:roleplay`. 브라우저에서 롤플레이 HUD와 연속성 체크리스트를 확인하세요. |
| `packages/client/src/components/panels/GlobalGalleryPanel.tsx`(468줄) | 들어오는 import도, 라우트 등록도, 이름이 정확히 일치하는 참조도 없습니다. | 이 패널만 삭제하세요. 갤러리 기능 전체가 죽었다고 **추론하지 마세요**. `NoodleHome`, 갤러리 훅, 서버 라우트, 저장소에는 여전히 살아 있는 참조가 있습니다. | `pnpm check`, `pnpm smoke:ui`. Noodle의 이미지 업로드와 갤러리 동작을 직접 확인하세요. |
| `packages/shared/src/features/turn-games/engine-utils.ts`(22줄) | import도, 배럴 export도 없고 export한 심벌 4개 모두 이 파일에만 나옵니다. | 파일을 삭제하세요. | `pnpm check`, `pnpm regression`. |

### 1.2 쓸모없어진 사이드카 빌드 스크립트

`scripts/build-sidecar-runtime.mjs`는 패키지 스크립트, 워크플로, 문서, 소스 어디에서도 참조되지 않습니다. 이 스크립트는 `pnpm exec node-llama-cpp`를 실행하는데, `node-llama-cpp`는 더 이상 워크스페이스 의존성이 아닙니다. Git 이력을 보면 예전 로컬 Gemma 사이드카 빌드 경로에서 쓰이던 파일입니다.

**권고(확신도 높음):** 스크립트를 삭제하세요. 삭제 전에, 설치 프로그램 파이프라인이 저장소 밖에 설정돼 있는 경우를 대비해 릴리스 산출물을 마지막으로 한 번 검색해 보세요.

### 1.3 루트에 남은 완료된 작업 지시서

`MARI_PHASE2_TASK.md`와 `MARI_PHASE3_TASK.md`는 이미 코드베이스에 반영된 작업을 브랜치 단위로 지시하던 문서입니다. 저장소 어디에서도 참조하지 않으며, 오래 유지할 사용자 문서나 기여자 문서도 아닙니다.

**권고(확신도 높음):** 작업 트리에서 삭제하세요. 이력은 Git에 남습니다. 남길 만한 배경 설명이 있다면 작업 지시서를 보존하지 말고 그 내용만 해당 아키텍처 문서로 옮기세요.

### 1.4 오해를 부르는 테스트 0개 러너

`packages/server/scripts/run-tests.mjs`는 `.test.ts` 글로브 3개를 대상으로 삼지만, 그 폴더 어디에도 테스트 파일이 없습니다. `pnpm --filter @marinara-engine/server test`와 루트 `pnpm test`는 둘 다 테스트 0개, 스위트 0개로 성공 종료합니다. 예전 테스트는 의도적으로 삭제했고, 저장소 규칙상 `.test.ts` 파일은 남겨 두지 않습니다.

이 문제는 보통의 죽은 코드보다 위험합니다. 지금은 `pnpm test`가 초록불이면 실제로 없는 검증이 있는 것처럼 보이기 때문입니다.

**권고(확신도 높음):**

1. 서버 러너와 서버의 `test` 스크립트를 삭제하세요.
2. Windows 설치 프로그램 레이아웃 검사는 유지하되, 필요하면 역할이 드러나는 전용 스크립트 이름을 붙이세요.
3. 루트의 `test`를 의도적으로 고른 회귀/스모크 묶음을 실행하도록 다시 정의하세요. 아니면 이 범용 별칭을 없애고 `pnpm check`, `pnpm regression:*`, `pnpm smoke:ui`가 실제 검증 명령임을 문서로 밝히세요.
4. 테스트 0개 실행만으로 CI가 "테스트 통과"를 보고하지 못하게 하세요.

## 2. 의존성 정리

아래 직접 의존성은 별도 표시가 없는 한 매니페스트와 락 파일 밖에서 import, 등록, 설정, 런타임 문자열 참조가 전혀 없습니다.

| 워크스페이스 | 의존성 | 확신도와 근거 |
| --- | --- | --- |
| client | `class-variance-authority` | **높음.** 소스와 설정 모두에서 쓰지 않습니다. 이전 의존성 정리 이력에서도 미사용으로 다뤘습니다. |
| client | `autoprefixer` | **높음(빌드로 확인 필요).** PostCSS 설정도 import도 없습니다. 클라이언트는 Tailwind Vite 플러그인을 씁니다. |
| server | `@earendil-works/pi-ai` | **높음.** Professor Mari 런타임이 Pi 의존성을 걷어내는 방향으로 리팩터링됐습니다. 저장소 이력에도 이미 import되지 않는 상태이며 후속 정리 대상으로 남겨 뒀다고 명시돼 있습니다. |
| server | `@fastify/websocket` | **높음.** 플러그인 등록도, 웹소켓 라우트도, import도 없습니다. |
| server | `png-chunk-text` | **높음.** import가 없습니다. 현재 PNG 메타데이터 처리는 직접 구현돼 있습니다. |
| server | `png-chunks-encode` | **높음.** import가 없습니다. |
| server | `png-chunks-extract` | **높음.** import가 없습니다. |
| shared | `chess.js` | **높음(호환성 확인 필요).** 현재 소스에 import가 없습니다. 내장 체스 기능은 선택 패키지로 분리됐습니다. 삭제할 때는 `scripts/check-workspace-install.mjs`의 항목도 함께 지우고, `chess.js`가 없다고 안내하는 낡은 문제 해결 문구도 고쳐야 합니다. |

클라이언트의 `@rollup/wasm-node`도 참조가 없지만, 특정 환경용 Rollup 대체 패키지일 수 있습니다. **확신도 중간**으로 두세요. 패키징과 CI 이력을 확인하고 지원 플랫폼에서 빌드가 되는지 증명한 뒤에 삭제하세요.

`workbox-window`, `pino-pretty`, 루트의 `esbuild`, 타입 패키지, CLI 전용 도구 같은 의존성은 import 텍스트만 보고 미사용으로 분류하지 마세요. 이들은 생성된 모듈, 문자열 기반 전송 설정, 빌드 스크립트, 패키지 스크립트를 통해 쓰입니다.

의존성 PR에서는 `pnpm-lock.yaml`을 갱신하고, 의존성이 없는 깨끗한 상태에서 설치한 뒤, 빌드와 검사 레인을 전부 돌리세요. 이미 채워진 `node_modules` 트리에서 패키지만 빼 보는 것으로는 근거가 되지 않습니다.

## 3. 컴파일러가 증명한 미사용 코드

TypeScript 미사용 검사를 강제로 켜자 **서버 진단 57건**과 **클라이언트 진단 3건**이 나왔습니다. 텍스트 검색만으로 찾은 후보보다 근거가 강합니다. 대부분은 import나 지역 변수라 기계적으로 지울 수 있습니다. 다만 콜백 매개변수와 public 메서드 매개변수는 호출 시그니처를 먼저 확인해야 합니다.

### 3.1 클라이언트

- `ChatSettingsDrawer.tsx`: 쓰이지 않는 `subject` 필터 매개변수
- `GameCombatUI.tsx`: 쓰이지 않는 `line` map 매개변수
- `hooks/use-encounter.ts`: 쓰이지 않는 `_res`. 결과를 변수에 담지 말고 요청만 await하세요.

### 3.2 서버

- `db/file-backed-store.ts`: 쓰이지 않는 `TABLES_REVERSE`, 쓰이지 않는 `loadedManifest` 인스턴스 필드와 대입
- 라우트의 import와 지역 변수: `backup.routes.ts`(`dirname`), `sprites.routes.ts`(`readdir`), `scene.routes.ts`(`gsStorage`), `noodle.routes.ts`(`extractNoodleMentionHandles`, `NoodleInteractionType`), `generate/dry-run-route.ts`(`lorebooksStore`)
- 쓰이지 않는 라우트 콜백 매개변수: `game-assets.routes.ts`, `lorebooks.routes.ts`, `sprites.routes.ts`, `youtube.routes.ts`(`reply`). Fastify 시그니처의 위치를 반드시 유지해야 할 때만 `_reply`로 이름을 바꾸세요.
- `game.routes.ts`: `GmPromptContext`, `formatMoraleContext`, `sceneSpotifyTrackCandidateSchema`
- `generate.routes.ts`: `readFileSync`, `LIMITS`, `AgentPhase`, `CharacterStat`, `GameState`, `createLLMProvider`, `formatZonedConversationDate`, `formatZonedConversationTime`, `chatsTable`, `normalizeCustomEmojiSelection`, `embedMemoryRecallTexts`, `latestHistoryUserContent`, `getActiveTurnGame`, `startTurnGame`, `pruneEmptyPromptWrappers`, `areConversationSchedulesEnabled`, `addEventEntry`, `normalizeAgentMaxTokens`, `resolveAgentRunInterval`, 그리고 지역 변수 `chatParams`
- `generate/dry-run-route.ts`: 쓰이지 않는 지역 헬퍼 `wrapperMessages`
- `services/agents/agent-executor.ts`: `sanitizeTextAgentResponse`의 쓰이지 않는 `agentType` 매개변수. 매개변수를 없앤다면 내부 호출부도 함께 고치세요.
- `services/agents/agent-pipeline.ts`: 쓰이지 않는 `AgentPhase`
- `services/conversation/schedule.service.ts`: 쓰이지 않는 `createLLMProvider`와 `ConversationStatusOverride`
- `services/game/perception.service.ts`: 쓰이지 않는 `RPGAttributes`
- `services/generation/conversation-react-command-runtime.ts`: 쓰이지 않는 `command` 헬퍼 매개변수
- `services/import/st-bulk.importer.ts`: 쓰이지 않는 `personasTable`
- `services/lorebook/keyword-scanner.ts`: 구조 분해했지만 쓰이지 않는 `currentMessageIndex`. 삭제 전에 내부 옵션 형태를 확인하세요.
- `services/lorebook/prompt-injector.ts`: 쓰이지 않는 `LorebookEntry`
- `services/mari-db/mari-db.service.ts`: 쓰이지 않는 `makeEmptyValidation` 헬퍼
- `services/prompt/assembler.ts`: 쓰이지 않는 `PromptPreset`, `PromptSection`, `PromptGroup`, `groupOrder`, `chatHistoryEndIdx`
- `services/sidecar/scene-analyzer.ts`: 쓰이지 않는 `widgetUpdateHint`, `widgetStateSummary` 헬퍼
- `services/sidecar/scene-postprocess.ts`: 쓰이지 않는 `normalizeExpression` 헬퍼
- `services/sidecar/sidecar-process.service.ts`: `lastReadyAt`에 값을 넣기만 하고 읽지 않습니다.
- `services/storage/noodle.storage.ts`: 쓰이지 않는 `NoodlerStageProfile`
- `services/storage/prompts.storage.ts`: `reorderVariables`의 쓰이지 않는 `presetId` 매개변수. 시그니처를 바꾸기 전에 호출부와 저장 순서 규칙을 확인하세요.

이 목록을 다 정리한 뒤에는 서버와 클라이언트의 TypeScript 설정에서 `noUnusedLocals`와 `noUnusedParameters`를 켜세요. 그러면 한 번 훑고 끝나는 감사가 계속 유지되는 규칙으로 바뀝니다. 일부러 남겨야 하는 콜백 매개변수는 규칙을 전역으로 다시 끄지 말고 이름 앞에 `_`를 붙이세요.

## 4. 저장소 안에 소비자가 없는 내부 export

export한 선언은 일반적인 미사용 지역 변수 검사에서 빠집니다. 그래서 선언부에만 등장하는 이름을 찾는 2차 조사를 했습니다. 클라이언트는 공개 라이브러리가 아니라 앱이므로 이런 항목은 삭제 후보로 유용합니다. 도메인 단위로 묶어 지우고, 딸려 있던 비공개 헬퍼나 import는 컴파일러가 드러내게 하세요.

### 4.1 클라이언트 훅과 헬퍼

- 에이전트 훅: `useAgentConfig`, `useUpdateAgentByType`, `useToggleAgent`
- 캐릭터 훅: `useUpdatePersonaGalleryClipTrim`, `useCharacterGroup`
- 채팅/폴더 훅: `useReorderChats`, `useActiveChatPreset`, `useCreateChatPreset`, `useTouchChat`, `useMarkAutonomousUnread`, `useBulkSetMessagesHiddenFromAI`, `useSwipes`, `useMoveConnection`
- 게임 훅: `useRegeneratePartyCard`, `useUpdateGameMapBinding`, `useCombatLoot`, `useLootGenerate`, `useGameJournal`, `useGameCheckpoints`, `useCreateCheckpoint`, `useLoadCheckpoint`, `useDeleteCheckpoint`
- 햅틱 훅: `useHapticStopScan`, `useHapticCommand`, `useHapticStopAll`
- 로어북 훅: `useLorebookEntry`, `useBulkCreateEntries`, `useSearchLorebookEntries`
- 그 밖의 훅: `useCustomTool`, `useUpdateNoodleAccount`, `usePreset`, `useCreatePreset`, `usePresetGroups`, `useReorderGroups`, `usePresetSections`, `usePresetVariables`, `usePreviewPreset`, `useRegexScript`, `useUpdateSpatialContext`
- UI 선언: `parseQteTag`, `NoodlerNotificationItem`, `LabelWithHelp`, `RESOURCE_PANEL_SORT_OPTIONS`, `SyncedSettings`
- 라이브러리 헬퍼: `isManagedChatBackgroundUrl`, `isBrowserSpeechRecognitionSupported`, `requestTurnGameBotGeneration`, `resolveInputMacrosForChat`, `createCustomToolFolderPackageFilename`, `resolveCurrentGameSessionChatId`, `readTextFileFromZip`, `buildTTSMessageText`

클라이언트 훅을 쓰지 않는다고 해서 그 서버 엔드포인트가 죽었다는 뜻은 **아닙니다**. 훅을 먼저 지우고, 라우트는 UI와 기능 패키지, 외부 API 호환성을 기준으로 따로 조사하세요.

### 4.2 API인지 테스트 이음새인지 최종 판단이 필요한 서버 후보

아래 서버 export 역시 저장소 안에는 소비자가 없습니다. 대부분 내부용으로 보이지만, export된 테스트 이음새와 헬퍼는 저장소 밖 도구가 쓸 수 있습니다. 지원 대상 API가 아니라고 메인테이너가 확인하기 전까지는 확신도가 중간입니다.

- 런타임과 기본 인증: `getServerRoot`, `getSpotifyRedirectUri`, `isAutoOpenBrowserDisabled`, `hasBasicAuthConfigured`
- 테스트 이음새: `resetRateLimitBucketsForTests`, `buildKnowledgeRetrievalAgentMessagesForTest`, `splitRuntimeHandledAgentInjectionsForTest`, `__setSdkForTesting`
- 생성과 프롬프트 헬퍼: `normalizeSecretPlotSceneDirections`, `buildUserMessageRegenerationPrompt`, `buildUserMessageRegenerationSourceMessage`, `wrapFields`, `mergeTruncation`, `modelAccessOptions`, `isStandaloneCharacterProfileBlock`, `resolveChatSummaryPromptFromMetadata`
- 게임 헬퍼: `buildNpcPortraitImagePrompt`, `buildBackgroundImagePrompt`, `buildSceneIllustrationImagePrompt`, `buildSessionSummaryPrompt`, `buildCardAdjustmentPrompt`, `moraleDiceModifier`, `buildNpcRelationshipSummary`, `buildSessionCarryoverContext`, `getTurnGameContextText`
- 로어북 헬퍼: `enforceMaxActivatedEntries`, `applyPerLorebookTokenBudgets`, `resolveActivatedLorebookEntryContent`, `resolveBudgetAndRecursivelyActivateLorebookEntries`, `recursiveScan`
- 유틸리티와 타입: `AgentPipelineResult`, `resolveVideoRequestDuration`, `newTimeSortableId`, `parseBoolean`, `sanitizePathFilename`

"텍스트에 한 번만 등장한다"는 이 기준을 `packages/shared`에 그대로 적용하지 마세요. shared의 export는 클라이언트, 서버, 다운로드하는 에이전트 패키지를 위한 호환성 계약이며, 이 저장소 밖의 소비자도 포함됩니다.

## 5. 정적 에셋 후보

`packages/client/public/sprites/mari/Mari_point_down_left.png`는 함께 빌드되는 Mari 스프라이트 중 파일명과 경로가 저장소 어디에서도 참조되지 않던 유일한 파일이었으며, omnibar slice 38a에서 삭제되었습니다.

빌드에 포함된 게임 에셋을 파일명 검색만으로 정리하지 마세요. 서버 시더와 매니페스트가 일부 에셋 폴더를 동적으로 훑습니다.

## 6. 범위가 한정된 단순화

여기부터는 죽은 코드 삭제가 아니라 유지보수성 개선입니다. 각 항목은 동작을 그대로 유지해야 하고, 대상을 좁힌 회귀 검증을 함께 갖춰야 합니다.

### 6.1 완전히 또는 거의 똑같이 중복된 비즈니스 로직

1. **스토리보드 키프레임 선택(위험 낮음).** `GameSurface.tsx`에는 `lib/game-session-replay.ts`가 export하는 `findReplayStoryboardKeyframe`과 같은 내용의 `findStoryboardKeyframeForSegment` 구현이 따로 들어 있습니다. 라이브러리 헬퍼를 재사용하고 지역 사본을 지우세요.
2. **Spotify 검색어 정규화(위험 낮음/중간).** `SPOTIFY_STOP_WORDS`, `SPOTIFY_MOOD_EXPANSIONS`, 확장 처리 흐름이 `game-spotify-music.service.ts`와 `tool-executor.ts`에 중복돼 있습니다. 작은 Spotify 검색어 토큰 헬퍼로 빼내 두 경로가 어긋나지 않게 하세요.
3. **PNG 캐릭터 카드 메타데이터 추출(위험 중간).** `extractCharaFromPng`가 `import.routes.ts`와 `st-bulk.importer.ts`에 각각 구현돼 있습니다. 서버 유틸리티 하나로 빼내고, 일반 텍스트 청크, 국제화 텍스트 청크, base64/원본 페이로드, V2/V3 카드, 깨진 PNG를 회귀 검증용 샘플로 확인하세요.
4. **튜토리얼 툴팁 위치 계산(위험 중간).** `GameTutorial.tsx`와 `OnboardingTutorial.tsx`에 겹침 판정과 배치 로직이 중복돼 있습니다. 공통 위치 계산만 빼내고, 각 튜토리얼의 모바일 정책과 제품별 정책은 명시적인 옵션으로 남기세요.
5. **클라이언트/서버의 게임 세그먼트 편집 정규화(위험 중간/높음).** 클라이언트와 서버의 순수 정규화 로직이 비슷합니다. 런타임에 정말로 중립적인 스키마와 정규화 함수만 shared로 옮기고, 서버 파싱과 저장 관련 처리는 서버에 두세요.

### 6.2 크게 반복되는 UI 영역: 통합은 보류

- `CharacterEditor.tsx`와 `PersonaEditor.tsx`에는 스프라이트 관리 흐름이 상당 부분 그대로 반복됩니다.
- `ChatInput.tsx`와 `ConversationInput.tsx`에는 가이드 플랜과 입력창 동작이 반복됩니다.

통합할 가치는 분명히 있습니다. 하지만 두 쌍 중 어느 쪽이든 통째로 합치면 회귀 범위가 너무 넓어집니다. 훅이나 컴포넌트를 하나씩 의미 단위로 빼내세요. 편집기는 스프라이트 관리부터, 입력창은 가이드 플랜 동작부터 시작하고, 추출할 때마다 양쪽 사용처를 브라우저에서 확인하세요.

### 6.3 복잡도가 높은 활성 지점

현재 가장 큰 활성 모듈은 `server/routes/game.routes.ts`, `client/components/game/GameSurface.tsx`, `client/features/chat-settings/ChatSettingsDrawer.tsx`, `server/routes/generate.routes.ts`, `client/components/panels/SettingsPanel.tsx`입니다. 삭제 후보는 아닙니다. 해당 기능을 이미 손대고 있을 때에 한해 라우트 핸들러, 도메인 서비스, 드로어 구역, 순수 헬퍼를 조금씩 빼내세요. "전부 쪼개기" PR을 따로 만들면 동작을 확실히 검증하지도 못한 채 변경만 늘어납니다. Chat Settings Drawer는 예외여서 PR 하나당 섹션 하나씩 분리했습니다(#9119). 폴더 규칙은 `packages/client/.instructions.md`의 Chat Settings 섹션에 있습니다.

## 7. 정리 대상에서 일부러 제외한 항목

- 2.x 라인 내내 유지하기로 명시한 호환성 필드. 이미지 스타일, 게임 상태, TTS, 페르소나 트래커, 대화 컨텍스트 관련 호환 구조가 여기에 해당합니다. 다음 메이저 릴리스에서 버전이 명시된 마이그레이션을 통해서만 제거하세요.
- 자동 생성되는 기능 레지스트리와 매니페스트. 손으로 다듬지 말고 각자의 스크립트로 다시 생성하세요.
- 다운로드하는 Illustrator, Music DJ, Lorebook Keeper 등 에이전트 패키지 코드. 에이전트가 소유한 런타임과 프롬프트 정리는 `Pasta-Devs/Marinara-Agents`의 몫이며, 여기서는 호스트 쪽 연동만 다룹니다.
- `custom_components` 아래의 Home Assistant 모듈. 이 모듈들은 이름 규칙과 매니페스트로 탐색됩니다.
- `MarinaraLauncher.exe`. 작업 표시줄 바로 가기 마이그레이션 코드가 사용합니다.
- `start-local.bat`. 패키지 스크립트에서 참조하지는 않지만, 사람이 직접 쓰는 로컬 런처일 가능성이 있습니다. 메인테이너의 의도를 확인한 뒤에만 삭제하세요.
- 참조가 없어 보이지만 모듈 초기화나 테이블 등록 과정에서 실행되는 스키마 선언.
- 편의용 React 훅이 쓰이지 않는다는 이유만으로 서버 라우트를 지우는 일. 다운로드하는 패키지나 API 소비자가 여전히 호출할 수 있습니다.

## 8. 권장 정리 순서

작업은 단순하고 검토하기 쉽게 유지하세요.

1. **PR A(잔재):** 도달할 수 없는 모듈 4개, 낡은 컴포넌트 문서 항목, 쓸모없어진 사이드카 스크립트, 완료된 작업 지시서를 삭제하고, 직접 확인을 마친 뒤 쓰이지 않는 Mari 스프라이트도 삭제합니다.
2. **PR B(정직한 테스트 표면):** 테스트 0개 러너를 삭제하고, 성공한 명령이 실제 검증을 뜻하도록 패키지 스크립트의 이름과 정의를 바꿉니다.
3. **PR C(컴파일러 정리):** TypeScript 진단 60건을 처리한 뒤 클라이언트와 서버 설정에서 미사용 검사를 켭니다.
4. **PR D(의존성):** 확신도가 높은 패키지 8개를 삭제하고, 워크스페이스 설치 검사와 문제 해결 문구를 고치고, 락 파일을 다시 만들고, 깨끗한 설치와 빌드를 확인합니다.
5. **PR E 이후(도메인 묶음):** 쓰이지 않는 클라이언트 export를 도메인별로 삭제한 뒤, 위험이 낮은 중복 헬퍼를 하나씩 정리합니다.

의존성 삭제, 대규모 UI 리팩터링, 라우트 분해를 하나의 정리 PR에 몰아넣지 마세요.

## 9. 검증 매트릭스

변경 내용에 맞는 검증을 실행하세요.

- 모든 코드 정리: `pnpm check`
- shared 변경이나 범위가 넓은 서버 변경: 먼저 `pnpm regression` 또는 범위를 좁힌 `pnpm regression:<domain>`을 실행하고, 병합 전에 전체 레인을 실행합니다.
- UI 컴포넌트와 훅 정리: `pnpm smoke:ui`, 그리고 해당 흐름의 브라우저 직접 확인
- 프롬프트, 에이전트, 롤플레이 경로: `pnpm regression:prompt`와 `pnpm regression:roleplay` 중 해당하는 것
- 의존성 정리: 깨끗한 상태에서의 고정 설치, `pnpm check`, 프로덕션 빌드, 지원 플랫폼 CI
- PNG 가져오기 통합: 정상 캐릭터 카드와 깨진 캐릭터 카드를 모두 다루는 가져오기 회귀 검증
- 릴리스와 버전 파일을 예기치 않게 건드린 경우: `pnpm version:check`와 `pnpm credits:check`

이번 정리 전에는 범용 `pnpm test` 결과를 테스트 근거로 인용할 수 없었습니다. 테스트를 실행하지 않고도 성공으로 끝났기 때문입니다.

## 10. 감사 검증과 한계

이번 감사에서 확인한 내용입니다.

- 추적 중인 JSON 파일은 모두 정상적으로 파싱됐습니다.
- 추적 중인 Python 파일 12개는 모두 Python의 AST 파서로 정상 파싱됐습니다.
- `start.sh`, `start-termux.sh`, `android/build-apk.sh`는 `bash -n`을 통과했습니다.
- TypeScript 미사용 검사에서 위에 정리한 서버 57건, 클라이언트 3건이 나왔습니다.
- 서버와 루트의 테스트 명령이 테스트 0개로 성공하는 것을 직접 확인했습니다.

ShellCheck과 PowerShell이 설치돼 있지 않아 셸 의미 검사와 PowerShell/Windows 스크립트 파싱은 수행하지 못했습니다. Android와 Home Assistant 대상은 구조만 확인했고 이번 감사에서 완전히 빌드하지는 않았습니다. 이 플랫폼 검사는 해당 파일을 수정하는 정리 PR에서 수행해야 합니다.
