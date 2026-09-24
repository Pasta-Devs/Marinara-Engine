# 스토리보드 에이전트 가이드

다운로드해서 쓰는 **Storyboard**(스토리보드) 에이전트는 완성된 이야기 글을 순서가 있는 키프레임 이미지로 바꾸고, 여기에 짧은 이미지-투-비디오 클립을 더할 수도 있습니다. 지원하는 모드는 **Roleplay**(롤플레이)와 **Game Mode**(게임 모드)입니다. Conversation(대화) 채팅에서는 Storyboard를 쓰지 않습니다.

지금은 이 에이전트 방식이 표준 워크플로입니다. Storyboard 패키지는 계획용 프롬프트와 기본값, 채팅별 설정 항목을 제공합니다. 호스트 쪽 연동은 Marinara Engine이 맡습니다. 미디어를 실제로 생성해 **Gallery**(갤러리)에 저장하고, 채팅이나 게임 뷰어에 표시합니다.

## Roleplay와 Game Mode 한눈에 보기

| | Roleplay | Game Mode |
| --- | --- | --- |
| 이야기 원본 | 직전에 성공한 에피소드 이후에 완료된 사용자 메시지와 어시스턴트 메시지 | 완료된 GM 서술 턴 하나 |
| 자동 생성 선택지 | **Manual only**, **Still images**, **Animations** 중 하나 | 별도의 **Automatic Storyboard Illustrations** 스위치와 **Automatic Storyboard Animations** 스위치 |
| 수동 조작 | 가장 최근에 완료된 어시스턴트 응답에 **Gallery > Create storyboard** 실행 | 가장 최근에 완료된 GM 턴에 **Gallery > Create storyboard** 실행 |
| 표시 위치 | 에피소드를 끝맺은 어시스턴트 응답 바로 아래에 인라인 | 서술 진행에 맞춰 따라가는 플로팅 뷰어 또는 게임 배경 |
| 계획 프롬프트 | **Episode contract**, **Visual style**, 선택 사항인 **Animation addon**, **Output contract** | 별도의 정지 이미지용 플래너와 애니메이션용 플래너 |
| 공유 최종 프롬프트 | 일러스트 이미지 프롬프트와 애니메이션 동영상 프롬프트 | 일러스트 이미지 프롬프트와 애니메이션 동영상 프롬프트 |

두 모드 모두 키프레임 이미지는 **Gallery**의 **Images**(이미지) 탭에, 클립은 **Videos**(동영상) 탭에 저장합니다.

## 에이전트 설치

1. Sparkles 아이콘에서 **Agents**(에이전트) 패널을 여세요.
2. **Download Agents**(에이전트 다운로드)를 선택하세요.
3. **Storyboard**를 열고 **Install**(설치)을 선택하세요.
4. Roleplay 채팅이나 Game 채팅을 열고 **Chat Settings > Agents**(채팅 설정 > 에이전트)로 이동하세요.
5. **Enable Agents**(에이전트 활성화)를 켠 다음, Storyboard 카드에서 **Enable Storyboards**(스토리보드 활성화)를 켜세요.

패키지를 설치하면 호환되는 채팅에서 쓸 수 있게 될 뿐, 모든 채팅에서 저절로 켜지지는 않습니다. 현재 패키지는 설치한 뒤에 Marinara를 다시 시작하지 않아도 됩니다.

**Chat Settings**에 Storyboard가 보이지 않는다면 패키지가 설치돼 있는지, 그리고 그 채팅이 Roleplay나 Game Mode인지 확인하세요.

## Storyboard 에이전트 설정

**Agents** 패널을 열고 **Storyboard**를 선택한 다음 설정 화면을 여세요. 여기에 지정한 값은 따로 재정의하지 않은 채팅에 적용되는 기본값입니다.

### 생성과 미디어 기본값

| 설정 | 기본값 | 기능 |
| --- | --- | --- |
| 에이전트 연결 | 선택해 둔 에이전트 연결 | LLM으로 스토리보드를 계획합니다 |
| **Image connection**(이미지 연결) | Use the Game image connection | 키프레임을 모두 생성합니다. 이미지 연결은 대체 경로 어딘가에 반드시 지정돼 있어야 합니다 |
| **Video connection**(동영상 연결) | Use the Game video connection | 애니메이션을 켜 두면 클립을 생성합니다 |
| **Automatic generation**(자동 생성) | Still images | 새로 활성화한 채팅의 초기 자동 동작을 정합니다 |
| **Keyframes per turn**(턴당 키프레임 수) | 3(1에서 6까지) | 순서가 있는 프레임의 목표 개수를 정합니다 |
| **Clip seconds**(클립 길이, 초 단위) | 5(1에서 15까지) | 클립 하나에 요청할 길이를 정합니다 |
| **Viewer display**(뷰어 표시) | Floating viewer | Game Mode 뷰어의 기본값을 정합니다. Roleplay는 스토리보드를 항상 인라인으로 표시합니다 |
| **Default Roleplay episode interval**(기본 롤플레이 에피소드 간격) | 1(1에서 100까지) | 자동 에피소드 사이에 새 Roleplay 내용이 얼마나 쌓이게 할지 정합니다 |
| **Attach Card Appearance**(카드 외형 첨부) | On | 이미지 프롬프트에 해당 캐릭터의 외형 설명을 더합니다 |
| **Send Avatar References**(아바타 참조 전송) | On | 이미지 제공자가 참조 이미지를 지원하면 해당 캐릭터와 페르소나의 아바타를 보냅니다 |
| **Use the final image template**(최종 이미지 템플릿 사용) | On | 계획한 프레임을 이미지 제공자에게 보내기 전에 형식에 맞게 다듬습니다 |
| **Use NovelAI character prompts**(NovelAI 캐릭터 프롬프트 사용) | On | 지원되는 공식 NovelAI V4/V4.5 연결에서 캐릭터별 자체 프롬프트 방식을 씁니다 |

### Game 프롬프트 라이브러리

**Game prompt library**(게임 프롬프트 라이브러리)에는 계획 방식이 두 갈래로 들어 있습니다. 게임이 정지 이미지를 만드는지 클립을 만드는지에 따라 어느 쪽을 쓸지 갈립니다.

| 설정 | 기본값 | 기능 |
| --- | --- | --- |
| **Still planner**(정지 플래너) | Still Keyframes | 완료된 GM 턴 하나를 완성형 정지 이미지 장면으로 나눕니다 |
| **Animation planner**(애니메이션 플래너) | Comic Page Animation | 애니메이션에 바로 쓸 첫 프레임과 길이를 감안한 움직임 지시를 만듭니다 |

이 패키지에는 NovelAI, 코믹, 컬러 만화, 흑백 만화, 애니메이션 에피소드, LTX 계열 플래너도 들어 있습니다. 플래너 프롬프트 본문은 전역 에이전트 설정에서 고칠 수 있습니다. Game 채팅에서는 **Chat Settings > Agents > Storyboards**에서 정지 이미지용과 애니메이션용 선택지를 고릅니다.

### Roleplay 프롬프트 라이브러리

Roleplay는 선택한 프롬프트 4개를 묶어 플래너 요청 하나를 만듭니다.

| 설정 | 기본값 | 기능 |
| --- | --- | --- |
| **Episode contract**(에피소드 구성 규칙) | Completed Roleplay Episode | 원문에 근거가 있는 완결된 이야기 단락을 골라 메시지 순서대로 유지합니다 |
| **Visual style**(비주얼 스타일) | Normal / Anime | 키프레임 전체의 시각 연출을 정합니다 |
| **Animation addon**(애니메이션 애드온) | Simple Storyboard Motion | 클립을 만들 때만 움직임, 카메라, 원문 대사와 소리, 분위기, 마무리 정지 구간을 더합니다 |
| **Output contract**(출력 규격) | Roleplay Keyframe JSON | 플래너가 돌려주는 키프레임 필드의 구조를 정합니다 |

Stage 1 안의 접힌 **Prompt library**(프롬프트 라이브러리)를 열어 전체 모음을 편집하세요. **Add option**(옵션 추가)으로 사용자 지정 프롬프트를 추가하고 이름, 짧은 설명과 본문을 수정하세요. 내장 옵션은 패키지 기본값으로 복원할 수 있습니다.

### 공유 제공자 포맷터

두 모드 중 어느 쪽이든 프레임 계획이 끝나면 공유 포맷터가 제공자에게 보낼 최종 요청을 만듭니다.

| 설정 | 기본값 | 기능 |
| --- | --- | --- |
| **Default image prompt**(기본 이미지 프롬프트) | Game Scene Illustration | 계획한 키프레임을 이미지 제공자에 맞게 다듬습니다 |
| **Default video prompt**(기본 동영상 프롬프트) | Cinematic Scene Video | 첫 프레임 이미지와 움직임 계획을 동영상 제공자에 맞게 다듬습니다 |

번호가 붙은 각 단계에는 접힌 **Prompt library**가 있습니다. Stage 2는 이미지 포맷터, Stage 3는 이미지를 참고하는 움직임 플래너, Stage 4는 동영상 전달 포맷터를 담당합니다. 내장 이미지 옵션에는 **Storyboard Illustration**과 **Storyboard First Frame**도 있습니다. 동영상 옵션에는 **Anime Game Video**, **Comic Page Video**, **Narration Passthrough**가 있습니다. Game과 Roleplay 채팅은 공유 프롬프트 모음을 바꾸지 않고 서로 다른 포맷터를 선택할 수 있습니다.

### 전역 기본값과 채팅별 재정의

채팅마다 에이전트 기본값을 재정의할 수 있습니다. **Chat Settings**는 물려받은 값에 **Using agent default**(에이전트 기본값 사용 중) 표시를 붙이고, 값을 직접 지정하고 나면 되돌리기 버튼을 함께 보여 줍니다.

연결을 고르는 우선순위는 모드마다 조금 다릅니다.

- Roleplay에는 채팅별 프롬프트, 이미지, 동영상 선택 항목이 있습니다. **Use global default**(전역 기본값 사용)를 고르면 Storyboard 설정을 그대로 물려받습니다.
- Game Mode는 게임 전용 계획 연결과 이미지 연결, 동영상 연결이 지정돼 있으면 그것을 먼저 쓰고, 없으면 Storyboard 에이전트 기본값으로 넘어갑니다.

정지 이미지를 만들려면 이미지 연결이 반드시 있어야 합니다. 애니메이션에는 성공한 키프레임 이미지와 동영상 연결이 둘 다 필요합니다.

## Roleplay 스토리보드

Roleplay 스토리보드는 완료된 메시지 묶음을 하나의 시각 에피소드로 엮고, 그 에피소드를 끝맺은 어시스턴트 응답 아래에 그려 넣습니다.

### 빠르게 시작하기

1. Storyboard를 설치하고 해당 Roleplay 채팅에서 활성화하세요.
2. **Chat Settings > Agents > Storyboards**에서 **Prompt connection**(프롬프트 연결)과 **Image connection**을 고르세요. 전역 설정을 이미 마쳤다면 **Use global default**로 두어도 됩니다.
3. **Automatic mode**(자동 모드)를 고르세요.
   - **Manual only**(수동 전용): 자동 에피소드를 만들지 않습니다. **Create storyboard**(스토리보드 만들기)를 누를 때만 정지 이미지 에피소드를 만듭니다.
   - **Still images**(정지 이미지): 삽화가 들어간 에피소드를 자동으로 만듭니다.
   - **Animations**(애니메이션): 키프레임 이미지와 프레임별 클립을 자동으로 만듭니다. 동영상 연결이 필요합니다.
4. **Messages per episode**(에피소드당 메시지 수)와 **Keyframes per episode**(에피소드당 키프레임 수)를 지정하세요.
5. 어시스턴트 응답을 새로 하나 끝내거나, **Gallery**를 열고 **Create storyboard**를 선택하세요.

키프레임이 여러 개인 스토리보드에서는 화살표로 프레임을 넘길 수 있습니다. 애니메이션이 적용된 프레임은 재생할 수 있는 클립을 인라인으로 보여 주고, 클립이 아직 준비 중이거나 없을 때는 이미지를 대신 보여 줍니다.

### 에피소드 간격이 동작하는 방식

이 간격은 자동 스토리보드가 성공한 뒤 다음 스토리보드까지 새 사용자 메시지와 어시스턴트 메시지가 몇 개나 쌓여야 하는지를 정합니다. 두 역할의 메시지 모두 간격을 채우는 데 반영되며, 에피소드에는 새로 쌓인 메시지가 시간순으로 들어갑니다.

기본값은 1이라서 새로 완료되는 어시스턴트 응답마다 바로 에피소드가 나올 수 있습니다. 값을 키우면 대사와 행동이 더 쌓인 뒤에 만들어집니다. 원본으로 삼는 범위는 최근 메시지 20개와 12,000자로 제한되므로, 오래됐거나 아주 긴 채팅이라도 계획 요청이 끝없이 커지지는 않습니다.

성공 기준점은 스토리보드가 전부 또는 일부라도 저장된 뒤에만 앞으로 옮겨 갑니다. 실패한 에피소드는 원본 메시지를 소진하지 않습니다. 기존 채팅을 다시 열어도 예전 응답을 소급해서 채우지 않습니다. 자동 생성은 어시스턴트 응답이 새로 완료될 때까지 기다립니다.

### Roleplay 프롬프트 체인

Roleplay는 공유 제공자 포맷터로 넘어가기 전에 계획 단계 4개를 거칩니다.

1. **Episode contract**는 완결됐고 원문에 근거가 있는 이야기 단락을 골라 전달받은 메시지와 연결합니다.
2. **Visual style**은 Normal/Anime, NovelAI, Comic, Colored Manga, B&W Manga 중에서 연출 방식을 고릅니다.
3. **Animation addon**은 움직이는 스토리보드에만 더해집니다. 실제로 담아낼 수 있는 동작 하나와 카메라 움직임, 원문에 근거가 있는 대사와 소리, 분위기, 마무리 정지 구간을 설명합니다.
4. **Output contract**는 플래너가 돌려주는 구조화된 키프레임 결과를 정의합니다.

그다음 **Storyboard Illustration Prompt**(스토리보드 일러스트 프롬프트)가 계획된 첫 프레임을 이미지 제공자에 맞게 다듬습니다. 클립을 켜 두었다면 **Storyboard Video Prompt**(스토리보드 동영상 프롬프트)가 움직임 계획을 동영상 제공자에 맞게 다듬습니다.

Roleplay 프롬프트 라이브러리는 Game 플래너 라이브러리와 별개입니다. Roleplay 쪽 비주얼 스타일을 고쳐도 Game Mode의 정지 이미지 플래너나 애니메이션 플래너는 바뀌지 않습니다.

### Storyboard와 Illustrator 함께 쓰기

Storyboard는 Illustrator와 별개인 에이전트입니다. Illustrator를 직접 실행하는 조작과 Illustrator가 만드는 다른 미디어는 그대로 쓸 수 있습니다. Roleplay Storyboard를 **Still images**나 **Animations**로 두면, 그 응답에 한해 Marinara가 평소의 자동 전경 Illustrator 이미지를 만들지 않습니다. 두 에이전트가 응답 뒤에 서로 겹치는 미디어를 만들지 않도록 하기 위해서입니다. **Manual only**로 두면 평소 Illustrator 동작은 그대로 유지됩니다.

## Game Mode 스토리보드

Game Mode 스토리보드는 완료된 GM 서술 턴 하나만을 이야기 원본으로 씁니다. 먼저 숨은 GM 명령 태그를 걷어내고 순서가 있는 프레임을 계획한 다음, 프레임마다 턴 본문의 읽기 구간을 연결합니다. 뷰어는 읽는 위치가 그 구간을 지날 때마다 프레임을 바꿔 줍니다.

### 빠르게 시작하기

1. Storyboard를 설치하세요.
2. Game Mode 채팅을 새로 만들거나 기존 채팅을 여세요.
3. **Chat Settings > Agents**로 이동해 **Enable Agents**를 켜고, 이어서 **Enable Storyboards**를 켜세요.
4. 게임에 이미지 연결이 지정돼 있는지, 아니면 전역 Storyboard 설정이 이미지 연결을 제공하는지 확인하세요.
5. GM 서술 턴을 하나 끝내세요.
6. **Gallery**를 열고 **Create storyboard**를 선택하세요.

닫아 둔 게임 뷰어를 다시 열려면 **Gallery**에서 **View storyboard**(스토리보드 보기)를 선택하세요. 수동 생성은 현재 애니메이션 설정을 따릅니다. **Automatic Storyboard Animations**가 켜져 있으면 수동으로 만든 스토리보드도 클립을 함께 요청합니다.

### 자동 Game 스토리보드

Storyboard 카드에는 자동화 스위치가 2개 있습니다.

- **Automatic Storyboard Illustrations**(자동 스토리보드 일러스트)는 GM 턴이 끝나면 정지 키프레임을 만듭니다.
- **Automatic Storyboard Animations**(자동 스토리보드 애니메이션)는 키프레임마다 클립까지 만듭니다. 애니메이션을 켜면 일러스트도 함께 켜지고, 일러스트를 끄면 애니메이션도 꺼집니다.

자동 생성은 그 게임에서 Storyboard 에이전트가 활성화돼 있을 때만 동작합니다. 이미 스토리보드가 있는 턴에 두 번째 스토리보드를 만들지도 않습니다. 가장 최근 턴의 스토리보드를 일부러 하나 더 만들고 싶다면 **Gallery**의 수동 조작을 쓰세요.

Generation 설정에서 **Expose image prompts before sending**을 켜 두었다면, 수동으로 만드는 Game 스토리보드는 완성된 이미지 프롬프트를 먼저 보여 줄 수 있습니다. 자동 스토리보드는 확인 창을 띄우지 않고 그대로 진행하므로 게임 진행이 멈추지 않습니다.

### Game 설정

**Chat Settings > Agents > Storyboards**로 이동하세요.

| 설정 | 에이전트 기본값 | 기능 |
| --- | --- | --- |
| **Enable Storyboards** | 채팅마다 꺼짐 | 설치한 에이전트를 이 게임에서 활성화합니다 |
| **Automatic Storyboard Illustrations** | Automatic generation 값을 따름 | GM 턴이 끝날 때마다 정지 키프레임을 만듭니다 |
| **Automatic Storyboard Animations** | Automatic generation 값을 따름 | 키프레임마다 MP4 클립을 만듭니다 |
| **Keyframes per Turn** | 3(1에서 6까지) | 계획할 프레임 목표 개수입니다. 턴이 짧으면 더 적게 나올 수 있습니다 |
| **Animation Clip Duration**(애니메이션 클립 길이) | 5초(1에서 15까지) | 클립 하나에 요청하는 길이입니다. 제공자가 더 짧게 깎을 수 있습니다 |
| **Viewer Display** | Floating | 끌어서 옮기는 뷰어 또는 게임 배경 전체 |
| **Still Planner** | Still Keyframes | 완성형 정지 일러스트를 계획합니다 |
| **Animation Planner** | Comic Page Animation | 애니메이션에 바로 쓸 첫 프레임과 움직임 지시를 계획합니다 |
| **Use Storyboard Template**(스토리보드 템플릿 사용) | On | 선택한 최종 일러스트 포맷터를 적용합니다 |
| **Storyboard Illustration Prompt** | Game Scene Illustration | 계획한 프레임을 이미지 제공자에 맞게 다듬습니다 |
| **Storyboard Video Prompt** | Cinematic Scene Video | 첫 프레임과 움직임 계획을 동영상 제공자에 맞게 다듬습니다 |

이 패키지에는 NovelAI, 코믹, 만화, 애니메이션, LTX 계열 플래너도 들어 있습니다. 애니메이션 플래너를 고른다고 해서 동영상 생성이 저절로 켜지지는 않습니다. **Automatic Storyboard Animations**와 동영상 연결이 여전히 필요합니다.

### Game 프롬프트 체인

Game Mode는 정지 이미지 결과와 애니메이션 결과에 각각 다른 플래너를 씁니다.

```text
completed GM narration
  -> Still Planner or Animation Planner
  -> Storyboard Illustration Prompt
  -> image connection
  -> optional Storyboard Video Prompt
  -> video connection
```

플래너는 이야기 단락을 고르고 순서를 정합니다. 일러스트 프롬프트는 제공자에게 보낼 형식을 다듬는 포맷터일 뿐, 또 하나의 이야기 플래너가 아닙니다. 애니메이션을 켜 두면 애니메이션 플래너가 정확한 첫 프레임 설명과 움직임 지시를 함께 만들고, 동영상 프롬프트가 그 움직임 지시를 최종 요청으로 바꿉니다.

### 새로 정리한 Game Mode 설정 조합

아래 조합은 패키지가 적용하는 Storyboard 체인에 나머지 Game 설정과 제공자 설정을 짝지은 것입니다. 패키지에 해당 체인이 들어 있으면 그대로 적용하고, 없으면 적힌 선택 항목을 하나씩 직접 맞추세요.

#### Google 코믹 스토리보드

패키지가 적용하는 체인은 다음과 같습니다.

- **Illustration Planner**(일러스트 플래너): Still Keyframes
- **Animation Planner**: Comic Page Animation
- **Storyboard Illustration Prompt**: Game Scene Illustration
- **Storyboard Video Prompt**: Comic Page Video
- **Use Storyboard Template**: On

Game 쪽 확인 목록은 다음과 같습니다.

- **Visual Generation**(비주얼 생성): On
- **Image Connection**: Google/Nano Banana
- **Image Style**(이미지 스타일): Default
- 설정 단계에서 만들어진 아트 스타일을 그대로 두세요.
- **Automatic Storyboard Illustrations**: On
- **Automatic Storyboard Animations**: Off
- **Keyframes per Turn**: 3
- **Video Connection**: None

이렇게 하면 평범한 정지 스토리보드가 만들어집니다. 저장해 둔 Comic Page 애니메이션 체인은 나중에 동영상 연결을 고르고 **Automatic Storyboard Animations**를 켰을 때만 동작합니다.

#### NovelAI 태그 그대로 보내기

패키지가 적용하는 체인은 다음과 같습니다.

- **Illustration Planner**: NovelAI Keyframes
- **Storyboard Illustration Prompt**: 프롬프트 본문에 다음 내용만 담은 사용자 지정 선택지를 만드세요.

  ```text
  ${scenePrompt}
  ```

- **Use Storyboard Template**: On
- Animation Planner와 Storyboard Video Prompt는 그대로 두세요.

Game 쪽 확인 목록은 다음과 같습니다.

- **Image Style**: Danbooru
- **Use Campaign Art Style**(캠페인 아트 스타일 사용): Off
- **Attach Card Appearance**: Off
- **Send Avatar References**: Off
- **Use NovelAI Character Prompts**: Off
- **Queue media generation requests**(미디어 생성 요청 대기열 사용): On
- Danbooru 프로필에서 문장형 **Style Text**(스타일 텍스트)를 지우세요.
- 긍정 태그와 부정 태그, 일러스트 태그는 필요에 맞게 조정하세요.

이 전달용 사용자 지정 템플릿은 플래너가 만든 간결한 NovelAI 태그를 평소의 문장형 일러스트 포맷터로 감싸지 않고 그대로 보냅니다.

#### 로컬 Krea 2 + LTX 2.3

패키지가 적용하는 체인은 다음과 같습니다.

- **Illustration Planner**: Still Keyframes(정지 이미지만 만들 때 쓰는 대체 선택지)
- **Animation Planner**: LTX Simple Image-to-Video
- **Storyboard Illustration Prompt**: Storyboard First Frame
- **Storyboard Video Prompt**: Narration Passthrough
- **Use Storyboard Template**: On

VRAM이 8 GB인 GPU라면 480p에서 키프레임 1개로 시작하세요. 이 설정이 성공한 다음에 키프레임 3개와 더 높은 해상도로 옮겨 가세요. ComfyUI 연결과 플레이스홀더, 전체 확인 절차는 [Game Mode의 LTX 2.3 스토리보드](ltx-2-3-storyboards.md) 문서를 참고하세요.

### Storyboard Optimized 연출은 에이전트 스위치가 아닙니다

게임 설정 마법사의 **Storyboard Optimized**(스토리보드 최적화) 연출은 GM 서술 프롬프트를 바꿔서 턴에 그림으로 옮기기 좋은 시각적 장면이 더 뚜렷하게 담기게 합니다. 다만 Storyboard를 설치하거나 활성화하지 않고, 자동 미디어 생성을 켜지도, 이미지 연결이나 동영상 연결을 고르지도 않습니다.

Storyboard 에이전트는 Standard 연출에서도, Storyboard Optimized 연출에서도 쓸 수 있습니다. 에이전트 설치와 활성화는 따로 해야 합니다.

### 게임 뷰어

**Floating viewer**(플로팅 뷰어)는 게임 위에 떠 있는 패널로, 끌어서 옮기고 크기도 바꿀 수 있습니다. GM 서술에서 읽고 있는 위치를 따라가며 그 위치에 맞는 프레임을 보여 줍니다. 동영상이 준비되면 재생하고, 그렇지 않으면 프레임 이미지를 대신 보여 줍니다.

**Game background**(게임 배경)는 활성 프레임을 게임 조작 요소 뒤에 깝니다. 이 모드가 켜져 있는 동안에는 평소에 생성하던 장면 배경을 대신하므로 일반 **Generate background**(배경 생성) 조작을 쓸 수 없습니다. 배경 클립은 한 번만 재생되고 마지막 프레임에서 멈춥니다. 다시 재생, 재생/일시정지, 음소거는 게임 조작 요소에서 할 수 있습니다.

플로팅 뷰어를 닫으면 현재 턴 동안만 숨겨집니다. 다시 열려면 **Gallery > View storyboard**를 쓰세요.

## 이미지 프롬프트와 캐릭터 일관성

선택한 플래너와 최종 이미지 프롬프트는 하는 일이 서로 다릅니다.

- 플래너는 어떤 순간을 보여 줄지 정하고 프레임마다 시각적 내용을 씁니다.
- 최종 이미지 템플릿은 제공자에게 보낼 형식과 해당 캐릭터의 외형, 참조 이미지 처리, 장소 컨텍스트, 캠페인 아트 디렉션, 이미지 지시를 더합니다.

플래너가 이미지 제공자에게 그대로 보내야 할 프롬프트 문법을 이미 돌려주고 있다면 `${scenePrompt}` 같은 전달용 템플릿을 쓰세요. **Use the final image template**은 선택한 포맷터를 일부러 건너뛰고 싶을 때만 끄세요. 필수 이미지 지시는 그래도 적용됩니다.

캐릭터 모습을 더 일정하게 유지하려면 다음을 지키세요.

- 캐릭터 카드의 **Appearance**(외형) 필드를 구체적이고 최신 내용으로 유지하세요.
- 선택한 플래너가 필요한 외형 설명을 이미 전부 되풀이하고 있는 경우가 아니라면 **Attach Card Appearance**를 켜 두세요.
- 제공자가 참조 이미지를 받아들이고 아바타가 원하는 모습과 맞는다면 **Send Avatar References**를 켜 두세요.
- 한 프레임에 등장하는 인원은 적고 또렷하게 보이도록 잡으세요. Storyboard는 채팅에 있는 모든 캐릭터가 아니라 그 프레임에 실제로 보이는 캐릭터와 페르소나의 참조만 넣습니다.

**Use NovelAI character prompts**는 지원되는 공식 NovelAI V4/V4.5 연결로 보내는 요청에만 영향을 줍니다. 다른 제공자에서는 이 스위치를 켜 두어도 공용 프롬프트 경로를 씁니다.

## 비용과 성능

키프레임 하나하나가 별개의 이미지 작업입니다. 움직이는 스토리보드는 성공한 키프레임마다 동영상 작업을 하나씩 더합니다. 그래서 프레임 3개짜리 움직이는 스토리보드는 이미지 요청 3개와 동영상 요청 3개를 만들 수 있습니다.

새 제공자나 로컬 워크플로를 확인할 때는 정지 이미지와 키프레임 1개로 시작하세요. 기본 흐름이 안정적으로 돌아가는 것을 확인한 뒤에 프레임 개수와 클립 길이, 자동 생성 주기를 올리세요.

## 예전 스토리보드 시스템으로 만든 기존 게임

Storyboard는 이제 다운로드해서 쓰는 에이전트지만, 기존 Game 채팅에는 예전 엔진 내장 스토리보드 화면에서 지정한 설정이 그대로 남아 있을 수 있습니다. 패키지를 설치하면 Marinara는 그 값을 채팅별 재정의로 보존합니다. 잘 돌아가던 게임 설정을 버리지 않습니다.

그래서 예전에 만든 게임은 지금 에이전트 기본값과 다르게 동작할 수 있습니다. 어떤 항목을 다시 Storyboard 에이전트 기본값에 맞추고 싶다면 **Chat Settings > Agents > Storyboards**를 열고 그 항목의 되돌리기 버튼을 누르세요.

예전 설정은 이전 버전에서 옮겨 온 데이터일 뿐, 또 하나의 스토리보드 구현이 아닙니다. 지금 방식으로 생성하려면 Storyboard 패키지가 설치돼 있고 그 게임에서 활성화돼 있어야 합니다.

## 문제 해결

### Chat Settings에 Storyboard가 보이지 않을 때

- **Agents > Download Agents**에서 **Storyboard**를 설치하세요.
- Roleplay 채팅이나 Game 채팅에서 쓰세요. Conversation은 지원하지 않습니다.
- 패키지 버전이 설치된 엔진 버전과 호환되는지 확인하세요.

### Create storyboard는 보이는데 생성이 실패할 때

- 그 채팅에서 **Enable Agents**와 **Enable Storyboards**를 켜세요.
- Roleplay Storyboard 카드나 Game 설정, 또는 전역 Storyboard 설정에서 쓸 수 있는 이미지 생성 연결을 고르세요.
- 어시스턴트나 GM의 응답이 끝날 때까지 기다린 다음 다시 시도하세요.

### Roleplay에서 자동 에피소드가 만들어지지 않을 때

- **Manual only**가 아니라 **Still images**나 **Animations**를 고르세요.
- 어시스턴트 응답이 새로 완료될 때까지 기다리세요. 채팅을 열기만 해서는 예전 메시지를 소급해서 채우지 않습니다.
- **Messages per episode** 값을 확인하세요. 직전 성공 기준점 이후로 새 사용자 메시지와 어시스턴트 메시지가 그만큼 쌓여야 합니다.
- 실패한 실행은 기준점을 앞으로 옮기지 않습니다. 서버 로그에서 원래 발생한 제공자 오류나 파싱 오류를 확인하세요.

### 이미지는 나오는데 동영상이 없을 때

- Roleplay에서는 **Animations**를 고르고, Game Mode에서는 **Automatic Storyboard Animations**를 켜세요.
- **Video Generation**(동영상 생성) 연결을 고르세요.
- 그 동영상 연결이 이미지-투-비디오 입력을 지원하는지 확인하세요.
- **Gallery**의 **Videos** 탭을 확인하세요. 클립은 키프레임 이미지보다 늦게 완성되기도 합니다.
- LLM 호출이 실패해 계획이 대체 경로로 넘어갔다면, Marinara가 대체 이미지는 남기고 그 실행의 동영상은 건너뛸 수 있습니다.

### 스토리보드가 일부만 나오거나 멈춰 있을 때

제공자 작업이 하나 이상 실패했거나 시간이 초과됐거나 요청 한도 또는 콘텐츠 제한에 걸린 경우입니다. 제공자에 문제는 없는데 응답이 느리다면 `.env` 파일에서 `IMAGE_GEN_TIMEOUT_MS`나 `VIDEO_GEN_TIMEOUT_MS` 값을 늘린 다음 Marinara를 다시 시작하세요. 이 값은 시작할 때 한 번만 읽기 때문입니다.

플래너와 완성된 이미지 프롬프트, 참조 이미지 선택, 동영상 프롬프트를 확인하려면 **Debug mode**(디버그 모드)를 켜고 서버 로그에서 `storyboard`를 검색하세요. 디버그 로그에는 채팅 내용과 프롬프트가 그대로 담길 수 있습니다. 공유하기 전에 민감한 내용을 지우세요.

## 관련 가이드

- [에이전트: 채팅을 도와주는 AI](../agents/agents-overview.md)
- [다운로드 가능한 에이전트 레퍼런스](../agents/built-in-agents.md)
- [Game Mode: 시작하기](getting-started.md)
- [Roleplay Mode: 시작하기](../roleplay/getting-started.md)
- [이미지 생성 제공자](../media/image-providers.md)
- [장면 동영상 생성](../media/scene-video.md)
- [Game Mode의 LTX 2.3 스토리보드](ltx-2-3-storyboards.md)
