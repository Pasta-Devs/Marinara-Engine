# Conversation을 Roleplay나 Game에 연결하기

이 가이드에서는 Conversation(대화) 채팅을 Roleplay(롤플레이)나 Game 채팅에 연결해 양쪽이 컨텍스트를 공유하도록 만드는 방법을 설명합니다. **Cross-Chat Awareness**(채팅방 인지), 연결을 통해 정보를 주고받는 특수 태그, 연결된 채팅 사이를 오가는 방법도 함께 다룹니다.

Marinara Engine(이하 Marinara)에는 채팅끼리 서로를 알게 하는 기능이 두 가지 있습니다. 하나는 자동으로 동작하고, 다른 하나는 직접 만드는 일대일 연결입니다. 두 기능은 작동 방식이 다르므로 이 가이드에서는 구분해서 설명합니다.

## Connected Chats가 하는 일

**Connected Chats**(연결된 채팅)는 Conversation 채팅 하나와 Roleplay 또는 Game 채팅 하나를 이어 줍니다. 연결은 일대일입니다. 한 채팅은 한 번에 다른 채팅 하나와만 연결할 수 있습니다.

연결하고 나면 Conversation 쪽이 연결된 이야기 채팅의 최근 메시지를 자동으로 읽습니다. 매 턴 자기 컨텍스트로 가져옵니다. 이것이 연결의 자동 방향입니다.

이야기 채팅(Roleplay 또는 Game)은 반대로 Conversation의 메시지를 자동으로 읽지 않습니다. 반대 방향으로 정보를 보낼 때는 캐릭터가 특수 태그를 사용합니다. 태그는 아래에서 설명합니다.

자주 쓰는 방식은 이렇습니다. 한쪽 채팅에서는 몰입감 있는 Roleplay나 Game을 진행하고, Conversation에서는 가벼운 OOC(캐릭터 밖) 대화를 나눕니다. OOC 채팅이 이야기 상황을 계속 파악하고 있으므로 진행되는 이야기를 그때그때 이야깃거리로 삼을 수 있습니다.

## Cross-Chat Awareness는 연결과 다릅니다

이 두 기능은 헷갈리기 쉽습니다. 설정을 시작하기 전에 이 절을 먼저 읽으세요.

**Cross-Chat Awareness**는 자동으로 동작합니다. Conversation 모드의 설정입니다. 한 캐릭터가 여러 Conversation 채팅에 등장하면, 그 캐릭터는 다른 채팅에서 있었던 일을 기억하고 언급할 수 있습니다. 직접 연결할 것은 없습니다. 이 설정은 기본값이 켜짐입니다.

**Chat Settings**(채팅 설정)의 **Cross-Chat Awareness** 항목에서 찾을 수 있습니다. 도움말 문구는 이렇습니다. "Characters remember and reference conversations from other chats they're in. Pulls recent messages from sibling chats and injects them as context." Marinara는 이런 형제 채팅을 사용자가 아니라 공통 캐릭터를 기준으로 찾습니다.

**Connected Chats** 연결은 이와 다릅니다. 직접 의도해서 만드는 연결입니다. Conversation 하나와 Roleplay 또는 Game 채팅 하나를 정확히 일대일로 이어 줍니다. 이야기 컨텍스트와 아래에서 설명하는 특수 태그를 전달합니다.

정리하면 이렇습니다. **Cross-Chat Awareness**는 한 캐릭터가 등장하는 Conversation 채팅들을 자동으로 이어 줍니다. **Connected Chats** 연결은 Conversation 하나와 이야기 채팅 하나를 직접 이어 줍니다.

## Conversation을 Roleplay나 Game 채팅에 연결하기

연결은 Conversation 채팅에서 시작하거나 Game 채팅에서 시작합니다. Conversation 쪽에서 시작하려면 다음 단계를 따르세요.

1. 연결할 Conversation 채팅을 여세요.
2. **Chat Settings**(채팅 설정)를 여세요. 채팅 안의 **Chat Settings** 버튼은 직접 옮기지 않았다면 오른쪽 위에 있습니다.
3. **Connected Chats** 항목을 찾으세요.
4. **Link to Roleplay or Game**(롤플레이 또는 게임에 연결)을 클릭하세요.
5. 선택 창에서 Roleplay 또는 Game 채팅을 검색한 다음 클릭하세요.

이제 **Connected Chats** 항목 안에 연결된 채팅의 이름과 모드가 보입니다. 그 옆에 연결 해제 버튼이 작게 있습니다.

Game 채팅에서 연결을 시작하려면 그 채팅의 **Chat Settings**를 열고 **Connected Chats**를 찾아 **Link to Conversation**(대화 연결)을 클릭하세요. 그런 다음 Conversation을 고르세요.

Roleplay 채팅에는 연결 버튼이 따로 없습니다. 연결이 만들어지면 그 내용을 보여 주기는 하지만, 연결 자체는 Conversation 쪽에서 만들어야 합니다.

선택 창에는 아직 연결되지 않은 채팅만 나타납니다. 한 채팅은 한 번에 하나의 연결만 가질 수 있습니다.

### 연결 해제하기

연결을 해제하려면 **Chat Settings**를 열고 **Connected Chats**를 찾아 연결 해제 버튼(툴팁은 **Disconnect**(연결 해제))을 클릭하세요. 연결을 해제하면 그 연결에 딸린 대기 중인 `<influence>` 지시와 저장된 노트도 함께 지워집니다.

채팅을 삭제해도 연결된 채팅과의 연결이 해제됩니다.

## 연결을 통해 정보 주고받기

Conversation은 이야기 채팅을 자동으로 읽습니다. 나머지 방향에는 태그를 씁니다. 이 태그는 캐릭터의 메시지 안에 나타나고, 태그를 쓰는 주체는 AI입니다. 직접 입력할 일은 보통 없지만, 각 태그가 무슨 일을 하는지 알아 두면 두 채팅이 어떻게 이어지는지 이해하는 데 도움이 됩니다.

태그를 언급해야 할 때는 아래 형태 그대로 적으세요. 여기서는 정확히 표시되도록 코드로 적었습니다.

- `<influence>`는 Conversation에서 연결된 이야기 채팅으로 일회성 방향 지시를 보냅니다. 연결된 바로 다음 턴에만 영향을 주고 소모됩니다.
- `<note>`는 Conversation의 사실 하나를 연결된 이야기 채팅에 지속적으로 저장합니다. 지울 때까지 이야기 채팅의 프롬프트에 매 턴 남아 있습니다.
- `<ooc>`는 Roleplay 캐릭터가 이야기 밖으로 나와 연결된 Conversation에 직접 답하게 해 줍니다. Marinara가 그 내용을 연결된 DM 채팅에 올립니다.

즉, Conversation의 캐릭터는 `<influence>`와 `<note>`로 이야기를 조용히 이끌거나 정보를 전달할 수 있고, Roleplay 캐릭터는 `<ooc>`로 Conversation에 답할 수 있습니다.

## Conversation Notes

Conversation의 캐릭터가 `<note>`로 내용을 저장하면 이야기 쪽에 나타납니다. Roleplay 또는 Game 채팅의 **Chat Settings**에 **Conversation Notes**(대화 노트) 항목이 생깁니다.

이 항목에는 저장된 노트가 모두 나열됩니다. 노트마다 삭제 버튼이 있습니다. 한꺼번에 지우려면 **Clear all notes**(모든 노트 지우기) 버튼을 사용하세요. Marinara가 지우기 전에 확인을 요청하며, 지운 뒤에는 되돌릴 수 없습니다.

아직 저장된 노트가 없으면, `<note>` 태그로 감싼 내용이 저장되면 여기에 표시된다는 안내가 나옵니다.

<a id="switching-between-connected-chats"></a>

## 연결된 채팅 사이 전환하기

연결된 채팅이 있으면 양방향 화살표 아이콘의 작은 **Connected chat**(연결된 채팅) 버튼이 채팅 오른쪽 위에 나타납니다. 컴퓨터나 휴대폰에서 버튼을 다른 곳으로 끌어 옮길 수 있습니다. 클릭하거나 탭해 작은 창을 연 다음, **Switch to** 뒤에 상대 채팅 이름이 표시된 버튼을 누르세요.

연결된 채팅으로 바로 이동합니다. 버튼은 연결된 두 채팅에 모두 나타납니다.

**Put back in Chat Settings**(채팅 설정으로 되돌리기)로 이 컨트롤을 Chat Settings 안에 넣을 수 있습니다. 그러면 **Connected chat** 섹션으로 표시됩니다. 그 섹션의 별도 창 버튼을 누르면 다시 꺼낼 수 있습니다.

## 이 항목의 다른 컨트롤

**Connected Chats** 항목에는 다른 기능에 속한 컨트롤 두 개가 더 있습니다. 편의를 위해 여기에 함께 표시됩니다.

- **Discord webhook URL** 입력란. 보이는 라벨은 없고 `https://discord.com/api/webhooks/`로 시작하는 플레이스홀더만 있습니다. 여기에 Discord 웹훅 URL을 붙여넣으면 채팅의 메시지가 Discord 채널로 함께 전달됩니다. 이 기능은 Discord 메시지 미러 기능의 일부이며 별도의 가이드가 있습니다.
- **Allow Noodle references**(Noodle 참조 허용) 토글(기본값 꺼짐). 앱 안의 Noodle 타임라인이 이 채팅의 최근 메시지를 가져올 수 있게 합니다. Noodle에도 별도의 가이드가 있습니다.

Roleplay 쪽에는 **Allow character DMs**(캐릭터 DM 허용) 토글(기본값 꺼짐)도 보입니다. 이 토글을 켜면 Roleplay 캐릭터가 이야기 안에서 새 Conversation DM을 보낼 수 있습니다. 아직 연결된 Conversation이 없어도 동작합니다.

## 관련 가이드

- [Conversation Mode: 시작하기](../conversation/getting-started.md)
- [Roleplay Mode: 시작하기](../roleplay/getting-started.md)
