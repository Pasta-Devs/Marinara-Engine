# 스토리보드 에이전트 가이드

다운로드해서 쓰는 **Storyboard**(스토리보드) 에이전트는 완성된 이야기 글을 순서가 있는 키프레임 이미지로 바꾸고, 원하면 짧은 이미지-투-비디오 클립도 만듭니다. **Game Mode**(게임 모드)와 **Roleplay**(롤플레이)에서 작동합니다. **Conversation**(대화) 채팅에서는 쓰지 않습니다.

Storyboard 패키지는 계획용 프롬프트와 기본값, 채팅별 설정 항목을 제공합니다. Marinara는 미디어를 생성해 결과를 Gallery에 저장하고, 채팅이나 Game 뷰어에 표시합니다. 이 가이드는 Game Mode를 먼저 설명합니다. Roleplay 워크플로는 [Roleplay 스토리보드](#roleplay-storyboards)에서 이어집니다. Roleplay의 나머지 내용은 [Roleplay Mode: 시작하기](../roleplay/getting-started.md)를 참고하세요.

- **Game Mode**는 완료된 GM 서술 턴 하나를 씁니다. **Automatic Storyboard Illustrations**(자동 스토리보드 일러스트) 스위치와 **Automatic Storyboard Animations**(자동 스토리보드 애니메이션) 스위치가 따로 있고, 가장 최근 GM 턴에는 **Gallery → Create storyboard**(갤러리 → 스토리보드 만들기)를 씁니다. 서술에 맞춰 플로팅 뷰어나 Game 배경으로 표시되며, 정지 이미지용 플래너와 애니메이션용 플래너를 따로 씁니다.
- **Roleplay**는 직전에 성공한 에피소드 이후에 완료된 메시지를 씁니다. 자동 생성 선택지는 **Manual only**(수동 전용), **Still images**(정지 이미지), **Animations**(애니메이션) 중 하나이며, **Gallery → Create storyboard**는 가장 최근에 완료된 어시스턴트 응답을 대상으로 합니다. 에피소드를 끝맺은 응답 바로 아래에 인라인으로 표시되며, 에피소드 구성 규칙, 비주얼 스타일, 선택 사항인 애니메이션 애드온, 출력 규격을 씁니다.

두 모드 모두 키프레임 이미지는 Gallery의 **Images**(이미지) 탭에, 클립은 **Videos**(동영상) 탭에 저장합니다.

## 에이전트 설치

1. **Agents**(에이전트) 패널(Sparkles 아이콘)을 여세요.
2. **Agent Organizer**를 선택하세요.
3. **Storyboard**를 열고 **Install**(설치)을 선택하세요.
4. Game 채팅이나 Roleplay 채팅을 연 다음 **Chat Settings → Agents**(채팅 설정 → 에이전트)를 여세요.
5. **Enable Agents**(에이전트 활성화)를 켠 다음, Storyboard 카드에서 **Enable Storyboards**(스토리보드 활성화)를 켜세요.

설치하면 에이전트를 쓸 수 있게 될 뿐, 모든 채팅에서 켜지지는 않습니다. Marinara를 다시 시작하지 않아도 됩니다.

작동하지 않고 Chat Settings에 Storyboard가 보이지 않는다면, 패키지가 설치돼 있는지, 그 채팅이 Game 채팅이나 Roleplay 채팅인지, 패키지 버전이 사용 중인 Marinara 버전과 호환되는지 확인하세요.

## Game Mode 스토리보드

Game Mode 스토리보드는 완료된 GM 서술 턴 정확히 하나를 이야기 원본으로 씁니다. 숨은 GM 명령 태그를 걷어내고, 순서가 있는 프레임을 계획하고, 프레임마다 턴 본문에서 읽을 수 있는 구간의 범위를 연결합니다. 뷰어는 읽는 위치가 그 구간을 지날 때마다 프레임을 바꿉니다.

### Game 스토리보드 만들기

**시작하기 전에:** 게임에 이미지 계정이 있어야 합니다(Game 자체의 계정이나 전역 Storyboard 설정의 계정). [이미지 생성 제공자](../media/image-providers.md)를 참고하세요.

1. Storyboard를 설치하고 Game Mode 채팅을 여세요.
2. **Chat Settings → Agents**를 열고 **Enable Agents**를 켠 다음 **Enable Storyboards**를 켜세요.
3. GM 서술 턴을 하나 끝내세요.
4. **Chat Settings → Gallery**(채팅 설정 → 갤러리)를 열고 **Create storyboard**를 선택하세요.

닫아 둔 뷰어를 다시 열려면 Gallery에서 **View storyboard**(스토리보드 보기)를 선택하세요. 수동 생성은 현재 애니메이션 설정을 따릅니다. **Automatic Storyboard Animations**가 켜져 있으면 수동으로 만든 스토리보드도 클립을 요청합니다.

작동하지 않으면 [문제 해결](#troubleshooting)을 참고하세요.

### 자동 Game 스토리보드

Storyboard 카드에는 스위치가 2개 있습니다.

- **Automatic Storyboard Illustrations**는 GM 턴이 끝나면 정지 키프레임을 만듭니다.
- **Automatic Storyboard Animations**는 키프레임마다 클립도 만듭니다. 애니메이션을 켜면 일러스트도 켜지고, 일러스트를 끄면 애니메이션도 꺼집니다.

자동 생성은 그 게임에서 에이전트가 활성화돼 있을 때만 실행되며, 이미 스토리보드가 있는 턴에는 스토리보드를 다시 만들지 않습니다. 가장 최근 턴의 스토리보드를 하나 더 만들고 싶다면 Gallery의 수동 조작을 쓰세요.

Generation 설정에서 **Expose media prompts before sending**(전송 전에 미디어 프롬프트 표시)이 켜져 있으면, 수동으로 만드는 Game 스토리보드는 완성된 이미지 프롬프트를 먼저 보여 주고 검토하게 할 수 있습니다. 자동 스토리보드는 게임 진행이 멈추지 않도록 검토를 건너뜁니다.

### Game 설정

**Chat Settings → Agents → Storyboards**를 여세요.

| 설정 | 에이전트 기본값 | 기능 |
| --- | --- | --- |
| **Enable Storyboards** | 채팅마다 꺼짐 | 설치한 에이전트를 이 게임에서 켭니다. |
| **Automatic Storyboard Illustrations** | Automatic generation 값을 따름 | GM 턴마다 정지 키프레임을 만듭니다. |
| **Automatic Storyboard Animations** | Automatic generation 값을 따름 | 키프레임마다 MP4 클립을 만듭니다. |
| **Keyframes per Turn**(턴당 키프레임 수) | 3(1에서 200까지) | 프레임의 목표 개수입니다. 턴이 짧으면 더 적게 나올 수 있습니다. |
| **Animation Clip Duration**(애니메이션 클립 길이) | 5초(1에서 15까지) | 클립 하나에 요청하는 길이입니다. 서비스에 따라 허용 범위로 조정될 수 있습니다. |
| **Viewer Display** | Floating | 끌어서 옮기는 뷰어 또는 Game 배경 전체입니다. |
| **Illustration Planner**(일러스트 플래너) | Still Keyframes | 완성형 정지 일러스트를 계획합니다. |
| **Animation Planner**(애니메이션 플래너) | Comic Page Animation | 애니메이션에 바로 쓸 첫 프레임과 움직임 지시를 계획합니다. |
| **Use Storyboard Template**(스토리보드 템플릿 사용) | On | 선택한 최종 일러스트 포맷터를 적용합니다. |
| **Storyboard Illustration Prompt**(스토리보드 일러스트 프롬프트) | Game Scene Illustration | 계획한 프레임을 이미지 서비스에 맞게 다듬습니다. |
| **Storyboard Video Prompt**(스토리보드 동영상 프롬프트) | Cinematic Scene Video | 첫 프레임과 움직임 계획을 동영상 서비스에 맞게 다듬습니다. |

이 패키지에는 NovelAI, 코믹, 만화, 애니메이션, LTX 계열 플래너도 들어 있습니다. 애니메이션 플래너를 고른다고 해서 동영상 생성이 저절로 켜지지는 않습니다. **Automatic Storyboard Animations**와 동영상 계정이 여전히 필요합니다.

채팅마다 에이전트 기본값을 재정의할 수 있습니다. Chat Settings는 물려받은 값에 **Using agent default**(에이전트 기본값 사용 중) 표시를 붙이고, 값을 재정의하면 되돌리기 컨트롤을 보여 줍니다.

### Game 스토리보드가 만들어지는 과정

Game Mode는 정지 이미지와 애니메이션에 각각 다른 플래너를 씁니다.

```text
completed GM narration
  -> still or animation planner
  -> Storyboard Illustration Prompt
  -> image account
  -> optional Storyboard Video Prompt
  -> video account
```

플래너는 이야기 단락을 고르고 순서를 정합니다. 일러스트 프롬프트는 서비스에 맞춰 형식을 다듬는 포맷터일 뿐, 또 하나의 플래너가 아닙니다. 애니메이션을 켜 두면 애니메이션 플래너가 정확한 첫 프레임 설명과 움직임 지시를 만들고, 동영상 프롬프트가 그 움직임 지시를 최종 요청으로 바꿉니다.

### Game 뷰어

- **Floating viewer**(플로팅 뷰어)는 게임 위에 떠 있는 패널로, 끌어서 옮기고 크기를 바꿀 수 있습니다. 서술에서 읽고 있는 위치를 따라가며 그에 맞는 프레임을 보여 줍니다. 동영상이 준비되면 재생하고, 그렇지 않으면 프레임 이미지를 보여 줍니다. 닫으면 현재 턴 동안 숨겨집니다. 다시 열려면 **Gallery → View storyboard**를 쓰세요.
- **Game background**(게임 배경)는 활성 프레임을 화면의 나머지 요소 뒤에 깝니다. 켜져 있는 동안 생성된 장면 배경을 대신하므로 **Generate background**(배경 생성)를 쓸 수 없습니다. 배경 클립은 한 번 재생되고 마지막 프레임에 멈춰 있습니다.

다시 재생, 재생/일시정지, 음소거는 **Game controls**(게임 컨트롤)를 열어 조작하세요(채팅 오른쪽 위 근처의 게임 컨트롤러 버튼). 컴퓨터에서는 창으로, 휴대폰에서는 패널로 열립니다. Chat Settings 안으로 옮겼다면 그 안의 **Game controls** 섹션을 여세요.

### Storyboard Optimized 연출은 에이전트 스위치가 아닙니다

마법사의 **Storyboard Optimized**(스토리보드 최적화) 연출은 GM 서술 프롬프트를 바꿔서 턴에 영상으로 옮기기 좋은 시각적 기준점이 더 뚜렷하게 담기게 합니다. Storyboard를 설치하거나 켜지 않고, 자동 미디어를 켜지도, 이미지 계정과 동영상 계정을 고르지도 않습니다. 에이전트는 **Standard**(표준)에서도, **Storyboard Optimized**에서도 쓸 수 있습니다. 에이전트 설치와 켜기는 따로 하세요.

### Game Mode 설정 조합

각 조합은 Storyboard 체인에 나머지 Game 설정과 서비스 설정을 짝지은 것입니다. 패키지에 해당 체인이 있으면 그대로 적용하고, 없으면 적힌 선택 항목을 직접 고르세요.

#### Google 코믹 스토리보드

체인: **Illustration Planner** Still Keyframes, **Animation Planner** Comic Page Animation, **Storyboard Illustration Prompt** Game Scene Illustration, **Storyboard Video Prompt** Comic Page Video, **Use Storyboard Template** On.

Game 확인 목록:

- **Illustrator**(일러스트레이터): On(마법사의 Features 단계)
- 이미지 계정: Google/Nano Banana, **Image Style**(이미지 스타일): Default, 설정 단계에서 만들어진 아트 스타일은 그대로 유지
- **Automatic Storyboard Illustrations**: On
- **Automatic Storyboard Animations**: Off
- **Keyframes per Turn**: 3
- 동영상 계정: None

이렇게 하면 평범한 정지 스토리보드가 만들어집니다. 저장된 Comic Page 애니메이션 체인은 나중에 동영상 계정을 고르고 **Automatic Storyboard Animations**를 켰을 때만 적용됩니다.

#### NovelAI 태그 그대로 보내기

체인: **Illustration Planner** NovelAI Keyframes. **Storyboard Illustration Prompt**에는 프롬프트에 아래 텍스트만 담은 사용자 지정 선택지를 만드세요. **Use Storyboard Template**은 On으로 두세요. Animation Planner와 Video Prompt는 그대로 두세요.

```text
${scenePrompt}
```

Game 확인 목록:

- **Image Style**: Danbooru. Danbooru 프로필에서 문장형 **Style text**(스타일 텍스트)를 지우세요.
- **Use Campaign Art Style**(캠페인 아트 스타일 사용): Off
- **Attach Card Appearance**(카드 외형 첨부): Off
- **Send Avatar References**(아바타 참조 전송): Off
- **Use NovelAI Character Prompts**(NovelAI 캐릭터 프롬프트 사용): Off
- **Queue media generation requests**(미디어 생성 요청 대기열 사용): On
- 긍정 태그, 부정 태그, 일러스트 태그는 필요에 맞게 조정하세요.

이 전달용 템플릿은 플래너가 만든 간결한 NovelAI 태그를 평소의 문장형 포맷터로 감싸지 않고 그대로 보냅니다.

#### 로컬 Krea 2 + LTX 2.3

체인: **Illustration Planner** Still Keyframes(정지 이미지만 만들 때의 대체 선택지), **Animation Planner** LTX Simple Image-to-Video, **Storyboard Illustration Prompt** Storyboard First Frame, **Storyboard Video Prompt** Narration Passthrough, **Use Storyboard Template** On.

VRAM이 8 GB인 GPU라면 480p에서 키프레임 1개로 시작하세요. 잘 작동하면 키프레임 3개와 더 큰 크기로 늘려 가세요. ComfyUI 계정, 플레이스홀더, 전체 확인 절차는 [Game Mode의 LTX 2.3 스토리보드](ltx-2-3-storyboards.md)를 참고하세요.

<a id="roleplay-storyboards"></a>

## Roleplay 스토리보드

Roleplay 스토리보드는 완료된 메시지 묶음을 하나의 시각 에피소드로 엮어, 그 에피소드를 끝맺은 어시스턴트 응답 아래에 보여 줍니다.

### Roleplay 스토리보드 만들기

1. Storyboard를 설치하고 해당 Roleplay 채팅에서 켜세요.
2. **Chat Settings → Agents → Storyboards**에서 **Prompt connection**(프롬프트 연결)과 **Image model**(이미지 연결)을 고르세요. 전역 설정을 마쳤다면 **Use global default**(전역 기본값 사용)로 두어도 됩니다.
3. **Automatic mode**(자동 모드)를 고르세요.
   - **Manual only**: 자동 에피소드를 만들지 않습니다. **Create storyboard**를 누를 때만 정지 이미지 에피소드를 만듭니다.
   - **Still images**: 삽화가 들어간 에피소드를 자동으로 만듭니다.
   - **Animations**: 키프레임 이미지와 프레임별 클립을 자동으로 만듭니다. 동영상 계정이 필요합니다.
4. **Messages per episode**(에피소드당 어시스턴트 메시지 수)와 **Keyframes per episode**(에피소드당 키프레임 수)를 지정하세요.
5. 어시스턴트 응답을 새로 하나 끝내거나, **Chat Settings → Gallery**를 열고 **Create storyboard**를 선택하세요.

키프레임이 여러 개인 스토리보드에서는 화살표로 프레임 사이를 오가세요. 애니메이션이 있는 프레임은 클립을 인라인으로 보여 주고, 클립이 아직 준비 중이거나 없으면 이미지를 대신 보여 줍니다.

### 에피소드 간격이 작동하는 방식

간격은 성공한 자동 스토리보드 사이에 새 사용자 메시지와 어시스턴트 메시지가 몇 개나 쌓여야 하는지를 뜻합니다. 두 역할의 메시지가 모두 포함되며, 에피소드에는 새 메시지가 순서대로 들어갑니다. 기본값은 1이라서 다음에 완료되는 어시스턴트 응답이 바로 에피소드를 만들 수 있습니다. 값을 키우면 대사와 행동이 더 쌓인 뒤에 만들어집니다. 원본은 최근 메시지 20개와 12,000자로 제한되므로, 긴 채팅이라도 계획 요청이 끝없이 커지지는 않습니다.

카운터는 스토리보드가 전부 또는 일부라도 저장된 뒤에만 앞으로 나아가므로, 실패한 에피소드는 원본을 소진하지 않습니다. 기존 채팅을 열어도 예전 응답을 소급해서 채우지 않습니다. 자동 생성은 어시스턴트 응답이 새로 완료될 때까지 기다립니다.

### Roleplay 프롬프트 라이브러리

Roleplay는 선택한 프롬프트 4개로 플래너 요청 하나를 만듭니다.

| 설정 | 기본값 | 용도 |
| --- | --- | --- |
| **Episode contract**(에피소드 구성 규칙) | Completed Roleplay Episode | 원문에 근거가 있는 이야기 단락을 골라 메시지 순서대로 유지합니다. |
| **Visual style**(비주얼 스타일) | Normal / Anime | 모든 키프레임의 시각 연출입니다. 다른 선택지: NovelAI, Comic, Colored Manga, B&W Manga. |
| **Animation addon**(애니메이션 애드온) | Simple Storyboard Motion | 클립에만 쓰입니다. 실제로 담아낼 수 있는 동작 하나, 카메라 움직임, 원문 대사와 소리, 분위기, 마무리 정지 구간을 더합니다. |
| **Output contract**(출력 규격) | Roleplay Keyframe JSON | 플래너가 돌려주는 구조화된 키프레임 필드입니다. |

그다음 **Storyboard Illustration Prompt**가 각 첫 프레임을 이미지 서비스에 맞게 다듬고, 클립을 켜 두었다면 **Storyboard Video Prompt**가 움직임 계획을 다듬습니다. 이 프롬프트들을 편집하려면 Stage 1의 접힌 **Prompt library**(프롬프트 라이브러리)를 여세요. 사용자 지정 프롬프트는 **Add option**(옵션 추가)으로 추가한 다음 이름을 바꾸고, 짧은 설명을 넣고, 본문을 고치세요. 내장 옵션은 기본값으로 복원할 수 있습니다. Roleplay 비주얼 스타일을 고쳐도 Game Mode의 플래너는 바뀌지 않습니다.

### Storyboard와 Illustrator 함께 쓰기

Storyboard는 Illustrator와 별개이며, Illustrator를 직접 실행하는 조작은 그대로 쓸 수 있습니다. Roleplay Storyboard가 **Still images**나 **Animations**로 설정돼 있으면, Marinara는 그 응답에 한해 평소의 자동 Illustrator 이미지를 건너뜁니다. 두 에이전트가 서로 겹치는 미디어를 만들지 않도록 하기 위해서입니다. **Manual only**로 두면 Illustrator 동작은 그대로입니다.

## Storyboard 에이전트 설정

**Agents** 패널을 열고 **Storyboard**를 선택한 다음 설정 화면을 여세요. 여기서 정한 값은 따로 재정의하지 않은 채팅의 기본값입니다.

| 설정 | 기본값 | 용도 |
| --- | --- | --- |
| 에이전트 연결 | 선택해 둔 에이전트 계정 | 모델로 스토리보드를 계획합니다. |
| **Image model** | **Use the chat image connection**(채팅 이미지 연결 사용) | 키프레임을 모두 만듭니다. 대체 경로 어딘가에 이미지 계정이 있어야 합니다. |
| **Video connection**(동영상 연결) | **Use the chat video connection**(채팅 동영상 연결 사용) | 애니메이션을 켜 두면 클립을 만듭니다. |
| **Automatic generation**(자동 생성) | Still images | 새로 활성화한 채팅의 초기 자동 동작입니다. |
| **Keyframes per turn** | 3(1에서 200까지) | 순서가 있는 프레임의 목표 개수입니다. |
| **Clip seconds**(클립 길이, 초 단위) | 5(1에서 15까지) | 클립 하나에 요청하는 길이입니다. |
| **Viewer display**(뷰어 표시) | Floating viewer | Game 뷰어의 기본값입니다. Roleplay는 스토리보드를 항상 인라인으로 표시합니다. |
| **Default Roleplay episode interval**(기본 롤플레이 에피소드 간격) | 1(1에서 100까지) | 자동 에피소드 사이에 필요한 새 Roleplay 내용의 양입니다. |
| **Attach Card Appearance** | On | 이미지 프롬프트에 해당 캐릭터의 외형을 더합니다. **Image Appearance Override**(이미지 외모 재정의)가 켜진 카드나 페르소나는 **Appearance**(모양) 필드 대신 그 글을 제공합니다. |
| **Send Avatar References** | On | 이미지 서비스가 참조 이미지를 받으면 해당 캐릭터와 페르소나의 아바타를 보냅니다. |
| **Use the final image template**(최종 이미지 템플릿 사용) | On | 계획한 프레임을 이미지 서비스에 보내기 전에 형식을 다듬습니다. Game 채팅에서는 **Use Storyboard Template**입니다. |
| **Use NovelAI character prompts** | On | 지원되는 공식 NovelAI V4와 V4.5 계정에서만 쓰는 캐릭터별 자체 프롬프트 방식입니다. 다른 서비스는 공용 프롬프트 경로를 씁니다. |

Game Mode용 라이브러리에는 게임이 정지 이미지를 만드는지 클립을 만드는지에 따라 고르는 계획 경로가 두 가지 있습니다. **Still planner**(정지 플래너)는 기본값이 Still Keyframes이고, **Animation planner**는 기본값이 Comic Page Animation입니다. 플래너 텍스트는 전역 에이전트 설정에서 고칠 수 있고, 각 Game 채팅은 자체 설정에서 그 선택지 중 하나를 고릅니다.

계획이 끝나면 공유 포맷터인 **Default image prompt**(기본 이미지 프롬프트)와 **Default video prompt**(기본 동영상 프롬프트)가 최종 요청을 만듭니다. 기본값은 각각 Game Scene Illustration과 Cinematic Scene Video입니다. 번호가 붙은 각 단계에는 접힌 **Prompt library**가 따로 있습니다. Stage 2는 이미지 포맷터, Stage 3는 이미지를 참고하는 움직임 플래너, Stage 4는 동영상 전달 포맷터용입니다. 이미지 선택지에는 **Storyboard Illustration**과 **Storyboard First Frame**도 있습니다. 동영상 선택지에는 **Anime Game Video**, **Comic Page Video**, **Narration Passthrough**가 있습니다. Game 채팅과 Roleplay 채팅은 서로 다른 포맷터를 고를 수 있습니다.

Stage 3의 **Image-aware shot planning**(이미지 인식 샷 기획)은 동영상 계정의 **Video prompting instructions**(동영상 프롬프트 지시문)도 따릅니다. 계정 편집기의 이 필드에 카메라 표현, 프롬프트 길이, 소리 신호처럼 동영상 모델이 기대하는 내용을 적으세요.

계정을 고르는 방식은 모드마다 조금 다릅니다. Roleplay에는 채팅별 프롬프트, 이미지, 동영상 선택 항목이 있으며, **Use global default**를 고르면 Storyboard 설정을 물려받습니다. Game Mode는 게임 전용 계획 계정, 이미지 계정, 동영상 계정이 지정돼 있으면 그것을 쓰고, 없으면 에이전트 기본값으로 넘어갑니다. 정지 이미지에는 이미지 계정이 필요합니다. 애니메이션에는 성공한 키프레임 이미지와 동영상 계정이 필요합니다.

## 이미지 프롬프트와 캐릭터 일관성

플래너는 어떤 순간을 보여 줄지 정하고 프레임마다 시각적 내용을 씁니다. 최종 이미지 템플릿은 서비스에 보낼 구조, 해당 캐릭터의 외형, 참조 이미지 처리, 장소 컨텍스트, 캠페인 아트 디렉션, 이미지 지시를 더합니다.

플래너가 이미지 서비스에 그대로 보내야 할 문법을 이미 돌려준다면 `${scenePrompt}` 같은 전달용 템플릿을 쓰세요. **Use the final image template**은 포맷터를 일부러 건너뛰고 싶을 때만 끄세요. 필수 이미지 지시는 그래도 적용됩니다.

캐릭터 모습을 더 일정하게 유지하려면 다음을 지키세요.

- 캐릭터 카드의 Appearance 필드를 구체적이고 최신 내용으로 유지하세요.
- 플래너가 필요한 세부 내용을 이미 되풀이하고 있는 경우가 아니라면 **Attach Card Appearance**를 켜 두세요.
- 서비스가 참조 이미지를 받고 아바타가 원하는 모습과 맞는다면 **Send Avatar References**를 켜 두세요.
- 한 프레임에 등장하는 인원은 적고 또렷하게 보이도록 잡으세요. Storyboard는 채팅에 있는 모든 인물이 아니라, 프레임에 실제로 보이는 것으로 확인된 캐릭터와 페르소나만 넣습니다.

## 비용과 성능

키프레임 하나하나가 별개의 이미지 작업입니다. 움직이는 스토리보드는 성공한 키프레임마다 동영상 작업을 하나씩 더하므로, 프레임 3개짜리 움직이는 스토리보드는 이미지 요청 3개와 동영상 요청 3개를 만들 수 있습니다. 새 서비스나 로컬 설정을 시험할 때는 정지 이미지와 키프레임 1개로 시작하세요. 기본 흐름이 작동하는 것을 확인한 뒤에 프레임 개수, 클립 길이, 자동 생성 간격을 올리세요.

## 예전 Storyboard 시스템으로 만든 게임

기존 Game 채팅에는 예전 내장 Storyboard 화면에서 지정한 설정이 남아 있을 수 있습니다. 패키지를 설치하면 Marinara는 그 값을 채팅별 재정의로 보존하므로, 예전 게임은 현재 에이전트 기본값과 다르게 동작할 수 있습니다. **Chat Settings → Agents → Storyboards**를 열고 항목마다 되돌리기 컨트롤을 써서 그 항목이 다시 에이전트 기본값을 따르게 하세요. 이 설정은 이전 버전에서 옮겨 온 데이터일 뿐입니다. 생성하려면 여전히 패키지가 설치돼 있고 그 게임에서 켜져 있어야 합니다.

<a id="troubleshooting"></a>

## 문제 해결

### Create storyboard는 보이는데 생성이 실패할 때

- 그 채팅에서 **Enable Agents**와 **Enable Storyboards**를 켜세요.
- Roleplay Storyboard 카드, Game 설정, 전역 Storyboard 설정 중 한 곳에서 쓸 수 있는 이미지 생성 계정을 고르세요.
- 어시스턴트나 GM의 응답이 끝날 때까지 기다린 다음 다시 시도하세요.

### Roleplay에서 자동 에피소드가 만들어지지 않을 때

- **Manual only**가 아니라 **Still images**나 **Animations**를 고르세요.
- 어시스턴트 응답이 새로 완료될 때까지 기다리세요. 채팅을 열기만 해서는 예전 메시지를 소급해서 채우지 않습니다.
- **Messages per episode** 값을 확인하세요. 새 사용자 메시지와 어시스턴트 메시지가 충분히 쌓여야 합니다.
- 실패한 실행은 카운터를 옮기지 않으므로, 서버 로그에서 원래 발생한 서비스 오류나 파싱 오류를 확인하세요.

### 이미지는 나오는데 동영상이 없을 때

- Roleplay에서는 **Animations**를 고르세요. Game Mode에서는 **Automatic Storyboard Animations**를 켜세요.
- 이미지-투-비디오 입력을 지원하는 Video Generation(동영상 생성) 계정을 고르세요.
- Gallery의 **Videos** 탭을 확인하세요. 클립은 키프레임 이미지보다 늦게 완성될 수 있습니다.
- 모델 호출이 실패해 계획이 대체 경로로 넘어갔다면, Marinara가 대체 이미지는 남기고 그 실행의 동영상은 건너뛸 수 있습니다.

### 스토리보드가 일부만 나오거나 멈춰 있을 때

서비스 작업이 실패했거나, 시간이 초과됐거나, 요청 한도 또는 콘텐츠 제한에 걸렸을 수 있습니다. 서비스에 문제는 없는데 느리다면 `.env`에서 `IMAGE_GEN_TIMEOUT_MS`나 `VIDEO_GEN_TIMEOUT_MS`를 늘린 다음 Marinara를 다시 시작하세요. 이 값은 시작할 때 읽기 때문입니다. [서버 설정 참고 문서](../CONFIGURATION.md)를 참고하세요.

플래너, 완성된 이미지 프롬프트, 참조 이미지 선택, 동영상 프롬프트를 확인하려면 Debug mode(디버그 모드)를 켜고 서버 로그에서 `storyboard`를 검색하세요. 디버그 로그에는 비공개 채팅 내용이 담길 수 있으므로 공유하기 전에 민감한 내용을 지우세요.

## 관련 가이드

- [에이전트: 채팅을 도와주는 AI](../agents/agents-overview.md)
- [다운로드 가능한 에이전트 레퍼런스](../agents/built-in-agents.md)
- [Game Mode: 시작하기](getting-started.md)
- [Roleplay Mode: 시작하기](../roleplay/getting-started.md)
- [이미지 생성 제공자](../media/image-providers.md)
- [장면 동영상 생성](../media/scene-video.md)
- [Game Mode의 LTX 2.3 스토리보드](ltx-2-3-storyboards.md)
