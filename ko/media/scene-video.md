# 장면 동영상 생성

이 가이드에서는 Marinara Engine이 장면 일러스트를 짧은 MP4 동영상 클립으로 바꾸는 방법을 설명합니다. 동영상 제공자, **Gallery**(갤러리)에서 클립을 만드는 방법, Game Mode(게임 모드)의 조작, 동영상 설정을 다룹니다. 장면 동영상은 정지 이미지 한 장으로 만든 짧은 애니메이션 클립입니다.

## 장면 동영상이 하는 일

장면 동영상은 갤러리에 이미 있는 이미지를 짧은 MP4 클립으로 움직이게 만듭니다. 정지 이미지가 첫 프레임이 되고, AI가 움직임을 더합니다. 장면 동영상은 **Roleplay**(롤플레이)와 **Game Mode** 채팅에서 쓸 수 있습니다.

먼저 그림이 반드시 있어야 합니다. 장면 동영상 생성은 글만으로는 실행되지 않습니다. 움직이게 만들려면 갤러리 이미지를 먼저 생성하거나 업로드해야 합니다.

장면 동영상은 **Video Generation**(동영상 생성)이라는 별도의 연결 종류를 씁니다. 일반 이미지 생성과는 다릅니다. 완성된 클립은 채팅과 함께 저장되고 **Gallery**에 표시되며, 여기서 고정하거나 다운로드하거나 볼 수 있습니다.

## Video Generation 연결

장면 동영상을 만들려면 먼저 동영상을 생성할 수 있는 연결을 추가합니다. 채팅용, 이미지용 연결과 같은 **Connections**(연결) 패널을 씁니다.

1. **Settings**(설정)를 열고 **Connections**를 여세요.
2. **Add Connection**(연결 추가)을 클릭하세요.
3. 제공자 종류를 **Video Generation**으로 설정하세요.
4. **Video Service**(동영상 서비스) 항목에서 아래 여섯 가지 서비스 중 하나를 고르세요.
5. 클라우드 서비스라면 API 키를 입력하세요. 로컬 ComfyUI에는 필요 없습니다.
6. 클라우드 서비스는 모델을 고르거나 제공자 기본값을 그대로 두세요. ComfyUI는 워크플로가 `%model%`을 쓰지 않는 한 모델을 비워 두세요.
7. 연결을 저장하세요.

**Video Service** 선택기에는 여섯 가지 항목이 있습니다. 각 항목은 기본 웹 주소를 채워 넣고, 해당하는 경우 기본 모델도 채웁니다.

| Video Service | 기본 모델 | 비고 |
| -------------------- | --------------------------------- | ---------------------------------------------------------------------------- |
| **Google AI Studio** | `gemini-omni-flash-preview` | Gemini API를 통해 Gemini Omni와 Veo 동영상 모델을 실행합니다. |
| **xAI Imagine** | `grok-imagine-video-1.5` | xAI Videos API를 통한 Grok Imagine 동영상입니다. |
| **OpenRouter Video** | `google/veo-3.1` | OpenRouter를 통한 동영상 모델입니다. OpenRouter의 동영상 모델 ID라면 무엇이든 직접 입력할 수 있습니다. |
| **Atlas Cloud** | `google/veo3.1/text-to-video` | Atlas Cloud에서 호스팅하는 텍스트-동영상 및 이미지-동영상 모델입니다. |
| **Seedance 2.0** | `seedance-2-0` | 텍스트, 첫 프레임, 첫 프레임과 마지막 프레임 방식의 동영상 모드를 지원합니다. |
| **ComfyUI** | 워크플로에서 지정 | API 형식으로 내보낸 로컬 WAN 및 기타 동영상 워크플로입니다. |

**Google AI Studio**는 두 가지 모델 계열을 다룹니다. **Gemini Omni**는 `gemini-omni-flash-preview`를 씁니다. **Google Veo**는 `veo-3.1-generate-preview`를 씁니다. 둘 중 무엇이 실행되는지는 연결에서 고른 모델에 따라 달라집니다.

**ComfyUI**는 보통 로컬 주소 `http://127.0.0.1:8188`을 쓰고, API 형식의 동영상 워크플로를 **ComfyUI Workflow**(ComfyUI 워크플로)에 붙여넣습니다. 워크플로는 필수입니다. 플레이스홀더와 출력 노드 요건은 [ComfyUI 워크플로 설정](comfyui.md#comfyui-video-workflows)을 참고하세요.

### 기본 동영상 연결로 지정하기

Video Generation 연결의 연결 편집기에는 **Default for Videos**(동영상 기본값) 그룹이 있습니다. **Use as default video connection**(기본 동영상 연결로 사용)을 켜면 채팅에 자체 동영상 연결이 없을 때 Marinara가 이 연결을 씁니다. 기본 동영상 연결은 하나만 지정하세요.

### 연결별 동영상 기본값

Video Generation 연결에는 연결 편집기 안에 **Video Generation Defaults**(동영상 생성 기본값) 패널이 따로 있습니다. 여기서 그 연결의 기본 클립 길이, 화면 비율, 해상도를 설정합니다. 이 연결별 기본값은 앱 전체의 대체 길이보다 우선합니다.

| 서비스 | 기본 길이 | 길이 범위 | 화면 비율 | 해상도 |
| ---------------- | -------------- | ------------ | ------------ | ---------------- |
| Gemini Omni | 10s | 1에서 60s까지 | 16:9 | 제공자 기본값 |
| Google Veo | 8s | 4, 6, 8s | 16:9 | 720p |
| xAI Imagine | 10s | 1에서 15s까지 | 16:9 | 720p |
| OpenRouter Video | 10s | 1에서 60s까지 | 16:9 | 720p |
| Atlas Cloud | 8s | 1에서 60s까지 | 16:9 | 720p |
| Seedance 2.0 | 5s | 4에서 15s까지 | 16:9 | 720p |
| ComfyUI | 5s | 1에서 60s까지 | 16:9 | 720p |

Gemini Omni에는 해상도 항목이 없고, 길이도 별도 설정이 아니라 프롬프트 글 안에 적힙니다. Google Veo는 참조 이미지를 움직이게 만들 때 항상 8초로 고정합니다. 첫 프레임과 마지막 프레임을 자연스럽게 잇는 데 8초가 필요하기 때문입니다.

### Seedance 참조 프레임

Seedance는 참조 이미지를 움직이게 만들기 전에 공개된 웹 링크로 그 이미지를 가져와야 합니다. 로컬 Marinara 서버에는 공개 링크가 없으므로, 순수 로컬 환경에서는 한 단계가 더 필요합니다.

Seedance 연결을 열고 **Upload Seedance reference frames temporarily**(Seedance 참조 프레임 임시 업로드)를 켜세요. 그러면 참조 프레임이 임시 공개 링크로 업로드되어 Seedance가 읽을 수 있게 됩니다. 링크가 유지되는 시간은 **Temporary link lifetime**(임시 링크 유효 기간)에서 고를 수 있고, 기본값은 12시간입니다.

Marinara 서버에 이미 공개 웹 주소가 있다면 임시 업로드 대신 환경 변수를 설정해도 됩니다. 동영상 참조 관련 설정은 [서버 설정 참고 문서](../CONFIGURATION.md)를 확인하세요.

## 제공자 고르기

여섯 가지 서비스 모두 이미지로 짧은 클립을 만듭니다. 차이는 속도, 클립 길이, 참조 이미지를 다루는 방식에 있습니다.

- **Google AI Studio (Gemini Omni)**: 최대 60초까지 길이를 자유롭게 정할 수 있습니다. 길이는 별도 컨트롤이 아니라 프롬프트 안에 들어갑니다.
- **Google AI Studio (Veo)**: 품질이 뛰어나지만 길이는 4초, 6초, 8초로 고정입니다. 이미지를 움직이게 만들 때는 8초를 씁니다.
- **xAI Imagine**: 1초에서 15초까지의 클립을 만듭니다. 프롬프트 길이 제한이 다른 서비스보다 짧습니다.
- **OpenRouter Video**: 1초에서 60초까지 지원하며, OpenRouter 계정에서 쓸 수 있는 동영상 모델이라면 무엇이든 직접 입력할 수 있습니다.
- **Atlas Cloud**: **Fetch Models**(모델 가져오기)는 Atlas Cloud의 최신 동영상 모델 목록을 불러옵니다. 이미지-동영상 모델이 먼저 표시되며, 각 모델의 출력 동영상 1초당 시작 가격도 보여 줍니다. 목록에 접근할 수 없으면 Veo 3.1과 Seedance 2.0 기본 모델을 대신 표시합니다. Atlas Cloud 동영상 모델의 정확한 ID를 입력할 수도 있으며, 모델별 길이, 해상도, 참조 이미지 제한은 그대로 적용됩니다.
- **Seedance 2.0**: 4초에서 15초까지의 클립을 만들고, 첫 프레임 방식과 첫 프레임과 마지막 프레임 방식을 지원합니다. 참조 이미지에 접근할 공개 링크가 필요합니다.
- **ComfyUI**: 직접 만든 API 형식 워크플로로 로컬에서 생성합니다. 워크플로가 `%reference_image_name%`을 쓰면 Marinara가 참조 이미지를 ComfyUI에 바로 업로드합니다.

동영상 작업은 시간이 걸린다고 생각하세요. 제공자가 작업을 시작하면 Marinara는 클립이 완성될 때까지 기다리면서 상태를 확인합니다. 클립 하나에 몇 분이 걸릴 수 있어 정지 이미지보다 오래 걸립니다. 용량이 큰 로컬 WAN 모델은 기본값인 30분을 넘길 수도 있습니다. 그럴 때는 `VIDEO_GEN_TIMEOUT_MS` 값을 늘리고 Marinara를 다시 시작하세요.

### Atlas Cloud 모델 간 차이

Atlas Cloud 모델이 모두 같은 설정을 지원하는 것은 아닙니다. Marinara는 요청할 때마다 `static.atlascloud.ai`에서 모델이 공개한 입력 스키마를 읽고 연결의 기본 설정을 이에 맞춥니다.

- 원본 일러스트는 해당 모델이 사용하는 이미지 필드로 전송됩니다.
- 클립 길이는 모델이 지원하는 값 중 가장 가까운 값으로 바뀝니다. 5초 또는 10초만 지원하는 모델에서는 기본값 8초가 10초로 바뀝니다.
- 해상도는 지원하는 단계 중 가장 가까운 값으로 바뀝니다. 픽셀 크기를 받는 모델에는 선택한 화면비와 해상도에 가장 가까운 `width*height`가 전달됩니다.
- 모델에 없는 설정은 생략하여 모델 자체의 기본값이 적용되도록 합니다.

서버 로그는 `[video-gen/atlas-cloud] fitted request`로 시작하는 줄에 변경된 값을 모두 기록합니다. 스키마를 읽을 수 없으면 Marinara는 이전과 같은 일반 요청을 전송합니다.

장면 동영상에는 **image-to-video**(이미지-동영상) 모델을 선택하세요. 텍스트-동영상 모델에는 이미지 필드가 없으므로 일러스트를 무시하고 프롬프트만으로 별도의 클립을 만듭니다. 이 경우 서버 로그에도 표시됩니다.

선택한 Atlas Cloud 모델에 이미지가 필수라면 **Test Video**(동영상 테스트)는 단순한 그라데이션을 첫 프레임으로 보냅니다. 따라서 이미지-동영상 모델도 연결 테스트를 통과할 수 있습니다.

### Atlas Cloud 모델 옵션

많은 Atlas Cloud 모델에는 `negative_prompt`, `seed`, `generate_audio`, `shot_type`, `enable_prompt_expansion`이나 LoRA 목록 같은 자체 입력이 있습니다. 연결 편집기는 선택한 모델의 입력을 표시합니다.

1. Atlas Cloud 연결을 열고 모델을 선택하거나 입력합니다.
2. **Video Defaults**(동영상 기본 설정)를 펼친 다음 **Atlas Cloud setup**(Atlas Cloud 설정)을 펼칩니다.
3. 클립 길이, 화면비, 해상도 아래의 **Model options**(모델 옵션)를 찾습니다.

**Model options** 위쪽에는 모델이 지원하는 클립 길이, 해상도, 프레임 크기, 화면비가 표시됩니다. 텍스트-동영상 모델은 갤러리 이미지를 사용할 수 없으므로 이곳에 경고도 표시합니다.

각 옵션은 Atlas Cloud에서 사용하는 이름과 설명을 그대로 보여 줍니다. 모든 옵션은 **Model default**(모델 기본값)로 시작하며, 제공업체의 기본값은 괄호 안에 표시됩니다. **Model default**로 남겨 둔 옵션은 전송하지 않으므로 Atlas Cloud가 결정합니다. 옵션을 변경하면 이 연결로 만드는 모든 동영상에 해당 값이 전송되며 **Test Video**에도 적용됩니다. LoRA 같은 목록 및 객체 입력에는 JSON을 사용합니다.

선택한 값은 모델별로 저장됩니다. 다른 모델로 바꿨다가 돌아와도 각 모델의 옵션은 유지됩니다. **Reset model options**(모델 옵션 초기화)는 현재 모델의 선택값을 지웁니다. 변경 내용을 유지하려면 연결에서 **Save**(저장)를 클릭하세요.

Atlas Cloud가 모델의 입력을 변경하는 등의 이유로 저장된 옵션이 더 이상 맞지 않으면 Marinara는 요청에서 해당 옵션을 생략하고 `[video-gen/atlas-cloud] fitted request` 로그 줄에 그 이름을 기록합니다.

## Gallery에서 동영상 만들기

**Roleplay**와 **Game Mode** 채팅 모두 **Gallery** 패널에서 장면 동영상을 만들 수 있습니다. 채팅의 이미지 아이콘이나 갤러리 아이콘으로 패널을 여세요. Game Mode 채팅에는 이 작업을 할 수 있는 곳이 하나 더 있는데, 이 가이드 뒷부분에서 다루는 **Game Assets**(게임 에셋) 패널입니다.

**Gallery**에는 **Images**(이미지) 탭과 **Videos**(동영상) 탭이 있고, 각각 개수가 표시됩니다. 정지 그림은 **Images**에, 완성된 클립은 **Videos**에 들어갑니다.

가장 최근 그림을 움직이게 만들려면 다음과 같이 하세요.

1. **Images** 탭에 그림이 하나 이상 있는지 확인하세요. 없으면 **Illustrate**(이미지 생성)를 쓰거나 그림을 업로드하세요.
2. **Gallery** 위쪽 동작 줄에서 **Video**(비디오)를 클릭하세요.
3. **Settings**, **Generations**(생성), **Overall Generations**(전체 생성)에서 **Expose media prompts before sending**(전송 전에 미디어 프롬프트 표시)을 켜 두었다면, 완성된 애니메이션 프롬프트를 확인하거나 수정한 뒤 **Generate**(생성)를 클릭하세요. 이 창을 취소하면 제공자에게 요청이 가지 않습니다.
4. 버튼이 **Generating...**으로 바뀌고, 동영상 생성이 진행 중이라는 배너가 표시됩니다.
5. 완료되면 클립이 **Videos** 탭에 나타납니다.

가장 최근 그림이 아니라 특정 그림을 움직이게 만들려면 다음과 같이 하세요.

1. **Images** 탭을 여세요.
2. 원하는 그림 위에 마우스를 올리세요.
3. 마우스를 올렸을 때 나타나는 조작 중 **Animate illustration**(삽화 애니메이션 만들기) 버튼(필름 아이콘)을 클릭하세요.

프롬프트 확인 기능을 켜 두면 **Animate illustration**에서도 같은 **Review Video Prompt** 창이 나타납니다. 이 창에는 서버가 완성한 프롬프트와 길이, 화면 비율, 해상도가 그대로 표시됩니다. 선택한 이미지에 실제로 쓰이는 값입니다. 여기서 수정한 내용은 그 생성 한 번에만 적용됩니다. Roleplay에서 이 프롬프트를 만들어 내는 재사용 지시문은 **Settings**, **Generations**, **Video Generation Prompt Overrides**(동영상 생성 프롬프트 재정의)의 **Roleplay Gallery Animation Director**에서 따로 관리합니다.

**Videos** 탭에서는 각 클립이 그 자리에서 재생되고 길이와 모델 이름이 함께 표시됩니다. **Pin video to chat**(비디오를 채팅에 고정)으로 클립을 채팅에 고정하거나 **Download scene video**(장면 비디오 다운로드)로 저장할 수 있습니다. 클립이 하나도 없으면 탭에 **No videos yet**이라고 표시됩니다.

채팅에 그림이 없는 상태에서 동영상을 만들려고 하면 Marinara가 다음 메시지를 표시합니다. "Add or generate a gallery image before generating a scene video." 그림을 먼저 생성하거나 업로드한 뒤 다시 시도하세요.

## Game Mode의 장면 동영상

Game Mode에는 장면 동영상을 만들 수 있는 곳이 하나 더 있습니다. 바로 **Game Assets** 패널입니다. 게임 조작에 있는 **Game Assets** 버튼으로 여세요.

1. **Game Assets** 패널을 여세요.
2. **Generate video**(영상 생성)를 클릭하세요. 툴팁에는 "Generate a scene video from the latest illustration."이라고 표시됩니다.
3. 준비가 끝나면 가장 최근 클립이 패널에서 재생됩니다.

**Generate video** 버튼은 게임에 동영상 연결과 장면 일러스트가 모두 갖춰질 때까지 비활성 상태입니다. 너무 일찍 클릭하면 다음 메시지 중 하나가 표시될 수 있습니다.

- "Choose a Video Generation connection in Game Settings first." 게임에 쓸 동영상 연결을 설정하세요.
- "Generate a scene illustration before generating a scene video." 그림을 먼저 만드세요.

클립 생성이 실패하면 패널에 "Scene video generation failed."가 표시됩니다. 다시 시도하고, 계속 실패한다면 연결과 API 키를 확인하세요.

## 채팅에 쓸 동영상 연결 고르기

채팅마다 쓸 동영상 연결을 따로 정합니다. **Chat Settings**(채팅 설정), **Agents**(에이전트), **Scene Videos**(장면 비디오) 순서로 들어가서 설정하세요.

**Roleplay** 채팅에는 "Generate manual MP4 scene videos from gallery images."라고 설명된 **Scene Videos** 카드가 표시됩니다. 컨트롤은 **Video Connection**(비디오 연결) 드롭다운 하나뿐입니다. 여기서 Video Generation 연결을 고르세요.

**Game Mode** 채팅에는 "Generate MP4 scene videos from game illustrations."라고 설명된 **Scene Videos** 카드가 표시됩니다. 컨트롤이 더 많습니다.

- **Video Connection**: 이 게임이 쓸 Video Generation 연결입니다.
- **Game Video Prompt**(게임 동영상 프롬프트): 그림을 어떻게 움직이게 만들지 결정하는 프롬프트 틀입니다. 내장 기본값은 **Cinematic Scene Video**입니다.
- **Edit Video Presets**: 이 채팅에서 쓸 동영상 프롬프트 틀의 사본을 직접 추가하고 편집합니다.

Game Mode에서 **Gallery**와 **Game Assets**의 수동 동영상은 계속 **Game Video Prompt**가 관리합니다. Roleplay의 **Gallery** 애니메이션은 대신 **Roleplay Gallery Animation Director**를 씁니다. 설치한 Storyboard 에이전트는 자체 기본값으로 별도의 **Storyboard Video Prompt**(스토리보드 동영상 프롬프트)를 가지고 있으며, Roleplay 채팅과 Game 채팅마다 **Chat Settings > Agents > Storyboards**에서 이 값을 덮어쓸 수 있습니다. 이 선택을 초기화하면 Storyboard 에이전트의 기본값으로 돌아가며, 다른 채팅의 프롬프트를 물려받지는 않습니다.

Game Mode 채팅을 처음 만들 때는 설정 마법사에도 **Video Generation Connection**(비디오 생성 연결) 선택기가 있습니다. **Features** 단계에 있으며, **Visual Generation**을 켜야 나타납니다.

채팅에 자체 동영상 연결이 없으면 Marinara는 **Use as default video connection**으로 표시해 둔 연결을 대신 씁니다. 채팅 연결도 기본 연결도 없으면 동영상 동작을 할 때 연결을 고르라는 경고가 표시됩니다.

## 동영상 생성 설정

일부 동영상 기본값은 연결이 아니라 앱 설정에 있습니다. **Settings**, **Generations**, **Video Generation** 순서로 여세요. 이 항목의 설명은 "Set default clip lengths and edit reusable video prompts for Game, Gallery, and Calls."입니다.

여기서 장면 동영상과 직접 관련된 설정은 **Scene video fallback length**(장면 동영상 폴백 길이)이며, 기본값은 10초입니다. 선택한 동영상 연결에 자체 길이가 없을 때만 쓰입니다. 1초에서 60초까지 설정할 수 있습니다.

이 항목에는 **Video Generation Prompt Overrides**도 있어서 재사용하는 동영상 프롬프트 틀을 편집할 수 있습니다. **Roleplay Gallery Animation Director**는 Roleplay의 **Gallery** 클립을 생성하기 전에 선택한 Prompt Model로 보내는 지시문을 관리합니다. 이 지시문의 `${durationSeconds}` 변수는 선택한 클립 길이로 바뀝니다. 코드를 건드리지 않고 클립의 움직임을 바꾸는 고급 방법입니다.

같은 항목에는 **Animated expression length**(애니메이션 표정 길이) 설정도 있습니다. 이 설정은 애니메이션 표정 스프라이트라는 별개의 기능에 속합니다. 자세한 내용은 [애니메이션 표정](animated-expressions.md)을 참고하세요.

## 스토리보드

다운로드해서 쓰는 Storyboard 에이전트는 Roleplay와 Game Mode에서 순서가 정해진 키프레임 이미지와 클립을 만들 수 있습니다. Game Mode는 완료된 게임 마스터(GM) 턴 하나를 쓰고, Roleplay는 완료된 대화를 모아 본문 안에 에피소드로 엮습니다. 애니메이션을 켜 두면 Marinara는 골라 둔 동영상 연결과 에이전트의 **Storyboard Video Prompt**를 써서 성공한 키프레임을 하나씩 움직이게 만듭니다.

스토리보드에는 전용 컨트롤과 전용 가이드가 있습니다. 설치 방법과 두 모드의 사용 흐름은 [스토리보드 에이전트 가이드](../game/storyboard.md)를 참고하세요.

## 문제 해결

### "Choose a Video Generation connection"

채팅에 동영상 연결이 선택되어 있지 않습니다. **Chat Settings**, **Agents**, **Scene Videos** 순서로 열고 연결을 고르세요. 드롭다운이 비어 있다면 **Settings**, **Connections**에서 연결을 하나 추가하세요.

### "Add or generate a gallery image before generating a scene video"

장면 동영상은 언제나 이미 있는 그림을 움직이게 만듭니다. **Illustrate**를 쓰거나, 그림을 업로드하거나, 이미 가진 그림에서 **Animate illustration**을 클릭하세요.

### 동영상 생성이 오래 걸립니다

정상입니다. 제공자가 작업을 시작하면 Marinara는 클립이 완성될 때까지 기다리면서 상태를 확인합니다. Veo, xAI, OpenRouter, Atlas Cloud, Seedance 모두 이런 방식으로 동작하며, 클립 하나에 몇 분이 걸릴 수 있습니다.

### Seedance가 참조 이미지를 읽지 못합니다

Seedance에는 그림에 접근할 공개 링크가 필요합니다. 로컬 서버라면 Seedance 연결을 열고 **Upload Seedance reference frames temporarily**를 켜세요. 위의 Seedance 항목을 참고하세요.

### 동영상 요청이 계속 실패합니다

연결에 유효한 API 키가 들어 있는지, 계정에 동영상 사용 권한이 있는지 확인하세요. **Settings**, **Connections**에서 연결을 열고 키와 모델을 확인하세요. 서버 쪽 동영상 시간 초과는 [서버 설정 참고 문서](../CONFIGURATION.md)에서 다룹니다.

## 관련 가이드

- [애니메이션 표정](animated-expressions.md)
- [스토리보드 에이전트 가이드](../game/storyboard.md)
- [Game Mode의 LTX 2.3 스토리보드](../game/ltx-2-3-storyboards.md)
- [지원하는 AI 제공자](../connections/providers-reference.md)
- [서버 설정 참고 문서](../CONFIGURATION.md)
