# ComfyUI 워크플로 설정

Marinara Engine은 로컬 ComfyUI 서버로 이미지 요청과 동영상 요청을 보낼 수 있고, ComfyUI를 실행하는 RunPod Serverless 엔드포인트로는 이미지 요청을 보낼 수 있습니다. 로컬 이미지 모델은 Marinara에 내장된 기본 워크플로를 쓸 수 있습니다. 동영상과 고급 이미지 설정에는 직접 준비한 API 형식 워크플로를 씁니다. API 형식 워크플로는 ComfyUI에서 JSON으로 내보낸 워크플로입니다.

Marinara에 붙여넣는 JSON은 그 순간의 사본입니다. Marinara는 ComfyUI에 열려 있는 워크플로와 실시간으로 연결되지 않습니다. ComfyUI에서 워크플로를 고쳤다면 테스트하고, 다시 내보내고, Marinara에 저장된 JSON을 새것으로 바꾸세요.

## 시작하기 전에

ComfyUI를 설치하고, 워크플로에 필요한 체크포인트와 사용자 지정 노드를 추가한 다음 서버를 실행하세요. 로컬 주소는 보통 `http://127.0.0.1:8188`입니다.

집 네트워크의 다른 컴퓨터에서 ComfyUI를 실행한다면, 그 서버가 Marinara에서 접근할 수 있는 주소로 대기해야 합니다. 이미지 계정에는 Marinara의 `.env`에 `IMAGE_LOCAL_URLS_ENABLED=true`도 필요합니다. [서버 설정 참고 문서](../CONFIGURATION.md)를 확인하세요. 그래도 연결되지 않으면 상대 컴퓨터의 방화벽을 살펴보세요.

로컬 언어 모델과 이미지 모델이 GPU 메모리에 동시에 올라가지 않을 수 있습니다. 8 GB 그래픽 카드에서 특히 그렇습니다. Marinara의 이미지 대기열은 이미지 작업이 동시에 실행되지 않게 막지만, 이미 올라간 두 모델을 같은 VRAM에 욱여넣을 수는 없습니다. 메모리가 모자란다면 클라우드 언어 모델을 쓰거나, ComfyUI를 다른 기기에서 실행하거나, 한쪽 모델을 내린 뒤에 다른 쪽을 쓰세요.

## Marinara 연결 만들기

1. **Connections**(연결)를 클릭한 다음 **Add**(추가)를 클릭하세요. **Add account**(계정 추가) 창의 **Images & video**(이미지 및 동영상) 아래에서 로컬 서버라면 **ComfyUI**를, RunPod 엔드포인트라면 **RunPod Serverless (ComfyUI)**를 고르세요.
2. 로컬 ComfyUI라면 주소(`http://127.0.0.1:8188`)를 입력하세요. ComfyUI 앞에 있는 프록시가 요구하지 않는 한 API 키는 필요 없습니다([인증 프록시 사용하기](#use-an-authenticated-proxy) 참고). **ComfyUI workflow (optional)**(ComfyUI 워크플로, 선택 사항) 입력란을 비워 두면 Marinara가 내장된 기본 텍스트-이미지 워크플로를 씁니다.
3. RunPod이라면 API 키와 **RunPod endpoint ID**(RunPod 엔드포인트 ID)를 입력하세요. 이때는 사용자 지정 워크플로가 반드시 필요합니다.
4. 이미지 모델에서 **Local image defaults**(로컬 이미지 기본값)를 설정하세요. 여기서 정한 값이 워크플로 안의 대응되는 플레이스홀더를 대신합니다.
5. 워크플로를 붙여넣고 저장한 다음 **Test image**(이미지 테스트)를 클릭하세요.

작동하지 않으면 [문제 해결](#troubleshooting)을 참고하세요.

<a id="use-an-authenticated-proxy"></a>

## 인증 프록시 사용하기

ComfyUI 자체에는 로그인 기능이 없습니다. ComfyUI 앞에 있는 프록시가 토큰이나 추가 헤더를 요구하면 Marinara는 모든 ComfyUI 요청에 그 토큰과 헤더를 함께 보냅니다. 대기열 등록, 기록 조회, 이미지 다운로드, 참조 이미지 업로드, 모델 목록 조회가 모두 여기에 해당합니다. 토큰은 계정에 저장되고, 헤더는 이미지 모델이나 동영상 모델에 저장됩니다.

1. 프록시가 토큰을 확인한다면 **Connections**를 열고 ComfyUI 계정을 편집한 다음 **API key**(API 키)에 토큰을 입력하세요. Marinara는 이 토큰을 `Authorization: Bearer` 헤더로 보냅니다. `Basic ...`처럼 이미 인증 방식이 붙어 있는 값은 그대로 보냅니다.
2. 계정을 저장하세요.
3. 프록시에 비밀 값이 아닌 추가 헤더가 필요하다면 이미지 모델이나 동영상 모델을 열고 **Local image defaults**나 **Video defaults**(동영상 기본값)를 펼치세요. **Custom Request Headers**(사용자 지정 요청 헤더)에 JSON 객체를 입력하세요.
4. 모델을 저장하고 **Test image**나 **Test video**(영상 테스트)를 클릭하세요. 401이나 403 응답은 프록시가 인증 정보를 거부했다는 뜻입니다.

> **경고:** **Custom Request Headers**에는 비밀 값을 절대 붙여넣지 마세요. 비밀 값은 **API key**에 넣으세요. 계정을 내보낼 때는 키가 빠집니다.

## 워크플로 만들고 내보내기

1. ComfyUI에서 Marinara 전용 워크플로를 따로 만드세요.
2. 체크포인트, LoRA, VAE, 프롬프트 인코더, 잠재 이미지 노드나 이미지 입력 노드, 샘플러, 출력 노드를 평소처럼 설정하고 연결하세요.
3. ComfyUI에서 워크플로를 대기열에 넣고, 원하는 이미지가 나오는지 확인하세요.
4. 출력 노드를 넣으세요. Marinara는 ComfyUI의 워크플로 기록에서 완성된 이미지나 애니메이션을 읽어 오므로 **SaveImage**가 가장 안전합니다.
5. 편집용 워크플로를 알아보기 쉬운 이름으로 저장하세요. 예를 들면 `Marinara_Workflow`입니다.
6. 워크플로를 API 형식으로 내보내세요. ComfyUI 프런트엔드 버전에 따라 이 기능의 이름은 **Save (API Format)**(API 형식으로 저장), **Export (API)**, **Export to API** 중 하나일 수 있습니다. 메뉴에 보이지 않으면 ComfyUI의 개발자 옵션(dev mode)을 켜세요.
7. 내보낸 `.json` 파일을 텍스트 편집기로 여세요.

API 형식 워크플로는 평소 편집기에서 보는 워크플로와 다릅니다. 최상위 키가 노드 ID이고, 각 노드는 보통 `class_type`과 `inputs`를 담고 있습니다. 반드시 API 버전을 내보내세요. 편집기의 화면 배치 정보가 들어 있는 일반 워크플로 파일을 붙여넣으면 안 됩니다.

<a id="comfyui-video-workflows"></a>

## ComfyUI 동영상 워크플로

**Images & video** 아래에 **ComfyUI** 계정을 추가하고 그 계정의 동영상 모델을 여세요. 필수 항목인 **ComfyUI workflow (optional)** 입력란에 API 형식 워크플로를 붙여넣으세요. 같은 워크플로가 ComfyUI에서 그대로 돌아가고 코어의 **SaveVideo** 같은 출력 노드로 MP4를 저장하기만 하면, WAN 2.2를 비롯한 로컬 동영상 그래프를 쓸 수 있습니다.

동영상 워크플로에서는 다음 플레이스홀더를 따옴표 안에 넣어 쓸 수 있습니다.

| 플레이스홀더             | Marinara가 넣는 값                                                  |
| ------------------------ | ------------------------------------------------------------------- |
| `%prompt%`               | 완성된 장면 프롬프트 또는 애니메이션 프롬프트입니다.                |
| `%width%`, `%height%`    | 480p는 `832×480`, 720p는 `1280×720`이며 9:16에서는 서로 바뀝니다.   |
| `%seed%`                 | 새로 뽑은 32비트 난수 시드입니다.                                   |
| `%length%`               | 16 fps 기준 프레임 수로 나타낸 클립 길이입니다.                     |
| `%model%`                | 연결에 Model 값이 설정되어 있을 때 그 값입니다.                     |
| `%reference_image_name%` | ComfyUI **LoadImage** 노드에 넘길 첫 프레임 파일 이름입니다.        |

Marinara는 `/prompt`로 워크플로를 대기열에 넣고 `/history`를 확인하면서, `gifs`나 `images` 출력에 적힌 MP4를 다운로드합니다. 이미지로 동영상을 만드는 동작은 `%reference_image_name%`을 제공하지만, 텍스트만 쓰는 연결 테스트는 제공하지 않습니다. 하나의 워크플로로 두 경우를 모두 지원하려면 그 입력을 선택 사항으로 두세요.

로컬 WAN 렌더링은 중급 GPU에서 30분을 넘기기도 합니다. ComfyUI 동영상 작업은 이미지 전용인 `COMFYUI_GEN_TIMEOUT`이 아니라 `VIDEO_GEN_TIMEOUT_MS`를 따릅니다. 멀쩡한 워크플로가 도중에 끊긴다면 동영상 쪽 시간 초과 값을 올리고 Marinara를 다시 시작하세요.

## Marinara 플레이스홀더 넣기

Marinara가 제어해야 하는 값을 아래 플레이스홀더로 바꾸세요.

**로컬 ComfyUI** 연결에서는 모든 플레이스홀더를 JSON 따옴표 안에 두세요. Marinara는 워크플로를 먼저 파싱한 다음, `"%width%"`처럼 숫자 하나만 들어가는 플레이스홀더를 실제 숫자로 바꿉니다. 그래서 숫자 입력이 필요한 노드에서도 문제없이 동작합니다.

**RunPod Serverless (ComfyUI)** 연결에서는 `"%prompt%"`, `"%model%"`, `"%sampler%"` 같은 텍스트 플레이스홀더는 따옴표 안에 두되, `%width%`, `%height%`, `%seed%`, `%steps%`, `%cfg%`, `%denoise%`, `%clip_skip%` 같은 숫자 플레이스홀더는 따옴표 없이 두세요. RunPod에서는 Marinara가 워크플로를 파싱하기 전에 치환이 끝나므로, 들어간 숫자 덕분에 제출되는 JSON이 올바른 형식이 됩니다. 따옴표 없는 토큰은 생성 시점까지 바뀌지 않기 때문에 연결 편집기가 이 템플릿을 잘못된 JSON으로 잠시 표시할 수 있습니다. 이 경고가 떠도 저장에는 문제가 없습니다.

기본적인 **로컬** API 워크플로에서 관련 부분은 대략 이런 모습입니다.

```json
{
  "3": {
    "class_type": "KSampler",
    "inputs": {
      "seed": "%seed%",
      "steps": "%steps%",
      "cfg": "%cfg%",
      "sampler_name": "%sampler%",
      "scheduler": "%scheduler%",
      "denoise": "%denoise%"
    }
  },
  "5": {
    "class_type": "EmptyLatentImage",
    "inputs": {
      "width": "%width%",
      "height": "%height%",
      "batch_size": 1
    }
  },
  "6": {
    "class_type": "CLIPTextEncode",
    "inputs": {
      "text": "portrait, %prompt%, masterpiece"
    }
  },
  "7": {
    "class_type": "CLIPTextEncode",
    "inputs": {
      "text": "watermark, %negative_prompt%"
    }
  }
}
```

이것은 일부분일 뿐입니다. 내보낸 워크플로의 노드 연결과 나머지 입력값은 그대로 두세요. 고정 태그를 앞뒤에 붙이고 싶다면 긴 문자열 안에 프롬프트 플레이스홀더를 넣어도 됩니다. 다만 숫자 플레이스홀더는 값 전체를 차지하는 것이 보통입니다. RunPod용 사본에서는 그 숫자 토큰을 감싼 따옴표를 지우세요. 연결의 기본값이 건드리지 않았으면 하는 설정은 값을 그대로 박아 두어도 됩니다.

| 플레이스홀더          | Marinara가 넣는 값                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------- |
| `%prompt%`            | 긍정 이미지 프롬프트입니다. 빠져 있으면 연결 편집기가 경고합니다.                           |
| `%negative_prompt%`   | 부정 이미지 프롬프트입니다.                                                                 |
| `%width%`, `%height%` | 요청한 이미지 크기입니다.                                                                   |
| `%seed%`              | 연결에 저장된 시드이며, `-1`이면 매번 새 난수 시드를 만듭니다.                              |
| `%model%`             | 연결에 저장된 모델입니다. 로더 노드가 기대하는 체크포인트 값을 정확히 쓰세요.               |
| `%steps%`             | 샘플링 스텝 수입니다.                                                                       |
| `%cfg%`               | CFG 스케일입니다. `%cfg_scale%`과 `%scale%`도 인식합니다.                                   |
| `%sampler%`           | 샘플러 이름입니다.                                                                          |
| `%scheduler%`         | 스케줄러 이름입니다.                                                                        |
| `%denoise%`           | 디노이즈 강도입니다. `%denoising_strength%`도 인식합니다.                                   |
| `%clip_skip%`         | 호환 노드에 넘길 Clip Skip 값입니다.                                                        |

편집이 끝나면 JSON을 저장하고, 파일 전체를 복사해 이미지 모델의 **ComfyUI workflow (optional)**에 붙여넣은 다음, 저장하고 **Test image**를 클릭하세요.

## 참조 이미지 사용하기

생성을 시작하는 기능이 보낼 이미지를 가지고 있으면 Marinara가 참조 이미지를 최대 4장까지 넘겨줍니다. 사용자 지정 워크플로에는 이에 맞는 입력 노드와 플레이스홀더가 들어 있어야 합니다. 플레이스홀더만 적는다고 해당 노드가 저절로 생기거나 연결되지는 않습니다.

### 로컬 ComfyUI: LoadImage에 넘길 파일 이름

표준 ComfyUI **LoadImage** 노드에는 파일 이름 플레이스홀더를 쓰세요.

```json
{
  "12": {
    "class_type": "LoadImage",
    "inputs": {
      "image": "%reference_image_name%",
      "upload": "image"
    }
  }
}
```

Marinara가 참조 이미지를 ComfyUI의 input 폴더로 업로드하고, ComfyUI가 돌려준 파일 이름으로 플레이스홀더를 바꿉니다. `%reference_image_name%`은 첫 번째 이미지를 가리킵니다. 참조 입력이 여러 개인 워크플로에서는 `%reference_image_name_01%`부터 `%reference_image_name_04%`까지 쓸 수 있습니다.

워크플로에 이미지 입력이 반드시 있어야 한다면 **Local image defaults**에서 1x1 플레이스홀더 업로드 옵션을 켜세요. 그러면 요청에 실제 참조 이미지가 없을 때 Marinara가 아주 작은 대체 이미지를 넣어 줍니다.

### base64 원본 이미지 데이터

첫 번째 base64 원본 이미지에는 `%reference_image%`를, 번호가 붙은 입력에는 `%reference_image_01%`부터 `%reference_image_04%`까지를 쓰세요. 이 값에는 `data:image/...` 접두사가 없는 base64 데이터만 들어 있어서, 그 형식을 그대로 받는 사용자 지정 노드에서만 동작합니다.

RunPod 워크플로는 base64 원본 플레이스홀더를 지원합니다. 파일 이름 업로드 플레이스홀더는 로컬 ComfyUI 전용이라 RunPod 핸들러에서는 쓸 수 없습니다.

## 캐릭터별 워크플로 관리하기

특정 체크포인트, LoRA 조합, ControlNet 설정, 참조 이미지 구성이 필요한 캐릭터마다 내보낸 워크플로와 Marinara 이미지 연결을 따로 만들 수 있습니다. 해당 캐릭터나 이미지 기능에서 모델을 고를 수 있는 자리마다 그에 맞는 이미지 모델을 선택하세요.

이렇게 하면 범용 워크플로 하나를 쓸 때보다 결과가 더 일관될 수 있습니다. 다만 모델마다 JSON 사본을 따로 들고 있다는 점은 그대로입니다. ComfyUI에서 어떤 캐릭터의 워크플로를 고쳤다면, 그 연결에 대해 내보내기, 편집, 복사, 붙여넣기 과정을 다시 거쳐야 합니다.

<a id="troubleshooting"></a>

## 문제 해결

| 문제                                             | 확인할 것                                                                                                                                                                                                                     |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Marinara가 워크플로 JSON이 잘못되었다고 알립니다 | 로컬 ComfyUI라면 플레이스홀더를 넣은 뒤의 따옴표, 쉼표, 괄호를 확인하세요. RunPod이라면 따옴표를 뺄 대상은 숫자 플레이스홀더뿐입니다. 텍스트 플레이스홀더와 나머지 템플릿은 여전히 올바른 JSON 문법이어야 합니다. |
| 프롬프트나 플레이스홀더가 그대로 노드에 전달됩니다 | 토큰 철자가 표에 적힌 것과 정확히 같은지, 붙여넣은 워크플로가 새로 내보낸 API 버전이 맞는지 확인하세요.                                                                                                                       |
| 이미지가 요청한 크기를 무시합니다                | 실제로 샘플러에 값을 넘기는 잠재 이미지 노드나 그에 해당하는 크기 노드에 `%width%`와 `%height%`를 넣으세요.                                                                                                                   |
| ComfyUI가 모델을 찾지 못합니다                   | 로더가 기대하는 체크포인트 이름을 정확히 쓰거나, `%model%` 대신 체크포인트를 워크플로에 그대로 박아 두세요.                                                                                                                   |
| ComfyUI가 노드나 입력이 없다고 알립니다          | 워크플로를 만들 때 쓴 사용자 지정 노드 패키지를 똑같이 설치하고, 입력 이름이 바뀌지 않았는지 확인하세요.                                                                                                                      |
| 작업은 끝났는데 Marinara가 이미지를 받지 못합니다 | 연결된 **SaveImage** 출력을 추가하고, ComfyUI에서 워크플로를 직접 다시 테스트하세요.                                                                                                                                          |
| 참조 이미지 노드가 실패합니다                    | 일반적인 로컬 **LoadImage** 노드라면 `%reference_image_name...%` 플레이스홀더를 쓰세요. base64 원본은 그 형식을 위해 만들어진 노드에서만 쓰고, Marinara 기능이 참조 이미지를 실제로 넘겼는지 확인하세요.                      |
| 원격이나 LAN의 ComfyUI 주소가 차단됩니다         | 이미지 연결이라면 `IMAGE_LOCAL_URLS_ENABLED`를 켜세요. ComfyUI가 네트워크 인터페이스에서 대기하도록 하고 호스트 방화벽을 확인하세요. 인증 없는 ComfyUI 서버를 공개 인터넷에 노출하지 마세요.                                   |
| ComfyUI가 401이나 403으로 응답합니다             | ComfyUI 앞에 있는 프록시가 요청을 거부했습니다. 프록시용 인증 정보는 **API key**에, 추가 헤더는 **Custom Request Headers**에 넣은 다음 **Test image**를 다시 실행하세요. [인증 프록시 사용하기](#use-an-authenticated-proxy)를 참고하세요. |
| 오류: `Outbound response exceeded N bytes`      | 응답이 설정된 한도를 넘었습니다. 한도의 기본값은 30 MiB입니다. 워크플로나 참조 이미지 메타데이터가 파일에 포함되면 이런 일이 생길 수 있습니다. ComfyUI에서 메타데이터를 끄거나, Marinara의 `.env`에서 `IMAGE_GEN_MAX_RESPONSE_BYTES`를 늘리고 Marinara를 다시 시작하세요. |
| 오래 걸리는 이미지 생성이 시간 초과로 끊깁니다   | Marinara의 `.env`에서 `COMFYUI_GEN_TIMEOUT`을 늘리세요. 단위는 초이고 기본값은 `2400`입니다.                                                                                                                                  |
| 오래 걸리는 동영상 생성이 시간 초과로 끊깁니다   | Marinara의 `.env`에서 `VIDEO_GEN_TIMEOUT_MS`를 늘리세요. 단위는 밀리초이고 기본값은 `1800000`(30분)입니다.                                                                                                                    |
| 생성 중 GPU 메모리가 부족합니다                  | 이미지 크기나 모델 크기를 줄이거나, 로컬 언어 모델을 내리거나, 원격 언어 모델을 쓰거나, ComfyUI를 다른 기기로 옮기세요.                                                                                                       |

## 관련 가이드

- [이미지 생성 제공자와 설정](image-providers.md) 문서에서 지원하는 모든 이미지 서비스와 공통 이미지 설정을 다룹니다.
- [장면 동영상 생성](scene-video.md) 문서에서 동영상 연결과 장면 동영상 관련 화면 전체를 다룹니다.
- [Game Mode의 LTX 2.3 스토리보드](../game/ltx-2-3-storyboards.md) 문서에서 LTX Director API 워크플로, 플레이스홀더, 권장 Game 설정을 다룹니다.
- [이미지 스타일 프로필](style-profiles.md) 문서에서 Marinara의 재사용 가능한 프롬프트 스타일을 설명합니다.
- [Illustrator 에이전트](illustrator-agent.md) 문서에서 장면 삽화 자동 생성을 다룹니다.
- [서버 설정 참고 문서](../CONFIGURATION.md)에서 로컬 네트워크 접근과 ComfyUI 시간 초과 설정을 설명합니다.
- [ComfyUI 워크플로 개념](https://docs.comfy.org/development/core-concepts/workflow) 문서는 공식 ComfyUI 문서에서 워크플로를 설명합니다.
