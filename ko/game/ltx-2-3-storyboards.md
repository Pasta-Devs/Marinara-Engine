# Game Mode의 LTX 2.3 스토리보드

이 가이드에서는 로컬 LTX 2.3 ComfyUI 이미지-투-비디오 워크플로를 Game Mode(게임 모드) 스토리보드에 연결해, 스토리보드 프레임 하나하나를 짧은 동영상 클립으로 만드는 방법을 설명합니다. 로컬 GPU와 ComfyUI를 갖춘 플레이어를 위한 고급 설정입니다. 이 기능을 Story Mode라고 부르는 플레이어도 있습니다. Marinara에서 컨트롤 이름은 **Game Mode**와 **Storyboards**(스토리보드)입니다.

이 설정은 **Krea 2** 첫 프레임 이미지와 **Z-Image Turbo Narrative** Image Style을 기준으로 다듬었습니다. 서술형 자연어 장면 프롬프트를 받아들이는 이미지 계정이라면 다른 것도 동작할 것입니다. LTX 동영상은 ComfyUI에서 로컬로 렌더링됩니다. 첫 프레임 이미지가 로컬에서 만들어지는지 호스팅 서비스에서 만들어지는지는 고른 이미지 계정에 따라 달라집니다.

완성된 경로는 다음 단계로 이루어집니다.

1. GM이 내레이션 턴을 씁니다.
2. Animation Planner가 `imagePrompt`와 `narrationBeat`를 돌려줍니다.
3. `imagePrompt`는 이미지 계정으로 가서 첫 프레임 삽화가 됩니다.
4. `narrationBeat`는 **Narration Passthrough**를 거쳐 `%prompt%`가 됩니다.
5. 첫 프레임과 프롬프트가 ComfyUI LTX 2.3 워크플로로 가고, 워크플로가 MP4 클립을 만듭니다.

삽화가 클립의 첫 프레임이 됩니다. LTX는 시작 그림과, 다음에 무엇이 움직이는지에 관한 프롬프트를 함께 받습니다. 제대로 동작하면 Gallery(갤러리)의 **Videos**(동영상) 탭에 클립이 나타납니다.

## 시작하기 전에

다음이 필요합니다.

1. Marinara가 접근할 수 있고 제대로 동작하는 로컬 ComfyUI. [ComfyUI 워크플로 설정](../media/comfyui.md)을 참고하세요.
2. VRAM(그래픽 카드의 메모리)이 충분한 GPU. 8 GB 카드라면 480p, 키프레임 1개로 첫 테스트를 할 수 있습니다.
3. 편집 가능한 `ltx-director-simple` 워크플로(또는 ComfyUI에서 끝까지 실행되는 동등한 LTX 2.3 이미지-투-비디오 그래프)와 그 API 형식 내보내기 파일인 `ltx-director-simple-api`.
4. 첫 프레임 삽화를 만들 Marinara의 이미지 계정.
5. **Agents → Agent Organizer**(에이전트 → Agent Organizer)에서 다운로드하고 **Chat Settings → Agents**(채팅 설정 → 에이전트)에서 해당 게임에 켠 **Storyboard** 에이전트. [스토리보드 에이전트 가이드](storyboard.md)를 참고하세요.

편집용 워크플로와 API 내보내기 파일은 서로 다른 파일입니다. ComfyUI에서 `ltx-director-simple`을 열고, ComfyUI Manager가 누락되었다고 알려 주는 사용자 지정 노드를 모두 설치한 다음, 그래프를 그 자리에서 테스트하세요. Marinara에는 `ltx-director-simple-api`를 가져오세요. 노드나 모델을 바꿀 때마다 그래프를 API 형식으로 다시 내보내고 Marinara 계정에 저장된 JSON을 교체하세요. 일반 비주얼 편집기용 워크플로를 Marinara에 붙여넣지 마세요.

## ComfyUI API 워크플로 준비하기

먼저 실제 원본 이미지와 간단한 프롬프트로 편집용 워크플로를 ComfyUI에서 큐에 넣으세요. 오디오가 포함된 MP4가 저장되는지 확인하세요.

간단한 Marinara 경로는 LTX Director의 전역 프롬프트 입력에 완성된 프롬프트 하나를 넣습니다.

```json
{
  "global_prompt": "%prompt%",
  "local_prompts": "",
  "segment_lengths": ""
}
```

LTX Director 노드는 여전히 이미지 컨디셔닝, 가이드 데이터, 오디오, 두 단계 샘플링을 처리할 수 있습니다. "간단하다"는 말은 Marinara가 Prompt Relay 타임라인 대신 앞뒤가 이어지는 이미지-투-비디오 문단 하나를 보낸다는 뜻입니다.

### 플레이스홀더

API 내보내기 파일에서 해당 값을 따옴표로 감싼 아래 Marinara 플레이스홀더로 바꾸세요.

| 플레이스홀더 | Marinara가 채우는 값 |
| --- | --- |
| `%prompt%` | Animation Planner와 동영상 템플릿이 만든 전체 프롬프트 |
| `%reference_image_name%` | ComfyUI에 업로드된 첫 프레임 이미지 |
| `%duration_seconds%` | 클립 길이(초) |
| `%length%` | Marinara의 기본값인 16 FPS 기준 프레임 수로 나타낸 길이 |
| `%fps%` | Marinara가 쓰는 프레임 레이트 |
| `%width%`, `%height%` | 동영상 계정의 해상도와 화면비에서 정해지는 크기 |
| `%seed%` | 요청마다 새로 뽑는 무작위 시드 |
| `%model%` | 워크플로가 로더 모델을 고정하지 않았을 때 계정에서 가져오는 선택적 모델 값 |

Marinara는 `%length_s%`, `%global_prompt%`, `%local_prompts%`, `%segment_lengths%`도 채울 수 있습니다. 이 4가지는 선택 사항입니다. 간단한 경로에는 필요 없으며, 프롬프트는 `%prompt%`로 보냅니다.

참조 이미지는 LTX Director `timeline_data`의 `segments` 배열 안에 들어가며, 이 `timeline_data`는 API 워크플로에서 직렬화된 JSON 문자열입니다. `%length%`는 `normalDurationFrames`를 통해 클립 길이를 동적으로 유지합니다. 0번 프레임의 참조 이미지 세그먼트는 자체 고정값 `"length":16`을 그대로 둡니다.

```json
{
  "timeline_data": "{\"global_prompt\":\"\",\"normalStartFrame\":0,\"normalDurationFrames\":%length%,\"segments\":[{\"id\":\"marinara-reference\",\"start\":0,\"length\":16,\"prompt\":\"\",\"type\":\"image\",\"imageFile\":\"%reference_image_name%\",\"isEndFrame\":false}],\"motionSegments\":[],\"audioSegments\":[]}"
}
```

- `%reference_image_name%`을 `timeline_data` 옆이나 별도의 최상위 이미지 필드에 두지 마세요.
- `%reference_image_name%` 같은 문자열 플레이스홀더는 따옴표로 감싼 채 두세요.
- Marinara가 숫자로 바꾸므로 숫자 노드 입력에서는 `%length%`, `%duration_seconds%`, `%fps%`를 따옴표로 감싸도 됩니다. 직렬화된 `timeline_data` 문자열 안에서는 디코딩된 값이 숫자가 되도록 위 예시처럼 `%length%`를 따옴표 없이 두세요.
- 프레임 수, 초, 프레임 레이트는 이 플레이스홀더에 연결해 두세요. 편집용 ComfyUI 그래프에 보이는 숫자는 Marinara의 기본값이 아닙니다.

### 수정할 때마다 다시 내보내기

1. ComfyUI에서 편집용 워크플로를 큐에 넣고 재생 가능한 MP4가 만들어지는지 확인하세요.
2. ComfyUI 버전에 따라 **Save (API Format)**(API 형식으로 저장), **Export (API)**, **Export to API** 중 하나를 선택하세요.
3. 새 API JSON에 플레이스홀더를 넣거나 들어 있는지 확인하세요.
4. Marinara 계정에 저장된 워크플로를 교체하세요.

노드를 지운 뒤에도 예전 내보내기 파일을 계속 쓰면 더는 없는 노드를 가리키는 참조가 남습니다. 그러면 ComfyUI가 요청을 거부합니다.

## 동영상 계정 만들기

1. **Settings → Connections**(설정 → 연결)를 여세요.
2. **Add account**(계정 추가)를 클릭하고 **Video Generation**(동영상 생성) 계정을 고르세요.
3. **ComfyUI**를 고르세요.
4. **Base URL**(기본 URL)을 입력하세요. ComfyUI가 같은 컴퓨터에서 돌아간다면 보통 `http://127.0.0.1:8188`입니다.
5. API 형식 워크플로 전체를 **ComfyUI workflow**(ComfyUI 워크플로)에 붙여넣으세요.
6. 저VRAM 첫 테스트에서는 기본 길이 6초, **16:9**, 480p를 고르세요.
7. 계정을 저장하세요.

텍스트만 쓰는 연결 테스트로는 `%reference_image_name%`을 확인할 수 없습니다. 저장한 뒤 Gallery 이미지나 스토리보드에서 이미지-투-비디오를 테스트하세요.

## Game Mode 채팅 설정하기

Game Mode 채팅을 연 다음 **Chat Settings → Agents**를 여세요. 먼저 **Enable Agents**(에이전트 활성화)와 **Enable Storyboards**(스토리보드 활성화)를 켜세요. 마법사의 Storyboard Optimized(스토리보드 최적화) 연출은 에이전트를 켜지 않습니다.

### Illustrator

| 설정 | 권장값 |
| --- | --- |
| **Game Illustrator**(게임 Illustrator) | On |
| **Image model**(이미지 연결) | **Krea 2** |
| **Image Style**(이미지 스타일) | **Z-Image Turbo Narrative** |
| **Use Campaign Art Style**(캠페인 아트 스타일 사용) | Off |
| **Attach Card Appearance**(카드 외형 첨부) | Off |
| **Send Avatar References**(아바타 참조 전송) | 여기서 테스트한 워크플로에서는 Off |

Animation Planner는 이미 그 턴의 캐릭터 외형 컨텍스트를 받으므로, 같은 정보가 두 번 들어가지 않도록 **Attach Card Appearance**는 꺼 둡니다. **Storyboard First Frame** 역시 플래너가 완성한 첫 프레임 장면 주위에 캠페인 아트 디렉션을 반복해서 덧붙이지 않습니다.

**Send Avatar References**는 첫 프레임을 만드는 이미지 서비스에 보낼 참조 이미지를 제어합니다. LTX의 첫 프레임 입력은 제어하지 않습니다. LTX는 완성된 삽화를 `%reference_image_name%`으로 받습니다. 아바타 참조는 이미지 계정이 이를 지원하고 실제로 도움이 되는지 확인한 뒤에만 켜세요.

첫 프레임은 애니메이션 품질을 크게 좌우합니다. 계획된 움직임 직전의 순간을 정확히 담아야 하고, 인물, 이동 경로, 손, 문, 소품, 목표물이 또렷하게 보여야 합니다.

### Scene Videos

| 설정 | 권장값 |
| --- | --- |
| **Video model**(비디오 연결) | 위에서 만든 LTX 2.3 ComfyUI 계정 |
| **Game Video Prompt**(게임 동영상 프롬프트) | **Narration Passthrough** |

**Game Video Prompt**는 수동으로 실행하는 Gallery와 Game Assets 애니메이션을 제어합니다. 스토리보드 클립은 그 설정을 바꾸지 않고 자체 프롬프트를 쓸 수 있습니다.

### Storyboards

| 설정 | 권장 시작값 |
| --- | --- |
| **Automatic Storyboard Illustrations**(자동 스토리보드 일러스트) | On |
| **Automatic Storyboard Animations**(자동 스토리보드 애니메이션) | On |
| **Use NovelAI Character Prompts**(NovelAI 캐릭터 프롬프트 사용) | Off |
| **Keyframes per Turn**(턴당 키프레임 수) | 보통은 3. 첫 8 GB VRAM 테스트는 1로 시작하세요. |
| **Animation Clip Duration**(애니메이션 클립 길이) | 5초 |
| **Viewer Display**(시청자 화면) | 테스트 중에는 Floating |
| **Illustration Planner**(일러스트 플래너) | **Still Keyframes**. 동영상이 없는 턴을 위한 대비책입니다 |
| **Animation Planner**(애니메이션 플래너) | **LTX Simple Image-to-Video** |
| **Use Storyboard Template**(스토리보드 템플릿 사용) | On |
| **Storyboard Illustration Prompt**(스토리보드 일러스트 프롬프트) | **Storyboard First Frame** |
| **Storyboard Video Prompt**(스토리보드 동영상 프롬프트) | **Narration Passthrough** |

- **LTX Simple Image-to-Video**가 권장 플래너입니다. 이 플래너는 애니메이션에 바로 쓸 수 있는 첫 프레임 1개와 4에서 8문장 분량의 직접적인 모션 프롬프트 1개를 계획합니다. 프롬프트에는 주된 동작 하나, 카메라 움직임 하나, 그 주위의 절제된 움직임, 그리고 상황에 맞는 오디오나 짧은 대사가 들어갑니다.
- **LTX Director Storyboard**는 길이를 고려한 더 자세한 연출과 연속성 규칙을 갖춘 고급 선택지입니다. 간단한 경로가 안정된 뒤에, 또는 긴 클립에 이어지는 단계가 더 필요할 때 써 보세요. 두 플래너 모두 같은 `%prompt%` 규약을 씁니다.
- 애니메이션이 켜져 있으면 **LTX Simple Image-to-Video**가 두 출력을 모두 씁니다. Krea에 보낼 `imagePrompt`와 LTX에 보낼 `narrationBeat`입니다. **Still Keyframes**는 동영상이 없는 턴에만 쓰입니다.
- **Storyboard First Frame**은 플래너가 쓴 자연어 첫 프레임 장면 전체를 Krea에 보냅니다. 키프레임 제목, 프롬프트 라벨, 반복되는 외형 메모, 캠페인 아트 디렉션은 붙이지 않습니다. 이 형식이 적용되도록 **Use Storyboard Template**은 켜 두세요.
- **Narration Passthrough**는 플래너가 완성한 `narrationBeat`를 장면 요약을 다시 붙이지 않고 동영상 프롬프트 규약으로 그대로 넘깁니다.

키프레임 1개마다 Krea 이미지 작업 1개와 로컬 LTX 동영상 작업 1개가 생기므로, 키프레임이 3개면 이미지 렌더링 3회와 동영상 렌더링 3회가 시작됩니다.

## 첫 테스트 실행하기

문 열기, 소리 나는 쪽 바라보기, 짧은 대사 한 마디처럼 눈에 잘 띄는 동작이 하나 들어 있는 완료된 GM 턴을 쓰세요.

1. 저VRAM에서 가장 빨리 확인하려면 **Keyframes per Turn**을 1로 설정하고 **Animation Clip Duration**은 5초로 두세요.
2. GM 턴이 끝난 뒤에 두 자동 스토리보드 설정을 켜세요.
3. **Chat Settings → Gallery**(채팅 설정 → 갤러리)를 열고 **Create storyboard**(스토리보드 만들기)를 선택하세요. 다음 턴을 기다리지 않고 삽화와 애니메이션 전체 경로가 시작됩니다.
4. 프롬프트 검토가 켜져 있다면 제출하기 전에 첫 프레임 프롬프트를 확인하세요.
5. 첫 프레임이 동작을 시작하기에 물리적으로 알맞은 자세인지 확인하세요.
6. 첫 프레임 렌더링을 기다린 다음 ComfyUI 클립을 기다리세요.
7. 수동 경로가 잘 동작하면 **Keyframes per Turn**을 다시 3으로 설정하고 두 자동 설정은 켜 둔 채로 두세요.

설정 중에는 이미지와 클립을 하나씩 살펴볼 수 있도록 **Floating** 뷰어를 쓰세요. 나중에 스토리보드 미디어를 Game 장면에 넣고 싶다면 **Background**로 바꾸세요.

동작하지 않았다면 [문제 해결](#troubleshooting)을 참고하세요.

## 프롬프트 전달 방식

Animation Planner는 키프레임마다 `imagePrompt`(시간 T=0에 보이는 첫 프레임만)와 `narrationBeat`(다음에 일어날 일을 담은 전체 LTX 프롬프트)를 돌려줍니다. **Storyboard First Frame**은 `imagePrompt`의 형식을 잡아 Krea 2에 보냅니다. 이미지가 만들어지면 **Narration Passthrough**가 `narrationBeat`로 풀립니다. Marinara는 그 값을 동영상 요청의 `prompt` 필드에 넣고, ComfyUI 워크플로의 `%prompt%`를 교체하고, 첫 프레임을 업로드한 뒤 `%reference_image_name%`을 ComfyUI 쪽 파일 이름으로 바꿉니다. 로컬 프롬프트 세그먼트를 2개 만들 필요는 없습니다. 전역 프롬프트 하나가 일반적인 경로입니다.

## 좋은 LTX 프롬프트 쓰기

원본 이미지에 이미 외형, 구도, 배경, 조명, 스타일이 담겨 있습니다. 동영상 프롬프트는 움직임을 다뤄야 합니다.

- 현재 시제로 쓴 매끄러운 한 문단.
- 클립 길이에 맞는, 초점이 뚜렷한 동작 하나.
- 인물을 기준으로 서술한 카메라 움직임.
- 시선, 표정, 자세, 호흡, 몸짓으로 드러나는 반응.
- 쓸모 있는 환경 움직임은 최대 하나.
- 상황에 맞을 때는 주변 소리, 효과음, 음악, 따옴표로 감싼 짧은 대사.
- 자연스러운 마무리, 잦아드는 움직임, 짧은 정지.

장면 전환, 컷, 순간 이동, 서로 무관한 여러 동작, 복잡한 물리 현상, 복잡하게 얽힌 동선, 정확히 읽혀야 하는 글자, 첫 프레임에 이미 보이는 세부 사항의 반복은 피하세요.

```text
She pushes the door open and walks outside as the camera follows closely behind her. A light breeze moves her hair while her pace remains steady. She glances toward the empty street and says, "Stay close." Footsteps and distant traffic continue as the camera settles behind her.
```

<a id="troubleshooting"></a>

## 문제 해결

### ComfyUI가 HTTP 400이나 "Prompt outputs failed validation"을 반환합니다

API 워크플로가 설치된 그래프와 맞지 않습니다. 삭제된 노드, 끊긴 노드 ID, 빠진 사용자 지정 노드, 노드 업데이트로 이름이 바뀐 입력, 더는 존재하지 않는 모델 파일 이름을 찾아보세요. 잘 동작하는 그래프에서 API 워크플로를 새로 내보내세요.

### 이미지는 만들어지는데 동영상이 안 만들어집니다

**Automatic Storyboard Animations**와 Game Mode의 **Video model**을 확인하세요. 애니메이션에는 첫 프레임 삽화와 선택된 동영상 계정이 둘 다 필요합니다.

### LTX가 시작 이미지를 받지 못합니다

저장된 API 워크플로에 `%reference_image_name%`이 들어 있고 그 값이 LTX Director 이미지 세그먼트로 들어가는지 확인하세요. Marinara는 그 플레이스홀더가 있을 때만 첫 프레임을 업로드합니다.

### 클립이 뭉개지거나 캐릭터가 바뀌거나 뒤죽박죽이 됩니다

**LTX Simple Image-to-Video**로 되돌리고, 키프레임 1개로 동작이 하나뿐인 턴을 테스트하세요. 이미지 한 장이 짧은 클립 안에서 여러 장소, 자세, 결말로 깔끔하게 바뀔 수는 없습니다. 첫 프레임도 확인하세요. 시작 자세가 헷갈리면 애니메이션이 더 어려워집니다.

### 생성 결과가 매번 너무 비슷합니다

하드코딩된 샘플링 시드를 모두 `%seed%`로 바꾸세요. 쓸 만한 결과가 나오면 프롬프트나 샘플링 변경을 비교하는 동안에만 워크플로에서 그 시드를 잠시 고정하세요.

### 생성 도중 메모리가 부족합니다

480p에서 시작하세요. 그다음 길이를 줄이세요. 테스트하는 동안에는 턴당 키프레임을 1개로 두고, GPU를 쓰는 다른 프로그램을 닫고, VRAM이 적은 같은 GPU에 로컬 언어 모델을 올려 두지 마세요. 양자화 체크포인트는 모델이 쓰는 메모리를 줄여 주지만, 동영상 latent, 텍스트 인코더, VAE, 오디오, 업스케일링이 쓰는 메모리는 줄여 주지 않습니다.

### Marinara는 기다리기를 멈췄는데 ComfyUI는 계속 렌더링합니다

브라우저 요청을 닫거나 접속이 끊기면 ComfyUI에 이미 큐로 들어간 작업은 취소되지 않은 채 Marinara의 폴링만 멈출 수 있습니다. 같은 렌더링을 다시 시작하기 전에 ComfyUI의 큐, 기록, 출력 폴더를 확인하세요.

### ComfyUI에서는 되는데 Marinara에서는 실패합니다

계정에 저장된 JSON을 가장 최근 API 내보내기 파일과 비교하세요. 기본 URL, 플레이스홀더 철자, 사용자 지정 노드, 모델 경로, 출력 노드, 크기, 길이 필드를 확인하세요. 편집용 그래프는 잘 돌아가는데 Marinara는 아직 예전에 내보낸 스냅샷을 들고 있을 수 있습니다.

서버 추적 기록을 보려면 디버그 로그를 켜고 `[debug/game/storyboard-video]`와 `[video-gen/comfyui]`를 찾아보세요. 정상적인 요청에는 완성된 전역 프롬프트, 업로드된 참조 이미지 파일 이름, 길이, 프레임 수, 큐에 등록된 ComfyUI 프롬프트 ID가 보입니다.

## 참고: LTX 2.3 모델

GPU 계열과, ComfyUI가 텍스트 인코더, VAE, 업스케일러를 올린 뒤 남는 메모리에 맞춰 모델 형식을 고르세요. 아래 값은 출발점일 뿐 보장이 아닙니다.

| GPU 계열 | 실용적인 출발점 | 비고 |
| --- | --- | --- |
| RTX 30 시리즈(Ampere) | INT8 ConvRot | 3070, 3080, 3090급 카드를 위한 저메모리 출발점입니다. |
| RTX 40 시리즈, 16-24 GB | FP8 input-scaled | Ada 하드웨어의 가속 FP8 경로를 사용합니다. |
| RTX 40 시리즈, 8-12 GB | FP8 오프로딩이 너무 느리면 INT8 ConvRot | 실제 워크플로에서 둘 다 비교해 보세요. |
| RTX 50 시리즈(Blackwell) | NVFP4 dev 워크플로 | NVFP4를 지원하는 ComfyUI, CUDA, 노드 구성이 필요합니다. |
| RTX 50, 기존 distilled 워크플로 | FP8 input-scaled | 공식 distilled NVFP4 체크포인트가 나오기 전까지 이 형식을 쓰세요. |

테스트를 마친 RTX 3080 워크플로는 `ltx-2.3-22b-distilled-1.1_transformer_only_int8_convrot.safetensors`를 사용합니다. 이 접미사들은 서로 다른 양자화 형식과 실행 경로를 나타내며, 언제든 바꿔 끼울 수 있는 품질 프리셋이 아닙니다. **Dev** 워크플로와 **distilled** 워크플로는 샘플링 전제가 다르므로, 워크플로를 고치지 않은 채 distilled 그래프에 dev 체크포인트를 넣지 마세요. 체크포인트가 메모리에 들어간다고 해서 더 길거나 해상도가 높은 동영상까지 들어간다는 보장은 없습니다.

공식 입문용 워크플로는 `ltx-2.3-22b-dev-fp8.safetensors`, `ltx-2.3-22b-distilled-lora-384.safetensors`, `gemma_3_12B_it_fp4_mixed.safetensors`, `ltx-2.3-spatial-upscaler-x2-1.1.safetensors`를 사용합니다. 직접 만든 워크플로는 다른 체크포인트, 양자화, 로더 노드, 폴더를 쓸 수 있습니다. API 워크플로에 저장된 파일 이름은 ComfyUI가 볼 수 있는 파일과 정확히 일치해야 합니다. 모델을 `LTX2/` 같은 다른 폴더에 둔다면 로더 값을 고치고 API 사본을 새로 내보내세요.

워크플로를 공유할 때는 GPU 모델과 VRAM, ComfyUI 버전, NVIDIA 드라이버, CUDA, PyTorch, Python 버전, 사용자 지정 노드와 그 버전, 모델 파일 이름과 폴더, 해상도, 길이, 키프레임 수, 렌더링 시간, 그리고 Krea 2를 로컬에서 돌렸는지 호스팅 서비스로 돌렸는지를 기록해 두세요.

공식 문서:

- [LTX 2.3 이미지-투-비디오 가이드](https://docs.ltx.io/open-source-model/usage-guides/image-to-video)
- [LTX 프롬프트 작성 가이드](https://docs.ltx.io/open-source-model/usage-guides/prompting-guide)
- [LTX 2.3 모델 카드](https://huggingface.co/Lightricks/LTX-2.3)
- [LTX 2.3 NVFP4 모델 카드](https://huggingface.co/Lightricks/LTX-2.3-nvfp4)
- [공식 LTX 2.3 ComfyUI 예제](https://github.com/Lightricks/ComfyUI-LTXVideo/tree/master/example_workflows/2.3)
- [커뮤니티의 ComfyUI용 분리 가중치와 FP8 가중치](https://huggingface.co/Kijai/LTX2.3_comfy)

## 관련 가이드

- [스토리보드 에이전트 가이드](storyboard.md)
- [ComfyUI 워크플로 설정](../media/comfyui.md)
- [장면 동영상 생성](../media/scene-video.md)
- [Game Mode: 시작하기](getting-started.md)
