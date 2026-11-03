# 셀카

이 가이드에서는 캐릭터가 자신을 그려서 Conversation 채팅에 보내는 이미지, 즉 셀카를 설명합니다. 메신저 앱에서 공유하는 사진과 같습니다. 셀카를 켜는 방법, 모습을 고르는 방법, 직접 요청하는 방법, 동영상 메시지를 다룹니다.

셀카는 선택 사항인 **Illustrator** 패키지에서 오며 이미지 생성을 사용합니다. 셀카 한 장은 내가 고른 서비스에 보내는 이미지 요청 1번입니다. 그래서 직접 설정하기 전까지는 꺼져 있습니다. Roleplay와 Game Mode의 장면 그림과는 다릅니다.

## 셀카 켜기

**시작하기 전에:** **Agents**(에이전트) → **Agent Organizer**에서 **Illustrator**를 설치하고, 이미지 계정을 추가하세요. 이미지 계정은 그림을 만들어 주는 서비스의 계정입니다([이미지 생성 제공자와 설정](../media/image-providers.md) 참고).

1. Conversation 채팅을 열고 **Chat Settings**(채팅 설정)를 여세요.
2. **Agents** 섹션을 찾아 **Illustrator Settings**(Illustrator 설정)를 여세요.
3. **Generated Selfies**(생성된 셀카)를 켜세요. 아래에 셀카 설정이 나타납니다.
4. **Selfie model**(셀카 연결)에서 이미지 계정을 고르세요.

**Generated Selfies**를 켜면 이 채팅의 마스터 **Commands**(명령어) 스위치도 함께 켜집니다.

**Selfie model**을 정하고 나서야 캐릭터가 셀카를 보냅니다. 그전까지 채팅에는 "Choose a Selfie Provider to let characters generate selfie images."라고 표시됩니다.

작동하지 않는 경우: **Illustrator Settings**는 Illustrator가 설치되어 있을 때만 표시됩니다. 셀카에는 **Selfies** 명령도 켜져 있어야 합니다([캐릭터가 쓸 수 있는 Commands 고르기](getting-started.md#choose-which-commands-a-character-can-use) 참고).

## 셀카 설정

이 설정은 모두 **Illustrator Settings**에 있으며 현재 채팅에만 적용됩니다.

- **Selfie model**: 그림을 그리는 이미지 계정입니다. 기본값은 **None (selfies disabled)**(없음 (셀카 비활성화))입니다.
- **Prompt Model**(프롬프트 모델): 그림 설명을 쓰는 텍스트 모델입니다. 기본값은 **Agent default**입니다.
- **Image Style**(이미지 스타일): "anime"처럼 그림체를 나타내는 단어를 모아 저장해 둔 것입니다. 기본값은 Advanced 설정의 스타일 프로필에 있는 기본 스타일입니다. [이미지 스타일 프로필](../media/style-profiles.md)을 참고하세요.
- **Images Per Generation**(생성당 이미지 수): 그림이나 셀카마다 몇 가지 변형을 만들지 정합니다.
- **Resolution**(해상도): 이미지 크기입니다. **Selfie model**을 정한 뒤에만 표시됩니다. 기본값은 896x1152입니다.
- **Send Avatar References**(아바타 참조 전송): 캐릭터의 아바타나 스프라이트를 참조 그림으로 보냅니다. 기본값은 꺼짐입니다. 이미지 서비스가 참조 그림을 받을 때만 작동합니다.
- **Attach Card Appearance**(카드 외형 첨부): 이름이 나오는 각 캐릭터의 카드 **Appearance**(모양) 텍스트를 프롬프트에 추가합니다. 기본값은 꺼짐입니다.

**Resolution** 옵션은 512x512, 512x768, 768x768, 768x1024, 896x1152, 1024x1024입니다. 896x1152는 대부분의 셀카에 잘 맞는 세로로 긴 사진입니다.

**Send Avatar References**와 **Attach Card Appearance**는 각각 **Off**(꺼짐), **Images only**(이미지만), **Videos only**(동영상만), **Images and videos**(이미지와 동영상) 중에서 고를 수 있습니다.

카드나 페르소나에서 **Image Appearance Override**(이미지 외모 재정의)가 켜져 있으면(편집기의 **Appearance** 아래) Marinara는 **Appearance** 대신 그 텍스트를 보냅니다. **Appearance**를 그림이 아니라 이야기용으로 쓴 경우에 활용하세요.

## 직접 셀카 요청하기

1. **Chat Settings**를 열고 **Gallery**(갤러리) 섹션을 펼치세요.
2. **Selfie**(셀카)를 클릭하세요. 캐릭터가 둘 이상이면 버튼 옆 목록에서 누가 찍을지 고르세요.
3. **Expose media prompts before sending**(전송 전에 미디어 프롬프트 표시)이 켜져 있으면(**Settings** → **Generations** → **Overall Generations**) 프롬프트를 검토하거나 고친 다음 **Generate**를 클릭하세요. 취소하면 요청이 전송되지 않습니다.
4. 버튼에 **Generating...**(생성 중...)이 표시되는 동안 기다리세요.

채팅에 "Selfie generated."(셀카 생성됨.)가 나타나고 그림이 표시됩니다. 직접 요청도 **Selfie model**을 쓰며 이미지 요청 1번이 듭니다.

## 캐릭터가 셀카를 보내는 방식

캐릭터는 언제 셀카를 보낼지 스스로 정합니다. 내가 입력할 것은 없습니다. Marinara가 그림을 만들어 올리고, 이후 응답은 그 그림이 무엇을 보여 주었는지 짧은 메모로 알 수 있습니다.

작동하지 않는 경우: 메시지에 `[selfie...]`라는 글자가 그대로 보이면 채팅이 Conversation Mode인지, **Commands**와 **Selfies**가 켜져 있는지, **Generated Selfies**가 켜져 있고 **Selfie model**이 정해져 있는지 확인하세요. 생성이 시작된 뒤 실패한다면 이미지 계정의 오류를 확인하세요.

## 셀카 다시 만들기

1. 채팅에서 셀카를 클릭해 여세요.
2. **Regenerate image**(이미지 재생성)를 클릭하세요(핀 버튼 옆의 둥근 화살표입니다).
3. 원한다면 프롬프트를 고치세요. **Character prompts**(캐릭터 프롬프트)도 포함됩니다. **Image model**(이미지 연결)을 고르거나, **Chat's image provider**(채팅의 이미지 연결)를 그대로 두세요.
4. **Generate image**(이미지 생성)를 클릭하세요.

새 그림이 메시지의 기존 그림을 대신합니다. 기존 그림은 갤러리에 남습니다. 시도할 때마다 이미지 요청 1번이 듭니다. 이 옵션이 생기기 전에 만든 그림은 채팅의 셀카 계정을 쓰며, 그 그림의 네거티브 프롬프트와 캐릭터 프롬프트는 저장되지 않았습니다.

<a id="video-messages"></a>

## 동영상 메시지

캐릭터는 짧은 동영상 클립을 보낼 수 있습니다. 먼저 Illustrator를 설치하세요. 셀카는 꺼 두어도 됩니다.

직접 요청하려면 `/video`를 입력하거나, `/video Aster`처럼 입력해 캐릭터를 고르세요. 아니면 채팅 **Gallery**의 **Video**(비디오)를 클릭하세요. 이 버튼은 그곳에서 고른 캐릭터를 씁니다. 클립은 새 메시지로 도착해 채팅에서 재생됩니다. 클립에는 대화의 최신 내용이 반영됩니다. 클립을 쓰는 모델은 Illustrator가 그림을 만들 때와 같은 수만큼 최근 메시지를 읽습니다(**Agent Budget**(에이전트 예산)). 갤러리의 그림을 움직이게 만들 수도 있습니다. 클립은 그 그림에서 이어지며 가장 새로운 응답에 붙습니다.

클립을 채팅에 추가할 수 없으면 갤러리의 **Videos**(동영상) 탭에는 여전히 저장됩니다. 캐릭터 자신의 갤러리에는 클립에 그 캐릭터가 나올 때만 동영상이 표시됩니다([캐릭터와 페르소나 갤러리](../characters/galleries.md) 참고).

### 동영상 설정

**Chat Settings** → **Agents** → **Illustrator Settings**의 **Video messages**(동영상 메시지)를 여세요.

- **Generated Videos**(생성된 동영상): 캐릭터가 스스로 동영상 메시지를 보내게 합니다. 클립 하나가 동영상 요청 1번이므로 새 채팅에서는 기본값이 꺼짐입니다. **Commands** 목록에서는 **Videos**로도 표시됩니다.
- **Video Run Interval**(동영상 실행 간격): **Generated Videos**를 켠 뒤에 표시됩니다. 클립 사이에 메시지가 몇 개 지나가야 하는지 정합니다. **0**이면 멈춥니다.
- **Video model**(비디오 연결): 동영상 계정입니다. **Default video provider**(기본 동영상 연결)는 내 기본값을 씁니다.
- **First frame**(첫 프레임): 클립이 시작되는 그림입니다(아래 참고).

`/video`와 Gallery의 **Video** 버튼은 어느 쪽이든 작동하며 간격을 무시합니다. 클립을 보낸 응답을 스와이프하면 새 스와이프가 자기 클립을 보낼 수 있습니다. 그룹 채팅에서는 캐릭터마다 응답 하나에 클립 하나를 보낼 수 있고, **Settings** → **Generations** → **Video Generation**(동영상 생성)의 **Videos per reply**(응답당 동영상 수)(기본값 3)까지입니다.

**First frame** 옵션은 다음과 같습니다.

- **New selfie, or the avatar if no selfie provider**(새 셀카, 셀카 연결이 없으면 아바타)(기본값): 셀카를 켜고 **Selfie model**을 정했으면 새 셀카, 아니면 아바타.
- **New selfie, then animate it**(새 셀카를 만든 뒤 움직이기): 항상 새 셀카를 만들고, 갤러리에도 저장합니다. 셀카를 켜고 **Selfie model**을 정해야 합니다.
- **Avatar or sprite**(아바타 또는 스프라이트): 아바타, 아바타가 없으면 전신 스프라이트.
- **Prompt only (no picture)**(프롬프트만(그림 없음)): 그림이 없습니다. 일부 ComfyUI 워크플로는 그림 없이는 실패합니다. **Send Avatar References**에 동영상이 포함되어 있으면 이 옵션은 **Prompt only**(아바타 참조에서 가져옴)를 읽고 아바타에서 시작합니다.

**Expose media prompts before sending**을 켜면 클립 프롬프트와 함께 셀카 프롬프트도 검토합니다.

WebP 같은 다른 형식의 그림은 동영상 서비스용으로 변환됩니다. 동영상 메시지 하나는 동영상 요청 1번이며, 새 셀카에서 시작하면 이미지 요청 1번이 더 듭니다. **Prompt Model**이 동영상 프롬프트를 쓰고, **Settings** → **Generations** → **Video Generation Prompt Overrides**(동영상 생성 프롬프트 재정의)의 **Conversation Video Message**에 그 지침이 들어 있습니다.

## 참고: 셀카 태그

캐릭터는 응답에 태그를 넣어 셀카를 요청합니다. 직접 입력할 필요는 없습니다. 모양은 `[selfie]`이며, 원한다면 상황 설명을 덧붙입니다.

```text
[selfie: context="standing beside the river at sunset"]
```

`[selfie: "standing beside the river"]`와 `[selfie: standing beside the river]`도 사용할 수 있으며, 대소문자는 구분하지 않습니다. Marinara는 태그를 지우고 그림을 올립니다.

## 관련 가이드

- [Conversation Mode: 시작하기](getting-started.md)
- [이미지 생성 제공자와 설정](../media/image-providers.md)
- [이미지 스타일 프로필](../media/style-profiles.md)
