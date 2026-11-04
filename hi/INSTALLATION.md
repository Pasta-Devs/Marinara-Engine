# Marinara Engine इंस्टॉलेशन

Marinara आपके अपने डिवाइस पर चलता है। नीचे अपने डिवाइस के लिए गाइड चुनें।

## अपना प्लैटफ़ॉर्म चुनें

| आपका डिवाइस | गाइड |
| --- | --- |
| Windows | [Windows इंस्टॉलेशन](installation/windows.md) |
| macOS या Linux | [macOS / Linux इंस्टॉलेशन गाइड](installation/macos-linux.md) |
| Docker या Podman | [कंटेनर से चलाना (Docker / Podman)](installation/containers.md) |
| Android फ़ोन या टैबलेट | [Android इंस्टॉलेशन गाइड](installation/android-termux.md) |
| iPhone या iPad | [iOS / iPadOS PWA गाइड](installation/ios-pwa.md) |

## कौन सा तरीका चुनें?

- **Windows:** Windows इंस्टॉलर इस्तेमाल करें। यह सब कुछ सेट कर देता है और डेस्कटॉप पर शॉर्टकट भी बना देता है।
- **Android:** [APK डाउनलोड करें](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk)। डाउनलोड की गई फ़ाइल खोलें, फिर ऐप में **Install / Start Marinara** पर टैप करें।
- **macOS, Linux या होम सर्वर:** इनमें से एक तरीका चुनें। नेटिव गाइड में Marinara एक लॉन्चर स्क्रिप्ट के ज़रिए सीधे आपके कंप्यूटर पर चलता है। Docker में Node.js की ज़रूरत नहीं पड़ती और कुछ भी बिल्ड नहीं करना पड़ता, लेकिन पहले Docker इंस्टॉल करना होता है।
- **iPhone या iPad:** इन डिवाइस पर Marinara सर्वर नहीं चला सकता। इसे किसी कंप्यूटर, होम सर्वर या Android डिवाइस पर चलाएँ, फिर Safari में खोलें। iOS गाइड में इसका तरीका बताया गया है।
- **कोड में बदलाव करना चाहते हैं:** सोर्स से चलाएँ। इसका मतलब है कि आप कोड डाउनलोड करके ऐप को अपने डिवाइस पर बिल्ड करते हैं। Windows, macOS और Linux, और Android, तीनों गाइड में यह तरीका बताया गया है।

Android पर Marinara **Termux** के अंदर चलता है। Termux एक मुफ़्त Android ऐप है, जो आपके फ़ोन में एक छोटा Linux सिस्टम जोड़ देता है। APK आपके लिए Termux सेट कर देता है।

## आपको क्या चाहिए

- सोर्स से चलाने के लिए: **Node.js** 24, 25 या 26, और **Git**। Node.js ऐप को चलाता है। Git कोड डाउनलोड करता है और उसे अपडेट करता है। प्लैटफ़ॉर्म की गाइड में दोनों के डाउनलोड लिंक दिए गए हैं।
- Docker या Podman के लिए: Node.js की ज़रूरत नहीं। सुझाया गया Compose सेटअप प्रोजेक्ट फ़ाइलें डाउनलोड करने के लिए एक बार Git इस्तेमाल करता है।

## Marinara खोलना

Marinara चलने लगे तो उसी डिवाइस के ब्राउज़र में यह पता खोलें। इसे किसी दूसरे डिवाइस से इस्तेमाल न करें।

```text
http://127.0.0.1:7860
```

`127.0.0.1` का मतलब है यही डिवाइस। `7860` डिफ़ॉल्ट पोर्ट है, यानी वह नंबर जिस पर ऐप सुनता है। लॉन्चर (वे स्क्रिप्ट जो Marinara चालू करती हैं) आपके नेटवर्क के दूसरे डिवाइस को भी इस तक पहुँचने देते हैं, लेकिन जब तक आप लॉगिन सेट नहीं करते, वे डिवाइस ब्लॉक रहते हैं। Docker या Podman वाला इंस्टॉल तब तक सिर्फ़ इसी डिवाइस पर जवाब देता है, जब तक आप उसकी पोर्ट वाली लाइन नहीं बदलते। [कंटेनर](installation/containers.md#open-marinara-from-another-device) देखें।

## अपने फ़ोन पर Marinara खोलना

1. किसी कंप्यूटर, होम सर्वर या Android फ़ोन पर Marinara इंस्टॉल करके चालू करें।
   Docker या Podman में पहले [Marinara को दूसरे डिवाइस से खोलना](installation/containers.md#open-marinara-from-another-device) के स्टेप पूरे करें।
2. वहाँ लॉगिन सेट करें। [रिमोट एक्सेस](REMOTE_ACCESS.md#option-1-login-recommended) देखें।
3. उस डिवाइस का IP पता ढूँढें। [अक्सर पूछे जाने वाले सवाल](FAQ.md#how-do-i-access-marinara-engine-from-my-phone-or-another-device) में इसका तरीका बताया गया है।
4. अपने फ़ोन पर `http://` के बाद IP पता और फिर `:7860` लिखकर खोलें।

iPhone के लिए [iOS / iPadOS PWA गाइड](installation/ios-pwa.md) देखें।

## इंस्टॉल के बाद

कनेक्शन जोड़ने, कैरेक्टर बनाने या इंपोर्ट करने और चैट शुरू करने के लिए [Marinara Engine की शुरुआत](home/welcome.md) पढ़ें। बाद में अपडेट करने के लिए [Marinara Engine को अपडेट करना](UPGRADING.md) देखें।

## मिलती-जुलती गाइड

- [Windows इंस्टॉलेशन](installation/windows.md)
- [macOS / Linux इंस्टॉलेशन गाइड](installation/macos-linux.md)
- [कंटेनर से चलाना (Docker / Podman)](installation/containers.md)
- [Android (Termux) इंस्टॉलेशन](installation/android-termux.md)
- [iOS / iPadOS PWA गाइड](installation/ios-pwa.md)
- [Marinara Engine को अपडेट करना](UPGRADING.md)
- [Marinara Engine की शुरुआत](home/welcome.md)
