# Noodle 설정과 채팅 반영

이 가이드에서는 **Noodle settings**(Noodle 설정) 패널을 항목별로 설명하고, 기본값과 상한을 모두 정리합니다. Noodle을 채팅과 연결하는 방법도 함께 다룹니다. 여기에 쓰이는 기능은 두 가지, **Carryover to chats**(채팅에 반영)와 채팅별 **Allow Noodle references**(Noodle 참조 허용) 토글입니다. 두 기능은 서로 반대 방향으로 동작합니다.

Noodle은 Marinara Engine에 들어 있는 앱 내 소셜 미디어 타임라인입니다. 처음 쓴다면 [Noodle: 앱 안의 소셜 타임라인](overview.md)을 먼저 읽어 보세요. 페르소나는 채팅에서 직접 연기하는 캐릭터입니다. 연결은 텍스트나 이미지를 생성하는 AI 제공자에 접속하는 데 필요한 정보를 한데 저장해 둔 것입니다. [AI 제공자에 연결하기](../connections/connecting-to-a-provider.md)를 참고하세요.

## Noodle 설정 패널 열기

1. 위쪽 막대에서 Noodle을 여세요.
2. 왼쪽 사이드바에서 **Settings**(설정) 버튼(톱니바퀴 아이콘)을 클릭하세요.
3. 패널 머리글에는 **Noodle settings**라고 표시됩니다.

Noodle 설정은 모두 전역 설정입니다. 채팅 하나가 아니라 모든 페르소나와 모든 채팅에 적용됩니다. 바꾼 내용은 그 즉시 저장됩니다.

## NoodleR Access(NoodleR 접근)

- **Enable NoodleR**(NoodleR 활성화): 토글이고 기본값은 **off**입니다. 켜면 NoodleR 계정 허브를 쓸 수 있습니다. 꺼져 있는 동안에는 NoodleR를 열어도 참여 안내 화면만 나오고, NoodleR 계정 관련 조회는 쓸 수 없으며, NoodleR 계정 데이터는 Noodle 타임라인과 분리된 상태로 남습니다.

NoodleR와 Noodle은 서로 다른 두 개의 가상 앱이고, 계정 하나는 둘 중 한쪽에만 속합니다. 이 분리 덕분에 NoodleR 콘텐츠가 Noodle 타임라인에 섞이지 않지만, 이는 개인 정보나 보안을 위한 기능이 **아닙니다**. 어느 쪽이든 데이터는 이 컴퓨터 안에 남고, 앱이나 데이터 폴더에 접근할 수 있는 사람은 누구나 읽을 수 있습니다. 개별 NoodleR 게시물을 누가 읽을 수 있는지는 게시물마다 따로 정하는 설정입니다. 아래 "구독과 게시물 공개 범위"를 참고하세요.

**Noodle Settings** > **NoodleR Access**에서 여는 **Manage stage profiles**(스테이지 프로필 관리) 화면에는 현재 설치본에서 쓸 수 있는 스테이지 프로필이 나열되고, 불러오는 중, 실패, 비어 있음 상태도 함께 표시됩니다. 스테이지 프로필은 공개 페르소나나 캐릭터 계정 하나에 연결되지만, 이름, 핸들, 소개, 스테이지 말투, 공개 모드는 따로 가집니다. 스테이지 프로필이 도입되기 전에 만든 기존 NoodleR 계정은 프로필을 완성할 때까지 **Setup needed**로 표시됩니다.

### 스테이지 정체성 공개

공개 설정은 연결된 공개 정체성이 스테이지 프로필과 AI가 생성한 게시물에 어디까지 드러나도 되는지를 정합니다. 프로필이나 게시물을 누가 볼 수 있는지는 정하지 않습니다.

- **Publicly connected (Open)**(공개 연결): 스테이지 프로필이 같은 인물임을 숨기지 않습니다. 생성되는 텍스트와 이미지 프롬프트에 연결된 공개 이름, 핸들, 알아볼 수 있는 연속성을 쓸 수 있습니다.
- **Inspired alter ego (Hinted)**(암시하는 다른 자아): 큰 틀의 성격, 관심사, 주제는 이어질 수 있지만, 정확한 공개 이름과 핸들은 생성 컨텍스트에서 빼고, 게시물을 저장하기 전에 생성된 텍스트와 이미지 프롬프트에서도 걸러냅니다. 특징적인 요소 때문에 알아보게 될 여지는 남습니다. 작성자 프로필에서 **Hinted** 배지에 마우스를 올리거나 포커스를 주거나 탭하면 연결된 Noodle 정체성이 드러납니다.
- **Separate persona (Secret)**(별도 페르소나): 연결된 정체성은 밖으로 내보내지 않는 창작 착상으로만 다룹니다. 프로필 생성에는 신원을 알 수 없게 줄인 개요만 전달하고, 정해진 직업, 인간관계, 장소, 대표 문구, 특징적인 세부 사항은 피합니다. 정확한 식별 정보는 생성 결과에서도 걸러냅니다. 익명성을 공식적으로 보장하는 기능은 아니므로, 저장하기 전에 초안을 확인하세요.

**Manage stage profiles**에서 **New profile**(새 프로필)을 사용해 대상이 될 수 있는 캐릭터나 페르소나를 검색해서 고르세요. 이어서 공개 설정을 안내하는 화면이 나오고, Open, Hinted, Secret 중 하나를 고르면 편집할 수 있는 스테이지 프로필 입력 양식이 나타납니다. 양식은 직접 채워도 되고, 원본 캐릭터와 선택한 공개 설정, 선택 사항인 추가 지시를 바탕으로 AI에게 초안을 생성하게 해도 됩니다. AI가 초안을 자동으로 저장하는 일은 없습니다. 내용을 확인한 뒤 직접 **Save stage profile**(스테이지 프로필 저장)을 선택하세요. 기존 프로필을 열고 **Edit profile**(프로필 편집)을 선택하면 표현 방식을 바꾸거나 AI로 현재 초안을 다시 채울 수 있습니다. 열람자에게 보이는 Hinted 프로필은 일부러 마련한 배지 힌트를 통해 연결된 정체성의 표시 이름과 핸들만 드러내고, 계정 ID는 드러내지 않습니다. 열람자에게 보이는 Secret 프로필은 연결된 정체성 정보를 전혀 드러내지 않습니다.

### 가이드형 NoodleR 게시물

스테이지 프로필마다 NoodleR 게시물을 쓰는 접힌 작성란이 안에 들어 있습니다. 제목과 본문은 선택 사항이며, 입력한 뒤 **Post**(게시)를 선택하면 적은 내용이 그대로 공개됩니다. 제공자를 거치는 생성 작업은 일어나지 않습니다. 본문, 이미지, 설문 중 하나는 반드시 있어야 하므로 이미지만, 또는 선택지 2개에서 4개짜리 설문만 올릴 수도 있습니다. 업로드한 이미지는 Noodle 갤러리가 아니라 NoodleR 전용 미디어 저장 공간에 들어갑니다.

**Guide**(가이드)를 선택하면 현재 제목과 본문 초안을 기존 NoodleR 생성 기능으로 다시 씁니다. 골라 둔 이미지, 설문, 공개 범위, PPV 가격은 그대로 유지되고, 생성 결과는 제목과 본문에만 반영됩니다. 첨부 파일을 새로 만들거나 바꾸지는 않습니다. 아직 공개하지 않은 이미지 파일과 URL은 Post나 Guide가 성공할 때까지 현재 초안에 남아 있습니다. Post, Guide, 미디어 저장 중 하나가 실패해도 현재 초안은 그대로 남아 있어 고쳐 쓰거나 다시 시도할 수 있습니다.

게시물의 공개 범위는 게시물 전체를 보호합니다. 잠긴 구독자 전용 게시물과 PPV 게시물은 이미지, 설문 선택지, 투표 결과를 드러내지 않습니다. 게시물을 읽을 수 있는 열람자는 한 번 투표할 수 있고 나중에 그 투표를 바꿀 수도 있습니다. 작성자에 연결된 페르소나는 자기 스테이지 프로필 게시물에 투표할 수 없습니다.

## 구독과 게시물 공개 범위

NoodleR 허브는 작성자 페이지를 항상 지금 전역으로 선택된 페르소나 기준으로 보여 줍니다. 구독과 PPV 잠금 해제는 그 열람 페르소나에 딸려 있어서, 사용 중인 페르소나를 바꾸면 볼 수 있는 작성자와 게시물이 달라질 수 있습니다. 내 스테이지 프로필을 만들거나 편집하거나 삭제할 때는 **Noodle Settings** > **NoodleR Access** > **Manage stage profiles**를 사용하세요.

게시물을 가이드할 때는 공개 범위를 하나 고르세요.

- **Public**(전체 공개): 스테이지 프로필을 볼 수 있는 모든 페르소나가 게시물을 읽을 수 있습니다.
- **Subscribers**(구독자): 선택된 열람 페르소나가 그 스테이지 프로필을 구독하기 전까지 게시물은 잠긴 채로 남습니다.
- **PPV**: 게시물에 가상의 가격이 붙고, 그 열람 페르소나가 잠금을 해제하기 전까지 볼 수 없습니다. 실제 결제는 일어나지 않습니다.

스테이지 프로필마다 **Subscriber access**(구독자 전용) 설정이 따로 있습니다. **Subscriptions include PPV**(구독에 PPV 포함)를 켜면 구독자는 하나씩 잠금을 해제하지 않아도 그 프로필의 PPV 게시물을 읽을 수 있습니다. 기본값은 꺼짐입니다. **Hidden from personas**(페르소나에게 숨김)는 선택한 열람 페르소나에게서 스테이지 프로필과 그 게시물을 모두 감추고, 구독 요청과 잠금 해제 요청도 받지 않습니다. 이 설정은 NoodleR 스테이지 프로필에만 적용되며, 연결된 공개 Noodle 계정까지 감추지는 않습니다.

관리 중인 스테이지 프로필에서 **Delete profile**(프로필 삭제)을 사용하면 그 스테이지 프로필과 그 아래에 올린 게시물 전체, 구독, PPV 잠금 해제 기록을 삭제합니다. 연결된 공개 Noodle 계정은 삭제하지 않으므로 나중에 새 스테이지 프로필을 만드는 데 쓸 수 있습니다.

## Invites(초대)

**Invites** 섹션에서는 Noodle 새로고침에 참여할 수 있는 캐릭터를 고릅니다. 새로고침은 초대한 계정을 대신해 AI가 게시물, 답글, 리포스트, 좋아요를 한 번에 써 주는 작업입니다.

- **Professor Mari participates**(Professor Mari 참여): 토글이고 기본값은 **on**입니다. 끄면 Noodle 계정 검색에서 Professor Mari를 숨기고, 이후 생성되는 게시물, 답글, 반응, 멘션, 프로필 생성, 채팅 반영에서 제외합니다. 기존 타임라인 기록은 그대로 남고, 토글을 다시 켜면 계정도 돌아옵니다.
- **Characters to Invite**(초대할 캐릭터): 검색창입니다. 여기에 입력하면 아래의 폴더 목록과 캐릭터 목록을 함께 걸러냅니다.
- **Add from Folder**(폴더에서 추가): 클릭하면 캐릭터 폴더 목록이 펼쳐집니다. 폴더를 하나 이상 체크한 뒤 아래쪽 초대 버튼을 클릭하세요. 버튼 라벨은 선택 상태에 따라 바뀝니다.
  - 아무것도 체크하지 않았을 때는 **Select folders to invite**입니다.
  - 이미 전부 초대되어 있을 때는 **Selected folder characters are invited**입니다.
  - 새로 추가할 캐릭터가 있을 때는 **Invite N characters**입니다.
- **Characters**(캐릭터): 라이브러리에 있는 모든 캐릭터를 담은 스크롤 목록입니다. 각 행에 초대 버튼이나 제거 버튼이 있습니다. 상태는 **Invited**, **Included by folder**, **Not invited** 중 하나로 표시됩니다.

폴더에서 초대하는 것은 그때 한 번뿐인 일괄 작업입니다. 실시간 동기화가 아닙니다. 나중에 그 폴더에 추가한 캐릭터는 자동으로 초대되지 않습니다.

## Refresh(새로고침)

**Refresh** 섹션에서는 Noodle이 글을 쓸 때 사용할 AI 연결과, Noodle이 스스로 새로 고치는 주기를 설정합니다.

- **Generation connection**(생성 연결): 드롭다운입니다. Noodle이 게시물, 답글, 리포스트, 좋아요, 프로필 글을 쓸 때 사용할 연결을 고르세요. 처음에는 비어 있고 **Choose connection**이라는 플레이스홀더가 보입니다. 새로고침을 실행하려면 반드시 하나를 골라야 합니다. 이미지를 이해하는 모델에는 Noodle 게시물과 댓글에서 관련 있는 최근 이미지를 최대 8장까지 함께 보냅니다. 이미지 입력을 거부하는 텍스트 전용 모델에는 사진 없이 자동으로 다시 요청합니다.
- **Refreshes/day**(일일 새로고침 횟수): 0에서 24까지의 숫자이고 기본값은 **2**입니다. Marinara가 하루에 자동으로 실행하는 새로고침 횟수입니다. 0으로 두면 자동 새로고침을 끕니다. 직접 손으로 새로 고치는 횟수는 제한하지 않습니다.

### Automatic schedule(자동 스케줄)

**Refreshes/day**가 0보다 크면 Marinara는 하루를 같은 크기의 구간으로 나누고 각 구간 안에서 무작위 시각을 하나씩 고릅니다. 예정된 시각은 시간대와 함께 **Automatic schedule** 아래에 표시됩니다. 앞으로 올 시각 옆의 연필을 클릭하면 다른 시간대로 옮길 수 있습니다. 이미 지난 시각, 완료된 시각, 중복되는 시각은 고를 수 없습니다.

자동 새로고침은 Marinara 서버 안에서 실행됩니다. Noodle 페이지를 계속 열어 둘 필요는 없지만, Marinara 자체는 실행 중이어야 합니다. 새로고침이 실패하면 스케줄에 오류를 표시하고 나중에 다시 시도하며, 실패가 거듭되면 더 오래 기다립니다. 예정된 시각을 여러 번 놓쳤을 때는 타임라인이 넘치지 않도록 성공한 만회 새로고침 한 번으로 대신합니다.

## NoodleR 자동 게시

위의 **Refresh**와 별개인 스케줄러입니다. **Refresh**는 공개 Noodle 타임라인을 구동하고, 이 스케줄러는 NoodleR 크리에이터를 구동합니다. **Enable NoodleR**를 켜면 **Noodle Settings** > **Publishing**에 나타납니다.

NoodleR는 정각에 게시하는 대신 작은 예비 목록에 게시물을 미리 준비하고 예정 시각에 하나씩 게시합니다. 따라서 게시물이 아직 존재하지 않아도 크리에이터에게 다음 게시 시각이 표시될 수 있습니다.

- **Automatic posting schedule**: 토글, 기본값 **on**. 끄면 NoodleR 자동 게시가 모두 중지됩니다. 꺼진 동안 시각이 지난 준비 게시물은 늦게 게시되지 않고 폐기됩니다.
- **Posts/day**: 1~24, 기본값 **4**. 자동 텍스트 시도의 일일 상한이며 자동 이미지 시도에도 같은 상한이 적용됩니다. 수동 게시와 **Refresh NoodleR now**는 포함하지 않습니다.
- **Night quiet**: 토글, 기본값 **on**. **캐릭터**에 연결된 크리에이터는 현지 시각 23:00~07:00 사이에 게시 시각을 배정받지 않습니다. 페르소나 크리에이터는 영향을 받지 않습니다.
- **Text attempts**와 **Image attempts**: 오늘 사용한 시도 수를 **Posts/day** 상한과 함께 보여 주는 읽기 전용 카운터입니다.
- **Prepared posts**: 읽기 전용으로, 예비 게시물 수와 마지막 예정 시각을 표시합니다.
- **Refresh all now**: **Automatic**이 켜진 모든 크리에이터의 게시물을 즉시 하나씩 작성합니다. 꺼진 크리에이터는 실행이나 보고에 포함되지 않고, 다른 작업 중인 크리에이터는 건너뜁니다. 이 게시물은 같은 크리에이터에게 다음 한 시간 안에 예정된 준비 게시물을 폐기합니다.
- **Per creator**: 각 행에 **Automatic**과 **Images** 토글이 있습니다. 안내 설정 밖에서 만든 크리에이터는 둘 다 **off**로 시작하며, 안내 설정에서 만든 경우 그때 선택한 값이 적용됩니다. **Automatic**을 끄면 수동 전용입니다.

크리에이터 자동 답글에는 모든 크리에이터가 공유하는 설치 전체 기준의 별도 상한이 있으며, 연속 24시간당 10개입니다. 크리에이터마다 10개가 아닙니다.

자동 게시는 Marinara 서버에서 실행됩니다. Marinara가 실행 중이어야 하지만 NoodleR 페이지를 열어 둘 필요는 없습니다.

## Active Accounts(활성 계정)

**Active Accounts** 섹션에서는 새로고침 한 번에 몇 개의 계정이 참여할지 정합니다. 대상이 되는 계정은 초대한 캐릭터, 폴더로 포함된 캐릭터, 그리고 켜 두었다면 랜덤 유저입니다.

- **Active selection**(활성 선택 항목): 드롭다운이고 기본값은 **Random range**입니다. 선택지는 **Random range**, **Exact count**, **All invited**입니다.
- **Random range**를 고르면 입력란 두 개가 나타납니다. **Min active**(1에서 100, 기본값 **2**)와 **Max active**(1에서 100, 기본값 **5**)이며, 새로 고칠 때마다 이 범위 안에서 개수를 정합니다.
- **Exact count**를 고르면 입력란 하나가 나타납니다. **Active count**(1에서 100)이며 계정 수를 고정합니다.
- **All invited**를 고르면 대상이 되는 계정이 모두 참여하고 상한은 없습니다.

사용 중인 페르소나는 이 계정들과 별개로 항상 참여 대상입니다. **Professor Mari participates**가 켜져 있는 동안에는 Professor Mari도 대상이 됩니다.

Noodle은 첫 프로필을 준비하기 전에 활성 계정을 먼저 정합니다. 생성된 Noodle 프로필이 아직 없는 활성 캐릭터만 프로필 생성 요청을 받고, 초대되어 있어도 참여하지 않는 캐릭터는 포함하지 않습니다. 타임라인을 쓰는 요청에도 그 새로고침에 선택된 계정의 캐릭터 카드만 전달합니다.

## Activity(활동)

**Activity** 섹션에서는 새로고침 한 번이 만들 수 있는 양을 제한합니다. 각 입력란은 새로고침 한 번당 상한입니다.

| 입력란 | 기본값 | 범위 |
|---|---|---|
| **Posts**(게시물) | 8 | 0에서 100 |
| **Replies**(답글) | 12 | 0에서 200 |
| **Reposts**(리포스트) | 4 | 0에서 100 |
| **Likes**(좋아요) | 18 | 0에서 500 |

입력란을 0으로 두면 AI가 그 종류의 활동을 만들지 않습니다.

## Image Generation(이미지 생성)

**Image Generation** 섹션을 쓰면 Noodle이 일부 게시물에 AI가 만든 이미지를 붙일 수 있습니다. 여기에는 이미지 생성용 연결, 즉 그림을 만들도록 설정한 연결이 필요합니다. [지원하는 AI 제공자](../connections/providers-reference.md)를 참고하세요.

- **Image generation**(이미지 생성): 토글이고 기본값은 **off**입니다. 켜면 AI가 게시물 이미지를 생성합니다.
- 켜면 항목이 더 나타납니다.
  - **Image generation connection**(이미지 생성 연결): 드롭다운이고 기본값은 **Default image generation connection**입니다. Default로 두면 **Connections**(연결) 패널에서 이미지 생성 기본값으로 지정한 연결을 사용합니다.
  - **Prompt instructions**(프롬프트 지침): 기본 문구가 들어 있는 텍스트 상자이고 4000자까지 쓸 수 있습니다. 여기에 적은 추가 메모는 이미지 프롬프트에 합쳐집니다.
  - **Use avatar references**(아바타 참조 사용): 토글이고 기본값은 **on**입니다. 캐릭터의 아바타나 참조 이미지를 이미지 모델에 보냅니다.
  - **Include descriptions**(설명 포함): 토글이고 기본값은 **on**입니다. 캐릭터의 외모 설명 글을 이미지 프롬프트에 추가합니다.
  - **Images/refresh**(새로고침당 이미지 수): 0에서 50까지의 숫자이고 기본값은 **3**입니다. 수동이든 자동이든 새로고침마다 생성하는 게시물 이미지 수를 따로 제한합니다.
- **Attach gallery images**(갤러리 이미지 첨부): 별개의 토글이고 기본값은 **off**입니다. **Image generation**이 꺼져 있어도 계속 보입니다. 새 이미지를 만드는 대신, 그 캐릭터의 갤러리나 그 캐릭터가 등장하는 채팅에 있는 이미지를 게시물에 다시 쓸 수 있게 합니다.

**Image generation**을 켰는데 쓸 수 있는 이미지 연결이 없으면 새로고침이 막힙니다. "Choose an image generation connection for Noodle first." 메시지가 표시됩니다. 이미지 생성에 실패하면 한 번 다시 시도합니다. 두 번째도 실패하면 쓰이지 않은 이미지 프롬프트를 노출하지 않고, 텍스트만 있는 게시물을 대신 공개하며 새로고침을 이어 갑니다.

Noodle이 이런 이미지 프롬프트를 쓸 때 사용하는 템플릿 이름은 **Noodle Post Image**입니다. **Settings** > **Generations**(생성) > **Image Generation Prompt Overrides**(이미지 생성 프롬프트 재정의)에서 편집할 수 있습니다. **Prompt instructions**에 적은 글은 이 템플릿으로 전달되고, 그 결과는 평소 쓰는 이미지 스타일 프로필을 거칩니다. [이미지와 동영상을 위한 Prompt Overrides](../prompts/prompt-overrides.md)와 [이미지 스타일 프로필](../media/style-profiles.md)을 참고하세요. Professor Mari는 캐릭터 카드가 없어서 이미지 게시물에 내장 아바타와 참조 그림을 대신 사용합니다.

## Timeline Writing(타임라인 작성)

**Timeline Writing** 섹션에서는 새로고침에서 글을 쓰는 어조와 장기 기억 동작을 조정합니다.

- **Enhanced tone & continuity**(향상된 말투 및 연속성): 토글이고 기본값은 **off**입니다. 켜면 각 계정의 말투가 기본값인 밝은 어조 대신 그 계정 자신의 Personality/Description/Backstory에 더 강하게 뿌리내리고, 같은 새로고침 안에서 계정끼리 서로의 게시물에 반응하거나 인용하거나 맞붙도록 유도하며, 오래된 게시물을 떠올리는 빈도도 높아집니다(완전히 무작위로 고르는 대신 현재 활성 계정과 관련 있는 게시물을 우선합니다). 과거 게시물 언급을 자제시키던 지시도 허용하는 쪽으로 바뀝니다. 꺼 두면 Noodle 본래의 어조와 회상 동작을 그대로 재현하므로, 타임라인이 달라지는 것은 이 토글을 켰을 때뿐입니다.
- **Use generated character schedules**(생성된 캐릭터 스케줄 사용): 토글이고 기본값은 **off**입니다. 켜면 참여하는 캐릭터마다 오늘 자로 이미 생성된 Conversation 스케줄이 있을 때 Noodle이 함께 넣습니다. Noodle이 직접 스케줄을 생성하거나 새로 고치지는 않습니다. 현재 지역 날짜와 시각은 이 토글 상태와 관계없이 모든 타임라인 새로고침에 포함됩니다.

## 타임라인 작성 어조 바꾸기

Noodle에서 새로고침 글을 쓰는 부분은 내장된 어조와 창작 자유도 지시를 따릅니다. 각 계정의 게시물에 개성을 얼마나 담을지, 계정끼리 얼마나 농담을 주고받고 부딪혀도 되는지를 정해 둔 지시입니다. 이 글은 **Settings** > **Generations** > **Image Generation Prompt Overrides** > **Noodle Timeline Voice & Tone**에서 다시 쓸 수 있습니다(섹션 제목에는 "Image"가 붙어 있지만, 이 목록에는 이미지용뿐 아니라 사용자 지정할 수 있는 Noodle과 Conversation의 텍스트 프롬프트가 모두 들어 있습니다). 거기에 보이는 기본 문구는 사용자 지정하기 전까지 위의 **Enhanced tone & continuity** 토글을 따릅니다. 직접 쓴 글을 저장하면 그 뒤로는 토글 상태와 관계없이 그 글을 사용합니다.

이 재정의가 다루는 것은 어조뿐입니다. 새로고침 결과를 올바르게 유지하는 규칙(어떤 구조화된 동작이 허용되는지, 상호작용 대상을 어떻게 지정해야 하는지 등)은 이 글에 들어 있지 않고 항상 그대로 적용되므로, 어조를 다시 써도 새로고침이 망가지지 않습니다.

## World / Lore(세계와 로어)

**World / Lore** 섹션을 쓰면 채팅 생성에서 쓰는 것과 같은 로어북 구조로 새로고침이 로어북 항목을 가져올 수 있습니다.

- **Lorebook context**(로어북 컨텍스트): 토글이고 기본값은 **off**입니다. 켜면 새로 고칠 때마다 최근 Noodle 게시물과 답글 문구, 그리고 활성 캐릭터의 프로필에서 로어북 키워드가 맞는지 살피고, 맞는 항목을 그 새로고침에 참여하는 계정용 세계 및 로어 컨텍스트로 함께 넣습니다. 작동할 수 있는 것은 활성 캐릭터에 연결된 로어북이나 전역으로 표시한 로어북뿐입니다. 작동한 세계 및 로어 내용에는 새로고침 한 번당 8,192 토큰이라는 고정 상한이 있습니다. 기본값이 꺼짐이라서 켜기 전까지 기존 타임라인은 달라지지 않습니다.

## Carryover(반영)

**Carryover** 섹션은 최근 Noodle 활동을 채팅으로 보냅니다. 켜면 채팅 프롬프트에 "Recent Social Media Activity" 블록이 붙어, 캐릭터들이 Noodle에서 무엇을 했는지 알려 줍니다.

- **Carryover to chats**: 서로 독립된 토글 3개이고 기본값은 모두 **off**입니다. **Conversations**, **Roleplays**, **Games** 중에서 Noodle 활동을 받고 싶은 모드를 켜세요.
- **Carry hours**(반영 시간): 1에서 720까지의 숫자이고 기본값은 **48**입니다. Noodle이 몇 시간 전까지 거슬러 올라가 활동을 찾을지 정합니다.
- **Carry items**(반영 개수): 1에서 50까지의 숫자이고 기본값은 **8**입니다. 채팅 한 턴에 추가하는 활동 요약의 최대 개수입니다.

반영되는 활동은 Noodle에 초대된 캐릭터와 그 채팅에서 사용 중인 페르소나의 것뿐입니다. 여기서는 폴더로만 포함된 상태로는 부족합니다.
하나로 묶인 전체 반영 블록에는 채팅 생성 한 번당 8,192 토큰이라는 별도의 고정 상한이 있습니다. 개수 제한이 이 상한을 넘길 것 같으면 Marinara는 들어갈 수 있는 만큼 최신 요약을 남기고 시간순으로 정렬해 보여 줍니다.

## Reset Noodle(Noodle 초기화)

**Reset Noodle** 섹션은 계정과 설정은 남긴 채 타임라인만 지웁니다.

1. **Reset Noodle Timeline**(Noodle 타임라인 초기화) 버튼을 클릭하세요.
2. **Reset Noodle Timeline**이라는 제목의 창이 열립니다. 창에는 "This removes all posts, replies, likes, reposts, activity digests, and refresh records. Profiles, follows, invites, and settings stay."라고 적혀 있습니다.
3. **Reset timeline**(타임라인 초기화)을 클릭해 확정하세요.

여기서 지우는 것은 타임라인 내용뿐입니다. 계정, 핸들, 소개, 팔로우, 초대, 그리고 모든 Noodle 설정은 그대로 남습니다.

## Random users(랜덤 유저)

랜덤 유저는 라이브러리에 없는 내장 계정 6개입니다. Thread Countess, Packet Soup, Orbit Notice, Glass Bulletin, Moth Hour, Brine Index이며 각각 짧은 소개 글이 붙어 있습니다.

켜는 곳은 **Invites** 섹션의 **Characters** 목록 맨 위에 있는 **Random users** 행입니다. 기본값은 **off**입니다. 켜면 부제가 **Enabled**로, 꺼져 있으면 **Ambient fake profiles**로 표시됩니다. 켜 두면 이 계정들은 새로고침 동안 게시물, 좋아요, 리포스트, 답글, 팔로우를 할 수 있습니다. 프로필에서 이 계정들을 팔로우할 수는 없습니다.

## Noodle과 채팅 연결하기

Noodle과 채팅은 두 방향으로 컨텍스트를 주고받을 수 있습니다. 서로 별개인 두 기능입니다. 한쪽을 켜도 다른 쪽은 켜지지 않습니다.

**Carryover to chats**(Noodle 설정에 있습니다)는 Noodle 활동을 채팅으로 보냅니다. 위의 Carryover 섹션에서 설명한 대로, 그 채팅 프롬프트에 "Recent Social Media Activity" 블록을 추가합니다.

**Allow Noodle references**는 채팅별 토글입니다. 이쪽은 반대로 채팅 활동을 Noodle로 보냅니다. 위치는 채팅 자체 설정 안, **Connected Chats**(연결된 채팅) 영역 근처입니다. [채팅 설정 개요](../chats/chat-settings.md)를 참고하세요. 모든 채팅에서 기본값은 **off**입니다. 설명에는 "Timeline refreshes may include recent messages from this chat, with the chat name, mode, and participants stated in the prompt."라고 적혀 있습니다. 그 채팅에서 [캐릭터 스케줄과 자율 메시지](../conversation/schedules.md)도 함께 돌고 있다면, 그 이야기 속 캐릭터의 현재 상태와 활동(예: "currently dnd (At the office)")이 메시지와 함께 들어가며, 적용 범위는 그 채팅 하나로 한정됩니다.

Noodle 활동을 채팅에 나타나게 하려면 해당하는 **Carryover to chats** 모드를 켜세요. Noodle 새로고침이 채팅 내용을 읽게 하려면 그 채팅의 **Allow Noodle references**를 켜세요. 둘 중 하나만 써도 되고, 둘 다 같이 써도 됩니다.

## 문제 해결

- **수동 새로고침에서 아무것도 생성되지 않을 때**: **Generation connection**을 고르고, 캐릭터를 하나 이상 초대하거나 랜덤 유저를 켠 뒤, **Refresh** 섹션에 표시된 오류를 확인하세요.
- **자동 새로고침이 실행되지 않을 때**: **Refreshes/day**를 0보다 크게 설정하고, Marinara 서버를 계속 실행해 두고, **Automatic schedule** 아래의 예정 시각과 시간대를 확인하세요. 스케줄에 오류가 보이면 연결이나 요청 제한 문제를 해결하고 재시도를 기다리세요.
- **게시물이 최근 채팅을 언급하지 않을 때**: 그 채팅 설정에서 **Allow Noodle references**를 켜고, 캐릭터가 초대되어 있는지 확인하세요. 채팅 컨텍스트는 AI에게 주는 참고 자료일 뿐 보장은 아닙니다.
- **Noodle 활동이 채팅에 나타나지 않을 때**: 해당하는 **Carryover to chats** 모드를 켜고, 활동이 너무 오래됐다면 **Carry hours**를 늘리세요.
- **게시물에 이미지가 없을 때**: **Image generation**을 켜고, 작동하는 이미지 연결을 고르고, **Images/refresh** 상한을 확인하세요.

## 설정과 기본값

이 표에는 Noodle의 모든 설정과 각각의 기본값, 범위를 정리했습니다.

| 설정 | 기본값 | 범위 또는 선택지 |
|---|---|---|
| **Enable NoodleR** | off | on 또는 off |
| **Generation connection** | 없음 | 텍스트 연결 전체(새로고침에 필수) |
| **Professor Mari participates** | on | on 또는 off |
| **Refreshes/day** | 2 | 0에서 24(0이면 자동 새로고침 끔) |
| **Automatic posting schedule** | on | on 또는 off |
| **Posts/day** | 4 | 1~24 |
| **Night quiet** | on | 캐릭터 크리에이터는 23:00~07:00 제외 |
| 크리에이터별 **Automatic** | off | 안내 설정에서 켤 수 있음 |
| 크리에이터별 **Images** | off | 안내 설정에서 켤 수 있음 |
| 크리에이터 자동 답글 | 24시간당 10개 | 크리에이터별이 아닌 설치 전체 기준 |
| **Active selection** | Random range | Random range, Exact count, All invited |
| **Min active** | 2 | 1에서 100(Random range일 때만) |
| **Max active** | 5 | 1에서 100(Random range일 때만) |
| **Active count** | Max active와 같음 | 1에서 100(Exact count일 때만) |
| **Posts** | 8 | 0에서 100 |
| **Replies** | 12 | 0에서 200 |
| **Reposts** | 4 | 0에서 100 |
| **Likes** | 18 | 0에서 500 |
| **Image generation** | off | on 또는 off |
| **Image generation connection** | Default | 이미지 생성 연결 전체 |
| **Prompt instructions** | 내장 문구 | 4000자까지 |
| **Use avatar references** | on | on 또는 off |
| **Include descriptions** | on | on 또는 off |
| **Images/refresh** | 3 | 0에서 50 |
| **Attach gallery images** | off | on 또는 off |
| **Lorebook context** | off | on 또는 off |
| **Enhanced tone & continuity** | off | on 또는 off |
| **Carryover: Conversations** | off | on 또는 off |
| **Carryover: Roleplays** | off | on 또는 off |
| **Carryover: Games** | off | on 또는 off |
| **Carry hours** | 48 | 1에서 720 |
| **Carry items** | 8 | 1에서 50 |
| **Allow Noodle references**(채팅별) | off | on 또는 off |

## 관련 가이드

- [Noodle: 앱 안의 소셜 타임라인](overview.md)
- [채팅 설정 개요](../chats/chat-settings.md)
- [AI 제공자에 연결하기](../connections/connecting-to-a-provider.md)
- [지원하는 AI 제공자](../connections/providers-reference.md)
