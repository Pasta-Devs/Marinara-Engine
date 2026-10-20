# आर्किटेक्चर मैप (डेवलपर्स के लिए)

यह गाइड कॉन्ट्रिब्यूटर्स के लिए बनी डेवलपर सामग्री है। इसमें Marinara Engine के कोड की बनावट बताई गई है: साझा नींव, फ़ीचर सिस्टम, किस मोड की क्या ज़िम्मेदारी है, और कोड का कौन सा हिस्सा कहाँ रहता है। साथ ही अभी की बड़ी फ़ाइलों की सूची और आगे के रीफ़ैक्टर की दिशा भी दी गई है।

दायरा: `packages/client/src`, `packages/server/src` और `packages/shared/src`। इस रिपॉज़िटरी में परंपरागत `.test.ts` सुइट नहीं रखी जाती। अपने आप होने वाली जाँच ट्रैक की गई रिग्रेशन स्क्रिप्ट और Playwright स्मोक कवरेज से मिलती है। अस्थायी `.test.ts` प्रूफ़ फ़ाइलें gitignore में हैं और इस्तेमाल के बाद हटा दी जाती हैं।

रिपॉज़िटरी बदलने के साथ फ़ाइलों, लाइनों और रूट की गिनती भी बदलती रहती है। यह मैप सिर्फ़ मोटा ढाँचा और नाम बताता है। सटीक संख्या के लिए हमेशा मौजूदा ट्री देखें।

## सेक्शन कोड

मूव की योजना बनाते समय, इशू पर लेबल लगाते समय, या ऐसे कोड में छोटा फ़ाइल हेडर जोड़ते समय इन कोड का इस्तेमाल करें जिसे अभी हटाया नहीं जा सकता।

| कोड | मतलब | मुख्य जगह |
| --- | --- | --- |
| `CORE-CONTRACT` | क्लाइंट और सर्वर, दोनों में साझा टाइप, स्कीमा, कॉन्स्टेंट और प्योर हेल्पर | `packages/shared/src` |
| `CLIENT-APP` | React ऐप का बूटस्ट्रैप, लेआउट शेल, ग्लोबल UI वायरिंग | `packages/client/src/App.tsx`, `main.tsx`, `components/layout` |
| `CLIENT-SHARED` | सिर्फ़ क्लाइंट वाले UI प्रिमिटिव, आम हुक, आम ब्राउज़र हेल्पर, ग्लोबल स्टोर | `packages/client/src/components/ui`, `hooks`, `lib`, `stores` |
| `SERVER-APP` | Fastify ऐप का बूटस्ट्रैप, मिडलवेयर, रूट रजिस्ट्रेशन, रनटाइम कॉन्फ़िग | `packages/server/src/app.ts`, `index.ts`, `middleware`, `config` |
| `SERVER-SHARED` | सिर्फ़ सर्वर वाली स्टोरेज, DB, LLM, प्रॉम्प्ट, लोरबुक, इंपोर्ट और इंटीग्रेशन की नींव | `packages/server/src/services`, `db`, `utils`, `lib` |
| `MODE-CONVERSATION` | सिर्फ़ Conversation मोड का UI और सर्वर व्यवहार | conversation कंपोनेंट, `/api/conversation`, conversation सर्विसेज़ |
| `MODE-ROLEPLAY` | Roleplay का UI, सीन, स्प्राइट, एनकाउंटर हेल्पर | roleplay चैट कंपोनेंट, `/api/scene`, `/api/encounter`, `/api/sprites` |
| `MODE-GAME` | Game Mode का UI, GM प्रॉम्प्ट, डाइस, पार्टी, मैप, कॉम्बैट, असेट, सेशन | `components/game`, `/api/game`, game सर्विसेज़ |
| `FEATURE-AGENTS` | एजेंट की परिभाषाएँ, एक्ज़ीक्यूशन, डीबग स्टेट, नॉलेज रूटिंग | एजेंट कंपोनेंट, एजेंट स्टोर, एजेंट रूट और सर्विसेज़ |
| `FEATURE-ASSETS` | बैकग्राउंड, अवतार, गैलरी, जेनरेट की हुई इमेज, स्प्राइट, गेम असेट | असेट रूट, गैलरी स्टोरेज, इमेज सर्विसेज़ |
| `FEATURE-SIDECAR` | लोकल मॉडल रनटाइम, सीन एनालिसिस, डाउनलोड, प्रोसेस कंट्रोल | sidecar स्टोर, `/api/sidecar`, sidecar सर्विसेज़ |
| `FEATURE-TTS` | TTS कॉन्फ़िग, वॉइस रूटिंग, कैश कुंजी, ऑडियो प्लेबैक | TTS की सेटिंग्स, हुक, रूट और सर्विसेज़ |
| `FEATURE-IMPORT` | SillyTavern और Marinara के इंपोर्टर तथा माइग्रेशन हेल्पर | इंपोर्ट रूट और सर्विसेज़ |
| `TEST` | ट्रैक की गई रिग्रेशन और ब्राउज़र स्मोक कवरेज, और ज़रूरत पड़ने पर अस्थायी प्रूफ़ टेस्ट | `scripts/regressions`, `e2e`, और अस्थायी `packages/server/src/**/__tests__/` फ़ाइलें जो इस्तेमाल के बाद हटा दी जाती हैं |

बेहतर यही है कि सेक्शन का पता पथ से ही चल जाए। `// Section: MODE-GAME` जैसा कमेंट सिर्फ़ तब तक काम का है जब तक फ़ाइल किसी मिले-जुले फ़ोल्डर में पड़ी हो।

## पैकेज की सीमाएँ

### packages/shared

`CORE-CONTRACT`। यह पैकेज किसी एक रनटाइम पर निर्भर नहीं होना चाहिए।

अभी इसमें यह सब है:

- `types`: चैट, कैरेक्टर, गेम, वर्ल्ड स्टेट, कॉम्बैट, सीन, sidecar, TTS, एजेंट, प्रॉम्प्ट, लोरबुक, एक्सपोर्ट, थीम।
- `schemas`: सेव होने वाली और साझा एंटिटी के Zod स्कीमा।
- `constants`: प्रोवाइडर, डिफ़ॉल्ट, चैट मोड, मॉडल लिस्ट, एजेंट प्रॉम्प्ट।
- `utils`: प्योर हेल्पर, जैसे मैक्रो एक्सपैंशन, XML रैपिंग और म्यूज़िक स्कोरिंग।
- `features`: एजेंट मैनिफ़ेस्ट और रजिस्ट्री, फ़ंक्शन-कॉल की परिभाषाएँ, फ़ोल्डर पैकेज, UNO, Chess तथा Poker के टर्न-गेम इंजन, Game Mode के रूलसेट और उनकी लड़ाई (`rulesets`, `ruleset-combat`, `tactical-combat` और `combat-*` फ़ाइलें), और `world` में दुनिया बनाने वाला जेनरेटर अपनी शेयर फ़ाइलों के साथ (सेटिंग किट, दुनिया, टाइल, बोर्ड और क्रीचर पैक)।

नियम:

- यहाँ React, DOM, Fastify, सर्वर स्टोरेज, फ़ाइल सिस्टम, नेटवर्क या प्रोवाइडर SDK का कोड नहीं आएगा।
- कोड यहाँ तभी लाएँ जब क्लाइंट और सर्वर, दोनों को वही कॉन्ट्रैक्ट या वही प्योर एल्गोरिदम चाहिए।
- `shared` को क्लाइंट-ओनली हेल्पर का कबाड़खाना न बनने दें।

### packages/client

React 19 और Vite PWA। अभी इसमें कई सौ सोर्स फ़ाइलें हैं।

अभी का ऊपरी ढाँचा:

- `App.tsx`, `main.tsx`: ऐप का बूटस्ट्रैप, React Query, PWA, ग्लोबल इफ़ेक्ट।
- `components/layout`: ऐप शेल, साइडबार, टॉप बार, विंडो रेंडरर।
- `components/ui`: दोबारा इस्तेमाल होने वाले UI प्रिमिटिव।
- `components/chat`: आम चैट, Conversation, Roleplay, सीन, स्प्राइट और एनकाउंटर का मिला-जुला UI।
- `components/game`: Game Mode की सतह और पैनल।
- `components/panels`, `components/modals`, एंटिटी एडिटर: सेटिंग्स और रिसोर्स मैनेजमेंट।
- `features`: अलग निकाले गए फ़ीचर मॉड्यूल, जिनमें फ़िलहाल चैट-सेटिंग्स के सेक्शन, ट्रैकर-पैनल के हिस्से, मल्टीप्लेयर, और अवतार एजेंट का कॉन्ट्रैक्ट, सेटअप, स्टेज और रेंडरर (`features/avatars`) शामिल हैं।
- `hooks`: ज़्यादातर API फ़ीचर के लिए React Query हुक और रनटाइम हुक।
- `lib`: ब्राउज़र और क्लाइंट हेल्पर। अभी यहाँ आम हेल्पर और सिर्फ़ Game Mode वाले हेल्पर एक साथ पड़े हैं।
- `stores`: UI, चैट रनटाइम, एजेंट, वर्ल्ड स्टेट, Game Mode, असेट, sidecar, ट्रांसलेशन, गैलरी, एनकाउंटर और टर्न गेम के Zustand स्टोर।
- `styles`: ग्लोबल स्टाइलशीट और थीम के अपने CSS।

अभी के अहम क्रॉसओवर:

- `components/game`, `components/chat` से साझा विज़ुअल हिस्से इंपोर्ट करता है, जैसे मौसम और गैलरी ड्रॉअर।
- `components/chat`, Roleplay फ़ीचर के लिए वर्ल्ड स्टेट और एनकाउंटर स्टेट इंपोर्ट करता है।
- `hooks/use-generate.ts` चैट स्टेट, एजेंट स्टेट, वर्ल्ड स्टेट, Game Mode स्टेट, ट्रांसलेशन स्टेट और UI सेटिंग्स, सबको छूता है।
- `lib/game-*` हेल्पर सिर्फ़ Game Mode के हैं, फिर भी ग्लोबल हेल्पर के बगल में पड़े हैं।

### packages/server

Fastify API, फ़ाइल-नेटिव स्टोरेज और प्रोवाइडर इंटीग्रेशन। अभी इसमें कई सौ सोर्स फ़ाइलें हैं।

अभी का ऊपरी ढाँचा:

- `app.ts`, `index.ts`: ऐप फ़ैक्टरी, बूटस्ट्रैप, स्टैटिक फ़ाइलें परोसना, फ़ाइल-स्टोरेज हाइड्रेशन और सीडर।
- `routes`: बहुत सारी रूट फ़ाइलें। ज़्यादातर पतली CRUD API हैं, पर `generate.routes.ts` और `game.routes.ts` बड़ी ऑर्केस्ट्रेशन फ़ाइलें हैं। जेनरेशन पथ से अब तक निकाले गए हिस्से `routes/generate/` फ़ोल्डर में हैं, जिनमें टोकन आउटपुट चेन (`generation-stream-output.ts`), टूल-कॉल राउंड (`tool-rounds.ts`), जवाब के कमांड की पार्सिंग और टेक्स्ट की सफ़ाई, और जवाब सेव करना (`save-generated-reply.ts`) शामिल हैं।
- `services/storage`: चैट, कैरेक्टर, प्रॉम्प्ट, लोरबुक, सेटिंग्स, असेट, थीम और वर्ल्ड स्टेट के लिए स्टोरेज की फ़साड लेयर।
- `services/llm`: प्रोवाइडर रजिस्ट्री, बेस प्रोवाइडर कॉन्ट्रैक्ट, OpenAI-कंपैटिबल प्रोवाइडर, लोकल sidecar ब्रिज।
- `services/prompt`: Game Mode के बाहर की जेनरेशन के लिए साझा प्रॉम्प्ट असेंबली।
- `services/conversation`: शेड्यूल, ऑटोनॉमस संदेश, अवेयरनेस, conversation प्रोफ़ाइल, Conversation के कमांड संभालना।
- `services/game`: GM प्रॉम्प्ट, डाइस, कॉम्बैट, स्टेट मशीन, पार्टी प्रॉम्प्ट, मैप, मौसम, समय, सेशन, चेकपॉइंट, रेप्युटेशन, असेट।
- `services/sidecar`: लोकल रनटाइम, मॉडल मैनेजमेंट, सीन एनालिसिस, सीन पोस्टप्रोसेसिंग।
- `services/agents`: एजेंट एक्ज़ीक्यूशन और नॉलेज रूटिंग।
- फ़ीचर की नींव: `services/import`, `services/lorebook`, `services/image`, `services/haptic`, `services/tools`, `services/regex`, `services/professor-mari`, `services/mari-db`, `services/turn-games`, `services/spotify`, `services/video`, `services/generation`, `services/chat-summary`, `services/achievements`, `services/prompt-overrides`, `services/setup`, `services/noodle`, `services/memory-recall`, `services/avatars` (अवतार एजेंट के लिए अवतार मॉडल का स्टोरेज, जेनरेशन और भाव पहचानने वाला क्लासिफ़ायर), `speech-to-text.service.ts` और `discord-webhook.ts`।
- `db/schema`: `DATA_DIR/storage` के नीचे सेव होने वाले डेटा की फ़ाइल-टेबल परिभाषाएँ।
- `db/file-schema.ts`, `db/file-query.ts`: नेटिव टेबल मेटाडेटा और क्वेरी एक्सप्रेशन।
- `db/file-backed-store.ts`: इन-मेमोरी टेबल स्टोर, ट्रांज़ैक्शन की सीमा, क्रैश रिकवरी और JSON स्नैपशॉट सेव करना। देखें [फ़ाइल-नेटिव स्टोरेज](file-storage.md)।

अभी के अहम क्रॉसओवर:

- रूट फ़ाइलें स्टोरेज, LLM, प्रॉम्प्ट, लोरबुक, गेम, sidecar और फ़ीचर सर्विसेज़ को सीधे इंपोर्ट करती हैं।
- `generate.routes.ts` Conversation और Roleplay, दोनों का मुख्य जेनरेशन पथ चलाता है, और साथ में एजेंट पाइपलाइन भी।
- `game.routes.ts` के पास गेम ऑर्केस्ट्रेशन तो है ही, वह LLM, sidecar, लोरबुक, इमेज, स्टोरेज और Discord वेबहुक के व्यवहार तक भी पहुँचता है।
- सीन एनालिसिस sidecar सर्विसेज़ में रहती है, पर Game Mode उसे या तो sidecar से चला सकता है या चुने हुए LLM कनेक्शन से।

## किस मोड की क्या ज़िम्मेदारी

### सभी मोड में साझा

ये पूरी ऐप की नींव हैं:

- चैट और संदेश सेव करना: `packages/server/src/routes/chats.routes.ts`, `packages/server/src/services/storage/chats.storage.ts`, और साझा चैट टाइप तथा स्कीमा।
- कैरेक्टर और पर्सोना: कैरेक्टर रूट, स्टोरेज, स्कीमा, तथा क्लाइंट के कैरेक्टर हुक और एडिटर।
- कनेक्शन और प्रोवाइडर: कनेक्शन रूट, स्टोरेज, साझा प्रोवाइडर कॉन्स्टेंट और `services/llm`।
- प्रॉम्प्ट प्रीसेट, लोरबुक, रेजेक्स, कस्टम टूल: लिखने और प्रॉम्प्ट में जोड़ने की साझा नींव।
- जेनरेशन ट्रांसपोर्ट: `packages/client/src/hooks/use-generate.ts`, `packages/server/src/routes/generate.routes.ts` और प्रोवाइडर रजिस्ट्री।
- TTS, ट्रांसलेशन, गैलरी, थीम, सेटिंग्स, इंपोर्ट, बैकअप।

### Conversation मोड

मुख्य कोड:

- क्लाइंट: `components/chat/ChatConversationSurface.tsx`, `ConversationView.tsx`, `ConversationMessage.tsx`, `ConversationInput.tsx`, और `ChatArea.tsx` में Conversation की क्विक-स्टार्ट वायरिंग।
- क्लाइंट हुक: `use-autonomous-messaging.ts`, `use-background-autonomous.ts`।
- सर्वर: `/api/conversation`, `services/conversation/*`।
- साझा मेटाडेटा: `conversationSchedulesEnabled`, `characterSchedules`, `scheduleWeekStart`, और दिन तथा हफ़्ते के सारांश।

तय सीमा:

- शेड्यूल, ऑटोनॉमस चेक-इन, conversation एक्टिविटी और Roleplay के बाहर के संदेशों का दिखना, ये सब Conversation के ज़िम्मे हैं।
- Conversation को गेम डाइस, GM टैग, क्विक-टाइम इवेंट, गेम मैप या गेम कॉम्बैट की कोई जानकारी नहीं होनी चाहिए।

### Roleplay मोड

मुख्य कोड:

- क्लाइंट: `components/chat/ChatRoleplaySurface.tsx`, `ChatMessage.tsx`, `ChatInput.tsx`, `RoleplayHUD` कंपोनेंट, `SpriteOverlay.tsx`, `SceneBanner.tsx`, `CyoaChoices.tsx` और `EncounterModal.tsx`।
- सर्वर: `/api/scene`, `/api/encounter`, `/api/sprites`, और `/api/generate` के कुछ हिस्से।
- साझा कॉन्ट्रैक्ट: `scene`, Roleplay से जुड़े चैट मेटाडेटा फ़ील्ड, और स्प्राइट की जगह तय करने वाले टाइप।

तय सीमा:

- सीन, स्प्राइट का दिखना, CYOA विकल्प, Roleplay का HUD और Roleplay के एनकाउंटर हेल्पर फ़्लो, ये सब Roleplay के ज़िम्मे हैं।
- जो साझा विज़ुअल इफ़ेक्ट Game Mode भी इस्तेमाल करता है, उन्हें `components/chat` से बाहर ले जाना चाहिए।

### Game Mode

मुख्य कोड:

- क्लाइंट: `components/game/*`, `hooks/use-game.ts`, `hooks/use-scene-analysis.ts`, `stores/game-mode.store.ts`, `stores/game-state.store.ts`, `stores/game-asset.store.ts`, `lib/game-*`, `lib/party-dialogue-parser.ts`।
- सर्वर: `/api/game`, `/api/game-assets`, `services/game/*`, तथा `services/sidecar/scene-analyzer.ts` और `scene-postprocess.ts` के गेम वाले हिस्से।
- साझा कॉन्ट्रैक्ट: `types/game.ts`, `types/game-state.ts`, `types/combat-encounter.ts`, और `ChatMetadata` के गेम फ़ील्ड।

तय सीमा:

- GM प्रॉम्प्ट, पार्टी प्रॉम्प्ट, डाइस, स्किल चेक, क्विक-टाइम इवेंट, गेम कॉम्बैट, मैप, यात्रा और आराम, मौसम और समय, NPC रेप्युटेशन, गेम सेशन के सारांश, जेनरेट किए गए गेम असेट और गेम लॉग, ये सब Game Mode के ज़िम्मे हैं।
- Game Mode को चैट मोड के UI पर निर्भर नहीं रहना चाहिए, सिवाय साझा प्रिमिटिव या साफ़ तौर पर साझा किए गए फ़ीचर कंपोनेंट के ज़रिए।

## अभी की बड़ी फ़ाइलें

ये फ़ाइलें आगे के काम को सबसे ज़्यादा धीमा कर सकती हैं, क्योंकि इनमें कई अलग-अलग चीज़ें एक ही जगह मिली हुई हैं। लाइनों की गिनती अक्सर बदलती है, इसलिए यह लिस्ट सटीक आकार नहीं, बल्कि मोटा क्रम और मुख्य दिक्कत बताती है।

| फ़ाइल | सेक्शन | दिक्कत |
| --- | --- | --- |
| `packages/server/src/routes/generate.routes.ts` | साझा जेनरेशन और एजेंट | रूट, स्ट्रीमिंग, प्रॉम्प्ट, एजेंट, स्टोरेज और साइड इफ़ेक्ट, सब एक ही फ़ाइल में हैं। |
| `packages/server/src/routes/game.routes.ts` | `MODE-GAME` | API हैंडलर, GM फ़्लो, सीन एनालिसिस, असेट, कॉम्बैट और सेव करना, सब आपस में गुँथे हुए हैं। |
| `packages/client/src/components/game/GameSurface.tsx` | `MODE-GAME` | रेंडरिंग, स्टेट ऑर्केस्ट्रेशन, असेट, लॉग, नैरेशन, कॉम्बैट और इफ़ेक्ट आपस में गुँथे हुए हैं। |
| `packages/client/src/components/chat/ChatSettingsDrawer.tsx` | मिली-जुली चैट सेटिंग्स | `features/chat-settings` में सेक्शन अलग निकालने का काम चल रहा है, फिर भी यह पैनल अभी बड़ा है। |
| `packages/client/src/components/game/GameNarration.tsx` | `MODE-GAME` | डिस्प्ले रेंडरिंग और कमांड फ़ॉर्मैटिंग एक-दूसरे से कसकर जुड़ी हैं। |
| `packages/client/src/components/game/GameCombatUI.tsx` | `MODE-GAME` | कॉम्बैट डिस्प्ले, कंट्रोल और लॉग को छोटे पैनल और हुक में बाँटा जा सकता है। |
| `packages/client/src/components/chat/RoleplayHUD.tsx` | `MODE-ROLEPLAY` | `RoleplayHUDActionsMenu.tsx` और `RoleplayHUDPanels.tsx` के ज़रिए इसका कुछ हिस्सा अलग हो चुका है। |

## लक्ष्य ढाँचा

आगे के रीफ़ैक्टर की दिशा यही है। सब कुछ एक ही बार में हटाना ज़रूरी नहीं।

### क्लाइंट का लक्ष्य

```text
packages/client/src/
  app/                         # App bootstrap, shell integration, providers
  shared/
    components/                # UI primitives and mode-agnostic widgets
    hooks/                     # cross-feature client hooks
    lib/                       # browser/runtime helpers
    stores/                    # global client stores only
  features/
    agents/
    assets/
    gallery/
    sidecar/
    tts/
    translation/
  modules/
    conversation/
      components/
      hooks/
      lib/
    roleplay/
      components/
      hooks/
      lib/
    game/
      components/
      hooks/
      lib/
      stores/
```

### सर्वर का लक्ष्य

```text
packages/server/src/
  app/                         # Fastify setup, route registration, middleware
  shared/
    db/
    storage/
    llm/
    prompt/
    lorebook/
    utils/
  features/
    agents/
    assets/
    haptic/
    image/
    import/
    sidecar/
    tts/
  modules/
    chat/
    conversation/
    roleplay/
      scene/
      encounter/
      sprites/
    game/
      routes/
      services/
      prompts/
```

### shared का लक्ष्य

```text
packages/shared/src/
  contracts/
    chat/
    conversation/
    roleplay/
    game/
    providers/
  constants/
  utils/
```

पुराना सपाट `types`, `schemas` और `constants` ढाँचा अब पूरी कहानी नहीं रह गया है। `packages/shared/src/features/` में अब एजेंट, फ़ंक्शन कॉल, फ़ोल्डर पैकेज, टर्न गेम, रूलसेट और लड़ाई, और दुनिया बनाने वाला जेनरेटर रहते हैं। shared की पहली सफ़ाई भी टाइप के स्तर पर और थोड़ी-थोड़ी करके होनी चाहिए, एक साथ ढेर सारी फ़ाइलें हटाकर नहीं।

## माइग्रेशन के नियम

1. नया कोड सबसे सटीक और सबसे छोटे सेक्शन में रखें।
2. अगर कोई क्लाइंट कंपोनेंट दो या उससे ज़्यादा मोड इस्तेमाल करते हैं, तो उसमें और मोड-विशेष व्यवहार जोड़ने से पहले उसे `CLIENT-SHARED` में ले जाएँ।
3. अगर कोई टाइप, स्कीमा या प्योर हेल्पर क्लाइंट और सर्वर, दोनों को चाहिए, तो उसे `CORE-CONTRACT` में ले जाएँ।
4. अगर वह सिर्फ़ सर्वर के काम का है, तो उसे `packages/shared` से बाहर ही रखें।
5. रूट फ़ाइलें HTTP इनपुट जाँचें और सर्विस को कॉल करें। डोमेन के फ़ैसले सर्विस में जाने चाहिए।
6. स्टोर या तो ग्लोबल हों (`ui`, `chat`, `sidecar`) या मोड-विशेष (`game-mode`, `encounter`)। ऐसा न हो कि एक ही स्टोर चुपचाप कई मोड संभालने लगे।
7. मेटाडेटा `ChatMode` के हिसाब से अलग-अलग होना चाहिए: बेस मेटाडेटा, और उसके ऊपर Conversation, Roleplay तथा गेम के फ़ील्ड।
8. एक बार में एक ही फ़ीचर हटाएँ। जहाँ कोई चौड़ा इंपोर्ट पथ पूरी रिपॉज़िटरी को हिला देता हो, वहाँ कंपैटिबिलिटी एक्सपोर्ट या रैपर छोड़ दें।
9. हर मूव के बाद लिंट चलाएँ:

   ```bash
   pnpm lint
   ```

   इसके बाद छुई गई फ़ाइलों पर Prettier की जाँच चलाएँ।

## सबसे पहले रीफ़ैक्टर करने लायक जगहें

सफ़ाई की शुरुआत के लिए ये सबसे अच्छी जगहें हैं, क्योंकि इनसे व्यवहार बदले बिना आपसी उलझाव कम होता है।

1. `components/chat` को आम, Conversation और Roleplay समूहों में बाँटें।
   - आम के लिए: `ChatCommonOverlays`, `ChatBranchSelector`, `ChatGalleryDrawer`, `WeatherEffects`, और साझा संदेश तथा इनपुट प्रिमिटिव।
   - Conversation के लिए: `ChatConversationSurface`, `ConversationView`, `ConversationMessage`, `ConversationInput`।
   - Roleplay के लिए: `ChatRoleplaySurface`, `SpriteOverlay`, `SceneBanner`, `CyoaChoices`, `EncounterModal`। Roleplay HUD का कुछ हिस्सा `RoleplayHUDActionsMenu.tsx` और `RoleplayHUDPanels.tsx` में पहले ही अलग हो चुका है।
2. सिर्फ़ गेम वाले क्लाइंट हेल्पर को गेम मॉड्यूल के नीचे ले जाएँ।
   - संभावित: `game-audio`, `game-tag-parser`, `game-full-body-pose`, `game-character-name-match`, `game-segment-edits`, `party-dialogue-parser`।
3. `GameSurface.tsx` को रनटाइम हुक और छोटे कंटेनर में बाँटें।
   - संभावित हुक: नैरेशन रनटाइम, असेट रनटाइम, सीन-एनालिसिस रनटाइम, कॉम्बैट रनटाइम, लॉग और हिस्ट्री रनटाइम, ऑडियो रनटाइम।
4. `GameNarration.tsx` को कमांड पार्सिंग तथा फ़ॉर्मैटिंग और डिस्प्ले कंपोनेंट में बाँटें।
5. `game.routes.ts` को हैंडलर के समूह के हिसाब से बाँटें।
   - संभावित समूह: सेटअप और सेशन, टर्न जेनरेशन, डाइस तथा स्किल और क्विक-टाइम इवेंट, जर्नल और इन्वेंटरी, मैप तथा यात्रा और मौसम, कॉम्बैट, असेट और सीन एनालिसिस।
6. `generate.routes.ts` को जेनरेशन ट्रांसपोर्ट, एजेंट पाइपलाइन, रीट्राई रूट, और कमांड तथा पोस्टप्रोसेस हेल्पर में बाँटें। Issue #7573 से यह काम शुरू हो चुका है: टोकन आउटपुट चेन, टूल राउंड, जवाब के कमांड, जवाब के टेक्स्ट की सफ़ाई, सेव हुए संदेश की जेनरेशन जानकारी, छिपा कमांड एंकर और जवाब सेव करना अब `routes/generate/` में हैं, हर एक का अपना रिग्रेशन है।
7. `ChatMetadata` को मोड-विशेष मेटाडेटा कॉन्ट्रैक्ट में बाँटें।
8. Roleplay और गेम के साझा विज़ुअल को `components/chat` से बाहर ले जाएँ, इससे पहले कि गेम और ज़्यादा चैट इंटरनल इंपोर्ट करने लगे।

## काम की शुरुआत कैसे करें

अगली सफ़ाई वाली PR में यही क्रम रखें:

1. एक ही हिस्से के लिए लक्ष्य फ़ोल्डर बनाएँ।
2. सबसे पहले प्योर हेल्पर हटाएँ।
3. उसके बाद लीफ़ कंपोनेंट हटाएँ।
4. बड़े ऑर्केस्ट्रेटर को तब तक वहीं रहने दें जब तक उसके ज़्यादातर इंपोर्ट नए मॉड्यूल की तरफ़ न मुड़ जाएँ।
5. कंपैटिबिलिटी री-एक्सपोर्ट सिर्फ़ वहीं जोड़ें जहाँ इंपोर्ट की उथल-पुथल असली बदलाव से ध्यान हटा देती।
6. लिंट चलाएँ:

   ```bash
   pnpm lint
   ```

   इसके बाद छुई गई फ़ाइलों पर Prettier की जाँच चलाएँ।

## मिलती-जुलती गाइड

- [फ़्रंटएंड आर्किटेक्चर (डेवलपर्स)](frontend.md)
- [फ़ाइल-नेटिव स्टोरेज](file-storage.md)
