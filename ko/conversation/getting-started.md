# Conversation Mode: 시작하기

이 가이드에서는 메신저형 채팅 모드인 Conversation Mode를 설명합니다. 캐릭터 한 명 이상, 입력창, 위아래로 넘겨 보는 기록이 있어 친구에게 문자를 보내는 것과 같습니다. 게임 마스터도, 장면 그림도 없습니다. 캐릭터가 먼저 메시지를 보내고, 주간 스케줄을 따르고, 셀카를 보내고, 테이블 게임을 즐길 수도 있습니다. 이런 기능은 이 모드에서만 쓸 수 있습니다.

## Conversation 채팅 시작하기

**시작하기 전에:** **Connections**(연결)에서 계정을 추가하고([AI 제공자에 연결하기](../connections/connecting-to-a-provider.md) 참고) 캐릭터를 하나 이상 준비하세요. 페르소나는 나를 대신하는 캐릭터 카드이며 선택 사항입니다([사용자 페르소나](../characters/personas.md) 참고).

1. 채팅 사이드바에서 **CONVO**(대화) 탭을 열고 **New Conversation**(새 대화)을 클릭하세요. 4페이지짜리 설정 마법사가 열립니다.
2. 첫 페이지 **Name & Connection**에서 채팅 이름을 정하고 응답을 쓸 계정을 고르세요.
3. 두 번째 페이지 **Prompt Preset**에서 Conversation 프롬프트용 프리셋을 고르거나 기본값을 그대로 두세요.
4. 세 번째 페이지 **Persona & Characters**에서 페르소나와 캐릭터를 한 명 이상 고르세요.
5. 마지막 페이지 **Automation**에서 캐릭터가 스스로 하는 일의 범위를 고르세요(아래 표 참고).
6. **Start Chatting**을 클릭하세요.

캐릭터가 한 명이면 일대일 채팅이 됩니다. 두 명 이상이면 그룹 채팅이 되며, 따로 켜야 하는 모드는 없습니다. 발언 순서는 [그룹 채팅과 여럿이 나누는 대화](../chats/group-chats.md)를 참고하세요.

작동하지 않는 경우: **Start Chatting**을 쓰려면 계정과 캐릭터가 하나 이상 필요합니다. 마법사를 닫고 나중에 **Chat Settings**(채팅 설정)에서 모두 설정해도 됩니다.

## Automation 옵션 고르기

| 옵션 | 기본값 | 하는 일 |
| --- | --- | --- |
| **Autonomous Messages**(자율 메시지) | 켜짐 | 한동안 아무 말이 없으면 캐릭터가 먼저 메시지를 보냅니다. |
| **Generate Schedules**(스케줄 생성) | 꺼짐 | 캐릭터마다 주간 일과를 만듭니다. **Autonomous Messages**가 켜져 있을 때만 표시됩니다. |
| **Commands**(명령어) | 꺼짐 | 캐릭터가 스스로 하는 동작을 통제하는 마스터 스위치입니다. |

**Generate Schedules**를 켜고, 나타나는 입력란에서 시간대를 고르세요. **Chat Settings**에서는 같은 스위치 이름이 **Schedules**(스케줄)입니다. 스케줄과 먼저 말 걸기 한도는 [캐릭터 스케줄과 자율 메시지](schedules.md)에 있습니다.

나중에 **Chat Settings** → **Autonomous Messaging**(자율 메시지)에서 바꿀 수 있습니다. 캐릭터가 너무 자주 메시지를 보낸다면 그곳에서 **Autonomous Messages**를 끄거나 상태를 **Do Not Disturb**로 바꾸세요.

<a id="choose-which-commands-a-character-can-use"></a>

## 캐릭터가 쓸 수 있는 Commands 고르기

명령은 캐릭터가 스스로 하기로 결정하는 동작입니다. 직접 입력하는 것이 아닙니다. 설정을 마친 뒤 **Chat Settings** → **Agents**(에이전트) → **Commands**를 여세요. 마스터 **Commands** 스위치가 모든 계열을 통제합니다. 이 스위치가 꺼져 있으면 어떤 계열도 동작하지 않습니다.

계열마다 자체 스위치가 있습니다. 직접 켜야 하는 **Videos**를 제외하면 모두 켜진 채로 시작합니다. 선택 사항인 에이전트에 딸린 계열은 **Agents** → **Agent Organizer**에서 그 에이전트를 설치했을 때만 표시됩니다.

| 계열 | 캐릭터가 할 수 있는 일 | 필요한 에이전트 |
| --- | --- | --- |
| **Schedule Updates** | 자신의 현재 상태를 바꿉니다. | 없음 |
| **Cross-Post** | 다른 채팅으로 메시지를 보냅니다. | 없음 |
| **Memories** | 다른 캐릭터를 위한 기억을 만듭니다. | 없음 |
| **Scenes** | 몰입형 장면을 시작합니다. | 없음 |
| **Influence** | 연결된 채팅에 영향을 줍니다. | 없음 |
| **Notes** | 연결된 채팅에 오래 남는 메모를 저장합니다. | 없음 |
| **Reactions** | 이모지 배지로 메시지에 반응합니다. | 없음 |
| **Selfies** | 생성된 셀카를 요청합니다. | Illustrator |
| **Videos** | 짧은 동영상 메시지를 보냅니다. | Illustrator |
| **Music** | 활성 Music Player로 노래를 재생합니다. | Music DJ |
| **Haptics** | 연결된 햅틱 기기를 제어합니다. | Haptic Feedback |
| **Calls** | 통화를 걸어옵니다. | Calls |
| **UNO** | UNO 판을 시작하거나 수락합니다. | UNO |
| **Chess** | 체스 도전을 수락합니다. | Chess |
| **Poker** | Texas Hold'em 테이블에 앉습니다. | Poker |
| **8-Ball Pool** | 포켓볼 한 게임을 준비합니다. | 8-Ball Pool |
| **Tic-Tac-Toe** | 틱택토 도전을 수락합니다. | Tic-Tac-Toe |
| **Rock-Paper-Scissors** | 가위바위보 대결을 수락합니다. | Rock-Paper-Scissors |

**Influence**와 **Notes**는 [Conversation을 Roleplay나 Game에 연결하기](../chats/connected-chats.md)를 참고하세요. 마지막 열은 **Agent Organizer**에서 설치할 에이전트 이름입니다.

<a id="your-presence-status"></a>

## 내 상태 표시

내 상태는 사이드바 아래쪽에 있는 색깔 알약 모양 버튼입니다. 모든 채팅에서 같습니다. 클릭하면 다음 중에서 고를 수 있습니다.

| 상태 | 의미 |
| --- | --- |
| **Active** | 온라인입니다. |
| **Idle** | 자리를 비웠습니다. |
| **Do Not Disturb** | 자율 메시지를 막습니다. |
| **Invisible** | 모델에게 내 상태를 숨깁니다. |

**Active** 상태로 10분 동안 아무것도 하지 않으면 Marinara가 **Idle**로 바꾸고, 돌아오면 다시 **Active**로 바꿉니다. 상태를 직접 고르면 **Active**를 다시 고를 때까지 이 자동 변경이 멈춥니다. **Idle**은 먼저 말 걸기를 막지 않습니다.

알약 옆에는 상태 입력란이 있으며, 비어 있을 때는 "What's up?"(무엇을 하고 있나요?)이 표시됩니다. 지금 하는 일을 여기에 적으면(최대 120자) 캐릭터가 알 수 있습니다. 최근에 입력한 내용은 **Recent status**(최근 상태) 아래에 표시되므로 다시 쓸 수 있습니다.

<a id="react-and-get-notified"></a>

## 반응과 알림

메시지의 **Add reaction**(반응 추가)을 눌러 이모지로 반응하세요. 이후 응답에서 내 반응을 알 수 있습니다. **Reactions** 명령이 켜져 있으면 캐릭터도 내 메시지와 서로의 메시지에 반응할 수 있습니다.

지금 보고 있지 않은 채팅에서 캐릭터가 메시지를 쓰면 화면 가장자리에 아바타 말풍선이 나타납니다. 말풍선을 클릭하면 그 채팅이 열리고, X를 클릭하면 닫힙니다. 휴대폰에서는 말풍선이 여러 개일 때 탭할 수 있는 묶음 하나로 합쳐집니다.

## 알아 두면 좋은 점

Conversation 채팅은 캐릭터 카드의 **First Message**(첫 메시지)를 쓰지 않으며, **Dialogue Highlight Color**(대사 하이라이트 색상)와 **Message Box Color**(메시지 말풍선 색상)도 쓰지 않습니다. **Name Display Color**(이름 색상)는 여전히 각 메시지 위의 이름에 색을 입힙니다. [색상이 적용되는 곳](../characters/colors-and-stats.md#where-your-colors-show)을 참고하세요.

## 관련 기능

- [셀카](selfies.md): 캐릭터가 자신을 생성한 사진을 보냅니다.
- [Conversation 음성 통화와 영상 통화](calls.md)
- [테이블 게임](table-games.md): `/uno`, `/chess`, `/poker`, `/8ball`, `/tictactoe`, `/rps`로 게임을 시작합니다.
- [캐릭터 스케줄과 자율 메시지](schedules.md)
- [Conversation Mode 프로필](profiles.md)
- [사용자 지정 이모지, 스티커, GIF](emoji-stickers-gifs.md)
- [Conversation을 Roleplay나 Game에 연결하기](../chats/connected-chats.md)

## 문제 해결

| 증상 | 해결 방법 |
| --- | --- |
| 캐릭터가 메시지를 너무 자주 보냅니다 | **Autonomous Messages**를 끄거나 **Do Not Disturb**로 바꾸세요. [스케줄](schedules.md)에서 자리 비움 시간을 더 늘려도 됩니다. |
| 그룹 채팅에서 한 캐릭터만 계속 대답합니다 | [그룹 채팅과 여럿이 나누는 대화](../chats/group-chats.md)에서 누가 말할지 설정하세요. |
| 캐릭터가 앞서 나온 내용을 잊어버립니다 | 컨텍스트 창(모델이 한 번에 읽는 글의 양)이 더 큰 모델을 쓰거나, 중요한 사실을 로어북 항목에 넣으세요. |
| 셀카가 캐릭터처럼 보이지 않습니다 | [셀카](selfies.md)를 참고하세요. |

더 많은 도움말은 [Marinara Engine 문제 해결](../TROUBLESHOOTING.md)을 참고하세요.
