# 데이터 지우기와 초기화

이 가이드에서는 **Danger Zone**(위험 구역)을 사용해 Marinara Engine의 데이터를 완전히 삭제하는 방법을 설명합니다. 몇 가지 항목만 골라 지울 수도 있고 전부 날릴 수도 있습니다. 되돌리기는 없으니 경고부터 읽으세요.

## Danger Zone 위치

데이터를 지우는 기능은 모두 한곳에 모여 있습니다.

1. **Settings**(설정)를 여세요.
2. **Advanced**(고급) 탭으로 이동하세요.
3. 맨 아래 **Danger Zone** 섹션까지 스크롤하세요.

**Danger Zone**의 설명은 이렇습니다: "Permanently clear selected categories of local data. Professor Mari is always preserved."

앱이 실행 중인 컴퓨터가 아니라 다른 기기에서 Marinara를 쓰고 있다면 데이터를 지울 때 관리자 접근 권한이 필요합니다. 설정 방법은 [원격 접근](../REMOTE_ACCESS.md)에서 확인하세요.

## 지우기 전에 백업하기

한번 지운 데이터는 되돌릴 수 없습니다. 휴지통도 없고 임시 보관함도 없습니다. 확인 버튼을 누르는 순간 데이터는 사라집니다.

마음이 바뀌었을 때 되살릴 수 있도록 먼저 백업을 만들어 두세요. [Marinara 백업과 복원](backup-and-restore.md)을 참고하세요.

## 8가지 데이터 항목

**Danger Zone**에는 8가지 항목이 체크 목록으로 나옵니다. 항목마다 적용 범위가 따로입니다. 한 항목을 체크해도 나머지 항목은 건드리지 않습니다.

| 항목 | 지워지는 대상 |
|---|---|
| **Chats & Messages**(채팅 및 메시지) | 채팅, 폴더, 메시지, 장면/OOC 데이터, 채팅 실행 상태. |
| **Characters**(캐릭터) | 캐릭터와 캐릭터 그룹. Professor Mari는 항상 남습니다. |
| **Personas**(페르소나) | 페르소나와 페르소나 그룹. |
| **Lorebooks**(로어북) | 로어북과 로어북 항목. |
| **Presets**(프리셋) | 프롬프트 프리셋, 그룹, 섹션, 변수. |
| **Connections**(연결) | API 연결과 모델 엔드포인트. |
| **Automation & Addons**(자동화 및 애드온) | 에이전트, 도구, 정규식 스크립트, 동기화된 테마, 자동화 상태. |
| **Media & Assets**(미디어 및 에셋) | 배경, 아바타, 스프라이트, 갤러리 항목, 글꼴, 지식 소스 파일. |

일부 항목은 데이터베이스 기록보다 더 많은 것을 지웁니다. **Chats & Messages**는 디스크에 저장된 갤러리 폴더 전체와 장면 동영상 파일도 함께 삭제합니다. 여기에는 캐릭터와 페르소나의 갤러리 이미지가 포함되며, **Characters**나 **Personas**를 체크하지 않았어도 마찬가지입니다. **Media & Assets**는 배경, 아바타, 스프라이트, 갤러리, 장면 동영상 파일, 글꼴, 지식 소스 파일이 들어 있는 디스크 폴더를 삭제합니다. **Connections**는 저장된 음성 합성(TTS) 설정과 Speech to Text(음성 인식) 설정도 함께 지웁니다. 이 설정이 연결에 묶여 있기 때문입니다.

## 선택한 항목만 지우기

일부 데이터만 지우고 나머지는 남기고 싶을 때 사용하세요.

1. 삭제할 항목마다 옆의 체크박스를 체크하세요.
2. 모든 체크박스를 한 번에 켜려면 **Select All**(전체 선택) 버튼을 사용하세요. 전부 체크된 상태에서는 같은 버튼이 **Clear Selection**(선택 해제)으로 바뀌므로 한 번에 해제할 수 있습니다.
3. **Clear Selected Data**(선택한 데이터 지우기)를 클릭하세요. 이 버튼은 항목을 하나 이상 체크하기 전까지 비활성화 상태입니다.
4. 경고 창이 나타납니다. 고른 항목이 몇 개인지 알려 주고 되돌릴 수 없다는 점을 다시 안내합니다.
5. 그만두려면 **Cancel**(취소)을, 삭제하려면 **Confirm Delete**(삭제 확인)를 클릭하세요. **Confirm Delete**를 클릭하기 전까지는 아무것도 삭제되지 않습니다.

정상적으로 지워지면 확인 메시지가 표시됩니다. 선택한 데이터를 지웠고 실행 캐시도 즉시 초기화했다는 내용입니다.

## 전부 지우기

8가지 항목을 한 번에 모두 날릴 때 사용하세요.

1. **Clear All Data**(모든 데이터 지우기)를 클릭하세요. 체크박스를 미리 체크할 필요는 없습니다.
2. 경고 창이 이렇게 묻습니다: "Delete all supported data categories except Professor Mari? There is no undo."
3. 그만두려면 **Cancel**을, 전부 삭제하려면 **Confirm Delete**를 클릭하세요.

모든 체크박스를 체크하고 한꺼번에 지우는 것과 결과가 같습니다.

## Professor Mari는 항상 남습니다

Professor Mari는 앱에 기본 내장된 도우미 캐릭터입니다. 이 기능은 Professor Mari를 절대 삭제하지 않습니다. **Characters** 항목을 지우거나 **Clear All Data**를 사용해도 Professor Mari는 그대로 남습니다. **Danger Zone**에서는 Professor Mari를 지울 수 없습니다.

## 관련 가이드

- [Marinara 백업과 복원](backup-and-restore.md)
- [원격 접근](../REMOTE_ACCESS.md)
