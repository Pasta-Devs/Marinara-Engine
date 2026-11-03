# 데이터 지우기와 초기화

이 가이드에서는 **Danger Zone**(위험 구역)으로 데이터 일부 또는 전부를 완전히 삭제하는 방법을 설명합니다. 되돌릴 수 없습니다.

채팅 하나나 캐릭터 하나만 지우려면 각자의 삭제 버튼을 쓰세요. [채팅 관리하기](../chats/managing-chats.md)와 [캐릭터 만들기와 편집하기](../characters/creating-and-editing-characters.md)를 참고하세요.

**시작하기 전에:** 백업을 만들어 두세요. 휴지통은 없습니다. [Marinara 백업과 복원](backup-and-restore.md)을 참고하세요. 다른 기기에서 Marinara를 쓴다면 관리자 시크릿도 필요합니다. [원격 접근](../REMOTE_ACCESS.md)을 참고하세요.

## 일부 항목만 지우기

1. **Settings**(설정) → **Advanced**(고급)를 열고 **Danger Zone**까지 스크롤하세요.
2. 삭제할 항목마다 체크하세요. **Select All**(전체 선택)은 모든 체크박스를 체크합니다. 전부 체크된 상태에서는 같은 버튼이 **Clear Selection**으로 바뀌고 체크를 모두 해제합니다.
3. **Clear Selected Data**(선택한 데이터 지우기)를 클릭하세요. 항목을 하나 이상 체크하기 전까지는 비활성화되어 있습니다.
4. 경고를 읽으세요. 고른 항목이 몇 개인지 표시됩니다.
5. **Confirm Delete**(삭제 확인)를 클릭하세요. 중단하려면 **Cancel**(취소)을 클릭하세요. 확인하기 전까지는 아무것도 삭제되지 않습니다.

정상적으로 지워지면 선택한 데이터를 지웠다는 메시지가 표시됩니다. 요청이 실패하면 "Failed to clear selected data."(선택한 데이터를 지우지 못했습니다.)라는 오류 메시지가 나타납니다. 일부 데이터는 이미 지워졌을 수 있으니 남은 데이터를 확인하세요. 관리자 접근 권한도 확인하세요.

## 전부 지우기

1. **Danger Zone**에서 **Clear All Data**(모든 데이터 지우기)를 클릭하세요. 체크박스를 미리 체크할 필요는 없습니다.
2. 경고 창이 이렇게 묻습니다: "Delete all supported data categories except Professor Mari? There is no undo."
3. **Confirm Delete**를 클릭하세요. 중단하려면 **Cancel**을 클릭하세요.

체크박스 8개를 모두 체크하고 지우는 것과 결과가 같습니다.

## 8가지 데이터 항목

항목마다 해당 행에 적힌 것만 지웁니다. 단, 표 아래에서 설명하는 `gallery` 폴더는 예외입니다.

| 항목 | 지워지는 대상 |
| --- | --- |
| **Chats & Messages**(채팅 및 메시지) | 모든 채팅과 그 내용, 그리고 `gallery` 폴더 전체와 게임 장면 영상. |
| **Characters**(캐릭터) | Professor Mari를 제외한 모든 캐릭터와 그룹, 그리고 해당 아바타. |
| **Personas**(페르소나) | 모든 페르소나와 그룹, 그리고 해당 아바타. |
| **Lorebooks**(로어북) | 모든 로어북, 항목, 폴더. |
| **Presets**(프리셋) | 기본 제공 프리셋을 제외한 모든 프롬프트 프리셋과 프리셋 폴더. |
| **Connections**(연결) | 저장된 모든 계정, 그리고 계정에 묶인 모델 선택과 음성 설정. |
| **Automation & Addons**(자동화 및 애드온) | 모든 에이전트 설정, 사용자 지정 도구, 정규식 스크립트, 동기화된 테마. Personal Extensions와 External Extensions는 제외합니다. |
| **Media & Assets**(미디어 및 에셋) | 배경, 아바타, 스프라이트, 갤러리, 장면 영상, 글꼴, 지식 소스 파일. |

자세한 내용은 다음과 같습니다.

- **Chats & Messages**는 스와이프(메시지 하나에 남겨 둔 여러 답변), 기억, 에이전트 결과, 게임 상태, 채팅 이미지도 함께 삭제합니다.
- **Characters**와 **Personas**는 2D 및 3D 아바타 모델도 함께 삭제합니다.
- **Presets**는 프리셋의 그룹, 섹션, 변수도 함께 삭제합니다. 다른 프리셋이 기본값이었다면 기본 제공 프리셋이 기본값이 됩니다.
- **Connections**는 음성 합성(TTS)과 음성 인식 설정, 기능별로 고른 모델, **3D Avatars** 페이지에 저장해 둔 Tripo API 키도 함께 지웁니다.
- **Automation & Addons**는 에이전트 결과, 에이전트 메모리, 에이전트 폴더, 에이전트 Home 위젯도 함께 삭제합니다.
- **Media & Assets**는 에셋 목록과 채팅 이미지도 함께 삭제합니다.
- 지식 소스 파일은 지식 에이전트용으로 업로드한 파일입니다. 동기화된 테마는 Marinara에 저장한 사용자 지정 테마입니다.

일부 항목은 이름과 다른 파일까지 지웁니다. **Chats & Messages**는 **Characters**나 **Personas**를 체크하지 않았더라도 캐릭터와 페르소나의 갤러리 이미지를 포함한 `gallery` 폴더 전체를 삭제합니다.

지우기는 나머지 설정, `backups/` 폴더, `.encryption-key` 파일을 건드리지 않습니다. Personal Extensions, Game Mode 에셋, 사용자 지정 이모지와 스티커, 알림 소리, 로어북, 프리셋, 에이전트, 계정의 이미지, 장기 기억 파일도 그대로 남습니다. [Marinara가 데이터를 저장하는 위치](where-data-is-stored.md)를 참고하세요.

## Professor Mari는 남습니다

Professor Mari는 Home 화면에 있는 기본 내장 도우미입니다. **Danger Zone**은 **Clear All Data**를 써도 Professor Mari를 절대 삭제하지 않습니다.

## 관련 가이드

- [Marinara 백업과 복원](backup-and-restore.md)
- [Marinara가 데이터를 저장하는 위치](where-data-is-stored.md)
- [원격 접근](../REMOTE_ACCESS.md)
