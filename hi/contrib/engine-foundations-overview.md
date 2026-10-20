# Engine की बुनियाद: श्रृंखला का अवलोकन

यह पृष्ठ Engine की बुनियाद के योगदान (issue #6624) का परिचय देता है। पहले एक बड़े pull request में खोला गया काम अब A से H तक आठ छोटे PR में बंटा है, ताकि अलग-अलग समीक्षा हो सके। सभी हिस्से Marinara Engine के पहले से सही चल रहे कोड पर आधारित हैं। मौजूदा API के नाम, साझा लॉगर या फ़ाइलों की परंपराएं नहीं बदलतीं। सबके लिए व्यवहार बदलने वाले हिस्से स्पष्ट हैं; बाकी सक्षम करने तक बंद रहते हैं।

<a id="the-pull-requests"></a>

## Pull request

| PR | सामग्री | निर्भरता |
| --- | --- | --- |
| **A** | बुनियाद: अलग regression रन, अनुरोध पहचान और स्टार्टअप समयरेखा, दो वैकल्पिक lorebook सेटिंग, वैकल्पिक मजबूती सेटिंग और रनटाइम निदान, स्टार्टअप inject गेट, सुविधा स्विच, best-effort हेल्पर | कोई नहीं (यह PR) |
| **B** | कोडिंग सहायकों के लिए Dev MCP (`tools/dev-mcp/`) | कोई नहीं |
| **C** | Ctrl+K कमांड पैलेट और "?" शॉर्टकट पैनल (केवल क्लाइंट, स्विच नहीं) | कोई नहीं |
| **D** | समीक्षा किए सर्वर सुधार, भाग 1: रूट और middleware; स्टोरेज रिकवरी, चैट और जनरेशन, इंपोर्टर, sidecar और SSRF | A |
| **E** | समीक्षा किए सर्वर सुधार, भाग 2: सेवाएं और स्टोरेज | A |
| **F** | प्रॉम्प्ट कैश: Claude सदस्यता कैश मार्कर सुधार, Agent SDK अपडेट, कैश-अनुकूल संरचना, कम कैश वाले भेजने से पहले चेतावनी, निदान | A |
| **G** | टैब बंद होने पर जारी जनरेशन कार्य, कार्य दर्शक, Windows कंसोल ट्रे | A (पैलेट कार्रवाई के लिए C भी) |
| **H** | Engine निदान और लॉन्चर: बिल्ड अखंडता, मेमोरी टेलीमेट्री, प्रॉम्प्ट डीबग फ़ाइलें, पृष्ठभूमि कॉल सीमा, बैकअप और तैयार होने पर खोलना, reasoning बंद करने से जुड़ा पुनः प्रयास | A |

A, B और C स्वतंत्र हैं और किसी भी क्रम में समीक्षा योग्य हैं। D से H, A के बाद आते हैं: सुविधा रजिस्ट्री (`isFeatureEnabled`, Settings > Advanced > Features), लॉग ट्रैकिंग और best-effort हेल्पर का उपयोग करते हैं या स्टार्टअप समयरेखा और निदान रूट बढ़ाते हैं। हर PR अपने स्विच, CHANGELOG प्रविष्टियां और इस पृष्ठ का भाग जोड़ता है।

A का प्रत्येक हिस्सा मौजूदा व्यवस्था, नई चीज़ें, अपरिवर्तित व्यवहार, जांच और बंद या वापस करने का तरीका बताता है।

डिफ़ॉल्ट: संग्रहीत डेटा, प्रॉम्प्ट, पुनः प्रयास या सर्वर द्वारा शुरू किए घटक बदलने वाली सुविधाएं बंद हैं। इन्हें पर्यावरण चर या **Settings > Advanced > Features** (सेटिंग > उन्नत > सुविधाएं, A6) से सक्षम करें। कुछ न खोलने पर पुराना व्यवहार रहता है। सुधार, टेस्ट रनर और अतिरिक्त हेल्पर बिना स्विच हैं; हर भाग यह बताता है।

वापसी: A के कमिट क्रमबद्ध हैं और कुछ फ़ाइलें साझा हैं (`app.ts`, `index.ts`, `runtime-config.ts`, `capability-module-runtime.service.ts`, `CHANGELOG.md`)। नए से पुराने क्रम में वापस करने से टकराव बचते हैं।

अधिकांश जांच मौजूदा regression रनर से हैं। पहले साझा पैकेज एक बार बिल्ड करें (`pnpm build:shared`), फिर रिपॉज़िटरी रूट से कमांड चलाएं।

---

<a id="pr-a-foundations"></a>

# PR A: बुनियाद

> **Decision मॉडल अपडेट पर रीबेस किया गया।** Decision कॉल पहले से उस अनुरोध में चलती हैं जिसे उनकी ज़रूरत है और उसका `requestId` रखती हैं। निर्णय और utility sidecar मूल लॉग संदर्भ में शुरू होते हैं; आगे की पंक्तियों में पहले अनुरोधकर्ता का ID नहीं रहता। विफल Decision स्लॉट हर टर्न कई चेतावनियों के बजाय आवृत्ति-सीमित एक चेतावनी देता है। उपयोगकर्ता रद्द करना info, हटाए गए Decision कथनों की गिनती warn और उनका पाठ केवल debug में है। बंद करते समय दोनों sidecar नाम वाले चरणों में रुकते हैं। Decision कॉल प्रदाता retry wrapper से नहीं गुजरतीं, इसलिए दोहरा पुनः प्रयास नहीं होता।

<a id="a1-test-harness-each-regression-file-runs-in-its-own-data-folder"></a>

## A1. टेस्ट व्यवस्था: हर regression फ़ाइल के लिए अलग डेटा फ़ोल्डर

**मौजूदा व्यवस्था।** `scripts/run-regressions.mjs` सभी regression खोजकर `runRegression()` से एक-एक चलाता है और समय सीमा व संकेत संभालता है (`terminateActiveChild`, `releaseActiveChild`, `FILE_TIMEOUT_MS`)। हर child process को डेवलपर का पूरा `process.env` मिलता है। सर्वर पहले से `MARINARA_ENV_FILE` द्वारा `.env` का स्थान बदल सकता है (`packages/server/src/config/runtime-config.ts` में `getEnvFilePath()`); `e2e/start-servers.mjs` भी इसी तरह अलग करता है।

**नई चीज़ें।** छोटा हेल्पर `regressionEnvironment(scratchDir)`। `runRegression()` हर फ़ाइल के लिए OS के अस्थायी स्थान में `marinara-regression-*` बनाकर child के `DATA_DIR`, `FILE_STORAGE_DIR`, `MARINARA_ENV_FILE` वहीं रखता है। सफलता, विफलता, समय सीमा या शुरू न हो पाने पर भी फ़ोल्डर हटता है। अपना अलगाव भूलने वाला टेस्ट अब डेवलपर का `.env` नहीं पढ़ता और वास्तविक डेटा के write lease से नहीं टकराता।

**अपरिवर्तित।** फ़ंक्शन, `--filter`/`--list`, समय सीमाएं, सारांश, `package.json` स्क्रिप्ट और CI समान हैं। अपने चर तय करने वाले टेस्ट उन्हीं मानों को रखते हैं। शेल में export किए `DATA_DIR`, `FILE_STORAGE_DIR`, `MARINARA_ENV_FILE` हर फ़ाइल के लिए बदले जाते हैं; यह जानबूझकर और केवल टेस्ट के लिए है।

**जांच का तरीका।**

```sh
node scripts/run-regressions.mjs --filter env-watcher
```

बाद में अस्थायी फ़ोल्डर में कोई `marinara-regression-*` नहीं बचना चाहिए।

**बंद करना / वापस करना।** स्विच नहीं; अलगाव डिफ़ॉल्ट है। रनर कमिट वापस करने से पुराना रनर आता है। पहले नए कमिट वापस करें; साझा फ़ाइलें केवल `CHANGELOG.md` और `CONTRIBUTING.md` हैं। `MARINARA_REGRESSION_INHERIT_STORAGE=1` जैसा विकल्प कुछ पंक्तियों में बन सकता है, लेकिन बिना मांग की सेटिंग नहीं जोड़ी गई।

---

<a id="a2-logging-follow-one-request-one-boot-and-one-failure"></a>

## A2. लॉगिंग: एक अनुरोध, एक शुरुआत और एक विफलता ट्रैक करें

**मौजूदा व्यवस्था।** `packages/server/src/lib/logger.ts` साझा Pino `logger` देता है। `protectTerminalLogger` बंद टर्मिनल से सर्वर क्रैश बचाता है और `logDebugOverride` UI डीबग स्विच संभालता है। `CONTRIBUTING.md` के Logging नियम (साझा लॉगर, त्रुटि ऑब्जेक्ट पहले, फ़ॉर्मैट संकेतक, चार स्तर) बने रहते हैं। `app.ts` का `buildApp()` Fastify को अलग विकल्प देता था, जिससे समान स्तर वाला दूसरा Pino बनता था। `req-1`/`req-2` ID गिनती हर शुरुआत पर रीसेट होती थी।

**नई चीज़ें।** विवरण `docs/development/logging.md` में है, जिसका लिंक अब `CONTRIBUTING.md` के Logging भाग में है।

- Fastify साझा लॉगर (`loggerInstance: logger`) इस्तेमाल करता है। `req.log` समान serializers और `followLogLevel` से `LOG_LEVEL` hot reload का पालन करता है; बंद होने पर सदस्यता हटती है। यह `CONTRIBUTING.md` का पहले से वर्णित व्यवहार है।
- अनुरोध से बनी हर पंक्ति में `requestId` है, आंतरिक सेवाओं में भी (`lib/log-context.ts`, `AsyncLocalStorage` संदर्भ और Pino mixin)। ID UUID या वैध client `x-request-id` है और रिपोर्ट के लिए `x-request-id` हेडर में लौटता है।
- हर पंक्ति में `bootId` है, जिससे एक फ़ाइल के अलग रन पहचाने जाते हैं।
- स्टार्टअप समयरेखा `lib/startup-timeline.ts`: `app.ts`/`index.ts` के चरण `startup.phase("name", fn)` में हैं। info पंक्ति `[startup] Ready in N ms` धीमे चरण बताती है; विफल स्टार्टअप चरण का नाम देता है।
- प्रति विफलता एक पंक्ति: प्रदाता और टूल पहले लॉग किए बिना त्रुटि फिर फेंकते हैं। जनरेशन विफलता एक error देती है। उपयोगकर्ता रोकना `failureLevel(err)` से info में है; `cause` श्रृंखला बचती है।
- स्वास्थ्य जांच, scheduler polling और प्रॉम्प्ट संदर्भ योगदानकर्ताओं की दोहराई विफलताएं `logRateLimited` और `suppressedRepeats` गिनती इस्तेमाल करती हैं।
- मॉडल आउटपुट, डाइस अनुरोध, Spotify टोकन बॉडी और वीडियो polling बॉडी debug में जाती हैं; warn केवल लंबाई बताता है।
- तीन regression: `logging-request-trail`, `logging-failure-lines`, `logging-startup-timeline`।

**अपरिवर्तित।** `logger` का export और फ़ाइल, `protectTerminalLogger`, `logDebugOverride`, `pid`/`hostname`, मौजूदा `logger.*`/`req.log` कॉल समान हैं। Fastify `LogController` को subclass से बढ़ाते हैं, बदलते नहीं। `LOG_LEVEL` (डिफ़ॉल्ट `warn`), `LOG_DISABLE_REQUEST_LOGGING` समान हैं। `pnpm dev` में pino-pretty `bootId` और `hostname` छिपाता है, इसलिए नए फ़ील्ड नहीं दिखते। `CONTRIBUTING.md` में केवल जोड़ हैं।

`logging.md` में बताए व्यवहार बदलाव:

- `reqId` की जगह `requestId` है; सहेजे `reqId` फ़िल्टर का नाम बदलें।
- आने वाले अनुरोध और न मिले रूट की पंक्तियों से query string हटती है, क्योंकि उसमें टोकन हो सकता है। अन्य `req` फ़ील्ड रहते हैं, `route` जुड़ता है।
- नई info पंक्ति `Client aborted request`, जिसे `LOG_DISABLE_REQUEST_LOGGING` भी बंद करता है।
- उपचरणों के बिना अपना समय `selfMs` 15 सेकंड से अधिक होने पर स्टार्टअप चरण warn है, जो डिफ़ॉल्ट में दिखता है। चरण nested हैं (`app.build` में `buildApp`), लेकिन स्तर अपने समय पर निर्भर है: एक धीमा चरण, एक पंक्ति।

**जांच का तरीका।**

```sh
node scripts/run-regressions.mjs --filter logging-
```

या सर्वर पर अनुरोध भेजकर लौटे `x-request-id` को `grep` से खोजें।

**बंद करना / वापस करना।** `LOG_DISABLE_REQUEST_LOGGING=true` पहले की तरह अनुरोध लॉग बंद करता है; `LOG_LEVEL=warn` नए info छिपाता है। पूरा हटाने के लिए बाद के कोड कमिट पहले वापस करें, फिर लॉगिंग कमिट।

---

<a id="a3-performance"></a>

## A3. प्रदर्शन

दोनों विकल्प डिफ़ॉल्ट में बंद हैं; तब प्रॉम्प्ट और डेटा बाइट-दर-बाइट समान हैं। विवरण `.env.example` और `docs/CONFIGURATION.md` की Lorebooks तालिका में है।

<a id="a3a-stable-lorebook-group-winners-lorebook_stable_group_winners-switch-stablelorebookgrouppicks"></a>

### A3a. स्थिर lorebook समूह चयन (`LOREBOOK_STABLE_GROUP_WINNERS`, स्विच `stableLorebookGroupPicks`)

**मौजूदा व्यवस्था।** `packages/server/src/services/lorebook/keyword-scanner.ts` का `applyGroupSelection()` हर inclusion group में weighted चयन (`pickWeightedGroupEntry`) करता है, स्थायी सक्रिय प्रविष्टियों को प्राथमिकता देता है। random स्रोत inject किया जा सकता है (`random`, डिफ़ॉल्ट `Math.random`), जिससे बदलाव आसान हुआ। हर जनरेशन में नया चयन अन्य बदलाव के बिना परिणाम बदल सकता है, जिससे प्रॉम्प्ट prefix और प्रदाता cache बदलता है।

**नई चीज़ें।** `applyGroupSelection`/`ScanOptions` में वैकल्पिक `groupSeed`। सक्षम होने पर `processLorebooks` चैट ID देता है: उसी चैट के समान सक्रिय उम्मीदवार हर टर्न समान विजेता देते हैं। अलग चैट और समूह अलग रह सकते हैं। Active Context (सक्रिय संदर्भ) की मौजूदा `stableHash` + `createSeededRandom` जोड़ी को `lorebooks.routes.ts` से साझा `lorebook/seeded-random.ts` में बिना बदलाव ले जाते हैं। A6 से **Stable lorebook picks** (स्थिर lorebook चयन) भी है; पर्यावरण चर प्राथमिक है।

**अपरिवर्तित।** नाम और signature (नया पैरामीटर वैकल्पिक), स्थायित्व और weights समान हैं। injected random अभी भी probability gates चलाता है; सक्षम seed फिर भी समूह विजेता तय करता है, इसलिए Active Context और जनरेशन मेल खाते हैं। बंद होने पर seed नहीं दिया जाता और पुराना मार्ग है।

**जांच का तरीका।** `node scripts/run-regressions.mjs --filter lorebook-group-seed` चर और स्विच जांचता है।

**बंद करना / वापस करना।** `LOREBOOK_STABLE_GROUP_WINNERS` न सेट करें और स्विच बंद रखें।

<a id="a3b-compact-stored-lorebook-scans-lorebook_compact_stored_scans"></a>

### A3b. सहेजे lorebook स्कैन संकुचित करना (`LOREBOOK_COMPACT_STORED_SCANS`)

**मौजूदा व्यवस्था।** हर जनरेटेड संदेश सक्रिय प्रविष्टियों का पूरा पाठ `extra.lorebookScan` में, संदेश पंक्ति और हर swipe में रखता है। Active Context सटीक जनरेशन सामग्री दिखाता है, लेकिन बड़े lorebook वाली लंबी चैट में तालिकाएं बहुत बड़ी होती हैं।

**नई चीज़ें।** सक्षम होने पर नवीनतम assistant या narrator संदेश, जिसे Active Context और agent retry पढ़ते हैं, पंक्ति और सभी swipe में पूरा पाठ रखता है। पुराने swipe पर लौटने से वही पाठ दिखता है। नकली उपयोगकर्ता टर्न का स्कैन संकुचित होता है और यह स्थान कभी नहीं लेता। पुराने संदेश केवल ID, नाम, keys और scores रखते हैं। संकुचन जनरेशन सेव मार्ग में नहीं होता: पृष्ठभूमि कार्य पिछले संदेश को एक समय में एक message queue से संसाधित करता है। विफलता `logRateLimited` में दर्ज होती है और अगली सेव पर फिर प्रयास होता है। नए संदेश हटाने पर Active Context (`lorebooks.routes.ts`) और retry (`retry-agents-route.ts` में `storedContentForTextlessScanEntries`) प्रविष्टि का वर्तमान संग्रहीत पाठ लेते हैं। `scripts/compact-lorebook-scans.mjs` पुराने चैट पर यही नियम लगाता है: डिफ़ॉल्ट dry run, सर्वर write lease होने पर इनकार और `--apply` से पहले दोनों तालिकाओं का बैकअप।

**अपरिवर्तित।** बंद होने पर नया लेखन नहीं और संरचना समान है। स्कैन फ़ॉर्मैट तथा Active Context/retry उत्तर समान रहते हैं; पाठ न होने पर ही fallback है। दो छोटे डिफ़ॉल्ट सुधार केवल पुराने बिना-पाठ स्कैन पर हैं: Active Context खाली string के बजाय संग्रहित पाठ दिखाता है, और retry प्रविष्टियां हटाने के बजाय शामिल करता है।

**जांच का तरीका।** `node scripts/run-regressions.mjs --filter lorebook-scan-compaction` डिफ़ॉल्ट संरचना, swipe वापसी, नकली टर्न, पहली सेव पर पुराने संदेशों की सफाई, असली Active Context रूट का fallback और रखरखाव स्क्रिप्ट जांचता है।

**बंद करना / वापस करना।** `LOREBOOK_COMPACT_STORED_SCANS` अनसेट या `false` रखें। संकुचित संदेश वैसे ही रहते हैं; नवीनतम पाठ रखता है। `--apply` के बैकअप पुरानी संरचना बहाल कर सकते हैं।

---

<a id="a4-robustness"></a>

## A4. मजबूती

सभी बदलाव डिफ़ॉल्ट बंद पर्यावरण सेटिंग हैं, `docs/CONFIGURATION.md` की मजबूती तालिका और `.env.example` में दर्ज हैं। अलग फ़ाइलों के कारण स्वतंत्र समीक्षा, विभाजन और वापसी संभव है। नए पैरामीटर/फ़ील्ड वैकल्पिक हैं; यह कमिट `isRateLimitError`/`base-provider.ts` नहीं बदलता।

<a id="a4a-storage-writes"></a>

### A4a. स्टोरेज लेखन

**मौजूदा व्यवस्था।** `packages/server/src/db/file-backed-store.ts` बदले shards और `manifest.json` को `serializeTableRows()`/`atomicWriteFile()` से लिखता है, रिकवरी के लिए `.bak` रखता है। atomic write और बैकअप व्यवस्था बनी रहती है।

**नई चीज़ें।**

- `STORAGE_SKIP_UNCHANGED_WRITES` लेखन छोड़ता है यदि सामग्री प्रक्रिया के पिछले टिकाऊ लेखन जैसी हो और डिस्क size/mtime भी वही हों। `.bak` से बहाल फ़ाइल हमेशा दोबारा लिखी जाती है।
- `STORAGE_YIELDING_SERIALIZE` बड़े shards को 12 ms हिस्सों में serialize करके event loop को मौका देता है। लंबी चैट सेव अन्य अनुरोध नहीं रोकती; आउटपुट `serializeTableRows` से बाइट-दर-बाइट समान है।

**अपरिवर्तित।** दोनों बंद: `serializeTableRows`, `beforeTableWrite`, `atomicWriteFile` पहले जैसे। वास्तविक लेखन हमेशा `atomicWriteFile` से है।

**जांच का तरीका।** `node scripts/run-regressions.mjs --filter robustness-storage-write`

**बंद करना / वापस करना।** दोनों सेटिंग न तय करें।

<a id="a4b-windows-boot"></a>

### A4b. Windows शुरुआत

**मौजूदा व्यवस्था।** write lease `file-backed-store.ts` के `readBootId()` से OS boot पहचानता है, हर बार PowerShell (Windows पर लगभग 1.5 से 2 सेकंड) और `reg.exe` पहचान जांच चलाता है।

**नई चीज़ें।**

- `STORAGE_CACHE_WINDOWS_BOOT_ID` हर OS boot का सटीक परिणाम `DATA_DIR/.writer-boot-id.json` में cache करता है (`db/writer-boot-id-cache.ts`)। `LOCALAPPDATA` में कुछ नहीं लिखता।
- हमेशा सक्रिय: `reg.exe`/PowerShell को `windowsHide` देते हैं, इसलिए बिना कंसोल शुरू होने पर विंडो नहीं चमकती। कोई अन्य प्रभाव नहीं।

**अपरिवर्तित।** lease logic और जांच समान; बंद होने पर हर शुरुआत में जांच।

**जांच का तरीका।** `node scripts/run-regressions.mjs --filter robustness-boot-performance`

**बंद करना / वापस करना।** सेटिंग अनसेट रखें या `.writer-boot-id.json` हटाएं।

<a id="a4c-shutdown"></a>

### A4c. बंद करना

**मौजूदा व्यवस्था।** `packages/server/src/index.ts`, `shutdown(signal)` से SIGINT/SIGTERM और Windows के बाहर SIGHUP संभालता है। दोहराव warn देकर अनदेखा करता है, 8 सेकंड `armShutdownDeadline` तय करता है और सभी runtime रुकने के बाद `closeDB()` करता है। क्रम बना रहता है।

**नई चीज़ें।** `index.ts`/`app.ts` में उपयोग होने वाले `lib/shutdown-signals.ts`/`lib/shutdown-steps.ts`:

- `SHUTDOWN_WINDOWS_CONSOLE_SIGNALS`: Ctrl+Break और कंसोल बंद करने पर वही साफ़ shutdown, Windows के लगभग 5 सेकंड में।
- `SHUTDOWN_FORCE_EXIT_ON_REPEAT`: पहले Ctrl+C के 1.5 सेकंड से अधिक बाद दूसरा आने पर मजबूर exit।
- `SHUTDOWN_EARLY_FLUSH`: stop signal मिलते ही लंबित सेव लिखना शुरू। विफलता यहां दोबारा लॉग नहीं होती; store पहले दर्ज कर चुका है और बंद होते समय फिर कोशिश करता है।
- `SHUTDOWN_RUNTIME_STOP_BUDGET_MS` (अधिकतम 2500, डिफ़ॉल्ट 0 = सभी की प्रतीक्षा): signal shutdown में runtime अटकने पर भी समय बजट के बाद `closeDB()` चलता है। अंतिम दो सेटिंग केवल signals पर हैं; `admin.routes.ts` का Advanced Settings restart समान है।
- हमेशा सक्रिय: तीन runtime stop के नाम हैं; विफलता या 1 सेकंड से अधिक समय चरण सहित लॉग होता है।

**अपरिवर्तित।** सब बंद: वही signals, दोहराव अनदेखा, `closeDB()` से पहले सभी stop की प्रतीक्षा, वही 8 सेकंड सीमा।

**जांच का तरीका।** `node scripts/run-regressions.mjs --filter robustness-shutdown-safety`

**बंद करना / वापस करना।** सेटिंग अनसेट रखें। पहली दो को restart चाहिए और environment watcher बताता है।

<a id="a4d-provider-retry-on-transient-network-errors-provider_retry_transient_errors-switch-providerretry"></a>

### A4d. अस्थायी नेटवर्क त्रुटियों पर प्रदाता पुनः प्रयास (`PROVIDER_RETRY_TRANSIENT_ERRORS`, स्विच `providerRetry`)

**मौजूदा व्यवस्था।** `packages/server/src/services/llm/rate-limit-aware-provider.ts` का `RateLimitAwareProvider` rate limit पर `MAX_RATE_LIMIT_RETRIES` तक बढ़ती प्रतीक्षा से प्रयास करता है और `Retry-After` मानता है। `connection-fallback-provider.ts` वैकल्पिक कनेक्शन चुनता है। दोनों सही हैं; connection refusal या 502 जनरेशन विफल कर देता था।

**नई चीज़ें।** refused/unreachable connection और 502/503 पर अधिकतम दो प्रयास, 0.5 से 2 सेकंड random प्रतीक्षा (`Retry-After` अधिकतम 5 सेकंड), केवल जब पाठ या reasoning उपयोगकर्ता तक न पहुंची हो। 504 या socket reset पर कभी नहीं। उपयोगी fallback वाले primary (`transientRetry: false`) पर नहीं, ताकि बदलाव तेज़ रहे। अपना retry wrapper रखने वाला primary, जैसे capability package द्वारा `llm.withFallback` को दिया गया, भी बाहर है। A6 से **Retry failed provider calls** (विफल प्रदाता कॉल फिर चलाएं) है; पर्यावरण चर प्राथमिक है।

**अपरिवर्तित।** rate limit समय-सारणी, बिना jitter, वही callbacks। `isRateLimitError`/`base-provider.ts` अपरिवर्तित।

**जांच का तरीका।** `node scripts/run-regressions.mjs --filter robustness-provider-resilience`

**बंद करना / वापस करना।** चर अनसेट और स्विच बंद रखें।

<a id="a4e-runtime-diagnostics"></a>

### A4e. रनटाइम निदान

**मौजूदा व्यवस्था।** `packages/server/src/routes/admin.routes.ts` में `/request-timeouts` जैसे विशेषाधिकार वाले admin रूट हैं, लेकिन store और capability runtime का एक साझा read-only दृश्य नहीं है।

**नई चीज़ें।** `GET /api/admin/runtime-diagnostics` (`lib/runtime-diagnostics.ts`), `requirePrivilegedAccess`, `no-store` और प्रति मिनट 30 अनुरोध की अपनी सीमा से सुरक्षित। निवासी डेटा गिनती, बदली तालिकाएं, अंतिम flush त्रुटि, runtime सक्रियता और अंतिम activation failure दिखाता है। वैकल्पिक hooks: controller का `getStorageStats()`, `db/connection.ts` का `getFileStoreStats()`, `CapabilityModuleRuntime` का `runtimeState()`।

**अपरिवर्तित।** केवल पढ़ना; मौजूदा रूट, उत्तर और पहुंच नियम नहीं बदलते।

**जांच का तरीका।** `node scripts/run-regressions.mjs --filter robustness-runtime-diagnostics`, या विशेषाधिकार वाले स्थानीय सर्वर पर `/api/admin/runtime-diagnostics` खोलें।

**बंद करना / वापस करना।** कॉल न होने पर निष्क्रिय। हटाने के लिए `admin.routes.ts` का रूट और `lib/runtime-diagnostics.ts` हटाएं।

<a id="two-catches-that-used-to-be-silent"></a>

### पहले चुप रहने वाले दो catch

CONTRIBUTING के अनुसार `import.routes.ts` का SillyTavern चैट header parsing (केवल error type, क्योंकि JSON संदेश चैट पाठ दिखा सकता है) और agent activation प्रश्नों का transport (आवृत्ति-सीमित) अब warn देते हैं।

---

<a id="a5-startup-internal-requests-wait-until-route-registration-has-ended"></a>

## A5. स्टार्टअप: आंतरिक अनुरोध रूट पंजीकरण पूरा होने तक रुकते हैं

यह हमेशा सक्रिय सुधार है, सेटिंग नहीं।

**मौजूदा व्यवस्था।** `packages/server/src/app.ts` का `buildApp()` मुख्य रूट दर्ज करता है, `capabilityModuleRuntime.start(app)` की प्रतीक्षा करता है जो `services/capability-packages/capability-module-runtime.service.ts` के `activateOne()` से हर पैकेज सक्रिय करता है, फिर `startServerAutonomousScheduler(app)` शुरू करता है। आंतरिक `app.inject()` कॉल पैकेजों के `capability-route-registration.service.ts` में `runCapabilityInternalRoute()`, `server-autonomous-scheduler.service.ts` के स्वायत्त scheduler और `routes/generate/prompt-preview.ts` से आती हैं। पहला `inject()` पूरा Fastify शुरू करता है; बाद में रूट, hook या plugin नहीं जुड़ते। `buildApp()` के दौरान जल्दी timer/worker कॉल से बाद के पैकेज "Root plugin has already booted" देते थे और अगला `addHook` सर्वर रोकता था। `activateOne()` का `catch` लॉग करके `capabilityPackageManager.rollbackRuntime()` करता या status/readiness `"error"` सहेजता है। स्वस्थ पैकेज भी अगले start पर rollback या `"error"` में रह सकता था।

**नई चीज़ें।**

- `lib/fastify-inject-gate.ts`: `buildApp()` instance बनते ही `holdInjectUntilRegistered(app)` और `return app` के ठीक पहले release करता है। पुराने promise/callback `app.inject()` रुकते हैं और बाद में जुड़े रूट तक पहुंचते हैं। रुका `inject()` त्रुटि फेंके तो callback को मिलती है।
- `activate()`/`selfCheck()` registration का हिस्सा हैं; अपने internal route की प्रतीक्षा हमेशा अटकती। `activateOne()` दोनों को `failInjectFastDuring()` में चलाता है: सीधा `inject()` तुरंत `InjectDuringRegistrationError` से विफल (`code` = `MARINARA_INJECT_DURING_REGISTRATION`)। केवल वह पैकेज विफल, start जारी। `activate()` लौटने के बाद चलने वाले timer अन्य background कॉल जैसे रुकते हैं।
- अन्य रुकी कॉल 60 सेकंड बाद caller stack सहित चेतावनी देती हैं और 10 मिनट बाद उसी त्रुटि से अस्वीकार होती हैं। अटका start स्पष्ट विफल होता है। unref किए timer प्रक्रिया को जीवित नहीं रखते।
- `capability-module-runtime.service.ts` का `isHostLifecycleActivationError()`, `AVV_ERR_ROOT_PLG_BOOTED` ("Root plugin has already booted") और `FST_ERR_INSTANCE_ALREADY_LISTENING` ("Fastify instance is already listening") पहचानता है। इन पर rollback या स्थायी status/readiness `"error"` नहीं; version/status बने रहते हैं और अगला start सामान्य activation करता है। एक warn और निदान रिकॉर्ड रहता है। अन्य failures में error, rollback, `"error"` पहले जैसे।
- regression: `startup-inject-gate`।

**अपरिवर्तित।** `buildApp()` के बाद `app.inject()` बिना wrapper का असली Fastify कॉल है। बिना argument chained रूप कभी नहीं रुकता। क्रम, रूट, `runCapabilityInternalRoute()`, scheduler और start के बाद activation/update समान हैं। चल रहे सर्वर का एक मामला: UI से सक्रिय पैकेज नया रूट जोड़े तो `FST_ERR_INSTANCE_ALREADY_LISTENING` मिलता है, लेकिन नया version rollback के बजाय अगली शुरुआत के लिए installed रहता है। caller को त्रुटि अब भी मिलती है।

**जांच का तरीका।**

```sh
node scripts/run-regressions.mjs --filter startup-inject-gate
```

release के बाद चलना, बाद में जोड़ा रूट, callback, `activate()` में तुरंत failure, `activate()` का timer, छोटी test अवधि से 10 मिनट सीमा, `buildApp()` में gate लगना/छूटना, और host lifecycle error पर rollback से पहले लौटना व एक चेतावनी जांचता है।

**बंद करना / वापस करना।** स्विच नहीं। `MARINARA_INJECT_DURING_REGISTRATION`, `InjectDuringRegistrationError` का error code है, सेटिंग नहीं। startup inject gate कमिट वापस करें।

---

<a id="a6-feature-switches-settings--advanced--features"></a>

## A6. सुविधा स्विच: Settings > Advanced > Features

**मौजूदा व्यवस्था।** वैकल्पिक server व्यवहार पर्यावरण चर (A3/A4) हैं, साझा UI नहीं; हर नया विकल्प अपना setting, route और UI मांगता।

**नई चीज़ें।** एक registry और settings भाग, जिसमें बाद के F/G/H जोड़ते हैं। विवरण `docs/configuration/features.md` में है।

- `packages/shared/src/schemas/feature-settings.schema.ts` नाम और defaults तय करता है; `features` के एक JSON में केवल default से अलग मान सहेजते हैं।
- दो स्विच: **Stable lorebook picks** (`stableLorebookGroupPicks`, A3a), **Retry failed provider calls** (`providerRetry`, A4d)।
- `services/features/feature-settings.ts` का `isFeatureEnabled()` memory copy पढ़ता है ताकि व्यस्त मार्गों पर अतिरिक्त लागत न हो। settings रूट registration पर load, row write/delete पर refresh, संबंधित Professor Mari DB कमांड और `.env` reload के बाद अपडेट। `GET` और `PUT /api/app-settings/features`; `PUT` सख्त validation करता है।
- तय environment variables चालू और बंद दोनों में प्राथमिक। `LOREBOOK_STABLE_GROUP_WINNERS`/`PROVIDER_RETRY_TRANSIENT_ERRORS` अब अलग पढ़ने के बजाय स्विच स्थिर करते हैं।
- client Settings > Advanced > Features में सब दिखाता है; pinned स्विच variable name सहित locked हैं। अन्य component `useFeatureEnabled()` इस्तेमाल करते हैं।

**अपरिवर्तित।** सभी default बंद; भाग न खोलने पर पहले जैसा व्यवहार। पुराने environment variables का प्रभाव समान।

**जांच का तरीका।** `node scripts/run-regressions.mjs --filter feature-settings` registry, defaults, normalization, environment priority, routes, storage, Mari जैसी invalidation और listeners जांचता है। ऐप में Settings > Advanced > Features या `features` खोजें।

**बंद करना / वापस करना।** दोनों बंद रखें या variables हटाएं। कमिट वापस करने से तंत्र हटता है; दोनों variables पहले की तरह स्वतंत्र चलते हैं।

---

<a id="a7-logged-best-effort-helpers"></a>

## A7. लॉग वाले best-effort हेल्पर

अतिरिक्त हेल्पर, बिना स्विच और अपने आप व्यवहार बदलने के बिना।

**मौजूदा व्यवस्था।** सफाई, cursor advance, cache write जैसी विफलताएं खाली `catch` से जानबूझकर अनदेखी होती हैं। व्यवहार सही है, लेकिन लॉग नहीं बचता।

**नई चीज़ें।** `packages/server/src/lib/best-effort.ts` में `logSuppressed`, `orFallback`, `bestEffort`। अनदेखी विफलताएं `logRateLimited` (A2) से, हर event/chat/stage पर प्रति मिनट अधिकतम एक पंक्ति। D/E के सुधार खाली catch बदलते समय इस्तेमाल करते हैं।

**अपरिवर्तित।** इस PR में कोई कॉल नहीं, इसलिए मौजूदा मार्ग नहीं बदलते।

**जांच का तरीका।** `node scripts/run-regressions.mjs --filter best-effort`।

**बंद करना / वापस करना।** स्विच नहीं; हेल्पर कमिट वापस करने से फ़ाइल हटती है।

---

<a id="coming-in-later-pull-requests"></a>

# आगे के pull request

ये भाग जानबूझकर छोटे हैं। हर PR खुलते समय वही पांच हिस्से भरता है।

स्थिति: PR A #6647 के रूप में और PR B #6648 के रूप में मर्ज हुआ। PR C (#6649) बिना मर्ज हुए बंद कर दिया गया, और PR D से H तक अलग pull request के रूप में खोले ही नहीं गए। नीचे C से H तक के सेक्शन योजना को वैसे ही बताते हैं जैसे वह लिखी गई थी; उन्हें इस रूप में शिप हुई सुविधाएँ न समझें।

<a id="pr-b-dev-mcp-for-coding-assistants"></a>

## PR B: कोडिंग सहायकों के लिए Dev MCP

`tools/dev-mcp` में वैकल्पिक स्थानीय सर्वर, pnpm workspace और Docker image के बाहर। A2 की tracking इस्तेमाल करता है। सेटअप/जांच B द्वारा जोड़े `tools/dev-mcp/README.md` में हैं।

<a id="pr-c-command-palette-and-keyboard-shortcuts-overlay"></a>

## PR C: कमांड पैलेट और शॉर्टकट पैनल

C में Ctrl+K पैलेट और "?" सूची। केवल client, स्विच नहीं, मौजूदा keys नहीं बदलतीं।

<a id="pr-d-reviewed-server-fixes-part-1"></a>

## PR D: समीक्षा किए सर्वर सुधार, भाग 1

D में routes, middleware, recovery, chat/generation, importers, sidecar और SSRF, प्रत्येक के साथ regression। सुधारों के स्विच नहीं।

<a id="pr-e-reviewed-server-fixes-part-2"></a>

## PR E: समीक्षा किए सर्वर सुधार, भाग 2

E में services और storage, प्रत्येक सुधार का regression, स्विच नहीं।

<a id="pr-f-prompt-caching"></a>

## PR F: प्रॉम्प्ट कैश

F में Claude सदस्यता history marker सुधार, Claude Agent SDK अपडेट, cache-अनुकूल संरचना (default बंद स्विच), हर चैट में कम-cache भेजने की चेतावनी (default बंद), वैकल्पिक निदान।

<a id="pr-g-generation-jobs-and-console-tray"></a>

## PR G: जनरेशन कार्य और कंसोल ट्रे

G में टैब बंद होने पर जारी image/sprite/video कार्य और दर्शक (default बंद स्विच), Windows console tray icon (default बंद स्विच)।

<a id="pr-h-engine-diagnostics-and-launcher"></a>

## PR H: Engine निदान और लॉन्चर

H में startup integrity, runtime memory telemetry, वैकल्पिक debug files, background call cap (default बंद स्विच), launcher सुरक्षा और हमेशा reasoning करने वाले मॉडलों के लिए reasoning बंद करने का विकल्प हटाकर retry।

---

<a id="test-results-for-pr-a-on-the-development-machine"></a>

## डेवलपमेंट मशीन पर PR A के टेस्ट परिणाम

`staging` के आधार कमिट `dd876831a` पर जांच। कोई भुगतान वाला मॉडल कॉल नहीं।

- **Linux Node regression**, CI `complete-node-regressions` की तरह (WSL में Ubuntu 24.04, Node 24, `pnpm install --frozen-lockfile`, `pnpm regression`): सभी 384 फ़ाइल पास। अधिक लोड पर `server-signal-shutdown` कभी 30 सेकंड सीमा छूता था, उसी मशीन के मूल `staging` पर भी। समय-संवेदनशील `smart-group-decision`, `agent-activation-questions`, `advanced-memory-core` एक-एक बार विफल हुए और हर दोबारा रन में पास।
- **Windows Node regression**: 384 में 379 पास। `decision-sidecar-runtime`, `gallery-previews`, `request-timeouts`, `server-signal-shutdown`, `storage-writer-lock` उसी मशीन के मूल `staging` पर भी समान विफल: स्थानीय file locks, console signals, disk-space जांच।
- **टाइप, lint, format और builds**: shared/server/client, root और token estimation प्रोजेक्ट के लिए `tsc --noEmit`; lint में 0 errors; `packages/**/*.{ts,tsx}` पर Prettier; locale और static JSX जांच; client/server builds।
- **सेटिंग के browser tests** (`core-flows`, `issue-sweep-settings`, `ux-feedback-sweep`, `afternoon-sweep`, `client-runtime-diagnostics`) `mobile-chromium` पर: 171 पास, 0 विफल। `mobile-webkit` (Windows WebKit) में दोबारा रन के बाद बची विफलताएं मूल `staging` में भी हैं।
- **Features भाग** default और SillyTavern themes, light/dark, desktop और phone आकारों पर देखकर जांचा गया।
