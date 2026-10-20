# Noodle प्रॉम्प्ट इंटरनल्स (डेवलपर्स)

डेवलपर रेफ़रेंस: Noodle के जेनरेशन प्रॉम्प्ट कोड में कहाँ रहते हैं, उन्हें कैसे बदला जाता है, और फ़ाइनल प्रॉम्प्ट को कैसे डीबग करें। रोज़ाना इस्तेमाल के लिए Noodle को उसके **Settings** (सेटिंग्स) पैनल से सेट किया जाता है; इसकी गाइड `docs/noodle/` में हैं।

Noodle एक डाउनलोड होने वाला पैकेज है। इसके रूट (`/api/noodle`, जो पैकेज के एक्टिवेट होने पर रजिस्टर होते हैं) और इसका जेनरेशन कोड [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) के Noodle पैकेज में, `packages/noodle/src/engine/packages/server/src/` के नीचे रहते हैं। नीचे की तालिका में **package** से चिह्नित सोर्स इसी फ़ोल्डर के सापेक्ष है। Engine के पास साझा Noodle स्कीमा और टाइप, Noodle स्टोरेज, Settings में दिखने वाले रजिस्टर किए हुए प्रॉम्प्ट ओवरराइड, और `packages/server/src/services/noodle/noodle-prompt.ts` में टाइमलाइन प्रॉम्प्ट का डिफ़ॉल्ट टेक्स्ट रहता है। पैकेज `services/prompt-overrides/registry/noodle.ts` और `services/noodle/noodle-prompt.ts` की अपनी कॉपी रखता है।

## प्रॉम्प्ट का सोर्स मैप

Noodle में एक जोड़कर बनाया गया टाइमलाइन प्रॉम्प्ट, एक इनलाइन प्रोफ़ाइल प्रॉम्प्ट और तीन रजिस्टर किए हुए प्रॉम्प्ट ओवरराइड हैं: दो टाइमलाइन के सिस्टम प्रॉम्प्ट के लिए और एक पोस्ट इमेज के लिए।

| मकसद | सोर्स | मुख्य सिंबल | कैसे बदलें |
| --- | --- | --- | --- |
| टाइमलाइन पोस्ट, रिप्लाई, फ़ॉलो, पोल, वोट और डाइजेस्ट | **package** `services/noodle/noodle-public-prompt.service.ts` | `buildRefreshPrompt()` | सिस्टम संदेश में पहले **Noodle Timeline Prompt** ओवरराइड और फिर **Noodle Timeline Voice & Tone** ओवरराइड आता है (दोनों नीचे)। दोनों यूज़र संदेश, कॉन्टेक्स्ट (अकाउंट, पर्सोना, प्रोफ़ाइल, शेड्यूल, लोर, ऑप्ट-इन चैट कॉन्टेक्स्ट, टाइमलाइन, चालू फ़ीचर और कोटा) और `# JSON Output Format` संदेश कोड में जोड़े जाते हैं। |
| टाइमलाइन का बेस सिस्टम प्रॉम्प्ट | `packages/server/src/services/prompt-overrides/registry/noodle.ts` | `NOODLE_TIMELINE_BASE` (`noodle.timelineBase`) | **Settings -> Generations -> Image Generation Prompt Overrides -> Noodle Timeline Prompt** में बदलाव करें, या कोड में `noodle-prompt.ts` का `NOODLE_TIMELINE_BASE_DEFAULT_PROMPT` बदलें। डिफ़ॉल्ट में एडल्ट-प्लेटफ़ॉर्म, पर्सोना की लेखकी, इंटरैक्शन और JSON के नियम होते हैं, इसलिए दोबारा लिखने पर `noodleGeneratedRefreshSchema` की पार्सिंग टूट सकती है। |
| टाइमलाइन के वॉइस/टोन निर्देश (बेस के बाद जोड़े जाते हैं) | `packages/server/src/services/prompt-overrides/registry/noodle.ts` | `NOODLE_TIMELINE_VOICE` (`noodle.timelineVoice`) | **Settings -> Generations -> Image Generation Prompt Overrides -> Noodle Timeline Voice & Tone** में बदलाव करें, या कोड में रजिस्टर किया हुआ डिफ़ॉल्ट (`noodle-prompt.ts` में `noodleTimelineVoiceDefaultText(enhanced, allowRandomUsers)`) बदलें। बिना बदला हुआ डिफ़ॉल्ट Noodle सेटिंग `enableEnhancedTimelineWriting` (`ctx.enhanced`, डिफ़ॉल्ट रूप से बंद, जिसमें वही पुराना एक-पंक्ति वाला टोन निर्देश मिलता है) और इस बात के मुताबिक चलता है कि रैंडम यूज़र की इजाज़त है या नहीं; अपना ओवरराइड टेक्स्ट सेव करने के बाद उसी की चलती है, चाहे ये सेटिंग्स कुछ भी हों। |
| कैरेक्टर अकाउंट की पहली बार बनने वाली प्रोफ़ाइल | **package** `services/noodle/noodle-public-profiles.service.ts` | `generateMissingNoodleProfiles()` | कोड में इनलाइन सिस्टम और यूज़र संदेश बदलें। पहले पार्टिसिपेंट चुने जाते हैं, और इस प्रॉम्प्ट तक सिर्फ़ वही चुने हुए कैरेक्टर अकाउंट पहुँचते हैं जिनमें `profileGenerated` नहीं है। |
| जेनरेट होने वाली पोस्ट इमेज का प्रॉम्प्ट | `packages/server/src/services/prompt-overrides/registry/noodle.ts` | `NOODLE_IMAGE_POST` (`noodle.imagePost`) | **Settings -> Generations -> Image Generation Prompt Overrides -> Noodle Post Image** में बदलाव करें, या कोड में रजिस्टर किया हुआ डिफ़ॉल्ट बदलें। |
| Noodle के अपने डिफ़ॉल्ट इमेज निर्देश | `packages/shared/src/schemas/noodle.schema.ts` | `DEFAULT_NOODLE_SETTINGS.imageGenerationPrompt` | UI में Noodle सेटिंग बदलें, या कोड में उसका स्कीमा डिफ़ॉल्ट बदलें। |
| टाइमलाइन जेनरेशन में जोड़ा जाने वाला ऑप्ट-इन चैट कॉन्टेक्स्ट | **package** `services/noodle/noodle-public-prompt.service.ts` | `buildOptedInChatContext()` | कोड में कॉन्टेक्स्ट जोड़ने का तरीका बदलें; ऑप्ट-इन का फ़ैसला हर चैट की अपनी सेटिंग्स में ही रहता है। |
| टाइमलाइन पोस्ट और रिप्लाई के इमेज इनपुट | **package** `services/noodle/noodle-vision.ts` | `prepareNoodleVisionAttachments()` | कोड में इमेज चुनने, नॉर्मलाइज़ करने, सीमाएँ तय करने या सिर्फ़-टेक्स्ट वाले कंपैटिबिलिटी फ़ॉलबैक का तरीका बदलें। |
| चैट प्रॉम्प्ट में जोड़ी जाने वाली Noodle गतिविधि | **package** `services/noodle/noodle-context.ts` | `buildRecentSocialMediaActivityBlock()` | पैकेज इसे `noodle:prompt-context` सर्विस के रूप में रजिस्टर करता है। कोड में फ़िल्टरिंग या ब्लॉक बनाने का तरीका बदलें; टारगेट मोड और आइटम की सीमा Noodle Settings से तय होती है, जबकि पूरे ब्लॉक पर 8,192 टोकन की पक्की सीमा लगी रहती है। |
| जेनरेट होने वाला JSON कॉन्ट्रैक्ट | `packages/shared/src/schemas/noodle.schema.ts` | `noodleGeneratedRefreshSchema` | इसे सिर्फ़ प्रॉम्प्ट, रूट प्रोसेसिंग, शेयर्ड टाइप और रिग्रेशन कवरेज के साथ मिलाकर ही बदलें। |
| टाइमलाइन जेनरेशन में जोड़ा जाने वाला लोरबुक का वर्ल्ड/लोर कॉन्टेक्स्ट | **package** `services/noodle/noodle-public-prompt.service.ts` | `buildRefreshPrompt()` (`processLorebooks()` को कॉल करता है) | यह **Lorebook context** नाम की Noodle सेटिंग (`enableLorebookContext`, डिफ़ॉल्ट रूप से बंद) से चलता है। यह वही मल्टी-कैरेक्टर `processLorebooks()` दोबारा इस्तेमाल करता है जो ग्रुप चैट में चलता है, पर टोकन बजट Noodle के लिए अलग से `noodle-prompt.ts` के `noodleLorebookTokenBudget()` से आता है, जो चालू कैरेक्टर की संख्या के हिसाब से बढ़ता है और 8,192 टोकन पर पक्का रुक जाता है। यह `previewOnly: true` के साथ चलता है, क्योंकि Noodle में स्टिकी/कूलडाउन टाइमिंग स्टेट सेव करने के लिए प्रति-चैट कोई स्लॉट नहीं है। |

प्रोफ़ाइल वाला प्रॉम्प्ट Prompt Overrides UI में नहीं दिखता। **Noodle Timeline Prompt**, **Noodle Timeline Voice & Tone** और **Noodle Post Image** टेम्पलेट वहाँ दिखते हैं। जब **Noodle image generation** चालू हो (`enableImagePrompts`), तो Noodle की सेटिंग **Image instructions (sent to your LLM)** टाइमलाइन मॉडल को जाती है, जो हर पोस्ट का इमेज आइडिया लिखते समय उसका पालन करता है। डिफ़ॉल्ट **Noodle Post Image** टेम्पलेट अब इसे नहीं जोड़ता, हालाँकि कस्टम टेम्पलेट इसे अब भी `${userInstructions}` के रूप में इस्तेमाल कर सकते हैं।

इमेज सर्विस (**package** `services/noodle/noodle-public-images.service.ts`) पहले `NOODLE_IMAGE_POST` लोड करती है, फिर नतीजे को `compileImagePrompt()` से गुज़ारकर इमेज प्रोवाइडर को भेजती है। यानी चुनी हुई इमेज स्टाइल प्रोफ़ाइल और कनेक्शन के डिफ़ॉल्ट भी फ़ाइनल रिक्वेस्ट पर असर डाल सकते हैं।

## फ़ाइनल प्रॉम्प्ट की जाँच

Debug Mode चालू रखकर मैन्युअल रिफ़्रेश करने पर प्रोफ़ाइल और टाइमलाइन के फ़ाइनल मॉडल संदेश शेयर्ड सर्वर लॉगर में दर्ज हो जाते हैं। इन्हें देखें:

```text
[debug/noodle] Profile prompt sent to model
[debug/noodle] Prompt sent to model
[debug/noodle] Attached N timeline image input(s) to the refresh prompt
```

डीबग लॉग में टाइमलाइन इमेज का पेलोड कभी base64 के रूप में नहीं लिखा जाता। लॉग किए गए टेक्स्ट में वही पोस्ट/रिप्लाई अटैचमेंट की-नाम होते हैं जो मॉडल को भेजे जाते हैं, साथ में नेटिव इमेज इनपुट की संख्या। Noodle इन इनपुट को `noodle-vision.ts` में नॉर्मलाइज़ करता है और उनकी सीमा तय करता है। अगर कोई प्रोवाइडर विज़न सामग्री साफ़ मना कर देता है, तो पैकेज उसे लॉग करता है और उसकी जगह तैयार किया हुआ सिर्फ़-टेक्स्ट वाला फ़ॉलबैक प्रॉम्प्ट भेजता है।

इमेज के लिए **Settings -> Generations -> Overall Generations** के नीचे **Expose media prompts before sending** चालू करें। इससे रिक्वेस्ट भेजने से पहले कंपाइल हुए फ़ाइनल पॉज़िटिव और नेगेटिव प्रॉम्प्ट देखे और बदले जा सकते हैं।

## सुरक्षित तरीके से बदलाव

प्रॉम्प्ट तैयार करने वाला हिस्सा कंपैटिबिलिटी के लिहाज़ से बहुत नाज़ुक जगह है। इसमें बदलाव करते समय प्रॉम्प्ट, `noodleGeneratedRefreshSchema`, रूट प्रोसेसिंग और Noodle के mention तथा poll रिग्रेशन, इन सबको आपस में मिला हुआ रखें। Engine में कम से कम इतना चलाएँ:

```bash
pnpm check
pnpm regression:prompt
pnpm regression:noodle
```

पैकेज के कोड में बदलाव Marinara-Agents में, उसकी `staging` ब्रांच के सामने किए और जाँचे जाते हैं।

## मिलती-जुलती गाइड

- [Noodle: ऐप के अंदर की सोशल टाइमलाइन](../noodle/overview.md)
- [Noodle की सेटिंग्स और चैट कैरीओवर](../noodle/settings.md)
- [वैकल्पिक एजेंट और कैपेबिलिटी पैकेज](optional-agent-packages.md)
- [आर्किटेक्चर मैप (डेवलपर्स के लिए)](architecture-map.md)
