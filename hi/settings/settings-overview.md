# सेटिंग्स का परिचय

जानें कि **Settings** (सेटिंग्स) का कौन सा हिस्सा कौन सा कंट्रोल रखता है, **General** टैब कैसे सेट करें, और आपकी सेटिंग्स अलग-अलग डिवाइस के बीच कैसे सिंक होती हैं।

## Settings पैनल और उसके छह टैब

सबसे ऊपर वाली बार में गियर आइकन से **Settings** खोलें। सबसे ऊपर का **Search settings** बॉक्स किसी सेटिंग को उसके नाम से ढूँढता है। `delete`, `streaming` या `quotes` जैसा कोई शब्द टाइप करें, और Marinara मेल खाते सेक्शन पर पहुँच जाता है। यह आपकी इंटरफ़ेस भाषा के नामों से भी मेल खाता है और अंग्रेज़ी के नामों से भी। पैनल में छह टैब हैं। हर टैब के अपने सेक्शन हैं।

### मुझे यह करना है…

| मुझे यह करना है… | यहाँ जाएँ |
| --- | --- |
| भाषा बदलनी है | **Settings → General → App Behavior → Language** |
| टेक्स्ट बड़ा करना है | **Settings → Appearance → App → Text & Scale** |
| थीम या रंग बदलने हैं | **Settings → Appearance → App → App Style** |
| नोटिफ़िकेशन की आवाज़ सेट करनी है | **Settings → General → Notifications** |
| डिलीट की पुष्टि वाला सवाल बंद करना है | **Settings → General → App Behavior** |
| क्विक रिप्लाई जोड़ने हैं | **Settings → General → Input & Editing** |
| बैकअप बनाना है | **Settings → Advanced → Backup & Export** |
| अपना डेटा मिटाना है | **Settings → Advanced → Danger Zone** |
| Marinara अपडेट करना है | **Settings → Advanced → Updates** |

### हर टैब में क्या है

- **General** (यही गाइड):
  - **App Behavior** (इसमें **Search and Professor Mari settings** की एक पंक्ति है)
  - **Notifications**
  - **Responses**
  - **Input & Editing**
  - **Text Rules**
  - **Game Playback**
- **Appearance** में चार बटन हैं। [Appearance सेटिंग्स](../appearance/appearance-settings.md) देखें।
  - **App**: **App Style**, **Text & Scale**, **Atmosphere**, **Backgrounds**
  - **Conversation**: **Conversation Display**, **Conversation Theme**
  - **Roleplay**: **Tracker Panel**, **Roleplay Presentation**
  - **Game**: **Game Presentation**
- **Generations** में **Overall Generations**, **Image Generation**, **Video Generation** और **Prompt Overrides** हैं। Illustrator एजेंट इंस्टॉल करने तक यह टैब सिर्फ़ उसे डाउनलोड करने का सुझाव दिखाता है। [इमेज स्टाइल प्रोफ़ाइल](../media/style-profiles.md) और [सीन वीडियो जेनरेशन](../media/scene-video.md) देखें।
- **Addons** में एक्सटेंशन का रिविज़न इतिहास, **Personal Extensions**, **External Extensions** (सिर्फ़ तब, जब आपने उन्हें अनलॉक किया हो) और **Theme Library** हैं। [पर्सनल एक्सटेंशन](../extending/personal-extensions.md) और [कस्टम CSS थीम (Theme Library)](../appearance/custom-css-themes.md) देखें।
- **Imports** में **Profile & Marinara**, **SillyTavern Import** और **Game Assets** हैं। [Marinara का बैकअप और रिस्टोर](../data/backup-and-restore.md) और [SillyTavern से इंपोर्ट करना](../data/importing-from-sillytavern.md) देखें।
- **Advanced** में नीचे दिए सेक्शन इसी क्रम में हैं। [Advanced टैब](#the-advanced-tab) देखें।
  - **Multiplayer WIP**
  - **Access**
  - **Admin Access**
  - **Features**
  - **Updates**
  - **Support Diagnostics**
  - **Request timeouts**
  - **Parameters**
  - **Message Tools**
  - **Backup & Export**
  - **Storage Optimization**
  - **Danger Zone**

## General टैब

**General** टैब का हर सेक्शन **Settings → General** में है।

| सेक्शन | क्या कंट्रोल करता है |
| --- | --- |
| **App Behavior** | भाषा, डिलीट की सुरक्षा, दिखाने और छिपाने वाले स्विच, और **Search and Professor Mari settings** वाली पंक्ति। [App Behavior](#app-behavior) देखें। |
| **Notifications** | नोटिफ़िकेशन की आवाज़ें, और ब्राउज़र और Android के नोटिफ़िकेशन। [Notifications](#notifications) देखें। |
| **Responses** | स्ट्रीमिंग, ट्रिमिंग और **Messages per page**। [संदेश भेजना और स्ट्रीमिंग](../chats/sending-and-streaming.md) देखें। |
| **Input & Editing** | **Send on Enter**, **Quick replies**, स्वाइप और एडिट के शॉर्टकट। [Input and Editing](#input-and-editing) देखें। |
| **Text Rules** | चैट का टेक्स्ट कैसे फ़ॉर्मैट हो। [Text Rules](#text-rules) देखें। |
| **Game Playback** | Game Mode में पढ़ना और आगे-पीछे जाना। [Game Mode: शुरुआत](../game/getting-started.md) देखें। |

### App Behavior

| सेटिंग | क्या करती है |
| --- | --- |
| **Language** | इंटरफ़ेस की भाषा तय करती है। यह मॉडल के प्रॉम्प्ट या चैट का कंटेंट नहीं बदलती। जिस टेक्स्ट का अनुवाद अभी नहीं हुआ, वह अंग्रेज़ी में दिखता है। अरबी में लेआउट दाएँ से बाएँ चलता है। डिफ़ॉल्ट: English। |
| **Documentation Language** | बिल्ट-इन गाइड की भाषा तय करती है। नीचे देखें। डिफ़ॉल्ट: English। |
| **Confirm before deleting** | Marinara किसी चैट, कैरेक्टर या दूसरी चीज़ को हमेशा के लिए मिटाए, उससे पहले पूछती है। डिफ़ॉल्ट: चालू। |
| **Hide chat Help button** | Conversation, Roleplay और Game चैट से **Help** बटन छिपाती है। डिफ़ॉल्ट: बंद। |
| **Show Android status bar** | समय, बैटरी और नोटिफ़िकेशन के आइकन Marinara के ऊपर दिखते रखती है। सिर्फ़ Android ऐप में काम करती है। डिफ़ॉल्ट: बंद। |
| **Achievements** | अचीवमेंट गिनती है, अनलॉक की सूचनाएँ दिखाती है, और Home का बुकमार्क और विजेट दिखाती है। [अचीवमेंट](../home/achievements.md) देखें। डिफ़ॉल्ट: चालू। |
| **Disable seasonal ME themes** | Marinara की मौसमी थीम बंद करती है। डिफ़ॉल्ट: बंद। |
| **Music Player** | छोटा Music Player दिखाती है। इसके लिए **Agents → Agent Organizer** से **Music DJ** एजेंट चाहिए, और उसे इंस्टॉल करने तक यह स्विच धूसर रहता है। [Music DJ: Spotify, YouTube और लोकल म्यूज़िक](../media/music.md) देखें। डिफ़ॉल्ट: चालू। |

**Search and Professor Mari settings** **App Behavior** के सबसे नीचे की एक पंक्ति है। Search, तुरंत जवाब और Professor Mari की सेटिंग्स वाले पेज पर जाने के लिए **Open** चुनें। [Professor Mari, आपकी इन-ऐप असिस्टेंट](../home/professor-mari.md) देखें।

इंटरफ़ेस की भाषाएँ ये हैं: अरबी, सरलीकृत चीनी, अंग्रेज़ी, फ़्रेंच, जर्मन, हिंदी, जापानी, कोरियाई, पोलिश, ब्राज़ीली पुर्तगाली, रूसी और स्पैनिश। किसी अनुवाद को बेहतर करने या नई भाषा जोड़ने के लिए [UI लोकलाइज़ेशन](../development/localization.md) देखें।

**Documentation Language** के लिए अंग्रेज़ी ऐप में पहले से मौजूद है। कोई दूसरी भाषा चुनें और **Download & Replace** पर क्लिक करें। Marinara उस भाषा का पैक एक बार डाउनलोड करता है और पिछला पैक हटा देता है, इसलिए डाउनलोड की हुई सिर्फ़ एक भाषा रहती है। जो गाइड अभी अनुवादित नहीं हैं, वे छोटे `EN` बैज के साथ अंग्रेज़ी में खुलती हैं। डॉक्स सर्च उसी भाषा में चलता है जो चालू है। आपका चुनाव अपडेट के बाद भी बना रहता है, और अनुवाद बदले हों तो अपडेट के बाद पैक रिफ़्रेश हो जाता है। डाउनलोड की हुई गाइड गायब हो जाएँ या खराब हो जाएँ तो **Fix documentation** बटन दिखता है। वह पैक दोबारा डाउनलोड करता है, या डाउनलोड सोर्स तक न पहुँच पाने पर गाइड को अंग्रेज़ी पर रीसेट कर देता है।

### Notifications

Marinara नोटिफ़िकेशन के लिए एक बिल्ट-इन टोन बजाता है। अपनी आवाज़ इस्तेमाल करने के लिए:

1. **Settings → General → Notifications** खोलें।
2. एक **Custom sound** अपलोड करें: MP3, WAV, OGG, M4A, MP4 या WebM, 10 MB तक।

यह आवाज़ इस सर्वर से जुड़े हर डिवाइस पर बजती है। आप उसे सुन सकते हैं, बदल सकते हैं या हटा सकते हैं। फ़ाइल पढ़ी न जा सके तो Marinara बिल्ट-इन टोन बजाता है। यह फ़ाइल बैकअप और प्रोफ़ाइल एक्सपोर्ट का हिस्सा है।

**Background Notifications** उन Conversation संदेशों के लिए हैं जो कैरेक्टर अपने आप भेजते हैं। **Generation Completion Notifications** उन जवाबों के लिए हैं जो आप खुद Conversation, Roleplay और Game Mode में शुरू करते हैं। दोनों तब काम करते हैं जब Marinara खुला हो पर फ़ोकस में न हो। वे संदेशों का कंटेंट कभी नहीं दिखाते।

### Input and Editing

**Settings → General → Input & Editing** की सेटिंग्स:

| सेटिंग | क्या करती है |
| --- | --- |
| **Send on Enter** | चुनती है कि Enter दबाने पर कौन से मोड संदेश भेजें। |
| **Keep guidance after regenerating** | गाइडेड तरीके से दोबारा जेनरेट करने के बाद आपकी दिशा संदेश बॉक्स में रहने देती है। डिफ़ॉल्ट: चालू। |
| **Add CYOA choices to the message box instead of sending them** | क्लिक किया हुआ विकल्प आपके संदेश बॉक्स में रखती है, ताकि आप उसे पहले एडिट कर सकें। |
| **Quick replies** | Send बटन के बगल में ड्राफ़्ट वाली क्रियाएँ जोड़ती है। [गाइडेड जेनरेशन और Impersonate](../chats/guided-and-impersonate.md) देखें। |
| **Speech-to-text microphone** | चैट के इनपुट में माइक्रोफ़ोन बटन दिखाती है। |
| **Intuitive swipe navigation** | ऐरो कुंजियों या टच स्वाइप से स्वाइप के बीच जाने देती है (स्वाइप यानी एक संदेश पर रखे कई जवाब)। |
| **Reroll past the newest swipe** | सबसे नए स्वाइप से आगे स्वाइप करने पर नया जवाब बनाती है। |
| **Up Arrow edits last message** | खाली इनपुट में Up Arrow दबाने पर आपका पिछला संदेश एडिट होता है। |
| **Double-click edits messages** | Roleplay के संदेश पर डबल-क्लिक करने से वह एडिट होता है। |

**Responses** सेक्शन में **Enable streaming**, **Streaming speed**, **Trim incomplete sentences from the response**, **Add a new line before /continue text** (डिफ़ॉल्ट रूप से चालू) और **Messages per page** हैं। [संदेश भेजना और स्ट्रीमिंग](../chats/sending-and-streaming.md) देखें। संदेश की क्रियाओं के लिए [संदेश की क्रियाएँ: एडिट, डिलीट, स्वाइप, दोबारा जेनरेट](../chats/messages.md) देखें।

### Text Rules

ये नियम **Settings → General → Text Rules** में तय करते हैं कि चैट के टेक्स्ट के साथ क्या किया जाए। **Bold dialogue in quotes** और **Convert LaTeX symbols** सिर्फ़ टेक्स्ट की दिखावट बदलते हैं, इसलिए आपके सेव किए संदेश वैसे ही रहते हैं। **Quote style** आपके टाइप और सेव किए टेक्स्ट के उद्धरण-चिह्न दोबारा लिखता है।

| सेटिंग | क्या करती है |
| --- | --- |
| **Bold dialogue in quotes** | उद्धरण-चिह्नों के अंदर का टेक्स्ट बोल्ड में दिखाती है। डिफ़ॉल्ट: चालू। |
| **Convert LaTeX symbols** | LaTeX के गणित वाले कमांड चिह्नों के रूप में दिखाती है। कोड जैसा है वैसा रहता है। डिफ़ॉल्ट: चालू। |
| **Quote style** | **Straight** सादे चिह्न रखता है (डिफ़ॉल्ट)। **Typographic** उन्हें घुमावदार उद्धरण-चिह्न और अपॉस्ट्रॉफ़ी में बदल देता है। |
| **Load images from other websites in messages** | दूसरी वेबसाइटों पर रखी इमेज को कंट्रोल करती है। डिफ़ॉल्ट: बंद। |

#### Bold dialogue in quotes

यह चालू हो तो `"I missed you," she said.` में उद्धरण-चिह्नों के अंदर के शब्द बोल्ड में दिखते हैं। बोल्ड के बिना सिर्फ़ संवाद का रंग रखना हो तो इसे बंद करें।

#### Convert LaTeX symbols

कुछ मॉडल गणित को LaTeX कमांड के रूप में लिखते हैं। यह चालू हो तो `\rightarrow`, `\neq`, `\times` और `\alpha` क्रम से `→`, `≠`, `×` और `α` के रूप में दिखते हैं।

#### Load images from other websites in messages

यह बंद हो तो संदेश, ग्रीटिंग या कार्ड प्रीव्यू में किसी दूसरी वेबसाइट की इमेज की जगह उस वेबसाइट का नाम और एक **Load image** बटन दिखता है। इससे कोई संदेश अपने आप दूसरी साइटों से संपर्क नहीं कर पाता। वह इमेज दिखाने के लिए **Load image** चुनें। Marinara आपका चुनाव आपके सभी डिवाइस पर याद रखता है। हर इमेज तुरंत दिखाने के लिए यह सेटिंग चालू करें। Marinara में सेव की गई इमेज, जैसे गैलरी की तस्वीरें, अवतार और स्प्राइट, हमेशा दिखती हैं।

<a id="the-advanced-tab"></a>

## Advanced टैब

| सेक्शन | और पढ़ें |
| --- | --- |
| **Admin Access** | [रिमोट एक्सेस: लॉगिन और IP अलाउलिस्ट](../REMOTE_ACCESS.md) |
| **Features** | [सुविधा स्विच](../configuration/features.md) |
| **Updates** | [Marinara Engine को अपडेट करना](../UPGRADING.md) |
| **Message Tools** | [Message Tools](#message-tools) |
| **Backup & Export** | [Marinara का बैकअप और रिस्टोर](../data/backup-and-restore.md) |
| **Danger Zone** | [अपना डेटा मिटाना या रीसेट करना](../data/clearing-data.md) |

### Message Tools

ये स्विच **Settings → Advanced → Message Tools** में हैं। **Show context usage** और **Show "older messages not sent" note** को छोड़कर सारे स्विच डिफ़ॉल्ट रूप से बंद हैं।

| स्विच | क्या करता है |
| --- | --- |
| **Show message timestamps** | हर संदेश पर तारीख और समय दिखाता है। |
| **Show characters in Persona pickers** | पर्सोना पिकर में आपके कैरेक्टर की सूची दिखाता है, ताकि आप किसी कैरेक्टर के रूप में खेल सकें। |
| **Show model name on messages** | दिखाता है कि हर जवाब किस मॉडल ने लिखा। |
| **Show token usage on messages** | हर संदेश के प्रॉम्प्ट और जवाब के टोकन की गिनती दिखाता है। |
| **Show context usage** | कनेक्शन स्विचर और Game की चैट सेटिंग्स में दिखाता है कि आखिरी नापी गई रिक्वेस्ट में कॉन्टेक्स्ट विंडो कितनी भरी थी। |
| **Show message numbers** | हर संदेश पर एक नंबर दिखाता है। |
| **Show "older messages not sent" note** | पुराने संदेश प्रॉम्प्ट में न समाए हों तो सबसे नए जवाब के नीचे एक नोट दिखाता है। बीच में कटा हुआ या खाली जवाब अपना अलग नोट फिर भी दिखाता है। |
| **Guide swipes/regens with chat input** | दोबारा जेनरेट करते समय आपके ड्राफ़्ट को दिशा की तरह इस्तेमाल करता है। |
| **Include reasoning in exports** | मॉडल की छिपी हुई सोच को चैट एक्सपोर्ट में जोड़ता है। |
| **Include private notes in exports** | संदेशों पर आपके निजी नोट JSONL और टेक्स्ट एक्सपोर्ट में जोड़ता है। ट्रांसक्रिप्ट शेयर करते समय इसे बंद रखें। |
| **Debug mode** | सपोर्ट के लिए मॉडल के पेलोड सर्वर कंसोल में लॉग करता है। |

और जानने के लिए [संदेश की क्रियाएँ: एडिट, डिलीट, स्वाइप, दोबारा जेनरेट](../chats/messages.md), [यूज़र पर्सोना: बनाना और बदलना](../characters/personas.md), [एक चैट के लिए मॉडल चुनना](../connections/connecting-to-a-provider.md#choosing-a-model-for-one-chat), [Peek Prompt: देखें कि AI को क्या मिला](../chats/peek-prompt.md), [गाइडेड जेनरेशन और Impersonate](../chats/guided-and-impersonate.md), [चैट का एक्सपोर्ट और इंपोर्ट](../chats/export-import.md) और [Marinara Engine की समस्याएँ सुलझाना](../TROUBLESHOOTING.md) देखें।

## डिवाइस के बीच सेटिंग्स कैसे सिंक होती हैं

Marinara आपकी ज़्यादातर सेटिंग्स सर्वर पर सेव करता है, इसलिए वे अलग-अलग ब्राउज़र और डिवाइस पर आपके साथ चलती हैं।

1. आप **Settings** में कोई सेटिंग बदलते हैं।
2. करीब एक सेकंड बाद Marinara उसे सर्वर पर सेव कर देता है।
3. उसी सर्वर को खोलने वाला कोई दूसरा ब्राउज़र वे सेटिंग्स लोड कर लेता है।

सबसे नया बदलाव जीतता है। किसी बदलाव के कुछ ही देर बाद आप दूसरे डिवाइस पर Marinara खोलें तो उसकी पुरानी कॉपी आपका बदलाव बदल सकती है। डिवाइस बदलने से पहले थोड़ा रुकें।

दो सेटिंग्स कभी सिंक नहीं होतीं। उन्हें हर डिवाइस पर **Settings → Appearance → Text & Scale** में दोबारा सेट करें:

- **Display Size**, यानी इंटरफ़ेस के टेक्स्ट का साइज़
- **Chat Font Size**, यानी चैट के टेक्स्ट का साइज़

[Appearance सेटिंग्स](../appearance/appearance-settings.md) देखें। सर्वर तक न पहुँचा जा सके तो ऐप आपकी लोकल सेटिंग्स के साथ चलता रहता है और अगली बार कुछ बदलने पर फिर कोशिश करता है।

## मिलती-जुलती गाइड

- [Appearance सेटिंग्स](../appearance/appearance-settings.md)
- [संदेश की क्रियाएँ: एडिट, डिलीट, स्वाइप, दोबारा जेनरेट](../chats/messages.md)
- [Marinara आपका डेटा कहाँ सेव करता है](../data/where-data-is-stored.md)
- [Marinara Engine की समस्याएँ सुलझाना](../TROUBLESHOOTING.md)
