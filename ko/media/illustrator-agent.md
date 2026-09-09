# Illustrator 에이전트

이 가이드에서는 채팅을 이어 가는 동안 장면 그림을 그려 주는 내장 에이전트 **Illustrator**를 설명합니다. 어떤 일을 하고, 어떻게 켜고, 어떤 그림체를 쓸 수 있고, 연결이 왜 두 개 필요한지 알 수 있습니다.

## Illustrator 에이전트가 하는 일

에이전트는 채팅 하나에서 자동으로 동작하는 작은 AI 기능입니다. **Illustrator**는 후처리 에이전트입니다. 즉, AI가 답변을 마친 뒤에 실행됩니다. 방금 나온 답변을 읽고 그림으로 남길 만한 장면인지 판단합니다. 그럴 만하다고 판단하면 이미지 프롬프트를 써서 이미지 제공자에 보냅니다. 프롬프트는 무엇을 그릴지 이미지 모델에 알려 주는 설명문입니다.

Illustrator가 모든 메시지를 그리지는 않습니다. 기본값으로는 그림을 한 장 만든 뒤 사용자 메시지와 어시스턴트 메시지가 5개 쌓일 때까지 기다렸다가 다음 그림을 만듭니다. 같은 답변을 스와이프하거나 재생성하는 것은 이 간격에 포함되지 않습니다. 그림으로 남길 장면이 아니라고 판단하면 그냥 건너뛰고 아무것도 만들지 않습니다. 만들어진 그림은 모두 채팅 **Gallery**(갤러리)에 저장됩니다.

Illustrator는 **Roleplay**(롤플레이)와 **Game Mode**(게임 모드) 채팅에서 쓸 수 있고, 설치해 두면 Conversation(대화)의 셀카 기능도 함께 열립니다. 앱에 표시되는 짧은 설명은 다음과 같습니다: "Responsible for image and video generations." 이 가이드의 설정 절차와 옵션은 Roleplay 채팅 기준입니다. Game Mode는 대신 스위치 하나만 쓰며, 아래 Game Mode 절에서 설명합니다.

## 시작하기 전에

Illustrator는 이미지 프롬프트를 쓸 뿐이고, 실제로 그림을 그리려면 별도의 이미지 연결이 필요합니다. 이미지 연결은 OpenAI나 로컬 Stable Diffusion 서버 같은 이미지 제공자에 접속하는 데 필요한 정보를 저장해 둔 것입니다.

이미지 연결을 먼저 준비하세요. Illustrator에 이미지 연결을 지정하는 방법은 두 가지입니다.

1. 이미지 연결 하나를 기본값으로 지정합니다. **Connections**(연결) 패널을 열고 **Defaults**(기본값)를 펼친 다음 **Images**(이미지) 아래에서 고르세요.
2. 또는 Illustrator의 전체 설정 화면에서 전용 이미지 연결을 지정하세요(아래 **Open Setup**(설정 열기) 참고).

이미지 연결을 찾지 못하면 그림 생성이 실패하고 앱이 연결을 고르라고 안내합니다. 제공자를 추가하려면 [이미지 생성 제공자와 설정](image-providers.md)을 참고하세요.

## Illustrator 켜기

Illustrator는 기본값으로 꺼져 있습니다. **Roleplay** 채팅에서는 다음 순서로 추가하세요.

1. 그림을 넣고 싶은 채팅을 여세요.
2. 톱니바퀴 아이콘으로 **Chat Settings**(채팅 설정)를 여세요.
3. **Agents**(에이전트) 섹션을 찾아 **Enable Agents**(에이전트 활성화)를 켜세요.
4. **Misc Agents**(기타 에이전트) 그룹에서 **Illustrator**를 찾아 더하기 버튼으로 추가하세요.

이제 자체 옵션이 있는 **Illustrator** 설정 카드가 보입니다. 에이전트를 추가하면 토큰을 더 쓰고 턴마다 AI 호출도 늘어나므로, 패널에 예상 비용이 실시간으로 표시됩니다.

### Game Mode: Game Illustrator 토글

Game Mode는 위 절차를 쓰지 않으며 **Prompt Mode**(프롬프트 모드)나 **Prompt Model**(프롬프트 모델) 옵션도 표시하지 않습니다. 대신 게임의 **Chat Settings**를 열고 **Game Illustrator**(게임 Illustrator) 토글 하나만 켜면 됩니다. 설명은 다음과 같습니다: "Auto-generate scene illustrations, NPC portraits, and location backgrounds during gameplay."

## 프롬프트 모드

**Prompt Mode** 선택기는 Illustrator가 프롬프트를 쓸 때 사용할 그림체를 정합니다. 에이전트 카드에서는 이 선택기가 **Prompt**로 표시됩니다. 그 아래에는 다음 한 줄이 붙어 있습니다: "Prompt mode controls how Illustrator writes image prompts for this chat."

고를 수 있는 그림체는 다음과 같습니다.

- **Illustration**: 완성도 높은 장면 그림 한 장입니다. 가장 무난한 그림체입니다.
- **Comic Page**: 칸, 말풍선, 캡션, 효과음이 들어간 만화 페이지입니다.
- **Colored Manga**: 양식화된 말풍선과 효과음이 들어간 컬러 만화 장면입니다.
- **B&W Manga**: 펜선과 스크린톤 음영으로 그린 흑백 만화 페이지입니다.
- **Background**: 캐릭터가 없는 장소 그림 또는 상황 설명용 컷입니다.
- **Selfie**: 캐릭터가 직접 찍은 셀카나 가벼운 느낌의 캐릭터 사진입니다.

새로 추가한 Illustrator 에이전트는 **Background** 그림체로 시작합니다. 그림체는 선택기에서 언제든 바꿀 수 있습니다. 최종 이미지의 전체적인 분위기는 스타일 프로필에도 영향을 받습니다. 설정 방법은 [이미지 스타일 프로필](style-profiles.md)을 참고하세요.

## Prompt Model과 이미지 연결

Illustrator는 서로 다른 연결 두 개를 씁니다. 이 둘을 구분해 두면 좋습니다.

**Prompt Model**은 이미지 프롬프트를 쓰는 텍스트 모델입니다. 그림을 그리는 모델이 아닙니다. Illustrator 카드의 **Prompt Model** 드롭다운에서 고르세요. 기본값은 **Main chat model**이며, 채팅에서 이미 쓰고 있는 연결을 그대로 씁니다. 프롬프트를 다른 모델에 맡기고 싶다면 다른 텍스트 연결을 고르세요.

이미지 연결은 최종 그림을 실제로 그리는 이미지 제공자입니다. **시작하기 전에**에서 설명한 대로 **Defaults → Images** 아래에서 지정하거나 에이전트 전용 설정 화면에서 지정합니다.

## Attach Card Appearance와 Send Avatar References

Illustrator 카드의 토글 두 개는 캐릭터 외형을 일관되게 유지하는 데 도움이 됩니다. 둘 다 기본값은 꺼짐입니다.

**Attach Card Appearance**(카드 외형 첨부)는 장면에 등장하는 캐릭터마다 저장된 외형 설명을 이미지 프롬프트에 덧붙입니다. 도움말 문구는 다음과 같습니다: "Append matched character appearance lines to image prompts, using only visible/generated names." 캐릭터 설정 그대로 그림이 나오길 원할 때 켜세요.

**Send Avatar References**(아바타 참조 전송)는 캐릭터와 페르소나의 아바타 또는 스프라이트를 참조 이미지로 이미지 제공자에 보냅니다. 도움말 문구는 다음과 같습니다: "Send matching character and persona avatars or sprites as reference images when the provider supports them." 이미지 모델이 얼굴이나 복장을 따라 그리는 데 도움이 됩니다. 참조 이미지를 받지 않는 제공자도 있어서 효과는 고른 제공자에 따라 달라집니다.

## 추가 설정과 직접 실행하기

Illustrator 카드에는 **Open Setup** 버튼이 있습니다. 에이전트의 전체 설정 화면이 열리며, 실행 빈도를 조정하고 전용 이미지 연결을 지정할 수 있습니다.

수동으로만 생성하려면 **Run Interval**(실행 간격)을 **0**으로 설정하세요. 자동 장면 배경을 포함한 Illustrator의 자동 실행이 중지되지만 에이전트는 설치된 상태로 유지되며 Gallery 작업에서 계속 사용할 수 있습니다. 기본값은 여전히 **5**입니다. 자동 실행을 다시 시작하려면 양수 간격을 설정하세요. 채팅에 Illustrator를 추가할 때도 0을 선택할 수 있습니다.

기다리지 않고 원하는 순간에 그림을 만들 수도 있습니다. 채팅 **Gallery**를 열고 **Illustrate**(이미지 생성) 버튼을 누르세요. Illustrator가 즉시 한 번 실행되고, 작업하는 동안 버튼에 **Generating...**이 표시됩니다. 지금 이 장면을 그림으로 남기고 싶은데 에이전트가 아직 그리지 않았을 때 유용합니다.

## 관련 가이드

- [이미지 생성 제공자와 설정](image-providers.md)
- [이미지 스타일 프로필](style-profiles.md)
- [장면 배경과 Gallery](scene-backgrounds.md)
- [에이전트: 채팅을 도와주는 AI](../agents/agents-overview.md)
- [AI 제공자에 연결하기](../connections/connecting-to-a-provider.md)
