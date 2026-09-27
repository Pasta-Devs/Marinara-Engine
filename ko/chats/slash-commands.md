# 슬래시 명령어 참조

이 가이드에서는 Marinara Engine 채팅에서 입력할 수 있는 슬래시 명령어를 정리합니다. 슬래시 명령어는 메시지 입력란에 빗금(/)으로 시작하는 짧은 문구를 입력해 원하는 동작을 바로 실행하는 기능입니다. 화면에서 곧바로 처리되는 명령어도 있고, AI에게 글을 쓰게 하는 명령어도 있습니다.

## 슬래시 명령어 사용법

슬래시 명령어는 채팅 아래쪽 메시지 입력란에 입력한 다음 **Send**(전송)를 눌러 실행합니다. **Settings**(설정)에서 사용 중인 채팅 모드에 **Send on Enter**(엔터 키로 전송) 옵션이 켜져 있으면 Enter로도 보낼 수 있습니다. 기본값으로 Conversation(대화) 채팅에서는 Enter가 전송이고, Roleplay(롤플레이) 채팅에서는 줄바꿈입니다. 메시지 입력란은 슬래시 명령어를 쓸 수 있다고 알려 줍니다. Roleplay 채팅의 안내 문구는 **Write your response, / for commands**입니다. Conversation 채팅에서는 "Message @Alice, / for commands"처럼 캐릭터 이름이 들어갑니다. 캐릭터가 둘 이상인 대화라면 캐릭터 이름 대신 채팅 이름이 표시됩니다.

빗금을 입력하는 순간 입력란 위에 조건에 맞는 명령어 목록이 작게 뜹니다. 각 줄에는 인수를 포함한 명령어 형식과 짧은 설명이 있습니다. 줄을 클릭하거나 탭하면 그 명령어가 입력란에 채워지고, 뒤에 필요한 내용을 덧붙여 보내면 됩니다.

`[name]`이나 `[range]`처럼 대괄호 안에 있는 이름은 실제 값으로 바꾸고, 대괄호 자체는 입력하지 마세요. `(optional)`로 표시된 인수는 생략할 수 있습니다. `|`는 선택지를 구분하며, `prompt|reset` 같은 값이나 전체 명령어 형식 중 하나를 고르라는 뜻입니다.

명령어 상당수에는 짧은 별칭이 있습니다. 예를 들어 `/continue`와 별칭 `/cont`는 완전히 같은 동작입니다. 앱 안에서 전체 목록을 보고 싶을 때는 언제든 다음 명령어를 실행하세요.

```
/help
```

일부 명령어는 브라우저에서 처리되어 채팅을 즉시 바꾸며 비용이 들지 않습니다. 반면 AI에게 글을 생성하게 하는 명령어는 연결된 제공자를 사용하므로 토큰을 소모할 수 있습니다. 토큰은 대부분의 AI 제공자가 글의 양을 재고 요금을 매기는 단위입니다. 아래 표에 명령어별 동작을 정리했습니다.

슬래시 명령어는 **Conversation**과 **Roleplay** 메시지 입력란에서 동작합니다. **Game** 모드에서는 `/illustrate`만 슬래시 명령어로 동작하고, 빗금으로 시작하는 나머지 입력은 모두 일반 텍스트로 전송됩니다.

몇몇 명령어는 메시지 번호를 사용합니다. Marinara는 채팅의 첫 메시지를 1번으로 두고 2번, 3번 순서로 번호를 매깁니다. `/goto`, `/hide`, `/unhide` 같은 명령어가 이 번호를 사용합니다.

## 채팅 및 메시지 명령어

채팅과 그 안의 메시지를 관리하는 명령어입니다. **Conversation**과 **Roleplay** 채팅에서 동작합니다.

| 명령어 | 별칭 | 동작 |
|---|---|---|
| `/help` | | 모든 슬래시 명령어를 보여 줍니다. |
| `/send [message]` | | 생성을 시작하지 않고 페르소나 이름으로 메시지를 게시합니다. |
| `/continue` | `/cont` | 새 메시지를 보내지 않고 마지막 AI 답변을 이어서 씁니다. 이어 쓰는 글이 빈 줄 다음에서 시작할지, 끊긴 지점에 바로 붙을지는 **Settings → General → Responses**의 **Add a new line before /continue text** 옵션이 결정합니다. |
| `/goto [number]` | `/jump`, `/scroll` | 지정한 번호의 메시지 위치로 채팅을 스크롤합니다. |
| `/hide [range] [name (optional)]` | | 이후 턴에서 AI가 보지 못하도록 메시지를 하나 이상 숨깁니다. |
| `/unhide [range]` | | 숨긴 메시지를 다시 AI에게 보이게 합니다. |
| `/sys [message]` | `/system` | 시스템 메시지를 추가합니다. 채팅에 표시되어 AI를 이끌지만, 어떤 캐릭터의 대사도 아닙니다. |
| `/macros` | `/macro` | `{{user}}`, `{{char}}`처럼 지원되는 프롬프트 매크로를 보여 줍니다. |
| `/remind [time] [message]` | `/reminder`, `/timer` | 타이머를 걸어 두었다가 채팅에 알림 메시지를 남깁니다. |

27번 메시지로 이동하려면 다음과 같이 입력하세요.

```
/goto 27
```

`/hide`와 `/unhide`에는 번호 하나, 범위, 또는 둘을 섞은 형태를 쓸 수 있습니다. 예를 들어 아래는 3번부터 8번까지 숨깁니다.

```
/hide 3-8
```

메시지 하나는 `/hide 5`, 여러 개는 `/hide 2-5,9,12`처럼 쓸 수도 있습니다. 캐릭터 이름을 생략하면 모든 캐릭터에게 숨겨집니다. 숨긴 메시지는 채팅에 남지만 AI는 다음 턴에 읽지 않습니다. 전체에 대해 숨긴 메시지를 복원하려면 `/unhide`에 같은 형식의 번호 목록을 지정하세요.

**Roleplay**에서는 범위 뒤에 캐릭터 이름을 붙여 그 캐릭터에게만 메시지를 숨길 수 있습니다.

```
/hide 3-8 Maukie
/hide 2-5,9 "Powers That Be"
```

다른 캐릭터의 접근 범위는 바뀌지 않습니다. 이름을 먼저 쓸 때 공백이 있는 이름은 따옴표로 감싸세요. 기존의 `/hide Maukie 3-8`과 `/hide "Powers That Be" 2-5,9` 형식도 계속 사용할 수 있습니다. 여러 캐릭터와 일치하면 전체 이름을 쓰세요. 숫자로 된 캐릭터 이름은 `/hide 1 "123"`처럼 따옴표로 감싸 메시지 번호와 구분하세요. Roleplay 그룹 채팅에서는 메시지의 **Hide from AI**(AI에게 숨기기) 아바타 선택기를 사용해 캐릭터별 숨김을 확인하거나 해제하세요. 캐릭터가 하나인 Roleplay 채팅에서는 메시지의 **Unhide from AI**(AI에게 다시 표시) 동작을 사용하세요. `/unhide`는 전체 숨김만 해제합니다.

`/remind` 명령어는 시간을 먼저, 그다음 메시지를 받습니다. 시간은 `h`가 시간, `m`이 분, `s`가 초입니다. 아래 예는 30분 뒤에 알려 줍니다.

```
/remind 30m check the oven
```

알림은 브라우저 세션에 남아 있으므로, 알림이 뜰 때까지 탭을 열어 두세요.

## 스토리 및 롤플레이 명령어

이야기를 이끌고, 캐릭터를 연기하고, 그림을 더하는 명령어입니다. 대부분 **Roleplay** 채팅에서 가장 잘 동작합니다. 예외는 `/scene`으로, 이 명령어는 **Conversation** 채팅에서 실행합니다.

| 명령어 | 별칭 | 동작 |
|---|---|---|
| `/guided [direction]` \| `/guided respond for [name] [direction (optional)]` | `/narrator`, `/narrate`, `/nar` | 다음 AI 답변을 원하는 방향으로 이끕니다. |
| `/as [name] [message (optional)]` | `/respond` | 캐릭터 이름으로 메시지를 올리거나, 특정 캐릭터에게 답변을 요청합니다. |
| `/emote [expression (optional)]` \| `/emote "[name]" [expression (optional)]` | `/emotion`, `/sprite` | 캐릭터의 스프라이트 표정을 보여 주거나 바꿉니다. |
| `/roll [dice (optional)]` | `/r`, `/dice` | 주사위를 굴리고 결과를 올립니다. |
| `/random` | `/rand`, `/event` | 이야기에 뜻밖의 사건을 넣도록 AI에 요청합니다. |
| `/scene [description (optional)]` | `/rp` | Conversation 채팅에서 실행합니다. 그 대화에서 갈라져 나오는 새 Roleplay 장면을 시작합니다. |
| `/illustrate [range=N\|range=N-M (optional)] [prompt (optional)]` | `/ill` | 현재 채팅에 쓸 갤러리 이미지를 생성합니다. |
| `/impersonate [direction (optional)]` | `/imp` | 페르소나를 대신해 답변을 씁니다. |
| `/impersonate_prompt [prompt\|reset]` | `/imp_prompt` | 이 채팅에서 `/impersonate`가 사용할 지시 내용을 설정합니다. |

**Roleplay**에서 `/illustrate range=12`는 12번 메시지를 그림으로 만들고, `/illustrate range=12-18`은 12~18번 메시지를 Illustrator에 전달합니다. `/goto`와 같은 메시지 번호를 오름차순으로 지정하며, 최대 200개까지 선택할 수 있습니다. 숨긴 메시지는 제외됩니다. 이미지는 범위의 마지막으로 보이는 메시지에 첨부되며, 프롬프트를 검토하는 동안 새 메시지가 도착해도 선택 범위는 유지됩니다. Advanced Memory를 켠 상태에서도 이전 메시지를 사용할 수 있습니다. `range=`가 없으면 현재 장면을 대상으로 하는 기존 동작을 유지합니다. 선택적으로 입력한 프롬프트는 이전과 같이 직접 사용됩니다.

다음 답변을 이끌려면 `/guided` 뒤에 원하는 방향을 적으세요.

```
/guided make him confess he is lying
```

Roleplay 그룹 채팅에서는 `/guided respond for [name] [direction (optional)]`로 응답할 캐릭터를 선택하세요. 예를 들면 다음과 같습니다.

```
/guided respond for "Powers That Be" describe the approaching storm
```

`/as [name] [message (optional)]`로 캐릭터 이름으로 텍스트를 게시하세요. 메시지를 생략하면 모델이 그 캐릭터의 다음 응답을 생성합니다.

```
/as Dottore "The experiment begins."
/as Dottore
```

`/roll` 명령어는 주사위 표기법을 읽습니다. 아래는 6면체 주사위 2개를 굴립니다.

```
/roll 2d6
```

`/roll 1d20+5`처럼 보정값을 더할 수도 있습니다. `/roll` 뒤에 아무것도 적지 않으면 Marinara가 `1d20`을 굴립니다.

스프라이트는 표정을 담은 캐릭터 그림입니다. `/emote` 명령어는 그중 어떤 그림을 보여 줄지 바꿉니다. `/emote`만 입력하면 사용할 수 있는 표정 목록이 나오고, 표정 이름을 적으면 그 표정으로 바뀝니다.

```
/emote joy
```

캐릭터 하나를 지정하려면 `/emote "[name]" [expression (optional)]`를 사용하세요. 예를 들어 `/emote "Powers That Be" joy`입니다. 표정을 생략하면 해당 캐릭터가 사용할 수 있는 표정 목록을 보여 줍니다.

스프라이트 전환은 스프라이트를 업로드해 둔 Roleplay 채팅에서만 됩니다. 추가하는 방법은 [캐릭터 스프라이트](../characters/sprites.md)를 참고하세요.

페르소나는 채팅에서 자신을 대신하는 캐릭터이며, 프롬프트에서는 `{{user}}`로 표시됩니다. `/impersonate` 명령어는 그 자리를 대신해 답변을 씁니다. 뒤에 방향을 덧붙일 수도 있습니다.

```
/impersonate ask about the weather
```

`/impersonate`와 `/impersonate_prompt`는 **Conversation** 채팅에서 쓸 수 없습니다. 지침 기반 생성과 Impersonate를 처음부터 끝까지 살펴보려면 [지침 기반 생성과 Impersonate](guided-and-impersonate.md)를 참고하세요.

## Conversation 모드 명령어

**Conversation** 채팅에서만 동작하는 명령어입니다.

| 명령어 | 동작 |
|---|---|
| `/games` | 설치된 Conversation 게임 선택기를 엽니다. `/game`과 `/play`도 같은 동작을 합니다. |
| `/selfie [name (optional)]` | 설치된 Illustrator 에이전트로 셀피를 생성합니다. 이름을 붙이면 캐릭터를 선택할 수 있습니다. |
| `/uno` | 채팅에 있는 캐릭터들과 UNO 게임을 시작합니다. |
| `/chess` | 캐릭터 한 명과 일대일 체스 게임을 시작합니다. |
| `/poker` | 캐릭터들과 텍사스 홀덤 포커 게임을 시작합니다. |
| `/8ball` | 캐릭터 한 명과 일대일 에잇볼 당구 게임을 시작합니다. `/pool`도 같은 동작입니다. |
| `/status [online\|idle\|dnd\|offline\|clear] [name (optional)]` | 캐릭터의 접속 상태를 지정하거나 해제합니다. |

`/uno`, `/chess`, `/poker`, `/8ball` 명령어는 해당 게임의 설정 화면을 엽니다. 한 채팅에서는 한 번에 한 게임만 진행할 수 있습니다. 규칙과 옵션은 [테이블 게임](../conversation/table-games.md)을 참고하세요.

`/status` 명령어는 캐릭터의 접속 상태를 임의로 바꿉니다. 상태 값은 `online`, `idle`, `dnd`(방해 금지), `offline`입니다. 지정한 상태를 해제하려면 `clear`를 쓰세요. 아래는 캐릭터를 자리 비움으로 바꿉니다.

```
/status idle
```

캐릭터가 둘 이상인 채팅에서는 `/status online Alice`처럼 맨 뒤에 캐릭터 이름을 적으세요.

## 관련 가이드

- [메시지 조작](messages.md)
- [지침 기반 생성과 Impersonate](guided-and-impersonate.md)
- [테이블 게임](../conversation/table-games.md)
- [매크로](../prompts/macros.md)
