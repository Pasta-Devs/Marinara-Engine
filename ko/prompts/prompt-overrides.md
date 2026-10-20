# 이미지와 동영상을 위한 Prompt Overrides

이 가이드에서는 **Prompt Overrides**(프롬프트 재정의)를 설명합니다. Marinara Engine이 이미지 생성과 동영상 생성에 쓸 프롬프트를 만들 때 사용하는 템플릿을 고치는 편집기입니다. 어디에 있는지, 무엇을 고칠 수 있는지, 사용자 지정 템플릿을 안전하게 저장하는 방법까지 다룹니다.

## Prompt Overrides란

**Prompt Override**는 미디어 프롬프트를 위한 재사용 템플릿입니다. Marinara는 이미지나 동영상을 만들 때 먼저 이미지 모델이나 동영상 모델에 보낼 텍스트 프롬프트를 조립합니다. Prompt Overrides는 그 템플릿을 직접 고치는 기능입니다.

이 기능은 그림과 동영상 프롬프트에만 관여합니다. Conversation(대화)이나 Roleplay(롤플레이)를 진행하는 동안 채팅 모델에 보내는 텍스트 프롬프트는 바뀌지 않습니다. 흔히 헷갈리는 부분입니다. 채팅 모델로 가는 프롬프트를 고치려면 프롬프트 프리셋과 생성 파라미터를 쓰세요. [Preset Editor와 프롬프트 관리](presets.md)와 [생성 파라미터](generation-parameters.md)를 참고하세요.

아래에서 쓰는 용어를 먼저 정리합니다.

- **스프라이트**는 표정이나 전신 포즈 같은 캐릭터 그림 조각입니다.
- **스토리보드**는 Game Mode(게임 모드)의 한 턴이나 완결된 Roleplay 에피소드에서 만들어 낸 삽화 프레임 묶음입니다.

## 위치

편집기는 앱 설정 안에 있습니다.

1. **Settings**(설정)를 여세요.
2. **Generations**(생성) 탭을 클릭하세요.
3. **Prompt Overrides** 영역까지 스크롤하세요. "Reusable image and video prompt templates."라는 설명이 붙어 있습니다.

그 자리에 접었다 펼 수 있는 편집기가 두 개 보입니다.

## 편집기 두 가지

편집기 제목을 클릭하면 펼쳐집니다.

**Video Generation Prompt Overrides**(동영상 생성 프롬프트 재정의)에서는 Game과 Gallery(갤러리)의 장면 동영상, Conversation 동영상 메시지, Conversation의 Call(통화) 캐릭터 클립, 움직이는 Expression(표정) 초상화에 쓰이는 재사용 템플릿을 고칩니다. 동영상 프롬프트 템플릿 하나가 클립 한 종류를 동영상 모델에 어떻게 설명할지 정합니다.

**Image Generation Prompt Overrides**(이미지 생성 프롬프트 재정의)에서는 이미지, 스프라이트, Game, 프롬프트 빌더 계열이 사용하는 템플릿을 고칩니다. Conversation의 셀카, Game의 NPC 초상화, 장면 그림, 스토리보드 프롬프트, Noodle 게시물에 쓰이는 **Noodle Post Image** 템플릿, 그 밖에 등록된 이미지 빌더가 여기에 해당합니다. 이미지 프롬프트 템플릿 하나가 그림 한 종류를 이미지 모델에 어떻게 설명할지 정합니다.

즉, 이 두 편집기로 초상화, 셀카, 스프라이트, 장면 그림, 스토리보드, 동영상 클립의 프롬프트를 모두 조정할 수 있습니다.

## 템플릿 고치기

두 편집기의 사용법은 같습니다. 다음 순서대로 진행하세요.

1. 원하는 편집기를 펼치세요.
2. **Registered prompt**(등록된 프롬프트) 드롭다운에서 템플릿을 고르세요. 목록은 어느 편집기를 펼쳤는지에 따라 달라집니다.
3. 드롭다운 옆의 상태 표시를 확인하세요. 저장된 사용자 지정 템플릿이 없으면 **Default**입니다. 저장한 템플릿이 실제로 쓰이고 있으면 **Custom active**, 저장은 되어 있지만 꺼져 있으면 **Custom paused**입니다.
4. 드롭다운 아래의 짧은 설명을 읽고 그 템플릿이 어떤 일을 하는지 파악하세요.
5. **Available variables**(사용 가능한 변수) 아래의 변수 칩을 클릭하면 템플릿에 삽입됩니다. 변수는 `${charName}`처럼 `${name}` 형태입니다.
6. **Template**(템플릿) 상자의 글을 고치세요.
7. 그 아래 **Rendered preview**(미리보기) 상자를 확인하세요. 미리보기는 템플릿에 예시 값을 채워 넣어 결과를 보여 줍니다.
8. 미리보기에 **Unknown variables** 경고가 뜨면 철자가 틀린 변수를 고치세요. **Available variables** 목록에 없는 이름은 값이 채워지지 않습니다.
9. **Save**(저장)를 클릭하세요.

"Prompt override saved" 메시지가 뜨고 상태 표시가 **Custom active**로 바뀝니다.

## 저장만 해 두고 쓰지 않기

미리보기 아래에는 **Apply this override**(이 설정 적용) 토글이 있습니다. 도움말에는 "Turn this off to keep the template saved without using it."이라고 적혀 있습니다. 이 토글을 끄면 작성 중인 초안은 그대로 보관되고, 해당 기능은 계속 내장 기본 템플릿을 씁니다. 이때 상태 표시는 **Custom paused**가 됩니다.

## 내장 템플릿으로 되돌리기

**Reset to Default**(기본값으로 초기화)를 클릭하면 사용자 지정 템플릿을 버리고 다시 내장 템플릿을 씁니다. 저장된 재정의가 있으면 앱이 먼저 확인을 요청합니다. 상태 표시는 **Default**로 돌아갑니다.

## 재정의가 적용되는 시점

Prompt Override는 실제로 이미지나 동영상을 만드는 기능에서만 의미가 있습니다. Game의 에셋, Conversation의 셀카와 통화, 스프라이트, Noodle 게시물 이미지가 그런 기능입니다. 이런 기능을 쓰려면 이미지 생성이나 동영상 생성 연결이 먼저 설정되어 있어야 합니다. 동작하는 생성 연결이 없으면 아무것도 실행되지 않고 템플릿도 쓰이지 않습니다. [이미지 생성 제공자와 설정](../media/image-providers.md)과 [장면 동영상 생성](../media/scene-video.md)을 참고하세요.

## 관련 가이드

- [이미지 생성 제공자와 설정](../media/image-providers.md)
- [장면 동영상 생성](../media/scene-video.md)
- [이미지 스타일 프로필](../media/style-profiles.md)
- [Noodle 설정과 채팅 반영](../noodle/settings.md)
- [Preset Editor와 프롬프트 관리](presets.md)
- [생성 파라미터](generation-parameters.md)
