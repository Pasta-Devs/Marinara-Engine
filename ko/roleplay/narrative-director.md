# Narrative Director와 Secret Plot

Narrative Director는 Roleplay(롤플레이) 채팅의 줄거리를 이끄는 에이전트(답변과 나란히 실행되는 보조 기능)입니다. **Push Story**(스토리 전개)는 장면이 정체된 느낌일 때 답변 하나를 살짝 밀어 줍니다. **Secret Plot**(비밀 플롯)은 여러 답변에 영향을 주는 숨은 장기 전개를 유지합니다. Roleplay에서만 작동합니다. 에이전트의 전반적인 동작 방식은 [에이전트: 채팅을 도와주는 AI](../agents/agents-overview.md)를 참고하세요.

## 채팅에 Narrative Director 추가하기

1. 채팅 안의 슬라이더 버튼으로 **Chat Settings**(채팅 설정)를 열고 **Agents**(에이전트)로 이동하세요.
2. **Enable Agents**(에이전트 활성화)를 켠 다음 **Narrative Director** 에이전트를 추가하세요.

이제 메시지 입력란 위에 **Push Story** 버튼이 나타나고, **Agents**에 **Narrative Director** 카드가 생깁니다. **Push Story**를 쓰거나 **Secret Plot**을 켜기 전까지 에이전트는 아무 일도 하지 않습니다.

## 이야기를 앞으로 밀기

**Push Story**는 한 번만 작동합니다. 바로 다음 답변에만 영향을 주고 스스로 꺼집니다. 먼저 채팅에 Narrative Director를 추가하세요(위 참고).

1. 메시지 입력란 위의 **Push Story**를 클릭하세요. 어떻게 밀지 묻는 메뉴가 나타납니다.
   - **Naturally**(자연스럽게): 기존 줄거리를 앞으로 밀고 나갑니다. AI가 이야기에 이미 있는 갈래를 진전시킵니다.
   - **Randomly**(무작위로): 장면에 그럴듯한 돌발 상황을 더합니다.
2. 하나를 고르세요. "The next time a character responds, they will push the story forward naturally!"(또는 "randomly!")라는 메시지가 보입니다. 이제 버튼에 **Push Story: Naturally**(스토리 전개: 자연스럽게) 또는 **Push Story: Randomly**(스토리 전개: 무작위로)라고 표시됩니다.
3. 다음 메시지를 보내거나 새 답변을 생성하세요. AI는 그 답변 하나에 전개를 반영해 씁니다.
4. 답변이 끝나면 **Push Story**는 저절로 꺼집니다.

모드는 매번 이 메뉴에서 고릅니다. 기본 모드는 없으며, **Chat Settings**에도 모드 설정이 없습니다.

보내기 전에 취소하려면 켜 둔 버튼을 다시 클릭하세요. "Push Story disarmed."라는 메시지가 보입니다.

작동하지 않는 경우: 답변이 생성되는 동안에는 **Push Story**가 반응하지 않습니다. 답변이 끝날 때까지 기다린 다음 클릭하세요.

## Secret Plot 켜기

**Secret Plot**은 숨겨 둔 장기 전개입니다. AI가 이야기가 어디로 갈지에 대한 비밀 계획을 품고 있습니다. 이 계획은 프롬프트에 들어가지만, 직접 열어 보지 않는 한 화면에 드러나지 않습니다. 기본값은 꺼짐입니다. **Push Story**와 달리 여러 답변에 걸쳐 작동하며, 정해진 주기마다 계획을 갱신합니다.

1. **Chat Settings → Agents**를 열고 **Narrative Director** 카드를 찾으세요.
2. **Secret Plot** 토글을 켜세요. 설명 문구는 "Maintain a hidden long-term arc for this roleplay."입니다.
3. 원하면 **Run Interval**(실행 간격)을 정하세요. 전개를 갱신하기까지 오가는 메시지(내 메시지와 AI의 메시지) 수입니다. 기본값은 8입니다. 1에서 100까지의 정수를 쓸 수 있습니다. 숫자가 작을수록 계획을 더 자주 갱신합니다.

## 숨은 전개 열어 보기와 고치기

**Secret plot**(시크릿 플롯) 패널은 **Run Interval** 아래에 있습니다.

1. **Reveal spoilers**(스포일러 보기)를 클릭하세요. AI가 아직 전개를 쓰지 않았다면 **Reveal empty arc**(빈 아크 공개)로 표시됩니다. 감춰져 있는 동안 패널에는 "Spoilers hidden"이 표시됩니다. 다시 감추려면 **Hide spoilers**(스포일러 숨기기)를 클릭하세요.
2. 원하는 입력란을 고치세요.
   - **Arc description**(서사 설명): 숨겨 둔 전체 줄거리입니다.
   - **Protagonist arc**(주인공 아크): 내 캐릭터가 향하는 방향입니다.
   - **Character arc**(캐릭터 서사): 선택한 캐릭터 한 명이 향하는 방향입니다.
   - **Completed**(완료됨): 전개가 끝나면 체크하세요.
3. 저장 버튼을 눌러 변경 내용을 저장하세요.

지금의 전개를 버리고 AI에게 새로 쓰게 하려면 **Regenerate**(재생성)를 클릭하세요. "Regenerate Secret Plot"이라는 제목의 창이 확인을 요청합니다. 전개를 교체하려면 **Regenerate**를, 취소하려면 **Keep Current Arc**를 고르세요.

전개는 **Narrative Director** 에이전트와 함께 저장됩니다. 채팅의 에이전트 결과를 지워도 전개는 사라지지 않습니다. 채팅에서 에이전트를 제거할 때만 삭제되며, 그 전에 경고가 표시됩니다.

## Secret Plot 프롬프트 바꾸기

**Secret Plot Prompt**(비밀 플롯 프롬프트)에는 Narrative Director가 전개를 쓰고 갱신할 때 따르는 지침이 들어 있습니다. 기본 제공 프롬프트는 각 전개를 풀어야 할 수수께끼로 다룹니다. 모험이나 음모 이야기에는 잘 맞지만, 캐릭터가 이끌어 가는 이야기에는 맞지 않을 수 있습니다.

1. **Agents**를 열고 **Narrative Director**를 편집하세요.
2. **Secret Plot** 섹션에서 **Copy default to edit**(기본값을 복사하여 편집)를 클릭하세요.
3. 텍스트를 고친 다음 에이전트를 저장하세요.

기본 제공 프롬프트로 돌아가려면 **Reset to default**(기본값으로 초기화)를 클릭한 다음 에이전트를 저장하세요.

> **참고:** 프롬프트의 마지막 부분은 지우지 마세요. 그 부분이 답변 형식을 설명하며, 없으면 Marinara가 전개를 읽을 수 없습니다.

프롬프트는 에이전트에 저장되므로, 그 Narrative Director를 쓰는 모든 채팅에 적용됩니다.

## 관련 가이드

- [다운로드 가능한 에이전트 레퍼런스](../agents/built-in-agents.md)
- [Roleplay Mode: 시작하기](getting-started.md)
- [지침 기반 생성과 Impersonate](../chats/guided-and-impersonate.md)
