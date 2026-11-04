# 로어북 가져오기와 내보내기

로어북을 가져오면 파일에서 세계 설정 사실을 불러올 수 있고, 내보내면 공유하거나 백업할 수 있습니다. 이 가이드에서는 파일 하나를 가져오는 방법, 여러 파일을 한 번에 다루는 방법, 그리고 네 가지 내보내기 형식을 설명합니다. 로어북은 키워드에 반응하는 메모의 묶음으로, 일치하는 단어가 나오면 Marinara가 프롬프트에 넣습니다. 다른 도구에서는 이 기능을 World Info라고 부릅니다.

## 가져올 수 있는 파일

Marinara가 파일 종류를 알아서 판별합니다. 두 종류 모두 `.json` 파일이며, 계정이나 API 키가 필요하지 않습니다.

- Marinara에서 내보낸 로어북. 모든 필드와 폴더가 그대로 유지됩니다.
- 다른 도구의 World Info 파일. SillyTavern World Info나 V2 캐릭터 카드의 "character-book" 형식이 여기에 해당합니다. Marinara가 필드를 자기 필드에 맞춰 옮깁니다.

## 로어북 가져오기

1. **Lorebooks**(로어북) 패널을 여세요.
2. 위쪽 줄에 있는 아이콘 세 개 중 가운데인 다운로드 화살표 아이콘을 클릭하세요. 툴팁은 **Import**(가져오기)입니다. 더하기 아이콘은 **New**, 체크 표시 아이콘은 **Select**(선택)입니다.
3. **Import Lorebook**(로어북 가져오기) 창에서 **Drop one or more lorebook files here or click to browse**(하나 이상의 로어북 파일을 여기에 놓거나 클릭하여 찾아보세요)라고 적힌 상자를 탭하거나 클릭하고 `.json` 파일을 고르세요. 컴퓨터에서는 파일을 상자 위로 끌어다 놓아도 됩니다. 여러 파일을 한 번에 고를 수 있으며, Marinara 파일과 World Info 파일을 섞어도 됩니다.
4. 결과가 나올 때까지 기다리세요. 파일마다 초록색 체크와 함께 **Imported lorebook**이 표시되거나, 빨간색 표시와 함께 오류가 나옵니다. 파일이 여러 개면 요약 줄에 성공한 개수와 실패한 개수가 표시됩니다.
5. **Close**(닫기)를 클릭하세요. 새 로어북이 **Lorebooks** 패널에 있습니다.

Marinara는 파일에 들어 있던 날짜를 생성 날짜로 그대로 씁니다.

작동하지 않는 경우: 파일 옆의 오류를 읽어 보세요. 로어북이 아니거나 손상된 파일은 그 파일만 실패하고, 다른 파일은 그대로 가져옵니다.

## 가져온 다음에

가져온 로어북은 바로 키워드로 동작합니다. 시맨틱 검색을 쓴다면 벡터를 다시 만드세요. [로어북 시맨틱 검색](semantic-search.md)을 참고하세요.

## 로어북 내보내기

1. **Lorebooks** 패널에서 로어북을 클릭해 여세요.
2. 편집기 헤더의 오른쪽 위 근처에 있는 내보내기 아이콘을 클릭하세요. 툴팁은 **Export lorebook**(로어북 내보내기)입니다.
3. **Export Lorebook** 창에서 형식을 고르세요. 브라우저가 파일을 다운로드합니다.

| 형식 | 만들어지는 것 | 쓰는 경우 |
| --- | --- | --- |
| **Marinara Native** | 모든 항목 필드와 폴더. 파일 이름은 `.marinara.json`으로 끝납니다. | 로어북을 다른 Marinara 설치본으로 옮길 때. |
| **Compatible JSON** | 폴더가 없는 World Info 파일로, 이름이 `.json`으로 끝납니다. Marinara에만 있는 일부 정보는 빠집니다. | 다른 롤플레이 도구. |
| **Markdown**(마크다운) | 항목마다 `## Name` 제목 하나와 `Keys:` 줄이 들어갑니다. | 텍스트 편집기에서 읽고 편집할 때. |
| **CSV** | name, keys, content, folder, enabled, constant, probability 열이 있는 스프레드시트. | 스프레드시트에서 여러 항목을 편집할 때. |

## 로어북 여러 개를 한 번에 내보내기

1. **Lorebooks** 패널에서 체크 표시 아이콘(**Select**)을 클릭하세요.
2. 원하는 로어북을 하나씩 체크하세요.
3. 아래쪽 막대에서 **Export**(내보내기)를 클릭하세요.

브라우저가 `marinara-lorebooks.zip`을 다운로드합니다. 일괄 내보내기는 항상 **Marinara Native**를 쓰므로, 다시 가져오면 모든 정보가 그대로 돌아옵니다.

## Markdown이나 CSV에서 항목 가져오기

Markdown이나 CSV 텍스트 파일에서 로어북에 항목을 추가할 수 있습니다. 예를 들어 내보낸 뒤에 편집한 파일을 쓸 수 있습니다.

1. 로어북을 열고 편집기 헤더에서 **Import entries from Markdown or CSV**(마크다운 또는 CSV에서 항목 가져오기)를 클릭하세요.
2. **Import entries**(항목 가져오기) 창에서 **Choose file**(파일 선택)을 클릭하거나, 상자에 텍스트를 붙여 넣으세요.
3. **Format**(형식)을 확인하세요. Marinara가 텍스트를 보고 형식을 추측합니다.
4. 미리보기를 읽어 보세요. Markdown은 항목마다 `## Name` 제목 하나, 선택 사항인 `Keys: a, b` 줄, 그다음 본문 텍스트를 쓰세요. CSV는 name, keys, content가 있는 머리글 행을 쓰고, 선택 사항으로 folder, enabled, constant, probability 열을 둘 수 있습니다. 미리보기에는 준비된 항목 수가 표시되고, 오류와 경고가 줄별로 나열됩니다.
5. **Import into**(가져올 대상)에서 **This lorebook**(현재 로어북) 또는 **New lorebook**(새 로어북)을 고르세요. 새 로어북이면 **New lorebook name**(새 로어북 이름)에 이름을 입력하세요.
6. **When an entry name already exists**(항목 이름이 이미 존재하는 경우)에서 **Skip the imported entry**(가져온 항목 건너뛰기), **Import as a renamed copy**(이름을 변경한 사본으로 가져오기), **Overwrite the existing entry**(기존 항목 덮어쓰기) 중 하나를 고르세요.
7. 항목 수가 표시된 **Import** 버튼을 클릭하세요.

토스트에 추가된 항목, 덮어쓴 항목, 건너뛴 항목이 각각 몇 개인지 표시됩니다.

작동하지 않는 경우: 필수 열이 빠진 것처럼 파일 전체에 영향을 주는 오류가 있거나 유효한 항목이 하나도 없으면 버튼이 비활성화된 상태로 남습니다. 미리보기에 나열된 줄을 고치세요.

## SillyTavern 폴더 통째로 가져오기

캐릭터, 채팅, 프리셋까지 들어 있는 SillyTavern 폴더 전체에서 가져오려면 [SillyTavern에서 가져오기](../data/importing-from-sillytavern.md)를 참고하세요.

## 관련 가이드

- [로어북 개요](overview.md)
- [로어북을 캐릭터와 페르소나에 연결하기](linking-to-characters.md)
- [로어북 시맨틱 검색](semantic-search.md)
- [SillyTavern에서 가져오기](../data/importing-from-sillytavern.md)
