# 그룹 채팅과 여럿이 나누는 대화

이 가이드에서는 Marinara Engine의 그룹 채팅을 설명합니다. 그룹 채팅은 캐릭터가 2명 이상 함께 있는 채팅입니다. 그룹 채팅을 만드는 방법과 멤버를 추가하거나 빼는 방법을 다룹니다. Conversation(대화) 모드와 Roleplay(롤플레이) 모드에서 누가 말할지 정하는 방법도 소개합니다.

## 그룹 채팅이란

그룹 채팅은 캐릭터가 2명 이상 들어 있는 채팅을 말합니다. "그룹 채팅"이라는 별도의 버튼은 없습니다. 일반 채팅에 두 번째 캐릭터를 추가하는 순간 그대로 그룹 채팅이 됩니다.

그룹 채팅은 **Conversation**과 **Roleplay** 두 모드에서 쓸 수 있습니다. Game Mode(게임 모드)는 별도의 파티 시스템을 쓰기 때문에 여기서는 다루지 않습니다.

Marinara에서 "그룹"이라는 말은 몇 가지 다른 것을 가리킵니다. 그룹 채팅은 한 채팅에 캐릭터가 여럿 있다는 뜻입니다. 이것은 **Folders**(폴더)와 다릅니다. **Folders**는 다시 쓸 수 있게 저장해 둔 캐릭터 목록입니다. **Chat Branches**(채팅 분기)와도 다릅니다. 이쪽은 같은 채팅의 다른 갈래 버전입니다. 이 가이드는 그룹 채팅만 다룹니다.

## 그룹 채팅 만들기

그룹 채팅도 다른 채팅과 똑같이 New Chat 마법사로 만듭니다. 캐릭터를 두 명 이상 고르기만 하면 됩니다.

1. 사이드바에서 원하는 모드의 새 채팅 버튼을 클릭하세요. 버튼 이름은 **New Conversation**(새 대화) 또는 **New Roleplay**(새 롤플레이)입니다.
2. 마법사의 **Persona & Characters** 단계로 이동하세요.
3. **Search characters...** 입력란에서 캐릭터를 찾은 다음 아바타나 이름을 클릭해 추가하세요.
4. 같은 방법으로 두 번째 캐릭터를 추가하세요. 원하는 만큼 추가할 수 있습니다.
5. 마법사를 끝내면 채팅이 열립니다.

두 번째 캐릭터를 추가하면 선택 영역 위의 라벨이 바뀝니다. Conversation 모드에서는 **Group Chat**(그룹 채팅) 뒤에 인원수가 표시되고, Roleplay 모드에서는 **Characters**(캐릭터) 뒤에 인원수가 표시됩니다.

캐릭터 수에 정해진 상한은 없습니다. 다만 캐릭터가 많아질수록 프롬프트가 길어지고 답변 한 번에 드는 비용도 올라갑니다. 장면에 꼭 필요한 캐릭터만 넣으세요.

채팅 이름을 따로 바꾸지 않으면 Marinara가 캐릭터 이름을 쉼표로 이어 붙여 이름을 정합니다. 예를 들면 "Alice, Bob, Carol"입니다.

### Folders로 여러 캐릭터를 한 번에 추가하기

캐릭터 Folder를 만들어 두었다면 그 Folder 전체를 한 번에 추가할 수 있습니다. Folder는 **Characters** 패널에서 만드는 캐릭터 명단이고, 저장해 두었다가 다시 쓸 수 있습니다. 같은 구성으로 그룹 채팅을 반복해서 쓸 계획이라면 가장 빠른 방법입니다.

1. **Persona & Characters** 단계에서 **Add from Folder**(폴더에서 추가) 드롭다운을 여세요.
2. 목록에서 Folder를 하나 고르세요.
3. 드롭다운 옆의 **Add**(추가) 버튼을 클릭하세요.

그 Folder에 있는 캐릭터 중 아직 채팅에 없는 캐릭터가 모두 추가됩니다. **Add from Folder**는 Folder가 하나 이상 있을 때만 나타납니다. Folder를 만들고 관리하는 방법은 아래 관련 가이드의 캐릭터 라이브러리 정리하기를 참고하세요.

라벨이 **Dice pick**(주사위 선택)으로 표시된 **Random** 행을 클릭하면 아직 채팅에 없는 캐릭터 중 한 명이 무작위로 추가됩니다.

## 만든 뒤 멤버 관리하기

캐릭터를 추가하고, 빼고, 순서를 바꾸는 일은 **Chat Settings**(채팅 설정) 패널에서 합니다. 채팅 헤더의 톱니바퀴 아이콘을 클릭하면 열립니다. 톱니바퀴의 툴팁은 **Chat Settings**입니다.

패널 안에서 **Characters** 섹션을 찾으세요. 인원수와 함께 "Characters in this chat. Each character has their own personality that the AI roleplays as."라는 안내문이 표시됩니다. 멤버 행마다 아바타, 캐릭터 이름, 드래그 손잡이, 눈 아이콘, 휴지통 아이콘이 있습니다.

- 캐릭터를 한 명 더 추가하려면 **Add Character**(캐릭터 추가)를 클릭하고 검색하세요.
- Folder 전체를 추가하려면 **Add from Folder**를 클릭하고 하나 고르세요.
- 캐릭터를 빼려면 휴지통 아이콘을 클릭하세요. 툴팁은 **Remove from chat**(채팅에서 제거)입니다.
- 순서를 바꾸려면 드래그 손잡이를 잡고 멤버를 위아래로 옮기세요. 툴팁은 **Drag to reorder**(드래그하여 순서 변경)입니다.

멤버 순서는 중요합니다. **Sequential** 응답 순서(아래에서 설명합니다)에서는 여기 보이는 순서대로 캐릭터가 답변합니다. 발언 순서를 바꾸려면 멤버를 드래그하세요.

**Characters** 섹션은 Game Mode에는 나타나지 않습니다. Game Mode는 파티를 다른 곳에서 관리합니다.

### 멤버를 빼지 않고 잠시 끄기

명단에는 남겨 두고 한동안만 빠지게 하고 싶을 때가 있습니다. 그럴 때는 멤버 행의 눈 아이콘을 사용하세요.

- 눈 아이콘을 클릭하면 캐릭터가 비활성화됩니다. 툴팁이 **Disable in chat**(채팅에서 비활성화)으로 바뀌고 눈 아이콘에 사선이 표시됩니다.
- 다시 클릭하면 원래대로 돌아옵니다. 툴팁은 **Enable in chat**(채팅에서 활성화)입니다.

비활성화한 캐릭터는 멤버 목록에 남아 있지만 어떤 답변에도 참여하지 않습니다. 캐릭터 카드가 모델로 전송되지 않고, 발언자로 선택될 수도 없습니다.

안전장치가 하나 있습니다. 채팅의 모든 캐릭터를 비활성화하면 Marinara는 전원을 다시 활성 상태로 간주합니다. 캐릭터가 한 명도 없는 답변이 나오지 않도록 하기 위해서입니다.

이 켜고 끈 상태는 채팅별로 저장됩니다. 앱의 다른 곳에 있는 캐릭터에는 영향을 주지 않습니다.

## 누가 말하는가: Roleplay 모드

Roleplay 모드에서는 그룹 채팅의 **Chat Settings**에 **Group Chat** 섹션이 생깁니다. 이 섹션은 캐릭터가 2명 이상일 때만 나타납니다. 여기서 캐릭터들이 어떻게 답변할지 조정합니다.

### Merged (Narrator)와 Individual

**Mode**(모드) 설정은 버튼 2개짜리 토글입니다.

- **Merged (Narrator)**가 기본값입니다. 답변 하나에 모든 캐릭터의 대사와 내레이션이 한꺼번에 담깁니다.
- **Individual**은 캐릭터마다 따로 답변을 생성합니다.

### Color Dialogues(Merged 모드 전용)

**Mode**가 **Merged (Narrator)**일 때는 **Color Dialogues**(색상 대사)를 켤 수 있습니다. 기본값은 꺼짐입니다. 켜면 각 캐릭터의 대사가 그 캐릭터에 지정된 색으로 표시됩니다. 이 색은 캐릭터 편집기의 **Colors** 탭에서 가져옵니다. 이 탭에서 이름 색, 대사 색, 상자 색을 정합니다. 색을 지정하는 방법은 캐릭터 편집 가이드를 참고하세요.

<a id="response-order-individual-only"></a>

### Response Order(Individual 모드 전용)

**Mode**가 **Individual**이면 **Response Order**(응답 순서) 설정이 나타납니다. 버튼 3개짜리 토글입니다.

- **Sequential**이 기본값입니다. **Characters** 목록에 표시된 순서대로 모든 캐릭터가 차례로 답변합니다. 턴 순서를 바꾸려면 멤버 순서를 바꾸세요.
- **Smart**는 짧은 숨은 AI 호출로 다음에 답변할 캐릭터를 정합니다. 최근 메시지와 각 캐릭터의 정보를 읽고 보통 한 명을 고릅니다. 메시지에 `@Alice`처럼 멘션을 적으면 그 선택을 덮어씁니다.

  **Decision model**(판정 모델)을 선택했다면([Decision 모델](../connections/decision-models.md) 참고), 그 아래의 **Also use it to pick who speaks in Smart response order**(Smart 응답 순서의 발언자 선택에도 사용)를 켤 수 있습니다. Smart 순서는 후보마다 별도의 예/아니요 점수를 요청합니다. 질문은 최근 메시지 5개와 후보의 이름, 상태, 활동, 발언 빈도, 짧은 성격 또는 설명이 담긴 명단을 공유합니다. 호스팅 제공자에게는 명단도 전달합니다. [모델에 전달되는 정보](../connections/decision-models.md#what-the-model-sees)를 참고하세요.

  전체 AI 답글보다 점수를 빠르게 얻을 수 있지만 속도와 비용은 모델과 후보 수에 따라 달라집니다. Roleplay에서는 가능성이 가장 높은 발언자를 고릅니다. Conversation에서는 답할 이유가 있는 모두가 가능성이 높은 순서로 답합니다. 방금 말한 캐릭터는 다른 후보에게 답할 이유가 있으면 기다립니다. Decision 모델이 답하지 않으면 기존 AI 호출을 사용합니다.

- **Manual**은 자동 답변을 모두 멈춥니다. 메시지 입력 막대의 **Trigger Response**(응답 트리거) 선택기로 답변할 캐릭터를 직접 고릅니다.

**Smart** 순서에서는 AI가 캐릭터를 여러 명 대기시킬 수 있습니다. 바로 답변하는 것은 첫 번째 캐릭터뿐입니다. 다음 발언자를 고르려면 메시지 입력 막대의 **Trigger Response** 선택기를 사용하세요. 빈 메시지를 보내 대기 중인 다음 캐릭터의 답변을 생성할 수도 있습니다.

**Individual** 모드에서는 토글이 두 개 더 나타납니다.

- **Add Turn To Prompt**(턴을 프롬프트에 추가)는 기본값이 켜짐입니다. 이번 턴에 답변할 캐릭터를 지정하는 짧은 지시를 프롬프트에 덧붙입니다.
- **Name Prefix History**(이름 접두사 기록)는 기본값이 꺼짐입니다. 지난 메시지를 모델에 보내기 전에 발언자 이름을 어떻게 붙일지 바꿉니다. 캐릭터가 누가 무슨 말을 했는지 자꾸 헷갈릴 때가 아니면 꺼 두세요.

### Scenario Override

**Scenario Override**(시나리오 재정의) 입력란을 쓰면 그룹 전체가 시나리오 하나를 공유합니다. 여기에 글을 적으면 프롬프트에서 각 캐릭터의 시나리오가 그 글로 대체됩니다. 비워 두면 캐릭터마다 원래 시나리오를 그대로 씁니다.

켜고 끄는 스위치는 따로 없습니다. 글을 적으면 켜지고, 글을 지우면 꺼집니다. 더 큰 창에서 편집하려면 확장 아이콘(툴팁 **Expand editor**(편집기 펼치기))을 클릭하세요. 확장된 편집기의 제목은 **Group Scenario Override**(그룹 시나리오 재정의)입니다.

재사용과 관련해 한 가지 유의할 점이 있습니다. **Scenario Override**에 적은 글은 해당 채팅 하나에만 묶입니다. 설정 프로필에는 포함되지 않으므로 프로필을 따라 새 채팅으로 옮겨 가지 않습니다.

### 설정과 기본값(Roleplay)

| 설정 | 위치 | 기본값 |
|---|---|---|
| **Mode** (**Merged (Narrator)** / **Individual**) | Group Chat 섹션 | Merged (Narrator) |
| **Color Dialogues** | Group Chat 섹션, Merged 모드 | Off |
| **Response Order** (Sequential / Smart / Manual) | Group Chat 섹션, Individual 모드 | Sequential |
| **Add Turn To Prompt** | Group Chat 섹션, Individual 모드 | On |
| **Name Prefix History** | Group Chat 섹션, Individual 모드 | Off |
| **Scenario Override** | Group Chat 섹션 | 비어 있음(꺼짐) |

이 설정들은 대부분 설정 프로필에 저장되므로 다시 쓸 수 있습니다. 예외는 **Scenario Override** 하나뿐이며, 이 값은 해당 채팅에만 남습니다.

## 누가 말하는가: Conversation 모드

Conversation 모드도 같은 그룹 채팅을 지원하지만 **Group Chat** 섹션은 표시하지 않습니다. 관련 설정은 대신 **Chat Settings**의 **Autonomous Messaging**(자율 메시지) 섹션에 있습니다.

기본 상태의 그룹 채팅은 Merged 모드처럼 동작합니다. 답변 하나에 여러 캐릭터의 대사가 함께 담기고, 대사에는 발언자별로 색이 자동으로 입혀집니다. Conversation 모드에는 색을 켜고 끄는 별도 토글이 없습니다.

### Reply When Mentioned

**Reply When Mentioned**를 켜면 한 번에 한 캐릭터씩 답변하도록 바뀝니다. 켜져 있으면 이름을 직접 부르거나 수동으로 답변을 요청할 때만 캐릭터가 답변합니다. 토글 설명문은 "Characters wait for direct mentions or manual response triggers."입니다.

캐릭터 이름은 앳 멘션으로 부릅니다. 메시지 입력란에 `@`를 입력하고 캐릭터 이름을 이어 적으면 자동 완성 목록이 나타납니다. 멘션한 캐릭터가 답변합니다.

멘션을 적지 않고 발언자를 고르려면 **Trigger Response** 선택기를 사용하세요.

- 데스크톱에서는 Send 버튼 옆에 있는 버튼입니다.
- 모바일에서는 메시지 입력 막대에서 여는 도구 트레이의 **Trigger Response** 제목 아래에 있습니다.

버튼 툴팁은 "Trigger character response"입니다.

### Character Exchanges

**Character Exchanges**(캐릭터 간 대화)를 켜면 캐릭터들이 알아서 서로 이야기합니다. 기본값은 꺼짐입니다. 설명문은 "Characters chat with each other in group chats."입니다.

켜져 있으면 캐릭터들은 자리를 비운 동안에도 사람에게만이 아니라 서로에게 답변합니다. 이 기능은 브라우저에서 Marinara가 열려 있는 동안에만 동작합니다. 앱을 닫으면 주고받기도 멈춥니다. 자율 메시지와 같은 하루 메시지 상한도 함께 사용합니다.

## 턴 처리 한눈에 보기

| 모드와 설정 | 동작 | 조정 방법 |
|---|---|---|
| Roleplay, Merged | 답변 하나에 모든 캐릭터가 등장합니다 | 항상 전원이 함께 답변합니다 |
| Roleplay, Individual, Sequential | 멤버 순서대로 캐릭터가 답변합니다 | 드래그해서 멤버 순서를 바꿉니다 |
| Roleplay, Individual, Smart | AI가 다음 발언자를 한 명 이상 고릅니다 | `@Name` 멘션이 그 선택을 덮어씁니다 |
| Roleplay, Individual, Manual | 아무도 스스로 답변하지 않습니다 | **Trigger Response** 선택기를 사용합니다 |
| Conversation, 기본 상태 | 답변 하나에 여러 캐릭터가 등장할 수 있습니다 | `@Name` 멘션으로 캐릭터를 지정합니다 |
| Conversation, Reply When Mentioned 켜짐 | 멘션이나 요청 없이는 아무도 답변하지 않습니다 | `@Name` 멘션 또는 **Trigger Response** 선택기 |
| Conversation, Character Exchanges 켜짐 | 캐릭터끼리도 메시지를 주고받습니다 | 끄면 멈춥니다 |

## 관련 가이드

- [캐릭터 라이브러리 정리하기](../characters/library-organization.md)
- [Conversation Mode: 시작하기](../conversation/getting-started.md)
- [Roleplay Mode: 시작하기](../roleplay/getting-started.md)
