# 채팅 배경

이 가이드에서는 배경 라이브러리를 설명합니다. 배경 라이브러리에는 직접 올린 다음 손수 골라 채팅 뒤에 까는 이미지가 들어 있습니다. 매 턴 배경을 알아서 골라 주는 **Background** 에이전트는 [Roleplay 배경](../roleplay/backgrounds.md)을 참고하세요. Gallery에서 AI로 만드는 배경은 [장면 배경과 Gallery](../media/scene-backgrounds.md)를 참고하세요.

채팅 배경은 모든 채팅 모드에서 보입니다. Conversation 채팅에서는 **Conversation Theme**(대화 테마)의 그라데이션이 이미지 위에 그대로 남고, **Conversation background image opacity**(대화 배경 이미지 불투명도)가 이미지가 얼마나 진하게 보일지 정합니다. [모양 설정](appearance-settings.md)을 참고하세요.

## 채팅 배경 바꾸기

시작하기 전에: 배경을 바꿀 채팅을 여세요. 고른 배경은 그 채팅에 적용됩니다.

1. **Settings**(설정)를 열고 **Appearance**(모양)로 이동한 다음 **App**(앱) 버튼을 누르세요.
2. **Backgrounds**(배경)에서 **Browse library**(라이브러리 찾아보기)를 탭하세요.
3. 그림을 탭하세요. 그 그림이 이 채팅의 배경이 되고 창이 닫힙니다.

내 이미지를 쓰려면 먼저 가져오세요([배경 가져오기](#import-a-background) 참고).

## 배경 설정 위치

1. **Settings**를 여세요.
2. **Appearance** 탭을 선택한 다음 **App** 버튼을 누르세요.
3. **Backgrounds** 섹션을 찾으세요.

이 섹션에는 **Chat Background**(채팅 배경화면) 선택기, **Background Blur**(배경 흐림) 슬라이더, **Conversation background image opacity**와 **Chat List Backgrounds**(채팅 목록 배경) 컨트롤이 있습니다([모양 설정](appearance-settings.md) 참고).

선택기에는 현재 배경의 미리보기가 표시되고, 고른 배경이 없으면 **Default background**(기본 배경)가 표시됩니다. 그 아래에는 **Recent** 배경이 최대 3개 있어 한 번만 탭하면 바로 고를 수 있습니다. **Browse library**를 클릭하면 **Background Library**(배경 라이브러리) 창이 열립니다.

## 배경 라이브러리

라이브러리에는 직접 올린 이미지와 Marinara에 기본 포함된 그림이 함께 들어 있습니다. 이미지마다 라벨이 붙습니다.

| 라벨 | 의미 |
| --- | --- |
| **My upload**(내 업로드) | 직접 올린 이미지입니다. 이름 변경, 태그, 삭제가 가능합니다. |
| **Game asset**(게임 에셋) | 기본 포함 그림입니다. 읽기 전용이라 이름 변경, 태그, 삭제를 할 수 없습니다. |

**Filter by source**(소스별 필터) 버튼인 **All sources**(모든 소스), **My uploads**(내 업로드), **Game assets**(게임 에셋)에는 각각 이미지가 몇 개 있는지 표시됩니다.

<a id="import-a-background"></a>

### 배경 가져오기

1. **Background Library** 창에서 검색창 옆의 **Import Backgrounds**(배경 등록)를 찾으세요.
2. 탭하거나 클릭해서 이미지 파일을 고르세요. 여러 개를 한 번에 고를 수 있습니다. 컴퓨터에서는 파일을 그 위로 끌어다 놓아도 됩니다.
3. 기다리세요. 진행되는 동안 **Importing…**(가져오는 중…)이 표시됩니다.

새 이미지가 **My upload** 라벨과 함께 격자에 나타납니다.

각 파일은 JPG, PNG, GIF, WebP, AVIF 중 하나여야 하며, 최대 20 MB까지 허용됩니다. Marinara는 파일 이름이 아니라 실제 내용을 확인합니다. 이미지가 아닌 파일의 이름만 `.png`로 바꾸면 거부됩니다.

### 현재 채팅의 배경 고르기

1. **Browse library**를 여세요.
2. 썸네일을 클릭하세요. 체크 표시가 나타나고, 그 이미지가 이 채팅의 배경이 되며, 창이 닫힙니다.
3. 기본값으로 되돌리려면 선택된 썸네일을 다시 클릭하거나, 미리보기의 X(**Clear selection**, 선택 해제)를 클릭하세요.

### 검색과 필터

- **Search backgrounds**(배경 검색)는 이름, 태그, 소스로 걸러 냅니다. 개수 표시줄에 일치하는 이미지가 몇 개인지 "3 of 20 backgrounds"처럼 나옵니다. 입력란의 X를 클릭하면 검색어가 지워집니다.
- **Sort backgrounds**(배경 정렬)에는 **Manual order**(수동 정렬), **A-Z**(이름↗), **Z-A**(이름↘), **Newest**(최신순), **Oldest**(오래된순)가 있습니다. **Manual order**에서는 끌어서 순서를 바꾸거나, 포커스된 이미지에서 <kbd>Alt</kbd>+<kbd>Up</kbd> 또는 <kbd>Alt</kbd>+<kbd>Down</kbd>을 누르세요.
- 폴더 칩인 **All folders**(모든 폴더), **Favorites**(즐겨찾기), **Unfiled**(미분류)와 폴더마다 하나씩 있는 칩으로 폴더별로 걸러 냅니다.
- 태그 영역에서 **All**(전체)을 고르면 태그 필터가 해제됩니다. **Tags**(태그)를 펼쳐 태그를 하나 이상 고르세요. 고른 태그 중 하나라도 달린 이미지가 표시됩니다.

이미지의 별을 클릭하면 즐겨찾기에 추가됩니다. 기본 배경은 바뀌지 않습니다.

### 배경을 폴더로 정리하기

폴더는 이미지 파일을 옮기거나 숨기지 않고 라이브러리만 정리합니다.

1. **New Folder**(새 폴더)를 클릭하고 이름을 입력한 다음 **Add**(추가)를 클릭하세요.
2. 이미지의 **Move to folder**(폴더로 이동) 버튼을 탭하고 폴더를 고르세요. 이미지를 폴더 칩 위로 끌어다 놓아도 됩니다. 휴대폰이나 태블릿에서는 이미지를 길게 누른 다음 끌어다 놓으세요.
3. 이미지를 다시 빼려면 **Unfiled**로 끌어다 놓으세요.
4. 폴더 칩을 선택하면 연필(**Rename folder**, 폴더 이름 변경) 버튼과 휴지통(**Delete folder**, 폴더 삭제) 버튼이 나타납니다.

폴더를 삭제하면 안에 있던 이미지는 **Unfiled**로 돌아가며 삭제되지 않습니다. 폴더는 서버에 저장되고 백업에도 포함됩니다. **Background** 에이전트는 폴더에 들어 있는 배경을 포함해 모든 배경을 그대로 인식합니다.

### 배경 이름 바꾸기

이름은 **My upload** 이미지만 바꿀 수 있습니다.

1. 이미지의 연필(**Rename background**, 배경 이름 변경)을 클릭하세요.
2. 새 이름을 입력하세요. 확장자는 입력하지 않아도 됩니다.
3. **Save**(저장)를 클릭하세요.

### 배경에 태그 달기

태그는 **My upload** 이미지에만 달 수 있습니다.

1. 이미지의 태그 아이콘(**Edit tags**, 태그 편집)을 클릭하세요.
2. **Add tag…**(태그 추가…)에 태그를 입력하세요. Marinara가 전에 쓴 태그를 추천합니다.
3. <kbd>Enter</kbd>를 누르거나 **Add**를 클릭하세요.

태그를 빼려면 태그를 편집하는 동안 그 태그를 클릭하세요.

<a id="download-a-background"></a>

### 배경 다운로드하기

기본 포함 이미지를 포함해 어떤 이미지든 다운로드 아이콘(**Download background**, 배경 다운로드)을 클릭하면 됩니다. iPhone이나 iPad에서는 공유 시트가 열립니다. 열리지 않으면 표시되는 메시지에서 **Save file**(파일 저장)을 탭하세요.

### 배경 삭제하기

삭제는 **My upload** 이미지만 할 수 있습니다.

1. 이미지의 휴지통 아이콘(**Delete background**, 배경 삭제)을 클릭하세요.
2. 삭제를 확인하세요.

삭제한 이미지가 현재 채팅 배경이거나 Roleplay 기본 배경이었다면 Marinara가 기본 포함 배경으로 되돌립니다.

## Roleplay 기본 배경 지정하기

Roleplay 기본 배경은 모든 새 Roleplay 채팅이 처음 쓰는 이미지입니다.

1. **Background Library** 창에서 이미지를 찾으세요.
2. 그 이미지의 핀 아이콘(**Set as default for new Roleplay chats**, 새 롤플레이 채팅의 기본값으로 설정)을 클릭하세요.

썸네일에 **Default**(기본값) 라벨이 나타납니다. 되돌리려면 그 이미지의 핀을 다시 클릭하거나, 격자 위쪽의 **Reset Roleplay default**(롤플레이 기본값 초기화)를 클릭하세요. 이 버튼은 기본 배경이 기본 포함 이미지와 다를 때만 나타납니다.

## Background Blur

**Background Blur**는 채팅 뒤의 배경을 흐리게 만들어 글자를 읽기 쉽게 합니다. 모든 채팅 모드의 배경에 적용됩니다.

1. **Backgrounds** 섹션에서 **Background Blur** 슬라이더를 찾으세요.
2. 0에서 24 사이로 끌어 조절하세요. 값이 클수록 더 흐려집니다.

0에서는 **Off**(꺼짐)로 표시되고 배경은 선명하게 유지됩니다. 기본값은 0입니다.

## 배경 선택이 저장되는 위치

| 설정 | 저장 위치 |
| --- | --- |
| 채팅의 **Chat Background** | 해당 채팅과 함께 서버에 저장됩니다. 어느 기기에서든 그 채팅을 따라갑니다. |
| 폴더와 폴더 배정 정보 | 서버에 라이브러리와 함께 저장됩니다. |
| Roleplay 기본 배경과 **Background Blur** | 기기별로 저장됩니다. 브라우저나 기기 사이에서 동기화되지 않습니다. |

동기화 방식 전체는 [모양 설정](appearance-settings.md)을 참고하세요.

## 관련 가이드

- [Roleplay 배경](../roleplay/backgrounds.md): 매 턴 배경을 고르는 Background 에이전트
- [장면 배경과 Gallery](../media/scene-backgrounds.md): Gallery에서 AI로 만드는 장면 배경. 이 라이브러리에도 저장됩니다.
- [모양 설정](appearance-settings.md): Appearance 탭 전체
