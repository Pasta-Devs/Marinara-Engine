# 셀카

이 가이드에서는 Conversation 모드(대화 모드)의 셀카를 설명합니다. 셀카는 캐릭터가 자기 모습을 이미지로 만들어 채팅에 보내는 기능입니다. 메신저 앱에서 사진을 주고받는 것과 비슷합니다. 셀카를 켜는 방법, 설정하는 방법, 직접 요청하는 방법을 차례대로 다룹니다.

## 셀카란

셀카는 Conversation 모드의 기능입니다. 평범한 채팅 도중에 캐릭터가 자기 모습을 그린 이미지를 보낼 수 있습니다. Roleplay 모드와 Game Mode에서 쓰는 장면 이미지와는 다릅니다. 셀카는 Conversation 모드 특유의 메신저 앱 같은 분위기에 맞춰 만든 기능입니다.

셀카는 이미지 생성을 사용합니다. 캐릭터가 셀카를 한 장 보낼 때마다 선택한 연결에서 이미지 생성 요청을 한 번 쓰게 됩니다. 그래서 셀카는 설정을 마치기 전까지 꺼져 있습니다.

셀카 기능은 선택 설치 패키지인 **Illustrator**가 제공합니다. 설정에 들어가기 전에 **Agents → Download Agents**(에이전트 → 에이전트 다운로드)에서 Illustrator를 먼저 설치하세요.

## 셀카 켜기

셀카 설정은 Conversation 채팅의 **Agents**(에이전트) 영역 안 **Illustrator Settings**(Illustrator 설정)에 있습니다. **Commands**(명령어)는 캐릭터가 스스로 할 수 있는 숨은 동작을 뜻합니다. 셀카를 보내거나 노래를 트는 것 같은 동작입니다. 이 동작을 제공하는 패키지를 설치하면 **Agents** 안에 관련 컨트롤이 나타납니다.

셀카를 켜는 방법은 다음과 같습니다.

1. Conversation 채팅을 여세요.
2. **Chat Settings**(채팅 설정)를 여세요. 슬라이더 모양 아이콘입니다.
3. **Agents** 영역을 찾으세요.
4. 그 안의 **Commands** 마스터 토글을 켜세요. 이 토글이 꺼져 있으면 캐릭터는 어떤 숨은 동작도 쓸 수 없습니다.
5. **Illustrator Settings**를 찾으세요.
6. **Generated Selfies**(생성된 셀카) 스위치를 켜세요.

**Generated Selfies**를 켜면 스위치 아래에 셀카 설정이 나타납니다. 연결, 프롬프트 모델, 스타일, 참조 이미지 항목이 보입니다. **Resolution**(해상도) 버튼은 **Selfie Connection**(셀카 연결)을 고른 뒤에만 나타납니다.

## 셀카 설정

셀카를 켰다면 이제 어떤 모습으로 만들지, 어떤 서비스가 그릴지 정합니다. 아래 설정은 모두 **Chat Settings → Agents**의 **Illustrator Settings** 안에 있으며, 현재 채팅에만 적용됩니다.

### Selfie Connection

**Selfie Connection**은 이미지를 그릴 이미지 생성 서비스를 고르는 항목입니다. 기본값은 **None (selfies disabled)**로, 아직 아무 서비스도 고르지 않은 상태입니다. 여기에서 미리 설정해 둔 이미지 연결 중 하나를 고르세요.

**Selfie Connection**을 고르기 전까지 캐릭터는 셀카를 보낼 수 없습니다. "Choose a Selfie Connection to let characters generate selfie images"라는 안내가 보인다면 연결이 아직 비어 있다는 뜻입니다.

이미지 연결을 추가하는 방법은 [이미지 생성 제공자와 설정](../media/image-providers.md)에서 확인하세요.

### Prompt Model

**Prompt Model**(프롬프트 모델)은 셀카의 설명문을 쓸 텍스트 모델을 고르는 항목입니다. 이미지 연결은 그 설명문을 보고 그림을 그립니다. 기본값은 **Main chat model**로, 채팅에서 이미 쓰고 있는 모델을 그대로 사용합니다. 다른 모델에 설명문을 맡기고 싶다면 별도의 텍스트 연결을 고르면 됩니다.

### Image Style

**Image Style**(이미지 스타일)은 셀카에 쓸 스타일 프로필을 고르는 항목입니다. 스타일 프로필은 "anime"나 "realistic photo"처럼 그림체를 나타내는 단어를 모아 저장해 둔 것입니다. 기본값은 **Use default style from Style Profiles in Advanced settings**로, 전역 기본 스타일을 따릅니다.

스타일에 대해 더 알아보려면 [이미지 스타일 프로필](../media/style-profiles.md)을 참고하세요.

### Send Avatar References

**Send Avatar References**(아바타 참조 전송)는 기본으로 꺼져 있는 토글입니다. 켜면 Marinara가 캐릭터의 아바타나 스프라이트를 참조 이미지로 이미지 서비스에 함께 보냅니다. 셀카가 캐릭터와 더 닮게 나오는 데 도움이 됩니다. 이미지 제공자가 참조 이미지를 지원할 때만 동작합니다.

### Attach Card Appearance

**Attach Card Appearance**(카드 외형 첨부)는 기본으로 꺼져 있는 토글입니다. 켜면 Marinara가 캐릭터 카드의 외모 설명을 셀카 설명문에 덧붙입니다. 캐릭터가 어떻게 생겼는지를 모델에 더 자세히 알려 줄 수 있습니다.

### Resolution

**Resolution**은 셀카 이미지의 크기를 정합니다. **Resolution** 버튼은 **Selfie Connection**을 고른 뒤에만 나타납니다. 준비된 버튼 중 하나를 고르세요. 기본값은 **896x1152**이며, 세로로 긴 형태라 대부분의 셀카에 잘 맞습니다.

고를 수 있는 크기는 다음과 같습니다.

| 해상도 | 형태 |
| ---------- | ------------------ |
| 512x512    | 정사각형             |
| 512x768    | 세로형               |
| 768x768    | 정사각형             |
| 768x1024   | 세로형               |
| 896x1152   | 세로형(기본값)        |
| 1024x1024  | 정사각형             |

## 캐릭터가 셀카를 보내는 방식

설정을 마치면 캐릭터가 채팅 도중 스스로 셀카를 보낼지 판단합니다. 따로 명령을 입력할 필요는 없습니다. 캐릭터가 순간을 고르면 Marinara가 이미지를 만들어 채팅에 올립니다.

모델의 응답은 `[selfie]`를 사용하며, 필요한 경우 맥락을 덧붙입니다:

```text
Here is a picture from my walk!
[selfie: context="standing beside the river at sunset"]
```

`[selfie: "standing beside the river"]`와 `[selfie: standing beside the river]`도 사용할 수 있습니다. 대소문자를 구분하지 않으므로 `[SELFIE:xxxxx.]`도 올바른 구문입니다. 이 명령어는 Conversation용이며 Roleplay나 Game Mode의 이미지 생성 트리거가 아닙니다. 메시지에 마커가 그대로 남아 있다면 다른 모드의 채팅이거나 **Commands**가 꺼져 있을 수 있습니다. Illustrator가 설치되어 있고 **Generated Selfies**가 켜져 있으며 **Selfie Connection**이 선택되어 있는지 확인하세요. 생성이 시작된 뒤 실패한다면 표시된 연결 또는 이미지 제공자 오류를 확인하세요. 마커의 대소문자를 바꿔도 해결되지 않습니다.

## 직접 셀카 요청하기

캐릭터가 보낼 때까지 기다리지 않고 직접 셀카를 요청할 수도 있습니다.

1. **Chat Settings**(채팅 설정)를 열고 **Gallery**(갤러리) 섹션을 펼치세요.
2. **Selfie**(셀카) 버튼을 클릭하세요. 카메라 모양 아이콘입니다.
3. 채팅에 캐릭터가 둘 이상이라면 버튼 옆 캐릭터 목록에서 셀카를 찍을 캐릭터를 고르세요.
4. **Settings**(설정), **Generations**(생성), **Image Generation**(이미지 생성)의 **Expose media prompts before sending**(전송 전에 미디어 프롬프트 표시)이 켜져 있다면, 최종 완성된 셀카 프롬프트를 확인하거나 고친 뒤 **Generate**(생성)를 클릭하세요. 확인 단계에서 취소하면 이미지 생성 요청을 보내지 않습니다.
5. 버튼에 **Generating...**이 표시되는 동안 기다리세요.

셀카가 완성되면 "Selfie generated."라는 메시지가 뜨고 이미지가 채팅에 나타납니다. 직접 요청한 셀카도 지정한 **Selfie Connection**을 쓰기 때문에 이미지 생성 요청을 한 번 소비합니다.

## 관련 가이드

- [Conversation Mode: 시작하기](getting-started.md)
- [이미지 생성 제공자와 설정](../media/image-providers.md)
- [이미지 스타일 프로필](../media/style-profiles.md)
