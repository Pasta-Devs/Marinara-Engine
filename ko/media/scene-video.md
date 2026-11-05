# 장면 동영상 생성

장면 동영상은 장면을 담은 짧은 MP4 클립입니다. Gallery(갤러리) 그림을 첫 프레임으로 삼고 AI가 동작을 더해 그 그림을 움직이게 만들 수 있습니다. Roleplay(롤플레이)에서는 이야기만으로 만들 수도 있습니다. 이 가이드에서는 동영상 서비스를 설정하고, Gallery와 Game Mode(게임 모드)에서 클립을 만들고, 동영상 설정을 바꾸는 방법을 설명합니다.

장면 동영상은 Roleplay와 Game Mode 채팅에서 쓸 수 있습니다. Conversation(대화) 채팅에서는 대신 동영상 메시지를 보냅니다. [동영상 메시지](../conversation/selfies.md#video-messages)를 참고하세요.

Game Mode와 **Animate illustration**(삽화 애니메이션 만들기)은 항상 그림에서 시작하므로 먼저 그림을 생성하거나 업로드하세요. Roleplay에서 `/video`와 Gallery의 **Video**(비디오) 버튼은 Illustrator의 **First frame**(첫 프레임) 설정을 따릅니다. First frame을 고르지 않으면 그림이 필요 없습니다.

장면 동영상은 일반 이미지 생성이 아니라 **Video Generation**(동영상 생성)이라는 별도 종류의 계정을 씁니다. 완성된 클립은 채팅과 함께 저장되고 Gallery에 표시되며, 거기서 고정하거나 다운로드하거나 볼 수 있습니다.

## 동영상 서비스 설정하기

1. 상단 바에서 **Connections**(연결)를 클릭한 다음 **Add**(추가)를 클릭하세요. **Add account**(계정 추가) 창이 열립니다.
2. **Images & video**(이미지 및 동영상) 섹션에서 서비스를 고르세요. 서비스 목록은 아래에 있습니다.
3. 클라우드 서비스라면 API 키를 붙여넣으세요. 로컬 ComfyUI에는 필요 없습니다. SwarmUI는 서버에 계정이 필요한 경우에만 Swarm Auth Token이 필요합니다.
4. **Connect**(연결)를 클릭한 다음 모델을 고르거나 기본값을 그대로 두세요. NanoGPT에는 기본값이 없으므로 목록에서 하나를 고르세요. ComfyUI는 워크플로가 `%model%`을 쓰지 않는 한 모델을 비워 두세요. SwarmUI에서는 모델이 선택 사항입니다.
5. 동영상 모델을 열고 **Test video**(영상 테스트)를 클릭해 확인하세요.

서비스마다 기본 주소를 채우고, 해당하는 경우 기본 모델도 채웁니다. NanoGPT에는 기본 모델이 없으므로 하나를 고르세요.

| 동영상 서비스 | 기본 모델 | 비고 |
| --- | --- | --- |
| **Google AI Studio** | `gemini-omni-flash-preview` | Gemini API를 통해 Gemini Omni와 Veo 모델을 실행합니다. |
| **xAI Imagine** | `grok-imagine-video-1.5` | xAI Videos API를 통한 Grok Imagine 동영상입니다. |
| **OpenRouter Video** | `google/veo-3.1` | OpenRouter의 동영상 모델 ID라면 무엇이든 입력할 수 있습니다. |
| **NanoGPT** | 없음, 직접 선택 | NanoGPT를 통한 동영상 모델입니다. |
| **Atlas Cloud** | `google/veo3.1/text-to-video` | 호스팅되는 텍스트-동영상 및 이미지-동영상 모델입니다. |
| **Seedance 2.0** | `seedance-2-0` | 텍스트, 첫 프레임, 첫 프레임과 마지막 프레임 모드를 지원합니다. |
| **ComfyUI** | 워크플로에서 지정 | API 형식의 로컬 WAN 및 기타 동영상 워크플로입니다. |
| **SwarmUI** | 워크플로에서 지정 | SwarmUI 서버를 통한 ComfyUI 동영상 워크플로입니다. |

**Google AI Studio**는 두 가지 계열을 다룹니다. **Gemini Omni**는 `gemini-omni-flash-preview`를 씁니다. **Google Veo**는 `veo-3.1-generate-preview`를 씁니다. 어느 쪽이 실행되는지는 고른 모델에 따라 정해집니다.

**ComfyUI**는 `http://127.0.0.1:8188`을 쓰고, API 형식의 동영상 워크플로를 **ComfyUI workflow (required)**(ComfyUI 워크플로, 필수)에 붙여넣으세요. 워크플로는 필수입니다. 플레이스홀더와 출력 노드는 [ComfyUI 워크플로 설정](comfyui.md#comfyui-video-workflows)을 참고하세요.

**SwarmUI**를 고르면 Marinara가 `http://127.0.0.1:7801`을 채웁니다. API 형식의 동영상 워크플로를 **ComfyUI workflow (required)**에 붙여넣으세요. 워크플로는 필수입니다. SwarmUI는 `%reference_image_name%` 플레이스홀더를 쓸 수 없으므로 `%reference_image%`를 쓰세요. 서버에 계정이 필요하다면 **API key**(API 키)에 Swarm Auth Token을 붙여넣으세요.

### 기본 동영상 모델로 지정하기

채팅에 자체 동영상 모델이 없을 때 쓸 모델을 정하려면 **Connections** 패널 맨 위의 **Defaults**(기본값) 아래에서 **Video** 작업을 설정하세요. Chat Settings(채팅 설정)에는 이 값이 **Default video provider**(기본 동영상 연결)로 표시됩니다. 채팅 모델도 기본값도 없으면 동영상 동작을 할 때 모델을 고르라는 경고가 표시됩니다.

### 동영상 프롬프트 지시문

동영상 모델마다 **Video prompting instructions**(동영상 프롬프트 지시문) 상자가 있습니다. 카메라 움직임, 프롬프트 길이, 소리처럼 내 동영상 모델이 기대하는 내용을 동영상 프롬프트를 쓰는 AI에게 알려 주세요. 이 지시문은 Roleplay Gallery 애니메이션, Conversation 동영상 메시지, Storyboard의 **Image-aware shot planning**(이미지 인식 샷 기획)에 적용됩니다. AI가 지시문의 문장 하나를 통째로 프롬프트에 옮겨 쓰면 Marinara가 그 문장을 지웁니다. Game Mode 장면 동영상, 통화 클립, 애니메이션 표정은 프롬프트를 따로 쓰므로 이 지시문을 무시합니다.

### 모델별 동영상 기본값

동영상 모델에는 기본 클립 길이, 화면 비율, 해상도를 정하는 **Video defaults**(동영상 기본값) 패널이 있습니다. 이 값은 앱 전체의 폴백 길이보다 우선합니다.

서비스별 기본 길이, 범위, 화면 비율, 해상도는 다음과 같습니다.

- Gemini Omni: 10초, 1초에서 60초, 16:9, 제공자 기본 해상도.
- Google Veo: 8초, 4초·6초·8초, 16:9, 720p.
- xAI Imagine: 10초, 1초에서 15초, 16:9, 720p.
- OpenRouter Video: 10초, 1초에서 60초, 16:9, 720p.
- Atlas Cloud: 8초, 1초에서 60초, 16:9, 720p.
- Seedance 2.0: 5초, 4초에서 15초, 16:9, 720p.
- ComfyUI와 SwarmUI: 5초, 1초에서 60초, 16:9, 720p.

Gemini Omni에는 해상도 항목이 없고, 길이는 프롬프트 글에 들어갑니다. Google Veo는 참조 이미지를 움직이게 만들 때 항상 8초로 고정합니다. 첫 프레임과 마지막 프레임을 자연스럽게 잇는 데 8초가 필요하기 때문입니다.

<a id="seedance-reference-frames"></a>

### Seedance 참조 프레임

Seedance는 참조 이미지를 공개 웹 링크로 가져와야 합니다. 로컬 Marinara 서버에는 공개 링크가 없으므로, 순수 로컬 환경에서는 한 단계가 더 필요합니다.

1. Seedance 모델을 여세요.
2. **Upload Seedance reference frames temporarily**(Seedance 참조 프레임 임시 업로드)를 켜세요. 프레임이 임시 공개 링크로 올라갑니다.
3. 선택 사항: **Temporary link lifetime**(임시 링크 유효 기간)을 설정하세요. 기본값은 12시간입니다.

Marinara 서버에 이미 공개 주소가 있다면 대신 환경 변수를 설정해도 됩니다. [서버 설정 참고 문서](../CONFIGURATION.md)를 참고하세요.

## Gallery에서 동영상 만들기

Roleplay와 Game Mode 채팅은 Gallery에서 장면 동영상을 만들 수 있습니다. **Chat Settings**를 열고 **Gallery**를 펼치세요. Gallery에는 **Images**(이미지) 탭과 **Videos**(동영상) 탭이 있고, 각각 개수가 표시됩니다.

### Roleplay에서

Gallery 위쪽 동작 줄의 **Video**는 `/video`와 마찬가지로 가장 최근 답변의 클립을 만듭니다. 클립에 무엇을 보여 줄지 정하려면 `/video` 뒤에 설명을 덧붙이세요.

- **First frame**: Illustrator의 **First frame** 설정을 따릅니다. 가장 최근 답변을 그린 새 Illustrator 그림(먼저 그린 다음 움직이게 만듭니다), 캐릭터의 아바타나 스프라이트, 또는 그림 없음 중 하나입니다. 아무것도 고르지 않으면 이야기만으로 클립을 만듭니다.
- **아바타**: 클립은 페르소나를 포함해 설명에서 처음 이름이 나온 사람에서 시작합니다. 다른 사람과 겹치지 않는 이름 일부를 대문자로 시작해 적으면 충분합니다("Dr. Lena Kowalski"의 "Lena"처럼). 아무도 이름을 대지 않으면 채팅의 캐릭터에서 시작합니다.
- **검토**: **Expose media prompts before sending**(전송 전에 미디어 프롬프트 표시)이 켜져 있으면 클립의 프롬프트를 먼저 검토하고 수정할 수 있습니다.
- **맥락**: AI는 Illustrator가 그림을 만들 때와 같은 수의 최근 메시지를 읽습니다(Illustrator 설정 화면의 **Agent Budget**(에이전트 예산) 아래에 있는 Illustrator의 **Context Size**(컨텍스트 크기)).
- **그림 없음**: 그림 없이 또는 아바타에서 시작하는 클립은 AI가 장면을 직접 묘사합니다. 그 지시문은 **Settings → Generations → Video Generation Prompt Overrides**(설정 → 생성 → 동영상 생성 프롬프트 재정의) 아래의 **Roleplay Clip Director**입니다.

완성된 클립은 그림이 더 이전 답변에서 나왔더라도 가장 최근 답변 아래에서 바로 재생됩니다. 클립이 저절로 떠 있는 창으로 열리지는 않습니다. 떠 있는 창으로 띄우려면 **Videos**에서 **Pin video to chat**(비디오를 채팅에 고정)을 쓰세요. 메시지에서 클립을 없애려면 클립의 **X** 버튼을 누르세요. 클립은 Gallery에 남습니다.

### Game Mode에서

1. **Images**에 그림이 하나 이상 있는지 확인하세요. **Illustrate**(이미지 생성)를 쓰거나 그림을 업로드하세요.
2. Gallery 위쪽 동작 줄에서 **Video**를 클릭하세요.
3. **Expose media prompts before sending**이 켜져 있다면(**Settings → Generations → Overall Generations**(설정 → 생성 → 전체 생성)) 프롬프트를 확인하거나 수정한 뒤 **Generate**(생성)를 클릭하세요. 취소하면 요청이 시작되지 않습니다.
4. 버튼에 **Generating...**(생성 중...)이 표시되고, 동영상 생성이 진행 중이라는 배너가 나타납니다.
5. 완료되면 클립이 **Videos**에 나타납니다.

그림이 없으면 Marinara가 "Add or generate a gallery image before generating a scene video."라고 알립니다. 그림을 만들거나 업로드한 뒤 다시 시도하세요.

### 그림 하나 움직이게 만들기

1. **Images** 탭을 여세요.
2. 그림 위에 마우스를 올리세요.
3. **Animate illustration** 버튼(필름 아이콘)을 클릭하세요.

프롬프트 검토를 켜 두면 그 그림에 쓰일 완성된 프롬프트, 길이, 화면 비율, 해상도가 창에 그대로 표시됩니다. 여기서 수정한 내용은 그 클립에만 적용됩니다. Roleplay에서 동작을 계획하는 AI는 Illustrator와 같은 수의 최근 메시지를 읽되, 그 그림이 속한 답변까지만 읽습니다. 이 AI의 재사용 지시문은 **Settings → Generations → Video Generation Prompt Overrides** 아래의 **Roleplay Gallery Animation Director**(롤플레이 갤러리 애니메이션 디렉터)입니다.

**Videos**의 각 클립은 그 자리에서 재생되며 길이와 모델 이름이 함께 표시됩니다. **Pin video to chat**이나 **Download scene video**(장면 비디오 다운로드)를 쓰세요. 클립이 없으면 탭에 **No videos yet**(아직 비디오가 없습니다)이라고 표시됩니다.

## 서비스 고르기

여덟 가지 서비스 모두 이미지로 짧은 클립을 만듭니다.

- **Google AI Studio (Gemini Omni)**: 길이는 최대 60초이며 프롬프트에 적힙니다.
- **Google AI Studio (Veo)**: 품질이 뛰어나며 길이는 4초, 6초, 8초로 고정입니다. 이미지를 움직이게 만들 때는 8초를 씁니다.
- **xAI Imagine**: 1초에서 15초까지이며, 프롬프트 길이 제한이 다른 서비스보다 짧습니다.
- **OpenRouter Video**: 1초에서 60초까지이며, 내 계정이 지원하는 동영상 모델이라면 무엇이든 쓸 수 있습니다.
- **NanoGPT**: 1초에서 60초까지이며, 기본 모델이 없습니다.
- **Atlas Cloud**: Atlas Cloud의 최신 동영상 카탈로그를 불러옵니다. 이미지-동영상 모델이 먼저 표시되고, 모델마다 출력 1초당 시작 가격이 붙습니다. 카탈로그를 불러오지 못하면 Marinara가 Veo 3.1과 Seedance 2.0 기본 모델을 보여 줍니다. 정확한 모델 ID를 직접 입력할 수도 있습니다. 모델별 제한은 그대로 적용됩니다.
- **Seedance 2.0**: 4초에서 15초까지이며, 첫 프레임 방식과 첫 프레임과 마지막 프레임 방식을 지원합니다. 참조 이미지에 접근할 공개 링크가 필요합니다.
- **ComfyUI**: API 형식 워크플로로 로컬에서 생성합니다. 워크플로가 `%reference_image_name%`을 쓰면 Marinara가 참조 이미지를 바로 업로드합니다.
- **SwarmUI**: 워크플로와 SwarmUI 서버를 통해 로컬에서 생성합니다. 참조 이미지는 `%reference_image%`를 통해 들어갑니다.

동영상 작업은 느립니다. 서비스가 작업을 시작하면 Marinara는 클립이 준비될 때까지 기다리면서 상태를 확인합니다. 클립 하나에 몇 분이 걸릴 수 있습니다. 용량이 큰 로컬 WAN 모델은 기본값인 30분보다 오래 걸릴 수 있습니다. `VIDEO_GEN_TIMEOUT_MS`를 늘리고 Marinara를 다시 시작하세요.

### Atlas Cloud 모델 간 차이

Atlas Cloud 모델이 모두 같은 설정을 받는 것은 아닙니다. Marinara는 요청할 때마다 먼저 `static.atlascloud.ai`에서 모델이 공개한 입력 스키마를 읽고 내 기본값을 그에 맞춥니다.

- 원본 그림은 그 모델이 쓰는 이미지 필드로 들어갑니다.
- 클립 길이는 모델이 제공하는 길이 중 가장 가까운 값으로 바뀝니다. 5초나 10초만 지원하는 모델에서는 기본값 8초가 10초가 됩니다.
- 해상도는 모델이 제공하는 단계 중 가장 가까운 값으로 바뀝니다. 픽셀 크기를 받는 모델에는 화면 비율과 해상도에 가장 가까운 `width*height`가 전달됩니다.
- 모델에 없는 설정은 빠지므로 모델 자체의 기본값이 적용됩니다.

서버 로그는 `[video-gen/atlas-cloud] fitted request`로 시작하는 줄에 바뀐 값을 모두 적습니다. 스키마를 읽을 수 없으면 Marinara는 이전과 같은 일반 요청을 보냅니다.

장면 동영상에는 이미지-동영상 모델을 고르세요. 텍스트-동영상 모델에는 이미지 필드가 없습니다. 그런 모델은 그림을 무시하고 프롬프트만으로 관계없는 클립을 만들며, 서버 로그에도 그렇게 기록됩니다. 모델에 이미지가 필요하면 **Test video**는 단순한 그라데이션을 첫 프레임으로 보내므로 이미지-동영상 모델도 테스트를 통과할 수 있습니다.

많은 Atlas Cloud 모델에는 `negative_prompt`, `seed`, `generate_audio`, `shot_type`, `enable_prompt_expansion`이나 LoRA 목록 같은 자체 입력이 있습니다.

1. Atlas Cloud 모델을 열고 모델을 고르거나 입력하세요.
2. **Video defaults**를 펼친 다음 **Atlas Cloud setup**(Atlas Cloud 설정)을 펼치세요.
3. 길이, 화면 비율, 해상도 컨트롤 아래에서 **Model options**(모델 옵션)를 찾으세요.

**Model options** 위쪽에는 모델이 받는 길이, 해상도, 프레임 크기, 화면 비율이 나열됩니다. 텍스트-동영상 모델이라면 경고도 표시됩니다. 각 옵션은 Atlas Cloud의 이름과 설명을 그대로 쓰며, **Model default**(모델 기본값)로 시작하고 기본값이 괄호 안에 표시됩니다. **Model default**로 둔 옵션은 보내지 않습니다. 옵션을 바꾸면 **Test video**를 포함해 이 모델로 만드는 모든 동영상에 그 값이 함께 전송됩니다. LoRA 같은 목록 및 객체 입력에는 JSON을 씁니다.

선택한 값은 모델별로 저장됩니다. **Reset model options**(모델 옵션 초기화)는 현재 모델의 선택값을 지웁니다. 변경 내용을 유지하려면 **Save**(저장)를 클릭하세요. 저장된 옵션이 더 이상 모델에 맞지 않으면 Marinara는 그 옵션을 빼고 로그 줄에 이름을 적습니다.

## Game Assets에서 동영상 만들기

Game Mode에는 장면 동영상을 만드는 곳이 하나 더 있습니다. 바로 **Game Assets**(게임 에셋)입니다. 채팅 오른쪽 위 근처에 있는 폴더 버튼을 클릭하세요. 컴퓨터에서는 창으로, 휴대폰에서는 화면 너비의 패널로 열립니다. Chat Settings 안으로 옮겼다면 그곳의 **Game Assets** 섹션을 여세요.

1. **Game Assets**를 여세요.
2. **Generate video**(영상 생성) 버튼("Generate a scene video from the latest illustration")을 클릭하세요.
3. 준비되면 가장 최근 클립이 그곳에서 재생됩니다.

**Generate video**는 게임에 동영상 모델과 장면 일러스트가 모두 있을 때까지 비활성 상태입니다. 너무 일찍 클릭하면 "Choose a Video Generation connection in Game Settings first."(게임에 쓸 동영상 모델을 설정하세요)나 "Generate a scene illustration before generating a scene video."가 표시될 수 있습니다. 클립 생성이 실패하면 패널에 "Scene video generation failed."가 표시됩니다. 다시 시도하고, 계속 실패하면 키를 확인하세요.

## 채팅에 쓸 동영상 모델 고르기

채팅마다 **Chat Settings → Agents → Scene Videos**(채팅 설정 → 에이전트 → 장면 비디오)에서 쓸 동영상 모델을 따로 고릅니다.

- **Roleplay**에는 **Scene Videos** 카드("Generate manual MP4 scene videos from gallery images")가 표시됩니다. 컨트롤은 동영상 모델 목록 하나뿐입니다.
- **Game Mode**에는 컨트롤이 더 많은 **Scene Videos** 카드("Generate MP4 scene videos from game illustrations")가 표시됩니다. 동영상 모델 목록에서 모델을 고릅니다. **Game Video Prompt**(게임 동영상 프롬프트)는 그림을 어떻게 움직이게 만들지 정하는 틀입니다. 내장 기본값은 **Cinematic Scene Video**입니다. **Edit Video Prompt Presets**(동영상 프롬프트 프리셋 편집)로 이 채팅에서 쓸 내 사본을 추가하고 편집합니다.

**Game Video Prompt**는 Game Mode에서 Gallery와 Game Assets의 수동 동영상을 정합니다. Roleplay Gallery 애니메이션은 대신 **Roleplay Gallery Animation Director**를 씁니다. Storyboard 에이전트에는 자체 기본값인 **Storyboard Video Prompt**(스토리보드 동영상 프롬프트)가 있습니다. 채팅마다 **Chat Settings → Agents → Storyboards**(채팅 설정 → 에이전트 → 스토리보드)에서 이 값을 덮어쓸 수 있습니다. 초기화하면 Storyboard 에이전트의 기본값으로 돌아갑니다.

Game Mode 채팅을 만들 때는 설정 마법사의 **Features** 단계에서 시각 생성을 켜면 동영상 모델 선택기가 나타납니다.

## 동영상 생성 설정

일부 동영상 기본값은 앱 전체에 적용됩니다. **Settings → Generations**(설정 → 생성)를 열고 **Video Generation** 항목("Set default clip lengths and edit reusable video prompts for Game, Gallery, and Calls")을 찾으세요.

- **Scene video fallback length**(장면 동영상 폴백 길이): 선택한 동영상 모델에 자체 길이가 없을 때만 쓰입니다. 기본값은 10초입니다. 범위는 1에서 60입니다.
- **Video Generation Prompt Overrides**(동영상 생성 프롬프트 재정의): 재사용하는 동영상 프롬프트 틀을 편집합니다. **Roleplay Gallery Animation Director**는 Roleplay Gallery 클립을 만들기 전에 Prompt Model로 보내는 지시문을 정합니다. 이 지시문의 `${durationSeconds}` 변수는 클립 길이로 바뀝니다.
- **Videos per reply**(응답당 동영상 수): Conversation 캐릭터들이 답변 하나에서 보낼 수 있는 동영상 메시지 수이자, Illustrator가 Roleplay 답변 하나에 추가하는 클립 수입니다. 기본값은 3입니다. 범위는 1에서 10입니다. Conversation 캐릭터 하나는 최대 하나만 보냅니다. 이 설정은 그룹 채팅과 여러 동영상을 한 번에 요청할 때를 위한 것입니다. 더 많은 캐릭터가 클립을 보내게 하려면 값을 높이세요. 요청을 아끼려면 낮추세요. 한도를 넘는 클립은 건너뜁니다. `/video`와 Gallery의 **Video** 버튼은 이 한도에 포함되지 않습니다.
- **Animated expression length**(애니메이션 표정 길이)는 움직이는 초상화 스프라이트에 속한 설정입니다. [애니메이션 표정](animated-expressions.md)을 참고하세요.

## 스토리보드

다운로드해서 쓰는 Storyboard 에이전트는 Roleplay와 Game Mode에서 순서가 정해진 키프레임 이미지와 클립을 만듭니다. 애니메이션을 켜 두면 Marinara는 선택한 동영상 모델과 에이전트의 **Storyboard Video Prompt**로 성공한 키프레임을 하나씩 움직이게 만듭니다. [스토리보드 에이전트 가이드](../game/storyboard.md)를 참고하세요.

## 문제 해결

### "Choose a Video Generation connection"

채팅에 동영상 모델이 없습니다. **Chat Settings → Agents → Scene Videos**를 열고 모델을 고르세요. 목록이 비어 있으면 **Connections**에서 하나를 추가하세요.

### "Add or generate a gallery image before generating a scene video"

Game Mode와 **Animate illustration**에는 기존 그림이 필요합니다. Roleplay는 첫 프레임을 고르지 않으면 이야기만으로 클립을 만들 수 있습니다. **Illustrate**를 쓰거나, 그림을 업로드하거나, 가진 그림에서 **Animate illustration**을 클릭하세요.

### 동영상 생성이 오래 걸립니다

정상입니다. Google, xAI, OpenRouter, NanoGPT, Atlas Cloud, Seedance는 모두 작업을 시작하고 Marinara가 그 작업을 기다리는 방식입니다. 클립 하나에 몇 분이 걸릴 수 있습니다.

### Seedance가 참조 이미지를 읽지 못합니다

Seedance에는 그림에 접근할 공개 링크가 필요합니다. 로컬 서버라면 Seedance 모델에서 **Upload Seedance reference frames temporarily**를 켜세요. [Seedance 참조 프레임](#seedance-reference-frames)을 참고하세요.

### 동영상 요청이 계속 실패합니다

계정에 유효한 API 키와 동영상 사용 권한이 있는지 확인하세요. **Connections**에서 계정을 열고 키와 모델을 확인하세요. 서버 타임아웃은 [서버 설정 참고 문서](../CONFIGURATION.md)를 참고하세요.

## 관련 가이드

- [애니메이션 표정](animated-expressions.md)
- [스토리보드 에이전트 가이드](../game/storyboard.md)
- [Game Mode의 LTX 2.3 스토리보드](../game/ltx-2-3-storyboards.md)
- [지원하는 AI 제공자](../connections/providers-reference.md)
- [서버 설정 참고 문서](../CONFIGURATION.md)
