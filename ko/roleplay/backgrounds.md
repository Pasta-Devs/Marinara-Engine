# Roleplay 배경

이 가이드에서는 Roleplay(롤플레이) 모드의 장면 배경을 설명합니다. 답변이 끝날 때마다 배경을 골라 주는 **Background** 에이전트, 직접 배경을 만드는 방법, 특정 채팅에 배경을 고정하는 방법을 다룹니다. 직접 올린 배경 라이브러리와 관련 설정은 [채팅 배경](../appearance/chat-backgrounds.md)에서, **Gallery**(갤러리)에서 만드는 AI 장면 그림은 [장면 배경](../media/scene-backgrounds.md)에서 설명합니다.

## 장면 배경

Roleplay 모드는 메시지 뒤에 장면 전체를 채우는 배경을 띄웁니다. 배경이 바뀔 때 Marinara는 이전 이미지에서 새 이미지로 부드럽게 교차 전환합니다. 그래서 장면이 툭 끊기지 않고 자연스럽게 넘어갑니다.

이 기능에 이미지 생성이 꼭 필요하지는 않습니다. 이미지 생성 연결을 설정하지 않았다면 배경은 단색으로 표시됩니다. 채팅은 평소처럼 텍스트 채팅으로 잘 작동합니다.

## Background 에이전트

**Background** 에이전트는 장면 배경을 대신 골라 주는 선택 기능입니다. 답변이 하나 끝날 때마다 실행됩니다. 현재 장면을 읽은 다음, 사용할 수 있는 모든 배경 중에서 가장 어울리는 이미지를 고릅니다. 라이브러리의 폴더는 **Settings**(설정)에서 정리를 돕는 수단일 뿐이며, 에이전트가 고를 수 있는 후보를 가리지 않습니다. 에이전트는 이미 있는 이미지를 고르기만 합니다. 배경을 자동으로 생성하는 일은 **Illustrator** 에이전트가 맡습니다.

**Background** 에이전트는 기본값이 꺼짐입니다. 켜는 방법은 다음과 같습니다.

1. Roleplay 채팅을 여세요.
2. **Chat Settings**(채팅 설정)를 여세요. 채팅 안의 **Chat Settings** 버튼은 직접 옮기지 않았다면 오른쪽 위에 있습니다.
3. **Agents**(에이전트) 항목을 여세요.
4. **Background** 에이전트를 활성화하세요.

이렇게 하면 이야기가 다른 장소로 옮겨 갈 때마다 장면 배경이 알아서 바뀝니다.

## 배경 직접 생성하기

에이전트 없이 직접 새 배경을 만들 수도 있습니다. Marinara가 장면 정보(장르, 배경 세계, 현재 위치, 날씨, 시간)로 이미지 프롬프트를 만들어 새 배경을 생성합니다.

1. **Chat Settings**를 열고 **Gallery** 섹션을 펼치세요.
2. **Background** 버튼을 클릭하세요.
3. 버튼이 끝날 때까지 기다리세요. 작업 중에는 **Generating...**으로 표시됩니다.

생성이 진행되는 동안 다음 안내가 보입니다. "AI background generation is running. The new background will be applied when it finishes." 완성된 이미지는 배경 라이브러리에 추가되고 장면에도 바로 적용됩니다.

직접 생성할 때는 **Illustrator** 에이전트의 이미지 연결을 먼저 쓰고, 없으면 기본 이미지 생성 연결로 넘어갑니다. **Background** 에이전트는 라이브러리에 있는 이미지를 고르기만 하므로 이미지 연결이 필요 없습니다. Marinara가 쓸 연결을 찾지 못하면 생성이 실패하고 다음 메시지가 나옵니다. "Choose an image generation connection for the Illustrator agent, or mark one as the default image connection."

장면 배경 생성은 Roleplay와 Game Mode(게임 모드)에서만 작동합니다. Conversation(대화) 모드에서는 쓸 수 없습니다.

## 채팅 하나에만 배경 지정하기

에이전트에게 맡기지 않고, 지금 보고 있는 채팅에 특정 배경을 고정할 수 있습니다.

1. **Settings**를 여세요.
2. **Appearance**(모양) 탭을 여세요.
3. **Backgrounds**(배경) 항목을 찾으세요.
4. **Chat Background**(채팅 배경화면) 아래에서 직접 올린 이미지나 게임 에셋 배경 중 하나를 고르세요.

기본 배경으로 되돌리려면 **Chat Background** 옆의 **Remove**(제거)를 클릭하세요.

## 배경 라이브러리와 흐림 효과

고를 수 있는 이미지는 **Settings**의 **Appearance**에 있는 같은 **Backgrounds** 항목에 모여 있습니다. 이미지 가져오기, 태그, 이름 바꾸기, 삭제, **Background Blur**(배경 흐림) 슬라이더, 새 Roleplay 채팅의 기본 배경 지정까지 라이브러리 전반은 [채팅 배경](../appearance/chat-backgrounds.md) 가이드에서 자세히 설명합니다.

## 관련 가이드

- [채팅 배경](../appearance/chat-backgrounds.md): 배경 업로드 라이브러리와 모양 관련 설정.
- [장면 배경](../media/scene-backgrounds.md): **Gallery**에서 만드는 AI 생성 장면 그림.
- [Roleplay Mode: 시작하기](getting-started.md): Roleplay 장면, 스프라이트, HUD 전반.
