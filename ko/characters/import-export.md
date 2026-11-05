# 캐릭터 카드 가져오기와 내보내기

캐릭터 카드는 캐릭터 한 명의 정보를 담은 파일 하나입니다. 이름, 설명, 성격, 인사말이 들어가고 아바타 이미지가 함께 담기는 경우도 많습니다. 다른 앱이나 사이트의 캐릭터를 추가하려면 카드를 가져오세요. 직접 만든 캐릭터를 백업하거나 공유하려면 내보내세요.

## 캐릭터 가져오기

시작하기 전에: 기기에 캐릭터 카드 파일을 준비하세요. 대신 온라인에서 카드를 찾으려면 [Card Browser](bot-browser.md)를 참고하세요.

1. 상단 바에서 **Characters**(캐릭터)를 클릭하세요. 보이지 않으면 먼저 **More**(더보기)를 여세요.
2. 툴바에서 다운로드 화살표가 그려진 아이콘인 **Import**를 클릭하세요. **Import Character**(캐릭터 가져오기) 창이 열립니다.
3. 아래의 가져오기 옵션을 설정하세요. 이 옵션은 이번에 가져오는 파일 전체에 적용됩니다.
4. 창 위에 파일을 놓거나, 창을 탭하거나 클릭해 기기의 파일 선택 창을 여세요. 파일을 여러 개 고를 수 있고, 형식이 서로 달라도 됩니다.
5. 결과 목록이 나올 때까지 기다리세요. 파일마다 초록색 체크 표시가 나타나거나, 빨간색 표시와 함께 오류가 나타납니다. 표시되는 문구는 `Imported "Name"`, `Imported "Name" with its embedded lorebook`, `Imported "Name" without creating the embedded lorebook` 중 하나입니다.
6. **Characters**에서 새 캐릭터를 찾으세요.

Marinara는 파일 형식 4가지를 받습니다.

| 파일 형식 | 설명 |
| --- | --- |
| **.json** | 텍스트로 저장된 카드입니다. Marinara 내보내기 파일(`.marinara.json`)도 .json 파일입니다. |
| **.png** | 카드 데이터가 그림 안에 숨겨진 카드 이미지입니다. |
| **.charx** | zip 파일로 저장된 카드 패키지입니다. |
| **.marinara** | Marinara 내보내기 파일입니다. |

Marinara 내보내기 파일이 정보를 가장 많이 담습니다. 나머지 형식은 SillyTavern, Chub, Risu 같은 도구에서 나온 것입니다.

작동하지 않는 경우: 파일 옆의 빨간색 메시지를 읽으세요. 이번에 함께 고른 다른 파일은 그대로 가져옵니다.

<a id="import-options"></a>

### 가져오기 옵션

| 옵션 | 선택지 |
| --- | --- |
| **Imported card tags**(가져온 카드 태그) | **All tags**: 태그를 전부 유지합니다. 기본값입니다. |
| | **No tags**: 태그를 가져오지 않습니다. |
| | **Existing only**: 라이브러리에 이미 있는 태그만 유지합니다. |
| **Imported regex scripts**(가져온 정규식 스크립트) | **Character only**: 규칙이 이 캐릭터에 대해 작동합니다. 기본값입니다. |
| | **Global**: 규칙이 **Presets → Regexes**(프리셋 → 정규식)에 추가되어 모든 채팅에서 작동합니다. |
| **Split description into fields**(설명을 필드별로 분할) | 기본값은 꺼짐입니다. 체크하면 라벨이 붙은 성격, 외모 같은 텍스트를 **Description**(설명)에서 꺼내 각자의 필드로 옮깁니다. |

정규식 스크립트는 텍스트를 찾아 바꾸는 작은 규칙입니다. 규칙을 모든 곳에 적용하려는 것이 아니라면 **Character only**를 그대로 두세요. 분할은 내레이터 카드, 세계관 카드, 캐릭터 여러 명이 담긴 카드를 바꾸지 않고 그대로 둡니다.

### 로어북이 들어 있는 카드

로어북은 AI가 채팅 도중 찾아보는 배경 정보 모음입니다. 카드에 로어북이 내장되어 있으면 가져오기가 잠시 멈추고 **Embedded lorebook found**(내장 로어북을 찾음)가 표시됩니다. 파일 목록과 함께 항목이 몇 개인지 보여 줍니다. 이번에 가져오는 파일 전체에 적용할 선택지 하나를 고르세요.

- **Import Lorebook**(로어북 가져오기)은 캐릭터에 연결된 독립 Marinara 로어북도 함께 만듭니다.
- **No Import**(가져오지 않음)는 로어북을 카드 안에만 둡니다.

### SillyTavern 폴더 통째로 가져오기

SillyTavern 설치본 전체를 옮기려면 **Settings**(설정)의 **Imports**(가져오기) 탭에 있는 일괄 가져오기 기능을 쓰세요. 캐릭터, 채팅, 프리셋, 로어북을 한꺼번에 가져옵니다. [SillyTavern에서 가져오기](../data/importing-from-sillytavern.md)를 참고하세요.

## 캐릭터 내보내기

1. 편집기에서 캐릭터를 여세요.
2. 머리글에서 **Export character**(캐릭터 내보내기)를 클릭하세요. **Export Character** 창이 열립니다.
3. 형식을 고르세요. Marinara가 파일을 다운로드합니다.

| 형식 | 저장되는 내용 | 적합한 상황 |
| --- | --- | --- |
| **Marinara Native** | Marinara 메타데이터, 스프라이트, 갤러리 이미지, 연결된 로어북이 담긴 `.marinara.json` 파일입니다. | Marinara 설치 환경 사이에서 캐릭터를 정보 손실 없이 옮길 때 |
| **Compatible JSON** | 다른 앱에서 읽을 수 있는 일반 카드 파일입니다. 스프라이트나 갤러리 이미지처럼 Marinara에만 있는 부가 정보는 빠집니다. | JSON 카드를 읽는 다른 앱 |
| **Compatible PNG Card** | 데이터를 그림 안에 담은 카드 이미지입니다. 스프라이트는 담기지만 갤러리 이미지는 담기지 않습니다. | SillyTavern, Chub, Risu처럼 PNG 카드를 쓰는 앱과 사이트 |

두 **Compatible** 형식은 비어 있지 않은 **Backstory**(배경 이야기)와 **Appearance**(외모) 필드를 표준 **Description** 뒤에 덧붙이므로, 다른 앱에서도 그 정보가 유지됩니다. 저장된 카드는 바뀌지 않습니다.

**Marinara Native**와 **Compatible PNG Card**는 카드의 [대화형 온보딩](interactive-onboarding.md)을 유지하므로, 누군가 그 카드를 Marinara로 가져와도 카드가 여전히 질문을 합니다. **Compatible JSON**은 온보딩을 빼고 내보냅니다.

## 캐릭터 여러 개 한꺼번에 내보내기

1. 상단 바에서 **Characters**를 클릭하세요(보이지 않으면 먼저 **More**를 여세요).
2. 툴바에서 체크 표시 아이콘인 **Select**(선택)를 클릭하고 내보낼 캐릭터에 체크하세요.
3. 아래쪽 막대에서 **Export**(내보내기)를 클릭하세요. Marinara가 `marinara-characters.zip`을 다운로드합니다.

zip 안에는 캐릭터마다 **Marinara Native** 파일이 하나씩 들어 있습니다. 일괄 내보내기에는 PNG나 JSON 선택지가 없습니다. 그 형식이 필요하면 캐릭터를 하나씩 내보내세요. 캐릭터를 선택하는 다른 방법은 [캐릭터 라이브러리 정리하기](library-organization.md#export-or-delete-many-characters)를 참고하세요.

## 관련 가이드

- [캐릭터 만들기와 편집](creating-and-editing-characters.md)
- [Card Browser: 캐릭터 찾아서 가져오기](bot-browser.md)
- [SillyTavern에서 가져오기](../data/importing-from-sillytavern.md)
