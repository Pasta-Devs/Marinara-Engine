# अपनी Personal Extensions लिखना

यह गाइड बताती है कि Browser Extension या Server Extension कैसे लिखें, उसका पैकेज कैसे बनाएँ और उसे इंपोर्ट कैसे करें। यह उन लोगों के लिए है जो JavaScript लिख सकते हैं। किसी एक्सटेंशन की जाँच करने और उसे चलाने के लिए [पर्सनल एक्सटेंशन](personal-extensions.md) देखें।

आपके खुद लिखे और इंपोर्ट किए गए कोड को **External Extension** (बाहरी एक्सटेंशन) माना जाता है। यह शुरू में बंद रहता है और तब तक नहीं चल सकता, जब तक आप इसकी जाँच करके ठीक इसी कोड के SHA-256 हैश को मंज़ूरी नहीं देते।

## शुरू करने से पहले

External Extensions तब तक छिपे रहते हैं, जब तक आप [थर्ड-पार्टी इंपोर्ट की इजाज़त देना](personal-extensions.md#allow-third-party-imports) में बताए दोनों सुरक्षा स्टेप पूरे नहीं कर लेते: `.env` में `ENABLE_EXTERNAL_EXTENSIONS=true`, और **Settings → Advanced → Danger Zone** (सेटिंग्स → एडवांस्ड → डेंजर ज़ोन) में **Allow third-party extension imports** (थर्ड-पार्टी एक्सटेंशन इंपोर्ट की इजाज़त दें)।

एक्सटेंशन इंपोर्ट और मैनेज करने के लिए localhost एक्सेस या एडमिन सीक्रेट भी चाहिए। फ़ोन, LAN पते या रिमोट ब्राउज़र से इस्तेमाल करने के लिए सर्वर पर `ADMIN_SECRET` सेट करें और वही वैल्यू **Settings → Advanced → Admin Access** (सेटिंग्स → एडवांस्ड → एडमिन एक्सेस) में भरें।

काम पूरा कर सकने वाला सबसे कम अधिकारों वाला रनटाइम चुनें:

| रनटाइम | किस काम के लिए | महत्वपूर्ण सीमा |
| --- | --- | --- |
| Sandboxed Browser Extension | निजी स्टेट, चालू चैट का कॉन्टेक्स्ट, बटन, मेन्यू एक्शन और Marinara के रेंडर किए पैनल | Marinara DOM, कुकी, ब्राउज़र स्टोरेज, नेटवर्क या मनचाहे HTML का एक्सेस नहीं |
| Server Extension | बैकग्राउंड लॉजिक, जिसे मैनेज किए गए टाइमर और एक्सटेंशन का निजी स्टोरेज चाहिए | अलग OS सैंडबॉक्स; Marinara की फ़ाइलों, सीक्रेट, नेटवर्क, चाइल्ड प्रोसेस या नेटिव मॉड्यूल का एक्सेस नहीं |
| Full-page External Extension | पुराना कोड, जिसे Marinara का पेज या same-origin API चाहिए | सैंडबॉक्स नहीं; सिर्फ़ ठीक उसी कोड के लिए इस्तेमाल करें जिस पर आपको पूरा भरोसा हो |

Browser Extensions हर सपोर्टेड प्लैटफ़ॉर्म पर चलते हैं। Server Extensions के लिए macOS Seatbelt या Linux Bubblewrap चाहिए। Server Extension चुनने से पहले [प्लैटफ़ॉर्म टेबल](personal-extensions.md#platform-support) देखें।

## Browser Extension के साथ तुरंत शुरुआत

इस बनावट वाला फ़ोल्डर बनाएँ:

```text
Hello Panel/
  manifest.json
  extension.js
  extension.css
```

यह `manifest.json` इस्तेमाल करें:

```json
{
  "kind": "marinara.personal-extension",
  "version": 1,
  "config": {
    "name": "Hello Panel",
    "version": "1.0.0",
    "description": "A minimal sandboxed Browser Extension.",
    "runtime": "client",
    "capabilities": [],
    "jsPath": "extension.js",
    "cssPath": "extension.css"
  }
}
```

यह `extension.js` इस्तेमाल करें:

```js
const saved = await marinara.storage.get();
let count = Number(saved.count) || 0;

const statusElement = () => ({
  kind: "text",
  text: `Button pressed ${count} time${count === 1 ? "" : "s"}.`,
});
const elements = () => [
  statusElement(),
  { kind: "button", id: "increment", label: "Count one" },
];

const panel = marinara.ui.registerContribution({
  id: "hello-panel",
  kind: "panel",
  label: "Hello Panel",
  description: "Minimal Personal Extension example",
  icon: "hand",
  elements: elements(),
  onEvent: async ({ elementId }) => {
    if (elementId !== "increment") return;
    count += 1;
    await marinara.storage.patch({ count });
    panel.update({ elements: elements() });
    marinara.ui.showWindow({ title: "Hello Panel", elements: [statusElement()] });
  },
});

marinara.log.info("Hello Panel loaded");
marinara.onCleanup(() => panel.remove());
```

बटन से खुलने वाली सीमित iframe विंडो को स्टाइल देने के लिए यह `extension.css` इस्तेमाल करें:

```css
[data-ext-root] {
  font-size: 16px;
}
```

फिर इसे इंपोर्ट करके चलाएँ:

1. **Settings → Addons → External Extensions** (सेटिंग्स → ऐडऑन → बाहरी एक्सटेंशन) खोलें।
2. **Import Extension Folder** (एक्सटेंशन फ़ोल्डर इंपोर्ट करें) चुनकर `Hello Panel` चुनें, या फ़ोल्डर की ZIP बनाकर उसे **Import Extension File** (एक्सटेंशन फ़ाइल इंपोर्ट करें) से इंपोर्ट करें।
3. बंद ड्राफ़्ट खोलकर उसके मैनिफ़ेस्ट और JavaScript की जाँच करें।
4. **Review and Run** चुनें और ठीक वही हैश मंज़ूर करें जो दिखाया गया है।
5. Extensions मेन्यू खोलकर **Hello Panel** चुनें।

यही चलने वाला उदाहरण रिपॉज़िटरी में `docs/examples/personal-extensions/browser-minimal/` पर है।

## Browser API रेफ़रेंस

सैंडबॉक्स्ड Browser Extensions को `marinara` नाम का एक फ़्रीज़ किया हुआ ग्लोबल मिलता है:

| API | मकसद |
| --- | --- |
| `runtime`, `version` | रनटाइम का नाम (`client`) और मौजूदा Browser API वर्ज़न |
| `extensionId`, `extensionName`, `capabilities` | एक्सटेंशन के ठीक इसी रिविज़न की पहचान और मंज़ूर की गई क्षमताएँ |
| `log.debug/info/warn/error(...)` | ब्राउज़र कंसोल में टैग की गई एंट्री लिखना |
| `storage.get()` | इस एक्सटेंशन का निजी JSON ऑब्जेक्ट पढ़ना |
| `storage.patch(object)` | निजी स्टोरेज में वैल्यू मिलाकर नया ऑब्जेक्ट लौटाना |
| `storage.delete()` | निजी स्टोरेज साफ़ करना |
| `context.get()` | चालू चैट का मौजूदा स्नैपशॉट पढ़ना |
| `context.subscribe(listener)` | कॉन्टेक्स्ट के बदलाव पाना; अनसब्सक्राइब करने वाला फ़ंक्शन लौटाता है |
| `ui.registerContribution(options)` | सुरक्षित बटन, Extensions मेन्यू आइटम या Marinara का रेंडर किया पैनल जोड़ना |
| `ui.showWindow(options)` | सीमित iframe विंडो खोलना |
| `dice.registerFormat(options)` | `/roll` को कोई नोटेशन सिखाना; Marinara उसमें बताए गए डाइस रोल करता है |
| `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval` | मैनेज किए गए टाइमर, जो एक्सटेंशन रुकने पर हट जाते हैं |
| `onCleanup(callback)` | अतिरिक्त क्लीनअप लॉजिक रजिस्टर करना |

सामान्य UI के लिए [Marinara के रेंडर किए पैनल](#add-a-marinara-rendered-panel), चैट के हिसाब से व्यवहार के लिए [चालू चैट का कॉन्टेक्स्ट](#use-active-chat-context), और कस्टम `/roll` नोटेशन के लिए [डाइस फ़ॉर्मैट](#add-a-dice-format) इस्तेमाल करें। एक्सटेंशन का स्टेट ब्राउज़र स्टोरेज में नहीं, `marinara.storage` में रहना चाहिए।

`showWindow({ title, elements, onEvent, onClose })` ऐसा हैंडल लौटाता है जिसमें `update({ title?, elements? })` और `close()` होते हैं। पैकेज का CSS इन सैंडबॉक्स्ड iframe विंडो को स्टाइल देता है; होस्ट के रेंडर किए कंट्रिब्यूशन हमेशा Marinara की अपनी थीम और कंट्रोल इस्तेमाल करते हैं।

सुरक्षित Browser रनटाइम में कोई DOM या नेटवर्क API नहीं है। इस सीमा से बचने के रास्ते न निकालें। अगर कोई काम की क्षमता नहीं है, तो डिफ़ॉल्ट रूप से फ़ुल-पेज एक्सेस पर जाने के बजाय होस्ट से कोई सीमित क्षमता माँगें।

### कॉन्टेक्स्ट क्षमताएँ

`config.capabilities` में वैकल्पिक रिकॉर्ड एक्सेस घोषित करें:

```json
{
  "capabilities": ["read_active_characters", "read_active_persona"]
}
```

- `read_active_characters` चालू चैट के कैरेक्टर कार्ड के सीमित फ़ील्ड भरता है।
- `read_active_persona` चुने हुए पर्सोना के सीमित फ़ील्ड भरता है।
- `full_page_access` बिना सैंडबॉक्स वाला कंपैटिबिलिटी रनटाइम चुनता है और सिर्फ़ External Extensions के लिए उपलब्ध है।

क्षमताएँ बदलने से चलने वाले कोड का हैश बदलता है, एक्सटेंशन बंद हो जाता है और नई जाँच ज़रूरी होती है।

<a id="what-a-browser-extension-can-do"></a>

### Browser Extension क्या कर सकता है

Browser Extension अपने अलग Worker में चलता है, जो opaque-origin वाले सैंडबॉक्स्ड iframe के अंदर होता है। यह Marinara के पेज, DOM, कुकी, ब्राउज़र स्टोरेज, origin API या नेटवर्क तक नहीं पहुँच सकता। इसकी क्षमताएँ ये हैं: एक्सटेंशन का निजी स्टोरेज, लॉगिंग, मैनेज किए गए टाइमर, क्लीनअप रजिस्टर करना, सीमित विंडो, होस्ट में कंट्रिब्यूशन के सुरक्षित स्लॉट, और चालू चैट और कैरेक्टर ID का सिर्फ़-पढ़ने वाला स्नैपशॉट। चालू कैरेक्टर कार्ड या चुने हुए पर्सोना के चुनिंदा फ़ील्ड इसे तभी मिलते हैं, जब उनसे जुड़ी परमिशन घोषित और मंज़ूर हों।

एक्सटेंशन `marinara.ui.registerContribution(...)` से टॉप बार या साइड पैनल में एक्शन, Extensions मेन्यू में आइटम और दाईं तरफ़ टिके रहने वाले पैनल जोड़ सकते हैं। Marinara इन सतहों को मौजूदा थीम और कंट्रोल के एक तय सेट से रेंडर करता है: हेडिंग, टेक्स्ट, प्रीफ़ॉर्मैटेड आउटपुट, बटन, टेक्स्ट इनपुट, सिलेक्ट, टॉगल, स्लाइडर, कलर कंट्रोल और स्पेसर। एक्सटेंशन सिर्फ़ सामग्री और स्टेट देता है, HTML, CSS, URL, React कंपोनेंट या होस्ट के इवेंट हैंडलर कभी नहीं।

ये UI क्षमताएँ और नियम हर सैंडबॉक्स्ड Browser Extension पर एक जैसे लागू होते हैं, चाहे वह कहीं से भी आया हो। इंपोर्ट किया गया थर्ड-पार्टी (External) एक्सटेंशन भी इसी सुरक्षित रनटाइम में चलता है, जब तक उसका पैकेज साफ़ तौर पर **Full page access** न माँगे या नीचे बताए गए सैंडबॉक्स से पहले वाले `marinara.extension` फ़ॉर्मैट का इस्तेमाल न करे।

### टेक्स्ट के टोकन का अनुमान लगाएँ

Browser, Full page access और Server Personal Extensions, Marinara के बिल्ट-इन टेक्स्ट टोकन अनुमान फ़ंक्शन का इस्तेमाल कर सकते हैं:

```js
const tokens = marinara.estimateTextTokens(text);
```

इसका सिग्नेचर `estimateTextTokens(text: string): number` है, जिसे `@marinara-engine/shared` से एक्सपोर्ट होने वाला `PersonalExtensionTokenApi` टाइप भी बताता है। यह कॉल सिंक्रोनस है, इसके लिए कोई अतिरिक्त क्षमता नहीं चाहिए, और यह किसी टोकनाइज़र की सटीक गिनती के बजाय Marinara का मॉडल से स्वतंत्र टोकन अनुमान लौटाती है। Engine के पुराने वर्ज़न पर इसे कॉल करने से पहले `typeof marinara.estimateTextTokens === "function"` जाँचें।

<a id="add-a-marinara-rendered-panel"></a>

### Marinara का रेंडर किया पैनल जोड़ें

```js
const panel = marinara.ui.registerContribution({
  id: "weather-settings",
  kind: "panel",
  label: "Weather controls",
  description: "Tune a weather scene without leaving Marinara.",
  icon: "sparkles",
  elements: [
    { kind: "heading", text: "Atmosphere" },
    {
      kind: "select",
      id: "weather",
      label: "Weather",
      value: "rain",
      options: [
        { value: "rain", label: "Rain" },
        { value: "snow", label: "Snow" },
        { value: "aurora", label: "Aurora" },
      ],
    },
    { kind: "slider", id: "intensity", label: "Intensity", min: 0, max: 100, value: 60 },
    { kind: "toggle", id: "lightning", label: "Lightning", checked: false },
    { kind: "color", id: "tint", label: "Tint", value: "#6d8cff" },
    { kind: "button", id: "apply", label: "Apply" },
  ],
  onActivate: async () => {
    const settings = await marinara.storage.get();
    // Update the panel when stored state should be reflected in the controls.
  },
  onEvent: async ({ elementId, values }) => {
    if (elementId !== "apply") return;
    await marinara.storage.patch(values);
  },
});

marinara.onCleanup(() => panel.remove());
```

छोटे एक्शन के लिए `kind: "button"` और Extensions मेन्यू के एक्शन के लिए `kind: "menu-item"` इस्तेमाल करें। Command Center (कमांड सेंटर) की ऐसी एंट्री के लिए `kind: "command"` इस्तेमाल करें, जो उसी एक्सटेंशन रिविज़न का कोई मौजूदा कंट्रिब्यूशन चालू करती है। कमांड के लिए `targetContributionId` ज़रूरी है, और उसमें `onActivate` या `onEvent` इस्तेमाल नहीं हो सकते।

```js
marinara.ui.registerContribution({
  id: "open-weather",
  kind: "command",
  label: "Open weather controls",
  targetContributionId: "weather-settings",
});
```

होस्ट कमांड को उसके टारगेट से तभी जोड़ता है, जब टारगेट का एक्सटेंशन ID और कंटेंट हैश वही हो। टारगेट न मिले, किसी दूसरे एक्सटेंशन का हो या पुराने रिविज़न का हो, तो कमांड फ़ेल हो जाती है और कुछ नहीं चलता। बटन की डिफ़ॉल्ट जगह `surface: "top-bar"` है। इसके बजाय वे `chats`, `bots`, `characters`, `personas`, `lorebooks`, `presets`, `connections`, `agents` या `settings` को टारगेट कर सकते हैं, और `position` को `header`, `before-content` या `after-content` पर रख सकते हैं। `icon` में Marinara का सपोर्ट किया कोई भी kebab-case Lucide आइकन नाम दिया जा सकता है। दोनों एक्शन प्रकार `onActivate` चलाते हैं। `panel` खुलने पर `onActivate` चलाता है; उसके बटन पैनल के हर कंट्रोल की मौजूदा वैल्यू के साथ `onEvent` चलाते हैं। लौटाया गया हैंडल प्रकार के हिसाब से अपडेट लेता है: `button` में `label`, `description`, `icon`, `surface` और `position`; `menu-item` में `label`, `description` और `icon`; `panel` में `label`, `description`, `icon` और `elements` बदले जा सकते हैं। हर हैंडल `remove()` सपोर्ट करता है। ID में अक्षर, अंक, `.`, `_` और `-` हो सकते हैं।

उदाहरण के लिए, यह Presets पैनल की सामग्री के ऊपर एक नेटिव एक्शन रखता है:

```js
marinara.ui.registerContribution({
  id: "preset-helper",
  kind: "button",
  label: "Preset helper",
  description: "Run the preset helper",
  icon: "list-sparkles",
  surface: "presets",
  position: "before-content",
  onActivate: () => {
    // Run extension behavior here.
  },
});
```

जटिल टूल किसी इवेंट के बाद पैनल के एलिमेंट अपडेट करके कई स्टेप वाला इंटरफ़ेस बना सकते हैं। ऐप का स्टेट `marinara.storage` में रखें; उसे मार्कअप में न डालें।

<a id="use-active-chat-context"></a>

### चालू चैट का कॉन्टेक्स्ट इस्तेमाल करें

Browser Extension API का वर्ज़न 5 उस चैट के opaque आइडेंटिफ़ायर देता है जो अभी Marinara में दिख रही है:

```js
const renderForContext = async ({ chatId, characterId, characterIds, personaId, characters, persona }) => {
  if (!chatId) return; // Home, a library, or another surface without an active chat.

  const storage = await marinara.storage.get();
  const tab = storage.tabsByChat?.[chatId];

  // characterId is available only for a single-Character chat.
  // Use characterIds for group chats.
  marinara.log.debug("Loaded Notepad tab", {
    chatId,
    characterId,
    characterIds,
    personaId,
    characterNames: characters.map((character) => character.name),
    personaName: persona?.name ?? null,
    tab,
  });
};

const unsubscribe = marinara.context.subscribe(renderForContext);
marinara.onCleanup(unsubscribe);
```

`marinara.context.get()` वही मौजूदा स्नैपशॉट बिना सब्सक्राइब किए लौटाता है। कोई चैट चालू न हो तो `chatId` `null` रहता है और `characterIds` खाली रहता है। `characterId` तभी भरता है जब चैट में ठीक एक कैरेक्टर हो; ग्रुप चैट हर भागीदार को `characterIds` में देती है और `characterId` को `null` छोड़ देती है। `personaId` तभी भरता है जब `read_active_persona` मंज़ूर हो।

चैट और कैरेक्टर ID हमेशा मिलते हैं, और इनसे एक्सटेंशन अपने निजी स्टोरेज को अलग-अलग नेमस्पेस में बाँट सकता है। रिकॉर्ड के फ़ील्ड के लिए एक्सटेंशन मैनिफ़ेस्ट में इनमें से एक या दोनों वैकल्पिक परमिशन चाहिए:

```json
{
  "runtime": "client",
  "capabilities": ["read_active_characters", "read_active_persona"]
}
```

- `read_active_characters` चालू चैट में शामिल कार्ड के लिए `characters` भरता है।
- `read_active_persona` चालू चैट में चुने गए पर्सोना के लिए `persona` भरता है।

परमिशन के बिना उसकी वैल्यू `[]` या `null` ही रहती है। Marinara हर माँगी गई परमिशन **Requested access** में दिखाता है, और फिर ठीक उसी हैश को मंज़ूर करने वाले डायलॉग में दोबारा। कोई परमिशन जोड़ने या हटाने से चलने वाले कोड का हैश बदल जाता है, एक्सटेंशन बंद हो जाता है और नई मंज़ूरी चाहिए होती है।

कैरेक्टर के स्नैपशॉट में सिर्फ़ `id`, `name`, `description`, `personality`, `scenario`, `firstMessage`, `exampleDialogue`, `creator`, `characterVersion`, `tags`, `backstory`, `appearance`, `aboutMe` और `conversationDisplayName` आते हैं। पर्सोना के स्नैपशॉट में सिर्फ़ `id`, `name`, `description`, `personality`, `scenario`, `backstory`, `appearance`, `tags`, `aboutMe` और `conversationDisplayName` आते हैं। सैंडबॉक्स ब्रिज पार करने से पहले टेक्स्ट की लंबाई सीमित कर दी जाती है।

Marinara संदेश, क्रिएटर नोट, सिस्टम प्रॉम्प्ट, पोस्ट-हिस्ट्री निर्देश, कमेंट, अवतार के पाथ, पूरी कैरेक्टर या पर्सोना लाइब्रेरी, बिना घोषित फ़ील्ड, चैट का मेटाडेटा, डेटाबेस हैंडल, नेटवर्क एक्सेस या बदलाव करने वाले ऑपरेशन कभी नहीं भेजता। कॉन्टेक्स्ट के अपडेट मंज़ूर किए गए कोड हैश से बँधे रहते हैं, और तब भेजे जाते हैं जब चालू चैट, उसकी कैरेक्टर लिस्ट या उसका चुना हुआ पर्सोना बदलता है।

<a id="add-a-dice-format"></a>

### डाइस फ़ॉर्मैट जोड़ें

Browser Extension API वर्ज़न 6 से एक्सटेंशन `/roll` को अपना नोटेशन सिखा सकता है, जैसे नैरेटिव डाइस पूल। एक्सटेंशन नोटेशन पढ़ता है और बताता है कि कौन से डाइस रोल करने हैं; Marinara उन्हें अपने सुरक्षित रोलर से रोल करता है और आए हुए फलक लौटाता है। एक्सटेंशन बता सकता है कि रोल का क्या मतलब है, लेकिन यह कभी नहीं कि रोल में क्या आया।

```js
const SYMBOLS = { boost: [0, 0, 1, 1, 2, 1], setback: [0, 0, -1, -1, 0, 0] };

const format = marinara.dice.registerFormat({
  id: "narrative",
  label: "Narrative dice",
  // Return null for notation this format does not read.
  parse(notation) {
    const terms = [...notation.matchAll(/(\d+)\s*(boost|setback)/g)];
    if (!terms.length) return null;
    const kinds = terms.flatMap(([, count, kind]) => Array(Number(count)).fill(kind));
    return { dice: kinds.map(() => 6), kinds };
  },
  // rolls[i] is the face Marinara threw for dice[i]; plan is what parse returned.
  read({ notation, dice, rolls, plan }) {
    const net = rolls.reduce((sum, face, i) => sum + SYMBOLS[plan.kinds[i]][face - 1], 0);
    return { total: net, text: net > 0 ? `${net} success` : "failure" };
  },
});
marinara.onCleanup(() => format.remove());
```

इसके बाद `/roll 2 boost 1 setback` फलक, कुल और एक्सटेंशन का टेक्स्ट पोस्ट करता है, जिन पर फ़ॉर्मैट के नाम का लेबल होता है। `2d6` या `4d6kh3` जैसा सामान्य नोटेशन हमेशा पहले की तरह रोल होता है और कभी किसी एक्सटेंशन तक नहीं पहुँचता। बाकी नोटेशन बारी-बारी से हर रजिस्टर किए गए फ़ॉर्मैट के पास जाता है, और जिस पहले फ़ॉर्मैट का `parse` डाइस लौटाता है, वही उसे रोल करता है।

- `parse(notation)` या तो `null` लौटाता है या `{ dice: [sides, ...] }`, जिसमें 2-1000 फलक वाले 1-100 डाइस होते हैं। ऑब्जेक्ट पर मौजूद बाकी सब कुछ सैंडबॉक्स में रहता है और `read` को `plan` के रूप में वापस दिया जाता है।
- `read(...)` `{ total, text?, kept? }` लौटाता है: एक सीमित संख्या, ज़्यादा से ज़्यादा 200 अक्षर का सादा टेक्स्ट, और चाहें तो गिने गए डाइस की जगहें, छोटे से बड़े क्रम में। `/roll` बाकी डाइस पर काटने की लाइन दिखाता है।
- हर एक्सटेंशन 4 फ़ॉर्मैट रजिस्टर कर सकता है। नोटेशन ज़्यादा से ज़्यादा 100 अक्षर का होता है। `parse` और `read` एसिंक हो सकते हैं, लेकिन हर एक को 2 सेकंड के अंदर जवाब देना होगा।
- टेक्स्ट सादे टेक्स्ट के रूप में दिखता है: लिंक, इमेज, फ़ॉर्मैटिंग और HTML एस्केप किए जाते हैं।

डाइस फ़ॉर्मैट ब्राउज़र में `/roll` पर लागू होते हैं। Game Master का `roll_dice` टूल और सर्वर पर होने वाले दूसरे रोल बिल्ट-इन नोटेशन और नियमसेट के डाइस ही इस्तेमाल करते रहते हैं। Engine के पुराने वर्ज़न पर इसे कॉल करने से पहले `typeof marinara.dice?.registerFormat === "function"` जाँचें।

### पुराने और फ़ुल पेज एक्सटेंशन

वेदर कंट्रोलर, प्रॉम्प्ट एडिटर और ऐसे ही दूसरे बड़े वर्कफ़्लो कंट्रिब्यूशन के लिए सही इस्तेमाल हैं। इनके सुरक्षित पोर्ट मेन्यू या टॉप बार वाला लॉन्चर और धीरे-धीरे अपडेट होने वाले पैनल इस्तेमाल कर सकते हैं। जो मौजूदा पैकेज DOM ओवरले डालते हैं, Marinara के CSS सिलेक्टर क्वेरी करते हैं, React के अंदरूनी हिस्सों को खँगालते हैं, या same-origin `/api` रूट कॉल करते हैं, उन्हें बिना बदले सुरक्षित रनटाइम में इंपोर्ट नहीं किया जा सकता।

UI कंट्रिब्यूशन सिर्फ़ इंटरफ़ेस देते हैं, कोई आम अधिकार नहीं। कॉन्टेक्स्ट API हमेशा चालू चैट और कैरेक्टर ID देता है, और इसके अलावा सिर्फ़ ऊपर बताए गए घोषित फ़ील्ड दे सकता है, वह भी चालू रिकॉर्ड के। जिन फ़ीचर को संदेश, प्रीसेट, लोरबुक, बिना घोषित कैरेक्टर या पर्सोना डेटा, या सीन के विज़ुअल इफ़ेक्ट चाहिए, उनके लिए अब भी Marinara की दी हुई एक अलग, बहुत सीमित ब्रोकर क्षमता चाहिए। एक्सटेंशन को होस्ट DOM के एक्सेस या बिना रोक-टोक वाली नेटवर्क रिक्वेस्ट से ऐसी क्षमता की नकल नहीं करनी चाहिए।

अगर कोई External Extension होस्ट DOM के एक्सेस पर निर्भर है, तो वह यह माँग सकता है:

```json
{
  "runtime": "client",
  "capabilities": ["full_page_access"]
}
```

**Full page access सैंडबॉक्स की क्षमता नहीं है।** मंज़ूर किया गया JavaScript और CSS, Marinara के पेज के अंदर चलता है। यह कोड ब्राउज़र के मौजूदा सेशन में दिख रही हर चीज़ पढ़ या बदल सकता है, चैट और कार्ड देख सकता है, ब्राउज़र स्टोरेज इस्तेमाल कर सकता है, नेटवर्क रिक्वेस्ट भेज सकता है और same-origin Marinara API कॉल कर सकता है। व्यवहार में पेज पर इसका अधिकार उतना ही है जितना ब्राउज़र कंसोल में पेस्ट किए गए कोड का। Professor Mari के ड्राफ़्ट इसे नहीं माँग सकते।

फ़ुल पेज एक्सटेंशन को नेटवर्क रिक्वेस्ट के लिए `marinara.fetch(...)` इस्तेमाल करना चाहिए। इसका सिग्नेचर और नतीजा `window.fetch` जैसा ही है, और इससे **Settings → Addons → External Extensions** उस एक्सटेंशन के लिए इस सेशन की रिक्वेस्ट की गिनती, जवाबों में बताए गए ट्रांसफ़र हुए बाइट, हाल की रिक्वेस्ट की दर और लगातार ज़्यादा ट्रैफ़िक की चेतावनी दिखा पाता है। सीधा `window.fetch` भी उपलब्ध रहता है, क्योंकि फ़ुल पेज एक्सेस वाला कोड भरोसेमंद पेज कोड है, लेकिन उन रिक्वेस्ट को एक्सटेंशन के खाते में नहीं जोड़ा जा सकता।

जिस पुराने `kind: "marinara.extension"` v1 एनवेलप में साफ़ तौर पर लिखा `capabilities` फ़ील्ड नहीं होता, उसे Marinara सैंडबॉक्स से पहले का पैकेज मानता है और इंपोर्ट के समय **Full page access** दे देता है। इससे WeatherTweaker जैसे पुराने पैकेज Worker में चुपचाप फ़ेल होने के बजाय जाँच के सही फ़्लो तक पहुँचते हैं। जो नया पैकेज यही एनवेलप इस्तेमाल करता है, लेकिन सुरक्षित रनटाइम चाहता है, उसमें `"capabilities": []` होना ज़रूरी है।

External Extension के दोनों गेट और ठीक उसी हैश की मंज़ूरी फिर भी लागू रहते हैं। कोड, CSS या परमिशन में कोई भी बदलाव एक्सटेंशन को बंद कर देता है और नई मंज़ूरी माँगता है। बंद करने पर Marinara अपने स्क्रिप्ट और स्टाइलशीट नोड हटा देता है, कंपैटिबिलिटी API से बने टाइमर रद्द कर देता है, और `marinara.onCleanup(...)` से रजिस्टर किए गए कॉलबैक चलाता है। पेज कोड बिना रजिस्टर किए लिसनर, टाइमर, ग्लोबल या DOM बदलाव बना सकता है, इसलिए सफ़ाई जितनी हो सके उतनी ही होती है; एक्सटेंशन बंद करने के बाद कुछ बचा रह जाए तो पेज रीलोड करें।

पुराना `marinara.ui.showWindow(...)` API, opaque-origin वाले iframe के अंदर अस्थायी विंडो के लिए अब भी उपलब्ध है। यह वही तय कंट्रोल इस्तेमाल करता है और `update(...)` और `close()` हैंडल लौटाता है। अगर टूल तक Marinara के सामान्य नेविगेशन से पहुँचना हो, तो कंट्रिब्यूशन को प्राथमिकता दें।

## Server Extension के साथ तुरंत शुरुआत

यह फ़ोल्डर बनाएँ:

```text
Server Counter/
  manifest.json
  server-extension.js
```

यह `manifest.json` इस्तेमाल करें:

```json
{
  "kind": "marinara.personal-server-extension",
  "version": 1,
  "config": {
    "name": "Server Counter",
    "version": "1.0.0",
    "description": "A minimal sandboxed Server Extension.",
    "runtime": "server",
    "capabilities": [],
    "serverJsPath": "server-extension.js"
  }
}
```

यह `server-extension.js` इस्तेमाल करें:

```js
const saved = await marinara.storage.get();
const starts = (Number(saved.starts) || 0) + 1;
await marinara.storage.patch({ starts });

marinara.log.info(`Server Counter started ${starts} time${starts === 1 ? "" : "s"}`);

const timer = marinara.setInterval(() => {
  marinara.log.debug("Server Counter heartbeat");
}, 60_000);

marinara.onCleanup(() => marinara.clearInterval(timer));
```

यही चलने वाला पैकेज `docs/examples/personal-extensions/server-minimal/` पर उपलब्ध है।

सर्वर कोड को `marinara.runtime`, `marinara.version`, एक्सटेंशन की पहचान, `log`, `storage`, मैनेज किए गए टाइमर और `onCleanup` मिलते हैं। इसे फ़ाइल सिस्टम, प्रोसेस, नेटवर्क, मॉड्यूल लोड करने या Marinara डेटाबेस का एक्सेस नहीं मिलता।

जब होस्ट Seatbelt या Bubblewrap शुरू नहीं कर पाता, तब Server Extensions बंद रहते हैं। यह प्लैटफ़ॉर्म की पाबंदी है, एक्सटेंशन की एरर नहीं।

## पैकेज और मैनिफ़ेस्ट रेफ़रेंस

| फ़ील्ड | जानकारी |
| --- | --- |
| `kind` | `marinara.personal-extension` या `marinara.personal-server-extension` |
| top-level `version` | पैकेज एनवेलप का वर्ज़न; अभी `1` |
| `config.name` | ज़रूरी डिस्प्ले नाम, 1-200 कैरेक्टर |
| `config.version` | वैकल्पिक एक्सटेंशन वर्ज़न, जैसे `1.2.0`; बिंदुओं वाले अंकीय वर्ज़न से डाउनग्रेड की चेतावनी मिल सकती है |
| `config.description` | वैकल्पिक विवरण, ज़्यादा से ज़्यादा 2,000 कैरेक्टर |
| `config.runtime` | `client` या `server`; डिफ़ॉल्ट `client` |
| `config.capabilities` | माँगी गई Browser क्षमताएँ; Server Extensions को खाली लिस्ट इस्तेमाल करनी होगी |
| `config.jsPath` / `config.serverJsPath` | मैनिफ़ेस्ट के सापेक्ष JavaScript फ़ाइल पाथ, या पाथ की क्रम वाली लिस्ट |
| `config.cssPath` | वैकल्पिक CSS फ़ाइल पाथ या क्रम वाली लिस्ट; सुरक्षित रनटाइम का CSS सैंडबॉक्स्ड iframe में ही रहता है |
| `config.js`, `config.serverJs`, `config.css` | अलग फ़ाइलों की ज़रूरत न हो तो इनलाइन विकल्प |

सादा JavaScript इस्तेमाल करें। Marinara TypeScript को कंपाइल नहीं करता और एक्सटेंशन की डिपेंडेंसी इंस्टॉल नहीं करता। ज़रूरत हो तो इंपोर्ट से पहले डिपेंडेंसी को अपने JavaScript में बंडल करें।

अलग-अलग `.js`, `.mjs`, `.cjs`, `.server.js`, `.server.mjs`, `.server.cjs` और `.css` फ़ाइलें भी सीधे इंपोर्ट की जा सकती हैं। मैनिफ़ेस्ट बेहतर है, क्योंकि वह पहचान, रनटाइम, वर्ज़न, क्षमताएँ और फ़ाइलों का क्रम साफ़ तौर पर दर्ज करता है।

### वैलिडेशन सीमाएँ

| सामग्री | मौजूदा सीमा |
| --- | --- |
| नाम / वर्ज़न / विवरण | 200 कैरेक्टर / 64 कैरेक्टर / 2,000 कैरेक्टर |
| Browser या Server JS | हर फ़ील्ड के सोर्स की अलग सीमा नहीं; उसे रखने वाली फ़ाइल, आर्काइव या रिक्वेस्ट की सीमा फिर भी लागू होती है |
| CSS | 256 KiB |
| इंपोर्ट किया गया ZIP | 32 MiB कंप्रेस्ड, हर टेक्स्ट एंट्री के लिए 2 MiB और कुल निकाले गए टेक्स्ट के लिए 16 MiB |
| निजी स्टोरेज | हर एक्सटेंशन के लिए सीरियलाइज़्ड JSON के 1,000,000 बाइट |

ZIP, रिक्वेस्ट, सैंडबॉक्स मैसेज और स्टोरेज की सीमाएँ अलग-अलग ट्रांसपोर्ट या रनटाइम सीमाओं की रक्षा करती हैं; ये चलने वाले सोर्स कोड की नीति नहीं हैं।

## अपडेट और रिकवरी लाइफ़साइकल

- हर नया इंपोर्ट बंद और बिना मंज़ूरी के शुरू होता है।
- कोड, CSS, रनटाइम या क्षमताएँ बदलने से मंज़ूरी हट जाती है और एक्सटेंशन बंद हो जाता है।
- उसी नाम को दोबारा इंपोर्ट करने पर पुष्टि के बाद मौजूदा रिकॉर्ड अपडेट होता है। हूबहू वैसा ही दोबारा इंपोर्ट अपना मौजूदा हैश और मंज़ूरी बनाए रखता है; चलने वाली सामग्री बदलने पर मंज़ूरी हट जाती है। अंकीय वर्ज़न से डाउनग्रेड का पता चले, तो Marinara चेतावनी देता है।
- **Export** मौजूदा मैनिफ़ेस्ट और सोर्स फ़ाइलों को पोर्टेबल पैकेज में लिखता है। मंज़ूरी कभी एक्सपोर्ट नहीं होती।
- कोई रिविज़न रिस्टोर करने, प्रोफ़ाइल इंपोर्ट करने या बैकअप रिस्टोर करने के बाद एक्सटेंशन तब तक बंद रहता है, जब तक उसकी दोबारा जाँच न हो।
- **Disable** रनटाइम और रजिस्टर किया गया क्लीनअप रोकता है। अगर फ़ुल-पेज कोड ने बिना रजिस्टर किए साइड इफ़ेक्ट बनाए हैं, तो पेज रीलोड करना पड़ सकता है।
- **Delete** इंस्टॉल किया गया रिकॉर्ड हटाता है। अगर बाद में सोर्स की ज़रूरत पड़ सकती है, तो पहले एक्सपोर्ट करें।

## डीबग करना

| लक्षण | जाँच |
| --- | --- |
| बाहरी इंपोर्ट के कंट्रोल नहीं दिखते | ऊपर बताए External Extension के दोनों गेट खोलें |
| मैनेजमेंट कहता है कि localhost या Admin Access चाहिए | `ADMIN_SECRET` सेट करें और उसे **Admin Access** में सेव करें |
| इंपोर्ट को कोई एक्सटेंशन नहीं मिलता | `manifest.json` और उसके सापेक्ष पाथ जाँचें; Server को JS चाहिए, जबकि Browser को CSS या JS चाहिए |
| एडिट के बाद एक्सटेंशन बंद हो जाता है | ऐसा ही होता है: नए हैश की जाँच करके ठीक उसी को मंज़ूरी दें |
| Browser कोड `document`, `window`, `fetch` या लोकल स्टोरेज इस्तेमाल नहीं कर सकता | सुरक्षित सैंडबॉक्स में ऐसा ही होता है; डॉक्यूमेंट में बताए ब्रोकर API इस्तेमाल करें |
| Server Extension उपलब्ध नहीं है | macOS Seatbelt या Bubblewrap वाला Linux इस्तेमाल करें, या Browser Extension पर जाएँ |
| Browser Extension में अपवाद आता है | ब्राउज़र के डेवलपर टूल खोलें; `marinara.log` और स्टार्टअप एरर पर एक्सटेंशन के नाम का टैग होता है |
| Server Extension में अपवाद आता है | **Settings → Addons** में इसका स्टेटस और Marinara सर्वर लॉग देखें |

CSS, निजी स्टोरेज, इंपोर्ट आर्काइव और रनटाइम मैसेज की अपनी अलग सुरक्षा सीमाएँ हैं। Marinara को वह सीमा बतानी चाहिए जिसने पैकेज अस्वीकार किया, उसे चलाने की गड़बड़ी की तरह नहीं दिखाना चाहिए।

## मिलती-जुलती गाइड

- [पर्सनल एक्सटेंशन](personal-extensions.md)
- [सर्वर कॉन्फ़िगरेशन](../CONFIGURATION.md)
- [समस्या-समाधान](../TROUBLESHOOTING.md)
- [पर्सनल एक्सटेंशन का आर्किटेक्चर](../development/personal-extensions.md)
