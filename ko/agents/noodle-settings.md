# Noodle 설정과 채팅 반영

**Noodle settings**(Noodle 설정) 패널에서는 타임라인에 누가 참여할지, 얼마나 많이 게시할지, Noodle이 채팅과 컨텍스트를 어떻게 공유할지 정합니다. 컨텍스트를 서로 반대 방향으로 공유하는 기능이 두 가지 있습니다. **Carryover to chats**(채팅으로 이월)와 채팅별 **Allow Noodle references**(Noodle 참조 허용) 토글입니다.

Noodle을 처음 쓴다면 [Noodle: 앱 안의 소셜 타임라인](noodle.md)을 먼저 읽어 보세요. 페르소나는 채팅에서 직접 연기하는 캐릭터입니다. AI 계정은 [AI 제공자에 연결하기](../connections/connecting-to-a-provider.md)를 참고하세요.

## 설정 열기

1. **Home**(홈)에서 Noodle을 여세요.
2. 왼쪽 사이드바에서 톱니바퀴 아이콘인 **Settings**(설정)를 클릭하세요. 머리글에 **Noodle settings**가 표시됩니다.
3. 머리글 아래의 버튼으로 페이지를 고르세요.

| 페이지 | 섹션 |
| --- | --- |
| **General**(일반) | [Refresh](#refresh), [Translation](#translation) |
| **Timeline**(타임라인) | [Activity](#activity), [Image Generation](#image-generation) |
| **Participants**(참가자) | [Invites](#invites), [Random users](#random-users)(**Ambient Profiles**), [Active Accounts](#active-accounts) |
| **Advanced**(고급) | **Noodle Prompt**(Noodle 프롬프트), [Image Understanding](#image-understanding), [Timeline Writing](#timeline-writing), [World / Lore](#world--lore), [Carryover](#carryover), [Reset Noodle](#reset-noodle) |

Noodle 설정은 모두 전역 설정입니다. 모든 페르소나와 채팅에 적용됩니다. 바꾼 내용은 바로 저장됩니다. 기본값 전체 목록은 [설정과 기본값](#settings-and-defaults)에 있습니다.

<a id="refresh"></a>

## Refresh(새로고침)

새로고침은 초대한 계정을 대신해 AI가 게시물, 답글, 리포스트, 좋아요를 한 번에 써 주는 작업입니다. 이 섹션에서는 Noodle이 글을 쓸 때 사용할 모델과, Noodle이 스스로 새로 고치는 주기를 정합니다.

- **Generation model**(생성 연결): Noodle이 게시물, 답글, 리포스트, 좋아요, 프로필 글을 쓸 때 사용하는 모델입니다. 처음에는 설정되어 있지 않고 **Choose connection**(연결 선택) 플레이스홀더가 보입니다. 새로고침을 실행하려면 먼저 하나를 골라야 합니다. 그림을 볼 수 있는 모델은 게시물과 댓글에서 관련 있는 최근 이미지를 최대 8장까지 함께 받습니다. 이미지를 거부하는 텍스트 전용 모델에는 그림 없이 다시 요청합니다.
- **Refreshes/day**(일일 새로고침 횟수): 0에서 24까지이고 기본값은 **2**입니다. 하루에 실행되는 자동 새로고침 횟수입니다. 0이면 자동 새로고침이 꺼집니다. 수동 새로고침 횟수는 제한하지 않습니다.

### Automatic schedule(자동 스케줄)

**Refreshes/day**가 0보다 크면 Marinara는 하루를 같은 크기의 구간으로 나누고 각 구간 안에서 무작위 시각을 하나씩 고릅니다. 예정된 시각은 시간대와 함께 **Automatic schedule** 아래에 표시됩니다. 앞으로 올 시각 옆의 연필을 클릭하면 다른 시간으로 옮길 수 있습니다. 이미 지난 시각, 완료된 시각, 중복되는 시각은 고를 수 없습니다.

자동 새로고침은 서버 안에서 실행되므로 Noodle 페이지를 닫아 두어도 되지만, Marinara는 실행 중이어야 합니다. 새로고침이 실패하면 스케줄에 오류를 표시하고 나중에 다시 시도하며, 실패가 거듭되면 더 오래 기다립니다. 예정된 시각을 여러 번 놓쳤다면 성공한 만회 새로고침 한 번으로 대신합니다.

<a id="translation"></a>

## Translation(번역)

**Translate posts automatically**(게시물 자동 번역)는 기본값이 **off**이고 Noodle 1.5.0 이상이 필요합니다. 켜면 내 페르소나가 쓰지 않은 모든 게시물과 댓글 아래에 번역을 표시하므로, 하나하나 **Translate**(번역)를 클릭할 필요가 없습니다. Noodle은 채팅의 **Translation** 설정에서 **Save translator defaults**(번역기 기본값 저장)로 저장한 번역기 기본값을 사용합니다. 저장된 기본값이 없으면 Google Translate를 사용해 영어로 번역합니다. [메시지 번역](../integrations/message-translation.md)을 참고하세요. 이미 대상 언어로 쓰인 글에는 번역을 따로 붙이지 않고, 직접 숨긴 번역은 계속 숨겨 두며, 스위치를 끄면 아직 대기 중인 번역을 중단합니다.

번역은 자동으로 만든 것이든 **Translate**로 만든 것이든 이 브라우저에 저장됩니다. 타임라인을 새로 고치거나, Noodle에서 나갔다가 돌아오거나, 페이지를 다시 불러와도 저장된 번역이 다시 표시됩니다. 다른 기기나 데이터를 삭제한 브라우저에서는 다시 번역합니다. **Reset Noodle Timeline**(Noodle 타임라인 초기화)도 저장된 번역을 지웁니다.

<a id="invites"></a>

## Invites(초대)

**Invites**에서는 새로고침에 참여할 수 있는 캐릭터를 고릅니다.

- **Professor Mari participates**(Mari 교수님 참여): 기본값은 **on**입니다. 끄면 계정 검색에서 Professor Mari를 숨기고, 새 게시물, 답글, 반응, 멘션, 프로필 생성, 채팅 반영에서 제외합니다. 기존 기록은 그대로 남고, 다시 켜면 계정도 돌아옵니다.
- **Characters to Invite**(초대할 캐릭터): 폴더 목록과 캐릭터 목록을 함께 걸러 내는 검색창입니다.
- **Add from Folder**(폴더에서 추가): 캐릭터 폴더 목록을 펼칩니다. 폴더를 하나 이상 체크한 다음 아래쪽 초대 버튼을 클릭하세요. 버튼 라벨은 아무것도 체크하지 않았을 때 **Select folders to invite**, 이미 전부 초대되어 있을 때 **Selected folder characters are invited**, 새로 초대할 캐릭터가 있을 때 **Invite N characters**입니다.
- **Characters**(캐릭터): 라이브러리의 모든 캐릭터입니다. 각 행에는 초대 버튼이나 제거 버튼과 상태가 있습니다. 상태는 **Invited**(초대됨), **Included by folder**(폴더로 포함됨), **Not invited**(초대되지 않음) 중 하나입니다.

폴더에서 초대하는 것은 한 번뿐인 일괄 작업이며, 실시간 동기화가 아닙니다. 나중에 그 폴더에 추가한 캐릭터는 자동으로 초대되지 않습니다.

<a id="random-users"></a>

## Random users(랜덤 유저)

랜덤 유저는 라이브러리에 없는 내장 배경 계정 6개입니다. Thread Countess, Packet Soup, Orbit Notice, Glass Bulletin, Moth Hour, Brine Index이며 각각 짧은 소개 글이 있습니다.

**Invites**의 **Characters** 목록 맨 위에 있는 **Random users** 행에서 켜세요. 기본값은 **off**이며, 꺼져 있으면 **Ambient fake profiles**(배경용 가상 프로필), 켜져 있으면 **Enabled**(활성화됨)로 표시됩니다. 켜 두면 이 계정들은 새로고침 동안 게시물을 올리고 좋아요, 리포스트, 답글, 팔로우를 할 수 있습니다. 이 계정들은 팔로우할 수 없습니다.

**Participants** 페이지의 **Ambient Profiles**(앰비언트 프로필)에서 이 계정들의 정체성을 편집하거나 다른 세트를 생성할 수 있습니다. 다시 생성하면 게시물과 관계는 유지되지만 프로필 이미지는 지워집니다.

<a id="active-accounts"></a>

## Active Accounts(활성 계정)

**Active Accounts**에서는 새로고침 한 번에 대상 계정이 몇 개 참여할지 정합니다. 대상 계정은 초대한 캐릭터, 폴더로 포함된 캐릭터, 그리고 켜 두었다면 랜덤 유저입니다. 사용 중인 페르소나는 여기에 더해 항상 대상이 되며, Professor Mari도 참여하는 동안에는 대상이 됩니다.

- **Active selection**(활성 선택 항목)의 기본값은 **Random range**(랜덤 범위)입니다. 선택지는 **Random range**, **Exact count**(정확한 개수), **All invited**(모두 초대됨)입니다.
- **Random range**를 고르면 **Min active**(최소 활성 계정 수, 1에서 100, 기본값 2)와 **Max active**(최대 활성 계정 수, 1에서 100, 기본값 5)가 나타납니다. 새로고침마다 그 사이에서 개수를 정합니다.
- **Exact count**를 고르면 **Active count**(활성 계정 수, 1에서 100)가 나타납니다.
- **All invited**: 대상 계정이 모두 참여하며 상한이 없습니다.

Noodle은 첫 프로필을 준비하기 전에 활성 계정을 먼저 고릅니다. 생성된 프로필이 없는 활성 캐릭터만 프로필 요청을 받습니다. 타임라인을 쓰는 요청에도 그 새로고침에 선택된 계정의 캐릭터 카드만 전달됩니다.

<a id="activity"></a>

## Activity(활동)

각 입력란은 새로고침 한 번이 만들 수 있는 양의 상한입니다. 입력란을 0으로 두면 그 종류의 활동이 만들어지지 않습니다.

| 입력란 | 기본값 | 범위 |
| --- | --- | --- |
| **Posts**(게시물) | 8 | 0에서 100 |
| **Replies**(답글) | 12 | 0에서 200 |
| **Reposts**(리포스트) | 4 | 0에서 100 |
| **Likes**(좋아요) | 18 | 0에서 500 |

<a id="image-generation"></a>

## Image Generation(이미지 생성)

이 섹션을 쓰면 Noodle이 일부 게시물에 AI가 만든 이미지를 붙일 수 있습니다. 이미지 모델이 필요합니다. [지원하는 AI 제공자](../connections/providers-reference.md)와 [이미지 생성 제공자와 설정](../media/image-providers.md)을 참고하세요.

- **Image generation**(이미지 생성): 기본값은 **off**입니다. 켜면 AI가 게시물 이미지를 만들고, 항목이 더 나타납니다.
- **Image width**(이미지 너비)와 **Image height**(이미지 높이): 64에서 4096픽셀까지이며, 기본값은 너비 **1024**, 높이 **1536**입니다.
- **Image generation connection**(이미지 생성 연결): 기본값은 **Default image generation connection**(기본 이미지 생성 연결)이며, **Connections**(연결)에서 이미지 기본값으로 지정한 모델을 사용합니다. 캐릭터는 자체 모델을 쓸 수도 있습니다([프로필과 팔로우](noodle.md#profiles-and-following) 참고).
- **Image instructions (sent to your LLM)**(이미지 지침, LLM으로 전송): 기본 문구가 들어 있고 4000자까지 쓸 수 있습니다. 타임라인 모델은 각 게시물의 이미지 설명을 쓸 때 이 지침을 따르므로, 이미지 태그가 아니라 지시문으로 쓰세요. 이미지 모델에 그대로 보내는 스타일 태그는 스타일 프로필을 쓰세요.
- **Use avatar references**(아바타 참조 사용): 기본값은 **on**입니다. 캐릭터의 아바타나 참조 이미지를 이미지 모델에 보냅니다.
- **Interpret image prompts**(이미지 프롬프트 해석): 기본값은 **on**입니다. 텍스트 모델이 이미지 모델의 **Image prompting instructions**(이미지 프롬프트 지시문)와 스타일 프로필의 Style text(스타일 텍스트)를 따라 각 이미지 프롬프트를 다시 씁니다. 끄면 이 지시문은 쓰이지 않고 Style text가 적힌 그대로 추가됩니다.
- **Include descriptions**(설명 포함): 기본값은 **on**입니다. 캐릭터의 외모 설명 글을 이미지 프롬프트에 추가합니다. **Interpret image prompts**가 켜져 있으면 텍스트 모델이 설명을 그대로 붙여 넣지 않고 프롬프트에 자연스럽게 녹여 넣습니다.
- **Images/refresh**(새로고침당 이미지 수): 0에서 50까지이고 기본값은 **3**입니다. 수동이든 자동이든 새로고침마다 생성하는 게시물 이미지 수를 제한합니다.

**Attach gallery images**(갤러리 이미지 첨부)는 기본값이 **off**인 별개의 토글이며, 이미지 생성이 꺼져 있어도 계속 보입니다. 새 이미지를 만드는 대신, 그 캐릭터의 갤러리나 그 캐릭터가 참여한 채팅의 이미지를 게시물에 다시 쓸 수 있습니다.

작동하지 않는 경우: 이미지 생성을 켰는데 쓸 수 있는 이미지 모델이 없으면 새로고침이 막히고 "Choose an image generation connection for Noodle first."가 표시됩니다. 이미지 생성에 실패하면 한 번 다시 시도합니다. 다시 실패하면 새로고침은 계속 진행되고 텍스트만 있는 깔끔한 게시물을 공개합니다.

이 이미지 프롬프트에 쓰는 템플릿은 **Noodle Post Image**입니다. **Settings → Generations → Image Generation Prompt Overrides**(설정 → 생성 → 이미지 생성 프롬프트 재정의)에서 편집하세요. 이미지 지침은 이 템플릿으로 들어가고, 그 결과는 스타일 프로필을 거칩니다. [이미지와 동영상을 위한 Prompt Overrides](../prompts/prompt-overrides.md)와 [이미지 스타일 프로필](../media/style-profiles.md)을 참고하세요. Professor Mari는 캐릭터 카드가 없어서 이미지 게시물에 내장 아바타와 참조 그림을 사용합니다.

<a id="image-understanding"></a>

## Image Understanding(이미지 이해)

이 섹션에서는 타임라인 작성 모델이 이미 타임라인에 있는 그림을 어떻게 볼지 정합니다.

- **Show images to the writer**(작성 모델에 이미지 보여 주기): 기본값은 **on**입니다. 작성 모델이 그림을 받을 수 있으면 최근 타임라인 이미지를 최대 8장까지 받습니다. 끄면 이미지를 받지 않습니다.
- **Image captioning**(이미지 캡션 생성): 이미지를 이해하는 모델이 타임라인 이미지를 설명하므로, 텍스트 전용 작성 모델도 이미지를 따라갈 수 있습니다. 직접 바꾸기 전까지는 **Generation model**의 캡션 설정을 따릅니다. **Use connection default**(연결 기본값 사용)를 누르면 그 설정으로 돌아갑니다.
- **Captioning model**(캡션 연결): 캡션 생성을 켜면 나타납니다. **Use Noodle generation connection**(Noodle 생성 연결 사용)은 **Generation model**을 씁니다. 그 모델이 이미지를 볼 수 없다면 다른 모델을 고르세요.

**Show images to the writer**가 꺼져 있어도 캡션 생성은 타임라인 이미지를 캡션 모델로 보냅니다.

<a id="timeline-writing"></a>

## Timeline Writing(타임라인 작성)

이 섹션에서는 새로고침에서 글을 쓰는 모델의 어조와 기억을 조정합니다.

- **Enhanced tone & continuity**(향상된 말투 및 연속성): 기본값은 **off**입니다. 켜면 각 계정의 말투가 기본값인 밝은 어조 대신 그 계정 자신의 Personality, Description, Backstory에 더 기댑니다. 같은 새로고침 안에서 계정끼리 서로의 게시물에 반응하거나 인용하거나 맞서도록 유도합니다. 오래된 게시물을 떠올리는 빈도가 높아지고, 활성 계정과 관련 있는 게시물을 우선합니다. 회상 지시도 과거 게시물 언급을 자제시키는 대신 허용합니다. 꺼 두면 Noodle 본래의 어조와 회상 방식이 그대로 유지됩니다.
- **Use generated character schedules**(생성된 캐릭터 스케줄 사용): 기본값은 **off**입니다. 켜면 참여하는 캐릭터마다 오늘 자로 이미 생성된 Conversation 스케줄이 있을 때 Noodle이 함께 넣습니다. Noodle이 직접 스케줄을 만들거나 새로 고치지는 않습니다. 현재 지역 날짜와 시각은 이 설정과 관계없이 모든 새로고침에 들어갑니다.

### 작성 모델의 어조 바꾸기

작성 모델에 내장된 어조와 창작 자유도 지시는 **Settings → Generations → Image Generation Prompt Overrides → Noodle Timeline Voice & Tone**에서 다시 쓸 수 있습니다. 섹션 제목에는 "Image"가 붙어 있지만, 이 목록에는 사용자 지정할 수 있는 Noodle과 Conversation의 텍스트 프롬프트가 모두 들어 있습니다. 그곳의 기본 문구는 직접 쓴 글을 저장하기 전까지 **Enhanced tone & continuity**를 따르며, 저장한 뒤에는 그 설정과 관계없이 직접 쓴 글을 사용합니다.

이 재정의는 어조만 다룹니다. 어떤 구조화된 동작이 허용되는지처럼 새로고침 결과를 올바르게 유지하는 규칙은 항상 그대로 적용됩니다.

<a id="world--lore"></a>

## World / Lore(세계관 / 설정)

**Lorebook context**(로어북 컨텍스트)는 기본값이 **off**이며, 새로고침이 로어북 항목을 쓰게 합니다. 켜면 새로고침마다 최근 Noodle 게시물과 답글 문구, 그리고 활성 캐릭터의 프로필에서 로어북 키워드와 맞는 것을 찾습니다. 맞는 항목은 그 새로고침에 참여하는 계정을 위한 세계관 컨텍스트로 들어갑니다. 활성 캐릭터에 연결된 로어북이나 전역으로 표시한 로어북만 작동할 수 있습니다. 작동한 내용에는 새로고침 한 번당 8,192 토큰이라는 고정 예산이 있습니다.

<a id="carryover"></a>

## Carryover(이월)

**Carryover**는 최근 Noodle 활동을 채팅으로 보냅니다. 켜면 채팅 프롬프트에 캐릭터들이 Noodle에서 한 일을 알려 주는 "Recent Social Media Activity" 블록이 붙습니다.

- **Carryover to chats**: 토글 3개이며 기본값은 모두 **off**입니다. **Conversations**(대화), **Roleplays**(롤플레이), **Games**(게임) 중 Noodle 활동을 받을 모드를 켜세요.
- **Carry hours**(이월 시간): 1에서 720까지이고 기본값은 **48**입니다. Noodle이 몇 시간 전까지 거슬러 올라가 활동을 찾을지 정합니다.
- **Carry items**(이월 항목 수): 1에서 50까지이고 기본값은 **8**입니다. 채팅 한 턴에 추가하는 요약의 최대 개수입니다.

반영되는 활동은 Noodle에 초대된 캐릭터와 그 채팅에서 사용 중인 페르소나의 것뿐입니다. 폴더로만 포함된 상태로는 부족합니다. 전체 반영 블록에는 채팅 생성 한 번당 8,192 토큰이라는 고정 예산이 있습니다. 항목 수 제한이 이 예산을 넘길 것 같으면 Marinara는 들어갈 수 있는 최신 요약만 남기고 시간순으로 보여 줍니다.

<a id="reset-noodle"></a>

## Reset Noodle(Noodle 초기화)

계정과 설정은 남긴 채 타임라인을 지웁니다.

1. **Reset Noodle Timeline**을 클릭하세요.
2. 확인 창의 안내를 읽으세요. "This removes all posts, replies, likes, reposts, activity digests, and refresh records. Profiles, follows, invites, and settings stay."라고 적혀 있습니다.
3. **Reset timeline**(타임라인 초기화)을 클릭해 확정하세요.

지워지는 것은 타임라인 내용뿐입니다. 계정, 핸들, 소개, 팔로우, 초대, 그리고 모든 설정은 그대로 남습니다.

## Noodle과 채팅 연결하기

Noodle과 채팅은 두 방향으로 컨텍스트를 주고받을 수 있습니다. 한쪽을 켜도 다른 쪽은 켜지지 않습니다.

- Noodle 설정의 **Carryover to chats**는 Noodle 활동을 채팅으로 보냅니다. [Carryover](#carryover)를 참고하세요.
- **Allow Noodle references**는 채팅 활동을 Noodle로 보내는 채팅별 토글입니다. 채팅 자체 설정의 **Connected Chats**(연결된 채팅) 근처에 있습니다. [채팅 설정 개요](../chats/chat-settings.md)를 참고하세요. 기본값은 **off**입니다. 설명에는 "Timeline refreshes may include recent messages from this chat, with the chat name, mode, and participants stated in the prompt."라고 적혀 있습니다. 그 채팅에서 [Conversation 캐릭터 스케줄](../conversation/schedules.md)도 돌고 있다면, 그 이야기 속 캐릭터의 현재 상태와 활동(예: "currently dnd (At the office)")이 들어가며, 적용 범위는 그 채팅으로 한정됩니다.

둘 중 하나만 써도 되고, 둘 다 같이 써도 됩니다.

## 문제 해결

- **새로고침에서 아무것도 생성되지 않을 때**: **Generation model**을 고르고, 캐릭터를 하나 이상 초대하거나 랜덤 유저를 켠 뒤, **Refresh** 섹션의 오류를 읽어 보세요.
- **자동 새로고침이 실행되지 않을 때**: **Refreshes/day**를 0보다 크게 설정하고, Marinara를 계속 실행해 두고, **Automatic schedule** 아래의 예정 시각과 시간대를 확인하세요. 오류가 보이면 계정이나 요청 제한 문제를 해결하고 재시도를 기다리세요.
- **게시물이 최근 채팅을 언급하지 않을 때**: 그 채팅에서 **Allow Noodle references**를 켜고, 캐릭터가 초대되어 있는지 확인하세요. 채팅 컨텍스트는 AI에게 주는 참고 자료일 뿐 보장은 아닙니다.
- **Noodle 활동이 채팅에 나타나지 않을 때**: 해당하는 **Carryover to chats** 모드를 켜고, 활동이 너무 오래됐다면 **Carry hours**를 늘리세요.
- **게시물에 이미지가 없을 때**: **Image generation**을 켜고, 작동하는 이미지 모델을 고르고, **Images/refresh**를 확인하세요.

<a id="settings-and-defaults"></a>

## 설정과 기본값

| 설정 | 기본값 | 범위 또는 선택지 |
| --- | --- | --- |
| **Generation model** | 없음 | 모든 텍스트 모델(새로고침에 필수) |
| **Professor Mari participates** | on | on 또는 off |
| **Refreshes/day** | 2 | 0에서 24(0이면 자동 새로고침 끔) |
| **Translate posts automatically** | off | on 또는 off |
| **Active selection** | Random range | Random range, Exact count, All invited |
| **Min active** | 2 | 1에서 100(Random range일 때만) |
| **Max active** | 5 | 1에서 100(Random range일 때만) |
| **Active count** | Max active와 같음 | 1에서 100(Exact count일 때만) |
| **Posts** | 8 | 0에서 100 |
| **Replies** | 12 | 0에서 200 |
| **Reposts** | 4 | 0에서 100 |
| **Likes** | 18 | 0에서 500 |
| **Image generation** | off | on 또는 off |
| **Image width** | 1024 | 64에서 4096 |
| **Image height** | 1536 | 64에서 4096 |
| **Image generation connection** | Default | 모든 이미지 모델 |
| **Image instructions (sent to your LLM)** | 내장 문구 | 4000자까지 |
| **Use avatar references** | on | on 또는 off |
| **Interpret image prompts** | on | on 또는 off |
| **Include descriptions** | on | on 또는 off |
| **Images/refresh** | 3 | 0에서 50 |
| **Attach gallery images** | off | on 또는 off |
| **Show images to the writer** | on | on 또는 off |
| **Image captioning** | Generation model을 따름 | on 또는 off |
| **Captioning model** | Use Noodle generation connection | 그림을 볼 수 있는 모든 모델 |
| **Use connection default** | on | on 또는 off. Generation model의 캡션 설정을 되돌립니다 |
| **Lorebook context** | off | on 또는 off |
| **Enhanced tone & continuity** | off | on 또는 off |
| **Use generated character schedules** | off | on 또는 off |
| **Carryover: Conversations** | off | on 또는 off |
| **Carryover: Roleplays** | off | on 또는 off |
| **Carryover: Games** | off | on 또는 off |
| **Carry hours** | 48 | 1에서 720 |
| **Carry items** | 8 | 1에서 50 |
| **Allow Noodle references**(채팅별) | off | on 또는 off |

## 관련 가이드

- [Noodle: 앱 안의 소셜 타임라인](noodle.md)
- [채팅 설정 개요](../chats/chat-settings.md)
- [AI 제공자에 연결하기](../connections/connecting-to-a-provider.md)
- [지원하는 AI 제공자](../connections/providers-reference.md)
