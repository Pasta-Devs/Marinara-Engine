# 애니메이션 표정

이 가이드에서는 Marinara Engine의 애니메이션 표정을 설명합니다. 애니메이션 표정은 캐릭터의 초상화 스프라이트로 쓰이는 짧은 반복 재생 애니메이션입니다. 스프라이트는 채팅 중에 Marinara가 캐릭터 자리에 보여 주는 서 있는 모습의 그림입니다. 애니메이션 표정을 쓰면 이 초상화가 가만히 멈춰 있지 않고 움직입니다.

## 애니메이션 표정이란

보통의 표정 스프라이트는 웃는 얼굴이나 화난 얼굴 같은 정지 이미지입니다. 애니메이션 표정은 그 정지 이미지 대신 재생되는 짧은 반복 애니메이션입니다. Marinara는 이것을 GIF 스프라이트로 저장합니다. GIF는 짧은 애니메이션을 스스로 반복 재생하는 이미지 파일 형식입니다.

Marinara는 애니메이션 표정을 두 단계로 만듭니다. 먼저 **Video Generation**(동영상 생성) 연결에 그 표정을 담은 짧은 동영상 클립을 요청합니다. 그다음 그 클립을 Marinara가 실행 중인 컴퓨터에서 반복 재생되는 GIF 스프라이트로 변환합니다.

저장이 끝난 애니메이션 표정은 다른 스프라이트와 똑같이 동작합니다. 다운로드해서 쓰는 **Expression Engine** 에이전트가 장면에 맞는 감정을 골라 화면에 띄웁니다. 스프라이트가 어떻게 표시되는지는 [캐릭터 스프라이트](../characters/sprites.md)를, Expression Engine에 대해서는 [다운로드 가능한 에이전트 레퍼런스](../agents/built-in-agents.md)를 참고하세요.

## 시작하기 전에

애니메이션 표정을 생성하려면 먼저 두 가지를 준비해야 합니다.

1. **Video Generation** 연결. 동영상을 만들 수 있는 제공자의 접속 정보를 저장해 둔 것입니다. 추가 방법은 [장면 동영상 생성](scene-video.md)에서 설명합니다.
2. Marinara가 실행 중인 컴퓨터에 설치된 ffmpeg. ffmpeg은 동영상 클립을 GIF 스프라이트로 변환하는 무료 미디어 도구입니다.

ffmpeg을 찾지 못하면 생성이 곧바로 실패하고 다음 메시지가 나옵니다.

```
Animated expression GIF conversion requires ffmpeg. Install ffmpeg and make it available on PATH, or set FFMPEG_PATH.
```

이때는 ffmpeg을 설치하고 시스템이 그 위치를 찾을 수 있게 하세요. `FFMPEG_PATH` 환경 변수에 ffmpeg 실행 파일의 전체 경로를 지정하는 방법도 있습니다. 환경 변수는 서버가 시작되기 전에 미리 넘겨 두는 설정값입니다.

## 애니메이션 초상화 켜기

애니메이션 표정은 정지 스프라이트를 만들 때와 같은 창에서 생성합니다.

1. 캐릭터는 **Character Editor**(캐릭터 편집기)를, 페르소나는 **Persona Editor**(페르소나 편집기)를 여세요.
2. **Sprites**(스프라이트) 탭으로 이동한 다음 **Facial Expressions**(표정) 카테고리를 여세요.
3. **Generate Sprite**(스프라이트 생성)를 클릭하세요. **Generate Sprites** 창이 열립니다.
4. **Generate animated portraits**(애니메이션 초상화 생성) 체크박스를 켜세요. 창이 애니메이션 모드로 바뀝니다.
   - 연결 선택 항목이 **Image Generation Connection**(이미지 생성 연결)에서 **Video Generation Connection**(비디오 생성 연결)으로 바뀝니다.
   - 정지 스프라이트 시트용 격자 설정이 사라집니다.
   - Marinara가 시트 전체가 아니라 표정을 하나씩 생성합니다.
5. 드롭다운에서 **Video Generation Connection**을 고르세요.
6. 제공자가 캐릭터의 생김새를 알 수 있도록 **Appearance Description**(외모 설명)을 채우세요.
7. 생성할 표정을 고르세요.
8. 표정이 하나면 **Generate Animated Portrait**를, 여러 개면 **Generate Animated Portraits**를 클릭하세요.

생성이 진행되는 동안 "Generating animated portrait GIFs..." 메시지가 표시됩니다. 각 표정은 먼저 짧은 동영상이 되고, 그다음 Marinara가 GIF 스프라이트로 변환합니다.

생성이 끝나면 결과를 확인하고 저장 버튼을 클릭해서 캐릭터나 페르소나에 추가하세요. 표정 하나가 실패해도 Marinara는 완성된 것들을 그대로 남겨 둡니다. 실패한 표정의 이름을 목록으로 보여 주므로 그것만 다시 시도할 수 있습니다.

## 길이와 화면 비율

애니메이션 표정은 모두 세로로 긴 초상화 클립입니다. 화면 비율은 9:16(세로)으로 고정되어 있고 바꿀 수 없습니다.

클립 하나의 재생 길이는 바꿀 수 있습니다. **Settings**(설정)를 열고 **Video Generation** 항목을 찾으세요. 설정 이름은 **Animated expression length**(애니메이션 표정 길이)입니다. 기본값은 3초이고, 1에서 8초까지 지정할 수 있습니다.

Marinara는 최종 결과물을 가로 512픽셀의 작은 반복 재생 GIF로 저장합니다. 클립이 짧을수록 파일이 작아지고 반복이 빠르고 촘촘해집니다.

## 투명 배경에 대한 주의

정지 스프라이트는 배경을 지워서 캐릭터가 장면 위에 떠 있는 것처럼 만들 수 있습니다. 애니메이션 표정은 다릅니다. Marinara는 애니메이션 표정에 배경 정리를 하지 않습니다.

애니메이션 모드에서 투명 배경 체크박스의 이름은 **Prefer clean transparent-style background**(깔끔한 투명 스타일 배경 선호)입니다. 이 체크박스는 동영상 프롬프트에 힌트를 한 줄 덧붙일 뿐입니다. 도움말에도 분명히 적혀 있습니다: "Adds a flat transparent-friendly background instruction to the video prompt. GIF transparency is not guaranteed."

확인 단계에서도 같은 내용을 알려 줍니다. 이런 안내문이 표시됩니다: "Animated portrait sprites are saved as looping GIFs. Static background cleanup, sheet slicing, and frame cropping are skipped for GIF output." 즉, 애니메이션 표정에는 배경이 그대로 남아 있을 수 있습니다. 배경을 깔끔하게 만들고 싶다면 **Appearance Description**에 단색 배경을 요청하는 문구를 넣으세요.

## 알아 둘 점

애니메이션 표정은 정지 스프라이트보다 시간이 오래 걸립니다. Marinara는 한꺼번에 처리하지 않고 표정을 하나씩 생성합니다. 한 번에 많은 표정을 고르면 꽤 오래 걸리므로 처음에는 몇 개만 골라 보세요.

**Expose media prompts before sending**(전송 전에 미디어 프롬프트 표시)을 켜 두었다면(**Settings**의 **Overall Generations**(전체 생성) 항목에 있습니다) Marinara가 프롬프트 확인 단계에서 잠시 멈춥니다. 제공자에게 보내기 전에 프롬프트를 하나씩 읽고 고칠 수 있습니다. 이 확인 단계를 건너뛰려면 설정을 꺼 두세요.

## 문제 해결

ffmpeg 관련 메시지와 함께 생성이 실패합니다. ffmpeg을 설치하고 서버가 그 위치를 찾을 수 있게 하거나, `FFMPEG_PATH` 환경 변수를 지정하세요. 위의 "시작하기 전에"를 참고하세요.

드롭다운에 동영상 생성 연결이 없다고 표시됩니다. **Video Generation** 연결을 먼저 추가하세요. [장면 동영상 생성](scene-video.md)을 참고하세요.

**Generate Sprite** 버튼이 비활성화되어 있습니다. 일부 기기에서는 Marinara가 이미지 라이브러리를 불러오지 못해 애니메이션 표정을 포함한 모든 스프라이트 생성이 꺼집니다. 일부 Android 및 Termux 설치 환경에서 나타나는 현상입니다.

저장된 GIF에 배경이 그대로 보입니다. 정상 동작입니다. 애니메이션 표정은 배경 정리를 건너뜁니다. 위의 "투명 배경에 대한 주의"를 참고하세요.

## 관련 가이드

- [캐릭터 스프라이트](../characters/sprites.md)
- [장면 동영상 생성](scene-video.md)
- [다운로드 가능한 에이전트 레퍼런스](../agents/built-in-agents.md)
