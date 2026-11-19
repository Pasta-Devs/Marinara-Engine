import assert from "node:assert/strict";
import { looksMostlyNonEnglish } from "../../packages/shared/src/utils/english-text-check.js";

// Marinara's own search model is English-only; the memories window suggests a multilingual model when this is true.
const samples: Record<string, string> = {
  en: 'Mari: You walked into the tavern and the barkeep looked up at you with a tired smile. "What can I get you?" she asked, wiping a glass. User: I sat down at the bar and asked her about the strange lights over the hills last night.',
  es: 'Mari: Entraste en la taberna y la tabernera te miró con una sonrisa cansada. "¿Qué te sirvo?" preguntó, limpiando un vaso. User: Me senté en la barra y le pregunté por las luces extrañas sobre las colinas anoche.',
  de: 'Mari: Du betrittst die Taverne und die Wirtin sieht dich mit einem müden Lächeln an. "Was darf es sein?" fragt sie und wischt ein Glas ab. User: Ich setze mich an die Theke und frage sie nach den seltsamen Lichtern über den Hügeln letzte Nacht.',
  fr: "Mari: Tu entres dans la taverne et la tavernière lève les yeux vers toi avec un sourire fatigué. « Qu'est-ce que je te sers ? » demande-t-elle en essuyant un verre. User: Je m'assois au comptoir et je lui demande ce que sont ces lumières étranges au-dessus des collines hier soir.",
  it: 'Mari: Entri nella taverna e la locandiera ti guarda con un sorriso stanco. "Cosa ti porto?" chiede, pulendo un bicchiere. User: Mi siedo al bancone e le chiedo delle strane luci sopra le colline la notte scorsa.',
  ja: "マリ：あなたが酒場に入ると、女主人は疲れた笑顔であなたを見上げた。「何にする？」とグラスを拭きながら尋ねた。ユーザー：私はカウンターに座り、昨夜丘の上に見えた奇妙な光について尋ねた。",
  ru: "Мари: Ты входишь в таверну, и хозяйка поднимает на тебя усталый взгляд. «Что тебе налить?» — спрашивает она, протирая стакан. Пользователь: Я сажусь у стойки и спрашиваю о странных огнях над холмами прошлой ночью.",
};

assert.equal(looksMostlyNonEnglish([samples.en!]), false, "English reads as English");
for (const language of ["es", "de", "fr", "it", "ja", "ru"]) {
  assert.equal(looksMostlyNonEnglish([samples[language]!]), true, `${language} reads as not English`);
}
assert.equal(looksMostlyNonEnglish(["Hola amigo"]), false, "too little text stays silent");
assert.equal(looksMostlyNonEnglish([]), false, "no text stays silent");
assert.equal(
  looksMostlyNonEnglish([samples.en!, samples.en!, samples.es!]),
  false,
  "mostly English with a little Spanish stays silent",
);

console.log("english-text-check regression passed");
