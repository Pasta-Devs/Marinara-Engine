# macOS / Linux इंस्टॉलेशन गाइड

Marinara Engine को Mac या Linux कंप्यूटर पर इंस्टॉल करें और `start.sh` लॉन्चर से शुरू करें। इसके बाद Marinara आपके अपने कंप्यूटर पर चलता है।

## शुरू करने से पहले

आपको दो टूल चाहिए:

- **Node.js** 24, 25 या 26। Node.js, Marinara को चलाता है। वर्ज़न 24 सुझाया गया LTS (Long Term Support) रिलीज़ है।
- **Git**। Git, Marinara को डाउनलोड करता है और अपडेट लाता है।

pnpm (वह टूल जो ऐप के हिस्से इंस्टॉल करता है) इंस्टॉल करने की ज़रूरत नहीं है। लॉन्चर सही वर्ज़न सेट कर देता है।

### macOS पर Node.js और Git इंस्टॉल करना

Homebrew हो, तो एक ही कमांड दोनों इंस्टॉल कर देती है:

```bash
brew install node git
```

Homebrew न हो, तो [nodejs.org](https://nodejs.org) से Node.js का इंस्टॉलर डाउनलोड करें। फिर Xcode कमांड लाइन टूल्स के साथ Git इंस्टॉल करें:

```bash
xcode-select --install
```

### Linux पर Node.js और Git इंस्टॉल करना

अपना पैकेज मैनेजर इस्तेमाल करें। Ubuntu या Debian पर डिफ़ॉल्ट Node.js अक्सर वर्ज़न 24 से पुराना होता है, इसलिए पहले NodeSource रिलीज़ जोड़ें:

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo bash -
sudo apt install -y nodejs git
```

Fedora पर:

```bash
sudo dnf install -y nodejs git
```

Arch पर:

```bash
sudo pacman -S nodejs npm git
```

### टूल जाँचना

```bash
node -v
git --version
```

`node -v` पर `v24` या उससे ऊपर दिखना चाहिए। किसी भी कमांड पर "command not found" आए, तो वह टूल ठीक से इंस्टॉल नहीं हुआ है।

## Marinara इंस्टॉल करके शुरू करना

1. टर्मिनल खोलें, यानी वह विंडो जिसमें कमांड टाइप करते हैं। Mac पर <kbd>Cmd</kbd>+<kbd>Space</kbd> दबाएँ, Terminal टाइप करें और Enter दबाएँ। Linux पर अपना Terminal ऐप खोलें।
2. Marinara डाउनलोड करें।

   ```bash
   git clone https://github.com/Pasta-Devs/Marinara-Engine.git
   ```

3. नया फ़ोल्डर खोलें।

   ```bash
   cd Marinara-Engine
   ```

4. लॉन्चर से Marinara शुरू करें, यानी उस स्क्रिप्ट से जो उसे सेट करके शुरू करती है।

   ```bash
   ./start.sh
   ```

पहली बार चलाने में कुछ मिनट लगते हैं, क्योंकि तभी सब कुछ डाउनलोड और बिल्ड होता है। टर्मिनल प्रोग्रेस दिखाता है, फिर `Press Ctrl+C to stop`। Marinara आपके ब्राउज़र में `http://127.0.0.1:7860` पर खुल जाता है। ब्राउज़र न खुले, तो खुद उस पते पर जाएँ।

अगर यह काम नहीं किया:

- `permission denied`: `chmod +x start.sh` चलाएँ, फिर `./start.sh` दोबारा चलाएँ।
- `[ERROR] Node.js 24 LTS or newer is required`: आपका Node.js बहुत पुराना है। नया वर्ज़न इंस्टॉल करें, फिर `./start.sh` दोबारा चलाएँ।

## Marinara शुरू और बंद करना

- **दोबारा शुरू करें:** Marinara फ़ोल्डर से `./start.sh` चलाएँ। Marinara पहले से चल रहा हो, तो यह उसे आपके ब्राउज़र में दोबारा खोल देता है।
- **बंद करें:** टर्मिनल में <kbd>Ctrl</kbd>+<kbd>C</kbd> दबाएँ।

Git डाउनलोड से हर बार `./start.sh` चलाने पर लॉन्चर:

1. नया वर्ज़न देखता है और मिलने पर अपडेट करता है।
2. Node.js और सही pnpm वर्ज़न जाँचता है।
3. छूटे हुए हिस्से इंस्टॉल करता है, और कोड बदला हो तो ऐप दोबारा बनाता है।
4. सर्वर शुरू करता है और आपका ब्राउज़र खोलता है।

## लॉन्चर की सेटिंग्स बदलना

लॉन्चर की सेटिंग्स Marinara फ़ोल्डर की `.env` फ़ाइल में रहती हैं। `.env` फ़ाइल एक सादी टेक्स्ट फ़ाइल है, जिसकी हर पंक्ति में एक सेटिंग होती है। लॉन्चर को ब्राउज़र खोलने से रोकने के लिए यह पंक्ति जोड़ें:

```bash
AUTO_OPEN_BROWSER=false
```

`PORT` पोर्ट तय करता है, यानी पते में कोलन के बाद वाला नंबर (डिफ़ॉल्ट 7860)। लॉन्चर आपके लोकल नेटवर्क के दूसरे डिवाइस को Marinara तक पहुँचने देता है, लेकिन जब तक आप लॉगिन सेट न करें, उन्हें रोके रखता है। देखें [रिमोट एक्सेस](../REMOTE_ACCESS.md)।

## Marinara अपडेट करना

`./start.sh` चलाने पर Marinara पहले अपडेट होता है। आपकी चैट, कैरेक्टर और सेटिंग्स अपनी जगह बनी रहती हैं। अगर आपने कोड में खुद बदलाव किए हैं, तो लॉन्चर उन्हें अलग रख देता है और अपडेट के बाद वापस लगा देता है। अपडेट छोड़ने, ऐप के अंदर वाले **Apply Update** (अपडेट लागू करें) बटन और मैन्युअल कमांड के लिए देखें [Marinara Engine को अपडेट करना](../UPGRADING.md#macos-and-linux)।

## लॉन्चर के बिना मैन्युअल सेटअप

ज़्यादातर लोगों के लिए लॉन्चर ही ठीक है। हर स्टेप खुद चलाने के लिए pnpm चाहिए। Node.js 24 में Corepack शामिल है, यानी वह टूल जो pnpm चालू करता है। Node.js 25 में यह नहीं है।

1. Node.js 24 पर pnpm चालू करें:

   ```bash
   corepack enable pnpm
   ```

   Node.js 25 या 26 पर पहले Corepack इंस्टॉल करें:

   ```bash
   npm install --global corepack
   corepack enable pnpm
   ```

2. Marinara डाउनलोड करें।

   ```bash
   git clone https://github.com/Pasta-Devs/Marinara-Engine.git
   ```

3. उसका फ़ोल्डर खोलें।

   ```bash
   cd Marinara-Engine
   ```

4. हिस्से इंस्टॉल करें, ऐप बनाएँ और सर्वर शुरू करें।

   ```bash
   pnpm install --force
   pnpm build
   pnpm start
   ```

5. `http://127.0.0.1:7860` खोलें।

`pnpm start` के साथ सर्वर सिर्फ़ आपके अपने कंप्यूटर पर सुनता है। दूसरे डिवाइस को जुड़ने देने के लिए `.env` में `HOST=0.0.0.0` जोड़ें और रीस्टार्ट करें।

## वैकल्पिक: बैकग्राउंड रिमूवर

Marinara जेनरेट किए गए स्प्राइट (कैरेक्टर की तस्वीरें) के लिए पारदर्शी बैकग्राउंड माँगता है और सादे बैकग्राउंड खुद साफ़ कर देता है। बारीक नज़ारों या परछाइयों के लिए एक फ़ॉलबैक के तौर पर आप वैकल्पिक AI बैकग्राउंड रिमूवर इंस्टॉल कर सकते हैं। यह एक Python venv (Python पैकेज के लिए एक निजी फ़ोल्डर) सेट करता है और बड़ी फ़ाइलें डाउनलोड करता है: PyTorch (मशीन लर्निंग की एक लाइब्रेरी) और U2Net मॉडल (वे फ़ाइलें जो इमेज में मुख्य विषय पहचानती हैं)।

1. macOS पर Python 3.11 सबसे अच्छा चलता है। पहले उसे इंस्टॉल करें। Python 3.9 से 3.11 तक काम करता है।

   ```bash
   brew install python@3.11
   ```

2. Marinara फ़ोल्डर से यह चलाएँ:

   ```bash
   pnpm backgroundremover:install
   ```

अगली बार शुरू होने पर लॉन्चर से इसे इंस्टॉल करवाने के लिए `.env` में यह पंक्ति जोड़ें:

```bash
BACKGROUNDREMOVER_AUTO_INSTALL=true
```

## कुछ गड़बड़ हो जाए तो

कुछ Linux सिस्टम पर इंस्टॉल ऐसी एरर के साथ फ़ेल हो जाता है जिसमें `ERR_PNPM_ENAMETOOLONG` (फ़ाइल पथ बहुत लंबे) लिखा होता है। अधूरे फ़ोल्डर हटाएँ और लॉन्चर दोबारा चलाएँ:

```bash
rm -rf node_modules .pnpm .pnpm-store
./start.sh
```

और हल के लिए देखें [Marinara Engine की समस्याएँ सुलझाना](../TROUBLESHOOTING.md)।

## मिलती-जुलती गाइड

- [Marinara Engine इंस्टॉलेशन](../INSTALLATION.md)
- [Marinara Engine को अपडेट करना](../UPGRADING.md)
- [रिमोट एक्सेस: लॉगिन और IP अलाउलिस्ट](../REMOTE_ACCESS.md)
- [Marinara Engine की समस्याएँ सुलझाना](../TROUBLESHOOTING.md)
