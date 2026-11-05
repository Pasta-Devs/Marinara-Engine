# 메시지 번역

Marinara Engine은 채팅 메시지를 다른 언어로 번역할 수 있습니다. 이 가이드에서는 번역 서비스를 고르고, 언어를 정하고, 자동 번역을 켜고, 메시지 하나를 번역하는 방법을 설명합니다.

번역은 채팅별로 설정합니다. 채팅마다 서비스, 언어, 키를 각자 보관합니다. 새 채팅을 같은 설정으로 시작하려면 [번역기 기본값](#translator-defaults-for-new-chats)으로 저장하세요.

## 번역 설정 위치

1. 아무 모드에서나 채팅을 여세요(Conversation(대화), Roleplay(롤플레이), Game).
2. **Chat Settings**(채팅 설정)를 여세요.
3. **Translation**(번역) 섹션을 찾으세요.

아래의 설정은 모두 이 섹션에 있습니다.

## 제공자 고르기

**Provider**(제공자) 목록에는 네 가지 선택지가 있습니다.

| 제공자 | 필요한 것 | 비고 |
|---|---|---|
| **Google Translate** | 없음 | 기본값입니다. 무료이고 키가 필요 없습니다. 요청 하나당 5000자까지입니다. |
| **DeepL API** | DeepL API 키 | 품질이 더 좋습니다. 무료 키와 유료 키 모두 쓸 수 있습니다. |
| **DeepLX (self-hosted)** | DeepLX 서버 URL | 직접 돌리는 DeepLX 서버용입니다. |
| **AI (via connection)** | AI 계정 | AI 모델 중 하나로 번역합니다. |

Google Translate는 따로 설정할 것이 없습니다. 다른 제공자의 기능이 필요할 때만 그 제공자를 고르세요.

### 언어 정하기

언어는 두 입력란에서 정합니다. 둘 다 기본값은 `en`(영어)입니다.

- **Model Language**(모델 언어)는 AI 모델이 이해하고 답변하는 언어입니다. 내 언어로 입력하면 AI가 읽기 전에 메시지가 이 언어로 번역됩니다. **Translate My Messages**(내 메시지 번역)와 **Translate draft**(초안 번역)가 이 언어를 씁니다.
- **My Language**(내 언어)는 내가 읽는 언어입니다. AI 답변이 이 언어로 번역됩니다. **Auto-Translate Responses**(응답 자동 번역)와 메시지마다 있는 **Translate**(번역) 버튼이 이 언어를 씁니다.

예를 들어 스페인어로 쓰고 AI가 영어에서 가장 잘 동작한다면 **Model Language**를 `en`으로, **My Language**를 `es`로 설정하세요.

Google Translate, DeepL API, DeepLX에는 `en`, `ja`, `es`, `de`, `fr`, `zh`, `ko` 같은 짧은 코드를 입력하세요. AI (via connection)에는 `English`, `Japanese`, `Spanish` 같은 언어 이름을 입력하세요.

작동하지 않는 경우: 코드나 이름이 틀리면 오류가 나거나 텍스트가 바뀌지 않습니다. 제공자에 맞는 형식인지 확인하세요.

### DeepL API

**DeepL API**를 고르고 **DeepL API Key**(DeepL API 키)에 DeepL 계정 키를 붙여넣으세요. `:fx`로 끝나는 키는 무료 등급 키이며, Marinara는 이 키를 DeepL의 무료 서비스로 보냅니다. 그 밖의 키는 유료 키로 처리합니다.

```text
xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx
```

### DeepLX

DeepLX는 직접 돌리는 무료 번역 서버입니다. **DeepLX (self-hosted)**를 고르고 **DeepLX URL**에 서버 주소(예: `http://localhost:1188`)를 입력하세요.

내 컴퓨터나 로컬 네트워크에 있는 DeepLX 서버는 로컬 주소를 씁니다. Marinara는 안전을 위해 로컬 주소를 기본적으로 차단합니다. 허용하려면 `.env` 파일에 다음 줄을 추가하고 저장하세요. 다시 시작할 필요는 없습니다. 보통 몇 초 안에, 최대 약 30초 안에 적용됩니다. 파일 위치는 [서버 설정 참고 문서](../CONFIGURATION.md)에서 확인할 수 있습니다.

```text
DEEPLX_LOCAL_URLS_ENABLED=true
```

공개 인터넷 주소에 있는 DeepLX 서버에는 이 설정이 필요 없습니다.

### AI (via connection)

AI 모델 중 하나를 쓰려면 **AI (via connection)**을 고르세요. 입력란이 세 개 나타납니다.

- **Connection**(연결): 번역에 쓸 AI 계정입니다. 반드시 지정해야 합니다. 지정하지 않으면 "Connection ID is required for AI translation" 메시지와 함께 번역이 실패합니다. [AI 제공자에 연결하기](../connections/connecting-to-a-provider.md)를 참고하세요.
- **Outgoing Message Prompt**(발신 메시지 프롬프트)와 **Incoming Response Prompt**(수신 응답 프롬프트): AI가 내 메시지와 자신의 답변을 번역할 때 받는 지시문입니다. 둘 다 처음에는 기본 프롬프트가 들어 있으며, 이 채팅에 한해 고칠 수 있습니다. `{{targetLanguage}}`는 **Model Language** 또는 **My Language**로 바뀝니다. 프롬프트를 고친 뒤에는 **Restore**(복원)로 기본 프롬프트로 되돌릴 수 있습니다. 기본 프롬프트는 다음과 같습니다.

```text
You are a translator. Translate the given text accurately into {{targetLanguage}},
preserving formatting, markdown, and any special characters like *asterisks* for actions.
Output ONLY the translated text, nothing else -- no explanations, no extra commentary.
```

## 자동 번역 켜기

제공자 설정 아래에 토글이 네 개 있습니다. 모두 처음에는 꺼져 있습니다.

- **Auto-Translate Responses**: AI 응답이 생성되자마자 모두 번역합니다. Game Mode에서는 Marinara가 먼저 서술에서 게임 마스터 전용 태그를 걷어냅니다.
- **Translate My Messages**: 내 메시지를 AI로 보내기 직전에 **Model Language**로 번역해 입력한 글을 대체합니다. 번역에 실패하면 Marinara가 원래 글을 보내고 오류를 표시합니다.
- **Show Draft Translate Button**(초안 번역 버튼 표시): **Send**(전송) 옆에 **Translate draft** 버튼을 추가해, 보내기 전에 번역문을 검토하고 고칠 수 있게 합니다. **Translate My Messages**를 대신하는 수동 방식입니다.
- **Show Only Translation**(번역문만 표시): 번역된 메시지에서 원문과 번역문을 함께 보여 주는 대신 원문 자리에 번역문만 보여 줍니다.

Conversation에서는 데스크톱과 모바일 모두 메시지 입력창의 웃는 얼굴 버튼을 누른 다음 **Tools → Translate draft**(도구 → 초안 번역)에서 아직 보내지 않은 초안을 언제든 번역할 수 있습니다. 두 토글 중 어느 것도 켤 필요가 없습니다. 이 채팅의 입력 번역 설정을 사용해 초안을 번역문으로 바꾸므로 보내기 전에 검토할 수 있습니다. 아무것도 전송하지 않습니다. 번역에 실패하면 초안은 그대로 남습니다.

<a id="translator-defaults-for-new-chats"></a>

## 새 채팅용 번역기 기본값

토글 아래의 **Save translator defaults**(번역기 기본값 저장)는 이 채팅의 번역 설정을 모든 모드의 새 채팅에 쓰도록 저장합니다. 설정 마법사와 설정 프로필의 설정이 먼저 적용됩니다. 기존 채팅은 자체 설정을 유지합니다. **Forget saved defaults**(저장된 기본값 삭제)는 저장한 기본값을 지웁니다. [Noodle](../agents/noodle-settings.md#translation)도 같은 기본값을 씁니다.

DeepL API 키와 DeepLX URL은 이 Marinara 설치에만 남습니다. 채팅 내보내기, 내보낸 설정 프로필, **Export Profile**(프로필 내보내기) 파일에는 들어가지 않으며, 이런 파일을 가져와도 설정되지 않습니다. 채팅을 다른 설치로 옮긴 뒤에는 다시 입력하세요.

## 메시지 하나 번역하기

내가 쓴 메시지든 AI가 쓴 메시지든, 모든 메시지의 동작 막대에는 **Translate** 버튼(언어 아이콘)이 있습니다. 위의 토글을 켜지 않아도 동작합니다.

1. 메시지 위로 포인터를 옮기거나 휴대폰에서는 메시지를 탭해 동작 막대를 띄우세요.
2. **Translate**를 클릭하세요.
3. 번역문이 메시지 아래에 나타납니다. **Show Only Translation**이 켜져 있으면 메시지 자리에 나타납니다.
4. 버튼을 한 번 더 클릭하면 번역문이 숨겨집니다. 이때 버튼 이름은 **Hide translation**(번역 숨기기)으로 바뀝니다.

번역문은 메시지와 함께 저장되므로 페이지를 새로 고치거나 다른 채팅으로 옮겨 가도 남습니다. 위 섹션과 같은 제공자와 **My Language**를 씁니다.

## 제공자별 제한

- **Google Translate**는 5000자가 넘는 글을 "Text too long for Google Translate (max 5000 characters). Use DeepL or AI provider for longer texts." 오류와 함께 거부합니다.
- **DeepL API**, **DeepLX (self-hosted)**, **AI (via connection)**은 더 긴 글도 받으며, 요청 하나당 서버 제한인 50000자까지 받습니다.
- **Google Translate**, **DeepL API**, **DeepLX (self-hosted)**는 15초가 지나면 오류와 함께 멈춥니다.
- **AI (via connection)**은 15초 제한이 아니라 AI 모델 자체의 타임아웃을 따릅니다.
- 로컬 주소의 **DeepLX (self-hosted)**는 `DEEPLX_LOCAL_URLS_ENABLED=true`를 설정하지 않으면 차단됩니다.

## 관련 가이드

- [메시지 조작: 편집, 삭제, 스와이프, 재생성](../chats/messages.md)
- [채팅 설정 개요](../chats/chat-settings.md)
- [AI 제공자에 연결하기](../connections/connecting-to-a-provider.md)
- [서버 설정 참고 문서](../CONFIGURATION.md)
