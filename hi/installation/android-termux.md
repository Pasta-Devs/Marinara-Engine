# Android (Termux) इंस्टॉलेशन गाइड

Marinara Engine को Android फ़ोन या टैबलेट पर चलाएँ। Marinara, Termux के अंदर चलता है। Termux एक मुफ़्त ऐप है जो आपके फ़ोन में एक छोटा Linux सिस्टम जोड़ देता है। इसे Marinara के Android ऐप से (सबसे आसान) या Termux में हाथ से सेट कर सकते हैं।

## Termux और F-Droid के बारे में

Marinara एक Linux सर्वर है, कोई नेटिव Android ऐप नहीं, इसलिए उसे चलने के लिए Termux चाहिए। F-Droid एक मुफ़्त और ओपन-सोर्स ऐप स्टोर है। Android ऐप का सेटअप Termux का स्थिर F-Droid बिल्ड डाउनलोड करता है। Termux का एक प्रयोगात्मक Google Play बिल्ड भी है। वह पहले से इंस्टॉल हो तो Marinara उसे स्वीकार कर लेता है, लेकिन यह गाइड F-Droid ही सुझाती है।

Termux को [Termux on F-Droid](https://f-droid.org/en/packages/com.termux/) से इंस्टॉल करें। Termux या उसके प्लगइन ऐप अलग-अलग सोर्स से न मिलाएँ, क्योंकि उनके सिग्नेचर मेल खाने चाहिए। [Termux के आधिकारिक इंस्टॉलेशन नोट](https://github.com/termux/termux-app#installation) देखें।

## Android ऐप से इंस्टॉल करना

Marinara Engine का Android ऐप Termux सेट करता है, फिर लोकल सर्वर चालू होने पर Marinara खोल देता है। इस दौरान Android आपसे कुछ सिस्टम प्रॉम्प्ट मंज़ूर करने को कहता है।

1. [नया Android APK डाउनलोड करें](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk) पर टैप करें। APK यानी Android ऐप की इंस्टॉल फ़ाइल।
2. APK इंस्टॉल करें, फिर ऐप खोलें।
3. **Install / Start Marinara** पर टैप करें।
4. अगर Termux इंस्टॉल नहीं है, तो Android के इंस्टॉल प्रॉम्प्ट मंज़ूर करें, जिनमें इस ऐप को ऐप इंस्टॉल करने की अनुमति देना भी शामिल है, ताकि यह Termux को F-Droid से इंस्टॉल कर सके।
5. Android पूछे तो **Run commands in Termux environment** अनुमति दें।
6. अगर Termux सेटअप रोक देता है, तो ऐप एक `allow-external-apps` कमांड कॉपी करके Termux खोल देता है। Termux की स्क्रीन को दबाकर रखें, **Paste** (पेस्ट करें) पर टैप करें, Enter दबाएँ, फिर वापस जाकर दोबारा **Install / Start Marinara** पर टैप करें।
7. Termux के डिपेंडेंसी (यानी वे हिस्से जो ऐप को चाहिए) इंस्टॉल करने और Marinara बनाने तक इंतज़ार करें। Termux में टेक्स्ट स्क्रॉल होता दिखता है। पहली बार बनने में कुछ मिनट लगते हैं।
8. Termux का काम पूरा होने पर Marinara Engine ऐप में लौटें। सर्वर तैयार होते ही ऐप अपने आप कनेक्ट होकर साइन इन कर लेता है, और आपको Marinara की होम स्क्रीन दिखती है।

इसकी जगह ब्राउज़र इस्तेमाल करना हो तो ऐप के लॉन्चर में **Open in browser** (ब्राउज़र में खोलें) चुनें। ऐप यह चुनाव याद रखता है, और ब्राउज़र में भी साइन इन अपने आप होता है।

अगर काम नहीं बना: जिस प्रॉम्प्ट ने सेटअप रोका था, उसे ठीक करने के बाद दोबारा **Install / Start Marinara** पर टैप करें। अगर ऐप localhost नहीं खोल पाता, तो APK अपडेट करें और **Install / Start Marinara** पर टैप करें। [Android localhost लॉगिन मदद](../TROUBLESHOOTING.md#android-localhost-opens-the-login-page-or-returns-401503) देखें।

ऐप को साइनिंग कुंजी, पासवर्ड या `CSRF_TRUSTED_ORIGINS` में बदलाव की ज़रूरत नहीं है। यह अपना निजी localhost क्रेडेंशियल खुद बनाता है। `CSRF_TRUSTED_ORIGINS` में `null` न जोड़ें।

## Termux में हाथ से इंस्टॉल करना

ऐप नहीं चाहिए तो यह तरीका इस्तेमाल करें। Termux खोलें, फिर यह कमांड पेस्ट करने के लिए स्क्रीन को दबाकर रखें और **Paste** पर टैप करें (पूरी कमांड कॉपी करें):

```bash
pkg upgrade -y && pkg install -y git nodejs-lts && \
([ -d "$HOME/Marinara-Engine/.git" ] || \
  git clone https://github.com/Pasta-Devs/Marinara-Engine.git "$HOME/Marinara-Engine") && \
cd "$HOME/Marinara-Engine" && chmod +x start-termux.sh && ./start-termux.sh
```

यह कमांड क्रम से ये काम करती है:

1. Termux के सारे पैकेज अपग्रेड करती है। नया Node.js पुरानी Termux लाइब्रेरी के साथ शुरू नहीं हो सकता, इसलिए Termux का पूरा अपग्रेड ज़रूरी है। अगर यह पूछे कि कोई कॉन्फ़िगरेशन फ़ाइल रखनी है या नहीं, तो अपनी फ़ाइल रखने के लिए Enter दबाएँ।
2. Git और Node.js इंस्टॉल करती है। Marinara, Node.js 24, 25 और 26 को सपोर्ट करता है।
3. Marinara डाउनलोड करती है, बशर्ते वह पहले से मौजूद न हो।
4. लॉन्चर (`start-termux.sh`) को चलने लायक बनाती है और उसे चलाती है।

लॉन्चर डिपेंडेंसी इंस्टॉल करता है, Marinara को आपके डिवाइस पर बनाता है और लोकल सर्वर चालू करता है। आपका Node.js वर्ज़न बहुत पुराना हो तो उसे अपग्रेड कर देता है। पहली बार चलने में समय लगता है और Termux में टेक्स्ट स्क्रॉल होता दिखता है। बाद की बार यह ज़्यादा तेज़ चलता है।

जब यह बताए कि सर्वर चल रहा है, तो अपने Android ब्राउज़र में यह पता खोलें:

```text
http://127.0.0.1:7860
```

अगर आपने कोई दूसरा `PORT` सेट किया है, तो वही नंबर लगाएँ। ऐप जैसा आइकन पाने के लिए ब्राउज़र के मेन्यू का वह विकल्प इस्तेमाल करें जो पेज को होम स्क्रीन पर जोड़ता है। इसका नाम हर ब्राउज़र में अलग होता है।

## Marinara शुरू और बंद करना

ऐप इस्तेमाल करते हैं तो उसे खोलें, और सर्वर बंद हो तो **Install / Start Marinara** पर टैप करें। ऐप और ब्राउज़र के बीच बदलने के लिए लॉन्चर में **Open in browser** इस्तेमाल करें, फिर **Retry connection** (कनेक्शन फिर आज़माएँ)। ऐप के अंदर से **Settings → General → App Behavior → Open Android launcher (app or browser)** (सेटिंग्स → जनरल → ऐप का व्यवहार → Android लॉन्चर खोलें (ऐप या ब्राउज़र)) के रास्ते लॉन्चर पर वापस जाएँ।

हाथ से किए गए इंस्टॉल में Termux खोलें और यह चलाएँ:

```bash
cd Marinara-Engine
./start-termux.sh
```

सर्वर बंद करने के लिए Termux में <kbd>Ctrl</kbd>+<kbd>C</kbd> दबाएँ।

## Marinara अपडेट करना

हर बार `./start-termux.sh` चलाने पर लॉन्चर GitHub पर नया वर्ज़न देखता है और चालू होने से पहले अपडेट कर देता है। बिना अपडेट किए चालू करने के लिए `--skip-update` जोड़ें। ज़्यादा विकल्पों और APK अपडेट करने के स्टेप के लिए [Marinara Engine को अपडेट करना](../UPGRADING.md#android-termux) देखें।

अपडेट के दौरान लॉन्चर अपने लोकल pnpm कैश से बिना इस्तेमाल वाले पैकेज भी हटा देता है। इससे पुराने रिलीज़ जमा होकर कई गीगाबाइट स्टोरेज नहीं घेरते। आपकी चैट या सेटिंग्स को यह नहीं छूता।

## Marinara को दूसरे डिवाइस से खोलना

लॉन्चर आपके Wi-Fi के दूसरे डिवाइस को Marinara तक पहुँचने देता है, लेकिन जब तक आप लॉगिन सेट नहीं करते, उन्हें ब्लॉक रखता है। [अक्सर पूछे जाने वाले सवाल](../FAQ.md#how-do-i-access-marinara-engine-from-my-phone-or-another-device) और [रिमोट एक्सेस](../REMOTE_ACCESS.md) देखें।

अगर अपडेट के बाद कोई दूसरा डिवाइस साइन इन नहीं कर पाता, तो [अपडेट के बाद लॉक आउट हो जाना](../REMOTE_ACCESS.md#locked-out-after-updating) देखें। Termux में यह कमांड ऐप का लॉगिन हटा देती है और हर ब्राउज़र को साइन आउट कर देती है:

```bash
cd "$HOME/Marinara-Engine" && node scripts/reset-login.mjs
```

## मिलती-जुलती गाइड

- [Marinara Engine इंस्टॉलेशन](../INSTALLATION.md)
- [iOS / iPadOS PWA गाइड](ios-pwa.md)
- [Marinara Engine को अपडेट करना](../UPGRADING.md)
- [अक्सर पूछे जाने वाले सवाल](../FAQ.md)
