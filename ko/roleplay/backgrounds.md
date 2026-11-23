# Roleplay 배경

이 가이드에서는 Roleplay(롤플레이) 채팅의 장면 배경을 설명합니다. Roleplay 채팅은 메시지 뒤에 장면 전체를 채우는 이미지를 표시합니다. 답변이 끝날 때마다 **Background** 에이전트가 고르게 하거나, 새 이미지를 직접 만들거나, 이미지 하나를 채팅 하나에 고정할 수 있습니다. 이미지가 바뀌면 Marinara는 이전 이미지에서 새 이미지로 서서히 전환합니다.

이미지 생성이 꼭 필요하지는 않습니다. 이미지 생성 계정이 없으면 배경은 단색으로 표시되고 채팅은 텍스트로 작동합니다.

## 채팅 하나에만 배경 지정하기

에이전트에게 맡기지 않고, 지금 열려 있는 채팅 뒤에 이미지 하나를 계속 두려면 이 방법을 쓰세요. 그 채팅만 바뀝니다.

1. 채팅을 여세요. 그다음 **Settings → Appearance**(설정 → 모양)를 열고 **Backgrounds**(배경)를 찾으세요.
2. **Chat Background**(채팅 배경화면) 아래에서 업로드한 이미지나 게임 에셋 배경 중 하나를 고르세요.

메시지 뒤에 그 이미지가 보입니다. 기본값으로 되돌리려면 **Chat Background** 옆의 **Remove**(제거)를 클릭하세요.

아직 이미지가 없다면 먼저 하나를 업로드하세요. [채팅 배경](../appearance/chat-backgrounds.md)을 참고하세요.

## Background 에이전트에게 배경 맡기기

**Background** 에이전트는 답변과 나란히 실행되는 도우미입니다. 답변이 끝날 때마다 현재 장면을 읽고, 모든 배경 중에서 가장 잘 어울리는 이미지를 고릅니다. 이미 있는 이미지만 고릅니다. 새 이미지를 자동으로 만드는 것은 **Illustrator** 에이전트입니다.

1. Roleplay 채팅을 여세요.
2. 채팅 안의 슬라이더 버튼으로 **Chat Settings**(채팅 설정)를 여세요.
3. **Agents**(에이전트)를 열고 **Enable Agents**(에이전트 활성화)를 켜세요.
4. **Background** 에이전트를 추가하세요.

이제 이야기가 다른 장소로 옮겨 갈 때마다 배경이 알아서 바뀝니다.

작동하지 않는 경우: 배경이 한두 개뿐이면 에이전트는 계속 그 배경만 고릅니다. 라이브러리에 배경을 더 추가하세요. [채팅 배경](../appearance/chat-backgrounds.md)을 참고하세요.

## 이미 가진 그림 재사용하기

Illustrator가 자동으로 배경을 만들 때 이야기가 새 장소로 이동하면, 먼저 그 장소에 고정한 배경이 있는지 확인합니다([장소에 배경 고정하기](#pin-a-background-to-a-place) 참고). 고정한 장소에서는 그림을 그리지 않습니다. 그렇지 않으면 배경 라이브러리를 살펴봅니다. 파일 이름이나 두 단어 이상인 태그 중 하나가 World State의 위치에 나타나면 그 그림을 해당 장소에 사용합니다. 예를 들어 `john-bedroom.png`는 "Smith House, John's bedroom"에 사용됩니다. 대소문자, 악센트 부호, "'s"는 구분하지 않으며, 더 구체적인 이름이 단순한 `bedroom.png`보다 우선합니다.

World State 위치가 없으면 Illustrator가 새 배경에 붙인 장소 이름을 같은 방식으로 비교합니다. 맞는 그림이 있으면 그 그림을 표시하고 새로 그리지 않습니다. 일치하는 그림이 없는 장소만 새 그림을 만듭니다.

한 장소에서 같은 그림을 쓰게 하려면 장소에 맞춰 파일 이름을 지으세요("Kitchen"에는 `kitchen.png`). `smith house kitchen`처럼 두 단어 이상인 태그도 쓸 수 있습니다. `kitchen`이나 `night`처럼 한 단어인 태그는 보통 그림의 특징을 나타내므로 무시합니다.

## 배경 직접 생성하기

Marinara가 장면 정보(장르, 배경 세계, 위치, 날씨, 시간)로 이미지 프롬프트를 만들어 새 배경을 생성합니다.

시작하기 전에: **Illustrator** 에이전트를 설치하고 이 에이전트에 이미지 생성 계정을 지정하거나, 이미지 생성 계정 하나를 기본값으로 표시하세요. [AI 제공자에 연결하기](../connections/connecting-to-a-provider.md)를 참고하세요. Illustrator를 채팅에 추가할 필요는 없습니다.

1. 채팅 안의 슬라이더 버튼으로 **Chat Settings**를 열고 **Gallery**(갤러리)를 펼치세요.
2. **Background**(배경)를 클릭하세요. 작업하는 동안 버튼에 **Generating...**이 표시되고, Gallery에는 "Illustrator is generating a background image for this scene."이라는 안내가 나옵니다.
3. 작업이 끝날 때까지 기다리세요. 새 이미지가 배경 라이브러리에 추가되고 장면에 적용됩니다.

직접 생성할 때는 Illustrator 에이전트의 이미지 계정을 먼저 쓰고, 그다음 기본 이미지 생성 계정을 씁니다. Roleplay와 Game Mode(게임 모드)에서 작동하며, Conversation(대화)에서는 작동하지 않습니다.

작동하지 않는 경우: "Choose an image generation connection for the Illustrator agent, or mark one as the default image connection." 메시지는 Marinara가 이미지 계정을 찾지 못했다는 뜻입니다. 계정을 지정한 다음 다시 시도하세요. **Background** 버튼이 없다면 Illustrator가 설치되지 않은 것입니다.

<a id="pin-a-background-to-a-place"></a>

## 장소에 배경 고정하기

이야기 속 장소가 항상 같은 모습이어야 할 때 사용하세요. John의 침실에는 항상 `john-bedroom`이, 내 침실에는 항상 `my-bedroom`이 표시되게 할 수 있습니다. 이야기가 고정한 장소에 도착하면 Background 에이전트가 무엇을 골랐든 그 장소의 그림이 표시됩니다.

1. 채팅 안의 슬라이더 버튼으로 **Chat Settings**를 열고 **Background**를 여세요.
2. **Pinned places**(고정한 장소) 아래에서 **Add place**(장소 추가)를 클릭하세요.
3. 빈 그림을 클릭하고 배경을 고르세요. `John's bedroom`처럼 이야기에서 쓰는 그대로 장소를 입력하세요.
4. 선택 사항: 그 아래에 `John's room, the master bedroom`처럼 이야기에서 쓸 수 있는 다른 이름을 쉼표로 구분해 추가하세요.

더 빠른 방법: 이야기가 해당 장소에 있고 알맞은 그림이 표시되어 있을 때 **Pin this picture to "John's bedroom"**(이 사진을 "John's bedroom"에 고정)을 클릭하세요.

장소를 구분하는 방식은 다음과 같습니다.

- 가장 구체적인 이름이 우선합니다. `John's bedroom`과 `{{user}}'s bedroom`은 섞이지 않으며, 단순히 `bedroom`으로 고정한 배경은 따로 고정하지 않은 침실에만 적용됩니다.
- 중간에 한두 단어가 있어도 일치합니다. "John's guest bedroom"은 그 장소를 정확히 지정한 다른 고정 항목이 없으면 `John's bedroom`과 일치합니다.
- `{{user}}`는 내 페르소나 이름이고 `{{char}}`는 채팅의 모든 캐릭터를 가리키므로, `{{user}}'s bedroom`은 "Alyssa's bedroom"과 일치합니다.
- "My"와 "our"는 메시지를 쓴 사람을 가리킵니다. John의 답변에서 이야기의 장소를 "my bedroom"이라고 하면 John의 침실이고, 그의 답변에서 "your bedroom"은 내 침실입니다. 내가 쓴 메시지의 "your bedroom"은 채팅에 캐릭터가 한 명뿐일 때 그 캐릭터의 침실입니다.
- 대소문자, 악센트 부호, 아포스트로피는 구분하지 않습니다. 이름은 단어 전체가 일치해야 합니다. `John`은 "Johnson"과 일치하지 않습니다.
- **World Maps**를 사용할 때는 대신 **World Maps place**(World Maps 장소) 목록에서 장소를 고르세요. 건물에 배경을 고정하면 별도로 고정하지 않은 건물 안의 방에도 적용됩니다.

다음과 같이 작동합니다.

- 도착할 때 그림이 한 번 표시됩니다. 그곳에 있는 동안 직접 다른 배경을 고르면 이야기가 다른 장소로 이동할 때까지 직접 고른 배경이 유지됩니다.
- 고정한 장소에서는 Background 에이전트가 그림을 바꿀 수 없고, Illustrator도 새 배경을 그리지 않습니다.
- **World State**(세계 상태) 에이전트의 위치(또는 World Maps)가 필요합니다. 목록 아래쪽에는 이야기의 현재 장소가 표시되고, **Here**(현재 위치)는 사용 중인 고정 항목을 표시합니다. 고정한 배경은 Roleplay 채팅에서 작동합니다.

작동하지 않는 경우: 목록 아래의 **Story is at**에 장소가 표시되는지, 고정 항목의 이름 중 하나가 그 안에 나타나는지 확인하세요.

### 캐릭터를 따라가는 배경

캐릭터나 페르소나의 **Gallery**에서 배경으로 지정한 그림은 채팅마다 따로 고정하지 않아도 그 캐릭터가 있는 모든 채팅에 나타납니다.

1. 캐릭터의 **Gallery**를 열고 그림의 태그 버튼을 클릭한 다음 **Use as background**(배경으로 사용)를 고르세요.
2. `{{char}}'s bedroom, {{char}}'s room`처럼 그림에 나온 장소를 쉼표로 구분해 입력하세요. 캐릭터 갤러리에서 `{{char}}`는 그 캐릭터이고, 페르소나 갤러리에서 `{{user}}`는 그 페르소나입니다. 그림이 특정 장소를 나타내지 않으면 비워 두세요.

장소 이름을 지정한 그림은 그 캐릭터가 있는 모든 채팅에서 고정한 장소처럼 작동하며, **Chat Settings → Background**(채팅 설정 → 배경)의 **Pinned places** 아래에 나열됩니다. 채팅 자체에서 고정한 배경은 같은 이름의 갤러리 그림보다 우선합니다.

## 라이브러리와 흐림 효과

고를 수 있는 이미지는 같은 **Backgrounds** 섹션에 있습니다. 이미지 가져오기, 태그, 이름 바꾸기, 삭제, **Background Blur**(배경 흐림) 슬라이더, 새 Roleplay 채팅의 기본 배경은 [채팅 배경](../appearance/chat-backgrounds.md)에서 설명합니다.

## 관련 가이드

- [채팅 배경](../appearance/chat-backgrounds.md): 업로드 라이브러리와 모양 관련 설정.
- [장면 배경](../media/scene-backgrounds.md): Gallery에서 만드는 AI 장면 그림.
- [Roleplay Mode: 시작하기](getting-started.md): Roleplay 무대, 스프라이트, HUD.
