/**
 * Prints Classic Marinara's item tables as Markdown (for the design doc), straight from the data.
 *   node packages/server/node_modules/tsx/dist/cli.mjs scripts/class-lab/item-tables.ts <section>
 */
import {
  MARINARA_ACCESSORIES,
  MARINARA_ARMOUR_FAMILIES,
  MARINARA_CONSUMABLES,
  MARINARA_GRADES,
  MARINARA_ITEM_SETTINGS,
  MARINARA_MARK_VALUE,
  MARINARA_TIERS,
  MARINARA_UNIQUES,
  MARINARA_WEAPON_FAMILIES,
  marinaraItemName,
  marinaraItemPrice,
} from "../../packages/shared/src/features/marinara-items.js";

const SETTINGS = ["neutral", ...MARINARA_ITEM_SETTINGS] as const;
const LABEL: Record<string, string> = {
  neutral: "Neutral",
  fantasy: "Fantasy",
  scifi: "Sci-fi",
  modern: "Modern",
  wuxia: "Wuxia",
  jazz_age: "1920s",
  wasteland: "Wasteland",
};
const sign = (n: number | null) => (n === null ? "none" : n > 0 ? `+${n}` : `${n}`);
const out: string[] = [];
const section = process.argv[2];
const place = (s: string) => ({ setting: s === "neutral" ? null : (s as never) });

if (section === "weapons") {
  out.push(
    "| Family | Type | Carried by | Might | Spell | Hit | Crit | Weight | Effect |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const f of MARINARA_WEAPON_FAMILIES) {
    const eff = f.effects?.reachPct
      ? "Reach"
      : f.effects?.pierce
        ? `Ignores ${f.effects.pierce * 100}% Def`
        : f.effects?.statusChance
          ? "+10 status"
          : f.effects?.healPct
            ? "+10% heals"
            : "";
    out.push(
      `| ${f.names.neutral} | ${f.type}${f.range === "ranged" ? ", ranged" : ""} | ${f.archetypes.join(", ")} | ${sign(f.might)} | ${sign(f.spell)} | ${sign(f.hit)} | ${sign(f.crit)} | ${f.weight} | ${eff} |`,
    );
  }
  out.push(
    "",
    `| Family | ${MARINARA_ITEM_SETTINGS.map((s) => LABEL[s]).join(" | ")} |`,
    `| --- |${MARINARA_ITEM_SETTINGS.map(() => " --- |").join("")}`,
  );
  for (const f of MARINARA_WEAPON_FAMILIES)
    out.push(`| ${f.names.neutral} | ${MARINARA_ITEM_SETTINGS.map((s) => f.names[s]).join(" | ")} |`);
}
if (section === "grades") {
  out.push(
    `| Tier | ${SETTINGS.map((s) => LABEL[s]).join(" | ")} |`,
    `| --- |${SETTINGS.map(() => " --- |").join("")}`,
  );
  for (const t of MARINARA_TIERS) out.push(`| T${t} | ${SETTINGS.map((s) => MARINARA_GRADES[s][t - 1]).join(" | ")} |`);
}
if (section === "armour") {
  out.push(
    "| Armour | Worn by | Defense | Resistance | Weight | T3 Def/Res | " +
      MARINARA_ITEM_SETTINGS.map((s) => LABEL[s]).join(" | ") +
      " |",
    "| --- | --- | --- | --- | --- | --- |" + MARINARA_ITEM_SETTINGS.map(() => " --- |").join(""),
  );
  for (const f of MARINARA_ARMOUR_FAMILIES)
    out.push(
      `| ${f.names.neutral} | ${f.archetypes.join(", ")} | ${f.defense}×tier | ${f.resistance}×tier | ${f.weight} | ${Math.round(3 * f.defense)}/${Math.round(3 * f.resistance)} | ${MARINARA_ITEM_SETTINGS.map((s) => f.names[s]).join(" | ")} |`,
    );
  out.push("", "| Accessory | First tier | Effect | Fantasy name | Sci-fi name |", "| --- | --- | --- | --- | --- |");
  for (const a of MARINARA_ACCESSORIES)
    out.push(`| ${a.names.neutral} | T${a.tier} | ${a.summary} | ${a.names.fantasy} | ${a.names.scifi} |`);
}
if (section === "uniques") {
  out.push("| Tree | Tier | Built on | Effect | Names (settings it exists in) |", "| --- | --- | --- | --- | --- |");
  for (const u of MARINARA_UNIQUES)
    out.push(
      `| ${u.tree} | T${u.tier} | ${u.family ?? "accessory"} | ${u.summary} | ${Object.entries(u.names)
        .map(([s, n]) => `${n} (${LABEL[s]})`)
        .join("; ")} |`,
    );
}
if (section === "consumables") {
  out.push(
    `| Item | Tier | Does | Price (marks) | ${MARINARA_ITEM_SETTINGS.map((s) => LABEL[s]).join(" | ")} |`,
    `| --- | --- | --- | --- |${MARINARA_ITEM_SETTINGS.map(() => " --- |").join("")}`,
  );
  for (const c of MARINARA_CONSUMABLES) {
    if (c.id.startsWith("bomb-") && !c.id.startsWith("bomb-fire")) continue;
    if (c.id.startsWith("boon-") && c.id !== "boon-strength") continue;
    const label = c.id.startsWith("bomb-fire")
      ? `${c.names.neutral} (and Frost, Storm, Sun, Shadow)`
      : c.id === "boon-strength"
        ? "Boon of a stat (one per stat)"
        : c.names.neutral;
    const extra = c.excludeKits ? " Not in modern_day." : "";
    out.push(
      `| ${label} | T${c.tier} | ${c.summary}${extra} | ${marinaraItemPrice(c.id) ?? "found only"} | ${MARINARA_ITEM_SETTINGS.map((s) => marinaraItemName(c.id, place(s))).join(" | ")} |`,
    );
  }
}
if (section === "prices") {
  out.push(
    `| Tier | Weapon (marks) | Armour | Accessory | Tier heal | ${SETTINGS.filter((s) => s !== "neutral")
      .map((s) => `Sword in ${LABEL[s]}`)
      .join(" | ")} |`,
    `| --- | --- | --- | --- | --- |${MARINARA_ITEM_SETTINGS.map(() => " --- |").join("")}`,
  );
  for (const t of MARINARA_TIERS) {
    const sword = marinaraItemPrice(`longblade-t${t}`)!;
    out.push(
      `| T${t} | ${sword} | ${marinaraItemPrice(`mail-t${t}`)} | ${Math.round(40 * 2 ** (t - 1))} | ${marinaraItemPrice(t >= 5 ? "heal-3" : t >= 3 ? "heal-2" : "heal-1")} | ${MARINARA_ITEM_SETTINGS.map((s) => sword * MARINARA_MARK_VALUE[s]).join(" | ")} |`,
    );
  }
}
console.log(out.join("\n"));
