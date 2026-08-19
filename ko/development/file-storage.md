# 파일 네이티브 저장소

이 가이드에서는 Marinara Engine이 데이터를 로컬에 보관하는 구조를 설명합니다. 화면에서 보이는 폴더 구성은 [Marinara가 데이터를 저장하는 위치](../data/where-data-is-stored.md)에서 다룹니다.

## 원본 데이터의 기준

Marinara는 앱의 데이터 행을 JSON 스냅샷 형태로 `DATA_DIR/storage` 아래에 저장합니다.

```text
storage/
├── manifest.json
└── tables/
    ├── chats.json
    ├── characters.json
    ├── messages/
    │   ├── <encoded-chat-id>.json
    │   └── ...
    ├── message_swipes/
    │   └── <encoded-chat-id>.json
    └── ...
```

`FILE_STORAGE_DIR`로 `storage` 폴더 위치를 바꿀 수 있습니다. 테이블 파일 하나에는 JSON 배열 하나가 들어갑니다. `manifest.json`에는 저장 형식 버전, 저장 시각, 백엔드 식별자, 그리고 등록된 모든 테이블의 행 수가 기록됩니다.

### 샤딩된 테이블

턴마다 기록되는 채팅별 테이블은 하나의 큰 파일이 아니라 **채팅마다 한 파일**로 저장됩니다. 단일 파일 방식에서는 행 하나를 저장할 때마다 모든 채팅의 전체 기록을 다시 직렬화하고 써야 하기 때문입니다. 저장 형식 3은 `messages`와 `message_swipes`를 샤딩했고, 형식 4는 같은 구조를 `memory_chunks`, `chat_images`, `agent_runs`, `agent_memory`, `conversation_call_sessions`, `conversation_call_messages`, `game_state_snapshots`, `game_engine_state`, `game_checkpoints`, `game_turn_storyboards`, `game_scene_videos`, `spatial_context_snapshots`, `ooc_influences`, `conversation_notes`까지 확장합니다. 기준 목록은 `file-backed-store.ts`의 `SHARDED_TABLES`이며 `scripts/protect-launcher-data.mjs`의 오프라인 `unshard` 명령에도 반영되고, 회귀 테스트가 두 목록의 일치를 고정합니다. 각 테이블은 자체 `chatId` 열로 샤드를 정하지만, `message_swipes`는 상위 메시지를 거치고 influence와 note는 `targetChatId`를 사용합니다. `lorebooks`와 `game_turn_storyboard_keyframes`는 의도적으로 단일 파일을 유지합니다.

변경 추적은 채팅 파일 단위로 작동하므로 플러시는 변경된 채팅만 건드립니다. 샤드의 행 수가 0이 되면 빈 배열로 쓰지 않고 삭제합니다. 파일 이름은 채팅 ID를 퍼센트 인코딩하며 너무 길거나 예약된 이름에는 해시 대체 경로를 사용합니다. 가져온 프로필은 임의의 ID를 가질 수 있으므로 이 인코딩은 보안 경계입니다. 파일은 컨테이너일 뿐이며 행은 자체 키를 유지합니다.

새로 샤딩된 테이블이 있는 빌드를 처음 시작하면 기존 단일 파일은 자동으로 마이그레이션됩니다. 행을 채팅별로 묶어 샤드에 쓴 뒤 단일 파일**과 그 `.bak`**을 `.pre-shard`로 이름을 바꿉니다. 이 파일들은 마이그레이션 전 자동 백업이며 Engine은 절대 삭제하지 않습니다. `.migrating` 센티널은 크래시 복구의 기준을 분명히 합니다. 이전 빌드가 나중에 샤드 옆에 단일 파일을 다시 만들면 샤드가 우선하고 충돌 파일은 타임스탬프가 붙은 `.post-downgrade-` 접미사로 격리되며 합쳐지지 않습니다. 고아 하위 행은 버리지 않고 `orphaned-rows` 샤드에 둡니다. 더 새로운 저장 형식으로 작성된 매니페스트는 로드를 거부합니다.

## 실행 중 동작 방식

`packages/server/src/db/file-backed-store.ts`가 시작 시점에 테이블 스냅샷을 메모리로 읽어 들입니다. 서버는 `db/file-query.ts`가 제공하는 파일 네이티브 연산으로 그 행들을 읽고 바꿉니다. `db/schema/`에 정의된 내용에 필요한 테이블 및 열 메타데이터는 `db/file-schema.ts`가 이름 충돌 없이 만들어 줍니다.

`select`, `insert`, `update`, `delete`를 체인으로 잇는 API 덕분에 저장소 서비스 코드가 짧게 유지되며, 외부 데이터베이스나 ORM에 의존하지 않습니다. 사용할 수 있는 필터와 정렬은 모두 명시적인 표현식 객체입니다. 즉, 저장소가 질의 문자열을 해석하는 일은 없습니다.

테이블은 `fileTable(..., { uniqueBy: [...] })`로 자연 키를 선언합니다. 삽입과 갱신은 메모리의 행을 바꾸기 전에 변경 후보 전체를 놓고 기본 키와 선언된 자연 키를 검사합니다. 따라서 제약 조건을 어기면 테이블은 손대지 않은 상태로 남습니다. 일부 행에만 고유성을 적용해야 할 때는 규칙에 `when` 조건을 넣을 수 있습니다.

다운로드한 기능 패키지가 자체 파일 테이블 인스턴스를 가지고 올 수도 있습니다. 저장소는 객체 동일성을 먼저 확인한 뒤 등록된 테이블 이름으로 그 인스턴스를 찾습니다. 덕분에 패키지가 소유한 저장소 코드도 Engine 테이블을 안전하게 사용할 수 있습니다.

## 저장과 복구

쓰기가 일어나면 해당 테이블에 변경 표시가 붙습니다. 짧은 디바운스가 비슷한 시점의 변경을 하나로 묶고, 안전장치 타이머가 주기적으로 대기 중인 작업을 기록합니다. 정상 종료 시에는 진행 중인 쓰기를 기다린 다음, 그 쓰기 도중에 바뀐 행까지 저장합니다.

스냅샷은 임시 파일에 기록하고 디스크에 반영한 뒤 원자적으로 이름을 바꿉니다. 파일을 교체하기 전에는 직전의 정상 스냅샷을 `.bak` 파일로 갱신해 둡니다. 시작할 때 원본 파일을 읽을 수 없으면 가능한 범위에서 백업으로 복구합니다. 두 파일 모두 쓸 수 없으면 Marinara는 손상된 파일에 시각 표시를 붙여 격리하고, 해당 테이블만 빈 상태로 시작합니다. 복구 작업을 할 수 있도록 화면을 계속 열어 두기 위해서입니다.

## 트랜잭션

트랜잭션은 `AsyncLocalStorage`로 범위를 지정한 기록 시 복사(copy-on-write) 스냅샷을 사용합니다. 테이블은 해당 트랜잭션이 처음 그 테이블을 바꿀 때만 복제합니다. 콜백에서 오류가 발생하면 그 트랜잭션이 바꾼 테이블만 되돌리고, 동시에 일어난 다른 쓰기는 그대로 유지됩니다.

## 테이블 추가하기

저장이 필요한 데이터를 새로 넣을 때는 다음과 같이 진행하세요.

1. `packages/server/src/db/schema/`에 `fileTable`과 파일 네이티브 열 빌더로 테이블을 정의하세요.
2. `db/schema/index.ts`에서 내보내세요.
3. 자연 키가 있으면 `uniqueBy` 테이블 옵션으로 선언하세요.
4. 테이블 이름을 `FILE_BACKED_TABLES`에 등록하세요.
5. 필요하다면 `file-backed-store.ts`에 연쇄 삭제나 널 설정 관계를 정의하세요.
6. 텍스트 필드에 구조화된 JSON이 들어간다면 `services/mari-db/mari-db.service.ts`에 JSON 열 메타데이터를 추가하세요.
7. 프로필 백업과 복원이 제대로 동작하는지 확인하세요.
8. `pnpm check`와 관련 저장소 회귀 테스트를 실행하세요.

테이블 정의, 관계 메타데이터, 프로필 이식성, Mari DB 검증은 같은 변경 안에서 함께 맞춰 두세요.
