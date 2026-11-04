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

## 배경 직접 생성하기

Marinara가 장면 정보(장르, 배경 세계, 위치, 날씨, 시간)로 이미지 프롬프트를 만들어 새 배경을 생성합니다.

시작하기 전에: **Illustrator** 에이전트를 설치하고 이 에이전트에 이미지 생성 계정을 지정하거나, 이미지 생성 계정 하나를 기본값으로 표시하세요. [AI 제공자에 연결하기](../connections/connecting-to-a-provider.md)를 참고하세요. Illustrator를 채팅에 추가할 필요는 없습니다.

1. 채팅 안의 슬라이더 버튼으로 **Chat Settings**를 열고 **Gallery**(갤러리)를 펼치세요.
2. **Background**(배경)를 클릭하세요. 작업하는 동안 버튼에 **Generating...**이 표시되고, Gallery에는 "Illustrator is generating a background image for this scene."이라는 안내가 나옵니다.
3. 작업이 끝날 때까지 기다리세요. 새 이미지가 배경 라이브러리에 추가되고 장면에 적용됩니다.

직접 생성할 때는 Illustrator 에이전트의 이미지 계정을 먼저 쓰고, 그다음 기본 이미지 생성 계정을 씁니다. Roleplay와 Game Mode(게임 모드)에서 작동하며, Conversation(대화)에서는 작동하지 않습니다.

작동하지 않는 경우: "Choose an image generation connection for the Illustrator agent, or mark one as the default image connection." 메시지는 Marinara가 이미지 계정을 찾지 못했다는 뜻입니다. 계정을 지정한 다음 다시 시도하세요. **Background** 버튼이 없다면 Illustrator가 설치되지 않은 것입니다.

## 라이브러리와 흐림 효과

고를 수 있는 이미지는 같은 **Backgrounds** 섹션에 있습니다. 이미지 가져오기, 태그, 이름 바꾸기, 삭제, **Background Blur**(배경 흐림) 슬라이더, 새 Roleplay 채팅의 기본 배경은 [채팅 배경](../appearance/chat-backgrounds.md)에서 설명합니다.

## 관련 가이드

- [채팅 배경](../appearance/chat-backgrounds.md): 업로드 라이브러리와 모양 관련 설정.
- [장면 배경](../media/scene-backgrounds.md): Gallery에서 만드는 AI 장면 그림.
- [Roleplay Mode: 시작하기](getting-started.md): Roleplay 무대, 스프라이트, HUD.
