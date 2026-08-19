# अपनी Personal Extensions लिखना

यह गाइड उन लोगों के लिए है जो Marinara Engine के लिए अपनी एक्सटेंशन लिखते हैं। किसी एक्सटेंशन को इंस्टॉल करने, उसकी जाँच करने और सुरक्षित तरीके से चलाने के लिए पहले [Personal Extensions](personal-extensions.md) पढ़ें।

आपके खुद लिखे और इंपोर्ट किए गए कोड को **External Extension** (बाहरी एक्सटेंशन) माना जाता है। यह शुरू में बंद रहता है और तब तक नहीं चल सकता, जब तक आप इसकी जाँच करके इसके ठीक SHA-256 हैश को मंज़ूरी नहीं देते।

## शुरू करने से पहले

दोनों सुरक्षा गेट खोले जाने तक External Extensions छिपी रहती हैं:

1. Marinara होस्ट की `.env` फ़ाइल में `ENABLE_EXTERNAL_EXTENSIONS=true` सेट करें।
2. **Settings** > **Advanced** > **Danger Zone** खोलें और **Allow third-party extension imports** चालू करें।

एक्सटेंशन इंपोर्ट और मैनेज करने के लिए localhost एक्सेस या सेट किया हुआ **Admin Access** भी चाहिए। अगर आप फ़ोन, LAN पते या रिमोट ब्राउज़र से Marinara इस्तेमाल करते हैं, तो सर्वर पर `ADMIN_SECRET` सेट करें और वही वैल्यू **Settings** > **Advanced** > **Admin Access** में भरें।

काम पूरा कर सकने वाला सबसे कम अधिकारों वाला रनटाइम चुनें:

| रनटाइम | इसका इस्तेमाल करें | महत्वपूर्ण सीमा |
| --- | --- | --- |
| Sandboxed Browser Extension | निजी स्टेट, सक्रिय चैट कॉन्टेक्स्ट, बटन, मेन्यू ऐक्शन और Marinara के रेंडर किए पैनल | Marinara DOM, कुकी, ब्राउज़र स्टोरेज, नेटवर्क या मनचाहे HTML का एक्सेस नहीं |
| Server Extension | बैकग्राउंड लॉजिक, जिसे मैनेज किए गए टाइमर और एक्सटेंशन का निजी स्टोरेज चाहिए | अलग OS सैंडबॉक्स; Marinara की फ़ाइल, सीक्रेट, नेटवर्क, चाइल्ड प्रोसेस या नेटिव मॉड्यूल का एक्सेस नहीं |
| Full-page External Extension | पुराना कोड, जिसे सच में Marinara के पेज या same-origin API की ज़रूरत है | सैंडबॉक्स नहीं; केवल उसी कोड के लिए इस्तेमाल करें जिसकी आपने पूरी जाँच की है और जिस पर पूरा भरोसा है |

Browser Extensions हर समर्थित प्लेटफ़ॉर्म पर चलती हैं। Server Extensions के लिए macOS Seatbelt या Linux Bubblewrap चाहिए। Server Extension चुनने से पहले [प्लेटफ़ॉर्म टेबल](personal-extensions.md#platform-support) देखें।

## Browser Extension क्विकस्टार्ट

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

फिर एक्सटेंशन इंपोर्ट करके चलाएँ:

1. **Settings** > **Addons** > **External Extensions** खोलें।
2. **Import Folder** चुनकर `Hello Panel` चुनें, या फ़ोल्डर की ZIP बनाकर उसे इंपोर्ट करें।
3. बंद ड्राफ़्ट खोलकर उसके मैनिफ़ेस्ट और JavaScript की जाँच करें।
4. **Review and Run** चुनें और दिखाए गए ठीक हैश को मंज़ूरी दें।
5. Extensions मेन्यू खोलकर **Hello Panel** चुनें।

यही चलने वाला उदाहरण रिपॉज़िटरी में `docs/examples/personal-extensions/browser-minimal/` पर है।

## Browser API रेफ़रेंस

सैंडबॉक्स वाली Browser Extensions को `marinara` नाम का एक फ़्रीज़ किया हुआ ग्लोबल मिलता है:

| API | मकसद |
| --- | --- |
| `runtime`, `version` | रनटाइम नाम (`client`) और मौजूदा Browser API वर्ज़न |
| `extensionId`, `extensionName`, `capabilities` | एक्सटेंशन के इसी रिविज़न की पहचान और मंज़ूर की गई क्षमताएँ |
| `log.debug/info/warn/error(...)` | ब्राउज़र कंसोल में टैग की गई एंट्री लिखना |
| `storage.get()` | इस एक्सटेंशन का निजी JSON ऑब्जेक्ट पढ़ना |
| `storage.patch(object)` | निजी स्टोरेज में वैल्यू मिलाकर नया ऑब्जेक्ट लौटाना |
| `storage.delete()` | निजी स्टोरेज साफ़ करना |
| `context.get()` | सक्रिय चैट का मौजूदा स्नैपशॉट पढ़ना |
| `context.subscribe(listener)` | कॉन्टेक्स्ट के बदलाव पाना; अनसब्सक्राइब फ़ंक्शन लौटाता है |
| `ui.registerContribution(options)` | सुरक्षित बटन, Extensions मेन्यू आइटम या Marinara के रेंडर किए पैनल जोड़ना |
| `ui.showWindow(options)` | सीमित iframe विंडो खोलना |
| `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval` | एक्सटेंशन रुकने पर हटने वाले मैनेज किए गए टाइमर |
| `onCleanup(callback)` | अतिरिक्त क्लीनअप लॉजिक रजिस्टर करना |

सामान्य UI के लिए [Marinara के रेंडर किए पैनल](personal-extensions.md#add-a-marinara-rendered-panel) और चैट के हिसाब से काम करने के लिए [सक्रिय चैट कॉन्टेक्स्ट](personal-extensions.md#use-active-chat-context) इस्तेमाल करें। एक्सटेंशन का स्टेट ब्राउज़र स्टोरेज में नहीं, `marinara.storage` में होना चाहिए।

`showWindow({ title, elements, onEvent, onClose })` ऐसा हैंडल लौटाता है जिसमें `update({ title?, elements? })` और `close()` होते हैं। पैकेज का CSS इन सैंडबॉक्स iframe विंडो को स्टाइल देता है; होस्ट के रेंडर किए कॉन्ट्रिब्यूशन हमेशा Marinara की अपनी थीम और कंट्रोल इस्तेमाल करते हैं।

सुरक्षित Browser रनटाइम में DOM या नेटवर्क API नहीं है। इस सीमा को न लाँघें। अगर कोई उपयोगी क्षमता नहीं है, तो डिफ़ॉल्ट रूप से पूरे पेज का एक्सेस लेने के बजाय होस्ट से सीमित क्षमता माँगें।

### कॉन्टेक्स्ट क्षमताएँ

`config.capabilities` में वैकल्पिक रिकॉर्ड एक्सेस घोषित करें:

```json
{
  "capabilities": ["read_active_characters", "read_active_persona"]
}
```

- `read_active_characters` सक्रिय चैट की Character कार्ड के सीमित फ़ील्ड भरता है।
- `read_active_persona` चुनी हुई Persona के सीमित फ़ील्ड भरता है।
- `full_page_access` बिना सैंडबॉक्स वाला अनुकूलता रनटाइम चुनता है और केवल External Extensions के लिए उपलब्ध है।

क्षमताएँ बदलने से चलने वाले कोड का हैश बदलता है, एक्सटेंशन बंद हो जाती है और नई समीक्षा चाहिए।

## Server Extension क्विकस्टार्ट

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

जब होस्ट Seatbelt या Bubblewrap शुरू नहीं कर पाता, तब Server Extensions बंद रहती हैं। यह प्लेटफ़ॉर्म की पाबंदी है, एक्सटेंशन की गड़बड़ी नहीं।

## पैकेज और मैनिफ़ेस्ट रेफ़रेंस

| फ़ील्ड | जानकारी |
| --- | --- |
| `kind` | `marinara.personal-extension` या `marinara.personal-server-extension` |
| top-level `version` | पैकेज एनवेलप वर्ज़न; अभी `1` |
| `config.name` | ज़रूरी डिस्प्ले नाम, 1-200 कैरेक्टर |
| `config.version` | वैकल्पिक एक्सटेंशन वर्ज़न, जैसे `1.2.0`; बिंदुओं वाले अंकीय वर्ज़न डाउनग्रेड चेतावनी दे सकते हैं |
| `config.description` | वैकल्पिक विवरण, अधिकतम 2,000 कैरेक्टर |
| `config.runtime` | `client` या `server`; डिफ़ॉल्ट `client` |
| `config.capabilities` | माँगी गई Browser क्षमताएँ; Server Extensions को खाली लिस्ट इस्तेमाल करनी होगी |
| `config.jsPath` / `config.serverJsPath` | मैनिफ़ेस्ट के सापेक्ष JavaScript फ़ाइल पाथ या क्रम में पाथ की सूची |
| `config.cssPath` | वैकल्पिक CSS फ़ाइल पाथ या क्रम में सूची; सुरक्षित रनटाइम का CSS सैंडबॉक्स iframe में रहता है |
| `config.js`, `config.serverJs`, `config.css` | अलग फ़ाइलें ज़रूरी न हों तो इनलाइन विकल्प |

सादा JavaScript इस्तेमाल करें। Marinara TypeScript को कंपाइल नहीं करता और एक्सटेंशन की डिपेंडेंसी इंस्टॉल नहीं करता। ज़रूरत होने पर इंपोर्ट से पहले डिपेंडेंसी को अपने JavaScript में बंडल करें।

अलग `.js`, `.mjs`, `.cjs`, `.server.js`, `.server.mjs`, `.server.cjs` और `.css` फ़ाइलें भी सीधे इंपोर्ट की जा सकती हैं। मैनिफ़ेस्ट बेहतर है, क्योंकि वह पहचान, रनटाइम, वर्ज़न, क्षमताएँ और फ़ाइलों का क्रम साफ़ तौर पर दर्ज करता है।

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
- कोड, CSS, रनटाइम या क्षमताएँ बदलने से मंज़ूरी हटती है और एक्सटेंशन बंद हो जाती है।
- उसी नाम को दोबारा इंपोर्ट करने पर पुष्टि के बाद मौजूदा रिकॉर्ड अपडेट होता है। हर बाइट में एक जैसा इंपोर्ट मौजूदा हैश और मंज़ूरी रखता है; चलने वाली सामग्री बदलने पर मंज़ूरी हटती है। अंकीय वर्ज़न डाउनग्रेड बताएँ, तो Marinara चेतावनी देता है।
- **Export** मौजूदा मैनिफ़ेस्ट और सोर्स फ़ाइलों को पोर्टेबल पैकेज में लिखता है। मंज़ूरी कभी एक्सपोर्ट नहीं होती।
- किसी रिविज़न, प्रोफ़ाइल या बैकअप को रीस्टोर करने के बाद दोबारा समीक्षा तक एक्सटेंशन बंद रहती है।
- **Disable** रनटाइम और रजिस्टर किया गया क्लीनअप रोकता है। अगर पूरे पेज के कोड ने बिना रजिस्टर किए साइड इफ़ेक्ट बनाए हैं, तो पेज रीलोड करना पड़ सकता है।
- **Delete** इंस्टॉल किया गया रिकॉर्ड हटाता है। सोर्स की बाद में ज़रूरत पड़ सकती हो, तो पहले एक्सपोर्ट करें।

## डीबग करना

| लक्षण | जाँच |
| --- | --- |
| बाहरी इंपोर्ट कंट्रोल नहीं दिखते | ऊपर बताए दोनों External Extension गेट खोलें |
| मैनेजमेंट कहता है कि localhost या Admin Access चाहिए | `ADMIN_SECRET` सेट करके **Admin Access** में सेव करें |
| इंपोर्ट को कोई एक्सटेंशन नहीं मिलती | `manifest.json` और उसके सापेक्ष पाथ जाँचें; Server को JS चाहिए, जबकि Browser को CSS या JS चाहिए |
| एडिट के बाद एक्सटेंशन बंद हो जाती है | यह सामान्य है: नए ठीक हैश की जाँच करके मंज़ूरी दें |
| Browser कोड `document`, `window`, `fetch` या लोकल स्टोरेज इस्तेमाल नहीं कर सकता | सुरक्षित सैंडबॉक्स में यह सामान्य है; दस्तावेज़ में दी गई ब्रोकर API इस्तेमाल करें |
| Server Extension उपलब्ध नहीं है | macOS Seatbelt या Bubblewrap वाला Linux इस्तेमाल करें, या Browser Extension चुनें |
| Browser Extension में अपवाद आता है | ब्राउज़र डेवलपर टूल खोलें; `marinara.log` और स्टार्टअप की गड़बड़ी के साथ एक्सटेंशन का नाम होता है |
| Server Extension में अपवाद आता है | **Settings** > **Addons** में इसका स्टेटस और Marinara सर्वर लॉग देखें |

CSS, निजी स्टोरेज, इंपोर्ट आर्काइव और रनटाइम मैसेज की अपनी अलग सुरक्षा सीमाएँ हैं। Marinara को पैकेज अस्वीकार करने वाली सीमा बतानी चाहिए, उसे चलाने की गड़बड़ी की तरह नहीं दिखाना चाहिए।

## संबंधित गाइड

- [Personal Extensions](personal-extensions.md)
- [सर्वर कॉन्फ़िगरेशन](../CONFIGURATION.md)
- [समस्या निवारण](../TROUBLESHOOTING.md)
- [Personal Extension आर्किटेक्चर](../development/personal-extensions.md)
