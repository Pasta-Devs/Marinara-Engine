// ──────────────────────────────────────────────
// SillyTavern lorebook tag / category auto-detection.
// Ported from upstream main's st-lorebook.importer.ts (detectEntryTag,
// detectCategory, CATEGORY_SIGNALS). Kept in its own module so import
// normalization stays under its line cap and the signal tables are reviewable.
// ──────────────────────────────────────────────
use super::normalization::string_array;
use serde_json::Value;

/// Lowercase "comment-or-name + content + keys" blob used for signal scoring.
/// Mirrors the text assembly in upstream main's st-lorebook importer.
fn entry_signal_text(entry: &Value) -> String {
    let header = entry
        .get("comment")
        .or_else(|| entry.get("name"))
        .and_then(Value::as_str)
        .unwrap_or("");
    let content = entry.get("content").and_then(Value::as_str).unwrap_or("");
    let keys = string_array(entry.get("key").or_else(|| entry.get("keys"))).join(" ");
    format!("{header} {content} {keys}").to_lowercase()
}

/// Auto-detect a tag for a single entry from its content/keys. Highest-scoring tag
/// wins, ties favour the earlier tag, and an entry that matches no signal gets an
/// empty tag — matching upstream main's detectEntryTag.
pub(super) fn detect_entry_tag(entry: &Value) -> String {
    const TAG_SIGNALS: &[(&str, &[&str])] = &[
        (
            "location",
            &[
                "city", "town", "village", "forest", "mountain", "river", "cave", "dungeon",
                "castle", "tower", "temple", "tavern", "inn",
            ],
        ),
        (
            "character",
            &["personality", "backstory", "appearance", "motivation", "fear", "goal", "trait"],
        ),
        (
            "item",
            &["sword", "potion", "artifact", "weapon", "armor", "ring", "amulet", "scroll", "tome"],
        ),
        (
            "faction",
            &["guild", "order", "alliance", "faction", "clan", "tribe", "house", "court"],
        ),
        (
            "lore",
            &["history", "legend", "myth", "prophecy", "ancient", "origin", "creation", "divine"],
        ),
        (
            "magic",
            &["spell", "enchant", "ritual", "arcane", "mana", "rune", "conjur", "summon"],
        ),
        (
            "creature",
            &["dragon", "beast", "monster", "demon", "undead", "spirit", "elemental", "golem"],
        ),
        (
            "event",
            &["battle", "war", "festival", "ceremony", "ritual", "tournament", "coronation"],
        ),
    ];
    let text = entry_signal_text(entry);
    let mut best_tag = "";
    let mut best_score = 0usize;
    for &(tag, signals) in TAG_SIGNALS {
        let mut score = 0usize;
        for &signal in signals {
            if text.contains(signal) {
                score += 1;
            }
        }
        if score > best_score {
            best_score = score;
            best_tag = tag;
        }
    }
    best_tag.to_string()
}

/// Auto-detect a lorebook category from its name and all entries. Scores the combined
/// text against each category's signals, highest wins (ties favour the earlier
/// category), defaulting to "world" — matching upstream main's detectCategory.
pub(super) fn detect_category(entries: &[Value], name: &str) -> &'static str {
    const CATEGORY_SIGNALS: &[(&str, &[&str])] = &[
        (
            "world",
            &[
                "world", "realm", "kingdom", "empire", "continent", "geography", "climate",
                "history", "era", "age", "calendar", "religion", "magic system", "faction",
                "political", "economy", "trade", "war", "alliance", "treaty", "culture",
            ],
        ),
        (
            "character",
            &[
                "personality", "backstory", "motivation", "goal", "fear", "trait", "relationship",
                "family", "appearance", "outfit", "skill", "ability", "power", "weakness", "likes",
                "dislikes", "occupation", "class",
            ],
        ),
        (
            "npc",
            &[
                "shopkeeper", "innkeeper", "guard", "merchant", "villager", "bartender", "noble",
                "servant", "priest", "soldier", "bandit", "traveler", "stranger", "quest giver",
                "companion", "ally", "enemy", "rival", "mentor",
            ],
        ),
        (
            "spellbook",
            &[
                "spell", "incantation", "cantrip", "ritual", "fireball", "heal", "magic missile",
                "lightning bolt", "summon", "enchant", "curse", "ward", "buff", "debuff",
                "attack skill", "special attack", "technique", "martial art", "combo",
            ],
        ),
    ];
    let mut all_text = name.to_lowercase();
    for entry in entries {
        all_text.push(' ');
        all_text.push_str(&entry_signal_text(entry));
    }
    let mut best = "world";
    let mut best_score = 0usize;
    for &(category, signals) in CATEGORY_SIGNALS {
        let mut score = 0usize;
        for &signal in signals {
            if all_text.contains(signal) {
                score += 1;
            }
        }
        if score > best_score {
            best_score = score;
            best = category;
        }
    }
    best
}
