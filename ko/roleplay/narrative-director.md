# Narrative Director와 Secret Plot

이 가이드에서는 Marinara Engine의 Narrative Director 에이전트를 설명합니다. **Push Story**(스토리 전개) 버튼, Natural 모드와 Random Event 모드, 그리고 숨은 장기 전개인 Secret Plot을 다룹니다. 모두 Roleplay Mode(롤플레이 모드) 전용 기능입니다.

## Narrative Director란

에이전트는 채팅 뒤편에서 정해진 일을 대신 처리하는 AI 도우미입니다. Narrative Director도 그런 에이전트 중 하나입니다. 다음 답변 한 번에만 적용되는 연출 지시를 써 주기 때문에, 이야기를 원하는 방향으로 움직일 수 있습니다. 에이전트의 전반적인 동작 방식은 [에이전트: 채팅을 도와주는 AI](../agents/agents-overview.md)에서 확인하세요.

Narrative Director는 Roleplay Mode에서만 동작합니다. 혼자서는 아무 일도 하지 않습니다. **Push Story** 버튼으로 다음 답변 한 번에 대해 켜 두거나(장전), **Secret Plot**(비밀 플롯) 기능을 켰을 때만 작동합니다.

쓰려면 먼저 채팅에 에이전트를 추가해야 합니다. **Chat Settings**(채팅 설정)를 열고 **Agents**(에이전트) 항목으로 이동한 다음, **Narrative Director** 에이전트를 활성화하세요. 활성화하면 메시지 입력란 위에 **Push Story** 버튼이 나타나고, **Agents** 항목에 **Narrative Director** 설정 카드가 생깁니다.

## Push Story

**Push Story**는 한 번만 작동하는 버튼입니다. 바로 다음 답변에만 영향을 주고 스스로 꺼집니다. 장면이 정체된 느낌이라 AI가 이야기를 밀고 나가 주길 바랄 때 쓰세요.

사용 방법은 다음과 같습니다.

1. **Narrative Director** 에이전트가 활성화된 Roleplay 채팅을 여세요.
2. 메시지 입력란 위에서 **Push Story** 버튼을 찾으세요.
3. **Push Story**를 클릭하세요. Natural 모드에서는 "The next time a character responds, they will push the story forward naturally!" 메시지가 보입니다. Random Event 모드에서는 문장 끝이 "randomly!"로 바뀝니다.
4. 다음 메시지를 보내거나 답변을 새로 생성하세요.
5. AI가 그 한 번의 답변에 이야기 자극을 반영해서 씁니다.
6. 답변이 끝나면 **Push Story**는 저절로 꺼집니다.

보내기 전에 마음이 바뀌었다면 **Push Story**를 다시 클릭해서 끄세요. "Push Story disarmed." 메시지가 보입니다.

답변이 생성되는 동안에는 **Push Story** 버튼을 쓸 수 없습니다. 진행 중인 답변이 끝날 때까지 기다렸다가 장전하세요.

## Natural 모드와 Random Event 모드

**Push Story**에는 두 가지 모드가 있습니다. 모드는 **Chat Settings** 안의 **Narrative Director** 카드에서 고릅니다. 어떤 모드를 고르느냐에 따라 자극의 성격이 달라집니다.

두 모드는 다음과 같습니다.

- **Natural**: 지금 진행 중인 줄거리를 밀고 나갑니다. 이야기에 이미 깔려 있는 갈래를 AI가 진전시킵니다.
- **Random Event**: 그럴듯한 돌발 상황을 더합니다. 장면에 어울리는 새로운 반전을 AI가 끌어들입니다.

기본값은 **Natural**입니다. 모드를 바꾸려면 **Chat Settings**를 열고 **Agents**로 이동해 **Narrative Director** 카드를 찾은 다음, 원하는 모드를 클릭하세요.

지금 어떤 모드가 장전되어 있는지는 **Push Story** 버튼의 툴팁으로 알 수 있습니다. **Natural** 모드에서는 "Arm a natural Narrative Director push for the next response."로, **Random Event** 모드에서는 "Arm a random Narrative Director event for the next response."로 표시됩니다.

## Secret Plot

**Secret Plot**은 롤플레이에 숨겨 두는 장기 전개입니다. 이야기가 어디로 갈지에 대한 비밀 계획을 AI가 품고 있습니다. 이 계획은 프롬프트에 함께 들어가지만, 직접 열어 보기 전까지는 화면에 드러나지 않습니다. 기본값은 꺼짐입니다.

한 번만 작동하는 **Push Story**와 달리 **Secret Plot**은 여러 답변에 걸쳐 이어집니다. 채팅이 진행되는 동안 정해진 주기마다 숨은 계획을 새로 다듬습니다.

### Secret Plot 켜기

1. **Chat Settings**를 열고 **Agents** 항목으로 이동하세요.
2. **Narrative Director** 카드를 찾으세요.
3. **Secret Plot** 토글을 켜세요. 설명 문구는 "Maintain a hidden long-term arc for this roleplay."입니다.

### Run Interval

**Secret Plot**을 켜면 **Run Interval**(실행 간격) 입력란이 나타납니다. 사용자 메시지와 어시스턴트 메시지가 몇 개 오갈 때마다 숨은 전개를 갱신할지 정하는 값입니다.

기본값은 8입니다. 1에서 100까지의 정수를 넣을 수 있습니다. 숫자가 작을수록 계획을 자주 갱신하고, 클수록 덜 갱신합니다.

### 숨은 전개 열어 보기와 고치기

**Run Interval** 입력란 아래에 **Secret plot** 패널이 있습니다. 여기서 숨은 계획을 확인하고 고칠 수 있습니다.

전개를 보려면 열기 버튼을 클릭하세요. 전개가 이미 있으면 **Reveal spoilers**(스포일러 보기), AI가 아직 쓰지 않았으면 **Reveal empty arc**(빈 아크 공개)로 표시됩니다. 다시 감추려면 **Hide spoilers**(스포일러 숨기기)를 클릭하세요. 감춰져 있는 동안 패널에는 "Spoilers hidden"이 표시됩니다.

전개를 열면 다음 입력란을 고칠 수 있습니다.

- **Arc description**(서사 설명): 숨겨 둔 전체 줄거리입니다.
- **Protagonist arc**(주인공 아크): 내 캐릭터가 향하는 방향입니다.
- **Character arc**(캐릭터 서사): 롤플레이에 등장하는 캐릭터 중 선택한 한 명이 향하는 방향입니다.
- **Completed**(완료됨): 전개가 끝났을 때 체크하는 체크박스입니다.

입력란을 고친 뒤에는 저장 버튼을 눌러 변경 내용을 반영하세요.

지금의 전개를 버리고 AI에게 새로 쓰게 하려면 **Regenerate**(재생성)를 클릭하세요. "Regenerate Secret Plot" 창이 뜨면서 확인을 요청합니다. 새로 만들려면 **Regenerate**를, 취소하려면 **Keep Current Arc**를 고르세요.

### 전개는 에이전트에 남습니다

숨은 전개는 **Narrative Director** 에이전트에 저장됩니다. 채팅의 에이전트 실행 기록과 기억을 지워도 전개는 사라지지 않습니다. 전개가 삭제되는 시점은 채팅에서 **Narrative Director** 에이전트를 제거할 때뿐입니다. 에이전트를 제거하려고 하면 숨은 전개가 지워지며 되돌릴 수 없다는 경고가 표시됩니다.

### Secret Plot 프롬프트

**Secret Plot Prompt**(비밀 플롯 프롬프트)에는 Narrative Director가 숨은 전개를 쓰고 갱신할 때 따르는 지침이 들어 있습니다. 기본 제공 프롬프트는 각 전개를 풀어야 할 수수께끼로 짭니다. 모험이나 음모 이야기에는 잘 맞지만, 캐릭터가 이끌어 가는 이야기에는 맞지 않을 수 있습니다.

직접 쓴 지침을 사용하려면 다음 순서를 따르세요.

1. **Agents**를 열고 **Narrative Director**를 편집하세요.
2. **Secret Plot** 섹션에서 **Copy default to edit**(기본값을 복사하여 편집)를 클릭하세요.
3. 텍스트를 고친 뒤 에이전트를 저장하세요.

기본 제공 프롬프트로 돌아가려면 **Reset to default**(기본값으로 초기화)를 클릭한 다음 에이전트를 저장하세요.

프롬프트 끝에 있는 JSON 답변 형식은 그대로 두세요. `description`, `protagonistArc`, 선택 항목인 `characterArc`, `completed`를 담은 `overarchingArc` 객체입니다. 이 형식이 없으면 전개를 읽을 수 없습니다.

이 프롬프트는 에이전트에 저장되므로, 그 Narrative Director를 사용하는 모든 채팅에 적용됩니다.

## 관련 가이드

- [다운로드 가능한 에이전트 레퍼런스](../agents/built-in-agents.md)
- [Roleplay Mode: 시작하기](getting-started.md)
- [지침 기반 생성과 Impersonate](../chats/guided-and-impersonate.md)
