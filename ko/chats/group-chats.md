# 그룹 채팅과 여럿이 나누는 대화

그룹 채팅은 캐릭터가 2명 이상 있는 Conversation(대화) 채팅이나 Roleplay(롤플레이) 채팅입니다. 이 가이드에서는 그룹 채팅을 만들고, 멤버를 관리하고, 누가 말할지 정하는 방법을 설명합니다. Game Mode(게임 모드)는 자체 파티 시스템을 쓰므로 여기서는 다루지 않습니다.

"그룹 채팅"이라는 별도의 버튼은 없습니다. 두 번째 캐릭터를 추가하면 그 채팅이 그룹 채팅이 됩니다. 그룹 채팅은 **Folder**(폴더)와 다릅니다. Folder는 다시 쓸 수 있게 저장해 둔 캐릭터 목록입니다. **Chat Branch**(채팅 분기)와도 다릅니다. Chat Branch는 한 채팅의 다른 버전입니다.

## 그룹 채팅 만들기

1. **Chats**(채팅) 패널에서 원하는 모드의 **+** 버튼을 클릭하세요. 버튼 이름은 **New Conversation**(새 대화) 또는 **New Roleplay**(새 롤플레이)입니다.
2. 설정 마법사가 열립니다. **Persona & Characters** 단계에서 **Search characters...**에 입력한 다음 캐릭터를 클릭해 추가하세요.
3. 같은 방법으로 두 번째 캐릭터를 추가하세요.
4. 마법사를 끝내면 채팅이 열립니다.

선택 영역 위의 라벨이 바뀝니다. Conversation에서는 **Group Chat**(그룹 채팅)과 인원수가, Roleplay에서는 **Characters**(캐릭터)와 인원수가 표시됩니다. 채팅 이름을 바꾸지 않으면 Marinara가 "Alice, Bob, Carol"처럼 캐릭터 이름으로 채팅 이름을 정합니다.

캐릭터 수에 정해진 상한은 없습니다. 캐릭터가 많을수록 프롬프트가 길어지고 답변 한 번에 드는 비용도 올라가므로, 장면에 필요한 캐릭터만 넣으세요.

Folder 전체를 한 번에 추가하려면 같은 단계에서 **Add from Folder**(폴더에서 추가)를 열고, Folder를 고른 다음 **Add**(추가)를 클릭하세요. 이미 채팅에 있는 캐릭터는 건너뜁니다. 이 컨트롤은 Folder가 하나 이상 있을 때만 나타납니다. [캐릭터 라이브러리 정리하기](../characters/library-organization.md)를 참고하세요. 라벨이 **Dice pick**(주사위 선택)인 **Random** 행은 아직 채팅에 없는 캐릭터 한 명을 무작위로 추가합니다.

## 멤버 관리하기

**Chat Settings**(채팅 설정)를 열고 **Characters** 섹션을 찾으세요. Game Mode에는 이 섹션이 없습니다. 멤버 행마다 아바타, 이름, 드래그 손잡이, 눈 아이콘, 휴지통 아이콘이 있습니다.

| 하려는 일 | 방법 |
|---|---|
| 캐릭터 추가 | **Add Character**(캐릭터 추가)를 클릭하고 검색하세요. |
| Folder 추가 | **Add Character**를 클릭한 다음 폴더 행의 **Add all**(모두 추가)을 클릭하세요. |
| 여러 명을 한 번에 바꾸기 | 멤버 이름을 클릭하세요. 같은 선택 창이 열립니다. |
| 캐릭터 빼기 | 휴지통 아이콘 **Remove from chat**(채팅에서 제거)을 클릭하세요. |
| 순서 바꾸기 | 손잡이 **Drag to reorder**(드래그하여 순서 변경)를 끌어 옮기세요. **Sequential**(순차적) 순서에서는 캐릭터가 이 순서대로 답변합니다. |
| 잠시 끄기 | 눈 아이콘 **Disable in chat**(채팅에서 비활성화)을 클릭하세요. 다시 클릭하면 **Enable in chat**(채팅에서 활성화)으로 켜집니다. |

비활성화한 캐릭터는 목록에 남지만 모든 답변에서 빠집니다. 캐릭터 카드가 모델로 전송되지 않고, 발언자로 선택될 수도 없습니다. 모든 캐릭터를 비활성화하면 답변이 비지 않도록 Marinara가 전원을 활성 상태로 간주합니다. 이 상태는 채팅별로 저장되며 다른 곳에는 영향을 주지 않습니다. Merged 모드의 Roleplay 그룹에서는 [활성 캐릭터 자동화](#automate-active-characters-merged-only)가 이 상태를 대신 정해 줄 수 있습니다.

<a id="choose-who-speaks"></a>

## 누가 말할지 정하기

**Chat Settings → Group Chat**(채팅 설정 → 그룹 채팅)을 여세요. 이 섹션은 채팅에 캐릭터가 2명 이상일 때만 나타납니다. 두 모드 모두 같은 **Mode**(모드) 토글을 씁니다.

- 답변 하나가 모든 캐릭터의 목소리를 냅니다. Roleplay에서는 **Merged (Narrator)**(병합, 나레이터), Conversation에서는 **Grouped**(그룹)입니다. 이것이 기본값입니다. Roleplay에서 내레이터는 장면을 묘사하는 목소리이며, 같은 답변의 일부입니다.
- **Individual**(개별)은 캐릭터마다 따로 답변을 생성합니다.

Conversation에서 **Individual**로 바꾸면 **Individual replies can use many tokens**(개별 응답은 많은 토큰을 사용할 수 있습니다)라는 경고가 표시됩니다. 답변하는 캐릭터마다 별도의 모델 요청을 쓰므로, Autonomous Messaging(자율 메시지)을 쓰는 큰 그룹은 토큰을 빠르게 소모합니다.

### Automate active characters(Roleplay, Merged 모드 전용)

이 설정은 출연진이 많을 때 캐릭터를 대신 켜고 끕니다. 이 가이드 끝의 [활성 캐릭터 자동화](#automate-active-characters-merged-only)를 참고하세요.

### Color Dialogues(Roleplay, Merged 모드 전용)

**Color Dialogues**(색상 대사)는 기본값이 꺼짐입니다. 켜면 각 캐릭터의 대사가 Character Editor의 **Colors**(색상) 탭에서 정한 그 캐릭터의 색으로 표시됩니다. Conversation 그룹에서는 대사에 발언자별로 색이 자동으로 입혀지며, 토글이 없습니다.

<a id="response-order-individual-only"></a>

### Response Order(Individual 모드 전용)

**Mode**가 **Individual**이면 **Response Order**(응답 순서)가 나타납니다. **Sequential**이 기본값입니다.

| 순서 | 동작 |
|---|---|
| **Sequential** | **Characters** 목록 순서대로 캐릭터가 차례로 답변합니다. Conversation에서는 오프라인인 캐릭터를 건너뜁니다. |
| **Smart**(스마트) | 짧은 숨은 모델 호출로 다음에 답변할 캐릭터를 고르며, 보통 한 명을 고릅니다. 메시지의 `@Alice` 멘션은 그 선택을 덮어씁니다. Conversation에서는 대화 내용, 스케줄 상태, 발언 빈도를 사용합니다. |
| **Manual**(수동) | 아무도 스스로 답변하지 않습니다. Roleplay에서는 **Trigger Response**(응답 트리거) 선택기를 쓰세요. Conversation에서는 `@mention`으로 캐릭터를 한 명 이상 부르거나 선택기를 쓰세요. |

**Smart** 순서에서는 모델이 캐릭터 여러 명을 대기시킬 수 있습니다. 바로 답변하는 것은 첫 번째 캐릭터뿐입니다. 대기 중인 다음 캐릭터의 답변을 생성하려면 **Trigger Response** 선택기를 쓰거나 빈 메시지를 보내세요.

[Decision 모델](../connections/decision-models.md)을 골랐다면 그 아래의 **Also use it to pick who speaks in Smart response order**(스마트 응답 순서에서 발언자를 정하는 데도 사용)를 켤 수 있습니다. 그러면 Smart 순서는 후보마다 예/아니요 점수를 요청합니다.

- 질문은 최근 메시지 5개와 함께, 후보마다 이름, 상태, 활동, 발언 빈도, 짧은 성격 발췌를 담은 명단을 공유합니다. 호스팅 서비스도 그 명단을 받습니다. [모델에 전달되는 정보](../connections/decision-models.md#what-the-model-sees)를 참고하세요.
- 속도와 비용은 모델과 후보 수에 따라 달라집니다.
- Roleplay에서는 Marinara가 가능성이 가장 높은 발언자를 고릅니다. Conversation에서는 답할 이유가 있는 모두가 가능성이 높은 순서로 답합니다. 다른 캐릭터에게 답할 이유가 있으면 방금 말한 캐릭터는 기다립니다.
- Decision 모델이 답하지 않으면 Smart 순서는 평소의 모델 호출을 합니다.

Roleplay의 **Individual** 모드에서 순서가 **Smart**나 **Manual**이면 선택기의 첫 옵션은 사람들 아이콘이 붙은 **Smart**입니다. 이 옵션은 그 답변 한 번에 한해 모델이 다음 발언자를 고르게 합니다. 저장한 순서는 바뀌지 않습니다.

### 직접 답변 요청하기

발언자를 고르려면 **Trigger Response** 선택기를 쓰세요. 컴퓨터에서는 **Send**(전송) 옆의 버튼이며, 라벨은 **Trigger character response**(캐릭터 응답 실행)입니다. 휴대폰에서는 메시지 입력란에서 여는 도구 트레이의 **Trigger Response** 아래에 있습니다. 텍스트로 발언자를 지정하려면 `@`를 입력하고 캐릭터 이름을 이어 적으세요. 자동 완성 목록이 나타납니다.

### Individual 모드의 다른 설정

- **Add Turn To Prompt**(턴을 프롬프트에 추가)는 기본값이 켜짐입니다. 답변할 캐릭터를 지정하는 짧은 지시를 추가합니다.
- **Name Prefix History**(이름 접두사 기록)는 Roleplay 전용이며 기본값이 꺼짐입니다. 지난 메시지에 발언자 이름을 붙이는 방식을 바꿉니다. 캐릭터가 누가 무슨 말을 했는지 계속 헷갈리는 경우가 아니면 꺼 두세요.

### Scenario Override(Roleplay)

**Scenario Override**(시나리오 재정의)는 그룹 전체가 시나리오 하나를 공유하게 합니다. 입력란의 글은 프롬프트에서 각 캐릭터의 시나리오를 대체합니다. 입력란을 비우면 각 시나리오가 그대로 남습니다. 켜고 끄는 스위치는 없습니다. 더 큰 창에서 편집하려면 확장 아이콘 **Expand editor**(편집기 펼치기)를 클릭하세요. 열리는 창의 제목은 **Group Scenario Override**(그룹 시나리오 재정의)입니다. 이 글은 해당 채팅 하나에만 남으며 설정 프로필에는 포함되지 않습니다.

### Character Exchanges(Conversation)

자리를 비운 동안 캐릭터끼리 이야기하게 하려면 **Chat Settings → Autonomous Messaging**(채팅 설정 → 자율 메시지)에서 **Character Exchanges**(캐릭터 간 대화)를 켜세요. 기본값은 꺼짐이며 그룹 채팅에서만 나타납니다. 브라우저에서 Marinara가 열려 있는 동안에만 동작하며, 자율 메시지의 하루 메시지 상한을 함께 씁니다. 캐릭터 스케줄이 있든 없든 동작합니다. **Individual** 그룹에서는 캐릭터 사이의 주고받기와 `@mention` 답변이 그룹의 그날 마지막 체크인을 쓰지 않습니다.

## 설정과 기본값

| 설정 | 위치 | 기본값 |
|---|---|---|
| **Mode** | Group Chat 섹션 | Roleplay는 **Merged (Narrator)**, Conversation은 **Grouped** |
| **Color Dialogues** | Roleplay, Merged | 꺼짐 |
| **Automate active characters**(활성 캐릭터 자동화) | Roleplay, Merged | 꺼짐 |
| **Response Order** | Individual | Sequential |
| **Add Turn To Prompt** | Individual | 켜짐 |
| **Name Prefix History** | Roleplay, Individual | 꺼짐 |
| **Scenario Override** | Roleplay | 비어 있음 |
| **Character Exchanges** | Conversation, Autonomous Messaging | 꺼짐 |

설정 프로필에는 **Scenario Override**와 자동화의 고정을 제외한 이 설정들이 저장됩니다. [설정 프로필](settings-profiles.md)을 참고하세요.

## 참고

<a id="automate-active-characters-merged-only"></a>

### Automate active characters(Merged 모드 전용)

Merged 모드에서는 답변마다 모든 활성 캐릭터의 카드가 프롬프트에 들어갑니다. Roleplay에서는 **Automate active characters**가 카드를 대신 켜고 끄므로, 출연진이 많아도 컨텍스트가 가득 차지 않습니다. 옵션은 세 가지이며 기본값은 **Off**(끔)입니다.

| 옵션 | 하는 일 |
|---|---|
| **Off** | 눈 아이콘 토글로 누가 활성인지 직접 고릅니다. |
| **Decision model**(결정 모델) | 각 답변 전에 [Decision 모델](../connections/decision-models.md)이 캐릭터마다 예/아니요 질문 하나에 답합니다. 이 캐릭터가 답변이 이어 가는 장면에 있는가, 아니면 그 장면에 들어오는가? 언급되거나 기억되기만 하는 캐릭터는 꺼진 채로 남습니다. |
| **Character Tracker** | 지난 답변에서 [Character Tracker](../agents/built-in-agents.md#character-tracker)가 파악한 등장 캐릭터가 누가 활성인지 정합니다. 추가 모델 호출이 필요 없지만 한 턴 늦게 동작합니다. 지금 들어온 캐릭터는 다음 답변에서 켜집니다. |

설정 아래의 안내문은 빠진 것이 있을 때 알려 줍니다. Decision 모델을 고르지 않았거나, 이 채팅에서 Character Tracker가 꺼져 있거나, 트래커가 수동으로 실행되어 직접 실행한 뒤에야 목록이 바뀌는 경우입니다.

- **고정.** 자동화가 켜져 있는 동안 각 캐릭터 행의 눈 아이콘 왼쪽에 고정 아이콘이 표시됩니다. 클릭하면 그 캐릭터를 지금 상태 그대로(켜짐이든 꺼짐이든) 고정하므로, 자동화가 그 캐릭터를 건드리지 않습니다. 눈 아이콘을 직접 전환해도 그 캐릭터가 고정됩니다. 고정 아이콘을 다시 클릭하면 고정이 해제됩니다. 자동화를 **Off**로 바꾸면 모든 고정이 해제됩니다.
- **내레이터는 계속 활성 상태로 남습니다.** 지정한 내레이터는 절대 꺼지지 않습니다.
- **답이 없으면 목록을 유지합니다.** **Decision model** 모드에서 모델이 답하지 않으면, Character Tracker의 마지막 장면이 있을 때 그것을 사용합니다. **Also gate agents that run before the reply**(답글 전에 실행되는 에이전트도 판정)가 켜져 있지 않을 때 먼저 추론하는 모델과, Decision 모델의 입력에 다 들어가지 않을 만큼 큰 출연진도 여기에 해당합니다. 둘 다 답이 없으면 목록은 그대로 유지됩니다.
- **아무도 활성이 아닌 결과는 무시됩니다.** 모두를 끄게 되는 결과는 적용되지 않습니다.
- **Character Activity 에이전트가 우선합니다.** **Character Activity**(캐릭터 활동) 결과 유형을 쓰는 사용자 지정 에이전트가 있는 채팅에서는 그 에이전트가 계속 담당합니다.

Character Tracker는 캐릭터마다 자기만의 이름을 적습니다. Marinara는 카드 id, 이름, **Colors** 탭의 이름 별칭 순서로 그 이름을 카드와 연결합니다. 트래커 목록에 이 채팅의 캐릭터가 한 명도 없으면 현재 목록을 유지합니다. 자동화는 모든 답변, 스와이프, 재생성 전에 실행되며, **Continue**와 Impersonate에서는 건너뜁니다. 이 설정은 설정 프로필에 저장됩니다. 고정은 해당 채팅 하나에 남습니다.
