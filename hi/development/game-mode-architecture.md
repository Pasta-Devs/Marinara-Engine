# Game Mode आर्किटेक्चर: नियमसेट, चेक और लड़ाई

यह Game Mode के नियमों का कोड बदलने वाले लोगों के लिए नक्शा है: नियमसेट कहाँ पढ़ा जाता है, चेक और लड़ाई का नतीजा कैसे निकाला जाता है, स्टेट कहाँ रखा जाता है और नियमसेट की नई कुंजी को क्या चाहिए। खिलाड़ियों के दस्तावेज़ `docs/game/` में हैं, नियमसेट की लेखक गाइड [`docs/extending/writing-rulesets.md`](../extending/writing-rulesets.md) से शुरू होती है और लड़ाई AI का अपना पेज है, [Game Mode लड़ाई AI](game-combat-ai.md)।

## क्या कहाँ है

| क्षेत्र | कोड |
| --- | --- |
| नियमसेट का फ़ॉर्मैट | `packages/shared/src/schemas/ruleset.schema.ts`: zod स्कीमा, `RulesetRef` (पिन) और इंपोर्ट पर चलने वाली आपसी जाँचें। एडिटर का JSON Schema, `docs/extending/ruleset.schema.json`, इसी से `pnpm ruleset:schema` के ज़रिए जेनरेट होता है। |
| Capability API | `packages/shared/src/schemas/capability-package.schema.ts` में `supportedCapabilityApi`, जिसमें हर माइनर वर्ज़न के लिए एक कमेंट लाइन बताती है कि उसने क्या जोड़ा। |
| शीट की गणना और लाइव स्टेट | `packages/shared/src/features/rulesets/`: `sheet-math.ts`, `live-state.ts` (`[sheet:]` ऑपरेशन), `sheet-commands.ts`, `sheet-builder.ts`, `layers.ts`, `item-*.ts`, `loot.ts`, `market.ts`, `combat-bridge.ts` (`battle` ब्लॉक)। |
| नियमसेट की लड़ाइयाँ | `packages/shared/src/features/ruleset-combat/`: `resolve.ts`, `options.ts` (मेनू में क्या है), `grid.ts`, `sight.ts`, `zones.ts`, `creatures.ts`, `pool.ts`, `symbols.ts`, `dice.ts`। सभी `(definition, state)` पर काम करने वाले प्योर फ़ंक्शन हैं। |
| Marinara की अपनी लड़ाई | `packages/shared/src/features/tactical-combat/` (Tactical इंजन, ग्रिड जेनरेशन, AI), `combat-director.ts`, `combat-conditions.ts`। |
| लड़ाई AI | `packages/shared/src/features/combat-ai.ts`, `combat-minds.ts`; [Game Mode लड़ाई AI](game-combat-ai.md) देखें। |
| सर्वर: नियमसेट | `packages/server/src/services/game/ruleset-registry.service.ts` (इंस्टॉल और इंपोर्ट किए गए नियमसेट पढ़ता है, गेम का पिन रिज़ॉल्व करता है), `ruleset-catalog.service.ts`, `ruleset-sheet-turn.service.ts` (टर्न की `[sheet:]` कमांड लागू करता है), `game-ruleset-version.service.ts`, `routes/game-rulesets.routes.ts`। |
| सर्वर: चेक और डाइस | `skill-check-resolution.service.ts`, `skill-check.service.ts`, `dice.service.ts`, `dice-pool.service.ts`, `one-request-dice.ts`, `dice-rng.ts`। |
| सर्वर: लड़ाइयाँ | `combat-director.service.ts` (Classic और Tactical), `combat.service.ts` (Classic राउंड की गणना, `resolveCombatRound`), `ruleset-combat-director.service.ts` (वह लड़ाई जिसका नतीजा नियमसेट निकालता है), `combat-ai.service.ts`, `combat-boss.service.ts`, `tactical-battlefield.service.ts`, `made-battlefield.service.ts`। रूट: `routes/combat-director.routes.ts` (डायरेक्टर की शुरुआत, स्टेट और कमांड), `routes/encounter.routes.ts`, और `routes/game.routes.ts` में पुराने `POST /game/combat/round`, `/game/combat/tactical/start` और `/game/combat/tactical/action`। |
| प्रॉम्प्ट | `gm-prompts.ts` (`buildGmFormatReminder`, शीट ब्लॉक और सिखाए गए टैग)। |
| क्लाइंट | `packages/client/src/components/game/`: `GameRulesetSheet.tsx`, `GameSetupRulesChooser.tsx`, `RulesetCombatScreen.tsx` और बाकी `RulesetCombat*.tsx`, `TacticalCombatUI.tsx`, `GameCombatUI.tsx`, `DirectedCombatUI.tsx`। |

## नियमसेट, पैकेज से गेम तक

1. **स्रोत।** आधिकारिक नियमसेट `ruleset` किस्म का क्षमता पैकेज होता है जो `contributions.assets.paths` में `ruleset.json` (और कोई भी `catalogs/<id>.json`) सूचीबद्ध करता है और `files[]` में उनके हैश पिन करता है। कम्युनिटी नियमसेट एक फ़ाइल, `<name>.ruleset.json` पैकेज फ़ाइल या रिपॉज़िटरी के `rulesets/` फ़ोल्डर से इंपोर्ट किया जाता है और नेमस्पेस वाले id (`local/<id>`, `<owner>/<id>`) के तहत रखा जाता है, ताकि वह कभी किसी आधिकारिक नियमसेट को ढक न सके।
2. **भाषा।** आधिकारिक नियमसेट के अनुवाद हर भाषा के अलग पैक होते हैं जो उसकी कैटलॉग एंट्री में सूचीबद्ध होते हैं; पैकेज मैनेजर सिर्फ़ Engine की भाषा रखता है (`package-manager.service.ts` में `syncRulesetLocalePack`)। इंपोर्ट की गई पैकेज फ़ाइल सिर्फ़ इंपोर्ट के समय सक्रिय भाषा रखती है।
3. **रजिस्ट्री।** `ruleset-registry.service.ts` साझा स्कीमा से हर परिभाषा पार्स करता है और जो इस्तेमाल करने लायक नहीं है उसे लॉग लाइन लिखकर छोड़ देता है। परिभाषाएँ id और वर्ज़न के हिसाब से रखी जाती हैं; अलग बाइट वाले उसी वर्ज़न को अस्वीकार किया जाता है।
4. **पिन।** गेम बनाते समय `chat.metadata.gameRuleset` एक बार लिखा जाता है: `{ id, version, packageId, source?, options }`, जिसमें `options` चुनी गई लेयर रखता है। पिन न होने का मतलब Marinara के अपने नियम हैं। जिस पिन को यह इंस्टॉलेशन पूरा नहीं कर सकता (नियमसेट गायब हो या उसका वर्ज़न पिन से पुराना हो), उसकी जानकारी दी जाती है और गेम के चेक लंबित रहते हैं; उनका नतीजा कभी दूसरे सिस्टम के नियमों से नहीं निकाला जाता।

## स्टेट

| हिस्सा | क्या रहता है | कहाँ | स्वाइप के साथ पीछे लौटता है |
| --- | --- | --- | --- |
| शुरुआती बिल्ड | वह शीट जो खिलाड़ी कार्ड या पर्सोना पर भरते हैं | कार्ड का `data.extensions.rulesetSheets[rulesetId]`, पर्सोना का `personaStats.rulesetSheets[rulesetId]` | लागू नहीं |
| गेम बिल्ड | सेटअप के समय ली गई कॉपी, जिसे **Edit sheet** (शीट एडिट करें) और स्तर बढ़ने से बदला जाता है | `chat.metadata.gameCharacterCards[].rulesetSheet` | नहीं |
| लाइव स्टेट | पूल, ट्रैक, स्थितियाँ, स्टेट, नोट | `game_state_snapshots.ruleset_live` | हाँ |
| लड़ाई | एनकाउंटर, उसका सीड और डाइस कर्सर, किसका टर्न है | लड़ाई डायरेक्टर की स्टोरेज पंक्ति, हर चैट के लिए एक | इसे शुरू करने वाले टर्न के साथ रिस्टोर होती है |

लाइव स्टेट स्नैपशॉट का हिस्सा होता है ताकि दोबारा जेनरेट किया गया टर्न कभी दो बार खर्च न करे। सेव की गई शीट `{ v, build }` होती है, जिसकी सीमा 64 KB है और जिसे ढील के साथ पढ़ा जाता है: अनजान फ़ील्ड रखी जाती हैं और गायब फ़ील्ड डिफ़ॉल्ट लेती हैं। मानों को नए id पर ले जाने वाला लेआउट `sheet.migrations` घोषित करता है, जिन्हें पढ़ते समय `readRulesetSheetEnvelope` और `readStoredLiveState` लागू करते हैं। जो नियमसेट इंस्टॉल नहीं है उसकी शीट निष्क्रिय रखी जाती है, कभी हटाई नहीं जाती।

## चेक, शुरू से अंत तक

1. Game Master `[skill_check: …]` लिखता है, जिसमें वैकल्पिक रूप से `who=`, `with=`, लैडर के चरण का नाम, चार्म या खर्च हो सकता है। एक रिक्वेस्ट वाले डाइस चालू होने पर वह इसके बजाय ब्रांच ब्लॉक या `[[roll: …]]` प्लेसहोल्डर लिख सकता है (`one-request-dice.ts`)।
2. `skill-check-resolution.service.ts` पिन किया गया नियमसेट पढ़ता है और `resolution.kind` के आधार पर काम सौंपता है: `dice-sum`, `dice-pool`, `dice-highest`, `roll-against` या `symbol-pool`। मॉडल की लिखी संख्याओं की जाँच करके उन्हें बदला जाता है, जब तक नियमसेट उन्हें भरोसेमंद न माने; पूल, रखे गए डाइस और श्रेणीबद्ध नतीजों को कभी भरोसेमंद नहीं माना जाता।
3. डाइस: चेक `rollDieSecurely` से डाइस रोल करता है (Web Crypto, `packages/shared/src/utils/dice-notation.ts` में)। नियमसेट की लड़ाई, उसमें आइटम के इस्तेमाल, लूट और बाज़ार उसी मॉड्यूल के `seededDieRoller(seed, cursor)` से डाइस रोल करते हैं, ताकि लड़ाई अपने सीड से दोबारा चलाई जा सके। #8608 के बाद से डाइस रोल करने वाला कोई दूसरा फ़ंक्शन नहीं है।
4. नतीजा पूरे टैग और डाइस कार्ड के रूप में वापस लिखा जाता है और **Logs** (लॉग) में दर्ज होता है।

## शीट कमांड

Game Master `[sheet: who="Name" op="…"]` से शीट बदलता है। टैग में बताए जा सकने वाले ऑपरेशन हैं `spend`, `restore` (दूसरा नाम `heal`), `damage`, `temp`, `track`, `condition`, `state`, `note`, `rest`, `use` (दूसरा नाम `cast`), `pass`, `advance`, `dismiss`, `prepare` और `unprepare` (`live-state.ts` में `RULESET_SHEET_OP_NAMES` और `RulesetSheetOp`)। `ruleset-sheet-turn.service.ts` हर ऑपरेशन को लाइव शीट से जाँचता है; जो हो नहीं सकता, जैसे कोई स्लॉट बचे बिना स्पेल कास्ट करना, उसे अस्वीकार करके लॉग में दर्ज किया जाता है और हर टर्न में एक बार दिखाया जाता है, और कुछ भी आधा लागू नहीं होता। `sheet` आरक्षित GM टैग है।

## लड़ाई, शुरू से अंत तक

गेम की लड़ाई तीन शैलियों में से किसी एक में खेली जाती है, जिसे नियमसेट और गेम की **Combat Preference** (लड़ाई की पसंद) चुनते हैं:

| नियमसेट | शैली | सर्वर |
| --- | --- | --- |
| कोई नहीं, या `battle`/`combat` ब्लॉक नहीं | Marinara की Classic या Tactical लड़ाई | `combat-director.service.ts` |
| `battle` ब्लॉक | Marinara की लड़ाई, जिसे शीट के पूल, स्लॉट और कैटलॉग स्किल दिए जाते हैं; स्वास्थ्य अधिकतम के अनुपात के रूप में लिया जाता है और वापस लिखा जाता है | `combat-bridge.ts` के साथ `combat-director.service.ts` |
| `combat` ब्लॉक | नियमसेट की अपनी लड़ाई, जो बोर्ड पर होती है जब `combat` एक खाने की दूरी देता है और गेम Tactical में है | `ruleset-combat-director.service.ts` |

तीनों डायरेक्टर की एक ही बही इस्तेमाल करते हैं: हर चैट के लिए एक स्टोरेज पंक्ति, एक रिविज़न, रिक्वेस्ट-id की जाँच और हर चैट की अलग कतार। बही सिर्फ़ डायरेक्टर से चलने वाली लड़ाइयों को कवर करती है। `game.routes.ts` के पुराने रूट, `POST /game/combat/round` (जो भेजे गए लड़ाकों पर `resolveCombatRound` कॉल करता है), `/game/combat/tactical/start` और `/game/combat/tactical/action`, कोई बही नहीं रखते: क्लाइंट लड़ाई का स्टेट रखता है और हर कॉल के साथ वापस भेजता है। नियमसेट की लड़ाई में मेनू वैधता तय करता है (`options.ts`), रिज़ॉल्वर चयन लागू करता है (`resolve.ts`), डाइस लड़ाई के सीड और कर्सर से आते हैं और पार्टी का सदस्य जो भी खर्च करता या खोता है, उसे शीट के अपने नियमों के ज़रिए लिखा जाता है, ताकि लड़ाई के बीच टैब बंद करने पर कुछ न खोए। जिन विरोधियों को किसी ने नहीं लिखा, उन्हें नियमसेट की जीव सूची और एनकाउंटर बजट से बनाया जाता है; Game Master नाम वाले विरोधी और बॉस चला सकता है, जिसके लिए वह Engine के प्राथमिकता के क्रम में रखे गए सुझावों से चुनता है।

## नियमसेट में कुंजी जोड़ना

1. इसे इसकी आपसी जाँचों के साथ `ruleset.schema.ts` में और रिज़ॉल्वर जिन TypeScript टाइप को पढ़ता है उनमें जोड़ें।
2. `supportedCapabilityApi` को एक माइनर वर्ज़न बढ़ाएँ और उसकी कमेंट लाइन जोड़ें। कुंजी पर ऐसी शर्त लगाएँ कि उसे इस्तेमाल करने वाला नियमसेट उस माइनर वर्ज़न या उससे नए वर्ज़न की घोषणा करे।
3. इसे पहले प्योर साझा कोड में इम्प्लीमेंट करें, फिर सर्वर से जोड़ें, फिर क्लाइंट से।
4. `docs/extending/ruleset.schema.json` को दोबारा जेनरेट करने के लिए `pnpm ruleset:schema` चलाएँ।
5. लेखक गाइड के संबंधित पेज (`docs/extending/ruleset-*.md`) पर इसका विवरण लिखें, और अगर खिलाड़ी इसे देखेंगे तो उनके दस्तावेज़ों में भी लिखें।
6. `scripts/regressions/*.regression.ts` जोड़ें जो इसे प्योर कोड से चलाकर जाँचे और उसमें अस्वीकार किया गया इनपुट भी शामिल हो।
7. खुले `[docs-i18n]` इश्यू पर बदले हुए अंग्रेज़ी पेजों की सूची दें।

`docs/development/ruleset-5e-2014.example.json` 5e का छोटा किया गया ड्राफ़्ट है जिसे सैकड़ों रिग्रेशन और शुरू से अंत तक चलने वाले टेस्ट फ़िक्स्चर के रूप में पढ़ते हैं। यह जारी किया गया SRD पैकेज नहीं है, जो Marinara-Agents में `packages/ruleset-5e-2014/` के तहत है।

## बाकी काम

- नियमसेट के बोर्ड पर बाधाओं के ऊपर उड़ना: उड़ने वाले को भी बाकी सबकी तरह चलाया जाता है।
- Marinara की अपनी Classic और Tactical लड़ाई में समन करना (नियमसेट की लड़ाइयों में पहले से समन होता है)। डिज़ाइन [Game Mode लड़ाई AI](game-combat-ai.md#summoning-design-extension) में है।
- Battlefield Scout Agent जो लड़ाई के टेरेन का संक्षिप्त विवरण तैयार करे, जिसका विवरण [Game Mode लड़ाई AI](game-combat-ai.md#encounter-environment-agent-handoff) में है।
