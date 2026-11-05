# 애니메이션 표정

애니메이션 표정은 캐릭터의 초상화 스프라이트로 쓰이는 짧은 반복 애니메이션입니다. 스프라이트는 채팅 중에 Marinara가 보여 주는 서 있는 캐릭터 그림입니다. 보통의 표정 스프라이트는 웃는 얼굴 같은 정지 이미지입니다. 애니메이션 표정은 그 자리에서 재생되며 GIF로 저장됩니다. GIF는 짧은 애니메이션을 스스로 반복 재생하는 이미지 파일입니다.

Marinara는 애니메이션 표정을 두 단계로 만듭니다. **Video Generation**(동영상 생성) 계정에 그 표정을 담은 짧은 클립을 요청한 다음, 내 컴퓨터에서 그 클립을 반복 재생되는 GIF로 변환합니다. 저장한 뒤에는 다른 스프라이트와 똑같이 작동합니다. 다운로드해서 쓰는 **Expression Engine** 에이전트가 장면에 그 감정이 필요할 때 애니메이션 표정을 표시합니다. [캐릭터 스프라이트](../characters/sprites.md)와 [다운로드 가능한 에이전트 레퍼런스](../agents/built-in-agents.md)를 참고하세요.

<a id="before-you-start"></a>

## 시작하기 전에

두 가지가 필요합니다.

1. 동영상 계정. 추가 방법은 [장면 동영상 생성](scene-video.md)을 참고하세요.
2. Marinara를 실행하는 컴퓨터의 ffmpeg. ffmpeg은 클립을 GIF로 변환하는 무료 미디어 도구입니다.

ffmpeg이 없으면 생성이 곧바로 실패하고 다음 메시지가 표시됩니다.

```text
Animated expression GIF conversion requires ffmpeg. Install ffmpeg and make it available on PATH, or set FFMPEG_PATH.
```

시스템이 찾을 수 있도록 ffmpeg을 설치하거나, `FFMPEG_PATH` 환경 변수에 ffmpeg 프로그램의 전체 경로를 지정하세요. 환경 변수는 서버가 시작되기 전에 넘겨 주는 설정입니다.

## 애니메이션 표정 생성하기

정지 스프라이트를 만들 때와 같은 창을 사용합니다.

1. 캐릭터는 **Character Editor**(캐릭터 편집기)를, 페르소나는 **Persona Editor**(페르소나 편집기)를 여세요.
2. **Sprites**(스프라이트) 탭을 열고 **Facial Expressions**(표정) 카테고리를 여세요.
3. **Generate Sprite**(스프라이트 생성)를 클릭하세요. **Generate Sprites**(스프라이트 생성) 창이 열립니다.
4. **Generate animated portraits**(애니메이션 초상화 생성)를 체크하세요. 창이 애니메이션 모드로 바뀝니다. 이미지 선택기가 동영상 선택기로 바뀌고, 스프라이트 시트용 격자 컨트롤이 사라지며, Marinara가 표정을 하나씩 만듭니다.
5. 동영상 계정을 고르세요.
6. 서비스가 캐릭터의 생김새를 알 수 있도록 **Appearance Description**(외형 설명)을 채우세요.
7. 생성할 표정을 고르세요.
8. 표정이 하나면 **Generate Animated Portrait**(애니메이션 초상화 생성)를, 여러 개면 **Generate Animated Portraits**(애니메이션 초상화 생성)를 클릭하세요.

생성하는 동안 "Generating animated portrait GIFs..."가 표시됩니다. 끝나면 결과를 확인하고 저장 버튼을 클릭해 캐릭터나 페르소나에 추가하세요. 표정 하나가 실패해도 Marinara는 완성된 표정을 남겨 두고 실패한 표정의 이름을 보여 주므로, 그 표정만 다시 시도할 수 있습니다.

애니메이션 표정은 하나씩 만들어지므로 정지 스프라이트보다 오래 걸립니다. 처음에는 몇 개만 만들어 보세요.

**Expose media prompts before sending**(전송 전에 미디어 프롬프트 표시)이 켜져 있으면(**Settings → Generations → Overall Generations**(설정 → 생성 → 전체 생성)) Marinara가 잠시 멈추므로, 각 프롬프트가 서비스로 가기 전에 읽고 고칠 수 있습니다.

## 길이와 형태

모든 애니메이션 표정은 9:16 비율의 세로로 긴 초상화 클립이며, 이 비율은 바꿀 수 없습니다. 클립 하나의 재생 길이를 바꾸려면 **Settings → Generations**(설정 → 생성)를 열고 **Video Generation**을 찾아 **Animated expression length**(애니메이션 표정 길이)를 설정하세요. 기본값은 3초입니다. 범위는 1초에서 8초입니다. Marinara는 가로 512픽셀의 작은 반복 GIF를 저장합니다. 클립이 짧을수록 파일이 작아지고 반복이 촘촘해집니다.

<a id="backgrounds-are-not-removed"></a>

## 배경은 제거되지 않음

정지 스프라이트는 배경을 지워 캐릭터가 장면 위에 떠 있는 것처럼 만들 수 있습니다. 애니메이션 표정은 이 정리 작업을 건너뜁니다. 애니메이션 모드에서 **Prefer clean transparent-style background**(깔끔한 투명 스타일 배경 선호) 체크박스는 동영상 프롬프트에 힌트를 덧붙일 뿐입니다. 도움말에도 "GIF transparency is not guaranteed."라고 적혀 있습니다. 확인 단계에서도 GIF 출력에는 배경 정리, 시트 나누기, 프레임 자르기를 건너뛴다고 알려 줍니다. 애니메이션 표정에는 배경이 보이는 채로 남을 수 있습니다. 더 깔끔하게 보이려면 **Appearance Description**에 단색 배경을 요청하세요.

## 문제 해결

- **ffmpeg 관련 메시지와 함께 생성이 실패하는 경우**: ffmpeg을 설치하거나 `FFMPEG_PATH`를 지정하세요. [시작하기 전에](#before-you-start)를 참고하세요.
- **선택기에 동영상 계정이 없다고 표시되는 경우**: 먼저 계정을 추가하세요. [장면 동영상 생성](scene-video.md)을 참고하세요.
- **Generate Sprite 버튼이 비활성화된 경우**: 일부 Android나 Termux 설치처럼 일부 기기에서는 Marinara가 이미지 라이브러리를 불러오지 못합니다. 그러면 애니메이션 표정을 포함한 모든 스프라이트 생성이 꺼집니다.
- **저장된 GIF에 배경이 그대로 보이는 경우**: 정상입니다. [배경은 제거되지 않음](#backgrounds-are-not-removed)을 참고하세요.

## 관련 가이드

- [캐릭터 스프라이트](../characters/sprites.md)
- [장면 동영상 생성](scene-video.md)
- [다운로드 가능한 에이전트 레퍼런스](../agents/built-in-agents.md)
