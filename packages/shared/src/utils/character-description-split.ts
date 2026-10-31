// ─────────────────────────────────────────────────────────────
// Character description split
// ─────────────────────────────────────────────────────────────
// Splits an imported card's description into Marinara's fields (description, personality,
// appearance, backstory, scenario, system_prompt, mes_example) using pattern rules only: no AI.
//
// Recognised layouts (all mixed freely inside one card)
//   - "Label: value", "**Label:** value", "# Label", "[Label:", "<label>...</label>", "{{"Label"}}: {...}"
//   - W++ "Label(value)" / "Label(" with the values on the next lines, "{{char}}'s Likes (...)"
//   - one-line cards: "[Name: age (21), sex (Female), ...]", "Name: Daiyu ... Hair: Black ... Sex: Female"
//   - JSON descriptions (converted to "Key: value" lines)
//   - <START> example blocks and interview-style dialogue runs ("Interviewer:" / "{{char}}:"); an interview
//     whose questions name fields ("{{user}}: Appearance?") puts each answer in that field instead
//   - unlabelled prose sorted by keywords, and OOC / rules text moved to the system prompt
//
// Guarantees
//   - Lossless: every character of the description ends up in one of the fields, except separators
//     ("---", lone brackets), wrapper tags named after the character, and headers that only repeat the
//     destination field's name ("Appearance:"). A card that cannot be split losslessly is left alone.
//   - Fields that already have text are appended to. Text already present in the field is not added
//     twice; old field text repeated inside the moved text is replaced by it.
//   - Multi-character, narrator/game-master and world cards are skipped unless `force` is set.

export const DESCRIPTION_SPLIT_FIELDS = [
  "description",
  "personality",
  "appearance",
  "backstory",
  "scenario",
  "system_prompt",
  "mes_example",
] as const;
export type DescriptionSplitField = (typeof DESCRIPTION_SPLIT_FIELDS)[number];
export type DescriptionSplitFields = Record<DescriptionSplitField, string>;

/** The card fields the split reads: a `CharacterData`, a raw card or a store row's parsed data. */
export interface DescriptionSplitSource {
  name?: string | null;
  description?: string | null;
  personality?: string | null;
  scenario?: string | null;
  system_prompt?: string | null;
  mes_example?: string | null;
  extensions?: Record<string, unknown> | null;
}

export interface DescriptionSplitOptions {
  /** Sort unlabelled prose paragraphs by keywords (default true). */
  prose?: boolean;
  /** Move OOC / rules / "don't speak for {{user}}" lines to the system prompt (default true). */
  instructions?: boolean;
  /** Split even when the card looks like a narrator, world or multi-character card. */
  force?: boolean;
}

export type DescriptionSplitStatus = "changed" | "unchanged" | "skipped";

/** A split always lands as a new card or persona version so the unsplit card stays in the history. */
export const DESCRIPTION_SPLIT_VERSION = {
  source: "description-split",
  reason: "Split description into fields",
} as const;

export interface DescriptionSplitResult {
  status: DescriptionSplitStatus;
  /** Why a skipped card was left alone. */
  reason?: string;
  before: DescriptionSplitFields;
  after: DescriptionSplitFields;
  changed: DescriptionSplitField[];
  /**
   * Some moved text had no label and was sorted by its wording alone (plain prose), so the result
   * deserves a look; a labelled card never sets this.
   */
  keywordSorted: boolean;
  notes: string[];
}

// ───────────────────────────── label vocabulary ─────────────────────────────
// Labels are compared after normalisation: lower case, {{char}} and the character's own name
// removed, punctuation turned into spaces ("Sex/Gender" -> "sex gender", "{{char}}'s Likes" -> "likes").
const EXACT_SOURCE: Record<DescriptionSplitField, string> = {
  description: `name|full name|first name|middle name|family name|last name|surname|nickname|nicknames|alias|aliases|
    also known as|aka|pronouns|age|birthday|birth date|date of birth|year of birth|born|gender|gender identity|sex gender|
    species|race|race species|specie|ethnicity|nationality|occupation|occupation role|job|profession|role|role background|
    work|actual work|title|rank|class|house|status|civil state|relationship status|net worth|wealth|family wealth|
    family noble status|residence|current residence|home|living situation|relationship|relationships|relations|
    relationship to user|relationship with user|dynamic with user|family|connections|notable social connections|
    best friend|best friends|childhood friend|childhood friends|friends|skills|skill|abilities|ability|powers|power|powers skills|special attributes|special abilities|
    magic|arcane magic school|talents|education|job and education|overview|summary|concept|profile|identity|
    basic info|basic information|basic details|basics|general profile|character information|character info|info|
    character definition|other|notes|additional info|additional information|additional notes|facts about the character|
    other characters|npcs|npc|blessed by|fighting style|affiliation|faction|name and age|identity and life|description|
    father|mother|parents|parent|sister|sisters|brother|brothers|sibling|siblings|son|daughter|children|kids|wife|husband|
    spouse|stepmother|stepfather|step mother|step father|stepsister|stepbrother|step sister|step brother|mama|papa|mom|dad|
    grandmother|grandfather|grandparents|uncle|aunt|cousin|cousins|pet|pets|familiar|worships|worship|religion|deity|patron|
    country|hometown|home town|birthplace|dorm|dorm room|room|apartment|address|spells|spell|unique spells|special magic|
    magic type|magic style|attributes|stats|statistics|level|minions|servants|allies|enemies|rivals|rival|inventory|items|
    possessions|belongings|member of|membership|organization|organisation|guild|team|key knowledge|knowledge|languages|
    language|vocabulary|trivia|fun facts|misc|miscellaneous|extra|extras|other info|additional details|details|position|
    reputation|titles|alignment|social status|social class|economic status|financial status|income|salary|vehicle|car|
    health|medical|illness|diagnosis|condition|conditions`,
  appearance: `appearance|apperance|appeareance|appearence|appearance details|looks|physical appearance|
    physical description|physical|physical traits|physical features|physical attributes|physical profile|physicality|
    basic physical appearance|body|body type|body shape|build|physique|figure|height|weight|height and weight|hair|
    hair color|hairstyle|eyes|eye color|face|facial features|skin|skin tone|complexion|skin ethnicity|features|
    notable features|distinguishing features|breasts|breast size|bust|boobs|chest|cup size|ass|butt|rear|ass asshole|
    hips|waist|thighs|legs|genitals|genitalia|genitals pussy breasts|privates|pussy|penis|measurements|body measurements|
    clothing|clothes|outfit|outfits|usual clothing|typical outfit|typical outfits|clothing style|style|attire|wardrobe|
    uniform|accessories|jewelry|footwear|shoes|top|bottoms|underwear|lingerie|armor|armour|weapons|weapon|equipment|
    gear|scent|smell|makeup|tattoos|scars|tail|ears|wings|horns|number of arms|grooming|appearance grooming|
    main outfit|formal outfit|sleeping outfit|running outfit|exercise outfit|swimsuit|swimwear|under the clothes|
    appearance and style|hair and accessories|face and makeup|height and build|bust and rear|clothing and equipment|
    shoe size|shoe feet size|feet size|foot size|feet|foot|hands|nails|teeth|fangs|claws|fur|fur color|fur colour|scales|
    feathers|horn|eyebrows|eyelashes|lips|nose|cheeks|neck|shoulders|arms|belly|stomach|navel|back|piercings|piercing|
    birthmarks|birthmark|markings|marks|pubic hair|body hair|cock|dick|cock size|penis size|dick size|balls|dress|dresses|
    casual outfit|casual wear|casual clothes|work outfit|work uniform|school uniform|school outfit|home outfit|nightwear|
    pajamas|pyjamas|sleepwear|battle outfit|combat outfit|armor set|untamed form|true form|other forms|forms|form|
    transformation|transformations|beast form|human form|bust size|hip size|waist size|sizes|size|appearance notes|visual|
    visuals|visual description|design|character design|aesthetic|color scheme|colors|colours|distinguishing marks|
    notable physical traits|physical notes|anatomy|body details|skin color|skin colour|hair style|hair length|hair colour|
    eye colour|iris|pupils|gait|posture|default expression|resting face|smile|hygiene|appearance summary|
    bust circumference|waist circumference|hip circumference|thigh circumference|band underbust circumference|
    underbust|band circumference|circumference|sensory details`,
  personality: `personality|personality traits|personality overview|key personality traits|traits|trait|
    positive traits|negative traits|positive|negative|positive personality traits|negative personality traits|
    inner personality|outer personality|core traits|core personality|core self|temperament|mind|mental|mentality|
    psyche|psychology|psychological profile|quirks|quirk|quirks habits|habits|habit|mannerisms|tics|ticks|behavior|
    behaviour|behaviors|behaviours|behavior and habits|behavioral notes|behavioural notes|behavioral guidelines|
    behavioral priorities|behaviors and intentions|speech|speech style|speaking style|speech patterns|
    speech and mannerisms|speech and communication|speech style and quirks|voice|voice and mannerisms|dialogue|
    dialogue style|tone|way of speaking|accent|likes|dislikes|loves|hates|likes and dislikes|likes dislikes|hobbies|
    hobby|hobbies interests|hobbies and interests|interests|favorite things|favourite things|favorites|favourites|
    preferences|preference|fears|fear|deep rooted fears|phobias|trauma and fears|goals|goal|motivation|motivations|
    motivations priorities|priorities|desires|dreams|ambitions|secrets|secret|values|core values|beliefs|opinions|
    worldview|worldview and fears|philosophy|core philosophy|archetype|character archetype|personality archetype|
    character type|vibe|emotional state|current emotional state|emotional core|emotions|feelings|feelings about user|
    attitude|attitude towards user|kinks|kink|fetishes|fetish|kinks fetishes|kinks and fetishes|kinks discovered|
    sexuality|sexual orientation|orientation|sexual preference|sexual preferences|sexual attraction|sexual behavior|
    sexual behaviour|sexual characteristics|sexual info|sexual|sex life|sexual experience|sex experience|experience|
    libido|turn ons|turn offs|intimacy|intimacy and desires|romance|romantic behavior|romantic experience|
    sexual quirks|sexual quirks and habits|sexual habits|sex and intimacy|bedroom persona|behavior in bed|during sex|
    aftercare|flirting style|lifestyle and habits|habits and small behaviors|social behavior|public mask|true self|
    inner thoughts|actions|mood|weaknesses|weakness|strengths|tags|personality and traits|personality and psychology|
    personality and psyche|mind and personality|good at|bad at|enjoys|boundaries|limits|hard limits|soft limits|comforts|
    insecurities|insecurity|pet peeves|pet peeve|annoyances|coping mechanisms|coping|flaws|flaw|virtues|vices|vice|morals|
    morality|ethics|ideals|ideology|political views|politics|sense of humor|sense of humour|humor|humour|temper|moods|
    social skills|social life|opinion of user|view of user|thoughts on user|feelings towards user|feelings toward user|
    inner conflict|internal conflict|conflict|character development|development|character arc|arc|growth|dynamics|dynamic|
    interactions|interaction|behavior towards user|behaviour towards user|behavior around user|behaviour around user|
    love language|dating|flirting|seduction|seduction style|sex style|sexual style|positions|favorite position|
    favorite positions|favourite position|favorite food|favorite foods|favourite food|favorite color|favourite colour|
    favorite colour|favorite music|favourite music|favorite drink|favourite drink|favorite|favourite|least favorite|
    least favourite|daily routine|routine|schedule|daily life|lifestyle|sleep schedule|diet|addiction|addictions|drug use|
    smoking|drinking|mental health|mental state|disorders|disorder|
    intelligence|iq|wit|charisma|confidence|self esteem|self image|body image|view on sex|views on sex|thoughts on sex|
    view on love|views on love|verbal tics|catchphrase|catchphrases|phrases|common phrases|slang|sayings|typical lines|
    laugh|laughter|reaction|reactions|personality type|mbti|enneagram|zodiac|horoscope|q|question|questions|a|answer|answers|
    persona`,
  backstory: `backstory|back story|background|background story|history|past|origin|origins|origin story|biography|bio|
    upbringing|childhood|synopsis|story|lore|life story|additional lore|backstory and history|life events|key events|
    timeline|early life|teen years|adult life|recent events|recent history|past relationships|past events|past life|
    previous life|how they met|how she met user|how he met user|how you met|first meeting|tragedy|trauma|traumas|incident|
    the incident|accident|loss|defining moment|turning point|family history|family background|legacy|heritage|lineage|
    ancestry|bloodline`,
  scenario: `scenario|setting|world|world setting|world info|world description|world lore|setting world|setting and world|
    location|time period|era|genre|premise|story premise|plot|situation|current situation|circumstances|context|
    scenario setting|scenario genre|scenario background|scenario setup|scenario type|scenario tags|
    notes on the setting|time|current events|current state|present|present day|starting point|starting scenario|
    start of story|opening|opening scene|intro|introduction|starting situation|state of the world|the world|
    lore of the world|world building|worldbuilding|map|geography|locations|places|rules of the world|magic system|
    power system|technology|tech level|society|culture|cultures|customs|economy|environment|climate|weather|time of day|
    date|year|day|season|setting details|quest|quests|mission|missions|plot points|plot hooks|hooks|events|story events|
    chapters|chapter|act|themes|theme`,
  system_prompt: `rules|rule|system|system note|system notes|system instructions|system prompt|instructions|instruction|
    ai instructions|ai instruction|guidelines|important guidelines|roleplay rules|rp rules|roleplay guidelines|
    role playing guidelines|writing instructions|writing style|writing perspective and tense|narration|
    narrative consistency|character embodiment|format|formatting|response format|display|ooc|occ|important|
    very important|importance|note to ai|guardrails|strict|strict stay in character always|directives|author note|
    authors note|scenario instructions|important notes|roleplay notes|ai guidance|ai notes|notes for ai|notes for the ai|
    note for the ai|note to the ai|ai behavior|ai behaviour|ai rules|model instructions|model notes|for the ai|for the model|
    do not|dont|never|always|reminder|reminders|constraints|limitations|restrictions|requirements|prohibited|forbidden|
    banned|avoid|allowed|not allowed|style guide|style guidelines|response style|response length|output format|
    formatting rules|pov|point of view|perspective|tense|writing tense|narration style|narrative style|narrative|prose style|
    dialogue format|message format|post format|reply format|reply length|pacing|content rules|content guidelines|nsfw rules|
    nsfw|sfw|rating|content rating|keep in mind|things to remember|remember|things to avoid|things to note|
    meta|meta notes|technical notes|how to use|how to use this card|commands|command`,
  mes_example: `sample dialogue|sample dialogues|example dialogue|example dialogues|dialogue example|dialogue examples|
    example messages|example chats|examples of speech|example speech|example conversation|example conversations|
    sample conversation|sample conversations|example chat|sample chat|chat example|chat examples|conversation example|
    conversation examples|example message|example reply|example replies|example response|example responses|
    sample response|sample responses|sample reply|sample replies|example interaction|example interactions|
    sample interaction|dialogue samples|dialogue sample|dialog sample|dialog samples|dialog example|dialog examples|
    example dialog|example dialogs|sample dialog|sample dialogs|speech examples|speech sample|speech samples|example lines|
    sample lines|example quotes|sample quotes`,
};
const EXACT = new Map<string, DescriptionSplitField>();
for (const field of DESCRIPTION_SPLIT_FIELDS) {
  for (const label of EXACT_SOURCE[field].split("|").map((s) => s.trim())) {
    if (label && !EXACT.has(label)) EXACT.set(label, field);
  }
}

// Fallback when no exact label matches: any rules word wins, then the first specific word in the label,
// then the generic description words ("Outfits outside the guild setting" -> appearance,
// "Occupation & Background" -> backstory).
const FUZZY: Array<[DescriptionSplitField, Set<string>]> = (
  [
    [
      "system_prompt",
      "rules rule instructions instruction guidelines guideline system ooc occ narration formatting guardrails directives directive roleplay guidance restrictions perspective",
    ],
    ["backstory", "backstory background history origin origins upbringing childhood biography synopsis lore past"],
    ["scenario", "setting world scenario premise genre location era plot storyline"],
    [
      "personality",
      `personality psychology psychological psyche behavior behaviour behaviors behaviours behavioral behavioural
    speech speaking voice mannerisms quirks habits traits likes dislikes loves hates hobbies interests fears goals
    motivation motivations sexual sexuality kinks fetishes intimacy romantic romance emotional emotions feelings attitude
    mind mental archetype temperament values beliefs desires preferences vibe ticks tics secrets talks affection touch vocalizations vocalisations reactions expression expressions microgestures interpersonal speechpatterns`,
    ],
    [
      "appearance",
      `appearance apperance appeareance physicality body outfit outfits clothing clothes wardrobe attire
    looks features measurements hair eyes face height build physique figure skin scent armor weapons equipment
    circumference size feet foot fur scales wings horns tail form transformations`,
    ],
    [
      "description",
      `identity profile info information basic basics overview details relationships relationship relations
    connections family abilities skills powers occupation job competencies characters npc npcs residence
    name age gender sex species race ethnicity nationality birthday`,
    ],
  ] as Array<[DescriptionSplitField, string]>
).map(([field, list]) => [field, new Set(list.split(/\s+/).filter(Boolean))]);

// Headers that only repeat the field they are moved into are dropped ("Appearance:" inside appearance).
const CANONICAL: Partial<Record<DescriptionSplitField, string[]>> = {
  appearance: ["appearance", "apperance", "appeareance", "appearence", "physical appearance", "appearance details"],
  personality: ["personality"],
  backstory: ["backstory", "back story", "background"],
  scenario: ["scenario"],
  mes_example: ["sample dialogue", "sample dialogues", "example dialogue", "example dialogues", "dialogue examples"],
};
const TITLE_WORDS = new Set(["", "char", "character", "bot", "character sheet", "character card", "card"]);
// Identity facts stay in the description even when they sit under another section's header
// ("## APPEARANCE" > "- Full Name: ...", "- Age: 23").
const IDENTITY = new Set(
  "name|full name|first name|last name|surname|nickname|nicknames|age|sex|gender|sex gender|race|species|pronouns|birthday|occupation|job".split(
    "|",
  ),
);
const DIALOGUE_SPEAKERS = new Set(["user", "interviewer", "example", "narrator", "you", "me"]);
const SENTENCE_WORDS = new Set(
  "is are was were will would has have had be been the to of he she they it i you we his her their him them its this that and but or if so not do does did can could should".split(
    " ",
  ),
);
const LEAD_STOP = new Set(["the", "a", "an", "my", "her", "his", "their", "your"]);
const NAME_STOP = new Set(
  "your you the a an my please give being expelled welcome academy blank isekai land multiversal monster lisa".split(
    " ",
  ),
);
const VOCAB = new Set<string>();
for (const label of EXACT.keys()) for (const w of label.split(" ")) VOCAB.add(w);
for (const [, set] of FUZZY) for (const w of set) VOCAB.add(w);

const MOVED_FIELDS = DESCRIPTION_SPLIT_FIELDS.slice(1);
// Labels for these fields leave any section they appear in.
const LOOSE_FIELDS = new Set<DescriptionSplitField>(["system_prompt", "mes_example"]);

// ───────────────────────────── content detectors ─────────────────────────────
// Unlabelled lines that are clearly instructions to the model rather than character facts.
const INSTRUCTION_PATTERNS = [
  /\b(speak|speaks|speaking|talk|act|acting|respond|reply|replies|decide|decides|write|narrate|control|impersonate|assume)\b[^.]{0,40}\b(for|as|on behalf of)\s+(\{\{user\}\}|the user)/i,
  /\b(?:write|writes|describe|describes|narrate|narrates|control|controls|decide|decides|dictate|dictates|generate|generates|invent|invents)\b[^.]{0,30}\{\{user\}\}['’]?s?\s+(?:dialogue|actions|thoughts|responses|words|feelings|reactions)\b/i,
  /\b(OOC|OCC)\b/,
  /\bsystem note\b/i,
  /\b(roleplay|role-play)\b/i,
  /\b(?:in|use|using|write|written|from)\s+(?:the\s+)?(?:first|second|third)[- ]person\b|\b(?:first|second|third)[- ]person\s+(?:pov|perspective|point of view|narration|narrative|view)\b/i,
  /\b(present|past) tense\b/i,
  /\basterisks?\b/i,
  /\b(your|the) (responses?|replies|narration)\b/i,
  /\bstay in character\b|\bbreak(ing)? character\b|\bfourth wall\b/i,
  /\bthe (AI|LLM)\b|\bAI will\b/,
  /\b(immersive(ly)?|graphically)\b/i,
  /\b(uncensored|NSFW)\b/i,
  /\b(will not|won't|never|do not|don't) assume\b/i,
  /\bgender[- ]neutral\b/i,
  /^\W*(?:NEVER|ALWAYS|DO NOT|DON'T|AVOID|MUST)\b/,
  /^\[\s*(?:never|always|do not|don't|avoid|must|important)\b/i,
  /^\W*(?:use|avoid|include|never|always|do not|don't|ensure|make sure|remember to|portray|respond|narrate|maintain|refrain|emphasi[sz]e|prioriti[sz]e|generate|provide)\b/i,
];
const isInstruction = (text: string) => INSTRUCTION_PATTERNS.some((re) => re.test(text));
// Lines that are instructions even inside a personality/scenario/... section.
const STRONG_INSTRUCTION_PATTERNS = [
  INSTRUCTION_PATTERNS[0]!,
  /\bsystem (?:prompt|note)\b/i,
  /\b(?:OOC|OCC)\s*:/,
  /^\W*(?:do not|don't|never|always|avoid)\s+(?:narrate|write|speak|describe|use|repeat|summari[sz]e|act|respond|reply|say|mention|call|refer)\b/i,
  /\bstay in character\b/i,
];
const isStrongInstruction = (text: string) => STRONG_INSTRUCTION_PATTERNS.some((re) => re.test(text));

// Keyword scoring for unlabelled prose lines; a line only moves when one field clearly wins.
const PROSE_LEXICON: Array<[DescriptionSplitField, RegExp]> = [
  [
    "appearance",
    /\b(hair|haired|eyes?|eyed|tall|height|cm|feet|foot|inches|ft|lbs|kg|pounds|kilograms|weighs|breasts?|cup|bust|busty|hips|waist|thighs?|ass|butt|figure|physique|skin|skinned|complexion|face|lips|freckles|wears?|wearing|dressed|outfits?|clothes|clothing|uniform|dress|skirt|shirt|jacket|hoodie|jeans|makeup|tattoos?|scars?|petite|curvy|slender|slim|chubby|plump|muscular|toned|athletic|ears|tail|wardrobe|blonde|brunette|ponytail|pigtails|twintails|braids?|bangs|nipples|abs|stockings|lingerie|bra|panties|glasses|hourglass|nude|naked|cloak|robe|gloves|boots|heels|sneakers|socks|bikini|swimsuit|collar|necklace|earrings|piercings?|horns?|wings|fangs|claws|fur|scales|paws|pale|tanned|lashes|cheeks|nose|chin|jaw|belly|navel|cock|dick|pussy|crotch|bulge|stands at|build|frame|hands?|fingers|hairstyle|curls|wavy|bob|appearance|looks like|look like|appears)\b/gi,
  ],
  [
    "personality",
    /\b(personality|kind|shy|confident|teasing|teases|sarcastic|cheerful|loyal|stubborn|arrogant|timid|anxious|gentle|caring|cold|playful|likes|loves|enjoys|hates|dislikes|fears?|afraid|speaks|speech|voice|tone|habits?|tends? to|nervous|insecure|proud|introverted|extroverted|cowardly|talkative|flirtatious|flirty|sadistic|dominant|submissive|smug|tomboy|outgoing|energetic|bubbly|lonely|jealous|possessive|clingy|bratty|tsundere|sweet|naive|innocent|curious|kinks?|fetish(?:es)?|bisexual|lesbian|virgin|hobbies|hobby|sassy|cocky|affectionate|mischievous|aggressive|rude|polite|honest|protective|competitive|lazy|hardworking|stoic|serious|calm|grumpy|moody|optimistic|pessimistic|obedient|rebellious|manipulative|cunning|intelligent|smart|clever|airheaded|ditzy|clumsy|romantic|perverted|lewd|horny|prude|modest|humble|vain|greedy|generous|patient|impatient|blunt|cynical|witty|charming|friendly|hostile|aloof|reserved|quiet|loud|hyperactive|melancholic|depressed|prefers|secretly|deep down|temper|mood|attitude|values|believes|opinion|sexuality|sexual|masochist(?:ic)?|yandere|kuudere|dere|brooding|stern|strict|bossy|needy|awkward|socially|empathetic|compassionate|selfish|selfless|loyalty|trust(?:s|ing)?|craves?|desires?|wants?|dream(?:s)?|goal(?:s)?|motivat(?:ed|ion)|passion(?:ate)?|obsess(?:ed|ive|ion)|addicted)\b/gi,
  ],
  [
    "backstory",
    /\b(born|grew up|raised|childhood|years ago|used to|when (?:she|he|they) (?:was|were)|as a (?:child|kid|teen(?:ager)?|girl|boy)|in the past|orphan(?:ed)?|moved (?:to|from|in|out)|since (?:she|he|they) was|graduated|divorced?|from a young age|at the age of|after (?:her|his|their)|parents|father|mother|died|passed away|lost (?:her|his|their)|abandoned|ran away|joined|became|fell in love|was born|trained|studied|worked as|years later|eventually|one day|until|after that|ago|back then|at (?:that|the) time|history|past|previously|formerly|once|had been|began|started|ended|left (?:her|his|their|home)|married|first met|grew|teenager|teenage|high school years|college years|rough childhood)\b/gi,
  ],
  [
    "scenario",
    /\b(setting|takes place|set in|genre|modern[- ]day|century|medieval|fantasy world|world|realm|kingdoms?|empire|continent|academy|city|village|town|located|built|currently|tonight|today|recently|has just|have just|the story (?:begins|starts)|begins when|starts when|this (?:story|scenario|roleplay)|the scenario|the roleplay|the story)\b/gi,
  ],
];
/** Whether a quote holds two or more spaces ('She laughs "Oh, hello there"'), read like
 *  `/["“][^"”]*\s[^"”]*\s[^"”]*["”]/`, whose three runs backtrack cubically on an unclosed quote. */
function hasSpokenQuote(t: string): boolean {
  let open = false;
  let spaces = 0;
  for (const c of t) {
    if (c === '"' || c === "”") {
      if (open && spaces >= 2) return true;
      open = c === '"'; // a straight quote that closes nothing opens the next quote
      spaces = 0;
    } else if (c === "“") {
      if (!open) spaces = 0;
      open = true;
    } else if (open && /\s/.test(c)) spaces++;
  }
  return false;
}

function classifyProse(text: string, ctx: Ctx): DescriptionSplitField | null {
  // The character's own name words do not count ("Rock Jaw" is not a jaw).
  const t = (ctx.nameRe ? text.replace(ctx.nameRe, " ") : text).trim();
  if (t.length < 25) return null;
  // Introductions ("{{char}}'s name is ...", "an 18 year old ...") stay in the description.
  if (
    /\bname is\b|\bfull name\b|\b\d{1,3}[- ]?(?:years?|yrs?)[- ]old\b|\byears? old\b|\b(?:\w+[- ])?year[- ]old\b/i.test(
      t,
    )
  ) {
    return null;
  }
  if (/^(I|I'm|I’m|I've|I’ve|My|Me)\b/.test(t) || /^["“*]/.test(t) || /^\{\{user\}\}/i.test(t)) return null;
  // Dialogue and acted-out lines ("{{char}}: ...", 'She laughs "..."', *twirls*) are not facts to sort.
  if (
    /^[^:]{1,30}:\s*["“*]/.test(t) ||
    /^\{\{\s*char\s*\}\}\s*:/i.test(t) ||
    hasSpokenQuote(t) ||
    /\*[^*]{6,}\*/.test(t)
  ) {
    return null;
  }
  const scores = PROSE_LEXICON.map(([field, re]): [DescriptionSplitField, number] => [
    field,
    (t.match(re) ?? []).length,
  ]).sort((a, b) => b[1] - a[1]);
  const [best, top] = scores[0]!;
  const second = scores[1]![1];
  return top >= 2 && top >= second * 2 ? best : null;
}

// ───────────────────────────── label helpers ─────────────────────────────
type Resolved = { field?: DescriptionSplitField; how?: "exact" | "rule" | "fuzzy" | "keywords"; kind?: "title" };
interface Ctx {
  names: Set<string>;
  /** Matches the words in `names`, for stripping them before keyword scoring. */
  nameRe: RegExp | null;
}

const MACRO = String.raw`\{\{[^{}]*\}\}`;
const MACRO_OWN = String.raw`${MACRO}(?:['’]s)?`; // "{{char}}'s Appearance (...)"
const WPP_OPEN = String.raw`(?:\(|\[|\{(?!\{))`;
const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

function normLabel(raw: string, names: Set<string>): string {
  let t = String(raw).normalize("NFKC");
  t = t.replace(/\{\{\s*"([^"}]*)"\s*\}\}/g, "$1");
  t = t.replace(/\{\{\s*char\s*\}\}(?:['’]s)?/gi, " ").replace(/\{\{\s*user\s*\}\}(?:['’]s)?/gi, " user ");
  t = t.replace(/\{\{[^{}]*\}\}/g, " ");
  t = t.replace(/\(s\)/gi, "s"); // "Nickname(s)" -> "nicknames"
  t = t
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^\p{L}\p{N}']+/gu, " ");
  const tokens = t
    .split(" ")
    .map((w) => w.replace(/'s$/, "").replace(/'/g, ""))
    .filter((w) => w && !names.has(w));
  while (tokens.length > 1 && LEAD_STOP.has(tokens[0]!)) tokens.shift(); // "A:" (answer) keeps its one token
  return tokens.join(" ");
}

const CONNECTORS = new Set("and or of the a an in on with at to for her his their its user".split(" "));
const IMPERATIVE =
  /^(use|incorporate|write|introduce|describe|avoid|include|keep|make|never|always|do|dont|focus|emphasis|encourage|ensure|show|allow|let|remember|portray|respond|narrate|maintain|stay|limit|prioritize|prioritise)\b/;

function resolveLabel(norm: string, value = ""): Resolved {
  if (TITLE_WORDS.has(norm)) return { kind: "title" };
  if (norm === "sex") {
    const valueWords = value
      .replace(/[^\p{L}\s]/gu, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    return { field: valueWords <= 3 ? "description" : "personality", how: "exact" };
  }
  // "{{char}}'s persona: yandere, clingy, jealous" is a trait list; "{{char}}'s persona:" alone is a wrapper.
  if (norm === "persona" && !isListy(value)) return { kind: "title" };
  const exact = EXACT.get(norm);
  if (exact) return { field: exact, how: "exact" };
  const singular = norm.endsWith("s") ? EXACT.get(norm.slice(0, -1)) : undefined;
  if (singular) return { field: singular, how: "exact" };
  const plural = EXACT.get(`${norm}s`); // "{{char}} like (...)"
  if (plural) return { field: plural, how: "exact" };
  if (IMPERATIVE.test(norm)) return { field: "system_prompt", how: "rule" };
  if (/^how to (play|act|portray|behave)\b/.test(norm) || /^(when|while)\b/.test(norm)) {
    return { field: "personality", how: "rule" };
  }
  if (/^(around|with|towards?|about)\b.*\buser\b/.test(norm)) return { field: "personality", how: "rule" };
  if (/\b(sample|example)s? (dialogues?|messages?|chats?|speech)\b|\bdialogue examples?\b/.test(norm)) {
    return { field: "mes_example", how: "fuzzy" };
  }
  const tokens = norm.split(" ");
  const fuzzyField = (w: string): DescriptionSplitField | undefined =>
    FUZZY.find(([, set]) => set.has(w) || set.has(`${w}s`) || (w.endsWith("s") && set.has(w.slice(0, -1))))?.[0];
  const words = tokens.filter((w) => !CONNECTORS.has(w));
  const fields = new Set(words.map(fuzzyField));
  if (words.length && fields.size === 1 && !fields.has(undefined)) return { field: [...fields][0]!, how: "keywords" };
  if (tokens.some((w) => fuzzyField(w) === "system_prompt")) return { field: "system_prompt", how: "fuzzy" };
  const specific = tokens.map(fuzzyField).find((f) => f && f !== "description");
  if (specific) return { field: specific, how: "fuzzy" };
  if (tokens.some((w) => fuzzyField(w) === "description")) return { field: "description", how: "fuzzy" };
  return {};
}

const isCanonical = (field: DescriptionSplitField, norm: string) => (CANONICAL[field] ?? []).includes(norm);

function labelLooksValid(raw: string): boolean {
  const label = raw.trim();
  if (!label || label.length > 60) return false;
  const plain = label.replace(new RegExp(MACRO, "g"), "X");
  if (!/\p{L}/u.test(plain) || /^\d/.test(plain.replace(/^[^\p{L}\p{N}]+/u, ""))) return false;
  if (/[.!?,;]/.test(plain.replace(/\([^()]*\)/g, ""))) return false;
  if (/https?$/i.test(plain)) return false;
  return wordCount(label) <= 7;
}

function looksLikeSentence(norm: string): boolean {
  const tokens = norm.split(" ");
  return tokens.length >= 3 && tokens.some((w) => SENTENCE_WORDS.has(w));
}

function isShortTitle(s: string): boolean {
  const t = s.trim();
  return /\p{L}/u.test(t) && t.length <= 50 && wordCount(t) <= 6 && !/[.!?,;]$/.test(t);
}

function isAllCapsHeading(s: string): boolean {
  const t = s.trim();
  const letters = t.replace(new RegExp(MACRO, "g"), "");
  return /\p{Lu}{2}/u.test(letters) && !/\p{Ll}/u.test(letters) && wordCount(t) <= 6 && !/[.!?:]$/.test(t);
}

/** Index of the bracket closing the one at `open`, counting any bracket type; -1 if unclosed. */
function matchClose(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** The value of a "Name:" / "**Full name and age:**" line. The line prefix skips no newlines: a blank-line run
 *  would be rescanned from each of its lines. The padding after the separator is one whitespace run, not two around
 *  the optional "**", which backtrack quadratically. `matchAll` copies it, so sharing the global flag is safe. */
const NAME_LINE_RE =
  /^(?:[^\S\n]|[>*•+\-[{])*(?:\*\*)?(?:full\s+)?name(?:\s+and\s+age)?\**\s*[:=(]\s*(?:\*+\s*)?["“]?([^\n"“”(),;\]]{1,60})/gim;

/** Collects the character's own name words so "Arya's Appearance" normalises to "appearance". */
function collectNames(cardName: string, text: string): Set<string> {
  const names = new Set<string>();
  const add = (word: string) => {
    const w = word
      .toLowerCase()
      .replace(/['’]s$/, "")
      .replace(/[^\p{L}]/gu, "");
    if (w.length >= 3 && !VOCAB.has(w) && !NAME_STOP.has(w) && !SENTENCE_WORDS.has(w)) names.add(w);
  };
  const lead = (cardName.split(/[|\-–—:(\[,!?♡]/)[0] ?? "").trim();
  for (const word of lead.split(/\s+/).slice(0, 3)) if (/^\p{Lu}/u.test(word)) add(word);
  for (const m of text.matchAll(NAME_LINE_RE)) for (const word of m[1]!.split(/\s+/).slice(0, 4)) add(word);
  const wppRe = /\b[Cc]haracter\(\s*"?([^"),]{1,40})/g;
  for (const m of text.matchAll(wppRe)) for (const word of m[1]!.split(/\s+/)) add(word);
  return names;
}

// ───────────────────────────── line splitting ─────────────────────────────
// Lines holding several entries are split so each entry can go to its own field:
//   "<Mia's Persona>Name: Mia"            -> "<Mia's Persona>" + "Name: Mia"
//   "[Arya : {{char}}] [Arya's Likes: ...]" -> one piece per bracket group
//   "{{char}}=[Name(Aspen) Species(Human) Age(20)" -> one piece per W++ entry
function expandLine(line: string, ctx: Ctx): string[] {
  // Both tag checks avoid nested or adjacent open-ended repeats, so a long line cannot make them backtrack
  // quadratically (card text is untrusted).
  let pieces = [line];
  const openTag = line.match(/^(\s*(?:>+\s*)?<\s*[A-Za-z{][^<>]{0,60}?>)(.*)$/);
  const afterOpen = openTag?.[2]!.trim() ?? "";
  if (afterOpen && !/^\s*<\//.test(line) && !afterOpen.startsWith("<")) pieces = [openTag![1]!, openTag![2]!];
  const last = pieces.length - 1;
  const tail = pieces[last]!;
  const at = tail.lastIndexOf("</");
  const beforeClose = at > 0 ? tail.slice(0, at) : "";
  if (beforeClose.trim() && !beforeClose.includes("<") && /^<\/[^<>]{1,60}>\s*$/.test(tail.slice(at))) {
    pieces.splice(last, 1, beforeClose, tail.slice(at).trimEnd());
  }
  return pieces
    .flatMap(splitBracketGroups)
    .flatMap(splitPlist)
    .flatMap((p) => splitWpp(p, ctx))
    .flatMap((p) => splitInlineLabels(p, ctx));
}

// PList: "[ {{char}}: trait, trait; {{char}}'s body: ...; ]" -> one piece per "Label: ..." section + "]",
// with or without the brackets. Only semicolons outside brackets cut, and only when a label follows them.
// The later pieces keep their leading space, which nests them under the first one (unknown labels follow
// its field).
const PLIST_LABEL = new RegExp(String.raw`^\s*(?:${MACRO_OWN}|\p{Lu}[\p{L}'’]*)(?:\s+[\p{L}'’]+){0,3}\s*:\s`, "u");
function splitPlist(s: string): string[] {
  const t = s.trim();
  const bracketed = t.startsWith("[") && t.endsWith("]");
  if (!PLIST_LABEL.test(bracketed ? t.slice(1) : t)) return [s];
  const inner = bracketed ? t.slice(0, -1) : t;
  const pieces: string[] = [];
  let start = 0;
  for (let i = bracketed ? 1 : 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === "(" || c === "[" || c === "{") {
      const close = matchClose(inner, i);
      if (close === -1) return [s];
      i = close;
    } else if (c === ";" && PLIST_LABEL.test(inner.slice(i + 1))) {
      pieces.push(inner.slice(start, i + 1));
      start = i + 1;
    }
  }
  if (!pieces.length) return [s];
  pieces.push(inner.slice(start));
  return bracketed ? [...pieces, "]"] : pieces;
}

// "Name: Daiyu, The Priestess Hair: Black, long Sex/Gender: Female" -> one piece per known label.
// Only labels from the vocabulary count, and the line itself has to start with one.
const INLINE_LABEL = /(^|\s)((?:[\p{L}][\p{L}'’/&-]*\s){0,2}[\p{L}][\p{L}'’/&-]*):(?=\s)/gu;
const NAME_PREFIX = new RegExp(
  String.raw`^[\[{(]?\s*(?:${MACRO_OWN}|\p{Lu}[\p{L}'’]*(?:\s\p{Lu}[\p{L}'’]*){0,2})\s*:$`,
  "u",
);
function splitInlineLabels(s: string, ctx: Ctx): string[] {
  if (/^\s*(?:[-*•+]\s|\d+[.)]\s)/.test(s) || /^[^:]{1,40}:\s*["“*]/.test(s.trim())) return [s];
  const cuts: number[] = [];
  for (const m of s.matchAll(INLINE_LABEL)) {
    const words = m[2]!.split(/\s+/);
    for (let n = words.length; n >= 1; n--) {
      const label = words.slice(words.length - n).join(" ");
      if (!/^\p{Lu}/u.test(label)) continue;
      const norm = normLabel(label, ctx.names);
      const known = EXACT.has(norm) || (norm.endsWith("s") && EXACT.has(norm.slice(0, -1)));
      if (known && !TITLE_WORDS.has(norm)) {
        cuts.push(m.index + m[1]!.length + (m[2]!.length - label.length));
        break;
      }
    }
  }
  if (cuts.length < 2) return [s];
  const lead = s.slice(0, cuts[0]).trim(); // nothing, or a name prefix: "[{{char}}:", "Adriana Hayes:"
  if (lead && !NAME_PREFIX.test(lead)) return [s];
  return cuts.map((start, k) => s.slice(k === 0 ? 0 : start, k + 1 < cuts.length ? cuts[k + 1] : s.length));
}

function splitBracketGroups(s: string): string[] {
  if (!s.trimStart().startsWith("[")) return [s];
  const groups: string[] = [];
  let i = s.indexOf("[");
  const lead = s.slice(0, i);
  while (i < s.length) {
    const close = matchClose(s, i);
    if (close === -1) {
      groups.push(s.slice(i));
      break;
    }
    groups.push(s.slice(i, close + 1));
    const next = s.slice(close + 1).search(/\S/);
    if (next === -1) break;
    i = close + 1 + next;
    if (s[i] !== "[") return [s];
  }
  if (groups.length < 2) return [s];
  groups[0] = lead + groups[0]!;
  return groups;
}

const WPP_ENTRY = new RegExp(String.raw`[\s,;+]*((?:${MACRO_OWN}\s*)?[A-Za-z][\w'’/&\- ]{0,40}?)\s*(${WPP_OPEN})`, "y");
const WPP_FIRST = new RegExp(String.raw`(?:${MACRO_OWN}\s*)?[A-Za-z][\w'’/&\- ]{0,40}?\s*${WPP_OPEN}`);
/**
 * "Adriana Hayes" / "{{char}}" / "Character Sheet" / "{{char}}'s persona": a prefix that names the character
 * rather than a field.
 */
function isNamePrefix(label: string, ctx: Ctx): boolean {
  const norm = normLabel(label, ctx.names);
  if (TITLE_WORDS.has(norm) || norm === "persona" || norm === "description") return true;
  const words = label.trim().split(/\s+/);
  return words.length <= 3 && !resolveLabel(norm).field && words.every((w) => /^(?:\p{Lu}|\{\{)/u.test(w));
}
function splitWpp(s: string, ctx: Ctx): string[] {
  const first = s.search(WPP_FIRST);
  if (first < 0) return [s];
  const prefix = s.slice(0, first);
  const prefixLabel = prefix
    .replace(/\{\{\s*char\s*\}\}(?:['’]s)?/gi, " ")
    .replace(/[[\]{}=:;\s]+/g, " ")
    .trim();
  if (prefixLabel && !isNamePrefix(prefixLabel, ctx)) return [s];
  const cuts: number[] = [];
  let i = first;
  while (i < s.length) {
    WPP_ENTRY.lastIndex = i;
    const m = WPP_ENTRY.exec(s);
    if (!m) break;
    const open = m.index + m[0].length - 1;
    const close = matchClose(s, open);
    cuts.push(m.index);
    if (close === -1) {
      i = s.length;
      break;
    }
    i = close + 1;
  }
  if (cuts.length < 2 || !/^[\s\]})\].,;]*$/.test(s.slice(i))) return [s];
  return cuts.map((start, k) => s.slice(k === 0 ? 0 : start, k + 1 < cuts.length ? cuts[k + 1] : s.length));
}

// ───────────────────────────── line tokenizer ─────────────────────────────
type Tok =
  | { type: "blank" | "structural" | "start" | "end-section" }
  | { type: "xml-open" | "xml-close"; tag: string }
  | { type: "heading"; level: number; label: string; value?: string; norm?: string; res?: Resolved; bracket?: boolean }
  | {
      type: "inline";
      label: string;
      norm: string;
      res: Resolved;
      value: string;
      bullet: boolean;
      indent: number;
      anchors: boolean;
      listy: boolean;
    }
  | { type: "text"; bullet: boolean; indent: number; speaker: string | null; quoted: boolean; value?: string };

const RE_STRUCTURAL = /^(?:-{3,}|\*{3,}|_{3,}|={3,}|[[\]{}()]{1,3}|>|\]\s*\}|\}\s*\]|\)\s*\])$/;
const RE_LABEL_PART = new RegExp(String.raw`${MACRO}|\([^()]{0,40}\)|[^:=()\[\]{}"“”*\n]`, "y");
const RE_WPP = new RegExp(String.raw`^((?:${MACRO_OWN}\s*)?[A-Za-z][\w'’/&\- ]{0,40}?)(\s*)(${WPP_OPEN})`);
const RE_MACROS = new RegExp(MACRO, "g");

interface Inline {
  label: string;
  value: string;
  wpp?: boolean;
  spaced?: boolean;
  unclosed?: boolean;
}

/** A "Label: value" line, read like `/^((?:{{macro}}|\([^()]{0,40}\)|[^:=()[\]{}"“”*\n])+?)\s*[:=]\s*([\s\S]*)$/`,
 *  which rescans the whitespace before the separator from every label end; null when it is not one. */
function plainInline(core: string): Inline | null {
  let gap = 0; // end of the whitespace run checked last; a label ending inside it meets the same separator
  for (let i = 0; ;) {
    RE_LABEL_PART.lastIndex = i;
    if (!RE_LABEL_PART.test(core)) return null;
    i = RE_LABEL_PART.lastIndex;
    if (gap >= i) continue;
    gap = i;
    while (/\s/.test(core[gap] ?? "")) gap++;
    if (core[gap] === ":" || core[gap] === "=")
      return { label: core.slice(0, i), value: core.slice(gap + 1).trimStart() };
  }
}

function parseInline(core: string): Inline | null {
  let m: RegExpMatchArray | null;
  if (
    (m = core.match(/^\*\*([^*]{1,60}?)\*\*\s*[:=]\s*([\s\S]*)$/)) ||
    (m = core.match(/^\*\*([^*]{1,60}?)\s*[:=]\s*\*\*\s*([\s\S]*)$/))
  ) {
    return { label: m[1]!, value: m[2]! };
  }
  if ((m = core.match(/^\{\{\s*"([^"]{1,60})"\s*\}\}\s*:\s*([\s\S]*)$/))) return { label: m[1]!, value: m[2]! };
  if ((m = core.match(/^"([^"]{1,60})"\s*:\s*([\s\S]*)$/))) return { label: m[1]!, value: m[2]! };
  if ((m = core.match(RE_WPP))) {
    const open = m[0].length - 1;
    const close = matchClose(core, open);
    const followedByColon = close !== -1 && /^\s*[:=]/.test(core.slice(close + 1));
    if (!followedByColon) {
      return {
        label: m[1]!,
        value: close === -1 ? core.slice(open + 1) : core.slice(open + 1, close),
        wpp: true,
        spaced: m[2]!.length > 0,
        unclosed: close === -1,
      };
    }
  }
  const plain = plainInline(core);
  return plain && !plain.value.startsWith("//") ? plain : null;
}

/** `text` without its trailing run of `chars`, which an unanchored `/[chars]+$/` rescans from each of its characters. */
function trimTail(text: string, chars: RegExp): string {
  let end = text.length;
  while (end > 0 && chars.test(text[end - 1]!)) end--;
  return text.slice(0, end);
}

/** A heading label between a leading and a trailing whitespace / `lead` or `trail` run / whitespace, read the way a
 *  lazy `\s*X*\s*(.+?)\s*X*\s*` does: "" when the leading run takes everything, the first character when the
 *  trailing run would. */
function stripEnds(text: string, lead: string, trail: string): string {
  const space = (c: string | undefined) => c !== undefined && /\s/.test(c);
  let i = 0;
  while (space(text[i])) i++;
  while (lead && text[i] === lead) i++;
  while (space(text[i])) i++;
  if (i === text.length) return "";
  let j = text.length;
  while (j > i && space(text[j - 1])) j--;
  while (trail && j > i && text[j - 1] === trail) j--;
  while (j > i && space(text[j - 1])) j--;
  return j > i ? text.slice(i, j) : text[i]!;
}

/** The label of an "== Title ==" line, read like `/^={2,}\s*(.+?)\s*={2,}$/`; null when it is not one. */
function equalsHeading(s: string): string | null {
  let a = 0;
  while (s[a] === "=") a++;
  if (a === s.length) return a >= 5 ? "=" : null;
  let b = s.length;
  while (s[b - 1] === "=") b--;
  if (a < 2 || s.length - b < 2) return null;
  return s.slice(a, b).trim() || s[b - 1]!;
}

/** The label of a "**Title:**" line, read like `/^\*\*\s*\[?([^*\]]{1,60}?)\]?\s*:?\s*\*\*\s*:?$/`, whose
 *  three whitespace runs around the label backtrack cubically; null when it is not one. */
function boldHeading(s: string): string | null {
  const close = s.indexOf("*", 2);
  if (!s.startsWith("**") || close === -1 || !/^\*\*\s*:?$/.test(s.slice(close))) return null;
  const mid = s.slice(2, close);
  const space = (i: number) => /\s/.test(mid[i] ?? "x");
  // The lazy label leaves out the longest "]? \s* :? \s*" tail ...
  let end = mid.length;
  while (space(end - 1)) end--;
  if (mid[end - 1] === ":") end--;
  while (space(end - 1)) end--;
  if (mid[end - 1] === "]") end--;
  // ... and starts after "\s* [?", backing off one character at a time only while it has nothing to hold.
  let lead = 0;
  while (space(lead)) lead++;
  for (const start of mid[lead] === "[" ? [lead + 1, lead, lead - 1] : [lead, lead - 1]) {
    if (start < 0 || start >= mid.length) continue;
    const label = mid.slice(start, Math.max(start + 1, end));
    if (label.length <= 60 && !label.includes("]")) return label;
  }
  return null;
}

/** The label of a "[{{char}}'s Appearance:" line, read like `/^\[\s*((?:{{macro}}|[^\[\]:;])+?)\s*[:;]\s*$/`, which
 *  can read each macro two ways and backtracks exponentially on a run of them; null when it is not one. */
function bracketOpen(s: string): string | null {
  const end = s.trimEnd();
  if (!s.startsWith("[") || !/[:;]$/.test(end)) return null;
  const body = end.slice(1, -1);
  if (!body || /[[\]:;]/.test(body.replace(RE_MACROS, ""))) return null;
  return body.trim() || body.at(-1)!;
}

/** The label of a "</tag>" or "[Title]" line, read like `/^open\s*([^bad]{1,max}?)\s*close$/`, whose whitespace
 *  runs around the lazy label backtrack cubically; null when it is not one. */
function enclosedLabel(s: string, open: string, close: string, max: number, bad: RegExp): string | null {
  if (s.length <= open.length + close.length || !s.startsWith(open) || !s.endsWith(close)) return null;
  const body = s.slice(open.length, -close.length);
  const label = body.trim() || body.at(-1)!;
  return bad.test(body) || label.length > max ? null : label;
}

function tokenize(text: string, ctx: Ctx): Tok {
  const trimmed = text.trim();
  const indent = text.length - text.trimStart().length;
  if (!trimmed) return { type: "blank" };
  if (RE_STRUCTURAL.test(trimmed)) return { type: "structural" };
  let m: RegExpMatchArray | null;
  if (trimmed.length >= 7 && trimmed.startsWith("<!--") && trimmed.endsWith("-->")) {
    const note = trimmed.slice(4, -3).trim(); // `/^<!--\s*([\s\S]*?)\s*-->$/` backtracks cubically on padding
    if (/^end\b/i.test(note)) return { type: "end-section" };
    return { type: "heading", level: 1, label: note.replace(/^start\s+of\s+/i, "") };
  }
  let s = trimmed;
  let quote = false;
  if ((m = s.match(/^>+\s*/))) {
    quote = true;
    s = s.slice(m[0].length);
  }
  if (/^<start>$/i.test(s)) return { type: "start" };
  const closeTag = enclosedLabel(s, "</", ">", 60, /[<>]/);
  if (closeTag !== null) return { type: "xml-close", tag: closeTag };
  if ((m = s.match(/^<\s*([A-Za-z{][^<>]{0,60}?)\s*>$/)) && !/^start$/i.test(m[1]!))
    return { type: "xml-open", tag: m[1]! };
  // Heading closers ("## Title ##", "== Title ==", "[[ = Title = ]]") are trimmed in code: a lazy label before
  // an optional closer backtracks quadratically or worse on a long line, and card text is untrusted.
  if ((m = s.match(/^(#{1,6})\s*(.+)$/))) {
    const label = stripEnds(m[2]!, "", "#");
    const colon = label.match(/^([^:]{1,60}?)\s*:\s*(.*)$/);
    return { type: "heading", level: m[1]!.length, label: colon ? colon[1]! : label, value: colon ? colon[2]! : "" };
  }
  const equals = equalsHeading(s);
  if (equals !== null) return { type: "heading", level: 2, label: equals };
  if (s.length > 4 && s.startsWith("[[") && s.endsWith("]]")) {
    const inner = s.slice(2, -2);
    return { type: "heading", level: 5, label: stripEnds(inner, "=", "=") || inner.at(-1)! };
  }
  const bold = boldHeading(s);
  if (bold !== null) return { type: "heading", level: 5, label: bold };
  if ((m = s.match(/^`([^`]{1,40})`$/))) return { type: "heading", level: 5, label: m[1]! };
  const title = enclosedLabel(s, "[", "]", 60, /[[\]:]/);
  if (title !== null && isShortTitle(title)) return { type: "heading", level: 5, label: title };
  const bracket = bracketOpen(s);
  if (bracket !== null && wordCount(bracket) <= 7) return { type: "heading", level: 5, label: bracket, bracket: true };
  if ((m = s.match(/^\d{1,2}[.)]\s+([^:.!?]{1,40})$/)) && isShortTitle(m[1]!) && /^\p{Lu}/u.test(m[1]!)) {
    return { type: "heading", level: 5, label: m[1]! };
  }

  let core = s;
  let bullet = false;
  if ((m = core.match(/^[,;+]\s*/))) core = core.slice(m[0].length); // ", sex (Female)" after a W++ split
  if ((m = core.match(/^(?:[-*•+–]\s+|[-•–](?=[^\s-]))/))) {
    bullet = true;
    core = core.slice(m[0].length);
  }
  if ((m = core.match(/^\d{1,2}[.)]\s+/))) {
    bullet = true;
    core = core.slice(m[0].length);
  }
  let wrapped = false;
  if (/^(?:\[|\{(?!\{)|\((?=[^()]*:))/.test(core)) {
    core = core.slice(1).trimStart();
    wrapped = /[\]})]\s*$/.test(core);
  }

  let inline = parseInline(core);
  if (inline && !inline.wpp && isNamePrefix(inline.label, ctx)) {
    // "[Adriana Hayes: age (21 years)" / "[{{char}}: Clothing: ..." -> look past the name prefix, unless more
    // W++ entries follow on the line (splitWpp could not cut them): "{{char}}'s persona: gender(male) eyes(red)"
    // is then one trait list under its own label.
    const rest = inline.value.replace(/^[\s[]+/, "");
    const inner = parseInline(rest);
    const close = inner?.wpp ? matchClose(rest, rest.search(/[([{]/)) : -1;
    const whole = close === -1 || !WPP_FIRST.test(rest.slice(close + 1));
    if (inner && whole && labelLooksValid(inner.label) && resolveLabel(normLabel(inner.label, ctx.names)).field) {
      inline = inner;
    }
  }
  if (inline && labelLooksValid(inline.label)) {
    const norm = normLabel(inline.label, ctx.names);
    const value = trimTail(inline.value.replace(/^[\s\]})]+/, ""), /[\s\]});]/);
    const res = resolveLabel(norm, value);
    const known = Boolean(res.field) || res.kind === "title";
    const dialogue = /^["“*]/.test(value) || DIALOGUE_SPEAKERS.has(norm);
    const voice = inline.wpp ? null : speakerOf(inline.label, inline.value, ctx);
    if (voice && (res.kind === "title" || !known))
      return { type: "text", bullet, indent, speaker: voice, quoted: false, value: inline.value };
    const rejected =
      (res.kind === "title" && dialogue) ||
      (!known && (dialogue || looksLikeSentence(norm))) ||
      (inline.wpp &&
        (inline.spaced
          ? res.how !== "exact" && res.how !== "rule" && res.kind !== "title"
          : !known && wordCount(norm) > 3));
    if (!rejected) {
      if (!value && !bullet && !inline.wpp) {
        return { type: "heading", level: 6 + Math.min(Math.floor(indent / 2), 3), label: inline.label, norm, res };
      }
      return {
        type: "inline",
        label: inline.label,
        norm,
        res,
        value,
        bullet,
        indent,
        anchors: !value || Boolean(inline.unclosed) || value.length >= 60 || wrapped,
        listy: isListy(value),
      };
    }
  }
  if ((quote && isShortTitle(core)) || (isAllCapsHeading(core) && !bullet))
    return { type: "heading", level: 5, label: core };
  const speaker = inline && !inline.wpp ? speakerOf(inline.label, inline.value, ctx) : null;
  if (speaker) return { type: "text", bullet, indent, speaker, quoted: false, value: inline!.value };
  // '{{char}} "UGH, don't..."'
  const bare = /^\{\{\s*char\s*\}\}\s+["“*]/i.test(core) ? "char" : null;
  return { type: "text", bullet, indent, speaker: bare, quoted: /^["“]/.test(core) };
}

/** "Interviewer: ...", "{{char}}: *grins*", "Mei: \"Hi\"" -> who is speaking, or null when the line is not dialogue. */
const USER_SPEAKERS = new Set(["user", "interviewer", "you", "example"]);
function speakerOf(label: string, value: string, ctx: Ctx): string | null {
  const raw = label.trim();
  if (!value.trim() || /^\{\{\s*user\s*\}\}$/i.test(raw)) return value.trim() ? "user" : null;
  const opens = /^["“*]/.test(value); // speech or an acted-out line
  if (/^\{\{\s*char\s*\}\}$/i.test(raw)) return opens || hasSpokenQuote(value) ? "char" : null;
  const norm = normLabel(raw, ctx.names);
  if (USER_SPEAKERS.has(norm)) return "user";
  if (norm === "narrator" || norm === "me") return norm;
  const words = raw.split(/\s+/);
  if (words.length > 3 || !opens || resolveLabel(norm).field) return null;
  return words.every((w) => /^\p{Lu}/u.test(w) || ctx.names.has(w.toLowerCase())) ? raw.toLowerCase() : null;
}

/**
 * Marks example-dialogue blocks: everything after a <START> line up to the next blank line that is not followed by
 * more dialogue, and runs of speaker lines with two voices (or {{user}}/Interviewer lines), e.g.
 *   Interviewer: "Describe your appearance?"
 *   {{char}}: "Oh, you know, just your average goblin-kin..."
 */
type ExampleMark = "start" | "run" | null;
function markExamples(toks: Tok[]): ExampleMark[] {
  const skip = (i: number) => toks[i]!.type === "blank";
  const speakerAt = (i: number): string | null => {
    const tok = toks[i];
    return tok?.type === "text" ? tok.speaker : null;
  };
  const neighbour = (i: number, step: number) => {
    let k = i + step;
    while (k >= 0 && k < toks.length && skip(k)) k += step;
    return k;
  };
  for (let i = 0; i < toks.length; i++) {
    const tok = toks[i]!;
    // "{{char}}: lol ok" next to a {{user}} line is the character speaking, even without quotes or asterisks
    if (
      tok.type === "inline" &&
      tok.res.kind === "title" &&
      !tok.listy &&
      tok.value &&
      /^\{\{\s*char\s*\}\}$/i.test(tok.label.trim()) &&
      (speakerAt(neighbour(i, -1)) === "user" || speakerAt(neighbour(i, 1)) === "user")
    ) {
      toks[i] = {
        type: "text",
        bullet: tok.bullet,
        indent: tok.indent,
        speaker: "char",
        quoted: false,
        value: tok.value,
      };
      continue;
    }
    // a bare quoted line right after a speaker line continues that speech
    if (i === 0 || tok.type !== "text" || !tok.quoted || tok.speaker) continue;
    const before = toks[neighbour(i, -1)];
    if (before?.type === "text" && before.speaker) tok.speaker = before.speaker;
  }
  const isDialogue = (i: number) => Boolean(speakerAt(i));
  const example: ExampleMark[] = new Array(toks.length).fill(null);
  for (let i = 0; i < toks.length; i++) {
    if (toks[i]!.type === "start") {
      let j = i + 1;
      while (j < toks.length) {
        if (
          ["heading", "xml-open", "xml-close", "structural", "end-section", "start", "inline"].includes(toks[j]!.type)
        )
          break;
        if (skip(j)) {
          let k = j + 1;
          while (k < toks.length && skip(k)) k++;
          if (k >= toks.length || !(isDialogue(k) || toks[k]!.type === "start")) break;
        }
        j++;
      }
      for (let k = i; k < j; k++) example[k] = "start";
      i = j - 1;
      continue;
    }
    if (!isDialogue(i)) continue;
    const run: number[] = [];
    let j = i;
    while (j < toks.length && (isDialogue(j) || (skip(j) && j + 1 < toks.length && isDialogue(j + 1)))) {
      if (isDialogue(j)) run.push(j);
      j++;
    }
    const speakers = new Set(run.map((k) => speakerAt(k)));
    const qualifies = run.length >= 2 && (speakers.size >= 2 || speakers.has("user"));
    if (qualifies) for (let k = i; k < j; k++) example[k] = "run";
    i = j - 1;
  }
  return example;
}

/**
 * An interview whose questions name fields is a profile in disguise:
 *   {{user}}: Appearance?
 *   {{char}}: *She places her hand on her chest.* Oh well, if you want to look at me...
 * Each answer lands in the field its question names ("Introduction?" names the description) and the
 * interview's other answers stay in the description (map value null). An interview with no such question is
 * left out and stays example dialogue.
 */
function markInterview(toks: Tok[], example: ExampleMark[], ctx: Ctx): Map<number, DescriptionSplitField | null> {
  const fields = new Map<number, DescriptionSplitField | null>();
  const questionField = (tok: Tok): DescriptionSplitField | null => {
    if (tok.type !== "text" || tok.speaker !== "user" || !tok.value) return null;
    const question = tok.value.replace(/^[\s"“*]+|[\s"”*?.!]+$/g, "");
    if (!labelLooksValid(question)) return null;
    const norm = normLabel(question, ctx.names);
    if (looksLikeSentence(norm)) return null;
    // "Introduction?" / "Introduce yourself?" asks who the character is, not for an opening scene
    if (/^(?:brief |short )?(?:intro|introduction|introduce yourself|who are you)$/.test(norm)) return "description";
    const res = resolveLabel(norm);
    return res.field && (res.how === "exact" || res.how === "keywords") ? res.field : null;
  };
  for (let i = 0; i < toks.length; i++) {
    if (example[i] !== "run") continue;
    let j = i;
    while (j < toks.length && example[j] === "run") j++;
    const run = new Map<number, DescriptionSplitField | null>();
    let field: DescriptionSplitField | null = null;
    let named = false;
    for (let k = i; k < j; k++) {
      const tok = toks[k]!;
      if (tok.type === "text" && tok.speaker === "user") {
        field = questionField(tok);
        named ||= Boolean(field);
      }
      run.set(k, field);
    }
    if (named) for (const [k, f] of run) fields.set(k, f);
    i = j - 1;
  }
  return fields;
}

function isListy(value: string): boolean {
  const separators = (value.match(/[,+;]/g) ?? []).length;
  const sentences = (value.match(/[.!?]\s+\S/g) ?? []).length;
  return separators >= 3 && sentences === 0;
}

interface Item {
  lineNo: number;
  text: string;
}

/** A short, title-like line between paragraphs ("Under the Clothes", "Sample Dialogue"). */
function isProseHeading(items: Item[], index: number, ctx: Ctx): boolean {
  const t = items[index]!.text.trim();
  if (!isShortTitle(t) || !/^(\p{Lu}|\{\{)/u.test(t) || /^[-*•+–>[{<"“*]/.test(t)) return false;
  const norm = normLabel(t, ctx.names);
  if (!norm || looksLikeSentence(norm)) return false;
  const neighbour = (step: number) => {
    for (let k = index + step; k >= 0 && k < items.length; k += step) {
      const text = items[k]!.text.trim();
      if (text) return text;
    }
    return "";
  };
  const next = neighbour(1);
  if (!next) return false;
  if (/,/.test(t)) return false;
  const res = resolveLabel(norm);
  if (res.how === "exact") return next.length >= 25 || /^[-*•+–]|^[^:]{1,40}:/.test(next);
  const prev = neighbour(-1);
  return prev.length >= 60 && next.length >= 40;
}

// ───────────────────────────── field assignment ─────────────────────────────
interface Frame {
  kind: "xml" | "h";
  level?: number;
  norm?: string;
  field: DescriptionSplitField | null;
  dropped?: boolean;
}
interface LineRecord extends Item {
  field: DescriptionSplitField | null;
  drop: string | null;
  how: string | null;
}
interface AssignOptions {
  prose: boolean;
  instructions: boolean;
}

function assignFields(items: Item[], ctx: Ctx, opts: AssignOptions): LineRecord[] {
  const frames: Frame[] = [];
  let anchor: { field: DescriptionSplitField; listy: boolean } | null = null; // unlabelled lines after a labelled paragraph follow it
  let introKept = false; // the first unlabelled paragraph introduces the character and stays put
  const sectionField = (): DescriptionSplitField | null => {
    for (let i = frames.length - 1; i >= 0; i--) {
      const field = frames[i]!.field;
      if (field) return field;
    }
    return null;
  };
  // Indented/bulleted labels inside a specific section belong to it ("speech:" > "  Style: ..." stays
  // personality); only generic description/profile sections hand their sub-labels out to other fields.
  const ownedBySection = (field: DescriptionSplitField, norm: string): DescriptionSplitField | null => {
    const section = sectionField();
    if (IDENTITY.has(norm)) return null;
    return section && section !== "description" && section !== field && !LOOSE_FIELDS.has(field) ? section : null;
  };
  const popHeadings = (level: number) => {
    while (frames.length) {
      const top = frames[frames.length - 1]!;
      if (top.kind !== "h" || (top.level ?? 0) < level) break;
      frames.pop();
    }
  };

  const toks: Tok[] = items.map((item, index) => {
    const tok = tokenize(item.text, ctx);
    if (tok.type === "text" && !tok.bullet && !tok.speaker && isProseHeading(items, index, ctx)) {
      return { type: "heading", level: 5, label: item.text.trim() };
    }
    return tok;
  });
  const example = markExamples(toks);
  const interview = markInterview(toks, example, ctx);
  const records: LineRecord[] = [];
  items.forEach((item, index) => {
    const tok = toks[index]!;
    const rec: LineRecord = { ...item, field: null, drop: null, how: null };
    records.push(rec);

    if (example[index] && tok.type !== "blank") {
      if (interview.has(index)) {
        rec.field = interview.get(index) ?? sectionField() ?? "description";
        rec.how = "interview";
      } else {
        rec.field = "mes_example";
        rec.how = "example";
      }
      anchor = null;
      return;
    }
    switch (tok.type) {
      case "blank":
        rec.how = "blank";
        return;
      case "structural":
        rec.drop = "separator";
        // A closing "]" / "}" ends the block the anchor came from; "---" only separates paragraphs,
        // so a labelled paragraph still carries unlabelled text across it.
        if (/^[\]})]/.test(item.text.trim())) anchor = null;
        return;
      case "start": // a stray <START> with nothing behind it
        rec.field = "mes_example";
        rec.how = "example";
        return;
      case "end-section":
        rec.field = sectionField() ?? "description";
        rec.how = "section";
        while (frames.length && frames[frames.length - 1]!.kind === "h") frames.pop();
        anchor = null;
        return;
      case "xml-open": {
        anchor = null;
        const norm = normLabel(tok.tag, ctx.names);
        const res = resolveLabel(norm);
        if (res.kind === "title") {
          frames.push({ kind: "xml", norm, field: null, dropped: true });
          rec.drop = "wrapper tag";
          return;
        }
        const redundant = Boolean(res.field) && isCanonical(res.field!, norm);
        frames.push({ kind: "xml", norm, field: res.field ?? null, dropped: redundant });
        if (redundant) rec.drop = "header repeating its field";
        else {
          rec.field = sectionField() ?? "description";
          rec.how = res.field ? "label" : "section";
        }
        return;
      }
      case "xml-close": {
        anchor = null;
        const norm = normLabel(tok.tag, ctx.names);
        let at = -1;
        for (let i = frames.length - 1; i >= 0; i--) {
          const frame = frames[i]!;
          if (frame.kind === "xml" && frame.norm === norm) {
            at = i;
            break;
          }
        }
        if (at === -1) {
          rec.field = sectionField() ?? "description";
          rec.how = "section";
          return;
        }
        const frame = frames[at]!;
        const field =
          frames
            .slice(0, at + 1)
            .reverse()
            .find((f) => f.field)?.field ?? "description";
        frames.length = at;
        if (frame.dropped) rec.drop = frame.field ? "header repeating its field" : "wrapper tag";
        else {
          rec.field = field;
          rec.how = "section";
        }
        return;
      }
      case "heading": {
        anchor = null;
        const norm = tok.norm ?? normLabel(tok.label, ctx.names);
        const res = tok.res ?? resolveLabel(norm, tok.value ?? "");
        const level = tok.level;
        if (res.kind === "title") {
          if (level < 6) popHeadings(level);
          if (level >= 6) {
            rec.drop = "wrapper";
            return;
          }
          frames.push({ kind: "h", level, field: null });
          if (tok.bracket) {
            rec.drop = "wrapper"; // "[{{char}}:" opening a bracketed block
            return;
          }
          rec.field = sectionField() ?? "description";
          rec.how = "title";
          return;
        }
        const owner = level > 6 && res.field ? ownedBySection(res.field, norm) : null;
        if (owner) {
          popHeadings(level);
          frames.push({ kind: "h", level, field: null });
          rec.field = owner;
          rec.how = "section";
          return;
        }
        if (res.field) {
          popHeadings(level);
          frames.push({ kind: "h", level, field: res.field });
          if (!tok.value && isCanonical(res.field, norm)) rec.drop = "header repeating its field";
          else {
            rec.field = res.field;
            rec.how = "label";
          }
          return;
        }
        // Unknown "Label:" headers nest under the current section; unknown headings replace their level.
        if (level !== 6) popHeadings(level);
        frames.push({ kind: "h", level, field: null });
        rec.field = sectionField() ?? "description";
        rec.how = "section";
        return;
      }
      case "inline": {
        const nested = tok.bullet || tok.indent > 0;
        if (tok.res.kind === "title") {
          if (!nested) popHeadings(5); // "[CHARACTER: Autumn Pendleton]" starts a new block
          // A trait list behind the name ("{{char}}: intelligent, lonely, likes(...)") is sorted like prose.
          const traits = opts.prose && tok.listy ? classifyProse(tok.value, ctx) : null;
          rec.field = traits ?? sectionField() ?? "description";
          rec.how = traits ? "prose" : "title";
          anchor = null;
          return;
        }
        // A keyword guess never pulls a sub-item out of its section ("Skills:" > "- Aesthetic eye: ...").
        const guessed =
          nested && tok.res.how === "fuzzy" && tok.res.field && !LOOSE_FIELDS.has(tok.res.field)
            ? sectionField()
            : null;
        const owner = guessed ?? (nested && tok.res.field ? ownedBySection(tok.res.field, tok.norm) : null);
        if (owner) {
          rec.field = owner;
          rec.how = "section";
        } else if (tok.res.field) {
          rec.field = tok.res.field;
          rec.how = "label";
        } else if (nested && anchor) {
          rec.field = anchor.field;
          rec.how = "anchor";
          return; // an unknown sub-item keeps the anchor it belongs to
        } else {
          rec.field = sectionField() ?? "description";
          rec.how = "section";
        }
        anchor = tok.anchors ? { field: rec.field, listy: tok.listy } : null;
        return;
      }
      default: {
        const nested = tok.bullet || tok.indent > 0;
        if (anchor && (!anchor.listy || nested)) {
          rec.field = anchor.field;
          rec.how = "anchor";
        } else {
          if (anchor?.listy) anchor = null;
          const section = sectionField();
          rec.field = section ?? "description";
          rec.how = section ? "section" : "default";
        }
        const instruction =
          opts.instructions &&
          rec.field !== "system_prompt" &&
          (rec.field === "description" ? isInstruction(item.text) : isStrongInstruction(item.text));
        // Unlabelled prose under a generic header ("[{{char}} info:", "## Overview") is sorted like top-level prose.
        const generic = rec.how === "default" || (rec.how === "section" && rec.field === "description");
        if (instruction) {
          rec.field = "system_prompt";
          rec.how = "instruction";
        } else if (generic && !introKept) {
          introKept = true;
        } else if (generic && opts.prose) {
          const field = classifyProse(item.text, ctx);
          if (field) {
            rec.field = field;
            rec.how = "prose";
          }
        }
      }
    }
  });

  let previous: DescriptionSplitField = "description";
  for (const rec of records) {
    if (rec.how === "blank") rec.field = previous;
    else if (!rec.drop && rec.field) previous = rec.field;
  }
  return records;
}

// ───────────────────────────── card processing ─────────────────────────────
const GAME_NAME =
  /\b(game ?master|dungeon master|narrator|storyteller|text adventure|RPG|simulator|simulation|generator|CYOA)\b/i;
const GAME_TEXT = [
  /\{\{char\}\}\s+(?:is|will be|acts as|plays|assumes the role of)\s+(?:the |a |an )?(?:[\w-]+,? (?:and )?){0,3}(?:game ?master|narrator|GM\b)/i,
  /\{\{char\}\} (?:roleplays|plays|portrays|controls|narrates)(?: as)? (?:every|all|each)\b/i,
  /\bnarrat(?:e|es|ing) (?:a|an|the)\b[^.]{0,40}\b(?:game|world|story|adventure)\b/i,
  /\binteractive (?:game|story|fiction|adventure)\b/i,
  /\{\{char\}\} is (?:a|an) (?:[\w-]+ ){0,3}(?:device|machine|app|program|simulation)\b/i,
  /\{\{char\}\} is (?:a|an) (?:[\w-]+ ){0,3}(?:school|academy|world|city|kingdom|game)\s*(?:[,.;:]|where|that|which|located|in|for|with|of|on)/i,
  /\bas (?:the |a )?(?:game ?master|narrator)\b/i,
  /\bis not (?:one|a single) character\b/i,
  /\{\{char\}\} is (?:\d+|two|three|four|several|multiple) characters/i,
  /\{\{char\}\} will (?:generate|create) (?:a|new)\b/i,
  /\bcontrol (?:all|every) (?:the )?(?:characters|NPCs)\b/i,
  /\band all NPCs\b/i,
  /\bYou will control\b/,
  /\{\{char[0-9]+\}\}/i,
  /<characters>/i,
  /^\s*welcome to\b/i,
  /\byou are (?:the |a |an )?(?:narrator|game ?master|dungeon master|GM|storyteller)\b/i,
  /\bstory[- ]based bot\b/i,
  /^\s*<\w*(?:database|lorebook)\w*>/i,
];

function skipReason(name: string, before: DescriptionSplitFields, force: boolean): string | null {
  if (!before.description.trim()) return "the description is empty";
  if (force) return null;
  const filled = [before.personality, before.appearance, before.backstory].filter((v) => v.trim().length > 200);
  if (filled.length >= 2) return "the card is already structured (personality, appearance or backstory are filled)";
  if (GAME_NAME.test(name)) return "the name looks like a narrator, game or RPG card";
  const head = before.description.slice(0, 2500);
  if (GAME_TEXT.some((re) => re.test(head)))
    return "the card looks like a narrator, game, world or multi-character card";
  const nameValues = new Set<string>();
  for (const m of before.description.matchAll(NAME_LINE_RE))
    nameValues.add(m[1]!.trim().toLowerCase().split(/\s+/)[0]!);
  if (nameValues.size >= 2) return `the card describes several characters (${[...nameValues].join(", ")})`;
  if (/^\s*\p{Lu}\p{Ll}+\s+(?:and|&)\s+\p{Lu}\p{Ll}+/u.test(name)) return "the name looks like two characters";
  return null;
}

function tryJson(text: string): Record<string, unknown> | null {
  const t = text.trim();
  if (!t.startsWith("{") || !t.endsWith("}")) return null;
  try {
    const value: unknown = JSON.parse(t);
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function jsonToLines(value: Record<string, unknown>, depth = 0): string[] {
  const pad = "  ".repeat(depth);
  const human = (key: string) => {
    const s = key.replace(/_/g, " ");
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  const lines: string[] = [];
  for (const [key, v] of Object.entries(value)) {
    if (Array.isArray(v)) {
      lines.push(`${pad}${human(key)}:`);
      for (const item of v) {
        if (item && typeof item === "object") lines.push(...jsonToLines(item as Record<string, unknown>, depth + 1));
        else lines.push(`${pad}  - ${String(item)}`);
      }
    } else if (v && typeof v === "object") {
      lines.push(`${pad}${human(key)}:`, ...jsonToLines(v as Record<string, unknown>, depth + 1));
    } else lines.push(`${pad}${human(key)}: ${String(v)}`);
  }
  return lines;
}

function jsonLeaves(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((v) => jsonLeaves(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => jsonLeaves(v, out));
  else out.push(String(value));
  return out;
}

const noSpace = (s: string) => s.replace(/\s+/g, "");

function tidy(lines: string[]): string {
  const out: string[] = [];
  for (const line of lines) {
    const blank = !line.trim();
    if (blank && (!out.length || !out[out.length - 1]!.trim())) continue;
    out.push(line.trimEnd());
  }
  while (out.length && !out[out.length - 1]!.trim()) out.pop();
  // Drop the indentation shared by every line (left behind when a parent header moved or was removed).
  const indent = Math.min(...out.filter((l) => l.trim()).map((l) => l.match(/^[ \t]*/)![0].length));
  return (Number.isFinite(indent) && indent > 0 ? out.map((l) => l.slice(indent)) : out).join("\n");
}

const text = (value: unknown) => (typeof value === "string" ? value : "");

/** The seven split fields of a card, with the Marinara extension fields read from `extensions`. */
export function readDescriptionSplitFields(data: DescriptionSplitSource): DescriptionSplitFields {
  const ext = data.extensions ?? {};
  return {
    description: text(data.description),
    personality: text(data.personality),
    appearance: text(ext.appearance),
    backstory: text(ext.backstory),
    scenario: text(data.scenario),
    system_prompt: text(data.system_prompt),
    mes_example: text(data.mes_example),
  };
}

/** Writes split fields back onto a card: top-level fields plus `extensions.appearance` / `extensions.backstory`. */
export function applyDescriptionSplit<T extends DescriptionSplitSource>(data: T, after: DescriptionSplitFields): T {
  return {
    ...data,
    description: after.description,
    personality: after.personality,
    scenario: after.scenario,
    system_prompt: after.system_prompt,
    mes_example: after.mes_example,
    extensions: { ...(data.extensions ?? {}), appearance: after.appearance, backstory: after.backstory },
  };
}

function split(before: DescriptionSplitFields, name: string, opts: AssignOptions): DescriptionSplitResult {
  const result: DescriptionSplitResult = {
    status: "unchanged",
    before,
    after: { ...before },
    changed: [],
    keywordSorted: false,
    notes: [],
  };
  const names = collectNames(name, before.description);
  const ctx: Ctx = { names, nameRe: names.size ? new RegExp(`\\b(?:${[...names].join("|")})\\b`, "gi") : null };
  const json = tryJson(before.description);
  const sourceLines = json ? jsonToLines(json) : before.description.split(/\r?\n/);
  if (json) result.notes.push("description was JSON; converted to 'Key: value' lines");

  const items: Item[] = [];
  sourceLines.forEach((line, lineNo) => {
    for (const piece of expandLine(line, ctx)) items.push({ lineNo, text: piece });
  });
  if (!json && noSpace(items.map((i) => i.text).join("")) !== noSpace(before.description)) {
    throw new Error("line splitting changed the text");
  }

  const records = assignFields(items, ctx, opts);
  const moved: Record<DescriptionSplitField, string[]> = {
    description: [],
    personality: [],
    appearance: [],
    backstory: [],
    scenario: [],
    system_prompt: [],
    mes_example: [],
  };
  for (const rec of records) if (!rec.drop) moved[rec.field ?? "description"].push(rec.text);

  result.after.description = tidy(moved.description);
  const duplicates: string[] = []; // text left out because the same words are already in the field
  let addedChars = 0;
  // Text with no letters or digits ("...", "♡") is compared by its symbols: an empty key would match anything.
  // A bare <START> marker keeps the empty key, so a stray one is not added as an empty example block.
  const squash = (t: string) => {
    const bare = t.toLowerCase().replace(/<start>/g, "");
    return bare.replace(/[^\p{L}\p{N}]+/gu, "") || noSpace(bare);
  };
  for (const field of MOVED_FIELDS) {
    let movedText = tidy(moved[field]);
    if (!movedText.trim()) continue;
    const existing = before[field].trim();
    const [movedKey, existingKey] = [squash(movedText), squash(existing)];
    if (existing && existingKey.includes(movedKey)) {
      duplicates.push(movedText);
      result.notes.push(`${field}: moved text was already there, so it was not added twice`);
      continue;
    }
    if (field === "mes_example" && !movedText.trimStart().startsWith("<START>")) {
      movedText = `<START>\n${movedText}`;
      addedChars += "<START>".length;
    }
    if (existing && movedKey.includes(existingKey)) {
      duplicates.push(existing);
      result.after[field] = movedText;
      result.notes.push(`${field}: replaced, because the old text is repeated inside the moved text`);
    } else if (existing) {
      result.after[field] = `${existing}\n\n${movedText}`;
      result.notes.push(`${field}: appended to existing text`);
    } else result.after[field] = movedText;
  }
  if (!result.after.description.trim()) result.notes.push("description is now empty (everything moved)");

  // Lossless check: everything that was not deliberately dropped is somewhere in the new fields.
  const keptChars = noSpace(
    records
      .filter((r) => !r.drop)
      .map((r) => r.text)
      .join(""),
  );
  const finalChars = DESCRIPTION_SPLIT_FIELDS.map((f) => noSpace(result.after[f])).join("").length;
  const expectedChars =
    keptChars.length +
    MOVED_FIELDS.reduce((sum, f) => sum + noSpace(before[f]).length, 0) +
    addedChars -
    duplicates.reduce((sum, d) => sum + noSpace(d).length, 0);
  if (finalChars !== expectedChars) throw new Error(`text count mismatch: ${finalChars} vs ${expectedChars}`);
  if (json) {
    const all = DESCRIPTION_SPLIT_FIELDS.map((f) => result.after[f]).join("\n");
    const missing = jsonLeaves(json).filter((leaf) => leaf.trim() && !all.includes(leaf));
    if (missing.length) throw new Error(`JSON values missing: ${missing.slice(0, 3).join(" | ")}`);
  }

  result.changed = DESCRIPTION_SPLIT_FIELDS.filter((f) => result.after[f] !== before[f]);
  if (result.changed.length === 1 && result.changed[0] === "description") {
    result.after = { ...before }; // only separators/headers would go: not worth touching the card
    result.changed = [];
  }
  result.status = result.changed.length ? "changed" : "unchanged";
  result.keywordSorted = result.status === "changed" && records.some((r) => !r.drop && r.how === "prose");
  return result;
}

/**
 * Proposes how a card's description splits into Marinara's fields. Nothing is written: apply the
 * result's `after` fields with `applyDescriptionSplit` when its status is "changed".
 */
export function splitCharacterDescription(
  data: DescriptionSplitSource,
  options: DescriptionSplitOptions = {},
): DescriptionSplitResult {
  const before = readDescriptionSplitFields(data);
  const name = text(data.name);
  const reason = skipReason(name, before, options.force ?? false);
  if (reason)
    return { status: "skipped", reason, before, after: { ...before }, changed: [], keywordSorted: false, notes: [] };
  try {
    return split(before, name, { prose: options.prose ?? true, instructions: options.instructions ?? true });
  } catch (error) {
    // The lossless check failed: leave the card alone rather than lose text.
    const detail = error instanceof Error ? error.message : String(error);
    return {
      status: "skipped",
      reason: `the description could not be split without losing text (${detail})`,
      before,
      after: { ...before },
      changed: [],
      keywordSorted: false,
      notes: [],
    };
  }
}
