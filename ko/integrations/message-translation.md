# 메시지 번역

Marinara Engine은 채팅 메시지를 다른 언어로 번역할 수 있습니다. 이 가이드에서는 번역 제공자 4가지, 자동 번역 토글, 메시지마다 붙는 **Translate**(번역) 버튼, 그리고 제공자별 제한을 설명합니다.

번역 설정은 채팅별로 따로 저장합니다. 채팅마다 제공자, 번역할 언어, 키를 각자 보관합니다. 한 채팅에서 입력한 설정은 다른 채팅으로 이어지지 않습니다.

## 번역 설정 위치

1. 아무 모드에서나 채팅을 여세요(Conversation(대화), Roleplay(롤플레이), Game).
2. 그 채팅의 **Chat Settings**(채팅 설정) 패널을 여세요.
3. **Translation**(번역) 섹션을 찾으세요.

아래에서 설명하는 제공자 설정과 토글은 모두 이 **Translation** 섹션에 있습니다.

## 제공자 고르기

**Provider**(제공자) 드롭다운에는 네 가지 선택지가 있습니다.

| 제공자 | 필요한 것 | 비고 |
|---|---|---|
| **Google Translate** | 없음 | 기본값입니다. 무료이고 키가 필요 없습니다. 요청 하나당 5000자까지만 됩니다. |
| **DeepL API** | DeepL API 키 | 품질이 더 좋습니다. 무료 키와 유료 키 모두 쓸 수 있습니다. |
| **DeepLX (self-hosted)** | DeepLX 서버 주소 | 직접 돌리는 DeepLX 서버용입니다. |
| **AI (via connection)** | AI 연결 | 등록해 둔 AI 제공자로 번역합니다. |

기본으로 선택되는 것은 **Google Translate**이고 따로 설정할 것이 없습니다. 아래 기능이 필요할 때만 다른 제공자로 바꾸세요.

### Target Language

**Target Language**(대상 언어) 입력란에는 번역해서 얻고 싶은 언어를 지정합니다. 기본값은 `en`(영어)입니다.

형식은 제공자에 따라 다릅니다.

- **Google Translate**, **DeepL API**, **DeepLX (self-hosted)**에는 짧은 언어 코드를 입력하세요. 예: `en`, `ja`, `es`, `de`, `fr`, `zh`, `ko`.
- **AI (via connection)**에는 언어 이름을 입력하세요. 예: `English`, `Japanese`, `Spanish`.

### DeepL API 설정

**DeepL API**를 고르면 **DeepL API Key**(DeepL API 키) 입력란이 나타납니다. 여기에 DeepL 계정의 키를 붙여넣으세요. DeepL 키는 다음과 같은 모양입니다.

```
xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx
```

`:fx`로 끝나는 키는 무료 등급 키입니다. Marinara는 이런 키를 DeepL의 무료 서비스로 보냅니다. 그 밖의 키는 유료 키로 처리합니다.

### DeepLX 설정

DeepLX는 직접 돌리는 무료 번역 서버입니다. **DeepLX (self-hosted)**를 고르면 **DeepLX URL**(DeepLX 서버 URL) 입력란이 나타납니다. 여기에 DeepLX 서버의 주소를 입력하세요. 예를 들면 다음과 같습니다.

```
http://localhost:1188
```

DeepLX 서버를 내 컴퓨터나 집 안 네트워크에서 돌린다면 그 주소는 로컬 주소입니다. Marinara는 안전을 위해 로컬 주소로 나가는 요청을 기본적으로 차단합니다. 허용하려면 `.env` 파일에 다음 줄을 넣고 파일을 저장하세요.

```
DEEPLX_LOCAL_URLS_ENABLED=true
```

`.env` 파일은 서버의 설정 파일입니다. 어디에 있는지는 [서버 설정 참고 문서](../CONFIGURATION.md)에서 설명합니다. 서버를 다시 시작할 필요는 없습니다. 몇 초 안에 바뀐 값을 알아서 반영합니다.

공개 인터넷 주소에 있는 DeepLX 서버라면 이 설정이 필요 없습니다. 기본으로 막히는 것은 로컬 주소와 사설 네트워크 주소뿐입니다.

### AI 번역 설정

**AI (via connection)**를 고르면 Marinara가 등록해 둔 AI 제공자 중 하나로 번역합니다. 입력란이 두 개 더 나타납니다.

**Connection**(연결) 드롭다운에서는 어떤 AI 연결로 번역할지 고릅니다. 이 입력란은 반드시 채워야 합니다. 비워 두면 번역이 실패하고 "Connection ID is required for AI translation" 메시지가 뜹니다. 연결은 AI 제공자에 접속하는 데 필요한 정보를 한데 저장해 둔 것입니다. 만드는 방법은 아래 연결 가이드를 참고하세요.

**AI Prompt**(AI 프롬프트) 입력란은 번역할 때 AI에 보내는 지시 내용입니다. 처음에는 기본 프롬프트가 들어 있습니다. 이 채팅에 한해 내용을 고칠 수 있습니다. 한 번 고치면 **Restore**(복원) 버튼이 나타나고, 이 버튼을 누르면 기본 프롬프트로 되돌아갑니다. 기본 프롬프트는 다음과 같습니다.

```
You are a translator. Translate the given text accurately, preserving formatting, markdown, and any special characters like *asterisks* for actions. Output ONLY the translated text, nothing else -- no explanations, no extra commentary.
```

## 자동 번역 토글

제공자 설정 아래에는 토글이 세 개 있습니다. 셋 다 기본은 꺼짐입니다.

**Auto-Translate Responses**(응답 자동 번역) 토글을 켜면 AI 응답이 생성되자마자 자동으로 번역합니다. Game Mode에서는 Marinara가 게임 마스터(GM)만 보는 태그를 서술에서 걷어낸 뒤 번역합니다.

**Translate My Messages**(내 메시지 번역) 토글을 켜면 직접 쓴 메시지를 AI로 보내기 직전에 지정한 언어로 번역합니다. 번역문이 입력한 글을 대신합니다. 번역에 실패하면 Marinara가 원래 쓴 글을 그대로 보내고 오류 메시지를 띄웁니다.

**Show Draft Translate Button**(초안 번역 버튼 표시) 토글을 켜면 **Send**(전송) 버튼 옆에 **Translate draft**(초안 번역) 버튼이 생깁니다. 이 버튼으로 메시지를 먼저 번역해 보고, 보내기 전에 결과를 확인하거나 고칠 수 있습니다. 보낼 때 곧바로 번역해서 확인할 틈이 없는 **Translate My Messages** 대신 손으로 처리하는 방식입니다.

**Conversation**에서는 데스크톱과 모바일 모두 메시지 입력창의 웃는 얼굴 버튼 → **Tools → Translate draft**(도구 → 초안 번역)에서 아직 보내지 않은 초안을 언제든 번역할 수 있습니다. **Show Draft Translate Button**이나 자동 번역을 켤 필요는 없습니다. 이 작업은 해당 채팅의 입력 번역 설정을 사용해 초안을 번역문으로 바꾸므로 보내기 전에 검토할 수 있습니다. 메시지를 전송하지 않으며, 번역에 실패하면 초안은 그대로 유지됩니다.

## 메시지마다 붙는 Translate 버튼

직접 쓴 메시지든 AI가 쓴 메시지든, 모든 채팅 메시지에는 마우스를 올렸을 때 나오는 동작 막대에 **Translate** 버튼이 있습니다. 버튼 모양은 언어 아이콘입니다. 이 버튼은 단독으로 동작하며 위의 토글과는 상관이 없습니다.

1. 메시지 위로 포인터를 옮겨 동작 막대를 띄우세요.
2. **Translate** 버튼을 클릭하세요.
3. 번역문이 메시지 아래에 나타납니다.
4. 같은 버튼을 한 번 더 클릭하면 번역문이 숨겨집니다. 이때 버튼의 설명 문구는 **Hide translation**(번역 숨기기)으로 바뀝니다.

이렇게 만든 번역문은 메시지와 함께 저장됩니다. 페이지를 새로 고쳐도 남고, 다른 채팅에 갔다가 돌아와도 그대로 있습니다.

메시지마다 붙는 버튼도 **Translation** 섹션에서 지정한 제공자와 언어를 그대로 씁니다.

## 제공자별 제한

제공자를 고를 때는 다음 제한을 염두에 두세요.

- **Google Translate**는 5000자가 넘는 글을 거부합니다. "Text too long for Google Translate (max 5000 characters). Use DeepL or AI provider for longer texts." 오류가 뜹니다. 글이 길면 DeepL이나 AI로 바꾸세요.
- **DeepL API**, **DeepLX (self-hosted)**, **AI (via connection)**는 더 긴 글도 받습니다. 서버 제한인 요청 하나당 50000자까지입니다.
- **Google Translate**, **DeepL API**, **DeepLX (self-hosted)**는 15초를 넘기면 각각 작업을 멈추고 오류를 띄웁니다.
- **AI (via connection)**는 15초 제한이 아니라 해당 연결의 모델과 시간 초과 설정을 따릅니다.
- 로컬 주소로 보내는 **DeepLX (self-hosted)** 요청은 위에서 설명한 대로 `DEEPLX_LOCAL_URLS_ENABLED=true`를 설정하지 않으면 막힙니다.

## 관련 가이드

- [메시지 조작: 편집, 삭제, 스와이프, 재생성](../chats/messages.md)
- [채팅 설정 개요](../chats/chat-settings.md)
- [AI 제공자에 연결하기](../connections/connecting-to-a-provider.md)
- [서버 설정 참고 문서](../CONFIGURATION.md)
