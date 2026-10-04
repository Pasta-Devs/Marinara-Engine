# 설정 프로필

설정 프로필은 여러 채팅에서 다시 쓸 수 있는 채팅 설정을 이름 붙여 묶어 둔 것입니다. 채팅의 연결, 프롬프트 프리셋, 에이전트, 도구, 번역, 기억 기능, 고급 매개변수를 비롯한 채팅별 설정을 담을 수 있습니다. 같은 설정을 다시 만들 필요 없이 프로필을 다른 채팅에 적용하면 됩니다.

프로필은 **Chat Settings**(채팅 설정) 맨 위에서 관리합니다. Conversation(대화) 모드와 Roleplay(롤플레이) 모드에서 쓸 수 있고, Game Mode(게임 모드)에서는 프로필 컨트롤이 나타나지 않습니다.

## 설정 프로필과 프롬프트 프리셋

Marinara는 프롬프트 틀에만 **preset**이라는 말을 씁니다.

- **프롬프트 프리셋**은 시스템 프롬프트의 구조와 생성 파라미터를 정합니다. Presets 패널에서 편집합니다. [Preset Editor와 프롬프트 관리](../prompts/presets.md) 문서를 참고하세요.
- **설정 프로필**은 그보다 넓은 범위의 재사용 설정입니다. 선택한 프롬프트 프리셋에 더해 연결, 에이전트, 그 밖의 채팅 설정까지 함께 담을 수 있습니다.

즉, 프롬프트 프리셋은 설정 프로필 안에 들어가는 항목 하나입니다.

## 프로필에 담기는 것

프로필에는 채팅이 AI와 주고받는 방식이 저장됩니다.

- 연결
- 프롬프트 프리셋(Conversation 모드에서는 프롬프트 소스라고 부릅니다)
- 에이전트와 도구
- 번역
- 기억 기능
- 고급 매개변수
- 창과 버튼 배치: 창 위치와 크기, 고정과 잠금, Chat Settings 안에 있거나 밖으로 꺼낸 도구, 열린 컨트롤 창, 컴퓨터와 휴대폰의 버튼 위치입니다. **Default**처럼 저장된 배치가 없는 프로필은 채팅의 배치를 그대로 둡니다.
- Chat Settings의 배치 안내를 숨겼는지 여부입니다. **Default**나 이 선택이 없는 예전 프로필을 적용하면 안내가 다시 나타납니다.
- 그 밖의 재사용 가능한 채팅 설정

캐릭터, 페르소나, 로어북, 스프라이트, 요약, 태그, 장면 프롬프트처럼 채팅 자체가 가진 내용은 프로필로 바뀌지 않습니다. 채팅 기록도 들어 있지 않습니다.

## 프로필 적용하기

프로필 드롭다운은 **Chat Settings** 맨 위에 있습니다. 툴팁은 **Apply a settings profile to this chat**입니다.

1. 바꾸려는 채팅을 여세요.
2. **Chat Settings**를 여세요.
3. **Profile**(프로필) 드롭다운을 여세요.
4. 이름을 보고 프로필을 고르세요.

채팅에는 곧바로 반영됩니다. 현재 값이 저장된 어느 프로필과도 맞지 않으면 드롭다운에 **Custom settings profile**이 표시됩니다. 전에 적용한 프로필이 사라진 상태라면 **Missing profile - choose a profile**이 표시됩니다.

## 프로필 저장하기

드롭다운 아래 아이콘 줄에는 다음 동작이 있습니다.

| 버튼 | 툴팁 | 결과 |
|---|---|---|
| Save | **Save current chat settings into this profile** | 선택한 프로필에 저장된 값을 덮어씁니다 |
| Rename | **Rename profile** | 선택한 프로필의 이름을 바꿉니다 |
| Save As | **Save current chat settings as a new profile** | 현재 채팅으로 프로필을 하나 더 만듭니다 |
| Import | **Import settings profile (.json)** | 프로필 파일을 불러옵니다 |
| Export | **Export settings profile (.json)** | 선택한 프로필을 다운로드합니다 |
| Delete | **Delete profile** | 선택한 프로필을 완전히 삭제합니다 |

첫 프로필을 만들려면 채팅 설정을 원하는 대로 맞춘 다음 **Save current chat settings as a new profile**을 고르세요. 나중에 내용을 갱신할 때는 프로필을 적용하고 채팅 설정을 바꾼 뒤 **Save current chat settings into this profile**을 고르면 됩니다.

## 기본 프로필 정하기

드롭다운 옆의 별표는 해당 모드에서 새 채팅에 자동으로 쓰일 프로필을 표시합니다. 기본 프로필은 모드마다 하나만 지정할 수 있습니다.

별표의 툴팁은 현재 상태를 알려 줍니다.

- **Mark this profile as default for new chats in this mode**
- **This profile is the default for new chats in this mode**
- **Select a profile to mark it as default**

## 즐겨찾는 창 배치

Chat Settings 제목 표시줄의 **Reset View**(화면 배치 초기화) 옆 별은 현재 모드의 새 채팅에 쓸 창 배치를 저장합니다. 배치 안내를 숨겼는지도 기억합니다. Conversation, Roleplay, Game에서 사용할 수 있습니다. **Profile** 드롭다운 옆의 별은 이전처럼 기본 설정 프로필을 고릅니다.

기존 설치를 업데이트하면 익숙한 도구 버튼 배치가 세 모드 모두에서 새 채팅의 즐겨찾는 배치가 됩니다. 한 번만 적용되며, 이미 저장했거나 지운 즐겨찾는 배치는 건드리지 않습니다. 직접 바꾸기 전까지 이 배치가 기본으로 유지됩니다. 새로 설치했다면 도구는 Chat Settings 안에 있고 즐겨찾는 배치는 없습니다.

창과 버튼을 원하는 곳에 놓고 제목 표시줄의 별을 눌러 저장하세요. 현재 배치와 안내 표시 여부가 즐겨찾는 배치와 같으면 별이 채워집니다. 창을 옮기거나 배치를 바꾼 뒤 별을 다시 누르면 즐겨찾는 배치가 바뀝니다. 채워진 별을 누르면 즐겨찾기를 지우고 이후 새 채팅에 기본 배치를 사용합니다. 기존 채팅은 바뀌지 않습니다.

새 채팅에 기본 설정 프로필이 적용되면 프로필에 저장된 배치가 즐겨찾는 배치보다 우선합니다. 저장된 배치가 없는 프로필은 즐겨찾기에서 가져온 배치를 포함해 채팅의 배치를 유지합니다. 안내 표시 여부는 프로필의 선택을 따르며, 이 설정이 없는 예전 프로필은 안내를 표시합니다.

사용 순서는 [새 채팅의 배치 고르기](chat-settings.md#choosing-a-layout-for-new-chats)를 참고하세요.

## 프로필 가져오기와 내보내기

**Export settings profile (.json)**은 `.marinara-settings-profile.json` 파일을 다운로드합니다. 백업으로 보관하거나 다른 사람에게 공유할 수 있습니다. **Import settings profile (.json)**은 호환되는 파일에서 프로필을 새로 만들며, 기존 프로필을 덮어쓰지 않습니다. 예전에 내보낸 프로필도 그대로 가져올 수 있습니다.

프로필에 저장되는 것은 설정뿐이며, 제공자의 비밀 정보는 들어가지 않습니다.

## Default 프로필

Conversation 모드와 Roleplay 모드에는 각각 기본 제공되는 **Default** 프로필이 있습니다. 이 프로필을 적용하면 프로필이 관리하는 설정이 해당 모드의 Marinara 기본값으로 되돌아갑니다.

Default 프로필은 이름을 바꾸거나 덮어쓰거나 삭제할 수 없습니다. 비활성 상태인 컨트롤이 그 이유를 **Cannot save into the Default profile**, **Cannot rename the Default profile**, **Cannot delete the Default profile**로 알려 줍니다.

## 관련 가이드

- [채팅 설정 개요](chat-settings.md)
- [Preset Editor와 프롬프트 관리](../prompts/presets.md)
- [생성 파라미터](../prompts/generation-parameters.md)
