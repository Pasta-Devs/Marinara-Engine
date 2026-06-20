import type { BuiltInAgentManifest } from "../agent-manifest.types.js";

const echoChamberOutputFormat = `Return valid JSON only:
{
  "reactions": [
    {
      "characterName": "string - fictional viewer screen name",
      "reaction": "string - short chat message"
    }
  ]
}`;

function createEchoChamberPrompt(style: string): string {
  return `Generate 5-10 short fictional reactions to the latest roleplay beat. Keep every reaction specific to actual names, actions, dialogue, choices, and reveals.
Style: ${style}
Rules: one line per reaction, rarely two. Vary voices and screen names. No generic comments. Keep it funny/immersive, not genuinely abusive. Do not add prose outside the JSON.
${echoChamberOutputFormat}`;
}

export const echoChamberAgentManifest = {
  id: "echo-chamber",
  name: "Echo Chamber",
  description: "Simulates a live streaming-style chat reacting to your roleplay in real time.",
  phase: "parallel",
  enabledByDefault: false,
  category: "misc",
  defaultTools: [],
  defaultSettings: {
    defaultPromptTemplateName: "Default Stream",
    defaultPromptTemplateDescription: "Chaotic livestream chat with mixed hype, jokes, analysis, shipping, and callbacks.",
  },
  promptTemplates: [
    {
      id: "ao3-wattpad",
      name: "AO3 / Wattpad",
      description: "Fanfic comment-section energy: shipping, kudos, screaming, favorite lines, and reader speculation.",
      promptTemplate: createEchoChamberPrompt(
        "AO3 and Wattpad comment section. React like invested fanfic readers leaving kudos, screaming about ships, quoting favorite lines, begging for updates, making gentle plot theories, and melting over angst/fluff. Use fandom shorthand naturally.",
      ),
    },
    {
      id: "twitter-reddit",
      name: "Twitter / Reddit",
      description: "A mix of quote-tweet reactions, thread jokes, hot takes, and subreddit analysis.",
      promptTemplate: createEchoChamberPrompt(
        "Twitter/X plus Reddit. Mix short quote-tweet style reactions, viral one-liners, thread replies, subreddit analysis, hot takes, lore speculation, and people arguing politely about what the scene means.",
      ),
    },
    {
      id: "imageboard",
      name: "4chan",
      description: "Anonymous imageboard chaos with greentext cadence, bait, and blunt reactions.",
      promptTemplate: createEchoChamberPrompt(
        "anonymous imageboard thread inspired by 4chan. Use anon handles, blunt chaotic reactions, greentext-style phrasing, bait, cope/seethe jokes, and rough humor. Keep it fictional and avoid real slurs or targeted hate.",
      ),
    },
    {
      id: "constructive",
      name: "Constructive",
      description: "Thoughtful reactions that point out strengths, pacing, continuity, and possible next beats.",
      promptTemplate: createEchoChamberPrompt(
        "constructive live critique. Viewers react warmly but thoughtfully, naming strong moments, pacing, emotional beats, continuity, character choices, and possible consequences. Keep it concise and useful, not dry.",
      ),
    },
    {
      id: "hype-squad",
      name: "Hype Squad",
      description: "Maximum cheering, caps, celebration, cheering-on, and dramatic overreaction.",
      promptTemplate: createEchoChamberPrompt(
        "pure hype squad. Viewers are loudly supportive, excited, dramatic, meme-heavy, and cheering the scene on. Use caps, emojis, chant-like reactions, W/L jokes, and explosive enthusiasm without becoming repetitive.",
      ),
    },
    {
      id: "harbingers",
      name: "Harbingers",
      description: "Fatui Harbingers and agents reacting from the peanut gallery.",
      promptTemplate: createEchoChamberPrompt(
        "Fatui Harbingers and Fatui agents watching the scene. Use screen names or voices inspired by the Harbingers, including Pierro, Capitano, Dottore, Columbina, Arlecchino, Pulcinella, Scaramouche, Sandrone, La Signora, Pantalone, Tartaglia, plus skirmishers, cicin mages, mirror maidens, debt collectors, and rank-and-file agents. Let them be dramatic, calculating, smug, theatrical, amused, or exasperated as fits the moment.",
      ),
    },
  ],
} satisfies BuiltInAgentManifest;
