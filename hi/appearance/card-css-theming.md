# कार्ड CSS थीमिंग गाइड

Card CSS किसी कैरेक्टर या पर्सोना कार्ड को चैट में उसका अपना लुक देती है। आप CSS को कार्ड के **Creator Notes** (क्रिएटर नोट्स) में रखते हैं, और Marinara उसे उसी कैरेक्टर के संदेशों पर लागू करता है। यह सिर्फ़ चैट को स्टाइल कर सकती है, बाकी ऐप को कभी नहीं। यह गाइड कार्ड बनाने वालों के लिए है।

## शुरू करने से पहले

इस गाइड में इस्तेमाल होने वाले शब्द:

- **CSS** रंग, फ़ॉन्ट, बॉर्डर और स्पेसिंग तय करती है।
- **Card CSS** यानी किसी कार्ड में रखी गई CSS। यह उसी कार्ड के संदेशों को थीम देती है।
- **Card Theming** (कार्ड थीमिंग) हर चैट का वह कंट्रोल है जो Card CSS चालू करता है। यह **Chat Settings → Characters** (चैट सेटिंग्स → कैरेक्टर) में है, या Game में **Party** (पार्टी) में।
- **सिलेक्टर** CSS नियम का वह हिस्सा है जो तय करता है कि स्टाइल किन एलिमेंट पर लगेगी। दो सिलेक्टर के बीच स्पेस का मतलब "के अंदर" होता है, इसलिए `.a .b` उस `.b` से मैच करता है जो किसी `.a` के अंदर हो।
- **लेआउट** यानी संदेश किस तरह सजते हैं। Conversation में **Linear** रो और **Bubbles** होते हैं।

## तुरंत शुरुआत

स्टेप 2 में पेस्ट करने के लिए यह रहा एक शुरुआती ब्लॉक:

```html
<style>
  /* the visible message bubble (Bubbles layout, and roleplay) */
  [data-card-css] .mari-message-bubble {
    background: linear-gradient(135deg, #2a1240, #3a1030);
    border: 1px solid #ff66cc;
    border-radius: 14px;
  }
  /* the name and the text (works in every message style) */
  [data-card-css] .mari-message-name {
    color: #ff8fd4;
    text-shadow: 0 0 8px rgba(255, 102, 204, 0.6);
  }
  [data-card-css] .mari-message-content {
    color: #ffd6f0;
  }
</style>
```

आप पहले कार्ड में CSS जोड़ते हैं, फिर उसे चैट में चालू करते हैं।

1. कैरेक्टर को Character Editor में खोलें और **Creator Notes** ढूँढें। पर्सोना के लिए यही फ़ील्ड Persona Editor में है।
2. शुरुआती ब्लॉक को **Creator Notes** में पेस्ट करें और कार्ड सेव करें।
3. उसी कैरेक्टर के साथ चैट खोलें।
4. **Chat Settings** खोलें, फिर **Characters** (Game में **Party**)।
5. **Card Theming** के नीचे **Exclusive** या **Chat** चुनें। शुरुआत में यह **Disabled** पर रहता है।

कैरेक्टर के संदेश तुरंत बदल जाते हैं।

अगर यह काम नहीं किया: **Disabled**, **Exclusive** और **Chat** बटन तभी दिखते हैं जब चैट के किसी सक्रिय कैरेक्टर के **Creator Notes** में CSS हो। सिर्फ़ पर्सोना की CSS से ये नहीं दिखते, इसलिए पर्सोना की थीम के लिए भी चैट में एक ऐसा कैरेक्टर होना चाहिए जिसके पास `<style>` ब्लॉक हो। जाँच लें कि आपका `<style>` ब्लॉक सेव हुआ है। Roleplay चैट में **Color Character Names in Text** (टेक्स्ट में कैरेक्टर के नाम रंगें) **Characters** में होता है, और **Add Character** (कैरेक्टर जोड़ें) के नीचे दिखता है।

हर लेआउट में नाम गुलाबी चमक लेता है और टेक्स्ट हल्का गुलाबी हो जाता है। बबल वाला नियम बैंगनी ग्रेडिएंट और गुलाबी बॉर्डर जोड़ता है। `.mari-message-bubble` सिर्फ़ **Bubbles** लेआउट में और roleplay में मौजूद होता है, इसलिए Conversation के डिफ़ॉल्ट **Linear** लेआउट में बबल वाला नियम कुछ नहीं करता।

ऐसे टेस्ट के लिए जो चूक न सके, यह नियम इस्तेमाल करें। यह संदेश के टेक्स्ट को टारगेट करता है, जो हर मोड और हर लेआउट में रहता है, और उसका बैकग्राउंड चटख गुलाबी कर देता है।

```css
[data-card-css] .mari-message-content {
  background: hotpink;
}
```

## Card Theming कैसे काम करता है

जब **Creator Notes** में CSS वाला कोई कैरेक्टर सक्रिय होता है, तो Marinara हर `<style>` ब्लॉक पढ़ता है, हर खतरनाक चीज़ हटा देता है ([किन चीज़ों को स्टाइल नहीं कर सकते](#what-you-cannot-style) देखें), CSS का स्कोप ऐसा बनाता है कि उसकी पहुँच सिर्फ़ चैट तक रहे, और उसे इस तरह जोड़ता है कि उसके सिलेक्टर ऐप की अपनी संदेश स्टाइलिंग पर भारी पड़ें।

हर चैट में यह कैसे लागू हो, यह **Chat Settings → Characters** (या Game में **Party**) में चुनें।

| मोड | क्या करता है |
| --- | --- |
| **Disabled** (डिफ़ॉल्ट) | Card CSS बंद रहती है। |
| **Exclusive** | हर कैरेक्टर की CSS सिर्फ़ उसी के संदेशों पर असर करती है। |
| **Chat** | सारी कार्ड CSS पूरे चैट एरिया पर असर करती है, UI एलिमेंट समेत। |

ग्रुप चैट के लिए, जहाँ हर कैरेक्टर का अपना लुक हो, **Exclusive** इस्तेमाल करें। एक-से-एक चैट वाले उन कार्ड के लिए **Chat** इस्तेमाल करें जो पूरी चैट की सतह थीम करते हैं, जैसे बैकग्राउंड।

## स्कोपिंग का नियम

Marinara आपकी CSS को दोबारा लिखता है ताकि उसकी पहुँच सिर्फ़ चैट तक रहे।

- **Chat** मोड में हर चीज़ का स्कोप चैट एरिया के अंदर होता है। `[data-card-css]` का मतलब चैट एरिया है।
- **Exclusive** मोड में हर चीज़ का स्कोप आपके कैरेक्टर के हर संदेश एलिमेंट के अंदर होता है। `[data-card-css]` का मतलब इस कैरेक्टर का संदेश है।

इसलिए संदेश एलिमेंट को खुद स्टाइल करने के लिए `[data-card-css]` इस्तेमाल करें, और उसके अंदर की चीज़ों के लिए सामान्य क्लास सिलेक्टर, जैसे `.mari-message-bubble`, `.mari-message-content` और `.mari-message-name`। उसी एलिमेंट पर लगी कोई क्लास डिसेंडेंट, यानी अंदर वाले एलिमेंट, की तरह मैच नहीं कर सकती। `[data-card-css] .mari-message-...` से बनाएँ, तो आपका कार्ड दोनों मोड में चलेगा।

```css
[data-card-css] {
  /* the message row itself, good for a left accent border */
  border-left: 3px solid #ff66cc;
}
[data-card-css] .mari-message-bubble {
  /* the visible bubble inside it */
  border-radius: 14px;
}
```

**Exclusive** स्कोप में `[data-card-css]` कैरेक्टर का अपना संदेश होता है, जो `.mari-message-assistant` भी है। अपनी रो को भी थीम करना हो तो **Chat** स्कोप इस्तेमाल करें। वहाँ `[data-card-css] .mari-message-user` और `.mari-message-assistant` दोनों तरफ़ की रो अलग-अलग चुनते हैं।

## @chat-mode से किसी एक मोड को टारगेट करना

किसी एक सतह को टारगेट करने के लिए नियमों को `@chat-mode roleplay`, `@chat-mode conversation` या `@chat-mode game` में लपेट दें। किसी भी ब्लॉक से बाहर लिखी CSS हर जगह लगती है। सामान्य `@media` क्वेरी इन ब्लॉक के अंदर भी चलती हैं।

```html
<style>
  /* Applies in all modes */
  [data-card-css] .mari-message-name {
    color: #00ff95;
  }

  @chat-mode roleplay {
    [data-card-css] .mari-message-bubble {
      border: 1px solid rgba(0, 255, 149, 0.4);
      box-shadow: 0 0 16px rgba(0, 255, 149, 0.25);
    }
  }

  @chat-mode conversation {
    [data-card-css] .mari-message-bubble {
      background: rgba(0, 40, 28, 0.9);
      border-radius: 1rem;
    }
  }
</style>
```

Game Mode में बुनियादी सपोर्ट है। **Chat** मोड में कार्ड CSS पूरी गेम सतह तक पहुँचती है, इसलिए `[data-card-css]` गेम एरिया को थीम देता है। Game का लेआउट अपना अलग है और उसमें संदेश बबल नहीं होते, इसलिए मोटे तौर पर टारगेट करें, जैसे एरिया का बैकग्राउंड। गेम नैरेशन की प्रति-कैरेक्टर (**Exclusive**) स्टाइलिंग अभी उपलब्ध नहीं है।

## किन चीज़ों को स्टाइल कर सकते हैं

Roleplay और Conversation का ढाँचा एक ही है। नीचे दी गई `mari-*` क्लास और `data-*` एट्रिब्यूट पर ही टिके रहें। बाकी क्लास वर्ज़न के साथ बदलती रहती हैं।

| सिलेक्टर | किसे टारगेट करता है |
| --- | --- |
| `[data-card-css]` | पूरी संदेश रो (स्कोप एलिमेंट)। किनारे की एक्सेंट लाइन के लिए अच्छा है, या **Chat** मोड में चैट एरिया के लिए। |
| `[data-card-css] .mari-message-bubble` | दिखने वाला बबल: बैकग्राउंड, बॉर्डर, कोने, शैडो। **Bubbles** में और roleplay में। |
| `[data-card-css] .mari-message-content` | **Bubbles** में खुद बबल एलिमेंट। **Linear** में सिर्फ़ संदेश का टेक्स्ट। |
| `[data-card-css] .mari-message-name` | कैरेक्टर का दिखने वाला नाम। |
| `[data-card-css] .mari-message-meta` | ऊपर की वह रो जिसमें नाम और टाइमस्टैंप रहते हैं। |
| `[data-card-css] .mari-message-timestamp` | टाइमस्टैंप। |
| `[data-card-css] .mari-message-avatar` | अवतार वाला कॉलम। |
| `[data-card-css] .mari-message-narrator` | नैरेटर के संदेश (roleplay)। |
| `[data-card-css] .mari-message-user` | यूज़र के संदेश। कैरेक्टर के संदेशों के लिए `.mari-message-assistant` इस्तेमाल करें। |
| `[data-card-css] p`, `[data-card-css] span` | टेक्स्ट के अंदर के पैराग्राफ़ और इनलाइन स्पैन। |
| `[data-grouped]` | उसी कैरेक्टर के आगे के लगातार संदेश। सिर्फ़ Conversation में। किसी ग्रुप के पहले संदेश के लिए `[data-card-css]:not([data-grouped])` इस्तेमाल करें। |

लेआउट बदलने के लिए **Settings → Appearance → Conversation** (सेटिंग्स → अपीयरेंस → Conversation) खोलें, फिर **Conversation Display** (Conversation की डिस्प्ले सेटिंग्स), फिर **Chat Layout** (चैट लेआउट)। **Linear** में बबल नहीं होता, इसलिए वहाँ `.mari-message-content` (टेक्स्ट) और `[data-card-css]` (रो) को स्टाइल करें।

एक स्टाइल किया हुआ बबल:

```css
[data-card-css] .mari-message-bubble {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border: 1px solid rgba(100, 149, 237, 0.35);
  border-radius: 1rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
}
[data-card-css] .mari-message-name {
  color: #6495ed;
  text-shadow: 0 0 8px rgba(100, 149, 237, 0.5);
}
[data-card-css] .mari-message-content {
  font-family: Georgia, serif;
}
```

### टाइपिंग इंडिकेटर

जब कोई कैरेक्टर लिख रहा होता है, तब Conversation के **Linear** लेआउट में "(name) is typing..." वाली एक रो दिखती है।

| सिलेक्टर | किसे टारगेट करता है |
| --- | --- |
| `[data-card-css] .mari-typing-text` | लेबल। |
| `[data-card-css] .mari-typing-dots span` | चलती हुई बिंदियाँ। |
| `[data-card-css] .mari-typing-indicator` | रो। इस पर नाम `data-typing-name` के रूप में रहता है। |

```css
[data-card-css] .mari-typing-text {
  color: #ff66cc;
  font-style: italic;
}
[data-card-css] .mari-typing-dots span {
  background: #ff66cc;
}
```

### अवतार

अवतार डिफ़ॉल्ट रूप से गोल होता है। यह उदाहरण उस अवतार बटन को टारगेट करता है जिस पर क्लिक हो सकता है। बिना क्लिक वाले अवतार के लिए `.mari-message-avatar > div` इस्तेमाल करें। roleplay में यह बटन एक अतिरिक्त ग्लो-रैपर `div` के अंदर बैठता है। सिर्फ़ अपनी रिंग दिखानी हो तो उस रैपर को सपाट कर दें।

```css
[data-card-css] .mari-message-avatar button {
  border-radius: 6px; /* 0 for sharp corners, 50% for a circle */
  box-shadow: 0 0 0 2px #ff66cc;
}
@chat-mode roleplay {
  [data-card-css] .mari-message-avatar > div {
    box-shadow: none;
  }
}
```

### About Me प्रोफ़ाइल पॉपआउट (सिर्फ़ Conversation में)

Conversation मोड में अवतार पर क्लिक करने से एक प्रोफ़ाइल पॉपआउट खुलता है, जिसमें "about me" दिखता है। कैरेक्टर कार्ड और पर्सोना अपना-अपना पॉपआउट थीम कर सकते हैं। यह roleplay या game में नहीं होता, इसलिए अगर आप दूसरे मोड की CSS भी दे रहे हैं, तो इन नियमों को `@chat-mode conversation` में लपेट दें।

पॉपआउट कार्ड ही स्कोप एलिमेंट है। इसे `[data-card-css].mari-about-me-popout` से टारगेट करें (बिना स्पेस, एक ही एलिमेंट), और इसके अंदर की चीज़ों को डिसेंडेंट की तरह। **Chat** मोड में आप सीधे `.mari-about-me-name` भी इस्तेमाल कर सकते हैं।

| सिलेक्टर | किसे टारगेट करता है |
| --- | --- |
| `[data-card-css].mari-about-me-popout` | पॉपआउट कार्ड: बैकग्राउंड, बॉर्डर, आकार। |
| `[data-card-css] .mari-about-me-banner` | ऊपर की बैनर पट्टी (डिफ़ॉल्ट रूप से नाम वाला रंग लेती है)। |
| `[data-card-css] .mari-about-me-avatar` | बड़े अवतार का रैपर। गोले के लिए `... > div` इस्तेमाल करें। |
| `[data-card-css] .mari-about-me-status` | प्रेज़ेंस स्टेटस वाली बिंदी (सिर्फ़ कैरेक्टर के लिए)। |
| `[data-card-css] .mari-about-me-name` | दिखने वाले नाम का शीर्षक। |
| `[data-card-css] .mari-about-me-handle` | दूसरी पंक्ति वाला @name, जो तब दिखता है जब Convo का दिखने वाला नाम अलग हो। |
| `[data-card-css] .mari-about-me-presence` | स्टेटस या गतिविधि वाली पंक्ति (सिर्फ़ कैरेक्टर के लिए)। |
| `[data-card-css] .mari-about-me-box` | About Me का कंटेनर बॉक्स। |
| `[data-card-css] .mari-about-me-label` | "ABOUT ME" वाला कैप्शन। |
| `[data-card-css] .mari-about-me-badge` | Default या Chat-specific वाली गोली। |
| `[data-card-css] .mari-about-me-text` | about-me का मुख्य टेक्स्ट। |

```css
@chat-mode conversation {
  [data-card-css].mari-about-me-popout {
    background: radial-gradient(120% 120% at 50% 0%, #241a3a 0%, #14101f 70%);
    border: 1px solid rgba(180, 120, 255, 0.45);
    border-radius: 1.25rem;
  }
  [data-card-css] .mari-about-me-banner {
    background: linear-gradient(90deg, #b478ff, #ff77c6);
  }
  [data-card-css] .mari-about-me-name {
    color: #e9d8ff;
  }
}
```

<a id="what-you-cannot-style"></a>

## किन चीज़ों को स्टाइल नहीं कर सकते

सुरक्षा के लिए सैनिटाइज़र इन चीज़ों को हटा देता है।

| हटाया जाता है | वजह |
| --- | --- |
| `url(https://...)` | कोई नेटवर्क रिक्वेस्ट नहीं, ताकि ट्रैकिंग और डेटा लीक न हो। सिर्फ़ `url(data:...)` चलता है, इनलाइन इमेज और फ़ॉन्ट के लिए। |
| बाहरी URL वाला `@font-face` | सिर्फ़ `data:` वाले फ़ॉन्ट सोर्स रखे जाते हैं। फ़ैमिली का नाम बदल दिया जाता है, ताकि वह ऐप के फ़ॉन्ट पर हावी न हो सके। |
| `@import` | बाहर की स्टाइलशीट लोड नहीं हो सकतीं। |
| `:has()` सिलेक्टर | ये चैट से बाहर के एलिमेंट नहीं टटोल सकते। |
| नेस्टेड नियम और `~` या `+` से शुरू होने वाले सिलेक्टर | हटा दिए जाते हैं, ताकि कार्ड CSS अपने स्कोप से बाहर न पहुँच सके। सामान्य सिलेक्टर लिखें। |
| `content:` में HTML | सजावटी टेक्स्ट चलता है, पर `<` और `>` हटा दिए जाते हैं और टेक्स्ट 200 अक्षरों तक सीमित रहता है। `attr()` और `counter()` चलते हैं। |
| `position: fixed` | इसे `position: absolute` में बदल दिया जाता है, ताकि पूरी स्क्रीन ढकने वाला ओवरले न बन सके। |
| `!important` | हटा दिया जाता है, ताकि कार्ड CSS ऐप की स्टाइल पर ज़बरदस्ती हावी न हो सके। |
| ऐप की थीम के टोकन | `--primary` और `--background` जैसे टोकन हटा दिए जाते हैं, ताकि कार्ड CSS ऐप के UI का रंग-रूप न बदल सके। |

चैट के अंदर रंग, बैकग्राउंड, बॉर्डर और फ़ॉन्ट के मामले में कार्ड CSS ऐप की अपनी संदेश स्टाइल पर भारी पड़ती है। यह इनसे नहीं जीत सकती: जो सैनिटाइज़र हटा देता है, जो कुछ चैट से बाहर है, और वे स्टाइल जो ऐप इनलाइन या `!important` के साथ लगाता है। **Settings** में सेट किया गया आपकी पूरी चैट का फ़ॉन्ट रंग और साइज़ इसका एक उदाहरण है।

कस्टम फ़ॉन्ट के लिए उसे base64 `data:` URI के रूप में रखें, या सिस्टम फ़ॉन्ट स्टैक इस्तेमाल करें।

```css
@font-face {
  font-family: "MyFont";
  src: url(data:font/woff2;base64,d09GMgAB...) format("woff2");
}
```

## टिप्स

1. बबल को `.mari-message-bubble` से स्टाइल करें, `[data-card-css]` से नहीं। रो पूरी चौड़ाई की होती है, इसलिए उस पर लगा बैकग्राउंड ज़्यादातर दिखता ही नहीं।
2. `rgba()` वाले रंग इस्तेमाल करें, ताकि हल्की और गहरी दोनों थीम पर घुल-मिल जाएँ।
3. एनिमेशन हल्के रखें। कम ताकत वाले डिवाइस पर भारी `animation` की जगह `transition` बेहतर है। `opacity` को एनिमेट करें, `box-shadow` को नहीं, क्योंकि वह हर फ़्रेम में दोबारा पेंट होता है।
4. फ़ोन के लिए `@media (max-width: 768px)` इस्तेमाल करें।
5. यूटिलिटी क्लास पर निर्भर न रहें। सिर्फ़ डॉक्यूमेंटेशन में दिए गए `mari-*` हुक ही भरोसेमंद हैं।

## शोकेस: Eldritch Grimoire

यह उदाहरण हर मोड के मुख्य हुक छूता है: चमकते नाम, थीम किया हुआ सेरिफ़ टेक्स्ट, रिंग वाला अवतार, कोने में रून वाला एनिमेटेड roleplay बबल, Conversation का बबल, एक रहस्यमय टाइपिंग इंडिकेटर और गेम की सतह। इसे **Creator Notes** में पेस्ट करें, फिर **Chat Settings → Characters** (या Game में **Party**) में Card Theming मोड चुनें। गेम की सतह के लिए **Chat** सेट करें। रंग, `content` वाला ग्लिफ़ और फ़ॉन्ट बदलकर इसे अपने हिसाब से ढाल लें।

```html
<style>
  @keyframes grimoire-pulse {
    0%,
    100% {
      opacity: 0.35;
    }
    50% {
      opacity: 1;
    }
  }

  /* All modes */
  [data-card-css] .mari-message-name {
    color: #ff5c8a;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    text-shadow: 0 0 8px rgba(255, 92, 138, 0.7), 0 0 16px rgba(168, 85, 247, 0.45);
  }
  [data-card-css] .mari-message-timestamp {
    color: rgba(243, 215, 255, 0.5);
    font-variant: small-caps;
  }
  [data-card-css] .mari-message-avatar button {
    border-radius: 7px;
    box-shadow: 0 0 0 2px rgba(220, 38, 120, 0.6), 0 0 14px rgba(168, 85, 247, 0.5);
  }
  [data-card-css] .mari-message-content {
    color: #f3d7ff;
    font-family: "Iowan Old Style", Georgia, "Times New Roman", serif;
  }

  @chat-mode roleplay {
    [data-card-css] {
      border-left: 2px solid rgba(220, 38, 120, 0.35);
    }
    [data-card-css] .mari-message-avatar > div {
      box-shadow: none;
    }
    [data-card-css] .mari-message-bubble {
      background: linear-gradient(135deg, #1a0a24 0%, #2d0a2e 55%, #3a0a1e 100%);
      border: 1px solid rgba(220, 38, 120, 0.45);
      border-radius: 4px 16px 16px 16px;
      position: relative;
      overflow: hidden;
      box-shadow: 0 0 16px rgba(190, 70, 190, 0.4);
    }
    /* breathing inner glow: animate a full-bleed overlay's opacity, which is cheap */
    [data-card-css] .mari-message-bubble::after {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      box-shadow: inset 0 0 26px rgba(120, 0, 80, 0.65);
      animation: grimoire-pulse 4s ease-in-out infinite;
    }
    [data-card-css] .mari-message-bubble::before {
      content: "✦";
      position: absolute;
      top: 1px;
      right: 7px;
      font-size: 0.7rem;
      color: rgba(220, 38, 120, 0.55);
    }
    [data-card-css] .mari-message-narrator {
      color: #c9a8ff;
      font-style: italic;
    }
  }

  @chat-mode conversation {
    [data-card-css]:not([data-grouped]) {
      border-left: 2px solid rgba(220, 38, 120, 0.35);
    }
    [data-card-css] .mari-message-bubble {
      background: rgba(26, 10, 36, 0.92);
      border: 1px solid rgba(220, 38, 120, 0.4);
      border-radius: 1rem;
    }
    [data-card-css] .mari-typing-text {
      color: #ff5c8a;
      font-style: italic;
    }
    [data-card-css] .mari-typing-dots span {
      background: #ff5c8a;
    }
    [data-card-css].mari-about-me-popout {
      background: radial-gradient(120% 120% at 50% 0%, #241a3a 0%, #12081c 72%);
      border: 1px solid rgba(220, 38, 120, 0.45);
      border-radius: 1.25rem;
    }
    [data-card-css] .mari-about-me-banner {
      background: linear-gradient(90deg, #a855f7, #dc2678);
    }
    [data-card-css] .mari-about-me-name {
      color: #ffd7ef;
    }
  }

  /* Game: in Chat scope, [data-card-css] is the whole game surface */
  @chat-mode game {
    [data-card-css] {
      background-image: radial-gradient(120% 80% at 50% 0%, rgba(58, 10, 46, 0.5), transparent 70%);
    }
  }
</style>
```

## Card CSS बनाने के लिए AI असिस्टेंट का इस्तेमाल

CSS हाथ से लिखने से बचना हो, तो किसी AI असिस्टेंट को यह प्रॉम्प्ट दें। जहाँ निशान लगा है, वहाँ अपने कैरेक्टर की परिकल्पना भर दें।

```text
I'm creating a character card for Marinara Engine (an AI chat app). The card has a
"Creator Notes" field where I can embed <style> blocks. Write CSS that themes the
character's messages.

Character concept: [describe the aesthetic]

Technical constraints:
- Use [data-card-css] for the message row (works in both Exclusive and Chat modes);
  use normal class selectors for things inside it.
- [data-card-css] .mari-message-bubble = the visible bubble (background / border /
  corners / shadow); [data-card-css] .mari-message-content = the text;
  [data-card-css] .mari-message-name = the display name;
  [data-card-css] .mari-message-avatar button = the clickable avatar
  (non-clickable fallback: .mari-message-avatar > div; in roleplay the button sits
  under an extra glow-wrapper div).
- Style the typing indicator via [data-card-css] .mari-typing-text and
  [data-card-css] .mari-typing-dots span.
- Conversation only: the avatar-click "about me" popout is themable via
  [data-card-css].mari-about-me-popout (the card), the banner via
  .mari-about-me-banner, the avatar via .mari-about-me-avatar > div, the name via
  .mari-about-me-name, the box via .mari-about-me-box, and the body via
  .mari-about-me-text. Wrap these in @chat-mode conversation { ... }.
- Wrap roleplay-only CSS in @chat-mode roleplay { ... }, conversation-only in
  @chat-mode conversation { ... }; CSS outside applies everywhere.
- Blocked: url(https://...), @import, :has(), !important, app theme tokens
  (--primary, etc.). position: fixed becomes absolute. Use url(data:...) and
  rgba() colors.
- [data-grouped] marks continuation messages, in Conversation mode ONLY
  (roleplay rows never carry it); there, use
  [data-card-css]:not([data-grouped]) for first-in-group.

Output a single <style> block I can paste into Creator Notes.
```

## मिलती-जुलती गाइड

- [Appearance सेटिंग्स](appearance-settings.md)
- [कस्टम CSS थीम (Theme Library)](custom-css-themes.md)
- [कैरेक्टर बनाना और एडिट करना](../characters/creating-and-editing-characters.md)
