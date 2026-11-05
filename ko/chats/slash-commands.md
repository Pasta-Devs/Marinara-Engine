# 슬래시 명령어 참조

슬래시 명령어는 메시지 입력란에 `/`로 시작해 입력하는 단축 명령으로, 원하는 동작을 빠르게 실행합니다. 화면을 곧바로 바꾸는 명령어도 있고, 모델에게 글을 쓰게 하는 명령어도 있습니다.

## 슬래시 명령어 사용법

1. 채팅 아래쪽 메시지 입력란에 명령어를 입력하세요.
2. **Send**(전송)를 클릭하세요. 사용 중인 채팅 모드에 **Send on Enter**(엔터 키로 전송)가 켜져 있으면 <kbd>Enter</kbd>를 눌러도 됩니다. [메시지 보내기와 스트리밍](sending-and-streaming.md#send-on-enter)을 참고하세요.

`/`를 입력하는 순간 입력란 위에 일치하는 명령어 목록이 나타납니다. 각 줄에는 명령어 형식과 짧은 설명이 표시됩니다. 줄을 클릭해 입력란에 채우고, 필요한 텍스트를 덧붙인 다음 보내세요. 입력란의 안내 문구도 명령어를 알려 줍니다. Roleplay(롤플레이)에서는 **Write your response, / for commands**(응답을 입력, / 입력 시 명령어), Conversation(대화)에서는 "Message @Alice, / for commands"입니다.

표에는 명령어마다 형식이 해당 줄에 적혀 있습니다. `[name]`이나 `[range]`처럼 대괄호로 묶인 이름은 실제 값으로 바꾸고, 대괄호는 입력하지 마세요. `(optional)`로 표시된 입력은 생략할 수 있습니다. `|`는 선택지를 구분합니다. 명령어 상당수에는 `/continue`의 `/cont`처럼 더 짧은 별칭이 있습니다. 앱의 모든 명령어를 보려면 다음을 입력하세요.

```text
/help
```

일부 명령어는 브라우저에서 실행되며 비용이 들지 않습니다. 다른 명령어는 모델에게 글을 쓰게 하므로 내 계정을 사용하며, 토큰(서비스가 세고 요금을 매기는 단위)을 쓸 수 있습니다.

슬래시 명령어는 Conversation과 Roleplay 메시지 입력란에서 동작합니다. Game에서는 범위나 프롬프트 없이 입력한 `/illustrate`(또는 `/ill`)만 동작하며, 이것도 Game 일러스트가 이미지 계정으로 설정되어 있을 때만 동작합니다. 그 밖에 슬래시로 시작하는 입력은 모두 일반 텍스트로 전송됩니다. Roleplay와 Conversation에서 `/illustrate`, `/selfie`, `/video` 명령어는 Illustrator 에이전트가 필요하며, 이 에이전트를 설치했을 때만 나타납니다.

여러 명령어가 메시지 번호를 사용합니다. Marinara는 채팅의 첫 메시지를 1번으로 셉니다. `/goto`, `/hide`, `/unhide`가 이 번호를 사용합니다. **Show message numbers**(메시지 번호 표시)로 번호를 표시할 수 있습니다. [메시지 조작](messages.md#message-display-toggles)을 참고하세요.

## 채팅 및 메시지 명령어

이 명령어들은 Conversation과 Roleplay에서 동작합니다.

| 명령어 | 동작 |
|---|---|
| `/help` | 모든 슬래시 명령어를 보여 줍니다. |
| `/send` | 답변을 요청하지 않고 페르소나로 메시지를 게시합니다. **Send**와 마찬가지로 매크로가 채워집니다. 형식은 `/send [message]`입니다. |
| `/continue` | 새 메시지 없이 마지막 AI 답변에 글을 더 붙입니다. 별칭은 `/cont`입니다. **Settings → General → Responses → Add a new line before /continue text**(설정 → 일반 → 응답 → /continue 텍스트 앞에 새 줄 추가)는 이어 쓴 글이 빈 줄 다음에서 시작할지, 끊긴 지점에서 바로 시작할지 정합니다. |
| `/goto` | 채팅을 지정한 번호의 메시지로 스크롤합니다. 별칭은 `/jump`, `/scroll`입니다. 형식은 `/goto [number]`입니다. |
| `/hide` | 이후 턴에서 모델이 메시지를 보지 못하게 숨깁니다. 형식은 `/hide [range] [name (optional)]`입니다. |
| `/unhide` | 전체 숨김 처리한 메시지를 되돌립니다. 형식은 `/unhide [range]`입니다. |
| `/sys` | 시스템 메시지를 추가합니다. 채팅에 표시되어 모델을 이끌지만, 어떤 캐릭터도 이 메시지를 말하지 않습니다. 별칭은 `/system`입니다. 형식은 `/sys [message]`입니다. |
| `/macros` | `{{user}}`, `{{char}}` 같은 프롬프트 매크로를 보여 줍니다. 별칭은 `/macro`입니다. |
| `/remind` | 타이머를 설정한 다음 채팅에 알림을 게시합니다. 별칭은 `/reminder`, `/timer`입니다. 형식은 `/remind [time] [message]`입니다. |

예시:

```text
/goto 27
/hide 3-8
/remind 30m check the oven
```

`/hide`와 `/unhide`에는 번호 하나, 범위, 또는 둘을 섞은 형태를 쓸 수 있습니다. `/hide 5`, `/hide 3-8`, `/hide 2-5,9,12`처럼 쓰세요. 숨긴 메시지는 채팅에 남지만 모델은 읽지 않습니다.

Roleplay에서는 범위 뒤에 캐릭터 이름을 붙이면 그 캐릭터에게만 메시지를 숨깁니다. 다른 캐릭터는 계속 볼 수 있습니다.

```text
/hide 3-8 Maukie
/hide 2-5,9 "Powers That Be"
```

공백이 있는 이름은 따옴표로 감싸세요. `/hide Maukie 3-8`처럼 이름을 먼저 쓰는 예전 형식도 계속 동작합니다. 이름이 여러 캐릭터와 일치하면 전체 이름을 쓰세요. 숫자로 된 이름은 `/hide 1 "123"`처럼 따옴표로 감싸 메시지 번호와 구분하세요. 캐릭터별 숨김을 확인하거나 되돌리려면, Roleplay 그룹 채팅에서는 메시지의 **Hide from AI**(AI에게서 숨기기) 아바타 선택기를, 캐릭터가 하나인 채팅에서는 **Unhide from AI**(AI에게 다시 표시)를 쓰세요. `/unhide`는 전체 숨김만 해제합니다.

`/remind`는 `h`(시간), `m`(분), `s`(초)로 적은 시간을 먼저 받고, 그다음 메시지를 받습니다. 알림은 브라우저 세션에 있으므로, 알림이 뜰 때까지 탭을 열어 두세요.

## 스토리 및 롤플레이 명령어

| 명령어 | 동작 |
|---|---|
| `/guided` | 다음 답변을 이끕니다. 별칭은 `/narrator`, `/narrate`, `/nar`입니다. 형식은 `/guided [direction]`입니다. |
| `/as` | 캐릭터로 메시지를 게시하거나, 그 캐릭터에게 답변을 요청합니다. 별칭은 `/respond`입니다. 형식은 `/as [name] [message (optional)]`입니다. |
| `/emote` | 스프라이트 표정을 나열하거나 바꿉니다. 별칭은 `/emotion`, `/sprite`입니다. 형식은 `/emote [expression]`입니다. |
| `/roll` | 주사위를 굴리고 결과를 게시합니다. 별칭은 `/r`, `/dice`입니다. 형식은 `/roll [dice (optional)]`입니다. |
| `/random` | 모델에게 뜻밖의 사건을 넣도록 요청합니다. 별칭은 `/rand`, `/event`입니다. |
| `/scene` | 대화에서 갈라져 나오는 Roleplay 장면을 시작합니다. 별칭은 `/rp`입니다. 형식은 `/scene [description (optional)]`입니다. |
| `/illustrate` | Roleplay 전용입니다. 갤러리 이미지를 생성합니다. Illustrator 에이전트가 필요합니다. 별칭은 `/ill`입니다. 형식은 `/illustrate [range=N-M] [prompt]`입니다. |
| `/html` | Roleplay 전용입니다. 최근 답변 끝에 `a spellbook page` 같은 이야기 속 아티팩트를 하나 만듭니다. 형식은 `/html [what you want]`입니다. |
| `/video` | Roleplay 전용입니다. 최근 답변이나 직접 설명한 내용으로 짧은 클립을 만들어 그 답변 아래에 둡니다. Illustrator의 **First frame**(첫 프레임) 설정을 따릅니다. Illustrator가 필요합니다. 형식은 `/video [description]`입니다. |
| `/impersonate` | 페르소나를 대신해 답변을 씁니다. 별칭은 `/imp`입니다. 형식은 `/impersonate [direction (optional)]`입니다. |
| `/impersonate_prompt` | 이 채팅에서 `/impersonate`가 쓰는 지시문을 설정합니다. 별칭은 `/imp_prompt`입니다. 형식은 `/impersonate_prompt [prompt or reset]`입니다. |

대부분 Roleplay에서 가장 잘 동작합니다. `/scene`은 Conversation에서 실행합니다. `/impersonate`와 `/impersonate_prompt`는 Conversation에서 쓸 수 없습니다.

### 답변 이끌기

```text
/guided make him confess he is lying
/guided respond as "Powers That Be" describe the approaching storm
```

`respond as` 대신 `reply as`와 `respond for`도 쓸 수 있습니다. [지침 기반 생성과 Impersonate](guided-and-impersonate.md)를 참고하세요.

### 캐릭터로 게시하기

메시지를 생략하면 모델이 그 캐릭터의 다음 응답을 씁니다.

```text
/as Dottore "The experiment begins."
/as Dottore
```

### 주사위 굴리기

`/roll 2d6`은 6면체 주사위 2개를 굴립니다. `/roll 1d20+5`처럼 보정값을 더할 수 있습니다. 뒤에 아무것도 적지 않으면 `/roll`은 `1d20`을 굴립니다. 주사위 일부만 남기려면 `kh`(높은 값 남기기)나 `kl`(낮은 값 남기기) 뒤에 개수를 붙이세요. `/roll 4d6kh3`은 가장 높은 3개를 더하고, `/roll 2d20kl1`은 2개 중 낮은 쪽을 남깁니다. `dl`과 `dh`는 대신 가장 낮거나 높은 주사위를 뺍니다. 예를 들면 `/roll 4d6dl1`입니다. 계산에 들어가지 않는 주사위도 흐리게 표시됩니다.

### 스프라이트 바꾸기

스프라이트는 표정을 보여 주는 캐릭터 그림입니다. 사용할 수 있는 표정을 보려면 `/emote`만 입력하고, 바꾸려면 표정 이름을 적으세요.

```text
/emote joy
/emote "Powers That Be" joy
```

이름만 적고 표정을 적지 않으면 그 캐릭터의 표정 목록을 보여 줍니다. 스프라이트를 업로드한 Roleplay 채팅이 필요합니다. [캐릭터 스프라이트](../characters/sprites.md)를 참고하세요.

### 일러스트와 아티팩트 만들기

`/illustrate range=12`는 12번 메시지를 그림으로 만듭니다. `/illustrate range=12-18`은 12번부터 18번까지의 메시지를 Illustrator에 보냅니다. `/goto`와 같은 메시지 번호를 오름차순으로 쓰며, 최대 200개까지입니다. 숨긴 메시지는 제외됩니다. 이미지는 범위에서 마지막으로 보이는 메시지에 첨부됩니다. Advanced Memory를 켜 두면 이전 메시지도 계속 쓸 수 있습니다. `range=`가 없으면 명령어는 현재 장면을 대상으로 합니다. 직접 입력한 프롬프트는 적은 그대로 사용됩니다.

`/html a terminal readout`은 에이전트가 필요 없으며, **HTML Artifacts**(HTML 아티팩트)가 켜져 있든 꺼져 있든 동작합니다. **Roleplay Commands**(Roleplay 명령) 아래에서 **HTML Artifacts**를 켜 두면 내레이터도 `[html: prompt="..."]`로 같은 것을 요청할 수 있습니다. [요청형 아티팩트](../roleplay/getting-started.md#artifacts-on-demand)를 참고하세요.

### 내 답변 쓰기

`/impersonate ask about the weather`는 페르소나의 말투로 답변을 씁니다. 페르소나는 나를 대신하는 캐릭터이며, 프롬프트에서는 `{{user}}`로 표시됩니다. 이 두 명령어는 Conversation에서 쓸 수 없습니다.

## Conversation 모드 명령어

이 명령어들은 Conversation 채팅에서만 동작합니다.

| 명령어 | 동작 |
|---|---|
| `/games` | 설치된 게임 선택기를 엽니다. `/game`과 `/play`도 같은 동작을 합니다. |
| `/selfie` | Illustrator 에이전트로 셀카를 생성합니다. 이름을 붙이면 캐릭터를 고를 수 있습니다. 형식은 `/selfie [name (optional)]`입니다. |
| `/video` | 채팅의 **Video messages**(동영상 메시지) 설정에 따라 캐릭터가 짧은 동영상 메시지를 보내게 합니다. [동영상 메시지](../conversation/selfies.md#video-messages)를 참고하세요. 형식은 `/video [name (optional)]`입니다. |
| `/uno` | 채팅에 있는 캐릭터들과 UNO를 시작합니다. |
| `/chess` | 캐릭터 한 명과 일대일 체스 게임을 시작합니다. |
| `/poker` | 캐릭터들과 텍사스 홀덤을 시작합니다. |
| `/8ball` | 캐릭터 한 명과 일대일 에잇볼 당구를 시작합니다. `/pool`도 같은 동작을 합니다. |
| `/status` | 캐릭터의 접속 상태를 지정하거나 해제합니다. 형식은 `/status [online, idle, dnd, offline or clear] [name]`입니다. |

게임 명령어는 해당 게임의 설정 화면을 열며, 각 명령어는 그 게임 에이전트를 설치했을 때만 나타납니다. 한 채팅에서는 한 번에 한 게임만 할 수 있습니다. [테이블 게임](../conversation/table-games.md)을 참고하세요.

`/status`는 캐릭터의 접속 상태를 덮어씁니다. 상태는 `online`, `idle`, `dnd`(방해 금지), `offline` 중 하나입니다. `clear`는 덮어쓴 상태를 지웁니다. 캐릭터가 여럿인 채팅에서는 맨 뒤에 이름을 붙이세요.

```text
/status idle
/status online Alice
```
