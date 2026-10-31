# Game Mode(게임 모드) 아키텍처: 규칙 집합, 판정과 전투

Game Mode의 규칙 코드를 변경하려는 개발자를 위해 규칙 집합을 읽는 위치, 판정과 전투를 처리하는 방식, 상태를 보관하는 위치, 새 규칙 집합 키에 필요한 사항을 안내합니다. 플레이어 문서는 `docs/game/`에 있고, 규칙 집합 작성자 가이드는 [`docs/extending/writing-rulesets.md`](../extending/writing-rulesets.md)에서 시작하며, 전투 AI는 별도의 [Game Mode 전투 AI](game-combat-ai.md) 페이지에서 다룹니다.

## 구성 요소의 위치

| 영역 | 코드 |
| --- | --- |
| 규칙 집합 형식 | `packages/shared/src/schemas/ruleset.schema.ts`: zod 스키마, `RulesetRef`(고정 참조), 가져오기 시 실행하는 교차 검사입니다. 편집기용 JSON Schema인 `docs/extending/ruleset.schema.json`은 `pnpm ruleset:schema`로 이 스키마에서 생성합니다. |
| Capability API | `packages/shared/src/schemas/capability-package.schema.ts`의 `supportedCapabilityApi`이며, 각 마이너 버전에 추가된 내용을 설명하는 주석이 버전마다 한 줄씩 있습니다. |
| 시트 계산과 실시간 상태 | `packages/shared/src/features/rulesets/`: `sheet-math.ts`, `live-state.ts`(`[sheet:]` 연산), `sheet-commands.ts`, `sheet-builder.ts`, `layers.ts`, `item-*.ts`, `loot.ts`, `market.ts`, `combat-bridge.ts`(`battle` 블록)입니다. |
| 규칙 집합 전투 | `packages/shared/src/features/ruleset-combat/`: `resolve.ts`, `options.ts`(메뉴의 선택지), `grid.ts`, `sight.ts`, `zones.ts`, `creatures.ts`, `pool.ts`, `symbols.ts`, `dice.ts`입니다. 모두 `(definition, state)`에 대해 동작하는 순수 함수 코드입니다. |
| Marinara 자체 전투 | `packages/shared/src/features/tactical-combat/`(Tactical 엔진, 격자 생성, AI), `combat-director.ts`, `combat-conditions.ts`입니다. |
| 전투 AI | `packages/shared/src/features/combat-ai.ts`, `combat-minds.ts`입니다. [Game Mode 전투 AI](game-combat-ai.md)를 참고하세요. |
| 서버: 규칙 집합 | `packages/server/src/services/game/ruleset-registry.service.ts`(설치한 규칙 집합과 가져온 규칙 집합을 읽고 게임의 고정 참조를 해석), `ruleset-catalog.service.ts`, `ruleset-sheet-turn.service.ts`(턴의 `[sheet:]` 명령 적용), `game-ruleset-version.service.ts`, `routes/game-rulesets.routes.ts`입니다. |
| 서버: 판정과 주사위 | `skill-check-resolution.service.ts`, `skill-check.service.ts`, `dice.service.ts`, `dice-pool.service.ts`, `one-request-dice.ts`, `dice-rng.ts`입니다. |
| 서버: 전투 | `combat-director.service.ts`(Classic과 Tactical), `combat.service.ts`(Classic 라운드 계산, `resolveCombatRound`), `ruleset-combat-director.service.ts`(규칙 집합이 판정하는 전투), `combat-ai.service.ts`, `combat-boss.service.ts`, `tactical-battlefield.service.ts`, `made-battlefield.service.ts`입니다. 라우트는 `routes/combat-director.routes.ts`(디렉터의 시작, 상태와 명령), `routes/encounter.routes.ts`, 그리고 `routes/game.routes.ts`의 기존 `POST /game/combat/round`, `/game/combat/tactical/start`, `/game/combat/tactical/action`입니다. |
| 프롬프트 | `gm-prompts.ts`(`buildGmFormatReminder`, 시트 블록과 모델에 알려 주는 태그)입니다. |
| 클라이언트 | `packages/client/src/components/game/`: `GameRulesetSheet.tsx`, `GameSetupRulesChooser.tsx`, `RulesetCombatScreen.tsx`와 나머지 `RulesetCombat*.tsx`, `TacticalCombatUI.tsx`, `GameCombatUI.tsx`, `DirectedCombatUI.tsx`입니다. |

## 패키지에서 게임까지의 규칙 집합 처리

1. **출처.** 공식 규칙 집합은 `ruleset` 종류의 기능 패키지로, `ruleset.json`(및 모든 `catalogs/<id>.json`)을 `contributions.assets.paths`에 나열하고 `files[]`에서 해시로 고정합니다. 커뮤니티 규칙 집합은 단일 파일, `<name>.ruleset.json` 패키지 파일 또는 저장소의 `rulesets/` 폴더에서 가져오며, 네임스페이스가 있는 ID(`local/<id>`, `<owner>/<id>`)로 저장하므로 공식 규칙 집합을 가리는 일은 절대 없습니다.
2. **언어.** 공식 규칙 집합의 번역은 카탈로그 항목에 나열된 언어별 팩입니다. 패키지 관리자는 Engine의 언어만 보관합니다(`package-manager.service.ts`의 `syncRulesetLocalePack`). 가져온 패키지 파일은 가져올 때 활성화된 언어만 보관합니다.
3. **레지스트리.** `ruleset-registry.service.ts`는 공유 스키마로 모든 정의를 파싱하고, 사용할 수 없는 정의는 로그 한 줄을 남기고 제외합니다. 정의는 ID와 버전별로 저장하며, 같은 버전인데 바이트가 다르면 거부합니다.
4. **고정 참조.** 게임을 만들 때 `chat.metadata.gameRuleset`에 `{ id, version, packageId, source?, options }`를 한 번 기록합니다. `options`에는 선택한 레이어가 들어갑니다. 고정 참조가 없으면 Marinara 자체 규칙을 사용합니다. 현재 설치에서 충족할 수 없는 고정 참조(규칙 집합이 없거나 고정 버전보다 오래된 경우)는 이를 알리고 게임의 판정을 미결 상태로 남깁니다. 다른 시스템의 규칙으로 판정하는 일은 절대 없습니다.

## 상태

| 부분 | 내용 | 위치 | 스와이프 시 되감기 |
| --- | --- | --- | --- |
| 시작 빌드 | 플레이어가 카드나 페르소나에 작성하는 시트 | 카드의 `data.extensions.rulesetSheets[rulesetId]`, 페르소나의 `personaStats.rulesetSheets[rulesetId]` | 해당 없음 |
| 게임 빌드 | 설정 시 복사하여 **Edit sheet**(시트 편집)와 레벨 업으로 수정하는 사본 | `chat.metadata.gameCharacterCards[].rulesetSheet` | 아니요 |
| 실시간 상태 | 풀, 트랙, 상태, 상태 값, 메모 | `game_state_snapshots.ruleset_live` | 예 |
| 전투 | 조우, 조우의 시드와 주사위 커서, 현재 턴의 주인 | 전투 디렉터의 저장 행, 채팅당 하나 | 전투를 시작한 턴과 함께 복원 |

실시간 상태는 스냅샷에 속하므로 재생성한 턴에서 두 번 소비하는 일은 절대 없습니다. 저장된 시트는 `{ v, build }`이며 최대 64 KB로 제한됩니다. 읽을 때는 알 수 없는 필드를 유지하고 누락된 필드에 기본값을 적용하는 관대한 방식을 사용합니다. 값을 새 ID로 옮기는 레이아웃은 `sheet.migrations`를 선언하며, 읽을 때 `readRulesetSheetEnvelope`와 `readStoredLiveState`가 이를 적용합니다. 설치되지 않은 규칙 집합의 시트는 비활성 상태로 보관하며 절대 버리지 않습니다.

## 판정의 전체 처리 과정

1. Game Master는 `[skill_check: …]`를 작성하며, 선택적으로 `who=`, `with=`, 난이도 단계 이름, 참 또는 자원 소비를 함께 지정합니다. 단일 요청 주사위가 켜져 있으면 대신 분기 블록이나 `[[roll: …]]` 자리 표시자를 작성할 수 있습니다(`one-request-dice.ts`).
2. `skill-check-resolution.service.ts`는 고정된 규칙 집합을 읽고 `resolution.kind`에 따라 `dice-sum`, `dice-pool`, `dice-highest`, `roll-against`, `symbol-pool`로 처리를 분기합니다. 규칙 집합이 보증하지 않는 한 모델이 작성한 수치는 검증 후 대체합니다. 풀, 유지한 주사위와 구간별 결과는 절대 보증하지 않습니다.
3. 주사위: 판정은 `rollDieSecurely`(`packages/shared/src/utils/dice-notation.ts`의 Web Crypto)를 사용해 굴립니다. 규칙 집합 전투와 그 안의 아이템 사용, 전리품, 시장은 같은 모듈의 `seededDieRoller(seed, cursor)`로 굴리므로 시드에서 전투를 재생할 수 있습니다. #8608 이후로 다른 주사위 굴림 함수는 없습니다.
4. 결과는 완성된 태그와 주사위 카드로 다시 기록하고 **Logs**(로그)에도 남깁니다.

## 시트 명령

Game Master는 `[sheet: who="Name" op="…"]`로 시트를 변경합니다. 태그에 지정할 수 있는 연산은 `spend`, `restore`(별칭 `heal`), `damage`, `temp`, `track`, `condition`, `state`, `note`, `rest`, `use`(별칭 `cast`), `pass`, `advance`, `dismiss`, `prepare`, `unprepare`입니다(`live-state.ts`의 `RULESET_SHEET_OP_NAMES`와 `RulesetSheetOp`). `ruleset-sheet-turn.service.ts`는 각 연산을 실시간 시트에 맞춰 검증합니다. 남은 슬롯이 없는데 시전하는 것처럼 실행할 수 없는 연산은 거부하고 로그에 남겨 턴마다 한 번 알리며, 어떤 연산도 일부만 적용하지 않습니다. `sheet`는 예약된 GM 태그입니다.

## 전투의 전체 처리 과정

게임의 전투는 규칙 집합과 게임의 **Combat Preference**(전투 방식 설정)에 따라 세 가지 방식 중 하나로 진행됩니다.

| 규칙 집합 | 방식 | 서버 |
| --- | --- | --- |
| 없거나 `battle`/`combat` 블록이 없음 | Marinara의 Classic 또는 Tactical 전투 | `combat-director.service.ts` |
| `battle` 블록 | 시트의 풀, 슬롯과 카탈로그 기술을 빌려 쓰는 Marinara 전투이며, 체력은 최대치 대비 비율로 전달하고 다시 기록 | `combat-director.service.ts`와 `combat-bridge.ts` |
| `combat` 블록 | 규칙 집합 자체 전투이며, `combat`이 칸 하나의 거리를 제공하고 게임이 Tactical이면 보드에서 진행 | `ruleset-combat-director.service.ts` |

세 방식 모두 디렉터의 원장을 공유합니다. 채팅당 저장 행 하나, 리비전 하나, 요청 ID 보호 장치와 채팅별 큐로 구성됩니다. 원장은 디렉터가 관리하는 전투만 다룹니다. `game.routes.ts`의 기존 라우트인 `POST /game/combat/round`(전달받은 전투원을 대상으로 `resolveCombatRound` 호출), `/game/combat/tactical/start`, `/game/combat/tactical/action`은 원장을 보관하지 않습니다. 클라이언트가 전투 상태를 보유하고 호출할 때마다 다시 보냅니다. 규칙 집합 전투에서는 메뉴가 적법성을 결정하고(`options.ts`), 판정기가 선택을 적용하며(`resolve.ts`), 주사위는 전투의 시드와 커서에서 나옵니다. 파티원이 소비하거나 잃는 모든 것은 시트 자체 규칙을 거쳐 기록하므로 전투 도중 탭을 닫아도 손실되는 내용이 없습니다. 아무도 작성하지 않은 상대는 규칙 집합의 생물 도감과 조우 예산으로 구성합니다. Game Master는 Engine이 순위를 매긴 제안에서 골라 이름 있는 상대와 보스를 플레이할 수 있습니다.

## 규칙 집합 키 추가하기

1. 교차 검사와 함께 `ruleset.schema.ts`에 추가하고 판정기가 읽는 TypeScript 타입에도 추가하세요.
2. `supportedCapabilityApi`의 마이너 버전을 하나 올리고 해당 주석 줄을 추가하세요. 이 키를 사용하는 규칙 집합이 반드시 해당 마이너 버전 이상을 선언하도록 키의 사용을 제한하세요.
3. 먼저 순수 함수로 구성된 공유 코드에 구현하고, 서버를 연결한 다음 클라이언트를 연결하세요.
4. `pnpm ruleset:schema`를 실행하여 `docs/extending/ruleset.schema.json`을 재생성하세요.
5. 작성자 가이드의 해당 페이지(`docs/extending/ruleset-*.md`)에 문서화하고, 플레이어에게 보이는 기능이라면 플레이어 문서에도 기록하세요.
6. 거부되는 입력을 포함하여 순수 함수 코드로 해당 기능을 실행하는 `scripts/regressions/*.regression.ts`를 추가하세요.
7. 열려 있는 `[docs-i18n]` 이슈에 변경한 영어 페이지를 나열하세요.

`docs/development/ruleset-5e-2014.example.json`은 수백 개의 회귀 테스트와 종단 간 테스트가 픽스처로 읽는 축약된 5e 초안입니다. 배포되는 SRD 패키지는 Marinara-Agents의 `packages/ruleset-5e-2014/`에 있으며, 이 파일과는 다릅니다.

## 남은 작업

- 규칙 집합 보드에서 장애물 위로 비행하기: 비행 생물도 다른 생물과 같은 방식으로 이동합니다.
- Marinara 자체의 Classic과 Tactical 전투에서 소환하기(규칙 집합 전투는 이미 소환 가능). 설계는 [Game Mode 전투 AI](game-combat-ai.md#summoning-design-extension)에 있습니다.
- 전투 지형 개요를 준비하는 Battlefield Scout 에이전트입니다. [Game Mode 전투 AI](game-combat-ai.md#encounter-environment-agent-handoff)에서 설명합니다.
