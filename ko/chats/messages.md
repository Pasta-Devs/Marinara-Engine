# 메시지 조작: 편집, 삭제, 스와이프, 재생성

직접 쓴 메시지든 AI가 쓴 메시지든, 모든 메시지에는 툴바가 있습니다. 툴바로 메시지 하나를 편집, 삭제, 재생성하거나 숨길 수 있고, 그 메시지에서 분기를 만들 수도 있습니다.

휴대폰이나 태블릿에서는 메시지를 탭하면, 컴퓨터에서는 메시지에 마우스를 올리면 툴바가 나타납니다.

## 메시지 툴바

가장 자주 쓰는 버튼은 다음과 같습니다.

- **Edit**(편집)는 메시지 텍스트를 바꿉니다.
- **Regenerate**(재생성)는 AI 답변의 새 버전을 모델에 요청합니다. 각 버전을 스와이프라고 부릅니다.
- **Delete**(삭제)는 메시지를 지웁니다.

버튼은 아이콘으로 표시됩니다. 각 버튼의 라벨은 아래와 같습니다. 일부 버튼은 특정 상황에서만 나타납니다.

| 버튼 | 하는 일 |
| --- | --- |
| **Copy**(복사) | 메시지 텍스트를 복사합니다. |
| **Edit** | 메시지를 편집할 수 있게 엽니다. |
| **Regenerate** | 새 스와이프(답변의 다른 버전)를 만듭니다. AI 메시지에만 표시됩니다. Roleplay(롤플레이)에서는 직접 쓴 메시지에도, Conversation(대화)에서는 Impersonate(유저 사칭)로 만든 메시지에도 표시됩니다. |
| **Delete** | 메시지를 삭제합니다. |
| **Translate**(번역) / **Hide translation**(번역 숨기기) | 메시지를 내 언어로 번역하고, 번역을 다시 숨깁니다. |
| **Add reaction**(반응 추가) | 이모지 선택기를 엽니다. Conversation에서만 표시됩니다. |
| **Hide from AI**(AI에게서 숨기기) / **Unhide from AI**(AI에게 다시 표시) | 이 메시지를 모델에 보내지 않거나 다시 보냅니다. Roleplay 그룹 채팅에서는 캐릭터 선택기가 열립니다. |
| **Bookmark, pin or note**(북마크, 핀 또는 메모) | 메시지를 북마크하거나, 기록 한도를 넘어서도 프롬프트에 남도록 고정하거나(채팅당 최대 10개), **Private note**(비공개 메모)를 추가합니다. **Show the note to the narrator character**(내레이터 캐릭터에게 메모 보여 주기)를 켜지 않으면 모델은 메모를 절대 보지 않습니다. 이 설정은 캐릭터가 하나인 채팅과 개별 답변을 쓰는 그룹 채팅에서 작동합니다. |
| **Branch from here**(여기서 분기 생성) | 이 메시지까지의 채팅을 새 분기로 복사합니다. 장면 채팅에는 없습니다. |
| **Clone from here**(여기서 복제) | 이 메시지까지의 장면 채팅을 새 Roleplay로 복사합니다. 장면 채팅에만 있습니다. |
| **Peek prompt**(프롬프트 미리보기) | 이 답변에 쓰인 프롬프트를 그대로 보여 줍니다. 가장 최근 AI 메시지에만 표시됩니다. |
| **Stored guidance**(저장된 지침) | 이 답변을 이끈 방향을 보여 줍니다. 지침이나 Impersonate로 만든 답변에만 표시됩니다. |
| **View model thoughts**(모델의 생각 보기) | 모델이 감춰 둔 추론을 엽니다. 모델이 추론을 돌려준 경우에만 표시됩니다. |
| **Show original before rewrite**(재작성 전 원문 보기) / **Show rewritten version**(재작성된 버전 보기) | 에이전트(답변과 함께 실행되는 보조 기능)가 메시지를 재작성했을 때 원문과 재작성된 텍스트를 오갑니다. |
| **Mark as new start**(새 시작점으로 표시) | Roleplay에서만 표시됩니다. Advanced Memory(Marinara의 장기 기억 기능)가 켜져 있을 때 채팅에 대한 모델의 기억을 이 메시지부터 시작합니다. [Advanced Memory](../agents/memory.md)를 참고하세요. |
| **Pause speaking**(말하기 일시 중지) / **Resume speaking**(말하기 재개) / **Restart speaking**(말하기 다시 시작) | Text to Speech(음성 합성, 메시지를 소리 내어 읽어 주는 기능)가 켜져 있고 읽는 중일 때 음성을 제어합니다. |

더 알아보기: [Peek Prompt](peek-prompt.md), [채팅 분기](branches.md), [장면](../roleplay/scenes.md)(장면 채팅은 채팅에서 갈라져 나온 짧은 Roleplay입니다), [메시지 번역](../integrations/message-translation.md), [Text to Speech(TTS) 설정](../media/tts-setup.md), [지침 기반 생성과 Impersonate](guided-and-impersonate.md), [비공개 메모](../roleplay/getting-started.md#your-private-notes).

## 메시지 편집

1. 메시지에서 **Edit**를 클릭하세요. 텍스트가 편집할 수 있는 입력란으로 바뀝니다.
2. 텍스트를 고치세요.
3. **Save**(저장)를 클릭하거나 <kbd>Ctrl</kbd>+<kbd>Enter</kbd>를 누르세요(Mac에서는 <kbd>Cmd</kbd>+<kbd>Enter</kbd>).
4. 저장하지 않고 그만두려면 **Cancel**(취소)을 클릭하거나 <kbd>Esc</kbd>를 누르세요.

**Settings → General → Input & Editing**(설정 → 일반 → 입력 및 편집)에 있는 설정 2개를 쓰면 편집을 더 빨리 시작할 수 있습니다. 둘 다 기본값은 켜짐입니다.

- **Up Arrow edits last message**(위쪽 화살표로 마지막 메시지 편집): 입력란이 비어 있을 때 <kbd>Up</kbd>을 누르세요.
- **Double-click edits messages**(더블 클릭으로 메시지 편집): Roleplay 메시지를 더블 클릭하거나 두 번 탭하세요.

## 메시지 삭제

1. 메시지에서 **Delete**를 클릭하세요. **Delete message**(메시지 삭제) 창이 열립니다.
2. 선택지 하나를 고르세요.

| 선택지 | 하는 일 |
| --- | --- |
| **Delete only this swipe (1/3)**(이 스와이프만 삭제) | 지금 보고 있는 스와이프를 지웁니다. 스와이프가 둘 이상일 때만 표시됩니다. |
| **Delete all other swipes**(다른 모든 스와이프 삭제) | 지금 보고 있는 스와이프는 남기고 나머지를 지웁니다. 스와이프가 둘 이상일 때만 표시됩니다. |
| **Delete this message**(이 메시지 삭제) | 메시지와 그 메시지의 모든 스와이프를 지웁니다. |
| **Delete more**(추가 삭제) | 이 메시지와 그 아래의 모든 메시지를 선택하고 선택 막대를 엽니다. |
| **Cancel** | 창을 닫습니다. |

선택 막대에서 메시지를 클릭하면 선택에 추가됩니다. **Select all messages above**(위의 모든 메시지 선택)와 **Select all messages below**(아래의 모든 메시지 선택)는 선택 범위를 넓히고, **Unselect all**(모두 선택 취소)은 선택을 비우고, **Delete selected**(선택된 메시지 삭제)는 선택에 남은 메시지를 지웁니다. 막대에는 선택한 메시지 수가 표시됩니다.

"joined the chat" 줄 같은 시스템 메시지는 창 없이 한 번의 클릭으로 삭제됩니다.

## 스와이프: 같은 답변의 다른 안

스와이프는 AI 답변의 한 가지 버전입니다. 메시지 하나가 스와이프를 여러 개 담을 수 있어서, 답변을 비교하고 마음에 드는 것을 남길 수 있습니다. 메시지에 스와이프가 둘 이상 생기면 스와이프 컨트롤이 나타납니다. 컨트롤에는 "2/4"처럼 활성 스와이프와 전체 개수가 표시됩니다.

- **Previous swipe**(이전 스와이프)와 **Next swipe**(다음 스와이프)로 스와이프를 차례로 넘깁니다.
- 숫자 입력란으로 원하는 스와이프로 바로 이동합니다. 번호를 입력하고 <kbd>Enter</kbd>를 누르세요. 입력란의 라벨은 **Jump to swipe 1-N**(1~N번 스와이프로 이동)입니다.
- 가장 최신 스와이프에서는 앞으로 가는 버튼이 **Generate next swipe**(다음 스와이프 생성)로 바뀌고, 새 스와이프를 만듭니다.

마지막 스와이프는 삭제할 수 없습니다. 앱에 "Cannot delete the last remaining swipe"라는 안내가 표시됩니다. 대신 **Delete this message**를 쓰세요.

## 재생성, 이어 쓰기, 다시 시도

이 세 가지는 비슷해 보이지만 하는 일이 다릅니다.

| 동작 | 결과 |
| --- | --- |
| **Regenerate** | 새 스와이프가 생깁니다. 원래 스와이프는 남습니다. 터치 화면에서는 앱이 먼저 "Regenerate this message as a new swipe?"라고 묻습니다. 지침을 걸어 둔 상태에서는 버튼이 **Regenerate (guided)**로 표시됩니다. |
| `/continue` | 새 스와이프 없이 같은 메시지에 텍스트가 더해집니다. |
| 빈 **Send**(전송) | 새 답변이 만들어집니다. |

### 답변 이어 쓰기

입력란에 `/continue`(또는 `/cont`)를 입력해 보내세요. 모델이 직전 답변이 멈춘 지점부터 이어서 씁니다.

```text
/continue
```

Marinara는 새 텍스트 앞에 빈 줄을 하나 넣습니다. 마지막 글자에 곧바로 이어 붙이려면 **Settings → General → Responses → Add a new line before /continue text**(설정 → 일반 → 응답 → /continue 텍스트 앞에 새 줄 추가)를 끄세요.

### 빈 Send로 다시 시도하기

마지막 메시지가 내가 쓴 것이고 입력란이 비어 있으면 **Send**는 전송 대신 다시 시도를 실행합니다. Roleplay에서는 AI가 이미 답한 뒤에도 빈 **Send**로 새 턴을 시작합니다. 이때 앞 답변에 덧붙이는 일은 없습니다. [메시지 보내기와 스트리밍](sending-and-streaming.md#retry-without-retyping)을 참고하세요.

## AI에게서 메시지 숨기기

**Hide from AI**를 클릭하면 이후 턴부터 그 메시지가 프롬프트에서 빠집니다. 메시지는 화면에 그대로 보이고 **Hidden from AI** 라벨이 붙습니다. 다시 보내려면 **Unhide from AI**를 클릭하세요.

Roleplay 그룹 채팅에서는 **Hide from AI**를 누르면 아바타 선택기가 열립니다. 그룹 아바타를 고르면 모두에게서 메시지를 숨기고, 캐릭터를 하나 이상 고르면 그 캐릭터에게만 숨깁니다. 메시지에 붙는 눈 가림 표시로 누가 그 메시지를 볼 수 없는지 알 수 있습니다. 캐릭터가 하나뿐인 채팅에서는 버튼이 곧바로 메시지를 숨기거나 다시 표시합니다.

메시지를 한 캐릭터에게서 숨겨도, 그 캐릭터는 메시지 안의 귓속말은 계속 받고 나머지 부분은 받지 않습니다. 모두에게서 숨기면 귓속말도 함께 빠집니다. [귓속말과 비밀](../roleplay/getting-started.md#whispers-and-secrets)을 참고하세요.

여러 메시지를 범위로 숨기려면 `/hide`와 `/unhide`를 쓰세요. [슬래시 명령어 참조](slash-commands.md)를 참고하세요. 메시지 번호는 첫 메시지를 1로 삼아 셉니다.

Advanced Memory의 **Decide who sees new messages**(새 메시지를 볼 대상 결정)가 켜져 있으면, 캐릭터가 한 명씩 답하는 그룹 채팅에서 새 메시지가 자리에 없는 캐릭터에게서 자동으로 숨겨집니다. 직접 정한 선택이 항상 우선합니다. [새 메시지를 볼 대상 정하기](../agents/memory.md#deciding-who-sees-new-messages)를 참고하세요.

<a id="message-display-toggles"></a>

## 메시지 표시 토글

이 토글은 **Settings → Advanced → Message Tools**(설정 → 고급 → 메시지 도구)에 있습니다.

| 토글 | 기본값 | 표시하는 내용 |
| --- | --- | --- |
| **Show message numbers**(메시지 번호 표시) | 꺼짐 | 메시지마다 번호를 붙입니다. `/goto`, `/hide`, `/unhide`가 쓰는 번호와 같습니다. |
| **Show token usage on messages**(메시지에 토큰 사용량 표시) | 꺼짐 | AI 답변마다 프롬프트 토큰과 완성 토큰 수(토큰은 모델이 세는 작은 텍스트 조각입니다)를 표시하고, 정보가 있으면 캐시 적중과 답변 시간도 함께 표시합니다. |
| **Show model name on messages**(메시지에 모델 이름 표시) | 꺼짐 | 각 답변을 쓴 모델을 표시합니다. |
| **Show "older messages not sent" note**("전송되지 않은 이전 메시지" 안내 표시) | 켜짐 | 이전 메시지가 프롬프트에 다 들어가지 못했을 때 답변 아래에 "1109 older messages not sent" 같은 안내를 표시합니다. 답변이 잘렸거나 비어 있다는 안내는 항상 표시됩니다. |
