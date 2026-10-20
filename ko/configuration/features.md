# 기능 스위치

일부 서버 동작은 선택 사항입니다. **Settings > Advanced > Features**(설정 > 고급 > 기능)에서 켭니다. 모든 스위치는 처음에 꺼져 있으므로 아무도 이 섹션을 열지 않는 서버는 이전과 똑같이 동작합니다.

변경은 즉시 적용됩니다. 서버 재시작이나 페이지 새로고침은 필요 없습니다.

<a id="overview"></a>

## 개요

| 스위치 | 설정 키 | 기본값 | 환경 변수 |
| --- | --- | --- | --- |
| **Stable lorebook picks**(로어북 선택 고정) | `stableLorebookGroupPicks` | 꺼짐 | `LOREBOOK_STABLE_GROUP_WINNERS` |
| **Retry failed provider calls**(실패한 제공자 호출 재시도) | `providerRetry` | 꺼짐 | `PROVIDER_RETRY_TRANSIENT_ERRORS` |
| **Lorebook activation stats**(로어북 활성화 통계) | `usageAndActivationStats` | 꺼짐 | 없음 |
| **Recover deleted chat messages**(삭제된 채팅 메시지 복구) | `messageTrash` | 꺼짐 | 없음 |

설정에서 `features`를 검색하면 해당 섹션으로 이동합니다.

<a id="where-the-settings-are-stored"></a>

## 설정 저장 위치

모든 스위치는 앱 설정 `features`에 불리언 JSON 객체 하나로 함께 저장합니다. 기본값과 다른 값만 저장합니다. 누락된 키, 빈 객체, 읽을 수 없는 값은 모두 기본값, 즉 전체 꺼짐을 뜻합니다.

서버는 메모리에 사본을 유지하므로 제공자 호출이나 로어북 스캔처럼 빈번한 경로에서 추가 읽기 비용이 없습니다. Settings에서 저장하거나 다른 방식으로 `features` 행에 쓰면 사본이 즉시 갱신됩니다.

API는 `GET`과 `PUT /api/app-settings/features`입니다. `PUT`은 전체 객체를 대체하며 알 수 없는 키와 불리언이 아닌 값을 거부합니다.

<a id="switches"></a>

## 스위치

<a id="stable-lorebook-picks"></a>

### 로어북 선택 고정

설정 키: `stableLorebookGroupPicks`. 환경 변수: `LOREBOOK_STABLE_GROUP_WINNERS`.

켜짐: 로어북 포함 그룹은 일치하는 후보가 같은 동안 해당 채팅에서 같은 승자를 유지합니다. 다른 채팅이나 후보 집합은 다르게 선택할 수 있습니다.

꺼짐: 생성할 때마다 승자를 다시 추첨합니다.

<a id="retry-failed-provider-calls"></a>

### 실패한 제공자 호출 재시도

설정 키: `providerRetry`. 환경 변수: `PROVIDER_RETRY_TRANSIENT_ERRORS`.

켜짐: 거부되거나 도달 불가능한 연결, 또는 게이트웨이 502/503을 짧고 무작위로 변하는 대기 후 최대 두 번 재시도합니다. 텍스트가 도착하기 전만 해당됩니다. 504나 끊어진 연결은 재시도하지 않습니다. 연결에 폴백이 있으면 대신 즉시 폴백을 시도합니다.

꺼짐: 이전처럼 속도 제한만 재시도합니다.

<a id="lorebook-activation-stats"></a>

### 로어북 활성화 통계

설정 키: `usageAndActivationStats`. 환경 변수는 없습니다.

켜짐: 응답이 정상적으로 저장되면 Marinara가 어떤 로어북 항목이 활성화되었는지 기록하므로, 로어북 편집기에서 사용 빈도에 따라 항목을 정렬하고 필터링할 수 있습니다. 이어 쓰기로 덧붙은 부분은 활성화 기록을 남기지 않습니다.

꺼짐: 아무것도 기록하지 않으며, 로어북 편집기는 활성화 통계를 숨깁니다.

<a id="recover-deleted-chat-messages"></a>

### 삭제된 채팅 메시지 복구

설정 키: `messageTrash`. 환경 변수는 없습니다.

켜짐: 삭제한 채팅 메시지는 채팅 검색의 **Trash**(휴지통) 탭으로 갑니다. 30일 안에 그곳에서 **Restore**(복원)를 사용하세요. 그 뒤에는 완전히 삭제됩니다. Game 메시지와 롤백으로 인한 삭제는 여전히 영구적입니다.

꺼짐: 삭제한 메시지는 바로 제거됩니다.

<a id="precedence"></a>

## 우선순위

1. **환경 변수.** 설정되어 있으면 켜짐과 꺼짐 모두 저장된 스위치보다 우선합니다. Settings는 변수 이름과 함께 잠긴 스위치로 표시합니다. 빈 값은 미설정으로 봅니다.
2. **저장된 스위치.** Settings > Advanced > Features에 저장한 값입니다.
3. **기본값.** 꺼짐입니다.

| 변수 | 제어 대상 | 값 |
| --- | --- | --- |
| `LOREBOOK_STABLE_GROUP_WINNERS` | 로어북 선택 고정 | `true`, `1`, `yes`, `on`은 켭니다. 다른 값은 끕니다. |
| `PROVIDER_RETRY_TRANSIENT_ERRORS` | 실패한 제공자 호출 재시도 | `true`, `1`, `yes`, `on`은 켭니다. 다른 값은 끕니다. |

환경 변수는 확인할 때마다 읽으므로 `.env` 변경은 재시작 없이 적용됩니다.

<a id="for-developers"></a>

## 개발자용

레지스트리는 스위치 이름과 기본값을 담은 `packages/shared/src/schemas/feature-settings.schema.ts`입니다. `FEATURE_SWITCH_NAMES`, `FEATURE_SWITCH_DEFAULTS`, `featureSettingsSchema`에 스위치를 추가하고 영어 카탈로그의 `settings.features.<key>`에 레이블과 도움말을 작성하세요. `packages/client/src/components/panels/settings/FeatureSwitchesSettings.tsx`의 `SERVER_SWITCHES`에 넣으면 Settings에 표시됩니다. 서버는 `packages/server/src/services/features/feature-settings.ts`의 `isFeatureEnabled("<key>")`로 확인합니다. 클라이언트는 `packages/client/src/hooks/use-feature-settings.ts`의 `useFeatureEnabled("<key>")`를 사용합니다.
