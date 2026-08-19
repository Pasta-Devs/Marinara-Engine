# फ़्रंटएंड आर्किटेक्चर (डेवलपर्स)

यह सामग्री डेवलपर्स के लिए है, आम पाठक की गाइड नहीं। इसमें बताया गया है कि Marinara Engine का क्लाइंट कैसे बना है। इसमें React ऐप का ढाँचा, Zustand स्टोर, React Query हुक, मुख्य कंपोनेंट और सर्वर API का मैप शामिल है। अगर सिर्फ़ ऐप इस्तेमाल करना है तो इसकी जगह यूज़र गाइड से शुरू करें।

## एक नज़र में

Marinara Engine एक AI चैट ऐप है जिसमें Conversation, Roleplay और Game Mode हैं। क्लाइंट React 19 का सिंगल-पेज ऐप है, जिसे Vite सर्व करता है, स्टाइलिंग Tailwind CSS v4 से होती है, और यह Progressive Web App (PWA) के रूप में पैक किया जाता है।

क्लाइंट `packages/client` में रहता है। यह Fastify API सर्वर (`packages/server`) से REST और Server-Sent Events (SSE) के ज़रिए बात करता है। साझा डेटा कॉन्ट्रैक्ट (टाइप, Zod स्कीमा, कॉन्स्टेंट) `packages/shared` में रहते हैं और दोनों तरफ़ इंपोर्ट होते हैं।

## ऐप का आर्किटेक्चर

### तीन-कॉलम लेआउट

UI का डिज़ाइन Discord जैसा तीन-कॉलम वाला है, जिसे `components/layout/AppShell.tsx` संभालता है:

```
+-------------+-----------------------------+--------------+
|  Left       |         Center              |  Right       |
|  Sidebar    |                             |  Panel       |
|             |  Chat area or Editor        |              |
|  Chat list  |  (lazy-loaded)              |  Characters  |
|  Folders    |                             |  Lorebooks   |
|  Mode tabs  |  ChatConversationSurface    |  Presets     |
|             |  ChatRoleplaySurface        |  Connections |
|             |  GameSurface                |  Agents      |
|             |  CharacterEditor            |  Personas    |
|             |  LorebookEditor             |  Settings    |
|             |  PresetEditor               |  Browser     |
|             |  ...other editors           |              |
+-------------+-----------------------------+--------------+
```

- बाईं साइडबार (`components/layout/ChatSidebar.tsx`): चैट की लिस्ट, फ़ोल्डर के हिसाब से बँटी हुई और मोड (Conversation, Roleplay, Game) से फ़िल्टर होने वाली।
- बीच का हिस्सा: या तो चालू चैट सरफ़ेस, या कोई पूरा एडिटर (कैरेक्टर, लोरबुक, प्रीसेट वगैरह)। एक बार में सिर्फ़ एक ही दिखता है। एडिटर चैट एरिया की जगह ले लेते हैं।
- दायाँ पैनल (`components/layout/RightPanel.tsx`): रिसोर्स ब्राउज़र और सेटिंग्स, जिन्हें ऊपर की पट्टी से टॉगल किया जाता है। एक बार पैनल माउंट हो जाने पर वह DOM में बना रहता है (CSS से छिपा हुआ), ताकि उसकी स्क्रॉल पोज़िशन और लोकल स्टेट बची रहे।
- ऊपर की पट्टी (`components/layout/TopBar.tsx`): हर दाएँ पैनल के लिए क्विक-स्विच बटन।

### नेविगेशन

नेविगेशन स्टेट से चलता है। कोई URL राउटर नहीं है। क्या रेंडर होगा, यह `stores/ui.store.ts` वाला Zustand स्टोर तय करता है:

| नेविगेशन लक्ष्य        | स्टोर फ़ील्ड         | ट्रिगर फ़ंक्शन                                    |
| ---------------------- | -------------------- | ------------------------------------------------- |
| कैरेक्टर एडिटर खोलना   | `characterDetailId`  | `openCharacterDetail(id)`                          |
| लोरबुक एडिटर खोलना     | `lorebookDetailId`   | `openLorebookDetail(id)`                           |
| प्रीसेट एडिटर खोलना    | `presetDetailId`     | `openPresetDetail(id)`                             |
| कनेक्शन एडिटर खोलना    | `connectionDetailId` | `openConnectionDetail(id)`                         |
| एजेंट एडिटर खोलना      | `agentDetailId`      | `openAgentDetail(id)`                              |
| पर्सोना एडिटर खोलना    | `personaDetailId`    | `openPersonaDetail(id)`                            |
| दायाँ पैनल बदलना       | `rightPanel`         | `openRightPanel(name)` / `toggleRightPanel(name)` |
| विंडो खोलना            | `modal`              | `openModal(type, props?)`                          |

### कोड स्प्लिटिंग

बड़े एडिटर और भारी कंपोनेंट `AppShell.tsx` में `React.lazy()` और `Suspense` से लेज़ी-लोड होते हैं। इससे शुरुआती बंडल छोटा रहता है (नीचे बंडल बजट देखें)।

## स्टेट मैनेजमेंट

### Zustand स्टोर (क्लाइंट स्टेट)

UI और रनटाइम स्टेट के लिए क्लाइंट `packages/client/src/stores/` में Zustand स्टोर का एक सेट इस्तेमाल करता है। सिर्फ़ `ui.store.ts` ही परसिस्ट होता है। बाकी स्टोर चैट, एजेंट, गेम, लोकल मॉडल रनटाइम, ट्रांसलेशन, डायलॉग, बैकफ़िल और टेबल गेम की रनटाइम स्टेट रखते हैं।

अभी के स्टोर फ़ाइलें ये हैं: `agent.store.ts`, `backfill.store.ts`, `chat.store.ts`, `chess-game.store.ts`, `dialog.store.ts`, `encounter.store.ts`, `gallery.store.ts`, `game-asset.store.ts`, `game-mode.store.ts`, `game-state.store.ts`, `poker-game.store.ts`, `sidecar.store.ts`, `translation.store.ts`, `ui.store.ts`, और `uno-game.store.ts`।

#### `ui.store.ts`: सेटिंग्स और UI क्रोम

यही अकेला परसिस्ट होने वाला स्टोर है (Zustand के `persist` मिडलवेयर के ज़रिए localStorage में)। इसमें रहता है:

- थीम: `visualTheme` ("default" या "sillytavern"), `data-theme` की वैल्यू (dark या light), और कस्टम रंग ओवरराइड।
- अपीयरेंस: `fontSize`, `chatFontSize`, `fontFamily`, कस्टम फ़ॉन्ट, और कर्सर स्टाइल।
- चैट डिस्प्ले: `boldDialogue`, `showTimestamps`, `showModelName`, और `messagesPerPage`।
- टेक्स्ट स्टाइलिंग: चैट टेक्स्ट का रंग, Roleplay संदेश के बैकग्राउंड की अपारदर्शिता, और टेक्स्ट स्ट्रोक।
- स्ट्रीमिंग: `enableStreaming` और `streamingSpeed`।
- Conversation थीम: संदेश बबल के ग्रेडिएंट रंग।
- ध्वनि: `convoNotificationSound` और `rpNotificationSound`।
- व्यवहार: `confirmBeforeDelete`, `enterToSendRP`, `enterToSendConvo`, `weatherEffects`, और `guideGenerations`।
- नेविगेशन: `rightPanel`, `rightPanelOpen`, `sidebarOpen`, `settingsTab`, सारे `*DetailId` फ़ील्ड, और `modal`।

सिंक होने वाली कस्टम थीम `ui.store.ts` में नहीं रखी जातीं। वे React Query के ज़रिए सर्वर से आती हैं और एक ही Marinara इंस्टेंस से जुड़े सभी डिवाइस पर एक जैसी दिखती हैं।

#### `chat.store.ts`: चैट रनटाइम

परसिस्ट नहीं होता। चालू चैट सेशन पर नज़र रखता है:

- `activeChatId`: कौन-सी चैट दिख रही है।
- `messages`: अभी का संदेश ऐरे।
- `isStreaming`, `streamBuffer`: जेनरेशन चल रहा है।
- `inputDrafts`: हर चैट के ड्राफ़्ट संदेश।
- `currentInput`: चैट इनपुट की अभी की वैल्यू।
- `perChatTyping`: टाइपिंग इंडिकेटर की स्टेट।
- `unreadCounts`, `chatNotifications`: नोटिफ़िकेशन बैज।
- `abortControllers`: चल रहे जेनरेशन रद्द करना।

#### `agent.store.ts`: एजेंट एक्ज़ीक्यूशन

जेनरेशन के दौरान और बाद में एजेंट पाइपलाइन की स्टेट पर नज़र रखता है:

- `activeAgents`: अभी चल रहे एजेंट।
- `thoughtBubbles`: एजेंट की सोच, जो रियल टाइम में दिखती है।
- `echoMessages`: echo chamber (नकली दर्शक चैट)।
- `cyoaChoices`: विकल्पों वाला ब्रांचिंग UI।
- `debugLog`: परफ़ॉर्मेंस मेट्रिक और टोकन खर्च।
- `failedAgentTypes`: जिन एजेंट में गड़बड़ी हुई (रीट्राई UI के लिए)।

#### `game-state.store.ts`: RPG साथी

Roleplay मोड के लिए सीन और दुनिया का कॉन्टेक्स्ट रखता है:

- `current` (GameState): तारीख, समय, जगह, मौसम, मौजूद कैरेक्टर, घटनाएँ, प्लेयर स्टैट, क्वेस्ट और इन्वेंटरी।
- `isVisible`, `expandedSections`: HUD डिस्प्ले की स्टेट।

#### `encounter.store.ts`: कॉम्बैट सिस्टम

टर्न-आधारित कॉम्बैट की स्टेट:

- `active`: कोई एनकाउंटर चल रहा है या नहीं।
- `party`, `enemies`: HP, हमलों और स्टेटस समेत लड़ने वाले।
- `environment`: अखाड़े का ब्योरा।
- `playerActions`, `encounterLog`: एक्शन कतार और इतिहास।
- `combatResult`: जीत, हार, भागना, या बीच में रुकना।

#### `gallery.store.ts`: इमेज ओवरले

- `pinnedImages`: चैट एरिया पर ओवरले की तरह पिन की गई इमेज।

### React Query (सर्वर डेटा)

सर्वर का सारा डेटा TanStack React Query से आता है और वहीं कैश होता है, जिसकी सेटिंग `main.tsx` में है:

- स्टेल टाइम: 30 सेकंड (ग्लोबल डिफ़ॉल्ट)।
- रीट्राई: 1 कोशिश।
- फ़ोकस पर दोबारा फ़ेच: बंद।
- कैश: सिर्फ़ मेमोरी में (कहीं सेव नहीं होता)।

हर एंटिटी की अपनी हुक फ़ाइल है, जो क्वेरी और म्यूटेशन हुक एक्सपोर्ट करती है।

## हुक रेफ़रेंस

सारे हुक `src/hooks/` में हैं और `use-{entity}.ts` पैटर्न पर चलते हैं।

### चैट हुक (`use-chats.ts`)

| हुक                                | प्रकार         | विवरण                                        |
| ---------------------------------- | -------------- | -------------------------------------------- |
| `useChats()`                       | Query          | सारी चैट                                     |
| `useChat(id)`                      | Query          | ID से एक चैट                                 |
| `useChatMessages(chatId, perPage)` | Infinite Query | चैट के संदेश, पेज दर पेज                     |
| `useChatGroup(groupId)`            | Query          | चैट ग्रुप                                    |
| `useCreateChat()`                  | Mutation       | नई चैट बनाना                                 |
| `useDeleteChat()`                  | Mutation       | चैट मिटाना                                   |
| `useUpdateChatMetadata()`          | Mutation       | चैट मेटाडेटा अपडेट करना (एजेंट, स्प्राइट वगैरह) |
| `useBranchChat()`                  | Mutation       | किसी संदेश से चैट की ब्रांच बनाना            |
| `useUpdateMessage()`               | Mutation       | संदेश का टेक्स्ट बदलना (ऑप्टिमिस्टिक अपडेट)  |
| `useDeleteMessage()`               | Mutation       | एक संदेश मिटाना                              |
| `useDeleteMessages()`              | Mutation       | कई संदेश मिटाना                              |
| `useSetActiveSwipe()`              | Mutation       | किसी दूसरे जेनरेशन स्वाइप पर जाना            |
| `usePeekPrompt()`                  | Mutation       | तैयार प्रॉम्प्ट पहले से देखना                |
| `useClearAllData()`                | Mutation       | सब कुछ मिटाना (वापस नहीं आता)                |

### कैरेक्टर हुक (`use-characters.ts`)

| हुक                    | प्रकार   | विवरण                                  |
| ---------------------- | -------- | -------------------------------------- |
| `useCharacters()`      | Query    | सारे कैरेक्टर                          |
| `useCharacter(id)`     | Query    | पार्स किए कार्ड डेटा के साथ एक कैरेक्टर |
| `useCreateCharacter()` | Mutation | कैरेक्टर बनाना                         |
| `useUpdateCharacter()` | Mutation | कैरेक्टर कार्ड का डेटा अपडेट करना      |
| `useDeleteCharacter()` | Mutation | कैरेक्टर मिटाना                        |
| `useUploadAvatar()`    | Mutation | अवतार इमेज अपलोड करना                  |
| `usePersonas()`        | Query    | सारे पर्सोना                           |
| `usePersona(id)`       | Query    | एक पर्सोना                             |
| `useCreatePersona()`   | Mutation | पर्सोना बनाना                          |
| `useUpdatePersona()`   | Mutation | पर्सोना अपडेट करना                     |
| `useDeletePersona()`   | Mutation | पर्सोना मिटाना                         |
| `useCharacterGroups()` | Query    | कैरेक्टर ग्रुप                         |
| `usePersonaGroups()`   | Query    | पर्सोना ग्रुप                          |

### प्रीसेट हुक (`use-presets.ts`)

| हुक                            | प्रकार   | विवरण                                                       |
| ------------------------------ | -------- | ---------------------------------------------------------- |
| `usePresets()`                 | Query    | सारे प्रीसेट                                               |
| `usePreset(id)`                | Query    | एक प्रीसेट                                                 |
| `usePresetFull(id)`            | Query    | सेक्शन, ग्रुप और चॉइस समेत प्रीसेट                         |
| `useDefaultPreset()`           | Query    | डिफ़ॉल्ट प्रीसेट                                            |
| `useCreatePreset()`            | Mutation | प्रीसेट बनाना                                              |
| `useUpdatePreset()`            | Mutation | प्रीसेट अपडेट करना                                         |
| `useDeletePreset()`            | Mutation | प्रीसेट मिटाना                                             |
| `usePresetSections(presetId)`  | Query    | प्रीसेट के प्रॉम्प्ट सेक्शन                                |
| `usePresetGroups(presetId)`    | Query    | सेक्शन ग्रुप                                               |
| `usePresetVariables(presetId)` | Query    | प्रीसेट वेरिएबल (पहले चॉइस ब्लॉक कहलाते थे)                |
| `usePreviewPreset()`           | Mutation | `{ presetId, chatId, choices }` के लिए तैयार प्रॉम्प्ट प्रीव्यू |

### एजेंट हुक (`use-agents.ts`)

| हुक                  | प्रकार   | विवरण                           |
| -------------------- | -------- | ------------------------------- |
| `useAgentConfigs()`  | Query    | सारे एजेंट कॉन्फ़िगरेशन          |
| `useAgentConfig(id)` | Query    | एक एजेंट कॉन्फ़िग                |
| `useCreateAgent()`   | Mutation | कस्टम एजेंट बनाना               |
| `useUpdateAgent()`   | Mutation | एजेंट कॉन्फ़िग अपडेट करना        |
| `useDeleteAgent()`   | Mutation | एजेंट मिटाना                    |
| `useToggleAgent()`   | Mutation | बिल्ट-इन एजेंट चालू या बंद करना |

### जेनरेशन हुक (`use-generate.ts`)

सबसे पेचीदा हुक। यह `{ generate, retryAgents }` लौटाता है।

`generate(params)` एक ही ऑप्शन ऑब्जेक्ट लेता है, जिसमें `chatId`, `connectionId`, `userMessage`, `regenerateMessageId`, `continueMessageId`, `impersonate` और `attachments` जैसे फ़ील्ड होते हैं। अगर उस चैट का कोई जेनरेशन पहले से चल रहा हो तो यह `false` लौटाता है। इसका क्रम इस तरह है:

1. `chat.store.ts` में स्ट्रीमिंग स्टेट सेट करता है।
2. जेनरेशन रिक्वेस्ट `/api/generate` पर भेजता है।
3. `token`, `agent_start`, `agent_result`, `agent_error`, `thinking`, `tool_call`, `game_state`, `game_state_patch`, `text_rewrite`, `scene_created`, `done` और `error` जैसी SSE इवेंट पार्स करता है।
4. नए संदेशों के साथ React Query कैश अपडेट करता है।
5. एजेंट स्टोर में थॉट बबल और डीबग जानकारी भरता है।
6. गड़बड़ी होने पर टोस्ट नोटिफ़िकेशन दिखाता है।

### बाकी हुक

`src/hooks/` फ़ोल्डर में हर फ़ीचर के अपने कई हुक भी हैं। कुछ नमूने:

| फ़ाइल                          | काम                                       |
| ------------------------------ | ----------------------------------------- |
| `use-connections.ts`           | API कनेक्शन CRUD और टेस्ट                 |
| `use-lorebooks.ts`             | लोरबुक और एंट्री CRUD                      |
| `use-scene.ts`                 | सीन की योजना, रचना और समापन                |
| `use-encounter.ts`             | कॉम्बैट एनकाउंटर की शुरुआत, एक्शन, सारांश  |
| `use-autonomous-messaging.ts`  | ऑटोनॉमस संदेश की पोलिंग और शेड्यूलिंग      |
| `use-idle-detection.ts`        | 10 मिनट की निष्क्रियता पकड़ने वाला         |
| `use-background-autonomous.ts` | ठंडी पड़ी चैट के लिए बैकग्राउंड पोलिंग      |
| `use-translate.ts`             | टेक्स्ट ट्रांसलेशन                        |
| `use-apply-regex.ts`           | संदेशों पर रेजेक्स स्क्रिप्ट चलाना         |
| `use-custom-tools.ts`          | कस्टम टूल CRUD                            |
| `use-knowledge-sources.ts`     | नॉलेज सोर्स का प्रबंधन                     |
| `use-gallery.ts`               | चैट गैलरी की इमेज                          |
| `use-chat-folders.ts`          | चैट फ़ोल्डर CRUD और क्रम बदलना             |
| `use-regex-scripts.ts`         | रेजेक्स स्क्रिप्ट CRUD                     |
| `use-haptic.ts`                | Haptic डिवाइस कनेक्शन और कमांड             |

## कंपोनेंट गाइड

### चैट सिस्टम (`components/chat/`)

चैट सिस्टम सबसे बड़ा फ़ीचर एरिया है। `ChatArea.tsx` तीन रेंडरिंग सरफ़ेस लेज़ी-लोड करता है: Conversation, Roleplay और Game Mode।

#### Conversation मोड (`ChatConversationSurface.tsx`)

मैसेंजर जैसे चैट बबल। आपके संदेश दाईं तरफ़, असिस्टेंट के बाईं तरफ़। खासियतें:

- इनफ़ाइनाइट स्क्रॉल पेजिनेशन (ऊपर स्क्रॉल करने पर पुराने संदेश लोड होते हैं)।
- हर संदेश पर एक्शन: एडिट, कॉपी, दोबारा जेनरेट करना, मिटाना, ब्रांच, प्रॉम्प्ट झाँकना।
- अटैचमेंट सपोर्ट (इमेज और फ़ाइल)।
- इमोजी और GIF पिकर।
- स्लैश कमांड।
- नए संदेश पर नोटिफ़िकेशन ध्वनि।
- हर चैट के ड्राफ़्ट सेव रहना।

#### Roleplay मोड (`ChatRoleplaySurface.tsx`)

गहरे रंगों वाला, डुबो देने वाला RPG थीम का इंटरफ़ेस। इसमें Conversation की सारी खूबियाँ हैं, और साथ में:

- कैरेक्टर स्प्राइट, जिनके एक्सप्रेशन expression एजेंट बदलता है।
- Roleplay HUD, जो गेम स्टेट दिखाता है (समय, जगह, मौसम, मौजूद कैरेक्टर)।
- मौसम के असर (सीन के मौसम से मिलते-जुलते पार्टिकल ओवरले)।
- echo chamber पैनल (नकली दर्शक रिएक्शन)।
- टर्न-आधारित एक्शन सिस्टम वाले कॉम्बैट एनकाउंटर।
- World Info पैनल, जो चालू लोरबुक एंट्री दिखाता है।
- छोटे-छोटे ब्रांचिंग रोलप्ले के लिए सीन सिस्टम।
- क्रॉसफ़ेड ट्रांज़िशन वाली बैकग्राउंड इमेज।

#### Game Mode (`GameSurface.tsx`)

AI Game Master वाला सरफ़ेस। यह चैट फ़ोल्डर के बाहर, `components/game/GameSurface.tsx` में रहता है। चैट का मोड `game` होने पर `ChatArea.tsx` इसे रेंडर करता है। यह गेम के अपने स्टोर पढ़ता है (`game-mode.store.ts`, `game-asset.store.ts`, `game-state.store.ts`)। सेशन, डाइस रोल, स्किल चेक, मैप और टर्न स्टोरीबोर्ड यह `use-game.ts` तथा `use-game-storyboards.ts` के हुक से चलाता है।

#### मुख्य कंपोनेंट

- `ChatArea.tsx`: बीच का संचालक। यह सारा डेटा लाता है (संदेश, कैरेक्टर, पर्सोना), कैरेक्टर मैप बनाता है, चैट का मोड तय करता है, और सही सरफ़ेस रेंडर करता है।
- `ChatMessage.tsx`: एक संदेश को मार्कडाउन, स्वाइप नेविगेशन, एडिटिंग और एक्शन मेन्यू के साथ रेंडर करता है। एडिट करते समय बार-बार रेंडर न हो, इसके लिए यह अनकंट्रोल्ड `EditTextarea` सबकंपोनेंट इस्तेमाल करता है।
- `ChatInput.tsx`: आपका इनपुट, जिसमें अपने आप ऊँचाई बदलना, ड्राफ़्ट सेव रहना, स्लैश कमांड पूरा होना, अटैचमेंट संभालना, और इमोजी या GIF जोड़ना शामिल है।

### एडिटर कंपोनेंट

हर रिसोर्स टाइप का एक पूरे पेज वाला एडिटर है, जो चैट एरिया की जगह ले लेता है:

| एडिटर             | फ़ाइल                                          | क्या संभालता है                                                                 |
| ----------------- | --------------------------------------------- | ------------------------------------------------------------------------------- |
| Character Editor  | `components/characters/CharacterEditor.tsx`   | कैरेक्टर कार्ड के फ़ील्ड, अवतार, ग्रीटिंग, व्यक्तित्व, सिस्टम प्रॉम्प्ट, मेटाडेटा   |
| Lorebook Editor   | `components/lorebooks/LorebookEditor.tsx`     | लोरबुक का मेटाडेटा और एंट्री, उनकी कीवर्ड, चालू होने के नियम, प्रॉम्प्ट में जोड़ने की सेटिंग्स   |
| Preset Editor     | `components/presets/PresetEditor.tsx`         | प्रॉम्प्ट सेक्शन, ग्रुप, मार्कर, जेनरेशन पैरामीटर, चॉइस ब्लॉक                    |
| Connection Editor | `components/connections/ConnectionEditor.tsx` | API प्रोवाइडर, बेस URL, मॉडल, कॉन्टेक्स्ट विंडो, फ़्लैग                           |
| Agent Editor      | `components/agents/AgentEditor.tsx`           | एजेंट का प्रॉम्प्ट टेम्पलेट, फ़ेज़, कनेक्शन, टूल, सेटिंग्स                        |
| Persona Editor    | `components/personas/PersonaEditor.tsx`       | नाम, विवरण, स्टैट और अवतार वाला पर्सोना                                          |

### विंडो सिस्टम (`components/modals/`)

विंडो `components/layout/ModalRenderer.tsx` रेंडर करता है। यह `ui.store.modal` पढ़ता है और मिलता-जुलता कंपोनेंट `Suspense` के अंदर रेंडर करता है। विंडो के कंपोनेंट `components/modals/` के नीचे रहते हैं।

अभी के विंडो टाइप में ये शामिल हैं (यह सूची नमूना है, पूरी नहीं):

| टाइप                       | कंपोनेंट                      | काम                                        |
| -------------------------- | ----------------------------- | ------------------------------------------ |
| `create-character`         | `CreateCharacterModal`        | झटपट कैरेक्टर बनाना (नाम और अवतार)         |
| `create-connection`        | `CreateConnectionModal`       | झटपट कनेक्शन बनाना                         |
| `create-persona`           | `CreatePersonaModal`          | झटपट पर्सोना बनाना                         |
| `create-lorebook`          | `CreateLorebookModal`         | झटपट लोरबुक बनाना                          |
| `create-preset`            | `CreatePresetModal`           | झटपट प्रीसेट बनाना                         |
| `import-character`         | `ImportCharacterModal`        | फ़ाइल से इंपोर्ट (JSON या PNG)              |
| `import-connection`        | `ImportConnectionModal`       | कनेक्शन पैकेज इंपोर्ट करना                 |
| `import-lorebook`          | `ImportLorebookModal`         | फ़ाइल से इंपोर्ट                            |
| `import-preset`            | `ImportPresetModal`           | फ़ाइल से इंपोर्ट                            |
| `import-persona`           | `ImportPersonaModal`          | फ़ाइल से इंपोर्ट                            |
| `character-card-update`    | `CharacterCardUpdateModal`    | एजेंट के सुझाए कार्ड बदलावों की समीक्षा     |
| `agent-write-approval`     | `AgentWriteApprovalModal`     | एजेंट के लिखने की मंज़ूरी और समीक्षा         |
| `docs-viewer`              | `DocsViewerModal`             | ऐप के अंदर डॉक्यूमेंटेशन ब्राउज़र            |
| `st-bulk-import`           | `STBulkImportModal`           | SillyTavern के डेटा का थोक इंपोर्ट          |
| `about-me-viewer`          | `AboutMeViewerModal`          | Conversation मोड का About Me देखना          |
| `scene-prompt-preferences` | `ScenePromptPreferencesModal` | सीन प्रॉम्प्ट की पसंद वाली सेटिंग्स         |

विंडो का पैटर्न: हर विंडो `{ open, onClose }` लेती है, सामग्री को `Modal` बेस कंपोनेंट में लपेटती है, API कॉल के लिए म्यूटेशन इस्तेमाल करती है, और लोडिंग स्टेट `mutation.isPending` से दिखाती है।

### पैनल सिस्टम (`components/panels/`)

दाईं तरफ़ के पैनल रिसोर्स की लिस्ट दिखाते हैं, जिनमें सर्च, सॉर्ट और फ़िल्टर होते हैं। किसी रिसोर्स पर क्लिक करने से उसका पूरा एडिटर बीच वाले हिस्से में खुल जाता है।

पैनल `RightPanel.tsx` में दो जगह रजिस्टर होते हैं:

1. `PANEL_CONFIG`: शीर्षक, आइकन और ग्रेडिएंट रंग।
2. `PANELS`: कंपोनेंट मैप।

पैनल मॉड्यूल-लेवल परसिस्टेंस इस्तेमाल करते हैं। एक `mountedPanels` Set याद रखता है कि कौन-से पैनल खुल चुके हैं। एक बार माउंट होने पर पैनल DOM में बना रहता है (`display: none` या `aria-hidden` से छिपा हुआ), ताकि उसकी स्टेट बची रहे।

### UI प्रिमिटिव (`components/ui/`)

| कंपोनेंट           | विवरण                                                                  |
| ------------------ | --------------------------------------------------------------------- |
| `Modal`            | बेस विंडो, जिसमें बैकड्रॉप क्लिक, Esc कुंजी, खुलने और बंद होने के एनिमेशन हैं |
| `ColorPicker`      | ठोस रंग या ग्रेडिएंट पिकर, प्रीसेट स्वैच के साथ                        |
| `ExpandedTextarea` | बड़े टेक्स्ट ब्लॉक एडिट करने के लिए पूरी स्क्रीन वाला पोर्टल ओवरले      |
| `EmojiPicker`      | सर्च वाला इमोजी पॉपओवर (पोर्टल से रेंडर होता है)                       |
| `GifPicker`        | Giphy API से GIF सर्च                                                  |
| `HelpTooltip`      | हॉवर पर आइकन, जो पोर्टल से रखा गया टूलटिप दिखाता है                    |

सारे UI कंपोनेंट कंट्रोल्ड प्रॉप (value और onChange) इस्तेमाल करते हैं और ओवरले के लिए पोर्टल रेंडरिंग।

## API क्लाइंट (`lib/api-client.ts`)

सर्वर से सारी बातचीत `api` ऑब्जेक्ट के ज़रिए होती है:

```typescript
import { api, ApiError } from "@/lib/api-client";
```

| मेथड                           | सिग्नेचर            | विवरण                                 |
| ------------------------------ | ------------------- | ------------------------------------- |
| `api.get<T>(path)`             | `GET /api{path}`    | JSON लाना                             |
| `api.post<T>(path, body)`      | `POST /api{path}`   | JSON भेजना, JSON पाना                 |
| `api.put<T>(path, body)`       | `PUT /api{path}`    | पूरा अपडेट                            |
| `api.patch<T>(path, body)`     | `PATCH /api{path}`  | आंशिक अपडेट                           |
| `api.delete(path)`             | `DELETE /api{path}` | रिसोर्स मिटाना                        |
| `api.upload(path, FormData)`   | `POST /api{path}`   | मल्टीपार्ट फ़ाइल अपलोड                 |
| `api.download(path, filename)` | `GET /api{path}`    | डाउनलोड और सेव-ऐज़ विंडो               |
| `api.stream(path, body)`       | `POST /api{path}`   | SSE async जेनरेटर (सिर्फ़ टोकन)        |
| `api.streamEvents(path, body)` | `POST /api{path}`   | SSE async जेनरेटर (सारे इवेंट टाइप)   |

गड़बड़ी होने पर `ApiError` थ्रो होता है, जिसमें `status` और `message` प्रॉपर्टी रहती हैं।

## स्टाइलिंग सिस्टम

### Tailwind CSS v4

प्रोजेक्ट Tailwind CSS v4 को `@tailwindcss/vite` प्लगिन के साथ इस्तेमाल करता है (PostCSS कॉन्फ़िग की ज़रूरत नहीं)। थीम टोकन `globals.css` की CSS कस्टम प्रॉपर्टी से मैप होते हैं:

```css
@theme {
  --color-primary: var(--primary);
  --color-background: var(--background);
  --color-border: var(--border);
  /* ... */
}
```

### थीम आर्किटेक्चर

`globals.css` नाम वाले सेक्शन में बँटी है। इनमें Tailwind की `@theme` मैपिंग, डार्क थीम वेरिएबल, लाइट थीम ओवरराइड, बेस रीसेट, कस्टम कर्सर, स्क्रॉलबार, ग्लास पैनल, ग्लो यूटिलिटी, UI कंपोनेंट और कीफ़्रेम एनिमेशन शामिल हैं। बाकी सेक्शन चैट एनिमेशन, हर मोड की चैट स्टाइलिंग, स्प्राइट और गेम HUD, फ़ंक्शन-कॉल कार्ड, रिस्पॉन्सिव नियम, इंपोर्ट की गई SillyTavern थीम, ऐक्सेसिबिलिटी नियम और परफ़ॉर्मेंस संकेत संभालते हैं।

### कस्टम थीम

कस्टम थीम बनाई जा सकती हैं। थीम की परिभाषाएँ Marinara सर्वर पर सेव होती हैं और जुड़े हुए सभी डिवाइस पर सिंक हो जाती हैं। चालू कस्टम थीम भी साझा होती है। CSS को `CustomThemeInjector.tsx` एक `style` टैग के रूप में जोड़ता है।

सिंक होने वाली थीम की CSS `--marinara-theme-accent-pulse: enabled` लिखकर बिल्ट-इन Accent Pulse इंजन माँग सकती है। अगर पल्स को Appearance के मौजूदा एक्सेंट की जगह किसी खास थीम एक्सेंट पर चलाना हो तो `--marinara-theme-accent-pulse-source: #a78bfa` (या कोई ग्रेडिएंट) जोड़ें।

### Personal Extensions

Personal Extensions सर्वर पर सेव, हैश से हूबहू मंज़ूर किया गया सैंडबॉक्स्ड कोड होता है। Addons UI `use-personal-extensions.ts` इस्तेमाल करता है; `PersonalExtensionInjector.tsx` मंज़ूर हुए Browser कोड को एक opaque-origin सैंडबॉक्स्ड iframe के अंदर अलग Worker में चलाता है और चालू चैट के कॉन्टेक्स्ट के न बदलने वाले स्नैपशॉट पहुँचाता है। कॉन्टेक्स्ट के फ़ील्ड हमेशा मौजूद रहते हैं; चालू चैट के बाहर `chatId` और `characterId` `null` होते हैं और `characterIds` खाली रहता है। चालू कैरेक्टर कार्ड और चुने हुए पर्सोना के सीमित फ़ील्ड के लिए अलग से घोषित, हैश से बँधी परमिशन चाहिए। सर्वर एक्सटेंशन एक अलग Node प्रोसेस में, macOS Seatbelt या Linux Bubblewrap के अंदर चलते हैं, और दोनों में से कोई बैकएंड न मिलने पर बंद हो जाते हैं। बाहरी सोर्स के लिए `.env` गेट चाहिए, और लिस्टिंग, मंज़ूरी तथा रनटाइम, तीनों सीमाओं पर Danger Zone वाली सहमति भी।

इस फ़ीचर में बदलाव से पहले [पर्सनल एक्सटेंशन का आर्किटेक्चर](personal-extensions.md) पढ़ें।

## साझा पैकेज (`packages/shared`)

फ़्रंटएंड टाइप, स्कीमा और कॉन्स्टेंट `@marinara-engine/shared` से इंपोर्ट करता है।

### कॉन्स्टेंट

`packages/shared/src/constants/` की मुख्य फ़ाइलें:

- `defaults.ts`: `APP_VERSION`, `PROFESSOR_MARI_ID`, `DEFAULT_CONNECTION_ID`, `DEFAULT_GENERATION_PARAMS`, `MAX_FILE_SIZES` और `LIMITS` जैसे एक्सपोर्ट। वर्ज़न का स्रोत यही है, और डिफ़ॉल्ट जेनरेशन सेटिंग्स भी यहीं रहती हैं।
- `providers.ts`: `PROVIDERS` एक्सपोर्ट करती है, यानी API प्रोवाइडर के कॉन्फ़िग (OpenAI, Anthropic, Google वगैरह) उनके URL और ऑथ के साथ।
- `model-lists.ts`: हर प्रोवाइडर की स्थिर मॉडल सूची, और इमेज जेनरेशन प्रोवाइडर के लिए `IMAGE_GENERATION_SOURCES`।
- `agent-prompts.ts`: सिर्फ़ बेस वाले सारांश और सीक्रेट-प्लॉट प्रॉम्प्ट, साथ ही इंस्टॉल किए एजेंट पैकेज से आने वाले प्रॉम्प्ट की रनटाइम खोज।

### स्कीमा (Zod)

सारा इनपुट वैलिडेशन `packages/shared/src/schemas/` की Zod स्कीमा से होता है। कुछ प्रतिनिधि फ़ाइलें:

| स्कीमा फ़ाइल             | एंटिटी                                                             |
| ----------------------- | ------------------------------------------------------------------ |
| `agent.schema.ts`       | AgentConfig बनाना और अपडेट करना, एजेंट फ़ेज़, रिज़ल्ट टाइप            |
| `character.schema.ts`   | कैरेक्टर कार्ड, कंपैटिबिलिटी मेटाडेटा, कैरेक्टर बुक, ग्रुप         |
| `chat.schema.ts`        | चैट बनाना, संदेश बनाना, जेनरेशन रिक्वेस्ट                          |
| `connection.schema.ts`  | API कनेक्शन बनाना और अपडेट करना                                    |
| `custom-tool.schema.ts` | कस्टम टूल की परिभाषाएँ                                             |
| `lorebook.schema.ts`    | लोरबुक और एंट्री बनाना/अपडेट करना, चालू होने की शर्तें, शेड्यूल      |
| `prompt.schema.ts`      | प्रीसेट, सेक्शन, ग्रुप, चॉइस ब्लॉक, जेनरेशन पैरामीटर                |
| `regex.schema.ts`       | रेजेक्स स्क्रिप्ट बनाना और अपडेट करना                              |
| `personal-extension.schema.ts` | Personal Extension के ड्राफ़्ट, हैश से हूबहू मंज़ूरी, रोलबैक, और निजी स्टोरेज |

इसी फ़ोल्डर में ऐप सेटिंग्स, चैट सेटिंग्स प्रोफ़ाइल, Conversation कॉल, कस्टम इमोजी और स्टिकर, Noodle तथा थीम की स्कीमा भी हैं।

### टाइप

एंटिटी की टाइप परिभाषाएँ `packages/shared/src/types/` में रहती हैं। मुख्य फ़ाइलों का एक नमूना:

| टाइप फ़ाइल             | मुख्य इंटरफ़ेस                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| `agent.ts`            | `AgentConfig`, `AgentResult`, `AgentContext`, `ToolDefinition`, `ToolCall`, `ToolResult`, `BUILT_IN_AGENTS` |
| `character.ts`        | `Character`, `CharacterCardV2`, `CharacterData`, `RPGStatsConfig`                                           |
| `chat.ts`             | `Chat`, `ChatMetadata`, `Message`, `MessageExtra`, `GenerationInfo`, `StreamEvent`                          |
| `connection.ts`       | `APIConnection`, `ModelInfo`, `ModelCapabilities`, `ConnectionTestResult`                                   |
| `combat-encounter.ts` | `CombatPartyMember`, `CombatEnemy`, `CombatActionResult`, `EncounterSettings`                               |
| `game-state.ts`       | `GameState`, `PresentCharacter`, `PlayerStats`, `QuestProgress`, `InventoryItem`                            |
| `lorebook.ts`         | `Lorebook`, `LorebookEntry`, `ActivationCondition`, `LorebookSchedule`, `QuestData`                         |
| `persona.ts`          | `Persona`, `PersonaStatsConfig`                                                                             |
| `personal-extension.ts` | `PersonalExtension`, रनटाइम मेटाडेटा, रिविज़न, सोर्स, और सर्वर रनटाइम स्टेट                                |
| `prompt.ts`           | `PromptPreset`, `PromptSection`, `PromptGroup`, `ChoiceBlock`, `GenerationParameters`                       |
| `scene.ts`            | `SceneMeta`, `SceneFullPlan`                                                                                |
| `haptic.ts`           | `HapticDevice`, `HapticStatus`, `HapticDeviceCommand`                                                       |

### यूटिलिटी

| फ़ाइल              | काम                                                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `macro-engine.ts` | `resolveMacros(template, context)`: `{{date}}`, `{{char}}`, `{{random}}`, `{{roll:2d6}}` और `{{getvar::name}}` जैसे मैक्रो की जगह वैल्यू भरता है |
| `xml-wrapper.ts`  | `nameToXmlTag()`: दिखने वाले नाम को XML टैग स्लग में बदलता है ("World Info (Before)" से "world_info_before" बनता है)                        |

## API एंडपॉइंट

सर्वर (`packages/server`) `/api` के नीचे REST API देता है। यह ऊपरी स्तर का मैप है, पूरी सूची नहीं। सच्चाई का स्रोत `packages/server/src/routes/index.ts` फ़ाइल और अलग-अलग रूट फ़ाइलें हैं।

### मुख्य रिसोर्स

| प्रीफ़िक्स            | मेथड                     | विवरण                                                                                      |
| -------------------- | ------------------------ | ----------------------------------------------------------------------------------------- |
| `/api/characters`    | GET, POST, PATCH, DELETE | कैरेक्टर CRUD, ग्रुप, एक्सपोर्ट (JSON या PNG)                                               |
| `/api/chats`         | GET, POST, PATCH, DELETE | चैट CRUD, संदेश, मेटाडेटा, जोड़ना और अलग करना                                              |
| `/api/prompts`       | GET, POST, PATCH, DELETE | प्रीसेट CRUD, सेक्शन, ग्रुप, चॉइस ब्लॉक, एक्सपोर्ट                                          |
| `/api/connections`   | GET, POST, PATCH, DELETE | API कनेक्शन CRUD, कॉपी बनाना, टेस्ट                                                        |
| `/api/agents`        | GET, POST, PATCH, DELETE | एजेंट CRUD, echo संदेश, रन; बिल्ट-इन टॉगल `PUT /api/agents/toggle/:agentType` से होते हैं  |
| `/api/lorebooks`     | GET, POST, PATCH, DELETE | लोरबुक CRUD, एंट्री, एक्सपोर्ट                                                              |
| `/api/custom-tools`  | GET, POST, PATCH, DELETE | कस्टम टूल CRUD                                                                             |
| `/api/regex-scripts` | GET, POST, PATCH, DELETE | रेजेक्स स्क्रिप्ट CRUD                                                                     |

एजेंट मेमोरी टूल `/api/agents/memory/:agentType/:chatId` इस्तेमाल करते हैं, जहाँ `agentType` एजेंट टाइप की स्ट्रिंग है और `chatId` लक्ष्य चैट की id।

### जेनरेशन

| एंडपॉइंट                     | मेथड   | विवरण                                                |
| ---------------------------- | ------ | ---------------------------------------------------- |
| `/api/generate`              | POST   | एजेंट पाइपलाइन वाला मुख्य SSE जेनरेशन                 |
| `/api/generate/retry-agents` | POST   | कॉल करने वाले के दिए एजेंट टाइप के लिए SSE रीट्राई     |

### चैट के फ़ीचर

| प्रीफ़िक्स                 | एंडपॉइंट                          | विवरण                        |
| ------------------------- | -------------------------------- | ---------------------------- |
| `/api/chat-folders`       | CRUD और क्रम बदलना                | चैट फ़ोल्डर प्रबंधन           |
| `/api/conversation`       | schedule, status, message, check | ऑटोनॉमस मैसेजिंग सिस्टम      |
| `/api/scene`              | create, plan, conclude           | सीन ब्रांचिंग                 |
| `/api/encounter`          | init, action, summary            | कॉम्बैट एनकाउंटर              |
| `/api/translate`          | POST                             | टेक्स्ट ट्रांसलेशन            |
| `/api/game`               | CRUD और एक्शन                     | Game Mode के सेशन और स्टेट    |
| `/api/game-assets`        | CRUD और अपलोड                     | गेम ऐसेट                      |
| `/api/turn-games`         | Chess, UNO, Poker रूट             | Conversation के टेबल गेम      |
| `/api/conversation-calls` | कॉल और सेशन रूट                   | Conversation की ऑडियो कॉल     |

### मीडिया और ऐसेट

| प्रीफ़िक्स                     | विवरण                        |
| ----------------------------- | ---------------------------- |
| `/api/avatars/file/:filename` | अवतार इमेज सर्व करना          |
| `/api/backgrounds`            | बैकग्राउंड CRUD और अपलोड      |
| `/api/sprites/:characterId`   | स्प्राइट एक्सप्रेशन प्रबंधन   |
| `/api/fonts`                  | कस्टम फ़ॉन्ट प्रबंधन           |
| `/api/gallery/:chatId`        | हर चैट की गैलरी इमेज          |
| `/api/global-gallery`         | ग्लोबल गैलरी इमेज             |
| `/api/tts`                    | टेक्स्ट टू स्पीच रूट          |
| `/api/youtube`                | YouTube DJ रूट                |
| `/api/custom-emojis`          | कस्टम इमोजी ऐसेट              |
| `/api/custom-stickers`        | कस्टम स्टिकर ऐसेट             |
| `/api/gifs/search`            | GIF सर्च (Giphy प्रॉक्सी)     |

### बाहरी इंटीग्रेशन

| प्रीफ़िक्स                       | विवरण                        |
| ------------------------------- | ---------------------------- |
| `/api/bot-browser/chub/*`       | Chub कैरेक्टर सर्च            |
| `/api/bot-browser/chartavern/*` | CharacterTavern सर्च          |
| `/api/bot-browser/janny/*`      | JannyAI सर्च                  |
| `/api/bot-browser/pygmalion/*`  | Pygmalion सर्च                |
| `/api/bot-browser/wyvern/*`     | Wyvern सर्च                   |
| `/api/bot-browser/datacat/*`    | DataCat सर्च                  |
| `/api/haptic/*`                 | Haptic डिवाइस कंट्रोल         |
| `/api/spotify/*`                | Spotify ऑथ                    |
| `/api/knowledge-sources`        | खोज के लिए नॉलेज बेस          |

### सिस्टम

| एंडपॉइंट                        | विवरण                                   |
| ------------------------------- | --------------------------------------- |
| `/api/updates/check`            | GitHub रिलीज़ के मुकाबले वर्ज़न जाँच       |
| `/api/updates/latest`           | नई रिलीज़ का मेटाडेटा                     |
| `/api/updates/commits-behind`   | Git इंस्टॉल कितना पीछे है                |
| `/api/backup`                   | पूरा बैकअप, एक्सपोर्ट, इंपोर्ट           |
| `/api/import/*`                 | SillyTavern और Marinara प्रोफ़ाइल इंपोर्ट |
| `/api/admin/clear-all`          | सारा डेटा मिटाना                         |
| `/api/themes`                   | सिंक होने वाली कस्टम थीम                 |
| `/api/personal-extensions`      | सैंडबॉक्स्ड एक्सटेंशन की नीति, ड्राफ़्ट, मंज़ूरी, रनटाइम और निजी स्टोरेज |
| `/api/app-settings`             | सर्वर की तरफ़ की ऐप सेटिंग्स              |
| `/api/sidecar`                  | लोकल मॉडल रनटाइम                         |
| `/api/chat-presets`             | चैट सेटिंग्स प्रोफ़ाइल (पुराना एंडपॉइंट नाम) |
| `/api/connection-folders`       | कनेक्शन फ़ोल्डर                           |
| `/api/prompt-overrides`         | बिल्ट-इन प्रॉम्प्ट ओवरराइड                |
| `/api/achievements`             | अचीवमेंट अनलॉक                           |
| `/api/noodle`                   | Noodle सोशल टाइमलाइन                     |
| `/api/professor-mari/workspace` | Professor Mari वर्कस्पेस के ऑपरेशन        |

## PWA सपोर्ट

ऐप एक Progressive Web App है, जिसे VitePWA से सेट किया गया है:

- मैनिफ़ेस्ट: `public/manifest.json`, जिसमें ऐप का नाम "Marinara Engine", standalone डिस्प्ले मोड और डार्क थीम है।
- आइकन: 64px फ़ेविकॉन, 192px और 512px maskable आइकन, और एक स्प्लैश लोगो।
- सर्विस वर्कर: Workbox, ऑटो-अपडेट रणनीति के साथ।
- कैशिंग: स्टैटिक ऐसेट कैश होते हैं; `/api/*` रूट NetworkOnly इस्तेमाल करते हैं।
- कीप-अलाइव: `lib/keep-alive.ts` टैब को सोने से रोकने के लिए Web Locks API और BroadcastChannel पिंग इस्तेमाल करती है।

### वर्ज़न बेमेल की पहचान

`App.tsx` हर 5 मिनट में `/api/health` पोल करता है। अगर सर्वर का वर्ज़न क्लाइंट के कैश किए वर्ज़न से अलग निकले तो क्लाइंट सर्विस वर्कर अनरजिस्टर कर देता है। अपडेट ज़रूरी बनाने के लिए वह कैश भी साफ़ करता है।

## एजेंट सिस्टम

एजेंट सिस्टम AI के जवाबों को सेट की जा सकने वाली पाइपलाइन से गुज़ारता है। एजेंट तीन फ़ेज़ में चलते हैं:

1. जेनरेशन से पहले: मुख्य LLM कॉल से पहले (जैसे कॉन्टेक्स्ट प्रॉम्प्ट में जोड़ना या जानकारी खोजकर लाना)।
2. समानांतर: मुख्य जेनरेशन के साथ-साथ (जैसे वर्ल्ड स्टेट पर नज़र रखना या कॉम्बैट)।
3. बाद की प्रोसेसिंग: मुख्य जवाब के बाद (जैसे लेखन सुधारना या लोरबुक अपडेट करना)।

रीट्राई रिक्वेस्ट `/api/generate/retry-agents` से जाती हैं और उनमें साफ़-साफ़ `agentTypes` की सूची होती है। **Re-run Trackers** जैसा चौड़ा UI एक्शन सारे चालू ट्रैकर टाइप भेजता है। किसी एक विजेट का कंट्रोल सिर्फ़ अपना ट्रैकर भेजता है।

एजेंट मेमोरी टूल, जैसे Narrative Director का Secret Plot पैनल, `/api/agents/memory/:agentType/:chatId` इस्तेमाल करते हैं। यह रूट उन्हीं एजेंट पर लागू होता है जो हर चैट की अपनी मेमोरी रखते हैं। अभी के कॉन्फ़िग में Secret Plot मेमोरी `director` के नीचे सेव होती है, जबकि पुरानी चैट के लिए `secret-plot-driver` अब भी स्वीकार किया जाता है।

### डाउनलोड होने वाले फ़र्स्ट-पार्टी एजेंट

हल्का Engine खाली रनटाइम एजेंट रजिस्ट्री के साथ आता है। सार्वजनिक [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) कैटलॉग से इंस्टॉल किए पैकेज रनटाइम पर जाँचे हुए एजेंट मैनिफ़ेस्ट, क्लाइंट/सर्वर फ़ीचर एंट्रीपॉइंट और UI स्लॉट देते हैं। पुराने कोड से मेल बिठाने के लिए चालू परिभाषाएँ `BUILT_IN_AGENTS` से मिलती हैं, पर वे बंडल की गई इंप्लीमेंटेशन नहीं, बल्कि इंस्टॉल किए पैकेज से आती हैं। आधिकारिक कैटलॉग में ये पैकेज हैं:

| एजेंट                     | फ़ेज़             | क्या करता है                                                       |
| ------------------------ | --------------- | ----------------------------------------------------------------- |
| `prose-guardian`         | post_processing | लेखन की गुणवत्ता बनाए रखता है (दोहराव रोकना, दिखाओ-बताओ मत)         |
| `continuity`             | post_processing | कहानी की असंगतियाँ पकड़ता है और सुधार के निर्देश दे सकता है          |
| `director`               | pre_generation  | कहानी की दिशा और वैकल्पिक Secret Plot स्टेट प्रॉम्प्ट में जोड़ता है  |
| `echo-chamber`           | parallel        | दर्शकों के रिएक्शन की नकल करता है                                  |
| `world-state`            | post_processing | कहानी से तारीख, समय, जगह और मौसम निकालता है                         |
| `expression`             | post_processing | कैरेक्टर के स्प्राइट एक्सप्रेशन चुनता है                            |
| `quest`                  | post_processing | क्वेस्ट बनने, बदलने और पूरे होने पर नज़र रखता है                     |
| `background`             | post_processing | माहौल से मेल खाती बैकग्राउंड इमेज चुनता है                          |
| `character-tracker`      | post_processing | कैरेक्टर की स्टेट में बदलाव पर नज़र रखता है                          |
| `persona-stats`          | post_processing | प्लेयर पर्सोना के स्टैट बदलाव पर नज़र रखता है                        |
| `custom-tracker`         | post_processing | आपकी बनाई संरचित स्टेट पर नज़र रखता है                              |
| `inventory-tracker`      | post_processing | मुद्राओं, पहने हुए गियर और साथ रखे सामान पर नज़र रखता है              |
| `illustrator`            | post_processing | सीन के इमेज प्रॉम्प्ट और मीडिया रिक्वेस्ट बनाता है                  |
| `lorebook-keeper`        | post_processing | लोरबुक एंट्री अपने आप बनाता और अपडेट करता है                        |
| `card-evolution-auditor` | post_processing | कैरेक्टर कार्ड जाँचकर उनमें बदलाव सुझाता है                          |
| `combat`                 | parallel        | कॉम्बैट के राउंड, HP, इनिशिएटिव और नतीजों पर नज़र रखता है             |
| `html`                   | post_processing | पूरे हुए Roleplay जवाबों को दोबारा लिखकर कहानी के भीतर के HTML विज़ुअल जोड़ता है |
| `spotify`                | post_processing | Music DJ का प्लेबैक चलाता है (Spotify, YouTube, या लोकल संगीत)      |
| `knowledge-retrieval`    | pre_generation  | नॉलेज सोर्स से कॉन्टेक्स्ट लाता है                                  |
| `knowledge-router`       | pre_generation  | काम की लोरबुक और नॉलेज एंट्री आगे भेजता है                          |
| `haptic`                 | post_processing | Haptic डिवाइस को कमांड भेजता है                                     |
| `cyoa`                   | post_processing | विकल्पों वाले प्रॉम्प्ट बनाता है                                    |
| `conversation-calls`     | feature         | Conversation में ऑडियो/वीडियो कॉल और उनकी सेटिंग्स जोड़ता है         |
| `hierarchical-maps`      | feature         | Roleplay/Game के मैप, जगह का कॉन्टेक्स्ट और आवाजाही जोड़ता है         |
| `uno`                    | feature         | Conversation में UNO की टेबल जोड़ता है                              |
| `chess`                  | feature         | Conversation में शतरंज का बोर्ड जोड़ता है                            |
| `poker`                  | feature         | Conversation में Texas Hold'em की टेबल जोड़ता है                     |
| `eightball`              | feature         | Conversation में 8-Ball Pool की टेबल जोड़ता है                       |
| `tic-tac-toe`            | feature         | Conversation में Tic-Tac-Toe का बोर्ड जोड़ता है                      |
| `rock-paper-scissors`    | feature         | Conversation में Rock-Paper-Scissors के मैच जोड़ता है                |

### एजेंट रिज़ल्ट टाइप

एजेंट टाइप किए हुए रिज़ल्ट बनाते हैं, जिन्हें फ़्रंटएंड संभालता है। `packages/shared/src/types/agent.ts` के `AgentResultType` यूनियन में ये शामिल हैं:

`game_state_update`, `text_rewrite`, `sprite_change`, `echo_message`, `quest_update`, `image_prompt`, `context_injection`, `continuity_check`, `director_event`, `lorebook_update`, `character_card_update`, `background_change`, `character_tracker_update`, `persona_stats_update`, `custom_tracker_update`, `inventory_tracker_update`, `spotify_control`, `youtube_control`, `local_music_control`, `haptic_command`, `cyoa_choices`, `secret_plot`, `game_master_narration`, `party_action`, `game_map_update`, `game_state_transition`, `prompt_patch`, `frontend_theme_update`, और `about_me_update`।

## चैट मोड

### Conversation मोड

एक या एक से ज़्यादा AI कैरेक्टर के साथ सीधी बातचीत। कैरेक्टर के अलग-अलग स्टेटस हो सकते हैं (ऑनलाइन, आइडल, डू नॉट डिस्टर्ब, ऑफ़लाइन), जिनसे जवाब का समय और अंदाज़ बदलता है। बिल्ट-इन एजेंट ग्लोबल स्तर पर चालू करने के बजाय हर चैट में जोड़े जाते हैं।

### Roleplay मोड

गेम स्टेट पर नज़र रखने वाला डुबो देने वाला कथा अनुभव: सीन का कॉन्टेक्स्ट (जगह, समय, मौसम), कैरेक्टर की मौजूदगी और मिज़ाज, प्लेयर स्टैट, इन्वेंटरी और क्वेस्ट, कॉम्बैट एनकाउंटर, लोरबुक से आया World Info, और स्प्राइट एक्सप्रेशन।

### Game Mode

AI Game Master वाले सेशन, जिनमें पार्टी के साथी, डाइस, गेम स्टेट, ऐसेट, स्टोरीबोर्ड, एक जर्नल और सुव्यवस्थित सेशन जीवनचक्र होते हैं। Game Mode गेम स्टेट, ऐसेट, टेबल गेम, सीन वीडियो और स्टोरीबोर्ड के लिए अपने अलग स्टोर और रूट इस्तेमाल करता है। पाठक के नज़रिए से पूरा तरीका [Game Mode: शुरुआत](../game/getting-started.md) में देखें।

## डेवलपमेंट

### कमांड

डिपेंडेंसी इंस्टॉल करें:

```bash
pnpm install
```

हॉट रीलोड के साथ सर्वर और क्लाइंट चलाएँ:

```bash
pnpm dev
```

सिर्फ़ क्लाइंट का dev सर्वर चलाएँ:

```bash
pnpm dev:client
```

सिर्फ़ API सर्वर चलाएँ:

```bash
pnpm dev:server
```

बेसलाइन वैलिडेशन चलाएँ (TypeScript और ESLint):

```bash
pnpm check
```

प्रोडक्शन के लिए बिल्ड करें:

```bash
pnpm build
```

### बंडल बजट

- मुख्य एंट्री: ज़्यादा से ज़्यादा 1 MB।
- हर चंक: ज़्यादा से ज़्यादा 500 KB।
- वेंडर स्प्लिट: react, tanstack, motion, zustand, icons, और misc।

### पथ उपनाम

TypeScript और Vite, दोनों के कॉन्फ़िग में `@/*` का मतलब `./src/*` होता है।

## मिलती-जुलती गाइड

- [आर्किटेक्चर मैप (डेवलपर्स के लिए)](architecture-map.md)
- [फ़ाइल-नेटिव स्टोरेज](file-storage.md)
