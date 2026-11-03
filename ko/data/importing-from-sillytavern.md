# SillyTavern에서 가져오기

SillyTavern 데이터를 Marinara Engine으로 가져옵니다. 파일을 하나씩 가져올 수도 있고, SillyTavern 폴더 전체를 검사해서 한 번에 모두 가져올 수도 있습니다.

## 옮길 수 있는 것

| SillyTavern 데이터 | Marinara에서는 |
| --- | --- |
| 캐릭터 | 캐릭터 |
| 채팅과 그룹 채팅 | 채팅 |
| 프리셋 | 프리셋(생성 설정을 한데 저장해 둔 묶음) |
| World Info | 로어북(특정 단어가 나올 때 AI가 읽는 메모) |
| 배경 | 채팅 배경 |
| 페르소나 | 페르소나(채팅에서 나를 대신하는 프로필) |

## 파일 하나씩 빠르게 가져오기

1. **Settings -> Imports**(설정 -> 가져오기)를 여세요.
2. **SillyTavern Import** 항목에서 가져올 파일 형식에 맞는 버튼을 클릭하세요.
3. 파일을 선택하세요.

| 버튼 | 파일 |
| --- | --- |
| **Import Character (JSON/PNG)** | `.json` 또는 `.png` 캐릭터 카드입니다. |
| **Import Chat (JSONL)** | `.jsonl` 채팅 기록입니다. 한 줄에 JSON 기록 하나가 들어가는 형식으로, SillyTavern이 채팅을 저장할 때 쓰는 형식입니다. |
| **Import Preset (JSON)** | `.json` 프리셋입니다. |
| **Import Lorebook (JSON)** | `.json` World Info 파일입니다. |

이 버튼들에는 선택 옵션이 없습니다. 캐릭터를 가져올 때는 원본 태그를 모두 유지하고, 정규식 스크립트는 해당 캐릭터에만 적용되도록 범위를 지정합니다. 정규식 스크립트는 텍스트를 바꾸는 찾아 바꾸기 규칙입니다. 이런 옵션을 직접 고르려면 Characters 패널의 **Import**를 쓰세요. [캐릭터 카드 가져오기와 내보내기](../characters/import-export.md) 문서를 참고하세요.

캐릭터 카드에 로어북이 들어 있으면 브라우저가 그 로어북을 독립 로어북으로 가져올지 묻습니다. 재사용할 수 있는 로어북으로 남기려면 **OK**를 클릭하고, 캐릭터만 가져오려면 **Cancel**을 클릭하세요.

**Import Chat (JSONL)**은 파일에 다른 모드가 기록되어 있지 않은 한 **Roleplay** 채팅을 만들고, 그 채팅을 엽니다.

### 원하는 모드로 채팅 가져오기

모드를 직접 고르려면 채팅 목록 위쪽의 가져오기 버튼을 쓰세요. 툴팁에는 **Import SillyTavern or Marinara chat JSONL**이라고 표시됩니다. 이 버튼은 현재 열어 둔 모드 탭(Conversation, Roleplay, Game)으로 파일을 가져옵니다. [채팅 내보내기와 가져오기](../chats/export-import.md) 문서를 참고하세요.

## SillyTavern 폴더 가져오기

시작하기 전에 알아 둘 점이 있습니다. 마법사는 서버 컴퓨터에 있는 파일을 읽습니다. SillyTavern이 다른 컴퓨터에 있다면 먼저 SillyTavern을 설치한 폴더를 Marinara 컴퓨터로 복사하세요. Marinara 컴퓨터에서는 마법사가 바로 동작합니다. 다른 기기에서 쓰려면 관리자 시크릿을 설정하고 **Settings -> Advanced -> Admin Access**에 입력하세요. [Marinara 백업과 복원](backup-and-restore.md) 문서와 [서버 설정 참고 문서](../CONFIGURATION.md)의 "Privileged APIs (ADMIN_SECRET)" 섹션을 참고하세요.

1. **Settings -> Imports -> SillyTavern Import**를 여세요.
2. **Import from SillyTavern Folder**를 클릭하세요.
3. SillyTavern 폴더를 선택하세요. 보통 `data/`나 `public/` 폴더가 들어 있는 최상위 폴더를 고르세요. 다음 방법 중 하나를 쓰세요.
   - **Browse**를 클릭해 폴더를 고릅니다.
   - 폴더 선택 창이 없으면(원격 서버) 앱 안의 폴더 브라우저가 열립니다. 이 브라우저는 서버를 실행하는 사용자의 홈 폴더 안에 있는 폴더만 보여 줍니다. **Select This Folder**를 클릭하세요.
   - **SillyTavern Folder Path**에 경로를 입력합니다. 예를 들면 `/path/to/SillyTavern`입니다. 직접 입력한 경로는 서버의 `IMPORT_ALLOWED_ROOTS` 설정에 그 경로를 포함하는 폴더가 나열되어 있을 때만 동작합니다.
4. **Scan Folder**를 클릭하세요. Marinara가 각 분류에서 몇 개를 찾았는지 보여 줍니다.
5. **Choose exactly what to import**에서 가져올 항목을 체크하세요. 분류마다 **All** 버튼과 **None** 버튼이 있고, 개별 항목은 **Show** 또는 **Hide** 토글로 펼치거나 숨길 수 있습니다.
6. **Import Selected**를 클릭하세요. 진행 막대에 현재 항목과 분류별 개수가 표시됩니다.
7. **Import complete!**가 표시되면 분류별 개수를 확인하고 **Done**을 클릭하세요.

대부분의 항목은 처음부터 선택되어 있습니다. `deterministic`, `neutral`, `universal-*` 프리셋 같은 SillyTavern 기본 제공 프리셋은 Marinara가 선택하지 않은 상태로 두며, 배너로 그 사실을 알립니다. 사본이 필요하지 않다면 선택하지 않은 채로 두세요.

검사 결과에 캐릭터가 있으면 옵션이 두 개 더 나타납니다.

**Imported character tags**(기본값 **All tags**):

- **All tags**는 원본 태그를 유지합니다.
- **No tags**는 태그를 건너뜁니다.
- **Existing only**는 이미 있는 태그만 남깁니다.

**Imported regex scripts**(기본값 **Character only**):

- **Character only**는 스크립트를 각 캐릭터에만 적용합니다.
- **Global**은 모든 채팅에 적용되도록 **Presets -> Regexes**에 추가합니다.

가져오기가 되지 않았다면 다음을 확인하세요.

- "Could not find SillyTavern data directory."는 Marinara가 그 폴더를 읽지 못한다는 뜻입니다. SillyTavern의 최상위 폴더를 선택하세요.
- "folderPath is not allowed"는 서버가 그 경로를 거부했다는 뜻입니다. 대신 **Browse**를 클릭해 폴더를 고르세요. 서버 관리자는 `IMPORT_ALLOWED_ROOTS` 설정으로 가져올 수 있는 폴더를 제한할 수 있습니다. 이 설정이 있으면 고른 폴더도 나열된 폴더 중 하나 안에 있어야 합니다. 서버를 운영하는 사람에게 문의하거나 [서버 설정 참고 문서](../CONFIGURATION.md)를 참고하세요.
- 항목 하나가 실패하면 Marinara는 그 항목을 건너뛰고 계속 진행하며, 마지막 단계의 경고 목록에 `Character "Foo": error message`처럼 표시합니다.

## 데이터가 처리되는 방식

- 한 캐릭터에 속한 채팅 파일은 하나의 채팅의 분기로 가져옵니다. 분기는 따로 이어 갈 수 있는 채팅 사본입니다.
- 그룹 채팅은 Roleplay 채팅으로 들어옵니다.
- 가져온 항목은 가져오기를 실행한 날짜가 아니라 원본 파일의 마지막 변경 날짜를 그대로 씁니다.

## 옮겨지지 않는 것

마법사는 첫 번째 표에 나열된 분류만 읽습니다. 앱 전역 설정이나 빠른 답장 같은 그 밖의 SillyTavern 데이터는 가져오지 않습니다.

## 관련 가이드

- [캐릭터 카드 가져오기와 내보내기](../characters/import-export.md)
- [로어북 가져오기와 내보내기](../lorebooks/import-export.md)
- [채팅 내보내기와 가져오기](../chats/export-import.md)
- [정규식 스크립트](../extending/regex-scripts.md)
