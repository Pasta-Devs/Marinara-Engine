# 이미지와 동영상을 위한 Prompt Overrides

이 가이드에서는 Prompt Overrides(프롬프트 재정의)를 설명합니다. Prompt Overrides는 Marinara가 이미지 모델과 동영상 모델에 보낼 프롬프트를 쓸 때 사용하는 템플릿의 편집기입니다. 초상화, 셀카, 스프라이트, 장면 그림, 스토리보드, 동영상 클립을 모델에 어떻게 설명할지 바꾸려면 이 편집기를 쓰세요.

Prompt Overrides는 채팅 모델에 보내는 프롬프트를 바꾸지 않습니다. 채팅 모델의 프롬프트를 바꾸려면 프리셋을 쓰세요. [Preset Editor와 프롬프트 관리](presets.md)와 [생성 파라미터](generation-parameters.md)를 참고하세요.

스프라이트는 표정이나 포즈 같은 캐릭터 그림 조각입니다. 스토리보드는 Game Mode(게임 모드)의 한 턴이나 완결된 Roleplay(롤플레이) 에피소드에서 만든 삽화 프레임 묶음입니다.

시작하기 전에: Prompt Overrides는 이미지나 동영상을 생성하는 기능에서만 의미가 있으며, 그런 기능을 쓰려면 먼저 이미지 생성 또는 동영상 생성 계정이 있어야 합니다. 계정이 없으면 템플릿은 쓰이지 않습니다. [이미지 생성 제공자와 설정](../media/image-providers.md)과 [장면 동영상 생성](../media/scene-video.md)을 참고하세요.

## 편집기 찾기

1. **Settings**(설정)를 여세요.
2. **Generations**(생성) 탭을 클릭하세요.
3. "Reusable image and video prompt templates"라는 설명이 붙은 **Prompt Overrides**까지 스크롤하세요.

그곳에 편집기가 2개 있습니다. 제목을 클릭하면 펼쳐집니다.

| 편집기 | 다루는 템플릿 |
| --- | --- |
| **Video Generation Prompt Overrides**(동영상 생성 프롬프트 재정의) | Game과 Gallery(갤러리)의 장면 동영상, Conversation(대화) 동영상 메시지, Conversation의 Call(통화) 캐릭터 클립, 움직이는 Expression(표정) 초상화. |
| **Image Generation Prompt Overrides**(이미지 생성 프롬프트 재정의) | Conversation의 셀카, Game의 NPC 초상화, 장면 그림, 스토리보드 프롬프트, **Noodle Post Image** 템플릿, 그 밖의 이미지 빌더. |

## 템플릿 고치기

1. 편집기 하나를 펼치세요.
2. **Registered prompt**(등록된 프롬프트)에서 템플릿을 고르세요. 목록은 편집기에 따라 다릅니다.
3. 옆의 상태 표시를 확인하고, 드롭다운 아래의 짧은 설명을 읽으세요.
4. **Available variables**(사용 가능한 변수) 아래의 변수 칩을 클릭하면 템플릿에 삽입됩니다. 변수는 `${charName}`처럼 생겼습니다.
5. **Template**(템플릿) 상자의 글을 고치세요.
6. **Rendered preview**(미리보기)를 확인하세요. 템플릿에 예시 값을 채워 넣은 결과를 보여 줍니다.
7. **Unknown variables**(알 수 없는 변수) 경고가 있으면 고치세요. **Available variables** 목록에 없는 이름은 값이 채워지지 않습니다.
8. **Save**(저장)를 클릭하세요.

"Prompt override saved" 메시지가 뜨고, 상태 표시가 **Custom active**로 바뀝니다.

| 상태 표시 | 의미 |
| --- | --- |
| **Default** | 저장된 사용자 지정 템플릿이 없습니다. |
| **Custom active** | 저장한 템플릿이 쓰이고 있습니다. |
| **Custom paused** | 템플릿은 저장되어 있지만 꺼져 있습니다. |

## 저장만 해 두고 쓰지 않기

미리보기 아래의 **Apply this override**(이 설정 적용)를 끄세요. 도움말에는 "Turn this off to keep the template saved without using it."이라고 적혀 있습니다. Marinara는 계속 내장 템플릿을 쓰고, 상태 표시는 **Custom paused**가 됩니다.

## 내장 템플릿으로 되돌리기

**Reset to Default**(기본값으로 초기화)를 클릭하세요. 재정의가 저장되어 있으면 Marinara가 확인을 요청합니다. 상태 표시는 **Default**로 돌아갑니다.

## 관련 가이드

- [이미지 생성 제공자와 설정](../media/image-providers.md)
- [장면 동영상 생성](../media/scene-video.md)
- [이미지 스타일 프로필](../media/style-profiles.md)
- [Noodle 설정과 채팅 반영](../agents/noodle-settings.md)
- [Preset Editor와 프롬프트 관리](presets.md)
- [생성 파라미터](generation-parameters.md)
