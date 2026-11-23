# SillyTavern에서 가져오기

SillyTavern 데이터를 Marinara Engine으로 가져옵니다. 파일을 하나씩 가져올 수도 있고, SillyTavern 폴더 전체를 검사해서 한 번에 모두 가져올 수도 있습니다.

## 옮길 수 있는 것

| SillyTavern 데이터 | Marinara에서는 |
| --- | --- |
| 캐릭터 | 캐릭터 |
| 채팅과 그룹 채팅 | 채팅 |
| 프리셋 | 프리셋(프롬프트 섹션과 프리셋의 샘플러 설정) |
| World Info | 로어북(특정 단어가 나올 때 AI가 읽는 메모) |
| 배경 | 채팅 배경 |
| 페르소나 | 페르소나(채팅에서 나를 대신하는 프로필) |
| 정규식 스크립트 | 정규식 스크립트: 각 카드에 속한 스크립트와 `settings.json`의 전역 스크립트(폴더 가져오기) |

## 파일 하나씩 빠르게 가져오기

1. **Settings -> Imports**(설정 -> 가져오기)를 여세요.
2. **SillyTavern Import** 항목에서 가져올 파일 형식에 맞는 버튼을 클릭하세요.
3. 파일을 선택하세요. **Import Character**(캐릭터 가져오기), **Import Preset**(프리셋 가져오기), **Import Lorebook**(로어북 가져오기)은 각 패널의 **Import**(가져오기) 버튼과 같은 창을 엽니다. 선택할 수 있는 옵션과 가져온 항목 및 가져오지 못한 항목을 알리는 보고도 같습니다.

| 버튼 | 파일 |
| --- | --- |
| **Import Character (JSON/PNG)** | `.json` 또는 `.png` 캐릭터 카드입니다. |
| **Import Chat (JSONL)** | `.jsonl` 채팅 기록입니다. 한 줄에 JSON 기록 하나가 들어가는 형식으로, SillyTavern이 채팅을 저장할 때 쓰는 형식입니다. |
| **Import Preset (JSON)** | `.json` 프리셋입니다. |
| **Import Lorebook (JSON)** | `.json` World Info 파일입니다. |

정규식 스크립트는 텍스트를 바꾸는 찾아 바꾸기 규칙입니다. [캐릭터 카드 가져오기와 내보내기](../characters/import-export.md) 문서를 참고하세요.

캐릭터 카드에 로어북이 들어 있으면 Import Character 창에서 처리 방법을 묻습니다. **Import lorebook**(로어북 가져오기)은 재사용할 수 있는 로어북으로 남기고, **Skip lorebook**은 캐릭터만 가져옵니다.

**Import Chat (JSONL)**은 파일에 다른 모드가 기록되어 있지 않은 한 **Roleplay** 채팅을 만들고, 그 채팅을 엽니다. 짧은 메시지로 함께 가져온 작가 노트, 페르소나, AI에게 숨긴 상태로 유지되는 메시지를 알립니다.

### 채팅 목록에서 채팅 가져오기

채팅 목록 위쪽의 가져오기 버튼도 쓸 수 있습니다. 툴팁에는 **Import SillyTavern or Marinara chat JSONL**이라고 표시됩니다. 이 버튼도 같은 방식으로 작동합니다. 파일에 기록된 모드로 채팅을 열고, 기록된 모드가 없으면 Roleplay 채팅으로 엽니다. [채팅 내보내기와 가져오기](../chats/export-import.md) 문서를 참고하세요.

## SillyTavern 폴더 가져오기

시작하기 전에 알아 둘 점이 있습니다. 마법사는 서버 컴퓨터에 있는 파일을 읽습니다. SillyTavern이 다른 컴퓨터에 있다면 먼저 SillyTavern을 설치한 폴더를 Marinara 컴퓨터로 복사하세요. Marinara 컴퓨터에서는 마법사가 바로 동작합니다. 다른 기기에서 쓰려면 관리자 시크릿을 설정하고 **Settings -> Advanced -> Admin Access**에 입력하세요. [Marinara 백업과 복원](backup-and-restore.md) 문서와 [서버 설정 참고 문서](../CONFIGURATION.md)의 "Privileged APIs (ADMIN_SECRET)" 섹션을 참고하세요.

1. **Settings -> Imports -> SillyTavern Import**를 여세요.
2. **Import from SillyTavern Folder**를 클릭하세요.
3. SillyTavern 폴더를 선택하세요. 보통 `data/`나 `public/` 폴더가 들어 있는 최상위 폴더를 고르세요. 다음 방법 중 하나를 쓰세요.
   - **Browse**를 클릭해 폴더를 고릅니다.
   - 폴더 선택 창이 없으면(원격 서버) 앱 안의 폴더 브라우저가 열립니다. 이 브라우저는 서버를 실행하는 사용자의 홈 폴더 안에 있는 폴더만 보여 줍니다. **Select This Folder**를 클릭하세요.
   - **SillyTavern Folder Path**에 `/home/you/SillyTavern` 같은 경로를 입력하세요. 입력한 경로가 서버를 실행하는 사용자의 홈 폴더 안에 있으면 사용할 수 있습니다. 서버의 `IMPORT_ALLOWED_ROOTS`가 설정되어 있으면 대신 그 설정에 나열된 폴더 중 하나 안에 있어야 합니다.
4. **Scan Folder**를 클릭하세요. Marinara가 각 분류에서 몇 개를 찾았는지 보여 줍니다.
5. **Choose exactly what to import**에서 가져올 항목을 체크하세요. 분류마다 **All** 버튼과 **None** 버튼이 있고, 개별 항목은 **Show** 또는 **Hide** 토글로 펼치거나 숨길 수 있습니다.
6. **Import Selected**를 클릭하세요. 진행 막대에 현재 항목과 분류별 개수가 표시됩니다.
7. **Import complete!**가 표시되면 분류별 개수를 확인하고 **Done**을 클릭하세요. 개수 아래의 짧은 목록에는 작가 노트와 페르소나를 유지한 채팅 수, 여기에서 일치하는 페르소나를 찾지 못한 SillyTavern 사용자 이름, 프리셋의 World Info 배치 방식, 가져오지 않은 프리셋 설정이 표시됩니다.

**Skip what's already here**(이미 있는 항목 건너뛰기)는 기본적으로 켜져 있으며, 이전에 폴더로 가져왔든 파일 하나씩 가져왔든 이미 있는 캐릭터, 채팅, 페르소나를 제외합니다. 기존 페르소나와 이름이 같은 SillyTavern 페르소나는 복사하지 않고, 그 채팅을 기존 페르소나에 연결합니다. 이 변경 전에 파일 하나씩 가져온 채팅은 알아보지 못하므로 한 번 더 가져옵니다.

대부분의 항목은 처음부터 선택되어 있습니다. `deterministic`, `neutral`, `universal-*` 프리셋 같은 SillyTavern 기본 제공 프리셋은 Marinara가 선택하지 않은 상태로 두며, 배너로 그 사실을 알립니다. 사본이 필요하지 않다면 선택하지 않은 채로 두세요.

검사 결과에 캐릭터가 있으면 옵션이 두 개 더 나타납니다.

**Imported character tags**(기본값 **All tags**):

- **All tags**는 원본 태그를 유지합니다.
- **No tags**는 태그를 건너뜁니다.
- **Existing only**는 이미 있는 태그만 남깁니다.

**Imported regex scripts**(기본값 **Character only**):

- **Character only**는 스크립트를 각 캐릭터에만 적용합니다.
- **Global**은 스크립트를 **Presets → Regexes**에 추가합니다. 여기에서 여러 채팅에서 실행되는 스크립트를 관리할 수 있습니다. [정규식 스크립트](../extending/regex-scripts.md#manage-your-scripts)를 참고하세요.

가져오기가 되지 않았다면 다음을 확인하세요.

- "Could not find SillyTavern data directory."는 Marinara가 그 폴더를 읽지 못한다는 뜻입니다. SillyTavern의 최상위 폴더를 선택하세요.
- "Marinara can only read folders inside your home folder"는 폴더가 서버를 실행하는 사용자의 홈 폴더 밖에 있다는 뜻입니다. SillyTavern 폴더를 홈 폴더 안으로 옮기거나 서버 운영자에게 `IMPORT_ALLOWED_ROOTS` 설정으로 해당 위치를 허용하도록 요청하세요. 이 설정이 있으면 선택기로 고른 폴더도 나열된 폴더 중 하나 안에 있어야 합니다. [서버 설정 참고 문서](../CONFIGURATION.md)를 참고하세요.
- **Browse**에 홈 폴더 밖의 경로를 입력하면 폴더 탐색기가 홈 폴더에서 열립니다.
- 항목 하나가 실패하면 Marinara는 그 항목을 건너뛰고 계속 진행하며, 마지막 단계의 경고 목록에 `Character "Foo": error message`처럼 표시합니다.

## 데이터가 처리되는 방식

- 한 캐릭터에 속한 채팅 파일은 하나의 채팅의 분기로 가져옵니다. 분기는 따로 이어 갈 수 있는 채팅 사본입니다. 파일 하나씩 가져올 때처럼 각 채팅은 SillyTavern 파일의 이름을 씁니다. 이름이 아직 "New Chat"인 파일은 캐릭터 이름을 씁니다.
- 그룹 채팅은 **Individual**(개별) 모드의 Roleplay 채팅으로 들어오므로, SillyTavern에서 말하던 순서대로 각 캐릭터가 차례로 답변합니다.
- SillyTavern에서 AI에게 숨긴 메시지는 숨긴 상태로 유지됩니다.
- 가져온 항목은 가져오기를 실행한 날짜가 아니라 원본 파일의 마지막 변경 날짜를 그대로 씁니다. 각 채팅 메시지도 SillyTavern이 저장한 날짜를 유지합니다.
- 채팅의 **Author's Note**(작가 노트)는 깊이 설정과 함께 가져옵니다. SillyTavern에서 다른 빈도, 위치나 역할을 사용했더라도 Marinara는 매 답변마다 해당 깊이에 추가하며, 가져오기 결과에 이 사실을 알립니다. SillyTavern에서 꺼져 있던 노트는 꺼진 상태로 유지됩니다.
- 채팅은 SillyTavern에서 사용한 페르소나에 연결됩니다. 고정한 페르소나가 있으면 그것을, 없으면 채팅 사용자와 이름이 같은 페르소나를 사용합니다. 페르소나를 같은 작업에서 함께 가져오거나, 먼저 그 이름의 페르소나를 만드세요. 일치하는 페르소나가 없으면 채팅에 페르소나가 지정되지 않으며, 가져오기 결과에 찾지 못한 페르소나의 이름이 표시됩니다.
- 프리셋은 SillyTavern의 World Info 위치 두 곳을 유지합니다. **World Info (before)**와 **World Info (after)**가 각각 별도 섹션이 되므로, 캐릭터 뒤로 설정한 항목은 그대로 그 뒤에 놓입니다. 프리셋에서 둘 중 하나를 끄면 SillyTavern처럼 해당 항목을 제외합니다. World Info 위치가 하나뿐인 프리셋에는 두 종류를 모두 보내는 **World Info** 섹션 하나가 생깁니다. 이 변경 전에 가져온 프리셋에는 **World Info** 섹션이 하나 있습니다. 수정하려면 다시 가져오거나, 섹션에서 원하는 위치에 **Lorebook Marker (Before)**와 **Lorebook Marker (After)**를 추가하고 기존 **World Info** 섹션을 제거하세요.
- SillyTavern의 작가 노트 앞뒤에 놓인 World Info 항목은 작가 노트가 있는 깊이 4에 system으로 들어갑니다. 노트 뒤에 있던 항목은 앞에 있던 항목 바로 뒤에 들어갑니다. 예시 메시지 앞뒤에 놓인 항목은 캐릭터 정의 뒤로 들어갑니다. 가져오기 결과에 이동한 개수가 표시됩니다.
- 프리셋은 온도, Top P, Top K, Min P, 빈도 및 존재 페널티, 추론 강도의 샘플러 설정을 가져옵니다. 이 값은 해당 프리셋을 쓰는 채팅의 시작값이며, 연결이나 채팅의 자체 값이 여전히 우선합니다. 최대 답변 길이와 컨텍스트 크기는 연결 설정을 유지합니다. Top A와 반복 페널티는 여기에서 설정할 수 없어 제외됩니다.

## 옮겨지지 않는 것

마법사는 첫 번째 표에 나열된 분류만 읽습니다. 앱 전역 설정이나 연결 프로필 같은 그 밖의 SillyTavern 데이터는 가져오지 않습니다. 폴더 가져오기 결과의 **Not brought over**(가져오지 않은 항목) 목록에는 여기에서 대응하는 기능이 없는 항목의 개수가 표시됩니다. Quick Reply 세트, instruct 템플릿, context 템플릿, 시스템 프롬프트가 해당합니다. 이 수정 전에 가져온 채팅은 메시지 날짜가 가져온 시각으로 지정되었습니다. 수정하려면 채팅을 삭제하고 파일을 다시 가져오세요. 폴더로 가져올 때는 **Skip what's already here**의 체크를 해제하세요.

## 관련 가이드

- [캐릭터 카드 가져오기와 내보내기](../characters/import-export.md)
- [로어북 가져오기와 내보내기](../lorebooks/import-export.md)
- [채팅 내보내기와 가져오기](../chats/export-import.md)
- [정규식 스크립트](../extending/regex-scripts.md)
