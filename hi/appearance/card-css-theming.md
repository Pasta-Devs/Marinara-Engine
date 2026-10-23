# कार्ड CSS थीमिंग गाइड

इस गाइड में कैरेक्टर और पर्सोना बनाने वालों के लिए बताया गया है कि चैट में कार्ड को अपना अलग लुक कैसे दें। CSS को कार्ड के **Creator Notes** (क्रिएटर नोट्स) में रखा जाता है, और Marinara Engine उसे सुरक्षित तरीके से उसी कैरेक्टर के संदेशों पर लागू करता है। इसका असर सिर्फ़ चैट तक रहता है, बाकी ऐप पर कभी नहीं।

## शुरू करने से पहले

इस गाइड में बार-बार आने वाली कुछ चीज़ों का सीधा मतलब:

- **CSS** वह भाषा है जो किसी वेब पेज के रंग, फ़ॉन्ट, बॉर्डर और स्पेसिंग तय करती है।
- **Card CSS** यानी वह CSS जो आप किसी कैरेक्टर या पर्सोना कार्ड में रखते हैं। यह उसी कार्ड के संदेशों को थीम देती है।
- **Card Theming** (कार्ड थीमिंग) स्क्रीन पर दिखने वाला वह कंट्रोल है जिससे किसी चैट में Card CSS चालू होती है।
- **सिलेक्टर** CSS नियम का वह हिस्सा है जो तय करता है कि स्टाइल किन एलिमेंट पर लगेगी।
- **डिसेंडेंट सिलेक्टर** में स्पेस का मतलब "के अंदर" होता है। `.a .b` उस `.b` से मैच करता है जो किसी `.a` के अंदर बैठा हो।
- **कैस्केड** CSS की वह व्यवस्था है जो तय करती है कि एक ही एलिमेंट पर कई नियम लगने पर कौन सा नियम जीतेगा।
- **लेआउट** यानी संदेश स्क्रीन पर किस तरह सजते हैं। Marinara में एक **Linear** रो लेआउट है और एक **Bubbles** लेआउट।

## क्विक स्टार्ट

कार्ड की थीमिंग दो जगह होती है। पहले कार्ड में CSS जोड़ें। फिर उसे चैट में चालू करें।

1. कैरेक्टर को **Character Editor** (कैरेक्टर एडिटर) में खोलें और **Creator Notes** फ़ील्ड ढूँढें। पर्सोना के लिए यही फ़ील्ड **Persona Editor** (पर्सोना एडिटर) में है।
2. **Creator Notes** में एक `<style>` ब्लॉक पेस्ट करें और कार्ड सेव करें।
3. उसी कैरेक्टर के साथ चैट खोलें।
4. **Chat Settings** (चैट सेटिंग्स) खोलें, फिर **Card Theming** सेक्शन।
5. **Exclusive** या **Chat** चुनें। शुरुआत में मोड **Disabled** पर रहता है।

कैरेक्टर के संदेश तुरंत बदले हुए दिखने चाहिए। **Card Theming** के मोड बटन (Disabled, Exclusive, Chat) तभी दिखते हैं जब उस चैट के किसी सक्रिय कैरेक्टर के **Creator Notes** में CSS मौजूद हो। Roleplay चैट में यह सेक्शन हमेशा मौजूद रहता है, क्योंकि इसमें **Color Character Names in Text** (टेक्स्ट में कैरेक्टर के नाम रंगें) स्विच भी होता है। सिर्फ़ पर्सोना की CSS से बटन नहीं आते। चैट के कम से कम एक कैरेक्टर के पास अपना `<style>` ब्लॉक होना ज़रूरी है। बटन न दिखें तो जाँच लें कि आपका `<style>` ब्लॉक ठीक से सेव हुआ या नहीं।

**Creator Notes** में पेस्ट करने के लिए एक शुरुआती ब्लॉक:

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

इससे कैरेक्टर का नाम गुलाबी चमक लेता है और उसका टेक्स्ट हर लेआउट में हल्का गुलाबी हो जाता है। बबल वाला नियम बैंगनी ग्रेडिएंट और गुलाबी बॉर्डर जोड़ता है। एक बात ध्यान रखें: `.mari-message-bubble` सिर्फ़ **Bubbles** लेआउट में और roleplay में मौजूद होता है। Conversation का डिफ़ॉल्ट लेआउट **Linear** है, जिसमें बबल एलिमेंट होता ही नहीं, इसलिए वहाँ बबल वाला नियम कुछ नहीं करता। नीचे "Bubbles और Linear की तुलना" वाले नोट में यह फ़र्क समझाया गया है।

**जाँच का पक्का तरीका:** एक ऐसा टेस्ट जिसमें शक की गुंजाइश न हो, उसके लिए नीचे वाला नियम इस्तेमाल करें। यह संदेश के टेक्स्ट को टारगेट करता है, जो हर मोड और हर लेआउट में रहता है। टेक्स्ट का बैकग्राउंड फ़ौरन चटख गुलाबी हो जाना चाहिए।

```css
[data-card-css] .mari-message-content {
  background: hotpink;
}
```

## Card Theming कैसे काम करता है

जब ऐसा कैरेक्टर सक्रिय हो जिसके **Creator Notes** में CSS है, तो Marinara चार काम करता है:

1. **Creator Notes** से हर `<style>` ब्लॉक पढ़ता है।
2. CSS को साफ़ करके हर खतरनाक चीज़ हटा देता है। नीचे "किन चीज़ों को स्टाइल नहीं कर सकते" वाला सेक्शन देखें।
3. CSS का स्कोप ऐसा बनाता है कि उसकी पहुँच सिर्फ़ चैट तक रहे।
4. CSS को इस तरह जोड़ता है कि उसके स्कोप वाले सिलेक्टर ऐप की अपनी संदेश स्टाइलिंग पर भारी पड़ें।

यह हर चैट में कैसे लागू हो, यह **Chat Settings** और फिर **Card Theming** में चुना जाता है। तीन मोड हैं।

| मोड | क्या करता है |
| --- | --- |
| **Disabled** (डिफ़ॉल्ट) | Card CSS बंद रहती है, इसलिए कैरेक्टर की कोई स्टाइलिंग नहीं लगती। |
| **Exclusive** | हर कैरेक्टर की CSS सिर्फ़ उसी के संदेशों पर असर करती है। |
| **Chat** | सारी कार्ड CSS पूरे चैट एरिया पर असर करती है, UI एलिमेंट समेत। |

ग्रुप चैट में, जहाँ हर कैरेक्टर का अपना लुक हो, **Exclusive** इस्तेमाल करें। एक ही कैरेक्टर वाली चैट में, जहाँ कार्ड को पूरी चैट की सतह थीम करनी हो, **Chat** इस्तेमाल करें।

## स्कोपिंग का वह एक नियम जो सबसे ज़रूरी है

Marinara आपकी CSS को दोबारा लिखता है ताकि उसकी पहुँच सिर्फ़ चैट तक रहे। वह कैसे लिखी जाती है, यह मोड पर निर्भर करता है।

- **Chat** मोड हर चीज़ का स्कोप चैट एरिया के अंदर कर देता है। `.mari-message-bubble` सामान्य रूप से मैच करता है, क्योंकि वह इसी एरिया के अंदर बैठा है।
- **Exclusive** मोड हर चीज़ का स्कोप आपके कैरेक्टर के अपने संदेश एलिमेंट के अंदर कर देता है। उन्हीं पर `data-card-css` लगा होता है। उसी एलिमेंट पर लगी कोई क्लास उससे डिसेंडेंट की तरह मैच नहीं कर सकती। सिर्फ़ उसके अंदर की चीज़ें मैच करती हैं।

तो नियम यह रहा, जो हर जगह चलता है। संदेश एलिमेंट को खुद स्टाइल करने के लिए `[data-card-css]` इस्तेमाल करें। उसके अंदर की हर चीज़ के लिए सामान्य क्लास सिलेक्टर इस्तेमाल करें, जैसे `.mari-message-bubble`, `.mari-message-content` और `.mari-message-name`।

`[data-card-css]` का मतलब **Exclusive** मोड में "इस कैरेक्टर का संदेश" है और **Chat** मोड में "चैट एरिया"। यह दोनों में चलता है। अंदर के एलिमेंट वाले सिलेक्टर (जिनमें स्पेस होता है) दोनों मोड में एक जैसे ही काम करते हैं।

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

## @chat-mode से किसी एक मोड को टारगेट करना

किसी एक सतह को टारगेट करना हो तो नियमों को `@chat-mode` ब्लॉक में लपेट दें। किसी भी ब्लॉक से बाहर लिखी CSS हर जगह लगती है।

```html
<style>
  /* Applies in ALL modes */
  [data-card-css] .mari-message-name {
    color: #00ff95;
  }

  /* Only in Roleplay mode */
  @chat-mode roleplay {
    [data-card-css] .mari-message-bubble {
      border: 1px solid rgba(0, 255, 149, 0.4);
      box-shadow: 0 0 16px rgba(0, 255, 149, 0.25);
    }
  }

  /* Only in Conversation mode */
  @chat-mode conversation {
    [data-card-css] .mari-message-bubble {
      background: rgba(0, 40, 28, 0.9);
      border-radius: 1rem;
    }
  }
</style>
```

सामान्य `@media` क्वेरी `@chat-mode` ब्लॉक के अंदर ठीक वैसे ही चलती हैं। रिस्पॉन्सिव लेआउट के लिए उन्हीं का इस्तेमाल करें।

**Game Mode** में बुनियादी सपोर्ट है। **Chat** मोड में कार्ड CSS पूरी गेम सतह तक पहुँचती है। यानी `[data-card-css]` गेम एरिया को थीम देता है, और `@chat-mode game` उसे टारगेट करता है। Game का लेआउट अपना अलग है। ऊपर बताए संदेश-बबल वाले हुक वहाँ होते ही नहीं, इसलिए मोटे तौर पर टारगेट करें, जैसे एरिया का बैकग्राउंड। गेम नैरेशन की प्रति-कैरेक्टर (Exclusive) स्टाइलिंग अभी उपलब्ध नहीं है।

## किन चीज़ों को स्टाइल कर सकते हैं

चैट का ढाँचा Roleplay और Conversation, दोनों में एक ही है। कार्ड CSS इन एलिमेंट को टारगेट कर सकती है। ऐप की अंदरूनी यूटिलिटी क्लास भरोसेमंद हुक नहीं हैं। वे वर्ज़न के साथ बदलती रहती हैं, इसलिए नीचे दी गई `mari-*` क्लास और `data-*` एट्रिब्यूट पर ही टिके रहें।

| सिलेक्टर | किसे टारगेट करता है |
| --- | --- |
| `[data-card-css]` | पूरी संदेश रो (स्कोप एलिमेंट)। बाईं या किनारे की एक्सेंट लाइन के लिए अच्छा है, और **Chat** मोड में यह चैट एरिया है। |
| `[data-card-css] .mari-message-bubble` | दिखने वाला बबल: बैकग्राउंड, बॉर्डर, कोने, शैडो। **Bubbles** लेआउट में और roleplay में मौजूद रहता है। |
| `[data-card-css] .mari-message-content` | **Bubbles** में खुद बबल एलिमेंट, बैकग्राउंड, बॉर्डर और कोनों समेत। **Linear** में सिर्फ़ संदेश का टेक्स्ट। |
| `[data-card-css] .mari-message-name` | कैरेक्टर का दिखने वाला नाम। |
| `[data-card-css] .mari-message-meta` | ऊपर की वह रो जिसमें नाम और टाइमस्टैंप रहते हैं। |
| `[data-card-css] .mari-message-timestamp` | टाइमस्टैंप। |
| `[data-card-css] .mari-message-avatar` | अवतार वाला कॉलम। |
| `[data-card-css] .mari-message-narrator` | नैरेटर के संदेश (roleplay)। |
| `[data-card-css] .mari-message-user` | आपके अपने संदेश। कैरेक्टर के संदेशों के लिए `.mari-message-assistant` इस्तेमाल करें। |
| `[data-card-css] p`, `... span` | टेक्स्ट के अंदर के पैराग्राफ़ और इनलाइन स्पैन। |
| `[data-grouped]` | उसी कैरेक्टर के लगातार आगे बढ़ते संदेश। सिर्फ़ Conversation मोड में; roleplay की रो पर यह कभी नहीं आता। किसी समूह के पहले संदेश के लिए `[data-card-css]:not([data-grouped])` इस्तेमाल करें। |

**Bubbles और Linear की तुलना।** `.mari-message-bubble` जिसे टारगेट करता है, वह **Bubbles** लेआउट है। **Linear** लेआउट में बबल एलिमेंट होता ही नहीं, इसलिए वहाँ `.mari-message-content` (टेक्स्ट) और `[data-card-css]` (रो) को स्टाइल करें। लेआउट बदलने के लिए **Settings** (सेटिंग्स), फिर **Appearance** (अपीयरेंस), फिर **Conversation Display** (Conversation की डिस्प्ले सेटिंग्स) सेक्शन, फिर **Chat Layout** (चैट लेआउट) पर जाएँ। Roleplay में बबल हमेशा रहता है।

conversation या roleplay का एक स्टाइल किया हुआ बबल इस तरह बनता है:

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

जब कोई कैरेक्टर जवाब लिख रहा होता है, तब Conversation का **Linear** लेआउट "(name) is typing..." वाली एक रो दिखाता है। इसे भी स्टाइल कर सकते हैं।

| सिलेक्टर | किसे टारगेट करता है |
| --- | --- |
| `[data-card-css] .mari-typing-text` | "(name) is typing..." वाला लेबल। |
| `[data-card-css] .mari-typing-dots span` | चलती हुई बिंदियाँ। |
| `[data-card-css] .mari-typing-indicator` | खुद वह रो। इस पर नाम `data-typing-name` के रूप में भी रहता है। |

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

अवतार यानी कैरेक्टर की प्रोफ़ाइल इमेज, जो डिफ़ॉल्ट रूप से गोल होती है। सिर्फ़ CSS से इसका आकार बदल सकते हैं और इसके चारों ओर रिंग लगा सकते हैं। नीचे के उदाहरण उस अवतार बटन को टारगेट करते हैं जिस पर क्लिक हो सकता है। अगर किसी सतह पर अवतार बिना क्लिक वाला दिखता है, तो उसी लेआउट के लिए यही तरीका `.mari-message-avatar > div` फ़ॉलबैक पर अपनाएँ। roleplay में यह बटन एक अतिरिक्त ग्लो-रैपर `div` के अंदर बैठता है। सिर्फ़ अपनी रिंग दिखानी हो तो उस रैपर को सपाट कर दें।

```css
[data-card-css] .mari-message-avatar button {
  border-radius: 6px; /* 0 for sharp corners, 50% for a circle */
  box-shadow: 0 0 0 2px #ff66cc;
}
/* roleplay only: drop the app glow wrapper so just your ring shows */
@chat-mode roleplay {
  [data-card-css] .mari-message-avatar > div {
    box-shadow: none;
  }
}
```

### About Me प्रोफ़ाइल पॉपआउट (सिर्फ़ Conversation में)

Conversation मोड में अवतार पर क्लिक करने से एक प्रोफ़ाइल पॉपआउट खुलता है, जिसमें कैरेक्टर या पर्सोना का "about me" दिखता है। इसे भी उसी `[data-card-css]` स्कोप से थीम कर सकते हैं। यह पॉपआउट सिर्फ़ Conversation मोड में होता है। roleplay या game में यह नहीं होता। अगर आप roleplay या game की CSS भी दे रहे हैं, तो इन नियमों को `@chat-mode conversation` में लपेट दें। कैरेक्टर कार्ड और पर्सोना, दोनों अपने **Creator Notes** से अपना पॉपआउट थीम कर सकते हैं।

पर्सोना के लिए एक बात ध्यान रखें: **Card Theming** के मोड बटन तभी दिखते हैं जब चैट के किसी सक्रिय कैरेक्टर के **Creator Notes** में CSS हो। सिर्फ़ पर्सोना वाली CSS से वे नहीं आते। यानी पर्सोना के पॉपआउट की थीम चलाने के लिए चैट के कम से कम एक कैरेक्टर के पास भी `<style>` ब्लॉक होना चाहिए।

| सिलेक्टर | किसे टारगेट करता है |
| --- | --- |
| `[data-card-css].mari-about-me-popout` | खुद पॉपआउट कार्ड (स्कोप एलिमेंट): बैकग्राउंड, बॉर्डर, आकार। |
| `[data-card-css] .mari-about-me-banner` | ऊपर की बैनर पट्टी (डिफ़ॉल्ट रूप से नाम वाला रंग लेती है)। |
| `[data-card-css] .mari-about-me-avatar` | बड़े अवतार का रैपर। गोले के लिए `... > div` इस्तेमाल करें। |
| `[data-card-css] .mari-about-me-status` | प्रेज़ेंस स्टेटस वाली बिंदी (सिर्फ़ कैरेक्टर के लिए)। |
| `[data-card-css] .mari-about-me-name` | दिखने वाले नाम का शीर्षक। |
| `[data-card-css] .mari-about-me-handle` | दूसरी पंक्ति वाला @name (तब दिखता है जब Convo का दिखने वाला नाम अलग हो)। |
| `[data-card-css] .mari-about-me-presence` | स्टेटस या गतिविधि वाली पंक्ति (सिर्फ़ कैरेक्टर के लिए)। |
| `[data-card-css] .mari-about-me-box` | About Me का कंटेनर बॉक्स। |
| `[data-card-css] .mari-about-me-label` | "ABOUT ME" वाला कैप्शन। |
| `[data-card-css] .mari-about-me-badge` | Default या Chat-specific वाली गोली। |
| `[data-card-css] .mari-about-me-text` | about-me का रेंडर हुआ मुख्य टेक्स्ट। |

पॉपआउट कार्ड ही स्कोप एलिमेंट है। इसे `[data-card-css].mari-about-me-popout` से टारगेट करें (बिना स्पेस, एक ही एलिमेंट)। इसके अंदर की चीज़ों को डिसेंडेंट सिलेक्टर से टारगेट करें, जैसे `[data-card-css] .mari-about-me-name`। **Chat** मोड में पूरा एरिया स्कोप में होता है, इसलिए वहाँ सीधे `.mari-about-me-name` भी चल जाता है।

एक थीम किया हुआ "about me" पॉपआउट इस तरह बनता है। इसे किसी कैरेक्टर या पर्सोना के **Creator Notes** में पेस्ट करें, फिर **Chat Settings** में **Card Theming** चालू करें। पर्सोना में पेस्ट कर रहे हैं तो ऊपर वाली बात याद रखें। चैट के किसी कैरेक्टर के **Creator Notes** में भी CSS होनी चाहिए, वरना मोड बटन छिपे ही रहेंगे।

```html
<style>
@chat-mode conversation {
  [data-card-css].mari-about-me-popout {
    background: radial-gradient(120% 120% at 50% 0%, #241a3a 0%, #14101f 70%);
    border: 1px solid rgba(180, 120, 255, 0.45);
    border-radius: 1.25rem;
  }
  [data-card-css] .mari-about-me-banner {
    background: linear-gradient(90deg, #b478ff, #ff77c6);
  }
  [data-card-css] .mari-about-me-avatar > div {
    border-radius: 0.9rem; /* squircle avatar */
    box-shadow: 0 0 0 2px #b478ff;
  }
  [data-card-css] .mari-about-me-name {
    color: #e9d8ff;
    text-shadow: 0 0 10px rgba(180, 120, 255, 0.6);
  }
  [data-card-css] .mari-about-me-box {
    background: rgba(180, 120, 255, 0.08);
    border: 1px solid rgba(180, 120, 255, 0.25);
    border-radius: 0.75rem;
  }
  [data-card-css] .mari-about-me-label {
    color: #b478ff;
    letter-spacing: 0.12em;
  }
  [data-card-css] .mari-about-me-text {
    font-family: Georgia, serif;
    color: #f2e9ff;
  }
}
</style>
```

## किन चीज़ों को स्टाइल नहीं कर सकते

सुरक्षा के लिए सैनिटाइज़र इन चीज़ों को हटा देता है।

| हटाया जाता है | वजह |
| --- | --- |
| `url(https://...)` | कोई नेटवर्क रिक्वेस्ट नहीं, ताकि ट्रैकिंग और डेटा लीक न हो। सिर्फ़ `url(data:...)` चलता है, इनलाइन इमेज और फ़ॉन्ट के लिए। |
| बाहरी URL वाला `@font-face` | सिर्फ़ `data:` वाले फ़ॉन्ट सोर्स रखे जाते हैं। फ़ैमिली का नाम अपने आप बदल दिया जाता है, ताकि वह ऐप के फ़ॉन्ट पर हावी न हो सके। |
| `@import` | बाहर की स्टाइलशीट लोड नहीं हो सकतीं। |
| `:has()` सिलेक्टर | चैट से बाहर के एलिमेंट टटोल नहीं सकते। |
| नेस्टेड नियम और `~` या `+` से शुरू होने वाले सिलेक्टर | हटा दिए जाते हैं, ताकि कार्ड CSS अपने स्कोप से बाहर न पहुँच सके। इन्हें सामान्य सिलेक्टर की तरह लिखें। |
| `content:` में HTML | सजावटी टेक्स्ट चलता है, पर `<` और `>` हटा दिए जाते हैं और टेक्स्ट 200 अक्षरों तक सीमित रहता है। `attr()` और `counter()` चलते हैं। |
| `position: fixed` | इसे `position: absolute` में बदल दिया जाता है, ताकि पूरी स्क्रीन ढकने वाला ओवरले न बन सके। |
| `!important` | हटा दिया जाता है, ताकि कार्ड CSS ऐप की स्टाइल पर ज़बरदस्ती हावी न हो सके। |
| ऐप की थीम के टोकन | `--primary` और `--background` जैसे टोकन हटा दिए जाते हैं, ताकि कार्ड CSS ऐप के UI का रंग-रूप न बदल सके। |

कार्ड CSS ऐसे स्कोप वाले सिलेक्टर के साथ जोड़ी जाती है जो ऐप की अपनी संदेश स्टाइल से ऊपर रहते हैं। चैट के अंदर रंग, बैकग्राउंड, बॉर्डर और फ़ॉन्ट के मामले में यही जीतती है। यह सिर्फ़ तीन चीज़ों से नहीं जीत सकती: जो सैनिटाइज़र हटा देता है, जो चैट से बाहर है, और वे स्टाइल जो ऐप इनलाइन या `!important` के साथ लगाता है। **Settings** में सेट किया गया आपकी पूरी चैट का फ़ॉन्ट रंग और साइज़ इसी का एक उदाहरण है।

**कस्टम फ़ॉन्ट।** फ़ॉन्ट को base64 `data:` URI के रूप में रखें, या सिस्टम या वेब-सेफ़ फ़ॉन्ट स्टैक इस्तेमाल करें।

```css
@font-face {
  font-family: "MyFont";
  src: url(data:font/woff2;base64,d09GMgAB...) format("woff2");
}
```

```css
font-family: "Courier New", Consolas, monospace;
```

## Exclusive और Chat की तुलना: स्कोप कैसे चुनें

- **Exclusive** में `[data-card-css]` का मतलब इसी कैरेक्टर के संदेश होता है। ग्रुप चैट और हर कैरेक्टर की अलग पहचान के लिए यही सबसे अच्छा है। संदेश के अंदर के एलिमेंट को टारगेट करने वाली CSS वैसे ही चलती है जैसे **Chat** मोड में।
- **Chat** में `[data-card-css]` का मतलब पूरा चैट एरिया होता है। जिन एक-से-एक कार्ड को सिर्फ़ संदेश बबल नहीं, बल्कि बैकग्राउंड या माहौल थीम करना है, उनके लिए यही सबसे अच्छा है।

`[data-card-css] .mari-message-...` वाले सिलेक्टर से बनाएँ, तो आपका कार्ड दोनों मोड में ठीक चलेगा।

## टिप्स

1. बबल को `.mari-message-bubble` से स्टाइल करें, `[data-card-css]` से नहीं। दूसरा वाला पूरी चौड़ाई की रो है, इसलिए उस पर लगा बैकग्राउंड ज़्यादातर दिखता ही नहीं।
2. `rgba()` वाले रंग इस्तेमाल करें, ताकि हल्की और गहरी दोनों थीम पर घुल-मिल जाएँ।
3. एनिमेशन हल्के रखें। कम ताकत वाले डिवाइस पर भारी `animation` की जगह `transition` बेहतर है।
4. फ़ोन के लिए `@media (max-width: 768px)` इस्तेमाल करें।
5. यूटिलिटी क्लास पर निर्भर न रहें। सिर्फ़ डॉक्यूमेंटेशन में दिए गए `mari-*` हुक ही भरोसेमंद हैं।

## शोकेस: Eldritch Grimoire

यह जान-बूझकर बहुत भड़कीला बनाया गया कार्ड है। यह हर मोड में, डॉक्यूमेंटेशन में दिए गए हर हुक को छूता है। इसमें दिखता है:

- चमकते रून जैसे बड़े अक्षरों वाले नाम और थीम किया हुआ सेरिफ़ टेक्स्ट
- आकार बदला और रिंग लगा हुआ अवतार, साथ में स्मॉल-कैप्स टाइमस्टैंप
- संदेश रो के किनारे पर एक सिजिल
- कोने में रून वाला एनिमेटेड roleplay बबल, और स्टाइल किया हुआ नैरेशन
- Conversation का बबल और एक रहस्यमय टाइपिंग इंडिकेटर
- अवतार पर क्लिक से खुलने वाला प्रोफ़ाइल पॉपआउट, पूरी तरह थीम किया हुआ
- गेम की सतह

इसे पूरा का पूरा **Creator Notes** में पेस्ट करें, फिर **Chat Settings** में **Card Theming** चालू करें। यह Roleplay और Conversation, दोनों के संदेशों को थीम देता है, Conversation में पॉपआउट को, और Game में सतह को (गेम के लिए मोड **Chat** पर सेट करें)। हिस्से `@chat-mode` से बँटे हैं, ताकि हर मोड को ठीक वही हुक मिलें जो उसमें मौजूद हैं। सब कुछ सैनिटाइज़र के हिसाब से सुरक्षित है।

```html
<style>
  /* shared keyframe. Animate OPACITY, never box-shadow: box-shadow is a "paint"
     property, so animating it repaints and re-blurs the whole element every frame
     (which pins weak GPUs). Animating a layer's opacity is GPU-composited and cheap. */
  @keyframes grimoire-pulse {
    0%,
    100% {
      opacity: 0.35;
    }
    50% {
      opacity: 1;
    }
  }

  /* EVERYWHERE (all modes). */
  /* These descendant hooks only match where message rows exist, so they are inert
     in Game and safe to leave unwrapped. */

  /* the character name, glowing crimson rune-caps */
  [data-card-css] .mari-message-name {
    color: #ff5c8a;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-size: 0.82rem;
    text-shadow: 0 0 8px rgba(255, 92, 138, 0.7), 0 0 16px rgba(168, 85, 247, 0.45);
  }
  /* header row and timestamp */
  [data-card-css] .mari-message-meta {
    align-items: baseline;
  }
  [data-card-css] .mari-message-timestamp {
    color: rgba(243, 215, 255, 0.5);
    font-variant: small-caps;
  }
  /* reshape, ring, and saturate the clickable avatar. For a non-clickable avatar,
     target .mari-message-avatar > div for that layout. */
  [data-card-css] .mari-message-avatar button {
    border-radius: 7px;
    box-shadow: 0 0 0 2px rgba(220, 38, 120, 0.6), 0 0 14px rgba(168, 85, 247, 0.5);
    filter: saturate(1.2) contrast(1.05);
  }
  /* glowing serif message text */
  [data-card-css] .mari-message-content {
    color: #f3d7ff;
    text-shadow: 0 0 2px rgba(168, 85, 247, 0.4);
    font-family: "Iowan Old Style", Georgia, "Times New Roman", serif;
  }

  /* ROLEPLAY */
  @chat-mode roleplay {
    /* the row itself, an arcane left edge. (data-grouped does not exist in
       roleplay, so there is no first-of-run trick here.) */
    [data-card-css] {
      border-left: 2px solid rgba(220, 38, 120, 0.35);
    }
    /* roleplay wraps the avatar button in its own glow layer. Flatten it
       so only the eldritch ring above hugs the picture. */
    [data-card-css] .mari-message-avatar > div {
      box-shadow: none;
    }
    /* the visible bubble and a corner sigil */
    [data-card-css] .mari-message-bubble {
      background: linear-gradient(135deg, #1a0a24 0%, #2d0a2e 55%, #3a0a1e 100%);
      border: 1px solid rgba(220, 38, 120, 0.45);
      border-radius: 4px 16px 16px 16px;
      position: relative;
      overflow: hidden;
      /* a steady outer halo. An element's own box-shadow is not clipped by its own
         overflow: hidden, so this bloom shows even though message content is clipped.
         (No inset here: the pulsing inset glow lives on the ::after, so a static inset
         would stack with it and over-brighten the inner glow.) */
      box-shadow: 0 0 16px rgba(190, 70, 190, 0.4);
    }
    /* the breathing inner glow. Animate a full-bleed overlay's OPACITY (cheap, GPU
       composited) instead of the bubble's box-shadow (expensive: a full repaint every
       frame). overflow: hidden clips a child's OUTER shadow, so the pulse rides the inset
       glow while the halo above stays steady. pointer-events keeps it click-through. */
    [data-card-css] .mari-message-bubble::after {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      box-shadow: inset 0 0 26px rgba(120, 0, 80, 0.65);
      animation: grimoire-pulse 4s ease-in-out infinite;
      will-change: opacity;
    }
    [data-card-css] .mari-message-bubble::before {
      content: "✦";
      position: absolute;
      top: 1px;
      right: 7px;
      font-size: 0.7rem;
      color: rgba(220, 38, 120, 0.55);
      text-shadow: 0 0 6px rgba(220, 38, 120, 0.9);
    }
    /* narration */
    [data-card-css] .mari-message-narrator {
      color: #c9a8ff;
      font-style: italic;
      opacity: 0.9;
    }
  }

  /* CONVERSATION */
  @chat-mode conversation {
    /* an arcane left edge on the first message of a run. [data-grouped] marks
       continuations from the same character, and it exists only in
       Conversation mode. */
    [data-card-css]:not([data-grouped]) {
      border-left: 2px solid rgba(220, 38, 120, 0.35);
    }
    [data-card-css][data-grouped] {
      border-left: 2px solid transparent;
    }
    /* the Bubbles-layout bubble. In the Linear layout there is no bubble, so
       the EVERYWHERE row hooks above carry the theme instead. */
    [data-card-css] .mari-message-bubble {
      background: rgba(26, 10, 36, 0.92);
      border: 1px solid rgba(220, 38, 120, 0.4);
      border-radius: 1rem;
    }
    /* "(name) is typing..." (Linear layout) */
    [data-card-css] .mari-typing-text {
      color: #ff5c8a;
      font-style: italic;
      letter-spacing: 0.05em;
      text-shadow: 0 0 8px rgba(255, 92, 138, 0.6);
    }
    [data-card-css] .mari-typing-dots span {
      background: #ff5c8a;
      box-shadow: 0 0 6px rgba(255, 92, 138, 0.85);
    }

    /* the avatar-click profile popout. The popout card is the scope element,
       so target it with no space, and its children as descendants. */
    [data-card-css].mari-about-me-popout {
      background: radial-gradient(120% 120% at 50% 0%, #241a3a 0%, #12081c 72%);
      border: 1px solid rgba(220, 38, 120, 0.45);
      border-radius: 1.25rem;
    }
    [data-card-css] .mari-about-me-banner {
      background: linear-gradient(90deg, #a855f7, #dc2678);
    }
    [data-card-css] .mari-about-me-avatar > div {
      border-radius: 0.9rem;
      box-shadow: 0 0 0 2px #dc2678, 0 0 14px rgba(168, 85, 247, 0.5);
    }
    [data-card-css] .mari-about-me-status {
      box-shadow: 0 0 8px rgba(255, 92, 138, 0.9);
    }
    [data-card-css] .mari-about-me-name {
      color: #ffd7ef;
      text-shadow: 0 0 10px rgba(220, 38, 120, 0.6);
    }
    [data-card-css] .mari-about-me-handle {
      color: rgba(201, 168, 255, 0.8);
    }
    [data-card-css] .mari-about-me-presence {
      color: rgba(201, 168, 255, 0.7);
    }
    [data-card-css] .mari-about-me-box {
      background: rgba(168, 85, 247, 0.08);
      border: 1px solid rgba(220, 38, 120, 0.3);
      border-radius: 0.75rem;
    }
    [data-card-css] .mari-about-me-label {
      color: #dc2678;
      letter-spacing: 0.14em;
    }
    [data-card-css] .mari-about-me-badge {
      background: rgba(220, 38, 120, 0.18);
      color: #ffd7ef;
    }
    [data-card-css] .mari-about-me-text {
      color: #f3d7ff;
      font-family: "Iowan Old Style", Georgia, serif;
    }
  }

  /* GAME (set the mode to Chat) */
  @chat-mode game {
    /* Game has its own layout with no message bubbles. In Chat scope,
       [data-card-css] is the whole game surface, so theme the area broadly. */
    [data-card-css] {
      background-image: radial-gradient(120% 80% at 50% 0%, rgba(58, 10, 46, 0.5), transparent 70%);
    }
  }
</style>
```

**आपकी रो और कैरेक्टर की रो की तुलना।** **Exclusive** स्कोप में `[data-card-css]` कैरेक्टर का अपना संदेश होता है, जो `.mari-message-assistant` भी है। अपनी रो को भी थीम करना हो तो **Chat** स्कोप इस्तेमाल करें। वहाँ `[data-card-css]` पूरा एरिया होता है, और `[data-card-css] .mari-message-user` तथा `.mari-message-assistant` दोनों तरफ़ की रो अलग-अलग चुनते हैं।

रंग, `content` वाला ग्लिफ़ और फ़ॉन्ट बदलकर इसे अपने हिसाब से ढाल लें।

## Card CSS बनाने के लिए AI असिस्टेंट का इस्तेमाल

CSS खुद हाथ से लिखने का मन न हो तो किसी AI असिस्टेंट को यह प्रॉम्प्ट दें। जहाँ निशान लगा है, वहाँ अपने कैरेक्टर की परिकल्पना भर दें।

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
