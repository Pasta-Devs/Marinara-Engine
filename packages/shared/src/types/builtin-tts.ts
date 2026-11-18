/**
 * The built-in voice models: small text to speech models Marinara downloads and runs itself on the processor
 * (onnxruntime), so Voice needs no speech server of the person's own.
 *
 * - Kokoro-82M (Apache 2.0): American and British English, Spanish, French, Hindi, Brazilian Portuguese, Japanese and
 *   Mandarin Chinese voices.
 * - Supertonic 3 (OpenRAIL-M): ten voices that each speak every language below, including Korean and Japanese.
 */
import type { SidecarDownloadProgress } from "./sidecar.js";

export type BuiltinTtsModelId = "kokoro-82m" | "supertonic-3";

/** A language a voice speaks; Supertonic voices speak all of BUILTIN_TTS_SUPERTONIC_LANGUAGES ("any"). */
export type BuiltinTtsLanguage = "en-us" | "en-gb" | "es" | "fr" | "hi" | "pt-br" | "ja" | "zh" | "any";

/** Languages Supertonic 3 reads that the Engine is translated into. */
export const BUILTIN_TTS_SUPERTONIC_LANGUAGES = ["en", "ko", "ja", "de", "es", "fr", "hi", "pl", "pt", "ru"] as const;
export type BuiltinTtsSupertonicLanguage = (typeof BUILTIN_TTS_SUPERTONIC_LANGUAGES)[number];
/** Supertonic's reading language: picked from the text's script, or always one language. */
export type BuiltinTtsReadingLanguage = "auto" | BuiltinTtsSupertonicLanguage;
/** Languages that share the Latin script: with "auto", Latin text is read in the chosen one of these. */
export const BUILTIN_TTS_LATIN_LANGUAGES = ["en", "de", "es", "fr", "pl", "pt"] as const;
export type BuiltinTtsLatinLanguage = (typeof BUILTIN_TTS_LATIN_LANGUAGES)[number];

export interface BuiltinTtsFile {
  path: string;
  bytes: number;
  sha256: string;
}

export interface BuiltinTtsModelInfo {
  id: BuiltinTtsModelId;
  label: string;
  repo: string;
  /** Pinned: every file below is checked against this revision's hashes. */
  revision: string;
  license: string;
  sampleRate: number;
  /** Measured resident memory while speaking, on the processor. */
  ramBytes: number;
  /** The model's own files; its voices are in BUILTIN_TTS_VOICES. */
  files: readonly BuiltinTtsFile[];
  downloadBytes: number;
}

export interface BuiltinTtsVoice {
  model: BuiltinTtsModelId;
  /** The voice the Voice job saves. Kokoro: "af_heart" (its first letter is the language); Supertonic: "st_F1". */
  id: string;
  name: string;
  language: BuiltinTtsLanguage;
  gender: "female" | "male";
  bytes: number;
  sha256: string;
}

/**
 * The language each Kokoro voice's first letter reads with: an eSpeak NG voice, or "ja" and "zh", which the Engine's
 * own Japanese and Chinese readers handle (ports of misaki, the pronunciation tool Kokoro was trained with).
 */
export const BUILTIN_TTS_ESPEAK_LANGUAGE: Readonly<Record<string, string>> = {
  a: "en-us",
  b: "en",
  e: "es",
  f: "fr",
  h: "hi",
  p: "pt-br",
  j: "ja",
  z: "zh",
};

/** Kokoro's voices (voices/<id>.bin), best-rated first within each language. */
const KOKORO_VOICES: readonly BuiltinTtsVoice[] = [
  {
    model: "kokoro-82m",
    id: "af_heart",
    name: "Heart",
    language: "en-us",
    gender: "female",
    bytes: 522240,
    sha256: "d583ccff3cdca2f7fae535cb998ac07e9fcb90f09737b9a41fa2734ec44a8f0b",
  },
  {
    model: "kokoro-82m",
    id: "af_alloy",
    name: "Alloy",
    language: "en-us",
    gender: "female",
    bytes: 522240,
    sha256: "c4a6b876047fd7fb472edf4ebd63cfac7c3b958a7cae7c106e8f038ca6308c45",
  },
  {
    model: "kokoro-82m",
    id: "af_aoede",
    name: "Aoede",
    language: "en-us",
    gender: "female",
    bytes: 522240,
    sha256: "4a004c33430762e2461eedb2013fad808ef4ab3121f5300f554476caf58d8361",
  },
  {
    model: "kokoro-82m",
    id: "af_bella",
    name: "Bella",
    language: "en-us",
    gender: "female",
    bytes: 522240,
    sha256: "f69d836209b78eb8c66e75e3cda491e26ea838a3674257e9d4e5703cbaf55c8b",
  },
  {
    model: "kokoro-82m",
    id: "af_jessica",
    name: "Jessica",
    language: "en-us",
    gender: "female",
    bytes: 522240,
    sha256: "a240a5e3c15b43563d6e923bdca8ef5613a23471d9b77653694012435df23bd8",
  },
  {
    model: "kokoro-82m",
    id: "af_kore",
    name: "Kore",
    language: "en-us",
    gender: "female",
    bytes: 522240,
    sha256: "9be5221b6a941c04b561959b8ff0b06e809444dcc4ab7e75a7b23606f691819e",
  },
  {
    model: "kokoro-82m",
    id: "af_nicole",
    name: "Nicole",
    language: "en-us",
    gender: "female",
    bytes: 522240,
    sha256: "cd2191ab31b914ed7b318416b0e4440fdf392ddad9106a060819aa600a64f59a",
  },
  {
    model: "kokoro-82m",
    id: "af_nova",
    name: "Nova",
    language: "en-us",
    gender: "female",
    bytes: 522240,
    sha256: "18778272caa0d0eebaea251c35fd635f038434f9eee5e691d02a174bd328414f",
  },
  {
    model: "kokoro-82m",
    id: "af_river",
    name: "River",
    language: "en-us",
    gender: "female",
    bytes: 522240,
    sha256: "00a2bcf82b1d86e8f19902ede58c65ccf6c0e43b44b7d74fad54e5d8933c9c30",
  },
  {
    model: "kokoro-82m",
    id: "af_sarah",
    name: "Sarah",
    language: "en-us",
    gender: "female",
    bytes: 522240,
    sha256: "4409fbc125afabacc615d94db5398d847006a737b0247d6892b7a9a0007a2f0a",
  },
  {
    model: "kokoro-82m",
    id: "af_sky",
    name: "Sky",
    language: "en-us",
    gender: "female",
    bytes: 522240,
    sha256: "4435255c9744f3f31659e0d714ab7689bf65d9e77ec1cce060f083912614f0b9",
  },
  {
    model: "kokoro-82m",
    id: "am_adam",
    name: "Adam",
    language: "en-us",
    gender: "male",
    bytes: 522240,
    sha256: "162b035ed91cfc48b6046982184c645f72edcdd1b82843347f605d7bf7b15716",
  },
  {
    model: "kokoro-82m",
    id: "am_echo",
    name: "Echo",
    language: "en-us",
    gender: "male",
    bytes: 522240,
    sha256: "3968b92c3c4cd1c4416dbded36c13eaa388a90d5788d02a13e4d781f5f8cf3c3",
  },
  {
    model: "kokoro-82m",
    id: "am_eric",
    name: "Eric",
    language: "en-us",
    gender: "male",
    bytes: 522240,
    sha256: "e8b5be17edd1e3636901ce7598baafe2dc8dd8ff707a0c23bf9e461add7e2832",
  },
  {
    model: "kokoro-82m",
    id: "am_fenrir",
    name: "Fenrir",
    language: "en-us",
    gender: "male",
    bytes: 522240,
    sha256: "c27989f741f7ee34d273a39d8a595cc0837d35f5ced9a29b7cc162614616df43",
  },
  {
    model: "kokoro-82m",
    id: "am_liam",
    name: "Liam",
    language: "en-us",
    gender: "male",
    bytes: 522240,
    sha256: "52403be32fd047c6a44517cb0bcd6b134f2a18baa73e70ef41651e0eab921ade",
  },
  {
    model: "kokoro-82m",
    id: "am_michael",
    name: "Michael",
    language: "en-us",
    gender: "male",
    bytes: 522240,
    sha256: "1d1f21dd8da39c30705cd4c75d039d265e9bc4a2a93ed09bc9e1b1225eb95ba1",
  },
  {
    model: "kokoro-82m",
    id: "am_onyx",
    name: "Onyx",
    language: "en-us",
    gender: "male",
    bytes: 522240,
    sha256: "da5d135b424164916d75a68ffb4c2abce3d7d5ccc82dd1ee6cf447ce286145e6",
  },
  {
    model: "kokoro-82m",
    id: "am_puck",
    name: "Puck",
    language: "en-us",
    gender: "male",
    bytes: 522240,
    sha256: "fcf73c989033e9233e0b98713eca600c8c74dcc1614b37009d5450ff4a2274a0",
  },
  {
    model: "kokoro-82m",
    id: "am_santa",
    name: "Santa",
    language: "en-us",
    gender: "male",
    bytes: 522240,
    sha256: "61150cf726ab6c5ed7a99f90a304f91f5a72c00c592e89ec94e5df11c319227a",
  },
  {
    model: "kokoro-82m",
    id: "bf_emma",
    name: "Emma",
    language: "en-gb",
    gender: "female",
    bytes: 522240,
    sha256: "669fe0647f9dd04fcab92f1439a40eeb4c8b4ab1f82e4996fe3d918ce4a63b73",
  },
  {
    model: "kokoro-82m",
    id: "bf_isabella",
    name: "Isabella",
    language: "en-gb",
    gender: "female",
    bytes: 522240,
    sha256: "3754352c4aaa46d17f27654ab7518d65b62ad6163a0f55a5f4330c2da2c4e94f",
  },
  {
    model: "kokoro-82m",
    id: "bf_alice",
    name: "Alice",
    language: "en-gb",
    gender: "female",
    bytes: 522240,
    sha256: "08afa6ba24da61ea5e8efa139e5aadc938d83f0a6da5a900adaf763ac1da5573",
  },
  {
    model: "kokoro-82m",
    id: "bf_lily",
    name: "Lily",
    language: "en-gb",
    gender: "female",
    bytes: 522240,
    sha256: "5e0ee32ebe64a467124976b14e69590746f1c4ce41a12b587a50c862edfea335",
  },
  {
    model: "kokoro-82m",
    id: "bm_george",
    name: "George",
    language: "en-gb",
    gender: "male",
    bytes: 522240,
    sha256: "c4b235a4c1f2cd3b939fed08b899ce9385638b763f7b73a59616c4fc9bd6c9bc",
  },
  {
    model: "kokoro-82m",
    id: "bm_lewis",
    name: "Lewis",
    language: "en-gb",
    gender: "male",
    bytes: 522240,
    sha256: "b8f671cef828c30e66fdf0b0756a76bba58f6bb3398cbbf27058642acbcedb97",
  },
  {
    model: "kokoro-82m",
    id: "bm_daniel",
    name: "Daniel",
    language: "en-gb",
    gender: "male",
    bytes: 522240,
    sha256: "6b3194bbceffb746733cbc22c8f593dd44e401a71d53895a2dca891bc595a1e8",
  },
  {
    model: "kokoro-82m",
    id: "bm_fable",
    name: "Fable",
    language: "en-gb",
    gender: "male",
    bytes: 522240,
    sha256: "f889083196807b4adb15e9204252165f503b8d33d3982e681c52443c49d798f1",
  },
  {
    model: "kokoro-82m",
    id: "ef_dora",
    name: "Dora",
    language: "es",
    gender: "female",
    bytes: 522240,
    sha256: "f66ec66bd295acb18372e37008533a9a3228483ccd294e7538d5d9294ac9a532",
  },
  {
    model: "kokoro-82m",
    id: "em_alex",
    name: "Alex",
    language: "es",
    gender: "male",
    bytes: 522240,
    sha256: "27809e9eafdcbcfff90a3016c697568676531de2a2c39cee29c96c7bd6b83e95",
  },
  {
    model: "kokoro-82m",
    id: "em_santa",
    name: "Santa",
    language: "es",
    gender: "male",
    bytes: 522240,
    sha256: "ad43b774e1ca24d05c6161297d8aeb770ac3d29bb95daf516727af5f7d543683",
  },
  {
    model: "kokoro-82m",
    id: "ff_siwis",
    name: "Siwis",
    language: "fr",
    gender: "female",
    bytes: 522240,
    sha256: "a35f5675ad08948e326ae75fd0ea16ba5d0042e4f76b5f3d1df77d0a48c54861",
  },
  {
    model: "kokoro-82m",
    id: "hf_alpha",
    name: "Alpha",
    language: "hi",
    gender: "female",
    bytes: 522240,
    sha256: "040be6a4425411cc01fda5fd06693c76bfa78572632852bc8cda9c99232ffb56",
  },
  {
    model: "kokoro-82m",
    id: "hf_beta",
    name: "Beta",
    language: "hi",
    gender: "female",
    bytes: 522240,
    sha256: "cd83ae0bb9b2e4e4fb92b4973bd8d1822ca0036d3c498bf4fc89aa8e33917cc7",
  },
  {
    model: "kokoro-82m",
    id: "hm_omega",
    name: "Omega",
    language: "hi",
    gender: "male",
    bytes: 522240,
    sha256: "b02d9222d9ed00ce26b302173a862c2c93f96cc40b5c422b8d14910b9ff34137",
  },
  {
    model: "kokoro-82m",
    id: "hm_psi",
    name: "Psi",
    language: "hi",
    gender: "male",
    bytes: 522240,
    sha256: "644daf88ba8aeb7bd08950bbdcd4453bb280864e49dc4df93fabc6be32e03f37",
  },
  {
    model: "kokoro-82m",
    id: "pf_dora",
    name: "Dora",
    language: "pt-br",
    gender: "female",
    bytes: 522240,
    sha256: "3da7b5b2d91847ebf5646f57631af6ececae3c29a89cd300f06edf9aa6cfe9ee",
  },
  {
    model: "kokoro-82m",
    id: "pm_alex",
    name: "Alex",
    language: "pt-br",
    gender: "male",
    bytes: 522240,
    sha256: "0175c753f59c54e7fd5a995bedef0c5ff2fb67e0043dd3dcb2ae74ec2acbeb2a",
  },
  {
    model: "kokoro-82m",
    id: "pm_santa",
    name: "Santa",
    language: "pt-br",
    gender: "male",
    bytes: 522240,
    sha256: "8b012db3185778afe2e45a62cbad69db73021774fe68dda634bcc748a982eede",
  },
  {
    model: "kokoro-82m",
    id: "jf_alpha",
    name: "Alpha",
    language: "ja",
    gender: "female",
    bytes: 522240,
    sha256: "56b479360aad9f367aeb8cef908f9201cf48b4555e488c5f4590c9dfcd978bb6",
  },
  {
    model: "kokoro-82m",
    id: "jf_gongitsune",
    name: "Gongitsune",
    language: "ja",
    gender: "female",
    bytes: 522240,
    sha256: "0f1181f3772d27b7c12aaf4bcd71e31b186c4146e330d074a3dc64ee392af396",
  },
  {
    model: "kokoro-82m",
    id: "jf_nezumi",
    name: "Nezumi",
    language: "ja",
    gender: "female",
    bytes: 522240,
    sha256: "13cb71eebb0b48739d444558322aa35a8c9a489b80e1e631f14d2e6aea93026b",
  },
  {
    model: "kokoro-82m",
    id: "jf_tebukuro",
    name: "Tebukuro",
    language: "ja",
    gender: "female",
    bytes: 522240,
    sha256: "29c6c0561b4288d59639677bebe7533c919743d5ea68d0d2ae992644beea6696",
  },
  {
    model: "kokoro-82m",
    id: "jm_kumo",
    name: "Kumo",
    language: "ja",
    gender: "male",
    bytes: 522240,
    sha256: "09e959d239724c734d65661f06f14cdabcddfd476bfaaad905a937099ae9e64f",
  },
  {
    model: "kokoro-82m",
    id: "zf_xiaobei",
    name: "Xiaobei",
    language: "zh",
    gender: "female",
    bytes: 522240,
    sha256: "5dde6e1c9c4f12c8b327bc29c0cee361a23b52b952c04636858ba637ec66e640",
  },
  {
    model: "kokoro-82m",
    id: "zf_xiaoni",
    name: "Xiaoni",
    language: "zh",
    gender: "female",
    bytes: 522240,
    sha256: "08892b62a39af0a615cd0581238db7e19e44c578e8fa0bfd0e586e93327d9cba",
  },
  {
    model: "kokoro-82m",
    id: "zf_xiaoxiao",
    name: "Xiaoxiao",
    language: "zh",
    gender: "female",
    bytes: 522240,
    sha256: "03adb5d5e3ddd88b047954e974e651cb0a4b524c985057e5d872e962c7be1169",
  },
  {
    model: "kokoro-82m",
    id: "zf_xiaoyi",
    name: "Xiaoyi",
    language: "zh",
    gender: "female",
    bytes: 522240,
    sha256: "bc1555c5c486099196ac254bae5e0bb543c121952a3092f50b7d8724f1bc36b3",
  },
  {
    model: "kokoro-82m",
    id: "zm_yunjian",
    name: "Yunjian",
    language: "zh",
    gender: "male",
    bytes: 522240,
    sha256: "de48a00bdbf3649f07162269a2b6e0513604389bfac8a2e6c75cb34b323ad6fa",
  },
  {
    model: "kokoro-82m",
    id: "zm_yunxi",
    name: "Yunxi",
    language: "zh",
    gender: "male",
    bytes: 522240,
    sha256: "7243892fb4e560d47014090ddf010f8b8b790f3c6b029ff82b2ac06aa4e27c8b",
  },
  {
    model: "kokoro-82m",
    id: "zm_yunxia",
    name: "Yunxia",
    language: "zh",
    gender: "male",
    bytes: 522240,
    sha256: "6b2b8fc15b3df19a368daebe5c581c7fabf433ee5b8a17ffd6b3d723cff8936d",
  },
  {
    model: "kokoro-82m",
    id: "zm_yunyang",
    name: "Yunyang",
    language: "zh",
    gender: "male",
    bytes: 522240,
    sha256: "261e2c89470534dbbcb8fd98b8fdc495ec94063d9bb6c8277f7be43cccba3f42",
  },
];

/** Supertonic's preset voices (voice_styles/<F1>.json); each speaks every language. */
const SUPERTONIC_VOICES: readonly BuiltinTtsVoice[] = [
  {
    model: "supertonic-3",
    id: "st_F1",
    name: "Female 1",
    language: "any",
    gender: "female",
    bytes: 292046,
    sha256: "bbdec6ee00231c2c742ad05483df5334cab3b52fda3ba38e6a07059c4563dbc2",
  },
  {
    model: "supertonic-3",
    id: "st_F2",
    name: "Female 2",
    language: "any",
    gender: "female",
    bytes: 292423,
    sha256: "7c722c6a72707b1a77f035d67f0d1351ba187738e06f7683e8c72b1df3477fc6",
  },
  {
    model: "supertonic-3",
    id: "st_F3",
    name: "Female 3",
    language: "any",
    gender: "female",
    bytes: 290794,
    sha256: "12f6ef2573baa2defa1128069cb59f203e3ab67c92af77b42df8a0e3a2f7c6ab",
  },
  {
    model: "supertonic-3",
    id: "st_F4",
    name: "Female 4",
    language: "any",
    gender: "female",
    bytes: 291808,
    sha256: "c2fa764c1225a76dfc3e2c73e8aa4f70d9ee48793860eb34c295fff01c2e032b",
  },
  {
    model: "supertonic-3",
    id: "st_F5",
    name: "Female 5",
    language: "any",
    gender: "female",
    bytes: 291479,
    sha256: "45966e73316415626cf41a7d1c6f3b4c70dbc1ba2bee5c1978ef0ce33244fc8d",
  },
  {
    model: "supertonic-3",
    id: "st_M1",
    name: "Male 1",
    language: "any",
    gender: "male",
    bytes: 291748,
    sha256: "e35604687f5d23694b8e91593a93eec0e4eca6c0b02bb8ed69139ab2ea6b0a5b",
  },
  {
    model: "supertonic-3",
    id: "st_M2",
    name: "Male 2",
    language: "any",
    gender: "male",
    bytes: 292055,
    sha256: "b76cbf62bac707c710cf0ae5aba5e31eea1a6339a9734bfae33ab98499534a50",
  },
  {
    model: "supertonic-3",
    id: "st_M3",
    name: "Male 3",
    language: "any",
    gender: "male",
    bytes: 290198,
    sha256: "ea1ac35ccb91b0d7ecad533a2fbd0eec10c91513d8951e3b25fbba99954e159b",
  },
  {
    model: "supertonic-3",
    id: "st_M4",
    name: "Male 4",
    language: "any",
    gender: "male",
    bytes: 291522,
    sha256: "ca8eefad4fcd989c9379032ff3e50738adc547eeb5e221b82593a6d7b3bac303",
  },
  {
    model: "supertonic-3",
    id: "st_M5",
    name: "Male 5",
    language: "any",
    gender: "male",
    bytes: 291469,
    sha256: "dd22b92740314321f8ae11c5e87f8dd60d060f15dd3a632b5adf77f471f77af2",
  },
];

export const BUILTIN_TTS_VOICES: readonly BuiltinTtsVoice[] = [...KOKORO_VOICES, ...SUPERTONIC_VOICES];

const KOKORO_FILES: readonly BuiltinTtsFile[] = [
  { path: "config.json", bytes: 44, sha256: "df34b4f930b23447cd4dc410fabfb42eb3f24e803e6c3f97d618fb359380a36f" },
  { path: "tokenizer.json", bytes: 3497, sha256: "77a02c8e164413299b4b4c403b14f8e0e1c1b727db4d46a09d6327b861060a34" },
  {
    path: "tokenizer_config.json",
    bytes: 113,
    sha256: "be1cb066d6ef6b074b3f15e6a6dd21ac88ff3cdaedf325f0aaed686c70f75d20",
  },
  {
    path: "onnx/model_quantized.onnx",
    bytes: 92_361_116,
    sha256: "fbae9257e1e05ffc727e951ef9b9c98418e6d79f1c9b6b13bd59f5c9028a1478",
  },
];

const SUPERTONIC_FILES: readonly BuiltinTtsFile[] = [
  { path: "onnx/tts.json", bytes: 8253, sha256: "42078d3aef1cd43ab43021f3c54f47d2d75ceb4e75f627f118890128b06a0d09" },
  {
    path: "onnx/unicode_indexer.json",
    bytes: 277_676,
    sha256: "9bf7346e43883a81f8645c81224f786d43c5b57f3641f6e7671a7d6c493cb24f",
  },
  {
    path: "onnx/duration_predictor.onnx",
    bytes: 3_700_147,
    sha256: "c3eb91414d5ff8a7a239b7fe9e34e7e2bf8a8140d8375ffb14718b1c639325db",
  },
  {
    path: "onnx/text_encoder.onnx",
    bytes: 36_416_150,
    sha256: "c7befd5ea8c3119769e8a6c1486c4edc6a3bc8365c67621c881bbb774b9902ff",
  },
  {
    path: "onnx/vector_estimator.onnx",
    bytes: 256_534_781,
    sha256: "883ac868ea0275ef0e991524dc64f16b3c0376efd7c320af6b53f5b780d7c61c",
  },
  {
    path: "onnx/vocoder.onnx",
    bytes: 101_424_195,
    sha256: "085de76dd8e8d5836d6ca66826601f615939218f90e519f70ee8a36ed2a4c4ba",
  },
];

const voiceBytes = (model: BuiltinTtsModelId) =>
  BUILTIN_TTS_VOICES.filter((voice) => voice.model === model).reduce((sum, voice) => sum + voice.bytes, 0);
const fileBytes = (files: readonly BuiltinTtsFile[]) => files.reduce((sum, file) => sum + file.bytes, 0);

export const BUILTIN_TTS_MODELS: readonly BuiltinTtsModelInfo[] = [
  {
    id: "kokoro-82m",
    label: "Kokoro-82M",
    repo: "onnx-community/Kokoro-82M-v1.0-ONNX",
    revision: "1939ad2a8e416c0acfeecc08a694d14ef25f2231",
    license: "Apache 2.0",
    sampleRate: 24_000,
    ramBytes: 400_000_000,
    files: KOKORO_FILES,
    downloadBytes: fileBytes(KOKORO_FILES) + voiceBytes("kokoro-82m"),
  },
  {
    id: "supertonic-3",
    label: "Supertonic 3",
    repo: "Supertone/supertonic-3",
    revision: "724fb5abbf5502583fb520898d45929e62f02c0b",
    license: "OpenRAIL-M",
    sampleRate: 44_100,
    ramBytes: 900_000_000,
    files: SUPERTONIC_FILES,
    downloadBytes: fileBytes(SUPERTONIC_FILES) + voiceBytes("supertonic-3"),
  },
];

export const BUILTIN_TTS_DEFAULT_VOICE: Readonly<Record<BuiltinTtsModelId, string>> = {
  "kokoro-82m": "af_heart",
  "supertonic-3": "st_F1",
};

/** The model to offer first for an Engine language: Supertonic where only it speaks the language, else Kokoro. */
export function recommendedBuiltinTtsModel(language: string | null | undefined): BuiltinTtsModelId {
  const base = (language ?? "en").toLowerCase().split(/[-_]/)[0];
  return base === "ko" || base === "ja" || base === "de" || base === "pl" || base === "ru"
    ? "supertonic-3"
    : "kokoro-82m";
}

/** A saved mix of voices of one model: `id` is the voice the Voice job uses ("af_bella:60+am_puck:40"). */
export interface BuiltinTtsBlend {
  id: string;
  name: string;
  model: BuiltinTtsModelId;
}

/** The TTS source that speaks with the built-in voice model. */
export const BUILTIN_TTS_SOURCE = "builtin";

export interface BuiltinTtsSettings {
  /** Supertonic's reading language; "auto" picks it from the text's script. */
  language: BuiltinTtsReadingLanguage;
  /** With "auto": the language Latin-script text is read in. */
  latinLanguage: BuiltinTtsLatinLanguage;
}

export interface BuiltinTtsStatus {
  /** False in Lite builds and where onnxruntime has no native build for this machine. */
  supported: boolean;
  models: readonly BuiltinTtsModelInfo[];
  /** Models whose files are all on disk. */
  installed: BuiltinTtsModelId[];
  /** The model the Voice job speaks with: an installed one, or null. */
  activeModelId: BuiltinTtsModelId | null;
  /** Loaded in memory (it loads on the first line it speaks and unloads after 15 minutes unused). */
  loaded: boolean;
  loading: boolean;
  error: string | null;
  download: (SidecarDownloadProgress & { modelId: BuiltinTtsModelId }) | null;
  voices: readonly BuiltinTtsVoice[];
  blends: BuiltinTtsBlend[];
  settings: BuiltinTtsSettings;
}
