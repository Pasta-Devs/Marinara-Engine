# Conversation Mode 프로필(Display Name, About Me, Behavior)

이 가이드에서는 Conversation Mode의 모든 캐릭터와 페르소나가 갖는 작은 채팅 앱 프로필을 설명합니다. 프로필은 표시 이름, "about me" 소개글, 행동 지시문으로 이루어집니다. 이 입력란들은 Roleplay나 Game Mode에서는 쓰이지 않습니다.

이것은 설정 프로필(저장해 둔 채팅 옵션 묶음, [설정 프로필](../chats/settings-profiles.md) 참고)이 아닙니다. 이 모드가 처음이라면 [Conversation Mode: 시작하기](getting-started.md)를 먼저 읽으세요. 페르소나는 나를 대신하는 캐릭터 카드입니다.

## 이 입력란이 있는 곳

이 입력란들은 **Convo**(대화(콘보)) 탭에 있습니다.

1. **Character Editor**에서 캐릭터를, **Persona Editor**에서 페르소나를 여세요. 사이드바에서 **Characters**(캐릭터) 패널을 열거나, 오른쪽 사이드바 상단 바의 사람 아이콘으로 **Personas**(페르소나) 패널을 연 다음 카드를 클릭하면 됩니다([캐릭터 만들기와 편집](../characters/creating-and-editing-characters.md)과 [사용자 페르소나](../characters/personas.md) 참고).
2. **Convo** 탭을 클릭하세요.

이 탭에는 **Convo Display Name**(대화(콘보) 표시 이름), **About Me**(내 소개), **Convo Behavior**(대화(콘보) 동작)가 있습니다. 캐릭터에는 **Weekly schedule**(주간 일정)도 있습니다. **Edit schedule**(일정 편집)이나 **Create schedule**(스케줄 만들기)이 함께 표시됩니다([스케줄](schedules.md) 참고). 또 **Image generation instructions**(이미지 생성 지침)도 있으며, 이는 그 캐릭터의 셀카에 대한 선택적 지시입니다([셀카](selfies.md) 참고).

## 표시 이름 정하기

**Convo Display Name**은 Conversation 채팅에 표시되는 이름입니다. 비워 두면 카드 이름을 씁니다. 이미 주고받은 메시지의 이름은 바로 바뀝니다.

캐릭터에는 **Declare this name on the card in the prompt**(프롬프트에서 카드에 이 이름을 명시합니다)도 있습니다. 이 옵션을 켜면 Marinara가 프롬프트(Marinara가 모델에 보내는 텍스트) 안의 카드 텍스트에 "Conversation display name: X" 같은 줄을 덧붙입니다. 모델은 이 줄로 어떤 카드가 어떤 이름을 쓰는지 알 수 있습니다. 먼저 표시 이름이 있어야 합니다.

## About Me 쓰기

**About Me**는 짧은 소개글입니다. 한두 줄이어도 되고, 이모지 하나나 농담 한마디여도 되고, 비워 두어도 됩니다. Marinara는 매 턴마다 그 자리에 있는 모든 캐릭터와 페르소나의 **About Me**를 프롬프트에 추가합니다. 그래서 모델은 각자가 스스로를 어떻게 소개하는지 알 수 있습니다. 이 동작을 위해 따로 할 일은 없습니다.

채우는 방법은 다음과 같습니다.

- 직접 입력하세요. 툴바의 이모지 버튼은 이모지를 넣습니다. **Revert**(되돌리기)는 현재 편집을 시작하기 전의 텍스트로 되돌립니다.
- 저장된 캐릭터에서 마술봉 버튼(**Generate About Me from this card**(이 카드를 바탕으로 내 소개 생성))을 클릭하세요.
- 홈 화면에서 **Professor Mari**에게 요청하세요. 예를 들어 `Write Luna's About Me as a cryptic one-line bio.`라고 하면 됩니다. Professor Mari는 저장된 프로필을 읽고, 그 캐릭터의 말투로 소개글을 쓴 다음 저장합니다. 평소와 같은 검토 흐름에서 그 변경을 그대로 두거나 되돌릴 수 있습니다.

작동하지 않는 경우: 아직 저장하지 않은 카드에는 마술봉 버튼이 없습니다. 먼저 카드를 저장하세요.

## Convo Behavior 설정하기

**Convo Behavior**는 캐릭터나 페르소나가 Conversation Mode에서 어떻게 행동할지 적는 지시문입니다. 예를 들어 답장을 짧게 소문자로 쓰고 실제 사람처럼 문자를 보내라고 적을 수 있습니다. post-history 지시문은 최근 채팅 기록 뒤에 배치되는 프롬프트 텍스트입니다. 프롬프트를 직접 작성하지 않는다면 기본값을 그대로 두세요. **Insertion**(삽입)으로 프롬프트에서 이 지시문이 들어갈 위치를 고르세요.

| 옵션 | 지시문이 들어가는 위치 |
| --- | --- |
| **Constant — after the card**(기본값) | 항상, 카드 텍스트 바로 뒤. |
| **Constant — before the card** | 항상, 카드 텍스트 바로 앞. |
| **Append to post-history** | post-history 지시문 끝. |
| **Prepend to post-history** | post-history 지시문 맨 앞. |
| **Replace post-history** | post-history 지시문 대신. |
| **Only where {{convo_behavior}} is placed** | 사용자 지정 프롬프트에서 매크로를 넣어 둔 자리에만. |

## 채팅별 About Me 재정의

카드의 **About Me**는 어디서나 쓰이는 기본 소개글입니다. 채팅 하나에만 다른 소개글을 지정할 수도 있습니다.

1. Conversation 채팅에서 캐릭터나 페르소나의 아바타 또는 이름을 클릭하세요. 옆에 프로필 카드가 열립니다(휴대폰에서는 화면 아래에서 올라옵니다).
2. 카드를 읽으세요. 아바타, 이름, 현재 **About Me**가 표시됩니다. 배지에는 **Default**(기본값) 또는 **Chat-specific**(채팅별)이라고 적혀 있습니다. 캐릭터에는 **Online**(온라인), **Away**(자리 비움), **Busy**(다른 용무 중), **Offline**(오프라인) 중 하나도 표시됩니다.
3. **Edit**(편집)를 클릭하세요.
4. 이 채팅에서 쓸 소개글을 입력하세요. **Custom emojis**(사용자 지정 이모지) 탭이 있는 이모지 선택기를 쓸 수 있습니다.
5. **Save**(저장)를 클릭하세요. "Chat-specific about me saved"(채팅별 자기소개 저장됨)라는 메시지가 표시됩니다.

**Cancel**(취소)은 저장하지 않고 편집 모드를 닫습니다. **Revert**는 저장하지 않은 변경을 되돌립니다. **Clear**(지우기)는 기존 재정의를 지우고 카드 기본값으로 돌아갑니다. 빈 소개글을 저장해도 재정의가 사라집니다.

## 캐릭터가 스스로 About Me 바꾸게 하기

고급 옵션입니다. `update_about_me`라는 도구를 쓰면 캐릭터가 대화 도중 직접 자기 소개글을 바꿀 수 있습니다. 기본값은 꺼짐입니다. 쓰려면 **Chat Settings** → **Function Calling**(기능 호출)을 열고 **Enable Tool Use**(도구 사용 활성화)를 켠 다음 `update_about_me` 도구를 추가하세요.

캐릭터는 두 가지 중 하나를 고릅니다.

- Public은 모든 채팅에 보이는 실제 소개글을 바꿉니다. 먼저 내가 승인해야 합니다.
- Chat은 현재 채팅에서만 비공개로 쓰는 소개글을 바꿉니다.

## 사용자 지정 프롬프트용 매크로

프로필이 모델에 전달되는 데 매크로는 필요하지 않습니다. 사용자 지정 프롬프트의 정확한 위치에 값을 넣고 싶을 때만 쓰세요. 모두 Conversation Mode 밖에서는 비어 있습니다. [매크로](../prompts/macros.md)를 참고하세요.

| 매크로 | 값 |
| --- | --- |
| `{{convo_display}}` | 응답하는 캐릭터의 표시 이름. |
| `{{char_about}}` | 캐릭터에 실제로 적용되는 **About Me**. |
| `{{persona_about}}` | 페르소나에 실제로 적용되는 **About Me**. |
| `{{convo_behavior}}` | 캐릭터의 **Convo Behavior**. |

## 관련 가이드

- [Conversation Mode: 시작하기](getting-started.md)
- [캐릭터 만들기와 편집](../characters/creating-and-editing-characters.md)
- [사용자 페르소나: 만들기 및 편집](../characters/personas.md)
- [매크로](../prompts/macros.md)
