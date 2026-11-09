// Example data for the Docs screenshots: the same made-up characters and art as the website's demo
// (marinaraengine.net), so guide pictures look alike on both. Run against an EMPTY data folder:
//   DATA_DIR=/tmp/shots-data PORT=7861 pnpm start
//   node scripts/docs-shots/seed.mjs http://localhost:7861 <folder with avatars/, backgrounds/, sprites/>
// The art folder is packages/client/public/demo-assets in Pasta-Devs/Marinara-Website.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const B = process.argv[2] || "http://localhost:7861";
const ART = process.argv[3];
if (!ART) throw new Error("Pass the demo-assets folder as the second argument.");
const H = { "content-type": "application/json" };
async function api(method, path, body) {
  const r = await fetch(`${B}/api${path}`, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} ${r.status} ${text.slice(0, 300)}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
const dataUrl = (file) => `data:image/webp;base64,${readFileSync(join(ART, file)).toString("base64")}`;
async function background(file) {
  const form = new FormData();
  form.append("file", new Blob([readFileSync(join(ART, "backgrounds", file))], { type: "image/webp" }), file);
  const r = await fetch(`${B}/api/backgrounds/upload`, { method: "POST", body: form });
  return (await r.json()).url;
}
const card = (name, description, first_mes, tags, personality = "") => ({
  data: {
    name,
    description,
    personality,
    scenario: "",
    first_mes,
    mes_example: "",
    creator_notes: "Made up for the demo.",
    system_prompt: "",
    post_history_instructions: "",
    tags,
    creator: "Marinara",
    character_version: "1.0",
    alternate_greetings: [],
    extensions: {},
  },
});
async function character(slug, ...args) {
  const c = await api("POST", "/characters", card(...args));
  await api("POST", `/characters/${c.id}/avatar`, { avatar: dataUrl(`avatars/${slug}.webp`) });
  for (const expression of ["neutral", "happy", "serious"]) {
    try {
      await api("POST", `/sprites/${c.id}`, { expression, image: dataUrl(`sprites/${slug}/${expression}.webp`) });
    } catch {
      // Not every character has sprites.
    }
  }
  return c;
}
async function persona(slug, name, description) {
  const p = await api("POST", "/characters/personas", { name, description });
  await api("POST", `/characters/personas/${p.id}/avatar`, { avatar: dataUrl(`avatars/${slug}.webp`) });
  return p;
}

const rook = await character(
  "detective-rook",
  "Detective Rook",
  "A tired detective in a city where it never stops raining. Made up for the demo.",
  "*Rook flicks rain off his hat.* The clock tower stopped at 3:12. So did the man inside it.",
  ["demo", "noir", "mystery"],
  "Patient, dry, notices everything.",
);
const juniper = await character(
  "juniper-hale",
  "Juniper Hale",
  "Runs a tiny cafe and remembers everyone's order. Made up for the demo.",
  "Morning! Your usual? I tried a new cinnamon thing, you have to taste it.",
  ["demo", "slice of life", "cozy"],
);
const kestrel = await character(
  "kestrel",
  "Kestrel",
  "The game master of the Ember Reach. Made up for the demo.",
  "The ferry docks at the edge of the Ember Reach. Ash drifts like snow.",
  ["demo", "fantasy", "game master"],
);
const mira = await character(
  "mira-voss",
  "Mira Voss",
  "Station engineer on deck 4, fighting a haunted coffee machine. Made up for the demo.",
  "The coffee machine is haunted. I am not joking.",
  ["demo", "sci-fi"],
);
const iris = await character(
  "iris",
  "Iris",
  "A cheerful lighthouse keeper in the harbor town of Saltmere. Made up for the demo.",
  "Oh, a visitor! Come in out of the fog. I just put the kettle on. What brings you to Saltmere?",
  ["demo", "cozy", "harbor"],
);
const orsolo = await character(
  "captain-orsolo",
  "Captain Orsolo",
  "A loud sea captain with a chart for every rumor. Made up for the demo.",
  "*Orsolo slams a chart on the table.* North, past the lighthouse!",
  ["demo", "fantasy", "sailor"],
);
const vale = await character(
  "dr-vale-okonkwo",
  "Dr. Vale Okonkwo",
  "The station doctor, calm in every emergency. Made up for the demo.",
  "Checking in after your shift. Did you sleep, or do I need to prescribe a nap?",
  ["demo", "sci-fi", "medic"],
);
await character(
  "seraphine-vey",
  "Seraphine Vey",
  "A masked noble who trades in secrets. Made up for the demo.",
  "*She tilts her fan.* Darling. You came.",
  ["demo", "intrigue"],
);
await character(
  "tamsin-reed",
  "Tamsin Reed",
  "A traveling bard who turns every tavern into a stage. Made up for the demo.",
  "*Tamsin tunes her lute.* Request a song, friend.",
  ["demo", "fantasy", "music"],
);
const you = await persona(
  "persona-you",
  "You",
  "A traveler visiting Saltmere. Edit this persona to change who you play.",
);
await persona("persona-nova", "Nova", "A cartographer mapping the coast near Saltmere. Example persona for the demo.");
await persona("persona-wren", "Wren", "A quiet botanist with dirt under her nails. Example persona for the demo.");

const lb = await api("POST", "/lorebooks", {
  name: "Saltmere Harbor",
  description: "Example world notes for the demo.",
  category: "world",
});
for (const [name, keys, content] of [
  ["The Saltmere Lighthouse", ["lighthouse", "lamp"], "Built 90 years ago. Its amber lamp can be seen ten miles out."],
  ["The Gull's Promise", ["Gull's Promise", "ship"], "A supply ship that should have docked two days ago."],
  ["The red umbrella", ["umbrella"], "A woman with a red umbrella is seen near every scene this month."],
  [
    "Smugglers' cove",
    ["cove", "smugglers"],
    "North of the lighthouse, hidden by fog. Two lantern blinks mean friends.",
  ],
]) {
  await api("POST", `/lorebooks/${lb.id}/entries`, { name, keys, content });
}
await api("POST", "/lorebooks", {
  name: "Rain City Case Files",
  description: "Example clues for Detective Rook.",
  category: "world",
});

const conn = await api("POST", "/connections", {
  name: "Example model",
  provider: "custom",
  baseUrl: "http://localhost:7899/v1",
  apiKey: "example",
  model: "example-model",
  isDefault: true,
});

async function chat(name, mode, chars, firstMes, lines, meta) {
  const c = await api("POST", "/chats", {
    name,
    mode,
    characterIds: chars.map((x) => x.id),
    personaId: you.id,
    connectionId: conn.id,
  });
  const all = [
    { role: "assistant", content: firstMes },
    ...lines.map((content, i) => ({ role: i % 2 ? "assistant" : "user", content })),
  ];
  for (const m of all) {
    await api("POST", `/chats/${c.id}/messages`, {
      chatId: c.id,
      role: m.role,
      characterId: m.role === "assistant" ? (chars[0]?.id ?? null) : null,
      content: m.content,
    });
  }
  if (meta) await api("PATCH", `/chats/${c.id}/metadata`, meta);
  return c;
}
const rain = await background("rain-city-street.webp");
const harbor = await background("ember-reach-ruins.webp");
await background("cozy-cafe-interior.webp");
await background("moonlit-tavern.webp");
const deck = await background("starship-deck.webp");

await chat(
  "Captain Orsolo's chart",
  "roleplay",
  [orsolo],
  "*Orsolo slams a chart on the table.* North, past the lighthouse!",
  [
    "Where are we sailing?",
    "*Orsolo jabs a finger at the chart.* North, past the lighthouse, where the fog hides the old smugglers' cove.",
  ],
);
await chat(
  "The Saltmere lighthouse",
  "roleplay",
  [iris],
  "Oh, a visitor! Come in out of the fog. I just put the kettle on. What brings you to Saltmere?",
  [
    "Just passing through. Is the lamp always this dim?",
    "*Iris frowns up at the tower, jaw clenched.* No. It flickered last night, for the first time in ninety years. And the Gull's Promise is late.",
  ],
);
await chat(
  "The clock tower case",
  "roleplay",
  [rook],
  "*Rook flicks rain off his hat.* The clock tower stopped at 3:12. So did the man inside it.",
  [
    "Who was he?",
    "*Rook opens a soggy notebook.* Elias Wren, caretaker. Forty years winding that clock. He had a key in his hand that fits nothing in the tower.",
    "Any witnesses?",
    "*Rook frowns, jaw tight.* A woman with a red umbrella, seen near every scene this month. Nobody saw her face. Everybody saw the umbrella.",
  ],
  { background: rain },
);
await chat("Chat with Mira Voss", "conversation", [mira], "The coffee machine is haunted. I am not joking.", [
  "Haunted how?",
  "It made tea. Nobody asked for tea. It does not have a tea setting.",
  "Maybe it likes you.",
  "Great. A machine with a crush. Vale says I need more sleep.",
]);
await chat(
  "Dr. Vale",
  "conversation",
  [vale],
  "Checking in after your shift. Did you sleep, or do I need to prescribe a nap?",
  ["I slept four hours. Maybe three.", "Three is not a number of hours. It is a cry for help. What kept you up?"],
  { background: deck },
);
await chat(
  "Juniper's cafe",
  "conversation",
  [juniper],
  "Morning! Your usual? I tried a new cinnamon thing, you have to taste it.",
  [
    "Surprise me.",
    "*She slides over a cup with a cinnamon heart on top.* On the house. Tell me if it is too sweet.",
    "It's perfect. Has the man in the grey coat been back?",
    "*She lowers her voice.* Every day. Black coffee, two sugars, never drinks it. Detective Rook asked about him yesterday.",
    "What did you tell Rook?",
    "That he tips well. *She winks.* And that he always takes the window seat with the best view of the lighthouse.",
  ],
);
const game = await chat(
  "The Ember Reach",
  "game",
  [kestrel],
  "The ferry docks at the edge of the Ember Reach. Ash drifts like snow.",
  [
    "I take the bridge.",
    'The bridge sways. Roll a skill check, difficulty 12. The dice show 15. You cross, and the far gate is already open.\n[Kestrel] [happy]: "Nice footwork. The gate is open, so somebody got here first."',
    "I check my pack.",
    'Your pack holds a coil of rope, two torches and a brass key that hums when you face east. The Ember Heart is east.\n[Kestrel] [serious]: "Keys that hum are never good news. Keep it close."',
  ],
  {
    background: harbor,
    gameSessionStatus: "active",
    gameWorldOverview: "The Ember Reach: drowned ruins and ash fields east of Saltmere.",
    gameStoryArc: "Find the Ember Heart in the east of the reach.",
  },
);
await api("PATCH", `/chats/${game.id}/metadata`, { gameId: game.id, gameSessionNumber: 1 });
// Illustrator, so the Selfies guide can show its settings.
const catalog = await api("GET", "/capability-packages/catalog");
const illustrator = catalog.packages.find((entry) => entry.manifest.id === "illustrator");
if (illustrator) {
  await api("POST", "/capability-packages/illustrator/install", {
    expectedVersion: illustrator.manifest.version,
    expectedArtifactSha256: illustrator.artifact.sha256,
  });
}
console.log("seeded", B, { rook: rook.id, juniper: juniper.id, lorebook: lb.id });
