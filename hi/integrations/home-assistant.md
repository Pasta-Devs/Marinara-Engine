# Home Assistant इंटीग्रेशन

इस इंटीग्रेशन से आपके AI कैरेक्टर चैट से ही असली स्मार्ट होम डिवाइस चला सकते हैं, जैसे लाइट, क्लाइमेट, कवर और मीडिया प्लेयर। इससे Home Assistant के ऑटोमेशन भी Marinara Engine में संदेश भेज सकते हैं। Home Assistant स्मार्ट होम डिवाइस के लिए एक मुफ़्त, ओपन सोर्स प्लैटफ़ॉर्म है। अगर आप इसे नहीं चलाते, तो आपको इस गाइड की ज़रूरत नहीं है।

## इंटीग्रेशन क्या जोड़ता है

इंटीग्रेशन एक छोटा सॉफ़्टवेयर है जो Home Assistant के अंदर इंस्टॉल होता है और उसे आपके Marinara सर्वर से जोड़ता है। पहले सेटअप में यह आपके लिए नीचे दी गई चीज़ें बनाता है। टूल के पते कॉपी करने या टूल हाथ से सेट करने की कभी ज़रूरत नहीं पड़ती।

- Presets पैनल के **Functions** (फ़ंक्शन) सेक्शन में स्मार्ट होम टूल। [कस्टम टूल](../extending/custom-tools.md) देखें।
- **Home Assistant** नाम का एक एजेंट, यानी वह AI मददगार जो आपकी चैट के साथ-साथ चलता है। [एजेंट का ओवरव्यू](../agents/agents-overview.md) देखें।
- Home Assistant की एंटिटी (डिवाइस, सेंसर और कंट्रोल), ताकि आप Home Assistant से Marinara पर नज़र रख सकें और उसे चला सकें।

## शुरू करने से पहले

- Home Assistant वर्ज़न 2024.1.0 या उससे नया।
- Home Assistant में HACS इंस्टॉल हो। HACS यानी Home Assistant Community Store, कस्टम इंटीग्रेशन इंस्टॉल करने का एक टूल।
- Marinara चल रहा हो और Home Assistant वाली मशीन से उस तक पहुँच हो। डिफ़ॉल्ट पता `localhost:7860` है।
- Marinara की `.env` फ़ाइल में `WEBHOOK_LOCAL_URLS_ENABLED=true` हो।

`.env` फ़ाइल Marinara सर्वर की सादा टेक्स्ट सेटिंग्स फ़ाइल है। यह कहाँ रहती है, यह [सर्वर कॉन्फ़िगरेशन](../CONFIGURATION.md) में देखें। इंटीग्रेशन एक वेबहुक इस्तेमाल करता है, यानी वह वेब पता जिससे एक ऐप दूसरे ऐप को डेटा भेज सकता है। Home Assistant का वेबहुक एक लोकल, सादा `http` पता होता है, और सुरक्षा के लिए Marinara ऐसे पते डिफ़ॉल्ट रूप से रोक देता है। यह सेटिंग उन्हें छूट देती है। यह पंक्ति जोड़ें और सेव करें। यह बिना रीस्टार्ट के लागू हो जाती है, आम तौर पर कुछ ही सेकंड में (ज़्यादा से ज़्यादा लगभग 30 सेकंड में):

```text
WEBHOOK_LOCAL_URLS_ENABLED=true
```

### अगर Home Assistant किसी दूसरे डिवाइस पर चलता है

इंटीग्रेशन बिना यूज़रनेम या पासवर्ड के जुड़ता है, और सेटअप फ़ॉर्म में इन्हें भरने की जगह ही नहीं है।

- एक ही मशीन: कनेक्शन बिना किसी बदलाव के काम करता है।
- दूसरा डिवाइस: Marinara इसे डिफ़ॉल्ट रूप से रोक देता है। उस डिवाइस का IP पता (आपके नेटवर्क पर उसका नंबर वाला पता) `.env` के `IP_ALLOWLIST` में जोड़ें। पूरी तरह भरोसेमंद घरेलू नेटवर्क पर आप इसकी जगह `ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK=true` सेट कर सकते हैं।
- अगर Marinara `BASIC_AUTH_USER` और `BASIC_AUTH_PASS` (यानी लॉगिन) इस्तेमाल करता है, तो इंटीग्रेशन साइन इन नहीं कर पाता। तब यह सिर्फ़ उसी मशीन से या `IP_ALLOWLIST` में दर्ज किसी डिवाइस से काम करता है।

कौन सा विकल्प चुनें, यह [रिमोट एक्सेस](../REMOTE_ACCESS.md) में देखें।

## इंटीग्रेशन इंस्टॉल करें

### HACS में जोड़ें

1. Home Assistant में **HACS** खोलें।
2. तीन बिंदु वाला मेन्यू खोलें और **Custom repositories** पर क्लिक करें।
3. रिपॉज़िटरी वाले बॉक्स में `https://github.com/Pasta-Devs/Marinara-Engine` डालें।
4. कैटेगरी **Integration** पर सेट करें और **Add** पर क्लिक करें।
5. **Marinara Engine** सर्च करें और इसे इंस्टॉल करें।
6. Home Assistant दोबारा शुरू करें।

### सेट करें

1. **Settings → Devices & Services** (सेटिंग्स → डिवाइस और सर्विस) में जाएँ और **Add Integration** पर क्लिक करें।
2. **Marinara Engine** सर्च करें।
3. **Host** और **Port** में वह जगह डालें जहाँ Marinara चलता है। डिफ़ॉल्ट `localhost` और `7860` हैं।
4. **Submit** पर क्लिक करें।

अगर यह काम नहीं किया: Marinara तक न पहुँच पाने पर Home Assistant एरर दिखाता है। [समस्या-समाधान](#troubleshooting) देखें।

सफल होने पर इंटीग्रेशन Home Assistant में एक निजी वेबहुक रजिस्टर करता है, Marinara के **Functions** सेक्शन में उसी वेबहुक की तरफ़ इशारा करने वाले टूल बनाता है, हर चालू टूल की लिस्ट वाला **Home Assistant** एजेंट बनाता है, और नीचे बताई गई एंटिटी बनाता है।

## एजेंट को चैट में जोड़ें

एजेंट बन जाने भर से वह हर चैट में नहीं लगता। जिस-जिस चैट में स्मार्ट होम कंट्रोल चाहिए, उसमें इसे जोड़ें।

1. चैट खोलें और **Chat Settings** (चैट सेटिंग्स) पर क्लिक करें।
2. **Agents** (एजेंट) सेक्शन खोलें।
3. **Home Assistant** एजेंट जोड़ें।

यह Roleplay, Conversation और Game चैट में काम करता है। जुड़ते ही उस चैट में टूल AI के लिए उपलब्ध हो जाते हैं। और कुछ चालू करने की ज़रूरत नहीं।

### जाँचें कि यह काम करता है

1. उसी चैट में सादी भाषा में कोई रिक्वेस्ट लिखें, जैसे `Turn on the office lights`, और उसे भेजें।
2. AI को `ha_turn_on` जैसा कोई टूल कॉल करना चाहिए, लाइट जल जानी चाहिए, और फिर AI इसकी पुष्टि करता है।

अगर कुछ नहीं होता, तो जाँचें कि `WEBHOOK_LOCAL_URLS_ENABLED=true` सेट है, और [समस्या-समाधान](#troubleshooting) देखें।

## चुनें कि AI कौन से टूल इस्तेमाल कर सकता है

टूल आठ कैटेगरी में बँटे हैं। Marinara कौन सी कैटेगरी इस्तेमाल कर सकता है, यह चुनने के लिए **Settings → Devices & Services** खोलें, **Marinara Engine** पर क्लिक करें, फिर **Configure** पर। इसमें दो विकल्प हैं:

- **Primary Chat**: वह डिफ़ॉल्ट चैट जिस पर Home Assistant की सर्विस काम करती हैं।
- **Exposed Tool Categories**: वे कैटेगरी जिन्हें Marinara इस्तेमाल कर सकता है।

| कैटेगरी | डिफ़ॉल्ट | टूल |
| --- | --- | --- |
| Lights & Switches | On | ha_turn_on, ha_turn_off, ha_toggle, ha_set_brightness, ha_set_color, ha_set_color_temp |
| Climate | On | ha_set_temperature, ha_set_hvac_mode |
| Covers (Blinds & Garage) | On | ha_open_cover, ha_close_cover, ha_set_cover_position |
| Locks | Off | ha_lock, ha_unlock |
| Media Players | On | ha_media_play, ha_media_pause, ha_set_volume |
| Scenes & Scripts | On | ha_activate_scene, ha_run_script |
| Query | On | ha_get_state, ha_list_areas, ha_list_entities, ha_notify |
| Generic Service Calls (Advanced) | Off | ha_call_service |

> **Warning:** **Generic Service Calls (Advanced)** से AI कोई भी Home Assistant सर्विस कॉल कर सकता है। **Locks** से वह दरवाज़े लॉक और अनलॉक कर सकता है। दोनों डिफ़ॉल्ट रूप से बंद रहती हैं। इन्हें तभी चालू करें जब आप सचमुच चाहें।

ज़्यादातर टूल एक डिवाइस या कमरे का नाम लेते हैं। कमरे का नाम देने पर टूल उस कमरे के हर मेल खाते डिवाइस पर काम करता है। कैटेगरी में किया गया बदलाव **Marinara Sync HA Tools** दबाने या Home Assistant दोबारा शुरू करने के बाद लागू होता है।

## Home Assistant में एंटिटी

इंटीग्रेशन ये एंटिटी **Marinara Engine** नाम के डिवाइस के नीचे बनाता है।

| एंटिटी | प्रकार | क्या करती है |
| --- | --- | --- |
| Marinara Chat Count | Sensor | Marinara की कुल चैट की संख्या |
| Marinara Active Agent Count | Sensor | Marinara के कितने एजेंट चालू हैं |
| Marinara Active Chat | Select | चुनती है कि सर्विस किस चैट पर काम करें |
| Marinara Agent: (name) | Switch | एक एजेंट को चालू या बंद करती है, हर एजेंट के लिए एक स्विच |
| Marinara Abort Generation | Button | बन रहा कोई भी AI जवाब रद्द करता है |
| Marinara Sync HA Tools | Button | सारे टूल दोबारा भेजता है और Home Assistant एजेंट फिर से बनाता है |

इंटीग्रेशन हर 30 सेकंड में Marinara में नई चैट और एजेंट देखता है, इसलिए अभी-अभी बनाई गई किसी चीज़ को दिखने में 30 सेकंड तक लग सकते हैं।

### सेटिंग्स बदलने के बाद सिंक करें

**Marinara Engine** डिवाइस के पेज पर **Marinara Sync HA Tools** दबाएँ। यह मौजूदा टूल वहीं के वहीं अपडेट करता है, अगर आपने **Home Assistant** एजेंट मिटा दिया हो तो उसे दोबारा बनाता है, और जिन टूल की कैटेगरी आपने बंद की है, उन्हें बंद कर देता है (मिटाता नहीं)। Marinara में Home Assistant वाले टूल हाथ से न बदलें। अगली सिंक आपके बदलावों को ओवरराइट कर देती है और टूल दोबारा चालू कर देती है।

## ऑटोमेशन से Marinara चलाएँ

इंटीग्रेशन ऑटोमेशन के लिए Home Assistant में दो सर्विस जोड़ता है। ये Home Assistant के अंदर चलती हैं, Marinara में नहीं। दोनों डिफ़ॉल्ट रूप से आपकी **Primary Chat** पर काम करती हैं।

### संदेश भेजना (marinara_engine.send_message)

- `message`: संदेश का टेक्स्ट। यह ज़रूरी है।
- `chat_id`: किस चैट में भेजना है। खाली छोड़ने पर Primary Chat इस्तेमाल होती है।
- `role`: `user`, `assistant`, `system` या `narrator`। डिफ़ॉल्ट `user` है।
- `trigger_generation`: true होने पर AI जवाब भी देता है। डिफ़ॉल्ट false है।

यह ऑटोमेशन सामने का दरवाज़ा खुलने पर AI को बता देता है:

```yaml
automation:
  trigger:
    platform: state
    entity_id: binary_sensor.front_door
    to: "on"
  action:
    service: marinara_engine.send_message
    data:
      message: "Someone has arrived at the front door."
      trigger_generation: true
```

### जेनरेशन ट्रिगर करना (marinara_engine.trigger_generation)

यह बिना किसी दिखने वाले संदेश के AI का जवाब शुरू कर देती है।

- `chat_id`: कौन सी चैट। खाली छोड़ने पर Primary Chat इस्तेमाल होती है।
- `user_message`: जवाब वाले टर्न के साथ भेजा जाने वाला वैकल्पिक संदेश।

<a id="troubleshooting"></a>

## समस्या-समाधान

### सेटअप फ़ॉर्म कहता है कि कनेक्ट नहीं हो पा रहा

जाँच लें कि Marinara चल रहा है, और **Host** और **Port** उसी जगह से मेल खाते हैं जहाँ यह सुन रहा है (डिफ़ॉल्ट `localhost` और `7860`)। अगर Home Assistant किसी दूसरे डिवाइस पर है, तो Marinara उसे रोक देता है, जब तक वह डिवाइस `IP_ALLOWLIST` में न हो। इंटीग्रेशन पासवर्ड नहीं भेज सकता, इसलिए लॉगिन से सुरक्षित Marinara भी उसे ठुकरा देता है। [रिमोट एक्सेस](../REMOTE_ACCESS.md) देखें। ये नियम सेटअप के बाद भी लागू रहते हैं। अगर Marinara बाद में उस डिवाइस को रोक दे, तो सेंसर और चैट की लिस्ट चुपचाप अपडेट होना बंद कर देते हैं।

### AI कोई डिवाइस टूल चलाने की कोशिश करता है, पर कुछ नहीं होता

शायद वेबहुक कॉल रुक रही है। `.env` में `WEBHOOK_LOCAL_URLS_ENABLED=true` जोड़ें और सेव करें। इसके बिना टूल कॉल फ़ेल हो सकती है, और संदेश आता है कि `http` की इजाज़त नहीं है या प्राइवेट पता ठुकरा दिया गया। अगर Marinara और Home Assistant एक ही मशीन पर हैं, तो इंटीग्रेशन अपने आप इंटरनल पता इस्तेमाल करता है। अगर Marinara किसी दूसरे डिवाइस पर है, तो जाँच लें कि उस डिवाइस से Home Assistant के लोकल पते तक पहुँच बनती है।

### टूल Functions में नहीं दिखते

**Marinara Sync HA Tools** दबाएँ या Home Assistant दोबारा शुरू करें, फिर Presets पैनल में **Functions** देखें।

### Home Assistant एजेंट मेरी चैट में नहीं है

जाँचें कि Marinara में Agents के नीचे यह एजेंट मौजूद है। अगर नहीं है, तो उसे दोबारा बनाने के लिए **Marinara Sync HA Tools** दबाएँ। फिर उसे **Chat Settings → Agents** (चैट सेटिंग्स → एजेंट) में जोड़ें।

### वेबहुक का पता हाथ से ढूँढें

इसकी ज़रूरत कभी-कभार ही पड़ती है, क्योंकि हर टूल में पता पहले से होता है। Home Assistant में **Settings → Devices & Services → Marinara Engine** (सेटिंग्स → डिवाइस और सर्विस → Marinara Engine) खोलें। वेबहुक इस पैटर्न का होता है, जिसमें 8123 Home Assistant का डिफ़ॉल्ट पोर्ट है:

```text
http://<homeassistant-ip>:8123/api/webhook/<webhook-id>
```

## अनइंस्टॉल करें

Home Assistant में **Settings → Devices & Services → Marinara Engine** में जाकर इंटीग्रेशन डिलीट करें। इससे एंटिटी हट जाती हैं। Marinara के **Functions** सेक्शन के टूल और **Home Assistant** एजेंट बने रहते हैं। अगर अब इनकी ज़रूरत न हो, तो इन्हें Marinara में हाथ से डिलीट करें।

## मिलती-जुलती गाइड

- [कस्टम टूल](../extending/custom-tools.md)
- [एजेंट का ओवरव्यू](../agents/agents-overview.md)
- [सर्वर कॉन्फ़िगरेशन](../CONFIGURATION.md)
- [रिमोट एक्सेस](../REMOTE_ACCESS.md)
