# Illustrator 에이전트

**Illustrator**는 채팅하는 동안 장면을 그림으로 그려 주는 다운로드 가능한 에이전트입니다. 이 가이드에서는 Illustrator를 켜고, 그림체와 이미지 모델을 고르고, 클립을 만드는 방법을 설명합니다. 에이전트는 채팅 하나에서 자동으로 실행되는 작은 AI 도우미입니다.

## Illustrator가 하는 일

Illustrator는 후처리 에이전트이므로 AI가 답변을 마칠 때마다 그 뒤에 실행됩니다. 최신 답변을 읽고 그림으로 남길 만한 순간인지 판단합니다. 그럴 만하다면 이미지 프롬프트(이미지 모델에 무엇을 그릴지 알려 주는 텍스트)를 써서 이미지 서비스에 보냅니다. 만든 이미지는 모두 채팅 **Gallery**(갤러리)에 저장됩니다.

모든 메시지를 그리지는 않습니다. 이미지를 하나 만든 뒤에는 기본적으로 수락된 사용자 메시지와 어시스턴트 메시지가 5개 쌓일 때까지 기다려야 다음 이미지를 만들 수 있습니다. Roleplay 채팅마다 이 수를 바꿀 수 있습니다. 답변을 스와이프하거나 재생성해도 이 수는 늘어나지 않습니다. 그림으로 남길 만한 순간이 아니라고 판단하면 건너뜁니다.

Roleplay(롤플레이)와 Game Mode(게임 모드) 채팅에서 동작합니다. 설치하면 Conversation(대화) 셀카와 [동영상 메시지](../conversation/selfies.md#video-messages)도 함께 추가됩니다. 이 가이드의 설정은 Roleplay 기준입니다. Game Mode는 스위치 하나를 씁니다([Game Mode](#game-mode-the-game-illustrator-toggle) 참고).

## 시작하기 전에

Illustrator는 프롬프트를 쓰지만, 그림은 별도의 이미지 모델이 그립니다. 이미지 모델이 하나 필요합니다. [이미지 생성 제공자와 설정](image-providers.md)을 참고하세요.

이미지 모델을 지정하는 방법은 두 가지입니다.

1. **Connections**(연결) 패널의 **Defaults**(기본값)에서 **Images**(이미지) 작업을 설정하세요.
2. 또는 Illustrator의 **Open Setup**(설정 열기) 화면에서 Illustrator 전용 이미지 모델을 지정하세요.

이미지 모델을 찾을 수 없으면 그림 생성이 실패하고 앱이 모델을 고르라고 요청합니다.

## Illustrator 켜기

시작하기 전에 **Agent Organizer**에서 **Illustrator**를 설치하세요. [에이전트: 채팅을 도와주는 AI](../agents/agents-overview.md)를 참고하세요.

1. 그림을 넣을 Roleplay 채팅을 여세요.
2. **Chat Settings**(채팅 설정)를 열고 **Agents**(에이전트)를 찾으세요.
3. **Enable Agents**(에이전트 활성화)를 켜세요.
4. **Misc Agents**(기타 에이전트) 그룹에서 **Illustrator**를 찾아 더하기 버튼으로 추가하세요.

자체 옵션이 있는 **Illustrator** 카드가 나타납니다. 에이전트는 토큰을 더 쓰며 턴마다 모델 호출을 늘릴 수 있습니다. 토큰 추정치에는 에이전트 지시문만 포함됩니다.

<a id="game-mode-the-game-illustrator-toggle"></a>

### Game Mode: Game Illustrator 토글

Game Mode에는 **Prompt Mode**(프롬프트 모드)나 **Prompt Model**(프롬프트 모델) 옵션이 없습니다. 게임의 **Chat Settings**를 열고 **Game Illustrator**(게임 Illustrator)를 켜세요("Auto-generate scene illustrations, NPC portraits, and location backgrounds during gameplay").

## 그림체 고르기

**Prompt Mode** 선택기(카드에는 **Prompt**로 표시됨)는 Illustrator가 쓰는 모든 프롬프트의 그림체를 정합니다. 새 Illustrator는 **Background**로 시작합니다.

| 그림체 | 그리는 것 |
| --- | --- |
| **Illustration** | 완성도 높은 장면 그림 한 장입니다. 무난한 범용 그림체입니다. |
| **Comic Page** | 칸, 말풍선, 캡션, 효과음이 들어간 만화 페이지입니다. |
| **Colored Manga** | 양식화된 말풍선과 효과음이 들어간 컬러 만화 장면입니다. |
| **B&W Manga** | 펜선과 스크린톤 음영으로 그린 흑백 만화 페이지입니다. |
| **Background** | 캐릭터가 없는 장소 그림 또는 상황 설정 컷입니다. |
| **Selfie** | 캐릭터가 직접 찍은 셀카나 가벼운 인물 사진입니다. |

최종 결과물의 느낌은 스타일 프로필에도 좌우됩니다. [이미지 스타일 프로필](style-profiles.md)을 참고하세요.

## 프롬프트 모델 고르기

**Prompt Model**은 이미지 프롬프트를 쓰는 텍스트 모델입니다. 그림을 그리지는 않습니다. 카드의 **Prompt Model** 목록에서 고르세요. 기본값은 **Main chat model**이며, 채팅의 모델을 그대로 씁니다. 다른 모델에 프롬프트 작성을 맡기고 싶다면 다른 텍스트 모델을 고르세요.

그림을 그리는 이미지 모델은 **시작하기 전에**에서 지정한 모델입니다.

## 캐릭터를 일관되게 유지하기

카드의 설정 두 개가 그림마다 캐릭터가 같은 모습으로 보이도록 돕습니다. 둘 다 처음에는 꺼져 있습니다.

**Attach Card Appearance**(카드 외형 첨부)는 보이는 캐릭터마다 저장된 외형 텍스트를 이미지 프롬프트에 덧붙입니다. Roleplay 채팅에서는 선택지가 네 개인 목록입니다.

- **Off**(꺼짐)
- **Images only**(이미지만): 평소 동작입니다.
- **Videos only**(동영상만): 클립에 등장하는 캐릭터의 외형 텍스트를 클립이 받습니다. 그림이 없는 **Prompt only** 클립에서 특히 중요합니다.
- **Images and videos**(이미지와 동영상): 둘 다 적용합니다.

이 설정이 켜져 있으면 **Image Appearance Override**(이미지 외모 재정의)를 켠 카드나 페르소나는 **Appearance**(모양) 텍스트 대신 그 재정의 텍스트를 보냅니다. **Appearance**가 내레이터용으로 쓰여 있어 이미지 모델이 읽기 어려울 때 사용하세요. 전체 설명은 **Appearance**에 두고, 재정의에는 더 짧은 태그 형식을 넣으세요. 재정의를 끄거나 비워 두면 이미지 프롬프트는 **Appearance**를 사용합니다. 내레이터는 항상 **Appearance** 전체를 봅니다. 이 스위치는 캐릭터 편집기와 페르소나 편집기의 **Appearance** 아래에 있습니다.

**Send Avatar References**(아바타 참조 전송)는 캐릭터와 페르소나의 아바타나 스프라이트를 참조 이미지로 이미지 서비스에 보내, 모델이 얼굴이나 복장을 따라 그릴 수 있게 합니다. 참조 이미지를 받지 않는 서비스도 있습니다. Roleplay 채팅에서는 **Attach Card Appearance**와 같은 목록입니다. 동영상을 포함하면 **First frame**(첫 프레임)이 **Prompt only**인 클립은 캐릭터의 아바타나 스프라이트에서 시작하며, 선택지는 **Prompt only (avatar from Send Avatar References)**로 표시됩니다.

## 그리는 빈도 조절하기

Illustrator 카드에는 전체 설정 화면을 여는 **Open Setup** 버튼이 있습니다. 여기에서 기본 실행 간격을 정하고 전용 이미지 모델을 지정합니다.

Roleplay 채팅마다 **Chat Settings**의 카드에 자체 **Image Run Interval**(이미지 실행 간격)이 있습니다("Messages between automatic images in this chat. 0 means only when you ask."). 값을 정하지 않은 채팅은 설정 화면의 값을 쓰며, 기본값은 **5**입니다. 카드에는 **Using agent default**(에이전트 기본값 사용 중) 또는 **Chat override**(채팅 재정의)가 표시됩니다. 되돌리려면 **Use agent default**(에이전트 기본값 사용)를 누르세요. 채팅에 Illustrator를 추가할 때 추가 창에도 같은 필드가 나오며, 값은 그 채팅에만 저장됩니다.

수동 전용 모드로 쓰려면 **Image Run Interval**을 **0**으로 설정하세요. 자동 장면 배경을 포함한 자동 실행이 멈추지만, 에이전트는 Gallery 작업에 계속 쓸 수 있습니다. 다시 시작하려면 양수를 설정하세요.

지금 바로 그림을 만들려면 **Chat Settings**를 열고 **Gallery**를 펼친 다음 **Illustrate**(이미지 생성)를 클릭하세요. Illustrator가 즉시 한 번 실행되고, 버튼에 **Generating...**(생성 중...)이 표시됩니다.

## 클립 만들기

Roleplay 채팅의 **Chat Settings → Agents → Illustrator**에는 **Illustrator makes**(Illustrator 생성물) 설정이 있습니다.

- **Pictures**(이미지): 기본값입니다. 그림만 만듭니다.
- **Pictures and clips**(이미지 및 클립): 액션, 추격, 무언가 부서지는 장면처럼 동작이 중요할 때 Illustrator가 새 그림을 짧은 클립으로 바꿀 수도 있습니다. 이야기를 서술하는 모델이 `[illustrate]`로 요청한 그림도 포함됩니다. 동작은 동영상 모델의 **Video prompting instructions**(동영상 프롬프트 지시문)에 따라 직접 작성합니다. 그림이 먼저 나타나고, 클립은 준비되면 같은 메시지에 추가됩니다.
- **Clips only**(클립만): Illustrator가 그림을 보여 줄 자리마다 짧은 클립을 보여 줍니다. Illustrator가 그린 그림은 클립의 첫 프레임이 되고, 답변이 아니라 Gallery로 갑니다. 클립이 실패하면 그림이 표시됩니다.

클립은 **Scene Videos**(장면 비디오)의 동영상 모델을 쓰며, 클립마다 동영상 요청이 하나씩 발생합니다. 작동하는 동영상 모델이 없으면 **Clips only**에서도 Illustrator는 그림을 만듭니다. 이미지를 만드는 사용자 지정 에이전트도 같은 설정을 따릅니다. [장면 동영상 생성](scene-video.md)을 참고하세요.

**Video Run Interval**(동영상 실행 간격)은 Illustrator가 클립을 만들도록 설정하면 나타납니다. 클립이 나온 뒤 다음 클립까지 지나야 하는 사용자 메시지와 어시스턴트 메시지 수이며, **Image Run Interval**과는 별개입니다.

- **Clips only**에서는 모든 실행이 클립이 되고, **Video Run Interval**이 Illustrator의 실행 빈도를 정하며, **Image Run Interval**은 숨겨집니다.
- 값이 없는 채팅은 **Open Setup** 화면의 **Video Run Interval**을 쓰고, 거기에도 없으면 5를 씁니다.
- **0**: 스스로 클립을 만들지 않습니다. `[illustrate]` 그림도 마찬가지이며, 이때는 그림이 대신 나옵니다.
- 답변 하나가 받는 클립은 최대 **Videos per reply**(응답당 동영상 수)개입니다. 이 값은 **Settings → Generations → Video Generation**(설정 → 생성 → 동영상 생성)에 있습니다.
- Gallery에서 그림을 애니메이션으로 만드는 기능은 계속 쓸 수 있습니다. **Clips only**에서는 메시지의 **Illustrate** 버튼이 클립을 만듭니다.
- 클립을 받은 답변을 스와이프하면 새 답변으로 계산되어 자체 클립을 받을 수 있습니다. 이전 스와이프는 기존 클립을 유지합니다.

같은 섹션의 **First frame**은 모든 Roleplay 클립이 무엇에서 시작할지 정합니다. Illustrator의 클립, `/video`, Gallery의 **Video**(비디오) 버튼에 적용됩니다. 선택지는 새 Illustrator 그림, 이름이 나온 캐릭터의 아바타나 스프라이트, 그림을 쓰되 없으면 아바타로 대체하는 방식, 그림 없음입니다. Conversation 동영상 메시지도 같은 설정을 씁니다.

- 아바타나 그림 없음을 고른 **Clips only**: 그림을 그리지 않습니다. 클립은 Illustrator가 작성한 장면과 동작으로 만들어집니다.
- **Pictures and clips**: 그림은 계속 표시되며, 클립만 아바타에서 시작하거나 아무것도 없이 시작합니다.
- 첫 프레임을 고르지 않음: 클립만을 위해 그림을 그리는 일은 없습니다. **Pictures and clips**는 Illustrator가 방금 만든 그림을 애니메이션으로 바꿉니다. **Clips only**, `/video`, **Video**는 장면만으로 클립을 만듭니다.

자체 그림이 없는 클립은 페르소나를 포함해 이름이 나온 모든 인물을 묘사합니다. 아바타 첫 프레임은 처음 이름이 나온 인물에서 시작합니다.

메시지의 **Illustrate** 버튼으로 Illustrator를 다시 실행해도 **Illustrator makes**와 **First frame**을 따릅니다.

## NovelAI의 여러 캐릭터 장면

Illustrator의 이미지 모델이 V4, V4.5 또는 V5 모델을 쓰는 NovelAI이면, 프롬프트 작성 모델이 보이는 캐릭터마다 캐릭터별 설명을 하나씩 추가합니다. 각 설명에는 그 캐릭터의 외모, 표정, 자세, 화면 안의 대략적인 위치가 담깁니다. Marinara는 설명을 장면의 캐릭터 목록과 대조해 일치하지 않는 설명은 버리고, 나머지를 메인 프롬프트와 함께 NovelAI 고유의 캐릭터 프롬프트로 보냅니다. 이렇게 하면 머리카락, 옷 등의 특징이 캐릭터끼리 섞이지 않습니다. **Illustrate**로 만든 이미지와 캐릭터의 `[illustrate]` 명령으로 만든 이미지에도 같은 설명이 붙습니다.

V5는 최대 22명, V4와 V4.5는 최대 6명을 받습니다. 보이는 캐릭터가 더 많으면 가장 중요한 캐릭터를 남기고 나머지는 이름 없는 배경 인물이 됩니다.

고정된 특징은 **Appearance** 필드에서 가져옵니다. 이미 Danbooru 태그로 되어 있으면 그대로 복사하고, 일반 문장이면 작성 모델이 태그로 바꿉니다. 옷은 캐릭터 트래커가 실행될 때 트래커의 현재 의상에서 가져오며, 역시 태그로 바꿉니다.

**Attach Card Appearance**를 켜면 작성 모델은 채팅에 있는 모든 카드와 페르소나의 Appearance 전문도 받으므로, 긴 카드나 여러 캐릭터를 담은 카드가 잘리지 않습니다. 여러 캐릭터를 `[NAME] tags | [NAME] tags` 형식으로 설명한 카드는 캐릭터별로 나뉘어 나열됩니다. 작성 모델은 고정된 특징을 해당 캐릭터의 설명에 복사하고, 카드의 의상 태그는 트래커나 장면이 덮어쓰는 기본값으로 취급하며, 장면에 없는 캐릭터는 무시합니다. 설명이 돌아오면 Marinara는 아무것도 더 덧붙이지 않습니다. 캐릭터가 한 명인 경우처럼 설명이 없으면 이전처럼 평소의 외형 줄을 메인 프롬프트에 추가합니다.

별도 설정은 필요 없습니다. 캐릭터별 설명은 NovelAI 자체 호스트를 쓸 때만 나타나므로 프록시나 다른 서비스는 영향을 받지 않습니다. **Expose media prompts before sending**(전송 전에 미디어 프롬프트 표시)을 켜면 검토 창이 메인 프롬프트 아래에 설명을 읽기 전용으로 나열합니다. 메인 프롬프트는 평소처럼 편집하세요.

## 갤러리 저장과 프롬프트 확인

**Settings → Generations → Image Generation**(설정 → 생성 → 이미지 생성)의 **Automatically save generated images to character galleries**(생성한 이미지를 캐릭터 갤러리에 자동 저장)는 기본적으로 켜져 있습니다. 끄면 채팅 일러스트와 셀카가 이미지에 나온 캐릭터와 페르소나의 갤러리에 더 이상 추가되지 않습니다. 이미지는 대화와 채팅 Gallery에 계속 표시되며, 갤러리에 직접 저장하는 기능도 계속 동작합니다. 기존 항목은 바뀌지 않습니다. 갤러리는 이미지 파일을 공유하므로 이 설정은 갤러리 포함 여부를 정할 뿐 파일을 삭제하지 않습니다.

새 NovelAI 일러스트의 경우 이미지 검사기에 장면 및 스타일 프롬프트가 표시되고, 그 뒤에 캐릭터별 긍정 설명이 ` | `로 구분되어 이어집니다. 갤러리에 저장되는 프롬프트도 같습니다.

답변을 재생성하지 않고 프롬프트를 바꿔 일러스트를 다시 그리려면 일러스트를 열고 **Regenerate image**(이미지 재생성)를 사용하세요. [이미지 다시 만들기](scene-backgrounds.md#regenerating-an-image)를 참고하세요.

Roleplay의 이전 메시지나 범위를 그림으로 만들려면 `/illustrate range=12` 또는 `/illustrate range=12-18`을 사용하세요. [슬래시 명령어](../chats/slash-commands.md)를 참고하세요.

## 관련 가이드

- [이미지 생성 제공자와 설정](image-providers.md)
- [이미지 스타일 프로필](style-profiles.md)
- [장면 배경과 Gallery](scene-backgrounds.md)
- [에이전트: 채팅을 도와주는 AI](../agents/agents-overview.md)
- [AI 제공자에 연결하기](../connections/connecting-to-a-provider.md)
