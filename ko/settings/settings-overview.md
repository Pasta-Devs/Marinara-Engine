# 설정 개요

이 가이드에서는 Marinara Engine의 **Settings**(설정) 패널 전체를 살펴봅니다. 탭 6개가 각각 무엇을 담당하는지 정리하고, **General**(일반) 탭은 자세히 설명합니다. 채팅 글에 서식을 입히는 **Text Rules**(텍스트 규칙), 그리고 설정이 여러 기기 사이에서 동기화되는 방식까지 다룹니다.

## Settings 패널과 탭 6개

상단 바의 톱니바퀴 아이콘을 눌러 **Settings**를 여세요. 패널 맨 위에는 **Search settings**(설정 검색) 입력란이 있습니다. `delete`, `streaming`, `quotes` 같은 단어를 입력하면 Marinara가 해당 항목으로 바로 이동합니다. 인터페이스 언어로 된 설정 이름이나 영어 이름으로 설정을 찾을 수 있습니다.

패널에는 탭이 6개 있습니다. 각 탭이 담당하는 내용은 아래 표와 같습니다.

| 탭 | 설정하는 내용 |
| --- | --- |
| **General** | 앱 동작, 알림, 응답, 입력, 텍스트 규칙, 게임 재생. |
| **Appearance**(모양) | 테마, 색상, 폰트, 채팅 배치, 모션, 배경. |
| **Generations**(생성) | 이미지와 동영상 기본값, 재사용할 수 있는 프롬프트 템플릿. |
| **Addons**(애드온) | Professor Mari가 만든 샌드박스 격리 Personal Extension 초안, 필요할 때만 잠금을 푸는 External Extensions, 사용자 지정 테마. |
| **Imports**(가져오기) | 전체 프로필 복원과 다른 앱에서 가져오기. |
| **Advanced**(고급) | 관리자 접근, 선택적 기능 스위치, 업데이트, 메시지 도구, 백업, 되돌릴 수 없는 초기화. |

각 탭을 더 자세히 다루는 곳은 다음과 같습니다.

- **General**: 이 페이지에서 설명합니다(아래 항목 참고).
- **Appearance**: [모양 설정](../appearance/appearance-settings.md)을 참고하세요.
- **Generations**: [이미지 스타일 프로필](../media/style-profiles.md)과 [장면 동영상 생성](../media/scene-video.md)을 참고하세요.
- **Addons**: [개인 확장](../extending/personal-extensions.md)과 [사용자 지정 CSS 테마](../appearance/custom-css-themes.md)를 참고하세요.
- **Imports**: [SillyTavern에서 가져오기](../data/importing-from-sillytavern.md)와 [Marinara 백업과 복원](../data/backup-and-restore.md)을 참고하세요.
- **Advanced**: 아래 **Message Tools**(메시지 도구) 항목과 [기능 스위치](../configuration/features.md), 그리고 [Marinara Engine 업데이트](../UPGRADING.md), [원격 접근](../REMOTE_ACCESS.md), [데이터 지우기와 초기화](../data/clearing-data.md)를 참고하세요.

## Settings의 General 탭

**General** 탭은 항목 6개로 나뉩니다. 이 페이지에서 전부 다루는 것은 **App Behavior**(앱 동작)와 **Text Rules** 두 가지입니다. 나머지는 여기서 요점만 소개하고, 자세한 내용은 각각의 가이드에서 설명합니다.

- **App Behavior**: 언어, 삭제 시 안전 확인, 표시/숨김 토글. 아래에서 설명합니다.
- **Notifications**(알림): 알림음과 브라우저용, Android 앱용 개별 설정. **Custom sound**(사용자 지정 소리)에는 MP3, WAV, OGG, M4A/MP4, WebM 형식의 파일을 10 MB까지 올릴 수 있고, 이 서버에 연결된 모든 기기에서 Marinara 기본 알림음 대신 이 소리가 울립니다. 미리 듣기, 교체, 제거는 언제든 할 수 있습니다. 읽을 수 없는 파일을 올리면 기본 알림음으로 돌아가고, 올린 파일은 백업과 프로필 내보내기에도 함께 들어갑니다. **Background Notifications**(백그라운드 알림)는 Conversation(대화)의 자율 메시지를 알려 주고, **Generation Completion Notifications**(생성 완료 알림)는 Conversation, Roleplay(롤플레이), Game 모드에서 직접 시작한 응답을 알려 줍니다. 둘 다 Marinara를 열어 둔 채 다른 창을 보고 있을 때 작동하며, 메시지 내용은 표시하지 않습니다.
- **Responses**(응답): 응답을 스트리밍하고 저장하고 페이지로 나누는 방식. [메시지 보내기와 스트리밍](../chats/sending-and-streaming.md)을 참고하세요.
- **Input & Editing**(입력 및 편집): 메시지 입력란과 빠른 편집 기능. [메시지 조작](../chats/messages.md)을 참고하세요.
- **Text Rules**: 채팅 글에 적용되는 서식. 아래에서 설명합니다.
- **Game Playback**(게임 재생): Game Mode(게임 모드)에서 읽어 나가는 방식과 화면 이동.

## App Behavior

이 항목은 **Settings** > **General** > **App Behavior**에 있습니다. 매일 쓰는 앱 동작과 표시/숨김 토글 몇 가지를 모아 두었습니다.

- **Language**(언어): 앱 인터페이스 언어를 고릅니다. Marinara는 현재 아랍어, 중국어 간체, 영어,
  프랑스어, 독일어, 힌디어, 일본어, 한국어, 폴란드어, 브라질 포르투갈어, 러시아어, 스페인어를 지원합니다. 아랍어는
  오른쪽에서 왼쪽으로 읽는 배치를 씁니다. 아직 번역되지 않은 인터페이스 문구는 영어로 표시됩니다. 이 설정이 바꾸는 것은
  Marinara의 조작 화면과 안내문뿐이며, 모델에 보내는 프롬프트나 채팅 내용은 바뀌지 않습니다. 번역을 개선하거나 다른
  언어를 추가하고 싶다면 [UI 지역화](../development/localization.md)를 참고하세요.
- **Documentation Language**: Marinara에 들어 있는 가이드의 언어를 위의 인터페이스 언어와 따로 고릅니다. 영어는 처음부터 들어 있어 다운로드하지 않습니다. 영어가 아닌 언어를 고르면 **Download & Replace**가 나타나고, 그 언어 팩을 한 번 다운로드한 뒤 이전 팩을 지웁니다. 즉, 다운로드된 언어는 항상 하나뿐입니다. 아직 번역되지 않은 가이드는 작은 `EN` 배지와 함께 영어로 열리며, 가이드 검색은 현재 사용 중인 언어로 작동합니다. 고른 언어는 업데이트 후에도 유지되고, 번역이 바뀐 팩은 업데이트 뒤에 자동으로 새로 받습니다. 다운로드한 가이드가 사라지거나 손상되면 **Fix documentation** 버튼이 나타납니다. 이 버튼은 팩을 다시 다운로드하고, 다운로드 위치에 접근할 수 없을 때는 가이드를 영어로 되돌립니다.
- **Confirm before deleting**(삭제 전 확인하기): 기본값은 켜짐입니다. 켜 두면 Marinara가 채팅, 캐릭터를 비롯한 항목을 영구히 삭제하기 전에 확인합니다. 실수로 지우는 일을 막으려면 켜 두세요.
- **Hide chat Help button**(채팅 도움말 버튼 숨기기): 기본값은 꺼짐입니다. 켜면 Conversation, Roleplay, Game 채팅에서 **Help**(도움말) 버튼이 사라집니다.
- **Show Android status bar**(Android 상태 표시줄 표시): 기본값은 꺼짐이며, Marinara Engine Android 앱에서만 작동합니다. 켜면 시간, 배터리 잔량, 알림 아이콘이 Marinara 위에 계속 표시됩니다.
- **Achievements**(업적): 기본값은 켜짐입니다. 켜면 홈 화면에 **Achievements** 북마크와 달성 알림이 표시됩니다. 선택 사항인 **Achievements** 위젯은 홈 레이아웃에 추가한 경우에 나타납니다. 끄면 기록은 조용히 계속됩니다. [업적](../home/achievements.md)을 참고하세요.
- **Music Player**(음악 플레이어): 기본값은 켜짐입니다. 켜면 작은 Music Player가 표시됩니다. **Agents**(에이전트) > **Download Agents**(에이전트 다운로드)에서 받는 **Music DJ** 에이전트가 필요하며, 설치하기 전까지 스위치는 흐리게 표시됩니다. [Music DJ](../media/music.md)를 참고하세요.
- **Search and Professor Mari settings**(검색 및 Professor Mari 설정): **Open**(열기)을 선택하면 해당 설정 페이지로 이동합니다. Search와 Professor Mari의 설정은 모두 이 페이지에 있으며 다음 그룹으로 나뉩니다.

  - **Search**(검색): 필드 개선 제안과 검색 기록.
  - **Quick answers**(빠른 답변): **Quick answers in Search**(검색의 빠른 답변), **Answer with**(답변 모델), **Wait after typing**(입력 후 대기 시간).
  - **Search window**(검색 창)와 **Professor Mari window**(Professor Mari 창): 창마다 **Height**(높이)와 **Width**(너비) 설정이 있습니다. 이 그룹은 휴대폰에서는 표시되지 않습니다.
  - **Professor Mari**: Ask Professor Mari from Search(검색에서 Professor Mari에게 묻기), 권한 모드, **Runtime**(런타임), 답장 칩, 변경 카드가 열리는 방식, Enter sends to Professor Mari(Enter로 Professor Mari에게 전송).
  - **Around the app**(앱 곳곳에서): Mini Professor Mari visits(Mini Mari의 깜짝 방문).
  - **Appearance**: Professor Mari의 외형. 외형 팩마다 Professor Mari의 초상화가 표시됩니다. 사용 중인 팩에는 **In use**(사용 중)가 표시됩니다. 잠긴 팩에는 잠금 해제까지 쌓은 플레이 시간이 표시됩니다.

  Search의 톱니바퀴를 눌러도 같은 페이지가 열립니다. 이 설정 중 무엇이든 새 이름이나 예전 이름으로 검색하면 바로 그 설정으로 이동합니다.

## Text Rules

이 항목은 **Settings** > **General** > **Text Rules**에 있습니다. 여기의 규칙은 채팅 글을 다루는 방식을 바꿉니다. **Bold dialogue in quotes**(따옴표 안의 대사를 굵게 표시)와 **Convert LaTeX symbols**(LaTeX 기호 변환)는 화면 표시만 바꾸므로 저장된 메시지는 건드리지 않습니다. **Quote style**(따옴표 스타일)은 성격이 다릅니다. 입력해서 저장하는 글의 따옴표 자체를 다시 씁니다.

### Bold dialogue in quotes

기본값은 켜짐입니다. 켜면 따옴표 안의 글이 굵게 표시됩니다. 예를 들어 다음 문장을 보세요.

```
"I missed you," she said.
```

**Bold dialogue in quotes**가 켜져 있으면 `I missed you` 부분이 굵게 나타납니다. 대사 색상만 남기고 굵은 표시를 없애려면 끄세요.

### Convert LaTeX symbols

기본값은 켜짐입니다. 일부 모델은 수식을 LaTeX 명령으로 씁니다. 이 설정을 켜면 `\rightarrow`, `\neq`, `\times`, `\alpha` 같은 흔한 명령이 원래 기호로 표시됩니다. 예를 들어 `\times`는 곱셈 기호 `×`로, `\alpha`는 그리스 문자 `α`로 표시됩니다. 코드 조각은 그대로 둡니다.

### Quote style

따옴표를 어떤 형태로 통일할지 고릅니다. 위의 두 규칙과 달리 이 설정은 글 자체를 바꿉니다. 입력해서 저장하는 메시지가 고른 형태로 다시 쓰입니다. 선택지는 두 가지입니다.

- **Straight**: `"Hello," it's me.`처럼 타자기식 곧은 부호를 그대로 씁니다. 기본값입니다.
- **Typographic**: 곧은 부호를 굽은 따옴표와 아포스트로피로 바꿉니다.

### Load images from other websites in messages

기본값은 꺼짐입니다. 꺼져 있으면 메시지, 인사말, 카드 미리보기에 있는 다른 웹사이트의 이미지 대신 그 웹사이트 이름과 **Load image**(이미지 불러오기) 버튼이 표시되므로, 메시지가 스스로 다른 사이트에 접속할 수 없습니다. **Load image**를 선택하면 그 이미지가 표시되며, Marinara는 이 선택을 모든 기기에서 기억합니다. 모든 이미지를 바로 표시하려면 이 설정을 켜세요. 갤러리 그림, 아바타, 스프라이트처럼 Marinara에 저장된 이미지는 항상 표시됩니다.

## Responses와 Input & Editing

이 두 **General** 항목은 응답이 도착하는 방식과 글을 쓰고 고치는 방식을 조정합니다. 각 기능과 자세한 가이드 링크는 다음과 같습니다.

**Responses** 항목에서 설정하는 내용입니다.

- **Enable streaming**(스트리밍 활성화): AI가 쓰는 글을 생성되는 대로 한 단어씩 표시합니다.
- **Streaming speed**(스트리밍 속도): 스트리밍되는 글이 표시되는 속도입니다.
- **Trim incomplete sentences from the response**(완성되지 않은 모델 출력 끝부분 제거): 저장하기 전에 끝부분의 미완성 문장을 잘라냅니다.
- **Add a new line before /continue text**(/continue 텍스트 앞에 새 줄 추가): `/continue`로 덧붙는 텍스트를 빈 줄 다음에서 시작합니다. 기본값은 켜짐입니다.
- **Messages per page**(한 번에 표시할 메시지 수): 한 번에 불러올 메시지 수입니다.

자세한 내용은 [메시지 보내기와 스트리밍](../chats/sending-and-streaming.md)에 있습니다.

**Input & Editing** 항목에서 설정하는 내용입니다.

- **Send on Enter**(엔터 키로 전송): Enter를 눌렀을 때 메시지를 보낼 모드를 고릅니다.
- **Keep guidance after regenerating**(재생성 후 지침 유지): 지침을 적용한 재생성 뒤에도 방향을 메시지 입력란에 남겨 둡니다. 기본값은 켜짐입니다.
- **Add CYOA choices to the message box instead of sending them**(CYOA 선택지를 보내는 대신 메시지 입력창에 추가): 클릭한 CYOA 선택지가 메시지 입력란에 들어가므로, 보내기 전에 고칠 수 있습니다.
- **Quick replies**(퀵 리플라이): 전송 버튼 옆에 다른 초안 작업 버튼을 추가합니다. [지침 기반 생성과 Impersonate](../chats/guided-and-impersonate.md)를 참고하세요.
- **Speech-to-text microphone**(음성-텍스트 변환 마이크): 채팅 입력란에 마이크 버튼을 표시합니다.
- **Intuitive swipe navigation**(직관적인 스와이프 탐색): 화살표 키나 터치 스와이프로 다른 응답 사이를 오갑니다.
- **Reroll past the newest swipe**(최신 스와이프 이후 다시 생성): 가장 새로운 스와이프에서 한 번 더 스와이프하면 새 응답을 만듭니다.
- **Up Arrow edits last message**(위쪽 화살표로 마지막 메시지 편집): 입력란이 비어 있을 때 Up Arrow를 누르면 마지막 메시지를 편집합니다.
- **Double-click edits messages**(더블 클릭으로 메시지 편집): Roleplay 메시지를 더블 클릭하면 편집합니다.

자세한 내용은 [메시지 조작](../chats/messages.md)에 있습니다.

## Message Tools

**Message Tools** 항목은 **Settings** > **Advanced** > **Message Tools**에 있습니다. 표시와 복구 관련 토글을 모아 둔 곳입니다. 아래 토글은 **Show context usage**(컨텍스트 사용량 표시)와 **Show "older messages not sent" note**("전송되지 않은 이전 메시지" 안내 표시)만 기본값이 켜짐이고, 나머지는 모두 기본값이 꺼짐입니다. 각 토글의 기능과 자세한 설명 위치는 표와 같습니다.

| 토글 | 기능 | 자세한 가이드 |
| --- | --- | --- |
| **Show message timestamps**(타임스탬프 표시) | 메시지마다 날짜와 시간을 표시합니다. | [메시지 조작](../chats/messages.md) |
| **Show characters in Persona pickers**(페르소나 선택기에서 캐릭터 표시) | 페르소나 선택기에 캐릭터를 나열하므로, 캐릭터 중 하나로 플레이할 수 있습니다. | [사용자 페르소나](../characters/personas.md) |
| **Show model name on messages**(메시지에 모델 이름 표시) | 각 응답을 쓴 AI 모델을 표시합니다. | [메시지 조작](../chats/messages.md) |
| **Show token usage on messages**(메시지에 토큰 사용량 표시) | 메시지별 프롬프트 토큰 수와 응답 토큰 수를 표시합니다. | [메시지 조작](../chats/messages.md) |
| **Show context usage** | 마지막으로 측정한 요청에서 모델의 컨텍스트가 얼마나 찼는지를 연결 전환기와 Game 채팅 설정에 표시합니다. | [연결 정리하기](../connections/organizing-connections.md#the-random-pool-and-quick-connection-switcher) |
| **Show message numbers**(메시지 번호 표시) | 채팅의 메시지마다 번호를 표시합니다. | [메시지 조작](../chats/messages.md) |
| **Show "older messages not sent" note** | 이전 메시지가 프롬프트에 다 들어가지 못했을 때 최신 응답 아래에 안내를 표시합니다. 긴 채팅에서 이 안내를 숨기려면 끄세요. 잘리거나 비어 있는 응답에는 여전히 그 응답의 안내가 표시됩니다. | [Peek Prompt](../chats/peek-prompt.md) |
| **Guide swipes/regens with chat input**(채팅 입력으로 스와이프/재생성 안내) | 재생성할 때 현재 입력해 둔 초안을 지침으로 씁니다. | [지침 기반 생성과 Impersonate](../chats/guided-and-impersonate.md) |
| **Include reasoning in exports**(내보내기에 추론 포함) | 채팅 내보내기에 숨겨진 사고 과정을 넣습니다. | [채팅 내보내기와 가져오기](../chats/export-import.md) |
| **Include private notes in exports**(내보내기에 비공개 메모 포함) | JSONL 및 텍스트 채팅 내보내기에 비공개 메시지 메모를 넣습니다. 채팅 기록을 공유할 때는 꺼 두세요. | [채팅 내보내기와 가져오기](../chats/export-import.md) |
| **Debug mode**(디버그 모드) | 지원 요청에 쓸 수 있도록 모델 요청 내용을 서버 콘솔에 기록합니다. | [Marinara Engine 문제 해결](../TROUBLESHOOTING.md) |

**Advanced** 탭의 나머지 부분은 다른 가이드에서 다룹니다. **Updates**(업데이트)는 [Marinara Engine 업데이트](../UPGRADING.md), **Admin Access**(관리자 접근)는 [원격 접근](../REMOTE_ACCESS.md), **Backup & Export**(백업 및 내보내기)는 [Marinara 백업과 복원](../data/backup-and-restore.md), **Danger Zone**(위험 구역)은 [데이터 지우기와 초기화](../data/clearing-data.md)를 참고하세요.

## 설정이 기기 사이에서 동기화되는 방식

Marinara는 대부분의 설정을 서버에 저장합니다. 그래서 브라우저와 기기를 옮겨 다녀도 설정이 따라옵니다. 설정 동기화는 이렇게 동작합니다.

동작 순서는 다음과 같습니다.

1. **Settings**의 어느 곳에서든 설정을 바꿉니다.
2. 약 1초 뒤에 Marinara가 변경 내용을 저장 시각과 함께 서버에 기록합니다.
3. 다른 브라우저에서 같은 Marinara 서버를 열면 저장된 설정을 불러옵니다.

각 기기는 더 새로운 쪽을 남깁니다. 시각을 기준으로 나중에 저장한 값이 이깁니다. 이 규칙 때문에 생기는 상황 하나를 조심하세요. 두 번째 기기에서 Marinara를 열면, 그 기기의 설정이 첫 번째 기기에서 방금 바꾼 값을 조용히 덮어쓸 수 있습니다. 기기를 옮기기 전에 동기화될 시간을 잠시 주세요.

동기화되지 않는 설정이 두 가지 있습니다. 이 둘은 설정한 기기의 브라우저에만 남습니다.

- **Display Size**(디스플레이 사이즈): 인터페이스 글자 크기입니다.
- **Chat Font Size**(채팅 폰트 사이즈): 채팅 글자 크기입니다.

둘 다 **Settings** > **Appearance** > **Text & Scale**(텍스트 및 배율)에 있습니다. 사용하는 기기마다 따로 설정하세요. [모양 설정](../appearance/appearance-settings.md)을 참고하세요.

서버에 연결할 수 없을 때는 기기에 있는 설정으로 앱이 계속 동작하고, 다음에 무언가를 바꿀 때 다시 저장을 시도합니다.

## 관련 가이드

- [모양 설정](../appearance/appearance-settings.md)
- [메시지 조작](../chats/messages.md)
- [메시지 보내기와 스트리밍](../chats/sending-and-streaming.md)
- [채팅 내보내기와 가져오기](../chats/export-import.md)
- [Marinara가 데이터를 저장하는 위치](../data/where-data-is-stored.md)
- [Marinara Engine 업데이트](../UPGRADING.md)
- [Marinara Engine 문제 해결](../TROUBLESHOOTING.md)
- [업적](../home/achievements.md)
- [개인 확장](../extending/personal-extensions.md)
- [UI 지역화](../development/localization.md)
