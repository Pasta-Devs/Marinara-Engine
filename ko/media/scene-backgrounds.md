# 장면 배경과 Gallery

이 가이드에서는 AI가 만들어 주는 장면 배경, 즉 Marinara Engine이 **Gallery**(갤러리)에서 생성하는 배경 이미지와 Gallery 자체를 설명합니다. 관련 가이드가 둘 더 있습니다. 직접 올려 둔 이미지 중에서 고르는 방법은 [채팅 배경](../appearance/chat-backgrounds.md)에서, 턴마다 배경을 자동으로 골라 주는 에이전트는 [Roleplay 배경](../roleplay/backgrounds.md)에서 다룹니다.

## 장면 배경을 쓸 수 있는 곳

장면 배경은 Roleplay(롤플레이)와 Game Mode(게임 모드)에서 쓸 수 있습니다. Conversation(대화)에서는 쓸 수 없습니다. Conversation에서 생성을 시도하면 다음 메시지가 표시됩니다.

```
Scene background generation is available in Roleplay and Game modes.
```

배경을 생성하려면 **Image Generation**(이미지 생성) 연결이 필요합니다. 아직 없다면 먼저 하나 만드세요. [이미지 생성 제공자와 설정](image-providers.md)을 참고하세요.

## Gallery에서 배경 생성하고 적용하기

**Gallery**에는 채팅의 이미지와 동영상이 모여 있습니다. **Chat Settings**(채팅 설정) 안의 섹션이므로 Chat Settings를 열고 **Gallery**를 펼치세요. 컴퓨터에서는 별도 창으로 꺼낼 수 있습니다([채팅 설정 개요](../chats/chat-settings.md#popping-a-section-out-into-its-own-window) 참고). **Background**(배경) 버튼을 누르면 현재 장면에 맞는 배경 그림을 생성합니다.

배경을 생성하는 방법은 다음과 같습니다.

1. **Chat Settings**의 **Gallery** 섹션을 여세요.
2. **Background** 버튼을 클릭하세요.
3. 이미지를 만드는 동안 버튼 이름이 **Generating...**으로 바뀝니다.
4. "AI background generation is running. The new background will be applied when it finishes." 상태 메시지가 나타납니다.
5. 생성이 끝나면 새 이미지가 현재 장면에 곧바로 적용됩니다. "Background generated." 메시지로 완료를 알려 줍니다.

배경은 현재 장면을 바탕으로 만듭니다. 게임에서는 장르, 설정, 장소, 날씨, 시간대까지 반영합니다. 생성한 배경에는 **Backgrounds** 캔버스 크기가 적용되며, 기본값은 1280 x 720 픽셀입니다. 이 크기는 **Settings**(설정) → **Generations**(생성) → **Image Generation**에서 바꿀 수 있습니다.

### 이미지 연결이 설정되어 있지 않을 때

Marinara가 사용할 이미지 연결을 찾지 못하면 생성 단계가 실패하고 다음 메시지가 표시됩니다.

```
Choose an image generation connection for the Illustrator agent, or mark one as the default image connection.
```

이때는 **Connections**(연결) 패널을 열고 **Defaults**(기본값)를 펼친 다음 **Images**(이미지)에서 이미지 연결을 고르세요. 또는 **Illustrator** 에이전트에 이미지 연결을 따로 지정해도 됩니다.

## Gallery 섹션

**Gallery**에는 **Images**와 **Videos**(동영상) 두 개의 탭이 있습니다. 각 탭에는 담긴 항목 수가 함께 표시됩니다. **Videos** 탭은 해당 채팅에서 장면 동영상이 활성화되어 있을 때만 나타납니다.

섹션 위쪽의 동작 버튼은 그 기능을 현재 채팅에서 쓸 수 있을 때만 나타납니다.

- **Illustrate**: Illustrator 에이전트를 실행해 장면 이미지를 한 장 만듭니다. [Illustrator 에이전트](illustrator-agent.md)를 참고하세요.
- **Selfie**(셀카): Conversation에서 캐릭터의 셀카를 생성합니다.
- **Background**: 위에서 설명한 대로 장면 배경을 생성하고 적용합니다.
- **Video**(비디오): 가장 최근 삽화로 장면 동영상을 만듭니다.
- **Create storyboard**(스토리보드 만들기): Storyboard가 켜져 있을 때 가장 최근 Game Mode 턴이나 완료된 Roleplay 에피소드의 키프레임을 생성합니다.
- **Browse Images**(이미지 찾아보기): 저장해 둔 이미지를 골라 넣을 수 있는 브라우저를 엽니다.
- **View storyboard**(스토리보드 보기): 가장 최근 Game Mode 스토리보드를 엽니다.

버튼 아래에는 **Upload Images**(이미지 업로드) 드롭존이 있습니다. 여기에 이미지를 끌어다 놓으면 직접 준비한 그림을 이 채팅의 Gallery에 추가할 수 있습니다.

### 이미지별 동작

**Images** 탭에서 이미지 위에 포인터를 올리거나, 모바일에서는 이미지를 탭하면 사용할 수 있는 동작이 나타납니다.

- 이미지를 원래 크기로 열기(**Open gallery image**).
- **Pin to chat**(채팅에 고정): 이미지를 채팅에 고정합니다.
- **Download image**(이미지 다운로드): 이미지를 기기에 저장합니다.
- **Animate illustration**(삽화 애니메이션 만들기): 그 이미지를 장면 동영상으로 만듭니다.
- **Copy prompt**(프롬프트 복사): 저장된 이미지 프롬프트를 복사합니다. 저장된 프롬프트가 없으면 **No prompt saved**로 표시되고 사용할 수 없습니다.
- **Delete gallery image**(갤러리 이미지 삭제): 확인을 거친 뒤 이미지를 삭제합니다.

## 전송 전에 프롬프트 확인하기

Marinara가 이미지 제공자에게 배경 요청을 보내기 전에 프롬프트를 확인하고 고칠 수 있습니다.

1. **Settings** → **Generations** → **Image Generation**을 여세요.
2. **Expose media prompts before sending**(전송 전에 미디어 프롬프트 표시)을 켜세요.

이 설정을 켜면 요청을 보내기 전에 **Review Image Prompt** 창이 열립니다. 창의 안내 문구는 "Edit the prompt below before Marinara sends the image request to your provider."입니다.

이 창에서는 다음을 할 수 있습니다.

- 프롬프트 본문과 네거티브 프롬프트를 수정합니다.
- 이미지 종류와 크기, 그리고 실시간 글자 수를 확인합니다.
- **Cancel**(취소)을 클릭해 중단하거나 **Generate**(생성)를 클릭해 전송합니다.

프롬프트 입력란이 하나라도 비어 있으면 **Generate**를 누를 수 없고 "Every image request needs a prompt." 안내가 나타납니다. 입력한 글은 적은 그대로 전송됩니다.

## 저장한 배경 관리하기

생성한 장면 배경은 모두 배경 라이브러리에 저장됩니다. 같은 라이브러리에 직접 준비한 이미지를 추가할 수도 있습니다. 업로드하는 배경은 JPG, PNG, GIF, WebP, AVIF 형식을 지원하며 파일당 최대 20 MB입니다.

직접 추가한 배경에는 태그를 달거나 이름을 바꾸거나 삭제할 수 있습니다. 태그는 소문자로 저장되고 영문자, 숫자, 공백, 하이픈, 밑줄을 쓸 수 있으며 하나당 최대 40자입니다. 기본 제공 게임 에셋 배경도 함께 표시되지만, 이름 변경과 태그 지정, 삭제는 할 수 없습니다.

이 라이브러리를 관리하고 채팅별 배경이나 기본 배경을 지정하는 일은 모양 설정에서 합니다. 라이브러리 전체와 선택 화면, **Background Blur**(배경 흐림)는 [채팅 배경](../appearance/chat-backgrounds.md)에서 확인하세요.

## 관련 가이드

- [채팅 배경](../appearance/chat-backgrounds.md): 직접 골라 쓰는 업로드 라이브러리입니다.
- [Roleplay 배경](../roleplay/backgrounds.md): 턴마다 배경을 자동으로 골라 주는 에이전트입니다.
- [Illustrator 에이전트](illustrator-agent.md): Roleplay와 Game Mode의 장면 삽화입니다.
- [이미지 생성 제공자와 설정](image-providers.md): 이미지 연결을 설정합니다.
- [장면 동영상 생성](scene-video.md): Gallery의 이미지를 동영상으로 만듭니다.
