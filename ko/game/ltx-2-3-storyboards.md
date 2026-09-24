# Game Mode의 LTX 2.3 스토리보드

이 가이드에서는 로컬 LTX 2.3 ComfyUI 이미지-투-비디오 워크플로를 Marinara Engine의 Game Mode(게임 모드) 스토리보드에 연결하는 방법을 설명합니다. 이 기능을 Story Mode라고 부르는 플레이어도 있지만, Marinara의 컨트롤 이름은 **Game Mode**와 **Storyboards**(스토리보드)입니다.

아래 설정은 **Krea 2** 첫 프레임 생성과 **Z-Image Turbo Narrative** 자연어 Image Style을 기준으로 다듬었습니다. 서술형 자연어 장면 프롬프트를 받아들이는 이미지 연결이라면 다른 것도 동작합니다. LTX 동영상 렌더링은 로컬 ComfyUI에서 돌아가고, 첫 프레임 생성이 로컬인지 호스팅 서비스인지는 선택한 이미지 연결에 따라 달라집니다.

완성된 경로는 다음과 같습니다.

```text
GM narration
  -> Animation Planner
     -> imagePrompt -> image connection -> first-frame illustration
     -> narrationBeat -> Narration Passthrough -> %prompt%
  -> first frame + prompt -> ComfyUI LTX 2.3 workflow -> MP4 clip
```

생성된 삽화가 클립의 첫 프레임이 됩니다. 즉, LTX는 시각적인 출발점과 다음에 무엇이 움직이는지에 집중한 프롬프트를 함께 받습니다.

## 시작하기 전에

다음이 필요합니다.

1. Marinara가 접근할 수 있는 로컬 ComfyUI 설치본.
2. 편집 가능한 `ltx-director-simple` 워크플로, 또는 ComfyUI 안에서 문제없이 끝까지 실행되는 동등한 LTX 2.3 이미지-투-비디오 그래프.
3. Marinara 연결에 넣을 API 형식 내보내기 파일 `ltx-director-simple-api`.
4. 첫 프레임 삽화를 만들 Marinara 이미지 생성 연결.
5. **Agents > Download Agents**에서 설치하고 **Chat Settings > Agents**에서 해당 게임에서 활성화한 **Storyboard** 에이전트.

편집용 ComfyUI 워크플로와 API 내보내기 파일은 서로 다른 파일입니다. ComfyUI에서 `ltx-director-simple`을 열고, ComfyUI Manager가 알려 주는 누락된 사용자 지정 노드를 모두 설치한 다음, 그래프를 그 자리에서 테스트하세요. Marinara 연결에는 `ltx-director-simple-api`를 가져오세요. 노드나 모델을 바꿀 때마다 그래프를 API 형식으로 다시 내보내고, 연결에 저장된 JSON을 교체하세요. 일반 비주얼 편집기용 워크플로를 Marinara에 붙여넣으면 안 됩니다.

내보내기와 연결의 일반적인 절차는 [ComfyUI 워크플로 설정](../media/comfyui.md)을 참고하세요.

## LTX 2.3 모델 고르기

ComfyUI가 텍스트 인코더, VAE, 업스케일러를 올린 뒤 남는 메모리와 GPU 아키텍처에 맞춰 모델 형식을 고르세요. 아래 값은 출발점일 뿐이며, 모든 워크플로가 모든 카드에 들어간다는 보장은 아닙니다.

| GPU 계열 | 실용적인 출발점 | 비고 |
| --- | --- | --- |
| RTX 30 시리즈(Ampere) | INT8 ConvRot | 3070, 3080, 3090급 카드를 위한 저메모리 출발점입니다. |
| 16-24 GB의 RTX 40 시리즈 | FP8 input-scaled | Ada 세대 하드웨어에서 쓸 수 있는 가속 FP8 경로를 사용합니다. |
| 8-12 GB의 RTX 40 시리즈 | FP8 오프로딩이 너무 느리면 INT8 ConvRot | 실제 워크플로로 둘 다 비교해 보세요. 남은 VRAM과 오프로딩 동작도 영향을 줍니다. |
| RTX 50 시리즈(Blackwell) | NVFP4 dev 워크플로 | NVFP4를 지원하는 ComfyUI, CUDA, 노드 구성이 필요합니다. |
| 기존 distilled 워크플로를 쓰는 RTX 50 | FP8 input-scaled | 공식 distilled NVFP4 체크포인트가 나오기 전까지 쓰는 호환 경로입니다. |

테스트를 마친 RTX 3080 워크플로는 다음 모델을 사용합니다.

```text
ltx-2.3-22b-distilled-1.1_transformer_only_int8_convrot.safetensors
```

이 접미사들은 양자화 형식과 실행 경로가 다르다는 뜻이지, 아무 때나 바꿔 끼울 수 있는 품질 프리셋이 아닙니다.

- **INT8 ConvRot**은 RTX 30 시리즈와 용량이 작은 Ada 카드에서 커뮤니티가 실제로 쓰는 저메모리 경로입니다.
- **FP8 input-scaled**는 대략 RTX 40 시리즈 이후의 NVIDIA 하드웨어에서 가속 FP8 행렬 연산을 사용합니다.
- **NVFP4**는 RTX 50 시리즈 워크플로가 쓰는 Blackwell 네이티브 4비트 경로입니다.
- **Dev** 워크플로와 **distilled** 워크플로는 샘플링 전제가 다릅니다. 첨부된 distilled 그래프에 dev 체크포인트를 그대로 넣지 말고, 워크플로부터 거기에 맞게 고치세요.

8 GB 카드라면 첫 연동 테스트는 480p와 키프레임 1개로 시작하세요. 체크포인트가 메모리에 들어간다고 해서 더 길거나 해상도가 높은 동영상까지 들어가는 것은 아닙니다. 동영상 latent, 텍스트 인코더, VAE, 오디오, 업스케일링도 메모리를 쓰기 때문입니다.

공식 입문용 워크플로는 다음 구성 요소를 사용합니다.

- `ltx-2.3-22b-dev-fp8.safetensors`
- `ltx-2.3-22b-distilled-lora-384.safetensors`
- `gemma_3_12B_it_fp4_mixed.safetensors`
- `ltx-2.3-spatial-upscaler-x2-1.1.safetensors`

직접 만든 워크플로는 distilled v1.1 체크포인트, 서드파티 양자화, 다른 로더 노드, 다른 모델 폴더를 쓸 수 있습니다. API 워크플로에 저장된 파일 이름은 ComfyUI가 실제로 볼 수 있는 파일과 정확히 일치해야 합니다.

공식 문서:

- [LTX 2.3 image-to-video guide](https://docs.ltx.io/open-source-model/usage-guides/image-to-video)
- [LTX prompting guide](https://docs.ltx.io/open-source-model/usage-guides/prompting-guide)
- [LTX 2.3 model card](https://huggingface.co/Lightricks/LTX-2.3)
- [LTX 2.3 NVFP4 model card](https://huggingface.co/Lightricks/LTX-2.3-nvfp4)
- [Official LTX 2.3 ComfyUI examples](https://github.com/Lightricks/ComfyUI-LTXVideo/tree/master/example_workflows/2.3)
- [Community ComfyUI-separated and FP8 weights](https://huggingface.co/Kijai/LTX2.3_comfy)

## ComfyUI API 워크플로 준비하기

먼저 실제 원본 이미지와 간단한 프롬프트로 편집용 워크플로를 ComfyUI에서 직접 큐에 넣어 보세요. 오디오가 포함된 MP4가 저장되는지 확인한 다음에 API 내보내기 파일을 Marinara용으로 손보세요.

간단한 Marinara 경로는 LTX Director의 전역 프롬프트 입력에 완성된 프롬프트 하나만 넣습니다.

```json
{
  "global_prompt": "%prompt%",
  "local_prompts": "",
  "segment_lengths": ""
}
```

LTX Director 노드는 여전히 이미지 컨디셔닝, 가이드 데이터, 오디오, 두 단계 샘플링을 처리할 수 있습니다. 여기서 "간단하다"는 말은 프롬프트 규약을 가리킵니다. 즉, Marinara는 Prompt Relay 타임라인 대신 앞뒤가 이어지는 이미지-투-비디오 문단 하나를 보냅니다.

### 필수 플레이스홀더

API 내보내기 파일에서 해당 값들을 따옴표로 감싼 Marinara 플레이스홀더로 바꾸세요.

| 플레이스홀더 | 전달되는 값 |
| --- | --- |
| `%prompt%` | 선택한 스토리보드 Animation Planner와 동영상 템플릿이 만들어 낸 완성 프롬프트 |
| `%reference_image_name%` | ComfyUI에 업로드된 첫 프레임 이미지 |
| `%duration_seconds%` | 스토리보드 클립 길이(초) |
| `%length%` | Marinara의 16 FPS 프레임 규약으로 환산한 길이 |
| `%fps%` | Marinara가 클립에 사용하는 프레임 레이트 |
| `%width%`, `%height%` | 동영상 연결의 해상도와 화면비에서 선택된 크기 |
| `%seed%` | 요청마다 새로 뽑는 무작위 시드 |
| `%model%` | 워크플로가 로더 모델을 고정해 두지 않았을 때 연결에서 가져오는 선택적 모델 값 |

참조 이미지는 LTX Director의 `timeline_data` 안에 있는 `segments` 배열에 들어갑니다. API 워크플로에서 `timeline_data`는 직렬화된 JSON 문자열입니다. `%length%`는 `normalDurationFrames`를 통해 클립 길이를 동적으로 유지합니다. 0번 프레임의 참조 이미지 세그먼트는 의도적으로 짧은 고정값 `"length":16`을 그대로 둡니다.

```json
{
  "timeline_data": "{\"global_prompt\":\"\",\"normalStartFrame\":0,\"normalDurationFrames\":%length%,\"segments\":[{\"id\":\"marinara-reference\",\"start\":0,\"length\":16,\"prompt\":\"\",\"type\":\"image\",\"imageFile\":\"%reference_image_name%\",\"isEndFrame\":false}],\"motionSegments\":[],\"audioSegments\":[]}"
}
```

`%reference_image_name%`을 `timeline_data` 옆이나 별도의 최상위 이미지 필드에 두면 안 됩니다. 프레임 수, 초, 프레임 레이트는 `%length%`, `%duration_seconds%`, `%fps%`로 워크플로의 외부 입력에 연결해 두세요. 편집용 ComfyUI 그래프에 보이는 숫자 값은 Marinara의 기본값이 아닙니다.

`%reference_image_name%` 같은 문자열 플레이스홀더는 따옴표로 감싼 채 두세요. Marinara가 숫자로 변환하므로 `%length%`, `%duration_seconds%`, `%fps%`는 정확한 숫자 입력을 요구하는 노드에서도 따옴표로 감싸도 됩니다. 직렬화된 `timeline_data` 문자열 안에서는 위 예시처럼 `%length%`를 따옴표 없이 두어야 디코딩된 타임라인 값이 숫자가 됩니다.

### 수정할 때마다 다시 내보내기

1. ComfyUI에서 편집용 워크플로를 큐에 넣으세요.
2. 현재 그래프가 재생 가능한 MP4를 만드는지 확인하세요.
3. **Save (API Format)**(API 형식으로 저장), **Export (API)**, **Export to API** 중 하나를 선택하세요.
4. 새로 만든 API JSON에 플레이스홀더를 넣거나 제대로 들어갔는지 확인하세요.
5. Marinara 연결에 저장된 워크플로를 교체하세요.

노드를 지운 뒤에도 예전 API 내보내기 파일을 계속 쓰면 이미 없어진 노드를 가리키는 참조가 남을 수 있습니다. 그러면 ComfyUI가 생성을 시작하기도 전에 요청을 거부합니다.

## Marinara 동영상 연결 만들기

1. **Settings**(설정)를 열고 **Connections**(연결)로 이동하세요.
2. **Video Generation**(동영상 생성) 연결을 추가하세요.
3. **ComfyUI**를 선택하세요.
4. ComfyUI 기본 URL을 입력하세요. 같은 컴퓨터에서 돌아간다면 보통 `http://127.0.0.1:8188`입니다.
5. API 형식 워크플로 전체를 **ComfyUI Workflow**에 붙여넣으세요.
6. 저VRAM 첫 테스트에서는 기본 길이 6초, **16:9**, 480p를 선택하세요.
7. 연결을 저장하세요.

텍스트만 쓰는 연결 테스트로는 `%reference_image_name%`을 검증할 수 없습니다. 연결을 저장한 뒤 **Gallery**(갤러리) 이미지나 스토리보드에서 이미지-투-비디오를 실제로 확인하세요.

## Game Mode 채팅 설정하기

Game Mode 채팅을 열고 **Chat Settings**(채팅 설정)에서 **Agents**(에이전트)를 선택하세요. 아래 항목을 설정하기 전에 **Enable Agents**(에이전트 활성화)와 **Enable Storyboards**(스토리보드 활성화)를 켜세요. 새 게임 마법사의 **Storyboard Optimized**(스토리보드 최적화) 연출은 에이전트를 활성화하지 않습니다.

### Illustrator

| 설정 | 권장값 |
| --- | --- |
| **Game Illustrator**(게임 Illustrator) | On |
| **Image Connection**(이미지 연결) | **Krea 2** |
| **Image Style**(이미지 스타일) | **Z-Image Turbo Narrative** |
| **Use Campaign Art Style**(캠페인 아트 스타일 사용) | Off |
| **Attach Card Appearance**(카드 외형 첨부) | Off |
| **Send Avatar References**(아바타 참조 전송) | 여기서 테스트한 워크플로에서는 Off |

Animation Planner는 이미 해당 스토리보드 턴의 캐릭터 외형 컨텍스트를 받습니다. 그래서 최종 이미지 형식을 만들 때 같은 정보가 또 붙지 않도록 **Attach Card Appearance**를 끕니다. **Storyboard First Frame** 역시 플래너가 완성한 T=0 장면 주위에 캠페인 아트 디렉션을 반복해서 덧붙이지 않습니다.

**Send Avatar References**는 첫 프레임을 만드는 이미지 제공자에게 보낼 참조 이미지를 제어할 뿐, LTX의 첫 프레임 입력과는 상관이 없습니다. LTX는 완성된 스토리보드 삽화를 `%reference_image_name%`으로 받습니다. 여기서 테스트한 Krea 구성에서는 아바타 참조를 꺼 두고, 선택한 이미지 연결이 이 기능을 지원하고 실제로 효과가 있는지 확인한 뒤에 따로 켜세요.

첫 프레임 이미지는 애니메이션 품질을 크게 좌우합니다. 계획된 움직임이 시작되기 직전의 순간을 담아야 하고, 인물, 이동 경로, 손, 문, 소품, 목표물이 또렷하게 보여야 합니다.

### Scene Videos

| 설정 | 권장값 |
| --- | --- |
| **Video Connection**(비디오 연결) | 위에서 만든 LTX 2.3 ComfyUI 연결 |
| **Game Video Prompt**(게임 동영상 프롬프트) | **Narration Passthrough** |

일반 **Game Video Prompt**는 수동으로 실행하는 Gallery와 Game Assets 애니메이션을 제어합니다. 스토리보드 클립은 그 애니메이션 동작을 건드리지 않고 자기 프롬프트를 따로 고를 수 있습니다.

### Storyboards

다음 구성으로 시작하세요.

| 설정 | 권장 시작값 |
| --- | --- |
| **Automatic Storyboard Illustrations**(자동 스토리보드 일러스트) | On |
| **Automatic Storyboard Animations**(자동 스토리보드 애니메이션) | On |
| **Use NovelAI Character Prompts**(NovelAI 캐릭터 프롬프트 사용) | Off |
| **Keyframes per Turn**(턴당 키프레임 수) | 보통은 3. 첫 8 GB VRAM 테스트는 1로 시작하세요 |
| **Animation Clip Duration**(애니메이션 클립 길이) | 5초 |
| **Viewer Display**(시청자 화면) | 테스트 중에는 **Floating** |
| **Illustration Planner**(일러스트 플래너) | **Still Keyframes**. 정지 이미지 전용 대비책으로 남겨 둡니다 |
| **Animation Planner**(애니메이션 플래너) | **LTX Simple Image-to-Video** |
| **Use Storyboard Template**(스토리보드 템플릿 사용) | On |
| **Storyboard Illustration Prompt**(스토리보드 일러스트 프롬프트) | **Storyboard First Frame** |
| **Storyboard Video Prompt**(스토리보드 동영상 프롬프트) | **Narration Passthrough** |

기본값으로는 **LTX Simple Image-to-Video**를 권장합니다. 이 플래너는 애니메이션에 바로 쓸 수 있는 첫 프레임 1개와 4에서 8문장 분량의 직접적인 모션 프롬프트 1개를 계획합니다. 주된 동작 하나, 카메라 움직임 하나, 절제된 환경 움직임, 그리고 상황에 맞는 오디오나 짧은 대사를 선호합니다.

**LTX Director Storyboard**는 고급 선택지로 계속 제공됩니다. 길이를 고려한 더 자세한 연출과 연속성 규칙을 제공합니다. 간단한 경로가 안정적으로 돌아가고 나서, 또는 긴 클립에 정말로 여러 단계의 연결이 필요할 때 써 보세요. 두 플래너 모두 같은 `%prompt%` 워크플로 규약을 씁니다.

**Illustration Planner: Still Keyframes**는 애니메이션이 켜져 있는 동안 Krea용 프롬프트를 만들지 않습니다. 애니메이션 모드에서는 **LTX Simple Image-to-Video**가 두 출력을 모두 만듭니다. Krea에 보낼 자연어 `imagePrompt`와 LTX에 보낼 `narrationBeat`입니다. Still Keyframes는 동영상 없이 생성되는 턴에만 쓰이도록 선택된 채로 남습니다.

**Storyboard First Frame**은 Animation Planner가 만든 완성된 자연어 T=0 장면을 Krea에 그대로 넘깁니다. 키프레임 제목, 프롬프트 라벨, 중복된 외형 설명, 캠페인 아트 디렉션을 덧붙이지 않습니다. 이 포맷터가 실제로 적용되도록 **Use Storyboard Template**은 켜 두세요.

**Narration Passthrough**는 의도적으로 아주 단순합니다. Animation Planner가 완성한 `narrationBeat`를 범용 동영상 프롬프트 규약으로 넘길 뿐, 장면 요약을 다시 감싸지 않습니다.

키프레임 1개마다 Krea 이미지 작업 1개와 로컬 LTX 동영상 작업 1개가 생깁니다. 즉, 키프레임이 3개면 첫 프레임 렌더링 3회와 동영상 렌더링 3회가 시작됩니다. VRAM이 8 GB인 GPU라면 480p에서 키프레임 1개로 시작하세요. 이 설정이 성공한 다음에 키프레임 3개와 더 높은 해상도로 옮겨 가세요.

## 첫 테스트 실행하기

문 열기, 소리 나는 쪽 바라보기, 몇 걸음 걷기, 짧은 대사 한 마디처럼 눈에 잘 띄는 동작이 하나 들어 있는 완료된 GM 턴을 고르세요.

1. 저VRAM에서 가장 빨리 확인하려면 **Animation Clip Duration**은 5초로 두고 **Keyframes per Turn**만 잠시 1로 낮추세요. 평소 테스트 구성은 키프레임 3개입니다.
2. 현재 GM 턴이 이미 끝난 뒤에 두 자동 스토리보드 설정을 켜세요.
3. **Gallery**를 열고 방금 그 완료된 GM 턴에서 **Create storyboard**(스토리보드 만들기)를 선택하세요. 다음 턴을 기다리지 않고 삽화와 애니메이션 전체 경로를 바로 실행할 수 있습니다.
4. 프롬프트 노출 기능이 켜져 있다면 제출하기 전에 첫 프레임 프롬프트를 확인하세요.
5. 생성된 첫 프레임이 동작을 이어 가기에 알맞은 자세인지 확인하세요.
6. 첫 프레임 렌더링이 끝나기를 기다린 다음, ComfyUI 클립이 끝날 때까지 기다리세요.
7. 수동 경로가 잘 동작하면 **Keyframes per Turn**을 3으로 되돌리고, 이후 턴을 위해 두 자동 설정은 켜 둔 채로 두세요.

설정 중에는 **Floating** 뷰어 모드를 쓰세요. 이미지와 클립을 하나씩 살펴보기가 편합니다. 워크플로가 안정된 뒤 스토리보드 미디어를 Game Mode 장면에 녹여 내고 싶다면 **Background**로 바꾸세요.

## 프롬프트 전달 방식

Animation Planner는 키프레임마다 다음 두 가지를 돌려줍니다.

- `imagePrompt`: 시간 T=0에 보이는 첫 프레임만 담습니다.
- `narrationBeat`: 다음에 무슨 일이 일어나는지 서술하는 완성된 LTX 이미지-투-비디오 프롬프트입니다.

선택한 Animation Planner가 두 필드를 모두 씁니다. **Storyboard First Frame**은 `imagePrompt`의 형식을 잡아 그 자연어 T=0 장면을 Krea 2에 보냅니다. 이미지가 만들어지면 **Narration Passthrough**가 `narrationBeat`로 풀립니다. Marinara는 그 값을 일반 동영상 요청의 `prompt` 필드에 넣고, ComfyUI 워크플로의 `%prompt%`를 교체하고, 첫 프레임을 업로드한 뒤 `%reference_image_name%`을 ComfyUI 쪽 파일 이름으로 바꿉니다.

로컬 프롬프트 세그먼트를 2개 만들 필요는 없습니다. 이 스토리보드 프리셋에서는 전역 프롬프트 하나만 쓰는 것이 정상 경로입니다.

## 좋은 LTX 프롬프트란

원본 이미지가 이미 캐릭터 외형, 구도, 배경, 조명, 색감, 질감을 담고 있습니다. 그러니 동영상 프롬프트는 움직임에 집중해야 합니다.

- 현재 시제로 쓴 매끄러운 한 문단.
- 클립 길이에 맞는 초점이 뚜렷한 동작 하나.
- 인물을 기준으로 서술한 카메라 움직임.
- 시선, 표정, 자세, 호흡, 몸짓으로 드러나는 반응.
- 쓸모 있는 환경 움직임 최대 하나.
- 상황에 맞을 때는 주변 소리, 효과음, 음악, 따옴표로 감싼 짧은 대사.
- 마지막에는 자연스러운 마무리 동작, 잦아드는 움직임, 짧은 정지.

장면 전환, 컷, 순간 이동, 서로 무관한 여러 동작, 복잡한 물리 현상, 여러 인물이 얽힌 동선, 정확히 읽히는 글자, 첫 프레임에 이미 보이는 요소를 다시 나열하는 서술은 피하세요.

예시:

```text
She pushes the door open and walks outside as the camera follows closely behind her. A light breeze moves her hair while her pace remains steady. She glances toward the empty street and says, "Stay close." Footsteps and distant traffic continue as the camera settles behind her.
```

## 재현 가능한 설정 기록하기

"8 GB에서 돌아간다"는 결과는 체크포인트만으로 정해지지 않습니다. 워크플로를 공유할 때는 다음을 함께 적어 두세요.

- 정확한 GPU 모델명과 VRAM 용량.
- ComfyUI 버전 또는 커밋.
- NVIDIA 드라이버, CUDA, PyTorch, Python 버전.
- 필요한 사용자 지정 노드 패키지와 그 버전.
- 정확한 모델 파일 이름과 각 파일이 들어 있는 ComfyUI 폴더.
- 출력 해상도, 길이, 키프레임 수, 대략적인 렌더링 시간.
- 그 구성에서 Krea 2가 로컬에서 돌아가는지, 호스팅 이미지 연결을 거치는지.

첨부한 API JSON에는 노드 ID, 모델 경로, 입력 이름이 그 시점 그대로 저장됩니다. 모델을 `LTX2/` 같은 다른 폴더에 두는 사용자는 로더 값을 고치고 API 사본을 새로 내보내야 합니다. 작성자의 ComfyUI 설치본에서 잘 돌아가는 워크플로도 사용자 지정 노드나 모델 경로가 다르면 다른 환경에서는 실패할 수 있습니다.

## 문제 해결

### ComfyUI가 HTTP 400이나 "Prompt outputs failed validation"을 반환합니다

API 워크플로가 현재 설치된 그래프와 맞지 않는다는 뜻입니다. 삭제된 노드, 끊긴 노드 ID, 빠진 사용자 지정 노드, 노드 업데이트로 이름이 바뀐 입력, 더는 존재하지 않는 모델 파일 이름을 찾아보세요. 잘 동작하는 ComfyUI 그래프에서 API 워크플로를 새로 내보내면 됩니다.

### 이미지는 만들어지는데 동영상이 안 만들어집니다

**Automatic Storyboard Animations**와 Game Mode의 **Video Connection**을 확인하세요. 애니메이션에는 첫 프레임 삽화와 선택된 동영상 연결이 둘 다 필요합니다.

### LTX가 시작 이미지를 받지 못합니다

저장된 API 워크플로에 `%reference_image_name%`이 들어 있는지, 그리고 그 값이 LTX Director의 이미지 세그먼트로 들어가는지 확인하세요. Marinara는 그 플레이스홀더가 있을 때만 첫 프레임을 업로드합니다.

### 클립이 뭉개지거나 캐릭터가 바뀌거나 뒤죽박죽이 됩니다

**LTX Simple Image-to-Video**로 되돌리고, 키프레임 1개로 동작이 하나뿐인 턴을 테스트하세요. 원본 이미지 한 장이 짧은 연속 클립 안에서 여러 장소, 여러 자세, 여러 결말로 매끄럽게 바뀔 수는 없습니다. 첫 프레임도 확인하세요. 시작 자세가 애매하면 모션 프롬프트가 좋아도 애니메이션이 훨씬 어려워집니다.

### 생성 결과가 매번 너무 비슷합니다

고정해 둔 샘플링 시드를 `%seed%`로 바꾸세요. 쓸 만한 결과가 나온 뒤, 프롬프트나 샘플링 변경을 비교할 때만 워크플로에서 그 시드를 잠시 고정하세요.

### 생성 도중 메모리가 부족합니다

480p부터 시작하세요. 그래도 부족하면 다음으로 길이를 줄이세요. 테스트 중에는 턴당 키프레임을 1개로 두고, GPU를 쓰는 다른 프로그램을 닫고, VRAM이 적은 같은 GPU에 로컬 언어 모델을 올려 두지 마세요. 양자화 체크포인트는 모델이 쓰는 메모리를 줄여 줄 뿐, 동영상 latent, 텍스트 인코더, VAE, 오디오, 업스케일링이 쓰는 메모리까지 없애 주지는 않습니다.

### Marinara는 기다리기를 멈췄는데 ComfyUI는 계속 렌더링합니다

브라우저 요청을 닫거나 클라이언트 연결이 끊기면 Marinara의 폴링만 멈추고, ComfyUI 큐에 이미 들어간 작업은 취소되지 않습니다. 같은 렌더링을 다시 시작하기 전에 ComfyUI의 큐, 기록, 출력 폴더를 확인하세요.

### ComfyUI에서는 되는데 Marinara에서는 실패합니다

저장된 연결 JSON을 가장 최근 API 내보내기 파일과 비교하세요. 기본 URL, 플레이스홀더 철자, 필요한 사용자 지정 노드, 모델 경로, 출력 노드, 크기, 길이 필드를 확인하세요. 편집용 그래프는 잘 돌아가는데 Marinara는 예전에 내보낸 스냅샷을 들고 있는 경우가 있습니다.

서버 추적 기록을 자세히 보려면 디버그 로그를 켜고 `[debug/game/storyboard-video]`와 `[video-gen/comfyui]`를 찾아보세요. 정상적인 요청에는 완성된 전역 프롬프트, 업로드된 참조 이미지 파일 이름, 길이, 프레임 수, 큐에 등록된 ComfyUI 프롬프트 ID가 보입니다.

## 관련 가이드

- [스토리보드 에이전트 가이드](storyboard.md)
- [ComfyUI 워크플로 설정](../media/comfyui.md)
- [장면 동영상 생성](../media/scene-video.md)
- [Game Mode: 시작하기](getting-started.md)
