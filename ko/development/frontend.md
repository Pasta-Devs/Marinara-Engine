# 프런트엔드 아키텍처(개발자용)

이 문서는 개발자를 위한 자료이며 일반 사용자 가이드가 아닙니다. Marinara Engine 클라이언트가 어떤 구조로 만들어져 있는지 설명합니다. React 앱 구조, Zustand 스토어, React Query 훅, 주요 컴포넌트, 서버 API 구성을 다룹니다. 앱을 쓰는 방법만 알고 싶다면 사용자 가이드부터 보세요.

## 개요

Marinara Engine은 Conversation(대화), Roleplay(롤플레이), Game(게임) 세 가지 모드를 갖춘 AI 채팅 앱입니다. 클라이언트는 Vite로 서비스하는 React 19 단일 페이지 앱이고, 스타일은 Tailwind CSS v4로 입혔으며, PWA(Progressive Web App)로 패키징합니다.

클라이언트 코드는 `packages/client`에 있습니다. REST와 SSE(Server-Sent Events)로 Fastify API 서버(`packages/server`)와 통신합니다. 양쪽이 공유하는 데이터 계약(타입, Zod 스키마, 상수)은 `packages/shared`에 두고 클라이언트와 서버가 함께 가져다 씁니다.

## 앱 아키텍처

### 셸 레이아웃

`components/layout/AppShell.tsx`는 상단 막대, 가운데 영역, 사이드바 하나를 배치합니다. 사이드바는 Chats(채팅) 또는 패널 하나를 보여 주며 둘을 동시에 보여 주지 않습니다. 기본적으로 오른쪽에 고정되고, `sidebarSide`가 `"left"`이면 왼쪽에 고정됩니다.

```
+-----------------------------------+----------------+
|  Center                           |  Sidebar       |
|                                   |                |
|  Chat area or Editor              |  Chats         |
|  (lazy-loaded)                    |  (chat list,   |
|                                   |  folders,      |
|  ChatConversationSurface          |  mode tabs)    |
|  ChatRoleplaySurface              |                |
|  GameSurface                      |  or a panel:   |
|  CharacterEditor                  |  Characters    |
|  LorebookEditor                   |  Personas      |
|  PresetEditor                     |  Lorebooks     |
|  ...other editors                 |  Presets, ...  |
+-----------------------------------+----------------+
```

- 사이드바(`AppShell.tsx`의 `[data-component="SidebarSlot"]`): 데스크톱에서는 슬롯 하나입니다. 슬라이딩 래퍼(`SidebarSlotPanel`) 안에는 두 레이어가 겹쳐 있습니다. `ChatSidebarPanel`은 폴더와 모드 탭(Conversation, Roleplay, Game)을 갖춘 채팅 목록인 `components/layout/ChatSidebar.tsx`를 렌더링합니다. 읽지 않은 메시지 수와 알림 말풍선을 여기에서 불러오므로 데스크톱에서는 항상 마운트되어 있습니다. `RightPanelDesktop`은 `components/layout/RightPanel.tsx`를 렌더링하며 패널을 처음 열 때 마운트됩니다. 숨겨진 레이어는 `invisible`, `inert`, `aria-hidden` 상태입니다. Chats와 패널 사이의 전환은 즉시 이루어지고, 사이드바를 열거나 닫을 때는 슬라이딩합니다.
- 너비: 사이드바 안쪽 가장자리의 구분선 하나(aria-label "Resize sidebar")로 `SHARED_SIDEBAR_WIDTH_MIN`(280)부터 `SHARED_SIDEBAR_WIDTH_MAX`(480)까지 공유 너비를 설정합니다. `selectSharedSidebarWidth`로 읽으세요. 스토어는 `sidebarWidth`와 `rightPanelWidth`를 같게 유지합니다.
- 위치: `sidebarSide: "left"`이면 슬롯에 CSS `order: -1`이 적용됩니다. React 트리에서 위치를 유지하므로 좌우를 바꿔도 패널이 다시 마운트되지 않습니다. `--mari-chat-ui-inset-left` / `--mari-chat-ui-inset-right`, 고정된 Tracker Panel의 오프셋, 비모달 `Modal`의 안쪽 여백도 위치를 따릅니다.
- 휴대전화와 태블릿: `isMobileShellViewport()`가 true이면(`MOBILE_SHELL_MEDIA_QUERY`에 해당하거나 창이 고정 레이아웃에 비해 너무 좁으면) 사이드바는 오른쪽에서 열리는 전체 화면 시트이며, `ChatSidebarPanel` 또는 `RightPanelMobile`로 렌더링됩니다. 여기에는 `sidebarSide`가 적용되지 않습니다.
- 가운데 영역: 현재 채팅 화면이거나 전체 화면 편집기(캐릭터, 로어북, 프리셋 등)입니다. 한 번에 하나만 보이며, 편집기를 열면 채팅 영역을 대신합니다.
- 패널(`components/layout/RightPanel.tsx`): `rightPanel`을 패널 컴포넌트로 연결하고 열어 본 패널의 마운트를 유지합니다. [패널 시스템](#panel-system-componentspanels)을 참고하세요.
- 상단 막대(`components/layout/TopBar.tsx`): 한쪽에는 Home(홈)과 채팅 정보가 있습니다. 사이드바 쪽의 `[data-tour="panel-buttons"]`에는 Chats 버튼(`[data-tour="sidebar-toggle"]`)이 먼저 오고, 그 뒤에 각 패널의 버튼이 있습니다. `sidebarSide: "left"`이면 막대가 좌우 반전되어(`flex-row-reverse`) 패널 버튼은 왼쪽에, Home은 맨 오른쪽에 놓입니다. 휴대전화와 태블릿에서는 Chats가 Home 옆에 유지되며, 휴대전화에서는 Chats와 패널 버튼이 **More**(더보기) 메뉴로 이동합니다.

### 화면 이동

화면 이동은 상태로 결정하며 URL 라우터가 없습니다. `stores/ui.store.ts` Zustand 스토어가 무엇을 렌더링할지 정합니다.

| 이동 대상 | 스토어 필드 | 호출 함수 |
| ---------------------- | -------------------- | ------------------------------------------------- |
| 캐릭터 편집기 열기 | `characterDetailId` | `openCharacterDetail(id)` |
| 로어북 편집기 열기 | `lorebookDetailId` | `openLorebookDetail(id)` |
| 프리셋 편집기 열기 | `presetDetailId` | `openPresetDetail(id)` |
| 연결 편집기 열기 | `connectionDetailId` | `openConnectionDetail(id)` |
| 에이전트 편집기 열기 | `agentDetailId` | `openAgentDetail(id)` |
| 페르소나 편집기 열기 | `personaDetailId` | `openPersonaDetail(id)` |
| 패널 표시 | `rightPanel` | `openRightPanel(name)` / `toggleRightPanel(name)` |
| Chats 표시 | `sidebarOpen` | `toggleSidebar()` / `setSidebarOpen(open)` |
| 창 열기 | `modal` | `openModal(type, props?)` |

Chats와 패널은 사이드바를 공유하므로 모든 화면 크기에서 둘 중 하나만 표시됩니다. `openRightPanel`과 `toggleRightPanel`은 Chats를 닫고, `toggleSidebar`와 `setSidebarOpen(true)`는 패널을 닫습니다. `setSidebarOpen(false)`는 열려 있는 패널에 영향을 주지 않습니다. 패널이 열려 있으면 `selectSidebarShown`은 false이므로, 오래된 상태에서 두 플래그가 모두 true여도 패널을 표시하며, 영구 저장 상태는 이렇게 저장된 쌍을 패널만 열리는 상태로 바꿉니다.

### 코드 분할

주요 편집기와 무거운 컴포넌트는 `AppShell.tsx`에서 `React.lazy()`와 `Suspense`로 지연 로딩합니다. 덕분에 최초 번들이 작게 유지됩니다(아래 번들 예산 참고).

## 상태 관리

### Zustand 스토어(클라이언트 상태)

클라이언트는 UI 상태와 런타임 상태를 `packages/client/src/stores/`의 Zustand 스토어 묶음으로 관리합니다. 저장되는 스토어는 `ui.store.ts` 하나뿐입니다. 나머지는 채팅, 에이전트, 게임, 로컬 모델 런타임, 번역, 대화 상자, 백필의 런타임 상태를 담습니다.

현재 스토어 파일은 `agent.store.ts`, `backfill.store.ts`, `chat-tools-menu.store.ts`, `chat.store.ts`, `combat-screen.store.ts`, `conversation-games.store.ts`, `dialog.store.ts`, `encounter.store.ts`, `floating-window.store.ts`, `gallery.store.ts`, `game-asset.store.ts`, `game-mode.store.ts`, `game-state.store.ts`, `roleplay-sheet.store.ts`, `sidecar.store.ts`, `translation.store.ts`, `ui.store.ts`입니다. 테이블 게임 스토어는 다운로드 가능한 각 패키지로 옮겨졌으며, `conversation-games.store.ts`는 Conversation 게임 선택기와 설정만 추적합니다. `combat-screen.store.ts`는 표시 중인 전투 화면과 라운드를 추적하므로, 그때만 상단 바에 전투 조작 버튼이 뜹니다. `roleplay-sheet.store.ts`는 Roleplay 채팅에서 어떤 멤버의 규칙 집합 시트를 열었는지 추적합니다.

#### `ui.store.ts`: 설정과 UI 외형

유일하게 저장되는 스토어입니다(Zustand `persist` 미들웨어를 통해 localStorage에 저장). 다음을 담습니다.

- 테마: `visualTheme`("default" 또는 "sillytavern"), `data-theme` 값(dark 또는 light), 사용자 지정 색상 재정의.
- 모양: `fontSize`, `chatFontSize`, `fontFamily`, 사용자 지정 글꼴, 커서 모양.
- 채팅 표시: `boldDialogue`, `showTimestamps`, `showModelName`, `messagesPerPage`.
- 텍스트 스타일: 채팅 글자 색, Roleplay 메시지 배경 불투명도, 글자 테두리.
- 스트리밍: `enableStreaming`, `streamingSpeed`.
- Conversation 테마: 메시지 말풍선의 그라데이션 색상.
- 소리: `convoNotificationSound`, `rpNotificationSound`.
- 동작: `confirmBeforeDelete`, `enterToSendRP`, `enterToSendConvo`, `weatherEffects`, `guideGenerations`.
- 화면 이동: `rightPanel`, `rightPanelOpen`, `sidebarOpen`, `settingsTab`, `*DetailId` 필드 전부, `modal`.
- 사이드바 레이아웃: `sidebarSide`(`"right"` 또는 `"left"`, 기본값은 `"right"`, 기기 간 동기화되며 `resetAppearanceSettings`가 `"right"`로 초기화), `sidebarWidth` / `rightPanelWidth`(같게 유지하며 `selectSharedSidebarWidth`로 읽음).

동기화되는 사용자 지정 테마는 `ui.store.ts`에 저장하지 않습니다. React Query로 서버에서 받아 오며, 같은 Marinara 인스턴스에 연결된 기기끼리 공유됩니다.

#### `chat.store.ts`: 채팅 런타임

저장하지 않습니다. 현재 채팅 세션을 추적합니다.

- `activeChatId`: 화면에 표시 중인 채팅.
- `messages`: 현재 메시지 배열.
- `isStreaming`, `streamBuffer`: 진행 중인 생성.
- `inputDrafts`: 채팅별 임시 메시지.
- `currentInput`: 채팅 입력란의 현재 값.
- `perChatTyping`: 입력 중 표시 상태.
- `unreadCounts`, `chatNotifications`: 알림 배지.
- `abortControllers`: 진행 중인 생성 취소.

#### `agent.store.ts`: 에이전트 실행

생성 도중과 생성 후의 에이전트 파이프라인 상태를 추적합니다.

- `activeAgents`: 지금 실행 중인 에이전트.
- `thoughtBubbles`: 실시간으로 보여 주는 에이전트의 사고 과정.
- `echoMessages`: echo chamber(가상 시청자 채팅).
- `cyoaChoices`: 분기 선택지 UI.
- `debugLog`: 성능 지표와 토큰 사용량.
- `failedAgentTypes`: 오류가 난 에이전트(재시도 UI용).

#### `game-state.store.ts`: RPG 보조 정보

Roleplay 모드의 장면과 세계 컨텍스트를 담습니다.

- `current`(GameState): 날짜, 시간, 장소, 날씨, 등장 캐릭터, 사건, 플레이어 능력치, 퀘스트, 인벤토리.
- `isVisible`, `expandedSections`: HUD 표시 상태.

#### `encounter.store.ts`: 전투 시스템

턴제 전투 상태입니다.

- `active`: 인카운터 진행 여부.
- `party`, `enemies`: HP, 공격, 상태를 가진 전투 참가자.
- `environment`: 전투 장소 정보.
- `playerActions`, `encounterLog`: 행동 대기열과 기록.
- `combatResult`: 승리, 패배, 도주, 중단.

#### `gallery.store.ts`: 이미지 오버레이

- `pinnedImages`: 채팅 영역에 오버레이로 고정한 이미지.

### React Query(서버 데이터)

서버 데이터는 모두 TanStack React Query로 가져오고 캐시합니다. 설정은 `lib/query-client.ts`에 있습니다.

- 스테일 시간: 30초(전역 기본값).
- 재시도: 1회.
- 포커스 시 다시 가져오기: 사용하지 않음.
- 캐시: 메모리에만 유지(저장하지 않음).

엔티티마다 전용 훅 파일이 있고, 그 파일이 쿼리 훅과 뮤테이션 훅을 내보냅니다.

## 훅 레퍼런스

모든 훅은 `src/hooks/`에 있으며 `use-{entity}.ts` 형태로 이름을 짓습니다. 아래 표에는 주요 훅만 나열합니다. 전체 목록은 `packages/client/src/hooks/`에 있습니다.

### 채팅 훅(`use-chats.ts`)

| 훅 | 종류 | 설명 |
| ---------------------------------- | -------------- | -------------------------------------------- |
| `useChats()` | Query | 전체 채팅 |
| `useChat(id)` | Query | ID로 채팅 하나 조회 |
| `useChatMessages(chatId, perPage)` | Infinite Query | 채팅의 페이지 단위 메시지 |
| `useChatGroup(groupId)` | Query | 채팅 그룹 |
| `useCreateChat()` | Mutation | 새 채팅 만들기 |
| `useDeleteChat()` | Mutation | 채팅 삭제 |
| `useUpdateChatMetadata()` | Mutation | 채팅 메타데이터 수정(에이전트, 스프라이트 등) |
| `useBranchChat()` | Mutation | 특정 메시지에서 채팅 분기 |
| `useUpdateMessage()` | Mutation | 메시지 내용 편집(낙관적 업데이트) |
| `useDeleteMessage()` | Mutation | 메시지 하나 삭제 |
| `useDeleteMessages()` | Mutation | 메시지 여러 개 삭제 |
| `useSetActiveSwipe()` | Mutation | 다른 생성 스와이프로 전환 |
| `usePeekPrompt()` | Mutation | 조립된 프롬프트 미리보기 |
| `useClearAllData()` | Mutation | 전체 삭제(되돌릴 수 없음) |

### 캐릭터 훅(`use-characters.ts`)

| 훅 | 종류 | 설명 |
| ---------------------- | -------- | -------------------------------------- |
| `useCharacters()` | Query | 전체 캐릭터 |
| `useCharacter(id)` | Query | 파싱된 카드 데이터를 포함한 캐릭터 하나 |
| `useCreateCharacter()` | Mutation | 캐릭터 만들기 |
| `useUpdateCharacter()` | Mutation | 캐릭터 카드 데이터 수정 |
| `useDeleteCharacter()` | Mutation | 캐릭터 삭제 |
| `useUploadAvatar()` | Mutation | 아바타 이미지 업로드 |
| `usePersonas()` | Query | 전체 페르소나 |
| `usePersona(id)` | Query | 페르소나 하나 |
| `useCreatePersona()` | Mutation | 페르소나 만들기 |
| `useUpdatePersona()` | Mutation | 페르소나 수정 |
| `useDeletePersona()` | Mutation | 페르소나 삭제 |
| `useCharacterGroups()` | Query | 캐릭터 그룹 |
| `usePersonaGroups()` | Query | 페르소나 그룹 |

### 프리셋 훅(`use-presets.ts`)

| 훅 | 종류 | 설명 |
| ------------------------------ | -------- | ---------------------------------------------------------- |
| `usePresets()` | Query | 전체 프리셋 |
| `usePresetFull(id)` | Query | 섹션, 그룹, 변수를 포함한 프리셋 하나 |
| `useDefaultPreset()` | Query | 기본 프리셋 |
| `useUpdatePreset()` | Mutation | 프리셋 수정 |
| `useDeletePreset()` | Mutation | 프리셋 삭제 |
| `useDuplicatePreset()` | Mutation | 프리셋 복제 |
| `useSetDefaultPreset()` | Mutation | 프리셋을 기본값으로 지정 |
| `useCreateSection()` | Mutation | 프롬프트 섹션 만들기(수정, 삭제, 순서 변경 훅도 같은 파일에 있음) |
| `useCreateGroup()` | Mutation | 섹션 그룹 만들기(수정, 삭제 훅도 같은 파일에 있음) |
| `useCreateVariable()` | Mutation | 프리셋 변수(이전의 선택 블록) 만들기(수정, 삭제, 순서 변경 훅도 같은 파일에 있음) |

### 에이전트 훅(`use-agents.ts`)

| 훅 | 종류 | 설명 |
| -------------------- | -------- | ------------------------------- |
| `useAgentConfigs()` | Query | 전체 에이전트 설정 |
| `useCreateAgent()` | Mutation | 사용자 지정 에이전트 만들기 |
| `useUpdateAgent()` | Mutation | 에이전트 설정 수정 |
| `useDeleteAgent()` | Mutation | 에이전트 삭제 |
| `useUpdateAgentByType()` | Mutation | 에이전트 종류를 기준으로 설정 수정 |

### 생성 훅(`use-generate.ts`)

가장 복잡한 훅입니다. `{ generate, retryAgents }`를 반환합니다.

`generate(params)`는 `chatId`, `connectionId`, `userMessage`, `regenerateMessageId`, `continueMessageId`, `impersonate`, `attachments` 같은 필드를 담은 옵션 객체 하나를 받습니다. 해당 채팅에서 이미 생성이 진행 중이면 `false`를 반환합니다. 처리 흐름은 다음과 같습니다.

1. `chat.store.ts`에 스트리밍 상태를 설정합니다.
2. `/api/generate`로 생성 요청을 보냅니다.
3. `token`, `agent_start`, `agent_result`, `agent_error`, `thinking`, `tool_call`, `game_state`, `game_state_patch`, `text_rewrite`, `scene_created`, `done`, `error` 같은 SSE 이벤트를 파싱합니다.
4. 새 메시지로 React Query 캐시를 갱신합니다.
5. 사고 과정 말풍선과 디버그 정보를 에이전트 스토어에 채웁니다.
6. 오류는 토스트 알림으로 처리합니다.

### 그 밖의 훅

`src/hooks/` 폴더에는 기능별 훅도 많이 들어 있습니다. 대표적인 예는 다음과 같습니다.

| 파일 | 용도 |
| ------------------------------ | ----------------------------------------- |
| `use-connections.ts` | API 연결 CRUD와 테스트 |
| `use-lorebooks.ts` | 로어북과 항목 CRUD |
| `use-scene.ts` | 장면 기획, 생성, 마무리 |
| `use-encounter.ts` | 전투 인카운터 초기화, 행동, 요약 |
| `use-autonomous-messaging.ts` | 자율 메시지 폴링과 예약 |
| `use-idle-detection.ts` | 10분 무활동 감지 |
| `use-background-autonomous.ts` | 비활성 채팅을 뒤에서 주기적으로 폴링 |
| `use-translate.ts` | 텍스트 번역 |
| `use-apply-regex.ts` | 메시지에 정규식 스크립트 실행 |
| `use-custom-tools.ts` | 사용자 지정 도구 CRUD, 순서 변경, 일괄 켜기/끄기 |
| `use-knowledge-sources.ts` | 지식 소스 관리 |
| `use-gallery.ts` | 채팅 갤러리 이미지 |
| `use-chat-folders.ts` | 채팅 폴더 CRUD와 순서 변경 |
| `use-regex-scripts.ts` | 정규식 스크립트 CRUD, 순서 변경, 일괄 전환 |
| `use-haptic.ts` | 햅틱 기기 연결과 명령 |

## 컴포넌트 안내

### 채팅 시스템(`components/chat/`)

채팅 시스템은 가장 규모가 큰 기능 영역입니다. `ChatArea.tsx`가 Conversation, Roleplay, Game Mode(게임 모드) 세 가지 렌더링 화면을 지연 로딩합니다.

#### Conversation 모드(`ChatConversationSurface.tsx`)

메신저 형태의 말풍선 채팅입니다. 사용자 메시지는 오른쪽, 어시스턴트 메시지는 왼쪽에 표시합니다. 기능은 다음과 같습니다.

- 무한 스크롤 페이지 처리(위로 스크롤하면 이전 메시지를 불러옵니다).
- 메시지별 동작: 편집, 복사, 재생성, 삭제, 분기, 프롬프트 미리보기.
- 첨부 지원(이미지와 파일).
- 이모지와 GIF 선택기.
- 슬래시 명령어.
- 새 메시지 알림음.
- 채팅별 임시 메시지 보존.

#### Roleplay 모드(`ChatRoleplaySurface.tsx`)

어둡고 몰입감 있는 RPG풍 인터페이스입니다. Conversation의 기능을 모두 갖추고 다음이 더해집니다.

- 표정 에이전트가 조종하는 캐릭터 스프라이트의 표정 변화.
- 세계 상태(시간, 장소, 날씨, 등장 캐릭터)를 보여 주는 Roleplay HUD.
- 날씨 효과(장면의 날씨에 맞춘 파티클 오버레이).
- echo chamber 패널(가상 시청자 반응).
- 턴제 행동 시스템을 갖춘 전투 인카운터.
- 활성화된 로어북 항목을 보여 주는 world info 패널.
- 짧은 롤플레이로 갈라지는 장면 시스템.
- 크로스페이드로 전환되는 배경 이미지.

#### Game Mode(`GameSurface.tsx`)

AI 게임 마스터(GM) 화면입니다. chat 폴더가 아니라 `components/game/GameSurface.tsx`에 있습니다. 채팅 모드가 `game`이면 `ChatArea.tsx`가 이 화면을 렌더링합니다. 전용 게임 스토어(`game-mode.store.ts`, `game-asset.store.ts`, `game-state.store.ts`)를 읽습니다. 세션, 주사위 굴림, 스킬 판정, 지도, 턴 스토리보드는 `use-game.ts`와 `use-game-storyboards.ts`의 훅으로 처리합니다.

#### 핵심 컴포넌트

- `ChatArea.tsx`: 전체를 조율하는 중심입니다. 모든 데이터(메시지, 캐릭터, 페르소나)를 가져오고, 캐릭터 맵을 만들고, 채팅 모드를 판별해 알맞은 화면을 렌더링합니다.
- `ChatMessage.tsx`: 메시지 하나를 마크다운, 스와이프 이동, 편집, 동작 메뉴와 함께 렌더링합니다. 편집 중 리렌더링을 피하려고 비제어 방식의 `EditTextarea` 하위 컴포넌트를 씁니다.
- `ChatInput.tsx`: 높이 자동 조절, 임시 메시지 보존, 슬래시 명령어 자동 완성, 첨부 처리, 이모지와 GIF 삽입을 지원하는 사용자 입력란입니다.

### 편집기 컴포넌트

리소스 종류마다 채팅 영역을 대신하는 전체 화면 편집기가 있습니다.

| 편집기 | 파일 | 담당 범위 |
| ----------------- | --------------------------------------------- | ------------------------------------------------------------------------------- |
| 캐릭터 편집기 | `components/characters/CharacterEditor.tsx` | 캐릭터 카드 필드, 아바타, 인사말, 성격, 시스템 프롬프트, 메타데이터 |
| 로어북 편집기 | `components/lorebooks/LorebookEditor.tsx` | 로어북 메타데이터, 키워드와 활성화 규칙과 주입 설정을 갖춘 로어북 항목 |
| 프리셋 편집기 | `components/presets/PresetEditor.tsx` | 프롬프트 섹션, 그룹, 마커, 생성 파라미터, 선택 블록 |
| 연결 편집기 | `components/connections/ConnectionEditor.tsx` | API 제공자, 기본 URL, 모델, 컨텍스트 창, 플래그 |
| 에이전트 편집기 | `components/agents/AgentEditor.tsx` | 에이전트 프롬프트 틀, 단계, 연결, 도구, 설정 |
| 페르소나 편집기 | `components/personas/PersonaEditor.tsx` | 이름, 설명, 능력치, 아바타를 갖춘 사용자 페르소나 |

### 창 시스템(`components/modals/`)

창은 `components/layout/ModalRenderer.tsx`가 렌더링합니다. `ui.store.modal`을 읽어 그에 맞는 컴포넌트를 `Suspense` 안에서 렌더링합니다. 창 컴포넌트는 `components/modals/` 아래에 있습니다.

현재 창 종류는 다음과 같습니다(전부는 아니고 대표적인 예입니다).

| 종류 | 컴포넌트 | 용도 |
| -------------------------- | ----------------------------- | ------------------------------------------ |
| `create-character` | `CreateCharacterModal` | 캐릭터 간단 생성(이름과 아바타) |
| `create-connection` | `CreateConnectionModal` | 연결 간단 생성 |
| `create-persona` | `CreatePersonaModal` | 페르소나 간단 생성 |
| `create-lorebook` | `CreateLorebookModal` | 로어북 간단 생성 |
| `create-preset` | `CreatePresetModal` | 프리셋 간단 생성 |
| `import-character` | `ImportCharacterModal` | 파일에서 가져오기(JSON 또는 PNG) |
| `import-connection` | `ImportConnectionModal` | 연결 패키지 가져오기 |
| `import-lorebook` | `ImportLorebookModal` | 파일에서 가져오기 |
| `import-preset` | `ImportPresetModal` | 파일에서 가져오기 |
| `import-persona` | `ImportPersonaModal` | 파일에서 가져오기 |
| `character-card-update` | `CharacterCardUpdateModal` | 에이전트가 제안한 카드 변화 검토 |
| `agent-write-approval` | `AgentWriteApprovalModal` | 에이전트 쓰기 동의와 검토 |
| `docs-viewer` | `DocsViewerModal` | 앱 안에서 보는 문서 |
| `st-bulk-import` | `STBulkImportModal` | SillyTavern 데이터 일괄 가져오기 |
| `about-me-viewer` | `AboutMeViewerModal` | Conversation 모드의 About Me 보기 |
| `scene-prompt-preferences` | `ScenePromptPreferencesModal` | 장면 프롬프트 선호 설정 |

창의 공통 규칙은 이렇습니다. 모든 창은 `{ open, onClose }`를 받고, 내용을 `Modal` 기본 컴포넌트로 감싸고, API 호출에는 뮤테이션을 쓰고, `mutation.isPending`으로 로딩 상태를 표시합니다.

<a id="panel-system-componentspanels"></a>

### 패널 시스템(`components/panels/`)

패널은 사이드바에서 Chats를 대신해 열리며 검색, 정렬, 필터를 갖춘 리소스 목록을 보여 줍니다. 리소스를 클릭하면 가운데 영역에 해당 편집기가 열립니다.

패널은 `RightPanel.tsx`의 두 곳에 등록합니다.

1. `PANEL_CONFIG`: 제목, 아이콘, 그라데이션 색.
2. `RIGHT_PANELS`(`right-panel-panels.ts`에 있음): 컴포넌트 맵.

패널은 `RightPanel` 안의 `useState`에 둔 `mountedPanels` Set으로 상태를 유지합니다. 이 Set은 열어 본 패널을 기록합니다. 한 번 마운트된 패널은 상태를 유지하도록 DOM에 남고 `display: none`이나 `aria-hidden`으로 숨깁니다. 이 Set은 `RightPanel`의 한 번의 마운트에 속하므로, 휴대전화 시트가 다시 열리는 것처럼 재마운트되면 현재 패널만 포함한 상태로 시작합니다.

### UI 기본 요소(`components/ui/`)

| 컴포넌트 | 설명 |
| ------------------------------ | ----------------------------------------- |
| `Modal` | 배경 클릭, Esc 키, 열림과 닫힘 애니메이션을 갖춘 기본 창 |
| `ColorPicker` | 프리셋 견본을 갖춘 단색 또는 그라데이션 색상 선택기 |
| `ExpandedTextarea` | 긴 텍스트를 편집하는 전체 화면 포털 오버레이 |
| `EmojiPicker` | 검색할 수 있는 이모지 팝오버(포털로 렌더링) |
| `GifPicker` | Giphy API를 이용한 GIF 검색 |
| `HelpTooltip` | 마우스를 올리면 포털 위치에 툴팁을 띄우는 아이콘 |
| `LibraryToolbar` | 모든 라이브러리 패널이 공유하는 도구 모음 |
| `EditorHeader` | 모든 전체 페이지 편집기가 공유하는 헤더(아래 참고) |

모든 UI 컴포넌트는 제어 방식 props(value와 onChange)를 쓰고, 오버레이는 포털로 렌더링합니다.

캐릭터, 페르소나, 로어북, 에이전트 패널과 Presets 패널의 각 탭은 `LibraryToolbar`로 상단 컨트롤을 표시합니다. 선택 사항인 라이브러리 행(전체 너비 버튼 하나 또는 Download와 Open Library 버튼 두 개), 만들기·가져오기·내보내기·선택, 공통 정렬 메뉴가 있는 검색, New Folder, `children`으로 받은 패널 필터 순입니다. 행을 타입이 지정된 props로 받으므로 새 라이브러리 패널도 같은 마크업을 사용합니다. 패널에 도구 모음을 따로 만들기보다 이 컴포넌트에 prop을 추가하세요.

`LibraryToolbar.tsx`는 `|`로 나뉜 하나의 긴 `.mari-chrome-segmented` 버튼인 `SegmentedButtons`도 내보냅니다. Download(다운로드) / Open Library(라이브러리 열기) 쌍과 Presets 패널의 **Prompts**(프롬프트) / **Regexes**(정규식) / **Tools**(도구) / **Profiles**(프로필) 탭을 그리므로, 모든 패널의 상단 행 높이가 같습니다. `groupLabel`을 전달하면 행이 탭으로 이루어진 `role="group"`이 되고, `pressed`는 각 탭의 `aria-pressed`를 설정합니다. `.mari-chrome-segmented`에는 `flex-shrink: 0`이 있어 Characters처럼 패널 자체의 높이가 고정된 flex 스크롤 영역도 행을 압축할 수 없습니다.

**전체 페이지 편집기는 `EditorHeader`를 사용합니다.** 뒤로 가기, 아이콘 타일, 이름, 선택적 섹션 탭, 작업 버튼, 닫기를 두 가지 레이아웃 중 하나로 표시합니다. `nav`(섹션 탭)가 있으면 `mari-editor-header--with-nav` 밀도 규칙이 탭에 맞춰 각 요소의 크기를 정합니다. 없으면 휴대전화에서는 작업 버튼이 별도 행에 놓이고 Save는 아이콘만 표시됩니다. 이름, 타일의 내용, 버튼은 슬롯이므로 각 편집기가 자체 이름 필드와 조작 버튼을 유지합니다. 헤더 버튼은 `EditorSaveButton`과 `EditorHeaderAction`으로 만드세요. 라벨은 항상 툴팁과 접근성 이름으로 모두 쓰입니다. 편집기에서 헤더를 직접 만드는 대신 여기에 슬롯이나 구성 요소를 추가하세요.

## API 클라이언트(`lib/api-client.ts`)

서버와의 통신은 모두 `api` 객체로 합니다.

```typescript
import { api, ApiError } from "@/lib/api-client";
```

| 메서드 | 시그니처 | 설명 |
| ------------------------------ | ------------------- | ------------------------------------- |
| `api.get<T>(path)` | `GET /api{path}` | JSON 가져오기 |
| `api.post<T>(path, body)` | `POST /api{path}` | JSON 보내고 JSON 받기 |
| `api.put<T>(path, body)` | `PUT /api{path}` | 전체 수정 |
| `api.patch<T>(path, body)` | `PATCH /api{path}` | 부분 수정 |
| `api.delete(path)` | `DELETE /api{path}` | 리소스 삭제 |
| `api.upload(path, FormData)` | `POST /api{path}` | 멀티파트 파일 업로드 |
| `api.download(path, filename)` | `GET /api{path}` | 다운로드와 다른 이름으로 저장 창 |
| `api.streamEvents(path, body)` | `POST /api{path}` | SSE 비동기 제너레이터(모든 이벤트 종류) |

오류는 `ApiError`로 던지며, 여기에는 `status`와 `message` 속성이 담깁니다.

## 선택기와 드롭다운

값을 고르는 컨트롤은 모두 공용 선택기 창을 엽니다. 표시 영역, 행 스타일, 너비 등 선택기의 디자인은 아래의 공용 컴포넌트에서 변경하세요. 앱에서는 기본 `<select>`와 기능별 팝오버의 자체 목록을 모두 없앴습니다.

| 계층 | 파일 | 담당하는 부분 |
| --- | --- | --- |
| 창 | `components/ui/PickerWindow.tsx` | 표시 영역입니다. 데스크톱에서는 필드 옆에서 행에 필요한 너비로 팝오버를 엽니다. 최소 필드 너비, 최대 352 px이며 필드가 더 넓으면 필드 너비까지 열립니다. 휴대폰에서는 하단 시트(`Modal`)입니다. `Modal` 안에서는 두 시트가 겹치지 않도록 팝오버로 유지합니다. Escape, 뒤로 가기, 바깥 클릭, 스크롤해서 필드가 보이지 않게 되면 닫힙니다. |
| 행 | `components/ui/PickerParts.tsx` | `PickRow`(이미지, 제목, 두 줄까지 줄바꿈되는 보조 텍스트, 배지, 체크 표시 또는 체크박스로 이루어진 한 행), `PickerSearch`, 폴더 머리글, `usePickerKeyboard`(방향키와 Enter)입니다. |
| 목록 | `components/ui/PickerFolderList.tsx` | 검색 상자, 라이브러리 폴더나 `group`에 따라 묶은 행, 단일 또는 다중 선택, 폴더마다 있는 "Add all"을 담는 본문입니다. |
| 필드 | `components/ui/Select.tsx` | `Select`는 고정 목록에서 값 하나를 고르는 기본 `<select>`의 대체품입니다. 콤보 상자 트리거, 선택지 `SELECT_SEARCH_MIN`개부터 검색, 닫힌 필드에서 방향키와 타이핑으로 이동을 지원합니다. |
| | `components/ui/PickerField.tsx` | `PickerField`(None 행과 폴더가 있는 단일 선택), `PickerListField` / `PickerListWindow`(다중 선택, 고른 항목은 필드 아래에 제거 버튼과 함께 표시), `useFieldWindow`(열린 상태와 닫을 때 필드로 포커스 복귀)입니다. |
| | `components/ui/LibraryPickers.tsx`, `components/characters/CharacterSelect.tsx` | 위 컴포넌트로 만든 프리셋, 로어북, 캐릭터, 페르소나 필드입니다. |

선택기를 추가하는 방법은 다음과 같습니다.

- **목록의 값 하나:** `Select`를 쓰세요. `label`이 필드 이름과 창 제목이 됩니다.
- **라이브러리 항목 하나**(폴더, 이미지, None 행 포함): `PickerField` 또는 `LibraryPickers.tsx`의 해당 필드를 쓰세요.
- **항목 여러 개:** `PickerListField`를 쓰세요. Escape나 바깥 클릭으로 창을 닫을 수 있으며, 항목을 골라도 닫히지 않습니다.
- **필드 이외의 컨트롤**("Link to Conversation"처럼 짧은 선택 목록을 여는 버튼): 열린 상태와 포커스에는 `useFieldWindow`를 쓰고, 버튼에 `PickerWindow`를 붙이고 내부에 `PickerFolderList` 또는 `PickRow`를 넣으세요.

연결 및 모델 선택기(`ConnectionSelect` / `ModelPicker`)는 아직 자체 창을 씁니다. 아이콘 갤러리(`StatIconPicker`), 태그 자동 완성, 컨텍스트 메뉴와 작업 메뉴에도 자체 표시 영역이 있으며 선택기에 해당하지 않습니다.

**테스트.** `Select` 트리거에는 `role="combobox"`와 선택 값을 담은 `data-value`가 있습니다. 창은 필드 레이블을 이름으로 쓰는 `dialog`입니다. 행마다 `data-pick-row`가 있습니다. 단일 선택에서 선택한 행에는 `aria-current="true"`가 있고, 다중 선택의 행에는 `aria-pressed`가 있습니다. `e2e/select-field.ts`의 `chooseOption`과 `pickerLabels`는 이전 기본 선택 요소에서 쓰던 Playwright의 `selectOption`을 대신합니다.

## 스타일 시스템

### Tailwind CSS v4

이 프로젝트는 `@tailwindcss/vite` 플러그인과 함께 Tailwind CSS v4를 씁니다(PostCSS 설정은 필요 없습니다). 테마 토큰은 `globals.css`의 CSS 사용자 지정 속성에서 매핑합니다.

```css
@theme {
  --color-primary: var(--primary);
  --color-background: var(--background);
  --color-border: var(--border);
  /* ... */
}
```

### 테마 구조

`globals.css`는 이름표를 붙인 여러 구역으로 나뉩니다. Tailwind `@theme` 매핑, 다크 테마 변수, 라이트 테마 재정의, 기본 리셋, 사용자 지정 커서, 스크롤 막대, 유리 패널, 발광 유틸리티, UI 컴포넌트, 키프레임 애니메이션이 여기에 들어갑니다. 나머지 구역은 채팅 애니메이션, 모드별 채팅 스타일, 스프라이트와 게임 HUD, 함수 호출 카드, 반응형 규칙, 가져온 SillyTavern 테마, 접근성 규칙, 성능 힌트를 다룹니다.

### 사용자 지정 테마

사용자 지정 테마는 직접 만들 수 있습니다. 테마 정의는 Marinara 서버에 저장하며 연결된 기기끼리 동기화됩니다. 현재 적용 중인 사용자 지정 테마도 함께 공유됩니다. CSS는 `CustomThemeInjector.tsx`가 `style` 태그로 주입합니다.

동기화된 테마 CSS는 `--marinara-theme-accent-pulse: enabled`로 기본 제공 Accent Pulse 엔진을 요청할 수 있습니다. 현재 **Appearance**(모양) 설정의 강조 색 대신 특정 테마 강조 색을 쓰려면 `--marinara-theme-accent-pulse-source: #a78bfa`(또는 그라데이션)를 함께 지정하세요.

### Personal Extensions

Personal Extensions는 서버에 저장하고 정확한 해시로 승인하는 샌드박스 코드입니다. Addons UI는 `use-personal-extensions.ts`를 씁니다. `PersonalExtensionInjector.tsx`는 승인된 Browser 코드를 불투명 출처의 샌드박스 iframe 안 전용 Worker에서 실행하고, 변경할 수 없는 현재 채팅 컨텍스트 스냅샷을 중계합니다. 컨텍스트 필드는 항상 존재합니다. 활성 채팅 밖에서는 `chatId`와 `characterId`가 `null`이고 `characterIds`는 비어 있습니다. 현재 캐릭터 카드와 선택된 페르소나의 제한된 필드를 쓰려면 해시에 묶인 권한을 따로 선언해야 합니다. 서버 확장은 별도의 Node 프로세스에서 macOS Seatbelt나 Linux Bubblewrap 안에서 실행되며, 둘 다 없으면 실행을 거부합니다. 외부 소스는 목록 표시, 승인, 실행의 각 경계마다 `.env` 게이트와 Danger Zone 옵트인이 모두 필요합니다.

이 기능을 고치기 전에 [Personal Extension 아키텍처](personal-extensions.md)를 읽어 보세요.

## 공유 패키지(`packages/shared`)

프런트엔드는 `@marinara-engine/shared`에서 타입, 스키마, 상수를 가져옵니다.

### 상수

`packages/shared/src/constants/`의 주요 파일입니다.

- `defaults.ts`: `APP_VERSION`, `PROFESSOR_MARI_ID`, `DEFAULT_CONNECTION_ID`, `DEFAULT_GENERATION_PARAMS`, `MAX_FILE_SIZES`, `LIMITS` 등을 내보냅니다. 버전의 기준이 되는 파일이며 기본 생성 설정도 여기에 있습니다.
- `providers.ts`: API 제공자 설정을 담은 `PROVIDERS`를 내보냅니다(OpenAI, Anthropic, Google 등). URL과 인증 정보가 들어 있습니다.
- `model-lists.ts`: 제공자별 고정 모델 목록과 이미지 생성 제공자용 `IMAGE_GENERATION_SOURCES`입니다.
- `agent-prompts.ts`: 기본 제공 요약 프롬프트와 secret plot 프롬프트, 그리고 설치된 에이전트 패키지가 제공하는 프롬프트를 런타임에 찾아 주는 기능입니다.

### 스키마(Zod)

입력 검증은 모두 `packages/shared/src/schemas/`의 Zod 스키마로 합니다. 대표적인 파일은 다음과 같습니다.

| 스키마 파일 | 대상 |
| ----------------------- | ------------------------------------------------------------------ |
| `agent.schema.ts` | AgentConfig 생성과 수정, 에이전트 단계, 결과 종류 |
| `character.schema.ts` | 캐릭터 카드, 호환성 메타데이터, 캐릭터 북, 그룹 |
| `chat.schema.ts` | 채팅 생성, 메시지 생성, 생성 요청 |
| `connection.schema.ts` | API 연결 생성과 수정 |
| `custom-tool.schema.ts` | 사용자 지정 도구 정의 |
| `lorebook.schema.ts` | 로어북과 항목 생성/수정, 활성화 조건, 스케줄 |
| `prompt.schema.ts` | 프리셋, 섹션, 그룹, 선택 블록, 생성 파라미터 |
| `regex.schema.ts` | 정규식 스크립트 생성과 수정 |
| `personal-extension.schema.ts` | Personal Extension 초안, 정확한 해시 승인, 되돌리기, 비공개 저장소 |

이 폴더에는 앱 설정, 채팅 설정 프로필, Conversation 통화, 사용자 지정 이모지와 스티커, Noodle, 테마의 스키마도 있습니다.

### 타입

엔티티 타입 정의는 `packages/shared/src/types/`에 있습니다. 주요 파일 몇 가지를 소개합니다.

| 타입 파일 | 주요 인터페이스 |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| `agent.ts` | `AgentConfig`, `AgentResult`, `AgentContext`, `ToolDefinition`, `ToolCall`, `ToolResult`, `BUILT_IN_AGENTS` |
| `character.ts` | `Character`, `CharacterCardV2`, `CharacterData`, `RPGStatsConfig` |
| `chat.ts` | `Chat`, `ChatMetadata`, `Message`, `MessageExtra`, `GenerationInfo`, `StreamEvent` |
| `connection.ts` | `APIConnection`, `ModelInfo`, `ModelCapabilities`, `ConnectionTestResult` |
| `combat-encounter.ts` | `CombatPartyMember`, `CombatEnemy`, `CombatActionResult`, `EncounterSettings` |
| `game-state.ts` | `GameState`, `PresentCharacter`, `PlayerStats`, `QuestProgress`, `InventoryItem` |
| `lorebook.ts` | `Lorebook`, `LorebookEntry`, `ActivationCondition`, `LorebookSchedule`, `QuestData` |
| `persona.ts` | `Persona`, `PersonaStatsConfig` |
| `personal-extension.ts` | `PersonalExtension`, 런타임 메타데이터, 리비전, 소스, 서버 런타임 상태 |
| `prompt.ts` | `PromptPreset`, `PromptSection`, `PromptGroup`, `ChoiceBlock`, `GenerationParameters` |
| `scene.ts` | `SceneMeta`, `SceneFullPlan` |
| `haptic.ts` | `HapticDevice`, `HapticStatus`, `HapticDeviceCommand` |

### 유틸리티

| 파일 | 용도 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `macro-engine.ts` | `resolveMacros(template, context)`: `{{date}}`, `{{char}}`, `{{random}}`, `{{roll:2d6}}`, `{{getvar::name}}` 같은 매크로를 치환합니다 |
| `xml-wrapper.ts` | `nameToXmlTag()`: 표시 이름을 XML 태그 슬러그로 바꿉니다("World Info (Before)"는 "world_info_before"가 됩니다) |

## API 엔드포인트

서버(`packages/server`)는 `/api` 아래에 REST API를 제공합니다. 아래는 전체 목록이 아니라 큰 그림입니다. 정확한 기준은 `packages/server/src/routes/index.ts` 파일과 개별 라우트 파일입니다.

### 핵심 리소스

| 접두사 | 메서드 | 설명 |
| -------------------- | ------------------------ | ----------------------------------------------------------------------------------------- |
| `/api/characters` | GET, POST, PATCH, DELETE | 캐릭터 CRUD, 그룹, 내보내기(JSON 또는 PNG) |
| `/api/chats` | GET, POST, PATCH, DELETE | 채팅 CRUD, 메시지, 메타데이터, 연결과 연결 해제 |
| `/api/prompts` | GET, POST, PATCH, DELETE | 프리셋 CRUD, 섹션, 그룹, 선택 블록, 내보내기 |
| `/api/connections` | GET, POST, PATCH, DELETE | API 연결 CRUD, 복제, 테스트 |
| `/api/agents` | GET, POST, PATCH, DELETE | 에이전트 CRUD, echo 메시지, 실행 기록. 기본 제공 에이전트 켜고 끄기는 `PUT /api/agents/toggle/:agentType` |
| `/api/lorebooks` | GET, POST, PATCH, DELETE | 로어북 CRUD, 항목, 내보내기 |
| `/api/custom-tools` | GET, POST, PUT, PATCH, DELETE | 사용자 지정 도구 CRUD, `PUT /reorder`, `PUT /enabled` |
| `/api/regex-scripts` | GET, POST, PUT, PATCH, DELETE | 정규식 스크립트 CRUD, `PUT /reorder`, `PUT /enabled` |
| `/api/library-folders/regex` | GET, POST, PATCH, DELETE | 정규식 폴더 CRUD, 일시 중지 상태, `POST /move` |
| `/api/library-folders/functions` | GET, POST, PATCH, DELETE | 사용자 지정 도구 폴더 CRUD, 일시 중지 상태, `POST /move` |


`PUT /api/regex-scripts/enabled`는 `scriptIds`와 `enabled`를 받습니다. ID가 하나라도 없으면 스크립트를 하나도 수정하지 않고 404를 반환합니다. 목록은 저장된 `enabled`와 별도로 `pausedByFolder`를 포함합니다. `PUT /api/custom-tools/enabled`는 `toolIds`를 받아 같은 방식으로 동작하며, 도구 목록에도 `pausedByFolder`가 들어갑니다. 일시 중지된 폴더의 도구는 모델에 제공하지 않습니다.

에이전트의 기억 도구는 `/api/agents/memory/:agentType/:chatId`를 씁니다. `agentType`은 에이전트 종류 문자열이고 `chatId`는 대상 채팅의 id입니다.

### 생성

| 엔드포인트 | 메서드 | 설명 |
| ---------------------------- | ------ | ---------------------------------------------------- |
| `/api/generate` | POST | 에이전트 파이프라인을 포함한 기본 SSE 생성 |
| `/api/generate/retry-agents` | POST | 호출 쪽이 지정한 에이전트 종류만 다시 실행하는 SSE |

### 채팅 기능

| 접두사 | 엔드포인트 | 설명 |
| ------------------------- | -------------------------------- | ---------------------------- |
| `/api/chat-folders` | CRUD와 순서 변경 | 채팅 폴더 관리 |
| `/api/conversation` | schedule, status, activity, autonomous | 자율 메시지 시스템 |
| `/api/scene` | create, plan, conclude | 장면 분기 |
| `/api/encounter` | init, action, summary | 전투 인카운터 |
| `/api/translate` | POST | 텍스트 번역 |
| `/api/game` | CRUD와 동작 | Game Mode 세션과 상태 |
| `/api/game-assets` | CRUD와 업로드 | 게임 에셋 |
| `/api/game-rulesets` | 가져오기, 스키마, 원본, 제거 | 가져온 Game Mode 규칙 집합 |
| `/api/game-worlds` | 라이브러리 CRUD와 세계 편집 | 새 게임과 지도 팩용 세계 라이브러리 |
| `/api/game-tile-packs` | 타일 팩, `/creatures`와 `/boards` 포함 | 지도, 크리처, 전투 보드 아트 팩 |
| `/api/turn-games` | catalog, state, start, move, resign | Conversation 테이블 게임(게임은 패키지에서 제공) |
| `/api/conversation-calls` | 통화와 세션 라우트(Conversation 통화 패키지가 등록) | Conversation 음성 통화 |

### 미디어와 에셋

| 접두사 | 설명 |
| ----------------------------- | ---------------------------- |
| `/api/avatars/file/:filename` | 아바타 이미지 제공 |
| `/api/backgrounds` | 배경 CRUD와 업로드 |
| `/api/sprites/:characterId` | 스프라이트 표정 관리 |
| `/api/fonts` | 사용자 지정 글꼴 관리 |
| `/api/gallery/:chatId` | 채팅별 갤러리 이미지 |
| `/api/global-gallery` | 전체 갤러리 이미지 |
| `/api/tts` | 음성 합성 라우트 |
| `/api/speech-to-text` | Speech to Text 서버 설정과 테스트 |
| `/api/avatar-models` | 아바타 에이전트용 2D 및 3D 아바타 모델 |
| `/api/avatar-generation` | 스프라이트로 만드는 아바타 초안과 Tripo 키 |
| `/api/avatar-classify` | 아바타 감정 분류기와 그 로컬 모델 |
| `/api/youtube` | YouTube DJ 라우트 |
| `/api/custom-emojis` | 사용자 지정 이모지 에셋 |
| `/api/custom-stickers` | 사용자 지정 스티커 에셋 |
| `/api/gifs/search` | GIF 검색(Giphy 프록시) |

### 외부 연동

| 접두사 | 설명 |
| ------------------------------- | ---------------------------- |
| `/api/bot-browser/chub/*` | Chub 캐릭터 검색 |
| `/api/bot-browser/janny/*` | JannyAI 검색 |
| `/api/bot-browser/pygmalion/*` | Pygmalion 검색 |
| `/api/bot-browser/wyvern/*` | Wyvern 검색 |
| `/api/bot-browser/datacat/*` | DataCat 검색 |
| `/api/haptic/*` | 햅틱 기기 제어 |
| `/api/spotify/*` | Spotify 인증 |
| `/api/knowledge-sources` | 검색에 쓰는 지식 베이스 |

### 시스템

| 엔드포인트 | 설명 |
| ------------------------------- | --------------------------------------- |
| `/api/updates/check` | GitHub 릴리스와 버전 비교. Git 설치본은 업데이트 채널보다 얼마나 뒤처졌는지도 확인 |
| `/api/updates/channel` | 업데이트 채널, 현재 브랜치, 채널 목록 |
| `/api/updates/apply` | 업데이트 적용 |
| `/api/backup` | 전체 백업, 내보내기, 가져오기 |
| `/api/import/*` | SillyTavern과 Marinara 프로필 가져오기 |
| `/api/admin/clear-all` | 전체 데이터 삭제 |
| `/api/themes` | 동기화되는 사용자 지정 테마 |
| `/api/personal-extensions` | 샌드박스 확장의 정책, 초안, 승인, 런타임, 비공개 저장소 |
| `/api/app-settings` | 서버 쪽 앱 설정 |
| `/api/sidecar` | 로컬 모델 런타임 |
| `/api/chat-presets` | 채팅 설정 프로필(엔드포인트 이름은 예전 그대로) |
| `/api/connection-folders` | 연결 폴더 |
| `/api/prompt-overrides` | 기본 제공 프롬프트 재정의 |
| `/api/achievements` | 업적 해제 |
| `/api/capability-packages` | 에이전트 카탈로그, 설치, 업데이트, 릴리스 노트, 패키지 에셋 |
| `/api/noodle` | Noodle 소셜 타임라인(Noodle 패키지가 등록) |
| `/api/professor-mari/workspace` | Professor Mari 작업 공간 관련 동작 |
| `/api/professor-mari/quick` | Professor Mari 빠른 답변과 그 편집 제안 적용 |

## PWA 지원

이 앱은 VitePWA로 구성한 PWA(Progressive Web App)입니다.

- 매니페스트: `public/manifest.json`. 앱 이름은 "Marinara Engine", 표시 모드는 standalone, 테마는 다크입니다.
- 아이콘: 64px 파비콘, 192px과 512px maskable 아이콘, 스플래시 로고.
- 서비스 워커: Workbox의 `registerType: "prompt"`를 사용합니다. 새 버전은 사용자가 수락할 때까지 기다립니다.
- 캐싱: 정적 에셋은 캐시하고 `/api/*` 라우트는 NetworkOnly를 씁니다.
- 연결 유지: `lib/keep-alive.ts`가 Web Locks API와 BroadcastChannel 핑으로 탭이 잠들지 않게 합니다.

### 버전 불일치 감지

`App.tsx`는 5분마다 `/api/health`를 폴링합니다. 서버 버전이 클라이언트에 캐시된 버전과 다르면 `lib/browser-runtime.ts`의 `forceRefreshSpa`로 클라이언트를 새로고침합니다. 이 함수는 서비스 워커 등록을 해제하고 캐시를 비웁니다.

## 에이전트 시스템

에이전트 시스템은 설정 가능한 파이프라인을 거쳐 AI 응답을 처리합니다. 에이전트는 세 단계로 실행됩니다.

1. 생성 전: 주 LLM 호출 이전입니다(예: 컨텍스트 주입, 지식 검색).
2. 병렬: 주 생성과 동시에 실행됩니다(예: 세계 상태 추적, 전투).
3. 후처리: 주 응답이 끝난 뒤입니다(예: 문장 다듬기, 로어북 갱신).

재시도 요청은 명시적인 `agentTypes` 목록과 함께 `/api/generate/retry-agents`로 갑니다. **Re-run Trackers**(트래커 재생성) 같은 넓은 범위의 UI 동작은 활성화된 트래커 종류를 전부 넘깁니다. 위젯 하나의 컨트롤은 해당 트래커만 넘깁니다.

Narrative Director의 Secret Plot 패널처럼 에이전트의 기억을 다루는 도구는 `/api/agents/memory/:agentType/:chatId`를 씁니다. 이 라우트는 채팅별 기억을 저장하도록 설정된 에이전트에 적용됩니다. Secret Plot 기억은 현재 설정에서 `director` 아래에 저장하며, 예전 채팅을 위해 `secret-plot-driver`도 계속 받아들입니다.

### 공식 다운로드 에이전트

가벼운 Engine은 런타임 에이전트 목록이 빈 상태로 출고됩니다. 공개 [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) 카탈로그에서 설치한 패키지가 검증된 에이전트 매니페스트, 클라이언트와 서버의 기능 진입점, UI 슬롯을 런타임에 추가합니다. 호환을 위해 활성 정의를 `BUILT_IN_AGENTS`로 노출하지만, 실제 내용은 번들에 포함된 구현이 아니라 설치된 패키지에서 옵니다. 공식 카탈로그에는 다음 패키지가 들어 있습니다.

| 에이전트 | 단계 | 하는 일 |
| ------------------------ | --------------- | ----------------------------------------------------------------- |
| `prose-guardian` | post_processing | 글의 품질을 관리합니다(반복 억제, 설명 대신 묘사) |
| `continuity` | post_processing | 앞뒤가 맞지 않는 부분을 찾아내고 고쳐 쓸 방향을 제시합니다 |
| `director` | pre_generation | 이야기 방향과 선택적인 Secret Plot 상태를 주입합니다 |
| `echo-chamber` | parallel | 관객 반응을 흉내 냅니다 |
| `world-state` | post_processing | 서술에서 날짜, 시간, 장소, 날씨를 뽑아냅니다 |
| `expression` | post_processing | 캐릭터 스프라이트의 표정을 고릅니다 |
| `quest` | post_processing | 퀘스트 생성, 갱신, 완료를 추적합니다 |
| `background` | post_processing | 장면에 어울리는 배경 이미지를 고릅니다 |
| `character-tracker` | post_processing | 캐릭터 상태 변화를 추적합니다 |
| `persona-stats` | post_processing | 플레이어 페르소나의 능력치 변화를 추적합니다 |
| `custom-tracker` | post_processing | 사용자가 정의한 구조화 상태를 추적합니다 |
| `inventory-tracker` | post_processing | 화폐, 장착 장비, 소지품을 추적합니다 |
| `quartermaster` | post_processing | Roleplay 캐릭터 시트, 장착 장비, 의상을 관리합니다 |
| `beholder` | post_processing | 각 캐릭터가 입고 있는 것과 들고 있는 것, 부상을 추적합니다 |
| `relationship-tracker` | post_processing | 캐릭터들과 페르소나가 서로를 어떻게 느끼는지 추적합니다 |
| `memory-nag` | post_processing | 약속 같은 미해결 사항을 기억해 두었다가 모델에게 상기시킵니다 |
| `illustrator` | post_processing | 장면 이미지 프롬프트와 미디어 요청을 만듭니다 |
| `lorebook-keeper` | post_processing | 로어북 항목을 자동으로 만들고 갱신합니다 |
| `card-evolution-auditor` | post_processing | 캐릭터 카드를 살펴 변화를 제안합니다 |
| `combat` | parallel | 전투 라운드, HP, 선공권, 결과를 추적합니다 |
| `html` | post_processing | 완성된 Roleplay 응답을 고쳐 써서 이야기에 녹아든 HTML 연출을 넣습니다 |
| `spotify` | post_processing | Music DJ 재생을 제어합니다(Spotify, YouTube, 로컬 음악) |
| `knowledge-retrieval` | pre_generation | 지식 소스에서 컨텍스트를 가져옵니다 |
| `knowledge-router` | pre_generation | 관련 있는 로어북 항목과 지식 항목을 골라 보냅니다 |
| `long-term-memory` | feature | 장기 메모리를 저장하고 관련 컨텍스트를 불러옵니다 |
| `haptic` | post_processing | 햅틱 기기 명령을 보냅니다 |
| `cyoa` | post_processing | 선택지 프롬프트를 만듭니다 |
| `storyboard` | post_processing | Game과 Roleplay의 정지 또는 애니메이션 스토리보드를 계획합니다 |
| `2d-avatars` | feature | 움직이는 2D 스프라이트나 메시 캐릭터 아바타를 렌더링합니다 |
| `3d-avatars` | feature | 움직이는 VRM, MMD PMX, GLB, FBX 3D 아바타를 렌더링합니다 |
| `conversation-calls` | feature | Conversation에 음성/영상 통화와 관련 설정을 추가합니다 |
| `hierarchical-maps` | feature | Roleplay와 Game에 지도, 공간 컨텍스트, 이동을 추가합니다 |
| `noodle` | feature | Home에 로컬 Noodle 소셜 피드를 추가합니다 |
| `otome-forge` | feature | 캐릭터로 만드는 오토메 게임인 Otome Hearth를 Home에 추가합니다 |
| `saucelings` | feature | 캐릭터가 키우는 가상 펫인 Saucelings를 Home에 추가합니다 |
| `slurp2` | feature | 캐릭터를 위한 비공개 크리에이터 앱인 Slurp를 Home에 추가합니다 |
| `story-writer` | feature | 함께 책을 쓰는 작업 공간인 Story Writer를 Home에 추가합니다 |
| `gacha-forge` | feature | Home에 가챠 게임 모드를 추가합니다 |
| `blackjack` | feature | Conversation에 Blackjack 테이블을 추가합니다 |
| `uno` | feature | Conversation에 UNO 테이블을 추가합니다 |
| `chess` | feature | Conversation에 Chess 판을 추가합니다 |
| `poker` | feature | Conversation에 Texas Hold'em 테이블을 추가합니다 |
| `eightball` | feature | Conversation에 8-Ball Pool 테이블을 추가합니다 |
| `tic-tac-toe` | feature | Conversation에 Tic-Tac-Toe 판을 추가합니다 |
| `rock-paper-scissors` | feature | Conversation에 Rock-Paper-Scissors 대결을 추가합니다 |
| `wordle` | feature | Conversation에 매일 하는 Wordle 경주를 추가합니다 |

### 에이전트 결과 종류

에이전트는 프런트엔드가 처리하는 타입이 정해진 결과를 내놓습니다. `packages/shared/src/types/agent.ts`의 `AgentResultType` 유니언에는 다음이 들어 있습니다.

`game_state_update`, `text_rewrite`, `sprite_change`, `echo_message`, `quest_update`, `image_prompt`, `context_injection`, `continuity_check`, `director_event`, `lorebook_update`, `character_card_update`, `character_card_create`, `background_change`, `character_tracker_update`, `persona_stats_update`, `custom_tracker_update`, `inventory_tracker_update`, `spotify_control`, `youtube_control`, `local_music_control`, `haptic_command`, `cyoa_choices`, `secret_plot`, `game_master_narration`, `party_action`, `game_map_update`, `game_state_transition`, `prompt_patch`, `character_activity_update`, `frontend_theme_update`, `about_me_update`, `memory_nag`.

## 채팅 모드

### Conversation 모드

AI 캐릭터 한 명 또는 여러 명과 나누는 평범한 대화입니다. 캐릭터마다 상태(온라인, 자리 비움, 방해 금지, 오프라인)를 다르게 둘 수 있고, 이 상태가 응답 시점과 말투에 영향을 줍니다. 기본 제공 에이전트는 전역이 아니라 채팅마다 추가합니다.

### Roleplay 모드

세계 상태를 추적하는 몰입형 서사 경험입니다. 장면 컨텍스트(장소, 시간, 날씨), 캐릭터의 등장 여부와 기분, 플레이어 능력치, 인벤토리와 퀘스트, 전투 인카운터, 로어북에서 온 world info, 스프라이트 표정을 다룹니다.

### Game Mode

파티원, 주사위, 세계 상태, 에셋, 스토리보드, 일지, 그리고 정해진 세션 흐름을 갖춘 AI 게임 마스터 세션입니다. Game Mode는 세계 상태, 에셋, 테이블 게임, 장면 동영상, 스토리보드를 위한 전용 스토어와 라우트를 씁니다. 사용자 입장에서 본 진행 방법은 [Game Mode: 시작하기](../game/getting-started.md)를 참고하세요.

## 개발

### 명령

의존성을 설치합니다.

```bash
pnpm install
```

서버와 클라이언트를 핫 리로드로 실행합니다.

```bash
pnpm dev
```

클라이언트 개발 서버만 실행합니다.

```bash
pnpm dev:client
```

API 서버만 실행합니다.

```bash
pnpm dev:server
```

기본 검증을 실행하세요(Prettier, ESLint, 타입 검사, 운영 빌드). 메모리가 적은 컴퓨터에서는 `MARINARA_CHECK_JOBS=1`을 설정하세요.

```bash
pnpm check
```

배포용으로 빌드합니다.

```bash
pnpm build
```

### 번들 예산

- 메인 엔트리: 최대 1 MB.
- 청크별: `chunkSizeWarningLimit`는 512 KB입니다. 넘으면 빌드가 경고를 출력하고 계속 진행합니다.
- 벤더 분리: react, tanstack, motion, zustand, icons, misc.

### 경로 별칭

TypeScript 설정과 Vite 설정 모두에서 `@/*`는 `./src/*`로 해석됩니다.

## 관련 가이드

- [아키텍처 지도(개발자용)](architecture-map.md)
- [파일 네이티브 저장소](file-storage.md)
