// ──────────────────────────────────────────────
// One line per model in long provider lists: a proxy such as LinkAPI lists the same model several times with tags
// for its route or billing ("[free]claude-fable-5-1", "[SP]claude-fable-5-1", "…-thinking"). The pickers show the
// base model once with "3 variants", and the variants open under it.
//
// Only tags that never name a different model are folded: a leading [tag], a trailing [tag] or @tag, a :tag
// (OpenRouter ":free", NanoGPT ":thinking"), a gateway path ("vendor/…"), thinking on/off and search suffixes, and
// reasoning effort suffixes after a version number ("gpt-5.1-high"). Sizes and names such as "-max", "-mini",
// "-medium" or dates are part of the model and stay apart.
// ──────────────────────────────────────────────

const LEADING_TAG = /^\s*[[(（【]([^\])）】]{1,24})[\])）】]\s*/u;
const TRAILING_TAG = /\s*(?:[[(（【]([^\])）】]{1,24})[\])）】]|@([\w.-]{1,24}))\s*$/u;
const BEHAVIOUR_SUFFIX = /-(thinking(?:-\d+)?|think|nothinking|nothink|no-thinking|non-thinking|search)$/u;
const EFFORT_SUFFIX = /(\d)-(minimal|low|high|xhigh)$/u;

/** The base model of an id ("[SP]claude-fable-5-1-thinking" is "claude-fable-5-1") and the tags folded away. */
export function splitModelVariant(id: string): { base: string; tags: string[] } {
  let rest = id.trim();
  const tags: string[] = [];
  // Each loop removes at most one tag; the caps keep a crafted id from looping once per character.
  for (let pass = 0; pass < 3; pass++) {
    const lead = LEADING_TAG.exec(rest);
    if (!lead) break;
    tags.push(lead[1]!.trim());
    rest = rest.slice(lead[0].length);
  }
  for (let pass = 0; pass < 3; pass++) {
    const trail = TRAILING_TAG.exec(rest);
    if (!trail || trail.index === 0) break;
    tags.push((trail[1] ?? trail[2] ?? "").trim());
    rest = rest.slice(0, trail.index);
  }
  const slash = rest.lastIndexOf("/");
  if (slash >= 0 && slash < rest.length - 1) rest = rest.slice(slash + 1);
  const colon = rest.indexOf(":");
  if (colon > 0) {
    tags.push(rest.slice(colon + 1));
    rest = rest.slice(0, colon);
  }
  for (let pass = 0; pass < 2; pass++) {
    const behaviour = BEHAVIOUR_SUFFIX.exec(rest);
    const effort = behaviour ? null : EFFORT_SUFFIX.exec(rest);
    if (behaviour) {
      tags.push(behaviour[1]!);
      rest = rest.slice(0, behaviour.index);
    } else if (effort) {
      tags.push(effort[2]!);
      rest = rest.slice(0, effort.index + 1);
    } else break;
  }
  const base = rest.trim();
  return base ? { base, tags: tags.filter(Boolean) } : { base: id.trim(), tags: [] };
}

/** The key two ids share when they are variants of one model. */
export function modelVariantKey(id: string): string {
  return splitModelVariant(id).base.toLowerCase();
}

/** A variant's short name under its base: its tags ("SP · thinking"), or the id when it has none. */
export function variantLabel(id: string): string {
  const { tags } = splitModelVariant(id);
  return tags.length ? tags.join(" · ") : id;
}

export interface ModelVariantGroup<T> {
  key: string;
  /** The base model's name, as the first variant spells it. */
  base: string;
  items: T[];
}

/** Items grouped by base model, in the order each base first appears; a model without variants is a group of one. */
export function groupModelVariants<T>(items: readonly T[], idOf: (item: T) => string): Array<ModelVariantGroup<T>> {
  const groups = new Map<string, ModelVariantGroup<T>>();
  for (const item of items) {
    const { base } = splitModelVariant(idOf(item));
    const key = base.toLowerCase();
    const group = groups.get(key);
    if (group) group.items.push(item);
    else groups.set(key, { key, base, items: [item] });
  }
  return [...groups.values()];
}
