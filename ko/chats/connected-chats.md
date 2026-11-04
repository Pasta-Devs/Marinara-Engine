# Conversation을 Roleplay나 Game에 연결하기

이 가이드에서는 Conversation(대화) 채팅을 Roleplay(롤플레이)나 Game 채팅에 연결해 두 채팅이 컨텍스트를 공유하게 하는 방법을 설명합니다. 흔히 이렇게 씁니다. 한 채팅에서 이야기를 진행하고, 그 이야기를 계속 알고 있는 Conversation에서 이야기에 대해 캐릭터 밖(OOC) 대화를 나눕니다.

**Chat Settings**(채팅 설정)의 **Connected Chats**(연결된 채팅) 섹션에는 서로 다른 기능 두 가지가 있습니다. **Connected Chats** 연결은 일대일이며 직접 설정합니다. **Cross-Chat Awareness**(채팅방 인지)는 따로 동작하는 토글로, 캐릭터가 자신이 등장하는 다른 Conversation 채팅을 기억하게 합니다.

## 연결의 작동 방식

연결은 Conversation 하나를 Roleplay 또는 Game 채팅 하나와 이어 줍니다. 각 채팅은 한 번에 연결을 하나만 가질 수 있습니다.

- Conversation은 연결된 이야기 채팅의 최근 메시지를 매 턴 자동으로 읽습니다.
- 이야기 채팅은 반대로 Conversation을 읽지 않습니다. 반대 방향으로는 캐릭터가 태그로 정보를 전달합니다. 태그는 아래에서 설명합니다.

## Conversation을 Roleplay나 Game 채팅에 연결하기

시작하기 전에: 두 채팅을 모두 준비해 두세요. [채팅 목록 관리](managing-chats.md)를 참고하세요.

1. Conversation 채팅을 열고 **Chat Settings**를 여세요. [채팅 설정 개요](chat-settings.md)를 참고하세요.
2. **Connected Chats** 섹션을 여세요.
3. **Link to Roleplay or Game**(롤플레이 또는 게임에 연결)을 클릭하세요.
4. 선택 창에서 채팅을 검색한 다음 클릭하세요.

이제 섹션에 연결된 채팅의 이름과 모드가 작은 연결 해제 버튼과 함께 표시됩니다.

작동하지 않는 경우: 선택 창에는 아직 연결되지 않은 채팅만 나타납니다. 먼저 다른 채팅의 연결을 해제하세요.

Game 채팅에서 시작하려면 그 채팅의 **Chat Settings → Connected Chats**를 열고 **Link to Conversation**(대화 연결)을 클릭한 다음 Conversation을 고르세요. Roleplay 채팅에는 연결 버튼이 없습니다. 연결이 생기면 보여 주기만 하므로, 연결은 Conversation 쪽에서 만드세요.

### 연결 해제하기

**Chat Settings → Connected Chats**를 열고 **Disconnect**(연결 해제)라는 라벨이 붙은 연결 해제 버튼을 클릭하세요. 그러면 그 연결에 딸린 대기 중인 영향 지시와 저장된 노트도 함께 지워집니다. 채팅을 삭제해도 연결이 해제됩니다.

## Cross-Chat Awareness

**Cross-Chat Awareness**는 Conversation의 **Connected Chats** 섹션에 있는 토글입니다. 설명 문구는 "Characters know what happens in their other chats"입니다. 한 캐릭터가 Conversation 채팅 여러 개에 등장하면, 그 캐릭터는 다른 채팅에서 있었던 일을 기억하고 언급할 수 있습니다. Marinara는 이런 채팅을 공통 사용자가 아니라 공통 캐릭터를 기준으로 찾습니다. 기본값은 켜짐이며 연결이 필요 없습니다.

## 연결을 통해 정보 주고받기

캐릭터는 메시지 안에 이런 태그를 씁니다. 직접 할 일은 없습니다. 두 채팅은 이 태그로 서로 소통합니다.

| 태그 | 하는 일 |
| --- | --- |
| `<influence>` | Conversation에서 연결된 이야기 채팅으로 보내는 일회성 방향 지시입니다. 연결된 채팅의 다음 턴에 영향을 준 뒤 소모됩니다. |
| `<note>` | Conversation의 지속되는 사실 하나를 이야기 채팅에 저장합니다. 지울 때까지 이야기 채팅의 프롬프트에 매 턴 남아 있습니다. |
| `<ooc>` | Roleplay 캐릭터가 이야기 밖으로 나와 연결된 Conversation에 답하게 합니다. Marinara가 그 내용을 그곳에 올립니다. |

### Conversation Notes

저장된 `<note>` 사실은 이야기 채팅의 **Chat Settings**에 있는 **Conversation Notes**(대화 노트) 섹션에 나타납니다. 노트마다 삭제 버튼이 있습니다. **Clear all notes**(모든 노트 지우기)는 확인을 거친 뒤 노트를 모두 지우며, 지운 뒤에는 되돌릴 수 없습니다. 노트가 없으면 섹션에 `<note>` 태그로 감싼 노트가 이곳에 표시된다는 안내가 나옵니다.

<a id="switching-between-connected-chats"></a>

## 연결된 채팅 사이 전환하기

연결이 있으면 두 채팅 모두에 양방향 화살표 아이콘의 **Connected chat**(연결된 채팅) 버튼이 나타납니다. 컴퓨터에서는 처음에 오른쪽 위에 있으며, 끌어서 옮길 수 있습니다. 휴대폰에서는 **Chat tools**(채팅 도구) 점 세 개 메뉴를 열고 **Connected chat**을 연 다음, **Switch to**와 상대 채팅 이름으로 된 항목을 고르세요.

이 컨트롤을 Chat Settings 안에 두려면 **Put back in Chat Settings**(채팅 설정에 되돌려 놓기)를 선택하세요. 그러면 별도의 **Connected chat** 섹션으로 표시됩니다. 다시 별도 창으로 꺼내려면 그 섹션의 별도 창 버튼을 사용하세요.

## 이 섹션의 다른 컨트롤

- **Discord webhook URL**: 라벨 없이 `https://discord.com/api/webhooks/`로 시작하는 플레이스홀더만 있는 입력란입니다. 웹훅 URL을 붙여 넣으면 채팅의 메시지가 Discord 채널로 미러링됩니다. 이 기능에는 별도의 가이드가 있습니다.
- **Allow Noodle references**(Noodle 참조 허용): Noodle 타임라인이 이 채팅의 최근 메시지를 가져올 수 있게 합니다. 기본값은 꺼짐이며 Noodle이 설치되어 있을 때만 나타납니다.
- Roleplay의 **Allow character DMs**(캐릭터 DM 허용): Roleplay 캐릭터가 이야기 안에서 나와의 새 Conversation DM을 열 수 있게 합니다. 기본값은 꺼짐이며 연결이 없어도 동작합니다.
